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
import { rechargeRepository } from '../repositories/recharge.repository';
import { alertRepository } from '../repositories/alert.repository';
import { networkEventRepository } from '../repositories/network-event.repository';
import { coaService } from '../services/coa.service';
import { nocService } from '../services/noc.service';
import { searchService } from '../services/search.service';
import { reportsService } from '../services/reports.service';
import { billingRepository } from '../repositories/billing.repository';
import { organizationRepository } from '../repositories/organization.repository';
import { RadiusClient, RadiusCode } from '../radius/radius-client';
import { config } from '../config/env';
import { asyncHandler } from '../lib/async-handler';
import { envelope } from '../lib/response';
import { HttpError } from '../lib/http-error';
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
    let branch_id = req.query.branch_id ? Number(req.query.branch_id) : undefined;
    let reseller_id = req.query.reseller_id ? Number(req.query.reseller_id) : undefined;
    const ownership_type = req.query.ownership_type as string;
    const ip_pool_id = req.query.ip_pool_id ? Number(req.query.ip_pool_id) : undefined;
    const sort_by = req.query.sort_by as string;
    const sort_dir = (req.query.sort_dir as 'asc' | 'desc') || 'desc';

    // Data isolation enforcement for branch/reseller operators
    const authReq = req as AuthenticatedRequest;
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (authReq.user.userType === 'reseller' && authReq.user.resellerId) {
        reseller_id = authReq.user.resellerId;
      } else if (authReq.user.userType === 'branch' && authReq.user.branchId) {
        branch_id = authReq.user.branchId;
      }
    }

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
      branch_id,
      reseller_id,
      ownership_type,
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
  '/subscribers/by-username/:username',
  asyncHandler(async (req, res) => {
    const username = req.params.username;
    const sub = await subscriberRepository.findByUsername(username);
    if (!sub) {
      res.status(404).json(envelope(null, 'live'));
      return;
    }
    res.json(envelope(sub, 'live'));
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

// =============================================================================
// PHASE 4: ISP NETWORK CONTROL, NOC & RECHARGE OPERATIONS
// =============================================================================

// ---- 1. Multi-Duration Package Prices ----
apiRouter.get(
  '/packages/:id/prices',
  asyncHandler(async (req, res) => {
    const packageId = parseInt(req.params.id, 10);
    const prices = await rechargeRepository.getPackagePrices(packageId);
    res.json(envelope(prices, 'live'));
  })
);

const setPriceSchema = z.object({
  duration_months: z.number().int().positive(),
  price: z.number().nonnegative(),
  currency: z.string().default('NPR'),
});

apiRouter.post(
  '/packages/:id/prices',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const packageId = parseInt(req.params.id, 10);
    const body = setPriceSchema.parse(req.body);
    const saved = await rechargeRepository.setPackagePrice(
      packageId,
      body.duration_months,
      body.price,
      body.currency,
    );

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'package.set_price',
      entityType: 'package',
      entityId: String(packageId),
      status: 'success',
      metadata: body,
    });

    res.json(envelope(saved, 'live'));
  })
);

// ---- 2. Recharge Operations ----
const rechargeSchema = z.object({
  subscriber_id: z.number().int().positive(),
  package_id: z.number().int().positive(),
  duration_months: z.number().int().positive(),
  amount: z.number().nonnegative(),
  currency: z.string().default('NPR'),
  payment_method: z.string().default('Cash'),
  notes: z.string().optional(),
});

apiRouter.post(
  '/recharge',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = rechargeSchema.parse(req.body);
    const result = await rechargeRepository.processRecharge({
      ...body,
      created_by: req.user?.username || 'admin',
    });

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'subscriber.recharge',
      entityType: 'subscriber',
      entityId: String(body.subscriber_id),
      status: 'success',
      metadata: { receipt_no: result.receipt_no, amount: body.amount, duration_months: body.duration_months },
    });

    res.json(envelope(result, 'live'));
  })
);

