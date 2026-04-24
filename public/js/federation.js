const STORAGE_KEYS = {
  applications: "yh_federation_applications",
  members: "yh_federation_members",
  currentUser: "yh_federation_current_user",
  adminMode: "yh_federation_admin_mode",
  connectRequests: "yh_federation_connect_requests_v1"
};

const seedMembers = [
  {
    id: "seed-david-okonkwo",
    email: "david.okonkwo@yhfederation.local",
    emailLower: "david.okonkwo@yhfederation.local",
    name: "David Okonkwo",
    role: "Managing Partner, Okonkwo Legal",
    badge: "Verified",
    category: "Lawyers & Legal Strategists",
    country: "Nigeria",
    city: "Abuja",
    company: "Okonkwo Legal",
    description:
      "Legal strategist with connections across business, regulatory, and institutional circles.",
    approvedAt: "2026-03-01T12:00:00.000Z",
    source: "seed"
  },
  {
    id: "seed-amelia-wright",
    email: "amelia.wright@yhfederation.local",
    emailLower: "amelia.wright@yhfederation.local",
    name: "Amelia Wright",
    role: "Policy Advisor, Civic Strategy Office",
    badge: "Priority",
    category: "Politicians & Policy Advisors",
    country: "United Kingdom",
    city: "London",
    company: "Civic Strategy Office",
    description:
      "Focused on public policy coordination, institutional relations, and cross-sector strategy.",
    approvedAt: "2026-03-01T12:00:00.000Z",
    source: "seed"
  },
  {
    id: "seed-rahul-mehta",
    email: "rahul.mehta@yhfederation.local",
    emailLower: "rahul.mehta@yhfederation.local",
    name: "Rahul Mehta",
    role: "Founder, EastBridge Capital",
    badge: "Investor",
    category: "Entrepreneurs & Investors",
    country: "India",
    city: "Delhi",
    company: "EastBridge Capital",
    description:
      "Builder and allocator active in private growth deals, emerging market networks, and founder circles.",
    approvedAt: "2026-03-01T12:00:00.000Z",
    source: "seed"
  },
  {
    id: "seed-sophia-bennett",
    email: "sophia.bennett@yhfederation.local",
    emailLower: "sophia.bennett@yhfederation.local",
    name: "Sophia Bennett",
    role: "Media Operator, FrameHouse",
    badge: "Media",
    category: "Influencers & Media Architects",
    country: "Canada",
    city: "Toronto",
    company: "FrameHouse",
    description:
      "Media strategist with reach into creator ecosystems, narrative campaigns, and brand leverage.",
    approvedAt: "2026-03-01T12:00:00.000Z",
    source: "seed"
  },
  {
    id: "seed-karim-al-noor",
    email: "karim.alnoor@yhfederation.local",
    emailLower: "karim.alnoor@yhfederation.local",
    name: "Karim Al Noor",
    role: "Regional Operator, Gulf Nexus",
    badge: "Connector",
    category: "Operators Across Industries",
    country: "UAE",
    city: "Dubai",
    company: "Gulf Nexus",
    description:
      "Cross-border operator connecting business development, introductions, and regional expansion.",
    approvedAt: "2026-03-01T12:00:00.000Z",
    source: "seed"
  },
  {
    id: "seed-mika-santos",
    email: "mika.santos@yhfederation.local",
    emailLower: "mika.santos@yhfederation.local",
    name: "Mika Santos",
    role: "Security Consultant, Sentinel Stack",
    badge: "Verified",
    category: "Cybersecurity Experts",
    country: "Philippines",
    city: "Manila",
    company: "Sentinel Stack",
    description:
      "Cybersecurity specialist supporting digital trust, operational security, and technical resilience.",
    approvedAt: "2026-03-01T12:00:00.000Z",
    source: "seed"
  }
];

const MAP_ROUTE_PAIRS = [
  ["node-toronto", "node-nyc", "strong"],
  ["node-nyc", "node-london", "default"],
  ["node-london", "node-abuja", "default"],
  ["node-london", "node-lagos", "strong"],
  ["node-abuja", "node-lagos", "strong"],
  ["node-lagos", "node-dubai", "default"],
  ["node-dubai", "node-delhi", "default"],
  ["node-delhi", "node-manila", "default"]
];

function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

