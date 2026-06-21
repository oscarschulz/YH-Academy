const { firestore } = require('../../config/firebaseAdmin');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');
const geocodingService = require('../services/geocodingService');

const usersCol = firestore.collection('users');

const SUPABASE_TABLE = 'yhu_public_landing_events';

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const nowIso = () => new Date().toISOString();

const addSecondsIso = (seconds = 900) => {
    const safeSeconds = Math.max(60, toNumber(seconds, 900));
    return new Date(Date.now() + safeSeconds * 1000).toISOString();
};

const COUNTRY_GEO_INDEX = {
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
    norway: { country: 'Norway', countryCode: 'NO', lat: 60.4720, lng: 22.9375 },
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

function normalizeGeoText(value = '') {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function deriveGeoFromText({ city = '', country = '' } = {}) {
    const cleanCity = normalizeGeoText(city);
    const cleanCountryInput = normalizeGeoText(country);
    const normalizedCountryKey =
        COUNTRY_ALIASES[cleanCountryInput.toLowerCase()] ||
        cleanCountryInput.toLowerCase();

    const geo = COUNTRY_GEO_INDEX[normalizedCountryKey] || null;

    return {
        city: cleanCity,
        cityNormalized: cleanCity.toLowerCase(),
        country: geo?.country || cleanCountryInput,
        countryNormalized: normalizedCountryKey,
        countryCode: geo?.countryCode || '',
        lat: geo ? Number(geo.lat) : null,
        lng: geo ? Number(geo.lng) : null,
        geoSource: geo ? 'landing_geo_backfill_country_centroid' : 'landing_geo_backfill_pending',
        geoUpdatedAt: nowIso()
    };
}

function buildLocationText(geo = {}) {
    const explicitLocationText = sanitizeText(
        geo.locationText ||
        geo.eventLocationText ||
        geo.geoDisplayName ||
        geo.displayName ||
        ''
    );

    if (explicitLocationText) return explicitLocationText;

    const city = sanitizeText(geo.city);
    const country = sanitizeText(geo.country);

    if (city && country) return `${city}, ${country}`;
    if (country) return country;
    if (city) return city;
    return 'their region';
}

function isValidLandingGeo(geo = {}) {
    return Number.isFinite(Number(geo?.lat)) && Number.isFinite(Number(geo?.lng));
}

function getLandingGeoSources(options = {}) {
    return [
        options,
        options.eventLocation,
        options.activityLocation,
        options.currentLocation,
        options.requestLocation,
        options.location,
        options.geo,
        options.payload?.eventLocation,
        options.payload?.activityLocation,
        options.payload?.currentLocation,
        options.payload?.location,
        options.payload?.geo
    ].filter((source) => source && typeof source === 'object');
}

function pickLandingGeoText(options = {}, keys = []) {
    for (const source of getLandingGeoSources(options)) {
        for (const key of keys) {
            const value = sanitizeText(source?.[key]);
            if (value) return value;
        }
    }

    return '';
}

function pickLandingGeoNumber(options = {}, keys = []) {
    for (const source of getLandingGeoSources(options)) {
        for (const key of keys) {
            const rawValue = source?.[key];
            if (rawValue === null || rawValue === undefined || rawValue === '') continue;

            const value = toNumber(rawValue, NaN);
            if (Number.isFinite(value)) return value;
        }
    }

    return NaN;
}

function hasExplicitLandingEventGeo(options = {}) {
    return Boolean(
        pickLandingGeoText(options, [
            'eventCity',
            'locationCity',
            'currentCity',
            'city',
            'eventCountry',
            'locationCountry',
            'currentCountry',
            'country',
            'countryOfResidence',
            'eventLocationText',
            'locationText',
            'geoDisplayName',
            'displayName',
            'formattedAddress'
        ]) ||
        Number.isFinite(pickLandingGeoNumber(options, [
            'eventLat',
            'eventLatitude',
            'currentLat',
            'currentLatitude',
            'lat',
            'latitude'
        ])) ||
        Number.isFinite(pickLandingGeoNumber(options, [
            'eventLng',
            'eventLongitude',
            'currentLng',
            'currentLongitude',
            'lng',
            'longitude',
            'lon'
        ]))
    );
}

function splitLandingLocationText(locationText = '') {
    const cleanLocationText = normalizeGeoText(locationText);
    if (!cleanLocationText) return { city: '', country: '' };

    const parts = cleanLocationText
        .split(',')
        .map((part) => normalizeGeoText(part))
        .filter(Boolean);

    if (parts.length >= 2) {
        return {
            city: parts.slice(0, -1).join(', '),
            country: parts[parts.length - 1]
        };
    }

    return {
        city: '',
        country: cleanLocationText
    };
}

async function resolveLandingEventGeo(options = {}) {
    const locationText = pickLandingGeoText(options, [
        'eventLocationText',
        'locationText',
        'geoDisplayName',
        'displayName',
        'formattedAddress'
    ]);

    const parsedLocationText = splitLandingLocationText(locationText);

    const city = pickLandingGeoText(options, [
        'eventCity',
        'locationCity',
        'currentCity',
        'city',
        'town',
        'municipality'
    ]) || parsedLocationText.city;

    const country = pickLandingGeoText(options, [
        'eventCountry',
        'locationCountry',
        'currentCountry',
        'country',
        'countryOfResidence'
    ]) || parsedLocationText.country;

    const countryCode = pickLandingGeoText(options, [
        'eventCountryCode',
        'locationCountryCode',
        'currentCountryCode',
        'countryCode'
    ]).toUpperCase();

    const lat = pickLandingGeoNumber(options, [
        'eventLat',
        'eventLatitude',
        'currentLat',
        'currentLatitude',
        'lat',
        'latitude'
    ]);

    const lng = pickLandingGeoNumber(options, [
        'eventLng',
        'eventLongitude',
        'currentLng',
        'currentLongitude',
        'lng',
        'longitude',
        'lon'
    ]);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
            city,
            country,
            countryCode,
            lat,
            lng,
            locationText,
            geoSource: 'landing_event_payload_coordinates',
            geoPrecision: 'event_coordinates',
            geoDisplayName: locationText || [city, country].filter(Boolean).join(', ')
        };
    }

    if (!city && !country && !locationText) return null;

    try {
        const resolvedGeo = await geocodingService.resolveLocation({
            city,
            country: country || locationText,
            fallbackToCountryCentroid: true
        });

        if (isValidLandingGeo(resolvedGeo)) {
            return {
                city: sanitizeText(resolvedGeo.city) || city,
                country: sanitizeText(resolvedGeo.country) || country || locationText,
                countryCode: sanitizeText(resolvedGeo.countryCode || countryCode).toUpperCase(),
                lat: Number(resolvedGeo.lat),
                lng: Number(resolvedGeo.lng),
                locationText: locationText || sanitizeText(resolvedGeo.geoDisplayName),
                geoSource: sanitizeText(resolvedGeo.geoSource || 'landing_event_payload_geocoded'),
                geoProvider: sanitizeText(resolvedGeo.geoProvider),
                geoPrecision: sanitizeText(resolvedGeo.geoPrecision || 'city'),
                ...(Number.isFinite(Number(resolvedGeo.geoConfidence))
                    ? { geoConfidence: Number(resolvedGeo.geoConfidence) }
                    : {}),
                geoDisplayName: sanitizeText(resolvedGeo.geoDisplayName) || locationText || [city, country].filter(Boolean).join(', '),
                geoUpdatedAt: resolvedGeo.geoUpdatedAt || nowIso()
            };
        }
    } catch (error) {
        console.warn('publicLandingEventsRepo.resolveLandingEventGeo failed:', error?.message || error);
    }

    const derivedGeo = deriveGeoFromText({
        city,
        country: country || locationText
    });

    if (isValidLandingGeo(derivedGeo)) {
        return {
            ...derivedGeo,
            locationText: locationText || [derivedGeo.city, derivedGeo.country].filter(Boolean).join(', '),
            geoSource: derivedGeo.geoSource || 'landing_event_payload_country_centroid',
            geoDisplayName: locationText || [derivedGeo.city, derivedGeo.country].filter(Boolean).join(', ')
        };
    }

    return {
        city,
        country: country || locationText,
        countryCode,
        locationText,
        lat: null,
        lng: null,
        geoSource: 'landing_event_payload_unresolved',
        geoPrecision: 'unresolved',
        geoDisplayName: locationText || [city, country].filter(Boolean).join(', '),
        geoUpdatedAt: nowIso()
    };
}

