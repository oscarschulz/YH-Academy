const businessRepo = require('../backend/repositories/plazaBusinessMessagesSupabaseRepo');
const directoryRepo = require('../backend/repositories/plazaDirectoryRegionsSupabaseRepo');
const bridgeRequestsRepo = require('../backend/repositories/plazaBridgeRequestsSupabaseRepo');

function sanitizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function clampText(value, limit = 1000, fallback = '') {
    const clean = sanitizeText(value, fallback);
    return clean.slice(0, Math.max(1, Number(limit || 1000)));
}

function safeArray(value = []) {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeText(item)).filter(Boolean);
    }

    return String(value || '')
        .split(',')
        .map((item) => sanitizeText(item))
        .filter(Boolean);
}

function normalizeStatus(value = '', fallback = 'active') {
    const clean = sanitizeText(value || fallback).toLowerCase();
    return clean || fallback;
}

function getViewerFromRequest(req = {}) {
    const user = req.user || {};

    return {
        id: sanitizeText(user.id || user.firebaseUid || user.uid),
        firebaseUid: sanitizeText(user.firebaseUid || user.id || user.uid),
        email: sanitizeText(user.email).toLowerCase(),
        username: sanitizeText(user.username),
        name: sanitizeText(
            user.name ||
            user.fullName ||
            user.displayName ||
            user.username ||
            user.email ||
            'YH Member'
        )
    };
}

function viewerKeys(viewer = {}) {
    return new Set([
        viewer.id,
        viewer.firebaseUid,
        viewer.email,
        viewer.username
    ].map(sanitizeText).filter(Boolean));
}

function conversationBelongsToViewer(conversation = {}, viewer = {}) {
    const keys = viewerKeys(viewer);

    if (!keys.size) return false;

    const candidates = [
        conversation.requesterId,
        conversation.targetUserId,
        conversation.businessMemberId,
        conversation.authorId,
        ...(Array.isArray(conversation.participantIds) ? conversation.participantIds : [])
    ].map(sanitizeText).filter(Boolean);

    return candidates.some((value) => keys.has(value));
}

function blockBelongsToViewer(block = {}, viewer = {}) {
    const keys = viewerKeys(viewer);

    if (!keys.size) return false;

    return keys.has(sanitizeText(block.blockerId));
}

function buildInitialMessage(req = {}, viewer = {}) {
    const body = req.body || {};
    const text = clampText(
        body.message ||
        body.text ||
        body.body ||
        body.content ||
        body.initialMessage,
        1800
    );

    if (!text) return null;

    return {
        authorId: viewer.id,
        authorName: viewer.name,
        authorEmail: viewer.email,
        text,
        type: 'message',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function buildBaseConversationPayload({
    req,
    viewer,
    targetUserId = '',
    title = '',
    subject = '',
    conversationType = 'business',
    region = 'Global',
    source = '',
    sourceId = ''
}) {
    const body = req.body || {};
    const now = new Date().toISOString();
    const initialMessage = buildInitialMessage(req, viewer);
    const cleanTargetUserId = sanitizeText(targetUserId || body.targetUserId || body.recipientId || '');

    const participantIds = Array.from(
        new Set([
            viewer.id,
            viewer.firebaseUid,
            cleanTargetUserId,
            ...(safeArray(body.participantIds))
        ].map(sanitizeText).filter(Boolean))
    );

    const messages = initialMessage ? [initialMessage] : [];

    return {
        title: clampText(body.title || title || subject || 'Plaza Business Chat', 180),
        subject: clampText(body.subject || subject || title || 'Plaza Business Chat', 180),
        conversationType: clampText(body.conversationType || body.type || conversationType, 100, conversationType),
        region: clampText(body.region || region || 'Global', 120, 'Global') || 'Global',

        participantIds,
        participants: safeArray(body.participants),

        requesterId: viewer.id,
        targetUserId: cleanTargetUserId,
        businessMemberId: sanitizeText(body.businessMemberId || cleanTargetUserId),

        authorId: viewer.id,
        authorName: viewer.name,
        authorEmail: viewer.email,

        preview: initialMessage?.text || clampText(body.preview || body.description || '', 600),
        description: clampText(body.description || body.summary || '', 1200),
        messages,
        replies: messages,

        source,
        sourceId,

        status: sanitizeText(body.status || 'open'),
        reviewStatus: sanitizeText(body.reviewStatus || 'active'),
        createdAt: now,
        updatedAt: now,
        lastMessageAt: initialMessage?.createdAt || now
    };
}

async function createConversationAndRespond(req, res, payload) {
    const conversation = await businessRepo.createConversation(payload);

    return res.status(201).json({
        success: true,
        source: 'supabase',
        conversation,
        message: conversation.messages?.length ? conversation.messages[conversation.messages.length - 1] : null
    });
}

exports.getBusinessMembers = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const directory = await directoryRepo.listDirectory(160);
        const members = directory.filter((member) => {
            const id = sanitizeText(member.id || member.userId || member.firebaseUid);
            return id && id !== viewer.id && id !== viewer.firebaseUid;
        });

        return res.json({
            success: true,
            source: 'supabase',
            members,
            businessMembers: members
        });
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.getBusinessMembers error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Plaza business members.'
        });
    }
};

