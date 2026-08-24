const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FRONTEND_DIRS = [
    'public',
    'private'
];

const IGNORE_DIRS = new Set([
    'node_modules',
    '.git',
    'mobile-public',
    'dist',
    'build',
    'coverage'
]);

function walk(dir, predicate, out = []) {
    if (!fs.existsSync(dir)) {
        return out;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (
            entry.name.startsWith('.') &&
            entry.name !== '.well-known'
        ) {
            continue;
        }

        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (!IGNORE_DIRS.has(entry.name)) {
                walk(full, predicate, out);
            }

            continue;
        }

        if (predicate(full)) {
            out.push(full);
        }
    }

    return out;
}

function relativePath(file) {
    return path
        .relative(ROOT, file)
        .replace(/\\/g, '/');
}

function getLineNumber(text, index) {
    return text
        .slice(0, index)
        .split(/\r?\n/)
        .length;
}

function parseAttributes(raw) {
    const attrs = {};

    const regex =
        /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

    let match;

    while ((match = regex.exec(raw))) {
        const name =
            String(match[1] || '')
                .toLowerCase();

        if (
            !name ||
            name === 'button'
        ) {
            continue;
        }

        attrs[name] =
            match[2] ??
            match[3] ??
            match[4] ??
            '';
    }

    return attrs;
}

function escapeRegExp(value) {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
    );
}

function dataAttributeToDataset(name) {
    return name
        .replace(/^data-/, '')
        .split('-')
        .map(
            (part, index) =>
                index === 0
                    ? part
                    : part.charAt(0).toUpperCase() +
                      part.slice(1)
        )
        .join('');
}

const htmlFiles =
    FRONTEND_DIRS.flatMap(
        (dir) =>
            walk(
                path.join(ROOT, dir),
                (file) =>
                    /\.html?$/i.test(file)
            )
    );

const jsFiles =
    FRONTEND_DIRS.flatMap(
        (dir) =>
            walk(
                path.join(ROOT, dir),
                (file) =>
                    /\.(?:js|mjs|cjs)$/i.test(file)
            )
    );

let javascriptCorpus = '';

for (const file of jsFiles) {
    javascriptCorpus +=
        '\n' +
        fs.readFileSync(
            file,
            'utf8'
        );
}

/*
 * Include inline <script> blocks because some
 * frontend handlers live directly inside HTML.
 */
for (const file of htmlFiles) {
    const html =
        fs.readFileSync(
            file,
            'utf8'
        );

    const scriptRegex =
        /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

    let match;

    while (
        (match =
            scriptRegex.exec(html))
    ) {
        javascriptCorpus +=
            '\n' +
            (match[1] || '');
    }
}

const buttons = [];

for (const file of htmlFiles) {
    const html =
        fs.readFileSync(
            file,
            'utf8'
        );

    /*
     * Determine whether a button belongs to a form.
     */
    const formRanges = [];

    const formRegex =
        /<form\b[^>]*>[\s\S]*?<\/form>/gi;

    let formMatch;

    while (
        (formMatch =
            formRegex.exec(html))
    ) {
        formRanges.push([
            formMatch.index,
            formRegex.lastIndex
        ]);
    }

    const buttonRegex =
        /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;

    let match;

    while (
        (match =
            buttonRegex.exec(html))
    ) {
        const attrs =
            parseAttributes(
                match[1] || ''
            );

        const text =
            (match[2] || '')
                .replace(
                    /<[^>]+>/g,
                    ' '
                )
                .replace(
                    /\s+/g,
                    ' '
                )
                .trim();

        const insideForm =
            formRanges.some(
                ([start, end]) =>
                    match.index >= start &&
                    match.index < end
            );

        buttons.push({
            file,
            line:
                getLineNumber(
                    html,
                    match.index
                ),
            attrs,
            text:
                text.slice(
                    0,
                    100
                ),
            insideForm
        });
    }
}

const strongOrphans = [];
const unverified = [];

let intrinsicCount = 0;
let wiredCount = 0;

