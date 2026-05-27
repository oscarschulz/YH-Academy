const crypto = require('crypto');

const YHU_FIREBASE_PROJECT = 'yh-academy';

let cachedClient = null;
let missingEnvWarningShown = false;

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return null;
}

function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const supabaseUrl = cleanText(process.env.YHU_SUPABASE_URL);
  const supabaseServiceRoleKey = cleanText(process.env.YHU_SUPABASE_SERVICE_ROLE_KEY);

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (!missingEnvWarningShown) {
      console.warn('[YHU Supabase Mirror] Missing YHU Supabase env values. Mirror writes skipped.');
      missingEnvWarningShown = true;
    }
    return null;
  }

  const { createClient } = require('@supabase/supabase-js');

  cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return cachedClient;
}

function toIso(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }

  return null;
}

function normalizeJson(value) {
  if (value === undefined || value === null) return null;

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }

  if (typeof value === 'object') {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = normalizeJson(child);
    }
    return output;
  }

  return value;
}

function hashData(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data || {})).digest('hex');
}

function isFirebaseQuotaError(error) {
  const text = [
    error && error.code,
    error && error.message,
    error && error.details
  ].map((value) => cleanText(value).toLowerCase()).join(' ');

  return text.includes('resource_exhausted') ||
    text.includes('quota exceeded') ||
    text.includes('code 8') ||
    text.includes('8 resource');
}

