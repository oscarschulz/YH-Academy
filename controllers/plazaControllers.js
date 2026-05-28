const { firestore } = require('../config/firebaseAdmin');
const { Timestamp, FieldValue } = require('firebase-admin/firestore');
const universeCollectionMirrorRepo = require('../backend/repositories/universeCollectionMirrorRepo');
const paymentLedgerRepo = require('../backend/repositories/paymentLedgerRepo');
const { sendSystemMail } = require('./authControllers');

const plazaFeedCol = firestore.collection('plazaFeedPosts');
const plazaOpportunitiesCol = firestore.collection('plazaOpportunities');
const plazaDirectoryCol = firestore.collection('plazaDirectoryProfiles');
const plazaRegionsCol = firestore.collection('plazaRegions');
const plazaBridgeCol = firestore.collection('plazaBridgePaths');
const plazaRequestsCol = firestore.collection('plazaRequests');
const plazaConversationsCol = firestore.collection('plazaConversations');
const plazaBusinessChatReportsCol = firestore.collection('plazaBusinessChatReports');
const plazaBusinessUserBlocksCol = firestore.collection('plazaBusinessUserBlocks');
const plazaMeetupsCol = firestore.collection('plazaMeetups');
const plazaPatronApplicationsCol = firestore.collection('plazaPatronApplications');
const plazaPatronAnnouncementsCol = firestore.collection('plazaPatronAnnouncements');
const plazaPatronRecommendationsCol = firestore.collection('plazaPatronFederationRecommendations');
const plazaPatronIntroOutcomesCol = firestore.collection('plazaPatronIntroOutcomes');
const plazaPatronPayoutsCol = firestore.collection('plazaPatronPayouts');
const usersCol = firestore.collection('users');

const BUSINESS_CHAT_EMAIL_NOTIFICATIONS_ENABLED =
    String(process.env.BUSINESS_CHAT_EMAIL_NOTIFICATIONS_ENABLED || 'true').trim().toLowerCase() !== 'false';

function escapeBusinessChatEmailHtml(value = '') {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildBusinessChatEmailBaseUrl(req = {}) {
    const envBase = String(
        process.env.PUBLIC_BASE_URL ||
        process.env.APP_BASE_URL ||
        process.env.BASE_URL ||
        ''
    ).trim().replace(/\/+$/, '');

    if (envBase) return envBase;

    const protocol = req.protocol || 'https';
    const host = typeof req.get === 'function' ? req.get('host') : '';

    return host ? protocol + '://' + host : 'https://younghustlersuniverse.com';
}

function getBusinessChatEmailName(user = {}, fallback = 'YH Member') {
    return sanitizeText(
        user.fullName ||
        user.displayName ||
        user.name ||
        user.username ||
        fallback
    );
}

function getBusinessChatEmailAddress(user = {}) {
    return sanitizeText(user.email || user.emailLower || '').toLowerCase();
}

function isBusinessChatConversationForEmail(conversation = {}, conversationId = '') {
    const scope = sanitizeText(conversation.scope || '').toLowerCase();
    const route = sanitizeText(conversation.contextRoute || '').toLowerCase();
    const id = sanitizeText(conversationId).toLowerCase();

    return (
        scope === 'cross_division_business' ||
        route.includes('cross-division') ||
        route.includes('business') ||
        id.startsWith('business_')
    );
}

function renderBusinessChatNotificationEmail({
    recipientName = 'Member',
    actorName = 'A YH member',
    conversationTitle = 'Plaza Business Chat',
    businessPurpose = 'Business collaboration',
    preview = '',
    actionUrl = '',
    eventLabel = 'Business Chat Update'
} = {}) {
    const safeRecipient = escapeBusinessChatEmailHtml(recipientName);
    const safeActor = escapeBusinessChatEmailHtml(actorName);
    const safeTitle = escapeBusinessChatEmailHtml(conversationTitle);
    const safePurpose = escapeBusinessChatEmailHtml(businessPurpose);
    const safePreview = escapeBusinessChatEmailHtml(preview || 'Open your dashboard to review this Business Chat.');
    const safeUrl = escapeBusinessChatEmailHtml(actionUrl || 'https://younghustlersuniverse.com/dashboard?businessChats=1');
    const safeEvent = escapeBusinessChatEmailHtml(eventLabel);

    return [
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        '<title>' + safeEvent + '</title></head>',
        '<body style="margin:0;padding:0;background:#030712;font-family:Arial,Helvetica,sans-serif;color:#e5eef8;">',
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#030712;border-collapse:collapse;"><tr><td align="center" style="padding:28px 14px;">',
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:660px;width:100%;border-collapse:collapse;">',
        '<tr><td style="background:#06111f;border:1px solid #16324c;border-radius:20px 20px 0 0;padding:16px 20px;">',
        '<div style="font-size:14px;color:#ffffff;font-weight:800;">Young Hustlers Universe</div>',
        '<div style="font-size:11px;color:#8fa4bf;text-transform:uppercase;letter-spacing:1.6px;">Cross-Division Business Chat</div>',
        '</td></tr>',
        '<tr><td style="height:4px;background:#22c55e;font-size:0;line-height:4px;">&nbsp;</td></tr>',
        '<tr><td style="background:#070d18;border:1px solid #16324c;border-top:0;border-radius:0 0 20px 20px;padding:34px 26px 26px;">',
        '<h1 style="margin:0 0 14px;font-size:28px;line-height:1.25;color:#ffffff;font-weight:800;text-align:center;">You have a Business Chat update</h1>',
        '<p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#9fb0c8;text-align:center;">Hello ' + safeRecipient + ', ' + safeActor + ' updated a cross-division Business Chat with you.</p>',
        '<div style="background:#091423;border:1px solid #152b45;border-radius:18px;padding:18px;margin:22px 0;">',
        '<div style="font-size:11px;color:#7dd3fc;letter-spacing:1.8px;text-transform:uppercase;font-weight:700;margin-bottom:8px;">' + safeEvent + '</div>',
        '<div style="font-size:18px;line-height:1.45;color:#ffffff;font-weight:800;margin-bottom:8px;">' + safeTitle + '</div>',
        '<div style="font-size:13px;line-height:1.7;color:#9fb0c8;margin-bottom:12px;">Purpose: ' + safePurpose + '</div>',
        '<div style="font-size:14px;line-height:1.8;color:#dbeafe;border-left:3px solid #22c55e;padding-left:12px;">' + safePreview + '</div>',
        '</div>',
        '<div style="text-align:center;margin:26px 0 18px;">',
        '<a href="' + safeUrl + '" style="display:inline-block;padding:13px 20px;border-radius:999px;background:#22c55e;color:#03130a;text-decoration:none;font-size:14px;font-weight:800;">Open Business Chats</a>',
        '</div>',
        '<p style="margin:0;font-size:12px;line-height:1.8;color:#72859e;text-align:center;">This notification was sent because you are a participant in this YH Business Chat.</p>',
        '</td></tr></table></td></tr></table></body></html>'
    ].join('');
}

async function getBusinessChatEmailRecipients(participantIds = [], actorId = '') {
    const cleanActorId = sanitizeText(actorId);
    const uniqueParticipantIds = Array.from(new Set(
        (Array.isArray(participantIds) ? participantIds : [])
            .map((item) => sanitizeText(item))
            .filter(Boolean)
            .filter((item) => item !== cleanActorId)
    ));

    const recipients = [];

    for (const participantId of uniqueParticipantIds) {
        try {
            const snap = await usersCol.doc(participantId).get();
            if (!snap.exists) continue;

            const user = snap.data() || {};
            const email = getBusinessChatEmailAddress(user);
            if (!email || !email.includes('@')) continue;

            recipients.push({
                id: participantId,
                email,
                name: getBusinessChatEmailName(user, 'YH Member')
            });
        } catch (error) {
            console.warn('Business Chat email recipient lookup skipped:', error && error.message ? error.message : error);
        }
    }

    return recipients;
}

async function sendBusinessChatEmailNotifications({
    conversationSnap = null,
    actor = {},
    eventType = 'reply',
    messageText = '',
    req = {}
} = {}) {
    if (!BUSINESS_CHAT_EMAIL_NOTIFICATIONS_ENABLED) return;
    if (!conversationSnap || !conversationSnap.exists) return;

    const conversationId = sanitizeText(conversationSnap.id);
    const conversation = conversationSnap.data() || {};

    if (!isBusinessChatConversationForEmail(conversation, conversationId)) return;

    const participantIds = Array.isArray(conversation.participantIds)
        ? conversation.participantIds.map((item) => sanitizeText(item)).filter(Boolean)
        : [];

    if (!participantIds.length) return;

    const recipients = await getBusinessChatEmailRecipients(participantIds, actor.id);
    if (!recipients.length) return;

    const actorName = sanitizeText(actor.name || actor.username || 'A YH member');
    const conversationTitle = sanitizeText(conversation.title || conversation.targetLabel || 'Plaza Business Chat');
    const businessPurpose = sanitizeText(conversation.businessPurpose || conversation.contextRoute || 'Business collaboration');
    const preview = sanitizeText(messageText || 'Open your dashboard to review this Business Chat.').slice(0, 320);
    const baseUrl = buildBusinessChatEmailBaseUrl(req);
    const actionUrl = baseUrl.replace(/\/+$/, '') + '/dashboard?businessChats=1';

    const eventLabel = eventType === 'opened'
        ? 'New Business Chat'
        : eventType === 'reply'
            ? 'New Reply'
            : 'Business Chat Update';

    const subject = eventType === 'opened'
        ? 'New YH Business Chat opened with you'
        : 'New reply in your YH Business Chat';

    const results = await Promise.allSettled(
        recipients.map((recipient) => {
            return sendSystemMail({
                to: recipient.email,
                subject,
                html: renderBusinessChatNotificationEmail({
                    recipientName: recipient.name,
                    actorName,
                    conversationTitle,
                    businessPurpose,
                    preview,
                    actionUrl,
                    eventLabel
                })
            });
        })
    );

    const sentCount = results.filter((result) => result.status === 'fulfilled').length;

    try {
        await conversationSnap.ref.set({
            emailNotifications: {
                lastEventType: eventType,
                lastActorId: sanitizeText(actor.id || ''),
                lastSentAt: new Date().toISOString(),
                lastRecipientCount: sentCount
            },
            updatedAt: Timestamp.now()
        }, { merge: true });
    } catch (error) {
        console.warn('Business Chat email notification metadata skipped:', error && error.message ? error.message : error);
    }
}


const YH_CANONICAL_PLAZA_VERSION = '2026-04-29-official-plazas-v1';

const PLAZA_PATRON_BENEFITS = [
    'Official Plaza Patron badge',
    'Featured profile inside assigned Plaza',
    'Priority regional directory placement',
    'Visible leadership title on Plaza Atlas and Region Hub',
    'Create and lead official Plaza meetups',
    'Host regional Plaza chat and welcome new members',
    'Route regional requests, introductions, opportunities, and collaborations',
    'Recommend high-value members for Federation review',
    'Coordinate with other Patrons across continents',
    'Earn eligibility for commission from admin-verified successful introductions',
    'Earn eligibility for bonuses from verified connection outcomes',
    'Earn eligibility for revenue share from paid meetups, sponsorships, and premium local events'
];

const PLAZA_PATRON_PRIVILEGES = [
    'lead_regional_chat',
    'create_official_meetups',
    'route_connection_requests',
    'recommend_federation_candidates',
    'receive_connection_commission_eligibility',
    'host_official_plaza_events',
    'coordinate_regional_opportunities',
    'access_patron_priority_visibility'
];

const PLAZA_PATRON_COMMISSION_POLICY = {
    introCommissionRange: '5%–15%',
    introCommissionLabel: 'Connection commission',
    meetupRevenueShare: 'Eligible',
    federationEscalationBonus: 'Eligible after verified high-value handoff',
    adminControlled: true,
    note: 'Final payout rules remain admin-controlled and can vary by deal, event, region, and verified outcome.'
};

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
        patronName: sanitizeText(plaza.patronName || `${sanitizeText(plaza.label || region)} Patron`),
        patronRole: sanitizeText(plaza.patronRole || 'Regional Patron'),
        patronUserId: sanitizeText(plaza.patronUserId || ''),
        patronStatus: sanitizeText(plaza.patronStatus || 'open'),
        patronContactHint: sanitizeText(
            plaza.patronContactHint ||
            `This Plaza is open for an approved Patron or Leader to coordinate networking, meetups, and local movement.`
        ),
        patronBenefits: Array.isArray(plaza.patronBenefits) ? plaza.patronBenefits : PLAZA_PATRON_BENEFITS,
        patronPrivileges: Array.isArray(plaza.patronPrivileges) ? plaza.patronPrivileges : PLAZA_PATRON_PRIVILEGES,
        patronCommissionPolicy:
            plaza.patronCommissionPolicy && typeof plaza.patronCommissionPolicy === 'object'
                ? plaza.patronCommissionPolicy
                : PLAZA_PATRON_COMMISSION_POLICY,
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

function normalizeCrossDivisionLabel(value = '') {
    const raw = sanitizeText(value).toLowerCase();
    if (raw === 'academy' || raw === 'yha' || raw === 'academy_member') return 'academy';
    if (raw === 'plaza' || raw === 'plazas' || raw === 'plaza_member') return 'plaza';
    if (raw === 'federation' || raw === 'yhf' || raw === 'federation_member') return 'federation';
    if (raw === 'all' || raw === 'any') return 'all';
    return '';
}

function inferUserPrimaryDivision(user = {}) {
    const explicit = normalizeCrossDivisionLabel(
        user.primaryDivision ||
        user.division ||
        user.memberDivision ||
        user.activeDivision ||
        ''
    );

    if (explicit && explicit !== 'all') return explicit;

    const plazaStatus = sanitizeText(
        user.plazaAccessStatus ||
        user.plazaMembershipStatus ||
        user.plazaApplicationStatus ||
        user.plazaApplication?.status ||
        ''
    ).toLowerCase();

    if (user.hasPlazaAccess === true || plazaStatus === 'approved') return 'plaza';

    const federationStatus = sanitizeText(
        user.federationMembershipStatus ||
        user.federationApplicationStatus ||
        user.federationApplication?.status ||
        ''
    ).toLowerCase();

    if (user.hasFederationAccess === true || federationStatus === 'approved') return 'federation';

    return 'academy';
}

function getCrossDivisionPublicAvatar(user = {}) {
    return sanitizeText(
        user.avatar ||
        user.avatarUrl ||
        user.avatar_url ||
        user.profilePhoto ||
        user.profile_photo ||
        user.photoURL ||
        user.photoUrl ||
        ''
    );
}

function buildCrossDivisionSearchText(user = {}, id = '') {
    return [
        id,
        user.username,
        user.name,
        user.fullName,
        user.displayName,
        user.email,
        user.role,
        user.roleLabel,
        user.federationRole,
        user.profession,
        user.city,
        user.country,
        user.countryOfResidence,
        user.headline,
        user.bio
    ].map((item) => sanitizeText(item).toLowerCase()).filter(Boolean).join(' ');
}

function mapCrossDivisionBusinessMemberDoc(docSnap) {
    const data = docSnap.data() || {};
    const division = inferUserPrimaryDivision(data);
    const name = sanitizeText(data.fullName || data.name || data.displayName || data.username || 'YH Member');
    const role = sanitizeText(data.roleLabel || data.role || data.federationRole || data.profession || data.headline || 'YH Universe Member');
    const location = [
        sanitizeText(data.city || data.currentCity || ''),
        sanitizeText(data.country || data.countryOfResidence || '')
    ].filter(Boolean).join(', ');

    return {
        id: docSnap.id,
        name,
        username: sanitizeText(data.username || '').replace(/^@+/, ''),
        division,
        divisionLabel: division.charAt(0).toUpperCase() + division.slice(1),
        role,
        location,
        avatar: getCrossDivisionPublicAvatar(data),
        headline: sanitizeText(data.headline || data.bio || role).slice(0, 180)
    };
}

function userHasApprovedPlazaAccess(user = {}) {
    const status = sanitizeText(
        user.plazaAccessStatus ||
        user.plazaMembershipStatus ||
        user.plazaApplicationStatus ||
        user.plazaApplication?.status ||
        user.plaza?.status ||
        ''
    ).toLowerCase();

    return (
        user.hasPlazaAccess === true ||
        user.plazaApproved === true ||
        status === 'approved' ||
        status === 'active'
    );
}

async function getPlazaAccessSnapshotForUser(uid = '') {
    const cleanUid = sanitizeText(uid);

    if (!cleanUid) {
        return { exists: false, hasPlazaAccess: false, data: {} };
    }

    try {
        const snap = await usersCol.doc(cleanUid).get();

        if (!snap.exists) {
            return { exists: false, hasPlazaAccess: false, data: {} };
        }

        const data = snap.data() || {};

        return {
            exists: true,
            hasPlazaAccess: userHasApprovedPlazaAccess(data),
            data
        };
    } catch (_) {
        return { exists: false, hasPlazaAccess: false, data: {} };
    }
}

function buildViewerDivisionLabel(viewerUser = {}, hasPlazaAccess = false) {
    if (hasPlazaAccess) return 'plaza';

    return inferUserPrimaryDivision(viewerUser || {});
}
function normalizePatronPrivilegeList(value = []) {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => sanitizeText(item).toLowerCase())
        .filter(Boolean);
}

