const academyCommunityRepo = require('../backend/repositories/academyCommunityFirestoreRepo');
const publicLandingEventsRepo = require('../backend/repositories/publicLandingEventsRepo');

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

exports.getFeed = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Number.parseInt(req.query.limit, 10) || 25;
        const posts = await academyCommunityRepo.listFeed({
            viewerId: viewer.id,
            limit
        });

        return res.json({
            success: true,
            posts
        });
    } catch (error) {
        console.error('academyCommunityControllers.getFeed error:', error);
        return sendError(res, error, 'Failed to load academy feed.');
    }
};
exports.createPost = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const body =
            sanitizeText(req.body?.body) ||
            sanitizeText(req.body?.content) ||
            sanitizeText(req.body?.text);

        const imageUrl =
            sanitizeText(req.body?.imageUrl) ||
            sanitizeText(req.body?.image_url);

        const mediaUrl =
            sanitizeText(req.body?.mediaUrl) ||
            sanitizeText(req.body?.media_url) ||
            imageUrl;

        const mediaKindInput = sanitizeText(
            req.body?.mediaKind || req.body?.media_kind
        ).toLowerCase();

        const mediaKind =
            mediaKindInput === 'video'
                ? 'video'
                : mediaUrl
                    ? 'image'
                    : '';

        const mediaType =
            sanitizeText(req.body?.mediaType) ||
            sanitizeText(req.body?.media_type) ||
            sanitizeText(req.body?.mediaMime) ||
            sanitizeText(req.body?.media_mime);

        const mediaSize = Number.parseInt(
            req.body?.mediaSize ?? req.body?.media_size ?? 0,
            10
        ) || 0;

        const visibility =
            sanitizeText(req.body?.visibility) || 'academy';

        const share = req.body?.share || null;

        const post = await academyCommunityRepo.createPost({
            viewer,
            body,
            imageUrl: mediaKind === 'video' ? '' : (imageUrl || mediaUrl),
            mediaUrl,
            mediaKind,
            mediaType,
            mediaSize,
            visibility,
            share
        });

        try {
            await publicLandingEventsRepo.createEventForUser(viewer.id, {
                type: 'academy_community_post',
                slot: 'plaza',
                category: 'academy',
                messagePrefix: 'New Academy post activity',
                labelPrefix: 'Academy Community',
                color: '#22d3ee',
                altitude: 0.18,
                ttlSeconds: 900
            });
        } catch (glowError) {
            console.warn('academy createPost public landing event skipped:', glowError?.message || glowError);
        }

        return res.status(201).json({
            success: true,
            post
        });
    } catch (error) {
        console.error('academyCommunityControllers.createPost error:', error);

        const isValidationError = /required/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to create post.',
            isValidationError ? 400 : 500
        );
    }
};
exports.deletePost = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const postId = sanitizeText(req.params?.id);

        const result = await academyCommunityRepo.deletePost({
            viewerId: viewer.id,
            postId
        });

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('academyCommunityControllers.deletePost error:', error);

        const notFound = /not found/i.test(error?.message || '');
        const forbidden = /only delete your own post/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to delete post.',
            notFound ? 404 : forbidden ? 403 : 500
        );
    }
};

exports.toggleLike = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const postId = sanitizeText(req.params?.id);

        const result = await academyCommunityRepo.togglePostLike({
            viewerId: viewer.id,
            postId
        });

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('academyCommunityControllers.toggleLike error:', error);

        const notFound = /not found/i.test(error?.message || '');
        return sendError(
            res,
            error,
            'Failed to toggle like.',
            notFound ? 404 : 500
        );
    }
};

exports.getComments = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const postId = sanitizeText(req.params?.id);

        const comments = await academyCommunityRepo.listPostComments({
            viewerId: viewer.id,
            postId
        });

        return res.json({
            success: true,
            comments
        });
    } catch (error) {
        console.error('academyCommunityControllers.getComments error:', error);

        const notFound = /not found/i.test(error?.message || '');
        return sendError(
            res,
            error,
            'Failed to load comments.',
            notFound ? 404 : 500
        );
    }
};

