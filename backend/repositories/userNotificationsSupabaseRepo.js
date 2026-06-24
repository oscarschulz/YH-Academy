const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_user_notification_records';
const SOURCE_FIELD = 'inProductReviewNotifications';
const LIMIT = 80;

function cleanText(value = '') {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeDate(value) {
    if (!value) return null;

    if (value instanceof Date) return value.toISOString();

    if (typeof value?.toDate === 'function') return value.toDate().toISOString();

    if (typeof value === 'object') {
        if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
        if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
    }

    const text = cleanText(value);
    if (!text) return null;

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeValue(value) {
    if (value === null || value === undefined) return value;

    if (value instanceof Date) return value.toISOString();

    if (typeof value?.toDate === 'function') return value.toDate().toISOString();

    if (Array.isArray(value)) return value.map(normalizeValue);

    if (typeof value === 'object') {
        if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
        if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();

        return Object.fromEntries(
            Object.entries(value).map(([key, inner]) => [key, normalizeValue(inner)])
        );
    }

    return value;
}

function sourceKeyForNotification(notification = {}, fallback = '') {
    return cleanText(
        notification.id ||
        notification.notificationId ||
        notification.notification_id ||
        notification.targetId ||
        notification.target_id ||
        fallback
    );
}

function normalizeNotification(notification = {}) {
    const raw = normalizeValue(notification || {});
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { value: raw };

    const id = sourceKeyForNotification(obj);

    const createdAt =
        normalizeDate(obj.createdAt) ||
        normalizeDate(obj.created_at) ||
        normalizeDate(obj.sentAt) ||
        normalizeDate(obj.timestamp) ||
        normalizeDate(obj.date) ||
        new Date().toISOString();

    const isRead =
        obj.isRead === true ||
        obj.is_read === true ||
        obj.read === true ||
        obj.seen === true ||
        cleanText(obj.status).toLowerCase() === 'read';

    const readAt =
        normalizeDate(obj.readAt) ||
        normalizeDate(obj.read_at) ||
        (isRead ? new Date().toISOString() : '');

    return {
        ...obj,
        id,
        title: cleanText(obj.title || obj.subject || obj.heading || ''),
        text: cleanText(obj.text || obj.message || obj.body || obj.description || ''),
        message: cleanText(obj.message || obj.text || obj.body || obj.description || ''),
        body: cleanText(obj.body || obj.text || obj.message || obj.description || ''),
        target: cleanText(obj.target || obj.targetType || obj.target_type || obj.href || obj.url || obj.link || ''),
        targetType: cleanText(obj.targetType || obj.target_type || obj.target || ''),
        target_type: cleanText(obj.target_type || obj.targetType || obj.target || ''),
        targetId: cleanText(obj.targetId || obj.target_id || obj.applicationId || obj.requestId || ''),
        target_id: cleanText(obj.target_id || obj.targetId || obj.applicationId || obj.requestId || ''),
        color: cleanText(obj.color || 'var(--neon-blue)'),
        avatarStr: cleanText(obj.avatarStr || obj.initial || 'N'),
        initial: cleanText(obj.initial || obj.avatarStr || 'N'),
        source: cleanText(obj.source || 'admin-review'),
        notificationType: cleanText(obj.notificationType || obj.notification_type || obj.type || obj.kind || obj.category || 'application-review'),
        applicationField: cleanText(obj.applicationField || obj.application_field || ''),
        applicationStatus: cleanText(obj.applicationStatus || obj.application_status || obj.status || ''),
        createdAt,
        created_at: createdAt,
        isRead,
        is_read: isRead,
        read: isRead,
        readAt,
        read_at: readAt
    };
}

function buildPayload(userId = '', notification = {}, context = {}) {
    const cleanUserId = cleanText(userId);
    const normalized = normalizeNotification(notification);
    const sourceKey = sourceKeyForNotification(normalized, context.fallbackKey || '');

    return {
        user_id: cleanUserId,
        source_collection_path: 'users',
        source_document_id: cleanUserId,
        source_document_path: `users/${cleanUserId}`,
        source_field: cleanText(context.sourceField || SOURCE_FIELD),
        source_notification_key: sourceKey,

        notification_type: cleanText(normalized.notificationType || normalized.type || SOURCE_FIELD),
        title: cleanText(normalized.title),
        body_text: cleanText(normalized.text || normalized.message || normalized.body),
        target: cleanText(normalized.target),
        target_id: cleanText(normalized.targetId || normalized.target_id),
        status: cleanText(normalized.applicationStatus || normalized.status || ''),
        is_read: normalized.isRead === true || normalized.is_read === true || normalized.read === true,

        created_at_source: normalizeDate(normalized.createdAt || normalized.created_at),
        updated_at_source: normalizeDate(normalized.updatedAt || normalized.updated_at || normalized.createdAt || normalized.created_at),
        read_at_source: normalizeDate(normalized.readAt || normalized.read_at),

        public_meta: {
            userId: cleanUserId,
            sourceField: cleanText(context.sourceField || SOURCE_FIELD),
            sourceNotificationKey: sourceKey,
            title: cleanText(normalized.title),
            target: cleanText(normalized.target),
            targetId: cleanText(normalized.targetId || normalized.target_id),
            status: cleanText(normalized.applicationStatus || normalized.status || ''),
            isRead: normalized.isRead === true || normalized.is_read === true || normalized.read === true
        },
        private_meta: {
            sourceCollection: 'users',
            sourceDocumentPath: `users/${cleanUserId}`,
            sourceField: cleanText(context.sourceField || SOURCE_FIELD),
            sourceNotificationKey: sourceKey,
            source: cleanText(context.source || 'notification-route-switch')
        },
        data: normalized,
        updated_at: new Date().toISOString()
    };
}

function rowToNotification(row = {}) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    const normalized = normalizeNotification({
        ...data,
        id: data.id || row.source_notification_key,
        title: data.title || row.title,
        text: data.text || data.message || data.body || row.body_text,
        target: data.target || row.target,
        targetId: data.targetId || data.target_id || row.target_id,
        notificationType: data.notificationType || row.notification_type,
        applicationStatus: data.applicationStatus || row.status,
        isRead: data.isRead === true || data.is_read === true || row.is_read === true,
        readAt: data.readAt || data.read_at || row.read_at_source,
        createdAt: data.createdAt || data.created_at || row.created_at_source
    });

    return normalized;
}

async function upsertNotification(userId = '', notification = {}, context = {}) {
    const cleanUserId = cleanText(userId);
    if (!cleanUserId) return null;

    const payload = buildPayload(cleanUserId, notification, context);
    const sourceField = payload.source_field;
    const sourceKey = payload.source_notification_key;

    if (!sourceKey) return null;

    const { data: existing, error: findError } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('id')
        .eq('user_id', cleanUserId)
        .eq('source_field', sourceField)
        .eq('source_notification_key', sourceKey)
        .limit(1)
        .maybeSingle();

    if (findError) {
        throw new Error(findError.message || findError.details || String(findError));
    }

    if (existing?.id) {
        const { data, error } = await yhuSupabaseAdmin
            .from(TABLE)
            .update(payload)
            .eq('id', existing.id)
            .select('*')
            .single();

        if (error) throw new Error(error.message || error.details || String(error));
        return data;
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .insert(payload)
        .select('*')
        .single();

    if (error) throw new Error(error.message || error.details || String(error));
    return data;
}

async function syncUserNotificationsFromList(userId = '', notifications = [], context = {}) {
    const cleanUserId = cleanText(userId);
    if (!cleanUserId || !Array.isArray(notifications)) return [];

    const results = [];

    for (let index = 0; index < notifications.length; index += 1) {
        const notification = notifications[index] || {};
        const normalized = normalizeNotification(notification);

        if (!normalized.id) continue;

        const saved = await upsertNotification(cleanUserId, normalized, {
            ...context,
            fallbackKey: `${SOURCE_FIELD}_${index}`
        });

        if (saved) results.push(saved);
    }

    return results;
}

async function listUserNotifications(userId = '', options = {}) {
    const cleanUserId = cleanText(userId);
    if (!cleanUserId) return [];

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('user_id', cleanUserId)
        .eq('source_field', cleanText(options.sourceField || SOURCE_FIELD))
        .order('created_at_source', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(Number(options.limit || LIMIT));

    if (error) {
        throw new Error(error.message || error.details || String(error));
    }

    return (Array.isArray(data) ? data : [])
        .map(rowToNotification)
        .filter((item) => item.id);
}

async function markNotificationRead(userId = '', notificationId = '', readAt = new Date().toISOString()) {
    const cleanUserId = cleanText(userId);
    const cleanNotificationId = cleanText(notificationId);
    if (!cleanUserId || !cleanNotificationId) return null;

    const current = await listUserNotifications(cleanUserId, { limit: LIMIT });
    const matched = current.find((item) => cleanText(item.id) === cleanNotificationId);

    if (!matched) return null;

    const next = {
        ...matched,
        isRead: true,
        is_read: true,
        read: true,
        readAt: readAt,
        read_at: readAt
    };

    return upsertNotification(cleanUserId, next, { source: 'mark-read' });
}

async function markAllNotificationsRead(userId = '', readAt = new Date().toISOString()) {
    const cleanUserId = cleanText(userId);
    if (!cleanUserId) return [];

    const current = await listUserNotifications(cleanUserId, { limit: LIMIT });

    const saved = [];

    for (const notification of current) {
        const next = {
            ...notification,
            isRead: true,
            is_read: true,
            read: true,
            readAt: readAt,
            read_at: readAt
        };

        saved.push(await upsertNotification(cleanUserId, next, { source: 'mark-all-read' }));
    }

    return saved;
}

async function countNotifications() {
    const { count, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('id', { count: 'exact', head: true });

    if (error) throw new Error(error.message || error.details || String(error));
    return count || 0;
}

module.exports = {
    TABLE,
    SOURCE_FIELD,
    buildPayload,
    countNotifications,
    listUserNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    normalizeNotification,
    rowToNotification,
    syncUserNotificationsFromList,
    upsertNotification
};
