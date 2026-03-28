const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { firestore } = require('../config/firebaseAdmin');

const USERS_COLLECTION = 'users';
const OTP_FROM_EMAIL = process.env.OTP_FROM_EMAIL || 'YH Universe <noreply@younghustlers.net>';
const OTP_REPLY_TO = process.env.OTP_REPLY_TO || 'info@younghustlers.net';

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
        username: user.username || ''
    };
}

function verificationMailHtml(otpCode) {
    return `
        <div style="font-family: sans-serif; text-align: center; color: #333;">
            <h2>Welcome to the YH Universe</h2>
            <p>Your verification code is:</p>
            <h1 style="color: #0ea5e9; letter-spacing: 5px;">${otpCode}</h1>
            <p style="font-size: 0.8rem; color: #777;">This code will expire soon.</p>
        </div>
    `;
}

function resendVerificationMailHtml(otpCode) {
    return `
        <div style="font-family: sans-serif; text-align: center; color: #333;">
            <h2>Welcome to the YH Universe</h2>
            <p>You requested a new verification code. Your code is:</p>
            <h1 style="color: #0ea5e9; letter-spacing: 5px;">${otpCode}</h1>
            <p style="font-size: 0.8rem; color: #777;">This code will expire soon.</p>
        </div>
    `;
}

function forgotPasswordMailHtml(otpCode) {
    return `
        <div style="font-family: sans-serif; text-align: center; color: #333;">
            <h2>YH Universe Password Reset</h2>
            <p>You requested to reset your password. Use the code below:</p>
            <h1 style="color: #0ea5e9; letter-spacing: 5px;">${otpCode}</h1>
            <p style="font-size: 0.8rem; color: #777;">If you did not request this, please ignore this email.</p>
        </div>
    `;
}

exports.registerUser = async (req, res) => {
    let userRef = null;

    try {
        let { fullName, email, username, contact, password, profilePhotoDataUrl } = req.body;

        fullName = String(fullName || '').trim();
        email = String(email || '').trim().toLowerCase();
        username = String(username || '').trim();
        contact = String(contact || '').trim();
        password = String(password || '');
        profilePhotoDataUrl = String(profilePhotoDataUrl || '').trim();

        if (!fullName || !email || !username || !password || !profilePhotoDataUrl) {
            return res.status(400).json({
                success: false,
                message: 'Full name, email, username, profile photo, and password are required.'
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

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        userRef = usersCollection().doc();

        await userRef.set({
            fullName,
            email,
            username,
            contact,
            avatar: profilePhotoDataUrl,
            profilePhoto: profilePhotoDataUrl,
            photoURL: profilePhotoDataUrl,
            password: hashedPassword,
            verificationCode: otpCode,
            isVerified: false,
            createdAt: nowIso(),
            updatedAt: nowIso()
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

        const token = issueJwt(updatedUser);

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

        await usersCollection().doc(user.id).update({
            verificationCode: otpCode,
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

        const user = await findUserByEmailAndOtp(email, otpCode);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code.'
            });
        }

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

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await usersCollection().doc(user.id).update({
            password: hashedPassword,
            verificationCode: null,
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