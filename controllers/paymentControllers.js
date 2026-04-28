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
    return res.json({
        success: true,
        paymentProviders: [
            {
                id: 'stripe',
                label: 'Pay with Card / Bank / Wallet',
                status: 'active',
                methods: ['card', 'bank', 'wallet'],
                currencies: ['fiat']
            },
            {
                id: 'oxapay',
                label: 'Pay with Crypto',
                status: 'active',
                methods: ['crypto'],
                currencies: ['crypto']
            },
            {
                id: 'manual',
                label: 'Manual Admin Payment',
                status: 'fallback',
                methods: ['manual'],
                currencies: ['fiat', 'crypto']
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
                label: 'Withdraw to Crypto Wallet',
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
        currency: 'USD',
        interval: 'month',
        asset: '/images/yha%20badge.png',
        sourceFeature: 'verified_badge',
        publicName: 'Academy Verified Badge'
    },
    federation: {
        division: 'federation',
        code: 'YHF',
        amountMonthly: 28.12,
        currency: 'USD',
        interval: 'month',
        asset: '/images/yhf%20badge.png',
        sourceFeature: 'verified_badge',
        publicName: 'Federation Verified Badge'
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

function buildPendingVerifiedBadgePayload(plan = {}, payment = {}) {
    return {
        active: false,
        status: 'pending_payment',
        code: cleanText(plan.code),
        division: cleanText(plan.division),
        amountMonthly: toNumber(plan.amountMonthly, 0),
        currency: cleanText(plan.currency || 'USD').toUpperCase() || 'USD',
        interval: cleanText(plan.interval || 'month'),
        asset: cleanText(plan.asset),
        paymentLedgerId: cleanText(payment.id),
        paymentStatus: cleanText(payment.status || 'draft'),
        updatedAt: new Date().toISOString()
    };
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

    const currentBadgeStatus = cleanLower(currentBadge.status || '');

    if (
        currentBadge.active === true ||
        currentBadgeStatus === 'active' ||
        currentBadgeStatus === 'verified'
    ) {
        const error = new Error(`${plan.code} badge is already active.`);
        error.statusCode = 409;
        error.payload = {
            division: plan.division,
            badge: currentBadge
        };
        throw error;
    }

    const provider = cleanLower(options.provider || 'unselected');
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

        amount: plan.amountMonthly,
        currency: plan.currency,

        platformCommissionAmount: plan.amountMonthly,
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
        badge: buildPendingVerifiedBadgePayload(plan, payment)
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

        const initial = await createOrRefreshVerifiedBadgePayment(viewer, plan, {
            provider: 'stripe',
            paymentMethod: 'card_bank_wallet',
            status: 'checkout_started',
            providerStatus: 'checkout_starting'
        });

        const successUrl = buildBadgeReturnUrl(req, {
            badge_checkout: 'stripe-success',
            division: plan.division,
            payment: initial.payment.id
        });

        const cancelUrl = buildBadgeReturnUrl(req, {
            badge_checkout: 'stripe-cancelled',
            division: plan.division,
            payment: initial.payment.id
        });

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            client_reference_id: initial.payment.id,
            customer_email: viewer.email || undefined,
            success_url: successUrl,
            cancel_url: cancelUrl,
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: plan.currency.toLowerCase(),
                        unit_amount: Math.round(Number(plan.amountMonthly || 0) * 100),
                        product_data: {
                            name: plan.publicName,
                            description: `${plan.code} verification badge for YH Universe`
                        }
                    }
                }
            ],
            metadata: {
                kind: 'verified_badge',
                paymentLedgerId: initial.payment.id,
                badgeDivision: plan.division,
                badgeCode: plan.code,
                userId: viewer.id,
                userEmail: viewer.email
            }
        });

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
            paymentMethod: 'card_bank_wallet',

            amount: plan.amountMonthly,
            currency: plan.currency,

            platformCommissionAmount: plan.amountMonthly,
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
                stripeCheckoutSessionId: cleanText(session.id)
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

        const initial = await createOrRefreshVerifiedBadgePayment(viewer, plan, {
            provider: 'oxapay',
            paymentMethod: 'crypto',
            status: 'checkout_started',
            providerStatus: 'invoice_starting'
        });

        const baseUrl = resolveBadgePublicBaseUrl(req);
        const orderId = buildVerifiedBadgeOrderId(initial.payment.id, plan.division);

        const invoicePayload = {
            amount: Number(Number(plan.amountMonthly || 0).toFixed(2)),
            currency: plan.currency,
            lifetime: Math.max(15, Math.min(2880, Number(process.env.OXAPAY_INVOICE_LIFETIME_MINUTES || 60))),
            fee_paid_by_payer: Number(process.env.OXAPAY_FEE_PAID_BY_PAYER || 1),
            mixed_payment: true,
            callback_url: `${baseUrl}/api/oxapay/webhook`,
            return_url: buildBadgeReturnUrl(req, {
                badge_checkout: 'oxapay-success',
                division: plan.division,
                payment: initial.payment.id
            }),
            email: viewer.email || undefined,
            order_id: orderId,
            thanks_message: 'Payment received. Return to YH Universe to see your badge status.',
            description: `${plan.publicName}: ${plan.code}`,
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

            amount: plan.amountMonthly,
            currency: plan.currency,

            platformCommissionAmount: plan.amountMonthly,
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
                oxapayTrackId: trackId,
                oxapayOrderId: orderId,
                oxapayInvoicePayload: invoicePayload
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

        const result = await createOrRefreshVerifiedBadgePayment(viewer, plan, {
            provider: cleanLower(req.body?.provider || 'manual'),
            paymentMethod: cleanLower(req.body?.paymentMethod || 'manual'),
            status: 'draft',
            providerStatus: 'manual_payment_requested'
        });

        return res.status(201).json({
            success: true,
            message: `${plan.code} badge payment ledger created.`,
            division: plan.division,
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
                settlementMode: settleNow ? 'manual_paid' : 'ledger_created'
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
            paymentProviderOptions: ['stripe', 'oxapay', 'manual'],
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

    if (raw === 'federation' || raw.includes('federation')) return 'federation';
    if (raw === 'plaza' || raw === 'plazas' || raw.includes('plaza')) return 'plaza';
    if (raw === 'academy' || raw.includes('academy')) return 'academy';

    return 'academy';
}

function createUniversalDivisionBreakdown(currency = 'USD') {
    return {
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
    createVerifiedBadgePaymentLedger,
    createVerifiedBadgeStripeCheckoutSession,
    createVerifiedBadgeOxaPayInvoice,
    createFederationPaidIntroLedger,
    createPlazaOpportunityPaymentLedger,
    listMyPayments,
    getMyPayoutBalance,
    createWithdrawalRequest,
    listMyPayouts
};