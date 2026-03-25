const crypto = require('crypto');

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const toInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const uniqueInts = (values = []) => {
    return [...new Set(
        (Array.isArray(values) ? values : [])
            .map((v) => toInt(v, NaN))
            .filter((v) => Number.isInteger(v) && v > 0)
    )];
};

const makeRoomKey = (prefix = 'room') => {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
};

async function ensureUserFoundation(db, user) {
    const userId = toInt(user?.id, 0);
    if (!userId) return;

    const baseUser = await db.get(
        'SELECT id, fullName, username FROM users WHERE id = ?',
        [userId]
    );

    if (!baseUser) return;

    await db.run(
        `INSERT OR IGNORE INTO user_profiles (user_id, display_name, username, avatar, bio, role_label)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            userId,
            baseUser.fullName || baseUser.username || `User ${userId}`,
            baseUser.username || '',
            '',
            '',
            'Member'
        ]
    );

    await db.run(
        `INSERT OR IGNORE INTO user_stats (user_id, rep_points, followers_count, following_count, messages_count)
         VALUES (?, 0, 0, 0, 0)`,
        [userId]
    );

    await db.run(
        `UPDATE user_profiles
         SET display_name = COALESCE(NULLIF(display_name, ''), ?),
             username = COALESCE(NULLIF(username, ''), ?),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
            baseUser.fullName || baseUser.username || `User ${userId}`,
            baseUser.username || '',
            userId
        ]
    );
}

async function ensureManyUsersFoundation(db, userIds = []) {
    for (const userId of uniqueInts(userIds)) {
        await ensureUserFoundation(db, { id: userId });
    }
}

async function getUserSummary(db, userId) {
    await ensureUserFoundation(db, { id: userId });

    return db.get(
        `
        SELECT
            u.id,
            u.fullName,
            u.username,
            p.display_name,
            p.avatar,
            p.bio,
            p.role_label,
            s.rep_points,
            s.followers_count,
            s.following_count,
            s.messages_count
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        LEFT JOIN user_stats s ON s.user_id = u.id
        WHERE u.id = ?
        `,
        [userId]
    );
}

async function getRoomRecord(db, roomId) {
    return db.get(
        `
        SELECT
            r.id,
            r.room_key,
            r.room_type,
            r.name,
            r.description,
            r.is_private,
            r.created_by_user_id,
            r.created_at,
            r.updated_at,
            COALESCE(COUNT(m.id), 0) AS member_count
        FROM chat_rooms r
        LEFT JOIN chat_room_members m ON m.room_id = r.id
        WHERE r.id = ?
        GROUP BY r.id
        `,
        [roomId]
    );
}

exports.getBootstrap = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);

        if (!db || !userId) {
            return res.status(500).json({ success: false, message: 'Database or user context unavailable.' });
        }

        await ensureUserFoundation(db, req.user);

        const selfProfile = await getUserSummary(db, userId);

        const rooms = await db.all(
            `
            SELECT
                r.id,
                r.room_key,
                r.room_type,
                r.name,
                r.description,
                r.is_private,
                r.created_by_user_id,
                r.created_at,
                r.updated_at,
                COALESCE(COUNT(m2.id), 0) AS member_count
            FROM chat_room_members mym
            INNER JOIN chat_rooms r ON r.id = mym.room_id
            LEFT JOIN chat_room_members m2 ON m2.room_id = r.id
            WHERE mym.user_id = ?
            GROUP BY r.id
            ORDER BY r.updated_at DESC, r.created_at DESC
            `,
            [userId]
        );

        const vaultItems = await db.all(
            `
            SELECT id, user_id, parent_id, item_type, name, file_path, mime_type, file_size, created_at, updated_at
            FROM vault_items
            WHERE user_id = ? AND is_deleted = 0
            ORDER BY item_type DESC, name ASC, id DESC
            `,
            [userId]
        );

        const liveRooms = await db.all(
            `
            SELECT
                lr.id,
                lr.room_key,
                lr.room_type,
                lr.title,
                lr.topic,
                lr.host_user_id,
                lr.status,
                lr.created_at,
                lr.ended_at,
                COALESCE(COUNT(lrp.id), 0) AS participant_count
            FROM live_rooms lr
            LEFT JOIN live_room_participants lrp
                ON lrp.live_room_id = lr.id
               AND lrp.left_at IS NULL
            WHERE lr.status = 'live'
            GROUP BY lr.id
            ORDER BY lr.created_at DESC
            `
        );

        const notifications = await db.all(
            `
            SELECT id, type, title, body, target_type, target_id, is_read, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 20
            `,
            [userId]
        );

        const leaderboard = await db.all(
            `
            SELECT
                u.id,
                u.fullName,
                u.username,
                p.display_name,
                p.avatar,
                p.role_label,
                COALESCE(s.rep_points, 0) AS rep_points,
                COALESCE(s.followers_count, 0) AS followers_count,
                COALESCE(s.following_count, 0) AS following_count,
                COALESCE(s.messages_count, 0) AS messages_count
            FROM users u
            LEFT JOIN user_profiles p ON p.user_id = u.id
            LEFT JOIN user_stats s ON s.user_id = u.id
            ORDER BY COALESCE(s.rep_points, 0) DESC,
                     COALESCE(s.followers_count, 0) DESC,
                     COALESCE(s.messages_count, 0) DESC,
                     u.id ASC
            LIMIT 20
            `
        );

        return res.json({
            success: true,
            data: {
                selfProfile,
                rooms,
                vaultItems,
                liveRooms,
                notifications,
                leaderboard
            }
        });
    } catch (error) {
        console.error('getBootstrap error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load realtime bootstrap data.' });
    }
};

