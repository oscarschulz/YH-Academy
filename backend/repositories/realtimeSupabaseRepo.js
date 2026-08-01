const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');
const yhuUsersSupabaseRepo = require('./yhuUsersSupabaseRepo');

const TABLE = 'yhu_realtime_records';

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const normalizeUserId = (value) => sanitizeText(value);

const toInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const safeArray = (value, fallback = []) => Array.isArray(value) ? value : fallback;
const nowIso = () => new Date().toISOString();

function makeRecordId(prefix = 'rt') {
    return prefix + '_' + Date.now() + '_' + crypto.randomBytes(5).toString('hex');
}

function makeRoomKey(prefix = 'room') {
    return prefix + '_' + crypto.randomBytes(6).toString('hex');
}

function collectionPathFor(recordType, roomId = '') {
    if (recordType === 'user_profile') return 'users';
    if (recordType === 'chat_room') return 'chatRooms';
    if (recordType === 'chat_message') return roomId ? 'chatRooms/' + roomId + '/messages' : 'chatMessages';
    if (recordType === 'vault_item') return 'vaultItems';
    if (recordType === 'live_room') return 'liveRooms';
    if (recordType === 'live_room_participant') return 'liveRooms/' + roomId + '/participants';
    if (recordType === 'notification') return 'notifications';
    if (recordType === 'user_follow') return 'userFollows';
    return 'realtime';
}

function sourcePathFor(recordType, docId, roomId = '') {
    if (recordType === 'user_profile') return 'users/' + docId;
    if (recordType === 'chat_room') return 'chatRooms/' + docId;
    if (recordType === 'chat_message') return roomId ? 'chatRooms/' + roomId + '/messages/' + docId : 'chatMessages/' + docId;
    if (recordType === 'vault_item') return 'vaultItems/' + docId;
    if (recordType === 'live_room') return 'liveRooms/' + docId;
    if (recordType === 'live_room_participant') return 'liveRooms/' + roomId + '/participants/' + docId;
    if (recordType === 'notification') return 'notifications/' + docId;
    if (recordType === 'user_follow') return 'userFollows/' + docId;
    return 'realtime/' + docId;
}

function leafFor(recordType) {
    if (recordType === 'chat_message') return 'messages';
    if (recordType === 'live_room_participant') return 'participants';
    return collectionPathFor(recordType).split('/')[0];
}

function mapTimestamp(value) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();

    if (typeof value === 'object') {
        if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
        if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
    }

    return sanitizeText(value) || null;
}

function rowData(row = {}) {
    return row && row.data && typeof row.data === 'object' ? row.data : {};
}

/* PATCH: Realtime Supabase authority and room integrity v1 */
function realtimeHttpErrorV1(
    message = 'Realtime request failed.',
    statusCode = 400
) {
    const error = new Error(
        sanitizeText(message) ||
        'Realtime request failed.'
    );

    error.statusCode =
        Number(statusCode) || 400;

    return error;
}

function isGenericRealtimeIdentityNameV3(
    value = '',
    userId = ''
) {
    const clean =
        sanitizeText(value)
            .replace(/\s+/g, ' ');

    const lower =
        clean.toLowerCase();

    const cleanUserId =
        normalizeUserId(userId)
            .toLowerCase();

    if (!clean) return true;

    if (
        cleanUserId &&
        lower === cleanUserId
    ) {
        return true;
    }

    if (
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            clean
        )
    ) {
        return true;
    }

    return new Set([
        'hustler',
        'host',
        'member',
        'user',
        'yh member',
        'yhu member',
        'academy member',
        'young hustler',
        'young hustlers member'
    ]).has(lower);
}

function collectRealtimeIdentitySourcesV3(
    input = {}
) {
    const root =
        input &&
        typeof input === 'object'
            ? input
            : {};

    const rawData =
        root.raw_data &&
        typeof root.raw_data === 'object'
            ? root.raw_data
            : {};

    const data =
        root.data &&
        typeof root.data === 'object'
            ? root.data
            : {};

    const publicMeta =
        root.public_meta &&
        typeof root.public_meta === 'object'
            ? root.public_meta
            : {};

    const bases = [
        root,
        publicMeta,
        data,
        rawData
    ];

    const nested = [];

    bases.forEach((source) => {
        [
            'universeProfile',
            'universe_profile',
            'academyProfile',
            'academy_profile',
            'profile',
            'userProfile',
            'user_profile'
        ].forEach((key) => {
            const value =
                source?.[key];

            if (
                value &&
                typeof value === 'object' &&
                !Array.isArray(value)
            ) {
                nested.push(value);
            }
        });
    });

    return [
        ...bases,
        ...nested
    ];
}

function resolveRealtimeUserIdentityV3(
    input = {},
    fallback = {}
) {
    const sources = [
        ...collectRealtimeIdentitySourcesV3(
            input
        ),
        ...collectRealtimeIdentitySourcesV3(
            fallback
        )
    ];

    const userId =
        normalizeUserId(
            sources
                .map((source) => (
                    source?.user_id ||
                    source?.firebase_uid ||
                    source?.firebaseUid ||
                    source?.uid ||
                    source?.userId ||
                    source?.id ||
                    source?.source_document_id
                ))
                .find(Boolean)
        );

    const joinedNames =
        sources.map((source) => {
            const firstName =
                sanitizeText(
                    source?.first_name ||
                    source?.firstName ||
                    source?.firstname
                );

            const lastName =
                sanitizeText(
                    source?.surname ||
                    source?.last_name ||
                    source?.lastName ||
                    source?.lastname
                );

            return [
                firstName,
                lastName
            ]
                .filter(Boolean)
                .join(' ')
                .trim();
        });

    const nameCandidates = [
        ...joinedNames,
        ...sources.flatMap((source) => [
            source?.full_name,
            source?.fullName,
            source?.display_name,
            source?.displayName,
            source?.name,
            source?.user_name,
            source?.userName,
            source?.username,
            source?.handle
        ])
    ]
        .map((value) =>
            sanitizeText(value)
                .replace(/\s+/g, ' ')
                .replace(/^@+/, '')
        )
        .filter(Boolean);

    const displayName =
        nameCandidates.find(
            (value) =>
                !isGenericRealtimeIdentityNameV3(
                    value,
                    userId
                )
        ) ||
        '';

    const username =
        sources
            .flatMap((source) => [
                source?.username,
                source?.handle,
                source?.user_name,
                source?.userName
            ])
            .map((value) =>
                sanitizeText(value)
                    .replace(/^@+/, '')
            )
            .find((value) =>
                value &&
                !isGenericRealtimeIdentityNameV3(
                    value,
                    userId
                )
            ) ||
        '';

    const avatar =
        sources
            .flatMap((source) => [
                source?.avatar,
                source?.avatar_url,
                source?.avatarUrl,
                source?.profile_photo,
                source?.profilePhoto,
                source?.photo_url,
                source?.photoURL
            ])
            .map(sanitizeText)
            .find(Boolean) ||
        '';

    const safeDisplayName =
        displayName ||
        username ||
        'YH Member';

    return {
        userId,
        fullName: safeDisplayName,
        name: safeDisplayName,
        displayName: safeDisplayName,
        username,
        avatar
    };
}

function mapCanonicalYhuUserToRealtimeUserV1(
    row = {}
) {
    const rawData =
        row.raw_data &&
        typeof row.raw_data === 'object'
            ? row.raw_data
            : {};

    const data =
        row.data &&
        typeof row.data === 'object'
            ? row.data
            : {};

    const publicMeta =
        row.public_meta &&
        typeof row.public_meta === 'object'
            ? row.public_meta
            : {};

    const source = {
        ...rawData,
        ...data,
        ...publicMeta,
        ...row
    };

    const identity =
        resolveRealtimeUserIdentityV3(
            row
        );

    const userId =
        identity.userId;

    if (!userId) {
        return null;
    }

    return {
        ...source,

        id: userId,
        uid: userId,
        userId,
        firebaseUid: userId,

        fullName:
            identity.fullName,

        name:
            identity.name,

        displayName:
            identity.displayName,

        username:
            identity.username,

        avatar:
            identity.avatar,

        profilePhoto:
            identity.avatar,

        photoURL:
            identity.avatar,

        roleLabel:
            sanitizeText(
                source.role_label ||
                source.roleLabel ||
                source.role ||
                'Member'
            ) ||
            'Member'
    };
}

async function listRealtimeRowsPagedV1(
    buildQuery,
    {
        pageSize = 1000,
        maxRows = 20000,
        label = 'Realtime records'
    } = {}
) {
    if (typeof buildQuery !== 'function') {
        return [];
    }

    const safePageSize =
        Math.max(
            1,
            Math.min(
                1000,
                Number(pageSize) || 1000
            )
        );

    const safeMaxRows =
        Math.max(
            safePageSize,
            Math.min(
                50000,
                Number(maxRows) || 20000
            )
        );

    const rows = [];
    let offset = 0;

    while (rows.length < safeMaxRows) {
        const query =
            buildQuery();

        const {
            data,
            error
        } = await query.range(
            offset,
            offset + safePageSize - 1
        );

        if (error) {
            throw new Error(
                `${label} lookup failed: ${error.message}`
            );
        }

        const batch =
            Array.isArray(data)
                ? data
                : [];

        rows.push(...batch);

        if (
            batch.length <
            safePageSize
        ) {
            break;
        }

        offset +=
            batch.length;
    }

    return rows.slice(
        0,
        safeMaxRows
    );
}
/* END PATCH: Realtime Supabase authority and room integrity v1 */

async function getRecordByTypeAndId(recordType, docId) {
    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', recordType)
        .eq('source_document_id', sanitizeText(docId))
        .maybeSingle();

    if (error) throw new Error('Realtime Supabase get failed: ' + error.message);
    return data || null;
}

async function listRecords(recordType, limit = 500) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 500), 1000));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', recordType)
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Realtime Supabase list failed: ' + error.message);
    return Array.isArray(data) ? data : [];
}

async function upsertRecord({
    recordType,
    docId,
    data = {},
    ownerUserId = '',
    roomId = '',
    targetUserId = '',
    firebaseApp = 'supabase',
    insertOnly = false
}) {
    const cleanDocId = sanitizeText(docId || makeRecordId(recordType));
    const cleanRoomId = sanitizeText(roomId);
    const collectionPath = collectionPathFor(recordType, cleanRoomId);
    const documentPath = sourcePathFor(recordType, cleanDocId, cleanRoomId);
    const existing = insertOnly
        ? null
        : await getRecordByTypeAndId(recordType, cleanDocId).catch(() => null);
    const existingData = rowData(existing);
    const now = nowIso();

    const nextData = {
        ...existingData,
        ...(data && typeof data === 'object' ? data : {}),
        updated_at: data.updated_at || data.updatedAt || now
    };

    if (!nextData.created_at && !nextData.createdAt) {
        nextData.created_at = existingData.created_at || existingData.createdAt || existing?.created_at_source || now;
    }

    const row = {
        firebase_app: firebaseApp,
        source_collection_path: collectionPath,
        source_collection_root: collectionPath.split('/')[0],
        source_collection_leaf: leafFor(recordType),
        source_document_id: cleanDocId,
        source_document_path: documentPath,
        record_type: recordType,
        owner_user_id: sanitizeText(ownerUserId) || existing?.owner_user_id || '',
        room_id: cleanRoomId || existing?.room_id || '',
        target_user_id: sanitizeText(targetUserId) || existing?.target_user_id || '',
        data: nextData,
        created_at_source: mapTimestamp(nextData.created_at || nextData.createdAt) || existing?.created_at_source || now,
        updated_at_source: mapTimestamp(nextData.updated_at || nextData.updatedAt) || now,
        updated_at: now
    };

    const query = yhuSupabaseAdmin
        .from(TABLE)
        .upsert(row, {
            onConflict: 'source_document_path',
            ignoreDuplicates: insertOnly === true
        })
        .select('*');

    const { data: saved, error } = insertOnly
        ? await query.maybeSingle()
        : await query.single();

    if (error) {
        throw new Error(
            'Realtime Supabase upsert failed: ' +
            error.message
        );
    }

    if (!saved && !insertOnly) {
        throw new Error(
            'Realtime Supabase upsert returned no record.'
        );
    }

    return saved || null;
}

async function deleteRecord(recordType, docId) {
    const { error } = await yhuSupabaseAdmin
        .from(TABLE)
        .delete()
        .eq('record_type', recordType)
        .eq('source_document_id', sanitizeText(docId));

    if (error) throw new Error('Realtime Supabase delete failed: ' + error.message);
    return true;
}

