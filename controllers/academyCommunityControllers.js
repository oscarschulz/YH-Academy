const academyCommunityRepo = require('../backend/repositories/academyCommunityFirestoreRepo');
const publicLandingEventsRepo = require('../backend/repositories/publicLandingEventsRepo');
const realtimeSupabaseRepo = require('../backend/repositories/realtimeSupabaseRepo');

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const sendError = (res, error, fallbackMessage = 'Something went wrong.', statusCode = 500) => {
    const message = sanitizeText(error?.message, fallbackMessage);

    const resolvedStatusCode =
        Number(
            error?.statusCode ||
            error?.status ||
            statusCode
        );

    return res
        .status(
            resolvedStatusCode >= 400 &&
            resolvedStatusCode < 600
                ? resolvedStatusCode
                : statusCode
        )
        .json({
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

/* PATCH: Academy community canonical notification producers v1 */
function getCommunityNotificationActorNameV1(
    viewer = {}
) {
    return sanitizeText(
        viewer.name ||
        viewer.username ||
        'An Academy member'
    );
}

function getCommunityNotificationActorInitialV1(
    viewer = {}
) {
    return (
        getCommunityNotificationActorNameV1(
            viewer
        )
            .charAt(0)
            .toUpperCase() ||
        'A'
    );
}

function getCommunityNotificationPreviewV1(
    value = '',
    maxLength = 120
) {
    const clean =
        sanitizeText(value)
            .replace(/\s+/g, ' ');

    if (!clean) return '';

    const safeMaxLength =
        Math.max(
            20,
            Number(maxLength) || 120
        );

    return clean.length <= safeMaxLength
        ? clean
        : clean
            .slice(
                0,
                safeMaxLength - 1
            )
            .trimEnd() +
            '…';
}

async function createCommunityNotificationV1(
    input = {},
    label = 'community notification'
) {
    try {
        return await realtimeSupabaseRepo
            .createNotification(
                input
            );
    } catch (error) {
        console.warn(
            `Academy ${label} skipped:`,
            error?.message ||
            error
        );

        return null;
    }
}
/* END PATCH: Academy community canonical notification producers v1 */

exports.getFeed = async (req, res) => {
    try {
        const viewer =
            getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message:
                    'Missing authenticated user.'
            });
        }

        const limit =
            Number.parseInt(
                req.query.limit,
                10
            ) || 25;

        const scope =
            sanitizeText(
                req.query.scope ||
                'global'
            ).toLowerCase();

        const nicheKey =
            sanitizeText(
                req.query.niche ||
                req.query.nicheKey ||
                ''
            ).toLowerCase();

        const relation =
            sanitizeText(
                req.query.relation ||
                ''
            ).toLowerCase();

        const cursor =
            sanitizeText(
                req.query.cursor ||
                ''
            );

        const feedPage =
            await academyCommunityRepo
                .listFeed({
                    viewerId:
                        viewer.id,
                    limit,
                    scope,
                    nicheKey,
                    relation,
                    cursor
                });

        return res.json({
            success: true,
            scope,
            nicheKey,
            relation,

            posts:
                Array.isArray(
                    feedPage?.posts
                )
                    ? feedPage.posts
                    : [],

            nextCursor:
                sanitizeText(
                    feedPage?.nextCursor
                ),

            hasMore:
                feedPage?.hasMore ===
                true,

            pageInfo:
                feedPage?.pageInfo &&
                typeof feedPage.pageInfo ===
                    'object'
                    ? feedPage.pageInfo
                    : {}
        });
    } catch (error) {
        console.error(
            'academyCommunityControllers.getFeed error:',
            error
        );

        return sendError(
            res,
            error,
            'Failed to load academy feed.'
        );
    }
};
exports.createPost = async (req, res) => {
    try {
        const viewer =
            getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message:
                    'Missing authenticated user.'
            });
        }

        const body =
            sanitizeText(
                req.body?.body
            ) ||
            sanitizeText(
                req.body?.content
            ) ||
            sanitizeText(
                req.body?.text
            );

        const mediaReceipt =
            sanitizeText(
                req.body?.mediaReceipt ||
                req.body?.media_receipt ||
                ''
            );

        const unverifiedMediaUrl =
            sanitizeText(
                req.body?.mediaUrl ||
                req.body?.media_url ||
                req.body?.imageUrl ||
                req.body?.image_url ||
                req.body?.videoUrl ||
                req.body?.video_url ||
                ''
            );

        if (
            unverifiedMediaUrl &&
            !mediaReceipt
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Re-upload the media before creating this post.'
            });
        }

        const visibility =
            sanitizeText(
                req.body?.visibility
            ) ||
            'academy';

        const feedScope =
            sanitizeText(
                req.body?.feedScope ||
                req.body?.feed_scope ||
                'global'
            ).toLowerCase();

        const nicheKey =
            sanitizeText(
                req.body?.nicheKey ||
                req.body?.niche_key ||
                ''
            ).toLowerCase();

        const nicheLabel =
            sanitizeText(
                req.body?.nicheLabel ||
                req.body?.niche_label ||
                ''
            );

        const audience =
            sanitizeText(
                req.body?.audience ||
                ''
            ).toLowerCase();

        const shareSourcePostId =
            sanitizeText(
                req.body?.share?.sourcePostId ||
                req.body?.share?.source_post_id ||
                req.body?.shareSourcePostId ||
                req.body?.share_source_post_id ||
                ''
            );

        const post =
            await academyCommunityRepo
                .createPost({
                    viewer,
                    body,
                    mediaReceipt,
                    visibility,
                    feedScope,
                    nicheKey,
                    nicheLabel,
                    audience,

                    share:
                        shareSourcePostId
                            ? {
                                sourcePostId:
                                    shareSourcePostId
                            }
                            : null
                });

        try {
            await publicLandingEventsRepo
                .createEventForUser(
                    viewer.id,
                    {
                        type:
                            'academy_community_post',

                        slot:
                            'plaza',

                        category:
                            'academy',

                        messagePrefix:
                            'New Academy post activity',

                        labelPrefix:
                            'Academy Community',

                        color:
                            '#22d3ee',

                        altitude:
                            0.18,

                        ttlSeconds:
                            900
                    }
                );
        } catch (glowError) {
            console.warn(
                'academy createPost public landing event skipped:',
                glowError?.message ||
                glowError
            );
        }

        return res
            .status(201)
            .json({
                success: true,
                post
            });
    } catch (error) {
        console.error(
            'academyCommunityControllers.createPost error:',
            error
        );

        return sendError(
            res,
            error,
            'Failed to create post.'
        );
    }
};
exports.getNiches = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const nicheState = await academyCommunityRepo.getCommunityNicheState({
            viewerId: viewer.id
        });

        return res.json({
            success: true,
            ...nicheState
        });
    } catch (error) {
        console.error('academyCommunityControllers.getNiches error:', error);
        return sendError(res, error, 'Failed to load community niches.');
    }
};