apiRouter.get(
  '/recharge',
  asyncHandler(async (req, res) => {
    const subscriberId = req.query.subscriber_id ? Number(req.query.subscriber_id) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const list = await rechargeRepository.listTransactions({ subscriberId, limit, offset });
    res.json(envelope(list, 'live'));
  })
);

// ---- 3. Session Control & Vendor-aware CoA ----
const disconnectSessionSchema = z.object({
  username: z.string().min(1),
  sessionId: z.string().optional(),
  nasIp: z.string().optional(),
  framedIp: z.string().optional(),
});

apiRouter.post(
  '/sessions/disconnect',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = disconnectSessionSchema.parse(req.body);
    const result = await coaService.disconnectSession({
      ...body,
      operatorUsername: req.user?.username || 'admin',
    });

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'session.disconnect',
      entityType: 'session',
      entityId: body.username,
      status: result.status === 'SUCCESS' ? 'success' : 'failure',
      metadata: { status: result.status, vendor: result.vendor, details: result.details },
    });

    res.json(envelope(result, 'live'));
  })
);

const changeSpeedSchema = z.object({
  username: z.string().min(1),
  rateLimit: z.string().min(1),
  sessionId: z.string().optional(),
  nasIp: z.string().optional(),
  framedIp: z.string().optional(),
});

apiRouter.post(
  '/sessions/change-speed',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = changeSpeedSchema.parse(req.body);
    const result = await coaService.changeSessionSpeed({
      ...body,
      operatorUsername: req.user?.username || 'admin',
    });

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'session.coa_speed',
      entityType: 'session',
      entityId: body.username,
      status: result.status === 'SUCCESS' ? 'success' : 'failure',
      metadata: { status: result.status, vendor: result.vendor, details: result.details },
    });

    res.json(envelope(result, 'live'));
  })
);

// ---- 4. NOC Operational Dashboard & Monitoring ----
apiRouter.get(
  '/noc/dashboard',
  asyncHandler(async (_req, res) => {
    const data = await nocService.getMetrics();
    res.json(envelope(data, 'live'));
  })
);

const testNasDirectSchema = z.object({
  nasIp: z.string(),
  username: z.string().default('radius-test'),
  password: z.string().default('ChangeMe123!'),
  authMethod: z.enum(['PAP', 'CHAP']).default('PAP'),
});

apiRouter.post(
  '/nas-devices/test-direct',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = testNasDirectSchema.parse(req.body);
    const result = await nocService.testNasConnectivity(body);

    await auditRepository.insert({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'nas.test_probe',
      entityType: 'nas',
      entityId: body.nasIp,
      status: result.result === 'ACCEPT' ? 'success' : 'failure',
      metadata: { result: result.result, latency: result.response_time_ms },
    });

    res.json(envelope(result, 'live'));
  })
);

// ---- 5. Network Events & Alerts ----
apiRouter.get(
  '/network-events',
  asyncHandler(async (req, res) => {
    const severity = req.query.severity as string;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const list = await networkEventRepository.list({ severity, limit, offset });
    res.json(envelope(list, 'live'));
  })
);

apiRouter.get(
  '/alerts',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string;
    const severity = req.query.severity as string;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const list = await alertRepository.list({ status, severity, limit, offset });
    res.json(envelope(list, 'live'));
  })
);

apiRouter.patch(
  '/alerts/:id',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const status = req.body.status as 'acknowledged' | 'resolved';
    const updated = await alertRepository.updateStatus(id, status, req.user?.username || 'admin');
    res.json(envelope(updated, 'live'));
  })
);

// ---- 6. Global Search ----
apiRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string) || '';
    const results = await searchService.search(q);
    res.json(envelope(results, 'live'));
  })
);

// ---- 7. Reports ----
apiRouter.get(
  '/reports/summary',
  asyncHandler(async (req, res) => {
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const summary = await reportsService.getSummary(startDate, endDate);
    res.json(envelope(summary, 'live'));
  })
);

apiRouter.get(
  '/reports/export/csv',
  asyncHandler(async (req, res) => {
    const type = (req.query.type as string) || 'subscribers';
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const csvContent = await reportsService.exportReportCsv(type, startDate, endDate);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_report_${Date.now()}.csv"`);
    res.send(csvContent);
  })
);

