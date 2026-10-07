import { Router } from 'express';
import { z } from 'zod';
import { healthService } from '../services/health.service';
import { dashboardService } from '../services/dashboard.service';
import { authService } from '../services/auth.service';
import { nasRepository } from '../repositories/nas.repository';
import { packageRepository } from '../repositories/package.repository';
import { subscriberRepository } from '../repositories/subscriber.repository';
import { radAcctRepository } from '../repositories/radacct.repository';
import { radPostAuthRepository } from '../repositories/radpostauth.repository';
import { auditRepository } from '../repositories/audit.repository';
import { RadiusClient, RadiusCode } from '../radius/radius-client';
import { config } from '../config/env';
import { asyncHandler } from '../lib/async-handler';
import { envelope } from '../lib/response';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.middleware';
import type { TimeRange } from '../types/api';

export const apiRouter = Router();

// ---- Auth Routes ----
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

apiRouter.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const ip = req.ip || null;
    const userAgent = req.headers['user-agent'] || null;

    const result = await authService.authenticate(username, password, ip, userAgent);

    res.cookie('radius_token', result.token, {
      httpOnly: true,
      secure: config.COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: 30 * 24 * 3600 * 1000,
    });

    res.json(envelope(result, 'live'));
  })
);

apiRouter.post(
  '/auth/logout',
  asyncHandler(async (_req, res) => {
    res.clearCookie('radius_token');
    res.json(envelope({ message: 'Logged out successfully' }, 'live'));
  })
);

apiRouter.get(
  '/auth/me',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json(envelope(req.user, 'live'));
  })
);

// ---- Health Check Routes ----
apiRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const health = await healthService.checkAll();
    const isOk = health.status !== 'critical';
    res.status(isOk ? 200 : 503).json(envelope(health, 'live'));
  })
);

apiRouter.get(
  '/system/health',
  asyncHandler(async (_req, res) => {
    const health = await healthService.checkAll();
    res.json(envelope(health, 'live'));
  })
);

// ---- Dashboard Routes ----
apiRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const range = (req.query.range as TimeRange) || '24h';
    const data = await dashboardService.getDashboardData(range);
    res.json(envelope(data, 'live'));
  })
);

// ---- NAS Devices Management Routes ----
const createNasSchema = z.object({
  name: z.string().min(1).max(64),
  ip_address: z.string().ip({ version: 'v4' }),
  nas_type: z.enum(['mikrotik', 'cisco', 'juniper', 'huawei', 'other']).default('mikrotik'),
  secret: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  coa_port: z.number().int().min(1).max(65535).default(3799),
  status: z.enum(['online', 'warning', 'offline', 'unknown']).default('online'),
});

const updateNasSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  ip_address: z.string().ip({ version: 'v4' }).optional(),
  nas_type: z.enum(['mikrotik', 'cisco', 'juniper', 'huawei', 'other']).optional(),
  secret: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  coa_port: z.number().int().min(1).max(65535).optional(),
  status: z.enum(['online', 'warning', 'offline', 'unknown']).optional(),
  is_active: z.boolean().optional(),
});

apiRouter.get(
  '/nas',
  asyncHandler(async (_req, res) => {
    const devices = await nasRepository.listWithSessions();
    res.json(envelope(devices, 'live'));
  })
);

apiRouter.post(
  '/nas',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = createNasSchema.parse(req.body);
    const created = await nasRepository.create(body);

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'nas.create',
      entityType: 'nas',
      entityId: String(created.id),
      status: 'success',
      metadata: { name: created.name, ip: created.ip_address, type: created.nas_type },
    });

    res.status(201).json(envelope(created, 'live'));
  })
);

apiRouter.get(
  '/nas/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const item = await nasRepository.findById(id);
    if (!item) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }
    // Never expose secret in plain text
    const sanitized = { ...item, secret: '••••••••' };
    res.json(envelope(sanitized, 'live'));
  })
);

