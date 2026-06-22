const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_realtime_records';

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
const nowIso = () => new Date().toISOString();

function makeRecordId(prefix = 'rt') {
    return prefix + '_' + Date.now() + '_' + crypto.randomBytes(5).toString('hex');
}

function makeRoomKey(prefix = 'room') {
    return prefix + '_' + crypto.randomBytes(6).toString('hex');
}

function collectionPathFor(recordType, roomId = '') {
    if (recordType === 'user_profile') return 'users';
    if (recordType === 'chat_room') return 'chatRooms';
    if (recordType === 'chat_message') return roomId ? 'chatRooms/' + roomId + '/messages' : 'chatMessages';
    if (recordType === 'vault_item') return 'vaultItems';
    if (recordType === 'live_room') return 'liveRooms';
    if (recordType === 'live_room_participant') return 'liveRooms/' + roomId + '/participants';
    if (recordType === 'notification') return 'notifications';
    if (recordType === 'user_follow') return 'userFollows';
    return 'realtime';
}

function sourcePathFor(recordType, docId, roomId = '') {
    if (recordType === 'user_profile') return 'users/' + docId;
    if (recordType === 'chat_room') return 'chatRooms/' + docId;
    if (recordType === 'chat_message') return roomId ? 'chatRooms/' + roomId + '/messages/' + docId : 'chatMessages/' + docId;
    if (recordType === 'vault_item') return 'vaultItems/' + docId;
    if (recordType === 'live_room') return 'liveRooms/' + docId;
    if (recordType === 'live_room_participant') return 'liveRooms/' + roomId + '/participants/' + docId;
    if (recordType === 'notification') return 'notifications/' + docId;
    if (recordType === 'user_follow') return 'userFollows/' + docId;
    return 'realtime/' + docId;
}

function leafFor(recordType) {
    if (recordType === 'chat_message') return 'messages';
    if (recordType === 'live_room_participant') return 'participants';
    return collectionPathFor(recordType).split('/')[0];
}

function mapTimestamp(value) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();

    if (typeof value === 'object') {
        if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
        if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
    }

    return sanitizeText(value) || null;
}

function rowData(row = {}) {
    return row && row.data && typeof row.data === 'object' ? row.data : {};
}

async function getRecordByTypeAndId(recordType, docId) {
    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', recordType)
        .eq('source_document_id', sanitizeText(docId))
        .maybeSingle();

    if (error) throw new Error('Realtime Supabase get failed: ' + error.message);
    return data || null;
}

async function listRecords(recordType, limit = 500) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 500), 1000));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', recordType)
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Realtime Supabase list failed: ' + error.message);
    return Array.isArray(data) ? data : [];
}

async function upsertRecord({
    recordType,
    docId,
    data = {},
    ownerUserId = '',
    roomId = '',
    targetUserId = '',
    firebaseApp = 'supabase'
}) {
    const cleanDocId = sanitizeText(docId || makeRecordId(recordType));
    const cleanRoomId = sanitizeText(roomId);
    const collectionPath = collectionPathFor(recordType, cleanRoomId);
    const documentPath = sourcePathFor(recordType, cleanDocId, cleanRoomId);
    const existing = await getRecordByTypeAndId(recordType, cleanDocId).catch(() => null);
    const existingData = rowData(existing);
    const now = nowIso();

    const nextData = {
        ...existingData,
        ...(data && typeof data === 'object' ? data : {}),
        updated_at: data.updated_at || data.updatedAt || now
    };

    if (!nextData.created_at && !nextData.createdAt) {
        nextData.created_at = existingData.created_at || existingData.createdAt || existing?.created_at_source || now;
    }

    const row = {
        firebase_app: firebaseApp,
        source_collection_path: collectionPath,
        source_collection_root: collectionPath.split('/')[0],
        source_collection_leaf: leafFor(recordType),
        source_document_id: cleanDocId,
        source_document_path: documentPath,
        record_type: recordType,
        owner_user_id: sanitizeText(ownerUserId) || existing?.owner_user_id || '',
        room_id: cleanRoomId || existing?.room_id || '',
        target_user_id: sanitizeText(targetUserId) || existing?.target_user_id || '',
        data: nextData,
        created_at_source: mapTimestamp(nextData.created_at || nextData.createdAt) || existing?.created_at_source || now,
        updated_at_source: mapTimestamp(nextData.updated_at || nextData.updatedAt) || now,
        updated_at: now
    };

    const { data: saved, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .upsert(row, { onConflict: 'source_document_path' })
        .select('*')
        .single();

    if (error) throw new Error('Realtime Supabase upsert failed: ' + error.message);
    return saved;
}

async function deleteRecord(recordType, docId) {
    const { error } = await yhuSupabaseAdmin
        .from(TABLE)
        .delete()
        .eq('record_type', recordType)
        .eq('source_document_id', sanitizeText(docId));

    if (error) throw new Error('Realtime Supabase delete failed: ' + error.message);
    return true;
}

async function getUserDoc(userId) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return null;

    const row = await getRecordByTypeAndId('user_profile', normalizedUserId);
    if (!row) return null;

    return {
        id: row.source_document_id,
        ...rowData(row)
    };
}