// =============================================================================
// PHASE 5 — CORE BILLING, RECHARGE & FINANCIAL MANAGEMENT ROUTES
// =============================================================================

// ---- 1. Billing Dashboard ----
apiRouter.get(
  '/billing/dashboard',
  asyncHandler(async (_req, res) => {
    const metrics = await billingRepository.getDashboardMetrics();
    res.json(envelope(metrics, 'live'));
  })
);

// ---- 2. Billing Transactions & Invoices ----
apiRouter.get(
  '/billing/transactions',
  asyncHandler(async (req, res) => {
    const subscriberId = req.query.subscriber_id ? Number(req.query.subscriber_id) : undefined;
    const status = req.query.status as string;
    const paymentMethod = req.query.payment_method as string;
    const packageId = req.query.package_id ? Number(req.query.package_id) : undefined;
    const search = req.query.search as string;
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const result = await billingRepository.listTransactions({
      subscriberId,
      status,
      paymentMethod,
      packageId,
      search,
      dateFrom,
      dateTo,
      limit,
      offset,
    });
    res.json(envelope(result, 'live'));
  })
);

apiRouter.get(
  '/billing/transactions/:id',
  asyncHandler(async (req, res) => {
    const details = await billingRepository.getTransactionDetails(req.params.id);
    res.json(envelope(details, 'live'));
  })
);

const billingRechargeSchema = z.object({
  subscriber_id: z.number().int().positive(),
  package_id: z.number().int().positive(),
  duration_months: z.number().int().positive(),
  original_price: z.number().nonnegative().optional(),
  discount_type: z.enum(['none', 'fixed', 'percentage']).default('none'),
  discount_value: z.number().nonnegative().default(0),
  tax_rate: z.number().nonnegative().default(0),
  payment_method: z.string().default('Cash'),
  payment_reference: z.string().optional(),
  notes: z.string().optional(),
  idempotency_key: z.string().optional(),
});

apiRouter.post(
  '/billing/recharge',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = billingRechargeSchema.parse(req.body);
    const result = await billingRepository.processRecharge({
      ...body,
      created_by: req.user?.username || 'admin',
      user_role: req.user?.role || 'operator',
    });

    res.json(envelope(result, 'live'));
  })
);

const refundSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().min(1),
  refund_method: z.string().default('Cash'),
});

apiRouter.post(
  '/billing/transactions/:id/refund',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = refundSchema.parse(req.body);
    const refund = await billingRepository.processRefund({
      transaction_id: req.params.id,
      amount: body.amount,
      reason: body.reason,
      refund_method: body.refund_method,
      processed_by: req.user?.username || 'admin',
    });
    res.json(envelope(refund, 'live'));
  })
);

const cancelTxSchema = z.object({
  reason: z.string().min(1),
});

apiRouter.post(
  '/billing/transactions/:id/cancel',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = cancelTxSchema.parse(req.body);
    await billingRepository.cancelTransaction(
      req.params.id,
      body.reason,
      req.user?.username || 'admin',
    );
    res.json(envelope({ success: true, message: 'Transaction cancelled' }, 'live'));
  })
);

// ---- 3. Payment Methods ----
apiRouter.get(
  '/billing/payment-methods',
  asyncHandler(async (req, res) => {
    const activeOnly = req.query.active_only === 'true';
    const list = await billingRepository.getPaymentMethods(activeOnly);
    res.json(envelope(list, 'live'));
  })
);

apiRouter.patch(
  '/billing/payment-methods/:id/toggle',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    const isActive = req.body.is_active === true;
    const updated = await billingRepository.togglePaymentMethod(id, isActive);
    res.json(envelope(updated, 'live'));
  })
);

// ---- 4. Adjustments ----
const adjustmentSchema = z.object({
  subscriber_id: z.number().int().positive(),
  adjustment_type: z.enum(['amount', 'expiry', 'credit', 'discount']),
  amount: z.number().optional(),
  days: z.number().int().optional(),
  reason: z.string().min(1),
});

