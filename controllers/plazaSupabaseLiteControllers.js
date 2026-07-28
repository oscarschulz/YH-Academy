const plazaRecordsRepo = require('../backend/repositories/plazaRecordsSupabaseRepo');
const plazaEventLedgerRepo = require('../backend/repositories/plazaEventLedgerSupabaseRepo');
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
    if (
        clean === 'intro' ||
        clean === 'introduction'
    ) {
        return 'introduction';
    }

    if (clean === 'resource') return 'resource';
    if (clean === 'win') return 'win';

    return 'update';
}

function getFeedTypeTag(type = '') {
    const clean = normalizeFeedType(type);

    if (clean === 'opportunity') return 'Opportunity';
    if (clean === 'project') return 'Project';
    if (clean === 'question') return 'Question';
    if (clean === 'introduction') return 'Introduction';
    if (clean === 'resource') return 'Resource';
    if (clean === 'win') return 'Win';

    return 'Update';
}

function normalizeOpportunityType(value = '') {
    const clean = sanitizeText(value)
        .toLowerCase();

    const allowed = new Map([
        ['opportunity', 'Opportunity'],
        ['job opportunity', 'Job Opportunity'],
        ['hire talent', 'Hire Talent'],
        ['get hired', 'Get Hired'],
        ['operator bounty', 'Operator Bounty'],
        ['hiring', 'Hiring'],
        ['collaboration', 'Collaboration'],
        ['partnership', 'Partnership'],
        ['introduction', 'Introduction'],
        ['service listing', 'Service Listing'],
        ['service request', 'Service Request'],
        ['project opening', 'Project Opening'],
        ['regional support', 'Regional Support'],
        ['request', 'Request'],
        ['gig', 'Gig']
    ]);

    return allowed.get(clean) ||
        'Opportunity';
}