function isSameUserId(a = '', b = '') {
    return sanitizeText(a) && sanitizeText(a) === sanitizeText(b);
}

async function findPlazaRegionByRegionName(regionName = '') {
    const cleanRegion = sanitizeText(regionName);

    if (!cleanRegion) return null;

    const snap = await plazaRegionsCol
        .where('region', '==', cleanRegion)
        .limit(1)
        .get();

    if (snap.empty) return null;

    const docSnap = snap.docs[0];

    return {
        id: docSnap.id,
        data: docSnap.data() || {},
        snap: docSnap
    };
}

async function resolvePlazaRegionContext(regionIdOrName = '') {
    const clean = sanitizeText(regionIdOrName);

    if (!clean) return null;

    const directRef = plazaRegionsCol.doc(clean);
    const directSnap = await directRef.get();

    if (directSnap.exists) {
        return {
            id: directSnap.id,
            data: directSnap.data() || {},
            snap: directSnap
        };
    }

    return findPlazaRegionByRegionName(clean);
}

async function resolvePatronRouteMetaForRegion(regionIdOrName = '') {
    const regionContext = await resolvePlazaRegionContext(regionIdOrName);

    if (!regionContext) {
        return {
            routedToPatron: false,
            patronRouteStatus: 'no_region_match',
            patronRegionId: '',
            patronRegion: sanitizeText(regionIdOrName),
            patronUserId: '',
            patronName: '',
            patronRole: ''
        };
    }

    const regionData = regionContext.data || {};
    const patronUserId = sanitizeText(regionData.patronUserId || regionData.leaderUserId || '');
    const patronStatus = sanitizeText(regionData.patronStatus || regionData.leaderStatus || '').toLowerCase();
    const hasActivePatron = Boolean(patronUserId && patronStatus === 'active');

    return {
        routedToPatron: hasActivePatron,
        patronRouteStatus: hasActivePatron ? 'routed_to_patron' : 'open_no_active_patron',
        patronRegionId: regionContext.id,
        patronRegion: sanitizeText(regionData.region || regionData.name || regionIdOrName),
        patronUserId,
        patronName: sanitizeText(regionData.patronName || regionData.leaderName || ''),
        patronRole: sanitizeText(regionData.patronRole || regionData.leaderRole || 'Regional Patron'),
        patronInboxRole: hasActivePatron ? 'plaza-patron' : ''
    };
}

async function getApprovedPatronContextForRegion(regionId = '', viewer = {}, requiredPrivilege = '') {
    const cleanRegionId = sanitizeText(regionId);

    if (!cleanRegionId) {
        return {
            ok: false,
            statusCode: 400,
            message: 'Plaza region is required.'
        };
    }

    const regionRef = plazaRegionsCol.doc(cleanRegionId);
    const regionSnap = await regionRef.get();

    if (!regionSnap.exists) {
        return {
            ok: false,
            statusCode: 404,
            message: 'Plaza region not found.'
        };
    }

    const regionData = regionSnap.data() || {};
    const patronUserId = sanitizeText(regionData.patronUserId || regionData.leaderUserId || '');
    const patronStatus = sanitizeText(regionData.patronStatus || regionData.leaderStatus || '').toLowerCase();

    const userSnap = await usersCol.doc(viewer.id).get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const application =
        userData.plazaPatronApplication && typeof userData.plazaPatronApplication === 'object'
            ? userData.plazaPatronApplication
            : {};

    const userPrivileges = normalizePatronPrivilegeList(userData.plazaPatronPrivileges);
    const regionPrivileges = normalizePatronPrivilegeList(regionData.patronPrivileges);
    const mergedPrivileges = Array.from(new Set([...userPrivileges, ...regionPrivileges]));

    const isAssignedPatron =
        isSameUserId(patronUserId, viewer.id) ||
        isSameUserId(patronUserId, viewer.firebaseUid);

    const hasApprovedRole =
        userData.hasPlazaPatronRole === true &&
        sanitizeText(userData.plazaPatronStatus || userData.plazaPatronApplicationStatus).toLowerCase() === 'approved';

    const applicationMatchesRegion =
        sanitizeText(application.regionId) === cleanRegionId ||
        sanitizeText(application.region) === sanitizeText(regionData.region || regionData.name);

    if (!isAssignedPatron || !hasApprovedRole || !applicationMatchesRegion || patronStatus !== 'active') {
        return {
            ok: false,
            statusCode: 403,
            message: 'Only the approved active Patron for this Plaza can use this Patron benefit.'
        };
    }

    const cleanPrivilege = sanitizeText(requiredPrivilege).toLowerCase();

    if (cleanPrivilege && !mergedPrivileges.includes(cleanPrivilege)) {
        return {
            ok: false,
            statusCode: 403,
            message: `Your Patron role does not include the required privilege: ${cleanPrivilege}.`
        };
    }

    return {
        ok: true,
        regionId: cleanRegionId,
        regionRef,
        regionSnap,
        region: mapPlazaRegionDoc(regionSnap),
        regionData,
        userData,
        privileges: mergedPrivileges
    };
}

