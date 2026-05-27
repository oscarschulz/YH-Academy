#!/usr/bin/env node

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
require('dotenv').config({ path: '.env.supabase.local', override: true });

const crypto = require('crypto');
const { firestore } = require('../config/firebaseAdmin');
const { FieldPath } = require('firebase-admin/firestore');

const FIREBASE_PROJECT = 'yh-academy';
const FIREBASE_COLLECTION = 'users';

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

function cleanUsername(value = '') {
  return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function getPasswordSource(data = {}) {
  const keys = ['password', 'passwordHash', 'password_hash', '_passwordHash', '_pwHash'];

  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return key;
    }
  }

  return '';
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

function mapUser(doc) {
  const data = normalizeJson(doc.data() || {}) || {};
  const academyProfile =
    data.academyProfile && typeof data.academyProfile === 'object'
      ? data.academyProfile
      : {};
  const academyApplication =
    data.academyApplication && typeof data.academyApplication === 'object'
      ? data.academyApplication
      : {};

  const rawEmail = firstNonEmpty(
    data.email,
    data.emailLower,
    data['e-mail'],
    data.userEmail,
    academyApplication.email,
    academyApplication['e-mail']
  );

  const email = cleanLower(rawEmail);

  const fullName = firstNonEmpty(
    data.fullName,
    data.name,
    data.displayName,
    academyProfile.fullName,
    academyProfile.displayName,
    academyApplication.fullName,
    email,
    doc.id
  );

  const displayName = firstNonEmpty(
    data.displayName,
    data.name,
    academyProfile.displayName,
    academyProfile.fullName,
    fullName
  );

  const username = cleanUsername(firstNonEmpty(
    data.username,
    academyProfile.username,
    data.handle
  ));

  const phone = firstNonEmpty(
    data.phone,
    data.phoneNumber,
    data.mobile,
    academyApplication.phone,
    academyApplication.phoneNumber
  );

  const telegramUsername = firstNonEmpty(
    data.telegramUsername,
    data.telegram_username,
    data.telegram,
    data.telegramHandle,
    academyApplication.telegramUsername
  );

  return {
    firebase_project: FIREBASE_PROJECT,
    firebase_collection: FIREBASE_COLLECTION,
    firebase_document_id: doc.id,

    email,
    phone,
    telegram_username: telegramUsername,
    username,
    full_name: fullName,
    display_name: displayName,
    role_label: firstNonEmpty(data.roleLabel, academyProfile.roleLabel, data.role, 'YH Universe User'),

    account_status: firstNonEmpty(data.accountStatus, data.status, 'active'),
    division: firstNonEmpty(data.division, data.sourceDivision, academyApplication.division, 'YH Universe'),
    country: firstNonEmpty(data.country, academyApplication.country),
    city: firstNonEmpty(data.city, academyApplication.city),
    plan: firstNonEmpty(data.plan, data.tier, academyApplication.tier),

    is_deleted: Boolean(data.isDeleted || data.deleted),

    created_at_source: toIso(data.createdAt),
    updated_at_source: toIso(data.updatedAt),
    last_seen_at_source: toIso(data.lastSeenAt || data.lastActiveAt),

    raw_data: data,
    data_hash: hashData(data),
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function upsertUser(row) {
  const { error } = await getSupabaseAdmin()
    .from('yhu_users')
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

  console.log('YHU Firebase users import started.');
  console.log(`Mode: ${live ? 'LIVE IMPORT' : 'DRY RUN'}`);
  console.log(`Limit: ${limit === 0 ? 'ALL' : limit}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Delay ms: ${delayMs}`);
  console.log(`Start after: ${startAfter || '(none)'}`);

  if (live) {
    getSupabaseAdmin();
  }

  let cursor = startAfter;
  let prepared = 0;
  let imported = 0;
  let failed = 0;
  let withEmail = 0;
  let withoutEmail = 0;
  let withPasswordSource = 0;
  let withoutPasswordSource = 0;
  let quotaStopped = false;
  let lastDocId = cursor;

  while (prepared < totalTarget) {
    const remaining = totalTarget === Number.POSITIVE_INFINITY
      ? batchSize
      : Math.min(batchSize, totalTarget - prepared);

    if (remaining <= 0) break;

    let query = firestore
      .collection(FIREBASE_COLLECTION)
      .orderBy(FieldPath.documentId())
      .limit(remaining);

    if (cursor) {
      query = query.startAfter(cursor);
    }

    let snap;

    try {
      snap = await query.get();
    } catch (error) {
      if (isFirebaseQuotaError(error)) {
        quotaStopped = true;
        console.error('[quota-stop] Firebase quota exhausted while reading users.');
        console.error('[quota-stop] Last successful document id:', lastDocId || '(none)');
        break;
      }

      throw error;
    }

    if (snap.empty) break;

    for (const doc of snap.docs) {
      prepared += 1;
      lastDocId = doc.id;

      const originalData = normalizeJson(doc.data() || {}) || {};
      const row = mapUser(doc);
      const passwordSource = getPasswordSource(originalData);

      if (row.email) withEmail += 1;
      else withoutEmail += 1;

      if (passwordSource) withPasswordSource += 1;
      else withoutPasswordSource += 1;

      console.log(
        `[${live ? 'import' : 'dry-run'}] ${doc.id} -> ${row.full_name || '(no name)'} <${row.email || 'no email'}> password=${passwordSource ? `yes:${passwordSource}` : 'no'}`
      );

      if (!live) continue;

      try {
        await upsertUser(row);
        imported += 1;
      } catch (error) {
        failed += 1;
        console.error(`[failed] ${doc.id}: ${error.message}`);
      }
    }

    cursor = snap.docs[snap.docs.length - 1].id;

    if (snap.size < remaining) break;
    if (prepared >= totalTarget) break;

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log('YHU Firebase users import complete.');
  console.log(`Prepared: ${prepared}`);
  console.log(`Imported: ${imported}`);
  console.log(`Failed: ${failed}`);
  console.log(`With email: ${withEmail}`);
  console.log(`Without email: ${withoutEmail}`);
  console.log(`With password source: ${withPasswordSource}`);
  console.log(`Without password source: ${withoutPasswordSource}`);
  console.log(`Last document id: ${lastDocId || '(none)'}`);
  console.log(`Quota stopped: ${quotaStopped ? 'yes' : 'no'}`);

  if (!live) {
    console.log('Dry run only. To import, run again with --live.');
  }

  if (lastDocId) {
    console.log(`Resume command example: node scripts/import-yhu-firebase-users-to-supabase.js --start-after=${lastDocId} --limit=25`);
  }

  if (failed > 0 || quotaStopped) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Fatal import error:', error.message);
  process.exit(1);
});