exports.joinNiche = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const nicheKey = sanitizeText(req.params?.nicheKey).toLowerCase();
        const makeDefault = req.body?.makeDefault === true;

        const nicheState = await academyCommunityRepo.joinCommunityNiche({
            viewerId: viewer.id,
            nicheKey,
            makeDefault
        });

        return res.json({
            success: true,
            ...nicheState
        });
    } catch (error) {
        console.error('academyCommunityControllers.joinNiche error:', error);
        return sendError(res, error, 'Failed to join niche.');
    }
};

exports.setDefaultNiche = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const nicheKey = sanitizeText(req.params?.nicheKey).toLowerCase();

        const nicheState = await academyCommunityRepo.setDefaultCommunityNiche({
            viewerId: viewer.id,
            nicheKey
        });

        return res.json({
            success: true,
            ...nicheState
        });
    } catch (error) {
        console.error('academyCommunityControllers.setDefaultNiche error:', error);
        return sendError(res, error, 'Failed to set default niche.');
    }
};

exports.leaveNiche = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const nicheKey = sanitizeText(req.params?.nicheKey).toLowerCase();

        const nicheState = await academyCommunityRepo.leaveCommunityNiche({
            viewerId: viewer.id,
            nicheKey
        });

        return res.json({
            success: true,
            ...nicheState
        });
    } catch (error) {
        console.error('academyCommunityControllers.leaveNiche error:', error);
        return sendError(res, error, 'Failed to leave niche.');
    }
};

exports.updatePost = async (req, res) => {
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

        const post = await academyCommunityRepo.updatePost({
            viewerId: viewer.id,
            postId,
            body
        });

        return res.json({
            success: true,
            post
        });
    } catch (error) {
        console.error('academyCommunityControllers.updatePost error:', error);

        const notFound = /not found/i.test(error?.message || '');
        const forbidden = /only edit your own post/i.test(error?.message || '');
        const isValidationError = /required/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to update post.',
            notFound ? 404 : forbidden ? 403 : isValidationError ? 400 : 500
        );
    }
};

