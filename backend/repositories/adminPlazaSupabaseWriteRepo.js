const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');
const adminPlazaSupabaseRepo = require('./adminPlazaSupabaseRepo');

const TABLE = 'yhu_plaza_records';

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function cleanLower(value, fallback = '') {
  return cleanText(value, fallback).toLowerCase();
}

function safeArray(value = []) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(value = '', fallback = 'active') {
  return cleanLower(value || fallback) || fallback;
}

function makeHttpError(message = 'Request failed.', statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRouteLane(value = '', fallback = 'manual_review') {
  const raw = cleanLower(value || fallback);

  if (['academy', 'academy_operator', 'operator'].includes(raw)) return 'academy_operator';
  if (['provider', 'plaza_provider', 'service_provider'].includes(raw)) return 'plaza_provider';
  if (['federation', 'federation_escalation', 'federation_escalation_request'].includes(raw)) return 'federation_escalation';
  if (['regional_leader', 'patron', 'leader'].includes(raw)) return 'regional_leader';
  if (['conversation', 'open_conversation'].includes(raw)) return 'open_conversation';
  if (['service_request'].includes(raw)) return 'service_request';

  return 'manual_review';
}

function getData(row = {}) {
  return row.data && typeof row.data === 'object' ? row.data : {};
}

function getPublicMeta(row = {}) {
  return row.public_meta && typeof row.public_meta === 'object' ? row.public_meta : {};
}

function getPrivateMeta(row = {}) {
  return row.private_meta && typeof row.private_meta === 'object' ? row.private_meta : {};
}

async function getRawRecord(recordType = '', sourceDocumentId = '') {
  const cleanType = cleanText(recordType);
  const cleanId = cleanText(sourceDocumentId);

  if (!cleanType || !cleanId) return null;

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('record_type', cleanType)
    .eq('source_document_id', cleanId)
    .maybeSingle();

  if (error) {
    throw makeHttpError(`Supabase record lookup failed: ${error.message}`, 500);
  }

  return data || null;
}

async function updateRawRecord(recordType = '', sourceDocumentId = '', patch = {}) {
  const cleanType = cleanText(recordType);
  const cleanId = cleanText(sourceDocumentId);

  if (!cleanType || !cleanId) {
    throw makeHttpError('Record type and id are required.', 400);
  }

  const existing = await getRawRecord(cleanType, cleanId);

  if (!existing) {
    throw makeHttpError('Record not found.', 404);
  }

  const existingData = getData(existing);
  const existingPublic = getPublicMeta(existing);
  const existingPrivate = getPrivateMeta(existing);

  const nextData = {
    ...existingData,
    ...(patch.data && typeof patch.data === 'object' ? patch.data : {}),
    updatedAt: patch.updatedAt || nowIso()
  };

  const nextPublicMeta = {
    ...existingPublic,
    ...(patch.public_meta && typeof patch.public_meta === 'object' ? patch.public_meta : {})
  };

  const nextPrivateMeta = {
    ...existingPrivate,
    ...(patch.private_meta && typeof patch.private_meta === 'object' ? patch.private_meta : {})
  };

  const topPatch = {
    data: nextData,
    public_meta: nextPublicMeta,
    private_meta: nextPrivateMeta,
    updated_at_source: patch.updated_at_source || nextData.updatedAt
  };

  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    topPatch.status = normalizeStatus(patch.status);
  } else if (Object.prototype.hasOwnProperty.call(nextData, 'status')) {
    topPatch.status = normalizeStatus(nextData.status);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'review_status')) {
    topPatch.review_status = normalizeStatus(patch.review_status);
  } else if (Object.prototype.hasOwnProperty.call(nextData, 'reviewStatus')) {
    topPatch.review_status = normalizeStatus(nextData.reviewStatus);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    topPatch.title = cleanText(patch.title);
  } else if (Object.prototype.hasOwnProperty.call(nextData, 'title')) {
    topPatch.title = cleanText(nextData.title || existing.title || '');
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'summary')) {
    topPatch.summary = cleanText(patch.summary).slice(0, 600);
  } else if (Object.prototype.hasOwnProperty.call(nextData, 'summary')) {
    topPatch.summary = cleanText(nextData.summary || existing.summary || '').slice(0, 600);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'body')) {
    topPatch.body = cleanText(patch.body);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'category')) {
    topPatch.category = cleanText(patch.category);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'region')) {
    topPatch.region = cleanText(patch.region);
  }

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .update(topPatch)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) {
    throw makeHttpError(`Supabase record update failed: ${error.message}`, 500);
  }

  return data;
}

