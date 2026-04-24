const { firestore } = require('../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');
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
                status: 'planned',
                methods: ['card', 'bank', 'wallet'],
                currencies: ['fiat']
            },
            {
                id: 'oxapay',
                label: 'Pay with Crypto',
                status: 'planned',
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
            currency: cleanText(body.currency || 'USD').toUpperCase(),

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
    createFederationPaidIntroLedger,
    listMyPayments,
    createWithdrawalRequest,
    listMyPayouts
};