async function getUserDoc(userId) {
    const normalizedUserId =
        normalizeUserId(userId);

    if (!normalizedUserId) {
        return null;
    }

    /*
     * yhu_users is the canonical identity source.
     * Realtime user_profile rows remain compatibility
     * records only.
     */
    const canonicalUserRow =
        await yhuUsersSupabaseRepo
            .getByUid(
                normalizedUserId
            )
            .catch(() => null);

    const canonicalUser =
        canonicalUserRow
            ? mapCanonicalYhuUserToRealtimeUserV1(
                canonicalUserRow
            )
            : null;

    if (
        canonicalUser &&
        !isGenericRealtimeIdentityNameV3(
            canonicalUser.displayName,
            normalizedUserId
        )
    ) {
        return canonicalUser;
    }

    const compatibilityRow =
        await getRecordByTypeAndId(
            'user_profile',
            normalizedUserId
        );

    if (!compatibilityRow) {
        return canonicalUser;
    }

    const compatibilityData =
        rowData(
            compatibilityRow
        );

    const compatibilityUser =
        mapCanonicalYhuUserToRealtimeUserV1({
            ...compatibilityData,
            user_id:
                normalizedUserId,
            source_document_id:
                normalizedUserId,
            raw_data:
                compatibilityData,
            data:
                compatibilityData,
            public_meta:
                compatibilityData
        });

    if (!canonicalUser) {
        return compatibilityUser;
    }

    const mergedIdentity =
        resolveRealtimeUserIdentityV3(
            compatibilityUser || {},
            canonicalUser
        );

    return {
        ...canonicalUser,
        ...(compatibilityUser || {}),
        id:
            normalizedUserId,
        uid:
            normalizedUserId,
        userId:
            normalizedUserId,
        firebaseUid:
            normalizedUserId,
        fullName:
            mergedIdentity.fullName,
        name:
            mergedIdentity.name,
        displayName:
            mergedIdentity.displayName,
        username:
            mergedIdentity.username ||
            canonicalUser.username ||
            compatibilityUser?.username ||
            '',
        avatar:
            mergedIdentity.avatar ||
            canonicalUser.avatar ||
            compatibilityUser?.avatar ||
            '',
        profilePhoto:
            mergedIdentity.avatar ||
            canonicalUser.profilePhoto ||
            compatibilityUser?.profilePhoto ||
            '',
        photoURL:
            mergedIdentity.avatar ||
            canonicalUser.photoURL ||
            compatibilityUser?.photoURL ||
            ''
    };
}

function buildUserSummary(userDoc = {}) {
    const stats = userDoc.stats && typeof userDoc.stats === 'object' ? userDoc.stats : {};

    const identity =
        resolveRealtimeUserIdentityV3(
            userDoc
        );

    return {
        id:
            identity.userId ||
            sanitizeText(
                userDoc.id ||
                userDoc.uid ||
                userDoc.userId
            ),
        fullName:
            identity.fullName,
        username:
            identity.username,
        display_name:
            identity.displayName,
        avatar:
            identity.avatar,
        bio: sanitizeText(userDoc.bio),
        role_label: sanitizeText(userDoc.roleLabel || userDoc.role_label || userDoc.role || 'Member'),
        rep_points: toInt(stats.repPoints || stats.rep_points || userDoc.rep_points, 0),
        followers_count: toInt(stats.followersCount || stats.followers_count || userDoc.followers_count, 0),
        following_count: toInt(stats.followingCount || stats.following_count || userDoc.following_count, 0),
        messages_count: toInt(stats.messagesCount || stats.messages_count || userDoc.messages_count, 0)
    };
}

async function getUserSummary(userId) {
    const userDoc = await getUserDoc(userId);
    if (!userDoc) return null;
    return buildUserSummary(userDoc);
}

function getResolvedRealtimeDisplayNameV3(
    identity = {},
    userId = ''
) {
    const resolved =
        resolveRealtimeUserIdentityV3(
            identity,
            {
                userId
            }
        );

    const name =
        sanitizeText(
            resolved.displayName ||
            resolved.fullName ||
            resolved.username
        );

    return isGenericRealtimeIdentityNameV3(
        name,
        userId
    )
        ? ''
        : name;
}

async function enrichChatMessageAuthorsV3(
    messages = []
) {
    const list =
        Array.isArray(messages)
            ? messages
            : [];

    const authorIds =
        Array.from(
            new Set(
                list
                    .filter((message) =>
                        message?.authorId &&
                        isGenericRealtimeIdentityNameV3(
                            message?.author,
                            message?.authorId
                        )
                    )
                    .map((message) =>
                        normalizeUserId(
                            message.authorId
                        )
                    )
                    .filter(Boolean)
            )
        );

    if (!authorIds.length) {
        return list;
    }

    const summaries =
        await Promise.all(
            authorIds.map(async (userId) => [
                userId,
                await getUserSummary(userId)
                    .catch(() => null)
            ])
        );

    const identityByUserId =
        new Map(
            summaries
        );

    return list.map((message) => {
        const authorId =
            normalizeUserId(
                message?.authorId
            );

        const summary =
            identityByUserId.get(
                authorId
            );

        const author =
            getResolvedRealtimeDisplayNameV3(
                summary || {},
                authorId
            );

        if (!author) {
            return message;
        }

        return {
            ...message,
            author,
            initial:
                author
                    .charAt(0)
                    .toUpperCase(),
            avatar:
                sanitizeText(
                    summary?.avatar ||
                    message?.avatar
                )
        };
    });
}

async function enrichLiveRoomHostIdentityV3(
    room = {}
) {
    const hostUserId =
        normalizeUserId(
            room?.host_user_id ||
            room?.hostUserId
        );

    const storedName =
        sanitizeText(
            room?.host_user_name ||
            room?.hostUserName
        );

    if (
        !hostUserId ||
        !isGenericRealtimeIdentityNameV3(
            storedName,
            hostUserId
        )
    ) {
        return room;
    }

    const summary =
        await getUserSummary(
            hostUserId
        ).catch(() => null);

    const hostName =
        getResolvedRealtimeDisplayNameV3(
            summary || {},
            hostUserId
        );

    return {
        ...room,
        host_user_name:
            hostName ||
            storedName ||
            'YH Member'
    };
}

function normalizeMemberIds(data = {}) {
    return safeArray(data.member_ids || data.memberIds)
        .map((value) => sanitizeText(value))
        .filter(Boolean);
}

function normalizeStringArray(value) {
    return safeArray(value)
        .map((item) => sanitizeText(item))
        .filter(Boolean);
}

/* PATCH: Realtime Supabase room query and mutation helpers v1 */
function buildDeterministicDmRoomIdV1(
    userOneId = '',
    userTwoId = ''
) {
    const pair =
        [
            normalizeUserId(userOneId),
            normalizeUserId(userTwoId)
        ]
            .filter(Boolean)
            .sort();

    if (pair.length !== 2) {
        return '';
    }

    return (
        'dm_' +
        crypto
            .createHash('sha256')
            .update(
                pair.join('|')
            )
            .digest('hex')
            .slice(0, 32)
    );
}

async function listChatRoomRowsForMemberV1(
    userId = '',
    limit = 1000
) {
    const cleanUserId =
        normalizeUserId(userId);

    if (!cleanUserId) {
        return [];
    }

    const safeLimit =
        Math.max(
            1,
            Math.min(
                5000,
                Number(limit) || 1000
            )
        );

    const [
        snakeRows,
        camelRows
    ] = await Promise.all([
        listRealtimeRowsPagedV1(
            () =>
                yhuSupabaseAdmin
                    .from(TABLE)
                    .select('*')
                    .eq(
                        'record_type',
                        'chat_room'
                    )
                    .contains(
                        'data',
                        {
                            member_ids: [
                                cleanUserId
                            ]
                        }
                    )
                    .order(
                        'updated_at_source',
                        {
                            ascending: false,
                            nullsFirst: false
                        }
                    ),
            {
                maxRows:
                    safeLimit,
                label:
                    'Realtime member rooms'
            }
        ),

        listRealtimeRowsPagedV1(
            () =>
                yhuSupabaseAdmin
                    .from(TABLE)
                    .select('*')
                    .eq(
                        'record_type',
                        'chat_room'
                    )
                    .contains(
                        'data',
                        {
                            memberIds: [
                                cleanUserId
                            ]
                        }
                    )
                    .order(
                        'updated_at_source',
                        {
                            ascending: false,
                            nullsFirst: false
                        }
                    ),
            {
                maxRows:
                    safeLimit,
                label:
                    'Realtime member rooms'
            }
        )
    ]);

    const rowsById =
        new Map();

    [
        ...snakeRows,
        ...camelRows
    ].forEach((row) => {
        const roomId =
            sanitizeText(
                row.source_document_id
            );

        if (roomId) {
            rowsById.set(
                roomId,
                row
            );
        }
    });

    return [
        ...rowsById.values()
    ]
        .sort((a, b) =>
            String(
                b.updated_at_source ||
                ''
            ).localeCompare(
                String(
                    a.updated_at_source ||
                    ''
                )
            )
        )
        .slice(
            0,
            safeLimit
        );
}

async function mutateChatRoomDataV1(
    roomId = '',
    mutate,
    {
        maxAttempts = 5
    } = {}
) {
    const cleanRoomId =
        sanitizeText(roomId);

    if (
        !cleanRoomId ||
        typeof mutate !== 'function'
    ) {
        throw realtimeHttpErrorV1(
            'Valid room mutation is required.',
            400
        );
    }

    const safeAttempts =
        Math.max(
            1,
            Math.min(
                10,
                Number(maxAttempts) || 5
            )
        );

    for (
        let attempt = 0;
        attempt < safeAttempts;
        attempt += 1
    ) {
        const current =
            await getRecordByTypeAndId(
                'chat_room',
                cleanRoomId
            );

        if (!current) {
            throw realtimeHttpErrorV1(
                'Room not found.',
                404
            );
        }

        const currentData =
            rowData(current);

        const mutated =
            await mutate(
                {
                    ...currentData
                },
                current
            );

        if (
            !mutated ||
            typeof mutated !== 'object' ||
            Array.isArray(mutated)
        ) {
            throw realtimeHttpErrorV1(
                'Invalid room mutation result.',
                500
            );
        }

        const now =
            nowIso();

        let query =
            yhuSupabaseAdmin
                .from(TABLE)
                .update({
                    data: {
                        ...mutated,
                        updated_at: now
                    },

                    updated_at_source:
                        now,

                    updated_at:
                        now
                })
                .eq(
                    'id',
                    current.id
                )
                .eq(
                    'record_type',
                    'chat_room'
                )
                .eq(
                    'source_document_id',
                    cleanRoomId
                );

        if (current.updated_at) {
            query =
                query.eq(
                    'updated_at',
                    current.updated_at
                );
        }

        const {
            data: saved,
            error
        } = await query
            .select('*')
            .maybeSingle();

        if (error) {
            throw new Error(
                `Realtime room update failed: ${error.message}`
            );
        }

        if (saved) {
            return saved;
        }
    }

    throw realtimeHttpErrorV1(
        'Conversation changed during the request. Please retry.',
        409
    );
}

async function getChatRoomActionContextV1(
    userId = '',
    roomId = ''
) {
    const cleanUserId =
        normalizeUserId(userId);

    const cleanRoomId =
        sanitizeText(roomId);

    if (
        !cleanUserId ||
        !cleanRoomId ||
        cleanRoomId ===
            'YH-community' ||
        cleanRoomId ===
            'main-chat'
    ) {
        throw realtimeHttpErrorV1(
            'Valid private room is required.',
            400
        );
    }

    const row =
        await getRecordByTypeAndId(
            'chat_room',
            cleanRoomId
        );

    if (!row) {
        throw realtimeHttpErrorV1(
            'Conversation not found.',
            404
        );
    }

    const data =
        rowData(row);

    const memberIds =
        normalizeMemberIds(
            data
        );

    if (
        !memberIds.includes(
            cleanUserId
        )
    ) {
        throw realtimeHttpErrorV1(
            'Access denied for this room.',
            403
        );
    }

    return {
        row,
        roomData:
            data,
        room:
            mapRoomRow(
                row,
                cleanUserId
            ),
        memberIds,
        otherMemberIds:
            memberIds.filter(
                (memberId) =>
                    memberId &&
                    memberId !==
                        cleanUserId
            )
    };
}
/* END PATCH: Realtime Supabase room query and mutation helpers v1 */

