function sanitize(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function decodeHtmlEntities(input = '') {
    return String(input)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&#(\d+);/g, (_, code) => {
            const n = Number.parseInt(code, 10);
            return Number.isFinite(n) ? String.fromCharCode(n) : '';
        });
}

function normalizeWhitespace(input = '') {
    return String(input)
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/[ \u00A0]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function stripDangerousHtml(html = '') {
    return String(html)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
        .replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, ' ')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
        .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, ' ');
}

function pickPreferredContainer(html = '') {
    const preferredPatterns = [
        /<article\b[^>]*>([\s\S]*?)<\/article>/i,
        /<main\b[^>]*>([\s\S]*?)<\/main>/i,
        /<section\b[^>]*>([\s\S]*?)<\/section>/i,
        /<body\b[^>]*>([\s\S]*?)<\/body>/i
    ];

    for (const pattern of preferredPatterns) {
        const match = html.match(pattern);
        if (match?.[1]) return match[1];
    }

    return html;
}

function extractMetaContent(html = '', key = '') {
    const patterns = [
        new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, 'i')
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return decodeHtmlEntities(match[1]).trim();
    }

    return '';
}

function extractTitle(html = '') {
    const ogTitle = extractMetaContent(html, 'og:title');
    if (ogTitle) return ogTitle;

    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match?.[1] ? decodeHtmlEntities(match[1]).trim() : '';
}

function htmlToText(html = '') {
    const withBreaks = String(html)
        .replace(/<\/(h1|h2|h3|h4|h5|h6|p|div|section|article|li|ul|ol|blockquote|pre)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li\b[^>]*>/gi, '\n• ')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/td>/gi, ' ')
        .replace(/<\/th>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');

    return normalizeWhitespace(decodeHtmlEntities(withBreaks));
}
function extractTimeMeta(html = '', keys = []) {
    for (const key of Array.isArray(keys) ? keys : []) {
        const value = extractMetaContent(html, key);
        if (value) return value;
    }
    return '';
}
function cleanTextBlocks(text = '') {
    const blockedPatterns = [
        /cookie/i,
        /privacy policy/i,
        /terms of service/i,
        /subscribe/i,
        /sign up/i,
        /newsletter/i,
        /advertisement/i,
        /all rights reserved/i,
        /enable javascript/i
    ];

    const seen = new Set();
    const blocks = String(text)
        .split(/\n{2,}/)
        .map((block) => normalizeWhitespace(block))
        .filter((block) => block.length >= 60)
        .filter((block) => !blockedPatterns.some((pattern) => pattern.test(block)))
        .filter((block) => {
            const key = block.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

    return normalizeWhitespace(blocks.join('\n\n'));
}

function buildExcerpt(text = '', maxLength = 320) {
    const clean = normalizeWhitespace(text);
    if (clean.length <= maxLength) return clean;
    return `${clean.slice(0, maxLength).trim()}…`;
}

async function fetchWithTimeout(url, timeoutMs = 18000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; YH-AI-Nurture/1.0)',
                Accept: 'text/html, text/plain;q=0.9, */*;q=0.8'
            }
        });

        const text = await response.text();
        return { response, text };
    } finally {
        clearTimeout(timeout);
    }
}

async function extractFromUrl(url, options = {}) {
    const normalizedUrl = sanitize(url);
    if (!normalizedUrl) {
        throw new Error('URL is required for extraction.');
    }

    const { response, text: rawHtml } = await fetchWithTimeout(
        normalizedUrl,
        Number.parseInt(options.timeoutMs, 10) || 18000
    );

    if (!response.ok) {
        throw new Error(`Source fetch failed with status ${response.status}.`);
    }

    const finalUrl = sanitize(response.url || normalizedUrl);
    const contentType = sanitize(response.headers.get('content-type') || '');

    const rawText =
        /text\/plain/i.test(contentType)
            ? normalizeWhitespace(rawHtml)
            : htmlToText(
                pickPreferredContainer(
                    stripDangerousHtml(rawHtml)
                        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
                        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
                        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
                        .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
                )
            );

    const cleanText = cleanTextBlocks(rawText).slice(0, 30000);
    if (!cleanText || cleanText.length < 180) {
        throw new Error('Extracted content is too thin to analyze safely.');
    }

    const title = extractTitle(rawHtml) || finalUrl;
    const description =
        extractMetaContent(rawHtml, 'description') ||
        extractMetaContent(rawHtml, 'og:description');

    const siteName = extractMetaContent(rawHtml, 'og:site_name');
    const languageMatch = rawHtml.match(/<html[^>]+lang=["']([^"']+)["']/i);
    const image =
        extractMetaContent(rawHtml, 'og:image') ||
        extractMetaContent(rawHtml, 'twitter:image');

    const publishedAt =
        extractTimeMeta(rawHtml, [
            'article:published_time',
            'published_time',
            'publish_date',
            'datePublished'
        ]);

    const modifiedAt =
        extractTimeMeta(rawHtml, [
            'article:modified_time',
            'og:updated_time',
            'updated_time',
            'dateModified'
        ]);

    return {
        finalUrl,
        httpStatus: response.status,
        contentType,
        title,
        description,
        siteName,
        language: sanitize(languageMatch?.[1] || ''),
        mainImage: image,
        publishedAt,
        modifiedAt,
        rawTextChars: rawText.length,
        cleanTextChars: cleanText.length,
        cleanText,
        excerpt: buildExcerpt(cleanText),
        fetchStatus: 'success'
    };
}

module.exports = {
    extractFromUrl
};