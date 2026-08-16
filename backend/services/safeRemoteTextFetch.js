const dns = require('dns');
const http = require('http');
const https = require('https');
const net = require('net');

/*
 * Keep IPv4 and IPv6 rules in separate BlockLists.
 *
 * Mixing IPv6 mapped-address ranges such as ::/96
 * into the same BlockList can cause valid public
 * IPv4 addresses to be classified as blocked.
 */
const BLOCKED_IPV4 =
    new net.BlockList();

const BLOCKED_IPV6 =
    new net.BlockList();

[
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
].forEach(([network, prefix]) => {
    BLOCKED_IPV4.addSubnet(
        network,
        prefix,
        'ipv4'
    );
});

[
    /*
     * Unspecified / loopback.
     */
    ['::', 128],
    ['::1', 128],

    /*
     * Discard-only / documentation.
     */
    ['100::', 64],
    ['2001:db8::', 32],

    /*
     * Unique-local / link-local / multicast.
     */
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8]
].forEach(([network, prefix]) => {
    BLOCKED_IPV6.addSubnet(
        network,
        prefix,
        'ipv6'
    );
});

function createSafeFetchError(
    message,
    code = 'safe_remote_fetch_error',
    statusCode = 400
) {
    const error = new Error(message);

    error.code = code;
    error.statusCode = statusCode;

    return error;
}

function normalizeHostname(
    value = ''
) {
    let clean =
        String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\.+$/, '');

    if (
        clean.startsWith('[') &&
        clean.endsWith(']')
    ) {
        clean =
            clean.slice(1, -1);
    }

    return clean;
}

function isBlockedIpAddress(
    value = ''
) {
    const address =
        normalizeHostname(value);

    const family =
        net.isIP(address);

    if (family === 4) {
        return BLOCKED_IPV4.check(
            address,
            'ipv4'
        );
    }

    if (family === 6) {
        return BLOCKED_IPV6.check(
            address,
            'ipv6'
        );
    }

    return true;
}

function isBlockedHostname(
    value = ''
) {
    const hostname =
        normalizeHostname(value);

    if (!hostname) {
        return true;
    }

    if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.localdomain') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.home.arpa') ||
        hostname === 'metadata' ||
        hostname ===
            'metadata.google.internal'
    ) {
        return true;
    }

    if (net.isIP(hostname)) {
        return isBlockedIpAddress(
            hostname
        );
    }

    /*
     * Single-label names can resolve through
     * local DNS search suffixes.
     */
    return !hostname.includes('.');
}

function normalizeRemoteHttpUrl(
    value = ''
) {
    let parsed;

    try {
        parsed =
            new URL(
                String(value || '')
                    .trim()
            );
    } catch (_) {
        throw createSafeFetchError(
            'A valid public http(s) URL is required.',
            'invalid_remote_url'
        );
    }

    if (
        parsed.protocol !== 'http:' &&
        parsed.protocol !== 'https:'
    ) {
        throw createSafeFetchError(
            'Only http:// and https:// remote URLs are allowed.',
            'invalid_remote_protocol'
        );
    }

    if (
        parsed.username ||
        parsed.password
    ) {
        throw createSafeFetchError(
            'Remote URLs with embedded credentials are not allowed.',
            'remote_url_credentials_denied'
        );
    }

    parsed.hash = '';

    if (
        isBlockedHostname(
            parsed.hostname
        )
    ) {
        throw createSafeFetchError(
            'Private, local, reserved, or metadata network targets are not allowed.',
            'private_network_target_denied'
        );
    }

    return parsed;
}

