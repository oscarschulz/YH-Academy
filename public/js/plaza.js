const defaultPlazaState = {
  stats: {
    activeMembers: 0,
    openOpportunities: 0,
    regions: 0,
    verifiedConnectors: 0
  },
  feed: [],
  directory: [],
  opportunities: [],
  regions: [],
  bridge: []
};


const externalPlazaState =
  window.__YH_PLAZA_STATE__ ||
  window.YH_PLAZA_STATE ||
  window.yhPlazaState ||
  null;

const PLAZA_REQUESTS_KEY = "yhPlazaRequestsCleanV1";
const PLAZA_FEED_CUSTOM_KEY = "yhPlazaCustomFeedCleanV1";
const PLAZA_UI_STATE_KEY = "yhPlazaUiStateCleanV1";
const PLAZA_INBOX_KEY = "yhPlazaInboxCleanV1";
const PLAZA_NOTIFICATIONS_KEY = "yhPlazaNotificationsCleanV1";
const PLAZA_CONVERSATIONS_KEY = "yhPlazaConversationsCleanV1";

let plazaServerFeedLoaded = false;
let plazaServerFeedItems = [];
let plazaFeedLoading = false;

let plazaServerOpportunitiesLoaded = false;
let plazaServerOpportunities = [];
let plazaOpportunitiesLoading = false;

let plazaServerDirectoryLoaded = false;
let plazaServerDirectory = [];
let plazaDirectoryLoading = false;

let plazaServerRegionsLoaded = false;
let plazaServerRegions = [];
let plazaRegionsLoading = false;

let plazaServerBridgeLoaded = false;
let plazaServerBridge = [];
let plazaBridgeLoading = false;

let plazaServerRequestsLoaded = false;
let plazaServerRequests = [];
let plazaRequestsLoading = false;

let plazaServerMessagesLoaded = false;
let plazaServerMessages = [];
let plazaMessagesLoading = false;
const OBJECTIVE_OPTIONS = [
  "Connection request",
  "Introduction",
  "Collaboration",
  "Partnership",
  "Access",
  "Hiring",
  "Support",
  "Project request",
  "Regional connection",
  "Bridge request"
];

const INBOX_ROLE_OPTIONS = [
  { key: "all", label: "All queues" },
  { key: "personal", label: "Personal" },
  { key: "project-owner", label: "Project Owner" },
  { key: "project-manager", label: "Project Manager" },
  { key: "hr", label: "HR" },
  { key: "plaza-ops", label: "Plaza Ops" },
  { key: "system-admin", label: "YH System Admin" }
];

const INCOMING_STATUS_FLOW = [
  "New",
  "Under Review",
  "Matched",
  "Conversation Opened",
  "Closed"
];
const PLAZA_APPLICATION_SCHEMA_VERSION = "plaza-typeform-clone-v1";

const PLAZA_MEMBERSHIP_LABELS = {
  academy: {
    title: "The Academy",
    memberLabel: "Academy member",
    joined: "When did you join The Academy approximately?",
    learnt: "What have you learnt so far in The Academy?",
    contribution: "What can you contribute as an Academy member?"
  },
  federation: {
    title: "The Federation",
    memberLabel: "Federation member",
    joined: "When did you join The Federation approximately?",
    learnt: "What have you learnt so far in The Federation?",
    contribution: "What can you contribute as a Federation member?"
  }
};
function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function titleCase(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizePlazaMoneyValue(value = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatPlazaCurrencyAmount(amount = 0, currency = "USD") {
  const numeric = normalizePlazaMoneyValue(amount);
  const cleanCurrency = String(currency || "USD").trim().toUpperCase() || "USD";

  if (!numeric) return "";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cleanCurrency,
      maximumFractionDigits: 0
    }).format(numeric);
  } catch (_) {
    return `${cleanCurrency} ${numeric}`;
  }
}

function formatPlazaMoneyRange(item = {}) {
  const currency = String(item.currency || "USD").trim().toUpperCase() || "USD";
  const min = normalizePlazaMoneyValue(item.budgetMin);
  const max = normalizePlazaMoneyValue(item.budgetMax);

  if (min && max && min !== max) {
    return `${formatPlazaCurrencyAmount(min, currency)} - ${formatPlazaCurrencyAmount(max, currency)}`;
  }

  if (max) return formatPlazaCurrencyAmount(max, currency);
  if (min) return formatPlazaCurrencyAmount(min, currency);

  return "";
}

function getPlazaOpportunityEconomyLabel(item = {}) {
  const mode = String(item.economyMode || "not_sure").trim().toLowerCase();

  const labels = {
    free: "Free / Signal",
    paid: "Paid",
    commission: "Commission",
    revenue_share: "Revenue Share",
    bounty: "Bounty",
    equity: "Equity",
    not_sure: "Economy TBD"
  };

  return labels[mode] || "Economy TBD";
}

function getPlazaOpportunityEscalationLabel(item = {}) {
  const mode = String(item.federationEscalation || "none").trim().toLowerCase();

  const labels = {
    none: "",
    academy_payout_signal: "Academy Payout Signal",
    federation_candidate: "Federation Candidate",
    federation_paid_intro: "Federation Paid Intro"
  };

  return labels[mode] || "";
}

function getPlazaOpportunityCommissionLabel(item = {}) {
  const rate = Math.min(100, normalizePlazaMoneyValue(item.commissionRate));

  if (!rate) return "";

  return `${rate}% commission`;
}

function getPlazaOpportunitySourceLabel(item = {}) {
  const source = String(item.sourceDivision || "plaza").trim().toLowerCase();

  if (source === "academy") return "Academy Signal";
  if (source === "federation") return "Federation Signal";
  if (source === "cross") return "Cross-Division Signal";

  return "Plaza Marketplace";
}

function getPlazaOpportunityPathClass(item = {}) {
  const escalation = String(item.federationEscalation || "none").trim().toLowerCase();
  const mode = String(item.economyMode || "not_sure").trim().toLowerCase();

  if (escalation === "federation_paid_intro") return "is-federation-path";
  if (escalation === "federation_candidate") return "is-federation-candidate";
  if (escalation === "academy_payout_signal") return "is-academy-payout-path";
  if (mode === "paid" || mode === "commission" || mode === "bounty" || mode === "revenue_share") return "is-marketplace-ready";

  return "is-marketplace-signal";
}

function getPlazaOpportunityPrimaryActionLabel(item = {}) {
  const escalation = String(item.federationEscalation || "none").trim().toLowerCase();
  const mode = String(item.economyMode || "not_sure").trim().toLowerCase();
  const objective = normalizeObjective(item.type || item.tag || "");

  if (escalation === "federation_paid_intro") return "Request Federation Paid Intro";
  if (escalation === "federation_candidate") return "Request Federation Screening";
  if (escalation === "academy_payout_signal") return "Open Academy Payout Path";
  if (objective === "Hiring") return "Apply Through Plaza";
  if (mode === "paid") return "Open Paid Opportunity";
  if (mode === "commission") return "Request Commission Deal";
  if (mode === "revenue_share") return "Request Revenue Share Path";
  if (mode === "bounty") return "Claim Bounty Path";
  if (mode === "equity") return "Request Equity Discussion";

  return item.action || "Open Opportunity Detail";
}

function getPlazaOpportunityRequestSourceType(item = {}) {
  const escalation = String(item.federationEscalation || "none").trim().toLowerCase();

  if (escalation === "federation_paid_intro" || escalation === "federation_candidate") {
    return "federation-escalation";
  }

  return "opportunity";
}

function getPlazaOpportunityRequestObjective(item = {}) {
  const escalation = String(item.federationEscalation || "none").trim().toLowerCase();
  const objective = normalizeObjective(item.type || item.tag || "");

  if (escalation === "federation_paid_intro") return "Introduction";
  if (escalation === "federation_candidate") return "Access";
  if (escalation === "academy_payout_signal") return "Project request";

  return objective === "Connection request" ? "Access" : objective;
}

function getPlazaOpportunityChipList(item = {}) {
  return [
    item.type,
    item.region,
    getPlazaOpportunityEconomyLabel(item),
    formatPlazaMoneyRange(item),
    getPlazaOpportunityCommissionLabel(item),
    getPlazaOpportunityEscalationLabel(item),
    getPlazaOpportunitySourceLabel(item),
    item.academySignalLabel
  ]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
}

function renderPlazaOpportunityChips(item = {}, extraChips = []) {
  return [
    ...getPlazaOpportunityChipList(item),
    ...safeArray(extraChips)
  ]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .map((entry) => `<span class="yh-plaza-opportunity-badge">${escapeHtml(entry)}</span>`)
    .join("");
}

function buildPlazaOpportunityEconomyContext(item = {}) {
  const economy = getPlazaOpportunityEconomyLabel(item);
  const moneyRange = formatPlazaMoneyRange(item);
  const commission = getPlazaOpportunityCommissionLabel(item);
  const escalation = getPlazaOpportunityEscalationLabel(item);
  const source = getPlazaOpportunitySourceLabel(item);

  return [
    economy ? `Economy: ${economy}` : "",
    moneyRange ? `Budget/price: ${moneyRange}` : "",
    commission ? `Commission: ${commission}` : "",
    escalation ? `Escalation: ${escalation}` : "",
    source ? `Source: ${source}` : ""
  ]
    .filter(Boolean)
    .join(" • ");
}

function renderPlazaOpportunityEconomyPanel(item = {}) {
  const moneyRange = formatPlazaMoneyRange(item);
  const commission = getPlazaOpportunityCommissionLabel(item);
  const escalation = getPlazaOpportunityEscalationLabel(item);
  const source = getPlazaOpportunitySourceLabel(item);
  const note = String(item.monetizationNote || "").trim();

  if (!moneyRange && !commission && !escalation && !note) {
    return "";
  }

  return `
    <div class="yh-plaza-economy-panel">
      <div class="yh-plaza-economy-panel-head">
        <span>Marketplace Economics</span>
        <strong>${escapeHtml(getPlazaOpportunityEconomyLabel(item))}</strong>
      </div>

      <div class="yh-plaza-economy-grid">
        <div class="yh-plaza-economy-item">
          <small>Budget / Price</small>
          <strong>${escapeHtml(moneyRange || "Not priced yet")}</strong>
        </div>

        <div class="yh-plaza-economy-item">
          <small>Commission</small>
          <strong>${escapeHtml(commission || "No commission set")}</strong>
        </div>

        <div class="yh-plaza-economy-item">
          <small>Escalation</small>
          <strong>${escapeHtml(escalation || "Plaza only")}</strong>
        </div>

        <div class="yh-plaza-economy-item">
          <small>Source</small>
          <strong>${escapeHtml(source)}</strong>
        </div>
      </div>

      ${
        note
          ? `<div class="yh-plaza-economy-note">${escapeHtml(note)}</div>`
          : ""
      }
    </div>
  `;
}

function buildPlazaOpportunityRequestMessage(item = {}) {
  const type = String(item.type || item.tag || "opportunity").trim();
  const region = String(item.region || "Global").trim();
  const title = String(item.title || "this opportunity").trim();
  const economyContext = buildPlazaOpportunityEconomyContext(item);
  const note = String(item.monetizationNote || "").trim();

  return [
    `I want to respond to this ${type.toLowerCase()} inside Plaza: ${title}.`,
    region ? `Region: ${region}.` : "",
    economyContext ? `Economy context: ${economyContext}.` : "",
    note ? `Monetization note: ${note}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function plazaApiFetch(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Plaza request failed.");
  }

  return result;
}

function normalizeServerFeedItem(item, index = 0) {
  return normalizeFeedItem({
    id: item?.id || `server-feed-${index + 1}`,
    type: item?.type || "introduction",
    member: item?.member || item?.authorName || "Hustler",
    source: item?.source || "plaza",
    division: item?.division || "both",
    region: item?.region || "Global",
    title: item?.title || "Plaza update",
    text: item?.text || item?.body || "",
    tag: item?.tag || titleCase(item?.type || "introduction"),
    action: item?.action || "Open"
  }, index);
}

async function loadPlazaFeedFromServer(options = {}) {
  if (plazaFeedLoading) return plazaServerFeedItems;

  plazaFeedLoading = true;

  if (plazaFeedGrid && options.silent !== true) {
    plazaFeedGrid.innerHTML = `<div class="yh-plaza-empty">Loading Plaza feed...</div>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/feed?limit=60");
    const feed = Array.isArray(result.feed) ? result.feed : [];

    plazaServerFeedItems = feed.map(normalizeServerFeedItem);
    plazaServerFeedLoaded = true;

    renderFeed(plazaRuntime.feedFilter || "all");
    return plazaServerFeedItems;
  } catch (error) {
    console.error("loadPlazaFeedFromServer error:", error);

    if (plazaFeedGrid) {
      plazaFeedGrid.innerHTML = `<div class="yh-plaza-empty">Could not load Plaza feed. Please refresh.</div>`;
    }

    return [];
  } finally {
    plazaFeedLoading = false;
  }
}