function readStorage(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Failed to read storage key: ${key}`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueValues(items, selector) {
  return [...new Set(items.map(selector).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function formatDate(value) {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function getMostCommonValue(items, selector, fallback = "—") {
  const counts = new Map();

  items.forEach((item) => {
    const raw = selector(item);
    const value = String(raw || "").trim();
    if (!value) return;

    counts.set(value, (counts.get(value) || 0) + 1);
  });

  if (!counts.size) return fallback;

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

function makeId(prefix = "fed") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
const federationConnectState = {
  loading: false,
  loaded: false,
  opportunities: [],
  requests: [],
  error: ""
};

const federationLeadUnlockState = {
  loadingByRequestId: {},
  detailsByRequestId: {},
  errorByRequestId: {}
};

const federationPaymentProviderState = {
  loadingByRequestId: {},
  selectedByRequestId: {},
  errorByRequestId: {}
};

const federationCheckoutReturnState = {
  handled: false,
  requestId: "",
  provider: "",
  status: "",
  message: "",
  type: "success"
};

function getFederationStoredAuthToken() {
  const keys = [
    "yh_auth_token",
    "yh_token",
    "authToken",
    "token"
  ];

  for (const key of keys) {
    const value = String(localStorage.getItem(key) || "").trim();
    if (value) return value;
  }

  return "";
}

async function federationConnectFetch(url, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {})
  };

  const token = getFederationStoredAuthToken();

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include"
  });

  let data = null;

  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || `Request failed with status ${response.status}`);
  }

  return data || {};
}
const federationServerState = {
  loading: false,
  loaded: false,
  currentUser: null,
  application: null,
  applications: [],
  member: null,
  members: [],
  referrals: null,
  command: null,
  dealRooms: [],
  error: ""
};

function normalizeFederationMember(raw = {}) {
  const email = String(raw.email || raw.emailLower || "").trim().toLowerCase();

  return {
    id: String(raw.id || raw.userId || email || makeId("fed_member")).trim(),
    userId: String(raw.userId || raw.id || "").trim(),
    email,
    emailLower: email,
    name: String(raw.name || raw.fullName || raw.username || "Federation Member").trim(),
    role: String(raw.role || raw.profession || "Approved Federation Member").trim(),
    badge: String(raw.badge || "Verified").trim(),
    category: String(raw.category || raw.primaryCategory || "Strategic Operator").trim(),
    country: String(raw.country || "").trim(),
    city: String(raw.city || "").trim(),
    company: String(raw.company || "").trim(),
    description: String(raw.description || raw.bio || "Approved Federation member.").trim(),
    approvedAt: String(raw.approvedAt || raw.createdAt || raw.updatedAt || "").trim(),
    source: String(raw.source || "server").trim(),
    referralCode: String(raw.referralCode || "").trim()
  };
}

function normalizeFederationApplication(raw = {}) {
  return {
    ...raw,
    id: String(raw.id || "").trim(),
    name: String(raw.name || raw.fullName || "Federation Applicant").trim(),
    fullName: String(raw.fullName || raw.name || "").trim(),
    email: String(raw.email || "").trim().toLowerCase(),
    status: String(raw.status || "Under Review").trim(),
    recommendedDivision: "Federation",
    applicationType: "federation-access"
  };
}

function normalizeFederationDealRoom(raw = {}) {
  return {
    id: String(raw.id || makeId("deal_room")).trim(),
    title: String(raw.title || "Federation Deal Room").trim(),
    roomType: String(raw.roomType || raw.type || "partnership").trim(),
    description: String(raw.description || raw.text || "").trim(),
    partnerNeed: String(raw.partnerNeed || "").trim(),
    expectedValueAmount: Number(raw.expectedValueAmount || 0),
    currency: String(raw.currency || "USD").trim().toUpperCase() || "USD",
    platformCommissionRate: Number(raw.platformCommissionRate || 0),
    platformCommissionAmount: Number(raw.platformCommissionAmount || 0),
    adminStatus: String(raw.adminStatus || "pending_admin_review").trim(),
    dealStatus: String(raw.dealStatus || "proposed").trim(),
    commissionStatus: String(raw.commissionStatus || "pending").trim(),
    creatorName: String(raw.creatorName || "Federation Member").trim(),
    creatorEmail: String(raw.creatorEmail || "").trim(),
    academyMissionNeed: String(raw.academyMissionNeed || "").trim(),
    linkedPlazaOpportunityId: String(raw.linkedPlazaOpportunityId || "").trim(),
    adminNotes: String(raw.adminNotes || "").trim(),
    createdAt: String(raw.createdAt || "").trim(),
    updatedAt: String(raw.updatedAt || "").trim()
  };
}

async function loadFederationServerState(options = {}) {
  const force = options.force === true;

  if (federationServerState.loading) return federationServerState;
  if (federationServerState.loaded && !force) return federationServerState;

  federationServerState.loading = true;
  federationServerState.error = "";

  try {
    const meResult = await federationConnectFetch("/api/federation/me");

    federationServerState.currentUser =
      meResult.currentUser && typeof meResult.currentUser === "object"
        ? meResult.currentUser
        : null;

    federationServerState.application =
      meResult.application && typeof meResult.application === "object"
        ? normalizeFederationApplication(meResult.application)
        : null;

    federationServerState.applications = Array.isArray(meResult.applications)
      ? meResult.applications.map(normalizeFederationApplication)
      : (federationServerState.application ? [federationServerState.application] : []);

    federationServerState.member =
      meResult.member && typeof meResult.member === "object"
        ? normalizeFederationMember(meResult.member)
        : null;

    federationServerState.referrals =
      meResult.referrals && typeof meResult.referrals === "object"
        ? meResult.referrals
        : null;

    if (meResult.canEnterFederation === true) {
      const [directorySettled, commandSettled, referralSettled, dealRoomsSettled] = await Promise.allSettled([
        federationConnectFetch("/api/federation/directory"),
        federationConnectFetch("/api/federation/command"),
        federationConnectFetch("/api/federation/referrals"),
        federationConnectFetch("/api/federation/deal-rooms")
      ]);

      if (directorySettled.status === "fulfilled") {
        const directoryResult = directorySettled.value || {};
        federationServerState.members = Array.isArray(directoryResult.members)
          ? directoryResult.members.map(normalizeFederationMember)
          : [];
      } else {
        console.error("Federation directory load error:", directorySettled.reason);
        federationServerState.members = federationServerState.member ? [federationServerState.member] : [];
      }

      if (commandSettled.status === "fulfilled") {
        const commandResult = commandSettled.value || {};
        federationServerState.command =
          commandResult.command && typeof commandResult.command === "object"
            ? commandResult.command
            : null;
      } else {
        console.error("Federation command load error:", commandSettled.reason);
        federationServerState.command = {
          member: federationServerState.member,
          stats: {
            approvedMembers: federationServerState.members.length || 0,
            countriesActive: 0,
            sectorsLive: 0,
            connectOpportunities: 0,
            myRequests: 0,
            pendingRequests: 0,
            completedRequests: 0
          }
        };
      }

      if (referralSettled.status === "fulfilled") {
        const referralResult = referralSettled.value || {};
        federationServerState.referrals =
          referralResult.referrals && typeof referralResult.referrals === "object"
            ? referralResult.referrals
            : federationServerState.referrals;
      } else {
        console.error("Federation referrals load error:", referralSettled.reason);
      }

      if (dealRoomsSettled.status === "fulfilled") {
        const dealRoomsResult = dealRoomsSettled.value || {};
        federationServerState.dealRooms = Array.isArray(dealRoomsResult.rooms)
          ? dealRoomsResult.rooms.map(normalizeFederationDealRoom)
          : [];
      } else {
        console.error("Federation deal rooms load error:", dealRoomsSettled.reason);
        federationServerState.dealRooms = [];
      }
    } else {
      federationServerState.members = [];
      federationServerState.command = null;
    }

    federationServerState.loaded = true;
  } catch (error) {
    console.error("Federation server state load error:", error);
    federationServerState.error = error?.message || "Failed to load Federation server state.";
    federationServerState.loaded = false;
  } finally {
    federationServerState.loading = false;
  }

  return federationServerState;
}
function normalizeFederationConnectOpportunity(raw = {}) {
  const ownerUid = String(raw.ownerUid || "").trim();
  const leadId = String(raw.leadId || "").trim();

  return {
    id: String(raw.id || `${ownerUid}_${leadId}`).trim(),
    ownerUid,
    leadId,
    title: String(raw.title || "Strategic connection opportunity").trim(),
    category: String(raw.category || raw.contactType || "Strategic Network").trim(),
    contactRole: String(raw.contactRole || "Strategic Contact").trim(),
    city: String(raw.city || "").trim(),
    country: String(raw.country || "").trim(),
    strategicValue: String(raw.strategicValue || "standard").trim().toLowerCase(),
    tier: String(raw.tier || "T2").trim(),
    sourceDivision: String(raw.sourceDivision || "academy").trim(),
    pipelineStage: String(raw.pipelineStage || "Review").trim(),
    sourceMethod: String(raw.sourceMethod || "Lead Missions").trim(),
    contactType: String(raw.contactType || raw.category || "Strategic Network").trim(),
    companyLabel: String(raw.companyLabel || "Private organization").trim(),
    hasEmail: raw.hasEmail === true,
    hasPhone: raw.hasPhone === true,
    hasDirectContact: raw.hasDirectContact === true || raw.hasEmail === true || raw.hasPhone === true,

    sellerPriceAmount: Number(raw.sellerPriceAmount || 0),
    universeCommissionRate: Number(raw.universeCommissionRate || 0),
    universeCommissionAmount: Number(raw.universeCommissionAmount || 0),
    buyerPriceAmount: Number(raw.buyerPriceAmount || 0),
    currency: String(raw.currency || "USD").trim().toUpperCase() || "USD",
    saleReviewStatus: String(raw.saleReviewStatus || "approved").trim(),
    saleStatus: String(raw.saleStatus || "listed").trim(),

    summary: String(raw.summary || "Academy-sourced lead marked Federation-ready by admin.").trim(),
    updatedAt: String(raw.updatedAt || "").trim(),
    createdAt: String(raw.createdAt || "").trim()
  };
}

function getFederationConnectLocalRequests() {
  const requests = readStorage(STORAGE_KEYS.connectRequests, []);
  return Array.isArray(requests) ? requests : [];
}

function setFederationConnectLocalRequests(requests = []) {
  writeStorage(STORAGE_KEYS.connectRequests, Array.isArray(requests) ? requests : []);
}

function formatFederationConnectStatus(value = "") {
  const raw = String(value || "").trim().toLowerCase();

  const labels = {
    pending_admin_match: "Pending Admin Match",
    pending_review: "Pending Review",
    matched: "Matched",
    pricing_sent: "Pricing Sent",
    paid: "Paid",
    intro_delivered: "Intro Delivered",
    completed: "Completed",
    rejected: "Rejected"
  };

  return labels[raw] || (raw ? raw.replace(/_/g, " ") : "Pending Admin Match");
}

function formatFederationConnectBudget(value = "") {
  const raw = String(value || "").trim().toLowerCase();

  const labels = {
    not_sure: "Not sure yet",
    under_500: "Under $500",
    "500_1500": "$500 - $1,500",
    "1500_5000": "$1,500 - $5,000",
    "5000_plus": "$5,000+"
  };

  return labels[raw] || "Not sure yet";
}

function formatFederationConnectUrgency(value = "") {
  const raw = String(value || "").trim().toLowerCase();

  const labels = {
    normal: "Normal",
    this_week: "This week",
    urgent: "Urgent",
    exploring: "Exploring"
  };

  return labels[raw] || "Normal";
}

function formatFederationConnectMoney(amount = 0, currency = "USD") {
  const numeric = Number(amount || 0);
  const cleanCurrency = String(currency || "USD").trim().toUpperCase() || "USD";

  if (!Number.isFinite(numeric) || numeric <= 0) return "—";

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

function getFederationConnectPaymentStatus(request = {}) {
  return String(request.paymentStatus || "not_started").trim().toLowerCase();
}

function canPayFederationConnectRequest(request = {}) {
  const paymentStatus = getFederationConnectPaymentStatus(request);
  const status = String(request.status || "").trim().toLowerCase();
  const amount = Number(request.pricingAmount || 0);

  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (paymentStatus === "paid") return false;
  if (status === "paid" || status === "intro_delivered" || status === "completed" || status === "rejected") return false;

  return true;
}

function hasFederationConnectDealPackage(request = {}) {
  const paymentStatus = String(request.paymentStatus || "").trim().toLowerCase();
  const payoutStatus = String(request.payoutStatus || "").trim().toLowerCase();
  const commissionStatus = String(request.commissionStatus || "").trim().toLowerCase();
  const dealNotes = String(request.dealNotes || "").trim();

  const hasRealPaymentStatus =
    paymentStatus &&
    paymentStatus !== "not_started" &&
    paymentStatus !== "none";

  const hasRealPayoutStatus =
    payoutStatus &&
    payoutStatus !== "not_started" &&
    payoutStatus !== "none";

  const hasRealCommissionStatus =
    commissionStatus &&
    commissionStatus !== "not_started" &&
    commissionStatus !== "none";

  return (
    Number(request.pricingAmount || 0) > 0 ||
    Number(request.platformCommissionAmount || 0) > 0 ||
    Number(request.operatorPayoutAmount || 0) > 0 ||
    hasRealPaymentStatus ||
    hasRealPayoutStatus ||
    hasRealCommissionStatus ||
    Boolean(dealNotes)
  );
}
function isFederationRequestPaidForLeadUnlock(request = {}) {
  const status = String(request.status || "").trim().toLowerCase();
  const paymentStatus = String(request.paymentStatus || "").trim().toLowerCase();

  return (
    status === "paid" ||
    status === "intro_delivered" ||
    status === "completed" ||
    paymentStatus === "paid"
  );
}

function canUnlockFederationLeadDetails(request = {}) {
  return Boolean(
    request?.id &&
    request?.ownerUid &&
    request?.leadId &&
    isFederationRequestPaidForLeadUnlock(request)
  );
}

function renderFederationUnlockedLeadValue(label = "", value = "") {
  const cleanValue = String(value || "").trim();

  if (!cleanValue) return "";

  return `
    <div class="fed-state-metric">
      <strong>${escapeHtml(cleanValue)}</strong>
      <small>${escapeHtml(label)}</small>
    </div>
  `;
}

function renderFederationUnlockedLeadPanel(request = {}) {
  const requestId = String(request.id || "").trim();

  if (!canUnlockFederationLeadDetails(request)) return "";

  const details = federationLeadUnlockState.detailsByRequestId[requestId] || null;
  const loading = federationLeadUnlockState.loadingByRequestId[requestId] === true;
  const error = String(federationLeadUnlockState.errorByRequestId[requestId] || "").trim();

  if (!details) {
    return `
      <div class="fed-card-actions">
        <button
          type="button"
          class="fed-btn fed-btn-secondary"
          data-federation-unlock-lead="${escapeHtml(requestId)}"
          ${loading ? "disabled aria-busy=\"true\"" : ""}
        >
          ${loading ? "Unlocking Lead..." : "View Lead Details"}
        </button>
      </div>
      ${
        error
          ? `<p class="fed-command-copy">${escapeHtml(error)}</p>`
          : `<p class="fed-command-copy">Full contact details stay hidden until payment is confirmed.</p>`
      }
    `;
  }

  const detailRows = [
    renderFederationUnlockedLeadValue("Contact", details.contactName),
    renderFederationUnlockedLeadValue("Role", details.contactRole),
    renderFederationUnlockedLeadValue("Company", details.companyName),
    renderFederationUnlockedLeadValue("Website", details.companyWebsite),
    renderFederationUnlockedLeadValue("Email", details.email),
    renderFederationUnlockedLeadValue("Phone", details.phone),
    renderFederationUnlockedLeadValue("Location", [details.city, details.country].filter(Boolean).join(", ")),
    renderFederationUnlockedLeadValue("Source", details.sourceMethod),
    renderFederationUnlockedLeadValue("Next Action", details.nextAction)
  ].filter(Boolean).join("");

  return `
    <div class="fed-command-card">
      <div class="fed-sidebar-card-label">Unlocked Lead Details</div>
      <h4>${escapeHtml(details.companyName || details.contactName || "Purchased Lead")}</h4>
      <div class="fed-state-grid">
        ${detailRows || renderFederationUnlockedLeadValue("Status", "Unlocked")}
      </div>
      ${
        details.notes
          ? `<p class="fed-command-copy">${escapeHtml(details.notes)}</p>`
          : ""
      }
    </div>
  `;
}
function getFederationPaymentProviderLabel(provider = "") {
  const clean = String(provider || "").trim().toLowerCase();

  if (clean === "stripe") return "Stripe";
  if (clean === "oxapay") return "OxaPay";

  return "Unselected";
}

function renderFederationPaymentProviderPanel(request = {}) {
  const requestId = String(request.id || "").trim();
  if (!requestId || !canPayFederationConnectRequest(request)) return "";

  const selectedProvider =
    String(federationPaymentProviderState.selectedByRequestId[requestId] || request.selectedPaymentProvider || "").trim().toLowerCase();

  const loading = federationPaymentProviderState.loadingByRequestId[requestId] === true;
  const error = String(federationPaymentProviderState.errorByRequestId[requestId] || "").trim();

  return `
    <div class="fed-command-card">
      <div class="fed-sidebar-card-label">Choose Payment Method</div>
      <h4>Pay with Stripe or OxaPay</h4>
      <p class="fed-command-copy">
        This lead stays available as a lifetime Federation listing. Your payment unlocks access for your account only.
      </p>

      <div class="fed-card-actions">
        <button
          type="button"
          class="fed-btn ${selectedProvider === "stripe" ? "fed-btn-primary" : "fed-btn-secondary"}"
          data-federation-select-provider="${escapeHtml(requestId)}"
          data-payment-provider="stripe"
          ${loading ? "disabled aria-busy=\"true\"" : ""}
        >
          ${loading && selectedProvider === "stripe" ? "Selecting..." : "Stripe: Card / Bank / Wallet"}
        </button>

        <button
          type="button"
          class="fed-btn ${selectedProvider === "oxapay" ? "fed-btn-primary" : "fed-btn-secondary"}"
          data-federation-select-provider="${escapeHtml(requestId)}"
          data-payment-provider="oxapay"
          ${loading ? "disabled aria-busy=\"true\"" : ""}
        >
          ${loading && selectedProvider === "oxapay" ? "Selecting..." : "OxaPay: Crypto"}
        </button>
      </div>

      ${
        selectedProvider === "stripe"
          ? `
            <div class="fed-card-actions">
              <button
                type="button"
                class="fed-btn fed-btn-primary"
                data-federation-start-stripe-checkout="${escapeHtml(requestId)}"
                ${loading ? "disabled aria-busy=\"true\"" : ""}
              >
                Continue to Stripe Checkout
              </button>
            </div>
            <p class="fed-command-copy">Stripe selected. Continue to secure checkout to unlock this lead after successful payment.</p>
          `
          : selectedProvider === "oxapay"
            ? `
              <div class="fed-card-actions">
                <button
                  type="button"
                  class="fed-btn fed-btn-primary"
                  data-federation-start-oxapay-checkout="${escapeHtml(requestId)}"
                  ${loading ? "disabled aria-busy=\"true\"" : ""}
                >
                  Continue to OxaPay Crypto Invoice
                </button>
              </div>
              <p class="fed-command-copy">OxaPay selected. Continue to crypto invoice checkout to unlock this lead after successful confirmation.</p>
            `
            : `<p class="fed-command-copy">Choose a provider to prepare the neutral payment ledger for this lead purchase.</p>`
      }

      ${
        error
          ? `<p class="fed-command-copy">${escapeHtml(error)}</p>`
          : ""
      }
    </div>
  `;
}
function renderFederationConnectDealMetrics(request = {}) {
  if (!hasFederationConnectDealPackage(request)) return "";

  const paymentStatus = getFederationConnectPaymentStatus(request);
  const isPaid = isFederationRequestPaidForLeadUnlock(request);

  return `
    <div class="fed-state-grid">
      <div class="fed-state-metric">
        <strong>${escapeHtml(formatFederationConnectMoney(request.pricingAmount, request.currency))}</strong>
        <small>Total access price</small>
      </div>
      <div class="fed-state-metric">
        <strong>${escapeHtml(String(request.paymentStatus || "not_started").replace(/_/g, " "))}</strong>
        <small>Payment</small>
      </div>
      <div class="fed-state-metric">
        <strong>${escapeHtml(formatFederationConnectMoney(request.platformCommissionAmount, request.currency))}</strong>
        <small>Universe commission</small>
      </div>
      <div class="fed-state-metric">
        <strong>${escapeHtml(formatFederationConnectMoney(request.operatorPayoutAmount, request.currency))}</strong>
        <small>Operator payout</small>
      </div>
    </div>

    ${
      request.dealNotes
        ? `<p class="fed-command-copy">${escapeHtml(request.dealNotes)}</p>`
        : ""
    }

    ${
      canPayFederationConnectRequest(request)
        ? renderFederationPaymentProviderPanel(request)
        : isPaid
          ? `
            <p class="fed-command-copy">Payment confirmed. Full lead details can now be unlocked for this buyer only.</p>
            ${renderFederationUnlockedLeadPanel(request)}
          `
          : paymentStatus === "paid"
            ? `<p class="fed-command-copy">Payment confirmed. Lead details can now be unlocked.</p>`
            : ""
    }
  `;
}

async function selectFederationPaymentProvider(requestId = "", provider = "", button = null) {
  const cleanId = String(requestId || "").trim();
  const cleanProvider = String(provider || "").trim().toLowerCase();

  if (!cleanId || !["stripe", "oxapay"].includes(cleanProvider)) return;

  const request = federationConnectState.requests.find((item) => String(item.id || "") === cleanId);

  if (!request) {
    showFederationConnectFeedback("Could not find this Federation request. Refresh and try again.", "error");
    return;
  }

  if (!canPayFederationConnectRequest(request)) {
    showFederationConnectFeedback("This Federation request is not ready for payment.", "error");
    return;
  }

  const originalText = button?.textContent || getFederationPaymentProviderLabel(cleanProvider);

  try {
    federationPaymentProviderState.loadingByRequestId[cleanId] = true;
    federationPaymentProviderState.selectedByRequestId[cleanId] = cleanProvider;
    federationPaymentProviderState.errorByRequestId[cleanId] = "";

    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Selecting...";
    }

    renderFederationRequestsSection();

    const result = await federationConnectFetch(
      `/api/federation/connect/requests/${encodeURIComponent(cleanId)}/payment-provider`,
      {
        method: "POST",
        body: JSON.stringify({ provider: cleanProvider })
      }
    );

    if (!result?.payment?.id) {
      throw new Error("Payment ledger was not returned.");
    }

    federationConnectState.requests = federationConnectState.requests.map((item) => {
      if (String(item.id || "") !== cleanId) return item;

      return {
        ...item,
        paymentLedgerId: result.payment.id,
        paymentLedgerStatus: result.payment.status,
        selectedPaymentProvider: result.provider || cleanProvider,
        paymentProviderLabel: result.providerLabel || getFederationPaymentProviderLabel(cleanProvider),
        paymentProviderOptions: result.payment.providerOptions || ["stripe", "oxapay"],
        sourcePaymentMode: "lead_purchase"
      };
    });

    renderFederationRequestsSection();
    renderFederationConnectRequestsPanel();

    showFederationConnectFeedback(
      `${result.providerLabel || getFederationPaymentProviderLabel(cleanProvider)} selected. Checkout connection comes next.`,
      "success"
    );
  } catch (error) {
    console.error("Federation payment provider selection error:", error);
    federationPaymentProviderState.errorByRequestId[cleanId] =
      error?.message || "Failed to select payment provider.";

    renderFederationRequestsSection();
    showFederationConnectFeedback(federationPaymentProviderState.errorByRequestId[cleanId], "error");
  } finally {
    federationPaymentProviderState.loadingByRequestId[cleanId] = false;

    if (button) {
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.textContent = originalText;
    }
  }
}

async function startFederationPaidIntroCheckout(requestId = "", button = null) {
  return selectFederationPaymentProvider(requestId, "stripe", button);
}

async function startFederationStripeCheckout(requestId = "", button = null) {
  const cleanId = String(requestId || "").trim();
  if (!cleanId) return;

  const request = federationConnectState.requests.find((item) => String(item.id || "") === cleanId);

  if (!request) {
    showFederationConnectFeedback("Could not find this Federation request. Refresh and try again.", "error");
    return;
  }

  if (!canPayFederationConnectRequest(request)) {
    showFederationConnectFeedback("This request is not ready for Stripe checkout.", "error");
    return;
  }

  const originalText = button?.textContent || "Continue to Stripe Checkout";

  try {
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Opening Stripe...";
    }

    const result = await federationConnectFetch(
      `/api/federation/connect/requests/${encodeURIComponent(cleanId)}/checkout-session`,
      {
        method: "POST",
        body: JSON.stringify({ provider: "stripe" })
      }
    );

    if (!result?.url) {
      throw new Error("Stripe checkout URL was not returned.");
    }

    federationConnectState.requests = federationConnectState.requests.map((item) => {
      if (String(item.id || "") !== cleanId) return item;

      return {
        ...item,
        paymentLedgerId: result.paymentLedgerId || item.paymentLedgerId || "",
        paymentLedgerStatus: "checkout_started",
        selectedPaymentProvider: "stripe",
        paymentProviderLabel: "Stripe",
        paymentStatus: "checkout_started",
        stripeCheckoutSessionId: result.checkoutSessionId || item.stripeCheckoutSessionId || ""
      };
    });

    window.top.location.href = result.url;
  } catch (error) {
    console.error("Federation Stripe checkout error:", error);
    showFederationConnectFeedback(error?.message || "Failed to open Stripe Checkout.", "error");

    if (button) {
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.textContent = originalText;
    }
  }
}

async function startFederationOxaPayCheckout(requestId = "", button = null) {
  const cleanId = String(requestId || "").trim();
  if (!cleanId) return;

  const request = federationConnectState.requests.find((item) => String(item.id || "") === cleanId);

  if (!request) {
    showFederationConnectFeedback("Could not find this Federation request. Refresh and try again.", "error");
    return;
  }

  if (!canPayFederationConnectRequest(request)) {
    showFederationConnectFeedback("This request is not ready for OxaPay checkout.", "error");
    return;
  }

  const originalText = button?.textContent || "Continue to OxaPay Crypto Invoice";

  try {
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Opening OxaPay...";
    }

    const result = await federationConnectFetch(
      `/api/federation/connect/requests/${encodeURIComponent(cleanId)}/oxapay-invoice`,
      {
        method: "POST",
        body: JSON.stringify({ provider: "oxapay" })
      }
    );

    if (!result?.url) {
      throw new Error("OxaPay invoice URL was not returned.");
    }

    federationConnectState.requests = federationConnectState.requests.map((item) => {
      if (String(item.id || "") !== cleanId) return item;

      return {
        ...item,
        paymentLedgerId: result.paymentLedgerId || item.paymentLedgerId || "",
        paymentLedgerStatus: "checkout_started",
        selectedPaymentProvider: "oxapay",
        paymentProviderLabel: "OxaPay",
        paymentStatus: "checkout_started",
        oxapayTrackId: result.oxapayTrackId || item.oxapayTrackId || ""
      };
    });

    window.top.location.href = result.url;
  } catch (error) {
    console.error("Federation OxaPay checkout error:", error);
    showFederationConnectFeedback(error?.message || "Failed to open OxaPay invoice.", "error");

    if (button) {
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.textContent = originalText;
    }
  }
}

async function unlockFederationLeadDetails(requestId = "", button = null) {
  const cleanId = String(requestId || "").trim();
  if (!cleanId) return;

  const request = federationConnectState.requests.find((item) => String(item.id || "") === cleanId);

  if (!request || !canUnlockFederationLeadDetails(request)) {
    showFederationConnectFeedback("This request is not ready to unlock lead details yet.", "error");
    return;
  }

  const originalText = button?.textContent || "View Lead Details";

  try {
    federationLeadUnlockState.loadingByRequestId[cleanId] = true;
    federationLeadUnlockState.errorByRequestId[cleanId] = "";

    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Unlocking...";
    }

    renderFederationRequestsSection();

    const result = await federationConnectFetch(
      `/api/federation/connect/requests/${encodeURIComponent(cleanId)}/unlocked-lead`,
      {
        method: "GET"
      }
    );

    if (!result?.lead) {
      throw new Error("Unlocked lead details were not returned.");
    }

    federationLeadUnlockState.detailsByRequestId[cleanId] = result.lead;

    federationConnectState.requests = federationConnectState.requests.map((item) => {
      if (String(item.id || "") !== cleanId) return item;

      return {
        ...item,
        leadAccessGrantId: result.grant?.id || item.leadAccessGrantId || "",
        leadAccessStatus: result.grant?.accessStatus || "unlocked"
      };
    });

    renderFederationRequestsSection();
    renderFederationConnectRequestsPanel();
    showFederationConnectFeedback("Lead details unlocked for this paid request.", "success");
  } catch (error) {
    console.error("Federation lead unlock error:", error);
    federationLeadUnlockState.errorByRequestId[cleanId] =
      error?.message || "Failed to unlock lead details.";

    renderFederationRequestsSection();
    showFederationConnectFeedback(federationLeadUnlockState.errorByRequestId[cleanId], "error");
  } finally {
    federationLeadUnlockState.loadingByRequestId[cleanId] = false;

    if (button) {
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
      button.textContent = originalText;
    }
  }
}

function getFederationCheckoutReturnContext() {
  try {
    const url = new URL(window.location.href);
    const checkout = String(url.searchParams.get("checkout") || "").trim().toLowerCase();
    const requestId = String(url.searchParams.get("request") || "").trim();

    if (!checkout || !requestId) {
      return {
        hasReturn: false,
        checkout: "",
        requestId: "",
        provider: "",
        status: ""
      };
    }

    let provider = "";
    let status = checkout;

    if (checkout === "success") {
      provider = "stripe";
      status = "success";
    } else if (checkout === "cancelled" || checkout === "canceled") {
      provider = "stripe";
      status = "cancelled";
    } else if (checkout === "oxapay-success") {
      provider = "oxapay";
      status = "success";
    } else if (checkout === "oxapay-cancelled" || checkout === "oxapay-canceled") {
      provider = "oxapay";
      status = "cancelled";
    }

    return {
      hasReturn: Boolean(provider && status),
      checkout,
      requestId,
      provider,
      status
    };
  } catch (_) {
    return {
      hasReturn: false,
      checkout: "",
      requestId: "",
      provider: "",
      status: ""
    };
  }
}

function setFederationCheckoutReturnNotice(message = "", type = "success", requestId = "", provider = "", status = "") {
  federationCheckoutReturnState.message = String(message || "").trim();
  federationCheckoutReturnState.type = type === "error" ? "error" : "success";
  federationCheckoutReturnState.requestId = String(requestId || "").trim();
  federationCheckoutReturnState.provider = String(provider || "").trim().toLowerCase();
  federationCheckoutReturnState.status = String(status || "").trim().toLowerCase();

  renderFederationRequestsSection();
}

function renderFederationCheckoutReturnNotice() {
  const message = String(federationCheckoutReturnState.message || "").trim();

  if (!message) return "";

  const provider = getFederationPaymentProviderLabel(federationCheckoutReturnState.provider);
  const typeLabel = federationCheckoutReturnState.type === "error" ? "Payment Notice" : "Payment Update";

  return `
    <article class="fed-command-card">
      <div class="fed-sidebar-card-label">${escapeHtml(typeLabel)}</div>
      <h4>${escapeHtml(provider)} checkout return</h4>
      <p class="fed-command-copy">${escapeHtml(message)}</p>
    </article>
  `;
}

function cleanFederationCheckoutReturnUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("request");
    url.searchParams.delete("session_id");

    const nextUrl = `${url.pathname}${url.search}#requests`;
    window.history.replaceState(null, "", nextUrl);
  } catch (_) {}
}

async function handleFederationCheckoutReturn() {
  const context = getFederationCheckoutReturnContext();

  if (!context.hasReturn || federationCheckoutReturnState.handled) {
    return false;
  }

  federationCheckoutReturnState.handled = true;

  setFederationCheckoutReturnNotice(
    context.status === "cancelled"
      ? "Checkout was cancelled. You can choose Stripe or OxaPay again when you are ready."
      : "Checking payment confirmation and refreshing your lead purchase request...",
    context.status === "cancelled" ? "error" : "success",
    context.requestId,
    context.provider,
    context.status
  );

  setActiveSection("requests", {
    syncHash: true,
    showLoader: true
  });

  await loadFederationConnectData({ force: true });

  const request = federationConnectState.requests.find((item) => {
    return String(item.id || "") === context.requestId;
  });

  if (context.status === "cancelled") {
    setFederationCheckoutReturnNotice(
      "Checkout was cancelled. Your lead purchase was not completed.",
      "error",
      context.requestId,
      context.provider,
      context.status
    );
    cleanFederationCheckoutReturnUrl();
    return true;
  }

  if (!request) {
    setFederationCheckoutReturnNotice(
      "Checkout returned, but this request was not found in your request list yet. Refresh My Requests in a moment.",
      "error",
      context.requestId,
      context.provider,
      context.status
    );
    cleanFederationCheckoutReturnUrl();
    return true;
  }

  if (isFederationRequestPaidForLeadUnlock(request)) {
    setFederationCheckoutReturnNotice(
      "Payment confirmed. Full lead details are now ready to unlock for this buyer account.",
      "success",
      context.requestId,
      context.provider,
      context.status
    );

    await unlockFederationLeadDetails(context.requestId).catch((error) => {
      console.error("Federation post-checkout auto unlock error:", error);
    });

    cleanFederationCheckoutReturnUrl();
    return true;
  }

  const isOxaPay = context.provider === "oxapay";

  setFederationCheckoutReturnNotice(
    isOxaPay
      ? "OxaPay invoice opened successfully. If you already paid, the crypto confirmation may still be processing. Wait a moment, then refresh My Requests."
      : "Stripe checkout returned, but payment confirmation has not reached the server yet. Wait a moment, then refresh My Requests.",
    "success",
    context.requestId,
    context.provider,
    context.status
  );

  cleanFederationCheckoutReturnUrl();
  return true;
}