async function getUserGeo(userId) {
    const normalizedUserId = sanitizeText(userId);
    if (!normalizedUserId) return null;

    const userRef = usersCol.doc(normalizedUserId);
    const snap = await userRef.get();
    if (!snap.exists) return null;

    const data = snap.data() || {};
    const actorName =
        sanitizeText(data.fullName) ||
        sanitizeText(data.displayName) ||
        sanitizeText(data.name) ||
        sanitizeText(data.username) ||
        'A member';

    const existingLat = Number(data.lat);
    const existingLng = Number(data.lng);
    const existingGeoSource = sanitizeText(data.geoSource).toLowerCase();

    let fallbackCity = sanitizeText(data.city);
    let fallbackCountry = sanitizeText(data.country);
    let fallbackCountryCode = sanitizeText(data.countryCode);

    try {
        const academyProfileSnap = await userRef.collection('academy').doc('profile').get();
        if (academyProfileSnap.exists) {
            const academyProfile = academyProfileSnap.data() || {};
            fallbackCity = fallbackCity || sanitizeText(academyProfile.city);
            fallbackCountry = fallbackCountry || sanitizeText(academyProfile.country);
            fallbackCountryCode = fallbackCountryCode || sanitizeText(academyProfile.countryCode);
        }
    } catch (error) {
        console.warn(`publicLandingEventsRepo.getUserGeo academy profile fallback failed for ${normalizedUserId}:`, error?.message || error);
    }

    const shouldUpgradeGeo =
        !Number.isFinite(existingLat) ||
        !Number.isFinite(existingLng) ||
        !existingGeoSource ||
        existingGeoSource.includes('country_centroid') ||
        existingGeoSource.includes('manual_pending') ||
        existingGeoSource.includes('backfill_pending');

    let resolvedGeo = null;

    if ((fallbackCity || fallbackCountry) && shouldUpgradeGeo) {
        try {
            resolvedGeo = await geocodingService.resolveLocation({
                city: fallbackCity,
                country: fallbackCountry,
                fallbackToCountryCentroid: true
            });
        } catch (error) {
            console.warn(`publicLandingEventsRepo.getUserGeo live geocode failed for ${normalizedUserId}:`, error?.message || error);
        }
    }

    const resolvedLat = Number(resolvedGeo?.lat);
    const resolvedLng = Number(resolvedGeo?.lng);

    const finalLat =
        Number.isFinite(resolvedLat) && Number.isFinite(resolvedLng)
            ? resolvedLat
            : existingLat;

    const finalLng =
        Number.isFinite(resolvedLat) && Number.isFinite(resolvedLng)
            ? resolvedLng
            : existingLng;

    if (!Number.isFinite(finalLat) || !Number.isFinite(finalLng)) {
        return null;
    }

    const finalCity = sanitizeText(resolvedGeo?.city) || fallbackCity;
    const finalCountry = sanitizeText(resolvedGeo?.country) || fallbackCountry;
    const finalCountryCode = sanitizeText(resolvedGeo?.countryCode) || fallbackCountryCode;

    return {
        userId: normalizedUserId,
        actorName,
        username: sanitizeText(data.username),
        city: finalCity,
        country: finalCountry,
        countryCode: finalCountryCode,
        lat: finalLat,
        lng: finalLng
    };
}

