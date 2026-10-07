import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { config, corsOrigins } from './config/env';
import { logger } from './lib/logger';
import { waitForDatabase } from './db/pool';
import { runMigrations } from './db/migrate';
import { authService } from './services/auth.service';
import { apiRouter } from './routes/api.routes';
import { errorHandler } from './middleware/error.middleware';

async function bootstrap() {
  logger.info('Starting RADIUS PRO Backend Server...');

  // 1. Wait for database and execute migrations
  await waitForDatabase();
  await runMigrations();

  // 2. Ensure initial administrator account
  await authService.ensureInitialAdmin();

  const app = express();

  // Basic security and parsing
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
          callback(null, true);
        } else {
          callback(null, true); // Allow dev frontend requests seamlessly
        }
      },
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // HTTP Logging
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/health' || req.url === '/api/system/health',
      },
    })
  );

  // Rate Limiting
  const generalLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down' } },
  });
  app.use('/api', generalLimiter);

  // Mount API router
  app.use('/api', apiRouter);

  // Error handling middleware
  app.use(errorHandler);

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, `RADIUS PRO Backend listening on http://0.0.0.0:${config.PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully...');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during application startup');
  process.exit(1);
});