function showFederationConnectFeedback(message = "", type = "success") {
  const feedback = qs("#connectFeedback");
  if (!feedback) return;

  feedback.textContent = message;
  feedback.classList.toggle("success", type !== "error");
  feedback.classList.toggle("error", type === "error");
  feedback.hidden = !message;
}

function getFilteredFederationConnectOpportunities() {
  const search = String(qs("#connectSearch")?.value || "").trim().toLowerCase();
  const valueFilter = String(qs("#connectValueFilter")?.value || "all").trim().toLowerCase();
  const countryFilter = String(qs("#connectCountryFilter")?.value || "").trim().toLowerCase();

  return federationConnectState.opportunities.filter((opportunity) => {
    const haystack = [
      opportunity.title,
      opportunity.category,
      opportunity.contactRole,
      opportunity.city,
      opportunity.country,
      opportunity.strategicValue,
      opportunity.tier,
      opportunity.summary
    ].join(" ").toLowerCase();

    const matchesSearch = !search || haystack.includes(search);
    const matchesValue = valueFilter === "all" || opportunity.strategicValue === valueFilter;
    const matchesCountry = !countryFilter || String(opportunity.country || "").toLowerCase().includes(countryFilter);

    return matchesSearch && matchesValue && matchesCountry;
  });
}

function renderFederationConnectRequestsPanel() {
  const panel = qs("#federationConnectRequestsPanel");
  if (!panel) return;

  const requests = Array.isArray(federationConnectState.requests)
    ? federationConnectState.requests
    : [];

  if (!requests.length) {
    panel.innerHTML = `
      <article class="fed-command-card fed-connect-requests-empty">
        <div class="fed-sidebar-card-label">Your Requests</div>
        <h4>No connection requests yet</h4>
        <p class="fed-command-copy">
          When you request a strategic introduction, it will appear here for status tracking.
        </p>
      </article>
    `;
    return;
  }

  panel.innerHTML = `
    <article class="fed-command-card fed-connect-requests-card">
      <div class="fed-sidebar-card-label">Your Requests</div>
      <h4>Connection request tracker</h4>

      <div class="fed-connect-request-list">
        ${requests.slice(0, 8).map((request) => `
          <div class="fed-connect-request-item">
            <div>
              <strong>${escapeHtml(request.opportunityTitle || "Connection request")}</strong>
              <small>
                ${escapeHtml(formatFederationConnectStatus(request.status))}
                • ${escapeHtml(formatFederationConnectBudget(request.budgetRange))}
                • ${escapeHtml(formatFederationConnectUrgency(request.urgency))}
                ${
                  hasFederationConnectDealPackage(request)
                    ? ` • ${escapeHtml(formatFederationConnectMoney(request.pricingAmount, request.currency))} • ${escapeHtml(String(request.paymentStatus || "not_started").replace(/_/g, " "))}`
                    : ""
                }
              </small>
            </div>
            <span>${escapeHtml(formatDate(request.createdAt))}</span>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}
function renderFederationRequestsSection() {
  const list = qs("#federationRequestsList");
  const filter = qs("#requestStatusFilter");
  if (!list) return;

  const selectedStatus = String(filter?.value || "all").trim().toLowerCase();

  const requests = Array.isArray(federationConnectState.requests)
    ? federationConnectState.requests
    : [];

  const filtered = requests.filter((request) => {
    if (selectedStatus === "all") return true;
    return String(request.status || "").trim().toLowerCase() === selectedStatus;
  });

  if (federationConnectState.loading && !requests.length) {
    list.innerHTML = `
      <article class="fed-command-card">
        <div class="fed-sidebar-card-label">Loading</div>
        <h4>Loading your connection requests...</h4>
        <p class="fed-command-copy">Checking server-backed Federation request records.</p>
      </article>
    `;
    return;
  }

  const checkoutNotice = renderFederationCheckoutReturnNotice();

  if (!filtered.length) {
    list.innerHTML = `
      ${checkoutNotice}
      <article class="fed-command-card">
        <div class="fed-sidebar-card-label">No Requests</div>
        <h4>No matching connection requests yet</h4>
        <p class="fed-command-copy">
          Requests submitted through Connect will appear here with admin review,
          pricing, delivery, and completion states.
        </p>
      </article>
    `;
    return;
  }

  list.innerHTML = `
    ${checkoutNotice}
    ${filtered.map((request) => `
    <article class="fed-request-card">
      <div class="fed-request-card-head">
        <div>
          <div class="fed-sidebar-card-label">${escapeHtml(formatFederationConnectStatus(request.status))}</div>
          <h4>${escapeHtml(request.opportunityTitle || "Connection request")}</h4>
        </div>
        <span class="fed-state-badge ${getStatusBadgeClass(formatFederationConnectStatus(request.status))}">
          ${escapeHtml(formatFederationConnectStatus(request.status))}
        </span>
      </div>

      <p class="fed-command-copy">
        ${escapeHtml(request.requestReason || "No request reason stored.")}
      </p>

      <div class="fed-state-grid">
        <div class="fed-state-metric">
          <strong>${escapeHtml(formatFederationConnectBudget(request.budgetRange))}</strong>
          <small>Budget range</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(formatFederationConnectUrgency(request.urgency))}</strong>
          <small>Urgency</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(request.preferredIntroType || "admin_brokered")}</strong>
          <small>Intro type</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(formatDate(request.createdAt))}</strong>
          <small>Submitted</small>
        </div>
      </div>

      ${renderFederationConnectDealMetrics(request)}
    </article>
  `).join("")}
  `;
}

function initFederationRequests() {
  const filter = qs("#requestStatusFilter");
  if (!filter || filter.dataset.bound === "true") return;

  filter.dataset.bound = "true";
  filter.addEventListener("change", renderFederationRequestsSection);
}

function formatFederationDealRoomType(value = "") {
  const raw = String(value || "").trim().toLowerCase();

  const labels = {
    partnership: "Partnership",
    collaboration: "Collaboration",
    joint_venture: "Joint Venture",
    operator_hiring: "Operator Hiring",
    investment: "Investment",
    service_deal: "Service Deal"
  };

  return labels[raw] || "Partnership";
}

function formatFederationDealRoomStatus(value = "") {
  const raw = String(value || "").trim().toLowerCase();

  const labels = {
    pending_admin_review: "Pending Admin Review",
    approved: "Approved",
    in_discussion: "In Discussion",
    commission_due: "Commission Due",
    commission_paid: "Commission Paid",
    closed: "Closed",
    rejected: "Rejected"
  };

  return labels[raw] || "Pending Admin Review";
}

function renderFederationDealRoomsSection() {
  const list = qs("#federationDealRoomsList");
  const totalEl = qs("#federationDealRoomsCount");
  const pendingEl = qs("#federationDealRoomsPendingCount");

  if (!list) return;

  const rooms = Array.isArray(federationServerState.dealRooms)
    ? federationServerState.dealRooms
    : [];

  if (totalEl) totalEl.textContent = String(rooms.length);
  if (pendingEl) {
    pendingEl.textContent = String(
      rooms.filter((room) => String(room.adminStatus || "").toLowerCase() === "pending_admin_review").length
    );
  }

  if (!rooms.length) {
    list.innerHTML = `
      <article class="fed-command-card">
        <div class="fed-sidebar-card-label">No Deal Rooms</div>
        <h4>No Federation Deal Rooms yet</h4>
        <p class="fed-command-copy">
          Submit a partnership, collab, hiring, investment, or service deal above.
          Admin will supervise the room and track platform commission.
        </p>
      </article>
    `;
    return;
  }

  list.innerHTML = rooms.map((room) => `
    <article class="fed-request-card">
      <div class="fed-request-card-head">
        <div>
          <div class="fed-sidebar-card-label">${escapeHtml(formatFederationDealRoomType(room.roomType))}</div>
          <h4>${escapeHtml(room.title)}</h4>
        </div>
        <span class="fed-state-badge ${getStatusBadgeClass(formatFederationDealRoomStatus(room.adminStatus))}">
          ${escapeHtml(formatFederationDealRoomStatus(room.adminStatus))}
        </span>
      </div>

      <p class="fed-command-copy">${escapeHtml(room.description || "No deal room description stored.")}</p>

      <div class="fed-state-grid">
        <div class="fed-state-metric">
          <strong>${escapeHtml(formatFederationConnectMoney(room.expectedValueAmount, room.currency))}</strong>
          <small>Expected value</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(room.platformCommissionRate || 0))}%</strong>
          <small>Platform commission</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(formatFederationConnectMoney(room.platformCommissionAmount, room.currency))}</strong>
          <small>Commission estimate</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(formatDate(room.createdAt))}</strong>
          <small>Submitted</small>
        </div>
      </div>

      ${room.partnerNeed ? `
        <p class="fed-command-copy"><strong>Partner need:</strong> ${escapeHtml(room.partnerNeed)}</p>
      ` : ""}

      ${room.academyMissionNeed ? `
        <p class="fed-command-copy"><strong>Academy support:</strong> ${escapeHtml(room.academyMissionNeed)}</p>
      ` : ""}

      ${room.adminNotes ? `
        <p class="fed-command-copy"><strong>Admin notes:</strong> ${escapeHtml(room.adminNotes)}</p>
      ` : ""}
    </article>
  `).join("");
}

async function submitFederationDealRoom(form) {
  const feedback = qs("#dealRoomFeedback");
  const submitBtn = form.querySelector('button[type="submit"]');

  const payload = {
    roomType: qs("#dealRoomType")?.value || "partnership",
    currency: qs("#dealRoomCurrency")?.value || "USD",
    expectedValueAmount: Number(qs("#dealRoomExpectedValue")?.value || 0),
    platformCommissionRate: Number(qs("#dealRoomCommissionRate")?.value || 20),
    title: qs("#dealRoomTitle")?.value || "",
    description: qs("#dealRoomDescription")?.value || "",
    partnerNeed: qs("#dealRoomPartnerNeed")?.value || "",
    academyMissionNeed: qs("#dealRoomAcademyNeed")?.value || ""
  };

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
    }

    if (feedback) {
      feedback.hidden = false;
      feedback.classList.remove("error");
      feedback.classList.add("success");
      feedback.textContent = "Submitting Deal Room...";
    }

    const result = await federationConnectFetch("/api/federation/deal-rooms", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const room = result.room ? normalizeFederationDealRoom(result.room) : null;

    if (room) {
      federationServerState.dealRooms = [
        room,
        ...federationServerState.dealRooms.filter((item) => item.id !== room.id)
      ];
    }

    form.reset();

    const commissionRateInput = qs("#dealRoomCommissionRate");
    const currencyInput = qs("#dealRoomCurrency");

    if (commissionRateInput) commissionRateInput.value = "20";
    if (currencyInput) currencyInput.value = "USD";

    renderFederationDealRoomsSection();

    if (feedback) {
      feedback.classList.remove("error");
      feedback.classList.add("success");
      feedback.textContent = "Deal Room submitted. Admin can now review and supervise it.";
    }
  } catch (error) {
    if (feedback) {
      feedback.hidden = false;
      feedback.classList.remove("success");
      feedback.classList.add("error");
      feedback.textContent = error?.message || "Failed to submit Deal Room.";
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.setAttribute("aria-busy", "false");
    }
  }
}

function initFederationDealRooms() {
  const form = qs("#federationDealRoomForm");
  if (form && form.dataset.bound !== "true") {
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitFederationDealRoom(form);
    });
  }

  renderFederationDealRoomsSection();
}
function renderFederationConnectSection() {
  const section = qs("#connect");
  const grid = qs("#federationConnectGrid");
  const availableCount = qs("#federationConnectAvailableCount");
  const requestCount = qs("#federationConnectRequestCount");

  if (!section || !grid) return;

  const state = getCurrentUserState();
  const readiness = getFederationStrategicReadinessState();
  updateFederationStrategicReadinessSurface();

  if (state.type !== "member") {
    section.hidden = true;
    grid.innerHTML = "";
    return;
  }

  section.hidden = false;

  const filtered = getFilteredFederationConnectOpportunities();

  if (availableCount) {
    availableCount.textContent = String(federationConnectState.opportunities.length || 0);
  }

  if (requestCount) {
    requestCount.textContent = String(federationConnectState.requests.length || 0);
  }

  if (federationConnectState.loading) {
    grid.innerHTML = `
      <article class="fed-command-card fed-connect-empty">
        <div class="fed-sidebar-card-label">Loading</div>
        <h4>Loading Federation-ready leads...</h4>
        <p class="fed-command-copy">Checking Academy Lead Missions records marked for Federation access.</p>
      </article>
    `;
    renderFederationConnectRequestsPanel();
    return;
  }

  if (federationConnectState.error) {
    grid.innerHTML = `
      <article class="fed-command-card fed-connect-empty">
        <div class="fed-sidebar-card-label">Connect unavailable</div>
        <h4>Could not load Connect opportunities</h4>
        <p class="fed-command-copy">${escapeHtml(federationConnectState.error)}</p>
      </article>
    `;
    renderFederationConnectRequestsPanel();
    return;
  }

  if (!filtered.length) {
    grid.innerHTML = `
      <article class="fed-command-card fed-connect-empty">
        <div class="fed-sidebar-card-label">${escapeHtml(readiness.connectReady ? "No Federation-ready leads yet" : "Connect readiness still building")}</div>
        <h4>${escapeHtml(readiness.connectReady ? "Waiting for admin-routed Academy leads" : readiness.label)}</h4>
        <p class="fed-command-copy">
          ${escapeHtml(readiness.connectReady
            ? "Once admin marks Academy Lead Mission records as Federation-ready, anonymized opportunities will appear here for approved members to request."
            : readiness.copy)}
        </p>
      </article>
    `;
    renderFederationConnectRequestsPanel();
    return;
  }

  grid.innerHTML = filtered.map((opportunity) => `
    <article class="fed-connect-card">
      <div class="fed-connect-card-top">
        <div>
          <div class="fed-sidebar-card-label">${escapeHtml(opportunity.sourceDivision || "academy")} source</div>
          <h4>${escapeHtml(opportunity.title)}</h4>
        </div>
        <span class="fed-connect-value">${escapeHtml(opportunity.strategicValue || "standard")}</span>
      </div>

      <p class="fed-command-copy">${escapeHtml(opportunity.summary)}</p>

      <div class="fed-connect-meta">
        <span>${escapeHtml(opportunity.category)}</span>
        <span>${escapeHtml(opportunity.tier)}</span>
        <span>${escapeHtml([opportunity.city, opportunity.country].filter(Boolean).join(", ") || "Private region")}</span>
        <span>${opportunity.hasDirectContact ? "Contact on file" : "Intro required"}</span>
        ${
          Number(opportunity.buyerPriceAmount || 0) > 0
            ? `<span>${escapeHtml(formatFederationConnectMoney(opportunity.buyerPriceAmount, opportunity.currency))} total access price</span>`
            : `<span>Price set by admin</span>`
        }
      </div>

      <div class="fed-connect-card-foot">
        <small>${escapeHtml(opportunity.companyLabel || "Private organization")}</small>
        <button
          type="button"
          class="fed-btn fed-btn-primary"
          data-connect-open-request="${escapeHtml(opportunity.id)}"
        >
          Request Connection
        </button>
      </div>
    </article>
  `).join("");

  renderFederationConnectRequestsPanel();
  renderFederationRequestsSection();
}

async function loadFederationConnectData(options = {}) {
  const force = options.force === true;
  const state = getCurrentUserState();

  if (state.type !== "member") {
    renderFederationConnectSection();
    return;
  }

  if (federationConnectState.loading) return;

  if (federationConnectState.loaded && !force) {
    renderFederationConnectSection();
    return;
  }

  federationConnectState.loading = true;
  federationConnectState.error = "";
  renderFederationConnectSection();

  try {
    const [opportunitySettled, requestSettled] = await Promise.allSettled([
      federationConnectFetch("/api/federation/connect/opportunities"),
      federationConnectFetch("/api/federation/connect/my-requests")
    ]);

    if (opportunitySettled.status === "fulfilled") {
      const opportunityResult = opportunitySettled.value || {};

      federationConnectState.opportunities = Array.isArray(opportunityResult.opportunities)
        ? opportunityResult.opportunities.map(normalizeFederationConnectOpportunity)
        : [];
    } else {
      console.error("Federation Connect opportunities load error:", opportunitySettled.reason);
      federationConnectState.opportunities = [];
      federationConnectState.error = "Could not load Federation Connect opportunities.";
    }

    if (requestSettled.status === "fulfilled") {
      const requestResult = requestSettled.value || {};

      federationConnectState.requests = Array.isArray(requestResult.requests)
        ? requestResult.requests
        : [];
    } else {
      console.error("Federation Connect requests load error:", requestSettled.reason);
      federationConnectState.requests = [];
    }

    federationConnectState.loaded = true;
  } catch (error) {
    console.error("Federation Connect load error:", error);
    federationConnectState.error = error?.message || "Failed to load Federation Connect data.";
  } finally {
    federationConnectState.loading = false;
    renderFederationConnectSection();
  }
}

