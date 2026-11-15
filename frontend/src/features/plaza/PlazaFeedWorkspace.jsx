import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import {
  createPlazaNotification,
} from './plazaNotifications'
import {
  readPlazaUiState,
  updatePlazaUiState,
} from './plazaUiState'
import './PlazaFeedWorkspace.css'

const FEED_FILTERS = [
  ['all', 'All'],
  ['introduction', 'Introductions'],
  ['opportunity', 'Opportunities'],
  ['project', 'Projects'],
  ['win', 'Wins'],
]

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

  return `plaza_feed_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

function normalizeFeedItem(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `plaza-feed-${index}`,

    type:
      clean(item.type) ||
      'introduction',

    userId:
      clean(
        item.userId ||
          item.authorId ||
          item.createdByUserId,
      ),

    authorName:
      clean(
        item.authorName ||
          item.member,
      ) ||
      'Plaza Member',

    authorAvatar:
      clean(
        item.authorAvatar ||
          item.avatar ||
          item.profilePhoto ||
          item.photoURL,
      ),

    member:
      clean(
        item.member ||
          item.authorName,
      ) ||
      'Plaza Member',

    source:
      clean(item.source) ||
      'plaza',

    division:
      clean(item.division) ||
      'both',

    region:
      clean(item.region) ||
      'Global',

    title:
      clean(item.title) ||
      'Plaza update',

    text:
      clean(
        item.text ||
          item.body,
      ),

    tag:
      clean(item.tag) ||
      clean(item.type) ||
      'Introduction',

    action:
      clean(item.action) ||
      'Open',
  }
}

function mergeFeed(
  current = [],
  incoming = [],
) {
  const map = new Map()

  ;[
    ...current,
    ...incoming,
  ].forEach((item) => {
    const normalized =
      normalizeFeedItem(item)

    if (!normalized.id) {
      return
    }

    map.set(
      normalized.id,
      normalized,
    )
  })

  return Array.from(
    map.values(),
  )
}

function formatType(value = '') {
  const text =
    clean(value)
      .replace(/[-_]+/g, ' ')

  return text
    ? text
        .replace(
          /\b\w/g,
          (char) =>
            char.toUpperCase(),
        )
    : 'Signal'
}

function normalizeUniverseProfile(
  payload = {},
) {
  const profile =
    payload?.profile &&
    typeof payload.profile ===
      'object'
      ? payload.profile
      : payload

  return {
    ...profile,

    targetUid:
      clean(
        profile.targetUid ||
          profile.uid ||
          profile.id,
      ),

    fullName:
      clean(
        profile.fullName ||
          profile.displayName,
      ) ||
      'YH Member',

    username:
      clean(
        profile.username,
      ),

    avatar:
      clean(
        profile.avatar ||
          profile.profilePhoto ||
          profile.photoURL,
      ),

    coverPhoto:
      clean(
        profile.coverPhoto,
      ),

    bio:
      clean(
        profile.bio,
      ),

    city:
      clean(
        profile.city,
      ),

    country:
      clean(
        profile.country,
      ),

    trustTier:
      clean(
        profile.trustTier,
      ),

    signals:
      profile.signals &&
      typeof profile.signals ===
        'object'
        ? profile.signals
        : {},
  }
}

function readLocalArray(
  key,
) {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          key,
        ) || '[]',
      )

    return Array.isArray(
      parsed,
    )
      ? parsed
      : []
  } catch {
    return []
  }
}

function writeLocalArray(
  key,
  value,
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        value,
      ),
    )
  } catch {}
}

export default function PlazaFeedWorkspace({
  onToast,
  onWorkspaceOpen,
  composerOnly = false,
  onPosted,
}) {
  const requestIdRef =
    useRef('')

  const [
    items,
    setItems,
  ] = useState([])

  const [
    filter,
    setFilter,
  ] = useState(
    () =>
      clean(
        readPlazaUiState()
          .feedFilter,
      ) || 'all',
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
    loadingMore,
    setLoadingMore,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    nextCursor,
    setNextCursor,
  ] = useState('')

  const [
    hasMore,
    setHasMore,
  ] = useState(false)

  const [
    posting,
    setPosting,
  ] = useState(false)

  const [
    profile,
    setProfile,
  ] = useState(null)

  const [
    profileFallback,
    setProfileFallback,
  ] = useState(null)

  const [
    profileLoading,
    setProfileLoading,
  ] = useState(false)

  const [
    supportTarget,
    setSupportTarget,
  ] = useState(null)

  const [
    supportBusy,
    setSupportBusy,
  ] = useState(false)

  const [
    supportForm,
    setSupportForm,
  ] = useState({
    name: '',
    message: '',
  })

  const [
    form,
    setForm,
  ] = useState({
    type:
      'introduction',
    region: '',
    title: '',
    text: '',
  })

  const loadFeed =
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
              limit: '60',
            })

          if (clean(cursor)) {
            params.set(
              'cursor',
              clean(cursor),
            )
          }

          const result =
            await apiFetch(
              `/api/plaza/feed?${params.toString()}`,
              {
                method: 'GET',
                cache:
                  'no-store',
              },
            )

          const incoming =
            safeArray(
              result?.feed,
            ).map(
              normalizeFeedItem,
            )

          setItems(
            (current) =>
              append
                ? mergeFeed(
                    current,
                    incoming,
                  )
                : incoming,
          )

          const cursorValue =
            clean(
              result?.nextCursor ||
                result?.next_cursor ||
                '',
            )

          setNextCursor(
            cursorValue,
          )

          setHasMore(
            result?.hasMore ===
              true &&
              Boolean(
                cursorValue,
              ),
          )
        } catch (
          loadError
        ) {
          const message =
            loadError?.message ||
            'Could not load Plaza feed. Please refresh.'

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
    if (composerOnly === false) void loadFeed()
  }, [loadFeed, composerOnly])

  const visibleItems =
    useMemo(() => {
      if (
        filter === 'all'
      ) {
        return items
      }

      return items.filter(
        (item) =>
          clean(
            item.type,
          ).toLowerCase() ===
          filter,
      )
    }, [
      filter,
      items,
    ])

  const openProfile =
    async (item) => {
      const targetUserId =
        clean(
          item.userId ||
            item.authorId ||
            item.createdByUserId,
        )

      if (!targetUserId) {
        onToast?.(
          'This Plaza signal has no linked member profile.',
          'error',
        )
        return
      }

      setProfileFallback(
        item,
      )

      setProfile({
        fullName:
          item.authorName ||
          item.member,
      })

      setProfileLoading(
        true,
      )

      try {
        const result =
          await apiFetch(
            `/api/universe/profile/${encodeURIComponent(
              targetUserId,
            )}`,
            {
              method: 'GET',
              cache: 'no-store',
            },
          )

        setProfile(
          normalizeUniverseProfile(
            result,
          ),
        )
      } catch (
        profileError
      ) {
        onToast?.(
          profileError?.message ||
            'Could not load this member profile.',
          'error',
        )

        setProfile(null)
      } finally {
        setProfileLoading(
          false,
        )
      }
    }

  const openRequestFromFeed =
    (
      item,
      config = {},
    ) => {
      try {
        sessionStorage.setItem(
          'yh_plaza_request_prefill',
          JSON.stringify({
            objective:
              config.objective ||
              'Connection request',

            sourceType:
              config.sourceType ||
              'general',

            targetId:
              clean(item.id),

            targetLabel:
              config.targetLabel ||
              item.title ||
              item.member,

            region:
              item.region ||
              'Global',

            context:
              config.context ||
              item.title ||
              item.text,

            message:
              config.message ||
              item.text ||
              '',
          }),
        )
      } catch {}

      onWorkspaceOpen?.(
        'plazas-requests',
      )
    }

  const openFeedAction =
    (item) => {
      const type =
        clean(
          item.type,
        ).toLowerCase()

      if (
        type ===
        'introduction'
      ) {
        openRequestFromFeed(
          item,
          {
            objective:
              'Introduction',

            sourceType:
              'feed-introduction',

            targetLabel:
              item.member ||
              item.authorName,

            context:
              item.title,

            message:
              `I saw your Plaza introduction and would like to open a structured connection around ${item.region || 'Global'}.`,
          },
        )

        return
      }

      if (
        type ===
        'opportunity'
      ) {
        try {
          sessionStorage.setItem(
            'yh_plaza_opportunity_briefing',
            JSON.stringify(
              item,
            ),
          )
        } catch {}

        onWorkspaceOpen?.(
          'plazas-opportunities',
        )

        return
      }

      if (
        type ===
        'project'
      ) {
        openRequestFromFeed(
          item,
          {
            objective:
              'Project request',

            sourceType:
              'project',

            targetLabel:
              item.title,

            context:
              item.title,

            message:
              `I want to open a structured Plaza request for this project: ${item.title}.`,
          },
        )

        return
      }

      if (
        type ===
        'win'
      ) {
        setSupportTarget(
          item,
        )

        setSupportForm({
          name: '',
          message: '',
        })

        return
      }

      onToast?.(
        'This Plaza signal has no additional action.',
        'error',
      )
    }

  const submitSupport =
    async (event) => {
      event.preventDefault()

      if (
        !supportTarget ||
        supportBusy
      ) {
        return
      }

      const name =
        clean(
          supportForm.name,
        )

      const message =
        clean(
          supportForm.message,
        )

      if (
        !name ||
        !message
      ) {
        onToast?.(
          'Add your name and support message first.',
          'error',
        )
        return
      }

      setSupportBusy(true)

      try {
        const now =
          new Date()
            .toISOString()

        const member =
          clean(
            supportTarget.member ||
              supportTarget.authorName,
          ) ||
          'Plaza Member'

        const item = {
          id:
            `incoming-${Date.now()}`,

          kind:
            'support-note',

          queueRole:
            'personal',

          title:
            `Support note for ${member}`,

          summary:
            message,

          senderName:
            name,

          targetLabel:
            member,

          sourceType:
            'support-note',

          objective:
            'Support',

          context:
            'Plaza win',

          routeLabel:
            'Support note delivery',

          status:
            'New',

          attachments: [],

          createdAt:
            now,

          updatedAt:
            now,
        }

        const inbox =
          readLocalArray(
            'yhPlazaInboxCleanV1',
          )

        writeLocalArray(
          'yhPlazaInboxCleanV1',
          [
            item,
            ...inbox,
          ],
        )

        setSupportTarget(
          null,
        )

        setSupportForm({
          name: '',
          message: '',
        })


        /* PLAZA_SUPPORT_NOTE_NOTIFICATION */
        createPlazaNotification({
          title:
            `Support note from ${
              item.senderName ||
              'Plaza member'
            }`,

          text:
            `A support note was delivered to ${
              item.targetLabel ||
              'a Plaza member'
            }.`,

          audienceRole:
            'personal',

          relatedType:
            'inbox',

          relatedId:
            item.id,
        })

onToast?.(
          `Support note sent to ${member}.`,
          'success',
        )
      } finally {
        setSupportBusy(
          false,
        )
      }
    }

  const updateField =
    (field, value) => {
      setForm(
        (current) => ({
          ...current,
          [field]: value,
        }),
      )
    }

  const submitSignal =
    async (event) => {
      event.preventDefault()

      if (posting) {
        return
      }

      const payload = {
        type:
          clean(
            form.type,
          ) ||
          'introduction',

        region:
          clean(
            form.region,
          ) ||
          'Global',

        title:
          clean(
            form.title,
          ),

        text:
          clean(
            form.text,
          ),
      }

      if (!payload.text) {
        onToast?.(
          'Write a Plaza signal first.',
          'error',
        )

        return
      }

      if (
        !requestIdRef.current
      ) {
        requestIdRef.current =
          createClientId()
      }

      setPosting(true)

      try {
        const result =
          await apiFetch(
            '/api/plaza/feed/posts',
            {
              method: 'POST',

              body:
                JSON.stringify({
                  ...payload,

                  clientCreateId:
                    requestIdRef.current,
                }),
            },
          )

        const post =
          result?.post
            ? normalizeFeedItem(
                result.post,
              )
            : null

        if (!post) {
          throw new Error(
            'Plaza feed response was incomplete. Retry the same submission.',
          )
        }

        if (
          result?.published ===
          true
        ) {
          setItems(
            (current) => [
              post,
              ...current.filter(
                (item) =>
                  item.id !==
                  post.id,
              ),
            ],
          )

          setFilter('all')

          updatePlazaUiState({
            feedFilter:
              'all',
          })
        }

        setForm({
          type:
            'introduction',
          region: '',
          title: '',
          text: '',
        })

        requestIdRef.current =
          ''

        onToast?.(
          result?.published ===
          true
            ? 'Plaza signal posted.'
            : 'Plaza signal submitted for admin review.',
          'success',
        )
        onPosted?.()
      } catch (
        postError
      ) {
        onToast?.(
          postError?.message ||
            'Could not post Plaza signal.',
          'error',
        )
      } finally {
        setPosting(false)
      }
    }

  const composer = (
          <form
            className="yh-plaza-feed-react-composer"
            onSubmit={
              submitSignal
            }
          >
            <div className="yh-plaza-feed-react-composer-grid">
              <label>
                <span>
                  Feed type
                </span>

                <select
                  className="input-field"
                  value={
                    form.type
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'type',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="introduction">
                    Introduction
                  </option>

                  <option value="opportunity">
                    Opportunity
                  </option>

                  <option value="project">
                    Project
                  </option>

                  <option value="win">
                    Win
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Region
                </span>

                <input
                  className="input-field"
                  value={
                    form.region
                  }
                  placeholder="Global, Lagos, London, Dubai..."
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
                  maxLength={120}
                  value={
                    form.title
                  }
                  placeholder="Short Plaza signal title"
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
                  Signal
                </span>

                <textarea
                  className="input-field"
                  rows="4"
                  maxLength={1200}
                  required
                  value={
                    form.text
                  }
                  placeholder="Share an intro, opportunity, project, or win for Plaza."
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

            <div className="yh-plaza-feed-react-composer-actions">
              <small>
                Signal board only.
                Plaza surfaces
                introductions,
                opportunities,
                projects and wins.
              </small>

              <button
                type="submit"
                className="yh-plaza-feed-react-post-button"
                disabled={
                  posting
                }
              >
                {posting
                  ? 'Posting...'
                  : 'Post Signal'}
              </button>
            </div>
          </form>
  )

  if (composerOnly) {
    return (
      <section className="yh-plaza-feed-react-workspace">
        {composer}
      </section>
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-feed-react-workspace"
      data-yh-dashboard-react-surface="plazas-feed"
    >
      <div className="yh-plaza-feed-react-scroll">
        <div className="yh-plaza-feed-react-shell">
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Plazas / Feed
              </span>

              <h1>
                Plaza Feed
              </h1>

              <p>
                Network movement,
                introductions,
                opportunities,
                projects and wins
                across the Plazas.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadFeed({
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

          {composer}

          <div className="yh-plaza-feed-react-filter-row">
            {FEED_FILTERS.map(
              ([
                key,
                label,
              ]) => (
                <button
                  type="button"
                  key={key}
                  className={
                    filter ===
                    key
                      ? 'is-active'
                      : ''
                  }
                  onClick={() => {
                    setFilter(
                      key,
                    )

                    updatePlazaUiState({
                      feedFilter:
                        key,
                    })
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          {loading && (
            <div className="yh-plaza-react-state">
              Loading Plaza
              feed...
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
            !visibleItems.length && (
              <div className="yh-plaza-react-state">
                No Plaza feed
                activity yet.
              </div>
            )}

          <div className="yh-plaza-feed-react-grid">
            {visibleItems.map(
              (item) => {
                const actionLabel =
                  item.type ===
                  'opportunity'
                    ? 'Open Opportunity Detail'
                    : item.type ===
                        'project'
                      ? 'Open Project Detail'
                      : item.action

                return (
                  <article
                    className="yh-plaza-feed-react-card"
                    key={
                      item.id
                    }
                  >
                    <div className="yh-plaza-feed-react-card-head">
                      <div>
                        <span>
                          {formatType(
                            item.tag ||
                              item.type,
                          )}
                        </span>

                        <span>
                          {formatType(
                            item.source,
                          )}
                        </span>
                      </div>

                      <small>
                        {
                          item.region
                        }
                      </small>
                    </div>

                    <div className="yh-plaza-feed-react-author">
                      <div className="yh-plaza-feed-react-avatar">
                        {item.authorAvatar ? (
                          <img
                            src={
                              item.authorAvatar
                            }
                            alt=""
                          />
                        ) : (
                          <span>
                            {item.authorName
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div>
                        <strong>
                          {
                            item.authorName
                          }
                        </strong>

                        <small>
                          {formatType(
                            item.division,
                          )}
                        </small>
                      </div>
                    </div>

                    <h3>
                      {item.title}
                    </h3>

                    <p>
                      {item.text ||
                        'No signal details provided.'}
                    </p>

                    <div className="yh-plaza-feed-react-meta">
                      <span>
                        {
                          item.member
                        }
                      </span>

                      <span>
                        {
                          item.region
                        }
                      </span>

                      <span>
                        {formatType(
                          item.division,
                        )}
                      </span>
                    </div>

                    <div className="yh-plaza-feed-react-card-actions">
                      {item.userId && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            void openProfile(
                              item,
                            )
                          }
                        >
                          View Profile
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          openFeedAction(
                            item,
                          )
                        }
                      >
                        {
                          actionLabel
                        }
                      </button>
                    </div>
                  </article>
                )
              },
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
                    void loadFeed({
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

      {(profile ||
        profileLoading) && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !profileLoading
            ) {
              setProfile(null)
              setProfileFallback(
                null,
              )
            }
          }}
        >
          <div className="modal-content yh-plaza-directory-profile-modal">
            {profileLoading ? (
              <div className="yh-plaza-react-state">
                Loading unified YH
                Universe profile...
              </div>
            ) : (
              <>
                <div className="yh-plaza-directory-profile-cover">
                  {profile?.coverPhoto && (
                    <img
                      src={
                        profile.coverPhoto
                      }
                      alt=""
                    />
                  )}
                </div>

                <div className="yh-plaza-directory-profile-head">
                  <div className="yh-plaza-directory-profile-avatar">
                    {profile?.avatar ? (
                      <img
                        src={
                          profile.avatar
                        }
                        alt=""
                      />
                    ) : (
                      <span>
                        {clean(
                          profile?.fullName ||
                            profileFallback
                              ?.authorName ||
                            'Y',
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div>
                    <h2>
                      {profile?.fullName ||
                        profileFallback
                          ?.authorName ||
                        'YH Member'}
                    </h2>

                    <p>
                      {profile?.username
                        ? `@${profile.username}`
                        : profile?.trustTier ||
                          'YH Universe Member'}
                    </p>
                  </div>
                </div>

                <p>
                  {profile?.bio ||
                    profileFallback
                      ?.text ||
                    'No profile bio added yet.'}
                </p>

                <div className="yh-plaza-directory-chips">
                  {[
                    profile?.city,
                    profile?.country,
                    profile?.trustTier,
                    profile?.signals
                      ?.availability,
                    profile?.signals
                      ?.workMode,
                  ]
                    .filter(Boolean)
                    .map(
                      (entry) => (
                        <span
                          key={
                            entry
                          }
                        >
                          {entry}
                        </span>
                      ),
                    )}
                </div>

                <div className="roadmap-mission-actions">
                  {profileFallback && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        const target =
                          profileFallback

                        setProfile(null)
                        setProfileFallback(
                          null,
                        )

                        openRequestFromFeed(
                          target,
                          {
                            objective:
                              'Connection request',

                            sourceType:
                              'member-connection',

                            targetLabel:
                              target.authorName ||
                              target.member,

                            context:
                              target.title,

                            message:
                              `I found ${target.authorName || target.member} through Plaza activity and want to open a structured connection.`,
                          },
                        )
                      }}
                    >
                      Request Connection
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setProfile(null)
                      setProfileFallback(
                        null,
                      )
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {supportTarget && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <form
            className="modal-content"
            onSubmit={
              submitSupport
            }
          >
            <span className="yh-plaza-react-kicker">
              Plaza Win
            </span>

            <h2>
              Send support to{' '}
              {supportTarget.member ||
                supportTarget.authorName}
            </h2>

            <p>
              Keep Plaza useful.
              Celebrate real
              execution with a
              short structured
              note.
            </p>

            <label className="form-group">
              <span>
                Your name
              </span>

              <input
                className="input-field"
                required
                value={
                  supportForm.name
                }
                placeholder="Your name"
                onChange={(
                  event,
                ) =>
                  setSupportForm(
                    (current) => ({
                      ...current,
                      name:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <label className="form-group">
              <span>
                Message
              </span>

              <textarea
                className="input-field"
                rows="4"
                required
                value={
                  supportForm.message
                }
                placeholder="Short congratulatory note"
                onChange={(
                  event,
                ) =>
                  setSupportForm(
                    (current) => ({
                      ...current,
                      message:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </label>

            <div className="roadmap-mission-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  supportBusy
                }
                onClick={() =>
                  setSupportTarget(
                    null,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={
                  supportBusy
                }
              >
                {supportBusy
                  ? 'Sending...'
                  : 'Send Support'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
