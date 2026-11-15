import { clean, safeObject, normalizeMember, buildRedactedName, redactMember, getVisibilityMode, initials } from './federationDirectoryUtils.js'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import './FederationDirectoryWorkspace.css'
import { badgeIsActive } from './FederationBadgePaymentCard'

function normalizeFederationAvatarUrl(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return "";

  if (
    clean.startsWith("http://") ||
    clean.startsWith("https://") ||
    clean.startsWith("/") ||
    clean.startsWith("data:image/")
  ) {
    return clean;
  }

  return `/${clean.replace(/^\/+/, "")}`;
}

export default function FederationDirectoryWorkspace({
  refreshVersion = 0,
  onDataChanged,
  onToast,
  onWorkspaceOpen,
}) {
  const [
    me,
    setMe,
  ] = useState(null)

  const [
    members,
    setMembers,
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
    search,
    setSearch,
  ] = useState('')

  const [
    category,
    setCategory,
  ] = useState('all')

  const [
    country,
    setCountry,
  ] = useState('all')

  const [
    selected,
    setSelected,
  ] = useState(null)

  const [
    profile,
    setProfile,
  ] = useState(null)

  const [
    profileLoading,
    setProfileLoading,
  ] = useState(false)

  const profileDialogRef = useRef(null)
  const profileRequestRef = useRef(0)
  const messageInFlightRef = useRef(false)
  const [messageBusy, setMessageBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  const loadDirectory =
    useCallback(
      async (
        refresh = false,
      ) => {
        if (refresh) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(true)
        }

        try {
          const [
            meResult,
            directoryResult,
          ] =
            await Promise.all([
              apiFetch(
                '/api/federation/me',
                {
                  method:
                    'GET',
                  cache:
                    'no-store',
                },
              ),

              apiFetch(
                '/api/federation/directory',
                {
                  method:
                    'GET',
                  cache:
                    'no-store',
                },
              ),
            ])

          setMe(
            meResult || {},
          )

          setMembers(
            Array.isArray(
              directoryResult?.members,
            )
              ? directoryResult.members.map(
                  normalizeMember,
                )
              : [],
          )
        } catch (
          error
        ) {
          onToast?.(
            error?.message ||
              'Could not load Federation Directory.',
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
    void loadDirectory(refreshVersion > 0)
  }, [loadDirectory, refreshVersion])

  const mode =
    getVisibilityMode(
      me || {},
    )

  const visibleMembers =
    useMemo(
      () =>
        members.map(
          (member) =>
            redactMember(
              member,
              mode,
            ),
        ),
      [
        members,
        mode,
      ],
    )

  const categories =
    useMemo(
      () =>
        Array.from(
          new Set(
            visibleMembers
              .map(
                (member) =>
                  member.category,
              )
              .filter(Boolean),
          ),
        ).sort(),
      [visibleMembers],
    )

  const countries =
    useMemo(
      () =>
        Array.from(
          new Set(
            visibleMembers
              .map(
                (member) =>
                  member.country,
              )
              .filter(Boolean),
          ),
        ).sort(),
      [visibleMembers],
    )

  const filtered =
    useMemo(
      () => {
        const query =
          clean(search)
            .toLowerCase()

        return visibleMembers.filter(
          (member) => {
            const haystack = [
              member.name,
              member.role,
              member.company,
              member.country,
              member.city,
              member.category,
              member.description,
            ]
              .join(' ')
              .toLowerCase()

            return (
              (!query ||
                haystack.includes(
                  query,
                )) &&
              (category ===
                'all' ||
                member.category ===
                  category) &&
              (country ===
                'all' ||
                member.country ===
                  country)
            )
          },
        )
      },
      [
        visibleMembers,
        search,
        category,
        country,
      ],
    )

  const openProfile =
    async (member) => {
      if (
        member.__redacted
      ) {
        return
      }

      const targetId =
        clean(
          member.userId ||
            member.id,
        )

      if (!targetId) {
        return
      }

      const version = ++profileRequestRef.current
      setProfileMessage('')
      setSelected(member)

      setProfile(null)

      setProfileLoading(
        true,
      )

      try {
        const result =
          await apiFetch(
            `/api/universe/profile/${encodeURIComponent(
              targetId,
            )}`,
            {
              method:
                'GET',

              cache:
                'no-store',
            },
          )

        if (version !== profileRequestRef.current) return
        setProfile(
          safeObject(
            result?.profile,
          ),
        )
      } catch (
        error
      ) {
        if (version !== profileRequestRef.current) return
        onToast?.(
          error?.message ||
            'Could not load member profile.',
          'error',
        )
      } finally {
        if (version === profileRequestRef.current) setProfileLoading(false)
      }
    }

  const closeProfile = useCallback(() => {
    profileRequestRef.current += 1
    setSelected(null)
    setProfile(null)
    setProfileLoading(false)
    setProfileMessage('')
  }, [])

  useEffect(() => {
    if (!selected) return undefined

    const dialog = profileDialogRef.current
    const opener = document.activeElement

    const focusable = () => Array.from(
      dialog?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) || []
    ).filter(element =>
      !element.hidden &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getClientRects().length
    )

    ;(focusable()[0] || dialog)?.focus()

    const onKeyDown = event => {
      if (!dialog?.getClientRects().length) return

      if (event.key === 'Escape') {
        event.preventDefault()
        closeProfile()
        return
      }

      if (event.key !== 'Tab') return

      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]

      if (!first) {
        event.preventDefault()
        dialog.focus()
        return
      }

      if (
        event.shiftKey &&
        (
          document.activeElement === first ||
          !dialog.contains(document.activeElement)
        )
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (
          document.activeElement === last ||
          !dialog.contains(document.activeElement)
        )
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)

      if (opener?.isConnected && opener.getClientRects().length) {
        opener.focus?.()
      }
    }
  }, [selected, closeProfile])

  const sendProfileMessage = async () => {
    if (!selected || selected.__redacted || mode !== 'full' || messageInFlightRef.current) return
    const member = members.find(item => clean(item.userId || item.id) === clean(selected.userId || selected.id))
    if (!member) return
    const version = profileRequestRef.current
    messageInFlightRef.current = true
    setMessageBusy(true)
    setProfileMessage('')
    try {
      const payload = {
        contactName: member.name,
        contactRole: member.role || 'Federation Member',
        contactType: member.category || 'Strategic Network',
        city: member.city || '', country: member.country || 'Global',
        sourceMethod: 'Federation Directory', channel: 'Federation scoped message',
        pipelineStage: 'Member profile message', priority: 'normal',
        requestedTier: member.badge || 'Verified',
        requestReason: 'I want to open a scoped Federation message with ' + member.name + ' from the Federation directory.',
        intendedUse: 'Direct Federation member communication inside YH Universe.',
        budgetRange: 'not_sure', urgency: 'normal', preferredIntroType: 'admin_brokered',
        notes: 'Target member user id: ' + (member.userId || member.id) + '. This was created from the shared Universe Profile modal.',
      }
      const result = await apiFetch('/api/federation/connect/requests', {
        method: 'POST', body: JSON.stringify(payload),
      })
      if (!result?.request?.id) throw new Error('Federation connection request response was incomplete.')
      if (version === profileRequestRef.current) {
        setProfileMessage('Federation message request sent. Check My Requests for admin review and next steps.')
      }
      onDataChanged?.()
    } catch (error) {
      if (version === profileRequestRef.current) setProfileMessage(error?.message || 'Could not send Federation message request.')
      onToast?.(error?.message || 'Could not send Federation message request.', 'error')
    } finally {
      messageInFlightRef.current = false
      setMessageBusy(false)
    }
  }

  const profileCover = normalizeFederationAvatarUrl(profile?.cover_photo || profile?.coverPhoto || profile?.cover_url || profile?.coverUrl || profile?.coverPhotoUrl || profile?.cover || '')
  const profileAvatar = normalizeFederationAvatarUrl(profile?.avatar || selected?.avatar || '')
  const profileDivisions = Object.values(safeObject(profile?.divisions)).filter(Boolean)
  const profileSignals = safeObject(profile?.signals)

  if (loading) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-directory-react-workspace">
        <div className="yh-federation-directory-state">
          Loading Federation
          Directory...
        </div>
      </section>
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-federation-directory-react-workspace"
      data-yh-dashboard-react-surface="federation-directory"
    >
      <div className="yh-federation-directory-scroll">
        <div className="yh-federation-directory-shell">
          <header className="yh-federation-directory-hero">
            <div>
              <span className="yh-federation-directory-kicker">
                Federation /
                Directory
              </span>

              <h1>
                Federation
                Directory
              </h1>

              <p>
                Browse approved
                strategic members
                and use Federation
                Connect for
                controlled
                introductions.
              </p>
            </div>

            <button
              type="button"
              className="yh-fed-action yh-fed-action-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadDirectory(
                  true,
                )
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          {mode !==
            'full' && (
            <section className="yh-federation-directory-lock-note">
              <strong>
                {mode ===
                'partial'
                  ? 'Screened preview only'
                  : 'Protected member preview'}
              </strong>

              <span>
                {mode ===
                'partial'
                  ? 'Your application is already in the pipeline. Full names, firms, and operating details unlock after approval.'
                  : 'You are seeing a protected preview only. Full member details and direct operating visibility unlock after approval.'}
              </span>
            </section>
          )}

          <section className="yh-federation-directory-summary">
            <article>
              <small>
                Visible Members
              </small>

              <strong>
                {
                  members.length
                }
              </strong>
            </article>

            <article>
              <small>
                Categories
              </small>

              <strong>
                {
                  categories.length
                }
              </strong>
            </article>

            <article>
              <small>
                Countries
              </small>

              <strong>
                {
                  countries.length
                }
              </strong>
            </article>
          </section>

          <section className="yh-federation-directory-toolbar">
            <label>
              <span>
                Search
              </span>

              <input
                className="input-field"
                type="text"
                value={
                  search
                }
                placeholder="Search name, company, or city"
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Category
              </span>

              <select
                className="input-field"
                value={
                  category
                }
                onChange={(
                  event,
                ) =>
                  setCategory(
                    event.target
                      .value,
                  )
                }
              >
                <option value="all">
                  All Categories
                </option>

                {categories.map(
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

            <label>
              <span>
                Country
              </span>

              <select
                className="input-field"
                value={
                  country
                }
                onChange={(
                  event,
                ) =>
                  setCountry(
                    event.target
                      .value,
                  )
                }
              >
                <option value="all">
                  All Countries
                </option>

                {countries.map(
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
          </section>

          {!filtered.length ? (
            <div className="yh-federation-directory-state">
              <strong>
                No approved
                members match
                these filters.
              </strong>

              <span>
                Try another search,
                category, or
                country.
              </span>
            </div>
          ) : (
            <div className="yh-federation-directory-grid">
              {filtered.map(
                (member) => (
                  <article
                    className={[
                      'yh-federation-directory-card',

                      member.__redacted
                        ? 'is-redacted'
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={
                      member.id
                    }
                  >
                    <div className="yh-federation-directory-member-head">
                      <div className="yh-federation-directory-avatar">
                        {!member.__redacted &&
                        member.avatar ? (
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
                        <h3>
                          {
                            member.name
                          }
                          {!member.__redacted && badgeIsActive(member) && (
                            <img
                              src="/images/yhf%20badge.png"
                              width="18"
                              height="18"
                              alt="YHF Verified"
                            />
                          )}
                        </h3>

                        <span>
                          {
                            member.role
                          }
                        </span>
                      </div>

                      <b>
                        {
                          member.badge
                        }
                      </b>
                    </div>

                    <div className="yh-federation-directory-meta">
                      <span>
                        {
                          member.category
                        }
                      </span>

                      {member.country && (
                        <span>
                          {
                            member.country
                          }
                        </span>
                      )}

                      {member.city && (
                        <span>
                          {
                            member.city
                          }
                        </span>
                      )}

                      {mode ===
                        'full' &&
                        member.company && (
                          <span>
                            {
                              member.company
                            }
                          </span>
                        )}
                    </div>

                    <p>
                      {
                        member.description
                      }
                    </p>

                    {member.__redacted ? (
                      <div className="yh-federation-directory-protected">
                        Protected until
                        approval
                      </div>
                    ) : (
                      <div className="yh-federation-directory-actions">
                        <button
                          type="button"
                          className="yh-fed-action yh-fed-action-secondary"
                          onClick={() =>
                            void openProfile(
                              member,
                            )
                          }
                        >
                          View Profile
                        </button>

                        <button
                          type="button"
                          className="yh-fed-action yh-fed-action-primary"
                          onClick={() =>
                            onWorkspaceOpen?.(
                              'federation-connect',
                            )
                          }
                        >
                          Open Connect
                        </button>
                      </div>
                    )}
                  </article>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div
          className="modal-overlay"
          ref={profileDialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeProfile()
          }}
        >
          <div className="modal-content yh-federation-directory-profile-modal">
            <div className="yh-federation-directory-profile-head">
              <div>
                <span className="yh-federation-directory-kicker">
                  YH Universe
                  Profile
                </span>

                <h2>
                  {clean(
                    profile?.fullName ||
                      profile?.displayName,
                  ) ||
                    selected.name}
                </h2>
              </div>

              <button
                type="button"
                className="yh-fed-action yh-fed-action-secondary"
                onClick={closeProfile}
              >
                Close
              </button>
            </div>

            {profileLoading ? (
              <div className="yh-federation-directory-state">
                Loading
                profile...
              </div>
            ) : (
              <>
                {profileCover && <img className="yh-federation-directory-profile-cover" src={profileCover} alt="" />}
                <div className="yh-federation-directory-member-head">
                  <div className="yh-federation-directory-avatar">
                    {profileAvatar ? <img src={profileAvatar} alt="" /> : initials(profile?.fullName || selected.name)}
                  </div>
                  <div>
                    <strong>{clean(profile?.fullName || profile?.displayName) || selected.name}</strong>
                    <span>{profile?.username ? '@' + clean(profile.username) : clean(profile?.trustTier) || 'Strategic Member'}</span>
                  </div>
                </div>
                {profileDivisions.length > 0 && <div className="yh-federation-directory-meta">
                  {profileDivisions.map((division, index) => <span key={division.key || index}>
                    {clean(division.label || division.key)}: {division.isMember ? 'Member' : clean(division.statusLabel) || 'Not Applied'}
                  </span>)}
                </div>}
                {[['lookingFor', 'Looking For'], ['canOffer', 'Can Offer'], ['tags', 'Tags']].map(([key, label]) => {
                  const values = Array.isArray(profileSignals[key]) ? profileSignals[key] : []
                  return values.length > 0 ? <div key={key}>
                    <strong>{label}</strong>
                    <div className="yh-federation-directory-meta">
                      {values.map((entry, index) => <span key={index}>{clean(entry)}</span>)}
                    </div>
                  </div> : null
                })}
                <div className="yh-federation-directory-profile-grid">
                  <div>
                    <small>
                      Role
                    </small>

                    <strong>
                      {clean(
                        profile?.role ||
                          profile?.profession,
                      ) ||
                        selected.role}
                    </strong>
                  </div>

                  <div>
                    <small>
                      Category
                    </small>

                    <strong>
                      {
                        selected.category
                      }
                    </strong>
                  </div>

                  <div>
                    <small>
                      Location
                    </small>

                    <strong>
                      {[
                        clean(
                          profile?.city,
                        ) ||
                          selected.city,

                        clean(
                          profile?.country,
                        ) ||
                          selected.country,
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(
                          ', ',
                        ) ||
                        'Private'}
                    </strong>
                  </div>

                  <div>
                    <small>
                      Company
                    </small>

                    <strong>
                      {clean(
                        profile?.company,
                      ) ||
                        selected.company ||
                        'Independent'}
                    </strong>
                  </div>
                </div>

                <p className="yh-federation-directory-profile-copy">
                  {clean(
                    profile?.bio ||
                      profile?.description,
                  ) ||
                    selected.description}
                </p>

                <div className="yh-federation-directory-profile-note">
                  Federation
                  communication
                  stays protected.
                  Use Connect to
                  request a scoped
                  message,
                  strategic intro,
                  or
                  admin-brokered
                  path.
                </div>

                <div className="yh-federation-directory-actions">
                  <button type="button" className="yh-fed-action yh-fed-action-primary"
                    disabled={messageBusy || mode !== 'full'} onClick={() => void sendProfileMessage()}>
                    {messageBusy ? 'Sending...' : 'Message in Federation'}
                  </button>
                  <button type="button" className="yh-fed-action yh-fed-action-secondary"
                    onClick={() => { closeProfile(); onWorkspaceOpen?.('federation-connect') }}>
                    Request Strategic Intro
                  </button>
                </div>
                {profileMessage && <p role="status">{profileMessage}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
