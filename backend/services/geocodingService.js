const https = require('https');
const { URL } = require('url');

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const toNumber = (value, fallback = NaN) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const nowIso = () => new Date().toISOString();

const normalizeGeoText = (value = '') => {
    return String(value || '').trim().replace(/\s+/g, ' ');
};

const COUNTRY_CENTROIDS = {
    nigeria: { country: 'Nigeria', countryCode: 'NG', lat: 9.0820, lng: 8.6753 },
    philippines: { country: 'Philippines', countryCode: 'PH', lat: 12.8797, lng: 121.7740 },
    india: { country: 'India', countryCode: 'IN', lat: 20.5937, lng: 78.9629 },
    'united states': { country: 'United States', countryCode: 'US', lat: 37.0902, lng: -95.7129 },
    canada: { country: 'Canada', countryCode: 'CA', lat: 56.1304, lng: -106.3468 },
    'united kingdom': { country: 'United Kingdom', countryCode: 'GB', lat: 55.3781, lng: -3.4360 },
    australia: { country: 'Australia', countryCode: 'AU', lat: -25.2744, lng: 133.7751 },
    singapore: { country: 'Singapore', countryCode: 'SG', lat: 1.3521, lng: 103.8198 },
    'south africa': { country: 'South Africa', countryCode: 'ZA', lat: -30.5595, lng: 22.9375 },
    'united arab emirates': { country: 'United Arab Emirates', countryCode: 'AE', lat: 23.4241, lng: 53.8478 },
    germany: { country: 'Germany', countryCode: 'DE', lat: 51.1657, lng: 10.4515 },
    france: { country: 'France', countryCode: 'FR', lat: 46.2276, lng: 2.2137 },
    spain: { country: 'Spain', countryCode: 'ES', lat: 40.4637, lng: -3.7492 },
    italy: { country: 'Italy', countryCode: 'IT', lat: 41.8719, lng: 12.5674 },
    brazil: { country: 'Brazil', countryCode: 'BR', lat: -14.2350, lng: -51.9253 },
    mexico: { country: 'Mexico', countryCode: 'MX', lat: 23.6345, lng: -102.5528 },
    japan: { country: 'Japan', countryCode: 'JP', lat: 36.2048, lng: 138.2529 },
    netherlands: { country: 'Netherlands', countryCode: 'NL', lat: 52.1326, lng: 5.2913 },
    sweden: { country: 'Sweden', countryCode: 'SE', lat: 60.1282, lng: 18.6435 },
    norway: { country: 'Norway', countryCode: 'NO', lat: 60.4720, lng: 8.4689 },
    kenya: { country: 'Kenya', countryCode: 'KE', lat: -0.0236, lng: 37.9062 },
    ghana: { country: 'Ghana', countryCode: 'GH', lat: 7.9465, lng: -1.0232 }
};

const COUNTRY_ALIASES = {
    ng: 'nigeria',
    nigeria: 'nigeria',
    ph: 'philippines',
    philippines: 'philippines',
    'the philippines': 'philippines',
    in: 'india',
    india: 'india',
    us: 'united states',
    usa: 'united states',
    'united states of america': 'united states',
    'united states': 'united states',
    ca: 'canada',
    canada: 'canada',
    gb: 'united kingdom',
    uk: 'united kingdom',
    england: 'united kingdom',
    britain: 'united kingdom',
    'great britain': 'united kingdom',
    'united kingdom': 'united kingdom',
    au: 'australia',
    australia: 'australia',
    sg: 'singapore',
    singapore: 'singapore',
    za: 'south africa',
    'south africa': 'south africa',
    ae: 'united arab emirates',
    uae: 'united arab emirates',
    'united arab emirates': 'united arab emirates',
    de: 'germany',
    germany: 'germany',
    fr: 'france',
    france: 'france',
    es: 'spain',
    spain: 'spain',
    it: 'italy',
    italy: 'italy',
    br: 'brazil',
    brazil: 'brazil',
    mx: 'mexico',
    mexico: 'mexico',
    jp: 'japan',
    japan: 'japan',
    nl: 'netherlands',
    netherlands: 'netherlands',
    se: 'sweden',
    sweden: 'sweden',
    no: 'norway',
    norway: 'norway',
    ke: 'kenya',
    kenya: 'kenya',
    gh: 'ghana',
    ghana: 'ghana'
};

