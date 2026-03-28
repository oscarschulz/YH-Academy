const { firestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

const usersCol = firestore.collection('users');
const feedPostsCol = firestore.collection('academyFeedPosts');
const friendRequestsCol = firestore.collection('academyFriendRequests');
const friendshipsCol = firestore.collection('academyFriendships');

const nowTs = () => Timestamp.now();

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const normalizeUserId = (value) => sanitizeText(value);
const toBool = (value) => value === true;
const toInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeFriendPair = (a, b) => {
    const x = normalizeUserId(a);
    const y = normalizeUserId(b);
    return x < y ? [x, y] : [y, x];
};

const friendshipKeyFor = (a, b) => {
    const [x, y] = normalizeFriendPair(a, b);
    return `${x}_${y}`;
};

const mapTimestamp = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value || null;
};

async function getUserDoc(userId) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return null;

    const snap = await usersCol.doc(normalizedUserId).get();
    if (!snap.exists) return null;

    return { id: snap.id, ...(snap.data() || {}) };
}

function buildAuthorSnapshot(userDoc = {}, fallbackUser = {}) {
    const fullName =
        sanitizeText(userDoc.fullName) ||
        sanitizeText(userDoc.name) ||
        sanitizeText(fallbackUser.name) ||
        sanitizeText(fallbackUser.fullName) ||
        sanitizeText(userDoc.username) ||
        sanitizeText(fallbackUser.username) ||
        'Hustler';

    const username =
        sanitizeText(userDoc.username) ||
        sanitizeText(fallbackUser.username);

    const avatar =
        sanitizeText(userDoc.avatar) ||
        sanitizeText(userDoc.profilePhoto) ||
        sanitizeText(userDoc.photoURL);

    const roleLabel =
        sanitizeText(userDoc.roleLabel) ||
        sanitizeText(userDoc.role) ||
        'Academy Member';

    return {
        fullName,
        displayName: fullName,
        username,
        avatar,
        roleLabel
    };
}

async function getViewerProfile(user = {}) {
    const viewerId = normalizeUserId(user?.id || user?.firebaseUid);
    if (!viewerId) {
        throw new Error('Missing viewer id.');
    }

    const userDoc = await getUserDoc(viewerId);

    const fallback = {
        name: user?.name,
        fullName: user?.fullName,
        username: user?.username,
        email: user?.email
    };

    const authorSnapshot = buildAuthorSnapshot(userDoc || {}, fallback);

    return {
        id: viewerId,
        email: sanitizeText(userDoc?.email || user?.email).toLowerCase(),
        ...authorSnapshot,
        stats: userDoc?.stats || {
            followersCount: 0,
            followingCount: 0,
            messagesCount: 0,
            repPoints: 0
        }
    };
}

async function getFriendshipState(viewerId, authorId) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedAuthorId = normalizeUserId(authorId);

    if (!normalizedViewerId || !normalizedAuthorId || normalizedViewerId === normalizedAuthorId) {
        return {
            is_friend: false,
            outgoing_friend_request_pending: false
        };
    }

    const friendshipSnap = await friendshipsCol.doc(friendshipKeyFor(normalizedViewerId, normalizedAuthorId)).get();
    if (friendshipSnap.exists) {
        return {
            is_friend: true,
            outgoing_friend_request_pending: false
        };
    }

    const pendingSnap = await friendRequestsCol
        .where('senderId', '==', normalizedViewerId)
        .where('receiverId', '==', normalizedAuthorId)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

    return {
        is_friend: false,
        outgoing_friend_request_pending: !pendingSnap.empty
    };
}

