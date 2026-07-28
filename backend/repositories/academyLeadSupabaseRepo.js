const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_academy_lead_records';

const COLLECTION_TO_TYPE = {
  academyLeadMissions: 'lead_mission',
  academyLeadDeals: 'lead_deal',
  academyLeadPayouts: 'lead_payout',
  leadMissionOperators: 'lead_operator'
};

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function cleanLower(value, fallback = '') {
  return cleanText(value, fallback).toLowerCase();
}

function cleanUpper(value, fallback = '') {
  return cleanText(value, fallback).toUpperCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function getCollectionRoot(sourceCollectionPath = '') {
  const clean = cleanText(sourceCollectionPath);
  const parts = clean.split('/').filter(Boolean);
  return parts[parts.length - 1] || clean;
}

function getRecordTypeFromCollection(sourceCollectionPath = '') {
  const root = getCollectionRoot(sourceCollectionPath);
  return COLLECTION_TO_TYPE[root] || cleanLower(root || 'lead_record');
}

function getOwnerFromPath(sourceDocumentPath = '') {
  const parts = cleanText(sourceDocumentPath).split('/').filter(Boolean);
  const usersIndex = parts.indexOf('users');

  if (usersIndex >= 0 && parts[usersIndex + 1]) {
    return cleanText(parts[usersIndex + 1]);
  }

  return '';
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

function buildTitle(recordType = '', data = {}, docId = '') {
  if (recordType === 'lead_mission') {
    const company = pickFirst(data, ['companyName', 'companyLabel', 'businessName']);
    const role = pickFirst(data, ['contactRole', 'role']);
    const country = pickFirst(data, ['country']);

    if (company && role) return `${company} • ${role}`;
    if (role && country) return `${role} in ${country}`;
    if (company) return company;
  }

  if (recordType === 'lead_operator') {
    return pickFirst(data, ['fullName', 'name', 'email', 'telegram'], `Lead operator ${docId}`);
  }

  if (recordType === 'lead_deal') {
    return pickFirst(data, ['title', 'dealTitle', 'companyName', 'opportunityTitle'], `Academy lead deal ${docId}`);
  }

  if (recordType === 'lead_payout') {
    return pickFirst(data, ['title', 'payoutTitle', 'opportunityTitle', 'companyName'], `Academy lead payout ${docId}`);
  }

  return pickFirst(data, ['title', 'name', 'companyName'], docId);
}

function buildAcademyLeadPayload({
  recordType = '',
  sourceCollectionPath = '',
  sourceCollectionRoot = '',
  sourceDocumentId = '',
  sourceDocumentPath = '',
  ownerUserId = '',
  data = {}
}) {
  const normalizedData = normalizeValue(data || {});
  const collectionRoot = cleanText(sourceCollectionRoot || getCollectionRoot(sourceCollectionPath));
  const type = cleanText(recordType || getRecordTypeFromCollection(sourceCollectionPath));
  const docId = cleanText(sourceDocumentId || normalizedData.id || normalizedData.uid);
  const docPath = cleanText(sourceDocumentPath || `${sourceCollectionPath}/${docId}`);

  const pathOwner = getOwnerFromPath(docPath);

  const owner =
    cleanText(ownerUserId) ||
    pickFirst(normalizedData, [
      'ownerUid',
      'ownerUserId',
      'userId',
      'firebaseUid',
      'creatorUid',
      'receiverUid',
      'operatorUid'
    ]) ||
    pathOwner ||
    (type === 'lead_operator' ? docId : '');

  const operatorUserId = pickFirst(normalizedData, [
    'operatorUid',
    'operatorUserId',
    'assignedOperatorUid',
    'receiverUid',
    'userId',
    'firebaseUid'
  ], owner);

  const status = normalizeStatus(
    normalizedData.status ||
    normalizedData.taskStatus ||
    normalizedData.payoutStatus ||
    normalizedData.dealStatus ||
    'active'
  );

  const reviewStatus = normalizeStatus(
    normalizedData.reviewStatus ||
    normalizedData.saleReviewStatus ||
    normalizedData.adminStatus ||
    status
  );

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
    normalizedData.updated_at ||
    createdAtSource ||
    nowIso()
  );

  const title = buildTitle(type, normalizedData, docId);

  return {
    record_type: type,
    source_collection_path: cleanText(sourceCollectionPath),
    source_collection_root: collectionRoot,
    source_document_id: docId,
    source_document_path: docPath,
    owner_user_id: owner,
    operator_user_id: operatorUserId,
    status,
    review_status: reviewStatus,
    sale_status: cleanLower(normalizedData.saleStatus || normalizedData.saleReviewStatus || ''),
    payout_status: cleanLower(normalizedData.payoutStatus || ''),
    title,
    company_name: pickFirst(normalizedData, ['companyName', 'companyLabel', 'businessName']),
    contact_name: pickFirst(normalizedData, ['contactName', 'name']),
    contact_role: pickFirst(normalizedData, ['contactRole', 'role']),
    contact_type: pickFirst(normalizedData, ['contactType', 'type', 'category']),
    email: pickFirst(normalizedData, ['email', 'contactEmail']).toLowerCase(),
    phone: pickFirst(normalizedData, ['phone', 'contactPhone']),
    city: pickFirst(normalizedData, ['city']),
    country: pickFirst(normalizedData, ['country']),
    source_division: pickFirst(normalizedData, ['sourceDivision', 'division']),
    pipeline_stage: pickFirst(normalizedData, ['pipelineStage', 'stage']),
    priority: pickFirst(normalizedData, ['priority']),
    currency: cleanUpper(normalizedData.currency || 'USD', 'USD') || 'USD',
    buyer_price_amount: Math.max(0, toNumber(normalizedData.buyerPriceAmount || normalizedData.pricingAmount || 0)),
    seller_price_amount: Math.max(0, toNumber(normalizedData.sellerPriceAmount || normalizedData.operatorPayoutAmount || 0)),
    universe_commission_amount: Math.max(0, toNumber(normalizedData.universeCommissionAmount || normalizedData.platformCommissionAmount || 0)),
    payout_amount: Math.max(0, toNumber(normalizedData.payoutAmount || normalizedData.amount || normalizedData.operatorPayoutAmount || 0)),
    public_meta: {
      source: 'firestore_migration',
      recordType: type,
      title,
      status
    },
    private_meta: {
      originalCollection: sourceCollectionPath,
      originalDocumentId: docId,
      originalDocumentPath: docPath
    },
    data: {
      ...normalizedData,
      id: docId,
      ownerUid: normalizedData.ownerUid || owner,
      ownerUserId: normalizedData.ownerUserId || owner,
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
    .select('id,record_type,source_document_path,source_collection_root,data')
    .limit(1);

  if (error) {
    throw makeHttpError(`Supabase table ${TABLE} is not ready. Run supabase-yhu-academy-lead-records.sql first. ${error.message || error.details || ''}`, 500);
  }

  return true;
}

async function upsertAcademyLeadRecord(payload = {}) {
  const recordType = cleanText(payload.record_type);
  const sourceDocumentPath = cleanText(payload.source_document_path);

  if (!recordType || !sourceDocumentPath) {
    throw makeHttpError('record_type and source_document_path are required.', 400);
  }

  const finalPayload = {
    ...payload,
    source_collection_root: cleanText(payload.source_collection_root || getCollectionRoot(payload.source_collection_path)),
    status: normalizeStatus(payload.status || payload.data?.status || 'active'),
    review_status: normalizeStatus(payload.review_status || payload.data?.reviewStatus || payload.status || 'active')
  };

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .upsert(finalPayload, {
      onConflict: 'record_type,source_document_path'
    })
    .select('*')
    .single();

  if (error) {
    throw makeHttpError(`Academy lead record upsert failed: ${error.message}`, 500);
  }

  return data;
}

async function getAcademyLeadRecord(recordType = '', sourceDocumentPath = '') {
  const cleanType = cleanText(recordType);
  const cleanPath = cleanText(sourceDocumentPath);

  if (!cleanType || !cleanPath) return null;

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('record_type', cleanType)
    .eq('source_document_path', cleanPath)
    .maybeSingle();

  if (error) {
    throw makeHttpError(`Academy lead record lookup failed: ${error.message}`, 500);
  }

  return data || null;
}

/* PATCH: Academy lead-record idempotency and concurrency v2 */
function buildAcademyLeadDeterministicDocumentIdV2(
  ownerUserId = '',
  clientRequestId = '',
  prefix = 'record'
) {
  const cleanOwner =
    cleanText(ownerUserId);

  const cleanRequestId =
    cleanText(clientRequestId)
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        '_'
      )
      .slice(0, 160);

  const cleanPrefix =
    cleanText(prefix || 'record')
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        '_'
      )
      .slice(0, 32) ||
    'record';

  if (
    !cleanOwner ||
    !cleanRequestId
  ) {
    return '';
  }

  return (
    `${cleanPrefix}_` +
    crypto
      .createHash('sha256')
      .update(
        `${cleanOwner}|${cleanRequestId}`
      )
      .digest('hex')
      .slice(0, 40)
  );
}

async function createAcademyLeadRecordOnceV2(
  payload = {}
) {
  const recordType =
    cleanText(
      payload.record_type
    );

  const sourceDocumentPath =
    cleanText(
      payload.source_document_path
    );

  if (
    !recordType ||
    !sourceDocumentPath
  ) {
    throw makeHttpError(
      'record_type and source_document_path are required.',
      400
    );
  }

  const finalPayload = {
    ...payload,

    source_collection_root:
      cleanText(
        payload.source_collection_root ||
        getCollectionRoot(
          payload.source_collection_path
        )
      ),

    status:
      normalizeStatus(
        payload.status ||
        payload.data?.status ||
        'active'
      ),

    review_status:
      normalizeStatus(
        payload.review_status ||
        payload.data?.reviewStatus ||
        payload.status ||
        'active'
      )
  };

  const {
    data,
    error
  } = await yhuSupabaseAdmin
    .from(TABLE)
    .upsert(
      finalPayload,
      {
        onConflict:
          'record_type,source_document_path',

        ignoreDuplicates:
          true
      }
    )
    .select('*')
    .maybeSingle();

  if (error) {
    throw makeHttpError(
      `Academy lead record create failed: ${error.message}`,
      500
    );
  }

  if (data) {
    return {
      record:
        data,

      created:
        true,

      duplicate:
        false
    };
  }

  const existing =
    await getAcademyLeadRecord(
      recordType,
      sourceDocumentPath
    );

  if (!existing) {
    throw makeHttpError(
      'Academy lead record create returned no record.',
      500
    );
  }

  return {
    record:
      existing,

    created:
      false,

    duplicate:
      true
  };
}

async function mutateAcademyLeadRecordV2(
  recordType = '',
  sourceDocumentPath = '',
  mutator,
  {
    expectedUpdatedAt = '',
    maxAttempts = 5
  } = {}
) {
  const cleanType =
    cleanText(recordType);

  const cleanPath =
    cleanText(
      sourceDocumentPath
    );

  if (
    !cleanType ||
    !cleanPath ||
    typeof mutator !==
      'function'
  ) {
    throw makeHttpError(
      'Valid Academy lead record mutation is required.',
      400
    );
  }

  const cleanExpectedUpdatedAt =
    normalizeDate(
      expectedUpdatedAt
    );

  const attempts =
    Math.max(
      1,
      Math.min(
        10,
        Number(maxAttempts) ||
        5
      )
    );

  for (
    let attempt = 0;
    attempt < attempts;
    attempt += 1
  ) {
    const current =
      await getAcademyLeadRecord(
        cleanType,
        cleanPath
      );

    if (!current) {
      throw makeHttpError(
        'Academy lead record not found.',
        404
      );
    }

    const currentData =
      current.data &&
      typeof current.data ===
        'object'
        ? current.data
        : {};

    const currentVersion =
      normalizeDate(
        current.updated_at_source ||
        current.updated_at ||
        currentData.updatedAt
      );

    if (
      attempt === 0 &&
      cleanExpectedUpdatedAt &&
      currentVersion &&
      cleanExpectedUpdatedAt !==
        currentVersion
    ) {
      throw makeHttpError(
        'This record changed after you opened it. Refresh and retry.',
        409
      );
    }

    const patch =
      await mutator(
        {
          ...currentData
        },
        current
      );

    if (
      !patch ||
      typeof patch !==
        'object' ||
      Array.isArray(patch)
    ) {
      throw makeHttpError(
        'Invalid Academy lead record update.',
        500
      );
    }

    if (
      patch.__skipMutation ===
      true
    ) {
      return current;
    }

    const safePatch = {
      ...patch
    };

    delete safePatch
      .__skipMutation;

    const nextVersion =
      nowIso();

    const nextData = {
      ...currentData,
      ...safePatch,

      id:
        current.source_document_id ||
        currentData.id,

      createdAt:
        currentData.createdAt ||
        current.created_at_source ||
        nextVersion,

      updatedAt:
        nextVersion
    };

    const built =
      buildAcademyLeadPayload({
        recordType:
          cleanType,

        sourceCollectionPath:
          current.source_collection_path,

        sourceCollectionRoot:
          current.source_collection_root,

        sourceDocumentId:
          current.source_document_id,

        sourceDocumentPath:
          cleanPath,

        ownerUserId:
          current.owner_user_id,

        data:
          nextData
      });

    const updatePayload = {
      ...built,

      created_at_source:
        current.created_at_source ||
        built.created_at_source,

      updated_at_source:
        nextVersion
    };

    let query =
      yhuSupabaseAdmin
        .from(TABLE)
        .update(
          updatePayload
        )
        .eq(
          'id',
          current.id
        )
        .eq(
          'record_type',
          cleanType
        )
        .eq(
          'source_document_path',
          cleanPath
        );

    query =
      currentVersion
        ? query.eq(
          'updated_at_source',
          currentVersion
        )
        : query.is(
          'updated_at_source',
          null
        );

    const {
      data: saved,
      error
    } = await query
      .select('*')
      .maybeSingle();

    if (error) {
      throw makeHttpError(
        `Academy lead record update failed: ${error.message}`,
        500
      );
    }

    if (saved) {
      return saved;
    }
  }

  throw makeHttpError(
    'This record changed during the request. Refresh and retry.',
    409
  );
}
/* END PATCH: Academy lead-record idempotency and concurrency v2 */

async function deleteAcademyLeadRecord(recordType = '', sourceDocumentPath = '') {
  const cleanType = cleanText(recordType);
  const cleanPath = cleanText(sourceDocumentPath);

  if (!cleanType || !cleanPath) return;

  const { error } = await yhuSupabaseAdmin
    .from(TABLE)
    .delete()
    .eq('record_type', cleanType)
    .eq('source_document_path', cleanPath);

  if (error) {
    throw makeHttpError(`Academy lead record delete failed: ${error.message}`, 500);
  }
}

async function listAcademyLeadRecords(recordType = '', filters = {}) {
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

  if (filters.operatorUserId) {
    query = query.eq('operator_user_id', cleanText(filters.operatorUserId));
  }

  if (filters.status) {
    query = query.eq('status', cleanLower(filters.status));
  }

  if (filters.reviewStatus) {
    query = query.eq('review_status', cleanLower(filters.reviewStatus));
  }

  if (filters.limit) {
    query = query.limit(Math.max(1, Math.min(Number(filters.limit), 1000)));
  }

  const { data, error } = await query;

  if (error) {
    throw makeHttpError(`Academy lead record list failed: ${error.message}`, 500);
  }

  return Array.isArray(data) ? data : [];
}

async function countAcademyLeadRecordsByType() {
  const types = ['lead_mission', 'lead_deal', 'lead_payout', 'lead_operator'];
  const result = {};

  for (const type of types) {
    const { count, error } = await yhuSupabaseAdmin
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('record_type', type);

    if (error) {
      throw makeHttpError(`Academy lead count failed for ${type}: ${error.message}`, 500);
    }

    result[type] = count || 0;
  }

  return result;
}

module.exports = {
  TABLE,
  COLLECTION_TO_TYPE,
  assertTableReady,
  buildAcademyLeadPayload,
  buildAcademyLeadDeterministicDocumentIdV2,
  upsertAcademyLeadRecord,
  createAcademyLeadRecordOnceV2,
  getAcademyLeadRecord,
  mutateAcademyLeadRecordV2,
  deleteAcademyLeadRecord,
  listAcademyLeadRecords,
  countAcademyLeadRecordsByType,
  normalizeValue,
  normalizeDate,
  getOwnerFromPath,
  getCollectionRoot,
  getRecordTypeFromCollection
};
