import { clean, safeArray, normalizeFeed, normalizeOpportunity, normalizeDirectory, normalizeRegion, formatBudget, normalizePlazaReputation, plazaReputationRank, resolvePlazaExplorerHomeZone } from './plazaExplorerUtils.js'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import './PlazaWorkspace.css'
import PlazaFeedWorkspace from './PlazaFeedWorkspace.jsx'

export default function PlazaExplorerWorkspace({
  onToast,
  onWorkspaceOpen,
}) {
  const [
    feed,
    setFeed,
  ] = useState([])

  const [plazaWorkflow, setPlazaWorkflow] = useState({
    requests: null,
    conversations: null,
    meetups: null,
    meetupItems: [],
  })

  const [
    opportunities,
    setOpportunities,
  ] = useState([])

  const [
    directory,
    setDirectory,
  ] = useState([])

  const [
    regions,
    setRegions,
  ] = useState([])

  const [
    reputation,
    setReputation,
  ] = useState(
    normalizePlazaReputation({
      loaded: false,
      profile: {},
      events: [],
    }),
  )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const loadExplorer =
    useCallback(
      async (
        refresh = false,
      ) => {
        if (refresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError('')

        try {
          const [
            feedResult,
            opportunitiesResult,
            directoryResult,
            regionsResult,
            reputationResult,
          ] =
            await Promise.all([
              apiFetch(
                '/api/plaza/feed?limit=60',
                {
                  method: 'GET',
                  cache:
                    'no-store',
                },
              ),

              apiFetch(
                '/api/plaza/opportunities?limit=80',
                {
                  method: 'GET',
                  cache:
                    'no-store',
                },
              ),

              apiFetch(
                '/api/plaza/directory?limit=80',
                {
                  method: 'GET',
                  cache:
                    'no-store',
                },
              ),

              apiFetch(
                '/api/plaza/regions?limit=80',
                {
                  method: 'GET',
                  cache:
                    'no-store',
                },
              ),

              apiFetch(
                '/api/plaza/reputation?limit=50',
                {
                  method: 'GET',
                  cache:
                    'no-store',
                },
              ),
            ])

          setFeed(
            safeArray(
              feedResult?.feed,
            ).map(
              normalizeFeed,
            ),
          )

          setOpportunities(
            safeArray(
              opportunitiesResult
                ?.opportunities,
            ).map(
              normalizeOpportunity,
            ),
          )

          setDirectory(
            safeArray(
              directoryResult
                ?.directory,
            ).map(
              normalizeDirectory,
            ),
          )

          setRegions(
            safeArray(
              regionsResult
                ?.regions,
            ).map(
              normalizeRegion,
            ),
          )


          setReputation(
            normalizePlazaReputation(
              reputationResult || {},
            ),
          )

          const workflowResults = await Promise.allSettled([
            apiFetch('/api/plaza/requests?limit=200', {
              method: 'GET', cache: 'no-store'
            }),
            apiFetch('/api/plaza/messages', {
              method: 'GET', cache: 'no-store'
            }),
            apiFetch('/api/plaza/meetups?limit=200', {
              method: 'GET', cache: 'no-store'
            }),
          ])

          const rows = workflowResults.map((result, index) => {
            if (result.status !== 'fulfilled') return null
            const field = ['requests', 'conversations', 'meetups'][index]
            return Array.isArray(result.value?.[field])
              ? result.value[field]
              : null
          })

          setPlazaWorkflow({
            requests: rows[0]?.length ?? null,
            conversations: rows[1]?.length ?? null,
            meetups: rows[2]?.length ?? null,
            meetupItems: rows[2] || [],
          })
        } catch (
          loadError
        ) {
          const message =
            loadError?.message ||
            'Failed to load Plaza Explorer.'

          setError(message)

          onToast?.(
            message,
            'error',
          )
        } finally {
          setLoading(false)
          setRefreshing(false)
        }
      },
      [onToast],
    )

  useEffect(() => {
    void loadExplorer()
  }, [loadExplorer])

  const activeOpportunities =
    useMemo(
      () =>
        opportunities.filter(
          (item) =>
            ![
              'completed',
              'closed',
              'expired',
            ].includes(
              clean(
                item.status,
              ).toLowerCase(),
            ),
        ),
      [opportunities],
    )

  const activeQuest =
    activeOpportunities[0] ||
    null

  const networkSignals = [
    ...feed.slice(0, 2),
    ...activeOpportunities.slice(0, 1).map(item => ({
      ...item,
      text:
        item.text ||
        item.description ||
        item.summary ||
        '',
      authorName:
        item.authorName ||
        item.ownerName ||
        'Plaza Opportunity'
    }))
  ]


  const reputationRank =
    useMemo(
      () =>
        plazaReputationRank(
          reputation.totalReputation,
        ),
      [
        reputation.totalReputation,
      ],
    )

  const homeZone = useMemo(
    () => resolvePlazaExplorerHomeZone(regions),
    [regions]
  )


  const reputationCategoryRows = useMemo(() => {
    const totals = Object.fromEntries(
      ['reliability', 'collaboration', 'regional',
       'opportunity', 'community', 'connector']
        .map(key => [key, 0])
    )

    reputation.events.forEach(event => {
      const type = clean(event.eventType).toLowerCase()

      const key = /opportunity|quest|contract/.test(type)
        ? 'opportunity'
        : /connect|intro|bridge|handoff/.test(type)
          ? 'connector'
          : /region|meetup|event/.test(type)
            ? 'regional'
            : /collaborat|conversation|deal/.test(type)
              ? 'collaboration'
              : /community|support|help/.test(type)
                ? 'community'
                : 'reliability'

      totals[key] += Number(event.reputationPoints || 0)
    })

    return [
      ['reliability', 'Reliability',
        'Verified delivery and settlement outcomes'],
      ['collaboration', 'Collaboration',
        'Completed work with other Plaza members'],
      ['regional', 'Regional Activity',
        'Meaningful participation in a Plaza zone'],
      ['opportunity', 'Opportunity Execution',
        'Admin-verified Opportunity and quest outcomes'],
      ['community', 'Community Contribution',
        'Useful signals, meetups, and support'],
      ['connector', 'Connector Trust',
        'Successful introductions and handoffs'],
    ].map(([key, label, note]) => ({
      key, label, note, points: totals[key]
    }))
  }, [reputation.events])

  const activityRows = [
    ['Verified Reputation Events', reputation.eventCount],
    ['Opportunity Quests', activeOpportunities.length],
    ['Requests', plazaWorkflow.requests],
    ['Conversations', plazaWorkflow.conversations],
    ['Meetups', plazaWorkflow.meetups],
    ['Regions', regions.length],
  ]

  const zones = useMemo(() => {
    const normalize = value => clean(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()

    const corpus = normalize([
      ...feed,
      ...opportunities,
      ...directory,
      ...plazaWorkflow.meetupItems,
    ].map(item => [
      item.region,
      item.network,
      item.continent,
      item.country,
      item.location,
      item.title,
      item.text,
    ].filter(Boolean).join(' ')).join(' '))

    const map = new Map()

    regions.forEach(region => {
      const name =
        region.network ||
        region.continent ||
        region.region ||
        'Global Network'

      const item = map.get(name) || {
        name,
        plazas: 0,
        countries: new Set(),
        members: 0,
      }

      item.plazas += 1
      item.members += Number(region.count || 0)

      region.countries.forEach(country => {
        if (clean(country)) item.countries.add(clean(country))
      })

      map.set(name, item)
    })

    const order = { home: 0, discovered: 1, available: 2 }

    return Array.from(map.values())
      .map(zone => {
        const isHome =
          homeZone.established &&
          normalize(homeZone.network) === normalize(zone.name)

        const discovered = !isHome && (
          corpus.includes(normalize(zone.name)) ||
          [...zone.countries].some(country => {
            const code = normalize(country)
            return code && corpus.includes(code)
          })
        )

        return {
          ...zone,
          countries: zone.countries.size,
          state: isHome
            ? 'home'
            : discovered ? 'discovered' : 'available',
        }
      })
      .sort((a, b) =>
        order[a.state] - order[b.state] ||
        b.plazas - a.plazas ||
        a.name.localeCompare(b.name)
      )
      .slice(0, 6)
  }, [
    regions, feed, opportunities, directory,
    homeZone, plazaWorkflow.meetupItems
  ])

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-react-workspace"
      data-yh-dashboard-react-surface="plazas-explorer"
    >
      <div className="yh-plaza-react-scroll">
        <div className="yh-plaza-react-shell">
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Plazas / Open World
              </span>

              <h1>
                Plaza Explorer
              </h1>

              <p>
                Explore active
                regions, members,
                opportunities and
                current movement
                across the Plazas.
              </p>

              {/* YHU_PLAZA_ORIGINAL_HOME_SHORTCUTS_PARITY */}
              <div className="yh-plaza-open-world-actions-v1">
                <button
                  type="button"
                  className="yh-plaza-btn yh-plaza-btn-primary"
                  data-plaza-open-world-screen="opportunities"
                  onClick={() => onWorkspaceOpen?.('plazas-opportunities')}
                >
                  Browse Opportunities
                </button>

                <button
                  type="button"
                  className="yh-plaza-btn yh-plaza-btn-secondary"
                  data-plaza-open-world-screen="regions"
                  onClick={() => onWorkspaceOpen?.('plazas-regions')}
                >
                  Explore Regions
                </button>
              </div>
            </div>

            <div
              style={{
                display:
                  'flex',
                flexWrap:
                  'wrap',
                gap:
                  '10px',
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  onWorkspaceOpen?.(
                    'plazas-notifications',
                  )
                }
              >
                Notifications
              </button>

              <button
                type="button"
                className="btn-secondary"
                disabled={
                  refreshing
                }
                onClick={() =>
                  void loadExplorer(
                    true,
                  )
                }
              >
                {refreshing
                  ? 'Refreshing...'
                  : 'Refresh'}
              </button>
            </div>
          </header>

          {loading && (
            <div className="yh-plaza-react-state">
              Loading Plaza
              Explorer...
            </div>
          )}

          {error &&
            !loading && (
              <div className="yh-plaza-react-state is-error">
                {error}
              </div>
            )}

          {!loading &&
            !error && (
              <>
                <section className="yh-plaza-react-metrics">
                  <article>
                    <small>Home Zone</small>
                    <strong>{homeZone.label}</strong>
                    <span>
                      {homeZone.established
                        ? [
                            homeZone.city,
                            homeZone.country
                          ].filter(Boolean).join(', ') ||
                          'Assigned Plaza region'
                        : 'No matching home region established'}
                    </span>
                  </article>
                  <article>
                    <small>
                      Regional Zones
                    </small>

                    <strong>
                      {regions.length.toLocaleString()}
                    </strong>

                    <span>
                      Visible Plaza
                      regions
                    </span>
                  </article>

                  <article>
                    <small>
                      Opportunity Quests
                    </small>

                    <strong>
                      {activeOpportunities.length.toLocaleString()}
                    </strong>

                    <span>
                      Currently
                      actionable
                    </span>
                  </article>

                  <article>
                    <small>
                      Visible Members
                    </small>

                    <strong>
                      {directory.length.toLocaleString()}
                    </strong>

                    <span>
                      Current directory
                      signal
                    </span>
                  </article>

                  <article>
                    <small>
                      World Signals
                    </small>

                    <strong>
                      {feed.length.toLocaleString()}
                    </strong>

                    <span>
                      Current feed
                      movement
                    </span>
                  </article>
                </section>


                {/* YHU_REACT_PLAZA_REPUTATION_SURFACE */}
                <section className="yh-plaza-react-section">
                  <div className="yh-plaza-react-section-head">
                    <div>
                      <span className="yh-plaza-react-kicker">
                        Explorer Reputation
                      </span>

                      <h2>
                        {reputationRank.label}
                      </h2>
                    </div>
                  </div>

                  <div className="yh-plaza-react-metrics">
                    <article>
                      <small>
                        Total Reputation
                      </small>

                      <strong>
                        {reputation.totalReputation.toLocaleString()}
                      </strong>

                      <span>
                        Verified Plaza reputation
                      </span>
                    </article>

                    <article>
                      <small>
                        This Week
                      </small>

                      <strong>
                        {reputation.weeklyReputation.toLocaleString()}
                      </strong>

                      <span>
                        Weekly reputation earned
                      </span>
                    </article>

                    <article>
                      <small>
                        Verified Events
                      </small>

                      <strong>
                        {reputation.eventCount.toLocaleString()}
                      </strong>

                      <span>
                        Reputation ledger events
                      </span>
                    </article>

                    <article>
                      <small>
                        Next Rank
                      </small>

                      <strong>
                        {reputationRank.nextLabel}
                      </strong>

                      <span>
                        {reputationRank.nextLabel ===
                        'Max Rank'
                          ? 'Highest Explorer rank reached'
                          : `${Math.max(
                              reputationRank.nextAt -
                                reputation.totalReputation,
                              0,
                            ).toLocaleString()} points remaining`}
                      </span>
                    </article>
                  </div>
                </section>

                <section className="yh-plaza-react-section">
                  <div className="yh-plaza-react-section-head">
                    <div>
                      <span className="yh-plaza-react-kicker">
                        World Map
                      </span>

                      <h2>
                        Regional Zones
                      </h2>
                    </div>
                  </div>

                  {!zones.length ? (
                    <div className="yh-plaza-react-state">
                      Regional topology
                      will appear when
                      Plaza zone data is
                      available.
                    </div>
                  ) : (
                    <div className="yh-plaza-react-zone-grid">
                      {zones.map(
                        (zone) => (
                          <button
                            type="button"
                            key={zone.name}
                            className="yh-plaza-react-zone"
                            onClick={() =>
                              onWorkspaceOpen?.('plazas-regions')
                            }
                          >
                            <small>
                              {zone.state === 'home'
                                ? 'Home Zone'
                                : zone.state === 'discovered'
                                  ? 'Discovered'
                                  : 'Available'}
                            </small>

                            <strong>
                              {zone.name}
                            </strong>

                            <span>
                              {zone.plazas}{' '}
                              Plazas •{' '}
                              {
                                zone.countries
                              }{' '}
                              Countries
                            </span>

                            {zone.members >
                              0 && (
                              <span>
                                {
                                  zone.members
                                }{' '}
                                visible
                                members
                              </span>
                            )}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </section>

                <section className="yh-plaza-react-grid-2">
                  <article className="yh-plaza-react-panel">
                    <span className="yh-plaza-react-kicker">
                      Active Quest
                    </span>

                    {activeQuest ? (
                      <>
                        <h2>
                          {
                            activeQuest.title
                          }
                        </h2>

                        <p>
                          {activeQuest.text ||
                            'Open the opportunity board to review this Plaza opportunity.'}
                        </p>

                        <div className="yh-plaza-react-meta">
                          <span>
                            {
                              activeQuest.region
                            }
                          </span>

                          <span>
                            {
                              activeQuest.type
                            }
                          </span>

                          <span>
                            {formatBudget(
                              activeQuest,
                            )}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="yh-plaza-react-state">
                        No actionable
                        opportunity quest
                        is available yet.
                      </div>
                    )}
                  </article>

                  <article className="yh-plaza-react-panel">
                    <span className="yh-plaza-react-kicker">
                      Network
                    </span>

                    <h2>
                      Visible Members
                    </h2>

                    <div className="yh-plaza-react-list">
                      {directory
                        .slice(0, 5)
                        .map(
                          (member) => (
                            <div
                              key={
                                member.id
                              }
                            >
                              <strong>
                                {
                                  member.name
                                }
                              </strong>

                              <span>
                                {
                                  member.role
                                }{' '}
                                •{' '}
                                {
                                  member.region
                                }
                              </span>
                            </div>
                          ),
                        )}

                      {!directory.length && (
                        <div className="yh-plaza-react-state">
                          No visible
                          members yet.
                        </div>
                      )}
                    </div>
                  </article>
                </section>

                <section
                  className="yh-plaza-open-world-lanes-v1"
                  aria-label="Plaza Home shortcuts"
                >
                  <button
                    type="button"
                    data-plaza-open-world-screen="opportunities"
                    onClick={() => onWorkspaceOpen?.('plazas-opportunities')}
                  >
                    <span>Opportunities</span>
                    <strong>Find Your Next Move</strong>
                    <small>Discover projects, collaborations, services, and active opportunities.</small>
                  </button>

                  <button
                    type="button"
                    data-plaza-open-world-screen="directory"
                    onClick={() => onWorkspaceOpen?.('plazas-directory')}
                  >
                    <span>Directory</span>
                    <strong>Discover Members</strong>
                    <small>Find builders, connectors, operators, and specialists.</small>
                  </button>

                  <button
                    type="button"
                    data-plaza-open-world-screen="meetups"
                    onClick={() => onWorkspaceOpen?.('plazas-meetups')}
                  >
                    <span>Meetups</span>
                    <strong>Connect Locally</strong>
                    <small>Find regional gatherings and Patron-led Plaza sessions.</small>
                  </button>

                  <button
                    type="button"
                    data-plaza-open-world-screen="messages"
                    onClick={() => onWorkspaceOpen?.('plazas-conversations')}
                  >
                    <span>Conversations</span>
                    <strong>Continue Discussions</strong>
                    <small>Continue context-based conversations with members and collaborators.</small>
                  </button>
                </section>

                {/* ORIGINAL PLAZA HOME — REPUTATION PARITY */}
                <section className="yh-plaza-react-section">
                  <div className="yh-plaza-react-section-head">
                    <div>
                      <span className="yh-plaza-react-kicker">
                        Explorer Progression
                      </span>
                      <h2>Rank Path</h2>
                    </div>
                    <strong>{reputationRank.label}</strong>
                  </div>

                  <div className="yh-plaza-react-zone-grid">
                    {[
                      ['newcomer', 'Newcomer', 0],
                      ['explorer', 'Explorer', 5],
                      ['connector', 'Connector', 20],
                      ['regional-operator', 'Regional Operator', 50],
                      ['world-builder', 'World Builder', 100]
                    ].map(([key, label, minimum]) => (
                      <article
                        className="yh-plaza-react-zone"
                        key={key}
                      >
                        <small>
                          {reputation.totalReputation >= minimum
                            ? 'Achieved threshold'
                            : 'Upcoming threshold'}
                        </small>
                        <strong>{label}</strong>
                        <span>
                          {minimum} verified reputation points
                        </span>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="yh-plaza-react-grid-2">
                  <article className="yh-plaza-react-panel">
                    <span className="yh-plaza-react-kicker">
                      Reputation Framework
                    </span>
                    <h2>Operator Signals</h2>
                    <div className="yh-plaza-react-list">
                      {reputationCategoryRows.map(row => (
                        <div key={row.key}>
                          <strong>{row.label}</strong>
                          <span>
                            {row.points.toLocaleString()} pts • {row.note}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="yh-plaza-react-panel">
                    <span className="yh-plaza-react-kicker">
                      Explorer Activity
                    </span>
                    <h2>Current Working Signals</h2>
                    <div className="yh-plaza-react-list">
                      {activityRows.map(([label, value]) => (
                        <div key={label}>
                          <strong>{label}</strong>
                          <span>
                            {value === null
                              ? 'Unavailable'
                              : value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p>
                      Only server-verified events change Plaza Reputation.
                    </p>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => onWorkspaceOpen?.('plazas-requests')}
                    >
                      Open Requests
                    </button>
                  </article>
                </section>

                <section className="yh-plaza-react-section">
                  <div className="yh-plaza-react-section-head">
                    <div>
                      <span className="yh-plaza-react-kicker">
                        Network Signals
                      </span>
                      <h2>
                        Live Movement
                      </h2>
                    </div>
                  </div>

                  <div className="yh-plaza-react-signal-grid">
                    {networkSignals.map(
                        (item) => (
                          <article
                            key={
                              item.id
                            }
                          >
                            <small>
                              {
                                item.region
                              }
                            </small>

                            <strong>
                              {
                                item.title
                              }
                            </strong>

                            <p>
                              {item.text ||
                                'Plaza activity update.'}
                            </p>

                            <span>
                              {
                                item.authorName
                              }
                            </span>
                          </article>
                        ),
                      )}

                    {!networkSignals.length && (
                      <div className="yh-plaza-react-state">
                        No Plaza world
                        signals yet.
                      </div>
                    )}
                  </div>
                </section>
                <PlazaFeedWorkspace
                  composerOnly
                  onToast={onToast}
                  onWorkspaceOpen={onWorkspaceOpen}
                  onPosted={() => void loadExplorer(true)}
                />
              </>
            )}
        </div>
      </div>
    </section>
  )
}
