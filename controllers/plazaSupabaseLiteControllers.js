const plazaRecordsRepo = require('../backend/repositories/plazaRecordsSupabaseRepo');
const universeCollectionMirrorRepo = require('../backend/repositories/universeCollectionMirrorRepo');

function sanitizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function clampText(value, limit = 1000, fallback = '') {
    const clean = sanitizeText(value, fallback);
    return clean.slice(0, Math.max(1, Number(limit || 1000)));
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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

function normalizeFeedType(value = '') {
    const clean = sanitizeText(value).toLowerCase();

    if (clean === 'opportunity') return 'opportunity';
    if (clean === 'project') return 'project';
    if (clean === 'question') return 'question';
    if (clean === 'intro') return 'intro';
    if (clean === 'resource') return 'resource';

    return 'update';
}

function getFeedTypeTag(type = '') {
    const clean = normalizeFeedType(type);

    if (clean === 'opportunity') return 'Opportunity';
    if (clean === 'project') return 'Project';
    if (clean === 'question') return 'Question';
    if (clean === 'intro') return 'Intro';
    if (clean === 'resource') return 'Resource';

    return 'Update';
}

function normalizeOpportunityType(value = '') {
    const clean = sanitizeText(value);

    const allowed = [
        'Opportunity',
        'Service Listing',
        'Collaboration',
        'Request',
        'Gig',
        'Partnership'
    ];

    return allowed.includes(clean) ? clean : 'Opportunity';
}

function normalizeOpportunityEconomyMode(value = '') {
    const clean = sanitizeText(value).toLowerCase();

    if (['paid', 'commission', 'revenue_share', 'barter', 'free', 'not_sure'].includes(clean)) {
        return clean;
    }

    return 'not_sure';
}

function normalizeOpportunityCurrency(value = '') {
    const clean = sanitizeText(value || 'USD').toUpperCase();
    return clean.slice(0, 6) || 'USD';
}

function normalizeOpportunityMoney(value) {
    const amount = toNumber(value, 0);
    return amount < 0 ? 0 : amount;
}

function normalizeOpportunityFederationEscalation(value = '') {
    const clean = sanitizeText(value).toLowerCase();

    if (
        clean === 'federation_paid_intro' ||
        clean === 'federation_review' ||
        clean === 'none'
    ) {
        return clean;
    }

    return 'none';
}

function normalizeOpportunityServiceTags(value = []) {
    const raw = Array.isArray(value)
        ? value
        : String(value || '').split(',');

    return Array.from(
        new Set(
            raw
                .map((item) => sanitizeText(item).toLowerCase())
                .filter(Boolean)
                .map((item) => item.slice(0, 48))
        )
    ).slice(0, 12);
}

function normalizeOpportunityServicePriceType(value = '') {
    const clean = sanitizeText(value).toLowerCase();

    if (['fixed', 'hourly', 'monthly', 'custom', 'not_sure'].includes(clean)) {
        return clean;
    }

    return '';
}

function normalizeOpportunityServiceProviderType(value = '') {
    const clean = sanitizeText(value).toLowerCase();

    if (['individual', 'team', 'agency', 'company', 'not_sure'].includes(clean)) {
        return clean;
    }

    return '';
}

async function safeMirrorFeedPost({ viewer, post }) {
    try {
        if (
            universeCollectionMirrorRepo &&
            typeof universeCollectionMirrorRepo.mirrorPlazaFeedPost === 'function'
        ) {
            await universeCollectionMirrorRepo.mirrorPlazaFeedPost({
                action: 'created',
                viewer,
                post
            });
        }
    } catch (error) {
        console.warn('Plaza feed Supabase mirror skipped:', error?.message || error);
    }
}

async function safeMirrorOpportunity({ viewer, opportunity }) {
    try {
        if (
            universeCollectionMirrorRepo &&
            typeof universeCollectionMirrorRepo.mirrorPlazaOpportunity === 'function'
        ) {
            await universeCollectionMirrorRepo.mirrorPlazaOpportunity({
                action: 'created',
                viewer,
                opportunity
            });
        }
    } catch (error) {
        console.warn('Plaza opportunity Supabase mirror skipped:', error?.message || error);
    }
}

exports.getFeed = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 40, 1),
            100
        );

        const feed = await plazaRecordsRepo.listFeed(limit);

        return res.json({
            success: true,
            source: 'supabase',
            feed
        });
    } catch (error) {
        console.error('plazaSupabaseLite.getFeed error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Plaza feed.'
        });
    }
};