exports.getBusinessBlocks = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const blocks = await businessRepo.listBlocks(250);
        const activeBlocks = blocks.filter((block) => {
            return blockBelongsToViewer(block, viewer) && normalizeStatus(block.status) === 'active';
        });

        return res.json({
            success: true,
            source: 'supabase',
            blocks: activeBlocks,
            businessBlocks: activeBlocks
        });
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.getBusinessBlocks error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Plaza business blocks.'
        });
    }
};

exports.unblockBusinessMember = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const blockedUserId = sanitizeText(req.params?.blockedUserId);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!blockedUserId) {
            return res.status(400).json({
                success: false,
                message: 'Blocked user id is required.'
            });
        }

        const blocks = await businessRepo.listBlocks(250);
        const matching = blocks.filter((block) => {
            return (
                blockBelongsToViewer(block, viewer) &&
                sanitizeText(block.blockedUserId) === blockedUserId
            );
        });

        for (const block of matching) {
            await businessRepo.deleteRecord('business_user_block', block.id);
        }

        return res.json({
            success: true,
            source: 'supabase',
            blockedUserId,
            deletedCount: matching.length
        });
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.unblockBusinessMember error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to unblock Plaza business member.'
        });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const allConversations = await businessRepo.listConversations(250);
        const conversations = allConversations.filter((conversation) => {
            return conversationBelongsToViewer(conversation, viewer);
        });

        return res.json({
            success: true,
            source: 'supabase',
            conversations,
            messages: conversations
        });
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.getMessages error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Plaza messages.'
        });
    }
};

exports.createConversationFromRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const requestId = sanitizeText(req.params?.requestId);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        let request = null;
        try {
            request = await bridgeRequestsRepo.getRequestById(requestId);
        } catch (error) {
            console.warn('Request lookup skipped:', error?.message || error);
        }

        const payload = buildBaseConversationPayload({
            req,
            viewer,
            targetUserId: request?.authorId || request?.targetUserId || '',
            title: `Plaza Request: ${request?.title || requestId || 'Request'}`,
            subject: request?.subject || request?.title || requestId || 'Plaza request',
            conversationType: 'request',
            region: request?.region || 'Global',
            source: 'request',
            sourceId: requestId
        });

        return createConversationAndRespond(req, res, payload);
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.createConversationFromRequest error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza request conversation.'
        });
    }
};

exports.createConversationFromBusinessMember = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const targetUserId = sanitizeText(req.params?.targetUserId);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: 'Target user id is required.'
            });
        }

        const payload = buildBaseConversationPayload({
            req,
            viewer,
            targetUserId,
            title: `Plaza Business Chat`,
            subject: `Business member: ${targetUserId}`,
            conversationType: 'business',
            region: req.body?.region || 'Global',
            source: 'business_member',
            sourceId: targetUserId
        });

        return createConversationAndRespond(req, res, payload);
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.createConversationFromBusinessMember error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza business conversation.'
        });
    }
};

exports.createConversationFromMember = async (req, res) => {
    return exports.createConversationFromBusinessMember(req, res);
};

