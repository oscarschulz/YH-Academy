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

function getCollectionsPageAccessKey() {
    return cleanText(process.env.YH_COLLECTIONS_PAGE_ACCESS_KEY || '');
}

function isValidCollectionsPageKey(value = '') {
    const expected = getCollectionsPageAccessKey();
    const received = cleanText(value);

    if (!expected || !received) return false;

    try {
        const a = Buffer.from(expected, 'utf8');
        const b = Buffer.from(received, 'utf8');

        if (a.length !== b.length) return false;

        return crypto.timingSafeEqual(a, b);
    } catch (_) {
        return false;
    }
}

function requireCollectionsReadAccess(req = {}) {
    const providedKey = cleanText(
        req.headers?.['x-yh-collections-key'] ||
        req.query?.accessKey ||
        ''
    );

    if (!isValidCollectionsPageKey(providedKey)) {
        const error = new Error('Collections access key is invalid.');
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