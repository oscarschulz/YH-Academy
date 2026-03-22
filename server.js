require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- 🗄️ SQLITE DATABASE SETUP ---
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

(async () => {
    try {
        const db = await open({
            filename: './yh_database.sqlite',
            driver: sqlite3.Database
        });
        
        await db.exec(`
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fullName TEXT,
                email TEXT UNIQUE,
                username TEXT,
                contact TEXT,
                password TEXT,
                isVerified INTEGER DEFAULT 0,
                verificationCode TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room TEXT,
                author TEXT,
                initial TEXT,
                avatar TEXT,
                text TEXT,
                time TEXT,
                upvotes INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS academy_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                city TEXT,
                country TEXT,
                occupation_type TEXT,
                current_job TEXT,
                industry TEXT,
                monthly_income_range TEXT,
                savings_range TEXT,
                income_source TEXT,
                business_stage TEXT,
                sleep_hours REAL,
                energy_score INTEGER,
                exercise_frequency TEXT,
                stress_score INTEGER,
                bad_habit TEXT,
                seriousness TEXT,
                weekly_hours INTEGER,
                goals_6mo TEXT,
                blocker_text TEXT,
                coach_tone TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS academy_roadmaps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                profile_id INTEGER NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'active',
                readiness_score INTEGER,
                summary_json TEXT NOT NULL,
                roadmap_json TEXT NOT NULL,
                created_by_model TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (profile_id) REFERENCES academy_profiles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS academy_missions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                roadmap_id INTEGER NOT NULL,
                pillar TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                why_it_matters TEXT,
                frequency TEXT NOT NULL,
                due_date TEXT,
                estimated_minutes INTEGER,
                status TEXT NOT NULL DEFAULT 'pending',
                source TEXT NOT NULL DEFAULT 'ai',
                completion_note TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (roadmap_id) REFERENCES academy_roadmaps(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS academy_checkins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                roadmap_id INTEGER NOT NULL,
                energy_score INTEGER,
                mood_score INTEGER,
                completed_summary TEXT,
                blocker_text TEXT,
                tomorrow_focus TEXT,
                ai_feedback_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (roadmap_id) REFERENCES academy_roadmaps(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS academy_coach_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                roadmap_id INTEGER,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                context_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (roadmap_id) REFERENCES academy_roadmaps(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS academy_access (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                access_state TEXT NOT NULL DEFAULT 'locked',
                unlocked_at DATETIME,
                last_assessed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room);
            CREATE INDEX IF NOT EXISTS idx_academy_profiles_user_id ON academy_profiles(user_id);
            CREATE INDEX IF NOT EXISTS idx_academy_roadmaps_user_id ON academy_roadmaps(user_id);
            CREATE INDEX IF NOT EXISTS idx_academy_roadmaps_profile_id ON academy_roadmaps(profile_id);
            CREATE INDEX IF NOT EXISTS idx_academy_missions_user_id ON academy_missions(user_id);
            CREATE INDEX IF NOT EXISTS idx_academy_missions_roadmap_id ON academy_missions(roadmap_id);
            CREATE INDEX IF NOT EXISTS idx_academy_missions_status ON academy_missions(status);
            CREATE INDEX IF NOT EXISTS idx_academy_checkins_user_id ON academy_checkins(user_id);
            CREATE INDEX IF NOT EXISTS idx_academy_checkins_roadmap_id ON academy_checkins(roadmap_id);
            CREATE INDEX IF NOT EXISTS idx_academy_coach_messages_user_id ON academy_coach_messages(user_id);
            CREATE INDEX IF NOT EXISTS idx_academy_access_user_id ON academy_access(user_id);
        `);

        console.log('🟢 SQLite Local Database Connected!');
        app.locals.db = db; 
    } catch (error) {
        console.error('🔴 MALI SA SQLITE:', error);
    }
})();

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

app.use('/', viewRoutes);
app.use('/api', apiRoutes); 

// ==========================================
// ⚡ REAL-TIME SOCKET.IO LOGIC
// ==========================================
io.on('connection', (socket) => {
    console.log('⚡ A hustler connected:', socket.id);

    // 1. Kapag pumasok ang user sa kwarto (Main Chat o DM)
    socket.on('joinRoom', async (room) => {
        socket.join(room);
        const db = app.locals.db;
        if(db) {
            // Kunin ang huling 50 messages sa database at ibigay sa user na kakapasok lang
            const history = await db.all('SELECT * FROM messages WHERE room = ? ORDER BY id ASC LIMIT 50', [room]);
            socket.emit('chatHistory', history);
        }
    });

    // 2. Kapag may nag-send ng Chat
    socket.on('sendMessage', async (data) => {
        const db = app.locals.db;
        if(db) {
            // I-save ang message sa SQLite
            const result = await db.run(
                'INSERT INTO messages (room, author, initial, avatar, text, time, upvotes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [data.room, data.author, data.initial, data.avatar, data.text, data.time, 0]
            );
            data.id = result.lastID; // Ilakip ang ID mula sa database

            // I-broadcast ang chat sa lahat ng tao sa kwarto
            io.to(data.room).emit('receiveMessage', data);
        }
    });

    // 3. Kapag may nag-click ng apoy (Upvote/Agree)
    socket.on('upvoteMessage', async (msgId) => {
        const db = app.locals.db;
        if(db) {
            await db.run('UPDATE messages SET upvotes = upvotes + 1 WHERE id = ?', [msgId]);
            io.emit('messageUpvoted', msgId); // Update ang screen ng lahat
        }
    });

    // 4. Kapag binura ng owner ang chat niya
    socket.on('deleteMessage', async (msgId) => {
         const db = app.locals.db;
         if(db) {
             await db.run('DELETE FROM messages WHERE id = ?', [msgId]);
             io.emit('messageDeleted', msgId); // Update ang screen ng lahat
         }
    });

    socket.on('disconnect', () => {
        console.log('❌ A hustler disconnected:', socket.id);
    });
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 YH Server is running! Open http://localhost:${PORT} in your browser.`);
});