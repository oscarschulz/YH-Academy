const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_plaza_records';

function sanitizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function cleanLower(value, fallback = '') {
    return sanitizeText(value, fallback).toLowerCase();
}

function safeArray(value = []) {
    return Array.isArray(value) ? value : [];
}

function toIso(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();

    if (typeof value === 'object') {
        if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
        if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
    }

    return sanitizeText(value);
}

function nowIso() {
    return new Date().toISOString();
}

function buildId(prefix = 'plaza') {
    return prefix + '_' + Date.now() + '_' + crypto.randomBytes(5).toString('hex');
}

function normalizeStatus(value = '', fallback = 'active') {
    const clean = cleanLower(value || fallback);
    return clean || fallback;
}

function isReadableStatus(value = '') {
    const status = normalizeStatus(value || 'active');

    return ![
        'deleted',
        'archived',
        'hidden',
        'blocked',
        'removed'
    ].includes(status);
}

function normalizeTags(value = []) {
    const raw = Array.isArray(value)
        ? value
        : String(value || '').split(',');

    return Array.from(
        new Set(
            raw
                .map((item) => sanitizeText(item).toLowerCase())
                .filter(Boolean)
                .map((item) => item.slice(0, 48))
        )
    ).slice(0, 24);
}

function normalizeMessage(message = {}) {
    const id = sanitizeText(message.id || message.messageId || buildId('msg'));

    return {
        ...message,
        id,
        authorId: sanitizeText(message.authorId || message.senderId || message.userId || ''),
        authorName: sanitizeText(message.authorName || message.senderName || message.name || 'YH Member'),
        authorEmail: sanitizeText(message.authorEmail || message.senderEmail || '').toLowerCase(),
        text: sanitizeText(message.text || message.body || message.message || message.content || ''),
        type: sanitizeText(message.type || 'message'),
        createdAt: toIso(message.createdAt || message.sentAt) || nowIso(),
        updatedAt: toIso(message.updatedAt) || toIso(message.createdAt || message.sentAt) || nowIso(),
        hiddenFor: safeArray(message.hiddenFor)
    };
}

function normalizeConversation(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || input.roomId || input.conversationId || buildId('plaza_conversation'));

    const rawMessages = safeArray(input.messages || input.replies || input.thread || []);
    const messages = rawMessages.map(normalizeMessage);

    const participantIds = Array.from(new Set([
        ...safeArray(input.participantIds),
        ...safeArray(input.participants).map((item) => {
            if (typeof item === 'string') return item;
            return item?.id || item?.userId || item?.firebaseUid || '';
        }),
        input.requesterId,
        input.authorId,
        input.createdByUid,
        input.ownerUid,
        input.targetUserId,
        input.recipientId,
        input.businessMemberId
    ].map(sanitizeText).filter(Boolean)));

    const title = sanitizeText(
        input.title ||
        input.subject ||
        input.name ||
        input.requestTitle ||
        input.opportunityTitle ||
        'Plaza conversation'
    );

    const latestMessage = messages.length ? messages[messages.length - 1] : null;

    return {
        ...input,
        id,
        roomId: sanitizeText(input.roomId || id),
        title,
        subject: sanitizeText(input.subject || title),
        conversationType: sanitizeText(input.conversationType || input.type || 'business'),
        region: sanitizeText(input.region || 'Global') || 'Global',

        participantIds,
        participants: safeArray(input.participants),
        requesterId: sanitizeText(input.requesterId || input.authorId || input.createdByUid || input.ownerUid || participantIds[0] || ''),
        targetUserId: sanitizeText(input.targetUserId || input.recipientId || input.businessMemberId || participantIds[1] || ''),
        businessMemberId: sanitizeText(input.businessMemberId || input.targetUserId || input.recipientId || ''),

        authorId: sanitizeText(input.authorId || input.createdByUid || input.ownerUid || participantIds[0] || ''),
        authorName: sanitizeText(input.authorName || input.createdByName || 'YH Member'),
        authorEmail: sanitizeText(input.authorEmail || input.createdByEmail || '').toLowerCase(),

        preview: sanitizeText(input.preview || input.lastMessage || latestMessage?.text || input.description || ''),
        description: sanitizeText(input.description || input.summary || input.body || ''),
        messages,
        replies: messages,

        status: normalizeStatus(input.status || 'open'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        closedAt: toIso(input.closedAt),
        closedBy: sanitizeText(input.closedBy || ''),

        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt || input.lastMessageAt) || now,
        lastMessageAt: toIso(input.lastMessageAt || latestMessage?.createdAt || input.updatedAt || input.createdAt) || now
    };
}

