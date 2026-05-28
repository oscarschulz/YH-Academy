(() => {
  'use strict';

  const API_BASE = '/api';
  const CACHE_KEY = 'yh_business_chats_page_cache_v1';
  const LAST_SEEN_KEY = 'yh_business_chats_page_seen_at_v1';
  const PURPOSE_CACHE_KEY = 'yh_business_chats_selected_purpose_v1';
  const LOOKING_FOR_JOBS_PURPOSE = 'Looking for jobs';
  const LOOKING_FOR_JOBS_SEARCH_HINT = 'jobs hiring work opportunity employment recruiter project role';

  const state = {
    conversations: [],
    members: [],
    blocks: [],
    activeId: '',
    loading: false,
    membersLoading: false,
    blocksLoading: false,
    socket: null,
    autoRefreshTimer: null,
    activeView: 'overview',
    lastMemberSearch: {
      query: '',
      division: 'all',
      ran: false
    },
    memberSearchTimer: null
  };

  const $ = (id) => document.getElementById(id);

  function getStoredToken() {
    const keys = ['yh_token', 'token', 'authToken', 'access_token'];
    const stores = [sessionStorage, localStorage];

    for (const store of stores) {
      for (const key of keys) {
        try {
          const value = String(store.getItem(key) || '').trim();
          if (value) return value;
        } catch (_) {}
      }
    }

    return '';
  }

  function escapeHtml(value = '') {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message = '', type = 'success') {
    const toast = $('businessChatToast');
    if (!toast) return;

    const cleanType = String(type || 'success').trim().toLowerCase();

    toast.textContent = String(message || '');
    toast.className =
      'bc-toast show ' +
      (cleanType === 'error'
        ? 'is-error'
        : cleanType === 'warning'
          ? 'is-warning'
          : 'is-success');

    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  function closeInlineDialogHard() {
    const dialog = $('bcInlineDialog');
    if (!dialog) return;

    dialog.classList.add('hidden-step');
    dialog.setAttribute('aria-hidden', 'true');
    dialog.removeAttribute('data-bc-dialog-open');
  }

  function openInlineDialog(options = {}) {
    return new Promise((resolve) => {
      const dialog = $('bcInlineDialog');
      const kicker = $('bcInlineDialogKicker');
      const title = $('bcInlineDialogTitle');
      const message = $('bcInlineDialogMessage');
      const closeBtn = $('bcInlineDialogClose');
      const cancelBtn = $('bcInlineDialogCancel');
      const confirmBtn = $('bcInlineDialogConfirm');
      const reasonWrap = $('bcInlineReasonWrap');
      const detailsWrap = $('bcInlineDetailsWrap');
      const reasonInput = $('bcInlineReasonInput');
      const detailsInput = $('bcInlineDetailsInput');

      if (!dialog || !confirmBtn || !cancelBtn) {
        resolve({ confirmed: false, reason: '', details: '' });
        return;
      }

      const needsReason = options.reason === true;
      const needsDetails = options.details === true;
      const tone = String(options.tone || 'primary').trim().toLowerCase();

      if (kicker) kicker.textContent = String(options.kicker || 'Business Chat Action');
      if (title) title.textContent = String(options.title || 'Confirm action');
      if (message) message.textContent = String(options.message || 'Are you sure?');

      if (reasonWrap) reasonWrap.classList.toggle('hidden-step', !needsReason);
      if (detailsWrap) detailsWrap.classList.toggle('hidden-step', !needsDetails);

      if (reasonInput) {
        reasonInput.value = String(options.defaultReason || '');
        reasonInput.placeholder = String(options.reasonPlaceholder || 'Spam, abuse, unsafe request, or misuse');
      }

      if (detailsInput) {
        detailsInput.value = String(options.defaultDetails || '');
        detailsInput.placeholder = String(options.detailsPlaceholder || 'Add optional details for admin review.');
      }

      confirmBtn.textContent = String(options.confirmText || 'Confirm');
      confirmBtn.className = tone === 'danger' ? 'bc-danger-btn' : 'bc-primary-small';
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      closeBtn && (closeBtn.disabled = false);

      dialog.classList.remove('hidden-step');
      dialog.setAttribute('aria-hidden', 'false');
      dialog.setAttribute('data-bc-dialog-open', 'true');

      window.setTimeout(() => {
        if (needsReason && reasonInput) {
          reasonInput.focus();
          return;
        }

        confirmBtn.focus();
      }, 40);

      let resolved = false;

      const cleanup = () => {
        dialog.classList.add('hidden-step');
        dialog.setAttribute('aria-hidden', 'true');
        dialog.removeAttribute('data-bc-dialog-open');

        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        closeBtn?.removeEventListener('click', onCancel);
        dialog.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKeydown);
      };

      const done = (payload) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(payload);
      };

      const onConfirm = (event = null) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        const reason = String(reasonInput?.value || '').trim();
        const details = String(detailsInput?.value || '').trim();

        if (needsReason && !reason) {
          showToast('Add a reason first.', 'warning');
          reasonInput?.focus();
          return;
        }

        done({
          confirmed: true,
          reason,
          details
        });
      };

      const onCancel = (event = null) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();

        done({
          confirmed: false,
          reason: '',
          details: ''
        });
      };

      const onBackdrop = (event) => {
        if (event.target === dialog) onCancel();
      };

      const onKeydown = (event) => {
        if (event.key === 'Escape') onCancel();
      };

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      closeBtn?.addEventListener('click', onCancel);
      dialog.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeydown);
    });
  }

  function installNativeDialogGuard() {
    try {
      window.alert = (message = '') => {
        showToast(String(message || 'Notice'), 'warning');
      };

      window.confirm = (message = '') => {
        showToast(String(message || 'Confirmation is handled inside the page.'), 'warning');
        return false;
      };

      window.prompt = (message = '') => {
        showToast(String(message || 'Input is handled inside the page.'), 'warning');
        return '';
      };
    } catch (_) {}
  }

  function setBusy(button, busy, label = '') {
    if (!button) return;

    if (busy) {
      button.dataset.originalText = button.textContent || '';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      if (label) button.textContent = label;
      return;
    }

    button.disabled = false;
    button.setAttribute('aria-busy', 'false');
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }

  function normalizeBusinessView(value = 'overview') {
    const clean = String(value || '').trim().toLowerCase();
    return ['overview', 'start', 'conversations', 'blocked'].includes(clean) ? clean : 'overview';
  }

  function setBusinessChatView(value = 'overview') {
    const view = normalizeBusinessView(value);
    state.activeView = view;

    document.body?.setAttribute('data-bc-active-view', view);

    document.querySelectorAll('[data-bc-view-tab]').forEach((button) => {
      const active = button.getAttribute('data-bc-view-tab') === view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    try {
      sessionStorage.setItem('yh_business_chats_active_view_v1', view);
    } catch (_) {}
  }

  function initBusinessChatViewTabs() {
    const params = new URLSearchParams(window.location.search);
    const targetId = String(params.get('conversationId') || '').trim();

    let savedView = '';
    try {
      savedView = sessionStorage.getItem('yh_business_chats_active_view_v1') || '';
    } catch (_) {
      savedView = '';
    }

    setBusinessChatView(targetId ? 'conversations' : (savedView || 'overview'));
  }

  function normalizeBusinessDivision(value = 'all') {
    const clean = String(value || '').trim().toLowerCase();
    return ['all', 'academy', 'plaza', 'federation'].includes(clean) ? clean : 'all';
  }

  function normalizeSearchText(value = '') {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9@._\s-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function memberMatchesBusinessDivision(member = {}, division = 'all') {
    const cleanDivision = normalizeBusinessDivision(division);
    if (cleanDivision === 'all') return true;

    const fields = [
      member.division,
      member.divisionLabel,
      member.membershipType,
      member.sourceDivision,
      member.role,
      member.headline
    ].map(normalizeSearchText).join(' ');

    return fields.includes(cleanDivision);
  }

  function getBusinessMemberSearchNeedle(member = {}) {
    const values = [
      member.id,
      member.name,
      member.username,
      member.role,
      member.location,
      member.division,
      member.divisionLabel,
      member.headline,
      member.bio,
      member.about,
      member.city,
      member.country,
      member.skill,
      member.skills,
      member.tags,
      member.canOffer,
      member.lookingFor
    ];

    return normalizeSearchText(values.flat().join(' '));
  }

  function memberMatchesBusinessSearch(member = {}, rawQuery = '', division = 'all') {
    if (!memberMatchesBusinessDivision(member, division)) return false;

    const query = normalizeSearchText(rawQuery);
    if (!query) return true;

    const haystack = getBusinessMemberSearchNeedle(member);
    return query.split(' ').filter(Boolean).every((term) => haystack.includes(term));
  }

  function filterBusinessMembersForSearch(members = [], rawQuery = '', division = 'all') {
    const seen = new Set();

    return members
      .filter((member) => memberMatchesBusinessSearch(member, rawQuery, division))
      .filter((member) => {
        const id = String(member.id || '').trim();
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
  }

  async function apiFetch(path, options = {}) {
    const token = getStoredToken();

    if (!token) {
      window.location.href = '/?redirect=business-chats';
      throw new Error('Missing login token.');
    }

    const headers = {
      Accept: 'application/json',
      ...(options.headers || {})
    };

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    headers.Authorization = 'Bearer ' + token;

    const response = await fetch(path.startsWith('/api') ? path : API_BASE + path, {
      credentials: 'include',
      ...options,
      headers
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || 'Request failed.');
    }

    return data || { success: true };
  }

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        conversations: state.conversations,
        cachedAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  function getLastSeenTs() {
    try {
      return Number(localStorage.getItem(LAST_SEEN_KEY) || 0) || 0;
    } catch (_) {
      return 0;
    }
  }

  function setLastSeenNow() {
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    } catch (_) {}
  }

  function normalizeBusinessPurpose(value = '') {
    return String(value || '').trim();
  }

  function isLookingForJobsPurpose(value = '') {
    const clean = normalizeBusinessPurpose(value).toLowerCase();
    return clean === LOOKING_FOR_JOBS_PURPOSE.toLowerCase() || clean === 'looking_for_jobs';
  }

  function ensureBusinessPurposeOptions() {
    const select = $('bcBusinessPurpose');
    if (!select) return;

    const hasLookingForJobs = Array.from(select.options || []).some((option) => {
      return isLookingForJobsPurpose(option.value || option.textContent);
    });

    if (!hasLookingForJobs) {
      const option = document.createElement('option');
      option.value = LOOKING_FOR_JOBS_PURPOSE;
      option.textContent = LOOKING_FOR_JOBS_PURPOSE;
      select.appendChild(option);
    }
  }

  function rememberBusinessPurpose(value = '') {
    try {
      localStorage.setItem(PURPOSE_CACHE_KEY, normalizeBusinessPurpose(value));
    } catch (_) {}
  }

  function restoreBusinessPurposeSelection() {
    const select = $('bcBusinessPurpose');
    if (!select) return;

    ensureBusinessPurposeOptions();

    try {
      const savedPurpose = normalizeBusinessPurpose(localStorage.getItem(PURPOSE_CACHE_KEY) || '');
      if (savedPurpose && Array.from(select.options || []).some((option) => option.value === savedPurpose)) {
        select.value = savedPurpose;
      }
    } catch (_) {}
  }

  function buildBusinessMemberSearchQuery(rawQuery = '', purpose = '') {
    const cleanQuery = String(rawQuery || '').trim();

    if (!isLookingForJobsPurpose(purpose)) {
      return cleanQuery;
    }

    return cleanQuery || LOOKING_FOR_JOBS_SEARCH_HINT;
  }

  function syncBusinessPurposeHelperText() {
    const textarea = $('bcOpeningMessage');
    const purpose = getStartPurpose();

    if (!textarea) return;

    if (isLookingForJobsPurpose(purpose)) {
      textarea.placeholder = 'Explain the type of job, project work, role, skill area, city, or opportunity you are looking for.';
      return;
    }

    textarea.placeholder = 'Explain why you want to start this business conversation.';
  }

  function formatDate(value = '') {
    const clean = String(value || '').trim();
    if (!clean) return '';

    const parsed = new Date(clean);
    if (Number.isNaN(parsed.getTime())) return clean;

    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function normalizeMessage(message = {}, index = 0) {
    return {
      id: String(message.id || 'message-' + (index + 1)),
      sender: String(message.sender || 'Member'),
      type: String(message.type || 'message'),
      text: String(message.text || ''),
      createdAt: String(message.createdAt || message.created_at || new Date().toISOString())
    };
  }

  function normalizeConversation(item = {}, index = 0) {
    const messages = Array.isArray(item.messages)
      ? item.messages.map(normalizeMessage)
      : [];

    return {
      id: String(item.id || 'business-conversation-' + (index + 1)),
      title: String(item.title || item.targetLabel || 'Business conversation'),
      targetLabel: String(item.targetLabel || ''),
      contextTitle: String(item.contextTitle || ''),
      contextRoute: String(item.contextRoute || 'Plaza business conversation'),
      sourceDivision: String(item.sourceDivision || ''),
      targetDivision: String(item.targetDivision || ''),
      businessPurpose: String(item.businessPurpose || ''),
      businessIntent: String(item.businessIntent || item.intentCategory || ''),
      jobSearchIntent:
        item.jobSearchIntent === true ||
        isLookingForJobsPurpose(item.businessPurpose || item.businessIntent || item.intentCategory || ''),
      status: String(item.status || 'active'),
      moderation: item.moderation && typeof item.moderation === 'object' ? item.moderation : {},
      blockedBy: item.blockedBy && typeof item.blockedBy === 'object' ? item.blockedBy : {},
      closedBy: item.closedBy && typeof item.closedBy === 'object' ? item.closedBy : {},
      participantIds: Array.isArray(item.participantIds) ? item.participantIds.map(String).filter(Boolean) : [],
      participants: Array.isArray(item.participants) ? item.participants.map(String).filter(Boolean) : [],
      reports: Array.isArray(item.reports) ? item.reports : [],
      messages,
      createdAt: String(item.createdAt || ''),
      updatedAt: String(item.updatedAt || item.createdAt || '')
    };
  }

  function normalizeMember(item = {}, index = 0) {
    const division = normalizeBusinessDivision(item.division || item.sourceDivision || item.membershipType || 'plaza');
    const divisionLabel = String(
      item.divisionLabel ||
      (division === 'academy' ? 'Academy' : division === 'federation' ? 'Federation' : division === 'plaza' ? 'Plaza' : 'YH Universe')
    );

    return {
      ...item,
      id: String(item.id || item.userId || item.uid || item.ownerUid || 'business-member-' + (index + 1)),
      name: String(item.name || item.fullName || item.displayName || item.username || 'YH Member'),
      username: String(item.username || '').replace(/^@+/, ''),
      division,
      divisionLabel,
      membershipType: String(item.membershipType || division),
      role: String(item.role || item.roleLabel || item.title || 'YH Universe Member'),
      location: String(item.location || [item.city, item.country].filter(Boolean).join(', ')),
      headline: String(item.headline || item.bio || item.about || item.role || ''),
      avatar: String(item.avatar || item.avatarUrl || item.avatar_url || item.profilePhoto || item.photoURL || '')
    };
  }

  function getConversationMeta(conversation = {}) {
    const purpose = isLookingForJobsPurpose(conversation.businessPurpose || conversation.businessIntent)
      ? 'Looking for jobs'
      : conversation.businessPurpose;

    return [
      purpose,
      conversation.sourceDivision && conversation.targetDivision
        ? conversation.sourceDivision + ' → ' + conversation.targetDivision
        : '',
      conversation.contextRoute
    ].filter(Boolean).join(' • ');
  }

  function getUpdatedTs(conversation = {}) {
    const timestamps = [
      conversation.updatedAt,
      conversation.createdAt,
      ...conversation.messages.map((message) => message.createdAt)
    ];

    return timestamps.reduce((best, value) => {
      const ts = new Date(value || '').getTime();
      return Number.isFinite(ts) && ts > best ? ts : best;
    }, 0);
  }

  function isBlocked(conversation = {}) {
    const status = String(conversation.status || '').trim().toLowerCase();
    const moderation = conversation.moderation && typeof conversation.moderation === 'object' ? conversation.moderation : {};
    const blockedBy = conversation.blockedBy && typeof conversation.blockedBy === 'object' ? conversation.blockedBy : {};

    return (
      status === 'blocked' ||
      moderation.blocked === true ||
      Object.values(blockedBy).some(Boolean)
    );
  }

  function isClosed(conversation = {}) {
    const status = String(conversation.status || '').trim().toLowerCase();
    const moderation = conversation.moderation && typeof conversation.moderation === 'object' ? conversation.moderation : {};

    return (
      status === 'closed' ||
      status === 'archived' ||
      moderation.closed === true
    );
  }

  function isLocked(conversation = {}) {
    return isClosed(conversation) || isBlocked(conversation);
  }

  function getActiveConversation() {
    return state.conversations.find((item) => item.id === state.activeId) || null;
  }

  function upsertConversation(rawConversation = {}) {
    const conversation = normalizeConversation(rawConversation);
    if (!conversation.id) return;

    state.conversations = [
      conversation,
      ...state.conversations.filter((item) => item.id !== conversation.id)
    ].sort((a, b) => getUpdatedTs(b) - getUpdatedTs(a));

    if (!state.activeId) state.activeId = conversation.id;
    writeCache();
    renderAll();
  }

  function renderStats() {
    const active = state.conversations.filter((item) => !isLocked(item)).length;
    const locked = state.conversations.length - active;
    const unread = state.conversations.filter((item) => getUpdatedTs(item) > getLastSeenTs()).length;

    if ($('bcStatThreads')) $('bcStatThreads').textContent = String(state.conversations.length);
    if ($('bcStatActive')) $('bcStatActive').textContent = String(active);
    if ($('bcStatUnread')) $('bcStatUnread').textContent = String(unread);
    if ($('bcStatBlocked')) $('bcStatBlocked').textContent = String(state.blocks.length || locked);
    if ($('bcConversationCount')) $('bcConversationCount').textContent = state.loading ? 'Loading...' : state.conversations.length + ' threads';
  }

  function renderList() {
    const list = $('bcConversationList');
    if (!list) return;

    if (state.loading && !state.conversations.length) {
      list.innerHTML = '<div class="bc-empty">Loading business conversations...</div>';
      return;
    }

    if (!state.conversations.length) {
      list.innerHTML = '<div class="bc-empty">No business conversations yet. Search a Plaza member above to start one.</div>';
      return;
    }

    const lastSeen = getLastSeenTs();

    list.innerHTML = state.conversations.map((conversation) => {
      const latest = conversation.messages[conversation.messages.length - 1] || {};
      const active = conversation.id === state.activeId;
      const unread = getUpdatedTs(conversation) > lastSeen;

      return `
        <button type="button" class="bc-thread-card ${active ? 'is-active' : ''} ${unread ? 'is-unread' : ''}" data-conversation-id="${escapeHtml(conversation.id)}">
          <div class="bc-thread-card-top">
            <strong>${escapeHtml(conversation.title)}</strong>
            ${unread ? '<span>New</span>' : ''}
          </div>
          <p>${escapeHtml(getConversationMeta(conversation) || 'Plaza business thread')}</p>
          <small>${escapeHtml(latest.text || 'No messages yet.')}</small>
          <em>${escapeHtml(formatDate(conversation.updatedAt || latest.createdAt || conversation.createdAt))}</em>
        </button>
      `;
    }).join('');
  }

  function renderThread() {
    const conversation = getActiveConversation();
    const title = $('bcThreadTitle');
    const meta = $('bcThreadMeta');
    const body = $('bcThreadBody');
    const input = $('bcReplyInput');
    const send = $('bcSendReply');
    const report = $('bcReportThread');
    const close = $('bcCloseThread');
    const block = $('bcBlockThread');

    if (!conversation) {
      if (title) title.textContent = 'Select a conversation';
      if (meta) meta.textContent = 'Your Plaza business threads will appear here.';
      if (body) body.innerHTML = '<div class="bc-empty">Select a thread to read the conversation and reply.</div>';
      [input, send, report, close, block].forEach((el) => { if (el) el.disabled = true; });
      return;
    }

    const closed = isClosed(conversation);
    const blocked = isBlocked(conversation);
    const locked = closed || blocked;

    if (title) title.textContent = conversation.title;
    if (meta) meta.textContent = getConversationMeta(conversation) || 'Plaza business thread';

    if (body) {
      body.innerHTML = conversation.messages.length
        ? conversation.messages.map((message) => `
            <article class="bc-message ${message.type === 'system' ? 'is-system' : ''}">
              <strong>${escapeHtml(message.sender)}</strong>
              <p>${escapeHtml(message.text)}</p>
              <span>${escapeHtml(formatDate(message.createdAt))}</span>
            </article>
          `).join('')
        : '<div class="bc-empty">No messages yet. Write the first reply below.</div>';

      body.scrollTop = body.scrollHeight;
    }

    if (input) {
      input.disabled = locked;
      input.placeholder = blocked
        ? 'This business chat is blocked.'
        : closed
          ? 'This business chat is closed.'
          : 'Write your business reply...';
    }

    if (send) send.disabled = locked;
    if (report) report.disabled = false;
    if (close) {
      close.disabled = locked;
      close.textContent = closed ? 'Closed' : 'Close';
    }
    if (block) {
      block.disabled = locked;
      block.textContent = blocked ? 'Blocked' : 'Block';
      block.title = closed && !blocked ? 'This thread is closed, not blocked.' : '';
    }
  }

  function renderMembers() {
    const results = $('bcMemberResults');
    if (!results) return;

    if (state.membersLoading) {
      results.innerHTML = '<div class="bc-empty">Searching approved YH Universe members...</div>';
      return;
    }

    if (!state.members.length) {
      results.innerHTML = state.lastMemberSearch.ran
        ? '<div class="bc-empty">No matching approved members found. Try All approved members or a broader keyword.</div>'
        : '<div class="bc-empty">Search approved Academy, Plaza, and Federation members to start a business chat.</div>';
      return;
    }

    results.innerHTML = state.members.map((member) => {
      const meta = [member.divisionLabel, member.role, member.location].filter(Boolean).join(' • ');
      const initial = escapeHtml((member.name || 'Y').charAt(0).toUpperCase());
      const avatarStyle = member.avatar ? ` style="background-image:url('${escapeHtml(member.avatar)}')"` : '';

      return `
        <article class="bc-member-card">
          <div class="bc-member-main">
            <div class="bc-avatar"${avatarStyle}>${member.avatar ? '' : initial}</div>
            <div>
              <strong>${escapeHtml(member.name)}</strong>
              <span>${escapeHtml(meta || 'Approved YH Universe member')}</span>
              ${member.headline ? `<p>${escapeHtml(member.headline)}</p>` : ''}
            </div>
          </div>
          <button type="button" class="bc-primary-small" data-start-chat="${escapeHtml(member.id)}">Open Business Chat</button>
        </article>
      `;
    }).join('');
  }

  function renderBlocks() {
    const list = $('bcBlockedList');
    if (!list) return;

    if (state.blocksLoading) {
      list.innerHTML = '<div class="bc-empty">Loading blocked members.</div>';
      return;
    }

    if (!state.blocks.length) {
      list.innerHTML = '<div class="bc-empty">No blocked business chat members.</div>';
      return;
    }

    list.innerHTML = state.blocks.map((block) => {
      const blockedId = String(
        block.blockedUserId ||
        block.otherUserId ||
        block.targetUserId ||
        block.userId ||
        block.id ||
        ''
      ).trim();

      const name = String(
        block.blockedUserName ||
        block.otherUserName ||
        block.displayName ||
        block.fullName ||
        block.name ||
        block.username ||
        'Blocked member'
      ).trim();

      const subline = [
        block.blockedUserEmail || block.otherUserEmail || block.email || '',
        block.latestConversationTitle ? 'From: ' + block.latestConversationTitle : '',
        blockedId
      ].filter(Boolean).join(' • ');

      return `
        <article class="bc-block-card">
          <div>
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(subline || blockedId || 'Blocked Business Chat member')}</span>
          </div>
          <button type="button" class="bc-ghost-small" data-unblock-id="${escapeHtml(blockedId)}" ${blockedId ? '' : 'disabled'}>Unblock</button>
        </article>
      `;
    }).join('');
  }

  function renderAll() {
    renderStats();
    renderList();
    renderThread();
    renderMembers();
    renderBlocks();
  }

  async function refreshConversations(options = {}) {
    if (!options.force) {
      const cached = readCache();
      if (Array.isArray(cached.conversations) && cached.conversations.length) {
        state.conversations = cached.conversations.map(normalizeConversation);
        renderAll();
      }
    }

    state.loading = true;
    renderList();
    renderStats();

    try {
      const data = await apiFetch('/plaza/messages?limit=160');
      state.conversations = Array.isArray(data.conversations)
        ? data.conversations.map(normalizeConversation)
        : [];

      const targetId = new URLSearchParams(window.location.search).get('conversationId') || '';
      if (targetId && state.conversations.some((item) => item.id === targetId)) {
        state.activeId = targetId;
      } else if (!state.activeId && state.conversations.length) {
        state.activeId = state.conversations[0].id;
      }

      writeCache();
      joinAllRooms();
      renderAll();
      return state.conversations;
    } catch (error) {
      console.error('refresh conversations error:', error);
      showToast(error.message || 'Failed to load business chats.', 'error');
      renderAll();
      return [];
    } finally {
      state.loading = false;
      renderList();
      renderStats();
    }
  }

  async function searchMembers(event) {
    event?.preventDefault?.();
    setBusinessChatView('start');

    const button = $('bcSearchMembers');
    const purpose = getStartPurpose();
    const rawQuery = String($('bcMemberSearch')?.value || '').trim();
    const query = buildBusinessMemberSearchQuery(rawQuery, purpose);
    const division = normalizeBusinessDivision($('bcDivisionFilter')?.value || 'all');

    state.lastMemberSearch = {
      query: rawQuery,
      division,
      ran: true
    };

    setBusy(button, true, isLookingForJobsPurpose(purpose) ? 'Finding job contacts...' : 'Searching...');
    state.membersLoading = true;
    renderMembers();

    try {
      const params = new URLSearchParams({
        q: query,
        division,
        businessPurpose: purpose,
        intentCategory: isLookingForJobsPurpose(purpose) ? 'looking_for_jobs' : 'business_chat',
        jobSearchIntent: isLookingForJobsPurpose(purpose) ? '1' : '0',
        limit: '120'
      });

      let data = await apiFetch('/plaza/business-members?' + params.toString());
      let members = Array.isArray(data.members) ? data.members : [];

      if (!members.length && rawQuery) {
        const fallbackParams = new URLSearchParams(params);
        fallbackParams.set('q', '');
        data = await apiFetch('/plaza/business-members?' + fallbackParams.toString());
        members = Array.isArray(data.members) ? data.members : [];
      }

      state.members = filterBusinessMembersForSearch(
        members.map(normalizeMember),
        rawQuery,
        division
      );

      renderMembers();

      if (isLookingForJobsPurpose(purpose) && !rawQuery) {
        showToast('Showing members connected to jobs, hiring, work, projects, or opportunities.', 'success');
      }
    } catch (error) {
      console.error('search members error:', error);
      state.members = [];
      renderMembers();
      showToast(error.message || 'Failed to search approved members.', 'error');
    } finally {
      state.membersLoading = false;
      setBusy(button, false);
      renderMembers();
    }
  }

  function getStartPurpose() {
    ensureBusinessPurposeOptions();

    const purpose = String($('bcBusinessPurpose')?.value || 'Business collaboration').trim() || 'Business collaboration';
    rememberBusinessPurpose(purpose);
    return purpose;
  }

  function getOpeningMessage() {
    const message = String($('bcOpeningMessage')?.value || '').trim();
    const purpose = getStartPurpose();

    if (message) return message;

    if (isLookingForJobsPurpose(purpose)) {
      return 'I am looking for job opportunities, project work, hiring leads, or a role that matches my skills. I would like to open this business conversation to discuss possible work opportunities.';
    }

    return 'I would like to open a Plaza business conversation for: ' + purpose;
  }

  async function startChat(targetUserId = '', button = null) {
    const cleanTargetUserId = String(targetUserId || '').trim();
    if (!cleanTargetUserId) {
      showToast('Missing member.', 'error');
      return;
    }

    setBusy(button, true, 'Opening...');

    try {
      const purpose = getStartPurpose();
      const jobSearchIntent = isLookingForJobsPurpose(purpose);

      const data = await apiFetch('/plaza/messages/from-business-member/' + encodeURIComponent(cleanTargetUserId), {
        method: 'POST',
        body: JSON.stringify({
          businessPurpose: purpose,
          businessIntent: jobSearchIntent ? 'looking_for_jobs' : 'business_chat',
          intentCategory: jobSearchIntent ? 'looking_for_jobs' : 'business_chat',
          jobSearchIntent,
          message: getOpeningMessage()
        })
      });

      if (data.conversation) {
        upsertConversation(data.conversation);
        state.activeId = normalizeConversation(data.conversation).id;
        if ($('bcOpeningMessage')) $('bcOpeningMessage').value = '';
        setBusinessChatView('conversations');
        showToast('Business chat opened.', 'success');
        setLastSeenNow();
      }
    } catch (error) {
      console.error('start chat error:', error);
      showToast(error.message || 'Failed to open business chat.', 'error');
    } finally {
      setBusy(button, false);
    }
  }

  async function submitReply(event) {
    event?.preventDefault?.();

    const conversation = getActiveConversation();
    const input = $('bcReplyInput');
    const button = $('bcSendReply');
    const text = String(input?.value || '').trim();

    if (!conversation) {
      showToast('Select a business conversation first.', 'error');
      return;
    }

    if (isLocked(conversation)) {
      showToast('This business chat is closed or blocked.', 'error');
      return;
    }

    if (!text) {
      showToast('Write a reply first.', 'error');
      return;
    }

    setBusy(button, true, 'Sending...');

    try {
      const data = await apiFetch('/plaza/messages/' + encodeURIComponent(conversation.id) + '/replies', {
        method: 'POST',
        body: JSON.stringify({ text })
      });

      if (input) input.value = '';
      if (data.conversation) upsertConversation(data.conversation);
      showToast('Reply sent.', 'success');
      setLastSeenNow();
    } catch (error) {
      console.error('send reply error:', error);
      showToast(error.message || 'Failed to send reply.', 'error');
    } finally {
      setBusy(button, false);
    }
  }

  async function runSafetyAction(action = '') {
    const conversation = getActiveConversation();
    const cleanAction = String(action || '').trim().toLowerCase();

    if (!conversation) {
      showToast('Select a business conversation first.', 'error');
      return;
    }

    let body = {};

    if (cleanAction === 'report') {
      const result = await openInlineDialog({
        kicker: 'Safety Report',
        title: 'Report this business chat?',
        message: 'Send this conversation to admin review with a clear reason and optional details.',
        confirmText: 'Submit Report',
        tone: 'danger',
        reason: true,
        details: true,
        defaultReason: 'Spam, abuse, unsafe request, or misuse',
        reasonPlaceholder: 'Reason for report',
        detailsPlaceholder: 'Add details that can help admin review this case.'
      });

      if (!result.confirmed) return;

      body = {
        reason: result.reason,
        details: result.details
      };
    } else if (cleanAction === 'close') {
      const result = await openInlineDialog({
        kicker: 'Close Thread',
        title: 'Close this business chat?',
        message: 'Replies will be disabled after closing this thread. You can still keep the conversation record.',
        confirmText: 'Close Chat',
        tone: 'danger'
      });

      if (!result.confirmed) return;

      body = {
        note: 'Closed from Business Chats page.'
      };
    } else if (cleanAction === 'block') {
      const result = await openInlineDialog({
        kicker: 'Block Member',
        title: 'Block this member?',
        message: 'This will block the member from future Business Chats with you and lock this thread.',
        confirmText: 'Block Member',
        tone: 'danger'
      });

      if (!result.confirmed) return;

      body = {
        note: 'Blocked from Business Chats page.',
        scope: 'user'
      };
    } else {
      return;
    }

    try {
      const data = await apiFetch('/plaza/messages/' + encodeURIComponent(conversation.id) + '/' + cleanAction, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (data.conversation) upsertConversation(data.conversation);
      await loadBlocks({ silent: true });

      if (cleanAction === 'report') showToast('Business chat reported for admin review.', 'success');
      if (cleanAction === 'close') showToast('Business chat closed.', 'success');
      if (cleanAction === 'block') {
        setBusinessChatView('blocked');
        showToast('Member blocked. You can unblock them from the Blocked Members tab.', 'success');
      }
    } catch (error) {
      console.error('safety action error:', error);
      showToast(error.message || 'Business chat safety action failed.', 'error');
    }
  }

  async function loadBlocks(options = {}) {
    state.blocksLoading = true;
    if (!options.silent) renderBlocks();

    try {
      const data = await apiFetch('/plaza/business-blocks');
      state.blocks = Array.isArray(data.blocks)
        ? data.blocks
        : Array.isArray(data.businessBlocks)
          ? data.businessBlocks
          : [];
      renderBlocks();
    } catch (error) {
      console.warn('load blocks error:', error);
      state.blocks = [];
      renderBlocks();
    } finally {
      state.blocksLoading = false;
      renderBlocks();
    }
  }

  async function unblockMember(blockedUserId = '', button = null) {
    const cleanId = String(blockedUserId || '').trim();
    if (!cleanId) {
      showToast('Missing blocked member.', 'error');
      return;
    }

    const result = await openInlineDialog({
      kicker: 'Unblock Member',
      title: 'Unblock this member?',
      message: 'This will allow future Business Chats with this member again.',
      confirmText: 'Unblock Member',
      tone: 'primary'
    });

    if (!result.confirmed) return;

    setBusy(button, true, 'Unblocking...');

    try {
      const data = await apiFetch('/plaza/business-blocks/' + encodeURIComponent(cleanId), {
        method: 'DELETE'
      });

      state.blocks = state.blocks.filter((item) => {
        const id = String(
          item.blockedUserId ||
          item.otherUserId ||
          item.targetUserId ||
          item.userId ||
          item.id ||
          ''
        ).trim();

        return id !== cleanId;
      });

      if (Array.isArray(data.conversations)) {
        data.conversations.forEach((conversation) => upsertConversation(conversation));
      }

      try {
        localStorage.removeItem(CACHE_KEY);
      } catch (_) {}

      await loadBlocks({ silent: true });
      await refreshConversations({ force: true, silent: true });

      renderAll();
      showToast('Member unblocked. Related Business Chats were refreshed.', 'success');
    } catch (error) {
      console.error('unblock member error:', error);
      showToast(error.message || 'Failed to unblock member.', 'error');
    } finally {
      setBusy(button, false);
    }
  }

  function joinRoom(conversationId = '') {
    const cleanId = String(conversationId || '').trim();
    if (!cleanId || !state.socket || typeof state.socket.emit !== 'function') return;

    state.socket.emit('joinBusinessChat', { conversationId: cleanId });
  }

  function joinAllRooms() {
    state.conversations.forEach((conversation) => joinRoom(conversation.id));
  }

  function initSocket() {
    const token = getStoredToken();
    if (!token || typeof io !== 'function') return;

    state.socket = io({
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    state.socket.on('connect', () => {
      joinAllRooms();
    });

    state.socket.on('businessChatSnapshot', (payload = {}) => {
      if (payload.conversation) upsertConversation(payload.conversation);
    });

    state.socket.on('businessChatUpdated', (payload = {}) => {
      if (payload.conversation) upsertConversation(payload.conversation);
    });

    state.socket.on('businessChatError', (payload = {}) => {
      if (payload.message) console.warn('Business Chat socket error:', payload.message);
    });
  }

  function startAutoRefresh() {
    window.clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = window.setInterval(() => {
      if (document.hidden) return;
      refreshConversations({ force: true, silent: true }).catch(() => {});
    }, 30000);
  }

  function bindEvents() {
    document.querySelectorAll('[data-bc-view-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        setBusinessChatView(button.getAttribute('data-bc-view-tab') || 'overview');
      });
    });

    $('bcRefresh')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      setBusy(button, true, 'Refreshing...');
      await Promise.all([
        refreshConversations({ force: true }),
        loadBlocks({ silent: true })
      ]).catch((error) => showToast(error.message || 'Refresh failed.', 'error'));
      setBusy(button, false);
    });

    $('bcSearchForm')?.addEventListener('submit', searchMembers);

    $('bcMemberSearch')?.addEventListener('input', () => {
      window.clearTimeout(state.memberSearchTimer);
      state.memberSearchTimer = window.setTimeout(() => {
        searchMembers().catch(() => {});
      }, 360);
    });

    $('bcDivisionFilter')?.addEventListener('change', () => {
      searchMembers().catch(() => {});
    });

    $('bcBusinessPurpose')?.addEventListener('change', () => {
      const purpose = getStartPurpose();
      rememberBusinessPurpose(purpose);
      syncBusinessPurposeHelperText();

      if (isLookingForJobsPurpose(purpose)) {
        searchMembers().catch(() => {});
      }
    });

    $('bcReplyForm')?.addEventListener('submit', submitReply);

    $('bcReplyInput')?.addEventListener('keydown', (event) => {
      if (event.isComposing || event.key !== 'Enter' || event.shiftKey) return;

      event.preventDefault();

      const input = event.currentTarget;
      const sendButton = $('bcSendReply');
      const text = String(input?.value || '').trim();

      if (!input || input.disabled || sendButton?.disabled) return;

      if (!text) {
        showToast('Write a reply first.', 'warning');
        return;
      }

      submitReply(event).catch((error) => {
        console.error('enter key send reply error:', error);
        showToast(error.message || 'Failed to send reply.', 'error');
      });
    });

    $('bcConversationList')?.addEventListener('click', (event) => {
      const card = event.target?.closest?.('[data-conversation-id]');
      if (!card) return;

      state.activeId = card.getAttribute('data-conversation-id') || '';
      joinRoom(state.activeId);
      setLastSeenNow();
      renderAll();

      const url = new URL(window.location.href);
      url.searchParams.set('conversationId', state.activeId);
      window.history.replaceState({}, '', url.toString());
    });

    $('bcMemberResults')?.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-start-chat]');
      if (!button) return;
      startChat(button.getAttribute('data-start-chat') || '', button);
    });

    $('bcBlockedList')?.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-unblock-id]');
      if (!button) return;
      unblockMember(button.getAttribute('data-unblock-id') || '', button);
    });

    $('bcReportThread')?.addEventListener('click', () => runSafetyAction('report'));
    $('bcCloseThread')?.addEventListener('click', () => runSafetyAction('close'));
    $('bcBlockThread')?.addEventListener('click', () => runSafetyAction('block'));

    window.addEventListener('beforeunload', () => {
      if (state.socket && typeof state.socket.disconnect === 'function') {
        state.socket.disconnect();
      }
      window.clearInterval(state.autoRefreshTimer);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshConversations({ force: true, silent: true }).catch(() => {});
    });
  }

  async function init() {
    if (!getStoredToken()) {
      window.location.href = '/?redirect=business-chats';
      return;
    }

    closeInlineDialogHard();
    installNativeDialogGuard();
    ensureBusinessPurposeOptions();
    restoreBusinessPurposeSelection();
    syncBusinessPurposeHelperText();
    bindEvents();
    initBusinessChatViewTabs();

    const cached = readCache();
    if (Array.isArray(cached.conversations)) {
      state.conversations = cached.conversations.map(normalizeConversation);
      renderAll();
    }

    initSocket();
    renderAll();

    await Promise.all([
      refreshConversations({ force: true }),
      loadBlocks({ silent: true })
    ]);

    startAutoRefresh();

    if (!state.activeView) {
      setBusinessChatView('overview');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
      console.error('Business Chats init error:', error);
      showToast(error.message || 'Failed to initialize Business Chats.', 'error');
    });
  });
})();