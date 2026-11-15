import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'
import { PLAZA_CANONICAL_REGIONS } from './plazaCanonicalRegions'
import './PlazaMeetupsWorkspace.css'

const EMPTY_FORM = {
  regionId: '',
  format: 'in-person',
  title: '',
  scheduledAt: '',
  location: '',
  description: '',
}

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function normalizeMeetup(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `server-meetup-${index + 1}`,

    title:
      clean(item.title) ||
      'Plaza meetup',

    regionId:
      clean(item.regionId),

    region:
      clean(item.region) ||
      'YH Plaza',

    format:
      clean(item.format) ||
      'in-person',

    location:
      clean(item.location),

    scheduledAt:
      clean(
        item.scheduledAt ||
          item.startsAt ||
          item.startAt,
      ),

    description:
      clean(
        item.description ||
          item.text,
      ),

    patronName:
      clean(item.patronName) ||
      'Plaza Patron',

    patronRole:
      clean(item.patronRole) ||
      'Regional Patron',

    isOfficial:
      item.isOfficial === true,

    officialByPatron:
      item.officialByPatron ===
      true,

    officialPatronUserId:
      clean(
        item.officialPatronUserId,
      ),

    officialPatronName:
      clean(
        item.officialPatronName,
      ),

    patronStatusNote:
      clean(
        item.patronStatusNote,
      ),

    featuredByPatron:
      item.featuredByPatron ===
      true,

    hostName:
      clean(item.hostName) ||
      'Hustler',

    attendeeCount:
      Number(
        item.attendeeCount ||
          0,
      ) || 0,

    canManage:
      item.canManage === true,

    status:
      clean(item.status) ||
      'planned',

    createdAt:
      clean(item.createdAt),

    updatedAt:
      clean(
        item.updatedAt ||
          item.createdAt,
      ),
  }
}

function normalizeRegion(
  item = {},
  index = 0,
) {
  return {
    ...item,

    id:
      clean(item.id) ||
      `region-${index + 1}`,

    region:
      clean(
        item.region ||
          item.name,
      ) ||
      'Plaza Region',

    patronName:
      clean(
        item.patronName,
      ),

    countries:
      safeArray(
        item.countries,
      ),
  }
}

function mergeRegions(
  serverRegions = [],
) {
  const map =
    new Map()

  PLAZA_CANONICAL_REGIONS
    .map(
      normalizeRegion,
    )
    .forEach(
      (region) => {
        map.set(
          region.id,
          region,
        )
      },
    )

  serverRegions
    .map(
      normalizeRegion,
    )
    .forEach(
      (region) => {
        const current =
          map.get(
            region.id,
          )

        map.set(
          region.id,
          {
            ...(current ||
              {}),
            ...region,

            countries:
              region.countries
                .length
                ? region.countries
                : current
                    ?.countries ||
                  [],
          },
        )
      },
    )

  return Array.from(
    map.values(),
  )
}

function formatDate(
  value = '',
) {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value ||
      'Date pending'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date)
}

function toDateTimeLocal(
  value = '',
) {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return ''
  }

  const local =
    new Date(
      date.getTime() -
        date.getTimezoneOffset() *
          60000,
    )

  return local
    .toISOString()
    .slice(0, 16)
}

function titleCase(
  value = '',
) {
  return clean(value)
    .replace(/[-_]+/g, ' ')
    .replace(
      /\b\w/g,
      (char) =>
        char.toUpperCase(),
    )
}

