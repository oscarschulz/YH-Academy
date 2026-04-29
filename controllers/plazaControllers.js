const { firestore } = require('../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');
const universeCollectionMirrorRepo = require('../backend/repositories/universeCollectionMirrorRepo');

const plazaFeedCol = firestore.collection('plazaFeedPosts');
const plazaOpportunitiesCol = firestore.collection('plazaOpportunities');
const plazaDirectoryCol = firestore.collection('plazaDirectoryProfiles');
const plazaRegionsCol = firestore.collection('plazaRegions');
const plazaBridgeCol = firestore.collection('plazaBridgePaths');
const plazaRequestsCol = firestore.collection('plazaRequests');
const plazaConversationsCol = firestore.collection('plazaConversations');
const YH_CANONICAL_PLAZA_VERSION = '2026-04-29-official-plazas-v1';

const YH_CANONICAL_PLAZA_REGIONS = [
    {
        id: 'yh-africa-plaza-1',
        continent: 'Africa',
        network: 'Africa Federation',
        plazaNumber: 1,
        region: 'Africa Plaza 1',
        label: 'Africa • Plaza 1',
        sourceUrl: 'https://www.younghustlers.net/plazas/africa-plaza',
        countries: ['Botswana', 'Mauritius', 'Namibia', 'Seychelles']
    },
    {
        id: 'yh-africa-plaza-2',
        continent: 'Africa',
        network: 'Africa Federation',
        plazaNumber: 2,
        region: 'Africa Plaza 2',
        label: 'Africa • Plaza 2',
        sourceUrl: 'https://www.younghustlers.net/plazas/africa-plaza',
        countries: ['Ghana', 'Morocco', 'Rwanda', 'Senegal', 'Zambia']
    },
    {
        id: 'yh-africa-plaza-3',
        continent: 'Africa',
        network: 'Africa Federation',
        plazaNumber: 3,
        region: 'Africa Plaza 3',
        label: 'Africa • Plaza 3',
        sourceUrl: 'https://www.younghustlers.net/plazas/africa-plaza',
        countries: ['Benin', 'Eswatini (Swaziland)', 'Gabon', 'Lesotho', 'Malawi', 'Tanzania', 'Tunisia']
    },
    {
        id: 'yh-africa-plaza-4',
        continent: 'Africa',
        network: 'Africa Federation',
        plazaNumber: 4,
        region: 'Africa Plaza 4',
        label: 'Africa • Plaza 4',
        sourceUrl: 'https://www.younghustlers.net/plazas/africa-plaza',
        countries: ['Algeria', "Côte d'Ivoire", 'Egypt', 'Ethiopia', 'Kenya', 'Liberia', 'Madagascar', 'Mozambique', 'Nigeria', 'South Africa', 'Uganda']
    },
    {
        id: 'yh-africa-plaza-5',
        continent: 'Africa',
        network: 'Africa Federation',
        plazaNumber: 5,
        region: 'Africa Plaza 5',
        label: 'Africa • Plaza 5',
        sourceUrl: 'https://www.younghustlers.net/plazas/africa-plaza',
        countries: ['Angola', 'Burkina Faso', 'Burundi', 'Cameroon', 'Central African Republic', 'Chad', 'Democratic Republic of the Congo', 'Eritrea', 'Libya', 'Mali', 'Niger', 'Somalia', 'South Sudan', 'Sudan', 'Zimbabwe']
    },

    {
        id: 'yh-asia-plaza-1',
        continent: 'Asia',
        network: 'Asian Network',
        plazaNumber: 1,
        region: 'Asia Plaza 1',
        label: 'Asia • Plaza 1',
        sourceUrl: 'https://www.younghustlers.net/plazas/asia-plaza',
        countries: ['Japan', 'Singapore', 'South Korea', 'Taiwan']
    },
    {
        id: 'yh-asia-plaza-2',
        continent: 'Asia',
        network: 'Asian Network',
        plazaNumber: 2,
        region: 'Asia Plaza 2',
        label: 'Asia • Plaza 2',
        sourceUrl: 'https://www.younghustlers.net/plazas/asia-plaza',
        countries: ['Bhutan', 'Brunei', 'Malaysia', 'Qatar', 'United Arab Emirates']
    },
    {
        id: 'yh-asia-plaza-3',
        continent: 'Asia',
        network: 'Asian Network',
        plazaNumber: 3,
        region: 'Asia Plaza 3',
        label: 'Asia • Plaza 3',
        sourceUrl: 'https://www.younghustlers.net/plazas/asia-plaza',
        countries: ['China', 'Georgia', 'Jordan', 'Kazakhstan', 'Kuwait', 'Oman', 'Saudi Arabia']
    },
    {
        id: 'yh-asia-plaza-4',
        continent: 'Asia',
        network: 'Asian Network',
        plazaNumber: 4,
        region: 'Asia Plaza 4',
        label: 'Asia • Plaza 4',
        sourceUrl: 'https://www.younghustlers.net/plazas/asia-plaza',
        countries: ['Armenia', 'Azerbaijan', 'Bahrain', 'Indonesia', 'Israel', 'Laos', 'Lebanon', 'Maldives', 'Nepal', 'Sri Lanka', 'Thailand', 'Uzbekistan', 'Vietnam']
    },
    {
        id: 'yh-asia-plaza-5',
        continent: 'Asia',
        network: 'Asian Network',
        plazaNumber: 5,
        region: 'Asia Plaza 5',
        label: 'Asia • Plaza 5',
        sourceUrl: 'https://www.younghustlers.net/plazas/asia-plaza',
        countries: ['Afghanistan', 'Bangladesh', 'Cambodia', 'India', 'Iran', 'Iraq', 'Myanmar (Burma)', 'North Korea', 'Pakistan', 'Palestine', 'Philippines', 'Syria', 'Tajikistan', 'Turkmenistan', 'Yemen']
    },

    {
        id: 'yh-latam-plaza-1',
        continent: 'South America',
        network: 'LATAM Network',
        plazaNumber: 1,
        region: 'LATAM Plaza 1',
        label: 'LATAM • Plaza 1',
        sourceUrl: 'https://www.younghustlers.net/plazas/south-america-plaza',
        countries: ['Chile', 'Uruguay', 'Costa Rica', 'Panamá', 'Cuba']
    },
    {
        id: 'yh-latam-plaza-2',
        continent: 'South America',
        network: 'LATAM Network',
        plazaNumber: 2,
        region: 'LATAM Plaza 2',
        label: 'LATAM • Plaza 2',
        sourceUrl: 'https://www.younghustlers.net/plazas/south-america-plaza',
        countries: ['Argentina', 'Belize', 'Brazil', 'Colombia', 'Dominican Republic', 'Ecuador', 'Guatemala', 'Mexico', 'Paraguay', 'Peru']
    },
    {
        id: 'yh-latam-plaza-3',
        continent: 'South America',
        network: 'LATAM Network',
        plazaNumber: 3,
        region: 'LATAM Plaza 3',
        label: 'LATAM • Plaza 3',
        sourceUrl: 'https://www.younghustlers.net/plazas/south-america-plaza',
        countries: ['Bolivia', 'El Salvador', 'Guyana', 'Haiti', 'Honduras', 'Nicaragua', 'Venezuela']
    },

    {
        id: 'yh-europe-plaza-1',
        continent: 'Europe',
        network: 'European Network',
        plazaNumber: 1,
        region: 'Europe Plaza 1',
        label: 'Europe • Plaza 1',
        sourceUrl: 'https://www.younghustlers.net/plazas/europe-plaza',
        countries: ['Austria', 'Denmark', 'Finland', 'Iceland', 'Ireland', 'Luxembourg', 'Norway', 'Switzerland']
    },
    {
        id: 'yh-europe-plaza-2',
        continent: 'Europe',
        network: 'European Network',
        plazaNumber: 2,
        region: 'Europe Plaza 2',
        label: 'Europe • Plaza 2',
        sourceUrl: 'https://www.younghustlers.net/plazas/europe-plaza',
        countries: ['Portugal', 'Slovenia', 'Sweden', 'Netherlands', 'Germany', 'Belgium']
    },
    {
        id: 'yh-europe-plaza-3',
        continent: 'Europe',
        network: 'European Network',
        plazaNumber: 3,
        region: 'Europe Plaza 3',
        label: 'Europe • Plaza 3',
        sourceUrl: 'https://www.younghustlers.net/plazas/europe-plaza',
        countries: ['Croatia', 'Czech Republic', 'Estonia', 'France', 'Hungary', 'Italy', 'Latvia', 'Lithuania', 'Poland', 'Slovakia', 'Spain', 'United Kingdom']
    },
    {
        id: 'yh-europe-plaza-4',
        continent: 'Europe',
        network: 'European Network',
        plazaNumber: 4,
        region: 'Europe Plaza 4',
        label: 'Europe • Plaza 4',
        sourceUrl: 'https://www.younghustlers.net/plazas/europe-plaza',
        countries: ['Albania', 'Bosnia and Herzegovina', 'Bulgaria', 'Cyprus', 'Greece', 'Montenegro', 'North Macedonia', 'Romania', 'Serbia', 'Turkey']
    },
    {
        id: 'yh-europe-plaza-5',
        continent: 'Europe',
        network: 'European Network',
        plazaNumber: 5,
        region: 'Europe Plaza 5',
        label: 'Europe • Plaza 5',
        sourceUrl: 'https://www.younghustlers.net/plazas/europe-plaza',
        countries: ['Belarus', 'Kosovo', 'Moldova', 'Russia', 'Ukraine']
    },

    {
        id: 'yh-north-america-plaza-1',
        continent: 'North America',
        network: 'North American Network',
        plazaNumber: 1,
        region: 'North America Plaza 1',
        label: 'North America • Plaza 1',
        sourceUrl: 'https://www.younghustlers.net/plazas/north-america-plaza',
        countries: ['United States of America']
    },
    {
        id: 'yh-north-america-plaza-2',
        continent: 'North America',
        network: 'North American Network',
        plazaNumber: 2,
        region: 'North America Plaza 2',
        label: 'North America • Plaza 2',
        sourceUrl: 'https://www.younghustlers.net/plazas/north-america-plaza',
        countries: ['Canada']
    },

    {
        id: 'yh-oceania-plaza-1',
        continent: 'Oceania',
        network: 'Oceanian Network',
        plazaNumber: 1,
        region: 'Oceania Plaza 1',
        label: 'Oceania • Plaza 1',
        sourceUrl: 'https://www.younghustlers.net/plazas/oceania-plaza',
        countries: ['Australia', 'New Zealand', 'Palau', 'Samoa', 'Tonga', 'Tuvalu']
    },
    {
        id: 'yh-oceania-plaza-2',
        continent: 'Oceania',
        network: 'Oceanian Network',
        plazaNumber: 2,
        region: 'Oceania Plaza 2',
        label: 'Oceania • Plaza 2',
        sourceUrl: 'https://www.younghustlers.net/plazas/oceania-plaza',
        countries: ['Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia', 'Nauru', 'Papua New Guinea', 'Solomon Islands', 'Vanuatu']
    }
];
function sanitizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function clampText(value, max = 500, fallback = '') {
    return sanitizeText(value, fallback).slice(0, max);
}
function normalizePlazaRegionCountries(value = []) {
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeText(item))
            .filter(Boolean)
            .slice(0, 80);
    }

    return sanitizeText(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 80);
}

