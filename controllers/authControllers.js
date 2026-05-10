const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { firestore } = require('../config/firebaseAdmin');
const publicLandingEventsRepo = require('../backend/repositories/publicLandingEventsRepo');
const geocodingService = require('../backend/services/geocodingService');

const USERS_COLLECTION = 'users';
const UNIVERSE_REFERRAL_LEDGER_COLLECTION = 'universeReferralLedger';
const UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT = Number(process.env.UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT || 2.81);
const UNIVERSE_REFERRAL_COMMISSION_CURRENCY = String(process.env.UNIVERSE_REFERRAL_COMMISSION_CURRENCY || 'USD').trim().toUpperCase() || 'USD';
const OTP_FROM_EMAIL = process.env.OTP_FROM_EMAIL || 'YH Universe <noreply@younghustlers.net>';
const OTP_REPLY_TO = process.env.OTP_REPLY_TO || 'support@younghustlers.net';
const OTP_SUPPORT_EMAIL = process.env.OTP_SUPPORT_EMAIL || 'support@younghustlers.net';

const ALLOW_INSECURE_SMTP_TLS =
    String(process.env.ALLOW_INSECURE_SMTP_TLS || '').trim().toLowerCase() === 'true';

const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY
    },
    tls: ALLOW_INSECURE_SMTP_TLS
        ? { rejectUnauthorized: false }
        : undefined
});

async function sendOtpMail({ to, subject, html }) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('Missing RESEND_API_KEY environment variable.');
    }

    return transporter.sendMail({
        from: OTP_FROM_EMAIL,
        replyTo: OTP_REPLY_TO,
        to,
        subject,
        html
    });
}

async function sendSystemMail({ to, subject, html }) {
    return sendOtpMail({ to, subject, html });
}

exports.sendSystemMail = sendSystemMail;

const slugifyUsernameBase = (value = '') => {
    return String(value)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '')
        .replace(/^_+|_+$/g, '') || 'yhuser';
};

const randomSuffix = (length = 4) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
};

const nowIso = () => new Date().toISOString();
const PASSWORD_RESET_OTP_TTL_MINUTES = Number(process.env.PASSWORD_RESET_OTP_TTL_MINUTES || 10);
const PASSWORD_RESET_VERIFIED_TTL_MINUTES = Number(process.env.PASSWORD_RESET_VERIFIED_TTL_MINUTES || 15);

const addMinutesToIso = (minutes = 0) => new Date(Date.now() + (Number(minutes) || 0) * 60 * 1000).toISOString();

const isIsoExpired = (value) => {
    if (!value) return true;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return true;
    return ts <= Date.now();
};

const addMinutesToIsoFromValue = (value, minutes = 0) => {
    const baseTs = new Date(value).getTime();
    if (!Number.isFinite(baseTs)) return '';
    return new Date(baseTs + (Number(minutes) || 0) * 60 * 1000).toISOString();
};

const usersCollection = () => firestore.collection(USERS_COLLECTION);
const universeReferralLedgerCollection = () => firestore.collection(UNIVERSE_REFERRAL_LEDGER_COLLECTION);
const universeReferralCommissionLedgerCollection = () => firestore.collection('universeReferralCommissionLedger');

function normalizeUniverseReferralCode(value = '') {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]+/g, '')
        .slice(0, 48);
}

function buildUniverseReferralCodeBase(fullName = '', username = '') {
    const rawBase = String(username || fullName || 'member')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 12) || 'MEMBER';

    return `YH-${rawBase}`;
}

async function generateUniqueUniverseReferralCode({ fullName = '', username = '' } = {}) {
    const base = buildUniverseReferralCodeBase(fullName, username);

    for (let attempt = 0; attempt < 12; attempt += 1) {
        const suffix = attempt === 0
            ? randomSuffix(4).toUpperCase()
            : randomSuffix(6).toUpperCase();

        const code = normalizeUniverseReferralCode(`${base}-${suffix}`);
        const existing = await usersCollection()
            .where('universeReferral.code', '==', code)
            .limit(1)
            .get();

        if (existing.empty) {
            return code;
        }
    }

    return normalizeUniverseReferralCode(`${base}-${Date.now().toString(36).toUpperCase()}`);
}

async function resolveUniverseReferrerByCode(referralCode = '') {
    const cleanCode = normalizeUniverseReferralCode(referralCode);
    if (!cleanCode) return null;

    const snapshot = await usersCollection()
        .where('universeReferral.code', '==', cleanCode)
        .limit(1)
        .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data() || {};

    return {
        uid: doc.id,
        id: doc.id,
        code: cleanCode,
        email: String(data.email || '').trim().toLowerCase(),
        name: String(
            data.fullName ||
            data.displayName ||
            data.name ||
            data.username ||
            'YH Member'
        ).trim(),
        username: String(data.username || '').trim()
    };
}

async function buildUniverseReferralAttribution({ referralCode = '', referredUid = '', referredEmail = '' } = {}) {
    const cleanCode = normalizeUniverseReferralCode(referralCode);
    const cleanReferredUid = String(referredUid || '').trim();
    const cleanReferredEmail = String(referredEmail || '').trim().toLowerCase();

    if (!cleanCode || !cleanReferredUid) return null;

    const referrer = await resolveUniverseReferrerByCode(cleanCode);
    if (!referrer?.uid) return null;

    if (referrer.uid === cleanReferredUid) return null;
    if (referrer.email && cleanReferredEmail && referrer.email === cleanReferredEmail) return null;

    return {
        source: 'universe',
        code: cleanCode,
        referrerUid: referrer.uid,
        referrerEmail: referrer.email,
        referrerName: referrer.name,
        referrerUsername: referrer.username,
        capturedAt: nowIso()
    };
}

