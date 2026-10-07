import { query } from '../db/pool';
import { logger } from '../lib/logger';
import { subscriberRepository } from '../repositories/subscriber.repository';

class AutoExpiryService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private intervalMs = 60_000; // 60 seconds

  start() {
    const isEnabled = process.env.AUTO_EXPIRY_ENABLED !== 'false';
    if (!isEnabled) {
      logger.info('AutoExpiryService disabled via AUTO_EXPIRY_ENABLED=false');
      return;
    }

    logger.info('AutoExpiryService started (polling every 60s for expired services)');
    // Initial check after 5s startup delay
    setTimeout(() => this.processExpiredServices(), 5000);
    this.timer = setInterval(() => this.processExpiredServices(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('AutoExpiryService stopped');
  }

  async processExpiredServices() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Find active subscribers whose expiry_date has passed
      const { rows } = await query<{ id: number; username: string; customer_id: string }>(
        `SELECT id, username, customer_id
           FROM subscribers
          WHERE status IN ('active', 'enabled')
            AND expiry_date IS NOT NULL
            AND expiry_date < NOW()`,
      );

      if (rows.length === 0) {
        this.isRunning = false;
        return;
      }

      logger.info({ count: rows.length }, 'Processing expired subscriber services');

      for (const sub of rows) {
        try {
          // 1. Update subscriber status
          await query(`UPDATE subscribers SET status = 'expired', updated_at = NOW() WHERE id = $1`, [sub.id]);

          // 2. Update active service status
          await query(
            `UPDATE subscriber_services
                SET status = 'expired', updated_at = NOW()
              WHERE subscriber_id = $1 AND status = 'active'`,
            [sub.id],
          );

          // 3. Update FreeRADIUS auth reject
          await subscriberRepository.syncToRadius(sub.id);

          // 4. Log activity
          await subscriberRepository.logActivity(
            sub.id,
            'service_expired',
            'Service validity expired automatically by Expiry Engine',
            'auto_expiry_engine',
          );

          logger.info({ subscriber: sub.username, id: sub.id }, 'Subscriber marked as expired');
        } catch (err: any) {
          logger.error({ err: err.message, subscriber: sub.username }, 'Failed to mark subscriber expired');
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Error in AutoExpiryService execution');
    } finally {
      this.isRunning = false;
    }
  }
}

export const autoExpiryService = new AutoExpiryService();
