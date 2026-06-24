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
    stripSensitiveUserFields,
    syncFromFirestoreUserRef,
    upsertFromFirestoreUser
};