async function createPendingUniverseReferralLedger({
    referredUid = '',
    referredEmail = '',
    referredName = '',
    referredUsername = '',
    referredBy = null
} = {}) {
    if (!referredBy?.referrerUid || !referredUid) return null;

    const ledgerId = `universe_ref_${referredBy.referrerUid}_${referredUid}`;
    const ref = universeReferralLedgerCollection().doc(ledgerId);
    const existing = await ref.get();

    if (existing.exists) {
        return {
            id: existing.id,
            ...(existing.data() || {})
        };
    }

    const payload = {
        referrerUid: referredBy.referrerUid,
        referrerEmail: referredBy.referrerEmail || '',
        referrerName: referredBy.referrerName || '',
        referrerUsername: referredBy.referrerUsername || '',

        referredUid,
        referredEmail: String(referredEmail || '').trim().toLowerCase(),
        referredName: String(referredName || '').trim(),
        referredUsername: String(referredUsername || '').trim(),

        referralCode: referredBy.code || '',
        source: 'universe',
        sourceDivision: 'universe',

        status: 'pending',
        rewardStatus: 'awaiting_payment',
        qualifiedDivision: '',
        commissionRatePercent: UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT,
        totalCommissionAmount: 0,
        commissionCount: 0,
        currency: UNIVERSE_REFERRAL_COMMISSION_CURRENCY,

        capturedAt: nowIso(),
        qualifiedAt: '',
        latestCommissionAt: '',
        latestCommissionId: '',
        latestCommissionPaymentId: '',
        payoutRecordId: '',
        updatedAt: nowIso()
    };

    await ref.set(payload, { merge: true });

    return {
        id: ledgerId,
        ...payload
    };
}

function buildUniverseReferralBaseUrl(req = {}) {
    const envBase = String(
        process.env.PUBLIC_BASE_URL ||
        process.env.APP_BASE_URL ||
        process.env.BASE_URL ||
        ''
    ).trim().replace(/\/+$/, '');

    if (envBase) return envBase;

    const protocol = req.protocol || 'https';
    const host = typeof req.get === 'function' ? req.get('host') : '';

    return host ? `${protocol}://${host}` : '';
}

async function ensureUniverseReferralForUser(userId = '', userData = {}) {
    const cleanUserId = String(userId || '').trim();
    if (!cleanUserId) return null;

    const currentReferral =
        userData.universeReferral && typeof userData.universeReferral === 'object'
            ? userData.universeReferral
            : {};

    const currentCode = normalizeUniverseReferralCode(currentReferral.code);
    if (currentCode) {
        return {
            ...currentReferral,
            code: currentCode,
            status: String(currentReferral.status || 'active').trim() || 'active'
        };
    }

    const code = await generateUniqueUniverseReferralCode({
        fullName: userData.fullName || userData.displayName || userData.name || '',
        username: userData.username || ''
    });

    const nextReferral = {
        code,
        status: 'active',
        createdAt: nowIso(),
        updatedAt: nowIso()
    };

    await usersCollection().doc(cleanUserId).set(
        {
            universeReferral: nextReferral,
            updatedAt: nowIso()
        },
        { merge: true }
    );

    return nextReferral;
}

const DELETED_ACCOUNT_MESSAGE = 'This account has been deleted. Please register again.';

