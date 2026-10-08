import { query } from '../db/pool';
import { HttpError } from '../lib/http-error';
import { auditRepository } from './audit.repository';

export interface CrmNoteItem {
  id: number;
  subscriber_id: number;
  author_id: string | null;
  author_name: string;
  note: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerActivityItem {
  id: number;
  subscriber_id: number;
  actor_id: string | null;
  actor_name: string;
  action_type: string;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CustomerCommunicationItem {
  id: number;
  subscriber_id: number;
  channel: 'IN_APP' | 'SMS' | 'EMAIL' | 'WHATSAPP' | 'CALL';
  recipient: string;
  subject: string | null;
  message: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'DELIVERED';
  sent_by: string | null;
  created_at: string;
}

export const crmRepository = {
  /** List CRM notes for a subscriber */
  async listNotes(subscriberId: number): Promise<CrmNoteItem[]> {
    const { rows } = await query<any>(
      `SELECT id, subscriber_id, author_id, author_name, note, is_pinned, created_at, updated_at
         FROM crm_notes
        WHERE subscriber_id = $1
        ORDER BY is_pinned DESC, created_at DESC`,
      [subscriberId]
    );
    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  },

  /** Add a CRM note */
  async addNote(input: {
    subscriberId: number;
    authorId?: string;
    authorName: string;
    note: string;
    isPinned?: boolean;
  }): Promise<CrmNoteItem> {
    if (!input.note || !input.note.trim()) {
      throw HttpError.badRequest('Note content cannot be empty');
    }

    const { rows } = await query<any>(
      `INSERT INTO crm_notes (subscriber_id, author_id, author_name, note, is_pinned)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, subscriber_id, author_id, author_name, note, is_pinned, created_at, updated_at`,
      [input.subscriberId, input.authorId || null, input.authorName, input.note.trim(), !!input.isPinned]
    );

    // Also record in customer activity timeline
    await this.logActivity({
      subscriberId: input.subscriberId,
      actorId: input.authorId,
      actorName: input.authorName,
      actionType: 'NOTE_ADDED',
      description: `Staff note recorded: "${input.note.trim().substring(0, 80)}${input.note.length > 80 ? '...' : ''}"`,
    });

    const r = rows[0];
    return {
      ...r,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    };
  },

  /** Delete a CRM note */
  async deleteNote(noteId: number, actorId?: string): Promise<void> {
    const noteRes = await query<{ subscriber_id: number }>('SELECT subscriber_id FROM crm_notes WHERE id = $1', [noteId]);
    if (!noteRes.rows[0]) throw HttpError.notFound('Note not found');

    await query('DELETE FROM crm_notes WHERE id = $1', [noteId]);

    await auditRepository.insert({
      userId: actorId,
      action: 'crm.note_deleted',
      entityType: 'crm_note',
      entityId: String(noteId),
      status: 'success',
    });
  },

  /** Toggle pin status of note */
  async togglePinNote(noteId: number, actorId?: string): Promise<boolean> {
    const { rows } = await query<{ is_pinned: boolean }>(
      `UPDATE crm_notes
          SET is_pinned = NOT is_pinned,
              updated_at = NOW()
        WHERE id = $1
        RETURNING is_pinned`,
      [noteId]
    );
    if (!rows[0]) throw HttpError.notFound('Note not found');

    await auditRepository.insert({
      userId: actorId,
      action: rows[0].is_pinned ? 'crm.note_pinned' : 'crm.note_unpinned',
      entityType: 'crm_note',
      entityId: String(noteId),
      status: 'success',
    });

    return rows[0].is_pinned;
  },

  /** List customer activity timeline */
  async listActivities(subscriberId: number, limit = 50): Promise<CustomerActivityItem[]> {
    const { rows } = await query<any>(
      `SELECT id, subscriber_id, actor_id, actor_name, action_type, description, metadata, created_at
         FROM customer_activities
        WHERE subscriber_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [subscriberId, limit]
    );
    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toISOString(),
    }));
  },

  /** Log customer activity */
  async logActivity(input: {
    subscriberId: number;
    actorId?: string;
    actorName: string;
    actionType: string;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await query(
      `INSERT INTO customer_activities (subscriber_id, actor_id, actor_name, action_type, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.subscriberId,
        input.actorId || null,
        input.actorName,
        input.actionType,
        input.description,
        JSON.stringify(input.metadata || {}),
      ]
    );
  },

  /** List customer communications */
  async listCommunications(subscriberId: number, limit = 50): Promise<CustomerCommunicationItem[]> {
    const { rows } = await query<any>(
      `SELECT id, subscriber_id, channel, recipient, subject, message, status, sent_by, created_at
         FROM customer_communications
        WHERE subscriber_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [subscriberId, limit]
    );
    return rows.map((r) => ({
      ...r,
      created_at: new Date(r.created_at).toISOString(),
    }));
  },

  /** Log customer communication */
  async logCommunication(input: {
    subscriberId: number;
    channel: 'IN_APP' | 'SMS' | 'EMAIL' | 'WHATSAPP' | 'CALL';
    recipient: string;
    subject?: string;
    message: string;
    status?: 'QUEUED' | 'SENT' | 'FAILED' | 'DELIVERED';
    sentBy?: string;
  }): Promise<CustomerCommunicationItem> {
    const { rows } = await query<any>(
      `INSERT INTO customer_communications (subscriber_id, channel, recipient, subject, message, status, sent_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, subscriber_id, channel, recipient, subject, message, status, sent_by, created_at`,
      [
        input.subscriberId,
        input.channel,
        input.recipient.trim(),
        input.subject?.trim() || null,
        input.message.trim(),
        input.status || 'SENT',
        input.sentBy || null,
      ]
    );

    await this.logActivity({
      subscriberId: input.subscriberId,
      actorId: input.sentBy,
      actorName: 'Communication Gateway',
      actionType: 'COMMUNICATION_SENT',
      description: `Sent ${input.channel} notice to ${input.recipient}: "${input.subject || input.message.substring(0, 50)}"`,
    });

    const r = rows[0];
    return {
      ...r,
      created_at: new Date(r.created_at).toISOString(),
    };
  },

  /** Get CRM metrics summary for a subscriber */
  async getSubscriberCrmSummary(subscriberId: number): Promise<{
    openTicketsCount: number;
    pinnedNotesCount: number;
    totalNotesCount: number;
    lastActivity: string | null;
  }> {
    const ticketRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM tickets WHERE subscriber_id = $1 AND status NOT IN ('RESOLVED', 'CLOSED')`,
      [subscriberId]
    );
    const pinnedRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM crm_notes WHERE subscriber_id = $1 AND is_pinned = TRUE`,
      [subscriberId]
    );
    const totalNotesRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM crm_notes WHERE subscriber_id = $1`,
      [subscriberId]
    );
    const lastActRes = await query<{ created_at: Date }>(
      `SELECT created_at FROM customer_activities WHERE subscriber_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [subscriberId]
    );

    return {
      openTicketsCount: parseInt(ticketRes.rows[0]?.count || '0', 10),
      pinnedNotesCount: parseInt(pinnedRes.rows[0]?.count || '0', 10),
      totalNotesCount: parseInt(totalNotesRes.rows[0]?.count || '0', 10),
      lastActivity: lastActRes.rows[0]?.created_at ? new Date(lastActRes.rows[0].created_at).toISOString() : null,
    };
  },
};
