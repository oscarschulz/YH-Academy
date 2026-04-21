require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');
const { firestore } = require('./config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');
const jwt = require('jsonwebtoken');
const publicLandingEventsRepo = require('./backend/repositories/publicLandingEventsRepo');
const realtimeFirestoreRepo = require('./backend/repositories/realtimeFirestoreRepo');
const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server, {
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000
});
const publicLandingNamespace = io.of('/public-landing');

async function emitPublicLandingSnapshotToClients(limit = 24) {
    try {
        const payload = await publicLandingEventsRepo.buildPublicLandingSnapshot(limit);
        publicLandingNamespace.emit('landingSnapshot', {
            success: true,
            ...payload
        });
    } catch (error) {
        console.error('emitPublicLandingSnapshotToClients error:', error);
    }
}

global.yhEmitPublicLandingSnapshot = emitPublicLandingSnapshotToClients;

publicLandingNamespace.on('connection', (socket) => {
    console.log('🌍 Public landing socket connected:', socket.id);
    emitPublicLandingSnapshotToClients().catch((error) => {
        console.error('public landing initial snapshot error:', error);
    });

    socket.on('disconnect', () => {
        console.log('🌍 Public landing socket disconnected:', socket.id);
    });
});

const chatMessagesCol = firestore.collection('chatMessages');
const chatRoomsCol = firestore.collection('chatRooms');
const leadMissionOperatorsCol = firestore.collection('leadMissionOperators');

const sanitizeText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const mapChatTimestamp = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value || null;
};

const mapFederationConnectTimestamp = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value || null;
};

function getLeadMissionOwnerUidFromDoc(docSnap) {
    try {
        return sanitizeText(docSnap?.ref?.parent?.parent?.id || '');
    } catch (_) {
        return '';
    }
}

function normalizeFederationConnectBudgetRange(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    const allowed = new Set([
        'not_sure',
        'under_500',
        '500_1500',
        '1500_5000',
        '5000_plus'
    ]);

    return allowed.has(raw) ? raw : 'not_sure';
}

function normalizeFederationConnectUrgency(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    const allowed = new Set([
        'normal',
        'this_week',
        'urgent',
        'exploring'
    ]);

    return allowed.has(raw) ? raw : 'normal';
}

function normalizeFederationConnectIntroType(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    const allowed = new Set([
        'admin_brokered',
        'operator_intro',
        'contact_package',
        'not_sure'
    ]);

    return allowed.has(raw) ? raw : 'admin_brokered';
}

function buildFederationConnectOpportunityTitle(lead = {}) {
    const role = sanitizeText(
        lead.contactRole ||
        lead.role ||
        lead.contactType ||
        'strategic contact'
    );

    const location = [lead.city, lead.country]
        .map((item) => sanitizeText(item))
        .filter(Boolean)
        .join(', ');

    return location
        ? `Connect with a ${role} in ${location}`
        : `Connect with a ${role}`;
}

function mapFederationConnectOpportunityDoc(docSnap) {
    const lead = docSnap.data() || {};
    const ownerUid = sanitizeText(
        lead.ownerUid ||
        lead.memberId ||
        getLeadMissionOwnerUidFromDoc(docSnap)
    );

    const leadId = sanitizeText(docSnap.id);
    const category = sanitizeText(
        lead.contactType ||
        lead.category ||
        lead.industry ||
        'Strategic Network'
    );

    const contactRole = sanitizeText(
        lead.contactRole ||
        lead.role ||
        category ||
        'Strategic Contact'
    );

    return {
        id: `${ownerUid}_${leadId}`,
        leadId,
        ownerUid,
        title: buildFederationConnectOpportunityTitle(lead),
        category,
        contactRole,
        city: sanitizeText(lead.city),
        country: sanitizeText(lead.country),
        strategicValue: sanitizeText(lead.strategicValue || 'standard'),
        tier: sanitizeText(lead.tier || 'T2'),
        sourceDivision: sanitizeText(lead.sourceDivision || 'academy') || 'academy',
        pipelineStage: sanitizeText(lead.pipelineStage || lead.callOutcome || 'Review'),
        sourceMethod: sanitizeText(lead.sourceMethod || 'Lead Missions'),
        contactType: sanitizeText(lead.contactType || category),
        companyLabel: lead.companyName ? 'Private organization on file' : 'Private organization',
        hasEmail: Boolean(sanitizeText(lead.email)),
        hasPhone: Boolean(sanitizeText(lead.phone)),
        hasDirectContact: Boolean(sanitizeText(lead.email) || sanitizeText(lead.phone)),
        summary: sanitizeText(
            lead.notes ||
            lead.description ||
            'Academy-sourced lead marked as Federation-ready by admin.'
        ).slice(0, 220),
        updatedAt: mapFederationConnectTimestamp(lead.updatedAt || lead.adminNetworkUpdatedAt || lead.createdAt),
        createdAt: mapFederationConnectTimestamp(lead.createdAt)
    };
}

const AUTH_COOKIE_NAME = 'yh_auth_token';

function parseCookieHeader(raw = '') {
    const out = {};

    String(raw || '').split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return;

        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();

        if (!key) return;
        out[key] = decodeURIComponent(value);
    });

    return out;
}

function getSocketToken(socket) {
    const handshakeToken = sanitizeText(socket.handshake?.auth?.token);
    if (handshakeToken) return handshakeToken;

    const cookies = parseCookieHeader(socket.handshake?.headers?.cookie || '');
    return sanitizeText(cookies[AUTH_COOKIE_NAME]);
}

function verifySocketUser(socket) {
    const token = getSocketToken(socket);
    if (!token) return null;

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        return {
            id: sanitizeText(verified?.id || verified?.firebaseUid),
            firebaseUid: sanitizeText(verified?.firebaseUid || verified?.id),
            email: sanitizeText(verified?.email).toLowerCase(),
            username: sanitizeText(verified?.username),
            name: sanitizeText(verified?.name || verified?.username || 'Hustler')
        };
    } catch (_) {
        return null;
    }
}
function getRequestToken(req) {
    const authHeader = sanitizeText(req.headers?.authorization || '');
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return sanitizeText(authHeader.slice(7));
    }

    const headerToken = sanitizeText(req.headers?.['x-auth-token'] || '');
    if (headerToken) return headerToken;

    const cookies = parseCookieHeader(req.headers?.cookie || '');
    return sanitizeText(cookies[AUTH_COOKIE_NAME]);
}

function verifyRequestUser(req) {
    const token = getRequestToken(req);
    if (!token) return null;

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        return {
            id: sanitizeText(verified?.id || verified?.firebaseUid),
            firebaseUid: sanitizeText(verified?.firebaseUid || verified?.id),
            email: sanitizeText(verified?.email).toLowerCase(),
            username: sanitizeText(verified?.username),
            name: sanitizeText(verified?.name || verified?.username || 'Hustler')
        };
    } catch (_) {
        return null;
    }
}

function requireApiUser(req, res, next) {
    const user = verifyRequestUser(req);

    if (!user?.id) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized.'
        });
    }

    req.user = user;
    next();
}
function getAcademyVoiceSignalingRoom(roomId = '') {
    return `academy-voice:${sanitizeText(roomId)}`;
}

async function canUserAccessLiveRoom(userId, roomId) {
    const cleanUserId = sanitizeText(userId);
    const cleanRoomId = sanitizeText(roomId);

    if (!cleanUserId || !cleanRoomId) return false;

    const snap = await liveRoomsCol.doc(cleanRoomId).get();
    if (!snap.exists) return false;

    const data = snap.data() || {};
    const status = sanitizeText(data.status || 'live').toLowerCase();

    if (status !== 'live') return false;

    const participantIds = Array.isArray(data.participant_ids)
        ? data.participant_ids.map((value) => String(value)).filter(Boolean)
        : [];

    return participantIds.includes(String(cleanUserId));
}

async function canUserAccessRoom(userId, roomId) {
    if (!userId || !roomId) return false;
    if (roomId === 'YH-community' || roomId === 'main-chat') return true;

    const snap = await chatRoomsCol.doc(roomId).get();

    if (!snap.exists) {
        return canUserAccessLiveRoom(userId, roomId);
    }

    const data = snap.data() || {};
    const memberIds = Array.isArray(data.member_ids)
        ? data.member_ids.map((value) => String(value))
        : [];
    const blockedByUserIds = Array.isArray(data.blocked_by_user_ids)
        ? data.blocked_by_user_ids.map((value) => String(value))
        : [];

    if (!memberIds.includes(String(userId))) return false;
    if (blockedByUserIds.includes(String(userId))) return false;

    return true;
}

