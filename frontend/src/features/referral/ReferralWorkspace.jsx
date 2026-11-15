import { REFERRAL_CACHE_KEY, readCache, writeCache, formatMoney, formatDate, getDisplayName, getStatusLabel, getStatusTone } from './referralUtils.js'
import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'

export default function ReferralWorkspace({
  onToast,
}) {
  const [snapshot, setSnapshot] =
    useState(
      () =>
        readCache() || {
          referral: {},
          stats: {},
          referrals: [],
        },
    )

  const [loading, setLoading] =
    useState(false)

  const [
    copyState,
    setCopyState,
  ] = useState('idle')

  const refresh =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        setLoading(true)

        try {
          const result =
            await apiFetch(
              '/api/universe/referrals/me',
              {
                method: 'GET',
              },
            )

          const next =
            result &&
            typeof result ===
              'object'
              ? result
              : {
                  referral: {},
                  stats: {},
                  referrals: [],
                }

          setSnapshot(next)
          writeCache(next)

          if (!silent) {
            onToast?.(
              'Referral data refreshed.',
              'success',
            )
          }

          return next
        } catch (error) {
          onToast?.(
            error?.message ||
              'Failed to load referral data.',
            'error',
          )

          throw error
        } finally {
          setLoading(false)
        }
      },
      [onToast],
    )

  useEffect(() => {
    refresh({
      silent: true,
    }).catch(() => {})
  }, [refresh])

  const referral =
    snapshot?.referral || {}

  const stats =
    snapshot?.stats || {}

  const referrals =
    Array.isArray(
      snapshot?.referrals,
    )
      ? snapshot.referrals
      : []

  const referralLink =
    String(
      referral.link || '',
    ).trim()

  const copyLink = async () => {
    if (!referralLink) {
      onToast?.(
        'Referral link is still loading.',
        'error',
      )
      return
    }

    setCopyState(
      'copying',
    )

    try {
      await navigator.clipboard.writeText(
        referralLink,
      )

      setCopyState(
        'copied',
      )

      onToast?.(
        'Universe referral link copied.',
        'success',
      )
    } catch {
      try {
        const input =
          document.getElementById(
            'yh-universe-referral-link',
          )

        input?.select?.()

        const copied =
          document.execCommand(
            'copy',
          )

        if (!copied) {
          throw new Error(
            'Copy failed',
          )
        }

        setCopyState(
          'copied',
        )

        onToast?.(
          'Universe referral link copied.',
          'success',
        )
      } catch {
        setCopyState(
          'error',
        )

        onToast?.(
          'Copy failed. Select the link manually.',
          'error',
        )
      }
    }

    window.setTimeout(
      () =>
        setCopyState(
          'idle',
        ),
      1800,
    )
  }

  return (
    <section
      id="yh-dashboard-referral-workspace"
      className="yh-dashboard-referral-workspace yh-tw-scope"
      aria-label="Referral workspace"
      data-yh-dashboard-react-surface="referral"
    >
      <div
        id="yh-dashboard-referral-workspace-content"
        className="yh-academy-parent-vision-scope"
      >
        <section
          id="yh-universe-referral-card"
          className="yh-universe-referral-card yh-academy-parent-glass yh-academy-parent-referral tw-relative tw-z-10 tw-overflow-hidden tw-rounded-yhCard"
          aria-label="Universe referral program"
        >
          <div className="yh-universe-referral-main">
            <div className="yh-universe-referral-kicker yh-academy-parent-kicker">
              Universe Referral Program
            </div>

            <h3 className="yh-universe-referral-title yh-academy-parent-title">
              Invite members. Earn from their purchases.
            </h3>

            <p className="yh-universe-referral-copy yh-academy-parent-muted">
              Share your Universe link. When someone you invited makes a purchase or payment, you earn 2.81% commission from that payment inside the wallet system.
            </p>

            <div className="yh-universe-referral-link-row">
              <input
                type="text"
                id="yh-universe-referral-link"
                className="yh-universe-referral-link"
                value={
                  referralLink ||
                  'Loading referral link...'
                }
                readOnly
              />

              <button
                type="button"
                className={`btn-secondary yh-universe-referral-copy-btn ${
                  copyState ===
                  'copied'
                    ? 'is-copied'
                    : copyState ===
                        'error'
                      ? 'is-error'
                      : copyState ===
                          'copying'
                        ? 'is-copying'
                        : ''
                }`}
                disabled={
                  copyState ===
                  'copying'
                }
                onClick={
                  copyLink
                }
              >
                {copyState ===
                'copied'
                  ? 'Copied'
                  : copyState ===
                      'copying'
                    ? 'Copying...'
                    : copyState ===
                        'error'
                      ? 'Copy Failed'
                      : 'Copy Link'}
              </button>
            </div>
          </div>

          <div className="yh-universe-referral-stats">
            <article className="yh-academy-parent-stat tw-rounded-2xl">
              <span>
                Referral Code
              </span>

              <strong>
                {String(
                  referral.code ||
                    'Pending',
                ).trim() ||
                  'Pending'}
              </strong>
            </article>

            <article className="yh-academy-parent-stat tw-rounded-2xl">
              <span>
                Total Invited
              </span>

              <strong>
                {Number(
                  stats.total ||
                    0,
                )}
              </strong>
            </article>

            <article className="yh-academy-parent-stat tw-rounded-2xl">
              <span>
                Paying Referrals
              </span>

              <strong>
                {Number(
                  stats.payingReferrals ??
                    stats.qualified ??
                    0,
                )}
              </strong>
            </article>

            <article className="yh-academy-parent-stat tw-rounded-2xl">
              <span>
                Total Earned
              </span>

              <strong>
                {formatMoney(
                  Number(
                    stats.totalEarned ||
                      0,
                  ),
                  stats.currency ||
                    referral.currency ||
                    'USD',
                )}
              </strong>
            </article>
          </div>

          <div className="yh-universe-referral-recent">
            <div className="yh-universe-referral-recent-head">
              <div>
                <div className="yh-universe-referral-kicker yh-academy-parent-kicker">
                  Recent Referrals
                </div>

                <h4 className="yh-universe-referral-recent-title">
                  Referral commission activity
                </h4>
              </div>

              <button
                type="button"
                className="btn-secondary yh-universe-referral-refresh-btn"
                disabled={
                  loading
                }
                onClick={() =>
                  refresh()
                    .catch(
                      () => {},
                    )
                }
              >
                {loading
                  ? 'Refreshing...'
                  : 'Refresh'}
              </button>
            </div>

            <div className="yh-universe-referral-list">
              {loading &&
              !referrals.length ? (
                <div className="yh-universe-referral-empty">
                  Loading recent referrals...
                </div>
              ) : !referrals.length ? (
                <div className="yh-universe-referral-empty">
                  No referrals yet. Copy your link and invite your first member into YH Universe.
                </div>
              ) : (
                referrals
                  .slice(
                    0,
                    8,
                  )
                  .map(
                    (
                      item,
                      index,
                    ) => {
                      const name =
                        getDisplayName(
                          item,
                        )

                      const status =
                        getStatusLabel(
                          item.status,
                          item.rewardStatus,
                        )

                      const tone =
                        getStatusTone(
                          item.status,
                          item.rewardStatus,
                        )

                      const division =
                        String(
                          item.qualifiedDivision ||
                            '',
                        ).trim()

                      const rewardAmount =
                        Number(
                          item.commissionAmount ||
                            item.rewardAmount ||
                            0,
                        )

                      const commissionCount =
                        Number(
                          item.commissionCount ||
                            0,
                        )

                      const currency =
                        String(
                          item.currency ||
                            'USD',
                        )
                          .trim()
                          .toUpperCase() ||
                        'USD'

                      const earned =
                        commissionCount >
                          0 ||
                        item.rewardStatus ===
                          'commission_created' ||
                        item.status ===
                          'commission_earned' ||
                        item.rewardStatus ===
                          'created' ||
                        item.status ===
                          'reward_created'

                      const date =
                        item.latestCommissionAt ||
                        item.rewardCreatedAt ||
                        item.qualifiedAt ||
                        item.capturedAt

                      return (
                        <article
                          key={
                            item.id ||
                            item.referredUid ||
                            `${name}-${index}`
                          }
                          className="yh-universe-referral-item"
                          data-referral-tone={
                            tone
                          }
                        >
                          <div className="yh-universe-referral-avatar">
                            {String(
                              name ||
                                'Y',
                            )
                              .charAt(
                                0,
                              )
                              .toUpperCase()}
                          </div>

                          <div className="yh-universe-referral-item-main">
                            <div className="yh-universe-referral-item-top">
                              <strong>
                                {
                                  name
                                }
                              </strong>

                              <span
                                className="yh-universe-referral-status"
                                data-referral-tone={
                                  tone
                                }
                              >
                                {
                                  status
                                }
                              </span>
                            </div>

                            <div className="yh-universe-referral-item-meta">
                              <span>
                                {formatDate(
                                  date,
                                )}
                              </span>

                              <span>
                                {division
                                  ? `Latest purchase: ${division}`
                                  : 'Awaiting first purchase'}
                              </span>

                              {commissionCount >
                                0 && (
                                <span>
                                  {
                                    commissionCount
                                  }{' '}
                                  payment
                                  {commissionCount ===
                                  1
                                    ? ''
                                    : 's'}
                                </span>
                              )}

                              {earned && (
                                <span>
                                  {formatMoney(
                                    rewardAmount,
                                    currency,
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      )
                    },
                  )
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
