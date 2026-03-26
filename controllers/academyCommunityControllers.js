const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const toInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

function normalizeFriendPair(a, b) {
    const x = toInt(a, 0);
    const y = toInt(b, 0);
    return x < y ? [x, y] : [y, x];
}

async function ensureLocalUserFoundation(db, authUser) {
    const firebaseUid = sanitizeText(authUser?.firebaseUid || authUser?.id);
    const email = sanitizeText(authUser?.email).toLowerCase();
    const username = sanitizeText(authUser?.username);
    const fullName = sanitizeText(authUser?.name || authUser?.fullName || username || 'Hustler');

    if (!firebaseUid) {
        throw new Error('Missing Firebase user identifier in token.');
    }

    let link = await db.get(
        `
        SELECT
            l.user_id,
            u.fullName,
            u.email,
            u.username
        FROM auth_user_links l
        INNER JOIN users u ON u.id = l.user_id
        WHERE l.firebase_uid = ?
        LIMIT 1
        `,
        [firebaseUid]
    );

    let userId = 0;

    if (link?.user_id) {
        userId = link.user_id;
    } else {
        let localUser = null;

        if (email) {
            localUser = await db.get(
                'SELECT id, fullName, email, username FROM users WHERE email = ? LIMIT 1',
                [email]
            );
        }

        if (!localUser && username) {
            localUser = await db.get(
                'SELECT id, fullName, email, username FROM users WHERE username = ? LIMIT 1',
                [username]
            );
        }

        if (!localUser) {
            const result = await db.run(
                `
                INSERT INTO users (fullName, email, username, contact, password, isVerified, verificationCode)
                VALUES (?, ?, ?, '', '', 1, NULL)
                `,
                [fullName, email || null, username || null]
            );
            userId = result.lastID;
        } else {
            userId = localUser.id;
        }

        await db.run(
            `
            INSERT INTO auth_user_links (firebase_uid, email, username, user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(firebase_uid) DO UPDATE SET
                email = excluded.email,
                username = excluded.username,
                user_id = excluded.user_id,
                updated_at = CURRENT_TIMESTAMP
            `,
            [firebaseUid, email || null, username || null, userId]
        );
    }

    await db.run(
        `
        INSERT OR IGNORE INTO user_profiles (user_id, display_name, username, avatar, bio, role_label)
        VALUES (?, ?, ?, '', '', 'Academy Member')
        `,
        [userId, fullName || username || `User ${userId}`, username || '']
    );

    await db.run(
        `
        INSERT OR IGNORE INTO user_stats (user_id, rep_points, followers_count, following_count, messages_count)
        VALUES (?, 0, 0, 0, 0)
        `,
        [userId]
    );

    await db.run(
        `
        UPDATE user_profiles
        SET
            display_name = COALESCE(NULLIF(display_name, ''), ?),
            username = COALESCE(NULLIF(username, ''), ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
        `,
        [fullName || username || `User ${userId}`, username || '', userId]
    );

    return userId;
}

exports.getFeed = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const viewerUserId = await ensureLocalUserFoundation(db, req.user);
        const limit = Math.min(Math.max(toInt(req.query?.limit, 15), 1), 50);
        const offset = Math.max(toInt(req.query?.offset, 0), 0);

        const posts = await db.all(
            `
            SELECT
                p.id,
                p.user_id,
                p.body,
                p.image_url,
                p.visibility,
                p.is_pinned,
                p.created_at,
                p.updated_at,
                u.fullName,
                u.username,
                up.display_name,
                up.avatar,
                up.role_label,
                COALESCE((
                    SELECT COUNT(*)
                    FROM academy_feed_post_likes l
                    WHERE l.post_id = p.id
                ), 0) AS like_count,
                COALESCE((
                    SELECT COUNT(*)
                    FROM academy_feed_post_comments c
                    WHERE c.post_id = p.id AND c.is_deleted = 0
                ), 0) AS comment_count,
                CASE
                    WHEN EXISTS(
                        SELECT 1
                        FROM academy_feed_post_likes l2
                        WHERE l2.post_id = p.id AND l2.user_id = ?
                    ) THEN 1 ELSE 0
                END AS liked_by_me,
                CASE
                    WHEN EXISTS(
                        SELECT 1
                        FROM user_follows f
                        WHERE f.follower_user_id = ? AND f.following_user_id = p.user_id
                    ) THEN 1 ELSE 0
                END AS following_author,
                CASE
                    WHEN EXISTS(
                        SELECT 1
                        FROM academy_friendships fs
                        WHERE (fs.user_one_id = ? AND fs.user_two_id = p.user_id)
                           OR (fs.user_one_id = p.user_id AND fs.user_two_id = ?)
                    ) THEN 1 ELSE 0
                END AS is_friend,
                CASE
                    WHEN EXISTS(
                        SELECT 1
                        FROM academy_friend_requests fr
                        WHERE fr.sender_user_id = ?
                          AND fr.receiver_user_id = p.user_id
                          AND fr.status = 'pending'
                    ) THEN 1 ELSE 0
                END AS outgoing_friend_request_pending
            FROM academy_feed_posts p
            INNER JOIN users u ON u.id = p.user_id
            LEFT JOIN user_profiles up ON up.user_id = p.user_id
            WHERE p.is_deleted = 0
            ORDER BY p.is_pinned DESC, p.id DESC
            LIMIT ? OFFSET ?
            `,
            [viewerUserId, viewerUserId, viewerUserId, viewerUserId, viewerUserId, limit, offset]
        );

        return res.json({
            success: true,
            posts,
            limit,
            offset
        });
    } catch (error) {
        console.error('academyCommunity.getFeed error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Academy feed.'
        });
    }
};