apiRouter.post(
  '/billing/adjustments',
  authMiddleware,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = adjustmentSchema.parse(req.body);
    const adj = await billingRepository.createAdjustment({
      ...body,
      operator_username: req.user?.username || 'admin',
    });
    res.json(envelope(adj, 'live'));
  })
);

// ---- 5. Expiry Management ----
apiRouter.get(
  '/billing/expiry',
  asyncHandler(async (req, res) => {
    const filter = (req.query.filter as any) || 'all';
    const packageId = req.query.package_id ? Number(req.query.package_id) : undefined;
    const search = req.query.search as string;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const list = await billingRepository.getExpiringSubscribers({
      filter,
      packageId,
      search,
      limit,
      offset,
    });
    res.json(envelope(list, 'live'));
  })
);

// ---- 6. Financial Reports & Export ----
apiRouter.get(
  '/billing/reports',
  asyncHandler(async (req, res) => {
    const reportType = (req.query.type as any) || 'daily';
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;
    const packageId = req.query.package_id ? Number(req.query.package_id) : undefined;
    const paymentMethod = req.query.payment_method as string;

    const data = await billingRepository.getFinancialReports({
      reportType,
      dateFrom,
      dateTo,
      packageId,
      paymentMethod,
    });
    res.json(envelope(data, 'live'));
  })
);

apiRouter.get(
  '/billing/reports/export',
  asyncHandler(async (req, res) => {
    const reportType = (req.query.type as any) || 'daily';
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;

    const data = await billingRepository.getFinancialReports({
      reportType,
      dateFrom,
      dateTo,
    });

    // Generate CSV string
    if (!Array.isArray(data) || data.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="billing_${reportType}_empty.csv"`);
      res.send('No records found\n');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map((h) => {
        const val = row[h] === null || row[h] === undefined ? '' : String(row[h]).replace(/"/g, '""');
        return `"${val}"`;
      });
      csvRows.push(values.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="billing_${reportType}_${Date.now()}.csv"`);
    res.send(csvRows.join('\n'));
  })
);

// ---- 7. Invoices ----
apiRouter.get(
  '/billing/invoices',
  asyncHandler(async (req, res) => {
    const subscriberId = req.query.subscriber_id ? Number(req.query.subscriber_id) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const result = await billingRepository.listInvoices(subscriberId, limit, offset);
    res.json(envelope(result, 'live'));
  })
);

apiRouter.get(
  '/billing/invoices/:no',
  asyncHandler(async (req, res) => {
    const invoice = await billingRepository.getInvoiceByNo(req.params.no);
    res.json(envelope(invoice, 'live'));
  })
);

// ---- 8. Package Price History ----
apiRouter.get(
  '/packages/:id/price-history',
  asyncHandler(async (req, res) => {
    const packageId = parseInt(req.params.id, 10);
    const history = await billingRepository.getPackagePriceHistory(packageId);
    res.json(envelope(history, 'live'));
  })
);

// ---- 9. Global Billing Search ----
apiRouter.get(
  '/billing/search',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string) || '';
    const results = await billingRepository.searchBilling(q);
    res.json(envelope(results, 'live'));
  })
);

// =============================================================================
// PHASE 6: ORGANIZATION, BRANCH, RESELLER, WALLET, CREDIT & COMMISSION
// =============================================================================

// ---- 1. Organization ----
apiRouter.get(
  '/organization',
  asyncHandler(async (_req, res) => {
    const org = await organizationRepository.getPrimaryOrganization();
    res.json(envelope(org, 'live'));
  })
);

apiRouter.put(
  '/organization',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'super_admin' && !authReq.user?.permissions.includes('organization.edit')) {
      throw HttpError.forbidden('Only Super Admin or Organization Admin can modify organization profile');
    }
    const org = await organizationRepository.getPrimaryOrganization();
    const updated = await organizationRepository.updateOrganization(org.id, req.body);
    res.json(envelope(updated, 'live'));
  })
);

apiRouter.get(
  '/organization/dashboard',
  asyncHandler(async (_req, res) => {
    const metrics = await organizationRepository.getOrganizationDashboardMetrics();
    res.json(envelope(metrics, 'live'));
  })
);