async function markRoomAsReadForUser(userId, roomId) {
    const cleanUserId = sanitizeText(userId);
    const cleanRoomId = sanitizeText(roomId);

    if (!cleanUserId || !cleanRoomId) return false;
    if (cleanRoomId === 'YH-community' || cleanRoomId === 'main-chat') return true;

    const roomRef = chatRoomsCol.doc(cleanRoomId);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) return false;

    const roomData = roomSnap.data() || {};
    const unreadCounts =
        roomData.unread_counts && typeof roomData.unread_counts === 'object'
            ? { ...roomData.unread_counts }
            : {};

    unreadCounts[cleanUserId] = 0;

    await roomRef.set({
        unread_counts: unreadCounts,
        updated_at: Timestamp.now()
    }, { merge: true });

    return true;
}
function mapChatMessageDoc(doc) {
    const data = doc.data() || {};
    const authorId = sanitizeText(
        data.created_by_user_id ||
        data.createdByUserId ||
        data.author_id ||
        data.authorId ||
        data.user_id ||
        data.userId
    );

    return {
        id: doc.id,
        room: sanitizeText(data.room),
        author: sanitizeText(data.author),
        authorId,
        author_id: authorId,
        createdByUserId: authorId,
        created_by_user_id: authorId,
        initial: sanitizeText(data.initial),
        avatar: sanitizeText(data.avatar),
        text: sanitizeText(data.text),
        time: sanitizeText(data.time || mapChatTimestamp(data.created_at)),
        upvotes: Number.isFinite(Number(data.upvotes)) ? Number(data.upvotes) : 0
    };
}

function sanitizeLeadMissionTextArray(value, maxItems = 32) {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => sanitizeText(item))
        .filter(Boolean)
        .map((item) => item.slice(0, 120))
        .slice(0, maxItems);
}

function mapFirestoreDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value || null;
}

function mapLeadMissionOperatorProfileDoc(doc) {
    const data = doc?.data?.() || {};

    return {
        id: doc.id,
        userId: sanitizeText(data.userId || doc.id),
        firebaseUid: sanitizeText(data.firebaseUid),
        email: sanitizeText(data.email),
        username: sanitizeText(data.username),
        fullName: sanitizeText(data.fullName),
        telegram: sanitizeText(data.telegram),
        country: sanitizeText(data.country),
        city: sanitizeText(data.city),
        timezone: sanitizeText(data.timezone),

        targetCategories: Array.isArray(data.targetCategories) ? data.targetCategories : [],
        strongestNiches: Array.isArray(data.strongestNiches) ? data.strongestNiches : [],
        searchPlatforms: Array.isArray(data.searchPlatforms) ? data.searchPlatforms : [],
        networkTypes: Array.isArray(data.networkTypes) ? data.networkTypes : [],

        hasLeadGenExperience: sanitizeText(data.hasLeadGenExperience),
        knowsInfluentialPeople: sanitizeText(data.knowsInfluentialPeople),
        weeklyLeadCapacity: sanitizeText(data.weeklyLeadCapacity),
        coverageRegion: sanitizeText(data.coverageRegion),

        motivation: sanitizeText(data.motivation),
        strategicValueAnswer: sanitizeText(data.strategicValueAnswer),
        followsInstructions: sanitizeText(data.followsInstructions),
        interestedInFederation: sanitizeText(data.interestedInFederation),
        interestedInPlaza: sanitizeText(data.interestedInPlaza),

        qualityAgreement: data.qualityAgreement === true,
        noFakeLeadsAgreement: data.noFakeLeadsAgreement === true,
        noSpamAgreement: data.noSpamAgreement === true,
        accessRiskAgreement: data.accessRiskAgreement === true,

        completed: data.completed === true,
        status: sanitizeText(data.status || 'active'),
        strategicValue: sanitizeText(data.strategicValue || 'unrated'),
        federationReady: data.federationReady === true,
        plazaReady: data.plazaReady === true,

        createdAt: mapFirestoreDate(data.createdAt),
        submittedAt: mapFirestoreDate(data.submittedAt),
        updatedAt: mapFirestoreDate(data.updatedAt)
    };
}

function normalizeLeadMissionOperatorProfilePayload(body = {}, user = {}) {
    const fullName = sanitizeText(body.fullName || user.name).slice(0, 140);
    const email = sanitizeText(user.email || body.email).toLowerCase().slice(0, 180);
    const telegram = sanitizeText(body.telegram).slice(0, 80);
    const country = sanitizeText(body.country).slice(0, 100);
    const city = sanitizeText(body.city).slice(0, 100);
    const timezone = sanitizeText(body.timezone).slice(0, 80);

    const profile = {
        userId: sanitizeText(user.id),
        firebaseUid: sanitizeText(user.firebaseUid || user.id),
        email,
        username: sanitizeText(user.username).slice(0, 80),
        fullName,
        telegram,
        country,
        city,
        timezone,

        targetCategories: sanitizeLeadMissionTextArray(body.targetCategories),
        strongestNiches: sanitizeLeadMissionTextArray(body.strongestNiches),
        searchPlatforms: sanitizeLeadMissionTextArray(body.searchPlatforms),
        networkTypes: sanitizeLeadMissionTextArray(body.networkTypes),

        hasLeadGenExperience: sanitizeText(body.hasLeadGenExperience).slice(0, 40),
        knowsInfluentialPeople: sanitizeText(body.knowsInfluentialPeople).slice(0, 40),
        weeklyLeadCapacity: sanitizeText(body.weeklyLeadCapacity).slice(0, 80),
        coverageRegion: sanitizeText(body.coverageRegion).slice(0, 140),

        motivation: sanitizeText(body.motivation).slice(0, 2500),
        strategicValueAnswer: sanitizeText(body.strategicValueAnswer).slice(0, 2500),
        followsInstructions: sanitizeText(body.followsInstructions).slice(0, 40),
        interestedInFederation: sanitizeText(body.interestedInFederation).slice(0, 40),
        interestedInPlaza: sanitizeText(body.interestedInPlaza).slice(0, 40),

        qualityAgreement: body.qualityAgreement === true,
        noFakeLeadsAgreement: body.noFakeLeadsAgreement === true,
        noSpamAgreement: body.noSpamAgreement === true,
        accessRiskAgreement: body.accessRiskAgreement === true,

        completed: true,
        status: sanitizeText(body.status || 'active').slice(0, 40) || 'active',
        strategicValue: sanitizeText(body.strategicValue || 'unrated').slice(0, 80) || 'unrated',
        federationReady: body.federationReady === true,
        plazaReady: body.plazaReady === true,

        source: 'academy_lead_missions_recruitment_form',
        profileVersion: 1
    };

    const missing = [];

    if (!profile.userId) missing.push('userId');
    if (!profile.fullName) missing.push('fullName');
    if (!profile.email) missing.push('email');
    if (!profile.telegram) missing.push('telegram');
    if (!profile.country) missing.push('country');
    if (!profile.city) missing.push('city');
    if (!profile.targetCategories.length) missing.push('targetCategories');
    if (!profile.strongestNiches.length) missing.push('strongestNiches');
    if (!profile.searchPlatforms.length) missing.push('searchPlatforms');
    if (!profile.hasLeadGenExperience) missing.push('hasLeadGenExperience');
    if (!profile.knowsInfluentialPeople) missing.push('knowsInfluentialPeople');
    if (!profile.weeklyLeadCapacity) missing.push('weeklyLeadCapacity');
    if (!profile.coverageRegion) missing.push('coverageRegion');
    if (!profile.motivation) missing.push('motivation');
    if (!profile.strategicValueAnswer) missing.push('strategicValueAnswer');
    if (!profile.followsInstructions) missing.push('followsInstructions');

    if (!profile.qualityAgreement) missing.push('qualityAgreement');
    if (!profile.noFakeLeadsAgreement) missing.push('noFakeLeadsAgreement');
    if (!profile.noSpamAgreement) missing.push('noSpamAgreement');
    if (!profile.accessRiskAgreement) missing.push('accessRiskAgreement');

    return {
        profile,
        missing
    };
}