function normalizeAccountStatusText(value = '') {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function isDeletedAccountRecord(user = {}) {
    if (!user || typeof user !== 'object') return false;

    const status = normalizeAccountStatusText(
        user.accountStatus ||
        user.userStatus ||
        user.status ||
        ''
    );

    const deletionStatus = normalizeAccountStatusText(
        user.deletionStatus ||
        user.deleteStatus ||
        ''
    );

    const fullName = normalizeAccountStatusText(
        user.fullName ||
        user.displayName ||
        user.name ||
        ''
    );

    const username = normalizeAccountStatusText(user.username || '');

    const hasDeletedFlag =
        user.deleted === true ||
        user.isDeleted === true ||
        user.accountDeleted === true ||
        user.isAccountDeleted === true ||
        user.disabled === true ||
        user.isDisabled === true ||
        Boolean(user.deletedAt || user.accountDeletedAt || user.disabledAt);

    const hasDeletedStatus = [
        'deleted',
        'disabled',
        'deactivated',
        'removed',
        'archived'
    ].includes(status);

    const hasDeletionStatus = [
        'deleted',
        'soft_deleted',
        'hard_deleted',
        'disabled',
        'deactivated'
    ].includes(deletionStatus);

    const isLegacyDeletedPlaceholder =
        ['deleted', 'deleted_user', 'deleted_account'].includes(fullName) ||
        ['deleted', 'deleteduser', 'deleted_account'].includes(username);

    return hasDeletedFlag || hasDeletedStatus || hasDeletionStatus || isLegacyDeletedPlaceholder;
}

function deletedAccountResponsePayload(message = DELETED_ACCOUNT_MESSAGE) {
    return {
        success: false,
        accountDeleted: true,
        registrationRequired: true,
        message
    };
}

async function purgeDeletedUserRecords(records = []) {
    const deletedRecords = (Array.isArray(records) ? records : [])
        .filter((record) => record?.id && isDeletedAccountRecord(record));

    for (const record of deletedRecords) {
        const ref = usersCollection().doc(record.id);

        if (firestore && typeof firestore.recursiveDelete === 'function') {
            await firestore.recursiveDelete(ref);
        } else {
            await ref.delete();
        }
    }

    return deletedRecords.length;
}

async function findUserByEmail(email = '') {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return null;

    const snap = await usersCollection()
        .where('email', '==', normalizedEmail)
        .limit(10)
        .get();

    if (snap.empty) return null;

    const users = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return users.find((user) => !isDeletedAccountRecord(user)) || null;
}

async function findDeletedUsersByEmail(email = '') {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return [];

    const snap = await usersCollection()
        .where('email', '==', normalizedEmail)
        .limit(10)
        .get();

    if (snap.empty) return [];

    return snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((user) => isDeletedAccountRecord(user));
}

async function findUserByUsername(username = '') {
    const normalizedUsername = String(username || '')
        .trim()
        .replace(/^@+/, '')
        .toLowerCase();

    if (!normalizedUsername) return null;

    const snap = await usersCollection()
        .where('username', '==', normalizedUsername)
        .limit(10)
        .get();

    if (snap.empty) return null;

    const users = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return users.find((user) => !isDeletedAccountRecord(user)) || null;
}

async function findDeletedUsersByUsername(username = '') {
    const normalizedUsername = String(username || '')
        .trim()
        .replace(/^@+/, '')
        .toLowerCase();

    if (!normalizedUsername) return [];

    const snap = await usersCollection()
        .where('username', '==', normalizedUsername)
        .limit(10)
        .get();

    if (snap.empty) return [];

    return snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((user) => isDeletedAccountRecord(user));
}

async function findUserByIdentifier(identifier = '') {
    const normalized = String(identifier || '').trim();
    if (!normalized) return null;

    const normalizedEmail = normalized.toLowerCase();
    const normalizedUsername = normalized.replace(/^@+/, '').toLowerCase();

    const byEmail = await findUserByEmail(normalizedEmail);
    if (byEmail) return byEmail;

    return findUserByUsername(normalizedUsername);
}

async function findDeletedUserByIdentifier(identifier = '') {
    const normalized = String(identifier || '').trim();
    if (!normalized) return null;

    const normalizedEmail = normalized.toLowerCase();
    const normalizedUsername = normalized.replace(/^@+/, '').toLowerCase();

    const deletedByEmail = normalizedEmail.includes('@')
        ? await findDeletedUsersByEmail(normalizedEmail)
        : [];

    if (deletedByEmail.length) return deletedByEmail[0];

    const deletedByUsername = await findDeletedUsersByUsername(normalizedUsername);
    return deletedByUsername[0] || null;
}

async function findUserByEmailAndOtp(email = '', otpCode = '') {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedOtp = String(otpCode || '').trim();

    if (!normalizedEmail || !normalizedOtp) return null;

    const snap = await usersCollection()
        .where('email', '==', normalizedEmail)
        .where('verificationCode', '==', normalizedOtp)
        .limit(10)
        .get();

    if (snap.empty) return null;

    const users = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return users.find((user) => !isDeletedAccountRecord(user)) || null;
}

async function generateUniqueUsername(fullName, preferredUsername = '') {
    const base = slugifyUsernameBase(preferredUsername || fullName);

    let candidate = base;
    let existing = await findUserByUsername(candidate);
    if (!existing) return candidate;

    for (let i = 0; i < 10; i++) {
        candidate = `${base}${randomSuffix(4)}`;
        existing = await findUserByUsername(candidate);
        if (!existing) return candidate;
    }

    return `${base}${Date.now().toString().slice(-6)}`;
}

const AUTH_SESSION_EXPIRES_IN = process.env.AUTH_SESSION_EXPIRES_IN || '3650d';

function isCompactProfileAsset(value = '') {
    const clean = String(value || '').trim();

    if (!clean) return '';
    if (clean.startsWith('data:image/')) return '';
    if (clean.length > 1200) return '';

    return clean;
}

function issueJwt(user) {
    return jwt.sign(
        {
            id: user.id,
            firebaseUid: user.id,
            email: user.email || '',
            name: user.fullName,
            username: user.username,
            displayName: user.fullName || user.displayName || user.name || user.username || '',
            avatar: isCompactProfileAsset(user.avatar || user.profilePhoto || user.photoURL || '')
        },
        process.env.JWT_SECRET,
        { expiresIn: AUTH_SESSION_EXPIRES_IN }
    );
}

function publicUser(user) {
    const fullName = String(
        user.fullName ||
        user.displayName ||
        user.name ||
        ''
    ).trim();

    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = String(
        user.firstName ||
        nameParts[0] ||
        ''
    ).trim();

    const surname = String(
        user.surname ||
        user.lastName ||
        (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '')
    ).trim();

    const city = String(user.city || '').trim();
    const country = String(user.country || '').trim();

    const avatar = String(
        user.avatar ||
        user.profilePhoto ||
        user.photoURL ||
        ''
    ).trim();

    return {
        id: String(user.id || '').trim(),
        uid: String(user.id || '').trim(),
        firebaseUid: String(user.id || '').trim(),
        fullName,
        displayName: fullName,
        firstName,
        surname,
        username: String(user.username || '').trim().replace(/^@+/, '').toLowerCase(),
        email: String(user.email || '').trim().toLowerCase(),
        city,
        country,
        locationCountry: [city, country].filter(Boolean).join(', ') || country,
        countryCode: user.countryCode || '',
        avatar,
        profilePhoto: avatar,
        photoURL: avatar,
        lat: Number.isFinite(Number(user.lat)) ? Number(user.lat) : null,
        lng: Number.isFinite(Number(user.lng)) ? Number(user.lng) : null
    };
}

const AUTH_COOKIE_NAME = 'yh_auth_token';
const AUTH_COOKIE_MAX_AGE_MS = Number(process.env.AUTH_COOKIE_MAX_AGE_MS || (3650 * 24 * 60 * 60 * 1000));

function setAuthCookie(res, token) {
    const isSecure =
        process.env.NODE_ENV === 'production' ||
        String(process.env.PUBLIC_BASE_URL || '').trim().startsWith('https://') ||
        String(process.env.APP_BASE_URL || '').trim().startsWith('https://') ||
        String(process.env.BASE_URL || '').trim().startsWith('https://');

    res.cookie(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: AUTH_COOKIE_MAX_AGE_MS
    });
}