function sendPatronContextError(res, context = {}) {
    return res.status(context.statusCode || 403).json({
        success: false,
        message: context.message || 'Patron permission denied.'
    });
}

function calculatePatronCommissionAmount(grossAmount = 0, commissionRate = 10) {
    const gross = Math.max(0, Number(grossAmount || 0));
    const rate = Math.max(0, Math.min(100, Number(commissionRate || 0)));

    return Math.round(((gross * rate) / 100) * 100) / 100;
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
        patronName: sanitizeText(data.patronName || data.leaderName || `${sanitizeText(data.region || data.name || 'Plaza')} Patron`),
        patronRole: sanitizeText(data.patronRole || data.leaderRole || 'Regional Patron'),
        patronUserId: sanitizeText(data.patronUserId || data.leaderUserId || ''),
        patronStatus: sanitizeText(data.patronStatus || data.leaderStatus || 'open'),
        patronContactHint: sanitizeText(
            data.patronContactHint ||
            data.leaderContactHint ||
            'This Plaza is open for an approved Patron or Leader to coordinate networking, meetups, and local movement.'
        ),
        patronBenefits: Array.isArray(data.patronBenefits) ? data.patronBenefits : PLAZA_PATRON_BENEFITS,
        patronPrivileges: Array.isArray(data.patronPrivileges) ? data.patronPrivileges : PLAZA_PATRON_PRIVILEGES,
        patronCommissionPolicy:
            data.patronCommissionPolicy && typeof data.patronCommissionPolicy === 'object'
                ? data.patronCommissionPolicy
                : PLAZA_PATRON_COMMISSION_POLICY,
        patronAuthority:
            data.patronAuthority && typeof data.patronAuthority === 'object'
                ? data.patronAuthority
                : {},
        authorId: sanitizeText(data.authorId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        status: sanitizeText(data.status || 'active'),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function normalizePlazaPatronStatus(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'approved') return 'Approved';
    if (raw === 'rejected') return 'Rejected';
    if (raw === 'waitlisted') return 'Waitlisted';
    if (raw === 'shortlisted') return 'Shortlisted';

    return 'Under Review';
}

function mapPlazaPatronApplicationPayload(application = {}, userId = '') {
    return {
        id: sanitizeText(application.id || ''),
        userId: sanitizeText(application.userId || userId),
        firebaseUid: sanitizeText(application.firebaseUid || ''),
        email: sanitizeText(application.email || '').toLowerCase(),
        fullName: sanitizeText(application.fullName || application.name || 'Plaza Patron Applicant'),
        username: sanitizeText(application.username || ''),
        regionId: sanitizeText(application.regionId || ''),
        region: sanitizeText(application.region || ''),
        continent: sanitizeText(application.continent || ''),
        network: sanitizeText(application.network || ''),
        preferredRole: sanitizeText(application.preferredRole || 'Regional Patron'),
        baseCity: sanitizeText(application.baseCity || ''),
        country: sanitizeText(application.country || ''),
        communicationHandle: sanitizeText(application.communicationHandle || ''),
        leadershipExperience: sanitizeText(application.leadershipExperience || ''),
        plazaPlan: sanitizeText(application.plazaPlan || ''),
        meetupPlan: sanitizeText(application.meetupPlan || ''),
        proofLink: sanitizeText(application.proofLink || ''),
        whyYou: sanitizeText(application.whyYou || ''),
        patronBenefits: Array.isArray(application.patronBenefits) ? application.patronBenefits : PLAZA_PATRON_BENEFITS,
        patronPrivileges: Array.isArray(application.patronPrivileges) ? application.patronPrivileges : PLAZA_PATRON_PRIVILEGES,
        commissionPolicy:
            application.commissionPolicy && typeof application.commissionPolicy === 'object'
                ? application.commissionPolicy
                : PLAZA_PATRON_COMMISSION_POLICY,
        status: normalizePlazaPatronStatus(application.status || 'Under Review'),
        applicationType: 'plaza-patron-leader',
        reviewLane: 'Plaza Patron / Leader',
        source: sanitizeText(application.source || 'Plaza Patron Application'),
        tags: Array.isArray(application.tags) ? application.tags : [],
        notes: Array.isArray(application.notes) ? application.notes : [],
        submittedAt: mapTimestamp(application.submittedAt) || sanitizeText(application.submittedAt || ''),
        reviewedAt: sanitizeText(application.reviewedAt || ''),
        reviewedBy: sanitizeText(application.reviewedBy || ''),
        createdAt: mapTimestamp(application.createdAt) || sanitizeText(application.createdAt || ''),
        updatedAt: mapTimestamp(application.updatedAt) || sanitizeText(application.updatedAt || '')
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

        routedToPatron: data.routedToPatron === true,
        patronRouteStatus: sanitizeText(data.patronRouteStatus || ''),
        patronRegionId: sanitizeText(data.patronRegionId || ''),
        patronRegion: sanitizeText(data.patronRegion || ''),
        patronUserId: sanitizeText(data.patronUserId || ''),
        patronName: sanitizeText(data.patronName || ''),
        patronRole: sanitizeText(data.patronRole || ''),
        patronInboxRole: sanitizeText(data.patronInboxRole || ''),
        patronHandledAt: mapTimestamp(data.patronHandledAt),
        patronHandledBy: sanitizeText(data.patronHandledBy || ''),
        patronActionNote: sanitizeText(data.patronActionNote || ''),
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
        scope: sanitizeText(data.scope || ''),
        sourceDivision: sanitizeText(data.sourceDivision || ''),
        targetDivision: sanitizeText(data.targetDivision || ''),
        businessPurpose: sanitizeText(data.businessPurpose || ''),
        moderation: data.moderation && typeof data.moderation === 'object' ? data.moderation : {},
        reports: Array.isArray(data.reports) ? data.reports : [],
        closedBy: data.closedBy && typeof data.closedBy === 'object' ? data.closedBy : {},
        hiddenBy: data.hiddenBy && typeof data.hiddenBy === 'object' ? data.hiddenBy : {},
        blockedBy: data.blockedBy && typeof data.blockedBy === 'object' ? data.blockedBy : {},
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
function buildConversationFromRegionPayload(regionId = '', regionData = {}, viewer = {}) {
    const nowIso = new Date().toISOString();
    const regionName = sanitizeText(regionData.region || regionData.name || 'YH Plaza');
    const patronName = sanitizeText(regionData.patronName || regionData.leaderName || `${regionName} Patron`);
    const viewerName = sanitizeText(viewer.name || viewer.username || 'Hustler');

    return {
        title: `${regionName} Plaza Chat`,
        queueRole: 'personal',
        linkedRequestId: '',
        linkedInboxId: '',
        targetLabel: regionName,
        targetId: sanitizeText(regionId),
        regionId: sanitizeText(regionId),
        contextTitle: `${regionName} networking, meetups, and regional coordination`,
        contextRoute: 'Regional Plaza Chat',
        participants: [viewerName, patronName, regionName]
            .filter(Boolean)
            .filter((value, index, arr) => arr.indexOf(value) === index),
        participantIds: [sanitizeText(viewer.id)].filter(Boolean),
        status: 'active',
        messages: [
            {
                id: `message-${Date.now()}-system`,
                sender: 'Plaza System',
                type: 'system',
                text: `Regional Plaza chat opened for ${regionName}. Patron/Leader: ${patronName}.`,
                createdAt: nowIso
            }
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

function normalizeMeetupFormat(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'online') return 'online';
    if (raw === 'hybrid') return 'hybrid';

    return 'in-person';
}

function mapPlazaMeetupDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        title: sanitizeText(data.title || 'Plaza meetup'),
        regionId: sanitizeText(data.regionId || ''),
        region: sanitizeText(data.region || 'YH Plaza'),
        format: normalizeMeetupFormat(data.format),
        location: sanitizeText(data.location || ''),
        scheduledAt: sanitizeText(data.scheduledAt || data.startsAt || ''),
        description: sanitizeText(data.description || data.text || ''),
        patronName: sanitizeText(data.patronName || 'Plaza Patron'),
        patronRole: sanitizeText(data.patronRole || 'Regional Patron'),
        isOfficial: data.isOfficial === true,
        officialByPatron: data.officialByPatron === true,
        officialPatronUserId: sanitizeText(data.officialPatronUserId || ''),
        officialPatronName: sanitizeText(data.officialPatronName || ''),
        patronStatusNote: sanitizeText(data.patronStatusNote || ''),
        featuredByPatron: data.featuredByPatron === true,
        hostId: sanitizeText(data.hostId || data.authorId || ''),
        hostName: sanitizeText(data.hostName || data.authorName || 'Hustler'),
        attendeeIds: Array.isArray(data.attendeeIds)
            ? data.attendeeIds.map((item) => sanitizeText(item)).filter(Boolean)
            : [],
        attendees: Array.isArray(data.attendees)
            ? data.attendees.map((item) => sanitizeText(item)).filter(Boolean)
            : [],
        attendeeCount: Number.isFinite(Number(data.attendeeCount))
            ? Number(data.attendeeCount)
            : Array.isArray(data.attendeeIds)
                ? data.attendeeIds.length
                : 0,
        status: sanitizeText(data.status || 'planned'),
        recordStatus: sanitizeText(data.recordStatus || 'active'),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
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

        const activePatronSnaps = await plazaRegionsCol
            .where('patronStatus', '==', 'active')
            .limit(200)
            .get();

        const patronRegionByUserId = new Map();

        activePatronSnaps.forEach((docSnap) => {
            const regionData = docSnap.data() || {};
            const patronUserId = sanitizeText(regionData.patronUserId || '');

            if (!patronUserId) return;

            patronRegionByUserId.set(patronUserId, {
                regionId: docSnap.id,
                region: sanitizeText(regionData.region || regionData.name || ''),
                patronName: sanitizeText(regionData.patronName || ''),
                patronRole: sanitizeText(regionData.patronRole || 'Regional Patron')
            });
        });

        const hydratedDirectory = await hydratePlazaOwnerProfiles(directory);

        const prioritizedDirectory = hydratedDirectory
            .map((item) => {
                const ownerId = sanitizeText(item.userId || item.authorId || item.id);
                const patronRegion = patronRegionByUserId.get(ownerId) || null;

                return {
                    ...item,
                    isPlazaPatron: Boolean(patronRegion),
                    patronRegionId: patronRegion?.regionId || '',
                    patronRegion: patronRegion?.region || '',
                    patronRole: patronRegion?.patronRole || ''
                };
            })
            .sort((a, b) => {
                if (a.isPlazaPatron !== b.isPlazaPatron) {
                    return a.isPlazaPatron ? -1 : 1;
                }

                return String(b.updatedAt || b.createdAt || '').localeCompare(
                    String(a.updatedAt || a.createdAt || '')
                );
            });

        return res.json({
            success: true,
            directory: prioritizedDirectory
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
        const patronName = clampText(req.body?.patronName || req.body?.leaderName || `${region} Patron`, 140);
        const patronRole = clampText(req.body?.patronRole || req.body?.leaderRole || 'Regional Patron', 100);
        const patronUserId = clampText(req.body?.patronUserId || req.body?.leaderUserId, 120);
        const patronContactHint = clampText(
            req.body?.patronContactHint ||
            req.body?.leaderContactHint ||
            `Responsible for coordination, networking, and meetup leadership inside ${region}.`,
            300
        );
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
        const patronRouteMeta = await resolvePatronRouteMetaForRegion(region);

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
            patronName,
            patronRole,
            patronUserId,
            patronStatus: patronUserId ? 'active' : 'open',
            patronContactHint,
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
exports.getPatronApplicationStatus = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const userSnap = await usersCol.doc(viewer.id).get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        const application =
            user.plazaPatronApplication && typeof user.plazaPatronApplication === 'object'
                ? user.plazaPatronApplication
                : null;

        return res.json({
            success: true,
            hasApplication: Boolean(application),
            status: application
                ? normalizePlazaPatronStatus(application.status || user.plazaPatronApplicationStatus)
                : '',
            application: application
                ? mapPlazaPatronApplicationPayload(application, viewer.id)
                : null
        });
    } catch (error) {
        console.error('plazaControllers.getPatronApplicationStatus error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Patron application status.'
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

        const userRef = usersCol.doc(viewer.id);
        const userSnap = await userRef.get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};

        const plazaStatus = sanitizeText(
            user.plazaMembershipStatus ||
            user.plazaAccessStatus ||
            user.plazaApplicationStatus ||
            user.plazaApplication?.status ||
            ''
        ).toLowerCase();

        const hasPlazaAccess =
            user.hasPlazaAccess === true ||
            plazaStatus === 'approved';

        if (!hasPlazaAccess) {
            return res.status(403).json({
                success: false,
                message: 'You need approved Plaza access before applying to become a Patron or Leader.'
            });
        }

        const regionId = sanitizeText(req.body?.regionId || req.body?.region_id);
        const preferredRole = clampText(req.body?.preferredRole || req.body?.role || 'Regional Patron', 100);
        const fullName = clampText(
            req.body?.fullName ||
            req.body?.name ||
            user.fullName ||
            user.name ||
            user.displayName ||
            viewer.name,
            140
        );
        const baseCity = clampText(req.body?.baseCity || req.body?.city, 100);
        const country = clampText(req.body?.country || user.country, 100);
        const communicationHandle = clampText(req.body?.communicationHandle || req.body?.telegram || req.body?.contact, 160);
        const leadershipExperience = clampText(req.body?.leadershipExperience || req.body?.experience, 1200);
        const plazaPlan = clampText(req.body?.plazaPlan || req.body?.plan, 1200);
        const meetupPlan = clampText(req.body?.meetupPlan || req.body?.meetups, 900);
        const proofLink = clampText(req.body?.proofLink || req.body?.profileLink || req.body?.portfolio, 260);
        const whyYou = clampText(req.body?.whyYou || req.body?.why, 900);

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

        const regionSnap = await plazaRegionsCol.doc(regionId).get();

        if (!regionSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Selected Plaza was not found.'
            });
        }

        const regionData = regionSnap.data() || {};
        const now = Timestamp.now();
        const nowIso = new Date().toISOString();

        const existingApplication =
            user.plazaPatronApplication && typeof user.plazaPatronApplication === 'object'
                ? user.plazaPatronApplication
                : {};

        const applicationId = sanitizeText(existingApplication.id || `PLAZA-PATRON-${Date.now()}-${viewer.id}`);

        const application = {
            id: applicationId,
            userId: viewer.id,
            firebaseUid: viewer.firebaseUid,
            email: viewer.email,
            fullName,
            username: sanitizeText(user.username || viewer.username),
            regionId,
            region: sanitizeText(regionData.region || regionData.name || 'YH Plaza'),
            continent: sanitizeText(regionData.continent || ''),
            network: sanitizeText(regionData.network || ''),
            preferredRole,
            baseCity,
            country,
            communicationHandle,
            leadershipExperience,
            plazaPlan,
            meetupPlan,
            proofLink,
            whyYou,
            patronBenefits: PLAZA_PATRON_BENEFITS,
            patronPrivileges: PLAZA_PATRON_PRIVILEGES,
            commissionPolicy: PLAZA_PATRON_COMMISSION_POLICY,
            status: 'Under Review',
            applicationType: 'plaza-patron-leader',
            reviewLane: 'Plaza Patron / Leader',
            source: 'Plaza Patron Application',
            tags: [
                'plaza-patron',
                sanitizeText(regionData.continent || ''),
                sanitizeText(regionData.network || ''),
                preferredRole
            ].filter(Boolean),
            notes: [
                'Submitted from the internal Plaza Patron / Leader application form.'
            ],
            submittedAt: nowIso,
            createdAt: existingApplication.createdAt || now,
            updatedAt: now
        };

        await userRef.set({
            plazaPatronApplication: application,
            plazaPatronApplicationStatus: 'Under Review',
            plazaPatronStatus: 'under review',
            updatedAt: nowIso
        }, { merge: true });

        await plazaPatronApplicationsCol.doc(applicationId).set({
            ...application,
            createdAt: existingApplication.createdAt || now,
            updatedAt: now
        }, { merge: true });

        return res.status(existingApplication.id ? 200 : 201).json({
            success: true,
            hasApplication: true,
            status: 'Under Review',
            application: mapPlazaPatronApplicationPayload(application, viewer.id)
        });
    } catch (error) {
        console.error('plazaControllers.submitPatronApplication error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to submit Patron application.'
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

        const userSnap = await usersCol.doc(viewer.id).get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};
        const application =
            user.plazaPatronApplication && typeof user.plazaPatronApplication === 'object'
                ? user.plazaPatronApplication
                : {};

        if (user.hasPlazaPatronRole !== true || sanitizeText(user.plazaPatronStatus).toLowerCase() !== 'approved') {
            return res.json({
                success: true,
                isPatron: false,
                patron: null,
                regions: [],
                routedRequests: [],
                recommendations: [],
                payouts: [],
                walletPayouts: [],
                message: 'Patron Desk unlocks after admin approves your Plaza Patron application.'
            });
        }

        const regionId = sanitizeText(application.regionId);

        if (!regionId) {
            return res.json({
                success: true,
                isPatron: false,
                patron: null,
                regions: [],
                routedRequests: [],
                recommendations: [],
                payouts: [],
                walletPayouts: [],
                message: 'No Patron region is attached to this account yet.'
            });
        }

        const patronContext = await getApprovedPatronContextForRegion(regionId, viewer);

        if (!patronContext.ok) {
            return sendPatronContextError(res, patronContext);
        }

        const routedRequestsSnap = await plazaRequestsCol
            .where('patronUserId', '==', viewer.id)
            .limit(120)
            .get();

        const routedRequests = [];

        routedRequestsSnap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const recordStatus = sanitizeText(data.recordStatus || 'active').toLowerCase();

            if (recordStatus !== 'active') return;

            routedRequests.push(mapPlazaRequestDoc(docSnap));
        });

        routedRequests.sort((a, b) => {
            return String(b.updatedAt || b.createdAt || '').localeCompare(
                String(a.updatedAt || a.createdAt || '')
            );
        });

        const meetupsSnap = await plazaMeetupsCol
            .where('officialPatronUserId', '==', viewer.id)
            .limit(80)
            .get();

        const meetups = [];

        meetupsSnap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const recordStatus = sanitizeText(data.recordStatus || 'active').toLowerCase();

            if (recordStatus === 'deleted') return;

            meetups.push(mapPlazaMeetupDoc(docSnap));
        });

        const recommendationsSnap = await plazaPatronRecommendationsCol
            .where('patronUserId', '==', viewer.id)
            .limit(80)
            .get();

        const recommendations = [];

        recommendationsSnap.forEach((docSnap) => {
            const data = docSnap.data() || {};

            recommendations.push({
                id: docSnap.id,
                memberId: sanitizeText(data.memberId || ''),
                memberName: sanitizeText(data.memberName || ''),
                regionId: sanitizeText(data.regionId || ''),
                region: sanitizeText(data.region || ''),
                reason: sanitizeText(data.reason || ''),
                status: sanitizeText(data.status || 'pending_admin_review'),
                createdAt: mapTimestamp(data.createdAt),
                updatedAt: mapTimestamp(data.updatedAt)
            });
        });

        const payoutsSnap = await plazaPatronPayoutsCol
            .where('patronUserId', '==', viewer.id)
            .limit(80)
            .get();

        const payouts = [];

        payoutsSnap.forEach((docSnap) => {
            const data = docSnap.data() || {};

            payouts.push({
                id: docSnap.id,
                outcomeId: sanitizeText(data.outcomeId || ''),
                payoutLedgerId: sanitizeText(data.payoutLedgerId || ''),
                payoutLedgerStatus: sanitizeText(data.payoutLedgerStatus || data.status || 'pending_review'),
                regionId: sanitizeText(data.regionId || ''),
                region: sanitizeText(data.region || ''),
                grossAmount: Number(data.grossAmount || 0),
                commissionRate: Number(data.commissionRate || 0),
                commissionAmount: Number(data.commissionAmount || 0),
                currency: sanitizeText(data.currency || 'USD'),
                status: sanitizeText(data.status || 'pending_admin_review'),
                adminNote: sanitizeText(data.adminNote || ''),
                provider: sanitizeText(data.provider || 'manual'),
                providerPaymentId: sanitizeText(data.providerPaymentId || ''),
                createdAt: mapTimestamp(data.createdAt),
                updatedAt: mapTimestamp(data.updatedAt),
                paidAt: mapTimestamp(data.paidAt)
            });
        });

        const walletPayouts = await paymentLedgerRepo
            .listPayoutsForUser(viewer.id, 120)
            .then((items) => {
                return items.filter((item) => {
                    return sanitizeText(item.sourceDivision).toLowerCase() === 'plaza' &&
                        sanitizeText(item.sourceFeature).toLowerCase() === 'plaza_patron_commission';
                });
            })
            .catch(() => []);

        return res.json({
            success: true,
            patron: {
                userId: viewer.id,
                name: viewer.name,
                regionId,
                region: patronContext.region,
                privileges: patronContext.privileges,
                commissionPolicy: user.plazaPatronCommissionPolicy || PLAZA_PATRON_COMMISSION_POLICY
            },
            routedRequests,
            officialMeetups: meetups,
            recommendations,
            payouts,
            walletPayouts
        });
    } catch (error) {
        console.error('plazaControllers.getPatronDesk error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Patron Desk.'
        });
    }
};

