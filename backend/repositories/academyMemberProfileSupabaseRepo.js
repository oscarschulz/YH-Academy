const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_academy_member_profiles';

function cleanText(value = '') {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function lowerEmail(value = '') {
    return cleanText(value).toLowerCase();
}

function toNumberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
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

function safeProfileData(user = {}, uid = '') {
    const blockedKeys = new Set([
        'password',
        'verificationCode',
        'verificationCodeIssuedAt',
        'passwordResetCode',
        'passwordResetExpiresAt',
        'passwordResetVerifiedAt'
    ]);

    const safe = {};

    Object.entries(user || {}).forEach(([key, value]) => {
        if (blockedKeys.has(key)) return;
        safe[key] = normalizeValue(value);
    });

    safe.uid = uid;
    safe.userId = uid;
    safe.firebaseUid = uid;
    safe.sourceDatabase = 'supabase';
    safe.migratedFromFirestoreUsers = true;

    return safe;
}

function mergeSources(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    const publicMeta = row.public_meta && typeof row.public_meta === 'object' ? row.public_meta : {};
    const privateMeta = row.private_meta && typeof row.private_meta === 'object' ? row.private_meta : {};

    return {
        ...data,
        ...publicMeta,
        ...privateMeta,
        ...row
    };
}

function rowToFirestoreUser(row = {}) {
    const source = mergeSources(row);
    const uid = cleanText(row.user_id || row.firebase_uid || row.source_document_id || source.user_id || source.firebaseUid || source.uid || source.userId || '');

    const fullName = cleanText(row.full_name || row.display_name || source.fullName || source.name || source.displayName || source.userName || '');
    const email = lowerEmail(row.email || source.email || source.userEmail || '');
    const username = cleanText(row.username || source.username || source.handle || '');
    const country = cleanText(row.country || source.country || source.locationCountry || '');
    const countryCode = cleanText(row.country_code || source.countryCode || '');
    const city = cleanText(row.city || source.city || '');
    const avatar = cleanText(row.avatar || row.photo_url || row.profile_photo || source.avatar || source.photoURL || source.profilePhoto || '');
    const profilePhoto = cleanText(row.profile_photo || row.photo_url || row.avatar || source.profilePhoto || source.photoURL || source.avatar || '');

    return {
        ...source,
        id: uid,
        uid,
        userId: uid,
        firebaseUid: uid,
        email,
        fullName,
        name: cleanText(source.name || fullName),
        displayName: cleanText(source.displayName || fullName),
        username,
        contact: cleanText(row.contact || source.contact || source.phone || ''),
        country,
        locationCountry: cleanText(source.locationCountry || country),
        countryCode,
        city,
        lat: row.lat ?? source.lat ?? null,
        lng: row.lng ?? source.lng ?? null,
        isVerified: row.is_verified === true || source.isVerified === true,
        status: cleanText(row.status || source.status || ''),
        memberStatus: cleanText(row.member_status || source.memberStatus || row.status || source.status || ''),
        academyMembershipStatus: cleanText(row.academy_membership_status || source.academyMembershipStatus || source.academyApplicationStatus || ''),
        hasAcademyAccess: row.has_academy_access === true || source.hasAcademyAccess === true,
        academyApplicationStatus: cleanText(row.academy_application_status || source.academyApplicationStatus || ''),
        roadmapApplicationStatus: cleanText(row.roadmap_application_status || source.roadmapApplicationStatus || ''),
        avatar,
        profilePhoto,
        photoURL: cleanText(row.photo_url || source.photoURL || avatar || profilePhoto || ''),
        verificationBadges: row.verification_badges && typeof row.verification_badges === 'object'
            ? row.verification_badges
            : source.verificationBadges || {},
        academyApplication: row.academy_application && typeof row.academy_application === 'object'
            ? row.academy_application
            : source.academyApplication || {},
        roadmapApplication: row.roadmap_application && typeof row.roadmap_application === 'object'
            ? row.roadmap_application
            : source.roadmapApplication || {},
        createdAt: row.created_at_source || source.createdAt || row.created_at || '',
        updatedAt: row.updated_at_source || source.updatedAt || row.updated_at || ''
    };
}

function buildPayload(uid = '', user = {}, existingRow = {}) {
    const existingData = existingRow.data && typeof existingRow.data === 'object' ? existingRow.data : {};
    const existingPublicMeta = existingRow.public_meta && typeof existingRow.public_meta === 'object' ? existingRow.public_meta : {};
    const existingPrivateMeta = existingRow.private_meta && typeof existingRow.private_meta === 'object' ? existingRow.private_meta : {};

    const fullName = cleanText(user.fullName || user.name || user.displayName || user.userName || '');
    const username = cleanText(user.username || user.handle || '');
    const email = lowerEmail(user.email || user.userEmail || '');
    const country = cleanText(user.country || user.locationCountry || '');
    const countryCode = cleanText(user.countryCode || '');
    const city = cleanText(user.city || '');
    const avatar = cleanText(user.avatar || user.photoURL || user.photoUrl || user.profileImage || user.profilePhoto || '');
    const profilePhoto = cleanText(user.profilePhoto || user.photoURL || user.avatar || '');
    const status = cleanText(user.status || user.memberStatus || '');
    const memberStatus = cleanText(user.memberStatus || user.status || '');
    const academyMembershipStatus = cleanText(user.academyMembershipStatus || user.academyApplicationStatus || '');
    const academyApplicationStatus = cleanText(user.academyApplicationStatus || '');
    const roadmapApplicationStatus = cleanText(user.roadmapApplicationStatus || '');

    return {
        firebase_uid: uid,
        source_document_id: uid,
        source_document_path: `users/${uid}`,
        user_id: uid,
        email,
        full_name: fullName,
        display_name: fullName,
        username,
        contact: cleanText(user.contact || user.phone || ''),
        country,
        country_code: countryCode,
        city,
        lat: toNumberOrNull(user.lat),
        lng: toNumberOrNull(user.lng),
        is_verified: user.isVerified === true,
        status,
        member_status: memberStatus,
        academy_membership_status: academyMembershipStatus,
        has_academy_access: user.hasAcademyAccess === true,
        academy_application_status: academyApplicationStatus,
        roadmap_application_status: roadmapApplicationStatus,
        avatar,
        profile_photo: profilePhoto,
        photo_url: cleanText(user.photoURL || user.photoUrl || avatar || profilePhoto || ''),
        verification_badges: normalizeValue(user.verificationBadges || {}),
        academy_application: normalizeValue(user.academyApplication || {}),
        roadmap_application: normalizeValue(user.roadmapApplication || {}),
        created_at_source: normalizeDate(user.createdAt),
        updated_at_source: normalizeDate(user.updatedAt || user.lastActive || user.lastSeenAt || new Date().toISOString()),
        public_meta: {
            ...existingPublicMeta,
            uid,
            firebaseUid: uid,
            email,
            fullName,
            username,
            country,
            countryCode,
            city,
            isVerified: user.isVerified === true,
            status,
            memberStatus,
            academyMembershipStatus,
            hasAcademyAccess: user.hasAcademyAccess === true,
            academyApplicationStatus,
            roadmapApplicationStatus
        },
        private_meta: {
            ...existingPrivateMeta,
            uid,
            firebaseUid: uid,
            sourceCollection: 'users',
            sourceDocumentPath: `users/${uid}`,
            hasPassword: Boolean(cleanText(user.password)),
            hasVerificationCode: Boolean(cleanText(user.verificationCode))
        },
        data: {
            ...existingData,
            ...safeProfileData(user, uid)
        }
    };
}

function createFirestoreLikeSnapshot(uid = '', row = {}, fallbackRef = null) {
    const cleanUid = cleanText(uid || row.firebase_uid || row.source_document_id || row.id || '');
    const user = rowToFirestoreUser(row);

    return {
        exists: true,
        id: cleanUid,
        ref: fallbackRef || null,
        data: () => user
    };
}

async function getProfileByUid(uid = '') {
    const cleanUid = cleanText(uid);
    if (!cleanUid) return null;

    const queries = [
        ['user_id', cleanUid],
        ['firebase_uid', cleanUid],
        ['source_document_id', cleanUid]
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

async function getProfileByEmail(email = '') {
    const cleanEmail = lowerEmail(email);
    if (!cleanEmail) return null;

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('email', cleanEmail)
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(error.message || error.details || String(error));
    }

    return data || null;
}

async function getProfileSnapshotByUid(uid = '', fallbackRef = null) {
    const row = await getProfileByUid(uid);
    return row ? createFirestoreLikeSnapshot(uid, row, fallbackRef) : null;
}

async function upsertProfileFromUserData(uid = '', user = {}) {
    const cleanUid = cleanText(uid || user.uid || user.userId || user.firebaseUid);
    if (!cleanUid) return null;

    const existing = await getProfileByUid(cleanUid);
    const payload = buildPayload(cleanUid, user || {}, existing || {});

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

async function patchProfile(uid = '', patch = {}) {
    const cleanUid = cleanText(uid);
    if (!cleanUid) return null;

    const existing = await getProfileByUid(cleanUid);
    const existingUser = existing ? rowToFirestoreUser(existing) : {};

    return upsertProfileFromUserData(cleanUid, {
        ...existingUser,
        ...patch,
        updatedAt: patch.updatedAt || new Date().toISOString()
    });
}

async function countProfiles() {
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
    buildPayload,
    cleanText,
    countProfiles,
    createFirestoreLikeSnapshot,
    getProfileByEmail,
    getProfileByUid,
    getProfileSnapshotByUid,
    patchProfile,
    rowToFirestoreUser,
    upsertProfileFromUserData
};
