const { firestore } = require('../../config/firebaseAdmin');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_plaza_records';

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function cleanLower(value, fallback = '') {
  return cleanText(value, fallback).toLowerCase();
}

function toIso(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();

  if (typeof value === 'object') {
    if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
    if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
  }

  return cleanText(value);
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

function normalizeDecision(value = '') {
  const raw = cleanLower(value);

  if (raw === 'approve' || raw === 'approved') return 'approved';
  if (raw === 'reject' || raw === 'rejected' || raw === 'deny' || raw === 'denied') return 'rejected';
  if (raw === 'waitlist' || raw === 'waitlisted') return 'waitlisted';

  return '';
}

function statusLabelFromDecision(value = '') {
  const decision = normalizeDecision(value);

  if (decision === 'approved') return 'Approved';
  if (decision === 'rejected') return 'Rejected';
  if (decision === 'waitlisted') return 'Waitlisted';

  return 'Under Review';
}

function statusKeyFromLabel(value = '') {
  const raw = cleanLower(value);

  if (raw === 'approved') return 'approved';
  if (raw === 'rejected') return 'rejected';
  if (raw === 'waitlisted') return 'waitlisted';
  if (raw === 'under review' || raw === 'under_review' || raw === 'pending_review' || raw === 'pending') return 'pending_review';

  return raw || 'pending_review';
}

function getRowData(row = {}) {
  return row.data && typeof row.data === 'object' ? row.data : {};
}

function getRowPublicMeta(row = {}) {
  return row.public_meta && typeof row.public_meta === 'object' ? row.public_meta : {};
}

function getRowPrivateMeta(row = {}) {
  return row.private_meta && typeof row.private_meta === 'object' ? row.private_meta : {};
}

async function getRawPatronApplication(applicationId = '') {
  const cleanId = cleanText(applicationId);

  if (!cleanId) return null;

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('record_type', 'patron_application')
    .eq('source_document_id', cleanId)
    .maybeSingle();

  if (error) {
    throw makeHttpError(`Patron application lookup failed: ${error.message}`, 500);
  }

  return data || null;
}

function mapPatronApplicationToAdminApplication(row = {}) {
  const data = getRowData(row);
  const pub = getRowPublicMeta(row);
  const priv = getRowPrivateMeta(row);

  const id = cleanText(row.source_document_id || data.id || row.id);
  const statusKey = statusKeyFromLabel(data.status || row.status || data.reviewStatus || row.review_status);
  const status = statusLabelFromDecision(statusKey);

  const name = cleanText(
    data.fullName ||
    data.name ||
    pub.name ||
    'Unknown Patron Applicant'
  );

  const email = cleanText(data.email || priv.email || '').toLowerCase();

  return {
    id,
    name,
    username: cleanText(data.username || '').replace(/^@+/, ''),
    email,
    goal: cleanText(data.plazaPlan || data.reason || data.whyYou || 'Wants to become a Plaza Patron / Leader'),
    background: cleanText(
      data.leadershipExperience ||
      [
        data.preferredRole,
        data.region,
        data.baseCity,
        data.country
      ].filter(Boolean).join(' • ')
    ),
    recommendedDivision: 'Plazas',
    status,
    aiScore: Number(data.aiScore || 0),
    country: cleanText(data.country || ''),
    locationCountry: cleanText(data.country || ''),
    skills: safeArray(data.tags || row.tags),
    networkValue: cleanText(data.whyYou || data.plazaPlan || ''),
    source: cleanText(data.source || 'Plaza Patron Application'),
    submittedAt: toIso(data.submittedAt || data.createdAt || row.created_at_source || row.created_at),
    notes: safeArray(data.notes),
    applicationType: 'plaza-patron-leader',
    reviewLane: 'Plaza Patron / Leader',

    userId: cleanText(data.userId || data.firebaseUid || row.owner_user_id || ''),
    firebaseUid: cleanText(data.firebaseUid || data.userId || row.owner_user_id || ''),
    regionId: cleanText(data.regionId || ''),
    region: cleanText(data.region || ''),
    continent: cleanText(data.continent || ''),
    network: cleanText(data.network || ''),
    preferredRole: cleanText(data.preferredRole || 'Regional Patron'),
    baseCity: cleanText(data.baseCity || ''),
    communicationHandle: cleanText(data.communicationHandle || ''),
    leadershipExperience: cleanText(data.leadershipExperience || ''),
    plazaPlan: cleanText(data.plazaPlan || ''),
    meetupPlan: cleanText(data.meetupPlan || ''),
    proofLink: cleanText(data.proofLink || ''),
    whyYou: cleanText(data.whyYou || ''),
    reviewedAt: toIso(data.reviewedAt || ''),
    reviewedBy: cleanText(data.reviewedBy || ''),
    sourceRecordType: 'patron_application',
    sourceDatabase: 'supabase'
  };
}

async function listAdminPatronApplications(limit = 250) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 250), 500));

  const { data, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('record_type', 'patron_application')
    .order('created_at_source', { ascending: false, nullsFirst: false })
    .limit(safeLimit);

  if (error) {
    throw makeHttpError(`Patron applications list failed: ${error.message}`, 500);
  }

  return (Array.isArray(data) ? data : []).map(mapPatronApplicationToAdminApplication);
}

