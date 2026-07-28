const {
    yhuSupabaseAdmin
} = require(
    '../../config/supabaseAdmin'
);

const EVENT_TABLE =
    'yhu_federation_influence_event_ledger';

const PROFILE_TABLE =
    'yhu_federation_influence_profiles';

function cleanText(
    value,
    fallback = ''
) {
    if (
        value === null ||
        value === undefined
    ) {
        return fallback;
    }

    return String(value).trim();
}

function toIso(value) {
    if (!value) return '';

    if (value instanceof Date) {
        return value.toISOString();
    }

    const parsed = Date.parse(
        cleanText(value)
    );

    return Number.isFinite(parsed)
        ? new Date(parsed).toISOString()
        : '';
}

function toInteger(
    value,
    fallback = 0
) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
        ? Math.round(parsed)
        : fallback;
}

function safeObject(value = {}) {
    return (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
    )
        ? value
        : {};
}

function federationInfluenceHttpError(
    message = '',
    status = 500
) {
    const error = new Error(
        cleanText(message) ||
        'Federation Influence operation failed.'
    );

    error.status =
        Number(status) || 500;

    error.statusCode =
        error.status;

    return error;
}

function mapEventRow(row = {}) {
    return {
        id:
            cleanText(
                row.id
            ),

        eventKey:
            cleanText(
                row.event_key
            ),

        userId:
            cleanText(
                row.user_id
            ),

        eventType:
            cleanText(
                row.event_type
            ),

        sourceType:
            cleanText(
                row.source_type
            ),

        sourceId:
            cleanText(
                row.source_id
            ),

        beneficiaryRole:
            cleanText(
                row.beneficiary_role ||
                'member'
            ),

        influencePoints:
            toInteger(
                row.influence_points,
                0
            ),

        region:
            cleanText(
                row.region ||
                'Global'
            ) || 'Global',

        verifiedBy:
            cleanText(
                row.verified_by
            ),

        verifiedSource:
            cleanText(
                row.verified_source
            ),

        occurredAt:
            toIso(
                row.occurred_at
            ),

        metadata:
            safeObject(
                row.metadata
            ),

        createdAt:
            toIso(
                row.created_at
            )
    };
}

function mapProfileRow(
    row = {},
    userId = ''
) {
    return {
        userId:
            cleanText(
                row.user_id ||
                userId
            ),

        division:
            'federation',

        totalInfluence:
            Math.max(
                0,
                toInteger(
                    row.total_influence,
                    0
                )
            ),

        weeklyInfluence:
            Math.max(
                0,
                toInteger(
                    row.weekly_influence,
                    0
                )
            ),

        eventCount:
            Math.max(
                0,
                toInteger(
                    row.event_count,
                    0
                )
            ),

        weekStartAt:
            toIso(
                row.week_start_at
            ),

        lastEventAt:
            toIso(
                row.last_event_at
            ),

        lastEventType:
            cleanText(
                row.last_event_type
            ),

        source:
            cleanText(
                row.source ||
                'federation_influence_ledger_v1'
            ),

        updatedAt:
            toIso(
                row.updated_at
            )
    };
}

