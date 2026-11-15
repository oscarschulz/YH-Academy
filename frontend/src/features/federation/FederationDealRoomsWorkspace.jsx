import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import './FederationDealRoomsWorkspace.css'

const SERVER_COMMISSION_RATE = 20

const EMPTY_FORM = {
  roomType: 'partnership',
  currency: 'USD',
  expectedValueAmount: '',
  title: '',
  description: '',
  partnerNeed: '',
  academyMissionNeed: '',
}

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function roomTypeLabel(value = '') {
  const labels = {
    partnership: 'Partnership',
    collaboration: 'Collaboration',
    joint_venture: 'Joint Venture',
    operator_hiring: 'Operator Hiring',
    investment: 'Investment',
    service_deal: 'Service Deal',
  }

  return (
    labels[
      clean(value).toLowerCase()
    ] ||
    'Partnership'
  )
}

function statusLabel(value = '') {
  const labels = {
    pending_admin_review:
      'Pending Admin Review',

    approved:
      'Approved',

    in_discussion:
      'In Discussion',

    commission_due:
      'Commission Due',

    commission_paid:
      'Commission Paid',

    closed:
      'Closed',

    rejected:
      'Rejected',
  }

  return (
    labels[
      clean(value).toLowerCase()
    ] ||
    'Pending Admin Review'
  )
}

function formatMoney(
  amount = 0,
  currency = 'USD',
) {
  const numeric =
    Number(amount || 0)

  const code =
    clean(currency)
      .toUpperCase() ||
    'USD'

  if (
    !Number.isFinite(numeric) ||
    numeric <= 0
  ) {
    return '—'
  }

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: 'currency',
        currency: code,
        maximumFractionDigits: 0,
      },
    ).format(numeric)
  } catch {
    return `${code} ${numeric.toLocaleString()}`
  }
}

function formatDate(value = '') {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return clean(value) ||
      'Pending'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date)
}

function normalizeRoom(
  raw = {},
  index = 0,
) {
  return {
    ...raw,

    id:
      clean(raw.id) ||
      `deal-room-${index + 1}`,

    title:
      clean(raw.title) ||
      'Federation Deal Room',

    roomType:
      clean(
        raw.roomType ||
          raw.type,
      ) ||
      'partnership',

    description:
      clean(
        raw.description ||
          raw.text,
      ),

    partnerNeed:
      clean(
        raw.partnerNeed,
      ),

    expectedValueAmount:
      Number(
        raw.expectedValueAmount ||
          0,
      ),

    currency:
      clean(raw.currency)
        .toUpperCase() ||
      'USD',

    platformCommissionRate:
      Number(
        raw.platformCommissionRate ||
          SERVER_COMMISSION_RATE,
      ),

    platformCommissionAmount:
      Number(
        raw.platformCommissionAmount ||
          0,
      ),

    adminStatus:
      clean(
        raw.adminStatus,
      ) ||
      'pending_admin_review',

    dealStatus:
      clean(
        raw.dealStatus,
      ) ||
      'proposed',

    commissionStatus:
      clean(
        raw.commissionStatus,
      ) ||
      'pending',

    creatorName:
      clean(
        raw.creatorName,
      ) ||
      'Federation Member',

    academyMissionNeed:
      clean(
        raw.academyMissionNeed,
      ),

    linkedPlazaOpportunityId:
      clean(
        raw.linkedPlazaOpportunityId,
      ),

    adminNotes:
      clean(
        raw.adminNotes,
      ),

    createdAt:
      clean(
        raw.createdAt,
      ),

    updatedAt:
      clean(
        raw.updatedAt ||
          raw.createdAt,
      ),
  }
}

