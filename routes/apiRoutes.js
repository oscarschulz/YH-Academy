const express = require('express');
const router = express.Router();
const academyControllers = require('../academyControllers');
const auth = require('../middlewares/auth');
// --- CONTROLLERS ---
const authController = require('../controllers/authControllers');
const realtimeControllers = require('../controllers/realtimeControllers');
const academyCommunityControllers = require('../controllers/academyCommunityControllers');
const plazaSupabaseLiteControllers = require('../controllers/plazaSupabaseLiteControllers');
const plazaDirectoryRegionsSupabaseLiteControllers = require('../controllers/plazaDirectoryRegionsSupabaseLiteControllers');
const plazaBridgeRequestsSupabaseLiteControllers = require('../controllers/plazaBridgeRequestsSupabaseLiteControllers');
const plazaMeetupsSupabaseLiteControllers = require('../controllers/plazaMeetupsSupabaseLiteControllers');
const plazaBusinessMessagesSupabaseLiteControllers = require('../controllers/plazaBusinessMessagesSupabaseLiteControllers');
const plazaPatronSupabaseLiteControllers = require('../controllers/plazaPatronSupabaseLiteControllers');
const federationInfluenceControllers = require('../controllers/federationInfluenceControllers');
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

router.get(
    '/universe/tutorials',
    auth,
    academyControllers.getDivisionTutorials
);

router.patch(
    '/universe/tutorials/:division',
    auth,
    academyControllers.updateDivisionTutorial
);

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
router.get('/academy/champions', auth, academyControllers.getAcademyChampions);

router.post(
    '/academy/quests/:questId/claim',
    auth,
    academyControllers.claimAcademyQuestReward
);

router.get(
    '/academy/progression',
    auth,
    academyControllers.getAcademyProgression
);

router.get(
    '/academy/leaderboard',
    auth,
    academyControllers.getAcademyProgressionLeaderboard
);

/* PATCH: Academy Squad Foundation and management routes v2 */
router.get(
    '/academy/squad',
    auth,
    academyControllers.getMyAcademySquad
);

router.get(
    '/academy/squad/search',
    auth,
    academyControllers.searchAcademySquadByInvite
);

/* PATCH: Academy Squad ranking routes v1 */
router.get(
    '/academy/squad/leaderboard',
    auth,
    academyControllers.getAcademySquadLeaderboard
);

router.get(
    '/academy/squad/contributors',
    auth,
    academyControllers.getMyAcademySquadContributors
);
/* END PATCH: Academy Squad ranking routes v1 */


/* PATCH: Shared Academy Squad Mission routes v1 */

router.get(
    '/academy/squad/missions',
    auth,
    academyControllers.getMyAcademySquadMissions
);

router.get(
    '/academy/squad/missions/:missionId/contributions',
    auth,
    academyControllers
        .getMyAcademySquadMissionContributions
);

router.post(
    '/academy/squad/missions',
    auth,
    academyControllers.createMyAcademySquadMission
);

router.patch(
    '/academy/squad/missions/:missionId',
    auth,
    academyControllers.updateMyAcademySquadMission
);

router.delete(
    '/academy/squad/missions/:missionId',
    auth,
    academyControllers.cancelMyAcademySquadMission
);

/* END PATCH: Shared Academy Squad Mission routes v1 */


router.post(
    '/academy/squad',
    auth,
    academyControllers.createMyAcademySquad
);

router.post(
    '/academy/squad/join',
    auth,
    academyControllers.joinAcademySquad
);

router.post(
    '/academy/squad/invite/regenerate',
    auth,
    academyControllers.regenerateMyAcademySquadInvite
);

router.post(
    '/academy/squad/leave',
    auth,
    academyControllers.leaveMyAcademySquad
);

router.patch(
    '/academy/squad/members/:userId',
    auth,
    academyControllers.manageMyAcademySquadMember
);

router.delete(
    '/academy/squad',
    auth,
    academyControllers.disbandMyAcademySquad
);
/* END PATCH: Academy Squad Foundation and management routes v2 */

