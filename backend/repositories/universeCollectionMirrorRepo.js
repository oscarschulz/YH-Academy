const { collectionsFirestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

const INDEX_COLLECTION = 'yhUniverseCollectionIndex';
const FEDERATION_LEAD_INVENTORY_COLLECTION = 'yhFederationLeadInventory';

function cleanText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function cleanLower(value, fallback = '') {
    return cleanText(value, fallback).toLowerCase();
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value) {
    return value === true || cleanLower(value) === 'true';
}

function toIso(value) {
    if (!value) return '';
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return cleanText(value);
}

function nowTs() {
    return Timestamp.now();
}

function hasCollectionsDb() {
    return Boolean(collectionsFirestore);
}

function indexCol() {
    if (!collectionsFirestore) return null;
    return collectionsFirestore.collection(INDEX_COLLECTION);
}

function federationLeadInventoryCol() {
    if (!collectionsFirestore) return null;
    return collectionsFirestore.collection(FEDERATION_LEAD_INVENTORY_COLLECTION);
}

function normalizeDocId(value = '') {
    return cleanText(value)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 220);
}

function normalizeTags(values = []) {
    const source = Array.isArray(values) ? values : String(values || '').split(',');

    return Array.from(
        new Set(
            source
                .map((item) => cleanLower(item))
                .filter(Boolean)
                .map((item) => item.slice(0, 48))
        )
    ).slice(0, 16);
}

function buildCreatorSnapshot(user = {}, fallback = {}) {
    return {
        createdByUid: cleanText(
            user.id ||
            user.firebaseUid ||
            user.uid ||
            fallback.createdByUid ||
            fallback.operatorUid ||
            fallback.authorId ||
            ''
        ),
        createdByEmail: cleanLower(user.email || fallback.createdByEmail || fallback.authorEmail || ''),
        createdByName: cleanText(
            user.name ||
            user.fullName ||
            user.displayName ||
            user.username ||
            fallback.createdByName ||
            fallback.operatorName ||
            fallback.authorName ||
            'YH Member'
        ),
        createdByUsername: cleanText(user.username || fallback.createdByUsername || ''),
        createdByAvatar: cleanText(
            user.avatar ||
            user.profilePhoto ||
            user.photoURL ||
            fallback.createdByAvatar ||
            fallback.authorAvatar ||
            ''
        )
    };
}

function getAcademyLeadPublicTitle(lead = {}) {
    const role = cleanText(lead.contactRole || lead.contactType || '');
    const tier = cleanText(lead.tier || '');
    const city = cleanText(lead.city || '');
    const country = cleanText(lead.country || '');

    const location = [city, country].filter(Boolean).join(', ');

    if (role && location) return `${role} lead in ${location}`;
    if (role) return `${role} lead`;
    if (tier && location) return `${tier} Federation lead in ${location}`;
    if (location) return `Federation-ready lead in ${location}`;

    return 'Federation lead';
}

function getAcademyLeadVisibility(lead = {}) {
    const federationReady = toBool(lead.federationReady);
    const saleEnabled = toBool(lead.saleEnabled);
    const saleStatus = cleanLower(lead.saleStatus || lead.federationListingStatus || '');
    const saleReviewStatus = cleanLower(lead.saleReviewStatus || '');

    if (
        federationReady &&
        saleEnabled &&
        (saleStatus === 'listed' || saleStatus === 'approved') &&
        (saleReviewStatus === 'approved' || saleReviewStatus === 'listed')
    ) {
        return 'federation_members';
    }

    return 'admin_only';
}

function getAcademyLeadReviewStatus(lead = {}) {
    const reviewStatus = cleanLower(lead.reviewStatus || '');
    const saleReviewStatus = cleanLower(lead.saleReviewStatus || '');

    if (reviewStatus === 'approved' || saleReviewStatus === 'approved') return 'approved';
    if (reviewStatus === 'rejected' || saleReviewStatus === 'rejected') return 'rejected';
    if (reviewStatus === 'revision_requested') return 'revision_requested';

    return 'pending_review';
}

async function safeSet(ref, payload = {}, label = 'mirror') {
    if (!ref) {
        return {
            success: false,
            skipped: true,
            reason: 'collections_firestore_not_configured'
        };
    }

    try {
        await ref.set(payload, { merge: true });
        return {
            success: true,
            skipped: false
        };
    } catch (error) {
        console.error(`${label} mirror error:`, error);
        return {
            success: false,
            skipped: false,
            message: error?.message || 'Mirror write failed.'
        };
    }
}