exports.getRooms = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);

        await ensureUserFoundation(db, req.user);

        const rooms = await db.all(
            `
            SELECT
                r.id,
                r.room_key,
                r.room_type,
                r.name,
                r.description,
                r.is_private,
                r.created_by_user_id,
                r.created_at,
                r.updated_at,
                COALESCE(COUNT(m2.id), 0) AS member_count
            FROM chat_room_members mym
            INNER JOIN chat_rooms r ON r.id = mym.room_id
            LEFT JOIN chat_room_members m2 ON m2.room_id = r.id
            WHERE mym.user_id = ?
            GROUP BY r.id
            ORDER BY r.updated_at DESC, r.created_at DESC
            `,
            [userId]
        );

        return res.json({ success: true, rooms });
    } catch (error) {
        console.error('getRooms error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load rooms.' });
    }
};

exports.createRoom = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);
        const roomType = sanitizeText(req.body?.roomType || req.body?.type || 'group').toLowerCase();
        const description = sanitizeText(req.body?.description);
        const requestedName = sanitizeText(req.body?.name);
        const requestedMembers = uniqueInts(req.body?.memberUserIds || []);
        const targetUserId = toInt(req.body?.targetUserId, 0);

        await ensureUserFoundation(db, req.user);
        await ensureManyUsersFoundation(db, requestedMembers);

        let roomKey = makeRoomKey('room');
        let roomName = requestedName || 'New Room';
        let isPrivate = 0;
        let memberIds = [userId, ...requestedMembers];

        if (roomType === 'dm') {
            if (!targetUserId || targetUserId === userId) {
                return res.status(400).json({ success: false, message: 'A valid target user is required for DM rooms.' });
            }

            await ensureUserFoundation(db, { id: targetUserId });

            const ordered = [userId, targetUserId].sort((a, b) => a - b);
            roomKey = `dm_${ordered[0]}_${ordered[1]}`;
            isPrivate = 1;
            memberIds = ordered;

            const existingDm = await db.get(
                'SELECT id FROM chat_rooms WHERE room_key = ? LIMIT 1',
                [roomKey]
            );

            if (existingDm) {
                const room = await getRoomRecord(db, existingDm.id);
                return res.json({ success: true, room, reused: true });
            }

            const targetUser = await db.get(
                'SELECT id, fullName, username FROM users WHERE id = ?',
                [targetUserId]
            );

            roomName = requestedName || targetUser?.fullName || targetUser?.username || `DM ${targetUserId}`;
        } else {
            memberIds = uniqueInts(memberIds);
            if (!roomName) {
                roomName = 'New Group';
            }
            if (roomType === 'group') {
                isPrivate = 0;
            }
        }

        const result = await db.run(
            `
            INSERT INTO chat_rooms (
                room_key, room_type, name, description, created_by_user_id, is_private, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [roomKey, roomType === 'dm' ? 'dm' : 'group', roomName, description, userId, isPrivate]
        );

        const roomId = result.lastID;

        for (const memberId of memberIds) {
            await db.run(
                `
                INSERT OR IGNORE INTO chat_room_members (room_id, user_id, role, joined_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                `,
                [roomId, memberId, memberId === userId ? 'owner' : 'member']
            );
        }

        const room = await getRoomRecord(db, roomId);
        return res.status(201).json({ success: true, room });
    } catch (error) {
        console.error('createRoom error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create room.' });
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);
        const roomId = toInt(req.params?.id, 0);

        const room = await db.get(
            'SELECT id, created_by_user_id, room_type FROM chat_rooms WHERE id = ?',
            [roomId]
        );

        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found.' });
        }

        if (room.room_type === 'dm') {
            return res.status(400).json({ success: false, message: 'DM rooms cannot be deleted from this endpoint.' });
        }

        if (room.created_by_user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Only the room owner can delete this room.' });
        }

        await db.run('DELETE FROM chat_rooms WHERE id = ?', [roomId]);
        return res.json({ success: true, deletedRoomId: roomId });
    } catch (error) {
        console.error('deleteRoom error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete room.' });
    }
};

exports.getVaultItems = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);

        const items = await db.all(
            `
            SELECT id, user_id, parent_id, item_type, name, file_path, mime_type, file_size, created_at, updated_at
            FROM vault_items
            WHERE user_id = ? AND is_deleted = 0
            ORDER BY item_type DESC, name ASC, id DESC
            `,
            [userId]
        );

        return res.json({ success: true, items });
    } catch (error) {
        console.error('getVaultItems error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load vault items.' });
    }
};

exports.createVaultFolder = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);
        const parentId = req.body?.parentId ? toInt(req.body.parentId, null) : null;
        const name = sanitizeText(req.body?.name);

        if (!name) {
            return res.status(400).json({ success: false, message: 'Folder name is required.' });
        }

        if (parentId) {
            const parent = await db.get(
                'SELECT id, item_type FROM vault_items WHERE id = ? AND user_id = ? AND is_deleted = 0',
                [parentId, userId]
            );

            if (!parent || parent.item_type !== 'folder') {
                return res.status(400).json({ success: false, message: 'Invalid parent folder.' });
            }
        }

        const result = await db.run(
            `
            INSERT INTO vault_items (user_id, parent_id, item_type, name, created_at, updated_at)
            VALUES (?, ?, 'folder', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [userId, parentId, name]
        );

        const item = await db.get('SELECT * FROM vault_items WHERE id = ?', [result.lastID]);
        return res.status(201).json({ success: true, item });
    } catch (error) {
        console.error('createVaultFolder error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create vault folder.' });
    }
};

