import AdminFilterMenu from './AdminFilterMenu'
import AdminRowActionMenu from './AdminRowActionMenu'
import { useEffect, useMemo, useRef, useState } from 'react'
import { adminFetchJson, getAdminBootstrap, copyAdminText } from './adminApi'
import AdminActionModal from './AdminActionModal'

const list = value => Array.isArray(value) ? value : []
const str = value => String(value ?? '').trim()
const show = value => {
  if (value == null || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
const lower = value => str(value).toLowerCase()
const find = (items, id) =>
  list(items).find(item => str(item.id) === str(id))

const searchMatches = (item, search) =>
  !str(search) ||
  JSON.stringify(item).toLowerCase().includes(lower(search))

const reviewStatus = item => {
  const value = lower(
    item.reviewStatus ||
    item.assignmentStatus ||
    item.taskStatus ||
    item.pipelineStage
  )
  if (value === 'pending_review') return 'submitted'
  if (value === 'needs_revision' || value === 'revision')
    return 'revision_requested'
  return value || 'assigned'
}

function CardStats({ id, items }) {
  return (
    <div className="stats-grid compact" id={id}>
      {items.map(([name, value, foot]) => (
        <article className="stat-card" key={name}>
          <div className="stat-label">{name}</div>
          <div className="stat-value">{value}</div>
          <div className="stat-foot">{foot}</div>
        </article>
      ))}
    </div>
  )
}

function Status({ value }) {
  return (
    <span className="badge">
      {show(value)}
    </span>
  )
}

function Filter({ id, value, change, entries }) {
  return (
    <select id={id} value={value} onChange={event => change(event.target.value)}>
      {entries.map(([key, name]) => (
        <option key={key} value={key}>{name}</option>
      ))}
    </select>
  )
}

function Panel({ eyebrow, title, filters, children }) {
  return (
    <article className="panel-card" style={{ marginTop: 20 }}>
      <div className="panel-head wrap-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        {filters && (
          <div className="toolbar">
            <AdminFilterMenu>{filters}</AdminFilterMenu>
          </div>
        )}
      </div>
      {children}
    </article>
  )
}