function normalizePlazaRegionDocId(value = '') {
    return sanitizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 120);
}

function buildCanonicalPlazaRegionPayload(plaza = {}, sortOrder = 0, now = Timestamp.now()) {
    const countries = normalizePlazaRegionCountries(plaza.countries);
    const region = sanitizeText(plaza.region || 'YH Plaza');
    const network = sanitizeText(plaza.network || 'YH Regional Network');
    const continent = sanitizeText(plaza.continent || '');

    return {
        region,
        label: sanitizeText(plaza.label || region),
        text: `${network} regional hub covering ${countries.length} countries: ${countries.join(', ')}.`,
        count: countries.length,
        countryCount: countries.length,
        countries,
        continent,
        network,
        plazaNumber: Number(plaza.plazaNumber || 0),
        sourceUrl: sanitizeText(plaza.sourceUrl || ''),
        source: 'younghustlers.net/plazas',
        isCanonical: true,
        canonicalRegionId: sanitizeText(plaza.id || normalizePlazaRegionDocId(region)),
        canonicalDataVersion: YH_CANONICAL_PLAZA_VERSION,
        sortOrder: Number(sortOrder || 0),
        action: 'Enter Region Hub',
        status: 'active',
        authorId: 'system',
        authorFirebaseUid: 'system',
        authorEmail: '',
        authorName: 'YH Universe',
        createdAt: now,
        updatedAt: now
    };
}

async function ensureCanonicalPlazaRegionsSeeded() {
    const now = Timestamp.now();

    await Promise.all(
        YH_CANONICAL_PLAZA_REGIONS.map(async (plaza, index) => {
            const docId = normalizePlazaRegionDocId(plaza.id || plaza.region);
            if (!docId) return;

            const ref = plazaRegionsCol.doc(docId);
            const snap = await ref.get();
            const existing = snap.exists ? (snap.data() || {}) : {};
            const currentVersion = sanitizeText(existing.canonicalDataVersion);

            if (
                snap.exists &&
                currentVersion === YH_CANONICAL_PLAZA_VERSION &&
                sanitizeText(existing.status || 'active').toLowerCase() === 'active'
            ) {
                return;
            }

            const payload = buildCanonicalPlazaRegionPayload(plaza, index + 1, now);

            await ref.set({
                ...payload,
                createdAt: existing.createdAt || payload.createdAt,
                updatedAt: now
            }, { merge: true });
        })
    );
}
function getViewerFromRequest(req) {
    return {
        id: sanitizeText(req.user?.id || req.user?.firebaseUid || req.user?.uid),
        firebaseUid: sanitizeText(req.user?.firebaseUid || req.user?.id || req.user?.uid),
        email: sanitizeText(req.user?.email).toLowerCase(),
        username: sanitizeText(req.user?.username),
        name: sanitizeText(
            req.user?.name ||
            req.user?.fullName ||
            req.user?.displayName ||
            req.user?.username ||
            'Hustler'
        )
    };
}

function mapTimestamp(value) {
    if (!value) return '';
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return String(value || '');
}

function getPublicProfileAvatar(data = {}) {
    return sanitizeText(
        data.avatar ||
        data.profilePhoto ||
        data.photoURL ||
        data.academyAvatar ||
        data.profile_photo ||
        ''
    );
}

function getPublicProfileName(data = {}) {
    return sanitizeText(
        data.fullName ||
        data.displayName ||
        data.name ||
        data.username ||
        'Hustler'
    );
}

function getPlazaOwnerId(item = {}) {
    return sanitizeText(
        item.userId ||
        item.authorId ||
        item.authorFirebaseUid ||
        item.createdByUserId ||
        item.ownerUid ||
        ''
    );
}

async function hydratePlazaOwnerProfiles(items = []) {
    const safeItems = Array.isArray(items) ? items : [];

    const ownerIds = [
        ...new Set(
            safeItems
                .map((item) => getPlazaOwnerId(item))
                .filter(Boolean)
        )
    ];

    if (!ownerIds.length) return safeItems;

    const profileMap = new Map();

    await Promise.all(
        ownerIds.map(async (ownerId) => {
            try {
                const snap = await firestore.collection('users').doc(ownerId).get();
                if (!snap.exists) return;

                const data = snap.data() || {};
                const avatar = getPublicProfileAvatar(data);
                const name = getPublicProfileName(data);

                profileMap.set(ownerId, {
                    id: ownerId,
                    name,
                    avatar,
                    profilePhoto: avatar,
                    photoURL: avatar,
                    username: sanitizeText(data.username || '')
                });
            } catch (_) {}
        })
    );

    return safeItems.map((item) => {
        const ownerId = getPlazaOwnerId(item);
        const profile = profileMap.get(ownerId) || {};

        const avatar =
            sanitizeText(item.avatar) ||
            sanitizeText(item.authorAvatar) ||
            sanitizeText(item.profilePhoto) ||
            sanitizeText(item.photoURL) ||
            sanitizeText(profile.avatar);

        return {
            ...item,
            userId: sanitizeText(item.userId || ownerId),
            authorId: sanitizeText(item.authorId || ownerId),
            authorName: sanitizeText(item.authorName || item.name || profile.name || 'Hustler'),
            avatar,
            authorAvatar: avatar,
            profilePhoto: avatar,
            photoURL: avatar,
            username: sanitizeText(item.username || profile.username || '')
        };
    });
}