function openFederationConnectRequest(opportunityId = "") {
  const opportunity = federationConnectState.opportunities.find((item) => item.id === opportunityId);
  const panel = qs("#connectRequestPanel");
  const form = qs("#connectRequestForm");
  const selected = qs("#connectSelectedOpportunity");

  if (!opportunity || !panel || !form) return;

  form.reset();

  const leadField = qs("#connectRequestLeadId");
  const ownerField = qs("#connectRequestOwnerUid");

  if (leadField) leadField.value = opportunity.leadId;
  if (ownerField) ownerField.value = opportunity.ownerUid;

  if (selected) {
    selected.textContent = `Selected lead: ${opportunity.title}`;
  }

  const roleField = qs("#connectRequestedContactRole");
  const typeField = qs("#connectRequestedContactType");
  const cityField = qs("#connectRequestedCity");
  const countryField = qs("#connectRequestedCountry");

  if (roleField && opportunity.contactRole) roleField.value = opportunity.contactRole;
  if (typeField && opportunity.contactType) typeField.value = opportunity.contactType;
  if (cityField && opportunity.city) cityField.value = opportunity.city;
  if (countryField && opportunity.country) countryField.value = opportunity.country;

  panel.hidden = false;
  showFederationConnectFeedback("", "success");

  panel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeFederationConnectRequest() {
  const form = qs("#connectRequestForm");
  const selected = qs("#connectSelectedOpportunity");
  const leadField = qs("#connectRequestLeadId");
  const ownerField = qs("#connectRequestOwnerUid");
  const readiness = getFederationStrategicReadinessState();

  if (form) form.reset();
  if (leadField) leadField.value = "";
  if (ownerField) ownerField.value = "";

  if (selected) {
    selected.textContent = readiness.connectReady
      ? "Fill the request fields below. Admin will match your request against the Federation-ready lead database."
      : `Connect readiness: ${readiness.connectLabel}. ${readiness.copy}`;
  }

  updateFederationStrategicReadinessSurface();
  showFederationConnectFeedback("", "success");
}

async function submitFederationConnectRequest(form) {
  const payload = {
    leadId: String(form.elements.leadId?.value || "").trim(),
    ownerUid: String(form.elements.ownerUid?.value || "").trim(),

    companyName: String(form.elements.companyName?.value || "").trim(),
    companyWebsite: String(form.elements.companyWebsite?.value || "").trim(),
    contactName: String(form.elements.contactName?.value || "").trim(),
    contactRole: String(form.elements.contactRole?.value || "").trim(),
    contactType: String(form.elements.contactType?.value || "").trim(),
    city: String(form.elements.city?.value || "").trim(),
    country: String(form.elements.country?.value || "").trim(),
    sourceMethod: String(form.elements.sourceMethod?.value || "").trim(),
    channel: String(form.elements.channel?.value || "").trim(),
    pipelineStage: String(form.elements.pipelineStage?.value || "").trim(),
    priority: String(form.elements.priority?.value || "").trim(),
    requestedTier: String(form.elements.requestedTier?.value || "").trim(),

    requestReason: String(form.elements.requestReason?.value || "").trim(),
    intendedUse: String(form.elements.intendedUse?.value || "").trim(),
    budgetRange: String(form.elements.budgetRange?.value || "not_sure").trim(),
    urgency: String(form.elements.urgency?.value || "normal").trim(),
    preferredIntroType: String(form.elements.preferredIntroType?.value || "admin_brokered").trim(),
    notes: String(form.elements.notes?.value || "").trim()
  };

  if (!payload.contactRole || !payload.contactType || !payload.country) {
    showFederationConnectFeedback("Please add at least contact role, contact type, and country.", "error");
    return;
  }

  if (payload.requestReason.length < 12) {
    showFederationConnectFeedback("Please explain why you need this contact.", "error");
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent || "Submit Contact Request";

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting...";
    }

    const result = await federationConnectFetch("/api/federation/connect/requests", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (result?.request) {
      federationConnectState.requests = [
        result.request,
        ...federationConnectState.requests.filter((item) => item.id !== result.request.id)
      ];
    }

    closeFederationConnectRequest();
    showFederationConnectFeedback("Connection request submitted. Admin will review and match this request.", "success");
    await loadFederationConnectData({ force: true });
  } catch (error) {
    console.error("Federation Connect submit error:", error);
    showFederationConnectFeedback(error?.message || "Failed to submit connection request.", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

function initFederationConnect() {
  ["#connectSearch", "#connectValueFilter", "#connectCountryFilter"].forEach((selector) => {
    const field = qs(selector);
    if (!field) return;

    field.addEventListener("input", renderFederationConnectSection);
    field.addEventListener("change", renderFederationConnectSection);
  });

  document.addEventListener("click", (event) => {
    const oxapayCheckoutBtn = event.target.closest("[data-federation-start-oxapay-checkout]");
    if (oxapayCheckoutBtn) {
      event.preventDefault();
      event.stopPropagation();
      startFederationOxaPayCheckout(
        oxapayCheckoutBtn.getAttribute("data-federation-start-oxapay-checkout") || "",
        oxapayCheckoutBtn
      );
      return;
    }

    const stripeCheckoutBtn = event.target.closest("[data-federation-start-stripe-checkout]");
    if (stripeCheckoutBtn) {
      event.preventDefault();
      event.stopPropagation();
      startFederationStripeCheckout(
        stripeCheckoutBtn.getAttribute("data-federation-start-stripe-checkout") || "",
        stripeCheckoutBtn
      );
      return;
    }

    const providerBtn = event.target.closest("[data-federation-select-provider]");
    if (providerBtn) {
      event.preventDefault();
      event.stopPropagation();
      selectFederationPaymentProvider(
        providerBtn.getAttribute("data-federation-select-provider") || "",
        providerBtn.getAttribute("data-payment-provider") || "",
        providerBtn
      );
      return;
    }

    const unlockLeadBtn = event.target.closest("[data-federation-unlock-lead]");
    if (unlockLeadBtn) {
      event.preventDefault();
      event.stopPropagation();
      unlockFederationLeadDetails(
        unlockLeadBtn.getAttribute("data-federation-unlock-lead") || "",
        unlockLeadBtn
      );
      return;
    }

    const payIntroBtn = event.target.closest("[data-federation-pay-intro]");
    if (payIntroBtn) {
      event.preventDefault();
      event.stopPropagation();
      startFederationPaidIntroCheckout(
        payIntroBtn.getAttribute("data-federation-pay-intro") || "",
        payIntroBtn
      );
      return;
    }

    const openBtn = event.target.closest("[data-connect-open-request]");
    if (openBtn) {
      openFederationConnectRequest(openBtn.getAttribute("data-connect-open-request") || "");
      return;
    }

    if (event.target.closest("#connectRequestCancel")) {
      closeFederationConnectRequest();
    }
  });

  const form = qs("#connectRequestForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitFederationConnectRequest(form);
    });
  }
}
function getApplications() {
  if (federationServerState.loaded) {
    return Array.isArray(federationServerState.applications)
      ? federationServerState.applications
      : [];
  }

  const applications = readStorage(STORAGE_KEYS.applications, []);
  return Array.isArray(applications) ? applications : [];
}

function setApplications(applications) {
  writeStorage(STORAGE_KEYS.applications, applications);
}

function getMembers() {
  if (federationServerState.loaded) {
    return Array.isArray(federationServerState.members)
      ? federationServerState.members
      : [];
  }

  const members = readStorage(STORAGE_KEYS.members, []);
  return Array.isArray(members) ? members : [];
}

function setMembers(members) {
  writeStorage(STORAGE_KEYS.members, members);
}

function ensureSeedMembers() {
  /*
   * Federation no longer seeds mock members into the live UI.
   * Members now come from /api/federation/directory.
   * Keep this function as a no-op so older init flow does not break.
   */
}

function removeMemberByEmail(emailLower) {
  const members = getMembers().filter((member) => normalizeEmail(member.email) !== emailLower);
  setMembers(members);
}

function getCurrentUser() {
  if (federationServerState.loaded && federationServerState.currentUser) {
    return federationServerState.currentUser;
  }

  const currentUser = readStorage(STORAGE_KEYS.currentUser, null);
  if (!currentUser || typeof currentUser !== "object") {
    return null;
  }
  return currentUser;
}

function setCurrentUser(user) {
  writeStorage(STORAGE_KEYS.currentUser, user);
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
}

function isAdminModeEnabled() {
  return localStorage.getItem(STORAGE_KEYS.adminMode) === "1";
}

function setAdminMode(enabled) {
  localStorage.setItem(STORAGE_KEYS.adminMode, enabled ? "1" : "0");
}

function getLatestApplicationByEmail(emailLower) {
  return (
    getApplications().find((application) => normalizeEmail(application.email) === emailLower) || null
  );
}

function getMemberByEmail(emailLower) {
  return getMembers().find((member) => normalizeEmail(member.email) === emailLower) || null;
}

function getCurrentUserState() {
  if (federationServerState.loaded && federationServerState.member) {
    return {
      type: "member",
      currentUser: federationServerState.currentUser,
      application: federationServerState.application,
      member: federationServerState.member
    };
  }

  if (federationServerState.loaded && federationServerState.application) {
    return {
      type: "applicant",
      currentUser: federationServerState.currentUser,
      application: federationServerState.application,
      member: null
    };
  }

  const currentUser = getCurrentUser();

  if (!currentUser || !currentUser.email) {
    return {
      type: "visitor",
      currentUser: null,
      application: null,
      member: null
    };
  }

  const emailLower = normalizeEmail(currentUser.email);
  const member = getMemberByEmail(emailLower);

  if (member) {
    return {
      type: "member",
      currentUser,
      application: getLatestApplicationByEmail(emailLower),
      member
    };
  }

  const application = getLatestApplicationByEmail(emailLower);
  if (application) {
    return {
      type: "applicant",
      currentUser,
      application,
      member: null
    };
  }

  return {
    type: "visitor",
    currentUser: null,
    application: null,
    member: null
  };
}

function readFederationJsonCache(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}
function getFederationLadderOutcomeSnapshot() {
  return readFederationJsonCache("yh_federation_ladder_outcome_v1", {}) || {};
}
function getFederationStrategicReadinessState() {
  const plazaSnapshot = readFederationJsonCache("yh_plaza_access_status_v1", {}) || {};
  const federationSnapshot = readFederationJsonCache("yh_federation_access_status_v1", {}) || {};
  const directorySnapshot = readFederationJsonCache("yhPlazaDirectoryStatusV1", {}) || {};
  const ladderOutcome = getFederationLadderOutcomeSnapshot();

  const plazaApproved =
    plazaSnapshot?.canEnterPlaza === true ||
    String(plazaSnapshot?.applicationStatus || "").trim().toLowerCase() === "approved" ||
    directorySnapshot?.seeded === true;

  const federationStatus = String(
    federationSnapshot?.applicationStatus ||
    ladderOutcome?.status ||
    ""
  ).trim().toLowerCase();

  const federationApproved =
    federationSnapshot?.canEnterFederation === true ||
    federationStatus === "approved";

  const score = Number(directorySnapshot?.opportunityScore || ladderOutcome?.score || 0);
  const stage = String(directorySnapshot?.opportunityStage || "").trim();

  if (!plazaApproved) {
    return {
      score: 0,
      label: "Plaza First",
      connectLabel: "Locked",
      copy: "Federation candidacy starts after Plaza approval and signal-building inside Plaza.",
      connectReady: false
    };
  }

  if (!directorySnapshot || directorySnapshot.seeded !== true) {
    return {
      score: 0,
      label: "Seed Plaza Profile",
      connectLabel: "Locked",
      copy: "Seed your Plaza profile first so the Federation layer can evaluate your signal.",
      connectReady: false
    };
  }

  if (federationStatus === "rejected") {
    return {
      score: Number(ladderOutcome?.score || score || 0),
      label: "Review Rejected",
      connectLabel: "Locked",
      copy: String(
        ladderOutcome?.copy ||
        "Your Federation application was not approved in this cycle. Build stronger Plaza outcomes, trust, and leverage before reapplying."
      ).trim(),
      connectReady: false
    };
  }

  if (federationStatus === "waitlisted") {
    return {
      score: Number(ladderOutcome?.score || score || 0),
      label: "Waitlisted",
      connectLabel: "Build More Signal",
      copy: String(
        ladderOutcome?.copy ||
        "Your Federation application has been waitlisted. Strengthen your Plaza signal and strategic proof before the next review cycle."
      ).trim(),
      connectReady: false
    };
  }

  if (federationStatus === "shortlisted") {
    return {
      score: Number(ladderOutcome?.score || score || 0),
      label: "Shortlisted",
      connectLabel: "Near Final Review",
      copy: String(
        ladderOutcome?.copy ||
        "Your Federation application has reached shortlist status. You are near final review, but access is not unlocked yet."
      ).trim(),
      connectReady: false
    };
  }

  if (federationStatus === "under review" || federationStatus === "screening") {
    return {
      score: Number(ladderOutcome?.score || score || 0),
      label: federationStatus === "screening" ? "In Screening" : "In Federation Review",
      connectLabel: "Locked",
      copy: String(
        ladderOutcome?.copy ||
        "Your Federation application is currently in review. Admin is evaluating your candidacy against trust, leverage, and strategic value."
      ).trim(),
      connectReady: false
    };
  }

  if (federationApproved) {
    if (stage === "Ready for Strategic Escalation" || score >= 85) {
      return {
        score,
        label: "Inside Federation",
        connectLabel: "Ready",
        copy: "Your Plaza layer is strong enough for strategic routing and higher-trust Connect readiness.",
        connectReady: true
      };
    }

    if (stage === "Ready for Matching" || score >= 65) {
      return {
        score,
        label: "Inside Federation",
        connectLabel: "Ready",
        copy: "Your Plaza layer is strong enough for qualified Connect activity.",
        connectReady: true
      };
    }

    return {
      score,
      label: "Inside Federation",
      connectLabel: "Build More Signal",
      copy: "You are already inside Federation, but your Plaza layer still needs stronger signal for higher-trust Connect positioning.",
      connectReady: false
    };
  }

  if (stage === "Ready for Strategic Escalation" || score >= 85) {
    return {
      score,
      label: "Strategic Candidate",
      connectLabel: "Ready",
      copy: "Your Plaza opportunity score is strong enough to support serious Federation candidacy and high-trust Connect readiness.",
      connectReady: true
    };
  }

  if (stage === "Ready for Matching" || score >= 65) {
    return {
      score,
      label: "Ready for Review",
      connectLabel: "Ready",
      copy: "Your Plaza layer is strong enough for Federation review and qualified Connect readiness.",
      connectReady: true
    };
  }

  if (stage === "Active" || score >= 40) {
    return {
      score,
      label: "Emerging Candidate",
      connectLabel: "Build More Signal",
      copy: "Your Plaza layer is active, but it still needs stronger outcomes and trust before serious Federation candidacy.",
      connectReady: false
    };
  }

  return {
    score,
    label: "Weak Candidate",
    connectLabel: "Locked",
    copy: "Build a stronger Plaza opportunity score before pushing toward Federation candidacy.",
    connectReady: false
  };
}

function getFederationTierFromScore(score = 0) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));

  if (safeScore >= 90) return "CORE";
  if (safeScore >= 70) return "OPERATOR";
  if (safeScore >= 50) return "CONTRIBUTOR";

  return "LOW_PRIORITY";
}

function getFederationApplicationStrategicSnapshot() {
  const directorySnapshot = readFederationJsonCache("yhPlazaDirectoryStatusV1", {}) || {};
  const readiness = getFederationStrategicReadinessState();

  const tags = Array.isArray(directorySnapshot?.tags)
    ? directorySnapshot.tags.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const lookingFor = Array.isArray(directorySnapshot?.lookingFor)
    ? directorySnapshot.lookingFor.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const canOffer = Array.isArray(directorySnapshot?.canOffer)
    ? directorySnapshot.canOffer.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const score = Number(readiness?.score || directorySnapshot?.opportunityScore || 0);

  return {
    score,
    tier: getFederationTierFromScore(score),

    plazaProfileStatus: directorySnapshot?.seeded === true ? "Seeded" : "Locked",
    opportunityStage: String(directorySnapshot?.opportunityStage || "").trim() || "Locked",
    opportunityCopy: String(directorySnapshot?.opportunityCopy || "").trim(),
    federationReadinessLabel: String(readiness?.label || "Plaza First").trim() || "Plaza First",
    federationReadinessCopy: String(readiness?.copy || "").trim(),
    connectReady: readiness?.connectReady === true,

    role: String(directorySnapshot?.role || "").trim(),
    focus: String(directorySnapshot?.focus || "").trim(),
    trust: String(directorySnapshot?.trust || "").trim(),
    region: String(directorySnapshot?.region || "").trim(),
    availability: String(directorySnapshot?.availability || "").trim(),
    workMode: String(directorySnapshot?.workMode || "").trim(),
    marketplaceMode: directorySnapshot?.marketplaceMode === true,

    tags,
    lookingFor,
    canOffer,
    lookingForText: lookingFor.join(", "),
    canOfferText: canOffer.join(", ")
  };
}

function buildFederationStrategicReadinessNoteMarkup() {
  const readiness = getFederationStrategicReadinessState();
  const scoreCopy = readiness.score > 0 ? ` Score ${readiness.score}.` : "";

  return `
    <div class="fed-state-inline-note">
      Strategic readiness: ${escapeHtml(readiness.label)}.${escapeHtml(scoreCopy)} ${escapeHtml(readiness.copy)}
    </div>
  `;
}

function updateFederationStrategicReadinessSurface() {
  const readiness = getFederationStrategicReadinessState();

  const labelEl = qs("#federationStrategicReadinessLabel");
  const connectEl = qs("#federationConnectReadinessLabel");
  const copyEl = qs("#federationStrategicReadinessCopy");
  const selectedEl = qs("#connectSelectedOpportunity");
  const submitBtn = qs('#connectRequestForm button[type="submit"]');

  if (labelEl) {
    labelEl.textContent = readiness.score > 0
      ? `${readiness.score} · ${readiness.label}`
      : readiness.label;
  }

  if (connectEl) {
    connectEl.textContent = readiness.connectLabel;
  }

  if (copyEl) {
    copyEl.textContent = readiness.copy;
  }

  if (selectedEl && !String(qs("#connectRequestLeadId")?.value || "").trim()) {
    selectedEl.textContent = readiness.connectReady
      ? "Fill the request fields below. Admin will match your request against the Federation-ready lead database."
      : `Connect readiness: ${readiness.connectLabel}. ${readiness.copy}`;
  }

  if (submitBtn) {
    submitBtn.textContent = readiness.connectReady
      ? "Submit Strategic Contact Request"
      : "Submit Contact Request";
  }
}
function buildMemberDescription(application) {
  const value = String(application.valueBring || "").trim();
  const why = String(application.whyJoin || "").trim();
  const baseText =
    value ||
    why ||
    "Approved Federation member with strategic profile under beta review flow.";

  return baseText.length > 190 ? `${baseText.slice(0, 187)}...` : baseText;
}

function buildMemberBadge(application) {
  if (application.primaryCategory === "Entrepreneurs & Investors") return "Investor";
  if (application.primaryCategory === "Influencers & Media Architects") return "Media";
  if (application.primaryCategory === "Operators Across Industries") return "Connector";
  return "Approved";
}

function normalizeReferralCode(value) {
  return String(value || "").trim().toUpperCase();
}

function slugifyReferralSegment(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6);
}