exports.hidePost = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const postId = sanitizeText(req.params?.id);

        const result = await academyCommunityRepo.hidePostForViewer({
            viewerId: viewer.id,
            postId
        });

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('academyCommunityControllers.hidePost error:', error);

        const notFound = /not found/i.test(error?.message || '');
        const isValidationError = /required/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to hide post.',
            notFound ? 404 : isValidationError ? 400 : 500
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
        const viewer =
            getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message:
                    'Missing authenticated user.'
            });
        }

        const postId =
            sanitizeText(
                req.params?.id
            );

        const desiredLikedState =
            typeof req.body?.liked ===
            'boolean'
                ? req.body.liked
                : typeof req.body?.isLiked ===
                    'boolean'
                    ? req.body.isLiked
                    : null;

        const {
            notificationContext = {},
            ...result
        } = await academyCommunityRepo
            .togglePostLike({
                viewerId:
                    viewer.id,
                postId,
                liked:
                    desiredLikedState
            });

        const postOwnerId =
            sanitizeText(
                notificationContext
                    .postOwnerId
            );

        if (
            notificationContext
                .likeCreated === true &&
            postOwnerId &&
            postOwnerId !==
                viewer.id
        ) {
            const actorName =
                getCommunityNotificationActorNameV1(
                    viewer
                );

            const postPreview =
                getCommunityNotificationPreviewV1(
                    notificationContext
                        .postPreview
                );

            await createCommunityNotificationV1(
                {
                    notificationId:
                        `academy_post_like_${postId}_${viewer.id}_${postOwnerId}`,

                    userId:
                        postOwnerId,

                    type:
                        'academy-post-like',

                    notificationType:
                        'academy-post-like',

                    source:
                        'academy-community',

                    title:
                        'New post like',

                    body:
                        postPreview
                            ? `${actorName} liked your Academy post: “${postPreview}”`
                            : `${actorName} liked your Academy post.`,

                    target:
                        'academy-post',

                    targetId:
                        postId,

                    avatarStr:
                        getCommunityNotificationActorInitialV1(
                            viewer
                        ),

                    metadata: {
                        postId,
                        actorUserId:
                            viewer.id,
                        actorName,
                        interaction:
                            'like'
                    }
                },
                'post-like notification'
            );
        }

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error(
            'academyCommunityControllers.toggleLike error:',
            error
        );

        const notFound =
            /not found/i.test(
                error?.message ||
                ''
            );

        return sendError(
            res,
            error,
            'Failed to update like.',
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

        const parentCommentId =
            sanitizeText(req.body?.parentCommentId) ||
            sanitizeText(req.body?.parent_comment_id) ||
            sanitizeText(req.body?.replyToCommentId) ||
            sanitizeText(req.body?.reply_to_comment_id);

        const commentResult =
            await academyCommunityRepo
                .createPostComment({
                    viewer,
                    postId,
                    body,
                    parentCommentId
                });

        const comment =
            commentResult?.comment ||
            commentResult;

        const notificationContext =
            commentResult?.notificationContext &&
            typeof commentResult.notificationContext ===
                'object'
                ? commentResult.notificationContext
                : {};

        const actorName =
            getCommunityNotificationActorNameV1(
                viewer
            );

        const actorInitial =
            getCommunityNotificationActorInitialV1(
                viewer
            );

        const commentPreview =
            getCommunityNotificationPreviewV1(
                comment?.body ||
                body
            );

        const postOwnerId =
            sanitizeText(
                notificationContext
                    .postOwnerId
            );

        const parentAuthorId =
            sanitizeText(
                notificationContext
                    .parentAuthorId
            );

        const notificationJobs = [];

        if (
            parentCommentId &&
            parentAuthorId &&
            parentAuthorId !==
                viewer.id
        ) {
            notificationJobs.push(
                createCommunityNotificationV1(
                    {
                        notificationId:
                            `academy_comment_reply_${comment.id}_${parentAuthorId}`,

                        userId:
                            parentAuthorId,

                        type:
                            'academy-comment-reply',

                        notificationType:
                            'academy-comment-reply',

                        source:
                            'academy-community',

                        title:
                            'New comment reply',

                        body:
                            commentPreview
                                ? `${actorName} replied to your comment: “${commentPreview}”`
                                : `${actorName} replied to your comment.`,

                        target:
                            'academy-post',

                        targetId:
                            postId,

                        avatarStr:
                            actorInitial,

                        metadata: {
                            postId,
                            commentId:
                                comment.id,
                            parentCommentId,
                            actorUserId:
                                viewer.id,
                            actorName,
                            interaction:
                                'reply'
                        }
                    },
                    'comment-reply notification'
                )
            );
        }

        if (
            postOwnerId &&
            postOwnerId !==
                viewer.id &&
            postOwnerId !==
                parentAuthorId
        ) {
            notificationJobs.push(
                createCommunityNotificationV1(
                    {
                        notificationId:
                            `academy_post_comment_${comment.id}_${postOwnerId}`,

                        userId:
                            postOwnerId,

                        type:
                            'academy-post-comment',

                        notificationType:
                            'academy-post-comment',

                        source:
                            'academy-community',

                        title:
                            parentCommentId
                                ? 'New reply on your post'
                                : 'New post comment',

                        body:
                            commentPreview
                                ? `${actorName} commented on your Academy post: “${commentPreview}”`
                                : `${actorName} commented on your Academy post.`,

                        target:
                            'academy-post',

                        targetId:
                            postId,

                        avatarStr:
                            actorInitial,

                        metadata: {
                            postId,
                            commentId:
                                comment.id,
                            parentCommentId,
                            actorUserId:
                                viewer.id,
                            actorName,
                            interaction:
                                parentCommentId
                                    ? 'reply'
                                    : 'comment'
                        }
                    },
                    'post-comment notification'
                )
            );
        }

        if (notificationJobs.length) {
            await Promise.all(
                notificationJobs
            );
        }

        try {
            await publicLandingEventsRepo.createEventForUser(viewer.id, {
                type: parentCommentId ? 'academy_community_reply' : 'academy_community_comment',
                slot: 'plaza',
                category: 'academy',
                messagePrefix: parentCommentId ? 'New Academy reply activity' : 'New Academy comment activity',
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
exports.updateComment = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const postId = sanitizeText(req.params?.postId);
        const commentId = sanitizeText(req.params?.commentId);
        const body =
            sanitizeText(req.body?.body) ||
            sanitizeText(req.body?.content) ||
            sanitizeText(req.body?.text);

        const comment = await academyCommunityRepo.updatePostComment({
            viewerId: viewer.id,
            postId,
            commentId,
            body
        });

        return res.json({
            success: true,
            comment
        });
    } catch (error) {
        console.error('academyCommunityControllers.updateComment error:', error);

        const notFound = /not found/i.test(error?.message || '');
        const forbidden = /only edit your own comment/i.test(error?.message || '');
        const isValidationError = /required/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to update comment.',
            notFound ? 404 : forbidden ? 403 : isValidationError ? 400 : 500
        );
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const postId = sanitizeText(req.params?.postId);
        const commentId = sanitizeText(req.params?.commentId);

        const result = await academyCommunityRepo.deletePostComment({
            viewerId: viewer.id,
            postId,
            commentId
        });

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('academyCommunityControllers.deleteComment error:', error);

        const notFound = /not found/i.test(error?.message || '');
        const forbidden = /only delete your own comment|comments under your own post/i.test(error?.message || '');
        const isValidationError = /required/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to delete comment.',
            notFound ? 404 : forbidden ? 403 : isValidationError ? 400 : 500
        );
    }
};