function mapRoomRow(row = {}, viewerId = '') {
    const data = rowData(row);
    const memberIds = normalizeMemberIds(data);

    const hiddenForUserIds =
        normalizeStringArray(
            data.hidden_for_user_ids ||
            data.hiddenForUserIds
        );

    const mutedForUserIds =
        normalizeStringArray(
            data.muted_for_user_ids ||
            data.mutedForUserIds
        );

    const restrictedByUserIds =
        normalizeStringArray(
            data.restricted_by_user_ids ||
            data.restrictedByUserIds
        );

    const blockedByUserIds =
        normalizeStringArray(
            data.blocked_by_user_ids ||
            data.blockedByUserIds
        );

    const blockedByOwnerUserIds =
        normalizeStringArray(
            data.blocked_by_owner_user_ids ||
            data.blockedByOwnerUserIds
        );

    const unreadCounts =
        data.unread_counts &&
        typeof data.unread_counts === 'object'
            ? data.unread_counts
            : data.unreadCounts &&
                typeof data.unreadCounts === 'object'
                ? data.unreadCounts
                : {};

    const normalizedViewerId =
        sanitizeText(viewerId);

    const legacyBlockedByMe =
        Boolean(
            normalizedViewerId &&
            !blockedByOwnerUserIds.length &&
            blockedByUserIds.includes(
                normalizedViewerId
            )
        );

    const isBlockedByMe =
        Boolean(
            normalizedViewerId &&
            (
                blockedByOwnerUserIds.includes(
                    normalizedViewerId
                ) ||
                legacyBlockedByMe
            )
        );

    const isBlockedForMe =
        Boolean(
            normalizedViewerId &&
            (
                blockedByOwnerUserIds.length
                    ? (
                        blockedByUserIds.includes(
                            normalizedViewerId
                        ) &&
                        !isBlockedByMe
                    )
                    : blockedByUserIds.some(
                        (userId) =>
                            userId !==
                            normalizedViewerId
                    )
            )
        );

    return {
        id:
            row.source_document_id,

        room_key:
            sanitizeText(
                data.room_key ||
                data.roomKey
            ),

        room_type:
            sanitizeText(
                data.room_type ||
                data.roomType ||
                'group'
            ),

        name:
            sanitizeText(
                data.name
            ),

        description:
            sanitizeText(
                data.description
            ),

        is_private:
            data.is_private ||
            data.isPrivate
                ? 1
                : 0,

        created_by_user_id:
            sanitizeText(
                data.created_by_user_id ||
                data.createdByUserId ||
                row.owner_user_id
            ),

        created_at:
            mapTimestamp(
                data.created_at ||
                data.createdAt ||
                row.created_at_source
            ),

        updated_at:
            mapTimestamp(
                data.updated_at ||
                data.updatedAt ||
                row.updated_at_source
            ),

        member_count:
            toInt(
                data.member_count ||
                data.memberCount,
                memberIds.length
            ),

        member_ids:
            memberIds,

        hidden_for_user_ids:
            hiddenForUserIds,

        muted_for_user_ids:
            mutedForUserIds,

        restricted_by_user_ids:
            restrictedByUserIds,

        blocked_by_user_ids:
            blockedByUserIds,

        blocked_by_owner_user_ids:
            blockedByOwnerUserIds,

        last_message_text:
            sanitizeText(
                data.last_message_text ||
                data.lastMessageText
            ),

        last_message_author:
            sanitizeText(
                data.last_message_author ||
                data.lastMessageAuthor
            ),

        last_message_at:
            mapTimestamp(
                data.last_message_at ||
                data.lastMessageAt ||
                data.updated_at ||
                data.updatedAt ||
                row.updated_at_source
            ),

        unread_count:
            normalizedViewerId
                ? toInt(
                    unreadCounts[
                        normalizedViewerId
                    ],
                    0
                )
                : 0,

        is_hidden:
            normalizedViewerId
                ? hiddenForUserIds.includes(
                    normalizedViewerId
                )
                : false,

        is_muted:
            normalizedViewerId
                ? mutedForUserIds.includes(
                    normalizedViewerId
                )
                : false,

        is_restricted_by_me:
            normalizedViewerId
                ? restrictedByUserIds.includes(
                    normalizedViewerId
                )
                : false,

        is_blocked_by_me:
            isBlockedByMe,

        is_blocked:
            isBlockedForMe
    };
}

async function getBootstrap(userId) {
    const normalizedUserId =
        normalizeUserId(userId);

    if (!normalizedUserId) {
        throw realtimeHttpErrorV1(
            'Missing user id.',
            400
        );
    }

    /*
     * Profile and rooms are critical. Never convert a
     * Supabase failure into an empty successful inbox.
     */
    const [
        selfProfile,
        rooms
    ] = await Promise.all([
        getUserSummary(
            normalizedUserId
        ),

        getRooms(
            normalizedUserId
        )
    ]);

    const [
        vaultItems,
        liveRooms,
        notifications,
        leaderboard
    ] = await Promise.all([
        safeBootstrapSection(
            'vaultItems',
            () =>
                getVaultItems(
                    normalizedUserId
                ),
            []
        ),

        safeBootstrapSection(
            'liveRooms',
            () =>
                getLiveRooms(),
            []
        ),

        getNotifications(
            normalizedUserId
        ),

        safeBootstrapSection(
            'leaderboard',
            () =>
                getLeaderboard(20),
            []
        )
    ]);

    return {
        selfProfile,

        rooms:
            Array.isArray(rooms)
                ? rooms
                : [],

        vaultItems:
            Array.isArray(vaultItems)
                ? vaultItems
                : [],

        liveRooms:
            Array.isArray(liveRooms)
                ? liveRooms
                : [],

        notifications:
            Array.isArray(notifications)
                ? notifications
                : [],

        leaderboard:
            Array.isArray(leaderboard)
                ? leaderboard
                : []
    };
}

async function enrichRoomForViewer(room = {}, viewerId = '') {
    const normalizedViewerId = normalizeUserId(viewerId);
    const memberIds = safeArray(room.member_ids)
        .map((value) => normalizeUserId(value))
        .filter(Boolean);

    const otherMemberIds = memberIds.filter((memberId) => memberId && memberId !== normalizedViewerId);

    const participantDocs = await Promise.all(
        otherMemberIds.slice(0, 8).map((memberId) => getUserDoc(memberId).catch(() => null))
    );

    const participantSummaries = participantDocs
        .map((doc) => (doc ? buildUserSummary(doc) : null))
        .filter(Boolean);

    const participantNames = participantSummaries
        .map((user) => sanitizeText(user.display_name || user.fullName || user.username))
        .filter(Boolean);

    const roomType = sanitizeText(room.room_type || room.type || 'group').toLowerCase();

    if (roomType === 'dm') {
        const recipient = participantSummaries[0] || null;
        const recipientId = sanitizeText(recipient?.id || otherMemberIds[0]);
        const recipientName =
            sanitizeText(recipient?.display_name || recipient?.fullName || recipient?.username) ||
            sanitizeText(room.name) ||
            'Direct Message';
        const recipientAvatar = sanitizeText(recipient?.avatar);

        return {
            ...room,
            name: recipientName,
            avatar: recipientAvatar,
            avatarUrl: recipientAvatar,
            recipient_id: recipientId,
            recipient_name: recipientName,
            member_names: recipientName ? [recipientName] : [],
            participantNames: recipientName ? [recipientName] : []
        };
    }

    return {
        ...room,
        member_names: participantNames,
        participantNames
    };
}

function mapVaultRow(row = {}) {
    const data = rowData(row);

    return {
        id: row.source_document_id,
        user_id: sanitizeText(data.user_id || data.userId || row.owner_user_id),
        parent_id: sanitizeText(data.parent_id || data.parentId),
        item_type: sanitizeText(data.item_type || data.itemType || 'folder'),
        name: sanitizeText(data.name),
        file_path: sanitizeText(data.file_path || data.filePath),
        mime_type: sanitizeText(data.mime_type || data.mimeType),
        file_size: toInt(data.file_size || data.fileSize, 0),
        created_at: mapTimestamp(data.created_at || data.createdAt || row.created_at_source),
        updated_at: mapTimestamp(data.updated_at || data.updatedAt || row.updated_at_source)
    };
}

function mapLiveRoomRow(row = {}) {
    const data = rowData(row);
    const participantIds = safeArray(data.participant_ids || data.participantIds)
        .map((value) => sanitizeText(value))
        .filter(Boolean);

    return {
        id: row.source_document_id,
        room_key: sanitizeText(data.room_key || data.roomKey),
        room_type: sanitizeText(data.room_type || data.roomType || 'voice'),
        title: sanitizeText(data.title),
        topic: sanitizeText(data.topic),
        host_user_id: sanitizeText(data.host_user_id || data.hostUserId || row.owner_user_id),
        host_user_name: sanitizeText(data.host_user_name || data.hostUserName),
        status: sanitizeText(data.status || 'live'),
        created_at: mapTimestamp(data.created_at || data.createdAt || row.created_at_source),
        ended_at: mapTimestamp(data.ended_at || data.endedAt),
        participant_ids: participantIds,
        participant_count: toInt(data.participant_count || data.participantCount, participantIds.length)
    };
}

const YH_LIVE_ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getLiveRoomStartMs(room = {}) {
    const candidates = [
        room.created_at,
        room.createdAt,
        room.started_at,
        room.startedAt,
        room.updated_at,
        room.updatedAt
    ];

    for (const value of candidates) {
        const mapped = mapTimestamp(value);
        if (!mapped) continue;

        const parsed = Date.parse(mapped);
        if (Number.isFinite(parsed)) return parsed;
    }

    return 0;
}

function isLiveRoomExpired(room = {}) {
    const startedMs = getLiveRoomStartMs(room);
    if (!startedMs) return false;

    return Date.now() - startedMs >= YH_LIVE_ROOM_MAX_AGE_MS;
}

function isLiveRoomJoinable(room = {}) {
    const status = sanitizeText(room.status || 'live').toLowerCase();

    if (status !== 'live') return false;
    if (room.ended_at || room.endedAt) return false;
    if (isLiveRoomExpired(room)) return false;

    return true;
}

async function markExpiredLiveRoomEnded(row = {}) {
    const room = mapLiveRoomRow(row);

    if (!room.id || !isLiveRoomExpired(room)) return null;
    if (sanitizeText(room.status || '').toLowerCase() !== 'live') return null;

    const data = rowData(row);
    const endedAt = nowIso();

    return upsertRecord({
        recordType: 'live_room',
        docId: row.source_document_id,
        ownerUserId: row.owner_user_id,
        roomId: row.room_id || row.source_document_id,
        data: {
            ...data,
            status: 'ended',
            ended_at: data.ended_at || data.endedAt || endedAt,
            autoEnded: true,
            auto_end_reason: '24_hour_limit',
            auto_ended_at: endedAt,
            participant_ids: [],
            participant_count: 0
        }
    });
}

function mapNotificationRow(row = {}) {
    const data = rowData(row);

    const readAt =
        mapTimestamp(
            data.read_at ||
            data.readAt
        );

    const isRead =
        data.is_read === true ||
        data.isRead === true ||
        data.read === true ||
        Boolean(readAt);

    const body =
        sanitizeText(
            data.body ||
            data.text ||
            data.message
        );

    const metadata =
        data.metadata &&
        typeof data.metadata === 'object' &&
        !Array.isArray(data.metadata)
            ? data.metadata
            : {};

    return {
        id: row.source_document_id,
        notificationId: row.source_document_id,

        type: sanitizeText(data.type),
        title: sanitizeText(
            data.title ||
            'Notification'
        ),

        body,
        text: body,
        message: body,

        source: sanitizeText(
            data.source ||
            data.notification_source
        ),

        notificationType: sanitizeText(
            data.notificationType ||
            data.notification_type ||
            data.type
        ),

        notification_type: sanitizeText(
            data.notification_type ||
            data.notificationType ||
            data.type
        ),

        color: sanitizeText(
            data.color ||
            'var(--neon-blue)'
        ),

        avatarStr: sanitizeText(
            data.avatarStr ||
            data.avatar_str ||
            data.initial ||
            'N'
        ),

        avatar_str: sanitizeText(
            data.avatar_str ||
            data.avatarStr ||
            data.initial ||
            'N'
        ),

        initial: sanitizeText(
            data.initial ||
            data.avatarStr ||
            data.avatar_str ||
            'N'
        ),

        target: sanitizeText(
            data.target ||
            data.target_type ||
            data.targetType
        ),

        target_type: sanitizeText(
            data.target_type ||
            data.targetType ||
            data.target
        ),

        targetType: sanitizeText(
            data.targetType ||
            data.target_type ||
            data.target
        ),

        target_id: sanitizeText(
            data.target_id ||
            data.targetId ||
            row.target_user_id
        ),

        targetId: sanitizeText(
            data.targetId ||
            data.target_id ||
            row.target_user_id
        ),

        metadata,

        is_read: isRead,
        isRead,
        read: isRead,

        read_at: readAt,
        readAt,

        created_at: mapTimestamp(
            data.created_at ||
            data.createdAt ||
            row.created_at_source
        ),

        createdAt: mapTimestamp(
            data.createdAt ||
            data.created_at ||
            row.created_at_source
        )
    };
}


/* PATCH: Realtime notification authority and delivery v2 */
function emitCreatedNotificationV2(
    userId = '',
    notification = null
) {
    const cleanUserId =
        normalizeUserId(userId);

    if (
        !cleanUserId ||
        !notification ||
        typeof notification !== 'object' ||
        typeof global.yhEmitRealtimeNotification !== 'function'
    ) {
        return false;
    }

    try {
        return global.yhEmitRealtimeNotification(
            cleanUserId,
            notification
        ) === true;
    } catch (error) {
        console.warn(
            'Realtime notification live delivery skipped:',
            error?.message || error
        );

        return false;
    }
}

