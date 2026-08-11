const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'filetree.json');

const EXCLUDED = new Set([
    'node_modules',
    '.git',
    '.vercel',
    '.idea',
    '.vscode',
    'mobile-public',
    'dist',
    'build'
]);

function shouldExclude(name) {
    if (EXCLUDED.has(name)) {
        return true;
    }

    if (
        name === '.env' ||
        name.startsWith('.env.') ||
        name.endsWith('.log')
    ) {
        return true;
    }

    return false;
}

function buildTree(directory) {
    let entries = [];

    try {
        entries = fs.readdirSync(
            directory,
            {
                withFileTypes: true
            }
        );
    } catch (error) {
        return [];
    }

    entries.sort((a, b) => {
        if (
            a.isDirectory() &&
            !b.isDirectory()
        ) {
            return -1;
        }

        if (
            !a.isDirectory() &&
            b.isDirectory()
        ) {
            return 1;
        }

        return a.name.localeCompare(
            b.name
        );
    });

    return entries
        .filter(
            (entry) =>
                !shouldExclude(
                    entry.name
                )
        )
        .map((entry) => {
            const fullPath =
                path.join(
                    directory,
                    entry.name
                );

            if (entry.isDirectory()) {
                return {
                    name: entry.name,
                    type: 'folder',
                    children:
                        buildTree(
                            fullPath
                        )
                };
            }

            return {
                name: entry.name,
                type: 'file'
            };
        });
}

const output = {
    name: path.basename(ROOT),
    path: ROOT,
    type: 'directory',

    children:
        buildTree(ROOT),

    metadata: {
        generated:
            new Date()
                .toISOString(),

        generator:
            'YH custom filetree generator',

        version:
            '1.0.0'
    }
};

fs.writeFileSync(
    OUTPUT,
    JSON.stringify(
        output,
        null,
        2
    ),
    'utf8'
);

console.log(
    `✅ filetree.json updated:\n${OUTPUT}`
);