apiRouter.put(
  '/nas/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const body = updateNasSchema.parse(req.body);
    const updated = await nasRepository.update(id, body);
    if (!updated) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'nas.update',
      entityType: 'nas',
      entityId: String(id),
      status: 'success',
      metadata: { name: updated.name, ip: updated.ip_address },
    });

    res.json(envelope(updated, 'live'));
  })
);

apiRouter.delete(
  '/nas/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const success = await nasRepository.delete(id);

    if (success) {
      await auditRepository.insert({
        userId: req.user?.userId,
        username: req.user?.username,
        action: 'nas.delete',
        entityType: 'nas',
        entityId: String(id),
        status: 'success',
      });
    }

    res.json(envelope({ success }, 'live'));
  })
);

apiRouter.post(
  '/nas/:id/test',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const nas = await nasRepository.findById(id);
    if (!nas) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }

    const client = new RadiusClient({
      host: nas.ip_address,
      secret: (nas as any).secret || 'testing123',
      timeoutMs: 2500,
    });

    const start = Date.now();
    try {
      const resp = await client.statusServer(1812, 'nas-probe');
      res.json(
        envelope(
          {
            success: true,
            latencyMs: resp.latencyMs,
            message: `NAS ${nas.name} (${nas.ip_address}) responded in ${resp.latencyMs}ms`,
          },
          'live'
        )
      );
    } catch (err: any) {
      res.json(
        envelope(
          {
            success: false,
            latencyMs: Date.now() - start,
            message: `Probe failed: ${err.message}`,
          },
          'live'
        )
      );
    }
  })
);

// ---- Service Packages Management Routes ----
const createPackageSchema = z.object({
  name: z.string().min(1).max(64),
  download_speed_mbps: z.number().int().positive(),
  upload_speed_mbps: z.number().int().positive(),
  rate_limit: z.string().optional(),
  validity_days: z.number().int().positive().default(30),
  price: z.number().nonnegative().default(0),
  currency: z.string().default('NPR'),
  description: z.string().optional(),
  attributes: z.array(z.object({ attribute: z.string(), op: z.string().default(':='), value: z.string() })).optional(),
});

const updatePackageSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  download_speed_mbps: z.number().int().positive().optional(),
  upload_speed_mbps: z.number().int().positive().optional(),
  rate_limit: z.string().optional(),
  validity_days: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  attributes: z.array(z.object({ attribute: z.string(), op: z.string().default(':='), value: z.string() })).optional(),
});

apiRouter.get(
  '/packages',
  asyncHandler(async (_req, res) => {
    const list = await packageRepository.list();
    res.json(envelope(list, 'live'));
  })
);

apiRouter.post(
  '/packages',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = createPackageSchema.parse(req.body);
    const created = await packageRepository.create(body);

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'package.create',
      entityType: 'package',
      entityId: String(created.id),
      status: 'success',
      metadata: { name: created.name, rate_limit: created.rate_limit },
    });

    res.status(201).json(envelope(created, 'live'));
  })
);

apiRouter.get(
  '/packages/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const item = await packageRepository.findById(id);
    if (!item) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }
    res.json(envelope(item, 'live'));
  })
);

apiRouter.put(
  '/packages/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const body = updatePackageSchema.parse(req.body);
    const updated = await packageRepository.update(id, body);
    if (!updated) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'package.update',
      entityType: 'package',
      entityId: String(id),
      status: 'success',
      metadata: { name: updated.name },
    });

    res.json(envelope(updated, 'live'));
  })
);

apiRouter.delete(
  '/packages/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const success = await packageRepository.delete(id);

    if (success) {
      await auditRepository.insert({
        userId: req.user?.userId,
        username: req.user?.username,
        action: 'package.delete',
        entityType: 'package',
        entityId: String(id),
        status: 'success',
      });
    }

    res.json(envelope({ success }, 'live'));
  })
);