function normalizeReport(input = {}) {
    const now = nowIso();
    const id = sanitizeText(input.id || input.sourceDocumentId || buildId('plaza_report'));

    return {
        ...input,
        id,
        conversationId: sanitizeText(input.conversationId || input.roomId || input.threadId || ''),
        reportedUserId: sanitizeText(input.reportedUserId || input.targetUserId || input.userId || ''),
        reporterId: sanitizeText(input.reporterId || input.authorId || input.createdByUid || ''),
        reporterName: sanitizeText(input.reporterName || input.authorName || input.createdByName || 'YH Member'),
        reporterEmail: sanitizeText(input.reporterEmail || input.authorEmail || input.createdByEmail || '').toLowerCase(),
        reason: sanitizeText(input.reason || input.category || 'Report'),
        details: sanitizeText(input.details || input.description || input.body || input.message || ''),
        status: normalizeStatus(input.status || 'open'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function normalizeBlock(input = {}) {
    const now = nowIso();
    const blockerId = sanitizeText(input.blockerId || input.userId || input.authorId || input.createdByUid || '');
    const blockedUserId = sanitizeText(input.blockedUserId || input.targetUserId || input.recipientId || '');

    const id = sanitizeText(
        input.id ||
        input.sourceDocumentId ||
        (blockerId && blockedUserId ? `${blockerId}_${blockedUserId}` : '') ||
        buildId('plaza_block')
    );

    return {
        ...input,
        id,
        blockerId,
        blockedUserId,
        blockerName: sanitizeText(input.blockerName || input.authorName || input.createdByName || ''),
        blockedUserName: sanitizeText(input.blockedUserName || input.targetUserName || ''),
        reason: sanitizeText(input.reason || ''),
        status: normalizeStatus(input.status || 'active'),
        reviewStatus: normalizeStatus(input.reviewStatus || input.status || 'active'),
        createdAt: toIso(input.createdAt) || now,
        updatedAt: toIso(input.updatedAt) || now
    };
}

function buildConversationRow(input = {}) {
    const data = normalizeConversation(input);

    return {
        record_type: 'conversation',
        source_collection_path: 'plazaConversations',
        source_document_id: data.id,
        source_document_path: 'plazaConversations/' + data.id,
        owner_user_id: sanitizeText(data.requesterId || data.authorId),
        target_user_id: sanitizeText(data.targetUserId || data.businessMemberId),
        room_id: sanitizeText(data.roomId || data.id),
        status: normalizeStatus(data.status || 'open'),
        review_status: normalizeStatus(data.reviewStatus || 'active'),
        title: sanitizeText(data.title),
        summary: sanitizeText(data.preview || data.description).slice(0, 600),
        body: sanitizeText(data.description || data.preview),
        region: sanitizeText(data.region || 'Global'),
        category: sanitizeText(data.conversationType || 'business'),
        tags: normalizeTags(['plaza', 'conversation', data.region, data.conversationType, data.status]),
        public_meta: {
            subject: sanitizeText(data.subject),
            conversationType: sanitizeText(data.conversationType),
            participantIds: safeArray(data.participantIds),
            preview: sanitizeText(data.preview),
            messageCount: safeArray(data.messages).length,
            lastMessageAt: sanitizeText(data.lastMessageAt)
        },
        private_meta: {
            authorEmail: sanitizeText(data.authorEmail),
            participants: safeArray(data.participants)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt || data.lastMessageAt) || nowIso()
    };
}

function buildReportRow(input = {}) {
    const data = normalizeReport(input);

    return {
        record_type: 'business_chat_report',
        source_collection_path: 'plazaBusinessChatReports',
        source_document_id: data.id,
        source_document_path: 'plazaBusinessChatReports/' + data.id,
        owner_user_id: sanitizeText(data.reporterId),
        target_user_id: sanitizeText(data.reportedUserId),
        room_id: sanitizeText(data.conversationId),
        status: normalizeStatus(data.status || 'open'),
        review_status: normalizeStatus(data.reviewStatus || 'active'),
        title: sanitizeText(data.reason || 'Business chat report'),
        summary: sanitizeText(data.details).slice(0, 600),
        body: sanitizeText(data.details),
        region: '',
        category: sanitizeText(data.reason || 'report'),
        tags: normalizeTags(['plaza', 'business-chat-report', data.reason, data.status]),
        public_meta: {
            reason: sanitizeText(data.reason),
            reporterName: sanitizeText(data.reporterName)
        },
        private_meta: {
            reporterEmail: sanitizeText(data.reporterEmail),
            conversationId: sanitizeText(data.conversationId),
            reportedUserId: sanitizeText(data.reportedUserId)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso()
    };
}

function buildBlockRow(input = {}) {
    const data = normalizeBlock(input);

    return {
        record_type: 'business_user_block',
        source_collection_path: 'plazaBusinessUserBlocks',
        source_document_id: data.id,
        source_document_path: 'plazaBusinessUserBlocks/' + data.id,
        owner_user_id: sanitizeText(data.blockerId),
        target_user_id: sanitizeText(data.blockedUserId),
        status: normalizeStatus(data.status || 'active'),
        review_status: normalizeStatus(data.reviewStatus || 'active'),
        title: sanitizeText(`${data.blockerName || data.blockerId} blocked ${data.blockedUserName || data.blockedUserId}`),
        summary: sanitizeText(data.reason).slice(0, 600),
        body: sanitizeText(data.reason),
        region: '',
        category: 'business_user_block',
        tags: normalizeTags(['plaza', 'business-user-block', data.status]),
        public_meta: {
            blockerName: sanitizeText(data.blockerName),
            blockedUserName: sanitizeText(data.blockedUserName)
        },
        private_meta: {
            blockerId: sanitizeText(data.blockerId),
            blockedUserId: sanitizeText(data.blockedUserId)
        },
        data,
        created_at_source: toIso(data.createdAt) || nowIso(),
        updated_at_source: toIso(data.updatedAt) || nowIso()
    };
}

async function getExisting(recordType = '', sourceDocumentId = '') {
    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', sanitizeText(recordType))
        .eq('source_document_id', sanitizeText(sourceDocumentId))
        .maybeSingle();

    if (error) throw new Error('Plaza business message lookup failed: ' + error.message);
    return data || null;
}

async function upsertRecord(row = {}) {
    const existing = await getExisting(row.record_type, row.source_document_id).catch(() => null);

    if (existing?.id) {
        const { data, error } = await yhuSupabaseAdmin
            .from(TABLE)
            .update(row)
            .eq('id', existing.id)
            .select('*')
            .single();

        if (error) throw new Error('Plaza business message update failed: ' + error.message);
        return data;
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .insert(row)
        .select('*')
        .single();

    if (error) throw new Error('Plaza business message insert failed: ' + error.message);
    return data;
}

function mapConversationRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        roomId: sanitizeText(data.roomId || row.room_id || row.source_document_id || ''),
        title: sanitizeText(data.title || row.title || 'Plaza conversation'),
        subject: sanitizeText(data.subject || row.public_meta?.subject || data.title || row.title || ''),
        conversationType: sanitizeText(data.conversationType || row.public_meta?.conversationType || row.category || 'business'),
        region: sanitizeText(data.region || row.region || 'Global'),
        participantIds: safeArray(data.participantIds || row.public_meta?.participantIds),
        participants: safeArray(data.participants || row.private_meta?.participants),
        requesterId: sanitizeText(data.requesterId || row.owner_user_id || ''),
        targetUserId: sanitizeText(data.targetUserId || row.target_user_id || ''),
        businessMemberId: sanitizeText(data.businessMemberId || row.target_user_id || ''),
        authorId: sanitizeText(data.authorId || row.owner_user_id || ''),
        authorName: sanitizeText(data.authorName || 'YH Member'),
        authorEmail: sanitizeText(data.authorEmail || row.private_meta?.authorEmail || '').toLowerCase(),
        preview: sanitizeText(data.preview || row.public_meta?.preview || row.summary || ''),
        description: sanitizeText(data.description || row.body || ''),
        messages: safeArray(data.messages || data.replies).map(normalizeMessage),
        replies: safeArray(data.replies || data.messages).map(normalizeMessage),
        status: normalizeStatus(data.status || row.status || 'open'),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status || 'active'),
        closedAt: toIso(data.closedAt || ''),
        closedBy: sanitizeText(data.closedBy || ''),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at),
        lastMessageAt: toIso(data.lastMessageAt || row.public_meta?.lastMessageAt || row.updated_at_source || row.updated_at)
    };
}

function mapReportRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        conversationId: sanitizeText(data.conversationId || row.room_id || row.private_meta?.conversationId || ''),
        reportedUserId: sanitizeText(data.reportedUserId || row.target_user_id || row.private_meta?.reportedUserId || ''),
        reporterId: sanitizeText(data.reporterId || row.owner_user_id || ''),
        reporterName: sanitizeText(data.reporterName || row.public_meta?.reporterName || 'YH Member'),
        reporterEmail: sanitizeText(data.reporterEmail || row.private_meta?.reporterEmail || '').toLowerCase(),
        reason: sanitizeText(data.reason || row.public_meta?.reason || row.category || 'Report'),
        details: sanitizeText(data.details || row.body || ''),
        status: normalizeStatus(data.status || row.status || 'open'),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status || 'active'),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

