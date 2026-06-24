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
const PLAZA_CONVERSATION_SEEN_KEY = "yhPlazaConversationSeenAtV1";
const PLAZA_CONVERSATION_SEEN_BOOTSTRAPPED_KEY = "yhPlazaConversationSeenBootstrappedV1";
const PLAZA_CONVERSATION_REFRESH_MS = 30000;
let plazaConversationAutoRefreshTimer = null;

function getPlazaRealtimeStoredToken() {
  try {
    return (
      sessionStorage.getItem("yh_token") ||
      localStorage.getItem("yh_token") ||
      sessionStorage.getItem("token") ||
      localStorage.getItem("token") ||
      ""
    ).trim();
  } catch (_) {
    return "";
  }
}

const plazaBusinessSocket =
  typeof io === "function"
    ? io({
        withCredentials: true,
        transports: ["websocket", "polling"],
        auth: getPlazaRealtimeStoredToken() ? { token: getPlazaRealtimeStoredToken() } : {}
      })
    : null;


const YH_CANONICAL_PLAZAS = [
  {
    id: "yh-africa-plaza-1",
    continent: "Africa",
    network: "Africa Federation",
    plazaNumber: 1,
    region: "Africa Plaza 1",
    label: "Africa • Plaza 1",
    sourceUrl: "https://www.younghustlers.net/plazas/africa-plaza",
    countries: ["Botswana", "Mauritius", "Namibia", "Seychelles"]
  },
  {
    id: "yh-africa-plaza-2",
    continent: "Africa",
    network: "Africa Federation",
    plazaNumber: 2,
    region: "Africa Plaza 2",
    label: "Africa • Plaza 2",
    sourceUrl: "https://www.younghustlers.net/plazas/africa-plaza",
    countries: ["Ghana", "Morocco", "Rwanda", "Senegal", "Zambia"]
  },
  {
    id: "yh-africa-plaza-3",
    continent: "Africa",
    network: "Africa Federation",
    plazaNumber: 3,
    region: "Africa Plaza 3",
    label: "Africa • Plaza 3",
    sourceUrl: "https://www.younghustlers.net/plazas/africa-plaza",
    countries: ["Benin", "Eswatini (Swaziland)", "Gabon", "Lesotho", "Malawi", "Tanzania", "Tunisia"]
  },
  {
    id: "yh-africa-plaza-4",
    continent: "Africa",
    network: "Africa Federation",
    plazaNumber: 4,
    region: "Africa Plaza 4",
    label: "Africa • Plaza 4",
    sourceUrl: "https://www.younghustlers.net/plazas/africa-plaza",
    countries: ["Algeria", "Côte d'Ivoire", "Egypt", "Ethiopia", "Kenya", "Liberia", "Madagascar", "Mozambique", "Nigeria", "South Africa", "Uganda"]
  },
  {
    id: "yh-africa-plaza-5",
    continent: "Africa",
    network: "Africa Federation",
    plazaNumber: 5,
    region: "Africa Plaza 5",
    label: "Africa • Plaza 5",
    sourceUrl: "https://www.younghustlers.net/plazas/africa-plaza",
    countries: ["Angola", "Burkina Faso", "Burundi", "Cameroon", "Central African Republic", "Chad", "Democratic Republic of the Congo", "Eritrea", "Libya", "Mali", "Niger", "Somalia", "South Sudan", "Sudan", "Zimbabwe"]
  },

  {
    id: "yh-asia-plaza-1",
    continent: "Asia",
    network: "Asian Network",
    plazaNumber: 1,
    region: "Asia Plaza 1",
    label: "Asia • Plaza 1",
    sourceUrl: "https://www.younghustlers.net/plazas/asia-plaza",
    countries: ["Japan", "Singapore", "South Korea", "Taiwan"]
  },
  {
    id: "yh-asia-plaza-2",
    continent: "Asia",
    network: "Asian Network",
    plazaNumber: 2,
    region: "Asia Plaza 2",
    label: "Asia • Plaza 2",
    sourceUrl: "https://www.younghustlers.net/plazas/asia-plaza",
    countries: ["Bhutan", "Brunei", "Malaysia", "Qatar", "United Arab Emirates"]
  },
  {
    id: "yh-asia-plaza-3",
    continent: "Asia",
    network: "Asian Network",
    plazaNumber: 3,
    region: "Asia Plaza 3",
    label: "Asia • Plaza 3",
    sourceUrl: "https://www.younghustlers.net/plazas/asia-plaza",
    countries: ["China", "Georgia", "Jordan", "Kazakhstan", "Kuwait", "Oman", "Saudi Arabia"]
  },
  {
    id: "yh-asia-plaza-4",
    continent: "Asia",
    network: "Asian Network",
    plazaNumber: 4,
    region: "Asia Plaza 4",
    label: "Asia • Plaza 4",
    sourceUrl: "https://www.younghustlers.net/plazas/asia-plaza",
    countries: ["Armenia", "Azerbaijan", "Bahrain", "Indonesia", "Israel", "Laos", "Lebanon", "Maldives", "Nepal", "Sri Lanka", "Thailand", "Uzbekistan", "Vietnam"]
  },
  {
    id: "yh-asia-plaza-5",
    continent: "Asia",
    network: "Asian Network",
    plazaNumber: 5,
    region: "Asia Plaza 5",
    label: "Asia • Plaza 5",
    sourceUrl: "https://www.younghustlers.net/plazas/asia-plaza",
    countries: ["Afghanistan", "Bangladesh", "Cambodia", "India", "Iran", "Iraq", "Myanmar (Burma)", "North Korea", "Pakistan", "Palestine", "Philippines", "Syria", "Tajikistan", "Turkmenistan", "Yemen"]
  },

  {
    id: "yh-latam-plaza-1",
    continent: "South America",
    network: "LATAM Network",
    plazaNumber: 1,
    region: "LATAM Plaza 1",
    label: "LATAM • Plaza 1",
    sourceUrl: "https://www.younghustlers.net/plazas/south-america-plaza",
    countries: ["Chile", "Uruguay", "Costa Rica", "Panamá", "Cuba"]
  },
  {
    id: "yh-latam-plaza-2",
    continent: "South America",
    network: "LATAM Network",
    plazaNumber: 2,
    region: "LATAM Plaza 2",
    label: "LATAM • Plaza 2",
    sourceUrl: "https://www.younghustlers.net/plazas/south-america-plaza",
    countries: ["Argentina", "Belize", "Brazil", "Colombia", "Dominican Republic", "Ecuador", "Guatemala", "Mexico", "Paraguay", "Peru"]
  },
  {
    id: "yh-latam-plaza-3",
    continent: "South America",
    network: "LATAM Network",
    plazaNumber: 3,
    region: "LATAM Plaza 3",
    label: "LATAM • Plaza 3",
    sourceUrl: "https://www.younghustlers.net/plazas/south-america-plaza",
    countries: ["Bolivia", "El Salvador", "Guyana", "Haiti", "Honduras", "Nicaragua", "Venezuela"]
  },

  {
    id: "yh-europe-plaza-1",
    continent: "Europe",
    network: "European Network",
    plazaNumber: 1,
    region: "Europe Plaza 1",
    label: "Europe • Plaza 1",
    sourceUrl: "https://www.younghustlers.net/plazas/europe-plaza",
    countries: ["Austria", "Denmark", "Finland", "Iceland", "Ireland", "Luxembourg", "Norway", "Switzerland"]
  },
  {
    id: "yh-europe-plaza-2",
    continent: "Europe",
    network: "European Network",
    plazaNumber: 2,
    region: "Europe Plaza 2",
    label: "Europe • Plaza 2",
    sourceUrl: "https://www.younghustlers.net/plazas/europe-plaza",
    countries: ["Portugal", "Slovenia", "Sweden", "Netherlands", "Germany", "Belgium"]
  },
  {
    id: "yh-europe-plaza-3",
    continent: "Europe",
    network: "European Network",
    plazaNumber: 3,
    region: "Europe Plaza 3",
    label: "Europe • Plaza 3",
    sourceUrl: "https://www.younghustlers.net/plazas/europe-plaza",
    countries: ["Croatia", "Czech Republic", "Estonia", "France", "Hungary", "Italy", "Latvia", "Lithuania", "Poland", "Slovakia", "Spain", "United Kingdom"]
  },
  {
    id: "yh-europe-plaza-4",
    continent: "Europe",
    network: "European Network",
    plazaNumber: 4,
    region: "Europe Plaza 4",
    label: "Europe • Plaza 4",
    sourceUrl: "https://www.younghustlers.net/plazas/europe-plaza",
    countries: ["Albania", "Bosnia and Herzegovina", "Bulgaria", "Cyprus", "Greece", "Montenegro", "North Macedonia", "Romania", "Serbia", "Turkey"]
  },
  {
    id: "yh-europe-plaza-5",
    continent: "Europe",
    network: "European Network",
    plazaNumber: 5,
    region: "Europe Plaza 5",
    label: "Europe • Plaza 5",
    sourceUrl: "https://www.younghustlers.net/plazas/europe-plaza",
    countries: ["Belarus", "Kosovo", "Moldova", "Russia", "Ukraine"]
  },

  {
    id: "yh-north-america-plaza-1",
    continent: "North America",
    network: "North American Network",
    plazaNumber: 1,
    region: "North America Plaza 1",
    label: "North America • Plaza 1",
    sourceUrl: "https://www.younghustlers.net/plazas/north-america-plaza",
    countries: ["United States of America"]
  },
  {
    id: "yh-north-america-plaza-2",
    continent: "North America",
    network: "North American Network",
    plazaNumber: 2,
    region: "North America Plaza 2",
    label: "North America • Plaza 2",
    sourceUrl: "https://www.younghustlers.net/plazas/north-america-plaza",
    countries: ["Canada"]
  },

  {
    id: "yh-oceania-plaza-1",
    continent: "Oceania",
    network: "Oceanian Network",
    plazaNumber: 1,
    region: "Oceania Plaza 1",
    label: "Oceania • Plaza 1",
    sourceUrl: "https://www.younghustlers.net/plazas/oceania-plaza",
    countries: ["Australia", "New Zealand", "Palau", "Samoa", "Tonga", "Tuvalu"]
  },
  {
    id: "yh-oceania-plaza-2",
    continent: "Oceania",
    network: "Oceanian Network",
    plazaNumber: 2,
    region: "Oceania Plaza 2",
    label: "Oceania • Plaza 2",
    sourceUrl: "https://www.younghustlers.net/plazas/oceania-plaza",
    countries: ["Fiji", "Kiribati", "Marshall Islands", "Micronesia", "Nauru", "Papua New Guinea", "Solomon Islands", "Vanuatu"]
  }
];
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

const PLAZA_REQUEST_AUTOSAVE_DELAY_MS = 1800;
const plazaRequestAutosaveState = {
  timer: null,
  inFlight: false,
  lastSignature: "",
  lastSavedRequestId: ""
};

let plazaServerMessagesLoaded = false;
let plazaServerMessages = [];
let plazaMessagesLoading = false;
let plazaBusinessMembersLoaded = false;
let plazaBusinessMembers = [];
let plazaBusinessMembersLoading = false;

let plazaServerMeetupsLoaded = false;
let plazaServerMeetups = [];
let plazaMeetupsLoading = false;

let plazaMyPatronApplicationLoaded = false;
let plazaMyPatronApplication = null;
let plazaPatronApplicationLoading = false;

let plazaPatronDeskLoaded = false;
let plazaPatronDeskLoading = false;
let plazaPatronDeskData = {
  isPatron: false,
  patron: null,
  regions: [],
  routedRequests: [],
  recommendations: [],
  payouts: [],
  walletPayouts: [],
  message: ""
};

function isCurrentUserApprovedPlazaPatron() {
  const application = plazaMyPatronApplication && typeof plazaMyPatronApplication === "object"
    ? plazaMyPatronApplication
    : null;

  const status = String(application?.status || "").trim().toLowerCase();

  return status === "approved";
}