function normalizeOpportunityEconomyMode(value = '') {
    const clean = sanitizeText(value).toLowerCase();

    if (['paid', 'commission', 'revenue_share', 'bounty', 'equity', 'barter', 'free', 'not_sure'].includes(clean)) {
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
        clean === 'academy_payout_signal' ||
        clean === 'federation_candidate' ||
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

    if (['custom_quote', 'fixed', 'hourly', 'package', 'commission', 'monthly', 'custom', 'not_sure'].includes(clean)) {
        return clean;
    }

    return '';
}

function normalizeOpportunityServiceProviderType(value = '') {
    const clean = sanitizeText(value).toLowerCase();

    if (['plaza_provider', 'academy_member', 'federation_member', 'agency_team', 'individual', 'team', 'agency', 'company', 'not_sure'].includes(clean)) {
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
            Math.max(
                parseInt(
                    req.query.limit,
                    10
                ) || 40,
                1
            ),
            100
        );

        const cursor = clampText(
            req.query.cursor,
            1200
        );

        const page =
            await plazaRecordsRepo
                .listFeed({
                    limit,
                    cursor
                });

        return res.json({
            success: true,
            source: 'supabase',
            feed: page.items,
            feedCount:
                page.items.length,
            hasMore:
                page.hasMore === true,
            nextCursor:
                page.nextCursor || '',
            fetchedAt:
                new Date().toISOString()
        });
    } catch (error) {
        console.error(
            'plazaSupabaseLite.getFeed error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to load Plaza feed.'
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

        const clientCreateId = clampText(
            req.body?.clientCreateId,
            180
        );

        if (!clientCreateId) {
            return res.status(400).json({
                success: false,
                message: 'Client create id is required.'
            });
        }

        const type = normalizeFeedType(
            req.body?.type ||
            req.body?.feedType
        );

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

        const titleInput = clampText(
            req.body?.title,
            120
        );

        const region = clampText(
            req.body?.region,
            80,
            'Global'
        ) || 'Global';

        const tag = getFeedTypeTag(type);
        const now = new Date().toISOString();

        const result =
            await plazaRecordsRepo
                .createFeedPost({
                    clientCreateId,
                    type,
                    member: viewer.name,
                    source: 'plaza',
                    division: 'both',
                    region,
                    title:
                        titleInput ||
                        tag,
                    text,
                    tag,
                    action:
                        type === 'opportunity'
                            ? 'Open Opportunity Detail'
                            : type === 'project'
                                ? 'Open Project Detail'
                                : 'Open',
                    authorId:
                        viewer.id,
                    authorFirebaseUid:
                        viewer.firebaseUid,
                    authorEmail:
                        viewer.email,
                    authorName:
                        viewer.name,
                    status:
                        'pending_review',
                    reviewStatus:
                        'pending_review',
                    createdAt:
                        now,
                    updatedAt:
                        now
                });

        const post = result.record;

        if (result.created === true) {
            await safeMirrorFeedPost({
                viewer,
                post
            });
        }

        return res.status(
            result.created === true
                ? 201
                : 200
        ).json({
            success: true,
            source: 'supabase',
            created:
                result.created === true,
            duplicate:
                result.duplicate === true,
            published: false,
            pendingReview: true,
            post
        });
    } catch (error) {
        console.error(
            'plazaSupabaseLite.createFeedPost error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to create Plaza feed post.'
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
            Math.max(
                parseInt(
                    req.query.limit,
                    10
                ) || 60,
                1
            ),
            120
        );

        const cursor = clampText(
            req.query.cursor,
            1200
        );

        const page =
            await plazaRecordsRepo
                .listOpportunities({
                    limit,
                    cursor
                });

        return res.json({
            success: true,
            source: 'supabase',
            opportunities:
                page.items,
            opportunityCount:
                page.items.length,
            hasMore:
                page.hasMore === true,
            nextCursor:
                page.nextCursor || '',
            fetchedAt:
                new Date().toISOString()
        });
    } catch (error) {
        console.error(
            'plazaSupabaseLite.getOpportunities error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to load Plaza opportunities.'
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

        const clientCreateId = clampText(
            req.body?.clientCreateId,
            180
        );

        if (!clientCreateId) {
            return res.status(400).json({
                success: false,
                message: 'Client create id is required.'
            });
        }

        const type = normalizeOpportunityType(
            req.body?.type
        );

        const title = clampText(
            req.body?.title,
            140
        );

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

        const region = clampText(
            req.body?.region,
            80,
            'Global'
        ) || 'Global';

        const economyMode =
            normalizeOpportunityEconomyMode(
                req.body?.economyMode ||
                req.body?.compensationType
            );

        const currency =
            normalizeOpportunityCurrency(
                req.body?.currency ||
                'USD'
            );

        const budgetMin =
            normalizeOpportunityMoney(
                req.body?.budgetMin
            );

        const budgetMax =
            normalizeOpportunityMoney(
                req.body?.budgetMax
            );

        const commissionRate = Math.max(
            0,
            Math.min(
                100,
                normalizeOpportunityMoney(
                    req.body?.commissionRate
                )
            )
        );

        const federationEscalation =
            normalizeOpportunityFederationEscalation(
                req.body?.federationEscalation
            );

        const monetizationNote = clampText(
            req.body?.monetizationNote,
            1000
        );

        const serviceCategory = clampText(
            req.body?.serviceCategory,
            120
        );

        const serviceTags =
            normalizeOpportunityServiceTags(
                req.body?.serviceTags
            );

        const servicePriceType =
            normalizeOpportunityServicePriceType(
                req.body?.servicePriceType
            );

        const serviceDeliveryTime = clampText(
            req.body?.serviceDeliveryTime,
            120
        );

        const serviceProviderType =
            normalizeOpportunityServiceProviderType(
                req.body?.serviceProviderType
            );

        const serviceRequirements = clampText(
            req.body?.serviceRequirements,
            1000
        );

        const serviceOutcome = clampText(
            req.body?.serviceOutcome,
            1000
        );

        const now = new Date().toISOString();

        const result =
            await plazaRecordsRepo
                .createOpportunity({
                    clientCreateId,
                    type,
                    region,
                    title,
                    text,
                    action:
                        type === 'Service Listing'
                            ? 'Request Service'
                            : 'Open Opportunity Detail',

                    economyMode,
                    currency,
                    budgetMin,
                    budgetMax,
                    commissionRate,
                    federationEscalation,
                    monetizationNote,

                    marketplaceMode:
                        type === 'Service Listing'
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

                    sourceDivision:
                        'plaza',

                    authorId:
                        viewer.id,
                    authorFirebaseUid:
                        viewer.firebaseUid,
                    authorEmail:
                        viewer.email,
                    authorName:
                        viewer.name,

                    status:
                        'pending_review',
                    reviewStatus:
                        'pending_review',
                    createdAt:
                        now,
                    updatedAt:
                        now
                });

        const opportunity =
            result.record;

        if (result.created === true) {
            await safeMirrorOpportunity({
                viewer,
                opportunity
            });
        }

        return res.status(
            result.created === true
                ? 201
                : 200
        ).json({
            success: true,
            source: 'supabase',
            created:
                result.created === true,
            duplicate:
                result.duplicate === true,
            published: false,
            pendingReview: true,
            opportunity
        });
    } catch (error) {
        console.error(
            'plazaSupabaseLite.createOpportunity error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to create Plaza opportunity.'
        });
    }
};

/* PATCH: PL-G1A1 Plaza Event Ledger read contract v1 */
exports.getMyReputationLedger = async (
    req,
    res
) => {
    try {
        const viewer =
            getViewerFromRequest(
                req
            );

        if (!viewer.id) {
            return res.status(
                401
            ).json({
                success: false,
                message:
                    'Missing authenticated user.'
            });
        }

        const limit =
            Math.min(
                Math.max(
                    parseInt(
                        req.query.limit,
                        10
                    ) || 50,
                    1
                ),
                200
            );

        const snapshot =
            await plazaEventLedgerRepo
                .getUserLedgerSnapshot(
                    viewer.id,
                    {
                        limit
                    }
                );

        return res.json({
            success: true,
            source: 'supabase',
            division: 'plaza',

            profile:
                snapshot.profile,

            reputation:
                snapshot.profile,

            events:
                snapshot.events,

            eventCount:
                snapshot.eventCount,

            fetchedAt:
                snapshot.fetchedAt
        });
    } catch (error) {
        console.error(
            'plazaSupabaseLite.getMyReputationLedger error:',
            error
        );

        return res.status(
            Number(
                error?.status ||
                error?.statusCode
            ) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to load Plaza reputation.'
        });
    }
};
/* END PATCH: PL-G1A1 Plaza Event Ledger read contract v1 */