function buildUserSummary(userDoc = {}) {
    const stats = userDoc.stats && typeof userDoc.stats === 'object' ? userDoc.stats : {};

    return {
        id: sanitizeText(userDoc.id || userDoc.uid || userDoc.userId),
        fullName: sanitizeText(userDoc.fullName || userDoc.name),
        username: sanitizeText(userDoc.username),
        display_name: sanitizeText(userDoc.displayName || userDoc.display_name || userDoc.fullName || userDoc.name),
        avatar: sanitizeText(userDoc.avatar || userDoc.profilePhoto || userDoc.photoURL),
        bio: sanitizeText(userDoc.bio),
        role_label: sanitizeText(userDoc.roleLabel || userDoc.role_label || userDoc.role || 'Member'),
        rep_points: toInt(stats.repPoints || stats.rep_points || userDoc.rep_points, 0),
        followers_count: toInt(stats.followersCount || stats.followers_count || userDoc.followers_count, 0),
        following_count: toInt(stats.followingCount || stats.following_count || userDoc.following_count, 0),
        messages_count: toInt(stats.messagesCount || stats.messages_count || userDoc.messages_count, 0)
    };
}

async function getUserSummary(userId) {
    const userDoc = await getUserDoc(userId);
    if (!userDoc) return null;
    return buildUserSummary(userDoc);
}

function normalizeMemberIds(data = {}) {
    return safeArray(data.member_ids || data.memberIds)
        .map((value) => sanitizeText(value))
        .filter(Boolean);
}

function normalizeStringArray(value) {
    return safeArray(value)
        .map((item) => sanitizeText(item))
        .filter(Boolean);
}