async function createPlazaFeedPost(payload = {}) {
  const result = await plazaApiFetch("/api/plaza/feed/posts", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const post = result.post ? normalizeServerFeedItem(result.post) : null;

  if (post) {
    plazaServerFeedItems = [
      post,
      ...plazaServerFeedItems.filter((item) => item.id !== post.id)
    ];
    plazaServerFeedLoaded = true;
  }

  return post;
}
function normalizeServerOpportunityItem(item, index = 0) {
  return normalizeOpportunityItem({
    id: item?.id || `server-opp-${index + 1}`,
    type: item?.type || "Opportunity",
    region: item?.region || "Global",
    title: item?.title || "Plaza opportunity",
    text: item?.text || item?.description || "",
    action: item?.action || "Open",

    economyMode: item?.economyMode || item?.compensationType || "not_sure",
    currency: item?.currency || "USD",
    budgetMin: item?.budgetMin || 0,
    budgetMax: item?.budgetMax || 0,
    commissionRate: item?.commissionRate || 0,
    federationEscalation: item?.federationEscalation || "none",
    monetizationNote: item?.monetizationNote || "",
    marketplaceMode: item?.marketplaceMode || "marketplace",
    sourceDivision: item?.sourceDivision || "plaza",
    sourceLeadId: item?.sourceLeadId || "",
    academySignalLabel: item?.academySignalLabel || ""
  }, index);
}

async function loadPlazaOpportunitiesFromServer(options = {}) {
  if (plazaOpportunitiesLoading) return plazaServerOpportunities;

  plazaOpportunitiesLoading = true;

  if (plazaOpportunityGrid && options.silent !== true) {
    plazaOpportunityGrid.innerHTML = `<div class="yh-plaza-empty">Loading Plaza opportunities...</div>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/opportunities?limit=80");
    const items = Array.isArray(result.opportunities) ? result.opportunities : [];

    plazaServerOpportunities = items.map(normalizeServerOpportunityItem);
    plazaServerOpportunitiesLoaded = true;

    renderOpportunities();
    return plazaServerOpportunities;
  } catch (error) {
    console.error("loadPlazaOpportunitiesFromServer error:", error);

    if (plazaOpportunityGrid) {
      plazaOpportunityGrid.innerHTML = `<div class="yh-plaza-empty">Could not load Plaza opportunities. Please refresh.</div>`;
    }

    return [];
  } finally {
    plazaOpportunitiesLoading = false;
  }
}

async function createPlazaOpportunity(payload = {}) {
  const result = await plazaApiFetch("/api/plaza/opportunities", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const opportunity = result.opportunity
    ? normalizeServerOpportunityItem(result.opportunity)
    : null;

  if (opportunity) {
    plazaServerOpportunities = [
      opportunity,
      ...plazaServerOpportunities.filter((item) => item.id !== opportunity.id)
    ];
    plazaServerOpportunitiesLoaded = true;
  }

  return opportunity;
}
function normalizeServerDirectoryItem(item, index = 0) {
  return normalizeDirectoryItem({
    id: item?.id || `server-member-${index + 1}`,
    name: item?.name || item?.authorName || "Hustler",
    region: item?.region || "Global",
    division: item?.division || "academy",
    source: item?.source || item?.division || "academy",
    trust: item?.trust || "verified",
    role: item?.role || "Member",
    focus: item?.focus || "",
    tags: Array.isArray(item?.tags) ? item.tags : [],
    lookingFor: item?.lookingFor || item?.looking_for || [],
    canOffer: item?.canOffer || item?.can_offer || [],
    availability: item?.availability || "",
    workMode: item?.workMode || item?.work_mode || "",
    marketplaceMode: item?.marketplaceMode || item?.marketplace_mode || "no"
  }, index);
}

async function loadPlazaDirectoryFromServer(options = {}) {
  if (plazaDirectoryLoading) return plazaServerDirectory;

  plazaDirectoryLoading = true;

  if (plazaDirectoryGrid && options.silent !== true) {
    plazaDirectoryGrid.innerHTML = `<div class="yh-plaza-empty">Loading Plaza directory...</div>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/directory?limit=160");
    const items = Array.isArray(result.directory) ? result.directory : [];

    plazaServerDirectory = items.map(normalizeServerDirectoryItem);
    plazaServerDirectoryLoaded = true;

    populateRegionFilter();
    renderDirectory();
    return plazaServerDirectory;
  } catch (error) {
    console.error("loadPlazaDirectoryFromServer error:", error);

    if (plazaDirectoryGrid) {
      plazaDirectoryGrid.innerHTML = `<div class="yh-plaza-empty">Could not load Plaza directory. Please refresh.</div>`;
    }

    return [];
  } finally {
    plazaDirectoryLoading = false;
  }
}

async function savePlazaDirectoryProfile(payload = {}) {
  const result = await plazaApiFetch("/api/plaza/directory/profile", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const profile = result.profile ? normalizeServerDirectoryItem(result.profile) : null;

  if (profile) {
    plazaServerDirectory = [
      profile,
      ...plazaServerDirectory.filter((item) => item.id !== profile.id)
    ];
    plazaServerDirectoryLoaded = true;
    writePlazaDirectoryStatusCache(profile, { source: "manual" });
  }

  return profile;
}
function normalizeServerRegionItem(item, index = 0) {
  return normalizeRegionItem({
    id: item?.id || `server-region-${index + 1}`,
    region: item?.region || item?.name || "Global",
    count: Number(item?.count || 0),
    label: item?.label || "Region Hub",
    text: item?.text || item?.description || ""
  }, index);
}

async function loadPlazaRegionsFromServer(options = {}) {
  if (plazaRegionsLoading) return plazaServerRegions;

  plazaRegionsLoading = true;

  if (plazaRegionGrid && options.silent !== true) {
    plazaRegionGrid.innerHTML = `<div class="yh-plaza-empty">Loading Plaza regions...</div>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/regions?limit=120");
    const items = Array.isArray(result.regions) ? result.regions : [];

    plazaServerRegions = items.map(normalizeServerRegionItem);
    plazaServerRegionsLoaded = true;

    renderRegions();
    return plazaServerRegions;
  } catch (error) {
    console.error("loadPlazaRegionsFromServer error:", error);

    if (plazaRegionGrid) {
      plazaRegionGrid.innerHTML = `<div class="yh-plaza-empty">Could not load Plaza regions. Please refresh.</div>`;
    }

    return [];
  } finally {
    plazaRegionsLoading = false;
  }
}

async function createPlazaRegion(payload = {}) {
  const result = await plazaApiFetch("/api/plaza/regions", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const region = result.region ? normalizeServerRegionItem(result.region) : null;

  if (region) {
    plazaServerRegions = [
      region,
      ...plazaServerRegions.filter((item) => item.id !== region.id)
    ];
    plazaServerRegionsLoaded = true;
  }

  return region;
}
function normalizeServerBridgeItem(item, index = 0) {
  return normalizeBridgeItem({
    id: item?.id || `server-bridge-${index + 1}`,
    stage: item?.stage || "Bridge Path",
    left: item?.left || "academy",
    right: item?.right || "federation",
    region: item?.region || "Global",
    title: item?.title || "Bridge signal",
    text: item?.text || item?.description || "",
    nextStep: item?.nextStep || "Review and decide the next structured move.",
    action: item?.action || "Open Bridge Detail"
  }, index);
}

async function loadPlazaBridgeFromServer(options = {}) {
  if (plazaBridgeLoading) return plazaServerBridge;

  plazaBridgeLoading = true;

  if (plazaBridgeGrid && options.silent !== true) {
    plazaBridgeGrid.innerHTML = `<div class="yh-plaza-empty">Loading Plaza bridge paths...</div>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/bridge?limit=120");
    const items = Array.isArray(result.bridge) ? result.bridge : [];

    plazaServerBridge = items.map(normalizeServerBridgeItem);
    plazaServerBridgeLoaded = true;

    renderBridge();
    return plazaServerBridge;
  } catch (error) {
    console.error("loadPlazaBridgeFromServer error:", error);

    if (plazaBridgeGrid) {
      plazaBridgeGrid.innerHTML = `<div class="yh-plaza-empty">Could not load Plaza bridge paths. Please refresh.</div>`;
    }

    return [];
  } finally {
    plazaBridgeLoading = false;
  }
}

async function createPlazaBridge(payload = {}) {
  const result = await plazaApiFetch("/api/plaza/bridge", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const bridgePath = result.bridgePath ? normalizeServerBridgeItem(result.bridgePath) : null;

  if (bridgePath) {
    plazaServerBridge = [
      bridgePath,
      ...plazaServerBridge.filter((item) => item.id !== bridgePath.id)
    ];
    plazaServerBridgeLoaded = true;
  }

  return bridgePath;
}
function normalizeServerRequestItem(item, index = 0) {
  return normalizeRequestItem({
    id: item?.id || `server-request-${index + 1}`,
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
    resolvedAt: item?.resolvedAt || "",
    status: item?.status || "Submitted",
    sourceType: item?.sourceType || "general",
    targetId: item?.targetId || "",
    targetLabel: item?.targetLabel || "General Plaza request",
    context: item?.context || "",
    region: item?.region || "",
    name: item?.name || item?.authorName || "Hustler",
    objective: item?.objective || "Connection request",
    message: item?.message || "",
    routeKey: item?.routeKey || item?.sourceType || "general",
    routeLabel: item?.routeLabel || item?.targetLabel || "General Plaza request",
    headline: item?.headline || "",
    experience: item?.experience || "",
    portfolioLink: item?.portfolioLink || "",
    attachmentMeta: Array.isArray(item?.attachmentMeta) ? item.attachmentMeta : [],
    matchedEntityLabels: Array.isArray(item?.matchedEntityLabels) ? item.matchedEntityLabels : [],
    decisionSummary: item?.decisionSummary || "",
    resolutionSummary: item?.resolutionSummary || "",
    statusHistory: Array.isArray(item?.statusHistory) ? item.statusHistory : []
  }, index);
}

async function loadPlazaRequestsFromServer(options = {}) {
  if (plazaRequestsLoading) return plazaServerRequests;

  plazaRequestsLoading = true;

  if (plazaRequestsScreenList && options.silent !== true) {
    plazaRequestsScreenList.innerHTML = `<div class="yh-plaza-empty">Loading Plaza requests...</div>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/requests?limit=160");
    const items = Array.isArray(result.requests) ? result.requests : [];

    plazaServerRequests = items.map(normalizeServerRequestItem);
    plazaServerRequestsLoaded = true;

    renderRequestsPreview();
    renderRequestsScreen();
    return plazaServerRequests;
  } catch (error) {
    console.error("loadPlazaRequestsFromServer error:", error);

    if (plazaRequestsScreenList) {
      plazaRequestsScreenList.innerHTML = `<div class="yh-plaza-empty">Could not load Plaza requests. Please refresh.</div>`;
    }

    return [];
  } finally {
    plazaRequestsLoading = false;
  }
}

async function createPlazaRequest(payload = {}) {
  const result = await plazaApiFetch("/api/plaza/requests", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const request = result.request ? normalizeServerRequestItem(result.request) : null;

  if (request) {
    plazaServerRequests = [
      request,
      ...plazaServerRequests.filter((item) => item.id !== request.id)
    ];
    plazaServerRequestsLoaded = true;
  }

  return request;
}

async function advancePlazaRequestStatus(requestId = "") {
  const cleanId = String(requestId || "").trim();
  if (!cleanId) return null;

  const result = await plazaApiFetch(`/api/plaza/requests/${encodeURIComponent(cleanId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({})
  });

  const request = result.request ? normalizeServerRequestItem(result.request) : null;

  if (request) {
    plazaServerRequests = plazaServerRequests.map((item) => (
      item.id === request.id ? request : item
    ));
    plazaServerRequestsLoaded = true;
  }

  return request;
}

async function deletePlazaRequestFromServer(requestId = "") {
  const cleanId = String(requestId || "").trim();
  if (!cleanId) return false;

  await plazaApiFetch(`/api/plaza/requests/${encodeURIComponent(cleanId)}`, {
    method: "DELETE"
  });

  plazaServerRequests = plazaServerRequests.filter((item) => item.id !== cleanId);
  plazaServerRequestsLoaded = true;

  return true;
}
function normalizeServerConversationItem(item, index = 0) {
  return normalizeConversationItem({
    id: item?.id || `server-conversation-${index + 1}`,
    title: item?.title || "Plaza conversation",
    queueRole: item?.queueRole || "personal",
    linkedRequestId: item?.linkedRequestId || "",
    linkedInboxId: item?.linkedInboxId || "",
    targetLabel: item?.targetLabel || "Plaza",
    contextTitle: item?.contextTitle || "",
    contextRoute: item?.contextRoute || "Plaza conversation",
    participants: Array.isArray(item?.participants) ? item.participants : [],
    status: item?.status || "active",
    messages: Array.isArray(item?.messages) ? item.messages : [],
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString()
  }, index);
}

async function loadPlazaMessagesFromServer(options = {}) {
  if (plazaMessagesLoading) return plazaServerMessages;

  plazaMessagesLoading = true;

  if (plazaMessagesList && options.silent !== true) {
    plazaMessagesList.innerHTML = `<div class="yh-plaza-empty">Loading Plaza messages...</div>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/messages?limit=160");
    const items = Array.isArray(result.conversations) ? result.conversations : [];

    plazaServerMessages = items.map(normalizeServerConversationItem);
    plazaServerMessagesLoaded = true;

    renderMessagesScreen();
    return plazaServerMessages;
  } catch (error) {
    console.error("loadPlazaMessagesFromServer error:", error);

    if (plazaMessagesList) {
      plazaMessagesList.innerHTML = `<div class="yh-plaza-empty">Could not load Plaza messages. Please refresh.</div>`;
    }

    return [];
  } finally {
    plazaMessagesLoading = false;
  }
}

async function createPlazaConversationFromRequest(requestId = "") {
  const cleanId = String(requestId || "").trim();
  if (!cleanId) return null;

  const result = await plazaApiFetch(`/api/plaza/messages/from-request/${encodeURIComponent(cleanId)}`, {
    method: "POST",
    body: JSON.stringify({})
  });

  const conversation = result.conversation
    ? normalizeServerConversationItem(result.conversation)
    : null;

  if (conversation) {
    plazaServerMessages = [
      conversation,
      ...plazaServerMessages.filter((item) => item.id !== conversation.id)
    ];
    plazaServerMessagesLoaded = true;
  }

  return conversation;
}

async function sendPlazaConversationReply(conversationId = "", text = "") {
  const cleanId = String(conversationId || "").trim();
  const cleanText = String(text || "").trim();

  if (!cleanId || !cleanText) return null;

  const result = await plazaApiFetch(`/api/plaza/messages/${encodeURIComponent(cleanId)}/replies`, {
    method: "POST",
    body: JSON.stringify({
      text: cleanText
    })
  });

  const conversation = result.conversation
    ? normalizeServerConversationItem(result.conversation)
    : null;

  if (conversation) {
    plazaServerMessages = plazaServerMessages.map((item) => (
      item.id === conversation.id ? conversation : item
    ));

    if (!plazaServerMessages.some((item) => item.id === conversation.id)) {
      plazaServerMessages.unshift(conversation);
    }

    plazaServerMessagesLoaded = true;
  }

  return conversation;
}
function normalizeDivision(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "academy" || raw === "yha") return "academy";
  if (raw === "federation" || raw === "yhf") return "federation";
  if (raw === "both" || raw === "cross" || raw === "plaza") return "both";
  return "academy";
}

function normalizeSource(value, fallbackDivision) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "academy" || raw === "yha") return "academy";
  if (raw === "federation" || raw === "yhf") return "federation";
  if (raw === "cross" || raw === "both" || raw === "plaza") return "cross";
  return fallbackDivision === "both" ? "cross" : fallbackDivision;
}

function normalizeTrust(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "leader" || raw === "local leader") return "leader";
  if (raw === "connector" || raw === "trusted connector") return "connector";
  return "verified";
}

function normalizeBridgeLane(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "academy" || raw === "yha") return "academy";
  if (raw === "federation" || raw === "yhf") return "federation";
  if (raw === "both" || raw === "cross" || raw === "plaza") return "both";
  return "academy";
}

function normalizeFeedItem(item, index) {
  const division = normalizeDivision(item?.division);
  const source = normalizeSource(item?.source, division);
  const type = String(item?.type || "introduction").trim().toLowerCase();
  return {
    id: item?.id || `feed-${index + 1}`,
    type,
    member: String(item?.member || "Unknown member"),
    source,
    division,
    region: String(item?.region || "Unknown region"),
    title: String(item?.title || "Plaza update"),
    text: String(item?.text || "No activity copy provided yet."),
    tag: String(item?.tag || titleCase(type)),
    action: String(item?.action || "Open")
  };
}

function normalizeDirectoryItem(item, index) {
  const division = normalizeDivision(item?.division);
  const source = normalizeSource(item?.source, division);

  const normalizeSignalList = (value) => {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 8);
    }

    return String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 8);
  };

  return {
    id: item?.id || `member-${index + 1}`,
    name: String(item?.name || "Unnamed member"),
    region: String(item?.region || "Unknown region"),
    division,
    source,
    trust: normalizeTrust(item?.trust),
    role: String(item?.role || "Member"),
    focus: String(item?.focus || "No focus added yet."),
    tags: safeArray(item?.tags).map((tag) => String(tag)),
    lookingFor: normalizeSignalList(item?.lookingFor || item?.looking_for),
    canOffer: normalizeSignalList(item?.canOffer || item?.can_offer),
    availability: String(item?.availability || ""),
    workMode: String(item?.workMode || item?.work_mode || ""),
    marketplaceMode: String(item?.marketplaceMode || item?.marketplace_mode || "no").toLowerCase() === "yes" ? "yes" : "no"
  };
}

function normalizeOpportunityItem(item, index) {
  return {
    id: item?.id || `opp-${index + 1}`,
    type: String(item?.type || "Opportunity"),
    region: String(item?.region || "Unknown region"),
    title: String(item?.title || "New opportunity"),
    text: String(item?.text || "No opportunity details yet."),
    action: String(item?.action || "Open"),

    economyMode: String(item?.economyMode || "not_sure"),
    currency: String(item?.currency || "USD").trim().toUpperCase() || "USD",
    budgetMin: normalizePlazaMoneyValue(item?.budgetMin),
    budgetMax: normalizePlazaMoneyValue(item?.budgetMax),
    commissionRate: normalizePlazaMoneyValue(item?.commissionRate),
    federationEscalation: String(item?.federationEscalation || "none"),
    monetizationNote: String(item?.monetizationNote || ""),
    marketplaceMode: String(item?.marketplaceMode || "marketplace"),
    sourceDivision: String(item?.sourceDivision || "plaza"),
    sourceLeadId: String(item?.sourceLeadId || ""),
    academySignalLabel: String(item?.academySignalLabel || "")
  };
}

function normalizeRegionItem(item, index) {
  return {
    id: item?.id || `region-${index + 1}`,
    region: String(item?.region || "Unknown region"),
    count: Number(item?.count || 0),
    label: String(item?.label || "Region Hub"),
    text: String(item?.text || "No region details yet.")
  };
}

function normalizeBridgeItem(item, index) {
  return {
    id: item?.id || `bridge-${index + 1}`,
    stage: String(item?.stage || "Bridge Path"),
    left: normalizeBridgeLane(item?.left),
    right: normalizeBridgeLane(item?.right),
    region: String(item?.region || "Unknown region"),
    title: String(item?.title || "Bridge signal"),
    text: String(item?.text || "No bridge details yet."),
    nextStep: String(item?.nextStep || "Review and decide the next structured move."),
    action: String(item?.action || "Open Bridge")
  };
}

function normalizeRequestItem(item, index) {
  const objective = normalizeObjective(item?.objective || item?.goal || "Connection request");
  const status = normalizeRequestStatus(item?.status || "Submitted");

  return {
    id: item?.id || `req-${index + 1}`,
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString(),
    resolvedAt: item?.resolvedAt || "",
    status,
    sourceType: String(item?.sourceType || "general"),
    targetId: String(item?.targetId || ""),
    targetLabel: String(item?.targetLabel || "General Plaza request"),
    context: String(item?.context || ""),
    region: String(item?.region || ""),
    name: String(item?.name || "Unknown requester"),
    objective,
    message: String(item?.message || ""),
    routeKey: String(item?.routeKey || ""),
    routeLabel: String(item?.routeLabel || ""),
    headline: String(item?.headline || ""),
    experience: String(item?.experience || ""),
    portfolioLink: String(item?.portfolioLink || ""),
    attachmentMeta: safeArray(item?.attachmentMeta).map(normalizeAttachmentMeta),
    matchedEntityLabels: safeArray(item?.matchedEntityLabels).map((entry) => String(entry)),
    decisionSummary: String(item?.decisionSummary || ""),
    resolutionSummary: String(item?.resolutionSummary || ""),
    statusHistory: safeArray(item?.statusHistory).length
      ? safeArray(item?.statusHistory).map((entry) => ({
          status: normalizeRequestStatus(entry?.status),
          at: entry?.at || new Date().toISOString()
        }))
      : [
          {
            status,
            at: item?.createdAt || new Date().toISOString()
          }
        ]
  };
}

function deriveStats(state) {
  const regions = new Set();
  const connectors = new Set();

  state.directory.forEach((member) => {
    if (member.region) regions.add(member.region);
    if (member.trust === "connector") connectors.add(member.name);
  });

  state.feed.forEach((item) => {
    if (item.region) regions.add(item.region);
  });

  state.bridge.forEach((item) => {
    if (item.region) regions.add(item.region);
  });

  return {
    activeMembers: state.directory.length,
    openOpportunities: state.opportunities.length,
    regions: regions.size,
    verifiedConnectors: connectors.size
  };
}

function buildPlazaState(inputState) {
  const seed = inputState || defaultPlazaState;
  const state = {
    stats: { ...(seed.stats || {}) },
    feed: safeArray(seed.feed).map(normalizeFeedItem),
    directory: safeArray(seed.directory).map(normalizeDirectoryItem),
    opportunities: safeArray(seed.opportunities).map(normalizeOpportunityItem),
    regions: safeArray(seed.regions).map(normalizeRegionItem),
    bridge: safeArray(seed.bridge).map(normalizeBridgeItem)
  };

  const derived = deriveStats(state);
  state.stats = {
    activeMembers: Number(state.stats.activeMembers || derived.activeMembers),
    openOpportunities: Number(state.stats.openOpportunities || derived.openOpportunities),
    regions: Number(state.stats.regions || derived.regions),
    verifiedConnectors: Number(state.stats.verifiedConnectors || derived.verifiedConnectors)
  };

  return state;
}

function loadStoredRequests(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return safeArray(parsed).map(normalizeRequestItem);
  } catch (error) {
    return [];
  }
}

function persistStoredRequests(storageKey, requests) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(requests));
  } catch (error) {
    // no-op
  }
}

function loadStoredFeed(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return safeArray(parsed).map(normalizeFeedItem);
  } catch (error) {
    return [];
  }
}

function persistStoredFeed(storageKey, feedItems) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(feedItems));
  } catch (error) {
    // no-op
  }
}

function loadStoredUiState(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function persistStoredUiState(storageKey, state) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    // no-op
  }
}

function normalizeAttachmentMeta(item, index) {
  return {
    id: item?.id || `attachment-${index + 1}`,
    name: String(item?.name || "Attachment"),
    sizeLabel: String(item?.sizeLabel || "Pending size"),
    typeLabel: String(item?.typeLabel || "Unknown type")
  };
}

function normalizeQueueRole(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "project-owner" || raw === "project owner") return "project-owner";
  if (raw === "project-manager" || raw === "project manager") return "project-manager";
  if (raw === "hr") return "hr";
  if (raw === "plaza-ops" || raw === "plaza ops") return "plaza-ops";
  if (raw === "system-admin" || raw === "system admin" || raw === "yh system admin") return "system-admin";
  return "personal";
}

function getQueueRoleLabel(role) {
  const normalized = normalizeQueueRole(role);

  if (normalized === "project-owner") return "Project Owner";
  if (normalized === "project-manager") return "Project Manager";
  if (normalized === "hr") return "HR";
  if (normalized === "plaza-ops") return "Plaza Ops";
  if (normalized === "system-admin") return "YH System Admin";
  return "Personal";
}

function normalizeIncomingStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "under review" || raw === "review") return "Under Review";
  if (raw === "matched") return "Matched";
  if (raw === "conversation opened" || raw === "conversation") return "Conversation Opened";
  if (raw === "closed") return "Closed";
  return "New";
}

function normalizeIncomingKind(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "application") return "application";
  if (raw === "support-note" || raw === "support note") return "support-note";
  return "request";
}

function normalizeNotificationStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "read") return "read";
  return "unread";
}

function normalizeConversationMessage(item, index) {
  return {
    id: item?.id || `message-${index + 1}`,
    sender: String(item?.sender || "System"),
    type: String(item?.type || "message"),
    text: String(item?.text || ""),
    createdAt: item?.createdAt || new Date().toISOString()
  };
}

function normalizeIncomingItem(item, index) {
  return {
    id: item?.id || `incoming-${index + 1}`,
    kind: normalizeIncomingKind(item?.kind || "request"),
    linkedRequestId: String(item?.linkedRequestId || ""),
    conversationId: String(item?.conversationId || ""),
    queueRole: normalizeQueueRole(item?.queueRole || "personal"),
    title: String(item?.title || "Incoming Plaza item"),
    summary: String(item?.summary || ""),
    senderName: String(item?.senderName || "Unknown sender"),
    targetLabel: String(item?.targetLabel || "Plaza"),
    targetId: String(item?.targetId || ""),
    sourceType: String(item?.sourceType || "general"),
    objective: normalizeObjective(item?.objective || "Connection request"),
    region: String(item?.region || ""),
    context: String(item?.context || ""),
    routeLabel: String(item?.routeLabel || ""),
    status: normalizeIncomingStatus(item?.status || "New"),
    attachments: safeArray(item?.attachments).map(normalizeAttachmentMeta),
    headline: String(item?.headline || ""),
    experience: String(item?.experience || ""),
    portfolioLink: String(item?.portfolioLink || ""),
    decisionNote: String(item?.decisionNote || ""),
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString()
  };
}

function normalizeNotificationItem(item, index) {
  return {
    id: item?.id || `notification-${index + 1}`,
    title: String(item?.title || "Plaza notification"),
    text: String(item?.text || ""),
    audienceRole: item?.audienceRole === "all" ? "all" : normalizeQueueRole(item?.audienceRole || "personal"),
    relatedType: String(item?.relatedType || "general"),
    relatedId: String(item?.relatedId || ""),
    status: normalizeNotificationStatus(item?.status || "unread"),
    createdAt: item?.createdAt || new Date().toISOString()
  };
}

function normalizeConversationItem(item, index) {
  return {
    id: item?.id || `conversation-${index + 1}`,
    title: String(item?.title || "Plaza conversation"),
    queueRole: normalizeQueueRole(item?.queueRole || "personal"),
    linkedRequestId: String(item?.linkedRequestId || ""),
    linkedInboxId: String(item?.linkedInboxId || ""),
    targetLabel: String(item?.targetLabel || "Plaza"),
    contextTitle: String(item?.contextTitle || ""),
    contextRoute: String(item?.contextRoute || ""),
    participants: safeArray(item?.participants).map((entry) => String(entry)),
    status: String(item?.status || "active"),
    messages: safeArray(item?.messages).map(normalizeConversationMessage),
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString()
  };
}

function loadStoredInbox(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return safeArray(parsed).map(normalizeIncomingItem);
  } catch (error) {
    return [];
  }
}

function persistStoredInbox(storageKey, inboxItems) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(inboxItems));
  } catch (error) {
    // no-op
  }
}

function loadStoredNotifications(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return safeArray(parsed).map(normalizeNotificationItem);
  } catch (error) {
    return [];
  }
}

function persistStoredNotifications(storageKey, notifications) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(notifications));
  } catch (error) {
    // no-op
  }
}

function loadStoredConversations(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return safeArray(parsed).map(normalizeConversationItem);
  } catch (error) {
    return [];
  }
}

function persistStoredConversations(storageKey, conversations) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(conversations));
  } catch (error) {
    // no-op
  }
}

function buildAttachmentMeta(file) {
  if (!(file instanceof File) || !file.name) {
    return null;
  }

  const sizeKb = file.size ? Math.max(1, Math.round(file.size / 1024)) : 0;

  return {
    id: `attachment-${Date.now()}`,
    name: file.name,
    sizeLabel: sizeKb ? `${sizeKb} KB` : "Unknown size",
    typeLabel: file.type || "Unknown type"
  };
}

function getQueueRoleForRequest(request, extraMeta = {}) {
  if (extraMeta.forceQueueRole) {
    return normalizeQueueRole(extraMeta.forceQueueRole);
  }

  const sourceType = String(request?.sourceType || "").trim().toLowerCase();
  const objective = normalizeObjective(request?.objective || "Connection request");
  const context = String(request?.context || "").trim().toLowerCase();

  if (extraMeta.kind === "support-note") return "personal";
  if (objective === "Hiring" || context.includes("hiring")) return "hr";
  if (sourceType === "project" || objective === "Project request" || objective === "Collaboration") return "project-manager";
  if (objective === "Partnership" || objective === "Access") return "project-owner";
  if (sourceType === "member-screened" || sourceType === "member-bridge" || sourceType === "bridge" || objective === "Bridge request" || objective === "Regional connection") return "plaza-ops";
  if (sourceType === "member-connection" || sourceType === "feed-introduction") return "personal";
  if (sourceType === "general" && !String(request?.targetId || "").trim()) return "plaza-ops";
  return "personal";
}

function buildInboxTitleFromRequest(request, kind) {
  const targetLabel = String(request?.targetLabel || "Plaza");
  const objective = normalizeObjective(request?.objective || "Connection request");

  if (kind === "application") {
    return `Application for ${targetLabel}`;
  }

  if (objective === "Project request") {
    return `Project request for ${targetLabel}`;
  }

  if (objective === "Regional connection") {
    return `Regional request for ${targetLabel}`;
  }

  if (objective === "Bridge request") {
    return `Bridge request for ${targetLabel}`;
  }

  return `${objective} for ${targetLabel}`;
}

function createLocalPlazaOpsAdapter({
  inboxStorageKey,
  notificationStorageKey,
  conversationStorageKey
}) {
  let inboxItems = loadStoredInbox(inboxStorageKey);
  let notifications = loadStoredNotifications(notificationStorageKey);
  let conversations = loadStoredConversations(conversationStorageKey);

  function persistAll() {
    persistStoredInbox(inboxStorageKey, inboxItems);
    persistStoredNotifications(notificationStorageKey, notifications);
    persistStoredConversations(conversationStorageKey, conversations);
  }

  function createNotification(payload) {
    const item = normalizeNotificationItem({
      id: `notification-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      ...payload
    }, 0);

    notifications.unshift(item);
    persistStoredNotifications(notificationStorageKey, notifications);
    return item;
  }

  function syncIncomingStatusFromRequest(request) {
    const linkedRequestId = String(request?.id || "");
    if (!linkedRequestId) return null;

    const inboxItem = inboxItems.find((item) => item.linkedRequestId === linkedRequestId);
    if (!inboxItem) return null;

    const requestStatus = normalizeRequestStatus(request.status);
    const nextIncomingStatus =
      requestStatus === "Under Review"
        ? "Under Review"
        : requestStatus === "Matched"
          ? "Matched"
          : requestStatus === "Closed"
            ? "Closed"
            : "New";

    inboxItem.status = nextIncomingStatus;
    inboxItem.updatedAt = new Date().toISOString();
    persistStoredInbox(inboxStorageKey, inboxItems);
    return normalizeIncomingItem(inboxItem, 0);
  }

  return {
    getInbox(filters = {}) {
      const roleValue = String(filters.role || "all");
      return inboxItems
        .filter((item) => roleValue === "all" || item.queueRole === roleValue)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .map((item) => normalizeIncomingItem(item, 0));
    },
    getInboxById(id) {
      const item = inboxItems.find((entry) => entry.id === id);
      return item ? normalizeIncomingItem(item, 0) : null;
    },
    getInboxByRequestId(requestId) {
      const item = inboxItems.find((entry) => entry.linkedRequestId === requestId);
      return item ? normalizeIncomingItem(item, 0) : null;
    },
    removeIncomingByRequestId(requestId) {
      const before = inboxItems.length;
      inboxItems = inboxItems.filter((item) => item.linkedRequestId !== requestId || !!item.conversationId);
      if (before !== inboxItems.length) {
        persistStoredInbox(inboxStorageKey, inboxItems);
      }
    },
    upsertIncomingFromRequest(request, extraMeta = {}) {
      if (!request || normalizeRequestStatus(request.status) === "Draft") {
        return null;
      }

      const now = new Date().toISOString();
      const existing = inboxItems.find((item) => item.linkedRequestId === request.id);
      const kind =
        normalizeIncomingKind(extraMeta.kind || (normalizeObjective(request.objective) === "Hiring" ? "application" : "request"));
      const queueRole = getQueueRoleForRequest(request, extraMeta);
      const queueLabel = getQueueRoleLabel(queueRole);
      const nextStatus =
        normalizeRequestStatus(request.status) === "Under Review"
          ? "Under Review"
          : normalizeRequestStatus(request.status) === "Matched"
            ? "Matched"
            : normalizeRequestStatus(request.status) === "Closed"
              ? "Closed"
              : "New";

      const nextItem = normalizeIncomingItem({
        id: existing?.id || `incoming-${Date.now()}`,
        kind,
        linkedRequestId: request.id,
        conversationId: existing?.conversationId || "",
        queueRole,
        title: buildInboxTitleFromRequest(request, kind),
        summary: request.message || "No request message added.",
        senderName: request.name,
        targetLabel: request.targetLabel,
        targetId: request.targetId,
        sourceType: request.sourceType,
        objective: request.objective,
        region: request.region,
        context: request.context,
        routeLabel: request.routeLabel || getRequestRouteLabel(request.sourceType, request.objective),
        status: nextStatus,
        attachments: safeArray(request.attachmentMeta || extraMeta.attachments).map(normalizeAttachmentMeta),
        headline: String(request.headline || extraMeta.headline || ""),
        experience: String(request.experience || extraMeta.experience || ""),
        portfolioLink: String(request.portfolioLink || extraMeta.portfolioLink || ""),
        decisionNote: existing?.decisionNote || "",
        createdAt: existing?.createdAt || now,
        updatedAt: now
      }, 0);

      if (existing) {
        const index = inboxItems.findIndex((item) => item.id === existing.id);
        inboxItems[index] = nextItem;
      } else {
        inboxItems.unshift(nextItem);
      }

      persistStoredInbox(inboxStorageKey, inboxItems);

      createNotification({
        title: nextItem.title,
        text: `New ${kind === "application" ? "application" : "incoming request"} landed in ${queueLabel}.`,
        audienceRole: queueRole,
        relatedType: "inbox",
        relatedId: nextItem.id
      });

      createNotification({
        title: "Request submitted",
        text: `${nextItem.routeLabel} was sent toward ${queueLabel}.`,
        audienceRole: "personal",
        relatedType: "request",
        relatedId: request.id
      });

      return nextItem;
    },
    createSupportNote(payload) {
      const now = new Date().toISOString();
      const item = normalizeIncomingItem({
        id: `incoming-${Date.now()}`,
        kind: "support-note",
        queueRole: "personal",
        title: `Support note for ${payload.member}`,
        summary: payload.message,
        senderName: payload.name,
        targetLabel: payload.member,
        sourceType: "support-note",
        objective: "Support",
        context: payload.context || "Plaza win",
        routeLabel: "Support note delivery",
        status: "New",
        createdAt: now,
        updatedAt: now
      }, 0);

      inboxItems.unshift(item);
      persistStoredInbox(inboxStorageKey, inboxItems);

      createNotification({
        title: `Support note from ${payload.name}`,
        text: `A support note was delivered to ${payload.member}.`,
        audienceRole: "personal",
        relatedType: "inbox",
        relatedId: item.id
      });

      return item;
    },
    rerouteInbox(id, nextRole) {
      const item = inboxItems.find((entry) => entry.id === id);
      if (!item) return null;

      item.queueRole = normalizeQueueRole(nextRole);
      item.updatedAt = new Date().toISOString();
      persistStoredInbox(inboxStorageKey, inboxItems);

      createNotification({
        title: "Inbox item rerouted",
        text: `${item.title} moved to ${getQueueRoleLabel(item.queueRole)}.`,
        audienceRole: item.queueRole,
        relatedType: "inbox",
        relatedId: item.id
      });

      return normalizeIncomingItem(item, 0);
    },
    updateInbox(id, payload = {}) {
      const item = inboxItems.find((entry) => entry.id === id);
      if (!item) return null;

      item.status = normalizeIncomingStatus(payload.status || item.status);
      item.decisionNote = String(payload.decisionNote ?? item.decisionNote ?? "");
      item.updatedAt = new Date().toISOString();

      if (payload.queueRole) {
        item.queueRole = normalizeQueueRole(payload.queueRole);
      }

      if (payload.conversationId !== undefined) {
        item.conversationId = String(payload.conversationId || "");
      }

      persistStoredInbox(inboxStorageKey, inboxItems);

      if (item.linkedRequestId && typeof plazaAdapter?.updateRequest === "function") {
        if (item.status === "Under Review") {
          plazaAdapter.updateRequest(item.linkedRequestId, { status: "Under Review" });
        } else if (item.status === "Matched" || item.status === "Conversation Opened") {
          plazaAdapter.updateRequest(item.linkedRequestId, { status: "Matched" });
        } else if (item.status === "Closed") {
          plazaAdapter.updateRequest(item.linkedRequestId, { status: "Closed" });
        }
      }

      return normalizeIncomingItem(item, 0);
    },
    createConversationFromInbox(inboxId, options = {}) {
      const inboxItem = inboxItems.find((entry) => entry.id === inboxId);
      if (!inboxItem) return null;

      if (inboxItem.conversationId) {
        const existingConversation = conversations.find((entry) => entry.id === inboxItem.conversationId);
        return existingConversation ? normalizeConversationItem(existingConversation, 0) : null;
      }

      const now = new Date().toISOString();
      const conversation = normalizeConversationItem({
        id: `conversation-${Date.now()}`,
        title: options.title || inboxItem.title,
        queueRole: inboxItem.queueRole,
        linkedRequestId: inboxItem.linkedRequestId,
        linkedInboxId: inboxItem.id,
        targetLabel: inboxItem.targetLabel,
        contextTitle: inboxItem.context || inboxItem.title,
        contextRoute: inboxItem.routeLabel || "Plaza conversation",
        participants: [inboxItem.senderName, getQueueRoleLabel(inboxItem.queueRole)],
        status: "active",
        messages: [
          {
            id: `message-${Date.now()}-system`,
            sender: "Plaza System",
            type: "system",
            text:
              inboxItem.kind === "support-note"
                ? `${inboxItem.senderName} opened this support-note conversation from Plaza. Original note: ${inboxItem.summary}`
                : `Conversation opened from ${inboxItem.routeLabel}. Target: ${inboxItem.targetLabel}. Queue owner: ${getQueueRoleLabel(inboxItem.queueRole)}.`
          }
        ],
        createdAt: now,
        updatedAt: now
      }, 0);

      conversations.unshift(conversation);
      inboxItem.conversationId = conversation.id;
      inboxItem.status = "Conversation Opened";
      inboxItem.updatedAt = now;
      persistAll();

      if (inboxItem.linkedRequestId && typeof plazaAdapter?.updateRequest === "function") {
        plazaAdapter.updateRequest(inboxItem.linkedRequestId, { status: "Matched" });
      }

      createNotification({
        title: "Conversation opened",
        text: `${conversation.title} is now live inside Messages.`,
        audienceRole: inboxItem.queueRole,
        relatedType: "conversation",
        relatedId: conversation.id
      });

      return conversation;
    },
    sendConversationMessage(conversationId, payload) {
      const conversation = conversations.find((entry) => entry.id === conversationId);
      if (!conversation) return null;

      const nextMessage = normalizeConversationMessage({
        id: `message-${Date.now()}`,
        sender: payload.sender || "You",
        type: "message",
        text: payload.text || "",
        createdAt: new Date().toISOString()
      }, 0);

      conversation.messages.push(nextMessage);
      conversation.updatedAt = nextMessage.createdAt;
      persistStoredConversations(conversationStorageKey, conversations);

      createNotification({
        title: "New message sent",
        text: `${conversation.title} has a new Plaza reply.`,
        audienceRole: conversation.queueRole,
        relatedType: "conversation",
        relatedId: conversation.id
      });

      return normalizeConversationItem(conversation, 0);
    },
    getConversations() {
      return conversations
        .slice()
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        .map((item) => normalizeConversationItem(item, 0));
    },
    getConversationById(id) {
      const item = conversations.find((entry) => entry.id === id);
      return item ? normalizeConversationItem(item, 0) : null;
    },
    getNotifications(filters = {}) {
      const roleValue = String(filters.role || "all");
      return notifications
        .filter((item) => roleValue === "all" || item.audienceRole === "all" || item.audienceRole === roleValue)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .map((item) => normalizeNotificationItem(item, 0));
    },
    getNotificationById(id) {
      const item = notifications.find((entry) => entry.id === id);
      return item ? normalizeNotificationItem(item, 0) : null;
    },
    markNotificationRead(id) {
      const item = notifications.find((entry) => entry.id === id);
      if (!item) return null;
      item.status = "read";
      persistStoredNotifications(notificationStorageKey, notifications);
      return normalizeNotificationItem(item, 0);
    },
    getPreviewCounts() {
      return {
        inbox: inboxItems.filter((item) => item.status !== "Closed").length,
        notifications: notifications.filter((item) => item.status === "unread").length,
        messages: conversations.length
      };
    },
    syncIncomingStatusFromRequest
  };
}

function createLocalPlazaAdapter({
  initialState,
  requestStorageKey,
  feedStorageKey
}) {
  const state = buildPlazaState(initialState || defaultPlazaState);
  let requests = loadStoredRequests(requestStorageKey);
  const storedCustomFeed = loadStoredFeed(feedStorageKey);

  if (storedCustomFeed.length) {
    const existingIds = new Set(state.feed.map((item) => item.id));
    storedCustomFeed.forEach((item) => {
      if (!existingIds.has(item.id)) {
        state.feed.unshift(item);
      }
    });
  }

  function refreshStats() {
    state.stats = deriveStats(state);
  }

  function persistCustomFeed() {
    const customFeed = state.feed.filter((item) => String(item.id || "").startsWith("feed-"));
    persistStoredFeed(
      feedStorageKey,
      customFeed.filter((item) => !defaultPlazaState.feed.some((seed) => seed.id === item.id))
    );
  }

  function persistRequests() {
    persistStoredRequests(requestStorageKey, requests);
  }

  function uniqueText(values) {
    return Array.from(
      new Set(
        safeArray(values)
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    );
  }

  function getRelatedMembersByRegion(region) {
    return state.directory.filter((member) => member.region === region || member.division === "both");
  }

  function getRegionMembersByRegion(region) {
    return state.directory.filter((member) => member.region === region);
  }

  function getRegionOpportunitiesByRegion(region) {
    return state.opportunities.filter((opportunity) => opportunity.region === region);
  }

  function getRegionBridgeByRegion(region) {
    return state.bridge.filter((bridge) => bridge.region === region);
  }

  function getTrustedMembersByRegion(region) {
    return state.directory.filter((member) => {
      const inRegion = member.region === region;
      const trusted = member.trust === "connector" || member.trust === "leader";
      return inRegion && trusted;
    });
  }

  function normalizeMatchLabel(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getLocalRoutePolicy(item) {
    const routeKey = getRequestRouteKey(item?.sourceType, item?.objective);
    const sourceType = String(item?.sourceType || "").trim().toLowerCase();

    const basePolicy = {
      threshold: 1,
      excludeTargetLabel: true,
      requireTrustedSupport: false
    };

    if (sourceType === "member-screened" || routeKey === "screened-routing") {
      return {
        ...basePolicy,
        threshold: 2,
        requireTrustedSupport: true
      };
    }

    if (sourceType === "member-bridge" || sourceType === "bridge" || routeKey === "bridge-routing") {
      return {
        ...basePolicy,
        threshold: 2
      };
    }

    if (sourceType === "region" || routeKey === "regional-routing") {
      return {
        ...basePolicy,
        threshold: 2
      };
    }

    if (
      sourceType === "opportunity" ||
      sourceType === "project" ||
      routeKey === "opportunity-routing" ||
      routeKey === "project-routing" ||
      routeKey === "partnership-routing" ||
      routeKey === "access-routing"
    ) {
      return {
        ...basePolicy,
        threshold: 2,
        requireTrustedSupport:
          routeKey === "partnership-routing" || routeKey === "access-routing"
      };
    }

    if (
      sourceType === "feed-introduction" ||
      sourceType === "member-connection" ||
      routeKey === "intro-routing" ||
      routeKey === "member-routing" ||
      routeKey === "collaboration-routing" ||
      routeKey === "hiring-routing" ||
      routeKey === "support-routing"
    ) {
      return basePolicy;
    }

    return basePolicy;
  }

  function getLocalPolicyMatchThreshold(item) {
    return getLocalRoutePolicy(item).threshold;
  }

  function getLocalQualifiedMatches(item, suggestedMatches) {
    const normalized = normalizeRequestItem(item, 0);
    const policy = getLocalRoutePolicy(normalized);
    const targetTokens = uniqueText([
      normalized.targetLabel,
      normalized.context,
      normalized.region
    ]).map(normalizeMatchLabel);

    const targetMember = normalized.targetId
      ? state.directory.find((member) => member.id === normalized.targetId)
      : null;

    if (targetMember?.name) {
      targetTokens.push(normalizeMatchLabel(targetMember.name));
    }

    const trustedSupportTokens = uniqueText([
      ...getTrustedMembersByRegion(normalized.region).map((member) => member.name),
      ...getRegionBridgeByRegion(normalized.region).map((bridge) => bridge.title)
    ]).map(normalizeMatchLabel);

    return uniqueText(suggestedMatches).filter((label) => {
      const normalizedLabel = normalizeMatchLabel(label);

      if (!normalizedLabel) return false;
      if (policy.excludeTargetLabel && targetTokens.includes(normalizedLabel)) return false;
      if (policy.requireTrustedSupport) {
        return trustedSupportTokens.includes(normalizedLabel);
      }

      return true;
    });
  }
  function getLocalLikelyRoute(item) {
    const sourceType = String(item?.sourceType || "").trim().toLowerCase();
    const targetLabel = String(item?.targetLabel || "this request");
    const region = String(item?.region || "").trim();
    const normalizedObjective = normalizeObjective(item?.objective);

    if (sourceType === "member-screened") {
      return `Screened intro review for ${targetLabel}${region ? ` in ${region}` : ""}.`;
    }

    if (sourceType === "member-bridge" || sourceType === "bridge") {
      return `Bridge validation and cross-division escalation${region ? ` in ${region}` : ""}.`;
    }

    if (sourceType === "region") {
      return `Regional routing toward the best local node or connector${region ? ` in ${region}` : ""}.`;
    }

    if (sourceType === "project") {
      return `Project fit review and role matching for ${targetLabel}.`;
    }

    if (sourceType === "opportunity") {
      return `Opportunity response screening and relevance matching for ${targetLabel}.`;
    }

    if (sourceType === "feed-introduction") {
      return `Introduction screening for ${targetLabel} before any deeper access is opened.`;
    }

    if (sourceType === "member-connection") {
      return `Direct connection screening for ${targetLabel}${region ? ` in ${region}` : ""}.`;
    }

    if (normalizedObjective === "Collaboration") {
      return `Collaboration routing is looking for the cleanest operator fit${region ? ` in ${region}` : ""}.`;
    }

    if (normalizedObjective === "Partnership") {
      return `Partnership routing is screening for a trusted business-side fit${region ? ` in ${region}` : ""}.`;
    }

    if (normalizedObjective === "Access") {
      return `Access routing is evaluating whether this should move through a higher-trust lane${region ? ` in ${region}` : ""}.`;
    }

    if (normalizedObjective === "Hiring") {
      return `Hiring routing is screening for execution fit and relevance${region ? ` in ${region}` : ""}.`;
    }

    if (normalizedObjective === "Support") {
      return `Support routing is looking for the cleanest support path${region ? ` in ${region}` : ""}.`;
    }

    if (normalizedObjective === "Introduction") {
      return `Introduction routing is screening for a clean intro path${region ? ` in ${region}` : ""}.`;
    }

    return "General Plaza routing decides the cleanest next lane for this request.";
  }

  function getKeywordSet(value) {
    return Array.from(
      new Set(
        String(value || "")
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .map((part) => part.trim())
          .filter((part) => part.length >= 3)
      )
    );
  }

  function getKeywordOverlapScore(leftValue, rightValue) {
    const left = getKeywordSet(leftValue);
    const right = new Set(getKeywordSet(rightValue));
    return left.reduce((score, keyword) => score + (right.has(keyword) ? 1 : 0), 0);
  }

  function getMemberTrustScore(member) {
    if (member?.trust === "connector") return 4;
    if (member?.trust === "leader") return 3;
    return 2;
  }

  function scoreMemberForRequest(member, item, routeKey) {
    let score = 0;

    if (member?.region && member.region === item?.region) score += 6;
    if (member?.division === "both") score += 4;
    if (routeKey === "screened-routing" || routeKey === "access-routing" || routeKey === "partnership-routing") {
      score += getMemberTrustScore(member) * 3;
    } else {
      score += getMemberTrustScore(member);
    }

    const requestCorpus = [
      item?.objective,
      item?.targetLabel,
      item?.context,
      item?.message,
      item?.region
    ].join(" ");

    const memberCorpus = [
      member?.role,
      member?.focus,
      safeArray(member?.tags).join(" "),
      member?.region,
      member?.name
    ].join(" ");

    score += getKeywordOverlapScore(requestCorpus, memberCorpus);

    return score;
  }

  function getLocalSuggestedMatches(item) {
    const normalized = normalizeRequestItem(item, 0);
    const routeKey = getRequestRouteKey(normalized.sourceType, normalized.objective);
    const sourceType = String(normalized.sourceType || "").trim().toLowerCase();
    const region = String(normalized.region || "").trim();

    const targetMember = normalized.targetId
      ? state.directory.find((member) => member.id === normalized.targetId)
      : null;

    const targetOpportunity = normalized.targetId
      ? state.opportunities.find((entry) => entry.id === normalized.targetId)
      : null;

    const targetBridge = normalized.targetId
      ? state.bridge.find((entry) => entry.id === normalized.targetId)
      : null;

    const targetRegion = normalized.targetId
      ? state.regions.find((entry) => entry.id === normalized.targetId)
      : null;

    const targetFeed = normalized.targetId
      ? state.feed.find((entry) => entry.id === normalized.targetId)
      : null;

    const scoredRegionMembers = getRelatedMembersByRegion(region)
      .filter((member) => member.id !== normalized.targetId)
      .sort((left, right) => scoreMemberForRequest(right, normalized, routeKey) - scoreMemberForRequest(left, normalized, routeKey))
      .map((member) => member.name);

    const exactRegionMembers = getRegionMembersByRegion(region)
      .filter((member) => member.id !== normalized.targetId)
      .sort((left, right) => scoreMemberForRequest(right, normalized, routeKey) - scoreMemberForRequest(left, normalized, routeKey))
      .map((member) => member.name);

    const trustedRegionMembers = getTrustedMembersByRegion(region)
      .filter((member) => member.id !== normalized.targetId)
      .sort((left, right) => scoreMemberForRequest(right, normalized, routeKey) - scoreMemberForRequest(left, normalized, routeKey))
      .map((member) => member.name);

    const regionOpportunityTitles = getRegionOpportunitiesByRegion(region).map((entry) => entry.title);
    const regionBridgeTitles = getRegionBridgeByRegion(region).map((entry) => entry.title);

    if (sourceType === "member-screened") {
      return uniqueText([
        targetMember?.name || normalized.targetLabel,
        ...trustedRegionMembers
      ]).slice(0, 3);
    }

    if (sourceType === "member-connection" || sourceType === "feed-introduction") {
      return uniqueText([
        targetMember?.name || normalized.targetLabel,
        ...scoredRegionMembers
      ]).slice(0, 3);
    }

    if (sourceType === "member-bridge" || sourceType === "bridge" || routeKey === "bridge-routing") {
      return uniqueText([
        targetBridge?.title || normalized.targetLabel,
        ...regionBridgeTitles,
        ...trustedRegionMembers
      ]).slice(0, 3);
    }

    if (sourceType === "region" || routeKey === "regional-routing") {
      return uniqueText([
        targetRegion?.region || normalized.targetLabel,
        ...exactRegionMembers.slice(0, 2),
        ...regionBridgeTitles.slice(0, 1),
        ...regionOpportunityTitles.slice(0, 1)
      ]).slice(0, 4);
    }

    if (sourceType === "project" || routeKey === "project-routing") {
      return uniqueText([
        targetFeed?.title || normalized.targetLabel,
        ...scoredRegionMembers.slice(0, 2),
        ...regionOpportunityTitles.slice(0, 1)
      ]).slice(0, 4);
    }

    if (sourceType === "opportunity" || routeKey === "opportunity-routing") {
      return uniqueText([
        targetOpportunity?.title || normalized.targetLabel,
        ...scoredRegionMembers.slice(0, 2),
        ...regionBridgeTitles.slice(0, 1)
      ]).slice(0, 4);
    }

    if (routeKey === "partnership-routing" || routeKey === "access-routing") {
      return uniqueText([
        normalized.targetLabel,
        ...trustedRegionMembers,
        ...regionBridgeTitles.slice(0, 1)
      ]).slice(0, 3);
    }

    if (
      routeKey === "collaboration-routing" ||
      routeKey === "hiring-routing" ||
      routeKey === "support-routing" ||
      routeKey === "intro-routing"
    ) {
      return uniqueText([
        normalized.targetLabel,
        ...scoredRegionMembers.slice(0, 2),
        ...regionBridgeTitles.slice(0, 1)
      ]).slice(0, 4);
    }

    return uniqueText([
      normalized.targetLabel,
      ...scoredRegionMembers.slice(0, 2),
      ...regionOpportunityTitles.slice(0, 1)
    ]).slice(0, 4);
  }

  function getLocalDeterministicNextStatus(item) {
    const normalizedStatus = normalizeRequestStatus(item?.status);

    if (normalizedStatus === "Draft") return "Submitted";
    if (normalizedStatus === "Submitted") return "Under Review";

    if (normalizedStatus === "Under Review") {
      const suggestedMatches = safeArray(item?.suggestedMatches).length
        ? safeArray(item.suggestedMatches)
        : getLocalSuggestedMatches(item);
      const qualifiedMatches = getLocalQualifiedMatches(item, suggestedMatches);
      const threshold = getLocalPolicyMatchThreshold(item);

      return qualifiedMatches.length >= threshold ? "Matched" : "Closed";
    }

    if (normalizedStatus === "Matched") return "Closed";
    return null;
  }

  function getLocalMatchedLabels(item, suggestedMatches) {
    const storedMatches = uniqueText(item?.matchedEntityLabels);

    if (storedMatches.length) {
      return storedMatches.slice(0, 3);
    }

    const normalizedStatus = normalizeRequestStatus(item?.status);
    if (normalizedStatus !== "Matched" && normalizedStatus !== "Closed") {
      return [];
    }

    const sourceType = String(item?.sourceType || "").trim().toLowerCase();
    const qualifiedMatches = getLocalQualifiedMatches(item, suggestedMatches);

    if (!qualifiedMatches.length) {
      return [];
    }

    if (sourceType === "bridge" || sourceType === "member-bridge") {
      return uniqueText(qualifiedMatches).slice(0, 2);
    }

    if (sourceType === "region") {
      return uniqueText(qualifiedMatches).slice(0, 3);
    }

    return uniqueText(qualifiedMatches).slice(0, 2);
  }

  function getLocalDecisionSummary(item, routeLabel) {
    const normalizedStatus = normalizeRequestStatus(item?.status);
    const suggestedMatches = safeArray(item?.suggestedMatches).length
      ? safeArray(item.suggestedMatches)
      : getLocalSuggestedMatches(item);
    const qualifiedMatches = getLocalQualifiedMatches(item, suggestedMatches);
    const threshold = getLocalPolicyMatchThreshold(item);

    if (normalizedStatus === "Draft") {
      return `${routeLabel} is saved locally as a draft and has not entered live Plaza review yet.`;
    }

    if (normalizedStatus === "Submitted") {
      return `${routeLabel} queued inside Plaza under a policy that needs ${threshold} qualified signal${threshold === 1 ? "" : "s"} before it can clear review.`;
    }

    if (normalizedStatus === "Under Review") {
      return qualifiedMatches.length >= threshold
        ? `${routeLabel} has surfaced ${qualifiedMatches.length} qualified Plaza signal${qualifiedMatches.length === 1 ? "" : "s"} and clears its current route policy.`
        : `${routeLabel} is being screened and has only surfaced ${qualifiedMatches.length} of ${threshold} qualified Plaza signal${threshold === 1 ? "" : "s"} needed to clear its current route policy.`;
    }

    if (normalizedStatus === "Matched") {
      return `${routeLabel} has produced a deterministic match inside Plaza.`;
    }

    if (normalizedStatus === "Closed") {
      return `${routeLabel} has reached its closed end state.`;
    }

    return `${routeLabel} is active inside Plaza's structured request flow.`;
  }

  function getLocalResolutionSummary(item, matchedEntityLabels) {
    const normalizedStatus = normalizeRequestStatus(item?.status);
    const sourceType = String(item?.sourceType || "").trim().toLowerCase();
    const labels = uniqueText(matchedEntityLabels);
    const matchCopy = labels.length ? labels.join(" • ") : "";

    if (normalizedStatus === "Matched") {
      if (sourceType === "opportunity") {
        return matchCopy
          ? `Outcome: this opportunity request has been matched toward ${matchCopy}.`
          : "Outcome: this opportunity request has been matched to a relevant response lane.";
      }

      if (sourceType === "project") {
        return matchCopy
          ? `Outcome: this project request has been matched toward ${matchCopy}.`
          : "Outcome: this project request has been matched to a useful builder lane.";
      }

      if (sourceType === "region") {
        return matchCopy
          ? `Outcome: this regional request has been matched toward ${matchCopy}.`
          : "Outcome: this regional request has been matched to a local Plaza lane.";
      }

      if (sourceType === "bridge" || sourceType === "member-bridge") {
        return matchCopy
          ? `Outcome: this bridge request has been matched toward ${matchCopy}.`
          : "Outcome: this bridge request has been matched to a cross-division lane.";
      }

      if (sourceType === "member-screened") {
        return matchCopy
          ? `Outcome: this screened intro has been matched toward ${matchCopy}.`
          : "Outcome: this screened intro has been matched inside Plaza.";
      }

      if (sourceType === "feed-introduction" || sourceType === "member-connection") {
        return matchCopy
          ? `Outcome: this connection path has been matched toward ${matchCopy}.`
          : "Outcome: this connection path has been matched inside Plaza.";
      }

      return matchCopy
        ? `Outcome: this request has been matched toward ${matchCopy}.`
        : "Outcome: this request has been matched inside Plaza.";
    }

    if (normalizedStatus === "Closed") {
      if (labels.length) {
        return `Closed with an already surfaced match: ${labels.join(" • ")}.`;
      }

      if (sourceType === "bridge" || sourceType === "member-bridge") {
        return "Closed after bridge validation ended without further escalation.";
      }

      if (sourceType === "region") {
        return "Closed after regional routing ended without a continued match.";
      }

      if (sourceType === "opportunity") {
        return "Closed after opportunity review ended without a live continuation.";
      }

      if (sourceType === "project") {
        return "Closed after project review ended without a continued role match.";
      }

      return "Closed after Plaza finished the route without a continued next step.";
    }

    return "Outcome will become explicit once Plaza reaches a matched or closed state.";
  }

  function enrichRequest(item) {
    const normalized = normalizeRequestItem(item, 0);
    const routeKey = normalized.routeKey || getRequestRouteKey(normalized.sourceType, normalized.objective);
    const routeLabel = normalized.routeLabel || getRequestRouteLabel(normalized.sourceType, normalized.objective);
    const suggestedMatches = getLocalSuggestedMatches(normalized);
    const matchedEntityLabels = getLocalMatchedLabels(normalized, suggestedMatches);

    return {
      ...normalized,
      routeKey,
      routeLabel,
      likelyRoute: getLocalLikelyRoute(normalized),
      suggestedMatches,
      matchedEntityLabels,
      decisionSummary: normalized.decisionSummary || getLocalDecisionSummary({ ...normalized, suggestedMatches }, routeLabel),
      resolutionSummary: normalized.resolutionSummary || getLocalResolutionSummary(normalized, matchedEntityLabels),
      deterministicNextStatus: getLocalDeterministicNextStatus({ ...normalized, suggestedMatches, matchedEntityLabels })
    };
  }

  return {
    getState() {
      return state;
    },
    getStats() {
      return { ...state.stats };
    },
    getFeed(filter = "all") {
      return filter === "all" ? [...state.feed] : state.feed.filter((item) => item.type === filter);
    },
    getDirectory(filters = {}) {
      const regionValue = filters.region || "all";
      const divisionValue = filters.division || "all";
      const trustValue = filters.trust || "all";

      return state.directory.filter((item) => {
        const regionMatch = regionValue === "all" || item.region === regionValue;
        const divisionMatch = divisionValue === "all" || item.division === divisionValue;
        const trustMatch = trustValue === "all" || item.trust === trustValue;
        return regionMatch && divisionMatch && trustMatch;
      });
    },
    getOpportunities() {
      return [...state.opportunities];
    },
    getRegions() {
      return [...state.regions];
    },
    getBridge() {
      return [...state.bridge];
    },
    getRequests() {
      return requests.map((item) => enrichRequest(item));
    },
    getFeedById(id) {
      return state.feed.find((item) => item.id === id) || null;
    },
    getMemberById(id) {
      return state.directory.find((item) => item.id === id) || null;
    },
    getOpportunityById(id) {
      return state.opportunities.find((item) => item.id === id) || null;
    },
    getRegionById(id) {
      return state.regions.find((item) => item.id === id) || null;
    },
    getBridgeById(id) {
      return state.bridge.find((item) => item.id === id) || null;
    },
    getRelatedMembers(region) {
      return getRelatedMembersByRegion(region);
    },
    getRegionMembers(region) {
      return getRegionMembersByRegion(region);
    },
    getRegionOpportunities(region) {
      return getRegionOpportunitiesByRegion(region);
    },
    getRegionBridge(region) {
      return getRegionBridgeByRegion(region);
    },
    createIntroduction(payload) {
      const item = normalizeFeedItem({
        id: `feed-${Date.now()}`,
        type: "introduction",
        member: payload.name,
        source: "academy",
        division: "academy",
        region: payload.region,
        title: `${payload.name} introduced themselves from ${payload.region}.`,
        text: payload.focus,
        tag: "Introduction",
        action: "Send Intro Request"
      }, 0);

      state.feed.unshift(item);
      persistCustomFeed();
      refreshStats();
      return item;
    },
        getRequestById(id) {
      const request = requests.find((item) => item.id === id);
      return request ? enrichRequest(request) : null;
    },
    createRequest(payload) {
      const now = new Date().toISOString();
      const requestedStatus = normalizeRequestStatus(payload?.status || "Submitted");

      const baseRequest = normalizeRequestItem({
        id: `req-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
        status: requestedStatus,
        statusHistory: [
          {
            status: requestedStatus,
            at: now
          }
        ],
        ...payload
      }, 0);

      const enrichedRequest = enrichRequest(baseRequest);
      const storedRequest = {
        ...baseRequest,
        routeKey: enrichedRequest.routeKey,
        routeLabel: enrichedRequest.routeLabel,
        matchedEntityLabels: enrichedRequest.matchedEntityLabels,
        decisionSummary: enrichedRequest.decisionSummary,
        resolutionSummary: enrichedRequest.resolutionSummary
      };

      requests.unshift(storedRequest);
      persistRequests();
      return enrichRequest(storedRequest);
    },
    updateRequest(id, payload = {}) {
      const request = requests.find((item) => item.id === id);
      if (!request) return null;

      const now = new Date().toISOString();
      const previousStatus = normalizeRequestStatus(request.status);
      const nextStatus = payload.status
        ? normalizeRequestStatus(payload.status)
        : previousStatus;

      const nextSourceType = String(payload.sourceType ?? request.sourceType ?? "general");
      const nextTargetId = String(payload.targetId ?? request.targetId ?? "");
      const nextTargetLabel = String(payload.targetLabel ?? request.targetLabel ?? "General Plaza request");
      const nextContext = String(payload.context ?? request.context ?? "");
      const nextRegion = String(payload.region ?? request.region ?? "");
      const nextName = String(payload.name ?? request.name ?? "Unknown requester");
      const nextObjective = normalizeObjective(payload.objective ?? request.objective ?? "Connection request");
      const nextMessage = String(payload.message ?? request.message ?? "");

      const routeInputsChanged =
        nextSourceType !== String(request.sourceType ?? "general") ||
        nextTargetId !== String(request.targetId ?? "") ||
        nextTargetLabel !== String(request.targetLabel ?? "General Plaza request") ||
        nextContext !== String(request.context ?? "") ||
        nextRegion !== String(request.region ?? "") ||
        nextObjective !== normalizeObjective(request.objective ?? "Connection request") ||
        nextMessage !== String(request.message ?? "");

      request.sourceType = nextSourceType;
      request.targetId = nextTargetId;
      request.targetLabel = nextTargetLabel;
      request.context = nextContext;
      request.region = nextRegion;
      request.name = nextName;
      request.objective = nextObjective;
      request.message = nextMessage;
      request.status = nextStatus;
      request.updatedAt = now;

      const shouldResetDeterministicOutcome =
        routeInputsChanged ||
        nextStatus === "Draft" ||
        nextStatus === "Submitted" ||
        nextStatus === "Under Review";

      if (shouldResetDeterministicOutcome) {
        request.matchedEntityLabels = [];
        request.decisionSummary = "";
        request.resolutionSummary = "";
      }

      if (nextStatus === "Closed") {
        request.resolvedAt = request.resolvedAt || now;
      } else {
        request.resolvedAt = "";
      }

      request.statusHistory = safeArray(request.statusHistory);
      if (!request.statusHistory.length) {
        request.statusHistory = [
          {
            status: previousStatus,
            at: request.createdAt || now
          }
        ];
      }

      if (nextStatus !== previousStatus) {
        request.statusHistory.push({
          status: nextStatus,
          at: now
        });
      }

      const enrichedRequest = enrichRequest(request);
      request.routeKey = enrichedRequest.routeKey;
      request.routeLabel = enrichedRequest.routeLabel;
      request.matchedEntityLabels = enrichedRequest.matchedEntityLabels;
      request.decisionSummary = enrichedRequest.decisionSummary;
      request.resolutionSummary = enrichedRequest.resolutionSummary;

      persistRequests();
      return enrichRequest(request);
    },
    closeRequest(id) {
      return this.updateRequest(id, { status: "Closed" });
    },
    deleteRequest(id) {
      const index = requests.findIndex((item) => item.id === id);
      if (index === -1) return false;
      requests.splice(index, 1);
      persistRequests();
      return true;
    },
    advanceRequestStatus(id) {
      const request = requests.find((item) => item.id === id);
      if (!request) return null;

      const enrichedRequest = enrichRequest(request);
      const nextStatus = enrichedRequest.deterministicNextStatus || null;

      if (!nextStatus) {
        return enrichedRequest;
      }

      return this.updateRequest(id, { status: nextStatus });
    }
  };
}
const plazaAdapter =
  window.yhPlazaAdapter && typeof window.yhPlazaAdapter.getState === "function"
    ? window.yhPlazaAdapter
    : createLocalPlazaAdapter({
        initialState: externalPlazaState || defaultPlazaState,
        requestStorageKey: PLAZA_REQUESTS_KEY,
        feedStorageKey: PLAZA_FEED_CUSTOM_KEY
      });

const plazaOpsAdapter = createLocalPlazaOpsAdapter({
  inboxStorageKey: PLAZA_INBOX_KEY,
  notificationStorageKey: PLAZA_NOTIFICATIONS_KEY,
  conversationStorageKey: PLAZA_CONVERSATIONS_KEY
});

const plazaState = plazaAdapter.getState();

const plazaConfig = {
  feed: {
    title: "Feed",
    note: "Network movement, wins, introductions, opportunities, and regional updates across YH Universe.",
    navTab: "feed",
    toolbar: "feed",
    breadcrumb: ["Plaza", "Feed"]
  },
  opportunities: {
    title: "Opportunities",
    note: "Find work, collaboration, projects, partnerships, introductions, service needs, and regional openings.",
    navTab: "opportunities",
    toolbar: null,
    breadcrumb: ["Plaza", "Opportunities"]
  },
  directory: {
    title: "Directory",
    note: "Find builders, operators, service providers, regional connectors, and Federation-linked members by role and trust layer.",
    navTab: "directory",
    toolbar: "directory",
    breadcrumb: ["Plaza", "Directory"]
  },
  regions: {
    title: "Regions",
    note: "Organize movement locally through city and country hubs that cluster members, opportunities, requests, and real-world access.",
    navTab: "regions",
    toolbar: null,
    breadcrumb: ["Plaza", "Regions"]
  },
  bridge: {
    title: "Bridge",
    note: "Track how Academy execution turns into Plaza visibility and later becomes Federation-relevant access.",
    navTab: "bridge",
    toolbar: null,
    breadcrumb: ["Plaza", "Bridge"]
  },
  requests: {
    title: "Requests",
    note: "Track intro, opportunity, collaboration, service, regional, project, and Federation escalation requests.",
    navTab: "requests",
    toolbar: null,
    breadcrumb: ["Plaza", "Requests"]
  },
  inbox: {
    title: "Inbox Hub",
    note: "Incoming requests, applications, support notes, and queue-owned work stay here until Plaza opens a conversation.",
    navTab: null,
    toolbar: null,
    breadcrumb: ["Plaza", "Inbox Hub"]
  },
  "incoming-detail": {
    title: "Incoming Detail",
    note: "Review routing ownership, incoming package, and conversation conversion without leaving Plaza.",
    navTab: null,
    toolbar: null,
    breadcrumb: ["Plaza", "Inbox Hub", "Incoming Detail"]
  },
  notifications: {
    title: "Notifications",
    note: "Awareness events point toward inbox items, requests, and conversations without replacing those workflows.",
    navTab: null,
    toolbar: null,
    breadcrumb: ["Plaza", "Notifications"]
  },
  messages: {
    title: "Messages",
    note: "Conversations opened from opportunities, requests, directory intros, regional hubs, and projects.",
    navTab: "messages",
    toolbar: null,
    breadcrumb: ["Plaza", "Messages"]
  },
  conversation: {
    title: "Conversation",
    note: "Message threads stay tied to their opening route, queue owner, and original Plaza context.",
    navTab: null,
    toolbar: null,
    breadcrumb: ["Plaza", "Messages", "Conversation"]
  },
  "opportunity-detail": {
    title: "Opportunity Detail",
    note: "Structured fit, related members, and next-step routing inside the same Plaza workspace.",
    navTab: "opportunities",
    toolbar: null,
    breadcrumb: ["Plaza", "Opportunities", "Opportunity Detail"]
  },
  "project-detail": {
    title: "Project Detail",
    note: "Cross-division projects now stay inside Plaza as an internal screen instead of breaking the workflow.",
    navTab: "feed",
    toolbar: null,
    breadcrumb: ["Plaza", "Feed", "Project Detail"]
  },
  "region-hub": {
    title: "Region Hub",
    note: "Local movement, members, and next steps stay inside the same embedded YH Universe workspace.",
    navTab: "regions",
    toolbar: null,
    breadcrumb: ["Plaza", "Regions", "Region Hub"]
  },
  "bridge-detail": {
    title: "Bridge Detail",
    note: "Bridge lanes now behave like first-class internal screens with clean routing and tracked next steps.",
    navTab: "bridge",
    toolbar: null,
    breadcrumb: ["Plaza", "Bridge", "Bridge Detail"]
  }
};

const PRIMARY_SCREENS = new Set([
  "feed",
  "opportunities",
  "directory",
  "regions",
  "bridge",
  "requests",
  "messages"
]);

const plazaRuntime = {
  currentScreen: "feed",
  previousScreen: "feed",
  feedFilter: "all",
  activeInboxRole: "all",
  activeNotificationRole: "all",
  activeConversationId: "",
  history: []
};

const plazaActionLocks = new Set();

function setButtonBusy(button, busyText) {
  if (!(button instanceof HTMLButtonElement)) return;
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent || "";
  }
  button.disabled = true;
  button.classList.add("is-busy");
  if (busyText) {
    button.textContent = busyText;
  }
}

function clearButtonBusy(button) {
  if (!(button instanceof HTMLButtonElement)) return;
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
  button.disabled = false;
  button.classList.remove("is-busy");
}

async function runLockedButtonAction(lockKey, button, busyText, callback) {
  if (plazaActionLocks.has(lockKey)) return null;

  plazaActionLocks.add(lockKey);
  setButtonBusy(button, busyText);

  try {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    return await callback();
  } finally {
    clearButtonBusy(button);
    plazaActionLocks.delete(lockKey);
  }
}

function savePlazaUiState() {
  persistStoredUiState(PLAZA_UI_STATE_KEY, {
    currentScreen: PRIMARY_SCREENS.has(plazaRuntime.currentScreen) ? plazaRuntime.currentScreen : "feed",
    feedFilter: plazaRuntime.feedFilter || "all",
    activeInboxRole: plazaRuntime.activeInboxRole || "all",
    activeNotificationRole: plazaRuntime.activeNotificationRole || "all",
    directoryRegion: plazaRegionFilter?.value || "all",
    directoryDivision: plazaDivisionFilter?.value || "all",
    directoryTrust: plazaTrustFilter?.value || "all"
  });
}

function restorePlazaUiState() {
  const saved = loadStoredUiState(PLAZA_UI_STATE_KEY);

  plazaRuntime.feedFilter = String(saved.feedFilter || "all");
  plazaRuntime.activeInboxRole = String(saved.activeInboxRole || "all");
  plazaRuntime.activeNotificationRole = String(saved.activeNotificationRole || "all");

  if (plazaRegionFilter) {
    plazaRegionFilter.value = String(saved.directoryRegion || "all");
  }

  if (plazaDivisionFilter) {
    plazaDivisionFilter.value = String(saved.directoryDivision || "all");
  }

  if (plazaTrustFilter) {
    plazaTrustFilter.value = String(saved.directoryTrust || "all");
  }

  const targetScreen = String(saved.currentScreen || "feed");
  return PRIMARY_SCREENS.has(targetScreen) ? targetScreen : "feed";
}

const plazaTabs = Array.from(document.querySelectorAll(".yh-plaza-tab"));
const plazaScreens = Array.from(document.querySelectorAll("[data-plaza-screen]"));
const plazaNavButtons = Array.from(document.querySelectorAll("[data-nav-tab]"));
const plazaFeedFilters = Array.from(document.querySelectorAll("[data-feed-filter]"));

const PLAZA_SCREEN_LOADER_LABELS = {
  feed: "Loading Feed...",
  opportunities: "Loading Opportunities...",
  directory: "Loading Directory...",
  regions: "Loading Regions...",
  bridge: "Loading Bridge...",
  requests: "Loading Requests...",
  messages: "Loading Messages...",
  inbox: "Loading Inbox...",
  notifications: "Loading Notifications...",
  "incoming-detail": "Loading Sender Context...",
  "opportunity-detail": "Loading Opportunity Detail...",
  "project-detail": "Loading Project Detail...",
  "region-hub": "Loading Region Hub...",
  "bridge-detail": "Loading Bridge Detail..."
};

function getPlazaScreenLoaderLabel(screenName = "") {
  const key = String(screenName || "").trim();
  if (PLAZA_SCREEN_LOADER_LABELS[key]) return PLAZA_SCREEN_LOADER_LABELS[key];

  const configTitle = String(plazaConfig?.[key]?.title || "").trim();
  if (configTitle) return `Loading ${configTitle}...`;

  return "Loading Plaza...";
}

function showPlazaTabLoader(screenNameOrLabel = "Loading Plaza...") {
  const loader = document.getElementById("yh-tab-loader");
  const text = document.getElementById("yh-tab-loader-text");

  const raw = String(screenNameOrLabel || "").trim();
  const label = raw.startsWith("Loading ") ? raw : getPlazaScreenLoaderLabel(raw);

  if (text) {
    text.textContent = label || "Loading Plaza...";
  }

  if (!loader) return;

  loader.hidden = false;
  loader.setAttribute("aria-hidden", "false");

  window.requestAnimationFrame(() => {
    loader.classList.add("is-active");
  });
}

function hidePlazaTabLoader() {
  const loader = document.getElementById("yh-tab-loader");
  if (!loader) return;

  loader.classList.remove("is-active");
  loader.setAttribute("aria-hidden", "true");

  window.setTimeout(() => {
    if (!loader.classList.contains("is-active")) {
      loader.hidden = true;
    }
  }, 170);
}

const plazaFeedGrid = document.getElementById("plazaFeedGrid");
const plazaFeedComposerForm = document.getElementById("plazaFeedComposerForm");
const plazaFeedComposerSubmitBtn = document.getElementById("plazaFeedComposerSubmitBtn");

const plazaOpportunityComposerForm = document.getElementById("plazaOpportunityComposerForm");
const plazaOpportunityComposerSubmitBtn = document.getElementById("plazaOpportunityComposerSubmitBtn");

const plazaDirectoryComposerForm = document.getElementById("plazaDirectoryComposerForm");
const plazaDirectoryComposerSubmitBtn = document.getElementById("plazaDirectoryComposerSubmitBtn");

const plazaRegionComposerForm = document.getElementById("plazaRegionComposerForm");
const plazaRegionComposerSubmitBtn = document.getElementById("plazaRegionComposerSubmitBtn");

const plazaBridgeComposerForm = document.getElementById("plazaBridgeComposerForm");
const plazaBridgeComposerSubmitBtn = document.getElementById("plazaBridgeComposerSubmitBtn");

const plazaRequestComposerForm = document.getElementById("plazaRequestComposerForm");
const plazaRequestComposerSubmitBtn = document.getElementById("plazaRequestComposerSubmitBtn");

const plazaDirectoryGrid = document.getElementById("plazaDirectoryGrid");
const plazaOpportunityGrid = document.getElementById("plazaOpportunityGrid");
const plazaRegionGrid = document.getElementById("plazaRegionGrid");
const plazaBridgeGrid = document.getElementById("plazaBridgeGrid");
const plazaRequestsScreenList = document.getElementById("plazaRequestsScreenList");
const plazaInboxMeta = document.getElementById("plazaInboxMeta");
const plazaInboxRoleFilters = document.getElementById("plazaInboxRoleFilters");
const plazaInboxSummaryGrid = document.getElementById("plazaInboxSummaryGrid");
const plazaInboxList = document.getElementById("plazaInboxList");
const plazaIncomingDetailTitle = document.getElementById("plazaIncomingDetailTitle");
const plazaIncomingDetailMeta = document.getElementById("plazaIncomingDetailMeta");
const plazaIncomingDetailActions = document.getElementById("plazaIncomingDetailActions");
const plazaIncomingDetailBody = document.getElementById("plazaIncomingDetailBody");
const plazaNotificationsMeta = document.getElementById("plazaNotificationsMeta");
const plazaNotificationRoleFilters = document.getElementById("plazaNotificationRoleFilters");
const plazaNotificationsList = document.getElementById("plazaNotificationsList");
const plazaMessagesMeta = document.getElementById("plazaMessagesMeta");
const plazaMessagesList = document.getElementById("plazaMessagesList");
const plazaConversationTitle = document.getElementById("plazaConversationTitle");
const plazaConversationMeta = document.getElementById("plazaConversationMeta");
const plazaConversationThread = document.getElementById("plazaConversationThread");
const plazaConversationForm = document.getElementById("plazaConversationForm");
const plazaConversationIdField = document.getElementById("plazaConversationIdField");
const plazaConversationMessageField = document.getElementById("plazaConversationMessageField");

const plazaOpportunityDetailTitle = document.getElementById("plazaOpportunityDetailTitle");
const plazaOpportunityDetailMeta = document.getElementById("plazaOpportunityDetailMeta");
const plazaOpportunityDetailBody = document.getElementById("plazaOpportunityDetailBody");
const plazaOpportunityDetailPrimaryBtn = document.getElementById("plazaOpportunityDetailPrimaryBtn");

const plazaProjectDetailTitle = document.getElementById("plazaProjectDetailTitle");
const plazaProjectDetailMeta = document.getElementById("plazaProjectDetailMeta");
const plazaProjectDetailBody = document.getElementById("plazaProjectDetailBody");
const plazaProjectDetailPrimaryBtn = document.getElementById("plazaProjectDetailPrimaryBtn");

const plazaRegionHubTitle = document.getElementById("plazaRegionHubTitle");
const plazaRegionHubMeta = document.getElementById("plazaRegionHubMeta");
const plazaRegionHubBody = document.getElementById("plazaRegionHubBody");
const plazaRegionHubPrimaryBtn = document.getElementById("plazaRegionHubPrimaryBtn");

const plazaBridgeDetailTitle = document.getElementById("plazaBridgeDetailTitle");
const plazaBridgeDetailMeta = document.getElementById("plazaBridgeDetailMeta");
const plazaBridgeDetailBody = document.getElementById("plazaBridgeDetailBody");
const plazaBridgeDetailPrimaryBtn = document.getElementById("plazaBridgeDetailPrimaryBtn");

const plazaRegionFilter = document.getElementById("plazaRegionFilter");
const plazaDivisionFilter = document.getElementById("plazaDivisionFilter");
const plazaTrustFilter = document.getElementById("plazaTrustFilter");

const plazaWorkspaceTitle = document.getElementById("plazaWorkspaceTitle");
const plazaWorkspaceNote = document.getElementById("plazaWorkspaceNote");
const plazaFeedToolbar = document.getElementById("plazaFeedToolbar");
const plazaDirectoryToolbar = document.getElementById("plazaDirectoryToolbar");

const plazaScreenContext = document.getElementById("plazaScreenContext");
const plazaScreenBackBtn = document.getElementById("plazaScreenBackBtn");
const plazaScreenBreadcrumbs = document.getElementById("plazaScreenBreadcrumbs");

const plazaToast = document.getElementById("plazaToast");

const plazaModal = document.getElementById("plazaModal");
const plazaModalTitle = document.getElementById("plazaModalTitle");
const plazaModalKicker = document.getElementById("plazaModalKicker");
const plazaModalBody = document.getElementById("plazaModalBody");

const plazaDrawer = document.getElementById("plazaDrawer");
const plazaDrawerTitle = document.getElementById("plazaDrawerTitle");
const plazaDrawerKicker = document.getElementById("plazaDrawerKicker");
const plazaDrawerBody = document.getElementById("plazaDrawerBody");

const introBtn = document.getElementById("plazaOpenIntroBtn");
const connectBtn = document.getElementById("plazaOpenConnectBtn");
const openInboxBtn = document.getElementById("plazaOpenInboxBtn");
const openNotificationsBtn = document.getElementById("plazaOpenNotificationsBtn");
const openMessagesBtn = document.getElementById("plazaOpenMessagesBtn");
const openRequestsBtn = document.getElementById("plazaOpenRequestsBtn");
const resetViewBtn = document.getElementById("plazaResetViewBtn");

const sidebarIntroBtn = document.getElementById("plazaSidebarIntroBtn");
const sidebarConnectBtn = document.getElementById("plazaSidebarConnectBtn");
const sidebarRequestsBtn = document.getElementById("plazaSidebarRequestsBtn");

const plazaRailSignals = document.getElementById("plazaRailSignals");
const plazaRequestsPreview = document.getElementById("plazaRequestsPreview");
const plazaInboxPreview = document.getElementById("plazaInboxPreview");
const plazaNotificationsPreview = document.getElementById("plazaNotificationsPreview");
const plazaMessagesPreview = document.getElementById("plazaMessagesPreview");

const plazaAccessGate = document.getElementById("plazaAccessGate");
const plazaAccessStatusCard = document.getElementById("plazaAccessStatusCard");
const plazaApplicationForm = document.getElementById("plazaApplicationForm");
const plazaApplicationSubmitBtn = document.getElementById("plazaApplicationSubmitBtn");
const plazaApplicationStopNotice = document.getElementById("plazaApplicationStopNotice");
const plazaApplicationMemberFields = document.getElementById("plazaApplicationMemberFields");
const plazaApplicationProgressText = document.getElementById("plazaApplicationProgressText");
const plazaApplicationProgressBar = document.getElementById("plazaApplicationProgressBar");

const plazaAppMembershipType = document.getElementById("plazaAppMembershipType");
const plazaAppEmail = document.getElementById("plazaAppEmail");
const plazaAppFullName = document.getElementById("plazaAppFullName");
const plazaAppAge = document.getElementById("plazaAppAge");
const plazaAppCurrentProject = document.getElementById("plazaAppCurrentProject");
const plazaAppResourcesNeeded = document.getElementById("plazaAppResourcesNeeded");
const plazaAppJoinedAt = document.getElementById("plazaAppJoinedAt");
const plazaAppLearntSoFar = document.getElementById("plazaAppLearntSoFar");
const plazaAppContribution = document.getElementById("plazaAppContribution");
const plazaAppWantsPatron = document.getElementById("plazaAppWantsPatron");
const plazaAppPatronExpectation = document.getElementById("plazaAppPatronExpectation");
const plazaAppLeadershipExperience = document.getElementById("plazaAppLeadershipExperience");
const plazaAppCountry = document.getElementById("plazaAppCountry");
const plazaAppWantsMarketplace = document.getElementById("plazaAppWantsMarketplace");
const plazaAppServicesProducts = document.getElementById("plazaAppServicesProducts");
const plazaAppReferredBy = document.getElementById("plazaAppReferredBy");
const plazaAppHowHeard = document.getElementById("plazaAppHowHeard");

const plazaAppJoinedLabel = document.getElementById("plazaAppJoinedLabel");
const plazaAppLearntLabel = document.getElementById("plazaAppLearntLabel");
const plazaAppContributionLabel = document.getElementById("plazaAppContributionLabel");

const plazaPatronYesFields = document.getElementById("plazaPatronYesFields");
const plazaCountryField = document.getElementById("plazaCountryField");
const plazaMarketplaceFields = document.getElementById("plazaMarketplaceFields");
const plazaServicesProductsField = document.getElementById("plazaServicesProductsField");
const plazaReferralField = document.getElementById("plazaReferralField");
const plazaHowHeardField = document.getElementById("plazaHowHeardField");

function getSourceLabel(source) {
  if (source === "academy") return "YHA";
  if (source === "federation") return "YHF";
  return "YHA + YHF";
}

function getDivisionLabel(division) {
  if (division === "academy") return "Academy";
  if (division === "federation") return "Federation";
  return "Both";
}

function getTrustLabel(trust) {
  if (trust === "connector") return "Trusted Connector";
  if (trust === "leader") return "Local Leader";
  return "Verified";
}

function getVisibilityLabel(item) {
  if (item.division === "federation") return "Screened Preview";
  if (item.division === "both") return "Bridge Preview";
  return "Open Profile";
}

function getDirectoryActionLabel(item) {
  if (item.division === "federation") return "Request Screened Intro";
  if (item.division === "both") return "Open Bridge Request";
  return "Request Connection";
}

function getBridgeLaneLabel(lane) {
  if (lane === "academy") return "YHA";
  if (lane === "federation") return "YHF";
  return "YHA + YHF";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

const REQUEST_STATUS_FLOW = ["Draft", "Submitted", "Under Review", "Matched", "Closed"];

function getRequestRouteKey(sourceType, objective) {
  const raw = String(sourceType || "").trim().toLowerCase();
  const normalizedObjective = normalizeObjective(objective);

  if (raw === "feed-introduction") return "intro-routing";
  if (raw === "member-connection") return "member-routing";
  if (raw === "member-screened") return "screened-routing";
  if (raw === "member-bridge" || raw === "bridge") return "bridge-routing";
  if (raw === "opportunity") return "opportunity-routing";
  if (raw === "project") return "project-routing";
  if (raw === "region") return "regional-routing";

  if (normalizedObjective === "Introduction") return "intro-routing";
  if (normalizedObjective === "Collaboration") return "collaboration-routing";
  if (normalizedObjective === "Partnership") return "partnership-routing";
  if (normalizedObjective === "Access") return "access-routing";
  if (normalizedObjective === "Hiring") return "hiring-routing";
  if (normalizedObjective === "Support") return "support-routing";
  if (normalizedObjective === "Project request") return "project-routing";
  if (normalizedObjective === "Regional connection") return "regional-routing";
  if (normalizedObjective === "Bridge request") return "bridge-routing";

  return "general-routing";
}

function getRequestRouteLabel(sourceType, objective) {
  const routeKey = getRequestRouteKey(sourceType, objective);

  if (routeKey === "intro-routing") return "Introduction routing";
  if (routeKey === "member-routing") return "Member connection routing";
  if (routeKey === "screened-routing") return "Screened intro routing";
  if (routeKey === "bridge-routing") return "Bridge escalation routing";
  if (routeKey === "opportunity-routing") return "Opportunity response routing";
  if (routeKey === "project-routing") return "Project fit routing";
  if (routeKey === "regional-routing") return "Regional routing";
  if (routeKey === "collaboration-routing") return "Collaboration routing";
  if (routeKey === "partnership-routing") return "Partnership routing";
  if (routeKey === "access-routing") return "Access routing";
  if (routeKey === "hiring-routing") return "Hiring routing";
  if (routeKey === "support-routing") return "Support routing";
  return "General Plaza routing";
}

function normalizeObjective(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) return "Connection request";
  if (raw.includes("intro")) return "Introduction";
  if (raw.includes("collab")) return "Collaboration";
  if (raw.includes("partner")) return "Partnership";
  if (raw.includes("access")) return "Access";
  if (raw.includes("hir")) return "Hiring";
  if (raw.includes("support")) return "Support";
  if (raw.includes("project")) return "Project request";
  if (raw.includes("regional") || raw.includes("region")) return "Regional connection";
  if (raw.includes("bridge")) return "Bridge request";

  return "Connection request";
}

function normalizeRequestStatus(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) return "Submitted";
  if (raw === "draft") return "Draft";
  if (raw === "submitted") return "Submitted";
  if (raw === "under review" || raw === "pending review" || raw === "review") return "Under Review";
  if (raw === "matched") return "Matched";
  if (raw === "closed") return "Closed";

  return "Submitted";
}

function getRequestStatusIndex(status) {
  return REQUEST_STATUS_FLOW.indexOf(normalizeRequestStatus(status));
}

function getRequestStatusClass(status) {
  return normalizeRequestStatus(status).toLowerCase().replace(/\s+/g, "-");
}

function getRequestStatusNote(status) {
  const normalized = normalizeRequestStatus(status);

  if (normalized === "Draft") return "Started but not yet formally sent.";
  if (normalized === "Submitted") return "Sent into Plaza and waiting for review logic.";
  if (normalized === "Under Review") return "Being screened, evaluated, or routed.";
  if (normalized === "Matched") return "A relevant person, lane, or path has been matched.";
  if (normalized === "Closed") return "This request flow has been completed or ended.";

  return "Structured request state inside Plaza.";
}

function getRequestLikelyRoute(item) {
  if (item?.likelyRoute) {
    return item.likelyRoute;
  }

  const sourceType = String(item?.sourceType || "").trim().toLowerCase();
  const targetLabel = String(item?.targetLabel || "this request");
  const region = String(item?.region || "").trim();

  if (sourceType === "member-screened") {
    return `Likely route: screened intro review for ${targetLabel}${region ? ` in ${region}` : ""}.`;
  }

  if (sourceType === "member-bridge" || sourceType === "bridge") {
    return `Likely route: bridge validation and cross-division escalation${region ? ` in ${region}` : ""}.`;
  }

  if (sourceType === "region") {
    return `Likely route: regional routing toward a local connector or visible node${region ? ` in ${region}` : ""}.`;
  }

  if (sourceType === "project") {
    return `Likely route: project fit review and role matching for ${targetLabel}.`;
  }

  if (sourceType === "opportunity") {
    return `Likely route: opportunity screening and response matching for ${targetLabel}.`;
  }

  if (sourceType === "feed-introduction" || sourceType === "member-connection") {
    return "Likely route: structured intro screening before any deeper connection is opened.";
  }

  return "Likely route: Plaza reviews the request and decides the cleanest next path.";
}

function getRequestSuggestedMatches(item) {
  if (safeArray(item?.suggestedMatches).length) {
    return safeArray(item.suggestedMatches);
  }

  const sourceType = String(item?.sourceType || "").trim().toLowerCase();
  const region = String(item?.region || "").trim();

  if (sourceType === "opportunity") {
    return plazaAdapter.getRelatedMembers(region).slice(0, 4).map((member) => member.name);
  }

  if (sourceType === "region") {
    return plazaAdapter.getRegionMembers(region).slice(0, 4).map((member) => member.name);
  }

  if (sourceType === "bridge" || sourceType === "member-bridge") {
    return plazaAdapter.getRegionBridge(region).slice(0, 4).map((entry) => entry.title);
  }

  if (sourceType === "project") {
    return plazaAdapter.getRelatedMembers(region).slice(0, 4).map((member) => member.name);
  }

  if (sourceType === "member-screened" || sourceType === "feed-introduction" || sourceType === "member-connection") {
    return plazaAdapter.getRelatedMembers(region).slice(0, 4).map((member) => member.name);
  }

  return [];
}

function getRequestSourceLabel(sourceType) {
  const raw = String(sourceType || "").trim().toLowerCase();

  if (raw === "feed-introduction") return "Introduction signal";
  if (raw === "member-connection") return "Directory connection";
  if (raw === "member-screened") return "Screened intro";
  if (raw === "member-bridge") return "Bridge member request";
  if (raw === "opportunity") return "Opportunity response";
  if (raw === "project") return "Project request";
  if (raw === "region") return "Regional request";
  if (raw === "bridge") return "Bridge request";
  return "General Plaza request";
}

function getRequestNextStepCopy(sourceType, status) {
  const normalizedStatus = normalizeRequestStatus(status);
  const raw = String(sourceType || "").trim().toLowerCase();

  if (normalizedStatus === "Draft") {
    return "Next likely move: submit this draft so Plaza can start deterministic routing.";
  }

  if (normalizedStatus === "Submitted") {
    if (raw === "member-screened") return "Next likely move: screened intro review before any deeper access.";
    if (raw === "member-bridge" || raw === "bridge") return "Next likely move: bridge fit check to see whether this should escalate cross-division.";
    if (raw === "region") return "Next likely move: regional routing toward the right local node or connector.";
    if (raw === "project") return "Next likely move: project fit check and involvement review.";
    if (raw === "opportunity") return "Next likely move: opportunity response review and matching.";
    return "Next likely move: Plaza reviews the request and decides the correct route.";
  }

  if (normalizedStatus === "Under Review") {
    return "Current move: Plaza is screening relevance, fit, and routing.";
  }

  if (normalizedStatus === "Matched") {
    return "Current move: a useful person, lane, or next path has already been identified.";
  }

  if (normalizedStatus === "Closed") {
    return "This request flow has reached its end state.";
  }

  return "This request is inside Plaza's structured movement flow.";
}

function getRequestDeterministicNextStatus(item) {
  if (item?.deterministicNextStatus) {
    return item.deterministicNextStatus;
  }

  const normalizedStatus = normalizeRequestStatus(item?.status);

  if (normalizedStatus === "Draft") return "Submitted";
  if (normalizedStatus === "Submitted") return "Under Review";

  if (normalizedStatus === "Under Review") {
    const surfacedMatches = safeArray(item?.matchedEntityLabels);
    return surfacedMatches.length ? "Matched" : "Closed";
  }

  if (normalizedStatus === "Matched") return "Closed";
  return null;
}

function getRequestAdvanceLabel(item) {
  const nextStatus = getRequestDeterministicNextStatus(item);
  const sourceType = String(item?.sourceType || "").trim().toLowerCase();

  if (!nextStatus) return "Request Closed";

  if (nextStatus === "Submitted") {
    return "Submit request";
  }

  if (nextStatus === "Under Review") {
    if (sourceType === "member-screened") return "Start screened review";
    if (sourceType === "member-bridge" || sourceType === "bridge") return "Start bridge validation";
    if (sourceType === "region") return "Start regional routing";
    if (sourceType === "project") return "Start project review";
    if (sourceType === "opportunity") return "Start fit review";
    return "Start routing review";
  }

  if (nextStatus === "Matched") {
    if (sourceType === "member-screened") return "Confirm screened match";
    if (sourceType === "member-bridge" || sourceType === "bridge") return "Confirm bridge lane";
    if (sourceType === "region") return "Confirm regional match";
    if (sourceType === "project") return "Confirm project match";
    if (sourceType === "opportunity") return "Confirm opportunity match";
    return "Confirm match";
  }

  if (nextStatus === "Closed") {
    return "Close request";
  }

  return `Move to ${nextStatus}`;
}

function buildRequestViewModel(item) {
  const normalizedStatus = normalizeRequestStatus(item?.status);
  const normalizedObjective = normalizeObjective(item?.objective || "Connection request");
  const normalizedSourceType = String(item?.sourceType || "general");
  const routeLabel = String(
    item?.routeLabel || getRequestRouteLabel(normalizedSourceType, normalizedObjective)
  );
  const nextStatus =
    item?.deterministicNextStatus || getRequestDeterministicNextStatus(item);
  const suggestedMatches = safeArray(item?.suggestedMatches).length
    ? safeArray(item.suggestedMatches)
    : getRequestSuggestedMatches(item);
  const matchedEntityLabels = safeArray(item?.matchedEntityLabels);

  return {
    id: String(item?.id || ""),
    status: normalizedStatus,
    statusClass: getRequestStatusClass(normalizedStatus),
    objective: normalizedObjective,
    sourceType: normalizedSourceType,
    sourceLabel: getRequestSourceLabel(normalizedSourceType),
    targetId: String(item?.targetId || ""),
    targetLabel: String(item?.targetLabel || "General Plaza request"),
    message: String(item?.message || "No message added."),
    name: String(item?.name || "Unknown requester"),
    region: String(item?.region || "No region"),
    canOpenContext: !!String(item?.targetId || "").trim(),
    statusNote: getRequestStatusNote(normalizedStatus),
    nextStepCopy: getRequestNextStepCopy(normalizedSourceType, normalizedStatus),
    routeLabel,
    likelyRoute: String(item?.likelyRoute || getRequestLikelyRoute(item)),
    suggestedMatches,
    matchedEntityLabels,
    decisionSummary: String(item?.decisionSummary || `${routeLabel} is active inside Plaza.`),
    resolutionSummary: String(
      item?.resolutionSummary ||
        "Outcome will become explicit once the request reaches a matched or closed state."
    ),
    headline: String(item?.headline || ""),
    experience: String(item?.experience || ""),
    portfolioLink: String(item?.portfolioLink || ""),
    attachmentMeta: safeArray(item?.attachmentMeta).map(normalizeAttachmentMeta),
    createdAt: item?.createdAt || "",
    updatedAt: item?.updatedAt || "",
    resolvedAt: item?.resolvedAt || "",
    nextStatus,
    advanceLabel: nextStatus
      ? getRequestAdvanceLabel({
          ...item,
          status: normalizedStatus,
          sourceType: normalizedSourceType,
          deterministicNextStatus: nextStatus
        })
      : "Request Closed",
    editLabel:
      normalizedStatus === "Closed"
        ? "Edit / Reopen"
        : normalizedStatus === "Draft"
          ? "Edit Draft"
          : "Edit Request"
  };
}
function getCardFlowLabel(type) {
  const raw = String(type || "").trim().toLowerCase();

  if (raw === "introduction") return "Opens a structured intro request";
  if (raw === "opportunity") return "Opens detail, then a tracked opportunity response";
  if (raw === "project") return "Opens project detail, then a project request";
  if (raw === "win") return "Opens a simple support note";
  if (raw === "directory") return "Opens a structured member request";
  if (raw === "region") return "Opens the region hub and regional request path";
  if (raw === "bridge") return "Opens bridge detail and escalation request";
  return "Opens a structured Plaza action";
}

function renderRequestStatusFlow(status) {
  const currentIndex = getRequestStatusIndex(status);

  return `
    <div class="yh-plaza-request-flow">
      ${REQUEST_STATUS_FLOW.map((step, index) => {
        const classes = [
          "yh-plaza-request-stage",
          index < currentIndex ? "is-complete" : "",
          index === currentIndex ? "is-current" : ""
        ].filter(Boolean).join(" ");

        return `<span class="${classes}">${escapeHtml(step)}</span>`;
      }).join("")}
    </div>
  `;
}

function buildObjectiveOptions(selectedObjective) {
  return OBJECTIVE_OPTIONS.map((option) => `
    <option value="${escapeHtml(option)}"${option === selectedObjective ? " selected" : ""}>${escapeHtml(option)}</option>
  `).join("");
}

function showToast(message) {
  if (!plazaToast) return;
  plazaToast.textContent = message;
  plazaToast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    plazaToast.classList.remove("is-visible");
  }, 2200);
}

function openModal({ kicker, title, bodyHtml }) {
  if (!plazaModal || !plazaModalTitle || !plazaModalBody || !plazaModalKicker) return;
  plazaModalKicker.textContent = kicker;
  plazaModalTitle.textContent = title;
  plazaModalBody.innerHTML = bodyHtml;
  plazaModal.classList.add("is-open");
  plazaModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  if (!plazaModal) return;
  plazaModal.classList.remove("is-open");
  plazaModal.setAttribute("aria-hidden", "true");
}

function openDrawer({ kicker, title, bodyHtml }) {
  if (!plazaDrawer || !plazaDrawerTitle || !plazaDrawerBody || !plazaDrawerKicker) return;
  plazaDrawerKicker.textContent = kicker;
  plazaDrawerTitle.textContent = title;
  plazaDrawerBody.innerHTML = bodyHtml;
  plazaDrawer.classList.add("is-open");
  plazaDrawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  if (!plazaDrawer) return;
  plazaDrawer.classList.remove("is-open");
  plazaDrawer.setAttribute("aria-hidden", "true");
}

function renderMiniMemberCard(item) {
  return `
    <div class="yh-plaza-mini-card">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.role)}</span>
      <span>${escapeHtml(getTrustLabel(item.trust))} • ${escapeHtml(getDivisionLabel(item.division))}</span>
      <div class="yh-plaza-mini-card-actions">
        <button type="button" class="yh-plaza-ghost-btn" data-member-id="${escapeHtml(item.id)}">${escapeHtml(getDirectoryActionLabel(item))}</button>
      </div>
    </div>
  `;
}

function renderMiniOpportunityCard(item) {
  return `
    <div class="yh-plaza-mini-card">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.type)} • ${escapeHtml(item.region)}</span>
      <span>${escapeHtml(item.action)}</span>
      <div class="yh-plaza-mini-card-actions">
        <button type="button" class="yh-plaza-ghost-btn" data-opportunity-id="${escapeHtml(item.id)}">Open Opportunity Detail</button>
      </div>
    </div>
  `;
}

function renderMiniBridgeCard(item) {
  return `
    <div class="yh-plaza-mini-card">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.stage)} • ${escapeHtml(item.region)}</span>
      <span>${escapeHtml(getBridgeLaneLabel(item.left))} → ${escapeHtml(getBridgeLaneLabel(item.right))}</span>
      <div class="yh-plaza-mini-card-actions">
        <button type="button" class="yh-plaza-ghost-btn" data-bridge-id="${escapeHtml(item.id)}">Open Bridge Detail</button>
      </div>
    </div>
  `;
}

function renderRequestCard(item) {
  const viewModel = buildRequestViewModel(item);

  return `
        <article class="yh-plaza-request-card" data-request-card="${escapeHtml(viewModel.id)}">
      <div class="yh-plaza-request-card-head">
        <div>
          <span class="yh-plaza-request-status is-${escapeHtml(viewModel.statusClass)}">${escapeHtml(viewModel.status)}</span>
          <h3>${escapeHtml(viewModel.objective)}</h3>
        </div>
        <span class="yh-plaza-view-chip">${escapeHtml(viewModel.sourceLabel)}</span>
      </div>

      <div class="yh-plaza-request-summary">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Target</div>
        <p>${escapeHtml(viewModel.targetLabel)}</p>
      </div>

      <div class="yh-plaza-request-summary">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Your request</div>
        <p>${escapeHtml(viewModel.message)}</p>
      </div>

      <div class="yh-plaza-directory-meta">
        <span>${escapeHtml(viewModel.name)}</span>
        <span>${escapeHtml(viewModel.region)}</span>
        <span>${escapeHtml(viewModel.objective)}</span>
      </div>

      <div class="yh-plaza-request-next">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Current state</div>
        <div class="yh-plaza-card-note">${escapeHtml(viewModel.statusNote)}</div>
        <div class="yh-plaza-card-note">${escapeHtml(viewModel.nextStepCopy)}</div>
      </div>

      ${renderRequestStatusFlow(viewModel.status)}

      <div class="yh-plaza-request-section">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Deterministic route</div>
        <div class="yh-plaza-card-note">${escapeHtml(viewModel.routeLabel)}</div>
        <div class="yh-plaza-card-note">${escapeHtml(viewModel.likelyRoute)}</div>
      </div>

            <div class="yh-plaza-request-section">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Suggested matches</div>
        ${
          viewModel.suggestedMatches.length
            ? `
              <div class="yh-plaza-request-match-list">
                ${viewModel.suggestedMatches.map((label) => `<span class="yh-plaza-request-match-chip">${escapeHtml(label)}</span>`).join("")}
              </div>
            `
            : `<div class="yh-plaza-card-note">No exact suggested match has been surfaced yet.</div>`
        }
      </div>

      ${
        viewModel.objective === "Hiring" || viewModel.attachmentMeta.length || viewModel.headline || viewModel.portfolioLink
          ? `
            <div class="yh-plaza-request-section">
              <div class="yh-plaza-card-note yh-plaza-card-note-strong">Application package</div>
              ${viewModel.headline ? `<div class="yh-plaza-card-note">${escapeHtml(viewModel.headline)}</div>` : ""}
              ${viewModel.experience ? `<div class="yh-plaza-card-note">${escapeHtml(viewModel.experience)}</div>` : ""}
              ${viewModel.portfolioLink ? `<div class="yh-plaza-card-note">Portfolio: ${escapeHtml(viewModel.portfolioLink)}</div>` : ""}
              ${
                viewModel.attachmentMeta.length
                  ? `<div class="yh-plaza-attachment-list">${viewModel.attachmentMeta.map((attachment) => `<span class="yh-plaza-attachment-chip">${escapeHtml(attachment.name)} • ${escapeHtml(attachment.sizeLabel)}</span>`).join("")}</div>`
                  : `<div class="yh-plaza-card-note">No resume metadata attached yet.</div>`
              }
            </div>
          `
          : ""
      }

      <div class="yh-plaza-request-section">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Decision layer</div>
        <div class="yh-plaza-card-note">${escapeHtml(viewModel.decisionSummary)}</div>
        <div class="yh-plaza-card-note">${escapeHtml(viewModel.resolutionSummary)}</div>
        ${
          viewModel.matchedEntityLabels.length
            ? `
              <div class="yh-plaza-request-match-list">
                ${viewModel.matchedEntityLabels.map((label) => `<span class="yh-plaza-request-match-chip">${escapeHtml(label)}</span>`).join("")}
              </div>
            `
            : ""
        }
        ${
          viewModel.resolvedAt
            ? `<div class="yh-plaza-card-note">Resolved ${escapeHtml(formatDate(viewModel.resolvedAt))}</div>`
            : ""
        }
      </div>

      <div class="yh-plaza-card-note">
        Created ${escapeHtml(formatDate(viewModel.createdAt))}
        ${viewModel.updatedAt ? ` • Updated ${escapeHtml(formatDate(viewModel.updatedAt))}` : ""}
      </div>

      <div class="yh-plaza-mini-card-actions">
        ${viewModel.canOpenContext ? `
          <button
            type="button"
            class="yh-plaza-ghost-btn"
            data-request-open-context="${escapeHtml(viewModel.id)}"
          >
            Open Related Context
          </button>
        ` : ""}

        <button
          type="button"
          class="yh-plaza-ghost-btn"
          data-request-edit="${escapeHtml(viewModel.id)}"
        >
          ${escapeHtml(viewModel.editLabel)}
        </button>

        ${viewModel.status !== "Closed" ? `
          <button
            type="button"
            class="yh-plaza-ghost-btn"
            data-request-close="${escapeHtml(viewModel.id)}"
          >
            Close Now
          </button>
        ` : ""}

        ${viewModel.nextStatus ? `
          <button
            type="button"
            class="yh-plaza-ghost-btn"
            data-request-advance="${escapeHtml(viewModel.id)}"
          >
            ${escapeHtml(viewModel.advanceLabel)}
          </button>
        ` : `
          <button
            type="button"
            class="yh-plaza-ghost-btn"
            disabled
          >
            Request Closed
          </button>
        `}

        <button
          type="button"
          class="yh-plaza-ghost-btn"
          data-request-delete="${escapeHtml(viewModel.id)}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

function clearContextTargets() {
  document.querySelectorAll(".is-context-target").forEach((node) => {
    node.classList.remove("is-context-target");
  });
}

function focusContextCard(selector, successMessage) {
  window.requestAnimationFrame(() => {
    const card = document.querySelector(selector);

    if (!card) {
      if (successMessage) {
        showToast(successMessage);
      }
      return;
    }

    clearContextTargets();
    card.classList.add("is-context-target");

    if (typeof card.scrollIntoView === "function") {
      card.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest"
      });
    }

    window.setTimeout(() => {
      card.classList.remove("is-context-target");
    }, 2600);

    if (successMessage) {
      showToast(successMessage);
    }
  });
}
function setActiveNav(navTab) {
  plazaTabs.forEach((tab) => {
    const isActive = !!navTab && tab.dataset.plazaTab === navTab;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  plazaNavButtons.forEach((button) => {
    button.classList.toggle("is-active", !!navTab && button.dataset.navTab === navTab);
  });
}

function toggleToolbars(screenName) {
  const config = plazaConfig[screenName] || plazaConfig.feed;
  if (plazaFeedToolbar) plazaFeedToolbar.hidden = config.toolbar !== "feed";
  if (plazaDirectoryToolbar) plazaDirectoryToolbar.hidden = config.toolbar !== "directory";
}

function updateWorkspaceChrome(screenName) {
  const config = plazaConfig[screenName] || plazaConfig.feed;
  if (plazaWorkspaceTitle) plazaWorkspaceTitle.textContent = config.title;
  if (plazaWorkspaceNote) plazaWorkspaceNote.textContent = config.note;
  setActiveNav(config.navTab || null);
  toggleToolbars(screenName);

  const isPrimaryScreen = PRIMARY_SCREENS.has(screenName);
  if (plazaScreenContext) {
    plazaScreenContext.hidden = isPrimaryScreen;
  }

  if (plazaScreenBreadcrumbs) {
    plazaScreenBreadcrumbs.innerHTML = safeArray(config.breadcrumb)
      .map((item) => `<span>${escapeHtml(item)}</span>`)
      .join(`<span class="yh-plaza-screen-separator" aria-hidden="true">/</span>`);
  }

  if (plazaScreenBackBtn) {
    plazaScreenBackBtn.hidden = isPrimaryScreen;
  }
}

function openScreen(screenName, options = {}) {
  const nextScreenName = String(screenName || "feed").trim() || "feed";
  const current = plazaRuntime.currentScreen;
  const shouldShowLoader =
    options.showLoader !== false &&
    current &&
    current !== nextScreenName;

  if (shouldShowLoader) {
    showPlazaTabLoader(nextScreenName);
  }

  if (options.resetHistory) {
    plazaRuntime.history = [];
  } else if (options.pushHistory !== false && current && current !== nextScreenName) {
    plazaRuntime.history.push(current);
  }

  plazaRuntime.previousScreen = current || "feed";
  plazaRuntime.currentScreen = nextScreenName;

  plazaScreens.forEach((screen) => {
    const isActive = screen.dataset.plazaScreen === nextScreenName;
    screen.classList.toggle("is-active", isActive);
    screen.hidden = !isActive;
  });

  updateWorkspaceChrome(nextScreenName);
  savePlazaUiState();

  if (shouldShowLoader) {
    window.requestAnimationFrame(() => {
      window.setTimeout(hidePlazaTabLoader, 260);
    });
  }
}

function goBackFromScreen() {
  const fallback = PRIMARY_SCREENS.has(plazaRuntime.previousScreen) ? plazaRuntime.previousScreen : "feed";
  const target = plazaRuntime.history.pop() || fallback;
  openScreen(target, { pushHistory: false });
}

function resetPlazaToOverview() {
  closeModal();
  closeDrawer();

  plazaRuntime.feedFilter = "all";

  if (plazaRegionFilter) plazaRegionFilter.value = "all";
  if (plazaDivisionFilter) plazaDivisionFilter.value = "all";
  if (plazaTrustFilter) plazaTrustFilter.value = "all";

  plazaFeedFilters.forEach((item) => item.classList.toggle("is-active", item.dataset.feedFilter === "all"));

  renderFeed("all");
  renderDirectory();
  renderRequestsPreview();
  openScreen("feed", { resetHistory: true, pushHistory: false });
}

function renderStats() {
  const stats = plazaAdapter.getStats();

  const activeMembersValue = document.getElementById("plazaActiveMembersValue");
  const openOpportunitiesValue = document.getElementById("plazaOpenOpportunitiesValue");
  const regionsValue = document.getElementById("plazaRegionsValue");
  const verifiedConnectorsValue = document.getElementById("plazaVerifiedConnectorsValue");

  if (activeMembersValue) activeMembersValue.textContent = String(stats.activeMembers || 0);
  if (openOpportunitiesValue) openOpportunitiesValue.textContent = String(stats.openOpportunities || 0);
  if (regionsValue) regionsValue.textContent = String(stats.regions || 0);
  if (verifiedConnectorsValue) verifiedConnectorsValue.textContent = String(stats.verifiedConnectors || 0);
}

function renderFeed(filter = "all") {
  if (!plazaFeedGrid) return;

  const normalizedFilter = String(filter || "all").trim().toLowerCase();
  const sourceItems = plazaServerFeedLoaded
    ? plazaServerFeedItems
    : plazaAdapter.getFeed("all");

  const items = normalizedFilter === "all"
    ? sourceItems
    : sourceItems.filter((item) => String(item.type || "").toLowerCase() === normalizedFilter);

  if (!items.length) {
    plazaFeedGrid.innerHTML = `<div class="yh-plaza-empty">No Plaza feed activity yet.</div>`;
    return;
  }

  plazaFeedGrid.innerHTML = items.map((item) => {
    const buttonLabel = item.type === "opportunity"
      ? "Open Opportunity Detail"
      : item.type === "project"
        ? "Open Project Detail"
        : item.action;

    return `
      <article class="yh-plaza-feed-card" data-context-card="feed" data-context-id="${escapeHtml(item.id)}">
        <div class="yh-plaza-feed-card-head">
          <span class="yh-plaza-feed-tag">${escapeHtml(item.tag)}</span>
          <span class="yh-plaza-feed-tag">${escapeHtml(getSourceLabel(item.source))}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <div class="yh-plaza-feed-meta">
          <span>${escapeHtml(item.member)}</span>
          <span>${escapeHtml(item.region)}</span>
          <span>${escapeHtml(getDivisionLabel(item.division))}</span>
        </div>
        <div class="yh-plaza-card-actions">
          <button type="button" class="yh-plaza-ghost-btn" data-feed-id="${escapeHtml(item.id)}">${escapeHtml(buttonLabel)}</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderDirectory() {
  if (!plazaDirectoryGrid) return;

  const filters = {
    region: plazaRegionFilter?.value || "all",
    division: plazaDivisionFilter?.value || "all",
    trust: plazaTrustFilter?.value || "all"
  };

  const sourceItems = plazaServerDirectoryLoaded
    ? plazaServerDirectory
    : plazaAdapter.getDirectory(filters);

  const items = plazaServerDirectoryLoaded
    ? sourceItems.filter((item) => {
        const regionMatch = filters.region === "all" || item.region === filters.region;
        const divisionMatch = filters.division === "all" || item.division === filters.division;
        const trustMatch = filters.trust === "all" || item.trust === filters.trust;
        return regionMatch && divisionMatch && trustMatch;
      })
    : sourceItems;

  if (!items.length) {
    plazaDirectoryGrid.innerHTML = `<div class="yh-plaza-empty">No Plaza directory members yet.</div>`;
    return;
  }

  plazaDirectoryGrid.innerHTML = items.map((item) => `
    <article class="yh-plaza-directory-card">
      <div class="yh-plaza-directory-card-head">
        <span class="yh-plaza-directory-badge">${escapeHtml(getDivisionLabel(item.division))}</span>
        <span class="yh-plaza-directory-badge">${escapeHtml(getTrustLabel(item.trust))}</span>
      </div>

      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.focus)}</p>

      <div class="yh-plaza-directory-meta">
        <span>${escapeHtml(item.role)}</span>
        <span>${escapeHtml(item.region)}</span>
      </div>

      ${(item.availability || item.workMode || item.marketplaceMode === "yes") ? `
        <div class="yh-plaza-directory-meta yh-plaza-directory-meta-secondary">
          ${item.availability ? `<span>${escapeHtml(item.availability)}</span>` : ""}
          ${item.workMode ? `<span>${escapeHtml(item.workMode)}</span>` : ""}
          ${item.marketplaceMode === "yes" ? `<span>Marketplace</span>` : ""}
        </div>
      ` : ""}

      <div class="yh-plaza-card-tags">
        ${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>

      ${Array.isArray(item.lookingFor) && item.lookingFor.length ? `
        <div class="yh-plaza-directory-signal-block">
          <div class="yh-plaza-directory-signal-label">Looking For</div>
          <div class="yh-plaza-directory-signal-list">
            ${item.lookingFor.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}
          </div>
        </div>
      ` : ""}

      ${Array.isArray(item.canOffer) && item.canOffer.length ? `
        <div class="yh-plaza-directory-signal-block">
          <div class="yh-plaza-directory-signal-label">Can Offer</div>
          <div class="yh-plaza-directory-signal-list">
            ${item.canOffer.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}
          </div>
        </div>
      ` : ""}

      <div class="yh-plaza-card-actions">
        <button type="button" class="yh-plaza-ghost-btn" data-member-id="${escapeHtml(item.id)}">Request Connection</button>
      </div>
    </article>
  `).join("");
}

function renderOpportunities() {
  if (!plazaOpportunityGrid) return;

  const items = plazaServerOpportunitiesLoaded
    ? plazaServerOpportunities
    : plazaAdapter.getOpportunities();

  if (!items.length) {
    plazaOpportunityGrid.innerHTML = `<div class="yh-plaza-empty">No Plaza opportunities yet.</div>`;
    return;
  }

  plazaOpportunityGrid.innerHTML = items.map((item) => {
    const pathClass = getPlazaOpportunityPathClass(item);

    return `
      <article class="yh-plaza-opportunity-card ${escapeHtml(pathClass)}" data-economy-mode="${escapeHtml(item.economyMode)}">
        <div class="yh-plaza-opportunity-card-head">
          ${renderPlazaOpportunityChips(item)}
        </div>

        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>

        ${renderPlazaOpportunityEconomyPanel(item)}

        <div class="yh-plaza-card-actions">
          <button type="button" class="yh-plaza-ghost-btn" data-opportunity-id="${escapeHtml(item.id)}">
            ${escapeHtml(getPlazaOpportunityPrimaryActionLabel(item))}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderRegions() {
  if (!plazaRegionGrid) return;

  const items = plazaServerRegionsLoaded
    ? plazaServerRegions
    : plazaAdapter.getRegions();

  if (!items.length) {
    plazaRegionGrid.innerHTML = `<div class="yh-plaza-empty">No regional hubs yet.</div>`;
    return;
  }

  plazaRegionGrid.innerHTML = items.map((item) => `
    <article class="yh-plaza-region-card">
      <div class="yh-plaza-region-card-head">
        <span class="yh-plaza-region-badge">${escapeHtml(item.label)}</span>
        <span class="yh-plaza-region-badge">${escapeHtml(String(item.count))} members</span>
      </div>
      <h3>${escapeHtml(item.region)}</h3>
      <p>${escapeHtml(item.text)}</p>
      <div class="yh-plaza-card-actions">
        <button type="button" class="yh-plaza-ghost-btn" data-region-id="${escapeHtml(item.id)}">Enter Region Hub</button>
      </div>
    </article>
  `).join("");
}

function renderBridge() {
  if (!plazaBridgeGrid) return;

  const items = plazaServerBridgeLoaded
    ? plazaServerBridge
    : plazaAdapter.getBridge();

  if (!items.length) {
    plazaBridgeGrid.innerHTML = `<div class="yh-plaza-empty">No bridge paths are visible yet.</div>`;
    return;
  }

  plazaBridgeGrid.innerHTML = items.map((item) => `
    <article class="yh-plaza-bridge-card">
      <div class="yh-plaza-bridge-card-head">
        <span class="yh-plaza-region-badge">${escapeHtml(item.stage)}</span>
        <span class="yh-plaza-region-badge">${escapeHtml(item.region)}</span>
      </div>
      <div class="yh-plaza-bridge-lanes">
        <span class="yh-plaza-bridge-lane">${escapeHtml(getBridgeLaneLabel(item.left))}</span>
        <span class="yh-plaza-bridge-arrow" aria-hidden="true">→</span>
        <span class="yh-plaza-bridge-lane">${escapeHtml(getBridgeLaneLabel(item.right))}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
      <div class="yh-plaza-card-actions">
        <button type="button" class="yh-plaza-ghost-btn" data-bridge-id="${escapeHtml(item.id)}">Open Bridge Detail</button>
      </div>
    </article>
  `).join("");
}

function populateRegionFilter() {
  if (!plazaRegionFilter) return;

  const directoryItems = plazaServerDirectoryLoaded
    ? plazaServerDirectory
    : plazaAdapter.getState().directory;

  const regions = new Set(directoryItems.map((item) => item.region).filter(Boolean));

  plazaRegionFilter.innerHTML = `<option value="all">All Regions</option>`;

  Array.from(regions).sort().forEach((region) => {
    const option = document.createElement("option");
    option.value = region;
    option.textContent = region;
    plazaRegionFilter.appendChild(option);
  });
}

function renderRailSignals() {
  if (!plazaRailSignals) return;

  const signalItems = [
    ...plazaAdapter.getFeed("all").slice(0, 2).map((item) => ({
      title: item.title,
      note: `${item.member} • ${item.region}`
    })),
    ...plazaAdapter.getBridge().slice(0, 1).map((item) => ({
      title: item.title,
      note: `${item.stage} • ${item.region}`
    }))
  ];

  if (!signalItems.length) {
    plazaRailSignals.innerHTML = `<div class="yh-plaza-empty">No recent signals yet.</div>`;
    return;
  }

  plazaRailSignals.innerHTML = signalItems.map((item) => `
    <article class="yh-plaza-rail-mini">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.note)}</span>
    </article>
  `).join("");
}

function renderRequestsPreview() {
  if (!plazaRequestsPreview) return;

  const sourceItems = plazaServerRequestsLoaded
    ? plazaServerRequests
    : plazaAdapter.getRequests();

  const items = sourceItems.slice(0, 2);

  if (!items.length) {
    plazaRequestsPreview.innerHTML = `<div class="yh-plaza-empty">No requests yet. Start one from a member card, opportunity, region hub, or bridge path.</div>`;
    return;
  }

  plazaRequestsPreview.innerHTML = items.map((item) => `
    <article class="yh-plaza-rail-mini" data-rail-request-open="${escapeHtml(item.id)}">
      <strong>${escapeHtml(item.objective || "Request")}</strong>
      <span>${escapeHtml(item.status)} • ${escapeHtml(formatDate(item.createdAt))}</span>
    </article>
  `).join("");
}
function renderRequestsScreen() {
  if (!plazaRequestsScreenList) return;

  const items = plazaServerRequestsLoaded
    ? plazaServerRequests
    : plazaAdapter.getRequests();

  plazaRequestsScreenList.innerHTML = items.length
    ? items.map(renderRequestCard).join("")
    : `<div class="yh-plaza-empty">No requests yet. Use the form above or request a connection from a directory card, opportunity, bridge lane, or region hub.</div>`;
}

function getIncomingStatusClass(status) {
  return normalizeIncomingStatus(status).toLowerCase().replace(/\s+/g, "-");
}

function getIncomingStatusNote(item) {
  const normalized = normalizeIncomingStatus(item?.status);

  if (normalized === "New") {
    return item?.kind === "support-note"
      ? "Delivered but not yet acknowledged or converted to conversation."
      : "Delivered to the queue owner and waiting for first review action.";
  }

  if (normalized === "Under Review") {
    return "A queue owner is actively screening the fit, route, or package.";
  }

  if (normalized === "Matched") {
    return "A valid next step exists and is ready to become a conversation.";
  }

  if (normalized === "Conversation Opened") {
    return "This intake item already opened a live Plaza conversation.";
  }

  return "This intake item has been closed for now.";
}

function getIncomingKindLabel(kind) {
  const normalized = normalizeIncomingKind(kind);
  if (normalized === "application") return "Application";
  if (normalized === "support-note") return "Support Note";
  return "Incoming Request";
}

function renderRoleFilterRow(container, activeRole, actionAttr, items) {
  if (!container) return;

  container.innerHTML = INBOX_ROLE_OPTIONS.map((role) => {
    const count =
      role.key === "all"
        ? items.length
        : items.filter((item) => normalizeQueueRole(item.queueRole || item.audienceRole) === role.key).length;

    return `
      <button
        type="button"
        class="yh-plaza-role-chip ${role.key === activeRole ? "is-active" : ""}"
        ${actionAttr}="${escapeHtml(role.key)}"
      >
        <span>${escapeHtml(role.label)}</span>
        <span class="yh-plaza-role-chip-count">${escapeHtml(String(count))}</span>
      </button>
    `;
  }).join("");
}

function renderInboxCard(item) {
  return `
    <article class="yh-plaza-inbox-card">
      <div class="yh-plaza-inbox-card-head">
        <div>
          <span class="yh-plaza-queue-chip">${escapeHtml(getQueueRoleLabel(item.queueRole))}</span>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
        <div class="yh-plaza-inline-actions">
          <span class="yh-plaza-kind-chip is-${escapeHtml(normalizeIncomingKind(item.kind))}">${escapeHtml(getIncomingKindLabel(item.kind))}</span>
          <span class="yh-plaza-incoming-status is-${escapeHtml(getIncomingStatusClass(item.status))}">${escapeHtml(item.status)}</span>
        </div>
      </div>

      <p>${escapeHtml(item.summary || "No intake summary added yet.")}</p>

      <div class="yh-plaza-inbox-meta">
        <span>${escapeHtml(item.senderName)}</span>
        <span>${escapeHtml(item.targetLabel)}</span>
        <span>${escapeHtml(item.region || "No region")}</span>
        <span>${escapeHtml(item.routeLabel || "Plaza intake")}</span>
      </div>

      <div class="yh-plaza-flow-note">
        <strong>Current lane:</strong>
        <span>${escapeHtml(getIncomingStatusNote(item))}</span>
      </div>

      ${
        safeArray(item.attachments).length
          ? `
            <div class="yh-plaza-attachment-list">
              ${item.attachments.map((attachment) => `<span class="yh-plaza-attachment-chip">${escapeHtml(attachment.name)} • ${escapeHtml(attachment.sizeLabel)}</span>`).join("")}
            </div>
          `
          : ""
      }

      <div class="yh-plaza-inline-actions">
        <button type="button" class="yh-plaza-ghost-btn" data-inbox-open="${escapeHtml(item.id)}">Open Intake</button>
        ${
          item.conversationId
            ? `<button type="button" class="yh-plaza-ghost-btn" data-conversation-open="${escapeHtml(item.conversationId)}">Open Conversation</button>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderNotificationCard(item) {
  return `
    <article class="yh-plaza-notification-card">
      <div class="yh-plaza-notification-card-head">
        <div>
          <span class="yh-plaza-queue-chip">${escapeHtml(item.audienceRole === "all" ? "All queues" : getQueueRoleLabel(item.audienceRole))}</span>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
        <span class="yh-plaza-notification-status is-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
      </div>

      <p>${escapeHtml(item.text)}</p>

      <div class="yh-plaza-notification-meta">
        <span>${escapeHtml(formatDate(item.createdAt))}</span>
        <span>${escapeHtml(titleCase(item.relatedType || "general"))}</span>
      </div>

      <div class="yh-plaza-inline-actions">
        <button type="button" class="yh-plaza-ghost-btn" data-notification-open="${escapeHtml(item.id)}">Open</button>
      </div>
    </article>
  `;
}

function renderMessageCard(item) {
  const lastMessage = safeArray(item.messages).slice(-1)[0];

  return `
    <article class="yh-plaza-message-card">
      <div class="yh-plaza-message-card-head">
        <div>
          <span class="yh-plaza-queue-chip">${escapeHtml(getQueueRoleLabel(item.queueRole))}</span>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
        <span class="yh-plaza-kind-chip">${escapeHtml(item.status)}</span>
      </div>

      <p>${escapeHtml(lastMessage?.text || "Conversation opened but no reply has been sent yet.")}</p>

      <div class="yh-plaza-message-meta">
        <span>${escapeHtml(item.targetLabel)}</span>
        <span>${escapeHtml(item.contextRoute || "Plaza conversation")}</span>
        <span>${escapeHtml(formatDate(item.updatedAt))}</span>
      </div>

      <div class="yh-plaza-inline-actions">
        <button type="button" class="yh-plaza-ghost-btn" data-conversation-open="${escapeHtml(item.id)}">Open Conversation</button>
      </div>
    </article>
  `;
}

function renderInboxScreen() {
  const allItems = plazaOpsAdapter.getInbox({ role: "all" });
  const roleValue = plazaRuntime.activeInboxRole || "all";
  const items = plazaOpsAdapter.getInbox({ role: roleValue });

  renderRoleFilterRow(plazaInboxRoleFilters, roleValue, 'data-inbox-role', allItems);

  if (plazaInboxMeta) {
    const activeCount = allItems.filter((item) => item.status !== "Closed").length;
    const conversationCount = allItems.filter((item) => !!item.conversationId).length;
    plazaInboxMeta.innerHTML = [
      `${activeCount} active`,
      `${conversationCount} conversations`,
      `${allItems.filter((item) => normalizeIncomingKind(item.kind) === "application").length} applications`
    ].map((item) => `<span class="yh-plaza-view-chip">${escapeHtml(item)}</span>`).join("");
  }

  if (plazaInboxSummaryGrid) {
    const filtered = items;
    plazaInboxSummaryGrid.innerHTML = [
      {
        label: "Open Intake",
        value: filtered.filter((item) => item.status !== "Closed").length,
        note: "Queue-owned items still needing action"
      },
      {
        label: "Applications",
        value: filtered.filter((item) => normalizeIncomingKind(item.kind) === "application").length,
        note: "Hiring/application items with package review"
      },
      {
        label: "Support Notes",
        value: filtered.filter((item) => normalizeIncomingKind(item.kind) === "support-note").length,
        note: "Delivered encouragement and soft openers"
      },
      {
        label: "Conversations",
        value: filtered.filter((item) => !!item.conversationId).length,
        note: "Intake items that already converted"
      }
    ].map((card) => `
      <article class="yh-plaza-ops-summary-card">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(String(card.value))}</strong>
        <small>${escapeHtml(card.note)}</small>
      </article>
    `).join("");
  }

  if (!plazaInboxList) return;
  plazaInboxList.innerHTML = items.length
    ? items.map(renderInboxCard).join("")
    : `<div class="yh-plaza-empty">No incoming Plaza work is visible in this lane yet.</div>`;
}

function renderNotificationsScreen() {
  const allItems = plazaOpsAdapter.getNotifications({ role: "all" });
  const roleValue = plazaRuntime.activeNotificationRole || "all";
  const items = plazaOpsAdapter.getNotifications({ role: roleValue });

  renderRoleFilterRow(plazaNotificationRoleFilters, roleValue, 'data-notification-role', allItems);

  if (plazaNotificationsMeta) {
    const unreadCount = allItems.filter((item) => item.status === "unread").length;
    plazaNotificationsMeta.innerHTML = [
      `${unreadCount} unread`,
      `${allItems.length} total`
    ].map((item) => `<span class="yh-plaza-view-chip">${escapeHtml(item)}</span>`).join("");
  }

  if (!plazaNotificationsList) return;
  plazaNotificationsList.innerHTML = items.length
    ? items.map(renderNotificationCard).join("")
    : `<div class="yh-plaza-empty">No notifications are visible in this lane yet.</div>`;
}

function renderMessagesScreen() {
  const items = plazaServerMessagesLoaded
    ? plazaServerMessages
    : plazaOpsAdapter.getConversations();

  if (plazaMessagesMeta) {
    plazaMessagesMeta.innerHTML = [
      `${items.length} live conversations`
    ].map((item) => `<span class="yh-plaza-view-chip">${escapeHtml(item)}</span>`).join("");
  }

  if (!plazaMessagesList) return;
  plazaMessagesList.innerHTML = items.length
    ? items.map(renderMessageCard).join("")
    : `<div class="yh-plaza-empty">No conversation is open yet. Move a request to Conversation Opened to create one.</div>`;
}

function renderConversationScreen(item) {
  if (!item || !plazaConversationTitle || !plazaConversationMeta || !plazaConversationThread) return;

  plazaRuntime.activeConversationId = item.id;

  plazaConversationTitle.textContent = item.title;
  plazaConversationMeta.innerHTML = [
    getQueueRoleLabel(item.queueRole),
    item.targetLabel,
    item.contextRoute || "Plaza conversation"
  ].map((meta) => `<span class="yh-plaza-view-chip">${escapeHtml(meta)}</span>`).join("");

  if (plazaConversationIdField) {
    plazaConversationIdField.value = item.id;
  }

  plazaConversationThread.innerHTML = safeArray(item.messages).length
    ? item.messages.map((message) => `
        <article class="yh-plaza-conversation-bubble ${message.type === "system" ? "is-system" : message.sender === "You" ? "is-self" : ""}">
          <strong>${escapeHtml(message.sender)}</strong>
          <p>${escapeHtml(message.text)}</p>
          <span class="yh-plaza-conversation-time">${escapeHtml(formatDate(message.createdAt))}</span>
        </article>
      `).join("")
    : `<div class="yh-plaza-empty-subtle">No message exists in this conversation yet.</div>`;

  openScreen("conversation");
}

function openConversationScreen(conversationId) {
  const item = plazaServerMessagesLoaded
    ? plazaServerMessages.find((conversation) => conversation.id === conversationId)
    : plazaOpsAdapter.getConversationById(conversationId);

  if (!item) return;
  renderConversationScreen(item);
}

function openInboxScreen() {
  renderInboxScreen();
  openScreen("inbox");
}

function openNotificationsScreen() {
  renderNotificationsScreen();
  openScreen("notifications");
}

function openMessagesScreen() {
  renderMessagesScreen();
  openScreen("messages");
}

function renderIncomingDetailScreen(item) {
  if (!item || !plazaIncomingDetailTitle || !plazaIncomingDetailMeta || !plazaIncomingDetailBody || !plazaIncomingDetailActions) return;

  plazaIncomingDetailTitle.textContent = item.title;
  plazaIncomingDetailMeta.innerHTML = [
    getQueueRoleLabel(item.queueRole),
    getIncomingKindLabel(item.kind),
    item.status
  ].map((meta) => `<span class="yh-plaza-view-chip">${escapeHtml(meta)}</span>`).join("");

  const actionButtons = [];
  const incomingKind = normalizeIncomingKind(item.kind);
  const incomingStatus = normalizeIncomingStatus(item.status);

  if (incomingStatus === "New" && incomingKind !== "support-note") {
    actionButtons.push(`<button type="button" class="yh-plaza-btn yh-plaza-btn-primary" data-inbox-start-review="${escapeHtml(item.id)}">Start Review</button>`);
  }

  if (!item.conversationId && incomingStatus !== "Closed") {
    actionButtons.push(`<button type="button" class="yh-plaza-btn yh-plaza-btn-secondary" data-inbox-open-conversation="${escapeHtml(item.id)}">${escapeHtml(incomingKind === "application" ? "Shortlist & Open Conversation" : incomingKind === "support-note" ? "Reply with Thanks" : "Open Conversation")}</button>`);
  }

  actionButtons.push(`<button type="button" class="yh-plaza-btn yh-plaza-btn-secondary" data-inbox-reroute="${escapeHtml(item.id)}">Reroute</button>`);

  if (incomingStatus !== "Closed") {
    actionButtons.push(`<button type="button" class="yh-plaza-btn yh-plaza-btn-secondary" data-inbox-close="${escapeHtml(item.id)}">${escapeHtml(incomingKind === "support-note" ? "Acknowledge Note" : "Close Intake")}</button>`);
  }

  if (item.conversationId) {
    actionButtons.push(`<button type="button" class="yh-plaza-btn yh-plaza-btn-secondary" data-conversation-open="${escapeHtml(item.conversationId)}">Open Live Conversation</button>`);
  }

  plazaIncomingDetailActions.innerHTML = actionButtons.join("");

  plazaIncomingDetailBody.innerHTML = `
    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Delivery</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary || "No intake summary added yet.")}</p>
        <div class="yh-plaza-inbox-meta">
          <span>${escapeHtml(item.senderName)}</span>
          <span>${escapeHtml(item.targetLabel)}</span>
          <span>${escapeHtml(item.region || "No region")}</span>
        </div>
      </article>
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Routing</span>
        <p>${escapeHtml(item.routeLabel || "Plaza intake route")}</p>
        <div class="yh-plaza-card-note">${escapeHtml(getIncomingStatusNote(item))}</div>
        <div class="yh-plaza-card-note">Queue owner: ${escapeHtml(getQueueRoleLabel(item.queueRole))}</div>
      </article>
    </div>

    ${
      normalizeIncomingKind(item.kind) === "application"
        ? `
          <div class="yh-plaza-detail-grid">
            <article class="yh-plaza-detail-block yh-plaza-detail-block-full">
              <span class="yh-plaza-view-chip">Application Package</span>
              <p>${escapeHtml(item.headline || "No headline added yet.")}</p>
              <div class="yh-plaza-card-note">${escapeHtml(item.experience || "No experience summary added yet.")}</div>
              ${
                item.portfolioLink
                  ? `<div class="yh-plaza-card-note">Portfolio: ${escapeHtml(item.portfolioLink)}</div>`
                  : `<div class="yh-plaza-card-note">No portfolio link added yet.</div>`
              }
              ${
                safeArray(item.attachments).length
                  ? `<div class="yh-plaza-attachment-list">${item.attachments.map((attachment) => `<span class="yh-plaza-attachment-chip">${escapeHtml(attachment.name)} • ${escapeHtml(attachment.sizeLabel)} • ${escapeHtml(attachment.typeLabel)}</span>`).join("")}</div>`
                  : `<div class="yh-plaza-card-note">No resume metadata attached yet.</div>`
              }
            </article>
          </div>
        `
        : ""
    }

    ${
      item.linkedRequestId
        ? `
          <div class="yh-plaza-inline-actions">
            <button type="button" class="yh-plaza-ghost-btn" data-request-open-context="${escapeHtml(item.linkedRequestId)}">Open Related Sender Context</button>
          </div>
        `
        : ""
    }
  `;

  openScreen("incoming-detail");
}

function openIncomingDetailScreen(inboxId) {
  const item = plazaOpsAdapter.getInboxById(inboxId);
  if (!item) return;
  renderIncomingDetailScreen(item);
}

function renderOperationalHeaderButtons() {
  const counts = plazaOpsAdapter.getPreviewCounts();

  function syncHeaderCount(button, key, label) {
    if (!button) return;

    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);

    const badge = button.querySelector(`[data-header-count="${key}"]`);
    if (!badge) return;

    const value = Number(counts[key] || 0);

    if (value > 0) {
      badge.hidden = false;
      badge.textContent = value > 99 ? "99+" : String(value);
    } else {
      badge.hidden = true;
      badge.textContent = "0";
    }
  }

  syncHeaderCount(
    openInboxBtn,
    "inbox",
    counts.inbox ? `Open Inbox (${counts.inbox})` : "Open Inbox"
  );

  syncHeaderCount(
    openNotificationsBtn,
    "notifications",
    counts.notifications ? `Open Notifications (${counts.notifications})` : "Open Notifications"
  );

  syncHeaderCount(
    openMessagesBtn,
    "messages",
    counts.messages ? `Open Messages (${counts.messages})` : "Open Messages"
  );
}

function renderOperationalPreviews() {
  renderOperationalHeaderButtons();

  if (plazaInboxPreview) {
    const items = plazaOpsAdapter.getInbox({ role: "all" }).slice(0, 2);
    plazaInboxPreview.innerHTML = items.length
      ? items.map((item) => `
          <article class="yh-plaza-rail-mini" data-inbox-open="${escapeHtml(item.id)}">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.status)} • ${escapeHtml(formatDate(item.updatedAt))}</span>
          </article>
        `).join("")
      : `<div class="yh-plaza-empty">No incoming work yet.</div>`;
  }

  if (plazaNotificationsPreview) {
    const items = plazaOpsAdapter.getNotifications({ role: "all" }).slice(0, 2);
    plazaNotificationsPreview.innerHTML = items.length
      ? items.map((item) => `
          <article class="yh-plaza-rail-mini" data-notification-open="${escapeHtml(item.id)}">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(formatDate(item.createdAt))}</span>
          </article>
        `).join("")
      : `<div class="yh-plaza-empty">No notifications yet.</div>`;
  }

  if (plazaMessagesPreview) {
    const items = plazaOpsAdapter.getConversations().slice(0, 2);
    plazaMessagesPreview.innerHTML = items.length
      ? items.map((item) => `
          <article class="yh-plaza-rail-mini" data-conversation-open="${escapeHtml(item.id)}">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(formatDate(item.updatedAt))}</span>
          </article>
        `).join("")
      : `<div class="yh-plaza-empty">No messages yet.</div>`;
  }
}

function openInboxRerouteModal(inboxId) {
  const item = plazaOpsAdapter.getInboxById(inboxId);
  if (!item) return;

  openModal({
    kicker: "Reroute Intake",
    title: item.title,
    bodyHtml: `
      <div class="yh-plaza-modal-copy">Move this intake lane to the correct operational owner without leaving Plaza.</div>
      <div class="yh-plaza-inline-actions">
        ${INBOX_ROLE_OPTIONS.filter((role) => role.key !== "all").map((role) => `
          <button
            type="button"
            class="yh-plaza-btn ${role.key === item.queueRole ? "yh-plaza-btn-primary" : "yh-plaza-btn-secondary"}"
            data-confirm-reroute-inbox="${escapeHtml(item.id)}"
            data-reroute-role="${escapeHtml(role.key)}"
          >
            ${escapeHtml(role.label)}
          </button>
        `).join("")}
      </div>
    `
  });
}

function openNotificationTarget(notificationId) {
  const item = plazaOpsAdapter.markNotificationRead(notificationId);
  if (!item) return;

  renderNotificationsScreen();
  renderOperationalPreviews();

  if (item.relatedType === "inbox") {
    openIncomingDetailScreen(item.relatedId);
    return;
  }

  if (item.relatedType === "conversation") {
    openConversationScreen(item.relatedId);
    return;
  }

  if (item.relatedType === "request") {
    openRequestsScreen();
    return;
  }

  openNotificationsScreen();
}

function buildRequestDrawer(config = {}) {
  const title = config.title || "Request a structured connection.";
  const kicker = config.kicker || "Plaza Request";
  const objective = normalizeObjective(config.objective || "Connection request");
  const context = config.context || "";
  const region = config.region || "";
  const targetId = config.targetId || "";
  const targetLabel = config.targetLabel || "";
  const sourceType = config.sourceType || "general";
  const message = config.message || "";
  const name = config.name || "";
  const requestId = config.requestId || "";
  const requestStatus = normalizeRequestStatus(config.status || "Submitted");
  const isEditing = !!requestId;

  const primaryLabel =
    config.submitLabel ||
    (isEditing && requestStatus === "Closed"
      ? "Reopen Request"
      : isEditing
        ? "Update Request"
        : "Send Request");

  const draftLabel =
    isEditing && requestStatus === "Draft"
      ? "Update Draft"
      : "Save as Draft";

  openDrawer({
    kicker,
    title,
    bodyHtml: `
      <div class="yh-plaza-modal-copy">${
        isEditing
          ? "Update the request cleanly. You can save it as a draft, send it back into Plaza, or reopen a closed flow."
          : "Plaza stays structured. Send a clear request so the next move can be screened, matched, and tracked."
      }</div>

      <div class="yh-plaza-request-summary">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Target</div>
        <p>${escapeHtml(targetLabel || "General Plaza request")}</p>
      </div>

      <div class="yh-plaza-request-summary">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Flow</div>
        <p>${escapeHtml(getRequestSourceLabel(sourceType))}</p>
        <div class="yh-plaza-card-note">${escapeHtml(getRequestRouteLabel(sourceType, objective))}</div>
      </div>

      ${context || region ? `
        <div class="yh-plaza-request-summary">
          <div class="yh-plaza-card-note yh-plaza-card-note-strong">Context</div>
          <p>${escapeHtml([context, region].filter(Boolean).join(" • "))}</p>
        </div>
      ` : ""}

      ${isEditing ? `
        <div class="yh-plaza-request-summary">
          <div class="yh-plaza-card-note yh-plaza-card-note-strong">Current status</div>
          <p>${escapeHtml(requestStatus)}</p>
        </div>
      ` : ""}

      <form class="yh-plaza-modal-form" id="plazaStructuredRequestForm">
        <input type="hidden" name="requestId" value="${escapeHtml(requestId)}" />
        <input type="hidden" name="sourceType" value="${escapeHtml(sourceType)}" />
        <input type="hidden" name="targetId" value="${escapeHtml(targetId)}" />
        <input type="hidden" name="targetLabel" value="${escapeHtml(targetLabel)}" />
        <input type="hidden" name="context" value="${escapeHtml(context)}" />
        <input type="hidden" name="region" value="${escapeHtml(region)}" />
        <label>
          <span>Your name</span>
          <input type="text" name="name" placeholder="Your name" value="${escapeHtml(name)}" required />
        </label>
        <label>
          <span>Objective</span>
          <select name="objective" required>
            ${buildObjectiveOptions(objective)}
          </select>
        </label>
        <label>
          <span>Request</span>
          <textarea name="message" placeholder="Explain what you need and why you are a fit" required>${escapeHtml(message)}</textarea>
        </label>

        <div class="yh-plaza-form-actions">
          <button
            type="submit"
            class="yh-plaza-btn yh-plaza-btn-secondary"
            data-request-submit-mode="draft"
            value="draft"
          >
            ${escapeHtml(draftLabel)}
          </button>

          <button
            type="submit"
            class="yh-plaza-btn yh-plaza-btn-primary"
            data-request-submit-mode="send"
            value="send"
          >
            ${escapeHtml(primaryLabel)}
          </button>
        </div>
      </form>
    `
  });
}

function buildApplicationDrawer(config = {}) {
  const title = config.title || "Apply through Plaza.";
  const kicker = config.kicker || "Plaza Application";
  const sourceType = config.sourceType || "opportunity";
  const context = config.context || "";
  const region = config.region || "";
  const targetId = config.targetId || "";
  const targetLabel = config.targetLabel || "";
  const requestId = config.requestId || "";
  const requestStatus = normalizeRequestStatus(config.status || "Submitted");
  const isEditing = !!requestId;
  const primaryLabel =
    config.submitLabel ||
    (isEditing && requestStatus === "Closed"
      ? "Reopen Application"
      : isEditing
        ? "Update Application"
        : "Submit Application");
  const draftLabel =
    isEditing && requestStatus === "Draft"
      ? "Update Draft"
      : "Save as Draft";

  openDrawer({
    kicker,
    title,
    bodyHtml: `
      <div class="yh-plaza-modal-copy">${
        isEditing
          ? "Update the application package cleanly. Resume handling stays metadata-only here until backend upload is connected."
          : "Applications stay structured inside Plaza. Send a clean package so HR or the right operational owner can review it without leaving the shell."
      }</div>

      <div class="yh-plaza-request-summary">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Target</div>
        <p>${escapeHtml(targetLabel || "Hiring lane")}</p>
      </div>

      <div class="yh-plaza-request-summary">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Flow</div>
        <p>${escapeHtml(getRequestSourceLabel(sourceType))}</p>
        <div class="yh-plaza-card-note">${escapeHtml(getRequestRouteLabel(sourceType, "Hiring"))}</div>
      </div>

      ${context || region ? `
        <div class="yh-plaza-request-summary">
          <div class="yh-plaza-card-note yh-plaza-card-note-strong">Context</div>
          <p>${escapeHtml([context, region].filter(Boolean).join(" • "))}</p>
        </div>
      ` : ""}

      <form class="yh-plaza-modal-form" id="plazaApplicationForm">
        <input type="hidden" name="requestId" value="${escapeHtml(requestId)}" />
        <input type="hidden" name="sourceType" value="${escapeHtml(sourceType)}" />
        <input type="hidden" name="targetId" value="${escapeHtml(targetId)}" />
        <input type="hidden" name="targetLabel" value="${escapeHtml(targetLabel)}" />
        <input type="hidden" name="context" value="${escapeHtml(context)}" />
        <input type="hidden" name="region" value="${escapeHtml(region)}" />
        <label>
          <span>Your name</span>
          <input type="text" name="name" placeholder="Your name" value="${escapeHtml(config.name || "")}" required />
        </label>
        <label>
          <span>Headline</span>
          <input type="text" name="headline" placeholder="Short role headline or positioning" value="${escapeHtml(config.headline || "")}" required />
        </label>
        <label>
          <span>Experience summary</span>
          <textarea name="experience" placeholder="Explain your relevant experience and execution proof" required>${escapeHtml(config.experience || "")}</textarea>
        </label>
        <label>
          <span>Portfolio link</span>
          <input type="url" name="portfolioLink" placeholder="https://your-portfolio-link.com" value="${escapeHtml(config.portfolioLink || "")}" />
        </label>
        <label>
          <span>Resume / CV</span>
          <input type="file" name="resumeFile" accept=".pdf,.doc,.docx,.txt" />
          ${
            safeArray(config.attachmentMeta).length
              ? `<div class="yh-plaza-attachment-list">${config.attachmentMeta.map((attachment) => `<span class="yh-plaza-attachment-chip">${escapeHtml(attachment.name)} • ${escapeHtml(attachment.sizeLabel)}</span>`).join("")}</div>`
              : `<div class="yh-plaza-card-note">File upload stays metadata-only in this prototype until backend storage is connected.</div>`
          }
        </label>
        <label>
          <span>Application note</span>
          <textarea name="message" placeholder="Why are you a fit for this role or lane?" required>${escapeHtml(config.message || "")}</textarea>
        </label>

        <div class="yh-plaza-form-actions">
          <button
            type="submit"
            class="yh-plaza-btn yh-plaza-btn-secondary"
            data-request-submit-mode="draft"
            value="draft"
          >
            ${escapeHtml(draftLabel)}
          </button>

          <button
            type="submit"
            class="yh-plaza-btn yh-plaza-btn-primary"
            data-request-submit-mode="send"
            value="send"
          >
            ${escapeHtml(primaryLabel)}
          </button>
        </div>
      </form>
    `
  });
}
function openGeneralConnectDrawer() {
  buildRequestDrawer({
    kicker: "Plaza Connection",
    title: "Request a structured connection.",
    sourceType: "general",
    objective: "Connection request",
    submitLabel: "Send Request"
  });
}

function openRequestEditDrawer(requestId) {
  const request = plazaAdapter.getRequestById(requestId);
  if (!request) return;

  if (normalizeObjective(request.objective) === "Hiring") {
    buildApplicationDrawer({
      requestId: request.id,
      kicker: request.status === "Closed" ? "Reopen Application" : "Edit Application",
      title: request.targetLabel || "Edit Plaza Application",
      sourceType: request.sourceType || "opportunity",
      targetId: request.targetId || "",
      targetLabel: request.targetLabel || "Hiring lane",
      context: request.context || "",
      region: request.region || "",
      name: request.name || "",
      headline: request.headline || "",
      experience: request.experience || "",
      portfolioLink: request.portfolioLink || "",
      attachmentMeta: safeArray(request.attachmentMeta).map(normalizeAttachmentMeta),
      message: request.message || "",
      status: request.status || "Submitted",
      submitLabel: request.status === "Closed" ? "Reopen Application" : "Update Application"
    });
    return;
  }

  buildRequestDrawer({
    requestId: request.id,
    kicker: request.status === "Closed" ? "Reopen Request" : "Edit Request",
    title: request.targetLabel || "Edit Plaza Request",
    sourceType: request.sourceType || "general",
    targetId: request.targetId || "",
    targetLabel: request.targetLabel || "General Plaza request",
    context: request.context || "",
    region: request.region || "",
    name: request.name || "",
    objective: request.objective || "Connection request",
    message: request.message || "",
    status: request.status || "Submitted",
    submitLabel: request.status === "Closed" ? "Reopen Request" : "Update Request"
  });
}

function openRequestDeleteModal(requestId) {
  const request = plazaAdapter.getRequestById(requestId);
  if (!request) return;

  openModal({
    kicker: "Delete Request",
    title: "Remove this Plaza request?",
    bodyHtml: `
      <div class="yh-plaza-modal-copy">
        This will permanently remove <strong>${escapeHtml(request.targetLabel || "this request")}</strong> from My Requests.
      </div>

      <div class="yh-plaza-request-summary">
        <div class="yh-plaza-card-note yh-plaza-card-note-strong">Request</div>
        <p>${escapeHtml(request.objective || "Request")} • ${escapeHtml(request.status || "Submitted")}</p>
      </div>

      <div class="yh-plaza-form-actions">
        <button type="button" class="yh-plaza-btn yh-plaza-btn-secondary" data-close-modal>Keep Request</button>
        <button
          type="button"
          class="yh-plaza-btn yh-plaza-btn-danger"
          data-confirm-request-delete="${escapeHtml(request.id)}"
        >
          Delete Request
        </button>
      </div>
    `
  });
}

function renderOpportunityDetailScreen(item) {
  if (!item || !plazaOpportunityDetailBody || !plazaOpportunityDetailMeta || !plazaOpportunityDetailTitle) return;

  const relatedMembers = plazaAdapter.getRelatedMembers(item.region);
  const relatedBridge = plazaAdapter.getRegionBridge(item.region);
  const economyContext = buildPlazaOpportunityEconomyContext(item);

  plazaOpportunityDetailTitle.textContent = item.title;
  plazaOpportunityDetailMeta.innerHTML = renderPlazaOpportunityChips(item, ["Plaza movement layer"]);

  plazaOpportunityDetailBody.innerHTML = `
    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Overview</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <div class="yh-plaza-card-note">Action path: ${escapeHtml(getPlazaOpportunityPrimaryActionLabel(item))}</div>
      </article>

      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Marketplace Economics</span>
        ${renderPlazaOpportunityEconomyPanel(item) || `<div class="yh-plaza-empty">No monetization details have been added yet.</div>`}
      </article>
    </div>

    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Why it sits in Plaza</span>
        <p>This opportunity is visible in Plaza because it needs discovery, trusted matching, and a structured next step instead of random outreach.</p>
        <div class="yh-plaza-card-note">${escapeHtml(economyContext || "Use the primary action to open a tracked request that will appear in My Requests.")}</div>
      </article>

      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Escalation Logic</span>
        <p>${escapeHtml(getPlazaOpportunityEscalationLabel(item) || "This opportunity currently stays inside Plaza unless the requester or admin turns it into a Federation escalation.")}</p>
        <div class="yh-plaza-card-note">Source: ${escapeHtml(getPlazaOpportunitySourceLabel(item))}</div>
      </article>
    </div>

    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Relevant members</span>
        ${relatedMembers.length ? relatedMembers.map(renderMiniMemberCard).join("") : `<div class="yh-plaza-empty">No matching members surfaced yet.</div>`}
      </article>

      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Related bridge lanes</span>
        ${relatedBridge.length ? relatedBridge.map(renderMiniBridgeCard).join("") : `<div class="yh-plaza-empty">No bridge lane surfaced for this region yet.</div>`}
      </article>
    </div>
  `;

  if (plazaOpportunityDetailPrimaryBtn) {
    plazaOpportunityDetailPrimaryBtn.dataset.detailAction = `request-opportunity:${item.id}`;
    plazaOpportunityDetailPrimaryBtn.textContent = getPlazaOpportunityPrimaryActionLabel(item);
  }

  openScreen("opportunity-detail");
}

function renderProjectDetailScreen(item) {
  if (!item || !plazaProjectDetailBody || !plazaProjectDetailMeta || !plazaProjectDetailTitle) return;

  const relatedMembers = plazaAdapter.getRelatedMembers(item.region);
  const relatedOpportunities = plazaAdapter.getRegionOpportunities(item.region);

  plazaProjectDetailTitle.textContent = item.title;
  plazaProjectDetailMeta.innerHTML = [item.region, getSourceLabel(item.source), "Cross-division project"]
    .map((meta) => `<span class="yh-plaza-view-chip">${escapeHtml(meta)}</span>`)
    .join("");

  plazaProjectDetailBody.innerHTML = `
    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Project signal</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <div class="yh-plaza-card-note">Project owner signal: ${escapeHtml(item.member)}</div>
      </article>
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Why it belongs here</span>
        <p>Projects in Plaza should connect execution from Academy, visibility from Plaza, and access from Federation without forcing users to jump into disconnected spaces.</p>
        <div class="yh-plaza-card-note">Use the primary action to request involvement, support, or a structured intro.</div>
      </article>
    </div>
    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Possible builders</span>
        ${relatedMembers.length ? relatedMembers.map(renderMiniMemberCard).join("") : `<div class="yh-plaza-empty">No related builders surfaced yet.</div>`}
      </article>
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Regional movement</span>
        ${relatedOpportunities.length ? relatedOpportunities.map(renderMiniOpportunityCard).join("") : `<div class="yh-plaza-empty">No linked opportunity found for this region yet.</div>`}
      </article>
    </div>
  `;

  if (plazaProjectDetailPrimaryBtn) {
    plazaProjectDetailPrimaryBtn.dataset.detailAction = `request-project:${item.id}`;
    plazaProjectDetailPrimaryBtn.textContent = "Open Project Request";
  }

  openScreen("project-detail");
}

function renderRegionHubScreen(item) {
  if (!item || !plazaRegionHubBody || !plazaRegionHubMeta || !plazaRegionHubTitle) return;

  const members = plazaAdapter.getRegionMembers(item.region);
  const opportunities = plazaAdapter.getRegionOpportunities(item.region);
  const bridgeItems = plazaAdapter.getRegionBridge(item.region);

  plazaRegionHubTitle.textContent = item.region;
  plazaRegionHubMeta.innerHTML = [item.label, `${item.count} visible members`, "Regional clustering"]
    .map((meta) => `<span class="yh-plaza-view-chip">${escapeHtml(meta)}</span>`)
    .join("");

  plazaRegionHubBody.innerHTML = `
    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Regional signal</span>
        <h3>${escapeHtml(item.region)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <div class="yh-plaza-card-note">Hub label: ${escapeHtml(item.label)}</div>
      </article>
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Hub purpose</span>
        <p>Region Hubs cluster members, opportunities, and bridge paths inside one local view so Plaza can move from broad discovery into local action.</p>
        <div class="yh-plaza-card-note">Use the primary action to open a tracked regional request.</div>
      </article>
    </div>
    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Members in ${escapeHtml(item.region)}</span>
        ${members.length ? members.map(renderMiniMemberCard).join("") : `<div class="yh-plaza-empty">No members surfaced in this region yet.</div>`}
      </article>
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Regional opportunities</span>
        ${opportunities.length ? opportunities.map(renderMiniOpportunityCard).join("") : `<div class="yh-plaza-empty">No regional opportunities surfaced yet.</div>`}
      </article>
    </div>
    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block yh-plaza-detail-block-full">
        <span class="yh-plaza-view-chip">Bridge movement</span>
        ${bridgeItems.length ? bridgeItems.map(renderMiniBridgeCard).join("") : `<div class="yh-plaza-empty">No bridge path surfaced in this region yet.</div>`}
      </article>
    </div>
  `;

  if (plazaRegionHubPrimaryBtn) {
    plazaRegionHubPrimaryBtn.dataset.detailAction = `request-region:${item.id}`;
    plazaRegionHubPrimaryBtn.textContent = "Request Regional Connection";
  }

  openScreen("region-hub");
}

function renderBridgeDetailScreen(item) {
  if (!item || !plazaBridgeDetailBody || !plazaBridgeDetailMeta || !plazaBridgeDetailTitle) return;

  const regionMembers = plazaAdapter.getRegionMembers(item.region);
  const regionOpportunities = plazaAdapter.getRegionOpportunities(item.region);

  plazaBridgeDetailTitle.textContent = item.title;
  plazaBridgeDetailMeta.innerHTML = [item.stage, item.region, `${getBridgeLaneLabel(item.left)} → ${getBridgeLaneLabel(item.right)}`]
    .map((meta) => `<span class="yh-plaza-view-chip">${escapeHtml(meta)}</span>`)
    .join("");

  plazaBridgeDetailBody.innerHTML = `
    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Bridge signal</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <div class="yh-plaza-card-note">Next step: ${escapeHtml(item.nextStep)}</div>
      </article>
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Lane interpretation</span>
        <p>Bridge paths are the upgrade routes inside Plaza. They show when visible execution becomes relevant enough for screening, intro, or escalation.</p>
        <div class="yh-plaza-card-note">This is where YHA readiness and YHF relevance begin to connect.</div>
      </article>
    </div>
    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Regional members</span>
        ${regionMembers.length ? regionMembers.map(renderMiniMemberCard).join("") : `<div class="yh-plaza-empty">No region-matched members surfaced yet.</div>`}
      </article>
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Relevant opportunities</span>
        ${regionOpportunities.length ? regionOpportunities.map(renderMiniOpportunityCard).join("") : `<div class="yh-plaza-empty">No region-matched opportunities surfaced yet.</div>`}
      </article>
    </div>
  `;

  if (plazaBridgeDetailPrimaryBtn) {
    plazaBridgeDetailPrimaryBtn.dataset.detailAction = `request-bridge:${item.id}`;
    plazaBridgeDetailPrimaryBtn.textContent = item.action;
  }

  openScreen("bridge-detail");
}

function openRequestsScreen() {
  renderRequestsScreen();
  openScreen("requests");
}

function openRequestPreview(requestId) {
  if (!requestId) {
    openRequestsScreen();
    return;
  }

  openRequestsScreen();
  focusContextCard(
    `[data-request-card="${CSS.escape(requestId)}"]`,
    "Opened request from the Plaza rail."
  );
}

function openDirectoryContextForMember(member, sourceType) {
  if (!member) return false;

  const selector = `[data-context-card="member"][data-context-id="${CSS.escape(member.id)}"]`;

  const preferredDivision =
    sourceType === "member-screened"
      ? (member.division === "federation" || member.division === "both"
          ? member.division
          : "all")
      : member.division || "all";

  const preferredTrust =
    sourceType === "member-screened"
      ? member.trust || "all"
      : "all";

  if (plazaRegionFilter) {
    plazaRegionFilter.value = member.region || "all";
  }

  if (plazaDivisionFilter) {
    plazaDivisionFilter.value = preferredDivision;
  }

  if (plazaTrustFilter) {
    plazaTrustFilter.value = preferredTrust;
  }

  renderDirectory();
  openScreen("directory", { resetHistory: true, pushHistory: false });

  if (!document.querySelector(selector)) {
    if (plazaRegionFilter) plazaRegionFilter.value = "all";
    if (plazaDivisionFilter) plazaDivisionFilter.value = "all";
    if (plazaTrustFilter) plazaTrustFilter.value = "all";

    renderDirectory();
    openScreen("directory", { resetHistory: true, pushHistory: false });
  }

  focusContextCard(selector, `Opened directory context for ${member.name}.`);
  return true;
}

function openRequestContext(requestId) {
  const item = plazaAdapter.getRequestById(requestId);
  if (!item) return;

  const sourceType = String(item.sourceType || "").trim().toLowerCase();
  const targetId = String(item.targetId || "").trim();

  if (!targetId) {
    openRequestsScreen();
    return;
  }

  if (sourceType === "opportunity") {
    const opportunity = plazaAdapter.getOpportunityById(targetId);
    if (opportunity) {
      renderOpportunityDetailScreen(opportunity);
      showToast(`Opened related opportunity context for ${opportunity.title}.`);
      return;
    }

    const feedOpportunity = plazaAdapter.getFeedById(targetId);
    if (feedOpportunity && feedOpportunity.type === "opportunity") {
      renderOpportunityDetailScreen({
        id: feedOpportunity.id,
        type: feedOpportunity.tag,
        region: feedOpportunity.region,
        title: feedOpportunity.title,
        text: feedOpportunity.text,
        action: feedOpportunity.action
      });
      showToast(`Opened related opportunity context for ${feedOpportunity.title}.`);
      return;
    }
  }

  if (sourceType === "region") {
    const region = plazaAdapter.getRegionById(targetId);
    if (region) {
      renderRegionHubScreen(region);
      showToast(`Opened region hub context for ${region.region}.`);
      return;
    }
  }

  if (sourceType === "bridge" || sourceType === "member-bridge") {
    const bridge = plazaAdapter.getBridgeById(targetId);
    if (bridge) {
      renderBridgeDetailScreen(bridge);
      showToast(`Opened bridge context for ${bridge.title}.`);
      return;
    }
  }

  if (sourceType === "project") {
    const project = plazaAdapter.getFeedById(targetId);
    if (project) {
      renderProjectDetailScreen(project);
      showToast(`Opened project context for ${project.title}.`);
      return;
    }
  }

  if (sourceType === "feed-introduction") {
    const feed = plazaAdapter.getFeedById(targetId);
    if (feed) {
      plazaRuntime.feedFilter = "all";
      plazaFeedFilters.forEach((pill) => pill.classList.toggle("is-active", pill.dataset.feedFilter === "all"));
      renderFeed("all");
      openScreen("feed", { resetHistory: true, pushHistory: false });
      focusContextCard(
        `[data-context-card="feed"][data-context-id="${CSS.escape(feed.id)}"]`,
        `Opened related feed context for ${feed.member}.`
      );
      return;
    }
  }

  if (sourceType === "member-connection" || sourceType === "member-screened") {
    const member = plazaAdapter.getMemberById(targetId);
    if (member && openDirectoryContextForMember(member, sourceType)) {
      return;
    }
  }

  openRequestsScreen();
}

function openFeedAction(item) {
  if (!item) return;

  if (item.type === "introduction") {
    buildRequestDrawer({
      kicker: "Introduction Request",
      title: `Connect with ${item.member}`,
      sourceType: "feed-introduction",
      targetId: item.id,
      targetLabel: item.member,
      region: item.region,
      context: item.title,
      objective: "Introduction",
      message: `I saw your Plaza introduction and would like to open a structured connection around ${item.region}.`,
      submitLabel: item.action
    });
    return;
  }

  if (item.type === "opportunity") {
    renderOpportunityDetailScreen({
      id: item.id,
      type: item.tag,
      region: item.region,
      title: item.title,
      text: item.text,
      action: item.action
    });
    return;
  }

  if (item.type === "project") {
    renderProjectDetailScreen(item);
    return;
  }

  if (item.type === "win") {
    openModal({
      kicker: "Plaza Win",
      title: `Send support to ${item.member}`,
      bodyHtml: `
        <div class="yh-plaza-modal-copy">Keep Plaza useful. Celebrate real execution with a short structured note.</div>
        <form class="yh-plaza-modal-form" id="plazaWinForm">
          <input type="hidden" name="member" value="${escapeHtml(item.member)}" />
          <label>
            <span>Your name</span>
            <input type="text" name="name" placeholder="Your name" required />
          </label>
          <label>
            <span>Message</span>
            <textarea name="message" placeholder="Short congratulatory note" required></textarea>
          </label>
          <button type="submit" class="yh-plaza-btn yh-plaza-btn-primary">Send Support</button>
        </form>
      `
    });
  }
}

function openMemberRequest(item) {
  if (!item) return;

  const isFederation = item.division === "federation";
  const isBridge = item.division === "both";

  buildRequestDrawer({
    kicker: isBridge ? "Bridge Request" : isFederation ? "Screened Intro" : "Member Request",
    title: isBridge ? `Open a bridge request for ${item.name}` : `Request a connection with ${item.name}`,
    sourceType: isBridge ? "member-bridge" : isFederation ? "member-screened" : "member-connection",
    targetId: item.id,
    targetLabel: item.name,
    region: item.region,
    context: `${item.role} • ${item.focus}`,
    objective: isBridge ? "Bridge request" : isFederation ? "Introduction" : "Connection request",
    message: `I found ${item.name} in Plaza and want to make a structured request related to ${item.focus}.`,
    submitLabel: getDirectoryActionLabel(item)
  });
}

function handleDetailPrimaryAction(action) {
  if (!action) return;

  if (action.startsWith("request-opportunity:")) {
    const id = action.split(":")[1];
    const item = plazaAdapter.getOpportunityById(id) || plazaAdapter.getFeedById(id);
    if (!item) return;

    const normalizedOpportunityObjective = getPlazaOpportunityRequestObjective(item);
    const sourceType = getPlazaOpportunityRequestSourceType(item);
    const economyContext = buildPlazaOpportunityEconomyContext(item);
    const requestContext = [
      item.type || item.tag || "Opportunity",
      economyContext
    ].filter(Boolean).join(" • ");

    if (normalizedOpportunityObjective === "Hiring") {
      buildApplicationDrawer({
        kicker: "Plaza Application",
        title: item.title,
        sourceType,
        targetId: item.id,
        targetLabel: item.title,
        region: item.region,
        context: requestContext,
        message: buildPlazaOpportunityRequestMessage(item),
        submitLabel: getPlazaOpportunityPrimaryActionLabel(item)
      });
      return;
    }

    buildRequestDrawer({
      kicker: sourceType === "federation-escalation" ? "Federation Escalation Request" : "Opportunity Request",
      title: item.title,
      sourceType,
      targetId: item.id,
      targetLabel: item.title,
      region: item.region,
      context: requestContext,
      objective: normalizedOpportunityObjective,
      message: buildPlazaOpportunityRequestMessage(item),
      submitLabel: getPlazaOpportunityPrimaryActionLabel(item)
    });
    return;
  }

  if (action.startsWith("request-project:")) {
    const id = action.split(":")[1];
    const item = plazaAdapter.getFeedById(id);
    if (!item) return;
    buildRequestDrawer({
      kicker: "Project Request",
      title: item.title,
      sourceType: "project",
      targetId: item.id,
      targetLabel: item.title,
      region: item.region,
      context: item.member,
      objective: "Project request",
      message: `I want to support or join this project signal in ${item.region}.`,
      submitLabel: "Send Project Request"
    });
    return;
  }

  if (action.startsWith("request-region:")) {
    const id = action.split(":")[1];
    const item = plazaAdapter.getRegionById(id);
    if (!item) return;
    buildRequestDrawer({
      kicker: "Regional Request",
      title: `${item.region} Region Hub`,
      sourceType: "region",
      targetId: item.id,
      targetLabel: item.region,
      region: item.region,
      context: item.label,
      objective: "Regional connection",
      message: `I want to connect with the right people and movement inside ${item.region}.`,
      submitLabel: "Send Regional Request"
    });
    return;
  }

  if (action.startsWith("request-bridge:")) {
    const id = action.split(":")[1];
    const item = plazaAdapter.getBridgeById(id);
    if (!item) return;
    buildRequestDrawer({
      kicker: "Bridge Request",
      title: item.title,
      sourceType: "bridge",
      targetId: item.id,
      targetLabel: item.title,
      region: item.region,
      context: `${getBridgeLaneLabel(item.left)} → ${getBridgeLaneLabel(item.right)}`,
      objective: "Bridge request",
      message: `I want to open the next structured step for this bridge lane in ${item.region}.`,
      submitLabel: item.action
    });
  }
}
function bindEvents() {
  plazaTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      openScreen(tab.dataset.plazaTab, { resetHistory: true, pushHistory: false });
    });
  });

  plazaNavButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openScreen(button.dataset.navTab, { resetHistory: true, pushHistory: false });
    });
  });

  plazaFeedFilters.forEach((pill) => {
    pill.addEventListener("click", () => {
      plazaRuntime.feedFilter = pill.dataset.feedFilter || "all";
      plazaFeedFilters.forEach((item) => item.classList.toggle("is-active", item === pill));
      renderFeed(plazaRuntime.feedFilter);
      savePlazaUiState();
    });
  });

  [plazaRegionFilter, plazaDivisionFilter, plazaTrustFilter].forEach((field) => {
    field?.addEventListener("change", () => {
      renderDirectory();
      savePlazaUiState();
    });
  });

  introBtn?.addEventListener("click", openIntroModal);
  connectBtn?.addEventListener("click", openGeneralConnectDrawer);
  openInboxBtn?.addEventListener("click", openInboxScreen);
  openNotificationsBtn?.addEventListener("click", openNotificationsScreen);
  openMessagesBtn?.addEventListener("click", openMessagesScreen);
  openRequestsBtn?.addEventListener("click", openRequestsScreen);
  resetViewBtn?.addEventListener("click", resetPlazaToOverview);

  sidebarIntroBtn?.addEventListener("click", openIntroModal);
  sidebarConnectBtn?.addEventListener("click", openGeneralConnectDrawer);
  sidebarRequestsBtn?.addEventListener("click", openRequestsScreen);

  plazaScreenBackBtn?.addEventListener("click", goBackFromScreen);
  plazaOpportunityDetailPrimaryBtn?.addEventListener("click", () => handleDetailPrimaryAction(plazaOpportunityDetailPrimaryBtn.dataset.detailAction || ""));
  plazaProjectDetailPrimaryBtn?.addEventListener("click", () => handleDetailPrimaryAction(plazaProjectDetailPrimaryBtn.dataset.detailAction || ""));
  plazaRegionHubPrimaryBtn?.addEventListener("click", () => handleDetailPrimaryAction(plazaRegionHubPrimaryBtn.dataset.detailAction || ""));
  plazaBridgeDetailPrimaryBtn?.addEventListener("click", () => handleDetailPrimaryAction(plazaBridgeDetailPrimaryBtn.dataset.detailAction || ""));

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-close-modal]")) {
      closeModal();
      return;
    }

    if (target.matches("[data-close-drawer]")) {
      closeDrawer();
      return;
    }

    const screenBack = target.closest("[data-screen-back]");
    if (screenBack instanceof HTMLElement) {
      goBackFromScreen();
      return;
    }

    const inboxRoleBtn = target.closest("[data-inbox-role]");
    if (inboxRoleBtn instanceof HTMLElement) {
      plazaRuntime.activeInboxRole = inboxRoleBtn.dataset.inboxRole || "all";
      renderInboxScreen();
      savePlazaUiState();
      return;
    }

    const notificationRoleBtn = target.closest("[data-notification-role]");
    if (notificationRoleBtn instanceof HTMLElement) {
      plazaRuntime.activeNotificationRole = notificationRoleBtn.dataset.notificationRole || "all";
      renderNotificationsScreen();
      savePlazaUiState();
      return;
    }

    const railRequestOpenBtn = target.closest("[data-rail-request-open]");
    if (railRequestOpenBtn instanceof HTMLElement) {
      openRequestPreview(railRequestOpenBtn.dataset.railRequestOpen || "");
      return;
    }

    const inboxOpenBtn = target.closest("[data-inbox-open]");
    if (inboxOpenBtn instanceof HTMLElement) {
      openIncomingDetailScreen(inboxOpenBtn.dataset.inboxOpen || "");
      return;
    }

    const inboxStartReviewBtn = target.closest("[data-inbox-start-review]");
    if (inboxStartReviewBtn instanceof HTMLButtonElement) {
      const inboxId = inboxStartReviewBtn.dataset.inboxStartReview || "";

      void runLockedButtonAction(
        `inbox-review:${inboxId}`,
        inboxStartReviewBtn,
        "Reviewing...",
        () => {
          const updatedItem = plazaOpsAdapter.updateInbox(inboxId, { status: "Under Review" });

          if (updatedItem) {
            renderRequestsPreview();
            renderRequestsScreen();
            renderInboxScreen();
            renderNotificationsScreen();
            renderOperationalPreviews();
            renderIncomingDetailScreen(updatedItem);
            showToast("Inbox item moved to review.");
          }
        }
      );
      return;
    }

    const inboxOpenConversationBtn = target.closest("[data-inbox-open-conversation]");
    if (inboxOpenConversationBtn instanceof HTMLButtonElement) {
      const inboxId = inboxOpenConversationBtn.dataset.inboxOpenConversation || "";

      void runLockedButtonAction(
        `inbox-conversation:${inboxId}`,
        inboxOpenConversationBtn,
        "Opening...",
        () => {
          const conversation = plazaOpsAdapter.createConversationFromInbox(inboxId);

          if (conversation) {
            renderRequestsPreview();
            renderRequestsScreen();
            renderInboxScreen();
            renderMessagesScreen();
            renderNotificationsScreen();
            renderOperationalPreviews();
            renderConversationScreen(conversation);
            showToast("Conversation opened from Plaza intake.");
          }
        }
      );
      return;
    }

    const inboxRerouteBtn = target.closest("[data-inbox-reroute]");
    if (inboxRerouteBtn instanceof HTMLElement) {
      openInboxRerouteModal(inboxRerouteBtn.dataset.inboxReroute || "");
      return;
    }

    const rerouteConfirmBtn = target.closest("[data-confirm-reroute-inbox]");
    if (rerouteConfirmBtn instanceof HTMLButtonElement) {
      const inboxId = rerouteConfirmBtn.dataset.confirmRerouteInbox || "";
      const nextRole = rerouteConfirmBtn.dataset.rerouteRole || "personal";

      void runLockedButtonAction(
        `inbox-reroute:${inboxId}:${nextRole}`,
        rerouteConfirmBtn,
        "Routing...",
        () => {
          const updatedItem = plazaOpsAdapter.rerouteInbox(inboxId, nextRole);

          if (updatedItem) {
            closeModal();
            renderInboxScreen();
            renderNotificationsScreen();
            renderOperationalPreviews();
            renderIncomingDetailScreen(updatedItem);
            showToast(`Inbox item routed to ${getQueueRoleLabel(updatedItem.queueRole)}.`);
          }
        }
      );
      return;
    }

    const inboxCloseBtn = target.closest("[data-inbox-close]");
    if (inboxCloseBtn instanceof HTMLButtonElement) {
      const inboxId = inboxCloseBtn.dataset.inboxClose || "";

      void runLockedButtonAction(
        `inbox-close:${inboxId}`,
        inboxCloseBtn,
        "Closing...",
        () => {
          const updatedItem = plazaOpsAdapter.updateInbox(inboxId, { status: "Closed" });

          if (updatedItem) {
            renderRequestsPreview();
            renderRequestsScreen();
            renderInboxScreen();
            renderNotificationsScreen();
            renderOperationalPreviews();
            renderIncomingDetailScreen(updatedItem);
            showToast("Incoming Plaza item closed.");
          }
        }
      );
      return;
    }

    const notificationOpenBtn = target.closest("[data-notification-open]");
    if (notificationOpenBtn instanceof HTMLElement) {
      openNotificationTarget(notificationOpenBtn.dataset.notificationOpen || "");
      return;
    }

    const conversationOpenBtn = target.closest("[data-conversation-open]");
    if (conversationOpenBtn instanceof HTMLElement) {
      openConversationScreen(conversationOpenBtn.dataset.conversationOpen || "");
      return;
    }

    const feedBtn = target.closest("[data-feed-id]");
    if (feedBtn instanceof HTMLElement) {
      openFeedAction(plazaAdapter.getFeedById(feedBtn.dataset.feedId));
      return;
    }

    const memberBtn = target.closest("[data-member-id]");
    if (memberBtn instanceof HTMLElement) {
      openMemberRequest(plazaAdapter.getMemberById(memberBtn.dataset.memberId));
      return;
    }

    const opportunityBtn = target.closest("[data-opportunity-id]");
    if (opportunityBtn instanceof HTMLElement) {
      renderOpportunityDetailScreen(plazaAdapter.getOpportunityById(opportunityBtn.dataset.opportunityId));
      return;
    }

    const regionBtn = target.closest("[data-region-id]");
    if (regionBtn instanceof HTMLElement) {
      renderRegionHubScreen(plazaAdapter.getRegionById(regionBtn.dataset.regionId));
      return;
    }

    const bridgeBtn = target.closest("[data-bridge-id]");
    if (bridgeBtn instanceof HTMLElement) {
      renderBridgeDetailScreen(plazaAdapter.getBridgeById(bridgeBtn.dataset.bridgeId));
      return;
    }

    const requestEditBtn = target.closest("[data-request-edit]");
    if (requestEditBtn instanceof HTMLElement) {
      const requestId = requestEditBtn.dataset.requestEdit || "";
      openRequestEditDrawer(requestId);
      return;
    }

    const requestCloseBtn = target.closest("[data-request-close]");
    if (requestCloseBtn instanceof HTMLButtonElement) {
      const requestId = requestCloseBtn.dataset.requestClose || "";

      void runLockedButtonAction(
        `request-close:${requestId}`,
        requestCloseBtn,
        "Closing...",
        () => {
          const updatedRequest = plazaAdapter.closeRequest(requestId);

          if (updatedRequest) {
            plazaOpsAdapter.syncIncomingStatusFromRequest(updatedRequest);
            renderRequestsPreview();
            renderRequestsScreen();
            renderInboxScreen();
            renderNotificationsScreen();
            renderOperationalPreviews();
            showToast("Request closed inside Plaza.");
          }
        }
      );
      return;
    }

    const requestDeleteBtn = target.closest("[data-request-delete]");
    if (requestDeleteBtn instanceof HTMLElement) {
      const requestId = requestDeleteBtn.dataset.requestDelete || "";
      openRequestDeleteModal(requestId);
      return;
    }