function clearAuthCookie(res) {
    const isSecure =
        process.env.NODE_ENV === 'production' ||
        String(process.env.PUBLIC_BASE_URL || '').trim().startsWith('https://') ||
        String(process.env.APP_BASE_URL || '').trim().startsWith('https://') ||
        String(process.env.BASE_URL || '').trim().startsWith('https://');

    res.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: '/'
    });
}

function renderPremiumOtpEmail({
    badge,
    title,
    intro,
    otpCode,
    note
}) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#030712; font-family:Arial, Helvetica, sans-serif; color:#e5eef8;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:collapse; background-color:#030712; margin:0; padding:0;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:660px; width:100%; border-collapse:collapse;">

          <tr>
            <td style="padding:0 0 14px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:collapse;">
                <tr>
                  <td style="background-color:#06111f; border:1px solid #16324c; border-radius:20px 20px 0 0; padding:14px 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:collapse;">
                      <tr>
                        <td align="left" valign="middle">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                            <tr>
                            <td align="left" valign="middle" style="width:52px;">
                            <img
                                src="https://younghustlersuniverse.com/images/logo.png"
                                alt="YH Universe"
                                width="40"
                                height="40"
                                style="display:block; width:40px; height:40px; border:0; outline:none; text-decoration:none;"
                            />
                            </td>
                            <td style="padding-left:12px;">
                            <div style="font-size:14px; line-height:1.2; color:#ffffff; font-weight:800; letter-spacing:0.5px;">
                                Young Hustlers Universe
                            </div>
                            <div style="font-size:11px; line-height:1.4; color:#8fa4bf; text-transform:uppercase; letter-spacing:1.6px;">
                                Secure Account Access
                            </div>
                            </td>
                            </tr>
                          </table>
                        </td>
                        <td align="right" valign="middle">
                          <div style="display:inline-block; padding:7px 12px; border-radius:999px; border:1px solid #18456b; background-color:#081726; color:#7dd3fc; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;">
                            ${badge}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="background-color:#08111f; border-left:1px solid #16324c; border-right:1px solid #16324c; padding:0;">
                    <div style="height:4px; line-height:4px; font-size:0; background-color:#0ea5e9;">&nbsp;</div>
                  </td>
                </tr>

                <tr>
                  <td style="background-color:#070d18; border:1px solid #16324c; border-top:0; border-radius:0 0 20px 20px; padding:36px 26px 24px 26px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:collapse;">
                      <tr>
                        <td align="center" style="padding-bottom:10px;">
                          <div style="font-size:12px; line-height:1.4; color:#7dd3fc; letter-spacing:2px; text-transform:uppercase; font-weight:700;">
                            Private authentication message
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td align="center" style="padding-bottom:12px;">
                          <h1 style="margin:0; font-size:32px; line-height:1.2; color:#ffffff; font-weight:800;">
                            ${title}
                          </h1>
                        </td>
                      </tr>

                      <tr>
                        <td align="center" style="padding-bottom:24px;">
                          <p style="margin:0; max-width:520px; font-size:15px; line-height:1.8; color:#9fb0c8;">
                            ${intro}
                          </p>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding-bottom:24px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:collapse;">
                            <tr>
                              <td align="center" style="padding:0;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; margin:0 auto;">
                                  <tr>
                                    <td align="center" style="background-color:#030712; border:1px solid #1c567f; border-radius:20px; padding:18px 22px;">
                                      <div style="font-size:11px; line-height:1.4; color:#7dd3fc; letter-spacing:2px; text-transform:uppercase; font-weight:700; padding-bottom:8px;">
                                        Verification code
                                      </div>
                                      <div style="font-size:42px; line-height:1; color:#38bdf8; font-weight:800; letter-spacing:11px;">
                                        ${otpCode}
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding-bottom:18px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:collapse;">
                            <tr>
                              <td style="background-color:#091423; border:1px solid #152b45; border-radius:16px; padding:14px 16px;">
                                <p style="margin:0; font-size:13px; line-height:1.8; color:#b7c5d9; text-align:center;">
                                  This code is private and should never be shared with anyone.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td align="center" style="padding-bottom:24px;">
                          <p style="margin:0; font-size:13px; line-height:1.8; color:#8fa4bf;">
                            ${note}
                          </p>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding-top:20px; border-top:1px solid #15263d;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%; border-collapse:collapse;">
                            <tr>
                              <td align="center" style="padding-bottom:6px;">
                                <div style="font-size:12px; line-height:1.5; color:#7f93ad; text-transform:uppercase; letter-spacing:1.4px;">
                                  Support
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding-bottom:2px;">
                                <a href="mailto:${OTP_SUPPORT_EMAIL}" style="font-size:15px; line-height:1.7; color:#38bdf8; text-decoration:none; font-weight:700;">
                                  ${OTP_SUPPORT_EMAIL}
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <td align="center">
                                <p style="margin:0; font-size:12px; line-height:1.7; color:#72859e;">
                                  If you have questions or need any assistance, contact our support team.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-top:16px;">
                    <p style="margin:0; font-size:12px; line-height:1.8; color:#667892;">
                      © YH Universe. Built for ambitious people, structured for scale.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
}