exports.createVaultFile = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);
        const parentId = req.body?.parentId ? toInt(req.body.parentId, null) : null;
        const name = sanitizeText(req.body?.name || req.body?.fileName);
        const filePath = sanitizeText(req.body?.filePath);
        const mimeType = sanitizeText(req.body?.mimeType);
        const fileSize = toInt(req.body?.fileSize, 0);

        if (!name) {
            return res.status(400).json({ success: false, message: 'File name is required.' });
        }

        if (parentId) {
            const parent = await db.get(
                'SELECT id, item_type FROM vault_items WHERE id = ? AND user_id = ? AND is_deleted = 0',
                [parentId, userId]
            );

            if (!parent || parent.item_type !== 'folder') {
                return res.status(400).json({ success: false, message: 'Invalid parent folder.' });
            }
        }

        const result = await db.run(
            `
            INSERT INTO vault_items (
                user_id, parent_id, item_type, name, file_path, mime_type, file_size, created_at, updated_at
            ) VALUES (?, ?, 'file', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [userId, parentId, name, filePath, mimeType, fileSize]
        );

        const item = await db.get('SELECT * FROM vault_items WHERE id = ?', [result.lastID]);
        return res.status(201).json({ success: true, item });
    } catch (error) {
        console.error('createVaultFile error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create vault file metadata.' });
    }
};

exports.getLiveRooms = async (req, res) => {
    try {
        const db = req.app.locals.db;

        const rooms = await db.all(
            `
            SELECT
                lr.id,
                lr.room_key,
                lr.room_type,
                lr.title,
                lr.topic,
                lr.host_user_id,
                lr.status,
                lr.created_at,
                lr.ended_at,
                COALESCE(COUNT(lrp.id), 0) AS participant_count
            FROM live_rooms lr
            LEFT JOIN live_room_participants lrp
                ON lrp.live_room_id = lr.id
               AND lrp.left_at IS NULL
            WHERE lr.status = 'live'
            GROUP BY lr.id
            ORDER BY lr.created_at DESC
            `
        );

        return res.json({ success: true, rooms });
    } catch (error) {
        console.error('getLiveRooms error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load live rooms.' });
    }
};

exports.createLiveRoom = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);
        const roomType = sanitizeText(req.body?.roomType || req.body?.type || 'voice').toLowerCase();
        const title = sanitizeText(req.body?.title);
        const topic = sanitizeText(req.body?.topic);

        if (!title) {
            return res.status(400).json({ success: false, message: 'Room title is required.' });
        }

        const normalizedType = roomType === 'video' ? 'video' : 'voice';
        const roomKey = makeRoomKey(normalizedType);

        const result = await db.run(
            `
            INSERT INTO live_rooms (room_key, room_type, title, topic, host_user_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'live', CURRENT_TIMESTAMP)
            `,
            [roomKey, normalizedType, title, topic, userId]
        );

        const roomId = result.lastID;

        await db.run(
            `
            INSERT OR IGNORE INTO live_room_participants (live_room_id, user_id, role, joined_at)
            VALUES (?, ?, 'host', CURRENT_TIMESTAMP)
            `,
            [roomId, userId]
        );

        const room = await db.get(
            `
            SELECT id, room_key, room_type, title, topic, host_user_id, status, created_at, ended_at
            FROM live_rooms
            WHERE id = ?
            `,
            [roomId]
        );

        return res.status(201).json({ success: true, room });
    } catch (error) {
        console.error('createLiveRoom error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create live room.' });
    }
};

exports.getNotifications = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);

        const notifications = await db.all(
            `
            SELECT id, type, title, body, target_type, target_id, is_read, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY id DESC
            `,
            [userId]
        );

        return res.json({ success: true, notifications });
    } catch (error) {
        console.error('getNotifications error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load notifications.' });
    }
};

exports.readAllNotifications = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);

        await db.run(
            `
            UPDATE notifications
            SET is_read = 1
            WHERE user_id = ? AND is_read = 0
            `,
            [userId]
        );

        return res.json({ success: true });
    } catch (error) {
        console.error('readAllNotifications error:', error);
        return res.status(500).json({ success: false, message: 'Failed to mark notifications as read.' });
    }
};

exports.readNotification = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = toInt(req.user?.id, 0);
        const notificationId = toInt(req.params?.id, 0);

        await db.run(
            `
            UPDATE notifications
            SET is_read = 1
            WHERE id = ? AND user_id = ?
            `,
            [notificationId, userId]
        );

        return res.json({ success: true, notificationId });
    } catch (error) {
        console.error('readNotification error:', error);
        return res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const db = req.app.locals.db;

        const leaderboard = await db.all(
            `
            SELECT
                u.id,
                u.fullName,
                u.username,
                p.display_name,
                p.avatar,
                p.role_label,
                COALESCE(s.rep_points, 0) AS rep_points,
                COALESCE(s.followers_count, 0) AS followers_count,
                COALESCE(s.following_count, 0) AS following_count,
                COALESCE(s.messages_count, 0) AS messages_count
            FROM users u
            LEFT JOIN user_profiles p ON p.user_id = u.id
            LEFT JOIN user_stats s ON s.user_id = u.id
            ORDER BY COALESCE(s.rep_points, 0) DESC,
                     COALESCE(s.followers_count, 0) DESC,
                     COALESCE(s.messages_count, 0) DESC,
                     u.id ASC
            LIMIT 50
            `
        );

        return res.json({ success: true, leaderboard });
    } catch (error) {
        console.error('getLeaderboard error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load leaderboard.' });
    }
};

exports.getProfileByName = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = toInt(req.user?.id, 0);
        const rawName = sanitizeText(req.params?.name);

        if (!rawName) {
            return res.status(400).json({ success: false, message: 'Profile name is required.' });
        }

        const profile = await db.get(
            `
            SELECT
                u.id,
                u.fullName,
                u.username,
                p.display_name,
                p.avatar,
                p.bio,
                p.role_label,
                COALESCE(s.rep_points, 0) AS rep_points,
                COALESCE(s.followers_count, 0) AS followers_count,
                COALESCE(s.following_count, 0) AS following_count,
                COALESCE(s.messages_count, 0) AS messages_count
            FROM users u
            LEFT JOIN user_profiles p ON p.user_id = u.id
            LEFT JOIN user_stats s ON s.user_id = u.id
            WHERE u.username = ?
               OR u.fullName = ?
               OR p.display_name = ?
            LIMIT 1
            `,
            [rawName, rawName, rawName]
        );

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found.' });
        }

        const followRow = await db.get(
            `
            SELECT id
            FROM user_follows
            WHERE follower_user_id = ? AND following_user_id = ?
            LIMIT 1
            `,
            [currentUserId, profile.id]
        );

        return res.json({
            success: true,
            profile: {
                ...profile,
                is_following: !!followRow
            }
        });
    } catch (error) {
        console.error('getProfileByName error:', error);
        return res.status(500).json({ success: false, message: 'Failed to load profile.' });
    }
};

exports.toggleFollow = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const followerUserId = toInt(req.user?.id, 0);
        const followingUserId = toInt(req.body?.userId, 0);

        if (!followingUserId) {
            return res.status(400).json({ success: false, message: 'Target user is required.' });
        }

        if (followerUserId === followingUserId) {
            return res.status(400).json({ success: false, message: 'You cannot follow yourself.' });
        }

        const targetUser = await db.get(
            'SELECT id FROM users WHERE id = ?',
            [followingUserId]
        );

        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'Target user not found.' });
        }

        await ensureUserFoundation(db, { id: followerUserId });
        await ensureUserFoundation(db, { id: followingUserId });

        const existing = await db.get(
            `
            SELECT id
            FROM user_follows
            WHERE follower_user_id = ? AND following_user_id = ?
            LIMIT 1
            `,
            [followerUserId, followingUserId]
        );

        let isFollowing = false;

        if (existing) {
            await db.run(
                'DELETE FROM user_follows WHERE id = ?',
                [existing.id]
            );

            await db.run(
                `
                UPDATE user_stats
                SET following_count = CASE WHEN following_count > 0 THEN following_count - 1 ELSE 0 END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                `,
                [followerUserId]
            );

            await db.run(
                `
                UPDATE user_stats
                SET followers_count = CASE WHEN followers_count > 0 THEN followers_count - 1 ELSE 0 END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                `,
                [followingUserId]
            );

            isFollowing = false;
        } else {
            await db.run(
                `
                INSERT INTO user_follows (follower_user_id, following_user_id, created_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                `,
                [followerUserId, followingUserId]
            );

            await db.run(
                `
                UPDATE user_stats
                SET following_count = following_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                `,
                [followerUserId]
            );

            await db.run(
                `
                UPDATE user_stats
                SET followers_count = followers_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                `,
                [followingUserId]
            );

            await db.run(
                `
                INSERT INTO notifications (user_id, type, title, body, target_type, target_id, is_read, created_at)
                VALUES (?, 'follow', ?, ?, 'profile', ?, 0, CURRENT_TIMESTAMP)
                `,
                [
                    followingUserId,
                    'New follower',
                    `${sanitizeText(req.user?.name || req.user?.username || 'Someone')} started following you.`,
                    String(followerUserId)
                ]
            );

            isFollowing = true;
        }

        const followerStats = await db.get(
            'SELECT followers_count, following_count, rep_points, messages_count FROM user_stats WHERE user_id = ?',
            [followerUserId]
        );

        const targetStats = await db.get(
            'SELECT followers_count, following_count, rep_points, messages_count FROM user_stats WHERE user_id = ?',
            [followingUserId]
        );

        return res.json({
            success: true,
            isFollowing,
            followerStats,
            targetStats
        });
    } catch (error) {
        console.error('toggleFollow error:', error);
        return res.status(500).json({ success: false, message: 'Failed to toggle follow state.' });
    }
};