async function resolvePublicAddress(
    parsedUrl
) {
    const hostname =
        normalizeHostname(
            parsedUrl.hostname
        );

    if (net.isIP(hostname)) {
        if (
            isBlockedIpAddress(
                hostname
            )
        ) {
            throw createSafeFetchError(
                'Private, local, reserved, or metadata network targets are not allowed.',
                'private_network_target_denied'
            );
        }

        return {
            address: hostname,
            family:
                net.isIP(hostname)
        };
    }

    let addresses;

    try {
        addresses =
            await dns.promises.lookup(
                hostname,
                {
                    all: true,
                    verbatim: true
                }
            );
    } catch (_) {
        throw createSafeFetchError(
            'Remote hostname could not be resolved.',
            'remote_dns_failed',
            502
        );
    }

    const usable =
        (
            Array.isArray(addresses)
                ? addresses
                : []
        ).filter(
            (entry) =>
                entry?.address &&
                net.isIP(
                    entry.address
                )
        );

    if (!usable.length) {
        throw createSafeFetchError(
            'Remote hostname did not resolve to a usable address.',
            'remote_dns_empty',
            502
        );
    }

    /*
     * Reject the whole hostname if ANY DNS
     * answer points to a private/reserved IP.
     */
    if (
        usable.some(
            (entry) =>
                isBlockedIpAddress(
                    entry.address
                )
        )
    ) {
        throw createSafeFetchError(
            'Remote hostname resolves to a private, local, reserved, or metadata address.',
            'private_network_dns_denied'
        );
    }

    /*
     * Prefer IPv4 when both are public,
     * avoiding IPv6-only connectivity issues.
     */
    return (
        usable.find(
            (entry) =>
                Number(
                    entry.family
                ) === 4
        ) ||
        usable[0]
    );
}

function normalizeContentType(
    value = ''
) {
    return String(value || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
}

function isAllowedContentType(
    value = ''
) {
    const contentType =
        normalizeContentType(
            value
        );

    if (!contentType) {
        return true;
    }

    return [
        'text/html',
        'text/plain',
        'application/xhtml+xml',
        'application/json',
        'application/xml',
        'text/xml'
    ].includes(
        contentType
    );
}

async function requestOnce(
    parsedUrl,
    options = {}
) {
    const resolved =
        await resolvePublicAddress(
            parsedUrl
        );

    const transport =
        parsedUrl.protocol ===
        'https:'
            ? https
            : http;

    const maxBytes =
        Math.max(
            1024,
            Number(
                options.maxBytes ||
                2 * 1024 * 1024
            )
        );

    const timeoutMs =
        Math.max(
            1000,
            Number(
                options.timeoutMs ||
                18000
            )
        );

    return new Promise(
        (resolve, reject) => {
            let settled = false;

            const fail =
                (error) => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    reject(error);
                };

            const req =
                transport.request(
                    parsedUrl,
                    {
                        method: 'GET',

                        headers: {
                            'User-Agent':
                                options
                                    .userAgent ||
                                'Mozilla/5.0 (compatible; YH-Safe-Remote-Fetch/1.0)',

                            Accept:
                                options
                                    .accept ||
                                'text/html,text/plain;q=0.9,application/xhtml+xml;q=0.8,*/*;q=0.2'
                        },

                        /*
                         * Pin the actual connection to the
                         * already-validated DNS answer.
                         *
                         * This avoids DNS rebinding between
                         * validation and connection.
                         */
                        lookup(
                            _hostname,
                            lookupOptions,
                            callback
                        ) {
                            if (
                                lookupOptions
                                    ?.all
                            ) {
                                return callback(
                                    null,
                                    [resolved]
                                );
                            }

                            return callback(
                                null,
                                resolved.address,
                                resolved.family
                            );
                        }
                    },

                    (res) => {
                        const status =
                            Number(
                                res.statusCode ||
                                0
                            );

                        const location =
                            String(
                                res.headers
                                    .location ||
                                ''
                            ).trim();

                        if (
                            [
                                301,
                                302,
                                303,
                                307,
                                308
                            ].includes(
                                status
                            ) &&
                            location
                        ) {
                            res.resume();

                            settled =
                                true;

                            return resolve({
                                status,
                                headers:
                                    res.headers,
                                redirectLocation:
                                    location
                            });
                        }

                        const contentType =
                            String(
                                res.headers[
                                    'content-type'
                                ] || ''
                            );

                        if (
                            !isAllowedContentType(
                                contentType
                            )
                        ) {
                            res.destroy();

                            return fail(
                                createSafeFetchError(
                                    `Remote content type is not allowed: ${normalizeContentType(contentType) || 'unknown'}.`,
                                    'remote_content_type_denied',
                                    415
                                )
                            );
                        }

                        const contentLength =
                            Number(
                                res.headers[
                                    'content-length'
                                ] || 0
                            );

                        if (
                            Number.isFinite(
                                contentLength
                            ) &&
                            contentLength >
                                maxBytes
                        ) {
                            res.destroy();

                            return fail(
                                createSafeFetchError(
                                    'Remote response exceeds the allowed size limit.',
                                    'remote_response_too_large',
                                    413
                                )
                            );
                        }

                        const chunks = [];
                        let totalBytes = 0;

                        res.on(
                            'data',
                            (chunk) => {
                                totalBytes +=
                                    chunk.length;

                                if (
                                    totalBytes >
                                    maxBytes
                                ) {
                                    res.destroy();

                                    return fail(
                                        createSafeFetchError(
                                            'Remote response exceeds the allowed size limit.',
                                            'remote_response_too_large',
                                            413
                                        )
                                    );
                                }

                                chunks.push(
                                    chunk
                                );
                            }
                        );

                        res.on(
                            'end',
                            () => {
                                if (
                                    settled
                                ) {
                                    return;
                                }

                                settled =
                                    true;

                                resolve({
                                    status,

                                    ok:
                                        status >=
                                            200 &&
                                        status <
                                            300,

                                    headers:
                                        res.headers,

                                    text:
                                        Buffer
                                            .concat(
                                                chunks
                                            )
                                            .toString(
                                                'utf8'
                                            )
                                });
                            }
                        );

                        res.on(
                            'error',
                            fail
                        );
                    }
                );

            req.setTimeout(
                timeoutMs,
                () => {
                    req.destroy(
                        createSafeFetchError(
                            'Remote request timed out.',
                            'remote_request_timeout',
                            504
                        )
                    );
                }
            );

            req.on(
                'error',
                (error) => {
                    if (
                        error
                            ?.statusCode
                    ) {
                        return fail(
                            error
                        );
                    }

                    return fail(
                        createSafeFetchError(
                            error?.message ||
                                'Remote request failed.',
                            'remote_request_failed',
                            502
                        )
                    );
                }
            );

            req.end();
        }
    );
}

