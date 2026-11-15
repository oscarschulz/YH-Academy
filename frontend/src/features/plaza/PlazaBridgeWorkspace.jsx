import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import './PlazaBridgeWorkspace.css'

const EMPTY_FORM = {
  stage: '',
  left: 'academy',
  right: 'plaza',
  region: '',
  title: '',
  nextStep: '',
  text: '',
}

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

  return `plaza_bridge_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function normalizeBridge(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `server-bridge-${index + 1}`,

    clientCreateId:
      clean(item.clientCreateId),

    stage:
      clean(item.stage) ||
      'Bridge Path',

    left:
      clean(
        item.left ||
          item.origin,
      ) ||
      'academy',

    right:
      clean(
        item.right ||
          item.destination,
      ) ||
      'federation',

    region:
      clean(item.region) ||
      'Global',

    title:
      clean(item.title) ||
      'Bridge signal',

    text:
      clean(
        item.text ||
          item.description,
      ),

    nextStep:
      clean(item.nextStep) ||
      'Review and decide the next structured move.',

    action:
      clean(item.action) ||
      'Open Bridge Detail',
  }
}

function laneLabel(value = '') {
  const lane =
    clean(value).toLowerCase()

  if (lane === 'academy') {
    return 'Academy'
  }

  if (lane === 'federation') {
    return 'Federation'
  }

  if (lane === 'both') {
    return 'Cross-Division'
  }

  return 'Plaza'
}

export default function PlazaBridgeWorkspace({
  onToast,
  onWorkspaceOpen,
}) {
  const createIdRef =
    useRef('')

  const [
    items,
    setItems,
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
    posting,
    setPosting,
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
    form,
    setForm,
  ] = useState(
    EMPTY_FORM,
  )

  const [
    selected,
    setSelected,
  ] = useState(null)

  const loadBridge =
    useCallback(
      async ({
        refresh = false,
        append = false,
        cursor = '',
      } = {}) => {
        if (append) {
          setLoadingMore(true)
        } else if (refresh) {
          setRefreshing(true)
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
              `/api/plaza/bridge?${params.toString()}`,
              {
                method: 'GET',
                cache: 'no-store',
              },
            )

          const incoming =
            safeArray(
              result?.bridge,
            ).map(
              normalizeBridge,
            )

          setItems(
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
            'Could not load Plazas bridge paths. Please refresh.'

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
    void loadBridge()
  }, [loadBridge])

  const updateField =
    (
      field,
      value,
    ) => {
      setForm(
        (current) => ({
          ...current,
          [field]: value,
        }),
      )
    }

  const submitBridge =
    async (event) => {
      event.preventDefault()

      if (posting) return

      const payload = {
        stage:
          clean(
            form.stage,
          ) ||
          'Bridge Path',

        left:
          clean(
            form.left,
          ) ||
          'academy',

        right:
          clean(
            form.right,
          ) ||
          'plaza',

        region:
          clean(
            form.region,
          ) ||
          'Global',

        title:
          clean(
            form.title,
          ),

        nextStep:
          clean(
            form.nextStep,
          ) ||
          'Review and decide the next structured move.',

        text:
          clean(
            form.text,
          ),
      }

      if (!payload.title) {
        onToast?.(
          'Add a bridge path title first.',
          'error',
        )
        return
      }

      if (!payload.text) {
        onToast?.(
          'Describe the bridge path first.',
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

      setPosting(true)

      try {
        const result =
          await apiFetch(
            '/api/plaza/bridge',
            {
              method: 'POST',

              body:
                JSON.stringify({
                  ...payload,

                  clientCreateId:
                    createIdRef.current,
                }),
            },
          )

        const raw =
          result?.bridge ||
          result?.bridgePath ||
          null

        const bridgePath =
          raw
            ? normalizeBridge(
                raw,
              )
            : null

        if (!bridgePath) {
          throw new Error(
            'Plaza bridge response was incomplete. Retry the same submission.',
          )
        }

        if (
          result?.published ===
          true
        ) {
          setItems(
            (current) => [
              bridgePath,

              ...current.filter(
                (item) =>
                  item.id !==
                  bridgePath.id,
              ),
            ],
          )
        }

        createIdRef.current =
          ''

        setForm(
          EMPTY_FORM,
        )

        onToast?.(
          result?.published ===
          true
            ? 'Bridge path created.'
            : 'Bridge path submitted for review.',
          'success',
        )
      } catch (
        postError
      ) {
        onToast?.(
          postError?.message ||
            'Could not create Plaza bridge path.',
          'error',
        )
      } finally {
        setPosting(false)
      }
    }

  const requestBridge =
    (item) => {
      try {
        sessionStorage.setItem(
          'yh_plaza_request_prefill',
          JSON.stringify({
            objective:
              'Bridge request',

            sourceType:
              'bridge',

            targetId:
              item.id,

            targetLabel:
              item.title,

            region:
              item.region,

            context:
              `${laneLabel(
                item.left,
              )} → ${laneLabel(
                item.right,
              )} • ${item.stage}`,

            message:
              `I want to pursue this Plaza bridge path: ${item.title}. Next step: ${item.nextStep}`,
          }),
        )
      } catch {}

      setSelected(null)

      onWorkspaceOpen?.(
        'plazas-requests',
      )
    }

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-bridge-react-workspace"
      data-yh-dashboard-react-surface="plazas-bridge"
    >
      <div className="yh-plaza-bridge-react-scroll">
        <div className="yh-plaza-bridge-react-shell">
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Plazas / Bridge
              </span>

              <h1>
                Plaza Bridge
              </h1>

              <p>
                Track where Academy
                execution, Plaza
                visibility and
                Federation
                relevance begin to
                connect.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadBridge({
                  refresh: true,
                })
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          <form
            className="yh-plaza-bridge-form"
            onSubmit={
              submitBridge
            }
          >
            <div className="yh-plaza-bridge-form-grid">
              <label>
                <span>
                  Stage
                </span>

                <input
                  className="input-field"
                  maxLength={100}
                  value={
                    form.stage
                  }
                  placeholder="Academy Ready, Plaza Visible, Federation Path..."
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'stage',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  From
                </span>

                <select
                  className="input-field"
                  value={
                    form.left
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'left',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="academy">
                    Academy
                  </option>

                  <option value="plaza">
                    Plaza
                  </option>

                  <option value="federation">
                    Federation
                  </option>

                  <option value="both">
                    Cross-Division
                  </option>
                </select>
              </label>

              <label>
                <span>
                  To
                </span>

                <select
                  className="input-field"
                  value={
                    form.right
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'right',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="plaza">
                    Plaza
                  </option>

                  <option value="federation">
                    Federation
                  </option>

                  <option value="academy">
                    Academy
                  </option>

                  <option value="both">
                    Cross-Division
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Region
                </span>

                <input
                  className="input-field"
                  maxLength={100}
                  value={
                    form.region
                  }
                  placeholder="Global, Lagos, Dubai..."
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'region',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Title
                </span>

                <input
                  className="input-field"
                  maxLength={140}
                  required
                  value={
                    form.title
                  }
                  placeholder="Short bridge path title"
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'title',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Next Step
                </span>

                <input
                  className="input-field"
                  maxLength={220}
                  value={
                    form.nextStep
                  }
                  placeholder="What should happen next?"
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'nextStep',
                      event.target
                        .value,
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
                  maxLength={1200}
                  required
                  value={
                    form.text
                  }
                  placeholder="Describe how this bridge connects Academy execution, Plaza visibility, and Federation relevance."
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'text',
                      event.target
                        .value,
                    )
                  }
                />
              </label>
            </div>

            <div className="yh-plaza-bridge-form-actions">
              <small>
                Bridge paths turn
                visible execution
                into structured
                routing and
                escalation.
              </small>

              <button
                type="submit"
                className="btn-primary"
                disabled={
                  posting
                }
              >
                {posting
                  ? 'Creating...'
                  : 'Create Bridge Path'}
              </button>
            </div>
          </form>

          {loading && (
            <div className="yh-plaza-react-state">
              Loading Plazas
              bridge paths...
            </div>
          )}

          {error &&
            !loading && (
              <div className="yh-plaza-react-state is-error">
                {error}
              </div>
            )}

          {!loading &&
            !error &&
            !items.length && (
              <div className="yh-plaza-react-state">
                No Plaza bridge
                paths are visible
                yet.
              </div>
            )}

          <div className="yh-plaza-bridge-grid-react">
            {items.map(
              (item) => (
                <article
                  className="yh-plaza-bridge-card-react"
                  key={
                    item.id
                  }
                >
                  <div className="yh-plaza-bridge-card-top">
                    <span>
                      {
                        item.stage
                      }
                    </span>

                    <span>
                      {
                        item.region
                      }
                    </span>
                  </div>

                  <div className="yh-plaza-bridge-lanes">
                    <strong>
                      {laneLabel(
                        item.left,
                      )}
                    </strong>

                    <b>
                      →
                    </b>

                    <strong>
                      {laneLabel(
                        item.right,
                      )}
                    </strong>
                  </div>

                  <h3>
                    {item.title}
                  </h3>

                  <p>
                    {item.text ||
                      'No bridge description added yet.'}
                  </p>

                  <div className="yh-plaza-bridge-next">
                    <small>
                      Next Step
                    </small>

                    <strong>
                      {
                        item.nextStep
                      }
                    </strong>
                  </div>

                  <div className="yh-plaza-bridge-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setSelected(
                          item,
                        )
                      }
                    >
                      Open Bridge Detail
                    </button>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        requestBridge(
                          item,
                        )
                      }
                    >
                      Request Bridge Path
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>

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
                    void loadBridge({
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

      {selected && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content yh-plaza-bridge-detail-modal">
            <span className="yh-plaza-react-kicker">
              {
                selected.stage
              }
            </span>

            <h2>
              {
                selected.title
              }
            </h2>

            <div className="yh-plaza-bridge-lanes is-large">
              <strong>
                {laneLabel(
                  selected.left,
                )}
              </strong>

              <b>
                →
              </b>

              <strong>
                {laneLabel(
                  selected.right,
                )}
              </strong>
            </div>

            <p>
              {selected.text}
            </p>

            <div className="yh-plaza-bridge-next">
              <small>
                Next Step
              </small>

              <strong>
                {
                  selected.nextStep
                }
              </strong>
            </div>

            <div className="roadmap-mission-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  requestBridge(
                    selected,
                  )
                }
              >
                Create Bridge Request
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setSelected(
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
