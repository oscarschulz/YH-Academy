const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_support_tickets';

const ALLOWED_STATUSES = new Set([
  'Open',
  'In Progress',
  'Waiting on User',
  'Escalated',
  'Resolved'
]);

function cleanText(value, fallback = '') {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  return String(value).trim();
}

function makeHttpError(
  message = 'Request failed.',
  statusCode = 500
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;
}

function safeNotes(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      (item) =>
        cleanText(item)
    )
    .filter(Boolean)
    .slice(0, 100);
}

function categoryLabel(value = '') {
  const clean =
    cleanText(
      value,
      'general'
    );

  if (!clean) {
    return 'General';
  }

  return clean
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function mapSupportTicketRow(
  row = {}
) {
  const ticketCode =
    cleanText(
      row.ticket_code ||
      row.id
    );

  const reporterName =
    cleanText(
      row.reporter_name
    );

  const reporterEmail =
    cleanText(
      row.reporter_email
    ).toLowerCase();

  const category =
    cleanText(
      row.category,
      'general'
    ) || 'general';

  return {
    id:
      ticketCode,

    recordId:
      cleanText(row.id),

    ticketCode,

    userId:
      cleanText(
        row.user_id
      ),

    reporter:
      reporterName ||
      reporterEmail ||
      cleanText(row.user_id) ||
      'YH Member',

    reporterName,
    reporterEmail,

    type:
      cleanText(
        row.category_label
      ) ||
      categoryLabel(category),

    category,

    title:
      cleanText(
        row.title,
        'Support Ticket'
      ) ||
      'Support Ticket',

    latestMessage:
      cleanText(
        row.latest_message
      ),

    status:
      cleanText(
        row.status,
        'Open'
      ) ||
      'Open',

    priority:
      cleanText(
        row.priority,
        'Normal'
      ) ||
      'Normal',

    notes:
      safeNotes(
        row.notes
      ),

    conversationId:
      cleanText(
        row.conversation_id,
        'dashboard_ticket_main'
      ) ||
      'dashboard_ticket_main',

    createdAt:
      cleanText(
        row.created_at
      ),

    updatedAt:
      cleanText(
        row.updated_at ||
        row.created_at
      ),

    resolvedAt:
      cleanText(
        row.resolved_at
      ),

    adminUpdatedBy:
      cleanText(
        row.admin_updated_by
      ),

    source:
      'supabase'
  };
}

async function listAdminSupportTickets(
  limit = 300
) {
  const safeLimit =
    Math.max(
      1,
      Math.min(
        Number(
          limit ||
          300
        ),
        1000
      )
    );

  const {
    data,
    error
  } =
    await yhuSupabaseAdmin
      .from(TABLE)
      .select('*')
      .order(
        'updated_at',
        {
          ascending: false
        }
      )
      .limit(
        safeLimit
      );

  if (error) {
    throw makeHttpError(
      'Failed to load support tickets: ' +
      error.message,
      500
    );
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ).map(
    mapSupportTicketRow
  );
}

async function updateSupportTicketStatus(
  ticketCode = '',
  payload = {},
  updatedBy = 'admin'
) {
  const cleanTicketCode =
    cleanText(
      ticketCode
    );

  const status =
    cleanText(
      payload.status
    );

  const adminNote =
    cleanText(
      payload.adminNote ||
      payload.note
    );

  if (!cleanTicketCode) {
    throw makeHttpError(
      'Ticket code is required.',
      400
    );
  }

  if (
    !ALLOWED_STATUSES.has(
      status
    )
  ) {
    throw makeHttpError(
      'Invalid support ticket status.',
      400
    );
  }

  const {
    data: existing,
    error: readError
  } =
    await yhuSupabaseAdmin
      .from(TABLE)
      .select('*')
      .eq(
        'ticket_code',
        cleanTicketCode
      )
      .maybeSingle();

  if (readError) {
    throw makeHttpError(
      'Support ticket lookup failed: ' +
      readError.message,
      500
    );
  }

  if (!existing) {
    throw makeHttpError(
      'Support ticket not found.',
      404
    );
  }

  const existingStatus =
    cleanText(
      existing.status,
      'Open'
    ) ||
    'Open';

  if (
    existingStatus === 'Resolved' &&
    status !== 'Resolved'
  ) {
    throw makeHttpError(
      'Resolved tickets cannot be moved to another status.',
      409
    );
  }

  /*
   * Re-resolving the same ticket is idempotent.
   * Keep the original resolved_at and notes.
   */
  if (
    existingStatus === 'Resolved' &&
    status === 'Resolved'
  ) {
    return mapSupportTicketRow(
      existing
    );
  }

  const now =
    new Date()
      .toISOString();

  const notes =
    safeNotes(
      existing.notes
    );

  const note =
    adminNote ||
    (
      'Ticket moved to ' +
      status +
      '.'
    );

  const updatePayload = {
    status,

    notes:
      [
        note,
        ...notes
      ].slice(
        0,
        100
      ),

    updated_at:
      now,

    admin_updated_by:
      cleanText(
        updatedBy,
        'admin'
      ) ||
      'admin',

    resolved_at:
      status === 'Resolved'
        ? now
        : null
  };

  const {
    data,
    error
  } =
    await yhuSupabaseAdmin
      .from(TABLE)
      .update(
        updatePayload
      )
      .eq(
        'ticket_code',
        cleanTicketCode
      )
      .select('*')
      .single();

  if (error) {
    throw makeHttpError(
      'Failed to update support ticket: ' +
      error.message,
      500
    );
  }

  return mapSupportTicketRow(
    data
  );
}

module.exports = {
  TABLE,
  ALLOWED_STATUSES,
  mapSupportTicketRow,
  listAdminSupportTickets,
  updateSupportTicketStatus
};
