require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { firestore } = require('./config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');
const jwt = require('jsonwebtoken');
const publicLandingEventsRepo = require('./backend/repositories/publicLandingEventsRepo');

const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server);
const publicLandingNamespace = io.of('/public-landing');

async function emitPublicLandingSnapshotToClients(limit = 24) {
    try {
        const payload = await publicLandingEventsRepo.buildPublicLandingSnapshot(limit);
        publicLandingNamespace.emit('landingSnapshot', {
            success: true,
            ...payload
        });
    } catch (error) {
        console.error('emitPublicLandingSnapshotToClients error:', error);
    }
}

global.yhEmitPublicLandingSnapshot = emitPublicLandingSnapshotToClients;

publicLandingNamespace.on('connection', (socket) => {
    console.log('🌍 Public landing socket connected:', socket.id);
    emitPublicLandingSnapshotToClients().catch((error) => {
        console.error('public landing initial snapshot error:', error);
    });

    socket.on('disconnect', () => {
        console.log('🌍 Public landing socket disconnected:', socket.id);
    });
});

const chatMessagesCol = firestore.collection('chatMessages');
const chatRoomsCol = firestore.collection('chatRooms');

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const mapChatTimestamp = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value || null;
};
const AUTH_COOKIE_NAME = 'yh_auth_token';

function parseCookieHeader(raw = '') {
    const out = {};

    String(raw || '').split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return;

        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();

        if (!key) return;
        out[key] = decodeURIComponent(value);
    });

    return out;
}

function getSocketToken(socket) {
    const handshakeToken = sanitizeText(socket.handshake?.auth?.token);
    if (handshakeToken) return handshakeToken;

    const cookies = parseCookieHeader(socket.handshake?.headers?.cookie || '');
    return sanitizeText(cookies[AUTH_COOKIE_NAME]);
}

function verifySocketUser(socket) {
    const token = getSocketToken(socket);
    if (!token) return null;

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        return {
            id: sanitizeText(verified?.id || verified?.firebaseUid),
            firebaseUid: sanitizeText(verified?.firebaseUid || verified?.id),
            email: sanitizeText(verified?.email).toLowerCase(),
            username: sanitizeText(verified?.username),
            name: sanitizeText(verified?.name || verified?.username || 'Hustler')
        };
    } catch (_) {
        return null;
    }
}

async function canUserAccessRoom(userId, roomId) {
    if (!userId || !roomId) return false;
    if (roomId === 'YH-community' || roomId === 'main-chat') return true;

    const snap = await chatRoomsCol.doc(roomId).get();
    if (!snap.exists) return false;

    const data = snap.data() || {};
    const memberIds = Array.isArray(data.member_ids) ? data.member_ids.map((value) => String(value)) : [];
    return memberIds.includes(String(userId));
}
function mapChatMessageDoc(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        room: sanitizeText(data.room),
        author: sanitizeText(data.author),
        initial: sanitizeText(data.initial),
        avatar: sanitizeText(data.avatar),
        text: sanitizeText(data.text),
        time: sanitizeText(data.time || mapChatTimestamp(data.created_at)),
        upvotes: Number.isFinite(Number(data.upvotes)) ? Number(data.upvotes) : 0
    };
}

