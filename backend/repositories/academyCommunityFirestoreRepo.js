const { firestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

const usersCol = firestore.collection('users');
const feedPostsCol = firestore.collection('academyFeedPosts');
const friendRequestsCol = firestore.collection('academyFriendRequests');
const friendshipsCol = firestore.collection('academyFriendships');
const academyFollowsCol = firestore.collection('academyUserFollows');

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
const followKeyFor = (followerId, followingId) => {
    return `${normalizeUserId(followerId)}_${normalizeUserId(followingId)}`;
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
            outgoing_friend_request_pending: false,
            incoming_friend_request_pending: false,
            incoming_friend_request_id: ''
        };
    }

    const friendshipSnap = await friendshipsCol.doc(
        friendshipKeyFor(normalizedViewerId, normalizedAuthorId)
    ).get();

    if (friendshipSnap.exists) {
        return {
            is_friend: true,
            outgoing_friend_request_pending: false,
            incoming_friend_request_pending: false,
            incoming_friend_request_id: ''
        };
    }

    const [outgoingPendingSnap, incomingPendingSnap] = await Promise.all([
        friendRequestsCol
            .where('senderId', '==', normalizedViewerId)
            .where('receiverId', '==', normalizedAuthorId)
            .where('status', '==', 'pending')
            .limit(1)
            .get(),
        friendRequestsCol
            .where('senderId', '==', normalizedAuthorId)
            .where('receiverId', '==', normalizedViewerId)
            .where('status', '==', 'pending')
            .limit(1)
            .get()
    ]);

    const incomingDoc = incomingPendingSnap.empty ? null : incomingPendingSnap.docs[0];

    return {
        is_friend: false,
        outgoing_friend_request_pending: !outgoingPendingSnap.empty,
        incoming_friend_request_pending: !incomingPendingSnap.empty,
        incoming_friend_request_id: incomingDoc ? sanitizeText(incomingDoc.id) : ''
    };
}
async function getFriendIdsForUser(userId) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return [];

    const [asUserOneSnap, asUserTwoSnap] = await Promise.all([
        friendshipsCol.where('userOneId', '==', normalizedUserId).get(),
        friendshipsCol.where('userTwoId', '==', normalizedUserId).get()
    ]);

    const ids = new Set();

    asUserOneSnap.docs.forEach((doc) => {
        const data = doc.data() || {};
        const otherId = normalizeUserId(data.userTwoId);
        if (otherId && otherId !== normalizedUserId) ids.add(otherId);
    });

    asUserTwoSnap.docs.forEach((doc) => {
        const data = doc.data() || {};
        const otherId = normalizeUserId(data.userOneId);
        if (otherId && otherId !== normalizedUserId) ids.add(otherId);
    });

    return Array.from(ids);
}