// ==========================================
// ⚡ REAL-TIME SOCKET.IO LOGIC
// ==========================================
io.on('connection', (socket) => {
    const socketUser = verifySocketUser(socket);

    if (!socketUser?.id) {
        socket.emit('socketAuthError', { message: 'Unauthorized socket session.' });
        socket.disconnect(true);
        return;
    }

    socket.user = socketUser;
    console.log('⚡ A hustler connected:', socket.id, socket.user.id);

    socket.on('joinRoom', async (room) => {
        try {
            const roomId = sanitizeText(room);
            if (!roomId) return;

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) {
                socket.emit('socketRoomError', { roomId, message: 'Access denied for this room.' });
                return;
            }

            socket.join(roomId);

            const historySnap = await chatMessagesCol
                .where('room', '==', roomId)
                .limit(200)
                .get();

            const history = historySnap.docs
                .map(mapChatMessageDoc)
                .sort((a, b) => {
                    const aTime = new Date(a.time || 0).getTime();
                    const bTime = new Date(b.time || 0).getTime();
                    return aTime - bTime;
                })
                .slice(-50);

            socket.emit('chatHistory', history);
        } catch (error) {
            console.error('joinRoom error:', error);
        }
    });

    socket.on('sendMessage', async (data) => {
        try {
            const roomId = sanitizeText(data?.room);
            const text = sanitizeText(data?.text);

            if (!roomId || !text) return;

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) return;

            const authorName = sanitizeText(socket.user.name || socket.user.username || 'Hustler');

            const payload = {
                room: roomId,
                author: authorName,
                initial: authorName.charAt(0).toUpperCase(),
                avatar: '',
                text,
                time: new Date().toISOString(),
                upvotes: 0,
                created_at: Timestamp.now(),
                created_by_user_id: socket.user.id
            };

            const ref = chatMessagesCol.doc();
            await ref.set(payload);

            const roomRef = chatRoomsCol.doc(roomId);
            const roomSnap = await roomRef.get();

            if (roomSnap.exists) {
                const roomData = roomSnap.data() || {};
                const memberIds = Array.isArray(roomData.member_ids)
                    ? roomData.member_ids.map((value) => String(value)).filter(Boolean)
                    : [];

                const unreadCounts =
                    roomData.unread_counts && typeof roomData.unread_counts === 'object'
                        ? { ...roomData.unread_counts }
                        : {};

                memberIds.forEach((memberId) => {
                    unreadCounts[memberId] =
                        String(memberId) === String(socket.user.id)
                            ? 0
                            : (Number(unreadCounts[memberId]) || 0) + 1;
                });

                const hiddenForUserIds = Array.isArray(roomData.hidden_for_user_ids)
                    ? roomData.hidden_for_user_ids.map((value) => String(value)).filter(Boolean)
                    : [];

                const nextHiddenForUserIds = hiddenForUserIds.filter((value) => {
                    return !memberIds.includes(String(value));
                });

                await roomRef.set({
                    last_message_text: text,
                    last_message_author: authorName,
                    last_message_at: Timestamp.now(),
                    unread_counts: unreadCounts,
                    hidden_for_user_ids: nextHiddenForUserIds,
                    updated_at: Timestamp.now()
                }, { merge: true });
            }

            const outgoing = {
                id: ref.id,
                room: payload.room,
                author: payload.author,
                authorId: payload.created_by_user_id,
                author_id: payload.created_by_user_id,
                createdByUserId: payload.created_by_user_id,
                created_by_user_id: payload.created_by_user_id,
                initial: payload.initial,
                avatar: payload.avatar,
                text: payload.text,
                time: payload.time,
                upvotes: 0
            };

            io.to(payload.room).emit('receiveMessage', outgoing);
        } catch (error) {
            console.error('sendMessage error:', error);
        }
    });

    socket.on('upvoteMessage', async (msgId) => {
        try {
            const messageId = sanitizeText(msgId);
            if (!messageId) return;

            const ref = chatMessagesCol.doc(messageId);
            const snap = await ref.get();
            if (!snap.exists) return;

            const current = snap.data() || {};
            const roomId = sanitizeText(current.room);

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) return;

            const nextUpvotes = (Number(current.upvotes) || 0) + 1;

            await ref.update({
                upvotes: nextUpvotes
            });

            io.to(roomId).emit('messageUpvoted', {
                id: messageId,
                upvotes: nextUpvotes
            });
        } catch (error) {
            console.error('upvoteMessage error:', error);
        }
    });

    socket.on('deleteMessage', async (msgId) => {
        try {
            const messageId = sanitizeText(msgId);
            if (!messageId) return;

            const ref = chatMessagesCol.doc(messageId);
            const snap = await ref.get();
            if (!snap.exists) return;

            const current = snap.data() || {};
            const ownerId = sanitizeText(current.created_by_user_id);
            const roomId = sanitizeText(current.room);

            const allowed = await canUserAccessRoom(socket.user.id, roomId);
            if (!allowed) return;

            if (!ownerId || ownerId !== socket.user.id) {
                socket.emit('messageDeleteError', {
                    id: messageId,
                    message: 'Only the original sender can delete this message.'
                });
                return;
            }

            await ref.delete();
            io.to(roomId).emit('messageDeleted', messageId);
        } catch (error) {
            console.error('deleteMessage error:', error);
        }
    });
    function getSocketVoiceDisplayName() {
        return sanitizeText(
            socket.user?.name ||
            socket.user?.fullName ||
            socket.user?.username ||
            'Hustler'
        );
    }

    function leaveAcademyVoiceSignalingRoom(reason = 'left') {
        const roomId = sanitizeText(socket.data?.academyVoiceRoomId || '');
        if (!roomId) return;

        const signalingRoom = getAcademyVoiceSignalingRoom(roomId);

        socket.to(signalingRoom).emit('academyVoice:peerLeft', {
            roomId,
            socketId: socket.id,
            userId: socket.user?.id || '',
            reason
        });

        socket.leave(signalingRoom);
        socket.data.academyVoiceRoomId = '';
    }

    function isTargetSocketInAcademyVoiceRoom(roomId = '', targetSocketId = '') {
        const signalingRoom = getAcademyVoiceSignalingRoom(roomId);
        const roomMembers = io.sockets.adapter.rooms.get(signalingRoom);

        return Boolean(roomMembers && roomMembers.has(targetSocketId));
    }

    socket.on('academyVoice:join', async (payload = {}) => {
        try {
            const roomId = sanitizeText(payload.roomId || payload.room_id);
            if (!roomId) return;

            const allowed = await canUserAccessLiveRoom(socket.user.id, roomId);
            if (!allowed) {
                socket.emit('academyVoice:error', {
                    roomId,
                    message: 'You must join this live room before voice can connect.'
                });
                return;
            }

            const previousRoomId = sanitizeText(socket.data?.academyVoiceRoomId || '');
            if (previousRoomId && previousRoomId !== roomId) {
                leaveAcademyVoiceSignalingRoom('switched-room');
            }

            const signalingRoom = getAcademyVoiceSignalingRoom(roomId);
            const currentSocketIds = Array.from(io.sockets.adapter.rooms.get(signalingRoom) || []);

            const peers = currentSocketIds
                .filter((socketId) => socketId !== socket.id)
                .map((socketId) => {
                    const peerSocket = io.sockets.sockets.get(socketId);
                    return {
                        socketId,
                        userId: sanitizeText(peerSocket?.user?.id),
                        displayName: sanitizeText(
                            peerSocket?.user?.name ||
                            peerSocket?.user?.fullName ||
                            peerSocket?.user?.username ||
                            'Hustler'
                        )
                    };
                })
                .filter((peer) => peer.socketId);

            socket.join(signalingRoom);
            socket.data.academyVoiceRoomId = roomId;

            socket.emit('academyVoice:peers', {
                roomId,
                peers
            });

            socket.to(signalingRoom).emit('academyVoice:peerJoined', {
                roomId,
                socketId: socket.id,
                userId: socket.user.id,
                displayName: getSocketVoiceDisplayName()
            });
        } catch (error) {
            console.error('academyVoice:join error:', error);
            socket.emit('academyVoice:error', {
                message: 'Failed to join voice signaling.'
            });
        }
    });

    socket.on('academyVoice:offer', async (payload = {}) => {
        try {
            const roomId = sanitizeText(payload.roomId || payload.room_id);
            const targetSocketId = sanitizeText(payload.targetSocketId);
            const offer = payload.offer;

            if (!roomId || !targetSocketId || !offer) return;
            if (!(await canUserAccessLiveRoom(socket.user.id, roomId))) return;
            if (!isTargetSocketInAcademyVoiceRoom(roomId, targetSocketId)) return;

            io.to(targetSocketId).emit('academyVoice:offer', {
                roomId,
                fromSocketId: socket.id,
                fromUserId: socket.user.id,
                fromDisplayName: getSocketVoiceDisplayName(),
                offer
            });
        } catch (error) {
            console.error('academyVoice:offer error:', error);
        }
    });

    socket.on('academyVoice:answer', async (payload = {}) => {
        try {
            const roomId = sanitizeText(payload.roomId || payload.room_id);
            const targetSocketId = sanitizeText(payload.targetSocketId);
            const answer = payload.answer;

            if (!roomId || !targetSocketId || !answer) return;
            if (!(await canUserAccessLiveRoom(socket.user.id, roomId))) return;
            if (!isTargetSocketInAcademyVoiceRoom(roomId, targetSocketId)) return;

            io.to(targetSocketId).emit('academyVoice:answer', {
                roomId,
                fromSocketId: socket.id,
                fromUserId: socket.user.id,
                fromDisplayName: getSocketVoiceDisplayName(),
                answer
            });
        } catch (error) {
            console.error('academyVoice:answer error:', error);
        }
    });

    socket.on('academyVoice:ice', async (payload = {}) => {
        try {
            const roomId = sanitizeText(payload.roomId || payload.room_id);
            const targetSocketId = sanitizeText(payload.targetSocketId);
            const candidate = payload.candidate;

            if (!roomId || !targetSocketId || !candidate) return;
            if (!(await canUserAccessLiveRoom(socket.user.id, roomId))) return;
            if (!isTargetSocketInAcademyVoiceRoom(roomId, targetSocketId)) return;

            io.to(targetSocketId).emit('academyVoice:ice', {
                roomId,
                fromSocketId: socket.id,
                candidate
            });
        } catch (error) {
            console.error('academyVoice:ice error:', error);
        }
    });

    socket.on('academyVoice:mute', (payload = {}) => {
        const roomId = sanitizeText(payload.roomId || payload.room_id || socket.data?.academyVoiceRoomId || '');
        if (!roomId) return;

        socket.to(getAcademyVoiceSignalingRoom(roomId)).emit('academyVoice:peerMuted', {
            roomId,
            socketId: socket.id,
            userId: socket.user.id,
            muted: payload.muted === true
        });
    });

    socket.on('academyVoice:leave', () => {
        leaveAcademyVoiceSignalingRoom('left');
    });
    socket.on('disconnect', () => {
        leaveAcademyVoiceSignalingRoom('disconnect');
        console.log('❌ A hustler disconnected:', socket.id);
    });
});