function mapRoomRow(row = {}, viewerId = '') {
    const data = rowData(row);
    const memberIds = normalizeMemberIds(data);
    const hiddenForUserIds = normalizeStringArray(data.hidden_for_user_ids || data.hiddenForUserIds);
    const mutedForUserIds = normalizeStringArray(data.muted_for_user_ids || data.mutedForUserIds);
    const blockedByUserIds = normalizeStringArray(data.blocked_by_user_ids || data.blockedByUserIds);

    const unreadCounts =
        data.unread_counts && typeof data.unread_counts === 'object'
            ? data.unread_counts
            : data.unreadCounts && typeof data.unreadCounts === 'object'
                ? data.unreadCounts
                : {};

    const normalizedViewerId = sanitizeText(viewerId);

    return {
        id: row.source_document_id,
        room_key: sanitizeText(data.room_key || data.roomKey),
        room_type: sanitizeText(data.room_type || data.roomType || 'group'),
        name: sanitizeText(data.name),
        description: sanitizeText(data.description),
        is_private: data.is_private || data.isPrivate ? 1 : 0,
        created_by_user_id: sanitizeText(data.created_by_user_id || data.createdByUserId || row.owner_user_id),
        created_at: mapTimestamp(data.created_at || data.createdAt || row.created_at_source),
        updated_at: mapTimestamp(data.updated_at || data.updatedAt || row.updated_at_source),
        member_count: toInt(data.member_count || data.memberCount, memberIds.length),
        member_ids: memberIds,
        last_message_text: sanitizeText(data.last_message_text || data.lastMessageText),
        last_message_author: sanitizeText(data.last_message_author || data.lastMessageAuthor),
        last_message_at: mapTimestamp(data.last_message_at || data.lastMessageAt || data.updated_at || data.updatedAt || row.updated_at_source),
        unread_count: normalizedViewerId ? toInt(unreadCounts[normalizedViewerId], 0) : 0,
        is_hidden: normalizedViewerId ? hiddenForUserIds.includes(normalizedViewerId) : false,
        is_muted: normalizedViewerId ? mutedForUserIds.includes(normalizedViewerId) : false,
        is_blocked: normalizedViewerId ? blockedByUserIds.includes(normalizedViewerId) : false
    };
}

async function enrichRoomForViewer(room = {}, viewerId = '') {
    const normalizedViewerId = normalizeUserId(viewerId);
    const memberIds = safeArray(room.member_ids)
        .map((value) => normalizeUserId(value))
        .filter(Boolean);

    const otherMemberIds = memberIds.filter((memberId) => memberId && memberId !== normalizedViewerId);

    const participantDocs = await Promise.all(
        otherMemberIds.slice(0, 8).map((memberId) => getUserDoc(memberId).catch(() => null))
    );

    const participantSummaries = participantDocs
        .map((doc) => (doc ? buildUserSummary(doc) : null))
        .filter(Boolean);

    const participantNames = participantSummaries
        .map((user) => sanitizeText(user.display_name || user.fullName || user.username))
        .filter(Boolean);

    const roomType = sanitizeText(room.room_type || room.type || 'group').toLowerCase();

    if (roomType === 'dm') {
        const recipient = participantSummaries[0] || null;
        const recipientId = sanitizeText(recipient?.id || otherMemberIds[0]);
        const recipientName =
            sanitizeText(recipient?.display_name || recipient?.fullName || recipient?.username) ||
            sanitizeText(room.name) ||
            'Direct Message';
        const recipientAvatar = sanitizeText(recipient?.avatar);

        return {
            ...room,
            name: recipientName,
            avatar: recipientAvatar,
            avatarUrl: recipientAvatar,
            recipient_id: recipientId,
            recipient_name: recipientName,
            member_names: recipientName ? [recipientName] : [],
            participantNames: recipientName ? [recipientName] : []
        };
    }

    return {
        ...room,
        member_names: participantNames,
        participantNames
    };
}

function mapVaultRow(row = {}) {
    const data = rowData(row);

    return {
        id: row.source_document_id,
        user_id: sanitizeText(data.user_id || data.userId || row.owner_user_id),
        parent_id: sanitizeText(data.parent_id || data.parentId),
        item_type: sanitizeText(data.item_type || data.itemType || 'folder'),
        name: sanitizeText(data.name),
        file_path: sanitizeText(data.file_path || data.filePath),
        mime_type: sanitizeText(data.mime_type || data.mimeType),
        file_size: toInt(data.file_size || data.fileSize, 0),
        created_at: mapTimestamp(data.created_at || data.createdAt || row.created_at_source),
        updated_at: mapTimestamp(data.updated_at || data.updatedAt || row.updated_at_source)
    };
}

