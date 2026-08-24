const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE_NAME = 'yhu_operational_settings';

const DEFAULT_OPERATIONAL_SETTINGS = Object.freeze({
  requireFederationManualReview: true,
  requirePlazaListingReview: true,
  enableAiNudges: true,
  maintenanceMode: false
});

const DATABASE_KEYS = Object.freeze({
  requireFederationManualReview: 'require_federation_manual_review',
  requirePlazaListingReview: 'require_plaza_listing_review',
  enableAiNudges: 'enable_ai_nudges',
  maintenanceMode: 'maintenance_mode'
});

const CACHE_TTL_MS = Math.max(
  1000,
  Number(
    process.env.YH_OPERATIONAL_SETTINGS_CACHE_TTL_MS ||
    3000
  ) || 3000
);

let cachedSettings = null;
let cacheExpiresAt = 0;

function normalizeOperationalSettings(source = {}) {
  const input =
    source &&
    typeof source === 'object'
      ? source
      : {};

  return Object.fromEntries(
    Object.entries(
      DEFAULT_OPERATIONAL_SETTINGS
    ).map(
      ([key, fallback]) => [
        key,
        typeof input[key] === 'boolean'
          ? input[key]
          : fallback
      ]
    )
  );
}

function rowsToOperationalSettings(rows = []) {
  const reverseKeys =
    Object.fromEntries(
      Object.entries(
        DATABASE_KEYS
      ).map(
        ([appKey, databaseKey]) => [
          databaseKey,
          appKey
        ]
      )
    );

  const values = {};

  for (
    const row of
    Array.isArray(rows)
      ? rows
      : []
  ) {
    const appKey =
      reverseKeys[
        String(
          row?.setting_key || ''
        ).trim()
      ];

    if (!appKey) {
      continue;
    }

    if (
      typeof row?.setting_value ===
      'boolean'
    ) {
      values[appKey] =
        row.setting_value;
    }
  }

  return normalizeOperationalSettings(
    values
  );
}

async function readOperationalSettings({
  forceRefresh = false
} = {}) {
  const now = Date.now();

  if (
    !forceRefresh &&
    cachedSettings &&
    now < cacheExpiresAt
  ) {
    return {
      ...cachedSettings
    };
  }

  const { data, error } =
    await yhuSupabaseAdmin
      .from(TABLE_NAME)
      .select(
        'setting_key,setting_value'
      );

  if (error) {
    throw new Error(
      `Failed to read operational settings: ${error.message}`
    );
  }

  cachedSettings =
    rowsToOperationalSettings(
      data || []
    );

  cacheExpiresAt =
    now + CACHE_TTL_MS;

  return {
    ...cachedSettings
  };
}

async function updateMaintenanceMode(
  enabled,
  {
    updatedBy = 'admin'
  } = {}
) {
  if (
    typeof enabled !== 'boolean'
  ) {
    const error =
      new Error(
        'Maintenance mode must be true or false.'
      );

    error.statusCode = 400;
    throw error;
  }

  const { error } =
    await yhuSupabaseAdmin
      .from(TABLE_NAME)
      .upsert(
        {
          setting_key:
            DATABASE_KEYS
              .maintenanceMode,

          setting_value:
            enabled,

          updated_at:
            new Date()
              .toISOString(),

          updated_by:
            String(
              updatedBy ||
              'admin'
            ).trim() ||
            'admin'
        },
        {
          onConflict:
            'setting_key'
        }
      );

  if (error) {
    throw new Error(
      `Failed to update maintenance mode: ${error.message}`
    );
  }

  cachedSettings =
    normalizeOperationalSettings({
      ...(cachedSettings || {}),
      maintenanceMode:
        enabled
    });

  cacheExpiresAt =
    Date.now() +
    CACHE_TTL_MS;

  return {
    ...cachedSettings
  };
}

async function isMaintenanceModeEnabled(
  options = {}
) {
  const settings =
    await readOperationalSettings(
      options
    );

  return (
    settings
      .maintenanceMode === true
  );
}

function clearOperationalSettingsCache() {
  cachedSettings = null;
  cacheExpiresAt = 0;
}

module.exports = {
  DEFAULT_OPERATIONAL_SETTINGS,
  DATABASE_KEYS,
  normalizeOperationalSettings,
  readOperationalSettings,
  updateMaintenanceMode,
  isMaintenanceModeEnabled,
  clearOperationalSettingsCache
};