function buildEventData(payload = {}) {
    return {
        type: payload.type,
        slot: payload.slot,
        category: payload.category,
        actorName: payload.actorName,
        username: payload.username,
        feedText: payload.feedText,
        message: payload.message,
        label: payload.label,
        locationText: payload.locationText,
        color: payload.color,
        altitude: payload.altitude,
        ...(payload.coreColor ? { coreColor: payload.coreColor } : {}),
        ...(Number.isFinite(payload.coreAltitude) ? { coreAltitude: payload.coreAltitude } : {}),
        ...(Number.isFinite(payload.coreRadius) ? { coreRadius: payload.coreRadius } : {}),
        ...(Number.isFinite(payload.ringAltitude) ? { ringAltitude: payload.ringAltitude } : {}),
        ...(Array.isArray(payload.ringColor) && payload.ringColor.length ? { ringColor: payload.ringColor } : {}),
        ...(Number.isFinite(payload.ringMaxRadius) ? { ringMaxRadius: payload.ringMaxRadius } : {}),
        ...(Number.isFinite(payload.ringPropagationSpeed) ? { ringPropagationSpeed: payload.ringPropagationSpeed } : {}),
        ...(Number.isFinite(payload.ringRepeatPeriod) ? { ringRepeatPeriod: payload.ringRepeatPeriod } : {}),
        lat: payload.lat,
        lng: payload.lng,
        city: payload.city,
        country: payload.country,
        countryCode: payload.countryCode,
        geoSource: payload.geoSource,
        ...(payload.geoProvider ? { geoProvider: payload.geoProvider } : {}),
        ...(payload.geoPrecision ? { geoPrecision: payload.geoPrecision } : {}),
        ...(Number.isFinite(payload.geoConfidence) ? { geoConfidence: payload.geoConfidence } : {}),
        ...(payload.geoDisplayName ? { geoDisplayName: payload.geoDisplayName } : {}),
        ...(payload.geoUpdatedAt ? { geoUpdatedAt: payload.geoUpdatedAt } : {}),
        userId: payload.userId,
        createdAt: payload.createdAt,
        expiresAt: payload.expiresAt
    };
}

function mapSupabaseRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: row.firebase_document_id || row.id,
        type: row.event_type || data.type || '',
        slot: row.slot || data.slot || 'academy',
        category: row.category || data.category || row.slot || 'academy',
        actorName: row.actor_name || data.actorName || '',
        username: row.username || data.username || '',
        feedText: row.feed_text || data.feedText || row.message || data.message || '',
        message: row.message || data.message || row.feed_text || data.feedText || '',
        label: row.label || data.label || '',
        locationText: data.locationText || buildLocationText({
            city: row.city || data.city,
            country: row.country || data.country
        }),
        color: row.color || data.color || '#38bdf8',
        altitude: toNumber(row.altitude ?? data.altitude, 0.22),
        coreColor: data.coreColor || '',
        coreAltitude: toNumber(data.coreAltitude, NaN),
        coreRadius: toNumber(data.coreRadius, NaN),
        ringAltitude: toNumber(data.ringAltitude, NaN),
        ringColor: Array.isArray(data.ringColor) ? data.ringColor : [],
        ringMaxRadius: toNumber(data.ringMaxRadius, NaN),
        ringPropagationSpeed: toNumber(data.ringPropagationSpeed, NaN),
        ringRepeatPeriod: toNumber(data.ringRepeatPeriod, NaN),
        lat: toNumber(row.lat ?? data.lat, NaN),
        lng: toNumber(row.lng ?? data.lng, NaN),
        city: row.city || data.city || '',
        country: row.country || data.country || '',
        countryCode: row.country_code || data.countryCode || '',
        userId: row.actor_user_id || data.userId || '',
        createdAt: row.created_at_source || data.createdAt || row.created_at || '',
        expiresAt: row.expires_at || data.expiresAt || ''
    };
}