function normalizeFeedType(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'introduction' || raw === 'introductions' || raw === 'intro') return 'introduction';
    if (raw === 'opportunity' || raw === 'opportunities') return 'opportunity';
    if (raw === 'project' || raw === 'projects') return 'project';
    if (raw === 'win' || raw === 'wins') return 'win';

    return 'introduction';
}

function getFeedTypeTag(type = '') {
    const normalized = normalizeFeedType(type);

    if (normalized === 'opportunity') return 'Opportunity';
    if (normalized === 'project') return 'Project';
    if (normalized === 'win') return 'Win';

    return 'Introduction';
}

function mapPlazaFeedDoc(docSnap) {
    const data = docSnap.data() || {};
    const type = normalizeFeedType(data.type);

    return {
        id: docSnap.id,
        type,
        member: sanitizeText(data.member || data.authorName || 'Hustler'),
        source: sanitizeText(data.source || 'plaza'),
        division: sanitizeText(data.division || 'both'),
        region: sanitizeText(data.region || 'Global'),
        title: sanitizeText(data.title || 'Plaza update'),
        text: sanitizeText(data.text || data.body || ''),
        tag: sanitizeText(data.tag || getFeedTypeTag(type)),
        action: sanitizeText(data.action || 'Open'),
        userId: sanitizeText(data.userId || data.authorId || data.createdByUserId),
        authorId: sanitizeText(data.authorId || data.userId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || data.member || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        avatar: getPublicProfileAvatar(data),
        authorAvatar: getPublicProfileAvatar(data),
        profilePhoto: getPublicProfileAvatar(data),
        photoURL: getPublicProfileAvatar(data),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function normalizeOpportunityType(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'job' || raw === 'job opportunity' || raw === 'work opportunity') return 'Job Opportunity';
    if (raw === 'hire talent' || raw === 'hire' || raw === 'hiring request') return 'Hire Talent';
    if (raw === 'get hired' || raw === 'available for hire' || raw === 'talent listing') return 'Get Hired';
    if (raw === 'operator bounty' || raw === 'bounty') return 'Operator Bounty';
    if (raw === 'hiring') return 'Hiring';
    if (raw === 'collaboration') return 'Collaboration';
    if (raw === 'partnership') return 'Partnership';
    if (raw === 'introduction' || raw === 'intro') return 'Introduction';
    if (raw === 'service listing' || raw === 'service offer' || raw === 'offer service') return 'Service Listing';
    if (raw === 'service request' || raw === 'service') return 'Service Request';
    if (raw === 'project' || raw === 'project opening') return 'Project Opening';
    if (raw === 'regional' || raw === 'regional support') return 'Regional Support';

    return 'Opportunity';
}

function normalizeOpportunityMoney(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeOpportunityCurrency(value = 'USD') {
    return sanitizeText(value || 'USD').toUpperCase().slice(0, 8) || 'USD';
}

function normalizeOpportunityEconomyMode(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'free') return 'free';
    if (raw === 'paid') return 'paid';
    if (raw === 'commission') return 'commission';
    if (raw === 'revenue_share' || raw === 'revenue share') return 'revenue_share';
    if (raw === 'bounty') return 'bounty';
    if (raw === 'equity') return 'equity';

    return 'not_sure';
}
function normalizeOpportunityServiceTags(value = []) {
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeText(item))
            .filter(Boolean)
            .slice(0, 12);
    }

    return sanitizeText(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);
}

function normalizeOpportunityServicePriceType(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'fixed' || raw === 'fixed_price' || raw === 'fixed price') return 'fixed';
    if (raw === 'hourly' || raw === 'per_hour' || raw === 'per hour') return 'hourly';
    if (raw === 'package' || raw === 'packages') return 'package';
    if (raw === 'custom' || raw === 'quote' || raw === 'custom_quote') return 'custom_quote';
    if (raw === 'commission') return 'commission';

    return 'custom_quote';
}

function normalizeOpportunityServiceProviderType(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'academy' || raw === 'academy_member' || raw === 'academy member') return 'academy_member';
    if (raw === 'plaza' || raw === 'plaza_provider' || raw === 'plaza provider') return 'plaza_provider';
    if (raw === 'federation' || raw === 'federation_member' || raw === 'federation member') return 'federation_member';
    if (raw === 'agency' || raw === 'team') return 'agency_team';

    return 'plaza_provider';
}
function normalizeOpportunityFederationEscalation(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'federation_candidate') return 'federation_candidate';
    if (raw === 'federation_paid_intro') return 'federation_paid_intro';
    if (raw === 'academy_payout_signal') return 'academy_payout_signal';

    return 'none';
}

function mapPlazaOpportunityDoc(docSnap) {
    const data = docSnap.data() || {};
    const providerOptions = Array.isArray(data.paymentProviderOptions)
        ? data.paymentProviderOptions
        : Array.isArray(data.providerOptions)
            ? data.providerOptions
            : [];

    return {
        id: docSnap.id,
        type: normalizeOpportunityType(data.type),
        region: sanitizeText(data.region || 'Global'),
        title: sanitizeText(data.title || 'Plaza opportunity'),
        text: sanitizeText(data.text || data.description || ''),
        action: sanitizeText(data.action || 'Open Opportunity Detail'),

        economyMode: normalizeOpportunityEconomyMode(data.economyMode || data.compensationType),
        currency: normalizeOpportunityCurrency(data.currency),
        budgetMin: normalizeOpportunityMoney(data.budgetMin),
        budgetMax: normalizeOpportunityMoney(data.budgetMax),
        pricingAmount: normalizeOpportunityMoney(data.pricingAmount || data.amount || data.price),
        commissionRate: Math.max(0, Math.min(100, normalizeOpportunityMoney(data.commissionRate))),
        platformCommissionAmount: normalizeOpportunityMoney(data.platformCommissionAmount),
        operatorPayoutAmount: normalizeOpportunityMoney(data.operatorPayoutAmount),
        federationEscalation: normalizeOpportunityFederationEscalation(data.federationEscalation),
        monetizationNote: sanitizeText(data.monetizationNote || ''),
        marketplaceMode: sanitizeText(data.marketplaceMode || 'marketplace'),

        serviceCategory: sanitizeText(data.serviceCategory || ''),
        serviceTags: normalizeOpportunityServiceTags(data.serviceTags),
        servicePriceType: normalizeOpportunityServicePriceType(data.servicePriceType),
        serviceDeliveryTime: sanitizeText(data.serviceDeliveryTime || ''),
        serviceProviderType: normalizeOpportunityServiceProviderType(data.serviceProviderType),
        serviceRequirements: sanitizeText(data.serviceRequirements || ''),
        serviceOutcome: sanitizeText(data.serviceOutcome || ''),

        paymentLedgerId: sanitizeText(data.paymentLedgerId || ''),
        paymentLedgerStatus: sanitizeText(data.paymentLedgerStatus || ''),
        paymentStatus: sanitizeText(data.paymentStatus || ''),
        dealStatus: sanitizeText(data.dealStatus || ''),
        paymentProviderOptions: providerOptions,
        providerOptions,
        paidAt: mapTimestamp(data.paidAt),
        paymentLedgerUpdatedAt: mapTimestamp(data.paymentLedgerUpdatedAt),
        adminSettledAt: mapTimestamp(data.adminSettledAt),
        adminSettledBy: sanitizeText(data.adminSettledBy || ''),

        internalTransactionType: sanitizeText(data.internalTransactionType || ''),
        serviceProviderUid: sanitizeText(data.serviceProviderUid || data.ownerUid || data.authorId || ''),
        serviceSeekerUid: sanitizeText(data.serviceSeekerUid || ''),
        payoutUnlockRule: sanitizeText(data.payoutUnlockRule || ''),

        sourceDivision: sanitizeText(data.sourceDivision || 'plaza'),
        sourceLeadId: sanitizeText(data.sourceLeadId || ''),
        academySignalLabel: sanitizeText(data.academySignalLabel || ''),

        userId: sanitizeText(data.userId || data.authorId || data.createdByUserId || data.ownerUid),
        authorId: sanitizeText(data.authorId || data.userId || data.createdByUserId || data.ownerUid),
        authorName: sanitizeText(data.authorName || data.ownerName || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        avatar: getPublicProfileAvatar(data),
        authorAvatar: getPublicProfileAvatar(data),
        profilePhoto: getPublicProfileAvatar(data),
        photoURL: getPublicProfileAvatar(data),
        status: sanitizeText(data.status || 'active'),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function normalizeDirectoryDivision(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'academy' || raw === 'yha') return 'academy';
    if (raw === 'federation' || raw === 'yhf') return 'federation';
    if (raw === 'both' || raw === 'cross' || raw === 'plaza') return 'both';

    return 'academy';
}

function normalizeDirectoryTrust(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'connector' || raw === 'trusted connector') return 'connector';
    if (raw === 'leader' || raw === 'local leader') return 'leader';

    return 'verified';
}

function normalizeTags(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeText(item))
            .filter(Boolean)
            .slice(0, 12);
    }

    return sanitizeText(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);
}

function mapPlazaDirectoryDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        name: sanitizeText(data.name || data.authorName || 'Hustler'),
        region: sanitizeText(data.region || 'Global'),
        division: normalizeDirectoryDivision(data.division),
        source: sanitizeText(data.source || data.division || 'academy'),
        trust: normalizeDirectoryTrust(data.trust),
        role: sanitizeText(data.role || 'Member'),
        focus: sanitizeText(data.focus || ''),
        tags: normalizeTags(data.tags),
        lookingFor: normalizeTags(data.lookingFor || data.looking_for),
        canOffer: normalizeTags(data.canOffer || data.can_offer),
        availability: sanitizeText(data.availability || ''),
        workMode: sanitizeText(data.workMode || data.work_mode || ''),
        marketplaceMode: sanitizeText(data.marketplaceMode || data.marketplace_mode || 'no').toLowerCase() === 'yes' ? 'yes' : 'no',
        userId: sanitizeText(data.userId || data.authorId || docSnap.id),
        authorId: sanitizeText(data.authorId || data.userId || docSnap.id),
        authorName: sanitizeText(data.authorName || data.name || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        avatar: getPublicProfileAvatar(data),
        authorAvatar: getPublicProfileAvatar(data),
        profilePhoto: getPublicProfileAvatar(data),
        photoURL: getPublicProfileAvatar(data),
        status: sanitizeText(data.status || 'active'),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function mapPlazaRegionDoc(docSnap) {
    const data = docSnap.data() || {};
    const countries = normalizePlazaRegionCountries(data.countries);
    const count = Number.isFinite(Number(data.count))
        ? Number(data.count)
        : countries.length;

    return {
        id: docSnap.id,
        region: sanitizeText(data.region || data.name || 'Global'),
        count,
        countryCount: Number.isFinite(Number(data.countryCount))
            ? Number(data.countryCount)
            : countries.length,
        label: sanitizeText(data.label || 'Region Hub'),
        text: sanitizeText(data.text || data.description || ''),
        continent: sanitizeText(data.continent || ''),
        network: sanitizeText(data.network || ''),
        plazaNumber: Number.isFinite(Number(data.plazaNumber))
            ? Number(data.plazaNumber)
            : 0,
        countries,
        sourceUrl: sanitizeText(data.sourceUrl || data.source_url || ''),
        source: sanitizeText(data.source || ''),
        isCanonical: data.isCanonical === true,
        canonicalRegionId: sanitizeText(data.canonicalRegionId || ''),
        canonicalDataVersion: sanitizeText(data.canonicalDataVersion || ''),
        sortOrder: Number.isFinite(Number(data.sortOrder))
            ? Number(data.sortOrder)
            : 9999,
        action: sanitizeText(data.action || 'Enter Region Hub'),
        authorId: sanitizeText(data.authorId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        status: sanitizeText(data.status || 'active'),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function normalizeBridgeLane(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'academy' || raw === 'yha') return 'academy';
    if (raw === 'federation' || raw === 'yhf') return 'federation';
    if (raw === 'both' || raw === 'cross' || raw === 'plaza') return 'both';

    return 'academy';
}

function mapPlazaBridgeDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        stage: sanitizeText(data.stage || 'Bridge Path'),
        left: normalizeBridgeLane(data.left),
        right: normalizeBridgeLane(data.right || 'federation'),
        region: sanitizeText(data.region || 'Global'),
        title: sanitizeText(data.title || 'Bridge signal'),
        text: sanitizeText(data.text || data.description || ''),
        nextStep: sanitizeText(data.nextStep || 'Review and decide the next structured move.'),
        action: sanitizeText(data.action || 'Open Bridge Detail'),
        authorId: sanitizeText(data.authorId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        status: sanitizeText(data.status || 'active'),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function normalizeRequestStatus(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'draft') return 'Draft';
    if (raw === 'under review' || raw === 'review') return 'Under Review';
    if (raw === 'matched') return 'Matched';
    if (raw === 'conversation opened' || raw === 'conversation') return 'Conversation Opened';
    if (raw === 'closed') return 'Closed';

    return 'Submitted';
}

function normalizeRequestObjective(value = '') {
    const clean = sanitizeText(value);

    const allowed = new Set([
        'Connection request',
        'Introduction',
        'Collaboration',
        'Partnership',
        'Access',
        'Hiring',
        'Support',
        'Service Request',
        'Project request',
        'Regional connection',
        'Bridge request'
    ]);

    return allowed.has(clean) ? clean : 'Connection request';
}

function getNextRequestStatus(currentStatus = '') {
    const status = normalizeRequestStatus(currentStatus);

    if (status === 'Submitted') return 'Under Review';
    if (status === 'Under Review') return 'Matched';
    if (status === 'Matched') return 'Conversation Opened';
    if (status === 'Conversation Opened') return 'Closed';

    return status;
}

function normalizeRequestTagArray(value, maxItems = 12) {
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeText(item))
            .filter(Boolean)
            .slice(0, maxItems);
    }

    return sanitizeText(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems);
}

function normalizeRouteKeyPart(value = '') {
    return sanitizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80);
}

function buildPlazaRequestRouteMeta(input = {}) {
    const sourceType = sanitizeText(input.sourceType || 'general').toLowerCase();
    const objective = normalizeRequestObjective(input.objective);
    const targetLabel = sanitizeText(input.targetLabel || 'General Plaza request');
    const region = sanitizeText(input.region || '');
    const providerName = sanitizeText(input.providerName || '');
    const serviceCategory = sanitizeText(input.serviceCategory || '');
    const serviceTags = normalizeRequestTagArray(input.serviceTags);

    let routeKey = sanitizeText(input.routeKey || '');
    let routeLabel = sanitizeText(input.routeLabel || '');

    if (!routeKey) {
        if (sourceType === 'federation-escalation') {
            routeKey = 'federation_escalation';
        } else if (sourceType === 'service' || objective === 'Service Request') {
            routeKey = 'service_request';
        } else if (sourceType === 'opportunity' && objective === 'Hiring') {
            routeKey = 'plaza_hiring';
        } else if (sourceType === 'regional' || objective === 'Regional connection') {
            routeKey = 'regional_connection';
        } else if (sourceType === 'bridge' || objective === 'Bridge request') {
            routeKey = 'bridge_request';
        } else {
            routeKey = normalizeRouteKeyPart(`${sourceType}_${objective}`) || 'general_request';
        }
    }

    if (!routeLabel) {
        if (routeKey === 'service_request') {
            routeLabel = serviceCategory
                ? `Service request • ${serviceCategory}`
                : `Service request • ${targetLabel}`;
        } else if (routeKey === 'federation_escalation') {
            routeLabel = `Federation escalation • ${targetLabel}`;
        } else if (routeKey === 'plaza_hiring') {
            routeLabel = `Hiring route • ${targetLabel}`;
        } else if (routeKey === 'regional_connection') {
            routeLabel = `Regional connection • ${region || targetLabel}`;
        } else if (routeKey === 'bridge_request') {
            routeLabel = `Bridge request • ${targetLabel}`;
        } else {
            routeLabel = targetLabel;
        }
    }

    const matchedEntityLabels = [
        providerName ? `Provider: ${providerName}` : '',
        serviceCategory ? `Service: ${serviceCategory}` : '',
        region ? `Region: ${region}` : '',
        ...serviceTags.map((tag) => `Tag: ${tag}`)
    ].filter(Boolean).slice(0, 12);

    return {
        routeKey,
        routeLabel,
        matchedEntityLabels,
        matchingStatus: sanitizeText(input.matchingStatus || 'queued_for_review'),
        matchingPriority: sanitizeText(input.matchingPriority || 'normal'),
        decisionSummary: sanitizeText(input.decisionSummary) ||
            `Plaza should review this ${objective.toLowerCase()} and route it to the right operator, provider, region, or escalation lane.`,
        resolutionSummary: sanitizeText(input.resolutionSummary) ||
            'Resolution will be updated after Plaza review, matching, conversation, delivery, or closure.'
    };
}