const confirmRequestDeleteBtn = target.closest("[data-confirm-request-delete]");
if (confirmRequestDeleteBtn instanceof HTMLButtonElement) {
  const requestId = confirmRequestDeleteBtn.dataset.confirmRequestDelete || "";

  void runLockedButtonAction(
    `request-delete:${requestId}`,
    confirmRequestDeleteBtn,
    "Deleting.",
    async () => {
      let deleted = false;

      if (plazaServerRequestsLoaded) {
        deleted = await deletePlazaRequestFromServer(requestId);
      } else {
        deleted = plazaAdapter.deleteRequest(requestId);
      }

      if (deleted) {
        plazaOpsAdapter.removeIncomingByRequestId(requestId);
        closeModal();
        renderRequestsPreview();
        renderRequestsScreen();
        renderInboxScreen();
        renderOperationalPreviews();
        showToast("Request deleted from Plaza.");
      }
    }
  );
  return;
}

const requestAdvanceBtn = target.closest("[data-request-advance]");
if (requestAdvanceBtn instanceof HTMLButtonElement) {
  const requestId = requestAdvanceBtn.dataset.requestAdvance || "";

  void runLockedButtonAction(
    `request-advance:${requestId}`,
    requestAdvanceBtn,
    "Processing.",
    async () => {
      const updatedRequest = plazaServerRequestsLoaded
        ? await advancePlazaRequestStatus(requestId)
        : plazaAdapter.advanceRequestStatus(requestId);

      if (updatedRequest) {
        plazaOpsAdapter.syncIncomingStatusFromRequest(updatedRequest);

        if (updatedRequest.status === "Conversation Opened") {
          const conversation = plazaServerRequestsLoaded
            ? await createPlazaConversationFromRequest(updatedRequest.id)
            : null;

          if (conversation) {
            renderMessagesScreen();
          }
        }

        renderRequestsPreview();
        renderRequestsScreen();
        renderInboxScreen();
        renderNotificationsScreen();
        renderOperationalPreviews();

        if (updatedRequest.status === "Matched" && safeArray(updatedRequest.matchedEntityLabels).length) {
          showToast(`Request matched toward ${updatedRequest.matchedEntityLabels[0]}.`);
        } else if (updatedRequest.status === "Conversation Opened") {
          showToast("Conversation opened inside Plaza Messages.");
        } else if (updatedRequest.status === "Closed") {
          showToast("Request closed inside Plaza.");
        } else {
          showToast(`Request moved to ${updatedRequest.status}.`);
        }
      }
    }
  );
  return;
}

    const statJumpBtn = target.closest("[data-stat-jump]");
    if (statJumpBtn instanceof HTMLElement) {
      openScreen(statJumpBtn.dataset.statJump || "feed", { resetHistory: true, pushHistory: false });
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === "plazaIntroForm") {
      event.preventDefault();
      const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
      const lockKey = "form:plazaIntroForm";

      if (plazaActionLocks.has(lockKey)) return;
      plazaActionLocks.add(lockKey);
      setButtonBusy(submitButton, "Submitting...");

      try {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));

        const data = new FormData(form);
        const name = String(data.get("name") || "New member");
        const region = String(data.get("region") || "Unknown region");
        const focus = String(data.get("focus") || "No focus added yet.");

        plazaAdapter.createIntroduction({ name, region, focus });
        closeModal();
        plazaRuntime.feedFilter = "all";
        plazaFeedFilters.forEach((item) => item.classList.toggle("is-active", item.dataset.feedFilter === "all"));
        renderStats();
        renderFeed("all");
        renderRailSignals();
        renderOperationalPreviews();
        openScreen("feed", { resetHistory: true, pushHistory: false });
        showToast("Introduction submitted to Plaza feed.");
      } finally {
        clearButtonBusy(submitButton);
        plazaActionLocks.delete(lockKey);
      }
      return;
    }

    if (form.id === "plazaStructuredRequestForm") {
      event.preventDefault();
      const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
      const requestIdField = form.querySelector('input[name="requestId"]');
      const requestIdValue =
        requestIdField instanceof HTMLInputElement ? String(requestIdField.value || "") : "";
      const submitModeValue =
        submitButton?.dataset.requestSubmitMode || "send";
      const lockKey = `form:plazaStructuredRequestForm:${requestIdValue || "new"}:${submitModeValue}`;

      if (plazaActionLocks.has(lockKey)) return;
      plazaActionLocks.add(lockKey);
      setButtonBusy(submitButton, submitModeValue === "draft" ? "Saving..." : "Sending...");

      try {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));

        const data = new FormData(form);
        const requestId = String(data.get("requestId") || "");
        const existingRequest = requestId ? plazaAdapter.getRequestById(requestId) : null;
        const submitMode = String(submitButton?.dataset.requestSubmitMode || "send");

        const payload = {
          sourceType: String(data.get("sourceType") || "general"),
          targetId: String(data.get("targetId") || ""),
          targetLabel: String(data.get("targetLabel") || "General Plaza request"),
          context: String(data.get("context") || ""),
          region: String(data.get("region") || ""),
          name: String(data.get("name") || "Unknown requester"),
          objective: String(data.get("objective") || "Connection request"),
          message: String(data.get("message") || "")
        };

        const targetStatus =
          submitMode === "draft"
            ? "Draft"
            : existingRequest && (existingRequest.status === "Draft" || existingRequest.status === "Closed")
              ? "Submitted"
              : existingRequest?.status || "Submitted";

        const savedRequest = existingRequest
          ? plazaAdapter.updateRequest(requestId, {
              ...payload,
              status: targetStatus
            })
          : plazaAdapter.createRequest({
              ...payload,
              status: targetStatus
            });

        if (targetStatus === "Draft") {
          plazaOpsAdapter.removeIncomingByRequestId(savedRequest.id);
        } else {
          plazaOpsAdapter.upsertIncomingFromRequest(savedRequest);
        }

        closeDrawer();
        renderRequestsPreview();
        renderRequestsScreen();
        renderInboxScreen();
        renderNotificationsScreen();
        renderMessagesScreen();
        renderOperationalPreviews();
        openRequestsScreen();

        if (submitMode === "draft") {
          showToast(existingRequest ? "Draft updated inside My Requests." : "Draft saved to My Requests.");
        } else if (existingRequest && existingRequest.status === "Closed") {
          showToast(`${savedRequest.routeLabel} reopened inside My Requests.`);
        } else if (existingRequest) {
          showToast(`${savedRequest.routeLabel} updated inside My Requests.`);
        } else {
          showToast(`${savedRequest.routeLabel} sent and added to My Requests.`);
        }
      } finally {
        clearButtonBusy(submitButton);
        plazaActionLocks.delete(lockKey);
      }
      return;
    }

    if (form.id === "plazaApplicationForm") {
      event.preventDefault();
      const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
      const requestIdField = form.querySelector('input[name="requestId"]');
      const requestIdValue =
        requestIdField instanceof HTMLInputElement ? String(requestIdField.value || "") : "";
      const submitModeValue =
        submitButton?.dataset.requestSubmitMode || "send";
      const lockKey = `form:plazaApplicationForm:${requestIdValue || "new"}:${submitModeValue}`;

      if (plazaActionLocks.has(lockKey)) return;
      plazaActionLocks.add(lockKey);
      setButtonBusy(submitButton, submitModeValue === "draft" ? "Saving..." : "Submitting...");

      try {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));

        const data = new FormData(form);
        const requestId = String(data.get("requestId") || "");
        const existingRequest = requestId ? plazaAdapter.getRequestById(requestId) : null;
        const submitMode = String(submitButton?.dataset.requestSubmitMode || "send");
        const resumeFile = data.get("resumeFile");
        const attachmentMeta = [];

        const newAttachment = buildAttachmentMeta(resumeFile);
        if (newAttachment) {
          attachmentMeta.push(newAttachment);
        } else if (existingRequest?.attachmentMeta?.length) {
          attachmentMeta.push(...safeArray(existingRequest.attachmentMeta).map(normalizeAttachmentMeta));
        }

        const payload = {
          sourceType: String(data.get("sourceType") || "opportunity"),
          targetId: String(data.get("targetId") || ""),
          targetLabel: String(data.get("targetLabel") || "Hiring lane"),
          context: String(data.get("context") || ""),
          region: String(data.get("region") || ""),
          name: String(data.get("name") || "Unknown applicant"),
          objective: "Hiring",
          message: String(data.get("message") || ""),
          headline: String(data.get("headline") || ""),
          experience: String(data.get("experience") || ""),
          portfolioLink: String(data.get("portfolioLink") || ""),
          attachmentMeta
        };

        const targetStatus =
          submitMode === "draft"
            ? "Draft"
            : existingRequest && (existingRequest.status === "Draft" || existingRequest.status === "Closed")
              ? "Submitted"
              : existingRequest?.status || "Submitted";

        const savedRequest = existingRequest
          ? plazaAdapter.updateRequest(requestId, {
              ...payload,
              status: targetStatus
            })
          : plazaAdapter.createRequest({
              ...payload,
              status: targetStatus
            });

        if (targetStatus === "Draft") {
          plazaOpsAdapter.removeIncomingByRequestId(savedRequest.id);
        } else {
          plazaOpsAdapter.upsertIncomingFromRequest(savedRequest, {
            kind: "application",
            attachments: attachmentMeta,
            headline: payload.headline,
            experience: payload.experience,
            portfolioLink: payload.portfolioLink
          });
        }

        closeDrawer();
        renderRequestsPreview();
        renderRequestsScreen();
        renderInboxScreen();
        renderNotificationsScreen();
        renderMessagesScreen();
        renderOperationalPreviews();
        openRequestsScreen();

        if (submitMode === "draft") {
          showToast(existingRequest ? "Application draft updated." : "Application draft saved.");
        } else if (existingRequest && existingRequest.status === "Closed") {
          showToast(`${savedRequest.routeLabel} reopened with updated application package.`);
        } else if (existingRequest) {
          showToast(`${savedRequest.routeLabel} updated with new application package.`);
        } else {
          showToast(`${savedRequest.routeLabel} submitted with resume metadata.`);
        }
      } finally {
        clearButtonBusy(submitButton);
        plazaActionLocks.delete(lockKey);
      }
      return;
    }