// --- 🛡️ SECURITY PACKAGES ---
const rateLimit = require('express-rate-limit');

const ACADEMY_UPLOADS_ROOT = path.resolve(
    sanitizeText(process.env.PERSISTENT_UPLOADS_DIR) || path.join(__dirname, 'public', 'uploads')
);
const ACADEMY_FEED_UPLOAD_DIR = path.join(ACADEMY_UPLOADS_ROOT, 'academy-feed');
const ACADEMY_PROFILE_UPLOAD_DIR = path.join(ACADEMY_UPLOADS_ROOT, 'academy-profile');
const ACADEMY_FEED_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACADEMY_FEED_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ACADEMY_PROFILE_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function sanitizeUploadSegment(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'file';
}

function safeDecodeUploadHeaderValue(value = '') {
    const raw = sanitizeText(value);
    if (!raw) return '';
    try {
        return decodeURIComponent(raw);
    } catch (_) {
        return raw;
    }
}

function getUploadExtFromMime(mime = '') {
    const clean = sanitizeText(mime).toLowerCase().split(';')[0];

    const map = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/avif': '.avif',
        'image/svg+xml': '.svg',
        'video/mp4': '.mp4',
        'video/quicktime': '.mov',
        'video/webm': '.webm',
        'video/ogg': '.ogv',
        'video/x-matroska': '.mkv'
    };

    return map[clean] || '';
}

function getAcademyUploadKind(mime = '') {
    const clean = sanitizeText(mime).toLowerCase().split(';')[0];
    if (clean.startsWith('image/')) return 'image';
    if (clean.startsWith('video/')) return 'video';
    return '';
}

async function saveAcademyFeedUploadToLocal({ buffer, mimeType = '', originalName = '', userId = '' }) {
    const cleanMimeType = sanitizeText(mimeType).toLowerCase().split(';')[0];
    const safeUserId = sanitizeUploadSegment(userId || 'member');

    const decodedOriginalName = safeDecodeUploadHeaderValue(originalName || 'upload');
    const baseOriginalName = path.basename(decodedOriginalName || 'upload');
    const fileExtFromName = path.extname(baseOriginalName).toLowerCase();
    const safeBaseName = sanitizeUploadSegment(path.basename(baseOriginalName, fileExtFromName) || 'upload');

    const derivedKind = getAcademyUploadKind(cleanMimeType);
    const fileExt =
        fileExtFromName ||
        getUploadExtFromMime(cleanMimeType) ||
        (derivedKind === 'video' ? '.mp4' : '.jpg');

    const fileName = `${Date.now()}_${safeUserId}_${crypto.randomBytes(6).toString('hex')}_${safeBaseName}${fileExt}`;

    await fs.promises.mkdir(ACADEMY_FEED_UPLOAD_DIR, { recursive: true });

    const filePath = path.join(ACADEMY_FEED_UPLOAD_DIR, fileName);
    await fs.promises.writeFile(filePath, buffer);

    return {
        url: `/uploads/academy-feed/${fileName}`,
        kind: derivedKind,
        mimeType: cleanMimeType,
        sizeBytes: buffer.length,
        originalName: baseOriginalName
    };
}

async function saveAcademyProfileUploadToLocal({
    buffer,
    mimeType = '',
    originalName = '',
    userId = '',
    assetKind = ''
}) {
    const cleanMimeType = sanitizeText(mimeType).toLowerCase().split(';')[0];
    const safeUserId = sanitizeUploadSegment(userId || 'member');
    const safeAssetKind = sanitizeUploadSegment(assetKind || 'profile');

    const decodedOriginalName = safeDecodeUploadHeaderValue(originalName || 'upload');
    const baseOriginalName = path.basename(decodedOriginalName || 'upload');
    const fileExtFromName = path.extname(baseOriginalName).toLowerCase();
    const safeBaseName = sanitizeUploadSegment(
        path.basename(baseOriginalName, fileExtFromName) || safeAssetKind || 'profile'
    );

    const fileExt =
        fileExtFromName ||
        getUploadExtFromMime(cleanMimeType) ||
        '.jpg';

    const fileName = `${Date.now()}_${safeUserId}_${safeAssetKind}_${crypto.randomBytes(6).toString('hex')}_${safeBaseName}${fileExt}`;

    await fs.promises.mkdir(ACADEMY_PROFILE_UPLOAD_DIR, { recursive: true });

    const filePath = path.join(ACADEMY_PROFILE_UPLOAD_DIR, fileName);
    await fs.promises.writeFile(filePath, buffer);

    return {
        url: `/uploads/academy-profile/${fileName}`,
        kind: 'image',
        mimeType: cleanMimeType,
        sizeBytes: buffer.length,
        originalName: baseOriginalName
    };
}

const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (!allowedOrigins.length) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use((req, res, next) => {
    const p = String(req.path || '');

// Never cache the dashboard / academy shells and their core scripts.
if (
    p === '/dashboard' ||
    p === '/dashboard/' ||
    p === '/academy' ||
    p === '/academy/' ||
    p === '/js/dashboard.js' ||
    p === '/js/academy.js' ||
    p === '/js/dashboard-mobile-fix.js' ||
    p === '/js/yh-shared-core.js' ||
    p === '/js/yh-shared-runtime.js'
) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
}

    next();
});

app.use('/uploads/academy/profile', express.static(ACADEMY_PROFILE_UPLOAD_DIR, {
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

app.use('/uploads/academy-profile', express.static(ACADEMY_PROFILE_UPLOAD_DIR, {
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

app.use('/uploads', express.static(ACADEMY_UPLOADS_ROOT, {
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        const normalized = String(filePath || '').replace(/\\/g, '/');

        if (
            normalized.endsWith('/public/js/dashboard.js') ||
            normalized.endsWith('/public/js/academy.js') ||
            normalized.endsWith('/public/js/dashboard-mobile-fix.js') ||
            normalized.endsWith('/public/js/yh-shared-core.js') ||
            normalized.endsWith('/public/js/yh-shared-runtime.js') ||
            normalized.endsWith('/public/dashboard.html') ||
            normalized.endsWith('/public/academy.html')
        ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
        }
    }
}));

// Anti-Spam (Rate Limiting)
const AUTH_OTP_RATE_LIMIT_PATHS = new Set([
    '/verify-otp',
    '/resend-otp',
    '/forgot-password',
    '/verify-forgot-otp',
    '/reset-password'
]);

const AUTH_WRITE_RATE_LIMIT_PATHS = new Set([
    '/register',
    '/login'
]);

const PUBLIC_LANDING_RATE_LIMIT_PATHS = new Set([
    '/public/landing-feed'
]);

const authOtpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false
});

const authWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false
});

const publicLandingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 240,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => String(req.method || '').toUpperCase() !== 'GET'
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 240,
    message: { success: false, message: "Please wait a moment and try again." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        const path = String(req.path || '').trim().toLowerCase();

        // Do not rate-limit admin routes.
        // Anyone who already knows the secret admin URL and correct credentials
        // should not be blocked by the generic public API limiter.
        if (path === '/admin/login' || path.startsWith('/admin/')) return true;

        // OTP / password recovery routes use their own relaxed limiter.
        if (AUTH_OTP_RATE_LIMIT_PATHS.has(path)) return true;

        // Register/login should not share the same bucket as public polling routes.
        if (AUTH_WRITE_RATE_LIMIT_PATHS.has(path)) return true;

        // Public landing live polling uses its own dedicated limiter.
        if (PUBLIC_LANDING_RATE_LIMIT_PATHS.has(path)) return true;

        // Academy UI reads (feed, member search, membership status) are normal in-app polling.
        // The generic limiter is too aggressive here and causes 429 spam in the console.
        const method = String(req.method || '').trim().toUpperCase();
        if (method === 'GET') {
            if (path === '/academy/membership-status') return true;
            if (path === '/academy/community/members') return true;
            if (path === '/academy/feed' || path.startsWith('/academy/feed/')) return true;
            if (path === '/plaza/feed' || path.startsWith('/plaza/feed/')) return true;
            if (path === '/plaza/opportunities' || path.startsWith('/plaza/opportunities/')) return true;
            if (path === '/plaza/directory' || path.startsWith('/plaza/directory/')) return true;
            if (path === '/plaza/regions' || path.startsWith('/plaza/regions/')) return true;
        }

        return false;
    }
});

app.use('/api/verify-otp', authOtpLimiter);
app.use('/api/resend-otp', authOtpLimiter);
app.use('/api/forgot-password', authOtpLimiter);
app.use('/api/verify-forgot-otp', authOtpLimiter);
app.use('/api/reset-password', authOtpLimiter);

