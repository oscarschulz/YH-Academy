const express = require('express');
const router = express.Router();
const academyControllers = require('../academyControllers');
const auth = require('../middlewares/auth');
// --- CONTROLLERS ---
const authController = require('../controllers/authControllers');
const realtimeControllers = require('../controllers/realtimeControllers');
const academyCommunityControllers = require('../controllers/academyCommunityControllers');
const plazaControllers = require('../controllers/plazaControllers');
const aiNurtureControllers = require('../controllers/aiNurtureControllers');
const publicLandingController = require('../controllers/publicLandingController');
const aiNurtureGate = require('../backend/middlewares/aiNurtureGate');

// ==========================================
// 🔐 2. AUTHENTICATION & OTP ROUTES
// ==========================================
router.post('/register', authController.registerUser);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);

// ==========================================
// 🌍 PUBLIC LANDING FEED ROUTES
// ==========================================
router.get('/public/landing-feed', publicLandingController.getLandingFeed);

// ==========================================
// 🚪 3. LOGIN / LOGOUT ROUTES
// ==========================================
router.post('/login', authController.loginUser);
router.post('/logout', authController.logoutUser);

// ==========================================
// 🔄 4. FORGOT PASSWORD ROUTES
// ==========================================
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-forgot-otp', authController.verifyForgotOTP);
router.post('/reset-password', authController.resetPassword);


router.post('/academy/membership-apply', auth, academyControllers.submitMembershipApplication);
router.get('/academy/membership-status', auth, academyControllers.getMembershipStatus);
router.post('/academy/roadmap-apply', auth, academyControllers.submitRoadmapApplication);
router.get('/academy/home', auth, academyControllers.getAcademyHome);
router.get('/academy/profile', auth, academyControllers.getCurrentProfile);
router.patch('/academy/profile', auth, academyControllers.updateCurrentProfile);
router.patch('/academy/account/password', auth, academyControllers.changeCurrentPassword);
router.delete('/academy/profile', auth, academyControllers.deleteCurrentProfile);
router.get('/academy/roadmap/active', auth, academyControllers.getActiveRoadmap);
router.get('/academy/missions', auth, academyControllers.getMissions);
router.post('/academy/missions/:id/complete', auth, academyControllers.completeMission);
router.post('/academy/missions/:id/status', auth, academyControllers.updateMissionStatus);
router.post('/academy/checkin', auth, academyControllers.submitCheckin);
router.post('/academy/roadmap/refresh', auth, academyControllers.refreshRoadmap);
router.get('/academy/assistant/messages', auth, academyControllers.getAcademyCoachMessages);
router.post('/academy/assistant/chat', auth, academyControllers.chatWithAcademyCoach);

router.get('/academy/lead-missions/workspace', auth, academyControllers.getLeadMissionsWorkspace);
router.get('/academy/lead-missions/leads', auth, academyControllers.listMyLeadMissionsLeads);
router.post('/academy/lead-missions/leads', auth, academyControllers.createLeadMissionLead);
router.get('/academy/lead-missions/leads/:id', auth, academyControllers.getMyLeadMissionLeadById);
router.patch('/academy/lead-missions/leads/:id', auth, academyControllers.updateMyLeadMissionLead);
router.get('/academy/lead-missions/followups', auth, academyControllers.listMyLeadMissionsFollowUps);
router.get('/academy/lead-missions/payouts', auth, academyControllers.listMyLeadMissionPayouts);
router.get('/academy/lead-missions/deals', auth, academyControllers.listMyLeadMissionDeals);
router.get('/academy/lead-missions/scripts', auth, academyControllers.getLeadMissionScripts);

// ==========================================
// 🎓 YHA COMMUNITY FEED ROUTES
// ==========================================
router.get('/academy/feed', auth, academyCommunityControllers.getFeed);
router.post('/academy/feed/posts', auth, academyCommunityControllers.createPost);
router.patch('/academy/feed/posts/:id', auth, academyCommunityControllers.updatePost);
router.delete('/academy/feed/posts/:id', auth, academyCommunityControllers.deletePost);
router.post('/academy/feed/posts/:id/hide', auth, academyCommunityControllers.hidePost);
router.post('/academy/feed/posts/:id/like', auth, academyCommunityControllers.toggleLike);

router.get('/academy/feed/posts/:id/comments', auth, academyCommunityControllers.getComments);
router.post('/academy/feed/posts/:id/comments', auth, academyCommunityControllers.createComment);
router.patch('/academy/feed/posts/:postId/comments/:commentId', auth, academyCommunityControllers.updateComment);
router.delete('/academy/feed/posts/:postId/comments/:commentId', auth, academyCommunityControllers.deleteComment);
router.post('/academy/feed/posts/:postId/comments/:commentId/hide', auth, academyCommunityControllers.hideComment);
router.post('/academy/feed/friend-requests', auth, academyCommunityControllers.sendFriendRequest);
router.post('/academy/feed/friend-requests/:id/respond', auth, academyCommunityControllers.respondToFriendRequest);
router.get('/academy/community/members', auth, academyCommunityControllers.getMembers);
router.get('/academy/community/members/:id/profile', auth, academyCommunityControllers.getMemberProfile);
router.post('/academy/community/members/:id/follow', auth, academyCommunityControllers.toggleMemberFollow);