if (form.id === "plazaConversationForm") {
  event.preventDefault();
  const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
  const lockKey = "form:plazaConversationForm";

  if (plazaActionLocks.has(lockKey)) return;
  plazaActionLocks.add(lockKey);
  setButtonBusy(submitButton, "Sending.");

  try {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    const data = new FormData(form);
    const conversationId = String(data.get("conversationId") || "");
    const message = String(data.get("message") || "").trim();

    if (!conversationId || !message) {
      return;
    }

    const conversation = plazaServerMessagesLoaded
      ? await sendPlazaConversationReply(conversationId, message)
      : plazaOpsAdapter.sendConversationMessage(conversationId, {
          sender: "You",
          text: message
        });

    if (conversation) {
      form.reset();
      if (plazaConversationIdField) {
        plazaConversationIdField.value = conversation.id;
      }
      renderConversationScreen(conversation);
      renderMessagesScreen();
      renderNotificationsScreen();
      renderOperationalPreviews();
      showToast("Reply sent inside Plaza conversation.");
    }
  } finally {
    clearButtonBusy(submitButton);
    plazaActionLocks.delete(lockKey);
  }
  return;
}

    if (form.id === "plazaWinForm") {
      event.preventDefault();
      const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
      const lockKey = "form:plazaWinForm";

      if (plazaActionLocks.has(lockKey)) return;
      plazaActionLocks.add(lockKey);
      setButtonBusy(submitButton, "Sending...");

      try {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));

        const data = new FormData(form);
        const member = String(data.get("member") || "member");
        const name = String(data.get("name") || "Unknown sender");
        const message = String(data.get("message") || "");

        plazaOpsAdapter.createSupportNote({
          member,
          name,
          message,
          context: "Plaza win"
        });

        closeModal();
        renderInboxScreen();
        renderNotificationsScreen();
        renderOperationalPreviews();
        showToast(`Support note sent to ${member}.`);
      } finally {
        clearButtonBusy(submitButton);
        plazaActionLocks.delete(lockKey);
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      closeDrawer();
    }
  });
}