function Table({ id, columns, rows, empty, actions, onOpen, drawerControls }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map(([label]) => <th key={label}>{label}</th>)}
            {typeof onOpen === 'function' && <th>Actions</th>}
          </tr>
        </thead>
        <tbody id={id}>
          {rows.map((item, index) => (
            <tr key={str(item.id) || index}>
              {columns.map(([label, render]) => (
                <td data-label={label} key={label}>
                  {render(item)}
                </td>
              ))}
              {typeof onOpen === 'function' && (
                <td data-label="Actions">
                  <div className="table-actions">
                  <button
                    type="button"
                    disabled={!item.id}
                    onClick={() => onOpen({
                      record: item,
                      tableId: id,
                      ...(drawerControls?.(item) || {})
                    })}
                  >
                    Open
                  </button>
                    {typeof actions === 'function' && (
                    <AdminRowActionMenu>
                      {actions(item)}
                    </AdminRowActionMenu>
                  )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length + (typeof onOpen === 'function' ? 1 : 0)} className="muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const adminInspectorSchema = {
  'academy-table': [
    ['Roadmap Record', [
      ['Member', 'memberName'],
      ['Focus', 'focus'],
      ['Phase', 'phase'],
      ['Status', 'status'],
      ['Completion', 'completion']
    ]],
    ['Action Path', [
      ['Next Action', 'nextAction'],
      ['Last Check-In', 'lastCheckIn'],
      ['Notes', 'notes']
    ]]
  ],

  'academy-lead-missions-table': [
    ['Lead Mission Record', [
      ['Operator', 'memberName|operatorName'],
      ['Owner UID', 'ownerUid|memberId'],
      ['Company', 'companyName'],
      ['Contact', 'contactName'],
      ['Role', 'contactRole'],
      ['Pipeline Stage', 'pipelineStage'],
      ['Follow-up', 'followUpDueDate'],
      ['Strategic Value', 'strategicValue'],
      ['Payout Count', 'payoutCount'],
      ['Deal Count', 'dealCount'],
      ['Approved Payout Total', 'approvedPayoutTotal'],
      ['Gross Deal Total', 'grossDealTotal']
    ]],
    ['Network Routing', [
      ['Source Division', 'sourceDivision'],
      ['Source Feature', 'sourceFeature'],
      ['Source Record', 'sourceRecordId|sourceRecordPath'],
      ['Access Scopes', 'accessScopes'],
      ['Network Tags', 'networkTags'],
      ['Federation Ready', 'federationReady'],
      ['Plaza Ready', 'plazaReady']
    ]],
    ['Routed Academy Assignment', [
      ['Assignment Status', 'assignmentStatus|taskStatus|pipelineStage'],
      ['Review Status', 'reviewStatus'],
      ['Mission Type', 'missionType|contactType'],
      ['Routed Source', 'routedSourceTitle|companyName'],
      ['Assigned By', 'assignedByAdmin'],
      ['Assigned At', 'assignedAt'],
      ['Opportunity Value', 'opportunityValueAmount'],
      ['Operator Payout', 'operatorPayoutAmount'],
      ['Platform Commission', 'platformCommissionAmount'],
      ['Commission Rate', 'platformCommissionRate']
    ]],
    ['Mission Brief', [
      ['Mission Brief', 'missionBrief|academyMissionNeed|nextAction']
    ]],
    ['Submitted Proof', [
      ['Proof', 'completionProof'],
      ['Submitted', 'submittedAt'],
      ['Submitted by', 'submittedByName']
    ]],
    ['Admin Review Result', [
      ['Reviewed By', 'reviewedBy'],
      ['Reviewed At', 'reviewedAt'],
      ['Admin Note', 'adminReviewNote'],
      ['Earning Status', 'earningStatus'],
      ['Earning Ledger', 'earningLedgerId']
    ]],
    ['Operator Notes', [
      ['Notes', 'notes']
    ]],
    ['Lead Pricing / Sale Setup', [
      ['Operator Payout', 'sellerPriceAmount'],
      ['Universe Commission Rate', 'universeCommissionRate'],
      ['Universe Commission Amount', 'universeCommissionAmount'],
      ['Total Buyer Price', 'buyerPriceAmount'],
      ['Sale Enabled', 'saleEnabled'],
      ['Sale Status', 'saleStatus'],
      ['Review Status', 'saleReviewStatus'],
      ['Federation Listing', 'federationListingStatus']
    ]]
  ],

  'federation-lead-database-table': [
    ['Federation Lead Record', [
      ['Operator', 'memberName|operatorName'],
      ['Owner UID', 'ownerUid|memberId'],
      ['Company', 'companyName'],
      ['Contact', 'contactName'],
      ['Role', 'contactRole'],
      ['Location', 'city|country'],
      ['Email', 'email'],
      ['Phone', 'phone'],
      ['Pipeline Stage', 'pipelineStage'],
      ['Strategic Value', 'strategicValue'],
      ['Access Scopes', 'accessScopes'],
      ['Federation Ready', 'federationReady']
    ]],
    ['Lead Notes', [
      ['Notes', 'notes']
    ]]
  ],

  'federation-connection-requests-table': [
    ['Connection Request', [
      ['Requester', 'requesterName'],
      ['Email', 'requesterEmail'],
      ['Status', 'status'],
      ['Budget', 'budgetRange'],
      ['Urgency', 'urgency'],
      ['Intro Type', 'preferredIntroType'],
      ['Owner UID', 'ownerUid'],
      ['Lead ID', 'leadId']
    ]],
    ['Requested Contact', [
      ['Opportunity', 'opportunityTitle'],
      ['Role', 'contactRole'],
      ['City', 'city'],
      ['Country', 'country'],
      ['Category', 'category']
    ]],
    ['Reason / Intended Use', [
      ['Why they need it', 'requestReason'],
      ['Intended use', 'intendedUse'],
      ['Admin notes', 'adminNotes|adminNote']
    ]],
    ['Current Matched Lead', [
      ['Owner UID', 'ownerUid'],
      ['Lead ID', 'leadId'],
      ['Matched By', 'matchedBy'],
      ['Matched At', 'matchedAt']
    ]],
    ['Current Deal Snapshot', [
      ['Intro Price', 'pricingAmount'],
      ['Platform Commission', 'platformCommissionAmount'],
      ['Operator Payout', 'operatorPayoutAmount'],
      ['Payment Status', 'paymentStatus'],
      ['Commission Status', 'commissionStatus'],
      ['Payout Status', 'payoutStatus']
    ]]
  ],

  'federation-deal-rooms-table': [
    ['Federation Deal Room', [
      ['Title', 'title'],
      ['Creator', 'creatorName'],
      ['Type', 'roomType'],
      ['Expected Value', 'expectedValueAmount'],
      ['Commission Rate', 'platformCommissionRate'],
      ['Commission Amount', 'platformCommissionAmount'],
      ['Admin Status', 'adminStatus'],
      ['Commission Status', 'commissionStatus']
    ]],
    ['Deal Description', [
      ['Description', 'description']
    ]],
    ['Partner / Academy Need', [
      ['Partner Need', 'partnerNeed'],
      ['Academy Operator Support', 'academyMissionNeed']
    ]]
  ],

  'plazas-table': [
    ['Listing Record', [
      ['Title', 'title'],
      ['Owner', 'owner'],
      ['Type', 'type'],
      ['Status', 'status'],
      ['Reports', 'reports'],
      ['Region', 'region']
    ]],
    ['Moderator Notes', [
      ['Featured', 'featured'],
      ['Notes', 'notes']
    ]]
  ],

  'plaza-routing-requests-table': [
    ['Request Snapshot', [
      ['Target', 'targetLabel'],
      ['Requester', 'requesterName|name'],
      ['Email', 'requesterEmail'],
      ['Objective', 'objective'],
      ['Status', 'status'],
      ['Priority', 'matchingPriority|requestPriority'],
      ['Route', 'adminRoutingLane|routeKey'],
      ['Region', 'region']
    ]],
    ['Request Message', [
      ['Message', 'message|requestMessage']
    ]],
    ['Service / Provider Context', [
      ['Provider', 'providerName|adminAssignedToName'],
      ['Service Category', 'serviceCategory'],
      ['Provider Type', 'serviceProviderType'],
      ['Pricing', 'servicePriceType'],
      ['Delivery', 'serviceDeliveryTime'],
      ['Tags', 'serviceTags']
    ]],
    ['Admin Routing', [
      ['Route Label', 'routeLabel'],
      ['Matching Status', 'matchingStatus'],
      ['Assigned To', 'adminAssignedToName|raw.assignedToName'],
      ['Routed By', 'adminRoutedBy'],
      ['Routed At', 'adminRoutedAt'],
      ['Matched Labels', 'matchedLabels'],
      ['Decision', 'decisionSummary|adminDecision'],
      ['Resolution', 'resolutionSummary'],
      ['Admin Note', 'adminRouteNote|raw.adminRouteNote']
    ]]
  ]
}

function Inspector({
  record,
  close,
  tableId = '',
  onQuickStatus = null
}) {
  const sections = adminInspectorSchema[tableId] || []
  const [copyFeedback, setCopyFeedback] = useState('')

  const plazaRequest =
    tableId === 'plaza-routing-requests-table'

  const requestEmail = plazaRequest
    ? str(record.requesterEmail)
    : ''

  useEffect(() => {
    setCopyFeedback('')
  }, [record.id])

  async function copyRequestEmail() {
    const copied = await copyAdminText(requestEmail)

    setCopyFeedback(
      copied
        ? 'Email copied: ' + requestEmail
        : 'Failed to copy email.'
    )
  }

  const inspectorType = ({
    'academy-table': 'Academy',
    'academy-lead-missions-table': 'Lead Mission',
    'federation-lead-database-table': 'Federation Lead',
    'federation-connection-requests-table': 'Connection Request',
    'federation-deal-rooms-table': 'Federation Deal Room',
    'plazas-table': 'Plazas',
    'plaza-routing-requests-table': 'Plaza Request'
  })[tableId] || 'Record Details'

  const coachFormatLabel = value => {
    const raw = str(value).toLowerCase()

    if (!raw) return ''
    if (raw === 'politics_structured' ||
        raw === 'politics structured') {
      return 'Politics Structured'
    }

    if (raw === 'philosophy_structured' ||
        raw === 'philosophy structured') {
      return 'Philosophy Structured'
    }

    if (raw === 'general') return 'General'

    return str(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, character => character.toUpperCase())
  }

  const coachMessages = Array.isArray(record.recentCoachMessages)
    ? record.recentCoachMessages
    : Array.isArray(record.coachMessages)
      ? record.coachMessages
      : []

  const assistantReplies = coachMessages.filter(
    message => lower(message?.role) === 'assistant'
  )

  const latestCoachMessage =
    assistantReplies[assistantReplies.length - 1] ||
    coachMessages[coachMessages.length - 1] ||
    null

  const latestReplyFormat =
    record.latestReplyFormat ||
    record.replyFormat ||
    record.coachReplyFormat ||
    record.lastCoachReplyFormat ||
    latestCoachMessage?.replyFormat ||
    latestCoachMessage?.reply_format ||
    'general'

  const latestCoachModeKey =
    record.latestCoachModeKey ||
    record.coachModeKey ||
    record.lastCoachModeKey ||
    latestCoachMessage?.coachModeKey ||
    latestCoachMessage?.coach_mode_key ||
    ''

  const responseStyleVersion =
    record.responseStyleVersion ||
    record.lastResponseStyleVersion ||
    latestCoachMessage?.responseStyleVersion ||
    latestCoachMessage?.response_style_version ||
    ''

  const latestCoachReply = str(
    record.latestCoachReply ||
    record.lastCoachReply ||
    latestCoachMessage?.text
  )

  const recentCoachReplies = assistantReplies
    .slice(-3)
    .reverse()

  const valueFor = (label, path) => {
    if (label === 'Location') {
      return [record.city, record.country]
        .filter(Boolean).join(', ') || '—'
    }

    for (const option of path.split('|')) {
      const value = option.split('.').reduce(
        (item, key) => item?.[key],
        record
      )

      if (value === undefined || value === null || value === '') {
        continue
      }

      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No'
      }

      if (Array.isArray(value)) {
        return value.length
          ? value.map(show).join(', ')
          : '—'
      }

      if (
        /^(Approved Payout Total|Gross Deal Total|Opportunity Value|Operator Payout|Platform Commission|Universe Commission Amount|Total Buyer Price|Intro Price|Expected Value|Commission Amount)$/.test(label)
      ) {
        return str(record.currency || 'USD') + ' ' + show(value)
      }

      if (label === 'Completion') {
        return show(value) + '%'
      }

      if (
        label === 'Commission Rate' ||
        label === 'Universe Commission Rate'
      ) {
        return show(value) + '%'
      }

      return show(value)
    }

    return '—'
  }

  useEffect(() => {
    document.body.classList.add('drawer-open')

    const listener = event => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('keydown', listener)

    return () => {
      document.body.classList.remove('drawer-open')
      document.removeEventListener('keydown', listener)
    }
  }, [close])

  return (
    <>
      <div
        className="drawer-backdrop show"
        role="presentation"
        onClick={close}
      />

      <aside
        className="detail-drawer open"
        role="dialog"
        aria-modal="true"
        aria-label="Admin record details"
      >
        <div className="drawer-head">
          <div className="drawer-head-copy">
            <p className="eyebrow">{inspectorType}</p>

            <h3>
              {show(
                record.companyName ||
                record.contactName ||
                record.name ||
                record.title ||
                record.memberName ||
                record.id
              )}
            </h3>
          </div>

          {plazaRequest && (
            <div className="drawer-head-actions">
              <Status value={record.status || 'Submitted'} />

              {onQuickStatus && (
                <select
                  aria-label="Quick Status"
                  value=""
                  onChange={event => {
                    const status = event.target.value
                    if (status) onQuickStatus(status)
                  }}
                >
                  <option value="">Quick Status</option>
                  <option value="Under Review">
                    Set Under Review
                  </option>
                  <option value="Matched">
                    Set Matched
                  </option>
                  <option value="Conversation Opened">
                    Set Conversation Opened
                  </option>
                  <option value="Closed">
                    Set Closed
                  </option>
                </select>
              )}

              {requestEmail && (
                <button
                  type="button"
                  onClick={copyRequestEmail}
                >
                  Copy Email
                </button>
              )}

              {copyFeedback && (
                <span role="status" className="muted">
                  {copyFeedback}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            className="icon-btn"
            onClick={close}
            aria-label="Close record details"
          >
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {sections.length ? (
            sections
              .filter(([title]) => {
                const routedSections = [
                  'Routed Academy Assignment',
                  'Mission Brief',
                  'Submitted Proof',
                  'Admin Review Result'
                ]

                if (!routedSections.includes(title)) {
                  return true
                }

                return (
                  record.routedFromAdmin === true ||
                  String(record.sourceMethod || '')
                    .toLowerCase()
                    .startsWith('admin_routed_') ||
                  String(record.callType || '')
                    .toLowerCase() === 'opportunity_mission' ||
                  Boolean(record.assignmentStatus)
                )
              })
              .map(([title, fields]) => (
                <div className="drawer-section" key={title}>
                  <h4>{title}</h4>

                  <div className="kv-grid">
                    {fields.map(([label, path]) => (
                      <div className="kv" key={label}>
                        <span>{label}</span>
                        <strong>{valueFor(label, path)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          ) : (
            <div className="drawer-section">
              <div className="kv-grid">
                {Object.entries(record).map(([key, value]) => (
                  <div className="kv" key={key}>
                    <span>{key}</span>
                    <strong>{show(value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tableId === 'academy-table' && (
            <div className="drawer-section">
              <div className="stack-item-head">
                <h4>Coach Debug Inspector</h4>

                <div className="table-actions">
                  <span className="badge">
                    {coachFormatLabel(latestReplyFormat)}
                  </span>

                  {latestCoachModeKey && (
                    <span className="badge">
                      {coachFormatLabel(latestCoachModeKey)}
                    </span>
                  )}
                </div>
              </div>

              <div className="application-meta-grid">
                <div className="application-meta-item">
                  <span>Reply Format</span>
                  <strong>
                    {coachFormatLabel(latestReplyFormat) || 'General'}
                  </strong>
                </div>

                <div className="application-meta-item">
                  <span>Coach Mode</span>
                  <strong>
                    {coachFormatLabel(latestCoachModeKey) || 'General'}
                  </strong>
                </div>

                <div className="application-meta-item">
                  <span>Style Version</span>
                  <strong>{str(responseStyleVersion) || '—'}</strong>
                </div>
              </div>

              <div className="stack-list">
                <div className="stack-item">
                  <div className="stack-item-head">
                    <strong>Latest Saved Reply</strong>
                  </div>

                  <p>
                    {latestCoachReply ||
                      'No latest assistant reply text saved yet.'}
                  </p>
                </div>
              </div>

              <div className="stack-list">
                {recentCoachReplies.length ? (
                  recentCoachReplies.map((message, index) => (
                    <div
                      className="stack-item"
                      key={str(message.id || index)}
                    >
                      <div className="stack-item-head">
                        <strong>Coach Reply</strong>

                        <div className="table-actions">
                          <span className="badge">
                            {coachFormatLabel(
                              message.replyFormat ||
                              message.reply_format ||
                              'general'
                            )}
                          </span>

                          {(message.coachModeKey ||
                            message.coach_mode_key) && (
                            <span className="badge">
                              {coachFormatLabel(
                                message.coachModeKey ||
                                message.coach_mode_key
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <p>
                        {str(message.text) || 'No text saved.'}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="stack-item">
                    <p className="muted">
                      No recent assistant coach messages saved yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

function useOperations(refresh) {
  const [busy, setBusy] = useState('')
  const [blocked, setBlocked] = useState([])
  const [message, setMessage] = useState('')

  async function run(key, url, body, verify, confirmation) {
    if (busy || blocked.includes(key)) return false
    if (confirmation && !window.confirm(confirmation)) return false

    setBusy(key)
    setMessage('')

    let accepted = false

    try {
      await adminFetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      accepted = true

      const live = await getAdminBootstrap()

      if (!verify(live.state)) {
        throw new Error(
          'The backend accepted the action, but the refreshed record did not confirm its result.'
        )
      }

      setMessage('Operation saved and verified against live Admin data.')
      refresh()
      return true
    } catch (error) {
      if (error?.status !== 423) {
        setBlocked(previous => [...new Set([...previous, key])])
      }

      setMessage(
        error?.status === 423
          ? error.message
          : `${error.message || 'Operation failed.'} ${
              accepted
                ? 'The server may already have saved this change.'
                : 'The record must be checked before retrying.'
            }`
      )

      if (accepted) refresh()
      return false
    } finally {
      setBusy('')
    }
  }

  return {
    run,
    busy,
    blocked,
    message,
    setMessage
  }
}

function Action({ name, actionKey, operations, click }) {
  return (
    <button
      type="button"
      disabled={
        Boolean(operations.busy) ||
        operations.blocked.includes(actionKey)
      }
      onClick={click}
    >
      {operations.busy === actionKey ? 'Processing...' : name}
    </button>
  )
}

/* YHU_ADMIN_PHASE1_INLINE_V1 */

function updateLeadNetwork(op, item, patch, verify, name, ask = true) {
  const owner = str(item.memberId || item.ownerUid)
  const id = str(item.id)

  if (!owner || !id) return Promise.resolve(false)

  return op.run(
    'network:' + id,
    '/api/admin/academy/lead-missions/' +
      encodeURIComponent(owner) + '/' +
      encodeURIComponent(id) + '/network',
    patch,
    state => {
      const updated = find(state.academyLeadMissions, id)
      return Boolean(updated && verify(updated))
    },
    ask
      ? 'Confirm ' + name + ' for ' + (item.companyName || id) + '?'
      : ''
  )
}

function LeadValueModal({ record, op, close, submit }) {
  return (
    <AdminActionModal
      title="Set Strategic Value"
      description="Choose this lead's strategic value for the YH network."
      submitLabel="Save Value"
      busy={Boolean(op.busy)}
      error={op.message}
      onCancel={() => { if (!op.busy) close() }}
      onSubmit={submit}
      fields={[{
        name: 'strategicValue',
        label: 'Strategic Value',
        type: 'select',
        required: true,
        value: str(record.strategicValue || 'standard'),
        options: [
          'standard', 'watch', 'medium', 'high', 'strategic'
        ].map(value => ({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1)
        }))
      }]}
    />
  )
}

function federationEconomyCards(requests) {
  const priced = list(requests).filter(r =>
    Number(r.pricingAmount || 0) > 0 ||
    Number(r.operatorPayoutAmount || 0) > 0 ||
    ['pricing_sent', 'paid', 'intro_delivered', 'completed']
      .includes(lower(r.status))
  )

  const paid = list(requests).filter(r =>
    lower(r.paymentStatus) === 'paid' ||
    ['paid', 'intro_delivered', 'completed']
      .includes(lower(r.status))
  )

  const total = (rows, field) => {
    const amounts = new Map()

    for (const record of rows) {
      const amount = Number(record[field] || 0)
      const currency = str(record.currency || 'USD').toUpperCase()

      if (!Number.isFinite(amount) || amount <= 0) continue

      amounts.set(
        currency,
        (amounts.get(currency) || 0) + amount
      )
    }

    if (!amounts.size) amounts.set('USD', 0)

    return [...amounts].map(([currency, amount]) => {
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0
        }).format(amount)
      } catch {
        return currency + ' ' + amount
      }
    }).join(' + ')
  }

  return [
    [
      'Priced Packages',
      priced.length,
      priced.filter(r => str(r.ownerUid) && str(r.leadId)).length +
        ' mirrored to Academy earnings'
    ],
    [
      'Package Gross',
      total(priced, 'pricingAmount'),
      total(paid, 'pricingAmount') + ' paid / delivered'
    ],
    [
      'Platform Commission',
      total(priced, 'platformCommissionAmount'),
      'Projected YH commission'
    ],
    [
      'Operator Payouts',
      total(priced, 'operatorPayoutAmount'),
      'Projected Academy operator payout'
    ]
  ]
}

function Academy({ state, search, refresh, open }) {
  const [focus, setFocus] = useState('all')
  const [roadmapStatus, setRoadmapStatus] = useState('all')
  const [stage, setStage] = useState('all')
  const [scope, setScope] = useState('all')
  const [review, setReview] = useState('all')
  const [pricingId, setPricingId] = useState('')
  const [strategicValueId, setStrategicValueId] = useState('')
  const [reviewDialog, setReviewDialog] = useState(null)

  const op = useOperations(refresh)
  const roadmap = list(state.academy)
  const leads = list(state.academyLeadMissions)
  const pricingRecord = find(leads, pricingId)
  const strategicValueRecord = find(leads, strategicValueId)
  const reviewRecord = find(leads, reviewDialog?.id)

  const reviewTier = reviewRecord
    ? str(
        reviewRecord.tier ||
        reviewRecord.leadTier ||
        reviewRecord.contactTier ||
        reviewRecord.payoutTier ||
        reviewRecord.level ||
        reviewRecord.strategicValue ||
        'tier from backend'
      )
    : ''

  const reviewTargets = reviewRecord
    ? [
        reviewRecord.plazaReady ||
          list(reviewRecord.accessScopes).map(lower).includes('plazas')
          ? 'Plaza' : '',
        reviewRecord.federationReady ||
          list(reviewRecord.accessScopes).map(lower).includes('federation')
          ? 'Federation' : ''
      ].filter(Boolean).join(' + ') || 'No auto-route target marked'
    : ''
  const playbooks = list(state.missionPlaybooks)

  const roadmapRows = roadmap.filter(item =>
    (focus === 'all' || item.focus === focus) &&
    (roadmapStatus === 'all' || item.status === roadmapStatus) &&
    searchMatches(item, search)
  )

  const leadRows = leads.filter(item =>
    (stage === 'all' || item.pipelineStage === stage) &&
    (scope === 'all' || list(item.accessScopes).includes(scope)) &&
    (review === 'all' || reviewStatus(item) === review) &&
    searchMatches(item, search)
  )

  const stats = [
    ['Roadmap Records', roadmap.length, 'Tracked in current system'],
    ['Needs Review', roadmap.filter(x => x.status === 'Needs Review').length, 'Records missing a live roadmap'],
    ['At Risk', roadmap.filter(x => x.status === 'At Risk').length, 'Low momentum members'],
    ['Lead Records', leads.length, 'Academy-origin network records'],
    ['Submitted Missions', leads.filter(x => reviewStatus(x) === 'submitted').length, 'Waiting for admin review'],
    ['Approved Missions', leads.filter(x => ['approved','completed'].includes(reviewStatus(x))).length, 'Reviewed and accepted'],
    ['Federation Ready', leads.filter(x => x.federationReady === true).length, 'Cross-division strategic routing'],
    ['Plaza Ready', leads.filter(x => x.plazaReady === true).length, 'Marketplace-ready relationships']
  ]

  const network = (item, patch, expected, name, ask = true) =>
    updateLeadNetwork(op, item, patch, expected, name, ask)

  async function saveLeadPricing(values) {
    const record = pricingRecord
    if (!record) return

    const sellerText = str(values.sellerPriceAmount)
    const rateText = str(values.universeCommissionRate)
    const seller = Number(sellerText)
    const rate = Number(rateText)
    const currency = str(values.currency).toUpperCase()
    const enabled = str(values.saleEnabled)
    const saleStatus = str(values.saleStatus)
    const reviewStatusValue = str(values.saleReviewStatus)

    if (!sellerText || !rateText ||
      !Number.isFinite(seller) || seller < 0 ||
      !Number.isFinite(rate) || rate < 0 || rate > 100 ||
      !['USD', 'EUR', 'GBP', 'NGN', 'PHP', 'INR'].includes(currency) ||
      !['true', 'false'].includes(enabled) ||
      !['not_listed', 'pending_admin_review', 'listed', 'paused'].includes(saleStatus) ||
      !['not_listed', 'pending_admin_review', 'approved', 'rejected'].includes(reviewStatusValue)) {
      op.setMessage('Enter valid lead pricing values before saving.')
      return
    }

    const saleEnabled = enabled === 'true'
    const commission = seller > 0
      ? Number(((seller * rate) / 100).toFixed(2))
      : 0
    const buyer = Number((seller + commission).toFixed(2))

    const expectedSale =
      saleEnabled && buyer > 0 ? saleStatus : 'not_listed'
    const expectedReview =
      saleEnabled && buyer > 0 ? reviewStatusValue : 'not_listed'

    const sameMoney = (actual, expected) =>
      Number.isFinite(Number(actual)) &&
      Math.abs(Number(actual) - expected) < 0.011

    const saved = await network(
      record,
      {
        sellerPriceAmount: seller,
        currency,
        universeCommissionRate: rate,
        saleEnabled,
        saleStatus,
        saleReviewStatus: reviewStatusValue
      },
      updated =>
        sameMoney(updated.sellerPriceAmount, seller) &&
        str(updated.currency) === currency &&
        sameMoney(updated.universeCommissionRate, rate) &&
        sameMoney(updated.universeCommissionAmount, commission) &&
        sameMoney(updated.buyerPriceAmount, buyer) &&
        updated.saleEnabled === saleEnabled &&
        str(updated.saleStatus) === expectedSale &&
        str(updated.saleReviewStatus) === expectedReview &&
        str(updated.federationListingStatus) === expectedSale,
      'lead pricing update',
      false
    )

    if (saved) setPricingId('')
  }

  async function saveStrategicValue(values) {
    if (!strategicValueRecord) return

    const next = lower(values.strategicValue)
    const record = strategicValueRecord

    if (!['standard', 'watch', 'medium', 'high', 'strategic']
      .includes(next)) {
      op.setMessage('Invalid strategic value.')
      return
    }

    const saved = await network(
      record,
      { strategicValue: next },
      updated => lower(updated.strategicValue) === next,
      'strategic value change',
      false
    )

    if (saved) setStrategicValueId('')
  }

  function leadReview(item, decision) {
    const id = str(item?.id)
    const owner = str(item?.memberId || item?.ownerUid)

    if (
      !id || !owner ||
      !['approved', 'revision_requested', 'rejected'].includes(decision)
    ) return

    op.setMessage('')
    setStrategicValueId('')
    setPricingId('')
    setReviewDialog({ id, decision })
  }

  async function saveLeadReview(values) {
    if (!reviewRecord || !reviewDialog) return

    const decision = reviewDialog.decision
    const owner = str(reviewRecord.memberId || reviewRecord.ownerUid)
    const id = str(reviewRecord.id)
    const adminNote = str(values.adminNote)

    if (!id || !owner) {
      op.setMessage('Missing Lead Mission owner or record id.')
      return
    }

    if (!adminNote) {
      op.setMessage('Admin reason is required.')
      return
    }

    const saved = await op.run(
      'review:' + id,
      '/api/admin/academy/lead-missions/' +
        encodeURIComponent(owner) + '/' +
        encodeURIComponent(id) + '/review',
      { decision, adminNote },
      snapshot => {
        const updated = find(snapshot.academyLeadMissions, id)
        return updated && reviewStatus(updated) === decision
      },
      ''
    )

    if (saved) setReviewDialog(null)
  }

  return (
    <>
      <CardStats id="academy-stats" items={stats} />
      {op.message && <p role="status">{op.message}</p>}

      <Panel eyebrow="Academy Mission System" title="Mission Playbooks">
        <div
          id="academy-mission-playbooks-table"
          className="admin-mission-cards"
        >
          {playbooks.map((item, index) => (
            <article
              className="admin-mission-card"
              key={str(item.id) || index}
            >
              <header className="admin-mission-header">
                <div>
                  <p className="eyebrow">Mission</p>
                  <h4>{show(item.title)}</h4>
                </div>
                <span className="badge">
                  {show(item.difficulty)}
                </span>
              </header>

              <p className="admin-mission-summary">
                {show(item.summary)}
              </p>

              <div className="admin-mission-details">
                <div>
                  <span>Type</span>
                  <strong>{show(item.missionType)}</strong>
                </div>
                <div>
                  <span>Tools</span>
                  <p>{list(item.tools).join(', ') || '—'}</p>
                </div>
                <div>
                  <span>Proof Required</span>
                  <p>{list(item.proofRequired).join(', ') || '—'}</p>
                </div>
              </div>

              <section
                className="admin-mission-payout"
                aria-label="Payout"
              >
                <h5>Payout</h5>

                {item.payoutRules &&
                typeof item.payoutRules === 'object' &&
                !Array.isArray(item.payoutRules) ? (
                  <dl>
                    {Object.entries(item.payoutRules).map(
                      ([key, value]) => (
                        <div key={key}>
                          <dt>
                            {key
                              .replace(/([a-z])([A-Z])/g, '$1 $2')
                              .replace(/^./, c => c.toUpperCase())}
                          </dt>
                          <dd>{show(value)}</dd>
                        </div>
                      )
                    )}
                  </dl>
                ) : (
                  <p>{show(item.payoutRules)}</p>
                )}
              </section>
            </article>
          ))}

          {!playbooks.length && (
            <p className="muted">
              No mission playbooks loaded.
            </p>
          )}
        </div>
      </Panel>

      <Panel
        eyebrow="Academy Operations"
        title="Roadmap Monitoring"
        filters={
          <>
            <Filter id="academy-focus-filter" value={focus} change={setFocus}
              entries={['all','Mental','Physical','Financial','Academic'].map(
                (value, index) => [value, index ? value : 'All Focus Areas']
              )}
            />
            <Filter id="academy-review-filter" value={roadmapStatus}
              change={setRoadmapStatus}
              entries={[
                ['all','All Review States'],['Needs Review','Needs Review'],
                ['On Track','On Track'],['At Risk','At Risk']
              ]}
            />
          </>
        }
      >
        <Table
          id="academy-table"
          rows={roadmapRows}
          empty="No Academy records match the current filters."
          onOpen={open}
          columns={[
            ['Member', x => <><strong>{show(x.memberName)}</strong><div className="muted mono">{show(x.id)}</div></>],
            ['Current Phase', x => show(x.phase)],
            ['Focus', x => <Status value={x.focus} />],
            ['Completion', x => `${Number(x.completion || 0)}%`],
            ['Last Check-In', x => show(x.lastCheckIn)],
            ['Status', x => <Status value={x.status} />]
          ]}
          actions={item => {
            const owner = str(item.memberId)
            return (
              <>
                <Action name="Nudge" actionKey={`nudge:${owner}`} operations={op}
                  click={() => owner && op.run(
                    `nudge:${owner}`,
                    `/api/admin/academy/${encodeURIComponent(owner)}/nudge`,
                    {},
                    snapshot => list(snapshot.academy).some(x =>
                      str(x.memberId) === owner &&
                      x.lastCheckIn === 'Nudge sent'
                    ),
                    `Send a roadmap nudge to ${item.memberName}?`
                  )}
                />
                <Action name="Mark On Track" actionKey={`track:${owner}`}
                  operations={op}
                  click={() => owner && op.run(
                    `track:${owner}`,
                    `/api/admin/academy/${encodeURIComponent(owner)}/track`,
                    {},
                    snapshot => list(snapshot.academy).some(x =>
                      str(x.memberId) === owner &&
                      x.status === 'On Track'
                    ),
                    `Mark ${item.memberName} On Track?`
                  )}
                />
              </>
            )
          }}
        />
      </Panel>

      <Panel
        eyebrow="Academy Operations"
        title="Lead Missions Network Pipeline"
        filters={
          <>
            <Filter id="academy-lead-stage-filter" value={stage} change={setStage}
              entries={[
                ['all','All Lead Stages'],['new','New'],['contacted','Contacted'],
                ['follow_up','Follow-up'],['qualified','Qualified'],
                ['closed_won','Closed Won'],['closed_lost','Closed Lost']
              ]}
            />
            <Filter id="academy-lead-scope-filter" value={scope} change={setScope}
              entries={[
                ['all','All Network Scopes'],['academy','Academy'],
                ['federation','Federation'],['plazas','Plazas']
              ]}
            />
            <Filter id="academy-lead-review-filter" value={review} change={setReview}
              entries={[
                ['all','All Mission Review States'],['assigned','Assigned'],
                ['submitted','Submitted / Pending Review'],
                ['revision_requested','Revision Requested'],['approved','Approved'],
                ['rejected','Rejected'],['completed','Completed']
              ]}
            />
          </>
        }
      >
        <Table
          id="academy-lead-missions-table"
          rows={leadRows}
          empty="No Lead Missions records match the current filters."
          onOpen={open}
          columns={[
            ['Operator', x => <><strong>{show(x.memberName || x.operatorName)}</strong><div className="muted mono">{show(x.ownerUid || x.memberId)}</div></>],
            ['Company / Contact', x => <><strong>{show(x.companyName)}</strong><div className="muted">{show(x.contactName)}</div></>],
            ['Stage', x => show(x.pipelineStage)],
            ['Review', x => <Status value={reviewStatus(x)} />],
            ['Network Scope', x => list(x.accessScopes).join(', ') || '—'],
            ['Follow-up', x => show(x.followUpDueDate)],
            ['Strategic Value', x => <Status value={x.strategicValue || 'standard'} />]
          ]}
          actions={item => (
            <>
              {['submitted','pending_review'].includes(reviewStatus(item)) && (
                <>
                  <Action name="Approve" actionKey={`review:${item.id}`} operations={op}
                    click={() => leadReview(item, 'approved')} />
                  <Action name="Revision" actionKey={`review:${item.id}`} operations={op}
                    click={() => leadReview(item, 'revision_requested')} />
                  <Action name="Reject" actionKey={`review:${item.id}`} operations={op}
                    click={() => leadReview(item, 'rejected')} />
                </>
              )}
              <Action
                name="Set Value"
                actionKey={'network:' + item.id}
                operations={op}
                click={() => {
                  op.setMessage('')
                  setReviewDialog(null)
                  setPricingId('')
                  setStrategicValueId(str(item.id))
                }}
              />
              <Action
                name="Set Lead Pricing"
                actionKey={'network:' + item.id}
                operations={op}
                click={() => {
                  op.setMessage('')
                  setPricingId(str(item.id))
                }}
              />
              <Action
                name={item.federationReady ? 'Unmark Federation' : 'Federation Ready'}
                actionKey={`network:${item.id}`} operations={op}
                click={() => {
                  const next = item.federationReady !== true
                  network(item, { federationReady: next },
                    updated => updated.federationReady === next,
                    'Federation readiness change')
                }}
              />
              <Action
                name={item.plazaReady ? 'Remove Plaza Ready' : 'Mark Plaza Ready'}
                actionKey={`network:${item.id}`}
                operations={op}
                click={() => {
                  const next = item.plazaReady !== true
                  network(
                    item,
                    { plazaReady: next },
                    updated => updated.plazaReady === next,
                    'Plaza readiness change'
                  )
                }}
              />
            </>
          )}
        />
      </Panel>



      {strategicValueRecord && (
        <LeadValueModal
          record={strategicValueRecord}
          op={op}
          close={() => setStrategicValueId('')}
          submit={saveStrategicValue}
        />
      )}

      {reviewRecord && reviewDialog && (
        <AdminActionModal
          key={'review-' + reviewDialog.id + '-' + reviewDialog.decision}
          title={
            reviewDialog.decision === 'approved'
              ? 'Approve Academy Lead'
              : reviewDialog.decision === 'revision_requested'
                ? 'Request Lead Revision'
                : 'Reject Academy Lead'
          }
          description={
            reviewDialog.decision === 'approved'
              ? 'Backend will compute payout from tier (' +
                reviewTier +
                ') and auto-route when marked: ' +
                reviewTargets +
                '. Add approval reason before approving.'
              : reviewDialog.decision === 'revision_requested'
                ? 'Tell the operator what needs to be corrected before approval.'
                : 'Add the reason this lead is being rejected. No payout or auto-route will be created.'
          }
          submitLabel={
            reviewDialog.decision === 'approved'
              ? 'Approve Lead'
              : reviewDialog.decision === 'revision_requested'
                ? 'Send Lead Revision'
                : 'Reject Lead'
          }
          busy={Boolean(op.busy)}
          error={op.message}
          onCancel={() => {
            if (!op.busy) setReviewDialog(null)
          }}
          onSubmit={saveLeadReview}
          fields={[{
            name: 'adminNote',
            label:
              reviewDialog.decision === 'revision_requested'
                ? 'Revision Reason'
                : reviewDialog.decision === 'rejected'
                  ? 'Rejection Reason'
                  : 'Approval Reason',
            type: 'textarea',
            rows: 5,
            required: true,
            value: '',
            placeholder:
              reviewDialog.decision === 'approved'
                ? 'Why is this lead approved? Backend will calculate payout from tier.'
                : reviewDialog.decision === 'revision_requested'
                  ? 'What exactly should the operator fix?'
                  : 'Why is this lead rejected?'
          }]}
        />
      )}

      {pricingRecord && (
        <AdminActionModal
          key={pricingId}
          title="Set Lead Pricing"
          description="Set the operator payout, Universe commission, and final buyer price for this Academy lead. Total buyer price is calculated automatically."
          submitLabel="Save Lead Pricing"
          busy={Boolean(op.busy)}
          error={op.message}
          onCancel={() => {
            if (!op.busy) setPricingId('')
          }}
          onSubmit={saveLeadPricing}
          fields={[
            {
              name: 'sellerPriceAmount',
              label: 'Operator Payout / Seller Price',
              type: 'number',
              min: '0',
              step: '0.01',
              value: String(Number(pricingRecord.sellerPriceAmount || 0) || ''),
              placeholder: 'Example: 100',
              required: true
            },
            {
              name: 'currency',
              label: 'Currency',
              type: 'select',
              value: str(pricingRecord.currency || 'USD').toUpperCase(),
              required: true,
              options: ['USD', 'EUR', 'GBP', 'NGN', 'PHP', 'INR']
                .map(value => ({ value, label: value }))
            },
            {
              name: 'universeCommissionRate',
              label: 'Universe Commission %',
              type: 'number',
              min: '0',
              max: '100',
              step: '0.01',
              value: String(Number(pricingRecord.universeCommissionRate || 20)),
              placeholder: 'Example: 20',
              required: true
            },
            {
              name: 'saleEnabled',
              label: 'Enable Sale / Marketplace Listing',
              type: 'select',
              value: pricingRecord.saleEnabled === true ? 'true' : 'false',
              required: true,
              options: [
                { value: 'true', label: 'Yes — make this sellable' },
                { value: 'false', label: 'No — keep private / not listed' }
              ]
            },
            {
              name: 'saleStatus',
              label: 'Sale Status',
              type: 'select',
              value: str(pricingRecord.saleStatus || 'not_listed'),
              required: true,
              options: [
                { value: 'not_listed', label: 'Not Listed' },
                { value: 'pending_admin_review', label: 'Pending Admin Review' },
                { value: 'listed', label: 'Listed / Sellable' },
                { value: 'paused', label: 'Paused' }
              ]
            },
            {
              name: 'saleReviewStatus',
              label: 'Review Status',
              type: 'select',
              value: str(pricingRecord.saleReviewStatus || 'not_listed'),
              required: true,
              options: [
                { value: 'not_listed', label: 'Not Listed' },
                { value: 'pending_admin_review', label: 'Pending Admin Review' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' }
              ]
            }
          ]}
        />
      )}
    </>
  )
}

function getFederationLeadMatchOptionsReactV1(request = {}, leads = []) {
  const normalize = value => str(value).toLowerCase()
  const requested = request.requestedContact &&
    typeof request.requestedContact === 'object'
      ? request.requestedContact : {}

  const target = {
    companyName: requested.companyName || request.companyName,
    contactRole: requested.contactRole || request.contactRole,
    contactType: requested.contactType || request.category,
    city: requested.city || request.city,
    country: requested.country || request.country,
    sourceMethod: requested.sourceMethod || request.sourceMethod,
    channel: requested.channel || request.channel,
    pipelineStage: requested.pipelineStage || request.pipelineStage,
    priority: requested.priority || request.priority,
    requestedTier: requested.requestedTier || request.tier
  }

  const matches = (a, b) => {
    a = normalize(a)
    b = normalize(b)
    return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)))
  }

  const weights = [
    ['country', 'country', 30], ['city', 'city', 18],
    ['contactType', 'contactType', 24], ['contactRole', 'contactRole', 22],
    ['companyName', 'companyName', 14], ['sourceMethod', 'sourceMethod', 8],
    ['channel', 'channel', 8], ['pipelineStage', 'pipelineStage', 8],
    ['priority', 'priority', 5], ['requestedTier', 'tier', 8]
  ]

  return list(leads)
    .filter(lead => lead.federationReady === true &&
      str(lead.id) && str(lead.ownerUid || lead.memberId))
    .map(lead => {
      let score = weights.reduce((sum, [from, to, weight]) =>
        sum + (matches(target[from], lead[to]) ? weight : 0), 0)

      if (normalize(lead.strategicValue) === 'strategic') score += 8
      if (normalize(lead.strategicValue) === 'high') score += 5
      if (lead.email) score += 4
      if (lead.phone) score += 4

      return { lead, score }
    })
    .sort((a, b) => b.score - a.score ||
      str(b.lead.updatedAt).localeCompare(str(a.lead.updatedAt)))
    .map(({ lead, score }) => ({
      value: str(lead.ownerUid || lead.memberId) + '::' + str(lead.id),
      label: [
        score ? 'Score ' + score : 'Low match',
        lead.companyName || 'Private organization',
        lead.contactName || 'Protected contact',
        lead.contactRole,
        [lead.city, lead.country].filter(Boolean).join(', ')
      ].filter(Boolean).join(' • ')
    }))
}

function Federation({ state, search, refresh, open, routeAcademy }) {
  const [value, setValue] = useState('all')
  const [country, setCountry] = useState('all')
  const [requestStatus, setRequestStatus] = useState('all')
  const [dealStatus, setDealStatus] = useState('all')
  const [matchRequestId, setMatchRequestId] = useState('')
  const [dealRequestId, setDealRequestId] = useState('')
  const [leadValueId, setLeadValueId] = useState('')

  const op = useOperations(refresh)

  const network = (item, patch, verify, name) =>
    updateLeadNetwork(op, item, patch, verify, name)
  const leads = list(state.federationLeadDatabase)
  const requests = list(state.federationConnectionRequests)
  const rooms = list(state.federationDealRooms)
  const leadValueRecord = find(leads, leadValueId)
  const matchRequest = find(requests, matchRequestId)
  const dealRequest = find(requests, dealRequestId)
  const matchingOptions = matchRequest
    ? getFederationLeadMatchOptionsReactV1(matchRequest, leads)
    : []

  const countries = [...new Set(leads.map(x => str(x.country)).filter(Boolean))].sort()

  const leadRows = leads.filter(x =>
    (value === 'all' || lower(x.strategicValue || 'standard') === value) &&
    (country === 'all' || x.country === country) &&
    searchMatches(x, search)
  )

  const requestRows = requests.filter(x =>
    (requestStatus === 'all' || x.status === requestStatus) &&
    searchMatches(x, search)
  )

  const roomRows = rooms.filter(x =>
    (dealStatus === 'all' || x.adminStatus === dealStatus) &&
    searchMatches(x, search)
  )

  const stats = [
    ['Federation Leads', leads.length, 'Admin-routed Lead Missions'],
    ['Strategic Leads', leads.filter(x => lower(x.strategicValue) === 'strategic').length, 'Highest-value contacts'],
    ['Connection Requests', requests.length, 'Looking-for-contact requests'],
    ['Deal Rooms', rooms.length, 'Admin-supervised partnerships'],
    ['Pending Match', requests.filter(x =>
      ['pending_admin_match','pending_review'].includes(lower(x.status))
    ).length, 'Needs admin action'],
    ...federationEconomyCards(requests)
  ]

  const changeStatus = (item, status, isRoom = false) => {
    const id = str(item.id)
    op.run(
      `${isRoom ? 'room' : 'request'}:${id}`,
      isRoom
        ? `/api/admin/federation/deal-rooms/${encodeURIComponent(id)}/status`
        : `/api/admin/federation/connection-requests/${encodeURIComponent(id)}/status`,
      isRoom ? { adminStatus: status } : { status },
      snapshot => {
        const updated = find(
          isRoom ? snapshot.federationDealRooms : snapshot.federationConnectionRequests,
          id
        )
        return updated && lower(
          isRoom ? updated.adminStatus : updated.status
        ) === status
      },
      `Confirm ${status.replace(/_/g,' ')} for ${id}?`
    )
  }

  async function matchSelectedFederationLead(values) {
    if (!matchRequest) return

    const [ownerUid, leadId] = str(values.selectedLead).split('::')
    const id = str(matchRequest.id)

    if (
      !matchingOptions.some(option => option.value === str(values.selectedLead)) ||
      !ownerUid ||
      !leadId
    ) {
      op.setMessage('Select a lead to match first.')
      return
    }

    const saved = await op.run(
      'match:' + id,
      '/api/admin/federation/connection-requests/' +
        encodeURIComponent(id) + '/match',
      { ownerUid, leadId },
      snapshot => {
        const updated = find(snapshot.federationConnectionRequests, id)
        return updated &&
          str(updated.ownerUid) === ownerUid &&
          str(updated.leadId) === leadId &&
          lower(updated.status) === 'matched'
      },
      ''
    )

    if (saved) setMatchRequestId('')
  }

  async function saveFederationDealPackage(values) {
    if (!dealRequest) return

    const id = str(dealRequest.id)
    const numeric = [
      'pricingAmount',
      'platformCommissionRate',
      'platformCommissionAmount',
      'operatorPayoutAmount'
    ]

    for (const key of numeric) {
      const text = str(values[key])
      if (text && (!Number.isFinite(Number(text)) || Number(text) < 0)) {
        op.setMessage('Enter a valid nonnegative value for ' + key + '.')
        return
      }
    }

    const price = Number(values.pricingAmount || 0)
    const rate = Number(values.platformCommissionRate || 0)

    if (rate > 100 || str(values.dealNotes).length > 2000) {
      op.setMessage(
        'Commission must be 0–100%, and Deal Notes must be at most 2000 characters.'
      )
      return
    }

    const computedCommission =
      str(values.platformCommissionAmount) !== ''
        ? Number(values.platformCommissionAmount)
        : Math.round(price * rate / 100)

    const computedPayout =
      str(values.operatorPayoutAmount) !== ''
        ? Number(values.operatorPayoutAmount)
        : Math.max(0, price - computedCommission)

    const body = {
      pricingAmount: str(values.pricingAmount),
      currency: str(values.currency),
      platformCommissionRate: str(values.platformCommissionRate),
      platformCommissionAmount: str(values.platformCommissionAmount),
      operatorPayoutAmount: str(values.operatorPayoutAmount),
      paymentStatus: str(values.paymentStatus),
      payoutStatus: str(values.payoutStatus),
      commissionStatus: str(values.commissionStatus),
      dealNotes: str(values.dealNotes)
    }

    const equal = (actual, expected) =>
      Number.isFinite(Number(actual)) &&
      Math.abs(Number(actual) - expected) < 0.011

    const saved = await op.run(
      'deal:' + id,
      '/api/admin/federation/connection-requests/' +
        encodeURIComponent(id) + '/deal-package',
      body,
      snapshot => {
        const updated = find(snapshot.federationConnectionRequests, id)

        return updated &&
          equal(updated.pricingAmount, price) &&
          str(updated.currency) === body.currency &&
          equal(updated.platformCommissionRate, rate) &&
          equal(updated.platformCommissionAmount, computedCommission) &&
          equal(updated.operatorPayoutAmount, computedPayout) &&
          str(updated.paymentStatus) === body.paymentStatus &&
          str(updated.payoutStatus) === body.payoutStatus &&
          str(updated.commissionStatus) === body.commissionStatus &&
          str(updated.dealNotes) === body.dealNotes &&
          lower(updated.status) ===
            (body.paymentStatus === 'paid' ? 'paid' : 'pricing_sent')
      },
      ''
    )

    if (saved) setDealRequestId('')
  }

  async function saveLeadValue(values) {
    const value = lower(values.strategicValue)

    if (
      !leadValueRecord ||
      !['standard', 'watch', 'medium', 'high', 'strategic']
        .includes(value)
    ) {
      op.setMessage('Invalid strategic value.')
      return
    }

    const saved = await network(
      leadValueRecord,
      { strategicValue: value },
      record => lower(record.strategicValue) === value,
      'strategic value change'
    )

    if (saved) setLeadValueId('')
  }

  return (
    <>
      <CardStats id="federation-network-stats" items={stats} />
      {op.message && <p role="status">{op.message}</p>}

      <Panel eyebrow="Federation Network Desk" title="Lead Database"
        filters={
          <>
            <Filter id="federation-lead-value-filter" value={value} change={setValue}
              entries={['all','strategic','high','medium','watch','standard'].map(
                (x, i) => [x, i ? x : 'All Values']
              )}
            />
            <Filter id="federation-lead-country-filter" value={country} change={setCountry}
              entries={[['all','All Countries'],...countries.map(x => [x,x])]}
            />
          </>
        }
      >
        <Table
          id="federation-lead-database-table"
          rows={leadRows}
          empty="No Federation-ready leads match the current filters."
          onOpen={open}
          columns={[
            ['Operator', x => show(x.memberName || x.operatorName)],
            ['Lead / Contact', x => <><strong>{show(x.companyName)}</strong><div className="muted">{show(x.contactName)}</div></>],
            ['Location', x => [x.city,x.country].filter(Boolean).join(', ') || '—'],
            ['Stage', x => show(x.pipelineStage || x.callOutcome)],
            ['Value', x => <Status value={x.strategicValue || 'standard'} />],
            ['Contact', x => [x.email && 'Email on file',x.phone && 'Phone on file'].filter(Boolean).join(' • ') || 'Intro required']
          ]}
          actions={item => (
            <>
              <Action
                name="Set Value"
                actionKey={'network:' + item.id}
                operations={op}
                click={() => setLeadValueId(str(item.id))}
              />

              <Action
                name={item.federationReady
                  ? 'Unmark Federation'
                  : 'Federation Ready'}
                actionKey={'network:' + item.id}
                operations={op}
                click={() => {
                  const next = item.federationReady !== true

                  network(
                    item,
                    { federationReady: next },
                    record => record.federationReady === next,
                    'Federation readiness change'
                  )
                }}
              />
            </>
          )}
        />
      </Panel>

      <Panel eyebrow="Looking For Contact" title="Connection Requests"
        filters={
          <Filter id="federation-request-status-filter"
            value={requestStatus} change={setRequestStatus}
            entries={[
              ['all','All Statuses'],['pending_admin_match','Pending Admin Match'],
              ['pending_review','Pending Review'],['matched','Matched'],
              ['pricing_sent','Pricing Sent'],['paid','Paid'],
              ['intro_delivered','Intro Delivered'],['completed','Completed'],
              ['rejected','Rejected']
            ]}
          />
        }
      >
        <Table
          id="federation-connection-requests-table"
          rows={requestRows}
          empty="No Federation connection requests match the current filters."
          onOpen={open}
          columns={[
            ['Requester', x => <><strong>{show(x.requesterName)}</strong><div className="muted">{show(x.requesterEmail)}</div></>],
            ['Looking For', x => show(x.opportunityTitle)],
            ['Reason', x => show(x.requestReason)],
            ['Deal Package', x => show(x.pricingAmount)],
            ['Status', x => <Status value={x.status || 'pending_admin_match'} />],
            ['Matched Lead', x => show(x.leadId)]
          ]}
          actions={item => (
            <>
              <Action
                name="Match Selected Lead"
                actionKey={'match:' + item.id}
                operations={op}
                click={() => {
                  op.setMessage('')
                  setDealRequestId('')
                  setMatchRequestId(str(item.id))
                }}
              />
              <Action
                name="Save Deal Package"
                actionKey={'deal:' + item.id}
                operations={op}
                click={() => {
                  op.setMessage('')
                  setMatchRequestId('')
                  setDealRequestId(str(item.id))
                }}
              />
              {[
                ['matched','Matched'],
                ['pricing_sent','Pricing Sent'],
                ['paid','Paid'],
                ['intro_delivered','Intro Delivered'],
                ['completed','Completed'],
                ['rejected','Reject']
              ].filter(([status]) => lower(item.status) !== status)
                .map(([status, name]) => (
                  <Action key={status} name={name}
                    actionKey={`request:${item.id}`} operations={op}
                    click={() => changeStatus(item, status)} />
                ))}
            </>
          )}
        />
      </Panel>

      <Panel eyebrow="Federation Deal Rooms"
        title="Admin-Supervised Partnerships & Collabs"
        filters={
          <Filter id="federation-deal-room-status-filter" value={dealStatus}
            change={setDealStatus}
            entries={[
              ['all','All Statuses'],['pending_admin_review','Pending Admin Review'],
              ['approved','Approved'],['in_discussion','In Discussion'],
              ['commission_due','Commission Due'],
              ['commission_paid','Commission Paid'],['closed','Closed'],
              ['rejected','Rejected']
            ]}
          />
        }
      >
        <Table
          id="federation-deal-rooms-table"
          rows={roomRows}
          empty="No Federation Deal Rooms match the current filters."
          onOpen={open}
          columns={[
            ['Room', x => show(x.title)],
            ['Creator', x => show(x.creatorName)],
            ['Type', x => show(x.roomType)],
            ['Expected Value', x => show(x.expectedValueAmount)],
            ['Commission', x => show(x.platformCommissionAmount)],
            ['Status', x => <Status value={x.adminStatus} />],
            ['Academy Link', x => show(x.academyMissionNeed)]
          ]}
          actions={item => (
            <>
              <Action
                name="Route to Academy"
                actionKey={'academy-route:' + item.id}
                operations={op}
                click={() => routeAcademy('federation_deal_room', item)}
              />
              {[
                ['approved','Approve'],
                ['in_discussion','In Discussion'],
                ['commission_due','Commission Due'],
                ['commission_paid','Commission Paid'],
                ['closed','Close'],
                ['rejected','Reject']
              ].filter(([status]) => lower(item.adminStatus) !== status)
                .map(([status, name]) => (
                  <Action key={status} name={name}
                    actionKey={`room:${item.id}`} operations={op}
                    click={() => changeStatus(item, status, true)} />
                ))}
            </>
          )}
        />
      </Panel>

      {leadValueRecord && (
        <LeadValueModal
          record={leadValueRecord}
          op={op}
          close={() => setLeadValueId('')}
          submit={saveLeadValue}
        />
      )}

      {matchRequest && (
        <AdminActionModal
          key={'match-' + matchRequestId}
          title="Match Lead"
          description="Pick the best Federation-ready lead from the Academy Lead Missions database. Matches are ranked by country, city, contact type, role, company, source method, channel, stage, priority, tier, and contact availability."
          submitLabel="Match Selected Lead"
          busy={Boolean(op.busy)}
          error={
            op.message ||
            (matchingOptions.length
              ? ''
              : 'No Federation-ready leads available. Mark leads as Federation-ready first.')
          }
          onCancel={() => {
            if (!op.busy) setMatchRequestId('')
          }}
          onSubmit={matchSelectedFederationLead}
          fields={[{
            name: 'selectedLead',
            label: 'Choose lead to match',
            type: 'select',
            value: '',
            required: true,
            options: [
              { value: '', label: 'Select a lead' },
              ...matchingOptions
            ]
          }]}
        />
      )}

      {dealRequest && (
        <AdminActionModal
          key={'deal-' + dealRequestId}
          title="Deal Package"
          description="Set the intro price, platform commission, operator payout estimate, and payment state."
          submitLabel="Save Deal Package"
          busy={Boolean(op.busy)}
          error={op.message}
          onCancel={() => {
            if (!op.busy) setDealRequestId('')
          }}
          onSubmit={saveFederationDealPackage}
          fields={[
            {
              name: 'pricingAmount',
              label: 'Intro Price',
              type: 'number',
              min: '0',
              step: '1',
              value: String(dealRequest.pricingAmount || 0)
            },
            {
              name: 'currency',
              label: 'Currency',
              type: 'select',
              value: str(dealRequest.currency || 'USD'),
              options: ['USD','EUR','GBP','NGN']
                .map(v => ({ value: v, label: v }))
            },
            {
              name: 'platformCommissionRate',
              label: 'Platform Commission %',
              type: 'number',
              min: '0',
              max: '100',
              step: '1',
              value: String(dealRequest.platformCommissionRate || 0)
            },
            {
              name: 'platformCommissionAmount',
              label: 'Platform Commission Amount',
              type: 'number',
              min: '0',
              step: '1',
              value: String(dealRequest.platformCommissionAmount || 0)
            },
            {
              name: 'operatorPayoutAmount',
              label: 'Operator Payout Estimate',
              type: 'number',
              min: '0',
              step: '1',
              value: String(dealRequest.operatorPayoutAmount || 0)
            },
            {
              name: 'paymentStatus',
              label: 'Payment Status',
              type: 'select',
              value: str(dealRequest.paymentStatus || 'not_started'),
              options: [
                'not_started',
                'pricing_sent',
                'pending_payment',
                'paid',
                'refunded',
                'cancelled'
              ].map(v => ({ value: v, label: v.replaceAll('_', ' ') }))
            },
            {
              name: 'payoutStatus',
              label: 'Payout Status',
              type: 'select',
              value: str(dealRequest.payoutStatus || 'not_started'),
              options: [
                'not_started',
                'pending',
                'approved',
                'paid',
                'held'
              ].map(v => ({ value: v, label: v.replaceAll('_', ' ') }))
            },
            {
              name: 'commissionStatus',
              label: 'Commission Status',
              type: 'select',
              value: str(dealRequest.commissionStatus || 'not_started'),
              options: [
                'not_started',
                'pending',
                'collected',
                'waived'
              ].map(v => ({ value: v, label: v.replaceAll('_', ' ') }))
            },
            {
              name: 'dealNotes',
              label: 'Deal Notes',
              type: 'textarea',
              rows: 3,
              value: str(dealRequest.dealNotes)
            }
          ]}
        />
      )}
    </>
  )
}

function Plazas({ state, search, refresh, open, routeAcademy }) {
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [routeStatus, setRouteStatus] = useState('all')
  const [lane, setLane] = useState('all')
  const [routeDialog, setRouteDialog] = useState(null)

  const op = useOperations(refresh)
  const listings = list(state.plazas)
  const routing = state.plazaRoutingDesk || {}
  const requests = list(routing.requests)
  const requestStateRef = useRef(requests)
  requestStateRef.current = requests
  const summary = routing.summary || {}

  const visibleListings = listings.filter(x =>
    (type === 'all' || x.type === type) &&
    (status === 'all' || x.status === status) &&
    searchMatches(x, search)
  )

  const visibleRequests = requests.filter(x => {
    const route = x.adminRoutingLane || x.routeKey || 'manual_review'
    return (
      (routeStatus === 'all' || x.status === routeStatus) &&
      (lane === 'all' || route === lane) &&
      searchMatches(x, search)
    )
  })

  function updateListing(item, payload, expected, description) {
    const id = str(item.id)
    op.run(
      `listing:${id}`,
      `/api/admin/plazas/${encodeURIComponent(id)}/status`,
      payload,
      snapshot => {
        const updated = find(snapshot.plazas, id)
        return updated && expected(updated)
      },
      `Confirm ${description} for ${item.title || id}?`
    )
  }

  const plazaRoutePresets = {
    academy_operator: {
      status: 'Under Review',
      matchingStatus: 'routed_to_academy',
      matchingPriority: 'normal',
      title: 'Route to Academy Operator',
      description: 'Send this request to the Academy operator lane for task execution, lead work, research, or service delivery.'
    },
    plaza_provider: {
      status: 'Matched',
      matchingStatus: 'routed_to_provider',
      matchingPriority: 'normal',
      title: 'Route to Plaza Provider',
      description: 'Assign this request to a Plaza service provider or marketplace operator.'
    },
    federation_escalation: {
      status: 'Under Review',
      matchingStatus: 'routed_to_federation',
      matchingPriority: 'high',
      title: 'Escalate to Federation',
      description: 'Move this request into a Federation-relevant lane for strategic contacts, high-level introductions, or deal review.'
    },
    regional_leader: {
      status: 'Under Review',
      matchingStatus: 'routed_to_regional_leader',
      matchingPriority: 'normal',
      title: 'Route to Regional Leader',
      description: 'Send this request to a regional Plaza leader or location-based reviewer.'
    },
    open_conversation: {
      status: 'Conversation Opened',
      matchingStatus: 'conversation_ready',
      matchingPriority: 'normal',
      title: 'Open Conversation Lane',
      description: 'Mark this request as ready for a structured conversation or handoff.'
    }
  }

  const plazaRequestStatuses = [
    'Submitted',
    'Under Review',
    'Matched',
    'Conversation Opened',
    'Closed'
  ]

  function isPatronRoutingRecord(item) {
    return lower(item?.sourceType) === 'patron_application'
  }

  function routeRequest(item, route) {
    const preset = plazaRoutePresets[route]

    if (!item?.id || !preset || isPatronRoutingRecord(item)) {
      return
    }

    op.setMessage('')
    setRouteDialog({
      mode: 'route',
      item,
      preset,
      route
    })
  }

  function openQuickStatus(item) {
    if (!item?.id || isPatronRoutingRecord(item)) return

    op.setMessage('')
    setRouteDialog({
      mode: 'quick',
      item
    })
  }

  function quickStatusPatch(item, status) {
    const matchingStatus =
      status === 'Closed'
        ? 'closed'
        : status === 'Conversation Opened'
          ? 'conversation_ready'
          : status === 'Matched'
            ? 'matched'
            : 'queued_for_review'

    return {
      routingLane: str(
        item.adminRoutingLane ||
        item.routeKey ||
        'manual_review'
      ),
      status,
      matchingStatus,
      matchingPriority: str(
        item.matchingPriority ||
        item.requestPriority ||
        'normal'
      ),
      targetLabel: item.targetLabel,
      serviceCategory: item.serviceCategory,
      region: item.region
    }
  }

  async function savePlazaRequest(item, payload, verifyAssignment = false) {
    const id = str(item?.id)

    if (!id || isPatronRoutingRecord(item)) {
      op.setMessage(
        'Patron applications cannot be routed through this request endpoint.'
      )
      return false
    }

    return op.run(
      'route:' + id,
      '/api/admin/plaza/requests/' +
        encodeURIComponent(id) +
        '/route',
      payload,
      snapshot => {
        const updated = find(
          snapshot.plazaRoutingDesk?.requests,
          id
        )

        if (
          !updated ||
          str(updated.adminRoutingLane || updated.routeKey) !==
            str(payload.routingLane) ||
          str(updated.status) !== str(payload.status)
        ) {
          return false
        }

        if (!verifyAssignment) return true

        const raw = updated.raw || {}

        const assignedTo = Object.prototype.hasOwnProperty.call(
          raw,
          'assignedToName'
        )
          ? raw.assignedToName
          : raw.adminAssignedToName

        return (
          str(assignedTo) === str(payload.assignedToName) &&
          str(raw.adminRouteNote) === str(payload.adminRouteNote)
        )
      },
      ''
    )
  }

  async function submitPlazaRoute(values) {
    if (!routeDialog) return

    const { item, mode } = routeDialog

    if (mode === 'quick') {
      const status = str(values.status)

      if (![
        'Under Review',
        'Matched',
        'Conversation Opened',
        'Closed'
      ].includes(status)) {
        op.setMessage('Select a valid Plaza request status.')
        return
      }

      const saved = await savePlazaRequest(
        item,
        quickStatusPatch(item, status)
      )

      if (saved) setRouteDialog(null)
      return
    }

    const routingLane = str(values.routingLane)
    const status = str(values.status)

    if (
      ![
        'manual_review',
        ...Object.keys(plazaRoutePresets)
      ].includes(routingLane) ||
      !plazaRequestStatuses.includes(status)
    ) {
      op.setMessage('Select a valid routing lane and request status.')
      return
    }

    const preset = routeDialog.preset

    const payload = {
      routingLane,
      status,
      matchingStatus: preset.matchingStatus,
      matchingPriority: preset.matchingPriority,
      assignedToName: str(values.assignedToName),
      adminRouteNote: str(values.adminRouteNote),
      targetLabel: item.targetLabel,
      serviceCategory: item.serviceCategory,
      region: item.region
    }

    const saved = await savePlazaRequest(item, payload, true)

    if (saved) setRouteDialog(null)
  }

  async function closePlazaRequest(item) {
    if (
      !item?.id ||
      isPatronRoutingRecord(item) ||
      str(item.status) === 'Closed'
    ) {
      return
    }

    await savePlazaRequest(
      item,
      quickStatusPatch(item, 'Closed')
    )
  }

  const stats = [
    ['Total Requests', summary.total || 0, 'All Plaza request records'],
    ['Needs Review', summary.needsReview || 0, 'Submitted or under review'],
    ['Unrouted', summary.unrouted || 0, 'No admin lane selected'],
    ['High Priority', summary.highPriority || 0, 'Urgent or Federation-linked']
  ]

  return (
    <>
      {op.message && <p role="status">{op.message}</p>}

      <Panel eyebrow="Marketplace Control" title="Plazas Listings & Reports"
        filters={
          <>
            <Filter id="plazas-type-filter" value={type} change={setType}
              entries={[
                ['all','All Types'],
                ...['Opportunity','Job Opportunity','Hire Talent','Get Hired',
                  'Operator Bounty','Hiring','Service Listing','Service Request',
                  'Collaboration','Partnership','Introduction','Project Opening',
                  'Regional Support'].map(x => [x,x])
              ]}
            />
            <Filter id="plazas-status-filter" value={status} change={setStatus}
              entries={[
                ['all','All Statuses'],['Pending Review','Pending Review'],
                ['Active','Active'],['Flagged','Flagged'],['Archived','Archived']
              ]}
            />
          </>
        }
      >
        <Table id="plazas-table" rows={visibleListings}
          empty="No Plazas listings match the current filters."
          onOpen={open}
          columns={[
            ['Listing', x => show(x.title)],
            ['Owner', x => show(x.owner)],
            ['Type', x => <Status value={x.type} />],
            ['Status', x => <Status value={x.status} />],
            ['Reports', x => show(x.reports)],
            ['Region', x => show(x.region)]
          ]}
          actions={item => (
            <>
              <Action
                name="Route to Academy"
                actionKey={'academy-route:' + item.id}
                operations={op}
                click={() => routeAcademy('plaza_listing', item)}
              />
              <Action name="Approve" actionKey={`listing:${item.id}`}
                operations={op}
                click={() => updateListing(
                  item, { status: 'active' },
                  x => lower(x.status) === 'active',
                  'listing approval'
                )}
              />
              <Action name={item.featured ? 'Unfeature' : 'Feature'}
                actionKey={`listing:${item.id}`} operations={op}
                click={() => updateListing(
                  item, { featured: !item.featured },
                  x => x.featured === !item.featured,
                  'featured status change'
                )}
              />
            </>
          )}
        />
      </Panel>

      <CardStats id="plaza-routing-stats" items={stats} />

      <Panel eyebrow="Routing Desk" title="Plaza Requests & Service Matching"
        filters={
          <>
            <Filter id="plaza-routing-status-filter" value={routeStatus}
              change={setRouteStatus}
              entries={[
                ['all','All Request Statuses'],['Draft','Draft'],
                ['Submitted','Submitted'],['Under Review','Under Review'],
                ['Matched','Matched'],['Conversation Opened','Conversation Opened'],
                ['Closed','Closed']
              ]}
            />
            <Filter id="plaza-routing-lane-filter" value={lane} change={setLane}
              entries={[
                ['all','All Routing Lanes'],['manual_review','Manual Review'],
                ['academy_operator','Academy Operator'],
                ['plaza_provider','Plaza Provider'],
                ['federation_escalation','Federation Escalation'],
                ['regional_leader','Regional Leader'],
                ['open_conversation','Open Conversation']
              ]}
            />
          </>
        }
      >
        <Table id="plaza-routing-requests-table"
          rows={visibleRequests}
          empty="No Plaza routing requests match the current filters."
          onOpen={open}
          drawerControls={item =>
            isPatronRoutingRecord(item)
              ? {}
              : {
                  onQuickStatus: status => {
                    const current = find(
                      requestStateRef.current,
                      item.id
                    ) || item

                    void savePlazaRequest(
                      current,
                      quickStatusPatch(current, status)
                    )
                  }
                }
          }
          columns={[
            ['Request', x => show(x.targetLabel || x.objective)],
            ['Requester', x => show(x.requesterName)],
            ['Route', x => show(x.adminRoutingLane || x.routeKey)],
            ['Service', x => show(x.serviceCategory)],
            ['Status', x => <Status value={x.status} />],
            ['Priority', x => show(x.matchingPriority)],
            ['Updated', x => show(x.updatedAt || x.createdAt)]
          ]}
          actions={item => (
            <>
              {isPatronRoutingRecord(item) ? (
                <span className="muted">
                  Patron application — review separately
                </span>
              ) : (
                <>
                  {[
                    ['academy_operator','Academy'],
                    ['plaza_provider','Provider'],
                    ['federation_escalation','Federation'],
                    ['regional_leader','Regional Leader'],
                    ['open_conversation','Conversation']
                  ].map(([route, name]) => (
                    <Action
                      key={route}
                      name={name}
                      actionKey={'route:' + item.id}
                      operations={op}
                      click={() => routeRequest(item, route)}
                    />
                  ))}

                  <Action
                    name="Quick Status"
                    actionKey={'route:' + item.id}
                    operations={op}
                    click={() => openQuickStatus(item)}
                  />

                  {str(item.status) !== 'Closed' && (
                    <Action
                      name="Close Request"
                      actionKey={'route:' + item.id}
                      operations={op}
                      click={() => closePlazaRequest(item)}
                    />
                  )}
                </>
              )}
            </>
          )}
        />
      </Panel>

      {routeDialog && (
        <AdminActionModal
          key={
            routeDialog.mode +
            ':' +
            routeDialog.item.id +
            ':' +
            (routeDialog.route || '')
          }
          title={
            routeDialog.mode === 'quick'
              ? 'Quick Status'
              : routeDialog.preset.title
          }
          description={
            routeDialog.mode === 'quick'
              ? 'Update this Plaza request status.'
              : routeDialog.preset.description
          }
          submitLabel={
            routeDialog.mode === 'quick'
              ? 'Save Status'
              : 'Save Route'
          }
          busy={Boolean(op.busy)}
          error={op.message}
          onCancel={() => {
            if (!op.busy) setRouteDialog(null)
          }}
          onSubmit={submitPlazaRoute}
          fields={
            routeDialog.mode === 'quick'
              ? [{
                  name: 'status',
                  label: 'Quick Status',
                  type: 'select',
                  required: true,
                  value: '',
                  options: [
                    { value: '', label: 'Select status' },
                    ...[
                      'Under Review',
                      'Matched',
                      'Conversation Opened',
                      'Closed'
                    ].map(value => ({
                      value,
                      label: value
                    }))
                  ]
                }]
              : [
                  {
                    name: 'routingLane',
                    label: 'Routing Lane',
                    type: 'select',
                    required: true,
                    value: routeDialog.route,
                    options: [
                      ['manual_review','Manual Review'],
                      ['academy_operator','Academy Operator'],
                      ['plaza_provider','Plaza Provider'],
                      ['federation_escalation','Federation Escalation'],
                      ['regional_leader','Regional Leader'],
                      ['open_conversation','Open Conversation']
                    ].map(([value,label]) => ({
                      value,
                      label
                    }))
                  },
                  {
                    name: 'status',
                    label: 'Request Status',
                    type: 'select',
                    required: true,
                    value: routeDialog.preset.status,
                    options: plazaRequestStatuses.map(value => ({
                      value,
                      label: value
                    }))
                  },
                  {
                    name: 'assignedToName',
                    label: 'Assigned To / Route Owner',
                    type: 'text',
                    value: str(
                      routeDialog.item.raw?.assignedToName ||
                      routeDialog.item.raw?.adminAssignedToName ||
                      routeDialog.item.providerName
                    ),
                    placeholder: 'Example: Academy Ops, Plaza Provider, Regional Leader'
                  },
                  {
                    name: 'adminRouteNote',
                    label: 'Admin Route Note',
                    type: 'textarea',
                    rows: 4,
                    value: str(
                      routeDialog.item.raw?.adminRouteNote ||
                      routeDialog.item.raw?.adminNote
                    ),
                    placeholder: 'Explain why this request is being routed here.'
                  }
                ]
          }
        />
      )}
    </>
  )
}

export default function AdminDivisionViews({
  view,
  state,
  search = '',
  refresh
}) {
  const [record, setRecord] = useState(null)
  const [academyRoute, setAcademyRoute] = useState(null)
  const [academyBusy, setAcademyBusy] = useState(false)
  const [academyError, setAcademyError] = useState('')
  const [academyBlocked, setAcademyBlocked] = useState([])

  const close = () => setRecord(null)

  const academyOperators = []

  list(state.members).forEach(member => {
    if (!list(member.divisions).map(lower).includes('academy')) return

    const id = str(member.id || member.memberId)
    if (!id) return

    academyOperators.push({
      value: id,
      label: str(
        member.name || member.fullName || member.email || id
      ) + ' — ' + id
    })
  })

  list(state.academy).forEach(member => {
    const id = str(member.memberId || member.id || member.ownerUid)

    if (!id || academyOperators.some(option => option.value === id)) {
      return
    }

    academyOperators.push({
      value: id,
      label: str(
        member.name ||
        member.fullName ||
        member.memberName ||
        member.email ||
        id
      ) + ' — ' + id
    })
  })

  function openAcademyRoute(sourceType, item) {
    const id = str(item?.id)

    if (
      !id ||
      !['federation_deal_room', 'plaza_listing'].includes(sourceType)
    ) return

    if (academyBlocked.includes(sourceType + ':' + id)) {
      window.alert(
        'This Academy mission requires verification in the Original Admin before retrying.'
      )
      return
    }

    setRecord(null)
    setAcademyError('')
    setAcademyRoute({ sourceType, item })
  }

  async function saveAcademyRoute(values) {
    if (!academyRoute || academyBusy) return

    const { sourceType, item } = academyRoute
    const sourceId = str(item.id)
    const memberId = str(values.memberId)
    const missionBrief = str(values.missionBrief)

    if (!sourceId || !memberId || !missionBrief) {
      setAcademyError('Academy operator and mission brief are required.')
      return
    }

    const key = sourceType + ':' + sourceId

    if (academyBlocked.includes(key)) {
      setAcademyError(
        'Verify the earlier Academy routing attempt before retrying.'
      )
      return
    }

    setAcademyBusy(true)
    setAcademyError('')

    let accepted = false

    try {
      const response = await adminFetchJson(
        '/api/admin/academy/route-opportunity-mission',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceType,
            sourceId,
            memberId,
            missionBrief
          })
        }
      )

      accepted = true

      const missionId = str(response.mission?.id)

      if (!missionId) {
        throw Error('Backend returned no Academy mission ID.')
      }

      const live = await getAdminBootstrap()
      const verified = find(
        live.state.academyLeadMissions,
        missionId
      )

      if (
        !verified ||
        str(verified.memberId || verified.ownerUid) !== memberId ||
        str(verified.sourceRecordId) !== sourceId ||
        lower(verified.sourceDivision) !==
          (sourceType === 'plaza_listing' ? 'plaza' : 'federation') ||
        str(verified.missionBrief) !== missionBrief
      ) {
        throw Error(
          'Created mission could not be verified in refreshed Admin data.'
        )
      }

      setAcademyRoute(null)
      setRecord({
        record: verified,
        tableId: 'academy-lead-missions-table'
      })
      refresh()

    } catch (error) {
      if (error?.status !== 423) {
        setAcademyBlocked(old => [
          ...new Set([...old, key])
        ])
      }

      setAcademyError(
        error?.status === 423
          ? error.message
          : accepted
            ? 'Backend accepted the mission but verification failed. Inspect the Original Admin before retrying.'
            : (error.message || 'Routing failed.') +
              ' Verify the source before retrying.'
      )

      if (accepted) refresh()

    } finally {
      setAcademyBusy(false)
    }
  }

  return (
    <>
      {view === 'academy' && (
        <Academy
          state={state}
          search={search}
          refresh={refresh}
          open={setRecord}
        />
      )}
      {view === 'federation' && (
        <Federation
          state={state}
          search={search}
          refresh={refresh}
          open={setRecord}
          routeAcademy={openAcademyRoute}
        />
      )}
      {view === 'plazas' && (
        <Plazas
          state={state}
          search={search}
          refresh={refresh}
          open={setRecord}
          routeAcademy={openAcademyRoute}
        />
      )}
      {record && (
        <Inspector
          record={
            record.tableId === 'plaza-routing-requests-table'
              ? (
                  find(
                    state.plazaRoutingDesk?.requests,
                    record.record?.id
                  ) || record.record
                )
              : (record.record || record)
          }
          tableId={record.tableId || ''}
          onQuickStatus={record.onQuickStatus || null}
          close={close}
        />
      )}

      {academyRoute && (
        <AdminActionModal
          key={academyRoute.sourceType + ':' + academyRoute.item.id}
          title="Route to Academy Mission"
          description="Choose the Academy operator and write the exact mission brief. This will create a real assigned mission in the operator workspace."
          submitLabel="Route Mission"
          busy={academyBusy}
          error={academyError}
          onCancel={() => {
            if (!academyBusy) setAcademyRoute(null)
          }}
          onSubmit={saveAcademyRoute}
          fields={[
            academyOperators.length
              ? {
                  name: 'memberId',
                  label: 'Academy Operator',
                  type: 'select',
                  required: true,
                  value: academyOperators[0].value,
                  options: academyOperators
                }
              : {
                  name: 'memberId',
                  label: 'Academy Operator / Member ID',
                  type: 'text',
                  required: true,
                  value: '',
                  placeholder: 'Paste Academy member ID'
                },
            {
              name: 'missionBrief',
              label: 'Operator Mission Brief',
              type: 'textarea',
              rows: 6,
              required: true,
              value: str(
                academyRoute.item.academyMissionNeed ||
                academyRoute.item.partnerNeed ||
                academyRoute.item.monetizationNote ||
                academyRoute.item.text ||
                academyRoute.item.description ||
                ('Review and execute: ' +
                  (academyRoute.item.title || 'Opportunity Mission'))
              ),
              placeholder: 'Describe exactly what the Academy operator should do...'
            }
          ]}
        />
      )}
    </>
  )
}