// ==========================================
// 🏪 YH PLAZA FEED ROUTES
// ==========================================
router.get('/plaza/feed', auth, plazaControllers.getFeed);
router.post('/plaza/feed/posts', auth, plazaControllers.createFeedPost);

router.get('/plaza/opportunities', auth, plazaControllers.getOpportunities);
router.post('/plaza/opportunities', auth, plazaControllers.createOpportunity);

router.get('/plaza/directory', auth, plazaControllers.getDirectory);
router.post('/plaza/directory/profile', auth, plazaControllers.upsertDirectoryProfile);

router.get('/plaza/regions', auth, plazaControllers.getRegions);
router.post('/plaza/regions', auth, plazaControllers.createRegion);

router.get('/plaza/bridge', auth, plazaControllers.getBridge);
router.post('/plaza/bridge', auth, plazaControllers.createBridge);

// ==========================================
// 🧠 INTERNAL AI NURTURE ROUTES
// ==========================================
router.get('/internal/ai-nurture/:gate/bootstrap', aiNurtureGate, aiNurtureControllers.bootstrap);
router.get('/internal/ai-nurture/:gate/settings', aiNurtureGate, aiNurtureControllers.getSettings);
router.patch('/internal/ai-nurture/:gate/settings', aiNurtureGate, aiNurtureControllers.updateSettings);

router.post('/internal/ai-nurture/:gate/sources', aiNurtureGate, aiNurtureControllers.createSource);
router.get('/internal/ai-nurture/:gate/sources', aiNurtureGate, aiNurtureControllers.listSources);
router.get('/internal/ai-nurture/:gate/sources/:id', aiNurtureGate, aiNurtureControllers.getSourceById);
router.post('/internal/ai-nurture/:gate/sources/:id/process', aiNurtureGate, aiNurtureControllers.processSource);
router.post('/internal/ai-nurture/:gate/sources/:id/reprocess', aiNurtureGate, aiNurtureControllers.queueReprocess);

router.post('/internal/ai-nurture/:gate/sources/:id/approve', aiNurtureGate, aiNurtureControllers.approveSource);
router.post('/internal/ai-nurture/:gate/sources/:id/reject', aiNurtureGate, aiNurtureControllers.rejectSource);
router.post('/internal/ai-nurture/:gate/sources/:id/notes', aiNurtureGate, aiNurtureControllers.addReviewNote);

router.get('/internal/ai-nurture/:gate/library', aiNurtureGate, aiNurtureControllers.listLibrary);
router.post('/internal/ai-nurture/:gate/context-preview', aiNurtureGate, aiNurtureControllers.previewContext);
router.get('/internal/ai-nurture/:gate/context-packs', aiNurtureGate, aiNurtureControllers.listContextPacks);
router.post('/internal/ai-nurture/:gate/context-packs/rebuild', aiNurtureGate, aiNurtureControllers.rebuildContextPacks);

router.get('/internal/ai-nurture/:gate/jobs', aiNurtureGate, aiNurtureControllers.listJobs);
router.post('/internal/ai-nurture/:gate/jobs/run-next', aiNurtureGate, aiNurtureControllers.runNextJob);

router.get('/internal/ai-nurture/:gate/user-overlays/:uid', aiNurtureGate, aiNurtureControllers.getUserOverlay);
router.patch('/internal/ai-nurture/:gate/user-overlays/:uid', aiNurtureGate, aiNurtureControllers.updateUserOverlay);

router.get('/internal/ai-nurture/:gate/academy/telemetry/:uid', aiNurtureGate, academyControllers.getInternalRoadmapTelemetry);
// ==========================================
// ⚡ REALTIME BACKEND ROUTES
// ==========================================
router.get('/realtime/bootstrap', auth, realtimeControllers.getBootstrap);

router.get('/realtime/rooms', auth, realtimeControllers.getRooms);
router.post('/realtime/rooms', auth, realtimeControllers.createRoom);
router.delete('/realtime/rooms/:id', auth, realtimeControllers.deleteRoom);
router.patch('/realtime/rooms/:id/hide', auth, realtimeControllers.hideRoom);
router.patch('/realtime/rooms/:id/mute', auth, realtimeControllers.muteRoom);
router.patch('/realtime/rooms/:id/block', auth, realtimeControllers.blockRoom);

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