function verificationMailHtml(otpCode) {
    return renderPremiumOtpEmail({
        badge: 'Email Verification',
        title: 'Verify your email',
        intro: 'Welcome to the YH Universe. Use the code below to verify your email and continue your onboarding.',
        otpCode,
        note: 'This verification code will expire soon.'
    });
}

function resendVerificationMailHtml(otpCode) {
    return renderPremiumOtpEmail({
        badge: 'New Verification Code',
        title: 'Your new code is ready',
        intro: 'You requested another verification code. Use the latest code below to continue accessing your account.',
        otpCode,
        note: 'Only the most recently issued code should be used.'
    });
}

function forgotPasswordMailHtml(otpCode) {
    return renderPremiumOtpEmail({
        badge: 'Password Reset',
        title: 'Reset your password',
        intro: 'We received a password reset request for your YH Universe account. Use the code below to continue.',
        otpCode,
        note: 'If you did not request this reset, you can safely ignore this email.'
    });
}

const COUNTRY_GEO_INDEX = {
    nigeria: { country: 'Nigeria', countryCode: 'NG', lat: 9.0820, lng: 8.6753 },
    philippines: { country: 'Philippines', countryCode: 'PH', lat: 12.8797, lng: 121.7740 },
    india: { country: 'India', countryCode: 'IN', lat: 20.5937, lng: 78.9629 },
    'united states': { country: 'United States', countryCode: 'US', lat: 37.0902, lng: -95.7129 },
    canada: { country: 'Canada', countryCode: 'CA', lat: 56.1304, lng: -106.3468 },
    'united kingdom': { country: 'United Kingdom', countryCode: 'GB', lat: 55.3781, lng: -3.4360 },
    australia: { country: 'Australia', countryCode: 'AU', lat: -25.2744, lng: 133.7751 },
    singapore: { country: 'Singapore', countryCode: 'SG', lat: 1.3521, lng: 103.8198 },
    'south africa': { country: 'South Africa', countryCode: 'ZA', lat: -30.5595, lng: 22.9375 },
    'united arab emirates': { country: 'United Arab Emirates', countryCode: 'AE', lat: 23.4241, lng: 53.8478 },
    germany: { country: 'Germany', countryCode: 'DE', lat: 51.1657, lng: 10.4515 },
    france: { country: 'France', countryCode: 'FR', lat: 46.2276, lng: 2.2137 },
    spain: { country: 'Spain', countryCode: 'ES', lat: 40.4637, lng: -3.7492 },
    italy: { country: 'Italy', countryCode: 'IT', lat: 41.8719, lng: 12.5674 },
    brazil: { country: 'Brazil', countryCode: 'BR', lat: -14.2350, lng: -51.9253 },
    mexico: { country: 'Mexico', countryCode: 'MX', lat: 23.6345, lng: -102.5528 },
    japan: { country: 'Japan', countryCode: 'JP', lat: 36.2048, lng: 138.2529 },
    netherlands: { country: 'Netherlands', countryCode: 'NL', lat: 52.1326, lng: 5.2913 },
    sweden: { country: 'Sweden', countryCode: 'SE', lat: 60.1282, lng: 18.6435 },
    norway: { country: 'Norway', countryCode: 'NO', lat: 60.4720, lng: 8.4689 },
    kenya: { country: 'Kenya', countryCode: 'KE', lat: -0.0236, lng: 37.9062 },
    ghana: { country: 'Ghana', countryCode: 'GH', lat: 7.9465, lng: -1.0232 }
};

const COUNTRY_ALIASES = {
    ng: 'nigeria',
    nigeria: 'nigeria',
    ph: 'philippines',
    philippines: 'philippines',
    'the philippines': 'philippines',
    in: 'india',
    india: 'india',
    us: 'united states',
    usa: 'united states',
    'united states of america': 'united states',
    'united states': 'united states',
    ca: 'canada',
    canada: 'canada',
    gb: 'united kingdom',
    uk: 'united kingdom',
    england: 'united kingdom',
    britain: 'united kingdom',
    'great britain': 'united kingdom',
    'united kingdom': 'united kingdom',
    au: 'australia',
    australia: 'australia',
    sg: 'singapore',
    singapore: 'singapore',
    za: 'south africa',
    'south africa': 'south africa',
    ae: 'united arab emirates',
    uae: 'united arab emirates',
    'united arab emirates': 'united arab emirates',
    de: 'germany',
    germany: 'germany',
    fr: 'france',
    france: 'france',
    es: 'spain',
    spain: 'spain',
    it: 'italy',
    italy: 'italy',
    br: 'brazil',
    brazil: 'brazil',
    mx: 'mexico',
    mexico: 'mexico',
    jp: 'japan',
    japan: 'japan',
    nl: 'netherlands',
    netherlands: 'netherlands',
    se: 'sweden',
    sweden: 'sweden',
    no: 'norway',
    norway: 'norway',
    ke: 'kenya',
    kenya: 'kenya',
    gh: 'ghana',
    ghana: 'ghana'
};