async function listNotificationRowsForUserV2(
    userId = '',
    limit = 100
) {
    const cleanUserId =
        normalizeUserId(userId);

    if (!cleanUserId) {
        throw realtimeHttpErrorV1(
            'Notification recipient is required.',
            400
        );
    }

    const safeLimit =
        Math.max(
            1,
            Math.min(
                500,
                Number(limit) || 100
            )
        );

    const fetchLimit =
        Math.min(
            1000,
            Math.max(
                safeLimit * 2,
                100
            )
        );

    const [ownerRows, legacySnakeRows, legacyCamelRows] =
        await Promise.all([
            listRealtimeRowsPagedV1(
                () =>
                    yhuSupabaseAdmin
                        .from(TABLE)
                        .select('*')
                        .eq(
                            'record_type',
                            'notification'
                        )
                        .eq(
                            'owner_user_id',
                            cleanUserId
                        )
                        .order(
                            'created_at_source',
                            {
                                ascending: false,
                                nullsFirst: false
                            }
                        ),
                {
                    maxRows: fetchLimit,
                    label:
                        'Realtime user notifications'
                }
            ),

            listRealtimeRowsPagedV1(
                () =>
                    yhuSupabaseAdmin
                        .from(TABLE)
                        .select('*')
                        .eq(
                            'record_type',
                            'notification'
                        )
                        .contains(
                            'data',
                            {
                                user_id:
                                    cleanUserId
                            }
                        )
                        .order(
                            'created_at_source',
                            {
                                ascending: false,
                                nullsFirst: false
                            }
                        ),
                {
                    maxRows: fetchLimit,
                    label:
                        'Realtime legacy user notifications'
                }
            ),

            listRealtimeRowsPagedV1(
                () =>
                    yhuSupabaseAdmin
                        .from(TABLE)
                        .select('*')
                        .eq(
                            'record_type',
                            'notification'
                        )
                        .contains(
                            'data',
                            {
                                userId:
                                    cleanUserId
                            }
                        )
                        .order(
                            'created_at_source',
                            {
                                ascending: false,
                                nullsFirst: false
                            }
                        ),
                {
                    maxRows: fetchLimit,
                    label:
                        'Realtime legacy camel-case notifications'
                }
            )
        ]);

    const rowsById =
        new Map();

    [
        ...ownerRows,
        ...legacySnakeRows,
        ...legacyCamelRows
    ].forEach((row) => {
        const data =
            rowData(row);

        const owner =
            normalizeUserId(
                row.owner_user_id ||
                data.user_id ||
                data.userId
            );

        const notificationId =
            sanitizeText(
                row.source_document_id
            );

        if (
            owner === cleanUserId &&
            notificationId
        ) {
            rowsById.set(
                notificationId,
                row
            );
        }
    });

    return Array.from(
        rowsById.values()
    )
        .sort((a, b) => {
            const aTime =
                Date.parse(
                    mapTimestamp(
                        rowData(a).created_at ||
                        rowData(a).createdAt ||
                        a.created_at_source
                    ) || ''
                ) || 0;

            const bTime =
                Date.parse(
                    mapTimestamp(
                        rowData(b).created_at ||
                        rowData(b).createdAt ||
                        b.created_at_source
                    ) || ''
                ) || 0;

            if (aTime !== bTime) {
                return bTime - aTime;
            }

            return String(
                b.source_document_id || ''
            ).localeCompare(
                String(
                    a.source_document_id || ''
                )
            );
        })
        .slice(0, safeLimit);
}

async function markNotificationReadV2({
    userId = '',
    notificationId = '',
    maxAttempts = 5
} = {}) {
    const cleanUserId =
        normalizeUserId(userId);

    const cleanNotificationId =
        sanitizeText(notificationId);

    if (
        !cleanUserId ||
        !cleanNotificationId
    ) {
        throw realtimeHttpErrorV1(
            'Notification id and user are required.',
            400
        );
    }

    const attempts =
        Math.max(
            1,
            Math.min(
                10,
                Number(maxAttempts) || 5
            )
        );

    for (
        let attempt = 0;
        attempt < attempts;
        attempt += 1
    ) {
        const current =
            await getRecordByTypeAndId(
                'notification',
                cleanNotificationId
            );

        if (!current) {
            throw realtimeHttpErrorV1(
                'Notification not found.',
                404
            );
        }

        const currentData =
            rowData(current);

        const owner =
            normalizeUserId(
                current.owner_user_id ||
                currentData.user_id ||
                currentData.userId
            );

        if (owner !== cleanUserId) {
            throw realtimeHttpErrorV1(
                'Notification not found.',
                404
            );
        }

        const mapped =
            mapNotificationRow(current);

        if (mapped.isRead) {
            return mapped;
        }

        const readAt =
            nowIso();

        let query =
            yhuSupabaseAdmin
                .from(TABLE)
                .update({
                    data: {
                        ...currentData,
                        is_read: true,
                        isRead: true,
                        read: true,
                        read_at: readAt,
                        readAt,
                        updated_at: readAt,
                        updatedAt: readAt
                    },
                    updated_at_source:
                        readAt,
                    updated_at:
                        readAt
                })
                .eq(
                    'id',
                    current.id
                )
                .eq(
                    'record_type',
                    'notification'
                )
                .eq(
                    'source_document_id',
                    cleanNotificationId
                );

        if (current.updated_at) {
            query =
                query.eq(
                    'updated_at',
                    current.updated_at
                );
        }

        const {
            data: saved,
            error
        } = await query
            .select('*')
            .maybeSingle();

        if (error) {
            throw new Error(
                'Realtime notification update failed: ' +
                error.message
            );
        }

        if (saved) {
            return mapNotificationRow(
                saved
            );
        }
    }

    throw realtimeHttpErrorV1(
        'Notification changed during the request. Retry.',
        409
    );
}
/* END PATCH: Realtime notification authority and delivery v2 */


async function safeBootstrapSection(label, promiseFactory, fallback) {
    try {
        return await promiseFactory();
    } catch (error) {
        console.error('realtime bootstrap section failed:', label, error?.message || error);
        return fallback;
    }
}

async function getRooms(userId) {
    const normalizedUserId =
        normalizeUserId(userId);

    if (!normalizedUserId) {
        throw realtimeHttpErrorV1(
            'Missing user id.',
            400
        );
    }

    const rows =
        await listChatRoomRowsForMemberV1(
            normalizedUserId,
            1000
        );

    const rooms =
        rows
            .map((row) =>
                mapRoomRow(
                    row,
                    normalizedUserId
                )
            )
            .filter((room) =>
                safeArray(
                    room.member_ids
                ).includes(
                    normalizedUserId
                ) &&
                !room.is_hidden &&
                !room.is_blocked
            )
            .sort((a, b) =>
                String(
                    b.last_message_at ||
                    b.updated_at ||
                    ''
                ).localeCompare(
                    String(
                        a.last_message_at ||
                        a.updated_at ||
                        ''
                    )
                )
            )
            .slice(0, 100);

    return Promise.all(
        rooms.map((room) =>
            enrichRoomForViewer(
                room,
                normalizedUserId
            )
        )
    );
}

async function createRoom({
    userId,
    roomType = 'group',
    description = '',
    name = '',
    memberUserIds = [],
    targetUserId = ''
} = {}) {
    const creatorId =
        normalizeUserId(userId);

    if (!creatorId) {
        throw realtimeHttpErrorV1(
            'Missing user id.',
            400
        );
    }

    const cleanRoomType =
        sanitizeText(
            roomType ||
            'group'
        ).toLowerCase();

    if (
        ![
            'dm',
            'group'
        ].includes(
            cleanRoomType
        )
    ) {
        throw realtimeHttpErrorV1(
            'Room type must be dm or group.',
            400
        );
    }

    const members =
        new Set([
            creatorId
        ]);

    safeArray(
        memberUserIds
    ).forEach((memberId) => {
        const cleanMemberId =
            normalizeUserId(
                memberId
            );

        if (
            cleanMemberId &&
            cleanMemberId !==
                creatorId
        ) {
            members.add(
                cleanMemberId
            );
        }
    });

    const target =
        normalizeUserId(
            targetUserId
        );

    let docId =
        makeRecordId('room');

    if (
        cleanRoomType ===
        'dm'
    ) {
        if (
            !target ||
            target === creatorId
        ) {
            throw realtimeHttpErrorV1(
                'A valid target user is required.',
                400
            );
        }

        const targetUser =
            await getUserDoc(
                target
            );

        if (!targetUser) {
            throw realtimeHttpErrorV1(
                'Target user not found.',
                404
            );
        }

        members.clear();
        members.add(
            creatorId
        );
        members.add(
            target
        );

        const existingRows =
            await listChatRoomRowsForMemberV1(
                creatorId,
                1000
            );

        const existingRow =
            existingRows.find((row) => {
                const data =
                    rowData(row);

                const ids =
                    normalizeMemberIds(
                        data
                    ).sort();

                return (
                    sanitizeText(
                        data.room_type ||
                        data.roomType
                    ).toLowerCase() ===
                        'dm' &&
                    ids.length === 2 &&
                    ids.includes(
                        creatorId
                    ) &&
                    ids.includes(
                        target
                    )
                );
            });

        if (existingRow) {
            const savedExisting =
                await mutateChatRoomDataV1(
                    existingRow
                        .source_document_id,
                    (currentData) => {
                        const hiddenForUserIds =
                            new Set(
                                normalizeStringArray(
                                    currentData.hidden_for_user_ids ||
                                    currentData.hiddenForUserIds
                                )
                            );

                        hiddenForUserIds.delete(
                            creatorId
                        );

                        return {
                            ...currentData,

                            hidden_for_user_ids:
                                [
                                    ...hiddenForUserIds
                                ]
                        };
                    }
                );

            return {
                room:
                    await enrichRoomForViewer(
                        mapRoomRow(
                            savedExisting,
                            creatorId
                        ),
                        creatorId
                    ),

                reused: true
            };
        }

        docId =
            buildDeterministicDmRoomIdV1(
                creatorId,
                target
            );
    } else {
        if (
            members.size < 2
        ) {
            throw realtimeHttpErrorV1(
                'Add at least one valid member to the group.',
                400
            );
        }

        if (
            members.size > 50
        ) {
            throw realtimeHttpErrorV1(
                'A group can have up to 50 members.',
                400
            );
        }

        const memberChecks =
            await Promise.all(
                [
                    ...members
                ]
                    .filter(
                        (memberId) =>
                            memberId !==
                            creatorId
                    )
                    .map((memberId) =>
                        getUserDoc(
                            memberId
                        )
                    )
            );

        if (
            memberChecks.some(
                (member) =>
                    !member
            )
        ) {
            throw realtimeHttpErrorV1(
                'One or more group members were not found.',
                404
            );
        }
    }

    const existingDeterministicRow =
        await getRecordByTypeAndId(
            'chat_room',
            docId
        );

    if (existingDeterministicRow) {
        return {
            room:
                await enrichRoomForViewer(
                    mapRoomRow(
                        existingDeterministicRow,
                        creatorId
                    ),
                    creatorId
                ),

            reused: true
        };
    }

    const now =
        nowIso();

    const memberIds =
        [
            ...members
        ];

    const row =
        await upsertRecord({
            recordType:
                'chat_room',

            docId,

            ownerUserId:
                creatorId,

            roomId:
                docId,

            data: {
                room_key:
                    cleanRoomType ===
                    'dm'
                        ? docId
                        : makeRoomKey(
                            cleanRoomType
                        ),

                room_type:
                    cleanRoomType,

                name:
                    sanitizeText(name) ||
                    (
                        cleanRoomType ===
                        'dm'
                            ? 'Direct Message'
                            : 'New Room'
                    ),

                description:
                    sanitizeText(
                        description
                    ),

                is_private:
                    cleanRoomType ===
                    'dm',

                created_by_user_id:
                    creatorId,

                created_at:
                    now,

                updated_at:
                    now,

                member_count:
                    memberIds.length,

                member_ids:
                    memberIds,

                hidden_for_user_ids:
                    [],

                muted_for_user_ids:
                    [],

                restricted_by_user_ids:
                    [],

                blocked_by_user_ids:
                    [],

                blocked_by_owner_user_ids:
                    [],

                unread_counts:
                    {},

                last_message_text:
                    '',

                last_message_author:
                    '',

                last_message_at:
                    now
            }
        });

    return {
        room:
            await enrichRoomForViewer(
                mapRoomRow(
                    row,
                    creatorId
                ),
                creatorId
            ),

        reused: false
    };
}

async function updateRoomArray({
    userId,
    roomId,
    field,
    enabled
}) {
    const normalizedUserId =
        normalizeUserId(userId);

    const cleanField =
        sanitizeText(field);

    if (
        ![
            'hidden_for_user_ids',
            'muted_for_user_ids'
        ].includes(
            cleanField
        )
    ) {
        throw realtimeHttpErrorV1(
            'Unsupported room preference.',
            400
        );
    }

    await getChatRoomActionContextV1(
        normalizedUserId,
        roomId
    );

    const saved =
        await mutateChatRoomDataV1(
            roomId,
            (data) => {
                const current =
                    new Set(
                        normalizeStringArray(
                            data[
                                cleanField
                            ]
                        )
                    );

                if (enabled) {
                    current.add(
                        normalizedUserId
                    );
                } else {
                    current.delete(
                        normalizedUserId
                    );
                }

                return {
                    ...data,

                    [cleanField]:
                        [
                            ...current
                        ]
                };
            }
        );

    return mapRoomRow(
        saved,
        normalizedUserId
    );
}

async function deleteRoom({
    userId,
    roomId
} = {}) {
    const normalizedUserId =
        normalizeUserId(userId);

    const context =
        await getChatRoomActionContextV1(
            normalizedUserId,
            roomId
        );

    const roomType =
        sanitizeText(
            context.roomData.room_type ||
            context.roomData.roomType
        ).toLowerCase();

    const creatorId =
        sanitizeText(
            context.roomData
                .created_by_user_id ||
            context.roomData
                .createdByUserId ||
            context.row
                .owner_user_id
        );

    if (
        roomType !== 'dm' &&
        creatorId &&
        creatorId ===
            normalizedUserId
    ) {
        const {
            error: messagesError
        } = await yhuSupabaseAdmin
            .from(TABLE)
            .delete()
            .eq(
                'record_type',
                'chat_message'
            )
            .eq(
                'room_id',
                sanitizeText(
                    roomId
                )
            );

        if (messagesError) {
            throw new Error(
                `Room message cleanup failed: ${messagesError.message}`
            );
        }

        await deleteRecord(
            'chat_room',
            roomId
        );

        return {
            deletedRoomId:
                sanitizeText(
                    roomId
                ),

            permanentlyDeleted:
                true
        };
    }

    await updateRoomArray({
        userId:
            normalizedUserId,

        roomId,

        field:
            'hidden_for_user_ids',

        enabled: true
    });

    return {
        deletedRoomId:
            sanitizeText(
                roomId
            ),

        hidden: true,
        permanentlyDeleted: false
    };
}