exports.createComment = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const postId = sanitizeText(req.params?.id);
        const body =
            sanitizeText(req.body?.body) ||
            sanitizeText(req.body?.content) ||
            sanitizeText(req.body?.text);

        const comment = await academyCommunityRepo.createPostComment({
            viewer,
            postId,
            body
        });

        try {
            await publicLandingEventsRepo.createEventForUser(viewer.id, {
                type: 'academy_community_comment',
                slot: 'plaza',
                category: 'academy',
                messagePrefix: 'New Academy comment activity',
                labelPrefix: 'Academy Community',
                color: '#22d3ee',
                altitude: 0.17,
                ttlSeconds: 780
            });
        } catch (glowError) {
            console.warn('academy createComment public landing event skipped:', glowError?.message || glowError);
        }

        return res.status(201).json({
            success: true,
            comment
        });
    } catch (error) {
        console.error('academyCommunityControllers.createComment error:', error);

        const isValidationError =
            /required/i.test(error?.message || '');
        const notFound = /not found/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to create comment.',
            isValidationError ? 400 : notFound ? 404 : 500
        );
    }
};
exports.getMembers = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Number.parseInt(req.query.limit, 10) || 100;
        const query =
            sanitizeText(req.query?.query) ||
            sanitizeText(req.query?.search) ||
            sanitizeText(req.query?.q) ||
            sanitizeText(req.query?.tag);

        const members = await academyCommunityRepo.listAcademyMembers({
            viewerId: viewer.id,
            limit,
            query
        });

        return res.json({
            success: true,
            members,
            query
        });
    } catch (error) {
        console.error('academyCommunityControllers.getMembers error:', error);
        return sendError(res, error, 'Failed to load Academy members.');
    }
};
exports.getMemberProfile = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const targetUserId = sanitizeText(req.params?.id);

        const profile = await academyCommunityRepo.getMemberProfile({
            viewerId: viewer.id,
            targetUserId
        });

        return res.json({
            success: true,
            profile
        });
    } catch (error) {
        console.error('academyCommunityControllers.getMemberProfile error:', error);

        const notFound = /not found/i.test(error?.message || '');
        const isValidationError = /required/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to load member profile.',
            notFound ? 404 : isValidationError ? 400 : 500
        );
    }
};
exports.toggleMemberFollow = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const targetUserId =
            sanitizeText(req.params?.id) ||
            sanitizeText(req.body?.targetUserId) ||
            sanitizeText(req.body?.userId);

        const result = await academyCommunityRepo.toggleMemberFollow({
            viewerId: viewer.id,
            targetUserId
        });

        if (result.following === true) {
            try {
                await publicLandingEventsRepo.createEventForUser(viewer.id, {
                    type: 'academy_member_follow',
                    slot: 'plaza',
                    category: 'academy',
                    messagePrefix: 'New Academy connection activity',
                    labelPrefix: 'Academy Community',
                    color: '#22d3ee',
                    altitude: 0.17,
                    ttlSeconds: 720
                });
            } catch (glowError) {
                console.warn('academy toggleMemberFollow public landing event skipped:', glowError?.message || glowError);
            }
        }

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('academyCommunityControllers.toggleMemberFollow error:', error);

        const isValidationError =
            /yourself|required|not found/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to update follow state.',
            isValidationError ? 400 : 500
        );
    }
};
exports.sendFriendRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const receiverId =
            sanitizeText(req.body?.receiverId) ||
            sanitizeText(req.body?.receiver_id) ||
            sanitizeText(req.body?.targetUserId) ||
            sanitizeText(req.body?.userId);

        const requestRecord = await academyCommunityRepo.sendFriendRequest({
            senderId: viewer.id,
            receiverId
        });

        return res.status(201).json({
            success: true,
            request: requestRecord
        });
    } catch (error) {
        console.error('academyCommunityControllers.sendFriendRequest error:', error);

        const isValidationError =
            /yourself|already|required/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to send friend request.',
            isValidationError ? 400 : 500
        );
    }
};

exports.respondToFriendRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const requestId = sanitizeText(req.params?.id);
        const action =
            sanitizeText(req.body?.action) ||
            sanitizeText(req.body?.status);

        const result = await academyCommunityRepo.respondToFriendRequest({
            responderId: viewer.id,
            requestId,
            action
        });

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('academyCommunityControllers.respondToFriendRequest error:', error);

        const isValidationError =
            /only the receiver|already been handled|accepted|declined|required/i.test(error?.message || '');
        const notFound = /not found/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to respond to friend request.',
            isValidationError ? 400 : notFound ? 404 : 500
        );
    }
};