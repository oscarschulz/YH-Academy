const patronRepo = require('../backend/repositories/plazaPatronSupabaseRepo');
const regionsRepo = require('../backend/repositories/plazaDirectoryRegionsSupabaseRepo');
const requestsRepo = require('../backend/repositories/plazaBridgeRequestsSupabaseRepo');
const meetupsRepo = require('../backend/repositories/plazaMeetupsSupabaseRepo');

function sanitizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function clampText(value, max = 1000, fallback = '') {
    return sanitizeText(value, fallback).slice(0, Math.max(1, Number(max || 1000)));
}

function safeArray(value = []) {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeText(item)).filter(Boolean);
    }

    return sanitizeText(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function cleanStatus(value = '', fallback = '') {
    return sanitizeText(value || fallback).toLowerCase();
}

function getViewerFromRequest(req = {}) {
    const user = req.user || {};

    return {
        id: sanitizeText(user.id || user.firebaseUid || user.uid),
        firebaseUid: sanitizeText(user.firebaseUid || user.id || user.uid),
        email: sanitizeText(user.email).toLowerCase(),
        username: sanitizeText(user.username),
        name: sanitizeText(
            user.name ||
            user.fullName ||
            user.displayName ||
            user.username ||
            user.email ||
            'YH Member'
        )
    };
}

function userMatches(item = {}, viewer = {}) {
    const keys = new Set([
        viewer.id,
        viewer.firebaseUid,
        viewer.email,
        viewer.username
    ].map(sanitizeText).filter(Boolean));

    if (!keys.size) return false;

    return [
        item.userId,
        item.firebaseUid,
        item.email,
        item.authorId,
        item.requesterId,
        item.patronId,
        item.raw?.userId,
        item.raw?.firebaseUid,
        item.raw?.email,
        item.raw?.patronUserId,
        item.raw?.patronId
    ].map(sanitizeText).some((value) => keys.has(value));
}

function normalizePatronStatus(application = null) {
    const status = cleanStatus(application?.status || application?.reviewStatus || '');
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    if (status === 'waitlisted') return 'Waitlisted';
    if (status === 'pending_review' || status === 'under review' || status === 'under_review') return 'Under Review';
    return application ? sanitizeText(application.status || application.reviewStatus || 'Under Review') : 'Not Submitted';
}

async function loadRegions() {
    try {
        if (typeof regionsRepo.listRegions === 'function') {
            return await regionsRepo.listRegions(250);
        }
    } catch (error) {
        console.warn('Patron regions load skipped:', error?.message || error);
    }

    return [];
}

async function loadRequests() {
    try {
        if (typeof requestsRepo.listRequests === 'function') {
            return await requestsRepo.listRequests(250);
        }
    } catch (error) {
        console.warn('Patron requests load skipped:', error?.message || error);
    }

    return [];
}

async function loadMeetups() {
    try {
        if (typeof meetupsRepo.listMeetups === 'function') {
            return await meetupsRepo.listMeetups(250);
        }
    } catch (error) {
        console.warn('Patron meetups load skipped:', error?.message || error);
    }

    return [];
}

exports.getPatronApplicationStatus = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const application = await patronRepo.getApplicationForUser(viewer);
        const status = normalizePatronStatus(application);

        return res.json({
            success: true,
            source: 'supabase',
            hasApplication: !!application,
            status,
            application
        });
    } catch (error) {
        console.error('plazaPatronSupabaseLite.getPatronApplicationStatus error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Patron application status.'
        });
    }
};

