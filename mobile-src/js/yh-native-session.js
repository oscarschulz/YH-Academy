// mobile-src/js/yh-native-session.js
(function () {
    'use strict';

    const SESSION_CHECK_KEY =
        '__yhNativeSessionRestoreStartedV1';

    function isNativeApp() {
        return (
            window.YHNativeRuntime
                ?.isNativeApp?.() === true
        );
    }

    function getStoredToken() {
        try {
            return String(
                localStorage.getItem('yh_token') ||
                localStorage.getItem('token') ||
                sessionStorage.getItem('yh_token') ||
                sessionStorage.getItem('token') ||
                ''
            ).trim();
        } catch (_) {
            return '';
        }
    }

    function isAuthEntryPage() {
        const pathname =
            String(
                window.location?.pathname ||
                '/'
            )
                .trim()
                .toLowerCase()
                .replace(/\/+$/, '') ||
            '/';

        return (
            pathname === '/' ||
            pathname === '/index.html' ||
            pathname === '/apply' ||
            pathname === '/apply/index.html' ||
            pathname === '/apply.html'
        );
    }

    function clearInvalidNativeAuth() {
        const authKeys = [
            'yh_user_loggedIn',
            'yh_token',
            'token'
        ];

        [
            localStorage,
            sessionStorage
        ].forEach((store) => {
            try {
                authKeys.forEach(
                    (key) => {
                        store.removeItem(
                            key
                        );
                    }
                );
            } catch (_) {}
        });
    }

    function markSessionState(
        state = ''
    ) {
        try {
            document.documentElement
                .setAttribute(
                    'data-yh-native-session',
                    String(
                        state || ''
                    )
                );
        } catch (_) {}
    }

    async function validateStoredSession(
        token = ''
    ) {
        const cleanToken =
            String(
                token || ''
            ).trim();

        if (!cleanToken) {
            return {
                valid: false,
                reason: 'missing-token'
            };
        }

        try {
            const response =
                await fetch(
                    '/api/universe/profile',
                    {
                        method: 'GET',

                        credentials:
                            'include',

                        cache:
                            'no-store',

                        headers: {
                            Accept:
                                'application/json',

                            Authorization:
                                `Bearer ${cleanToken}`
                        }
                    }
                );

            /*
             * Authentication failure is authoritative.
             */
            if (
                response.status === 401 ||
                response.status === 403
            ) {
                return {
                    valid: false,
                    reason:
                        'invalid-token'
                };
            }

            /*
             * Do NOT destroy the stored session because
             * of a temporary backend/server failure.
             */
            if (!response.ok) {
                return {
                    valid: false,
                    transient: true,
                    reason:
                        `http-${response.status}`
                };
            }

            return {
                valid: true,
                reason: 'verified'
            };
        } catch (error) {
            return {
                valid: false,
                transient: true,
                reason:
                    'network-error',
                error
            };
        }
    }

    async function restoreNativeSession() {
        if (!isNativeApp()) {
            return false;
        }

        if (!isAuthEntryPage()) {
            return false;
        }

        if (
            window[
                SESSION_CHECK_KEY
            ] === true
        ) {
            return false;
        }

        window[
            SESSION_CHECK_KEY
        ] = true;

        const token =
            getStoredToken();

        if (!token) {
            markSessionState(
                'guest'
            );

            return false;
        }

        markSessionState(
            'checking'
        );

        const result =
            await validateStoredSession(
                token
            );

        if (result.valid === true) {
            try {
                localStorage.setItem(
                    'yh_user_loggedIn',
                    'true'
                );

                sessionStorage.setItem(
                    'yh_user_loggedIn',
                    'true'
                );
            } catch (_) {}

            markSessionState(
                'authenticated'
            );

            /*
             * Keep navigation inside the bundled app.
             * Use the actual bundled HTML file directly.
             */
            window.location.replace(
                '/dashboard.html'
            );

            return true;
        }

        if (
            result.transient === true
        ) {
            /*
             * Network/server issue:
             * retain token. Never log the user out just
             * because the phone is temporarily offline.
             */
            markSessionState(
                'offline'
            );

            return false;
        }

        clearInvalidNativeAuth();

        markSessionState(
            'guest'
        );

        return false;
    }

    function boot() {
        void restoreNativeSession();
    }

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            boot,
            {
                once: true
            }
        );
    } else {
        boot();
    }

    window.YHNativeSession = {
        restore:
            restoreNativeSession,

        validate:
            validateStoredSession,

        getStoredToken
    };
})();