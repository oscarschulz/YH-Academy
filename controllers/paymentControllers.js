const { firestore } = require('../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');
const Stripe = require('stripe');
const crypto = require('crypto');
const paymentLedgerRepo = require('../backend/repositories/paymentLedgerRepo');

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

function getViewer(req) {
    return {
        id: cleanText(req.user?.id || req.user?.firebaseUid || req.user?.uid),
        firebaseUid: cleanText(req.user?.firebaseUid || req.user?.id || req.user?.uid),
        email: cleanText(req.user?.email).toLowerCase(),
        name: cleanText(req.user?.name || req.user?.fullName || req.user?.displayName || req.user?.username || 'Member'),
        username: cleanText(req.user?.username)
    };
}

function getPaymentOptions(req, res) {
    const stripeConfigured = !!cleanText(process.env.STRIPE_SECRET_KEY);

    const oxapayConfigured = !!cleanText(
        process.env.OXAPAY_MERCHANT_API_KEY ||
        process.env.OXAPAY_API_KEY ||
        ''
    );

    const providerStatus = (configured, fallbackStatus = 'active') => (
        configured ? fallbackStatus : 'setup_required'
    );

    return res.json({
        success: true,
        paymentProviders: [
            {
                id: 'stripe',
                label: 'Card / Bank Payment',
                status: providerStatus(stripeConfigured),
                configured: stripeConfigured,
                methods: ['card', 'bank'],
                currencies: ['fiat'],
                setupMessage: stripeConfigured
                    ? ''
                    : 'STRIPE_SECRET_KEY is not configured.'
            },
            {
                id: 'oxapay',
                label: 'Crypto Payment',
                status: providerStatus(oxapayConfigured),
                configured: oxapayConfigured,
                methods: ['crypto'],
                currencies: ['crypto'],
                setupMessage: oxapayConfigured
                    ? ''
                    : 'OXAPAY_MERCHANT_API_KEY is not configured.'
            },
            {
                id: 'manual',
                label: 'Manual Admin Payment',
                status: 'fallback',
                configured: true,
                methods: ['manual'],
                currencies: ['fiat', 'crypto'],
                setupMessage: ''
            }
        ]
    });
}

function getPayoutOptions(req, res) {
    return res.json({
        success: true,
        payoutMethods: [
            {
                id: 'local_bank',
                label: 'Withdraw to Local Bank',
                provider: 'manual',
                status: 'ledger_ready'
            },
            {
                id: 'card',
                label: 'Withdraw to Card',
                provider: 'manual',
                status: 'ledger_ready'
            },
            {
                id: 'crypto',
                label: 'Withdraw to Crypto Address',
                provider: 'oxapay',
                status: 'ledger_ready'
            }
        ]
    });
}

const VERIFIED_BADGE_PLANS = {
    academy: {
        division: 'academy',
        code: 'YHA',
        amountMonthly: 2.81,
        amountOneTime: 2.81,
        amountLifetime: 28.12,
        currency: 'USD',
        interval: 'month',
        asset: '/images/yha%20badge.png',
        sourceFeature: 'verified_badge',
        publicName: 'Academy Verified Badge',
        lifetimePublicName: 'Academy Lifetime Verified Badge'
    },
    federation: {
        division: 'federation',
        code: 'YHF',
        amountMonthly: 28.12,
        amountOneTime: 28.12,
        amountLifetime: 281.20,
        currency: 'USD',
        interval: 'month',
        asset: '/images/yhf%20badge.png',
        sourceFeature: 'verified_badge',
        publicName: 'Federation Verified Badge',
        lifetimePublicName: 'Federation Lifetime Verified Badge'
    }
};

function normalizeVerifiedBadgeDivision(value = '') {
    const clean = cleanLower(value);

    if (clean === 'academy' || clean === 'yha') return 'academy';
    if (clean === 'federation' || clean === 'yhf') return 'federation';

    return '';
}

function getVerifiedBadgePlan(division = '') {
    const normalizedDivision = normalizeVerifiedBadgeDivision(division);
    return normalizedDivision ? VERIFIED_BADGE_PLANS[normalizedDivision] : null;
}

function getVerifiedBadgePaymentRecordId(viewerId = '', division = '') {
    const cleanViewerId = cleanText(viewerId).replace(/[^a-zA-Z0-9_-]+/g, '_');
    const cleanDivision = normalizeVerifiedBadgeDivision(division) || 'badge';

    return `verified_badge_${cleanDivision}_${cleanViewerId}`.slice(0, 180);
}

function normalizeVerifiedBadgeBillingPlan(value = '', fallback = 'monthly') {
    const clean = cleanLower(value || fallback);

    if (clean === 'monthly' || clean === 'month' || clean === 'subscription' || clean === 'recurring') {
        return 'monthly';
    }

    if (clean === 'lifetime' || clean === 'life_time' || clean === 'forever') {
        return 'lifetime';
    }

    if (clean === 'one_time' || clean === 'one-time' || clean === 'onetime' || clean === 'single') {
        return 'one_time';
    }

    return fallback === 'lifetime' || fallback === 'one_time' ? fallback : 'monthly';
}

function getVerifiedBadgeBillingAmount(plan = {}, billingPlan = 'monthly') {
    const cleanBillingPlan = normalizeVerifiedBadgeBillingPlan(billingPlan);

    if (cleanBillingPlan === 'lifetime') {
        return toNumber(plan.amountLifetime, plan.amountMonthly);
    }

    if (cleanBillingPlan === 'one_time') {
        return toNumber(plan.amountOneTime, plan.amountMonthly);
    }

    return toNumber(plan.amountMonthly, 0);
}

function getVerifiedBadgeBillingInterval(billingPlan = 'monthly') {
    const cleanBillingPlan = normalizeVerifiedBadgeBillingPlan(billingPlan);

    if (cleanBillingPlan === 'lifetime') return 'lifetime';
    if (cleanBillingPlan === 'one_time') return '30_days';

    return 'month';
}

function getVerifiedBadgeAccessExpiresAt(billingPlan = 'monthly') {
    const cleanBillingPlan = normalizeVerifiedBadgeBillingPlan(billingPlan);
    if (cleanBillingPlan === 'lifetime') return '';

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    return expiresAt.toISOString();
}

function getVerifiedBadgeBillingLabel(billingPlan = 'monthly') {
    const cleanBillingPlan = normalizeVerifiedBadgeBillingPlan(billingPlan);

    if (cleanBillingPlan === 'lifetime') return 'Lifetime Access';
    if (cleanBillingPlan === 'one_time') return '30-Day One-Time Access';

    return 'Monthly Subscription';
}

function buildVerifiedBadgeBillingMetadata(plan = {}, billingPlan = 'monthly') {
    const cleanBillingPlan = normalizeVerifiedBadgeBillingPlan(billingPlan);
    const amount = getVerifiedBadgeBillingAmount(plan, cleanBillingPlan);

    return {
        billingPlan: cleanBillingPlan,
        billingInterval: getVerifiedBadgeBillingInterval(cleanBillingPlan),
        accessDuration: cleanBillingPlan === 'lifetime' ? 'lifetime' : cleanBillingPlan === 'one_time' ? '30_days' : 'monthly_recurring',
        lifetimeAccess: cleanBillingPlan === 'lifetime',
        isRecurring: cleanBillingPlan === 'monthly',
        amount,
        publicBillingLabel: getVerifiedBadgeBillingLabel(cleanBillingPlan)
    };
}

function isVerifiedBadgeExpired(badge = {}) {
    const billingPlan = normalizeVerifiedBadgeBillingPlan(badge.billingPlan || badge.accessType || badge.interval || '', '');
    if (billingPlan === 'lifetime' || badge.lifetimeAccess === true) return false;

    const expiresAt = cleanText(badge.expiresAt || '');
    if (!expiresAt) return false;

    const expiresMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresMs)) return false;

    return expiresMs <= Date.now();
}

function buildPendingVerifiedBadgePayload(plan = {}, payment = {}) {
    const provider = cleanLower(payment.provider || 'unselected');
    const paymentStatus = cleanLower(payment.status || 'draft');
    const providerStatus = cleanLower(payment.providerStatus || '');
    const metadata = payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
    const billingPlan = normalizeVerifiedBadgeBillingPlan(metadata.billingPlan || metadata.accessType || 'monthly');
    const amount = getVerifiedBadgeBillingAmount(plan, billingPlan);

    const isAutomatedCheckoutProvider = ['stripe', 'oxapay'].includes(provider);

    const badgeStatus =
        isAutomatedCheckoutProvider && paymentStatus === 'checkout_started'
            ? 'checkout_started'
            : paymentStatus === 'cancelled' || paymentStatus === 'canceled'
                ? 'cancelled'
                : paymentStatus === 'expired' || paymentStatus === 'failed'
                    ? paymentStatus
                    : 'pending_payment';

    return {
        active: false,
        status: badgeStatus,
        code: cleanText(plan.code),
        division: cleanText(plan.division),
        amountMonthly: toNumber(plan.amountMonthly, 0),
        amount,
        currency: cleanText(plan.currency || 'USD').toUpperCase() || 'USD',
        interval: getVerifiedBadgeBillingInterval(billingPlan),
        billingPlan,
        billingLabel: getVerifiedBadgeBillingLabel(billingPlan),
        lifetimeAccess: billingPlan === 'lifetime',
        asset: cleanText(plan.asset),
        paymentLedgerId: cleanText(payment.id),
        paymentStatus: paymentStatus || 'draft',
        provider,
        providerStatus,
        paymentMethod: cleanText(payment.paymentMethod || 'unselected'),
        updatedAt: new Date().toISOString()
    };
}

const ACADEMY_LEARN_FROM_ACCESS_PLAN = Object.freeze({
    sourceDivision: 'academy',
    sourceFeature: 'academy_learn_from_access',
    publicName: 'Academy Learn From Access',
    monthlyAmount: 2.81,
    oneTimeAmount: 28.12,
    currency: 'USD',
    monthlyInterval: 'month'
});

function normalizeLearnFromAccessType(value = '') {
    const clean = cleanLower(value);

    if (clean === 'monthly' || clean === 'stripe') return 'monthly';
    if (clean === 'one_time' || clean === 'onetime' || clean === 'one-time' || clean === 'oxapay') return 'one_time';

    return '';
}

function getAcademyLearnFromPaymentRecordId(viewerId = '', accessType = '') {
    const cleanViewerId = cleanText(viewerId).replace(/[^a-zA-Z0-9_-]+/g, '_');
    const cleanAccessType = normalizeLearnFromAccessType(accessType) || 'access';

    return `academy_learn_from_${cleanAccessType}_${cleanViewerId}`.slice(0, 180);
}

function normalizeAcademyLearnFromAccess(rawAccess = {}) {
    const access = rawAccess && typeof rawAccess === 'object' ? rawAccess : {};
    const status = cleanLower(access.status || '');
    const active = access.active === true || status === 'active';

    return {
        active,
        status: active ? 'active' : (status || 'none'),
        accessType: cleanText(access.accessType || ''),
        product: 'academy_learn_from_access',
        name: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
        amountMonthly: ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount,
        amountOneTime: ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount,
        currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,
        paymentLedgerId: cleanText(access.paymentLedgerId || ''),
        provider: cleanText(access.provider || ''),
        providerPaymentId: cleanText(access.providerPaymentId || ''),
        providerSubscriptionId: cleanText(access.providerSubscriptionId || access.stripeSubscriptionId || ''),
        activatedAt: cleanText(access.activatedAt || ''),
        expiresAt: cleanText(access.expiresAt || ''),
        updatedAt: cleanText(access.updatedAt || '')
    };
}

