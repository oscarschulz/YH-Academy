const jwt = require('jsonwebtoken');
const { firestore } = require('../config/firebaseAdmin');

function parseCookies(req) {
    const raw = req.headers.cookie || '';
    const out = {};

    raw.split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return;

        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();

        if (!key) return;
        out[key] = decodeURIComponent(value);
    });

    return out;
}

function cleanText(value = '') {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeStatus(value = '') {
    return cleanText(value).toLowerCase().replace(/\s+/g, '_');
}

function isDeletedAccountRecord(user = {}) {
    if (!user || typeof user !== 'object') return false;

    const status = normalizeStatus(user.accountStatus || user.userStatus || user.status || '');
    const deletionStatus = normalizeStatus(user.deletionStatus || user.deleteStatus || '');

    return (
        user.deleted === true ||
        user.isDeleted === true ||
        user.accountDeleted === true ||
        user.isAccountDeleted === true ||
        user.disabled === true ||
        user.isDisabled === true ||
        Boolean(user.deletedAt || user.accountDeletedAt || user.disabledAt) ||
        ['deleted', 'disabled', 'deactivated', 'removed', 'archived'].includes(status) ||
        ['deleted', 'soft_deleted', 'hard_deleted', 'disabled', 'deactivated'].includes(deletionStatus)
    );
}

function buildExpiredAuthCookie() {
    const cookieParts = [
        'yh_auth_token=',
        'HttpOnly',
        'Path=/',
        'SameSite=Strict',
        'Max-Age=0'
    ];

    if (process.env.NODE_ENV === 'production') {
        cookieParts.push('Secure');
    }

    return cookieParts.join('; ');
}

function sendDeletedAccountResponse(res) {
    res.setHeader(
        'Set-Cookie',
        buildExpiredAuthCookie()
    );

    return res.status(401).json({
        success: false,
        accountDeleted: true,
        registrationRequired: true,
        message:
            'This account has been deleted. Please register again.'
    });
}

function normalizeAuthSessionVersion(
    value
) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
        ? Math.max(
            0,
            Math.trunc(parsed)
        )
        : 0;
}

function sendInvalidatedSessionResponse(
    res
) {
    res.setHeader(
        'Set-Cookie',
        buildExpiredAuthCookie()
    );

    return res.status(401).json({
        success: false,
        sessionInvalidated: true,
        passwordChanged: true,
        message:
            'Your session ended because the account password was changed. Please log in again.'
    });
}

module.exports = async (req, res, next) => {
    const headerToken = req.header('Authorization');
    const cookies = parseCookies(req);
    const cookieToken = cookies.yh_auth_token || '';

    const rawToken = headerToken
        ? headerToken.replace('Bearer ', '').trim()
        : String(cookieToken || '').trim();

    if (!rawToken) {
        return res.status(401).json({
            success: false,
            message: "Access Denied. No Gate Pass provided."
        });
    }

    try {
        const verified = jwt.verify(rawToken, process.env.JWT_SECRET);
        const uid = cleanText(verified?.id || verified?.uid || verified?.firebaseUid);

        if (!uid) {
            return sendDeletedAccountResponse(res);
        }

        if (uid !== 'local-superdev') {
            const userSnapshot =
                await firestore
                    .collection('users')
                    .doc(uid)
                    .get();

            if (
                !userSnapshot.exists ||
                isDeletedAccountRecord(
                    userSnapshot.data() || {}
                )
            ) {
                return sendDeletedAccountResponse(
                    res
                );
            }

            const user =
                userSnapshot.data() || {};

            const tokenAuthSessionVersion =
                normalizeAuthSessionVersion(
                    verified?.authSessionVersion
                );

            const userAuthSessionVersion =
                normalizeAuthSessionVersion(
                    user.authSessionVersion
                );

            if (
                tokenAuthSessionVersion !==
                userAuthSessionVersion
            ) {
                return sendInvalidatedSessionResponse(
                    res
                );
            }
        }

        req.user = {
            ...verified,
            id: uid,
            uid,
            firebaseUid: uid
        };

        return next();
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid or Expired Gate Pass."
        });
    }
};