for (const button of buttons) {
    const attrs =
        button.attrs;

    const type =
        String(
            attrs.type || ''
        ).toLowerCase();

    /*
     * Inline/native actions.
     */
    if (
        attrs.onclick !== undefined ||
        attrs.formaction !== undefined ||
        type === 'reset'
    ) {
        intrinsicCount++;
        continue;
    }

    /*
     * A submit button only counts as intrinsically
     * functional when it actually belongs to a form.
     */
    const nativeSubmit =
        (
            type === 'submit' ||
            type === ''
        ) &&
        (
            button.insideForm ||
            attrs.form !== undefined
        );

    if (nativeSubmit) {
        intrinsicCount++;
        continue;
    }

    const evidence = [];

    /*
     * ID-based handler/reference detection.
     */
    if (attrs.id) {
        const id =
            attrs.id;

        const patterns = [
            new RegExp(
                `getElementById\\(\\s*['"]${escapeRegExp(id)}['"]\\s*\\)`
            ),

            new RegExp(
                `querySelector(?:All)?\\(\\s*['"][^'"]*#${escapeRegExp(id)}(?:[^A-Za-z0-9_-]|['"])`
            ),

            new RegExp(
                `closest\\(\\s*['"][^'"]*#${escapeRegExp(id)}(?:[^A-Za-z0-9_-]|['"])`
            ),

            new RegExp(
                `['"]#${escapeRegExp(id)}['"]`
            ),

            new RegExp(
                `['"]${escapeRegExp(id)}['"]`
            )
        ];

        if (
            patterns.some(
                (regex) =>
                    regex.test(
                        javascriptCorpus
                    )
            )
        ) {
            evidence.push(
                `id:${id}`
            );
        }
    }

    /*
     * data-action dispatcher detection.
     */
    if (
        attrs['data-action']
    ) {
        const action =
            attrs['data-action'];

        const regex =
            new RegExp(
                `['"]${escapeRegExp(action)}['"]`
            );

        if (
            regex.test(
                javascriptCorpus
            )
        ) {
            evidence.push(
                `data-action:${action}`
            );
        }
    }

    /*
     * Other delegated data-* controls.
     *
     * Supports both:
     *
     * [data-example-action]
     *
     * and:
     *
     * element.dataset.exampleAction
     */
    for (
        const name of
        Object.keys(attrs)
            .filter(
                (key) =>
                    key.startsWith('data-') &&
                    key !== 'data-action'
            )
    ) {
        const datasetName =
            dataAttributeToDataset(
                name
            );

        const patterns = [
            new RegExp(
                escapeRegExp(name)
            ),

            new RegExp(
                `dataset\\.${escapeRegExp(datasetName)}\\b`
            ),

            new RegExp(
                `dataset\\[['"]${escapeRegExp(datasetName)}['"]\\]`
            )
        ];

        if (
            patterns.some(
                (regex) =>
                    regex.test(
                        javascriptCorpus
                    )
            )
        ) {
            evidence.push(
                name
            );
        }
    }

    /*
     * Class-based handler/reference detection.
     *
     * Some controls intentionally have no ID or data-action
     * and are wired through delegated/class selectors such as:
     *
     * document.querySelectorAll('.btn-focus-mode')
     * target.closest('.btn-focus-mode')
     */
    if (attrs.class) {
        const classNames =
            String(attrs.class)
                .split(/\s+/)
                .map(
                    (value) =>
                        value.trim()
                )
                .filter(Boolean);

        for (const className of classNames) {
            const escapedClass =
                escapeRegExp(
                    className
                );

            const patterns = [
                new RegExp(
                    `querySelector(?:All)?\\(\\s*['"][^'"]*\\.${escapedClass}(?:[^A-Za-z0-9_-]|['"])`
                ),

                new RegExp(
                    `closest\\(\\s*['"][^'"]*\\.${escapedClass}(?:[^A-Za-z0-9_-]|['"])`
                ),

                new RegExp(
                    `matches\\(\\s*['"][^'"]*\\.${escapedClass}(?:[^A-Za-z0-9_-]|['"])`
                ),

                new RegExp(
                    `getElementsByClassName\\(\\s*['"]${escapedClass}['"]\\s*\\)`
                ),

                new RegExp(
                    `['"]\\.${escapedClass}['"]`
                )
            ];

            if (
                patterns.some(
                    (regex) =>
                        regex.test(
                            javascriptCorpus
                        )
                )
            ) {
                evidence.push(
                    `class:${className}`
                );
            }
        }
    }

    if (evidence.length) {
        wiredCount++;
        continue;
    }

    /*
     * Strong orphan:
     *
     * The button exposes an ID/data action that is
     * supposed to be wired, but no frontend handler
     * evidence exists anywhere.
     */
    if (
        attrs.id ||
        attrs['data-action'] ||
        Object
            .keys(attrs)
            .some(
                (key) =>
                    key.startsWith(
                        'data-'
                    )
            )
    ) {
        strongOrphans.push(
            button
        );

        continue;
    }

    /*
     * Class-only controls aren't automatically failed.
     * They may legitimately use class-level delegation.
     */
    unverified.push(
        button
    );
}

console.log('');
console.log(
    '=============================================='
);

console.log(
    ' YH FRONTEND CONTROL AUDIT'
);

console.log(
    '=============================================='
);

console.log(
    `HTML files scanned        : ${htmlFiles.length}`
);

console.log(
    `Frontend JS files scanned : ${jsFiles.length}`
);

console.log(
    `Static <button> scanned   : ${buttons.length}`
);

console.log(
    `Native/intrinsic actions  : ${intrinsicCount}`
);

console.log(
    `Handler evidence found    : ${wiredCount}`
);

console.log(
    `Strong orphan candidates  : ${strongOrphans.length}`
);

console.log(
    `Unverified class-only     : ${unverified.length}`
);

console.log('');

if (
    strongOrphans.length
) {
    console.error(
        'FAIL: Strong orphan button candidates found:'
    );

    for (
        const button of
        strongOrphans
    ) {
        const id =
            button.attrs.id
                ? ` id="${button.attrs.id}"`
                : '';

        const action =
            button.attrs['data-action']
                ? ` data-action="${button.attrs['data-action']}"`
                : '';

        console.error(
            `- ${relativePath(button.file)}:${button.line}${id}${action} :: ${button.text || '(no text)'}`
        );
    }

    process.exitCode = 1;
} else {
    console.log(
        'PASS: No strong orphan button candidates found.'
    );
}

if (
    unverified.length
) {
    console.log('');
    console.log(
        'INFO: Class-only buttons are not treated as failures because they may use delegated/class handlers.'
    );

    console.log(
        `INFO: ${unverified.length} class-only button(s) require runtime/UI verification.`
    );

    console.log('');
    console.log(
        'Unverified class-only controls:'
    );

    for (const button of unverified) {
        const className =
            button.attrs.class
                ? ` class="${button.attrs.class}"`
                : '';

        console.log(
            `- ${relativePath(button.file)}:${button.line}${className} :: ${button.text || '(no text)'}`
        );
    }
}