async function getLikeState(postId, viewerId) {
    const normalizedPostId = sanitizeText(postId);
    const normalizedViewerId = normalizeUserId(viewerId);

    if (!normalizedPostId || !normalizedViewerId) {
        return {
            liked_by_me: false,
            like_count: 0
        };
    }

    const likesCol = feedPostsCol.doc(normalizedPostId).collection('likes');
    const [viewerLikeSnap, allLikesSnap] = await Promise.all([
        likesCol.doc(normalizedViewerId).get(),
        likesCol.get()
    ]);

    return {
        liked_by_me: viewerLikeSnap.exists,
        like_count: allLikesSnap.size
    };
}

async function getCommentCount(postId) {
    const normalizedPostId = sanitizeText(postId);
    if (!normalizedPostId) return 0;

    const commentsSnap = await feedPostsCol.doc(normalizedPostId).collection('comments').get();
    return commentsSnap.docs.filter((doc) => !toBool(doc.data()?.isDeleted)).length;
}

function mapPostDoc(doc, extras = {}) {
    const data = doc.data() || {};
    const author = data.authorSnapshot || {};

    return {
        id: doc.id,
        user_id: sanitizeText(data.authorId),
        body: sanitizeText(data.body),
        image_url: sanitizeText(data.imageUrl),
        visibility: sanitizeText(data.visibility || 'academy'),
        is_pinned: toBool(data.isPinned),
        is_deleted: toBool(data.isDeleted),
        created_at: mapTimestamp(data.createdAt),
        updated_at: mapTimestamp(data.updatedAt),
        fullName: sanitizeText(author.fullName),
        display_name: sanitizeText(author.displayName || author.fullName),
        username: sanitizeText(author.username),
        avatar: sanitizeText(author.avatar),
        role_label: sanitizeText(author.roleLabel || 'Academy Member'),
        share: data.share || null,
        like_count: toInt(extras.like_count, 0),
        comment_count: toInt(extras.comment_count, 0),
        liked_by_me: toBool(extras.liked_by_me),
        owned_by_me: sanitizeText(data.authorId) === sanitizeText(extras.viewerId),
        following_author: false,
        is_friend: toBool(extras.is_friend),
        outgoing_friend_request_pending: toBool(extras.outgoing_friend_request_pending)
    };
}

function mapCommentDoc(doc, extras = {}) {
    const data = doc.data() || {};
    const author = data.authorSnapshot || {};

    return {
        id: doc.id,
        post_id: sanitizeText(extras.postId),
        user_id: sanitizeText(data.authorId),
        body: sanitizeText(data.body),
        created_at: mapTimestamp(data.createdAt),
        updated_at: mapTimestamp(data.updatedAt),
        fullName: sanitizeText(author.fullName),
        display_name: sanitizeText(author.displayName || author.fullName),
        username: sanitizeText(author.username),
        avatar: sanitizeText(author.avatar),
        role_label: sanitizeText(author.roleLabel || 'Academy Member'),
        owned_by_me: sanitizeText(data.authorId) === sanitizeText(extras.viewerId)
    };
}