function createReferralCode(name) {
  const base = slugifyReferralSegment(name) || "MEMBER";
  let attempts = 0;
  let code = "";

  do {
    code = `YHF-${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    attempts += 1;
  } while (getMemberByReferralCode(code) && attempts < 12);

  return code;
}

function getMemberByReferralCode(code) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  return (
    getMembers().find(
      (member) => normalizeReferralCode(member.referralCode) === normalized
    ) || null
  );
}

function ensureMemberReferralCodes() {
  const members = getMembers();
  if (!members.length) return;

  const seenCodes = new Set();
  let changed = false;

  const nextMembers = members.map((member) => {
    let referralCode = normalizeReferralCode(member.referralCode);

    if (!referralCode || seenCodes.has(referralCode)) {
      referralCode = createReferralCode(member.name);
      while (seenCodes.has(referralCode)) {
        referralCode = createReferralCode(member.name);
      }
      changed = true;
    }

    seenCodes.add(referralCode);

    return {
      ...member,
      referralCode
    };
  });

  if (changed) {
    setMembers(nextMembers);
  }
}

function createUsernameFromEmail(email) {
  const local = String(email || "").split("@")[0] || "federation-user";
  const normalized = local
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return normalized || "federation_user";
}

function buildFederationTagFromCategory(category = "") {
  const map = {
    "Lawyers & Legal Strategists": "Lawyer",
    "Politicians & Policy Advisors": "Policy",
    "Entrepreneurs & Investors": "Investor",
    "Influencers & Media Architects": "Creator",
    "Cybersecurity Experts": "Operator",
    "Operators Across Industries": "Operator"
  };

  return map[category] || "Operator";
}

function getCanApplyForCurrentState() {
  const state = getCurrentUserState();
  return (
    state.type === "visitor" ||
    (state.type === "applicant" && state.application && state.application.status === "Rejected")
  );
}

function getDirectoryVisibilityMode() {
  const state = getCurrentUserState();

  if (state.type === "member") return "full";
  if (state.type === "applicant") return "partial";
  return "preview";
}

function buildRedactedName(name, mode = "preview") {
  const parts = String(name || "Private Member").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Private Member";

  if (mode === "partial") {
    const first = parts[0];
    const lastInitial = parts[1] ? ` ${parts[1].charAt(0).toUpperCase()}.` : "";
    return `${first}${lastInitial}`;
  }

  return "Private Member";
}

function redactDirectoryMember(member, mode = "preview") {
  if (mode === "full") {
    return {
      ...member,
      __redacted: false
    };
  }

  const isPartial = mode === "partial";

  return {
    ...member,
    name: buildRedactedName(member.name, mode),
    role: isPartial
      ? (member.category || "Approved Member")
      : (member.category || "Federation Member"),
    company: "Private Organization",
    city: isPartial
      ? (member.country || "Regional Cluster")
      : "Private City",
    description: isPartial
      ? "Full introductions and operating details unlock after approval."
      : "This is a protected preview. Full member details unlock after approval.",
    badge: isPartial ? "Screened" : "Private",
    __redacted: true
  };
}

function buildStatusTimelineMarkup(status = "Pending") {
  const steps = ["Pending", "Under Review", "Screening", "Shortlisted", "Approved"];
  const normalized = String(status || "Pending");
  const rejected = normalized === "Rejected";
  const activeIndex = steps.indexOf(normalized);

  const stepsMarkup = steps
    .map((step, index) => {
      let stateClass = "is-off";

      if (rejected) {
        stateClass = index === 0 ? "is-done" : "is-off";
      } else if (activeIndex === -1) {
        stateClass = step === "Pending" ? "is-active" : "is-off";
      } else if (index < activeIndex) {
        stateClass = "is-done";
      } else if (index === activeIndex) {
        stateClass = "is-active";
      }

      return `
        <div class="fed-timeline-step ${stateClass}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(step)}</strong>
        </div>
      `;
    })
    .join("");

  return `
    <div class="fed-state-timeline-wrap">
      <div class="fed-state-timeline">
        ${stepsMarkup}
      </div>
      ${
        rejected
          ? `<div class="fed-state-inline-note is-error">This application is currently marked Rejected. You can submit a fresh application again from the Apply section.</div>`
          : ""
      }
    </div>
  `;
}

function renderMemberCommandSection() {
  const section = qs("#command");
  const container = qs("#memberCommandPanel");

  if (!section || !container) return;

  const state = getCurrentUserState();

  if (state.type !== "member") {
    section.hidden = true;
    container.innerHTML = "";
    return;
  }

  section.hidden = false;

  const member = state.member;
  const snapshot = getReferralSnapshotForMember(member);
  const liveRegions = uniqueValues(
    getMembers().filter((candidate) => candidate.category === member.category),
    (candidate) => candidate.country
  ).length;

  const bestUseCases = [
    member.category,
    member.country,
    member.city,
    buildFederationTagFromCategory(member.category)
  ].filter(Boolean);

  container.innerHTML = `
    <article class="fed-command-card fed-command-card-hero">
      <div class="fed-sidebar-card-label">Member Command</div>
      <h4>Operate from your Federation lane</h4>
      <p class="fed-command-copy">
        This is the private operating layer for approved members. Use it to open doors
        carefully, route serious referrals, and position yourself where your category and region
        give the network the most leverage.
      </p>

      <div class="fed-command-pills">
        ${bestUseCases.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>

      <div class="fed-command-actions">
        <a class="fed-btn fed-btn-primary" href="#connect">Request Connection</a>
        <a class="fed-btn fed-btn-secondary" href="#requests">Track Requests</a>
        <a class="fed-btn fed-btn-secondary" href="#directory">Open Directory</a>
        <a class="fed-btn fed-btn-secondary" href="#referrals">Open Referrals</a>
      </div>
    </article>

    <article class="fed-command-card">
      <div class="fed-sidebar-card-label">Referral Momentum</div>
      <h4>Your current pipeline</h4>
      <div class="fed-state-grid">
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(snapshot.total))}</strong>
          <small>Total referred profiles</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(snapshot.pending))}</strong>
          <small>Still under review</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(snapshot.shortlisted))}</strong>
          <small>Shortlisted</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(snapshot.approved))}</strong>
          <small>Approved</small>
        </div>
      </div>
    </article>

        <article class="fed-command-card fed-command-card-positioning">
      <div class="fed-sidebar-card-label">Positioning</div>
      <h4>Where your lane is strongest</h4>
      <div class="fed-state-grid">
        <div class="fed-state-metric">
          <strong>${escapeHtml(member.category || "N/A")}</strong>
          <small>Primary sector</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml([member.city, member.country].filter(Boolean).join(", ") || "N/A")}</strong>
          <small>Regional anchor</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(liveRegions || 0))}</strong>
          <small>Countries in same lane</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(member.referralCode || "N/A")}</strong>
          <small>Live member code</small>
        </div>
      </div>
    </article>

    <article class="fed-command-card fed-command-card-full">
      <div class="fed-sidebar-card-label">Connection Activity</div>
      <h4>Your request pipeline</h4>
      <div class="fed-state-grid">
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(federationServerState.command?.stats?.connectOpportunities || federationConnectState.opportunities.length || 0))}</strong>
          <small>Available Connect leads</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(federationServerState.command?.stats?.myRequests || federationConnectState.requests.length || 0))}</strong>
          <small>Total requests</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(federationServerState.command?.stats?.pendingRequests || federationConnectState.requests.filter((item) => String(item.status || "").includes("pending")).length || 0))}</strong>
          <small>Pending review</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(federationServerState.command?.stats?.completedRequests || federationConnectState.requests.filter((item) => String(item.status || "").toLowerCase() === "completed").length || 0))}</strong>
          <small>Completed</small>
        </div>
      </div>
    </article>
  `;
}

function syncFederationChrome() {
  const state = getCurrentUserState();
  const canApply = getCanApplyForCurrentState();

  const navCommand = qs("#fedNavCommand");
  const navConnect = qs("#fedNavConnect");
  const navApply = qs("#fedNavApply");
  const navAdmin = qs("#fedNavAdmin");
  const commandBtn = qs("#memberCommandBtn");
  const connectBtn = qs("#connectBtn");
  const primaryCtaBtn = qs("#primaryCtaBtn");
  const mobileCommand = qs("#fedMobileCommand");
  const mobileConnect = qs("#fedMobileConnect");
  const mobileApply = qs("#fedMobileApply");
  const mobileAdmin = qs("#fedMobileAdmin");
  const quickCommand = qs("#fedTopbarQuickCommand");
  const quickConnect = qs("#fedTopbarQuickConnect");
  const quickApply = qs("#fedTopbarQuickApply");

  const directoryKicker = qs("#directoryKicker");
  const directoryTitle = qs("#directoryTitle");
  const directoryText = qs("#directoryText");

  document.body.dataset.fedState = state.type;

  if (navCommand) navCommand.hidden = false;
  if (navConnect) navConnect.hidden = false;
  if (commandBtn) commandBtn.hidden = true;
  if (connectBtn) connectBtn.hidden = false;

  if (navApply) navApply.hidden = true;
  if (navAdmin) navAdmin.hidden = true;

  if (mobileCommand) mobileCommand.hidden = true;
  if (mobileConnect) mobileConnect.hidden = false;
  if (mobileApply) mobileApply.hidden = true;
  if (mobileAdmin) mobileAdmin.hidden = true;

  if (quickCommand) quickCommand.hidden = false;
  if (quickConnect) quickConnect.hidden = false;
  if (quickApply) quickApply.hidden = true;

  if (primaryCtaBtn) {
    primaryCtaBtn.textContent = "Open Connect";
    primaryCtaBtn.setAttribute("data-jump", "#connect");
  }

  if (mobileApply) {
    const mobileApplyTitle = mobileApply.querySelector("strong");
    if (mobileApplyTitle) {
      mobileApplyTitle.textContent =
        state.type === "applicant" && canApply ? "Apply Again" : "Apply";
    }
  }

  if (quickApply) {
    const quickApplyTitle = quickApply.querySelector("strong");
    if (quickApplyTitle) {
      quickApplyTitle.textContent =
        state.type === "applicant" && canApply ? "Apply Again" : "Request Access";
    }
  }

  if (directoryKicker && directoryTitle && directoryText) {
    const mode = getDirectoryVisibilityMode();

    if (mode === "full") {
      directoryKicker.textContent = "Live Member Directory";
      directoryTitle.textContent = "Federation Directory";
            directoryText.innerHTML =
        'Approved member view. You are now seeing the live server-backed Federation directory from approved members.';
    } else if (mode === "partial") {
      directoryKicker.textContent = "Screened Preview";
      directoryTitle.textContent = "Federation Directory Preview";
      directoryText.innerHTML =
        'Your application is in the pipeline. You can preview sectors and regions here, while full names and operating details stay protected until approval.';
    } else {
      directoryKicker.textContent = "Member Preview";
      directoryTitle.textContent = "Federation Directory Preview";
      directoryText.innerHTML =
        'This is a protected preview of the Federation. Full names, firms, and direct operating details unlock after approval.';
    }
  }
}

function getReferralSnapshotForMember(member) {
  if (federationServerState.loaded && federationServerState.referrals) {
    return {
      referralCode: normalizeReferralCode(
        federationServerState.referrals.referralCode ||
        member.referralCode
      ),
      total: Number(federationServerState.referrals.total || 0),
      pending: Number(federationServerState.referrals.pending || 0),
      shortlisted: Number(federationServerState.referrals.shortlisted || 0),
      approved: Number(federationServerState.referrals.approved || 0),
      recent: Array.isArray(federationServerState.referrals.recent)
        ? federationServerState.referrals.recent
        : []
    };
  }

  const emailLower = normalizeEmail(member.email);
  const referralCode = normalizeReferralCode(member.referralCode);

  const referredApplications = getApplications()
    .filter((application) => {
      const byCode =
        referralCode &&
        normalizeReferralCode(application.referralCodeUsed) === referralCode;

      const byEmail =
        normalizeEmail(application.referredByEmail) === emailLower;

      return byCode || byEmail;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    referralCode,
    total: referredApplications.length,
    pending: referredApplications.filter((application) =>
      ["Pending", "Under Review", "Screening"].includes(application.status)
    ).length,
    shortlisted: referredApplications.filter(
      (application) => application.status === "Shortlisted"
    ).length,
    approved: referredApplications.filter(
      (application) => application.status === "Approved"
    ).length,
    recent: referredApplications.slice(0, 5)
  };
}

function buildReferralInviteUrl(code) {
  const normalized = normalizeReferralCode(code);
  if (!normalized || typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  url.searchParams.set("ref", normalized);
  url.hash = "apply";
  return url.toString();
}

function setReferralAssistState(member, code = "") {
  const referralCodeField = qs("#referralCode");
  const referredByField = qs("#referredBy");
  const hint = qs("#referralCodeHint");

  if (!referralCodeField || !referredByField || !hint) return;

  hint.classList.remove("is-valid", "is-error");

  if (member) {
    const normalized = normalizeReferralCode(code || member.referralCode);
    referralCodeField.value = normalized;
    referredByField.value = member.name || "";
    referredByField.readOnly = true;
    referredByField.dataset.autoFilled = "1";
    hint.textContent = `Valid member code. This application will be linked to ${member.name}.`;
    hint.classList.add("is-valid");
    return;
  }

  if (!normalizeReferralCode(code)) {
    if (referredByField.dataset.autoFilled === "1") {
      referredByField.value = "";
    }
    referredByField.readOnly = false;
    delete referredByField.dataset.autoFilled;
    hint.textContent = "Optional. Paste a valid member code to link your application.";
    return;
  }

  if (referredByField.dataset.autoFilled === "1") {
    referredByField.value = "";
  }
  referredByField.readOnly = false;
  delete referredByField.dataset.autoFilled;
  hint.textContent = "Referral code not found. Check the code or leave it blank.";
  hint.classList.add("is-error");
}

function hydrateReferralCodeFromUrl() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const referralCode = normalizeReferralCode(url.searchParams.get("ref"));
  if (!referralCode) return;

  const member = getMemberByReferralCode(referralCode);
  setReferralAssistState(member, referralCode);
}

function initReferralFormAssist() {
  const referralCodeField = qs("#referralCode");
  if (!referralCodeField) return;

  const syncReferralState = () => {
    const code = normalizeReferralCode(referralCodeField.value);
    const member = code ? getMemberByReferralCode(code) : null;
    setReferralAssistState(member, code);
  };

  referralCodeField.addEventListener("input", syncReferralState);
  referralCodeField.addEventListener("blur", syncReferralState);
}

function applicationToMember(application) {
  return {
    id: application.memberId || makeId("member"),
    email: application.email,
    emailLower: normalizeEmail(application.email),
    name: application.fullName,
    username: createUsernameFromEmail(application.email),
    role: application.role || (Array.isArray(application.roles) ? application.roles[0] : "") || "Federation Operator",
    profession: application.role || (Array.isArray(application.roles) ? application.roles[0] : "") || "Federation Operator",
    badge: buildMemberBadge(application),
    tag: buildFederationTagFromCategory(application.primaryCategory),
    category: application.primaryCategory,
    division: "Federation",
    divisions: ["Federation"],
    status: "Active",
    country: application.country,
    city: application.city,
    region: [application.city, application.country].filter(Boolean).join(", "),
    company: application.company || "Independent",
    description: buildMemberDescription(application),
    strategicValue: application.canOffer || application.valueBring || "",
    roles: Array.isArray(application.roles) ? application.roles : [],
    level: application.level || "",
    audienceSize: application.audienceSize || "",
    activePlatforms: Array.isArray(application.activePlatforms) ? application.activePlatforms : [],
    capitalRange: application.capitalRange || "",
    teamSize: application.teamSize || "",
    skillLevel: application.skillLevel || "",
    lookingFor: application.lookingFor || "",
    canOffer: application.canOffer || application.valueBring || "",
    wantsAccessTo: application.wantsAccessTo || application.introductions || "",
    openTo: Array.isArray(application.openTo) ? application.openTo : [],
    federationProfileMap:
      application.federationProfileMap && typeof application.federationProfileMap === "object"
        ? application.federationProfileMap
        : null,
    federationTags: Array.isArray(application.federationTags) ? application.federationTags : [],
    federationScore: Number(application.federationScore || 0),
    federationTier: application.federationTier || "",
    notes: [
      application.whyJoin,
      application.lookingFor,
      application.canOffer || application.valueBring,
      application.wantsAccessTo || application.introductions
    ].filter(Boolean),
    activityScore: 0,
    roadmapStatus: "Federation",
    lastLogin: "Not tracked yet",
    joinedAt: application.approvedAt || new Date().toISOString(),
    approvedAt: application.approvedAt || new Date().toISOString(),
    referralCode:
      normalizeReferralCode(application.generatedReferralCode) ||
      createReferralCode(application.fullName),
    referredByCode: normalizeReferralCode(application.referralCodeUsed),
    referredByName: application.referredBy || "",
    referredByEmail: application.referredByEmail || "",
    sourceApplicationId: application.id,
    source: "application"
  };
}

function upsertMemberFromApplication(application) {
  const members = getMembers();
  const nextMember = applicationToMember(application);
  const emailLower = normalizeEmail(nextMember.email);
  const existingIndex = members.findIndex((member) => normalizeEmail(member.email) === emailLower);

  if (existingIndex >= 0) {
    members[existingIndex] = {
      ...members[existingIndex],
      ...nextMember,
      id: members[existingIndex].id || nextMember.id
    };
  } else {
    members.unshift(nextMember);
  }

  setMembers(members);
  return nextMember;
}

function animateValue(el, endValue, suffix = "") {
  if (!el) return;

  const duration = 1100;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const current = Math.floor(progress * endValue);
    el.textContent = `${current}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function renderStats() {
  const members = getMembers();
  const applications = getApplications();
  const state = getCurrentUserState();
  const directoryMode = getDirectoryVisibilityMode();

  const pendingCount = applications.filter((application) =>
    ["Pending", "Under Review", "Screening"].includes(application.status)
  ).length;

  const countryCount = uniqueValues(members, (member) => member.country).length;
  const categoryCount = uniqueValues(members, (member) => member.category).length;
  const cityCount = uniqueValues(members, (member) => member.city).length;
    const routeCount = MAP_ROUTE_PAIRS.length;

  const statMap = [
    { id: "heroMembers", value: members.length, suffix: "" },
    { id: "heroCountries", value: countryCount, suffix: "" },
    { id: "heroCategories", value: categoryCount, suffix: "" },
    { id: "heroApplications", value: applications.length, suffix: "" },
    { id: "heroPending", value: pendingCount, suffix: "" },
    { id: "regionCount", value: cityCount, suffix: "" },
    { id: "expansionCountryCount", value: countryCount, suffix: "" },
    { id: "expansionRouteCount", value: routeCount, suffix: "" }
  ];

  statMap.forEach((item) => {
    animateValue(document.getElementById(item.id), item.value, item.suffix);
  });

  const combinedProfiles = [
    ...members.map((member) => ({
      category: member.category,
      country: member.country
    })),
    ...applications.map((application) => ({
      category: application.primaryCategory,
      country: application.country
    }))
  ];

  const topCategory = getMostCommonValue(
    combinedProfiles,
    (item) => item.category,
    "No dominant sector yet"
  );

  const topRegion = getMostCommonValue(
    combinedProfiles,
    (item) => item.country,
    "No strong regional signal yet"
  );

  const stateChip = qs("#overviewStateChip");
  const liveMode = qs("#overviewLiveMode");
  const directoryModeEl = qs("#overviewDirectoryMode");
  const positionTitle = qs("#overviewPositionTitle");
  const positionText = qs("#overviewPositionText");
  const topCategoryEl = qs("#overviewTopCategory");
  const topCategoryText = qs("#overviewTopCategoryText");
  const topRegionEl = qs("#overviewTopRegion");
  const topRegionText = qs("#overviewTopRegionText");
  const overviewPrimaryAction = qs("#overviewPrimaryAction");

  if (stateChip) {
    stateChip.textContent =
      state.type === "member"
        ? "Approved Member Layer"
        : state.type === "applicant"
          ? `Application: ${state.application.status}`
          : "Private Strategic Circle";
  }

  if (liveMode) {
    liveMode.textContent =
      state.type === "member"
        ? "Member Mode"
        : state.type === "applicant"
          ? "Applicant Mode"
          : "Visitor Mode";
  }

  if (directoryModeEl) {
    directoryModeEl.textContent =
      directoryMode === "full"
        ? "Full Directory"
        : directoryMode === "partial"
          ? "Screened Preview"
          : "Protected Preview";
  }

  if (positionTitle && positionText) {
    const readiness = getFederationStrategicReadinessState();

    if (state.type === "member") {
      const snapshot = getReferralSnapshotForMember(state.member);
      positionTitle.textContent = readiness.label === "Inside Federation"
        ? "You are inside the member operating layer"
        : readiness.label;
      positionText.textContent = `${readiness.copy} Current referral pipeline: ${snapshot.total} total, ${snapshot.pending} still in review, ${snapshot.approved} approved.`;
    } else if (state.type === "applicant") {
      positionTitle.textContent = `Application status: ${state.application.status}`;
      positionText.textContent = `${readiness.copy} Directory visibility stays protected until approval is granted.`;
    } else {
      positionTitle.textContent = readiness.label;
      positionText.textContent = readiness.copy;
    }
  }

  if (topCategoryEl) {
    topCategoryEl.textContent = topCategory;
  }

  if (topCategoryText) {
    topCategoryText.textContent = "This is the strongest lane currently visible across approved members and active applications on this device.";
  }

  if (topRegionEl) {
    topRegionEl.textContent = topRegion;
  }

  if (topRegionText) {
    topRegionText.textContent = "Regional signal updates as approved members and in-pipeline applicants expand the Federation footprint.";
  }

  if (overviewPrimaryAction) {
    if (state.type === "member") {
      overviewPrimaryAction.textContent = "Open Member Command";
      overviewPrimaryAction.setAttribute("data-jump", "#command");
    } else if (state.type === "applicant" && getCanApplyForCurrentState()) {
      overviewPrimaryAction.textContent = "Apply Again";
      overviewPrimaryAction.setAttribute("data-jump", "#apply");
    } else if (state.type === "applicant") {
      overviewPrimaryAction.textContent = "View My Access State";
      overviewPrimaryAction.setAttribute("data-jump", "#status");
    } else {
      overviewPrimaryAction.textContent = "Request Federation Access";
      overviewPrimaryAction.setAttribute("data-jump", "#apply");
    }
  }
}

