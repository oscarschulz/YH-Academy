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
const paymentControllers = require('../controllers/paymentControllers');
const universeCollectionsControllers = require('../controllers/universeCollectionsControllers');
const universeCollectionsReadControllers = require('../controllers/universeCollectionsReadControllers');
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


// ==========================================
// 🌌 YH UNIVERSE CANONICAL PROFILE ROUTES
// ==========================================
router.get('/universe/profile', auth, academyControllers.getUniverseProfile);
router.get('/universe/profile/:targetUserId', auth, academyControllers.getUniverseMemberProfile);
router.get('/universe/referrals/me', auth, authController.getMyUniverseReferrals);

// ==========================================
// 🗂️ YH UNIVERSE COLLECTIONS / RESOURCES ROUTES
// ==========================================
router.get('/universe/collections', auth, universeCollectionsControllers.listCollections);
router.post('/universe/collections', auth, universeCollectionsControllers.createCollectionItem);

// Private read routes for the secret-key Collections page.
// These must stay above /universe/collections/:id.
router.get('/universe/collections/bootstrap', auth, universeCollectionsReadControllers.getCollectionsBootstrap);
router.get('/universe/collections/index', auth, universeCollectionsReadControllers.listCollectionIndex);
router.get('/universe/collections/leads', auth, universeCollectionsReadControllers.listFederationLeadInventory);

router.get('/universe/collections/:id', auth, universeCollectionsControllers.getCollectionItem);
router.patch('/universe/collections/:id', auth, universeCollectionsControllers.updateMyCollectionItem);
router.delete('/universe/collections/:id', auth, universeCollectionsControllers.deleteMyCollectionItem);

router.post('/academy/membership-apply', auth, academyControllers.submitMembershipApplication);
router.get('/academy/membership-status', auth, academyControllers.getMembershipStatus);
router.post('/academy/roadmap-apply', auth, academyControllers.submitRoadmapApplication);
router.get('/academy/home', auth, academyControllers.getAcademyHome);
router.get('/academy/profile', auth, academyControllers.getCurrentProfile);
router.patch('/academy/profile', auth, academyControllers.updateCurrentProfile);
router.patch('/academy/account/password', auth, academyControllers.changeCurrentPassword);
router.delete('/academy/profile', auth, academyControllers.deleteCurrentProfile);
router.delete('/account', auth, academyControllers.deleteCurrentAccount);
router.get('/academy/roadmap/active', auth, academyControllers.getActiveRoadmap);
router.get('/academy/missions', auth, academyControllers.getMissions);
router.post('/academy/missions/:id/complete', auth, academyControllers.completeMission);
router.post('/academy/missions/:id/status', auth, academyControllers.updateMissionStatus);
router.post('/academy/checkin', auth, academyControllers.submitCheckin);
router.post('/academy/roadmap/refresh', auth, academyControllers.refreshRoadmap);
router.get('/academy/assistant/messages', auth, academyControllers.getAcademyCoachMessages);
router.post('/academy/assistant/chat', auth, academyControllers.chatWithAcademyCoach);

router.get('/dashboard/assistant/messages', auth, academyControllers.getDashboardAssistantMessages);
router.post('/dashboard/assistant/chat', auth, academyControllers.chatWithDashboardAssistant);

router.get('/academy/mission-playbooks', auth, academyControllers.getAcademyMissionPlaybooks);
router.get('/academy/lead-missions/workspace', auth, academyControllers.getLeadMissionsWorkspace);
router.get('/academy/opportunity-missions', auth, academyControllers.listAcademyOpportunityMissions);
router.post('/academy/lead-missions/:id/submit', auth, academyControllers.submitRoutedLeadMission);
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

router.get('/academy/community/niches', auth, academyCommunityControllers.getNiches);
router.post('/academy/community/niches/:nicheKey/join', auth, academyCommunityControllers.joinNiche);
router.post('/academy/community/niches/:nicheKey/default', auth, academyCommunityControllers.setDefaultNiche);
router.delete('/academy/community/niches/:nicheKey', auth, academyCommunityControllers.leaveNiche);

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

router.get('/plaza/patron-application-status', auth, plazaControllers.getPatronApplicationStatus);
router.post('/plaza/patron-applications', auth, plazaControllers.submitPatronApplication);

