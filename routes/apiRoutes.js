const express = require('express');
const router = express.Router();
const academyControllers = require('../academyControllers');
const auth = require('../middlewares/auth');
// --- CONTROLLERS ---
const applyController = require('../controllers/applyControllers');
const authController = require('../controllers/authControllers');

// ==========================================
// 🧠 1. AI SCREENING ROUTE
// ==========================================
router.post('/apply', applyController.processApplication);

// ==========================================
// 🔐 2. AUTHENTICATION & OTP ROUTES
// ==========================================
router.post('/register', authController.registerUser);
router.post('/verify-otp', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);

// ==========================================
// 🚪 3. LOGIN ROUTE
// ==========================================
router.post('/login', authController.loginUser);

// ==========================================
// 🔄 4. FORGOT PASSWORD ROUTES
// ==========================================
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-forgot-otp', authController.verifyForgotOTP);
router.post('/reset-password', authController.resetPassword);


router.post('/academy/intake', auth, academyControllers.intakeProfile);
router.get('/academy/home', auth, academyControllers.getAcademyHome);
router.get('/academy/roadmap/active', auth, academyControllers.getActiveRoadmap);
router.get('/academy/missions', auth, academyControllers.getMissions);
router.post('/academy/missions/:id/complete', auth, academyControllers.completeMission);
router.post('/academy/missions/:id/status', auth, academyControllers.updateMissionStatus);
router.post('/academy/checkin', auth, academyControllers.submitCheckin);
router.post('/academy/roadmap/refresh', auth, academyControllers.refreshRoadmap);

// 🔥 Laging nasa pinakababa ito dapat para ma-export nang buo!
module.exports = router;