async function recordVerifiedEventOnce(
    input = {}
) {
    const userId =
        cleanText(
            input.userId
        );

    const eventType =
        cleanText(
            input.eventType
        ).toLowerCase();

    const sourceType =
        cleanText(
            input.sourceType
        ).toLowerCase();

    const sourceId =
        cleanText(
            input.sourceId
        );

    const beneficiaryRole =
        cleanText(
            input.beneficiaryRole ||
            'member'
        ).toLowerCase();

    const influencePoints =
        toInteger(
            input.influencePoints !== undefined &&
            input.influencePoints !== null
                ? input.influencePoints
                : input.points,
            0
        );

    const verifiedBy =
        cleanText(
            input.verifiedBy
        );

    const verifiedSource =
        cleanText(
            input.verifiedSource
        );

    if (
        !userId ||
        !eventType ||
        !sourceType ||
        !sourceId ||
        !beneficiaryRole ||
        !verifiedBy ||
        !verifiedSource
    ) {
        throw federationInfluenceHttpError(
            'Verified Federation Influence event identity is incomplete.',
            400
        );
    }

    if (
        influencePoints === 0 ||
        influencePoints < -1000 ||
        influencePoints > 1000
    ) {
        throw federationInfluenceHttpError(
            'Federation Influence points must be between -1000 and 1000 and cannot be zero.',
            400
        );
    }

    const {
        data,
        error
    } = await yhuSupabaseAdmin
        .rpc(
            'record_yhu_federation_influence_event_v1',
            {
                p_user_id:
                    userId,

                p_event_type:
                    eventType,

                p_source_type:
                    sourceType,

                p_source_id:
                    sourceId,

                p_beneficiary_role:
                    beneficiaryRole,

                p_influence_points:
                    influencePoints,

                p_region:
                    cleanText(
                        input.region ||
                        'Global'
                    ) || 'Global',

                p_verified_by:
                    verifiedBy,

                p_verified_source:
                    verifiedSource,

                p_occurred_at:
                    toIso(
                        input.occurredAt ||
                        input.eventAt
                    ) ||
                    new Date()
                        .toISOString(),

                p_metadata:
                    safeObject(
                        input.metadata
                    )
            }
        );

    if (error) {
        throw federationInfluenceHttpError(
            'Federation Influence event recording failed: ' +
            error.message,
            500
        );
    }

    const payload =
        Array.isArray(data)
            ? data[0] || {}
            : data || {};

    return {
        created:
            payload.created === true,

        duplicate:
            payload.duplicate === true ||
            payload.created !== true,

        event:
            mapEventRow(
                payload.event || {}
            ),

        profile:
            mapProfileRow(
                payload.profile || {},
                userId
            )
    };
}

async function getUserProfile(
    userId = ''
) {
    const cleanUserId =
        cleanText(
            userId
        );

    if (!cleanUserId) {
        throw federationInfluenceHttpError(
            'Federation Influence user is required.',
            400
        );
    }

    const {
        data,
        error
    } = await yhuSupabaseAdmin
        .from(
            PROFILE_TABLE
        )
        .select('*')
        .eq(
            'user_id',
            cleanUserId
        )
        .maybeSingle();

    if (error) {
        throw federationInfluenceHttpError(
            'Federation Influence profile lookup failed: ' +
            error.message,
            500
        );
    }

    return mapProfileRow(
        data || {},
        cleanUserId
    );
}

async function listUserEvents(
    userId = '',
    limit = 50
) {
    const cleanUserId =
        cleanText(
            userId
        );

    if (!cleanUserId) {
        throw federationInfluenceHttpError(
            'Federation Influence user is required.',
            400
        );
    }

    const safeLimit =
        Math.max(
            1,
            Math.min(
                200,
                Number(limit) || 50
            )
        );

    const {
        data,
        error
    } = await yhuSupabaseAdmin
        .from(
            EVENT_TABLE
        )
        .select('*')
        .eq(
            'user_id',
            cleanUserId
        )
        .order(
            'occurred_at',
            {
                ascending: false,
                nullsFirst: false
            }
        )
        .order(
            'event_key',
            {
                ascending: false
            }
        )
        .limit(
            safeLimit
        );

    if (error) {
        throw federationInfluenceHttpError(
            'Federation Influence ledger lookup failed: ' +
            error.message,
            500
        );
    }

    return (
        Array.isArray(data)
            ? data
            : []
    ).map(
        mapEventRow
    );
}

async function getUserLedgerSnapshot(
    userId = '',
    options = {}
) {
    const [
        profile,
        events
    ] = await Promise.all([
        getUserProfile(
            userId
        ),

        listUserEvents(
            userId,
            options.limit || 50
        )
    ]);

    return {
        profile,
        events,

        eventCount:
            profile.eventCount,

        fetchedAt:
            new Date()
                .toISOString()
    };
}

module.exports = {
    EVENT_TABLE,
    PROFILE_TABLE,
    getUserLedgerSnapshot,
    getUserProfile,
    listUserEvents,
    recordVerifiedEventOnce
};