exports.createPatronAnnouncement = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const regionId = sanitizeText(req.body?.regionId || req.body?.region_id);
        const title = clampText(req.body?.title || 'Patron announcement', 140);
        const text = clampText(req.body?.text || req.body?.message || req.body?.body, 1200);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Announcement text is required.'
            });
        }

        const patronContext = await getApprovedPatronContextForRegion(regionId, viewer, 'lead_regional_chat');

        if (!patronContext.ok) {
            return sendPatronContextError(res, patronContext);
        }

        const now = Timestamp.now();
        const regionName = sanitizeText(patronContext.regionData.region || patronContext.regionData.name || 'YH Plaza');

        const payload = {
            title,
            text,
            regionId,
            region: regionName,
            patronUserId: viewer.id,
            patronName: viewer.name,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        const ref = await plazaPatronAnnouncementsCol.add(payload);

        const conversationId = `region_${regionId}`;
        const conversationRef = plazaConversationsCol.doc(conversationId);
        const conversationSnap = await conversationRef.get();

        if (conversationSnap.exists) {
            const conversationData = conversationSnap.data() || {};
            const messages = normalizeConversationMessages(conversationData.messages);

            messages.push({
                id: `patron-announcement-${Date.now()}`,
                sender: viewer.name || 'Plaza Patron',
                type: 'patron_announcement',
                text: `${title}: ${text}`,
                createdAt: new Date().toISOString()
            });

            await conversationRef.set({
                messages,
                updatedAt: Timestamp.now()
            }, { merge: true });
        }

        return res.status(201).json({
            success: true,
            announcement: {
                id: ref.id,
                ...payload,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('plazaControllers.createPatronAnnouncement error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Patron announcement.'
        });
    }
};

exports.updatePatronRoutedRequestStatus = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const requestId = sanitizeText(req.params.id);
        const nextStatus = normalizeRequestStatus(req.body?.status || 'Under Review');
        const patronActionNote = clampText(req.body?.note || req.body?.patronActionNote, 900);

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
        const regionId = sanitizeText(current.patronRegionId || '');

        const patronContext = await getApprovedPatronContextForRegion(regionId, viewer, 'route_connection_requests');

        if (!patronContext.ok) {
            return sendPatronContextError(res, patronContext);
        }

        if (sanitizeText(current.patronUserId) !== viewer.id) {
            return res.status(403).json({
                success: false,
                message: 'This request is not routed to your Patron Desk.'
            });
        }

        const statusHistory = Array.isArray(current.statusHistory)
            ? [...current.statusHistory]
            : [];

        statusHistory.push({
            status: nextStatus,
            at: new Date().toISOString(),
            by: viewer.id,
            byRole: 'plaza-patron'
        });

        await ref.set({
            status: nextStatus,
            patronRouteStatus: 'handled_by_patron',
            patronHandledAt: Timestamp.now(),
            patronHandledBy: viewer.id,
            patronActionNote,
            statusHistory,
            updatedAt: Timestamp.now()
        }, { merge: true });

        const updatedSnap = await ref.get();

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

        return res.json({
            success: true,
            request: mapPlazaRequestDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.updatePatronRoutedRequestStatus error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update routed Patron request.'
        });
    }
};

