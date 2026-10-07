import { Router } from 'express';
import { z } from 'zod';
import { healthService } from '../services/health.service';
import { dashboardService } from '../services/dashboard.service';
import { authService } from '../services/auth.service';
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
// 1. GET /api/health
apiRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const health = await healthService.checkAll();
    const isOk = health.status !== 'critical';
    res.status(isOk ? 200 : 503).json(envelope(health, 'live'));
  })
);

// 2. GET /api/system/health
apiRouter.get(
  '/system/health',
  asyncHandler(async (_req, res) => {
    const health = await healthService.checkAll();
    res.json(envelope(health, 'live'));
  })
);

// ---- Dashboard Routes ----
// 3. GET /api/dashboard
apiRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const range = (req.query.range as TimeRange) || '24h';
    const data = await dashboardService.getDashboardData(range);
    res.json(envelope(data, 'mixed'));
  })
);

// ---- RADIUS Specific Routes ----
// 4. GET /api/radius/status
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

// 5. GET /api/radius/statistics
apiRouter.get(
  '/radius/statistics',
  asyncHandler(async (req, res) => {
    const range = (req.query.range as TimeRange) || '24h';
    const authStats = await dashboardService.getAuthStatistics(range);
    res.json(envelope(authStats, 'mixed'));
  })
);

// 6. GET /api/radius/activity
apiRouter.get(
  '/radius/activity',
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const activity = await dashboardService.getRecentActivity(limit);
    res.json(envelope(activity, 'mixed'));
  })
);

// 7. GET /api/radius/sessions
apiRouter.get(
  '/radius/sessions',
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const sessions = await dashboardService.getOnlineUsers(limit);
    res.json(envelope(sessions, 'mixed'));
  })
);

// 8. GET /api/nas
apiRouter.get(
  '/nas',
  asyncHandler(async (_req, res) => {
    const devices = await dashboardService.getNasDevices();
    res.json(envelope(devices, 'mixed'));
  })
);

// 9. POST /api/radius/test - Interactive RADIUS authentication test tool
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