// ---- Subscribers Management Routes ----
const createSubscriberSchema = z.object({
  customer_id: z.string().min(1).max(32),
  username: z.string().min(1).max(64),
  password: z.string().min(4),
  confirm_password: z.string().min(4).optional(),
  full_name: z.string().min(1).max(128),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  status: z.enum(['enabled', 'disabled', 'suspended']).default('enabled'),
  current_package_id: z.number().int().optional(),
  static_ip: z.string().optional().or(z.literal('')),
  mac_address: z.string().optional(),
  vlan_id: z.number().int().optional(),
  nas_restriction_id: z.number().int().optional(),
  expiry_date: z.string().optional(),
  notes: z.string().optional(),
});

const updateSubscriberSchema = z.object({
  customer_id: z.string().min(1).max(32).optional(),
  password: z.string().min(4).optional(),
  full_name: z.string().min(1).max(128).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  status: z.enum(['enabled', 'disabled', 'suspended']).optional(),
  current_package_id: z.number().int().nullable().optional(),
  static_ip: z.string().optional().or(z.literal('')),
  mac_address: z.string().optional(),
  vlan_id: z.number().int().nullable().optional(),
  nas_restriction_id: z.number().int().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  notes: z.string().optional(),
});

apiRouter.get(
  '/subscribers',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const package_id = req.query.package_id ? Number(req.query.package_id) : undefined;
    const is_online = req.query.is_online === 'true' ? true : req.query.is_online === 'false' ? false : undefined;
    const nas_id = req.query.nas_id ? Number(req.query.nas_id) : undefined;
    const sort_by = req.query.sort_by as string;
    const sort_dir = (req.query.sort_dir as 'asc' | 'desc') || 'desc';

    const result = await subscriberRepository.list({
      page,
      limit,
      search,
      status,
      package_id,
      is_online,
      nas_id,
      sort_by,
      sort_dir,
    });

    res.json(envelope(result.data, 'live', result.meta));
  })
);

apiRouter.post(
  '/subscribers',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = createSubscriberSchema.parse(req.body);
    const created = await subscriberRepository.create(body);

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'subscriber.create',
      entityType: 'subscriber',
      entityId: String(created.id),
      status: 'success',
      metadata: { username: created.username, customer_id: created.customer_id },
    });

    res.status(201).json(envelope(created, 'live'));
  })
);

apiRouter.get(
  '/subscribers/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const sub = await subscriberRepository.findById(id);
    if (!sub) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }
    res.json(envelope(sub, 'live'));
  })
);

apiRouter.put(
  '/subscribers/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const body = updateSubscriberSchema.parse(req.body);
    const updated = await subscriberRepository.update(id, body);
    if (!updated) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'subscriber.update',
      entityType: 'subscriber',
      entityId: String(id),
      status: 'success',
      metadata: { username: updated.username },
    });

    res.json(envelope(updated, 'live'));
  })
);

apiRouter.post(
  '/subscribers/:id/status',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const statusSchema = z.object({
      status: z.enum(['enabled', 'disabled', 'suspended']),
      disconnect_active: z.boolean().optional(),
    });
    const { status, disconnect_active } = statusSchema.parse(req.body);

    const updated = await subscriberRepository.updateStatus(id, status);
    if (!updated) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }

    if (disconnect_active && (status === 'suspended' || status === 'disabled') && updated.current_session_id) {
      try {
        await radAcctRepository.disconnect(updated.current_session_id);
      } catch {}
    }

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: `subscriber.${status}`,
      entityType: 'subscriber',
      entityId: String(id),
      status: 'success',
      metadata: { username: updated.username, status },
    });

    res.json(envelope(updated, 'live'));
  })
);

apiRouter.get(
  '/subscribers/:id/sessions',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const sub = await subscriberRepository.findById(id);
    if (!sub) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }

    const history = await radAcctRepository.userSessionHistory(sub.username, 20);
    res.json(envelope(history, 'live'));
  })
);

apiRouter.get(
  '/subscribers/:id/auth-logs',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const sub = await subscriberRepository.findById(id);
    if (!sub) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }

    const history = await radPostAuthRepository.userAuthHistory(sub.username, 20);
    res.json(envelope(history, 'live'));
  })
);