// ---- 2. Branches ----
apiRouter.get(
  '/branches',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    let branches = await organizationRepository.listBranches();
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (authReq.user.userType === 'branch' && authReq.user.branchId) {
        branches = branches.filter((b) => b.id === authReq.user!.branchId);
      }
    }
    res.json(envelope(branches, 'live'));
  })
);

apiRouter.post(
  '/branches',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'super_admin' && !authReq.user?.permissions.includes('branch.create')) {
      throw HttpError.forbidden('Unauthorized to create branches');
    }
    const branch = await organizationRepository.createBranch(req.body);
    res.status(201).json(envelope(branch, 'live'));
  })
);

apiRouter.get(
  '/branches/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const authReq = req as AuthenticatedRequest;
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (authReq.user.userType === 'branch' && authReq.user.branchId !== id) {
        throw HttpError.forbidden('Access denied to other branch details');
      }
    }
    const branch = await organizationRepository.getBranch(id);
    if (!branch) throw HttpError.notFound('Branch not found');
    res.json(envelope(branch, 'live'));
  })
);

apiRouter.put(
  '/branches/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'super_admin' && !authReq.user?.permissions.includes('branch.edit')) {
      throw HttpError.forbidden('Unauthorized to edit branch');
    }
    const updated = await organizationRepository.updateBranch(id, req.body);
    res.json(envelope(updated, 'live'));
  })
);

apiRouter.get(
  '/branches/:id/dashboard',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const authReq = req as AuthenticatedRequest;
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (authReq.user.userType === 'branch' && authReq.user.branchId !== id) {
        throw HttpError.forbidden('Access denied to other branch dashboard');
      }
    }
    const metrics = await organizationRepository.getBranchDashboardMetrics(id);
    res.json(envelope(metrics, 'live'));
  })
);

// ---- 3. Resellers ----
apiRouter.get(
  '/resellers',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : undefined;
    let resellers = await organizationRepository.listResellers(branchId);
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (authReq.user.userType === 'reseller' && authReq.user.resellerId) {
        resellers = resellers.filter((r) => r.id === authReq.user!.resellerId);
      } else if (authReq.user.userType === 'branch' && authReq.user.branchId) {
        resellers = resellers.filter((r) => r.branch_id === authReq.user!.branchId);
      }
    }
    res.json(envelope(resellers, 'live'));
  })
);

apiRouter.post(
  '/resellers',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'super_admin' && !authReq.user?.permissions.includes('reseller.create')) {
      throw HttpError.forbidden('Unauthorized to create resellers');
    }
    const reseller = await organizationRepository.createReseller(req.body);
    res.status(201).json(envelope(reseller, 'live'));
  })
);

apiRouter.get(
  '/resellers/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const authReq = req as AuthenticatedRequest;
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (authReq.user.userType === 'reseller' && authReq.user.resellerId !== id) {
        throw HttpError.forbidden('Access denied to other reseller data');
      }
    }
    const reseller = await organizationRepository.getReseller(id);
    if (!reseller) throw HttpError.notFound('Reseller not found');
    res.json(envelope(reseller, 'live'));
  })
);

apiRouter.put(
  '/resellers/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'super_admin' && !authReq.user?.permissions.includes('reseller.edit')) {
      throw HttpError.forbidden('Unauthorized to edit reseller');
    }
    const updated = await organizationRepository.updateReseller(id, req.body);
    res.json(envelope(updated, 'live'));
  })
);

apiRouter.get(
  '/resellers/:id/dashboard',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const authReq = req as AuthenticatedRequest;
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (authReq.user.userType === 'reseller' && authReq.user.resellerId !== id) {
        throw HttpError.forbidden('Access denied to other reseller dashboard');
      }
    }
    const metrics = await organizationRepository.getResellerDashboardMetrics(id);
    res.json(envelope(metrics, 'live'));
  })
);