exports.submitPatronApplication = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const body = req.body || {};
        const regionId = sanitizeText(body.regionId || body.region_id);
        const fullName = clampText(body.fullName || body.name || viewer.name, 140);
        const preferredRole = clampText(body.preferredRole || body.role || 'Regional Patron', 100);
        const leadershipExperience = clampText(body.leadershipExperience || body.experience, 1200);
        const plazaPlan = clampText(body.plazaPlan || body.plan, 1200);
        const meetupPlan = clampText(body.meetupPlan || body.meetups, 900);
        const whyYou = clampText(body.whyYou || body.why, 900);

        if (!regionId) {
            return res.status(400).json({
                success: false,
                message: 'Select the Plaza you want to lead.'
            });
        }

        if (!fullName) {
            return res.status(400).json({
                success: false,
                message: 'Your name is required.'
            });
        }

        if (!leadershipExperience) {
            return res.status(400).json({
                success: false,
                message: 'Leadership experience is required.'
            });
        }

        if (!plazaPlan) {
            return res.status(400).json({
                success: false,
                message: 'Plaza leadership plan is required.'
            });
        }

        if (!whyYou) {
            return res.status(400).json({
                success: false,
                message: 'Explain why you should become Patron or Leader.'
            });
        }

        const existing = await patronRepo.getApplicationForUser(viewer);
        const applicationId = sanitizeText(existing?.id || `PLAZA-PATRON-${Date.now()}-${viewer.id}`);
        const now = new Date().toISOString();

        const application = await patronRepo.createApplication({
            ...(body || {}),
            id: applicationId,
            userId: viewer.id,
            firebaseUid: viewer.firebaseUid,
            email: viewer.email,
            name: fullName,
            fullName,
            username: viewer.username,
            regionId,
            region: clampText(body.region || body.regionName || 'YH Plaza', 160),
            continent: clampText(body.continent || '', 120),
            network: clampText(body.network || '', 160),
            preferredRole,
            baseCity: clampText(body.baseCity || body.city, 100),
            country: clampText(body.country || '', 100),
            communicationHandle: clampText(body.communicationHandle || body.telegram || body.contact, 160),
            leadershipExperience,
            plazaPlan,
            meetupPlan,
            proofLink: clampText(body.proofLink || body.profileLink || body.portfolio, 260),
            whyYou,
            reason: whyYou,
            status: 'pending_review',
            reviewStatus: 'pending_review',
            applicationType: 'plaza-patron-leader',
            reviewLane: 'Plaza Patron / Leader',
            source: 'Plaza Patron Application',
            createdAt: existing?.createdAt || now,
            updatedAt: now
        });

        return res.status(existing ? 200 : 201).json({
            success: true,
            source: 'supabase',
            hasApplication: true,
            status: 'Under Review',
            application
        });
    } catch (error) {
        console.error('plazaPatronSupabaseLite.submitPatronApplication error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to submit Patron application.'
        });
    }
};

exports.getPatronDesk = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const application = await patronRepo.getApplicationForUser(viewer);
        const status = normalizePatronStatus(application);
        const isPatron = cleanStatus(status) === 'approved';

        const [
            regions,
            requests,
            meetups,
            announcements,
            recommendations,
            introOutcomes,
            payouts
        ] = await Promise.all([
            loadRegions(),
            loadRequests(),
            loadMeetups(),
            patronRepo.listAnnouncements(250),
            patronRepo.listRecommendations(250),
            patronRepo.listIntroOutcomes(250),
            patronRepo.listPayouts(250)
        ]);

        const routedRequests = requests.filter((item) => {
            return userMatches(item, viewer) || sanitizeText(item.raw?.patronUserId) === viewer.id;
        });

        const patronMeetups = meetups.filter((item) => {
            return [
                item.hostId,
                item.hostFirebaseUid,
                item.raw?.officialPatronUserId,
                item.raw?.patronUserId
            ].map(sanitizeText).includes(viewer.id);
        });

        const myRecommendations = recommendations.filter((item) => userMatches(item, viewer));
        const myOutcomes = introOutcomes.filter((item) => userMatches(item, viewer));
        const myPayouts = payouts.filter((item) => userMatches(item, viewer));

        return res.json({
            success: true,
            source: 'supabase',
            isPatron,
            patron: isPatron ? application : null,
            application,
            status,
            regions,
            routedRequests,
            meetups: patronMeetups,
            announcements,
            recommendations: myRecommendations,
            introOutcomes: myOutcomes,
            payouts: myPayouts,
            walletPayouts: myPayouts,
            message: isPatron
                ? ''
                : 'Patron Desk unlocks after admin approves your Plaza Patron application.'
        });
    } catch (error) {
        console.error('plazaPatronSupabaseLite.getPatronDesk error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Patron desk.'
        });
    }
};

exports.createPatronAnnouncement = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const title = clampText(req.body?.title || req.body?.subject, 180);
        const body = clampText(req.body?.body || req.body?.message || req.body?.description, 2000);

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: 'Announcement title and body are required.'
            });
        }

        const announcement = await patronRepo.createAnnouncement({
            title,
            body,
            summary: clampText(req.body?.summary || body, 600),
            region: clampText(req.body?.region || 'Global', 120),
            category: clampText(req.body?.category || 'announcement', 120),
            authorId: viewer.id,
            authorName: viewer.name,
            authorEmail: viewer.email,
            status: 'active',
            reviewStatus: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return res.status(201).json({
            success: true,
            source: 'supabase',
            announcement
        });
    } catch (error) {
        console.error('plazaPatronSupabaseLite.createPatronAnnouncement error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Patron announcement.'
        });
    }
};