function mapBlockRow(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};

    return {
        id: sanitizeText(row.source_document_id || data.id || row.id),
        blockerId: sanitizeText(data.blockerId || row.owner_user_id || row.private_meta?.blockerId || ''),
        blockedUserId: sanitizeText(data.blockedUserId || row.target_user_id || row.private_meta?.blockedUserId || ''),
        blockerName: sanitizeText(data.blockerName || row.public_meta?.blockerName || ''),
        blockedUserName: sanitizeText(data.blockedUserName || row.public_meta?.blockedUserName || ''),
        reason: sanitizeText(data.reason || row.body || ''),
        status: normalizeStatus(data.status || row.status || 'active'),
        reviewStatus: normalizeStatus(data.reviewStatus || row.review_status || 'active'),
        createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
        updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
}

async function importConversation(id = '', payload = {}) {
    const row = buildConversationRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    return mapConversationRow(await upsertRecord(row));
}

async function importReport(id = '', payload = {}) {
    const row = buildReportRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    return mapReportRow(await upsertRecord(row));
}

async function importBlock(id = '', payload = {}) {
    const row = buildBlockRow({
        ...payload,
        id: sanitizeText(id || payload.id || payload.sourceDocumentId)
    });

    return mapBlockRow(await upsertRecord(row));
}