function openIntroModal() {
  openModal({
    kicker: "Plaza Introduction",
    title: "Introduce yourself cleanly.",
    bodyHtml: `
      <div class="yh-plaza-modal-copy">Use this format for Plaza introductions so people can understand who you are, what you do, and what kind of connection you want.</div>
      <form class="yh-plaza-modal-form" id="plazaIntroForm">
        <label>
          <span>Name</span>
          <input type="text" name="name" placeholder="Your name" required />
        </label>
        <label>
          <span>Region</span>
          <input type="text" name="region" placeholder="City or region" required />
        </label>
        <label>
          <span>What are you building?</span>
          <textarea name="focus" placeholder="Describe your current focus" required></textarea>
        </label>
        <button type="submit" class="yh-plaza-btn yh-plaza-btn-primary">Submit Introduction</button>
      </form>
    `
  });
}

async function submitPlazaFeedComposer(event) {
  event.preventDefault();

  if (!plazaFeedComposerForm) return;

  const submitButton = plazaFeedComposerSubmitBtn || event.submitter || null;
  const lockKey = "form:plazaFeedComposer";

  if (plazaActionLocks.has(lockKey)) return;

  const formData = new FormData(plazaFeedComposerForm);
  const payload = {
    type: String(formData.get("type") || "introduction").trim(),
    region: String(formData.get("region") || "Global").trim(),
    title: String(formData.get("title") || "").trim(),
    text: String(formData.get("text") || "").trim()
  };

  if (!payload.text) {
    if (typeof showToast === "function") {
      showToast("Write a Plaza signal first.", "error");
    }
    return;
  }

  plazaActionLocks.add(lockKey);
  setButtonBusy(submitButton, "Posting...");

  try {
    await createPlazaFeedPost(payload);

    plazaFeedComposerForm.reset();
    plazaRuntime.feedFilter = "all";

    plazaFeedFilters.forEach((item) => {
      item.classList.toggle("is-active", item.dataset.feedFilter === "all");
    });

    renderFeed("all");

    if (typeof showToast === "function") {
      showToast("Plaza signal posted.", "success");
    }
  } catch (error) {
    console.error("submitPlazaFeedComposer error:", error);

    if (typeof showToast === "function") {
      showToast(error.message || "Could not post Plaza signal.", "error");
    }
  } finally {
    clearButtonBusy(submitButton);
    plazaActionLocks.delete(lockKey);
  }
}
async function submitPlazaOpportunityComposer(event) {
  event.preventDefault();

  if (!plazaOpportunityComposerForm) return;

  const submitButton = plazaOpportunityComposerSubmitBtn || event.submitter || null;
  const lockKey = "form:plazaOpportunityComposer";

  if (plazaActionLocks.has(lockKey)) return;

  const formData = new FormData(plazaOpportunityComposerForm);
  const payload = {
    type: String(formData.get("type") || "Opportunity").trim(),
    region: String(formData.get("region") || "Global").trim(),
    title: String(formData.get("title") || "").trim(),
    text: String(formData.get("text") || "").trim(),

    economyMode: String(formData.get("economyMode") || "not_sure").trim(),
    currency: String(formData.get("currency") || "USD").trim().toUpperCase(),
    budgetMin: normalizePlazaMoneyValue(formData.get("budgetMin")),
    budgetMax: normalizePlazaMoneyValue(formData.get("budgetMax")),
    commissionRate: normalizePlazaMoneyValue(formData.get("commissionRate")),
    federationEscalation: String(formData.get("federationEscalation") || "none").trim(),
    monetizationNote: String(formData.get("monetizationNote") || "").trim()
  };

  if (!payload.title) {
    if (typeof showToast === "function") {
      showToast("Add an opportunity title first.", "error");
    }
    return;
  }

  if (!payload.text) {
    if (typeof showToast === "function") {
      showToast("Describe the opportunity first.", "error");
    }
    return;
  }

  plazaActionLocks.add(lockKey);
  setButtonBusy(submitButton, "Posting...");

  try {
    await createPlazaOpportunity(payload);

    plazaOpportunityComposerForm.reset();
    renderOpportunities();

    if (typeof showToast === "function") {
      showToast("Plaza opportunity posted.", "success");
    }
  } catch (error) {
    console.error("submitPlazaOpportunityComposer error:", error);

    if (typeof showToast === "function") {
      showToast(error.message || "Could not post Plaza opportunity.", "error");
    }
  } finally {
    clearButtonBusy(submitButton);
    plazaActionLocks.delete(lockKey);
  }
}
async function submitPlazaDirectoryComposer(event) {
  event.preventDefault();

  if (!plazaDirectoryComposerForm) return;

  const submitButton = plazaDirectoryComposerSubmitBtn || event.submitter || null;
  const lockKey = "form:plazaDirectoryComposer";

  if (plazaActionLocks.has(lockKey)) return;

  const formData = new FormData(plazaDirectoryComposerForm);
  const payload = {
    division: String(formData.get("division") || "academy").trim(),
    trust: String(formData.get("trust") || "verified").trim(),
    region: String(formData.get("region") || "Global").trim(),
    availability: String(formData.get("availability") || "").trim(),
    workMode: String(formData.get("workMode") || "").trim(),
    marketplaceMode: String(formData.get("marketplaceMode") || "no").trim(),
    role: String(formData.get("role") || "").trim(),
    tags: String(formData.get("tags") || "").trim(),
    lookingFor: String(formData.get("lookingFor") || "").trim(),
    canOffer: String(formData.get("canOffer") || "").trim(),
    focus: String(formData.get("focus") || "").trim()
  };

  if (!payload.role) {
    if (typeof showToast === "function") {
      showToast("Add your directory role first.", "error");
    }
    return;
  }

  if (!payload.focus) {
    if (typeof showToast === "function") {
      showToast("Add your directory focus first.", "error");
    }
    return;
  }

  plazaActionLocks.add(lockKey);
  setButtonBusy(submitButton, "Saving...");

  try {
    await savePlazaDirectoryProfile(payload);

    renderDirectory();

    if (typeof showToast === "function") {
      showToast("Directory profile saved.", "success");
    }
  } catch (error) {
    console.error("submitPlazaDirectoryComposer error:", error);

    if (typeof showToast === "function") {
      showToast(error.message || "Could not save directory profile.", "error");
    }
  } finally {
    clearButtonBusy(submitButton);
    plazaActionLocks.delete(lockKey);
  }
}
async function submitPlazaRegionComposer(event) {
  event.preventDefault();

  if (!plazaRegionComposerForm) return;

  const submitButton = plazaRegionComposerSubmitBtn || event.submitter || null;
  const lockKey = "form:plazaRegionComposer";

  if (plazaActionLocks.has(lockKey)) return;

  const formData = new FormData(plazaRegionComposerForm);
  const payload = {
    region: String(formData.get("region") || "").trim(),
    label: String(formData.get("label") || "Region Hub").trim(),
    text: String(formData.get("text") || "").trim()
  };

  if (!payload.region) {
    if (typeof showToast === "function") {
      showToast("Add a region name first.", "error");
    }
    return;
  }

  if (!payload.text) {
    if (typeof showToast === "function") {
      showToast("Add a region description first.", "error");
    }
    return;
  }

  plazaActionLocks.add(lockKey);
  setButtonBusy(submitButton, "Creating...");

  try {
    await createPlazaRegion(payload);

    plazaRegionComposerForm.reset();
    renderRegions();

    if (typeof showToast === "function") {
      showToast("Region hub created.", "success");
    }
  } catch (error) {
    console.error("submitPlazaRegionComposer error:", error);

    if (typeof showToast === "function") {
      showToast(error.message || "Could not create region hub.", "error");
    }
  } finally {
    clearButtonBusy(submitButton);
    plazaActionLocks.delete(lockKey);
  }
}
async function submitPlazaBridgeComposer(event) {
  event.preventDefault();

  if (!plazaBridgeComposerForm) return;

  const submitButton = plazaBridgeComposerSubmitBtn || event.submitter || null;
  const lockKey = "form:plazaBridgeComposer";

  if (plazaActionLocks.has(lockKey)) return;

  const formData = new FormData(plazaBridgeComposerForm);
  const payload = {
    stage: String(formData.get("stage") || "Bridge Path").trim(),
    left: String(formData.get("left") || "academy").trim(),
    right: String(formData.get("right") || "federation").trim(),
    region: String(formData.get("region") || "Global").trim(),
    title: String(formData.get("title") || "").trim(),
    nextStep: String(formData.get("nextStep") || "Review and decide the next structured move.").trim(),
    text: String(formData.get("text") || "").trim()
  };

  if (!payload.title) {
    if (typeof showToast === "function") {
      showToast("Add a bridge title first.", "error");
    }
    return;
  }

  if (!payload.text) {
    if (typeof showToast === "function") {
      showToast("Add a bridge description first.", "error");
    }
    return;
  }

  plazaActionLocks.add(lockKey);
  setButtonBusy(submitButton, "Creating...");

  try {
    await createPlazaBridge(payload);

    plazaBridgeComposerForm.reset();
    renderBridge();

    if (typeof showToast === "function") {
      showToast("Bridge path created.", "success");
    }
  } catch (error) {
    console.error("submitPlazaBridgeComposer error:", error);

    if (typeof showToast === "function") {
      showToast(error.message || "Could not create bridge path.", "error");
    }
  } finally {
    clearButtonBusy(submitButton);
    plazaActionLocks.delete(lockKey);
  }
}
async function submitPlazaRequestComposer(event) {
  event.preventDefault();

  if (!plazaRequestComposerForm) return;

  const submitButton = plazaRequestComposerSubmitBtn || event.submitter || null;
  const lockKey = "form:plazaRequestComposer";

  if (plazaActionLocks.has(lockKey)) return;

  const formData = new FormData(plazaRequestComposerForm);
  const payload = {
    objective: String(formData.get("objective") || "Connection request").trim(),
    sourceType: String(formData.get("sourceType") || "general").trim(),
    region: String(formData.get("region") || "").trim(),
    targetLabel: String(formData.get("targetLabel") || "General Plaza request").trim(),
    message: String(formData.get("message") || "").trim()
  };

  if (!payload.message) {
    if (typeof showToast === "function") {
      showToast("Add a request message first.", "error");
    }
    return;
  }

  plazaActionLocks.add(lockKey);
  setButtonBusy(submitButton, "Submitting...");

  try {
    const request = await createPlazaRequest(payload);

    if (request) {
      plazaOpsAdapter.syncIncomingStatusFromRequest(request);
    }

    plazaRequestComposerForm.reset();
    renderRequestsPreview();
    renderRequestsScreen();
    renderInboxScreen();
    renderOperationalPreviews();

    if (typeof showToast === "function") {
      showToast("Plaza request submitted.", "success");
    }
  } catch (error) {
    console.error("submitPlazaRequestComposer error:", error);

    if (typeof showToast === "function") {
      showToast(error.message || "Could not submit Plaza request.", "error");
    }
  } finally {
    clearButtonBusy(submitButton);
    plazaActionLocks.delete(lockKey);
  }
}
function normalizePlazaApplicationStatus(value = "") {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) return "";
  if (raw === "approved" || raw === "active") return "approved";
  if (raw === "under review" || raw === "pending" || raw === "pending review" || raw === "review") return "under review";
  if (raw === "screening" || raw === "in screening") return "screening";
  if (raw === "shortlisted" || raw === "shortlist") return "shortlisted";
  if (raw === "waitlisted" || raw === "waitlist") return "waitlisted";
  if (raw === "rejected" || raw === "denied" || raw === "not approved") return "rejected";

  return raw;
}