exports.createPost = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = await ensureLocalUserFoundation(db, req.user);

        const body = sanitizeText(req.body?.body);
        const imageUrl = sanitizeText(req.body?.imageUrl);
        const visibility = sanitizeText(req.body?.visibility || 'academy').toLowerCase();

        if (!body) {
            return res.status(400).json({
                success: false,
                message: 'Post content is required.'
            });
        }

        const result = await db.run(
            `
            INSERT INTO academy_feed_posts (user_id, body, image_url, visibility, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [userId, body, imageUrl || null, visibility || 'academy']
        );

        const post = await db.get(
            `
            SELECT
                p.id,
                p.user_id,
                p.body,
                p.image_url,
                p.visibility,
                p.is_pinned,
                p.created_at,
                p.updated_at,
                u.fullName,
                u.username,
                up.display_name,
                up.avatar,
                up.role_label,
                0 AS like_count,
                0 AS comment_count,
                0 AS liked_by_me,
                0 AS following_author,
                0 AS is_friend,
                0 AS outgoing_friend_request_pending
            FROM academy_feed_posts p
            INNER JOIN users u ON u.id = p.user_id
            LEFT JOIN user_profiles up ON up.user_id = p.user_id
            WHERE p.id = ?
            `,
            [result.lastID]
        );

        return res.status(201).json({
            success: true,
            post
        });
    } catch (error) {
        console.error('academyCommunity.createPost error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create post.'
        });
    }
};

exports.toggleLike = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = await ensureLocalUserFoundation(db, req.user);
        const postId = toInt(req.params?.id, 0);

        if (!postId) {
            return res.status(400).json({ success: false, message: 'Invalid post id.' });
        }

        const post = await db.get(
            'SELECT id, user_id FROM academy_feed_posts WHERE id = ? AND is_deleted = 0',
            [postId]
        );

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }

        const existingLike = await db.get(
            'SELECT id FROM academy_feed_post_likes WHERE post_id = ? AND user_id = ?',
            [postId, userId]
        );

        let liked = false;

        if (existingLike) {
            await db.run(
                'DELETE FROM academy_feed_post_likes WHERE id = ?',
                [existingLike.id]
            );
            liked = false;
        } else {
            await db.run(
                `
                INSERT INTO academy_feed_post_likes (post_id, user_id, created_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                `,
                [postId, userId]
            );
            liked = true;
        }

        const counts = await db.get(
            `
            SELECT
                COALESCE(COUNT(*), 0) AS like_count
            FROM academy_feed_post_likes
            WHERE post_id = ?
            `,
            [postId]
        );

        return res.json({
            success: true,
            liked,
            likeCount: Number(counts?.like_count || 0)
        });
    } catch (error) {
        console.error('academyCommunity.toggleLike error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to toggle like.'
        });
    }
};

exports.getComments = async (req, res) => {
    try {
        const db = req.app.locals.db;
        await ensureLocalUserFoundation(db, req.user);
        const postId = toInt(req.params?.id, 0);

        if (!postId) {
            return res.status(400).json({ success: false, message: 'Invalid post id.' });
        }

        const comments = await db.all(
            `
            SELECT
                c.id,
                c.post_id,
                c.user_id,
                c.body,
                c.created_at,
                c.updated_at,
                u.fullName,
                u.username,
                up.display_name,
                up.avatar,
                up.role_label
            FROM academy_feed_post_comments c
            INNER JOIN users u ON u.id = c.user_id
            LEFT JOIN user_profiles up ON up.user_id = c.user_id
            WHERE c.post_id = ? AND c.is_deleted = 0
            ORDER BY c.id ASC
            `,
            [postId]
        );

        return res.json({
            success: true,
            comments
        });
    } catch (error) {
        console.error('academyCommunity.getComments error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load comments.'
        });
    }
};

exports.createComment = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = await ensureLocalUserFoundation(db, req.user);
        const postId = toInt(req.params?.id, 0);
        const body = sanitizeText(req.body?.body);

        if (!postId) {
            return res.status(400).json({ success: false, message: 'Invalid post id.' });
        }

        if (!body) {
            return res.status(400).json({ success: false, message: 'Comment cannot be empty.' });
        }

        const post = await db.get(
            'SELECT id FROM academy_feed_posts WHERE id = ? AND is_deleted = 0',
            [postId]
        );

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }

        const result = await db.run(
            `
            INSERT INTO academy_feed_post_comments (post_id, user_id, body, created_at, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [postId, userId, body]
        );

        const comment = await db.get(
            `
            SELECT
                c.id,
                c.post_id,
                c.user_id,
                c.body,
                c.created_at,
                c.updated_at,
                u.fullName,
                u.username,
                up.display_name,
                up.avatar,
                up.role_label
            FROM academy_feed_post_comments c
            INNER JOIN users u ON u.id = c.user_id
            LEFT JOIN user_profiles up ON up.user_id = c.user_id
            WHERE c.id = ?
            `,
            [result.lastID]
        );

        const commentCountRow = await db.get(
            `
            SELECT COUNT(*) AS comment_count
            FROM academy_feed_post_comments
            WHERE post_id = ? AND is_deleted = 0
            `,
            [postId]
        );

        return res.status(201).json({
            success: true,
            comment,
            commentCount: Number(commentCountRow?.comment_count || 0)
        });
    } catch (error) {
        console.error('academyCommunity.createComment error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create comment.'
        });
    }
};

