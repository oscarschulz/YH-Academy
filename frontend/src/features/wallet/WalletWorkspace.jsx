import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { fetchWalletEndpoint, requestWalletWithdrawal } from './walletApi'
import { getStoredAuthToken } from '../../services/api/apiClient'
import {
  formatMoney, statusTone, statusLabel,
  methodIcon, methodHint, ledgerTitle, ledgerMeta
} from './walletUtils'
import './WalletWorkspace.css'
import tutorialScriptUrl from '../tutorials/yh-division-tutorials.js?url'

const WALLET_CACHE_KEY =
  'yh_wallet_snapshot_v1'

const DASHBOARD_STATE_KEY =
  'yh_dashboard_persistent_ui_state_v1'

const WALLET_TABS = [
  ['overview', 'Overview'],
  ['payment-methods', 'Payment Methods'],
  ['payout-methods', 'Payout Methods'],
  ['request-withdrawal', 'Request Withdrawal'],
  ['payment-history', 'Payment History'],
  ['payout-history', 'Payout History'],
]

const EMPTY_SNAPSHOT = {
  paymentProviders: [],
  payoutMethods: [],
  balance: {
    currency: 'USD',
    approvedEarnings: 0,
    reservedWithdrawals: 0,
    available: 0,
    divisionBreakdown: {},
  },
  payments: [],
  payouts: [],
}

const EMPTY_WITHDRAWAL = {
  amount: '',
  currency: 'USD',
  method: 'local_bank',
  bankCountry: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  cryptoCurrency: '',
  cryptoNetwork: '',
  walletAddress: '',
}


/* YHU_WALLET_ACCOUNT_SCOPE_PATCH06 */
function walletScopedCacheKey() {
  try {
    const token = getStoredAuthToken();

    const parts = token.split('.');
    if (parts.length !== 3) return '';

    const encoded = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded = encoded.padEnd(
      Math.ceil(encoded.length / 4) * 4, '='
    );

    const payload = JSON.parse(atob(padded));

    const id = String(
      payload.user_id ||
      payload.uid ||
      payload.sub ||
      payload.id ||
      payload.user?.id ||
      ''
    ).trim();

    return id ? WALLET_CACHE_KEY + ':' + id : '';
  } catch {
    return '';
  }
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) || 'null',
    )

    return value &&
      typeof value === 'object' &&
      !Array.isArray(value)
      ? value
      : fallback
  } catch {
    return fallback
  }
}

function readInitialTab() {
  const state =
    readJson(
      DASHBOARD_STATE_KEY,
      {},
    )

  const tab =
    String(
      state.walletTab ||
        'overview',
    )
      .trim()
      .toLowerCase()

  return WALLET_TABS.some(
    ([key]) => key === tab,
  )
    ? tab
    : 'overview'
}

function saveWalletTab(tab) {
  const previous =
    readJson(
      DASHBOARD_STATE_KEY,
      {},
    )

  try {
    localStorage.setItem(
      DASHBOARD_STATE_KEY,
      JSON.stringify({
        ...previous,
        type: 'workspace',
        workspaceKey:
          'wallet',
        division:
          'resources',
        profileMode: '',
        profileMemberId: '',
        walletTab: tab,
        updatedAt:
          new Date().toISOString(),
      }),
    )
  } catch {}
}

function MethodList({
  methods,
}) {
  if (!methods?.length) {
    return (
      <div className="yhu-wallet-empty">
        No methods available yet.
      </div>
    )
  }

  return methods.map(
    (method, index) => {
      const status =
        String(
          method.status ||
            'available',
        ).trim()

      return (
        <article
          key={
            method.id ||
            method.provider ||
            `${method.label}-${index}`
          }
          className="yhu-wallet-method-card yhu-wallet-method-card--guided"
        >
          <div
            className="yhu-wallet-method-icon"
            aria-hidden="true"
          >
            {methodIcon(
              method,
            )}
          </div>

          <div className="yhu-wallet-method-main">
            <div className="yhu-wallet-method-title-row">
              <strong>
                {method.label ||
                  method.id ||
                  'Method'}
              </strong>

              <span
                className={`yhu-wallet-status-pill ${statusTone(
                  status,
                )}`}
              >
                {statusLabel(
                  status,
                )}
              </span>
            </div>

            <small>
              {method.provider ||
                method.id ||
                'provider-neutral'}
            </small>

            <p>
              {methodHint(
                method,
              )}
            </p>
          </div>
        </article>
      )
    },
  )
}