function renderSectorExperience(selectedSector = activeSectorFilter) {
  const panel = qs("#sectorInsightPanel");
  const titleEl = qs("#sectorInsightTitle");
  const textEl = qs("#sectorInsightText");
  const membersEl = qs("#sectorInsightMembers");
  const applicantsEl = qs("#sectorInsightApplicants");
  const regionsEl = qs("#sectorInsightRegions");
  const statusEl = qs("#sectorInsightStatus");

  if (!panel) return;

  const sectorCopy = {
    all: {
      title: "All strategic lanes",
      text: "This view shows the Federation at full width across legal, policy, capital, media, security, and cross-industry operator lanes."
    },
    "Lawyers & Legal Strategists": {
      title: "Lawyers & Legal Strategists",
      text: "This lane strengthens contracts, negotiations, institutional trust, dispute handling, and legal shielding around serious operators."
    },
    "Politicians & Policy Advisors": {
      title: "Politicians & Policy Advisors",
      text: "This lane is about policy access, institutional context, state proximity, and people who understand power environments."
    },
    "Entrepreneurs & Investors": {
      title: "Entrepreneurs & Investors",
      text: "This lane compounds capital access, execution ability, founder leverage, and real deal flow."
    },
    "Influencers & Media Architects": {
      title: "Influencers & Media Architects",
      text: "This lane adds narrative leverage, audience reach, amplification, and perception shaping."
    },
    "Cybersecurity Experts": {
      title: "Cybersecurity Experts",
      text: "This lane protects the network through digital trust, defensive capability, security hygiene, and technical resilience."
    },
    "Operators Across Industries": {
      title: "Operators Across Industries",
      text: "This lane covers cross-sector connectors who can move introductions, logistics, expansion, and execution forward."
    }
  };

  const normalized = sectorCopy[selectedSector] ? selectedSector : "all";
  activeSectorFilter = normalized;

  const members = getMembers().filter((member) =>
    normalized === "all" ? true : member.category === normalized
  );

  const applications = getApplications().filter((application) =>
    normalized === "all" ? true : application.primaryCategory === normalized
  );

  const countriesTouched = uniqueValues(
    [...members, ...applications],
    (item) => item.country
  ).length;

  const laneStatus = members.length
    ? "Live"
    : applications.length
      ? "Pipeline"
      : "Open";

    const sectorSelect = qs("#sectorFilterSelect");
  if (sectorSelect) {
    sectorSelect.value = normalized;
  }

  qsa("[data-sector-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sectorFilter === normalized);
  });

  qsa(".fed-sector-card").forEach((card) => {
    const cardSector = card.dataset.sector || "";
    const isMatch = normalized === "all" || cardSector === normalized;
    card.classList.toggle("active", normalized !== "all" && cardSector === normalized);
    card.classList.toggle("is-dimmed", normalized !== "all" && !isMatch);
  });

  if (titleEl) titleEl.textContent = sectorCopy[normalized].title;
  if (textEl) textEl.textContent = sectorCopy[normalized].text;
  if (membersEl) membersEl.textContent = String(members.length);
  if (applicantsEl) applicantsEl.textContent = String(applications.length);
  if (regionsEl) regionsEl.textContent = String(countriesTouched);
  if (statusEl) statusEl.textContent = laneStatus;
}

function initSectorExperience() {
  const select = qs("#sectorFilterSelect");
  const grid = qs("#sectorGrid");

  if (select) {
    select.addEventListener("change", () => {
      const selected = select.value || "all";
      renderSectorExperience(selected);

      const target =
        qs("#sectorInsightPanel") ||
        qs(".fed-sector-card.active", grid) ||
        grid;

      if (target) {
        window.requestAnimationFrame(() => {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        });
      }
    });
  }

  if (grid) {
    grid.addEventListener("click", (event) => {
      const card = event.target.closest(".fed-sector-card[data-sector]");
      if (!card) return;

      renderSectorExperience(card.dataset.sector || "all");
    });
  }

  renderSectorExperience(activeSectorFilter);
}

function populateFilters() {
  const categoryFilter = qs("#categoryFilter");
  const countryFilter = qs("#countryFilter");

  if (!categoryFilter || !countryFilter) return;

  const members = getMembers();
  const categories = uniqueValues(members, (member) => member.category);
  const countries = uniqueValues(members, (member) => member.country);

  categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  countryFilter.innerHTML = '<option value="all">All Countries</option>';

  categories.forEach((category) => {
    const opt = document.createElement("option");
    opt.value = category;
    opt.textContent = category;
    categoryFilter.appendChild(opt);
  });

  countries.forEach((country) => {
    const opt = document.createElement("option");
    opt.value = country;
    opt.textContent = country;
    countryFilter.appendChild(opt);
  });
}

function renderDirectory(items = getMembers()) {
  const container = qs("#directoryGrid");
  if (!container) return;

  const mode = getDirectoryVisibilityMode();
  const visibleItems = items.map((member) => redactDirectoryMember(member, mode));

  if (!visibleItems.length) {
    container.innerHTML = `
      <div class="fed-member-card" style="grid-column: 1 / -1;">
        <div class="fed-member-name">No approved members yet</div>
        <p class="fed-member-desc">Use the local review fallback or change the current filters.</p>
      </div>
    `;
    return;
  }

  const leadCard =
    mode === "full"
      ? ""
      : `
        <article class="fed-member-card fed-member-card-callout" style="grid-column: 1 / -1;">
          <div class="fed-member-name">${
            mode === "partial" ? "Screened preview only" : "Protected member preview"
          }</div>
          <p class="fed-member-desc">${
            mode === "partial"
              ? "Your application is already in the pipeline. Full names, firms, and operating details unlock after approval."
              : "You are seeing a protected preview only. Full member details and direct operating visibility unlock after approval."
          }</p>
        </article>
      `;

  container.innerHTML =
    leadCard +
    visibleItems
      .map((member) => {
        const isRedacted = Boolean(member.__redacted);

        return `
          <article class="fed-member-card ${isRedacted ? "is-redacted" : ""}">
            <div class="fed-member-top">
              <div>
                <div class="fed-member-name">${escapeHtml(member.name)}</div>
                <div class="fed-member-role">${escapeHtml(member.role)}</div>
              </div>
              <div class="fed-member-badge">${escapeHtml(member.badge || "Approved")}</div>
            </div>

            <div class="fed-member-meta">
              <span>${escapeHtml(member.category)}</span>
              <span>${escapeHtml(member.country)}</span>
              <span>${escapeHtml(member.city)}</span>
              ${
                mode === "full"
                  ? `<span>${escapeHtml(member.company || "Independent")}</span>`
                  : ""
              }
            </div>

            <p class="fed-member-desc">${escapeHtml(member.description || "Approved Federation member.")}</p>

            ${
              isRedacted
                ? `<div class="fed-member-lock">Protected until approval</div>`
                : ""
            }
          </article>
        `;
      })
      .join("");
}

function applyDirectoryFilters() {
  const members = getMembers();
  const mode = getDirectoryVisibilityMode();
  const searchValue = String((qs("#memberSearch") && qs("#memberSearch").value) || "")
    .trim()
    .toLowerCase();
  const categoryValue = (qs("#categoryFilter") && qs("#categoryFilter").value) || "all";
  const countryValue = (qs("#countryFilter") && qs("#countryFilter").value) || "all";

  const filtered = members.filter((member) => {
    const visibleMember = mode === "full" ? member : redactDirectoryMember(member, mode);

    const haystack = [
      visibleMember.name,
      visibleMember.role,
      visibleMember.company,
      visibleMember.country,
      visibleMember.city,
      visibleMember.category,
      visibleMember.description
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchValue || haystack.includes(searchValue);
    const matchesCategory = categoryValue === "all" || visibleMember.category === categoryValue;
    const matchesCountry = countryValue === "all" || visibleMember.country === countryValue;

    return matchesSearch && matchesCategory && matchesCountry;
  });

  renderDirectory(filtered);
}

function initDirectory() {
  populateFilters();
  renderDirectory();

  ["#memberSearch", "#categoryFilter", "#countryFilter"].forEach((selector) => {
    const el = qs(selector);
    if (!el) return;

    el.addEventListener("input", applyDirectoryFilters);
    el.addEventListener("change", applyDirectoryFilters);
  });
}

let activeSectionId = "";
let activeSectorFilter = "all";

const FEDERATION_SECTION_LOADER_LABELS = {
  command: "Loading Command...",
  connect: "Loading Connect...",
  directory: "Loading Directory...",
  requests: "Loading My Requests...",
  referrals: "Loading Referrals...",
  status: "Loading My Access...",
  expansion: "Loading Expansion..."
};

function getFederationSectionLoaderLabel(sectionId = "") {
  const key = String(sectionId || "").replace(/^#/, "").trim();
  return FEDERATION_SECTION_LOADER_LABELS[key] || "Loading Federation...";
}

function showFederationTabLoader(sectionIdOrLabel = "Loading Federation...") {
  const loader = document.getElementById("yh-tab-loader");
  const text = document.getElementById("yh-tab-loader-text");

  const raw = String(sectionIdOrLabel || "").trim();
  const label = raw.startsWith("Loading ") ? raw : getFederationSectionLoaderLabel(raw);

  if (text) {
    text.textContent = label || "Loading Federation...";
  }

  if (!loader) return;

  loader.hidden = false;
  loader.setAttribute("aria-hidden", "false");

  window.requestAnimationFrame(() => {
    loader.classList.add("is-active");
  });
}

function hideFederationTabLoader() {
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

function extractSectionId(value = "") {
  return String(value || "").replace(/^#/, "").trim();
}

function getNavigableSectionIds() {
  return qsa(".fed-section[data-section]")
    .map((section) => String(section.id || "").trim())
    .filter(Boolean);
}

function getPreferredDefaultSection() {
  const state = getCurrentUserState();

  if (state.type === "member") return "command";
  if (state.type === "applicant") return "status";
  return "command";
}

function getSafeSectionId(targetId = "") {
  const sectionIds = getNavigableSectionIds();
  if (!sectionIds.length) return "";

  const preferred = extractSectionId(targetId);
  if (preferred && sectionIds.includes(preferred)) return preferred;

  const hashId = extractSectionId(window.location.hash);
  if (hashId && sectionIds.includes(hashId)) return hashId;

  const fallback = getPreferredDefaultSection();
  if (sectionIds.includes(fallback)) return fallback;

  return sectionIds[0];
}

function setActiveSection(targetId = "", options = {}) {
  const { syncHash = true, showLoader = true } = options;
  const nextSectionId = getSafeSectionId(targetId);

  if (!nextSectionId) return;

  const previousSectionId = activeSectionId || extractSectionId(window.location.hash) || "";
  const shouldShowLoader =
    showLoader !== false &&
    Boolean(previousSectionId) &&
    previousSectionId !== nextSectionId;

  if (shouldShowLoader) {
    showFederationTabLoader(nextSectionId);
  }

  activeSectionId = nextSectionId;
  document.body.dataset.fedNavMode = "tabs";

  qsa(".fed-section[data-section]").forEach((section) => {
    const isActive = section.id === nextSectionId;

    section.hidden = !isActive;
    section.setAttribute("aria-hidden", isActive ? "false" : "true");
    section.classList.toggle("is-active-panel", isActive);
    section.classList.toggle("is-panel-hidden", !isActive);
  });

  qsa(".fed-nav-link").forEach((link) => {
    link.classList.toggle(
      "active",
      extractSectionId(link.getAttribute("href")) === nextSectionId
    );
  });

  if (typeof window.__yhfCloseMobileMore === "function") {
    window.__yhfCloseMobileMore();
  }

  const quickMenu = qs("#fedTopbarQuick");
  if (quickMenu && quickMenu.open) {
    quickMenu.open = false;
  }

  const main = qs("#fedMain");
  if (main) {
    main.scrollTo({
      top: 0,
      behavior: "auto"
    });
  }

  if (nextSectionId === "expansion" && typeof window.__yhfRenderMapRoutes === "function") {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.__yhfRenderMapRoutes();
      });
    });
  }

  let loaderWaitsForAsync = false;

  if (nextSectionId === "connect" || nextSectionId === "requests") {
    loaderWaitsForAsync = true;

    loadFederationConnectData({ force: nextSectionId === "requests" })
      .catch((error) => {
        console.error("Federation Connect active-section load error:", error);
      })
      .finally(() => {
        if (shouldShowLoader) {
          window.setTimeout(hideFederationTabLoader, 160);
        }
      });
  }

  if (nextSectionId === "deal-rooms") {
    loaderWaitsForAsync = true;

    loadFederationServerState({ force: true })
      .then(() => {
        renderFederationDealRoomsSection();
      })
      .catch((error) => {
        console.error("Federation Deal Rooms active-section load error:", error);
      })
      .finally(() => {
        if (shouldShowLoader) {
          window.setTimeout(hideFederationTabLoader, 160);
        }
      });
  }

  if (syncHash && typeof history !== "undefined") {
    history.replaceState(null, "", `#${nextSectionId}`);
  }

  if (shouldShowLoader && !loaderWaitsForAsync) {
    window.requestAnimationFrame(() => {
      window.setTimeout(hideFederationTabLoader, 260);
    });
  }
}

function refreshActiveSection() {
  const preferred = activeSectionId || extractSectionId(window.location.hash);
  setActiveSection(preferred, { syncHash: Boolean(preferred), showLoader: false });
}

function initSectionNavigation() {
  document.body.dataset.fedNavMode = "tabs";

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-jump], a[href^='#']");
    if (!trigger) return;

    const rawTarget =
      trigger.getAttribute("data-jump") || trigger.getAttribute("href") || "";
    const targetId = extractSectionId(rawTarget);
    if (!targetId) return;

    const safeId = getSafeSectionId(targetId);
    if (!safeId) return;

    event.preventDefault();
    setActiveSection(safeId);
  });

  window.addEventListener("hashchange", () => {
    const hashId = extractSectionId(window.location.hash);
    if (!hashId) return;

    setActiveSection(hashId, { syncHash: false });
  });
}

