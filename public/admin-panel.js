const STORAGE_KEY = 'yh_admin_panel_state_v3_live';

function getAdminTokenFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const adminIndex = parts.indexOf('admin');

  if (adminIndex === -1) return '';
  return String(parts[adminIndex + 1] || '').trim();
}

function buildAdminLoginUrl() {
  const routeToken = getAdminTokenFromPath();
  return routeToken ? `/admin/${encodeURIComponent(routeToken)}/login` : '/';
}

function enforceAdminPanelAccess() {
  const routeToken = getAdminTokenFromPath();

  if (!routeToken) {
    window.location.replace('/');
    return false;
  }

  return true;
}

async function logoutAdminSession() {
  try {
    const res = await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await res.json().catch(() => null);
    window.location.replace(data?.redirectTo || buildAdminLoginUrl());
  } catch {
    window.location.replace(buildAdminLoginUrl());
  }
}
const defaultState = () => ({
  ui: {
    currentView: 'overview',
    globalSearch: ''
  },
  settings: {
    allowAutoApproveAcademy: false,
    requireFederationManualReview: true,
    requirePlazaListingReview: true,
    enableAiNudges: true,
    maintenanceMode: false
  },
  roles: [],
  applications: [],
  members: [],
  academy: [],
  academyLeadMissions: [],
  federationLeadDatabase: [],
  federationConnectionRequests: [],
  federationDealRooms: [],
  paymentLedger: [],
  payoutLedger: [],
  economy: {
    paymentCount: 0,
    paidPaymentCount: 0,
    pendingPaymentCount: 0,
    payoutCount: 0,
    pendingPayoutCount: 0,
    paidPayoutCount: 0,
    grossRevenue: 0,
    paidRevenue: 0,
    universeCommission: 0,
    operatorPayouts: 0,
    paidOperatorPayouts: 0,
    providerCounts: {}
  },
  federation: [],
  plazas: [],
  support: [],
  broadcasts: [],
  analytics: {
    finance: {
      totalRevenue: 0,
      monthlyRevenue: 0,
      averageOrderValue: 0,
      profitMargin: 0,
      countriesReached: 0,
      averageReviewDays: 0
    },
    targets: {
      membersGoal: 0,
      federationGoal: 0,
      monthlyRevenueGoal: 0,
      plazasGoal: 0
    },
    monthly: [],
    revenueMix: [],
    regions: []
  }
});

let state = defaultState();

const ADMIN_REVIEW_ACTIONS = new Set([
  'approve-application',
  'reject-application',
  'waitlist-application'
]);

const pendingAdminActionKeys = new Set();

function getAdminActionKey(action = '', id = '') {
  return `${String(action || '').trim()}::${String(id || '').trim()}`;
}

function isAdminReviewAction(action = '') {
  return ADMIN_REVIEW_ACTIONS.has(String(action || '').trim());
}

function getAdminActionButtons(action = '', id = '') {
  const targetAction = String(action || '').trim();
  const targetId = String(id || '').trim();

  if (!targetAction || !targetId) return [];

  return Array.from(document.querySelectorAll('[data-action]')).filter((button) => {
    return (
      String(button.dataset.action || '').trim() === targetAction &&
      String(button.dataset.id || '').trim() === targetId
    );
  });
}

function setAdminActionBusy(action = '', id = '', busy = false) {
  const buttons = getAdminActionButtons(action, id);
  const busyLabel = isAdminReviewAction(action) ? 'Processing...' : 'Working...';

  buttons.forEach((button) => {
    if (busy) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent || '';
      }

      if (!button.dataset.originalDisabled) {
        button.dataset.originalDisabled = button.disabled ? 'true' : 'false';
      }

      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-busy', 'true');
      button.dataset.actionPending = 'true';
      button.textContent = busyLabel;
      return;
    }

    const wasOriginallyDisabled = button.dataset.originalDisabled === 'true';

    if (!wasOriginallyDisabled) {
      button.disabled = false;
      button.removeAttribute('aria-disabled');
    }

    button.setAttribute('aria-busy', 'false');
    button.dataset.actionPending = 'false';

    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }

    delete button.dataset.originalText;
    delete button.dataset.originalDisabled;
  });
}

function beginAdminAction(action = '', id = '') {
  const key = getAdminActionKey(action, id);
  if (!key || pendingAdminActionKeys.has(key)) return false;

  pendingAdminActionKeys.add(key);
  setAdminActionBusy(action, id, true);

  return true;
}

function endAdminAction(action = '', id = '') {
  const key = getAdminActionKey(action, id);
  pendingAdminActionKeys.delete(key);
  setAdminActionBusy(action, id, false);
}

function getApplicationDecisionButtonAttrs(currentStatus = '', targetStatus = '') {
  const current = String(currentStatus || '').trim().toLowerCase();
  const target = String(targetStatus || '').trim().toLowerCase();

  return current && current === target
    ? ' disabled aria-disabled="true" data-action-locked="true"'
    : '';
}

function getAdminCoachModeKeyFromReplyFormat(value = '') {
  const raw = String(value || '').trim().toLowerCase();

  if (raw === 'politics_structured') return 'politics';
  if (raw === 'philosophy_structured') return 'philosophy';
  return 'general';
}

function normalizeAdminCoachMessage(message = {}) {
  const replyFormat = String(
    message.replyFormat ||
    message.reply_format ||
    'general'
  ).trim() || 'general';

  const coachModeKey = String(
    message.coachModeKey ||
    message.coach_mode_key ||
    getAdminCoachModeKeyFromReplyFormat(replyFormat)
  ).trim() || 'general';

  return {
    ...message,
    replyFormat,
    coachModeKey,
    responseStyleVersion: String(
      message.responseStyleVersion ||
      message.response_style_version ||
      ''
    ).trim(),
    text: String(message.text || '').trim()
  };
}

function normalizeAdminAcademyRecord(record = {}) {
  const rawRecentCoachMessages = Array.isArray(record.recentCoachMessages)
    ? record.recentCoachMessages
    : Array.isArray(record.coachMessages)
    ? record.coachMessages
    : [];

  const recentCoachMessages = rawRecentCoachMessages
    .map((message) => normalizeAdminCoachMessage(message))
    .filter(Boolean);

  const assistantMessages = recentCoachMessages.filter((message) => {
    return String(message?.role || '').trim().toLowerCase() === 'assistant';
  });

  const latestCoachMessage =
    assistantMessages[assistantMessages.length - 1] ||
    recentCoachMessages[recentCoachMessages.length - 1] ||
    null;

  const latestReplyFormat = String(
    record.latestReplyFormat ||
    record.replyFormat ||
    record.coachReplyFormat ||
    record.lastCoachReplyFormat ||
    latestCoachMessage?.replyFormat ||
    'general'
  ).trim() || 'general';

  const latestCoachModeKey = String(
    record.latestCoachModeKey ||
    record.coachModeKey ||
    record.lastCoachModeKey ||
    latestCoachMessage?.coachModeKey ||
    getAdminCoachModeKeyFromReplyFormat(latestReplyFormat)
  ).trim() || 'general';

  const responseStyleVersion = String(
    record.responseStyleVersion ||
    record.lastResponseStyleVersion ||
    latestCoachMessage?.responseStyleVersion ||
    ''
  ).trim();

  const latestCoachReply = String(
    record.latestCoachReply ||
    record.lastCoachReply ||
    latestCoachMessage?.text ||
    ''
  ).trim();

  return {
    ...record,
    recentCoachMessages,
    latestReplyFormat,
    latestCoachModeKey,
    responseStyleVersion,
    latestCoachReply
  };
}

function normalizeAdminLeadMissionRecord(record = {}) {
  const accessScopes = Array.isArray(record.accessScopes)
    ? record.accessScopes
    : Array.isArray(record.networkScopes)
      ? record.networkScopes
      : [];

  const networkTags = Array.isArray(record.networkTags)
    ? record.networkTags
    : Array.isArray(record.tags)
      ? record.tags
      : [];

  return {
    ...record,
    id: String(record.id || '').trim(),
    ownerUid: String(record.ownerUid || record.memberId || '').trim(),
    memberId: String(record.memberId || record.ownerUid || '').trim(),
    memberName: String(record.memberName || record.operatorName || 'Operator').trim(),
    operatorName: String(record.operatorName || record.memberName || 'Operator').trim(),
    sourceDivision: String(record.sourceDivision || 'academy').trim().toLowerCase() || 'academy',
    accessScopes: Array.from(new Set(accessScopes.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))),
    federationReady: record.federationReady === true || accessScopes.map((item) => String(item || '').trim().toLowerCase()).includes('federation'),
    plazaReady: record.plazaReady === true || accessScopes.map((item) => String(item || '').trim().toLowerCase()).includes('plazas'),
    networkTags: Array.from(new Set(networkTags.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))),
    strategicValue: String(record.strategicValue || 'standard').trim() || 'standard',

    sourceFeature: String(record.sourceFeature || '').trim(),
    sourceRecordId: String(record.sourceRecordId || '').trim(),
    sourceRecordPath: String(record.sourceRecordPath || '').trim(),
    routedFromAdmin: record.routedFromAdmin === true,
    routedSourceTitle: String(record.routedSourceTitle || '').trim(),
    assignedByAdmin: String(record.assignedByAdmin || '').trim(),
    assignedAt: String(record.assignedAt || '').trim(),
    assignmentStatus: String(record.assignmentStatus || '').trim(),
    reviewStatus: String(record.reviewStatus || '').trim(),
    completionProof: String(record.completionProof || '').trim(),
    submittedAt: String(record.submittedAt || '').trim(),
    submittedByName: String(record.submittedByName || '').trim(),
    reviewedAt: String(record.reviewedAt || '').trim(),
    reviewedBy: String(record.reviewedBy || '').trim(),
    adminReviewNote: String(record.adminReviewNote || '').trim(),
    missionType: String(record.missionType || '').trim(),
    missionBrief: String(record.missionBrief || '').trim(),
    academyMissionNeed: String(record.academyMissionNeed || '').trim(),
    opportunityOwnerName: String(record.opportunityOwnerName || '').trim(),
    opportunityValueAmount: Number(record.opportunityValueAmount || 0),
    platformCommissionRate: Number(record.platformCommissionRate || 0),
    platformCommissionAmount: Number(record.platformCommissionAmount || 0),
    operatorPayoutAmount: Number(record.operatorPayoutAmount || 0),
    earningLedgerId: String(record.earningLedgerId || '').trim(),
    earningStatus: String(record.earningStatus || '').trim(),

    tier: String(record.tier || '').trim(),
    companyName: String(record.companyName || '').trim(),
    companyWebsite: String(record.companyWebsite || '').trim(),
    contactName: String(record.contactName || '').trim(),
    contactRole: String(record.contactRole || '').trim(),
    contactType: String(record.contactType || '').trim(),
    email: String(record.email || '').trim(),
    phone: String(record.phone || '').trim(),
    city: String(record.city || '').trim(),
    country: String(record.country || '').trim(),
    sourceMethod: String(record.sourceMethod || '').trim(),
    callOutcome: String(record.callOutcome || '').trim(),
    interestLevel: String(record.interestLevel || '').trim(),
    rapportLevel: String(record.rapportLevel || '').trim(),
    pipelineStage: String(record.pipelineStage || '').trim(),
    priority: String(record.priority || '').trim(),
    nextAction: String(record.nextAction || '').trim(),
    channel: String(record.channel || '').trim(),
    taskStatus: String(record.taskStatus || '').trim(),
    callType: String(record.callType || '').trim(),
    objection: String(record.objection || '').trim(),
    notes: String(record.notes || '').trim(),
    followUpDueDate: String(record.followUpDueDate || '').trim(),
    status: String(record.status || 'active').trim(),
    createdAt: String(record.createdAt || '').trim(),
    updatedAt: String(record.updatedAt || '').trim(),
    payoutCount: Number(record.payoutCount || 0),
    dealCount: Number(record.dealCount || 0),
    approvedPayoutTotal: Number(record.approvedPayoutTotal || 0),
    grossDealTotal: Number(record.grossDealTotal || 0)
  };
}
function normalizeAdminFederationRequestRecord(record = {}) {
  return {
    ...record,
    id: String(record.id || '').trim(),
    requesterUid: String(record.requesterUid || '').trim(),
    requesterName: String(record.requesterName || 'Federation Member').trim(),
    requesterEmail: String(record.requesterEmail || '').trim(),

    ownerUid: String(record.ownerUid || '').trim(),
    leadId: String(record.leadId || '').trim(),
    leadPath: String(record.leadPath || '').trim(),
    requestMode: String(record.requestMode || (record.leadId ? 'selected_lead' : 'match_request')).trim(),
    requestedContact: record.requestedContact && typeof record.requestedContact === 'object'
      ? record.requestedContact
      : null,

    matchedAt: String(record.matchedAt || '').trim(),
    matchedBy: String(record.matchedBy || '').trim(),

    opportunityId: String(record.opportunityId || '').trim(),
    opportunityTitle: String(record.opportunityTitle || 'Connection request').trim(),

    status: String(record.status || 'pending_admin_match').trim(),
    adminStatus: String(record.adminStatus || 'pending_review').trim(),

    pricingAmount: Number(record.pricingAmount || 0),
    currency: String(record.currency || 'USD').trim() || 'USD',
    platformCommissionRate: Number(record.platformCommissionRate || 0),
    platformCommissionAmount: Number(record.platformCommissionAmount || 0),
    operatorPayoutAmount: Number(record.operatorPayoutAmount || 0),
    paymentStatus: String(record.paymentStatus || 'not_started').trim(),
    payoutStatus: String(record.payoutStatus || 'not_started').trim(),
    commissionStatus: String(record.commissionStatus || 'not_started').trim(),
    dealNotes: String(record.dealNotes || '').trim(),

    paymentLedgerId: String(record.paymentLedgerId || '').trim(),
    paymentLedgerStatus: String(record.paymentLedgerStatus || '').trim(),
    selectedPaymentProvider: String(record.selectedPaymentProvider || '').trim(),
    paymentProviderLabel: String(record.paymentProviderLabel || '').trim(),
    paymentMethod: String(record.paymentMethod || '').trim(),
    sourcePaymentMode: String(record.sourcePaymentMode || '').trim(),
    leadAccessGrantId: String(record.leadAccessGrantId || '').trim(),
    leadAccessStatus: String(record.leadAccessStatus || '').trim(),

    budgetRange: String(record.budgetRange || 'not_sure').trim(),
    urgency: String(record.urgency || 'normal').trim(),
    preferredIntroType: String(record.preferredIntroType || 'admin_brokered').trim(),
    requestReason: String(record.requestReason || '').trim(),
    intendedUse: String(record.intendedUse || '').trim(),
    notes: String(record.notes || '').trim(),

    category: String(record.category || '').trim(),
    contactRole: String(record.contactRole || '').trim(),
    city: String(record.city || '').trim(),
    country: String(record.country || '').trim(),
    strategicValue: String(record.strategicValue || 'standard').trim(),

    createdAt: String(record.createdAt || '').trim(),
    updatedAt: String(record.updatedAt || '').trim()
  };
}
function normalizeAdminFederationDealRoomRecord(record = {}) {
  return {
    ...record,
    id: String(record.id || '').trim(),
    title: String(record.title || 'Federation Deal Room').trim(),
    roomType: String(record.roomType || record.type || 'partnership').trim(),
    description: String(record.description || record.text || '').trim(),
    partnerNeed: String(record.partnerNeed || '').trim(),
    expectedValueAmount: Number(record.expectedValueAmount || 0),
    currency: String(record.currency || 'USD').trim().toUpperCase() || 'USD',
    platformCommissionRate: Number(record.platformCommissionRate || 0),
    platformCommissionAmount: Number(record.platformCommissionAmount || 0),
    adminStatus: String(record.adminStatus || 'pending_admin_review').trim(),
    dealStatus: String(record.dealStatus || 'proposed').trim(),
    commissionStatus: String(record.commissionStatus || 'pending').trim(),
    sourceDivision: String(record.sourceDivision || 'federation').trim(),
    sourceFeature: String(record.sourceFeature || 'deal_rooms').trim(),
    creatorUid: String(record.creatorUid || '').trim(),
    creatorName: String(record.creatorName || 'Federation Member').trim(),
    creatorEmail: String(record.creatorEmail || '').trim(),
    participantUids: Array.isArray(record.participantUids)
      ? record.participantUids.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    linkedPlazaOpportunityId: String(record.linkedPlazaOpportunityId || '').trim(),
    academyMissionNeed: String(record.academyMissionNeed || '').trim(),
    adminNotes: String(record.adminNotes || '').trim(),
    createdAt: String(record.createdAt || '').trim(),
    updatedAt: String(record.updatedAt || '').trim()
  };
}
function normalizeAdminPaymentLedgerRecord(record = {}) {
  return {
    ...record,
    id: String(record.id || '').trim(),
    sourceDivision: String(record.sourceDivision || '').trim(),
    sourceFeature: String(record.sourceFeature || '').trim(),
    sourceRecordId: String(record.sourceRecordId || '').trim(),

    payerUid: String(record.payerUid || '').trim(),
    payerEmail: String(record.payerEmail || '').trim(),
    payerName: String(record.payerName || 'Federation Buyer').trim(),

    provider: String(record.provider || 'unselected').trim().toLowerCase(),
    providerPaymentId: String(record.providerPaymentId || '').trim(),
    providerStatus: String(record.providerStatus || '').trim(),
    paymentMethod: String(record.paymentMethod || 'unselected').trim(),

    amount: Number(record.amount || 0),
    currency: String(record.currency || 'USD').trim().toUpperCase() || 'USD',
    cryptoAmount: Number(record.cryptoAmount || 0),
    cryptoCurrency: String(record.cryptoCurrency || '').trim().toUpperCase(),
    cryptoNetwork: String(record.cryptoNetwork || '').trim(),

    status: String(record.status || 'draft').trim().toLowerCase(),
    platformCommissionAmount: Number(record.platformCommissionAmount || 0),
    operatorPayoutAmount: Number(record.operatorPayoutAmount || 0),

    createdAt: String(record.createdAt || '').trim(),
    updatedAt: String(record.updatedAt || '').trim(),
    paidAt: String(record.paidAt || '').trim()
  };
}

function normalizeAdminPayoutLedgerRecord(record = {}) {
  return {
    ...record,
    id: String(record.id || '').trim(),

    receiverUid: String(record.receiverUid || '').trim(),
    receiverEmail: String(record.receiverEmail || '').trim(),
    receiverName: String(record.receiverName || 'Operator').trim(),

    sourceDivision: String(record.sourceDivision || 'academy').trim(),
    sourceFeature: String(record.sourceFeature || '').trim(),
    sourcePaymentId: String(record.sourcePaymentId || '').trim(),
    sourceRecordId: String(record.sourceRecordId || '').trim(),

    method: String(record.method || 'local_bank').trim().toLowerCase(),
    provider: String(record.provider || 'manual').trim().toLowerCase(),

    amount: Number(record.amount || 0),
    currency: String(record.currency || 'USD').trim().toUpperCase() || 'USD',

    bankCountry: String(record.bankCountry || '').trim(),
    bankName: String(record.bankName || '').trim(),
    accountName: String(record.accountName || '').trim(),
    accountNumberMasked: String(record.accountNumberMasked || '').trim(),
    cardLast4: String(record.cardLast4 || '').trim(),
    cryptoCurrency: String(record.cryptoCurrency || '').trim().toUpperCase(),
    cryptoNetwork: String(record.cryptoNetwork || '').trim(),
    walletAddressMasked: String(record.walletAddressMasked || '').trim(),

    status: String(record.status || 'pending_review').trim().toLowerCase(),
    adminNote: String(record.adminNote || '').trim(),

    createdAt: String(record.createdAt || '').trim(),
    approvedAt: String(record.approvedAt || '').trim(),
    paidAt: String(record.paidAt || '').trim(),
    updatedAt: String(record.updatedAt || '').trim()
  };
}

function normalizeAdminEconomySummary(record = {}) {
  return {
    paymentCount: Number(record.paymentCount || 0),
    paidPaymentCount: Number(record.paidPaymentCount || 0),
    pendingPaymentCount: Number(record.pendingPaymentCount || 0),
    payoutCount: Number(record.payoutCount || 0),
    pendingPayoutCount: Number(record.pendingPayoutCount || 0),
    paidPayoutCount: Number(record.paidPayoutCount || 0),
    grossRevenue: Number(record.grossRevenue || 0),
    paidRevenue: Number(record.paidRevenue || 0),
    universeCommission: Number(record.universeCommission || 0),
    operatorPayouts: Number(record.operatorPayouts || 0),
    paidOperatorPayouts: Number(record.paidOperatorPayouts || 0),
    providerCounts: record.providerCounts && typeof record.providerCounts === 'object'
      ? record.providerCounts
      : {}
  };
}

function normalizeAdminApplicationRecord(record = {}) {
  const profile = getFederationProfileMap(record);
  const isFederation = isFederationApplicationRecord(record);
  const strategic = normalizeAdminStrategicReadinessSnapshot(record);

  const normalizedAiScore = isFederation
    ? Number(
        record.aiScore ||
        record.federationScore ||
        strategic.score ||
        profile.score ||
        0
      )
    : Number(record.aiScore || 0);

  return {
    ...record,
    id: String(record.id || '').trim(),
    name: String(record.name || record.fullName || 'Applicant').trim(),
    fullName: String(record.fullName || record.name || 'Applicant').trim(),
    email: String(record.email || '').trim(),

    recommendedDivision: String(record.recommendedDivision || record.division || 'Academy').trim(),
    applicationType: String(record.applicationType || 'general').trim(),
    status: String(record.status || 'Under Review').trim(),

    roles: isFederation ? profile.roles : toAdminStringArray(record.roles),
    level: isFederation ? profile.level : String(record.level || '').trim(),

    audienceSize: isFederation ? profile.audienceSize : String(record.audienceSize || '').trim(),
    activePlatforms: isFederation ? profile.activePlatforms : toAdminStringArray(record.activePlatforms),
    capitalRange: isFederation ? profile.capitalRange : String(record.capitalRange || '').trim(),
    teamSize: isFederation ? profile.teamSize : String(record.teamSize || '').trim(),
    skillLevel: isFederation ? profile.skillLevel : String(record.skillLevel || '').trim(),

    lookingFor: isFederation ? profile.lookingFor : String(record.lookingFor || '').trim(),
    canOffer: isFederation ? profile.canOffer : String(record.canOffer || '').trim(),
    wantsAccessTo: isFederation ? profile.wantsAccessTo : String(record.wantsAccessTo || '').trim(),
    openTo: isFederation ? profile.openTo : toAdminStringArray(record.openTo),

    opportunityInsight: isFederation ? profile.opportunityInsight : String(record.opportunityInsight || '').trim(),
    tenKPlan: isFederation ? profile.tenKPlan : String(record.tenKPlan || '').trim(),
    openToFeature: isFederation ? profile.openToFeature : String(record.openToFeature || '').trim(),

    federationProfileMap: isFederation ? profile : record.federationProfileMap,
    federationScore: isFederation ? profile.score : Number(record.federationScore || strategic.score || 0),
    federationTier: isFederation ? profile.tier : String(record.federationTier || strategic.tier || '').trim(),
    federationTags: isFederation ? profile.tags : toAdminStringArray(record.federationTags),

    strategicReadinessSnapshot: strategic,
    aiScore: normalizedAiScore
  };
}
function normalizeAdminBootstrapState(incomingState = {}) {
  const merged = mergeState(defaultState(), incomingState || {});

  const academyLeadMissions = Array.isArray(merged.academyLeadMissions)
    ? merged.academyLeadMissions.map((record) => normalizeAdminLeadMissionRecord(record))
    : [];

  const federationLeadDatabase = Array.isArray(merged.federationLeadDatabase) && merged.federationLeadDatabase.length
    ? merged.federationLeadDatabase.map((record) => normalizeAdminLeadMissionRecord(record))
    : academyLeadMissions.filter((record) => record.federationReady === true);

  return {
    ...merged,
    applications: Array.isArray(merged.applications)
      ? merged.applications.map((record) => normalizeAdminApplicationRecord(record))
      : [],
    academy: Array.isArray(merged.academy)
      ? merged.academy.map((record) => normalizeAdminAcademyRecord(record))
      : [],
    academyLeadMissions,
    federationLeadDatabase,
    federationConnectionRequests: Array.isArray(merged.federationConnectionRequests)
      ? merged.federationConnectionRequests.map((record) => normalizeAdminFederationRequestRecord(record))
      : [],
    federationDealRooms: Array.isArray(merged.federationDealRooms)
      ? merged.federationDealRooms.map((record) => normalizeAdminFederationDealRoomRecord(record))
      : [],
    paymentLedger: Array.isArray(merged.paymentLedger)
      ? merged.paymentLedger.map((record) => normalizeAdminPaymentLedgerRecord(record))
      : [],
    payoutLedger: Array.isArray(merged.payoutLedger)
      ? merged.payoutLedger.map((record) => normalizeAdminPayoutLedgerRecord(record))
      : [],
    economy: normalizeAdminEconomySummary(merged.economy || {})
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeAdminBootstrapState(defaultState());
    const parsed = JSON.parse(raw);
    return normalizeAdminBootstrapState(parsed);
  } catch {
    return normalizeAdminBootstrapState(defaultState());
  }
}
function redirectToAdminLogin(message = 'Admin session expired. Please sign in again.') {
  try {
    showToast(message);
  } catch (_) {}

  setTimeout(() => {
    window.location.replace(buildAdminLoginUrl());
  }, 420);
}