async function getMutualFriendCount(viewerId, targetUserId) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedTargetUserId = normalizeUserId(targetUserId);

    if (!normalizedViewerId || !normalizedTargetUserId || normalizedViewerId === normalizedTargetUserId) {
        return 0;
    }

    const [viewerFriendIds, targetFriendIds] = await Promise.all([
        getFriendIdsForUser(normalizedViewerId),
        getFriendIdsForUser(normalizedTargetUserId)
    ]);

    const viewerSet = new Set(viewerFriendIds);
    let count = 0;

    targetFriendIds.forEach((id) => {
        if (viewerSet.has(id)) count += 1;
    });

    return count;
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

    const mediaUrl = sanitizeText(data.mediaUrl || data.imageUrl);
    const mediaKindRaw = sanitizeText(data.mediaKind).toLowerCase();
    const mediaKind =
        mediaKindRaw === 'video'
            ? 'video'
            : mediaUrl
                ? 'image'
                : '';

    const imageUrl = mediaKind === 'image'
        ? sanitizeText(data.imageUrl || data.mediaUrl)
        : '';

    const videoUrl = mediaKind === 'video'
        ? mediaUrl
        : '';

    return {
        id: doc.id,
        user_id: sanitizeText(data.authorId),
        body: sanitizeText(data.body),
        image_url: imageUrl,
        video_url: videoUrl,
        media_url: mediaUrl,
        media_kind: mediaKind,
        media_type: sanitizeText(data.mediaType),
        media_size: toInt(data.mediaSize, 0),
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
    const snapshot = data.authorSnapshot && typeof data.authorSnapshot === 'object'
        ? data.authorSnapshot
        : {};

    const fallback = extras.authorFallback && typeof extras.authorFallback === 'object'
        ? extras.authorFallback
        : {};

    const fullName =
        sanitizeText(snapshot.fullName) ||
        sanitizeText(snapshot.name) ||
        sanitizeText(fallback.fullName) ||
        sanitizeText(fallback.name);

    const displayName =
        sanitizeText(snapshot.displayName) ||
        sanitizeText(snapshot.display_name) ||
        fullName ||
        sanitizeText(fallback.displayName) ||
        sanitizeText(fallback.display_name) ||
        sanitizeText(fallback.username) ||
        'Academy Member';

    const username =
        sanitizeText(snapshot.username) ||
        sanitizeText(fallback.username);

    const avatar =
        sanitizeText(snapshot.avatar) ||
        sanitizeText(snapshot.avatarUrl) ||
        sanitizeText(snapshot.profilePhoto) ||
        sanitizeText(snapshot.photoURL) ||
        sanitizeText(fallback.avatar) ||
        sanitizeText(fallback.avatarUrl) ||
        sanitizeText(fallback.profilePhoto) ||
        sanitizeText(fallback.photoURL);

    const roleLabel =
        sanitizeText(snapshot.roleLabel) ||
        sanitizeText(snapshot.role_label) ||
        sanitizeText(fallback.roleLabel) ||
        sanitizeText(fallback.role) ||
        'Academy Member';

    return {
        id: doc.id,
        post_id: sanitizeText(extras.postId),
        user_id: sanitizeText(data.authorId),
        body: sanitizeText(data.body),
        created_at: mapTimestamp(data.createdAt),
        updated_at: mapTimestamp(data.updatedAt),
        fullName,
        display_name: displayName,
        username,
        avatar,
        avatarUrl: avatar,
        profilePhoto: avatar,
        photoURL: avatar,
        role_label: roleLabel,
        owned_by_me: sanitizeText(data.authorId) === sanitizeText(extras.viewerId)
    };
}
function extractHashtagsFromText(value = '') {
    const matches = String(value || '')
        .toLowerCase()
        .match(/#[a-z0-9_][a-z0-9_-]*/g) || [];

    return Array.from(new Set(
        matches
            .map((tag) => sanitizeText(tag).replace(/^#/, ''))
            .filter(Boolean)
    ));
}

function buildSearchPostPreview(value = '', maxLength = 140) {
    const clean = sanitizeText(value).replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    if (clean.length <= maxLength) return clean;
    return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
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

async function createPost({
    viewer,
    body,
    imageUrl,
    mediaUrl,
    mediaKind,
    mediaType,
    mediaSize,
    visibility,
    share = null
}) {
    const viewerProfile = await getViewerProfile(viewer);
    const cleanBody = sanitizeText(body);
    const cleanMediaUrl = sanitizeText(mediaUrl) || sanitizeText(imageUrl);
    const cleanMediaKindInput = sanitizeText(mediaKind).toLowerCase();
    const cleanMediaKind =
        cleanMediaKindInput === 'video'
            ? 'video'
            : cleanMediaUrl
                ? 'image'
                : '';
    const cleanImageUrl =
        cleanMediaKind === 'image'
            ? (sanitizeText(imageUrl) || cleanMediaUrl)
            : '';
    const cleanMediaType = sanitizeText(mediaType);
    const cleanMediaSize = Math.max(0, toInt(mediaSize, 0));
    const cleanVisibility = sanitizeText(visibility || 'academy') || 'academy';

    if (!cleanBody && !cleanMediaUrl && !share) {
        throw new Error('Post body, image, video, or share payload is required.');
    }

    const ref = feedPostsCol.doc();
    const payload = {
        authorId: viewerProfile.id,
        body: cleanBody,
        imageUrl: cleanImageUrl,
        mediaUrl: cleanMediaUrl,
        mediaKind: cleanMediaKind,
        mediaType: cleanMediaType,
        mediaSize: cleanMediaSize,
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

    const visibleDocs = snap.docs.filter((doc) => !toBool(doc.data()?.isDeleted));

    const authorIds = Array.from(new Set(
        visibleDocs
            .map((doc) => normalizeUserId(doc.data()?.authorId))
            .filter(Boolean)
    ));

    const authorDocs = await Promise.all(
        authorIds.map((authorId) => getUserDoc(authorId).catch(() => null))
    );

    const authorFallbackById = new Map();

    authorDocs.forEach((authorDoc) => {
        if (!authorDoc?.id) return;
        authorFallbackById.set(normalizeUserId(authorDoc.id), authorDoc);
    });

    return visibleDocs.map((doc) => {
        const authorId = normalizeUserId(doc.data()?.authorId);

        return mapCommentDoc(doc, {
            postId: normalizedPostId,
            viewerId: normalizedViewerId,
            authorFallback: authorFallbackById.get(authorId) || {}
        });
    });
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
async function getAcademyFollowerCount(userId) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return 0;

    const snap = await academyFollowsCol
        .where('followingId', '==', normalizedUserId)
        .get();

    return snap.size;
}

async function listAcademyMembers({ viewerId, limit = 100, query = '' }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedLimit = Math.max(1, Math.min(toInt(limit, 100), 200));
    const normalizedQuery = sanitizeText(query).toLowerCase();
    const isHashtagQuery = normalizedQuery.startsWith('#') && normalizedQuery.length > 1;
    const hashtagNeedle = isHashtagQuery ? normalizedQuery.replace(/^#/, '') : '';

    const viewerFollowingSnap = normalizedViewerId
        ? await academyFollowsCol.where('followerId', '==', normalizedViewerId).get()
        : null;

    const followedIds = new Set(
        (viewerFollowingSnap?.docs || []).map((doc) => sanitizeText(doc.data()?.followingId))
    );

    if (isHashtagQuery) {
        const sourceLimit = Math.max(normalizedLimit * 6, 120);

        const postsSnap = await feedPostsCol
            .where('isDeleted', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(sourceLimit)
            .get();

        const matchedByUser = new Map();

        for (const doc of postsSnap.docs) {
            const data = doc.data() || {};
            const authorId = sanitizeText(data.authorId);

            if (!authorId || authorId === normalizedViewerId) continue;

            const hashtags = extractHashtagsFromText(data.body);
            if (!hashtags.includes(hashtagNeedle)) continue;

            const author = data.authorSnapshot && typeof data.authorSnapshot === 'object'
                ? data.authorSnapshot
                : {};

            const preview = buildSearchPostPreview(data.body);
            const createdAt = mapTimestamp(data.createdAt);

            if (!matchedByUser.has(authorId)) {
                matchedByUser.set(authorId, {
                    id: authorId,
                    fullName: sanitizeText(author.fullName || author.displayName),
                    display_name: sanitizeText(author.displayName || author.fullName || author.username || 'Academy Member'),
                    username: sanitizeText(author.username),
                    avatar: sanitizeText(author.avatar),
                    role_label: sanitizeText(author.roleLabel || 'Academy Member'),
                    followers_count: 0,
                    followed_by_me: followedIds.has(authorId),
                    search_tags: hashtags.slice(0, 6),
                    matched_hashtags: hashtags.slice(0, 6),
                    matched_posts_count: 1,
                    matched_post_preview: preview,
                    matched_post_created_at: createdAt
                });
                continue;
            }

            const existing = matchedByUser.get(authorId);
            existing.matched_posts_count += 1;
            existing.matched_hashtags = Array.from(
                new Set([...(existing.matched_hashtags || []), ...hashtags])
            ).slice(0, 6);

            if (!existing.matched_post_preview && preview) {
                existing.matched_post_preview = preview;
            }

            if (!existing.matched_post_created_at && createdAt) {
                existing.matched_post_created_at = createdAt;
            }
        }

        const members = await Promise.all(
            Array.from(matchedByUser.values()).map(async (member) => ({
                ...member,
                followers_count: await getAcademyFollowerCount(member.id)
            }))
        );

        return members
            .sort((a, b) => {
                const countDelta = Number(b.matched_posts_count || 0) - Number(a.matched_posts_count || 0);
                if (countDelta !== 0) return countDelta;

                const left = String(a.display_name || a.fullName || '').toLowerCase();
                const right = String(b.display_name || b.fullName || '').toLowerCase();
                return left.localeCompare(right);
            })
            .slice(0, normalizedLimit);
    }

    const sourceLimit = normalizedQuery ? Math.max(normalizedLimit, 200) : normalizedLimit;
    const usersSnap = await usersCol.limit(sourceLimit).get();

    const members = await Promise.all(
        usersSnap.docs.map(async (doc) => {
            const raw = { id: doc.id, ...(doc.data() || {}) };
            const userId = sanitizeText(raw.id);

            if (!userId || userId === normalizedViewerId) return null;

            const snapshot = buildAuthorSnapshot(raw, {});
            const followerCount = await getAcademyFollowerCount(userId);

            const explicitTags = Array.isArray(raw.searchTags)
                ? raw.searchTags
                    .map((value) => sanitizeText(value).toLowerCase().replace(/^#/, ''))
                    .filter(Boolean)
                : [];

            const searchTags = Array.from(new Set(explicitTags));

            const member = {
                id: userId,
                fullName: snapshot.fullName,
                display_name: snapshot.displayName,
                username: snapshot.username,
                avatar: snapshot.avatar,
                role_label: snapshot.roleLabel || 'Academy Member',
                followers_count: followerCount,
                followed_by_me: followedIds.has(userId),
                search_tags: searchTags,
                matched_hashtags: [],
                matched_posts_count: 0,
                matched_post_preview: ''
            };

            if (!normalizedQuery) {
                return member;
            }

            const haystack = [
                member.display_name,
                member.fullName,
                member.username,
                member.role_label,
                member.search_tags.join(' ')
            ]
                .map((value) => sanitizeText(value).toLowerCase())
                .join(' ');

            return haystack.includes(normalizedQuery) ? member : null;
        })
    );

    return members
        .filter(Boolean)
        .sort((a, b) => {
            const left = String(a.display_name || a.fullName || '').toLowerCase();
            const right = String(b.display_name || b.fullName || '').toLowerCase();
            return left.localeCompare(right);
        })
        .slice(0, normalizedLimit);
}
async function getMemberProfile({ viewerId, targetUserId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedTargetUserId = normalizeUserId(targetUserId);

    if (!normalizedTargetUserId) {
        throw new Error('targetUserId is required.');
    }

    const targetUser = await getUserDoc(normalizedTargetUserId);
    if (!targetUser) {
        throw new Error('Target member not found.');
    }

    const academyProfileSnap = await usersCol
        .doc(normalizedTargetUserId)
        .collection('academy')
        .doc('profile')
        .get();

    const academyProfile = academyProfileSnap.exists ? (academyProfileSnap.data() || {}) : {};

    const displayName =
        sanitizeText(
            academyProfile.display_name ||
            academyProfile.displayName ||
            targetUser.displayName ||
            targetUser.fullName ||
            targetUser.name ||
            targetUser.username ||
            'Hustler'
        ) || 'Hustler';

    const username =
        sanitizeText(
            academyProfile.username ||
            targetUser.username
        ).replace(/^@+/, '');

    const avatar =
        sanitizeText(
            academyProfile.avatar ||
            targetUser.avatar ||
            targetUser.profilePhoto ||
            targetUser.photoURL
        );

    const roleLabel =
        sanitizeText(
            academyProfile.role_label ||
            academyProfile.roleLabel ||
            targetUser.roleLabel ||
            targetUser.role ||
            'Academy Member'
        ) || 'Academy Member';

    const bio =
        sanitizeText(
            academyProfile.bio ||
            targetUser.bio ||
            targetUser.profileBio ||
            targetUser.about ||
            targetUser.description
        ) || 'Focused on execution, consistency, and long-term growth inside The Academy.';

    const coverPhoto =
        sanitizeText(
            academyProfile.cover_photo ||
            academyProfile.coverPhoto ||
            targetUser.coverPhoto
        );

    const followerCount = await getAcademyFollowerCount(normalizedTargetUserId);

    let followedByMe = false;
    if (normalizedViewerId && normalizedViewerId !== normalizedTargetUserId) {
        const followSnap = await academyFollowsCol
            .doc(followKeyFor(normalizedViewerId, normalizedTargetUserId))
            .get();

        followedByMe = followSnap.exists;
    }

    const [friendshipState, mutualFriendCount] = await Promise.all([
        getFriendshipState(
            normalizedViewerId,
            normalizedTargetUserId
        ),
        getMutualFriendCount(
            normalizedViewerId,
            normalizedTargetUserId
        )
    ]);

    const explicitTags = Array.isArray(academyProfile.search_tags || academyProfile.searchTags)
        ? (academyProfile.search_tags || academyProfile.searchTags)
            .map((value) => sanitizeText(value).toLowerCase().replace(/^#/, ''))
            .filter(Boolean)
        : Array.isArray(targetUser.searchTags)
            ? targetUser.searchTags
                .map((value) => sanitizeText(value).toLowerCase().replace(/^#/, ''))
                .filter(Boolean)
            : [];

    const postsSnap = await feedPostsCol
        .where('authorId', '==', normalizedTargetUserId)
        .limit(25)
        .get();

    const recentPostDocs = postsSnap.docs
        .filter((doc) => !toBool(doc.data()?.isDeleted))
        .sort((a, b) => {
            const leftRaw = a.data()?.createdAt;
            const rightRaw = b.data()?.createdAt;

            const left = typeof leftRaw?.toDate === 'function'
                ? leftRaw.toDate().getTime()
                : new Date(leftRaw || 0).getTime();

            const right = typeof rightRaw?.toDate === 'function'
                ? rightRaw.toDate().getTime()
                : new Date(rightRaw || 0).getTime();

            return right - left;
        })
        .slice(0, 6);

    const recentPosts = await Promise.all(
        recentPostDocs.map(async (doc) => {
            const likeState = await getLikeState(doc.id, normalizedViewerId);
            const commentCount = await getCommentCount(doc.id);

            return mapPostDoc(doc, {
                viewerId: normalizedViewerId,
                like_count: likeState.like_count,
                liked_by_me: likeState.liked_by_me,
                comment_count: commentCount,
                is_friend: friendshipState.is_friend,
                outgoing_friend_request_pending: friendshipState.outgoing_friend_request_pending
            });
        })
    );

    return {
        id: normalizedTargetUserId,
        fullName: displayName,
        display_name: displayName,
        username,
        avatar,
        cover_photo: coverPhoto,
        role_label: roleLabel,
        bio,
        followers_count: followerCount,
        followed_by_me: followedByMe,
        is_friend: friendshipState.is_friend,
        outgoing_friend_request_pending: friendshipState.outgoing_friend_request_pending,
        incoming_friend_request_pending: friendshipState.incoming_friend_request_pending,
        incoming_friend_request_id: friendshipState.incoming_friend_request_id,
        mutual_friend_count: mutualFriendCount,
        search_tags: Array.from(new Set(explicitTags)),
        post_count: recentPosts.length,
        recent_posts: recentPosts,
        status: 'Active',
        is_self: normalizedViewerId === normalizedTargetUserId
    };
}
async function toggleMemberFollow({ viewerId, targetUserId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedTargetUserId = normalizeUserId(targetUserId);

    if (!normalizedViewerId || !normalizedTargetUserId) {
        throw new Error('viewerId and targetUserId are required.');
    }

    if (normalizedViewerId === normalizedTargetUserId) {
        throw new Error('You cannot follow yourself.');
    }

    const targetUser = await getUserDoc(normalizedTargetUserId);
    if (!targetUser) {
        throw new Error('Target member not found.');
    }

    const ref = academyFollowsCol.doc(followKeyFor(normalizedViewerId, normalizedTargetUserId));
    const snap = await ref.get();

    let following = false;

    if (snap.exists) {
        await ref.delete();
        following = false;
    } else {
        await ref.set({
            followerId: normalizedViewerId,
            followingId: normalizedTargetUserId,
            createdAt: nowTs()
        });
        following = true;
    }

    const followerCount = await getAcademyFollowerCount(normalizedTargetUserId);

    return {
        targetUserId: normalizedTargetUserId,
        following,
        followerCount
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
    listAcademyMembers,
    getMemberProfile,
    toggleMemberFollow,
    sendFriendRequest,
    respondToFriendRequest
};