function Ledger({
  records,
  type,
}) {
  if (!records?.length) {
    return (
      <div className="yhu-wallet-empty">
        No{' '}
        {type === 'payment'
          ? 'payments'
          : 'payouts'}{' '}
        yet.
      </div>
    )
  }

  return records
    .slice(0, 12)
    .map(
      (record, index) => {
        const statusRaw =
          String(
            record.status ||
              (type ===
              'payment'
                ? 'draft'
                : 'pending_review'),
          ).trim()

        return (
          <article
            key={
              record.id ||
              `${type}-${index}`
            }
            className="yhu-wallet-ledger-card yhu-wallet-ledger-card--guided"
          >
            <div className="yhu-wallet-ledger-main">
              <strong>
                {ledgerTitle(
                  record,
                  type,
                )}
              </strong>

              <span>
                {ledgerMeta(
                  record,
                  type,
                )}
              </span>
            </div>

            <div className="yhu-wallet-ledger-side">
              <strong>
                {formatMoney(
                  record.amount ||
                    0,
                  record.currency ||
                    'USD',
                )}
              </strong>

              <span
                className={`yhu-wallet-status-pill ${statusTone(
                  statusRaw,
                )}`}
              >
                {statusLabel(
                  statusRaw,
                )}
              </span>
            </div>
          </article>
        )
      },
    )
}

