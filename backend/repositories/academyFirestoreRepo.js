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
        const primaryEnabled =
            isEnabled();

        const hasPrimary =
            typeof primary[name] ===
            'function';

        const hasLegacy =
            typeof legacy[name] ===
            'function';

        if (
            primaryEnabled &&
            hasPrimary
        ) {
            try {
                const primaryResult =
                    await primary[name](
                        ...args
                    );

                const shouldTryLegacy =
                    isEmptyPrimaryResult(
                        name,
                        primaryResult
                    ) &&
                    hasLegacy;

                if (!shouldTryLegacy) {
                    return primaryResult;
                }

                const legacyResult =
                    await legacy[name](
                        ...args
                    );

                if (
                    legacyResult !== null &&
                    legacyResult !== undefined &&
                    (
                        !Array.isArray(
                            legacyResult
                        ) ||
                        legacyResult.length > 0
                    )
                ) {
                    console.info(
                        'Academy repository used controlled legacy migration read:',
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

                if (
                    Number.isFinite(
                        statusCode
                    ) &&
                    statusCode >= 400 &&
                    statusCode < 500
                ) {
                    throw error;
                }

                /*
                 * Supabase is authoritative. Only the
                 * explicitly allowlisted migration reads
                 * may fall back after a primary failure.
                 * Writes and all Lead Missions operations
                 * must never switch to Firestore silently.
                 */
                if (
                    !FALLBACK_ON_EMPTY_READS.has(
                        name
                    ) ||
                    !hasLegacy
                ) {
                    console.error(
                        'Academy Supabase primary failed without legacy fallback:',
                        name,
                        error?.message ||
                        error
                    );

                    throw error;
                }

                console.warn(
                    'Academy Supabase migration read failed; using controlled legacy read:',
                    name,
                    error?.message ||
                    error
                );

                return legacy[name](
                    ...args
                );
            }
        }

        if (
            !primaryEnabled &&
            hasLegacy
        ) {
            return legacy[name](
                ...args
            );
        }

        if (
            primaryEnabled &&
            !hasPrimary &&
            hasLegacy
        ) {
            return legacy[name](
                ...args
            );
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