function normalizeGeoText(value = '') {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function deriveRegistrationGeo({ city = '', country = '' } = {}) {
    const cleanCity = normalizeGeoText(city);
    const cleanCountryInput = normalizeGeoText(country);
    const normalizedCountryKey =
        COUNTRY_ALIASES[cleanCountryInput.toLowerCase()] ||
        cleanCountryInput.toLowerCase();

    const geo = COUNTRY_GEO_INDEX[normalizedCountryKey] || null;

    return {
        city: cleanCity,
        cityNormalized: cleanCity.toLowerCase(),
        country: geo?.country || cleanCountryInput,
        countryNormalized: normalizedCountryKey,
        countryCode: geo?.countryCode || '',
        lat: geo ? Number(geo.lat) : null,
        lng: geo ? Number(geo.lng) : null,
        geoSource: geo ? 'registration_country_centroid' : 'registration_manual_pending',
        geoUpdatedAt: nowIso()
    };
}

exports.registerUser = async (req, res) => {
    let userRef = null;

    try {
        let {
            fullName,
            email,
            username,
            contact,
            city,
            country,
            password,
            profilePhotoDataUrl,
            referralCode
        } = req.body;

        fullName = String(fullName || '').trim();
        email = String(email || '').trim().toLowerCase();
        username = String(username || '').trim();
        contact = String(contact || '').trim();
        city = String(city || '').trim();
        country = String(country || '').trim();
        password = String(password || '');
        profilePhotoDataUrl = String(profilePhotoDataUrl || '').trim();
        referralCode = normalizeUniverseReferralCode(referralCode || req.body?.ref || req.body?.universeReferralCode || '');

        if (!fullName || !email || !username || !city || !country || !password || !profilePhotoDataUrl) {
            return res.status(400).json({
                success: false,
                message: 'Full name, email, username, city, country, profile photo, and password are required.'
            });
        }

        const existingEmail = await findUserByEmail(email);
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered.'
            });
        }

        await purgeDeletedUserRecords(await findDeletedUsersByEmail(email));

        username = await generateUniqueUsername(fullName, username);

        const registrationGeo = await geocodingService.resolveLocation({
            city,
            country,
            fallbackToCountryCentroid: true
        });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const createdAt = nowIso();

        userRef = usersCollection().doc();

        const universeReferralCode = await generateUniqueUniverseReferralCode({
            fullName,
            username
        });

        const referredBy = await buildUniverseReferralAttribution({
            referralCode,
            referredUid: userRef.id,
            referredEmail: email
        });

        await userRef.set({
            fullName,
            email,
            username,
            contact,
            city: registrationGeo.city,
            cityNormalized: registrationGeo.cityNormalized,
            country: registrationGeo.country,
            countryNormalized: registrationGeo.countryNormalized,
            countryCode: registrationGeo.countryCode,
            lat: registrationGeo.lat,
            lng: registrationGeo.lng,
            geoSource: registrationGeo.geoSource,
            geoProvider: registrationGeo.geoProvider,
            geoPrecision: registrationGeo.geoPrecision,
            ...(Number.isFinite(Number(registrationGeo.geoConfidence))
                ? { geoConfidence: Number(registrationGeo.geoConfidence) }
                : {}),
            ...(registrationGeo.geoDisplayName
                ? { geoDisplayName: registrationGeo.geoDisplayName }
                : {}),
            geoUpdatedAt: registrationGeo.geoUpdatedAt,
            avatar: profilePhotoDataUrl,
            profilePhoto: profilePhotoDataUrl,
            photoURL: profilePhotoDataUrl,
            password: hashedPassword,
            verificationCode: null,
            verificationCodeIssuedAt: null,
            isVerified: false,
            universeReferral: {
                code: universeReferralCode,
                status: 'active',
                createdAt,
                updatedAt: createdAt
            },
            ...(referredBy
                ? {
                    referredBy,
                    referralCapturedAt: createdAt
                }
                : {}),
            createdAt,
            updatedAt: createdAt
        });

        if (referredBy) {
            await createPendingUniverseReferralLedger({
                referredUid: userRef.id,
                referredEmail: email,
                referredName: fullName,
                referredUsername: username,
                referredBy
            });
        }

        return res.json({
            success: true,
            loginRequired: true,
            message: 'Registration successful. Please log in to verify your account.'
        });
    } catch (error) {
        console.error('Register Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during registration.'
        });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const otpCode = String(req.body?.otpCode || '').trim();

        const user = await findUserByEmailAndOtp(email, otpCode);

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code.'
            });
        }

        await usersCollection().doc(user.id).update({
            isVerified: true,
            verificationCode: null,
            updatedAt: nowIso()
        });

        const updatedUser = {
            ...user,
            isVerified: true,
            verificationCode: null
        };

        try {
            await publicLandingEventsRepo.createEventForUser(updatedUser.id, {
                type: 'academy_signup_verified',
                slot: 'academy',
                category: 'academy',
                message: '{name} just signed up for the Universe from {location}.',
                feedText: '{name} just signed up for the Universe.',
                labelPrefix: 'New Signup',
                color: '#38bdf8',
                altitude: 0.24,
                ttlSeconds: 1200
            });
        } catch (glowError) {
            console.warn('verifyOTP public landing event skipped:', glowError?.message || glowError);
        }

        const token = issueJwt(updatedUser);
        setAuthCookie(res, token);

        return res.json({
            success: true,
            message: 'Email verified successfully!',
            token,
            user: publicUser(updatedUser)
        });
    } catch (error) {
        console.error('Verify OTP Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during verification.'
        });
    }
};

