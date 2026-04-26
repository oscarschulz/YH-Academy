const { firestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');
const geocodingService = require('../services/geocodingService');

const usersCol = firestore.collection('users');
const publicLandingEventsCol = firestore.collection('publicLandingEvents');

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const mapTimestamp = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value || null;
};

const nowTs = () => Timestamp.now();
const addSecondsTs = (seconds = 900) => {
    const safeSeconds = Math.max(60, toNumber(seconds, 900));
    return Timestamp.fromDate(new Date(Date.now() + safeSeconds * 1000));
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

const nowIso = () => new Date().toISOString();

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

    const finalCity =
        sanitizeText(resolvedGeo?.city) ||
        fallbackCity;

    const finalCountry =
        sanitizeText(resolvedGeo?.country) ||
        fallbackCountry;

    const finalCountryCode =
        sanitizeText(resolvedGeo?.countryCode) ||
        fallbackCountryCode;

    if (resolvedGeo && Number.isFinite(resolvedLat) && Number.isFinite(resolvedLng)) {
        try {
            await userRef.set(
                {
                    ...(finalCity ? { city: finalCity } : {}),
                    ...(sanitizeText(resolvedGeo.cityNormalized) ? { cityNormalized: resolvedGeo.cityNormalized } : {}),
                    ...(finalCountry ? { country: finalCountry } : {}),
                    ...(sanitizeText(resolvedGeo.countryNormalized) ? { countryNormalized: resolvedGeo.countryNormalized } : {}),
                    ...(finalCountryCode ? { countryCode: finalCountryCode } : {}),
                    lat: finalLat,
                    lng: finalLng,
                    geoSource: resolvedGeo.geoSource,
                    geoProvider: resolvedGeo.geoProvider,
                    geoPrecision: resolvedGeo.geoPrecision,
                    ...(Number.isFinite(Number(resolvedGeo.geoConfidence))
                        ? { geoConfidence: Number(resolvedGeo.geoConfidence) }
                        : {}),
                    ...(sanitizeText(resolvedGeo.geoDisplayName)
                        ? { geoDisplayName: sanitizeText(resolvedGeo.geoDisplayName) }
                        : {}),
                    geoUpdatedAt: resolvedGeo.geoUpdatedAt
                },
                { merge: true }
            );
        } catch (error) {
            console.warn(`publicLandingEventsRepo.getUserGeo root geo update failed for ${normalizedUserId}:`, error?.message || error);
        }
    }

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

async function createEventForUser(userId, options = {}) {
    const userGeo = await getUserGeo(userId);
    const eventGeoRequested = hasExplicitLandingEventGeo(options);
    const eventGeo = await resolveLandingEventGeo(options);

    if (eventGeoRequested && !isValidLandingGeo(eventGeo)) {
        console.warn(
            `publicLandingEventsRepo.createEventForUser skipped: explicit event geo could not be resolved for user ${sanitizeText(userId) || 'unknown'}`,
            {
                city: sanitizeText(eventGeo?.city),
                country: sanitizeText(eventGeo?.country),
                locationText: sanitizeText(eventGeo?.locationText || eventGeo?.geoDisplayName),
                geoSource: sanitizeText(eventGeo?.geoSource)
            }
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
    const slot = ['academy', 'federation', 'plaza'].includes(slotRaw)
        ? slotRaw
        : 'academy';

    const category = sanitizeText(options.category || 'academy') || 'academy';
    const type = sanitizeText(options.type || 'academy_activity') || 'academy_activity';
    const color = sanitizeText(options.color || '#38bdf8') || '#38bdf8';
    const altitude = toNumber(options.altitude, 0.22);
    const ttlSeconds = toNumber(options.ttlSeconds, 900);

    const coreColor = sanitizeText(options.coreColor || '');
    const coreAltitude = toNumber(options.coreAltitude, NaN);
    const coreRadius = toNumber(options.coreRadius, NaN);
    const ringAltitude = toNumber(options.ringAltitude, NaN);
    const ringColor = Array.isArray(options.ringColor)
        ? options.ringColor.map((value) => sanitizeText(value)).filter(Boolean)
        : [];
    const ringMaxRadius = toNumber(options.ringMaxRadius, NaN);
    const ringPropagationSpeed = toNumber(options.ringPropagationSpeed, NaN);
    const ringRepeatPeriod = toNumber(options.ringRepeatPeriod, NaN);

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

    const createdAt = nowTs();
    const expiresAt = addSecondsTs(ttlSeconds);

    const ref = publicLandingEventsCol.doc();
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
        ...(coreColor ? { coreColor } : {}),
        ...(Number.isFinite(coreAltitude) ? { coreAltitude } : {}),
        ...(Number.isFinite(coreRadius) ? { coreRadius } : {}),
        ...(Number.isFinite(ringAltitude) ? { ringAltitude } : {}),
        ...(ringColor.length ? { ringColor } : {}),
        ...(Number.isFinite(ringMaxRadius) ? { ringMaxRadius } : {}),
        ...(Number.isFinite(ringPropagationSpeed) ? { ringPropagationSpeed } : {}),
        ...(Number.isFinite(ringRepeatPeriod) ? { ringRepeatPeriod } : {}),
        lat: Number(geo.lat),
        lng: Number(geo.lng),
        city: sanitizeText(geo.city),
        country: sanitizeText(geo.country),
        countryCode: sanitizeText(geo.countryCode).toUpperCase(),
        geoSource: sanitizeText(geo.geoSource || (eventGeoRequested ? 'landing_event_payload' : 'user_profile_geo')),
        ...(sanitizeText(geo.geoProvider) ? { geoProvider: sanitizeText(geo.geoProvider) } : {}),
        ...(sanitizeText(geo.geoPrecision) ? { geoPrecision: sanitizeText(geo.geoPrecision) } : {}),
        ...(Number.isFinite(Number(geo.geoConfidence)) ? { geoConfidence: Number(geo.geoConfidence) } : {}),
        ...(sanitizeText(geo.geoDisplayName) ? { geoDisplayName: sanitizeText(geo.geoDisplayName) } : {}),
        ...(sanitizeText(geo.geoUpdatedAt) ? { geoUpdatedAt: sanitizeText(geo.geoUpdatedAt) } : {}),
        userId: geo.userId,
        createdAt,
        expiresAt
    };

    await ref.set(payload);

    if (typeof global.yhEmitPublicLandingSnapshot === 'function') {
        Promise.resolve(global.yhEmitPublicLandingSnapshot()).catch((error) => {
            console.warn('public landing snapshot emit skipped:', error?.message || error);
        });
    }

    return {
        id: ref.id,
        ...payload,
        createdAt: mapTimestamp(createdAt),
        expiresAt: mapTimestamp(expiresAt)
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
            messagePrefix:
                target30Days
                    ? `Roadmap access unlocked for ${target30Days}`
                    : focusArea
                        ? `Roadmap access unlocked for ${focusArea}`
                        : 'Roadmap access unlocked',
            labelPrefix: 'Academy Roadmap',
            color: '#7dd3fc',
            altitude: 0.2,
            ttlSeconds: 1800,
            coreColor: 'rgba(191, 219, 254, 0.98)',
            coreAltitude: 0.013,
            coreRadius: 0.19,
            ringAltitude: 0.0034,
            ringColor: [
                'rgba(191, 219, 254, 0.98)',
                'rgba(125, 211, 252, 0.48)',
                'rgba(125, 211, 252, 0)'
            ],
            ringMaxRadius: 5.8,
            ringPropagationSpeed: 1.82,
            ringRepeatPeriod: 760
        };
    } else if (normalizedAction === 'roadmap_refresh') {
        preset = {
            type: 'academy_roadmap_refresh',
            slot: 'academy',
            category: 'academy',
            messagePrefix:
                weeklyTheme
                    ? `Roadmap refreshed: ${weeklyTheme}`
                    : weeklyTargetOutcome
                        ? `Roadmap refreshed: ${weeklyTargetOutcome}`
                        : 'Roadmap refreshed',
            labelPrefix: 'Roadmap Refresh',
            color: '#38bdf8',
            altitude: 0.21,
            ttlSeconds: 1500,
            coreColor: 'rgba(191, 219, 254, 0.98)',
            coreAltitude: 0.0125,
            coreRadius: 0.18,
            ringAltitude: 0.0032,
            ringColor: [
                'rgba(191, 219, 254, 0.98)',
                'rgba(56, 189, 248, 0.46)',
                'rgba(56, 189, 248, 0)'
            ],
            ringMaxRadius: 5.5,
            ringPropagationSpeed: 1.8,
            ringRepeatPeriod: 740
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
            ttlSeconds: 1500,
            coreColor: 'rgba(220, 252, 231, 0.98)',
            coreAltitude: 0.012,
            coreRadius: 0.17,
            ringAltitude: 0.0031,
            ringColor: [
                'rgba(220, 252, 231, 0.98)',
                'rgba(34, 197, 94, 0.46)',
                'rgba(34, 197, 94, 0)'
            ],
            ringMaxRadius: 5.1,
            ringPropagationSpeed: 1.9,
            ringRepeatPeriod: 700
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
            ttlSeconds: 1350,
            coreColor: 'rgba(254, 243, 199, 0.98)',
            coreAltitude: 0.0115,
            coreRadius: 0.165,
            ringAltitude: 0.003,
            ringColor: [
                'rgba(254, 243, 199, 0.98)',
                'rgba(245, 158, 11, 0.46)',
                'rgba(245, 158, 11, 0)'
            ],
            ringMaxRadius: 4.8,
            ringPropagationSpeed: 1.76,
            ringRepeatPeriod: 760
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
            ttlSeconds: 1350,
            coreColor: 'rgba(255, 228, 230, 0.98)',
            coreAltitude: 0.0115,
            coreRadius: 0.165,
            ringAltitude: 0.003,
            ringColor: [
                'rgba(255, 228, 230, 0.98)',
                'rgba(251, 113, 133, 0.46)',
                'rgba(251, 113, 133, 0)'
            ],
            ringMaxRadius: 4.9,
            ringPropagationSpeed: 1.72,
            ringRepeatPeriod: 780
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
            ttlSeconds: 1200,
            coreColor: 'rgba(237, 233, 254, 0.98)',
            coreAltitude: 0.012,
            coreRadius: 0.17,
            ringAltitude: 0.0031,
            ringColor: [
                'rgba(237, 233, 254, 0.98)',
                'rgba(167, 139, 250, 0.46)',
                'rgba(167, 139, 250, 0)'
            ],
            ringMaxRadius: 5.0,
            ringPropagationSpeed: 1.86,
            ringRepeatPeriod: 720
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

function getSampleLandingEvents() {
    const now = Date.now();

    const samples = [
        {
            id: 'sample_academy_lagos',
            type: 'sample_academy_member',
            slot: 'academy',
            category: 'academy',
            message: 'New Academy member joined from Lagos, Nigeria.',
            label: 'Academy • Lagos, Nigeria',
            color: '#38bdf8',
            altitude: 0.22,
            coreColor: 'rgba(191, 219, 254, 0.98)',
            coreAltitude: 0.013,
            coreRadius: 0.19,
            ringAltitude: 0.0034,
            ringColor: [
                'rgba(191, 219, 254, 0.98)',
                'rgba(56, 189, 248, 0.48)',
                'rgba(56, 189, 248, 0)'
            ],
            ringMaxRadius: 5.8,
            ringPropagationSpeed: 1.85,
            ringRepeatPeriod: 760,
            lat: 6.5244,
            lng: 3.3792,
            city: 'Lagos',
            country: 'Nigeria',
            countryCode: 'NG'
        },
        {
            id: 'sample_federation_london',
            type: 'sample_federation_access',
            slot: 'federation',
            category: 'federation',
            message: 'Federation access activity detected from London, United Kingdom.',
            label: 'Federation • London, United Kingdom',
            color: '#818cf8',
            altitude: 0.24,
            coreColor: 'rgba(199, 210, 254, 0.98)',
            coreAltitude: 0.014,
            coreRadius: 0.18,
            ringAltitude: 0.0038,
            ringColor: [
                'rgba(199, 210, 254, 0.98)',
                'rgba(129, 140, 248, 0.46)',
                'rgba(129, 140, 248, 0)'
            ],
            ringMaxRadius: 6.2,
            ringPropagationSpeed: 1.74,
            ringRepeatPeriod: 840,
            lat: 51.5072,
            lng: -0.1276,
            city: 'London',
            country: 'United Kingdom',
            countryCode: 'GB'
        },
        {
            id: 'sample_plaza_singapore',
            type: 'sample_plaza_post',
            slot: 'plaza',
            category: 'plaza',
            message: 'New Plaza networking activity from Singapore.',
            label: 'Plaza • Singapore',
            color: '#22d3ee',
            altitude: 0.18,
            coreColor: 'rgba(165, 243, 252, 0.98)',
            coreAltitude: 0.012,
            coreRadius: 0.17,
            ringAltitude: 0.0032,
            ringColor: [
                'rgba(165, 243, 252, 0.98)',
                'rgba(34, 211, 238, 0.44)',
                'rgba(34, 211, 238, 0)'
            ],
            ringMaxRadius: 5.2,
            ringPropagationSpeed: 1.92,
            ringRepeatPeriod: 700,
            lat: 1.3521,
            lng: 103.8198,
            city: 'Singapore',
            country: 'Singapore',
            countryCode: 'SG'
        },
        {
            id: 'sample_academy_dubai',
            type: 'sample_academy_progress',
            slot: 'academy',
            category: 'academy',
            message: 'Academy progress activity is live from Dubai, United Arab Emirates.',
            label: 'Academy • Dubai, UAE',
            color: '#38bdf8',
            altitude: 0.21,
            coreColor: 'rgba(191, 219, 254, 0.98)',
            coreAltitude: 0.0125,
            coreRadius: 0.17,
            ringAltitude: 0.0032,
            ringColor: [
                'rgba(191, 219, 254, 0.98)',
                'rgba(56, 189, 248, 0.42)',
                'rgba(56, 189, 248, 0)'
            ],
            ringMaxRadius: 5.3,
            ringPropagationSpeed: 1.78,
            ringRepeatPeriod: 760,
            lat: 25.2048,
            lng: 55.2708,
            city: 'Dubai',
            country: 'United Arab Emirates',
            countryCode: 'AE'
        },
        {
            id: 'sample_federation_newyork',
            type: 'sample_federation_connection',
            slot: 'federation',
            category: 'federation',
            message: 'New Federation connection activity from New York, United States.',
            label: 'Federation • New York, USA',
            color: '#818cf8',
            altitude: 0.23,
            coreColor: 'rgba(199, 210, 254, 0.98)',
            coreAltitude: 0.013,
            coreRadius: 0.18,
            ringAltitude: 0.0035,
            ringColor: [
                'rgba(199, 210, 254, 0.98)',
                'rgba(129, 140, 248, 0.44)',
                'rgba(129, 140, 248, 0)'
            ],
            ringMaxRadius: 5.7,
            ringPropagationSpeed: 1.68,
            ringRepeatPeriod: 860,
            lat: 40.7128,
            lng: -74.0060,
            city: 'New York',
            country: 'United States',
            countryCode: 'US'
        },
        {
            id: 'sample_plaza_saopaulo',
            type: 'sample_plaza_discussion',
            slot: 'plaza',
            category: 'plaza',
            message: 'New Plaza discussion activity from São Paulo, Brazil.',
            label: 'Plaza • São Paulo, Brazil',
            color: '#22d3ee',
            altitude: 0.18,
            coreColor: 'rgba(165, 243, 252, 0.98)',
            coreAltitude: 0.0118,
            coreRadius: 0.165,
            ringAltitude: 0.003,
            ringColor: [
                'rgba(165, 243, 252, 0.98)',
                'rgba(34, 211, 238, 0.42)',
                'rgba(34, 211, 238, 0)'
            ],
            ringMaxRadius: 4.9,
            ringPropagationSpeed: 1.95,
            ringRepeatPeriod: 720,
            lat: -23.5505,
            lng: -46.6333,
            city: 'São Paulo',
            country: 'Brazil',
            countryCode: 'BR'
        },
        {
            id: 'sample_academy_manila',
            type: 'sample_academy_checkin',
            slot: 'academy',
            category: 'academy',
            message: 'Academy check-in activity is live from Manila, Philippines.',
            label: 'Academy • Manila, Philippines',
            color: '#38bdf8',
            altitude: 0.2,
            coreColor: 'rgba(191, 219, 254, 0.98)',
            coreAltitude: 0.012,
            coreRadius: 0.17,
            ringAltitude: 0.0031,
            ringColor: [
                'rgba(191, 219, 254, 0.98)',
                'rgba(56, 189, 248, 0.44)',
                'rgba(56, 189, 248, 0)'
            ],
            ringMaxRadius: 5.1,
            ringPropagationSpeed: 1.82,
            ringRepeatPeriod: 740,
            lat: 14.5995,
            lng: 120.9842,
            city: 'Manila',
            country: 'Philippines',
            countryCode: 'PH'
        },
        {
            id: 'sample_plaza_johannesburg',
            type: 'sample_plaza_network',
            slot: 'plaza',
            category: 'plaza',
            message: 'Fresh Plaza networking activity from Johannesburg, South Africa.',
            label: 'Plaza • Johannesburg, South Africa',
            color: '#22d3ee',
            altitude: 0.19,
            coreColor: 'rgba(165, 243, 252, 0.98)',
            coreAltitude: 0.012,
            coreRadius: 0.172,
            ringAltitude: 0.0032,
            ringColor: [
                'rgba(165, 243, 252, 0.98)',
                'rgba(34, 211, 238, 0.46)',
                'rgba(34, 211, 238, 0)'
            ],
            ringMaxRadius: 5.4,
            ringPropagationSpeed: 1.88,
            ringRepeatPeriod: 710,
            lat: -26.2041,
            lng: 28.0473,
            city: 'Johannesburg',
            country: 'South Africa',
            countryCode: 'ZA'
        }
    ];

    return samples.map((sample, index) => ({
        ...sample,
        createdAt: new Date(now - ((index + 1) * 45000)).toISOString(),
        expiresAt: null
    }));
}

function buildEventKey(event = {}) {
    return [
        sanitizeText(event.slot || 'academy').toLowerCase(),
        sanitizeText(event.userId).toLowerCase(),
        sanitizeText(event.city).toLowerCase(),
        sanitizeText(event.country).toLowerCase(),
        String(toNumber(event.lat, NaN)),
        String(toNumber(event.lng, NaN))
    ].join('|');
}

function normalizeLandingEvent(event = {}, index = 0) {
    const lat = toNumber(event.lat, NaN);
    const lng = toNumber(event.lng, NaN);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return {
        id: sanitizeText(event.id || `landing_event_${index + 1}`),
        type: sanitizeText(event.type || 'academy_activity'),
        slot: sanitizeText(event.slot || 'academy').toLowerCase(),
        category: sanitizeText(event.category || 'academy'),
        message: sanitizeText(event.message || 'Academy activity'),
        label: sanitizeText(event.label || event.message || 'Academy activity'),
        color: sanitizeText(event.color || '#38bdf8'),
        altitude: toNumber(event.altitude, 0.22),
        coreColor: sanitizeText(event.coreColor || event.color || 'rgba(191, 219, 254, 0.96)'),
        coreAltitude: toNumber(event.coreAltitude, 0.012),
        coreRadius: toNumber(event.coreRadius, 0.16),
        ringAltitude: toNumber(event.ringAltitude, 0.0032),
        ringColor:
            Array.isArray(event.ringColor) && event.ringColor.length
                ? event.ringColor.map((value) => sanitizeText(value)).filter(Boolean)
                : [
                    'rgba(191, 219, 254, 0.96)',
                    'rgba(56, 189, 248, 0.42)',
                    'rgba(56, 189, 248, 0)'
                ],
        ringMaxRadius: toNumber(event.ringMaxRadius, 4.8),
        ringPropagationSpeed: toNumber(event.ringPropagationSpeed, 1.65),
        ringRepeatPeriod: toNumber(event.ringRepeatPeriod, 680),
        lat,
        lng,
        city: sanitizeText(event.city),
        country: sanitizeText(event.country),
        countryCode: sanitizeText(event.countryCode),
        createdAt: mapTimestamp(event.createdAt) || new Date().toISOString(),
        expiresAt: mapTimestamp(event.expiresAt)
    };
}

function buildLandingPayloadFromEvents(events = []) {
    const normalizedEvents = (Array.isArray(events) ? events : [])
        .map((event, index) => normalizeLandingEvent(event, index))
        .filter(Boolean);

    const feed = getDefaultFeed();

    const latestAcademy = normalizedEvents.find((event) => event.slot === 'academy');
    const latestAccess = normalizedEvents.find((event) => event.slot === 'federation');
    const latestCommunity = normalizedEvents.find((event) => event.slot === 'plaza');

    if (latestAcademy?.message) feed.academy = latestAcademy.message;
    if (latestAccess?.message) feed.federation = latestAccess.message;
    if (latestCommunity?.message) feed.plaza = latestCommunity.message;

    const points = normalizedEvents.slice(0, 8).map((event) => ({
        id: event.id,
        lat: event.lat,
        lng: event.lng,
        label: event.label || event.message || 'Academy activity',
        color: event.color,
        altitude: event.altitude,
        coreColor: event.coreColor,
        coreAltitude: event.coreAltitude,
        coreRadius: event.coreRadius,
        ringAltitude: event.ringAltitude,
        ringColor: event.ringColor,
        ringMaxRadius: event.ringMaxRadius,
        ringPropagationSpeed: event.ringPropagationSpeed,
        ringRepeatPeriod: event.ringRepeatPeriod
    }));

    const focusPoint = points[0]
        ? {
            id: points[0].id,
            lat: points[0].lat,
            lng: points[0].lng,
            label: points[0].label
        }
        : null;

    return {
        feed,
        points,
        arcs: [],
        focusPoint,
        updatedAt: new Date().toISOString()
    };
}

async function buildPublicLandingSnapshot(limit = 24) {
    const safeLimit = Math.max(6, Math.min(toNumber(limit, 24), 50));

    const snap = await publicLandingEventsCol
        .orderBy('createdAt', 'desc')
        .limit(safeLimit)
        .get();

    const nowMs = Date.now();

    const events = snap.docs
        .map((doc) => {
            const data = doc.data() || {};
            return {
                id: doc.id,
                type: sanitizeText(data.type),
                slot: sanitizeText(data.slot || 'academy').toLowerCase(),
                category: sanitizeText(data.category || 'academy'),
                actorName: sanitizeText(data.actorName),
                username: sanitizeText(data.username),
                userId: sanitizeText(data.userId),
                feedText: sanitizeText(data.feedText),
                message: sanitizeText(data.message),
                label: sanitizeText(data.label),
                locationText: sanitizeText(data.locationText),
                color: sanitizeText(data.color || '#38bdf8'),
                altitude: toNumber(data.altitude, 0.22),
                coreColor: sanitizeText(data.coreColor || ''),
                coreAltitude: toNumber(data.coreAltitude, NaN),
                coreRadius: toNumber(data.coreRadius, NaN),
                ringAltitude: toNumber(data.ringAltitude, NaN),
                ringColor: Array.isArray(data.ringColor)
                    ? data.ringColor.map((value) => sanitizeText(value)).filter(Boolean)
                    : [],
                ringMaxRadius: toNumber(data.ringMaxRadius, NaN),
                ringPropagationSpeed: toNumber(data.ringPropagationSpeed, NaN),
                ringRepeatPeriod: toNumber(data.ringRepeatPeriod, NaN),
                lat: toNumber(data.lat, NaN),
                lng: toNumber(data.lng, NaN),
                city: sanitizeText(data.city),
                country: sanitizeText(data.country),
                countryCode: sanitizeText(data.countryCode),
                createdAt: mapTimestamp(data.createdAt),
                expiresAt: mapTimestamp(data.expiresAt)
            };
        })
        .filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lng))
        .filter((event) => {
            if (!event.expiresAt) return true;
            const expiresMs = new Date(event.expiresAt).getTime();
            return Number.isFinite(expiresMs) ? expiresMs > nowMs : true;
        });

    const uniqueEvents = [];
    const seenKeys = new Set();

    for (const event of events) {
        const eventKey = buildEventKey(event);
        if (seenKeys.has(eventKey)) continue;
        seenKeys.add(eventKey);
        uniqueEvents.push(event);
    }

    const orderedEvents = uniqueEvents
        .slice()
        .sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
        });

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

    const verifiedMembersSnap = await usersCol
        .where('isVerified', '==', true)
        .get();

    const verifiedMembers = verifiedMembersSnap.docs.map((doc) => doc.data() || {});

    const reachCountries = new Set(
        verifiedMembers
            .map((member) => sanitizeText(member.country || member.locationCountry || ''))
            .filter(Boolean)
            .map((country) => country.toLowerCase())
    );

    let impressionsCount = orderedEvents.length;

    try {
        const aggregateSnap = await publicLandingEventsCol.count().get();
        const aggregateData = typeof aggregateSnap.data === 'function' ? aggregateSnap.data() : null;
        const aggregateCount = Number(aggregateData?.count);

        if (Number.isFinite(aggregateCount) && aggregateCount >= 0) {
            impressionsCount = aggregateCount;
        }
    } catch (_) {
        impressionsCount = orderedEvents.length;
    }

    const stats = {
        members: verifiedMembers.length,
        reach: reachCountries.size,
        impressions: impressionsCount
    };

    return {
        feed,
        liveEvents,
        academyEvents,
        points,
        arcs: [],
        focusPoint,
        stats,
        updatedAt: new Date().toISOString()
    };
}

module.exports = {
    createEventForUser,
    createAcademyActionEvent,
    buildPublicLandingSnapshot
};