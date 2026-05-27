#!/usr/bin/env node

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
require('dotenv').config({ path: '.env.supabase.local', override: true });

const crypto = require('crypto');
const { firestore } = require('../config/firebaseAdmin');
const { yhuSupabaseAdmin } = require('../config/supabaseAdmin');

const FIREBASE_PROJECT = 'yh-academy';
const FIREBASE_COLLECTION = 'federationConnectionRequests';

function getArgValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (!found) return fallback;
  return found.slice(prefix.length);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 1;
  return parsed;
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

function mapFederationRequest(doc) {
  const data = normalizeJson(doc.data() || {});
  const requestedContact = data.requestedContact || {};
  const opportunitySnapshot = data.opportunitySnapshot || {};

  return {
    firebase_project: FIREBASE_PROJECT,
    firebase_collection: FIREBASE_COLLECTION,
    firebase_document_id: doc.id,

    requester_uid: firstNonEmpty(data.requesterUid, data.ownerUid, data.userId),
    requester_name: firstNonEmpty(data.requesterName, data.fullName, data.name),
    requester_email: firstNonEmpty(data.requesterEmail, data.email),

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

async function main() {
  const live = hasFlag('live');
  const limit = normalizeLimit(getArgValue('limit', '1'));

  console.log(`YHU Firebase federation requests import started.`);
  console.log(`Mode: ${live ? 'LIVE IMPORT' : 'DRY RUN'}`);
  console.log(`Limit: ${limit === 0 ? 'ALL' : limit}`);

  let query = firestore.collection(FIREBASE_COLLECTION);
  if (limit > 0) query = query.limit(limit);

  const snap = await query.get();

  let prepared = 0;
  let imported = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    prepared += 1;
    const row = mapFederationRequest(doc);

    console.log(
      `[${live ? 'import' : 'dry-run'}] ${doc.id} -> requester=${row.requester_name || 'unknown'} | requested=${row.requested_contact_name || row.requested_company_name || 'unknown'}`
    );

    if (!live) continue;

    const { error } = await yhuSupabaseAdmin
      .from('yhu_federation_requests')
      .upsert(row, {
        onConflict: 'firebase_project,firebase_collection,firebase_document_id',
      });

    if (error) {
      failed += 1;
      console.error(`[failed] ${doc.id}: ${error.message}`);
      continue;
    }

    imported += 1;
  }

  console.log(`YHU Firebase federation requests import complete.`);
  console.log(`Prepared: ${prepared}`);
  console.log(`Imported: ${imported}`);
  console.log(`Failed: ${failed}`);

  if (!live) {
    console.log('Dry run only. To import, run again with --live.');
  }

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Fatal import error:', error.message);
  process.exit(1);
});
