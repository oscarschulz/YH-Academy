const primary = require('./academySupabaseRepo');
const legacy = require('./academyFirestoreRepoLegacy');

function isEnabled() {
    const value = String(
        process.env.YHU_ACADEMY_CORE_SUPABASE_MODE || 'primary'
    )
        .trim()
        .toLowerCase();

    return (
        value !== 'off' &&
        value !== 'false' &&
        value !== 'legacy'
    );
}

/*
 * These are read-only functions where an empty Supabase result may mean
 * that the member's older Academy data still exists only in Firestore.
 *
 * Do not add write functions here. Writes must remain primary-only unless
 * the Supabase call throws and the existing legacy fallback is required.
 */
const FALLBACK_ON_EMPTY_READS = new Set([
    'getActiveRoadmap',
    'getRoadmapById',
    'getMissionById',
    'listAllMissionsByRoadmap',
    'listRecentMissions',
    'listRecentCheckins',
    'getRecentCheckinStreakDays'
]);

function isEmptyPrimaryResult(name, result) {
    if (!FALLBACK_ON_EMPTY_READS.has(name)) {
        return false;
    }

    if (result === null || result === undefined) {
        return true;
    }

    if (Array.isArray(result)) {
        return result.length === 0;
    }

    /*
     * A streak result of zero is a valid result, not missing data.
     * Therefore only null/undefined are considered empty for scalar reads.
     */
    return false;
}

function wrapFunction(name) {
    return async function wrappedAcademyRepoFunction(...args) {
        if (
            isEnabled() &&
            typeof primary[name] === 'function'
        ) {
            try {
                const primaryResult =
                    await primary[name](...args);

                const shouldTryLegacy =
                    isEmptyPrimaryResult(
                        name,
                        primaryResult
                    ) &&
                    typeof legacy[name] === 'function';

                if (!shouldTryLegacy) {
                    return primaryResult;
                }

                const legacyResult =
                    await legacy[name](...args);

                /*
                 * Return legacy data only when it actually contains
                 * something. Otherwise preserve the primary empty result.
                 */
                if (
                    legacyResult !== null &&
                    legacyResult !== undefined &&
                    (
                        !Array.isArray(legacyResult) ||
                        legacyResult.length > 0
                    )
                ) {
                    console.info(
                        'Academy repository used legacy read fallback:',
                        name
                    );

                    return legacyResult;
                }

                return primaryResult;
            } catch (error) {
                const statusCode =
                    Number(
                        error?.statusCode ||
                        error?.status
                    );

                /*
                 * Validation, authorization, conflict, and not-found
                 * responses are valid primary repository results.
                 *
                 * Do not hide them by falling through to the legacy repo,
                 * because the legacy repo may not implement the new feature.
                 */
                if (
                    Number.isFinite(
                        statusCode
                    ) &&
                    statusCode >= 400 &&
                    statusCode < 500
                ) {
                    throw error;
                }

                console.error(
                    'Academy Supabase primary failed:',
                    name,
                    error?.message ||
                    error
                );
            }
        }

        if (typeof legacy[name] === 'function') {
            return legacy[name](...args);
        }

        throw new Error(
            `Academy repo function not available: ${name}`
        );
    };
}

const out = {};

const names = new Set([
    ...Object.keys(legacy || {}),
    ...Object.keys(primary || {})
]);

for (const name of names) {
    if (
        typeof primary[name] === 'function' ||
        typeof legacy[name] === 'function'
    ) {
        out[name] = wrapFunction(name);
    } else {
        out[name] =
            primary[name] !== undefined
                ? primary[name]
                : legacy[name];
    }
}

module.exports = out;