const { firestore, collectionsFirestore } = require('../config/firebaseAdmin');
const { yhuSupabaseAdmin } = require('../config/supabaseAdmin');

const DEFAULT_FIRESTORE_ROOT_COLLECTIONS = [
  'users',
  'academyFeedPosts',
  'academyFriendRequests',
  'academyFriendships',
  'academyUserFollows',
  'userFollows',
  'chatRooms',
  'vaultItems',
  'liveRooms',
  'notifications',
  'yhPaymentLedger',
  'yhPayoutLedger',
  'universeReferralLedger',
  'universeReferralCommissionLedger',
  'publicLandingEvents',
  'aiNurtureSettings',
  'aiNurtureSources',
  'aiNurtureReviews',
  'aiNurtureLibrary',
  'aiNurtureMemoryCards',
  'aiNurtureContextPacks',
  'aiNurtureJobs',
  'aiNurtureBatches',
  'aiNurtureUserOverlays'
];

const COLLECTIONS_FIRESTORE_ROOT_COLLECTIONS = [
  'yhUniverseCollections',
  'yhUniverseCollectionIndex',
  'yhFederationLeadInventory'
];

const BATCH_SIZE = 250;

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    allRoot: false,
    only: [],
    skipCollectionsDb: false,
    limit: 0
  };

  for (const arg of args) {
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--all-root') options.allRoot = true;
    if (arg === '--skip-collections-db') options.skipCollectionsDb = true;

    if (arg.startsWith('--only=')) {
      options.only = arg
        .replace('--only=', '')
        .split(',')
        .map((item) => cleanText(item))
        .filter(Boolean);
    }

    if (arg.startsWith('--limit=')) {
      const parsed = Number.parseInt(arg.replace('--limit=', ''), 10);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }
  }

  return options;
}

function isFirestoreTimestamp(value) {
  return value && typeof value.toDate === 'function';
}

function isFirestoreDocumentReference(value) {
  return value && typeof value.path === 'string' && typeof value.id === 'string';
}

function isFirestoreGeoPoint(value) {
  return (
    value &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number'
  );
}

