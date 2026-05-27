#!/usr/bin/env node

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });
require('dotenv').config({ path: '.env.supabase.local', override: true });

const crypto = require('crypto');
const { firestore } = require('../config/firebaseAdmin');
const { yhuSupabaseAdmin } = require('../config/supabaseAdmin');

const FIREBASE_PROJECT = 'yh-academy';
const FIREBASE_COLLECTION = 'users';

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

function mapUser(doc) {
  const data = normalizeJson(doc.data() || {});
  const academyProfile = data.academyProfile || {};
  const academyApplication = data.academyApplication || {};

  const fullName = firstNonEmpty(
    data.fullName,
    data.name,
    data.displayName,
    academyProfile.fullName,
    academyProfile.displayName,
    academyApplication.fullName,
    data.email,
    doc.id
  );

  const displayName = firstNonEmpty(
    data.displayName,
    data.name,
    academyProfile.displayName,
    academyProfile.fullName,
    fullName
  );

  const email = firstNonEmpty(
    data.email,
    data['e-mail'],
    data.userEmail,
    academyApplication.email,
    academyApplication['e-mail']
  );

  const username = firstNonEmpty(
    data.username,
    academyProfile.username,
    data.handle
  );

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
    last_seen_at_source: toIso(data.lastSeenAt),

    raw_data: data,
    data_hash: hashData(data),
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const live = hasFlag('live');
  const limit = normalizeLimit(getArgValue('limit', '1'));

  console.log(`YHU Firebase users import started.`);
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
    const row = mapUser(doc);

    console.log(`[${live ? 'import' : 'dry-run'}] ${doc.id} -> ${row.full_name || '(no name)'} <${row.email || 'no email'}>`);

    if (!live) continue;

    const { error } = await yhuSupabaseAdmin
      .from('yhu_users')
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

  console.log(`YHU Firebase users import complete.`);
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