exports.createPatronFederationRecommendation = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const regionId = sanitizeText(req.body?.regionId || req.body?.region_id);
        const memberId = sanitizeText(req.body?.memberId || req.body?.targetUserId || req.body?.userId);
        const memberName = clampText(req.body?.memberName || req.body?.name, 160);
        const reason = clampText(req.body?.reason || req.body?.message || req.body?.why, 1400);
        const recommendedRole = clampText(req.body?.recommendedRole || req.body?.role, 160);
        const proofLink = clampText(req.body?.proofLink || req.body?.link, 260);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!memberId && !memberName) {
            return res.status(400).json({
                success: false,
                message: 'Member ID or member name is required.'
            });
        }

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Recommendation reason is required.'
            });
        }

        const patronContext = await getApprovedPatronContextForRegion(regionId, viewer, 'recommend_federation_candidates');

        if (!patronContext.ok) {
            return sendPatronContextError(res, patronContext);
        }

        const now = Timestamp.now();
        const regionName = sanitizeText(patronContext.regionData.region || patronContext.regionData.name || '');

        const payload = {
            memberId,
            memberName,
            reason,
            recommendedRole,
            proofLink,
            regionId,
            region: regionName,
            patronUserId: viewer.id,
            patronName: viewer.name,
            status: 'pending_admin_review',
            reviewLane: 'Federation Recommendation',
            source: 'Plaza Patron Recommendation',
            createdAt: now,
            updatedAt: now
        };

        const ref = await plazaPatronRecommendationsCol.add(payload);

        return res.status(201).json({
            success: true,
            recommendation: {
                id: ref.id,
                ...payload,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('plazaControllers.createPatronFederationRecommendation error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Federation recommendation.'
        });
    }
};

exports.createPatronIntroOutcome = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const regionId = sanitizeText(req.body?.regionId || req.body?.region_id);
        const introTitle = clampText(req.body?.introTitle || req.body?.title, 180);
        const introSummary = clampText(req.body?.introSummary || req.body?.summary || req.body?.description, 1600);
        const connectedParties = normalizeRequestTagArray(req.body?.connectedParties, 12);
        const grossAmount = Math.max(0, Number(req.body?.grossAmount || req.body?.dealValue || 0));
        const currency = sanitizeText(req.body?.currency || 'USD').toUpperCase() || 'USD';
        const commissionRate = Math.max(5, Math.min(15, Number(req.body?.commissionRate || 10)));
        const commissionAmount = calculatePatronCommissionAmount(grossAmount, commissionRate);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!introTitle || !introSummary) {
            return res.status(400).json({
                success: false,
                message: 'Intro title and summary are required.'
            });
        }

        const patronContext = await getApprovedPatronContextForRegion(regionId, viewer, 'receive_connection_commission_eligibility');

        if (!patronContext.ok) {
            return sendPatronContextError(res, patronContext);
        }

        const now = Timestamp.now();
        const regionName = sanitizeText(patronContext.regionData.region || patronContext.regionData.name || '');

        const outcomePayload = {
            introTitle,
            introSummary,
            connectedParties,
            grossAmount,
            currency,
            commissionRate,
            commissionAmount,
            regionId,
            region: regionName,
            patronUserId: viewer.id,
            patronName: viewer.name,
            status: 'pending_admin_review',
            payoutStatus: grossAmount > 0 ? 'eligible_pending_admin_review' : 'no_monetary_value_logged',
            source: 'Plaza Patron Intro Outcome',
            createdAt: now,
            updatedAt: now
        };

        const outcomeRef = await plazaPatronIntroOutcomesCol.add(outcomePayload);

        let payout = null;
        let walletPayout = null;

        if (commissionAmount > 0) {
            const payoutPayload = {
                outcomeId: outcomeRef.id,
                payoutLedgerId: '',
                payoutLedgerStatus: 'pending_review',
                regionId,
                region: regionName,
                patronUserId: viewer.id,
                patronName: viewer.name,
                grossAmount,
                commissionRate,
                commissionAmount,
                currency,
                status: 'pending_review',
                source: 'Plaza Patron Commission',
                provider: 'manual',
                providerPaymentId: '',
                adminNote: 'Awaiting admin review and manual payout disbursement.',
                createdAt: now,
                updatedAt: now
            };

            const payoutRef = await plazaPatronPayoutsCol.add(payoutPayload);

            walletPayout = await paymentLedgerRepo.createPayoutRequest({
                receiverUid: viewer.id,
                receiverEmail: viewer.email,
                receiverName: viewer.name,

                sourceDivision: 'plaza',
                sourceFeature: 'plaza_patron_commission',
                sourcePaymentId: outcomeRef.id,
                sourceRecordId: `patron_intro_${outcomeRef.id}`,

                method: 'manual',
                provider: 'manual',

                amount: commissionAmount,
                currency,

                status: 'pending_review',
                adminNote: 'Patron intro commission requires admin review before disbursement.',

                metadata: {
                    requestSource: 'plaza_patron_intro_outcome',
                    patronPayoutRecordId: payoutRef.id,
                    outcomeId: outcomeRef.id,
                    regionId,
                    region: regionName,
                    patronUserId: viewer.id,
                    patronName: viewer.name,
                    grossAmount,
                    commissionRate,
                    commissionAmount,
                    currency,
                    payoutUnlockRule: 'Admin must verify the intro outcome and then mark payout as approved/processing/paid.'
                }
            });

            await payoutRef.set({
                payoutLedgerId: walletPayout.id,
                payoutLedgerStatus: walletPayout.status,
                updatedAt: Timestamp.now()
            }, { merge: true });

            await outcomeRef.set({
                payoutLedgerId: walletPayout.id,
                payoutRecordId: payoutRef.id,
                payoutStatus: walletPayout.status,
                updatedAt: Timestamp.now()
            }, { merge: true });

            payout = {
                id: payoutRef.id,
                ...payoutPayload,
                payoutLedgerId: walletPayout.id,
                payoutLedgerStatus: walletPayout.status,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }

        return res.status(201).json({
            success: true,
            outcome: {
                id: outcomeRef.id,
                ...outcomePayload,
                payoutLedgerId: walletPayout?.id || '',
                payoutRecordId: payout?.id || '',
                payoutStatus: walletPayout?.status || outcomePayload.payoutStatus,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            payout,
            walletPayout
        });
    } catch (error) {
        console.error('plazaControllers.createPatronIntroOutcome error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to log Patron intro outcome.'
        });
    }
};

exports.updatePatronMeetupStatus = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const meetupId = sanitizeText(req.params.id);
        const status = clampText(req.body?.status || 'planned', 80, 'planned') || 'planned';
        const patronStatusNote = clampText(req.body?.patronStatusNote || req.body?.note, 900);
        const featuredByPatron =
            req.body?.featuredByPatron === true ||
            sanitizeText(req.body?.featuredByPatron).toLowerCase() === 'true';

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!meetupId) {
            return res.status(400).json({
                success: false,
                message: 'Meetup ID is required.'
            });
        }

        const ref = plazaMeetupsCol.doc(meetupId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Meetup not found.'
            });
        }

        const meetup = snap.data() || {};
        const regionId = sanitizeText(meetup.regionId || '');

        const patronContext = await getApprovedPatronContextForRegion(regionId, viewer, 'create_official_meetups');

        if (!patronContext.ok) {
            return sendPatronContextError(res, patronContext);
        }

        await ref.set({
            status,
            isOfficial: true,
            officialByPatron: true,
            officialPatronUserId: viewer.id,
            officialPatronName: viewer.name,
            featuredByPatron,
            patronStatusNote,
            updatedAt: Timestamp.now()
        }, { merge: true });

        const updatedSnap = await ref.get();

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

        return res.json({
            success: true,
            meetup: mapPlazaMeetupDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.updatePatronMeetupStatus error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update Patron meetup status.'
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
            ...patronRouteMeta,
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
        const patronRouteMeta = await resolvePatronRouteMetaForRegion(region);

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
            ...patronRouteMeta,
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

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

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

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

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
exports.getMeetups = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 80, 1),
            160
        );

        const snap = await plazaMeetupsCol
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const meetups = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const recordStatus = sanitizeText(data.recordStatus || 'active').toLowerCase();

            if (recordStatus === 'deleted') return;

            meetups.push(mapPlazaMeetupDoc(docSnap));
        });

        return res.json({
            success: true,
            meetups
        });
    } catch (error) {
        console.error('plazaControllers.getMeetups error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza meetups.'
        });
    }
};