async function listFeed({ viewerId, limit = 25 }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedLimit = Math.max(1, Math.min(toInt(limit, 25), 50));

    const snap = await feedPostsCol
        .where('isDeleted', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(normalizedLimit)
        .get();

    const posts = await Promise.all(
        snap.docs.map(async (doc) => {
            const data = doc.data() || {};
            const authorId = sanitizeText(data.authorId);

            const [likeState, commentCount, friendshipState] = await Promise.all([
                getLikeState(doc.id, normalizedViewerId),
                getCommentCount(doc.id),
                getFriendshipState(normalizedViewerId, authorId)
            ]);

            return mapPostDoc(doc, {
                viewerId: normalizedViewerId,
                ...likeState,
                comment_count: commentCount,
                ...friendshipState
            });
        })
    );

    return posts;
}

async function createPost({ viewer, body, imageUrl, visibility, share = null }) {
    const viewerProfile = await getViewerProfile(viewer);
    const cleanBody = sanitizeText(body);
    const cleanImageUrl = sanitizeText(imageUrl);
    const cleanVisibility = sanitizeText(visibility || 'academy') || 'academy';

    if (!cleanBody && !cleanImageUrl && !share) {
        throw new Error('Post body, image, or share payload is required.');
    }

    const ref = feedPostsCol.doc();
    const payload = {
        authorId: viewerProfile.id,
        body: cleanBody,
        imageUrl: cleanImageUrl,
        visibility: cleanVisibility,
        isPinned: false,
        isDeleted: false,
        createdAt: nowTs(),
        updatedAt: nowTs(),
        authorSnapshot: {
            fullName: viewerProfile.fullName,
            displayName: viewerProfile.displayName,
            username: viewerProfile.username,
            avatar: viewerProfile.avatar,
            roleLabel: viewerProfile.roleLabel
        },
        share: share || null
    };

    await ref.set(payload);

    return mapPostDoc(
        {
            id: ref.id,
            data: () => payload
        },
        {
            viewerId: viewerProfile.id,
            like_count: 0,
            comment_count: 0,
            liked_by_me: false,
            is_friend: false,
            outgoing_friend_request_pending: false
        }
    );
}

async function deletePost({ viewerId, postId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);

    if (!normalizedViewerId || !normalizedPostId) {
        throw new Error('viewerId and postId are required.');
    }

    const postRef = feedPostsCol.doc(normalizedPostId);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
        throw new Error('Post not found.');
    }

    const post = postSnap.data() || {};
    if (toBool(post.isDeleted)) {
        return { id: normalizedPostId, deleted: true };
    }

    if (sanitizeText(post.authorId) !== normalizedViewerId) {
        throw new Error('You can only delete your own post.');
    }

    await postRef.update({
        isDeleted: true,
        updatedAt: nowTs()
    });

    return {
        id: normalizedPostId,
        deleted: true
    };
}

async function togglePostLike({ viewerId, postId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);

    if (!normalizedViewerId || !normalizedPostId) {
        throw new Error('viewerId and postId are required.');
    }

    const postRef = feedPostsCol.doc(normalizedPostId);
    const postSnap = await postRef.get();

    if (!postSnap.exists || toBool(postSnap.data()?.isDeleted)) {
        throw new Error('Post not found.');
    }

    const likeRef = postRef.collection('likes').doc(normalizedViewerId);
    const likeSnap = await likeRef.get();

    let liked = false;

    if (likeSnap.exists) {
        await likeRef.delete();
        liked = false;
    } else {
        await likeRef.set({
            userId: normalizedViewerId,
            createdAt: nowTs()
        });
        liked = true;
    }

    const likesSnap = await postRef.collection('likes').get();

    return {
        liked,
        like_count: likesSnap.size
    };
}

async function listPostComments({ viewerId, postId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);

    if (!normalizedPostId) {
        throw new Error('postId is required.');
    }

    const postSnap = await feedPostsCol.doc(normalizedPostId).get();
    if (!postSnap.exists || toBool(postSnap.data()?.isDeleted)) {
        throw new Error('Post not found.');
    }

    const snap = await feedPostsCol
        .doc(normalizedPostId)
        .collection('comments')
        .orderBy('createdAt', 'asc')
        .get();

    return snap.docs
        .filter((doc) => !toBool(doc.data()?.isDeleted))
        .map((doc) => mapCommentDoc(doc, { postId: normalizedPostId, viewerId: normalizedViewerId }));
}

