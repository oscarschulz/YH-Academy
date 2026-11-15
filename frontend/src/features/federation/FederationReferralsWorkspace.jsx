import { clean, safeArray, normalizeReferralCode, formatDate, statusClass, normalizeApplication, normalizeSnapshot, copyText } from './federationReferralsUtils.js'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import './FederationReferralsWorkspace.css'

export default function FederationReferralsWorkspace({
  refreshVersion = 0,
  onDataChanged,
  onToast,
}) {
  const [
    me,
    setMe,
  ] = useState(null)

  const [
    snapshot,
    setSnapshot,
  ] = useState(() =>
    normalizeSnapshot(),
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

  const loadReferrals =
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

        setError('')

        try {
          const meResult =
            await apiFetch(
              '/api/federation/me',
              {
                method:
                  'GET',

                cache:
                  'no-store',
              },
            )

          setMe(
            meResult || {},
          )

          const approved =
            meResult
              ?.canEnterFederation ===
              true ||
            clean(
              meResult
                ?.applicationStatus,
            ).toLowerCase() ===
              'approved'

          if (!approved) {
            setSnapshot(
              normalizeSnapshot(
                {},
                meResult
                  ?.member ||
                  {},
              ),
            )
            return
          }

          const result =
            await apiFetch(
              '/api/federation/referrals',
              {
                method:
                  'GET',

                cache:
                  'no-store',
              },
            )

          setSnapshot(
            normalizeSnapshot(
              result?.referrals ||
                {},
              meResult
                ?.member ||
                {},
            ),
          )
        } catch (
          loadError
        ) {
          const message =
            loadError?.message ||
            'Failed to load Federation referrals.'

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
    void loadReferrals(refreshVersion > 0)
  }, [loadReferrals, refreshVersion])

  const approved =
    me?.canEnterFederation ===
      true ||
    clean(
      me?.applicationStatus,
    ).toLowerCase() ===
      'approved'

  const member =
    me?.member &&
    typeof me.member ===
      'object'
      ? me.member
      : {}

  const inviteUrl =
    useMemo(
      () => {
        if (
          snapshot.inviteUrlPath
        ) {
          try {
            return new URL(
              snapshot.inviteUrlPath,
              window.location.origin,
            ).toString()
          } catch {}
        }

        if (
          !snapshot.referralCode
        ) {
          return ''
        }

        try {
          const url =
            new URL(
              window.location.origin,
            )

          url.searchParams.set(
            'ref',
            snapshot.referralCode,
          )

          return url.toString()
        } catch {
          return ''
        }
      },
      [
        snapshot.inviteUrlPath,
        snapshot.referralCode,
      ],
    )

  const conversionRate =
    snapshot.total > 0
      ? Math.round(
          (snapshot.approved /
            snapshot.total) *
            100,
        )
      : 0

  const handleCopy =
    async (
      value,
      successMessage,
    ) => {
      try {
        await copyText(
          value,
        )

        onToast?.(
          successMessage,
          'success',
        )
      } catch (
        copyError
      ) {
        onToast?.(
          copyError?.message ||
            'Could not copy referral information.',
          'error',
        )
      }
    }

  const selectInviteLink = event => {
    event.currentTarget.select()
  }

  if (loading) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-referrals-react-workspace">
        <div className="yh-federation-referrals-state">
          Loading Federation
          referrals...
        </div>
      </section>
    )
  }

  if (!approved) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-referrals-react-workspace">
        <div className="yh-federation-referrals-state">
          <span className="yh-federation-referrals-kicker">
            Federation
            Referrals
          </span>

          <h1>
            Referral access
            unlocks after approval
          </h1>

          <p>
            Approved Federation
            members receive a live
            member referral code
            and referral pipeline.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-federation-referrals-react-workspace"
      data-yh-dashboard-react-surface="federation-referrals"
    >
      <div className="yh-federation-referrals-scroll">
        <div className="yh-federation-referrals-shell">
          <header className="yh-federation-referrals-hero">
            <div>
              <span className="yh-federation-referrals-kicker">
                Federation /
                Referrals
              </span>

              <h1>
                Member Referral
                Access
              </h1>

              <p>
                Route trusted
                people into the
                Federation review
                pipeline while
                preserving visible
                attribution back to
                your member
                identity.
              </p>
            </div>

            <button
              type="button"
              className="yh-fed-action yh-fed-action-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadReferrals(
                  true,
                )
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          {error && (
            <div className="yh-federation-referrals-state is-error">
              {error}
            </div>
          )}

          <section className="yh-federation-referral-code-card">
            <div className="yh-federation-referral-code-head">
              <div>
                <span className="yh-federation-referrals-kicker">
                  Live Federation
                  Member Code
                </span>

                <h2>
                  {snapshot.referralCode ||
                    'UNAVAILABLE'}
                </h2>

                <p>
                  Share
                  selectively.
                  Quality of
                  referrals affects
                  the quality of
                  your lane.
                </p>
              </div>

              <span className="yh-federation-referral-active">
                Member Active
              </span>
            </div>

            <div className="yh-federation-referral-code-actions">
              <button
                type="button"
                className="yh-fed-action yh-fed-action-primary"
                disabled={
                  !snapshot.referralCode
                }
                onClick={() =>
                  void handleCopy(
                    snapshot.referralCode,
                    'Referral code copied.',
                  )
                }
              >
                Copy Code
              </button>

              <button
                type="button"
                className="yh-fed-action yh-fed-action-secondary"
                disabled={
                  !inviteUrl
                }
                onClick={() =>
                  void handleCopy(
                    inviteUrl,
                    'Referral invite link copied.',
                  )
                }
              >
                Copy Invite Link
              </button>
            </div>

            <label className="yh-federation-referral-link">
              <span>
                Invite Link
              </span>

              <input
                className="input-field"
                readOnly
                onFocus={selectInviteLink}
                onClick={selectInviteLink}
                value={
                  inviteUrl
                }
              />
            </label>
          </section>

          <section className="yh-federation-referral-summary">
            <article>
              <small>
                Total Referred
              </small>

              <strong>
                {
                  snapshot.total
                }
              </strong>

              <span>
                Applications tied
                to your member
                identity
              </span>
            </article>

            <article>
              <small>
                In Review
              </small>

              <strong>
                {
                  snapshot.pending
                }
              </strong>

              <span>
                Pending,
                screening or
                under review
              </span>
            </article>

            <article>
              <small>
                Shortlisted
              </small>

              <strong>
                {
                  snapshot.shortlisted
                }
              </strong>

              <span>
                Profiles moving
                deeper into review
              </span>
            </article>

            <article>
              <small>
                Approved
              </small>

              <strong>
                {
                  snapshot.approved
                }
              </strong>

              <span>
                {conversionRate}%
                approval rate
              </span>
            </article>
          </section>

          <div className="yh-federation-referrals-two-col">
            <section className="yh-federation-referral-panel">
              <span className="yh-federation-referrals-kicker">
                Member Position
              </span>

              <h2>
                Referral owner
              </h2>

              <div className="yh-federation-referral-profile-grid">
                <div>
                  <small>
                    Member
                  </small>

                  <strong>
                    {clean(
                      member.name ||
                        member.fullName,
                    ) ||
                      'Federation Member'}
                  </strong>
                </div>

                <div>
                  <small>
                    Category
                  </small>

                  <strong>
                    {clean(
                      member.category,
                    ) ||
                      'Strategic Operator'}
                  </strong>
                </div>

                <div>
                  <small>
                    Regional Anchor
                  </small>

                  <strong>
                    {[
                      clean(
                        member.city,
                      ),

                      clean(
                        member.country,
                      ),
                    ]
                      .filter(Boolean)
                      .join(', ') ||
                      'Not established'}
                  </strong>
                </div>

                <div>
                  <small>
                    Member Code
                  </small>

                  <strong>
                    {snapshot.referralCode ||
                      'Unavailable'}
                  </strong>
                </div>
              </div>
            </section>

            <section className="yh-federation-referral-panel">
              <span className="yh-federation-referrals-kicker">
                Member Reminder
              </span>

              <h2>
                Refer selectively
              </h2>

              <p>
                Use referrals for
                serious operators
                only. This is a
                credibility layer,
                not a mass-invite
                channel.
              </p>

              <div className="yh-federation-referral-principles">
                <span>
                  Quality over
                  volume
                </span>

                <span>
                  Visible
                  attribution
                </span>

                <span>
                  Admin-reviewed
                  access
                </span>

                <span>
                  Trusted profiles
                  only
                </span>
              </div>
            </section>
          </div>

          <section className="yh-federation-referral-panel yh-federation-referral-recent">
            <div className="yh-federation-referral-section-head">
              <div>
                <span className="yh-federation-referrals-kicker">
                  Recent Referred
                  Profiles
                </span>

                <h2>
                  Latest pipeline
                  activity tied to
                  your code
                </h2>
              </div>

              <span>
                {snapshot.recent.length}{' '}
                recent
              </span>
            </div>

            {!snapshot.recent.length ? (
              <div className="yh-federation-referrals-state">
                No referred
                applications yet.
                Share your code
                only with serious
                people whose
                profile you are
                willing to have
                visibly tied back
                to your member
                identity.
              </div>
            ) : (
              <div className="yh-federation-referral-list">
                {snapshot.recent.map(
                  (
                    application,
                  ) => (
                    <article
                      key={
                        application.id
                      }
                    >
                      <div className="yh-federation-referral-item-head">
                        <div>
                          <h3>
                            {
                              application.fullName
                            }
                          </h3>

                          <span>
                            {application.role ||
                              application.primaryCategory ||
                              'Applicant'}
                          </span>
                        </div>

                        <b
                          className={
                            statusClass(
                              application.status,
                            )
                          }
                        >
                          {
                            application.status
                          }
                        </b>
                      </div>

                      <div className="yh-federation-referral-item-meta">
                        <span>
                          {application.country ||
                            'No country'}
                        </span>

                        <span>
                          {application.city ||
                            'No city'}
                        </span>

                        <span>
                          {application.primaryCategory ||
                            'No category'}
                        </span>

                        <span>
                          {formatDate(
                            application.createdAt,
                          )}
                        </span>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}
