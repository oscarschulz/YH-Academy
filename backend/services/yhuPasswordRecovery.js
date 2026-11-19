'use strict';
// YHU_AUTH_RECOVERY_V1: one-time proof, shared web/native recovery.
const crypto = require('node:crypto');

module.exports = function createYhuPasswordRecovery(deps) {
    const {
        firestore, usersCollection, findUserByEmail, findDeletedUsersByEmail,
        isDeletedAccountRecord, deletedAccountResponsePayload, sendOtpMail,
        forgotPasswordMailHtml, forgotPasswordMailText, bcrypt,
        writeYhuPasswordAfterRevocation, clearAuthCookie, sendYhuPasswordSecurityError
    } = deps;
    const cookieName = 'yh_reset_proof_v1';
    const clock = deps.clock || Date.now;
    const minutes = (value, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? Math.min(number, 60) : fallback;
    };
    const codeTTL = minutes(deps.codeTTL, 10) * 60000;
    const proofTTL = minutes(deps.proofTTL, 15) * 60000;
    const digest = value => crypto.createHash('sha256').update(value).digest('hex');
    const same = (a, b) => {
        const x = Buffer.from(String(a || ''));
        const y = Buffer.from(String(b || ''));
        return x.length === y.length && crypto.timingSafeEqual(x, y);
    };
    const live = value => Number.isFinite(Date.parse(value)) && Date.parse(value) > clock();
    const iso = () => new Date(clock()).toISOString();
    const cookieOptions = () => ({
        httpOnly: true, sameSite: 'strict', path: '/api',
        secure: process.env.NODE_ENV === 'production' ||
            ['PUBLIC_BASE_URL', 'APP_BASE_URL', 'BASE_URL'].some(
                key => String(process.env[key] || '').trim().startsWith('https://'))
    });
    const clearProof = res => res.clearCookie(cookieName, cookieOptions());
    const readProof = req => {
        if (typeof req.body?.resetToken === 'string') return req.body.resetToken;
        const part = String(req.headers?.cookie || '').split(';')
            .map(item => item.trim()).find(item => item.startsWith(cookieName + '='));
        if (!part) return '';
        try { return decodeURIComponent(part.slice(cookieName.length + 1)); }
        catch (_) { return ''; }
    };
    const fail = (res, status, code, message) => res.status(status).json({ success: false, code, message });
    const proofFailure = res => {
        clearProof(res);
        return fail(res, 403, 'reset_proof_invalid',
            'Password reset session is invalid or expired. Please request and verify a new code.');
    };
    const freshUser = (snap, id) => ({ ...(snap.data() || {}), id });
    const find = async (email, res) => {
        const user = await findUserByEmail(email);
        if (user && !isDeletedAccountRecord(user)) return user;
        if (user || (await findDeletedUsersByEmail(email)).length) {
            res.status(410).json(deletedAccountResponsePayload());
        } else {
            fail(res, 400, 'reset_account_unavailable', 'Email not found in our system.');
        }
        return null;
    };
    const handle = fn => async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        try { return await fn(req, res); }
        catch (error) {
            const response = sendYhuPasswordSecurityError(res, error);
            if (response) return response;
            return fail(res, 503, 'reset_service_unavailable',
                'Password recovery is temporarily unavailable. Please try again.');
        }
    };

    return {
        forgotPassword: handle(async (req, res) => {
            const email = String(req.body?.email || '').trim().toLowerCase();
            const user = await find(email, res);
            if (!user) return;
            const otpCode = crypto.randomInt(100000, 1000000).toString();
            const ref = usersCollection().doc(user.id);
            const accepted = await firestore.runTransaction(async tx => {
                const snap = await tx.get(ref);
                if (!snap.exists || isDeletedAccountRecord(freshUser(snap, user.id))) return false;
                tx.update(ref, {
                    passwordResetCode: otpCode,
                    passwordResetExpiresAt: new Date(clock() + codeTTL).toISOString(),
                    passwordResetVerifiedAt: null, passwordResetAttempts: 0,
                    passwordResetTokenHash: null, passwordResetTokenExpiresAt: null,
                    passwordResetClaim: null, updatedAt: iso()
                });
                return true;
            });
            if (!accepted) return res.status(410).json(deletedAccountResponsePayload());
            clearProof(res);
            await sendOtpMail({
                to: email, subject: 'Your YH Universe password reset code',
                html: forgotPasswordMailHtml(otpCode), text: forgotPasswordMailText(otpCode)
            });
            return res.json({ success: true, message: 'Password reset code sent to your email.' });
        }),

        verifyForgotOTP: handle(async (req, res) => {
            const email = String(req.body?.email || '').trim().toLowerCase();
            const otpCode = String(req.body?.otpCode || '').trim();
            if (!/^[0-9]{6}$/.test(otpCode)) {
                return fail(res, 400, 'reset_code_invalid', 'Invalid or expired reset code.');
            }
            const user = await find(email, res);
            if (!user) return;
            const token = crypto.randomBytes(32).toString('hex');
            const ref = usersCollection().doc(user.id);
            const verified = await firestore.runTransaction(async tx => {
                const snap = await tx.get(ref);
                if (!snap.exists) return 'invalid';
                const current = freshUser(snap, user.id);
                if (isDeletedAccountRecord(current)) return 'invalid';
                const attempts = Math.max(0, Number(current.passwordResetAttempts) || 0);
                if (attempts >= 5) return 'limited';
                if (!live(current.passwordResetExpiresAt) || !current.passwordResetCode) return 'invalid';
                if (!same(current.passwordResetCode, otpCode)) {
                    tx.update(ref, {
                        passwordResetAttempts: attempts + 1,
                        ...(attempts + 1 >= 5 ? { passwordResetCode: null } : {}),
                        updatedAt: iso()
                    });
                    return attempts + 1 >= 5 ? 'limited' : 'invalid';
                }
                tx.update(ref, {
                    passwordResetCode: null, passwordResetExpiresAt: null,
                    passwordResetVerifiedAt: iso(), passwordResetAttempts: 0,
                    passwordResetTokenHash: digest(token),
                    passwordResetTokenExpiresAt: new Date(clock() + proofTTL).toISOString(),
                    passwordResetClaim: null, updatedAt: iso()
                });
                return 'verified';
            });
            if (verified !== 'verified') {
                return fail(res, verified === 'limited' ? 429 : 400,
                    verified === 'limited' ? 'reset_code_attempts_exceeded' : 'reset_code_invalid',
                    verified === 'limited' ? 'Too many attempts. Request a new recovery code.' : 'Invalid or expired reset code.');
            }
            // The existing Vite client already includes same-origin cookies.
            // Native clients keep this proof in memory and send resetToken.
            res.cookie(cookieName, token, { ...cookieOptions(), maxAge: proofTTL });
            return res.json({ success: true, resetToken: token,
                message: 'Code verified! You can now create a new password.' });
        }),

        resetPassword: handle(async (req, res) => {
            const email = String(req.body?.email || '').trim().toLowerCase();
            const newPassword = String(req.body?.newPassword || '');
            if (newPassword.length < 8 || newPassword.length > 128) {
                return fail(res, 400, 'reset_password_invalid', 'New password must be between 8 and 128 characters.');
            }
            const token = readProof(req);
            if (!/^[a-f0-9]{64}$/.test(token)) return proofFailure(res);
            const user = await find(email, res);
            if (!user) return;
            const tokenHash = digest(token);
            // Cheap rejection before password hashing; transaction checks again.
            if (!same(user.passwordResetTokenHash, tokenHash) || !live(user.passwordResetTokenExpiresAt)) {
                return proofFailure(res);
            }
            const hashedPassword = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
            const resetClaim = crypto.randomBytes(24).toString('hex');
            const ref = usersCollection().doc(user.id);
            const claimedUser = await firestore.runTransaction(async tx => {
                const snap = await tx.get(ref);
                if (!snap.exists) return null;
                const current = freshUser(snap, user.id);
                if (isDeletedAccountRecord(current) ||
                    !same(current.passwordResetTokenHash, tokenHash) ||
                    !live(current.passwordResetTokenExpiresAt)) return null;
                tx.update(ref, { passwordResetTokenHash: null,
                    passwordResetTokenExpiresAt: null, passwordResetClaim: resetClaim,
                    updatedAt: iso() });
                return current;
            });
            if (!claimedUser) return proofFailure(res);
            await writeYhuPasswordAfterRevocation({
                user: claimedUser, userRef: ref, hashedPassword,
                source: 'auth_reset_password', allowRecovery: true, resetClaim
            });
            clearProof(res);
            clearAuthCookie(res);
            return res.json({ success: true, message: 'Password successfully reset!' });
        })
    };
};
