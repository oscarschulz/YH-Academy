const crypto = require('crypto');
const { firestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

const usersCol = firestore.collection('users');
const chatRoomsCol = firestore.collection('chatRooms');
const vaultItemsCol = firestore.collection('vaultItems');
const liveRoomsCol = firestore.collection('liveRooms');
const notificationsCol = firestore.collection('notifications');
const followsCol = firestore.collection('userFollows');

const nowTs = () => Timestamp.now();

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const normalizeUserId = (value) => sanitizeText(value);
const toInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const safeArray = (value, fallback = []) => Array.isArray(value) ? value : fallback;

const makeRoomKey = (prefix = 'room') => {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
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

function buildUserSummary(userDoc = {}) {
    const stats = userDoc.stats || {};

    return {
        id: userDoc.id || '',
        fullName: sanitizeText(userDoc.fullName || userDoc.name),
        username: sanitizeText(userDoc.username),
        display_name: sanitizeText(userDoc.displayName || userDoc.fullName || userDoc.name),
        avatar: sanitizeText(userDoc.avatar || userDoc.profilePhoto || userDoc.photoURL),
        bio: sanitizeText(userDoc.bio),
        role_label: sanitizeText(userDoc.roleLabel || userDoc.role || 'Member'),
        rep_points: toInt(stats.repPoints, 0),
        followers_count: toInt(stats.followersCount, 0),
        following_count: toInt(stats.followingCount, 0),
        messages_count: toInt(stats.messagesCount, 0)
    };
}

async function getUserSummary(userId) {
    const userDoc = await getUserDoc(userId);
    if (!userDoc) return null;
    return buildUserSummary(userDoc);
}

function mapRoomDoc(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        room_key: sanitizeText(data.room_key),
        room_type: sanitizeText(data.room_type || 'group'),
        name: sanitizeText(data.name),
        description: sanitizeText(data.description),
        is_private: data.is_private ? 1 : 0,
        created_by_user_id: sanitizeText(data.created_by_user_id),
        created_at: mapTimestamp(data.created_at),
        updated_at: mapTimestamp(data.updated_at),
        member_count: toInt(data.member_count, safeArray(data.member_ids).length)
    };
}

function mapVaultItemDoc(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        user_id: sanitizeText(data.user_id),
        parent_id: sanitizeText(data.parent_id),
        item_type: sanitizeText(data.item_type),
        name: sanitizeText(data.name),
        file_path: sanitizeText(data.file_path),
        mime_type: sanitizeText(data.mime_type),
        file_size: toInt(data.file_size, 0),
        created_at: mapTimestamp(data.created_at),
        updated_at: mapTimestamp(data.updated_at)
    };
}

function mapLiveRoomDoc(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        room_key: sanitizeText(data.room_key),
        room_type: sanitizeText(data.room_type || 'voice'),
        title: sanitizeText(data.title),
        topic: sanitizeText(data.topic),
        host_user_id: sanitizeText(data.host_user_id),
        status: sanitizeText(data.status || 'live'),
        created_at: mapTimestamp(data.created_at),
        ended_at: mapTimestamp(data.ended_at),
        participant_count: toInt(data.participant_count, 0)
    };
}

function mapNotificationDoc(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        type: sanitizeText(data.type),
        title: sanitizeText(data.title),
        body: sanitizeText(data.body),
        target_type: sanitizeText(data.target_type),
        target_id: sanitizeText(data.target_id),
        is_read: !!data.is_read,
        created_at: mapTimestamp(data.created_at)
    };
}

async function getBootstrap(userId) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) throw new Error('Missing user id.');

    const [selfProfile, rooms, vaultItems, liveRooms, notifications, leaderboard] = await Promise.all([
        getUserSummary(normalizedUserId),
        getRooms(normalizedUserId),
        getVaultItems(normalizedUserId),
        getLiveRooms(),
        getNotifications(normalizedUserId),
        getLeaderboard(20)
    ]);

    return {
        selfProfile,
        rooms,
        vaultItems,
        liveRooms,
        notifications,
        leaderboard
    };
}

async function getRooms(userId) {
    const normalizedUserId = normalizeUserId(userId);
    const snap = await chatRoomsCol
        .where('member_ids', 'array-contains', normalizedUserId)
        .orderBy('updated_at', 'desc')
        .limit(100)
        .get();

    return snap.docs.map(mapRoomDoc);
}