async function writeIndexRecord(input = {}) {
    const col = indexCol();

    if (!col) {
        return {
            success: false,
            skipped: true,
            reason: 'collections_firestore_not_configured'
        };
    }

    const sourceDivision = cleanLower(input.sourceDivision || 'universe') || 'universe';
    const itemType = cleanLower(input.itemType || 'input') || 'input';
    const sourceFeature = cleanLower(input.sourceFeature || 'general') || 'general';
    const sourceRecordId = cleanText(input.sourceRecordId || input.id || '');
    const indexId = normalizeDocId(
        input.indexId ||
        `${sourceDivision}_${sourceFeature}_${sourceRecordId || Date.now()}`
    );

    const now = nowTs();

    const payload = {
        id: indexId,
        itemType,
        title: cleanText(input.title || 'YH Universe input').slice(0, 180),
        summary: cleanText(input.summary || input.description || '').slice(0, 1800),

        sourceDivision,
        targetDivision: cleanLower(input.targetDivision || input.accessLevel || sourceDivision),
        sourceFeature,
        sourceSystem: cleanText(input.sourceSystem || `${sourceDivision}_${sourceFeature}`),
        sourceRecordId,
        sourceRecordPath: cleanText(input.sourceRecordPath || ''),

        accessLevel: cleanLower(input.accessLevel || sourceDivision),
        visibility: cleanLower(input.visibility || 'admin_only'),
        reviewStatus: cleanLower(input.reviewStatus || 'pending_review'),
        listingStatus: cleanLower(input.listingStatus || ''),

        category: cleanText(input.category || ''),
        tags: normalizeTags(input.tags),

        createdByUid: cleanText(input.createdByUid || ''),
        createdByEmail: cleanLower(input.createdByEmail || ''),
        createdByName: cleanText(input.createdByName || 'YH Member'),
        createdByUsername: cleanText(input.createdByUsername || ''),
        createdByAvatar: cleanText(input.createdByAvatar || ''),

        mirrorTargetCollection: cleanText(input.mirrorTargetCollection || ''),
        mirrorTargetId: cleanText(input.mirrorTargetId || ''),

        publicMeta: input.publicMeta && typeof input.publicMeta === 'object'
            ? input.publicMeta
            : {},

        privateMetaAvailable: input.privateMetaAvailable === true,
        monetized: input.monetized === true,

        createdAt: input.createdAt || now,
        updatedAt: now,
        lastMirroredAt: now
    };

    return safeSet(col.doc(indexId), payload, 'universe collection index');
}

