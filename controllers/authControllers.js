const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

exports.registerUser = async (req, res) => {
    try {
        const { fullName, email, username, contact, password } = req.body; 
        const db = req.app.locals.db;

        // Tiningnan kung may kaparehong email o username na sa database
        const existingUser = await db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ success: false, message: "Email is already registered." });
            }
            if (existingUser.username === username) {
                return res.status(400).json({ success: false, message: "Username is already taken." });
            }
        }

        // I-encrypt ang password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Gumawa ng OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // I-save ang bagong YH Universe Citizen sa Database
        await db.run(
            'INSERT INTO users (fullName, email, username, contact, password, verificationCode) VALUES (?, ?, ?, ?, ?, ?)',
            [fullName, email, username, contact, hashedPassword, otpCode]
        );

        // I-send ang OTP sa Email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'YH Universe - Verification Code',
            html: `
                <div style="font-family: sans-serif; text-align: center; color: #333;">
                    <h2>Welcome to the YH Universe</h2>
                    <p>Your verification code is:</p>
                    <h1 style="color: #0ea5e9; letter-spacing: 5px;">${otpCode}</h1>
                    <p style="font-size: 0.8rem; color: #777;">This code will expire soon.</p>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "Registration successful! Check your email for the verification code." });

    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const { email, otpCode } = req.body;
        const db = req.app.locals.db;

        const user = await db.get('SELECT * FROM users WHERE email = ? AND verificationCode = ?', [email, otpCode]);

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid verification code." });
        }

        await db.run('UPDATE users SET isVerified = 1, verificationCode = NULL WHERE email = ?', [email]);

        const token = jwt.sign(
            { id: user.id, name: user.fullName, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } 
        );

        res.json({ success: true, message: "Email verified successfully!", token, user: { fullName: user.fullName, username: user.username } });

    } catch (error) {
        console.error("Verify OTP Error:", error);
        res.status(500).json({ success: false, message: "Server error during verification." });
    }
};

exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const db = req.app.locals.db;

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(400).json({ success: false, message: "User not found." });
        }
        if (user.isVerified === 1) {
            return res.status(400).json({ success: false, message: "Account is already verified." });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await db.run('UPDATE users SET verificationCode = ? WHERE email = ?', [otpCode, email]);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'The Academy - New Verification Code',
            html: `
                <div style="font-family: sans-serif; text-align: center; color: #333;">
                    <h2>Welcome to The Academy</h2>
                    <p>You requested a new verification code. Your code is:</p>
                    <h1 style="color: #0ea5e9; letter-spacing: 5px;">${otpCode}</h1>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "A new verification code has been sent to your email." });

    } catch (error) {
        console.error("Resend OTP Error:", error);
        res.status(500).json({ success: false, message: "Server error during resend." });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { identifier, password } = req.body; 
        const db = req.app.locals.db;

        const user = await db.get('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier]);

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid email/username or password." });
        }

        if (user.isVerified === 0) {
            return res.status(403).json({ success: false, message: "Account not verified. Please complete the application first." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid email/username or password." });
        }

        const token = jwt.sign(
            { id: user.id, name: user.fullName, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } 
        );

        res.json({ success: true, message: "Login successful!", token, user: { fullName: user.fullName, username: user.username } });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Server error during login." });
    }
};

// ==========================================
// 🔄 FORGOT PASSWORD LOGIC
// ==========================================

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const db = req.app.locals.db;

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(400).json({ success: false, message: "Email not found in our system." });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await db.run('UPDATE users SET verificationCode = ? WHERE email = ?', [otpCode, email]);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'The Academy - Password Reset Code',
            html: `
                <div style="font-family: sans-serif; text-align: center; color: #333;">
                    <h2>Password Reset Request</h2>
                    <p>You requested to reset your password. Use the code below:</p>
                    <h1 style="color: #0ea5e9; letter-spacing: 5px;">${otpCode}</h1>
                    <p style="font-size: 0.8rem; color: #777;">If you did not request this, please ignore this email.</p>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "Password reset code sent to your email." });

    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

exports.verifyForgotOTP = async (req, res) => {
    try {
        const { email, otpCode } = req.body;
        const db = req.app.locals.db;

        const user = await db.get('SELECT * FROM users WHERE email = ? AND verificationCode = ?', [email, otpCode]);
        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or expired reset code." });
        }

        res.json({ success: true, message: "Code verified! You can now create a new password." });
    } catch (error) {
        console.error("Verify Forgot OTP Error:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const db = req.app.locals.db;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await db.run('UPDATE users SET password = ?, verificationCode = NULL WHERE email = ?', [hashedPassword, email]);

        res.json({ success: true, message: "Password successfully reset!" });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};