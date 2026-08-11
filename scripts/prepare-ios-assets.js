const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

async function resizeSquare(
    filename,
    size
) {
    const source =
        path.join(
            ASSETS,
            filename
        );

    const temp =
        path.join(
            ASSETS,
            `.${filename}.tmp.png`
        );

    await sharp(source)
        .resize(
            size,
            size,
            {
                fit: 'cover',
                position: 'centre',
                kernel: sharp.kernel.lanczos3
            }
        )
        .png({
            compressionLevel: 9
        })
        .toFile(temp);

    await sharp(temp)
        .toFile(source);

    require('fs').unlinkSync(
        temp
    );

    console.log(
        `✅ ${filename} → ${size}x${size}`
    );
}

(async () => {
    await resizeSquare(
        'icon-only.png',
        1024
    );

    await resizeSquare(
        'splash.png',
        2732
    );

    await resizeSquare(
        'splash-dark.png',
        2732
    );

    console.log(
        '✅ iOS source assets prepared.'
    );
})().catch((error) => {
    console.error(
        '❌ Asset preparation failed:',
        error
    );

    process.exit(1);
});