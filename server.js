require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { firestore } = require('./config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const chatMessagesCol = firestore.collection('chatMessages');

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
    console.log('⚡ A hustler connected:', socket.id);

    socket.on('joinRoom', async (room) => {
        try {
            const roomId = sanitizeText(room);
            if (!roomId) return;

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
            const payload = {
                room: sanitizeText(data?.room),
                author: sanitizeText(data?.author),
                initial: sanitizeText(data?.initial),
                avatar: sanitizeText(data?.avatar),
                text: sanitizeText(data?.text),
                time: sanitizeText(data?.time || new Date().toISOString()),
                upvotes: 0,
                created_at: Timestamp.now()
            };

            if (!payload.room || !payload.author || !payload.text) {
                return;
            }

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
            await ref.update({
                upvotes: (Number(current.upvotes) || 0) + 1
            });

            io.emit('messageUpvoted', messageId);
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

            await ref.delete();
            io.emit('messageDeleted', messageId);
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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Anti-Spam (Rate Limiting)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 30, 
    message: { success: false, message: "Too many requests from this IP. Try again in 15 minutes." },
    standardHeaders: true, 
    legacyHeaders: false,
});
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