exports.resendOTP = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found.'
            });
        }

        if (user.isVerified === true) {
            return res.status(400).json({
                success: false,
                message: 'Account is already verified.'
            });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        await usersCollection().doc(user.id).update({
            verificationCode: otpCode,
            updatedAt: nowIso()
        });

        await sendOtpMail({
            to: email,
            subject: 'YH Universe - Verification Code',
            html: resendVerificationMailHtml(otpCode)
        });

        return res.json({
            success: true,
            message: 'A new verification code has been sent to your email.'
        });
    } catch (error) {
        console.error('Resend OTP Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during resend.'
        });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const identifier = String(req.body?.identifier || '').trim();
        const password = String(req.body?.password || '');

        const user = await findUserByIdentifier(identifier);

        if (!user) {
            const deletedUser = await findDeletedUserByIdentifier(identifier);

            if (deletedUser) {
                return res.status(410).json(deletedAccountResponsePayload());
            }

            return res.status(400).json({
                success: false,
                message: 'Invalid email/username or password.'
            });
        }

        if (isDeletedAccountRecord(user)) {
            return res.status(410).json(deletedAccountResponsePayload());
        }

        const isMatch = await bcrypt.compare(password, user.password || '');
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email/username or password.'
            });
        }

        if (user.isVerified !== true) {
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

            await usersCollection().doc(user.id).update({
                verificationCode: otpCode,
                verificationCodeIssuedAt: nowIso(),
                updatedAt: nowIso()
            });

            await sendOtpMail({
                to: user.email,
                subject: 'YH Universe - Verification Code',
                html: verificationMailHtml(otpCode)
            });

            return res.status(403).json({
                success: false,
                verificationRequired: true,
                otpSent: true,
                email: user.email || '',
                message: 'Verification code sent to your email. Enter the OTP to continue.'
            });
        }

        const token = issueJwt(user);
        setAuthCookie(res, token);

        return res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: publicUser(user)
        });
    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during login.'
        });
    }
};
exports.logoutUser = async (req, res) => {
    clearAuthCookie(res);

    return res.json({
        success: true,
        message: 'Logged out successfully.'
    });
};
exports.getMyUniverseReferrals = async (req, res) => {
    try {
        const userId = String(req.user?.id || req.user?.firebaseUid || req.user?.uid || '').trim();

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const userSnap = await usersCollection().doc(userId).get();

        if (!userSnap.exists) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        const userData = userSnap.data() || {};
        const universeReferral = await ensureUniverseReferralForUser(userId, userData);
        const referralCode = normalizeUniverseReferralCode(universeReferral?.code);

        const [ledgerSnapshot, commissionSnapshot] = await Promise.all([
            universeReferralLedgerCollection()
                .where('referrerUid', '==', userId)
                .limit(200)
                .get(),
            universeReferralCommissionLedgerCollection()
                .where('referrerUid', '==', userId)
                .limit(400)
                .get()
                .catch(() => ({ docs: [] }))
        ]);

        const commissionRecords = commissionSnapshot.docs
            .map((doc) => {
                const data = doc.data() || {};

                return {
                    id: doc.id,
                    referredUid: String(data.referredUid || '').trim(),
                    sourcePaymentId: String(data.sourcePaymentId || '').trim(),
                    sourceDivision: String(data.sourceDivision || '').trim().toLowerCase(),
                    sourceFeature: String(data.sourceFeature || '').trim().toLowerCase(),
                    paymentAmount: Number(data.paymentAmount || data.grossAmount || 0) || 0,
                    commissionAmount: Number(data.commissionAmount || data.amount || 0) || 0,
                    commissionRatePercent: Number(data.commissionRatePercent || UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT) || UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT,
                    currency: String(data.currency || UNIVERSE_REFERRAL_COMMISSION_CURRENCY).trim().toUpperCase(),
                    status: String(data.status || 'available').trim().toLowerCase(),
                    earnedAt: String(data.earnedAt || data.createdAt || '').trim()
                };
            })
            .sort((a, b) => String(b.earnedAt || '').localeCompare(String(a.earnedAt || '')));

        const commissionByReferredUid = commissionRecords.reduce((map, item) => {
            if (!item.referredUid) return map;

            if (!map[item.referredUid]) {
                map[item.referredUid] = {
                    count: 0,
                    amount: 0,
                    latestAt: '',
                    latestPaymentId: '',
                    latestSourceDivision: '',
                    latestSourceFeature: ''
                };
            }

            map[item.referredUid].count += 1;
            map[item.referredUid].amount += Number(item.commissionAmount || 0) || 0;

            if (String(item.earnedAt || '') > String(map[item.referredUid].latestAt || '')) {
                map[item.referredUid].latestAt = item.earnedAt || '';
                map[item.referredUid].latestPaymentId = item.sourcePaymentId || '';
                map[item.referredUid].latestSourceDivision = item.sourceDivision || '';
                map[item.referredUid].latestSourceFeature = item.sourceFeature || '';
            }

            return map;
        }, {});

        const referrals = ledgerSnapshot.docs
            .map((doc) => {
                const data = doc.data() || {};
                const referredUid = String(data.referredUid || '').trim();
                const commissionSummary = commissionByReferredUid[referredUid] || {};
                const commissionCount = Number(commissionSummary.count || data.commissionCount || 0) || 0;
                const commissionAmount = Number(commissionSummary.amount || data.totalCommissionAmount || 0) || 0;
                const latestCommissionAt = String(commissionSummary.latestAt || data.latestCommissionAt || '').trim();

                return {
                    id: doc.id,
                    referredUid,
                    referredEmail: String(data.referredEmail || '').trim().toLowerCase(),
                    referredName: String(data.referredName || '').trim(),
                    referredUsername: String(data.referredUsername || '').trim(),
                    referralCode: normalizeUniverseReferralCode(data.referralCode),
                    status: commissionCount > 0
                        ? 'commission_earned'
                        : String(data.status || 'pending').trim().toLowerCase(),
                    rewardStatus: commissionCount > 0
                        ? 'commission_created'
                        : String(data.rewardStatus || 'awaiting_payment').trim().toLowerCase(),
                    qualifiedDivision: String(commissionSummary.latestSourceDivision || data.qualifiedDivision || '').trim().toLowerCase(),
                    sourceFeature: String(commissionSummary.latestSourceFeature || '').trim().toLowerCase(),
                    commissionRatePercent: Number(data.commissionRatePercent || UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT) || UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT,
                    commissionCount,
                    commissionAmount,
                    rewardAmount: commissionAmount,
                    currency: String(data.currency || UNIVERSE_REFERRAL_COMMISSION_CURRENCY).trim().toUpperCase(),
                    capturedAt: String(data.capturedAt || '').trim(),
                    qualifiedAt: String(data.qualifiedAt || latestCommissionAt || '').trim(),
                    latestCommissionAt,
                    rewardCreatedAt: latestCommissionAt,
                    latestCommissionPaymentId: String(commissionSummary.latestPaymentId || data.latestCommissionPaymentId || '').trim(),
                    payoutRecordId: String(data.payoutRecordId || '').trim()
                };
            })
            .sort((a, b) => String((b.latestCommissionAt || b.capturedAt) || '').localeCompare(String((a.latestCommissionAt || a.capturedAt) || '')));

        const total = referrals.length;
        const payingReferrals = referrals.filter((item) => Number(item.commissionCount || 0) > 0).length;
        const commissionedPayments = commissionRecords.length;
        const pending = Math.max(0, total - payingReferrals);
        const totalEarned = commissionRecords.reduce((sum, item) => sum + (Number(item.commissionAmount) || 0), 0);

        const baseUrl = buildUniverseReferralBaseUrl(req);
        const referralLink = baseUrl && referralCode
            ? `${baseUrl}/?ref=${encodeURIComponent(referralCode)}`
            : `/?ref=${encodeURIComponent(referralCode)}`;

        return res.json({
            success: true,
            referral: {
                code: referralCode,
                link: referralLink,
                status: String(universeReferral?.status || 'active').trim() || 'active',
                commissionRatePercent: UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT,
                currency: UNIVERSE_REFERRAL_COMMISSION_CURRENCY
            },
            stats: {
                total,
                pending,
                qualified: payingReferrals,
                payingReferrals,
                commissionedPayments,
                rewardCreated: commissionedPayments,
                totalEarned,
                currency: UNIVERSE_REFERRAL_COMMISSION_CURRENCY,
                commissionRatePercent: UNIVERSE_REFERRAL_COMMISSION_RATE_PERCENT
            },
            referrals: referrals.slice(0, 25),
            commissions: commissionRecords.slice(0, 25)
        });
    } catch (error) {
        console.error('getMyUniverseReferrals error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Universe referrals.'
        });
    }
};
exports.forgotPassword = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();

        const user = await findUserByEmail(email);
        if (!user) {
            const deletedUsers = await findDeletedUsersByEmail(email);

            if (deletedUsers.length) {
                return res.status(410).json(deletedAccountResponsePayload());
            }

            return res.status(400).json({
                success: false,
                message: 'Email not found in our system.'
            });
        }

        if (isDeletedAccountRecord(user)) {
            return res.status(410).json(deletedAccountResponsePayload());
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const passwordResetExpiresAt = addMinutesToIso(PASSWORD_RESET_OTP_TTL_MINUTES);

        await usersCollection().doc(user.id).update({
            passwordResetCode: otpCode,
            passwordResetExpiresAt,
            passwordResetVerifiedAt: null,
            updatedAt: nowIso()
        });

        await sendOtpMail({
            to: email,
            subject: 'YH Universe - Password Reset Code',
            html: forgotPasswordMailHtml(otpCode)
        });

        return res.json({
            success: true,
            message: 'Password reset code sent to your email.'
        });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};