export default function WalletWorkspace({
  onToast,
}) {
  const [snapshot, setSnapshot] =
    useState(() => {
      return (
        readJson(walletScopedCacheKey(), null) ||
        EMPTY_SNAPSHOT
      )
    })

  const [activeTab, setActiveTab] =
    useState(readInitialTab)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  const [
    withdrawal,
    setWithdrawal,
  ] = useState(
    EMPTY_WITHDRAWAL,
  )

  const [
    submitting,
    setSubmitting,
  ] = useState(false)

  const loadWallet =
    useCallback(
      async (
        currency = 'USD',
      ) => {
        setLoading(true)
        setError('')

        try {
          const requests = [
            {
              key: 'paymentOptions',
              url: '/api/payments/options',
            },
            {
              key: 'payoutOptions',
              url: '/api/payouts/options',
            },
            {
              key: 'balanceResult',
              url: `/api/payouts/balance?currency=${encodeURIComponent(
                currency,
              )}`,
            },
            {
              key: 'paymentsResult',
              url: '/api/payments/my-ledger',
            },
            {
              key: 'payoutsResult',
              url: '/api/payouts/my-ledger',
            },
          ]

          const results =
            await Promise.allSettled(
              requests.map(
                ({ url }) =>
                  fetchWalletEndpoint(url),
              ),
            )

          const failed = results
            .map((result, index) => ({
              result,
              request: requests[index],
            }))
            .filter(
              ({ result }) =>
                result.status === 'rejected',
            )

          if (failed.length) {
            const details = failed
              .map(
                ({ result, request }) =>
                  request.url +
                  ' → ' +
                  (result.reason?.message ||
                    'Request failed'),
              )
              .join(' | ')

            console.error(
              'Wallet API failures:',
              details,
            )

            throw new Error(details)
          }

          const [
            paymentOptions,
            payoutOptions,
            balanceResult,
            paymentsResult,
            payoutsResult,
          ] = results.map(
            (result) => result.value,
          )

          const next = {
            paymentProviders:
              Array.isArray(
                paymentOptions?.paymentProviders,
              )
                ? paymentOptions.paymentProviders
                : [],

            payoutMethods:
              Array.isArray(
                payoutOptions?.payoutMethods,
              )
                ? payoutOptions.payoutMethods
                : [],

            balance:
              balanceResult?.balance ||
              {
                currency,
                approvedEarnings: 0,
                reservedWithdrawals: 0,
                available: 0,
                divisionBreakdown:
                  {},
              },

            payments:
              Array.isArray(
                paymentsResult?.payments,
              )
                ? paymentsResult.payments
                : [],

            payouts:
              Array.isArray(
                payoutsResult?.payouts,
              )
                ? payoutsResult.payouts
                : [],

            refreshedAt:
              new Date().toISOString(),
          }

          setSnapshot(next)

          try {
            const scopedKey = walletScopedCacheKey();
            if (scopedKey) {
              localStorage.setItem(
                scopedKey,
                JSON.stringify(next)
              );
            }
          } catch {}

          return next
        } catch (loadError) {
          const message =
            loadError?.message ||
            'Failed to load wallet.'

          setError(message)

          throw loadError
        } finally {
          setLoading(false)
        }
      },
      [],
    )

  useEffect(() => {
    loadWallet(
      withdrawal.currency,
    ).catch(() => {})
  }, [loadWallet])

  /* YHU_WALLET_ORIGINAL_TUTORIAL_PARITY */
  useEffect(() => {
    let cancelled = false
    let timer = 0

    const openOriginalTutorial = () => {
      if (cancelled) return

      window.clearTimeout(timer)

      timer = window.setTimeout(() => {
        if (cancelled) return

        const tutorials = window.YHDivisionTutorials

        if (typeof tutorials?.open !== 'function') return

        Promise.resolve(
          tutorials.open('wallet', { refresh: true })
        ).catch(error => {
          console.warn(
            'Original Wallet tutorial unavailable:',
            error?.message || error,
          )
        })
      }, 160)
    }

    if (typeof window.YHDivisionTutorials?.open === 'function') {
      openOriginalTutorial()

      return () => {
        cancelled = true
        window.clearTimeout(timer)
      }
    }

    let script = document.querySelector(
      'script[data-yhu-react-division-tutorial="v1"], ' +
      'script[data-yhu-original-tutorial-loader="1"]'
    )

    if (!script) {
      script = document.createElement('script')
      script.src =
        tutorialScriptUrl
      script.async = true
      script.setAttribute(
        'data-yhu-react-division-tutorial',
        'v1',
      )
      script.setAttribute(
        'data-yhu-original-tutorial-loader',
        '1',
      )
    }

    script.addEventListener('load', openOriginalTutorial)

    if (!script.isConnected) {
      document.head.appendChild(script)
    }

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      script.removeEventListener('load', openOriginalTutorial)
    }
  }, [])

  const balance =
    snapshot?.balance ||
    EMPTY_SNAPSHOT.balance

  const currency =
    balance.currency ||
    'USD'

  const breakdown =
    balance?.divisionBreakdown &&
    typeof balance
      .divisionBreakdown ===
      'object'
      ? balance.divisionBreakdown
      : {}

  const divisions =
    useMemo(
      () => [
        ['academy', 'Academy'],
        ['plaza', 'Plazas'],
        [
          'federation',
          'Federation',
        ],
      ],
      [],
    )

  const changeTab = (tab) => {
    setActiveTab(tab)
    saveWalletTab(tab)
  }

  const updateWithdrawal = (
    key,
    value,
  ) => {
    setWithdrawal(
      (current) => ({
        ...current,
        [key]: value,
      }),
    )
  }

  const submitWithdrawal =
    async (event) => {
      event.preventDefault()

      const amount =
        Number(
          withdrawal.amount ||
            0,
        )

      if (
        !amount ||
        amount <= 0
      ) {
        onToast?.(
          'Enter a valid withdrawal amount.',
          'error',
        )
        return
      }

      const payload = {
        sourceDivision:
          'wallet',

        sourceFeature:
          'universal_withdrawal',

        amount,

        currency:
          String(
            withdrawal.currency ||
              'USD',
          ).toUpperCase(),

        method:
          withdrawal.method,

        bankCountry:
          withdrawal.bankCountry,

        bankName:
          withdrawal.bankName,

        accountName:
          withdrawal.accountName,

        accountNumber:
          withdrawal.accountNumber,

        cardNumber:
          withdrawal.accountNumber,

        cryptoCurrency:
          withdrawal.cryptoCurrency,

        cryptoNetwork:
          withdrawal.cryptoNetwork,

        walletAddress:
          withdrawal.walletAddress,

        note:
          withdrawal.walletAddress,
      }

      setSubmitting(true)

      try {
        await requestWalletWithdrawal(payload)

        onToast?.(
          'Withdrawal request submitted for admin review.',
          'success',
        )

        setWithdrawal(
          EMPTY_WITHDRAWAL,
        )

        await loadWallet(
          payload.currency,
        )

        changeTab(
          'payout-history',
        )
      } catch (
        submitError
      ) {
        onToast?.(
          submitError?.message ||
            'Failed to submit withdrawal request.',
          'error',
        )
      } finally {
        setSubmitting(false)
      }
    }

  return (
    <section
      id="yhu-react-wallet"
      className="yhu-react-wallet"
      role="region"
      aria-label="Universal Wallet"
      data-yh-dashboard-react-surface="wallet"
    >
      <div className="yhu-wallet-surface">
        <header className="yhu-wallet-header">
          <div>
            <p className="yhu-wallet-eyebrow">YH UNIVERSE</p>
            <h1>Universal Wallet</h1>
            <p className="yhu-wallet-subtitle">
              Manage your balance, payment methods and payout requests.
            </p>
          </div>
        </header>
        <div className="yhu-wallet-inline-tabs">
          {WALLET_TABS.map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                className={`yhu-wallet-inline-tab ${
                  activeTab === key
                    ? 'is-active'
                    : ''
                }`}
                role="tab"
                aria-selected={
                  activeTab ===
                  key
                    ? 'true'
                    : 'false'
                }
                onClick={() =>
                  changeTab(
                    key,
                  )
                }
              >
                {label}
              </button>
            ),
          )}
        </div>

        {loading && (
          <div className="yhu-wallet-empty">
            Refreshing wallet...
          </div>
        )}

        {error && (
          <div className="yhu-wallet-empty">
            {error}
          </div>
        )}

        {activeTab ===
          'overview' && (
          <>
            <div className="yhu-wallet-stats">
              <article className="yhu-wallet-stat-card is-primary">
                <span>
                  Available to Withdraw
                </span>

                <strong>
                  {formatMoney(
                    balance.available ||
                      0,
                    currency,
                  )}
                </strong>

                <small>
                  This is the amount you can request after reserved withdrawals are removed.
                </small>
              </article>

              <article className="yhu-wallet-stat-card">
                <span>
                  Total Approved Earnings
                </span>

                <strong>
                  {formatMoney(
                    balance.approvedEarnings ||
                      0,
                    currency,
                  )}
                </strong>

                <small>
                  Money already approved from YH economy activities.
                </small>
              </article>

              <article className="yhu-wallet-stat-card">
                <span>
                  Reserved Withdrawals
                </span>

                <strong>
                  {formatMoney(
                    balance.reservedWithdrawals ||
                      0,
                    currency,
                  )}
                </strong>

                <small>
                  Funds already tied to pending, approved, processing, or paid payout requests.
                </small>
              </article>
            </div>

            <section className="yhu-wallet-panel yhu-wallet-division-panel">
              <div className="yhu-wallet-panel-head">
                <h3>
                  Division Balance Breakdown
                </h3>

                <span>
                  Academy, the Plazas, and Federation earnings tracked through the same wallet layer.
                </span>
              </div>

              <div className="yhu-wallet-division-breakdown">
                {divisions.map(
                  ([key, label]) => {
                    const item =
                      breakdown[
                        key
                      ] || {}

                    const approved =
                      Number(
                        item.approvedEarnings ||
                          0,
                      )

                    const reserved =
                      Number(
                        item.reservedWithdrawals ||
                          0,
                      )

                    const available =
                      Number(
                        item.available ??
                          Math.max(
                            0,
                            approved -
                              reserved,
                          ),
                      )

                    return (
                      <article
                        key={key}
                        className="yhu-wallet-division-card"
                      >
                        <div>
                          <span>
                            {label}
                          </span>

                          <strong>
                            {formatMoney(
                              available,
                              currency,
                            )}
                          </strong>
                        </div>

                        <small>
                          Approved:{' '}
                          {formatMoney(
                            approved,
                            currency,
                          )}{' '}
                          · Reserved:{' '}
                          {formatMoney(
                            reserved,
                            currency,
                          )}
                        </small>
                      </article>
                    )
                  },
                )}
              </div>
            </section>

            <button
              type="button"
              className="yhu-wallet-refresh"
              disabled={loading}
              onClick={() =>
                loadWallet(
                  withdrawal.currency,
                )
                  .then(() =>
                    onToast?.(
                      'Wallet refreshed.',
                      'success',
                    ),
                  )
                  .catch(() => {})
              }
            >
              {loading
                ? 'Refreshing...'
                : 'Refresh Wallet'}
            </button>
          </>
        )}

        {activeTab ===
          'payment-methods' && (
          <section className="yhu-wallet-panel">
            <div className="yhu-wallet-panel-head">
              <div>
                <h3>
                  Payment Methods
                </h3>

                <p className="yhu-wallet-panel-copy">
                  How users can pay into the YH economy.
                </p>
              </div>
            </div>

            <div className="yhu-wallet-method-list">
              <MethodList
                methods={
                  snapshot.paymentProviders ||
                  []
                }
              />
            </div>
          </section>
        )}

        {activeTab ===
          'payout-methods' && (
          <section className="yhu-wallet-panel">
            <div className="yhu-wallet-panel-head">
              <div>
                <h3>
                  Payout Methods
                </h3>

                <p className="yhu-wallet-panel-copy">
                  How approved earnings can be withdrawn after admin review.
                </p>
              </div>
            </div>

            <div className="yhu-wallet-method-list">
              <MethodList
                methods={
                  snapshot.payoutMethods ||
                  []
                }
              />
            </div>
          </section>
        )}

        {activeTab ===
          'request-withdrawal' && (
          <section className="yhu-wallet-panel yhu-wallet-withdraw-panel">
            <div className="yhu-wallet-panel-head">
              <div>
                <h3>
                  Request Withdrawal
                </h3>

                <p className="yhu-wallet-panel-copy">
                  Use this when you already have available balance. Fill only the payout details relevant to your selected method.
                </p>
              </div>

              <span>
                Admin-reviewed payout
              </span>
            </div>

            <form
              className="yhu-wallet-withdrawal-form"
              onSubmit={
                submitWithdrawal
              }
            >
              <div className="yhu-wallet-form-grid">
                <label className="yhu-wallet-field">
                  <span>
                    Amount
                  </span>

                  <input
                    className="yhu-wallet-input"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="100"
                    value={
                      withdrawal.amount
                    }
                    onChange={(
                      event,
                    ) =>
                      updateWithdrawal(
                        'amount',
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="yhu-wallet-field">
                  <span>
                    Currency
                  </span>

                  <select
                    className="yhu-wallet-input"
                    value={
                      withdrawal.currency
                    }
                    onChange={(
                      event,
                    ) =>
                      updateWithdrawal(
                        'currency',
                        event
                          .target
                          .value,
                      )
                    }
                  >
                    <option value="USD">
                      USD
                    </option>
                    <option value="EUR">
                      EUR
                    </option>
                    <option value="NGN">
                      NGN
                    </option>
                    <option value="PHP">
                      PHP
                    </option>
                    <option value="INR">
                      INR
                    </option>
                  </select>
                </label>

                <label className="yhu-wallet-field">
                  <span>
                    Payout Method
                  </span>

                  <select
                    className="yhu-wallet-input"
                    value={
                      withdrawal.method
                    }
                    onChange={(
                      event,
                    ) =>
                      updateWithdrawal(
                        'method',
                        event
                          .target
                          .value,
                      )
                    }
                  >
                    <option value="local_bank">
                      Local Bank
                    </option>

                    <option value="card">
                      Card
                    </option>

                    <option value="crypto">
                      Crypto Wallet
                    </option>
                  </select>
                </label>

                <label className="yhu-wallet-field">
                  <span>
                    Bank Country
                  </span>

                  <input
                    className="yhu-wallet-input"
                    type="text"
                    placeholder="Spain, Germany..."
                    value={
                      withdrawal.bankCountry
                    }
                    onChange={(
                      event,
                    ) =>
                      updateWithdrawal(
                        'bankCountry',
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="yhu-wallet-field">
                  <span>
                    Bank Name
                  </span>

                  <input
                    className="yhu-wallet-input"
                    type="text"
                    placeholder="Bank name"
                    value={
                      withdrawal.bankName
                    }
                    onChange={(
                      event,
                    ) =>
                      updateWithdrawal(
                        'bankName',
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="yhu-wallet-field">
                  <span>
                    Account Name
                  </span>

                  <input
                    className="yhu-wallet-input"
                    type="text"
                    placeholder="Account name"
                    value={
                      withdrawal.accountName
                    }
                    onChange={(
                      event,
                    ) =>
                      updateWithdrawal(
                        'accountName',
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="yhu-wallet-field">
                  <span>
                    Account Number / Card Number
                  </span>

                  <input
                    className="yhu-wallet-input"
                    type="text"
                    placeholder="Account or card number"
                    value={
                      withdrawal.accountNumber
                    }
                    onChange={(
                      event,
                    ) =>
                      updateWithdrawal(
                        'accountNumber',
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="yhu-wallet-field">
                  <span>
                    Crypto Currency
                  </span>

                  <input
                    className="yhu-wallet-input"
                    type="text"
                    placeholder="USDT, BTC..."
                    value={
                      withdrawal.cryptoCurrency
                    }
                    onChange={(
                      event,
                    ) =>
                      updateWithdrawal(
                        'cryptoCurrency',
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="yhu-wallet-field">
                  <span>
                    Crypto Network
                  </span>

                  <input
                    className="yhu-wallet-input"
                    type="text"
                    placeholder="TRC20, ERC20, BTC..."
                    value={
                      withdrawal.cryptoNetwork
                    }
                    onChange={(
                      event,
                    ) =>
                      updateWithdrawal(
                        'cryptoNetwork',
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <label className="yhu-wallet-field yhu-wallet-form-wide">
                  <span>
                    Wallet Address / Note
                  </span>

                  <textarea
                    className="yhu-wallet-input"
                    rows="3"
                    placeholder="Wallet address or payout note..."
                    value={
                      withdrawal.walletAddress
                    }
                    onChange={(
                      event,
                    ) =>
                      updateWithdrawal(
                        'walletAddress',
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>
              </div>

              <button
                type="submit"
                className="yhu-wallet-submit"
                disabled={
                  submitting
                }
              >
                {submitting
                  ? 'Submitting...'
                  : 'Submit Withdrawal Request'}
              </button>
            </form>
          </section>
        )}

        {activeTab ===
          'payment-history' && (
          <section className="yhu-wallet-panel">
            <div className="yhu-wallet-panel-head">
              <div>
                <h3>
                  Payment History
                </h3>

                <p className="yhu-wallet-panel-copy">
                  Badge payments, Plazas payments, Federation payments, and other money-in records.
                </p>
              </div>
            </div>

            <div className="yhu-wallet-ledger-list">
              <Ledger
                records={
                  snapshot.payments ||
                  []
                }
                type="payment"
              />
            </div>
          </section>
        )}

        {activeTab ===
          'payout-history' && (
          <section className="yhu-wallet-panel">
            <div className="yhu-wallet-panel-head">
              <div>
                <h3>
                  Payout History
                </h3>

                <p className="yhu-wallet-panel-copy">
                  Withdrawal requests and admin payout status updates.
                </p>
              </div>
            </div>

            <div className="yhu-wallet-ledger-list">
              <Ledger
                records={
                  snapshot.payouts ||
                  []
                }
                type="payout"
              />
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