function normalizeJson(value) {
  if (value === undefined) return null;
  if (value === null) return null;

  if (isFirestoreTimestamp(value)) {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (isFirestoreDocumentReference(value)) {
    return {
      __type: 'firestore_document_reference',
      path: value.path,
      id: value.id
    };
  }

  if (isFirestoreGeoPoint(value)) {
    return {
      __type: 'firestore_geo_point',
      latitude: value.latitude,
      longitude: value.longitude
    };
  }

  if (Buffer.isBuffer(value)) {
    return {
      __type: 'buffer',
      base64: value.toString('base64')
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = normalizeJson(child);
    }
    return out;
  }

  return value;
}

function toIso(value) {
  if (!value) return null;

  if (isFirestoreTimestamp(value)) {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function getSourceCreatedAt(data = {}) {
  return (
    toIso(data.createdAt) ||
    toIso(data.created_at) ||
    toIso(data.dateCreated) ||
    toIso(data.submittedAt) ||
    null
  );
}

function getSourceUpdatedAt(data = {}) {
  return (
    toIso(data.updatedAt) ||
    toIso(data.updated_at) ||
    toIso(data.lastUpdatedAt) ||
    toIso(data.modifiedAt) ||
    null
  );
}

function getParentDocumentPath(documentPath = '') {
  const parts = cleanText(documentPath).split('/').filter(Boolean);

  if (parts.length < 4) return null;

  return parts.slice(0, parts.length - 2).join('/');
}

function getCollectionPathFromDocumentPath(documentPath = '') {
  const parts = cleanText(documentPath).split('/').filter(Boolean);

  if (parts.length < 2) return '';

  return parts.slice(0, parts.length - 1).join('/');
}

function buildArchiveRow({ firebaseApp, firebaseProject, docSnap }) {
  const rawData = docSnap.data() || {};
  const data = normalizeJson(rawData) || {};
  const documentPath = docSnap.ref.path;
  const collectionPath = getCollectionPathFromDocumentPath(documentPath);

  return {
    firebase_app: firebaseApp,
    firebase_project: firebaseProject || null,
    collection_path: collectionPath,
    document_id: docSnap.id,
    document_path: documentPath,
    parent_document_path: getParentDocumentPath(documentPath),
    data,
    created_at_source: getSourceCreatedAt(rawData),
    updated_at_source: getSourceUpdatedAt(rawData),
    synced_at: new Date().toISOString(),
    is_deleted: false,
    deleted_at: null
  };
}

async function upsertRows(rows, context) {
  if (!rows.length) return;

  if (context.options.dryRun) {
    context.stats.migrated += rows.length;
    console.log(`[dry-run] Would upsert ${rows.length} documents.`);
    return;
  }

  const { error } = await yhuSupabaseAdmin
    .from('yhu_firestore_documents')
    .upsert(rows, {
      onConflict: 'firebase_app,document_path'
    });

  if (error) {
    context.stats.failed += rows.length;
    console.error(`[upsert-error] ${error.message}`);

    await logMigrationError({
      runKey: context.runKey,
      firebaseApp: context.firebaseApp,
      firebaseProject: context.firebaseProject,
      collectionPath: rows[0]?.collection_path || '',
      documentId: rows[0]?.document_id || '',
      documentPath: rows[0]?.document_path || '',
      errorMessage: error.message,
      errorMeta: {
        rowCount: rows.length,
        hint: error.hint || null,
        details: error.details || null,
        code: error.code || null
      }
    });

    return;
  }

  context.stats.migrated += rows.length;
}

async function logMigrationError({
  runKey,
  firebaseApp,
  firebaseProject,
  collectionPath,
  documentId,
  documentPath,
  errorMessage,
  errorMeta
}) {
  if (!runKey || !errorMessage) return;

  const { error } = await yhuSupabaseAdmin
    .from('yhu_firestore_migration_errors')
    .insert({
      run_key: runKey,
      firebase_app: firebaseApp || null,
      firebase_project: firebaseProject || null,
      collection_path: collectionPath || null,
      document_id: documentId || null,
      document_path: documentPath || null,
      error_message: errorMessage,
      error_meta: errorMeta || {}
    });

  if (error) {
    console.error(`[migration-error-log-failed] ${error.message}`);
  }
}

async function startRun(context) {
  if (context.options.dryRun) {
    console.log('[dry-run] Not creating migration run row.');
    return;
  }

  const { error } = await yhuSupabaseAdmin
    .from('yhu_firestore_migration_runs')
    .upsert({
      run_key: context.runKey,
      status: 'running',
      firebase_app: context.firebaseApp,
      started_at: new Date().toISOString(),
      finished_at: null,
      total_documents: 0,
      migrated_documents: 0,
      failed_documents: 0,
      meta: {
        options: context.options,
        rootCollections: context.rootCollections
      }
    }, {
      onConflict: 'run_key'
    });

  if (error) {
    throw new Error(`Failed to create migration run row: ${error.message}`);
  }
}

async function finishRun(context, status = 'completed', errorMessage = '') {
  if (context.options.dryRun) {
    console.log('[dry-run] Not updating migration run row.');
    return;
  }

  const { error } = await yhuSupabaseAdmin
    .from('yhu_firestore_migration_runs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      total_documents: context.stats.total,
      migrated_documents: context.stats.migrated,
      failed_documents: context.stats.failed,
      error_message: errorMessage || null,
      meta: {
        options: context.options,
        rootCollections: context.rootCollections,
        completedAt: new Date().toISOString()
      }
    })
    .eq('run_key', context.runKey);

  if (error) {
    console.error(`[migration-run-update-failed] ${error.message}`);
  }
}

async function listRootCollections(db, configuredRootCollections, options) {
  if (!options.allRoot) {
    if (options.only.length) {
      return configuredRootCollections.filter((name) => options.only.includes(name));
    }

    return configuredRootCollections;
  }

  const rootCollections = await db.listCollections();
  const discovered = rootCollections.map((col) => col.id).sort();

  if (options.only.length) {
    return discovered.filter((name) => options.only.includes(name));
  }

  return discovered;
}

async function migrateCollectionRecursive(collectionRef, context) {
  const collectionPath = collectionRef.path;

  console.log(`\n[collection] ${context.firebaseApp}:${collectionPath}`);

  let snap;

  try {
    snap = await collectionRef.get();
  } catch (error) {
    context.stats.failed += 1;
    console.error(`[read-error] ${collectionPath}: ${error.message}`);

    await logMigrationError({
      runKey: context.runKey,
      firebaseApp: context.firebaseApp,
      firebaseProject: context.firebaseProject,
      collectionPath,
      documentId: '',
      documentPath: '',
      errorMessage: error.message,
      errorMeta: {
        stage: 'collection_get'
      }
    });

    return;
  }

  if (snap.empty) {
    console.log(`[empty] ${collectionPath}`);
    return;
  }

  let rows = [];

  for (const docSnap of snap.docs) {
    if (context.options.limit > 0 && context.stats.total >= context.options.limit) {
      context.hitLimit = true;
      break;
    }

    context.stats.total += 1;

    try {
      rows.push(buildArchiveRow({
        firebaseApp: context.firebaseApp,
        firebaseProject: context.firebaseProject,
        docSnap
      }));

      if (rows.length >= BATCH_SIZE) {
        await upsertRows(rows, context);
        rows = [];
      }
    } catch (error) {
      context.stats.failed += 1;
      console.error(`[map-error] ${docSnap.ref.path}: ${error.message}`);

      await logMigrationError({
        runKey: context.runKey,
        firebaseApp: context.firebaseApp,
        firebaseProject: context.firebaseProject,
        collectionPath,
        documentId: docSnap.id,
        documentPath: docSnap.ref.path,
        errorMessage: error.message,
        errorMeta: {
          stage: 'row_mapping'
        }
      });
    }
  }

  if (rows.length) {
    await upsertRows(rows, context);
  }

  console.log(`[done] ${collectionPath}: seen=${snap.size}, total=${context.stats.total}, migrated=${context.stats.migrated}, failed=${context.stats.failed}`);

  for (const docSnap of snap.docs) {
    if (context.hitLimit) break;

    let subcollections = [];

    try {
      subcollections = await docSnap.ref.listCollections();
    } catch (error) {
      context.stats.failed += 1;
      console.error(`[subcollection-list-error] ${docSnap.ref.path}: ${error.message}`);

      await logMigrationError({
        runKey: context.runKey,
        firebaseApp: context.firebaseApp,
        firebaseProject: context.firebaseProject,
        collectionPath,
        documentId: docSnap.id,
        documentPath: docSnap.ref.path,
        errorMessage: error.message,
        errorMeta: {
          stage: 'list_subcollections'
        }
      });

      continue;
    }

    for (const subcollectionRef of subcollections) {
      if (context.hitLimit) break;
      await migrateCollectionRecursive(subcollectionRef, context);
    }
  }
}

async function migrateDatabase({
  db,
  firebaseApp,
  firebaseProject,
  configuredRootCollections,
  options
}) {
  if (!db) {
    console.log(`[skip] ${firebaseApp}: Firestore client not configured.`);
    return;
  }

  const rootCollections = await listRootCollections(db, configuredRootCollections, options);

  const context = {
    firebaseApp,
    firebaseProject,
    rootCollections,
    runKey: `${firebaseApp}_${new Date().toISOString().replace(/[:.]/g, '-')}`,
    options,
    stats: {
      total: 0,
      migrated: 0,
      failed: 0
    },
    hitLimit: false
  };

  console.log('\n============================================================');
  console.log(`Starting migration for Firebase app: ${firebaseApp}`);
  console.log(`Run key: ${context.runKey}`);
  console.log(`Dry run: ${options.dryRun ? 'yes' : 'no'}`);
  console.log(`Root collections: ${rootCollections.join(', ') || '(none)'}`);
  console.log('============================================================');

  await startRun(context);

  try {
    for (const collectionName of rootCollections) {
      if (context.hitLimit) break;

      const collectionRef = db.collection(collectionName);
      await migrateCollectionRecursive(collectionRef, context);
    }

    const finalStatus = context.stats.failed > 0 ? 'completed_with_errors' : 'completed';
    await finishRun(context, finalStatus);

    console.log('\n============================================================');
    console.log(`Finished migration for Firebase app: ${firebaseApp}`);
    console.log(`Status: ${finalStatus}`);
    console.log(`Total documents seen: ${context.stats.total}`);
    console.log(`Migrated/upserted: ${context.stats.migrated}`);
    console.log(`Failed: ${context.stats.failed}`);
    console.log('============================================================');
  } catch (error) {
    context.stats.failed += 1;
    await finishRun(context, 'failed', error.message);

    console.error('\n============================================================');
    console.error(`Migration failed for Firebase app: ${firebaseApp}`);
    console.error(error);
    console.error('============================================================');
  }
}

async function main() {
  const options = parseArgs();

  console.log('YH Firestore to Supabase archive importer');
  console.log('Options:', JSON.stringify(options, null, 2));

  await migrateDatabase({
    db: firestore,
    firebaseApp: 'default',
    firebaseProject: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || null,
    configuredRootCollections: DEFAULT_FIRESTORE_ROOT_COLLECTIONS,
    options
  });

  if (!options.skipCollectionsDb) {
    await migrateDatabase({
      db: collectionsFirestore,
      firebaseApp: 'collections',
      firebaseProject: process.env.YH_COLLECTIONS_FIREBASE_PROJECT_ID || null,
      configuredRootCollections: COLLECTIONS_FIRESTORE_ROOT_COLLECTIONS,
      options
    });
  }

  console.log('\nAll requested migration tasks finished.');
}

main().catch((error) => {
  console.error('\nFatal importer error:');
  console.error(error);
  process.exitCode = 1;
});