async function adminFetchJson(url, options = {}) {
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers
  });

  const data = await res.json().catch(() => null);

  if (res.status === 401 || data?.message === 'No active admin session.') {
    redirectToAdminLogin('Admin session expired. Please sign in again.');
    throw new Error('No active admin session.');
  }

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || 'Admin request failed.');
  }

  return { res, data };
}
async function loadAdminBootstrap() {
  try {
    const { data } = await adminFetchJson('/api/admin/bootstrap', {
      method: 'GET'
    });

    state = normalizeAdminBootstrapState(data.state || {});
    saveState();
    renderApp();
  } catch (error) {
    console.error('loadAdminBootstrap error:', error);

    if (error?.message === 'No active admin session.') {
      return;
    }

    showToast(error.message || 'Failed to load live admin data.');
  }
}

function mergeState(base, incoming) {
  if (Array.isArray(base)) {
    return Array.isArray(incoming) ? incoming : base;
  }

  if (base && typeof base === 'object') {
    const output = { ...base };
    const source = incoming && typeof incoming === 'object' ? incoming : {};
    Object.keys(base).forEach(key => {
      output[key] = mergeState(base[key], source[key]);
    });
    return output;
  }

  return incoming === undefined ? base : incoming;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  state = normalizeAdminBootstrapState(defaultState());
  saveState();
  renderApp();
  showToast('Demo data reset.');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  const isMobile = window.innerWidth <= 980;

  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.left = '50%';
  toast.style.right = 'auto';
  toast.style.top = isMobile ? '84px' : '96px';
  toast.style.bottom = 'auto';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '10000';
  toast.style.width = isMobile ? 'calc(100vw - 32px)' : 'min(90vw, 420px)';
  toast.style.maxWidth = isMobile ? '360px' : '420px';
  toast.style.padding = isMobile ? '10px 12px' : '11px 14px';
  toast.style.borderRadius = isMobile ? '10px' : '12px';
  toast.style.fontSize = isMobile ? '0.84rem' : '0.9rem';
  toast.style.lineHeight = '1.35';
  toast.style.textAlign = 'center';
  toast.style.boxSizing = 'border-box';
  toast.style.wordBreak = 'break-word';

  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2300);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatAdminMoney(value = 0, currency = 'USD') {
  const amount = Number(value || 0);
  const cleanCurrency = String(currency || 'USD').trim().toUpperCase() || 'USD';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cleanCurrency,
      maximumFractionDigits: 0
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch (_) {
    return `${cleanCurrency} ${Number.isFinite(amount) ? amount : 0}`;
  }
}

function summarizeAdminMoney(records = [], field = 'pricingAmount') {
  const totals = {};

  (Array.isArray(records) ? records : []).forEach((record) => {
    const currency = String(record?.currency || 'USD').trim().toUpperCase() || 'USD';
    const amount = Number(record?.[field] || 0);

    if (!Number.isFinite(amount) || amount <= 0) return;
    totals[currency] = (totals[currency] || 0) + amount;
  });

  const parts = Object.entries(totals).map(([currency, amount]) => {
    return formatAdminMoney(amount, currency);
  });

  return parts.length ? parts.join(' + ') : formatAdminMoney(0, 'USD');
}

function getAdminEconomyMetrics() {
  const payments = Array.isArray(state.paymentLedger) ? state.paymentLedger : [];
  const payouts = Array.isArray(state.payoutLedger) ? state.payoutLedger : [];

  const paidPayments = payments.filter((payment) => String(payment.status || '').toLowerCase() === 'paid');
  const pendingPayments = payments.filter((payment) => {
    const status = String(payment.status || '').toLowerCase();
    return ['draft', 'checkout_started', 'pending'].includes(status);
  });
  const pendingPayouts = payouts.filter((payout) => {
    const status = String(payout.status || '').toLowerCase();
    return ['pending_review', 'approved', 'processing'].includes(status);
  });

  return {
    paymentCount: payments.length,
    paidPaymentCount: paidPayments.length,
    pendingPaymentCount: pendingPayments.length,
    payoutCount: payouts.length,
    pendingPayoutCount: pendingPayouts.length,
    paidRevenueLabel: summarizeAdminMoney(paidPayments, 'amount'),
    grossRevenueLabel: summarizeAdminMoney(payments, 'amount'),
    universeCommissionLabel: summarizeAdminMoney(paidPayments, 'platformCommissionAmount'),
    operatorPayoutLabel: summarizeAdminMoney(payments, 'operatorPayoutAmount')
  };
}