async function hideRoomForUser({
    userId,
    roomId,
    hidden = true
} = {}) {
    return updateRoomArray({
        userId,
        roomId,
        field:
            'hidden_for_user_ids',
        enabled:
            hidden !== false
    });
}

async function setRoomMuted({
    userId,
    roomId,
    muted = true
} = {}) {
    return updateRoomArray({
        userId,
        roomId,
        field:
            'muted_for_user_ids',
        enabled:
            muted !== false
    });
}

async function setRoomRestricted({
    userId,
    roomId,
    restricted = true
} = {}) {
    const normalizedUserId =
        normalizeUserId(userId);

    const context =
        await getChatRoomActionContextV1(
            normalizedUserId,
            roomId
        );

    const roomType =
        sanitizeText(
            context.roomData.room_type ||
            context.roomData.roomType
        ).toLowerCase();

    if (
        roomType !== 'dm' &&
        context.memberIds.length !== 2
    ) {
        throw realtimeHttpErrorV1(
            'Restrict is only available for direct messages.',
            400
        );
    }

    const saved =
        await mutateChatRoomDataV1(
            roomId,
            (data) => {
                const restrictedByUserIds =
                    new Set(
                        normalizeStringArray(
                            data.restricted_by_user_ids ||
                            data.restrictedByUserIds
                        )
                    );

                if (
                    restricted !== false
                ) {
                    restrictedByUserIds.add(
                        normalizedUserId
                    );
                } else {
                    restrictedByUserIds.delete(
                        normalizedUserId
                    );
                }

                return {
                    ...data,

                    restricted_by_user_ids:
                        [
                            ...restrictedByUserIds
                        ]
                };
            }
        );

    return mapRoomRow(
        saved,
        normalizedUserId
    );
}

async function setRoomBlocked({
    userId,
    roomId,
    blocked = true
} = {}) {
    const normalizedUserId =
        normalizeUserId(userId);

    const context =
        await getChatRoomActionContextV1(
            normalizedUserId,
            roomId
        );

    const roomType =
        sanitizeText(
            context.roomData.room_type ||
            context.roomData.roomType
        ).toLowerCase();

    if (
        roomType !== 'dm' &&
        context.memberIds.length !== 2
    ) {
        throw realtimeHttpErrorV1(
            'Block is only available for direct messages.',
            400
        );
    }

    if (
        !context.otherMemberIds.length
    ) {
        throw realtimeHttpErrorV1(
            'No user found to block.',
            400
        );
    }

    const saved =
        await mutateChatRoomDataV1(
            roomId,
            (data) => {
                const blockedByUserIds =
                    new Set(
                        normalizeStringArray(
                            data.blocked_by_user_ids ||
                            data.blockedByUserIds
                        )
                    );

                const blockedByOwnerUserIds =
                    new Set(
                        normalizeStringArray(
                            data.blocked_by_owner_user_ids ||
                            data.blockedByOwnerUserIds
                        )
                    );

                const hiddenForUserIds =
                    new Set(
                        normalizeStringArray(
                            data.hidden_for_user_ids ||
                            data.hiddenForUserIds
                        )
                    );

                if (blocked !== false) {
                    blockedByOwnerUserIds.add(
                        normalizedUserId
                    );

                    context.otherMemberIds
                        .forEach((memberId) =>
                            blockedByUserIds.add(
                                memberId
                            )
                        );

                    hiddenForUserIds.delete(
                        normalizedUserId
                    );
                } else {
                    blockedByOwnerUserIds.delete(
                        normalizedUserId
                    );

                    context.otherMemberIds
                        .forEach((memberId) =>
                            blockedByUserIds.delete(
                                memberId
                            )
                        );

                    hiddenForUserIds.delete(
                        normalizedUserId
                    );
                }

                return {
                    ...data,

                    blocked_by_user_ids:
                        [
                            ...blockedByUserIds
                        ],

                    blocked_by_owner_user_ids:
                        [
                            ...blockedByOwnerUserIds
                        ],

                    hidden_for_user_ids:
                        [
                            ...hiddenForUserIds
                        ]
                };
            }
        );

    return {
        ...mapRoomRow(
            saved,
            normalizedUserId
        ),

        blocked:
            blocked !== false,

        blocked_user_ids:
            context.otherMemberIds
    };
}

async function listBlockedUsersForMemberV1(
    userId = ''
) {
    const normalizedUserId =
        normalizeUserId(userId);

    if (!normalizedUserId) {
        return [];
    }

    const rows =
        await listChatRoomRowsForMemberV1(
            normalizedUserId,
            1000
        );

    const blockedByUserId =
        new Map();

    rows.forEach((row) => {
        const data =
            rowData(row);

        const memberIds =
            normalizeMemberIds(
                data
            );

        const roomType =
            sanitizeText(
                data.room_type ||
                data.roomType
            ).toLowerCase();

        if (
            roomType !== 'dm' &&
            memberIds.length !== 2
        ) {
            return;
        }

        const blockedByUserIds =
            normalizeStringArray(
                data.blocked_by_user_ids ||
                data.blockedByUserIds
            );

        const blockedByOwnerUserIds =
            normalizeStringArray(
                data.blocked_by_owner_user_ids ||
                data.blockedByOwnerUserIds
            );

        if (
            !blockedByUserIds.length &&
            !blockedByOwnerUserIds.length
        ) {
            return;
        }

        memberIds
            .filter(
                (memberId) =>
                    memberId &&
                    memberId !==
                        normalizedUserId
            )
            .forEach((memberId) => {
                blockedByUserId.set(
                    memberId,
                    {
                        userId:
                            memberId,

                        roomId:
                            sanitizeText(
                                row.source_document_id
                            )
                    }
                );
            });
    });

    return [
        ...blockedByUserId.values()
    ];
}


async function getChatRoomForSocket(
    roomId,
    viewerId = ''
) {
    const cleanRoomId =
        sanitizeText(roomId);

    if (!cleanRoomId) {
        return null;
    }

    const row =
        await getRecordByTypeAndId(
            'chat_room',
            cleanRoomId
        );

    if (!row) {
        return null;
    }

    const data =
        rowData(row);

    const mapped =
        mapRoomRow(
            row,
            viewerId
        );

    return {
        ...data,
        ...mapped,

        id:
            mapped.id ||
            row.source_document_id,

        member_ids:
            normalizeMemberIds(
                data
            ),

        blocked_by_user_ids:
            normalizeStringArray(
                data.blocked_by_user_ids ||
                data.blockedByUserIds
            ),

        blocked_by_owner_user_ids:
            normalizeStringArray(
                data.blocked_by_owner_user_ids ||
                data.blockedByOwnerUserIds
            ),

        restricted_by_user_ids:
            normalizeStringArray(
                data.restricted_by_user_ids ||
                data.restrictedByUserIds
            ),

        hidden_for_user_ids:
            normalizeStringArray(
                data.hidden_for_user_ids ||
                data.hiddenForUserIds
            ),

        muted_for_user_ids:
            normalizeStringArray(
                data.muted_for_user_ids ||
                data.mutedForUserIds
            ),

        unread_counts:
            data.unread_counts &&
            typeof data.unread_counts === 'object'
                ? data.unread_counts
                : data.unreadCounts &&
                    typeof data.unreadCounts === 'object'
                    ? data.unreadCounts
                    : {}
    };
}

async function listChatRoomsForMember(
    userId,
    limit = 100
) {
    const cleanUserId =
        normalizeUserId(userId);

    if (!cleanUserId) {
        return [];
    }

    const safeLimit =
        Math.max(
            1,
            Math.min(
                1000,
                Number(limit) || 100
            )
        );

    const rows =
        await listChatRoomRowsForMemberV1(
            cleanUserId,
            safeLimit
        );

    return rows
        .map((row) =>
            mapRoomRow(
                row,
                cleanUserId
            )
        )
        .filter((room) =>
            normalizeStringArray(
                room.member_ids
            ).includes(
                cleanUserId
            )
        )
        .slice(
            0,
            safeLimit
        );
}

async function markRoomAsReadForUser(
    userId,
    roomId
) {
    const cleanUserId =
        normalizeUserId(userId);

    const cleanRoomId =
        sanitizeText(roomId);

    if (
        !cleanUserId ||
        !cleanRoomId
    ) {
        return false;
    }

    if (
        cleanRoomId ===
            'YH-community' ||
        cleanRoomId ===
            'main-chat'
    ) {
        return true;
    }

    await getChatRoomActionContextV1(
        cleanUserId,
        cleanRoomId
    );

    await mutateChatRoomDataV1(
        cleanRoomId,
        (data) => {
            const unreadCounts =
                data.unread_counts &&
                typeof data.unread_counts === 'object'
                    ? {
                        ...data.unread_counts
                    }
                    : {};

            unreadCounts[
                cleanUserId
            ] = 0;

            return {
                ...data,

                unread_counts:
                    unreadCounts
            };
        }
    );

    return true;
}

/* PATCH: Realtime Supabase canonical message authority v2 */
function isPublicChatRoomV2(roomId = '') {
    const cleanRoomId = sanitizeText(roomId);
    return cleanRoomId === 'YH-community' || cleanRoomId === 'main-chat';
}

function normalizeChatMessageAttachmentV2(raw = null) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const url = sanitizeText(raw.url);
    const originalName = sanitizeText(raw.originalName || raw.name);
    const allowedUrl =
        url.startsWith('/uploads/academy-messages/') ||
        url.startsWith('/assets/academy/gifs/');

    if (!allowedUrl || !originalName) return null;

    const mimeType = sanitizeText(raw.mimeType || raw.mime).toLowerCase();
    const category = sanitizeText(raw.category).toLowerCase();
    const requestedKind = sanitizeText(raw.kind).toLowerCase();

    return {
        url,
        previewUrl: sanitizeText(raw.previewUrl || raw.preview_url || url) || url,
        originalName,
        name: originalName,
        kind: ['image', 'video'].includes(requestedKind) ? requestedKind : 'file',
        mimeType,
        category,
        sizeBytes: Math.max(0, Number(raw.sizeBytes || raw.size || 0) || 0),
        isAnimated:
            raw.isAnimated === true ||
            category === 'gif' ||
            mimeType === 'image/gif' ||
            mimeType === 'image/webp'
    };
}

function buildChatMessageDocumentIdV2(userId = '', clientMessageId = '') {
    const cleanUserId = normalizeUserId(userId);
    const cleanClientId = sanitizeText(clientMessageId)
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .slice(0, 160);

    if (!cleanUserId || !cleanClientId) return makeRecordId('msg');

    return 'msg_' + crypto
        .createHash('sha256')
        .update(`${cleanUserId}|${cleanClientId}`)
        .digest('hex')
        .slice(0, 40);
}

async function listChatMessageRowsForRoomV2(roomId = '', limit = 200) {
    const cleanRoomId = sanitizeText(roomId);
    if (!cleanRoomId) return [];

    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    const fetchLimit = Math.min(2000, Math.max(safeLimit * 3, 200));

    const [columnRows, legacyRows] = await Promise.all([
        listRealtimeRowsPagedV1(
            () => yhuSupabaseAdmin
                .from(TABLE)
                .select('*')
                .eq('record_type', 'chat_message')
                .eq('room_id', cleanRoomId)
                .order('created_at_source', { ascending: false, nullsFirst: false })
                .order('source_document_id', { ascending: false }),
            { maxRows: fetchLimit, label: 'Realtime room messages' }
        ),
        listRealtimeRowsPagedV1(
            () => yhuSupabaseAdmin
                .from(TABLE)
                .select('*')
                .eq('record_type', 'chat_message')
                .contains('data', { room: cleanRoomId })
                .order('created_at_source', { ascending: false, nullsFirst: false })
                .order('source_document_id', { ascending: false }),
            { maxRows: fetchLimit, label: 'Realtime legacy room messages' }
        )
    ]);

    const rowsById = new Map();

    [...columnRows, ...legacyRows].forEach((row) => {
        const messageId = sanitizeText(row.source_document_id);
        const data = rowData(row);
        const rowRoomId = sanitizeText(
            row.room_id ||
            data.room ||
            data.room_id ||
            data.roomId
        );

        if (
            messageId &&
            rowRoomId === cleanRoomId
        ) {
            rowsById.set(messageId, row);
        }
    });

    return [...rowsById.values()]
        .sort((a, b) => {
            const aData = rowData(a);
            const bData = rowData(b);

            const aTime =
                Date.parse(
                    mapTimestamp(
                        aData.time ||
                        aData.created_at ||
                        aData.createdAt ||
                        a.created_at_source
                    ) || ''
                ) || 0;

            const bTime =
                Date.parse(
                    mapTimestamp(
                        bData.time ||
                        bData.created_at ||
                        bData.createdAt ||
                        b.created_at_source
                    ) || ''
                ) || 0;

            if (aTime !== bTime) return bTime - aTime;

            return String(
                b.source_document_id || ''
            ).localeCompare(
                String(a.source_document_id || '')
            );
        })
        .slice(0, safeLimit);
}