function getAcademyVerifiedBadgeForLearnFrom(userData = {}) {
    const sources = [
        userData?.verificationBadges,
        userData?.verifiedBadges,
        userData?.yhVerificationBadges,
        userData?.badges,
        userData?.badgeSubscriptions
    ].filter((source) => source && typeof source === 'object');

    for (const source of sources) {
        const badge = source.academy && typeof source.academy === 'object'
            ? source.academy
            : source.yha && typeof source.yha === 'object'
                ? source.yha
                : null;

        if (badge) return badge;
    }

    return {};
}

function isAcademyVerifiedBadgeObjectActiveForLearnFrom(badge = {}) {
    const status = cleanLower(badge.status || '');
    const paymentStatus = cleanLower(badge.paymentStatus || '');
    const subscriptionStatus = cleanLower(badge.subscriptionStatus || '');

    const cancelled =
        status === 'cancelled' ||
        status === 'canceled' ||
        paymentStatus === 'cancelled' ||
        paymentStatus === 'canceled' ||
        subscriptionStatus === 'cancelled' ||
        subscriptionStatus === 'canceled';

    if (cancelled) return false;

    return (
        badge.active === true ||
        status === 'active' ||
        status === 'verified' ||
        paymentStatus === 'paid' ||
        subscriptionStatus === 'active'
    );
}

function isAcademyVerifiedBadgeActiveForLearnFrom(userData = {}) {
    return isAcademyVerifiedBadgeObjectActiveForLearnFrom(
        getAcademyVerifiedBadgeForLearnFrom(userData)
    );
}

function getAcademyVerifiedBadgePaymentForLearnFrom(payments = []) {
    const activeStatuses = new Set([
        'paid',
        'active',
        'verified',
        'succeeded',
        'success',
        'completed',
        'manual_paid',
        'admin_paid'
    ]);

    return (Array.isArray(payments) ? payments : []).find((payment) => {
        const metadata = payment?.metadata && typeof payment.metadata === 'object'
            ? payment.metadata
            : {};

        const sourceFeature = cleanLower(
            payment.sourceFeature ||
            metadata.sourceFeature ||
            metadata.product ||
            metadata.kind ||
            ''
        );

        const sourceDivision = cleanLower(
            payment.sourceDivision ||
            metadata.sourceDivision ||
            metadata.badgeDivision ||
            metadata.division ||
            ''
        );

        const badgeCode = cleanLower(
            metadata.badgeCode ||
            payment.badgeCode ||
            ''
        );

        const status = cleanLower(payment.status || payment.paymentStatus || '');
        const providerStatus = cleanLower(payment.providerStatus || '');
        const provider = cleanLower(payment.provider || metadata.provider || '');

        const isAcademyYhaBadge =
            sourceFeature === 'verified_badge' &&
            (
                sourceDivision === 'academy' ||
                badgeCode === 'yha'
            );

        const isPaidOrActive =
            activeStatuses.has(status) ||
            activeStatuses.has(providerStatus) ||
            (
                provider === 'manual' &&
                (
                    status === 'paid' ||
                    providerStatus === 'paid' ||
                    providerStatus === 'manual_paid' ||
                    providerStatus === 'admin_paid'
                )
            );

        return isAcademyYhaBadge && isPaidOrActive;
    }) || null;
}

function buildAcademyLearnFromAccessFromYhaBadge(userData = {}) {
    const badge = getAcademyVerifiedBadgeForLearnFrom(userData);

    return {
        active: true,
        status: 'active',
        accessType: 'yha_badge',
        product: 'academy_learn_from_access',
        name: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
        amountMonthly: ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount,
        amountOneTime: ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount,
        currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,
        paymentLedgerId: cleanText(badge.paymentLedgerId || ''),
        provider: cleanText(badge.provider || ''),
        providerPaymentId: cleanText(badge.providerPaymentId || ''),
        providerSubscriptionId: cleanText(badge.providerSubscriptionId || badge.stripeSubscriptionId || ''),
        activatedAt: cleanText(badge.activatedAt || badge.approvedAt || ''),
        expiresAt: cleanText(badge.expiresAt || ''),
        updatedAt: cleanText(badge.updatedAt || ''),
        unlockedBy: 'yha_verified_badge',
        badgeCode: cleanText(badge.code || 'YHA'),
        badgeDivision: 'academy'
    };
}

function buildAcademyLearnFromAccessFromYhaPayment(payment = {}) {
    const metadata = payment?.metadata && typeof payment.metadata === 'object'
        ? payment.metadata
        : {};

    return {
        active: true,
        status: 'active',
        accessType: 'yha_badge',
        product: 'academy_learn_from_access',
        name: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
        amountMonthly: ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount,
        amountOneTime: ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount,
        currency: cleanText(payment.currency || ACADEMY_LEARN_FROM_ACCESS_PLAN.currency).toUpperCase() || ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,
        paymentLedgerId: cleanText(payment.id || ''),
        provider: cleanText(payment.provider || metadata.provider || 'manual'),
        providerPaymentId: cleanText(payment.providerPaymentId || metadata.providerPaymentId || ''),
        providerSubscriptionId: cleanText(payment.providerSubscriptionId || metadata.providerSubscriptionId || metadata.stripeSubscriptionId || ''),
        activatedAt: cleanText(payment.paidAt || payment.updatedAt || payment.createdAt || ''),
        expiresAt: cleanText(payment.expiresAt || metadata.expiresAt || ''),
        updatedAt: cleanText(payment.updatedAt || ''),
        unlockedBy: 'yha_verified_badge_payment',
        badgeCode: 'YHA',
        badgeDivision: 'academy'
    };
}

function buildPendingAcademyLearnFromAccessPayload(payment = {}, accessType = '') {
    const provider = cleanLower(payment.provider || 'unselected');
    const paymentStatus = cleanLower(payment.status || 'draft');
    const providerStatus = cleanLower(payment.providerStatus || '');
    const normalizedAccessType = normalizeLearnFromAccessType(accessType || payment.metadata?.accessType || '');

    return {
        active: false,
        status: paymentStatus === 'checkout_started'
            ? 'checkout_started'
            : paymentStatus === 'cancelled' || paymentStatus === 'canceled'
                ? 'cancelled'
                : paymentStatus === 'expired' || paymentStatus === 'failed'
                    ? paymentStatus
                    : 'pending_payment',
        product: 'academy_learn_from_access',
        name: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
        accessType: normalizedAccessType,
        amountMonthly: ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount,
        amountOneTime: ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount,
        currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,
        paymentLedgerId: cleanText(payment.id),
        paymentStatus: paymentStatus || 'draft',
        provider,
        providerStatus,
        paymentMethod: cleanText(payment.paymentMethod || 'unselected'),
        updatedAt: new Date().toISOString()
    };
}