function formatAdminLedgerStatus(value = '') {
  return String(value || 'not_started')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function updateAdminPayoutStatus(payoutId = '', status = '') {
  const cleanId = String(payoutId || '').trim();
  const cleanStatus = String(status || '').trim().toLowerCase();

  if (!cleanId || !cleanStatus) {
    throw new Error('Missing payout id or status.');
  }

  await adminFetchJson(`/api/admin/economy/payouts/${encodeURIComponent(cleanId)}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: cleanStatus
    })
  });

  await loadAdminBootstrap();
}

function getAdminFederationEconomyMetrics() {
  const requests = Array.isArray(state.federationConnectionRequests)
    ? state.federationConnectionRequests
    : [];

  const pricedRequests = requests.filter((request) => {
    const status = String(request.status || '').trim().toLowerCase();
    return (
      Number(request.pricingAmount || 0) > 0 ||
      Number(request.operatorPayoutAmount || 0) > 0 ||
      ['pricing_sent', 'paid', 'intro_delivered', 'completed'].includes(status)
    );
  });

  const paidRequests = requests.filter((request) => {
    const status = String(request.status || '').trim().toLowerCase();
    const paymentStatus = String(request.paymentStatus || '').trim().toLowerCase();

    return status === 'paid' ||
      status === 'intro_delivered' ||
      status === 'completed' ||
      paymentStatus === 'paid';
  });

  const mirroredRequests = pricedRequests.filter((request) => {
    return String(request.ownerUid || '').trim() && String(request.leadId || '').trim();
  });

  return {
    pricedCount: pricedRequests.length,
    paidCount: paidRequests.length,
    mirroredCount: mirroredRequests.length,
    grossValueLabel: summarizeAdminMoney(pricedRequests, 'pricingAmount'),
    paidValueLabel: summarizeAdminMoney(paidRequests, 'pricingAmount'),
    platformCommissionLabel: summarizeAdminMoney(pricedRequests, 'platformCommissionAmount'),
    operatorPayoutLabel: summarizeAdminMoney(pricedRequests, 'operatorPayoutAmount')
  };
}

function formatBadge(value) {
  const map = {
    New: 'blue',
    'Under Review': 'amber',
    Approved: 'green',
    Rejected: 'red',
    Waitlisted: 'purple',
    'Needs More Info': 'cyan',
    Active: 'green',
    Pending: 'amber',
    Suspended: 'red',
    Flagged: 'red',
    'On Track': 'green',
    'Needs Review': 'amber',
    'At Risk': 'red',
    Candidate: 'blue',
    'Under Vetting': 'amber',
    Verified: 'green',
    Hold: 'gray',
    'Strategic Priority': 'purple',
    'Pending Review': 'amber',
    Archived: 'gray',
    Open: 'blue',
    'In Progress': 'amber',
    'Waiting on User': 'gray',
    Escalated: 'red',
    Resolved: 'green',
    Service: 'cyan',
    Job: 'blue',
    Request: 'purple',
    Low: 'gray',
    Medium: 'amber',
    High: 'red',
    Academy: 'blue',
    Federation: 'purple',
    Plazas: 'cyan',
    Academic: 'blue',
    Financial: 'green',
    Physical: 'cyan',
    Mental: 'purple',
    Access: 'blue',
    Dispute: 'red',
    Profile: 'gray',
    Policy: 'purple',
    Investor: 'green',
    Lawyer: 'blue',
    Operator: 'amber',
    Creator: 'cyan',
    'All Members': 'gray',
    'Pending Applicants': 'amber',

    Politics: 'red',
    politics: 'red',
    Philosophy: 'purple',
    philosophy: 'purple',
    General: 'gray',
    general: 'gray',

    'Politics Structured': 'red',
    politics_structured: 'red',
    'Philosophy Structured': 'purple',
    philosophy_structured: 'purple'
  };
  const tone = map[value] || 'gray';
  return `<span class="badge badge-${tone}">${escapeHtml(value)}</span>`;
}
function toAdminStringArray(value, maxItems = 32) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[,|\n]/)
        .map((item) => item.trim());

  const seen = new Set();

  return source
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

function isFederationApplicationRecord(record = {}) {
  const division = String(record.recommendedDivision || record.division || '').trim().toLowerCase();
  const type = String(record.applicationType || '').trim().toLowerCase();

  return division === 'federation' || type.includes('federation');
}

function getFederationProfileMap(record = {}) {
  const map =
    record.federationProfileMap && typeof record.federationProfileMap === 'object'
      ? record.federationProfileMap
      : {};

  const roles = toAdminStringArray(
    map.roles ||
    record.roles ||
    record.roleTags ||
    record.currentPositions ||
    record.currentPosition ||
    record.role
  );

  const activePlatforms = toAdminStringArray(map.activePlatforms || record.activePlatforms);
  const openTo = toAdminStringArray(map.openTo || record.openTo);
  const tags = toAdminStringArray(map.tags || record.federationTags || record.tags);

  const score = Number(
    record.federationScore ??
    map.score ??
    map.federationScore ??
    record.aiScore ??
    0
  );

  const tier = String(
    record.federationTier ||
    map.tier ||
    map.federationTier ||
    getFederationTierFromScore(score)
  ).trim();

  return {
    roles,
    role: String(map.role || record.role || record.profession || roles[0] || '').trim(),
    primaryCategory: String(map.primaryCategory || record.primaryCategory || record.category || '').trim(),

    level: String(map.level || record.level || '').trim(),

    audienceSize: String(map.audienceSize || record.audienceSize || '').trim(),
    activePlatforms,
    capitalRange: String(map.capitalRange || record.capitalRange || '').trim(),
    teamSize: String(map.teamSize || record.teamSize || '').trim(),
    skillLevel: String(map.skillLevel || record.skillLevel || '').trim(),

    lookingFor: String(map.lookingFor || record.lookingFor || record.whyJoin || record.wantedContactReason || '').trim(),
    canOffer: String(map.canOffer || record.canOffer || record.valueBring || record.networkValue || '').trim(),
    wantsAccessTo: String(map.wantsAccessTo || record.wantsAccessTo || record.introductions || record.wantedContactTypesRaw || '').trim(),
    openTo,

    opportunityInsight: String(map.opportunityInsight || record.opportunityInsight || '').trim(),
    tenKPlan: String(map.tenKPlan || record.tenKPlan || '').trim(),
    openToFeature: String(map.openToFeature || record.openToFeature || '').trim(),

    tags,
    score,
    tier
  };
}

function normalizeAdminStrategicReadinessSnapshot(record = {}) {
  const snapshot =
    record.strategicReadinessSnapshot && typeof record.strategicReadinessSnapshot === 'object'
      ? record.strategicReadinessSnapshot
      : record.federationStrategicSnapshot && typeof record.federationStrategicSnapshot === 'object'
      ? record.federationStrategicSnapshot
      : {};

  const score = Number(
    snapshot.score ??
    snapshot.opportunityScore ??
    record.federationScore ??
    record.aiScore ??
    0
  );

  const tier = String(
    snapshot.tier ||
    record.federationTier ||
    getFederationTierFromScore(score)
  ).trim();

  return {
    score,
    tier,
    plazaProfileStatus: String(snapshot.plazaProfileStatus || '').trim(),
    opportunityStage: String(snapshot.opportunityStage || '').trim(),
    opportunityCopy: String(snapshot.opportunityCopy || '').trim(),
    federationReadinessLabel: String(snapshot.federationReadinessLabel || snapshot.label || '').trim(),
    federationReadinessCopy: String(snapshot.federationReadinessCopy || snapshot.copy || '').trim(),
    connectReady: snapshot.connectReady === true,

    role: String(snapshot.role || record.role || record.profession || '').trim(),
    focus: String(snapshot.focus || '').trim(),
    trust: String(snapshot.trust || '').trim(),
    region: String(snapshot.region || record.region || [record.city, record.country].filter(Boolean).join(', ')).trim(),
    availability: String(snapshot.availability || '').trim(),
    workMode: String(snapshot.workMode || '').trim(),
    marketplaceMode: snapshot.marketplaceMode === true,

    tags: toAdminStringArray(snapshot.tags),
    lookingFor: toAdminStringArray(snapshot.lookingFor),
    canOffer: toAdminStringArray(snapshot.canOffer)
  };
}

function getFederationTierFromScore(score = 0) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));

  if (safeScore >= 90) return 'CORE';
  if (safeScore >= 70) return 'OPERATOR';
  if (safeScore >= 50) return 'CONTRIBUTOR';

  return 'LOW_PRIORITY';
}

function getFederationApplicationScore(record = {}) {
  return getFederationProfileMap(record).score;
}

function getFederationTierLabel(record = {}) {
  const tier = String(getFederationProfileMap(record).tier || '').trim();

  if (tier === 'LOW_PRIORITY') return 'Low Priority';
  if (tier === 'CORE') return 'Core';
  if (tier === 'OPERATOR') return 'Operator';
  if (tier === 'CONTRIBUTOR') return 'Contributor';

  return tier || 'Unranked';
}

function formatFederationTierBadge(record = {}) {
  const tier = String(getFederationProfileMap(record).tier || '').trim();
  const label = getFederationTierLabel(record);

  const tone =
    tier === 'CORE'
      ? 'purple'
      : tier === 'OPERATOR'
        ? 'green'
        : tier === 'CONTRIBUTOR'
          ? 'blue'
          : 'gray';

  return `<span class="badge badge-${tone}">${escapeHtml(label)}</span>`;
}

function buildApplicationScoreMarkup(app = {}) {
  const isFederation = isFederationApplicationRecord(app);

  if (!isFederation) {
    return `<strong>${Number(app.aiScore || 0)}</strong>`;
  }

  const score = getFederationApplicationScore(app);

  return `
    <div class="application-score-cell">
      <strong>${escapeHtml(String(score))}</strong>
      ${formatFederationTierBadge(app)}
    </div>
  `;
}

function buildAdminChipList(items = [], emptyText = '—') {
  const values = toAdminStringArray(items);

  if (!values.length) {
    return `<span class="muted">${escapeHtml(emptyText)}</span>`;
  }

  return `
    <div class="admin-chip-list">
      ${values.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
    </div>
  `;
}

function buildFederationProfileMapMarkup(record = {}) {
  if (!isFederationApplicationRecord(record)) return '';

  const profile = getFederationProfileMap(record);

  return `
    <div class="drawer-section federation-profile-map-section">
      <div class="federation-profile-map-head">
        <div>
          <h4>Federation Power Map</h4>
          <p class="muted">Internal profile map for score, tier, resources, intent, and matching.</p>
        </div>
        <div class="federation-score-lockup">
          <span>Score</span>
          <strong>${escapeHtml(String(profile.score))}</strong>
          ${formatFederationTierBadge(record)}
        </div>
      </div>

      <div class="application-meta-grid federation-power-grid">
        <div class="application-meta-item">
          <span>Level</span>
          <strong>${escapeHtml(profile.level || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Primary Category</span>
          <strong>${escapeHtml(profile.primaryCategory || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Audience</span>
          <strong>${escapeHtml(profile.audienceSize || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Capital</span>
          <strong>${escapeHtml(profile.capitalRange || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Team</span>
          <strong>${escapeHtml(profile.teamSize || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Skill Level</span>
          <strong>${escapeHtml(profile.skillLevel || '—')}</strong>
        </div>
      </div>

      <div class="answer-stack federation-map-stack">
        <div class="answer-card">
          <span class="answer-label">Roles / Positions</span>
          ${buildAdminChipList(profile.roles)}
        </div>

        <div class="answer-card">
          <span class="answer-label">Active Platforms</span>
          ${buildAdminChipList(profile.activePlatforms)}
        </div>

        <div class="answer-card">
          <span class="answer-label">Open To</span>
          ${buildAdminChipList(profile.openTo)}
        </div>

        <div class="answer-card">
          <span class="answer-label">Federation Tags</span>
          ${buildAdminChipList(profile.tags)}
        </div>

        <div class="answer-card">
          <span class="answer-label">Looking For</span>
          <p>${escapeHtml(profile.lookingFor || 'No answer submitted.')}</p>
        </div>

        <div class="answer-card">
          <span class="answer-label">Can Offer</span>
          <p>${escapeHtml(profile.canOffer || 'No answer submitted.')}</p>
        </div>

        <div class="answer-card">
          <span class="answer-label">Wants Access To</span>
          <p>${escapeHtml(profile.wantsAccessTo || 'No answer submitted.')}</p>
        </div>

        <div class="answer-card">
          <span class="answer-label">Opportunity Insight</span>
          <p>${escapeHtml(profile.opportunityInsight || 'No answer submitted.')}</p>
        </div>

        <div class="answer-card">
          <span class="answer-label">10K People Plan</span>
          <p>${escapeHtml(profile.tenKPlan || 'No answer submitted.')}</p>
        </div>
      </div>
    </div>
  `;
}

function buildStrategicReadinessSnapshotMarkup(record = {}) {
  if (!isFederationApplicationRecord(record)) return '';

  const snapshot = normalizeAdminStrategicReadinessSnapshot(record);

  const hasSignal =
    snapshot.score > 0 ||
    snapshot.federationReadinessLabel ||
    snapshot.opportunityStage ||
    snapshot.role ||
    snapshot.focus;

  if (!hasSignal) return '';

  return `
    <div class="drawer-section federation-profile-map-section">
      <div class="federation-profile-map-head">
        <div>
          <h4>Strategic Readiness Snapshot</h4>
          <p class="muted">This is the same ladder state sent from Plaza/Federation candidacy logic into admin review.</p>
        </div>
        <div class="federation-score-lockup">
          <span>Score</span>
          <strong>${escapeHtml(String(snapshot.score || 0))}</strong>
          ${formatBadge(snapshot.federationReadinessLabel || 'Plaza First')}
        </div>
      </div>

      <div class="application-meta-grid federation-power-grid">
        <div class="application-meta-item">
          <span>Readiness</span>
          <strong>${escapeHtml(snapshot.federationReadinessLabel || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Opportunity Stage</span>
          <strong>${escapeHtml(snapshot.opportunityStage || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Connect Ready</span>
          <strong>${escapeHtml(snapshot.connectReady ? 'Yes' : 'No')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Trust</span>
          <strong>${escapeHtml(snapshot.trust || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Region</span>
          <strong>${escapeHtml(snapshot.region || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Work Mode</span>
          <strong>${escapeHtml(snapshot.workMode || '—')}</strong>
        </div>
      </div>

      <div class="answer-stack federation-map-stack">
        <div class="answer-card">
          <span class="answer-label">Snapshot Role</span>
          <p>${escapeHtml(snapshot.role || 'No role carried over.')}</p>
        </div>

        <div class="answer-card">
          <span class="answer-label">Snapshot Focus</span>
          <p>${escapeHtml(snapshot.focus || 'No focus carried over.')}</p>
        </div>

        <div class="answer-card">
          <span class="answer-label">Snapshot Looking For</span>
          ${buildAdminChipList(snapshot.lookingFor, 'No looking-for signal carried over.')}
        </div>

        <div class="answer-card">
          <span class="answer-label">Snapshot Can Offer</span>
          ${buildAdminChipList(snapshot.canOffer, 'No can-offer signal carried over.')}
        </div>

        <div class="answer-card">
          <span class="answer-label">Snapshot Tags</span>
          ${buildAdminChipList(snapshot.tags, 'No strategic tags carried over.')}
        </div>

        <div class="answer-card">
          <span class="answer-label">Readiness Copy</span>
          <p>${escapeHtml(snapshot.federationReadinessCopy || snapshot.opportunityCopy || 'No strategic review copy available.')}</p>
        </div>
      </div>
    </div>
  `;
}

function normalizeCoachReplyFormatLabel(value) {
  const raw = String(value || '').trim().toLowerCase();

  if (!raw) return '';
  if (raw === 'politics_structured' || raw === 'politics structured') return 'Politics Structured';
  if (raw === 'philosophy_structured' || raw === 'philosophy structured') return 'Philosophy Structured';
  if (raw === 'general') return 'General';

  return String(value || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCoachReplyBadge(value) {
  const label = normalizeCoachReplyFormatLabel(value);
  return label ? formatBadge(label) : '';
}

function getAcademyLatestCoachMessage(record = {}) {
  const messages = Array.isArray(record.recentCoachMessages)
    ? record.recentCoachMessages
    : Array.isArray(record.coachMessages)
    ? record.coachMessages
    : [];

  const assistantMessages = messages.filter((message) => {
    return String(message?.role || '').trim().toLowerCase() === 'assistant';
  });

  return assistantMessages[assistantMessages.length - 1] || messages[messages.length - 1] || null;
}

function buildAcademyCoachInspectorMarkup(record = {}) {
  const latestCoachMessage = getAcademyLatestCoachMessage(record);

  const latestReplyFormat =
    record.latestReplyFormat ||
    record.replyFormat ||
    record.coachReplyFormat ||
    record.lastCoachReplyFormat ||
    latestCoachMessage?.replyFormat ||
    latestCoachMessage?.reply_format ||
    'general';

  const latestCoachModeKey =
    record.latestCoachModeKey ||
    record.coachModeKey ||
    record.lastCoachModeKey ||
    latestCoachMessage?.coachModeKey ||
    latestCoachMessage?.coach_mode_key ||
    '';

  const responseStyleVersion =
    record.responseStyleVersion ||
    record.lastResponseStyleVersion ||
    latestCoachMessage?.responseStyleVersion ||
    latestCoachMessage?.response_style_version ||
    '';

  const latestCoachReply = String(
    record.latestCoachReply ||
    record.lastCoachReply ||
    latestCoachMessage?.text ||
    ''
  ).trim();

  const recentAssistantMessages = (
    Array.isArray(record.recentCoachMessages)
      ? record.recentCoachMessages
      : Array.isArray(record.coachMessages)
      ? record.coachMessages
      : []
  )
    .filter((message) => String(message?.role || '').trim().toLowerCase() === 'assistant')
    .slice(-3)
    .reverse();

  const latestReplyBadge = formatCoachReplyBadge(latestReplyFormat);
  const modeBadge = latestCoachModeKey ? formatBadge(normalizeCoachReplyFormatLabel(latestCoachModeKey)) : '';
  const recentMessagesHtml = recentAssistantMessages.length
    ? recentAssistantMessages.map((message) => {
        const messageReplyBadge = formatCoachReplyBadge(
          message?.replyFormat || message?.reply_format || 'general'
        );

        const messageModeBadge = message?.coachModeKey || message?.coach_mode_key
          ? formatBadge(
              normalizeCoachReplyFormatLabel(message?.coachModeKey || message?.coach_mode_key)
            )
          : '';

        return `
          <div class="stack-item">
            <div class="stack-item-head" style="align-items:flex-start;gap:10px;flex-wrap:wrap;">
              <strong>Coach Reply</strong>
              <span style="display:flex;gap:8px;flex-wrap:wrap;">
                ${messageReplyBadge}
                ${messageModeBadge}
              </span>
            </div>
            <p style="margin:8px 0 0;">${escapeHtml(String(message?.text || '').trim() || 'No text saved.')}</p>
          </div>
        `;
      }).join('')
    : `<div class="stack-item"><p class="muted">No recent assistant coach messages saved yet.</p></div>`;

  return `
    <div class="drawer-section">
      <div class="stack-item-head" style="margin-bottom:12px;align-items:flex-start;gap:10px;flex-wrap:wrap;">
        <strong>Coach Debug Inspector</strong>
        <span style="display:flex;gap:8px;flex-wrap:wrap;">
          ${latestReplyBadge}
          ${modeBadge}
        </span>
      </div>

      <div class="application-meta-grid" style="margin-bottom:14px;">
        <div class="application-meta-item">
          <span>Reply Format</span>
          <strong>${escapeHtml(normalizeCoachReplyFormatLabel(latestReplyFormat) || 'General')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Coach Mode</span>
          <strong>${escapeHtml(normalizeCoachReplyFormatLabel(latestCoachModeKey) || 'General')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Style Version</span>
          <strong>${escapeHtml(responseStyleVersion || '—')}</strong>
        </div>
      </div>

      <div class="stack-list" style="margin-bottom:14px;">
        <div class="stack-item">
          <div class="stack-item-head">
            <strong>Latest Saved Reply</strong>
          </div>
          <p style="margin:8px 0 0;">${escapeHtml(latestCoachReply || 'No latest assistant reply text saved yet.')}</p>
        </div>
      </div>

      <div class="stack-list">
        ${recentMessagesHtml}
      </div>
    </div>
  `;
}

function findById(collection, id) {
  return state[collection].find(item => item.id === id);
}

function matchesSearch(record, query) {
  if (!query) return true;
  const haystack = JSON.stringify(record).toLowerCase();
  return haystack.includes(query.toLowerCase());
}
function makeCell(label, content, className = '') {
  return `<td data-label="${escapeHtml(label)}"${className ? ` class="${className}"` : ''}>${content}</td>`;
}

function makeEmptyRow(colspan, text) {
  return `<tr><td colspan="${colspan}" class="muted">${escapeHtml(text)}</td></tr>`;
}

function getApplicationPreviewMarkup(app) {
  const goal = String(app.goal || '').trim() || 'No goal submitted.';
  const background = String(app.background || '').trim() || 'No background submitted.';

  return `
    <div class="app-preview">
      <div class="app-preview-line">
        <span>Goal</span>
        <p>${escapeHtml(goal)}</p>
      </div>
      <div class="app-preview-line">
        <span>Background</span>
        <p>${escapeHtml(background)}</p>
      </div>
    </div>
  `;
}

function setView(view) {
  state.ui.currentView = view;
  saveState();

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  document.querySelectorAll('.view').forEach(section => {
    const isActive = section.id === `view-${view}`;
    section.classList.toggle('active', isActive);
    section.toggleAttribute('data-app-active', isActive);
  });

  const desktopNavItem = document.querySelector(`.sidebar .nav-item[data-view="${view}"]`);
  const mobileNavItem = document.querySelector(`.app-bottom-nav .nav-item[data-view="${view}"]`);
  const mobileSheetNavItem = document.querySelector(`.admin-mobile-more-sheet .nav-item[data-view="${view}"]`);

  const desktopLabel =
    desktopNavItem?.dataset?.label ||
    desktopNavItem?.querySelector('.admin-nav-title')?.textContent?.trim() ||
    mobileNavItem?.dataset?.label ||
    mobileNavItem?.querySelector('.app-nav-label')?.textContent?.trim() ||
    mobileSheetNavItem?.dataset?.label ||
    mobileSheetNavItem?.querySelector('.admin-nav-title')?.textContent?.trim() ||
    'Overview';

  const title = document.getElementById('page-title');
  if (title) title.textContent = desktopLabel;

  const appTitle = document.getElementById('app-page-title');
  if (appTitle) appTitle.textContent = desktopLabel;

  document.body.dataset.currentView = view;

  const primaryMobileViews = new Set(['overview', 'applications', 'members', 'economy']);
  const mobileMoreToggle = document.getElementById('admin-mobile-more-toggle');
  if (mobileMoreToggle) {
    mobileMoreToggle.classList.toggle('active', !primaryMobileViews.has(view));
  }

  if (typeof closeAdminMobileMoreMenu === 'function') {
    closeAdminMobileMoreMenu();
  }

  if (window.innerWidth <= 980) {
    closeDrawer();
    requestAnimationFrame(() => {
      const mainPanel = document.querySelector('.main-panel');
      if (mainPanel) mainPanel.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}
function getAdminMobileMoreMenuParts() {
  return {
    toggle: document.getElementById('admin-mobile-more-toggle'),
    sheet: document.getElementById('admin-mobile-more-sheet'),
    backdrop: document.getElementById('admin-mobile-more-backdrop'),
    closeBtn: document.getElementById('admin-mobile-more-close')
  };
}

function openAdminMobileMoreMenu() {
  const { toggle, sheet, backdrop } = getAdminMobileMoreMenuParts();

  if (!sheet || !backdrop) return;

  sheet.hidden = false;
  backdrop.hidden = false;
  sheet.setAttribute('aria-hidden', 'false');

  if (toggle) {
    toggle.setAttribute('aria-expanded', 'true');
  }
}

function closeAdminMobileMoreMenu() {
  const { toggle, sheet, backdrop } = getAdminMobileMoreMenuParts();

  if (sheet) {
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
  }

  if (backdrop) {
    backdrop.hidden = true;
  }

  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
  }
}

function toggleAdminMobileMoreMenu() {
  const { sheet } = getAdminMobileMoreMenuParts();

  if (!sheet || sheet.hidden) {
    openAdminMobileMoreMenu();
    return;
  }

  closeAdminMobileMoreMenu();
}
function ensureAnalyticsLayout() {
  const analyticsView = document.getElementById('view-analytics');
  if (!analyticsView) return;

  analyticsView.innerHTML = `
    <div class="stats-grid analytics-top-stats" id="analytics-stats"></div>

    <div class="content-grid analytics-grid-main">
      <article class="panel-card analytics-hero-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Overall Performance</p>
            <h3>YH Growth & Revenue Trend</h3>
          </div>
          <div class="analytics-mini-meta" id="analytics-hero-meta"></div>
        </div>
        <div id="analytics-hero-chart" class="line-chart-card"></div>
      </article>

      <article class="panel-card analytics-side-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Goal Tracking</p>
            <h3>Target Progress</h3>
          </div>
        </div>
        <div id="analytics-target-progress" class="stack-list"></div>
      </article>
    </div>

    <div class="content-grid analytics-grid-secondary">
      <article class="panel-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Division Growth</p>
            <h3>Member Distribution</h3>
          </div>
        </div>
        <div id="analytics-division-bars" class="bars-list"></div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Geographic Reach</p>
            <h3>YH Expansion Map</h3>
          </div>
        </div>
        <div id="analytics-regions" class="bars-list"></div>
      </article>
    </div>

    <div class="content-grid analytics-grid-secondary">
      <article class="panel-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Revenue Breakdown</p>
            <h3>Division Revenue Mix</h3>
          </div>
        </div>
        <div id="analytics-revenue-mix" class="bars-list"></div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Operational Ratios</p>
            <h3>Conversion, Activity & User Count</h3>
          </div>
        </div>
        <div id="analytics-ratios" class="stack-list"></div>
      </article>
    </div>
  `;
}

function createLineChartSVG(seriesA, seriesB) {
  const width = 920;
  const height = 270;
  const padding = { top: 24, right: 24, bottom: 40, left: 28 };

  const maxValue = Math.max(
    ...seriesA.map(item => item.revenue),
    ...seriesB.map(item => item.members * 55),
    1
  );

  const xForIndex = (index, total) =>
    padding.left + ((width - padding.left - padding.right) * index) / Math.max(1, total - 1);

  const yForValue = value =>
    height - padding.bottom - ((height - padding.top - padding.bottom) * value) / maxValue;

  const revenuePoints = seriesA
    .map((item, index) => `${xForIndex(index, seriesA.length)},${yForValue(item.revenue)}`)
    .join(' ');

  const memberPoints = seriesB
    .map((item, index) => `${xForIndex(index, seriesB.length)},${yForValue(item.members * 55)}`)
    .join(' ');

  const revenueArea = `${padding.left},${height - padding.bottom} ${revenuePoints} ${xForIndex(seriesA.length - 1, seriesA.length)},${height - padding.bottom}`;
  const memberArea = `${padding.left},${height - padding.bottom} ${memberPoints} ${xForIndex(seriesB.length - 1, seriesB.length)},${height - padding.bottom}`;

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(77,139,255,.42)" />
            <stop offset="100%" stop-color="rgba(77,139,255,0)" />
          </linearGradient>
          <linearGradient id="mem-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(34,211,238,.26)" />
            <stop offset="100%" stop-color="rgba(34,211,238,0)" />
          </linearGradient>
        </defs>

        <polygon points="${revenueArea}" fill="url(#rev-fill)"></polygon>
        <polygon points="${memberArea}" fill="url(#mem-fill)"></polygon>

        <polyline points="${memberPoints}" fill="none" stroke="#22d3ee" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
        <polyline points="${revenuePoints}" fill="none" stroke="#4d8bff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>

        ${seriesA.map((item, index) => `
          <circle cx="${xForIndex(index, seriesA.length)}" cy="${yForValue(item.revenue)}" r="4.5" fill="#4d8bff"></circle>
        `).join('')}

        ${seriesB.map((item, index) => `
          <circle cx="${xForIndex(index, seriesB.length)}" cy="${yForValue(item.members * 55)}" r="3.2" fill="#22d3ee"></circle>
        `).join('')}
      </svg>
    </div>

    <div class="chart-axis-labels">
      ${seriesA.map(item => `<span>${escapeHtml(item.month)}</span>`).join('')}
    </div>

    <div class="chart-legend">
      <span class="chart-legend-item">
        <i class="chart-legend-swatch" style="background:#4d8bff"></i>
        Revenue Trend
      </span>
      <span class="chart-legend-item">
        <i class="chart-legend-swatch" style="background:#22d3ee"></i>
        Growth Index
      </span>
    </div>
  `;
}

function getAnalyticsMembershipMetrics() {
  const uniqueUsers = state.members.length;

  const divisionCounts = {
    Academy: state.members.filter(member => member.divisions.includes('Academy')).length,
    Federation: state.members.filter(member => member.divisions.includes('Federation')).length,
    Plazas: state.members.filter(member => member.divisions.includes('Plazas')).length
  };

  const totalMemberships = state.members.reduce((sum, member) => {
    return sum + new Set(member.divisions || []).size;
  }, 0);

  const overlapUsers = state.members.filter(member => new Set(member.divisions || []).size > 1).length;
  const singleDivisionUsers = Math.max(0, uniqueUsers - overlapUsers);
  const avgMembershipsPerUser = uniqueUsers ? (totalMemberships / uniqueUsers) : 0;
  const overlapRate = uniqueUsers ? Math.round((overlapUsers / uniqueUsers) * 100) : 0;
  const singleDivisionRate = uniqueUsers ? Math.round((singleDivisionUsers / uniqueUsers) * 100) : 0;

  const overlapMatrix = {
    academyOnly: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return d.has('Academy') && !d.has('Federation') && !d.has('Plazas');
    }).length,
    federationOnly: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return !d.has('Academy') && d.has('Federation') && !d.has('Plazas');
    }).length,
    plazasOnly: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return !d.has('Academy') && !d.has('Federation') && d.has('Plazas');
    }).length,
    academyFederation: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return d.has('Academy') && d.has('Federation') && !d.has('Plazas');
    }).length,
    academyPlazas: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return d.has('Academy') && !d.has('Federation') && d.has('Plazas');
    }).length,
    federationPlazas: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return !d.has('Academy') && d.has('Federation') && d.has('Plazas');
    }).length,
    allThree: state.members.filter(member => {
      const d = new Set(member.divisions || []);
      return d.has('Academy') && d.has('Federation') && d.has('Plazas');
    }).length
  };

  const analytics = state.analytics || defaultState().analytics;
  const rawMonthly = Array.isArray(analytics.monthly) && analytics.monthly.length
    ? analytics.monthly
    : [{ month: 'Now', members: uniqueUsers }];

  const lastRawMembers = rawMonthly[rawMonthly.length - 1]?.members || uniqueUsers || 1;
  const scale = uniqueUsers > 0 ? (uniqueUsers / Math.max(1, lastRawMembers)) : 1;

  const monthlyTrend = rawMonthly.map(item => {
    const scaledUnique = Math.max(0, Math.round((item.members || 0) * scale));
    const scaledMemberships = Math.max(scaledUnique, Math.round(scaledUnique * Math.max(1, avgMembershipsPerUser)));
    return {
      month: item.month,
      uniqueUsers: scaledUnique,
      memberships: scaledMemberships
    };
  });

  if (monthlyTrend.length) {
    monthlyTrend[monthlyTrend.length - 1].uniqueUsers = uniqueUsers;
    monthlyTrend[monthlyTrend.length - 1].memberships = totalMemberships;
  }

  const monthlyGrowth = monthlyTrend.map((item, index) => {
    const prev = monthlyTrend[index - 1];
    return {
      ...item,
      newUsers: index === 0 ? item.uniqueUsers : item.uniqueUsers - prev.uniqueUsers,
      newMemberships: index === 0 ? item.memberships : item.memberships - prev.memberships
    };
  });

  return {
    uniqueUsers,
    totalMemberships,
    divisionCounts,
    overlapUsers,
    singleDivisionUsers,
    avgMembershipsPerUser,
    overlapRate,
    singleDivisionRate,
    overlapMatrix,
    monthlyGrowth
  };
}
function renderOverview() {
  const overviewStatsEl = document.getElementById('overview-stats');
  const priorityActionsEl = document.getElementById('priority-actions');
  const systemAlertsEl = document.getElementById('system-alerts');
  const overviewApplicationsTableEl = document.getElementById('overview-applications-table');
  const divisionSnapshotEl = document.getElementById('division-snapshot');

  const totalMembers = state.members.length;
  const pendingApplications = state.applications.filter(a =>
    ['New', 'Under Review', 'Needs More Info'].includes(a.status)
  ).length;
  const academyActive = state.academy.filter(a => a.status === 'On Track').length;
  const flaggedListings = state.plazas.filter(l => l.status === 'Flagged').length;

  if (overviewStatsEl) {
    overviewStatsEl.innerHTML = [
      {
        label: 'Total Members',
        value: totalMembers,
        foot: `${state.members.filter(m => m.status === 'Active').length} active now`
      },
      {
        label: 'Pending Applications',
        value: pendingApplications,
        foot: 'Needs intake action'
      },
      {
        label: 'Academy On Track',
        value: academyActive,
        foot: `${state.academy.length} roadmap records`
      },
      {
        label: 'Flagged Listings',
        value: flaggedListings,
        foot: `${state.support.filter(t => t.type === 'Dispute').length} related tickets`
      }
    ].map(card => `
      <article class="stat-card">
        <div class="stat-label">${escapeHtml(card.label)}</div>
        <div class="stat-value">${escapeHtml(card.value)}</div>
        <div class="stat-foot">${escapeHtml(card.foot)}</div>
      </article>
    `).join('');
  }

  if (priorityActionsEl) {
    const openSupportTickets = state.support.filter(t => t.status === 'Open').length;
    const academyInterventions = state.academy.filter(a => a.status !== 'On Track').length;
    const economyMetrics = getAdminEconomyMetrics();
    const pendingFederationRequests = state.federationConnectionRequests.filter((request) => {
      const status = String(request.status || '').trim().toLowerCase();
      const paymentStatus = String(request.paymentStatus || '').trim().toLowerCase();

      return (
        ['pending_admin_match', 'pending_review', 'matched', 'pricing_sent'].includes(status) ||
        ['not_started', 'pending', 'checkout_started'].includes(paymentStatus)
      );
    }).length;

    const quickActions = [
      {
        icon: '☰',
        title: 'Review Applications',
        copy: `${pendingApplications} application(s) need intake action.`,
        meta: 'Open Applications',
        view: 'applications',
        badge: 'High'
      },
      {
        icon: '♛',
        title: 'Match Federation Requests',
        copy: `${pendingFederationRequests} Federation request(s) may need matching, pricing, or payment review.`,
        meta: 'Open Federation',
        view: 'federation',
        badge: 'High'
      },
      {
        icon: '🧠',
        title: 'Check Academy Leads',
        copy: `${academyInterventions} Academy record(s) need intervention or review.`,
        meta: 'Open Academy',
        view: 'academy',
        badge: 'Medium'
      },
      {
        icon: '₿',
        title: 'Check Payments & Payouts',
        copy: `${economyMetrics.pendingPaymentCount} pending payment(s), ${economyMetrics.pendingPayoutCount} pending payout(s).`,
        meta: 'Open Economy',
        view: 'economy',
        badge: 'High'
      },
      {
        icon: '◇',
        title: 'Review Plaza Listings',
        copy: `${flaggedListings} Plaza listing(s) need moderation.`,
        meta: 'Open Plaza',
        view: 'plazas',
        badge: flaggedListings ? 'Medium' : 'Low'
      },
      {
        icon: '?',
        title: 'Open Support Tickets',
        copy: `${openSupportTickets} support ticket(s) still open.`,
        meta: 'Open Support',
        view: 'support',
        badge: openSupportTickets ? 'Medium' : 'Low'
      }
    ];

    priorityActionsEl.innerHTML = `
      <div class="quick-action-grid">
        ${quickActions.map((action) => `
          <button type="button" class="quick-action-card" data-admin-jump-view="${escapeHtml(action.view)}">
            <div class="quick-action-top">
              <span class="quick-action-icon">${escapeHtml(action.icon)}</span>
              ${formatBadge(action.badge)}
            </div>
            <div class="quick-action-title">${escapeHtml(action.title)}</div>
            <p class="quick-action-copy">${escapeHtml(action.copy)}</p>
            <span class="quick-action-meta">${escapeHtml(action.meta)} →</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  if (systemAlertsEl) {
    const alerts = [
      state.settings.maintenanceMode
        ? 'Maintenance mode is enabled.'
        : 'System stable. No maintenance mode active.',
      state.settings.requirePlazaListingReview
        ? 'Plazas manual listing review is ON.'
        : 'Plazas listings are auto-publishing.',
      state.settings.requireFederationManualReview
        ? 'Federation manual review is enforced.'
        : 'Federation auto-routing is active.'
    ];

    systemAlertsEl.innerHTML = alerts.map(text => `
      <div class="stack-item">
        <div class="stack-item-head">
          <strong>System Notice</strong>
          ${formatBadge(text.includes('ON') || text.includes('enforced') ? 'Medium' : 'Active')}
        </div>
        <p>${escapeHtml(text)}</p>
      </div>
    `).join('');
  }

  if (overviewApplicationsTableEl) {
    overviewApplicationsTableEl.innerHTML = state.applications
      .slice()
      .sort((a, b) => getFederationApplicationScore(b) - getFederationApplicationScore(a))
      .slice(0, 5)
      .map(app => {
        const appTypeLabel = String(app.applicationType || 'general')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());

        const appSource = String(app.source || 'Unknown').trim() || 'Unknown';

        return `
          <tr>
            ${makeCell('Name', `<strong>${escapeHtml(app.name)}</strong><div class="muted mono">${escapeHtml(app.id)}</div>`)}
            ${makeCell('Email', escapeHtml(app.email || '—'))}
            ${makeCell('Type', formatBadge(appTypeLabel))}
            ${makeCell('Source', escapeHtml(appSource))}
            ${makeCell('Goal / Background', getApplicationPreviewMarkup(app))}
            ${makeCell('Recommended', formatBadge(app.recommendedDivision || 'Academy'))}
            ${makeCell('Status', formatBadge(app.status || 'Under Review'))}
            ${makeCell('Score / Tier', buildApplicationScoreMarkup(app))}
            ${makeCell('Actions', `<button class="badge-btn" data-open="application" data-id="${app.id}">View Form</button>`)}
          </tr>
        `;
      }).join('') || makeEmptyRow(9, 'No applications yet.');
  }

  if (divisionSnapshotEl) {
    const divisionCounts = {
      Academy: state.members.filter(m => Array.isArray(m.divisions) && m.divisions.includes('Academy')).length,
      Federation: state.members.filter(m => Array.isArray(m.divisions) && m.divisions.includes('Federation')).length,
      Plazas: state.members.filter(m => Array.isArray(m.divisions) && m.divisions.includes('Plazas')).length
    };

    divisionSnapshotEl.innerHTML = Object.entries(divisionCounts).map(([name, count]) => `
      <div class="snapshot-item">
        <div class="snapshot-item-head">
          <strong>${escapeHtml(name)}</strong>
          ${formatBadge(name)}
        </div>
        <p>${escapeHtml(count)} linked members</p>
      </div>
    `).join('');
  }
}
function renderApplications() {
  const statusFilter = document.getElementById('applications-status-filter').value;
  const divisionFilter = document.getElementById('applications-division-filter').value;
  const query = state.ui.globalSearch;

  const rows = state.applications.filter(app => {
    return (statusFilter === 'all' || app.status === statusFilter)
      && (divisionFilter === 'all' || app.recommendedDivision === divisionFilter)
      && matchesSearch(app, query);
  });

  document.getElementById('applications-table').innerHTML = rows.map(app => {
    const appTypeLabel = String(app.applicationType || 'general')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const appSource = String(app.source || 'Unknown').trim() || 'Unknown';
    const appStatus = String(app.status || 'Under Review').trim() || 'Under Review';
    const approveAttrs = getApplicationDecisionButtonAttrs(appStatus, 'Approved');
    const rejectAttrs = getApplicationDecisionButtonAttrs(appStatus, 'Rejected');
    const waitlistAttrs = getApplicationDecisionButtonAttrs(appStatus, 'Waitlisted');

    return `
      <tr>
        ${makeCell('Name', `<strong>${escapeHtml(app.name)}</strong><div class="muted mono">${escapeHtml(app.id)}</div>`)}
        ${makeCell('Email', escapeHtml(app.email || '—'))}
        ${makeCell('Type', formatBadge(appTypeLabel))}
        ${makeCell('Source', escapeHtml(appSource))}
        ${makeCell('Goal / Background', getApplicationPreviewMarkup(app))}
        ${makeCell('Recommended', formatBadge(app.recommendedDivision))}
        ${makeCell('Status', formatBadge(appStatus))}
        ${makeCell('AI Score', `${Number(app.aiScore || 0)}`)}
        ${makeCell('Actions', `
          <div class="table-actions">
            <button data-open="application" data-id="${app.id}">View Form</button>
            <button data-action="approve-application" data-id="${app.id}"${approveAttrs}>Approve</button>
            <button data-action="reject-application" data-id="${app.id}"${rejectAttrs}>Reject</button>
            <button data-action="waitlist-application" data-id="${app.id}"${waitlistAttrs}>Waitlist</button>
          </div>
        `)}
      </tr>
    `;
  }).join('') || makeEmptyRow(9, 'No applications match the current filters.');
}

function renderMembers() {
  const divisionFilter = document.getElementById('members-division-filter').value;
  const statusFilter = document.getElementById('members-status-filter').value;
  const query = state.ui.globalSearch;

  const rows = state.members.filter(member => {
    return (divisionFilter === 'all' || member.divisions.includes(divisionFilter))
      && (statusFilter === 'all' || member.status === statusFilter)
      && matchesSearch(member, query);
  });

    document.getElementById('members-table').innerHTML = rows.map(member => `
    <tr>
      ${makeCell('Member', `<strong>${escapeHtml(member.name)}</strong><div class="muted mono">${escapeHtml(member.username)}</div>`)}
      ${makeCell('Divisions', member.divisions.map(formatBadge).join(' '))}
      ${makeCell('Status', formatBadge(member.status))}
      ${makeCell('Activity', `${member.activityScore}`)}
      ${makeCell('Roadmap', escapeHtml(member.roadmapStatus))}
      ${makeCell('Last Login', escapeHtml(member.lastLogin))}
      ${makeCell('Actions', `
        <div class="table-actions">
          <button data-open="member" data-id="${member.id}">Open</button>
          <button data-action="toggle-member-status" data-id="${member.id}">${member.status === 'Suspended' ? 'Activate' : 'Suspend'}</button>
        </div>
      `)}
    </tr>
  `).join('') || makeEmptyRow(7, 'No members match the current filters.');
}

function renderAcademy() {
  const focusFilter = document.getElementById('academy-focus-filter').value;
  const reviewFilter = document.getElementById('academy-review-filter').value;
  const leadStageFilter = document.getElementById('academy-lead-stage-filter')?.value || 'all';
  const leadScopeFilter = document.getElementById('academy-lead-scope-filter')?.value || 'all';
  const leadReviewFilter = document.getElementById('academy-lead-review-filter')?.value || 'all';
  const query = state.ui.globalSearch;

  const getLeadReviewQueueStatus = (item = {}) => {
    const raw = String(
      item.reviewStatus ||
      item.assignmentStatus ||
      item.taskStatus ||
      item.pipelineStage ||
      ''
    ).trim().toLowerCase();

    if (raw === 'pending_review') return 'submitted';
    if (raw === 'submitted') return 'submitted';
    if (raw === 'revision' || raw === 'needs_revision') return 'revision_requested';
    if (raw === 'revision_requested') return 'revision_requested';
    if (raw === 'approved') return 'approved';
    if (raw === 'completed') return 'completed';
    if (raw === 'rejected') return 'rejected';
    if (raw === 'assigned') return 'assigned';

    return raw || 'assigned';
  };

  const getLeadReviewQueueLabel = (item = {}) => {
    const status = getLeadReviewQueueStatus(item);

    if (status === 'submitted') return 'Submitted';
    if (status === 'revision_requested') return 'Revision Requested';
    if (status === 'approved') return 'Approved';
    if (status === 'completed') return 'Completed';
    if (status === 'rejected') return 'Rejected';
    if (status === 'assigned') return 'Assigned';

    return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const roadmapRows = state.academy.filter(item => {
    return (focusFilter === 'all' || item.focus === focusFilter)
      && (reviewFilter === 'all' || item.status === reviewFilter)
      && matchesSearch(item, query);
  });

  const leadRows = state.academyLeadMissions.filter((item) => {
    const scopes = Array.isArray(item.accessScopes) ? item.accessScopes : [];
    const reviewStatus = getLeadReviewQueueStatus(item);

    return (leadStageFilter === 'all' || item.pipelineStage === leadStageFilter)
      && (leadScopeFilter === 'all' || scopes.includes(leadScopeFilter))
      && (leadReviewFilter === 'all' || reviewStatus === leadReviewFilter)
      && matchesSearch(item, query);
  });

  const stats = [
    { label: 'Roadmap Records', value: state.academy.length, foot: 'Tracked in current system' },
    { label: 'Needs Review', value: state.academy.filter(a => a.status === 'Needs Review').length, foot: 'Records missing a live roadmap' },
    { label: 'At Risk', value: state.academy.filter(a => a.status === 'At Risk').length, foot: 'Low momentum members' },
    { label: 'Lead Records', value: state.academyLeadMissions.length, foot: 'Academy-origin network records' },
    { label: 'Submitted Missions', value: state.academyLeadMissions.filter(item => getLeadReviewQueueStatus(item) === 'submitted').length, foot: 'Waiting for admin review' },
    { label: 'Approved Missions', value: state.academyLeadMissions.filter(item => getLeadReviewQueueStatus(item) === 'approved' || getLeadReviewQueueStatus(item) === 'completed').length, foot: 'Reviewed and accepted' },
    { label: 'Federation Ready', value: state.academyLeadMissions.filter(item => item.federationReady === true).length, foot: 'Cross-division strategic routing' },
    { label: 'Plaza Ready', value: state.academyLeadMissions.filter(item => item.plazaReady === true).length, foot: 'Marketplace-ready relationships' }
  ];

  document.getElementById('academy-stats').innerHTML = stats.map(card => `
    <article class="stat-card">
      <div class="stat-label">${escapeHtml(card.label)}</div>
      <div class="stat-value">${escapeHtml(card.value)}</div>
      <div class="stat-foot">${escapeHtml(card.foot)}</div>
    </article>
  `).join('');

  document.getElementById('academy-table').innerHTML = roadmapRows.map(item => {
    const coachReplyBadge = formatCoachReplyBadge(
      item.latestReplyFormat ||
      item.replyFormat ||
      item.coachReplyFormat ||
      item.lastCoachReplyFormat ||
      ''
    );

    return `
    <tr>
      ${makeCell('Member', `<strong>${escapeHtml(item.memberName)}</strong><div class="muted mono">${escapeHtml(item.id)}</div>`)}
      ${makeCell('Current Phase', `
        <strong>${escapeHtml(item.phase)}</strong>
        ${coachReplyBadge ? `<div style="margin-top:8px;">${coachReplyBadge}</div>` : ''}
      `)}
      ${makeCell('Focus', formatBadge(item.focus))}
      ${makeCell('Completion', `
        <strong>${item.completion}%</strong>
        <div class="progress"><i style="width:${item.completion}%"></i></div>
      `)}
      ${makeCell('Last Check-In', escapeHtml(item.lastCheckIn))}
      ${makeCell('Status', formatBadge(item.status))}
      ${makeCell('Actions', `
        <div class="table-actions">
          <button data-open="academy" data-id="${item.id}">Open</button>
          <button data-action="academy-nudge" data-id="${item.memberId}">Nudge</button>
          <button data-action="academy-track" data-id="${item.memberId}">Mark On Track</button>
        </div>
      `)}
    </tr>
  `;
  }).join('') || makeEmptyRow(7, 'No Academy records match the current filters.');

  const leadTable = document.getElementById('academy-lead-missions-table');
  if (!leadTable) return;

  leadTable.innerHTML = leadRows.map((item) => {
    const scopeBadges = (Array.isArray(item.accessScopes) ? item.accessScopes : [])
      .map((scope) => formatBadge(
        String(scope || '')
          .trim()
          .replace(/\b\w/g, (char) => char.toUpperCase())
      ))
      .join(' ');

    return `
      <tr>
        ${makeCell('Operator', `<strong>${escapeHtml(item.memberName || item.operatorName || 'Operator')}</strong><div class="muted mono">${escapeHtml(item.ownerUid || item.memberId || item.id)}</div>`)}
        ${makeCell('Company / Contact', `
          <strong>${escapeHtml(item.companyName || '—')}</strong>
          <div class="muted">${escapeHtml(item.contactName || '—')}${item.contactRole ? ` • ${escapeHtml(item.contactRole)}` : ''}</div>
        `)}
        ${makeCell('Stage', escapeHtml(item.pipelineStage || '—'))}
        ${makeCell('Review', formatBadge(getLeadReviewQueueLabel(item)))}
        ${makeCell('Network Scope', scopeBadges || '—')}
        ${makeCell('Follow-up', escapeHtml(item.followUpDueDate || '—'))}
        ${makeCell('Strategic Value', formatBadge(
          String(item.strategicValue || 'standard')
            .trim()
            .replace(/\b\w/g, (char) => char.toUpperCase())
        ))}
        ${makeCell('Actions', `
          <div class="table-actions">
              <button data-open="academyLeadMission" data-id="${item.id}">Open</button>
              ${String(item.assignmentStatus || item.taskStatus || item.pipelineStage || '').toLowerCase() === 'submitted' ? `
                <button data-action="lead-review-approve" data-id="${item.id}">Approve</button>
                <button data-action="lead-review-revision" data-id="${item.id}">Revision</button>
                <button data-action="lead-review-reject" data-id="${item.id}">Reject</button>
              ` : ''}
            <button data-action="lead-federation-ready" data-id="${item.id}">
              ${item.federationReady ? 'Unmark Federation' : 'Federation Ready'}
            </button>
            <button data-action="lead-plaza-ready" data-id="${item.id}">
              ${item.plazaReady ? 'Unmark Plaza' : 'Plaza Ready'}
            </button>
            <button data-action="lead-set-strategic-value" data-id="${item.id}">Set Value</button>
          </div>
        `)}
      </tr>
    `;
  }).join('') || makeEmptyRow(8, 'No Lead Missions records match the current filters.');
}
function normalizeAdminMatchText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getFederationRequestTarget(record = {}) {
  const requested = record.requestedContact && typeof record.requestedContact === 'object'
    ? record.requestedContact
    : {};

  return {
    companyName: normalizeAdminMatchText(requested.companyName || record.companyName),
    companyWebsite: normalizeAdminMatchText(requested.companyWebsite || record.companyWebsite),
    contactName: normalizeAdminMatchText(requested.contactName || record.contactName),
    contactRole: normalizeAdminMatchText(requested.contactRole || record.contactRole),
    contactType: normalizeAdminMatchText(requested.contactType || record.category),
    city: normalizeAdminMatchText(requested.city || record.city),
    country: normalizeAdminMatchText(requested.country || record.country),
    sourceMethod: normalizeAdminMatchText(requested.sourceMethod || record.sourceMethod),
    channel: normalizeAdminMatchText(requested.channel || record.channel),
    pipelineStage: normalizeAdminMatchText(requested.pipelineStage || record.pipelineStage),
    priority: normalizeAdminMatchText(requested.priority || record.priority),
    requestedTier: normalizeAdminMatchText(requested.requestedTier || record.tier)
  };
}

function adminFieldMatches(target = '', value = '') {
  const a = normalizeAdminMatchText(target);
  const b = normalizeAdminMatchText(value);

  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function scoreFederationLeadMatch(request = {}, lead = {}) {
  const target = getFederationRequestTarget(request);
  let score = 0;

  if (adminFieldMatches(target.country, lead.country)) score += 30;
  if (adminFieldMatches(target.city, lead.city)) score += 18;
  if (adminFieldMatches(target.contactType, lead.contactType)) score += 24;
  if (adminFieldMatches(target.contactRole, lead.contactRole)) score += 22;
  if (adminFieldMatches(target.companyName, lead.companyName)) score += 14;
  if (adminFieldMatches(target.sourceMethod, lead.sourceMethod)) score += 8;
  if (adminFieldMatches(target.channel, lead.channel)) score += 8;
  if (adminFieldMatches(target.pipelineStage, lead.pipelineStage)) score += 8;
  if (adminFieldMatches(target.priority, lead.priority)) score += 5;
  if (adminFieldMatches(target.requestedTier, lead.tier)) score += 8;

  const leadValue = normalizeAdminMatchText(lead.strategicValue);
  if (leadValue === 'strategic') score += 8;
  if (leadValue === 'high') score += 5;

  if (lead.email) score += 4;
  if (lead.phone) score += 4;

  return score;
}

function getFederationLeadMatchOptions(request = {}) {
  return (state.federationLeadDatabase || [])
    .filter((lead) => lead.federationReady === true)
    .map((lead) => ({
      lead,
      score: scoreFederationLeadMatch(request, lead)
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return String(b.lead.updatedAt || '').localeCompare(String(a.lead.updatedAt || ''));
    });
}

function buildFederationLeadMatchSelect(record = {}) {
  const options = getFederationLeadMatchOptions(record);

  if (!options.length) {
    return `
      <div class="stack-item">
        <p class="muted">No Federation-ready leads available. Mark leads as Federation-ready first.</p>
      </div>
    `;
  }

  return `
    <div class="federation-match-box">
      <label class="federation-match-label" for="federation-match-lead-select-${escapeHtml(record.id)}">
        Choose lead to match
      </label>

      <select id="federation-match-lead-select-${escapeHtml(record.id)}" class="federation-match-select">
        <option value="">Select a lead</option>
        ${options.map(({ lead, score }) => {
          const ownerUid = lead.ownerUid || lead.memberId || '';
          const value = `${ownerUid}::${lead.id}`;
          const label = [
            score ? `Score ${score}` : 'Low match',
            lead.companyName || 'Private organization',
            lead.contactName || 'Protected contact',
            lead.contactRole || '',
            [lead.city, lead.country].filter(Boolean).join(', ')
          ].filter(Boolean).join(' • ');

          return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
        }).join('')}
      </select>

      <div class="federation-match-hint">
        Matches are ranked by country, city, contact type, role, company, source method, channel, stage, priority, tier, and contact availability.
      </div>
    </div>
  `;
}
function getDealPackageFieldId(recordId = '', field = '') {
  return `federation-deal-${field}-${String(recordId || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function buildFederationDealPackageForm(record = {}) {
  const id = record.id || '';

  return `
    <div class="federation-deal-grid">
      <label>
        <span>Intro Price</span>
        <input id="${getDealPackageFieldId(id, 'price')}" type="number" min="0" step="1" value="${escapeHtml(record.pricingAmount || 0)}" />
      </label>

      <label>
        <span>Currency</span>
        <select id="${getDealPackageFieldId(id, 'currency')}">
          ${['USD', 'EUR', 'GBP', 'NGN'].map((currency) => `
            <option value="${currency}"${String(record.currency || 'USD') === currency ? ' selected' : ''}>${currency}</option>
          `).join('')}
        </select>
      </label>

      <label>
        <span>Platform Commission %</span>
        <input id="${getDealPackageFieldId(id, 'commissionRate')}" type="number" min="0" max="100" step="1" value="${escapeHtml(record.platformCommissionRate || 0)}" />
      </label>

      <label>
        <span>Platform Commission Amount</span>
        <input id="${getDealPackageFieldId(id, 'commissionAmount')}" type="number" min="0" step="1" value="${escapeHtml(record.platformCommissionAmount || 0)}" />
      </label>

      <label>
        <span>Operator Payout Estimate</span>
        <input id="${getDealPackageFieldId(id, 'operatorPayout')}" type="number" min="0" step="1" value="${escapeHtml(record.operatorPayoutAmount || 0)}" />
      </label>

      <label>
        <span>Payment Status</span>
        <select id="${getDealPackageFieldId(id, 'paymentStatus')}">
          ${['not_started', 'pricing_sent', 'pending_payment', 'paid', 'refunded', 'cancelled'].map((status) => `
            <option value="${status}"${String(record.paymentStatus || 'not_started') === status ? ' selected' : ''}>${status.replace(/_/g, ' ')}</option>
          `).join('')}
        </select>
      </label>

      <label>
        <span>Payout Status</span>
        <select id="${getDealPackageFieldId(id, 'payoutStatus')}">
          ${['not_started', 'pending', 'approved', 'paid', 'held'].map((status) => `
            <option value="${status}"${String(record.payoutStatus || 'not_started') === status ? ' selected' : ''}>${status.replace(/_/g, ' ')}</option>
          `).join('')}
        </select>
      </label>

      <label>
        <span>Commission Status</span>
        <select id="${getDealPackageFieldId(id, 'commissionStatus')}">
          ${['not_started', 'pending', 'collected', 'waived'].map((status) => `
            <option value="${status}"${String(record.commissionStatus || 'not_started') === status ? ' selected' : ''}>${status.replace(/_/g, ' ')}</option>
          `).join('')}
        </select>
      </label>

      <label class="federation-deal-full">
        <span>Deal Notes</span>
        <textarea id="${getDealPackageFieldId(id, 'notes')}" rows="3">${escapeHtml(record.dealNotes || '')}</textarea>
      </label>
    </div>
  `;
}
function renderFederation() {
  const query = state.ui.globalSearch;
  const valueFilter = document.getElementById('federation-lead-value-filter')?.value || 'all';
  const countryFilter = document.getElementById('federation-lead-country-filter')?.value || 'all';
  const requestStatusFilter = document.getElementById('federation-request-status-filter')?.value || 'all';
  const dealRoomStatusFilter = document.getElementById('federation-deal-room-status-filter')?.value || 'all';

  const leadRows = (state.federationLeadDatabase || []).filter((item) => {
    const value = String(item.strategicValue || 'standard').trim().toLowerCase();
    const country = String(item.country || '').trim();

    return (valueFilter === 'all' || value === valueFilter)
      && (countryFilter === 'all' || country === countryFilter)
      && matchesSearch(item, query);
  });

  const requestRows = (state.federationConnectionRequests || []).filter((item) => {
    const status = String(item.status || '').trim();
    return (requestStatusFilter === 'all' || status === requestStatusFilter)
      && matchesSearch(item, query);
  });

  const dealRoomRows = (state.federationDealRooms || []).filter((item) => {
    const status = String(item.adminStatus || '').trim();
    return (dealRoomStatusFilter === 'all' || status === dealRoomStatusFilter)
      && matchesSearch(item, query);
  });

  const countrySelect = document.getElementById('federation-lead-country-filter');
  if (countrySelect && countrySelect.dataset.hydrated !== 'true') {
    const countries = Array.from(
      new Set((state.federationLeadDatabase || []).map((item) => String(item.country || '').trim()).filter(Boolean))
    ).sort();

    countrySelect.innerHTML = `
      <option value="all">All Countries</option>
      ${countries.map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`).join('')}
    `;
    countrySelect.dataset.hydrated = 'true';
  }

  const economy = getAdminFederationEconomyMetrics();

  const stats = [
    {
      label: 'Federation Leads',
      value: state.federationLeadDatabase.length,
      foot: 'Admin-routed Lead Missions'
    },
    {
      label: 'Strategic Leads',
      value: state.federationLeadDatabase.filter((item) => String(item.strategicValue || '').toLowerCase() === 'strategic').length,
      foot: 'Highest-value contacts'
    },
    {
      label: 'Connection Requests',
      value: state.federationConnectionRequests.length,
      foot: 'Looking-for-contact requests'
    },
    {
      label: 'Deal Rooms',
      value: (state.federationDealRooms || []).length,
      foot: 'Admin-supervised partnerships'
    },
    {
      label: 'Pending Match',
      value: state.federationConnectionRequests.filter((item) => ['pending_admin_match', 'pending_review'].includes(String(item.status || '').toLowerCase())).length,
      foot: 'Needs admin action'
    },
    {
      label: 'Priced Packages',
      value: economy.pricedCount,
      foot: `${economy.mirroredCount} mirrored to Academy earnings`
    },
    {
      label: 'Package Gross',
      value: economy.grossValueLabel,
      foot: `${economy.paidValueLabel} paid / delivered`
    },
    {
      label: 'Platform Commission',
      value: economy.platformCommissionLabel,
      foot: 'Projected YH commission'
    },
    {
      label: 'Operator Payouts',
      value: economy.operatorPayoutLabel,
      foot: 'Projected Academy operator payout'
    }
  ];

  const statsEl = document.getElementById('federation-network-stats');
  if (statsEl) {
    statsEl.innerHTML = stats.map((card) => `
      <article class="stat-card">
        <div class="stat-label">${escapeHtml(card.label)}</div>
        <div class="stat-value">${escapeHtml(card.value)}</div>
        <div class="stat-foot">${escapeHtml(card.foot)}</div>
      </article>
    `).join('');
  }

  const leadTable = document.getElementById('federation-lead-database-table');
  if (leadTable) {
    leadTable.innerHTML = leadRows.map((item) => {
      const contactBits = [
        item.email ? 'Email on file' : '',
        item.phone ? 'Phone on file' : ''
      ].filter(Boolean);

      return `
        <tr>
          ${makeCell('Operator', `<strong>${escapeHtml(item.memberName || item.operatorName || 'Operator')}</strong><div class="muted mono">${escapeHtml(item.ownerUid || item.memberId || '—')}</div>`)}
          ${makeCell('Lead / Contact', `
            <strong>${escapeHtml(item.companyName || 'Private organization')}</strong>
            <div class="muted">${escapeHtml(item.contactName || 'Protected contact')}${item.contactRole ? ` • ${escapeHtml(item.contactRole)}` : ''}</div>
          `)}
          ${makeCell('Location', escapeHtml([item.city, item.country].filter(Boolean).join(', ') || '—'))}
          ${makeCell('Stage', escapeHtml(item.pipelineStage || item.callOutcome || '—'))}
          ${makeCell('Value', formatBadge(
            String(item.strategicValue || 'standard')
              .trim()
              .replace(/\b\w/g, (char) => char.toUpperCase())
          ))}
          ${makeCell('Contact', escapeHtml(contactBits.join(' • ') || 'Intro required'))}
          ${makeCell('Actions', `
            <div class="table-actions">
              <button data-open="federationLead" data-id="${item.id}">Open</button>
              <button data-action="lead-set-strategic-value" data-id="${item.id}">Set Value</button>
              <button data-action="lead-federation-ready" data-id="${item.id}">
                ${item.federationReady ? 'Unmark Federation' : 'Federation Ready'}
              </button>
            </div>
          `)}
        </tr>
      `;
    }).join('') || makeEmptyRow(7, 'No Federation-ready leads match the current filters.');
  }

  const requestsTable = document.getElementById('federation-connection-requests-table');
  if (requestsTable) {
    requestsTable.innerHTML = requestRows.map((item) => `
      <tr>
        ${makeCell('Requester', `<strong>${escapeHtml(item.requesterName || 'Federation Member')}</strong><div class="muted">${escapeHtml(item.requesterEmail || '—')}</div>`)}
        ${makeCell('Looking For', `<strong>${escapeHtml(item.opportunityTitle || 'Connection request')}</strong><div class="muted">${escapeHtml([item.contactRole, item.city, item.country].filter(Boolean).join(' • ') || item.category || '—')}</div>`)}
        ${makeCell('Reason', `<div class="app-preview"><div class="app-preview-line"><p>${escapeHtml(item.requestReason || 'No reason provided.')}</p></div></div>`)}
        ${makeCell('Deal Package', `
          <strong>${escapeHtml(formatAdminMoney(item.pricingAmount || 0, item.currency || 'USD'))}</strong>
          <div class="muted">Commission: ${escapeHtml(formatAdminMoney(item.platformCommissionAmount || 0, item.currency || 'USD'))} • Operator: ${escapeHtml(formatAdminMoney(item.operatorPayoutAmount || 0, item.currency || 'USD'))}</div>
          <div class="muted">Payment: ${escapeHtml(String(item.paymentStatus || 'not_started').replace(/_/g, ' '))} • Payout: ${escapeHtml(String(item.payoutStatus || 'not_started').replace(/_/g, ' '))}</div>
        `)}
        ${makeCell('Status', formatBadge(
          String(item.status || 'pending_admin_match')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase())
        ))}
        ${makeCell('Matched Lead', item.leadId ? `<span class="mono">${escapeHtml(item.ownerUid || '—')} / ${escapeHtml(item.leadId)}</span>` : '—')}
        ${makeCell('Actions', `
          <div class="table-actions">
            <button data-open="federationRequest" data-id="${item.id}">Open</button>
            <button data-action="federation-request-status-matched" data-id="${item.id}">Matched</button>
            <button data-action="federation-request-status-pricing_sent" data-id="${item.id}">Pricing Sent</button>
            <button data-action="federation-request-status-paid" data-id="${item.id}">Paid</button>
            <button data-action="federation-request-status-intro_delivered" data-id="${item.id}">Intro Delivered</button>
            <button data-action="federation-request-status-completed" data-id="${item.id}">Completed</button>
            <button data-action="federation-request-status-rejected" data-id="${item.id}">Reject</button>
          </div>
        `)}
      </tr>
    `).join('') || makeEmptyRow(7, 'No Federation connection requests match the current filters.');
  }

  const dealRoomsTable = document.getElementById('federation-deal-rooms-table');
  if (dealRoomsTable) {
    dealRoomsTable.innerHTML = dealRoomRows.map((item) => `
      <tr>
        ${makeCell('Room', `<strong>${escapeHtml(item.title || 'Federation Deal Room')}</strong><div class="muted mono">${escapeHtml(item.id)}</div>`)}
        ${makeCell('Creator', `<strong>${escapeHtml(item.creatorName || 'Federation Member')}</strong><div class="muted">${escapeHtml(item.creatorEmail || item.creatorUid || '—')}</div>`)}
        ${makeCell('Type', formatBadge(
          String(item.roomType || 'partnership')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase())
        ))}
        ${makeCell('Expected Value', escapeHtml(formatAdminMoney(item.expectedValueAmount || 0, item.currency || 'USD')))}
        ${makeCell('Commission', `
          <strong>${escapeHtml(formatAdminMoney(item.platformCommissionAmount || 0, item.currency || 'USD'))}</strong>
          <div class="muted">${escapeHtml(item.platformCommissionRate || 0)}% • ${escapeHtml(String(item.commissionStatus || 'pending').replace(/_/g, ' '))}</div>
        `)}
        ${makeCell('Status', formatBadge(
          String(item.adminStatus || 'pending_admin_review')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase())
        ))}
        ${makeCell('Academy Link', item.academyMissionNeed ? `<div class="app-preview"><div class="app-preview-line"><p>${escapeHtml(item.academyMissionNeed)}</p></div></div>` : '—')}
        ${makeCell('Actions', `
          <div class="table-actions">
            <button data-open="federationDealRoom" data-id="${item.id}">Open</button>
            <button data-action="federation-deal-room-route-academy" data-id="${item.id}">Route to Academy</button>
            <button data-action="federation-deal-room-status-approved" data-id="${item.id}">Approve</button>
            <button data-action="federation-deal-room-status-in_discussion" data-id="${item.id}">In Discussion</button>
            <button data-action="federation-deal-room-status-commission_due" data-id="${item.id}">Commission Due</button>
            <button data-action="federation-deal-room-status-commission_paid" data-id="${item.id}">Commission Paid</button>
            <button data-action="federation-deal-room-status-closed" data-id="${item.id}">Close</button>
            <button data-action="federation-deal-room-status-rejected" data-id="${item.id}">Reject</button>
          </div>
        `)}
      </tr>
    `).join('') || makeEmptyRow(8, 'No Federation Deal Rooms match the current filters.');
  }
}

function renderPlazas() {
  const typeFilter = document.getElementById('plazas-type-filter').value;
  const statusFilter = document.getElementById('plazas-status-filter').value;
  const query = state.ui.globalSearch;

  const rows = state.plazas.filter(item => {
    return (typeFilter === 'all' || item.type === typeFilter)
      && (statusFilter === 'all' || item.status === statusFilter)
      && matchesSearch(item, query);
  });

    document.getElementById('plazas-table').innerHTML = rows.map(item => `
    <tr>
      ${makeCell('Listing', `<strong>${escapeHtml(item.title)}</strong><div class="muted mono">${escapeHtml(item.id)}</div>`)}
      ${makeCell('Owner', escapeHtml(item.owner))}
      ${makeCell('Type', formatBadge(item.type))}
      ${makeCell('Status', formatBadge(item.status))}
      ${makeCell('Reports', `${item.reports}`)}
      ${makeCell('Region', escapeHtml(item.region))}
      ${makeCell('Actions', `
        <div class="table-actions">
          <button data-open="plazas" data-id="${item.id}">Open</button>
          <button data-action="plazas-route-academy" data-id="${item.id}">Route to Academy</button>
          <button data-action="plazas-approve" data-id="${item.id}">Approve</button>
          <button data-action="plazas-feature" data-id="${item.id}">${item.featured ? 'Unfeature' : 'Feature'}</button>
        </div>
      `)}
    </tr>
  `).join('') || makeEmptyRow(7, 'No Plazas listings match the current filters.');
}

function renderBroadcasts() {
  document.getElementById('broadcast-history').innerHTML = state.broadcasts
    .slice()
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .map(item => `
      <div class="stack-item">
        <div class="stack-item-head">
          <strong>${escapeHtml(item.subject)}</strong>
          ${formatBadge(item.audience)}
        </div>
        <p>${escapeHtml(item.message)}</p>
        <p class="muted">Sent: ${escapeHtml(item.sentAt)}</p>
      </div>
    `).join('');
}

function renderSupport() {
  const statusFilter = document.getElementById('support-status-filter').value;
  const query = state.ui.globalSearch;

  const rows = state.support.filter(item => (statusFilter === 'all' || item.status === statusFilter) && matchesSearch(item, query));

    document.getElementById('support-table').innerHTML = rows.map(item => `
    <tr>
      ${makeCell('Ticket', `<strong>${escapeHtml(item.title)}</strong><div class="muted mono">${escapeHtml(item.id)}</div>`)}
      ${makeCell('Reporter', escapeHtml(item.reporter))}
      ${makeCell('Type', formatBadge(item.type))}
      ${makeCell('Status', formatBadge(item.status))}
      ${makeCell('Priority', formatBadge(item.priority))}
      ${makeCell('Updated', escapeHtml(item.updatedAt))}
      ${makeCell('Actions', `
        <div class="table-actions">
          <button data-open="support" data-id="${item.id}">Open</button>
          <button data-action="support-progress" data-id="${item.id}">Progress</button>
          <button data-action="support-resolve" data-id="${item.id}">Resolve</button>
        </div>
      `)}
    </tr>
  `).join('') || makeEmptyRow(7, 'No support items match the current filters.');
}

function renderEconomy() {
  const query = state.ui.globalSearch;
  const providerFilter = document.getElementById('economy-payment-provider-filter')?.value || 'all';
  const paymentStatusFilter = document.getElementById('economy-payment-status-filter')?.value || 'all';
  const payoutMethodFilter = document.getElementById('economy-payout-method-filter')?.value || 'all';
  const payoutStatusFilter = document.getElementById('economy-payout-status-filter')?.value || 'all';

  const payments = (state.paymentLedger || []).filter((payment) => {
    const provider = String(payment.provider || 'unselected').trim().toLowerCase();
    const status = String(payment.status || 'draft').trim().toLowerCase();

    return (providerFilter === 'all' || provider === providerFilter)
      && (paymentStatusFilter === 'all' || status === paymentStatusFilter)
      && matchesSearch(payment, query);
  });

  const payouts = (state.payoutLedger || []).filter((payout) => {
    const method = String(payout.method || 'local_bank').trim().toLowerCase();
    const status = String(payout.status || 'pending_review').trim().toLowerCase();

    return (payoutMethodFilter === 'all' || method === payoutMethodFilter)
      && (payoutStatusFilter === 'all' || status === payoutStatusFilter)
      && matchesSearch(payout, query);
  });

  const metrics = getAdminEconomyMetrics();

  const statsEl = document.getElementById('economy-control-stats');
  if (statsEl) {
    statsEl.innerHTML = [
      { label: 'Paid Revenue', value: metrics.paidRevenueLabel, foot: `${metrics.paidPaymentCount} paid payments` },
      { label: 'Gross Ledger', value: metrics.grossRevenueLabel, foot: `${metrics.paymentCount} payment records` },
      { label: 'Universe Commission', value: metrics.universeCommissionLabel, foot: 'Confirmed commission from paid payments' },
      { label: 'Operator Payouts', value: metrics.operatorPayoutLabel, foot: 'Total operator payout exposure' },
      { label: 'Pending Payments', value: metrics.pendingPaymentCount, foot: 'Draft / checkout / pending' },
      { label: 'Pending Withdrawals', value: metrics.pendingPayoutCount, foot: 'Needs payout review or execution' }
    ].map((card) => `
      <article class="stat-card">
        <div class="stat-label">${escapeHtml(card.label)}</div>
        <div class="stat-value">${escapeHtml(card.value)}</div>
        <div class="stat-foot">${escapeHtml(card.foot)}</div>
      </article>
    `).join('');
  }

  const paymentTable = document.getElementById('economy-payment-ledger-table');
  if (paymentTable) {
    paymentTable.innerHTML = payments.map((payment) => `
      <tr>
        ${makeCell('Payer', `
          <strong>${escapeHtml(payment.payerName || 'Federation Buyer')}</strong>
          <div class="muted">${escapeHtml(payment.payerEmail || payment.payerUid || '—')}</div>
        `)}
        ${makeCell('Source', `
          <strong>${escapeHtml([payment.sourceDivision, payment.sourceFeature].filter(Boolean).join(' / ') || '—')}</strong>
          <div class="muted mono">${escapeHtml(payment.sourceRecordId || payment.id)}</div>
        `)}
        ${makeCell('Provider', `
          ${formatBadge(formatAdminLedgerStatus(payment.provider || 'unselected'))}
          <div class="muted">${escapeHtml(payment.paymentMethod || 'unselected')}</div>
        `)}
        ${makeCell('Amount', `<strong>${escapeHtml(formatAdminMoney(payment.amount || 0, payment.currency || 'USD'))}</strong>`)}
        ${makeCell('Commission', escapeHtml(formatAdminMoney(payment.platformCommissionAmount || 0, payment.currency || 'USD')))}
        ${makeCell('Operator', escapeHtml(formatAdminMoney(payment.operatorPayoutAmount || 0, payment.currency || 'USD')))}
        ${makeCell('Status', formatBadge(formatAdminLedgerStatus(payment.status || 'draft')))}
        ${makeCell('Updated', escapeHtml(payment.updatedAt || payment.createdAt || '—'))}
      </tr>
    `).join('') || makeEmptyRow(8, 'No payment ledger records match the current filters.');
  }

  const payoutTable = document.getElementById('economy-payout-ledger-table');
  if (payoutTable) {
    payoutTable.innerHTML = payouts.map((payout) => {
      const destination = payout.method === 'crypto'
        ? `${payout.cryptoCurrency || 'Crypto'} ${payout.cryptoNetwork ? `• ${payout.cryptoNetwork}` : ''} ${payout.walletAddressMasked || ''}`
        : payout.method === 'card'
          ? `Card ${payout.cardLast4 ? `•••• ${payout.cardLast4}` : ''}`
          : `${payout.bankName || 'Bank'} ${payout.accountNumberMasked || ''}`;

      return `
        <tr>
          ${makeCell('Receiver', `
            <strong>${escapeHtml(payout.receiverName || 'Operator')}</strong>
            <div class="muted">${escapeHtml(payout.receiverEmail || payout.receiverUid || '—')}</div>
          `)}
          ${makeCell('Method', `
            ${formatBadge(formatAdminLedgerStatus(payout.method || 'local_bank'))}
            <div class="muted">${escapeHtml(payout.provider || 'manual')}</div>
          `)}
          ${makeCell('Amount', `<strong>${escapeHtml(formatAdminMoney(payout.amount || 0, payout.currency || 'USD'))}</strong>`)}
          ${makeCell('Destination', escapeHtml(destination || '—'))}
          ${makeCell('Source', `
            <strong>${escapeHtml([payout.sourceDivision, payout.sourceFeature].filter(Boolean).join(' / ') || '—')}</strong>
            <div class="muted mono">${escapeHtml(payout.sourcePaymentId || payout.sourceRecordId || payout.id)}</div>
          `)}
          ${makeCell('Status', formatBadge(formatAdminLedgerStatus(payout.status || 'pending_review')))}
          ${makeCell('Updated', escapeHtml(payout.updatedAt || payout.createdAt || '—'))}
          ${makeCell('Actions', `
            <div class="table-actions">
              <button data-action="economy-payout-status-approved" data-id="${escapeHtml(payout.id)}">Approve</button>
              <button data-action="economy-payout-status-processing" data-id="${escapeHtml(payout.id)}">Processing</button>
              <button data-action="economy-payout-status-paid" data-id="${escapeHtml(payout.id)}">Paid</button>
              <button data-action="economy-payout-status-rejected" data-id="${escapeHtml(payout.id)}">Reject</button>
            </div>
          `)}
        </tr>
      `;
    }).join('') || makeEmptyRow(8, 'No payout ledger records match the current filters.');
  }
}

function renderAnalytics() {
  const analytics = state.analytics || defaultState().analytics;
  const metrics = getAnalyticsMembershipMetrics();

  const approvedApps = state.applications.filter(a => a.status === 'Approved').length;
  const approvalRate = Math.round((approvedApps / Math.max(1, state.applications.length)) * 100);
  const activeMembers = state.members.filter(m => m.status === 'Active').length;
  const activeRate = Math.round((activeMembers / Math.max(1, state.members.length)) * 100);
  const plazasActive = state.plazas.filter(l => l.status === 'Active').length;

  const monthlySeries = Array.isArray(analytics.monthly) && analytics.monthly.length
    ? analytics.monthly
    : [{ month: 'Now', revenue: 0, members: metrics.uniqueUsers || 0 }];

  const revenueMix = Array.isArray(analytics.revenueMix) ? analytics.revenueMix : [];
  const regions = Array.isArray(analytics.regions) ? analytics.regions : [];

  const latestMonthly = monthlySeries[monthlySeries.length - 1] || { month: 'Now', revenue: 0, members: 0 };
  const prevMonthly = monthlySeries[monthlySeries.length - 2] || latestMonthly;

  const revenueDelta = Number(latestMonthly.revenue || 0) - Number(prevMonthly.revenue || 0);
  const growthDelta = Number(latestMonthly.members || 0) - Number(prevMonthly.members || 0);

  const analyticsStatsEl = document.getElementById('analytics-stats');
  if (analyticsStatsEl) {
    analyticsStatsEl.innerHTML = [
      { label: 'Total Revenue', value: formatCurrency(analytics.finance?.totalRevenue || 0), foot: 'All-time YH revenue' },
      { label: 'Monthly Revenue', value: formatCurrency(analytics.finance?.monthlyRevenue || 0), foot: `${revenueDelta >= 0 ? '+' : ''}${formatCurrency(revenueDelta)} vs last month` },
      { label: 'Member Reach', value: latestMonthly.members || 0, foot: `${analytics.finance?.countriesReached || 0} countries reached` },
      { label: 'Overall Unique Users', value: metrics.uniqueUsers, foot: 'Deduplicated overall member count' },
      { label: 'Total Memberships', value: metrics.totalMemberships, foot: 'All division memberships combined' },
      { label: 'Overlap Users', value: metrics.overlapUsers, foot: 'Users inside more than one division' },
      { label: 'Approval Rate', value: `${approvalRate}%`, foot: `${approvedApps}/${state.applications.length} approved` },
      { label: 'Active Member Rate', value: `${activeRate}%`, foot: `${activeMembers}/${state.members.length} active` },
      { label: 'Avg Review Days', value: analytics.finance?.averageReviewDays || 0, foot: `${plazasActive} active listings live` }
    ].map(card => `
      <article class="stat-card">
        <div class="stat-label">${escapeHtml(card.label)}</div>
        <div class="stat-value">${escapeHtml(card.value)}</div>
        <div class="stat-foot">${escapeHtml(card.foot)}</div>
      </article>
    `).join('');
  }

  const analyticsHeroMetaEl = document.getElementById('analytics-hero-meta');
  if (analyticsHeroMetaEl) {
    analyticsHeroMetaEl.innerHTML = `
      <span class="analytics-mini-pill">Revenue now ${formatCurrency(latestMonthly.revenue || 0)}</span>
      <span class="analytics-mini-pill">Growth ${growthDelta >= 0 ? '+' : ''}${growthDelta} members</span>
      <span class="analytics-mini-pill">${metrics.uniqueUsers} unique users</span>
      <span class="analytics-mini-pill">${analytics.finance?.countriesReached || 0} countries active</span>
    `;
  }

  const analyticsHeroChartEl = document.getElementById('analytics-hero-chart');
  if (analyticsHeroChartEl) {
    analyticsHeroChartEl.innerHTML = createLineChartSVG(monthlySeries, monthlySeries);
  }

  const targetProgress = [
    {
      title: 'Member goal',
      current: latestMonthly.members || 0,
      goal: analytics.targets?.membersGoal || 0,
      sub: 'How close YH is to the next membership milestone'
    },
    {
      title: 'Federation target',
      current: state.federation.length * 18,
      goal: analytics.targets?.federationGoal || 0,
      sub: 'Strategic network build-out'
    },
    {
      title: 'Monthly revenue target',
      current: analytics.finance?.monthlyRevenue || 0,
      goal: analytics.targets?.monthlyRevenueGoal || 0,
      sub: 'Income progress toward monthly target'
    },
    {
      title: 'Plazas activation goal',
      current: state.plazas.length * 28,
      goal: analytics.targets?.plazasGoal || 0,
      sub: 'Marketplace opportunity coverage'
    }
  ];

  const analyticsTargetProgressEl = document.getElementById('analytics-target-progress');
  if (analyticsTargetProgressEl) {
    analyticsTargetProgressEl.innerHTML = targetProgress.map(item => {
      const pct = item.goal > 0 ? Math.min(100, Math.round((item.current / item.goal) * 100)) : 0;

      return `
        <div class="stack-item">
          <div class="stack-item-head">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${pct}%</span>
          </div>
          <div class="progress"><i style="width:${pct}%"></i></div>
          <p>${escapeHtml(item.sub)}</p>
        </div>
      `;
    }).join('');
  }

  const analyticsDivisionBarsEl = document.getElementById('analytics-division-bars');
  if (analyticsDivisionBarsEl) {
    const divisionBars = [
      { label: 'Academy', value: metrics.divisionCounts?.Academy || 0 },
      { label: 'Federation', value: metrics.divisionCounts?.Federation || 0 },
      { label: 'Plazas', value: metrics.divisionCounts?.Plazas || 0 }
    ];

    const maxDivision = Math.max(...divisionBars.map(item => item.value), 1);

    analyticsDivisionBarsEl.innerHTML = divisionBars.map(item => {
      const pct = Math.round((item.value / maxDivision) * 100);
      return `
        <div class="bar-item">
          <div class="bar-item-head">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${item.value}</span>
          </div>
          <div class="progress"><i style="width:${pct}%"></i></div>
        </div>
      `;
    }).join('');
  }

  const analyticsRegionsEl = document.getElementById('analytics-regions');
  if (analyticsRegionsEl) {
    if (!regions.length) {
      analyticsRegionsEl.innerHTML = `<div class="stack-item"><p class="muted">No regional analytics loaded yet.</p></div>`;
    } else {
      const maxRegionRevenue = Math.max(...regions.map(item => Number(item.revenue || 0)), 1);

      analyticsRegionsEl.innerHTML = regions.map(item => {
        const pct = Math.round((Number(item.revenue || 0) / maxRegionRevenue) * 100);
        return `
          <div class="bar-item">
            <div class="bar-item-head">
              <strong>${escapeHtml(item.name || 'Unknown')}</strong>
              <span>${Number(item.members || 0)} members</span>
            </div>
            <div class="progress"><i style="width:${pct}%"></i></div>
          </div>
        `;
      }).join('');
    }
  }

  const analyticsRevenueMixEl = document.getElementById('analytics-revenue-mix');
  if (analyticsRevenueMixEl) {
    if (!revenueMix.length) {
      analyticsRevenueMixEl.innerHTML = `<div class="stack-item"><p class="muted">No revenue mix loaded yet.</p></div>`;
    } else {
      const maxRevenueMix = Math.max(...revenueMix.map(item => Number(item.revenue || 0)), 1);

      analyticsRevenueMixEl.innerHTML = revenueMix.map(item => {
        const pct = Math.round((Number(item.revenue || 0) / maxRevenueMix) * 100);
        return `
          <div class="bar-item">
            <div class="bar-item-head">
              <strong>${escapeHtml(item.division || 'Unknown')}</strong>
              <span>${formatCurrency(item.revenue || 0)}</span>
            </div>
            <div class="progress"><i style="width:${pct}%"></i></div>
          </div>
        `;
      }).join('');
    }
  }

  const analyticsRatiosEl = document.getElementById('analytics-ratios');
  if (analyticsRatiosEl) {
    analyticsRatiosEl.innerHTML = [
      { label: 'Average memberships per user', value: metrics.avgMembershipsPerUser?.toFixed?.(2) || '0.00' },
      { label: 'Overlap rate', value: `${metrics.overlapRate || 0}%` },
      { label: 'Single-division rate', value: `${metrics.singleDivisionRate || 0}%` }
    ].map(item => `
      <div class="stack-item">
        <div class="stack-item-head">
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.value)}</span>
        </div>
      </div>
    `).join('');
  }
}

function renderSettings() {
document.getElementById('roles-list').innerHTML = state.roles.length
  ? state.roles.map(role => `
      <div class="role-item">
        <div class="stack-item-head">
          <strong>${escapeHtml(role.name)}</strong>
          ${formatBadge('Active')}
        </div>
        <p>${escapeHtml((role.permissions || []).join(' • '))}</p>
      </div>
    `).join('')
  : `<div class="stack-item"><p class="muted">No live roles loaded yet.</p></div>`;

  const labels = {
    allowAutoApproveAcademy: 'Allow Academy auto-approval',
    requireFederationManualReview: 'Require Federation manual review',
    requirePlazaListingReview: 'Require Plazas manual listing review',
    enableAiNudges: 'Enable AI nudges',
    maintenanceMode: 'Maintenance mode'
  };

  document.getElementById('settings-form').innerHTML = Object.entries(state.settings).map(([key, value]) => `
    <div class="toggle-item switch-row">
      <div>
        <strong>${escapeHtml(labels[key])}</strong>
        <p>Toggle this operational rule for the current admin environment.</p>
      </div>
      <label class="switch">
        <input type="checkbox" data-setting="${key}" ${value ? 'checked' : ''} />
        <span></span>
      </label>
    </div>
  `).join('');
}

function getDrawerTemplate(type, record) {
  if (!record) return '<div class="drawer-section"><p class="muted">Record not found.</p></div>';

if (type === 'application') {
  const notes = Array.isArray(record.notes) ? record.notes : [record.notes].filter(Boolean);
  const skills = Array.isArray(record.skills) ? record.skills.filter(Boolean) : [];
  const profile = record.academyProfile && typeof record.academyProfile === 'object'
    ? record.academyProfile
    : null;

  const appTypeLabel = String(record.applicationType || 'general')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const topSkills = Array.isArray(profile?.topSkills)
    ? profile.topSkills.filter(Boolean)
    : skills;

  const cityOfResidence =
    record.cityOfResidence ||
    profile?.cityOfResidence ||
    '';

  const countryOfResidence =
    record.countryOfResidence ||
    profile?.countryOfResidence ||
    record.country ||
    '';

  const countryOfOrigin =
    record.countryOfOrigin ||
    profile?.countryOfOrigin ||
    '';

  const locationCountry =
    record.locationCountry ||
    profile?.locationCountry ||
    [cityOfResidence, countryOfResidence].filter(Boolean).join(', ') ||
    countryOfResidence ||
    record.country ||
    '';

  const referredByUsername = String(record.referredByUsername || profile?.referredByUsername || '').replace(/^@+/, '');
  const hearAboutUs = record.hearAboutUs || profile?.hearAboutUs || '';
  const occupationAtAge = record.occupationAtAge || profile?.occupationAtAge || record.goal || '';
  const seriousness = record.seriousness || profile?.seriousness || '';
  const nonNegotiable = record.nonNegotiable || profile?.nonNegotiable || '';
  const rawSkillsText = profile?.skills || record.background || '';
  const age = record.age || profile?.age || '';
  const currentStatus = String(record.status || 'Under Review').trim() || 'Under Review';
  const approveAttrs = getApplicationDecisionButtonAttrs(currentStatus, 'Approved');
  const rejectAttrs = getApplicationDecisionButtonAttrs(currentStatus, 'Rejected');
  const waitlistAttrs = getApplicationDecisionButtonAttrs(currentStatus, 'Waitlisted');
  const federationProfileMarkup = buildFederationProfileMapMarkup(record);
  const federationTierBadge = isFederationApplicationRecord(record) ? formatFederationTierBadge(record) : '';

  return `
    <div class="drawer-section application-hero">
      <div class="application-hero-top">
        <div class="application-hero-copy">
          <div class="application-kicker">Applicant Intake Reader</div>
          <h4>${escapeHtml(record.name || 'Unnamed Applicant')}</h4>
          <p class="application-subtitle">${escapeHtml(record.email || 'No email provided')}</p>
        </div>

        <div class="application-badge-stack">
          ${formatBadge(record.status || 'Under Review')}
          ${formatBadge(record.recommendedDivision || 'Academy')}
          ${federationTierBadge}
        </div>
      </div>

      <div class="application-meta-grid">
        <div class="application-meta-item">
          <span>Application ID</span>
          <strong>${escapeHtml(record.id || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Type</span>
          <strong>${escapeHtml(appTypeLabel)}</strong>
        </div>
        <div class="application-meta-item">
          <span>Source</span>
          <strong>${escapeHtml(record.source || 'Unknown')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Submitted</span>
          <strong>${escapeHtml(record.submittedAt || 'Unknown')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Score / Tier</span>
          <strong>
            ${escapeHtml(String(getFederationApplicationScore(record)))}
            ${isFederationApplicationRecord(record) ? ` • ${escapeHtml(getFederationTierLabel(record))}` : ''}
          </strong>
        </div>
        <div class="application-meta-item">
          <span>Country of residence</span>
          <strong>${escapeHtml(countryOfResidence || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>City of residence</span>
          <strong>${escapeHtml(cityOfResidence || '—')}</strong>
        </div>
        <div class="application-meta-item">
          <span>Country of origin</span>
          <strong>${escapeHtml(countryOfOrigin || '—')}</strong>
        </div>
      </div>
    </div>

    ${federationProfileMarkup}
    ${buildStrategicReadinessSnapshotMarkup(record)}

    <div class="drawer-section">
      <h4>Identity & Routing</h4>
      <div class="kv-grid application-kv-grid">
        <div class="kv"><span>Name</span><strong>${escapeHtml(record.name || '—')}</strong></div>
        <div class="kv"><span>Username</span><strong>${escapeHtml(record.username || '—')}</strong></div>
        <div class="kv"><span>Email</span><strong>${escapeHtml(record.email || '—')}</strong></div>
        <div class="kv"><span>Age</span><strong>${escapeHtml(age || '—')}</strong></div>
        <div class="kv"><span>Country of residence</span><strong>${escapeHtml(countryOfResidence || '—')}</strong></div>
        <div class="kv"><span>City of residence</span><strong>${escapeHtml(cityOfResidence || '—')}</strong></div>
        <div class="kv"><span>Country of origin</span><strong>${escapeHtml(countryOfOrigin || '—')}</strong></div>
        <div class="kv"><span>Legacy combined location</span><strong>${escapeHtml(locationCountry || '—')}</strong></div>
        <div class="kv"><span>Recommended Division</span>${formatBadge(record.recommendedDivision || 'Academy')}</div>
        <div class="kv"><span>Status</span>${formatBadge(record.status || 'Under Review')}</div>
        <div class="kv"><span>Application Type</span>${formatBadge(appTypeLabel)}</div>
      </div>
    </div>

    <div class="drawer-section">
      <h4>Main Form Answers</h4>
      <div class="answer-stack">
        <div class="answer-card">
          <span class="answer-label">What do you do for a living at this age?</span>
          <p>${escapeHtml(occupationAtAge || '—')}</p>
        </div>
        <div class="answer-card">
          <span class="answer-label">What are you good at? What are your skills?</span>
          <p>${escapeHtml(rawSkillsText || '—')}</p>
        </div>
        <div class="answer-card">
          <span class="answer-label">Top Skills</span>
          <p>${escapeHtml(topSkills.join(', ') || '—')}</p>
        </div>
        <div class="answer-card">
          <span class="answer-label">How serious are you about being accepted?</span>
          <p>${escapeHtml(seriousness || '—')}</p>
        </div>
        <div class="answer-card">
          <span class="answer-label">What is the one trait or standard that makes you a good fit?</span>
          <p>${escapeHtml(nonNegotiable || '—')}</p>
        </div>
      </div>
    </div>

    <div class="drawer-section">
      <h4>Referral & Discovery</h4>
      <div class="answer-stack">
        <div class="answer-card">
          <span class="answer-label">Who referred you?</span>
          <p>${escapeHtml(referredByUsername ? `@${referredByUsername}` : '—')}</p>
        </div>
        <div class="answer-card">
          <span class="answer-label">If no one referred you, how did you hear from us?</span>
          <p>${escapeHtml(hearAboutUs || '—')}</p>
        </div>
      </div>
    </div>

    ${profile ? `
      <div class="drawer-section">
        <h4>Stored Academy Profile</h4>
        <div class="kv-grid application-kv-grid">
          <div class="kv"><span>First Name</span><strong>${escapeHtml(profile.firstName || '—')}</strong></div>
          <div class="kv"><span>Surname</span><strong>${escapeHtml(profile.surname || '—')}</strong></div>
          <div class="kv"><span>Full Name</span><strong>${escapeHtml(profile.fullName || record.name || '—')}</strong></div>
          <div class="kv"><span>Email</span><strong>${escapeHtml(profile.email || record.email || '—')}</strong></div>
          <div class="kv"><span>Age</span><strong>${escapeHtml(profile.age || age || '—')}</strong></div>
          <div class="kv"><span>Country of residence</span><strong>${escapeHtml(profile.countryOfResidence || countryOfResidence || '—')}</strong></div>
          <div class="kv"><span>City of residence</span><strong>${escapeHtml(profile.cityOfResidence || cityOfResidence || '—')}</strong></div>
          <div class="kv"><span>Country of origin</span><strong>${escapeHtml(profile.countryOfOrigin || countryOfOrigin || '—')}</strong></div>
          <div class="kv"><span>Legacy combined location</span><strong>${escapeHtml(profile.locationCountry || locationCountry || '—')}</strong></div>
        </div>
      </div>
    ` : ''}

    <div class="drawer-section">
      <h4>Internal Notes</h4>
      <div class="stack-list application-notes">
        ${notes.length ? notes.map(note => `<div class="stack-item"><p>${escapeHtml(note)}</p></div>`).join('') : '<div class="stack-item"><p>No notes yet.</p></div>'}
      </div>
    </div>

    <div class="drawer-section application-review-bar">
      <div class="application-review-copy">
        <div class="application-kicker">Decision Panel</div>
        <p>Review the full intake above, then take action on this application.</p>
      </div>

      <div class="inline-actions application-inline-actions">
        <button class="badge-btn" data-action="approve-application" data-id="${record.id}"${approveAttrs}>Approve</button>
        <button class="badge-btn" data-action="reject-application" data-id="${record.id}"${rejectAttrs}>Reject</button>
        <button class="badge-btn" data-action="waitlist-application" data-id="${record.id}"${waitlistAttrs}>Waitlist</button>
      </div>
    </div>
  `;
}

  if (type === 'member') {
    return `
      <div class="drawer-section">
        <h4>Member Snapshot</h4>
        <div class="kv-grid">
          <div class="kv"><span>Name</span><strong>${escapeHtml(record.name)}</strong></div>
          <div class="kv"><span>Username</span><strong>${escapeHtml(record.username)}</strong></div>
          <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
          <div class="kv"><span>Risk Flag</span>${formatBadge(record.riskFlag)}</div>
          <div class="kv"><span>Divisions</span><div class="list-chips">${record.divisions.map(formatBadge).join('')}</div></div>
          <div class="kv"><span>Activity Score</span><strong>${record.activityScore}</strong></div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>Operational Notes</h4>
        <p><strong>Roadmap:</strong> ${escapeHtml(record.roadmapStatus)}</p>
        <p><strong>Last Login:</strong> ${escapeHtml(record.lastLogin)}</p>
        <p><strong>Joined:</strong> ${escapeHtml(record.joinedAt)}</p>
        <div class="stack-list">${record.notes.map(note => `<div class="stack-item"><p>${escapeHtml(note)}</p></div>`).join('')}</div>
        <div class="inline-actions">
          <button class="badge-btn" data-action="toggle-member-status" data-id="${record.id}">${record.status === 'Suspended' ? 'Activate' : 'Suspend'}</button>
        </div>
      </div>
    `;
  }

  if (type === 'academy') {
    return `
      <div class="drawer-section">
        <h4>Roadmap Record</h4>
        <div class="kv-grid">
          <div class="kv"><span>Member</span><strong>${escapeHtml(record.memberName)}</strong></div>
          <div class="kv"><span>Focus</span>${formatBadge(record.focus)}</div>
          <div class="kv"><span>Phase</span><strong>${escapeHtml(record.phase)}</strong></div>
          <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
        </div>
        <div class="progress"><i style="width:${record.completion}%"></i></div>
        <p class="muted">Completion: ${record.completion}%</p>
      </div>
      <div class="drawer-section">
        <h4>Action Path</h4>
        <p><strong>Next Action:</strong> ${escapeHtml(record.nextAction)}</p>
        <p><strong>Last Check-In:</strong> ${escapeHtml(record.lastCheckIn)}</p>
        <div class="stack-list">${record.notes.map(note => `<div class="stack-item"><p>${escapeHtml(note)}</p></div>`).join('')}</div>
        <div class="inline-actions">
          <button class="badge-btn" data-action="academy-nudge" data-id="${record.memberId}">Send Nudge</button>
          <button class="badge-btn" data-action="academy-track" data-id="${record.memberId}">Mark On Track</button>
        </div>
      </div>
    `;
  }

  if (type === 'academyLeadMission') {
    const scopeBadges = (Array.isArray(record.accessScopes) ? record.accessScopes : [])
      .map((scope) => formatBadge(
        String(scope || '')
          .trim()
          .replace(/\b\w/g, (char) => char.toUpperCase())
      ))
      .join('');

    const tagBadges = (Array.isArray(record.networkTags) ? record.networkTags : [])
      .map((tag) => formatBadge(
        String(tag || '')
          .trim()
          .replace(/\b\w/g, (char) => char.toUpperCase())
      ))
      .join('');

    const assignmentStatus = String(record.assignmentStatus || record.taskStatus || record.pipelineStage || '').trim().toLowerCase();
    const isSubmittedForReview = assignmentStatus === 'submitted';
    const hasRoutedMissionSignal =
      record.routedFromAdmin === true ||
      String(record.sourceMethod || '').trim().toLowerCase().startsWith('admin_routed_') ||
      String(record.callType || '').trim().toLowerCase() === 'opportunity_mission' ||
      Boolean(String(record.assignmentStatus || '').trim());

    const routedMissionReviewActions = isSubmittedForReview ? `
      <div class="drawer-section">
        <h4>Mission Review Actions</h4>
        <p class="muted">This mission has been submitted by the Academy operator and is waiting for admin review.</p>
        <div class="inline-actions">
          <button class="badge-btn" data-action="lead-review-approve" data-id="${record.id}">Approve Mission</button>
          <button class="badge-btn" data-action="lead-review-revision" data-id="${record.id}">Request Revision</button>
          <button class="badge-btn" data-action="lead-review-reject" data-id="${record.id}">Reject Mission</button>
        </div>
      </div>
    ` : '';

    return `
      <div class="drawer-section">
        <h4>Lead Mission Record</h4>
        <div class="kv-grid">
          <div class="kv"><span>Operator</span><strong>${escapeHtml(record.memberName || record.operatorName || 'Operator')}</strong></div>
          <div class="kv"><span>Owner UID</span><strong>${escapeHtml(record.ownerUid || record.memberId || '—')}</strong></div>
          <div class="kv"><span>Company</span><strong>${escapeHtml(record.companyName || '—')}</strong></div>
          <div class="kv"><span>Contact</span><strong>${escapeHtml(record.contactName || '—')}</strong></div>
          <div class="kv"><span>Role</span><strong>${escapeHtml(record.contactRole || '—')}</strong></div>
          <div class="kv"><span>Pipeline Stage</span><strong>${escapeHtml(record.pipelineStage || '—')}</strong></div>
          <div class="kv"><span>Follow-up</span><strong>${escapeHtml(record.followUpDueDate || '—')}</strong></div>
          <div class="kv"><span>Strategic Value</span><strong>${escapeHtml(record.strategicValue || 'standard')}</strong></div>
          <div class="kv"><span>Payout Count</span><strong>${escapeHtml(record.payoutCount || 0)}</strong></div>
          <div class="kv"><span>Deal Count</span><strong>${escapeHtml(record.dealCount || 0)}</strong></div>
          <div class="kv"><span>Approved Payout Total</span><strong>${escapeHtml(formatCurrency(record.approvedPayoutTotal || 0))}</strong></div>
          <div class="kv"><span>Gross Deal Total</span><strong>${escapeHtml(formatCurrency(record.grossDealTotal || 0))}</strong></div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>Network Routing</h4>
        <p><strong>Source Division:</strong> ${escapeHtml(record.sourceDivision || 'academy')}</p>
        <p><strong>Source Feature:</strong> ${escapeHtml(record.sourceFeature || '—')}</p>
        <p><strong>Source Record:</strong> ${escapeHtml(record.sourceRecordId || record.sourceRecordPath || '—')}</p>
        <p><strong>Access Scopes:</strong> ${scopeBadges || '—'}</p>
        <p><strong>Network Tags:</strong> ${tagBadges || '—'}</p>
        <p><strong>Federation Ready:</strong> ${record.federationReady ? 'Yes' : 'No'}</p>
        <p><strong>Plaza Ready:</strong> ${record.plazaReady ? 'Yes' : 'No'}</p>
      </div>

      ${hasRoutedMissionSignal ? `
        <div class="drawer-section">
          <h4>Routed Academy Assignment</h4>
          <div class="kv-grid">
            <div class="kv"><span>Assignment Status</span><strong>${escapeHtml(record.assignmentStatus || record.taskStatus || record.pipelineStage || 'assigned')}</strong></div>
            <div class="kv"><span>Review Status</span><strong>${escapeHtml(record.reviewStatus || '—')}</strong></div>
            <div class="kv"><span>Mission Type</span><strong>${escapeHtml(record.missionType || record.contactType || 'opportunity_mission')}</strong></div>
            <div class="kv"><span>Routed Source</span><strong>${escapeHtml(record.routedSourceTitle || record.companyName || '—')}</strong></div>
            <div class="kv"><span>Assigned By</span><strong>${escapeHtml(record.assignedByAdmin || 'admin')}</strong></div>
            <div class="kv"><span>Assigned At</span><strong>${escapeHtml(record.assignedAt || '—')}</strong></div>
            <div class="kv"><span>Opportunity Value</span><strong>${escapeHtml(formatAdminMoney(record.opportunityValueAmount || 0, record.currency || 'USD'))}</strong></div>
            <div class="kv"><span>Operator Payout</span><strong>${escapeHtml(formatAdminMoney(record.operatorPayoutAmount || 0, record.currency || 'USD'))}</strong></div>
            <div class="kv"><span>Platform Commission</span><strong>${escapeHtml(formatAdminMoney(record.platformCommissionAmount || 0, record.currency || 'USD'))}</strong></div>
            <div class="kv"><span>Commission Rate</span><strong>${escapeHtml(String(record.platformCommissionRate || 0))}%</strong></div>
          </div>
        </div>

        <div class="drawer-section">
          <h4>Mission Brief</h4>
          <div class="stack-list">
            <div class="stack-item">
              <p>${escapeHtml(record.missionBrief || record.academyMissionNeed || record.nextAction || 'No mission brief saved.')}</p>
            </div>
          </div>
        </div>

        <div class="drawer-section">
          <h4>Submitted Proof</h4>
          <div class="stack-list">
            <div class="stack-item">
              <p>${escapeHtml(record.completionProof || 'No completion proof submitted yet.')}</p>
              ${record.submittedAt ? `<p class="muted">Submitted: ${escapeHtml(record.submittedAt)}</p>` : ''}
              ${record.submittedByName ? `<p class="muted">Submitted by: ${escapeHtml(record.submittedByName)}</p>` : ''}
            </div>
          </div>
        </div>

        <div class="drawer-section">
          <h4>Admin Review Result</h4>
          <div class="stack-list">
            <div class="stack-item">
              <p><strong>Reviewed By:</strong> ${escapeHtml(record.reviewedBy || '—')}</p>
              <p><strong>Reviewed At:</strong> ${escapeHtml(record.reviewedAt || '—')}</p>
              <p><strong>Admin Note:</strong> ${escapeHtml(record.adminReviewNote || 'No admin review note yet.')}</p>
              <p><strong>Earning Status:</strong> ${escapeHtml(record.earningStatus || '—')}</p>
              <p><strong>Earning Ledger:</strong> ${escapeHtml(record.earningLedgerId || '—')}</p>
            </div>
          </div>
        </div>
      ` : ''}
      <div class="drawer-section">
        <h4>Operator Notes</h4>
        <div class="stack-list">
          <div class="stack-item"><p>${escapeHtml(record.notes || 'No notes yet.')}</p></div>
        </div>
      </div>
      ${routedMissionReviewActions}

      <div class="drawer-section">
        <h4>Admin Network Actions</h4>
        <div class="inline-actions">
          <button class="badge-btn" data-action="lead-federation-ready" data-id="${record.id}">
            ${record.federationReady ? 'Remove Federation Ready' : 'Mark Federation Ready'}
          </button>
          <button class="badge-btn" data-action="lead-plaza-ready" data-id="${record.id}">
            ${record.plazaReady ? 'Remove Plaza Ready' : 'Mark Plaza Ready'}
          </button>
          <button class="badge-btn" data-action="lead-set-strategic-value" data-id="${record.id}">
            Set Strategic Value
          </button>
        </div>
      </div>
    `;
  }
  if (type === 'federationLead') {
    const scopeBadges = (Array.isArray(record.accessScopes) ? record.accessScopes : [])
      .map((scope) => formatBadge(
        String(scope || '')
          .trim()
          .replace(/\b\w/g, (char) => char.toUpperCase())
      ))
      .join('');

    return `
      <div class="drawer-section">
        <h4>Federation Lead Record</h4>
        <div class="kv-grid">
          <div class="kv"><span>Operator</span><strong>${escapeHtml(record.memberName || record.operatorName || 'Operator')}</strong></div>
          <div class="kv"><span>Owner UID</span><strong>${escapeHtml(record.ownerUid || record.memberId || '—')}</strong></div>
          <div class="kv"><span>Company</span><strong>${escapeHtml(record.companyName || 'Private organization')}</strong></div>
          <div class="kv"><span>Contact</span><strong>${escapeHtml(record.contactName || 'Protected contact')}</strong></div>
          <div class="kv"><span>Role</span><strong>${escapeHtml(record.contactRole || '—')}</strong></div>
          <div class="kv"><span>Location</span><strong>${escapeHtml([record.city, record.country].filter(Boolean).join(', ') || '—')}</strong></div>
          <div class="kv"><span>Email</span><strong>${escapeHtml(record.email || '—')}</strong></div>
          <div class="kv"><span>Phone</span><strong>${escapeHtml(record.phone || '—')}</strong></div>
          <div class="kv"><span>Pipeline Stage</span><strong>${escapeHtml(record.pipelineStage || '—')}</strong></div>
          <div class="kv"><span>Strategic Value</span><strong>${escapeHtml(record.strategicValue || 'standard')}</strong></div>
          <div class="kv"><span>Access Scopes</span><strong>${scopeBadges || '—'}</strong></div>
          <div class="kv"><span>Federation Ready</span><strong>${record.federationReady ? 'Yes' : 'No'}</strong></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Lead Notes</h4>
        <div class="stack-list">
          <div class="stack-item"><p>${escapeHtml(record.notes || 'No notes saved.')}</p></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Admin Actions</h4>
        <div class="inline-actions">
          <button class="badge-btn" data-action="lead-set-strategic-value" data-id="${record.id}">Set Strategic Value</button>
          <button class="badge-btn" data-action="lead-federation-ready" data-id="${record.id}">
            ${record.federationReady ? 'Remove Federation Ready' : 'Mark Federation Ready'}
          </button>
        </div>
      </div>
    `;
  }

  if (type === 'federationRequest') {
    return `
      <div class="drawer-section">
        <h4>Connection Request</h4>
        <div class="kv-grid">
          <div class="kv"><span>Requester</span><strong>${escapeHtml(record.requesterName || 'Federation Member')}</strong></div>
          <div class="kv"><span>Email</span><strong>${escapeHtml(record.requesterEmail || '—')}</strong></div>
          <div class="kv"><span>Status</span>${formatBadge(String(record.status || 'pending_admin_match').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()))}</div>
          <div class="kv"><span>Budget</span><strong>${escapeHtml(record.budgetRange || 'not_sure')}</strong></div>
          <div class="kv"><span>Urgency</span><strong>${escapeHtml(record.urgency || 'normal')}</strong></div>
          <div class="kv"><span>Intro Type</span><strong>${escapeHtml(record.preferredIntroType || 'admin_brokered')}</strong></div>
          <div class="kv"><span>Owner UID</span><strong>${escapeHtml(record.ownerUid || '—')}</strong></div>
          <div class="kv"><span>Lead ID</span><strong>${escapeHtml(record.leadId || '—')}</strong></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Requested Contact</h4>
        <p><strong>${escapeHtml(record.opportunityTitle || 'Connection request')}</strong></p>
        <p class="muted">${escapeHtml([record.contactRole, record.city, record.country].filter(Boolean).join(' • ') || record.category || 'No extra lead snapshot.')}</p>
      </div>

      <div class="drawer-section">
        <h4>Reason / Intended Use</h4>
        <div class="stack-list">
          <div class="stack-item">
            <strong>Why they need it</strong>
            <p>${escapeHtml(record.requestReason || 'No reason provided.')}</p>
          </div>
          <div class="stack-item">
            <strong>Intended use</strong>
            <p>${escapeHtml(record.intendedUse || 'No intended use provided.')}</p>
          </div>
          <div class="stack-item">
            <strong>Admin notes</strong>
            <p>${escapeHtml(record.notes || 'No notes yet.')}</p>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Match Lead</h4>
        <p class="muted" style="margin-top:0;">
          Pick the best Federation-ready lead from the Academy Lead Missions database.
        </p>

        ${buildFederationLeadMatchSelect(record)}

        <div class="inline-actions" style="margin-top:12px;">
          <button class="badge-btn" data-action="federation-request-match-selected" data-id="${record.id}">
            Match Selected Lead
          </button>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Current Matched Lead</h4>
        <div class="kv-grid">
          <div class="kv"><span>Owner UID</span><strong>${escapeHtml(record.ownerUid || '—')}</strong></div>
          <div class="kv"><span>Lead ID</span><strong>${escapeHtml(record.leadId || '—')}</strong></div>
          <div class="kv"><span>Matched By</span><strong>${escapeHtml(record.matchedBy || '—')}</strong></div>
          <div class="kv"><span>Matched At</span><strong>${escapeHtml(record.matchedAt || '—')}</strong></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Deal Package</h4>
        <p class="muted" style="margin-top:0;">
          Set the intro price, platform commission, operator payout estimate, and payment state.
        </p>

        ${buildFederationDealPackageForm(record)}

        <div class="inline-actions" style="margin-top:12px;">
          <button class="badge-btn" data-action="federation-request-save-deal" data-id="${record.id}">
            Save Deal Package
          </button>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Current Deal Snapshot</h4>
        <div class="kv-grid">
          <div class="kv"><span>Intro Price</span><strong>${escapeHtml(record.currency || 'USD')} ${escapeHtml(record.pricingAmount || 0)}</strong></div>
          <div class="kv"><span>Platform Commission</span><strong>${escapeHtml(record.currency || 'USD')} ${escapeHtml(record.platformCommissionAmount || 0)}</strong></div>
          <div class="kv"><span>Operator Payout</span><strong>${escapeHtml(record.currency || 'USD')} ${escapeHtml(record.operatorPayoutAmount || 0)}</strong></div>
          <div class="kv"><span>Payment Status</span><strong>${escapeHtml(record.paymentStatus || 'not_started')}</strong></div>
          <div class="kv"><span>Commission Status</span><strong>${escapeHtml(record.commissionStatus || 'not_started')}</strong></div>
          <div class="kv"><span>Payout Status</span><strong>${escapeHtml(record.payoutStatus || 'not_started')}</strong></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Admin Request Status</h4>
        <div class="inline-actions">
          <button class="badge-btn" data-action="federation-request-status-matched" data-id="${record.id}">Matched</button>
          <button class="badge-btn" data-action="federation-request-status-pricing_sent" data-id="${record.id}">Pricing Sent</button>
          <button class="badge-btn" data-action="federation-request-status-paid" data-id="${record.id}">Paid</button>
          <button class="badge-btn" data-action="federation-request-status-intro_delivered" data-id="${record.id}">Intro Delivered</button>
          <button class="badge-btn" data-action="federation-request-status-completed" data-id="${record.id}">Completed</button>
          <button class="badge-btn" data-action="federation-request-status-rejected" data-id="${record.id}">Reject</button>
        </div>
      </div>
    `;
  }
    if (type === 'federationDealRoom') {
    return `
      <div class="drawer-section">
        <h4>Federation Deal Room</h4>
        <div class="kv-grid">
          <div class="kv"><span>Title</span><strong>${escapeHtml(record.title || 'Federation Deal Room')}</strong></div>
          <div class="kv"><span>Creator</span><strong>${escapeHtml(record.creatorName || 'Federation Member')}</strong></div>
          <div class="kv"><span>Type</span><strong>${escapeHtml(String(record.roomType || 'partnership').replace(/_/g, ' '))}</strong></div>
          <div class="kv"><span>Expected Value</span><strong>${escapeHtml(formatAdminMoney(record.expectedValueAmount || 0, record.currency || 'USD'))}</strong></div>
          <div class="kv"><span>Commission Rate</span><strong>${escapeHtml(record.platformCommissionRate || 0)}%</strong></div>
          <div class="kv"><span>Commission Amount</span><strong>${escapeHtml(formatAdminMoney(record.platformCommissionAmount || 0, record.currency || 'USD'))}</strong></div>
          <div class="kv"><span>Admin Status</span><strong>${escapeHtml(String(record.adminStatus || 'pending_admin_review').replace(/_/g, ' '))}</strong></div>
          <div class="kv"><span>Commission Status</span><strong>${escapeHtml(String(record.commissionStatus || 'pending').replace(/_/g, ' '))}</strong></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Deal Description</h4>
        <div class="stack-list">
          <div class="stack-item"><p>${escapeHtml(record.description || 'No description saved.')}</p></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Partner / Academy Need</h4>
        <div class="stack-list">
          <div class="stack-item">
            <strong>Partner Need</strong>
            <p>${escapeHtml(record.partnerNeed || 'No partner need saved.')}</p>
          </div>
          <div class="stack-item">
            <strong>Academy Operator Support</strong>
            <p>${escapeHtml(record.academyMissionNeed || 'No Academy support requested yet.')}</p>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Admin Supervision Actions</h4>
        <div class="inline-actions">
          <button class="badge-btn" data-action="federation-deal-room-status-approved" data-id="${record.id}">Approve</button>
          <button class="badge-btn" data-action="federation-deal-room-status-in_discussion" data-id="${record.id}">In Discussion</button>
          <button class="badge-btn" data-action="federation-deal-room-status-commission_due" data-id="${record.id}">Commission Due</button>
          <button class="badge-btn" data-action="federation-deal-room-status-commission_paid" data-id="${record.id}">Commission Paid</button>
          <button class="badge-btn" data-action="federation-deal-room-status-closed" data-id="${record.id}">Close</button>
          <button class="badge-btn" data-action="federation-deal-room-status-rejected" data-id="${record.id}">Reject</button>
        </div>
      </div>
    `;
  }
  if (type === 'federation') {
    return `
      <div class="drawer-section">
        <h4>Candidate Intelligence</h4>
        <div class="kv-grid">
          <div class="kv"><span>Name</span><strong>${escapeHtml(record.name)}</strong></div>
          <div class="kv"><span>Profession</span><strong>${escapeHtml(record.profession)}</strong></div>
          <div class="kv"><span>Region</span><strong>${escapeHtml(record.region)}</strong></div>
          <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
          <div class="kv"><span>Tag</span>${formatBadge(record.tag)}</div>
          <div class="kv"><span>Influence</span><strong>${record.influence}</strong></div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>Strategic Notes</h4>
        <p><strong>Referred By:</strong> ${escapeHtml(record.referredBy)}</p>
        <p><strong>Strategic Value:</strong> ${escapeHtml(record.strategicValue)}</p>
        <div class="stack-list"><div class="stack-item"><p>${escapeHtml(record.notes[0] || record.notes)}</p></div></div>
        <div class="inline-actions">
          <button class="badge-btn" data-action="federation-verify" data-id="${record.id}">Verify</button>
          <button class="badge-btn" data-action="federation-priority" data-id="${record.id}">Make Priority</button>
        </div>
      </div>
    `;
  }

  if (type === 'plazas') {
    return `
      <div class="drawer-section">
        <h4>Listing Record</h4>
        <div class="kv-grid">
          <div class="kv"><span>Title</span><strong>${escapeHtml(record.title)}</strong></div>
          <div class="kv"><span>Owner</span><strong>${escapeHtml(record.owner)}</strong></div>
          <div class="kv"><span>Type</span>${formatBadge(record.type)}</div>
          <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
          <div class="kv"><span>Reports</span><strong>${record.reports}</strong></div>
          <div class="kv"><span>Region</span><strong>${escapeHtml(record.region)}</strong></div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>Moderator Notes</h4>
        <div class="stack-list"><div class="stack-item"><p>${escapeHtml(record.notes[0] || record.notes)}</p></div></div>
        <p><strong>Featured:</strong> ${record.featured ? 'Yes' : 'No'}</p>
        <div class="inline-actions">
          <button class="badge-btn" data-action="plazas-approve" data-id="${record.id}">Approve</button>
          <button class="badge-btn" data-action="plazas-feature" data-id="${record.id}">${record.featured ? 'Unfeature' : 'Feature'}</button>
        </div>
      </div>
    `;
  }

  if (type === 'support') {
    return `
      <div class="drawer-section">
        <h4>Ticket Snapshot</h4>
        <div class="kv-grid">
          <div class="kv"><span>Ticket</span><strong>${escapeHtml(record.id)}</strong></div>
          <div class="kv"><span>Reporter</span><strong>${escapeHtml(record.reporter)}</strong></div>
          <div class="kv"><span>Status</span>${formatBadge(record.status)}</div>
          <div class="kv"><span>Priority</span>${formatBadge(record.priority)}</div>
          <div class="kv"><span>Type</span>${formatBadge(record.type)}</div>
          <div class="kv"><span>Updated</span><strong>${escapeHtml(record.updatedAt)}</strong></div>
        </div>
      </div>
      <div class="drawer-section">
        <h4>Ticket Notes</h4>
        <div class="stack-list"><div class="stack-item"><p>${escapeHtml(record.notes[0] || record.notes)}</p></div></div>
        <div class="inline-actions">
          <button class="badge-btn" data-action="support-progress" data-id="${record.id}">Move Progress</button>
          <button class="badge-btn" data-action="support-resolve" data-id="${record.id}">Resolve</button>
        </div>
      </div>
    `;
  }

  return '<div class="drawer-section"><p class="muted">No detail template found.</p></div>';
}

function resetDrawerHeadControls() {
  const drawer = document.getElementById('detail-drawer');
  const subtools = document.getElementById('drawer-head-subtools');
  const statusEl = document.getElementById('drawer-head-status');
  const statusSelect = document.getElementById('drawer-status-select');
  const copyBtn = document.getElementById('drawer-copy-email-btn');

  if (drawer) {
    drawer.dataset.recordType = '';
    drawer.dataset.recordId = '';
  }

  if (subtools) subtools.hidden = true;
  if (statusEl) statusEl.innerHTML = '';

  if (statusSelect) {
    statusSelect.innerHTML = '<option value="">Quick Status</option>';
    statusSelect.value = '';
    statusSelect.dataset.id = '';
  }

  if (copyBtn) {
    copyBtn.hidden = true;
    copyBtn.dataset.email = '';
    copyBtn.dataset.id = '';
  }
}

function setDrawerHeadControls(type, record) {
  resetDrawerHeadControls();

  const drawer = document.getElementById('detail-drawer');
  const subtools = document.getElementById('drawer-head-subtools');
  const statusEl = document.getElementById('drawer-head-status');
  const statusSelect = document.getElementById('drawer-status-select');
  const copyBtn = document.getElementById('drawer-copy-email-btn');

  if (drawer) {
    drawer.dataset.recordType = type || '';
    drawer.dataset.recordId = record?.id || '';
  }

  if (type !== 'application' || !record) return;
  if (!subtools || !statusEl || !statusSelect || !copyBtn) return;

  const currentStatus = String(record.status || 'Under Review').trim() || 'Under Review';
  const email = String(record.email || '').trim();

  subtools.hidden = false;
  statusEl.innerHTML = formatBadge(currentStatus);

  statusSelect.innerHTML = `
    <option value="">Quick Status</option>
    <option value="approve-application"${currentStatus === 'Approved' ? ' disabled' : ''}>Set Approved</option>
    <option value="reject-application"${currentStatus === 'Rejected' ? ' disabled' : ''}>Set Rejected</option>
    <option value="waitlist-application"${currentStatus === 'Waitlisted' ? ' disabled' : ''}>Set Waitlisted</option>
  `;
  statusSelect.value = '';
  statusSelect.dataset.id = record.id;

  copyBtn.hidden = !email;
  copyBtn.dataset.email = email;
  copyBtn.dataset.id = record.id;
}

async function copyTextToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) {}

  const temp = document.createElement('textarea');
  temp.value = value;
  temp.setAttribute('readonly', '');
  temp.style.position = 'fixed';
  temp.style.opacity = '0';
  temp.style.pointerEvents = 'none';
  document.body.appendChild(temp);
  temp.select();

  try {
    const copied = document.execCommand('copy');
    document.body.removeChild(temp);
    return copied;
  } catch (_) {
    document.body.removeChild(temp);
    return false;
  }
}

async function handleDrawerStatusChange(action, id) {
  if (!action || !id) return;

  await handleAction(action, id);

  const refreshed = findById('applications', id);
  if (refreshed) {
    openDrawer('application', id);
  } else {
    closeDrawer();
  }
}
async function matchFederationConnectionRequestToLead(record, selectedValue = '') {
  const requestId = String(record?.id || '').trim();
  const [ownerUid, leadId] = String(selectedValue || '').split('::').map((part) => part.trim());

  if (!requestId) {
    throw new Error('Missing Federation request id.');
  }

  if (!ownerUid || !leadId) {
    throw new Error('Select a lead to match first.');
  }

  await adminFetchJson(
    `/api/admin/federation/connection-requests/${encodeURIComponent(requestId)}/match`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ownerUid,
        leadId
      })
    }
  );

  await loadAdminBootstrap();

  const refreshed = findById('federationConnectionRequests', requestId);
  if (refreshed) {
    openDrawer('federationRequest', refreshed.id);
  }
}
async function saveFederationConnectionDealPackage(record) {
  const requestId = String(record?.id || '').trim();
  if (!requestId) throw new Error('Missing Federation request id.');

  const payload = {
    pricingAmount: document.getElementById(getDealPackageFieldId(requestId, 'price'))?.value || 0,
    currency: document.getElementById(getDealPackageFieldId(requestId, 'currency'))?.value || 'USD',
    platformCommissionRate: document.getElementById(getDealPackageFieldId(requestId, 'commissionRate'))?.value || 0,
    platformCommissionAmount: document.getElementById(getDealPackageFieldId(requestId, 'commissionAmount'))?.value || '',
    operatorPayoutAmount: document.getElementById(getDealPackageFieldId(requestId, 'operatorPayout'))?.value || '',
    paymentStatus: document.getElementById(getDealPackageFieldId(requestId, 'paymentStatus'))?.value || 'not_started',
    payoutStatus: document.getElementById(getDealPackageFieldId(requestId, 'payoutStatus'))?.value || 'not_started',
    commissionStatus: document.getElementById(getDealPackageFieldId(requestId, 'commissionStatus'))?.value || 'not_started',
    dealNotes: document.getElementById(getDealPackageFieldId(requestId, 'notes'))?.value || ''
  };

  const { data } = await adminFetchJson(
    `/api/admin/federation/connection-requests/${encodeURIComponent(requestId)}/deal-package`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );

  showToast(
    data?.academyEconomySynced
      ? 'Deal package saved and Academy earnings synced.'
      : 'Deal package saved. Academy earnings sync is waiting for a matched lead.'
  );

  await loadAdminBootstrap();

  const refreshed = findById('federationConnectionRequests', requestId);
  if (refreshed) {
    openDrawer('federationRequest', refreshed.id);
  }
}
async function updateFederationConnectionRequestStatus(record, status = '') {
  const requestId = String(record?.id || '').trim();
  const nextStatus = String(status || '').trim();

  if (!requestId || !nextStatus) {
    throw new Error('Missing Federation request id or status.');
  }

  const { data } = await adminFetchJson(
    `/api/admin/federation/connection-requests/${encodeURIComponent(requestId)}/status`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: nextStatus })
    }
  );

  showToast(
    data?.academyEconomySynced
      ? 'Request status updated and Academy earnings synced.'
      : 'Request status updated. Academy earnings sync is waiting for a matched lead.'
  );

  await loadAdminBootstrap();

  const refreshed = findById('federationConnectionRequests', requestId);
  if (refreshed) {
    openDrawer('federationRequest', refreshed.id);
  }
}
async function updateAcademyLeadMissionNetwork(record, patch = {}) {
  if (!record?.memberId && !record?.ownerUid) {
    throw new Error('Missing Lead Mission owner id.');
  }

  if (!record?.id) {
    throw new Error('Missing Lead Mission id.');
  }

  const memberId = record.memberId || record.ownerUid;

  await adminFetchJson(
    `/api/admin/academy/lead-missions/${encodeURIComponent(memberId)}/${encodeURIComponent(record.id)}/network`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patch)
    }
  );

  await loadAdminBootstrap();

  const refreshed = findById('academyLeadMissions', record.id);
  if (refreshed) {
    openDrawer('academyLeadMission', refreshed.id);
  }
}
function getAdminAcademyOperatorOptions() {
  const options = [];

  (state.members || []).forEach((member) => {
    const divisions = Array.isArray(member.divisions)
      ? member.divisions.map((item) => String(item || '').trim().toLowerCase())
      : [];

    if (!divisions.includes('academy')) return;

    const id = String(member.id || member.memberId || '').trim();
    if (!id) return;

    options.push({
      id,
      label: `${member.name || member.fullName || member.email || id} — ${id}`
    });
  });

  (state.academy || []).forEach((member) => {
    const id = String(member.memberId || member.id || member.ownerUid || '').trim();
    if (!id) return;

    if (options.some((item) => item.id === id)) return;

    options.push({
      id,
      label: `${member.name || member.fullName || member.memberName || member.email || id} — ${id}`
    });
  });

  return options;
}

function openAdminInlineModal(config = {}) {
  return new Promise((resolve) => {
    const existing = document.getElementById('yh-admin-inline-modal');
    if (existing) existing.remove();

    const fields = Array.isArray(config.fields) ? config.fields : [];

    const overlay = document.createElement('div');
    overlay.id = 'yh-admin-inline-modal';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '30000';
    overlay.style.background = 'rgba(0,0,0,.68)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '18px';

    const card = document.createElement('form');
    card.style.width = 'min(94vw, 620px)';
    card.style.maxHeight = '86vh';
    card.style.overflow = 'auto';
    card.style.background = '#0b1220';
    card.style.border = '1px solid rgba(255,255,255,.14)';
    card.style.borderRadius = '18px';
    card.style.boxShadow = '0 24px 80px rgba(0,0,0,.48)';
    card.style.padding = '20px';
    card.style.color = '#f8fafc';

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px;">
        <div>
          <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.14em;color:#8bb3ff;font-weight:700;">Admin Action</div>
          <h3 style="margin:5px 0 4px;font-size:1.1rem;">${escapeHtml(config.title || 'Admin Action')}</h3>
          <p style="margin:0;color:#98a4b8;font-size:.86rem;line-height:1.5;">${escapeHtml(config.description || '')}</p>
        </div>
        <button type="button" data-admin-modal-cancel style="border:0;background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:8px 10px;">✕</button>
      </div>

      <div data-admin-modal-fields style="display:grid;gap:13px;"></div>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
        <button type="button" data-admin-modal-cancel style="border:1px solid rgba(255,255,255,.14);background:transparent;color:#f8fafc;border-radius:12px;padding:10px 14px;">Cancel</button>
        <button type="submit" style="border:0;background:#4d8bff;color:#fff;border-radius:12px;padding:10px 14px;font-weight:700;">${escapeHtml(config.submitLabel || 'Continue')}</button>
      </div>
    `;

    const fieldsWrap = card.querySelector('[data-admin-modal-fields]');

    fields.forEach((field) => {
      const wrap = document.createElement('label');
      wrap.style.display = 'grid';
      wrap.style.gap = '7px';
      wrap.style.fontSize = '.86rem';
      wrap.style.color = '#dbeafe';

      const label = document.createElement('span');
      label.textContent = field.label || field.name || 'Field';
      label.style.fontWeight = '700';

      let input;

      if (field.type === 'select') {
        input = document.createElement('select');
        (field.options || []).forEach((option) => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.label;
          if (String(option.value) === String(field.value || '')) opt.selected = true;
          input.appendChild(opt);
        });
      } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = field.rows || 5;
        input.value = field.value || '';
      } else {
        input = document.createElement('input');
        input.type = field.type || 'text';
        input.value = field.value || '';
        if (field.min !== undefined) input.min = field.min;
        if (field.max !== undefined) input.max = field.max;
        if (field.step !== undefined) input.step = field.step;
      }

      input.name = field.name;
      input.placeholder = field.placeholder || '';
      input.required = field.required === true;
      input.style.width = '100%';
      input.style.border = '1px solid rgba(255,255,255,.14)';
      input.style.background = 'rgba(255,255,255,.06)';
      input.style.color = '#f8fafc';
      input.style.borderRadius = '12px';
      input.style.padding = '11px 12px';
      input.style.outline = 'none';
      input.style.boxSizing = 'border-box';

      wrap.appendChild(label);
      wrap.appendChild(input);
      fieldsWrap.appendChild(wrap);
    });

    function cleanup(value) {
      overlay.remove();
      resolve(value);
    }

    card.querySelectorAll('[data-admin-modal-cancel]').forEach((button) => {
      button.addEventListener('click', () => cleanup(null));
    });

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(null);
    });

    card.addEventListener('submit', (event) => {
      event.preventDefault();

      const output = {};
      const formData = new FormData(card);

      fields.forEach((field) => {
        output[field.name] = String(formData.get(field.name) || '').trim();
      });

      cleanup(output);
    });

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const firstInput = card.querySelector('select, textarea, input');
    if (firstInput) firstInput.focus();
  });
}
async function reviewAcademyRoutedMission(record, decision = '') {
  if (!record?.memberId && !record?.ownerUid) {
    throw new Error('Missing Lead Mission owner id.');
  }

  if (!record?.id) {
    throw new Error('Missing Lead Mission id.');
  }

  const memberId = record.memberId || record.ownerUid;
  const cleanDecision = String(decision || '').trim().toLowerCase();

  const modalResult = await openAdminInlineModal({
    title:
      cleanDecision === 'approved'
        ? 'Approve Academy Mission'
        : cleanDecision === 'revision_requested'
          ? 'Request Mission Revision'
          : 'Reject Academy Mission',
    description:
      cleanDecision === 'approved'
        ? 'Confirm the operator payout and add an optional approval note.'
        : cleanDecision === 'revision_requested'
          ? 'Tell the operator what needs to be corrected before approval.'
          : 'Add the reason this mission is being rejected.',
    submitLabel:
      cleanDecision === 'approved'
        ? 'Approve Mission'
        : cleanDecision === 'revision_requested'
          ? 'Send Revision'
          : 'Reject Mission',
    fields: [
      ...(cleanDecision === 'approved'
        ? [{
            name: 'operatorPayoutAmount',
            label: 'Operator Payout Amount',
            type: 'number',
            min: '0',
            step: '1',
            value: String(record.operatorPayoutAmount || 0),
            required: true
          }]
        : []),
      {
        name: 'adminNote',
        label:
          cleanDecision === 'revision_requested'
            ? 'Revision Note'
            : cleanDecision === 'rejected'
              ? 'Rejection Note'
              : 'Approval Note',
        type: 'textarea',
        rows: 5,
        value: '',
        required: cleanDecision !== 'approved',
        placeholder: 'Write the admin note here...'
      }
    ]
  });

  if (!modalResult) return null;

  const payload = {
    decision: cleanDecision,
    adminNote: String(modalResult.adminNote || '').trim()
  };

  if (cleanDecision === 'approved') {
    payload.operatorPayoutAmount = Number(modalResult.operatorPayoutAmount || 0);
    payload.currency = record.currency || 'USD';
  }

  const { data } = await adminFetchJson(
    `/api/admin/academy/lead-missions/${encodeURIComponent(memberId)}/${encodeURIComponent(record.id)}/review`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  await loadAdminBootstrap();

  const refreshed = findById('academyLeadMissions', record.id);
  if (refreshed) {
    openDrawer('academyLeadMission', refreshed.id);
  }

  return data;
}

function getAcademyRouteMemberPromptDefault() {
  const academyMember =
    (state.members || []).find((member) => {
      return Array.isArray(member.divisions) && member.divisions.includes('Academy');
    }) ||
    (state.academy || []).find((member) => member.memberId);

  return academyMember?.id || academyMember?.memberId || '';
}

async function routeAdminOpportunityToAcademy(sourceType = '', record = {}) {
  const sourceId = String(record?.id || '').trim();

  if (!sourceId) {
    throw new Error('Missing source record id.');
  }

  const defaultMemberId = getAcademyRouteMemberPromptDefault();
  const operatorOptions = getAdminAcademyOperatorOptions();

  const defaultBrief =
    record.academyMissionNeed ||
    record.partnerNeed ||
    record.monetizationNote ||
    record.text ||
    record.description ||
    `Review and execute: ${record.title || 'Opportunity Mission'}`;

  const modalResult = await openAdminInlineModal({
    title: 'Route to Academy Mission',
    description: 'Choose the Academy operator and write the exact mission brief. This will create a real assigned mission in the operator workspace.',
    submitLabel: 'Route Mission',
    fields: [
      operatorOptions.length
        ? {
            name: 'memberId',
            label: 'Academy Operator',
            type: 'select',
            value: defaultMemberId,
            required: true,
            options: operatorOptions.map((item) => ({
              value: item.id,
              label: item.label
            }))
          }
        : {
            name: 'memberId',
            label: 'Academy Operator / Member ID',
            type: 'text',
            value: defaultMemberId,
            required: true,
            placeholder: 'Paste Academy member ID'
          },
      {
        name: 'missionBrief',
        label: 'Operator Mission Brief',
        type: 'textarea',
        rows: 6,
        value: String(defaultBrief || '').trim(),
        required: true,
        placeholder: 'Describe exactly what the Academy operator should do...'
      }
    ]
  });

  if (!modalResult) return null;

  const cleanMemberId = String(modalResult.memberId || '').trim();

  if (!cleanMemberId) {
    throw new Error('Academy operator/member ID is required.');
  }

  const { data } = await adminFetchJson('/api/admin/academy/route-opportunity-mission', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sourceType,
      sourceId,
      memberId: cleanMemberId,
      missionBrief: String(modalResult.missionBrief || '').trim()
    })
  });

  await loadAdminBootstrap();

  const missionId = data?.mission?.id || '';
  const routedMission = missionId ? findById('academyLeadMissions', missionId) : null;

  if (routedMission) {
    openDrawer('academyLeadMission', routedMission.id);
  }

  return data;
}

function openDrawer(type, id) {
  const map = {
    application: 'applications',
    member: 'members',
    academy: 'academy',
    academyLeadMission: 'academyLeadMissions',
    federationLead: 'federationLeadDatabase',
    federationRequest: 'federationConnectionRequests',
    federationDealRoom: 'federationDealRooms',
    federation: 'federation',
    plazas: 'plazas',
    support: 'support'
  };

  const collection = map[type];
  const record = collection ? findById(collection, id) : null;
  const drawer = document.getElementById('detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const drawerBody = document.getElementById('drawer-body');

  document.getElementById('drawer-type').textContent =
    type === 'academyLeadMission'
      ? 'Lead Mission'
      : type === 'federationLead'
        ? 'Federation Lead'
          : type === 'federationRequest'
            ? 'Connection Request'
            : type === 'federationDealRoom'
              ? 'Federation Deal Room'
              : type[0].toUpperCase() + type.slice(1);

  document.getElementById('drawer-title').textContent =
    record?.companyName ||
    record?.contactName ||
    record?.name ||
    record?.title ||
    record?.memberName ||
    id;

  if (drawerBody) {
    drawerBody.innerHTML = getDrawerTemplate(type, record);

    if (type === 'academy' && record) {
      drawerBody.insertAdjacentHTML('beforeend', buildAcademyCoachInspectorMarkup(record));
    }
  }

  setDrawerHeadControls(type, record);

  if (drawer) {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  if (backdrop) {
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('show'));
  }

  document.body.classList.add('drawer-open');
}
function closeDrawer() {
  const drawer = document.getElementById('detail-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  if (backdrop) {
    backdrop.classList.remove('show');
    setTimeout(() => {
      if (!drawer || !drawer.classList.contains('open')) backdrop.hidden = true;
    }, 220);
  }

  resetDrawerHeadControls();
  document.body.classList.remove('drawer-open');
}

function syncMemberFromApplication(application) {
  const exists = state.members.some(member => member.email && application.email && member.email === application.email);
  if (exists) return;

  const newMemberId = `MEM-${Date.now().toString().slice(-6)}`;
  const isAcademyMembership = String(application.applicationType || '').trim().toLowerCase() === 'academy-membership';

  state.members.unshift({
    id: newMemberId,
    name: application.name,
    username: application.username
      ? `@${String(application.username).replace(/^@+/, '')}`
      : `@${application.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
    email: application.email,
    divisions: [application.recommendedDivision],
    status: 'Active',
    role: application.role || application.profession || 'Operator',
    profession: application.role || application.profession || 'Operator',
    primaryCategory: application.primaryCategory || application.category || '',
    federationProfileMap: application.federationProfileMap || null,
    federationScore: Number(application.federationScore || 0),
    federationTier: application.federationTier || '',
    federationTags: Array.isArray(application.federationTags) ? application.federationTags : [],
    roles: Array.isArray(application.roles) ? application.roles : [],
    lookingFor: application.lookingFor || '',
    canOffer: application.canOffer || '',
    wantsAccessTo: application.wantsAccessTo || '',
    openTo: Array.isArray(application.openTo) ? application.openTo : [],
    activityScore: 50,
    roadmapStatus: isAcademyMembership
      ? 'Ready for roadmap setup'
      : application.recommendedDivision === 'Academy'
        ? 'Roadmap live'
        : 'Not assigned',
    riskFlag: 'Low',
    joinedAt: new Date().toISOString().slice(0, 10),
    lastLogin: 'Just now',
    notes: [
      `Created from ${application.id} approval.`,
      ...(isAcademyMembership ? ['Academy membership approved. User can now generate a roadmap instantly from the Roadmap tab.'] : [])
    ]
  });

  return newMemberId;
}
const FEDERATION_ACCESS_STATUS_CACHE_KEY = 'yh_federation_access_status_v1';
const FEDERATION_LADDER_OUTCOME_CACHE_KEY = 'yh_federation_ladder_outcome_v1';
const FEDERATION_APPLICATIONS_STORAGE_KEY = 'yh_federation_applications';
const FEDERATION_MEMBERS_STORAGE_KEY = 'yh_federation_members';

function readAdminLocalJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeAdminLocalJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

function normalizeFederationLadderStatus(value = '') {
  const raw = String(value || '').trim().toLowerCase();

  if (raw === 'approved' || raw === 'active') return 'approved';
  if (raw === 'under review' || raw === 'pending' || raw === 'pending review' || raw === 'review') return 'under review';
  if (raw === 'screening' || raw === 'in screening') return 'screening';
  if (raw === 'shortlisted' || raw === 'shortlist') return 'shortlisted';
  if (raw === 'waitlisted' || raw === 'waitlist') return 'waitlisted';
  if (raw === 'rejected' || raw === 'denied' || raw === 'not approved') return 'rejected';

  return raw;
}

function buildFederationLadderOutcomeSnapshot(application = {}, statusLabel = 'Under Review', member = null) {
  const normalizedStatus = normalizeFederationLadderStatus(statusLabel);
  const score = Number(application.federationScore || application.aiScore || 0);
  const tier = String(application.federationTier || '').trim();

  let strategicState = 'In Federation Review';
  let copy = 'Your Federation application is currently in review. Admin is evaluating your candidacy against trust, leverage, and strategic value.';
  let connectReady = false;

  if (normalizedStatus === 'approved') {
    strategicState = 'Inside Federation';
    copy = 'Your Federation application has been approved. The strategic layer is now unlocked and your next state should reflect active Federation access.';
    connectReady = true;
  } else if (normalizedStatus === 'shortlisted') {
    strategicState = 'Shortlisted';
    copy = 'Your Federation application has reached shortlist status. You are near final review, but access is not unlocked yet.';
  } else if (normalizedStatus === 'waitlisted') {
    strategicState = 'Waitlisted';
    copy = 'Your Federation application has been waitlisted. Strengthen your Plaza signal and strategic proof before the next review cycle.';
  } else if (normalizedStatus === 'rejected') {
    strategicState = 'Review Rejected';
    copy = 'Your Federation application was not approved in this cycle. Build stronger Plaza outcomes, trust, and leverage before reapplying.';
  } else if (normalizedStatus === 'screening') {
    strategicState = 'In Screening';
    copy = 'Your Federation application is currently being screened before final review.';
  }

  return {
    applicationId: String(application.id || '').trim(),
    email: String(application.email || '').trim().toLowerCase(),
    status: normalizedStatus,
    strategicState,
    copy,
    connectReady,
    score,
    tier,
    reviewedAt: String(application.reviewedAt || '').trim(),
    reviewedBy: 'admin-local-review',
    memberId: String(member?.id || application.memberId || '').trim(),
    cachedAt: new Date().toISOString()
  };
}

function syncFederationReviewWriteback(application = {}, statusLabel = 'Under Review', member = null) {
  const normalizedStatus = normalizeFederationLadderStatus(statusLabel);
  const emailLower = String(application.email || '').trim().toLowerCase();

  const applications = Array.isArray(readAdminLocalJson(FEDERATION_APPLICATIONS_STORAGE_KEY, []))
    ? readAdminLocalJson(FEDERATION_APPLICATIONS_STORAGE_KEY, [])
    : [];

  const nextApplicationRecord = {
    ...application,
    email: emailLower,
    status: String(statusLabel || 'Under Review').trim() || 'Under Review'
  };

  const nextApplications = [
    nextApplicationRecord,
    ...applications.filter((item) => {
      const sameId = String(item?.id || '').trim() === String(application.id || '').trim();
      const sameEmail = String(item?.email || '').trim().toLowerCase() === emailLower;
      return !sameId && !sameEmail;
    })
  ];

  writeAdminLocalJson(FEDERATION_APPLICATIONS_STORAGE_KEY, nextApplications);

  if (normalizedStatus === 'approved' && member) {
    const members = Array.isArray(readAdminLocalJson(FEDERATION_MEMBERS_STORAGE_KEY, []))
      ? readAdminLocalJson(FEDERATION_MEMBERS_STORAGE_KEY, [])
      : [];

    const federationMember = {
      id: String(member.id || application.memberId || '').trim() || `fed_member_${Date.now()}`,
      email: emailLower,
      emailLower,
      name: String(member.name || application.name || application.fullName || 'Federation Member').trim(),
      role: String(member.role || application.role || application.profession || 'Operator').trim(),
      badge: String(member.badge || 'Verified').trim(),
      category: String(member.primaryCategory || application.primaryCategory || 'Strategic Operator').trim(),
      country: String(application.country || '').trim(),
      city: String(application.city || '').trim(),
      company: String(application.company || '').trim(),
      description: String(
        application.opportunityInsight ||
        application.background ||
        'Approved Federation member.'
      ).trim(),
      approvedAt: String(application.approvedAt || new Date().toISOString()).trim(),
      source: 'admin-review',
      referralCode: String(member.referralCode || '').trim()
    };

    const nextMembers = [
      federationMember,
      ...members.filter((item) => {
        const sameId = String(item?.id || '').trim() === federationMember.id;
        const sameEmail = String(item?.email || '').trim().toLowerCase() === emailLower;
        return !sameId && !sameEmail;
      })
    ];

    writeAdminLocalJson(FEDERATION_MEMBERS_STORAGE_KEY, nextMembers);
  }

  writeAdminLocalJson(FEDERATION_ACCESS_STATUS_CACHE_KEY, {
    hasApplication: true,
    canEnterFederation: normalizedStatus === 'approved',
    applicationStatus: normalizedStatus,
    application: nextApplicationRecord,
    member: normalizedStatus === 'approved' && member
      ? {
          id: String(member.id || application.memberId || '').trim(),
          email: emailLower,
          name: String(member.name || application.name || application.fullName || 'Federation Member').trim()
        }
      : null
  });

  writeAdminLocalJson(
    FEDERATION_LADDER_OUTCOME_CACHE_KEY,
    buildFederationLadderOutcomeSnapshot(nextApplicationRecord, statusLabel, member)
  );
}
function applyLocalApplicationReview(applicationId, nextStatus = 'Under Review') {
  const application = findById('applications', applicationId);

  if (!application) {
    throw new Error('Application not found in local admin state.');
  }

  const nowIso = new Date().toISOString();
  const statusLabel = String(nextStatus || 'Under Review').trim() || 'Under Review';

  application.status = statusLabel;
  application.updatedAt = nowIso;
  application.reviewedAt = nowIso;

  if (!Array.isArray(application.notes)) {
    application.notes = [];
  }

  application.notes.unshift(`Local admin review changed status to ${statusLabel}.`);

  let memberId = '';
  let syncedMember = null;

  if (statusLabel === 'Approved') {
    application.approvedAt = nowIso;

    memberId = syncMemberFromApplication(application) || '';

    syncedMember = state.members.find((member) => {
      return (
        String(member?.email || '').trim().toLowerCase() === String(application.email || '').trim().toLowerCase()
      );
    }) || null;

    if (String(application.recommendedDivision || application.division || '').trim() === 'Federation') {
      const federationCandidate = {
        id: application.id,
        name: application.name || application.fullName || 'Federation Member',
        email: application.email || '',
        profession: application.role || application.profession || 'Operator',
        region: application.region || [application.city, application.country].filter(Boolean).join(', '),
        status: 'Verified',
        influence: Number(application.influence || application.federationScore || 0),
        tag: application.primaryCategory || 'Operator',
        tier: application.federationTier || '',
        federationScore: Number(application.federationScore || 0),
        federationTier: application.federationTier || '',
        federationTags: Array.isArray(application.federationTags) ? application.federationTags : [],
        federationProfileMap: application.federationProfileMap || null,
        sourceApplicationId: application.id,
        memberId: memberId || application.memberId || '',
        approvedAt: nowIso,
        updatedAt: nowIso
      };

      const existingFederationIndex = state.federation.findIndex((item) => {
        return item.id === federationCandidate.id || item.sourceApplicationId === application.id;
      });

      if (existingFederationIndex >= 0) {
        state.federation[existingFederationIndex] = {
          ...state.federation[existingFederationIndex],
          ...federationCandidate
        };
      } else {
        state.federation.unshift(federationCandidate);
      }
    }
  } else if (String(application.recommendedDivision || application.division || '').trim() === 'Federation') {
    const existingFederationIndex = state.federation.findIndex((item) => {
      return item.id === application.id || item.sourceApplicationId === application.id;
    });

    if (existingFederationIndex >= 0) {
      state.federation[existingFederationIndex] = {
        ...state.federation[existingFederationIndex],
        status: statusLabel,
        updatedAt: nowIso
      };
    }
  }

  syncFederationReviewWriteback(application, statusLabel, syncedMember);

  saveState();
  renderApp();

  return application;
}
async function handleAction(action, id) {
  switch (action) {
case 'approve-application': {
  try {
    const { data } = await adminFetchJson(`/api/admin/applications/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decision: 'approve' })
    });

    await loadAdminBootstrap();

    if (data?.approvalEmailSent) {
      showToast('Application approved. Approval email sent.');
    } else if (data?.approvalEmailError) {
      showToast(`Application approved. Email not sent: ${data.approvalEmailError}`);
    } else {
      showToast('Application approved.');
    }
  } catch (error) {
    try {
      applyLocalApplicationReview(id, 'Approved');
      showToast('Application approved locally.');
    } catch (fallbackError) {
      if (error?.message !== 'No active admin session.') {
        showToast(fallbackError.message || error.message || 'Failed to approve application.');
      }
    }
  }
  break;
}

case 'reject-application': {
  try {
    await adminFetchJson(`/api/admin/applications/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decision: 'reject' })
    });

    await loadAdminBootstrap();
    showToast('Application rejected.');
  } catch (error) {
    try {
      applyLocalApplicationReview(id, 'Rejected');
      showToast('Application rejected locally.');
    } catch (fallbackError) {
      if (error?.message !== 'No active admin session.') {
        showToast(fallbackError.message || error.message || 'Failed to reject application.');
      }
    }
  }
  break;
}

case 'waitlist-application': {
  try {
    await adminFetchJson(`/api/admin/applications/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decision: 'waitlist' })
    });

    await loadAdminBootstrap();
    showToast('Application waitlisted.');
  } catch (error) {
    try {
      applyLocalApplicationReview(id, 'Waitlisted');
      showToast('Application waitlisted locally.');
    } catch (fallbackError) {
      if (error?.message !== 'No active admin session.') {
        showToast(fallbackError.message || error.message || 'Failed to waitlist application.');
      }
    }
  }
  break;
}
    case 'toggle-member-status': {
      const member = findById('members', id);
      if (!member) return;

      const nextStatus = member.status === 'Suspended' ? 'Active' : 'Suspended';

      try {
        await adminFetchJson(`/api/admin/members/${encodeURIComponent(id)}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: nextStatus })
        });

        await loadAdminBootstrap();
        showToast(`${member.name} is now ${nextStatus}.`);
      } catch (error) {
        showToast(error.message || 'Failed to update member status.');
      }
      break;
    }
    case 'academy-nudge': {
      try {
        await adminFetchJson(`/api/admin/academy/${encodeURIComponent(id)}/nudge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });

        await loadAdminBootstrap();
        showToast('Academy nudge sent.');
      } catch (error) {
        showToast(error.message || 'Failed to send academy nudge.');
      }
      break;
    }
case 'academy-track': {
  try {
    await adminFetchJson(`/api/admin/academy/${encodeURIComponent(id)}/track`, {
      method: 'POST'
    });
    await loadAdminBootstrap();
    showToast('Academy member marked on track.');
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to update Academy status.');
    }
  }
  break;
}

case 'lead-federation-ready': {
  try {
    const record = findById('academyLeadMissions', id);
    if (!record) throw new Error('Lead Mission record not found.');

    await updateAcademyLeadMissionNetwork(record, {
      federationReady: !record.federationReady
    });

    showToast(record.federationReady ? 'Removed Federation-ready routing.' : 'Marked Federation-ready.');
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to update Federation routing.');
    }
  }
  break;
}

case 'lead-plaza-ready': {
  try {
    const record = findById('academyLeadMissions', id);
    if (!record) throw new Error('Lead Mission record not found.');

    await updateAcademyLeadMissionNetwork(record, {
      plazaReady: !record.plazaReady
    });

    showToast(record.plazaReady ? 'Removed Plaza-ready routing.' : 'Marked Plaza-ready.');
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to update Plaza routing.');
    }
  }
  break;
}

case 'lead-set-strategic-value': {
  try {
    const record = findById('academyLeadMissions', id);
    if (!record) throw new Error('Lead Mission record not found.');

    const currentValue = String(record.strategicValue || 'standard').trim() || 'standard';

    const modalResult = await openAdminInlineModal({
      title: 'Set Strategic Value',
      description: 'Choose how valuable this Academy Lead Mission is for Plaza, Federation, and the wider YH economy.',
      submitLabel: 'Save Value',
      fields: [
        {
          name: 'strategicValue',
          label: 'Strategic Value',
          type: 'select',
          value: currentValue,
          required: true,
          options: [
            { value: 'standard', label: 'Standard' },
            { value: 'watch', label: 'Watch' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'strategic', label: 'Strategic' }
          ]
        }
      ]
    });

    if (!modalResult) return;

    await updateAcademyLeadMissionNetwork(record, {
      strategicValue: String(modalResult.strategicValue || currentValue).trim()
    });

    showToast('Strategic value updated.');
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to update strategic value.');
    }
  }
  break;
}
case 'lead-review-approve':
case 'lead-review-revision':
case 'lead-review-reject': {
  try {
    const record = findById('academyLeadMissions', id);
    if (!record) throw new Error('Lead Mission record not found.');

    const decision =
      action === 'lead-review-approve'
        ? 'approved'
        : action === 'lead-review-revision'
          ? 'revision_requested'
          : 'rejected';

    const result = await reviewAcademyRoutedMission(record, decision);

    if (result) {
      showToast(`Lead Mission marked ${decision.replace(/_/g, ' ')}.`);
    }
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to review Lead Mission.');
    }
  }
  break;
}

case 'plazas-route-academy': {
  try {
    const record = findById('plazas', id);
    if (!record) throw new Error('Plaza listing not found.');

    const result = await routeAdminOpportunityToAcademy('plaza', record);

    if (result) {
      showToast('Plaza opportunity routed to Academy Mission.');
    }
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to route Plaza listing to Academy.');
    }
  }
  break;
}

case 'federation-deal-room-route-academy': {
  try {
    const record = findById('federationDealRooms', id);
    if (!record) throw new Error('Federation Deal Room not found.');

    const result = await routeAdminOpportunityToAcademy('federation_deal_room', record);

    if (result) {
      showToast('Federation Deal Room routed to Academy Mission.');
    }
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to route Federation Deal Room to Academy.');
    }
  }
  break;
}

case 'federation-request-match-selected': {
  try {
    const record = findById('federationConnectionRequests', id);
    if (!record) throw new Error('Federation connection request not found.');

    const select = document.getElementById(`federation-match-lead-select-${id}`);
    const selectedValue = select ? select.value : '';

    await matchFederationConnectionRequestToLead(record, selectedValue);

    showToast('Connection request matched to selected lead.');
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to match lead.');
    }
  }
  break;
}

case 'federation-request-save-deal': {
  try {
    const record = findById('federationConnectionRequests', id);
    if (!record) throw new Error('Federation connection request not found.');

    await saveFederationConnectionDealPackage(record);

    showToast('Deal package saved.');
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to save deal package.');
    }
  }
  break;
}

case 'economy-payout-status-approved':
case 'economy-payout-status-processing':
case 'economy-payout-status-paid':
case 'economy-payout-status-rejected': {
  try {
    const nextStatus = action.replace('economy-payout-status-', '');
    await updateAdminPayoutStatus(id, nextStatus);
    showToast(`Payout marked ${nextStatus.replace(/_/g, ' ')}.`);
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to update payout request.');
    }
  }
  break;
}

case 'federation-deal-room-status-approved':
case 'federation-deal-room-status-in_discussion':
case 'federation-deal-room-status-commission_due':
case 'federation-deal-room-status-commission_paid':
case 'federation-deal-room-status-closed':
case 'federation-deal-room-status-rejected': {
  try {
    const record = findById('federationDealRooms', id);
    if (!record) throw new Error('Federation Deal Room not found.');

    const nextStatus = action.replace('federation-deal-room-status-', '');

    await adminFetchJson(`/api/admin/federation/deal-rooms/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ adminStatus: nextStatus })
    });

    await loadAdminBootstrap();

    showToast(`Federation Deal Room updated to ${nextStatus.replace(/_/g, ' ')}.`);
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to update Federation Deal Room.');
    }
  }
  break;
}