async function mirrorAcademyLead(input = {}) {
    if (!hasCollectionsDb()) {
        return {
            success: false,
            skipped: true,
            reason: 'collections_firestore_not_configured'
        };
    }

    const lead = input.lead || {};
    const operatorUid = cleanText(input.operatorUid || lead.operatorUid || lead.createdByUid || '');
    const leadId = cleanText(lead.id || input.leadId || '');

    if (!operatorUid || !leadId) {
        return {
            success: false,
            skipped: true,
            reason: 'missing_operator_or_lead_id'
        };
    }

    const mirrorId = normalizeDocId(`academy_${operatorUid}_${leadId}`);
    const creator = buildCreatorSnapshot(input.operator || {}, {
        createdByUid: operatorUid,
        operatorUid,
        operatorName: input.operatorName || lead.operatorName || input.operator?.name
    });

    const visibility = getAcademyLeadVisibility(lead);
    const reviewStatus = getAcademyLeadReviewStatus(lead);
    const listingStatus = cleanLower(
        lead.saleStatus ||
        lead.federationListingStatus ||
        (visibility === 'federation_members' ? 'listed' : 'pending_review')
    );

    const sellerPriceAmount = toNumber(lead.sellerPriceAmount, 0);
    const buyerPriceAmount = toNumber(lead.buyerPriceAmount, sellerPriceAmount);
    const currency = cleanText(lead.currency || 'USD').toUpperCase() || 'USD';

    const title = getAcademyLeadPublicTitle(lead);
    const location = [cleanText(lead.city), cleanText(lead.country)].filter(Boolean).join(', ');

    const publicListing = {
        title,
        summary: cleanText(
            lead.publicSummary ||
            lead.summary ||
            lead.notes ||
            lead.nextAction ||
            'Academy operator-submitted lead for possible Federation access.'
        ).slice(0, 700),
        tier: cleanText(lead.tier),
        contactRole: cleanText(lead.contactRole),
        contactType: cleanText(lead.contactType || 'unknown'),
        industry: cleanText(lead.industry || lead.category || ''),
        city: cleanText(lead.city),
        country: cleanText(lead.country),
        location,
        strategicValue: cleanText(lead.strategicValue || 'standard'),
        priority: cleanText(lead.priority),
        pipelineStage: cleanText(lead.pipelineStage),
        sourceMethod: cleanText(lead.sourceMethod),
        channel: cleanText(lead.channel),
        hasEmail: Boolean(cleanText(lead.email)),
        hasPhone: Boolean(cleanText(lead.phone)),
        hasContactName: Boolean(cleanText(lead.contactName)),
        companyLabel: cleanText(lead.companyName) ? 'Company on file' : '',
        buyerPriceAmount,
        sellerPriceAmount,
        universeCommissionRate: toNumber(lead.universeCommissionRate, 0),
        universeCommissionAmount: toNumber(lead.universeCommissionAmount, 0),
        currency
    };

    const lockedDetails = {
        companyName: cleanText(lead.companyName),
        companyWebsite: cleanText(lead.companyWebsite),
        contactName: cleanText(lead.contactName),
        contactRole: cleanText(lead.contactRole),
        contactType: cleanText(lead.contactType),
        email: cleanLower(lead.email),
        phone: cleanText(lead.phone),
        city: cleanText(lead.city),
        country: cleanText(lead.country),
        notes: cleanText(lead.notes),
        callOutcome: cleanText(lead.callOutcome),
        interestLevel: cleanText(lead.interestLevel),
        rapportLevel: cleanText(lead.rapportLevel),
        objection: cleanText(lead.objection),
        nextAction: cleanText(lead.nextAction),
        followUpDueDate: cleanText(lead.followUpDueDate)
    };

    const now = nowTs();

    const inventoryPayload = {
        id: mirrorId,
        leadInventoryType: 'federation_paid_lead',
        itemType: 'lead',

        title,
        summary: publicListing.summary,

        sourceDivision: 'academy',
        targetDivision: 'federation',
        sourceFeature: 'lead_missions',
        sourceSystem: 'academy_lead_missions',
        sourceDatabase: 'current',
        sourceRecordId: leadId,
        sourceRecordPath: `users/${operatorUid}/academyLeadMissions/${leadId}`,

        operatorUid,
        operatorName: creator.createdByName,
        operatorEmail: creator.createdByEmail,

        accessLevel: 'federation',
        visibility,
        reviewStatus,
        listingStatus,
        saleStatus: cleanLower(lead.saleStatus || ''),
        saleReviewStatus: cleanLower(lead.saleReviewStatus || ''),

        federationReady: toBool(lead.federationReady),
        plazaReady: toBool(lead.plazaReady),
        saleEnabled: toBool(lead.saleEnabled) || buyerPriceAmount > 0,

        publicListing,
        lockedDetails,

        pricing: {
            sellerPriceAmount,
            buyerPriceAmount,
            universeCommissionRate: toNumber(lead.universeCommissionRate, 0),
            universeCommissionAmount: toNumber(lead.universeCommissionAmount, 0),
            currency
        },

        payout: {
            operatorPayoutAmount: toNumber(lead.operatorPayoutAmount, 0),
            earningLedgerId: cleanText(lead.earningLedgerId),
            earningStatus: cleanText(lead.earningStatus),
            payoutStatus: cleanText(lead.payoutStatus || '')
        },

        createdByUid: creator.createdByUid,
        createdByEmail: creator.createdByEmail,
        createdByName: creator.createdByName,
        createdByUsername: creator.createdByUsername,
        createdByAvatar: creator.createdByAvatar,

        mirrorStatus: 'synced',
        mirrorAction: cleanText(input.action || 'synced'),
        sourceCreatedAt: toIso(lead.createdAt),
        sourceUpdatedAt: toIso(lead.updatedAt),
        createdAt: lead.createdAt || now,
        updatedAt: now,
        lastMirroredAt: now
    };

    const inventoryResult = await safeSet(
        federationLeadInventoryCol().doc(mirrorId),
        inventoryPayload,
        'federation lead inventory'
    );

    const indexResult = await writeIndexRecord({
        indexId: mirrorId,
        itemType: 'lead',
        title,
        summary: publicListing.summary,
        sourceDivision: 'academy',
        targetDivision: 'federation',
        sourceFeature: 'lead_missions',
        sourceSystem: 'academy_lead_missions',
        sourceRecordId: leadId,
        sourceRecordPath: `users/${operatorUid}/academyLeadMissions/${leadId}`,
        accessLevel: 'federation',
        visibility,
        reviewStatus,
        listingStatus,
        category: 'Federation Lead Marketplace',
        tags: normalizeTags([
            'lead',
            'federation',
            cleanText(lead.tier),
            cleanText(lead.contactRole),
            cleanText(lead.city),
            cleanText(lead.country),
            cleanText(lead.strategicValue)
        ]),
        createdByUid: creator.createdByUid,
        createdByEmail: creator.createdByEmail,
        createdByName: creator.createdByName,
        createdByUsername: creator.createdByUsername,
        createdByAvatar: creator.createdByAvatar,
        mirrorTargetCollection: FEDERATION_LEAD_INVENTORY_COLLECTION,
        mirrorTargetId: mirrorId,
        publicMeta: publicListing,
        privateMetaAvailable: true,
        monetized: toBool(lead.saleEnabled) || buyerPriceAmount > 0,
        createdAt: lead.createdAt || now
    });

    return {
        success: inventoryResult.success || indexResult.success,
        inventoryResult,
        indexResult,
        mirrorId
    };
}