// ---- 4. Subscriber Ownership & History ----
apiRouter.post(
  '/subscribers/:id/transfer-ownership',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const authReq = req as AuthenticatedRequest;
    const operator = authReq.user?.username || 'admin';

    const schema = z.object({
      ownership_type: z.enum(['head_office', 'branch', 'reseller']),
      branch_id: z.number().nullable().optional(),
      reseller_id: z.number().nullable().optional(),
      reason: z.string().min(1, 'Transfer reason is mandatory'),
    });
    const parsed = schema.parse(req.body);

    await organizationRepository.transferSubscriberOwnership(id, {
      ...parsed,
      changed_by: operator,
    });

    res.json(envelope({ success: true, message: 'Ownership transferred successfully' }, 'live'));
  })
);

apiRouter.get(
  '/subscribers/:id/ownership-history',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const history = await organizationRepository.getSubscriberOwnershipHistory(id);
    res.json(envelope(history, 'live'));
  })
);

// ---- 5. Wallets & Credit System ----
apiRouter.get(
  '/wallets/dashboard',
  asyncHandler(async (_req, res) => {
    const metrics = await organizationRepository.getWalletDashboardMetrics();
    res.json(envelope(metrics, 'live'));
  })
);

apiRouter.get(
  '/wallets',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const entityType = req.query.entity_type as 'branch' | 'reseller' | undefined;
    const status = req.query.status as string | undefined;

    let wallets = await organizationRepository.listWallets({ entityType, status });
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (authReq.user.userType === 'reseller' && authReq.user.resellerId) {
        wallets = wallets.filter((w) => w.reseller_id === authReq.user!.resellerId);
      } else if (authReq.user.userType === 'branch' && authReq.user.branchId) {
        wallets = wallets.filter((w) => w.branch_id === authReq.user!.branchId);
      }
    }
    res.json(envelope(wallets, 'live'));
  })
);

apiRouter.get(
  '/wallets/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const wallet = await organizationRepository.getWallet(id);
    if (!wallet) throw HttpError.notFound('Wallet not found');

    const authReq = req as AuthenticatedRequest;
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (authReq.user.userType === 'reseller' && wallet.reseller_id !== authReq.user.resellerId) {
        throw HttpError.forbidden('Access denied to other wallet');
      } else if (authReq.user.userType === 'branch' && wallet.branch_id !== authReq.user.branchId) {
        throw HttpError.forbidden('Access denied to other wallet');
      }
    }
    res.json(envelope(wallet, 'live'));
  })
);

// CRITICAL: Top-up Wallet (Super Admin Only)
apiRouter.post(
  '/wallets/:id/topup',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'super_admin' && !authReq.user?.permissions.includes('wallet.topup')) {
      throw HttpError.forbidden('Security Restriction: Only Super Admin can perform wallet top-ups');
    }

    const walletId = Number(req.params.id);
    const schema = z.object({
      amount: z.number().positive('Top-up amount must be positive'),
      paymentMethod: z.string().min(1),
      paymentReference: z.string().optional(),
      remarks: z.string().optional(),
      idempotencyKey: z.string().optional(),
    });
    const parsed = schema.parse(req.body);

    const tx = await organizationRepository.topUpWallet({
      walletId,
      ...parsed,
      operator: authReq.user?.username || 'admin',
    });
    res.status(201).json(envelope(tx, 'live'));
  })
);

// Manual Adjustment (Super Admin Only)
apiRouter.post(
  '/wallets/:id/adjust',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'super_admin' && !authReq.user?.permissions.includes('wallet.adjust')) {
      throw HttpError.forbidden('Security Restriction: Only Super Admin can adjust wallet balances');
    }

    const walletId = Number(req.params.id);
    const schema = z.object({
      amount: z.number().positive(),
      direction: z.enum(['credit', 'debit']),
      reason: z.string().min(1, 'Reason is required for audit reconciliation'),
    });
    const parsed = schema.parse(req.body);

    const tx = await organizationRepository.adjustWalletBalance({
      walletId,
      ...parsed,
      operator: authReq.user?.username || 'admin',
    });
    res.json(envelope(tx, 'live'));
  })
);

