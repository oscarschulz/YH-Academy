const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { firestore } = require('../config/firebaseAdmin');
const publicLandingEventsRepo = require('../backend/repositories/publicLandingEventsRepo');

const USERS_COLLECTION = 'users';
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

async function findUserByEmail(email = '') {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return null;

    const snap = await usersCollection()
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
}

async function findUserByUsername(username = '') {
    const normalizedUsername = String(username || '').trim();
    if (!normalizedUsername) return null;

    const snap = await usersCollection()
        .where('username', '==', normalizedUsername)
        .limit(1)
        .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
}

async function findUserByIdentifier(identifier = '') {
    const normalized = String(identifier || '').trim();
    if (!normalized) return null;

    const byEmail = await findUserByEmail(normalized.toLowerCase());
    if (byEmail) return byEmail;

    return findUserByUsername(normalized);
}

async function findUserByEmailAndOtp(email = '', otpCode = '') {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedOtp = String(otpCode || '').trim();

    if (!normalizedEmail || !normalizedOtp) return null;

    const snap = await usersCollection()
        .where('email', '==', normalizedEmail)
        .where('verificationCode', '==', normalizedOtp)
        .limit(1)
        .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
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

function issueJwt(user) {
    return jwt.sign(
        {
            id: user.id,
            firebaseUid: user.id,
            email: user.email || '',
            name: user.fullName,
            username: user.username
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function publicUser(user) {
    return {
        fullName: user.fullName || '',
        username: user.username || '',
        email: user.email || '',
        city: user.city || '',
        country: user.country || '',
        countryCode: user.countryCode || '',
        lat: Number.isFinite(Number(user.lat)) ? Number(user.lat) : null,
        lng: Number.isFinite(Number(user.lng)) ? Number(user.lng) : null
    };
}

const AUTH_COOKIE_NAME = 'yh_auth_token';
const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res, token) {
    const isSecure = process.env.NODE_ENV === 'production';

    const parts = [
        `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
        'HttpOnly',
        'Path=/',
        'SameSite=Strict',
        `Max-Age=${Math.floor(AUTH_COOKIE_MAX_AGE_MS / 1000)}`
    ];

    if (isSecure) parts.push('Secure');

    res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
    const isSecure = process.env.NODE_ENV === 'production';

    const parts = [
        `${AUTH_COOKIE_NAME}=`,
        'HttpOnly',
        'Path=/',
        'SameSite=Strict',
        'Max-Age=0'
    ];

    if (isSecure) parts.push('Secure');

    res.setHeader('Set-Cookie', parts.join('; '));
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
            profilePhotoDataUrl
        } = req.body;

        fullName = String(fullName || '').trim();
        email = String(email || '').trim().toLowerCase();
        username = String(username || '').trim();
        contact = String(contact || '').trim();
        city = String(city || '').trim();
        country = String(country || '').trim();
        password = String(password || '');
        profilePhotoDataUrl = String(profilePhotoDataUrl || '').trim();

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

        username = await generateUniqueUsername(fullName, username);

        const registrationGeo = deriveRegistrationGeo({ city, country });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const createdAt = nowIso();

        userRef = usersCollection().doc();

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
            geoUpdatedAt: registrationGeo.geoUpdatedAt,
            avatar: profilePhotoDataUrl,
            profilePhoto: profilePhotoDataUrl,
            photoURL: profilePhotoDataUrl,
            password: hashedPassword,
            verificationCode: otpCode,
            isVerified: false,
            createdAt,
            updatedAt: createdAt
        });

        try {
            await sendOtpMail({
                to: email,
                subject: 'YH Universe - Verification Code',
                html: verificationMailHtml(otpCode)
            });
        } catch (mailError) {
            await userRef.delete().catch(() => null);
            throw mailError;
        }

        return res.json({
            success: true,
            message: 'Registration successful! Check your email for the verification code.'
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
                messagePrefix: 'A new Academy member signed up',
                labelPrefix: 'Academy',
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
            return res.status(400).json({
                success: false,
                message: 'Invalid email/username or password.'
            });
        }

        if (user.isVerified !== true) {
            return res.status(403).json({
                success: false,
                verificationRequired: true,
                email: user.email || '',
                message: 'Account not verified. Please check your email and enter your OTP code first.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password || '');
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email/username or password.'
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
exports.forgotPassword = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();

        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Email not found in our system.'
            });
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
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code.'
            });
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
            return res.status(400).json({
                success: false,
                message: 'Email not found in our system.'
            });
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