exports.createFeedPost = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const type = normalizeFeedType(req.body?.type || req.body?.feedType);
        const text = clampText(
            req.body?.text ||
            req.body?.body ||
            req.body?.content,
            1200
        );

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Feed text is required.'
            });
        }

        const titleInput = clampText(req.body?.title, 120);
        const region = clampText(req.body?.region, 80, 'Global') || 'Global';
        const tag = getFeedTypeTag(type);
        const now = new Date().toISOString();

        const post = await plazaRecordsRepo.createFeedPost({
            type,
            member: viewer.name,
            source: 'plaza',
            division: 'both',
            region,
            title: titleInput || tag,
            text,
            tag,
            action: type === 'opportunity'
                ? 'Open Opportunity Detail'
                : type === 'project'
                    ? 'Open Project Detail'
                    : 'Open',
            authorId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            status: 'pending_review',
            reviewStatus: 'pending_review',
            createdAt: now,
            updatedAt: now
        });

        await safeMirrorFeedPost({ viewer, post });

        return res.status(201).json({
            success: true,
            source: 'supabase',
            post
        });
    } catch (error) {
        console.error('plazaSupabaseLite.createFeedPost error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza feed post.'
        });
    }
};

exports.getOpportunities = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 60, 1),
            120
        );

        const opportunities = await plazaRecordsRepo.listOpportunities(limit);

        return res.json({
            success: true,
            source: 'supabase',
            opportunities
        });
    } catch (error) {
        console.error('plazaSupabaseLite.getOpportunities error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Plaza opportunities.'
        });
    }
};

exports.createOpportunity = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const type = normalizeOpportunityType(req.body?.type);
        const title = clampText(req.body?.title, 140);
        const text = clampText(
            req.body?.text ||
            req.body?.description ||
            req.body?.body,
            1600
        );

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Opportunity title is required.'
            });
        }

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Opportunity details are required.'
            });
        }

        const region = clampText(req.body?.region, 80, 'Global') || 'Global';
        const economyMode = normalizeOpportunityEconomyMode(
            req.body?.economyMode ||
            req.body?.compensationType
        );

        const currency = normalizeOpportunityCurrency(req.body?.currency || 'USD');
        const budgetMin = normalizeOpportunityMoney(req.body?.budgetMin);
        const budgetMax = normalizeOpportunityMoney(req.body?.budgetMax);
        const commissionRate = Math.max(0, Math.min(100, normalizeOpportunityMoney(req.body?.commissionRate)));
        const federationEscalation = normalizeOpportunityFederationEscalation(req.body?.federationEscalation);
        const monetizationNote = clampText(req.body?.monetizationNote, 1000);

        const serviceCategory = clampText(req.body?.serviceCategory, 120);
        const serviceTags = normalizeOpportunityServiceTags(req.body?.serviceTags);
        const servicePriceType = normalizeOpportunityServicePriceType(req.body?.servicePriceType);
        const serviceDeliveryTime = clampText(req.body?.serviceDeliveryTime, 120);
        const serviceProviderType = normalizeOpportunityServiceProviderType(req.body?.serviceProviderType);
        const serviceRequirements = clampText(req.body?.serviceRequirements, 1000);
        const serviceOutcome = clampText(req.body?.serviceOutcome, 1000);
        const now = new Date().toISOString();

        const opportunity = await plazaRecordsRepo.createOpportunity({
            type,
            region,
            title,
            text,
            action: type === 'Service Listing' ? 'Request Service' : 'Open Opportunity Detail',

            economyMode,
            currency,
            budgetMin,
            budgetMax,
            commissionRate,
            federationEscalation,
            monetizationNote,
            marketplaceMode: type === 'Service Listing'
                ? 'service_marketplace'
                : economyMode === 'free'
                    ? 'signal'
                    : 'marketplace',

            serviceCategory,
            serviceTags,
            servicePriceType,
            serviceDeliveryTime,
            serviceProviderType,
            serviceRequirements,
            serviceOutcome,

            sourceDivision: 'plaza',

            authorId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            status: 'pending_review',
            reviewStatus: 'pending_review',
            createdAt: now,
            updatedAt: now
        });

        await safeMirrorOpportunity({ viewer, opportunity });

        return res.status(201).json({
            success: true,
            source: 'supabase',
            opportunity
        });
    } catch (error) {
        console.error('plazaSupabaseLite.createOpportunity error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza opportunity.'
        });
    }
};
