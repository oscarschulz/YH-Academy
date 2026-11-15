import {
  useEffect,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'

function clean(value = '') {
  return String(value || '').trim()
}

function normalizeText(value = '') {
  return clean(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getMemberId(member = {}) {
  return clean(
    member.userId ||
      member.firebaseUid ||
      member.uid ||
      member.id ||
      '',
  )
}

function normalizeMember(
  member = {},
  academyMeta = {},
) {
  const id =
    getMemberId(member) ||
    getMemberId(academyMeta)

  const division =
    clean(
      member.division ||
        academyMeta.division ||
        'academy',
    ).toLowerCase()

  const displayName =
    clean(
      member.name ||
        member.display_name ||
        member.displayName ||
        member.fullName ||
        member.full_name ||
        academyMeta.display_name ||
        academyMeta.displayName ||
        academyMeta.fullName ||
        academyMeta.full_name ||
        member.username ||
        academyMeta.username ||
        'YH Member',
    ) || 'YH Member'

  const username =
    clean(
      member.username ||
        academyMeta.username ||
        '',
    ).replace(/^@+/, '')

  const avatar =
    clean(
      member.avatar ||
        member.avatar_url ||
        member.avatarUrl ||
        member.photo_url ||
        member.photoURL ||
        member.profile_photo ||
        member.profilePhoto ||
        academyMeta.avatar ||
        academyMeta.avatar_url ||
        academyMeta.avatarUrl ||
        academyMeta.photo_url ||
        academyMeta.photoURL ||
        academyMeta.profile_photo ||
        academyMeta.profilePhoto ||
        '',
    )

  const roleLabel =
    clean(
      member.role ||
        member.role_label ||
        member.roleLabel ||
        academyMeta.role_label ||
        academyMeta.roleLabel ||
        academyMeta.role ||
        'YH Universe Member',
    ) || 'YH Universe Member'

  const divisionLabel =
    clean(
      member.divisionLabel ||
        member.division_label ||
        academyMeta.divisionLabel ||
        academyMeta.division_label ||
        division ||
        'YH Universe',
    )

  const tags =
    Array.isArray(
      member.search_tags,
    )
      ? member.search_tags
      : Array.isArray(
            member.searchTags,
          )
        ? member.searchTags
        : Array.isArray(
              academyMeta.search_tags,
            )
          ? academyMeta.search_tags
          : Array.isArray(
                academyMeta.searchTags,
              )
            ? academyMeta.searchTags
            : []

  return {
    ...academyMeta,
    ...member,

    id,
    userId: id,
    firebaseUid: id,

    displayName,
    username,
    avatar,
    division,
    divisionLabel,
    roleLabel,

    followersCount:
      Number(
        academyMeta.followers_count ??
          academyMeta.followersCount ??
          member.followers_count ??
          member.followersCount ??
          0,
      ) || 0,

    followedByMe:
      academyMeta.followed_by_me ===
        true ||
      academyMeta.followedByMe ===
        true ||
      member.followed_by_me ===
        true ||
      member.followedByMe ===
        true,

    tags: tags
      .map((tag) =>
        clean(tag).replace(
          /^#/,
          '',
        ),
      )
      .filter(Boolean)
      .slice(0, 3),
  }
}

function matchesIdentity(
  member,
  query,
) {
  const needle =
    normalizeText(query)

  if (!needle) return true

  return [
    member.displayName,
    member.username,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .some((value) =>
      value.includes(needle),
    )
}

function rankMember(
  member,
  query,
) {
  const needle =
    normalizeText(query)

  const name =
    normalizeText(
      member.displayName,
    )

  const username =
    normalizeText(
      member.username,
    )

  if (
    name === needle ||
    username === needle
  ) {
    return 0
  }

  if (
    name.startsWith(needle) ||
    username.startsWith(
      needle,
    )
  ) {
    return 1
  }

  return 2
}

async function requestSearch(
  query,
) {
  const cleanQuery =
    clean(query)

  if (
    cleanQuery.length < 2
  ) {
    return []
  }

  const params =
    new URLSearchParams({
      q: cleanQuery,
      division: 'all',
      limit: '24',
    })

  const isEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      cleanQuery,
    )

  const [
    universeResult,
    academyResult,
  ] =
    await Promise.allSettled([
      apiFetch(
        '/api/plaza/business-members?' +
          params.toString(),
        {
          method: 'GET',
        },
      ),

      isEmail
        ? Promise.resolve({
            members: [],
          })
        : apiFetch(
            '/api/academy/community/members?limit=24&query=' +
              encodeURIComponent(
                cleanQuery,
              ),
            {
              method: 'GET',
            },
          ),
    ])

  const universeMembers =
    universeResult.status ===
      'fulfilled' &&
    Array.isArray(
      universeResult.value
        ?.members,
    )
      ? universeResult.value
          .members
      : []

  const academyMembers =
    academyResult.status ===
      'fulfilled' &&
    Array.isArray(
      academyResult.value
        ?.members,
    )
      ? academyResult.value
          .members
      : []

  if (
    universeResult.status ===
      'rejected' &&
    academyResult.status ===
      'rejected'
  ) {
    throw new Error(
      universeResult.reason
        ?.message ||
        academyResult.reason
          ?.message ||
        'Failed to search YH members.',
    )
  }

  const academyById =
    new Map()

  academyMembers.forEach(
    (member) => {
      const id =
        getMemberId(member)

      if (id) {
        academyById.set(
          id,
          member,
        )
      }
    },
  )

  const seen =
    new Set()

  const merged = []

  universeMembers.forEach(
    (member) => {
      const id =
        getMemberId(member)

      if (
        !id ||
        seen.has(id)
      ) {
        return
      }

      const normalized =
        normalizeMember(
          member,
          academyById.get(
            id,
          ) || {},
        )

      if (
        !matchesIdentity(
          normalized,
          cleanQuery,
        )
      ) {
        return
      }

      seen.add(id)
      merged.push(
        normalized,
      )
    },
  )

  academyMembers.forEach(
    (member) => {
      const id =
        getMemberId(member)

      if (
        !id ||
        seen.has(id)
      ) {
        return
      }

      const normalized =
        normalizeMember(
          {},
          member,
        )

      if (
        !matchesIdentity(
          normalized,
          cleanQuery,
        )
      ) {
        return
      }

      seen.add(id)
      merged.push(
        normalized,
      )
    },
  )

  return merged
    .sort((a, b) => {
      const rankDiff =
        rankMember(
          a,
          cleanQuery,
        ) -
        rankMember(
          b,
          cleanQuery,
        )

      if (rankDiff) {
        return rankDiff
      }

      return a.displayName.localeCompare(
        b.displayName,
      )
    })
    .slice(0, 24)
}

function getCurrentUserId() {
  const keys = [
    'yh_user_id',
    'yh_user_uid',
    'userId',
  ]

  for (const key of keys) {
    try {
      const value =
        clean(
          sessionStorage.getItem(
            key,
          ),
        )

      if (value) {
        return value
      }
    } catch { /* Noncritical browser storage or optional operation. */ }

    try {
      const value =
        clean(
          localStorage.getItem(
            key,
          ),
        )

      if (value) {
        return value
      }
    } catch { /* Noncritical browser storage or optional operation. */ }
  }

  return ''
}

export default function DashboardUniverseSearch({
  onProfileOpen,
  mobile = false,
}) {
  const [query, setQuery] =
    useState('')

  const [results, setResults] =
    useState([])

  const [loading, setLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [open, setOpen] =
    useState(false)

  const hostRef =
    useRef(null)

  const inputRef =
    useRef(null)

  const debounceRef =
    useRef(null)

  const requestRef =
    useRef(0)

  const currentUserId =
    getCurrentUserId()

  useEffect(() => {
    const handleOutside = (
      event,
    ) => {
      if (
        hostRef.current &&
        !hostRef.current.contains(
          event.target,
        )
      ) {
        setOpen(false)
      }
    }

    document.addEventListener(
      'pointerdown',
      handleOutside,
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutside,
      )

      window.clearTimeout(
        debounceRef.current,
      )
    }
  }, [])

  const resizeTextarea = () => {
    const input =
      inputRef.current

    if (!input) return

    input.style.height =
      '38px'

    input.style.height =
      `${Math.max(
        38,
        Math.min(
          input.scrollHeight,
          84,
        ),
      )}px`

    input.style.overflowY =
      'hidden'
  }

  const runSearch = async (
    value,
    immediate = false,
  ) => {
    const cleanQuery =
      clean(value)

    window.clearTimeout(
      debounceRef.current,
    )

    const requestToken =
      ++requestRef.current

    if (!cleanQuery) {
      setResults([])
      setMessage('')
      setLoading(false)
      setOpen(false)
      return
    }

    setOpen(true)

    if (
      cleanQuery.length < 2
    ) {
      setResults([])
      setMessage(
        'Type at least 2 characters to search YH members.',
      )
      setLoading(false)
      return
    }

    setResults([])
    setMessage(
      'Searching members...',
    )
    setLoading(true)

    debounceRef.current =
      window.setTimeout(
        async () => {
          try {
            const members =
              await requestSearch(
                cleanQuery,
              )

            if (
              requestToken !==
              requestRef.current
            ) {
              return
            }

            if (
              clean(
                inputRef.current
                  ?.value,
              ) !== cleanQuery
            ) {
              return
            }

            setResults(
              members,
            )

            setMessage(
              members.length
                ? ''
                : `No YH members found for "${cleanQuery}".`,
            )
          } catch (
            error
          ) {
            if (
              requestToken !==
              requestRef.current
            ) {
              return
            }

            setResults([])

            setMessage(
              error?.message ||
                'Failed to search YH members.',
            )
          } finally {
            if (
              requestToken ===
              requestRef.current
            ) {
              setLoading(
                false,
              )
            }
          }
        },
        immediate ? 0 : 120,
      )
  }

  const updateFollow =
    async (member) => {
      if (
        !member?.id ||
        member.id ===
          currentUserId
      ) {
        return
      }

      const previous =
        member.followedByMe ===
        true

      setResults(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              member.id
                ? {
                    ...item,
                    followBusy:
                      true,
                  }
                : item,
          ),
      )

      try {
        const result =
          await apiFetch(
            `/api/academy/community/members/${encodeURIComponent(
              member.id,
            )}/follow`,
            {
              method: 'POST',

              body:
                JSON.stringify({
                  following:
                    !previous,
                }),
            },
          )

        const following =
          typeof result
            ?.following ===
          'boolean'
            ? result.following
            : !previous

        setResults(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                member.id
                  ? {
                      ...item,

                      followBusy:
                        false,

                      followedByMe:
                        following,

                      followersCount:
                        Number(
                          result
                            ?.followersCount ??
                            result
                              ?.followers_count ??
                            item.followersCount,
                        ) || 0,
                    }
                  : item,
            ),
        )
      } catch {
        setResults(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                member.id
                  ? {
                      ...item,
                      followBusy:
                        false,
                    }
                  : item,
            ),
        )
      }
    }

  const openProfile = (
    member,
  ) => {
    if (!member?.id) {
      return
    }

    setOpen(false)

    onProfileOpen?.(
      member.id,
    )
  }

  return (
    <form
      ref={hostRef}
      className={mobile
        ? 'yh-dashboard-profile-search yh-mobile-dashboard-search-form'
        : 'yh-dashboard-profile-search yh-dashboard-top-search'}
      id={mobile ? 'yh-dashboard-mobile-search-form' : 'yh-dashboard-top-search-form'}
      autoComplete="off"
      role="search"
      onSubmit={(
        event,
      ) => {
        event.preventDefault()

        void runSearch(
          query,
          true,
        )
      }}
    >
      {mobile ? <input
        type="search"
        ref={inputRef}
        enterKeyHint="search"
        id="yh-dashboard-mobile-search-input"
        className="yh-mobile-dashboard-search-input"
        placeholder="Search across YH Universe..."
        aria-label="Search YH Universe members"
        value={query}
        onFocus={() => { if (clean(query).length >= 2) setOpen(true) }}
        onChange={(event) => { setQuery(event.target.value); void runSearch(event.target.value) }}
      /> : <textarea
        ref={inputRef}
        id="yh-dashboard-top-search-input"
        className="input-field yh-dashboard-profile-search-input yh-dashboard-top-search-input yh-dashboard-top-search-textarea"
        placeholder="Search across YH Universe..."
        aria-label="Search YH Universe members"
        rows="1"
        value={query}
        onFocus={() => {
          resizeTextarea()

          if (
            clean(query).length >=
            2
          ) {
            setOpen(true)

            if (
              !results.length &&
              !loading
            ) {
              void runSearch(
                query,
                true,
              )
            }
          }
        }}
        onChange={(
          event,
        ) => {
          const value =
            event.target.value

          setQuery(value)

          resizeTextarea()

          void runSearch(
            value,
          )
        }}
        onKeyDown={(
          event,
        ) => {
          if (
            event.key ===
            'Escape'
          ) {
            setOpen(false)
            return
          }

          if (
            event.key ===
              'Enter' &&
            !event.shiftKey
          ) {
            event.preventDefault()

            void runSearch(
              query,
              true,
            )
          }
        }}
      />}

      <button
        type="submit"
        className={mobile
          ? 'yh-mobile-dashboard-search-btn'
          : 'btn-secondary yh-dashboard-profile-search-btn yh-dashboard-top-search-btn'}
        id={mobile ? 'yh-dashboard-mobile-search-btn' : 'yh-dashboard-top-search-btn'}
        disabled={loading}
      >
        {loading
          ? 'Searching...'
          : 'Search'}
      </button>

      {open && (
        <div
          className="yh-dashboard-search-dropdown is-open"
          data-yh-search-input-id={mobile ? 'yh-dashboard-mobile-search-input' : 'yh-dashboard-top-search-input'}
          aria-hidden="false"
          role="listbox"
          aria-label="YH member search results"
        >
          {message && (
            <div className="yh-dashboard-search-dropdown-state">
              {message}
            </div>
          )}

          {results.length >
            0 && (
            <div className="yh-dashboard-search-results-list">
              {results.map(
                (member) => {
                  const isSelf =
                    member.id ===
                    currentUserId

                  return (
                    <article
                      key={
                        member.id
                      }
                      className="yh-dashboard-search-result-card"
                      data-yh-search-profile-id={
                        member.id
                      }
                    >
                      <button
                        type="button"
                        className="yh-dashboard-search-result-main"
                        onClick={() =>
                          openProfile(
                            member,
                          )
                        }
                      >
                        <span
                          className="yh-dashboard-search-result-avatar"
                          style={
                            member.avatar
                              ? {
                                  backgroundImage:
                                    `url("${member.avatar}")`,
                                }
                              : undefined
                          }
                        >
                          {member.avatar
                            ? ''
                            : member.displayName
                                .charAt(
                                  0,
                                )
                                .toUpperCase()}
                        </span>

                        <span className="yh-dashboard-search-result-copy">
                          <strong>
                            {
                              member.displayName
                            }
                          </strong>

                          <span>
                            {member.username
                              ? `@${member.username} • `
                              : ''}

                            {
                              member.divisionLabel
                            }

                            {member.roleLabel
                              ? ` • ${member.roleLabel}`
                              : ''}

                            {member.followersCount
                              ? ` • ${member.followersCount} followers`
                              : ''}
                          </span>

                          {member.tags.length >
                            0 && (
                            <small>
                              {member.tags
                                .map(
                                  (
                                    tag,
                                  ) =>
                                    `#${tag}`,
                                )
                                .join(
                                  ' • ',
                                )}
                            </small>
                          )}
                        </span>
                      </button>

                      <div className="yh-dashboard-search-result-actions">
                        <button
                          type="button"
                          className="yh-dashboard-search-small-btn"
                          onClick={() =>
                            openProfile(
                              member,
                            )
                          }
                        >
                          View
                        </button>

                        {!isSelf && (
                          <button
                            type="button"
                            className={`yh-dashboard-search-small-btn ${
                              member.followedByMe
                                ? 'is-following'
                                : ''
                            }`}
                            disabled={
                              member.followBusy
                            }
                            onClick={() =>
                              updateFollow(
                                member,
                              )
                            }
                          >
                            {member.followBusy
                              ? '...'
                              : member.followedByMe
                                ? 'Following'
                                : 'Follow'}
                          </button>
                        )}
                      </div>
                    </article>
                  )
                },
              )}
            </div>
          )}
        </div>
      )}
    </form>
  )
}