app.use('/api/register', authWriteLimiter);
app.use('/api/login', authWriteLimiter);
app.use('/api/public/landing-feed', publicLandingLimiter);

app.use('/api', apiLimiter);

// --- MVC ROUTING ---
const viewRoutes = require('./routes/viewRoutes');
const apiRoutes = require('./routes/apiRoutes');
const { createAdminRouters } = require('./routes/admin-auth-routes');
const { startAiNurtureWorker } = require('./backend/services/aiNurtureWorker');

const { pageRouter: adminPageRouter, apiRouter: adminApiRouter } = createAdminRouters({
    privateAdminDir: path.join(__dirname, 'private', 'admin')
});

app.use(adminApiRouter);
app.use(adminPageRouter);

app.use('/', viewRoutes);

app.post(
    '/api/academy/feed/uploads',
    requireApiUser,
    express.raw({
        type: ['image/*', 'video/*', 'application/octet-stream'],
        limit: '100mb'
    }),
    async (req, res) => {
        try {
            const transportMimeType = sanitizeText(req.headers?.['content-type'])
                .toLowerCase()
                .split(';')[0];

            const declaredMimeType = sanitizeText(req.headers?.['x-file-mime'])
                .toLowerCase()
                .split(';')[0];

            const mimeType = declaredMimeType || transportMimeType;
            const originalName = safeDecodeUploadHeaderValue(req.headers?.['x-file-name'] || 'upload');
            const requestedKind = sanitizeText(req.headers?.['x-media-kind']).toLowerCase();

            const buffer = Buffer.isBuffer(req.body)
                ? req.body
                : typeof req.body === 'string'
                    ? Buffer.from(req.body)
                    : Buffer.alloc(0);

            const detectedKind = getAcademyUploadKind(mimeType);
            const mediaKind =
                requestedKind === 'video'
                    ? 'video'
                    : requestedKind === 'image'
                        ? 'image'
                        : detectedKind;

            if (!buffer.length) {
                return res.status(400).json({
                    success: false,
                    message: 'No file data received.'
                });
            }

            if (!mediaKind || !['image', 'video'].includes(mediaKind)) {
                return res.status(400).json({
                    success: false,
                    message: 'Only image and video uploads are supported.'
                });
            }

            if (mediaKind === 'image' && !mimeType.startsWith('image/')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid image upload.'
                });
            }

            if (mediaKind === 'video' && !mimeType.startsWith('video/')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid video upload.'
                });
            }

            const maxBytes =
                mediaKind === 'video'
                    ? ACADEMY_FEED_MAX_VIDEO_BYTES
                    : ACADEMY_FEED_MAX_IMAGE_BYTES;

            if (buffer.length > maxBytes) {
                return res.status(400).json({
                    success: false,
                    message:
                        mediaKind === 'video'
                            ? 'Video must be 100MB or smaller.'
                            : 'Image must be 10MB or smaller.'
                });
            }

            const media = await saveAcademyFeedUploadToLocal({
                buffer,
                mimeType,
                originalName,
                userId: req.user.id
            });

            return res.status(201).json({
                success: true,
                media
            });
        } catch (error) {
            console.error('academy feed upload error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to upload media.'
            });
        }
    }
);

app.post(
    '/api/academy/profile/uploads',
    requireApiUser,
    express.raw({
        type: ['image/*', 'application/octet-stream'],
        limit: '12mb'
    }),
    async (req, res) => {
        try {
            const transportMimeType = sanitizeText(req.headers?.['content-type'])
                .toLowerCase()
                .split(';')[0];

            const declaredMimeType = sanitizeText(req.headers?.['x-file-mime'])
                .toLowerCase()
                .split(';')[0];

            const mimeType = declaredMimeType || transportMimeType;
            const originalName = safeDecodeUploadHeaderValue(req.headers?.['x-file-name'] || 'profile.jpg');
            const assetKind = sanitizeText(req.headers?.['x-asset-kind'] || 'profile').toLowerCase();

            const buffer = Buffer.isBuffer(req.body)
                ? req.body
                : typeof req.body === 'string'
                    ? Buffer.from(req.body)
                    : Buffer.alloc(0);

            if (!buffer.length) {
                return res.status(400).json({
                    success: false,
                    message: 'No image data received.'
                });
            }

            if (!mimeType.startsWith('image/')) {
                return res.status(400).json({
                    success: false,
                    message: 'Only image uploads are supported for profile assets.'
                });
            }

            if (buffer.length > ACADEMY_PROFILE_MAX_IMAGE_BYTES) {
                return res.status(400).json({
                    success: false,
                    message: 'Profile image must be 10MB or smaller.'
                });
            }

            const media = await saveAcademyProfileUploadToLocal({
                buffer,
                mimeType,
                originalName,
                userId: req.user.id,
                assetKind
            });

            return res.status(201).json({
                success: true,
                media
            });
        } catch (error) {
            console.error('academy profile upload error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to upload profile image.'
            });
        }
    }
);

app.post('/api/realtime/rooms/:roomId/read', requireApiUser, async (req, res) => {
    try {
        const roomId = sanitizeText(req.params.roomId);
        const userId = sanitizeText(req.user?.id);

        if (!roomId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing room or user.'
            });
        }

        const allowed = await canUserAccessRoom(userId, roomId);
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: 'Access denied for this room.'
            });
        }

        await markRoomAsReadForUser(userId, roomId);

        return res.json({
            success: true,
            roomId,
            read: true
        });
    } catch (error) {
        console.error('mark room as read error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to mark room as read.'
        });
    }
});

app.get('/api/academy/lead-missions/operator-profile', requireApiUser, async (req, res) => {
    try {
        const userId = sanitizeText(req.user?.id);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const snap = await leadMissionOperatorsCol.doc(userId).get();

        if (!snap.exists) {
            return res.json({
                success: true,
                exists: false,
                profile: null
            });
        }

        return res.json({
            success: true,
            exists: true,
            profile: mapLeadMissionOperatorProfileDoc(snap)
        });
    } catch (error) {
        console.error('get lead mission operator profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Lead Missions profile.'
        });
    }
});

app.post('/api/academy/lead-missions/operator-profile', requireApiUser, async (req, res) => {
    try {
        const userId = sanitizeText(req.user?.id);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const { profile, missing } = normalizeLeadMissionOperatorProfilePayload(req.body || {}, req.user || {});

        if (missing.length) {
            return res.status(400).json({
                success: false,
                message: `Please complete the required Lead Missions profile fields: ${missing.join(', ')}.`,
                missing
            });
        }

        const ref = leadMissionOperatorsCol.doc(userId);
        const snap = await ref.get();
        const now = Timestamp.now();

        const payload = {
            ...profile,
            createdAt: snap.exists ? (snap.data()?.createdAt || now) : now,
            submittedAt: snap.exists ? (snap.data()?.submittedAt || now) : now,
            updatedAt: now
        };

        await ref.set(payload, { merge: true });

        const savedSnap = await ref.get();

        return res.json({
            success: true,
            exists: true,
            profile: mapLeadMissionOperatorProfileDoc(savedSnap)
        });
    } catch (error) {
        console.error('save lead mission operator profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save Lead Missions profile.'
        });
    }
});
function mapFederationMemberUserDoc(docSnap) {
    const user = docSnap.data() || {};
    const userId = sanitizeText(docSnap.id);

    const application =
        user.federationApplication && typeof user.federationApplication === 'object'
            ? user.federationApplication
            : {};

    const name = sanitizeText(
        application.fullName ||
        application.name ||
        user.fullName ||
        user.name ||
        user.displayName ||
        user.username ||
        'Federation Member'
    );

    const role = sanitizeText(
        application.role ||
        application.profession ||
        user.profession ||
        user.role ||
        'Approved Federation Member'
    );

    const category = sanitizeText(
        application.primaryCategory ||
        user.primaryCategory ||
        user.category ||
        'Strategic Operator'
    );

    const country = sanitizeText(application.country || user.country || '');
    const city = sanitizeText(application.city || user.city || '');

    return {
        id: userId,
        userId,
        email: sanitizeText(user.email || application.email || '').toLowerCase(),
        emailLower: sanitizeText(user.email || application.email || '').toLowerCase(),
        name,
        role,
        badge: sanitizeText(user.federationBadge || application.badge || 'Verified'),
        category,
        country,
        city,
        company: sanitizeText(application.company || user.company || ''),
        description: sanitizeText(
            application.networkValue ||
            application.valueBring ||
            application.background ||
            user.bio ||
            'Approved Federation member with verified strategic access.'
        ).slice(0, 240),
        approvedAt: mapFederationConnectTimestamp(user.federationApprovedAt || user.updatedAt || application.reviewedAt),
        source: 'server'
    };
}
function isFederationApprovedServerUser(user = {}) {
    const status = sanitizeText(
        user.federationMembershipStatus ||
        user.federationApplicationStatus ||
        user.federationApplication?.status ||
        ''
    ).toLowerCase();

    return user.hasFederationAccess === true || status === 'approved';
}