case 'federation-request-status-matched':
case 'federation-request-status-pricing_sent':
case 'federation-request-status-paid':
case 'federation-request-status-intro_delivered':
case 'federation-request-status-completed':
case 'federation-request-status-rejected': {
  try {
    const record = findById('federationConnectionRequests', id);
    if (!record) throw new Error('Federation connection request not found.');

    const nextStatus = action.replace('federation-request-status-', '');
    await updateFederationConnectionRequestStatus(record, nextStatus);

    showToast(`Connection request updated to ${nextStatus.replace(/_/g, ' ')}.`);
  } catch (error) {
    if (error?.message !== 'No active admin session.') {
      showToast(error.message || 'Failed to update Federation connection request.');
    }
  }
  break;
}
    case 'federation-verify': {
      const record = findById('federation', id);
      if (!record) return;
      record.status = 'Verified';
      record.notes.unshift('Verified by admin.');
      saveState();
      renderApp();
      showToast(`${record.name} verified.`);
      break;
    }
    case 'federation-priority': {
      const record = findById('federation', id);
      if (!record) return;
      record.status = 'Strategic Priority';
      record.notes.unshift('Elevated to strategic priority.');
      saveState();
      renderApp();
      showToast(`${record.name} is now strategic priority.`);
      break;
    }
    case 'plazas-approve': {
      try {
        const record = findById('plazas', id);
        if (!record) throw new Error('Plaza listing not found.');

        await adminFetchJson(`/api/admin/plazas/${encodeURIComponent(id)}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'active' })
        });

        await loadAdminBootstrap();

        showToast(`Listing ${record.title} approved.`);
      } catch (error) {
        if (error?.message !== 'No active admin session.') {
          showToast(error.message || 'Failed to approve Plaza listing.');
        }
      }
      break;
    }

    case 'plazas-feature': {
      try {
        const record = findById('plazas', id);
        if (!record) throw new Error('Plaza listing not found.');

        const nextFeatured = !record.featured;

        await adminFetchJson(`/api/admin/plazas/${encodeURIComponent(id)}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ featured: nextFeatured })
        });

        await loadAdminBootstrap();

        showToast(`${record.title} ${nextFeatured ? 'featured' : 'unfeatured'}.`);
      } catch (error) {
        if (error?.message !== 'No active admin session.') {
          showToast(error.message || 'Failed to update Plaza listing.');
        }
      }
      break;
    }
    case 'support-progress': {
      const record = findById('support', id);
      if (!record) return;
      record.status = record.status === 'Open' ? 'In Progress' : 'Waiting on User';
      record.updatedAt = 'Just now';
      record.notes.unshift(`Ticket moved to ${record.status}.`);
      saveState();
      renderApp();
      showToast(`Ticket ${record.id} updated.`);
      break;
    }
    case 'support-resolve': {
      const record = findById('support', id);
      if (!record) return;
      record.status = 'Resolved';
      record.updatedAt = 'Just now';
      record.notes.unshift('Resolved by admin.');
      saveState();
      renderApp();
      showToast(`Ticket ${record.id} resolved.`);
      break;
    }
    default:
      break;
  }
}