router.get(
    '/academy/profile',
    auth,
    academyControllers.getCurrentProfile
);
router.patch('/academy/profile', auth, academyControllers.updateCurrentProfile);
router.patch('/academy/account/password', auth, academyControllers.changeCurrentPassword);
router.delete('/academy/profile', auth, academyControllers.deleteCurrentProfile);
router.delete('/account', auth, academyControllers.deleteCurrentAccount);
router.get('/academy/roadmap/active', auth, academyControllers.getActiveRoadmap);
router.get('/academy/missions', auth, academyControllers.getMissions);
router.patch('/academy/missions/:id/journal', auth, academyControllers.saveMissionJournal);
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
router.patch(
    '/academy/lead-missions/leads/:id',
    auth,
    academyControllers.updateMyLeadMissionLead
);

router.delete(
    '/academy/lead-missions/leads/:id',
    auth,
    academyControllers.deleteMyLeadMissionLead
);

router.get(
    '/academy/lead-missions/followups',
    auth,
    academyControllers.listMyLeadMissionsFollowUps
);
router.get('/academy/lead-missions/payouts', auth, academyControllers.listMyLeadMissionPayouts);
router.get('/academy/lead-missions/deals', auth, academyControllers.listMyLeadMissionDeals);
router.get(
    '/academy/lead-missions/scripts',
    auth,
    academyControllers.getLeadMissionScripts
);

router.get(
    '/contacts',
    auth,
    academyControllers.listMyContacts
);

router.post(
    '/contacts',
    auth,
    academyControllers.createExternalContact
);

router.patch(
    '/contacts/:id',
    auth,
    academyControllers.updateExternalContact
);

router.delete(
    '/contacts/:id',
    auth,
    academyControllers.deleteExternalContact
);

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
router.get('/plaza/feed', auth, plazaSupabaseLiteControllers.getFeed);
router.post('/plaza/feed/posts', auth, plazaSupabaseLiteControllers.createFeedPost);

router.get('/plaza/opportunities', auth, plazaSupabaseLiteControllers.getOpportunities);
router.post('/plaza/opportunities', auth, plazaSupabaseLiteControllers.createOpportunity);

router.get(
    '/plaza/reputation',
    auth,
    plazaSupabaseLiteControllers
        .getMyReputationLedger
);

router.get('/plaza/directory', auth, plazaDirectoryRegionsSupabaseLiteControllers.getDirectory);
router.post('/plaza/directory/profile', auth, plazaDirectoryRegionsSupabaseLiteControllers.upsertDirectoryProfile);

router.get('/plaza/regions', auth, plazaDirectoryRegionsSupabaseLiteControllers.getRegions);
router.post('/plaza/regions', auth, plazaDirectoryRegionsSupabaseLiteControllers.createRegion);

router.get('/plaza/patron-application-status', auth, plazaPatronSupabaseLiteControllers.getPatronApplicationStatus);
router.post('/plaza/patron-applications', auth, plazaPatronSupabaseLiteControllers.submitPatronApplication);

router.get('/plaza/patron/desk', auth, plazaPatronSupabaseLiteControllers.getPatronDesk);
router.post('/plaza/patron/announcements', auth, plazaPatronSupabaseLiteControllers.createPatronAnnouncement);
router.patch('/plaza/patron/requests/:id/status', auth, plazaPatronSupabaseLiteControllers.updatePatronRoutedRequestStatus);
router.post('/plaza/patron/recommendations', auth, plazaPatronSupabaseLiteControllers.createPatronFederationRecommendation);
router.post('/plaza/patron/intro-outcomes', auth, plazaPatronSupabaseLiteControllers.createPatronIntroOutcome);

router.get('/plaza/bridge', auth, plazaBridgeRequestsSupabaseLiteControllers.getBridge);
router.post('/plaza/bridge', auth, plazaBridgeRequestsSupabaseLiteControllers.createBridge);

router.get('/plaza/requests', auth, plazaBridgeRequestsSupabaseLiteControllers.getRequests);
router.post('/plaza/requests', auth, plazaBridgeRequestsSupabaseLiteControllers.createRequest);
router.patch('/plaza/requests/:id', auth, plazaBridgeRequestsSupabaseLiteControllers.updateRequest);
router.patch('/plaza/requests/:id/status', auth, plazaBridgeRequestsSupabaseLiteControllers.advanceRequestStatus);
router.delete('/plaza/requests/:id', auth, plazaBridgeRequestsSupabaseLiteControllers.deleteRequest);

