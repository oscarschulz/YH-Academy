const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_federation_records';

const COLLECTION_TO_TYPE = {
  federationConnectionRequests: 'connection_request',
  federationDealRooms: 'deal_room',
  federationLeadAccessGrants: 'lead_access_grant'
};

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function cleanLower(value, fallback = '') {
  return cleanText(value, fallback).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function safeArray(value = []) {
  return Array.isArray(value) ? value : [];
}

function makeHttpError(message = 'Request failed.', statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeDate(value) {
  if (!value) return '';

  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (typeof value === 'object') {
    if (Number.isFinite(value._seconds)) {
      return new Date(value._seconds * 1000).toISOString();
    }

    if (Number.isFinite(value.seconds)) {
      return new Date(value.seconds * 1000).toISOString();
    }
  }

  return cleanText(value);
}

function normalizeValue(value) {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) return value.toISOString();

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (typeof value === 'object') {
    if (Number.isFinite(value._seconds)) {
      return new Date(value._seconds * 1000).toISOString();
    }

    if (Number.isFinite(value.seconds)) {
      return new Date(value.seconds * 1000).toISOString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, normalizeValue(inner)])
    );
  }

  return value;
}

function pickFirst(data = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = data[key];

    if (value !== null && value !== undefined && cleanText(value) !== '') {
      return cleanText(value);
    }
  }

  return fallback;
}

function normalizeStatus(value = '', fallback = 'active') {
  return cleanLower(value || fallback) || fallback;
}

function getRecordTypeFromCollection(collectionPath = '') {
  const root = cleanText(collectionPath).split('/')[0];
  return COLLECTION_TO_TYPE[root] || cleanLower(root || 'federation_record');
}

function buildTitle(recordType = '', data = {}, docId = '') {
  if (recordType === 'connection_request') {
    return pickFirst(data, [
      'title',
      'leadTitle',
      'serviceTitle',
      'companyName',
      'requestTitle',
      'businessName',
      'providerName'
    ], `Federation request ${docId}`);
  }

  if (recordType === 'deal_room') {
    return pickFirst(data, [
      'title',
      'roomTitle',
      'dealTitle',
      'leadTitle',
      'companyName'
    ], `Federation deal room ${docId}`);
  }

  if (recordType === 'lead_access_grant') {
    return pickFirst(data, [
      'title',
      'leadTitle',
      'companyName',
      'requestTitle'
    ], `Federation lead access grant ${docId}`);
  }

  return pickFirst(data, ['title', 'name'], docId);
}

function buildSummary(recordType = '', data = {}) {
  const parts = [];

  if (recordType === 'connection_request') {
    parts.push(
      pickFirst(data, ['requestType', 'type', 'category']),
      pickFirst(data, ['status', 'paymentStatus', 'matchStatus']),
      pickFirst(data, ['providerName', 'targetName', 'businessName']),
      pickFirst(data, ['region', 'country'])
    );
  } else if (recordType === 'deal_room') {
    parts.push(
      pickFirst(data, ['status']),
      pickFirst(data, ['buyerName', 'requesterName']),
      pickFirst(data, ['sellerName', 'providerName'])
    );
  } else {
    parts.push(
      pickFirst(data, ['status']),
      pickFirst(data, ['requestId']),
      pickFirst(data, ['leadId'])
    );
  }

  return parts.filter(Boolean).join(' • ').slice(0, 600);
}

function buildFederationPayload({
  recordType = '',
  sourceCollectionPath = '',
  sourceDocumentId = '',
  sourceDocumentPath = '',
  data = {}
}) {
  const normalizedData = normalizeValue(data || {});
  const type = cleanText(recordType || getRecordTypeFromCollection(sourceCollectionPath));
  const docId = cleanText(sourceDocumentId || normalizedData.id || normalizedData.uid);

  const ownerUserId = pickFirst(normalizedData, [
    'ownerUid',
    'ownerUserId',
    'userId',
    'uid',
    'requesterUid',
    'requesterId',
    'buyerUid',
    'buyerId',
    'memberId',
    'payerUid'
  ]);

  const targetUserId = pickFirst(normalizedData, [
    'targetUserId',
    'targetUid',
    'providerUid',
    'providerId',
    'sellerUid',
    'sellerId',
    'operatorUid',
    'assignedToUid'
  ]);

  const roomId = pickFirst(normalizedData, [
    'roomId',
    'dealRoomId',
    'conversationId'
  ], type === 'deal_room' ? docId : '');

  const status = normalizeStatus(
    normalizedData.status ||
    normalizedData.paymentStatus ||
    normalizedData.reviewStatus ||
    normalizedData.matchStatus ||
    'active'
  );

  const reviewStatus = normalizeStatus(
    normalizedData.reviewStatus ||
    normalizedData.adminReviewStatus ||
    status
  );

  const title = buildTitle(type, normalizedData, docId);
  const summary = buildSummary(type, normalizedData);

  const createdAtSource = normalizeDate(
    normalizedData.createdAt ||
    normalizedData.submittedAt ||
    normalizedData.created_at ||
    normalizedData.created ||
    nowIso()
  );

  const updatedAtSource = normalizeDate(
    normalizedData.updatedAt ||
    normalizedData.reviewedAt ||
    normalizedData.paidAt ||
    normalizedData.updated_at ||
    createdAtSource ||
    nowIso()
  );

  return {
    record_type: type,
    source_collection_path: cleanText(sourceCollectionPath),
    source_document_id: docId,
    source_document_path: cleanText(sourceDocumentPath || `${sourceCollectionPath}/${docId}`),
    owner_user_id: ownerUserId,
    target_user_id: targetUserId,
    room_id: roomId,
    status,
    review_status: reviewStatus,
    title,
    summary,
    body: cleanText(
      normalizedData.description ||
      normalizedData.notes ||
      normalizedData.adminNote ||
      normalizedData.message ||
      ''
    ),
    category: pickFirst(normalizedData, ['category', 'requestType', 'type'], type),
    tags: safeArray(normalizedData.tags),
    public_meta: {
      source: 'firestore_migration',
      recordType: type,
      title,
      status
    },
    private_meta: {
      originalCollection: sourceCollectionPath,
      originalDocumentId: docId
    },
    data: {
      ...normalizedData,
      id: docId,
      sourceDatabase: 'supabase',
      migratedFromFirestore: true,
      migratedAt: normalizedData.migratedAt || nowIso()
    },
    created_at_source: createdAtSource || nowIso(),
    updated_at_source: updatedAtSource || createdAtSource || nowIso()
  };
}