function buildFederationReferralCode(userId = '', name = '') {
    const base = sanitizeText(name || userId || 'MEMBER')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 8) || 'MEMBER';

    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `YHF-${base}-${suffix}`;
}

async function getFederationUserState(req) {
    const userId = sanitizeText(req.user?.id);
    const userRef = firestore.collection('users').doc(userId);
    const userSnap = await userRef.get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};

    const application =
        user.federationApplication && typeof user.federationApplication === 'object'
            ? user.federationApplication
            : null;

    const approved = isFederationApprovedServerUser(user);
    let member = approved ? mapFederationMemberUserDoc(userSnap) : null;

    if (approved && member && !member.referralCode) {
        const nextCode = buildFederationReferralCode(userId, member.name);

        await userRef.set({
            federationReferralCode: nextCode,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        member = {
            ...member,
            referralCode: nextCode
        };
    }

    return {
        userId,
        userRef,
        user,
        application,
        approved,
        member
    };
}

function mapFederationRequestDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        leadId: sanitizeText(data.leadId),
        ownerUid: sanitizeText(data.ownerUid),
        opportunityTitle: sanitizeText(data.opportunityTitle),
        status: sanitizeText(data.status || 'pending_admin_match'),
        adminStatus: sanitizeText(data.adminStatus || 'pending_review'),
        budgetRange: sanitizeText(data.budgetRange || 'not_sure'),
        urgency: sanitizeText(data.urgency || 'normal'),
        preferredIntroType: sanitizeText(data.preferredIntroType || 'admin_brokered'),
        requestReason: sanitizeText(data.requestReason),
        intendedUse: sanitizeText(data.intendedUse),
        notes: sanitizeText(data.notes),
        createdAt: mapFederationConnectTimestamp(data.createdAt),
        updatedAt: mapFederationConnectTimestamp(data.updatedAt)
    };
}

async function getFederationReferralSnapshot(member = {}) {
    const referralCode = sanitizeText(member.referralCode).toUpperCase();
    const memberEmail = sanitizeText(member.email).toLowerCase();
    const memberUserId = sanitizeText(member.userId || member.id);

    const usersSnap = await firestore.collection('users').limit(500).get();
    const referredApplications = [];

    usersSnap.forEach((docSnap) => {
        const user = docSnap.data() || {};
        const app =
            user.federationApplication && typeof user.federationApplication === 'object'
                ? user.federationApplication
                : null;

        if (!app) return;

        const byCode =
            referralCode &&
            sanitizeText(app.referralCodeUsed || app.referredByCode).toUpperCase() === referralCode;

        const byEmail =
            memberEmail &&
            sanitizeText(app.referredByEmail).toLowerCase() === memberEmail;

        const byMemberId =
            memberUserId &&
            sanitizeText(app.referredByMemberId || app.referredByUserId) === memberUserId;

        if (!byCode && !byEmail && !byMemberId) return;

        referredApplications.push({
            id: sanitizeText(app.id || `FED-APP-${docSnap.id}`),
            userId: docSnap.id,
            fullName: sanitizeText(app.fullName || app.name || user.fullName || user.name || 'Federation Applicant'),
            email: sanitizeText(app.email || user.email || '').toLowerCase(),
            role: sanitizeText(app.role || app.profession || ''),
            primaryCategory: sanitizeText(app.primaryCategory || ''),
            country: sanitizeText(app.country || user.country || ''),
            city: sanitizeText(app.city || user.city || ''),
            status: sanitizeText(app.status || user.federationApplicationStatus || 'Under Review'),
            createdAt: mapFederationConnectTimestamp(app.createdAt || app.submittedAt || user.createdAt),
            submittedAt: mapFederationConnectTimestamp(app.submittedAt || app.createdAt)
        });
    });

    referredApplications.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    return {
        referralCode,
        inviteUrlPath: `/?ref=${encodeURIComponent(referralCode)}`,
        total: referredApplications.length,
        pending: referredApplications.filter((item) =>
            ['pending', 'under review', 'screening'].includes(String(item.status || '').toLowerCase())
        ).length,
        shortlisted: referredApplications.filter((item) =>
            String(item.status || '').toLowerCase() === 'shortlisted'
        ).length,
        approved: referredApplications.filter((item) =>
            String(item.status || '').toLowerCase() === 'approved'
        ).length,
        recent: referredApplications.slice(0, 10)
    };
}
app.get('/api/federation/me', requireApiUser, async (req, res) => {
    try {
        const fedState = await getFederationUserState(req);
        const user = fedState.user || {};

        const currentUser = {
            id: fedState.userId,
            email: sanitizeText(user.email || req.user?.email || '').toLowerCase(),
            emailLower: sanitizeText(user.email || req.user?.email || '').toLowerCase(),
            name: sanitizeText(
                user.fullName ||
                user.name ||
                user.displayName ||
                req.user?.name ||
                req.user?.username ||
                'Federation Member'
            ),
            username: sanitizeText(user.username || req.user?.username || '')
        };

        const rawStatus = sanitizeText(
            user.federationMembershipStatus ||
            user.federationApplicationStatus ||
            fedState.application?.status ||
            ''
        );

        const referrals = fedState.member
            ? await getFederationReferralSnapshot(fedState.member)
            : null;

        return res.json({
            success: true,
            currentUser,
            application: fedState.application,
            applications: fedState.application ? [fedState.application] : [],
            applicationStatus: rawStatus,
            canEnterFederation: fedState.approved,
            member: fedState.member,
            referrals
        });
    } catch (error) {
        console.error('federation me error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation member state.'
        });
    }
});

app.get('/api/federation/directory', requireApiUser, async (req, res) => {
    try {
        const snap = await firestore
            .collection('users')
            .where('hasFederationAccess', '==', true)
            .limit(200)
            .get();

        const members = [];

        snap.forEach((docSnap) => {
            members.push(mapFederationMemberUserDoc(docSnap));
        });

        members.sort((a, b) => {
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        return res.json({
            success: true,
            members
        });
    } catch (error) {
        console.error('federation directory error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation directory.'
        });
    }
});
app.get('/api/federation/command', requireApiUser, async (req, res) => {
    try {
        const fedState = await getFederationUserState(req);

        if (!fedState.approved) {
            return res.status(403).json({
                success: false,
                message: 'Federation access is required.'
            });
        }

        const membersSnap = await firestore
            .collection('users')
            .where('hasFederationAccess', '==', true)
            .limit(300)
            .get();

        const members = [];
        membersSnap.forEach((docSnap) => members.push(mapFederationMemberUserDoc(docSnap)));

        let requests = [];

        try {
            const requestsSnap = await firestore
                .collection('federationConnectionRequests')
                .where('requesterUid', '==', fedState.userId)
                .limit(100)
                .get();

            requestsSnap.forEach((docSnap) => requests.push(mapFederationRequestDoc(docSnap)));
        } catch (error) {
            console.error('federation command requests query error:', error);
            requests = [];
        }

        let connectOpportunitiesCount = 0;

        try {
            const connectSnap = await firestore
                .collectionGroup('academyLeadMissions')
                .where('federationReady', '==', true)
                .limit(100)
                .get();

            connectOpportunitiesCount = connectSnap.size;
        } catch (error) {
            console.error('federation command opportunities query error:', error);
            connectOpportunitiesCount = 0;
        }

        const countries = new Set(members.map((member) => member.country).filter(Boolean));
        const categories = new Set(members.map((member) => member.category).filter(Boolean));
        return res.json({
            success: true,
            command: {
                member: fedState.member,
                stats: {
                    approvedMembers: members.length,
                    countriesActive: countries.size,
                    sectorsLive: categories.size,
                    connectOpportunities: connectOpportunitiesCount,
                    myRequests: requests.length,
                    pendingRequests: requests.filter((item) =>
                        ['pending_admin_match', 'pending_review'].includes(String(item.status || '').toLowerCase())
                    ).length,
                    completedRequests: requests.filter((item) =>
                        String(item.status || '').toLowerCase() === 'completed'
                    ).length
                }
            }
        });
    } catch (error) {
        console.error('federation command error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation command.'
        });
    }
});

app.get('/api/federation/referrals', requireApiUser, async (req, res) => {
    try {
        const fedState = await getFederationUserState(req);

        if (!fedState.approved) {
            return res.status(403).json({
                success: false,
                message: 'Federation access is required.'
            });
        }

        const referrals = await getFederationReferralSnapshot(fedState.member);

        return res.json({
            success: true,
            referrals
        });
    } catch (error) {
        console.error('federation referrals error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation referrals.'
        });
    }
});

