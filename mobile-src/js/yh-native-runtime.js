// mobile-src/js/yh-native-runtime.js
(function () {
    'use strict';

    const YH_PRODUCTION_ORIGIN =
        'https://www.younghustlersuniverse.com';

    const originalFetch =
        typeof window.fetch === 'function'
            ? window.fetch.bind(window)
            : null;

    function getCapacitorPlatform() {
        try {
            const capacitor =
                window.Capacitor;

            if (
                capacitor &&
                typeof capacitor.getPlatform ===
                    'function'
            ) {
                return String(
                    capacitor.getPlatform() ||
                    'web'
                )
                    .trim()
                    .toLowerCase();
            }
        } catch (_) {}

        if (
            String(
                window.location?.protocol ||
                ''
            ).toLowerCase() ===
            'capacitor:'
        ) {
            return 'ios';
        }

        return 'web';
    }

    function isNativeApp() {
        try {
            const capacitor =
                window.Capacitor;

            if (
                capacitor &&
                typeof capacitor.isNativePlatform ===
                    'function'
            ) {
                return (
                    capacitor.isNativePlatform() ===
                    true
                );
            }
        } catch (_) {}

        return (
            getCapacitorPlatform() !==
            'web'
        );
    }

    function isRemoteServerPath(
        pathname = ''
    ) {
        const cleanPath =
            String(
                pathname || ''
            );

        return (
            cleanPath === '/api' ||
            cleanPath.startsWith('/api/') ||
            cleanPath === '/uploads' ||
            cleanPath.startsWith('/uploads/')
        );
    }

    function resolveRemoteUrl(
        value = ''
    ) {
        const raw =
            String(
                value || ''
            ).trim();

        if (
            !raw ||
            !isNativeApp()
        ) {
            return raw;
        }

        /*
         * Already absolute remote URLs,
         * data URLs, blobs, mail links, etc.
         * remain untouched.
         */
        if (
            /^https?:\/\//i.test(raw)
        ) {
            return raw;
        }

        if (
            /^(data|blob|mailto|tel):/i.test(
                raw
            )
        ) {
            return raw;
        }

        /*
         * Root-relative server resources.
         */
        if (
            raw.startsWith('/') &&
            isRemoteServerPath(raw)
        ) {
            return (
                YH_PRODUCTION_ORIGIN +
                raw
            );
        }

        /*
         * Handle URLs that were already resolved by
         * browser code against capacitor://localhost.
         */
        try {
            const parsed =
                new URL(
                    raw,
                    window.location.href
                );

            const protocol =
                String(
                    parsed.protocol || ''
                ).toLowerCase();

            const localNativeProtocol =
                protocol === 'capacitor:' ||
                protocol === 'ionic:';

            if (
                localNativeProtocol &&
                isRemoteServerPath(
                    parsed.pathname
                )
            ) {
                return (
                    YH_PRODUCTION_ORIGIN +
                    parsed.pathname +
                    parsed.search +
                    parsed.hash
                );
            }
        } catch (_) {}

        /*
         * Local app pages/assets remain inside
         * mobile-public:
         *
         * /dashboard
         * /academy
         * /css/*
         * /js/*
         * /images/*
         * /assets/*
         */
        return raw;
    }

    function resolveApiUrl(
        value = ''
    ) {
        const raw =
            String(
                value || ''
            ).trim();

        if (!raw) {
            return YH_PRODUCTION_ORIGIN;
        }

        if (
            /^https?:\/\//i.test(raw)
        ) {
            return raw;
        }

        const path =
            raw.startsWith('/')
                ? raw
                : `/${raw}`;

        return isNativeApp()
            ? (
                YH_PRODUCTION_ORIGIN +
                path
            )
            : path;
    }

    function resolveAssetUrl(
        value = ''
    ) {
        const raw =
            String(
                value || ''
            ).trim();

        if (
            !raw ||
            !isNativeApp()
        ) {
            return raw;
        }

        if (
            /^https?:\/\//i.test(raw) ||
            /^(data|blob):/i.test(raw)
        ) {
            return raw;
        }

        if (
            raw.startsWith(
                '/uploads/'
            )
        ) {
            return (
                YH_PRODUCTION_ORIGIN +
                raw
            );
        }

        return raw;
    }

    function rewriteFetchInput(
        input
    ) {
        if (!isNativeApp()) {
            return input;
        }

        if (
            typeof input === 'string'
        ) {
            return resolveRemoteUrl(
                input
            );
        }

        if (
            typeof URL !==
                'undefined' &&
            input instanceof URL
        ) {
            const rewritten =
                resolveRemoteUrl(
                    input.toString()
                );

            return rewritten ||
                input;
        }

        if (
            typeof Request !==
                'undefined' &&
            input instanceof Request
        ) {
            const rewritten =
                resolveRemoteUrl(
                    input.url
                );

            if (
                !rewritten ||
                rewritten === input.url
            ) {
                return input;
            }

            try {
                return new Request(
                    rewritten,
                    input
                );
            } catch (_) {
                return rewritten;
            }
        }

        return input;
    }

    function getNativeStoredAuthToken() {
        try {
            return String(
                sessionStorage.getItem('yh_token') ||
                localStorage.getItem('yh_token') ||
                sessionStorage.getItem('token') ||
                localStorage.getItem('token') ||
                ''
            ).trim();
        } catch (_) {
            return '';
        }
    }

    function resolveNativeSocketTarget(
        value = ''
    ) {
        const raw =
            String(
                value || ''
            ).trim();

        if (!raw) {
            return YH_PRODUCTION_ORIGIN;
        }

        if (
            /^https?:\/\//i.test(raw) ||
            /^wss?:\/\//i.test(raw)
        ) {
            return raw;
        }

        /*
         * Socket.IO namespace:
         *
         * io('/academy')
         *
         * must connect to the production server,
         * not capacitor://localhost.
         */
        if (raw.startsWith('/')) {
            return (
                YH_PRODUCTION_ORIGIN +
                raw
            );
        }

        return raw;
    }

    function buildNativeSocketOptions(
        options = {}
    ) {
        const source =
            options &&
            typeof options === 'object'
                ? options
                : {};

        const token =
            getNativeStoredAuthToken();

        return {
            ...source,

            withCredentials: true,

            auth: {
                ...(
                    source.auth &&
                    typeof source.auth ===
                        'object'
                        ? source.auth
                        : {}
                ),

                ...(
                    token &&
                    !source.auth?.token
                        ? {
                            token
                        }
                        : {}
                )
            }
        };
    }

    function wrapSocketIoFactory(
        rawIo
    ) {
        if (
            typeof rawIo !==
            'function'
        ) {
            return rawIo;
        }

        function yhNativeIo(
            uriOrOptions,
            maybeOptions
        ) {
            let target =
                uriOrOptions;

            let options =
                maybeOptions;

            /*
             * io({ ...options })
             */
            if (
                uriOrOptions &&
                typeof uriOrOptions ===
                    'object' &&
                typeof uriOrOptions !==
                    'string'
            ) {
                target = '';
                options =
                    uriOrOptions;
            }

            const resolvedTarget =
                resolveNativeSocketTarget(
                    target || ''
                );

            const resolvedOptions =
                buildNativeSocketOptions(
                    options || {}
                );

            return rawIo(
                resolvedTarget,
                resolvedOptions
            );
        }

        /*
         * Preserve Socket.IO exported helpers.
         */
        try {
            Object.keys(rawIo)
                .forEach((key) => {
                    if (
                        key === 'io' ||
                        key === 'connect'
                    ) {
                        return;
                    }

                    try {
                        yhNativeIo[key] =
                            rawIo[key];
                    } catch (_) {}
                });
        } catch (_) {}

        yhNativeIo.io =
            yhNativeIo;

        yhNativeIo.connect =
            yhNativeIo;

        return yhNativeIo;
    }

    function installNativeSocketIoBridge() {
        if (!isNativeApp()) {
            return false;
        }

        /*
         * Native runtime loads before socket.io.js.
         * Capture Socket.IO when its browser bundle
         * assigns window.io, then wrap it.
         */
        try {
            if (
                typeof window.io ===
                'function'
            ) {
                window.io =
                    wrapSocketIoFactory(
                        window.io
                    );

                return true;
            }
        } catch (_) {}

        let capturedIo =
            null;

        let wrappedIo =
            null;

        try {
            Object.defineProperty(
                window,
                'io',
                {
                    configurable: true,
                    enumerable: true,

                    get() {
                        return (
                            wrappedIo ||
                            capturedIo
                        );
                    },

                    set(value) {
                        capturedIo =
                            value;

                        wrappedIo =
                            typeof value ===
                                'function'
                                ? wrapSocketIoFactory(
                                    value
                                )
                                : value;
                    }
                }
            );

            return true;
        } catch (_) {
            return false;
        }
    }

    installNativeSocketIoBridge();

    if (originalFetch) {
        window.fetch =
            function yhNativeFetch(
                input,
                options
            ) {
                return originalFetch(
                    rewriteFetchInput(
                        input
                    ),
                    options
                );
            };
    }

        /* ===================================================== */
    /* NATIVE LIVE MEDIA BRIDGE                              */
    /* ===================================================== */

    function rewriteNativeMediaUrl(
        value = ''
    ) {
        const raw =
            String(
                value || ''
            ).trim();

        if (
            !raw ||
            !isNativeApp()
        ) {
            return raw;
        }

        if (
            /^https?:\/\//i.test(raw) ||
            /^(data|blob):/i.test(raw)
        ) {
            return raw;
        }

        if (
            raw.startsWith(
                '/uploads/'
            )
        ) {
            return (
                YH_PRODUCTION_ORIGIN +
                raw
            );
        }

        return raw;
    }

    function rewriteNativeSrcset(
        value = ''
    ) {
        const raw =
            String(
                value || ''
            ).trim();

        if (
            !raw ||
            !isNativeApp()
        ) {
            return raw;
        }

        return raw
            .split(',')
            .map((candidate) => {
                const clean =
                    String(
                        candidate || ''
                    ).trim();

                if (!clean) {
                    return '';
                }

                const parts =
                    clean.split(/\s+/);

                const url =
                    parts.shift() || '';

                const descriptor =
                    parts.join(' ');

                const rewritten =
                    rewriteNativeMediaUrl(
                        url
                    );

                return [
                    rewritten,
                    descriptor
                ]
                    .filter(Boolean)
                    .join(' ');
            })
            .filter(Boolean)
            .join(', ');
    }

    function rewriteNativeBackgroundStyle(
        element
    ) {
        if (
            !element ||
            !isNativeApp()
        ) {
            return;
        }

        try {
            const backgroundImage =
                String(
                    element.style
                        ?.backgroundImage ||
                    ''
                );

            if (
                !backgroundImage ||
                !backgroundImage.includes(
                    '/uploads/'
                )
            ) {
                return;
            }

            const rewritten =
                backgroundImage.replace(
                    /url\((['"]?)(\/uploads\/[^)'"]+)\1\)/gi,
                    (
                        _match,
                        _quote,
                        assetPath
                    ) => {
                        const resolved =
                            rewriteNativeMediaUrl(
                                assetPath
                            );

                        return `url("${resolved}")`;
                    }
                );

            if (
                rewritten !==
                backgroundImage
            ) {
                element.style
                    .backgroundImage =
                    rewritten;
            }
        } catch (_) {}
    }

    function rewriteNativeMediaElement(
        element
    ) {
        if (
            !element ||
            element.nodeType !== 1 ||
            !isNativeApp()
        ) {
            return;
        }

        const attributes = [
            'src',
            'poster',
            'href'
        ];

        attributes.forEach(
            (attributeName) => {
                try {
                    if (
                        !element.hasAttribute(
                            attributeName
                        )
                    ) {
                        return;
                    }

                    const currentValue =
                        element.getAttribute(
                            attributeName
                        );

                    const rewrittenValue =
                        rewriteNativeMediaUrl(
                            currentValue
                        );

                    if (
                        rewrittenValue &&
                        rewrittenValue !==
                            currentValue
                    ) {
                        element.setAttribute(
                            attributeName,
                            rewrittenValue
                        );
                    }
                } catch (_) {}
            }
        );

        try {
            if (
                element.hasAttribute(
                    'srcset'
                )
            ) {
                const currentSrcset =
                    element.getAttribute(
                        'srcset'
                    );

                const rewrittenSrcset =
                    rewriteNativeSrcset(
                        currentSrcset
                    );

                if (
                    rewrittenSrcset &&
                    rewrittenSrcset !==
                        currentSrcset
                ) {
                    element.setAttribute(
                        'srcset',
                        rewrittenSrcset
                    );
                }
            }
        } catch (_) {}

        rewriteNativeBackgroundStyle(
            element
        );
    }

    function rewriteNativeMediaTree(
        root
    ) {
        if (
            !root ||
            !isNativeApp()
        ) {
            return;
        }

        if (
            root.nodeType === 1
        ) {
            rewriteNativeMediaElement(
                root
            );
        }

        try {
            root
                .querySelectorAll?.(
                    '[src], [srcset], [poster], [href], [style]'
                )
                .forEach(
                    rewriteNativeMediaElement
                );
        } catch (_) {}
    }

    function installNativeMediaBridge() {
        if (
            !isNativeApp()
        ) {
            return false;
        }

        const startObserver =
            () => {
                rewriteNativeMediaTree(
                    document.documentElement
                );

                if (
                    typeof MutationObserver !==
                        'function'
                ) {
                    return;
                }

                const observer =
                    new MutationObserver(
                        (mutations) => {
                            mutations.forEach(
                                (mutation) => {
                                    if (
                                        mutation.type ===
                                            'attributes'
                                    ) {
                                        rewriteNativeMediaElement(
                                            mutation.target
                                        );

                                        return;
                                    }

                                    mutation.addedNodes
                                        ?.forEach(
                                            (
                                                node
                                            ) => {
                                                rewriteNativeMediaTree(
                                                    node
                                                );
                                            }
                                        );
                                }
                            );
                        }
                    );

                observer.observe(
                    document.documentElement,
                    {
                        subtree: true,

                        childList: true,

                        attributes: true,

                        attributeFilter: [
                            'src',
                            'srcset',
                            'poster',
                            'href',
                            'style'
                        ]
                    }
                );

                window.__yhNativeMediaObserver =
                    observer;
            };

        if (
            document.readyState ===
            'loading'
        ) {
            document.addEventListener(
                'DOMContentLoaded',
                startObserver,
                {
                    once: true
                }
            );
        } else {
            startObserver();
        }

        return true;
    }

    installNativeMediaBridge();

    const api = {
        productionOrigin:
            YH_PRODUCTION_ORIGIN,

        getPlatform:
            getCapacitorPlatform,

        isNativeApp,

        resolveRemoteUrl,

        resolveApiUrl,

        resolveAssetUrl,

        rewriteNativeMediaUrl,

        rewriteNativeSrcset,

        rewriteNativeMediaTree
    };

    window.YHNativeRuntime =
        api;

    try {
        document
            .documentElement
            .setAttribute(
                'data-yh-native-runtime',
                isNativeApp()
                    ? 'native'
                    : 'web'
            );

        document
            .documentElement
            .setAttribute(
                'data-yh-native-platform',
                getCapacitorPlatform()
            );
    } catch (_) {}
})();