function buildCountryFallback(city = '', country = '') {
    const cleanCity = normalizeGeoText(city);
    const cleanCountry = normalizeGeoText(country);
    const normalizedCountryKey =
        COUNTRY_ALIASES[cleanCountry.toLowerCase()] ||
        cleanCountry.toLowerCase();

    const geo = COUNTRY_CENTROIDS[normalizedCountryKey] || null;
    if (!geo) return null;

    return {
        city: cleanCity,
        cityNormalized: cleanCity.toLowerCase(),
        country: geo.country,
        countryNormalized: normalizedCountryKey,
        countryCode: geo.countryCode,
        lat: Number(geo.lat),
        lng: Number(geo.lng),
        geoSource: 'country_centroid_fallback',
        geoProvider: 'country_centroid_fallback',
        geoPrecision: 'country_centroid',
        geoConfidence: 0,
        geoDisplayName: [cleanCity, geo.country].filter(Boolean).join(', '),
        geoUpdatedAt: nowIso()
    };
}

function requestJson(url, headers = {}, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                headers,
                timeout: timeoutMs
            },
            (res) => {
                let raw = '';

                res.on('data', (chunk) => {
                    raw += chunk;
                });

                res.on('end', () => {
                    const statusCode = Number(res.statusCode || 0);

                    if (statusCode < 200 || statusCode >= 300) {
                        return reject(new Error(`Geocoding request failed with status ${statusCode}`));
                    }

                    try {
                        resolve(JSON.parse(raw || '{}'));
                    } catch (error) {
                        reject(new Error('Failed to parse geocoding JSON response.'));
                    }
                });
            }
        );

        req.on('timeout', () => {
            req.destroy(new Error('Geocoding request timed out.'));
        });

        req.on('error', reject);
    });
}

function buildNormalizedResult({
    city = '',
    country = '',
    countryCode = '',
    lat,
    lng,
    geoSource = '',
    geoProvider = '',
    geoPrecision = 'city',
    geoConfidence = null,
    geoDisplayName = ''
}) {
    const cleanCity = normalizeGeoText(city);
    const cleanCountry = normalizeGeoText(country);
    const cleanCountryCode = sanitizeText(countryCode).toUpperCase();

    const safeLat = toNumber(lat, NaN);
    const safeLng = toNumber(lng, NaN);

    if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) {
        return null;
    }

    return {
        city: cleanCity,
        cityNormalized: cleanCity.toLowerCase(),
        country: cleanCountry,
        countryNormalized: cleanCountry.toLowerCase(),
        countryCode: cleanCountryCode,
        lat: safeLat,
        lng: safeLng,
        geoSource,
        geoProvider,
        geoPrecision,
        ...(geoConfidence === null ? {} : { geoConfidence: Number(geoConfidence) || 0 }),
        geoDisplayName: sanitizeText(geoDisplayName) || [cleanCity, cleanCountry].filter(Boolean).join(', '),
        geoUpdatedAt: nowIso()
    };
}

async function geocodeWithOpenCage({ city = '', country = '' } = {}) {
    const apiKey = sanitizeText(process.env.OPENCAGE_API_KEY);
    if (!apiKey) return null;

    const query = [normalizeGeoText(city), normalizeGeoText(country)].filter(Boolean).join(', ');
    if (!query) return null;

    const url = new URL('https://api.opencagedata.com/geocode/v1/json');
    url.searchParams.set('q', query);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('limit', '1');
    url.searchParams.set('no_annotations', '1');
    url.searchParams.set('language', 'en');

    const data = await requestJson(url, {});
    const first = Array.isArray(data?.results) ? data.results[0] : null;
    if (!first?.geometry) return null;

    const components = first.components || {};

    return buildNormalizedResult({
        city:
            sanitizeText(components.city) ||
            sanitizeText(components.town) ||
            sanitizeText(components.village) ||
            sanitizeText(components.municipality) ||
            sanitizeText(city),
        country: sanitizeText(components.country) || sanitizeText(country),
        countryCode: sanitizeText(components.country_code).toUpperCase(),
        lat: first.geometry.lat,
        lng: first.geometry.lng,
        geoSource: 'opencage_city_geocode',
        geoProvider: 'opencage',
        geoPrecision: 'city',
        geoConfidence: toNumber(first.confidence, 0),
        geoDisplayName: sanitizeText(first.formatted)
    });
}