function mapPlazaRequestDoc(docSnap) {
    const data = docSnap.data() || {};
    const status = normalizeRequestStatus(data.status);
    const targetLabel = sanitizeText(data.targetLabel || 'General Plaza request');

    return {
        id: docSnap.id,
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt),
        resolvedAt: mapTimestamp(data.resolvedAt),
        status,
        sourceType: sanitizeText(data.sourceType || 'general'),
        targetId: sanitizeText(data.targetId),
        targetLabel,
        context: sanitizeText(data.context),
        region: sanitizeText(data.region),
        name: sanitizeText(data.name || data.authorName || 'Hustler'),
        objective: normalizeRequestObjective(data.objective),
        message: sanitizeText(data.message),

        providerId: sanitizeText(data.providerId || data.ownerUid || data.operatorUid || ''),
        providerName: sanitizeText(data.providerName || data.ownerName || data.operatorName || ''),
        serviceCategory: sanitizeText(data.serviceCategory || ''),
        serviceTags: normalizeRequestTagArray(data.serviceTags),
        serviceProviderType: sanitizeText(data.serviceProviderType || ''),
        servicePriceType: sanitizeText(data.servicePriceType || ''),
        serviceDeliveryTime: sanitizeText(data.serviceDeliveryTime || ''),
        requestIntent: sanitizeText(data.requestIntent || ''),
        requestPriority: sanitizeText(data.requestPriority || 'normal'),

        routeKey: sanitizeText(data.routeKey || data.sourceType || 'general'),
        routeLabel: sanitizeText(data.routeLabel || targetLabel),
        matchingStatus: sanitizeText(data.matchingStatus || ''),
        matchingPriority: sanitizeText(data.matchingPriority || ''),
        headline: sanitizeText(data.headline),
        experience: sanitizeText(data.experience),
        portfolioLink: sanitizeText(data.portfolioLink),
        attachmentMeta: Array.isArray(data.attachmentMeta) ? data.attachmentMeta : [],
        matchedEntityLabels: normalizeTextArray(data.matchedEntityLabels),
        decisionSummary: sanitizeText(data.decisionSummary),
        resolutionSummary: sanitizeText(data.resolutionSummary),
        statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory : [],
        authorId: sanitizeText(data.authorId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || data.name || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase()
    };
}
function normalizeConversationMessages(value) {
    if (!Array.isArray(value)) return [];

    return value
        .map((item, index) => ({
            id: sanitizeText(item?.id || `message-${index + 1}`),
            sender: sanitizeText(item?.sender || 'Plaza System'),
            type: sanitizeText(item?.type || 'message'),
            text: sanitizeText(item?.text),
            createdAt: sanitizeText(item?.createdAt || new Date().toISOString())
        }))
        .filter((item) => item.text);
}

function normalizeConversationParticipants(value) {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => sanitizeText(item))
        .filter(Boolean)
        .slice(0, 12);
}

function mapPlazaConversationDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        title: sanitizeText(data.title || 'Plaza conversation'),
        queueRole: sanitizeText(data.queueRole || 'personal'),
        linkedRequestId: sanitizeText(data.linkedRequestId),
        linkedInboxId: sanitizeText(data.linkedInboxId),
        targetLabel: sanitizeText(data.targetLabel || 'Plaza'),
        contextTitle: sanitizeText(data.contextTitle || data.title || 'Plaza conversation'),
        contextRoute: sanitizeText(data.contextRoute || 'Plaza conversation'),
        participants: normalizeConversationParticipants(data.participants),
        participantIds: normalizeConversationParticipants(data.participantIds),
        status: sanitizeText(data.status || 'active'),
        messages: normalizeConversationMessages(data.messages),
        authorId: sanitizeText(data.authorId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}

function buildConversationFromRequestPayload(requestId, requestData = {}, viewer = {}) {
    const nowIso = new Date().toISOString();
    const targetLabel = sanitizeText(requestData.targetLabel || 'General Plaza request');
    const objective = normalizeRequestObjective(requestData.objective);

    return {
        title: `${objective}: ${targetLabel}`,
        queueRole: 'personal',
        linkedRequestId: requestId,
        linkedInboxId: '',
        targetLabel,
        contextTitle: sanitizeText(requestData.context || requestData.message || targetLabel).slice(0, 180),
        contextRoute: sanitizeText(requestData.routeLabel || requestData.routeKey || 'Plaza request'),
        participants: [
            sanitizeText(requestData.authorName || requestData.name || viewer.name || 'Hustler'),
            'Plaza'
        ].filter(Boolean),
        participantIds: [
            sanitizeText(requestData.authorId || viewer.id)
        ].filter(Boolean),
        status: 'active',
        messages: [
            {
                id: `message-${Date.now()}-system`,
                sender: 'Plaza System',
                type: 'system',
                text: `Conversation opened from ${objective}. Target: ${targetLabel}.`,
                createdAt: nowIso
            }
        ],
        authorId: sanitizeText(requestData.authorId || viewer.id),
        authorFirebaseUid: sanitizeText(requestData.authorFirebaseUid || viewer.firebaseUid),
        authorEmail: sanitizeText(requestData.authorEmail || viewer.email).toLowerCase(),
        authorName: sanitizeText(requestData.authorName || requestData.name || viewer.name || 'Hustler'),
        recordStatus: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };
}

