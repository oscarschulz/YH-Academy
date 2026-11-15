import { PURPOSES, JOB_SEARCH_HINT, clean, safeArray, getStoredToken, isJobPurpose, normalizeDivision, formatDate, normalizeConversation, normalizeMember, normalizeBlock, isBlocked as isBusinessBlocked, isClosed, isLocked as isBusinessLocked, conversationUpdatedAt, dedupeConversations, conversationMeta, initials, readLastSeen, writeLastSeen, readCache, writeCache, readPurposeCache, writePurposeCache, filterBusinessMembersForSearch, selectBusinessConversationId, businessChatSessionKey } from './businessChatsUtils.js'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { io } from 'socket.io-client'
import { apiFetch } from '../../services/api/apiClient'
import './BusinessChatsWorkspace.css'

export default function BusinessChatsWorkspace({
  onToast,
  initialConversationId = '',
}) {
  const socketRef = useRef(null)
  const joinedRef = useRef(new Set())
  const rowsRef = useRef([])
  const activeRef = useRef('')
  const targetRef = useRef('')
  const mountedRef = useRef(false)
  const listRequestRef = useRef(null)
  const listVersionRef = useRef(0)
  const blocksVersionRef = useRef(0)
  const searchVersionRef = useRef(0)
  const mutationVersionRef = useRef(0)
  const busyRef = useRef(null)
  const dialogRef = useRef(null)
  const messagesRef = useRef(null)
  const toastRef = useRef(onToast)
  toastRef.current = onToast
  const [owner, setOwner] = useState(businessChatSessionKey)
  const [view, setView] = useState('overview')
  const [conversations, setConversations] = useState(() => dedupeConversations(readCache().conversations || []))
  const [blocks, setBlocks] = useState([])
  const [members, setMembers] = useState([])
  const [activeId, setActiveIdState] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [ready, setReady] = useState(false)
  const [blocksLoading, setBlocksLoading] = useState(false)
  const [membersLoading, setMembersLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [division, setDivision] = useState('all')
  const [purpose, setPurpose] = useState(() => PURPOSES.includes(readPurposeCache()) ? readPurposeCache() : PURPOSES[0])
  const [openingMessage, setOpeningMessage] = useState('')
  const [reply, setReply] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [reportReason, setReportReason] = useState('Spam, abuse, unsafe request, or misuse')
  const [reportDetails, setReportDetails] = useState('')
  const [lastSeen, setLastSeen] = useState(readLastSeen)
  rowsRef.current = conversations

  const current = useCallback(() => mountedRef.current && owner === businessChatSessionKey(), [owner])
  const toast = useCallback((message, type = 'error') => toastRef.current?.(message, type), [])
  const markSeen = useCallback(() => {
    if (current() && !document.hidden) setLastSeen(writeLastSeen())
  }, [current])
  const setActiveId = useCallback(id => {
    activeRef.current = clean(id)
    setActiveIdState(clean(id))
  }, [])
  const isBlocked = useCallback(item => isBusinessBlocked(item, blocks), [blocks])
  const isLocked = useCallback(item => isBusinessLocked(item, blocks), [blocks])
  const activeConversation = useMemo(() => conversations.find(item => item.id === activeId) || null, [conversations, activeId])

  const commitRows = useCallback((items, requestedId = '') => {
    if (!current()) return
    const previous = rowsRef.current.find(item => item.id === activeRef.current)
    const next = dedupeConversations(items)
    const selected = selectBusinessConversationId(next, activeRef.current, previous, requestedId || targetRef.current)
    if (JSON.stringify(next) !== JSON.stringify(rowsRef.current)) {
      rowsRef.current = next
      setConversations(next)
      writeCache(next)
    }
    setActiveId(selected)
    if (targetRef.current && next.some(item => item.id === targetRef.current || safeArray(item.sourceConversationIds).includes(targetRef.current))) targetRef.current = ''
  }, [current, setActiveId])

  const upsertConversation = useCallback(raw => {
    if (!current() || !clean(raw?.id)) return
    const existing = rowsRef.current.find(item => item.id === clean(raw.id))
    if (existing && conversationUpdatedAt(raw) < conversationUpdatedAt(existing)) return
    const normalized = normalizeConversation({ ...existing, ...raw })
    if (existing && !Object.prototype.hasOwnProperty.call(raw, 'businessBlock')) normalized.businessBlock = existing.businessBlock
    mutationVersionRef.current += 1
    commitRows([normalized, ...rowsRef.current.filter(item => item.id !== normalized.id)])
  }, [commitRows, current])

  const loadConversations = useCallback((silent = false, force = false) => {
    if (!current()) return Promise.resolve([])
    if (listRequestRef.current && !force) return listRequestRef.current
    const version = ++listVersionRef.current
    const mutationVersion = mutationVersionRef.current
    setRefreshing(true)
    if (!silent) setLoading(true)
    const request = (async () => {
      try {
        const result = await apiFetch('/api/plaza/messages?limit=160', { method: 'GET', cache: 'no-store' })
        if (!Array.isArray(result?.conversations)) throw new Error('Conversation list response was incomplete.')
        if (!current() || version !== listVersionRef.current) return []
        // A saved/realtime change received after this read began wins over its older response.
        if (mutationVersion !== mutationVersionRef.current) return []
        commitRows(result.conversations)
        setReady(true)
        setError('')
        return result.conversations
      } catch (loadError) {
        if (current() && version === listVersionRef.current && !silent) {
          setError(loadError?.message || 'Could not load Business Chats.')
          toast(loadError?.message || 'Could not load Business Chats.')
        }
        return []
      } finally {
        if (current() && version === listVersionRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    })()
    listRequestRef.current = request
    const release = () => {
      if (listRequestRef.current === request) listRequestRef.current = null
    }
    void request.then(release, release)
    return request
  }, [commitRows, current, toast])

  const loadBlocks = useCallback(async (silent = false) => {
    if (!current()) return
    const version = ++blocksVersionRef.current
    setBlocksLoading(true)
    try {
      const result = await apiFetch('/api/plaza/business-blocks', { method: 'GET', cache: 'no-store' })
      const rows = Array.isArray(result?.blocks) ? result.blocks : result?.businessBlocks
      if (!Array.isArray(rows)) throw new Error('Blocked members response was incomplete.')
      if (current() && version === blocksVersionRef.current) setBlocks(rows.map(normalizeBlock))
    } catch (loadError) {
      if (current() && version === blocksVersionRef.current && !silent) toast(loadError?.message || 'Could not load blocked members.')
    } finally {
      if (current() && version === blocksVersionRef.current) setBlocksLoading(false)
    }
  }, [current, toast])

  useEffect(() => {
    mountedRef.current = true
    void Promise.all([loadConversations(), loadBlocks(true)])
    return () => {
      mountedRef.current = false
      listVersionRef.current += 1
      blocksVersionRef.current += 1
      searchVersionRef.current += 1
      listRequestRef.current = null
      busyRef.current = null
    }
  }, [loadConversations, loadBlocks])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    let saved = ''
    try {
      saved = clean(sessionStorage.getItem('yh_business_chats_inline_conversation_id_v1'))
      sessionStorage.removeItem('yh_business_chats_inline_conversation_id_v1')
    } catch {}
    const requested = clean(initialConversationId || params.get('conversationId') || params.get('businessChatId') || saved)
    if (!requested) return
    targetRef.current = requested
    setView('conversations')
    setActiveId(rowsRef.current.length ? selectBusinessConversationId(rowsRef.current, '', null, requested) : requested)
  }, [initialConversationId, setActiveId])

  useEffect(() => { writePurposeCache(purpose) }, [purpose, owner])
  useEffect(() => { if (view === 'conversations') markSeen() }, [view, activeId, markSeen])

  useEffect(() => {
    const refresh = () => {
      const nextOwner = businessChatSessionKey()
      if (nextOwner !== owner) {
        rowsRef.current = []
        setConversations([])
        setBlocks([])
        setMembers([])
        setActiveId('')
        setDialog(null)
        setReply('')
        setOpeningMessage('')
        setBusyId('')
        setReady(false)
        setHasSearched(false)
        setSearch('')
        setLastSeen(readLastSeen())
        setPurpose(PURPOSES.includes(readPurposeCache()) ? readPurposeCache() : PURPOSES[0])
        targetRef.current = ''
        setOwner(nextOwner)
        return
      }
      setLastSeen(readLastSeen())
      if (!document.hidden) void Promise.all([loadConversations(true), loadBlocks(true)])
    }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('storage', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('storage', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [owner, loadConversations, loadBlocks, setActiveId])

  const joinKnownRooms = useCallback(() => {
    const socket = socketRef.current
    if (!socket?.connected || !current()) return
    const ids = new Set(rowsRef.current.map(item => item.id))
    for (const id of joinedRef.current) {
      if (!ids.has(id)) {
        joinedRef.current.delete(id)
        socket.emit('leaveBusinessChat', { conversationId: id })
      }
    }
    for (const id of ids) {
      if (joinedRef.current.has(id)) continue
      joinedRef.current.add(id) // Set before emit; a synchronous snapshot cannot rejoin it.
      socket.emit('joinBusinessChat', { conversationId: id })
    }
  }, [current])

  useEffect(() => {
    const token = getStoredToken()
    if (!ready || !token || !current()) return undefined
    const socket = io({ withCredentials: true, transports: ['websocket', 'polling'], auth: { token } })
    socketRef.current = socket
    const onConnect = () => {
      joinedRef.current.clear()
      joinKnownRooms()
      void Promise.all([loadConversations(true, true), loadBlocks(true)])
    }
    const onConversation = (payload = {}) => {
      if (payload.conversation) upsertConversation(payload.conversation)
    }
    const onError = (payload = {}) => {
      if (current() && payload.message) setError(payload.message)
    }
    const onDisconnect = () => joinedRef.current.clear()
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('businessChatSnapshot', onConversation)
    socket.on('businessChatUpdated', onConversation)
    socket.on('businessChatError', onError)
    if (socket.connected) onConnect()
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('businessChatSnapshot', onConversation)
      socket.off('businessChatUpdated', onConversation)
      socket.off('businessChatError', onError)
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
      joinedRef.current.clear()
    }
  }, [ready, owner, current, joinKnownRooms, loadConversations, loadBlocks, upsertConversation])

  useEffect(() => { joinKnownRooms() }, [conversations, joinKnownRooms])
  useEffect(() => {
    const list = messagesRef.current
    if (list && view === 'conversations') list.scrollTop = list.scrollHeight
  }, [activeId, activeConversation?.messages, view])

  const stats = useMemo(() => ({
    threads: conversations.length,
    active: conversations.filter(item => !isLocked(item)).length,
    unread: conversations.filter(item => conversationUpdatedAt(item) > lastSeen).length,
    blocked: blocks.length || conversations.filter(item => isBlocked(item)).length,
  }), [conversations, blocks, lastSeen, isLocked, isBlocked])

  const searchMembers = useCallback(async () => {
    if (!current()) return
    const version = ++searchVersionRef.current
    setView('overview')
    setMembersLoading(true)
    setHasSearched(true)
    const rawQuery = clean(search)
    const params = new URLSearchParams({
      q: isJobPurpose(purpose) ? rawQuery || JOB_SEARCH_HINT : rawQuery,
      division: normalizeDivision(division), businessPurpose: purpose,
      intentCategory: isJobPurpose(purpose) ? 'looking_for_jobs' : 'business_chat',
      jobSearchIntent: isJobPurpose(purpose) ? '1' : '0', limit: '120',
    })
    try {
      let result = await apiFetch('/api/plaza/business-members?' + params, { method: 'GET', cache: 'no-store' })
      if (!current() || version !== searchVersionRef.current) return
      if (!Array.isArray(result?.members)) throw new Error('Member search response was incomplete.')
      if (!result.members.length && rawQuery) {
        params.set('q', '')
        result = await apiFetch('/api/plaza/business-members?' + params, { method: 'GET', cache: 'no-store' })
      }
      if (!current() || version !== searchVersionRef.current) return
      if (!Array.isArray(result?.members)) throw new Error('Member search response was incomplete.')
      setMembers(filterBusinessMembersForSearch(result.members.map(normalizeMember), rawQuery, division))
    } catch (searchError) {
      if (current() && version === searchVersionRef.current) {
        setMembers([])
        toast(searchError?.message || 'Failed to search approved members.')
      }
    } finally {
      if (current() && version === searchVersionRef.current) setMembersLoading(false)
    }
  }, [search, division, purpose, current, toast])

  const searchReadyRef = useRef(false)
  useEffect(() => {
    if (!searchReadyRef.current) { searchReadyRef.current = true; return undefined }
    const timer = window.setTimeout(() => { void searchMembers() }, 360)
    return () => window.clearTimeout(timer)
  }, [searchMembers])

  const openingText = clean(openingMessage) || (isJobPurpose(purpose)
    ? 'I am looking for job opportunities, project work, hiring leads, or a role that matches my skills. I would like to open this business conversation to discuss possible work opportunities.'
    : 'I would like to open a Plaza business conversation for: ' + purpose)

  const perform = async (key, work, completed) => {
    if (busyRef.current || !current()) return
    const ticket = {}
    busyRef.current = ticket
    setBusyId(key)
    try {
      const result = await work()
      if (current()) await completed(result)
    } catch (operationError) {
      if (current()) toast(operationError?.message || 'Business Chat action failed.')
    } finally {
      if (busyRef.current === ticket) {
        busyRef.current = null
        if (current()) setBusyId('')
      }
    }
  }

  const selectConversation = id => {
    setActiveId(id)
    setView('conversations')
    markSeen()
    const url = new URL(window.location.href)
    url.searchParams.delete('businessChatId')
    url.searchParams.set('conversationId', id)
    window.history.replaceState(window.history.state, '', url.toString())
  }

  const startChat = async member => {
    const id = clean(member?.directoryProfileId || member?.id)
    if (!id) return
    await perform('member:' + member.id, () => apiFetch('/api/plaza/messages/from-business-member/' + encodeURIComponent(id), {
      method: 'POST', body: JSON.stringify({
        businessPurpose: purpose, businessIntent: isJobPurpose(purpose) ? 'looking_for_jobs' : 'business_chat',
        intentCategory: isJobPurpose(purpose) ? 'looking_for_jobs' : 'business_chat',
        jobSearchIntent: isJobPurpose(purpose), message: openingText,
      }),
    }), result => {
      if (!clean(result?.conversation?.id)) throw new Error('Server did not confirm a Business Chat.')
      upsertConversation(result.conversation)
      const id = selectBusinessConversationId(rowsRef.current, '', null, result.conversation.id)
      setOpeningMessage('')
      selectConversation(id)
      toast('Business chat opened.', 'success')
    })
  }

  const sendReply = async event => {
    event?.preventDefault?.()
    if (busyRef.current) return
    const conversation = activeConversation
    if (!conversation) { toast('Select a business conversation first.'); return }
    if (isLocked(conversation)) {
      toast(isBlocked(conversation) ? "Message can't be delivered. This Business Chat is blocked." : "Message can't be delivered. This business chat is closed.")
      return
    }
    const text = clean(reply)
    if (!text) { toast('Write a reply first.'); return }
    if (text.length > 1600) { toast('Reply must not exceed 1600 characters.'); return }
    await perform('reply:' + conversation.id, () => apiFetch('/api/plaza/messages/' + encodeURIComponent(conversation.id) + '/replies', {
      method: 'POST', body: JSON.stringify({ text }),
    }), result => {
      if (!result?.conversation?.id && !result?.reply?.id) throw new Error('Server did not confirm the reply.')
      if (result.conversation) upsertConversation(result.conversation)
      else void loadConversations(true, true)
      if (activeRef.current === conversation.id) setReply(value => clean(value) === text ? '' : value)
      markSeen()
      toast('Reply sent.', 'success')
    })
  }

  const openSafetyDialog = action => {
    if (busyRef.current || !activeConversation || !['report', 'close', 'block'].includes(action)) return
    if (action === 'close' && isClosed(activeConversation)) { toast('This business chat is already closed.', 'warning'); return }
    if (action !== 'report' && isBlocked(activeConversation)) { toast('This member is already blocked.', 'warning'); return }
    setReportReason('Spam, abuse, unsafe request, or misuse')
    setReportDetails('')
    setDialog({ type: 'safety', action, conversationId: activeConversation.id })
  }

  const confirmSafetyAction = async () => {
    const conversation = rowsRef.current.find(item => item.id === dialog?.conversationId)
    const action = dialog?.action
    if (!conversation || !['report', 'close', 'block'].includes(action)) { setDialog(null); return }
    if (action === 'report' && !clean(reportReason)) {
      toast('Add a reason first.', 'warning')
      dialogRef.current?.querySelector('input')?.focus()
      return
    }
    if (action !== 'report' && (isBlocked(conversation) || (action === 'close' && isClosed(conversation)))) {
      toast('This Business Chat is already closed or blocked.', 'warning')
      return
    }
    const body = action === 'report' ? { reason: clean(reportReason), details: clean(reportDetails) }
      : action === 'close' ? { note: 'Closed from Business Chats page.' }
        : { note: 'Blocked from Business Chats page.', scope: 'user' }
    await perform('safety:' + action, () => apiFetch('/api/plaza/messages/' + encodeURIComponent(conversation.id) + '/' + action, {
      method: 'POST', body: JSON.stringify(body),
    }), async result => {
      if (result?.conversation) upsertConversation(result.conversation)
      await Promise.all([loadBlocks(true), loadConversations(true, true)])
      if (!current()) return
      setDialog(null)
      if (action === 'block') setView('blocked')
      toast(action === 'report' ? 'Business chat reported for admin review.' : action === 'close' ? 'Business chat closed.' : 'Member blocked. You can unblock them from the Blocked Members tab.', 'success')
    })
  }

  const requestUnblock = block => { if (block?.id && !busyRef.current) setDialog({ type: 'unblock', block }) }
  const confirmUnblock = async () => {
    const block = dialog?.block
    if (!block?.id) { setDialog(null); return }
    await perform('unblock:' + block.id, () => apiFetch('/api/plaza/business-blocks/' + encodeURIComponent(block.id), { method: 'DELETE' }), async result => {
      setBlocks(items => items.filter(item => item.id !== block.id))
      safeArray(result?.conversations).forEach(upsertConversation)
      await Promise.all([loadBlocks(true), loadConversations(true, true)])
      if (!current()) return
      setDialog(null)
      toast('Member unblocked. Related Business Chats were refreshed.', 'success')
    })
  }

  useEffect(() => {
    if (!dialog) return undefined
    const node = dialogRef.current
    const opener = document.activeElement
    const focusable = () => Array.from(node?.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []).filter(item => !item.hidden && item.getClientRects().length)
    ;(node?.querySelector('input') || focusable()[0] || node)?.focus()
    const keyboard = event => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); setDialog(null); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); node?.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !node?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !node?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('keydown', keyboard)
      if (opener?.isConnected) opener.focus?.()
    }
  }, [dialog])

  if (
    loading &&
    !conversations.length
  ) {
    return (
      <section className="yh-dashboard-react-workspace yh-business-chats-react-workspace">
        <div className="yh-business-chats-state">
          Loading Business
          Chats...
        </div>
      </section>
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-business-chats-react-workspace"
      data-yh-dashboard-react-surface="business-chats"
    >
      <div className="yh-business-chats-scroll">
        <div className="yh-business-chats-shell">
          <header className="yh-business-chats-hero">
            <div>
              <span className="yh-business-chats-kicker">
                YH Universe /
                Business Chats
              </span>

              <h1>
                Business Chats
              </h1>

              <p>
                Find approved
                Academy, Plaza,
                and Federation
                members, open
                scoped business
                conversations, and
                manage active or
                blocked threads.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary yh-business-chats-refresh"
              disabled={
                refreshing
              }
              onClick={() =>
                void Promise.all([
                  loadConversations(false, true),
                  loadBlocks(false),
                ])
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          <nav className="yh-business-chats-tabs">
            {[
              [
                'overview',
                'Overview',
              ],
              [
                'conversations',
                'Conversations',
              ],
              [
                'blocked',
                'Blocked Members',
              ],
            ].map(
              ([
                key,
                label,
              ]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    view === key
                      ? 'is-active'
                      : ''
                  }
                  onClick={() =>
                    setView(
                      key,
                    )
                  }
                >
                  {label}
                </button>
              ),
            )}
          </nav>

          <section className="yh-business-chats-stats">
            <article>
              <small>
                Threads
              </small>

              <strong>
                {
                  stats.threads
                }
              </strong>
            </article>

            <article>
              <small>
                Active
              </small>

              <strong>
                {
                  stats.active
                }
              </strong>
            </article>

            <article>
              <small>
                Unread
              </small>

              <strong>
                {
                  stats.unread
                }
              </strong>
            </article>

            <article>
              <small>
                Blocked
              </small>

              <strong>
                {
                  stats.blocked
                }
              </strong>
            </article>
          </section>

          {error && (
            <div className="yh-business-chats-state is-error">
              {error}
            </div>
          )}

          {view ===
            'overview' && (
            <>
              <section className="yh-business-chats-card">
                <div className="yh-business-chats-card-head">
                  <div>
                    <span className="yh-business-chats-kicker">
                      Start a
                      Business
                      Chat
                    </span>

                    <h2>
                      Search approved
                      YH Universe
                      members
                    </h2>
                  </div>
                </div>

                <form
                  className="yh-business-chats-search-form"
                  onSubmit={(
                    event,
                  ) => {
                    event.preventDefault()
                    void searchMembers()
                  }}
                >
                  <label>
                    <span>
                      Search
                    </span>

                    <input
                      className="input-field"
                      maxLength={120}
                      value={
                        search
                      }
                      placeholder="Search name, role, city, skill, or business area"
                      onChange={(
                        event,
                      ) =>
                        setSearch(
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Division
                    </span>

                    <select
                      className="input-field"
                      value={
                        division
                      }
                      onChange={(
                        event,
                      ) =>
                        setDivision(
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      <option value="all">
                        All approved
                        members
                      </option>

                      <option value="academy">
                        Academy
                        members
                      </option>

                      <option value="plaza">
                        Plaza members
                      </option>

                      <option value="federation">
                        Federation
                        members
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>
                      Business
                      Purpose
                    </span>

                    <select
                      className="input-field"
                      value={
                        purpose
                      }
                      onChange={(
                        event,
                      ) =>
                        setPurpose(
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      {PURPOSES.map(
                        (item) => (
                          <option
                            key={
                              item
                            }
                            value={
                              item
                            }
                          >
                            {item}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="is-wide">
                    <span>
                      Opening Message
                    </span>

                    <textarea
                      className="input-field"
                      rows="3"
                      maxLength={1200}
                      value={
                        openingMessage
                      }
                      placeholder={
                        isJobPurpose(
                          purpose,
                        )
                          ? 'Explain the type of job, project work, role, skill area, city, or opportunity you are looking for.'
                          : 'Explain why you want to start this business conversation.'
                      }
                      onChange={(
                        event,
                      ) =>
                        setOpeningMessage(
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </label>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={
                      membersLoading
                    }
                  >
                    {membersLoading
                      ? 'Searching...'
                      : isJobPurpose(
                            purpose,
                          )
                        ? 'Find Job Contacts'
                        : 'Search Members'}
                  </button>
                </form>
              </section>

              <section className="yh-business-chats-card">
                <div className="yh-business-chats-card-head">
                  <div>
                    <span className="yh-business-chats-kicker">
                      Approved
                      Members
                    </span>

                    <h2>
                      Search Results
                    </h2>
                  </div>

                  <span>
                    {
                      members.length
                    }{' '}
                    results
                  </span>
                </div>

                {membersLoading ? (
                  <div className="yh-business-chats-state">
                    Searching
                    approved YH
                    Universe
                    members...
                  </div>
                ) : !members.length ? (
                  <div className="yh-business-chats-state">
                    {hasSearched
                      ? 'No matching approved members found. Try All approved members or a broader keyword.'
                      : 'Search approved Academy, Plaza, and Federation members to start a business chat.'}
                  </div>
                ) : (
                  <div className="yh-business-chat-member-grid">
                    {members.map(
                      (member) => (
                        <article
                          key={
                            member.id
                          }
                        >
                          <div className="yh-business-chat-member-main">
                            <div className="yh-business-chat-avatar">
                              {member.avatar ? (
                                <img
                                  src={
                                    member.avatar
                                  }
                                  alt=""
                                />
                              ) : (
                                <span>
                                  {initials(
                                    member.name,
                                  )}
                                </span>
                              )}
                            </div>

                            <div>
                              <strong>
                                {
                                  member.name
                                }
                              </strong>

                              <small>
                                {[
                                  member.divisionLabel,
                                  member.role,
                                  member.location,
                                ]
                                  .filter(
                                    Boolean,
                                  )
                                  .join(
                                    ' • ',
                                  )}
                              </small>

                              {member.headline && (
                                <p>
                                  {
                                    member.headline
                                  }
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn-primary"
                            disabled={
                              Boolean(
                                busyId,
                              )
                            }
                            onClick={() =>
                              void startChat(
                                member,
                              )
                            }
                          >
                            {busyId ===
                            `member:${member.id}`
                              ? 'Opening...'
                              : 'Open Business Chat'}
                          </button>
                        </article>
                      ),
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {view ===
            'conversations' && (
            <section className="yh-business-chat-conversation-layout">
              <aside className="yh-business-chat-thread-list">
                <div className="yh-business-chats-card-head">
                  <div>
                    <span className="yh-business-chats-kicker">
                      Conversations
                    </span>

                    <h2>
                      {
                        conversations.length
                      }{' '}
                      threads
                    </h2>
                  </div>
                </div>

                {!conversations.length ? (
                  <div className="yh-business-chats-state">
                    No business
                    conversations
                    yet. Search a
                    member from
                    Overview to
                    start one.
                  </div>
                ) : (
                  conversations.map(
                    (
                      conversation,
                    ) => {
                      const latest =
                        conversation
                          .messages[
                          conversation
                            .messages
                            .length -
                            1
                        ] || {}

                      const unread =
                        conversationUpdatedAt(
                          conversation,
                        ) >
                        lastSeen

                      return (
                        <button
                          type="button"
                          key={
                            conversation.id
                          }
                          className={[
                            'yh-business-chat-thread-item',

                            activeId ===
                            conversation.id
                              ? 'is-active'
                              : '',

                            unread
                              ? 'is-unread'
                              : '',
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(
                              ' ',
                            )}
                          onClick={() => selectConversation(conversation.id)}
                        >
                          <div>
                            <strong>
                              {
                                conversation.title
                              }
                            </strong>

                            {unread && (
                              <span>
                                New
                              </span>
                            )}
                          </div>

                          <small>
                            {conversationMeta(
                              conversation,
                            ) ||
                              'Plaza business thread'}
                          </small>

                          <p>
                            {latest.text ||
                              'No messages yet.'}
                          </p>

                          <em>
                            {formatDate(
                              conversation.updatedAt ||
                                latest.createdAt ||
                                conversation.createdAt,
                            )}
                          </em>
                        </button>
                      )
                    },
                  )
                )}
              </aside>

              <div className="yh-business-chat-thread">
                {!activeConversation ? (
                  <div className="yh-business-chats-state">
                    Select a thread
                    to read the
                    conversation
                    and reply.
                  </div>
                ) : (
                  <>
                    <header className="yh-business-chat-thread-head">
                      <div>
                        <h2>
                          {
                            activeConversation.title
                          }
                        </h2>

                        <p>
                          {conversationMeta(
                            activeConversation,
                          ) ||
                            'Plaza business thread'}
                        </p>
                      </div>

                      <div className="yh-business-chat-safety-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={
                            busyId.startsWith(
                              'safety:',
                            )
                          }
                          onClick={() =>
                            openSafetyDialog(
                              'report',
                            )
                          }
                        >
                          Report
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={
                            isClosed(
                              activeConversation,
                            ) ||
                            isBlocked(
                              activeConversation,
                            ) ||
                            busyId.startsWith(
                              'safety:',
                            )
                          }
                          onClick={() =>
                            openSafetyDialog(
                              'close',
                            )
                          }
                        >
                          {isClosed(
                            activeConversation,
                          )
                            ? 'Closed'
                            : 'Close'}
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={
                            isBlocked(
                              activeConversation,
                            ) ||
                            busyId.startsWith(
                              'safety:',
                            )
                          }
                          onClick={() =>
                            openSafetyDialog(
                              'block',
                            )
                          }
                        >
                          {isBlocked(
                            activeConversation,
                          )
                            ? 'Blocked'
                            : 'Block'}
                        </button>
                      </div>
                    </header>

                    {isBlocked(
                      activeConversation,
                    ) && (
                      <div className="yh-business-chat-lock-note">
                        {activeConversation
                          .businessBlock
                          ?.message ||
                          'This Business Chat is blocked. Replies are disabled.'}
                      </div>
                    )}

                    {isClosed(
                      activeConversation,
                    ) &&
                      !isBlocked(
                        activeConversation,
                      ) && (
                        <div className="yh-business-chat-lock-note">
                          This business
                          chat is
                          closed.
                          Replies are
                          disabled.
                        </div>
                      )}

                    <div ref={messagesRef} className="yh-business-chat-messages">
                      {!activeConversation
                        .messages
                        .length ? (
                        <div className="yh-business-chats-state">
                          No messages
                          yet. Write
                          the first
                          reply below.
                        </div>
                      ) : (
                        activeConversation.messages.map(
                          (
                            message,
                          ) => (
                            <article
                              key={
                                message.id
                              }
                              className={
                                message.type ===
                                'system'
                                  ? 'is-system'
                                  : ''
                              }
                            >
                              <strong>
                                {
                                  message.sender
                                }
                              </strong>

                              <p>
                                {
                                  message.text
                                }
                              </p>

                              <span>
                                {formatDate(
                                  message.createdAt,
                                )}
                              </span>
                            </article>
                          ),
                        )
                      )}
                    </div>

                    <form
                      className="yh-business-chat-reply"
                      onSubmit={
                        sendReply
                      }
                    >
                      <textarea
                        className="input-field"
                        rows="3"
                        maxLength={1600}
                        value={
                          reply
                        }
                        disabled={Boolean(busyId) || isLocked(activeConversation)}
                        placeholder={
                          isBlocked(
                            activeConversation,
                          )
                            ? activeConversation
                                .businessBlock
                                ?.blockedMe
                              ? "Message can't be delivered. This member blocked Business Chat delivery."
                              : "Message can't be delivered. This Business Chat is blocked."
                            : isClosed(
                                  activeConversation,
                                )
                              ? 'This business chat is closed.'
                              : 'Write your business reply...'
                        }
                        onChange={(
                          event,
                        ) =>
                          setReply(
                            event
                              .target
                              .value,
                          )
                        }
                        onKeyDown={(
                          event,
                        ) => {
                          if (
                            event.isComposing ||
                            event.key !==
                              'Enter' ||
                            event.shiftKey
                          ) {
                            return
                          }

                          event.preventDefault()

                          if (
                            !isLocked(
                              activeConversation,
                            ) &&
                            clean(
                              reply,
                            )
                          ) {
                            void sendReply(
                              event,
                            )
                          }
                        }}
                      />

                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={
                          isLocked(
                            activeConversation,
                          ) ||
                          busyId ===
                            `reply:${activeConversation.id}`
                        }
                      >
                        {busyId ===
                        `reply:${activeConversation.id}`
                          ? 'Sending...'
                          : 'Send Reply'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </section>
          )}

          {view ===
            'blocked' && (
            <section className="yh-business-chats-card">
              <div className="yh-business-chats-card-head">
                <div>
                  <span className="yh-business-chats-kicker">
                    Blocked Members
                  </span>

                  <h2>
                    Business Chat
                    safety list
                  </h2>
                </div>

                <span>
                  {
                    blocks.length
                  }{' '}
                  blocked
                </span>
              </div>

              {blocksLoading ? (
                <div className="yh-business-chats-state">
                  Loading blocked
                  members...
                </div>
              ) : !blocks.length ? (
                <div className="yh-business-chats-state">
                  No blocked
                  business chat
                  members.
                </div>
              ) : (
                <div className="yh-business-chat-block-list">
                  {blocks.map(
                    (block) => (
                      <article
                        key={
                          block.id
                        }
                      >
                        <div>
                          <strong>
                            {
                              block.name
                            }
                          </strong>

                          <small>
                            {block.role ||
                              'YH Universe member'}
                          </small>

                          {block.createdAt && (
                            <span>
                              Blocked{' '}
                              {formatDate(
                                block.createdAt,
                              )}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={
                            Boolean(
                              busyId,
                            )
                          }
                          onClick={() =>
                            requestUnblock(
                              block,
                            )
                          }
                        >
                          {busyId ===
                          `unblock:${block.id}`
                            ? 'Unblocking...'
                            : 'Unblock'}
                        </button>
                      </article>
                    ),
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {dialog && (
        <div
          className="modal-overlay"
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-label={dialog.type === 'unblock' ? 'Unblock Member' : 'Business Chat Safety Action'}
          aria-modal="true"
          onClick={event => { if (event.target === event.currentTarget && !busyRef.current) setDialog(null) }}
        >
          <div className="modal-content yh-business-chat-dialog">
            <button type="button" className="btn-secondary" aria-label="Close dialog" disabled={Boolean(busyId)} onClick={() => setDialog(null)}>Close</button>
            {dialog.type ===
            'unblock' ? (
              <>
                <span className="yh-business-chats-kicker">
                  Unblock Member
                </span>

                <h2>
                  Unblock this
                  member?
                </h2>

                <p>
                  This will allow
                  future Business
                  Chats with this
                  member again.
                </p>

                <div className="yh-business-chat-dialog-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={
                      Boolean(
                        busyId,
                      )
                    }
                    onClick={() =>
                      setDialog(
                        null,
                      )
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn-primary"
                    disabled={
                      Boolean(
                        busyId,
                      )
                    }
                    onClick={() =>
                      void confirmUnblock()
                    }
                  >
                    Unblock Member
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="yh-business-chats-kicker">
                  {dialog.action ===
                  'report'
                    ? 'Safety Report'
                    : dialog.action ===
                        'close'
                      ? 'Close Thread'
                      : 'Block Member'}
                </span>

                <h2>
                  {dialog.action ===
                  'report'
                    ? 'Report this business chat?'
                    : dialog.action ===
                        'close'
                      ? 'Close this business chat?'
                      : 'Block this member?'}
                </h2>

                <p>
                  {dialog.action ===
                  'report'
                    ? 'Send this conversation to admin review with a clear reason and optional details.'
                    : dialog.action ===
                        'close'
                      ? 'Replies will be disabled after closing this thread. This will not add the member to your Blocked Members list.'
                      : 'This will add the member to your Blocked Members list and disable future Business Chat replies with them.'}
                </p>

                {dialog.action ===
                  'report' && (
                  <>
                    <label>
                      <span>
                        Reason
                      </span>

                      <input
                        className="input-field"
                        maxLength={140}
                        value={
                          reportReason
                        }
                        onChange={(
                          event,
                        ) =>
                          setReportReason(
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </label>

                    <label>
                      <span>
                        Details
                      </span>

                      <textarea
                        className="input-field"
                        rows="4"
                        maxLength={900}
                        value={
                          reportDetails
                        }
                        placeholder="Add details that can help admin review this case."
                        onChange={(
                          event,
                        ) =>
                          setReportDetails(
                            event
                              .target
                              .value,
                          )
                        }
                      />
                    </label>
                  </>
                )}

                <div className="yh-business-chat-dialog-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={
                      Boolean(
                        busyId,
                      )
                    }
                    onClick={() =>
                      setDialog(
                        null,
                      )
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn-primary"
                    disabled={
                      Boolean(
                        busyId,
                      )
                    }
                    onClick={() =>
                      void confirmSafetyAction()
                    }
                  >
                    {dialog.action ===
                    'report'
                      ? 'Submit Report'
                      : dialog.action ===
                          'close'
                        ? 'Close Chat'
                        : 'Block Member'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