router.get('/plaza/business-members', auth, plazaBusinessMessagesSupabaseLiteControllers.getBusinessMembers);
router.get('/plaza/business-blocks', auth, plazaBusinessMessagesSupabaseLiteControllers.getBusinessBlocks);
router.delete('/plaza/business-blocks/:blockedUserId', auth, plazaBusinessMessagesSupabaseLiteControllers.unblockBusinessMember);
router.get('/plaza/messages', auth, plazaBusinessMessagesSupabaseLiteControllers.getMessages);
router.post('/plaza/messages/from-request/:requestId', auth, plazaBusinessMessagesSupabaseLiteControllers.createConversationFromRequest);
router.post('/plaza/messages/from-business-member/:targetUserId', auth, plazaBusinessMessagesSupabaseLiteControllers.createConversationFromBusinessMember);
router.post('/plaza/messages/from-member/:targetUserId', auth, plazaBusinessMessagesSupabaseLiteControllers.createConversationFromMember);
router.post('/plaza/messages/from-region/:regionId', auth, plazaBusinessMessagesSupabaseLiteControllers.createConversationFromRegion);
router.post('/plaza/messages/:id/replies', auth, plazaBusinessMessagesSupabaseLiteControllers.createConversationReply);
router.post('/plaza/messages/:id/report', auth, plazaBusinessMessagesSupabaseLiteControllers.reportConversation);
router.post('/plaza/messages/:id/close', auth, plazaBusinessMessagesSupabaseLiteControllers.closeConversation);
router.post('/plaza/messages/:id/block', auth, plazaBusinessMessagesSupabaseLiteControllers.blockConversationParticipant);

router.get('/plaza/meetups', auth, plazaMeetupsSupabaseLiteControllers.getMeetups);
router.post('/plaza/meetups', auth, plazaMeetupsSupabaseLiteControllers.createMeetup);
router.patch('/plaza/meetups/:id', auth, plazaMeetupsSupabaseLiteControllers.updateMeetup);
router.delete('/plaza/meetups/:id', auth, plazaMeetupsSupabaseLiteControllers.deleteMeetup);
router.patch('/plaza/meetups/:id/patron-status', auth, plazaMeetupsSupabaseLiteControllers.updatePatronMeetupStatus);

// ==========================================
// 🏛️ YH FEDERATION INFLUENCE ROUTES
// ==========================================
router.get(
    '/federation/influence',
    auth,
    federationInfluenceControllers
        .getMyInfluenceLedger
);

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
router.post('/payments/badges/:division/revenuecat-sync', auth, paymentControllers.syncVerifiedBadgeRevenueCat);
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

/*
 * Every endpoint below this prefix requires
 * the HttpOnly AI Nurture session cookie.
 *
 * No gate secret is accepted in API URLs.
 */
router.use(
    '/internal/ai-nurture',
    aiNurtureGate
);

router.get(
    '/internal/ai-nurture/bootstrap',
    aiNurtureControllers.bootstrap
);

router.get(
    '/internal/ai-nurture/settings',
    aiNurtureControllers.getSettings
);

router.patch(
    '/internal/ai-nurture/settings',
    aiNurtureControllers.updateSettings
);

router.get(
    '/internal/ai-nurture/batches',
    aiNurtureControllers.listBatchProgress
);

router.post(
    '/internal/ai-nurture/batches/:batchId/run-remaining',
    aiNurtureControllers.runRemainingBatchJobs
);

router.post(
    '/internal/ai-nurture/batches/:batchId/retry-failed',
    aiNurtureControllers.retryFailedBatchSources
);

router.post(
    '/internal/ai-nurture/batches/:batchId/approve-ready',
    aiNurtureControllers.approveReadyBatchSources
);

router.post(
    '/internal/ai-nurture/sources',
    aiNurtureControllers.createSource
);

router.post(
    '/internal/ai-nurture/sources/batch',
    aiNurtureControllers.createBatchSources
);

router.post(
    '/internal/ai-nurture/sources/discover',
    aiNurtureControllers.discoverSourceLinks
);

router.get(
    '/internal/ai-nurture/sources',
    aiNurtureControllers.listSources
);

