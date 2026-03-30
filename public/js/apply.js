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
    const otpStep = document.getElementById('step-2');
    const timerEl = document.getElementById('otp-timer');
    const resendBtn = document.getElementById('btn-resend-otp');

    if (!toast || !toastMsg || !toastIcon) return;

    toastMsg.innerText = message;

    if (type === "error") {
        toast.classList.add('error-toast');
        toastIcon.innerText = "⚠️";
    } else {
        toast.classList.remove('error-toast');
        toastIcon.innerText = "🎉";
    }

    const otpStepVisible = otpStep && !otpStep.classList.contains('hidden-step');

    // reset/default
    toast.style.position = 'fixed';
    toast.style.left = '50%';
    toast.style.right = 'auto';
    toast.style.top = '32px';
    toast.style.bottom = 'auto';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '10000';
    toast.style.width = 'min(92vw, 460px)';
    toast.style.maxWidth = '460px';
    toast.style.minWidth = '0';
    toast.style.padding = '10px 14px';
    toast.style.borderRadius = '12px';
    toast.style.fontSize = '0.92rem';
    toast.style.lineHeight = '1.35';
    toast.style.textAlign = 'center';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'center';
    toast.style.gap = '8px';
    toast.style.boxSizing = 'border-box';
    toast.style.wordBreak = 'break-word';

    if (otpStepVisible) {
        const isMobile = window.innerWidth <= 768;

        toast.style.top = 'auto';
        toast.style.left = '50%';
        toast.style.right = 'auto';
        toast.style.transform = 'translateX(-50%)';

        if (isMobile) {
            toast.style.width = 'calc(100vw - 32px)';
            toast.style.maxWidth = '360px';
            toast.style.padding = '9px 12px';
            toast.style.fontSize = '0.84rem';
            toast.style.borderRadius = '10px';
            toast.style.bottom = '92px';
        } else {
            toast.style.width = 'min(78%, 420px)';
            toast.style.maxWidth = '420px';
            toast.style.padding = '10px 14px';
            toast.style.fontSize = '0.88rem';
            toast.style.borderRadius = '12px';

            if (resendBtn) {
                const resendRect = resendBtn.getBoundingClientRect();
                const bottomGap = Math.max(28, window.innerHeight - resendRect.top + 6);
                toast.style.bottom = `${bottomGap}px`;
            } else if (timerEl) {
                const timerRect = timerEl.getBoundingClientRect();
                const bottomGap = Math.max(84, window.innerHeight - timerRect.bottom + 44);
                toast.style.bottom = `${bottomGap}px`;
            } else {
                toast.style.bottom = '110px';
            }
        }
    }

    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(window.__yhToastTimer);
    window.__yhToastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

function clearAcademyClientStateForFreshAuth() {
    localStorage.removeItem('yh_academy_access');
    localStorage.removeItem('yh_academy_home');
    localStorage.removeItem('yh_academy_membership_status_v1');
    localStorage.removeItem('yh_academy_application_profile');
    localStorage.removeItem('yh_academy_roadmap_profile_v1');
    localStorage.removeItem('yh_academy_roadmap_locked_v1');
    localStorage.removeItem('yh_admin_panel_state_v2');
    localStorage.removeItem('yh_admin_panel_state_v3_live');
    sessionStorage.removeItem('yh_force_academy_application_after_auth');
}

function persistClientSession(user, token) {
    const fullName = String(user?.fullName || user?.username || 'Hustler').trim();
    const username = String(user?.username || '').trim();
    const email = String(user?.email || '').trim().toLowerCase();

    localStorage.removeItem('yh_token');
    localStorage.removeItem('yh_user_loggedIn');

    sessionStorage.setItem('yh_user_loggedIn', 'true');
    sessionStorage.setItem('yh_user_name', fullName);
    sessionStorage.setItem('yh_user_username', username);
    sessionStorage.setItem('yh_user_email', email);
    sessionStorage.setItem('yh_token', String(token || '').trim());
}

document.addEventListener('DOMContentLoaded', () => {
    // Prevent landing-page redirect loops caused by stale browser auth flags.
    // The server-side /dashboard cookie gate is now the source of truth.
    localStorage.removeItem('yh_user_loggedIn');
    localStorage.removeItem('yh_token');
    localStorage.removeItem('token');

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
const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const compressImageToDataURL = (file, size = 320, quality = 0.82) => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas is not supported.'));
                return;
            }

            const side = Math.min(img.width, img.height);
            const sx = (img.width - side) / 2;
            const sy = (img.height - side) / 2;

            ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };

        img.onerror = reject;
        img.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
});