// Configure Credit Limit (Super Admin Only)
apiRouter.put(
  '/wallets/:id/credit',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'super_admin' && !authReq.user?.permissions.includes('credit.edit')) {
      throw HttpError.forbidden('Security Restriction: Only Super Admin can configure credit accounts');
    }

    const walletId = Number(req.params.id);
    const schema = z.object({
      creditEnabled: z.boolean(),
      creditLimit: z.number().min(0),
      startDate: z.string().nullable().optional(),
      expiryDate: z.string().nullable().optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED']),
      notes: z.string().optional(),
    });
    const parsed = schema.parse(req.body);

    const account = await organizationRepository.updateCreditAccount({
      walletId,
      ...parsed,
      operator: authReq.user?.username || 'admin',
    });
    res.json(envelope(account, 'live'));
  })
);

// Wallet Ledger / Transactions
apiRouter.get(
  '/wallets/:id/ledger',
  asyncHandler(async (req, res) => {
    const walletId = Number(req.params.id);
    const type = req.query.type as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const result = await organizationRepository.listWalletTransactions({
      walletId,
      type,
      limit,
      offset,
    });
    res.json(envelope(result.transactions, 'live', { total: result.total, limit, offset }));
  })
);

apiRouter.get(
  '/wallets/ledger/all',
  asyncHandler(async (req, res) => {
    const type = req.query.type as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const result = await organizationRepository.listWalletTransactions({
      type,
      limit,
      offset,
    });
    res.json(envelope(result.transactions, 'live', { total: result.total, limit, offset }));
  })
);

// ---- 6. Channel Pricing Rules ----
apiRouter.get(
  '/pricing-rules',
  asyncHandler(async (req, res) => {
    const channelType = req.query.channel_type as 'branch' | 'reseller' | undefined;
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : undefined;
    const resellerId = req.query.reseller_id ? Number(req.query.reseller_id) : undefined;
    const packageId = req.query.package_id ? Number(req.query.package_id) : undefined;

    const rules = await organizationRepository.listPricingRules({
      channelType,
      branchId,
      resellerId,
      packageId,
    });
    res.json(envelope(rules, 'live'));
  })
);

apiRouter.post(
  '/pricing-rules',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'super_admin' && !authReq.user?.permissions.includes('pricing.edit')) {
      throw HttpError.forbidden('Unauthorized to create pricing rules');
    }

    const schema = z.object({
      rule_name: z.string().min(1),
      channel_type: z.enum(['branch', 'reseller']),
      branch_id: z.number().nullable().optional(),
      reseller_id: z.number().nullable().optional(),
      package_id: z.number().nullable().optional(),
      duration_months: z.number().nullable().optional(),
      rule_type: z.enum(['percentage_discount', 'percentage_commission', 'fixed_discount', 'fixed_override']),
      value: z.number().min(0),
      notes: z.string().optional(),
    });
    const parsed = schema.parse(req.body);

    const rule = await organizationRepository.createPricingRule({
      ...parsed,
      created_by: authReq.user?.username || 'admin',
    });
    res.status(201).json(envelope(rule, 'live'));
  })
);

apiRouter.delete(
  '/pricing-rules/:id',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== 'super_admin' && !authReq.user?.permissions.includes('pricing.edit')) {
      throw HttpError.forbidden('Unauthorized to delete pricing rules');
    }
    await organizationRepository.deletePricingRule(Number(req.params.id));
    res.json(envelope({ success: true }, 'live'));
  })
);

apiRouter.post(
  '/pricing/calculate',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      packageId: z.number(),
      durationMonths: z.number(),
      channelType: z.enum(['branch', 'reseller']),
      entityId: z.number(),
    });
    const parsed = schema.parse(req.body);
    const result = await organizationRepository.resolveChannelPrice(parsed);
    res.json(envelope(result, 'live'));
  })
);