router.post(
    '/internal/ai-nurture/sources/approve-ready',
    aiNurtureControllers.approveReadySources
);

router.get(
    '/internal/ai-nurture/sources/:id',
    aiNurtureControllers.getSourceById
);

router.post(
    '/internal/ai-nurture/sources/:id/process',
    aiNurtureControllers.processSource
);

router.post(
    '/internal/ai-nurture/sources/:id/reprocess',
    aiNurtureControllers.queueReprocess
);

router.post(
    '/internal/ai-nurture/sources/:id/approve',
    aiNurtureControllers.approveSource
);

router.post(
    '/internal/ai-nurture/sources/:id/reject',
    aiNurtureControllers.rejectSource
);

router.post(
    '/internal/ai-nurture/sources/:id/notes',
    aiNurtureControllers.addReviewNote
);

router.post(
    '/internal/ai-nurture/mentor-packs',
    aiNurtureControllers.createMentorKnowledgePack
);

router.delete(
    '/internal/ai-nurture/mentor-packs/:id',
    aiNurtureControllers.deleteMentorKnowledgePack
);

router.get(
    '/internal/ai-nurture/library',
    aiNurtureControllers.listLibrary
);

router.post(
    '/internal/ai-nurture/context-preview',
    aiNurtureControllers.previewContext
);

router.get(
    '/internal/ai-nurture/context-packs',
    aiNurtureControllers.listContextPacks
);

router.post(
    '/internal/ai-nurture/context-packs/rebuild',
    aiNurtureControllers.rebuildContextPacks
);

router.get(
    '/internal/ai-nurture/jobs',
    aiNurtureControllers.listJobs
);

router.post(
    '/internal/ai-nurture/jobs/run-next',
    aiNurtureControllers.runNextJob
);

router.post(
    '/internal/ai-nurture/jobs/run-batch',
    aiNurtureControllers.runQueuedJobs
);

router.get(
    '/internal/ai-nurture/user-overlays/:uid',
    aiNurtureControllers.getUserOverlay
);

router.patch(
    '/internal/ai-nurture/user-overlays/:uid',
    aiNurtureControllers.updateUserOverlay
);

router.get(
    '/internal/ai-nurture/academy/telemetry/:uid',
    academyControllers
        .getInternalRoadmapTelemetry
);
// ==========================================
// ⚡ REALTIME BACKEND ROUTES
// ==========================================

router.get('/realtime/bootstrap', auth, realtimeControllers.getBootstrap);
router.get(
    '/realtime/rooms',
    auth,
    realtimeControllers.getRooms
);

router.get(
    '/realtime/rooms/:id/messages',
    auth,
    realtimeControllers.getRoomMessages
);

router.post(
    '/realtime/rooms',
    auth,
    realtimeControllers.createRoom
);
router.delete('/realtime/rooms/:id', auth, realtimeControllers.deleteRoom);
router.patch('/realtime/rooms/:id/hide', auth, realtimeControllers.hideRoom);
router.patch('/realtime/rooms/:id/mute', auth, realtimeControllers.muteRoom);
router.patch('/realtime/rooms/:id/block', auth, realtimeControllers.blockRoom);

router.get('/realtime/live-rooms', auth, realtimeControllers.getLiveRooms);
router.post('/realtime/live-rooms', auth, realtimeControllers.createLiveRoom);

// Compatibility aliases for older Academy voice lounge clients/debug probes.
router.get('/academy/voice-rooms', auth, realtimeControllers.getLiveRooms);
router.get('/academy/live-rooms', auth, realtimeControllers.getLiveRooms);


router.get('/realtime/notifications', auth, realtimeControllers.getNotifications);
router.post('/realtime/notifications/read-all', auth, realtimeControllers.readAllNotifications);
router.post('/realtime/notifications/:id/read', auth, realtimeControllers.readNotification);

router.get('/realtime/leaderboard', auth, realtimeControllers.getLeaderboard);
router.get('/realtime/profiles/:name', auth, realtimeControllers.getProfileByName);
router.post('/realtime/follows/toggle', auth, realtimeControllers.toggleFollow);


// 🔥 Laging nasa pinakababa ito dapat para ma-export nang buo!
module.exports = router;