exports.createConversationFromRegion = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const regionId = sanitizeText(req.params?.regionId);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!regionId) {
            return res.status(400).json({
                success: false,
                message: 'Region id is required.'
            });
        }

        const payload = buildBaseConversationPayload({
            req,
            viewer,
            targetUserId: '',
            title: `Plaza Region Chat: ${regionId}`,
            subject: `Region: ${regionId}`,
            conversationType: 'region',
            region: req.body?.region || regionId || 'Global',
            source: 'region',
            sourceId: regionId
        });

        return createConversationAndRespond(req, res, payload);
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.createConversationFromRegion error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza region conversation.'
        });
    }
};

exports.createConversationReply = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const conversationId = sanitizeText(req.params?.id);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: 'Conversation id is required.'
            });
        }

        const text = clampText(
            req.body?.message ||
            req.body?.text ||
            req.body?.body ||
            req.body?.content,
            1800
        );

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Reply text is required.'
            });
        }

        const reply = {
            authorId: viewer.id,
            authorName: viewer.name,
            authorEmail: viewer.email,
            text,
            type: sanitizeText(req.body?.type || 'message'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const conversation = await businessRepo.addConversationReply(conversationId, reply);

        return res.status(201).json({
            success: true,
            source: 'supabase',
            conversation,
            reply: conversation.messages?.[conversation.messages.length - 1] || reply
        });
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.createConversationReply error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza conversation reply.'
        });
    }
};

exports.reportConversation = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const conversationId = sanitizeText(req.params?.id);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: 'Conversation id is required.'
            });
        }

        const report = await businessRepo.createReport({
            conversationId,
            reportedUserId: sanitizeText(req.body?.reportedUserId || req.body?.targetUserId || ''),
            reporterId: viewer.id,
            reporterName: viewer.name,
            reporterEmail: viewer.email,
            reason: clampText(req.body?.reason || req.body?.category || 'Report', 180),
            details: clampText(req.body?.details || req.body?.description || req.body?.message || '', 1600),
            status: 'pending_review',
            reviewStatus: 'pending_review',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        return res.status(201).json({
            success: true,
            source: 'supabase',
            report
        });
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.reportConversation error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to report Plaza conversation.'
        });
    }
};

exports.closeConversation = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const conversationId = sanitizeText(req.params?.id);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: 'Conversation id is required.'
            });
        }

        const conversation = await businessRepo.closeConversation(conversationId, {
            closedBy: viewer.id,
            closedByName: viewer.name,
            closedAt: new Date().toISOString()
        });

        return res.json({
            success: true,
            source: 'supabase',
            conversation
        });
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.closeConversation error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to close Plaza conversation.'
        });
    }
};

exports.blockConversationParticipant = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const conversationId = sanitizeText(req.params?.id);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: 'Conversation id is required.'
            });
        }

        const conversation = await businessRepo.getConversationById(conversationId);

        const blockedUserId = sanitizeText(
            req.body?.blockedUserId ||
            req.body?.targetUserId ||
            conversation?.targetUserId ||
            safeArray(conversation?.participantIds).find((id) => id !== viewer.id && id !== viewer.firebaseUid) ||
            ''
        );

        if (!blockedUserId) {
            return res.status(400).json({
                success: false,
                message: 'Blocked user id is required.'
            });
        }

        const block = await businessRepo.createBlock({
            id: `business_block_${viewer.id}__${blockedUserId}`,
            blockerId: viewer.id,
            blockedUserId,
            blockerName: viewer.name,
            blockedUserName: sanitizeText(req.body?.blockedUserName || ''),
            reason: clampText(req.body?.reason || 'Blocked from Plaza business chat.', 1000),
            status: 'active',
            reviewStatus: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        let closedConversation = conversation;
        try {
            closedConversation = await businessRepo.closeConversation(conversationId, {
                closedBy: viewer.id,
                closedByName: viewer.name,
                closedReason: 'blocked',
                closedAt: new Date().toISOString()
            });
        } catch (error) {
            console.warn('Conversation close after block skipped:', error?.message || error);
        }

        return res.status(201).json({
            success: true,
            source: 'supabase',
            block,
            conversation: closedConversation
        });
    } catch (error) {
        console.error('plazaBusinessMessagesSupabaseLite.blockConversationParticipant error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to block Plaza conversation participant.'
        });
    }
};