async function mutateChatMessageDataV2(
    messageId = '',
    mutate,
    maxAttempts = 5
) {
    const cleanMessageId = sanitizeText(messageId);

    if (
        !cleanMessageId ||
        typeof mutate !== 'function'
    ) {
        throw realtimeHttpErrorV1(
            'Valid message mutation is required.',
            400
        );
    }

    const attempts = Math.max(
        1,
        Math.min(
            10,
            Number(maxAttempts) || 5
        )
    );

    for (
        let attempt = 0;
        attempt < attempts;
        attempt += 1
    ) {
        const current = await getRecordByTypeAndId(
            'chat_message',
            cleanMessageId
        );

        if (!current) {
            throw realtimeHttpErrorV1(
                'Message not found.',
                404
            );
        }

        const nextData = await mutate(
            { ...rowData(current) },
            current
        );

        if (
            !nextData ||
            typeof nextData !== 'object' ||
            Array.isArray(nextData)
        ) {
            throw realtimeHttpErrorV1(
                'Invalid message mutation result.',
                500
            );
        }

        const now = nowIso();

        let query = yhuSupabaseAdmin
            .from(TABLE)
            .update({
                data: {
                    ...nextData,
                    updated_at: now
                },
                updated_at_source: now,
                updated_at: now
            })
            .eq('id', current.id)
            .eq('record_type', 'chat_message')
            .eq('source_document_id', cleanMessageId);

        if (current.updated_at) {
            query = query.eq(
                'updated_at',
                current.updated_at
            );
        }

        const {
            data: saved,
            error
        } = await query
            .select('*')
            .maybeSingle();

        if (error) {
            throw new Error(
                `Realtime message update failed: ${error.message}`
            );
        }

        if (saved) return saved;
    }

    throw realtimeHttpErrorV1(
        'Message changed during the request. Please retry.',
        409
    );
}

async function getChatMessageActionContextV2(
    messageId = '',
    userId = '',
    options = {}
) {
    const cleanMessageId = sanitizeText(messageId);
    const cleanUserId = normalizeUserId(userId);

    if (
        !cleanMessageId ||
        !cleanUserId
    ) {
        throw realtimeHttpErrorV1(
            'Message id and user are required.',
            400
        );
    }

    const row = await getRecordByTypeAndId(
        'chat_message',
        cleanMessageId
    );

    if (!row) {
        throw realtimeHttpErrorV1(
            'Message not found.',
            404
        );
    }

    const data = rowData(row);

    const roomId = sanitizeText(
        row.room_id ||
        data.room ||
        data.room_id ||
        data.roomId
    );

    if (!roomId) {
        throw realtimeHttpErrorV1(
            'Message room is missing.',
            500
        );
    }

    let roomContext = null;

    try {
        roomContext = await getChatRoomActionContextV1(
            cleanUserId,
            roomId
        );
    } catch (error) {
        const allowUnregistered =
            options.allowUnregisteredRoom === true ||
            isPublicChatRoomV2(roomId);

        if (!allowUnregistered) throw error;
    }

    const memberIds =
        roomContext?.memberIds ||
        [cleanUserId];

    const hiddenForUserIds = new Set(
        normalizeStringArray(
            data.hidden_for_user_ids ||
            data.hiddenForUserIds
        )
    );

    return {
        row,
        data,
        roomId,
        roomContext,
        memberIds,
        hiddenForUserIds,
        ownerId: normalizeUserId(
            data.created_by_user_id ||
            data.createdByUserId ||
            row.owner_user_id
        )
    };
}

async function getChatSendRoomContextV2(
    userId = '',
    roomId = '',
    allowUnregisteredRoom = false
) {
    const cleanUserId = normalizeUserId(userId);
    const cleanRoomId = sanitizeText(roomId);

    if (
        !cleanUserId ||
        !cleanRoomId
    ) {
        throw realtimeHttpErrorV1(
            'Room and user are required.',
            400
        );
    }

    try {
        const context = await getChatRoomActionContextV1(
            cleanUserId,
            cleanRoomId
        );

        const room =
            context.room ||
            mapRoomRow(
                context.row,
                cleanUserId
            );

        if (
            room.is_blocked ||
            room.is_blocked_by_me
        ) {
            throw realtimeHttpErrorV1(
                'Messaging is unavailable for this conversation.',
                403
            );
        }

        const restrictedBy = new Set(
            normalizeStringArray(
                context.roomData.restricted_by_user_ids ||
                context.roomData.restrictedByUserIds
            )
        );

        if (
            context.otherMemberIds.some(
                (memberId) =>
                    restrictedBy.has(memberId)
            )
        ) {
            throw realtimeHttpErrorV1(
                'This member has restricted the conversation.',
                403
            );
        }

        return context;
    } catch (error) {
        if (
            allowUnregisteredRoom === true ||
            isPublicChatRoomV2(cleanRoomId)
        ) {
            return {
                row: null,
                roomData: {},
                room: null,
                memberIds: [cleanUserId],
                otherMemberIds: []
            };
        }

        throw error;
    }
}

function mapChatMessageRow(
    row = {},
    viewerId = ''
) {
    const data = rowData(row);

    const authorId = normalizeUserId(
        data.created_by_user_id ||
        data.createdByUserId ||
        data.author_id ||
        data.authorId ||
        data.user_id ||
        data.userId ||
        row.owner_user_id
    );

    const upvotedBy = normalizeStringArray(
        data.upvoted_by_user_ids ||
        data.upvotedByUserIds
    );

    const legacyUpvotes = Math.max(
        0,
        toInt(
            data.legacy_upvotes_count,
            upvotedBy.length
                ? 0
                : toInt(data.upvotes, 0)
        )
    );

    return {
        id: sanitizeText(
            row.source_document_id ||
            data.id
        ),

        room: sanitizeText(
            data.room ||
            data.room_id ||
            data.roomId ||
            row.room_id
        ),

        author: sanitizeText(data.author),

        authorId,
        author_id: authorId,
        createdByUserId: authorId,
        created_by_user_id: authorId,

        initial: sanitizeText(data.initial),
        avatar: sanitizeText(data.avatar),
        text: sanitizeText(data.text),

        attachment:
            normalizeChatMessageAttachmentV2(
                data.attachment
            ),

        time: sanitizeText(
            data.time ||
            mapTimestamp(
                data.created_at ||
                data.createdAt ||
                row.created_at_source
            )
        ),

        upvotes:
            legacyUpvotes +
            upvotedBy.length,

        upvoted: Boolean(
            viewerId &&
            upvotedBy.includes(
                normalizeUserId(viewerId)
            )
        ),

        editedAt: sanitizeText(
            data.editedAt ||
            data.edited_at
        ),

        edited_at: sanitizeText(
            data.edited_at ||
            data.editedAt
        ),

        hidden_for_user_ids:
            normalizeStringArray(
                data.hidden_for_user_ids ||
                data.hiddenForUserIds
            ),

        client_message_id:
            sanitizeText(
                data.client_message_id ||
                data.clientMessageId
            )
    };
}

async function getChatMessageById(
    messageId,
    viewerId = ''
) {
    const cleanMessageId = sanitizeText(messageId);

    if (!cleanMessageId) return null;

    const row = await getRecordByTypeAndId(
        'chat_message',
        cleanMessageId
    );

    if (!row) return null;

    const enriched =
        await enrichChatMessageAuthorsV3([
            mapChatMessageRow(
                row,
                viewerId
            )
        ]);

    return enriched[0] || null;
}

async function listChatMessages(
    roomId,
    viewerId = '',
    limit = 50,
    options = {}
) {
    const cleanRoomId = sanitizeText(roomId);
    const cleanViewerId = normalizeUserId(viewerId);

    if (!cleanRoomId) return [];

    if (cleanViewerId) {
        await getChatSendRoomContextV2(
            cleanViewerId,
            cleanRoomId,
            options.allowUnregisteredRoom === true
        );
    }

    const safeLimit = Math.max(
        1,
        Math.min(
            200,
            Number(limit) || 50
        )
    );

    const rows = await listChatMessageRowsForRoomV2(
        cleanRoomId,
        Math.min(
            500,
            safeLimit * 3
        )
    );

    const messages =
        rows
            .map((row) =>
                mapChatMessageRow(
                    row,
                    cleanViewerId
                )
            )
            .filter((message) =>
                !cleanViewerId ||
                !message.hidden_for_user_ids.includes(
                    cleanViewerId
                )
            )
            .sort((a, b) => {
                const aTime =
                    Date.parse(a.time || '') ||
                    0;

                const bTime =
                    Date.parse(b.time || '') ||
                    0;

                if (aTime !== bTime) {
                    return aTime - bTime;
                }

                return String(
                    a.id || ''
                ).localeCompare(
                    String(b.id || '')
                );
            })
            .slice(-safeLimit);

    return enrichChatMessageAuthorsV3(
        messages
    );
}

async function importLegacyChatMessageV2({
    messageId = '',
    roomId = '',
    legacyData = {}
} = {}) {
    const cleanMessageId = sanitizeText(messageId);

    const cleanRoomId = sanitizeText(
        roomId ||
        legacyData.room ||
        legacyData.room_id ||
        legacyData.roomId
    );

    if (
        !cleanMessageId ||
        !cleanRoomId
    ) {
        return null;
    }

    const existing = await getRecordByTypeAndId(
        'chat_message',
        cleanMessageId
    ).catch(() => null);

    if (existing) {
        return mapChatMessageRow(existing);
    }

    const createdAt =
        mapTimestamp(
            legacyData.time ||
            legacyData.created_at ||
            legacyData.createdAt ||
            nowIso()
        ) ||
        nowIso();

    const ownerId = normalizeUserId(
        legacyData.created_by_user_id ||
        legacyData.createdByUserId ||
        legacyData.author_id ||
        legacyData.authorId ||
        legacyData.user_id ||
        legacyData.userId
    );

    const saved = await upsertRecord({
        recordType: 'chat_message',
        docId: cleanMessageId,
        ownerUserId: ownerId,
        roomId: cleanRoomId,
        insertOnly: true,

        data: {
            room: cleanRoomId,

            author: sanitizeText(
                legacyData.author ||
                'Hustler'
            ),

            initial: sanitizeText(
                legacyData.initial ||
                legacyData.author ||
                'H'
            )
                .charAt(0)
                .toUpperCase(),

            avatar: sanitizeText(
                legacyData.avatar
            ),

            text: sanitizeText(
                legacyData.text
            ).slice(0, 1600),

            attachment:
                normalizeChatMessageAttachmentV2(
                    legacyData.attachment
                ),

            time: createdAt,
            created_at: createdAt,
            created_by_user_id: ownerId,

            hidden_for_user_ids:
                normalizeStringArray(
                    legacyData.hidden_for_user_ids ||
                    legacyData.hiddenForUserIds
                ),

            legacy_upvotes_count:
                Math.max(
                    0,
                    toInt(
                        legacyData.upvotes,
                        0
                    )
                ),

            upvoted_by_user_ids: [],

            edited_at: sanitizeText(
                legacyData.edited_at ||
                legacyData.editedAt
            ),

            migrated_from_firestore: true,
            migrated_at: nowIso()
        }
    });

    const persisted =
        saved ||
        await getRecordByTypeAndId(
            'chat_message',
            cleanMessageId
        );

    return persisted
        ? mapChatMessageRow(persisted)
        : null;
}

async function refreshRoomLastMessageV2(
    roomId = ''
) {
    const cleanRoomId = sanitizeText(roomId);

    if (!cleanRoomId) return null;

    const roomRow = await getRecordByTypeAndId(
        'chat_room',
        cleanRoomId
    );

    if (!roomRow) return null;

    const latestRows =
        await listChatMessageRowsForRoomV2(
            cleanRoomId,
            1
        );

    const latest =
        latestRows[0]
            ? mapChatMessageRow(
                latestRows[0]
            )
            : null;

    return mutateChatRoomDataV1(
        cleanRoomId,
        (data) => ({
            ...data,

            last_message_id:
                latest?.id ||
                '',

            last_message_text:
                latest?.text ||
                (
                    latest
                        ?.attachment
                        ?.originalName
                        ? `📎 ${latest.attachment.originalName}`
                        : ''
                ),

            last_message_author:
                latest?.author ||
                '',

            last_message_at:
                latest?.time ||
                data.created_at ||
                data.createdAt ||
                nowIso()
        })
    );
}

