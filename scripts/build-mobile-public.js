const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const VITE_DIST_DIR = path.join(
    ROOT,
    'frontend',
    'dist'
);

const MOBILE_SRC_DIR = path.join(
    ROOT,
    'mobile-src'
);

const OUTPUT_DIR = path.join(
    ROOT,
    'mobile-public'
);

function ensureDirectory(directory) {
    fs.mkdirSync(
        directory,
        {
            recursive: true
        }
    );
}

function removeDirectory(directory) {
    if (!fs.existsSync(directory)) {
        return;
    }

    fs.rmSync(
        directory,
        {
            recursive: true,
            force: true
        }
    );
}

function copyDirectory(
    source,
    destination,
    options = {}
) {
    if (!fs.existsSync(source)) {
        return;
    }

    ensureDirectory(destination);

    const entries = fs.readdirSync(
        source,
        {
            withFileTypes: true
        }
    );

    for (const entry of entries) {
        const sourcePath = path.join(
            source,
            entry.name
        );

        const destinationPath = path.join(
            destination,
            entry.name
        );

        if (entry.isDirectory()) {
            copyDirectory(
                sourcePath,
                destinationPath,
                options
            );

            continue;
        }

        if (
            options.excludeHtml === true &&
            entry.name.toLowerCase().endsWith('.html')
        ) {
            continue;
        }

        fs.copyFileSync(
            sourcePath,
            destinationPath
        );
    }
}

function copyFile(
    source,
    destination
) {
    if (!fs.existsSync(source)) {
        throw new Error(
            `Required source file not found: ${source}`
        );
    }

    ensureDirectory(
        path.dirname(destination)
    );

    fs.copyFileSync(
        source,
        destination
    );
}

function createSpaRouteAlias(routePath) {
    const source = path.join(
        OUTPUT_DIR,
        'index.html'
    );

    const destination = path.join(
        OUTPUT_DIR,
        ...routePath.split('/').filter(Boolean),
        'index.html'
    );

    copyFile(
        source,
        destination
    );
}

