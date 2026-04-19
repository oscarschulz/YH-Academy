const realtimeRepo = require('../backend/repositories/realtimeFirestoreRepo');

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const sendError = (res, error, fallbackMessage = 'Something went wrong.', statusCode = 500) => {
    const message = sanitizeText(error?.message, fallbackMessage);
    return res.status(statusCode).json({
        success: false,
        message
    });
};

function getViewerFromRequest(req) {
    return {
        id: sanitizeText(req.user?.id || req.user?.firebaseUid),
        firebaseUid: sanitizeText(req.user?.firebaseUid || req.user?.id),
        email: sanitizeText(req.user?.email).toLowerCase(),
        username: sanitizeText(req.user?.username),
        name: sanitizeText(req.user?.name || req.user?.fullName || req.user?.username || 'Hustler')
    };
}

exports.getBootstrap = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({ success: false, message: 'Missing authenticated user.' });
        }

        const data = await realtimeRepo.getBootstrap(viewer.id);
        return res.json({ success: true, data });
    } catch (error) {
        console.error('getBootstrap error:', error);
        return sendError(res, error, 'Failed to load realtime bootstrap data.');
    }
};

exports.getRooms = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const rooms = await realtimeRepo.getRooms(viewer.id);
        return res.json({ success: true, rooms });
    } catch (error) {
        console.error('getRooms error:', error);
        return sendError(res, error, 'Failed to load rooms.');
    }
};

exports.createRoom = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        const roomType = sanitizeText(req.body?.roomType || req.body?.type || 'group').toLowerCase();
        const description = sanitizeText(req.body?.description);
        const requestedName = sanitizeText(req.body?.name);

        const requestedMembers = Array.isArray(req.body?.memberUserIds)
            ? req.body.memberUserIds
            : [];

        const targetUserId = sanitizeText(req.body?.targetUserId || req.body?.userId);

        const result = await realtimeRepo.createRoom({
            userId: viewer.id,
            roomType,
            description,
            name: requestedName,
            memberUserIds: requestedMembers,
            targetUserId
        });

        return res.status(result.reused ? 200 : 201).json({
            success: true,
            room: result.room,
            reused: !!result.reused
        });
    } catch (error) {
        console.error('createRoom error:', error);

        const badRequest = /valid target user|required/i.test(error?.message || '');
        return sendError(
            res,
            error,
            'Failed to create room.',
            badRequest ? 400 : 500
        );
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const roomId = sanitizeText(req.params?.id);

        const result = await realtimeRepo.deleteRoom({
            userId: viewer.id,
            roomId
        });

        return res.json({
            success: true,
            deletedRoomId: result.deletedRoomId
        });
    } catch (error) {
        console.error('deleteRoom error:', error);

        const notFound = /not found/i.test(error?.message || '');
        const forbidden = /only the room owner/i.test(error?.message || '');
        const badRequest = /cannot be deleted/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to delete room.',
            notFound ? 404 : forbidden ? 403 : badRequest ? 400 : 500
        );
    }
};

exports.hideRoom = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const roomId = sanitizeText(req.params?.id);

        const room = await realtimeRepo.hideRoomForUser({
            userId: viewer.id,
            roomId
        });

        return res.json({
            success: true,
            room
        });
    } catch (error) {
        console.error('hideRoom error:', error);

        const notFound = /not found/i.test(error?.message || '');
        return sendError(
            res,
            error,
            'Failed to hide room.',
            notFound ? 404 : 500
        );
    }
};

exports.muteRoom = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const roomId = sanitizeText(req.params?.id);
        const muted = req.body?.muted !== false;

        const room = await realtimeRepo.setRoomMuted({
            userId: viewer.id,
            roomId,
            muted
        });

        return res.json({
            success: true,
            room
        });
    } catch (error) {
        console.error('muteRoom error:', error);

        const notFound = /not found/i.test(error?.message || '');
        return sendError(
            res,
            error,
            'Failed to update mute state.',
            notFound ? 404 : 500
        );
    }
};

exports.blockRoom = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const roomId = sanitizeText(req.params?.id);
        const blocked = req.body?.blocked !== false;

        const room = await realtimeRepo.setRoomBlocked({
            userId: viewer.id,
            roomId,
            blocked
        });

        return res.json({
            success: true,
            room
        });
    } catch (error) {
        console.error('blockRoom error:', error);

        const notFound = /not found/i.test(error?.message || '');
        return sendError(
            res,
            error,
            'Failed to update block state.',
            notFound ? 404 : 500
        );
    }
};

exports.getVaultItems = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const items = await realtimeRepo.getVaultItems(viewer.id);
        return res.json({ success: true, items });
    } catch (error) {
        console.error('getVaultItems error:', error);
        return sendError(res, error, 'Failed to load vault items.');
    }
};