exports.hideComment = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const postId = sanitizeText(req.params?.postId);
        const commentId = sanitizeText(req.params?.commentId);

        const result = await academyCommunityRepo.hidePostCommentForViewer({
            viewerId: viewer.id,
            postId,
            commentId
        });

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('academyCommunityControllers.hideComment error:', error);

        const notFound = /not found/i.test(error?.message || '');
        const isValidationError = /required/i.test(error?.message || '');

        return sendError(
            res,
            error,
            'Failed to hide comment.',
            notFound ? 404 : isValidationError ? 400 : 500
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

        const desiredFollowingState =
            typeof req.body?.following ===
            'boolean'
                ? req.body.following
                : typeof req.body?.followedByMe ===
                    'boolean'
                    ? req.body.followedByMe
                    : null;

        const result =
            await academyCommunityRepo
                .toggleMemberFollow({
                    viewerId:
                        viewer.id,
                    targetUserId,
                    following:
                        desiredFollowingState
                });

        if (result.following === true) {
            const actorName =
                getCommunityNotificationActorNameV1(
                    viewer
                );

            await createCommunityNotificationV1(
                {
                    notificationId:
                        `academy_member_follow_${viewer.id}_${targetUserId}`,

                    userId:
                        targetUserId,

                    type:
                        'follow',

                    notificationType:
                        'academy-member-follow',

                    source:
                        'academy-community',

                    title:
                        'New follower',

                    body:
                        `${actorName} started following you in the Academy.`,

                    target:
                        'profile',

                    targetId:
                        viewer.id,

                    avatarStr:
                        getCommunityNotificationActorInitialV1(
                            viewer
                        ),

                    metadata: {
                        followerUserId:
                            viewer.id,
                        followingUserId:
                            targetUserId
                    }
                },
                'member-follow notification'
            );

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

        const notFound =
            /not found/i.test(
                error?.message ||
                ''
            );

        const isValidationError =
            /yourself|required/i.test(
                error?.message ||
                ''
            );

        return sendError(
            res,
            error,
            'Failed to update follow state.',
            notFound
                ? 404
                : isValidationError
                    ? 400
                    : 500
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

        if (
            requestRecord?.created ===
            true
        ) {
            const actorName =
                getCommunityNotificationActorNameV1(
                    viewer
                );

            await createCommunityNotificationV1(
                {
                    notificationId:
                        `academy_friend_request_${requestRecord.id}_${receiverId}`,

                    userId:
                        receiverId,

                    type:
                        'academy-friend-request',

                    notificationType:
                        'academy-friend-request',

                    source:
                        'academy-community',

                    title:
                        'New friend request',

                    body:
                        `${actorName} sent you an Academy friend request.`,

                    target:
                        'profile',

                    targetId:
                        viewer.id,

                    avatarStr:
                        getCommunityNotificationActorInitialV1(
                            viewer
                        ),

                    metadata: {
                        requestId:
                            requestRecord.id,
                        senderUserId:
                            viewer.id,
                        receiverUserId:
                            receiverId
                    }
                },
                'friend-request notification'
            );
        }

        return res
            .status(
                requestRecord?.created ===
                false
                    ? 200
                    : 201
            )
            .json({
                success: true,
                request: requestRecord
            });
    } catch (error) {
        console.error('academyCommunityControllers.sendFriendRequest error:', error);

        const notFound =
            /not found/i.test(
                error?.message ||
                ''
            );

        const conflict =
            /already|request already sent/i.test(
                error?.message ||
                ''
            );

        const isValidationError =
            /yourself|required/i.test(
                error?.message ||
                ''
            );

        return sendError(
            res,
            error,
            'Failed to send friend request.',
            notFound
                ? 404
                : conflict
                    ? 409
                    : isValidationError
                        ? 400
                        : 500
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

        const requestRecord =
            result?.request &&
            typeof result.request ===
                'object'
                ? result.request
                : {};

        const senderId =
            sanitizeText(
                requestRecord.senderId
            );

        const responseStatus =
            sanitizeText(
                requestRecord.status
            ).toLowerCase();

        if (
            result?.alreadyHandled !==
                true &&
            senderId &&
            senderId !==
                viewer.id &&
            [
                'accepted',
                'declined'
            ].includes(
                responseStatus
            )
        ) {
            const actorName =
                getCommunityNotificationActorNameV1(
                    viewer
                );

            await createCommunityNotificationV1(
                {
                    notificationId:
                        `academy_friend_response_${requestId}_${responseStatus}_${senderId}`,

                    userId:
                        senderId,

                    type:
                        'academy-friend-response',

                    notificationType:
                        `academy-friend-${responseStatus}`,

                    source:
                        'academy-community',

                    title:
                        responseStatus ===
                            'accepted'
                            ? 'Friend request accepted'
                            : 'Friend request declined',

                    body:
                        `${actorName} ${responseStatus} your Academy friend request.`,

                    target:
                        'profile',

                    targetId:
                        viewer.id,

                    avatarStr:
                        getCommunityNotificationActorInitialV1(
                            viewer
                        ),

                    metadata: {
                        requestId,
                        responderUserId:
                            viewer.id,
                        senderUserId:
                            senderId,
                        status:
                            responseStatus
                    }
                },
                'friend-response notification'
            );
        }

        return res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('academyCommunityControllers.respondToFriendRequest error:', error);

        const notFound =
            /not found/i.test(
                error?.message ||
                ''
            );

        const conflict =
            /already been handled|accepted|declined/i.test(
                error?.message ||
                ''
            );

        const isValidationError =
            /only the receiver|required|invalid/i.test(
                error?.message ||
                ''
            );

        return sendError(
            res,
            error,
            'Failed to respond to friend request.',
            notFound
                ? 404
                : conflict
                    ? 409
                    : isValidationError
                        ? 400
                        : 500
        );
    }
};