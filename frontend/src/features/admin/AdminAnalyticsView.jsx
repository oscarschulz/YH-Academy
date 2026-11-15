import { useState } from 'react'
import { adminFetchJson } from './adminApi'

const list = value => Array.isArray(value) ? value : []
const num = value => Number(value || 0) || 0

const money = value => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
}).format(num(value))

function membershipMetrics(members) {
  const uniqueUsers = members.length
  const divisions = ['Academy', 'Federation', 'Plazas']

  const divisionCounts = Object.fromEntries(
    divisions.map(name => [
      name,
      members.filter(member =>
        list(member.divisions).includes(name)
      ).length
    ])
  )

  const totalMemberships = members.reduce(
    (sum, member) =>
      sum + new Set(list(member.divisions)).size,
    0
  )

  const overlapUsers = members.filter(
    member => new Set(list(member.divisions)).size > 1
  ).length

  const singleDivisionUsers = Math.max(
    0, uniqueUsers - overlapUsers
  )

  return {
    uniqueUsers,
    divisionCounts,
    totalMemberships,
    overlapUsers,
    avgMembershipsPerUser: uniqueUsers
      ? totalMemberships / uniqueUsers
      : 0,
    overlapRate: uniqueUsers
      ? Math.round(overlapUsers / uniqueUsers * 100)
      : 0,
    singleDivisionRate: uniqueUsers
      ? Math.round(singleDivisionUsers / uniqueUsers * 100)
      : 0
  }
}

function TrendChart({ monthly }) {
  if (monthly.length < 2) {
    return (
      <div
        id="analytics-hero-chart"
        className="line-chart-card"
        role="status"
      >
        <p className="muted">
          Historical trend unavailable from the loaded dated records.
        </p>
      </div>
    )
  }

  const width = 920
  const height = 270

  const padding = {
    top: 24,
    right: 24,
    bottom: 40,
    left: 28
  }

  const maxRevenue = Math.max(
    ...monthly.map(item => num(item.revenue)),
    1
  )
  const maxMembers = Math.max(
    ...monthly.map(item => num(item.members)),
    1
  )

  const x = index =>
    padding.left +
    ((width - padding.left - padding.right) * index) /
    Math.max(1, monthly.length - 1)

  const yRevenue = value =>
    height - padding.bottom -
    ((height - padding.top - padding.bottom) * num(value)) /
    maxRevenue

  const yMembers = value =>
    height - padding.bottom -
    ((height - padding.top - padding.bottom) * num(value)) /
    maxMembers

  const revenue = monthly.map(
    (item, index) => `${x(index)},${yRevenue(item.revenue)}`
  ).join(' ')

  const growth = monthly.map(
    (item, index) =>
      `${x(index)},${yMembers(item.members)}`
  ).join(' ')

  const base = height - padding.bottom

  return (
    <div id="analytics-hero-chart" className="line-chart-card">
      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id="rev-fill"
              x1="0" y1="0" x2="0" y2="1"
            >
              <stop
                offset="0%"
                stopColor="rgba(77,139,255,.42)"
              />
              <stop
                offset="100%"
                stopColor="rgba(77,139,255,0)"
              />
            </linearGradient>

            <linearGradient
              id="mem-fill"
              x1="0" y1="0" x2="0" y2="1"
            >
              <stop
                offset="0%"
                stopColor="rgba(34,211,238,.26)"
              />
              <stop
                offset="100%"
                stopColor="rgba(34,211,238,0)"
              />
            </linearGradient>
          </defs>

          <polygon
            points={`${padding.left},${base} ${revenue} ${x(monthly.length - 1)},${base}`}
            fill="url(#rev-fill)"
          />

          <polygon
            points={`${padding.left},${base} ${growth} ${x(monthly.length - 1)},${base}`}
            fill="url(#mem-fill)"
          />

          <polyline
            points={growth}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <polyline
            points={revenue}
            fill="none"
            stroke="#4d8bff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {monthly.map((item, index) => (
            <circle
              key={`revenue-${index}`}
              cx={x(index)}
              cy={yRevenue(item.revenue)}
              r="4.5"
              fill="#4d8bff"
            />
          ))}

          {monthly.map((item, index) => (
            <circle
              key={`members-${index}`}
              cx={x(index)}
              cy={yMembers(item.members)}
              r="3.2"
              fill="#22d3ee"
            />
          ))}
        </svg>
      </div>

      <div className="chart-axis-labels">
        {monthly.map((item, index) => (
          <span key={`${item.month}-${index}`}>
            {item.month}
          </span>
        ))}
      </div>

      <div className="chart-legend">
        <span className="chart-legend-item">
          <i
            className="chart-legend-swatch"
            style={{ background: '#4d8bff' }}
          />
          Revenue Trend
        </span>

        <span className="chart-legend-item">
          <i
            className="chart-legend-swatch"
            style={{ background: '#22d3ee' }}
          />
          Growth Index
        </span>
      </div>
    </div>
  )
}