async function deleteRecord(recordType = '', sourceDocumentId = '') {
  const cleanType = cleanText(recordType);
  const cleanId = cleanText(sourceDocumentId);

  if (!cleanType || !cleanId) return;

  const { error } = await yhuSupabaseAdmin
    .from(TABLE)
    .delete()
    .eq('record_type', cleanType)
    .eq('source_document_id', cleanId);

  if (error) {
    throw makeHttpError(`Supabase record delete failed: ${error.message}`, 500);
  }
}

async function upsertSmokeRecord(row = {}) {
  const recordType = cleanText(row.record_type);
  const sourceDocumentId = cleanText(row.source_document_id);

  if (!recordType || !sourceDocumentId) {
    throw makeHttpError('Smoke record type and id are required.', 400);
  }

  const existing = await getRawRecord(recordType, sourceDocumentId);

  const payload = {
    record_type: recordType,
    source_collection_path: cleanText(row.source_collection_path || recordType),
    source_document_id: sourceDocumentId,
    source_document_path: cleanText(row.source_document_path || `${recordType}/${sourceDocumentId}`),
    owner_user_id: cleanText(row.owner_user_id || ''),
    target_user_id: cleanText(row.target_user_id || ''),
    room_id: cleanText(row.room_id || ''),
    status: normalizeStatus(row.status || 'active'),
    review_status: normalizeStatus(row.review_status || row.status || 'active'),
    title: cleanText(row.title || 'Admin write smoke record'),
    summary: cleanText(row.summary || '').slice(0, 600),
    body: cleanText(row.body || ''),
    region: cleanText(row.region || 'Global'),
    category: cleanText(row.category || ''),
    tags: safeArray(row.tags),
    public_meta: row.public_meta && typeof row.public_meta === 'object' ? row.public_meta : {},
    private_meta: row.private_meta && typeof row.private_meta === 'object' ? row.private_meta : {},
    data: row.data && typeof row.data === 'object' ? row.data : {},
    created_at_source: cleanText(row.created_at_source || nowIso()),
    updated_at_source: cleanText(row.updated_at_source || nowIso())
  };

  if (existing?.id) {
    const { data, error } = await yhuSupabaseAdmin
      .from(TABLE)
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      throw makeHttpError(`Smoke record update failed: ${error.message}`, 500);
    }

    return data;
  }

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw makeHttpError(`Smoke record insert failed: ${error.message}`, 500);
  }

  return data;
}

async function getAdminListingById(id = '') {
  const listings = await adminPlazaSupabaseRepo.listAdminPlazaListings(1000);
  return listings.find((item) => cleanText(item.id) === cleanText(id)) || null;
}

async function getAdminRequestById(id = '') {
  const desk = await adminPlazaSupabaseRepo.buildAdminPlazaRoutingDeskSnapshot(500);
  return desk.requests.find((item) => cleanText(item.id) === cleanText(id)) || null;
}

async function getAdminReportById(id = '') {
  const reports = await adminPlazaSupabaseRepo.buildAdminBusinessChatReportsSnapshot(500);
  return reports.find((item) => cleanText(item.id) === cleanText(id)) || null;
}

