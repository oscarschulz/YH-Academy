const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_plaza_records';

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function cleanLower(value, fallback = '') {
  return cleanText(value, fallback).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeArray(value = []) {
  return Array.isArray(value) ? value : [];
}

function toIso(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();

  if (typeof value === 'object') {
    if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
    if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
  }

  return cleanText(value);
}

function normalizeStatus(value = '', fallback = 'active') {
  return cleanLower(value || fallback) || fallback;
}

function normalizeAdminStatusLabel(value = '', fallback = 'Submitted') {
  const raw = cleanLower(value || fallback);

  if (raw === 'active') return 'Active';
  if (raw === 'open') return 'Open';
  if (raw === 'approved') return 'Approved';
  if (raw === 'pending_review' || raw === 'pending admin review' || raw === 'pending_admin_review') return 'Pending Review';
  if (raw === 'under review' || raw === 'under_review') return 'Under Review';
  if (raw === 'routed') return 'Routed';
  if (raw === 'closed') return 'Closed';
  if (raw === 'dismissed') return 'Dismissed';
  if (raw === 'resolved') return 'Resolved';
  if (raw === 'rejected') return 'Rejected';
  if (raw === 'waitlisted') return 'Waitlisted';
  if (raw === 'screening') return 'Screening';
  if (raw === 'shortlisted') return 'Shortlisted';
  if (raw === 'revoked') return 'Revoked';

  return cleanText(value || fallback);
}

function normalizeRouteLane(value = '', fallback = 'manual_review') {
  const raw = cleanLower(value || fallback);

  if (['academy', 'academy_operator', 'operator'].includes(raw)) return 'academy_operator';
  if (['provider', 'plaza_provider', 'service_provider'].includes(raw)) return 'plaza_provider';
  if (['federation', 'federation_escalation', 'federation_escalation_request'].includes(raw)) return 'federation_escalation';
  if (['regional_leader', 'patron', 'leader'].includes(raw)) return 'regional_leader';
  if (['conversation', 'open_conversation'].includes(raw)) return 'open_conversation';
  if (['service_request'].includes(raw)) return 'service_request';

  return 'manual_review';
}

function shouldShowRow(row = {}) {
  const status = normalizeStatus(row.status || row.review_status || 'active');
  return !['deleted', 'hidden', 'removed', 'archived'].includes(status);
}

async function fetchRows(recordTypes = [], limit = 500) {
  const safeTypes = safeArray(recordTypes).map(cleanText).filter(Boolean);
  const safeLimit = Math.max(1, Math.min(Number(limit || 500), 1000));

  let query = yhuSupabaseAdmin
    .from(TABLE)
    .select('*')
    .order('updated_at_source', { ascending: false, nullsFirst: false })
    .limit(safeLimit);

  if (safeTypes.length === 1) {
    query = query.eq('record_type', safeTypes[0]);
  } else if (safeTypes.length > 1) {
    query = query.in('record_type', safeTypes);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Admin Plaza Supabase read failed: ${error.message}`);
  }

  return Array.isArray(data) ? data.filter(shouldShowRow) : [];
}

function rowData(row = {}) {
  return row.data && typeof row.data === 'object' ? row.data : {};
}

function rowPublic(row = {}) {
  return row.public_meta && typeof row.public_meta === 'object' ? row.public_meta : {};
}

function rowPrivate(row = {}) {
  return row.private_meta && typeof row.private_meta === 'object' ? row.private_meta : {};
}

function rowId(row = {}) {
  return cleanText(row.source_document_id || row.id);
}

function mapAdminPlazaListingRow(row = {}) {
  const data = rowData(row);
  const pub = rowPublic(row);
  const priv = rowPrivate(row);

  const title = cleanText(
    data.title ||
    row.title ||
    pub.title ||
    data.name ||
    'Plaza Listing'
  );

  const owner =
    cleanText(data.authorName || data.createdByName || pub.authorName) ||
    cleanText(data.ownerName || data.providerName || priv.authorName) ||
    cleanText(data.authorEmail || priv.authorEmail) ||
    'YH Member';

  const status = normalizeAdminStatusLabel(data.status || row.status || row.review_status || 'pending_review');

  return {
    id: rowId(row),
    title,
    owner,
    ownerUid: cleanText(data.authorId || data.createdByUid || row.owner_user_id || ''),
    ownerEmail: cleanText(data.authorEmail || data.createdByEmail || priv.authorEmail || '').toLowerCase(),
    type: cleanText(data.type || data.opportunityType || row.category || 'opportunity'),
    status,
    normalizedStatus: cleanLower(status),
    reports: toNumber(data.reports || data.reportCount || pub.reportCount, 0),
    region: cleanText(data.region || row.region || 'Global'),
    featured: data.featured === true || pub.featured === true,
    sourceDivision: 'plaza',
    sourceFeature: cleanText(data.sourceFeature || 'plaza_opportunities'),
    summary: cleanText(data.summary || row.summary || data.description || row.body || ''),
    description: cleanText(data.description || row.body || ''),
    tags: safeArray(data.tags || row.tags),
    createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
    updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at),
    raw: data,
    source: 'supabase'
  };
}

function mapAdminRequestRow(row = {}) {
  const data = rowData(row);
  const pub = rowPublic(row);
  const priv = rowPrivate(row);

  const status = cleanText(data.status || row.status || 'open');
  const lane = normalizeRouteLane(
    data.adminRoutingLane ||
    data.routeKey ||
    data.routeLane ||
    data.routingLane ||
    data.patronStatus ||
    'manual_review'
  );

  return {
    id: rowId(row),
    sourceType: cleanText(data.sourceType || data.requestType || pub.requestType || row.category || 'request'),
    targetLabel: cleanText(data.targetLabel || data.title || data.subject || row.title || 'Plaza Request'),
    objective: cleanText(data.objective || data.description || row.body || row.summary || ''),
    requesterName: cleanText(data.requesterName || data.authorName || pub.authorName || 'Hustler'),
    requesterEmail: cleanText(data.requesterEmail || data.authorEmail || priv.authorEmail || '').toLowerCase(),
    requesterUid: cleanText(data.requesterUid || data.authorId || data.authorFirebaseUid || row.owner_user_id || ''),
    adminRoutingLane: lane,
    routeKey: lane,
    routeLabel: cleanText(data.routeLabel || data.matchingStatus || 'Awaiting route'),
    serviceCategory: cleanText(data.serviceCategory || data.category || row.category || ''),
    servicePriceType: cleanText(data.servicePriceType || data.priceType || ''),
    serviceDeliveryTime: cleanText(data.serviceDeliveryTime || data.deliveryTime || ''),
    serviceTags: safeArray(data.serviceTags || data.tags || row.tags),
    status,
    reviewStatus: cleanText(data.reviewStatus || row.review_status || status),
    matchingPriority: cleanText(data.matchingPriority || data.priority || pub.priority || 'normal'),
    requestPriority: cleanText(data.requestPriority || data.priority || pub.priority || 'normal'),
    providerName: cleanText(data.providerName || data.targetUserName || ''),
    createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
    updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at),
    raw: data,
    source: 'supabase'
  };
}

function mapAdminPatronApplicationAsRoutingRequest(row = {}) {
  const data = rowData(row);
  const pub = rowPublic(row);
  const priv = rowPrivate(row);

  const status = cleanText(data.status || row.status || data.reviewStatus || row.review_status || 'pending_review');
  const name = cleanText(data.fullName || data.name || pub.name || 'Plaza Patron Applicant');

  return {
    id: rowId(row),
    sourceType: 'patron_application',
    targetLabel: `Patron Application: ${name}`,
    objective: cleanText(data.whyYou || data.reason || row.body || 'Plaza Patron / Leader application'),
    requesterName: name,
    requesterEmail: cleanText(data.email || priv.email || '').toLowerCase(),
    requesterUid: cleanText(data.userId || data.firebaseUid || row.owner_user_id || ''),
    adminRoutingLane: 'regional_leader',
    routeKey: 'regional_leader',
    routeLabel: 'Patron / Leader Review',
    serviceCategory: cleanText(data.preferredRole || 'Regional Patron'),
    servicePriceType: cleanText(data.region || data.regionId || ''),
    serviceDeliveryTime: cleanText(data.country || data.baseCity || ''),
    serviceTags: ['plaza-patron', cleanText(data.region || ''), cleanText(data.preferredRole || '')].filter(Boolean),
    status,
    reviewStatus: cleanText(data.reviewStatus || row.review_status || status),
    matchingPriority: 'normal',
    requestPriority: 'normal',
    providerName: cleanText(data.region || data.regionId || 'YH Plaza'),
    createdAt: toIso(data.submittedAt || data.createdAt || row.created_at_source || row.created_at),
    updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at),
    raw: data,
    source: 'supabase'
  };
}

function buildRoutingSummary(requests = []) {
  const byStatus = {};
  const byLane = {};

  requests.forEach((item) => {
    const status = cleanText(item.status || 'unknown').toLowerCase() || 'unknown';
    const lane = cleanText(item.adminRoutingLane || item.routeKey || 'manual_review') || 'manual_review';

    byStatus[status] = (byStatus[status] || 0) + 1;
    byLane[lane] = (byLane[lane] || 0) + 1;
  });

  return {
    total: requests.length,
    unrouted: requests.filter((item) => {
      const lane = cleanText(item.adminRoutingLane || item.routeKey);
      return !lane || lane === 'manual_review';
    }).length,
    needsReview: requests.filter((item) => {
      const status = cleanLower(item.status);
      return ['submitted', 'open', 'pending', 'pending_review', 'under review', 'under_review', 'active'].includes(status);
    }).length,
    highPriority: requests.filter((item) => {
      return ['high', 'urgent', 'critical'].includes(cleanLower(item.matchingPriority || item.requestPriority));
    }).length,
    byStatus,
    byLane
  };
}

function normalizeMessageSnapshot(message = {}) {
  if (!message || typeof message !== 'object') {
    return {
      text: cleanText(message),
      sender: 'YH Member',
      createdAt: ''
    };
  }

  return {
    id: cleanText(message.id || ''),
    sender: cleanText(message.sender || message.authorName || message.senderName || message.name || 'YH Member'),
    senderId: cleanText(message.senderId || message.authorId || message.userId || ''),
    text: cleanText(message.text || message.body || message.message || message.content || ''),
    type: cleanText(message.type || 'message'),
    createdAt: toIso(message.createdAt || message.sentAt || '')
  };
}

function mapConversationRow(row = {}) {
  const data = rowData(row);
  const pub = rowPublic(row);

  const messages = safeArray(data.messages || data.replies).map(normalizeMessageSnapshot);
  const participantIds = safeArray(data.participantIds || pub.participantIds)
    .map(cleanText)
    .filter(Boolean);

  return {
    id: rowId(row),
    conversationId: rowId(row),
    title: cleanText(data.title || row.title || 'Plaza business conversation'),
    status: cleanText(data.status || row.status || 'active'),
    sourceDivision: cleanText(data.sourceDivision || 'plaza'),
    targetDivision: cleanText(data.targetDivision || ''),
    businessPurpose: cleanText(data.businessPurpose || data.conversationType || row.category || ''),
    participantIds,
    participantCount: participantIds.length,
    messageCount: messages.length,
    messages,
    reported: data.reported === true,
    blocked: cleanLower(data.status || row.status) === 'blocked',
    closed: cleanLower(data.status || row.status) === 'closed',
    createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
    updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at),
    raw: data
  };
}

function mapAdminReportRow(row = {}, conversationMap = new Map()) {
  const data = rowData(row);
  const pub = rowPublic(row);
  const priv = rowPrivate(row);

  const conversationId = cleanText(data.conversationId || row.room_id || priv.conversationId || '');
  const conversation = conversationMap.get(conversationId) || null;
  const messagesSnapshot = safeArray(data.messagesSnapshot || conversation?.messages).map(normalizeMessageSnapshot);

  return {
    id: rowId(row),
    conversationId,
    conversationTitle: cleanText(data.conversationTitle || conversation?.title || 'Plaza business conversation'),
    reporterId: cleanText(data.reporterId || row.owner_user_id || ''),
    reporterEmail: cleanText(data.reporterEmail || priv.reporterEmail || '').toLowerCase(),
    reporterName: cleanText(data.reporterName || pub.reporterName || 'YH Member'),
    reason: cleanText(data.reason || pub.reason || row.category || 'Reported business chat'),
    details: cleanText(data.details || row.body || ''),
    status: cleanText(data.status || row.status || data.reviewStatus || row.review_status || 'pending_review'),
    reviewStatus: cleanText(data.reviewStatus || row.review_status || data.status || row.status || 'pending_review'),
    adminNote: cleanText(data.adminNote || ''),
    reviewedBy: cleanText(data.reviewedBy || ''),
    reviewedAt: toIso(data.reviewedAt || ''),
    sourceDivision: cleanText(data.sourceDivision || conversation?.sourceDivision || ''),
    targetDivision: cleanText(data.targetDivision || conversation?.targetDivision || ''),
    businessPurpose: cleanText(data.businessPurpose || conversation?.businessPurpose || ''),
    participantIds: safeArray(data.participantIds || conversation?.participantIds).map(cleanText).filter(Boolean),
    messagesSnapshot,
    createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
    updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at),
    raw: data,
    source: 'supabase'
  };
}

async function listAdminPlazaListings(limit = 300) {
  const rows = await fetchRows(['opportunity'], limit);
  return rows
    .map(mapAdminPlazaListingRow)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function buildAdminPlazaRoutingDeskSnapshot(limit = 120) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 120), 250));

  const [requestRows, patronRows] = await Promise.all([
    fetchRows(['request'], safeLimit),
    fetchRows(['patron_application'], safeLimit)
  ]);

  const requests = [
    ...requestRows.map(mapAdminRequestRow),
    ...patronRows.map(mapAdminPatronApplicationAsRoutingRequest)
  ].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
   .slice(0, safeLimit);

  return {
    summary: buildRoutingSummary(requests),
    requests
  };
}

async function buildAdminBusinessChatReportsSnapshot(limit = 160) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 160), 300));

  const [reportRows, conversationRows] = await Promise.all([
    fetchRows(['business_chat_report'], safeLimit),
    fetchRows(['conversation'], 600)
  ]);

  const conversationMap = new Map(
    conversationRows.map((row) => {
      const conversation = mapConversationRow(row);
      return [conversation.id, conversation];
    })
  );

  return reportRows
    .map((row) => mapAdminReportRow(row, conversationMap))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, safeLimit);
}

async function buildAdminBusinessChatAnalyticsSnapshot() {
  const [conversationRows, reportRows, blockRows] = await Promise.all([
    fetchRows(['conversation'], 600),
    fetchRows(['business_chat_report'], 600),
    fetchRows(['business_user_block'], 600)
  ]);

  const conversations = conversationRows.map(mapConversationRow);
  const reports = reportRows.map((row) => mapAdminReportRow(row, new Map()));
  const blocks = blockRows.map((row) => {
    const data = rowData(row);

    return {
      id: rowId(row),
      blockerId: cleanText(data.blockerId || row.owner_user_id || ''),
      blockedUserId: cleanText(data.blockedUserId || row.target_user_id || ''),
      status: cleanText(data.status || row.status || 'active'),
      createdAt: toIso(data.createdAt || row.created_at_source || row.created_at),
      updatedAt: toIso(data.updatedAt || row.updated_at_source || row.updated_at)
    };
  });

  const activeStatuses = new Set(['active', 'open', 'in_progress', 'pending_review']);
  const dealKeywords = ['deal', 'partnership', 'investment', 'service', 'hiring', 'project', 'collaboration', 'intro'];

  const activeDealConversations = conversations.filter((item) => {
    const purpose = cleanLower(item.businessPurpose);
    return activeStatuses.has(cleanLower(item.status || 'active')) && dealKeywords.some((keyword) => purpose.includes(keyword));
  }).length;

  const uniqueBlockedUsers = new Set();
  blocks.forEach((item) => {
    if (cleanLower(item.status) === 'active') {
      if (item.blockerId) uniqueBlockedUsers.add(item.blockerId);
      if (item.blockedUserId) uniqueBlockedUsers.add(item.blockedUserId);
    }
  });

  const reportsByStatus = {};
  reports.forEach((item) => {
    const status = cleanLower(item.status || item.reviewStatus || 'pending_review');
    reportsByStatus[status] = (reportsByStatus[status] || 0) + 1;
  });

  return {
    totalBusinessConversations: conversations.length,
    activeDealConversations,
    reportedConversations: reports.length,
    openReports: reports.filter((item) => {
      const status = cleanLower(item.status || item.reviewStatus);
      return ['pending_review', 'open', 'active'].includes(status);
    }).length,
    blockedConversations: conversations.filter((item) => item.blocked || cleanLower(item.status) === 'blocked').length,
    closedConversations: conversations.filter((item) => item.closed || cleanLower(item.status) === 'closed').length,
    uniqueBlockedUsers: uniqueBlockedUsers.size,
    totalMessages: conversations.reduce((sum, item) => sum + toNumber(item.messageCount, 0), 0),
    reportsByStatus,
    source: 'supabase'
  };
}

async function getCounts() {
  const [listings, desk, reports, analytics] = await Promise.all([
    listAdminPlazaListings(300),
    buildAdminPlazaRoutingDeskSnapshot(250),
    buildAdminBusinessChatReportsSnapshot(300),
    buildAdminBusinessChatAnalyticsSnapshot()
  ]);

  return {
    listings: listings.length,
    routingRequests: desk.requests.length,
    businessChatReports: reports.length,
    businessConversations: analytics.totalBusinessConversations,
    source: 'supabase'
  };
}

module.exports = {
  TABLE,
  listAdminPlazaListings,
  buildAdminPlazaRoutingDeskSnapshot,
  buildAdminBusinessChatReportsSnapshot,
  buildAdminBusinessChatAnalyticsSnapshot,
  getCounts
};
