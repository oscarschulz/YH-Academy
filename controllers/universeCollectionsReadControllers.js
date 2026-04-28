const crypto = require('crypto');
const universeCollectionsReadRepo = require('../backend/repositories/universeCollectionsReadRepo');

function cleanText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function getViewerFromRequest(req = {}) {
    const user = req.user || {};

    return {
        id: cleanText(user.id || user.firebaseUid || user.uid),
        firebaseUid: cleanText(user.firebaseUid || user.id || user.uid),
        uid: cleanText(user.uid || user.firebaseUid || user.id),
        email: cleanText(user.email).toLowerCase(),
        username: cleanText(user.username),
        name: cleanText(user.name || user.fullName || user.displayName || user.username || 'YH Member'),
        fullName: cleanText(user.fullName || user.name),
        displayName: cleanText(user.displayName || user.fullName || user.name),
        avatar: cleanText(user.avatar || user.profilePhoto || user.photoURL),
        profilePhoto: cleanText(user.profilePhoto || user.avatar || user.photoURL),
        photoURL: cleanText(user.photoURL || user.avatar || user.profilePhoto)
    };
}

function sendError(res, error, fallbackMessage = 'Something went wrong.') {
    const statusCode = Number(error?.statusCode || error?.status || 500);
    const safeStatus = statusCode >= 400 && statusCode <= 599 ? statusCode : 500;

    return res.status(safeStatus).json({
        success: false,
        message: cleanText(error?.message, fallbackMessage)
    });
}

const COLLECTIONS_ACCESS_COOKIE_NAME = 'yh_collections_access_token';

function parseCookieHeader(raw = '') {
    const out = {};

    String(raw || '').split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return;

        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();

        if (!key) return;

        try {
            out[key] = decodeURIComponent(value);
        } catch (_) {
            out[key] = value;
        }
    });

    return out;
}

function getCollectionsAccessTokenSecret() {
    return cleanText(process.env.YH_COLLECTIONS_ACCESS_TOKEN_SECRET || '');
}

function safeTimingCompareText(left = '', right = '') {
    const a = Buffer.from(cleanText(left), 'utf8');
    const b = Buffer.from(cleanText(right), 'utf8');

    if (!a.length || !b.length || a.length !== b.length) return false;

    try {
        return crypto.timingSafeEqual(a, b);
    } catch (_) {
        return false;
    }
}

function verifyCollectionsAccessToken(token = '') {
    const secret = getCollectionsAccessTokenSecret();
    const cleanToken = cleanText(token);

    if (!secret || !cleanToken || !cleanToken.includes('.')) return false;

    const [payload, signature] = cleanToken.split('.');

    if (!payload || !signature) return false;

    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64url');

    if (!safeTimingCompareText(expectedSignature, signature)) return false;

    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

        return (
            decoded &&
            decoded.scope === 'yh_collections' &&
            Number(decoded.exp || 0) > Date.now()
        );
    } catch (_) {
        return false;
    }
}

function requireCollectionsReadAccess(req = {}) {
    const cookies = parseCookieHeader(req.headers?.cookie || '');
    const token = cleanText(
        cookies[COLLECTIONS_ACCESS_COOKIE_NAME] ||
        req.headers?.['x-yh-collections-access-token'] ||
        ''
    );

    if (!verifyCollectionsAccessToken(token)) {
        const error = new Error('Collections login session is invalid or expired.');
        error.statusCode = 404;
        throw error;
    }

    return true;
}

exports.getCollectionsBootstrap = async (req, res) => {
    try {
        requireCollectionsReadAccess(req);

        const viewer = getViewerFromRequest(req);
        const data = await universeCollectionsReadRepo.getBootstrap(viewer, req.query || {});

        return res.json({
            success: true,
            ...data
        });
    } catch (error) {
        console.error('getCollectionsBootstrap error:', error);
        return sendError(res, error, 'Failed to load Universe collections.');
    }
};

exports.listCollectionIndex = async (req, res) => {
    try {
        requireCollectionsReadAccess(req);

        const viewer = getViewerFromRequest(req);
        const items = await universeCollectionsReadRepo.listIndexItems(viewer, req.query || {});

        return res.json({
            success: true,
            items
        });
    } catch (error) {
        console.error('listCollectionIndex error:', error);
        return sendError(res, error, 'Failed to load collection index.');
    }
};

exports.listFederationLeadInventory = async (req, res) => {
    try {
        requireCollectionsReadAccess(req);

        const viewer = getViewerFromRequest(req);
        const leads = await universeCollectionsReadRepo.listFederationLeadInventory(viewer, req.query || {});

        return res.json({
            success: true,
            leads
        });
    } catch (error) {
        console.error('listFederationLeadInventory error:', error);
        return sendError(res, error, 'Failed to load Federation lead marketplace.');
    }
};