function mapLiveRoomRow(row = {}) {
    const data = rowData(row);
    const participantIds = safeArray(data.participant_ids || data.participantIds)
        .map((value) => sanitizeText(value))
        .filter(Boolean);

    return {
        id: row.source_document_id,
        room_key: sanitizeText(data.room_key || data.roomKey),
        room_type: sanitizeText(data.room_type || data.roomType || 'voice'),
        title: sanitizeText(data.title),
        topic: sanitizeText(data.topic),
        host_user_id: sanitizeText(data.host_user_id || data.hostUserId || row.owner_user_id),
        host_user_name: sanitizeText(data.host_user_name || data.hostUserName),
        status: sanitizeText(data.status || 'live'),
        created_at: mapTimestamp(data.created_at || data.createdAt || row.created_at_source),
        ended_at: mapTimestamp(data.ended_at || data.endedAt),
        participant_ids: participantIds,
        participant_count: toInt(data.participant_count || data.participantCount, participantIds.length)
    };
}

function mapNotificationRow(row = {}) {
    const data = rowData(row);
    const readAt = mapTimestamp(data.read_at || data.readAt);
    const isRead =
        data.is_read === true ||
        data.isRead === true ||
        data.read === true ||
        Boolean(readAt);

    const body = sanitizeText(data.body || data.text || data.message);

    return {
        id: row.source_document_id,
        notificationId: row.source_document_id,
        type: sanitizeText(data.type),
        title: sanitizeText(data.title || 'Notification'),
        body,
        text: body,
        message: body,
        target: sanitizeText(data.target || data.target_type || data.targetType),
        target_type: sanitizeText(data.target_type || data.targetType || data.target),
        targetType: sanitizeText(data.targetType || data.target_type || data.target),
        target_id: sanitizeText(data.target_id || data.targetId || row.target_user_id),
        targetId: sanitizeText(data.targetId || data.target_id || row.target_user_id),
        is_read: isRead,
        isRead,
        read: isRead,
        read_at: readAt,
        readAt,
        created_at: mapTimestamp(data.created_at || data.createdAt || row.created_at_source),
        createdAt: mapTimestamp(data.createdAt || data.created_at || row.created_at_source)
    };
}


async function safeBootstrapSection(label, promiseFactory, fallback) {
    try {
        return await promiseFactory();
    } catch (error) {
        console.error('realtime bootstrap section failed:', label, error?.message || error);
        return fallback;
    }
}


async function getBootstrap(userId) {
    const normalizedUserId = normalizeUserId(userId);

    if (!normalizedUserId) {
        throw new Error('Missing user id.');
    }

    const [
        selfProfile,
        rooms,
        vaultItems,
        liveRooms,
        notifications,
        leaderboard
    ] = await Promise.all([
        safeBootstrapSection('selfProfile', () => getUserSummary(normalizedUserId), null),
        safeBootstrapSection('rooms', () => getRooms(normalizedUserId), []),
        safeBootstrapSection('vaultItems', () => getVaultItems(normalizedUserId), []),
        safeBootstrapSection('liveRooms', () => getLiveRooms(), []),
        safeBootstrapSection('notifications', () => getNotifications(normalizedUserId), []),
        safeBootstrapSection('leaderboard', () => getLeaderboard(20), [])
    ]);

    return {
        selfProfile,
        rooms: Array.isArray(rooms) ? rooms : [],
        vaultItems: Array.isArray(vaultItems) ? vaultItems : [],
        liveRooms: Array.isArray(liveRooms) ? liveRooms : [],
        notifications: Array.isArray(notifications) ? notifications : [],
        leaderboard: Array.isArray(leaderboard) ? leaderboard : []
    };
}

async function getRooms(userId) {
    const normalizedUserId = normalizeUserId(userId);
    const rows = await listRecords('chat_room', 500);

    const rooms = rows
        .map((row) => mapRoomRow(row, normalizedUserId))
        .filter((room) => {
            return safeArray(room.member_ids).includes(normalizedUserId) && !room.is_hidden;
        })
        .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
        .slice(0, 100);

    return Promise.all(rooms.map((room) => enrichRoomForViewer(room, normalizedUserId)));
}