// ---- 7. Channel Recharge Execution ----
apiRouter.post(
  '/channel/recharge',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const operator = authReq.user?.username || 'admin';

    const schema = z.object({
      subscriberId: z.number(),
      packageId: z.number(),
      durationMonths: z.number().positive(),
      channelType: z.enum(['branch', 'reseller']),
      channelEntityId: z.number(),
      paymentReference: z.string().optional(),
      idempotencyKey: z.string().optional(),
      notes: z.string().optional(),
    });
    const parsed = schema.parse(req.body);

    // Verify channel caller authority
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (parsed.channelType === 'reseller' && authReq.user.userType === 'reseller' && authReq.user.resellerId !== parsed.channelEntityId) {
        throw HttpError.forbidden('Unauthorized to debit another reseller wallet');
      }
      if (parsed.channelType === 'branch' && authReq.user.userType === 'branch' && authReq.user.branchId !== parsed.channelEntityId) {
        throw HttpError.forbidden('Unauthorized to debit another branch wallet');
      }
    }

    const receipt = await organizationRepository.executeChannelRecharge({
      ...parsed,
      operator,
    });
    res.status(201).json(envelope(receipt, 'live'));
  })
);

// ---- 8. Reseller Commission & Reports ----
apiRouter.get(
  '/reports/commission',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    let resellerId = req.query.reseller_id ? Number(req.query.reseller_id) : undefined;
    if (authReq.user && authReq.user.role !== 'super_admin' && authReq.user.role !== 'organization_admin') {
      if (authReq.user.userType === 'reseller' && authReq.user.resellerId) {
        resellerId = authReq.user.resellerId;
      }
    }

    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const report = await organizationRepository.getCommissionReport({
      resellerId,
      startDate,
      endDate,
      limit,
      offset,
    });
    res.json(envelope(report, 'live'));
  })
);

apiRouter.get(
  '/reports/commission/export',
  asyncHandler(async (req, res) => {
    const resellerId = req.query.reseller_id ? Number(req.query.reseller_id) : undefined;
    const startDate = req.query.start_date as string | undefined;
    const endDate = req.query.end_date as string | undefined;

    const report = await organizationRepository.getCommissionReport({
      resellerId,
      startDate,
      endDate,
      limit: 5000,
      offset: 0,
    });

    const headers = ['Transaction ID', 'Receipt No', 'Reseller', 'Subscriber', 'Customer ID', 'Package', 'Duration', 'Gross Price', 'Discount', 'Commission', 'Net Amount', 'Date', 'Status'];
    const csvRows = [headers.join(',')];

    for (const item of report.items) {
      const row = [
        item.transaction_id,
        item.receipt_no,
        `"${item.reseller_name || ''}"`,
        item.username,
        item.customer_id,
        `"${item.package_name || ''}"`,
        `${item.duration} mo`,
        item.original_price,
        item.discount_amount,
        item.commission_amount,
        item.final_amount,
        new Date(item.recharge_date).toISOString().slice(0, 10),
        item.status,
      ];
      csvRows.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reseller_commission_${Date.now()}.csv"`);
    res.send(csvRows.join('\n'));
  })
);

apiRouter.get(
  '/reports/wallet/export',
  asyncHandler(async (req, res) => {
    const walletId = req.query.wallet_id ? Number(req.query.wallet_id) : undefined;
    const result = await organizationRepository.listWalletTransactions({
      walletId,
      limit: 5000,
      offset: 0,
    });

    const headers = ['Date', 'Transaction ID', 'Wallet', 'Entity', 'Type', 'Amount', 'Balance Before', 'Balance After', 'Credit Used', 'Reference', 'Payment Method', 'Reason', 'Operator'];
    const csvRows = [headers.join(',')];

    for (const tx of result.transactions) {
      const row = [
        new Date(tx.created_at).toISOString().slice(0, 19).replace('T', ' '),
        tx.transaction_id,
        tx.wallet_number || '',
        `"${tx.entity_name || ''}"`,
        tx.type,
        tx.amount,
        tx.balance_before,
        tx.balance_after,
        tx.credit_used_after,
        `"${tx.reference || ''}"`,
        tx.payment_method || '',
        `"${(tx.reason || '').replace(/"/g, '""')}"`,
        tx.created_by,
      ];
      csvRows.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="wallet_ledger_${Date.now()}.csv"`);
    res.send(csvRows.join('\n'));
  })
);