async function createRoom({ userId, roomType, description, name, memberUserIds = [], targetUserId = '' }) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedRoomType = sanitizeText(roomType || 'group').toLowerCase();
    const cleanDescription = sanitizeText(description);
    const requestedName = sanitizeText(name);
    const requestedMembers = safeArray(memberUserIds)
        .map((value) => normalizeUserId(value))
        .filter(Boolean);

    let room_key = makeRoomKey('room');
    let room_type = normalizedRoomType === 'dm' ? 'dm' : 'group';
    let room_name = requestedName || 'New Room';
    let is_private = false;
    let member_ids = Array.from(new Set([normalizedUserId, ...requestedMembers]));

    if (room_type === 'dm') {
        const normalizedTargetUserId = normalizeUserId(targetUserId);
        if (!normalizedTargetUserId || normalizedTargetUserId === normalizedUserId) {
            throw new Error('A valid target user is required for DM rooms.');
        }

        const ordered = [normalizedUserId, normalizedTargetUserId].sort();
        room_key = `dm_${ordered[0]}_${ordered[1]}`;
        is_private = true;
        member_ids = ordered;

        const existingDm = await chatRoomsCol.where('room_key', '==', room_key).limit(1).get();
        if (!existingDm.empty) {
            return {
                room: mapRoomDoc(existingDm.docs[0]),
                reused: true
            };
        }

        const targetUser = await getUserDoc(normalizedTargetUserId);
        room_name = requestedName || targetUser?.fullName || targetUser?.username || `DM ${normalizedTargetUserId}`;
    }

    const ref = chatRoomsCol.doc();
    const payload = {
        room_key,
        room_type,
        name: room_name,
        description: cleanDescription,
        is_private,
        created_by_user_id: normalizedUserId,
        member_ids,
        member_count: member_ids.length,
        created_at: nowTs(),
        updated_at: nowTs()
    };

    await ref.set(payload);

    const room = mapRoomDoc({
        id: ref.id,
        data: () => payload
    });

    return { room, reused: false };
}

async function deleteRoom({ userId, roomId }) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedRoomId = sanitizeText(roomId);

    const ref = chatRoomsCol.doc(normalizedRoomId);
    const snap = await ref.get();

    if (!snap.exists) {
        throw new Error('Room not found.');
    }

    const room = snap.data() || {};

    if (sanitizeText(room.room_type) === 'dm') {
        throw new Error('DM rooms cannot be deleted from this endpoint.');
    }

    if (sanitizeText(room.created_by_user_id) !== normalizedUserId) {
        throw new Error('Only the room owner can delete this room.');
    }

    await ref.delete();

    return { deletedRoomId: normalizedRoomId };
}

async function getVaultItems(userId) {
    const normalizedUserId = normalizeUserId(userId);

    const snap = await vaultItemsCol
        .where('user_id', '==', normalizedUserId)
        .where('is_deleted', '==', false)
        .orderBy('item_type', 'desc')
        .orderBy('name', 'asc')
        .limit(500)
        .get();

    return snap.docs.map(mapVaultItemDoc);
}

async function createVaultFolder({ userId, parentId = '', name }) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedParentId = sanitizeText(parentId);
    const cleanName = sanitizeText(name);

    if (!cleanName) {
        throw new Error('Folder name is required.');
    }

    if (normalizedParentId) {
        const parentSnap = await vaultItemsCol.doc(normalizedParentId).get();
        if (!parentSnap.exists) throw new Error('Invalid parent folder.');

        const parent = parentSnap.data() || {};
        if (sanitizeText(parent.user_id) !== normalizedUserId || sanitizeText(parent.item_type) !== 'folder' || parent.is_deleted) {
            throw new Error('Invalid parent folder.');
        }
    }

    const ref = vaultItemsCol.doc();
    const payload = {
        user_id: normalizedUserId,
        parent_id: normalizedParentId,
        item_type: 'folder',
        name: cleanName,
        file_path: '',
        mime_type: '',
        file_size: 0,
        is_deleted: false,
        created_at: nowTs(),
        updated_at: nowTs()
    };

    await ref.set(payload);

    return mapVaultItemDoc({
        id: ref.id,
        data: () => payload
    });
}