exports.verifyForgotOTP = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const otpCode = String(req.body?.otpCode || '').trim();

        const user = await findUserByEmail(email);
        if (!user) {
            const deletedUsers = await findDeletedUsersByEmail(email);

            if (deletedUsers.length) {
                return res.status(410).json(deletedAccountResponsePayload());
            }

            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code.'
            });
        }

        if (isDeletedAccountRecord(user)) {
            return res.status(410).json(deletedAccountResponsePayload());
        }

        const storedCode = String(user.passwordResetCode || '').trim();
        const expiresAt = String(user.passwordResetExpiresAt || '').trim();

        if (!storedCode || !otpCode || storedCode !== otpCode || isIsoExpired(expiresAt)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code.'
            });
        }

        await usersCollection().doc(user.id).update({
            passwordResetVerifiedAt: nowIso(),
            updatedAt: nowIso()
        });

        return res.json({
            success: true,
            message: 'Code verified! You can now create a new password.'
        });
    } catch (error) {
        console.error('Verify Forgot OTP Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const newPassword = String(req.body?.newPassword || '');

        const user = await findUserByEmail(email);
        if (!user) {
            const deletedUsers = await findDeletedUsersByEmail(email);

            if (deletedUsers.length) {
                return res.status(410).json(deletedAccountResponsePayload());
            }

            return res.status(400).json({
                success: false,
                message: 'Email not found in our system.'
            });
        }

        if (isDeletedAccountRecord(user)) {
            return res.status(410).json(deletedAccountResponsePayload());
        }

        const verifiedAt = String(user.passwordResetVerifiedAt || '').trim();
        if (!verifiedAt || isIsoExpired(addMinutesToIsoFromValue(verifiedAt, PASSWORD_RESET_VERIFIED_TTL_MINUTES))) {
            return res.status(403).json({
                success: false,
                message: 'Password reset session is invalid or expired. Please verify your reset code again.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await usersCollection().doc(user.id).update({
            password: hashedPassword,
            passwordResetCode: null,
            passwordResetExpiresAt: null,
            passwordResetVerifiedAt: null,
            updatedAt: nowIso()
        });

        return res.json({
            success: true,
            message: 'Password successfully reset!'
        });
    } catch (error) {
        console.error('Reset Password Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error.'
        });
    }
};