const bindPasswordVisibilityToggles = () => {
    document.querySelectorAll('.yh-password-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (!input) return;

            const shouldShow = input.type === 'password';
            input.type = shouldShow ? 'text' : 'password';
            btn.innerText = shouldShow ? 'Hide' : 'Show';
        });
    });
};

const bindRegisterPhotoUpload = () => {
    const input = document.getElementById('reg-profile-photo');
    const label = document.getElementById('reg-profile-photo-label');

    if (!input || !label) return;

    input.addEventListener('change', () => {
        const file = input.files?.[0];

        if (!file) {
            label.innerText = 'Choose profile photo';
            return;
        }

        if (!file.type.startsWith('image/')) {
            showToast('Please choose an image file.', 'error');
            input.value = '';
            label.innerText = 'Choose profile photo';
            return;
        }

        label.innerText = file.name;
    });
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
bindPasswordVisibilityToggles();
bindRegisterPhotoUpload();
    // --- LOGIN LOGIC ---
const btnLogin = document.getElementById('btn-login');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');

async function handleLoginSubmit() {
    if (!btnLogin) return;

    const identifier = loginEmailInput?.value?.trim() || '';
    const password = loginPasswordInput?.value || '';

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
    clearAcademyClientStateForFreshAuth();

    persistClientSession({
        ...result.user,
        email: result.user?.email || identifier
    }, result.token);

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
}

if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
        await handleLoginSubmit();
    });
}

[loginEmailInput, loginPasswordInput].forEach((input) => {
    if (!input) return;

    input.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        await handleLoginSubmit();
    });
});

    // --- REGISTER LOGIC (SIMPLE FORM) ---
const formRegisterSimple = document.getElementById('form-register-simple');
if (formRegisterSimple) {
    formRegisterSimple.addEventListener('submit', async function(e) {
        e.preventDefault();

        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        const fullName = document.getElementById('reg-fullname').value.trim();
        const email = document.getElementById('reg-email').value.trim().toLowerCase();
        const username = document.getElementById('reg-username').value.trim();
        const profilePhotoFile = document.getElementById('reg-profile-photo')?.files?.[0] || null;

        if (password !== confirmPassword) {
            showToast("Passwords do not match.", "error");
            return;
        }

        if (!username) {
            showToast("Please enter a username.", "error");
            return;
        }

        if (!profilePhotoFile) {
            showToast("Profile photo is required.", "error");
            return;
        }

        if (!profilePhotoFile.type.startsWith('image/')) {
            showToast("Please upload a valid image file.", "error");
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.innerText = "Creating Account...";
        submitBtn.disabled = true;

        try {
            const profilePhotoDataUrl = await compressImageToDataURL(profilePhotoFile, 320, 0.82);

            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName,
                    email,
                    username,
                    password,
                    profilePhotoDataUrl
                })
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

    clearAcademyClientStateForFreshAuth();

    persistClientSession({
        ...result.user,
        email: result.user?.email || email
    }, result.token);

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
document.addEventListener('DOMContentLoaded', () => {
    const authSection = document.getElementById('yh-auth-section');
    const divisionsSection = document.getElementById('yh-divisions-section');

    const scrollToTarget = (target) => {
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const openAuthPanel = () => {
        scrollToTarget(authSection);
    };

    const btnTopbar = document.getElementById('yh-scroll-auth');
    const btnHero = document.getElementById('yh-open-auth-main');
    const btnAcademy = document.getElementById('yh-open-auth-academy');
    const btnDivisions = document.getElementById('yh-scroll-divisions');

    if (btnTopbar) btnTopbar.addEventListener('click', () => openAuthPanel());
    if (btnHero) btnHero.addEventListener('click', () => openAuthPanel());
    if (btnAcademy) btnAcademy.addEventListener('click', () => openAuthPanel());
    if (btnDivisions) btnDivisions.addEventListener('click', () => scrollToTarget(divisionsSection));

    document.querySelectorAll('.yh-coming-soon-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const label = button.getAttribute('data-soon') || 'This division';
            showToast(`${label} is coming soon to Young Hustlers Universe.`, 'success');
        });
    });
});