async function createVaultFile({ userId, parentId = '', name, filePath, mimeType, fileSize }) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedParentId = sanitizeText(parentId);
    const cleanName = sanitizeText(name);
    const cleanFilePath = sanitizeText(filePath);
    const cleanMimeType = sanitizeText(mimeType);
    const cleanFileSize = toInt(fileSize, 0);

    if (!cleanName) {
        throw new Error('File name is required.');
    }

    if (normalizedParentId) {
        const parentSnap = await vaultItemsCol.doc(normalizedParentId).get();
        if (!parentSnap.exists) throw new Error('Invalid parent folder.');

        const parent = parentSnap.data() || {};
        if (sanitizeText(parent.user_id) !== normalizedUserId || sanitizeText(parent.item_type) !== 'folder' || parent.is_deleted) {
            throw new Error('Invalid parent folder.');
        }
    }

    const ref = vaultItemsCol.doc();
    const payload = {
        user_id: normalizedUserId,
        parent_id: normalizedParentId,
        item_type: 'file',
        name: cleanName,
        file_path: cleanFilePath,
        mime_type: cleanMimeType,
        file_size: cleanFileSize,
        is_deleted: false,
        created_at: nowTs(),
        updated_at: nowTs()
    };

    await ref.set(payload);

    return mapVaultItemDoc({
        id: ref.id,
        data: () => payload
    });
}

async function getLiveRooms() {
    const snap = await liveRoomsCol
        .where('status', '==', 'live')
        .orderBy('created_at', 'desc')
        .limit(100)
        .get();

    return snap.docs.map(mapLiveRoomDoc);
}

async function createLiveRoom({ userId, roomType, title, topic }) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedType = sanitizeText(roomType || 'voice').toLowerCase() === 'video' ? 'video' : 'voice';
    const cleanTitle = sanitizeText(title);
    const cleanTopic = sanitizeText(topic);

    if (!cleanTitle) {
        throw new Error('Room title is required.');
    }

    const ref = liveRoomsCol.doc();
    const payload = {
        room_key: makeRoomKey(normalizedType),
        room_type: normalizedType,
        title: cleanTitle,
        topic: cleanTopic,
        host_user_id: normalizedUserId,
        host_user_name: '',
        status: 'live',
        participant_ids: [normalizedUserId],
        participant_count: 1,
        created_at: nowTs(),
        ended_at: null
    };

    await ref.set(payload);

    return mapLiveRoomDoc({
        id: ref.id,
        data: () => payload
    });
}

async function getNotifications(userId) {
    const normalizedUserId = normalizeUserId(userId);

    const snap = await notificationsCol
        .where('user_id', '==', normalizedUserId)
        .orderBy('created_at', 'desc')
        .limit(100)
        .get();

    return snap.docs.map(mapNotificationDoc);
}

async function readAllNotifications(userId) {
    const normalizedUserId = normalizeUserId(userId);
    const snap = await notificationsCol
        .where('user_id', '==', normalizedUserId)
        .where('is_read', '==', false)
        .get();

    if (snap.empty) return true;

    const batch = firestore.batch();
    snap.docs.forEach((doc) => {
        batch.update(doc.ref, { is_read: true });
    });
    await batch.commit();

    return true;
}

async function readNotification({ userId, notificationId }) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedNotificationId = sanitizeText(notificationId);

    const ref = notificationsCol.doc(normalizedNotificationId);
    const snap = await ref.get();

    if (!snap.exists) {
        throw new Error('Notification not found.');
    }

    const notification = snap.data() || {};
    if (sanitizeText(notification.user_id) !== normalizedUserId) {
        throw new Error('Notification not found.');
    }

    await ref.update({ is_read: true });

    return normalizedNotificationId;
}

async function getLeaderboard(limit = 50) {
    const snap = await usersCol.limit(Math.max(1, Math.min(limit, 100))).get();

    const leaderboard = snap.docs
        .map((doc) => buildUserSummary({ id: doc.id, ...(doc.data() || {}) }))
        .sort((a, b) => {
            if (b.rep_points !== a.rep_points) return b.rep_points - a.rep_points;
            if (b.followers_count !== a.followers_count) return b.followers_count - a.followers_count;
            if (b.messages_count !== a.messages_count) return b.messages_count - a.messages_count;
            return String(a.id).localeCompare(String(b.id));
        });

    return leaderboard.slice(0, limit);
}