exports.createMeetup = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const regionId = sanitizeText(req.body?.regionId || req.body?.region_id);
        const title = clampText(req.body?.title, 140);
        const format = normalizeMeetupFormat(req.body?.format);
        const location = clampText(req.body?.location, 180);
        const scheduledAt = clampText(req.body?.scheduledAt || req.body?.startsAt, 80);
        const description = clampText(
            req.body?.description ||
            req.body?.text ||
            req.body?.body,
            1200
        );

        if (!regionId) {
            return res.status(400).json({
                success: false,
                message: 'Plaza region is required.'
            });
        }

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Meetup title is required.'
            });
        }

        if (!location) {
            return res.status(400).json({
                success: false,
                message: 'Meetup location or link is required.'
            });
        }

        if (!scheduledAt) {
            return res.status(400).json({
                success: false,
                message: 'Meetup date and time is required.'
            });
        }

        if (!description) {
            return res.status(400).json({
                success: false,
                message: 'Meetup brief is required.'
            });
        }

        const regionSnap = await plazaRegionsCol.doc(regionId).get();

        if (!regionSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Plaza region not found.'
            });
        }

        const regionData = regionSnap.data() || {};
        const region = sanitizeText(regionData.region || regionData.name || 'YH Plaza');
        const patronName = sanitizeText(regionData.patronName || regionData.leaderName || `${region} Patron`);
        const patronRole = sanitizeText(regionData.patronRole || regionData.leaderRole || 'Regional Patron');
        const wantsOfficialMeetup =
            req.body?.isOfficial === true ||
            req.body?.official === true ||
            sanitizeText(req.body?.isOfficial || req.body?.official).toLowerCase() === 'true';

        let patronContext = null;

        if (wantsOfficialMeetup) {
            patronContext = await getApprovedPatronContextForRegion(regionSnap.id, viewer, 'create_official_meetups');

            if (!patronContext.ok) {
                return sendPatronContextError(res, patronContext);
            }
        }

        const now = Timestamp.now();

        const payload = {
            title,
            regionId,
            region,
            format,
            location,
            scheduledAt,
            description,
            patronName,
            patronRole,
            isOfficial: wantsOfficialMeetup,
            officialByPatron: wantsOfficialMeetup,
            officialPatronUserId: wantsOfficialMeetup ? viewer.id : '',
            officialPatronName: wantsOfficialMeetup ? viewer.name : '',
            patronStatusNote: wantsOfficialMeetup ? 'Official Patron-led Plaza meetup.' : '',
            featuredByPatron: wantsOfficialMeetup,
            hostId: viewer.id,
            hostFirebaseUid: viewer.firebaseUid,
            hostEmail: viewer.email,
            hostName: viewer.name,
            attendeeIds: [viewer.id].filter(Boolean),
            attendees: [viewer.name].filter(Boolean),
            attendeeCount: 1,
            status: 'planned',
            recordStatus: 'active',
            createdAt: now,
            updatedAt: now
        };

        const ref = await plazaMeetupsCol.add(payload);
        const createdSnap = await ref.get();

        return res.status(201).json({
            success: true,
            meetup: mapPlazaMeetupDoc(createdSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createMeetup error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza meetup.'
        });
    }
};

exports.getBusinessMembers = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({ success: false, message: 'Missing authenticated user.' });
        }

        const viewerAccess = await getPlazaAccessSnapshotForUser(viewer.id);
        const viewerHasPlazaAccess = viewerAccess.hasPlazaAccess;
        const requestedDivisionRaw = normalizeCrossDivisionLabel(req.query.division || 'all') || 'all';
        const requestedDivision = viewerHasPlazaAccess ? requestedDivisionRaw : 'plaza';
        const search = sanitizeText(req.query.q || req.query.search || '').toLowerCase();
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 80, 1), 120);
        const blockedBusinessUserIds = await getBusinessUserBlockSetForViewer(viewer.id);
        const snap = await usersCol.limit(450).get();
        const members = [];

        snap.forEach((docSnap) => {
            if (docSnap.id === viewer.id) return;
            if (blockedBusinessUserIds.has(docSnap.id)) return;

            const data = docSnap.data() || {};
            const recordStatus = sanitizeText(data.recordStatus || data.status || 'active').toLowerCase();

            if (recordStatus === 'deleted' || recordStatus === 'banned' || recordStatus === 'suspended') return;

            const member = mapCrossDivisionBusinessMemberDoc(docSnap);

            if (!viewerHasPlazaAccess && member.division !== 'plaza') return;
            if (!viewerHasPlazaAccess && !userHasApprovedPlazaAccess(data)) return;
            if (requestedDivision !== 'all' && member.division !== requestedDivision) return;
            if (search && !buildCrossDivisionSearchText(data, docSnap.id).includes(search)) return;

            members.push(member);
        });

        members.sort((left, right) => {
            const order = { plaza: 0, federation: 1, academy: 2 };
            const leftOrder = order[left.division] ?? 9;
            const rightOrder = order[right.division] ?? 9;

            if (leftOrder !== rightOrder) return leftOrder - rightOrder;
            return String(left.name || '').localeCompare(String(right.name || ''));
        });

        return res.json({ success: true, members: members.slice(0, limit) });
    } catch (error) {
        console.error('plazaControllers.getBusinessMembers error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load cross-division business members.'
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
            const hiddenBy = data.hiddenBy && typeof data.hiddenBy === 'object' ? data.hiddenBy : {};
            const blockedBy = data.blockedBy && typeof data.blockedBy === 'object' ? data.blockedBy : {};

            if (recordStatus !== 'active') return;
            if (hiddenBy[viewer.id] === true) return;

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

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

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
exports.createConversationFromRegion = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const regionId = sanitizeText(req.params.regionId);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!regionId) {
            return res.status(400).json({
                success: false,
                message: 'Region ID is required.'
            });
        }

        const regionRef = plazaRegionsCol.doc(regionId);
        const regionSnap = await regionRef.get();

        if (!regionSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Plaza region not found.'
            });
        }

        const regionData = regionSnap.data() || {};
        const conversationId = `region_${regionId}`;
        const conversationRef = plazaConversationsCol.doc(conversationId);
        const conversationSnap = await conversationRef.get();

        if (!conversationSnap.exists) {
            const payload = buildConversationFromRegionPayload(regionId, regionData, viewer);

            await conversationRef.set(payload, { merge: true });
        } else {
            const existing = conversationSnap.data() || {};
            const participantIds = normalizeConversationParticipants(existing.participantIds);
            const participants = normalizeConversationParticipants(existing.participants);
            const viewerName = sanitizeText(viewer.name || viewer.username || 'Hustler');

            await conversationRef.set({
                participantIds: participantIds.includes(viewer.id)
                    ? participantIds
                    : [...participantIds, viewer.id],
                participants: participants.includes(viewerName)
                    ? participants
                    : [...participants, viewerName],
                updatedAt: Timestamp.now()
            }, { merge: true });
        }

        const updatedSnap = await conversationRef.get();

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

        return res.status(conversationSnap.exists ? 200 : 201).json({
            success: true,
            conversation: mapPlazaConversationDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createConversationFromRegion error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to open regional Plaza conversation.'
        });
    }
};

