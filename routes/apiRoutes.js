const express = require('express');
const router = express.Router();
const academyControllers = require('../academyControllers');
const auth = require('../middlewares/auth');
// --- CONTROLLERS ---
const authController = require('../controllers/authControllers');
const realtimeControllers = require('../controllers/realtimeControllers');
const academyCommunityControllers = require('../controllers/academyCommunityControllers');


// ==========================================
// 🔐 2. AUTHENTICATION & OTP ROUTES
// ==========================================
router.post('/register', authController.registerUser);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);

// ==========================================
// 🚪 3. LOGIN ROUTE
// ==========================================
router.post('/login', authController.loginUser);

// ==========================================
// 🔄 4. FORGOT PASSWORD ROUTES
// ==========================================
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-forgot-otp', authController.verifyForgotOTP);
router.post('/reset-password', authController.resetPassword);


router.post('/academy/intake', auth, academyControllers.intakeProfile);
router.get('/academy/home', auth, academyControllers.getAcademyHome);
router.get('/academy/roadmap/active', auth, academyControllers.getActiveRoadmap);
router.get('/academy/missions', auth, academyControllers.getMissions);
router.post('/academy/missions/:id/complete', auth, academyControllers.completeMission);
router.post('/academy/missions/:id/status', auth, academyControllers.updateMissionStatus);
router.post('/academy/checkin', auth, academyControllers.submitCheckin);
router.post('/academy/roadmap/refresh', auth, academyControllers.refreshRoadmap);

// ==========================================
// 🎓 YHA COMMUNITY FEED ROUTES
// ==========================================
router.get('/academy/feed', auth, academyCommunityControllers.getFeed);
router.post('/academy/feed/posts', auth, academyCommunityControllers.createPost);
router.post('/academy/feed/posts/:id/like', auth, academyCommunityControllers.toggleLike);
router.get('/academy/feed/posts/:id/comments', auth, academyCommunityControllers.getComments);
router.post('/academy/feed/posts/:id/comments', auth, academyCommunityControllers.createComment);
router.post('/academy/feed/friend-requests', auth, academyCommunityControllers.sendFriendRequest);
router.post('/academy/feed/friend-requests/:id/respond', auth, academyCommunityControllers.respondToFriendRequest);

// ==========================================
// ⚡ REALTIME BACKEND ROUTES
// ==========================================
router.get('/realtime/bootstrap', auth, realtimeControllers.getBootstrap);

router.get('/realtime/rooms', auth, realtimeControllers.getRooms);
router.post('/realtime/rooms', auth, realtimeControllers.createRoom);
router.delete('/realtime/rooms/:id', auth, realtimeControllers.deleteRoom);

router.get('/realtime/vault', auth, realtimeControllers.getVaultItems);
router.post('/realtime/vault/folder', auth, realtimeControllers.createVaultFolder);
router.post('/realtime/vault/file', auth, realtimeControllers.createVaultFile);

router.get('/realtime/live-rooms', auth, realtimeControllers.getLiveRooms);
router.post('/realtime/live-rooms', auth, realtimeControllers.createLiveRoom);

router.get('/realtime/notifications', auth, realtimeControllers.getNotifications);
router.post('/realtime/notifications/read-all', auth, realtimeControllers.readAllNotifications);
router.post('/realtime/notifications/:id/read', auth, realtimeControllers.readNotification);

router.get('/realtime/leaderboard', auth, realtimeControllers.getLeaderboard);
router.get('/realtime/profiles/:name', auth, realtimeControllers.getProfileByName);
router.post('/realtime/follows/toggle', auth, realtimeControllers.toggleFollow);

// 🔥 Laging nasa pinakababa ito dapat para ma-export nang buo!
module.exports = router;