function buildConversationFromMemberPayload(targetUserId = '', targetUser = {}, viewer = {}, initialMessage = '') {
    const nowIso = new Date().toISOString();

    const targetName = sanitizeText(
        targetUser.fullName ||
        targetUser.name ||
        targetUser.displayName ||
        targetUser.username ||
        'YH Member'
    );

    const viewerName = sanitizeText(viewer.name || viewer.username || 'Hustler');

    const targetRole = sanitizeText(
        targetUser.roleLabel ||
        targetUser.role ||
        targetUser.federationRole ||
        targetUser.profession ||
        'YH Universe Member'
    );

    const contextTitle = `${targetRole} • ${sanitizeText(targetUser.city || targetUser.country || 'YH Universe')}`;

    return {
        title: `Plaza DM: ${viewerName} ↔ ${targetName}`,
        queueRole: 'personal',
        linkedRequestId: '',
        linkedInboxId: '',
        targetLabel: targetName,
        targetId: sanitizeText(targetUserId),
        contextTitle,
        contextRoute: 'Plaza Directory Message',
        participants: [viewerName, targetName].filter(Boolean),
        participantIds: [sanitizeText(viewer.id), sanitizeText(targetUserId)]
            .filter(Boolean)
            .filter((value, index, arr) => arr.indexOf(value) === index),
        status: 'active',
        messages: [
            {
                id: `message-${Date.now()}-system`,
                sender: 'Plaza System',
                type: 'system',
                text: `Conversation opened from Plaza Directory. Target: ${targetName}.`,
                createdAt: nowIso
            },
            ...(sanitizeText(initialMessage) ? [
                {
                    id: `message-${Date.now()}-intro`,
                    sender: viewerName,
                    type: 'message',
                    text: sanitizeText(initialMessage).slice(0, 1200),
                    createdAt: nowIso
                }
            ] : [])
        ],
        authorId: sanitizeText(viewer.id),
        authorFirebaseUid: sanitizeText(viewer.firebaseUid),
        authorEmail: sanitizeText(viewer.email).toLowerCase(),
        authorName: viewerName,
        recordStatus: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };
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
            80
        );

        const snap = await plazaFeedCol
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const feed = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = sanitizeText(data.status || 'active').toLowerCase();

            if (status !== 'active') return;

            feed.push(mapPlazaFeedDoc(docSnap));
        });

        const hydratedFeed = await hydratePlazaOwnerProfiles(feed);

        return res.json({
            success: true,
            feed: hydratedFeed
        });
    } catch (error) {
        console.error('plazaControllers.getFeed error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza feed.'
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

        const now = Timestamp.now();

        const payload = {
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
        };

        const ref = await plazaFeedCol.add(payload);
        const createdSnap = await ref.get();

        const hydratedPost = await hydratePlazaOwnerProfiles([mapPlazaFeedDoc(createdSnap)]);
        const mappedPost = hydratedPost[0] || mapPlazaFeedDoc(createdSnap);

        await universeCollectionMirrorRepo.mirrorPlazaFeedPost({
            action: 'created',
            viewer,
            post: mappedPost
        });

        return res.status(201).json({
            success: true,
            post: mappedPost
        });
    } catch (error) {
        console.error('plazaControllers.createFeedPost error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza feed post.'
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
            100
        );

        const snap = await plazaOpportunitiesCol
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const opportunities = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = sanitizeText(data.status || 'active').toLowerCase();

            if (status !== 'active') return;

            opportunities.push(mapPlazaOpportunityDoc(docSnap));
        });

        const hydratedOpportunities = await hydratePlazaOwnerProfiles(opportunities);

        return res.json({
            success: true,
            opportunities: hydratedOpportunities
        });
    } catch (error) {
        console.error('plazaControllers.getOpportunities error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza opportunities.'
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

        const now = Timestamp.now();

        const payload = {
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
        };

        const ref = await plazaOpportunitiesCol.add(payload);
        const createdSnap = await ref.get();

        const hydratedOpportunity = await hydratePlazaOwnerProfiles([mapPlazaOpportunityDoc(createdSnap)]);
        const mappedOpportunity = hydratedOpportunity[0] || mapPlazaOpportunityDoc(createdSnap);

        await universeCollectionMirrorRepo.mirrorPlazaOpportunity({
            action: 'created',
            viewer,
            opportunity: mappedOpportunity
        });

        return res.status(201).json({
            success: true,
            opportunity: mappedOpportunity
        });
    } catch (error) {
        console.error('plazaControllers.createOpportunity error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza opportunity.'
        });
    }
};
exports.getDirectory = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

                await ensureCanonicalPlazaRegionsSeeded();

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            200
        );

        const snap = await plazaDirectoryCol
            .orderBy('updatedAt', 'desc')
            .limit(limit)
            .get();

        const directory = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = sanitizeText(data.status || 'active').toLowerCase();

            if (status !== 'active') return;

            directory.push(mapPlazaDirectoryDoc(docSnap));
        });

        const hydratedDirectory = await hydratePlazaOwnerProfiles(directory);

        return res.json({
            success: true,
            directory: hydratedDirectory
        });
    } catch (error) {
        console.error('plazaControllers.getDirectory error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza directory.'
        });
    }
};

exports.upsertDirectoryProfile = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const name = clampText(req.body?.name || viewer.name, 120);
        const region = clampText(req.body?.region, 80, 'Global') || 'Global';
        const division = normalizeDirectoryDivision(req.body?.division);
        const trust = normalizeDirectoryTrust(req.body?.trust);
        const role = clampText(req.body?.role, 120);
        const focus = clampText(req.body?.focus, 500);
        const tags = normalizeTags(req.body?.tags);
        const lookingFor = normalizeTags(req.body?.lookingFor || req.body?.looking_for).slice(0, 8);
        const canOffer = normalizeTags(req.body?.canOffer || req.body?.can_offer).slice(0, 8);
        const availability = clampText(req.body?.availability, 80);
        const workMode = clampText(req.body?.workMode || req.body?.work_mode, 80);
        const marketplaceMode = sanitizeText(req.body?.marketplaceMode || req.body?.marketplace_mode).toLowerCase() === 'yes' ? 'yes' : 'no';

        if (!role) {
            return res.status(400).json({
                success: false,
                message: 'Directory role is required.'
            });
        }

        if (!focus) {
            return res.status(400).json({
                success: false,
                message: 'Directory focus is required.'
            });
        }

        const now = Timestamp.now();
        const docId = viewer.id;

        const ref = plazaDirectoryCol.doc(docId);
        const existingSnap = await ref.get();
        const existing = existingSnap.exists ? existingSnap.data() || {} : {};

        const payload = {
            name,
            region,
            division,
            source: division === 'both' ? 'cross' : division,
            trust,
            role,
            focus,
            tags,
            lookingFor,
            canOffer,
            availability,
            workMode,
            marketplaceMode,
            authorId: viewer.id,
            userId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            status: 'active',
            createdAt: existing.createdAt || now,
            updatedAt: now
        };

        await ref.set(payload, { merge: true });

        const updatedSnap = await ref.get();

        const hydratedProfile = await hydratePlazaOwnerProfiles([mapPlazaDirectoryDoc(updatedSnap)]);

        return res.status(existingSnap.exists ? 200 : 201).json({
            success: true,
            profile: hydratedProfile[0] || mapPlazaDirectoryDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.upsertDirectoryProfile error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to save Plaza directory profile.'
        });
    }
};
exports.getRegions = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            200
        );

        const snap = await plazaRegionsCol
            .orderBy('updatedAt', 'desc')
            .limit(limit)
            .get();

        const regions = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = sanitizeText(data.status || 'active').toLowerCase();

            if (status !== 'active') return;

            regions.push(mapPlazaRegionDoc(docSnap));
        });

        regions.sort((a, b) => {
            const aCanonical = a.isCanonical === true ? 0 : 1;
            const bCanonical = b.isCanonical === true ? 0 : 1;

            if (aCanonical !== bCanonical) return aCanonical - bCanonical;

            const aSort = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 9999;
            const bSort = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 9999;

            if (aSort !== bSort) return aSort - bSort;

            return String(a.region || '').localeCompare(String(b.region || ''));
        });

        return res.json({
            success: true,
            canonicalVersion: YH_CANONICAL_PLAZA_VERSION,
            canonicalCount: YH_CANONICAL_PLAZA_REGIONS.length,
            regions
        });
    } catch (error) {
        console.error('plazaControllers.getRegions error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza regions.'
        });
    }
};

exports.createRegion = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const region = clampText(req.body?.region || req.body?.name, 100);
        const label = clampText(req.body?.label, 100, 'Region Hub') || 'Region Hub';
        const text = clampText(
            req.body?.text ||
            req.body?.description ||
            req.body?.body,
            900
        );
        const countries = normalizePlazaRegionCountries(req.body?.countries);
        const continent = clampText(req.body?.continent, 80);
        const network = clampText(req.body?.network, 120);
        const sourceUrl = clampText(req.body?.sourceUrl || req.body?.source_url, 240);
        const plazaNumber = Number(req.body?.plazaNumber || req.body?.plaza_number || 0);
        if (!region) {
            return res.status(400).json({
                success: false,
                message: 'Region name is required.'
            });
        }

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Region description is required.'
            });
        }

        const now = Timestamp.now();

        const payload = {
            region,
            label,
            text,
            count: countries.length,
            countryCount: countries.length,
            countries,
            continent,
            network,
            plazaNumber: Number.isFinite(plazaNumber) ? plazaNumber : 0,
            sourceUrl,
            source: 'manual',
            isCanonical: false,
            canonicalRegionId: '',
            canonicalDataVersion: '',
            sortOrder: 9999,
            action: 'Enter Region Hub',
            authorId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        const ref = await plazaRegionsCol.add(payload);
        const createdSnap = await ref.get();

        return res.status(201).json({
            success: true,
            region: mapPlazaRegionDoc(createdSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createRegion error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza region.'
        });
    }
};
exports.getBridge = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            200
        );

        const snap = await plazaBridgeCol
            .orderBy('updatedAt', 'desc')
            .limit(limit)
            .get();

        const bridge = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = sanitizeText(data.status || 'active').toLowerCase();

            if (status !== 'active') return;

            bridge.push(mapPlazaBridgeDoc(docSnap));
        });

        return res.json({
            success: true,
            bridge
        });
    } catch (error) {
        console.error('plazaControllers.getBridge error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza bridge paths.'
        });
    }
};