async function getProfileByName({ currentUserId, rawName }) {
    const target = sanitizeText(rawName);
    if (!target) throw new Error('Profile name is required.');

    const queries = [
        usersCol.where('username', '==', target).limit(1).get(),
        usersCol.where('fullName', '==', target).limit(1).get(),
        usersCol.where('displayName', '==', target).limit(1).get()
    ];

    const results = await Promise.all(queries);
    const foundDoc =
        results.find((snap) => !snap.empty)?.docs?.[0] || null;

    if (!foundDoc) {
        throw new Error('Profile not found.');
    }

    const profile = buildUserSummary({ id: foundDoc.id, ...(foundDoc.data() || {}) });

    const followSnap = await followsCol
        .where('follower_user_id', '==', normalizeUserId(currentUserId))
        .where('following_user_id', '==', profile.id)
        .limit(1)
        .get();

    return {
        ...profile,
        is_following: !followSnap.empty
    };
}

async function toggleFollow({ followerUserId, followingUserId, actorName }) {
    const followerId = normalizeUserId(followerUserId);
    const followingId = normalizeUserId(followingUserId);

    if (!followingId) {
        throw new Error('Target user is required.');
    }

    if (followerId === followingId) {
        throw new Error('You cannot follow yourself.');
    }

    const targetUser = await getUserDoc(followingId);
    if (!targetUser) {
        throw new Error('Target user not found.');
    }

    const followKey = `${followerId}_${followingId}`;
    const followRef = followsCol.doc(followKey);
    const followSnap = await followRef.get();

    const followerRef = usersCol.doc(followerId);
    const followingRef = usersCol.doc(followingId);

    let isFollowing = false;

    await firestore.runTransaction(async (tx) => {
        const followerSnap = await tx.get(followerRef);
        const followingSnap = await tx.get(followingRef);
        const existingFollowSnap = await tx.get(followRef);

        if (!followerSnap.exists) {
            throw new Error('Follower user not found.');
        }

        if (!followingSnap.exists) {
            throw new Error('Target user not found.');
        }

        const followerData = followerSnap.data() || {};
        const followingData = followingSnap.data() || {};

        const followerStats = followerData.stats || {};
        const followingStats = followingData.stats || {};

        const followerNext = {
            ...followerStats,
            followersCount: toInt(followerStats.followersCount, 0),
            followingCount: toInt(followerStats.followingCount, 0),
            messagesCount: toInt(followerStats.messagesCount, 0),
            repPoints: toInt(followerStats.repPoints, 0)
        };

        const followingNext = {
            ...followingStats,
            followersCount: toInt(followingStats.followersCount, 0),
            followingCount: toInt(followingStats.followingCount, 0),
            messagesCount: toInt(followingStats.messagesCount, 0),
            repPoints: toInt(followingStats.repPoints, 0)
        };

        if (existingFollowSnap.exists) {
            tx.delete(followRef);
            followerNext.followingCount = Math.max(0, followerNext.followingCount - 1);
            followingNext.followersCount = Math.max(0, followingNext.followersCount - 1);
            isFollowing = false;
        } else {
            tx.set(followRef, {
                follower_user_id: followerId,
                following_user_id: followingId,
                created_at: nowTs()
            });

            followerNext.followingCount += 1;
            followingNext.followersCount += 1;
            isFollowing = true;
        }

        tx.update(followerRef, {
            stats: followerNext,
            updatedAt: nowTs()
        });

        tx.update(followingRef, {
            stats: followingNext,
            updatedAt: nowTs()
        });
    });

    if (isFollowing) {
        const notificationRef = notificationsCol.doc();
        await notificationRef.set({
            user_id: followingId,
            type: 'follow',
            title: 'New follower',
            body: `${sanitizeText(actorName || 'Someone')} started following you.`,
            target_type: 'profile',
            target_id: followerId,
            is_read: false,
            created_at: nowTs()
        });
    }

    const [followerUser, followingUser] = await Promise.all([
        getUserDoc(followerId),
        getUserDoc(followingId)
    ]);

    return {
        isFollowing,
        followerStats: buildUserSummary({ id: followerId, ...(followerUser || {}) }),
        targetStats: buildUserSummary({ id: followingId, ...(followingUser || {}) })
    };
}

module.exports = {
    getBootstrap,
    getRooms,
    createRoom,
    deleteRoom,
    getVaultItems,
    createVaultFolder,
    createVaultFile,
    getLiveRooms,
    createLiveRoom,
    getNotifications,
    readAllNotifications,
    readNotification,
    getLeaderboard,
    getProfileByName,
    toggleFollow
};