function buildAdminSystemMessage(text = '', adminName = 'admin') {
  return {
    id: `admin_system_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: 'system',
    authorId: 'admin',
    authorName: cleanText(adminName || 'admin'),
    text: cleanText(text),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

async function updatePlazaListingStatus(listingId = '', body = {}, adminName = 'admin') {
  const cleanId = cleanText(listingId);
  const nextStatus = cleanLower(body.status || '');
  const featuredValue = body.featured;

  const allowedStatuses = new Set([
    'pending_review',
    'active',
    'flagged',
    'archived'
  ]);

  if (!cleanId) {
    throw makeHttpError('Plaza listing id is required.', 400);
  }

  if (nextStatus && !allowedStatuses.has(nextStatus)) {
    throw makeHttpError('Invalid Plaza listing status.', 400);
  }

  const current = await getRawRecord('opportunity', cleanId);

  if (!current) {
    throw makeHttpError('Plaza listing not found.', 404);
  }

  const data = getData(current);
  const nextData = {
    ...data,
    reviewedBy: cleanText(adminName || 'admin'),
    reviewedAt: nowIso(),
    updatedAt: nowIso()
  };

  if (nextStatus) {
    nextData.status = nextStatus;
    nextData.reviewStatus = nextStatus;
  }

  if (typeof featuredValue === 'boolean') {
    nextData.featured = featuredValue;
    nextData.featuredAt = featuredValue ? nowIso() : '';
  }

  await updateRawRecord('opportunity', cleanId, {
    data: nextData,
    status: nextData.status || current.status,
    review_status: nextData.reviewStatus || current.review_status,
    public_meta: {
      featured: nextData.featured === true,
      reviewedBy: cleanText(adminName || 'admin')
    },
    updated_at_source: nextData.updatedAt
  });

  return await getAdminListingById(cleanId);
}

async function routePlazaRequest(requestId = '', body = {}, adminName = 'admin') {
  const cleanId = cleanText(requestId);

  if (!cleanId) {
    throw makeHttpError('Plaza request id is required.', 400);
  }

  const current = await getRawRecord('request', cleanId);

  if (!current) {
    throw makeHttpError('Plaza request not found.', 404);
  }

  const data = getData(current);
  const currentHistory = Array.isArray(data.statusHistory) ? data.statusHistory : [];

  const routeLane = normalizeRouteLane(
    body.routingLane ||
    body.adminRoutingLane ||
    body.routeKey ||
    body.routeLane ||
    data.adminRoutingLane ||
    data.routeKey ||
    'manual_review'
  );

  const nextStatus = cleanText(
    body.status ||
    body.nextStatus ||
    body.routeStatus ||
    data.status ||
    current.status ||
    'routed'
  );

  const routeLabel = cleanText(
    body.routeLabel ||
    body.matchingStatus ||
    body.providerName ||
    body.adminNote ||
    'Updated by admin'
  );

  const currentStatus = cleanText(data.status || current.status || '');
  const statusHistory = [...currentHistory];

  if (!statusHistory.length) {
    statusHistory.push({
      status: currentStatus || 'Submitted',
      at: data.createdAt || current.created_at_source || nowIso()
    });
  }

  if (nextStatus && nextStatus !== currentStatus) {
    statusHistory.push({
      status: nextStatus,
      at: nowIso(),
      by: cleanText(adminName || 'admin'),
      source: 'admin_routing_desk'
    });
  }

  const nextData = {
    ...data,
    ...(body && typeof body === 'object' ? body : {}),
    status: nextStatus,
    reviewStatus: body.reviewStatus || nextStatus,
    adminRoutingLane: routeLane,
    routeKey: routeLane,
    routeLane,
    routingLane: routeLane,
    routeLabel,
    matchingStatus: routeLabel,
    providerName: cleanText(body.providerName || data.providerName || ''),
    adminNote: cleanText(body.adminNote || body.note || data.adminNote || ''),
    routedBy: cleanText(adminName || 'admin'),
    routedAt: nowIso(),
    updatedAt: nowIso(),
    statusHistory
  };

  await updateRawRecord('request', cleanId, {
    data: nextData,
    status: nextStatus,
    review_status: nextData.reviewStatus,
    public_meta: {
      requestType: nextData.requestType || nextData.type || '',
      priority: nextData.priority || nextData.requestPriority || 'normal',
      routedBy: cleanText(adminName || 'admin')
    },
    updated_at_source: nextData.updatedAt
  });

  return await getAdminRequestById(cleanId);
}

async function updateBusinessChatReportStatus(reportId = '', body = {}, adminName = 'admin') {
  const cleanId = cleanText(reportId);
  const nextStatus = cleanLower(body.status || '');
  const adminNote = cleanText(body.adminNote || body.note || '');

  const allowedStatuses = new Set([
    'pending_review',
    'dismissed',
    'resolved',
    'closed',
    'blocked',
    'reopened'
  ]);

  if (!cleanId || !nextStatus) {
    throw makeHttpError('Report id and status are required.', 400);
  }

  if (!allowedStatuses.has(nextStatus)) {
    throw makeHttpError('Invalid Business Chat report status.', 400);
  }

  const reportRow = await getRawRecord('business_chat_report', cleanId);

  if (!reportRow) {
    throw makeHttpError('Business Chat report not found.', 404);
  }

  const reportData = getData(reportRow);
  const reportPrivate = getPrivateMeta(reportRow);
  const conversationId = cleanText(
    reportData.conversationId ||
    reportRow.room_id ||
    reportPrivate.conversationId ||
    ''
  );

  const now = nowIso();
  const admin = cleanText(adminName || 'admin');

  const nextReportData = {
    ...reportData,
    status: nextStatus,
    reviewStatus: nextStatus,
    adminNote,
    reviewedBy: admin,
    reviewedAt: now,
    updatedAt: now
  };

  const updatedReportRow = await updateRawRecord('business_chat_report', cleanId, {
    data: nextReportData,
    status: nextStatus,
    review_status: nextStatus,
    private_meta: {
      ...reportPrivate,
      conversationId
    },
    updated_at_source: now
  });

  let updatedConversation = null;

  if (conversationId) {
    const conversationRow = await getRawRecord('conversation', conversationId);

    if (conversationRow) {
      const conversationData = getData(conversationRow);
      const currentModeration =
        conversationData.moderation && typeof conversationData.moderation === 'object'
          ? conversationData.moderation
          : {};

      const messages = Array.isArray(conversationData.messages || conversationData.replies)
        ? (conversationData.messages || conversationData.replies)
        : [];

      const moderation = {
        ...currentModeration,
        reviewStatus: nextStatus,
        lastAdminAction: nextStatus,
        lastAdminNote: adminNote,
        lastAdminReviewedBy: admin,
        lastAdminReviewedAt: now
      };

      let nextConversationStatus = cleanText(conversationData.status || conversationRow.status || 'active');
      let nextMessages = [...messages];

      if (nextStatus === 'dismissed' || nextStatus === 'resolved') {
        moderation.reported = false;
        moderation.closed = currentModeration.closed === true;
        moderation.blocked = currentModeration.blocked === true;
        moderation.resolvedAt = now;
      }

      if (nextStatus === 'closed') {
        nextConversationStatus = 'closed';
        moderation.closed = true;
        moderation.closedBy = admin;
        moderation.closedAt = now;
        moderation.closeReason = adminNote || 'Closed by admin review.';
        nextMessages = [
          ...nextMessages,
          buildAdminSystemMessage('This business chat was closed by admin review.', admin)
        ];
      }

      if (nextStatus === 'blocked') {
        nextConversationStatus = 'blocked';
        moderation.blocked = true;
        moderation.blockedBy = admin;
        moderation.blockedAt = now;
        moderation.blockReason = adminNote || 'Blocked by admin review.';
        nextMessages = [
          ...nextMessages,
          buildAdminSystemMessage('This business chat was blocked by admin review. Replies are disabled.', admin)
        ];
      }

      if (nextStatus === 'reopened') {
        nextConversationStatus = 'active';
        moderation.closed = false;
        moderation.blocked = false;
        moderation.reopenedBy = admin;
        moderation.reopenedAt = now;
        nextMessages = [
          ...nextMessages,
          buildAdminSystemMessage('This business chat was reopened by admin review.', admin)
        ];
      }

      const nextConversationData = {
        ...conversationData,
        status: nextConversationStatus,
        reviewStatus: nextConversationStatus,
        moderation,
        messages: nextMessages,
        replies: nextMessages,
        updatedAt: now
      };

      await updateRawRecord('conversation', conversationId, {
        data: nextConversationData,
        status: nextConversationStatus,
        review_status: nextConversationStatus,
        updated_at_source: now
      });

      const analytics = await adminPlazaSupabaseRepo.buildAdminBusinessChatAnalyticsSnapshot();
      updatedConversation = {
        id: conversationId,
        status: nextConversationStatus,
        messageCount: nextMessages.length,
        analyticsSource: analytics.source || 'supabase'
      };
    }
  }

  const updatedReport = await getAdminReportById(cleanId);

  return {
    report: updatedReport || {
      id: cleanId,
      status: nextStatus,
      reviewStatus: nextStatus,
      source: 'supabase',
      raw: getData(updatedReportRow)
    },
    conversation: updatedConversation
  };
}

module.exports = {
  TABLE,
  getRawRecord,
  updateRawRecord,
  deleteRecord,
  upsertSmokeRecord,
  updatePlazaListingStatus,
  routePlazaRequest,
  updateBusinessChatReportStatus
};