async function mirrorPlazaFeedPost(input = {}) {
    const post = input.post || {};
    const viewer = input.viewer || {};

    const postId = cleanText(post.id || input.postId || '');
    if (!postId) {
        return {
            success: false,
            skipped: true,
            reason: 'missing_plaza_feed_post_id'
        };
    }

    const creator = buildCreatorSnapshot(viewer, post);
    const indexId = normalizeDocId(`plaza_feed_${postId}`);

    return writeIndexRecord({
        indexId,
        itemType: 'plaza_feed_post',
        title: cleanText(post.title || post.tag || 'Plaza feed post'),
        summary: cleanText(post.text || post.body || ''),
        sourceDivision: 'plaza',
        targetDivision: 'plaza',
        sourceFeature: 'feed',
        sourceSystem: 'plaza_feed',
        sourceRecordId: postId,
        sourceRecordPath: `plazaFeedPosts/${postId}`,
        accessLevel: 'plaza',
        visibility: 'admin_only',
        reviewStatus: cleanLower(post.reviewStatus || post.status || 'pending_review'),
        listingStatus: cleanLower(post.status || 'pending_review'),
        category: cleanText(post.tag || post.type || 'Plaza Feed'),
        tags: normalizeTags(['plaza', 'feed', post.type, post.region, post.tag]),
        ...creator,
        mirrorTargetCollection: '',
        mirrorTargetId: '',
        publicMeta: {
            type: cleanText(post.type),
            region: cleanText(post.region),
            action: cleanText(post.action)
        },
        privateMetaAvailable: false,
        monetized: false,
        createdAt: post.createdAt || nowTs()
    });
}

async function mirrorPlazaOpportunity(input = {}) {
    const opportunity = input.opportunity || {};
    const viewer = input.viewer || {};

    const opportunityId = cleanText(opportunity.id || input.opportunityId || '');
    if (!opportunityId) {
        return {
            success: false,
            skipped: true,
            reason: 'missing_plaza_opportunity_id'
        };
    }

    const creator = buildCreatorSnapshot(viewer, opportunity);
    const indexId = normalizeDocId(`plaza_opportunity_${opportunityId}`);
    const economyMode = cleanLower(opportunity.economyMode || 'not_sure');
    const monetized = !['free', 'not_sure', ''].includes(economyMode);

    return writeIndexRecord({
        indexId,
        itemType: 'opportunity',
        title: cleanText(opportunity.title || 'Plaza opportunity'),
        summary: cleanText(opportunity.text || opportunity.description || ''),
        sourceDivision: 'plaza',
        targetDivision: cleanLower(opportunity.federationEscalation || '') === 'federation_paid_intro'
            ? 'federation'
            : 'plaza',
        sourceFeature: 'opportunities',
        sourceSystem: 'plaza_opportunities',
        sourceRecordId: opportunityId,
        sourceRecordPath: `plazaOpportunities/${opportunityId}`,
        accessLevel: cleanLower(opportunity.federationEscalation || '') === 'federation_paid_intro'
            ? 'federation'
            : 'plaza',
        visibility: 'admin_only',
        reviewStatus: cleanLower(opportunity.reviewStatus || opportunity.status || 'pending_review'),
        listingStatus: cleanLower(opportunity.status || 'pending_review'),
        category: cleanText(opportunity.type || 'Plaza Opportunity'),
        tags: normalizeTags([
            'plaza',
            'opportunity',
            opportunity.type,
            opportunity.region,
            opportunity.economyMode,
            opportunity.federationEscalation
        ]),
        ...creator,
        mirrorTargetCollection: '',
        mirrorTargetId: '',
        publicMeta: {
            type: cleanText(opportunity.type),
            region: cleanText(opportunity.region),
            economyMode,
            currency: cleanText(opportunity.currency || 'USD').toUpperCase(),
            budgetMin: toNumber(opportunity.budgetMin, 0),
            budgetMax: toNumber(opportunity.budgetMax, 0),
            commissionRate: toNumber(opportunity.commissionRate, 0),
            federationEscalation: cleanText(opportunity.federationEscalation),
            marketplaceMode: cleanText(opportunity.marketplaceMode)
        },
        privateMetaAvailable: false,
        monetized,
        createdAt: opportunity.createdAt || nowTs()
    });
}

module.exports = {
    hasCollectionsDb,
    writeIndexRecord,
    mirrorAcademyLead,
    mirrorPlazaFeedPost,
    mirrorPlazaOpportunity
};