export default function PlazaMeetupsWorkspace({
  onToast,
}) {
  const formRef =
    useRef(null)

  const prefillHandledRef =
    useRef(false)

  const [
    meetups,
    setMeetups,
  ] = useState([])

  const [
    regions,
    setRegions,
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
    saving,
    setSaving,
  ] = useState(false)

  const [
    editingId,
    setEditingId,
  ] = useState('')

  const [
    deletingId,
    setDeletingId,
  ] = useState('')

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null)

  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM,
  )

  const loadMeetups =
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
            meetupResult,
            regionResult,
          ] =
            await Promise.allSettled([
              apiFetch(
                '/api/plaza/meetups?limit=120',
                {
                  method:
                    'GET',
                  cache:
                    'no-store',
                },
              ),

              apiFetch(
                '/api/plaza/regions?limit=80',
                {
                  method:
                    'GET',
                  cache:
                    'no-store',
                },
              ),
            ])

          if (
            meetupResult.status ===
            'fulfilled'
          ) {
            setMeetups(
              safeArray(
                meetupResult
                  .value
                  ?.meetups,
              ).map(
                normalizeMeetup,
              ),
            )
          } else {
            throw (
              meetupResult.reason ||
              new Error(
                'Could not load Plaza meetups.',
              )
            )
          }

          if (
            regionResult.status ===
            'fulfilled'
          ) {
            setRegions(
              mergeRegions(
                safeArray(
                  regionResult
                    .value
                    ?.regions,
                ),
              ),
            )
          } else {
            setRegions(
              mergeRegions(
                [],
              ),
            )
          }
        } catch (
          error
        ) {
          onToast?.(
            error?.message ||
              'Could not load Plaza meetups. Please refresh.',
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
    void loadMeetups()
  }, [loadMeetups])

  useEffect(() => {
    if (
      !regions.length ||
      prefillHandledRef.current
    ) {
      return
    }

    prefillHandledRef.current =
      true

    let regionId = ''

    try {
      regionId =
        clean(
          sessionStorage.getItem(
            'yh_plaza_meetup_prefill_region_id',
          ),
        )

      sessionStorage.removeItem(
        'yh_plaza_meetup_prefill_region_id',
      )
    } catch {}

    if (
      regionId &&
      regions.some(
        (region) =>
          region.id ===
          regionId,
      )
    ) {
      setForm(
        (current) => ({
          ...current,
          regionId,
        }),
      )
    }
  }, [regions])

  const sortedMeetups =
    useMemo(
      () =>
        [...meetups].sort(
          (a, b) => {
            const aTime =
              new Date(
                a.scheduledAt ||
                  0,
              ).getTime()

            const bTime =
              new Date(
                b.scheduledAt ||
                  0,
              ).getTime()

            if (
              Number.isNaN(
                aTime,
              ) ||
              Number.isNaN(
                bTime,
              )
            ) {
              return 0
            }

            return (
              aTime -
              bTime
            )
          },
        ),
      [meetups],
    )

  const updateField =
    (
      field,
      value,
    ) => {
      setForm(
        (current) => ({
          ...current,
          [field]:
            value,
        }),
      )
    }

  const resetEditor =
    () => {
      setEditingId('')
      setForm(
        EMPTY_FORM,
      )
    }

  const beginEdit =
    (meetup) => {
      if (
        !meetup?.canManage
      ) {
        onToast?.(
          'You can only edit meetups you created.',
          'error',
        )

        return
      }

      setEditingId(
        meetup.id,
      )

      setForm({
        regionId:
          meetup.regionId,

        format:
          meetup.format ||
          'in-person',

        title:
          meetup.title,

        scheduledAt:
          toDateTimeLocal(
            meetup.scheduledAt,
          ),

        location:
          meetup.location,

        description:
          meetup.description,
      })

      window.setTimeout(
        () => {
          formRef.current?.scrollIntoView(
            {
              behavior:
                'smooth',
              block: 'start',
            },
          )
        },
        0,
      )
    }

  const submitMeetup =
    async (event) => {
      event.preventDefault()

      if (saving) {
        return
      }

      const payload = {
        regionId:
          clean(
            form.regionId,
          ),

        format:
          clean(
            form.format,
          ) ||
          'in-person',

        title:
          clean(
            form.title,
          ),

        scheduledAt:
          clean(
            form.scheduledAt,
          ),

        location:
          clean(
            form.location,
          ),

        description:
          clean(
            form.description,
          ),
      }

      if (
        !payload.regionId
      ) {
        onToast?.(
          'Select a Plaza first.',
          'error',
        )

        return
      }

      if (
        !payload.title ||
        !payload.scheduledAt ||
        !payload.location ||
        !payload.description
      ) {
        onToast?.(
          'Complete the meetup details first.',
          'error',
        )

        return
      }

      setSaving(true)

      try {
        if (editingId) {
          const result =
            await apiFetch(
              `/api/plaza/meetups/${encodeURIComponent(
                editingId,
              )}`,
              {
                method:
                  'PATCH',

                body:
                  JSON.stringify(
                    payload,
                  ),
              },
            )

          const updated =
            result?.meetup
              ? normalizeMeetup(
                  result.meetup,
                )
              : null

          if (!updated) {
            throw new Error(
              'Updated meetup response was incomplete.',
            )
          }

          setMeetups(
            (current) =>
              current.map(
                (item) =>
                  item.id ===
                  editingId
                    ? updated
                    : item,
              ),
          )

          onToast?.(
            'Plaza meetup updated.',
            'success',
          )
        } else {
          const result =
            await apiFetch(
              '/api/plaza/meetups',
              {
                method:
                  'POST',

                body:
                  JSON.stringify(
                    payload,
                  ),
              },
            )

          const created =
            result?.meetup
              ? normalizeMeetup(
                  result.meetup,
                )
              : null

          if (!created) {
            throw new Error(
              'Plaza meetup response was incomplete.',
            )
          }

          setMeetups(
            (current) => [
              created,
              ...current.filter(
                (item) =>
                  item.id !==
                  created.id,
              ),
            ],
          )

          onToast?.(
            'Plaza meetup created.',
            'success',
          )
        }

        resetEditor()
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            (editingId
              ? 'Could not update Plaza meetup.'
              : 'Could not create Plaza meetup.'),
          'error',
        )
      } finally {
        setSaving(false)
      }
    }

  const requestDelete =
    (meetup) => {
      if (
        !meetup?.canManage
      ) {
        onToast?.(
          'You can only delete meetups you created.',
          'error',
        )

        return
      }

      setDeleteTarget(
        meetup,
      )
    }

  const confirmDelete =
    async () => {
      const meetup =
        deleteTarget

      if (
        !meetup ||
        deletingId
      ) {
        return
      }

      setDeletingId(
        meetup.id,
      )

      try {
        await apiFetch(
          `/api/plaza/meetups/${encodeURIComponent(
            meetup.id,
          )}`,
          {
            method:
              'DELETE',
          },
        )

        setMeetups(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                meetup.id,
            ),
        )

        if (
          editingId ===
          meetup.id
        ) {
          resetEditor()
        }

        setDeleteTarget(
          null,
        )

        onToast?.(
          'Plaza meetup deleted.',
          'success',
        )
      } catch (
        error
      ) {
        onToast?.(
          error?.message ||
            'Could not delete this Plaza meetup.',
          'error',
        )
      } finally {
        setDeletingId('')
      }
    }

  return (
    <section
      className="yh-dashboard-react-workspace yh-plaza-meetups-react-workspace"
      data-yh-dashboard-react-surface="plazas-meetups"
    >
      <div className="yh-plaza-meetups-react-scroll">
        <div className="yh-plaza-meetups-react-shell">
          <header className="yh-plaza-react-hero">
            <div>
              <span className="yh-plaza-react-kicker">
                Plazas / Meetups
              </span>

              <h1>
                Plaza Meetup Coordination
              </h1>

              <p>
                Plan regional
                meetups, founder
                circles, local
                networking
                sessions and
                Patron-led Plaza
                gatherings. Every
                meetup stays
                attached to a
                specific Plaza and
                its Patron or
                Leader.
              </p>
            </div>

            <button
              type="button"
              className="btn-secondary"
              disabled={
                refreshing
              }
              onClick={() =>
                void loadMeetups(
                  true,
                )
              }
            >
              {refreshing
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </header>

          <div className="yh-plaza-meetups-meta">
            <span>
              {meetups.length}{' '}
              planned meetups
            </span>
          </div>

          <form
            ref={formRef}
            className="yh-plaza-meetup-form"
            onSubmit={
              submitMeetup
            }
          >
            <div className="yh-plaza-meetup-form-grid">
              <label>
                <span>
                  Plaza / Region
                </span>

                <select
                  className="input-field"
                  required
                  value={
                    form.regionId
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'regionId',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="">
                    Select Plaza
                  </option>

                  {regions.map(
                    (region) => (
                      <option
                        key={
                          region.id
                        }
                        value={
                          region.id
                        }
                      >
                        {region.region}
                        {region.patronName
                          ? ` • ${region.patronName}`
                          : ''}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Meetup Format
                </span>

                <select
                  className="input-field"
                  value={
                    form.format
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'format',
                      event.target
                        .value,
                    )
                  }
                >
                  <option value="in-person">
                    In-person
                  </option>

                  <option value="online">
                    Online
                  </option>

                  <option value="hybrid">
                    Hybrid
                  </option>
                </select>
              </label>

              <label className="is-wide">
                <span>
                  Title
                </span>

                <input
                  className="input-field"
                  required
                  maxLength={140}
                  value={
                    form.title
                  }
                  placeholder="Lagos Builder Meetup, Manila Networking Circle..."
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

              <label>
                <span>
                  Date & Time
                </span>

                <input
                  className="input-field"
                  type="datetime-local"
                  required
                  value={
                    form.scheduledAt
                  }
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'scheduledAt',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Location / Link
                </span>

                <input
                  className="input-field"
                  required
                  maxLength={180}
                  value={
                    form.location
                  }
                  placeholder="Venue, city, or meeting link"
                  onChange={(
                    event,
                  ) =>
                    updateField(
                      'location',
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="is-wide">
                <span>
                  Meetup Brief
                </span>

                <textarea
                  className="input-field"
                  rows="4"
                  required
                  maxLength={1200}
                  value={
                    form.description
                  }
                  placeholder="What is the meetup for? Who should attend? What should members prepare?"
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
            </div>

            <div className="yh-plaza-meetup-form-actions">
              <small>
                Meetups are
                Plaza-level
                coordination items.
                Patrons and Leaders
                can use them to
                turn online
                networking into
                structured local
                movement.
              </small>

              <div>
                {editingId && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={
                      saving
                    }
                    onClick={
                      resetEditor
                    }
                  >
                    Cancel Edit
                  </button>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? editingId
                      ? 'Saving...'
                      : 'Creating...'
                    : editingId
                      ? 'Save Changes'
                      : 'Set Up Meetup'}
                </button>
              </div>
            </div>
          </form>

          {loading && (
            <div className="yh-plaza-react-state">
              Loading Plaza
              meetups...
            </div>
          )}

          {!loading &&
            !sortedMeetups.length && (
              <div className="yh-plaza-react-state">
                No Plaza meetup has
                been planned yet.
              </div>
            )}

          <div className="yh-plaza-meetup-grid-react">
            {sortedMeetups.map(
              (meetup) => (
                <article
                  className="yh-plaza-meetup-card-react"
                  key={
                    meetup.id
                  }
                >
                  <div className="yh-plaza-meetup-card-head">
                    <div>
                      <span>
                        {titleCase(
                          meetup.format,
                        )}
                      </span>

                      {meetup.isOfficial && (
                        <span className="is-official">
                          Official Patron Meetup
                        </span>
                      )}
                    </div>

                    <span>
                      {titleCase(
                        meetup.status,
                      )}
                    </span>
                  </div>

                  <h3>
                    {meetup.title}
                  </h3>

                  <p>
                    {meetup.description ||
                      'No meetup brief added yet.'}
                  </p>

                  <div className="yh-plaza-meetup-details">
                    <div>
                      <small>
                        Plaza
                      </small>

                      <strong>
                        {
                          meetup.region
                        }
                      </strong>
                    </div>

                    <div>
                      <small>
                        Location / Link
                      </small>

                      <strong>
                        {meetup.location ||
                          'Pending'}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Date
                      </small>

                      <strong>
                        {formatDate(
                          meetup.scheduledAt,
                        )}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Attendees
                      </small>

                      <strong>
                        {
                          meetup.attendeeCount
                        }
                      </strong>
                    </div>
                  </div>

                  <div className="yh-plaza-meetup-patron-note">
                    <strong>
                      Patron / Leader:
                    </strong>{' '}
                    {meetup.patronName ||
                      'Plaza Patron'}
                    {' • '}
                    <strong>
                      Host:
                    </strong>{' '}
                    {meetup.hostName ||
                      'Hustler'}
                  </div>

                  {meetup.isOfficial && (
                    <div className="yh-plaza-meetup-official-note">
                      <strong>
                        Official Patron Meetup:
                      </strong>{' '}
                      {meetup.officialPatronName ||
                        meetup.patronName ||
                        'Plaza Patron'}

                      {meetup.patronStatusNote
                        ? ` • ${meetup.patronStatusNote}`
                        : ''}
                    </div>
                  )}

                  {meetup.canManage && (
                    <div className="yh-plaza-meetup-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={
                          saving ||
                          deletingId ===
                            meetup.id
                        }
                        onClick={() =>
                          beginEdit(
                            meetup,
                          )
                        }
                      >
                        Edit Meetup
                      </button>

                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={
                          deletingId ===
                          meetup.id
                        }
                        onClick={() =>
                          requestDelete(
                            meetup,
                          )
                        }
                      >
                        {deletingId ===
                        meetup.id
                          ? 'Deleting...'
                          : 'Delete Meetup'}
                      </button>
                    </div>
                  )}
                </article>
              ),
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content yh-plaza-meetup-delete-modal">
            <span className="yh-plaza-react-kicker">
              Delete Meetup
            </span>

            <h2>
              Delete{' '}
              {deleteTarget.title}?
            </h2>

            <p>
              This removes the
              meetup from Plaza.
              This action cannot be
              undone.
            </p>

            <div className="roadmap-mission-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  Boolean(
                    deletingId,
                  )
                }
                onClick={() =>
                  setDeleteTarget(
                    null,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                disabled={
                  Boolean(
                    deletingId,
                  )
                }
                onClick={() =>
                  void confirmDelete()
                }
              >
                {deletingId
                  ? 'Deleting...'
                  : 'Delete Meetup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