function renderApp() {
  ensureAnalyticsLayout();
  setView(state.ui.currentView);

    const globalSearch = document.getElementById('global-search');
  if (globalSearch) globalSearch.value = state.ui.globalSearch;

  const globalSearchDesktop = document.getElementById('global-search-desktop');
  if (globalSearchDesktop) globalSearchDesktop.value = state.ui.globalSearch;

  renderOverview();
  renderApplications();
  renderMembers();
  renderAcademy();
  renderFederation();
  renderEconomy();
  renderPlazas();
  renderBroadcasts();
  renderSupport();
  renderAnalytics();
  renderSettings();
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextView = String(btn.dataset.view || '').trim();
      if (!nextView) return;

      setView(nextView);
      saveState();
    });
  });

  const mobileMoreToggle = document.getElementById('admin-mobile-more-toggle');
  if (mobileMoreToggle) {
    mobileMoreToggle.addEventListener('click', toggleAdminMobileMoreMenu);
  }

  const mobileMoreClose = document.getElementById('admin-mobile-more-close');
  if (mobileMoreClose) {
    mobileMoreClose.addEventListener('click', closeAdminMobileMoreMenu);
  }

  const mobileMoreBackdrop = document.getElementById('admin-mobile-more-backdrop');
  if (mobileMoreBackdrop) {
    mobileMoreBackdrop.addEventListener('click', closeAdminMobileMoreMenu);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAdminMobileMoreMenu();
    }
  });

    ['global-search', 'global-search-desktop'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener('input', (e) => {
      state.ui.globalSearch = e.target.value.trim();
      saveState();
      renderApp();
    });
  });

  [
    'applications-status-filter',
    'applications-division-filter',
    'members-division-filter',
    'members-status-filter',
    'academy-focus-filter',
    'academy-review-filter',
    'academy-lead-stage-filter',
    'academy-lead-scope-filter',
    'academy-lead-review-filter',
    'federation-lead-value-filter',
    'federation-lead-country-filter',
    'federation-request-status-filter',
    'economy-payment-provider-filter',
    'economy-payment-status-filter',
    'economy-payout-method-filter',
    'economy-payout-status-filter',
    'federation-deal-room-status-filter',
    'federation-status-filter',
    'federation-tag-filter',
    'plazas-type-filter',
    'plazas-status-filter',
    'support-status-filter'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderApp);
  });

  document.body.addEventListener('click', async (e) => {
    const jumpBtn = e.target.closest('[data-admin-jump-view]');
    const openBtn = e.target.closest('[data-open]');
    const actionBtn = e.target.closest('[data-action]');

    if (jumpBtn) {
      const nextView = String(jumpBtn.dataset.adminJumpView || '').trim();
      if (nextView) {
        setView(nextView);
        saveState();
      }
      return;
    }

    if (openBtn) {
      openDrawer(openBtn.dataset.open, openBtn.dataset.id);
      return;
    }

    if (actionBtn) {
      const action = String(actionBtn.dataset.action || '').trim();
      const id = String(actionBtn.dataset.id || '').trim();

      if (!action || !id) return;
      if (actionBtn.disabled || actionBtn.dataset.actionLocked === 'true') return;
      if (!beginAdminAction(action, id)) return;

      try {
        await handleAction(action, id);
      } finally {
        endAdminAction(action, id);
      }

      return;
    }
  });

    const closeDrawerBtn = document.getElementById('close-drawer-btn');
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', closeDrawer);
  }

  const drawerBackdrop = document.getElementById('drawer-backdrop');
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', closeDrawer);
  }

  const drawerStatusSelect = document.getElementById('drawer-status-select');
  if (drawerStatusSelect) {
    drawerStatusSelect.addEventListener('change', async (e) => {
      const select = e.target;
      const action = select.value;
      const id = select.dataset.id;

      if (!action || !id) return;

      if (!beginAdminAction(action, id)) {
        select.value = '';
        return;
      }

      select.disabled = true;

      try {
        await handleDrawerStatusChange(action, id);
      } finally {
        endAdminAction(action, id);
        select.disabled = false;
        select.value = '';
      }
    });
  }

  const drawerCopyEmailBtn = document.getElementById('drawer-copy-email-btn');
  if (drawerCopyEmailBtn) {
    drawerCopyEmailBtn.addEventListener('click', async () => {
      const email = drawerCopyEmailBtn.dataset.email || '';
      if (!email) return;

      const copied = await copyTextToClipboard(email);
      showToast(copied ? `Email copied: ${email}` : 'Failed to copy email.');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
const broadcastTemplate = document.getElementById('broadcast-template');
if (broadcastTemplate) {
  broadcastTemplate.addEventListener('change', () => {
    const subjectEl = document.getElementById('broadcast-subject');
    const messageEl = document.getElementById('broadcast-message');

    if (subjectEl) subjectEl.value = '';
    if (messageEl) messageEl.value = '';
  });
}

  const broadcastForm = document.getElementById('broadcast-form');
  if (broadcastForm) {
    broadcastForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const audienceEl = document.getElementById('broadcast-audience');
      const subjectEl = document.getElementById('broadcast-subject');
      const messageEl = document.getElementById('broadcast-message');

      const audience = audienceEl ? audienceEl.value : '';
      const subject = subjectEl ? subjectEl.value.trim() : '';
      const message = messageEl ? messageEl.value.trim() : '';

      if (!subject || !message) return;

      try {
        await adminFetchJson('/api/admin/broadcasts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audience,
            subject,
            message
          })
        });

        await loadAdminBootstrap();
        broadcastForm.reset();
        showToast(`Broadcast sent to ${audience}.`);
      } catch (error) {
        showToast(error.message || 'Failed to send broadcast.');
      }
    });
  }

  document.body.addEventListener('change', (e) => {
    const toggle = e.target.closest('[data-setting]');
    if (!toggle) return;

    state.settings[toggle.dataset.setting] = toggle.checked;
    saveState();
    renderOverview();
    showToast('Operational setting updated.');
  });


  ['export-state-btn', 'export-state-btn-desktop'].forEach(id => {
    const exportBtn = document.getElementById(id);
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'yh-admin-state.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('State exported.');
      });
    }
  });
  ['admin-logout-btn', 'admin-logout-btn-desktop'].forEach(id => {
  const logoutBtn = document.getElementById(id);
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutAdminSession);
  }
});
}

if (enforceAdminPanelAccess()) {
  bindEvents();
  loadAdminBootstrap();
}