const { firestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

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

function buildLocationText(geo = {}) {
    const city = sanitizeText(geo.city);
    const country = sanitizeText(geo.country);

    if (city && country) return `${city}, ${country}`;
    if (country) return country;
    if (city) return city;
    return 'their region';
}

async function getUserGeo(userId) {
    const normalizedUserId = sanitizeText(userId);
    if (!normalizedUserId) return null;

    const snap = await usersCol.doc(normalizedUserId).get();
    if (!snap.exists) return null;

    const data = snap.data() || {};
    const lat = Number(data.lat);
    const lng = Number(data.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return {
        userId: normalizedUserId,
        city: sanitizeText(data.city),
        country: sanitizeText(data.country),
        countryCode: sanitizeText(data.countryCode),
        lat,
        lng
    };
}

async function createEventForUser(userId, options = {}) {
    const geo = await getUserGeo(userId);
    if (!geo) return null;

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

    const locationText = buildLocationText(geo);

    const message =
        sanitizeText(options.message) ||
        (
            sanitizeText(options.messagePrefix)
                ? `${sanitizeText(options.messagePrefix)} from ${locationText}.`
                : `Academy activity from ${locationText}.`
        );

    const label =
        sanitizeText(options.label) ||
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
        message,
        label,
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
        lat: geo.lat,
        lng: geo.lng,
        city: geo.city,
        country: geo.country,
        countryCode: geo.countryCode,
        userId: geo.userId,
        createdAt,
        expiresAt
    };

    await ref.set(payload);

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
            slot: 'federation',
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
                message: sanitizeText(data.message),
                label: sanitizeText(data.label),
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

    const feed = getDefaultFeed();

    const latestAcademy = events.find((event) => event.slot === 'academy');
    const latestAccess = events.find((event) => event.slot === 'federation');
    const latestCommunity = events.find((event) => event.slot === 'plaza');

    if (latestAcademy?.message) feed.academy = latestAcademy.message;
    if (latestAccess?.message) feed.federation = latestAccess.message;
    if (latestCommunity?.message) feed.plaza = latestCommunity.message;

    const points = events.slice(0, 8).map((event) => ({
        id: event.id,
        lat: event.lat,
        lng: event.lng,
        label: event.label || event.message || 'Academy activity',
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

    return {
        feed,
        points,
        arcs: [],
        focusPoint,
        updatedAt: new Date().toISOString()
    };
}

module.exports = {
    createEventForUser,
    createAcademyActionEvent,
    buildPublicLandingSnapshot
};