function Breakdown({ id, counts }) {
  const entries = Object.entries(
    counts &&
    typeof counts === 'object' &&
    !Array.isArray(counts)
      ? counts
      : {}
  )
    .sort((a, b) => num(b[1]) - num(a[1]))
    .slice(0, 8)

  return (
    <div id={id}>
      {entries.length ? entries.map(([name, value]) => (
        <div
          className="admin-business-chat-breakdown-row"
          key={name}
        >
          <span>{name || 'unknown'}</span>
          <strong>{num(value)}</strong>
        </div>
      )) : (
        <div className="muted">No data yet.</div>
      )}
    </div>
  )
}

function BusinessChatAnalytics({ state }) {
  const [fresh, setFresh] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reports = list(state.businessChatReports)

  const fallback = {
    totalReports: reports.length,
    pendingReports: reports.filter(item =>
      String(item.status || '').toLowerCase() ===
      'pending_review'
    ).length,
    resolvedReports: reports.filter(item =>
      String(item.status || '').toLowerCase() !==
      'pending_review'
    ).length,
    blockedConversations: reports.filter(item =>
      String(item.status || '').toLowerCase() === 'blocked'
    ).length,
    closedConversations: reports.filter(item =>
      String(item.status || '').toLowerCase() === 'closed'
    ).length,
    reportedConversations: reports.length
  }

  const analytics =
    fresh || state.businessChatAnalytics || fallback

  const stats = [
    [
      'Total Business Chats',
      analytics.totalConversations,
      'Cross-division threads'
    ],
    [
      'Active Conversations',
      analytics.activeConversations,
      'Currently open'
    ],
    [
      'Active Deal Conversations',
      analytics.activeDealConversations,
      'Deal/business-purpose chats'
    ],
    [
      'Reported Conversations',
      analytics.reportedConversations,
      'Chats with reports'
    ],
    [
      'Pending Reports',
      analytics.pendingReports,
      'Needs admin review'
    ],
    [
      'Blocked Conversations',
      analytics.blockedConversations,
      'Replies disabled'
    ],
    [
      'Unique Blocked Users',
      analytics.uniqueBlockedUsers,
      'Participants touched by blocks'
    ],
    [
      'Avg Messages / Chat',
      analytics.averageMessagesPerConversation,
      'Conversation depth'
    ]
  ]

  async function refreshAnalytics() {
    if (busy) return

    setBusy(true)
    setError('')

    try {
      const result = await adminFetchJson(
        '/api/admin/plaza/business-chat-analytics',
        { method: 'GET' }
      )

      setFresh(result.analytics || {})
    } catch (cause) {
      setError(
        cause?.message ||
        'Failed to load Business Chat analytics.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="panel-card admin-business-chat-analytics-card">
      <div className="panel-head wrap-head">
        <div>
          <p className="eyebrow">
            Business Chat Intelligence
          </p>
          <h3>Cross-Division Messaging Analytics</h3>
        </div>

        <div className="toolbar">
          <button
            type="button"
            className="ghost-btn"
            onClick={refreshAnalytics}
            disabled={busy}
          >
            {busy ? 'Refreshing...' : 'Refresh Analytics'}
          </button>
        </div>
      </div>

      {error && <p role="alert">{error}</p>}

      <div
        className="stats-grid compact"
        id="business-chat-analytics-stats"
      >
        {stats.map(([label, value, meta]) => (
          <article className="stat-card" key={label}>
            <span className="stat-label">{label}</span>
            <strong className="stat-value">{num(value)}</strong>
            <small className="stat-foot">{meta}</small>
          </article>
        ))}
      </div>

      <div className="admin-business-chat-analytics-grid">
        <div className="admin-business-chat-analytics-box">
          <h4>Status Breakdown</h4>
          <Breakdown
            id="business-chat-status-breakdown"
            counts={analytics.statusCounts}
          />
        </div>

        <div className="admin-business-chat-analytics-box">
          <h4>Report Breakdown</h4>
          <Breakdown
            id="business-chat-report-breakdown"
            counts={analytics.reportStatusCounts}
          />
        </div>

        <div className="admin-business-chat-analytics-box">
          <h4>Division Flow</h4>
          <Breakdown
            id="business-chat-division-flow"
            counts={analytics.divisionPairs}
          />
        </div>

        <div className="admin-business-chat-analytics-box">
          <h4>Latest Deal Conversations</h4>

          <div id="business-chat-latest-conversations">
            {list(analytics.latestConversations).length
              ? list(analytics.latestConversations).map(
                  (item, index) => (
                    <article
                      className="admin-business-chat-latest-item"
                      key={item.id || index}
                    >
                      <strong>
                        {item.businessPurpose ||
                          item.contextTitle ||
                          'Business conversation'}
                      </strong>

                      <span>
                        {[item.sourceDivision, item.targetDivision]
                          .filter(Boolean)
                          .join(' → ') || 'Cross-division'}
                      </span>

                      <small>
                        {item.status || 'active'} •{' '}
                        {num(item.messageCount)} messages
                      </small>
                    </article>
                  )
                )
              : (
                <div className="muted">
                  No recent Business Chat conversations yet.
                </div>
              )}
          </div>
        </div>
      </div>
    </article>
  )
}

function ProgressRows({ id, items, kind = 'stack' }) {
  return (
    <div
      id={id}
      className={kind === 'bar' ? 'bars-list' : 'stack-list'}
    >
      {items.map((item, index) => {
        const pct = Math.max(
          0,
          Math.min(100, num(item.percent))
        )

        const key = `${item.title}-${index}`

        return kind === 'bar' ? (
          <div className="bar-item" key={key}>
            <div className="bar-item-head">
              <strong>{item.title}</strong>
              <span>{item.label}</span>
            </div>

            <div className="progress">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <div className="stack-item" key={key}>
            <div className="stack-item-head">
              <strong>{item.title}</strong>
              <span>
                {item.configured === false
                  ? 'Not configured'
                  : String(Math.round(pct)) + '%'}
              </span>
            </div>

            <div className="progress">
              <i style={{ width: `${pct}%` }} />
            </div>

            <p>{item.sub}</p>
          </div>
        )
      })}
    </div>
  )
}

function AnalyticsCard({
  eyebrow,
  title,
  children,
  className = ''
}) {
  return (
    <article className={`panel-card ${className}`}>
      <div className="panel-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>

      {children}
    </article>
  )
}

export default function AdminAnalyticsView({
  state,
  active = false
}) {
  const members = list(state.members)
  const applications = list(state.applications)
  const plazas = list(state.plazas)
  const federation = list(state.federation)

  const analytics = state.analytics || {}
  const finance = analytics.finance || {}
  const targets = analytics.targets || {}

  const metrics = membershipMetrics(members)

  const monthly = list(analytics.monthly)

  const revenueMix = list(analytics.revenueMix)
  const regions = list(analytics.regions)

  const latest = monthly[monthly.length - 1] || {
    revenue: 0,
    members: metrics.uniqueUsers
  }
  const previous = monthly[monthly.length - 2] || null

  const revenueDelta = previous
    ? num(latest.revenue) - num(previous.revenue)
    : null

  const growthDelta = previous
    ? num(latest.members) - num(previous.members)
    : null

  const approved = applications.filter(
    item => item.status === 'Approved'
  ).length

  const activeMembers = members.filter(
    item => item.status === 'Active'
  ).length

  const activePlazas = plazas.filter(
    item => item.status === 'Active'
  ).length

  const approvalRate = Math.round(
    approved / Math.max(1, applications.length) * 100
  )

  const activeRate = Math.round(
    activeMembers / Math.max(1, members.length) * 100
  )

  const statCards = [
    [
      'Total Revenue',
      money(finance.totalRevenue),
      'All-time YH revenue'
    ],
    [
      'Monthly Revenue',
      money(finance.monthlyRevenue),
      revenueDelta === null
        ? 'Monthly comparison unavailable'
        : `${revenueDelta >= 0 ? '+' : ''}${money(revenueDelta)} vs last month`
    ],
    [
      'Member Reach',
      num(latest.members),
      `${num(finance.countriesReached)} countries reached`
    ],
    [
      'Overall Unique Users',
      metrics.uniqueUsers,
      'Deduplicated overall member count'
    ],
    [
      'Total Memberships',
      metrics.totalMemberships,
      'All division memberships combined'
    ],
    [
      'Overlap Users',
      metrics.overlapUsers,
      'Users inside more than one division'
    ],
    [
      'Approval Rate',
      `${approvalRate}%`,
      `${approved}/${applications.length} approved`
    ],
    [
      'Active Member Rate',
      `${activeRate}%`,
      `${activeMembers}/${members.length} active`
    ],
    [
      'Avg Review Days',
      num(finance.averageReviewDays),
      `${activePlazas} active listings live`
    ]
  ]

  const progress = [
    [
      'Member goal',
      num(latest.members),
      num(targets.membersGoal),
      'How close YH is to the next membership milestone'
    ],
    [
      'Federation target',
      federation.length * 18,
      num(targets.federationGoal),
      'Strategic network build-out'
    ],
    [
      'Monthly revenue target',
      num(finance.monthlyRevenue),
      num(targets.monthlyRevenueGoal),
      'Income progress toward monthly target'
    ],
    [
      'Plazas activation goal',
      plazas.length * 28,
      num(targets.plazasGoal),
      'Marketplace opportunity coverage'
    ]
  ].map(([title, current, goal, sub]) => ({
    title,
    configured: goal > 0,
    percent: goal > 0
      ? Math.min(100, Math.round(current / goal * 100))
      : 0,
    sub
  }))

  const maxDivision = Math.max(
    ...Object.values(metrics.divisionCounts),
    1
  )

  const divisionBars = Object.entries(
    metrics.divisionCounts
  ).map(([title, value]) => ({
    title,
    label: value,
    percent: Math.round(value / maxDivision * 100)
  }))

  const maxRegion = Math.max(
    ...regions.map(item => num(item.revenue)),
    1
  )

  const regionBars = regions.map(item => ({
    title: item.name || 'Unknown',
    label: `${num(item.members)} members`,
    percent: Math.round(
      num(item.revenue) / maxRegion * 100
    )
  }))

  const maxRevenue = Math.max(
    ...revenueMix.map(item => num(item.revenue)),
    1
  )

  const revenueBars = revenueMix.map(item => ({
    title: item.division || 'Unknown',
    label: money(item.revenue),
    percent: Math.round(
      num(item.revenue) / maxRevenue * 100
    )
  }))

  const ratios = [
    [
      'Average memberships per user',
      metrics.avgMembershipsPerUser.toFixed(2)
    ],
    [
      'Overlap rate',
      `${metrics.overlapRate}%`
    ],
    [
      'Single-division rate',
      `${metrics.singleDivisionRate}%`
    ]
  ]

  return (
    <section
      className={`view view-analytics${active ? ' active' : ''}`}
      id="view-analytics"
      data-app-active={active ? '' : undefined}
    >
      <div
        className="stats-grid analytics-top-stats"
        id="analytics-stats"
      >
        {statCards.map(([label, value, foot]) => (
          <article className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-foot">{foot}</div>
          </article>
        ))}
      </div>

      <div className="content-grid analytics-grid-main">
        <BusinessChatAnalytics state={state} />

        <article className="panel-card analytics-hero-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">
                Overall Performance
              </p>
              <h3>YH Growth & Revenue Trend</h3>
            </div>

            <div
              className="analytics-mini-meta"
              id="analytics-hero-meta"
            >
              <span className="analytics-mini-pill">
                Revenue now {money(latest.revenue)}
              </span>

              <span className="analytics-mini-pill">
                {growthDelta === null
                  ? 'Growth unavailable'
                  : `Growth ${growthDelta >= 0 ? '+' : ''}${growthDelta} members`}
              </span>

              <span className="analytics-mini-pill">
                {metrics.uniqueUsers} unique users
              </span>

              <span className="analytics-mini-pill">
                {num(finance.countriesReached)} countries active
              </span>
            </div>
          </div>

          <TrendChart monthly={monthly} />
        </article>

        <AnalyticsCard
          eyebrow="Goal Tracking"
          title="Target Progress"
          className="analytics-side-card"
        >
          <ProgressRows
            id="analytics-target-progress"
            items={progress}
          />
        </AnalyticsCard>
      </div>

      <div className="content-grid analytics-grid-secondary">
        <AnalyticsCard
          eyebrow="Division Growth"
          title="Member Distribution"
        >
          <ProgressRows
            id="analytics-division-bars"
            items={divisionBars}
            kind="bar"
          />
        </AnalyticsCard>

        <AnalyticsCard
          eyebrow="Geographic Reach"
          title="YH Expansion Map"
        >
          {regions.length ? (
            <ProgressRows
              id="analytics-regions"
              items={regionBars}
              kind="bar"
            />
          ) : (
            <div
              className="bars-list"
              id="analytics-regions"
            >
              <div className="stack-item">
                <p className="muted">
                  No regional analytics loaded yet.
                </p>
              </div>
            </div>
          )}
        </AnalyticsCard>
      </div>

      <div className="content-grid analytics-grid-secondary">
        <AnalyticsCard
          eyebrow="Revenue Breakdown"
          title="Division Revenue Mix"
        >
          {revenueMix.length ? (
            <ProgressRows
              id="analytics-revenue-mix"
              items={revenueBars}
              kind="bar"
            />
          ) : (
            <div
              className="bars-list"
              id="analytics-revenue-mix"
            >
              <div className="stack-item">
                <p className="muted">
                  No revenue mix loaded yet.
                </p>
              </div>
            </div>
          )}
        </AnalyticsCard>

        <AnalyticsCard
          eyebrow="Operational Ratios"
          title="Conversion & Activity"
        >
          <div
            id="analytics-ratios"
            className="stack-list"
          >
            {ratios.map(([label, value]) => (
              <div className="stack-item" key={label}>
                <div className="stack-item-head">
                  <strong>{label}</strong>
                  <span>{value}</span>
                </div>
              </div>
            ))}
          </div>
        </AnalyticsCard>
      </div>
    </section>
  )
}