apiRouter.delete(
  '/subscribers/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const success = await subscriberRepository.delete(id);

    if (success) {
      await auditRepository.insert({
        userId: req.user?.userId,
        username: req.user?.username,
        action: 'subscriber.delete',
        entityType: 'subscriber',
        entityId: String(id),
        status: 'success',
      });
    }

    res.json(envelope({ success }, 'live'));
  })
);

// ---- Online Sessions & CoA Disconnect Routes ----
apiRouter.get(
  '/radius/sessions',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search as string;
    const nas_ip = req.query.nas_ip as string;
    const username = req.query.username as string;

    const result = await radAcctRepository.listActiveSessions({ page, limit, search, nas_ip, username });
    res.json(envelope(result.data, 'live', result.meta));
  })
);

apiRouter.post(
  '/radius/sessions/:id/disconnect',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    const result = await radAcctRepository.disconnect(id);

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'session.disconnect',
      entityType: 'session',
      entityId: id,
      status: result.success ? 'success' : 'failure',
      metadata: { message: result.message, method: result.method },
    });

    res.json(envelope(result, 'live'));
  })
);

// ---- Authentication Logs Routes ----
apiRouter.get(
  '/radius/authentication-logs',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const search = req.query.search as string;
    const reply = req.query.reply as string;
    const username = req.query.username as string;

    const result = await radPostAuthRepository.listLogs({ page, limit, search, reply, username });
    res.json(envelope(result.data, 'live', result.meta));
  })
);

// ---- Audit Logs Route ----
apiRouter.get(
  '/audit-logs',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 50;
    const logs = await auditRepository.recent(limit);
    res.json(envelope(logs, 'live'));
  })
);

// ---- RADIUS Overview & Interactive Test Probe ----
apiRouter.get(
  '/radius/status',
  asyncHandler(async (_req, res) => {
    const health = await healthService.checkAll();
    const frHealth = health.services.find((s) => s.key === 'freeradius');
    const authHealth = health.services.find((s) => s.key === 'radius_auth');
    const acctHealth = health.services.find((s) => s.key === 'radius_acct');

    res.json(
      envelope(
        {
          isReachable: frHealth?.status === 'healthy',
          authStatus: authHealth?.status || 'offline',
          acctStatus: acctHealth?.status || 'offline',
          services: [frHealth, authHealth, acctHealth].filter(Boolean),
        },
        'live'
      )
    );
  })
);

apiRouter.get(
  '/radius/statistics',
  asyncHandler(async (req, res) => {
    const range = (req.query.range as TimeRange) || '24h';
    const authStats = await dashboardService.getAuthStatistics(range);
    res.json(envelope(authStats, 'live'));
  })
);

apiRouter.get(
  '/radius/activity',
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const activity = await dashboardService.getRecentActivity(limit);
    res.json(envelope(activity, 'live'));
  })
);

const testSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  host: z.string().optional(),
  port: z.number().int().optional(),
  secret: z.string().optional(),
});

apiRouter.post(
  '/radius/test',
  asyncHandler(async (req, res) => {
    const body = testSchema.parse(req.body);
    const client = new RadiusClient({
      host: body.host || config.RADIUS_HOST,
      secret: body.secret || config.RADIUS_SECRET,
      timeoutMs: 3000,
    });

    const port = body.port || config.RADIUS_AUTH_PORT;
    const start = Date.now();
    try {
      const resp = await client.accessRequest(port, body.username, body.password, 'radius-pro-admin-test');
      const isAccept = resp.code === RadiusCode.AccessAccept;
      res.json(
        envelope(
          {
            success: isAccept,
            code: resp.code,
            codeName: resp.codeName,
            replyMessage: resp.replyMessage,
            mikrotikRateLimit: resp.mikrotikRateLimit,
            latencyMs: resp.latencyMs,
            message: isAccept ? 'Authentication Successful (Access-Accept)' : `Authentication Failed (${resp.codeName})`,
          },
          'live'
        )
      );
    } catch (err: any) {
      res.status(502).json(
        envelope(
          {
            success: false,
            latencyMs: Date.now() - start,
            message: `RADIUS error: ${err.message}`,
          },
          'live'
        )
      );
    }
  })
);