exports.sendFriendRequest = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const userId = await ensureLocalUserFoundation(db, req.user);
        const targetUserId = toInt(req.body?.targetUserId, 0);

        if (!targetUserId || targetUserId === userId) {
            return res.status(400).json({
                success: false,
                message: 'A valid target user is required.'
            });
        }

        const target = await db.get(
            'SELECT id FROM users WHERE id = ?',
            [targetUserId]
        );

        if (!target) {
            return res.status(404).json({
                success: false,
                message: 'Target user not found.'
            });
        }

        const [userOneId, userTwoId] = normalizeFriendPair(userId, targetUserId);

        const existingFriendship = await db.get(
            `
            SELECT id
            FROM academy_friendships
            WHERE user_one_id = ? AND user_two_id = ?
            LIMIT 1
            `,
            [userOneId, userTwoId]
        );

        if (existingFriendship) {
            return res.status(400).json({
                success: false,
                message: 'You are already friends.'
            });
        }

        const existingRequest = await db.get(
            `
            SELECT id, status, sender_user_id, receiver_user_id
            FROM academy_friend_requests
            WHERE sender_user_id = ? AND receiver_user_id = ?
            LIMIT 1
            `,
            [userId, targetUserId]
        );

        if (existingRequest && existingRequest.status === 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Friend request already pending.'
            });
        }

        await db.run(
            `
            INSERT INTO academy_friend_requests (sender_user_id, receiver_user_id, status, created_at)
            VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)
            ON CONFLICT(sender_user_id, receiver_user_id) DO UPDATE SET
                status = 'pending',
                responded_at = NULL
            `,
            [userId, targetUserId]
        );

        return res.json({
            success: true,
            message: 'Friend request sent.'
        });
    } catch (error) {
        console.error('academyCommunity.sendFriendRequest error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send friend request.'
        });
    }
};

exports.respondToFriendRequest = async (req, res) => {
    try {
        const db = req.app.locals.db;
        const responderUserId = await ensureLocalUserFoundation(db, req.user);
        const requestId = toInt(req.params?.id, 0);
        const action = sanitizeText(req.body?.action).toLowerCase();

        if (!requestId) {
            return res.status(400).json({ success: false, message: 'Invalid request id.' });
        }

        if (!['accept', 'decline'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Invalid action.' });
        }

        const requestRow = await db.get(
            `
            SELECT id, sender_user_id, receiver_user_id, status
            FROM academy_friend_requests
            WHERE id = ?
            LIMIT 1
            `,
            [requestId]
        );

        if (!requestRow) {
            return res.status(404).json({ success: false, message: 'Friend request not found.' });
        }

        if (requestRow.receiver_user_id !== responderUserId) {
            return res.status(403).json({ success: false, message: 'You cannot respond to this request.' });
        }

        if (requestRow.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'This request has already been handled.' });
        }

        const nextStatus = action === 'accept' ? 'accepted' : 'declined';

        await db.run(
            `
            UPDATE academy_friend_requests
            SET status = ?, responded_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [nextStatus, requestId]
        );

        if (action === 'accept') {
            const [userOneId, userTwoId] = normalizeFriendPair(
                requestRow.sender_user_id,
                requestRow.receiver_user_id
            );

            await db.run(
                `
                INSERT OR IGNORE INTO academy_friendships (user_one_id, user_two_id, created_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                `,
                [userOneId, userTwoId]
            );
        }

        return res.json({
            success: true,
            status: nextStatus
        });
    } catch (error) {
        console.error('academyCommunity.respondToFriendRequest error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to respond to friend request.'
        });
    }
};