router.get('/plaza/patron/desk', auth, plazaControllers.getPatronDesk);
router.post('/plaza/patron/announcements', auth, plazaControllers.createPatronAnnouncement);
router.patch('/plaza/patron/requests/:id/status', auth, plazaControllers.updatePatronRoutedRequestStatus);
router.post('/plaza/patron/recommendations', auth, plazaControllers.createPatronFederationRecommendation);
router.post('/plaza/patron/intro-outcomes', auth, plazaControllers.createPatronIntroOutcome);

router.get('/plaza/bridge', auth, plazaControllers.getBridge);
router.post('/plaza/bridge', auth, plazaControllers.createBridge);

router.get('/plaza/requests', auth, plazaControllers.getRequests);
router.post('/plaza/requests', auth, plazaControllers.createRequest);
router.patch('/plaza/requests/:id', auth, plazaControllers.updateRequest);
router.patch('/plaza/requests/:id/status', auth, plazaControllers.advanceRequestStatus);
router.delete('/plaza/requests/:id', auth, plazaControllers.deleteRequest);

router.get('/plaza/business-members', auth, plazaControllers.getBusinessMembers);
router.get('/plaza/business-blocks', auth, plazaControllers.getBusinessBlocks);
router.delete('/plaza/business-blocks/:blockedUserId', auth, plazaControllers.unblockBusinessMember);
router.get('/plaza/messages', auth, plazaControllers.getMessages);
router.post('/plaza/messages/from-request/:requestId', auth, plazaControllers.createConversationFromRequest);
router.post('/plaza/messages/from-business-member/:targetUserId', auth, plazaControllers.createConversationFromBusinessMember);
router.post('/plaza/messages/from-member/:targetUserId', auth, plazaControllers.createConversationFromMember);
router.post('/plaza/messages/from-region/:regionId', auth, plazaControllers.createConversationFromRegion);
router.post('/plaza/messages/:id/replies', auth, plazaControllers.createConversationReply);
router.post('/plaza/messages/:id/report', auth, plazaControllers.reportConversation);
router.post('/plaza/messages/:id/close', auth, plazaControllers.closeConversation);
router.post('/plaza/messages/:id/block', auth, plazaControllers.blockConversationParticipant);

router.get('/plaza/meetups', auth, plazaControllers.getMeetups);
router.post('/plaza/meetups', auth, plazaControllers.createMeetup);
router.patch('/plaza/meetups/:id/patron-status', auth, plazaControllers.updatePatronMeetupStatus);

// ==========================================
// 💳 YH PROVIDER-NEUTRAL PAYMENT LEDGER ROUTES
// ==========================================
router.get('/payments/options', auth, paymentControllers.getPaymentOptions);
router.get('/payments/my-ledger', auth, paymentControllers.listMyPayments);
router.get('/payments/subscriptions', auth, paymentControllers.listMySubscriptions);
router.post('/payments/subscriptions/:division/unsubscribe', auth, paymentControllers.unsubscribePaymentPlan);
router.get('/payments/academy/learn-from-access', auth, paymentControllers.getAcademyLearnFromAccess);
router.post('/payments/academy/learn-from-access/unsubscribe', auth, paymentControllers.unsubscribeAcademyLearnFromAccess);
router.post('/payments/academy/learn-from-access/stripe-checkout-session', auth, paymentControllers.createAcademyLearnFromStripeCheckoutSession);
router.post('/payments/academy/learn-from-access/oxapay-invoice', auth, paymentControllers.createAcademyLearnFromOxaPayInvoice);
router.post('/payments/badges/:division/ledger', auth, paymentControllers.createVerifiedBadgePaymentLedger);
router.post('/payments/badges/:division/checkout-session', auth, paymentControllers.createVerifiedBadgeStripeCheckoutSession);
router.post('/payments/badges/:division/oxapay-invoice', auth, paymentControllers.createVerifiedBadgeOxaPayInvoice);
router.post('/payments/badges/:division/unsubscribe', auth, paymentControllers.unsubscribeVerifiedBadge);
router.post('/payments/federation/connect/requests/:requestId/ledger', auth, paymentControllers.createFederationPaidIntroLedger);
router.post('/payments/plaza/opportunities/:opportunityId/ledger', auth, paymentControllers.createPlazaOpportunityPaymentLedger);