async function createRoom({ userId, roomType = 'group', description = '', name = '', memberUserIds = [], targetUserId = '' } = {}) {
    const creatorId = normalizeUserId(userId);
    if (!creatorId) throw new Error('Missing user id.');

    const cleanRoomType = sanitizeText(roomType || 'group').toLowerCase();
    const members = new Set([creatorId]);

    safeArray(memberUserIds).forEach((memberId) => {
        const cleanMemberId = normalizeUserId(memberId);
        if (cleanMemberId) members.add(cleanMemberId);
    });

    const target = normalizeUserId(targetUserId);

    if (cleanRoomType === 'dm') {
        if (!target || target === creatorId) throw new Error('A valid target user is required.');
        members.add(target);

        const existingRooms = await getRooms(creatorId);
        const existingDm = existingRooms.find((room) => {
            const ids = safeArray(room.member_ids).sort();
            return sanitizeText(room.room_type).toLowerCase() === 'dm' &&
                ids.length === 2 &&
                ids.includes(creatorId) &&
                ids.includes(target);
        });

        if (existingDm) return { room: existingDm, reused: true };
    }

    const docId = makeRecordId('room');
    const now = nowIso();
    const memberIds = Array.from(members);

    const row = await upsertRecord({
        recordType: 'chat_room',
        docId,
        ownerUserId: creatorId,
        roomId: docId,
        data: {
            room_key: makeRoomKey(cleanRoomType),
            room_type: cleanRoomType,
            name: sanitizeText(name) || (cleanRoomType === 'dm' ? 'Direct Message' : 'New Room'),
            description: sanitizeText(description),
            is_private: cleanRoomType === 'dm',
            created_by_user_id: creatorId,
            created_at: now,
            updated_at: now,
            member_count: memberIds.length,
            member_ids: memberIds,
            hidden_for_user_ids: [],
            muted_for_user_ids: [],
            blocked_by_user_ids: [],
            unread_counts: {},
            last_message_text: '',
            last_message_author: '',
            last_message_at: now
        }
    });

    return {
        room: await enrichRoomForViewer(mapRoomRow(row, creatorId), creatorId),
        reused: false
    };
}

async function updateRoomArray({ userId, roomId, field, enabled }) {
    const normalizedUserId = normalizeUserId(userId);
    const row = await getRecordByTypeAndId('chat_room', roomId);
    if (!row) throw new Error('Room not found.');

    const data = rowData(row);
    const current = new Set(normalizeStringArray(data[field]));
    if (enabled) current.add(normalizedUserId);
    else current.delete(normalizedUserId);

    const saved = await upsertRecord({
        recordType: 'chat_room',
        docId: roomId,
        ownerUserId: row.owner_user_id,
        roomId,
        data: {
            ...data,
            [field]: Array.from(current)
        }
    });

    return mapRoomRow(saved, normalizedUserId);
}

async function deleteRoom({ userId, roomId } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const row = await getRecordByTypeAndId('chat_room', roomId);
    if (!row) throw new Error('Room not found.');

    const data = rowData(row);
    const creatorId = sanitizeText(data.created_by_user_id || data.createdByUserId || row.owner_user_id);

    if (creatorId && creatorId === normalizedUserId) {
        await deleteRecord('chat_room', roomId);
        return { deletedRoomId: roomId };
    }

    await updateRoomArray({
        userId: normalizedUserId,
        roomId,
        field: 'hidden_for_user_ids',
        enabled: true
    });

    return { deletedRoomId: roomId, hidden: true };
}

async function hideRoomForUser({ userId, roomId, hidden = true } = {}) {
    return updateRoomArray({
        userId,
        roomId,
        field: 'hidden_for_user_ids',
        enabled: hidden !== false
    });
}

async function setRoomMuted({ userId, roomId, muted = true } = {}) {
    return updateRoomArray({
        userId,
        roomId,
        field: 'muted_for_user_ids',
        enabled: muted !== false
    });
}