const OBJECTIVE_OPTIONS = [
  "Connection request",
  "Introduction",
  "Collaboration",
  "Partnership",
  "Access",
  "Hiring",
  "Support",
  "Service Request",
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

const PLAZA_PATRON_BENEFIT_GROUPS = {
  status: [
    "Official Plaza Patron badge",
    "Featured profile inside assigned Plaza",
    "Priority placement in regional directory",
    "Visible leadership title on Atlas and Region Hub"
  ],
  control: [
    "Create and lead official Plaza meetups",
    "Host regional Plaza chat and welcome new members",
    "Pin coordination notes, meetup direction, and regional updates",
    "Route local requests, intros, opportunities, and collaboration signals"
  ],
  network: [
    "Access stronger members and verified connectors in the assigned Plaza",
    "Recommend high-value members for Federation review",
    "Coordinate with other Patrons across continents",
    "Escalate strong regional opportunities to higher-level network access"
  ],
  money: [
    "Earn commission from successful regional introductions",
    "Receive bonuses from verified connection outcomes",
    "Monetize official meetups, sponsorships, and premium local events",
    "Qualify for revenue share from paid Plaza features in the assigned region"
  ]
};

const PLAZA_PATRON_COMMISSION_POLICY = {
  introCommissionRange: "5%–15%",
  introCommissionLabel: "Connection commission",
  meetupRevenueShare: "Eligible",
  federationEscalationBonus: "Eligible after verified high-value handoff",
  note: "Final payout rules remain admin-controlled and can vary by deal, event, region, and verified outcome."
};
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

function getYHProfileInitials(name = "YH") {
  const parts = String(name || "YH")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "YH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function normalizeYHAvatarUrl(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return "";

  if (
    clean.startsWith("http://") ||
    clean.startsWith("https://") ||
    clean.startsWith("/") ||
    clean.startsWith("data:image/")
  ) {
    return clean;
  }

  return `/${clean.replace(/^\/+/, "")}`;
}

function getPlazaCardProfileTarget(item = {}, allowIdFallback = false) {
  const target = String(
    item.userId ||
    item.authorId ||
    item.authorUid ||
    item.ownerUid ||
    item.createdByUserId ||
    item.createdBy ||
    ""
  ).trim();

  if (target) return target;

  return allowIdFallback ? String(item.id || "").trim() : "";
}

function renderPlazaCardOwnerButton(item = {}, options = {}) {
  const targetUserId = String(
    options.targetUserId ||
    getPlazaCardProfileTarget(item, options.allowIdFallback === true)
  ).trim();

  const name = String(
    options.name ||
    item.authorName ||
    item.member ||
    item.name ||
    item.ownerName ||
    "YH Member"
  ).trim();

  const subtitle = String(
    options.subtitle ||
    item.role ||
    item.type ||
    item.tag ||
    item.region ||
    "YH Universe Member"
  ).trim();

  const avatar = normalizeYHAvatarUrl(
    options.avatar ||
    item.avatar ||
    item.authorAvatar ||
    item.profilePhoto ||
    item.photoURL ||
    item.ownerAvatar ||
    ""
  );

  const isClickable = Boolean(targetUserId);

  return `
    <button
      type="button"
      class="yh-card-owner ${isClickable ? "is-clickable" : "is-placeholder"}"
      ${isClickable ? `data-plaza-profile-id="${escapeHtml(targetUserId)}"` : "disabled aria-disabled=\"true\""}
      title="${isClickable ? `View ${escapeHtml(name)} profile` : "Profile unavailable"}"
    >
      <span class="yh-card-owner-avatar" aria-hidden="true">
        ${
          avatar
            ? `<img src="${escapeHtml(avatar)}" alt="">`
            : `<span>${escapeHtml(getYHProfileInitials(name))}</span>`
        }
      </span>

      <span class="yh-card-owner-meta">
        <strong>${escapeHtml(name)}</strong>
        <small>${escapeHtml(subtitle)}</small>
      </span>
    </button>
  `;
}

function getPlazaProfileFallbackItem(targetUserId = "") {
  const cleanId = String(targetUserId || "").trim();
  if (!cleanId) return null;

  const pools = [
    plazaServerDirectory,
    plazaServerFeedItems,
    plazaServerOpportunities,
    plazaServerRequests,
    plazaServerMessages
  ];

  for (const pool of pools) {
    const match = safeArray(pool).find((item) => {
      return (
        String(item.userId || "").trim() === cleanId ||
        String(item.authorId || "").trim() === cleanId ||
        String(item.authorUid || "").trim() === cleanId ||
        String(item.ownerUid || "").trim() === cleanId ||
        String(item.createdByUserId || "").trim() === cleanId ||
        String(item.id || "").trim() === cleanId
      );
    });

    if (match) return match;
  }

  return null;
}

function renderPlazaUniverseProfilePreview(profile = {}, fallbackItem = null) {
  const name = String(
    profile.fullName ||
    profile.displayName ||
    fallbackItem?.name ||
    fallbackItem?.authorName ||
    fallbackItem?.member ||
    "YH Member"
  ).trim();

  const avatar = normalizeYHAvatarUrl(
    profile.avatar ||
    profile.profilePhoto ||
    profile.photoURL ||
    fallbackItem?.avatar ||
    fallbackItem?.authorAvatar ||
    ""
  );

  const username = String(profile.username || "").replace(/^@+/, "");
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const signals = profile.signals || {};
  const lookingFor = safeArray(signals.lookingFor);
  const canOffer = safeArray(signals.canOffer);
  const tags = safeArray(signals.tags);

  return `
    <div class="yh-profile-preview">
      <div class="yh-profile-preview-cover">
        ${
          profile.coverPhoto
            ? `<img src="${escapeHtml(normalizeYHAvatarUrl(profile.coverPhoto))}" alt="">`
            : ""
        }
      </div>

      <div class="yh-profile-preview-main">
        <div class="yh-profile-preview-avatar">
          ${
            avatar
              ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}">`
              : `<span>${escapeHtml(getYHProfileInitials(name))}</span>`
          }
        </div>

        <div>
          <h4>${escapeHtml(name)}</h4>
          <p>${escapeHtml(username ? `@${username}` : profile.trustTier || "YH Universe Member")}</p>
        </div>
      </div>

      <p class="yh-profile-preview-bio">
        ${escapeHtml(profile.bio || fallbackItem?.focus || fallbackItem?.text || "No profile bio added yet.")}
      </p>

      <div class="yh-profile-preview-meta">
        ${location ? `<span>${escapeHtml(location)}</span>` : ""}
        ${profile.trustTier ? `<span>${escapeHtml(profile.trustTier)}</span>` : ""}
        ${signals.availability ? `<span>${escapeHtml(signals.availability)}</span>` : ""}
        ${signals.workMode ? `<span>${escapeHtml(signals.workMode)}</span>` : ""}
      </div>

      ${
        lookingFor.length
          ? `
            <div class="yh-profile-preview-signal">
              <strong>Looking For</strong>
              <div>${lookingFor.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}</div>
            </div>
          `
          : ""
      }

      ${
        canOffer.length
          ? `
            <div class="yh-profile-preview-signal">
              <strong>Can Offer</strong>
              <div>${canOffer.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}</div>
            </div>
          `
          : ""
      }

      ${
        tags.length
          ? `
            <div class="yh-profile-preview-signal">
              <strong>Tags</strong>
              <div>${tags.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}</div>
            </div>
          `
          : ""
      }
    </div>
  `;
}

async function openPlazaUniverseProfileFromCard(targetUserId = "") {
  const cleanId = String(targetUserId || "").trim();

  if (!cleanId) {
    showToast("This card has no linked profile yet.");
    return;
  }

  const fallbackItem = getPlazaProfileFallbackItem(cleanId);

  openModal({
    kicker: "YH Universe Profile",
    title: "Loading profile...",
    bodyHtml: `<div class="yh-plaza-modal-copy">Loading unified YH profile...</div>`
  });

  try {
    const result = await plazaApiFetch(`/api/universe/profile/${encodeURIComponent(cleanId)}`);
    const profile = result.profile || {};

    if (plazaModalTitle) {
      plazaModalTitle.textContent =
        profile.fullName ||
        profile.displayName ||
        fallbackItem?.name ||
        fallbackItem?.member ||
        "YH Universe Profile";
    }

    if (plazaModalBody) {
      plazaModalBody.innerHTML = renderPlazaUniverseProfilePreview(profile, fallbackItem);
    }
  } catch (error) {
    console.error("openPlazaUniverseProfileFromCard error:", error);

    if (plazaModalTitle) {
      plazaModalTitle.textContent = "Profile unavailable";
    }

    if (plazaModalBody) {
      plazaModalBody.innerHTML = `
        <div class="yh-plaza-modal-copy">
          ${escapeHtml(error.message || "Could not load this profile yet.")}
        </div>
      `;
    }
  }
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
  const type = String(item.type || "").trim().toLowerCase();

  if (type === "service listing") return "Request Service";
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
  const type = String(item.type || "").trim().toLowerCase();

  if (type === "service listing") return "Service Request";
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
    item.serviceCategory,
    item.servicePriceType ? `Price: ${titleCase(item.servicePriceType)}` : "",
    item.serviceDeliveryTime ? `Delivery: ${item.serviceDeliveryTime}` : "",
    ...safeArray(item.serviceTags),
    item.academySignalLabel,
    getPlazaOpportunityPaymentStatusChip(item)
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
    source ? `Source: ${source}` : "",
    item.serviceCategory ? `Service category: ${item.serviceCategory}` : "",
    item.servicePriceType ? `Service pricing: ${titleCase(item.servicePriceType)}` : "",
    item.serviceDeliveryTime ? `Delivery time: ${item.serviceDeliveryTime}` : ""
  ]
    .filter(Boolean)
    .join(" • ");
}
function renderPlazaOpportunityServicePanel(item = {}) {
  const type = String(item.type || "").trim().toLowerCase();
  const hasServiceData =
    type === "service listing" ||
    item.serviceCategory ||
    safeArray(item.serviceTags).length ||
    item.servicePriceType ||
    item.serviceDeliveryTime ||
    item.serviceOutcome ||
    item.serviceRequirements;

  if (!hasServiceData) return "";

  return `
    <div class="yh-plaza-card-note">
      <strong>Service Listing:</strong>
      ${
        item.serviceCategory
          ? `Category: ${escapeHtml(item.serviceCategory)}. `
          : ""
      }
      ${
        item.servicePriceType
          ? `Pricing: ${escapeHtml(titleCase(item.servicePriceType))}. `
          : ""
      }
      ${
        item.serviceDeliveryTime
          ? `Delivery: ${escapeHtml(item.serviceDeliveryTime)}. `
          : ""
      }
      ${
        safeArray(item.serviceTags).length
          ? `Tags: ${escapeHtml(safeArray(item.serviceTags).join(", "))}. `
          : ""
      }
      ${
        item.serviceOutcome
          ? `<br><span><strong>Outcome:</strong> ${escapeHtml(item.serviceOutcome)}</span>`
          : ""
      }
      ${
        item.serviceRequirements
          ? `<br><span><strong>Requirements:</strong> ${escapeHtml(item.serviceRequirements)}</span>`
          : ""
      }
    </div>
  `;
}
function renderPlazaOpportunityEconomyPanel(item = {}) {
  const moneyRange = formatPlazaMoneyRange(item);
  const commission = getPlazaOpportunityCommissionLabel(item);
  const escalation = getPlazaOpportunityEscalationLabel(item);
  const source = getPlazaOpportunitySourceLabel(item);
  const note = String(item.monetizationNote || "").trim();
  const economyMode = String(item.economyMode || "not_sure").trim().toLowerCase();
  const hasInternalTransactionContext = ["paid", "commission", "revenue_share", "bounty", "equity"].includes(economyMode) || Boolean(item.paymentLedgerId);

  if (!moneyRange && !commission && !escalation && !note && !hasInternalTransactionContext) {
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

      ${renderPlazaOpportunityPaymentSummary(item)}
      ${renderPlazaOpportunityInternalTransactionJustification(item)}

      ${
        note
          ? `<div class="yh-plaza-economy-note">${escapeHtml(note)}</div>`
          : ""
      }
    </div>
  `;
}
function buildPlazaOpportunityRequestRoutingMeta(item = {}, sourceType = "opportunity", objective = "Connection request") {
  const type = String(item.type || "").trim().toLowerCase();
  const providerId = String(
    item.authorId ||
    item.userId ||
    item.ownerUid ||
    item.createdByUserId ||
    ""
  ).trim();

  const providerName = String(
    item.authorName ||
    item.ownerName ||
    item.member ||
    item.name ||
    ""
  ).trim();

  const serviceCategory = String(item.serviceCategory || "").trim();
  const serviceTags = safeArray(item.serviceTags)
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 12);

  const isService = type === "service listing" || objective === "Service Request";

  const routeKey =
    isService
      ? "service_request"
      : sourceType === "federation-escalation"
        ? "federation_escalation"
        : objective === "Hiring"
          ? "plaza_hiring"
          : objective === "Regional connection"
            ? "regional_connection"
            : objective === "Bridge request"
              ? "bridge_request"
              : "plaza_request";

  const routeLabel =
    isService
      ? `Service request • ${serviceCategory || item.title || "Plaza service"}`
      : sourceType === "federation-escalation"
        ? `Federation escalation • ${item.title || "Opportunity"}`
        : objective === "Hiring"
          ? `Hiring route • ${item.title || "Opportunity"}`
          : `${objective} • ${item.title || "Plaza request"}`;

  return {
    providerId,
    providerName,
    serviceCategory,
    serviceTags: serviceTags.join(", "),
    serviceProviderType: String(item.serviceProviderType || "").trim(),
    servicePriceType: String(item.servicePriceType || "").trim(),
    serviceDeliveryTime: String(item.serviceDeliveryTime || "").trim(),
    requestIntent: isService ? "request_service" : "respond_to_opportunity",
    requestPriority: sourceType === "federation-escalation" ? "high" : "normal",
    routeKey,
    routeLabel,
    matchingStatus: "queued_for_review",
    matchingPriority: sourceType === "federation-escalation" ? "high" : "normal"
  };
}
function buildPlazaOpportunityRequestMessage(item = {}) {
  const type = String(item.type || item.tag || "opportunity").trim();
  const region = String(item.region || "Global").trim();
  const title = String(item.title || "this opportunity").trim();
  const economyContext = buildPlazaOpportunityEconomyContext(item);
  const note = String(item.monetizationNote || "").trim();

  return [
    String(item.type || "").trim().toLowerCase() === "service listing"
      ? `I want to request this service inside Plaza: ${title}.`
      : `I want to respond to this ${type.toLowerCase()} inside Plaza: ${title}.`,
    region ? `Region: ${region}.` : "",
    economyContext ? `Economy context: ${economyContext}.` : "",
    item.serviceOutcome ? `Expected outcome: ${item.serviceOutcome}.` : "",
    item.serviceRequirements ? `Provider requirements: ${item.serviceRequirements}.` : "",
    note ? `Monetization note: ${note}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function isDashboardInlinePlazaEmbed() {
  try {
    if (window.self !== window.top) return true;
  } catch (_) {
    return true;
  }

  try {
    return String(document.referrer || "").includes("/dashboard");
  } catch (_) {
    return false;
  }
}

function isExpectedPlazaInlineFetchFailure(error = {}) {
  const message = String(error?.message || "").toLowerCase();

  return (
    isDashboardInlinePlazaEmbed() &&
    (
      error?.isNetworkFetchFailure === true ||
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed")
    )
  );
}

async function plazaApiFetch(path, options = {}) {
  try {
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
  } catch (error) {
    error.isNetworkFetchFailure = error instanceof TypeError || String(error?.message || "").toLowerCase().includes("failed to fetch");
    error.plazaApiPath = path;
    throw error;
  }
}

function normalizeServerFeedItem(item, index = 0) {
  return normalizeFeedItem({
    id: item?.id || `server-feed-${index + 1}`,
    type: item?.type || "introduction",
    userId: item?.userId || item?.authorId || item?.createdByUserId || "",
    authorId: item?.authorId || item?.userId || item?.createdByUserId || "",
    authorName: item?.authorName || item?.member || "Hustler",
    authorAvatar: item?.authorAvatar || item?.avatar || item?.profilePhoto || item?.photoURL || "",
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
    if (!isExpectedPlazaInlineFetchFailure(error)) {
      console.error("loadPlazaFeedFromServer error:", error);
    }

    if (isExpectedPlazaInlineFetchFailure(error)) {
      plazaServerFeedItems = [];
      plazaServerFeedLoaded = true;
      renderFeed(plazaRuntime.feedFilter || "all");
      return [];
    }

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

    serviceCategory: item?.serviceCategory || "",
    serviceTags: Array.isArray(item?.serviceTags) ? item.serviceTags : [],
    servicePriceType: item?.servicePriceType || "custom_quote",
    serviceDeliveryTime: item?.serviceDeliveryTime || "",
    serviceProviderType: item?.serviceProviderType || "",
    serviceRequirements: item?.serviceRequirements || "",
    serviceOutcome: item?.serviceOutcome || "",

    userId: item?.userId || item?.authorId || item?.ownerUid || item?.createdByUserId || "",
    authorId: item?.authorId || item?.userId || item?.ownerUid || item?.createdByUserId || "",
    authorName: item?.authorName || item?.ownerName || "Plaza Member",
    authorAvatar: item?.authorAvatar || item?.avatar || item?.profilePhoto || item?.photoURL || item?.ownerAvatar || "",

    sourceDivision: item?.sourceDivision || "plaza",
    sourceLeadId: item?.sourceLeadId || "",

    pricingAmount: item?.pricingAmount || item?.amount || item?.price || 0,
    paymentLedgerId: item?.paymentLedgerId || "",
    paymentLedgerStatus: item?.paymentLedgerStatus || "",
    paymentStatus: item?.paymentStatus || "",
    dealStatus: item?.dealStatus || "",
    platformCommissionAmount: item?.platformCommissionAmount || 0,
    operatorPayoutAmount: item?.operatorPayoutAmount || 0,
    paymentProviderOptions: Array.isArray(item?.paymentProviderOptions)
      ? item.paymentProviderOptions
      : [],

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
    if (!isExpectedPlazaInlineFetchFailure(error)) {
      console.error("loadPlazaOpportunitiesFromServer error:", error);
    }

    if (isExpectedPlazaInlineFetchFailure(error)) {
      plazaServerOpportunities = [];
      plazaServerOpportunitiesLoaded = true;
      renderOpportunities();
      return [];
    }

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

function getPlazaOpportunityById(id = "") {
  const cleanId = String(id || "").trim();
  if (!cleanId) return null;

  const serverItem = plazaServerOpportunities.find((item) => {
    return String(item.id || "").trim() === cleanId;
  });

  if (serverItem) return serverItem;

  return plazaAdapter.getOpportunityById(cleanId) || null;
}

function getPlazaOpportunityDefaultAmount(item = {}) {
  const amount = Number(
    item.pricingAmount ||
    item.price ||
    item.amount ||
    item.budgetAmount ||
    item.budgetMax ||
    item.budgetMin ||
    0
  );

  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function getPlazaOpportunityPaymentStatusLabel(item = {}) {
  const paymentStatus = String(item.paymentStatus || "").trim().toLowerCase();
  const ledgerStatus = String(item.paymentLedgerStatus || "").trim().toLowerCase();

  if (paymentStatus === "paid" || ledgerStatus === "paid") return "Paid";
  if (ledgerStatus === "draft") return "Ledger Draft";
  if (item.paymentLedgerId) return "Ledger Created";

  return "Not Started";
}
function getPlazaOpportunityPaymentStatusChip(item = {}) {
  const label = getPlazaOpportunityPaymentStatusLabel(item);

  if (label === "Paid") return "Payment Paid";
  if (label === "Ledger Draft") return "Payment Draft";
  if (label === "Ledger Created") return "Payment Ledger";

  return "";
}

function getPlazaOpportunityGrossAmount(item = {}) {
  return normalizePlazaMoneyValue(
    item.pricingAmount ||
    item.amount ||
    item.price ||
    item.budgetAmount ||
    item.budgetMax ||
    item.budgetMin ||
    0
  );
}

function getPlazaOpportunityCommissionAmount(item = {}) {
  const explicitCommission = normalizePlazaMoneyValue(item.platformCommissionAmount);

  if (explicitCommission) return explicitCommission;

  const gross = getPlazaOpportunityGrossAmount(item);
  const rate = Number(item.commissionRate || 0);

  if (!gross || !rate) return 0;

  const normalizedRate = rate > 1 ? rate / 100 : rate;
  return Math.round(gross * normalizedRate * 100) / 100;
}

function getPlazaOpportunityOperatorPayoutAmount(item = {}) {
  const explicitPayout = normalizePlazaMoneyValue(item.operatorPayoutAmount);

  if (explicitPayout) return explicitPayout;

  const gross = getPlazaOpportunityGrossAmount(item);
  const commission = getPlazaOpportunityCommissionAmount(item);

  return Math.max(0, Math.round((gross - commission) * 100) / 100);
}
function getPlazaTransactionSafetyReminderCopy() {
  return [
    "For user flexibility, parties may arrange transactions outside YH Universe.",
    "However, off-platform transactions are not verified, protected, or settled by YH Universe.",
    "Any loss, fraud, failed delivery, illegal activity, chargeback, or dispute arising from an external arrangement remains the sole responsibility of the parties involved.",
    "For safer recordkeeping, use the internal Plaza ledger and admin verification flow whenever possible."
  ].join(" ");
}

function renderPlazaTransactionSafetyReminder() {
  return `
    <div class="yh-plaza-card-note">
      <strong>Transaction Safety Reminder:</strong>
      ${escapeHtml(getPlazaTransactionSafetyReminderCopy())}
    </div>
  `;
}
function renderPlazaOpportunityPaymentSummary(item = {}) {
  const statusLabel = getPlazaOpportunityPaymentStatusLabel(item);
  const gross = getPlazaOpportunityGrossAmount(item);
  const commission = getPlazaOpportunityCommissionAmount(item);
  const operatorPayout = getPlazaOpportunityOperatorPayoutAmount(item);
  const currency = String(item.currency || "USD").trim().toUpperCase() || "USD";

  if (!item.paymentLedgerId && !gross && statusLabel === "Not Started") {
    return "";
  }

  return `
    <div class="yh-plaza-card-note yh-plaza-card-note-strong">
      Payment Status: ${escapeHtml(statusLabel)}
      ${item.paymentLedgerId ? ` • Ledger: ${escapeHtml(item.paymentLedgerId)}` : ""}
    </div>

    <div class="yh-plaza-economy-grid">
      <div class="yh-plaza-economy-item">
        <small>Gross Deal</small>
        <strong>${escapeHtml(formatPlazaCurrencyAmount(gross, currency) || `${currency} 0`)}</strong>
      </div>

      <div class="yh-plaza-economy-item">
        <small>YH Commission</small>
        <strong>${escapeHtml(formatPlazaCurrencyAmount(commission, currency) || `${currency} 0`)}</strong>
      </div>

      <div class="yh-plaza-economy-item">
        <small>Operator Payout</small>
        <strong>${escapeHtml(formatPlazaCurrencyAmount(operatorPayout, currency) || `${currency} 0`)}</strong>
      </div>

      <div class="yh-plaza-economy-item">
        <small>Provider</small>
        <strong>${escapeHtml(safeArray(item.paymentProviderOptions).join(", ") || "Manual / Ledger")}</strong>
      </div>
    </div>

    ${renderPlazaTransactionSafetyReminder()}
  `;
}
function getPlazaOpportunityInternalTransactionJustification(item = {}) {
  const economyMode = String(item.economyMode || "not_sure").trim().toLowerCase();
  const statusLabel = getPlazaOpportunityPaymentStatusLabel(item);
  const hasLedger = Boolean(item.paymentLedgerId);
  const gross = getPlazaOpportunityGrossAmount(item);
  const operatorPayout = getPlazaOpportunityOperatorPayoutAmount(item);
  const currency = String(item.currency || "USD").trim().toUpperCase() || "USD";

  const isMonetizedPath =
    hasLedger ||
    gross > 0 ||
    ["paid", "commission", "revenue_share", "bounty", "equity"].includes(economyMode);

  if (!isMonetizedPath) {
    return null;
  }

  const payoutCopy = operatorPayout
    ? `${formatPlazaCurrencyAmount(operatorPayout, currency)} is reserved as the provider/operator payout once payment is confirmed.`
    : "The provider/operator payout is calculated after the deal amount and YH commission are set.";

  return {
    title: "Internal Plaza Transaction",
    statusLabel,
    text: [
      "This is not a public checkout flow. It is an internal Plaza ledger used to track a deal between a service seeker and a trusted Academy member or service provider.",
      "The seeker creates the ledger, YH/Admin verifies the real payment, then the provider payout becomes available in Wallet under Plaza.",
      payoutCopy
    ].join(" ")
  };
}

function renderPlazaOpportunityInternalTransactionJustification(item = {}) {
  const context = getPlazaOpportunityInternalTransactionJustification(item);

  if (!context) return "";

  return `
    <div class="yh-plaza-economy-note">
      <strong>${escapeHtml(context.title)}:</strong>
      ${escapeHtml(context.text)}
      <br>
      <span>Status: ${escapeHtml(context.statusLabel)}</span>
    </div>
  `;
}
function refreshPlazaWalletAfterMonetization() {
  try {
    localStorage.setItem(
      "yh_wallet_needs_refresh_v1",
      JSON.stringify({
        source: "plaza",
        reason: "plaza_opportunity_payment",
        updatedAt: new Date().toISOString()
      })
    );
  } catch (_) {}

  if (typeof window.refreshYHWalletSnapshot === "function") {
    window.refreshYHWalletSnapshot(true).catch(() => {});
  }
}

async function createPlazaOpportunityPaymentLedger(opportunityId = "", payload = {}) {
  const cleanId = String(opportunityId || "").trim();

  if (!cleanId) {
    throw new Error("Missing Plaza opportunity id.");
  }

  const result = await plazaApiFetch(`/api/payments/plaza/opportunities/${encodeURIComponent(cleanId)}/ledger`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const current = getPlazaOpportunityById(cleanId) || {};
  const updatedOpportunity = result.opportunity
    ? normalizeServerOpportunityItem({
        ...current,
        ...result.opportunity,
        id: cleanId
      })
    : null;

  if (updatedOpportunity) {
    plazaServerOpportunities = [
      updatedOpportunity,
      ...plazaServerOpportunities.filter((item) => item.id !== cleanId)
    ];
    plazaServerOpportunitiesLoaded = true;
    renderOpportunities();
  }

  await loadPlazaOpportunitiesFromServer({ silent: true }).catch(() => null);
  refreshPlazaWalletAfterMonetization();

  return result;
}

function openPlazaOpportunityPaymentModal(opportunityId = "", mode = "draft") {
  const item = getPlazaOpportunityById(opportunityId);

  if (!item) {
    showToast("Plaza opportunity not found.");
    return;
  }

  if (mode === "manual_paid") {
    showToast("Manual paid settlement is now handled by Admin inside the Economy panel.");
    return;
  }

  const defaultAmount = getPlazaOpportunityDefaultAmount(item);
  const defaultCurrency = String(item.currency || "USD").trim().toUpperCase() || "USD";
  const defaultCommission = Number(item.commissionRate || 0.2);
  const isPaidMode = false;

  openModal({
    kicker: isPaidMode ? "Manual Plaza Payment" : "Plaza Payment Ledger",
    title: isPaidMode ? "Mark this Plaza deal as manually paid?" : "Create payment ledger for this Plaza opportunity",
    bodyHtml: `
      <form id="plaza-payment-ledger-form" data-opportunity-id="${escapeHtml(item.id)}" data-payment-mode="${escapeHtml(mode)}">
        <div class="yh-plaza-modal-copy">
          This starts an internal Plaza transaction for <strong>${escapeHtml(item.title || "this Plaza opportunity")}</strong>.
          The service seeker creates the ledger first. YH/Admin verifies the real payment before the Academy member or service provider receives an available payout in Wallet.
          This protects both sides: the seeker gets a tracked deal record, and the provider only receives a payout after settlement is confirmed.
          <br><br>
          <strong>Transaction Safety Reminder:</strong>
          ${escapeHtml(getPlazaTransactionSafetyReminderCopy())}
        </div>

        <div class="yh-plaza-form-grid">
          <label class="yh-plaza-field">
            <span>Deal Amount</span>
            <input
              type="number"
              min="1"
              step="0.01"
              name="amount"
              value="${escapeHtml(String(defaultAmount || ""))}"
              placeholder="300"
              required
            >
          </label>

          <label class="yh-plaza-field">
            <span>Currency</span>
            <select name="currency" required>
              ${["USD", "EUR", "NGN", "PHP", "INR"].map((currency) => `
                <option value="${escapeHtml(currency)}" ${currency === defaultCurrency ? "selected" : ""}>
                  ${escapeHtml(currency)}
                </option>
              `).join("")}
            </select>
          </label>

          <label class="yh-plaza-field">
            <span>YH Commission Rate</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              name="commissionRate"
              value="${escapeHtml(String(defaultCommission > 1 ? defaultCommission : defaultCommission * 100))}"
              placeholder="20"
              required
            >
          </label>
        </div>

        <div class="yh-plaza-card-note">
          Current status: ${escapeHtml(getPlazaOpportunityPaymentStatusLabel(item))}
          ${item.paymentLedgerId ? ` • Ledger: ${escapeHtml(item.paymentLedgerId)}` : ""}
        </div>

        <div class="yh-plaza-form-actions">
          <button type="button" class="yh-plaza-btn yh-plaza-btn-secondary" data-close-modal>
            Cancel
          </button>
          <button type="submit" class="yh-plaza-btn yh-plaza-btn-primary">
            ${isPaidMode ? "Mark Manual Paid" : "Create Payment Ledger"}
          </button>
        </div>
      </form>
    `
  });
}

function renderPlazaOpportunityPaymentActions(item = {}) {
  const statusLabel = getPlazaOpportunityPaymentStatusLabel(item);
  const isPaid = statusLabel === "Paid";
  const hasLedger = Boolean(item.paymentLedgerId);

  return `
    <button
      type="button"
      class="yh-plaza-ghost-btn"
      data-plaza-payment-ledger="${escapeHtml(item.id)}"
      ${isPaid ? "disabled aria-disabled=\"true\"" : ""}
    >
      ${isPaid ? "Paid" : hasLedger ? "Update Internal Ledger" : "Start Internal Transaction"}
    </button>
  `;
}

function normalizeServerDirectoryItem(item, index = 0) {
  const userId = String(item?.userId || item?.authorId || item?.id || "").trim();

  return normalizeDirectoryItem({
    id: item?.id || userId || `server-member-${index + 1}`,
    userId,
    authorId: item?.authorId || userId,
    avatar: item?.avatar || item?.profilePhoto || item?.photoURL || item?.authorAvatar || "",
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
function getPlazaDirectoryItemById(id = "") {
  const cleanId = String(id || "").trim();
  if (!cleanId) return null;

  const serverItem = plazaServerDirectory.find((item) => {
    return (
      String(item.id || "").trim() === cleanId ||
      String(item.userId || "").trim() === cleanId ||
      String(item.authorId || "").trim() === cleanId
    );
  });

  if (serverItem) return serverItem;

  return plazaAdapter.getMemberById(cleanId);
}

function getPlazaRegionById(id = "") {
  const cleanId = String(id || "").trim();
  if (!cleanId) return null;

  return getPlazaRegionsForRender().find((item) => {
    return String(item.id || "").trim() === cleanId;
  }) || null;
}

function normalizeServerRegionItem(item, index = 0) {
  return normalizeRegionItem({
    id: item?.id || `server-region-${index + 1}`,
    region: item?.region || item?.name || "Global",
    count: Number(item?.count || 0),
    label: item?.label || "Region Hub",
    text: item?.text || item?.description || "",
    continent: item?.continent || "",
    network: item?.network || "",
    plazaNumber: item?.plazaNumber || item?.plaza_number || "",
    countries: Array.isArray(item?.countries) ? item.countries : [],
    sourceUrl: item?.sourceUrl || item?.source_url || "",
    patronName: item?.patronName || item?.leaderName || "",
    patronRole: item?.patronRole || item?.leaderRole || "",
    patronUserId: item?.patronUserId || item?.leaderUserId || "",
    patronStatus: item?.patronStatus || item?.leaderStatus || "",
    patronContactHint: item?.patronContactHint || item?.leaderContactHint || "",
    patronBenefits: Array.isArray(item?.patronBenefits) ? item.patronBenefits : [],
    patronPrivileges: Array.isArray(item?.patronPrivileges) ? item.patronPrivileges : [],
    patronCommissionPolicy:
      item?.patronCommissionPolicy && typeof item.patronCommissionPolicy === "object"
        ? item.patronCommissionPolicy
        : null,
    patronAuthority:
      item?.patronAuthority && typeof item.patronAuthority === "object"
        ? item.patronAuthority
        : null
  }, index);
}

async function loadPlazaRegionsFromServer(options = {}) {
  if (plazaRegionsLoading) return plazaServerRegions;

  plazaRegionsLoading = true;

  if (plazaRegionGrid && options.silent !== true) {
    plazaRegionGrid.innerHTML = `<div class="yh-plaza-empty">Loading Plazas regions...</div>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/regions?limit=120");
    const items = Array.isArray(result.regions) ? result.regions : [];

    plazaServerRegions = items.map(normalizeServerRegionItem);
    plazaServerRegionsLoaded = true;

    renderRegions();
    renderAtlasScreen();
    populateMeetupRegionSelect();
    populatePatronRegionSelect();
    return plazaServerRegions;
  } catch (error) {
    console.error("loadPlazaRegionsFromServer error:", error);

    if (plazaRegionGrid) {
      plazaRegionGrid.innerHTML = `<div class="yh-plaza-empty">Could not load Plazas regions. Please refresh.</div>`;
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
    plazaBridgeGrid.innerHTML = `<div class="yh-plaza-empty">Loading Plazas bridge paths...</div>`;
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
      plazaBridgeGrid.innerHTML = `<div class="yh-plaza-empty">Could not load Plazas bridge paths. Please refresh.</div>`;
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

    providerId: item?.providerId || "",
    providerName: item?.providerName || "",
    serviceCategory: item?.serviceCategory || "",
    serviceTags: Array.isArray(item?.serviceTags) ? item.serviceTags : [],
    serviceProviderType: item?.serviceProviderType || "",
    servicePriceType: item?.servicePriceType || "",
    serviceDeliveryTime: item?.serviceDeliveryTime || "",
    requestIntent: item?.requestIntent || "",
    requestPriority: item?.requestPriority || "normal",

    routeKey: item?.routeKey || item?.sourceType || "general",
    routeLabel: item?.routeLabel || item?.targetLabel || "General Plaza request",
    matchingStatus: item?.matchingStatus || "",
    matchingPriority: item?.matchingPriority || "",

    routedToPatron: item?.routedToPatron === true,
    patronRouteStatus: item?.patronRouteStatus || "",
    patronRegionId: item?.patronRegionId || "",
    patronRegion: item?.patronRegion || "",
    patronUserId: item?.patronUserId || "",
    patronName: item?.patronName || "",
    patronRole: item?.patronRole || "",
    patronInboxRole: item?.patronInboxRole || "",
    patronHandledAt: item?.patronHandledAt || "",
    patronHandledBy: item?.patronHandledBy || "",
    patronActionNote: item?.patronActionNote || "",
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

async function updatePlazaRequestOnServer(requestId = "", payload = {}) {
  const cleanId = String(requestId || "").trim();

  if (!cleanId) {
    throw new Error("Missing Plaza request id.");
  }

  const result = await plazaApiFetch(`/api/plaza/requests/${encodeURIComponent(cleanId)}`, {
    method: "PATCH",
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
function clearPlazaRequestAutosaveTimer() {
  if (plazaRequestAutosaveState.timer) {
    window.clearTimeout(plazaRequestAutosaveState.timer);
    plazaRequestAutosaveState.timer = null;
  }
}

function getPlazaRequestAutosaveStatusNode(form) {
  if (!(form instanceof HTMLFormElement)) return null;

  const node = form.querySelector("[data-plaza-request-autosave-status]");
  return node instanceof HTMLElement ? node : null;
}

function setPlazaRequestAutosaveStatus(form, message = "") {
  const node = getPlazaRequestAutosaveStatusNode(form);
  if (!node) return;

  node.textContent = message;
  node.hidden = !message;
}

function getPlazaRequestFormPayload(form) {
  if (!(form instanceof HTMLFormElement)) return null;

  const data = new FormData(form);
  const isApplication = form.id === "plazaApplicationForm";

  const basePayload = {
    sourceType: String(data.get("sourceType") || (isApplication ? "opportunity" : "general")),
    targetId: String(data.get("targetId") || ""),
    targetLabel: String(data.get("targetLabel") || (isApplication ? "Hiring lane" : "General Plaza request")),
    context: String(data.get("context") || ""),
    region: String(data.get("region") || ""),
    name: String(data.get("name") || (isApplication ? "Unknown applicant" : "Unknown requester")),
    objective: isApplication
      ? "Hiring"
      : String(data.get("objective") || "Connection request"),
    message: String(data.get("message") || ""),

    providerId: String(data.get("providerId") || ""),
    providerName: String(data.get("providerName") || ""),
    serviceCategory: String(data.get("serviceCategory") || ""),
    serviceTags: String(data.get("serviceTags") || ""),
    serviceProviderType: String(data.get("serviceProviderType") || ""),
    servicePriceType: String(data.get("servicePriceType") || ""),
    serviceDeliveryTime: String(data.get("serviceDeliveryTime") || ""),
    requestIntent: String(data.get("requestIntent") || ""),
    requestPriority: String(data.get("requestPriority") || "normal"),

    routeKey: String(data.get("routeKey") || ""),
    routeLabel: String(data.get("routeLabel") || ""),
    matchingStatus: String(data.get("matchingStatus") || ""),
    matchingPriority: String(data.get("matchingPriority") || "")
  };

  if (!isApplication) {
    return basePayload;
  }

  return {
    ...basePayload,
    headline: String(data.get("headline") || ""),
    experience: String(data.get("experience") || ""),
    portfolioLink: String(data.get("portfolioLink") || "")
  };
}

function getPlazaRequestAutosaveSignature(form) {
  const requestIdField = form.querySelector('input[name="requestId"]');
  const requestId =
    requestIdField instanceof HTMLInputElement
      ? String(requestIdField.value || "").trim()
      : "";

  const payload = getPlazaRequestFormPayload(form) || {};

  return JSON.stringify({
    formId: form.id,
    requestId,
    payload
  });
}

function hasMeaningfulPlazaRequestDraftContent(payload = {}) {
  return [
    payload.name,
    payload.message,
    payload.headline,
    payload.experience,
    payload.portfolioLink,
    payload.serviceCategory,
    payload.serviceTags,
    payload.targetId,
    payload.targetLabel
  ]
    .map((item) => String(item || "").trim())
    .some(Boolean);
}

async function autosavePlazaRequestDraft(form) {
  if (!(form instanceof HTMLFormElement)) return null;
  if (form.id !== "plazaStructuredRequestForm" && form.id !== "plazaApplicationForm") return null;
  if (!document.body.contains(form)) return null;
  if (plazaRequestAutosaveState.inFlight) return null;

  const payload = getPlazaRequestFormPayload(form);
  if (!payload || !hasMeaningfulPlazaRequestDraftContent(payload)) return null;

  const currentSignature = getPlazaRequestAutosaveSignature(form);
  if (currentSignature === plazaRequestAutosaveState.lastSignature) return null;

  const requestIdField = form.querySelector('input[name="requestId"]');
  const requestId =
    requestIdField instanceof HTMLInputElement
      ? String(requestIdField.value || "").trim()
      : "";

  plazaRequestAutosaveState.inFlight = true;
  setPlazaRequestAutosaveStatus(form, "Autosaving draft...");

  try {
    const savedRequest = requestId
      ? await updatePlazaRequestOnServer(requestId, {
          ...payload,
          status: "Draft"
        })
      : await createPlazaRequest({
          ...payload,
          status: "Draft"
        });

    if (savedRequest?.id && requestIdField instanceof HTMLInputElement) {
      requestIdField.value = savedRequest.id;
      plazaRequestAutosaveState.lastSavedRequestId = savedRequest.id;
    }

    plazaRequestAutosaveState.lastSignature = getPlazaRequestAutosaveSignature(form);

    if (savedRequest?.id) {
      plazaOpsAdapter.removeIncomingByRequestId(savedRequest.id);
    }

    renderRequestsPreview();
    renderRequestsScreen();
    setPlazaRequestAutosaveStatus(form, "Draft autosaved.");

    window.setTimeout(() => {
      if (document.body.contains(form)) {
        setPlazaRequestAutosaveStatus(form, "");
      }
    }, 2200);

    return savedRequest;
  } catch (error) {
    console.error("autosave Plaza request draft failed:", error);
    setPlazaRequestAutosaveStatus(form, "Autosave failed. Use Save as Draft.");
    return null;
  } finally {
    plazaRequestAutosaveState.inFlight = false;
  }
}

function schedulePlazaRequestDraftAutosave(form) {
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id !== "plazaStructuredRequestForm" && form.id !== "plazaApplicationForm") return;

  clearPlazaRequestAutosaveTimer();

  plazaRequestAutosaveState.timer = window.setTimeout(() => {
    autosavePlazaRequestDraft(form);
  }, PLAZA_REQUEST_AUTOSAVE_DELAY_MS);
}

function installPlazaRequestDraftAutosave(formId = "") {
  const form = document.getElementById(formId);
  if (!(form instanceof HTMLFormElement)) return;

  const eligibleSelectors = [
    "input[name='name']",
    "input[name='headline']",
    "input[name='portfolioLink']",
    "select[name='objective']",
    "textarea[name='message']",
    "textarea[name='experience']"
  ].join(",");

  form.querySelectorAll(eligibleSelectors).forEach((field) => {
    field.addEventListener("input", () => schedulePlazaRequestDraftAutosave(form));
    field.addEventListener("change", () => schedulePlazaRequestDraftAutosave(form));
  });
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
    scope: String(item?.scope || ""),
    sourceDivision: String(item?.sourceDivision || ""),
    targetDivision: String(item?.targetDivision || ""),
    businessPurpose: String(item?.businessPurpose || ""),
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
    plazaMessagesList.innerHTML = `<div class="yh-plaza-empty">Loading Plazas messages...</div>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/messages?limit=160");
    const items = Array.isArray(result.conversations) ? result.conversations : [];

    plazaServerMessages = items.map(normalizeServerConversationItem);
    plazaServerMessagesLoaded = true;
    bootstrapPlazaConversationSeenBaseline(plazaServerMessages);

    renderMessagesScreen();
    joinAllPlazaRealtimeConversations();
    return plazaServerMessages;
  } catch (error) {
    if (!isExpectedPlazaInlineFetchFailure(error)) {
      console.error("loadPlazaMessagesFromServer error:", error);
    }

    if (isExpectedPlazaInlineFetchFailure(error)) {
      plazaServerMessages = [];
      plazaServerMessagesLoaded = true;
      bootstrapPlazaConversationSeenBaseline(plazaServerMessages);
      renderMessagesScreen();
      return [];
    }

    if (plazaMessagesList) {
      plazaMessagesList.innerHTML = `<div class="yh-plaza-empty">Could not load Plazas messages. Please refresh.</div>`;
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
async function createPlazaConversationFromRegion(regionId = "") {
  const cleanId = String(regionId || "").trim();

  if (!cleanId) {
    throw new Error("Region ID is missing.");
  }

  const result = await plazaApiFetch(`/api/plaza/messages/from-region/${encodeURIComponent(cleanId)}`, {
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

function normalizeServerMeetupItem(item, index = 0) {
  return {
    id: item?.id || `server-meetup-${index + 1}`,
    title: String(item?.title || "Plaza meetup"),
    regionId: String(item?.regionId || ""),
    region: String(item?.region || "YH Plaza"),
    format: String(item?.format || "in-person"),
    location: String(item?.location || ""),
    scheduledAt: String(item?.scheduledAt || item?.startsAt || ""),
    description: String(item?.description || item?.text || ""),
    patronName: String(item?.patronName || "Plaza Patron"),
    patronRole: String(item?.patronRole || "Regional Patron"),
    isOfficial: item?.isOfficial === true,
    officialByPatron: item?.officialByPatron === true,
    officialPatronUserId: String(item?.officialPatronUserId || ""),
    officialPatronName: String(item?.officialPatronName || ""),
    patronStatusNote: String(item?.patronStatusNote || ""),
    featuredByPatron: item?.featuredByPatron === true,
    hostName: String(item?.hostName || "Hustler"),
    attendeeCount: Number(item?.attendeeCount || 0),
    status: String(item?.status || "planned"),
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || item?.createdAt || new Date().toISOString()
  };
}

async function loadPlazaMeetupsFromServer(options = {}) {
  if (plazaMeetupsLoading) return plazaServerMeetups;

  plazaMeetupsLoading = true;

  if (plazaMeetupsList && options.silent !== true) {
    plazaMeetupsList.innerHTML = `<div class="yh-plaza-empty">Loading Plaza meetups...</div>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/meetups?limit=120");
    const meetups = Array.isArray(result.meetups) ? result.meetups : [];

    plazaServerMeetups = meetups.map(normalizeServerMeetupItem);
    plazaServerMeetupsLoaded = true;

    renderMeetupsScreen();
    return plazaServerMeetups;
  } catch (error) {
    if (!isExpectedPlazaInlineFetchFailure(error)) {
      console.error("loadPlazaMeetupsFromServer error:", error);
    }

    if (isExpectedPlazaInlineFetchFailure(error)) {
      plazaServerMeetups = [];
      plazaServerMeetupsLoaded = true;
      renderMeetupsScreen();
      return [];
    }

    if (plazaMeetupsList) {
      plazaMeetupsList.innerHTML = `<div class="yh-plaza-empty">Could not load Plaza meetups. Please refresh.</div>`;
    }

    return [];
  } finally {
    plazaMeetupsLoading = false;
  }
}

async function createPlazaMeetup(payload = {}) {
  const result = await plazaApiFetch("/api/plaza/meetups", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const meetup = result.meetup ? normalizeServerMeetupItem(result.meetup) : null;

  if (meetup) {
    plazaServerMeetups = [
      meetup,
      ...plazaServerMeetups.filter((item) => item.id !== meetup.id)
    ];
    plazaServerMeetupsLoaded = true;
  }

  return meetup;
}
function normalizeBusinessMemberItem(item = {}, index = 0) {
  return {
    id: String(item && item.id || 'business-member-' + (index + 1)),
    name: String(item && item.name || 'YH Member'),
    username: String(item && item.username || '').replace(/^@+/, ''),
    division: String(item && item.division || 'academy'),
    divisionLabel: String(item && (item.divisionLabel || item.division) || 'Academy'),
    role: String(item && item.role || 'YH Universe Member'),
    location: String(item && item.location || ''),
    avatar: String(item && item.avatar || ''),
    headline: String(item && (item.headline || item.role) || '')
  };
}

function getPlazaBusinessPurpose() {
  return String(plazaBusinessPurposeSelect && plazaBusinessPurposeSelect.value || 'Business collaboration').trim() || 'Business collaboration';
}

function getPlazaBusinessInitialMessage() {
  const message = String(plazaBusinessInitialMessage && plazaBusinessInitialMessage.value || '').trim();
  const purpose = getPlazaBusinessPurpose();
  return message || 'I am opening this Plaza business conversation for: ' + purpose;
}

function renderPlazaBusinessMemberResults() {
  if (!plazaBusinessMemberResults) return;

  if (plazaBusinessMembersLoading) {
    plazaBusinessMemberResults.innerHTML = '<div class="yh-plaza-empty-subtle">Searching cross-division members...</div>';
    return;
  }

  plazaBusinessMemberResults.innerHTML = plazaBusinessMembers.length
    ? plazaBusinessMembers.map((member) => {
        const initial = escapeHtml((member.name || 'Y').charAt(0).toUpperCase());
        const avatarStyle = member.avatar
          ? ' style="background-image:url(\'' + escapeHtml(member.avatar) + '\')"'
          : '';

        const meta = [member.divisionLabel, member.location].filter(Boolean).join(' • ');

        return '<article class="yh-plaza-business-member-card">' +
          '<div class="yh-plaza-business-member-main">' +
            '<div class="yh-plaza-business-member-avatar"' + avatarStyle + '>' + (member.avatar ? '' : initial) + '</div>' +
            '<div>' +
              '<strong>' + escapeHtml(member.name) + '</strong>' +
              '<span>' + escapeHtml(member.role) + '</span>' +
              '<small>' + escapeHtml(meta) + '</small>' +
              (member.headline ? '<p>' + escapeHtml(member.headline) + '</p>' : '') +
            '</div>' +
          '</div>' +
          '<button type="button" class="yh-plaza-btn yh-plaza-btn-primary" data-plaza-business-message="' + escapeHtml(member.id) + '">Open Business Chat</button>' +
        '</article>';
      }).join('')
    : '<div class="yh-plaza-empty-subtle">No matching members found yet. Try a broader search.</div>';
}

async function loadPlazaBusinessMembers(options = {}) {
  const query = String(options.q ?? (plazaBusinessMemberSearchInput && plazaBusinessMemberSearchInput.value) ?? '').trim();
  const division = String(options.division ?? (plazaBusinessMemberDivisionFilter && plazaBusinessMemberDivisionFilter.value) ?? 'all').trim() || 'all';

  plazaBusinessMembersLoading = true;
  renderPlazaBusinessMemberResults();

  try {
    const params = new URLSearchParams({ q: query, division, limit: '80' });
    const result = await plazaApiFetch('/api/plaza/business-members?' + params.toString());
    const members = Array.isArray(result.members) ? result.members : [];

    plazaBusinessMembers = members.map(normalizeBusinessMemberItem);
    plazaBusinessMembersLoaded = true;
    renderPlazaBusinessMemberResults();
    return plazaBusinessMembers;
  } catch (error) {
    console.error('loadPlazaBusinessMembers error:', error);
    plazaBusinessMembers = [];
    if (plazaBusinessMemberResults) {
      plazaBusinessMemberResults.innerHTML = '<div class="yh-plaza-empty-subtle">Could not load cross-division members. Please try again.</div>';
    }
    return [];
  } finally {
    plazaBusinessMembersLoading = false;
    renderPlazaBusinessMemberResults();
  }
}

async function createPlazaConversationFromBusinessMember(targetUserId = '', initialMessage = '') {
  const cleanId = String(targetUserId || '').trim();

  if (!cleanId) throw new Error('Target business member is missing.');

  const result = await plazaApiFetch('/api/plaza/messages/from-business-member/' + encodeURIComponent(cleanId), {
    method: 'POST',
    body: JSON.stringify({
      businessPurpose: getPlazaBusinessPurpose(),
      message: initialMessage || getPlazaBusinessInitialMessage()
    })
  });

  const conversation = result.conversation ? normalizeServerConversationItem(result.conversation) : null;

  if (conversation) {
    plazaServerMessages = [conversation, ...plazaServerMessages.filter((item) => item.id !== conversation.id)];
    plazaServerMessagesLoaded = true;
  }

  return conversation;
}

async function createPlazaConversationFromMember(targetUserId = "", initialMessage = "") {
  const cleanId = String(targetUserId || "").trim();

  if (!cleanId) {
    throw new Error("Target Plaza member is missing.");
  }

  const result = await plazaApiFetch(`/api/plaza/messages/from-member/${encodeURIComponent(cleanId)}`, {
    method: "POST",
    body: JSON.stringify({
      message: initialMessage || `I opened this conversation from the Plaza directory.`
    })
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
    userId: String(item?.userId || item?.authorId || item?.authorUid || item?.createdByUserId || "").trim(),
    authorId: String(item?.authorId || item?.userId || item?.authorUid || item?.createdByUserId || "").trim(),
    authorName: String(item?.authorName || item?.member || item?.name || "Unknown member").trim(),
    authorAvatar: normalizeYHAvatarUrl(item?.authorAvatar || item?.avatar || item?.profilePhoto || item?.photoURL || ""),
    member: String(item?.member || item?.authorName || "Unknown member"),
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
    userId: String(item?.userId || item?.authorId || item?.id || "").trim(),
    authorId: String(item?.authorId || item?.userId || item?.id || "").trim(),
    avatar: normalizeYHAvatarUrl(item?.avatar || item?.profilePhoto || item?.photoURL || item?.authorAvatar || ""),
    name: String(item?.name || item?.authorName || "Unnamed member"),
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

    userId: String(item?.userId || item?.authorId || item?.ownerUid || item?.createdByUserId || "").trim(),
    authorId: String(item?.authorId || item?.userId || item?.ownerUid || item?.createdByUserId || "").trim(),
    authorName: String(item?.authorName || item?.ownerName || item?.member || "Plaza Member").trim(),
    authorAvatar: normalizeYHAvatarUrl(item?.authorAvatar || item?.avatar || item?.profilePhoto || item?.photoURL || item?.ownerAvatar || ""),

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

    serviceCategory: String(item?.serviceCategory || ""),
    serviceTags: Array.isArray(item?.serviceTags)
      ? item.serviceTags.map((tag) => String(tag || "").trim()).filter(Boolean).slice(0, 12)
      : String(item?.serviceTags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 12),
    servicePriceType: String(item?.servicePriceType || "custom_quote"),
    serviceDeliveryTime: String(item?.serviceDeliveryTime || ""),
    serviceProviderType: String(item?.serviceProviderType || ""),
    serviceRequirements: String(item?.serviceRequirements || ""),
    serviceOutcome: String(item?.serviceOutcome || ""),

    pricingAmount: normalizePlazaMoneyValue(item?.pricingAmount || item?.amount || item?.price),
    paymentLedgerId: String(item?.paymentLedgerId || ""),
    paymentLedgerStatus: String(item?.paymentLedgerStatus || ""),
    paymentStatus: String(item?.paymentStatus || ""),
    dealStatus: String(item?.dealStatus || ""),
    platformCommissionAmount: normalizePlazaMoneyValue(item?.platformCommissionAmount),
    operatorPayoutAmount: normalizePlazaMoneyValue(item?.operatorPayoutAmount),
    paymentProviderOptions: Array.isArray(item?.paymentProviderOptions)
      ? item.paymentProviderOptions
      : [],

    academySignalLabel: String(item?.academySignalLabel || "")
  };
}

function normalizeRegionItem(item, index) {
  const countries = Array.isArray(item?.countries)
    ? item.countries.map((country) => String(country || "").trim()).filter(Boolean)
    : [];

  return {
    id: item?.id || `region-${index + 1}`,
    region: String(item?.region || "Unknown region"),
    count: Number(item?.count || 0),
    label: String(item?.label || "Region Hub"),
    text: String(item?.text || "No region details yet."),
    continent: String(item?.continent || ""),
    network: String(item?.network || ""),
    plazaNumber: item?.plazaNumber || "",
    countries,
    countryCount: countries.length,
    sourceUrl: String(item?.sourceUrl || ""),
    patronName: String(item?.patronName || item?.leaderName || `${item?.region || "Plaza"} Patron`),
    patronRole: String(item?.patronRole || item?.leaderRole || "Regional Patron"),
    patronUserId: String(item?.patronUserId || item?.leaderUserId || ""),
    patronStatus: String(item?.patronStatus || item?.leaderStatus || "active"),
    patronContactHint: String(item?.patronContactHint || item?.leaderContactHint || "Coordinates networking, local movement, and meetup direction for this Plaza."),
    patronBenefits: Array.isArray(item?.patronBenefits) ? item.patronBenefits : [],
    patronPrivileges: Array.isArray(item?.patronPrivileges) ? item.patronPrivileges : [],
    patronCommissionPolicy:
      item?.patronCommissionPolicy && typeof item.patronCommissionPolicy === "object"
        ? item.patronCommissionPolicy
        : null,
    patronAuthority:
      item?.patronAuthority && typeof item.patronAuthority === "object"
        ? item.patronAuthority
        : null
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
  const serviceTags = Array.isArray(item?.serviceTags)
    ? item.serviceTags.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 12)
    : String(item?.serviceTags || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 12);

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

    providerId: String(item?.providerId || ""),
    providerName: String(item?.providerName || ""),
    serviceCategory: String(item?.serviceCategory || ""),
    serviceTags,
    serviceProviderType: String(item?.serviceProviderType || ""),
    servicePriceType: String(item?.servicePriceType || ""),
    serviceDeliveryTime: String(item?.serviceDeliveryTime || ""),
    requestIntent: String(item?.requestIntent || ""),
    requestPriority: String(item?.requestPriority || "normal"),

    routeKey: String(item?.routeKey || ""),
    routeLabel: String(item?.routeLabel || ""),
    matchingStatus: String(item?.matchingStatus || ""),
    matchingPriority: String(item?.matchingPriority || ""),
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
    scope: String(item?.scope || ""),
    sourceDivision: String(item?.sourceDivision || ""),
    targetDivision: String(item?.targetDivision || ""),
    businessPurpose: String(item?.businessPurpose || ""),
    moderation: item?.moderation && typeof item.moderation === "object" ? item.moderation : {},
    reports: Array.isArray(item?.reports) ? item.reports : [],
    closedBy: item?.closedBy && typeof item.closedBy === "object" ? item.closedBy : {},
    hiddenBy: item?.hiddenBy && typeof item.hiddenBy === "object" ? item.hiddenBy : {},
    blockedBy: item?.blockedBy && typeof item.blockedBy === "object" ? item.blockedBy : {},
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
    breadcrumb: ["Plazas", "Feed"]
  },
  opportunities: {
    title: "Opportunities",
    note: "Find work, collaboration, projects, partnerships, introductions, service needs, and regional openings.",
    navTab: "opportunities",
    toolbar: null,
    breadcrumb: ["Plazas", "Opportunities"]
  },
  directory: {
    title: "Directory",
    note: "Find builders, operators, service providers, regional connectors, and Federation-linked members by role and trust layer.",
    navTab: "directory",
    toolbar: "directory",
    breadcrumb: ["Plazas", "Directory"]
  },
  regions: {
    title: "Regions",
    note: "Organize movement locally through city and country hubs that cluster members, opportunities, requests, and real-world access.",
    navTab: "regions",
    toolbar: null,
    breadcrumb: ["Plazas", "Regions"]
  },
  atlas: {
    title: "Plazas Atlas",
    note: "Visualize the official Plaza topology, countries, networks, and Patron / Leader coverage.",
    navTab: "atlas",
    toolbar: null,
    breadcrumb: ["Plazas", "Atlas"]
  },
  patron: {
    title: "Become Patron",
    note: "Apply to become the approved Patron or Leader for one official Plaza.",
    navTab: "patron",
    toolbar: null,
    breadcrumb: ["Plazas", "Patron Application"]
  },
  "patron-desk": {
    title: "Patron Desk",
    note: "Manage regional Patron operations, routed requests, recommendations, and commission payout visibility.",
    navTab: "patron-desk",
    toolbar: null,
    breadcrumb: ["Plazas", "Patron Desk"]
  },
  bridge: {
    title: "Bridge",
    note: "Track how Academy execution turns into Plaza visibility and later becomes Federation-relevant access.",
    navTab: "bridge",
    toolbar: null,
    breadcrumb: ["Plazas", "Bridge"]
  },
  requests: {
    title: "Requests",
    note: "Track intro, opportunity, collaboration, service, regional, project, and Federation escalation requests.",
    navTab: "requests",
    toolbar: null,
    breadcrumb: ["Plazas", "Requests"]
  },
  inbox: {
    title: "Inbox",
    note: "Incoming Plaza activity, requests, applications, and conversation handoffs connected to your role.",
    navTab: "inbox",
    toolbar: null,
    breadcrumb: ["Plazas", "Inbox"]
  },
  "incoming-detail": {
    title: "Incoming Detail",
    note: "Review routing ownership, incoming package, and conversation conversion without leaving Plaza.",
    navTab: null,
    toolbar: null,
    breadcrumb: ["Plazas", "Inbox Hub", "Incoming Detail"]
  },
  notifications: {
    title: "Notifications",
    note: "Awareness events point toward inbox items, requests, and conversations without replacing those workflows.",
    navTab: null,
    toolbar: null,
    breadcrumb: ["Plazas", "Notifications"]
  },
  messages: {
    title: "Conversations",
    note: "Context-based chats opened from opportunities, requests, directory intros, regional hubs, and projects.",
    navTab: "messages",
    toolbar: null,
    breadcrumb: ["Plazas", "Conversations"]
  },
  meetups: {
    title: "Meetups",
    note: "Coordinate regional Plaza meetups, local networking sessions, and patron-led gatherings.",
    navTab: "meetups",
    toolbar: null,
    breadcrumb: ["Plazas", "Meetups"]
  },
  conversation: {
    title: "Conversation",
    note: "Message threads stay tied to their opening route, queue owner, and original Plaza context.",
    navTab: null,
    toolbar: null,
    breadcrumb: ["Plazas", "Messages", "Conversation"]
  },
  "opportunity-detail": {
    title: "Opportunity Detail",
    note: "Structured fit, related members, and next-step routing inside the same Plaza workspace.",
    navTab: "opportunities",
    toolbar: null,
    breadcrumb: ["Plazas", "Opportunities", "Opportunity Detail"]
  },
  "project-detail": {
    title: "Project Detail",
    note: "Cross-division projects now stay inside Plaza as an internal screen instead of breaking the workflow.",
    navTab: "feed",
    toolbar: null,
    breadcrumb: ["Plazas", "Feed", "Project Detail"]
  },
  "region-hub": {
    title: "Region Hub",
    note: "Local movement, members, and next steps stay inside the same embedded YH Universe workspace.",
    navTab: "regions",
    toolbar: null,
    breadcrumb: ["Plazas", "Regions", "Region Hub"]
  },
  "bridge-detail": {
    title: "Bridge Detail",
    note: "Bridge lanes now behave like first-class internal screens with clean routing and tracked next steps.",
    navTab: "bridge",
    toolbar: null,
    breadcrumb: ["Plazas", "Bridge", "Bridge Detail"]
  }
};

const PLAZA_SCREEN_ICON_ASSETS = Object.freeze({
  feed: "/assets/academy/plaza%20icons/feed.png",
  inbox: "/assets/academy/plaza%20icons/inbox.png",
  messages: "/assets/academy/plaza%20icons/conversations.png",
  conversations: "/assets/academy/plaza%20icons/conversations.png",
  meetups: "/assets/academy/plaza%20icons/meetups.png",
  opportunities: "/assets/academy/plaza%20icons/opportunities.png",
  directory: "/assets/academy/plaza%20icons/directory.png",
  regions: "/assets/academy/plaza%20icons/regions.png",
  atlas: "/assets/academy/plaza%20icons/plaza%20atlas.png",
  patron: "/assets/academy/plaza%20icons/patron.png",
  "patron-desk": "/assets/academy/plaza%20icons/patron%20desk.png",
  bridge: "/assets/academy/plaza%20icons/bridge.png",
  requests: "/assets/academy/plaza%20icons/requests.png",

  conversation: "/assets/academy/plaza%20icons/conversations.png",
  notifications: "/assets/academy/plaza%20icons/inbox.png",
  "incoming-detail": "/assets/academy/plaza%20icons/inbox.png",
  "opportunity-detail": "/assets/academy/plaza%20icons/opportunities.png",
  "project-detail": "/assets/academy/plaza%20icons/feed.png",
  "region-hub": "/assets/academy/plaza%20icons/regions.png",
  "bridge-detail": "/assets/academy/plaza%20icons/bridge.png"
});

function getPlazaScreenIconAsset(screenName = "feed") {
  const cleanScreen = String(screenName || "feed").trim().toLowerCase();
  const config = plazaConfig[cleanScreen] || plazaConfig.feed;
  const navTab = String(config?.navTab || cleanScreen || "feed").trim().toLowerCase();

  return (
    PLAZA_SCREEN_ICON_ASSETS[cleanScreen] ||
    PLAZA_SCREEN_ICON_ASSETS[navTab] ||
    PLAZA_SCREEN_ICON_ASSETS.feed
  );
}

function ensurePlazaWorkspaceTitleIconShell(titleText = "Feed") {
  if (!plazaWorkspaceTitle) return null;

  let icon = plazaWorkspaceTitle.querySelector("#plazaWorkspaceTitleIcon");
  let img = plazaWorkspaceTitle.querySelector("#plazaWorkspaceTitleIconImg");
  let text = plazaWorkspaceTitle.querySelector("#plazaWorkspaceTitleText");

  if (!icon || !img || !text) {
    const currentTitle = String(titleText || plazaWorkspaceTitle.textContent || "Feed").trim() || "Feed";

    plazaWorkspaceTitle.textContent = "";
    plazaWorkspaceTitle.classList.add("yh-plaza-workspace-title-with-icon");

    icon = document.createElement("span");
    icon.id = "plazaWorkspaceTitleIcon";
    icon.className = "yh-plaza-workspace-title-icon";
    icon.setAttribute("aria-hidden", "true");

    img = document.createElement("img");
    img.id = "plazaWorkspaceTitleIconImg";
    img.className = "yh-plaza-workspace-title-icon-img";
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";

    text = document.createElement("span");
    text.id = "plazaWorkspaceTitleText";
    text.textContent = currentTitle;

    icon.appendChild(img);
    plazaWorkspaceTitle.appendChild(icon);
    plazaWorkspaceTitle.appendChild(text);
  }

  plazaWorkspaceTitleIcon = icon;
  plazaWorkspaceTitleIconImg = img;
  plazaWorkspaceTitleText = text;

  return { icon, img, text };
}

function syncPlazaWorkspaceTitleChrome(screenName = "feed", titleText = "Feed") {
  const shell = ensurePlazaWorkspaceTitleIconShell(titleText);
  if (!shell) return;

  const iconSrc = getPlazaScreenIconAsset(screenName);

  plazaWorkspaceTitle.classList.add("yh-plaza-workspace-title-with-icon");
  plazaWorkspaceTitle.setAttribute("data-plaza-title-screen", String(screenName || "feed").trim().toLowerCase());

  shell.text.textContent = String(titleText || "Feed").trim() || "Feed";

  if (shell.img.getAttribute("src") !== iconSrc) {
    shell.img.setAttribute("src", iconSrc);
  }
}

const PRIMARY_SCREENS = new Set([
  "feed",
  "inbox",
  "opportunities",
  "directory",
  "regions",
  "atlas",
  "patron",
  "patron-desk",
  "bridge",
  "requests",
  "messages",
  "meetups"
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

function readPlazaLaunchScreenFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const raw =
      params.get("tab") ||
      params.get("screen") ||
      params.get("section") ||
      "";

    const clean = String(raw || "").trim().toLowerCase();

    return PRIMARY_SCREENS.has(clean) ? clean : "";
  } catch (_) {
    return "";
  }
}

function restorePlazaUiState() {
  const saved = loadStoredUiState(PLAZA_UI_STATE_KEY);
  const urlTargetScreen = readPlazaLaunchScreenFromUrl();

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

  if (urlTargetScreen) {
    return urlTargetScreen;
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
  atlas: "Loading Plaza Atlas...",
  patron: "Loading Patron Application...",
  "patron-desk": "Loading Patron Desk...",
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

  return "Loading Plazas...";
}

/* PATCH: YHU instant Plaza dashboard child tabs v1 */
function isPlazaDashboardEmbeddedNavigationV1() {
  const ownPath = String(window.location?.pathname || "").replace(/\/+$/, "");
  const ownBody = document.body || null;

  let parentBody = null;
  let parentPath = "";

  try {
    if (window.parent && window.parent !== window && window.parent.document) {
      parentBody = window.parent.document.body || null;
      parentPath = String(window.parent.location?.pathname || "").replace(/\/+$/, "");
    }
  } catch (_) {}

  return Boolean(
    ownPath === "/dashboard" ||
    parentPath === "/dashboard" ||
    ownBody?.getAttribute("data-yh-page") === "dashboard" ||
    ownBody?.getAttribute("data-yh-view") === "hub" ||
    ownBody?.getAttribute("data-yh-dashboard-embed") === "true" ||
    ownBody?.classList?.contains("yh-dashboard-inline-embed-body") ||
    parentBody?.getAttribute("data-yh-page") === "dashboard" ||
    parentBody?.getAttribute("data-yh-view") === "hub" ||
    parentBody?.classList?.contains("yh-dashboard-shell-ready")
  );
}

function markPlazaDashboardNonBlockingSyncV1(label = "") {
  const cleanLabel = String(label || "Syncing Plazas...").trim() || "Syncing Plazas...";

  [document.body].filter(Boolean).forEach((body) => {
    body.setAttribute("data-yh-tab-syncing", "true");
    body.setAttribute("data-yh-tab-sync-label", cleanLabel);

    window.clearTimeout(window.__yhPlazaNonBlockingTabSyncTimerV1);
    window.__yhPlazaNonBlockingTabSyncTimerV1 = window.setTimeout(() => {
      body.removeAttribute("data-yh-tab-syncing");
      body.removeAttribute("data-yh-tab-sync-label");
    }, 900);
  });
}
/* END PATCH: YHU instant Plaza dashboard child tabs v1 */

function showPlazaTabLoader(screenNameOrLabel = "Loading Plazas...") {
  const loader = document.getElementById("yh-tab-loader");
  const text = document.getElementById("yh-tab-loader-text");

  const raw = String(screenNameOrLabel || "").trim();
  const label = raw.startsWith("Loading ") ? raw : getPlazaScreenLoaderLabel(raw);

  if (isPlazaDashboardEmbeddedNavigationV1()) {
    markPlazaDashboardNonBlockingSyncV1(label);

    if (loader) {
      loader.hidden = true;
      loader.classList.remove("is-active");
      loader.classList.add("hidden-step");
      loader.setAttribute("aria-hidden", "true");
      loader.style.pointerEvents = "none";
    }

    return;
  }

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

/* PATCH: Plaza Dashboard child-ready handshake v1 */
function normalizePlazaDashboardWorkspaceKey(screenName = "feed") {
  const clean = String(screenName || "feed").trim().toLowerCase();

  if (clean === "messages") return "plazas-conversations";
  if (clean === "atlas") return "plazas-atlas";
  if (clean === "patron") return "plazas-patron";

  return `plazas-${clean || "feed"}`;
}

function markPlazaDashboardChildLoading(screenName = "feed") {
  const cleanScreen = String(screenName || "feed").trim().toLowerCase() || "feed";

  document.body?.setAttribute("data-yh-dashboard-child-ready", "false");
  document.body?.setAttribute("data-yh-dashboard-active-screen", cleanScreen);
  document.body?.setAttribute("data-yh-dashboard-child-loading-at", String(Date.now()));
}

function markPlazaDashboardChildReady(screenName = "", reason = "ready") {
  const cleanScreen = String(screenName || plazaRuntime.currentScreen || "feed").trim().toLowerCase() || "feed";
  const workspaceKey = normalizePlazaDashboardWorkspaceKey(cleanScreen);

  document.body?.setAttribute("data-yh-dashboard-child-ready", "true");
  document.body?.setAttribute("data-yh-dashboard-active-screen", cleanScreen);
  document.body?.setAttribute("data-yh-dashboard-child-ready-reason", String(reason || "ready"));
  document.body?.setAttribute("data-yh-dashboard-child-ready-at", String(Date.now()));

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "yh:child-workspace-ready",
          division: "plazas",
          workspaceKey,
          screen: cleanScreen,
          reason
        },
        window.location.origin
      );
    }
  } catch (_) {}
}
/* END PATCH: Plaza Dashboard child-ready handshake v1 */

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
const plazaBusinessMemberSearchForm = document.getElementById("plazaBusinessMemberSearchForm");
const plazaBusinessMemberSearchInput = document.getElementById("plazaBusinessMemberSearchInput");
const plazaBusinessMemberDivisionFilter = document.getElementById("plazaBusinessMemberDivisionFilter");
const plazaBusinessPurposeSelect = document.getElementById("plazaBusinessPurposeSelect");
const plazaBusinessInitialMessage = document.getElementById("plazaBusinessInitialMessage");
const plazaBusinessMemberResults = document.getElementById("plazaBusinessMemberResults");

const plazaAtlasSummary = document.getElementById("plazaAtlasSummary");
const plazaAtlasGrid = document.getElementById("plazaAtlasGrid");

const plazaPatronApplicationMeta = document.getElementById("plazaPatronApplicationMeta");
const plazaPatronApplicationStatusCard = document.getElementById("plazaPatronApplicationStatusCard");
const plazaPatronApplicationForm = document.getElementById("plazaPatronApplicationForm");
const plazaPatronRegionSelect = document.getElementById("plazaPatronRegionSelect");
const plazaPatronApplicationSubmitBtn = document.getElementById("plazaPatronApplicationSubmitBtn");
const plazaPatronBenefitsGrid = document.getElementById("plazaPatronBenefitsGrid");
const plazaPatronPowerGrid = document.getElementById("plazaPatronPowerGrid");
const plazaPatronEconomicGrid = document.getElementById("plazaPatronEconomicGrid");

const plazaPatronDeskMeta = document.getElementById("plazaPatronDeskMeta");
const plazaPatronDeskStatusCard = document.getElementById("plazaPatronDeskStatusCard");
const plazaPatronDeskSummaryGrid = document.getElementById("plazaPatronDeskSummaryGrid");
const plazaPatronDeskRegionsList = document.getElementById("plazaPatronDeskRegionsList");
const plazaPatronDeskRequestsList = document.getElementById("plazaPatronDeskRequestsList");
const plazaPatronDeskPayoutsList = document.getElementById("plazaPatronDeskPayoutsList");
const plazaPatronDeskRecommendationsList = document.getElementById("plazaPatronDeskRecommendationsList");

const plazaMeetupsMeta = document.getElementById("plazaMeetupsMeta");
const plazaMeetupsList = document.getElementById("plazaMeetupsList");
const plazaMeetupComposerForm = document.getElementById("plazaMeetupComposerForm");
const plazaMeetupRegionSelect = document.getElementById("plazaMeetupRegionSelect");
const plazaMeetupComposerSubmitBtn = document.getElementById("plazaMeetupComposerSubmitBtn");
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
let plazaWorkspaceTitleIcon = document.getElementById("plazaWorkspaceTitleIcon");
let plazaWorkspaceTitleIconImg = document.getElementById("plazaWorkspaceTitleIconImg");
let plazaWorkspaceTitleText = document.getElementById("plazaWorkspaceTitleText");
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

    routedToPatron: item?.routedToPatron === true,
    patronRouteStatus: String(item?.patronRouteStatus || ""),
    patronRegionId: String(item?.patronRegionId || ""),
    patronRegion: String(item?.patronRegion || ""),
    patronUserId: String(item?.patronUserId || ""),
    patronName: String(item?.patronName || ""),
    patronRole: String(item?.patronRole || ""),
    patronInboxRole: String(item?.patronInboxRole || ""),
    patronHandledAt: item?.patronHandledAt || "",
    patronHandledBy: String(item?.patronHandledBy || ""),
    patronActionNote: String(item?.patronActionNote || ""),

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
  clearPlazaRequestAutosaveTimer();

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

        ${
          viewModel.routedToPatron
            ? `
              <div class="yh-plaza-card-note yh-plaza-card-note-strong">
                Routed to Patron
              </div>
              <div class="yh-plaza-card-note">
                ${escapeHtml(viewModel.patronName || "Plaza Patron")}
                ${viewModel.patronRole ? ` • ${escapeHtml(viewModel.patronRole)}` : ""}
                ${viewModel.patronRegion ? ` • ${escapeHtml(viewModel.patronRegion)}` : ""}
              </div>
              <div class="yh-plaza-card-note">
                Status: ${escapeHtml(viewModel.patronRouteStatus || "routed_to_patron")}
                ${viewModel.patronActionNote ? ` • Note: ${escapeHtml(viewModel.patronActionNote)}` : ""}
              </div>
            `
            : ""
        }
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

  if (plazaWorkspaceTitle) {
    syncPlazaWorkspaceTitleChrome(screenName, config.title);
  }

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

  const shouldDeferDashboardReady = options.deferDashboardReady === true;

  if (shouldShowLoader) {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        hidePlazaTabLoader();

        if (!shouldDeferDashboardReady) {
          markPlazaDashboardChildReady(nextScreenName, "screen-ready");
        }
      }, 260);
    });
  } else if (!shouldDeferDashboardReady) {
    window.requestAnimationFrame(() => {
      markPlazaDashboardChildReady(nextScreenName, "screen-ready");
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
        ${renderPlazaCardOwnerButton(item, {
          name: item.authorName || item.member,
          subtitle: `${getSourceLabel(item.source)} • ${getDivisionLabel(item.division)}`,
          avatar: item.authorAvatar
        })}

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

      ${renderPlazaCardOwnerButton(item, {
        name: item.name,
        subtitle: `${item.role} • ${item.region}`,
        avatar: item.avatar,
        targetUserId: getPlazaCardProfileTarget(item, true),
        allowIdFallback: true
      })}

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
        <button type="button" class="yh-plaza-ghost-btn" data-plaza-profile-id="${escapeHtml(item.userId || item.authorId || item.id)}">View Profile</button>
        <button type="button" class="yh-plaza-ghost-btn" data-plaza-profile-message="${escapeHtml(item.userId || item.authorId || item.id)}">Message in Plaza</button>
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

        ${renderPlazaCardOwnerButton(item, {
          name: item.authorName || "Plaza Member",
          subtitle: `${getPlazaOpportunitySourceLabel(item)} • ${item.region}`,
          avatar: item.authorAvatar
        })}

        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>

        ${renderPlazaOpportunityServicePanel(item)}
        ${renderPlazaOpportunityEconomyPanel(item)}

        <div class="yh-plaza-card-actions">
          <button type="button" class="yh-plaza-ghost-btn" data-opportunity-id="${escapeHtml(item.id)}">
            ${escapeHtml(getPlazaOpportunityPrimaryActionLabel(item))}
          </button>
          ${renderPlazaOpportunityPaymentActions(item)}
        </div>
      </article>
    `;
  }).join("");
}

function getYHCanonicalPlazaRegions() {
  return YH_CANONICAL_PLAZAS.map((plaza, index) => {
    const countries = safeArray(plaza.countries).map((country) => String(country || "").trim()).filter(Boolean);

    return normalizeRegionItem({
      ...plaza,
      count: countries.length,
      text: `${plaza.network} regional hub covering ${countries.length} countries: ${countries.join(", ")}.`
    }, index);
  });
}

function getPlazaRegionsForRender() {
  const serverItems = plazaServerRegionsLoaded ? safeArray(plazaServerRegions) : [];

  if (serverItems.length) {
    return serverItems;
  }

  const adapterItems = !plazaServerRegionsLoaded
    ? safeArray(plazaAdapter.getRegions())
    : [];

  if (adapterItems.length) {
    return adapterItems;
  }

  return getYHCanonicalPlazaRegions();
}

function renderPlazaRegionCountryList(item = {}) {
  const countries = safeArray(item.countries)
    .map((country) => String(country || "").trim())
    .filter(Boolean);

  if (!countries.length) return "";

  return `
    <div class="yh-plaza-card-note">
      <strong>${escapeHtml(String(countries.length))} Countries:</strong>
      ${escapeHtml(countries.join(", "))}
    </div>
  `;
}
function getPlazaTopologyClass(item = {}) {
  const continent = String(item.continent || item.network || item.region || "").toLowerCase();

  if (continent.includes("africa")) return "is-africa";
  if (continent.includes("asia")) return "is-asia";
  if (continent.includes("europe")) return "is-europe";
  if (continent.includes("north")) return "is-north-america";
  if (continent.includes("south") || continent.includes("latam")) return "is-latam";
  if (continent.includes("oceania")) return "is-oceania";

  return "is-global";
}

function renderPlazaTopologyVisual(item = {}) {
  const countries = safeArray(item.countries)
    .map((country) => String(country || "").trim())
    .filter(Boolean);

  const visibleCountries = countries.slice(0, 8);
  const hiddenCount = Math.max(countries.length - visibleCountries.length, 0);
  const topologyClass = getPlazaTopologyClass(item);

  return `
    <div class="yh-plaza-topology-map ${escapeHtml(topologyClass)}" aria-label="${escapeHtml(item.region)} topology">
      <div class="yh-plaza-topology-grid" aria-hidden="true"></div>
      <div class="yh-plaza-topology-core">
        <strong>${escapeHtml(item.region)}</strong>
        <span>${escapeHtml(item.network || item.continent || "YH Plaza")}</span>
      </div>
      <div class="yh-plaza-topology-nodes">
        ${
          visibleCountries.map((country, index) => `
            <span class="yh-plaza-topology-node yh-plaza-topology-node-${index + 1}">
              ${escapeHtml(country)}
            </span>
          `).join("")
        }
        ${
          hiddenCount
            ? `<span class="yh-plaza-topology-node yh-plaza-topology-node-more">+${escapeHtml(String(hiddenCount))}</span>`
            : ""
        }
      </div>
    </div>
  `;
}
function getAllPlazaPatronBenefits() {
  return [
    ...PLAZA_PATRON_BENEFIT_GROUPS.status,
    ...PLAZA_PATRON_BENEFIT_GROUPS.control,
    ...PLAZA_PATRON_BENEFIT_GROUPS.network,
    ...PLAZA_PATRON_BENEFIT_GROUPS.money
  ];
}

function getRegionPatronBenefits(item = {}) {
  const savedBenefits = Array.isArray(item.patronBenefits)
    ? item.patronBenefits.map((benefit) => String(benefit || "").trim()).filter(Boolean)
    : [];

  return savedBenefits.length ? savedBenefits : getAllPlazaPatronBenefits();
}

function getRegionPatronPrivileges(item = {}) {
  const savedPrivileges = Array.isArray(item.patronPrivileges)
    ? item.patronPrivileges.map((benefit) => String(benefit || "").trim()).filter(Boolean)
    : [];

  return savedPrivileges.length
    ? savedPrivileges
    : [
        "lead_regional_chat",
        "create_official_meetups",
        "route_connection_requests",
        "recommend_federation_candidates",
        "receive_connection_commission_eligibility",
        "host_official_plaza_events"
      ];
}

function renderPatronBenefitList(items = []) {
  const cleanItems = safeArray(items)
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (!cleanItems.length) {
    return `<div class="yh-plaza-empty">No Patron benefits configured yet.</div>`;
  }

  return cleanItems
    .map((item) => `<div class="yh-plaza-card-note">${escapeHtml(item)}</div>`)
    .join("");
}

function renderPatronBenefitsScreen() {
  if (plazaPatronBenefitsGrid) {
    plazaPatronBenefitsGrid.innerHTML = renderPatronBenefitList([
      ...PLAZA_PATRON_BENEFIT_GROUPS.status,
      ...PLAZA_PATRON_BENEFIT_GROUPS.network
    ]);
  }

  if (plazaPatronPowerGrid) {
    plazaPatronPowerGrid.innerHTML = renderPatronBenefitList(PLAZA_PATRON_BENEFIT_GROUPS.control);
  }

  if (plazaPatronEconomicGrid) {
    plazaPatronEconomicGrid.innerHTML = `
      ${renderPatronBenefitList(PLAZA_PATRON_BENEFIT_GROUPS.money)}
      <div class="yh-plaza-card-note">
        <strong>${escapeHtml(PLAZA_PATRON_COMMISSION_POLICY.introCommissionLabel)}:</strong>
        ${escapeHtml(PLAZA_PATRON_COMMISSION_POLICY.introCommissionRange)} on admin-verified successful introductions.
      </div>
      <div class="yh-plaza-card-note">
        <strong>Revenue Share:</strong>
        ${escapeHtml(PLAZA_PATRON_COMMISSION_POLICY.meetupRevenueShare)} for paid meetups, sponsorships, and premium regional events.
      </div>
      <div class="yh-plaza-card-note">
        ${escapeHtml(PLAZA_PATRON_COMMISSION_POLICY.note)}
      </div>
    `;
  }

  if (plazaPatronApplicationMeta) {
    plazaPatronApplicationMeta.innerHTML = [
      "Official badge",
      "Regional authority",
      "Meetup control",
      "Commission eligible"
    ].map((meta) => `<span class="yh-plaza-view-chip">${escapeHtml(meta)}</span>`).join("");
  }
}

function renderPatronBenefitsPreview(item = {}) {
  const benefits = getRegionPatronBenefits(item).slice(0, 4);

  return `
    <div class="yh-plaza-card-note">
      <strong>Patron Benefits:</strong>
      ${escapeHtml(benefits.join(" • "))}
    </div>
  `;
}
function renderAtlasScreen() {
  if (!plazaAtlasGrid) return;

  const items = getPlazaRegionsForRender();
  const totalCountries = items.reduce((sum, item) => {
    return sum + safeArray(item.countries).length;
  }, 0);

  const activePatrons = items.filter((item) => {
    return String(item.patronStatus || "").toLowerCase() === "active" && String(item.patronUserId || "").trim();
  }).length;

  if (plazaAtlasSummary) {
    plazaAtlasSummary.innerHTML = [
      `${items.length} Plazas`,
      `${totalCountries} Countries`,
      `${activePatrons} Active Patrons`
    ].map((meta) => `<span class="yh-plaza-view-chip">${escapeHtml(meta)}</span>`).join("");
  }

  if (!items.length) {
    plazaAtlasGrid.innerHTML = `<div class="yh-plaza-empty">No Plaza topology data is available yet.</div>`;
    return;
  }

  plazaAtlasGrid.innerHTML = items.map((item) => {
    const patronActive = String(item.patronStatus || "").toLowerCase() === "active" && String(item.patronUserId || "").trim();

    return `
      <article class="yh-plaza-atlas-card">
        ${renderPlazaTopologyVisual(item)}

        <div class="yh-plaza-atlas-card-body">
          <div class="yh-plaza-region-card-head">
            <span class="yh-plaza-region-badge">${escapeHtml(item.label || item.region)}</span>
            <span class="yh-plaza-region-badge">${escapeHtml(String(safeArray(item.countries).length))} countries</span>
          </div>

          <h3>${escapeHtml(item.region)}</h3>
          <p>${escapeHtml(item.text || "Official Plaza topology layer.")}</p>

          <div class="yh-plaza-card-note">
            <strong>Patron / Leader:</strong>
            ${escapeHtml(patronActive ? item.patronName : "Open for approved applicant")}
          </div>

          ${renderPatronBenefitsPreview(item)}

          <div class="yh-plaza-card-actions">
            <button type="button" class="yh-plaza-ghost-btn" data-atlas-region-id="${escapeHtml(item.id)}">Open Hub</button>
            <button type="button" class="yh-plaza-ghost-btn" data-patron-apply-region="${escapeHtml(item.id)}">Apply as Patron</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function openAtlasScreen(options = {}) {
  renderAtlasScreen();
  openScreen("atlas", options);
}

function populatePatronRegionSelect() {
  if (!plazaPatronRegionSelect) return;

  const regions = getPlazaRegionsForRender();

  plazaPatronRegionSelect.innerHTML = `<option value="">Select Plaza</option>`;

  regions.forEach((region) => {
    const patronActive = String(region.patronStatus || "").toLowerCase() === "active" && String(region.patronUserId || "").trim();
    const option = document.createElement("option");

    option.value = region.id;
    option.textContent = `${region.region}${patronActive ? ` • Current Patron: ${region.patronName}` : " • Open"}`;

    plazaPatronRegionSelect.appendChild(option);
  });
}

function renderPlazaPatronApplicationStatus() {
  if (!plazaPatronApplicationStatusCard) return;

  const application = plazaMyPatronApplication;

  if (!application) {
    plazaPatronApplicationStatusCard.hidden = true;
    plazaPatronApplicationStatusCard.innerHTML = "";
    return;
  }

  plazaPatronApplicationStatusCard.hidden = false;
  plazaPatronApplicationStatusCard.innerHTML = `
    <strong>Your Patron application is ${escapeHtml(application.status || "Under Review")}.</strong>
    <p>
      Plaza: ${escapeHtml(application.region || "Selected Plaza")} • Role: ${escapeHtml(application.preferredRole || "Regional Patron")}
    </p>
    <p>
      If approved, you receive official Plaza leadership status, regional coordination authority, meetup control, Federation recommendation power, and commission eligibility from verified connection outcomes.
    </p>
  `;
}

async function loadPlazaPatronApplicationStatus(options = {}) {
  if (plazaPatronApplicationLoading) return plazaMyPatronApplication;

  plazaPatronApplicationLoading = true;

  try {
    const result = await plazaApiFetch("/api/plaza/patron-application-status");
    plazaMyPatronApplication = result.application || null;
    plazaMyPatronApplicationLoaded = true;

    renderPlazaPatronApplicationStatus();

    return plazaMyPatronApplication;
  } catch (error) {
    console.error("loadPlazaPatronApplicationStatus error:", error);

    if (options.silent !== true && typeof showToast === "function") {
      showToast(error.message || "Could not load Patron application status.", "error");
    }

    return null;
  } finally {
    plazaPatronApplicationLoading = false;
  }
}

async function submitPlazaPatronApplicationPayload(payload = {}) {
  const result = await plazaApiFetch("/api/plaza/patron-applications", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  plazaMyPatronApplication = result.application || null;
  plazaMyPatronApplicationLoaded = true;

  renderPlazaPatronApplicationStatus();

  return plazaMyPatronApplication;
}

function openPatronApplicationScreen(options = {}) {
  populatePatronRegionSelect();
  renderPatronBenefitsScreen();
  renderPlazaPatronApplicationStatus();
  openScreen("patron", options);
}

function prefillPatronApplicationFromRegion(regionId = "") {
  populatePatronRegionSelect();

  if (plazaPatronRegionSelect) {
    plazaPatronRegionSelect.value = String(regionId || "");
  }

  openPatronApplicationScreen({ resetHistory: false, pushHistory: true });
}
function renderRegions() {
  if (!plazaRegionGrid) return;

  const items = getPlazaRegionsForRender();

  if (!items.length) {
    plazaRegionGrid.innerHTML = `<div class="yh-plaza-empty">No regional hubs yet.</div>`;
    return;
  }

  plazaRegionGrid.innerHTML = items.map((item) => {
    const countryCount = Number(item.countryCount || safeArray(item.countries).length || 0);
    const countLabel = countryCount
      ? `${countryCount} countries`
      : `${Number(item.count || 0)} members`;

    return `
      <article class="yh-plaza-region-card">
        <div class="yh-plaza-region-card-head">
          <span class="yh-plaza-region-badge">${escapeHtml(item.label)}</span>
          <span class="yh-plaza-region-badge">${escapeHtml(countLabel)}</span>
        </div>
        ${renderPlazaTopologyVisual(item)}
        <h3>${escapeHtml(item.region)}</h3>
        <p>${escapeHtml(item.text)}</p>
        ${renderPlazaRegionCountryList(item)}
        <div class="yh-plaza-card-note">
          <strong>Patron / Leader:</strong>
          ${escapeHtml(
            String(item.patronStatus || "").toLowerCase() === "active" && String(item.patronUserId || "").trim()
              ? item.patronName
              : "Open for approved applicant"
          )}
        </div>
        ${renderPatronBenefitsPreview(item)}
        <div class="yh-plaza-card-actions">
          <button type="button" class="yh-plaza-ghost-btn" data-region-id="${escapeHtml(item.id)}">Enter Region Hub</button>
          <button type="button" class="yh-plaza-ghost-btn" data-patron-apply-region="${escapeHtml(item.id)}">Apply as Patron</button>
        </div>
      </article>
    `;
  }).join("");
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
function populateMeetupRegionSelect() {
  if (!plazaMeetupRegionSelect) return;

  const regions = getPlazaRegionsForRender();

  plazaMeetupRegionSelect.innerHTML = `<option value="">Select Plaza</option>`;

  regions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region.id;
    option.textContent = `${region.region}${region.patronName ? ` • ${region.patronName}` : ""}`;
    plazaMeetupRegionSelect.appendChild(option);
  });
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


function readPlazaConversationSeenMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAZA_CONVERSATION_SEEN_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writePlazaConversationSeenMap(map = {}) {
  try {
    localStorage.setItem(PLAZA_CONVERSATION_SEEN_KEY, JSON.stringify(map || {}));
  } catch (_) {}
}

function getPlazaConversationTimestamp(value = "") {
  const ts = new Date(value || "").getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function getPlazaConversationLatestTs(item = {}) {
  const messageTimes = safeArray(item.messages)
    .map((message) => getPlazaConversationTimestamp(message && message.createdAt))
    .filter(Boolean);

  return Math.max(
    getPlazaConversationTimestamp(item.updatedAt),
    getPlazaConversationTimestamp(item.createdAt),
    ...messageTimes,
    0
  );
}

function bootstrapPlazaConversationSeenBaseline(items = []) {
  try {
    if (localStorage.getItem(PLAZA_CONVERSATION_SEEN_BOOTSTRAPPED_KEY) === "1") return;

    const map = readPlazaConversationSeenMap();

    safeArray(items).forEach((item) => {
      const id = String(item && item.id || "").trim();
      if (!id) return;

      map[id] = Math.max(Number(map[id] || 0), getPlazaConversationLatestTs(item), Date.now());
    });

    writePlazaConversationSeenMap(map);
    localStorage.setItem(PLAZA_CONVERSATION_SEEN_BOOTSTRAPPED_KEY, "1");
  } catch (_) {}
}

function isPlazaConversationUnread(item = {}) {
  const id = String(item && item.id || "").trim();
  if (!id) return false;

  const map = readPlazaConversationSeenMap();
  const seenTs = Number(map[id] || 0) || 0;
  const latestTs = getPlazaConversationLatestTs(item);

  return latestTs > seenTs;
}

function markPlazaConversationSeen(item = {}) {
  const id = String(item && item.id || "").trim();
  if (!id) return;

  const map = readPlazaConversationSeenMap();

  map[id] = Math.max(
    Number(map[id] || 0) || 0,
    getPlazaConversationLatestTs(item),
    Date.now()
  );

  writePlazaConversationSeenMap(map);
}

function getPlazaUnreadConversationCount(items = []) {
  return safeArray(items).filter(isPlazaConversationUnread).length;
}

function getPlazaConversationLatestLabel(item = {}) {
  const latestTs = getPlazaConversationLatestTs(item);
  return latestTs ? formatDate(new Date(latestTs).toISOString()) : formatDate(item.updatedAt || item.createdAt);
}


function upsertPlazaRealtimeConversation(conversation = {}) {
  const normalized = normalizeServerConversationItem(conversation);
  if (!normalized || !normalized.id) return null;

  plazaServerMessages = [
    normalized,
    ...plazaServerMessages.filter((item) => item.id !== normalized.id)
  ];

  plazaServerMessagesLoaded = true;
  renderMessagesScreen();

  if (plazaRuntime.activeConversationId === normalized.id) {
    renderConversationScreen(normalized);
  }

  return normalized;
}

function joinPlazaRealtimeConversation(conversationId = "") {
  const cleanId = String(conversationId || "").trim();

  if (!cleanId || !plazaBusinessSocket || typeof plazaBusinessSocket.emit !== "function") return;

  plazaBusinessSocket.emit("joinBusinessChat", { conversationId: cleanId }, (response = {}) => {
    if (response && response.success && response.conversation) {
      upsertPlazaRealtimeConversation(response.conversation);
    }
  });
}

function joinAllPlazaRealtimeConversations() {
  safeArray(plazaServerMessages).forEach((conversation) => {
    joinPlazaRealtimeConversation(conversation.id);
  });
}

function installPlazaBusinessRealtime() {
  if (
    !plazaBusinessSocket ||
    typeof plazaBusinessSocket.on !== "function" ||
    plazaBusinessSocket.__yhBusinessChatRealtimeInstalled === true
  ) {
    return;
  }

  plazaBusinessSocket.__yhBusinessChatRealtimeInstalled = true;

  plazaBusinessSocket.on("connect", () => {
    joinAllPlazaRealtimeConversations();

    loadPlazaMessagesFromServer({ silent: true }).then(() => {
      joinAllPlazaRealtimeConversations();
    }).catch(() => {});
  });

  plazaBusinessSocket.on("businessChatSnapshot", (payload = {}) => {
    if (payload.conversation) {
      upsertPlazaRealtimeConversation(payload.conversation);
    }
  });

  plazaBusinessSocket.on("businessChatUpdated", (payload = {}) => {
    if (payload.conversation) {
      upsertPlazaRealtimeConversation(payload.conversation);
    }
  });

  plazaBusinessSocket.on("businessChatError", (payload = {}) => {
    if (payload && payload.message) {
      console.warn("Business Chat socket error:", payload.message);
    }
  });
}


function startPlazaConversationAutoRefresh() {
  installPlazaBusinessRealtime();
  joinAllPlazaRealtimeConversations();

  if (plazaConversationAutoRefreshTimer) return;

  plazaConversationAutoRefreshTimer = window.setInterval(() => {
    if (document.hidden) return;

    loadPlazaMessagesFromServer({ silent: true }).catch((error) => {
      console.warn("Plaza conversation auto-refresh failed:", error);
    });
  }, Math.max(PLAZA_CONVERSATION_REFRESH_MS, 300000));

  window.addEventListener("beforeunload", () => {
    if (plazaConversationAutoRefreshTimer) {
      window.clearInterval(plazaConversationAutoRefreshTimer);
      plazaConversationAutoRefreshTimer = null;
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadPlazaMessagesFromServer({ silent: true }).catch(() => {});
    }
  });
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
  const isUnread = isPlazaConversationUnread(item);
  const isBusinessChat =
    String(item.scope || "").toLowerCase() === "cross_division_business" ||
    String(item.contextRoute || "").toLowerCase().includes("cross-division");

  const statusLabel = isUnread ? "New Reply" : item.status;
  const contextMeta = [
    item.targetLabel,
    item.contextRoute || "Plaza conversation",
    isBusinessChat ? "Business Bridge" : "",
    item.businessPurpose || ""
  ].filter(Boolean);

  return `
    <article class="yh-plaza-message-card ${isUnread ? "is-unread" : ""} ${isBusinessChat ? "is-business-chat" : ""}">
      <div class="yh-plaza-message-card-head">
        <div>
          <span class="yh-plaza-queue-chip">${escapeHtml(getQueueRoleLabel(item.queueRole))}</span>
          <h3>
            <span>${escapeHtml(item.title)}</span>
            ${isUnread ? '<b class="yh-plaza-conversation-unread-badge">New</b>' : ""}
          </h3>
        </div>
        <span class="yh-plaza-kind-chip ${isUnread ? "is-unread" : ""}">${escapeHtml(statusLabel)}</span>
      </div>

      <p>${escapeHtml(lastMessage?.text || "Conversation opened but no reply has been sent yet.")}</p>

      <div class="yh-plaza-message-meta">
        ${contextMeta.map((meta) => `<span>${escapeHtml(meta)}</span>`).join("")}
        <span>${escapeHtml(getPlazaConversationLatestLabel(item))}</span>
      </div>

      <div class="yh-plaza-inline-actions">
        <button type="button" class="yh-plaza-ghost-btn" data-conversation-open="${escapeHtml(item.id)}">${escapeHtml(isUnread ? "Open New Reply" : "Open Conversation")}</button>
      </div>
    </article>
  `;
}
function normalizePatronDeskData(payload = {}) {
  return {
    isPatron: payload.isPatron === true,
    patron: payload.patron || null,
    regions: safeArray(payload.regions),
    routedRequests: safeArray(payload.routedRequests),
    recommendations: safeArray(payload.recommendations),
    payouts: safeArray(payload.payouts),
    walletPayouts: safeArray(payload.walletPayouts),
    message: String(payload.message || "")
  };
}

async function loadPlazaPatronDeskFromServer(options = {}) {
  if (plazaPatronDeskLoading) return plazaPatronDeskData;

  plazaPatronDeskLoading = true;

  if (plazaPatronDeskStatusCard && options.silent !== true) {
    plazaPatronDeskStatusCard.innerHTML = `<strong>Loading Patron Desk...</strong><p>Checking your active Plaza Patron assignment.</p>`;
  }

  try {
    const result = await plazaApiFetch("/api/plaza/patron/desk");

    plazaPatronDeskData = normalizePatronDeskData(result);
    plazaPatronDeskLoaded = true;

    renderPatronDeskScreen();

    return plazaPatronDeskData;
  } catch (error) {
    const message = String(error?.message || "").trim();
    const isExpectedAccessGate =
      message.toLowerCase().includes("only approved plaza patrons") ||
      message.toLowerCase().includes("patron desk") ||
      message.toLowerCase().includes("not approved");

    if (!isExpectedAccessGate) {
      console.error("loadPlazaPatronDeskFromServer error:", error);
    }

    plazaPatronDeskData = {
      isPatron: false,
      patron: null,
      regions: [],
      routedRequests: [],
      recommendations: [],
      payouts: [],
      walletPayouts: [],
      message: message || "Once admin approves you as a Plaza Patron, your Patron Desk will appear here."
    };

    plazaPatronDeskLoaded = true;
    renderPatronDeskScreen();

    return plazaPatronDeskData;
  } finally {
    plazaPatronDeskLoading = false;
  }
}

function renderPatronDeskSummaryCard(label = "", value = "", note = "") {
  return `
    <article class="yh-plaza-patron-desk-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function renderPatronDeskRegionCard(region = {}) {
  return `
    <article class="yh-plaza-message-card">
      <div class="yh-plaza-message-card-head">
        <div>
          <span class="yh-plaza-queue-chip">${escapeHtml(region.continent || region.network || "Plaza")}</span>
          <h3>${escapeHtml(region.region || "Assigned Plaza")}</h3>
        </div>
        <span class="yh-plaza-kind-chip">${escapeHtml(region.patronStatus || "active")}</span>
      </div>

      <p>${escapeHtml(region.text || "You are assigned as the Patron / Leader for this Plaza region.")}</p>

      <div class="yh-plaza-message-meta">
        <span>${escapeHtml(region.network || "YH Network")}</span>
        <span>${escapeHtml(String(region.countryCount || safeArray(region.countries).length || 0))} countries</span>
        <span>${escapeHtml(region.patronRole || "Regional Patron")}</span>
      </div>
    </article>
  `;
}

function renderPatronDeskRequestCard(item = {}) {
  return `
    <article class="yh-plaza-request-card">
      <div class="yh-plaza-request-card-head">
        <div>
          <span class="yh-plaza-request-status">${escapeHtml(item.status || "Submitted")}</span>
          <h3>${escapeHtml(item.objective || "Regional request")}</h3>
        </div>
        <span class="yh-plaza-view-chip">${escapeHtml(item.region || item.patronRegion || "Plaza")}</span>
      </div>

      <div class="yh-plaza-card-note yh-plaza-card-note-strong">
        ${escapeHtml(item.targetLabel || "General Plaza request")}
      </div>

      <p>${escapeHtml(item.message || "No request message available.")}</p>

      <div class="yh-plaza-card-note">
        Route: ${escapeHtml(item.routeLabel || item.patronRouteStatus || "Patron review")}
      </div>

      ${
        item.patronActionNote
          ? `<div class="yh-plaza-card-note">Patron note: ${escapeHtml(item.patronActionNote)}</div>`
          : ""
      }

      <div class="yh-plaza-message-meta">
        <span>${escapeHtml(item.name || item.authorName || "Requester")}</span>
        <span>${escapeHtml(item.updatedAt ? formatDate(item.updatedAt) : item.createdAt ? formatDate(item.createdAt) : "Just now")}</span>
      </div>
    </article>
  `;
}

function renderPatronDeskPayoutCard(item = {}) {
  const amount = Number(item.commissionAmount || item.amount || 0);
  const currency = String(item.currency || "USD").trim().toUpperCase() || "USD";
  const status = item.payoutLedgerStatus || item.status || "pending_review";

  return `
    <article class="yh-plaza-message-card">
      <div class="yh-plaza-message-card-head">
        <div>
          <span class="yh-plaza-queue-chip">${escapeHtml(status)}</span>
          <h3>${escapeHtml(formatPlazaCurrencyAmount(amount, currency) || `${currency} ${amount}`)}</h3>
        </div>
        <span class="yh-plaza-kind-chip">${escapeHtml(item.region || item.sourceDivision || "Plaza")}</span>
      </div>

      <p>${escapeHtml(item.adminNote || item.metadata?.payoutUnlockRule || "Awaiting admin review / payout processing.")}</p>

      <div class="yh-plaza-message-meta">
        <span>Ledger: ${escapeHtml(item.payoutLedgerId || item.id || "Pending")}</span>
        <span>${escapeHtml(item.provider || "manual")}</span>
        <span>${escapeHtml(item.updatedAt ? formatDate(item.updatedAt) : item.createdAt ? formatDate(item.createdAt) : "Just now")}</span>
      </div>
    </article>
  `;
}

function renderPatronDeskRecommendationCard(item = {}) {
  return `
    <article class="yh-plaza-message-card">
      <div class="yh-plaza-message-card-head">
        <div>
          <span class="yh-plaza-queue-chip">${escapeHtml(item.status || "pending_admin_review")}</span>
          <h3>${escapeHtml(item.memberName || item.memberId || "Federation candidate")}</h3>
        </div>
        <span class="yh-plaza-kind-chip">${escapeHtml(item.region || "Plaza")}</span>
      </div>

      <p>${escapeHtml(item.reason || "No recommendation reason available.")}</p>

      <div class="yh-plaza-message-meta">
        <span>${escapeHtml(item.recommendedRole || "Recommended member")}</span>
        <span>${escapeHtml(item.updatedAt ? formatDate(item.updatedAt) : item.createdAt ? formatDate(item.createdAt) : "Just now")}</span>
      </div>
    </article>
  `;
}

function renderPatronDeskScreen() {
  const data = plazaPatronDeskData || {};
  const isPatron = data.isPatron === true;

  const regions = safeArray(data.regions);
  const routedRequests = safeArray(data.routedRequests);
  const recommendations = safeArray(data.recommendations);
  const payouts = [
    ...safeArray(data.payouts),
    ...safeArray(data.walletPayouts)
  ];

  if (plazaPatronDeskMeta) {
    plazaPatronDeskMeta.innerHTML = [
      `${regions.length} assigned Plazas`,
      `${routedRequests.length} routed requests`,
      `${payouts.length} payout records`
    ].map((item) => `<span class="yh-plaza-view-chip">${escapeHtml(item)}</span>`).join("");
  }

  if (plazaPatronDeskStatusCard) {
    if (!plazaPatronDeskLoaded) {
      plazaPatronDeskStatusCard.innerHTML = `<strong>Patron Desk ready.</strong><p>Open this tab to load your active Patron assignment.</p>`;
    } else if (!isPatron) {
      plazaPatronDeskStatusCard.innerHTML = `
        <strong>No active Patron assignment found.</strong>
        <p>${escapeHtml(data.message || "Once admin assigns you as an active Patron for a Plaza, your Desk will appear here.")}</p>
      `;
    } else {
      plazaPatronDeskStatusCard.innerHTML = `
        <strong>Active Patron Desk</strong>
        <p>${escapeHtml(data.patron?.name || "You")} currently lead ${escapeHtml(String(regions.length))} Plaza region${regions.length === 1 ? "" : "s"}.</p>
      `;
    }
  }

  if (plazaPatronDeskSummaryGrid) {
    plazaPatronDeskSummaryGrid.innerHTML = [
      renderPatronDeskSummaryCard("Assigned Plazas", regions.length, "Regions where you are the active Patron"),
      renderPatronDeskSummaryCard("Routed Requests", routedRequests.length, "Requests attached to your Patron region"),
      renderPatronDeskSummaryCard("Recommendations", recommendations.length, "Federation recommendations submitted"),
      renderPatronDeskSummaryCard("Payout Records", payouts.length, "Commission payout ledger visibility")
    ].join("");
  }

  if (plazaPatronDeskRegionsList) {
    plazaPatronDeskRegionsList.innerHTML = regions.length
      ? regions.map(renderPatronDeskRegionCard).join("")
      : `<div class="yh-plaza-empty">No assigned Patron region yet.</div>`;
  }

  if (plazaPatronDeskRequestsList) {
    plazaPatronDeskRequestsList.innerHTML = routedRequests.length
      ? routedRequests.map(renderPatronDeskRequestCard).join("")
      : `<div class="yh-plaza-empty">No routed regional requests yet.</div>`;
  }

  if (plazaPatronDeskPayoutsList) {
    plazaPatronDeskPayoutsList.innerHTML = payouts.length
      ? payouts.map(renderPatronDeskPayoutCard).join("")
      : `<div class="yh-plaza-empty">No Patron commission payout record yet.</div>`;
  }

  if (plazaPatronDeskRecommendationsList) {
    plazaPatronDeskRecommendationsList.innerHTML = recommendations.length
      ? recommendations.map(renderPatronDeskRecommendationCard).join("")
      : `<div class="yh-plaza-empty">No Federation recommendation has been logged yet.</div>`;
  }
}

function openPatronDeskScreen(options = {}) {
  renderPatronDeskScreen();
  openScreen("patron-desk", options);

  if (!isCurrentUserApprovedPlazaPatron()) {
    plazaPatronDeskLoaded = true;
    plazaPatronDeskData = {
      isPatron: false,
      patron: null,
      regions: [],
      routedRequests: [],
      recommendations: [],
      payouts: [],
      walletPayouts: [],
      message: "Patron Desk unlocks after admin approves your Plaza Patron application."
    };

    renderPatronDeskScreen();
    return;
  }

  if (!plazaPatronDeskLoaded) {
    void loadPlazaPatronDeskFromServer({ silent: false });
  }
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
function renderMeetupCard(item) {
  return `
    <article class="yh-plaza-message-card">
      <div class="yh-plaza-message-card-head">
        <div>
          <span class="yh-plaza-queue-chip">${escapeHtml(item.format)}</span>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
        <span class="yh-plaza-kind-chip">${escapeHtml(item.status)}</span>
      </div>

      <p>${escapeHtml(item.description || "No meetup brief added yet.")}</p>

      <div class="yh-plaza-message-meta">
        <span>${escapeHtml(item.region)}</span>
        <span>${escapeHtml(item.location)}</span>
        <span>${escapeHtml(item.scheduledAt ? formatDate(item.scheduledAt) : "Date pending")}</span>
      </div>

      <div class="yh-plaza-card-note">
        Patron/Leader: ${escapeHtml(item.patronName || "Plaza Patron")} • Host: ${escapeHtml(item.hostName || "Hustler")}
      </div>

      ${
        item.isOfficial
          ? `<div class="yh-plaza-card-note"><strong>Official Patron Meetup:</strong> ${escapeHtml(item.officialPatronName || item.patronName || "Plaza Patron")} ${item.patronStatusNote ? `• ${escapeHtml(item.patronStatusNote)}` : ""}</div>`
          : ""
      }
    </article>
  `;
}

function renderMeetupsScreen() {
  const items = plazaServerMeetupsLoaded ? plazaServerMeetups : [];

  if (plazaMeetupsMeta) {
    plazaMeetupsMeta.innerHTML = [
      `${items.length} planned meetups`
    ].map((item) => `<span class="yh-plaza-view-chip">${escapeHtml(item)}</span>`).join("");
  }

  if (!plazaMeetupsList) return;

  plazaMeetupsList.innerHTML = items.length
    ? items.map(renderMeetupCard).join("")
    : `<div class="yh-plaza-empty">No Plaza meetup has been planned yet.</div>`;
}

function openMeetupsScreen(options = {}) {
  populateMeetupRegionSelect();
  renderMeetupsScreen();
  openScreen("meetups", options);
}

function prefillPlazaMeetupFromRegion(regionId = "") {
  const region = getPlazaRegionById(regionId) || plazaAdapter.getRegionById(regionId);

  if (!region) {
    showToast("Region not found.");
    return;
  }

  populateMeetupRegionSelect();

  if (plazaMeetupRegionSelect) {
    plazaMeetupRegionSelect.value = region.id;
  }

  openMeetupsScreen({ resetHistory: false, pushHistory: true });
}

async function openPlazaRegionChat(regionId = "", button = null) {
  const cleanId = String(regionId || "").trim();

  if (!cleanId) {
    showToast("Region chat is missing its Plaza ID.");
    return;
  }

  await runLockedButtonAction(
    `region-chat:${cleanId}`,
    button,
    "Opening...",
    async () => {
      const conversation = await createPlazaConversationFromRegion(cleanId);

      if (conversation) {
        renderMessagesScreen();
        renderConversationScreen(conversation);
        showToast("Regional Plaza chat opened.");
      }
    }
  );
}
function renderMessagesScreen() {
  const items = plazaServerMessagesLoaded
    ? plazaServerMessages
    : plazaOpsAdapter.getConversations();

  bootstrapPlazaConversationSeenBaseline(items);

  const unreadCount = getPlazaUnreadConversationCount(items);

  if (plazaMessagesMeta) {
    plazaMessagesMeta.innerHTML = [
      `${items.length} live conversations`,
      unreadCount ? `${unreadCount} unread` : "All caught up",
      typeof renderPlazaBusinessMemberResults === "function" ? "Cross-division business bridge" : ""
    ].filter(Boolean).map((item) => `<span class="yh-plaza-view-chip ${String(item).includes("unread") ? "is-unread" : ""}">${escapeHtml(item)}</span>`).join("");
  }

  if (typeof renderPlazaBusinessMemberResults === "function") {
    renderPlazaBusinessMemberResults();
  }

  if (!plazaMessagesList) return;

  plazaMessagesList.innerHTML = items.length
    ? items.map(renderMessageCard).join("")
    : `<div class="yh-plaza-empty">No conversation is open yet. Move a request to Conversation Opened to create one.</div>`;
}


function isPlazaConversationLocked(item = {}) {
  const status = String(item && item.status || "").trim().toLowerCase();
  const moderation = item && item.moderation && typeof item.moderation === "object" ? item.moderation : {};
  const blockedBy = item && item.blockedBy && typeof item.blockedBy === "object" ? item.blockedBy : {};

  return (
    status === "closed" ||
    status === "archived" ||
    status === "blocked" ||
    moderation.closed === true ||
    moderation.blocked === true ||
    Object.values(blockedBy).some(Boolean)
  );
}

function getActivePlazaConversationItem() {
  const id = String(plazaRuntime.activeConversationId || "").trim();
  if (!id) return null;

  return plazaServerMessagesLoaded
    ? plazaServerMessages.find((conversation) => conversation.id === id) || null
    : plazaOpsAdapter.getConversationById(id);
}

function syncPlazaConversationSafetyUi(item = {}) {
  const actions = document.getElementById("plazaConversationSafetyActions");
  const form = document.getElementById("plazaConversationForm");
  const messageField = document.getElementById("plazaConversationMessageField");
  const submitBtn = form ? form.querySelector("button[type='submit']") : null;
  const locked = isPlazaConversationLocked(item);

  if (actions) {
    actions.querySelectorAll("button").forEach((button) => {
      button.disabled = !item || !item.id;
    });

    const closeBtn = actions.querySelector("[data-plaza-conversation-close]");
    const blockBtn = actions.querySelector("[data-plaza-conversation-block]");

    if (closeBtn) {
      closeBtn.textContent = locked ? "Closed" : "Close";
      closeBtn.disabled = locked;
    }

    if (blockBtn) {
      blockBtn.textContent = locked ? "Blocked" : "Block";
      blockBtn.disabled = locked;
    }
  }

  if (messageField) {
    messageField.disabled = locked;
    messageField.placeholder = locked
      ? "This Plaza conversation is closed or blocked."
      : "Write a contextual reply inside Plaza.";
  }

  if (submitBtn) submitBtn.disabled = locked;
}

async function runPlazaConversationSafetyAction(action = "", button = null) {
  const conversation = getActivePlazaConversationItem();
  const cleanAction = String(action || "").trim().toLowerCase();

  if (!conversation || !conversation.id) {
    showToast("Open a Plaza conversation first.");
    return;
  }

  let body = {};

  if (cleanAction === "report") {
    const reason = window.prompt("Why are you reporting this business chat?", "Spam, abuse, unsafe request, or misuse");
    if (!reason) return;

    const details = window.prompt("Add optional details for admin review.", "") || "";
    body = { reason, details };
  }

  if (cleanAction === "close") {
    if (!window.confirm("Close this Plaza business chat? Replies will be disabled.")) return;
    body = { note: "Closed from Plaza conversation screen." };
  }

  if (cleanAction === "block") {
    if (!window.confirm("Block this member across future Business Chats? Replies and future Business Chat starts between you will be disabled.")) return;
    body = { note: "Blocked from Plaza conversation screen.", scope: "user" };
  }

  const endpoint =
    cleanAction === "report"
      ? "report"
      : cleanAction === "close"
        ? "close"
        : cleanAction === "block"
          ? "block"
          : "";

  if (!endpoint) return;

  await runLockedButtonAction(
    "conversation-safety:" + conversation.id + ":" + endpoint,
    button,
    endpoint === "report" ? "Reporting..." : endpoint === "close" ? "Closing..." : "Blocking...",
    async () => {
      const result = await plazaApiFetch("/api/plaza/messages/" + encodeURIComponent(conversation.id) + "/" + endpoint, {
        method: "POST",
        body: JSON.stringify(body)
      });

      const updated = result.conversation ? normalizeServerConversationItem(result.conversation) : null;

      if (updated) {
        plazaServerMessages = [
          updated,
          ...plazaServerMessages.filter((item) => item.id !== updated.id)
        ];
        plazaServerMessagesLoaded = true;

        renderMessagesScreen();
        renderConversationScreen(updated);
      }

      if (endpoint === "report") showToast("Business chat reported for admin review.");
      if (endpoint === "close") showToast("Business chat closed.");
      if (endpoint === "block") showToast("Member blocked across future Business Chats.");
    }
  );
}


function renderConversationScreen(item) {
  if (!item || !plazaConversationTitle || !plazaConversationMeta || !plazaConversationThread) return;

  plazaRuntime.activeConversationId = item.id;
  joinPlazaRealtimeConversation(item.id);
  markPlazaConversationSeen(item);

  syncPlazaConversationSafetyUi(item);

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

function openInboxScreen(options = {}) {
  renderInboxScreen();
  openScreen("inbox", options);
}

function openNotificationsScreen(options = {}) {
  renderNotificationsScreen();
  openScreen("notifications", options);
}

function openMessagesScreen(options = {}) {
  renderMessagesScreen();
  openScreen("messages", options);
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

  const providerId = config.providerId || "";
  const providerName = config.providerName || "";
  const serviceCategory = config.serviceCategory || "";
  const serviceTags = config.serviceTags || "";
  const serviceProviderType = config.serviceProviderType || "";
  const servicePriceType = config.servicePriceType || "";
  const serviceDeliveryTime = config.serviceDeliveryTime || "";
  const requestIntent = config.requestIntent || "";
  const requestPriority = config.requestPriority || "normal";
  const routeKey = config.routeKey || "";
  const routeLabel = config.routeLabel || "";
  const matchingStatus = config.matchingStatus || "";
  const matchingPriority = config.matchingPriority || "";

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
        <input type="hidden" name="providerId" value="${escapeHtml(providerId)}" />
        <input type="hidden" name="providerName" value="${escapeHtml(providerName)}" />
        <input type="hidden" name="serviceCategory" value="${escapeHtml(serviceCategory)}" />
        <input type="hidden" name="serviceTags" value="${escapeHtml(serviceTags)}" />
        <input type="hidden" name="serviceProviderType" value="${escapeHtml(serviceProviderType)}" />
        <input type="hidden" name="servicePriceType" value="${escapeHtml(servicePriceType)}" />
        <input type="hidden" name="serviceDeliveryTime" value="${escapeHtml(serviceDeliveryTime)}" />
        <input type="hidden" name="requestIntent" value="${escapeHtml(requestIntent)}" />
        <input type="hidden" name="requestPriority" value="${escapeHtml(requestPriority)}" />
        <input type="hidden" name="routeKey" value="${escapeHtml(routeKey)}" />
        <input type="hidden" name="routeLabel" value="${escapeHtml(routeLabel)}" />
        <input type="hidden" name="matchingStatus" value="${escapeHtml(matchingStatus)}" />
        <input type="hidden" name="matchingPriority" value="${escapeHtml(matchingPriority)}" />
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

        <div class="yh-plaza-card-note" data-plaza-request-autosave-status hidden></div>

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

  window.requestAnimationFrame(() => {
    installPlazaRequestDraftAutosave("plazaStructuredRequestForm");
  });
}

function buildApplicationDrawer(config = {}) {
  const title = config.title || "Apply through Plazas.";
  const kicker = config.kicker || "Plazas Application";
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

        <div class="yh-plaza-card-note" data-plaza-request-autosave-status hidden></div>

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

  window.requestAnimationFrame(() => {
    installPlazaRequestDraftAutosave("plazaApplicationForm");
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
  const countries = safeArray(item.countries).map((country) => String(country || "").trim()).filter(Boolean);
  const countryCount = countries.length;
  const patronName = item.patronName || `${item.region} Patron`;
  const patronRole = item.patronRole || "Regional Patron";
  const patronHint = item.patronContactHint || `Coordinates networking, local movement, and meetup direction for ${item.region}.`;
  const regionMeetups = plazaServerMeetupsLoaded
    ? plazaServerMeetups.filter((meetup) => meetup.regionId === item.id || meetup.region === item.region)
    : [];

  plazaRegionHubTitle.textContent = item.region;
  plazaRegionHubMeta.innerHTML = [
    item.label,
    item.network || item.continent || "",
    countryCount ? `${countryCount} countries` : `${item.count} visible members`,
    "Regional clustering"
  ]
    .filter(Boolean)
    .map((meta) => `<span class="yh-plaza-view-chip">${escapeHtml(meta)}</span>`)
    .join("");

  plazaRegionHubBody.innerHTML = `
    <div class="yh-plaza-detail-grid">
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Official YH Plaza</span>
        <h3>${escapeHtml(item.region)}</h3>
        <p>${escapeHtml(item.text)}</p>
        <div class="yh-plaza-card-note">Hub label: ${escapeHtml(item.label)}</div>
        ${
          countries.length
            ? `<div class="yh-plaza-card-note"><strong>Countries inside this Plaza:</strong> ${escapeHtml(countries.join(", "))}</div>`
            : ""
        }
      </article>
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Plaza Patron / Leader</span>
        <h3>${escapeHtml(patronName)}</h3>
        <p>${escapeHtml(patronRole)} for ${escapeHtml(item.region)}.</p>
        <div class="yh-plaza-card-note">${escapeHtml(patronHint)}</div>
        ${renderPatronBenefitsPreview(item)}
        <div class="yh-plaza-card-note">
          <strong>Authority:</strong>
          Lead chat, organize meetups, route regional requests, recommend members for Federation, and qualify for verified-intro commissions.
        </div>
        <div class="yh-plaza-card-actions">
          <button type="button" class="yh-plaza-ghost-btn" data-region-chat="${escapeHtml(item.id)}">Open Plaza Chat</button>
          <button type="button" class="yh-plaza-ghost-btn" data-region-meetup="${escapeHtml(item.id)}">Plan Meetup</button>
          <button type="button" class="yh-plaza-ghost-btn" data-patron-apply-region="${escapeHtml(item.id)}">Apply as Patron</button>
        </div>
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
      <article class="yh-plaza-detail-block">
        <span class="yh-plaza-view-chip">Upcoming meetups</span>
        ${
          regionMeetups.length
            ? regionMeetups.map(renderMeetupCard).join("")
            : `<div class="yh-plaza-empty">No meetup has been planned for this Plaza yet.</div>`
        }
      </article>
      <article class="yh-plaza-detail-block">
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

function renderPlazaUniverseProfileBody(profile = {}, item = null) {
  const divisions = profile.divisions || {};
  const signals = profile.signals || {};
  const targetUserId = String(profile.targetUid || profile.uid || profile.id || item?.userId || item?.authorId || item?.id || "").trim();

  const divisionChips = Object.values(divisions)
    .filter(Boolean)
    .map((division) => {
      const status = division.isMember ? "Member" : (division.statusLabel || "Not Applied");
      return `<span>${escapeHtml(division.label || division.key)}: ${escapeHtml(status)}</span>`;
    })
    .join("");

  const lookingFor = safeArray(signals.lookingFor);
  const canOffer = safeArray(signals.canOffer);
  const tags = safeArray(signals.tags);

  return `
    <div class="yh-universe-profile-card">
      <div class="yh-universe-profile-cover">
        ${profile.coverPhoto ? `<img src="${escapeHtml(profile.coverPhoto)}" alt="">` : ""}
      </div>

      <div class="yh-universe-profile-head">
        <div class="yh-universe-profile-avatar">
          ${
            profile.avatar
              ? `<img src="${escapeHtml(profile.avatar)}" alt="${escapeHtml(profile.fullName || "YH Member")}">`
              : `<span>${escapeHtml(String(profile.fullName || profile.displayName || "Y").charAt(0).toUpperCase())}</span>`
          }
        </div>

        <div>
          <h4>${escapeHtml(profile.fullName || profile.displayName || item?.name || "YH Member")}</h4>
          <p>${escapeHtml(profile.username ? `@${profile.username}` : profile.trustTier || "YH Universe Member")}</p>
        </div>
      </div>

      <p class="yh-universe-profile-bio">${escapeHtml(profile.bio || item?.focus || "No profile bio added yet.")}</p>

      <div class="yh-universe-profile-meta">
        ${profile.city || profile.country ? `<span>${escapeHtml([profile.city, profile.country].filter(Boolean).join(", "))}</span>` : ""}
        ${profile.trustTier ? `<span>${escapeHtml(profile.trustTier)}</span>` : ""}
        ${signals.availability ? `<span>${escapeHtml(signals.availability)}</span>` : ""}
        ${signals.workMode ? `<span>${escapeHtml(signals.workMode)}</span>` : ""}
      </div>

      ${divisionChips ? `<div class="yh-universe-profile-divisions">${divisionChips}</div>` : ""}

      ${lookingFor.length ? `
        <div class="yh-universe-profile-signal">
          <strong>Looking For</strong>
          <div>${lookingFor.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}</div>
        </div>
      ` : ""}

      ${canOffer.length ? `
        <div class="yh-universe-profile-signal">
          <strong>Can Offer</strong>
          <div>${canOffer.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}</div>
        </div>
      ` : ""}

      ${tags.length ? `
        <div class="yh-universe-profile-signal">
          <strong>Tags</strong>
          <div>${tags.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}</div>
        </div>
      ` : ""}

      <div class="yh-universe-profile-actions">
        <button type="button" class="yh-plaza-btn yh-plaza-btn-primary" data-plaza-profile-message="${escapeHtml(targetUserId)}">
          Message in Plaza
        </button>
        ${item ? `
          <button type="button" class="yh-plaza-btn yh-plaza-btn-secondary" data-member-id="${escapeHtml(item.id)}">
            Request Connection
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

async function openPlazaUniverseProfile(targetUserId = "", fallbackItem = null) {
  const cleanId = String(targetUserId || "").trim();

  if (!cleanId) {
    showToast("This member profile is missing a user id.");
    return;
  }

  openModal({
    kicker: "YH Universe Profile",
    title: "Loading profile...",
    bodyHtml: `<div class="yh-plaza-modal-copy">Loading unified YH Universe profile...</div>`
  });

  try {
    const result = await plazaApiFetch(`/api/universe/profile/${encodeURIComponent(cleanId)}`);
    const profile = result.profile || {};

    if (plazaModalTitle) {
      plazaModalTitle.textContent = profile.fullName || profile.displayName || fallbackItem?.name || "YH Universe Profile";
    }

    if (plazaModalBody) {
      plazaModalBody.innerHTML = renderPlazaUniverseProfileBody(profile, fallbackItem);
    }
  } catch (error) {
    console.error("openPlazaUniverseProfile error:", error);

    if (plazaModalTitle) {
      plazaModalTitle.textContent = "Profile unavailable";
    }

    if (plazaModalBody) {
      plazaModalBody.innerHTML = `
        <div class="yh-plaza-modal-copy">
          ${escapeHtml(error.message || "Could not load this member profile.")}
        </div>
      `;
    }
  }
}

async function openPlazaScopedMemberMessage(targetUserId = "", button = null) {
  const cleanId = String(targetUserId || "").trim();

  if (!cleanId) {
    showToast("This member is missing a user id.");
    return;
  }

  const originalText = button?.textContent || "";

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Opening...";
    }

    const conversation = await createPlazaConversationFromMember(cleanId);

    if (conversation) {
      closeModal();
      renderMessagesScreen();
      renderConversationScreen(conversation);
      showToast("Plaza conversation opened.");
    }
  } catch (error) {
    console.error("openPlazaScopedMemberMessage error:", error);
    showToast(error.message || "Could not open Plaza message.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

function handleDetailPrimaryAction(action) {
  if (!action) return;

  if (action.startsWith("request-opportunity:")) {
    const id = action.split(":")[1];
    const item = getPlazaOpportunityById(id) || plazaAdapter.getOpportunityById(id) || plazaAdapter.getFeedById(id);
    if (!item) return;

    const normalizedOpportunityObjective = getPlazaOpportunityRequestObjective(item);
    const sourceType = getPlazaOpportunityRequestSourceType(item);
    const economyContext = buildPlazaOpportunityEconomyContext(item);
    const requestContext = [
      item.type || item.tag || "Opportunity",
      economyContext
    ].filter(Boolean).join(" • ");

    const routeMeta = buildPlazaOpportunityRequestRoutingMeta(
      item,
      sourceType,
      normalizedOpportunityObjective
    );

    if (normalizedOpportunityObjective === "Hiring") {
      buildApplicationDrawer({
        kicker: "Plazas Application",
        title: item.title,
        sourceType,
        targetId: item.id,
        targetLabel: item.title,
        region: item.region,
        context: requestContext,
        message: buildPlazaOpportunityRequestMessage(item),
        submitLabel: getPlazaOpportunityPrimaryActionLabel(item),
        ...routeMeta
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
    const item = getPlazaRegionById(id) || plazaAdapter.getRegionById(id);
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
      const targetTab = button.dataset.navTab || "feed";

      if (targetTab === "inbox") {
        openInboxScreen({ resetHistory: true, pushHistory: false });
        return;
      }

      if (targetTab === "messages") {
        openMessagesScreen({ resetHistory: true, pushHistory: false });
        return;
      }

      if (targetTab === "meetups") {
        openMeetupsScreen({ resetHistory: true, pushHistory: false });
        return;
      }

      if (targetTab === "atlas") {
        openAtlasScreen({ resetHistory: true, pushHistory: false });
        return;
      }

      if (targetTab === "patron") {
        openPatronApplicationScreen({ resetHistory: true, pushHistory: false });
        return;
      }

      if (targetTab === "patron-desk") {
        openPatronDeskScreen({ resetHistory: true, pushHistory: false });
        return;
      }

      openScreen(targetTab, { resetHistory: true, pushHistory: false });
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

    const plazaConversationReportBtn = target.closest("[data-plaza-conversation-report]");
    if (plazaConversationReportBtn instanceof HTMLButtonElement) {
      void runPlazaConversationSafetyAction("report", plazaConversationReportBtn);
      return;
    }

    const plazaConversationCloseBtn = target.closest("[data-plaza-conversation-close]");
    if (plazaConversationCloseBtn instanceof HTMLButtonElement) {
      void runPlazaConversationSafetyAction("close", plazaConversationCloseBtn);
      return;
    }

    const plazaConversationBlockBtn = target.closest("[data-plaza-conversation-block]");
    if (plazaConversationBlockBtn instanceof HTMLButtonElement) {
      void runPlazaConversationSafetyAction("block", plazaConversationBlockBtn);
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

    const plazaProfileBtn = target.closest("[data-plaza-profile-id]");
    if (plazaProfileBtn instanceof HTMLElement) {
      const targetUserId = plazaProfileBtn.dataset.plazaProfileId || "";
      void openPlazaUniverseProfileFromCard(targetUserId);
      return;
    }

    const plazaProfileMessageBtn = target.closest("[data-plaza-profile-message]");
    if (plazaProfileMessageBtn instanceof HTMLButtonElement) {
      const targetUserId = plazaProfileMessageBtn.dataset.plazaProfileMessage || "";
      void openPlazaScopedMemberMessage(targetUserId, plazaProfileMessageBtn);
      return;
    }

    const memberBtn = target.closest("[data-member-id]");
    if (memberBtn instanceof HTMLElement) {
      openMemberRequest(getPlazaDirectoryItemById(memberBtn.dataset.memberId));
      return;
    }

    const opportunityBtn = target.closest("[data-opportunity-id]");
    if (opportunityBtn instanceof HTMLElement) {
      const opportunity = getPlazaOpportunityById(opportunityBtn.dataset.opportunityId) || plazaAdapter.getOpportunityById(opportunityBtn.dataset.opportunityId);
      renderOpportunityDetailScreen(opportunity);
      return;
    }

    const atlasRegionBtn = target.closest("[data-atlas-region-id]");
    if (atlasRegionBtn instanceof HTMLElement) {
      const region = getPlazaRegionById(atlasRegionBtn.dataset.atlasRegionId) || plazaAdapter.getRegionById(atlasRegionBtn.dataset.atlasRegionId);
      renderRegionHubScreen(region);
      return;
    }

    const patronApplyBtn = target.closest("[data-patron-apply-region]");
    if (patronApplyBtn instanceof HTMLElement) {
      prefillPatronApplicationFromRegion(patronApplyBtn.dataset.patronApplyRegion || "");
      return;
    }

    const regionMeetupBtn = target.closest("[data-region-meetup]");
    if (regionMeetupBtn instanceof HTMLElement) {
      prefillPlazaMeetupFromRegion(regionMeetupBtn.dataset.regionMeetup || "");
      return;
    }

    const regionBtn = target.closest("[data-region-id]");
    if (regionBtn instanceof HTMLElement) {
      const region = getPlazaRegionById(regionBtn.dataset.regionId) || plazaAdapter.getRegionById(regionBtn.dataset.regionId);
      renderRegionHubScreen(region);
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
        async () => {
          const updatedRequest = plazaServerRequestsLoaded
            ? await updatePlazaRequestOnServer(requestId, { status: "Closed" })
            : plazaAdapter.closeRequest(requestId);

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

const plazaPaymentLedgerBtn = target.closest("[data-plaza-payment-ledger]");
if (plazaPaymentLedgerBtn instanceof HTMLButtonElement) {
  const opportunityId = plazaPaymentLedgerBtn.dataset.plazaPaymentLedger || "";
  openPlazaOpportunityPaymentModal(opportunityId, "draft");
  return;
}

const plazaMarkPaidBtn = target.closest("[data-plaza-mark-paid]");
if (plazaMarkPaidBtn instanceof HTMLButtonElement) {
  showToast("Manual paid settlement is now handled by Admin inside the Economy panel.");
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

    if (form.id === "plazaBusinessMemberSearchForm") {
      event.preventDefault();
      const submitButton = event.submitter instanceof HTMLButtonElement ? event.submitter : null;

      await runLockedButtonAction(
        "form:plazaBusinessMemberSearchForm",
        submitButton,
        "Searching...",
        async () => {
          await loadPlazaBusinessMembers();
          showToast("Cross-division member search updated.");
        }
      );

      return;
    }

    if (form.id === "plaza-payment-ledger-form") {
      event.preventDefault();

      const submitButton = event.submitter instanceof HTMLButtonElement
        ? event.submitter
        : form.querySelector("button[type='submit']");

      const opportunityId = form.dataset.opportunityId || "";
      const paymentMode = form.dataset.paymentMode || "draft";
      const amount = Number(new FormData(form).get("amount") || 0);
      const currency = String(new FormData(form).get("currency") || "USD").trim().toUpperCase() || "USD";
      const commissionInput = Number(new FormData(form).get("commissionRate") || 20);
      const commissionRate = commissionInput > 1 ? commissionInput / 100 : commissionInput;

      if (!amount || amount <= 0) {
        showToast("Enter a valid Plaza deal amount.");
        return;
      }

      await runLockedButtonAction(
        `plaza-payment-ledger:${opportunityId}:draft`,
        submitButton,
        "Creating Ledger...",
        async () => {
          await createPlazaOpportunityPaymentLedger(opportunityId, {
            amount,
            currency,
            commissionRate,
            provider: "unselected",
            paymentMethod: "unselected",
            paymentStatus: "draft",
            markPaid: false,
            settleNow: false
          });

          closeModal();
          showToast("Plaza payment ledger created. Admin must mark it paid before payout is unlocked. Off-platform transactions remain at users’ own risk.");
        }
      );

      return;
    }

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
          message: String(data.get("message") || ""),

          providerId: String(data.get("providerId") || ""),
          providerName: String(data.get("providerName") || ""),
          serviceCategory: String(data.get("serviceCategory") || ""),
          serviceTags: String(data.get("serviceTags") || ""),
          serviceProviderType: String(data.get("serviceProviderType") || ""),
          servicePriceType: String(data.get("servicePriceType") || ""),
          serviceDeliveryTime: String(data.get("serviceDeliveryTime") || ""),
          requestIntent: String(data.get("requestIntent") || ""),
          requestPriority: String(data.get("requestPriority") || "normal"),

          routeKey: String(data.get("routeKey") || ""),
          routeLabel: String(data.get("routeLabel") || ""),
          matchingStatus: String(data.get("matchingStatus") || ""),
          matchingPriority: String(data.get("matchingPriority") || "")
        };

        const targetStatus =
          submitMode === "draft"
            ? "Draft"
            : existingRequest && (existingRequest.status === "Draft" || existingRequest.status === "Closed")
              ? "Submitted"
              : existingRequest?.status || "Submitted";

        let savedRequest = null;

        if (requestId && plazaServerRequestsLoaded && typeof updatePlazaRequestOnServer === "function") {
          try {
            savedRequest = await updatePlazaRequestOnServer(requestId, {
              ...payload,
              status: targetStatus
            });
          } catch (error) {
            console.error("update structured Plaza request on server failed:", error);
          }
        }

        if (!savedRequest) {
          try {
            savedRequest = await createPlazaRequest({
              ...payload,
              status: targetStatus
            });
          } catch (error) {
            console.error("create structured Plaza request on server failed:", error);
          }
        }

        if (!savedRequest) {
          savedRequest = existingRequest
            ? plazaAdapter.updateRequest(requestId, {
                ...payload,
                status: targetStatus
              })
            : plazaAdapter.createRequest({
                ...payload,
                status: targetStatus
              });
        }

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

        let savedRequest = null;

        if (requestId && plazaServerRequestsLoaded && typeof updatePlazaRequestOnServer === "function") {
          try {
            savedRequest = await updatePlazaRequestOnServer(requestId, {
              ...payload,
              status: targetStatus
            });
          } catch (error) {
            console.error("update Plaza application request on server failed:", error);
          }
        }

        if (!savedRequest) {
          try {
            savedRequest = await createPlazaRequest({
              ...payload,
              status: targetStatus
            });
          } catch (error) {
            console.error("create Plaza application request on server failed:", error);
          }
        }

        if (!savedRequest) {
          savedRequest = existingRequest
            ? plazaAdapter.updateRequest(requestId, {
                ...payload,
                status: targetStatus
              })
            : plazaAdapter.createRequest({
                ...payload,
                status: targetStatus
              });
        }

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

    if (isPlazaConversationLocked(getActivePlazaConversationItem())) {
      showToast("This Plaza conversation is closed or blocked. Replies are disabled.");
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
    monetizationNote: String(formData.get("monetizationNote") || "").trim(),

    serviceCategory: String(formData.get("serviceCategory") || "").trim(),
    serviceTags: String(formData.get("serviceTags") || "").trim(),
    servicePriceType: String(formData.get("servicePriceType") || "custom_quote").trim(),
    serviceDeliveryTime: String(formData.get("serviceDeliveryTime") || "").trim(),
    serviceProviderType: String(formData.get("serviceProviderType") || "plaza_provider").trim(),
    serviceRequirements: String(formData.get("serviceRequirements") || "").trim(),
    serviceOutcome: String(formData.get("serviceOutcome") || "").trim()
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
      showToast("Plaza opportunity submitted for admin review.", "success");
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
async function submitPlazaMeetupComposer(event) {
  event.preventDefault();

  if (!plazaMeetupComposerForm) return;

  const submitButton = plazaMeetupComposerSubmitBtn || event.submitter || null;
  const lockKey = "form:plazaMeetupComposer";

  if (plazaActionLocks.has(lockKey)) return;

  const formData = new FormData(plazaMeetupComposerForm);
  const payload = {
    regionId: String(formData.get("regionId") || "").trim(),
    format: String(formData.get("format") || "in-person").trim(),
    title: String(formData.get("title") || "").trim(),
    scheduledAt: String(formData.get("scheduledAt") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    description: String(formData.get("description") || "").trim()
  };

  if (!payload.regionId) {
    showToast("Select a Plaza first.", "error");
    return;
  }

  if (!payload.title || !payload.scheduledAt || !payload.location || !payload.description) {
    showToast("Complete the meetup details first.", "error");
    return;
  }

  plazaActionLocks.add(lockKey);
  setButtonBusy(submitButton, "Creating...");

  try {
    await createPlazaMeetup(payload);

    plazaMeetupComposerForm.reset();
    renderMeetupsScreen();

    showToast("Plaza meetup created.");
  } catch (error) {
    console.error("submitPlazaMeetupComposer error:", error);
    showToast(error.message || "Could not create Plaza meetup.", "error");
  } finally {
    clearButtonBusy(submitButton);
    plazaActionLocks.delete(lockKey);
  }
}
async function submitPlazaPatronApplicationForm(event) {
  event.preventDefault();

  if (!plazaPatronApplicationForm) return;

  const submitButton = plazaPatronApplicationSubmitBtn || event.submitter || null;
  const lockKey = "form:plazaPatronApplication";

  if (plazaActionLocks.has(lockKey)) return;

  const formData = new FormData(plazaPatronApplicationForm);
  const payload = {
    regionId: String(formData.get("regionId") || "").trim(),
    preferredRole: String(formData.get("preferredRole") || "Regional Patron").trim(),
    fullName: String(formData.get("fullName") || "").trim(),
    baseCity: String(formData.get("baseCity") || "").trim(),
    country: String(formData.get("country") || "").trim(),
    communicationHandle: String(formData.get("communicationHandle") || "").trim(),
    leadershipExperience: String(formData.get("leadershipExperience") || "").trim(),
    plazaPlan: String(formData.get("plazaPlan") || "").trim(),
    meetupPlan: String(formData.get("meetupPlan") || "").trim(),
    proofLink: String(formData.get("proofLink") || "").trim(),
    whyYou: String(formData.get("whyYou") || "").trim()
  };

  if (!payload.regionId) {
    showToast("Select the Plaza you want to lead.", "error");
    return;
  }

  if (!payload.fullName) {
    showToast("Add your name first.", "error");
    return;
  }

  if (!payload.leadershipExperience) {
    showToast("Add your leadership experience first.", "error");
    return;
  }

  if (!payload.plazaPlan) {
    showToast("Add your Plaza leadership plan first.", "error");
    return;
  }

  if (!payload.whyYou) {
    showToast("Explain why admin should choose you.", "error");
    return;
  }

  plazaActionLocks.add(lockKey);
  setButtonBusy(submitButton, "Submitting...");

  try {
    await submitPlazaPatronApplicationPayload(payload);
    showToast("Patron application submitted for admin review.", "success");
  } catch (error) {
    console.error("submitPlazaPatronApplicationForm error:", error);
    showToast(error.message || "Could not submit Patron application.", "error");
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
    message: String(formData.get("message") || "").trim(),
    requestIntent: "manual_plaza_request",
    requestPriority: "normal",
    matchingStatus: "queued_for_review",
    matchingPriority: "normal"
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
  try {
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
  } catch (error) {
    if (isExpectedPlazaInlineFetchFailure(error)) {
      return {
        hasApplication: true,
        canEnterPlaza: true,
        applicationStatus: "approved",
        application: null,
        member: null
      };
    }

    throw error;
  }
}

async function submitPlazaApplication(event) {
  event?.preventDefault?.();

  syncPlazaApplicationRequiredState();

  const payload = buildPlazaApplicationPayload();

  if (payload.membershipType === "not_yet") {
    if (typeof showToast === "function") {
      showToast("The Plazas are only open to Academy or Federation members.", "error");
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
      showToast("Plazas application submitted. Wait for admin approval.", "success");
    }
  } catch (error) {
    console.error("submitPlazaApplication error:", error);

    if (typeof showToast === "function") {
      showToast(error.message || "Could not submit Plazas application.", "error");
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
      showToast(error.message || "Could not verify Plazas access.", "error");
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
  populateMeetupRegionSelect();

  const restoredScreen = restorePlazaUiState();
  markPlazaDashboardChildLoading(restoredScreen);

  plazaFeedFilters.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.feedFilter === plazaRuntime.feedFilter);
  });

  renderFeed(plazaRuntime.feedFilter);
  renderDirectory();
  renderOpportunities();
  renderRegions();
  renderAtlasScreen();
  populatePatronRegionSelect();
  renderPatronBenefitsScreen();
  renderPlazaPatronApplicationStatus();
  renderPatronDeskScreen();
  renderBridge();
  renderRailSignals();
  renderRequestsPreview();
  renderRequestsScreen();
  renderInboxScreen();
  renderNotificationsScreen();
  renderMessagesScreen();
  renderMeetupsScreen();
  renderOperationalPreviews();
openScreen(restoredScreen, {
  resetHistory: true,
  pushHistory: false,
  showLoader: false,
  deferDashboardReady: true
});
  bindEvents();

  window.requestAnimationFrame(() => {
    markPlazaDashboardChildReady(restoredScreen, "active-screen-rendered");
  });

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

if (plazaMeetupComposerForm) {
  plazaMeetupComposerForm.addEventListener("submit", submitPlazaMeetupComposer);
}

if (plazaPatronApplicationForm) {
  plazaPatronApplicationForm.addEventListener("submit", submitPlazaPatronApplicationForm);
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
  silent: restoredScreen !== "regions" && restoredScreen !== "atlas" && restoredScreen !== "patron"
});

await loadPlazaPatronApplicationStatus({
  silent: restoredScreen !== "patron"
});

if (isCurrentUserApprovedPlazaPatron()) {
  await loadPlazaPatronDeskFromServer({
    silent: restoredScreen !== "patron-desk"
  });
} else {
  plazaPatronDeskLoaded = true;
  plazaPatronDeskData = {
    isPatron: false,
    patron: null,
    regions: [],
    routedRequests: [],
    recommendations: [],
    payouts: [],
    walletPayouts: [],
    message: "Patron Desk unlocks after admin approves your Plaza Patron application."
  };

  renderPatronDeskScreen();
}

await loadPlazaBridgeFromServer({
  silent: restoredScreen !== "bridge"
});

await loadPlazaRequestsFromServer({
  silent: restoredScreen !== "requests"
});

await loadPlazaMessagesFromServer({
  silent: restoredScreen !== "messages"
});

startPlazaConversationAutoRefresh();

await loadPlazaMeetupsFromServer({
  silent: restoredScreen !== "meetups"
});

  if (typeof window.translateCurrentPage === "function") {
    window.translateCurrentPage();
  }

  window.requestAnimationFrame(() => {
    markPlazaDashboardChildReady(restoredScreen, "boot-ready");
  });
}

initPlaza();

/* PATCH: Plaza dashboard embed fast ready handshake v19 */
(function installPlazaDashboardEmbedFastReadyHandshakeV19() {
    if (window.__plazaDashboardEmbedFastReadyV19Installed) return;
    window.__plazaDashboardEmbedFastReadyV19Installed = true;

    function isDashboardEmbed() {
        try {
            const url = new URL(window.location.href);
            return (
                url.searchParams.get('embed') === 'dashboard' ||
                url.searchParams.get('shell') === 'dashboard' ||
                window.parent !== window
            );
        } catch (_) {
            return window.parent !== window;
        }
    }

    function normalizeScreen(value = 'feed') {
        const clean = String(value || 'feed').trim().toLowerCase();

        if (clean === 'plaza-atlas') return 'atlas';
        if (clean === 'conversations') return 'messages';

        const allowed = new Set([
            'feed',
            'inbox',
            'messages',
            'meetups',
            'opportunities',
            'directory',
            'regions',
            'atlas',
            'patron',
            'patron-desk',
            'bridge',
            'requests'
        ]);

        return allowed.has(clean) ? clean : 'feed';
    }

    function getDashboardScreen() {
        try {
            const url = new URL(window.location.href);
            return normalizeScreen(
                url.searchParams.get('dashboardTab') ||
                url.searchParams.get('tab') ||
                url.searchParams.get('screen') ||
                url.searchParams.get('section') ||
                'feed'
            );
        } catch (_) {
            return 'feed';
        }
    }

    function workspaceKeyFromScreen(screen = 'feed') {
        const clean = normalizeScreen(screen);
        if (clean === 'messages') return 'plazas-conversations';
        if (clean === 'atlas') return 'plazas-atlas';
        return 'plazas-' + clean;
    }

    function unlockEmbedShell(reason = 'dashboard-embed') {
        if (!isDashboardEmbed()) return false;

        const screen = getDashboardScreen();

        document.body?.classList.remove('yh-plaza-access-booting', 'yh-plaza-access-locked');
        document.body?.classList.add('yh-plaza-dashboard-embed-ready');
        document.body?.setAttribute('data-yh-dashboard-child-ready', 'true');
        document.body?.setAttribute('data-yh-dashboard-active-screen', screen);
        document.body?.setAttribute('data-yh-dashboard-child-ready-reason', reason);
        document.body?.setAttribute('data-yh-dashboard-child-ready-at', String(Date.now()));

        const gate = document.getElementById('plazaAccessGate');
        if (gate) gate.hidden = true;

        const shell = document.querySelector('.yh-plaza-shell');
        if (shell instanceof HTMLElement) {
            shell.style.setProperty('visibility', 'visible', 'important');
            shell.style.removeProperty('display');
        }

        const loader = document.getElementById('yh-tab-loader');
        if (loader) {
            loader.hidden = true;
            loader.classList.remove('is-active');
            loader.setAttribute('aria-hidden', 'true');
        }

        try {
            if (typeof showScreen === 'function') {
                showScreen(screen);
            } else {
                const btn = document.querySelector('[data-nav-tab="' + screen + '"]');
                if (btn && typeof btn.click === 'function' && !btn.classList.contains('is-active')) {
                    btn.click();
                }
            }
        } catch (_) {
            try {
                const btn = document.querySelector('[data-nav-tab="' + screen + '"]');
                if (btn && typeof btn.click === 'function') btn.click();
            } catch (_) {}
        }

        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(
                    {
                        type: 'yh:child-workspace-ready',
                        division: 'plazas',
                        workspaceKey: workspaceKeyFromScreen(screen),
                        screen,
                        reason
                    },
                    window.location.origin
                );
            }
        } catch (_) {}

        return true;
    }

    function boot(reason = 'boot') {
        if (!isDashboardEmbed()) return;

        unlockEmbedShell(reason);

        window.requestAnimationFrame(() => unlockEmbedShell(reason + '-paint'));
        window.setTimeout(() => unlockEmbedShell(reason + '-quick'), 220);
        window.setTimeout(() => unlockEmbedShell(reason + '-late'), 720);
        window.setTimeout(() => unlockEmbedShell(reason + '-safe'), 1300);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => boot('dom-ready'));
    } else {
        boot('already-ready');
    }

    window.addEventListener('load', () => boot('window-load'));
    window.addEventListener('pageshow', () => boot('pageshow'));
})();
/* END PATCH: Plaza dashboard embed fast ready handshake v19 */

/* PATCH: Plaza startup loader visibility bridge v123 */
(function installPlazaStartupLoaderVisibilityBridgeV123() {
  if (window.__plazaStartupLoaderVisibilityBridgeV123Installed) return;
  window.__plazaStartupLoaderVisibilityBridgeV123Installed = true;

  let bridgeOwnsStartupLoader = false;

  function isPlazaPage() {
    return document.body?.getAttribute("data-yh-page") === "plaza";
  }

  function isStartupBooting() {
    return document.body?.classList.contains("yh-plaza-access-booting");
  }

  function getLoader() {
    return document.getElementById("yh-tab-loader");
  }

  function revealStartupLoader(reason = "startup") {
    if (!isPlazaPage() || !isStartupBooting()) return;

    const loader = getLoader();
    if (!loader) return;

    bridgeOwnsStartupLoader = true;

    loader.hidden = false;
    loader.classList.remove("hidden-step");
    loader.classList.add("is-active");
    loader.setAttribute("aria-hidden", "false");
    loader.setAttribute("data-yh-plaza-startup-loader", String(reason || "startup"));
  }

  function releaseStartupLoader(reason = "ready") {
    if (!bridgeOwnsStartupLoader) return;

    const loader = getLoader();
    bridgeOwnsStartupLoader = false;

    if (!loader) return;

    loader.classList.remove("is-active");
    loader.setAttribute("aria-hidden", "true");
    loader.setAttribute("data-yh-plaza-startup-loader-release", String(reason || "ready"));

    window.setTimeout(() => {
      if (!loader.classList.contains("is-active")) {
        loader.hidden = true;
      }
    }, 180);
  }

  function syncStartupLoader(reason = "sync") {
    if (!isPlazaPage()) return;

    if (isStartupBooting()) {
      revealStartupLoader(reason);
      return;
    }

    releaseStartupLoader(reason);
  }

  syncStartupLoader("install");

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => syncStartupLoader("dom-ready"));
  } else {
    window.requestAnimationFrame(() => syncStartupLoader("raf-ready"));
  }

  try {
    const observer = new MutationObserver(() => syncStartupLoader("body-class-change"));

    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"]
      });
    }

    window.__plazaStartupLoaderVisibilityBridgeV123Observer = observer;
  } catch (_) {}

  window.setTimeout(() => syncStartupLoader("late-check"), 400);
  window.setTimeout(() => syncStartupLoader("failsafe-check"), 5200);
})();
/* END PATCH: Plaza startup loader visibility bridge v123 */