exports.createVaultFolder = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        const parentId = sanitizeText(req.body?.parentId);
        const name = sanitizeText(req.body?.name);

        const item = await realtimeRepo.createVaultFolder({
            userId: viewer.id,
            parentId,
            name
        });

        return res.status(201).json({ success: true, item });
    } catch (error) {
        console.error('createVaultFolder error:', error);

        const badRequest = /required|invalid parent/i.test(error?.message || '');
        return sendError(
            res,
            error,
            'Failed to create vault folder.',
            badRequest ? 400 : 500
        );
    }
};

exports.createVaultFile = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        const parentId = sanitizeText(req.body?.parentId);
        const name = sanitizeText(req.body?.name || req.body?.fileName);
        const filePath = sanitizeText(req.body?.filePath);
        const mimeType = sanitizeText(req.body?.mimeType);
        const fileSize = req.body?.fileSize;

        const item = await realtimeRepo.createVaultFile({
            userId: viewer.id,
            parentId,
            name,
            filePath,
            mimeType,
            fileSize
        });

        return res.status(201).json({ success: true, item });
    } catch (error) {
        console.error('createVaultFile error:', error);

        const badRequest = /required|invalid parent/i.test(error?.message || '');
        return sendError(
            res,
            error,
            'Failed to create vault file metadata.',
            badRequest ? 400 : 500
        );
    }
};

exports.getLiveRooms = async (req, res) => {
    try {
        const rooms = await realtimeRepo.getLiveRooms();
        return res.json({ success: true, rooms });
    } catch (error) {
        console.error('getLiveRooms error:', error);
        return sendError(res, error, 'Failed to load live rooms.');
    }
};

exports.createLiveRoom = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        const roomType = sanitizeText(req.body?.roomType || req.body?.type || 'voice').toLowerCase();
        const title = sanitizeText(req.body?.title);
        const topic = sanitizeText(req.body?.topic);

        const room = await realtimeRepo.createLiveRoom({
            userId: viewer.id,
            roomType,
            title,
            topic
        });

        return res.status(201).json({ success: true, room });
    } catch (error) {
        console.error('createLiveRoom error:', error);

        const badRequest = /required/i.test(error?.message || '');
        return sendError(
            res,
            error,
            'Failed to create live room.',
            badRequest ? 400 : 500
        );
    }
};

exports.getNotifications = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const notifications = await realtimeRepo.getNotifications(viewer.id);

        const unreadCount = (Array.isArray(notifications) ? notifications : []).filter((item) => {
            return !(
                item?.isRead === true ||
                item?.is_read === true ||
                item?.read === true ||
                item?.readAt ||
                item?.read_at
            );
        }).length;

        return res.json({
            success: true,
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error('getNotifications error:', error);
        return sendError(res, error, 'Failed to load notifications.');
    }
};

exports.readAllNotifications = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        await realtimeRepo.readAllNotifications(viewer.id);
        return res.json({ success: true });
    } catch (error) {
        console.error('readAllNotifications error:', error);
        return sendError(res, error, 'Failed to mark notifications as read.');
    }
};

exports.readNotification = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const notificationId = sanitizeText(req.params?.id);

        const id = await realtimeRepo.readNotification({
            userId: viewer.id,
            notificationId
        });

        return res.json({ success: true, notificationId: id });
    } catch (error) {
        console.error('readNotification error:', error);

        const notFound = /not found/i.test(error?.message || '');
        return sendError(
            res,
            error,
            'Failed to mark notification as read.',
            notFound ? 404 : 500
        );
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const leaderboard = await realtimeRepo.getLeaderboard(50);
        return res.json({ success: true, leaderboard });
    } catch (error) {
        console.error('getLeaderboard error:', error);
        return sendError(res, error, 'Failed to load leaderboard.');
    }
};

exports.getProfileByName = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const rawName = sanitizeText(req.params?.name);

        if (!rawName) {
            return res.status(400).json({ success: false, message: 'Profile name is required.' });
        }

        const profile = await realtimeRepo.getProfileByName({
            currentUserId: viewer.id,
            rawName
        });

        return res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('getProfileByName error:', error);

        const notFound = /not found/i.test(error?.message || '');
        const badRequest = /required/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to load profile.',
            notFound ? 404 : badRequest ? 400 : 500
        );
    }
};

exports.toggleFollow = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        const followingUserId = sanitizeText(
            req.body?.userId ||
            req.body?.targetUserId
        );

        const result = await realtimeRepo.toggleFollow({
            followerUserId: viewer.id,
            followingUserId,
            actorName: viewer.name || viewer.username || 'Someone'
        });

        return res.json({
            success: true,
            isFollowing: result.isFollowing,
            followerStats: result.followerStats,
            targetStats: result.targetStats
        });
    } catch (error) {
        console.error('toggleFollow error:', error);

        const badRequest = /required|yourself/i.test(error?.message || '');
        const notFound = /not found/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to toggle follow state.',
            badRequest ? 400 : notFound ? 404 : 500
        );
    }
};