function injectNativeRuntimeIntoHtml() {
    const runtimeTag = [
        '<script src="/js/yh-native-runtime.js?v=20261009-vite-react-native"></script>',
        '<script src="/js/yh-native-session.js?v=20261009-vite-react-native"></script>'
    ].join('\n    ');

    function walk(directory) {
        const entries = fs.readdirSync(
            directory,
            {
                withFileTypes: true
            }
        );

        for (const entry of entries) {
            const fullPath = path.join(
                directory,
                entry.name
            );

            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }

            if (
                !entry.isFile() ||
                !entry.name
                    .toLowerCase()
                    .endsWith('.html')
            ) {
                continue;
            }

            let html = fs.readFileSync(
                fullPath,
                'utf8'
            );

            const mobileViewportContent =
                'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

            const viewportMetaPattern =
                /<meta\b(?=[^>]*\bname=["']viewport["'])[^>]*>/i;

            if (
                viewportMetaPattern.test(html)
            ) {
                html = html.replace(
                    viewportMetaPattern,
                    `<meta name="viewport" content="${mobileViewportContent}">`
                );
            } else if (
                /<head(?:\s[^>]*)?>/i.test(html)
            ) {
                html = html.replace(
                    /<head(?:\s[^>]*)?>/i,
                    (headTag) =>
                        `${headTag}\n    <meta name="viewport" content="${mobileViewportContent}">`
                );
            }

            const alreadyHasRuntime =
                html.includes(
                    '/js/yh-native-runtime.js'
                );

            if (!alreadyHasRuntime) {
                if (!/<\/head>/i.test(html)) {
                    throw new Error(
                        `No </head> found in native HTML: ${fullPath}`
                    );
                }

                html = html.replace(
                    /<\/head>/i,
                    `    ${runtimeTag}\n</head>`
                );
            }

            fs.writeFileSync(
                fullPath,
                html,
                'utf8'
            );
        }
    }

    walk(OUTPUT_DIR);
}


const LEGACY_REFERENCE_ARTIFACTS = [
    'apply.html',
    'dashboard.html',
    'academy.html',
    'plaza.html',
    'federation.html',
    'business-chats.html',

    'js/apply.js',
    'js/dashboard.js',
    'js/academy.js',
    'js/plaza.js',
    'js/federation.js',
    'js/business-chats.js',

    'css/plaza.css',
    'css/federation.css',
    'css/business-chats.css'
];

function stripLegacyReferenceArtifacts(
    directory
) {
    let removed = 0;

    for (
        const relativePath
        of LEGACY_REFERENCE_ARTIFACTS
    ) {
        const target =
            path.join(
                directory,
                ...relativePath
                    .split('/')
            );

        if (
            !fs.existsSync(
                target
            )
        ) {
            continue;
        }

        fs.rmSync(
            target,
            {
                force: true
            }
        );

        removed += 1;
    }

    console.log(
        `[YHU Mobile] Removed ${removed} generated legacy reference artifact(s).`
    );
}

/* YHU_MOBILE_STRIP_LEGACY_REFERENCE_ARTIFACTS */

function writeBuildMetadata() {
    const metadata = {
        app: 'Young Hustlers Universe',
        target: 'capacitor',
        generatedAt:
            new Date().toISOString(),
        source: 'frontend/dist',
        output: 'mobile-public',
        frontend: 'vite-react'
    };

    fs.writeFileSync(
        path.join(
            OUTPUT_DIR,
            'mobile-build.json'
        ),
        JSON.stringify(
            metadata,
            null,
            2
        ),
        'utf8'
    );
}

function build() {
    console.log(
        '[YHU Mobile] Building Vite React native bundle...'
    );

    if (
        !fs.existsSync(
            path.join(
                VITE_DIST_DIR,
                'index.html'
            )
        )
    ) {
        throw new Error(
            'frontend/dist/index.html is missing. Run the Vite production build first.'
        );
    }

    console.log(
        '[YHU Mobile] Cleaning mobile-public...'
    );

    removeDirectory(
        OUTPUT_DIR
    );

    ensureDirectory(
        OUTPUT_DIR
    );

    console.log(
        '[YHU Mobile] Copying frontend/dist...'
    );

    copyDirectory(
        VITE_DIST_DIR,
        OUTPUT_DIR
    );

    /*
     * Remove legacy standalone HTML owners.
     * The Vite React SPA owns these routes now.
     */
    const legacyHtmlFiles = [
        'academy.html',
        'apply.html',
        'business-chats.html',
        'dashboard.html',
        'federation.html',
        'plaza.html'
    ];

    for (const legacyHtmlFile of legacyHtmlFiles) {
        const legacyHtmlPath = path.join(
            OUTPUT_DIR,
            legacyHtmlFile
        );

        if (fs.existsSync(legacyHtmlPath)) {
            fs.rmSync(
                legacyHtmlPath,
                {
                    force: true
                }
            );
        }
    }

    /*
     * Keep native-only runtime/session files on top
     * of the generated Vite application.
     */
    if (
        fs.existsSync(
            MOBILE_SRC_DIR
        )
    ) {
        console.log(
            '[YHU Mobile] Applying native-specific files...'
        );

        copyDirectory(
            MOBILE_SRC_DIR,
            OUTPUT_DIR,
            {
                excludeHtml: true
            }
        );
    }

    stripLegacyReferenceArtifacts(
        OUTPUT_DIR
    );

    /*
     * BrowserRouter routes need physical aliases when
     * Capacitor reloads a clean URL directly.
     */
    const routeAliases = [
        'dashboard',

        'academy',
        'academy/roadmap',
        'academy/missions',
        'academy/community',
        'academy/messages',
        'academy/voice',

        'plaza',
        'plaza/explorer',
        'plaza/feed',
        'plaza/inbox',
        'plaza/conversations',
        'plaza/meetups',
        'plaza/opportunities',
        'plaza/directory',
        'plaza/regions',
        'plaza/atlas',
        'plaza/patron',
        'plaza/patron-desk',
        'plaza/bridge',
        'plaza/requests',

        'federation',
        'federation/command',
        'federation/connect',
        'federation/deal-rooms',
        'federation/directory',
        'federation/requests',
        'federation/referrals',
        'federation/access',

        'business-chats',
        'profile',
        'wallet',
        'settings'
    ];

    for (const routePath of routeAliases) {
        createSpaRouteAlias(
            routePath
        );
    }

    injectNativeRuntimeIntoHtml();

    /*
     * Build must never finish with legacy HTML owners.
     */
    const forbiddenLegacyHtml = [
        'academy.html',
        'apply.html',
        'business-chats.html',
        'dashboard.html',
        'federation.html',
        'plaza.html'
    ];

    const remainingLegacyHtml =
        forbiddenLegacyHtml.filter(
            (fileName) =>
                fs.existsSync(
                    path.join(
                        OUTPUT_DIR,
                        fileName
                    )
                )
        );

    if (remainingLegacyHtml.length > 0) {
        throw new Error(
            `Legacy mobile HTML remains: ${remainingLegacyHtml.join(', ')}`
        );
    }

    writeBuildMetadata();

    if (
        !fs.existsSync(
            path.join(
                OUTPUT_DIR,
                'index.html'
            )
        )
    ) {
        throw new Error(
            'Mobile build failed: mobile-public/index.html is missing.'
        );
    }

    console.log(
        '[YHU Mobile] Vite React mobile bundle complete.'
    );

    console.log(
        `Output: ${OUTPUT_DIR}`
    );
}

try {
    build();
} catch (error) {
    console.error(
        '[YHU Mobile] Build failed:',
        error?.message || error
    );

    process.exit(1);
}
