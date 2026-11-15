import { useLocation, useNavigate } from 'react-router-dom'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import { PLAZA_CANONICAL_REGIONS } from './plazaCanonicalRegions'
import './PlazaRegionsWorkspace.css'

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function createClientId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `plaza_region_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function mergeKey(value = '') {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeRegion(
  item = {},
  index = 0,
) {
  const countries =
    safeArray(
      item.countries,
    )
      .map(clean)
      .filter(Boolean)

  return {
    ...item,

    id:
      clean(item.id) ||
      `plaza-region-${index}`,

    continent:
      clean(item.continent),

    network:
      clean(item.network),

    plazaNumber:
      Number(
        item.plazaNumber ||
          0,
      ) || 0,

    region:
      clean(
        item.region ||
          item.name,
      ) ||
      'Plaza Region',

    label:
      clean(
        item.label ||
          item.region ||
          item.name,
      ) ||
      'Region Hub',

    text:
      clean(
        item.text ||
          item.description,
      ),

    countries,

    countryCount:
      Number(
        item.countryCount ||
          countries.length ||
          0,
      ) || 0,

    count:
      Number(
        item.count ||
          item.memberCount ||
          0,
      ) || 0,

    patronStatus:
      clean(
        item.patronStatus,
      ),

    patronUserId:
      clean(
        item.patronUserId,
      ),

    patronName:
      clean(
        item.patronName,
      ),

    patronRole:
      clean(
        item.patronRole,
      ) ||
      'Regional Patron',

    patronBenefits:
      safeArray(
        item.patronBenefits,
      ),

    sourceUrl:
      clean(
        item.sourceUrl,
      ),
  }
}

function mergeRegions(
  serverRegions = [],
) {
  const canonical =
    PLAZA_CANONICAL_REGIONS.map(
      normalizeRegion,
    )

  if (
    !serverRegions.length
  ) {
    return canonical.map(
      (item) => ({
        ...item,

        text:
          item.text ||
          `${item.network} regional hub covering ${item.countries.length} countries: ${item.countries.join(', ')}.`,
      }),
    )
  }

  const canonicalByKey =
    new Map()

  canonical.forEach(
    (item) => {
      ;[
        item.id,
        item.region,
        item.label,
      ].forEach(
        (value) => {
          const key =
            mergeKey(value)

          if (key) {
            canonicalByKey.set(
              key,
              item,
            )
          }
        },
      )
    },
  )

  const merged =
    serverRegions.map(
      (
        raw,
        index,
      ) => {
        const item =
          normalizeRegion(
            raw,
            index,
          )

        const base =
          [
            item.id,
            item.region,
            item.label,
          ]
            .map(
              mergeKey,
            )
            .map(
              (key) =>
                canonicalByKey.get(
                  key,
                ),
            )
            .find(Boolean) ||
          null

        if (!base) {
          return item
        }

        const countries =
          item.countries
            .length
            ? item.countries
            : base.countries

        return normalizeRegion(
          {
            ...base,
            ...item,

            label:
              item.label &&
              item.label.toLowerCase() !==
                'region hub'
                ? item.label
                : base.label,

            continent:
              item.continent ||
              base.continent,

            network:
              item.network ||
              base.network,

            plazaNumber:
              item.plazaNumber ||
              base.plazaNumber,

            countries,

            text:
              item.text ||
              `${base.network} regional hub covering ${countries.length} countries: ${countries.join(', ')}.`,
          },
          index,
        )
      },
    )

  const mergedKeys =
    new Set()

  merged.forEach(
    (item) => {
      ;[
        item.id,
        item.region,
        item.label,
      ].forEach(
        (value) => {
          const key =
            mergeKey(value)

          if (key) {
            mergedKeys.add(
              key,
            )
          }
        },
      )
    },
  )

  canonical.forEach(
    (item) => {
      const exists =
        [
          item.id,
          item.region,
          item.label,
        ].some(
          (value) =>
            mergedKeys.has(
              mergeKey(
                value,
              ),
            ),
        )

      if (!exists) {
        merged.push({
          ...item,

          text:
            item.text ||
            `${item.network} regional hub covering ${item.countries.length} countries: ${item.countries.join(', ')}.`,
        })
      }
    },
  )

  return merged
}

function isPatronActive(
  item = {},
) {
  return (
    clean(
      item.patronStatus,
    ).toLowerCase() ===
      'active' &&
    Boolean(
      clean(
        item.patronUserId,
      ),
    )
  )
}

function topologyClass(
  item = {},
) {
  const value =
    clean(
      item.continent ||
        item.network ||
        item.region,
    ).toLowerCase()

  if (
    value.includes(
      'africa',
    )
  ) {
    return 'is-africa'
  }

  if (
    value.includes(
      'asia',
    )
  ) {
    return 'is-asia'
  }

  if (
    value.includes(
      'europe',
    )
  ) {
    return 'is-europe'
  }

  if (
    value.includes(
      'north',
    )
  ) {
    return 'is-north-america'
  }

  if (
    value.includes(
      'south',
    ) ||
    value.includes(
      'latam',
    )
  ) {
    return 'is-latam'
  }

  if (
    value.includes(
      'oceania',
    )
  ) {
    return 'is-oceania'
  }

  return 'is-global'
}

function RegionTopology({
  region,
}) {
  const visible =
    region.countries.slice(
      0,
      8,
    )

  const remaining =
    Math.max(
      region.countries
        .length -
        visible.length,
      0,
    )

  return (
    <div
      className={`yh-plaza-region-topology ${topologyClass(
        region,
      )}`}
    >
      <div className="yh-plaza-region-topology-grid" />

      <div className="yh-plaza-region-topology-core">
        <strong>
          {region.region}
        </strong>

        <span>
          {region.network ||
            region.continent ||
            'YH Plaza'}
        </span>
      </div>

      <div className="yh-plaza-region-topology-nodes">
        {visible.map(
          (
            country,
            index,
          ) => (
            <span
              key={
                country
              }
              className={`node node-${
                index + 1
              }`}
            >
              {country}
            </span>
          ),
        )}

        {remaining >
          0 && (
          <span className="node node-more">
            +{remaining}
          </span>
        )}
      </div>
    </div>
  )
}

export default function PlazaRegionsWorkspace({
  workspaceKey = 'plazas-regions',
  onToast,
  onWorkspaceOpen,
}) {
  const routeLocation = useLocation()
  const routeNavigate = useNavigate()

  const createIdRef =
    useRef('')

  const [
    serverRegions,
    setServerRegions,
  ] = useState([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false)

  const [
    nextCursor,
    setNextCursor,
  ] = useState('')

  const [
    hasMore,
    setHasMore,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    view,
    setView,
  ] = useState(
    workspaceKey ===
      'plazas-atlas'
      ? 'atlas'
      : 'overview',
  )

  const [
    creating,
    setCreating,
  ] = useState(false)

  const [
    form,
    setForm,
  ] = useState({
    region: '',
    label: '',
    text: '',
  })

  const [
    selectedRegion,
    setSelectedRegion,
  ] = useState(null)

  const [
    regionActionBusy,
    setRegionActionBusy,
  ] = useState('')

  useEffect(() => {
    setView(
      workspaceKey ===
        'plazas-atlas'
        ? 'atlas'
        : 'overview',
    )
  }, [workspaceKey])

  const regions =
    useMemo(
      () =>
        mergeRegions(
          serverRegions,
        ),
      [serverRegions],
    )

  useEffect(() => {
    const previous = routeLocation.state?.plazaReopenModal

    if (previous?.type !== 'region' || loading) return

    const match = regions.find(
      item => clean(item.id) === clean(previous.id)
    )

    if (match) setSelectedRegion(match)

    routeNavigate(routeLocation.pathname + routeLocation.search, {
      replace: true,
      state: null,
    })
  }, [routeLocation, routeNavigate, regions, loading])

  const loadRegions =
    useCallback(
      async ({
        refresh = false,
        append = false,
        cursor = '',
      } = {}) => {
        if (append) {
          setLoadingMore(
            true,
          )
        } else if (refresh) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(true)
        }

        if (!append) {
          setError('')
        }

        try {
          const params =
            new URLSearchParams({
              limit: '80',
            })

          if (clean(cursor)) {
            params.set(
              'cursor',
              clean(cursor),
            )
          }

          const result =
            await apiFetch(
              `/api/plaza/regions?${params.toString()}`,
              {
                method:
                  'GET',
                cache:
                  'no-store',
              },
            )

          const incoming =
            safeArray(
              result?.regions,
            ).map(
              normalizeRegion,
            )

          setServerRegions(
            (current) => {
              if (!append) {
                return incoming
              }

              const map =
                new Map()

              ;[
                ...current,
                ...incoming,
              ].forEach(
                (item) => {
                  map.set(
                    item.id,
                    item,
                  )
                },
              )

              return Array.from(
                map.values(),
              )
            },
          )

          const cursorValue =
            clean(
              result?.nextCursor ||
                result?.next_cursor,
            )

          setNextCursor(
            cursorValue,
          )

          setHasMore(
            Boolean(
              cursorValue,
            ) &&
              result?.hasMore !==
                false,
          )
        } catch (
          loadError
        ) {
          const message =
            loadError?.message ||
            'Could not load Plaza regions.'

          setError(message)

          onToast?.(
            message,
            'error',
          )
        } finally {
          setLoading(false)
          setRefreshing(false)
          setLoadingMore(false)
        }
      },
      [onToast],
    )

  useEffect(() => {
    void loadRegions()
  }, [loadRegions])

  const totalCountries =
    useMemo(
      () =>
        regions.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.countries
              .length,
          0,
        ),
      [regions],
    )

  const activePatrons =
    useMemo(
      () =>
        regions.filter(
          isPatronActive,
        ).length,
      [regions],
    )

  const submitRegion =
    async (event) => {
      event.preventDefault()

      if (creating) {
        return
      }

      const payload = {
        region:
          clean(
            form.region,
          ),

        label:
          clean(
            form.label,
          ) ||
          'Region Hub',

        text:
          clean(
            form.text,
          ),
      }

      if (!payload.region) {
        onToast?.(
          'Add a region name first.',
          'error',
        )
        return
      }

      if (!payload.text) {
        onToast?.(
          'Add a region description first.',
          'error',
        )
        return
      }

      if (
        !createIdRef.current
      ) {
        createIdRef.current =
          createClientId()
      }

      setCreating(true)

      try {
        const result =
          await apiFetch(
            '/api/plaza/regions',
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  ...payload,

                  clientCreateId:
                    createIdRef.current,
                }),
            },
          )

        const region =
          result?.region
            ? normalizeRegion(
                result.region,
              )
            : null

        if (!region) {
          throw new Error(
            'Plaza region response was incomplete. Retry the same submission.',
          )
        }

        if (
          result?.published ===
          true
        ) {
          setServerRegions(
            (current) => [
              region,
              ...current.filter(
                (item) =>
                  item.id !==
                  region.id,
              ),
            ],
          )
        }

        createIdRef.current =
          ''

        setForm({
          region: '',
          label: '',
          text: '',
        })

        onToast?.(
          result?.published ===
          true
            ? 'Region hub created.'
            : 'Region hub submitted for review.',
          'success',
        )
      } catch (
        createError
      ) {
        onToast?.(
          createError?.message ||
            'Could not create region hub.',
          'error',
        )
      } finally {
        setCreating(false)
      }
    }

  const cacheConversation =
    (conversation) => {
      if (
        !conversation ||
        typeof conversation !==
          'object'
      ) {
        return
      }

      const id =
        clean(
          conversation.id,
        )

      if (!id) return

      try {
        const parsed =
          JSON.parse(
            localStorage.getItem(
              'yhPlazaConversationsCleanV1',
            ) || '[]',
          )

        const current =
          Array.isArray(
            parsed,
          )
            ? parsed
            : []

        localStorage.setItem(
          'yhPlazaConversationsCleanV1',
          JSON.stringify([
            conversation,

            ...current.filter(
              (item) =>
                clean(
                  item?.id,
                ) !== id,
            ),
          ]),
        )
      } catch {}
    }

  const openRegionChat =
    async (region) => {
      const regionId =
        clean(
          region?.id,
        )

      if (!regionId) {
        onToast?.(
          'Region chat is missing its Plaza ID.',
          'error',
        )
        return
      }

      if (regionActionBusy) {
        return
      }

      setRegionActionBusy(
        'chat:' +
          regionId,
      )

      try {
        const result =
          await apiFetch(
            '/api/plaza/messages/from-region/' +
              encodeURIComponent(
                regionId,
              ),
            {
              method: 'POST',

              body:
                JSON.stringify(
                  {},
                ),
            },
          )

        const conversation =
          result?.conversation

        if (
          !conversation ||
          !clean(
            conversation.id,
          )
        ) {
          throw new Error(
            'Regional Plaza conversation response was incomplete.',
          )
        }

        cacheConversation(
          conversation,
        )

        try {
          sessionStorage.setItem(
            'yh_plaza_open_conversation_id',
            clean(
              conversation.id,
            ),
          )
        } catch {}

        setSelectedRegion(
          null,
        )

        onToast?.(
          'Regional Plaza chat opened.',
          'success',
        )

        onWorkspaceOpen?.(
          'plazas-conversations',
        )
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            'Could not open Plaza chat.',
          'error',
        )
      } finally {
        setRegionActionBusy('')
      }
    }

  const openRegionalRequest =
    (region) => {
      if (!region) return

      try {
        sessionStorage.setItem(
          'yh_plaza_request_prefill',
          JSON.stringify({
            objective:
              'Regional connection',

            sourceType:
              'region',

            targetId:
              clean(
                region.id,
              ),

            targetLabel:
              clean(
                region.region,
              ) ||
              'Plaza Region',

            region:
              clean(
                region.region,
              ),

            context:
              clean(
                region.label,
              ),

            message:
              'I want to connect with the right people and movement inside ' +
              (
                clean(
                  region.region,
                ) ||
                'this Plaza region'
              ) +
              '.',

            requestIntent:
              'regional_connection',

            requestPriority:
              'normal',

            routeKey:
              'regional_connection',

            routeLabel:
              'Regional routing',

            matchingStatus:
              'queued_for_review',

            matchingPriority:
              'normal',
          }),
        )
      } catch {}

      setSelectedRegion(
        null,
      )

      onWorkspaceOpen?.('plazas-requests', {
        state: {
          plazaReturn: {
            workspaceKey: view === 'atlas'
              ? 'plazas-atlas'
              : 'plazas-regions',
            modal: 'region',
            id: clean(region.id),
          },
        },
      })
    }

  const openMeetup = (region) => {
    try {
      sessionStorage.setItem(
        'yh_plaza_meetup_prefill_region_id',
        clean(region?.id),
      )
    } catch {}

    onWorkspaceOpen?.('plazas-meetups')
  }

  const openPatron = (region) => {
    try {
      sessionStorage.setItem(
        'yh_plaza_patron_prefill_region_id',
        clean(region?.id),
      )
    } catch {}

    onWorkspaceOpen?.('plazas-patron')
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-regions-react-workspace"
      data-yh-dashboard-react-surface={
        workspaceKey ===
        'plazas-atlas'
          ? 'plazas-atlas'
          : 'plazas-regions'
      }
    >
      <div className="yh-plaza-regions-react-scroll">
        <div className="yh-plaza-regions-react-shell">
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                {view ===
                'atlas'
                  ? 'Plazas / Atlas'
                  : 'Plazas / Regions'}
              </span>

              <h1>
                {view ===
                'atlas'
                  ? 'Plaza Atlas'
                  : 'Regional Hubs'}
              </h1>

              <p>
                {view ===
                'atlas'
                  ? 'Visualize the official Plaza topology, countries, networks and Patron coverage.'
                  : 'Organize movement locally through regional hubs, country clusters and approved Plaza leadership.'}
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadRegions({
                  refresh:
                    true,
                })
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          <div className="yh-plaza-regions-view-tabs">
            <button
              type="button"
              className={
                view ===
                'overview'
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                setView(
                  'overview',
                )
              }
            >
              Regions
            </button>

            <button
              type="button"
              className={
                view ===
                'atlas'
                  ? 'is-active'
                  : ''
              }
              onClick={() =>
                setView(
                  'atlas',
                )
              }
            >
              Atlas
            </button>
          </div>

          <section className="yh-plaza-region-summary">
            <article>
              <small>
                Plazas
              </small>

              <strong>
                {regions.length}
              </strong>
            </article>

            <article>
              <small>
                Countries
              </small>

              <strong>
                {totalCountries}
              </strong>
            </article>

            <article>
              <small>
                Active Patrons
              </small>

              <strong>
                {activePatrons}
              </strong>
            </article>
          </section>

          {view ===
            'overview' && (
            <form
              className="yh-plaza-region-composer"
              onSubmit={
                submitRegion
              }
            >
              <div className="yh-plaza-region-form-grid">
                <label>
                  <span>
                    Region
                  </span>

                  <input
                    className="input-field"
                    maxLength={100}
                    required
                    value={
                      form.region
                    }
                    placeholder="Lagos, Dubai, London, Manila..."
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          region:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Hub Label
                  </span>

                  <input
                    className="input-field"
                    maxLength={100}
                    value={
                      form.label
                    }
                    placeholder="Region Hub, Builder Hub, Connector Hub..."
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          label:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>

                <label className="is-wide">
                  <span>
                    Description
                  </span>

                  <textarea
                    className="input-field"
                    rows="4"
                    maxLength={900}
                    required
                    value={
                      form.text
                    }
                    placeholder="Describe what this region is for, who should join, and what kind of local movement happens here."
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          text:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              <div className="yh-plaza-region-form-actions">
                <small>
                  Regional hubs
                  organize local
                  movement, trusted
                  connectors and
                  real-world
                  clustering.
                </small>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    creating
                  }
                >
                  {creating
                    ? 'Creating...'
                    : 'Create Region Hub'}
                </button>
              </div>
            </form>
          )}

          {loading && (
            <div className="yh-plaza-react-state">
              Loading Plaza
              regions...
            </div>
          )}

          {error &&
            !loading && (
              <div className="yh-plaza-react-state is-error">
                {error}
              </div>
            )}

          {!loading &&
            !regions.length && (
              <div className="yh-plaza-react-state">
                No Plaza topology
                data is available.
              </div>
            )}

          {!loading &&
            view ===
              'overview' && (
              <div className="yh-plaza-region-grid-react">
                {regions.map(
                  (region) => (
                    <article
                      className="yh-plaza-region-card-react"
                      key={
                        region.id
                      }
                    >
                      <div className="yh-plaza-region-card-head-react">
                        <span>
                          {
                            region.label
                          }
                        </span>

                        <span>
                          {region
                            .countries
                            .length
                            ? `${region.countries.length} countries`
                            : `${region.count} members`}
                        </span>
                      </div>

                      <RegionTopology
                        region={
                          region
                        }
                      />

                      <h3>
                        {
                          region.region
                        }
                      </h3>

                      <p>
                        {region.text ||
                          'Official Plaza regional hub.'}
                      </p>

                      {region
                        .countries
                        .length >
                        0 && (
                        <div className="yh-plaza-region-country-block">
                          <small>
                            {
                              region
                                .countries
                                .length
                            }{' '}
                            Countries
                          </small>

                          <p>
                            {region.countries.join(
                              ', ',
                            )}
                          </p>
                        </div>
                      )}

                      <div className="yh-plaza-region-patron">
                        <small>
                          Patron / Leader
                        </small>

                        <strong>
                          {isPatronActive(
                            region,
                          )
                            ? region.patronName
                            : 'Open for approved applicant'}
                        </strong>
                      </div>

                      <div className="yh-plaza-region-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            setSelectedRegion(
                              region,
                            )
                          }
                        >
                          Enter Region Hub
                        </button>

                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() =>
                            openPatron(
                              region,
                            )
                          }
                        >
                          Apply as Patron
                        </button>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}

          {!loading &&
            view ===
              'atlas' && (
              <div className="yh-plaza-atlas-grid-react">
                {regions.map(
                  (region) => (
                    <article
                      className="yh-plaza-atlas-card-react"
                      key={
                        region.id
                      }
                    >
                      <RegionTopology
                        region={
                          region
                        }
                      />

                      <div className="yh-plaza-atlas-card-body-react">
                        <div className="yh-plaza-region-card-head-react">
                          <span>
                            {
                              region.label
                            }
                          </span>

                          <span>
                            {
                              region
                                .countries
                                .length
                            }{' '}
                            countries
                          </span>
                        </div>

                        <h3>
                          {
                            region.region
                          }
                        </h3>

                        <p>
                          {region.text ||
                            'Official Plaza topology layer.'}
                        </p>

                        <div className="yh-plaza-region-patron">
                          <small>
                            Patron / Leader
                          </small>

                          <strong>
                            {isPatronActive(
                              region,
                            )
                              ? region.patronName
                              : 'Open for approved applicant'}
                          </strong>
                        </div>

                        <div className="yh-plaza-region-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                              setSelectedRegion(
                                region,
                              )
                            }
                          >
                            Open Hub
                          </button>

                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() =>
                              openPatron(
                                region,
                              )
                            }
                          >
                            Apply as Patron
                          </button>
                        </div>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}

          {hasMore &&
            nextCursor && (
              <div className="yh-plaza-feed-react-load-more">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={
                    loadingMore
                  }
                  onClick={() =>
                    void loadRegions({
                      append:
                        true,

                      cursor:
                        nextCursor,
                    })
                  }
                >
                  {loadingMore
                    ? 'Loading...'
                    : 'Load More'}
                </button>
              </div>
            )}
        </div>
      </div>

      {selectedRegion && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedRegion(
                null,
              )
            }
          }}
        >
          <div className="modal-content yh-plaza-region-modal">
            <span className="yh-plaza-react-kicker">
              {selectedRegion.network ||
                selectedRegion.continent ||
                'YH Plaza'}
            </span>

            <h2>
              {
                selectedRegion.region
              }
            </h2>

            <RegionTopology
              region={
                selectedRegion
              }
            />

            <p>
              {selectedRegion.text ||
                'Official Plaza regional hub.'}
            </p>

            <div className="yh-plaza-region-modal-meta">
              <div>
                <small>
                  Countries
                </small>

                <strong>
                  {
                    selectedRegion
                      .countries
                      .length
                  }
                </strong>
              </div>

              <div>
                <small>
                  Patron / Leader
                </small>

                <strong>
                  {isPatronActive(
                    selectedRegion,
                  )
                    ? selectedRegion.patronName
                    : 'Open'}
                </strong>
              </div>
            </div>

            {selectedRegion
              .countries
              .length >
              0 && (
              <div className="yh-plaza-region-country-block">
                <small>
                  Country Coverage
                </small>

                <p>
                  {selectedRegion.countries.join(
                    ', ',
                  )}
                </p>
              </div>
            )}

            <div className="roadmap-mission-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={
                  regionActionBusy ===
                  'chat:' +
                    selectedRegion.id
                }
                onClick={() =>
                  void openRegionChat(
                    selectedRegion,
                  )
                }
              >
                {regionActionBusy ===
                'chat:' +
                  selectedRegion.id
                  ? 'Opening...'
                  : 'Open Plaza Chat'}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  openMeetup(
                    selectedRegion,
                  )

                  setSelectedRegion(
                    null,
                  )
                }}
              >
                Plan Meetup
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  openRegionalRequest(
                    selectedRegion,
                  )
                }
              >
                Request Regional Connection
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  openPatron(
                    selectedRegion,
                  )

                  setSelectedRegion(
                    null,
                  )
                }}
              >
                Apply as Patron
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setSelectedRegion(
                    null,
                  )
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