export default function FederationDealRoomsWorkspace({
  refreshVersion = 0,
  onDataChanged,
  onToast,
}) {
  const [
    rooms,
    setRooms,
  ] = useState([])

  const [
    approved,
    setApproved,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    refreshing,
    setRefreshing,
  ] = useState(false)

  const [
    submitting,
    setSubmitting,
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

  const loadRooms =
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
          const me =
            await apiFetch(
              '/api/federation/me',
              {
                method:
                  'GET',

                cache:
                  'no-store',
              },
            )

          const canEnter =
            me?.canEnterFederation ===
              true ||
            clean(
              me?.applicationStatus,
            ).toLowerCase() ===
              'approved'

          setApproved(
            canEnter,
          )

          if (!canEnter) {
            setRooms([])
            return
          }

          const result =
            await apiFetch(
              '/api/federation/deal-rooms',
              {
                method:
                  'GET',

                cache:
                  'no-store',
              },
            )

          setRooms(
            safeArray(
              result?.rooms,
            ).map(
              normalizeRoom,
            ),
          )
        } catch (
          loadError
        ) {
          const message =
            loadError?.message ||
            'Could not load Federation Deal Rooms.'

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
    void loadRooms(refreshVersion > 0)
  }, [loadRooms, refreshVersion])

  const pendingCount =
    useMemo(
      () =>
        rooms.filter(
          (room) =>
            clean(
              room.adminStatus,
            ).toLowerCase() ===
            'pending_admin_review',
        ).length,
      [rooms],
    )

  const totalExpectedValue =
    useMemo(
      () =>
        rooms.reduce(
          (
            total,
            room,
          ) =>
            total +
            Number(
              room.expectedValueAmount ||
                0,
            ),
          0,
        ),
      [rooms],
    )

  const expectedCommission =
    useMemo(() => {
      const amount =
        Math.max(
          0,
          Number(
            form.expectedValueAmount ||
              0,
          ),
        )

      return Math.round(
        (amount *
          SERVER_COMMISSION_RATE) /
          100,
      )
    }, [
      form.expectedValueAmount,
    ])

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

  const submitRoom =
    async (event) => {
      event.preventDefault()

      if (submitting) {
        return
      }

      const payload = {
        roomType:
          clean(
            form.roomType,
          ) ||
          'partnership',

        currency:
          clean(
            form.currency,
          )
            .toUpperCase()
            .slice(0, 8) ||
          'USD',

        expectedValueAmount:
          Math.max(
            0,
            Number(
              form.expectedValueAmount ||
                0,
            ),
          ),

        title:
          clean(
            form.title,
          ).slice(
            0,
            140,
          ),

        description:
          clean(
            form.description,
          ).slice(
            0,
            1600,
          ),

        partnerNeed:
          clean(
            form.partnerNeed,
          ).slice(
            0,
            900,
          ),

        academyMissionNeed:
          clean(
            form.academyMissionNeed,
          ).slice(
            0,
            900,
          ),
      }

      if (!payload.title) {
        onToast?.(
          'Deal room title is required.',
          'error',
        )

        return
      }

      if (
        !payload.description
      ) {
        onToast?.(
          'Deal room description is required.',
          'error',
        )

        return
      }

      setSubmitting(true)

      try {
        const result =
          await apiFetch(
            '/api/federation/deal-rooms',
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  payload,
                ),
            },
          )

        const room =
          result?.room
            ? normalizeRoom(
                result.room,
              )
            : null

        if (!room) {
          throw new Error(
            'Federation Deal Room response was incomplete.',
          )
        }

        setRooms(
          (current) => [
            room,

            ...current.filter(
              (item) =>
                item.id !==
                room.id,
            ),
          ],
        )

        onDataChanged?.()
        setForm(
          EMPTY_FORM,
        )

        onToast?.(
          'Deal Room submitted. Admin can now review and supervise it.',
          'success',
        )
      } catch (
        submitError
      ) {
        onToast?.(
          submitError?.message ||
            'Failed to submit Deal Room.',
          'error',
        )
      } finally {
        setSubmitting(false)
      }
    }

  if (loading) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-deal-rooms-react-workspace">
        <div className="yh-federation-deal-state">
          Loading Federation
          Deal Rooms...
        </div>
      </section>
    )
  }

  if (!approved) {
    return (
      <section className="yh-dashboard-react-workspace yh-federation-deal-rooms-react-workspace">
        <div className="yh-federation-deal-state">
          <span className="yh-federation-deal-kicker">
            Federation Deal Rooms
          </span>

          <h1>
            Federation approval
            required
          </h1>

          <p>
            Deal Rooms unlock
            after Federation
            access is approved.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      className="yh-dashboard-react-workspace yh-federation-deal-rooms-react-workspace"
      data-yh-dashboard-react-surface="federation-deal-rooms"
    >
      <div className="yh-federation-deal-scroll">
        <div className="yh-federation-deal-shell">
          <header className="yh-federation-deal-hero">
            <div>
              <span className="yh-federation-deal-kicker">
                Federation /
                Deal Rooms
              </span>

              <h1>
                Admin-Supervised
                Deal Rooms
              </h1>

              <p>
                Structured
                business rooms
                for partnerships,
                collaborations,
                operator hiring,
                investments, and
                service deals
                inside the
                Federation
                network.
              </p>

              <div className="yh-federation-deal-pills">
                <span>
                  Partnerships
                </span>

                <span>
                  Collabs
                </span>

                <span>
                  Operator Hiring
                </span>

                <span>
                  Commission Tracked
                </span>
              </div>
            </div>

            <button
              type="button"
              className="yh-fed-action yh-fed-action-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadRooms(
                  true,
                )
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          <section className="yh-federation-deal-summary">
            <article>
              <small>
                Your Deal Rooms
              </small>

              <strong>
                {
                  rooms.length
                }
              </strong>
            </article>

            <article>
              <small>
                Admin Review
              </small>

              <strong>
                {
                  pendingCount
                }
              </strong>
            </article>

            <article>
              <small>
                Expected Value
              </small>

              <strong>
                {totalExpectedValue
                  ? totalExpectedValue.toLocaleString()
                  : '0'}
              </strong>
            </article>

            <article>
              <small>
                Platform Rate
              </small>

              <strong>
                20%
              </strong>
            </article>
          </section>

          <form
            className="yh-federation-deal-form"
            onSubmit={
              submitRoom
            }
          >
            <div className="yh-federation-deal-form-head">
              <div>
                <span className="yh-federation-deal-kicker">
                  Open a Deal Room
                </span>

                <h2>
                  Submit a
                  supervised
                  business route
                </h2>

                <p>
                  Admin reviews the
                  room and tracks
                  participants,
                  expected value,
                  commission, and
                  next actions.
                </p>
              </div>
            </div>

            <div className="yh-federation-deal-form-grid">
              <label>
                <span>
                  Room Type
                </span>

                <select
                  className="input-field"
                  value={
                    form.roomType
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'roomType',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="partnership">
                    Partnership
                  </option>

                  <option value="collaboration">
                    Collaboration
                  </option>

                  <option value="joint_venture">
                    Joint Venture
                  </option>

                  <option value="operator_hiring">
                    Operator Hiring
                  </option>

                  <option value="investment">
                    Investment
                    Discussion
                  </option>

                  <option value="service_deal">
                    Service Deal
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Currency
                </span>

                <input
                  className="input-field"
                  maxLength={8}
                  value={
                    form.currency
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'currency',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Expected Deal
                  Value
                </span>

                <input
                  className="input-field"
                  type="number"
                  min="0"
                  step="1"
                  value={
                    form.expectedValueAmount
                  }
                  placeholder="0"
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'expectedValueAmount',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Platform
                  Commission
                </span>

                <input
                  className="input-field"
                  value="20% — server controlled"
                  readOnly
                />
              </label>

              <label className="is-wide">
                <span>
                  Deal Room Title
                </span>

                <input
                  className="input-field"
                  required
                  maxLength={140}
                  value={
                    form.title
                  }
                  placeholder="Dubai real estate partner needed"
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
                  Deal Description
                </span>

                <textarea
                  className="input-field"
                  required
                  rows="4"
                  maxLength={1600}
                  value={
                    form.description
                  }
                  placeholder="Explain the business opportunity, people involved, and what admin should know."
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'description',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  What kind of
                  partner or
                  collaborator do
                  you need?
                </span>

                <textarea
                  className="input-field"
                  rows="3"
                  maxLength={900}
                  value={
                    form.partnerNeed
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'partnerNeed',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Can Academy
                  operators help
                  with this?
                </span>

                <textarea
                  className="input-field"
                  rows="3"
                  maxLength={900}
                  value={
                    form.academyMissionNeed
                  }
                  placeholder="Research, lead sourcing, outreach list, contact discovery, due diligence..."
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'academyMissionNeed',
                      event.target
                        .value,
                    )
                  }
                />
              </label>
            </div>

            <div className="yh-federation-deal-preview">
              <div>
                <small>
                  Expected Value
                </small>

                <strong>
                  {formatMoney(
                    form.expectedValueAmount,
                    form.currency,
                  )}
                </strong>
              </div>

              <div>
                <small>
                  Server Commission
                </small>

                <strong>
                  {formatMoney(
                    expectedCommission,
                    form.currency,
                  )}
                </strong>
              </div>
            </div>

            <div className="yh-federation-deal-form-actions">
              <small>
                The 20% platform
                commission is
                calculated and
                enforced by the
                backend. The client
                cannot change it.
              </small>

              <button
                type="submit"
                className="yh-fed-action yh-fed-action-primary"
                disabled={
                  submitting
                }
              >
                {submitting
                  ? 'Submitting...'
                  : 'Open Deal Room'}
              </button>
            </div>
          </form>

          {error && (
            <div className="yh-federation-deal-state is-error">
              {error}
            </div>
          )}

          {!error &&
            !rooms.length && (
              <div className="yh-federation-deal-state">
                <strong>
                  No Federation
                  Deal Rooms yet.
                </strong>

                <span>
                  Submit a
                  partnership,
                  collaboration,
                  hiring,
                  investment, or
                  service deal
                  above.
                </span>
              </div>
            )}

          <div className="yh-federation-deal-list">
            {rooms.map(
              (room) => (
                <article
                  className="yh-federation-deal-card"
                  key={
                    room.id
                  }
                >
                  <div className="yh-federation-deal-card-head">
                    <div>
                      <span className="yh-federation-deal-kicker">
                        {roomTypeLabel(
                          room.roomType,
                        )}
                      </span>

                      <h3>
                        {
                          room.title
                        }
                      </h3>
                    </div>

                    <b>
                      {statusLabel(
                        room.adminStatus,
                      )}
                    </b>
                  </div>

                  <p>
                    {room.description ||
                      'No deal room description stored.'}
                  </p>

                  <div className="yh-federation-deal-metrics">
                    <div>
                      <strong>
                        {formatMoney(
                          room.expectedValueAmount,
                          room.currency,
                        )}
                      </strong>

                      <small>
                        Expected
                        value
                      </small>
                    </div>

                    <div>
                      <strong>
                        {room.platformCommissionRate ||
                          SERVER_COMMISSION_RATE}
                        %
                      </strong>

                      <small>
                        Platform
                        commission
                      </small>
                    </div>

                    <div>
                      <strong>
                        {formatMoney(
                          room.platformCommissionAmount,
                          room.currency,
                        )}
                      </strong>

                      <small>
                        Commission
                        estimate
                      </small>
                    </div>

                    <div>
                      <strong>
                        {formatDate(
                          room.createdAt,
                        )}
                      </strong>

                      <small>
                        Submitted
                      </small>
                    </div>
                  </div>

                  {room.partnerNeed && (
                    <div className="yh-federation-deal-note">
                      <strong>
                        Partner need
                      </strong>

                      <span>
                        {
                          room.partnerNeed
                        }
                      </span>
                    </div>
                  )}

                  {room.academyMissionNeed && (
                    <div className="yh-federation-deal-note">
                      <strong>
                        Academy support
                      </strong>

                      <span>
                        {
                          room.academyMissionNeed
                        }
                      </span>
                    </div>
                  )}

                  {room.adminNotes && (
                    <div className="yh-federation-deal-note is-admin">
                      <strong>
                        Admin notes
                      </strong>

                      <span>
                        {
                          room.adminNotes
                        }
                      </span>
                    </div>
                  )}

                  <div className="yh-federation-deal-status-row">
                    <span>
                      Deal:{' '}
                      {room.dealStatus}
                    </span>

                    <span>
                      Commission:{' '}
                      {room.commissionStatus}
                    </span>

                    <span>
                      Creator:{' '}
                      {room.creatorName}
                    </span>
                  </div>
                </article>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