let plazaApplicationCurrentStep = "membershipType";

function getPlazaInputValue(input) {
  return String(input?.value || "").trim();
}

function setPlazaRequired(input, required) {
  if (!input) return;
  if (required) {
    input.setAttribute("required", "required");
  } else {
    input.removeAttribute("required");
  }
}

function setPlazaHidden(node, hidden) {
  if (!node) return;
  node.hidden = Boolean(hidden);
}

function getPlazaApplicationSteps() {
  return Array.from(document.querySelectorAll("[data-plaza-app-step]"));
}

function getPlazaApplicationStepNode(stepKey = "") {
  return document.querySelector(`[data-plaza-app-step="${CSS.escape(stepKey)}"]`);
}

function getPlazaApplicationInputForStep(stepKey = "") {
  const map = {
    membershipType: plazaAppMembershipType,
    email: plazaAppEmail,
    fullName: plazaAppFullName,
    age: plazaAppAge,
    currentProject: plazaAppCurrentProject,
    resourcesNeeded: plazaAppResourcesNeeded,
    joinedAt: plazaAppJoinedAt,
    learntSoFar: plazaAppLearntSoFar,
    contribution: plazaAppContribution,
    wantsPatron: plazaAppWantsPatron,
    patronExpectation: plazaAppPatronExpectation,
    leadershipExperience: plazaAppLeadershipExperience,
    country: plazaAppCountry,
    wantsMarketplace: plazaAppWantsMarketplace,
    servicesProducts: plazaAppServicesProducts,
    referredBy: plazaAppReferredBy,
    howHeard: plazaAppHowHeard
  };

  return map[stepKey] || null;
}

function readPlazaCacheJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function normalizePlazaSeedList(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(",");

  return Array.from(new Set(
    source
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )).slice(0, 8);
}

function joinPlazaSeedList(value = [], fallback = "") {
  const normalized = normalizePlazaSeedList(value);
  return normalized.length ? normalized.join(", ") : fallback;
}

function setPlazaInputIfBlank(input, nextValue) {
  if (!input) return;
  if (String(input.value || "").trim()) return;

  const clean = String(nextValue ?? "").trim();
  if (!clean) return;

  input.value = clean;
}

function setPlazaComposerValueIfBlank(id, nextValue) {
  const input = document.getElementById(id);
  if (!input) return;
  if (String(input.value || "").trim()) return;

  const clean = String(nextValue ?? "").trim();
  if (!clean) return;

  input.value = clean;
}

function buildPlazaAcademySeed() {
  const academyHome = readPlazaCacheJson("yh_academy_home", {}) || {};
  const academySnapshot = readPlazaCacheJson("yh_academy_membership_status_v1", {}) || {};
  const plazaSnapshot = readPlazaCacheJson("yh_plaza_access_status_v1", {}) || {};

  const application =
    plazaSnapshot?.application && typeof plazaSnapshot.application === "object"
      ? plazaSnapshot.application
      : {};

  const profileSignals =
    academyHome?.profileSignals && typeof academyHome.profileSignals === "object"
      ? academyHome.profileSignals
      : {};

  const plazaReadiness =
    academyHome?.plazaReadiness && typeof academyHome.plazaReadiness === "object"
      ? academyHome.plazaReadiness
      : {};

  const roleTrack = String(
    profileSignals?.roleTrack ||
    application.currentProject ||
    ""
  ).trim();

  const lookingFor = normalizePlazaSeedList(
    profileSignals?.lookingFor ||
    application.resourcesNeeded ||
    []
  );

  const canOffer = normalizePlazaSeedList(
    profileSignals?.canOffer ||
    application.contribution ||
    application.servicesProducts ||
    []
  );

  const availability = String(profileSignals?.availability || "").trim();
  const workMode = String(profileSignals?.workMode || "").trim();
  const proofFocus = String(profileSignals?.proofFocus || "").trim();

  const readinessScore = Number(plazaReadiness?.score || 0);
  const readinessStatus = String(plazaReadiness?.statusLabel || "").trim();

  const marketplaceReady =
    plazaReadiness?.marketplaceReady === true ||
    profileSignals?.marketplaceReady === true;

  const membershipType = academySnapshot?.canEnterAcademy === true
    ? "academy"
    : String(application.membershipType || "").trim();

  const email = String(
    localStorage.getItem("yh_user_email") ||
    localStorage.getItem("email") ||
    application.email ||
    ""
  ).trim();

  const fullName = String(
    localStorage.getItem("yh_user_full_name") ||
    localStorage.getItem("yh_user_name") ||
    localStorage.getItem("name") ||
    application.fullName ||
    ""
  ).trim();

  const country = String(
    localStorage.getItem("yh_user_country") ||
    application.country ||
    ""
  ).trim();

  const currentProject = [roleTrack, proofFocus].filter(Boolean).join(" — ");

  return {
    membershipType,
    email,
    fullName,
    country,
    roleTrack,
    lookingFor,
    canOffer,
    availability,
    workMode,
    proofFocus,
    readinessScore,
    readinessStatus,
    marketplaceReady,
    currentProject,
    resourcesNeeded: joinPlazaSeedList(lookingFor),
    contribution: joinPlazaSeedList(canOffer),
    servicesProducts: joinPlazaSeedList(canOffer),
    wantsMarketplace: marketplaceReady || canOffer.length > 0 ? "yes" : ""
  };
}

