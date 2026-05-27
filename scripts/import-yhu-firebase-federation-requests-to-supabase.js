#!/usr/bin/env node

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
require('dotenv').config({ path: '.env.supabase.local', override: true });

const crypto = require('crypto');
const { firestore } = require('../config/firebaseAdmin');
const { FieldPath } = require('firebase-admin/firestore');

const FIREBASE_PROJECT = 'yh-academy';
const FIREBASE_COLLECTION = 'federationConnectionRequests';

let cachedSupabaseAdmin = null;

function getSupabaseAdmin() {
  if (cachedSupabaseAdmin) return cachedSupabaseAdmin;

  const mod = require('../config/supabaseAdmin');
  cachedSupabaseAdmin = mod.yhuSupabaseAdmin;

  return cachedSupabaseAdmin;
}

function getArgValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) return fallback;
  return found.slice(prefix.length);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function normalizePositiveInt(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function normalizeBatchSize(value, fallback = 25) {
  const parsed = normalizePositiveInt(value, fallback);
  if (parsed <= 0) return fallback;
  return Math.min(parsed, 100);
}

function normalizeDelayMs(value, fallback = 500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(Math.floor(parsed), 10000);
}

function sleep(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  if (value === undefined) return null;
  if (value === null) return null;

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
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data || {}))
    .digest('hex');
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function cleanLower(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isFirebaseQuotaError(error) {
  const text = [
    error && error.code,
    error && error.message,
    error && error.details
  ].map((value) => String(value || '').toLowerCase()).join(' ');

  return text.includes('resource_exhausted') ||
    text.includes('quota exceeded') ||
    text.includes('code 8') ||
    text.includes('8 resource');
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mapFederationRequest(doc) {
  const data = normalizeJson(doc.data() || {}) || {};
  const requestedContact = asObject(data.requestedContact);
  const opportunitySnapshot = asObject(data.opportunitySnapshot);

  return {
    firebase_project: FIREBASE_PROJECT,
    firebase_collection: FIREBASE_COLLECTION,
    firebase_document_id: doc.id,

    requester_uid: firstNonEmpty(data.requesterUid, data.ownerUid, data.userId),
    requester_name: firstNonEmpty(data.requesterName, data.fullName, data.name),
    requester_email: cleanLower(firstNonEmpty(data.requesterEmail, data.email)),

    requested_contact_name: firstNonEmpty(
      requestedContact.contactName,
      requestedContact.name,
      opportunitySnapshot.contactName,
      data.contactName
    ),
    requested_company_name: firstNonEmpty(
      requestedContact.companyName,
      requestedContact.companyLabel,
      opportunitySnapshot.companyLabel,
      data.companyName
    ),
    requested_company_website: firstNonEmpty(
      requestedContact.companyWebsite,
      data.companyWebsite
    ),
    requested_contact_role: firstNonEmpty(
      requestedContact.contactRole,
      opportunitySnapshot.contactRole,
      data.contactRole
    ),
    requested_contact_type: firstNonEmpty(
      requestedContact.contactType,
      opportunitySnapshot.contactType,
      data.contactType
    ),
    requested_tier: firstNonEmpty(
      requestedContact.requestedTier,
      data.requestedTier,
      data.tier
    ),

    source_division: firstNonEmpty(data.sourceDivision, requestedContact.sourceDivision, opportunitySnapshot.sourceDivision),
    source_feature: firstNonEmpty(data.sourceFeature),
    source_method: firstNonEmpty(data.sourceMethod, requestedContact.sourceMethod, opportunitySnapshot.sourceMethod),
    request_mode: firstNonEmpty(data.requestMode),
    request_reason: firstNonEmpty(data.requestReason, data.reason, data.summary),
    intended_use: firstNonEmpty(data['Intended Use'], data.intendedUse),

    status: firstNonEmpty(data.status, 'new'),
    admin_status: firstNonEmpty(data.adminStatus),
    priority: firstNonEmpty(data.priority, requestedContact.priority, 'Medium'),
    urgency: firstNonEmpty(data.urgency),
    budget_range: firstNonEmpty(data.budgetRange),
    commission_status: firstNonEmpty(data.commissionStatus),
    payout_status: firstNonEmpty(data.payoutStatus),

    country: firstNonEmpty(requestedContact.country, opportunitySnapshot.country, data.country),
    city: firstNonEmpty(requestedContact.city, opportunitySnapshot.city, data.city),

    created_at_source: toIso(data.createdAt),
    updated_at_source: toIso(data.updatedAt),
    admin_updated_at_source: toIso(data.adminUpdatedAt),

    raw_data: data,
    data_hash: hashData(data),
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function resolveStartAfterSnapshot(docId = '') {
  const cleanDocId = String(docId || '').trim();
  if (!cleanDocId) return null;

  const snap = await firestore.collection(FIREBASE_COLLECTION).doc(cleanDocId).get();
  if (snap.exists) return snap;

  console.warn(`[cursor-warning] Document id not found for --start-after=${cleanDocId}. Falling back to string cursor.`);
  return cleanDocId;
}

async function upsertFederationRequest(row) {
  const { error } = await getSupabaseAdmin()
    .from('yhu_federation_requests')
    .upsert(row, {
      onConflict: 'firebase_project,firebase_collection,firebase_document_id',
    });

  if (error) throw error;
}

async function main() {
  const live = hasFlag('live');
  const limit = normalizePositiveInt(getArgValue('limit', '5'), 5);
  const batchSize = normalizeBatchSize(getArgValue('batch-size', '25'), 25);
  const delayMs = normalizeDelayMs(getArgValue('delay-ms', '500'), 500);
  const startAfter = String(getArgValue('start-after', '') || '').trim();

  const totalTarget = limit === 0 ? Number.POSITIVE_INFINITY : limit;

  console.log('YHU Firebase federation requests import started.');
  console.log(`Mode: ${live ? 'LIVE IMPORT' : 'DRY RUN'}`);
  console.log(`Limit: ${limit === 0 ? 'ALL' : limit}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Delay ms: ${delayMs}`);
  console.log(`Start after: ${startAfter || '(none)'}`);

  if (live) {
    getSupabaseAdmin();
  }

  let cursor = startAfter;
  let cursorSnapshot = null;
  let prepared = 0;
  let imported = 0;
  let failed = 0;
  let withRequesterUid = 0;
  let withoutRequesterUid = 0;
  let withRequesterEmail = 0;
  let withoutRequesterEmail = 0;
  let withAdminStatus = 0;
  let withOpportunitySnapshot = 0;
  let quotaStopped = false;
  let lastDocId = cursor;

  if (cursor) {
    try {
      cursorSnapshot = await resolveStartAfterSnapshot(cursor);
    } catch (error) {
      if (isFirebaseQuotaError(error)) {
        quotaStopped = true;
        console.error('[quota-stop] Firebase quota exhausted while resolving start cursor.');
        console.error('[quota-stop] Last successful document id:', lastDocId || '(none)');
      } else {
        throw error;
      }
    }
  }

  while (!quotaStopped && prepared < totalTarget) {
    const remaining = totalTarget === Number.POSITIVE_INFINITY
      ? batchSize
      : Math.min(batchSize, totalTarget - prepared);

    if (remaining <= 0) break;

    let query = firestore
      .collection(FIREBASE_COLLECTION)
      .orderBy(FieldPath.documentId())
      .limit(remaining);

    if (cursorSnapshot) {
      query = query.startAfter(cursorSnapshot);
    }

    let snap;

    try {
      snap = await query.get();
    } catch (error) {
      if (isFirebaseQuotaError(error)) {
        quotaStopped = true;
        console.error('[quota-stop] Firebase quota exhausted while reading federation requests.');
        console.error('[quota-stop] Last successful document id:', lastDocId || '(none)');
        break;
      }

      throw error;
    }

    if (snap.empty) break;

    for (const doc of snap.docs) {
      prepared += 1;
      lastDocId = doc.id;
      cursor = doc.id;
      cursorSnapshot = doc;

      const row = mapFederationRequest(doc);
      const raw = row.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {};

      if (row.requester_uid) withRequesterUid += 1;
      else withoutRequesterUid += 1;

      if (row.requester_email) withRequesterEmail += 1;
      else withoutRequesterEmail += 1;

      if (row.admin_status) withAdminStatus += 1;
      if (raw.opportunitySnapshot && typeof raw.opportunitySnapshot === 'object') withOpportunitySnapshot += 1;

      console.log(
        `[${live ? 'import' : 'dry-run'}] ${doc.id} -> requester=${row.requester_name || row.requester_email || row.requester_uid || 'unknown'} | requested=${row.requested_contact_name || row.requested_company_name || row.requested_contact_role || 'unknown'} | status=${row.status || 'new'} | admin=${row.admin_status || 'none'}`
      );

      if (!live) continue;

      try {
        await upsertFederationRequest(row);
        imported += 1;
      } catch (error) {
        failed += 1;
        console.error(`[failed] ${doc.id}: ${error.message}`);
      }
    }

    if (snap.size < remaining) break;
    if (prepared >= totalTarget) break;

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log('YHU Firebase federation requests import complete.');
  console.log(`Prepared: ${prepared}`);
  console.log(`Imported: ${imported}`);
  console.log(`Failed: ${failed}`);
  console.log(`With requester uid: ${withRequesterUid}`);
  console.log(`Without requester uid: ${withoutRequesterUid}`);
  console.log(`With requester email: ${withRequesterEmail}`);
  console.log(`Without requester email: ${withoutRequesterEmail}`);
  console.log(`With admin status: ${withAdminStatus}`);
  console.log(`With opportunity snapshot: ${withOpportunitySnapshot}`);
  console.log(`Last document id: ${lastDocId || '(none)'}`);
  console.log(`Quota stopped: ${quotaStopped ? 'yes' : 'no'}`);

  if (!live) {
    console.log('Dry run only. To import, run again with --live.');
  }

  if (lastDocId) {
    console.log(`Resume command example: node scripts/import-yhu-firebase-federation-requests-to-supabase.js --start-after=${lastDocId} --limit=25`);
  }

  if (failed > 0 || quotaStopped) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Fatal import error:', error.message);
  process.exit(1);
});