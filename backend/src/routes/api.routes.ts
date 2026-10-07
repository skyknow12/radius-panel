import { Router } from 'express';
import { z } from 'zod';
import { healthService } from '../services/health.service';
import { dashboardService } from '../services/dashboard.service';
import { authService } from '../services/auth.service';
import { nasRepository } from '../repositories/nas.repository';
import { packageRepository } from '../repositories/package.repository';
import { subscriberRepository } from '../repositories/subscriber.repository';
import { radiusProfileRepository } from '../repositories/radius-profile.repository';
import { ipPoolRepository } from '../repositories/ip-pool.repository';
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
  burst_download_mbps: z.number().int().positive().optional(),
  burst_upload_mbps: z.number().int().positive().optional(),
  burst_threshold_dl_mbps: z.number().int().positive().optional(),
  burst_threshold_ul_mbps: z.number().int().positive().optional(),
  burst_time_seconds: z.number().int().positive().optional(),
  radius_profile_id: z.number().int().optional(),
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
  burst_download_mbps: z.number().int().positive().nullable().optional(),
  burst_upload_mbps: z.number().int().positive().nullable().optional(),
  burst_threshold_dl_mbps: z.number().int().positive().nullable().optional(),
  burst_threshold_ul_mbps: z.number().int().positive().nullable().optional(),
  burst_time_seconds: z.number().int().positive().nullable().optional(),
  radius_profile_id: z.number().int().nullable().optional(),
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
  status: z.enum(['active', 'suspended', 'expired', 'disabled', 'pending', 'terminated', 'enabled']).default('active'),
  connection_type: z.enum(['PPPoE', 'IPoE', 'Static IP', 'Other']).default('PPPoE'),
  address: z.string().optional(),
  area: z.string().optional(),
  branch: z.string().optional(),
  installation_date: z.string().optional(),
  current_package_id: z.number().int().optional(),
  ip_pool_id: z.number().int().optional(),
  static_ip: z.string().optional().or(z.literal('')),
  ipv6_address: z.string().optional().or(z.literal('')),
  ipv6_prefix: z.string().optional().or(z.literal('')),
  ipv6_prefix_length: z.number().int().optional(),
  mac_address: z.string().optional(),
  vlan_id: z.number().int().optional(),
  nas_restriction_id: z.number().int().optional(),
  olt_pon_port: z.string().optional(),
  onu_mac_sn: z.string().optional(),
  onu_model: z.string().optional(),
  expiry_date: z.string().optional(),
  notes: z.string().optional(),
});

const updateSubscriberSchema = z.object({
  customer_id: z.string().min(1).max(32).optional(),
  password: z.string().min(4).optional(),
  full_name: z.string().min(1).max(128).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  status: z.enum(['active', 'suspended', 'expired', 'disabled', 'pending', 'terminated', 'enabled']).optional(),
  connection_type: z.enum(['PPPoE', 'IPoE', 'Static IP', 'Other']).optional(),
  address: z.string().optional(),
  area: z.string().optional(),
  branch: z.string().optional(),
  installation_date: z.string().nullable().optional(),
  current_package_id: z.number().int().nullable().optional(),
  ip_pool_id: z.number().int().nullable().optional(),
  static_ip: z.string().optional().or(z.literal('')),
  ipv6_address: z.string().optional().or(z.literal('')),
  ipv6_prefix: z.string().optional().or(z.literal('')),
  ipv6_prefix_length: z.number().int().nullable().optional(),
  mac_address: z.string().optional(),
  vlan_id: z.number().int().nullable().optional(),
  nas_restriction_id: z.number().int().nullable().optional(),
  olt_pon_port: z.string().optional(),
  onu_mac_sn: z.string().optional(),
  onu_model: z.string().optional(),
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
    const connection_type = req.query.connection_type as string;
    const branch = req.query.branch as string;
    const ip_pool_id = req.query.ip_pool_id ? Number(req.query.ip_pool_id) : undefined;
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
      connection_type,
      branch,
      ip_pool_id,
      sort_by,
      sort_dir,
    });

    res.json(envelope(result.data, 'live', result.meta));
  })
);

