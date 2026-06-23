const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_admin_broadcast_records';

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function nowIso() {
  return new Date().toISOString();
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

function buildAdminBroadcastPayload({
  sourceCollectionPath = 'adminBroadcasts',
  sourceDocumentId = '',
  sourceDocumentPath = '',
  data = {}
}) {
  const normalized = normalizeValue(data || {});
  const docId = cleanText(sourceDocumentId || normalized.id);
  const docPath = cleanText(sourceDocumentPath || `adminBroadcasts/${docId}`);

  const audience = cleanText(normalized.audience || normalized.targetAudience || normalized.to || '');
  const subject = cleanText(normalized.subject || normalized.title || '');
  const message = cleanText(normalized.message || normalized.body || normalized.text || '');
  const createdBy = cleanText(normalized.createdBy || normalized.created_by || normalized.admin || '');

  const sentAtSource = normalizeDate(
    normalized.sentAt ||
    normalized.createdAt ||
    normalized.created_at ||
    nowIso()
  );

  const createdAtSource = normalizeDate(
    normalized.createdAt ||
    normalized.created_at ||
    normalized.sentAt ||
    sentAtSource ||
    nowIso()
  );

  return {
    source_collection_path: cleanText(sourceCollectionPath || 'adminBroadcasts'),
    source_document_id: docId,
    source_document_path: docPath,
    audience,
    subject,
    message,
    status: cleanText(normalized.status || normalized.deliveryStatus || ''),
    created_by: createdBy,
    sent_at_source: sentAtSource || nowIso(),
    created_at_source: createdAtSource || sentAtSource || nowIso(),
    public_meta: {
      source: 'firestore_migration',
      audience,
      subject
    },
    private_meta: {
      originalCollection: sourceCollectionPath,
      originalDocumentId: docId,
      originalDocumentPath: docPath
    },
    data: {
      ...normalized,
      id: docId,
      sourceDatabase: 'supabase',
      migratedFromFirestore: true,
      migratedAt: normalized.migratedAt || nowIso()
    }
  };
}

function mapAdminBroadcastRecord(row = {}) {
  const data = row?.data && typeof row.data === 'object' ? row.data : {};

  return {
    ...data,
    id: row.source_document_id || data.id || row.id,
    audience: data.audience || row.audience || '',
    subject: data.subject || row.subject || '',
    message: data.message || row.message || '',
    status: data.status || row.status || '',
    createdBy: data.createdBy || row.created_by || '',
    sentAt: data.sentAt || row.sent_at_source || row.created_at || '',
    createdAt: data.createdAt || row.created_at_source || row.created_at || '',
    sourceDatabase: 'supabase',
    supabaseRecordId: row.id
  };
}

async function assertTableReady() {
  const { error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('id,source_document_path,audience,subject,message,data')
    .limit(1);

  if (error) {
    throw makeHttpError(`Supabase table ${TABLE} is not ready. Run supabase-yhu-admin-broadcast-records.sql first. ${error.message || error.details || ''}`, 500);
  }

  return true;
}

async function upsertAdminBroadcastRecord(payload = {}) {
  const sourceDocumentPath = cleanText(payload.source_document_path);

  if (!sourceDocumentPath) {
    throw makeHttpError('source_document_path is required.', 400);
  }

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .upsert(payload, {
      onConflict: 'source_document_path'
    })
    .select('*')
    .single();

  if (error) {
    throw makeHttpError(`Admin broadcast upsert failed: ${error.message}`, 500);
  }

  return data;
}

async function getAdminBroadcastBySourcePath(sourceDocumentPath = '') {
  const cleanPath = cleanText(sourceDocumentPath);

  if (!cleanPath) return null;

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('source_document_path', cleanPath)
    .maybeSingle();

  if (error) {
    throw makeHttpError(`Admin broadcast lookup failed: ${error.message}`, 500);
  }

  return data || null;
}

async function deleteAdminBroadcastBySourcePath(sourceDocumentPath = '') {
  const cleanPath = cleanText(sourceDocumentPath);

  if (!cleanPath) return;

  const { error } = await yhuSupabaseAdmin
    .from(TABLE)
    .delete()
    .eq('source_document_path', cleanPath);

  if (error) {
    throw makeHttpError(`Admin broadcast delete failed: ${error.message}`, 500);
  }
}

async function listAdminBroadcastRecords(limit = 100) {
  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .order('sent_at_source', { ascending: false, nullsFirst: false })
    .limit(Math.max(1, Math.min(Number(limit) || 100, 500)));

  if (error) {
    throw makeHttpError(`Admin broadcast list failed: ${error.message}`, 500);
  }

  return (Array.isArray(data) ? data : []).map(mapAdminBroadcastRecord);
}

async function countAdminBroadcastRecords() {
  const { count, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw makeHttpError(`Admin broadcast count failed: ${error.message}`, 500);
  }

  return count || 0;
}

module.exports = {
  TABLE,
  assertTableReady,
  buildAdminBroadcastPayload,
  mapAdminBroadcastRecord,
  upsertAdminBroadcastRecord,
  getAdminBroadcastBySourcePath,
  deleteAdminBroadcastBySourcePath,
  listAdminBroadcastRecords,
  countAdminBroadcastRecords,
  normalizeValue,
  normalizeDate
};
