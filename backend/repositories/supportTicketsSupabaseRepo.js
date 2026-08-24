const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_support_tickets';

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function makeHttpError(message = 'Request failed.', statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function categoryLabel(value = '') {
  const clean = cleanText(value, 'general') || 'general';

  return clean
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildTicketCode() {
  const timePart =
    Date.now()
      .toString(36)
      .toUpperCase();

  const randomPart =
    crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase();

  return 'YH-' + timePart + '-' + randomPart;
}

function buildTitle(categoryLabelValue = '', message = '') {
  const label =
    cleanText(categoryLabelValue);

  if (label) {
    return (
      label +
      ' Support Request'
    ).slice(0, 180);
  }

  const cleanMessage =
    cleanText(message);

  if (cleanMessage) {
    return cleanMessage
      .replace(/\s+/g, ' ')
      .slice(0, 180);
  }

  return 'Support Request';
}

async function createOrAppendUserSupportTicket(input = {}) {
  const userId =
    cleanText(input.userId);

  const conversationId =
    cleanText(
      input.conversationId,
      'dashboard_ticket_main'
    ) ||
    'dashboard_ticket_main';

  const category =
    cleanText(
      input.category,
      'general'
    ) ||
    'general';

  const categoryLabelValue =
    cleanText(input.categoryLabel) ||
    categoryLabel(category);

  const latestMessage =
    cleanText(input.latestMessage);

  const reporterName =
    cleanText(input.reporterName);

  const reporterEmail =
    cleanText(input.reporterEmail)
      .toLowerCase();

  if (!userId) {
    throw makeHttpError(
      'Support ticket user is required.',
      400
    );
  }

  if (!latestMessage) {
    throw makeHttpError(
      'Support ticket message is required.',
      400
    );
  }

  const {
    data: existingRows,
    error: existingError
  } =
    await yhuSupabaseAdmin
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .neq('status', 'Resolved')
      .order(
        'updated_at',
        { ascending: false }
      )
      .limit(1);

  if (existingError) {
    throw makeHttpError(
      'Support ticket lookup failed: ' +
      existingError.message,
      500
    );
  }

  const existing =
    Array.isArray(existingRows)
      ? existingRows[0]
      : null;

  const now =
    new Date().toISOString();

  if (existing?.id) {
    const currentStatus =
      cleanText(
        existing.status,
        'Open'
      );

    const nextStatus =
      currentStatus === 'Waiting on User'
        ? 'In Progress'
        : currentStatus;

    const {
      data,
      error
    } =
      await yhuSupabaseAdmin
        .from(TABLE)
        .update({
          reporter_name:
            reporterName ||
            existing.reporter_name ||
            null,

          reporter_email:
            reporterEmail ||
            existing.reporter_email ||
            null,

          category,

          category_label:
            categoryLabelValue,

          latest_message:
            latestMessage,

          status:
            nextStatus,

          updated_at:
            now
        })
        .eq('id', existing.id)
        .select(
          'ticket_code,status,updated_at'
        )
        .single();

    if (error) {
      throw makeHttpError(
        'Failed to update support ticket: ' +
        error.message,
        500
      );
    }

    return {
      ticketCode:
        cleanText(data?.ticket_code),

      status:
        cleanText(
          data?.status,
          nextStatus
        ),

      updatedAt:
        cleanText(
          data?.updated_at,
          now
        ),

      created:
        false
    };
  }

  let lastError = null;

  for (
    let attempt = 0;
    attempt < 3;
    attempt += 1
  ) {
    const ticketCode =
      buildTicketCode();

    const {
      data,
      error
    } =
      await yhuSupabaseAdmin
        .from(TABLE)
        .insert({
          ticket_code:
            ticketCode,

          user_id:
            userId,

          reporter_name:
            reporterName ||
            null,

          reporter_email:
            reporterEmail ||
            null,

          conversation_id:
            conversationId,

          category,

          category_label:
            categoryLabelValue,

          title:
            buildTitle(
              categoryLabelValue,
              latestMessage
            ),

          latest_message:
            latestMessage,

          status:
            'Open',

          priority:
            'Normal',

          notes:
            [],

          created_at:
            now,

          updated_at:
            now
        })
        .select(
          'ticket_code,status,updated_at'
        )
        .single();

    if (!error) {
      return {
        ticketCode:
          cleanText(
            data?.ticket_code,
            ticketCode
          ),

        status:
          cleanText(
            data?.status,
            'Open'
          ),

        updatedAt:
          cleanText(
            data?.updated_at,
            now
          ),

        created:
          true
      };
    }

    lastError = error;

    if (
      String(error.code || '') !==
      '23505'
    ) {
      break;
    }
  }

  throw makeHttpError(
    'Failed to create support ticket: ' +
    (
      lastError?.message ||
      'Unknown database error.'
    ),
    500
  );
}

module.exports = {
  TABLE,
  createOrAppendUserSupportTicket
};
