const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_users';

function cleanText(value = '') {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function lowerEmail(value = '') {
    return cleanText(value).toLowerCase();
}

function normalizeDate(value) {
    if (!value) return null;

    if (value instanceof Date) return value.toISOString();

    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString();
    }

    if (typeof value === 'object') {
        if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
        if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
    }

    const text = cleanText(value);
    if (!text) return null;

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeValue(value) {
    if (value === null || value === undefined) return value;

    if (value instanceof Date) return value.toISOString();

    if (typeof value?.toDate === 'function') return value.toDate().toISOString();

    if (Array.isArray(value)) return value.map(normalizeValue);

    if (typeof value === 'object') {
        if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
        if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();

        return Object.fromEntries(
            Object.entries(value).map(([key, inner]) => [key, normalizeValue(inner)])
        );
    }

    return value;
}

function stripSensitiveUserFields(user = {}) {
    const blocked = new Set([
        'password',
        'passwordHash',
        'verificationCode',
        'verificationCodeIssuedAt',
        'passwordResetCode',
        'passwordResetExpiresAt',
        'passwordResetVerifiedAt',
        'resetCode',
        'resetToken',
        'authToken',
        'sessionToken'
    ]);

    const safe = {};

    Object.entries(user || {}).forEach(([key, value]) => {
        if (blocked.has(key)) return;
        safe[key] = normalizeValue(value);
    });

    return safe;
}

function hashJson(value = {}) {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(value || {}))
        .digest('hex');
}

