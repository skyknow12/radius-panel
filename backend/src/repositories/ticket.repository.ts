import { query, getClient } from '../db/pool';
import { HttpError } from '../lib/http-error';
import { auditRepository } from './audit.repository';
import { crmRepository } from './crm.repository';

export interface TicketItem {
  id: number;
  ticket_number: string;
  subscriber_id: number;
  username: string;
  customer_name?: string;
  customer_phone?: string;
  organization_id: number | null;
  branch_id: number | null;
  reseller_id: number | null;
  branch_name?: string | null;
  reseller_name?: string | null;
  category: string;
  subcategory: string | null;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'WAITING_INTERNAL' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
  assigned_user_id: string | null;
  assigned_user_name?: string | null;
  created_by_id: string | null;
  created_by_name: string;
  sla_deadline: string | null;
  sla_breached: boolean;
  sla_remaining_minutes?: number | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  resolution: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  escalation_count: number;
  created_at: string;
  updated_at: string;
}

export interface TicketCommentItem {
  id: number;
  ticket_id: number;
  author_id: string | null;
  author_name: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketAttachmentItem {
  id: number;
  ticket_id: number;
  filename: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface TicketStatusHistoryItem {
  id: number;
  ticket_id: number;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  changed_by_name: string;
  reason: string | null;
  created_at: string;
}

export interface TicketEscalationItem {
  id: number;
  ticket_id: number;
  escalated_by: string | null;
  from_priority: string;
  to_priority: string;
  reason: string;
  created_at: string;
}

export interface TicketMetrics {
  openTickets: number;
  inProgressTickets: number;
  criticalTickets: number;
  slaNearBreach: number;
  slaBreached: number;
  resolvedToday: number;
  totalTickets: number;
}

export interface TicketCategoryItem {
  id: number;
  name: string;
  description: string | null;
  default_priority: string;
  default_sla_hours: number;
  is_active: boolean;
}

export interface SlaRuleItem {
  id: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  response_time_hours: number;
  resolution_time_hours: number;
  is_active: boolean;
  updated_at: string;
}

export const ticketRepository = {
  /** List tickets with comprehensive filtering, SLA tracking, and pagination */
  async listTickets(params: {
    search?: string;
    status?: string;
    priority?: string;
    category?: string;
    branch_id?: number;
    reseller_id?: number;
    assigned_user_id?: string;
    subscriber_id?: number;
    sla_breached?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ tickets: TicketItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    if (params.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      conditions.push(`(t.ticket_number ILIKE $${idx} OR t.subject ILIKE $${idx} OR t.username ILIKE $${idx} OR s.full_name ILIKE $${idx} OR s.phone ILIKE $${idx})`);
      values.push(q);
      idx++;
    }

    if (params.status && params.status !== 'all') {
      conditions.push(`t.status = $${idx}`);
      values.push(params.status.toUpperCase());
      idx++;
    }

    if (params.priority && params.priority !== 'all') {
      conditions.push(`t.priority = $${idx}`);
      values.push(params.priority.toUpperCase());
      idx++;
    }

    if (params.category && params.category !== 'all') {
      conditions.push(`t.category = $${idx}`);
      values.push(params.category);
      idx++;
    }

    if (params.branch_id) {
      conditions.push(`t.branch_id = $${idx}`);
      values.push(params.branch_id);
      idx++;
    }

    if (params.reseller_id) {
      conditions.push(`t.reseller_id = $${idx}`);
      values.push(params.reseller_id);
      idx++;
    }

    if (params.assigned_user_id) {
      conditions.push(`t.assigned_user_id = $${idx}`);
      values.push(params.assigned_user_id);
      idx++;
    }

    if (params.subscriber_id) {
      conditions.push(`t.subscriber_id = $${idx}`);
      values.push(params.subscriber_id);
      idx++;
    }

    if (params.sla_breached !== undefined) {
      if (params.sla_breached) {
        conditions.push(`t.sla_deadline IS NOT NULL AND t.sla_deadline < NOW() AND t.status NOT IN ('RESOLVED', 'CLOSED')`);
      } else {
        conditions.push(`(t.sla_deadline IS NULL OR t.sla_deadline >= NOW() OR t.status IN ('RESOLVED', 'CLOSED'))`);
      }
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count
         FROM tickets t
    LEFT JOIN subscribers s ON s.id = t.subscriber_id
        WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const dataQuery = `
      SELECT t.id, t.ticket_number, t.subscriber_id, t.username,
             s.full_name AS customer_name, s.phone AS customer_phone,
             t.organization_id, t.branch_id, t.reseller_id,
             b.name AS branch_name, res.business_name AS reseller_name,
             t.category, t.subcategory, t.subject, t.description,
             t.priority, t.status,
             t.assigned_user_id, u.full_name AS assigned_user_name,
             t.created_by_id, t.created_by_name,
             t.sla_deadline,
             t.first_response_at, t.resolved_at, t.closed_at,
             t.resolution, t.internal_notes, t.customer_notes,
             t.escalation_count, t.created_at, t.updated_at,
             CASE
               WHEN t.status IN ('RESOLVED', 'CLOSED') THEN FALSE
               WHEN t.sla_deadline IS NOT NULL AND t.sla_deadline < NOW() THEN TRUE
               ELSE FALSE
             END AS sla_breached,
             CASE
               WHEN t.sla_deadline IS NOT NULL
               THEN EXTRACT(EPOCH FROM (t.sla_deadline - NOW())) / 60
               ELSE NULL
             END AS sla_remaining_minutes
        FROM tickets t
   LEFT JOIN subscribers s ON s.id = t.subscriber_id
   LEFT JOIN branches b ON b.id = t.branch_id
   LEFT JOIN resellers res ON res.id = t.reseller_id
   LEFT JOIN users u ON u.id = t.assigned_user_id
       WHERE ${whereClause}
    ORDER BY
       CASE WHEN t.status IN ('RESOLVED', 'CLOSED') THEN 1 ELSE 0 END ASC,
       t.sla_deadline ASC NULLS LAST,
       t.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}
    `;

    values.push(limit, offset);
    const { rows } = await query<any>(dataQuery, values);

    const tickets: TicketItem[] = rows.map((r) => ({
      ...r,
      sla_breached: !!r.sla_breached,
      sla_remaining_minutes: r.sla_remaining_minutes !== null ? Math.round(Number(r.sla_remaining_minutes)) : null,
      sla_deadline: r.sla_deadline ? new Date(r.sla_deadline).toISOString() : null,
      first_response_at: r.first_response_at ? new Date(r.first_response_at).toISOString() : null,
      resolved_at: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
      closed_at: r.closed_at ? new Date(r.closed_at).toISOString() : null,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString(),
    }));

    return {
      tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  /** Get complete ticket details with comments, attachments, history, and escalations */
  async getTicketById(id: number): Promise<TicketItem & {
    comments: TicketCommentItem[];
    attachments: TicketAttachmentItem[];
    statusHistory: TicketStatusHistoryItem[];
    escalations: TicketEscalationItem[];
  }> {
    const dataQuery = `
      SELECT t.id, t.ticket_number, t.subscriber_id, t.username,
             s.full_name AS customer_name, s.phone AS customer_phone,
             t.organization_id, t.branch_id, t.reseller_id,
             b.name AS branch_name, res.business_name AS reseller_name,
             t.category, t.subcategory, t.subject, t.description,
             t.priority, t.status,
             t.assigned_user_id, u.full_name AS assigned_user_name,
             t.created_by_id, t.created_by_name,
             t.sla_deadline,
             t.first_response_at, t.resolved_at, t.closed_at,
             t.resolution, t.internal_notes, t.customer_notes,
             t.escalation_count, t.created_at, t.updated_at,
             CASE
               WHEN t.status IN ('RESOLVED', 'CLOSED') THEN FALSE
               WHEN t.sla_deadline IS NOT NULL AND t.sla_deadline < NOW() THEN TRUE
               ELSE FALSE
             END AS sla_breached,
             CASE
               WHEN t.sla_deadline IS NOT NULL
               THEN EXTRACT(EPOCH FROM (t.sla_deadline - NOW())) / 60
               ELSE NULL
             END AS sla_remaining_minutes
        FROM tickets t
   LEFT JOIN subscribers s ON s.id = t.subscriber_id
   LEFT JOIN branches b ON b.id = t.branch_id
   LEFT JOIN resellers res ON res.id = t.reseller_id
   LEFT JOIN users u ON u.id = t.assigned_user_id
       WHERE t.id = $1
    `;

    const { rows } = await query<any>(dataQuery, [id]);
    if (!rows[0]) throw HttpError.notFound('Ticket not found');
    const t = rows[0];

    const [comRes, attRes, histRes, escRes] = await Promise.all([
      query<any>('SELECT * FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC', [id]),
      query<any>('SELECT * FROM ticket_attachments WHERE ticket_id = $1 ORDER BY created_at ASC', [id]),
      query<any>('SELECT * FROM ticket_status_history WHERE ticket_id = $1 ORDER BY created_at ASC', [id]),
      query<any>('SELECT * FROM ticket_escalations WHERE ticket_id = $1 ORDER BY created_at ASC', [id]),
    ]);

    return {
      ...t,
      sla_breached: !!t.sla_breached,
      sla_remaining_minutes: t.sla_remaining_minutes !== null ? Math.round(Number(t.sla_remaining_minutes)) : null,
      sla_deadline: t.sla_deadline ? new Date(t.sla_deadline).toISOString() : null,
      first_response_at: t.first_response_at ? new Date(t.first_response_at).toISOString() : null,
      resolved_at: t.resolved_at ? new Date(t.resolved_at).toISOString() : null,
      closed_at: t.closed_at ? new Date(t.closed_at).toISOString() : null,
      created_at: new Date(t.created_at).toISOString(),
      updated_at: new Date(t.updated_at).toISOString(),
      comments: comRes.rows.map((c) => ({ ...c, created_at: new Date(c.created_at).toISOString() })),
      attachments: attRes.rows.map((a) => ({ ...a, created_at: new Date(a.created_at).toISOString() })),
      statusHistory: histRes.rows.map((h) => ({ ...h, created_at: new Date(h.created_at).toISOString() })),
      escalations: escRes.rows.map((e) => ({ ...e, created_at: new Date(e.created_at).toISOString() })),
    };
  },

  /** Create new support ticket */
  async createTicket(input: {
    subscriberId?: number;
    username?: string;
    category: string;
    subcategory?: string;
    subject: string;
    description: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    assignedUserId?: string;
    createdById?: string;
    createdByName: string;
    internalNotes?: string;
  }): Promise<TicketItem> {
    if (!input.subject || !input.subject.trim()) {
      throw HttpError.badRequest('Ticket subject is required');
    }
    if (!input.description || !input.description.trim()) {
      throw HttpError.badRequest('Ticket description is required');
    }

    // Resolve subscriber
    let subRes: any;
    if (input.subscriberId) {
      subRes = await query('SELECT id, username, organization_id, branch_id, reseller_id FROM subscribers WHERE id = $1', [input.subscriberId]);
    } else if (input.username) {
      subRes = await query('SELECT id, username, organization_id, branch_id, reseller_id FROM subscribers WHERE lower(username) = lower($1)', [input.username.trim()]);
    } else {
      throw HttpError.badRequest('Subscriber ID or username is required');
    }

    if (!subRes.rows[0]) throw HttpError.notFound('Subscriber not found');
    const sub = subRes.rows[0];

    const priority = input.priority || 'MEDIUM';

    // Calculate SLA deadline based on priority rules
    const slaRes = await query<{ resolution_time_hours: number }>(
      'SELECT resolution_time_hours FROM ticket_sla_rules WHERE priority = $1 AND is_active = TRUE',
      [priority]
    );
    const slaHours = slaRes.rows[0]?.resolution_time_hours || (priority === 'CRITICAL' ? 4 : priority === 'HIGH' ? 8 : 12);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Generate sequence number
      const seqRes = await client.query<{ next_val: string }>(
        `SELECT LPAD(COALESCE(MAX(id) + 1, 1)::text, 4, '0') AS next_val FROM tickets`
      );
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const ticketNumber = `TICK-${todayStr}-${seqRes.rows[0].next_val}`;

      const insertRes = await client.query<{ id: number }>(
        `INSERT INTO tickets (
           ticket_number, subscriber_id, username, organization_id, branch_id, reseller_id,
           category, subcategory, subject, description, priority, status,
           assigned_user_id, created_by_id, created_by_name,
           sla_deadline, internal_notes
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, 'OPEN',
           $12, $13, $14,
           NOW() + make_interval(hours => $15), $16
         ) RETURNING id`,
        [
          ticketNumber,
          sub.id,
          sub.username,
          sub.organization_id || null,
          sub.branch_id || null,
          sub.reseller_id || null,
          input.category,
          input.subcategory?.trim() || null,
          input.subject.trim(),
          input.description.trim(),
          priority,
          input.assignedUserId || null,
          input.createdById || null,
          input.createdByName,
          slaHours,
          input.internalNotes?.trim() || null,
        ]
      );
      const ticketId = insertRes.rows[0].id;

      // Status history entry
      await client.query(
        `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, changed_by_name, reason)
         VALUES ($1, NULL, 'OPEN', $2, $3, 'Ticket created')`,
        [ticketId, input.createdById || null, input.createdByName]
      );

      await client.query('COMMIT');

      // Activity timeline
      await crmRepository.logActivity({
        subscriberId: sub.id,
        actorId: input.createdById,
        actorName: input.createdByName,
        actionType: 'TICKET_CREATED',
        description: `Support ticket #${ticketNumber} opened: "${input.subject}" (${priority})`,
        metadata: { ticketId, ticketNumber, priority, category: input.category },
      });

      await auditRepository.insert({
        userId: input.createdById,
        action: 'ticket.created',
        entityType: 'ticket',
        entityId: String(ticketId),
        status: 'success',
        metadata: { ticketNumber, subscriber: sub.username, category: input.category, priority },
      });

      return (await this.getTicketById(ticketId)) as any;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Add comment to ticket */
  async addComment(input: {
    ticketId: number;
    authorId?: string;
    authorName: string;
    comment: string;
    isInternal?: boolean;
  }): Promise<TicketCommentItem> {
    if (!input.comment || !input.comment.trim()) {
      throw HttpError.badRequest('Comment cannot be empty');
    }

    const tRes = await query<{ status: string; subscriber_id: number; first_response_at: Date | null }>(
      'SELECT status, subscriber_id, first_response_at FROM tickets WHERE id = $1',
      [input.ticketId]
    );
    if (!tRes.rows[0]) throw HttpError.notFound('Ticket not found');
    const ticket = tRes.rows[0];

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const commRes = await client.query<any>(
        `INSERT INTO ticket_comments (ticket_id, author_id, author_name, comment, is_internal)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, ticket_id, author_id, author_name, comment, is_internal, created_at`,
        [input.ticketId, input.authorId || null, input.authorName, input.comment.trim(), input.isInternal !== false]
      );

      // Record first response timestamp if staff commented and first response not yet set
      if (!ticket.first_response_at) {
        await client.query(
          `UPDATE tickets SET first_response_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [input.ticketId]
        );
      } else {
        await client.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [input.ticketId]);
      }

      await client.query('COMMIT');

      const c = commRes.rows[0];
      return {
        ...c,
        created_at: new Date(c.created_at).toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Change ticket status (OPEN, IN_PROGRESS, WAITING_CUSTOMER, WAITING_INTERNAL, RESOLVED, CLOSED, REOPENED) */
  async updateStatus(input: {
    ticketId: number;
    status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'WAITING_INTERNAL' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
    resolution?: string;
    reason?: string;
    changedById?: string;
    changedByName: string;
  }): Promise<void> {
    const tRes = await query<{ status: string; subscriber_id: number; ticket_number: string }>(
      'SELECT status, subscriber_id, ticket_number FROM tickets WHERE id = $1',
      [input.ticketId]
    );
    if (!tRes.rows[0]) throw HttpError.notFound('Ticket not found');
    const prevStatus = tRes.rows[0].status;

    if (prevStatus === input.status) return;

    const isResolved = input.status === 'RESOLVED';
    const isClosed = input.status === 'CLOSED';

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tickets
            SET status = $2,
                resolution = CASE WHEN $3::text IS NOT NULL THEN $3 ELSE resolution END,
                resolved_at = CASE WHEN $4::boolean THEN NOW() ELSE resolved_at END,
                closed_at = CASE WHEN $5::boolean THEN NOW() ELSE closed_at END,
                updated_at = NOW()
          WHERE id = $1`,
        [
          input.ticketId,
          input.status,
          input.resolution?.trim() || null,
          isResolved,
          isClosed,
        ]
      );

      await client.query(
        `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, changed_by_name, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          input.ticketId,
          prevStatus,
          input.status,
          input.changedById || null,
          input.changedByName,
          input.reason || (isResolved ? `Resolved: ${input.resolution || 'Issue fixed'}` : `Status updated to ${input.status}`),
        ]
      );

      await client.query('COMMIT');

      await crmRepository.logActivity({
        subscriberId: tRes.rows[0].subscriber_id,
        actorId: input.changedById,
        actorName: input.changedByName,
        actionType: 'TICKET_STATUS_UPDATED',
        description: `Ticket #${tRes.rows[0].ticket_number} status changed from ${prevStatus} to ${input.status}${input.resolution ? `: "${input.resolution}"` : ''}`,
      });

      await auditRepository.insert({
        userId: input.changedById,
        action: 'ticket.status_change',
        entityType: 'ticket',
        entityId: String(input.ticketId),
        status: 'success',
        metadata: { from: prevStatus, to: input.status, resolution: input.resolution },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Assign ticket to technician */
  async assignTicket(input: {
    ticketId: number;
    assignedUserId: string | null;
    actorId?: string;
    actorName: string;
  }): Promise<void> {
    const tRes = await query<{ ticket_number: string; subscriber_id: number; assigned_user_id: string | null }>(
      'SELECT ticket_number, subscriber_id, assigned_user_id FROM tickets WHERE id = $1',
      [input.ticketId]
    );
    if (!tRes.rows[0]) throw HttpError.notFound('Ticket not found');

    let assigneeName = 'Unassigned';
    if (input.assignedUserId) {
      const uRes = await query<{ full_name: string }>('SELECT full_name FROM users WHERE id = $1', [input.assignedUserId]);
      if (!uRes.rows[0]) throw HttpError.notFound('Assigned user not found');
      assigneeName = uRes.rows[0].full_name;
    }

    await query(
      `UPDATE tickets
          SET assigned_user_id = $2,
              status = CASE WHEN status = 'OPEN' AND $2::uuid IS NOT NULL THEN 'IN_PROGRESS' ELSE status END,
              updated_at = NOW()
        WHERE id = $1`,
      [input.ticketId, input.assignedUserId || null]
    );

    // Comment documenting assignment
    await query(
      `INSERT INTO ticket_comments (ticket_id, author_id, author_name, comment, is_internal)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [
        input.ticketId,
        input.actorId || null,
        input.actorName,
        `Ticket assigned to ${assigneeName}`,
      ]
    );

    await auditRepository.insert({
      userId: input.actorId,
      action: 'ticket.assigned',
      entityType: 'ticket',
      entityId: String(input.ticketId),
      status: 'success',
      metadata: { assignedUserId: input.assignedUserId, assigneeName },
    });
  },

  /** Escalate ticket priority */
  async escalateTicket(input: {
    ticketId: number;
    toPriority: 'HIGH' | 'CRITICAL';
    reason: string;
    escalatedById?: string;
    escalatedByName: string;
  }): Promise<void> {
    if (!input.reason || !input.reason.trim()) {
      throw HttpError.badRequest('Escalation reason is required');
    }

    const tRes = await query<{ priority: string; ticket_number: string; subscriber_id: number }>(
      'SELECT priority, ticket_number, subscriber_id FROM tickets WHERE id = $1',
      [input.ticketId]
    );
    if (!tRes.rows[0]) throw HttpError.notFound('Ticket not found');
    const fromPriority = tRes.rows[0].priority;

    // SLA recalculation for new priority
    const slaRes = await query<{ resolution_time_hours: number }>(
      'SELECT resolution_time_hours FROM ticket_sla_rules WHERE priority = $1',
      [input.toPriority]
    );
    const hours = slaRes.rows[0]?.resolution_time_hours || (input.toPriority === 'CRITICAL' ? 2 : 6);

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tickets
            SET priority = $2,
                escalation_count = escalation_count + 1,
                sla_deadline = NOW() + make_interval(hours => $3),
                updated_at = NOW()
          WHERE id = $1`,
        [input.ticketId, input.toPriority, hours]
      );

      await client.query(
        `INSERT INTO ticket_escalations (ticket_id, escalated_by, from_priority, to_priority, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.ticketId, input.escalatedById || null, fromPriority, input.toPriority, input.reason.trim()]
      );

      await client.query(
        `INSERT INTO ticket_comments (ticket_id, author_id, author_name, comment, is_internal)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [
          input.ticketId,
          input.escalatedById || null,
          input.escalatedByName,
          `⚠️ Ticket ESCALATED from ${fromPriority} to ${input.toPriority}. Reason: ${input.reason.trim()}`,
        ]
      );

      await client.query('COMMIT');

      await crmRepository.logActivity({
        subscriberId: tRes.rows[0].subscriber_id,
        actorId: input.escalatedById,
        actorName: input.escalatedByName,
        actionType: 'TICKET_ESCALATED',
        description: `Ticket #${tRes.rows[0].ticket_number} escalated to ${input.toPriority}: "${input.reason.trim()}"`,
      });

      await auditRepository.insert({
        userId: input.escalatedById,
        action: 'ticket.escalated',
        entityType: 'ticket',
        entityId: String(input.ticketId),
        status: 'success',
        metadata: { from: fromPriority, to: input.toPriority, reason: input.reason },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Get support metrics for dashboard KPI cards */
  async getMetrics(filter?: { branch_id?: number; reseller_id?: number }): Promise<TicketMetrics> {
    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    if (filter?.branch_id) {
      conditions.push(`branch_id = $${idx}`);
      values.push(filter.branch_id);
      idx++;
    }
    if (filter?.reseller_id) {
      conditions.push(`reseller_id = $${idx}`);
      values.push(filter.reseller_id);
      idx++;
    }

    const where = conditions.join(' AND ');

    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_tickets,
        COUNT(*) FILTER (WHERE status IN ('IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'REOPENED'))::int AS in_progress_tickets,
        COUNT(*) FILTER (WHERE priority = 'CRITICAL' AND status NOT IN ('RESOLVED', 'CLOSED'))::int AS critical_tickets,
        COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('RESOLVED', 'CLOSED'))::int AS sla_breached,
        COUNT(*) FILTER (WHERE sla_deadline IS NOT NULL AND sla_deadline >= NOW() AND sla_deadline <= (NOW() + interval '2 hours') AND status NOT IN ('RESOLVED', 'CLOSED'))::int AS sla_near_breach,
        COUNT(*) FILTER (WHERE status IN ('RESOLVED', 'CLOSED') AND updated_at >= date_trunc('day', NOW()))::int AS resolved_today,
        COUNT(*)::int AS total_tickets
      FROM tickets
      WHERE ${where}
    `;

    const { rows } = await query<any>(sql, values);
    const r = rows[0] || {};

    return {
      openTickets: r.open_tickets || 0,
      inProgressTickets: r.in_progress_tickets || 0,
      criticalTickets: r.critical_tickets || 0,
      slaNearBreach: r.sla_near_breach || 0,
      slaBreached: r.sla_breached || 0,
      resolvedToday: r.resolved_today || 0,
      totalTickets: r.total_tickets || 0,
    };
  },

  /** List categories */
  async listCategories(): Promise<TicketCategoryItem[]> {
    const { rows } = await query<TicketCategoryItem>(
      'SELECT id, name, description, default_priority, default_sla_hours, is_active FROM ticket_categories ORDER BY id ASC'
    );
    return rows;
  },

  /** List SLA rules */
  async listSlaRules(): Promise<SlaRuleItem[]> {
    const { rows } = await query<any>(
      'SELECT id, priority, response_time_hours, resolution_time_hours, is_active, updated_at FROM ticket_sla_rules ORDER BY id ASC'
    );
    return rows.map((r) => ({
      ...r,
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  },

  /** Update SLA rule for priority */
  async updateSlaRule(
    priority: string,
    input: { response_time_hours: number; resolution_time_hours: number; actorId?: string }
  ): Promise<void> {
    if (input.response_time_hours < 1 || input.resolution_time_hours < 1) {
      throw HttpError.badRequest('SLA response and resolution times must be at least 1 hour');
    }

    await query(
      `UPDATE ticket_sla_rules
          SET response_time_hours = $2,
              resolution_time_hours = $3,
              updated_at = NOW()
        WHERE priority = $1`,
      [priority.toUpperCase(), input.response_time_hours, input.resolution_time_hours]
    );

    await auditRepository.insert({
      userId: input.actorId,
      action: 'ticket_sla.updated',
      entityType: 'sla_rule',
      entityId: priority,
      status: 'success',
      metadata: input,
    });
  },
};