apiRouter.get(
  '/subscribers/export/csv',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const search = req.query.search as string;
    const status = req.query.status as string;
    const package_id = req.query.package_id ? Number(req.query.package_id) : undefined;
    const nas_id = req.query.nas_id ? Number(req.query.nas_id) : undefined;

    const csvContent = await subscriberRepository.exportCsv({ search, status, package_id, nas_id });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="subscribers_${Date.now()}.csv"`);
    res.send(csvContent);
  })
);

apiRouter.get(
  '/subscribers/expiring',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const filter = (req.query.filter as any) || '7days';
    const list = await subscriberRepository.getExpiringSoon(filter);
    res.json(envelope(list, 'live'));
  })
);

apiRouter.post(
  '/subscribers/bulk',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const bulkSchema = z.object({
      action: z.enum(['suspend', 'resume', 'enable', 'disable', 'change_package']),
      subscriber_ids: z.array(z.number().int()).min(1),
      package_id: z.number().int().optional(),
    });
    const { action, subscriber_ids, package_id } = bulkSchema.parse(req.body);
    const result = await subscriberRepository.bulkAction(
      action,
      subscriber_ids,
      package_id,
      req.user?.username || 'admin',
    );

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: `subscriber.bulk_${action}`,
      entityType: 'subscriber',
      entityId: `bulk_${subscriber_ids.length}`,
      status: 'success',
      metadata: { action, count: subscriber_ids.length, successful: result.successful, failed: result.failed },
    });

    res.json(envelope(result, 'live'));
  })
);

apiRouter.post(
  '/subscribers',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = createSubscriberSchema.parse(req.body);
    const created = await subscriberRepository.create(body, req.user?.username || 'admin');

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
  '/subscribers/:id/profile',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const profile = await subscriberRepository.getProfile(id);
    if (!profile) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }
    res.json(envelope(profile, 'live'));
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
    const updated = await subscriberRepository.update(id, body, req.user?.username || 'admin');
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
  '/subscribers/:id/suspend',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    await subscriberRepository.suspend(id, req.user?.username || 'admin');
    const updated = await subscriberRepository.findById(id);

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'subscriber.suspend',
      entityType: 'subscriber',
      entityId: String(id),
      status: 'success',
      metadata: { username: updated?.username },
    });

    res.json(envelope(updated, 'live'));
  })
);

apiRouter.post(
  '/subscribers/:id/resume',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    await subscriberRepository.resume(id, req.user?.username || 'admin');
    const updated = await subscriberRepository.findById(id);

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'subscriber.resume',
      entityType: 'subscriber',
      entityId: String(id),
      status: 'success',
      metadata: { username: updated?.username },
    });

    res.json(envelope(updated, 'live'));
  })
);

apiRouter.post(
  '/subscribers/:id/password',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const passwordSchema = z.object({
      new_password: z.string().min(4),
      disconnect_session: z.boolean().default(false),
    });
    const { new_password, disconnect_session } = passwordSchema.parse(req.body);
    await subscriberRepository.changePassword(id, new_password, disconnect_session, req.user?.username || 'admin');

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'subscriber.password_change',
      entityType: 'subscriber',
      entityId: String(id),
      status: 'success',
    });

    res.json(envelope({ success: true, message: 'Password changed successfully' }, 'live'));
  })
);

apiRouter.post(
  '/subscribers/:id/change-package',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const pkgChangeSchema = z.object({
      new_package_id: z.number().int().positive(),
      apply_coa: z.boolean().default(true),
    });
    const { new_package_id, apply_coa } = pkgChangeSchema.parse(req.body);
    const result = await subscriberRepository.changePackage(
      id,
      new_package_id,
      apply_coa,
      req.user?.username || 'admin',
    );

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'subscriber.change_package',
      entityType: 'subscriber',
      entityId: String(id),
      status: 'success',
      metadata: { new_package_id, apply_coa, coaApplied: result.coaApplied },
    });

    res.json(envelope(result, 'live'));
  })
);

apiRouter.get(
  '/subscribers/:id/usage',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const range = (req.query.range as any) || '30d';
    const usage = await subscriberRepository.getUsage(id, range);
    res.json(envelope(usage, 'live'));
  })
);

apiRouter.get(
  '/subscribers/:id/notes',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const profile = await subscriberRepository.getProfile(id);
    res.json(envelope(profile?.notes || [], 'live'));
  })
);

apiRouter.post(
  '/subscribers/:id/notes',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const noteSchema = z.object({ content: z.string().min(1) });
    const { content } = noteSchema.parse(req.body);

    const createdNote = await subscriberRepository.addNote(
      id,
      req.user?.username || 'Admin',
      content,
      req.user?.userId,
    );

    await subscriberRepository.logActivity(id, 'note_added', `Note added: "${content.slice(0, 30)}..."`, req.user?.username);

    res.status(201).json(envelope(createdNote, 'live'));
  })
);

apiRouter.get(
  '/subscribers/:id/activity',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const profile = await subscriberRepository.getProfile(id);
    res.json(envelope(profile?.activity || [], 'live'));
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

    const history = await radAcctRepository.userSessionHistory(sub.username, 50);
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

    const history = await radPostAuthRepository.userAuthHistory(sub.username, 50);
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

// ---- RADIUS Profiles & Generic Attributes Routes ----
const createProfileSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  attributes: z
    .array(
      z.object({
        vendor: z.string().default('Standard'),
        attribute_name: z.string().min(1),
        attribute_type: z.string().default('string'),
        op: z.string().default(':='),
        value: z.string(),
      })
    )
    .optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
  attributes: z
    .array(
      z.object({
        vendor: z.string().default('Standard'),
        attribute_name: z.string().min(1),
        attribute_type: z.string().default('string'),
        op: z.string().default(':='),
        value: z.string(),
      })
    )
    .optional(),
});

apiRouter.get(
  '/radius-profiles',
  asyncHandler(async (_req, res) => {
    const profiles = await radiusProfileRepository.list();
    res.json(envelope(profiles, 'live'));
  })
);

apiRouter.post(
  '/radius-profiles',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = createProfileSchema.parse(req.body);
    const created = await radiusProfileRepository.create(body);

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'radius_profile.create',
      entityType: 'radius_profile',
      entityId: String(created.id),
      status: 'success',
      metadata: { name: created.name },
    });

    res.status(201).json(envelope(created, 'live'));
  })
);

apiRouter.get(
  '/radius-profiles/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const profile = await radiusProfileRepository.findById(id);
    if (!profile) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }
    res.json(envelope(profile, 'live'));
  })
);

apiRouter.put(
  '/radius-profiles/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const body = updateProfileSchema.parse(req.body);
    const updated = await radiusProfileRepository.update(id, body);
    if (!updated) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'radius_profile.update',
      entityType: 'radius_profile',
      entityId: String(id),
      status: 'success',
      metadata: { name: updated.name },
    });

    res.json(envelope(updated, 'live'));
  })
);

apiRouter.delete(
  '/radius-profiles/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const success = await radiusProfileRepository.delete(id);
    if (success) {
      await auditRepository.insert({
        userId: req.user?.userId,
        username: req.user?.username,
        action: 'radius_profile.delete',
        entityType: 'radius_profile',
        entityId: String(id),
        status: 'success',
      });
    }
    res.json(envelope({ success }, 'live'));
  })
);

// ---- IP Pools Management Routes ----
const createPoolSchema = z.object({
  name: z.string().min(1).max(64),
  network: z.string().min(1),
  gateway: z.string().ip({ version: 'v4' }),
  start_ip: z.string().ip({ version: 'v4' }),
  end_ip: z.string().ip({ version: 'v4' }),
  subnet: z.string().default('255.255.0.0'),
  description: z.string().optional(),
  total_ips: z.number().int().positive().default(240),
  status: z.enum(['active', 'inactive']).default('active'),
});

const updatePoolSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  network: z.string().optional(),
  gateway: z.string().ip({ version: 'v4' }).optional(),
  start_ip: z.string().ip({ version: 'v4' }).optional(),
  end_ip: z.string().ip({ version: 'v4' }).optional(),
  subnet: z.string().optional(),
  description: z.string().optional(),
  total_ips: z.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

apiRouter.get(
  '/ip-pools',
  asyncHandler(async (_req, res) => {
    const pools = await ipPoolRepository.list();
    res.json(envelope(pools, 'live'));
  })
);

apiRouter.post(
  '/ip-pools',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = createPoolSchema.parse(req.body);
    const created = await ipPoolRepository.create(body);

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'ip_pool.create',
      entityType: 'ip_pool',
      entityId: String(created.id),
      status: 'success',
      metadata: { name: created.name, network: created.network },
    });

    res.status(201).json(envelope(created, 'live'));
  })
);

apiRouter.get(
  '/ip-pools/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const pool = await ipPoolRepository.findById(id);
    if (!pool) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }
    res.json(envelope(pool, 'live'));
  })
);

apiRouter.put(
  '/ip-pools/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const body = updatePoolSchema.parse(req.body);
    const updated = await ipPoolRepository.update(id, body);
    if (!updated) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'ip_pool.update',
      entityType: 'ip_pool',
      entityId: String(id),
      status: 'success',
      metadata: { name: updated.name },
    });

    res.json(envelope(updated, 'live'));
  })
);

apiRouter.delete(
  '/ip-pools/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const success = await ipPoolRepository.delete(id);
    if (success) {
      await auditRepository.insert({
        userId: req.user?.userId,
        username: req.user?.username,
        action: 'ip_pool.delete',
        entityType: 'ip_pool',
        entityId: String(id),
        status: 'success',
      });
    }
    res.json(envelope({ success }, 'live'));
  })
);

// ---- IP Addresses Allocation Route ----
apiRouter.get(
  '/ip-addresses',
  asyncHandler(async (req, res) => {
    const pool_id = req.query.pool_id ? Number(req.query.pool_id) : undefined;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const list = await ipPoolRepository.listAddresses({ pool_id, status, search });
    res.json(envelope(list, 'live'));
  })
);