async function createChatMessage({
    roomId,
    userId,
    text = '',
    attachment = null,
    clientMessageId = '',
    allowUnregisteredRoom = false,
    fallbackIdentity = null
} = {}) {
    const cleanRoomId = sanitizeText(roomId);
    const cleanUserId = normalizeUserId(userId);

    const cleanText =
        sanitizeText(text)
            .slice(0, 1600);

    const cleanAttachment =
        normalizeChatMessageAttachmentV2(
            attachment
        );

    if (
        !cleanRoomId ||
        !cleanUserId
    ) {
        throw realtimeHttpErrorV1(
            'Room and user are required.',
            400
        );
    }

    if (
        !cleanText &&
        !cleanAttachment
    ) {
        throw realtimeHttpErrorV1(
            'Message text or attachment is required.',
            400
        );
    }

    const roomContext =
        await getChatSendRoomContextV2(
            cleanUserId,
            cleanRoomId,
            allowUnregisteredRoom
        );

    const user = await getUserDoc(
        cleanUserId
    );

    if (
        !user &&
        !fallbackIdentity
    ) {
        throw realtimeHttpErrorV1(
            'Message sender not found.',
            404
        );
    }

    const userSummary =
        buildUserSummary({
            id:
                cleanUserId,
            ...(fallbackIdentity &&
            typeof fallbackIdentity === 'object'
                ? fallbackIdentity
                : {}),
            ...(user &&
            typeof user === 'object'
                ? user
                : {})
        });

    const author =
        getResolvedRealtimeDisplayNameV3(
            userSummary,
            cleanUserId
        ) ||
        'YH Member';

    const messageId =
        buildChatMessageDocumentIdV2(
            cleanUserId,
            clientMessageId
        );

    const existing =
        await getRecordByTypeAndId(
            'chat_message',
            messageId
        ).catch(() => null);

    if (existing) {
        const existingMessage =
            mapChatMessageRow(
                existing,
                cleanUserId
            );

        if (
            existingMessage.room !== cleanRoomId ||
            existingMessage.authorId !== cleanUserId
        ) {
            throw realtimeHttpErrorV1(
                'Message request id is already in use.',
                409
            );
        }

        return {
            ...existingMessage,
            deliveryMemberIds:
                roomContext.memberIds,
            roomState:
                roomContext.room ||
                null,
            duplicate: true
        };
    }

    const now = nowIso();

    const payload = {
        room: cleanRoomId,
        author,
        initial:
            author
                .charAt(0)
                .toUpperCase(),

        avatar: sanitizeText(
            userSummary.avatar
        ),

        text: cleanText,
        attachment: cleanAttachment,
        time: now,
        created_at: now,
        created_by_user_id: cleanUserId,
        hidden_for_user_ids: [],
        legacy_upvotes_count: 0,
        upvoted_by_user_ids: [],

        client_message_id:
            sanitizeText(
                clientMessageId
            )
    };

    const saved = await upsertRecord({
        recordType: 'chat_message',
        docId: messageId,
        ownerUserId: cleanUserId,
        roomId: cleanRoomId,
        insertOnly: true,
        data: payload
    });

    const persistedRow =
        saved ||
        await getRecordByTypeAndId(
            'chat_message',
            messageId
        );

    if (!persistedRow) {
        throw new Error(
            'Message create returned no record.'
        );
    }

    const persistedMessage =
        mapChatMessageRow(
            persistedRow,
            cleanUserId
        );

    let savedRoom = null;

    if (roomContext.row) {
        savedRoom = await mutateChatRoomDataV1(
            cleanRoomId,
            (data) => {
                const memberIds =
                    normalizeMemberIds(data);

                const unreadCounts =
                    data.unread_counts &&
                    typeof data.unread_counts ===
                        'object'
                        ? {
                            ...data.unread_counts
                        }
                        : {};

                const applied = new Set(
                    normalizeStringArray(
                        data.applied_message_ids ||
                        data.appliedMessageIds
                    )
                );

                if (!applied.has(messageId)) {
                    memberIds.forEach(
                        (memberId) => {
                            unreadCounts[memberId] =
                                memberId ===
                                cleanUserId
                                    ? 0
                                    : (
                                        toInt(
                                            unreadCounts[
                                                memberId
                                            ],
                                            0
                                        ) + 1
                                    );
                        }
                    );

                    applied.add(messageId);
                }

                const hidden = new Set(
                    normalizeStringArray(
                        data.hidden_for_user_ids ||
                        data.hiddenForUserIds
                    )
                );

                memberIds.forEach(
                    (memberId) =>
                        hidden.delete(memberId)
                );

                return {
                    ...data,

                    last_message_id:
                        messageId,

                    last_message_text:
                        cleanText ||
                        (
                            cleanAttachment
                                ?.originalName
                                ? `📎 ${cleanAttachment.originalName}`
                                : ''
                        ),

                    last_message_author:
                        author,

                    last_message_at:
                        now,

                    unread_counts:
                        unreadCounts,

                    hidden_for_user_ids:
                        [...hidden],

                    applied_message_ids:
                        [...applied]
                            .slice(-500)
                };
            }
        );
    }

    return {
        ...persistedMessage,

        deliveryMemberIds:
            roomContext.memberIds,

        roomState:
            savedRoom
                ? mapRoomRow(
                    savedRoom,
                    cleanUserId
                )
                : null,

        duplicate: false
    };
}

async function upvoteChatMessage({
    messageId,
    userId,
    upvoted = null
} = {}) {
    const cleanMessageId =
        sanitizeText(messageId);

    const cleanUserId =
        normalizeUserId(userId);

    if (
        !cleanMessageId ||
        !cleanUserId
    ) {
        throw realtimeHttpErrorV1(
            'Message id and user are required.',
            400
        );
    }

    const context =
        await getChatMessageActionContextV2(
            cleanMessageId,
            cleanUserId
        );

    if (
        context.hiddenForUserIds.has(
            cleanUserId
        )
    ) {
        throw realtimeHttpErrorV1(
            'Message not found.',
            404
        );
    }

    const saved =
        await mutateChatMessageDataV2(
            cleanMessageId,
            (data) => {
                const users = new Set(
                    normalizeStringArray(
                        data.upvoted_by_user_ids ||
                        data.upvotedByUserIds
                    )
                );

                const legacyCount =
                    Math.max(
                        0,
                        toInt(
                            data.legacy_upvotes_count,
                            users.size
                                ? 0
                                : toInt(
                                    data.upvotes,
                                    0
                                )
                        )
                    );

                const desired =
                    typeof upvoted ===
                        'boolean'
                        ? upvoted
                        : !users.has(
                            cleanUserId
                        );

                if (desired) {
                    users.add(cleanUserId);
                } else {
                    users.delete(cleanUserId);
                }

                return {
                    ...data,
                    upvotes:
                        legacyCount +
                        users.size,
                    legacy_upvotes_count:
                        legacyCount,
                    upvoted_by_user_ids:
                        [...users]
                };
            }
        );

    const message =
        mapChatMessageRow(
            saved,
            cleanUserId
        );

    return {
        message,
        roomId:
            context.roomId,
        deliveryMemberIds:
            context.memberIds,
        upvotes:
            message.upvotes,
        upvoted:
            message.upvoted
    };
}

async function editChatMessage({
    messageId,
    userId,
    text = ''
} = {}) {
    const cleanMessageId =
        sanitizeText(messageId);

    const cleanUserId =
        normalizeUserId(userId);

    const cleanText =
        sanitizeText(text)
            .slice(0, 1600);

    if (
        !cleanMessageId ||
        !cleanUserId ||
        !cleanText
    ) {
        throw realtimeHttpErrorV1(
            'Message text is required.',
            400
        );
    }

    const context =
        await getChatMessageActionContextV2(
            cleanMessageId,
            cleanUserId
        );

    if (
        context.ownerId !==
        cleanUserId
    ) {
        throw realtimeHttpErrorV1(
            'Only the original sender can edit this message.',
            403
        );
    }

    const editedAt = nowIso();

    const saved =
        await mutateChatMessageDataV2(
            cleanMessageId,
            (data) => ({
                ...data,
                text: cleanText,
                edited_at: editedAt,
                editedAt
            })
        );

    let roomState = null;

    if (context.roomContext) {
        const lastMessageId =
            sanitizeText(
                context
                    .roomContext
                    .roomData
                    .last_message_id ||
                context
                    .roomContext
                    .roomData
                    .lastMessageId
            );

        if (
            lastMessageId ===
            cleanMessageId
        ) {
            const savedRoom =
                await mutateChatRoomDataV1(
                    context.roomId,
                    (data) => ({
                        ...data,

                        last_message_text:
                            cleanText,

                        last_message_author:
                            sanitizeText(
                                rowData(saved)
                                    .author
                            ),

                        last_message_at:
                            mapTimestamp(
                                rowData(saved).time ||
                                saved.created_at_source
                            ) ||
                            data.last_message_at ||
                            data.lastMessageAt
                    })
                );

            roomState = mapRoomRow(
                savedRoom,
                cleanUserId
            );
        }
    }

    return {
        message:
            mapChatMessageRow(
                saved,
                cleanUserId
            ),

        roomId:
            context.roomId,

        deliveryMemberIds:
            context.memberIds,

        roomState,
        editedAt
    };
}

async function hideChatMessageForUser({
    messageId,
    userId
} = {}) {
    const cleanMessageId =
        sanitizeText(messageId);

    const cleanUserId =
        normalizeUserId(userId);

    if (
        !cleanMessageId ||
        !cleanUserId
    ) {
        throw realtimeHttpErrorV1(
            'Message id is required.',
            400
        );
    }

    const context =
        await getChatMessageActionContextV2(
            cleanMessageId,
            cleanUserId
        );

    const saved =
        await mutateChatMessageDataV2(
            cleanMessageId,
            (data) => {
                const hidden = new Set(
                    normalizeStringArray(
                        data.hidden_for_user_ids ||
                        data.hiddenForUserIds
                    )
                );

                hidden.add(cleanUserId);

                return {
                    ...data,
                    hidden_for_user_ids:
                        [...hidden]
                };
            }
        );

    return {
        message:
            mapChatMessageRow(
                saved,
                cleanUserId
            ),

        roomId:
            context.roomId
    };
}

async function deleteChatMessage({
    messageId,
    userId
} = {}) {
    const cleanMessageId =
        sanitizeText(messageId);

    const cleanUserId =
        normalizeUserId(userId);

    if (
        !cleanMessageId ||
        !cleanUserId
    ) {
        throw realtimeHttpErrorV1(
            'Message id is required.',
            400
        );
    }

    const context =
        await getChatMessageActionContextV2(
            cleanMessageId,
            cleanUserId
        );

    if (
        context.ownerId !==
        cleanUserId
    ) {
        throw realtimeHttpErrorV1(
            'Only the original sender can delete this message.',
            403
        );
    }

    await deleteRecord(
        'chat_message',
        cleanMessageId
    );

    const savedRoom =
        context.roomContext
            ? await refreshRoomLastMessageV2(
                context.roomId
            )
            : null;

    return {
        deletedMessageId:
            cleanMessageId,

        roomId:
            context.roomId,

        deliveryMemberIds:
            context.memberIds,

        roomState:
            savedRoom
                ? mapRoomRow(
                    savedRoom,
                    cleanUserId
                )
                : null
    };
}
/* END PATCH: Realtime Supabase canonical message authority v2 */

async function getVaultItems(userId) {
    const normalizedUserId = normalizeUserId(userId);
    const rows = await listRecords('vault_item', 500);

    return rows
        .filter((row) => sanitizeText(row.owner_user_id || rowData(row).user_id || rowData(row).userId) === normalizedUserId)
        .map(mapVaultRow)
        .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

async function createVaultFolder({ userId, parentId = '', name = '' } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const cleanName = sanitizeText(name);
    if (!normalizedUserId || !cleanName) throw new Error('Folder name is required.');

    const docId = makeRecordId('vault');
    const now = nowIso();

    const row = await upsertRecord({
        recordType: 'vault_item',
        docId,
        ownerUserId: normalizedUserId,
        data: {
            user_id: normalizedUserId,
            parent_id: sanitizeText(parentId),
            item_type: 'folder',
            name: cleanName,
            file_path: '',
            mime_type: '',
            file_size: 0,
            created_at: now,
            updated_at: now
        }
    });

    return mapVaultRow(row);
}

async function createVaultFile({ userId, parentId = '', name = '', filePath = '', mimeType = '', fileSize = 0 } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const cleanName = sanitizeText(name);
    const cleanFilePath = sanitizeText(filePath);

    if (!normalizedUserId || !cleanName || !cleanFilePath) throw new Error('File name and path are required.');

    const docId = makeRecordId('vault');
    const now = nowIso();

    const row = await upsertRecord({
        recordType: 'vault_item',
        docId,
        ownerUserId: normalizedUserId,
        data: {
            user_id: normalizedUserId,
            parent_id: sanitizeText(parentId),
            item_type: 'file',
            name: cleanName,
            file_path: cleanFilePath,
            mime_type: sanitizeText(mimeType),
            file_size: toInt(fileSize, 0),
            created_at: now,
            updated_at: now
        }
    });

    return mapVaultRow(row);
}

async function getLiveRooms() {
    const rows = await listRecords('live_room', 300);

    const mappedRooms =
        await Promise.all(
            rows.map((row) =>
                enrichLiveRoomHostIdentityV3(
                    mapLiveRoomRow(row)
                )
            )
        );

    const expiredRows = rows.filter((row) => {
        const room = mapLiveRoomRow(row);
        return sanitizeText(room.status || '').toLowerCase() === 'live' && isLiveRoomExpired(room);
    });

    if (expiredRows.length) {
        Promise.all(expiredRows.map((row) => markExpiredLiveRoomEnded(row).catch(() => null)))
            .catch(() => null);
    }

    return mappedRooms
        .filter(isLiveRoomJoinable)
        .sort((a, b) => {
            return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
        });
}

async function createLiveRoom({
    userId,
    roomType = 'voice',
    title = '',
    topic = '',
    fallbackIdentity = null
} = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) throw new Error('Missing user id.');

    const docId = makeRecordId('live');
    const now = nowIso();

    const canonicalUser =
        await getUserSummary(
            normalizedUserId
        ).catch(() => null);

    const hostIdentity =
        buildUserSummary({
            id:
                normalizedUserId,
            ...(fallbackIdentity &&
            typeof fallbackIdentity === 'object'
                ? fallbackIdentity
                : {}),
            ...(canonicalUser &&
            typeof canonicalUser === 'object'
                ? canonicalUser
                : {})
        });

    const hostName =
        getResolvedRealtimeDisplayNameV3(
            hostIdentity,
            normalizedUserId
        ) ||
        'YH Member';

    const row = await upsertRecord({
        recordType: 'live_room',
        docId,
        ownerUserId: normalizedUserId,
        roomId: docId,
        data: {
            room_key: makeRoomKey('live'),
            room_type: sanitizeText(roomType || 'voice'),
            title: sanitizeText(title) || 'Live Room',
            topic: sanitizeText(topic),
            host_user_id: normalizedUserId,
            host_user_name: hostName,
            status: 'live',
            created_at: now,
            updated_at: now,
            participant_ids: [normalizedUserId],
            participant_count: 1
        }
    });

    return enrichLiveRoomHostIdentityV3(
        mapLiveRoomRow(row)
    );
}

