const universeCollectionsRepo = require('../backend/repositories/universeCollectionsRepo');

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
        name: cleanText(
            user.name ||
            user.fullName ||
            user.displayName ||
            user.username ||
            'YH Member'
        ),
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

exports.listCollections = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const items = await universeCollectionsRepo.listCollections(viewer, req.query || {});

        return res.json({
            success: true,
            items
        });
    } catch (error) {
        console.error('listCollections error:', error);
        return sendError(res, error, 'Failed to load collections.');
    }
};

exports.createCollectionItem = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const item = await universeCollectionsRepo.createCollectionItem(viewer, req.body || {});

        return res.status(201).json({
            success: true,
            item
        });
    } catch (error) {
        console.error('createCollectionItem error:', error);
        return sendError(res, error, 'Failed to create collection item.');
    }
};

exports.getCollectionItem = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const item = await universeCollectionsRepo.getCollectionItemById(viewer, req.params.id);

        return res.json({
            success: true,
            item
        });
    } catch (error) {
        console.error('getCollectionItem error:', error);
        return sendError(res, error, 'Failed to load collection item.');
    }
};

exports.updateMyCollectionItem = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const item = await universeCollectionsRepo.updateMyCollectionItem(viewer, req.params.id, req.body || {});

        return res.json({
            success: true,
            item
        });
    } catch (error) {
        console.error('updateMyCollectionItem error:', error);
        return sendError(res, error, 'Failed to update collection item.');
    }
};

exports.deleteMyCollectionItem = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const result = await universeCollectionsRepo.deleteMyCollectionItem(viewer, req.params.id);

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('deleteMyCollectionItem error:', error);
        return sendError(res, error, 'Failed to delete collection item.');
    }
};