async function createEventForUser(userId, options = {}) {
    const userGeo = await getUserGeo(userId);
    const eventGeoRequested = hasExplicitLandingEventGeo(options);
    const eventGeo = await resolveLandingEventGeo(options);

    if (eventGeoRequested && !isValidLandingGeo(eventGeo)) {
        console.warn(
            `publicLandingEventsRepo.createEventForUser skipped: explicit event geo could not be resolved for user ${sanitizeText(userId) || 'unknown'}`
        );
        return null;
    }

    const geo = {
        ...(userGeo || {}),
        ...(isValidLandingGeo(eventGeo) ? eventGeo : {}),
        userId: sanitizeText(userGeo?.userId || userId),
        username: sanitizeText(userGeo?.username),
        actorName: sanitizeText(options.actorName || userGeo?.actorName || userGeo?.username || 'A member')
    };

    if (!isValidLandingGeo(geo)) {
        console.warn(`publicLandingEventsRepo.createEventForUser skipped: missing valid geo for user ${sanitizeText(userId) || 'unknown'}`);
        return null;
    }

    const slotRaw = sanitizeText(options.slot || 'academy').toLowerCase();
    const slot = ['academy', 'federation', 'plaza'].includes(slotRaw) ? slotRaw : 'academy';
    const category = sanitizeText(options.category || slot) || slot;
    const type = sanitizeText(options.type || 'academy_activity') || 'academy_activity';
    const color = sanitizeText(options.color || '#38bdf8') || '#38bdf8';
    const altitude = toNumber(options.altitude, 0.22);
    const ttlSeconds = toNumber(options.ttlSeconds, 900);

    const actorName = sanitizeText(options.actorName || geo.actorName || geo.username || 'A member');
    const locationText = buildLocationText(geo);

    const rawMessage = sanitizeText(options.message);
    const rawFeedText = sanitizeText(options.feedText);
    const rawLabel = sanitizeText(options.label);

    const message =
        (rawMessage
            ? rawMessage
                .replace(/\{name\}/g, actorName)
                .replace(/\{location\}/g, locationText)
            : '') ||
        (
            sanitizeText(options.messagePrefix)
                ? `${sanitizeText(options.messagePrefix)} from ${locationText}.`
                : `Academy activity from ${locationText}.`
        );

    const feedText =
        (rawFeedText
            ? rawFeedText
                .replace(/\{name\}/g, actorName)
                .replace(/\{location\}/g, locationText)
            : '') ||
        message;

    const label =
        (rawLabel
            ? rawLabel
                .replace(/\{name\}/g, actorName)
                .replace(/\{location\}/g, locationText)
            : '') ||
        (
            sanitizeText(options.labelPrefix)
                ? `${sanitizeText(options.labelPrefix)} • ${locationText}`
                : locationText
        );

    const createdAt = nowIso();
    const expiresAt = addSecondsIso(ttlSeconds);
    const documentId = `spl_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const payload = {
        type,
        slot,
        category,
        actorName,
        username: geo.username,
        feedText,
        message,
        label,
        locationText,
        color,
        altitude,
        coreColor: sanitizeText(options.coreColor || ''),
        coreAltitude: toNumber(options.coreAltitude, NaN),
        coreRadius: toNumber(options.coreRadius, NaN),
        ringAltitude: toNumber(options.ringAltitude, NaN),
        ringColor: Array.isArray(options.ringColor)
            ? options.ringColor.map((value) => sanitizeText(value)).filter(Boolean)
            : [],
        ringMaxRadius: toNumber(options.ringMaxRadius, NaN),
        ringPropagationSpeed: toNumber(options.ringPropagationSpeed, NaN),
        ringRepeatPeriod: toNumber(options.ringRepeatPeriod, NaN),
        lat: Number(geo.lat),
        lng: Number(geo.lng),
        city: sanitizeText(geo.city),
        country: sanitizeText(geo.country),
        countryCode: sanitizeText(geo.countryCode).toUpperCase(),
        geoSource: sanitizeText(geo.geoSource || (eventGeoRequested ? 'landing_event_payload' : 'user_profile_geo')),
        geoProvider: sanitizeText(geo.geoProvider || ''),
        geoPrecision: sanitizeText(geo.geoPrecision || ''),
        geoConfidence: toNumber(geo.geoConfidence, NaN),
        geoDisplayName: sanitizeText(geo.geoDisplayName || ''),
        geoUpdatedAt: sanitizeText(geo.geoUpdatedAt || ''),
        userId: geo.userId,
        createdAt,
        expiresAt
    };

    const data = buildEventData(payload);

    const row = {
        firebase_app: 'supabase',
        firebase_document_id: documentId,
        firebase_document_path: `publicLandingEvents/${documentId}`,
        event_type: type,
        slot,
        category,
        actor_user_id: geo.userId,
        actor_name: actorName,
        username: geo.username,
        message,
        feed_text: feedText,
        label,
        city: payload.city,
        country: payload.country,
        country_code: payload.countryCode,
        lat: payload.lat,
        lng: payload.lng,
        color,
        altitude,
        expires_at: expiresAt,
        created_at_source: createdAt,
        updated_at_source: createdAt,
        data
    };

    const { error } = await yhuSupabaseAdmin
        .from(SUPABASE_TABLE)
        .upsert(row, { onConflict: 'firebase_document_path' });

    if (error) {
        throw new Error(`Supabase public landing insert failed: ${error.message}`);
    }

    if (typeof global.yhEmitPublicLandingSnapshot === 'function') {
        Promise.resolve(global.yhEmitPublicLandingSnapshot()).catch((emitError) => {
            console.warn('public landing snapshot emit skipped:', emitError?.message || emitError);
        });
    }

    return {
        id: documentId,
        ...payload,
        createdAt,
        expiresAt
    };
}

async function createAcademyActionEvent(userId, actionKey = '', details = {}) {
    const normalizedAction = sanitizeText(actionKey).toLowerCase();
    const missionTitle = sanitizeText(details.missionTitle);
    const focusArea = sanitizeText(details.focusArea);
    const target30Days = sanitizeText(details.target30Days);
    const weeklyTheme = sanitizeText(details.weeklyTheme);
    const weeklyTargetOutcome = sanitizeText(details.weeklyTargetOutcome);
    const ttlSeconds = toNumber(details.ttlSeconds, NaN);

    let preset = null;

    if (normalizedAction === 'roadmap_application') {
        preset = {
            type: 'academy_roadmap_application',
            slot: 'academy',
            category: 'academy',
            messagePrefix: target30Days
                ? `Roadmap access unlocked for ${target30Days}`
                : focusArea
                    ? `Roadmap access unlocked for ${focusArea}`
                    : 'Roadmap access unlocked',
            labelPrefix: 'Academy Roadmap',
            color: '#7dd3fc',
            altitude: 0.2,
            ttlSeconds: 1800
        };
    } else if (normalizedAction === 'roadmap_refresh') {
        preset = {
            type: 'academy_roadmap_refresh',
            slot: 'academy',
            category: 'academy',
            messagePrefix: weeklyTheme
                ? `Roadmap refreshed: ${weeklyTheme}`
                : weeklyTargetOutcome
                    ? `Roadmap refreshed: ${weeklyTargetOutcome}`
                    : 'Roadmap refreshed',
            labelPrefix: 'Roadmap Refresh',
            color: '#38bdf8',
            altitude: 0.21,
            ttlSeconds: 1500
        };
    } else if (normalizedAction === 'mission_completed') {
        preset = {
            type: 'academy_mission_completed',
            slot: 'academy',
            category: 'academy',
            messagePrefix: missionTitle ? `Mission completed: ${missionTitle}` : 'Mission completed',
            labelPrefix: 'Mission Complete',
            color: '#22c55e',
            altitude: 0.2,
            ttlSeconds: 1500
        };
    } else if (normalizedAction === 'mission_skipped') {
        preset = {
            type: 'academy_mission_skipped',
            slot: 'academy',
            category: 'academy',
            messagePrefix: missionTitle ? `Mission skipped: ${missionTitle}` : 'Mission skipped',
            labelPrefix: 'Mission Skipped',
            color: '#f59e0b',
            altitude: 0.18,
            ttlSeconds: 1350
        };
    } else if (normalizedAction === 'mission_stuck') {
        preset = {
            type: 'academy_mission_stuck',
            slot: 'academy',
            category: 'academy',
            messagePrefix: missionTitle ? `Mission stuck: ${missionTitle}` : 'Mission stuck',
            labelPrefix: 'Mission Stuck',
            color: '#fb7185',
            altitude: 0.18,
            ttlSeconds: 1350
        };
    } else if (normalizedAction === 'checkin_saved') {
        preset = {
            type: 'academy_checkin_saved',
            slot: 'academy',
            category: 'academy',
            messagePrefix: 'Daily check-in saved',
            labelPrefix: 'Daily Check-In',
            color: '#a78bfa',
            altitude: 0.19,
            ttlSeconds: 1200
        };
    }

    if (!preset) return null;

    return createEventForUser(userId, {
        ...preset,
        eventCity: details.eventCity ?? details.locationCity ?? details.currentCity ?? details.city ?? details.location?.city ?? details.geo?.city ?? details.currentLocation?.city,
        eventCountry: details.eventCountry ?? details.locationCountry ?? details.currentCountry ?? details.country ?? details.countryOfResidence ?? details.location?.country ?? details.geo?.country ?? details.currentLocation?.country,
        eventCountryCode: details.eventCountryCode ?? details.locationCountryCode ?? details.currentCountryCode ?? details.countryCode ?? details.location?.countryCode ?? details.geo?.countryCode ?? details.currentLocation?.countryCode,
        eventLat: details.eventLat ?? details.eventLatitude ?? details.currentLat ?? details.currentLatitude ?? details.lat ?? details.latitude ?? details.location?.lat ?? details.location?.latitude ?? details.geo?.lat ?? details.geo?.latitude ?? details.currentLocation?.lat ?? details.currentLocation?.latitude,
        eventLng: details.eventLng ?? details.eventLongitude ?? details.currentLng ?? details.currentLongitude ?? details.lng ?? details.longitude ?? details.lon ?? details.location?.lng ?? details.location?.longitude ?? details.geo?.lng ?? details.geo?.longitude ?? details.currentLocation?.lng ?? details.currentLocation?.longitude,
        eventLocationText: details.eventLocationText ?? details.locationText ?? details.geoDisplayName ?? details.location?.locationText ?? details.location?.geoDisplayName ?? details.geo?.locationText ?? details.geo?.geoDisplayName ?? details.currentLocation?.locationText,
        ...(Number.isFinite(ttlSeconds) ? { ttlSeconds } : {})
    });
}

function getDefaultFeed() {
    return {
        academy: 'Waiting for new Academy member activity.',
        federation: 'Waiting for academy access activity.',
        plaza: 'Waiting for academy community activity.'
    };
}

function buildPublicLandingFallbackSnapshot(reason = 'supabase_public_landing_unavailable') {
    return {
        feed: getDefaultFeed(),
        liveEvents: [],
        academyEvents: [],
        points: [],
        arcs: [],
        focusPoint: null,
        stats: {
            members: 0,
            reach: 0,
            impressions: 0
        },
        source: 'fallback',
        reason,
        warning: 'Public landing live feed is temporarily using a safe fallback.',
        updatedAt: new Date().toISOString()
    };
}

async function getVerifiedMemberStats() {
    try {
        const snap = await usersCol.where('isVerified', '==', true).get();
        const verifiedMembers = snap.docs.map((doc) => doc.data() || {});
        const reachCountries = new Set(
            verifiedMembers
                .map((member) => sanitizeText(member.country || member.locationCountry || ''))
                .filter(Boolean)
                .map((country) => country.toLowerCase())
        );

        return {
            members: verifiedMembers.length,
            reach: reachCountries.size
        };
    } catch (error) {
        console.warn('publicLandingEventsRepo.getVerifiedMemberStats fallback:', error?.message || error);
        return {
            members: 0,
            reach: 0
        };
    }
}

async function buildPublicLandingSnapshot(limit = 24) {
    const normalizedLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 24));

    try {
        const { data, error } = await yhuSupabaseAdmin
            .from(SUPABASE_TABLE)
            .select('*')
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .order('created_at_source', { ascending: false })
            .limit(Math.max(normalizedLimit, 40));

        if (error) {
            throw new Error(error.message);
        }

        const orderedEvents = (Array.isArray(data) ? data : [])
            .map(mapSupabaseRow)
            .filter((event) => Number.isFinite(Number(event.lat)) && Number.isFinite(Number(event.lng)))
            .slice(0, normalizedLimit);

        const feed = getDefaultFeed();

        const latestAcademy = orderedEvents.find((event) => event.slot === 'academy');
        const latestFederation = orderedEvents.find((event) => event.slot === 'federation');
        const latestPlaza = orderedEvents.find((event) => event.slot === 'plaza');

        if (latestAcademy?.feedText) feed.academy = latestAcademy.feedText;
        if (latestFederation?.feedText) feed.federation = latestFederation.feedText;
        if (latestPlaza?.feedText) feed.plaza = latestPlaza.feedText;

        const liveEvents = orderedEvents.slice(0, 6).map((event) => ({
            id: event.id,
            pointId: event.id,
            slot: event.slot,
            type: event.type,
            actorName: event.actorName,
            label: event.label || `${sanitizeText(event.slot || 'activity')} activity`,
            feedText: event.feedText || event.message || 'Live activity',
            locationText: event.locationText || buildLocationText(event),
            city: event.city,
            country: event.country,
            countryCode: event.countryCode,
            createdAt: event.createdAt
        }));

        const academyEvents = liveEvents
            .filter((event) => event.slot === 'academy')
            .slice(0, 6);

        const points = orderedEvents.slice(0, 8).map((event) => ({
            id: event.id,
            lat: event.lat,
            lng: event.lng,
            label: event.label || event.locationText || event.feedText || event.message || 'Live activity',
            color: event.color || '#38bdf8',
            altitude: event.altitude || 0.22,
            ...(event.coreColor ? { coreColor: event.coreColor } : {}),
            ...(Number.isFinite(event.coreAltitude) ? { coreAltitude: event.coreAltitude } : {}),
            ...(Number.isFinite(event.coreRadius) ? { coreRadius: event.coreRadius } : {}),
            ...(Number.isFinite(event.ringAltitude) ? { ringAltitude: event.ringAltitude } : {}),
            ...(Array.isArray(event.ringColor) && event.ringColor.length ? { ringColor: event.ringColor } : {}),
            ...(Number.isFinite(event.ringMaxRadius) ? { ringMaxRadius: event.ringMaxRadius } : {}),
            ...(Number.isFinite(event.ringPropagationSpeed) ? { ringPropagationSpeed: event.ringPropagationSpeed } : {}),
            ...(Number.isFinite(event.ringRepeatPeriod) ? { ringRepeatPeriod: event.ringRepeatPeriod } : {})
        }));

        const focusPoint = points[0]
            ? {
                id: points[0].id,
                lat: points[0].lat,
                lng: points[0].lng,
                label: points[0].label
            }
            : null;

        const memberStats = await getVerifiedMemberStats();

        return {
            feed,
            liveEvents,
            academyEvents,
            points,
            arcs: [],
            focusPoint,
            stats: {
                members: memberStats.members,
                reach: memberStats.reach,
                impressions: orderedEvents.length
            },
            source: 'supabase',
            updatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.warn('[PUBLIC LANDING] Supabase snapshot failed. Returning fallback snapshot:', error?.message || error);
        return buildPublicLandingFallbackSnapshot('supabase_public_landing_failed');
    }
}

module.exports = {
    createEventForUser,
    createAcademyActionEvent,
    buildPublicLandingSnapshot
};