async function assertTableReady() {
  const { error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('id')
    .limit(1);

  if (error) {
    const message = error.message || error.details || JSON.stringify(error);
    throw makeHttpError(`Supabase table ${TABLE} is not ready. Run supabase-yhu-federation-records.sql first. ${message}`, 500);
  }

  return true;
}

async function upsertFederationRecord(payload = {}) {
  const docId = cleanText(payload.source_document_id);

  if (!docId) {
    throw makeHttpError('source_document_id is required.', 400);
  }

  const recordType = cleanText(payload.record_type || getRecordTypeFromCollection(payload.source_collection_path));

  if (!recordType) {
    throw makeHttpError('record_type is required.', 400);
  }

  const finalPayload = {
    ...payload,
    record_type: recordType,
    source_document_id: docId,
    status: normalizeStatus(payload.status || payload.data?.status || 'active'),
    review_status: normalizeStatus(payload.review_status || payload.data?.reviewStatus || payload.status || 'active')
  };

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .upsert(finalPayload, {
      onConflict: 'record_type,source_document_id'
    })
    .select('*')
    .single();

  if (error) {
    throw makeHttpError(`Federation record upsert failed: ${error.message}`, 500);
  }

  return data;
}

async function getFederationRecord(recordType = '', sourceDocumentId = '') {
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
    throw makeHttpError(`Federation record lookup failed: ${error.message}`, 500);
  }

  return data || null;
}

async function deleteFederationRecord(recordType = '', sourceDocumentId = '') {
  const cleanType = cleanText(recordType);
  const cleanId = cleanText(sourceDocumentId);

  if (!cleanType || !cleanId) return;

  const { error } = await yhuSupabaseAdmin
    .from(TABLE)
    .delete()
    .eq('record_type', cleanType)
    .eq('source_document_id', cleanId);

  if (error) {
    throw makeHttpError(`Federation record delete failed: ${error.message}`, 500);
  }
}

async function listFederationRecords(recordType = '', filters = {}) {
  let query = yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .order('created_at_source', { ascending: false, nullsFirst: false });

  if (recordType) {
    query = query.eq('record_type', cleanText(recordType));
  }

  if (filters.ownerUserId) {
    query = query.eq('owner_user_id', cleanText(filters.ownerUserId));
  }

  if (filters.targetUserId) {
    query = query.eq('target_user_id', cleanText(filters.targetUserId));
  }

  if (filters.status) {
    query = query.eq('status', cleanLower(filters.status));
  }

  if (filters.limit) {
    query = query.limit(Math.max(1, Math.min(Number(filters.limit), 1000)));
  }

  const { data, error } = await query;

  if (error) {
    throw makeHttpError(`Federation record list failed: ${error.message}`, 500);
  }

  return Array.isArray(data) ? data : [];
}

async function countFederationRecordsByType() {
  const types = ['connection_request', 'deal_room', 'lead_access_grant'];
  const result = {};

  for (const type of types) {
    const { count, error } = await yhuSupabaseAdmin
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('record_type', type);

    if (error) {
      throw makeHttpError(`Federation count failed for ${type}: ${error.message}`, 500);
    }

    result[type] = count || 0;
  }

  return result;
}

module.exports = {
  TABLE,
  COLLECTION_TO_TYPE,
  assertTableReady,
  buildFederationPayload,
  upsertFederationRecord,
  getFederationRecord,
  deleteFederationRecord,
  listFederationRecords,
  countFederationRecordsByType,
  normalizeValue,
  normalizeDate
};
