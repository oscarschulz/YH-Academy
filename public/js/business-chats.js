(() => {
  'use strict';

  const API_BASE = '/api';
  const CACHE_KEY = 'yh_business_chats_page_cache_v1';
  const LAST_SEEN_KEY = 'yh_business_chats_page_seen_at_v1';

  const state = {
    conversations: [],
    members: [],
    blocks: [],
    activeId: '',
    loading: false,
    membersLoading: false,
    blocksLoading: false,
    socket: null,
    autoRefreshTimer: null
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

    toast.textContent = String(message || '');
    toast.className = 'bc-toast show ' + (type === 'error' ? 'is-error' : 'is-success');

    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
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
    return {
      id: String(item.id || 'plaza-member-' + (index + 1)),
      name: String(item.name || 'Plaza Member'),
      username: String(item.username || '').replace(/^@+/, ''),
      role: String(item.role || 'YH Plaza Member'),
      location: String(item.location || ''),
      divisionLabel: String(item.divisionLabel || item.division || 'Plaza'),
      headline: String(item.headline || ''),
      avatar: String(item.avatar || '')
    };
  }

  function getConversationMeta(conversation = {}) {
    return [
      conversation.businessPurpose,
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

  function isLocked(conversation = {}) {
    const status = String(conversation.status || '').trim().toLowerCase();
    const moderation = conversation.moderation && typeof conversation.moderation === 'object' ? conversation.moderation : {};
    const blockedBy = conversation.blockedBy && typeof conversation.blockedBy === 'object' ? conversation.blockedBy : {};

    return (
      status === 'closed' ||
      status === 'archived' ||
      status === 'blocked' ||
      moderation.closed === true ||
      moderation.blocked === true ||
      Object.values(blockedBy).some(Boolean)
    );
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

    const locked = isLocked(conversation);

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
      input.placeholder = locked ? 'This business chat is closed or blocked.' : 'Write your business reply...';
    }

    if (send) send.disabled = locked;
    if (report) report.disabled = false;
    if (close) {
      close.disabled = locked;
      close.textContent = locked ? 'Closed' : 'Close';
    }
    if (block) {
      block.disabled = locked;
      block.textContent = locked ? 'Blocked' : 'Block';
    }
  }

  function renderMembers() {
    const results = $('bcMemberResults');
    if (!results) return;

    if (state.membersLoading) {
      results.innerHTML = '<div class="bc-empty">Searching approved Plaza members...</div>';
      return;
    }

    if (!state.members.length) {
      results.innerHTML = '<div class="bc-empty">Search for an approved Plaza member to start a business chat.</div>';
      return;
    }

    results.innerHTML = state.members.map((member) => {
      const meta = [member.role, member.location].filter(Boolean).join(' • ');
      const initial = escapeHtml((member.name || 'P').charAt(0).toUpperCase());
      const avatarStyle = member.avatar ? ` style="background-image:url('${escapeHtml(member.avatar)}')"` : '';

      return `
        <article class="bc-member-card">
          <div class="bc-member-main">
            <div class="bc-avatar"${avatarStyle}>${member.avatar ? '' : initial}</div>
            <div>
              <strong>${escapeHtml(member.name)}</strong>
              <span>${escapeHtml(meta || 'Approved Plaza member')}</span>
              ${member.headline ? `<p>${escapeHtml(member.headline)}</p>` : ''}
            </div>
          </div>
          <button type="button" class="bc-primary-small" data-start-chat="${escapeHtml(member.id)}">Open Chat</button>
        </article>
      `;
    }).join('');
  }

  function renderBlocks() {
    const list = $('bcBlockedList');
    if (!list) return;

    if (state.blocksLoading) {
      list.innerHTML = '<div class="bc-empty">Loading blocked members...</div>';
      return;
    }

    if (!state.blocks.length) {
      list.innerHTML = '<div class="bc-empty">No blocked business chat members.</div>';
      return;
    }

    list.innerHTML = state.blocks.map((block) => {
      const blockedId = String(block.blockedUserId || block.id || block.userId || '').trim();
      const name = String(block.blockedUserName || block.name || 'Blocked member').trim();

      return `
        <article class="bc-block-card">
          <div>
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(blockedId)}</span>
          </div>
          <button type="button" class="bc-ghost-small" data-unblock-id="${escapeHtml(blockedId)}">Unblock</button>
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

    const button = $('bcSearchMembers');
    const query = String($('bcMemberSearch')?.value || '').trim();
    const division = String($('bcDivisionFilter')?.value || 'plaza').trim() || 'plaza';

    setBusy(button, true, 'Searching...');
    state.membersLoading = true;
    renderMembers();

    try {
      const params = new URLSearchParams({ q: query, division, limit: '80' });
      const data = await apiFetch('/plaza/business-members?' + params.toString());
      state.members = Array.isArray(data.members) ? data.members.map(normalizeMember) : [];
      renderMembers();
    } catch (error) {
      console.error('search members error:', error);
      state.members = [];
      renderMembers();
      showToast(error.message || 'Failed to search Plaza members.', 'error');
    } finally {
      state.membersLoading = false;
      setBusy(button, false);
      renderMembers();
    }
  }

  function getStartPurpose() {
    return String($('bcBusinessPurpose')?.value || 'Business collaboration').trim() || 'Business collaboration';
  }

  function getOpeningMessage() {
    const message = String($('bcOpeningMessage')?.value || '').trim();
    return message || 'I would like to open a Plaza business conversation for: ' + getStartPurpose();
  }

  async function startChat(targetUserId = '', button = null) {
    const cleanTargetUserId = String(targetUserId || '').trim();
    if (!cleanTargetUserId) {
      showToast('Missing Plaza member.', 'error');
      return;
    }

    setBusy(button, true, 'Opening...');

    try {
      const data = await apiFetch('/plaza/messages/from-business-member/' + encodeURIComponent(cleanTargetUserId), {
        method: 'POST',
        body: JSON.stringify({
          businessPurpose: getStartPurpose(),
          message: getOpeningMessage()
        })
      });

      if (data.conversation) {
        upsertConversation(data.conversation);
        state.activeId = normalizeConversation(data.conversation).id;
        if ($('bcOpeningMessage')) $('bcOpeningMessage').value = '';
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
      const reason = window.prompt('Why are you reporting this business chat?', 'Spam, abuse, unsafe request, or misuse');
      if (!reason) return;
      const details = window.prompt('Add optional details for admin review.', '') || '';
      body = { reason, details };
    } else if (cleanAction === 'close') {
      if (!window.confirm('Close this business chat? Replies will be disabled.')) return;
      body = { note: 'Closed from Business Chats page.' };
    } else if (cleanAction === 'block') {
      if (!window.confirm('Block this member across future Business Chats?')) return;
      body = { note: 'Blocked from Business Chats page.', scope: 'user' };
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
      if (cleanAction === 'block') showToast('Member blocked.', 'success');
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

    if (!window.confirm('Unblock this member for future Business Chats?')) return;

    setBusy(button, true, 'Unblocking...');

    try {
      await apiFetch('/plaza/business-blocks/' + encodeURIComponent(cleanId), {
        method: 'DELETE'
      });

      state.blocks = state.blocks.filter((item) => {
        const id = String(item.blockedUserId || item.id || item.userId || '').trim();
        return id !== cleanId;
      });

      renderBlocks();
      showToast('Member unblocked.', 'success');
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
    $('bcReplyForm')?.addEventListener('submit', submitReply);

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

    bindEvents();

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

    if (!state.members.length) {
      searchMembers().catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((error) => {
      console.error('Business Chats init error:', error);
      showToast(error.message || 'Failed to initialize Business Chats.', 'error');
    });
  });
})();