import { query } from '../db/pool';

export interface NotificationItem {
  id: number;
  user_id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'TICKET' | 'BILLING';
  category: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export const notificationService = {
  /** Create a notification for a specific user */
  async send(input: {
    userId: string;
    title: string;
    message: string;
    type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'TICKET' | 'BILLING';
    category?: string;
    actionUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<NotificationItem> {
    const { rows } = await query<any>(
      `INSERT INTO notifications (user_id, title, message, type, category, action_url, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, title, message, type, category, action_url, is_read, read_at, metadata, created_at`,
      [
        input.userId,
        input.title.trim(),
        input.message.trim(),
        input.type || 'INFO',
        input.category || 'SYSTEM',
        input.actionUrl?.trim() || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    const r = rows[0];
    return {
      ...r,
      read_at: r.read_at ? new Date(r.read_at).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
    };
  },

  /** Broadcast notification to target audience (e.g. all users of a role or branch) */
  async broadcast(input: {
    targetRole?: string;
    targetBranchId?: number;
    targetResellerId?: number;
    title: string;
    message: string;
    type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL' | 'TICKET' | 'BILLING';
    actionUrl?: string;
  }): Promise<number> {
    const conditions: string[] = ['u.is_active = TRUE'];
    const values: any[] = [];
    let idx = 1;

    if (input.targetRole) {
      conditions.push(`EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.name = $${idx})`);
      values.push(input.targetRole);
      idx++;
    }

    if (input.targetBranchId) {
      conditions.push(`u.branch_id = $${idx}`);
      values.push(input.targetBranchId);
      idx++;
    }

    if (input.targetResellerId) {
      conditions.push(`u.reseller_id = $${idx}`);
      values.push(input.targetResellerId);
      idx++;
    }

    const { rows } = await query<{ id: string }>(
      `SELECT u.id FROM users u WHERE ${conditions.join(' AND ')}`,
      values
    );

    for (const user of rows) {
      await this.send({
        userId: user.id,
        title: input.title,
        message: input.message,
        type: input.type,
        actionUrl: input.actionUrl,
      });
    }

    return rows.length;
  },

  /** List notifications for user */
  async listForUser(userId: string, unreadOnly = false, limit = 30): Promise<NotificationItem[]> {
    const where = unreadOnly ? 'user_id = $1 AND is_read = FALSE' : 'user_id = $1';
    const { rows } = await query<any>(
      `SELECT id, user_id, title, message, type, category, action_url, is_read, read_at, metadata, created_at
         FROM notifications
        WHERE ${where}
        ORDER BY is_read ASC, created_at DESC
        LIMIT $2`,
      [userId, limit]
    );

    return rows.map((r) => ({
      ...r,
      read_at: r.read_at ? new Date(r.read_at).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
    }));
  },

  /** Get count of unread notifications */
  async getUnreadCount(userId: string): Promise<number> {
    const { rows } = await query<{ count: string }>(
      'SELECT COUNT(*)::text as count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );
    return parseInt(rows[0]?.count || '0', 10);
  },

  /** Mark a notification as read */
  async markAsRead(id: number, userId: string): Promise<void> {
    await query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  },

  /** Mark all notifications as read for a user */
  async markAllAsRead(userId: string): Promise<void> {
    await query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );
  },
};