// ==========================================
// ⚡ REAL-TIME SOCKET.IO LOGIC
// ==========================================
io.on('connection', (socket) => {
    const socketUser = verifySocketUser(socket);

    if (!socketUser?.id) {
        socket.emit('socketAuthError', { message: 'Unauthorized socket session.' });
        socket.disconnect(true);
        return;
    }

    socket.user = socketUser;
    console.log('⚡ A hustler connected:', socket.id, socket.user.id);

    socket.on('joinRoom', async (room) => {
        try {
            const roomId = sanitizeText(room);
            if (!roomId) return;

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) {
                socket.emit('socketRoomError', { roomId, message: 'Access denied for this room.' });
                return;
            }

            socket.join(roomId);

            const historySnap = await chatMessagesCol
                .where('room', '==', roomId)
                .limit(200)
                .get();

            const history = historySnap.docs
                .map(mapChatMessageDoc)
                .sort((a, b) => {
                    const aTime = new Date(a.time || 0).getTime();
                    const bTime = new Date(b.time || 0).getTime();
                    return aTime - bTime;
                })
                .slice(-50);

            socket.emit('chatHistory', history);
        } catch (error) {
            console.error('joinRoom error:', error);
        }
    });

    socket.on('sendMessage', async (data) => {
        try {
            const roomId = sanitizeText(data?.room);
            const text = sanitizeText(data?.text);

            if (!roomId || !text) return;

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) return;

            const authorName = sanitizeText(socket.user.name || socket.user.username || 'Hustler');

            const payload = {
                room: roomId,
                author: authorName,
                initial: authorName.charAt(0).toUpperCase(),
                avatar: '',
                text,
                time: new Date().toISOString(),
                upvotes: 0,
                created_at: Timestamp.now(),
                created_by_user_id: socket.user.id
            };

            const ref = chatMessagesCol.doc();
            await ref.set(payload);

            const outgoing = {
                id: ref.id,
                room: payload.room,
                author: payload.author,
                initial: payload.initial,
                avatar: payload.avatar,
                text: payload.text,
                time: payload.time,
                upvotes: 0
            };

            io.to(payload.room).emit('receiveMessage', outgoing);
        } catch (error) {
            console.error('sendMessage error:', error);
        }
    });

    socket.on('upvoteMessage', async (msgId) => {
        try {
            const messageId = sanitizeText(msgId);
            if (!messageId) return;

            const ref = chatMessagesCol.doc(messageId);
            const snap = await ref.get();
            if (!snap.exists) return;

            const current = snap.data() || {};
            const roomId = sanitizeText(current.room);

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) return;

            const nextUpvotes = (Number(current.upvotes) || 0) + 1;

            await ref.update({
                upvotes: nextUpvotes
            });

            io.to(roomId).emit('messageUpvoted', {
                id: messageId,
                upvotes: nextUpvotes
            });
        } catch (error) {
            console.error('upvoteMessage error:', error);
        }
    });

    socket.on('deleteMessage', async (msgId) => {
        try {
            const messageId = sanitizeText(msgId);
            if (!messageId) return;

            const ref = chatMessagesCol.doc(messageId);
            const snap = await ref.get();
            if (!snap.exists) return;

            const current = snap.data() || {};
            const ownerId = sanitizeText(current.created_by_user_id);
            const roomId = sanitizeText(current.room);

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) return;

            if (!ownerId || ownerId !== socket.user.id) {
                socket.emit('messageDeleteError', {
                    id: messageId,
                    message: 'Only the original sender can delete this message.'
                });
                return;
            }

            await ref.delete();
            io.to(roomId).emit('messageDeleted', messageId);
        } catch (error) {
            console.error('deleteMessage error:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ A hustler disconnected:', socket.id);
    });
});

// --- 🛡️ SECURITY PACKAGES ---
const rateLimit = require('express-rate-limit');

const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (!allowedOrigins.length) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Anti-Spam (Rate Limiting)
const AUTH_OTP_RATE_LIMIT_PATHS = new Set([
    '/verify-otp',
    '/resend-otp',
    '/forgot-password',
    '/verify-forgot-otp',
    '/reset-password'
]);

const AUTH_WRITE_RATE_LIMIT_PATHS = new Set([
    '/register',
    '/login'
]);

const PUBLIC_LANDING_RATE_LIMIT_PATHS = new Set([
    '/public/landing-feed'
]);

const authOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false
});

const authWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false
});

const publicLandingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 240,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => String(req.method || '').toUpperCase() !== 'GET'
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 240,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        const path = String(req.path || '').trim().toLowerCase();

        // Do not rate-limit admin routes.
        // Anyone who already knows the secret admin URL and correct credentials
        // should not be blocked by the generic public API limiter.
        if (path === '/admin/login' || path.startsWith('/admin/')) return true;

        // OTP / password recovery routes use their own relaxed limiter.
        if (AUTH_OTP_RATE_LIMIT_PATHS.has(path)) return true;

        // Register/login should not share the same bucket as public polling routes.
        if (AUTH_WRITE_RATE_LIMIT_PATHS.has(path)) return true;

        // Public landing live polling uses its own dedicated limiter.
        if (PUBLIC_LANDING_RATE_LIMIT_PATHS.has(path)) return true;

        // Academy UI reads (feed, member search, membership status) are normal in-app polling.
        // The generic limiter is too aggressive here and causes 429 spam in the console.
        const method = String(req.method || '').trim().toUpperCase();
        if (method === 'GET') {
            if (path === '/academy/membership-status') return true;
            if (path === '/academy/community/members') return true;
            if (path === '/academy/feed' || path.startsWith('/academy/feed/')) return true;
        }

        return false;
    }
});

app.use('/api/verify-otp', authOtpLimiter);
app.use('/api/resend-otp', authOtpLimiter);
app.use('/api/forgot-password', authOtpLimiter);
app.use('/api/verify-forgot-otp', authOtpLimiter);
app.use('/api/reset-password', authOtpLimiter);

app.use('/api/register', authWriteLimiter);
app.use('/api/login', authWriteLimiter);
app.use('/api/public/landing-feed', publicLandingLimiter);

app.use('/api', apiLimiter);

// --- MVC ROUTING ---
const viewRoutes = require('./routes/viewRoutes');
const apiRoutes = require('./routes/apiRoutes');
const { createAdminRouters } = require('./routes/admin-auth-routes');
const { startAiNurtureWorker } = require('./backend/services/aiNurtureWorker');

const { pageRouter: adminPageRouter, apiRouter: adminApiRouter } = createAdminRouters({
    privateAdminDir: path.join(__dirname, 'private', 'admin')
});

app.use(adminApiRouter);
app.use(adminPageRouter);

app.use('/', viewRoutes);
app.use('/api', apiRoutes);

startAiNurtureWorker();

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 YH Server is running! Open http://localhost:${PORT} in your browser.`);
});