router.get('/payouts/options', auth, paymentControllers.getPayoutOptions);
router.get('/payouts/balance', auth, paymentControllers.getMyPayoutBalance);
router.get('/payouts/my-ledger', auth, paymentControllers.listMyPayouts);
router.post('/payouts/withdrawal-requests', auth, paymentControllers.createWithdrawalRequest);

// ==========================================
// 🧠 INTERNAL AI NURTURE ROUTES
// ==========================================
router.get('/internal/ai-nurture/:gate/bootstrap', aiNurtureGate, aiNurtureControllers.bootstrap);
router.get('/internal/ai-nurture/:gate/settings', aiNurtureGate, aiNurtureControllers.getSettings);
router.patch('/internal/ai-nurture/:gate/settings', aiNurtureGate, aiNurtureControllers.updateSettings);

router.get('/internal/ai-nurture/:gate/batches', aiNurtureGate, aiNurtureControllers.listBatchProgress);
router.post('/internal/ai-nurture/:gate/batches/:batchId/run-remaining', aiNurtureGate, aiNurtureControllers.runRemainingBatchJobs);
router.post('/internal/ai-nurture/:gate/batches/:batchId/retry-failed', aiNurtureGate, aiNurtureControllers.retryFailedBatchSources);
router.post('/internal/ai-nurture/:gate/batches/:batchId/approve-ready', aiNurtureGate, aiNurtureControllers.approveReadyBatchSources);

router.post('/internal/ai-nurture/:gate/sources', aiNurtureGate, aiNurtureControllers.createSource);
router.post('/internal/ai-nurture/:gate/sources/batch', aiNurtureGate, aiNurtureControllers.createBatchSources);
router.post('/internal/ai-nurture/:gate/sources/discover', aiNurtureGate, aiNurtureControllers.discoverSourceLinks);
router.get('/internal/ai-nurture/:gate/sources', aiNurtureGate, aiNurtureControllers.listSources);
router.post('/internal/ai-nurture/:gate/sources/approve-ready', aiNurtureGate, aiNurtureControllers.approveReadySources);
router.get('/internal/ai-nurture/:gate/sources/:id', aiNurtureGate, aiNurtureControllers.getSourceById);
router.post('/internal/ai-nurture/:gate/sources/:id/process', aiNurtureGate, aiNurtureControllers.processSource);
router.post('/internal/ai-nurture/:gate/sources/:id/reprocess', aiNurtureGate, aiNurtureControllers.queueReprocess);

router.post('/internal/ai-nurture/:gate/sources/:id/approve', aiNurtureGate, aiNurtureControllers.approveSource);
router.post('/internal/ai-nurture/:gate/sources/:id/reject', aiNurtureGate, aiNurtureControllers.rejectSource);
router.post('/internal/ai-nurture/:gate/sources/:id/notes', aiNurtureGate, aiNurtureControllers.addReviewNote);

router.post('/internal/ai-nurture/:gate/mentor-packs', aiNurtureGate, aiNurtureControllers.createMentorKnowledgePack);
router.delete('/internal/ai-nurture/:gate/mentor-packs/:id', aiNurtureGate, aiNurtureControllers.deleteMentorKnowledgePack);

router.get('/internal/ai-nurture/:gate/library', aiNurtureGate, aiNurtureControllers.listLibrary);
router.post('/internal/ai-nurture/:gate/context-preview', aiNurtureGate, aiNurtureControllers.previewContext);
router.get('/internal/ai-nurture/:gate/context-packs', aiNurtureGate, aiNurtureControllers.listContextPacks);
router.post('/internal/ai-nurture/:gate/context-packs/rebuild', aiNurtureGate, aiNurtureControllers.rebuildContextPacks);

router.get('/internal/ai-nurture/:gate/jobs', aiNurtureGate, aiNurtureControllers.listJobs);
router.post('/internal/ai-nurture/:gate/jobs/run-next', aiNurtureGate, aiNurtureControllers.runNextJob);
router.post('/internal/ai-nurture/:gate/jobs/run-batch', aiNurtureGate, aiNurtureControllers.runQueuedJobs);
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