function prefillPlazaApplicationBasics() {
  try {
    const seed = buildPlazaAcademySeed();

    setPlazaInputIfBlank(plazaAppMembershipType, seed.membershipType);
    setPlazaInputIfBlank(plazaAppEmail, seed.email);
    setPlazaInputIfBlank(plazaAppFullName, seed.fullName);
    setPlazaInputIfBlank(plazaAppCurrentProject, seed.currentProject);
    setPlazaInputIfBlank(plazaAppResourcesNeeded, seed.resourcesNeeded);
    setPlazaInputIfBlank(plazaAppContribution, seed.contribution);
    setPlazaInputIfBlank(plazaAppCountry, seed.country);
    setPlazaInputIfBlank(plazaAppServicesProducts, seed.servicesProducts);

    if (
      plazaAppWantsMarketplace &&
      !String(plazaAppWantsMarketplace.value || "").trim() &&
      seed.wantsMarketplace
    ) {
      plazaAppWantsMarketplace.value = seed.wantsMarketplace;
    }

    syncPlazaApplicationLabels();
    syncPlazaApplicationRequiredState();
  } catch (_) {}
}

function prefillPlazaDirectoryComposerFromAcademySignal() {
  const seed = buildPlazaAcademySeed();

  const tags = Array.from(new Set(
    [seed.roleTrack, ...seed.canOffer]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )).slice(0, 8).join(", ");

  const focus =
    String(seed.proofFocus || "").trim() ||
    String(seed.currentProject || "").trim() ||
    (seed.canOffer.length ? `Can offer: ${joinPlazaSeedList(seed.canOffer)}` : "");

  setPlazaComposerValueIfBlank(
    "plazaDirectoryComposerDivision",
    seed.membershipType === "federation" ? "federation" : "academy"
  );

  setPlazaComposerValueIfBlank(
    "plazaDirectoryComposerTrust",
    seed.readinessScore >= 75 ? "connector" : "verified"
  );

  setPlazaComposerValueIfBlank(
    "plazaDirectoryComposerRegion",
    seed.country || "Global"
  );

  setPlazaComposerValueIfBlank(
    "plazaDirectoryComposerAvailability",
    seed.availability
  );

  setPlazaComposerValueIfBlank(
    "plazaDirectoryComposerWorkMode",
    seed.workMode
  );

  if (seed.marketplaceReady === true) {
    setPlazaComposerValueIfBlank(
      "plazaDirectoryComposerMarketplaceMode",
      "yes"
    );
  }

  setPlazaComposerValueIfBlank(
    "plazaDirectoryComposerRole",
    seed.roleTrack
  );

  setPlazaComposerValueIfBlank(
    "plazaDirectoryComposerTags",
    tags
  );

  setPlazaComposerValueIfBlank(
    "plazaDirectoryComposerLookingFor",
    joinPlazaSeedList(seed.lookingFor)
  );

  setPlazaComposerValueIfBlank(
    "plazaDirectoryComposerCanOffer",
    joinPlazaSeedList(seed.canOffer)
  );

  setPlazaComposerValueIfBlank(
    "plazaDirectoryComposerFocus",
    focus
  );
}
const PLAZA_DIRECTORY_AUTOSEED_KEY = "yhPlazaDirectoryAutoSeedV1";
const PLAZA_DIRECTORY_STATUS_CACHE_KEY = "yhPlazaDirectoryStatusV1";
let plazaDirectoryAutoSeedPromise = null;

function buildPlazaDirectoryPayloadFromAcademySignal() {
  const seed = buildPlazaAcademySeed();

  const role = String(seed.roleTrack || "").trim();
  const tags = Array.from(new Set(
    [seed.roleTrack, ...seed.canOffer]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )).slice(0, 8).join(", ");

  const focus =
    String(seed.proofFocus || "").trim() ||
    String(seed.currentProject || "").trim() ||
    (seed.canOffer.length ? `Can offer: ${joinPlazaSeedList(seed.canOffer)}` : "");

  if (!role || !focus) {
    return null;
  }

  return {
    division: seed.membershipType === "federation" ? "federation" : "academy",
    trust: seed.readinessScore >= 75 ? "connector" : "verified",
    region: seed.country || "Global",
    availability: seed.availability || "",
    workMode: seed.workMode || "",
    marketplaceMode: seed.marketplaceReady === true ? "yes" : "no",
    role,
    tags,
    lookingFor: joinPlazaSeedList(seed.lookingFor),
    canOffer: joinPlazaSeedList(seed.canOffer),
    focus
  };
}

function getPlazaDirectoryAutoSeedFingerprint(payload = {}) {
  return JSON.stringify({
    division: payload.division || "",
    trust: payload.trust || "",
    region: payload.region || "",
    availability: payload.availability || "",
    workMode: payload.workMode || "",
    marketplaceMode: payload.marketplaceMode || "",
    role: payload.role || "",
    tags: payload.tags || "",
    lookingFor: payload.lookingFor || "",
    canOffer: payload.canOffer || "",
    focus: payload.focus || ""
  });
}

function hasPlazaDirectoryAutoSeeded(payload = {}) {
  try {
    const nextFingerprint = getPlazaDirectoryAutoSeedFingerprint(payload);
    const storedFingerprint = String(localStorage.getItem(PLAZA_DIRECTORY_AUTOSEED_KEY) || "").trim();
    return storedFingerprint && storedFingerprint === nextFingerprint;
  } catch (_) {
    return false;
  }
}

function markPlazaDirectoryAutoSeeded(payload = {}) {
  try {
    localStorage.setItem(
      PLAZA_DIRECTORY_AUTOSEED_KEY,
      getPlazaDirectoryAutoSeedFingerprint(payload)
    );
  } catch (_) {}
}
function writePlazaDirectoryStatusCache(profile = null, options = {}) {
  try {
    if (!profile || typeof profile !== "object") {
      localStorage.removeItem(PLAZA_DIRECTORY_STATUS_CACHE_KEY);
      return;
    }

    const tags = Array.isArray(profile.tags) ? profile.tags : [];
    const lookingFor = Array.isArray(profile.lookingFor) ? profile.lookingFor : [];
    const canOffer = Array.isArray(profile.canOffer) ? profile.canOffer : [];

    const role = String(profile.role || "").trim();
    const focus = String(profile.focus || "").trim();
    const marketplaceMode = String(profile.marketplaceMode || "no").trim().toLowerCase() === "yes";
    const trust = String(profile.trust || "").trim().toLowerCase();
    const source = String(options.source || "manual").trim() || "manual";
    const availability = String(profile.availability || "").trim();
    const workMode = String(profile.workMode || "").trim();
    const region = String(profile.region || "").trim();

    const readyForOpportunityFlow =
      Boolean(role) &&
      Boolean(focus) &&
      (canOffer.length > 0 || tags.length > 0);

    let opportunityScore = 0;

    if (role) opportunityScore += 16;
    if (focus) opportunityScore += 16;
    if (canOffer.length > 0) opportunityScore += 18;
    if (lookingFor.length > 0) opportunityScore += 10;
    if (tags.length >= 2) opportunityScore += 10;
    else if (tags.length === 1) opportunityScore += 6;
    if (availability) opportunityScore += 8;
    if (workMode) opportunityScore += 8;
    if (marketplaceMode) opportunityScore += 8;
    if (trust === "connector") opportunityScore += 4;
    if (trust === "leader") opportunityScore += 8;

    opportunityScore = Math.max(0, Math.min(100, opportunityScore));

    const strategicEligible =
      opportunityScore >= 85 &&
      marketplaceMode === true &&
      canOffer.length >= 2 &&
      (trust === "connector" || trust === "leader");

    let opportunityStage = "Weak";
    let opportunityCopy = "Your Plaza profile exists, but it is still too thin for strong opportunity flow.";

    if (strategicEligible) {
      opportunityStage = "Ready for Strategic Escalation";
      opportunityCopy = "Your Plaza profile is strong enough for strategic routing, higher-trust visibility, and escalation toward Federation-level leverage.";
    } else if (opportunityScore >= 65) {
      opportunityStage = "Ready for Matching";
      opportunityCopy = "Your Plaza profile is strong enough to support direct matching, opportunity routing, and marketplace visibility.";
    } else if (opportunityScore >= 40) {
      opportunityStage = "Active";
      opportunityCopy = "Your Plaza profile is active, but it still needs stronger signal before it becomes highly matchable.";
    }

    localStorage.setItem(
      PLAZA_DIRECTORY_STATUS_CACHE_KEY,
      JSON.stringify({
        seeded: true,
        source,
        readyForOpportunityFlow,
        profileId: String(profile.id || "").trim(),
        role,
        focus,
        trust,
        region,
        marketplaceMode,
        availability,
        workMode,
        tags,
        lookingFor,
        canOffer,
        opportunityScore,
        opportunityStage,
        opportunityCopy,
        strategicEligible,
        cachedAt: new Date().toISOString()
      })
    );
  } catch (_) {}
}
async function autoSavePlazaDirectoryProfileFromAcademySignal() {
  if (plazaDirectoryAutoSeedPromise) return plazaDirectoryAutoSeedPromise;

  const payload = buildPlazaDirectoryPayloadFromAcademySignal();
  if (!payload) return null;

  if (hasPlazaDirectoryAutoSeeded(payload)) {
    return null;
  }

  plazaDirectoryAutoSeedPromise = (async () => {
    try {
      const profile = await savePlazaDirectoryProfile(payload);
      markPlazaDirectoryAutoSeeded(payload);

    if (profile) {
      plazaServerDirectoryLoaded = true;
      writePlazaDirectoryStatusCache(profile, { source: "auto-seed" });
      renderDirectory();
    }

    return profile;
    } catch (error) {
      console.error("autoSavePlazaDirectoryProfileFromAcademySignal error:", error);
      return null;
    } finally {
      plazaDirectoryAutoSeedPromise = null;
    }
  })();

  return plazaDirectoryAutoSeedPromise;
}

function syncPlazaApplicationLabels() {
  const membershipType = getPlazaInputValue(plazaAppMembershipType);
  const labels = PLAZA_MEMBERSHIP_LABELS[membershipType] || PLAZA_MEMBERSHIP_LABELS.academy;

  if (plazaAppJoinedLabel) plazaAppJoinedLabel.textContent = `7. ${labels.joined}`;
  if (plazaAppLearntLabel) plazaAppLearntLabel.textContent = `8. ${labels.learnt}`;
  if (plazaAppContributionLabel) plazaAppContributionLabel.textContent = `9. ${labels.contribution}`;
}

function getPlazaApplicationFlow() {
  const membershipType = getPlazaInputValue(plazaAppMembershipType);
  const wantsPatron = getPlazaInputValue(plazaAppWantsPatron);
  const wantsMarketplace = getPlazaInputValue(plazaAppWantsMarketplace);
  const referredBy = getPlazaInputValue(plazaAppReferredBy);

  const flow = ["membershipType", "email"];

  if (membershipType === "not_yet") {
    flow.push("stop");
    return flow;
  }

  if (membershipType !== "academy" && membershipType !== "federation") {
    return flow;
  }

  flow.push(
    "fullName",
    "age",
    "currentProject",
    "resourcesNeeded",
    "joinedAt",
    "learntSoFar",
    "contribution",
    "wantsPatron"
  );

  if (wantsPatron === "yes") {
    flow.push("patronExpectation", "leadershipExperience", "country");
  } else if (wantsPatron === "no") {
    flow.push("country");
  } else {
    return flow;
  }

  flow.push("wantsMarketplace");

  if (wantsMarketplace === "yes") {
    flow.push("servicesProducts", "referredBy");
  } else if (wantsMarketplace === "no") {
    flow.push("referredBy");
  } else {
    return flow;
  }

  if (!referredBy) {
    flow.push("howHeard");
  }

  flow.push("submit");
  return flow;
}

function syncPlazaApplicationRequiredState() {
  [
    plazaAppMembershipType,
    plazaAppEmail,
    plazaAppFullName,
    plazaAppAge,
    plazaAppCurrentProject,
    plazaAppResourcesNeeded,
    plazaAppJoinedAt,
    plazaAppLearntSoFar,
    plazaAppContribution,
    plazaAppWantsPatron,
    plazaAppPatronExpectation,
    plazaAppLeadershipExperience,
    plazaAppCountry,
    plazaAppWantsMarketplace,
    plazaAppServicesProducts,
    plazaAppReferredBy,
    plazaAppHowHeard
  ].forEach((field) => {
    setPlazaRequired(field, false);
  });

  const flow = new Set(getPlazaApplicationFlow());

  setPlazaRequired(plazaAppMembershipType, true);
  setPlazaRequired(plazaAppEmail, true);

  if (flow.has("fullName")) setPlazaRequired(plazaAppFullName, true);
  if (flow.has("age")) setPlazaRequired(plazaAppAge, true);
  if (flow.has("currentProject")) setPlazaRequired(plazaAppCurrentProject, true);
  if (flow.has("resourcesNeeded")) setPlazaRequired(plazaAppResourcesNeeded, true);
  if (flow.has("joinedAt")) setPlazaRequired(plazaAppJoinedAt, true);
  if (flow.has("learntSoFar")) setPlazaRequired(plazaAppLearntSoFar, true);
  if (flow.has("contribution")) setPlazaRequired(plazaAppContribution, true);
  if (flow.has("wantsPatron")) setPlazaRequired(plazaAppWantsPatron, true);
  if (flow.has("patronExpectation")) setPlazaRequired(plazaAppPatronExpectation, true);
  if (flow.has("leadershipExperience")) setPlazaRequired(plazaAppLeadershipExperience, true);
  if (flow.has("country")) setPlazaRequired(plazaAppCountry, true);
  if (flow.has("wantsMarketplace")) setPlazaRequired(plazaAppWantsMarketplace, true);
  if (flow.has("servicesProducts")) setPlazaRequired(plazaAppServicesProducts, true);
  if (flow.has("howHeard")) setPlazaRequired(plazaAppHowHeard, true);
}

function updatePlazaApplicationProgress(stepKey = "") {
  const flow = getPlazaApplicationFlow().filter((step) => step !== "stop" && step !== "submit");
  const index = Math.max(flow.indexOf(stepKey), 0);
  const total = Math.max(flow.length, 1);
  const percent = Math.min(((index + 1) / total) * 100, 100);

  if (plazaApplicationProgressText) {
    plazaApplicationProgressText.textContent = stepKey === "submit"
      ? "Ready to submit"
      : `Question ${Math.min(index + 1, total)} of ${total}`;
  }

  if (plazaApplicationProgressBar) {
    plazaApplicationProgressBar.style.width = `${percent}%`;
  }
}

function setPlazaApplicationActiveStep(stepKey = "membershipType", options = {}) {
  plazaApplicationCurrentStep = stepKey;
  syncPlazaApplicationLabels();
  syncPlazaApplicationRequiredState();

  const memberStepKeys = new Set([
    "fullName",
    "age",
    "currentProject",
    "resourcesNeeded",
    "joinedAt",
    "learntSoFar",
    "contribution",
    "wantsPatron",
    "patronExpectation",
    "leadershipExperience",
    "country",
    "wantsMarketplace",
    "servicesProducts",
    "referredBy",
    "howHeard",
    "submit"
  ]);

  const patronStepKeys = new Set(["patronExpectation", "leadershipExperience"]);
  const marketplaceStepKeys = new Set(["wantsMarketplace", "servicesProducts", "referredBy", "howHeard"]);

  setPlazaHidden(plazaApplicationMemberFields, !memberStepKeys.has(stepKey));
  setPlazaHidden(plazaApplicationStopNotice, stepKey !== "stop");
  setPlazaHidden(plazaPatronYesFields, !patronStepKeys.has(stepKey));
  setPlazaHidden(plazaMarketplaceFields, !marketplaceStepKeys.has(stepKey));
  setPlazaHidden(plazaServicesProductsField, stepKey !== "servicesProducts");
  setPlazaHidden(plazaReferralField, stepKey !== "referredBy");
  setPlazaHidden(plazaHowHeardField, stepKey !== "howHeard");

  getPlazaApplicationSteps().forEach((stepNode) => {
    const isActive = stepNode.dataset.plazaAppStep === stepKey;
    stepNode.hidden = !isActive;

    stepNode.querySelectorAll("input, select, textarea, button").forEach((field) => {
      if (field instanceof HTMLButtonElement && field.type === "submit") return;
      field.disabled = !isActive;
    });
  });

  const activeInput = getPlazaApplicationInputForStep(stepKey);

  if (activeInput && options.focus !== false) {
    window.setTimeout(() => {
      activeInput.focus();
    }, 60);
  }

  updatePlazaApplicationProgress(stepKey);
}

function resetPlazaApplicationFlow() {
  setPlazaApplicationActiveStep("membershipType", { focus: false });
}

function getPlazaNextApplicationStep(currentStep = plazaApplicationCurrentStep) {
  const flow = getPlazaApplicationFlow();
  const currentIndex = flow.indexOf(currentStep);

  if (currentIndex === -1) return flow[0] || "membershipType";

  return flow[currentIndex + 1] || "submit";
}

function validatePlazaApplicationStep(stepKey = plazaApplicationCurrentStep) {
  if (stepKey === "referredBy") return true;
  if (stepKey === "stop" || stepKey === "submit") return true;

  const input = getPlazaApplicationInputForStep(stepKey);
  if (!input) return true;

  const value = getPlazaInputValue(input);

  if (!value) {
    if (typeof showToast === "function") {
      showToast("Please answer this question first.", "error");
    }
    input.focus();
    return false;
  }

  if (stepKey === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    if (typeof showToast === "function") {
      showToast("Please enter a valid email address.", "error");
    }
    input.focus();
    return false;
  }

  if (stepKey === "age") {
    const age = Number.parseInt(value, 10);
    if (!Number.isFinite(age) || age < 13 || age > 120) {
      if (typeof showToast === "function") {
        showToast("Please enter a valid age.", "error");
      }
      input.focus();
      return false;
    }
  }

  return true;
}

function goToNextPlazaApplicationStep() {
  if (!validatePlazaApplicationStep(plazaApplicationCurrentStep)) return;

  const nextStep = getPlazaNextApplicationStep(plazaApplicationCurrentStep);
  setPlazaApplicationActiveStep(nextStep);
}

function syncPlazaMembershipBranch() {
  syncPlazaApplicationLabels();
  syncPlazaApplicationRequiredState();

  if (plazaApplicationCurrentStep === "membershipType") return;

  const flow = getPlazaApplicationFlow();
  if (!flow.includes(plazaApplicationCurrentStep)) {
    setPlazaApplicationActiveStep(flow[flow.length - 1] || "membershipType");
  }
}

function syncPlazaPatronBranch() {
  syncPlazaApplicationRequiredState();
}

function syncPlazaMarketplaceBranch() {
  syncPlazaApplicationRequiredState();
}

function buildPlazaApplicationPayload() {
  const membershipType = getPlazaInputValue(plazaAppMembershipType);
  const wantsPatron = getPlazaInputValue(plazaAppWantsPatron);
  const wantsMarketplace = getPlazaInputValue(plazaAppWantsMarketplace);

  return {
    schemaVersion: PLAZA_APPLICATION_SCHEMA_VERSION,

    membershipType,
    email: getPlazaInputValue(plazaAppEmail),

    fullName: getPlazaInputValue(plazaAppFullName),
    age: getPlazaInputValue(plazaAppAge),
    currentProject: getPlazaInputValue(plazaAppCurrentProject),
    resourcesNeeded: getPlazaInputValue(plazaAppResourcesNeeded),

    joinedAt: getPlazaInputValue(plazaAppJoinedAt),
    learntSoFar: getPlazaInputValue(plazaAppLearntSoFar),
    contribution: getPlazaInputValue(plazaAppContribution),

    wantsPatron,
    patronExpectation: wantsPatron === "yes" ? getPlazaInputValue(plazaAppPatronExpectation) : "",
    leadershipExperience: wantsPatron === "yes" ? getPlazaInputValue(plazaAppLeadershipExperience) : "",

    country: getPlazaInputValue(plazaAppCountry),

    wantsMarketplace,
    servicesProducts: wantsMarketplace === "yes" ? getPlazaInputValue(plazaAppServicesProducts) : "",

    referredBy: getPlazaInputValue(plazaAppReferredBy),
    howHeard: getPlazaInputValue(plazaAppHowHeard)
  };
}

function showPlazaAccessGate(snapshot = {}) {
  document.body.classList.remove("yh-plaza-access-booting");
  document.body.classList.add("yh-plaza-access-locked");

  if (plazaAccessGate) {
    plazaAccessGate.hidden = false;
  }

  const status = normalizePlazaApplicationStatus(snapshot.applicationStatus || snapshot.application?.status || "");

  if (plazaAccessStatusCard) {
    if (snapshot.hasApplication && status !== "rejected") {
      plazaAccessStatusCard.hidden = false;
      plazaAccessStatusCard.innerHTML = `
        <strong>Your Plaza application is ${escapeHtml(status || "under review")}.</strong>
        <p>Admin approval is required before you can enter the Plaza universe. You do not need to submit another application right now.</p>
      `;
    } else if (status === "rejected") {
      plazaAccessStatusCard.hidden = false;
      plazaAccessStatusCard.innerHTML = `
        <strong>Your previous Plaza application was not approved.</strong>
        <p>You may submit a new application with stronger, clearer information.</p>
      `;
    } else {
      plazaAccessStatusCard.hidden = true;
      plazaAccessStatusCard.innerHTML = "";
    }
  }

  if (plazaApplicationForm) {
    plazaApplicationForm.hidden = true;
  }
}

function unlockPlazaAccess() {
  document.body.classList.remove("yh-plaza-access-booting", "yh-plaza-access-locked");

  if (plazaAccessGate) {
    plazaAccessGate.hidden = true;
  }

  window.requestAnimationFrame(() => {
    prefillPlazaDirectoryComposerFromAcademySignal();
    autoSavePlazaDirectoryProfileFromAcademySignal().catch(() => {});
  });
} 

async function loadPlazaApplicationStatus() {
  const result = await plazaApiFetch("/api/plaza/application-status", {
    method: "GET"
  });

  return {
    hasApplication: result?.hasApplication === true,
    canEnterPlaza: result?.canEnterPlaza === true,
    applicationStatus: result?.applicationStatus || "",
    application: result?.application || null,
    member: result?.member || null
  };
}

async function submitPlazaApplication(event) {
  event?.preventDefault?.();

  syncPlazaApplicationRequiredState();

  const payload = buildPlazaApplicationPayload();

  if (payload.membershipType === "not_yet") {
    if (typeof showToast === "function") {
      showToast("Plaza is only open to Academy or Federation members.", "error");
    }
    return;
  }

  if (!payload.referredBy && !payload.howHeard) {
    if (typeof showToast === "function") {
      showToast("Add who referred you or how you heard from us.", "error");
    }
    if (plazaAppHowHeard) plazaAppHowHeard.focus();
    return;
  }

  const lockKey = "form:plazaApplication";
  if (plazaActionLocks.has(lockKey)) return;

  plazaActionLocks.add(lockKey);
  setButtonBusy(plazaApplicationSubmitBtn, "Submitting...");

  try {
    const result = await plazaApiFetch("/api/plaza/applications", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    showPlazaAccessGate({
      hasApplication: true,
      canEnterPlaza: result?.canEnterPlaza === true,
      applicationStatus: result?.applicationStatus || "Under Review",
      application: result?.application || null
    });

    if (typeof showToast === "function") {
      showToast("Plaza application submitted. Wait for admin approval.", "success");
    }
  } catch (error) {
    console.error("submitPlazaApplication error:", error);

    if (typeof showToast === "function") {
      showToast(error.message || "Could not submit Plaza application.", "error");
    }
  } finally {
    clearButtonBusy(plazaApplicationSubmitBtn);
    plazaActionLocks.delete(lockKey);
  }
}

function bindPlazaApplicationGateEvents() {
  if (!plazaApplicationForm || plazaApplicationForm.dataset.typeformBound === "true") return;

  plazaApplicationForm.dataset.typeformBound = "true";

  plazaApplicationForm.addEventListener("click", (event) => {
    const nextButton = event.target.closest("[data-plaza-app-next]");
    if (!nextButton) return;

    event.preventDefault();
    goToNextPlazaApplicationStep();
  });

  plazaApplicationForm.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;

    const target = event.target;
    if (target instanceof HTMLTextAreaElement) return;

    const activeStep = getPlazaApplicationStepNode(plazaApplicationCurrentStep);
    if (!activeStep || !activeStep.contains(target)) return;

    event.preventDefault();
    goToNextPlazaApplicationStep();
  });

  plazaAppMembershipType?.addEventListener("change", syncPlazaMembershipBranch);
  plazaAppWantsPatron?.addEventListener("change", syncPlazaPatronBranch);
  plazaAppWantsMarketplace?.addEventListener("change", syncPlazaMarketplaceBranch);
  plazaAppReferredBy?.addEventListener("input", syncPlazaMarketplaceBranch);

  plazaApplicationForm.addEventListener("submit", submitPlazaApplication);
}

async function ensurePlazaAccessBeforeBoot() {
  bindPlazaApplicationGateEvents();

  try {
    const snapshot = await loadPlazaApplicationStatus();

    if (snapshot.canEnterPlaza === true) {
      unlockPlazaAccess();
      return true;
    }

    showPlazaAccessGate(snapshot);
    return false;
  } catch (error) {
    console.error("ensurePlazaAccessBeforeBoot error:", error);
    showPlazaAccessGate({
      hasApplication: false,
      canEnterPlaza: false,
      applicationStatus: ""
    });

    if (typeof showToast === "function") {
      showToast(error.message || "Could not verify Plaza access.", "error");
    }

    return false;
  }
}
async function initPlaza() {
  const canEnterPlaza = await ensurePlazaAccessBeforeBoot();

  if (!canEnterPlaza) {
    return;
  }

  renderStats();
  populateRegionFilter();

  const restoredScreen = restorePlazaUiState();

  plazaFeedFilters.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.feedFilter === plazaRuntime.feedFilter);
  });

  renderFeed(plazaRuntime.feedFilter);
  renderDirectory();
  renderOpportunities();
  renderRegions();
  renderBridge();
  renderRailSignals();
  renderRequestsPreview();
  renderRequestsScreen();
  renderInboxScreen();
  renderNotificationsScreen();
  renderMessagesScreen();
  renderOperationalPreviews();
openScreen(restoredScreen, { resetHistory: true, pushHistory: false, showLoader: false });
  bindEvents();

  if (plazaFeedComposerForm) {
    plazaFeedComposerForm.addEventListener("submit", submitPlazaFeedComposer);
  }

  if (plazaOpportunityComposerForm) {
    plazaOpportunityComposerForm.addEventListener("submit", submitPlazaOpportunityComposer);
  }

if (plazaDirectoryComposerForm) {
  plazaDirectoryComposerForm.addEventListener("submit", submitPlazaDirectoryComposer);
}

if (plazaRegionComposerForm) {
  plazaRegionComposerForm.addEventListener("submit", submitPlazaRegionComposer);
}

if (plazaBridgeComposerForm) {
  plazaBridgeComposerForm.addEventListener("submit", submitPlazaBridgeComposer);
}

if (plazaRequestComposerForm) {
  plazaRequestComposerForm.addEventListener("submit", submitPlazaRequestComposer);
}

await loadPlazaFeedFromServer({
  silent: restoredScreen !== "feed"
});

await loadPlazaOpportunitiesFromServer({
  silent: restoredScreen !== "opportunities"
});

await loadPlazaDirectoryFromServer({
  silent: restoredScreen !== "directory"
});

await loadPlazaRegionsFromServer({
  silent: restoredScreen !== "regions"
});

await loadPlazaBridgeFromServer({
  silent: restoredScreen !== "bridge"
});

await loadPlazaRequestsFromServer({
  silent: restoredScreen !== "requests"
});

await loadPlazaMessagesFromServer({
  silent: restoredScreen !== "messages"
});

  if (typeof window.translateCurrentPage === "function") {
    window.translateCurrentPage();
  }
}

initPlaza();