async function setRoomBlocked({ userId, roomId, blocked = true } = {}) {
    return updateRoomArray({
        userId,
        roomId,
        field: 'blocked_by_user_ids',
        enabled: blocked !== false
    });
}

async function getVaultItems(userId) {
    const normalizedUserId = normalizeUserId(userId);
    const rows = await listRecords('vault_item', 500);

    return rows
        .filter((row) => sanitizeText(row.owner_user_id || rowData(row).user_id || rowData(row).userId) === normalizedUserId)
        .map(mapVaultRow)
        .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

async function createVaultFolder({ userId, parentId = '', name = '' } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const cleanName = sanitizeText(name);
    if (!normalizedUserId || !cleanName) throw new Error('Folder name is required.');

    const docId = makeRecordId('vault');
    const now = nowIso();

    const row = await upsertRecord({
        recordType: 'vault_item',
        docId,
        ownerUserId: normalizedUserId,
        data: {
            user_id: normalizedUserId,
            parent_id: sanitizeText(parentId),
            item_type: 'folder',
            name: cleanName,
            file_path: '',
            mime_type: '',
            file_size: 0,
            created_at: now,
            updated_at: now
        }
    });

    return mapVaultRow(row);
}

async function createVaultFile({ userId, parentId = '', name = '', filePath = '', mimeType = '', fileSize = 0 } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const cleanName = sanitizeText(name);
    const cleanFilePath = sanitizeText(filePath);

    if (!normalizedUserId || !cleanName || !cleanFilePath) throw new Error('File name and path are required.');

    const docId = makeRecordId('vault');
    const now = nowIso();

    const row = await upsertRecord({
        recordType: 'vault_item',
        docId,
        ownerUserId: normalizedUserId,
        data: {
            user_id: normalizedUserId,
            parent_id: sanitizeText(parentId),
            item_type: 'file',
            name: cleanName,
            file_path: cleanFilePath,
            mime_type: sanitizeText(mimeType),
            file_size: toInt(fileSize, 0),
            created_at: now,
            updated_at: now
        }
    });

    return mapVaultRow(row);
}

async function getLiveRooms() {
    const rows = await listRecords('live_room', 300);

    return rows
        .map(mapLiveRoomRow)
        .filter((room) => sanitizeText(room.status || 'live').toLowerCase() !== 'archived')
        .sort((a, b) => {
            const liveA = sanitizeText(a.status).toLowerCase() === 'live' ? 1 : 0;
            const liveB = sanitizeText(b.status).toLowerCase() === 'live' ? 1 : 0;
            if (liveA !== liveB) return liveB - liveA;
            return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''));
        });
}

async function createLiveRoom({ userId, roomType = 'voice', title = '', topic = '' } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) throw new Error('Missing user id.');

    const docId = makeRecordId('live');
    const now = nowIso();
    const user = await getUserSummary(normalizedUserId).catch(() => null);

    const row = await upsertRecord({
        recordType: 'live_room',
        docId,
        ownerUserId: normalizedUserId,
        roomId: docId,
        data: {
            room_key: makeRoomKey('live'),
            room_type: sanitizeText(roomType || 'voice'),
            title: sanitizeText(title) || 'Live Room',
            topic: sanitizeText(topic),
            host_user_id: normalizedUserId,
            host_user_name: sanitizeText(user?.display_name || user?.fullName || user?.username || 'Hustler'),
            status: 'live',
            created_at: now,
            updated_at: now,
            participant_ids: [normalizedUserId],
            participant_count: 1
        }
    });

    return mapLiveRoomRow(row);
}

async function joinLiveRoom({ userId, roomId } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const row = await getRecordByTypeAndId('live_room', roomId);
    if (!row) throw new Error('Live room not found.');

    const data = rowData(row);
    const participantSet = new Set(normalizeStringArray(data.participant_ids || data.participantIds));
    participantSet.add(normalizedUserId);

    const saved = await upsertRecord({
        recordType: 'live_room',
        docId: row.source_document_id,
        ownerUserId: row.owner_user_id,
        roomId: row.room_id || row.source_document_id,
        data: {
            ...data,
            status: sanitizeText(data.status || 'live'),
            participant_ids: Array.from(participantSet),
            participant_count: participantSet.size
        }
    });

    return mapLiveRoomRow(saved);
}