async function fetchText(
    value = '',
    options = {}
) {
    const maxRedirects =
        Math.max(
            0,
            Math.min(
                10,
                Number(
                    options
                        .maxRedirects ??
                    5
                )
            )
        );

    const totalTimeoutMs =
        Math.max(
            1000,
            Number(
                options.timeoutMs ||
                18000
            )
        );

    const deadline =
        Date.now() +
        totalTimeoutMs;

    let currentUrl =
        normalizeRemoteHttpUrl(
            value
        );

    for (
        let redirectCount = 0;
        redirectCount <=
            maxRedirects;
        redirectCount += 1
    ) {
        const remainingMs =
            deadline -
            Date.now();

        if (
            remainingMs <= 0
        ) {
            throw createSafeFetchError(
                'Remote request timed out.',
                'remote_request_timeout',
                504
            );
        }

        const result =
            await requestOnce(
                currentUrl,
                {
                    ...options,
                    timeoutMs:
                        remainingMs
                }
            );

        if (
            result.redirectLocation
        ) {
            if (
                redirectCount >=
                maxRedirects
            ) {
                throw createSafeFetchError(
                    'Remote redirect limit exceeded.',
                    'remote_redirect_limit',
                    508
                );
            }

            let nextUrl;

            try {
                nextUrl =
                    new URL(
                        result
                            .redirectLocation,
                        currentUrl
                    );
            } catch (_) {
                throw createSafeFetchError(
                    'Remote redirect URL is invalid.',
                    'remote_redirect_invalid',
                    502
                );
            }

            /*
             * Revalidate every redirect target.
             */
            currentUrl =
                normalizeRemoteHttpUrl(
                    nextUrl.toString()
                );

            continue;
        }

        return {
            ...result,

            finalUrl:
                currentUrl
                    .toString(),

            contentType:
                String(
                    result.headers?.[
                        'content-type'
                    ] || ''
                )
        };
    }

    throw createSafeFetchError(
        'Remote redirect limit exceeded.',
        'remote_redirect_limit',
        508
    );
}

module.exports = {
    fetchText,
    normalizeRemoteHttpUrl,
    isBlockedHostname,
    isBlockedIpAddress
};