async function geocodeWithLocationIQ({ city = '', country = '' } = {}) {
    const apiKey = sanitizeText(process.env.LOCATIONIQ_API_KEY);
    if (!apiKey) return null;

    const query = [normalizeGeoText(city), normalizeGeoText(country)].filter(Boolean).join(', ');
    if (!query) return null;

    const url = new URL('https://us1.locationiq.com/v1/search');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');

    const data = await requestJson(url, {});
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return null;

    const address = first.address || {};

    return buildNormalizedResult({
        city:
            sanitizeText(address.city) ||
            sanitizeText(address.town) ||
            sanitizeText(address.village) ||
            sanitizeText(address.hamlet) ||
            sanitizeText(address.municipality) ||
            sanitizeText(city),
        country: sanitizeText(address.country) || sanitizeText(country),
        countryCode: sanitizeText(address.country_code).toUpperCase(),
        lat: first.lat,
        lng: first.lon,
        geoSource: 'locationiq_city_geocode',
        geoProvider: 'locationiq',
        geoPrecision: 'city',
        geoDisplayName: sanitizeText(first.display_name)
    });
}

async function geocodeWithNominatim({ city = '', country = '' } = {}) {
    const query = [normalizeGeoText(city), normalizeGeoText(country)].filter(Boolean).join(', ');
    if (!query) return null;

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');

    const userAgent =
        sanitizeText(process.env.GEOCODING_USER_AGENT) ||
        'YHUniverse/1.0 (support@younghustlers.net)';

    const data = await requestJson(url, {
        'User-Agent': userAgent,
        'Accept-Language': 'en'
    });

    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return null;

    const address = first.address || {};

    return buildNormalizedResult({
        city:
            sanitizeText(address.city) ||
            sanitizeText(address.town) ||
            sanitizeText(address.village) ||
            sanitizeText(address.hamlet) ||
            sanitizeText(address.municipality) ||
            sanitizeText(city),
        country: sanitizeText(address.country) || sanitizeText(country),
        countryCode: sanitizeText(address.country_code).toUpperCase(),
        lat: first.lat,
        lng: first.lon,
        geoSource: 'nominatim_city_geocode',
        geoProvider: 'nominatim',
        geoPrecision: 'city',
        geoDisplayName: sanitizeText(first.display_name)
    });
}

function getProviderOrder() {
    const configured = sanitizeText(process.env.GEOCODING_PROVIDER || 'auto').toLowerCase();

    if (configured === 'opencage') return ['opencage', 'locationiq', 'nominatim'];
    if (configured === 'locationiq') return ['locationiq', 'opencage', 'nominatim'];
    if (configured === 'nominatim') return ['nominatim'];
    return ['opencage', 'locationiq', 'nominatim'];
}

async function runProvider(provider, payload) {
    if (provider === 'opencage') return geocodeWithOpenCage(payload);
    if (provider === 'locationiq') return geocodeWithLocationIQ(payload);
    if (provider === 'nominatim') return geocodeWithNominatim(payload);
    return null;
}

async function resolveLocation({ city = '', country = '', fallbackToCountryCentroid = true } = {}) {
    const cleanCity = normalizeGeoText(city);
    const cleanCountry = normalizeGeoText(country);

    for (const provider of getProviderOrder()) {
        try {
            const result = await runProvider(provider, {
                city: cleanCity,
                country: cleanCountry
            });

            if (result?.lat !== null && result?.lng !== null) {
                return result;
            }
        } catch (error) {
            console.warn(`geocodingService ${provider} failed:`, error?.message || error);
        }
    }

    if (fallbackToCountryCentroid) {
        const fallback = buildCountryFallback(cleanCity, cleanCountry);
        if (fallback) return fallback;
    }

    return {
        city: cleanCity,
        cityNormalized: cleanCity.toLowerCase(),
        country: cleanCountry,
        countryNormalized: cleanCountry.toLowerCase(),
        countryCode: '',
        lat: null,
        lng: null,
        geoSource: 'manual_pending',
        geoProvider: 'manual_pending',
        geoPrecision: 'unresolved',
        geoConfidence: 0,
        geoDisplayName: [cleanCity, cleanCountry].filter(Boolean).join(', '),
        geoUpdatedAt: nowIso()
    };
}

module.exports = {
    resolveLocation
};