app.get('/api/federation/requests', requireApiUser, async (req, res) => {
    try {
        const fedState = await getFederationUserState(req);

        if (!fedState.approved) {
            return res.status(403).json({
                success: false,
                message: 'Federation access is required.'
            });
        }

        const snap = await firestore
            .collection('federationConnectionRequests')
            .where('requesterUid', '==', fedState.userId)
            .limit(100)
            .get();

        const requests = [];
        snap.forEach((docSnap) => requests.push(mapFederationRequestDoc(docSnap)));

        requests.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

        return res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error('federation requests error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation requests.'
        });
    }
});
app.get('/api/federation/connect/opportunities', requireApiUser, async (req, res) => {
    try {
        let snap = null;

        try {
            snap = await firestore
                .collectionGroup('academyLeadMissions')
                .where('federationReady', '==', true)
                .limit(80)
                .get();
        } catch (queryError) {
            console.error('federation connect opportunities query error:', queryError);

            return res.json({
                success: true,
                opportunities: [],
                warning: 'Federation Connect opportunities are temporarily unavailable.'
            });
        }

        const opportunities = [];

        snap.forEach((docSnap) => {
            try {
                const opportunity = mapFederationConnectOpportunityDoc(docSnap);

                if (opportunity.leadId && opportunity.ownerUid) {
                    opportunities.push(opportunity);
                }
            } catch (mapError) {
                console.error('federation connect opportunity map error:', mapError);
            }
        });

        const strategicRank = {
            strategic: 5,
            high: 4,
            medium: 3,
            watch: 2,
            standard: 1
        };

        opportunities.sort((a, b) => {
            const rankA = strategicRank[String(a.strategicValue || '').toLowerCase()] || 0;
            const rankB = strategicRank[String(b.strategicValue || '').toLowerCase()] || 0;

            if (rankA !== rankB) return rankB - rankA;

            return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
        });

        return res.json({
            success: true,
            opportunities
        });
    } catch (error) {
        console.error('federation connect opportunities error:', error);

        return res.json({
            success: true,
            opportunities: [],
            warning: 'Federation Connect opportunities could not be loaded.'
        });
    }
});

app.get('/api/federation/connect/my-requests', requireApiUser, async (req, res) => {
    try {
        const requesterUid = sanitizeText(req.user?.id);

        if (!requesterUid) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        let snap = null;

        try {
            snap = await firestore
                .collection('federationConnectionRequests')
                .where('requesterUid', '==', requesterUid)
                .limit(80)
                .get();
        } catch (queryError) {
            console.error('federation connect my requests query error:', queryError);

            return res.json({
                success: true,
                requests: [],
                warning: 'Federation Connect requests are temporarily unavailable.'
            });
        }

        const requests = [];

        snap.forEach((docSnap) => {
            try {
                const data = docSnap.data() || {};

                requests.push({
                    id: docSnap.id,
                    leadId: sanitizeText(data.leadId),
                    ownerUid: sanitizeText(data.ownerUid),
                    leadPath: sanitizeText(data.leadPath),
                    requestMode: sanitizeText(data.requestMode || 'selected_lead'),
                    requestedContact: data.requestedContact && typeof data.requestedContact === 'object'
                        ? data.requestedContact
                        : null,

                    opportunityId: sanitizeText(data.opportunityId),
                    opportunityTitle: sanitizeText(data.opportunityTitle),
                    opportunitySnapshot: data.opportunitySnapshot && typeof data.opportunitySnapshot === 'object'
                        ? data.opportunitySnapshot
                        : null,

                    matchedLeadSnapshot: data.matchedLeadSnapshot && typeof data.matchedLeadSnapshot === 'object'
                        ? data.matchedLeadSnapshot
                        : null,
                    matchedAt: mapFederationConnectTimestamp(data.matchedAt),
                    matchedBy: sanitizeText(data.matchedBy),

                    status: sanitizeText(data.status || 'pending_admin_match'),
                    adminStatus: sanitizeText(data.adminStatus || 'pending_review'),

                    pricingAmount: Number(data.pricingAmount || data.dealPackage?.pricingAmount || 0),
                    currency: sanitizeText(data.currency || data.dealPackage?.currency || 'USD') || 'USD',
                    platformCommissionRate: Number(data.platformCommissionRate || data.dealPackage?.platformCommissionRate || 0),
                    platformCommissionAmount: Number(data.platformCommissionAmount || data.dealPackage?.platformCommissionAmount || 0),
                    operatorPayoutAmount: Number(data.operatorPayoutAmount || data.dealPackage?.operatorPayoutAmount || 0),
                    paymentStatus: sanitizeText(data.paymentStatus || data.dealPackage?.paymentStatus || 'not_started'),
                    payoutStatus: sanitizeText(data.payoutStatus || data.dealPackage?.payoutStatus || 'not_started'),
                    commissionStatus: sanitizeText(data.commissionStatus || data.dealPackage?.commissionStatus || 'not_started'),
                    dealNotes: sanitizeText(data.dealNotes || data.dealPackage?.dealNotes),

                    budgetRange: sanitizeText(data.budgetRange || 'not_sure'),
                    urgency: sanitizeText(data.urgency || 'normal'),
                    preferredIntroType: sanitizeText(data.preferredIntroType || 'admin_brokered'),
                    requestReason: sanitizeText(data.requestReason),
                    intendedUse: sanitizeText(data.intendedUse),
                    createdAt: mapFederationConnectTimestamp(data.createdAt),
                    updatedAt: mapFederationConnectTimestamp(data.updatedAt)
                });
            } catch (mapError) {
                console.error('federation connect request map error:', mapError);
            }
        });

        requests.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

        return res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error('federation connect my requests error:', error);

        return res.json({
            success: true,
            requests: [],
            warning: 'Federation Connect requests could not be loaded.'
        });
    }
});

app.post('/api/federation/connect/requests', requireApiUser, async (req, res) => {
    try {
        const requesterUid = sanitizeText(req.user?.id);
        const requesterEmail = sanitizeText(req.user?.email).toLowerCase();
        const requesterName = sanitizeText(req.user?.name || req.user?.username || 'Federation Member');

        const body = req.body || {};
        const ownerUid = sanitizeText(body.ownerUid);
        const leadId = sanitizeText(body.leadId);
        const hasSelectedLead = Boolean(ownerUid && leadId);

        const requestedContact = {
            companyName: sanitizeText(body.companyName).slice(0, 180),
            companyWebsite: sanitizeText(body.companyWebsite).slice(0, 500),
            contactName: sanitizeText(body.contactName).slice(0, 180),
            contactRole: sanitizeText(body.contactRole).slice(0, 180),
            contactType: sanitizeText(body.contactType).slice(0, 120),
            city: sanitizeText(body.city).slice(0, 120),
            country: sanitizeText(body.country).slice(0, 120),
            sourceMethod: sanitizeText(body.sourceMethod).slice(0, 120),
            channel: sanitizeText(body.channel).slice(0, 120),
            pipelineStage: sanitizeText(body.pipelineStage).slice(0, 120),
            priority: sanitizeText(body.priority).slice(0, 80),
            requestedTier: sanitizeText(body.requestedTier).slice(0, 40)
        };

        if (!requestedContact.contactRole || !requestedContact.contactType || !requestedContact.country) {
            return res.status(400).json({
                success: false,
                message: 'Please add the contact role, contact type, and country.'
            });
        }

        const requestReason = sanitizeText(body.requestReason).slice(0, 1200);

        if (!requestReason || requestReason.length < 12) {
            return res.status(400).json({
                success: false,
                message: 'Please explain why you need this contact.'
            });
        }

        let leadRef = null;
        let opportunity = {
            id: '',
            leadId: '',
            ownerUid: '',
            title: `Looking for ${requestedContact.contactRole} in ${requestedContact.city ? `${requestedContact.city}, ` : ''}${requestedContact.country}`,
            category: requestedContact.contactType || 'Strategic Network',
            contactRole: requestedContact.contactRole,
            city: requestedContact.city,
            country: requestedContact.country,
            strategicValue: 'requested',
            tier: requestedContact.requestedTier || '',
            sourceDivision: 'federation',
            pipelineStage: requestedContact.pipelineStage || '',
            sourceMethod: requestedContact.sourceMethod || '',
            contactType: requestedContact.contactType,
            companyLabel: requestedContact.companyName || 'Requested organization',
            hasEmail: false,
            hasPhone: false,
            hasDirectContact: false,
            summary: requestReason,
            createdAt: null,
            updatedAt: null
        };

        if (hasSelectedLead) {
            leadRef = firestore
                .collection('users')
                .doc(ownerUid)
                .collection('academyLeadMissions')
                .doc(leadId);

            const leadSnap = await leadRef.get();

            if (!leadSnap.exists) {
                return res.status(404).json({
                    success: false,
                    message: 'This Federation Connect opportunity is no longer available.'
                });
            }

            const lead = leadSnap.data() || {};

            if (lead.federationReady !== true) {
                return res.status(403).json({
                    success: false,
                    message: 'This lead has not been approved for Federation Connect.'
                });
            }

            opportunity = mapFederationConnectOpportunityDoc(leadSnap);
        }

        const now = Timestamp.now();

        const requestPayload = {
            requesterUid,
            requesterEmail,
            requesterName,

            ownerUid: hasSelectedLead ? ownerUid : '',
            leadId: hasSelectedLead ? leadId : '',
            leadPath: hasSelectedLead && leadRef ? leadRef.path : '',
            requestMode: hasSelectedLead ? 'selected_lead' : 'match_request',
            requestedContact,

            sourceDivision: 'federation',
            sourceFeature: 'connect',

            opportunityId: opportunity.id,
            opportunityTitle: opportunity.title,
            opportunitySnapshot: opportunity,

            requestReason,
            intendedUse: sanitizeText(body.intendedUse).slice(0, 1200),
            budgetRange: normalizeFederationConnectBudgetRange(body.budgetRange),
            urgency: normalizeFederationConnectUrgency(body.urgency),
            preferredIntroType: normalizeFederationConnectIntroType(body.preferredIntroType),
            notes: sanitizeText(body.notes).slice(0, 1200),

            status: 'pending_admin_match',
            adminStatus: 'pending_review',
            payoutStatus: 'not_started',
            commissionStatus: 'not_started',

            createdAt: now,
            updatedAt: now
        };

        const ref = await firestore.collection('federationConnectionRequests').add(requestPayload);

        return res.status(201).json({
            success: true,
            request: {
                id: ref.id,
                ...requestPayload,
                createdAt: mapFederationConnectTimestamp(requestPayload.createdAt),
                updatedAt: mapFederationConnectTimestamp(requestPayload.updatedAt)
            }
        });
    } catch (error) {
        console.error('federation connect request create error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit Federation Connect request.'
        });
    }
});

