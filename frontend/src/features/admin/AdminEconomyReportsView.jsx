import AdminFilterMenu from './AdminFilterMenu'
import AdminRowActionMenu from './AdminRowActionMenu'
import { useMemo, useState } from 'react'
import { adminFetchJson, getAdminBootstrap } from './adminApi'

const list = value => Array.isArray(value) ? value : []
const string = value => String(value ?? '').trim()
const label = value =>
  string(value || 'not_started')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())

function money(value, currency = 'USD') {
  const amount = Number(value || 0)
  const code = string(currency || 'USD').toUpperCase()

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0
    }).format(Number.isFinite(amount) ? amount : 0)
  } catch {
    return `${code} ${Number.isFinite(amount) ? amount : 0}`
  }
}

function moneySummary(records, field) {
  const totals = {}

  for (const record of records) {
    const currency = string(record.currency || 'USD').toUpperCase()
    const amount = Number(record[field] || 0)

    if (!Number.isFinite(amount) || amount <= 0) continue
    totals[currency] = (totals[currency] || 0) + amount
  }

  const result = Object.entries(totals).map(
    ([currency, amount]) => money(amount, currency)
  )

  return result.length ? result.join(' + ') : money(0)
}

function Status({ value }) {
  const normalized = string(value).toLowerCase()

  const tone = {
    paid: 'green',
    active: 'green',
    settled: 'green',
    completed: 'green',
    approved: 'green',
    processing: 'cyan',
    pending: 'amber',
    pending_review: 'amber',
    checkout_started: 'amber',
    draft: 'gray',
    failed: 'red',
    expired: 'red',
    rejected: 'red',
    refunded: 'red',
    cancelled: 'gray'
  }[normalized] || 'gray'

  return (
    <span className={'badge badge-' + tone}>
      {label(value)}
    </span>
  )
}

function Filter({ id, value, onChange, options }) {
  return (
    <select id={id} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(([key, text]) => (
        <option key={key} value={key}>{text}</option>
      ))}
    </select>
  )
}

async function postAndVerify(url, payload, verify, refresh) {
  let accepted = false

  try {
    await adminFetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    accepted = true

    const snapshot = await getAdminBootstrap()

    if (!verify(snapshot.state)) {
      throw new Error(
        'The backend accepted the action, but the refreshed record did not confirm the expected status.'
      )
    }
  } catch (error) {
    if (error?.status === 423) {
      throw error
    }

    const failure = new Error(
      accepted
        ? `${error.message} Inspect the original Admin Panel before retrying.`
        : `${error.message} Check the live record before retrying.`
    )

    if (typeof error?.status === 'number') {
      failure.status = error.status
    }

    throw failure
  } finally {
    if (accepted) refresh()
  }
}