exports.createBridge = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const stage = clampText(req.body?.stage, 100, 'Bridge Path') || 'Bridge Path';
        const left = normalizeBridgeLane(req.body?.left || 'academy');
        const right = normalizeBridgeLane(req.body?.right || 'federation');
        const region = clampText(req.body?.region, 100, 'Global') || 'Global';
        const title = clampText(req.body?.title, 140);
        const text = clampText(
            req.body?.text ||
            req.body?.description ||
            req.body?.body,
            1200
        );
        const nextStep = clampText(
            req.body?.nextStep,
            220,
            'Review and decide the next structured move.'
        ) || 'Review and decide the next structured move.';

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Bridge title is required.'
            });
        }

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Bridge description is required.'
            });
        }

        const now = Timestamp.now();

        const payload = {
            stage,
            left,
            right,
            region,
            title,
            text,
            nextStep,
            action: 'Open Bridge Detail',
            authorId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        const ref = await plazaBridgeCol.add(payload);
        const createdSnap = await ref.get();

        return res.status(201).json({
            success: true,
            bridgePath: mapPlazaBridgeDoc(createdSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createBridge error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza bridge path.'
        });
    }
};
exports.getRequests = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            200
        );

        const snap = await plazaRequestsCol
            .where('authorId', '==', viewer.id)
            .limit(Math.max(limit, 200))
            .get();

        const requests = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const recordStatus = sanitizeText(data.recordStatus || 'active').toLowerCase();

            if (recordStatus !== 'active') return;

            requests.push(mapPlazaRequestDoc(docSnap));
        });

        requests.sort((a, b) => {
            return String(b.updatedAt || b.createdAt || '').localeCompare(
                String(a.updatedAt || a.createdAt || '')
            );
        });

        return res.json({
            success: true,
            requests: requests.slice(0, limit)
        });
    } catch (error) {
        console.error('plazaControllers.getRequests error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza requests.'
        });
    }
};

exports.createRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const objective = normalizeRequestObjective(req.body?.objective);
        const message = clampText(req.body?.message, 1400);
        const targetLabel = clampText(req.body?.targetLabel, 160, 'General Plaza request') || 'General Plaza request';
        const sourceType = clampText(req.body?.sourceType, 80, 'general') || 'general';
        const targetId = clampText(req.body?.targetId, 160);
        const context = clampText(req.body?.context, 500);
        const region = clampText(req.body?.region, 100);
        const headline = clampText(req.body?.headline, 160);
        const experience = clampText(req.body?.experience, 500);
        const portfolioLink = clampText(req.body?.portfolioLink, 300);

        const providerId = clampText(req.body?.providerId, 160);
        const providerName = clampText(req.body?.providerName, 160);
        const serviceCategory = clampText(req.body?.serviceCategory, 140);
        const serviceTags = normalizeRequestTagArray(req.body?.serviceTags);
        const serviceProviderType = clampText(req.body?.serviceProviderType, 100);
        const servicePriceType = clampText(req.body?.servicePriceType, 80);
        const serviceDeliveryTime = clampText(req.body?.serviceDeliveryTime, 120);
        const requestIntent = clampText(req.body?.requestIntent, 160);
        const requestPriority = clampText(req.body?.requestPriority, 80, 'normal') || 'normal';
        const requestedStatus = normalizeRequestStatus(req.body?.status || 'Submitted');

        const routeMeta = buildPlazaRequestRouteMeta({
            sourceType,
            objective,
            targetLabel,
            region,
            providerName,
            serviceCategory,
            serviceTags,
            routeKey: req.body?.routeKey,
            routeLabel: req.body?.routeLabel,
            matchingStatus: req.body?.matchingStatus,
            matchingPriority: req.body?.matchingPriority,
            decisionSummary: req.body?.decisionSummary,
            resolutionSummary: req.body?.resolutionSummary
        });

        if (requestedStatus !== 'Draft' && !message) {
            return res.status(400).json({
                success: false,
                message: 'Request message is required before submitting.'
            });
        }

        const now = Timestamp.now();

        const payload = {
            sourceType,
            targetId,
            targetLabel,
            context,
            region,
            name: viewer.name,
            objective,
            message,
            status: requestedStatus,
            providerId,
            providerName,
            serviceCategory,
            serviceTags,
            serviceProviderType,
            servicePriceType,
            serviceDeliveryTime,
            requestIntent,
            requestPriority,

            routeKey: routeMeta.routeKey,
            routeLabel: routeMeta.routeLabel,
            matchingStatus: routeMeta.matchingStatus,
            matchingPriority: routeMeta.matchingPriority,
            headline,
            experience,
            portfolioLink,
            attachmentMeta: [],
            matchedEntityLabels: routeMeta.matchedEntityLabels,
            decisionSummary: routeMeta.decisionSummary,
            resolutionSummary: routeMeta.resolutionSummary,
            statusHistory: [
                {
                    status: requestedStatus,
                    at: new Date().toISOString()
                }
            ],
            authorId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            recordStatus: 'active',
            createdAt: now,
            updatedAt: now,
            resolvedAt: requestedStatus === 'Closed' ? now : ''
        };

        const ref = await plazaRequestsCol.add(payload);
        const createdSnap = await ref.get();

        return res.status(201).json({
            success: true,
            request: mapPlazaRequestDoc(createdSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createRequest error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza request.'
        });
    }
};
exports.updateRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const requestId = sanitizeText(req.params.id);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request ID is required.'
            });
        }

        const ref = plazaRequestsCol.doc(requestId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Request not found.'
            });
        }

        const current = snap.data() || {};
        const recordStatus = sanitizeText(current.recordStatus || 'active').toLowerCase();

        if (recordStatus !== 'active') {
            return res.status(404).json({
                success: false,
                message: 'Request not found.'
            });
        }

        if (sanitizeText(current.authorId) !== viewer.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own Plaza requests.'
            });
        }

        const currentStatus = normalizeRequestStatus(current.status);
        const nextStatus = normalizeRequestStatus(req.body?.status || currentStatus || 'Submitted');

        const objective = normalizeRequestObjective(req.body?.objective || current.objective);
        const message = clampText(req.body?.message ?? current.message, 1400);
        const targetLabel = clampText(req.body?.targetLabel ?? current.targetLabel, 160, 'General Plaza request') || 'General Plaza request';
        const sourceType = clampText(req.body?.sourceType ?? current.sourceType, 80, 'general') || 'general';
        const targetId = clampText(req.body?.targetId ?? current.targetId, 160);
        const context = clampText(req.body?.context ?? current.context, 500);
        const region = clampText(req.body?.region ?? current.region, 100);
        const headline = clampText(req.body?.headline ?? current.headline, 160);
        const experience = clampText(req.body?.experience ?? current.experience, 500);
        const portfolioLink = clampText(req.body?.portfolioLink ?? current.portfolioLink, 300);

        const providerId = clampText(req.body?.providerId ?? current.providerId, 160);
        const providerName = clampText(req.body?.providerName ?? current.providerName, 160);
        const serviceCategory = clampText(req.body?.serviceCategory ?? current.serviceCategory, 140);
        const serviceTags = normalizeRequestTagArray(req.body?.serviceTags ?? current.serviceTags);
        const serviceProviderType = clampText(req.body?.serviceProviderType ?? current.serviceProviderType, 100);
        const servicePriceType = clampText(req.body?.servicePriceType ?? current.servicePriceType, 80);
        const serviceDeliveryTime = clampText(req.body?.serviceDeliveryTime ?? current.serviceDeliveryTime, 120);
        const requestIntent = clampText(req.body?.requestIntent ?? current.requestIntent, 160);
        const requestPriority = clampText(req.body?.requestPriority ?? current.requestPriority, 80, 'normal') || 'normal';

        if (nextStatus !== 'Draft' && !message) {
            return res.status(400).json({
                success: false,
                message: 'Request message is required before submitting.'
            });
        }

        const routeMeta = buildPlazaRequestRouteMeta({
            sourceType,
            objective,
            targetLabel,
            region,
            providerName,
            serviceCategory,
            serviceTags,
            routeKey: req.body?.routeKey ?? current.routeKey,
            routeLabel: req.body?.routeLabel ?? current.routeLabel,
            matchingStatus: req.body?.matchingStatus ?? current.matchingStatus,
            matchingPriority: req.body?.matchingPriority ?? current.matchingPriority,
            decisionSummary: req.body?.decisionSummary ?? current.decisionSummary,
            resolutionSummary: req.body?.resolutionSummary ?? current.resolutionSummary
        });

        const now = Timestamp.now();

        const statusHistory = Array.isArray(current.statusHistory)
            ? [...current.statusHistory]
            : [];

        if (!statusHistory.length) {
            statusHistory.push({
                status: currentStatus,
                at: mapTimestamp(current.createdAt) || new Date().toISOString()
            });
        }

        if (nextStatus !== currentStatus) {
            statusHistory.push({
                status: nextStatus,
                at: new Date().toISOString()
            });
        }

        await ref.set({
            sourceType,
            targetId,
            targetLabel,
            context,
            region,
            name: clampText(req.body?.name ?? current.name ?? viewer.name, 160, viewer.name) || viewer.name,
            objective,
            message,

            providerId,
            providerName,
            serviceCategory,
            serviceTags,
            serviceProviderType,
            servicePriceType,
            serviceDeliveryTime,
            requestIntent,
            requestPriority,

            status: nextStatus,
            routeKey: routeMeta.routeKey,
            routeLabel: routeMeta.routeLabel,
            matchingStatus: routeMeta.matchingStatus,
            matchingPriority: routeMeta.matchingPriority,
            headline,
            experience,
            portfolioLink,
            matchedEntityLabels: routeMeta.matchedEntityLabels,
            decisionSummary: routeMeta.decisionSummary,
            resolutionSummary: routeMeta.resolutionSummary,
            statusHistory,
            resolvedAt: nextStatus === 'Closed' ? now : '',
            updatedAt: now
        }, { merge: true });

        const updatedSnap = await ref.get();

        return res.json({
            success: true,
            request: mapPlazaRequestDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.updateRequest error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update Plaza request.'
        });
    }
};