function buildAcademyLearnFromOrderId(paymentId = '') {
    const cleanPaymentId = cleanText(paymentId)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const seed =
        cleanPaymentId ||
        `learn_from_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const digest = crypto
        .createHash('sha256')
        .update(seed)
        .digest('hex')
        .slice(0, 18);

    return `yh_lfa_${digest}`.slice(0, 50);
}

async function createOrRefreshAcademyLearnFromPayment(viewer = {}, accessType = '', options = {}) {
    if (!viewer.id) {
        const error = new Error('Unauthorized.');
        error.statusCode = 401;
        throw error;
    }

    const normalizedAccessType = normalizeLearnFromAccessType(accessType);

    if (!normalizedAccessType) {
        const error = new Error('Invalid Learn From access type.');
        error.statusCode = 400;
        throw error;
    }

    const userRef = firestore.collection('users').doc(viewer.id);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        const error = new Error('User account not found.');
        error.statusCode = 404;
        throw error;
    }

    const userData = userSnap.data() || {};
    const currentAccess = normalizeAcademyLearnFromAccess(userData.academyLearnFromAccess);

    if (currentAccess.active) {
        const error = new Error('Academy Learn From access is already active.');
        error.statusCode = 409;
        error.payload = {
            access: currentAccess
        };
        throw error;
    }

    const provider = cleanLower(options.provider || 'unselected');
    const amount = normalizedAccessType === 'monthly'
        ? ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount
        : ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount;

    const recordId = getAcademyLearnFromPaymentRecordId(viewer.id, normalizedAccessType);

    const payment = await paymentLedgerRepo.upsertPaymentRecord({
        id: recordId,
        sourceDivision: ACADEMY_LEARN_FROM_ACCESS_PLAN.sourceDivision,
        sourceFeature: ACADEMY_LEARN_FROM_ACCESS_PLAN.sourceFeature,
        sourceRecordId: `${viewer.id}_${normalizedAccessType}`,

        payerUid: viewer.id,
        payerEmail: viewer.email,
        payerName: viewer.name,

        provider,
        providerOptions: ['stripe', 'oxapay'],
        providerPaymentId: cleanText(options.providerPaymentId),
        providerCheckoutUrl: cleanText(options.providerCheckoutUrl),
        providerStatus: cleanText(options.providerStatus),

        status: cleanLower(options.status || 'draft') || 'draft',
        paymentMethod: cleanText(options.paymentMethod || getBadgePaymentMethodForProvider(provider)),

        amount,
        currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,

        platformCommissionAmount: amount,
        operatorPayoutAmount: 0,

        metadata: {
            kind: 'academy_learn_from_access',
            product: 'academy_learn_from_access',
            publicName: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
            accessType: normalizedAccessType,
            billingInterval: normalizedAccessType === 'monthly'
                ? ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyInterval
                : 'one_time',
            userId: viewer.id,
            userEmail: viewer.email,
            userName: viewer.name,
            ...(options.metadata && typeof options.metadata === 'object' ? options.metadata : {})
        }
    });

    await userRef.set({
        academyLearnFromAccess: buildPendingAcademyLearnFromAccessPayload(payment, normalizedAccessType),
        updatedAt: new Date().toISOString()
    }, { merge: true });

    return {
        userRef,
        userData,
        access: buildPendingAcademyLearnFromAccessPayload(payment, normalizedAccessType),
        payment,
        accessType: normalizedAccessType
    };
}

async function getAcademyLearnFromAccess(req, res) {
    try {
        const viewer = getViewer(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const userSnap = await firestore.collection('users').doc(viewer.id).get();
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};

        const directAccess = normalizeAcademyLearnFromAccess(userData.academyLearnFromAccess);

        let access = directAccess.active === true
            ? directAccess
            : isAcademyVerifiedBadgeActiveForLearnFrom(userData)
                ? buildAcademyLearnFromAccessFromYhaBadge(userData)
                : directAccess;

        if (access.active !== true) {
            const payments = await paymentLedgerRepo.listPaymentsForUser(viewer.id, 120).catch((ledgerError) => {
                console.error('learn from yha badge ledger fallback error:', ledgerError);
                return [];
            });

            const activeYhaBadgePayment = getAcademyVerifiedBadgePaymentForLearnFrom(payments);

            if (activeYhaBadgePayment) {
                access = buildAcademyLearnFromAccessFromYhaPayment(activeYhaBadgePayment);
            }
        }

        return res.json({
            success: true,
            access,
            pricing: {
                monthly: ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount,
                oneTime: ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount,
                currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency
            }
        });
    } catch (error) {
        console.error('get academy learn from access error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error?.message || 'Failed to load Academy Learn From access.'
        });
    }
}

async function createAcademyLearnFromStripeCheckoutSession(req, res) {
    try {
        const viewer = getViewer(req);
        const stripe = getBadgeStripeClient();

        const initial = await createOrRefreshAcademyLearnFromPayment(viewer, 'monthly', {
            provider: 'stripe',
            paymentMethod: 'card_bank_wallet',
            status: 'checkout_started',
            providerStatus: 'checkout_starting'
        });

        const successUrl = buildBadgeReturnUrl(req, {
            learnFromPayment: 'success',
            provider: 'stripe',
            payment: initial.payment.id,
            session_id: '{CHECKOUT_SESSION_ID}'
        });

        const cancelUrl = buildBadgeReturnUrl(req, {
            learnFromPayment: 'cancelled',
            provider: 'stripe',
            payment: initial.payment.id
        });

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            client_reference_id: initial.payment.id,
            customer_email: viewer.email || undefined,
            success_url: successUrl,
            cancel_url: cancelUrl,
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency.toLowerCase(),
                        unit_amount: Math.round(ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount * 100),
                        recurring: {
                            interval: 'month'
                        },
                        product_data: {
                            name: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
                            description: 'Monthly access to Academy Learn From mentor/personality modes.'
                        }
                    }
                }
            ],
            metadata: {
                kind: 'academy_learn_from_access',
                paymentLedgerId: initial.payment.id,
                accessType: 'monthly',
                userId: viewer.id,
                userEmail: viewer.email
            },
            subscription_data: {
                metadata: {
                    kind: 'academy_learn_from_access',
                    paymentLedgerId: initial.payment.id,
                    accessType: 'monthly',
                    userId: viewer.id,
                    userEmail: viewer.email
                }
            }
        });

        const payment = await paymentLedgerRepo.upsertPaymentRecord({
            id: initial.payment.id,
            sourceDivision: ACADEMY_LEARN_FROM_ACCESS_PLAN.sourceDivision,
            sourceFeature: ACADEMY_LEARN_FROM_ACCESS_PLAN.sourceFeature,
            sourceRecordId: `${viewer.id}_monthly`,

            payerUid: viewer.id,
            payerEmail: viewer.email,
            payerName: viewer.name,

            provider: 'stripe',
            providerOptions: ['stripe', 'oxapay'],
            providerPaymentId: cleanText(session.id),
            providerCheckoutUrl: cleanText(session.url),
            providerStatus: 'checkout_session_created',

            status: 'checkout_started',
            paymentMethod: 'card_bank_wallet',

            amount: ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount,
            currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,

            platformCommissionAmount: ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount,
            operatorPayoutAmount: 0,

            metadata: {
                kind: 'academy_learn_from_access',
                product: 'academy_learn_from_access',
                publicName: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
                accessType: 'monthly',
                billingInterval: 'month',
                userId: viewer.id,
                userEmail: viewer.email,
                userName: viewer.name,
                stripeCheckoutSessionId: cleanText(session.id)
            }
        });

        await initial.userRef.set({
            academyLearnFromAccess: buildPendingAcademyLearnFromAccessPayload(payment, 'monthly'),
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return res.json({
            success: true,
            provider: 'stripe',
            providerLabel: 'Stripe',
            product: 'academy_learn_from_access',
            access: buildPendingAcademyLearnFromAccessPayload(payment, 'monthly'),
            payment,
            paymentLedgerId: payment.id,
            checkoutSessionId: session.id,
            url: session.url
        });
    } catch (error) {
        console.error('academy learn from stripe checkout error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error?.message || 'Failed to start Stripe Checkout for Academy Learn From access.',
            ...(error.payload && typeof error.payload === 'object' ? error.payload : {})
        });
    }
}

async function createAcademyLearnFromOxaPayInvoice(req, res) {
    try {
        const viewer = getViewer(req);

        const initial = await createOrRefreshAcademyLearnFromPayment(viewer, 'one_time', {
            provider: 'oxapay',
            paymentMethod: 'crypto',
            status: 'checkout_started',
            providerStatus: 'invoice_starting'
        });

        const baseUrl = resolveBadgePublicBaseUrl(req);
        const orderId = buildAcademyLearnFromOrderId(initial.payment.id);

        const invoicePayload = {
            amount: Number(ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount.toFixed(2)),
            currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,
            lifetime: Math.max(15, Math.min(2880, Number(process.env.OXAPAY_INVOICE_LIFETIME_MINUTES || 60))),
            fee_paid_by_payer: Number(process.env.OXAPAY_FEE_PAID_BY_PAYER || 1),
            mixed_payment: true,
            callback_url: `${baseUrl}/api/oxapay/webhook`,
            return_url: buildBadgeReturnUrl(req, {
                learnFromPayment: 'success',
                provider: 'oxapay',
                payment: initial.payment.id
            }),
            email: viewer.email || undefined,
            order_id: orderId,
            thanks_message: 'Payment received. Return to YH Academy to unlock Learn From mode.',
            description: `${ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName}: one-time access`,
            sandbox: isOxaPaySandboxEnabled()
        };

        const invoiceResult = await callOxaPayInvoiceApi(invoicePayload);
        const invoice = invoiceResult.data || {};
        const trackId = cleanText(invoice.track_id);
        const paymentUrl = cleanText(invoice.payment_url);

        if (!trackId || !paymentUrl) {
            return res.status(502).json({
                success: false,
                message: 'OxaPay did not return a valid invoice URL.'
            });
        }

        const payment = await paymentLedgerRepo.upsertPaymentRecord({
            id: initial.payment.id,
            sourceDivision: ACADEMY_LEARN_FROM_ACCESS_PLAN.sourceDivision,
            sourceFeature: ACADEMY_LEARN_FROM_ACCESS_PLAN.sourceFeature,
            sourceRecordId: `${viewer.id}_one_time`,

            payerUid: viewer.id,
            payerEmail: viewer.email,
            payerName: viewer.name,

            provider: 'oxapay',
            providerOptions: ['stripe', 'oxapay'],
            providerPaymentId: trackId,
            providerCheckoutUrl: paymentUrl,
            providerStatus: 'invoice_created',

            status: 'checkout_started',
            paymentMethod: 'crypto',

            amount: ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount,
            currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,

            platformCommissionAmount: ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount,
            operatorPayoutAmount: 0,

            metadata: {
                kind: 'academy_learn_from_access',
                product: 'academy_learn_from_access',
                publicName: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
                accessType: 'one_time',
                billingInterval: 'one_time',
                userId: viewer.id,
                userEmail: viewer.email,
                userName: viewer.name,
                oxapayTrackId: trackId,
                oxapayOrderId: orderId,
                oxapayInvoicePayload: invoicePayload
            }
        });

        await initial.userRef.set({
            academyLearnFromAccess: buildPendingAcademyLearnFromAccessPayload(payment, 'one_time'),
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return res.json({
            success: true,
            provider: 'oxapay',
            providerLabel: 'OxaPay',
            product: 'academy_learn_from_access',
            access: buildPendingAcademyLearnFromAccessPayload(payment, 'one_time'),
            payment,
            paymentLedgerId: payment.id,
            oxapayTrackId: trackId,
            url: paymentUrl
        });
    } catch (error) {
        console.error('academy learn from oxapay invoice error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error?.message || 'Failed to start OxaPay invoice for Academy Learn From access.',
            ...(error.payload && typeof error.payload === 'object' ? error.payload : {})
        });
    }
}
function getBadgeStripeClient() {
    const key = cleanText(process.env.STRIPE_SECRET_KEY);

    if (!key) {
        const error = new Error('STRIPE_SECRET_KEY is not configured.');
        error.statusCode = 503;
        throw error;
    }

    return new Stripe(key);
}

function resolveBadgePublicBaseUrl(req = null) {
    const configured = cleanText(
        process.env.PUBLIC_BASE_URL ||
        process.env.APP_BASE_URL ||
        process.env.BASE_URL ||
        ''
    );

    if (configured) return configured.replace(/\/+$/, '');

    const proto = cleanText(
        req?.headers?.['x-forwarded-proto'] ||
        req?.protocol ||
        'https'
    ).split(',')[0];

    const host = cleanText(
        req?.headers?.['x-forwarded-host'] ||
        req?.headers?.host ||
        ''
    ).split(',')[0];

    if (!host) {
        const error = new Error('PUBLIC_BASE_URL is not configured.');
        error.statusCode = 503;
        throw error;
    }

    return `${proto}://${host}`.replace(/\/+$/, '');
}

function normalizeBadgeReturnPath(value = '') {
    const clean = cleanText(value || '/dashboard');

    if (!clean || !clean.startsWith('/') || clean.startsWith('//')) {
        return '/dashboard';
    }

    return clean;
}

function buildBadgeReturnUrl(req, params = {}) {
    const baseUrl = resolveBadgePublicBaseUrl(req);
    const returnPath = normalizeBadgeReturnPath(req.body?.returnTo || req.body?.returnPath || '/dashboard');
    const joiner = returnPath.includes('?') ? '&' : '?';
    const query = new URLSearchParams(params).toString();

    return `${baseUrl}${returnPath}${joiner}${query}`;
}

function getBadgePaymentMethodForProvider(provider = '') {
    const clean = cleanLower(provider);

    if (clean === 'stripe') return 'card_bank_wallet';
    if (clean === 'oxapay') return 'crypto';
    if (clean === 'manual') return 'manual';

    return 'unselected';
}

function getOxaPayMerchantApiKey() {
    const key = cleanText(
        process.env.OXAPAY_MERCHANT_API_KEY ||
        process.env.OXAPAY_API_KEY ||
        ''
    );

    if (!key) {
        const error = new Error('OXAPAY_MERCHANT_API_KEY is not configured.');
        error.statusCode = 503;
        throw error;
    }

    return key;
}

function isOxaPaySandboxEnabled() {
    return String(process.env.OXAPAY_SANDBOX || '').trim().toLowerCase() === 'true';
}