exports.updatePatronRoutedRequestStatus = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const requestId = sanitizeText(req.params?.id);
        const status = sanitizeText(req.body?.status || req.body?.nextStatus || 'open');

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request id is required.'
            });
        }

        const request = await requestsRepo.updateRequest(requestId, {
            status,
            patronStatus: status,
            patronUpdatedBy: viewer.id,
            patronUpdatedByName: viewer.name,
            patronUpdatedAt: new Date().toISOString()
        });

        return res.json({
            success: true,
            source: 'supabase',
            request
        });
    } catch (error) {
        console.error('plazaPatronSupabaseLite.updatePatronRoutedRequestStatus error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to update routed request status.'
        });
    }
};

exports.createPatronFederationRecommendation = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const memberId = sanitizeText(req.body?.memberId || req.body?.targetUserId || req.body?.recommendedUserId);
        const memberName = clampText(req.body?.memberName || req.body?.targetUserName || 'Recommended member', 160);
        const reason = clampText(req.body?.reason || req.body?.body || req.body?.description, 1600);

        if (!memberId || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Member and reason are required.'
            });
        }

        const recommendation = await patronRepo.createRecommendation({
            title: `Federation recommendation: ${memberName}`,
            body: reason,
            requesterId: viewer.id,
            targetUserId: memberId,
            recommendedUserId: memberId,
            memberId,
            memberName,
            recommendedRole: clampText(req.body?.recommendedRole || req.body?.role || 'Federation candidate', 160),
            proofLink: clampText(req.body?.proofLink || '', 260),
            regionId: sanitizeText(req.body?.regionId || ''),
            region: clampText(req.body?.region || 'Global', 120),
            patronId: viewer.id,
            patronName: viewer.name,
            status: 'pending_admin_review',
            reviewStatus: 'pending_admin_review',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return res.status(201).json({
            success: true,
            source: 'supabase',
            recommendation
        });
    } catch (error) {
        console.error('plazaPatronSupabaseLite.createPatronFederationRecommendation error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Federation recommendation.'
        });
    }
};

exports.createPatronIntroOutcome = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const introTitle = clampText(req.body?.introTitle || req.body?.title, 180);
        const introSummary = clampText(req.body?.introSummary || req.body?.summary || req.body?.description, 1600);

        if (!introTitle || !introSummary) {
            return res.status(400).json({
                success: false,
                message: 'Intro title and summary are required.'
            });
        }

        const grossAmount = Math.max(0, Number(req.body?.grossAmount || req.body?.dealValue || 0));
        const currency = sanitizeText(req.body?.currency || 'USD').toUpperCase() || 'USD';
        const commissionRate = Math.max(5, Math.min(15, Number(req.body?.commissionRate || 10)));
        const commissionAmount = Math.round((grossAmount * (commissionRate / 100)) * 100) / 100;

        const outcome = await patronRepo.createIntroOutcome({
            title: introTitle,
            outcome: introSummary,
            body: introSummary,
            recommendationId: sanitizeText(req.body?.recommendationId || req.body?.introId || ''),
            requesterId: viewer.id,
            targetUserId: sanitizeText(req.body?.targetUserId || ''),
            patronId: viewer.id,
            patronName: viewer.name,
            connectedParties: safeArray(req.body?.connectedParties),
            grossAmount,
            currency,
            commissionRate,
            commissionAmount,
            regionId: sanitizeText(req.body?.regionId || ''),
            region: clampText(req.body?.region || 'Global', 120),
            status: 'pending_admin_review',
            reviewStatus: 'pending_admin_review',
            payoutStatus: grossAmount > 0 ? 'eligible_pending_admin_review' : 'no_monetary_value_logged',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        let payout = null;

        if (commissionAmount > 0) {
            payout = await patronRepo.createPayout({
                patronId: viewer.id,
                patronName: viewer.name,
                patronEmail: viewer.email,
                amount: commissionAmount,
                currency,
                note: `Commission eligibility from intro outcome: ${introTitle}`,
                status: 'pending_admin_review',
                reviewStatus: 'pending_admin_review',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        return res.status(201).json({
            success: true,
            source: 'supabase',
            outcome,
            payout
        });
    } catch (error) {
        console.error('plazaPatronSupabaseLite.createPatronIntroOutcome error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Patron intro outcome.'
        });
    }
};