app.get('/api/federation/application-status', requireApiUser, async (req, res) => {
    try {
        const userId = sanitizeText(req.user?.id);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const snap = await firestore.collection('users').doc(userId).get();
        const user = snap.exists ? (snap.data() || {}) : {};

        const application =
            user.federationApplication && typeof user.federationApplication === 'object'
                ? user.federationApplication
                : null;

        const status = sanitizeText(
            user.federationApplicationStatus ||
            user.federationMembershipStatus ||
            application?.status ||
            ''
        );

        const approved =
            user.hasFederationAccess === true ||
            status.toLowerCase() === 'approved';

        return res.json({
            success: true,
            hasApplication: Boolean(application),
            canEnterFederation: approved,
            applicationStatus: status,
            application,
            member: approved
                ? {
                    id: userId,
                    name: sanitizeText(user.fullName || user.name || user.displayName || req.user?.name || 'Federation Member'),
                    email: sanitizeText(user.email || req.user?.email || ''),
                    divisions: ['Federation'],
                    status: 'Active'
                }
                : null
        });
    } catch (error) {
        console.error('federation application status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load Federation application status.'
        });
    }
});

app.post('/api/federation/application', requireApiUser, async (req, res) => {
    try {
        const userId = sanitizeText(req.user?.id);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized.'
            });
        }

        const body = req.body || {};
        const nowIso = new Date().toISOString();

        const fullName = sanitizeText(body.fullName || body.name || req.user?.name || 'Federation Applicant').slice(0, 160);
        const email = sanitizeText(body.email || req.user?.email || '').toLowerCase().slice(0, 180);
        const role = sanitizeText(body.role || body.profession).slice(0, 180);
        const country = sanitizeText(body.country).slice(0, 120);
        const city = sanitizeText(body.city).slice(0, 120);
        const primaryCategory = sanitizeText(body.primaryCategory || body.category).slice(0, 180);

        if (!fullName || !email || !role || !country || !city || !primaryCategory) {
            return res.status(400).json({
                success: false,
                message: 'Please complete all required Federation application fields.'
            });
        }

        const userRef = firestore.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const user = userSnap.exists ? (userSnap.data() || {}) : {};

        const existingApplication =
            user.federationApplication && typeof user.federationApplication === 'object'
                ? user.federationApplication
                : null;

        const existingStatus = sanitizeText(
            user.federationApplicationStatus ||
            existingApplication?.status ||
            ''
        ).toLowerCase();

        if (
            existingApplication &&
            existingStatus &&
            existingStatus !== 'rejected' &&
            existingStatus !== 'declined' &&
            existingStatus !== 'denied'
        ) {
            return res.json({
                success: true,
                alreadySubmitted: true,
                application: existingApplication,
                applicationStatus: existingApplication.status || user.federationApplicationStatus || 'Under Review'
            });
        }

        const applicationId =
            sanitizeText(body.id) ||
            `FED-APP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        const application = {
            ...body,
            id: applicationId,
            applicationType: 'federation-access',
            division: 'Federation',
            divisions: ['Federation'],
            recommendedDivision: 'Federation',
            reviewLane: 'Federation Access',
            source: sanitizeText(body.source || 'Dashboard Federation Application'),
            status: 'Under Review',

            name: fullName,
            fullName,
            username: sanitizeText(body.username || user.username || req.user?.username || ''),
            email,
            telegram: sanitizeText(body.telegram).slice(0, 120),
            role,
            profession: role,
            country,
            city,
            region: sanitizeText(body.region || [city, country].filter(Boolean).join(', ')),
            company: sanitizeText(body.company).slice(0, 180),
            profileLink: sanitizeText(body.profileLink).slice(0, 500),
            primaryCategory,

            goal: sanitizeText(body.goal || body.wantedContactReason || 'Apply for Federation access.').slice(0, 1200),
            background: sanitizeText(body.background || [role, body.company, primaryCategory, city, country].filter(Boolean).join(' • ')).slice(0, 1200),
            networkValue: sanitizeText(body.networkValue || body.valueBring).slice(0, 2500),
            valueBring: sanitizeText(body.valueBring).slice(0, 2500),
            accessContribution: sanitizeText(body.accessContribution).slice(0, 2500),
            regionsOfAccess: sanitizeText(body.regionsOfAccess).slice(0, 1200),

            lookingForContact: sanitizeText(body.lookingForContact).slice(0, 80),
            wantedContactTypes: Array.isArray(body.wantedContactTypes) ? body.wantedContactTypes : [],
            wantedContactTypesRaw: sanitizeText(body.wantedContactTypesRaw).slice(0, 1200),
            wantedContactRegion: sanitizeText(body.wantedContactRegion).slice(0, 1200),
            wantedContactReason: sanitizeText(body.wantedContactReason).slice(0, 2500),
            contactUrgency: sanitizeText(body.contactUrgency).slice(0, 80),

            canProvideContacts: sanitizeText(body.canProvideContacts).slice(0, 80),
            contactTypesCanProvide: Array.isArray(body.contactTypesCanProvide) ? body.contactTypesCanProvide : [],
            contactTypesCanProvideRaw: sanitizeText(body.contactTypesCanProvideRaw).slice(0, 1200),
            supplyRegions: sanitizeText(body.supplyRegions).slice(0, 1200),
            openToAdminMatching: sanitizeText(body.openToAdminMatching).slice(0, 120),

            aiScore: Number(body.aiScore || 0),
            createdAt: existingApplication?.createdAt || nowIso,
            updatedAt: nowIso,
            submittedAt: nowIso,
            reviewedAt: '',
            reviewedBy: '',
            notes: Array.isArray(body.notes)
                ? body.notes
                : ['Submitted through Dashboard Federation gate.']
        };

        await userRef.set({
            federationApplication: application,
            federationApplicationStatus: 'Under Review',
            federationMembershipStatus: 'under review',
            hasFederationAccess: false,
            updatedAt: nowIso
        }, { merge: true });

        return res.status(201).json({
            success: true,
            application,
            applicationStatus: 'Under Review'
        });
    } catch (error) {
        console.error('submit federation application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit Federation application.'
        });
    }
});

app.use('/api', apiRoutes);
app.post('/api/realtime/live-rooms/:roomId/join', requireApiUser, async (req, res) => {
    try {
        const room = await realtimeFirestoreRepo.joinLiveRoom({
            userId: req.user.id,
            roomId: req.params.roomId
        });

        return res.json({
            success: true,
            room
        });
    } catch (error) {
        console.error('join live room error:', error);
        return res.status(400).json({
            success: false,
            message: error?.message || 'Failed to join live room.'
        });
    }
});

app.post('/api/realtime/live-rooms/:roomId/leave', requireApiUser, async (req, res) => {
    try {
        const room = await realtimeFirestoreRepo.leaveLiveRoom({
            userId: req.user.id,
            roomId: req.params.roomId
        });

        return res.json({
            success: true,
            room
        });
    } catch (error) {
        console.error('leave live room error:', error);
        return res.status(400).json({
            success: false,
            message: error?.message || 'Failed to leave live room.'
        });
    }
});

app.post('/api/realtime/live-rooms/:roomId/end', requireApiUser, async (req, res) => {
    try {
        const room = await realtimeFirestoreRepo.endLiveRoom({
            userId: req.user.id,
            roomId: req.params.roomId
        });

        const signalingRoom = getAcademyVoiceSignalingRoom(req.params.roomId);

        io.to(signalingRoom).emit('academyVoice:roomEnded', {
            roomId: sanitizeText(req.params.roomId)
        });

        if (typeof io.in(signalingRoom).socketsLeave === 'function') {
            io.in(signalingRoom).socketsLeave(signalingRoom);
        }

        return res.json({
            success: true,
            room
        });
    } catch (error) {
        console.error('end live room error:', error);
        return res.status(400).json({
            success: false,
            message: error?.message || 'Failed to end live room.'
        });
    }
});
startAiNurtureWorker();

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 YH Server is running! Open http://localhost:${PORT} in your browser.`);
});