function initMobileAppShell() {
  const toggle = qs("#fedMobileMoreToggle");
  const sheet = qs("#fedMobileMoreSheet");
  const backdrop = qs("#fedMobileMoreBackdrop");

  if (!toggle || !sheet || !backdrop) return;

  function setOpen(open) {
    document.body.classList.toggle("fed-mobile-more-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    sheet.hidden = !open;
    sheet.setAttribute("aria-hidden", open ? "false" : "true");
    backdrop.hidden = !open;
  }

  function closeSheet() {
    setOpen(false);
  }

  toggle.addEventListener("click", () => {
    const isOpen = document.body.classList.contains("fed-mobile-more-open");
    setOpen(!isOpen);
  });

  document.addEventListener("click", (event) => {
    const closeTrigger = event.target.closest("[data-fed-more-close]");
    if (closeTrigger) {
      closeSheet();
      return;
    }

    const moreLink = event.target.closest(".fed-app-more-link[href^='#']");
    if (moreLink) {
      closeSheet();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSheet();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      closeSheet();
    }
  });

  window.__yhfCloseMobileMore = closeSheet;
}

function initMapHover() {
  const overlayCity = qs(".fed-map-overlay-city");
  const overlayCountry = qs(".fed-map-overlay-country");
  const overlayMeta = qs("#mapOverlayMeta");
  const overlayTag = qs("#mapOverlayTag");
  const overlayLinkedCount = qs("#mapOverlayLinkedCount");
  const overlayTier = qs("#mapOverlayTier");
  const map = qs("#fedMap");
  const shell = map ? qs(".fed-map-shell", map) : null;
  const routeSvg = qs("#fedMapRoutes");
  const nodes = qsa(".fed-map-node");

  if (!overlayCity || !overlayCountry || !map || !shell || !routeSvg || !nodes.length) return;

  const routePairs = MAP_ROUTE_PAIRS;
  let activeNode = null;
  let resizeTimer = null;

  function getNodeKey(node) {
    return [...node.classList].find((className) => className.startsWith("node-")) || "";
  }

  function getNodeCenter(node) {
    const shellRect = shell.getBoundingClientRect();
    const rect = node.getBoundingClientRect();

    return {
      x: rect.left - shellRect.left + rect.width / 2,
      y: rect.top - shellRect.top + rect.height / 2
    };
  }

  function buildCurve(from, to, isStrong = false) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const horizontalDistance = Math.abs(dx);
    const direction = dx >= 0 ? 1 : -1;
    const curveLift = Math.max(
      26,
      Math.min(isStrong ? 54 : 92, horizontalDistance * (isStrong ? 0.14 : 0.24))
    );
    const c1x = from.x + horizontalDistance * (isStrong ? 0.22 : 0.28) * direction;
    const c2x = to.x - horizontalDistance * (isStrong ? 0.22 : 0.28) * direction;
    const c1y = from.y - curveLift;
    const c2y = to.y - curveLift + dy * 0.08;

    return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
  }

  function highlightRoutes(node) {
    const activeKey = node ? getNodeKey(node) : "";
    const routes = qsa(".fed-map-route", routeSvg);
    let linkedCount = 0;

    routes.forEach((route) => {
      const isLinked =
        activeKey &&
        (route.dataset.routeFrom === activeKey || route.dataset.routeTo === activeKey);

      route.classList.toggle("is-linked", Boolean(isLinked));
      route.classList.toggle("is-dimmed", Boolean(activeKey) && !isLinked);

      if (isLinked) linkedCount += 1;
    });

    return linkedCount;
  }

  function renderRoutes() {
    const shellRect = shell.getBoundingClientRect();
    if (!shellRect.width || !shellRect.height) return;

    routeSvg.setAttribute("viewBox", `0 0 ${shellRect.width} ${shellRect.height}`);

    routeSvg.innerHTML = routePairs
      .map(([fromClass, toClass, strength]) => {
        const fromNode = qs(`.${fromClass}`);
        const toNode = qs(`.${toClass}`);
        if (!fromNode || !toNode) return "";

        const from = getNodeCenter(fromNode);
        const to = getNodeCenter(toNode);
        const isStrong = strength === "strong";

        return `
          <path
            class="fed-map-route ${isStrong ? "is-strong" : ""}"
            data-route-from="${fromClass}"
            data-route-to="${toClass}"
            d="${buildCurve(from, to, isStrong)}"
          ></path>
        `;
      })
      .join("");

    highlightRoutes(activeNode);
  }

  function activateNode(node) {
    if (!node) return;

    activeNode = node;

    nodes.forEach((item) => {
      item.classList.toggle("is-active", item === node);
    });

    qsa(".fed-map-label", map).forEach((label) => {
      label.classList.toggle("is-active", label.classList.contains(`label-${node.dataset.nodeId}`));
    });

    const linkedCount = highlightRoutes(node);

    overlayCity.textContent = node.dataset.city || "Unknown";
    overlayCountry.textContent = [node.dataset.country, node.dataset.region]
      .filter(Boolean)
      .join(" • ") || "Regional cluster preview";

    if (overlayMeta) {
      overlayMeta.textContent =
        node.dataset.meta || "Strategic corridor details appear here.";
    }

    if (overlayTag) {
      overlayTag.textContent = node.dataset.code || "Live Node";
    }

    if (overlayLinkedCount) {
      overlayLinkedCount.textContent = `${linkedCount} linked corridor${linkedCount === 1 ? "" : "s"}`;
    }

    if (overlayTier) {
      overlayTier.textContent = node.dataset.tier || "Strategic node";
    }
  }

  nodes.forEach((node) => {
    ["mouseenter", "focus", "click"].forEach((eventName) => {
      node.addEventListener(eventName, () => activateNode(node));
    });
  });

  const handleResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderRoutes, 40);
  };

  window.__yhfRenderMapRoutes = renderRoutes;
  window.addEventListener("resize", handleResize);

  renderRoutes();
  activateNode(nodes[0]);
}

function showFormFeedback(message, type = "success") {
  const feedback = qs("#formFeedback");
  if (!feedback) return;

  feedback.textContent = message;
  feedback.classList.remove("success", "error");
  feedback.classList.add(type);
}

function showSessionFeedback(message, type = "success") {
  const feedback = qs("#sessionFeedback");
  if (!feedback) return;

  feedback.textContent = message;
  feedback.classList.remove("success", "error");
  feedback.classList.add(type);
}

function validateForm(form) {
  const requiredFields = [
    "fullName",
    "email",
    "country",
    "city",
    "primaryCategory",
    "role",
    "whyJoin",
    "valueBring"
  ];

  for (const fieldName of requiredFields) {
    const field = form.elements[fieldName];
    if (!field || !String(field.value).trim()) {
      return {
        valid: false,
        message: "Please complete all required fields before submitting."
      };
    }
  }

  if (!form.elements.declaration.checked) {
    return {
      valid: false,
      message: "You must confirm the declaration before submitting."
    };
  }

  return { valid: true };
}

function serializeForm(form) {
  const data = new FormData(form);
  const payload = {};

  data.forEach((value, key) => {
    payload[key] = typeof value === "string" ? value.trim() : value;
  });

  return payload;
}

function saveApplication(payload) {
  const applications = getApplications();
  const emailLower = normalizeEmail(payload.email);
  const submittedReferralCode = normalizeReferralCode(payload.referralCode);

  const existingMember = getMemberByEmail(emailLower);
  if (existingMember) {
    throw new Error("This email is already an approved Federation member.");
  }

  const existingActiveApplication = applications.find((application) => {
    if (normalizeEmail(application.email) !== emailLower) {
      return false;
    }

    return application.status !== "Rejected";
  });

  if (existingActiveApplication) {
    throw new Error("An active Federation application already exists for this email.");
  }

  let referringMember = null;

  if (submittedReferralCode) {
    referringMember = getMemberByReferralCode(submittedReferralCode);

    if (!referringMember) {
      throw new Error("Referral code not found. Check the code or leave it blank.");
    }

    if (normalizeEmail(referringMember.email) === emailLower) {
      throw new Error("You cannot use your own Federation referral code.");
    }
  }

  const nowIso = new Date().toISOString();
  const backgroundSummary = [
    payload.role,
    payload.company,
    payload.primaryCategory,
    [payload.city, payload.country].filter(Boolean).join(", ")
  ]
    .filter(Boolean)
    .join(" • ");

  const nextApplication = {
    ...payload,
    id: makeId("application"),
    name: payload.fullName,
    emailLower,
    division: "Federation",
    divisions: ["Federation"],
    recommendedDivision: "Federation",
    applicationType: "federation-access",
    goal: payload.whyJoin || "",
    background: backgroundSummary,
    networkValue: payload.valueBring || "",
    aiScore: Number(payload.aiScore || payload.federationScore || 0),
    federationScore: Number(payload.federationScore || payload.aiScore || 0),
    federationTier: String(payload.federationTier || "").trim(),
    federationTags: Array.isArray(payload.federationTags) ? payload.federationTags : [],
    strategicReadinessSnapshot:
      payload.strategicReadinessSnapshot && typeof payload.strategicReadinessSnapshot === "object"
        ? payload.strategicReadinessSnapshot
        : null,
    source: referringMember
      ? `Federation referral • ${referringMember.name}`
      : (payload.source || "Direct Federation application"),
    status: "Pending",
    createdAt: nowIso,
    updatedAt: nowIso,
    submittedAt: nowIso,
    referralCodeUsed: referringMember
      ? normalizeReferralCode(referringMember.referralCode)
      : "",
    referredBy: referringMember
      ? (payload.referredBy || referringMember.name || "")
      : (payload.referredBy || ""),
    referredByEmail: referringMember ? referringMember.email : "",
    referrerMemberId: referringMember ? referringMember.id : "",
    referralSource: referringMember
      ? "member-code"
      : (payload.referredBy ? "manual-name" : "direct")
  };

  applications.unshift(nextApplication);
  setApplications(applications);

  setCurrentUser({
    email: payload.email,
    fullName: payload.fullName,
    linkedApplicationId: nextApplication.id,
    referralCodeUsed: nextApplication.referralCodeUsed || ""
  });

  return nextApplication;
}
function getStatusBadgeClass(status) {
  const value = String(status || "Pending").toLowerCase().replace(/\s+/g, "-");
  return `is-${value}`;
}

function renderCurrentUserPanel() {
  const container = qs("#currentUserPanel");
  if (!container) return;

  const state = getCurrentUserState();
  const strategicNote = buildFederationStrategicReadinessNoteMarkup();

  if (state.type === "visitor") {
    container.innerHTML = `
      <article class="fed-state-card">
        <div class="fed-state-top">
          <div>
            <div class="fed-state-kicker">Current State</div>
            <h4>Visitor Mode</h4>
          </div>
          <span class="fed-state-badge is-visitor">Visitor</span>
        </div>
        <p class="fed-state-text">
          No active Federation session is linked to this browser yet. You can request access now,
          load a previous local YHF session by email, or preview the protected directory.
        </p>
        <div class="fed-state-points">
          <span>Can submit application</span>
          <span>Can view protected preview</span>
          <span>No private operating access yet</span>
        </div>
        ${strategicNote}
      </article>
    `;
    return;
  }

  if (state.type === "applicant") {
    const application = state.application;

    container.innerHTML = `
      <article class="fed-state-card">
        <div class="fed-state-top">
          <div>
            <div class="fed-state-kicker">Current State</div>
            <h4>${escapeHtml(application.fullName)}</h4>
          </div>
          <span class="fed-state-badge ${getStatusBadgeClass(application.status)}">${escapeHtml(application.status)}</span>
        </div>
        <p class="fed-state-text">
          Your application is stored locally on this device and is waiting inside the Federation review pipeline.
          While you are still an applicant, the directory stays partially protected and the command layer remains locked.
        </p>
        <div class="fed-state-meta">
          <span>${escapeHtml(application.primaryCategory)}</span>
          <span>${escapeHtml(application.country)}</span>
          <span>${escapeHtml(application.city)}</span>
          <span>${escapeHtml(application.email)}</span>
        </div>
        <div class="fed-state-grid">
          <div class="fed-state-metric">
            <strong>${escapeHtml(application.role || "N/A")}</strong>
            <small>Role</small>
          </div>
          <div class="fed-state-metric">
            <strong>${escapeHtml(application.company || "Independent")}</strong>
            <small>Organization</small>
          </div>
          <div class="fed-state-metric">
            <strong>${escapeHtml(application.createdAt ? new Date(application.createdAt).toLocaleDateString() : "N/A")}</strong>
            <small>Submitted</small>
          </div>
          <div class="fed-state-metric">
            <strong>${escapeHtml(application.referredBy || "Direct")}</strong>
            <small>Referral</small>
          </div>
        </div>
        ${buildStatusTimelineMarkup(application.status)}
        ${strategicNote}
      </article>
    `;
    return;
  }

  const member = state.member;
  const snapshot = getReferralSnapshotForMember(member);

  container.innerHTML = `
    <article class="fed-state-card fed-state-card-member">
      <div class="fed-state-top">
        <div>
          <div class="fed-state-kicker">Current State</div>
          <h4>${escapeHtml(member.name)}</h4>
        </div>
        <span class="fed-state-badge is-approved">Member</span>
      </div>
      <p class="fed-state-text">
        This profile is now part of the approved Federation member layer and appears inside the live beta directory.
        Your command layer and referral tools are now active in this browser session.
      </p>
      <div class="fed-state-meta">
        <span>${escapeHtml(member.category)}</span>
        <span>${escapeHtml(member.country)}</span>
        <span>${escapeHtml(member.city)}</span>
        <span>${escapeHtml(member.badge || "Approved")}</span>
      </div>
      <div class="fed-state-grid">
        <div class="fed-state-metric">
          <strong>${escapeHtml(member.role)}</strong>
          <small>Role</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(member.company || "Independent")}</strong>
          <small>Organization</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(member.approvedAt ? new Date(member.approvedAt).toLocaleDateString() : "N/A")}</strong>
          <small>Approved</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(member.referralCode || "N/A")}</strong>
          <small>Member code</small>
        </div>
      </div>
      <div class="fed-state-inline-note">
        Referral pipeline: ${escapeHtml(String(snapshot.total))} total, ${escapeHtml(String(snapshot.pending))} in review, ${escapeHtml(String(snapshot.approved))} approved.
      </div>
      ${strategicNote}
    </article>
  `;
}

function renderReferralSection() {
  const container = qs("#referralPanel");
  if (!container) return;

  const state = getCurrentUserState();

  if (state.type === "visitor") {
    container.innerHTML = `
      <article class="fed-referral-card">
        <div class="fed-sidebar-card-label">Referral System</div>
        <div class="fed-info-title">Referral tools unlock after approval</div>
        <p class="fed-referral-caption">
          Visitors can still apply directly, but member-level referral access only unlocks
          after approval. That keeps the pipeline traceable and the door-opening signal trustworthy.
        </p>
      </article>

      <article class="fed-referral-card">
        <div class="fed-sidebar-card-label">Why it exists</div>
        <div class="fed-info-title">Trusted context, not automatic entry</div>
        <p class="fed-referral-caption">
          A member referral does not skip review. It simply adds visible context around who opened the door
          and why the referred profile deserves serious attention.
        </p>
      </article>
    `;
    return;
  }

  if (state.type === "applicant") {
    const application = state.application;
    const referralLabel = application.referralCodeUsed
      ? `${application.referredBy || "Approved member"} • ${application.referralCodeUsed}`
      : (application.referredBy || "Direct / no member code");

    container.innerHTML = `
      <article class="fed-referral-card fed-referral-card-full">
        <div class="fed-sidebar-card-label">Application Referral State</div>
        <div class="fed-info-title">Your submission is already tied to this referral path</div>
        <p class="fed-referral-caption">
          If you entered with a valid member code, the link is stored below. If not,
          this remains a direct application and still follows the same review pipeline.
        </p>

        <div class="fed-referral-code fed-referral-code-static">
          <div class="fed-referral-code-main">
            <strong>${escapeHtml(referralLabel)}</strong>
            <div class="fed-form-inline-note is-valid">
              Current applicant state: ${escapeHtml(application.status || "Pending")}
            </div>
          </div>
        </div>
      </article>

      <article class="fed-referral-card">
        <div class="fed-sidebar-card-label">Pipeline Snapshot</div>
        <div class="fed-state-grid">
          <div class="fed-state-metric">
            <strong>${escapeHtml(application.status || "Pending")}</strong>
            <small>Status</small>
          </div>
          <div class="fed-state-metric">
            <strong>${escapeHtml(formatDate(application.createdAt))}</strong>
            <small>Submitted</small>
          </div>
          <div class="fed-state-metric">
            <strong>${escapeHtml(application.primaryCategory || "N/A")}</strong>
            <small>Category</small>
          </div>
          <div class="fed-state-metric">
            <strong>${escapeHtml(application.country || "N/A")}</strong>
            <small>Country</small>
          </div>
        </div>
      </article>

      <article class="fed-referral-card">
        <div class="fed-sidebar-card-label">What unlocks later</div>
        <p class="fed-referral-caption">
          Once approved, this same identity becomes a live Federation member with a reusable referral code,
          member command access, and stronger directory visibility.
        </p>
      </article>
    `;
    return;
  }

  const member = state.member;
  const snapshot = getReferralSnapshotForMember(member);
  const inviteUrl = buildReferralInviteUrl(snapshot.referralCode);

  const recentMarkup = snapshot.recent.length
    ? snapshot.recent
        .map(
          (application) => `
            <article class="fed-referral-item">
              <div class="fed-referral-item-top">
                <div>
                  <div class="fed-referral-item-name">${escapeHtml(application.fullName)}</div>
                  <div class="fed-referral-item-meta">${escapeHtml(application.role || application.primaryCategory || "Applicant")}</div>
                </div>
                <span class="fed-state-badge ${getStatusBadgeClass(application.status)}">${escapeHtml(application.status)}</span>
              </div>

              <div class="fed-member-meta">
                <span>${escapeHtml(application.country || "No country")}</span>
                <span>${escapeHtml(application.city || "No city")}</span>
                <span>${escapeHtml(formatDate(application.createdAt))}</span>
              </div>
            </article>
          `
        )
        .join("")
    : `
        <div class="fed-empty-block">
          No referred applications yet. Share your code only with serious people whose profile
          you are willing to have visibly tied back to your member identity.
        </div>
      `;

  container.innerHTML = `
    <article class="fed-referral-card fed-referral-card-full fed-referral-hero-card">
      <div class="fed-sidebar-card-label">Member Referral Access</div>
      <div class="fed-referral-hero-head">
        <div>
          <div class="fed-info-title">Your live Federation member code</div>
          <p class="fed-referral-caption">
            This code routes trusted people into the same review pipeline while preserving visible attribution back to you.
          </p>
        </div>
        <span class="fed-state-badge is-approved">Member Active</span>
      </div>

      <div class="fed-referral-code">
        <div class="fed-referral-code-main">
          <strong>${escapeHtml(snapshot.referralCode || "UNAVAILABLE")}</strong>
          <div class="fed-form-inline-note is-valid">
            Share selectively. Quality of referrals affects the quality of your lane.
          </div>
        </div>

        <div class="fed-referral-code-actions">
          <button
            type="button"
            class="fed-btn fed-btn-primary"
            data-referral-copy="${escapeHtml(snapshot.referralCode || "")}"
            data-label="Copy Code"
          >
            Copy Code
          </button>
          <button
            type="button"
            class="fed-btn fed-btn-secondary"
            data-referral-copy-link="${escapeHtml(snapshot.referralCode || "")}"
            data-label="Copy Invite Link"
          >
            Copy Invite Link
          </button>
        </div>
      </div>

      <div class="fed-referral-link-wrap">
        <label class="fed-referral-link-label" for="memberInviteLink">Invite Link</label>
        <input
          id="memberInviteLink"
          class="fed-referral-link-input"
          type="text"
          value="${escapeHtml(inviteUrl)}"
          readonly
        />
      </div>
    </article>

    <article class="fed-referral-card">
      <div class="fed-sidebar-card-label">Referral Snapshot</div>
      <div class="fed-referral-stat-grid">
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(snapshot.total))}</strong>
          <small>Total referred applications</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(snapshot.pending))}</strong>
          <small>In review</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(snapshot.shortlisted))}</strong>
          <small>Shortlisted</small>
        </div>
        <div class="fed-state-metric">
          <strong>${escapeHtml(String(snapshot.approved))}</strong>
          <small>Approved</small>
        </div>
      </div>
    </article>

    <article class="fed-referral-card">
      <div class="fed-sidebar-card-label">Member Reminder</div>
      <p class="fed-referral-caption">
        Use referrals for serious operators only. This is a credibility layer, not a mass-invite channel.
      </p>
    </article>

    <article class="fed-referral-card fed-referral-card-full">
      <div class="fed-referral-list-head">
        <div>
          <div class="fed-sidebar-card-label">Recent Referred Profiles</div>
          <div class="fed-info-title">Latest pipeline activity tied to your code</div>
        </div>
      </div>

      <div class="fed-referral-list">
        ${recentMarkup}
      </div>
    </article>
  `;
}
function renderApplyState() {
  const form = qs("#federationForm");
  const note = qs("#applyStateNote");
  const layout = qs("#applyLayout");

  if (!form || !note || !layout) return;

  const state = getCurrentUserState();

  note.hidden = true;
  form.hidden = false;
  layout.classList.remove("is-locked");

  if (state.type === "visitor") {
    return;
  }

  if (state.type === "applicant" && state.application.status === "Rejected") {
    note.hidden = false;
    note.textContent =
      "Your latest Federation application on this device is marked Rejected. You can submit a fresh application below for another review cycle.";
    return;
  }

  form.hidden = true;
  layout.classList.add("is-locked");
  note.hidden = false;

  if (state.type === "applicant") {
    note.textContent = `A Federation application already exists for ${state.application.email} with status: ${state.application.status}. This apply form stays locked until that current review path is finished.`;
    return;
  }

  note.textContent = `This browser session is already linked to approved member ${state.member.name}. The apply form is hidden because this user is already inside the Federation member layer.`;
}

