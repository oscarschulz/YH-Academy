const STORAGE_KEYS = {
  applications: "yh_federation_applications",
  members: "yh_federation_members",
  currentUser: "yh_federation_current_user",
  adminMode: "yh_federation_admin_mode"
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

function getApplications() {
  const applications = readStorage(STORAGE_KEYS.applications, []);
  return Array.isArray(applications) ? applications : [];
}

function setApplications(applications) {
  writeStorage(STORAGE_KEYS.applications, applications);
}

function getMembers() {
  const members = readStorage(STORAGE_KEYS.members, []);
  return Array.isArray(members) ? members : [];
}

function setMembers(members) {
  writeStorage(STORAGE_KEYS.members, members);
}

function ensureSeedMembers() {
  const existing = localStorage.getItem(STORAGE_KEYS.members);
  if (!existing) {
    setMembers(seedMembers);
  }
}

function removeMemberByEmail(emailLower) {
  const members = getMembers().filter((member) => normalizeEmail(member.email) !== emailLower);
  setMembers(members);
}

function getCurrentUser() {
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
        <a class="fed-btn fed-btn-primary" href="#referrals">Open Referrals</a>
        <a class="fed-btn fed-btn-secondary" href="#directory">Open Directory</a>
        <a class="fed-btn fed-btn-secondary" href="#status">View Access State</a>
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
      <div class="fed-sidebar-card-label">Operating Note</div>
      <h4>Current standalone mode</h4>
      <p class="fed-command-copy">
        YHF is still running in standalone local mode right now, but this structure is now prepared
        for later connection to the central admin panel. Keep using local review only as fallback while
        the wider YH environment is not yet fully accessible.
      </p>
    </article>
  `;
}

function syncFederationChrome() {
  const state = getCurrentUserState();
  const canApply = getCanApplyForCurrentState();

        const navCommand = qs("#fedNavCommand");
  const navApply = qs("#fedNavApply");
  const navAdmin = qs("#fedNavAdmin");
  const commandBtn = qs("#memberCommandBtn");
  const primaryCtaBtn = qs("#primaryCtaBtn");
  const mobileCommand = qs("#fedMobileCommand");
  const mobileApply = qs("#fedMobileApply");
  const mobileAdmin = qs("#fedMobileAdmin");
  const quickCommand = qs("#fedTopbarQuickCommand");
  const quickApply = qs("#fedTopbarQuickApply");

  const directoryKicker = qs("#directoryKicker");
  const directoryTitle = qs("#directoryTitle");
  const directoryText = qs("#directoryText");

  document.body.dataset.fedState = state.type;

  if (navCommand) navCommand.hidden = state.type !== "member";
  if (commandBtn) commandBtn.hidden = state.type !== "member";
  if (navApply) navApply.hidden = !canApply;
  if (navAdmin) navAdmin.hidden = !isAdminModeEnabled();

  if (mobileCommand) mobileCommand.hidden = state.type !== "member";
  if (mobileApply) mobileApply.hidden = !canApply;
  if (mobileAdmin) mobileAdmin.hidden = !isAdminModeEnabled();

  if (quickCommand) quickCommand.hidden = state.type !== "member";
  if (quickApply) quickApply.hidden = !canApply;

  if (primaryCtaBtn) {
    if (state.type === "member") {
      primaryCtaBtn.textContent = "Open Member Command";
      primaryCtaBtn.setAttribute("data-jump", "#command");
    } else if (state.type === "applicant" && !canApply) {
      primaryCtaBtn.textContent = "View Application Status";
      primaryCtaBtn.setAttribute("data-jump", "#status");
    } else if (state.type === "applicant" && canApply) {
      primaryCtaBtn.textContent = "Apply Again";
      primaryCtaBtn.setAttribute("data-jump", "#apply");
    } else {
      primaryCtaBtn.textContent = "Request Access";
      primaryCtaBtn.setAttribute("data-jump", "#apply");
    }
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
        'Approved member view. You are now seeing the live directory built from <strong>approved members in localStorage</strong>, including newly approved beta applications.';
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
    role: application.role,
    profession: application.role,
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
    strategicValue: application.valueBring || "",
    notes: [application.whyJoin, application.valueBring, application.introductions].filter(Boolean),
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
    if (state.type === "member") {
      const snapshot = getReferralSnapshotForMember(state.member);
      positionTitle.textContent = "You are inside the member operating layer";
      positionText.textContent = `Your command and referral tools are active in this browser session. Current referral pipeline: ${snapshot.total} total, ${snapshot.pending} still in review, ${snapshot.approved} approved.`;
    } else if (state.type === "applicant") {
      positionTitle.textContent = `Application status: ${state.application.status}`;
      positionText.textContent = "Your current device session is tied to an application already in the Federation pipeline. Directory visibility stays protected until approval is granted.";
    } else {
      positionTitle.textContent = "Open for qualified applications";
      positionText.textContent = "Visitors can request access or enter through a member referral code, but review remains manual and selective.";
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

function extractSectionId(value = "") {
  return String(value || "").replace(/^#/, "").trim();
}

function getNavigableSectionIds() {
  return qsa(".fed-section[data-section]")
    .filter((section) => !section.hidden)
    .map((section) => section.id);
}

function getPreferredDefaultSection() {
  const state = getCurrentUserState();

  if (state.type === "applicant") return "status";
  return "overview";
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
  const { syncHash = true } = options;
  const nextSectionId = getSafeSectionId(targetId);

  if (!nextSectionId) return;

  activeSectionId = nextSectionId;
  document.body.dataset.fedNavMode = "tabs";

  qsa(".fed-section[data-section]").forEach((section) => {
    if (section.hidden) {
      section.classList.remove("is-active-panel", "is-panel-hidden");
      return;
    }

    const isActive = section.id === nextSectionId;
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

  if (syncHash && typeof history !== "undefined") {
    history.replaceState(null, "", `#${nextSectionId}`);
  }
}

function refreshActiveSection() {
  const preferred = activeSectionId || extractSectionId(window.location.hash);
  setActiveSection(preferred, { syncHash: Boolean(preferred) });
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
    aiScore: 0,
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
  renderSectorExperience(activeSectorFilter);
  populateFilters();
  applyDirectoryFilters();
  renderCurrentUserPanel();
  renderMemberCommandSection();
  renderReferralSection();
  renderApplyState();
  renderAdminSection();
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

function initForm() {
  const form = qs("#federationForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const validation = validateForm(form);
    if (!validation.valid) {
      showFormFeedback(validation.message, "error");
      return;
    }

    const payload = serializeForm(form);

    try {
      saveApplication(payload);

      showFormFeedback(
        "Application received. Your profile has been added to the Federation review pipeline.",
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
document.addEventListener("DOMContentLoaded", () => {
  ensureSeedMembers();
  ensureMemberReferralCodes();
  initDirectory();
  initSectionNavigation();
  initMobileAppShell();
  initSectorExperience();
  initMapHover();
  initReferralFormAssist();
  hydrateReferralCodeFromUrl();
  initForm();
  initSessionLookup();
  initReferralActions();
  initAdminModeToggle();
  initAdminActions();
  refreshFederationUI();
  exposeHelpers();
});