async function createConversation(payload = {}) {
    return importConversation(payload.id || payload.roomId || buildId('plaza_conversation'), payload);
}

async function createReport(payload = {}) {
    return importReport(payload.id || buildId('plaza_report'), payload);
}

async function createBlock(payload = {}) {
    return importBlock(payload.id || buildId('plaza_block'), payload);
}

async function listConversations(limit = 100) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 100), 200));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'conversation')
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Plaza conversations list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapConversationRow)
        .filter((item) => isReadableStatus(item.status || item.reviewStatus || 'active'));
}

async function listReports(limit = 100) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 100), 200));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'business_chat_report')
        .order('created_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Plaza reports list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapReportRow)
        .filter((item) => isReadableStatus(item.status || item.reviewStatus || 'active'));
}

async function listBlocks(limit = 100) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 100), 200));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'business_user_block')
        .order('created_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error('Plaza blocks list failed: ' + error.message);

    return (Array.isArray(data) ? data : [])
        .map(mapBlockRow)
        .filter((item) => isReadableStatus(item.status || item.reviewStatus || 'active'));
}

async function getConversationById(id = '') {
    const cleanId = sanitizeText(id);

    if (!cleanId) return null;

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', 'conversation')
        .eq('source_document_id', cleanId)
        .maybeSingle();

    if (error) throw new Error('Plaza conversation get failed: ' + error.message);

    return data ? mapConversationRow(data) : null;
}

async function addConversationReply(id = '', reply = {}) {
    const existing = await getExisting('conversation', id);

    if (!existing) {
        throw new Error('Plaza conversation not found.');
    }

    const current = existing.data && typeof existing.data === 'object' ? existing.data : {};
    const currentMessages = safeArray(current.messages || current.replies).map(normalizeMessage);
    const nextReply = normalizeMessage(reply);

    const nextMessages = [...currentMessages, nextReply];

    const nextData = normalizeConversation({
        ...current,
        id,
        messages: nextMessages,
        replies: nextMessages,
        preview: nextReply.text || current.preview || '',
        lastMessageAt: nextReply.createdAt,
        updatedAt: nowIso()
    });

    return importConversation(id, nextData);
}

async function closeConversation(id = '', patch = {}) {
    const existing = await getExisting('conversation', id);

    if (!existing) {
        throw new Error('Plaza conversation not found.');
    }

    const current = existing.data && typeof existing.data === 'object' ? existing.data : {};
    const nextData = normalizeConversation({
        ...current,
        ...patch,
        id,
        status: 'closed',
        closedAt: patch.closedAt || nowIso(),
        updatedAt: nowIso()
    });

    return importConversation(id, nextData);
}

async function deleteRecord(recordType = '', id = '') {
    const cleanType = sanitizeText(recordType);
    const cleanId = sanitizeText(id);

    if (!cleanType || !cleanId) return;

    const { error } = await yhuSupabaseAdmin
        .from(TABLE)
        .delete()
        .eq('record_type', cleanType)
        .eq('source_document_id', cleanId);

    if (error) throw new Error('Plaza business message delete failed: ' + error.message);
}

module.exports = {
    TABLE,
    buildConversationRow,
    buildReportRow,
    buildBlockRow,
    importConversation,
    importReport,
    importBlock,
    createConversation,
    createReport,
    createBlock,
    listConversations,
    listReports,
    listBlocks,
    getConversationById,
    addConversationReply,
    closeConversation,
    deleteRecord,
    mapConversationRow,
    mapReportRow,
    mapBlockRow
};