async function upsertPatronApplicationSmoke(row = {}) {
  const appId = cleanText(row.source_document_id || row.id);

  if (!appId) {
    throw makeHttpError('Smoke patron application id is required.', 400);
  }

  const existing = await getRawPatronApplication(appId);
  const now = nowIso();

  const data = {
    id: appId,
    userId: cleanText(row.userId || row.owner_user_id || ''),
    firebaseUid: cleanText(row.firebaseUid || row.userId || row.owner_user_id || ''),
    email: cleanText(row.email || '').toLowerCase(),
    fullName: cleanText(row.fullName || row.name || 'Patron Smoke User'),
    name: cleanText(row.name || row.fullName || 'Patron Smoke User'),
    username: cleanText(row.username || ''),
    regionId: cleanText(row.regionId || 'global-plaza'),
    region: cleanText(row.region || 'Global Plaza'),
    preferredRole: cleanText(row.preferredRole || 'Regional Patron'),
    baseCity: cleanText(row.baseCity || 'Smoke City'),
    country: cleanText(row.country || 'Smoke Country'),
    communicationHandle: cleanText(row.communicationHandle || '@smoke'),
    leadershipExperience: cleanText(row.leadershipExperience || 'Temporary smoke leadership experience.'),
    plazaPlan: cleanText(row.plazaPlan || 'Temporary smoke Plaza plan.'),
    meetupPlan: cleanText(row.meetupPlan || 'Temporary smoke meetup plan.'),
    proofLink: cleanText(row.proofLink || 'https://example.com'),
    whyYou: cleanText(row.whyYou || 'Temporary smoke reason.'),
    status: cleanText(row.status || 'pending_review'),
    reviewStatus: cleanText(row.reviewStatus || row.status || 'pending_review'),
    applicationType: 'plaza-patron-leader',
    reviewLane: 'Plaza Patron / Leader',
    source: 'Plaza Patron Application',
    tags: ['plaza-patron', 'migration-smoke'],
    notes: ['Temporary admin Patron review smoke row.'],
    submittedAt: cleanText(row.submittedAt || now),
    createdAt: cleanText(row.createdAt || now),
    updatedAt: cleanText(row.updatedAt || now)
  };

  const payload = {
    record_type: 'patron_application',
    source_collection_path: 'plazaPatronApplications',
    source_document_id: appId,
    source_document_path: `plazaPatronApplications/${appId}`,
    owner_user_id: cleanText(data.userId || data.firebaseUid),
    target_user_id: '',
    room_id: '',
    status: statusKeyFromLabel(data.status),
    review_status: statusKeyFromLabel(data.reviewStatus),
    title: `Patron application: ${data.fullName}`,
    summary: cleanText(data.whyYou || data.plazaPlan || '').slice(0, 600),
    body: cleanText(data.whyYou || data.plazaPlan || ''),
    region: cleanText(data.region),
    category: 'patron_application',
    tags: data.tags,
    public_meta: {
      name: data.fullName,
      status: data.status,
      reviewedAt: ''
    },
    private_meta: {
      email: data.email,
      firebaseUid: data.firebaseUid,
      reviewedBy: ''
    },
    data,
    created_at_source: data.createdAt,
    updated_at_source: data.updatedAt
  };

  if (existing?.id) {
    const { data: updated, error } = await yhuSupabaseAdmin
      .from(TABLE)
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw makeHttpError(`Smoke patron application update failed: ${error.message}`, 500);
    return mapPatronApplicationToAdminApplication(updated);
  }

  const { data: inserted, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw makeHttpError(`Smoke patron application insert failed: ${error.message}`, 500);
  return mapPatronApplicationToAdminApplication(inserted);
}

async function updateSupabasePatronApplication(row = {}, patch = {}) {
  const data = getRowData(row);
  const pub = getRowPublicMeta(row);
  const priv = getRowPrivateMeta(row);

  const now = nowIso();
  const nextData = {
    ...data,
    ...patch,
    updatedAt: now
  };

  const topStatus = statusKeyFromLabel(nextData.status || nextData.reviewStatus || row.status);

  const { data: updated, error } = await yhuSupabaseAdmin
    .from(TABLE)
    .update({
      status: topStatus,
      review_status: topStatus,
      title: cleanText(nextData.title || `Patron application: ${nextData.fullName || nextData.name || row.source_document_id}`),
      summary: cleanText(nextData.whyYou || nextData.reason || nextData.plazaPlan || row.summary || '').slice(0, 600),
      body: cleanText(nextData.whyYou || nextData.reason || row.body || ''),
      public_meta: {
        ...pub,
        name: cleanText(nextData.fullName || nextData.name || pub.name || ''),
        status: cleanText(nextData.status || ''),
        reviewedAt: cleanText(nextData.reviewedAt || '')
      },
      private_meta: {
        ...priv,
        email: cleanText(nextData.email || priv.email || '').toLowerCase(),
        firebaseUid: cleanText(nextData.firebaseUid || nextData.userId || priv.firebaseUid || ''),
        reviewedBy: cleanText(nextData.reviewedBy || '')
      },
      data: nextData,
      updated_at_source: now
    })
    .eq('id', row.id)
    .select('*')
    .single();

  if (error) {
    throw makeHttpError(`Patron application update failed: ${error.message}`, 500);
  }

  return updated;
}

async function syncUserPatronApplication(application = {}, decision = '', adminName = 'admin') {
  const userId = cleanText(application.userId || application.firebaseUid);
  if (!userId) return null;

  const decisionKey = normalizeDecision(decision);
  const approved = decisionKey === 'approved';
  const rejected = decisionKey === 'rejected';
  const waitlisted = decisionKey === 'waitlisted';
  const now = nowIso();

  const userRef = firestore.collection('users').doc(userId);
  const userSnap = await userRef.get();
  const currentUser = userSnap.exists ? (userSnap.data() || {}) : {};

  const nextApplication = {
    ...(currentUser.plazaPatronApplication && typeof currentUser.plazaPatronApplication === 'object'
      ? currentUser.plazaPatronApplication
      : {}),
    ...application,
    id: cleanText(application.id),
    status: statusLabelFromDecision(decisionKey),
    reviewStatus: statusLabelFromDecision(decisionKey),
    reviewedAt: now,
    reviewedBy: cleanText(adminName || 'admin'),
    updatedAt: now,
    notes: [
      ...safeArray(application.notes),
      `Admin marked Patron application as ${statusLabelFromDecision(decisionKey)}.`
    ].slice(-20)
  };

  const updatePayload = {
    plazaPatronApplication: nextApplication,
    plazaPatronApplicationStatus: statusLabelFromDecision(decisionKey),
    plazaPatronStatus: decisionKey,
    hasPlazaPatronRole: approved,
    hasPlazaAccess: approved ? true : currentUser.hasPlazaAccess === true,
    plazaAccessStatus: approved ? 'approved' : currentUser.plazaAccessStatus || currentUser.plazaMembershipStatus || '',
    plazaMembershipStatus: approved ? 'approved' : currentUser.plazaMembershipStatus || '',
    updatedAt: now
  };

  if (approved) {
    updatePayload.plazaPatronApprovedAt = now;
    updatePayload.plazaPatronRejectedAt = '';
    updatePayload.plazaPatronWaitlistedAt = '';
    updatePayload.plazaPatronRole = cleanText(application.preferredRole || 'Regional Patron');
    updatePayload.plazaPatronRegionId = cleanText(application.regionId || '');
    updatePayload.plazaPatronRegion = cleanText(application.region || '');
    updatePayload.plazaPatronPrivileges = [
      'patron-desk',
      'patron-announcements',
      'patron-recommendations',
      'patron-intro-outcomes',
      'patron-routed-requests'
    ];
  }

  if (rejected) {
    updatePayload.plazaPatronRejectedAt = now;
    updatePayload.plazaPatronApprovedAt = '';
    updatePayload.plazaPatronWaitlistedAt = '';
    updatePayload.plazaPatronPrivileges = [];
  }

  if (waitlisted) {
    updatePayload.plazaPatronWaitlistedAt = now;
    updatePayload.plazaPatronApprovedAt = '';
    updatePayload.plazaPatronRejectedAt = '';
    updatePayload.plazaPatronPrivileges = [];
  }

  await userRef.set(updatePayload, { merge: true });

  return {
    userId,
    updatePayload
  };
}

async function reviewPatronApplication(applicationId = '', decision = '', adminName = 'admin') {
  const cleanId = cleanText(applicationId);
  const decisionKey = normalizeDecision(decision);

  if (!cleanId || !decisionKey) {
    throw makeHttpError('Invalid Patron application review request.', 400);
  }

  const row = await getRawPatronApplication(cleanId);

  if (!row) {
    return {
      handled: false
    };
  }

  const currentApp = mapPatronApplicationToAdminApplication(row);
  const statusLabel = statusLabelFromDecision(decisionKey);
  const now = nowIso();

  const updatedRow = await updateSupabasePatronApplication(row, {
    id: currentApp.id,
    userId: currentApp.userId,
    firebaseUid: currentApp.firebaseUid,
    email: currentApp.email,
    fullName: currentApp.name,
    name: currentApp.name,
    username: currentApp.username,
    regionId: currentApp.regionId,
    region: currentApp.region,
    continent: currentApp.continent,
    network: currentApp.network,
    preferredRole: currentApp.preferredRole,
    baseCity: currentApp.baseCity,
    communicationHandle: currentApp.communicationHandle,
    leadershipExperience: currentApp.leadershipExperience,
    plazaPlan: currentApp.plazaPlan,
    meetupPlan: currentApp.meetupPlan,
    proofLink: currentApp.proofLink,
    whyYou: currentApp.whyYou,
    status: statusLabel,
    reviewStatus: statusLabel,
    reviewedAt: now,
    reviewedBy: cleanText(adminName || 'admin')
  });

  const updatedApplication = mapPatronApplicationToAdminApplication(updatedRow);
  const userSync = await syncUserPatronApplication(updatedApplication, decisionKey, adminName);

  return {
    handled: true,
    application: updatedApplication,
    userSync
  };
}

async function deletePatronApplication(applicationId = '') {
  const cleanId = cleanText(applicationId);
  if (!cleanId) return;

  const { error } = await yhuSupabaseAdmin
    .from(TABLE)
    .delete()
    .eq('record_type', 'patron_application')
    .eq('source_document_id', cleanId);

  if (error) throw makeHttpError(`Patron application delete failed: ${error.message}`, 500);
}

module.exports = {
  TABLE,
  getRawPatronApplication,
  mapPatronApplicationToAdminApplication,
  listAdminPatronApplications,
  upsertPatronApplicationSmoke,
  reviewPatronApplication,
  deletePatronApplication,
  normalizeDecision,
  statusLabelFromDecision
};