exports.createConversationFromBusinessMember = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const targetUserId = sanitizeText(req.params.targetUserId || req.body?.targetUserId);
        const businessPurpose = clampText(
            req.body?.businessPurpose ||
            req.body?.purpose ||
            'Business collaboration',
            140,
            'Business collaboration'
        );

        const initialMessage = clampText(req.body?.message || req.body?.initialMessage || '', 1200);

        if (!viewer.id) {
            return res.status(401).json({ success: false, message: 'Missing authenticated user.' });
        }

        if (!targetUserId) {
            return res.status(400).json({ success: false, message: 'Target member id is required.' });
        }

        if (targetUserId === viewer.id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot open a business conversation with yourself.'
            });
        }

        const viewerAccess = await getPlazaAccessSnapshotForUser(viewer.id);
        const viewerHasPlazaAccess = viewerAccess.hasPlazaAccess;
        const viewerDivision = buildViewerDivisionLabel(viewerAccess.data, viewerHasPlazaAccess);

        const targetSnap = await usersCol.doc(targetUserId).get();

        if (!targetSnap.exists) {
            return res.status(404).json({ success: false, message: 'Target member was not found.' });
        }

        const targetUser = targetSnap.data() || {};
        await assertNoActiveBusinessUserBlockBetween(viewer.id, targetUserId);
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
            targetUser.headline ||
            'YH Universe Member'
        );

        const targetHasPlazaAccess = userHasApprovedPlazaAccess(targetUser);
        const targetDivision = inferUserPrimaryDivision(targetUser);

        if (!viewerHasPlazaAccess && !targetHasPlazaAccess) {
            return res.status(403).json({
                success: false,
                message: 'Only Plaza members can start business chats with non-Plaza members. You can start business chats with approved Plaza members only.'
            });
        }

        const targetLocation = sanitizeText(
            targetUser.city ||
            targetUser.currentCity ||
            targetUser.country ||
            targetUser.countryOfResidence ||
            'YH Universe'
        );

        const participantKey = [viewer.id, targetUserId].sort().join('_');
        const conversationId = 'business_' + participantKey;
        const conversationRef = plazaConversationsCol.doc(conversationId);
        const conversationSnap = await conversationRef.get();
        const nowIso = new Date().toISOString();

        if (!conversationSnap.exists) {
            await conversationRef.set({
                title: 'Plaza Business Chat: ' + viewerName + ' ↔ ' + targetName,
                queueRole: 'personal',
                linkedRequestId: '',
                linkedInboxId: '',
                targetLabel: targetName,
                targetId: targetUserId,
                contextTitle: targetRole + ' • ' + targetLocation,
                contextRoute: 'Cross-Division Business Conversation',
                scope: 'cross_division_business',
                sourceDivision: viewerDivision,
                targetDivision,
                businessPurpose,
                participantDivisions: {
                    [viewer.id]: viewerDivision,
                    [targetUserId]: targetDivision
                },
                participantRoles: {
                    [viewer.id]: viewerHasPlazaAccess ? 'Plaza member' : viewerDivision.charAt(0).toUpperCase() + viewerDivision.slice(1) + ' member',
                    [targetUserId]: targetRole
                },
                participants: [viewerName, targetName].filter(Boolean),
                participantIds: [viewer.id, targetUserId]
                    .filter(Boolean)
                    .filter((value, index, arr) => arr.indexOf(value) === index),
                status: 'active',
                messages: [
                    {
                        id: 'message-' + Date.now() + '-system',
                        sender: 'Plaza System',
                        type: 'system',
                        text:
                            'Cross-division business conversation opened from ' +
                            viewerDivision +
                            '. Purpose: ' +
                            businessPurpose +
                            '. Target: ' +
                            targetName +
                            ' (' +
                            targetDivision +
                            ').',
                        createdAt: nowIso
                    },
                    ...(initialMessage
                        ? [{
                            id: 'message-' + Date.now() + '-intro',
                            sender: viewerName,
                            type: 'message',
                            text: initialMessage,
                            createdAt: nowIso
                        }]
                        : [])
                ],
                authorId: viewer.id,
                authorFirebaseUid: viewer.firebaseUid,
                authorEmail: sanitizeText(viewer.email).toLowerCase(),
                authorName: viewerName,
                recordStatus: 'active',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            }, { merge: true });
        } else if (initialMessage) {
            const existing = conversationSnap.data() || {};
            const messages = normalizeConversationMessages(existing.messages);

            messages.push({
                id: 'message-' + Date.now() + '-business-intro',
                sender: viewerName,
                type: 'message',
                text: initialMessage,
                createdAt: nowIso
            });

            await conversationRef.set({
                businessPurpose,
                scope: sanitizeText(existing.scope || 'cross_division_business'),
                messages,
                updatedAt: Timestamp.now()
            }, { merge: true });
        }

        const updatedSnap = await conversationRef.get();

        if (!conversationSnap.exists || initialMessage) {
            sendBusinessChatEmailNotifications({
                conversationSnap: updatedSnap,
                actor: viewer,
                eventType: conversationSnap.exists ? 'reply' : 'opened',
                messageText: initialMessage || 'A new Business Chat was opened with you.',
                req
            }).catch((emailError) => {
                console.warn('Business Chat open email skipped:', emailError && emailError.message ? emailError.message : emailError);
            });
        }

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

        return res.status(conversationSnap.exists ? 200 : 201).json({
            success: true,
            conversation: mapPlazaConversationDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createConversationFromBusinessMember error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to open cross-division business conversation.'
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

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

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


function getConversationParticipantIds(data = {}) {
    return Array.isArray(data.participantIds)
        ? data.participantIds.map((item) => sanitizeText(item)).filter(Boolean)
        : [];
}

function assertConversationParticipant(data = {}, viewer = {}) {
    const participantIds = getConversationParticipantIds(data);

    if (!participantIds.includes(sanitizeText(viewer.id))) {
        const error = new Error('You are not part of this Plaza conversation.');
        error.statusCode = 403;
        throw error;
    }

    return participantIds;
}


function sanitizeBusinessBlockIdPart(value = '') {
    return sanitizeText(value).replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function buildBusinessUserBlockId(userA = '', userB = '') {
    const ids = [sanitizeText(userA), sanitizeText(userB)].filter(Boolean).sort();

    if (ids.length !== 2) return '';

    return 'business_block_' + sanitizeBusinessBlockIdPart(ids[0]) + '__' + sanitizeBusinessBlockIdPart(ids[1]);
}

function isActiveBusinessUserBlock(data = {}) {
    const status = sanitizeText(data.status || 'active').toLowerCase();

    return status !== 'revoked' && status !== 'deleted' && status !== 'inactive';
}

async function getBusinessUserBlockSnapBetween(userA = '', userB = '') {
    const blockId = buildBusinessUserBlockId(userA, userB);

    if (!blockId) return null;

    const snap = await plazaBusinessUserBlocksCol.doc(blockId).get();

    if (!snap.exists) return null;

    const data = snap.data() || {};

    if (!isActiveBusinessUserBlock(data)) return null;

    return snap;
}

async function assertNoActiveBusinessUserBlockBetween(userA = '', userB = '') {
    const snap = await getBusinessUserBlockSnapBetween(userA, userB);

    if (!snap) return;

    const data = snap.data() || {};
    const blockerId = sanitizeText(data.blockerId || '');
    const blockedUserId = sanitizeText(data.blockedUserId || '');

    const error = new Error(
        blockerId === sanitizeText(userA) || blockerId === sanitizeText(userB)
            ? 'A Business Chat block exists between these members. New chats and replies are disabled.'
            : 'Business Chat is blocked between these members.'
    );

    error.statusCode = 403;
    error.blockId = snap.id;
    error.blockerId = blockerId;
    error.blockedUserId = blockedUserId;

    throw error;
}

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

        const groupedConversations = new Map();

        for (const docSnap of snap.docs) {
            const data = docSnap.data() || {};
            const recordStatus = sanitizeText(data.recordStatus || 'active').toLowerCase();
            const hiddenBy = data.hiddenBy && typeof data.hiddenBy === 'object' ? data.hiddenBy : {};

            if (recordStatus !== 'active') continue;
            if (hiddenBy[viewer.id] === true) continue;

            const participantIds = getConversationParticipantIds(data);
            const otherParticipantId = participantIds.find((participantId) => participantId && participantId !== viewer.id) || '';
            const blockSnap = otherParticipantId
                ? await getBusinessUserBlockSnapBetween(viewer.id, otherParticipantId)
                : null;

            const conversation = {
                ...mapPlazaConversationDoc(docSnap),
                businessThreadKey: getBusinessConversationPairKey(data, docSnap.id),
                businessBlock: mapBusinessBlockForViewer(blockSnap, viewer.id)
            };

            const groupKey = conversation.businessThreadKey || conversation.id;
            const existing = groupedConversations.get(groupKey);

            if (!existing) {
                groupedConversations.set(groupKey, conversation);
                continue;
            }

            const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            const nextTime = new Date(conversation.updatedAt || conversation.createdAt || 0).getTime();

            if (nextTime >= existingTime) {
                groupedConversations.set(groupKey, conversation);
            }
        }

        const conversations = Array.from(groupedConversations.values());

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

async function getBusinessUserBlockSetForViewer(viewerId = '') {
    const cleanViewerId = sanitizeText(viewerId);
    const blockedSet = new Set();

    if (!cleanViewerId) return blockedSet;

    try {
        const snap = await plazaBusinessUserBlocksCol
            .where('participantIds', 'array-contains', cleanViewerId)
            .limit(300)
            .get();

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};

            if (!isActiveBusinessUserBlock(data)) return;

            const participantIds = Array.isArray(data.participantIds)
                ? data.participantIds.map((item) => sanitizeText(item)).filter(Boolean)
                : [];

            participantIds
                .filter((participantId) => participantId && participantId !== cleanViewerId)
                .forEach((participantId) => blockedSet.add(participantId));
        });
    } catch (error) {
        console.warn('Business user block lookup skipped:', error && error.message ? error.message : error);
    }

    return blockedSet;
}

async function createBusinessUserBlockFromConversation(data = {}, viewer = {}, note = '') {
    const cleanViewerId = sanitizeText(viewer.id);
    const participantIds = getConversationParticipantIds(data);
    const targetUserId = participantIds.find((participantId) => participantId && participantId !== cleanViewerId) || '';

    if (!cleanViewerId || !targetUserId) {
        return null;
    }

    const blockId = buildBusinessUserBlockId(cleanViewerId, targetUserId);
    const targetSnap = await usersCol.doc(targetUserId).get().catch(() => null);
    const targetData = targetSnap && targetSnap.exists ? (targetSnap.data() || {}) : {};
    const nowIso = new Date().toISOString();

    const payload = {
        blockerId: cleanViewerId,
        blockerEmail: sanitizeText(viewer.email).toLowerCase(),
        blockerName: sanitizeText(viewer.name || viewer.username || 'YH Member'),
        blockedUserId: targetUserId,
        blockedUserEmail: sanitizeText(targetData.email || '').toLowerCase(),
        blockedUserName: sanitizeText(
            targetData.fullName ||
            targetData.displayName ||
            targetData.name ||
            targetData.username ||
            'YH Member'
        ),
        participantIds: [cleanViewerId, targetUserId].sort(),
        status: 'active',
        source: 'business_chat',
        latestConversationId: sanitizeText(data.id || ''),
        latestConversationTitle: sanitizeText(data.title || 'Plaza business conversation'),
        note: clampText(note || 'Blocked from Business Chat.', 260, 'Blocked from Business Chat.'),
        createdAt: Timestamp.now(),
        createdAtIso: nowIso,
        updatedAt: Timestamp.now(),
        updatedAtIso: nowIso
    };

    await plazaBusinessUserBlocksCol.doc(blockId).set(payload, { merge: true });

    return {
        id: blockId,
        ...payload
    };
}


function isConversationClosedOrBlocked(data = {}) {
    const status = sanitizeText(data.status || '').toLowerCase();
    const moderation = data.moderation && typeof data.moderation === 'object' ? data.moderation : {};
    const blockedBy = data.blockedBy && typeof data.blockedBy === 'object' ? data.blockedBy : {};

    return (
        status === 'closed' ||
        status === 'archived' ||
        status === 'blocked' ||
        moderation.closed === true ||
        moderation.blocked === true ||
        Object.values(blockedBy).some(Boolean)
    );
}

function appendConversationSystemMessage(messages = [], text = '') {
    const cleanTextValue = sanitizeText(text);
    if (!cleanTextValue) return normalizeConversationMessages(messages);

    return [
        ...normalizeConversationMessages(messages),
        {
            id: 'message-' + Date.now() + '-system-' + Math.random().toString(36).slice(2, 8),
            sender: 'Plaza Safety',
            type: 'system',
            text: cleanTextValue,
            createdAt: new Date().toISOString()
        }
    ];
}

function getConversationErrorStatus(error = {}) {
    const status = Number(error.statusCode || error.status || 500);
    return status >= 400 && status <= 599 ? status : 500;
}




exports.getBusinessBlocks = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({ success: false, message: 'Missing authenticated user.' });
        }

        const snap = await plazaBusinessUserBlocksCol
            .where('participantIds', 'array-contains', viewer.id)
            .limit(300)
            .get();

        const blocks = [];

        for (const docSnap of snap.docs) {
            const data = docSnap.data() || {};

            if (!isActiveBusinessUserBlock(data)) continue;

            const participantIds = Array.isArray(data.participantIds)
                ? data.participantIds.map((item) => sanitizeText(item)).filter(Boolean)
                : [];

            if (sanitizeText(data.blockerId || '') !== viewer.id) continue;

            const storedBlockedUserId = sanitizeText(data.blockedUserId || '');
            const otherUserId = storedBlockedUserId || participantIds.find((participantId) => participantId && participantId !== viewer.id) || '';
            const otherSnap = otherUserId ? await usersCol.doc(otherUserId).get().catch(() => null) : null;
            const otherData = otherSnap && otherSnap.exists ? (otherSnap.data() || {}) : {};

            const fallbackBlockedName = sanitizeText(
                data.blockedUserName ||
                data.otherUserName ||
                data.targetLabel ||
                data.latestConversationTitle ||
                'YH Member'
            );

            const otherUserName = sanitizeText(
                otherData.fullName ||
                otherData.displayName ||
                otherData.name ||
                otherData.username ||
                fallbackBlockedName ||
                otherUserId ||
                'YH Member'
            );

            const otherUserEmail = sanitizeText(
                otherData.email ||
                otherData.emailLower ||
                data.blockedUserEmail ||
                data.otherUserEmail ||
                ''
            ).toLowerCase();

            blocks.push({
                id: docSnap.id,
                blockerId: sanitizeText(data.blockerId || ''),
                blockedUserId: sanitizeText(storedBlockedUserId || otherUserId),
                blockedUserName: otherUserName,
                blockedUserEmail: otherUserEmail,
                participantIds,
                otherUserId: sanitizeText(otherUserId),
                otherUserName,
                otherUserEmail,
                status: sanitizeText(data.status || 'active'),
                note: sanitizeText(data.note || ''),
                latestConversationId: sanitizeText(data.latestConversationId || ''),
                latestConversationTitle: sanitizeText(data.latestConversationTitle || ''),
                createdAt: sanitizeText(data.createdAtIso || data.createdAt || ''),
                updatedAt: sanitizeText(data.updatedAtIso || data.updatedAt || '')
            });
        }

        return res.json({
            success: true,
            blocks
        });
    } catch (error) {
        console.error('plazaControllers.getBusinessBlocks error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Business Chat blocks.'
        });
    }
};