async function leaveLiveRoom({ userId, roomId } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const row = await getRecordByTypeAndId('live_room', roomId);
    if (!row) throw new Error('Live room not found.');

    const data = rowData(row);
    const participantSet = new Set(normalizeStringArray(data.participant_ids || data.participantIds));
    participantSet.delete(normalizedUserId);

    const saved = await upsertRecord({
        recordType: 'live_room',
        docId: row.source_document_id,
        ownerUserId: row.owner_user_id,
        roomId: row.room_id || row.source_document_id,
        data: {
            ...data,
            participant_ids: Array.from(participantSet),
            participant_count: participantSet.size
        }
    });

    return mapLiveRoomRow(saved);
}

async function endLiveRoom({ userId, roomId } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const row = await getRecordByTypeAndId('live_room', roomId);
    if (!row) throw new Error('Live room not found.');

    const data = rowData(row);
    const hostId = sanitizeText(data.host_user_id || data.hostUserId || row.owner_user_id);

    if (hostId && hostId !== normalizedUserId) {
        throw new Error('Only the host can end this live room.');
    }

    const saved = await upsertRecord({
        recordType: 'live_room',
        docId: row.source_document_id,
        ownerUserId: row.owner_user_id,
        roomId: row.room_id || row.source_document_id,
        data: {
            ...data,
            status: 'ended',
            ended_at: nowIso(),
            participant_ids: [],
            participant_count: 0
        }
    });

    return mapLiveRoomRow(saved);
}

async function getNotifications(userId) {
    const normalizedUserId = normalizeUserId(userId);
    const rows = await listRecords('notification', 500);

    return rows
        .filter((row) => sanitizeText(row.owner_user_id || rowData(row).user_id || rowData(row).userId) === normalizedUserId)
        .map(mapNotificationRow)
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, 100);
}

async function readAllNotifications(userId) {
    const normalizedUserId = normalizeUserId(userId);
    const rows = await listRecords('notification', 500);
    const unread = rows.filter((row) => {
        const data = rowData(row);
        const owner = sanitizeText(row.owner_user_id || data.user_id || data.userId);
        const isRead = data.is_read === true || data.isRead === true || data.read === true || data.read_at || data.readAt;
        return owner === normalizedUserId && !isRead;
    });

    await Promise.all(unread.map((row) => {
        const data = rowData(row);
        return upsertRecord({
            recordType: 'notification',
            docId: row.source_document_id,
            ownerUserId: normalizedUserId,
            targetUserId: row.target_user_id,
            data: {
                ...data,
                is_read: true,
                read_at: nowIso()
            }
        });
    }));

    return true;
}

async function readNotification({ userId, notificationId } = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const row = await getRecordByTypeAndId('notification', notificationId);
    if (!row) throw new Error('Notification not found.');

    const data = rowData(row);
    const owner = sanitizeText(row.owner_user_id || data.user_id || data.userId);

    if (owner !== normalizedUserId) throw new Error('Notification not found.');

    await upsertRecord({
        recordType: 'notification',
        docId: row.source_document_id,
        ownerUserId: normalizedUserId,
        targetUserId: row.target_user_id,
        data: {
            ...data,
            is_read: true,
            read_at: nowIso()
        }
    });

    return row.source_document_id;
}

async function getLeaderboard(limit = 50) {
    const rows = await listRecords('user_profile', 500);

    const leaderboard = rows
        .map((row) => buildUserSummary({
            id: row.source_document_id,
            ...rowData(row)
        }))
        .sort((a, b) => {
            if (b.rep_points !== a.rep_points) return b.rep_points - a.rep_points;
            if (b.followers_count !== a.followers_count) return b.followers_count - a.followers_count;
            if (b.messages_count !== a.messages_count) return b.messages_count - a.messages_count;
            return String(a.id).localeCompare(String(b.id));
        });

    return leaderboard.slice(0, Math.max(1, Math.min(Number(limit || 50), 100)));
}