function buildPayloadFromFirestoreUser(uid = '', user = {}, context = {}) {
    const cleanUid = cleanText(uid || user.uid || user.userId || user.firebaseUid);
    const safeData = stripSensitiveUserFields(user || {});
    const email = lowerEmail(user.email || user.emailLower || user.userEmail || '');
    const fullName = cleanText(user.fullName || user.name || user.displayName || user.userName || cleanUid);
    const displayName = cleanText(user.displayName || user.name || user.fullName || user.userName || cleanUid);
    const username = cleanText(user.username || user.handle || '');
    const country = cleanText(user.country || user.locationCountry || '');
    const city = cleanText(user.city || '');

    const rawData = {
        ...safeData,
        yhuMirrorContext: {
            source: cleanText(context.source || 'yhu_users_write_sync'),
            syncedAt: new Date().toISOString()
        }
    };

    return {
        user_id: cleanUid,
        firebase_uid: cleanUid,
        source_document_id: cleanUid,
        source_document_path: `users/${cleanUid}`,

        firebase_project: cleanText(context.firebaseProject || 'YH Universe'),
        firebase_collection: 'users',
        firebase_document_id: cleanUid,

        email,
        phone: cleanText(user.phone || user.phoneNumber || user.contact || ''),
        telegram_username: cleanText(user.telegramUsername || user.telegram_username || user.telegram || ''),
        username,
        full_name: fullName,
        display_name: displayName,
        role_label: cleanText(user.roleLabel || user.role || 'YH Universe User'),

        account_status: cleanText(user.accountStatus || user.status || user.memberStatus || 'active'),
        division: cleanText(user.division || user.sourceDivision || 'YH Universe'),
        country,
        city,
        plan: cleanText(user.plan || user.tier || ''),
        is_deleted: false,

        created_at_source: normalizeDate(user.createdAt),
        updated_at_source: normalizeDate(user.updatedAt || user.lastActive || user.lastSeenAt),
        last_seen_at_source: normalizeDate(user.lastSeenAt || user.lastActive || user.lastActiveAt),

        raw_data: rawData,
        data: rawData,
        public_meta: {
            uid: cleanUid,
            firebaseUid: cleanUid,
            sourceDocumentId: cleanUid,
            sourceDocumentPath: `users/${cleanUid}`,
            email,
            fullName,
            displayName,
            username,
            country,
            city,
            isVerified: user.isVerified === true,
            accountStatus: cleanText(user.accountStatus || user.status || user.memberStatus || 'active'),
            academyMembershipStatus: cleanText(user.academyMembershipStatus || user.academyApplicationStatus || ''),
            academyApplicationStatus: cleanText(user.academyApplicationStatus || ''),
            roadmapApplicationStatus: cleanText(user.roadmapApplicationStatus || ''),
            hasAcademyAccess: user.hasAcademyAccess === true,
            hasFederationAccess: user.hasFederationAccess === true,
            hasPlazaAccess: user.hasPlazaAccess === true
        },
        private_meta: {
            uid: cleanUid,
            firebaseUid: cleanUid,
            sourceCollection: 'users',
            sourceDocumentPath: `users/${cleanUid}`,
            hasPasswordInFirestore: Boolean(cleanText(user.password)),
            hasVerificationCodeInFirestore: Boolean(cleanText(user.verificationCode)),
            hasPasswordResetCodeInFirestore: Boolean(cleanText(user.passwordResetCode)),
            sensitiveFieldsMirrored: false
        },
        data_hash: hashJson(rawData),
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
}

async function getByUid(uid = '') {
    const cleanUid = cleanText(uid);
    if (!cleanUid) return null;

    const queries = [
        ['user_id', cleanUid],
        ['firebase_uid', cleanUid],
        ['source_document_id', cleanUid],
        ['firebase_document_id', cleanUid]
    ];

    for (const [column, value] of queries) {
        const { data, error } = await yhuSupabaseAdmin
            .from(TABLE)
            .select('*')
            .eq(column, value)
            .limit(1)
            .maybeSingle();

        if (error) {
            throw new Error(error.message || error.details || String(error));
        }

        if (data) return data;
    }

    return null;
}

function getCanonicalUidFromRow(row = {}) {
    if (
        !row ||
        typeof row !== 'object'
    ) {
        return '';
    }

    const rawData =
        row.raw_data &&
        typeof row.raw_data === 'object' &&
        !Array.isArray(row.raw_data)
            ? row.raw_data
            : {};

    const data =
        row.data &&
        typeof row.data === 'object' &&
        !Array.isArray(row.data)
            ? row.data
            : {};

    const publicMeta =
        row.public_meta &&
        typeof row.public_meta === 'object' &&
        !Array.isArray(row.public_meta)
            ? row.public_meta
            : {};

    return cleanText(
        row.user_id ||
        row.firebase_uid ||
        row.source_document_id ||
        row.firebase_document_id ||

        rawData.uid ||
        rawData.firebaseUid ||
        rawData.userId ||

        data.uid ||
        data.firebaseUid ||
        data.userId ||

        publicMeta.uid ||
        publicMeta.firebaseUid ||
        publicMeta.userId ||
        ''
    );
}

function getCanonicalUidPriority(
    row = {},
    uid = ''
) {
    const cleanUid =
        cleanText(uid);

    if (!cleanUid) {
        return 99;
    }

    if (
        cleanText(
            row.user_id
        ) === cleanUid
    ) {
        return 0;
    }

    if (
        cleanText(
            row.firebase_uid
        ) === cleanUid
    ) {
        return 1;
    }

    if (
        cleanText(
            row.source_document_id
        ) === cleanUid
    ) {
        return 2;
    }

    if (
        cleanText(
            row.firebase_document_id
        ) === cleanUid
    ) {
        return 3;
    }

    return (
        getCanonicalUidFromRow(
            row
        ) === cleanUid
    )
        ? 4
        : 99;
}

async function listCanonicalUsers(
    {
        limit = 5000
    } = {}
) {
    const safeLimit =
        Math.max(
            1,
            Math.min(
                5000,
                Math.trunc(
                    Number(limit) ||
                    5000
                )
            )
        );

    const {
        data,
        error
    } =
        await yhuSupabaseAdmin
            .from(TABLE)
            .select('*')
            .limit(safeLimit);

    if (error) {
        throw new Error(
            error.message ||
            error.details ||
            String(error)
        );
    }

    const rows =
        Array.isArray(data)
            ? data
            : [];

    const grouped =
        new Map();

    rows.forEach((row) => {
        const uid =
            getCanonicalUidFromRow(
                row
            );

        if (!uid) {
            return;
        }

        if (!grouped.has(uid)) {
            grouped.set(
                uid,
                []
            );
        }

        grouped
            .get(uid)
            .push(row);
    });

    const canonicalUsers =
        [];

    for (
        const [
            uid,
            candidates
        ] of grouped.entries()
    ) {
        const ranked =
            candidates
                .map((row) => ({
                    row,
                    priority:
                        getCanonicalUidPriority(
                            row,
                            uid
                        )
                }))
                .filter(
                    item =>
                        item.priority < 99
                )
                .sort(
                    (a, b) =>
                        a.priority -
                        b.priority
                );

        if (!ranked.length) {
            continue;
        }

        const bestPriority =
            ranked[0].priority;

        const bestCandidates =
            ranked.filter(
                item =>
                    item.priority ===
                    bestPriority
            );

        /*
         * Never silently choose between two rows
         * that claim the same canonical UID at the
         * same priority level.
         *
         * If this ever triggers, the identity data
         * must be reconciled first.
         */
        if (
            bestCandidates.length !== 1
        ) {
            throw new Error(
                `Ambiguous canonical yhu_users rows for UID at priority ${bestPriority}.`
            );
        }

        canonicalUsers.push({
            uid,
            row:
                bestCandidates[0]
                    .row
        });
    }

    canonicalUsers.sort(
        (a, b) =>
            String(a.uid)
                .localeCompare(
                    String(b.uid)
                )
    );

    return canonicalUsers;
}

async function deleteByColumn(column = '', value = '') {
    const cleanColumn = cleanText(column);
    const cleanValue = cleanText(value);

    if (!cleanColumn || !cleanValue) {
        return { column: cleanColumn, value: cleanValue, deleted: 0, skipped: true };
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .delete()
        .eq(cleanColumn, cleanValue)
        .select('id');

    if (error) {
        throw new Error(error.message || error.details || String(error));
    }

    return {
        column: cleanColumn,
        value: cleanValue,
        deleted: Array.isArray(data) ? data.length : 0
    };
}

async function deleteByUidAndEmail({ uid = '', email = '' } = {}) {
    const cleanUid = cleanText(uid);
    const cleanEmail = lowerEmail(email);

    if (!cleanUid && !cleanEmail) {
        return { deleted: 0, skipped: true, reason: 'missing_uid_or_email' };
    }

    const targets = [];

    if (cleanUid) {
        targets.push(
            ['user_id', cleanUid],
            ['firebase_uid', cleanUid],
            ['source_document_id', cleanUid],
            ['firebase_document_id', cleanUid]
        );
    }

    if (cleanEmail) {
        targets.push(['email', cleanEmail]);
    }

    const seen = new Set();
    const results = [];

    for (const [column, value] of targets) {
        const key = `${column}:${value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(await deleteByColumn(column, value));
    }

    return {
        deleted: results.reduce((sum, item) => sum + Number(item.deleted || 0), 0),
        results
    };
}

async function patchByUid(
    uid = '',
    patch = {},
    context = {}
) {
    const cleanUid =
        cleanText(uid);

    if (!cleanUid) {
        return null;
    }

    const existing =
        await getByUid(
            cleanUid
        );

    if (!existing?.id) {
        throw new Error(
            'Canonical yhu_users record was not found.'
        );
    }

    const safePatch =
        stripSensitiveUserFields(
            patch &&
            typeof patch === 'object'
                ? patch
                : {}
        );

    const currentRaw =
        existing.raw_data &&
        typeof existing.raw_data === 'object' &&
        !Array.isArray(existing.raw_data)
            ? existing.raw_data
            : {};

    const currentData =
        existing.data &&
        typeof existing.data === 'object' &&
        !Array.isArray(existing.data)
            ? existing.data
            : {};

    const currentPublicMeta =
        existing.public_meta &&
        typeof existing.public_meta === 'object' &&
        !Array.isArray(existing.public_meta)
            ? existing.public_meta
            : {};

    const currentPrivateMeta =
        existing.private_meta &&
        typeof existing.private_meta === 'object' &&
        !Array.isArray(existing.private_meta)
            ? existing.private_meta
            : {};

    const publicMetaPatch =
        context.publicMetaPatch &&
        typeof context.publicMetaPatch === 'object' &&
        !Array.isArray(context.publicMetaPatch)
            ? context.publicMetaPatch
            : {};

    const privateMetaPatch =
        context.privateMetaPatch &&
        typeof context.privateMetaPatch === 'object' &&
        !Array.isArray(context.privateMetaPatch)
            ? context.privateMetaPatch
            : {};

    const nowIso =
        new Date().toISOString();

    const source =
        cleanText(
            context.source ||
            'yhu_users_patch'
        );

    const mergedRaw = {
        ...currentRaw,
        ...safePatch,
        yhuMirrorContext: {
            ...(
                currentRaw.yhuMirrorContext &&
                typeof currentRaw.yhuMirrorContext === 'object'
                    ? currentRaw.yhuMirrorContext
                    : {}
            ),
            source,
            syncedAt:
                nowIso
        }
    };

    const mergedData = {
        ...currentData,
        ...safePatch,
        yhuMirrorContext: {
            ...(
                currentData.yhuMirrorContext &&
                typeof currentData.yhuMirrorContext === 'object'
                    ? currentData.yhuMirrorContext
                    : {}
            ),
            source,
            syncedAt:
                nowIso
        }
    };

    const payload = {
        raw_data:
            mergedRaw,

        data:
            mergedData,

        public_meta: {
            ...currentPublicMeta,
            ...publicMetaPatch
        },

        private_meta: {
            ...currentPrivateMeta,
            ...privateMetaPatch
        },

        data_hash:
            hashJson(
                mergedRaw
            ),

        updated_at_source:
            normalizeDate(
                safePatch.updatedAt ||
                safePatch.updated_at ||
                nowIso
            ),

        synced_at:
            nowIso,

        updated_at:
            nowIso
    };

    const {
        data,
        error
    } =
        await yhuSupabaseAdmin
            .from(TABLE)
            .update(payload)
            .eq(
                'id',
                existing.id
            )
            .select('*')
            .single();

    if (error) {
        throw new Error(
            error.message ||
            error.details ||
            String(error)
        );
    }

    return data;
}

async function upsertFromFirestoreUser(uid = '', user = {}, context = {}) {
    const cleanUid = cleanText(uid || user.uid || user.userId || user.firebaseUid);
    if (!cleanUid) return null;

    const payload = buildPayloadFromFirestoreUser(cleanUid, user || {}, context);
    const existing = await getByUid(cleanUid);

    if (existing?.id) {
        const { data, error } = await yhuSupabaseAdmin
            .from(TABLE)
            .update(payload)
            .eq('id', existing.id)
            .select('*')
            .single();

        if (error) {
            throw new Error(error.message || error.details || String(error));
        }

        return data;
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .insert(payload)
        .select('*')
        .single();

    if (error) {
        throw new Error(error.message || error.details || String(error));
    }

    return data;
}

async function syncFromFirestoreUserRef(userRef = null, context = {}) {
    if (!userRef || typeof userRef.get !== 'function') return null;

    const uid = cleanText(userRef.id);
    if (!uid) return null;

    const snap = await userRef.get();
    if (!snap.exists) return null;

    return upsertFromFirestoreUser(uid, snap.data() || {}, context);
}

async function countUsers() {
    const { count, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('id', { count: 'exact', head: true });

    if (error) {
        throw new Error(error.message || error.details || String(error));
    }

    return count || 0;
}

module.exports = {
    TABLE,
    buildPayloadFromFirestoreUser,
    countUsers,
    getByUid,
    listCanonicalUsers,
    deleteByUidAndEmail,
    patchByUid,
    stripSensitiveUserFields,
    syncFromFirestoreUserRef,
    upsertFromFirestoreUser
};
