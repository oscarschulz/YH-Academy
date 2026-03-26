// public/js/apply.js

function showStep(stepNumber) {
    document.querySelectorAll('.step-container').forEach(el => { el.classList.add('hidden-step'); });
    const targetStep = document.getElementById(`step-${stepNumber}`);
    if(targetStep) {
        targetStep.classList.remove('hidden-step');
        targetStep.classList.remove('fade-in');
        void targetStep.offsetWidth;
        targetStep.classList.add('fade-in');
    }
}

function showToast(message, type = "success") {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    toastMsg.innerText = message;
    if (type === "error") {
        toast.classList.add('error-toast');
        toastIcon.innerText = "⚠️";
    } else {
        toast.classList.remove('error-toast');
        toastIcon.innerText = "🎉";
    }
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
if (localStorage.getItem('yh_user_loggedIn') === 'true') {
    window.location.href = '/dashboard';
}

const landingVideo = document.getElementById('landing-video');
    if (landingVideo) {
        landingVideo.addEventListener('timeupdate', () => {
            if (landingVideo.duration && landingVideo.currentTime >= landingVideo.duration - 3) {
                landingVideo.pause(); 
            }
        });
    }

    // --- CARD FLIP LOGIC ---
    const flipper = document.getElementById('auth-flipper');
    const btnFlipRegister = document.getElementById('btn-flip-register');
    const btnFlipLogin = document.getElementById('btn-flip-login');
    const triggerArea = document.querySelector('.flip-trigger-area');

    const flipToRegister = () => flipper.classList.add('is-flipped');
    const flipToLogin = () => flipper.classList.remove('is-flipped');

    if (btnFlipRegister) btnFlipRegister.addEventListener('click', flipToRegister);
    if (btnFlipLogin) btnFlipLogin.addEventListener('click', flipToLogin);
    if (triggerArea) {
        triggerArea.addEventListener('click', (e) => {
            if (e.target.classList.contains('auth-stop-propagation')) return;
            flipToRegister();
        });
    }

    const setPendingVerifyEmail = (email) => {
        if (!email) return;
        sessionStorage.setItem('yh_pending_verify_email', String(email).trim().toLowerCase());
    };

    const getPendingVerifyEmail = () => {
        const fromSession = sessionStorage.getItem('yh_pending_verify_email');
        if (fromSession) return fromSession;

        const regEmailInput = document.getElementById('reg-email');
        return regEmailInput?.value?.trim().toLowerCase() || '';
    };

    const clearPendingVerifyEmail = () => {
        sessionStorage.removeItem('yh_pending_verify_email');
    };

    const bootstrapPendingVerification = () => {
        const pendingEmail = getPendingVerifyEmail();
        if (!pendingEmail) return;

        showStep(2);

        const otpInput = document.getElementById('otp-input');
        if (otpInput) otpInput.value = '';

        startOTPTimer();
    };
bootstrapPendingVerification();
    // --- LOGIN LOGIC ---
const btnLogin = document.getElementById('btn-login');
if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const identifier = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!identifier || !password) {
            showToast("Please enter your email/username and password.", "error");
            return;
        }

        btnLogin.innerText = "Loading...";
        btnLogin.disabled = true;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });

            const result = await response.json();

            if (result.success) {
                showToast(result.message, "success");
                clearPendingVerifyEmail();
                localStorage.setItem('yh_user_loggedIn', 'true');
                localStorage.setItem('yh_user_name', result.user.username || result.user.fullName.split(' ')[0]);
                localStorage.setItem('yh_token', result.token);
                setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
                return;
            }

            if (response.status === 403 && result.verificationRequired) {
                const verificationEmail = String(result.email || identifier).trim().toLowerCase();

                if (verificationEmail) {
                    setPendingVerifyEmail(verificationEmail);
                }

                document.getElementById('otp-input').value = '';
                showStep(2);
                startOTPTimer();
                showToast(result.message, "error");

                btnLogin.innerText = "Login";
                btnLogin.disabled = false;
                return;
            }

            showToast(result.message, "error");
            btnLogin.innerText = "Login";
            btnLogin.disabled = false;
        } catch (error) {
            showToast("Server error during login.", "error");
            btnLogin.innerText = "Login";
            btnLogin.disabled = false;
        }
    });
}

    // --- REGISTER LOGIC (SIMPLE FORM) ---
    const formRegisterSimple = document.getElementById('form-register-simple');
    if (formRegisterSimple) {
        formRegisterSimple.addEventListener('submit', async function(e) {
            e.preventDefault();

            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;
            if (password !== confirmPassword) {
                showToast("Passwords do not match.", "error");
                return;
            }

            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.innerText = "Creating Account...";
            submitBtn.disabled = true;

            const fullName = document.getElementById('reg-fullname').value.trim();
            const email = document.getElementById('reg-email').value.trim().toLowerCase();

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullName, email, password })
                });

                const result = await response.json();

                if (result.success) {
                    setPendingVerifyEmail(email);
                    showToast(result.message, "success");
                    showStep(2);
                    startOTPTimer();
                } else {
                    showToast(result.message, "error");
                    submitBtn.innerText = "Create Account ➔";
                    submitBtn.disabled = false;
                }
            } catch (error) {
                showToast("Server error during registration.", "error");
                submitBtn.innerText = "Create Account ➔";
                submitBtn.disabled = false;
            }
        });
    }

    // --- OTP LOGIC ---
    let otpTimerInterval;
    function startOTPTimer() {
        clearInterval(otpTimerInterval);
        let timeLeft = 120;
        const timerDisplay = document.getElementById('otp-timer');
        const resendBtn = document.getElementById('btn-resend-otp');
        
        resendBtn.disabled = true; resendBtn.style.opacity = '0.5'; resendBtn.style.cursor = 'not-allowed';
        timerDisplay.style.color = 'var(--neon-blue)';

        otpTimerInterval = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60); const seconds = timeLeft % 60;
            timerDisplay.innerText = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            resendBtn.innerText = `Resend in ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

            if (timeLeft <= 0) {
                clearInterval(otpTimerInterval);
                timerDisplay.innerText = "00:00"; timerDisplay.style.color = "#ef4444";
                resendBtn.innerText = "Resend Code"; resendBtn.disabled = false; resendBtn.style.opacity = '1'; resendBtn.style.cursor = 'pointer';
            }
            timeLeft--;
        }, 1000);
    }

    const btnResendOTP = document.getElementById('btn-resend-otp');
    if(btnResendOTP) {
        btnResendOTP.addEventListener('click', async () => {
            const email = getPendingVerifyEmail();
            if (!email) {
                showToast("Missing verification email. Please register again.", "error");
                showStep(1);
                return;
            }

            btnResendOTP.innerText = "Sending..."; btnResendOTP.disabled = true;

            try {
                const response = await fetch('/api/resend-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const result = await response.json();

                if (result.success) {
                    showToast("A new code has been sent to your email.", "success");
                    document.getElementById('otp-input').value = ""; startOTPTimer();
                } else {
                    showToast(result.message, "error"); btnResendOTP.innerText = "Resend Code"; btnResendOTP.disabled = false;
                }
            } catch (error) {
                showToast("Failed to resend code.", "error"); btnResendOTP.innerText = "Resend Code"; btnResendOTP.disabled = false;
            }
        });
    }

    const formVerifyOTP = document.getElementById('form-verify-otp');
    if (formVerifyOTP) {
        formVerifyOTP.addEventListener('submit', async function(e) {
            e.preventDefault();
            const otpCode = document.getElementById('otp-input').value.trim();
            const email = getPendingVerifyEmail();

            if (!email) {
                showToast("Missing verification email. Please register again.", "error");
                showStep(1);
                return;
            }
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.innerText = "Verifying..."; submitBtn.disabled = true;

            try {
                const response = await fetch('/api/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otpCode })
                });
                const result = await response.json();

                if (result.success) {
                    clearInterval(otpTimerInterval);
                    clearPendingVerifyEmail();
                    showToast("Account verified. Welcome to YH Universe.", "success");
                    
                    localStorage.setItem('yh_user_loggedIn', 'true');
                    localStorage.setItem('yh_user_name', result.user.username || result.user.fullName.split(' ')[0]);
                    localStorage.setItem('yh_token', result.token); 
                    
                    setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
                } else {
                    showToast(result.message, "error");
                    submitBtn.innerText = "Verify & Enter Universe ➔"; submitBtn.disabled = false;
                }
            } catch (error) {
                showToast("Server error during verification.", "error");
                submitBtn.innerText = "Verify & Enter Universe ➔"; submitBtn.disabled = false;
            }
        });
    }

    // --- FORGOT PASSWORD LOGIC ---
    const forgotLink = document.querySelector('.forgot-link');
    if (forgotLink) { forgotLink.addEventListener('click', (e) => { e.preventDefault(); showStep(3); }); }

    let forgotTimerInterval; let resetEmailHolder = ""; 
    function startForgotTimer() {
        clearInterval(forgotTimerInterval); let timeLeft = 120;
        const timerDisplay = document.getElementById('forgot-otp-timer');
        timerDisplay.style.color = 'var(--neon-blue)';
        forgotTimerInterval = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60); const seconds = timeLeft % 60;
            timerDisplay.innerText = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            if (timeLeft <= 0) { clearInterval(forgotTimerInterval); timerDisplay.innerText = "00:00"; timerDisplay.style.color = "#ef4444"; }
            timeLeft--;
        }, 1000);
    }

    const formForgotPass = document.getElementById('form-forgot-pass');
    if (formForgotPass) {
        formForgotPass.addEventListener('submit', async (e) => {
            e.preventDefault(); const email = document.getElementById('forgot-email-input').value;
            const submitBtn = document.getElementById('btn-forgot-send'); submitBtn.innerText = "Sending..."; submitBtn.disabled = true;
            try {
                const response = await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
                const result = await response.json();
                if (result.success) { resetEmailHolder = email; showStep(4); startForgotTimer(); } else { showToast(result.message, "error"); }
            } catch (error) { showToast("Server error.", "error"); } finally { submitBtn.innerText = "Send Recovery Code"; submitBtn.disabled = false; }
        });
    }

    const formForgotOTP = document.getElementById('form-forgot-otp');
    if (formForgotOTP) {
        formForgotOTP.addEventListener('submit', async (e) => {
            e.preventDefault(); const otpCode = document.getElementById('forgot-otp-code').value;
            const submitBtn = document.getElementById('btn-forgot-verify'); submitBtn.innerText = "Verifying..."; submitBtn.disabled = true;
            try {
                const response = await fetch('/api/verify-forgot-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resetEmailHolder, otpCode }) });
                const result = await response.json();
                if (result.success) { clearInterval(forgotTimerInterval); showStep(5); } else { showToast(result.message, "error"); }
            } catch (error) { showToast("Server error.", "error"); } finally { submitBtn.innerText = "Verify Code"; submitBtn.disabled = false; }
        });
    }

    const formResetPass = document.getElementById('form-reset-pass');
    if (formResetPass) {
        formResetPass.addEventListener('submit', async (e) => {
            e.preventDefault(); const newPassword = document.getElementById('reset-new-password').value; const confirmPassword = document.getElementById('reset-confirm-password').value;
            if (newPassword !== confirmPassword) { showToast("Passwords do not match.", "error"); return; }
            const submitBtn = document.getElementById('btn-reset-save'); submitBtn.innerText = "Saving..."; submitBtn.disabled = true;
            try {
                const response = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resetEmailHolder, newPassword }) });
                const result = await response.json();
                if (result.success) { formResetPass.reset(); resetEmailHolder = ""; showStep(6); } else { showToast(result.message, "error"); }
            } catch (error) { showToast("Server error.", "error"); } finally { submitBtn.innerText = "Save New Password ➔"; submitBtn.disabled = false; }
        });
    }
});