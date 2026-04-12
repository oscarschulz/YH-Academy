// public/js/yh-shared-core.js
(function () {
    function getStoredAuthToken() {
        return (
            sessionStorage.getItem('yh_token') ||
            localStorage.getItem('yh_token') ||
            sessionStorage.getItem('token') ||
            localStorage.getItem('token') ||
            ''
        ).trim();
    }

    function getStoredUserValue(key, fallback = '') {
        return (
            sessionStorage.getItem(key) ||
            localStorage.getItem(key) ||
            fallback
        );
    }

    const yhT = (key, options = {}) => (
        typeof window.yhT === 'function' ? window.yhT(key, options) : key
    );

    const yhTText = (text, options = {}) => (
        typeof window.yhTText === 'function' ? window.yhTText(text, options) : text
    );

    function academyFeedEscapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeAcademyFeedId(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    async function logoutUser() {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
        } catch (_) {}

        [
            'yh_user_loggedIn',
            'yh_user_name',
            'yh_user_username',
            'yh_user_email',
            'yh_user_avatar',
            'yh_academy_access',
            'yh_academy_home',
            'yh_token',
            'token',
            'yh_academy_membership_status_v1',
            'yh_academy_application_profile',
            'yh_academy_roadmap_profile_v1',
            'yh_academy_roadmap_locked_v1',
            'yh_admin_panel_state_v2',
            'yh_admin_panel_state_v3_live'
        ].forEach((key) => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });

        sessionStorage.removeItem('yh_force_academy_application_after_auth');
        window.location.href = '/';
    }

    function openYHConfirmModal({ title = 'Confirm', message = 'Are you sure?', okText = 'OK', cancelText = 'Cancel', tone = 'default' } = {}) {
        const overlay = document.getElementById('yh-confirm-overlay');
        const titleEl = document.getElementById('yh-confirm-title');
        const msgEl = document.getElementById('yh-confirm-message');
        const btnOk = document.getElementById('yh-confirm-ok');
        const btnCancel = document.getElementById('yh-confirm-cancel');
        const btnX = document.getElementById('yh-confirm-x');

        if (!overlay || !titleEl || !msgEl || !btnOk || !btnCancel || !btnX) {
            return Promise.resolve(window.confirm(message));
        }

        btnOk.classList.remove('is-danger');
        if (tone === 'danger') {
            btnOk.classList.add('is-danger');
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        btnOk.textContent = okText;
        btnCancel.textContent = cancelText;

        overlay.classList.remove('hidden-step');

        return new Promise((resolve) => {
            let done = false;

            const cleanup = () => {
                if (done) return;
                done = true;
                overlay.classList.add('hidden-step');

                btnOk.removeEventListener('click', onOk);
                btnCancel.removeEventListener('click', onCancel);
                btnX.removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onOverlay);
                document.removeEventListener('keydown', onKey);
            };

            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };
            const onOverlay = (e) => { if (e.target === overlay) onCancel(); };
            const onKey = (e) => { if (e.key === 'Escape') onCancel(); };

            btnOk.addEventListener('click', onOk);
            btnCancel.addEventListener('click', onCancel);
            btnX.addEventListener('click', onCancel);
            overlay.addEventListener('click', onOverlay);
            document.addEventListener('keydown', onKey);
        });
    }

    function showToast(message, type = "success") {
        const toast = document.getElementById('toast-notification');
        const toastMsg = document.getElementById('toast-message');
        const toastIcon = document.getElementById('toast-icon');
        if (!toast || !toastMsg || !toastIcon) return;

        const isMobile = window.innerWidth <= 768;

        toastMsg.innerText = yhTText(message);

        if (type === "error") {
            toast.classList.add('error-toast');
            toastIcon.innerText = "⚠️";
            toastIcon.style.display = '';
        } else {
            toast.classList.remove('error-toast');
            toastIcon.innerText = "";
            toastIcon.style.display = 'none';
        }

        toast.style.position = 'fixed';
        toast.style.left = '50%';
        toast.style.right = 'auto';
        toast.style.top = isMobile ? '84px' : '96px';
        toast.style.bottom = 'auto';
        toast.style.transform = 'translateX(-50%)';
        toast.style.zIndex = '10000';
        toast.style.width = isMobile ? 'calc(100vw - 32px)' : 'min(92vw, 460px)';
        toast.style.maxWidth = isMobile ? '360px' : '460px';
        toast.style.minWidth = '0';
        toast.style.padding = isMobile ? '9px 12px' : '10px 14px';
        toast.style.borderRadius = isMobile ? '10px' : '12px';
        toast.style.fontSize = isMobile ? '0.84rem' : '0.9rem';
        toast.style.lineHeight = '1.35';
        toast.style.textAlign = 'center';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.justifyContent = 'center';
        toast.style.gap = '8px';
        toast.style.boxSizing = 'border-box';
        toast.style.wordBreak = 'break-word';

        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');

        clearTimeout(window.__yhToastTimer);
        window.__yhToastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 3500);
    }

    function updateUserProfile(newName, newAvatarData) {
        const safeName = String(newName || '').trim();

        if (safeName) {
            const initial = safeName.charAt(0).toUpperCase();

            const elsName = [
                document.getElementById('top-nav-name'),
                document.getElementById('right-sidebar-name'),
                document.getElementById('stage-user-name'),
                document.getElementById('academy-profile-name')
            ];

            elsName.forEach((el) => {
                if (el) {
                    el.innerText = safeName;
                    el.setAttribute('title', safeName);
                }
            });

            const elsInit = [
                document.getElementById('top-nav-initial'),
                document.getElementById('right-sidebar-initial'),
                document.getElementById('stage-user-initial'),
                document.getElementById('academy-profile-avatar')
            ];

            elsInit.forEach((el) => {
                if (el && !newAvatarData) {
                    el.innerText = initial;
                    el.style.backgroundImage = 'none';
                }
            });
        }

        if (newAvatarData) {
            const elsAvatar = [
                document.getElementById('top-nav-initial'),
                document.getElementById('right-sidebar-initial'),
                document.getElementById('stage-user-initial'),
                document.getElementById('academy-feed-composer-avatar'),
                document.getElementById('academy-profile-avatar')
            ];

            elsAvatar.forEach((el) => {
                if (el) {
                    el.innerText = '';
                    el.style.backgroundImage = `url(${newAvatarData})`;
                    el.style.backgroundSize = 'cover';
                    el.style.backgroundPosition = 'center';
                }
            });
        } else if (safeName) {
            const composerAvatar = document.getElementById('academy-feed-composer-avatar');
            if (composerAvatar) {
                composerAvatar.innerText = safeName.charAt(0).toUpperCase();
                composerAvatar.style.backgroundImage = 'none';
            }
        }
    }

    function persistKnownUser(user = {}) {
        const safeName = String(user?.name || '').trim();
        if (!safeName) return null;

        const storageKey = 'yh_known_users_cache_v1';

        let knownUsers = [];
        try {
            knownUsers = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (!Array.isArray(knownUsers)) knownUsers = [];
        } catch (_) {
            knownUsers = [];
        }

        const normalizedName = safeName.toLowerCase();

        const nextUser = {
            name: safeName,
            role: String(user?.role || 'Hustler').trim() || 'Hustler',
            avatarToken: String(user?.avatarToken || safeName.charAt(0).toUpperCase()).trim(),
            avatarBg: String(user?.avatarBg || 'var(--neon-blue)').trim() || 'var(--neon-blue)',
            updatedAt: new Date().toISOString()
        };

        const existingIndex = knownUsers.findIndex((item) => {
            return String(item?.name || '').trim().toLowerCase() === normalizedName;
        });

        if (existingIndex >= 0) {
            knownUsers[existingIndex] = {
                ...knownUsers[existingIndex],
                ...nextUser
            };
        } else {
            knownUsers.unshift(nextUser);
        }

        localStorage.setItem(storageKey, JSON.stringify(knownUsers.slice(0, 100)));
        return nextUser;
    }

    function readKnownUsersCache() {
        try {
            const parsed = JSON.parse(localStorage.getItem('yh_known_users_cache_v1') || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function extractAvatarUrlFromToken(token = '') {
        const safeToken = String(token || '').trim();
        if (!safeToken) return '';

        const match = safeToken.match(/^url\((['"]?)(.+?)\1\)$/i);
        return String(match?.[2] || '').trim();
    }

    function normalizeAvatarUrl(value = '') {
        const safeValue = String(value || '').trim();
        if (!safeValue) return '';

        const extracted = extractAvatarUrlFromToken(safeValue);
        return extracted || safeValue;
    }

    function resolveAcademyFeedAvatarUrl(post = {}, displayName = '', deps = {}) {
        const getStoredUserValueFn =
            typeof deps.getStoredUserValue === 'function'
                ? deps.getStoredUserValue
                : getStoredUserValue;

        const currentUserName = String(
            deps.currentUserName ||
            getStoredUserValueFn('yh_user_name', 'Hustler') ||
            'Hustler'
        ).trim();

        const directAvatar = [
            post?.avatar,
            post?.avatar_url,
            post?.user_avatar,
            post?.userAvatar,
            post?.profile_picture,
            post?.profilePicture,
            post?.profile_image,
            post?.profileImage,
            post?.author_avatar,
            post?.authorAvatar,
            post?.member_avatar,
            post?.memberAvatar,
            post?.photo_url,
            post?.photoUrl,
            post?.image_url_avatar
        ]
            .map((value) => normalizeAvatarUrl(value))
            .find(Boolean);

        if (directAvatar) return directAvatar;

        const safeDisplayName = String(
            displayName ||
            post?.display_name ||
            post?.fullName ||
            post?.username ||
            ''
        ).trim();

        const safeUsername = String(post?.username || '')
            .trim()
            .replace(/^@+/, '')
            .toLowerCase();

        const savedMyAvatar = normalizeAvatarUrl(getStoredUserValueFn('yh_user_avatar', ''));
        const savedMyName = String(getStoredUserValueFn('yh_user_name', currentUserName) || '')
            .trim()
            .toLowerCase();
        const savedMyUsername = String(getStoredUserValueFn('yh_user_username', '') || '')
            .trim()
            .replace(/^@+/, '')
            .toLowerCase();

        const ownedFlag = post?.owned_by_me;
        const matchesOwned =
            ownedFlag === true ||
            ownedFlag === 1 ||
            String(ownedFlag || '').trim() === '1' ||
            String(ownedFlag || '').trim().toLowerCase() === 'true';

        const matchesMyName =
            safeDisplayName &&
            safeDisplayName.toLowerCase() === savedMyName;

        const matchesMyUsername =
            safeUsername &&
            savedMyUsername &&
            safeUsername === savedMyUsername;

        if (savedMyAvatar && (matchesOwned || matchesMyName || matchesMyUsername)) {
            return savedMyAvatar;
        }

        const normalizedDisplayName = safeDisplayName.toLowerCase();
        const knownUsers = readKnownUsersCache();

        const matchedKnownUser = knownUsers.find((item) => {
            const knownName = String(item?.name || '').trim().toLowerCase();
            return Boolean(knownName) && (
                knownName === normalizedDisplayName ||
                (safeUsername && knownName === safeUsername)
            );
        });

        return normalizeAvatarUrl(matchedKnownUser?.avatarToken);
    }

    function renderAcademyFeedAvatarHtml(post = {}, displayName = '', deps = {}) {
        const resolveAcademyFeedAvatarUrlFn =
            typeof deps.resolveAcademyFeedAvatarUrl === 'function'
                ? deps.resolveAcademyFeedAvatarUrl
                : resolveAcademyFeedAvatarUrl;

        const normalizeAcademyFeedIdFn =
            typeof deps.normalizeAcademyFeedId === 'function'
                ? deps.normalizeAcademyFeedId
                : normalizeAcademyFeedId;

        const academyFeedEscapeHtmlFn =
            typeof deps.academyFeedEscapeHtml === 'function'
                ? deps.academyFeedEscapeHtml
                : academyFeedEscapeHtml;

        const safeDisplayName = String(displayName || '').trim() || 'Y';
        const avatarUrl = resolveAcademyFeedAvatarUrlFn(post, safeDisplayName, deps);
        const fallbackInitial = academyFeedEscapeHtmlFn(safeDisplayName.charAt(0).toUpperCase());
        const memberId = normalizeAcademyFeedIdFn(post?.user_id);

        const avatarStyle = avatarUrl
            ? `flex-shrink:0;width:36px;height:36px;font-size:0.9rem;background-image:url('${academyFeedEscapeHtmlFn(avatarUrl)}');background-size:cover;background-position:center;background-repeat:no-repeat;`
            : `flex-shrink:0;width:36px;height:36px;font-size:0.9rem;`;

        if (!memberId) {
            return `
                <div class="profile-avatar-mini" style="${avatarStyle}">
                    ${avatarUrl ? '' : fallbackInitial}
                </div>
            `;
        }

        return `
            <button
                type="button"
                class="profile-avatar-mini academy-feed-author-trigger academy-feed-author-avatar"
                data-member-profile-id="${academyFeedEscapeHtmlFn(memberId)}"
                aria-label="Open ${academyFeedEscapeHtmlFn(safeDisplayName)} profile"
                style="${avatarStyle}"
            >
                ${avatarUrl ? '' : fallbackInitial}
            </button>
        `;
    }

    const api = {
        getStoredAuthToken,
        getStoredUserValue,
        yhT,
        yhTText,
        academyFeedEscapeHtml,
        normalizeAcademyFeedId,
        logoutUser,
        openYHConfirmModal,
        showToast,
        updateUserProfile,
        persistKnownUser,
        readKnownUsersCache,
        extractAvatarUrlFromToken,
        normalizeAvatarUrl,
        resolveAcademyFeedAvatarUrl,
        renderAcademyFeedAvatarHtml
    };

    window.YHSharedCore = api;

    window.getStoredAuthToken = getStoredAuthToken;
    window.getStoredUserValue = getStoredUserValue;
    window.logoutUser = logoutUser;
    window.openYHConfirmModal = openYHConfirmModal;
    window.showToast = showToast;
    window.updateUserProfile = updateUserProfile;
    window.academyFeedEscapeHtml = window.academyFeedEscapeHtml || academyFeedEscapeHtml;
})();