exports.advanceRequestStatus = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const requestId = sanitizeText(req.params.id);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request ID is required.'
            });
        }

        const ref = plazaRequestsCol.doc(requestId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Request not found.'
            });
        }

        const current = snap.data() || {};

        if (sanitizeText(current.authorId) !== viewer.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own Plaza requests.'
            });
        }

        const currentStatus = normalizeRequestStatus(current.status);
        const nextStatus = normalizeRequestStatus(req.body?.status || getNextRequestStatus(currentStatus));
        const now = Timestamp.now();

        const statusHistory = Array.isArray(current.statusHistory)
            ? [...current.statusHistory]
            : [];

        if (nextStatus !== currentStatus) {
            statusHistory.push({
                status: nextStatus,
                at: new Date().toISOString()
            });
        }

        await ref.set({
            status: nextStatus,
            statusHistory,
            resolvedAt: nextStatus === 'Closed' ? now : '',
            updatedAt: now
        }, { merge: true });

        const updatedSnap = await ref.get();

        return res.json({
            success: true,
            request: mapPlazaRequestDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.advanceRequestStatus error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update Plaza request.'
        });
    }
};

exports.deleteRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const requestId = sanitizeText(req.params.id);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request ID is required.'
            });
        }

        const ref = plazaRequestsCol.doc(requestId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Request not found.'
            });
        }

        const current = snap.data() || {};

        if (sanitizeText(current.authorId) !== viewer.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own Plaza requests.'
            });
        }

        await ref.set({
            recordStatus: 'deleted',
            updatedAt: Timestamp.now()
        }, { merge: true });

        return res.json({
            success: true
        });
    } catch (error) {
        console.error('plazaControllers.deleteRequest error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete Plaza request.'
        });
    }
};
exports.getMessages = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            200
        );

        const snap = await plazaConversationsCol
            .where('participantIds', 'array-contains', viewer.id)
            .get();

        const conversations = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const recordStatus = sanitizeText(data.recordStatus || 'active').toLowerCase();

            if (recordStatus !== 'active') return;

            conversations.push(mapPlazaConversationDoc(docSnap));
        });

        conversations.sort((left, right) => {
            const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
            const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
            return rightTime - leftTime;
        });

        return res.json({
            success: true,
            conversations: conversations.slice(0, limit)
        });
    } catch (error) {
        console.error('plazaControllers.getMessages error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza messages.'
        });
    }
};

exports.createConversationFromRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const requestId = sanitizeText(req.params.requestId);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request ID is required.'
            });
        }

        const requestRef = plazaRequestsCol.doc(requestId);
        const requestSnap = await requestRef.get();

        if (!requestSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Request not found.'
            });
        }

        const requestData = requestSnap.data() || {};

        if (sanitizeText(requestData.authorId) !== viewer.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only open conversations for your own Plaza requests.'
            });
        }

        const conversationId = `request_${requestId}`;
        const conversationRef = plazaConversationsCol.doc(conversationId);
        const conversationSnap = await conversationRef.get();

        if (!conversationSnap.exists) {
            const payload = buildConversationFromRequestPayload(requestId, requestData, viewer);

            await conversationRef.set(payload, { merge: true });

            await requestRef.set({
                status: 'Conversation Opened',
                updatedAt: Timestamp.now()
            }, { merge: true });
        }

        const updatedSnap = await conversationRef.get();

        return res.status(conversationSnap.exists ? 200 : 201).json({
            success: true,
            conversation: mapPlazaConversationDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createConversationFromRequest error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to open Plaza conversation.'
        });
    }
};

exports.createConversationFromMember = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const targetUserId = sanitizeText(req.params.targetUserId || req.body?.targetUserId);
        const initialMessage = sanitizeText(req.body?.message || req.body?.initialMessage || '');

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: 'Target member id is required.'
            });
        }

        if (targetUserId === viewer.id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot open a Plaza message with yourself.'
            });
        }

        const targetSnap = await firestore.collection('users').doc(targetUserId).get();

        if (!targetSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Target member was not found.'
            });
        }

        const targetUser = targetSnap.data() || {};
        const participantKey = [viewer.id, targetUserId].sort().join('_');
        const conversationId = `member_${participantKey}`;
        const conversationRef = plazaConversationsCol.doc(conversationId);
        const conversationSnap = await conversationRef.get();

        if (!conversationSnap.exists) {
            const payload = buildConversationFromMemberPayload(
                targetUserId,
                targetUser,
                viewer,
                initialMessage
            );

            await conversationRef.set(payload, { merge: true });
        } else if (initialMessage) {
            const existing = conversationSnap.data() || {};
            const messages = normalizeConversationMessages(existing.messages);

            messages.push({
                id: `message-${Date.now()}-intro`,
                sender: viewer.name || 'Hustler',
                type: 'message',
                text: initialMessage.slice(0, 1200),
                createdAt: new Date().toISOString()
            });

            await conversationRef.set({
                messages,
                updatedAt: Timestamp.now()
            }, { merge: true });
        }

        const updatedSnap = await conversationRef.get();

        return res.status(conversationSnap.exists ? 200 : 201).json({
            success: true,
            conversation: mapPlazaConversationDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createConversationFromMember error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to open Plaza member conversation.'
        });
    }
};

exports.createConversationReply = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const conversationId = sanitizeText(req.params.id);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: 'Conversation ID is required.'
            });
        }

        const text = clampText(req.body?.text || req.body?.message, 1600);

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Reply text is required.'
            });
        }

        const ref = plazaConversationsCol.doc(conversationId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found.'
            });
        }

        const data = snap.data() || {};
        const participantIds = Array.isArray(data.participantIds)
            ? data.participantIds.map((item) => sanitizeText(item)).filter(Boolean)
            : [];

        if (!participantIds.includes(viewer.id)) {
            return res.status(403).json({
                success: false,
                message: 'You are not part of this Plaza conversation.'
            });
        }

        const nowIso = new Date().toISOString();
        const messages = normalizeConversationMessages(data.messages);

        messages.push({
            id: `message-${Date.now()}`,
            sender: viewer.name || 'You',
            type: 'message',
            text,
            createdAt: nowIso
        });

        await ref.set({
            messages,
            updatedAt: Timestamp.now()
        }, { merge: true });

        const updatedSnap = await ref.get();

        return res.json({
            success: true,
            conversation: mapPlazaConversationDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createConversationReply error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to send Plaza reply.'
        });
    }
};