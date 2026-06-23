const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_verified_badge_records';

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function cleanDivision(value = '') {
  const division = cleanText(value).toLowerCase();

  if (division === 'academy' || division === 'federation') {
    return division;
  }

  return division || 'academy';
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeDate(value) {
  if (!value) return null;

  if (value instanceof Date) return value.toISOString();

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

  const text = cleanText(value);

  if (!text) return null;

  const date = new Date(text);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function makeHttpError(message = 'Request failed.', statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function inferBadgeCode(division = '', badge = {}) {
  const explicit = cleanText(badge.code || badge.badgeCode);

  if (explicit) return explicit;

  return cleanDivision(division) === 'federation' ? 'YHF' : 'YHA';
}

function inferBadgeAsset(division = '', badge = {}) {
  const explicit = cleanText(badge.asset || badge.badgeAsset);

  if (explicit) return explicit;

  return cleanDivision(division) === 'federation'
    ? '/images/yhf%20badge.png'
    : '/images/yha%20badge.png';
}

function buildVerifiedBadgePayload({
  userId = '',
  userEmail = '',
  userName = '',
  division = '',
  badge = {},
  sourceDocumentPath = ''
}) {
  const cleanUserId = cleanText(userId);
  const cleanBadge = normalizeValue(badge || {});
  const cleanDiv = cleanDivision(division || cleanBadge.division || cleanBadge.badgeDivision);
  const badgeCode = inferBadgeCode(cleanDiv, cleanBadge);
  const active = cleanBadge.active === true;

  const status = cleanText(
    cleanBadge.status ||
    (active ? 'active' : cleanBadge.paymentStatus || 'inactive')
  );

  const paymentStatus = cleanText(cleanBadge.paymentStatus || status);

  return {
    user_id: cleanUserId,
    user_email: cleanText(userEmail || cleanBadge.userEmail || cleanBadge.email),
    user_name: cleanText(userName || cleanBadge.userName || cleanBadge.name),
    division: cleanDiv,
    badge_code: badgeCode,
    badge_asset: inferBadgeAsset(cleanDiv, cleanBadge),
    active,
    status,
    payment_status: paymentStatus,
    provider: cleanText(cleanBadge.provider),
    payment_method: cleanText(cleanBadge.paymentMethod),
    provider_status: cleanText(cleanBadge.providerStatus),
    provider_payment_id: cleanText(cleanBadge.providerPaymentId),
    provider_subscription_id: cleanText(cleanBadge.providerSubscriptionId),
    provider_cancellation_id: cleanText(cleanBadge.providerCancellationId),
    payment_ledger_id: cleanText(cleanBadge.paymentLedgerId),
    billing_plan: cleanText(cleanBadge.billingPlan),
    billing_label: cleanText(cleanBadge.billingLabel || cleanBadge.publicBillingLabel),
    billing_interval: cleanText(cleanBadge.interval || cleanBadge.billingInterval),
    currency: cleanText(cleanBadge.currency || 'USD').toUpperCase() || 'USD',
    amount: toNumber(cleanBadge.amount, 0),
    amount_monthly: toNumber(cleanBadge.amountMonthly || cleanBadge.amount, 0),
    lifetime_access: cleanBadge.lifetimeAccess === true,
    activated_at_source: normalizeDate(cleanBadge.activatedAt),
    approved_at_source: normalizeDate(cleanBadge.approvedAt),
    expires_at_source: normalizeDate(cleanBadge.expiresAt),
    unsubscribed_at_source: normalizeDate(cleanBadge.unsubscribedAt),
    cancelled_at_source: normalizeDate(cleanBadge.cancelledAt),
    deactivated_at_source: normalizeDate(cleanBadge.deactivatedAt),
    updated_at_source: normalizeDate(cleanBadge.updatedAt),
    source_document_path: cleanText(sourceDocumentPath || `users/${cleanUserId}/verificationBadges/${cleanDiv}`),
    public_meta: {
      division: cleanDiv,
      badgeCode,
      active,
      status,
      paymentStatus
    },
    private_meta: {
      userId: cleanUserId,
      source: 'firestore_user_verificationBadges',
      sourceDocumentPath: cleanText(sourceDocumentPath || `users/${cleanUserId}/verificationBadges/${cleanDiv}`)
    },
    data: {
      ...cleanBadge,
      userId: cleanUserId,
      userEmail: cleanText(userEmail || cleanBadge.userEmail || cleanBadge.email),
      userName: cleanText(userName || cleanBadge.userName || cleanBadge.name),
      division: cleanDiv,
      code: badgeCode,
      asset: inferBadgeAsset(cleanDiv, cleanBadge),
      sourceDatabase: 'supabase',
      migratedFromFirestore: true,
      migratedAt: new Date().toISOString()
    }
  };
}

function mapVerifiedBadgeRecord(row = {}) {
  const data = row?.data && typeof row.data === 'object' ? row.data : {};

  return {
    ...data,
    id: row.id,
    userId: row.user_id || data.userId || '',
    userEmail: row.user_email || data.userEmail || '',
    userName: row.user_name || data.userName || '',
    division: row.division || data.division || '',
    code: row.badge_code || data.code || '',
    asset: row.badge_asset || data.asset || '',
    active: row.active === true,
    status: row.status || data.status || '',
    paymentStatus: row.payment_status || data.paymentStatus || '',
    provider: row.provider || data.provider || '',
    paymentMethod: row.payment_method || data.paymentMethod || '',
    providerStatus: row.provider_status || data.providerStatus || '',
    providerPaymentId: row.provider_payment_id || data.providerPaymentId || '',
    providerSubscriptionId: row.provider_subscription_id || data.providerSubscriptionId || '',
    providerCancellationId: row.provider_cancellation_id || data.providerCancellationId || '',
    paymentLedgerId: row.payment_ledger_id || data.paymentLedgerId || '',
    billingPlan: row.billing_plan || data.billingPlan || '',
    billingLabel: row.billing_label || data.billingLabel || '',
    interval: row.billing_interval || data.interval || data.billingInterval || '',
    currency: row.currency || data.currency || 'USD',
    amount: Number(row.amount || data.amount || 0),
    amountMonthly: Number(row.amount_monthly || data.amountMonthly || 0),
    lifetimeAccess: row.lifetime_access === true,
    activatedAt: row.activated_at_source || data.activatedAt || '',
    approvedAt: row.approved_at_source || data.approvedAt || '',
    expiresAt: row.expires_at_source || data.expiresAt || '',
    unsubscribedAt: row.unsubscribed_at_source || data.unsubscribedAt || '',
    cancelledAt: row.cancelled_at_source || data.cancelledAt || '',
    deactivatedAt: row.deactivated_at_source || data.deactivatedAt || '',
    updatedAt: row.updated_at_source || data.updatedAt || row.updated_at || '',
    sourceDatabase: 'supabase',
    supabaseRecordId: row.id
  };
}

async function assertTableReady() {
  const { error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('id,user_id,division,badge_code,status,data')
    .limit(1);

  if (error) {
    throw makeHttpError(`Supabase table ${TABLE} is not ready. Run supabase-yhu-verified-badge-records.sql first. ${error.message || error.details || ''}`, 500);
  }

  return true;
}

async function upsertVerifiedBadgeRecord(payload = {}) {
  const userId = cleanText(payload.user_id);
  const division = cleanDivision(payload.division);

  if (!userId || !division) {
    throw makeHttpError('user_id and division are required.', 400);
  }

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .upsert(
      {
        ...payload,
        user_id: userId,
        division
      },
      {
        onConflict: 'user_id,division'
      }
    )
    .select('*')
    .single();

  if (error) {
    throw makeHttpError(`Verified badge upsert failed: ${error.message}`, 500);
  }

  return data;
}

async function getVerifiedBadgeRecord(userId = '', division = '') {
  const cleanUserId = cleanText(userId);
  const cleanDiv = cleanDivision(division);

  if (!cleanUserId || !cleanDiv) return null;

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('user_id', cleanUserId)
    .eq('division', cleanDiv)
    .maybeSingle();

  if (error) {
    throw makeHttpError(`Verified badge lookup failed: ${error.message}`, 500);
  }

  return data || null;
}

async function deleteVerifiedBadgeRecord(userId = '', division = '') {
  const cleanUserId = cleanText(userId);
  const cleanDiv = cleanDivision(division);

  if (!cleanUserId || !cleanDiv) return;

  const { error } = await yhuSupabaseAdmin
    .from(TABLE)
    .delete()
    .eq('user_id', cleanUserId)
    .eq('division', cleanDiv);

  if (error) {
    throw makeHttpError(`Verified badge delete failed: ${error.message}`, 500);
  }
}

async function listVerifiedBadgesForUser(userId = '') {
  const cleanUserId = cleanText(userId);

  if (!cleanUserId) return [];

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('user_id', cleanUserId)
    .order('division', { ascending: true });

  if (error) {
    throw makeHttpError(`Verified badge list failed: ${error.message}`, 500);
  }

  return (Array.isArray(data) ? data : []).map(mapVerifiedBadgeRecord);
}

async function listVerifiedBadgeRecords(limit = 1000) {
  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .order('updated_at_source', { ascending: false, nullsFirst: false })
    .limit(Math.max(1, Math.min(Number(limit) || 1000, 5000)));

  if (error) {
    throw makeHttpError(`Verified badge records list failed: ${error.message}`, 500);
  }

  return (Array.isArray(data) ? data : []).map(mapVerifiedBadgeRecord);
}

async function countVerifiedBadgeRecords() {
  const { count, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw makeHttpError(`Verified badge count failed: ${error.message}`, 500);
  }

  return count || 0;
}

module.exports = {
  TABLE,
  assertTableReady,
  buildVerifiedBadgePayload,
  mapVerifiedBadgeRecord,
  upsertVerifiedBadgeRecord,
  getVerifiedBadgeRecord,
  deleteVerifiedBadgeRecord,
  listVerifiedBadgesForUser,
  listVerifiedBadgeRecords,
  countVerifiedBadgeRecords,
  normalizeValue,
  normalizeDate
};