async function joinLiveRoom({ userId, roomId } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const row = await getRecordByTypeAndId('live_room', roomId);

    if (!row) throw new Error('Live room not found.');

    const currentRoom = mapLiveRoomRow(row);

    if (!isLiveRoomJoinable(currentRoom)) {
        if (sanitizeText(currentRoom.status || '').toLowerCase() === 'live' && isLiveRoomExpired(currentRoom)) {
            await markExpiredLiveRoomEnded(row).catch(() => null);
        }

        throw new Error('This live room has already ended.');
    }

    const data = rowData(row);
    const participantSet = new Set(normalizeStringArray(data.participant_ids || data.participantIds));
    participantSet.add(normalizedUserId);

    const saved = await upsertRecord({
        recordType: 'live_room',
        docId: row.source_document_id,
        ownerUserId: row.owner_user_id,
        roomId: row.room_id || row.source_document_id,
        data: {
            ...data,
            status: 'live',
            ended_at: null,
            participant_ids: Array.from(participantSet),
            participant_count: participantSet.size
        }
    });

    return enrichLiveRoomHostIdentityV3(
        mapLiveRoomRow(saved)
    );
}

async function leaveLiveRoom({ userId, roomId } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const row = await getRecordByTypeAndId('live_room', roomId);
    if (!row) throw new Error('Live room not found.');

    const data = rowData(row);
    const participantSet = new Set(normalizeStringArray(data.participant_ids || data.participantIds));
    participantSet.delete(normalizedUserId);

    const saved = await upsertRecord({
        recordType: 'live_room',
        docId: row.source_document_id,
        ownerUserId: row.owner_user_id,
        roomId: row.room_id || row.source_document_id,
        data: {
            ...data,
            participant_ids: Array.from(participantSet),
            participant_count: participantSet.size
        }
    });

    return enrichLiveRoomHostIdentityV3(
        mapLiveRoomRow(saved)
    );
}

async function endLiveRoom({ userId, roomId } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const row = await getRecordByTypeAndId('live_room', roomId);
    if (!row) throw new Error('Live room not found.');

    const data = rowData(row);
    const hostId = sanitizeText(data.host_user_id || data.hostUserId || row.owner_user_id);

    if (hostId && hostId !== normalizedUserId) {
        throw new Error('Only the host can end this live room.');
    }

    const saved = await upsertRecord({
        recordType: 'live_room',
        docId: row.source_document_id,
        ownerUserId: row.owner_user_id,
        roomId: row.room_id || row.source_document_id,
        data: {
            ...data,
            status: 'ended',
            ended_at: nowIso(),
            participant_ids: [],
            participant_count: 0
        }
    });

    return enrichLiveRoomHostIdentityV3(
        mapLiveRoomRow(saved)
    );
}

/* PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */

async function createNotification(input = {}) {
    const userId =
        normalizeUserId(
            input.userId ||
            input.ownerUserId ||
            input.recipientUserId
        );

    if (!userId) {
        throw new Error(
            'Notification recipient is required.'
        );
    }

    const rawNotificationId =
        sanitizeText(
            input.notificationId ||
            input.id ||
            makeRecordId('notif')
        );

    const notificationId =
        rawNotificationId
            .replace(
                /[^a-zA-Z0-9_-]+/g,
                '_'
            )
            .slice(0, 180);

    if (!notificationId) {
        throw new Error(
            'Notification ID is required.'
        );
    }

    const validateExisting = (existing) => {
        if (!existing) return null;

        const existingOwner =
            sanitizeText(
                existing.owner_user_id ||
                rowData(existing).user_id ||
                rowData(existing).userId
            );

        if (existingOwner !== userId) {
            throw new Error(
                'Notification ID is already in use.'
            );
        }

        return {
            created: false,
            duplicate: true,
            notification:
                mapNotificationRow(existing)
        };
    };

    const existing =
        await getRecordByTypeAndId(
            'notification',
            notificationId
        ).catch(() => null);

    if (existing) {
        return validateExisting(existing);
    }

    const now = nowIso();

    const createdAt =
        mapTimestamp(
            input.createdAt ||
            input.created_at ||
            now
        ) || now;

    const body =
        sanitizeText(
            input.body ||
            input.text ||
            input.message
        );

    const target =
        sanitizeText(
            input.target ||
            input.targetType ||
            input.target_type
        );

    const targetId =
        sanitizeText(
            input.targetId ||
            input.target_id
        );

    const avatarStr =
        sanitizeText(
            input.avatarStr ||
            input.avatar_str ||
            input.initial ||
            'N'
        );

    const notificationType =
        sanitizeText(
            input.notificationType ||
            input.notification_type ||
            input.type ||
            'notification'
        );

    const row =
        await upsertRecord({
            recordType: 'notification',
            docId: notificationId,
            ownerUserId: userId,
            insertOnly: true,
            data: {
                user_id: userId,
                type:
                    sanitizeText(
                        input.type ||
                        notificationType
                    ),
                title:
                    sanitizeText(
                        input.title ||
                        'Notification'
                    ),
                body,
                text: body,
                message: body,
                source:
                    sanitizeText(
                        input.source ||
                        'system'
                    ),
                notification_type:
                    notificationType,
                notificationType,
                color:
                    sanitizeText(
                        input.color ||
                        'var(--neon-blue)'
                    ),
                avatar_str: avatarStr,
                avatarStr,
                initial: avatarStr,
                target,
                target_type: target,
                targetType: target,
                target_id: targetId,
                targetId,
                metadata:
                    input.metadata &&
                    typeof input.metadata === 'object' &&
                    !Array.isArray(input.metadata)
                        ? input.metadata
                        : {},
                is_read: false,
                isRead: false,
                read: false,
                read_at: '',
                readAt: '',
                created_at: createdAt,
                createdAt,
                updated_at: now,
                updatedAt: now
            }
        });

    if (!row) {
        const concurrentExisting =
            await getRecordByTypeAndId(
                'notification',
                notificationId
            );

        return validateExisting(
            concurrentExisting
        );
    }

    const notification =
        mapNotificationRow(row);

    emitCreatedNotificationV2(
        userId,
        notification
    );

    return {
        created: true,
        duplicate: false,
        notification
    };
}

/* END PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */


async function getNotifications(userId) {
    const rows =
        await listNotificationRowsForUserV2(
            userId,
            100
        );

    return rows.map(
        mapNotificationRow
    );
}

async function readAllNotifications(userId) {
    const normalizedUserId =
        normalizeUserId(userId);

    if (!normalizedUserId) {
        throw realtimeHttpErrorV1(
            'Notification recipient is required.',
            400
        );
    }

    const rows =
        await listNotificationRowsForUserV2(
            normalizedUserId,
            500
        );

    const unreadRows =
        rows.filter(
            (row) =>
                !mapNotificationRow(row)
                    .isRead
        );

    for (
        let index = 0;
        index < unreadRows.length;
        index += 25
    ) {
        const batch =
            unreadRows.slice(
                index,
                index + 25
            );

        await Promise.all(
            batch.map((row) =>
                markNotificationReadV2({
                    userId:
                        normalizedUserId,
                    notificationId:
                        row.source_document_id
                })
            )
        );
    }

    return {
        updatedCount:
            unreadRows.length
    };
}

async function readNotification({
    userId,
    notificationId
} = {}) {
    const notification =
        await markNotificationReadV2({
            userId,
            notificationId
        });

    return notification.id;
}


async function getLeaderboard(limit = 50) {
    const rows = await listRecords('user_profile', 500);

    const leaderboard = rows
        .map((row) => buildUserSummary({
            id: row.source_document_id,
            ...rowData(row)
        }))
        .sort((a, b) => {
            if (b.rep_points !== a.rep_points) return b.rep_points - a.rep_points;
            if (b.followers_count !== a.followers_count) return b.followers_count - a.followers_count;
            if (b.messages_count !== a.messages_count) return b.messages_count - a.messages_count;
            return String(a.id).localeCompare(String(b.id));
        });

    return leaderboard.slice(0, Math.max(1, Math.min(Number(limit || 50), 100)));
}

async function getProfileByName({ currentUserId, rawName } = {}) {
    const target = sanitizeText(rawName);
    if (!target) throw new Error('Profile name is required.');

    const rows = await listRecords('user_profile', 500);
    const targetLower = target.toLowerCase();

    const found = rows.find((row) => {
        const data = rowData(row);
        return (
            sanitizeText(row.source_document_id).toLowerCase() === targetLower ||
            sanitizeText(data.username).toLowerCase() === targetLower ||
            sanitizeText(data.fullName || data.name).toLowerCase() === targetLower ||
            sanitizeText(data.displayName || data.display_name).toLowerCase() === targetLower
        );
    });

    if (!found) throw new Error('Profile not found.');

    const profile = buildUserSummary({
        id: found.source_document_id,
        ...rowData(found)
    });

    const followRows = await listRecords('user_follow', 1000).catch(() => []);
    const isFollowing = followRows.some((row) => {
        const data = rowData(row);
        return (
            sanitizeText(data.follower_user_id || data.followerUserId || row.owner_user_id) === sanitizeText(currentUserId) &&
            sanitizeText(data.following_user_id || data.followingUserId || row.target_user_id) === profile.id
        );
    });

    return {
        ...profile,
        isFollowing
    };
}

async function toggleFollow({ followerId, followingId, actorName = '' } = {}) {
    const cleanFollowerId = normalizeUserId(followerId);
    const cleanFollowingId = normalizeUserId(followingId);

    if (!cleanFollowerId || !cleanFollowingId || cleanFollowerId === cleanFollowingId) {
        throw new Error('A valid target user is required.');
    }

    const followId = (cleanFollowerId + '_' + cleanFollowingId).toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    const existing = await getRecordByTypeAndId('user_follow', followId).catch(() => null);

    let isFollowing = false;
    let notification = null;

    if (existing) {
        await deleteRecord('user_follow', followId);
        isFollowing = false;
    } else {
        await upsertRecord({
            recordType: 'user_follow',
            docId: followId,
            ownerUserId: cleanFollowerId,
            targetUserId: cleanFollowingId,
            data: {
                follower_user_id: cleanFollowerId,
                following_user_id: cleanFollowingId,
                created_at: nowIso()
            }
        });

        const notificationResult =
            await createNotification({
                notificationId:
                    makeRecordId(
                        'follow_notif'
                    ),
                userId:
                    cleanFollowingId,
                type:
                    'follow',
                notificationType:
                    'follow',
                source:
                    'academy-community',
                title:
                    'New follower',
                body:
                    sanitizeText(
                        actorName ||
                        'Someone'
                    ) +
                    ' started following you.',
                target:
                    'profile',
                targetId:
                    cleanFollowerId,
                avatarStr:
                    sanitizeText(
                        actorName ||
                        'F'
                    )
                        .charAt(0)
                        .toUpperCase(),
                createdAt:
                    nowIso(),
                metadata: {
                    followerUserId:
                        cleanFollowerId,
                    followingUserId:
                        cleanFollowingId
                }
            });

        notification =
            notificationResult
                ?.notification ||
            null;

        isFollowing = true;
    }

    const [followerUser, followingUser] = await Promise.all([
        getUserDoc(cleanFollowerId),
        getUserDoc(cleanFollowingId)
    ]);

    return {
        isFollowing,
        followerStats: buildUserSummary({ id: cleanFollowerId, ...(followerUser || {}) }),
        targetStats: buildUserSummary({ id: cleanFollowingId, ...(followingUser || {}) }),
        notification
    };
}

module.exports = {
    getBootstrap,
    getUserSummary,
    getRooms,
    getChatRoomForSocket,
    getChatRoomActionContextV1,
    listChatRoomsForMember,
    listBlockedUsersForMemberV1,
    markRoomAsReadForUser,
    listChatMessages,
    getChatMessageById,
    importLegacyChatMessageV2,
    createChatMessage,
    upvoteChatMessage,
    editChatMessage,
    hideChatMessageForUser,
    deleteChatMessage,
    createRoom,
    deleteRoom,
    hideRoomForUser,
    setRoomMuted,
    setRoomRestricted,
    setRoomBlocked,
    getVaultItems,
    createVaultFolder,
    createVaultFile,
    getLiveRooms,
    createLiveRoom,
    joinLiveRoom,
    leaveLiveRoom,
    endLiveRoom,
    createNotification,
    getNotifications,
    readAllNotifications,
    readNotification,
    getLeaderboard,
    getProfileByName,
    toggleFollow
};