exports.unblockBusinessMember = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const blockedUserId = sanitizeText(req.params.blockedUserId);

        if (!viewer.id) {
            return res.status(401).json({ success: false, message: 'Missing authenticated user.' });
        }

        if (!blockedUserId) {
            return res.status(400).json({ success: false, message: 'Blocked user id is required.' });
        }

        const blockId = buildBusinessUserBlockId(viewer.id, blockedUserId);
        const ref = plazaBusinessUserBlocksCol.doc(blockId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Business Chat block was not found.'
            });
        }

        const data = snap.data() || {};

        if (sanitizeText(data.blockerId) !== viewer.id) {
            return res.status(403).json({
                success: false,
                message: 'Only the member who created this block can remove it.'
            });
        }

        const now = Timestamp.now();
        const nowIso = new Date().toISOString();

        await ref.set({
            status: 'revoked',
            revokedBy: viewer.id,
            revokedAt: nowIso,
            updatedAt: now,
            updatedAtIso: nowIso
        }, { merge: true });

        const relatedConversationsSnap = await plazaConversationsCol
            .where('participantIds', 'array-contains', viewer.id)
            .limit(300)
            .get();

        const updatedConversations = [];

        for (const docSnap of relatedConversationsSnap.docs) {
            const conversationData = docSnap.data() || {};
            const participantIds = getConversationParticipantIds(conversationData);

            if (!participantIds.includes(blockedUserId)) continue;

            const recordStatus = sanitizeText(conversationData.recordStatus || 'active').toLowerCase();
            if (recordStatus !== 'active') continue;

            const blockedBy = conversationData.blockedBy && typeof conversationData.blockedBy === 'object'
                ? conversationData.blockedBy
                : {};

            const nextBlockedBy = { ...blockedBy };
            delete nextBlockedBy[viewer.id];

            const hasRemainingBlock = Object.values(nextBlockedBy).some(Boolean);
            const moderation = conversationData.moderation && typeof conversationData.moderation === 'object'
                ? conversationData.moderation
                : {};

            const currentStatus = sanitizeText(conversationData.status || 'active').toLowerCase();
            const nextStatus = hasRemainingBlock
                ? (currentStatus || 'blocked')
                : moderation.closed === true
                    ? 'closed'
                    : currentStatus === 'blocked'
                        ? 'active'
                        : sanitizeText(conversationData.status || 'active');

            const messages = appendConversationSystemMessage(
                conversationData.messages,
                'This business conversation was unblocked by a participant. Replies are now enabled again.'
            );

            const updatePayload = {
                status: nextStatus,
                messages,
                updatedAt: now,
                [`blockedBy.${viewer.id}`]: FieldValue.delete(),
                'moderation.unblockedBy': viewer.id,
                'moderation.unblockedAt': nowIso,
                'moderation.lastBusinessUserBlockStatus': 'revoked'
            };

            if (!hasRemainingBlock) {
                updatePayload['moderation.blocked'] = false;
                updatePayload['moderation.blockedBy'] = FieldValue.delete();
                updatePayload['moderation.blockedAt'] = FieldValue.delete();
                updatePayload['moderation.blockReason'] = FieldValue.delete();
                updatePayload['moderation.businessUserBlockId'] = FieldValue.delete();
            }

            await docSnap.ref.update(updatePayload);

            const updatedSnap = await docSnap.ref.get();
            updatedConversations.push(mapPlazaConversationDoc(updatedSnap));

            if (global.yhEmitPlazaBusinessConversationUpdated) {
                global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                    console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
                });
            }
        }

        return res.json({
            success: true,
            message: 'Business Chat block removed.',
            conversations: updatedConversations
        });
    } catch (error) {
        console.error('plazaControllers.unblockBusinessMember error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to unblock Business Chat member.'
        });
    }
};


exports.reportConversation = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const conversationId = sanitizeText(req.params.id);
        const reason = clampText(req.body?.reason || req.body?.reportReason || 'User reported this business chat.', 180, 'User reported this business chat.');
        const details = clampText(req.body?.details || req.body?.message || '', 1200);

        if (!viewer.id) {
            return res.status(401).json({ success: false, message: 'Missing authenticated user.' });
        }

        if (!conversationId) {
            return res.status(400).json({ success: false, message: 'Conversation ID is required.' });
        }

        const ref = plazaConversationsCol.doc(conversationId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({ success: false, message: 'Conversation not found.' });
        }

        const data = snap.data() || {};
        assertConversationParticipant(data, viewer);

        const now = Timestamp.now();
        const nowIso = new Date().toISOString();
        const reports = Array.isArray(data.reports) ? data.reports : [];
        const moderation = data.moderation && typeof data.moderation === 'object' ? data.moderation : {};
        const reportRef = plazaBusinessChatReportsCol.doc();

        const reportSummary = {
            id: reportRef.id,
            reporterId: viewer.id,
            reporterEmail: sanitizeText(viewer.email).toLowerCase(),
            reporterName: sanitizeText(viewer.name || viewer.username || 'YH Member'),
            reason,
            details,
            status: 'pending_review',
            createdAt: nowIso
        };

        await reportRef.set({
            ...reportSummary,
            conversationId,
            conversationTitle: sanitizeText(data.title || 'Plaza business conversation'),
            participantIds: getConversationParticipantIds(data),
            sourceDivision: sanitizeText(data.sourceDivision || ''),
            targetDivision: sanitizeText(data.targetDivision || ''),
            businessPurpose: sanitizeText(data.businessPurpose || ''),
            messagesSnapshot: normalizeConversationMessages(data.messages).slice(-20),
            createdAt: now,
            updatedAt: now
        });

        const messages = appendConversationSystemMessage(
            data.messages,
            'This business conversation was reported for admin review. Reason: ' + reason
        );

        await ref.set({
            reports: [...reports, reportSummary].slice(-20),
            moderation: {
                ...moderation,
                reported: true,
                reportCount: Number(moderation.reportCount || 0) + 1,
                lastReportId: reportRef.id,
                lastReportReason: reason,
                lastReportedBy: viewer.id,
                lastReportedAt: nowIso,
                reviewStatus: 'pending_review'
            },
            messages,
            updatedAt: now
        }, { merge: true });

        const updatedSnap = await ref.get();

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

        return res.json({
            success: true,
            reportId: reportRef.id,
            conversation: mapPlazaConversationDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.reportConversation error:', error);
        return res.status(getConversationErrorStatus(error)).json({
            success: false,
            message: sanitizeText(error.message, 'Failed to report Plaza conversation.')
        });
    }
};

exports.closeConversation = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const conversationId = sanitizeText(req.params.id);
        const note = clampText(req.body?.note || req.body?.reason || 'Conversation closed by participant.', 260, 'Conversation closed by participant.');

        if (!viewer.id) {
            return res.status(401).json({ success: false, message: 'Missing authenticated user.' });
        }

        if (!conversationId) {
            return res.status(400).json({ success: false, message: 'Conversation ID is required.' });
        }

        const ref = plazaConversationsCol.doc(conversationId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({ success: false, message: 'Conversation not found.' });
        }

        const data = snap.data() || {};
        assertConversationParticipant(data, viewer);

        const now = Timestamp.now();
        const nowIso = new Date().toISOString();
        const moderation = data.moderation && typeof data.moderation === 'object' ? data.moderation : {};
        const closedBy = data.closedBy && typeof data.closedBy === 'object' ? data.closedBy : {};

        const messages = appendConversationSystemMessage(
            data.messages,
            'This business conversation was closed by ' + sanitizeText(viewer.name || viewer.username || 'a participant') + '.'
        );

        await ref.set({
            status: 'closed',
            closedBy: {
                ...closedBy,
                [viewer.id]: {
                    name: sanitizeText(viewer.name || viewer.username || 'YH Member'),
                    email: sanitizeText(viewer.email).toLowerCase(),
                    note,
                    closedAt: nowIso
                }
            },
            moderation: {
                ...moderation,
                closed: true,
                closedBy: viewer.id,
                closedAt: nowIso,
                closeReason: note
            },
            messages,
            updatedAt: now
        }, { merge: true });

        const updatedSnap = await ref.get();

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

        return res.json({
            success: true,
            conversation: mapPlazaConversationDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.closeConversation error:', error);
        return res.status(getConversationErrorStatus(error)).json({
            success: false,
            message: sanitizeText(error.message, 'Failed to close Plaza conversation.')
        });
    }
};

exports.blockConversationParticipant = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const conversationId = sanitizeText(req.params.id);
        const note = clampText(req.body?.note || req.body?.reason || 'Participant blocked this business chat.', 260, 'Participant blocked this business chat.');

        if (!viewer.id) {
            return res.status(401).json({ success: false, message: 'Missing authenticated user.' });
        }

        if (!conversationId) {
            return res.status(400).json({ success: false, message: 'Conversation ID is required.' });
        }

        const ref = plazaConversationsCol.doc(conversationId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({ success: false, message: 'Conversation not found.' });
        }

        const data = snap.data() || {};
        assertConversationParticipant(data, viewer);

        const businessUserBlock = await createBusinessUserBlockFromConversation(data, viewer, note);

        const now = Timestamp.now();
        const nowIso = new Date().toISOString();
        const moderation = data.moderation && typeof data.moderation === 'object' ? data.moderation : {};
        const blockedBy = data.blockedBy && typeof data.blockedBy === 'object' ? data.blockedBy : {};

        const messages = appendConversationSystemMessage(
            data.messages,
            'This business conversation was blocked by a participant. Replies are now disabled.'
        );

        await ref.set({
            status: 'blocked',
            blockedBy: {
                ...blockedBy,
                [viewer.id]: {
                    name: sanitizeText(viewer.name || viewer.username || 'YH Member'),
                    email: sanitizeText(viewer.email).toLowerCase(),
                    note,
                    blockedAt: nowIso
                }
            },
            moderation: {
                ...moderation,
                blocked: true,
                blockedBy: viewer.id,
                blockedAt: nowIso,
                blockReason: note,
                businessUserBlockId: businessUserBlock && businessUserBlock.id ? businessUserBlock.id : ''
            },
            messages,
            updatedAt: now
        }, { merge: true });

        const updatedSnap = await ref.get();

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

        return res.json({
            success: true,
            conversation: mapPlazaConversationDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.blockConversationParticipant error:', error);
        return res.status(getConversationErrorStatus(error)).json({
            success: false,
            message: sanitizeText(error.message, 'Failed to block Plaza conversation.')
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

        await assertNoActiveBusinessUserBlockForConversation(data, viewer.id);

        if (isConversationClosedOrBlocked(data)) {
            return res.status(403).json({
                success: false,
                message: 'This Plaza conversation is closed or blocked. Replies are disabled.'
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

        sendBusinessChatEmailNotifications({
            conversationSnap: updatedSnap,
            actor: viewer,
            eventType: 'reply',
            messageText: text,
            req
        }).catch((emailError) => {
            console.warn('Business Chat reply email skipped:', emailError && emailError.message ? emailError.message : emailError);
        });

        if (global.yhEmitPlazaBusinessConversationUpdated) {
            global.yhEmitPlazaBusinessConversationUpdated(updatedSnap.id).catch((emitError) => {
                console.warn('Business Chat realtime emit skipped:', emitError?.message || emitError);
            });
        }

        return res.json({
            success: true,
            conversation: mapPlazaConversationDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createConversationReply error:', error);

        return res.status(getConversationErrorStatus(error)).json({
            success: false,
            message: sanitizeText(error.message, 'Failed to send Plaza reply.')
        });
    }
};