function Economy({ state, search, refresh }) {
  const [provider, setProvider] = useState('all')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [method, setMethod] = useState('all')
  const [payoutStatus, setPayoutStatus] = useState('all')
  const [busy, setBusy] = useState('')
  const [blocked, setBlocked] = useState([])
  const [message, setMessage] = useState('')

  const payments = list(state.paymentLedger)
  const payouts = list(state.payoutLedger)

  const query = search.trim().toLowerCase()

  const visiblePayments = useMemo(() => payments.filter(item =>
    (provider === 'all' ||
      string(item.provider || 'unselected').toLowerCase() === provider) &&
    (paymentStatus === 'all' ||
      string(item.status || 'draft').toLowerCase() === paymentStatus) &&
    (!query || JSON.stringify(item).toLowerCase().includes(query))
  ), [payments, provider, paymentStatus, query])

  const visiblePayouts = useMemo(() => payouts.filter(item =>
    (method === 'all' ||
      string(item.method || 'local_bank').toLowerCase() === method) &&
    (payoutStatus === 'all' ||
      string(item.status || 'pending_review').toLowerCase() === payoutStatus) &&
    (!query || JSON.stringify(item).toLowerCase().includes(query))
  ), [payouts, method, payoutStatus, query])

  const paid = payments.filter(item =>
    string(item.status).toLowerCase() === 'paid'
  )

  const pendingPayments = payments.filter(item =>
    ['draft', 'checkout_started', 'pending'].includes(
      string(item.status).toLowerCase()
    )
  )

  const pendingPayouts = payouts.filter(item =>
    ['pending_review', 'approved', 'processing'].includes(
      string(item.status).toLowerCase()
    )
  )

  const metrics = [
    ['Paid Revenue', moneySummary(paid, 'amount'),
      `${paid.length} paid payments`],
    ['Gross Ledger', moneySummary(payments, 'amount'),
      `${payments.length} payment records`],
    ['Universe Commission',
      moneySummary(paid, 'platformCommissionAmount'),
      'Confirmed commission from paid payments'],
    ['Operator Payouts',
      moneySummary(payments, 'operatorPayoutAmount'),
      'Total operator payout exposure'],
    ['Pending Payments', pendingPayments.length,
      'Draft / checkout / pending'],
    ['Pending Withdrawals', pendingPayouts.length,
      'Needs payout review or execution']
  ]

  async function runAction(key, url, payload, verify, success) {
    if (busy || blocked.includes(key)) return

    setBusy(key)
    setMessage('')

    try {
      await postAndVerify(url, payload, verify, refresh)
      setMessage(success)
    } catch (error) {
      if (error?.status !== 423) {
        setBlocked(previous => [...new Set([...previous, key])])
      }

      setMessage(error.message)
    } finally {
      setBusy('')
    }
  }

  function settle(payment) {
    const division = string(payment.sourceDivision).toLowerCase()
    const feature = string(payment.sourceFeature).toLowerCase()

    const badge =
      ['academy', 'federation'].includes(division) &&
      feature === 'verified_badge'

    const plaza =
      division === 'plaza' &&
      feature === 'opportunity_deal'

    if (!badge && !plaza) return

    const prompt = badge
      ? 'Mark this badge payment as paid and activate the member verification badge?'
      : 'Mark this Plaza payment as paid? This will create/update the operator payout earning and make it visible in the Wallet under Plaza.'

    if (!window.confirm(prompt)) return

    const id = string(payment.id)
    if (!id) return

    runAction(
      `payment:${id}`,
      `/api/admin/economy/payments/${encodeURIComponent(id)}/settle`,
      { provider: 'manual', paymentMethod: 'manual' },
      snapshot => list(snapshot.paymentLedger).some(item =>
        string(item.id) === id &&
        string(item.status).toLowerCase() === 'paid'
      ),
      badge
        ? 'Badge payment marked paid. Member verification badge activated.'
        : 'Plaza payment marked paid. Operator payout earning created.'
    )
  }

  function updatePayout(payout, status) {
    const id = string(payout.id)
    if (!id) return

    const receiver = string(payout.receiverName || 'Operator')
    const amount = money(payout.amount, payout.currency || 'USD')
    const statusLabel = label(status)

    const question =
      status === 'paid'
        ? `Mark this payout as PAID for ${receiver} (${amount})? Only do this after the manual payout has actually been sent.`
        : status === 'rejected'
          ? `Reject this payout request for ${receiver} (${amount})?`
          : status === 'failed'
            ? `Mark this payout attempt as FAILED for ${receiver} (${amount})?`
            : `Mark this payout as ${statusLabel} for ${receiver} (${amount})?`

    if (!window.confirm(question)) return

    let reference = ''
    let adminNote = ''

    if (status === 'paid') {
      const answer = window.prompt(
        'Enter the manual payment reference / transaction ID before marking this payout as paid:',
        string(payout.providerPaymentId)
      )

      if (answer === null) return
      reference = answer.trim()

      if (!reference) {
        setMessage('Payment reference is required before marking payout as paid.')
        return
      }

      const note = window.prompt(
        'Optional admin note for this paid payout:',
        string(payout.adminNote) ||
          `Manual payout completed. Reference: ${reference}`
      )

      if (note === null) return

      adminNote = note.trim() ||
        `Manual payout completed. Reference: ${reference}`
    } else {
      const isRejection = status === 'rejected' || status === 'failed'
      const questionText = isRejection
        ? status === 'rejected'
          ? 'Add the rejection reason for this payout request:'
          : 'Add the failure reason for this payout attempt:'
        : `Optional admin note for marking this payout as ${statusLabel}:`

      const note = window.prompt(questionText, string(payout.adminNote))
      if (note === null) return

      adminNote = note.trim()

      if (isRejection && !adminNote) {
        setMessage('A reason is required.')
        return
      }
    }

    runAction(
      `payout:${id}`,
      `/api/admin/economy/payouts/${encodeURIComponent(id)}/status`,
      {
        status,
        provider: 'manual',
        method: string(payout.method || 'manual').toLowerCase(),
        providerPaymentId: reference,
        providerStatus: status,
        adminNote
      },
      snapshot => list(snapshot.payoutLedger).some(item =>
        string(item.id) === id &&
        string(item.status).toLowerCase() === status
      ),
      `Payout marked ${statusLabel}.`
    )
  }

  return (
    <>
      <div className="stats-grid compact" id="economy-control-stats">
        {metrics.map(([name, value, foot]) => (
          <article className="stat-card" key={name}>
            <div className="stat-label">{name}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-foot">{foot}</div>
          </article>
        ))}
      </div>

      {message && <p role="status" aria-live="polite">{message}</p>}

      <article className="panel-card">
        <div className="panel-head wrap-head">
          <div>
            <p className="eyebrow">Admin Economy Control</p>
            <h3>Payment Ledger</h3>
          </div>
          <div className="toolbar">
            <AdminFilterMenu>
            <Filter
              id="economy-payment-provider-filter"
              value={provider}
              onChange={setProvider}
              options={[
                ['all','All Providers'], ['stripe','Stripe'],
                ['paypal','PayPal'], ['oxapay','OxaPay'],
                ['manual','Manual'], ['unselected','Unselected']
              ]}
            />
            <Filter
              id="economy-payment-status-filter"
              value={paymentStatus}
              onChange={setPaymentStatus}
              options={[
                ['all','All Payment Statuses'],['draft','Draft'],
                ['checkout_started','Checkout Started'],['pending','Pending'],
                ['paid','Paid'],['failed','Failed'],['expired','Expired'],
                ['refunded','Refunded'],['cancelled','Cancelled']
              ]}
            />
                      </AdminFilterMenu>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Payer','Source','Provider','Amount','Commission',
                  'Operator','Status','Updated','Actions'].map(item =>
                    <th key={item}>{item}</th>
                  )}
              </tr>
            </thead>
            <tbody id="economy-payment-ledger-table">
              {visiblePayments.map(payment => {
                const id = string(payment.id)
                const division = string(payment.sourceDivision).toLowerCase()
                const feature = string(payment.sourceFeature).toLowerCase()

                const badge = ['academy','federation'].includes(division) &&
                  feature === 'verified_badge'

                const eligible = badge ||
                  (division === 'plaza' && feature === 'opportunity_deal')

                const isPaid = string(payment.status).toLowerCase() === 'paid'

                return (
                  <tr key={id}>
                    <td>
                      <strong>{payment.payerName || 'Federation Buyer'}</strong>
                      <div className="muted">
                        {payment.payerEmail || payment.payerUid || '—'}
                      </div>
                    </td>
                    <td>
                      <strong>
                        {[payment.sourceDivision, payment.sourceFeature]
                          .filter(Boolean).join(' / ') || '—'}
                      </strong>
                      <div className="muted mono">
                        {payment.sourceRecordId || id}
                      </div>
                    </td>
                    <td>
                      <Status value={payment.provider || 'unselected'} />
                      <div className="muted">
                        {payment.paymentMethod || 'unselected'}
                      </div>
                    </td>
                    <td><strong>{money(payment.amount, payment.currency)}</strong></td>
                    <td>{money(payment.platformCommissionAmount, payment.currency)}</td>
                    <td>{money(payment.operatorPayoutAmount, payment.currency)}</td>
                    <td><Status value={payment.status || 'draft'} /></td>
                    <td>{payment.updatedAt || payment.createdAt || '—'}</td>
                    <td>
                      {!eligible ? '—' : isPaid
                        ? <span className="badge badge-green">
                            {badge ? 'Paid • Badge Active' : 'Paid • Settled'}
                          </span>
                        : (
                          <button
                            type="button"
                            className="primary-btn"
                            disabled={Boolean(busy) || blocked.includes(`payment:${id}`)}
                            onClick={() => settle(payment)}
                          >
                            {badge ? 'Mark Paid + Activate' : 'Mark Paid'}
                          </button>
                        )}
                    </td>
                  </tr>
                )
              })}
              {!visiblePayments.length && (
                <tr><td colSpan={9}>No payment ledger records match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel-card" style={{ marginTop: 20 }}>
        <div className="panel-head wrap-head">
          <div>
            <p className="eyebrow">Operator Withdrawals</p>
            <h3>Payout Ledger</h3>
          </div>
          <div className="toolbar">
            <AdminFilterMenu>
            <Filter
              id="economy-payout-method-filter"
              value={method}
              onChange={setMethod}
              options={[
                ['all','All Methods'], ['local_bank','Local Bank'],
                ['card','Card'], ['crypto','Crypto'], ['manual','Manual']
              ]}
            />
            <Filter
              id="economy-payout-status-filter"
              value={payoutStatus}
              onChange={setPayoutStatus}
              options={[
                ['all','All Payout Statuses'],['pending_review','Pending Review'],
                ['approved','Approved'],['processing','Processing'],
                ['paid','Paid'],['rejected','Rejected'],['failed','Failed']
              ]}
            />
                      </AdminFilterMenu>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Receiver','Method','Amount','Destination','Source',
                  'Status','Updated','Actions'].map(item =>
                    <th key={item}>{item}</th>
                  )}
              </tr>
            </thead>
            <tbody id="economy-payout-ledger-table">
              {visiblePayouts.map(payout => {
                const id = string(payout.id)
                const destination = payout.method === 'crypto'
                  ? `${payout.cryptoCurrency || 'Crypto'} ${payout.cryptoNetwork || ''} ${payout.walletAddressMasked || ''}`
                  : payout.method === 'card'
                    ? `Card ${payout.cardLast4 ? `•••• ${payout.cardLast4}` : ''}`
                    : `${payout.bankName || 'Bank'} ${payout.accountNumberMasked || ''}`

                return (
                  <tr key={id}>
                    <td>
                      <strong>{payout.receiverName || 'Operator'}</strong>
                      <div className="muted">
                        {payout.receiverEmail || payout.receiverUid || '—'}
                      </div>
                    </td>
                    <td>
                      <Status value={payout.method || 'local_bank'} />
                      <div className="muted">{payout.provider || 'manual'}</div>
                    </td>
                    <td><strong>{money(payout.amount, payout.currency)}</strong></td>
                    <td>{destination}</td>
                    <td>
                      <strong>
                        {[payout.sourceDivision,payout.sourceFeature]
                          .filter(Boolean).join(' / ') || '—'}
                      </strong>
                      <div className="muted mono">
                        {payout.sourcePaymentId || payout.sourceRecordId || id}
                      </div>
                    </td>
                    <td><Status value={payout.status || 'pending_review'} /></td>
                    <td>{payout.updatedAt || payout.createdAt || '—'}</td>
                    <td>
                      <div className="table-actions">
                        {[
                          ['approved','Approve'],['processing','Processing'],
                          ['paid','Paid'],['rejected','Reject'],['failed','Failed']
                        ].map(([status, caption]) => (
                          <button
                            type="button"
                            key={status}
                            disabled={Boolean(busy) || blocked.includes(`payout:${id}`)}
                            onClick={() => updatePayout(payout, status)}
                          >
                            {caption}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!visiblePayouts.length && (
                <tr><td colSpan={8}>No payout ledger records match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}

function BusinessChatReports({ state, search, refresh }) {
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState('')
  const [blocked, setBlocked] = useState([])
  const [message, setMessage] = useState('')

  const reports = list(state.businessChatReports)
  const query = search.trim().toLowerCase()

  const rows = reports.filter(item =>
    (filter === 'all' || string(item.status).toLowerCase() === filter) &&
    (!query || JSON.stringify(item).toLowerCase().includes(query))
  ).sort((a, b) =>
    string(b.updatedAt || b.createdAt).localeCompare(
      string(a.updatedAt || a.createdAt)
    )
  )

  const stats = [
    ['Total Reports', reports.length, 'All time'],
    ['Pending Review', reports.filter(item =>
      string(item.status).toLowerCase() === 'pending_review'
    ).length, 'Needs action'],
    ['Closed Chats', reports.filter(item =>
      string(item.status).toLowerCase() === 'closed'
    ).length, 'Admin/user closed'],
    ['Blocked Chats', reports.filter(item =>
      string(item.status).toLowerCase() === 'blocked'
    ).length, 'Reply disabled']
  ]

  async function changeReport(report, status, defaultNote) {
    const id = string(report.id)
    if (!id || busy || blocked.includes(id)) return

    let note = defaultNote

    if (['closed', 'blocked', 'reopened'].includes(status)) {
      const prompts = {
        closed: 'Admin note for closing this Business Chat:',
        blocked: 'Admin note for blocking this Business Chat:',
        reopened: 'Admin note for reopening this Business Chat:'
      }

      const response = window.prompt(prompts[status], defaultNote)
      if (response === null) return

      note = response.trim() || defaultNote
    } else if (!window.confirm(
      `${label(status)} this Business Chat report?`
    )) {
      return
    }

    setBusy(id)
    setMessage('')

    try {
      await postAndVerify(
        `/api/admin/plaza/business-chat-reports/${encodeURIComponent(id)}/status`,
        { status, adminNote: note },
        snapshot => list(snapshot.businessChatReports).some(item =>
          string(item.id) === id &&
          string(item.status).toLowerCase() === status
        ),
        refresh
      )

      setMessage(`Business Chat report ${label(status).toLowerCase()}.`)
    } catch (error) {
      if (error?.status !== 423) {
        setBlocked(previous => [...new Set([...previous, id])])
      }

      setMessage(error.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <div
        className="admin-chat-stats"
        id="business-chat-report-stats"
      >
        {stats.map(([title, value, foot]) => (
          <article className="stat-card" key={title}>
            <div className="stat-label">{title}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-foot">{foot}</div>
          </article>
        ))}
      </div>

      <article className="panel-card admin-chat-panel">
        <div className="panel-head wrap-head">
          <div>
            <p className="eyebrow">Cross-Division Safety</p>
            <h3>Business Chat Reports</h3>
          </div>

          <div className="toolbar">
            <AdminFilterMenu>
              <Filter
                id="business-chat-report-status-filter"
                value={filter}
                onChange={setFilter}
                options={[
                  ['all','All Report Statuses'],
                  ['pending_review','Pending Review'],
                  ['dismissed','Dismissed'],
                  ['resolved','Resolved'],
                  ['closed','Closed'],
                  ['blocked','Blocked'],
                  ['reopened','Reopened']
                ]}
              />
            </AdminFilterMenu>
          </div>
        </div>

        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}

        <div
          className="admin-chat-report-list"
          id="business-chat-reports-table"
        >
          {rows.map(item => {
            const messages = list(item.messagesSnapshot)
            const latest = messages[messages.length - 1] || {}
            const id = string(item.id)

            const actions = [
              ['dismissed','Dismiss','Dismissed by admin.'],
              ['resolved','Resolve','Resolved by admin.'],
              ['closed','Close Chat','Closed after admin review.'],
              ['blocked','Block Chat','Blocked after admin review.'],
              ['reopened','Reopen','Reopened after admin review.']
            ]

            return (
              <article
                className="admin-chat-report-card"
                key={id}
              >
                <header className="admin-chat-report-head">
                  <div className="admin-chat-report-identity">
                    <span className="eyebrow">Conversation</span>
                    <h4>
                      {item.conversationTitle || '—'}
                    </h4>
                    <span className="muted mono">
                      {item.conversationId || id}
                    </span>
                  </div>

                  <Status
                    value={item.status || 'pending_review'}
                  />
                </header>

                <div className="admin-chat-report-info">
                  <div>
                    <span>Reporter</span>
                    <strong>
                      {item.reporterName || '—'}
                    </strong>
                    <small>
                      {item.reporterEmail ||
                       item.reporterId || '—'}
                    </small>
                  </div>

                  <div>
                    <span>Reason</span>
                    <strong>{item.reason || '—'}</strong>
                    {item.details && (
                      <small>{item.details}</small>
                    )}
                  </div>

                  <div>
                    <span>Divisions</span>
                    <strong>
                      {[item.sourceDivision, item.targetDivision]
                        .filter(Boolean)
                        .join(' → ') || 'Cross-division'}
                    </strong>
                    <small>
                      {item.businessPurpose || 'Business chat'}
                    </small>
                  </div>

                  <div>
                    <span>Updated</span>
                    <strong>
                      {item.updatedAt || item.createdAt || '—'}
                    </strong>
                  </div>
                </div>

                <div className="admin-chat-report-bottom">
                  <div className="admin-chat-report-message">
                    <span>Messages</span>
                    <p>
                      {latest.text || 'No message snapshot.'}
                    </p>
                  </div>

                  <div className="admin-chat-report-controls">
                    <AdminRowActionMenu label="Review actions">
                      {actions.map(([status, caption, note]) => (
                        <button
                          type="button"
                          key={status}
                          disabled={
                            Boolean(busy) ||
                            blocked.includes(id)
                          }
                          onClick={() =>
                            changeReport(item, status, note)
                          }
                        >
                          {caption}
                        </button>
                      ))}
                    </AdminRowActionMenu>
                  </div>
                </div>
              </article>
            )
          })}

          {!rows.length && (
            <p className="muted">
              No Business Chat reports match the current filters.
            </p>
          )}
        </div>
      </article>
    </>
  )
}

export default function AdminEconomyReportsView({
  view,
  state,
  search = '',
  refresh
}) {
  if (view === 'economy') {
    return <Economy state={state} search={search} refresh={refresh} />
  }

  if (view === 'business-chat-reports') {
    return (
      <BusinessChatReports
        state={state}
        search={search}
        refresh={refresh}
      />
    )
  }

  return null
}