function buildVerifiedBadgeOrderId(paymentId = '', division = '') {
    const cleanDivision = normalizeVerifiedBadgeDivision(division) || 'badge';

    const cleanPaymentId = cleanText(paymentId)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const seed =
        cleanPaymentId ||
        `${cleanDivision}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const digest = crypto
        .createHash('sha256')
        .update(seed)
        .digest('hex')
        .slice(0, 18);

    return `yh_badge_${cleanDivision}_${digest}`.slice(0, 50);
}

async function callOxaPayInvoiceApi(payload = {}) {
    const response = await fetch('https://api.oxapay.com/v1/payment/invoice', {
        method: 'POST',
        headers: {
            merchant_api_key: getOxaPayMerchantApiKey(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    let data = null;

    try {
        data = await response.json();
    } catch (_) {
        data = null;
    }

    if (!response.ok || Number(data?.status || 0) >= 400 || data?.error?.message) {
        const error = new Error(
            data?.error?.message ||
            data?.message ||
            `OxaPay invoice request failed with status ${response.status}.`
        );
        error.statusCode = response.status || 500;
        error.payload = data;
        throw error;
    }

    return data || {};
}

async function createOrRefreshVerifiedBadgePayment(viewer = {}, plan = {}, options = {}) {
    if (!viewer.id) {
        const error = new Error('Unauthorized.');
        error.statusCode = 401;
        throw error;
    }

    if (!plan?.division) {
        const error = new Error('Invalid badge division. Use academy or federation.');
        error.statusCode = 400;
        throw error;
    }

    const userRef = firestore.collection('users').doc(viewer.id);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        const error = new Error('User account not found.');
        error.statusCode = 404;
        throw error;
    }

    const userData = userSnap.data() || {};
    const currentBadges =
        userData.verificationBadges && typeof userData.verificationBadges === 'object'
            ? userData.verificationBadges
            : {};

    const currentBadge =
        currentBadges[plan.division] && typeof currentBadges[plan.division] === 'object'
            ? currentBadges[plan.division]
            : {};

    if (isVerifiedBadgeActiveState(currentBadge)) {
        const error = new Error(`${plan.code} badge is already active.`);
        error.statusCode = 409;
        error.payload = {
            division: plan.division,
            badge: currentBadge
        };
        throw error;
    }

    const provider = cleanLower(options.provider || 'unselected');
    const requestedBillingPlan = normalizeVerifiedBadgeBillingPlan(options.billingPlan || options.accessType || 'monthly');
    const billingPlan = provider === 'oxapay' && requestedBillingPlan === 'monthly'
        ? 'one_time'
        : requestedBillingPlan;

    const billingMeta = buildVerifiedBadgeBillingMetadata(plan, billingPlan);
    const amount = getVerifiedBadgeBillingAmount(plan, billingPlan);
    const paymentMethod = cleanText(options.paymentMethod || getBadgePaymentMethodForProvider(provider));
    const status = cleanLower(options.status || 'draft') || 'draft';
    const recordId = getVerifiedBadgePaymentRecordId(viewer.id, plan.division);

    const payment = await paymentLedgerRepo.upsertPaymentRecord({
        id: recordId,
        sourceDivision: plan.division,
        sourceFeature: plan.sourceFeature,
        sourceRecordId: `${viewer.id}_${plan.division}`,

        payerUid: viewer.id,
        payerEmail: viewer.email,
        payerName: viewer.name,

        provider,
        providerOptions: ['stripe', 'oxapay', 'manual'],
        providerPaymentId: cleanText(options.providerPaymentId),
        providerCheckoutUrl: cleanText(options.providerCheckoutUrl),
        providerStatus: cleanText(options.providerStatus),

        status,
        paymentMethod,

        amount,
        currency: plan.currency,

        platformCommissionAmount: amount,
        operatorPayoutAmount: 0,

        metadata: {
            badgeDivision: plan.division,
            badgeCode: plan.code,
            badgeAsset: plan.asset,
            badgePublicName: billingPlan === 'lifetime' ? (plan.lifetimePublicName || plan.publicName) : plan.publicName,
            userId: viewer.id,
            userEmail: viewer.email,
            userName: viewer.name,
            ...billingMeta,
            ...(options.metadata && typeof options.metadata === 'object' ? options.metadata : {})
        }
    });

    await userRef.set({
        verificationBadges: {
            [plan.division]: buildPendingVerifiedBadgePayload(plan, payment)
        },
        updatedAt: new Date().toISOString()
    }, { merge: true });

    return {
        userRef,
        userData,
        payment,
        badge: buildPendingVerifiedBadgePayload(plan, payment),
        billingPlan,
        amount
    };
}

async function createVerifiedBadgeStripeCheckoutSession(req, res) {
    try {
        const viewer = getViewer(req);
        const plan = getVerifiedBadgePlan(req.params.division || req.body?.division);

        if (!plan) {
            return res.status(400).json({
                success: false,
                message: 'Invalid badge division. Use academy or federation.'
            });
        }

        const stripe = getBadgeStripeClient();
        const billingPlan = normalizeVerifiedBadgeBillingPlan(req.body?.billingPlan || 'monthly');
        const billingMeta = buildVerifiedBadgeBillingMetadata(plan, billingPlan);
        const amount = getVerifiedBadgeBillingAmount(plan, billingPlan);
        const isMonthly = billingPlan === 'monthly';

        const initial = await createOrRefreshVerifiedBadgePayment(viewer, plan, {
            provider: 'stripe',
            paymentMethod: 'card_bank_wallet',
            billingPlan,
            status: 'checkout_started',
            providerStatus: 'checkout_starting'
        });

        const successUrl = buildBadgeReturnUrl(req, {
            badge_checkout: 'stripe-success',
            division: plan.division,
            billingPlan,
            payment: initial.payment.id
        });

        const cancelUrl = buildBadgeReturnUrl(req, {
            badge_checkout: 'stripe-cancelled',
            division: plan.division,
            billingPlan,
            payment: initial.payment.id
        });

        const priceData = {
            currency: plan.currency.toLowerCase(),
            unit_amount: Math.round(Number(amount || 0) * 100),
            product_data: {
                name: billingPlan === 'lifetime' ? (plan.lifetimePublicName || `${plan.publicName} Lifetime`) : plan.publicName,
                description: billingPlan === 'monthly'
                    ? `${plan.code} monthly recurring verification badge for YH Universe`
                    : billingPlan === 'lifetime'
                        ? `${plan.code} lifetime verification badge for YH Universe`
                        : `${plan.code} 30-day verification badge for YH Universe`
            }
        };

        if (isMonthly) {
            priceData.recurring = {
                interval: 'month'
            };
        }

        const sessionPayload = {
            mode: isMonthly ? 'subscription' : 'payment',
            client_reference_id: initial.payment.id,
            customer_email: viewer.email || undefined,
            success_url: successUrl,
            cancel_url: cancelUrl,
            line_items: [
                {
                    quantity: 1,
                    price_data: priceData
                }
            ],
            metadata: {
                kind: 'verified_badge',
                paymentLedgerId: initial.payment.id,
                badgeDivision: plan.division,
                badgeCode: plan.code,
                billingPlan,
                ...billingMeta,
                userId: viewer.id,
                userEmail: viewer.email
            }
        };

        if (isMonthly) {
            sessionPayload.subscription_data = {
                metadata: {
                    kind: 'verified_badge',
                    paymentLedgerId: initial.payment.id,
                    badgeDivision: plan.division,
                    badgeCode: plan.code,
                    billingPlan,
                    ...billingMeta,
                    userId: viewer.id,
                    userEmail: viewer.email
                }
            };
        }

        const session = await stripe.checkout.sessions.create(sessionPayload);

        const payment = await paymentLedgerRepo.upsertPaymentRecord({
            id: initial.payment.id,
            sourceDivision: plan.division,
            sourceFeature: plan.sourceFeature,
            sourceRecordId: `${viewer.id}_${plan.division}`,

            payerUid: viewer.id,
            payerEmail: viewer.email,
            payerName: viewer.name,

            provider: 'stripe',
            providerOptions: ['stripe', 'oxapay', 'manual'],
            providerPaymentId: cleanText(session.id),
            providerCheckoutUrl: cleanText(session.url),
            providerStatus: 'checkout_session_created',

            status: 'checkout_started',
            paymentMethod: isMonthly ? 'stripe_monthly_subscription' : 'stripe_one_time',

            amount,
            currency: plan.currency,

            platformCommissionAmount: amount,
            operatorPayoutAmount: 0,

            metadata: {
                badgeDivision: plan.division,
                badgeCode: plan.code,
                badgeAsset: plan.asset,
                badgePublicName: billingPlan === 'lifetime' ? (plan.lifetimePublicName || plan.publicName) : plan.publicName,
                userId: viewer.id,
                userEmail: viewer.email,
                userName: viewer.name,
                stripeCheckoutSessionId: cleanText(session.id),
                ...billingMeta
            }
        });

        await initial.userRef.set({
            verificationBadges: {
                [plan.division]: buildPendingVerifiedBadgePayload(plan, payment)
            },
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return res.json({
            success: true,
            provider: 'stripe',
            providerLabel: 'Stripe',
            division: plan.division,
            billingPlan,
            billingLabel: getVerifiedBadgeBillingLabel(billingPlan),
            badge: buildPendingVerifiedBadgePayload(plan, payment),
            payment,
            paymentLedgerId: payment.id,
            checkoutSessionId: session.id,
            url: session.url
        });
    } catch (error) {
        console.error('verified badge stripe checkout error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error?.message || 'Failed to start Stripe Checkout for verified badge.'
        });
    }
}

async function createVerifiedBadgeOxaPayInvoice(req, res) {
    try {
        const viewer = getViewer(req);
        const plan = getVerifiedBadgePlan(req.params.division || req.body?.division);

        if (!plan) {
            return res.status(400).json({
                success: false,
                message: 'Invalid badge division. Use academy or federation.'
            });
        }

        const requestedBillingPlan = normalizeVerifiedBadgeBillingPlan(req.body?.billingPlan || 'one_time', 'one_time');
        const billingPlan = requestedBillingPlan === 'monthly' ? 'one_time' : requestedBillingPlan;
        const billingMeta = buildVerifiedBadgeBillingMetadata(plan, billingPlan);
        const amount = getVerifiedBadgeBillingAmount(plan, billingPlan);

        const initial = await createOrRefreshVerifiedBadgePayment(viewer, plan, {
            provider: 'oxapay',
            paymentMethod: 'crypto',
            billingPlan,
            status: 'checkout_started',
            providerStatus: 'invoice_starting'
        });

        const baseUrl = resolveBadgePublicBaseUrl(req);
        const orderId = buildVerifiedBadgeOrderId(initial.payment.id, plan.division);

        const invoicePayload = {
            amount: Number(Number(amount || 0).toFixed(2)),
            currency: plan.currency,
            lifetime: Math.max(15, Math.min(2880, Number(process.env.OXAPAY_INVOICE_LIFETIME_MINUTES || 60))),
            fee_paid_by_payer: Number(process.env.OXAPAY_FEE_PAID_BY_PAYER || 1),
            mixed_payment: true,
            callback_url: `${baseUrl}/api/oxapay/webhook`,
            return_url: buildBadgeReturnUrl(req, {
                badge_checkout: 'oxapay-success',
                division: plan.division,
                billingPlan,
                payment: initial.payment.id
            }),
            email: viewer.email || undefined,
            order_id: orderId,
            thanks_message: 'Payment received. Return to YH Universe to see your badge status.',
            description: `${plan.publicName}: ${plan.code} — ${getVerifiedBadgeBillingLabel(billingPlan)}`,
            sandbox: isOxaPaySandboxEnabled()
        };

        const invoiceResult = await callOxaPayInvoiceApi(invoicePayload);
        const invoice = invoiceResult.data || {};

        const trackId = cleanText(invoice.track_id);
        const paymentUrl = cleanText(invoice.payment_url);

        if (!trackId || !paymentUrl) {
            return res.status(502).json({
                success: false,
                message: 'OxaPay did not return a valid invoice link.'
            });
        }

        const payment = await paymentLedgerRepo.upsertPaymentRecord({
            id: initial.payment.id,
            sourceDivision: plan.division,
            sourceFeature: plan.sourceFeature,
            sourceRecordId: `${viewer.id}_${plan.division}`,

            payerUid: viewer.id,
            payerEmail: viewer.email,
            payerName: viewer.name,

            provider: 'oxapay',
            providerOptions: ['stripe', 'oxapay', 'manual'],
            providerPaymentId: trackId,
            providerCheckoutUrl: paymentUrl,
            providerStatus: 'invoice_created',

            status: 'checkout_started',
            paymentMethod: 'crypto',

            amount,
            currency: plan.currency,

            platformCommissionAmount: amount,
            operatorPayoutAmount: 0,

            metadata: {
                badgeDivision: plan.division,
                badgeCode: plan.code,
                badgeAsset: plan.asset,
                badgePublicName: billingPlan === 'lifetime' ? (plan.lifetimePublicName || plan.publicName) : plan.publicName,
                userId: viewer.id,
                userEmail: viewer.email,
                userName: viewer.name,
                oxapayTrackId: trackId,
                oxapayOrderId: orderId,
                oxapayInvoicePayload: invoicePayload,
                ...billingMeta
            }
        });

        await initial.userRef.set({
            verificationBadges: {
                [plan.division]: buildPendingVerifiedBadgePayload(plan, payment)
            },
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return res.json({
            success: true,
            provider: 'oxapay',
            providerLabel: 'OxaPay',
            division: plan.division,
            billingPlan,
            billingLabel: getVerifiedBadgeBillingLabel(billingPlan),
            badge: buildPendingVerifiedBadgePayload(plan, payment),
            payment,
            paymentLedgerId: payment.id,
            oxapayTrackId: trackId,
            url: paymentUrl
        });
    } catch (error) {
        console.error('verified badge oxapay invoice error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error?.message || 'Failed to start OxaPay invoice for verified badge.'
        });
    }
}

async function createVerifiedBadgePaymentLedger(req, res) {
    try {
        const viewer = getViewer(req);
        const plan = getVerifiedBadgePlan(req.params.division || req.body?.division);

        if (!plan) {
            return res.status(400).json({
                success: false,
                message: 'Invalid badge division. Use academy or federation.'
            });
        }

        const billingPlan = normalizeVerifiedBadgeBillingPlan(req.body?.billingPlan || 'monthly');
        const result = await createOrRefreshVerifiedBadgePayment(viewer, plan, {
            provider: cleanLower(req.body?.provider || 'manual'),
            paymentMethod: cleanLower(req.body?.paymentMethod || 'manual'),
            billingPlan,
            status: 'draft',
            providerStatus: 'manual_payment_requested'
        });

        return res.status(201).json({
            success: true,
            message: `${plan.code} badge ${getVerifiedBadgeBillingLabel(billingPlan)} payment request created.`,
            division: plan.division,
            billingPlan,
            billingLabel: getVerifiedBadgeBillingLabel(billingPlan),
            badge: result.badge,
            payment: result.payment
        });
    } catch (error) {
        console.error('create verified badge payment ledger error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error?.message || 'Failed to create verified badge payment ledger.',
            ...(error.payload && typeof error.payload === 'object' ? error.payload : {})
        });
    }
}

async function unsubscribeVerifiedBadge(req, res) {
    try {
        const viewer = getViewer(req);
        const plan = getVerifiedBadgePlan(req.params.division || req.body?.division);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        if (!plan) {
            return res.status(400).json({
                success: false,
                message: 'Invalid badge division. Use academy or federation.'
            });
        }

        const userRef = firestore.collection('users').doc(viewer.id);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const userData = userSnap.data() || {};
        const badges = userData.verificationBadges && typeof userData.verificationBadges === 'object'
            ? userData.verificationBadges
            : {};

        const currentBadge = badges[plan.division] && typeof badges[plan.division] === 'object'
            ? badges[plan.division]
            : {};

        const nowIso = new Date().toISOString();
        const currentStatus = cleanLower(currentBadge.status || '');
        const wasActive = currentBadge.active === true || currentStatus === 'active' || currentStatus === 'verified';

        const nextBadge = {
            ...currentBadge,
            active: false,
            status: 'cancelled',
            subscriptionStatus: 'cancelled',
            division: plan.division,
            code: plan.code,
            amountMonthly: toNumber(currentBadge.amountMonthly || plan.amountMonthly, plan.amountMonthly),
            currency: cleanText(currentBadge.currency || plan.currency || 'USD').toUpperCase() || 'USD',
            interval: cleanText(currentBadge.interval || plan.interval || 'month'),
            asset: cleanText(currentBadge.asset || plan.asset),
            cancelledAt: nowIso,
            unsubscribedAt: nowIso,
            deactivatedAt: nowIso,
            updatedAt: nowIso,
            unsubscribedBy: viewer.id
        };

        await userRef.set({
            verificationBadges: {
                [plan.division]: nextBadge
            },
            updatedAt: nowIso
        }, { merge: true });

        return res.json({
            success: true,
            message: wasActive
                ? `${plan.code} badge unsubscribed.`
                : `${plan.code} badge is already inactive.`,
            division: plan.division,
            badge: nextBadge
        });
    } catch (error) {
        console.error('unsubscribe verified badge error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error?.message || 'Failed to unsubscribe verified badge.'
        });
    }
}

function isVerifiedBadgeActiveState(badge = {}) {
    const status = cleanLower(badge.status || '');

    if (isVerifiedBadgeExpired(badge)) return false;

    return (
        badge.active === true ||
        status === 'active' ||
        status === 'verified'
    );
}

function findVerifiedBadgePaymentForPlan(payments = [], plan = {}, badge = {}, viewer = {}) {
    const cleanDivision = cleanLower(plan.division);
    const cleanLedgerId = cleanText(badge.paymentLedgerId);

    const verifiedBadgePayments = Array.isArray(payments)
        ? payments.filter((payment) => {
            const metadata = payment?.metadata && typeof payment.metadata === 'object'
                ? payment.metadata
                : {};

            const sourceFeature = cleanLower(payment.sourceFeature || metadata.sourceFeature || '');
            const sourceDivision = cleanLower(payment.sourceDivision || metadata.badgeDivision || '');
            const metadataDivision = cleanLower(metadata.badgeDivision || '');
            const sourceRecordId = cleanText(payment.sourceRecordId || '');

            return (
                sourceFeature === 'verified_badge' &&
                (
                    sourceDivision === cleanDivision ||
                    metadataDivision === cleanDivision ||
                    sourceRecordId === `${viewer.id}_${cleanDivision}`
                )
            );
        })
        : [];

    if (cleanLedgerId) {
        const exact = verifiedBadgePayments.find((payment) => cleanText(payment.id) === cleanLedgerId);
        if (exact) return exact;
    }

    return verifiedBadgePayments[0] || null;
}

function buildPaymentPlanSubscriptionItem({ plan = {}, badge = {}, payment = null, viewer = {} } = {}) {
    const active = isVerifiedBadgeActiveState(badge);
    const status = active ? 'active' : cleanLower(badge.status || payment?.status || 'not_active');
    const amountMonthly = toNumber(badge.amountMonthly || payment?.amount || plan.amountMonthly, plan.amountMonthly);
    const currency = cleanText(badge.currency || payment?.currency || plan.currency || 'USD').toUpperCase() || 'USD';

    return {
        key: 'verified_badge',
        product: 'verified_badge',
        sourceFeature: plan.sourceFeature || 'verified_badge',
        division: plan.division,
        code: plan.code,
        name: plan.publicName,
        active,
        status,
        amountMonthly,
        currency,
        interval: cleanText(badge.interval || plan.interval || 'month'),
        asset: cleanText(badge.asset || plan.asset),
        provider: cleanText(badge.provider || payment?.provider || ''),
        providerPaymentId: cleanText(badge.providerPaymentId || payment?.providerPaymentId || ''),
        providerSubscriptionId: cleanText(
            badge.providerSubscriptionId ||
            badge.stripeSubscriptionId ||
            payment?.providerSubscriptionId ||
            payment?.metadata?.providerSubscriptionId ||
            ''
        ),
        paymentLedgerId: cleanText(badge.paymentLedgerId || payment?.id || ''),
        paymentStatus: cleanLower(badge.paymentStatus || payment?.status || ''),
        activatedAt: cleanText(badge.activatedAt || badge.approvedAt || ''),
        expiresAt: cleanText(badge.expiresAt || ''),
        cancelledAt: cleanText(badge.cancelledAt || badge.unsubscribedAt || ''),
        unsubscribeEndpoint: `/api/payments/subscriptions/${encodeURIComponent(plan.division)}/unsubscribe`,
        plan: {
            product: 'verified_badge',
            sourceFeature: plan.sourceFeature || 'verified_badge',
            division: plan.division,
            code: plan.code,
            publicName: plan.publicName,
            amountMonthly: plan.amountMonthly,
            currency: plan.currency,
            interval: plan.interval,
            asset: plan.asset,
            unsubscribeEndpoint: `/api/payments/subscriptions/${encodeURIComponent(plan.division)}/unsubscribe`
        },
        badge,
        payment,
        owner: {
            id: viewer.id,
            email: viewer.email,
            name: viewer.name
        }
    };
}

function findAcademyLearnFromPayment(payments = [], access = {}, viewer = {}) {
    const cleanLedgerId = cleanText(access.paymentLedgerId);

    const learnFromPayments = Array.isArray(payments)
        ? payments.filter((payment) => {
            const metadata = payment?.metadata && typeof payment.metadata === 'object'
                ? payment.metadata
                : {};

            return cleanLower(payment.sourceFeature || metadata.sourceFeature || metadata.product || metadata.kind || '') === 'academy_learn_from_access';
        })
        : [];

    if (cleanLedgerId) {
        const exact = learnFromPayments.find((payment) => cleanText(payment.id) === cleanLedgerId);
        if (exact) return exact;
    }

    const monthlyRecordId = getAcademyLearnFromPaymentRecordId(viewer.id, 'monthly');
    const oneTimeRecordId = getAcademyLearnFromPaymentRecordId(viewer.id, 'one_time');

    return learnFromPayments.find((payment) => {
        const id = cleanText(payment.id);
        return id === monthlyRecordId || id === oneTimeRecordId;
    }) || learnFromPayments[0] || null;
}

function buildAcademyLearnFromSubscriptionItem({ access = {}, payment = null, viewer = {} } = {}) {
    const normalizedAccess = normalizeAcademyLearnFromAccess(access);
    const accessType = normalizeLearnFromAccessType(normalizedAccess.accessType || payment?.metadata?.accessType || '');
    const monthly = accessType === 'monthly';
    const amount = monthly
        ? ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount
        : ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount;

    return {
        key: 'academy_learn_from_access',
        product: 'academy_learn_from_access',
        sourceFeature: 'academy_learn_from_access',
        division: 'academy',
        code: monthly ? 'Learn From Monthly' : 'Learn From',
        name: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
        active: normalizedAccess.active === true,
        status: normalizedAccess.status || 'not_active',
        amountMonthly: amount,
        currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,
        interval: monthly ? 'month' : 'one_time',
        provider: cleanText(normalizedAccess.provider || payment?.provider || ''),
        providerPaymentId: cleanText(normalizedAccess.providerPaymentId || payment?.providerPaymentId || ''),
        providerSubscriptionId: cleanText(
            normalizedAccess.providerSubscriptionId ||
            payment?.metadata?.providerSubscriptionId ||
            payment?.metadata?.stripeSubscriptionId ||
            ''
        ),
        paymentLedgerId: cleanText(normalizedAccess.paymentLedgerId || payment?.id || ''),
        paymentStatus: cleanLower(normalizedAccess.paymentStatus || payment?.status || ''),
        activatedAt: cleanText(normalizedAccess.activatedAt || ''),
        expiresAt: cleanText(normalizedAccess.expiresAt || ''),
        cancelledAt: cleanText(access.cancelledAt || access.unsubscribedAt || ''),
        unsubscribeEndpoint: '/api/payments/academy/learn-from-access/unsubscribe',
        plan: {
            product: 'academy_learn_from_access',
            sourceFeature: 'academy_learn_from_access',
            division: 'academy',
            code: monthly ? 'Learn From Monthly' : 'Learn From',
            publicName: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
            amountMonthly: amount,
            currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,
            interval: monthly ? 'month' : 'one_time',
            unsubscribeEndpoint: '/api/payments/academy/learn-from-access/unsubscribe'
        },
        access: normalizedAccess,
        payment,
        owner: {
            id: viewer.id,
            email: viewer.email,
            name: viewer.name
        }
    };
}

async function buildMySubscriptionsSnapshot(viewer = {}) {
    if (!viewer.id) {
        const error = new Error('Unauthorized.');
        error.statusCode = 401;
        throw error;
    }

    const userRef = firestore.collection('users').doc(viewer.id);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        const error = new Error('User account not found.');
        error.statusCode = 404;
        throw error;
    }

    const userData = userSnap.data() || {};
    const badges = userData.verificationBadges && typeof userData.verificationBadges === 'object'
        ? userData.verificationBadges
        : {};

    const payments = await paymentLedgerRepo.listPaymentsForUser(viewer.id, 120).catch((error) => {
        console.error('build subscriptions payment ledger load error:', error);
        return [];
    });

    const badgePlans = Object.values(VERIFIED_BADGE_PLANS).map((plan) => {
        const badge = badges[plan.division] && typeof badges[plan.division] === 'object'
            ? badges[plan.division]
            : {};

        const payment = findVerifiedBadgePaymentForPlan(payments, plan, badge, viewer);

        return buildPaymentPlanSubscriptionItem({
            plan,
            badge,
            payment,
            viewer
        });
    });

    const learnFromAccess = userData.academyLearnFromAccess && typeof userData.academyLearnFromAccess === 'object'
        ? userData.academyLearnFromAccess
        : {};

    const learnFromItem = buildAcademyLearnFromSubscriptionItem({
        access: learnFromAccess,
        payment: findAcademyLearnFromPayment(payments, learnFromAccess, viewer),
        viewer
    });

    const paymentPlans = [
        ...badgePlans,
        ...(learnFromItem.active || learnFromItem.paymentLedgerId ? [learnFromItem] : [])
    ];

    const activeSubscriptions = paymentPlans.filter((item) => item.active === true);

    return {
        success: true,
        userId: viewer.id,
        activeSubscriptions,
        paymentPlans,
        subscriptions: activeSubscriptions,
        payments: payments.filter((payment) => {
            const metadata = payment?.metadata && typeof payment.metadata === 'object'
                ? payment.metadata
                : {};

            return cleanLower(payment.sourceFeature || metadata.sourceFeature || '') === 'verified_badge';
        })
    };
}

async function listMySubscriptions(req, res) {
    try {
        const viewer = getViewer(req);
        const snapshot = await buildMySubscriptionsSnapshot(viewer);

        return res.json(snapshot);
    } catch (error) {
        console.error('list my subscriptions error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error?.message || 'Failed to load subscriptions.'
        });
    }
}

async function unsubscribePaymentPlan(req, res) {
    try {
        const viewer = getViewer(req);
        const plan = getVerifiedBadgePlan(req.params.division || req.body?.division);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        if (!plan) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subscription division. Use academy or federation.'
            });
        }

        const userRef = firestore.collection('users').doc(viewer.id);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const userData = userSnap.data() || {};
        const badges = userData.verificationBadges && typeof userData.verificationBadges === 'object'
            ? userData.verificationBadges
            : {};

        const currentBadge = badges[plan.division] && typeof badges[plan.division] === 'object'
            ? badges[plan.division]
            : {};

        const wasActive = isVerifiedBadgeActiveState(currentBadge);
        const nowIso = new Date().toISOString();
        const payments = await paymentLedgerRepo.listPaymentsForUser(viewer.id, 120).catch((error) => {
            console.error('unsubscribe payment plan ledger lookup error:', error);
            return [];
        });

        const matchedPayment = findVerifiedBadgePaymentForPlan(payments, plan, currentBadge, viewer);

        const paymentLedgerId = cleanText(currentBadge.paymentLedgerId || matchedPayment?.id || '');
        const provider = cleanLower(currentBadge.provider || matchedPayment?.provider || 'manual');
        const providerSubscriptionId = cleanText(
            currentBadge.providerSubscriptionId ||
            currentBadge.stripeSubscriptionId ||
            matchedPayment?.providerSubscriptionId ||
            matchedPayment?.metadata?.providerSubscriptionId ||
            matchedPayment?.metadata?.stripeSubscriptionId ||
            ''
        );

        let providerCancellation = null;

        if (providerSubscriptionId && provider === 'stripe') {
            const stripe = getBadgeStripeClient();

            try {
                providerCancellation = await stripe.subscriptions.cancel(providerSubscriptionId);
            } catch (stripeError) {
                console.error('stripe subscription cancellation error:', stripeError);

                return res.status(502).json({
                    success: false,
                    message: stripeError?.message || 'Stripe subscription cancellation failed.'
                });
            }
        }

        const nextBadge = {
            ...currentBadge,
            active: false,
            status: 'cancelled',
            subscriptionStatus: 'cancelled',
            paymentStatus: cleanLower(currentBadge.paymentStatus || '') === 'paid'
                ? 'paid_cancelled'
                : 'cancelled',
            division: plan.division,
            code: plan.code,
            amountMonthly: toNumber(currentBadge.amountMonthly || plan.amountMonthly, plan.amountMonthly),
            currency: cleanText(currentBadge.currency || plan.currency || 'USD').toUpperCase() || 'USD',
            interval: cleanText(currentBadge.interval || plan.interval || 'month'),
            asset: cleanText(currentBadge.asset || plan.asset),
            cancelledAt: nowIso,
            unsubscribedAt: nowIso,
            deactivatedAt: nowIso,
            updatedAt: nowIso,
            unsubscribedBy: viewer.id,
            providerCancellationId: cleanText(providerCancellation?.id || '')
        };

        await userRef.set({
            verificationBadges: {
                [plan.division]: nextBadge
            },
            updatedAt: nowIso
        }, { merge: true });

        if (paymentLedgerId) {
            await paymentLedgerRepo.upsertPaymentRecord({
                id: paymentLedgerId,
                sourceDivision: plan.division,
                sourceFeature: plan.sourceFeature,
                sourceRecordId: `${viewer.id}_${plan.division}`,

                payerUid: viewer.id,
                payerEmail: viewer.email,
                payerName: viewer.name,

                provider,
                providerOptions: ['stripe', 'oxapay', 'manual'],
                providerPaymentId: cleanText(currentBadge.providerPaymentId),
                providerStatus: 'user_unsubscribed',

                status: 'cancelled',
                paymentMethod: cleanText(currentBadge.paymentMethod || 'manual'),

                amount: toNumber(currentBadge.amountMonthly || plan.amountMonthly, plan.amountMonthly),
                currency: cleanText(currentBadge.currency || plan.currency || 'USD').toUpperCase() || 'USD',

                platformCommissionAmount: toNumber(currentBadge.amountMonthly || plan.amountMonthly, plan.amountMonthly),
                operatorPayoutAmount: 0,

                metadata: {
                    badgeDivision: plan.division,
                    badgeCode: plan.code,
                    badgeAsset: plan.asset,
                    badgePublicName: plan.publicName,
                    billingInterval: plan.interval,
                    userId: viewer.id,
                    userEmail: viewer.email,
                    userName: viewer.name,
                    unsubscribedAt: nowIso,
                    unsubscribedBy: viewer.id,
                    previousBadgeStatus: cleanText(currentBadge.status),
                    providerSubscriptionId,
                    providerCancellationId: cleanText(providerCancellation?.id || '')
                }
            }).catch((ledgerError) => {
                console.error('unsubscribe payment ledger update error:', ledgerError);
            });
        }

        const snapshot = await buildMySubscriptionsSnapshot(viewer);

        return res.json({
            success: true,
            message: wasActive
                ? `${plan.code} subscription unsubscribed.`
                : `${plan.code} subscription was already inactive.`,
            division: plan.division,
            badge: nextBadge,
            providerCancellation,
            snapshot
        });
    } catch (error) {
        console.error('unsubscribe payment plan error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error?.message || 'Failed to unsubscribe payment plan.'
        });
    }
}

async function unsubscribeAcademyLearnFromAccess(req, res) {
    try {
        const viewer = getViewer(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const userRef = firestore.collection('users').doc(viewer.id);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        const userData = userSnap.data() || {};
        const currentAccess = userData.academyLearnFromAccess && typeof userData.academyLearnFromAccess === 'object'
            ? userData.academyLearnFromAccess
            : {};

        const normalizedAccess = normalizeAcademyLearnFromAccess(currentAccess);
        const wasActive = normalizedAccess.active === true;
        const nowIso = new Date().toISOString();

        const payments = await paymentLedgerRepo.listPaymentsForUser(viewer.id, 120).catch((error) => {
            console.error('unsubscribe learn from ledger lookup error:', error);
            return [];
        });

        const matchedPayment = findAcademyLearnFromPayment(payments, currentAccess, viewer);
        const paymentLedgerId = cleanText(normalizedAccess.paymentLedgerId || matchedPayment?.id || '');
        const accessType = normalizeLearnFromAccessType(normalizedAccess.accessType || matchedPayment?.metadata?.accessType || 'monthly') || 'monthly';
        const provider = cleanLower(normalizedAccess.provider || matchedPayment?.provider || 'manual');
        const providerSubscriptionId = cleanText(
            normalizedAccess.providerSubscriptionId ||
            matchedPayment?.providerSubscriptionId ||
            matchedPayment?.metadata?.providerSubscriptionId ||
            matchedPayment?.metadata?.stripeSubscriptionId ||
            ''
        );

        let providerCancellation = null;

        if (providerSubscriptionId && provider === 'stripe') {
            const stripe = getBadgeStripeClient();

            try {
                providerCancellation = await stripe.subscriptions.cancel(providerSubscriptionId);
            } catch (stripeError) {
                console.error('stripe learn from subscription cancellation error:', stripeError);

                return res.status(502).json({
                    success: false,
                    message: stripeError?.message || 'Stripe subscription cancellation failed.'
                });
            }
        }

        const nextAccess = {
            ...currentAccess,
            active: false,
            status: 'cancelled',
            subscriptionStatus: 'cancelled',
            paymentStatus: cleanLower(currentAccess.paymentStatus || '') === 'paid'
                ? 'paid_cancelled'
                : 'cancelled',
            product: 'academy_learn_from_access',
            name: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
            accessType,
            amountMonthly: ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount,
            amountOneTime: ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount,
            currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,
            paymentLedgerId,
            provider,
            providerPaymentId: cleanText(normalizedAccess.providerPaymentId || matchedPayment?.providerPaymentId || ''),
            providerSubscriptionId,
            cancelledAt: nowIso,
            unsubscribedAt: nowIso,
            deactivatedAt: nowIso,
            updatedAt: nowIso,
            unsubscribedBy: viewer.id,
            providerCancellationId: cleanText(providerCancellation?.id || '')
        };

        await userRef.set({
            academyLearnFromAccess: nextAccess,
            updatedAt: nowIso
        }, { merge: true });

        if (paymentLedgerId) {
            const amount = accessType === 'monthly'
                ? ACADEMY_LEARN_FROM_ACCESS_PLAN.monthlyAmount
                : ACADEMY_LEARN_FROM_ACCESS_PLAN.oneTimeAmount;

            await paymentLedgerRepo.upsertPaymentRecord({
                id: paymentLedgerId,
                sourceDivision: ACADEMY_LEARN_FROM_ACCESS_PLAN.sourceDivision,
                sourceFeature: ACADEMY_LEARN_FROM_ACCESS_PLAN.sourceFeature,
                sourceRecordId: `${viewer.id}_${accessType}`,

                payerUid: viewer.id,
                payerEmail: viewer.email,
                payerName: viewer.name,

                provider,
                providerOptions: ['stripe', 'oxapay'],
                providerPaymentId: cleanText(nextAccess.providerPaymentId),
                providerStatus: 'user_unsubscribed',

                status: 'cancelled',
                paymentMethod: cleanText(currentAccess.paymentMethod || matchedPayment?.paymentMethod || 'unselected'),

                amount,
                currency: ACADEMY_LEARN_FROM_ACCESS_PLAN.currency,

                platformCommissionAmount: amount,
                operatorPayoutAmount: 0,

                metadata: {
                    ...(matchedPayment?.metadata && typeof matchedPayment.metadata === 'object' ? matchedPayment.metadata : {}),
                    kind: 'academy_learn_from_access',
                    product: 'academy_learn_from_access',
                    publicName: ACADEMY_LEARN_FROM_ACCESS_PLAN.publicName,
                    accessType,
                    userId: viewer.id,
                    userEmail: viewer.email,
                    userName: viewer.name,
                    unsubscribedAt: nowIso,
                    unsubscribedBy: viewer.id,
                    previousAccessStatus: cleanText(currentAccess.status),
                    providerSubscriptionId,
                    providerCancellationId: cleanText(providerCancellation?.id || '')
                }
            }).catch((ledgerError) => {
                console.error('unsubscribe learn from ledger update error:', ledgerError);
            });
        }

        const snapshot = await buildMySubscriptionsSnapshot(viewer);

        return res.json({
            success: true,
            message: wasActive
                ? 'Academy Learn From access unsubscribed.'
                : 'Academy Learn From access was already inactive.',
            access: nextAccess,
            providerCancellation,
            snapshot
        });
    } catch (error) {
        console.error('unsubscribe academy learn from access error:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error?.message || 'Failed to unsubscribe Academy Learn From access.'
        });
    }
}

async function createFederationPaidIntroLedger(req, res) {
    try {
        const viewer = getViewer(req);
        const requestId = cleanText(req.params.requestId);

        if (!viewer.id || !requestId) {
            return res.status(400).json({
                success: false,
                message: 'Missing Federation request id.'
            });
        }

        const requestRef = firestore.collection('federationConnectionRequests').doc(requestId);
        const requestSnap = await requestRef.get();

        if (!requestSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Federation connection request not found.'
            });
        }

        const request = requestSnap.data() || {};
        const requesterUid = cleanText(request.requesterUid);

        if (requesterUid !== viewer.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only create a payment ledger for your own Federation request.'
            });
        }

        const pricingAmount = Math.max(0, toNumber(request.pricingAmount || request.dealPackage?.pricingAmount, 0));
        const currency = cleanText(request.currency || request.dealPackage?.currency || 'USD').toUpperCase() || 'USD';

        if (!pricingAmount) {
            return res.status(400).json({
                success: false,
                message: 'This Federation request has not been priced by admin yet.'
            });
        }

        const paymentStatus = cleanLower(request.paymentStatus || request.dealPackage?.paymentStatus || 'not_started');
        const ledgerStatus = paymentStatus === 'paid' ? 'paid' : 'draft';

        const payment = await paymentLedgerRepo.upsertPaymentRecord({
            sourceDivision: 'federation',
            sourceFeature: 'paid_intro',
            sourceRecordId: requestId,

            payerUid: viewer.id,
            payerEmail: viewer.email || cleanText(request.requesterEmail).toLowerCase(),
            payerName: viewer.name || cleanText(request.requesterName),

            provider: 'unselected',
            providerOptions: ['stripe', 'oxapay'],
            status: ledgerStatus,
            paymentMethod: 'unselected',

            amount: pricingAmount,
            currency,

            platformCommissionAmount: Math.max(0, toNumber(request.platformCommissionAmount || request.dealPackage?.platformCommissionAmount, 0)),
            operatorPayoutAmount: Math.max(0, toNumber(request.operatorPayoutAmount || request.dealPackage?.operatorPayoutAmount, 0)),

            metadata: {
                ownerUid: cleanText(request.ownerUid),
                leadId: cleanText(request.leadId),
                opportunityTitle: cleanText(request.opportunityTitle || 'Federation paid introduction'),
                requestStatus: cleanText(request.status || 'pricing_sent')
            }
        });

        await requestRef.set({
            paymentLedgerId: payment.id,
            paymentLedgerStatus: payment.status,
            paymentProviderOptions: ['stripe', 'oxapay'],
            paymentLedgerUpdatedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        }, { merge: true });

        return res.status(201).json({
            success: true,
            payment
        });
    } catch (error) {
        console.error('create federation paid intro payment ledger error:', error);

        return res.status(500).json({
            success: false,
            message: error?.message || 'Failed to create Federation payment ledger.'
        });
    }
}
function normalizePlazaCommissionRate(value = null, fallback = 0.2) {
    const parsed = toNumber(value, fallback);

    if (!Number.isFinite(parsed)) return fallback;

    if (parsed > 1) {
        return Math.max(0, Math.min(1, parsed / 100));
    }

    return Math.max(0, Math.min(1, parsed));
}

function roundMoney(value = 0) {
    return Math.round(Math.max(0, toNumber(value, 0)) * 100) / 100;
}

function getPlazaOpportunityOwnerUid(opportunity = {}) {
    return cleanText(
        opportunity.ownerUid ||
        opportunity.authorId ||
        opportunity.authorUid ||
        opportunity.createdByUserId ||
        opportunity.createdBy ||
        opportunity.userId ||
        ''
    );
}

function getPlazaOpportunityTitle(opportunity = {}) {
    return cleanText(
        opportunity.title ||
        opportunity.name ||
        opportunity.text ||
        opportunity.description ||
        'Plaza opportunity deal'
    ).slice(0, 220);
}

function getPlazaOpportunityAmount(opportunity = {}, body = {}) {
    return Math.max(
        0,
        toNumber(
            body.amount ||
            body.pricingAmount ||
            body.price ||
            opportunity.pricingAmount ||
            opportunity.price ||
            opportunity.budgetAmount ||
            opportunity.budgetMax ||
            opportunity.budgetMin ||
            0
        )
    );
}

function shouldSettlePlazaPaymentNow() {
    return false;
}

async function upsertPlazaOpportunityPayoutEarning({
    ownerUid = '',
    ownerEmail = '',
    ownerName = '',
    opportunityId = '',
    opportunityTitle = '',
    payment = {},
    payer = {},
    amount = 0,
    currency = 'USD',
    grossAmount = 0,
    platformCommissionAmount = 0,
    commissionRate = 0
} = {}) {
    const cleanOwnerUid = cleanText(ownerUid);
    const cleanOpportunityId = cleanText(opportunityId);

    if (!cleanOwnerUid || !cleanOpportunityId) {
        return null;
    }

    const payoutId = `plaza_${cleanOpportunityId}`.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 180);
    const now = Timestamp.now();

    const payoutRef = firestore
        .collection('users')
        .doc(cleanOwnerUid)
        .collection('academyLeadPayouts')
        .doc(payoutId);

    const payload = {
        id: payoutId,

        sourceDivision: 'plaza',
        sourceFeature: 'opportunity_deal',
        sourceRecordId: cleanOpportunityId,
        sourcePaymentId: cleanText(payment.id),

        title: cleanText(opportunityTitle || 'Plaza opportunity deal'),
        opportunityTitle: cleanText(opportunityTitle || 'Plaza opportunity deal'),

        receiverUid: cleanOwnerUid,
        receiverEmail: cleanText(ownerEmail).toLowerCase(),
        receiverName: cleanText(ownerName || 'Plaza Operator'),

        payerUid: cleanText(payer.id),
        payerEmail: cleanText(payer.email).toLowerCase(),
        payerName: cleanText(payer.name || 'Plaza Buyer'),

        grossAmount: roundMoney(grossAmount),
        platformCommissionAmount: roundMoney(platformCommissionAmount),
        operatorPayoutAmount: roundMoney(amount),
        payoutAmount: roundMoney(amount),
        amount: roundMoney(amount),
        currency: normalizeWithdrawalCurrency(currency),

        commissionRate: normalizePlazaCommissionRate(commissionRate, 0),

        status: 'available',
        payoutStatus: 'unrequested',
        paymentStatus: 'paid',

        createdAt: now,
        updatedAt: now,
        approvedAt: now,

        metadata: {
            source: 'plaza_opportunity_payment',
            paymentLedgerId: cleanText(payment.id),
            opportunityId: cleanOpportunityId
        }
    };

    await payoutRef.set(payload, { merge: true });

    const payoutSnap = await payoutRef.get();

    return {
        id: payoutSnap.id,
        ...(payoutSnap.data() || {})
    };
}

async function createPlazaOpportunityPaymentLedger(req, res) {
    try {
        const viewer = getViewer(req);
        const opportunityId = cleanText(req.params.opportunityId);
        const body = req.body || {};

        if (!viewer.id || !opportunityId) {
            return res.status(400).json({
                success: false,
                message: 'Missing Plaza opportunity id.'
            });
        }

        const opportunityRef = firestore.collection('plazaOpportunities').doc(opportunityId);
        const opportunitySnap = await opportunityRef.get();

        if (!opportunitySnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Plaza opportunity not found.'
            });
        }

        const opportunity = opportunitySnap.data() || {};
        const ownerUid = getPlazaOpportunityOwnerUid(opportunity);

        if (!ownerUid) {
            return res.status(400).json({
                success: false,
                message: 'This Plaza opportunity has no owner/operator attached yet.'
            });
        }

        if (ownerUid === viewer.id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot create a payment ledger for your own Plaza opportunity.'
            });
        }

        const amount = getPlazaOpportunityAmount(opportunity, body);
        const currency = normalizeWithdrawalCurrency(
            body.currency ||
            opportunity.currency ||
            'USD'
        );

        if (!amount) {
            return res.status(400).json({
                success: false,
                message: 'Set a Plaza opportunity amount before creating a payment ledger.'
            });
        }

        const commissionRate = normalizePlazaCommissionRate(
            body.commissionRate ??
            opportunity.commissionRate ??
            opportunity.platformCommissionRate ??
            0.2,
            0.2
        );

        const platformCommissionAmount = roundMoney(amount * commissionRate);
        const operatorPayoutAmount = roundMoney(amount - platformCommissionAmount);
        const opportunityTitle = getPlazaOpportunityTitle(opportunity);
        const settleNow = shouldSettlePlazaPaymentNow(body, opportunity);
        const ledgerStatus = settleNow ? 'paid' : 'draft';

        const payment = await paymentLedgerRepo.upsertPaymentRecord({
            sourceDivision: 'plaza',
            sourceFeature: 'opportunity_deal',
            sourceRecordId: opportunityId,

            payerUid: viewer.id,
            payerEmail: viewer.email,
            payerName: viewer.name,

            provider: cleanLower(body.provider || 'unselected'),
            providerOptions: ['stripe', 'oxapay', 'manual'],
            status: ledgerStatus,
            paymentMethod: cleanLower(body.paymentMethod || 'unselected'),

            amount,
            currency,

            platformCommissionAmount,
            operatorPayoutAmount,

            metadata: {
                ownerUid,
                opportunityId,
                opportunityTitle,
                opportunityStatus: cleanText(opportunity.status || opportunity.reviewStatus || ''),
                commissionRate,
                settlementMode: settleNow ? 'manual_paid' : 'ledger_created',
                transactionType: 'internal_plaza_service_transaction',
                transactionContext: 'Service seeker to Academy member/service provider',
                serviceProviderUid: ownerUid,
                serviceProviderName: cleanText(opportunity.ownerName || opportunity.authorName || opportunity.member || 'Plaza Operator'),
                serviceSeekerUid: viewer.id,
                serviceSeekerName: viewer.name,
                payoutUnlockRule: 'Admin must verify/settle payment before provider payout becomes available.',
                settlementPolicy: 'Draft ledger first, admin settlement second, wallet payout third.'
            }
        });

        const opportunityUpdate = {
            pricingAmount: amount,
            currency,
            commissionRate,
            platformCommissionAmount,
            operatorPayoutAmount,

            paymentLedgerId: payment.id,
            paymentLedgerStatus: payment.status,
            providerOptions: ['stripe', 'oxapay', 'manual'],
            paymentProviderOptions: ['stripe', 'oxapay', 'manual'],

            internalTransactionType: 'service_marketplace_deal',
            serviceProviderUid: ownerUid,
            serviceSeekerUid: viewer.id,
            payoutUnlockRule: 'admin_settlement_required',

            paymentLedgerUpdatedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        if (settleNow) {
            opportunityUpdate.paymentStatus = 'paid';
            opportunityUpdate.paidAt = Timestamp.now();
            opportunityUpdate.dealStatus = 'paid';
        }

        await opportunityRef.set(opportunityUpdate, { merge: true });

        let payoutEarning = null;

        if (settleNow) {
            payoutEarning = await upsertPlazaOpportunityPayoutEarning({
                ownerUid,
                ownerEmail: cleanText(opportunity.ownerEmail || opportunity.authorEmail || ''),
                ownerName: cleanText(opportunity.ownerName || opportunity.authorName || opportunity.member || 'Plaza Operator'),

                opportunityId,
                opportunityTitle,

                payment,
                payer: viewer,

                amount: operatorPayoutAmount,
                currency,
                grossAmount: amount,
                platformCommissionAmount,
                commissionRate
            });
        }

        return res.status(201).json({
            success: true,
            payment,
            payoutEarning,
            opportunity: {
                id: opportunityId,
                ...opportunityUpdate
            }
        });
    } catch (error) {
        console.error('create plaza opportunity payment ledger error:', error);

        return res.status(500).json({
            success: false,
            message: error?.message || 'Failed to create Plaza payment ledger.'
        });
    }
}
async function listMyPayments(req, res) {
    try {
        const viewer = getViewer(req);
        const payments = await paymentLedgerRepo.listPaymentsForUser(viewer.id, 120);

        return res.json({
            success: true,
            payments
        });
    } catch (error) {
        console.error('list my payments error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load payment ledger.'
        });
    }
}
function normalizeWithdrawalCurrency(value = 'USD') {
    return cleanText(value || 'USD').toUpperCase() || 'USD';
}

function getUniversalBalanceDivision(value = '') {
    const raw = cleanLower(value || '');

    if (raw === 'universe' || raw.includes('universe') || raw.includes('referral')) return 'universe';
    if (raw === 'federation' || raw.includes('federation')) return 'federation';
    if (raw === 'plaza' || raw === 'plazas' || raw.includes('plaza')) return 'plaza';
    if (raw === 'academy' || raw.includes('academy')) return 'academy';

    return 'academy';
}

function createUniversalDivisionBreakdown(currency = 'USD') {
    return {
        universe: {
            label: 'Universe Referrals',
            currency,
            approvedEarnings: 0,
            reservedWithdrawals: 0,
            available: 0
        },
        academy: {
            label: 'Academy',
            currency,
            approvedEarnings: 0,
            reservedWithdrawals: 0,
            available: 0
        },
        plaza: {
            label: 'Plaza',
            currency,
            approvedEarnings: 0,
            reservedWithdrawals: 0,
            available: 0
        },
        federation: {
            label: 'Federation',
            currency,
            approvedEarnings: 0,
            reservedWithdrawals: 0,
            available: 0
        }
    };
}

function isApprovedUniversalEarning(record = {}) {
    const status = cleanLower(record.status || '');
    const payoutStatus = cleanLower(record.payoutStatus || '');
    const paymentStatus = cleanLower(record.paymentStatus || '');

    const isApprovedEarning =
        status === 'approved' ||
        status === 'ready_for_payment' ||
        status === 'available';

    const paymentIsConfirmed =
        !paymentStatus ||
        paymentStatus === 'paid' ||
        paymentStatus === 'earned';

    const alreadyMarkedPaid =
        status === 'paid' ||
        payoutStatus === 'paid';

    return isApprovedEarning && paymentIsConfirmed && !alreadyMarkedPaid;
}

async function resolveAcademyWithdrawalBalance(viewerId = '', currency = 'USD') {
    const cleanViewerId = cleanText(viewerId);
    const cleanCurrency = normalizeWithdrawalCurrency(currency);

    const emptyBreakdown = createUniversalDivisionBreakdown(cleanCurrency);

    if (!cleanViewerId) {
        return {
            scope: 'universal',
            currency: cleanCurrency,
            approvedEarnings: 0,
            reservedWithdrawals: 0,
            available: 0,
            divisionBreakdown: emptyBreakdown
        };
    }

    const divisionBreakdown = createUniversalDivisionBreakdown(cleanCurrency);

    const earningsSnap = await firestore
        .collection('users')
        .doc(cleanViewerId)
        .collection('academyLeadPayouts')
        .get()
        .catch(() => ({ docs: [] }));

    const approvedEarnings = earningsSnap.docs.reduce((total, doc) => {
        const payout = doc.data() || {};
        const payoutCurrency = normalizeWithdrawalCurrency(payout.currency || cleanCurrency);

        if (payoutCurrency !== cleanCurrency) return total;
        if (!isApprovedUniversalEarning(payout)) return total;

        const amount = Math.max(
            0,
            toNumber(
                payout.amount ||
                payout.operatorPayoutAmount ||
                payout.payoutAmount ||
                0
            )
        );

        const division = getUniversalBalanceDivision(
            payout.sourceDivision ||
            payout.division ||
            payout.source ||
            'academy'
        );

        divisionBreakdown[division].approvedEarnings += amount;

        return total + amount;
    }, 0);

    const existingPayouts = await paymentLedgerRepo
        .listPayoutsForUser(cleanViewerId, 200)
        .catch(() => []);

    const reservedWithdrawals = existingPayouts.reduce((total, payout) => {
        const payoutCurrency = normalizeWithdrawalCurrency(payout.currency || cleanCurrency);

        if (payoutCurrency !== cleanCurrency) return total;

        const status = cleanLower(payout.status || '');

        if (!['pending_review', 'approved', 'processing', 'paid'].includes(status)) {
            return total;
        }

        const amount = Math.max(0, toNumber(payout.amount, 0));
        const division = getUniversalBalanceDivision(payout.sourceDivision || 'wallet');

        if (divisionBreakdown[division]) {
            divisionBreakdown[division].reservedWithdrawals += amount;
        }

        return total + amount;
    }, 0);

    Object.keys(divisionBreakdown).forEach((division) => {
        const item = divisionBreakdown[division];
        item.available = Math.max(0, item.approvedEarnings - item.reservedWithdrawals);
    });

    const available = Math.max(0, approvedEarnings - reservedWithdrawals);

    return {
        scope: 'universal',
        currency: cleanCurrency,
        approvedEarnings,
        reservedWithdrawals,
        available,
        divisionBreakdown
    };
}
async function getMyPayoutBalance(req, res) {
    try {
        const viewer = getViewer(req);
        const currency = normalizeWithdrawalCurrency(req.query?.currency || 'USD');

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const balance = await resolveAcademyWithdrawalBalance(viewer.id, currency);

        return res.json({
            success: true,
            balance
        });
    } catch (error) {
        console.error('get payout balance error:', error);

        return res.status(500).json({
            success: false,
            message: error?.message || 'Failed to load payout balance.'
        });
    }
}
async function createWithdrawalRequest(req, res) {
    try {
        const viewer = getViewer(req);
        const body = req.body || {};
        const amount = Math.max(0, toNumber(body.amount, 0));

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        if (!amount) {
            return res.status(400).json({
                success: false,
                message: 'Withdrawal amount is required.'
            });
        }

        const method = cleanLower(body.method || 'local_bank');
        const allowedMethods = new Set(['local_bank', 'bank', 'bank_transfer', 'card', 'credit_card', 'debit_card', 'crypto', 'cryptocurrency']);

        if (!allowedMethods.has(method)) {
            return res.status(400).json({
                success: false,
                message: 'Unsupported payout method.'
            });
        }

        const currency = normalizeWithdrawalCurrency(body.currency || 'USD');
        const balance = await resolveAcademyWithdrawalBalance(viewer.id, currency);

        if (amount > balance.available) {
            return res.status(400).json({
                success: false,
                message: `Insufficient withdrawable balance. Available: ${balance.currency} ${balance.available.toFixed(2)}.`,
                balance
            });
        }

        const payout = await paymentLedgerRepo.createPayoutRequest({
            receiverUid: viewer.id,
            receiverEmail: viewer.email,
            receiverName: viewer.name,

            sourceDivision: cleanLower(body.sourceDivision || 'academy'),
            sourceFeature: cleanLower(body.sourceFeature || 'member_withdrawal'),
            sourcePaymentId: cleanText(body.sourcePaymentId),
            sourceRecordId: cleanText(body.sourceRecordId || `withdrawal_${Date.now()}`),

            method,
            provider: method === 'crypto' || method === 'cryptocurrency' ? 'oxapay' : 'manual',

            amount,
            currency,

            bankCountry: cleanText(body.bankCountry),
            bankName: cleanText(body.bankName),
            accountName: cleanText(body.accountName),
            accountNumber: cleanText(body.accountNumber),

            cardLast4: cleanText(body.cardLast4 || body.cardNumber).slice(-4),

            cryptoCurrency: cleanText(body.cryptoCurrency).toUpperCase(),
            cryptoNetwork: cleanText(body.cryptoNetwork),
            walletAddress: cleanText(body.walletAddress),

            status: 'pending_review',
            adminNote: '',

            metadata: {
                requestSource: 'member_payout_request',
                note: cleanText(body.note || '').slice(0, 500)
            }
        });

        return res.status(201).json({
            success: true,
            payout
        });
    } catch (error) {
        console.error('create withdrawal request error:', error);

        return res.status(500).json({
            success: false,
            message: error?.message || 'Failed to create payout request.'
        });
    }
}

async function listMyPayouts(req, res) {
    try {
        const viewer = getViewer(req);
        const payouts = await paymentLedgerRepo.listPayoutsForUser(viewer.id, 120);

        return res.json({
            success: true,
            payouts
        });
    } catch (error) {
        console.error('list my payouts error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load payout ledger.'
        });
    }
}

module.exports = {
    getPaymentOptions,
    getPayoutOptions,
    listMySubscriptions,
    unsubscribePaymentPlan,
    getAcademyLearnFromAccess,
    unsubscribeAcademyLearnFromAccess,
    createAcademyLearnFromStripeCheckoutSession,
    createAcademyLearnFromOxaPayInvoice,
    createVerifiedBadgePaymentLedger,
    createVerifiedBadgeStripeCheckoutSession,
    createVerifiedBadgeOxaPayInvoice,
    unsubscribeVerifiedBadge,
    createFederationPaidIntroLedger,
    createPlazaOpportunityPaymentLedger,
    listMyPayments,
    getMyPayoutBalance,
    createWithdrawalRequest,
    listMyPayouts
};