function renderAdminSection() {
  const section = qs("#admin");
  const list = qs("#adminApplicationList");
  const totalEl = qs("#adminTotalApplications");
  const pendingEl = qs("#adminPendingApplications");
  const shortlistedEl = qs("#adminShortlistedApplications");
  const approvedEl = qs("#adminApprovedApplications");
  const toggle = qs("#adminModeToggle");

  if (!section || !list || !toggle) return;

  const enabled = isAdminModeEnabled();
  section.hidden = !enabled;
  toggle.textContent = `Local Review: ${enabled ? "On" : "Off"}`;
  toggle.classList.toggle("fed-btn-primary", enabled);
  toggle.classList.toggle("fed-btn-secondary", !enabled);

  const applications = getApplications();
  const pendingCount = applications.filter((application) =>
    ["Pending", "Under Review", "Screening"].includes(application.status)
  ).length;
  const shortlistedCount = applications.filter(
    (application) => application.status === "Shortlisted"
  ).length;
  const approvedCount = applications.filter(
    (application) => application.status === "Approved"
  ).length;

  if (totalEl) totalEl.textContent = String(applications.length);
  if (pendingEl) pendingEl.textContent = String(pendingCount);
  if (shortlistedEl) shortlistedEl.textContent = String(shortlistedCount);
  if (approvedEl) approvedEl.textContent = String(approvedCount);

  if (!applications.length) {
    list.innerHTML = `
      <article class="fed-admin-card">
        <div class="fed-admin-empty-title">No federation applications yet</div>
        <p class="fed-admin-empty-text">New submissions will appear here for local fallback review while YHF is still standalone.</p>
      </article>
    `;
    return;
  }

  list.innerHTML =
    `
      <div class="fed-note fed-admin-fallback-note">
        This queue is only a local fallback inside YHF. Final review ownership is intended to move into the central admin panel later.
      </div>
    ` +
    applications
      .map(
        (application) => `
          <article class="fed-admin-card">
            <div class="fed-admin-head">
              <div>
                <div class="fed-admin-name">${escapeHtml(application.fullName)}</div>
                <div class="fed-admin-role">${escapeHtml(application.role || "No role provided")}</div>
              </div>
              <span class="fed-state-badge ${getStatusBadgeClass(application.status)}">${escapeHtml(application.status)}</span>
            </div>

            <div class="fed-admin-meta">
              <span>${escapeHtml(application.primaryCategory || "Uncategorized")}</span>
              <span>${escapeHtml(application.country || "No country")}</span>
              <span>${escapeHtml(application.city || "No city")}</span>
              <span>${escapeHtml(application.email || "No email")}</span>
            </div>

            <p class="fed-admin-desc">${escapeHtml(buildMemberDescription(application))}</p>

            ${
              application.referralCodeUsed || application.referredBy
                ? `
                  <div class="fed-admin-meta">
                    <span>Referral Code: ${escapeHtml(application.referralCodeUsed || "Manual")}</span>
                    <span>Referrer: ${escapeHtml(application.referredBy || "Direct")}</span>
                  </div>
                `
                : ""
            }

            <div class="fed-admin-actions">
              <button type="button" class="fed-btn fed-btn-secondary" data-admin-action="pending" data-application-id="${escapeHtml(application.id)}">Set Pending</button>
              <button type="button" class="fed-btn fed-btn-secondary" data-admin-action="review" data-application-id="${escapeHtml(application.id)}">Under Review</button>
              <button type="button" class="fed-btn fed-btn-secondary" data-admin-action="screening" data-application-id="${escapeHtml(application.id)}">Screening</button>
              <button type="button" class="fed-btn fed-btn-secondary" data-admin-action="shortlist" data-application-id="${escapeHtml(application.id)}">Shortlist</button>
              <button type="button" class="fed-btn fed-btn-primary" data-admin-action="approve" data-application-id="${escapeHtml(application.id)}">Approve</button>
              <button type="button" class="fed-btn fed-btn-secondary" data-admin-action="reject" data-application-id="${escapeHtml(application.id)}">Reject</button>
            </div>
          </article>
        `
      )
      .join("");
}

function refreshFederationUI() {
  syncFederationChrome();
  renderStats();
  populateFilters();
  applyDirectoryFilters();
  renderCurrentUserPanel();
  renderMemberCommandSection();
  renderFederationConnectSection();
  renderFederationRequestsSection();
  renderReferralSection();
  refreshActiveSection();
}

function updateApplicationStatus(applicationId, nextStatus) {
  const applications = getApplications();
  const applicationIndex = applications.findIndex((application) => application.id === applicationId);

  if (applicationIndex < 0) return;

  const application = applications[applicationIndex];
  const existingMember = getMemberByEmail(normalizeEmail(application.email));

  const updatedApplication = {
    ...application,
    status: nextStatus,
    updatedAt: new Date().toISOString()
  };

  if (nextStatus === "Approved") {
    updatedApplication.approvedAt = new Date().toISOString();
    updatedApplication.generatedReferralCode =
      normalizeReferralCode(updatedApplication.generatedReferralCode) ||
      normalizeReferralCode(existingMember && existingMember.referralCode) ||
      createReferralCode(updatedApplication.fullName);

    const member = upsertMemberFromApplication(updatedApplication);
    updatedApplication.memberId = member.id;
  } else {
    removeMemberByEmail(normalizeEmail(updatedApplication.email));
    delete updatedApplication.memberId;
  }

  applications[applicationIndex] = updatedApplication;
  applications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  setApplications(applications);
  refreshFederationUI();
}

function initAdminModeToggle() {
  const toggle = qs("#adminModeToggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    setAdminMode(!isAdminModeEnabled());
    refreshFederationUI();
  });
}

function initAdminActions() {
  const list = qs("#adminApplicationList");
  if (!list) return;

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-action]");
    if (!button) return;

    const action = button.getAttribute("data-admin-action");
    const applicationId = button.getAttribute("data-application-id");

    if (!applicationId) return;

    if (action === "pending") {
      updateApplicationStatus(applicationId, "Pending");
      return;
    }

    if (action === "review") {
      updateApplicationStatus(applicationId, "Under Review");
      return;
    }

    if (action === "screening") {
      updateApplicationStatus(applicationId, "Screening");
      return;
    }

    if (action === "shortlist") {
      updateApplicationStatus(applicationId, "Shortlisted");
      return;
    }

    if (action === "approve") {
      updateApplicationStatus(applicationId, "Approved");
      return;
    }

    if (action === "reject") {
      updateApplicationStatus(applicationId, "Rejected");
    }
  });
}
function getFederationFormArray(form, name) {
  if (!form || !name) return [];

  const fields = Array.from(form.querySelectorAll(`[name="${name}"]`));
  const values = [];

  fields.forEach((field) => {
    const tag = String(field.tagName || "").toLowerCase();
    const type = String(field.type || "").toLowerCase();

    if (tag === "select" && field.multiple) {
      values.push(
        ...Array.from(field.selectedOptions || [])
          .map((option) => option.value)
          .filter(Boolean)
      );
      return;
    }

    if (type === "checkbox") {
      if (field.checked) values.push(field.value || "on");
      return;
    }

    const value = String(field.value || "").trim();
    if (value) values.push(value);
  });

  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function getFederationFormValue(form, name) {
  if (!form || !name) return "";

  const field = form.querySelector(`[name="${name}"]`);
  if (!field) return "";

  return String(field.value || "").trim();
}

function normalizeFederationApplicationPayload(raw = {}, form) {
  const strategic = getFederationApplicationStrategicSnapshot();

  const pullValue = (key) => {
    const fromForm = getFederationFormValue(form, key);
    if (fromForm) return fromForm;

    return String(raw[key] || "").trim();
  };

  const pullArray = (key) => {
    const fromForm = getFederationFormArray(form, key);
    if (fromForm.length) return fromForm;

    const rawValue = raw[key];

    if (Array.isArray(rawValue)) {
      return rawValue.map((item) => String(item || "").trim()).filter(Boolean);
    }

    return String(rawValue || "")
      .split(/[,|\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const roles = pullArray("roles");
  const activePlatforms = pullArray("activePlatforms");
  const openTo = pullArray("openTo");

  const role = roles[0] || pullValue("role") || strategic.role || "Federation Operator";
  const lookingFor = pullValue("lookingFor") || pullValue("whyJoin") || strategic.lookingForText;
  const canOffer = pullValue("canOffer") || pullValue("valueBring") || strategic.canOfferText;
  const wantsAccessTo = pullValue("wantsAccessTo") || pullValue("introductions");

  const profileLink =
    pullValue("profileLink") ||
    pullValue("linkedin") ||
    pullValue("website") ||
    pullValue("twitter");

  const federationTags = Array.from(new Set([
    ...pullArray("tags"),
    ...strategic.tags
  ])).slice(0, 8);

  return {
    ...raw,
    fullName: pullValue("fullName"),
    email: pullValue("email"),
    phone: pullValue("phone"),
    telegram: pullValue("telegram"),
    country: pullValue("country"),
    city: pullValue("city"),

    primaryCategory: pullValue("primaryCategory"),
    roles,
    role,
    profession: role,
    level: pullValue("level"),
    company: pullValue("company"),
    experience: pullValue("experience"),

    audienceSize: pullValue("audienceSize"),
    activePlatforms,
    capitalRange: pullValue("capitalRange"),
    teamSize: pullValue("teamSize"),
    skillLevel: pullValue("skillLevel"),

    lookingFor,
    canOffer,
    wantsAccessTo,
    openTo,

    opportunityInsight: pullValue("opportunityInsight") || strategic.federationReadinessCopy || strategic.opportunityCopy,
    tenKPlan: pullValue("tenKPlan"),
    openToFeature: pullValue("openToFeature"),

    linkedin: pullValue("linkedin"),
    website: pullValue("website"),
    twitter: pullValue("twitter"),
    profileLink,

    referralCode: normalizeReferralCode(pullValue("referralCode")),
    referralCodeUsed: normalizeReferralCode(pullValue("referralCode")),
    referredBy: pullValue("referredBy"),
    source: pullValue("source") || "Dashboard Federation Application",

    whyJoin: lookingFor,
    valueBring: canOffer,
    networkValue: canOffer,
    accessContribution: canOffer,
    introductions: wantsAccessTo,
    wantedContactReason: lookingFor,
    wantedContactTypesRaw: wantsAccessTo,
    contactTypesCanProvideRaw: canOffer,
    openToAdminMatching: openTo.length ? "yes" : "limited",

    aiScore: strategic.score,
    federationScore: strategic.score,
    federationTier: strategic.tier,
    federationTags,
    strategicReadinessSnapshot: strategic,

    federationProfileMap: {
      roles,
      role,
      primaryCategory: pullValue("primaryCategory"),
      level: pullValue("level"),
      audienceSize: pullValue("audienceSize"),
      activePlatforms,
      capitalRange: pullValue("capitalRange"),
      teamSize: pullValue("teamSize"),
      skillLevel: pullValue("skillLevel"),
      lookingFor,
      canOffer,
      wantsAccessTo,
      openTo,
      opportunityInsight: pullValue("opportunityInsight") || strategic.federationReadinessCopy || strategic.opportunityCopy,
      tenKPlan: pullValue("tenKPlan"),
      openToFeature: pullValue("openToFeature"),
      tags: federationTags,
      score: strategic.score,
      tier: strategic.tier,
      profileVersion: 1
    }
  };
}
function initForm() {
  const form = qs("#federationForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const validation = validateForm(form);
    if (!validation.valid) {
      showFormFeedback(validation.message, "error");
      return;
    }

    const payload = normalizeFederationApplicationPayload(serializeForm(form), form);
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || "Submit Federation Profile";

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
      }

      let applicationToStore = payload;

      try {
        const result = await federationConnectFetch("/api/federation/application", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        if (result?.application) {
          applicationToStore = result.application;
        }

        await loadFederationServerState({ force: true });
      } catch (serverError) {
        console.warn("Federation application server sync failed. Local fallback will be used:", serverError);
      }

      saveApplication(applicationToStore);

      showFormFeedback(
        "Application received. Your Federation profile has been added to the review pipeline.",
        "success"
      );

      form.reset();
      refreshFederationUI();
      setActiveSection("status");
    } catch (error) {
      console.error("Federation application save error:", error);
      showFormFeedback(
        error.message || "Something went wrong while saving your application.",
        "error"
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

function initSessionLookup() {
  const form = qs("#sessionLookupForm");
  const clearBtn = qs("#clearSessionBtn");

  if (!form || !clearBtn) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const sessionEmailField = form.elements.sessionEmail;
    const email = normalizeEmail(sessionEmailField ? sessionEmailField.value : "");

    if (!email) {
      showSessionFeedback("Enter an email address to load a saved beta state.", "error");
      return;
    }

    const member = getMemberByEmail(email);
    const application = getLatestApplicationByEmail(email);

    if (!member && !application) {
      showSessionFeedback(
        "No Federation beta profile was found for that email on this device.",
        "error"
      );
      return;
    }

    setCurrentUser({
      email,
      fullName: (member && member.name) || (application && application.fullName) || "Federation User"
    });

        showSessionFeedback("Federation beta state loaded for this browser session.", "success");
    refreshFederationUI();
    setActiveSection("status");
  });

  clearBtn.addEventListener("click", () => {
    clearCurrentUser();
    form.reset();
        showSessionFeedback("Current Federation session cleared for this browser.", "success");
    refreshFederationUI();
    setActiveSection("overview");
  });
}

function initReferralActions() {
  async function copyValue(button, value, successText = "Copied") {
    if (!button || !value) return;

    const originalText = button.dataset.label || button.textContent;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const tempInput = document.createElement("input");
        tempInput.value = value;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
      }

      button.textContent = successText;
    } catch (error) {
      console.error("Referral copy failed:", error);
      button.textContent = "Copy Failed";
    }

    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1400);
  }

  function selectInviteInput(input) {
    if (!input) return;

    input.focus({ preventScroll: true });

    try {
      input.select();
      if (typeof input.setSelectionRange === "function") {
        input.setSelectionRange(0, input.value.length);
      }
    } catch (error) {
      console.error("Invite input select failed:", error);
    }
  }

  document.addEventListener("click", async (event) => {
    const inviteInput = event.target.closest("#memberInviteLink");
    if (inviteInput) {
      selectInviteInput(inviteInput);
      return;
    }

    const copyCodeBtn = event.target.closest("[data-referral-copy]");
    if (copyCodeBtn) {
      const code = copyCodeBtn.getAttribute("data-referral-copy");
      await copyValue(copyCodeBtn, code, "Copied");
      return;
    }

    const copyLinkBtn = event.target.closest("[data-referral-copy-link]");
    if (copyLinkBtn) {
      const code = copyLinkBtn.getAttribute("data-referral-copy-link");
      const inviteUrl = buildReferralInviteUrl(code);
      await copyValue(copyLinkBtn, inviteUrl, "Link Copied");
    }
  });

  document.addEventListener("focusin", (event) => {
    const inviteInput = event.target.closest("#memberInviteLink");
    if (!inviteInput) return;

    window.requestAnimationFrame(() => {
      selectInviteInput(inviteInput);
    });
  });
}

function exposeHelpers() {
  window.YHFederation = {
    storageKeys: STORAGE_KEYS,
    getStoredApplications() {
      return getApplications();
    },
    getMembers() {
      return getMembers();
    },
    getCurrentUserState() {
      return getCurrentUserState();
    },
    getMemberByReferralCode(code) {
      return getMemberByReferralCode(code);
    },
    getReferralSnapshotByEmail(email) {
      const member = getMemberByEmail(normalizeEmail(email));
      return member ? getReferralSnapshotForMember(member) : null;
    },
    buildReferralInviteUrl(code) {
      return buildReferralInviteUrl(code);
    },
    enableAdminMode() {
      setAdminMode(true);
      refreshFederationUI();
    },
    disableAdminMode() {
      setAdminMode(false);
      refreshFederationUI();
    },
    clearCurrentUser() {
      clearCurrentUser();
      refreshFederationUI();
    },
    approveApplication(applicationId) {
      updateApplicationStatus(applicationId, "Approved");
    },
    shortlistApplication(applicationId) {
      updateApplicationStatus(applicationId, "Shortlisted");
    },
    rejectApplication(applicationId) {
      updateApplicationStatus(applicationId, "Rejected");
    }
  };
}
window.addEventListener("storage", (event) => {
  const watchedKeys = new Set([
    "yh_federation_access_status_v1",
    "yh_federation_ladder_outcome_v1",
    "yh_federation_applications",
    "yh_federation_members",
    "yh_admin_panel_state_v3_live"
  ]);

  if (!watchedKeys.has(String(event.key || ""))) return;

  window.requestAnimationFrame(() => {
    try {
      refreshFederationUI();
      updateFederationStrategicReadinessSurface();
    } catch (error) {
      console.error("federation storage ladder sync error:", error);
    }
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  ensureSeedMembers();

  initDirectory();
  initSectionNavigation();
  initMobileAppShell();
  initFederationConnect();
  initFederationRequests();
  initFederationDealRooms();
  initReferralActions();

  const bindUniverseReturnLink = (selector) => {
    const link = document.querySelector(selector);
    if (!link) return;

    link.addEventListener("click", (event) => {
      if (window.parent && window.parent !== window) {
        event.preventDefault();
        event.stopPropagation();

        try {
          window.parent.postMessage(
            { type: "yh:federation:return-to-universe" },
            window.location.origin
          );
        } catch (_) {
          window.top.location.href = "/dashboard";
        }
      }
    });
  };

  bindUniverseReturnLink("#fedBackToUniverse");
  bindUniverseReturnLink("#fedTopbarBackToUniverse");

  setActiveSection("command", { syncHash: false });

  await loadFederationServerState({ force: true });

  if (getCurrentUserState().type === "member") {
    await loadFederationConnectData({ force: true }).catch((error) => {
      console.error("Initial Federation Connect load error:", error);
    });

    await handleFederationCheckoutReturn().catch((error) => {
      console.error("Federation checkout return handler error:", error);
    });
  }

  refreshFederationUI();
  exposeHelpers();
});