function buildUserRow(firebaseDocumentId, data = {}, context = {}) {
  const raw = normalizeJson({ ...data, yhuMirrorContext: context }) || {};
  const academyProfile = raw.academyProfile && typeof raw.academyProfile === 'object' ? raw.academyProfile : {};
  const academyApplication = raw.academyApplication && typeof raw.academyApplication === 'object' ? raw.academyApplication : {};

  const email = cleanText(firstNonEmpty(
    raw.email,
    raw.emailLower,
    raw.userEmail,
    raw['e-mail'],
    academyApplication.email,
    academyApplication['e-mail']
  ) || '').toLowerCase();

  const fullName = firstNonEmpty(
    raw.fullName,
    raw.name,
    raw.displayName,
    academyProfile.fullName,
    academyProfile.displayName,
    academyApplication.fullName,
    email,
    firebaseDocumentId
  );

  return {
    firebase_project: YHU_FIREBASE_PROJECT,
    firebase_collection: 'users',
    firebase_document_id: cleanText(firebaseDocumentId),

    email,
    phone: firstNonEmpty(raw.phone, raw.phoneNumber, raw.mobile, academyApplication.phone, academyApplication.phoneNumber),
    telegram_username: firstNonEmpty(raw.telegramUsername, raw.telegram_username, raw.telegram, raw.telegramHandle, academyApplication.telegramUsername),
    username: firstNonEmpty(raw.username, academyProfile.username, raw.handle),
    full_name: fullName,
    display_name: firstNonEmpty(raw.displayName, raw.name, academyProfile.displayName, academyProfile.fullName, fullName),
    role_label: firstNonEmpty(raw.roleLabel, academyProfile.roleLabel, raw.role, 'YH Universe User'),

    account_status: firstNonEmpty(raw.accountStatus, raw.status, 'active'),
    division: firstNonEmpty(raw.division, raw.sourceDivision, academyApplication.division, 'YH Universe'),
    country: firstNonEmpty(raw.country, academyApplication.country),
    city: firstNonEmpty(raw.city, academyApplication.city),
    plan: firstNonEmpty(raw.plan, raw.tier, academyApplication.tier),

    is_deleted: Boolean(raw.isDeleted || raw.deleted),

    created_at_source: toIso(raw.createdAt),
    updated_at_source: toIso(raw.updatedAt),
    last_seen_at_source: toIso(raw.lastSeenAt || raw.lastActiveAt),

    raw_data: raw,
    data_hash: hashData(raw),
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function buildFederationRequestRow(firebaseDocumentId, data = {}, context = {}) {
  const raw = normalizeJson({ ...data, yhuMirrorContext: context }) || {};
  const requestedContact = raw.requestedContact && typeof raw.requestedContact === 'object' ? raw.requestedContact : {};
  const opportunitySnapshot = raw.opportunitySnapshot && typeof raw.opportunitySnapshot === 'object' ? raw.opportunitySnapshot : {};

  return {
    firebase_project: YHU_FIREBASE_PROJECT,
    firebase_collection: 'federationConnectionRequests',
    firebase_document_id: cleanText(firebaseDocumentId),

    requester_uid: firstNonEmpty(raw.requesterUid, raw.ownerUid, raw.userId),
    requester_name: firstNonEmpty(raw.requesterName, raw.fullName, raw.name),
    requester_email: cleanText(firstNonEmpty(raw.requesterEmail, raw.email) || '').toLowerCase(),

    requested_contact_name: firstNonEmpty(requestedContact.contactName, requestedContact.name, opportunitySnapshot.contactName, raw.contactName),
    requested_company_name: firstNonEmpty(requestedContact.companyName, requestedContact.companyLabel, opportunitySnapshot.companyLabel, raw.companyName),
    requested_company_website: firstNonEmpty(requestedContact.companyWebsite, raw.companyWebsite),
    requested_contact_role: firstNonEmpty(requestedContact.contactRole, opportunitySnapshot.contactRole, raw.contactRole),
    requested_contact_type: firstNonEmpty(requestedContact.contactType, opportunitySnapshot.contactType, raw.contactType),
    requested_tier: firstNonEmpty(requestedContact.requestedTier, raw.requestedTier, raw.tier),

    source_division: firstNonEmpty(raw.sourceDivision, requestedContact.sourceDivision, opportunitySnapshot.sourceDivision, 'federation'),
    source_feature: firstNonEmpty(raw.sourceFeature, 'connect'),
    source_method: firstNonEmpty(raw.sourceMethod, requestedContact.sourceMethod, opportunitySnapshot.sourceMethod),
    request_mode: firstNonEmpty(raw.requestMode),
    request_reason: firstNonEmpty(raw.requestReason, raw.reason, raw.summary),
    intended_use: firstNonEmpty(raw.intendedUse, raw['Intended Use']),

    status: firstNonEmpty(raw.status, 'new'),
    admin_status: firstNonEmpty(raw.adminStatus),
    priority: firstNonEmpty(raw.priority, requestedContact.priority, 'Medium'),
    urgency: firstNonEmpty(raw.urgency),
    budget_range: firstNonEmpty(raw.budgetRange),
    commission_status: firstNonEmpty(raw.commissionStatus),
    payout_status: firstNonEmpty(raw.payoutStatus),

    country: firstNonEmpty(requestedContact.country, opportunitySnapshot.country, raw.country),
    city: firstNonEmpty(requestedContact.city, opportunitySnapshot.city, raw.city),

    created_at_source: toIso(raw.createdAt),
    updated_at_source: toIso(raw.updatedAt),
    admin_updated_at_source: toIso(raw.adminUpdatedAt),

    raw_data: raw,
    data_hash: hashData(raw),
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function upsertRow(tableName, row) {
  const client = getSupabaseClient();

  if (!client) {
    return { ok: false, skipped: true, reason: 'missing_supabase_env' };
  }

  const { data, error } = await client
    .from(tableName)
    .upsert(row, {
      onConflict: 'firebase_project,firebase_collection,firebase_document_id'
    })
    .select('id')
    .limit(1);

  if (error) {
    console.error('[YHU Supabase Mirror] Upsert failed:', tableName, error.message);
    throw error;
  }

  return {
    ok: true,
    tableName,
    id: data && data[0] ? data[0].id : null
  };
}

async function mirrorUser(firebaseDocumentId, data = {}, context = {}) {
  const cleanId = cleanText(firebaseDocumentId || data.id || data.uid || data.firebaseUid);

  if (!cleanId) {
    return { ok: false, skipped: true, reason: 'missing_user_id' };
  }

  return upsertRow('yhu_users', buildUserRow(cleanId, data, context));
}

async function mirrorFederationRequest(firebaseDocumentId, data = {}, context = {}) {
  const cleanId = cleanText(firebaseDocumentId || data.id || data.requestId);

  if (!cleanId) {
    return { ok: false, skipped: true, reason: 'missing_request_id' };
  }

  return upsertRow('yhu_federation_requests', buildFederationRequestRow(cleanId, data, context));
}

module.exports = {
  isFirebaseQuotaError,
  mirrorUser,
  mirrorFederationRequest,
  buildUserRow,
  buildFederationRequestRow
};