async function getProfileByName({ currentUserId, rawName } = {}) {
    const target = sanitizeText(rawName);
    if (!target) throw new Error('Profile name is required.');

    const rows = await listRecords('user_profile', 500);
    const targetLower = target.toLowerCase();

    const found = rows.find((row) => {
        const data = rowData(row);
        return (
            sanitizeText(row.source_document_id).toLowerCase() === targetLower ||
            sanitizeText(data.username).toLowerCase() === targetLower ||
            sanitizeText(data.fullName || data.name).toLowerCase() === targetLower ||
            sanitizeText(data.displayName || data.display_name).toLowerCase() === targetLower
        );
    });

    if (!found) throw new Error('Profile not found.');

    const profile = buildUserSummary({
        id: found.source_document_id,
        ...rowData(found)
    });

    const followRows = await listRecords('user_follow', 1000).catch(() => []);
    const isFollowing = followRows.some((row) => {
        const data = rowData(row);
        return (
            sanitizeText(data.follower_user_id || data.followerUserId || row.owner_user_id) === sanitizeText(currentUserId) &&
            sanitizeText(data.following_user_id || data.followingUserId || row.target_user_id) === profile.id
        );
    });

    return {
        ...profile,
        isFollowing
    };
}

async function toggleFollow({ followerId, followingId, actorName = '' } = {}) {
    const cleanFollowerId = normalizeUserId(followerId);
    const cleanFollowingId = normalizeUserId(followingId);

    if (!cleanFollowerId || !cleanFollowingId || cleanFollowerId === cleanFollowingId) {
        throw new Error('A valid target user is required.');
    }

    const followId = (cleanFollowerId + '_' + cleanFollowingId).toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    const existing = await getRecordByTypeAndId('user_follow', followId).catch(() => null);

    let isFollowing = false;

    if (existing) {
        await deleteRecord('user_follow', followId);
        isFollowing = false;
    } else {
        await upsertRecord({
            recordType: 'user_follow',
            docId: followId,
            ownerUserId: cleanFollowerId,
            targetUserId: cleanFollowingId,
            data: {
                follower_user_id: cleanFollowerId,
                following_user_id: cleanFollowingId,
                created_at: nowIso()
            }
        });

        await upsertRecord({
            recordType: 'notification',
            docId: makeRecordId('notif'),
            ownerUserId: cleanFollowingId,
            targetUserId: cleanFollowerId,
            data: {
                user_id: cleanFollowingId,
                type: 'follow',
                title: 'New follower',
                body: sanitizeText(actorName || 'Someone') + ' started following you.',
                target_type: 'profile',
                target_id: cleanFollowerId,
                is_read: false,
                created_at: nowIso()
            }
        });

        isFollowing = true;
    }

    const [followerUser, followingUser] = await Promise.all([
        getUserDoc(cleanFollowerId),
        getUserDoc(cleanFollowingId)
    ]);

    return {
        isFollowing,
        followerStats: buildUserSummary({ id: cleanFollowerId, ...(followerUser || {}) }),
        targetStats: buildUserSummary({ id: cleanFollowingId, ...(followingUser || {}) })
    };
}

module.exports = {
    getBootstrap,
    getRooms,
    createRoom,
    deleteRoom,
    hideRoomForUser,
    setRoomMuted,
    setRoomBlocked,
    getVaultItems,
    createVaultFolder,
    createVaultFile,
    getLiveRooms,
    createLiveRoom,
    joinLiveRoom,
    leaveLiveRoom,
    endLiveRoom,
    getNotifications,
    readAllNotifications,
    readNotification,
    getLeaderboard,
    getProfileByName,
    toggleFollow
};