async function createPostComment({ viewer, postId, body }) {
    const viewerProfile = await getViewerProfile(viewer);
    const normalizedPostId = sanitizeText(postId);
    const cleanBody = sanitizeText(body);

    if (!normalizedPostId) {
        throw new Error('postId is required.');
    }

    if (!cleanBody) {
        throw new Error('Comment body is required.');
    }

    const postRef = feedPostsCol.doc(normalizedPostId);
    const postSnap = await postRef.get();

    if (!postSnap.exists || toBool(postSnap.data()?.isDeleted)) {
        throw new Error('Post not found.');
    }

    const commentRef = postRef.collection('comments').doc();
    const payload = {
        authorId: viewerProfile.id,
        body: cleanBody,
        isDeleted: false,
        createdAt: nowTs(),
        updatedAt: nowTs(),
        authorSnapshot: {
            fullName: viewerProfile.fullName,
            displayName: viewerProfile.displayName,
            username: viewerProfile.username,
            avatar: viewerProfile.avatar,
            roleLabel: viewerProfile.roleLabel
        }
    };

    await commentRef.set(payload);

    return mapCommentDoc(
        {
            id: commentRef.id,
            data: () => payload
        },
        {
            postId: normalizedPostId,
            viewerId: viewerProfile.id
        }
    );
}

async function sendFriendRequest({ senderId, receiverId }) {
    const normalizedSenderId = normalizeUserId(senderId);
    const normalizedReceiverId = normalizeUserId(receiverId);

    if (!normalizedSenderId || !normalizedReceiverId) {
        throw new Error('senderId and receiverId are required.');
    }

    if (normalizedSenderId === normalizedReceiverId) {
        throw new Error('You cannot send a friend request to yourself.');
    }

    const friendshipSnap = await friendshipsCol.doc(friendshipKeyFor(normalizedSenderId, normalizedReceiverId)).get();
    if (friendshipSnap.exists) {
        throw new Error('You are already friends.');
    }

    const existingPending = await friendRequestsCol
        .where('senderId', '==', normalizedSenderId)
        .where('receiverId', '==', normalizedReceiverId)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

    if (!existingPending.empty) {
        throw new Error('Friend request already pending.');
    }

    const ref = friendRequestsCol.doc();
    const payload = {
        senderId: normalizedSenderId,
        receiverId: normalizedReceiverId,
        status: 'pending',
        createdAt: nowTs(),
        respondedAt: null
    };

    await ref.set(payload);

    return {
        id: ref.id,
        ...payload,
        createdAt: mapTimestamp(payload.createdAt)
    };
}

async function respondToFriendRequest({ responderId, requestId, action }) {
    const normalizedResponderId = normalizeUserId(responderId);
    const normalizedRequestId = sanitizeText(requestId);
    const normalizedActionInput = sanitizeText(action).toLowerCase();
    const normalizedAction =
        normalizedActionInput === 'accept' ? 'accepted' :
        normalizedActionInput === 'decline' ? 'declined' :
        normalizedActionInput;

    if (!normalizedResponderId || !normalizedRequestId) {
        throw new Error('responderId and requestId are required.');
    }

    if (!['accepted', 'declined'].includes(normalizedAction)) {
        throw new Error('Action must be accept/accepted or decline/declined.');
    }

    const requestRef = friendRequestsCol.doc(normalizedRequestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
        throw new Error('Friend request not found.');
    }

    const request = requestSnap.data() || {};

    if (sanitizeText(request.receiverId) !== normalizedResponderId) {
        throw new Error('Only the receiver can respond to this request.');
    }

    if (sanitizeText(request.status) !== 'pending') {
        throw new Error('Friend request has already been handled.');
    }

    await requestRef.update({
        status: normalizedAction,
        respondedAt: nowTs()
    });

    if (normalizedAction === 'accepted') {
        const friendshipRef = friendshipsCol.doc(
            friendshipKeyFor(request.senderId, request.receiverId)
        );

        await friendshipRef.set({
            userOneId: normalizeFriendPair(request.senderId, request.receiverId)[0],
            userTwoId: normalizeFriendPair(request.senderId, request.receiverId)[1],
            createdAt: nowTs()
        });
    }

    return {
        id: normalizedRequestId,
        status: normalizedAction
    };
}

module.exports = {
    getViewerProfile,
    listFeed,
    createPost,
    deletePost,
    togglePostLike,
    listPostComments,
    createPostComment,
    sendFriendRequest,
    respondToFriendRequest
};