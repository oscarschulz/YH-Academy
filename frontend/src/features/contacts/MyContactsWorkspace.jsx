import { CONTACTS_ENDPOINT, EMPTY_EXTERNAL, LEAD_SELECT_FIELDS, LEAD_FIELDS, normalizeContact, matchesSearch } from './contactsUtils.js'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'

function ContactCard({
  contact,
  onEdit,
  onDelete,
}) {
  /* YHU_ORIGINAL_CONTACT_ACTION_MENU_PARITY */
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef(null)

  useEffect(() => {
    if (!actionsOpen) return undefined

    const onOutside = event => {
      if (!actionsRef.current?.contains(event.target)) {
        setActionsOpen(false)
      }
    }

    const onEscape = event => {
      if (event.key === 'Escape') setActionsOpen(false)
    }

    document.addEventListener('pointerdown', onOutside)
    document.addEventListener('keydown', onEscape)

    return () => {
      document.removeEventListener('pointerdown', onOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [actionsOpen])

  const displayName =
    contact.fullName ||
    contact.companyName ||
    contact.email ||
    contact.phone ||
    'Unnamed Contact'

  const meta = [
    contact.contactRole,

    contact.companyName &&
    contact.companyName !== displayName
      ? contact.companyName
      : '',

    [
      contact.city,
      contact.country,
    ]
      .filter(Boolean)
      .join(', '),
  ].filter(Boolean)

  const communication = [
    contact.email,
    contact.phone,
  ].filter(Boolean)

  const external =
    contact.contactType === 'external'

  return (
    <article
      className="yh-dashboard-my-contact-card"
      data-yh-my-contact-id={contact.id}
    >
      <div className="yh-dashboard-my-contact-card-head">
        <div>
          <span
            className={`yh-dashboard-my-contact-source ${
              external
                ? 'is-external'
                : 'is-internal'
            }`}
          >
            {external
              ? 'External'
              : 'Academy Mission'}
          </span>

          <h4>
            {displayName}
          </h4>
        </div>

        {contact.id && (
          <div
            className="yh-row-actions"
            data-yh-row-actions
            ref={actionsRef}
          >
            <button
              type="button"
              className="yh-row-actions-trigger"
              data-dashboard-contact-menu-toggle={contact.id}
              aria-label="Open contact actions"
              aria-haspopup="menu"
              aria-expanded={actionsOpen}
              onClick={() => setActionsOpen(value => !value)}
            >
              ⋮
            </button>

            <div
              className="yh-row-actions-menu"
              data-dashboard-contact-menu={contact.id}
              role="menu"
              hidden={!actionsOpen}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActionsOpen(false)
                  onEdit(contact)
                }}
              >
                {external ? 'Edit Contact' : 'Edit Lead'}
              </button>

              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  setActionsOpen(false)
                  onDelete(contact)
                }}
              >
                {external ? 'Delete Contact' : 'Delete Lead'}
              </button>
            </div>
          </div>
        )}
      </div>

      {meta.length > 0 && (
        <p className="yh-dashboard-my-contact-meta">
          {meta.join(' • ')}
        </p>
      )}

      {communication.length > 0 && (
        <p className="yh-dashboard-my-contact-communication">
          {communication.join(' • ')}
        </p>
      )}

      {contact.notes && (
        <p className="yh-dashboard-my-contact-notes">
          {contact.notes}
        </p>
      )}

      {!external &&
        contact.sourceMissionTitle && (
          <div className="yh-dashboard-my-contact-mission">
            Source:{' '}
            {contact.sourceMissionTitle}
          </div>
        )}
    </article>
  )
}

export default function MyContactsWorkspace({
  onToast,
}) {
  const [
    internalContacts,
    setInternalContacts,
  ] = useState([])

  const [
    externalContacts,
    setExternalContacts,
  ] = useState([])

  const [activeTab, setActiveTab] =
    useState('internal')

  const [search, setSearch] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const [loaded, setLoaded] =
    useState(false)

  const [
    externalFormOpen,
    setExternalFormOpen,
  ] = useState(false)

  const [
    editingExternalId,
    setEditingExternalId,
  ] = useState('')

  const [
    externalForm,
    setExternalForm,
  ] = useState(
    EMPTY_EXTERNAL,
  )

  const [
    externalError,
    setExternalError,
  ] = useState('')

  const [
    externalSaving,
    setExternalSaving,
  ] = useState(false)

  const [
    leadEditorOpen,
    setLeadEditorOpen,
  ] = useState(false)

  const [
    leadEditorId,
    setLeadEditorId,
  ] = useState('')

  const [
    leadDraft,
    setLeadDraft,
  ] = useState({
    currency: 'USD',
    saleEnabled: 'false',
    notes: '',
  })

  const [
    leadLoading,
    setLeadLoading,
  ] = useState(false)

  const [
    leadSaving,
    setLeadSaving,
  ] = useState(false)

  const [
    leadError,
    setLeadError,
  ] = useState('')

  /* YHU_CONTACTS_LOAD_ERROR_PATCH12 */
  const [contactsError, setContactsError] = useState('')

  const loadContacts =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        setLoading(true)

        try {
          const result =
            await apiFetch(
              CONTACTS_ENDPOINT,
              {
                method: 'GET',
              },
            )

          setInternalContacts(
            Array.isArray(
              result?.internalContacts,
            )
              ? result.internalContacts.map(
                  (item) =>
                    normalizeContact(
                      item,
                      'internal',
                    ),
                )
              : [],
          )

          setExternalContacts(
            Array.isArray(
              result?.externalContacts,
            )
              ? result.externalContacts.map(
                  (item) =>
                    normalizeContact(
                      item,
                      'external',
                    ),
                )
              : [],
          )

          setContactsError('')
          setLoaded(true)
        } catch (error) {
          setContactsError(
            error?.message || 'Failed to load contacts.'
          )
          if (!silent) {
            onToast?.(
              error?.message ||
                'Failed to load contacts.',
              'error',
            )
          }
        } finally {
          setLoading(false)
        }
      },
      [onToast],
    )

  useEffect(() => {
    loadContacts({
      silent: false,
    })
  }, [loadContacts])

  const activeItems =
    activeTab === 'external'
      ? externalContacts
      : internalContacts

  const visibleItems =
    useMemo(
      () =>
        activeItems.filter(
          (contact) =>
            matchesSearch(
              contact,
              search,
            ),
        ),
      [
        activeItems,
        search,
      ],
    )

  const changeTab = (tab) => {
    setActiveTab(
      tab === 'external'
        ? 'external'
        : 'internal',
    )

    setSearch('')
    setExternalFormOpen(false)
    setEditingExternalId('')
    setExternalForm(
      EMPTY_EXTERNAL,
    )
    setExternalError('')
    setLeadEditorOpen(false)
  }

  const openExternalForm = (
    contact = null,
  ) => {
    setActiveTab('external')
    setExternalError('')

    if (contact?.id) {
      setEditingExternalId(
        contact.id,
      )

      setExternalForm({
        fullName:
          contact.fullName || '',
        companyName:
          contact.companyName ||
          '',
        contactRole:
          contact.contactRole ||
          '',
        email:
          contact.email || '',
        phone:
          contact.phone || '',
        city:
          contact.city || '',
        country:
          contact.country || '',
        notes:
          contact.notes || '',
      })
    } else {
      setEditingExternalId(
        '',
      )

      setExternalForm(
        EMPTY_EXTERNAL,
      )
    }

    setExternalFormOpen(
      true,
    )
  }

  const saveExternal =
    async (event) => {
      event.preventDefault()

      const payload = {
        fullName:
          externalForm.fullName.trim(),

        companyName:
          externalForm.companyName.trim(),

        contactRole:
          externalForm.contactRole.trim(),

        email:
          externalForm.email
            .trim()
            .toLowerCase(),

        phone:
          externalForm.phone.trim(),

        city:
          externalForm.city.trim(),

        country:
          externalForm.country.trim(),

        notes:
          externalForm.notes.trim(),
      }

      if (
        !payload.fullName &&
        !payload.companyName &&
        !payload.email &&
        !payload.phone
      ) {
        setExternalError(
          'Enter a name, company, email, or phone number.',
        )

        return
      }

      setExternalSaving(true)
      setExternalError('')

      try {
        const endpoint =
          editingExternalId
            ? `${CONTACTS_ENDPOINT}/${encodeURIComponent(
                editingExternalId,
              )}`
            : CONTACTS_ENDPOINT

        const result =
          await apiFetch(
            endpoint,
            {
              method:
                editingExternalId
                  ? 'PATCH'
                  : 'POST',

              body:
                JSON.stringify(
                  payload,
                ),
            },
          )

        const saved =
          normalizeContact(
            result?.contact ||
              {},
            'external',
          )

        setExternalContacts(
          (current) =>
            editingExternalId
              ? current.map(
                  (item) =>
                    item.id ===
                    editingExternalId
                      ? saved
                      : item,
                )
              : [
                  saved,
                  ...current.filter(
                    (item) =>
                      item.id !==
                      saved.id,
                  ),
                ],
        )

        setExternalFormOpen(
          false,
        )

        setEditingExternalId(
          '',
        )

        setExternalForm(
          EMPTY_EXTERNAL,
        )

        onToast?.(
          result?.message ||
            'Contact saved.',
          'success',
        )
      } catch (error) {
        setExternalError(
          error?.message ||
            'Failed to save contact.',
        )
      } finally {
        setExternalSaving(
          false,
        )
      }
    }

  const deleteExternal =
    async (contact) => {
      if (!contact?.id) return

      const label =
        contact.fullName ||
        contact.companyName ||
        contact.email ||
        contact.phone ||
        'this contact'

      if (
        !window.confirm(
          `Delete ${label} from My Contacts? This cannot be undone.`,
        )
      ) {
        return
      }

      try {
        const result =
          await apiFetch(
            `${CONTACTS_ENDPOINT}/${encodeURIComponent(
              contact.id,
            )}`,
            {
              method: 'DELETE',
            },
          )

        setExternalContacts(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                contact.id,
            ),
        )

        onToast?.(
          result?.message ||
            'Contact deleted.',
          'success',
        )
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to delete contact.',
          'error',
        )
      }
    }

  const openInternalLead =
    async (contact) => {
      if (!contact?.id || leadLoading || leadSaving) return

      setLeadEditorOpen(false)
      setLeadEditorId('')
      setLeadLoading(true)
      setLeadError('')

      try {
        const result =
          await apiFetch(
            `/api/academy/lead-missions/leads/${encodeURIComponent(
              contact.id,
            )}`,
            {
              method: 'GET',
            },
          )

        const lead =
          result?.lead

        if (!lead) {
          throw new Error(
            'Lead not found.',
          )
        }

        const source = {
          ...(lead?.data &&
          typeof lead.data ===
            'object'
            ? lead.data
            : {}),
          ...lead,
        }

        const next = {
          currency:
            source.currency ||
            'USD',

          saleEnabled:
            String(
              source.saleEnabled ??
                'false',
            ),

          notes:
            source.notes || '',
        }

        LEAD_FIELDS.forEach(
          ([key]) => {
            if (
              key ===
              'followUpDueDate'
            ) {
              next[key] =
                String(
                  source[key] ||
                    '',
                ).slice(
                  0,
                  10,
                )
            } else {
              next[key] =
                String(
                  source[key] ??
                    next[key] ??
                    '',
                )
            }
          },
        )

        setLeadDraft(next)
        setLeadEditorId(contact.id)
        setLeadEditorOpen(true)
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to open lead editor.',
          'error',
        )
      } finally {
        setLeadLoading(
          false,
        )
      }
    }

  const saveInternalLead =
    async (event) => {
      event.preventDefault()

      if (!leadEditorId || leadLoading || leadSaving) {
        return
      }

      if (
        !String(
          leadDraft.companyName ||
            '',
        ).trim()
      ) {
        setLeadError(
          'Company name is required.',
        )

        return
      }

      const payload = {}

      LEAD_FIELDS.forEach(
        ([key]) => {
          payload[key] =
            String(
              leadDraft[key] ??
                '',
            ).trim()
        },
      )

      payload.notes =
        String(
          leadDraft.notes ||
            '',
        ).trim()

      payload.email =
        String(
          payload.email ||
            '',
        )
          .trim()
          .toLowerCase()

      setLeadSaving(true)
      setLeadError('')

      try {
        const result = await apiFetch(
          `/api/academy/lead-missions/leads/${encodeURIComponent(
            leadEditorId,
          )}`,
          {
            method: 'PATCH',
            body:
              JSON.stringify(
                payload,
              ),
          },
        )

        const updatedLead = result?.lead

        if (updatedLead) {
          setInternalContacts((current) =>
            current.map((contact) =>
              String(contact.id || '') === leadEditorId
                ? normalizeContact(
                    {
                      ...contact,
                      ...(updatedLead.data &&
                      typeof updatedLead.data === 'object'
                        ? updatedLead.data
                        : {}),
                      ...updatedLead,
                      id: leadEditorId,
                    },
                    'internal',
                  )
                : contact,
            ),
          )
        }

        setLeadEditorOpen(
          false,
        )

        await loadContacts({
          silent: true,
        })

        onToast?.(
          'Lead updated successfully.',
          'success',
        )
      } catch (error) {
        setLeadError(
          error?.message ||
            'Failed to update lead.',
        )
      } finally {
        setLeadSaving(
          false,
        )
      }
    }

  const deleteInternal =
    async (contact) => {
      if (!contact?.id) return

      const label =
        contact.fullName ||
        contact.companyName ||
        'this lead'

      if (
        !window.confirm(
          `Delete ${label}? This removes it from Academy Missions and My Contacts.`,
        )
      ) {
        return
      }

      try {
        const result =
          await apiFetch(
            `/api/academy/lead-missions/leads/${encodeURIComponent(
              contact.id,
            )}`,
            {
              method: 'DELETE',
            },
          )

        setInternalContacts(
          (current) =>
            current.filter(
              (item) =>
                item.id !==
                contact.id,
            ),
        )

        onToast?.(
          result?.message ||
            'Lead deleted.',
          'success',
        )
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to delete lead.',
          'error',
        )
      }
    }

  const editContact = (
    contact,
  ) => {
    if (
      contact.contactType ===
      'external'
    ) {
      openExternalForm(
        contact,
      )
      return
    }

    void openInternalLead(
      contact,
    )
  }

  const deleteContact = (
    contact,
  ) => {
    if (
      contact.contactType ===
      'external'
    ) {
      void deleteExternal(
        contact,
      )
      return
    }

    void deleteInternal(
      contact,
    )
  }

  return (
    <section
      id="yh-dashboard-my-contacts-workspace"
      className="yh-dashboard-system-workspace"
      aria-label="My Contacts workspace"
      data-yh-dashboard-react-surface="my-contacts"
    >
      <div className="yh-dashboard-system-workspace-content">
        <div
          id="yh-dashboard-my-contacts-modal"
          className="yh-dashboard-profile-modal is-dashboard-inline-workspace"
          role="region"
          aria-modal="false"
          aria-labelledby="yh-dashboard-my-contacts-title"
        >
          <div className="yh-dashboard-profile-modal-card yh-dashboard-my-contacts-card">
            <div className="yh-dashboard-profile-modal-head">
              <div>
                <div className="yh-dashboard-profile-modal-kicker">
                  Relationship Database
                </div>

                <h3 id="yh-dashboard-my-contacts-title">
                  My Contacts
                </h3>

                <p>
                  Review contacts collected through Academy missions and contacts you added manually.
                </p>
              </div>
            </div>

            <div className="yh-dashboard-profile-modal-body yh-dashboard-my-contacts-body hide-scrollbar">
              <div
                className="yh-dashboard-my-contacts-tabs"
                role="tablist"
                aria-label="Contact type"
              >
                <button
                  type="button"
                  className={`yh-dashboard-my-contacts-tab ${
                    activeTab ===
                    'internal'
                      ? 'is-active'
                      : ''
                  }`}
                  role="tab"
                  aria-selected={
                    activeTab ===
                    'internal'
                  }
                  onClick={() =>
                    changeTab(
                      'internal',
                    )
                  }
                >
                  Internal{' '}
                  <span>
                    {
                      internalContacts.length
                    }
                  </span>
                </button>

                <button
                  type="button"
                  className={`yh-dashboard-my-contacts-tab ${
                    activeTab ===
                    'external'
                      ? 'is-active'
                      : ''
                  }`}
                  role="tab"
                  aria-selected={
                    activeTab ===
                    'external'
                  }
                  onClick={() =>
                    changeTab(
                      'external',
                    )
                  }
                >
                  External{' '}
                  <span>
                    {
                      externalContacts.length
                    }
                  </span>
                </button>
              </div>

              <div className="yh-dashboard-my-contacts-toolbar">
                <input
                  type="search"
                  className="input-field"
                  placeholder="Search name, company, email, phone, role, or location"
                  autoComplete="off"
                  value={search}
                  onChange={(
                    event,
                  ) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                />

                {activeTab ===
                  'external' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() =>
                      openExternalForm()
                    }
                  >
                    Add External Contact
                  </button>
                )}
              </div>

              {externalFormOpen && (
                <form
                  className="yh-dashboard-my-contacts-form"
                  noValidate
                  onSubmit={
                    saveExternal
                  }
                >
                  <div className="yh-dashboard-my-contacts-form-head">
                    <div>
                      <strong>
                        {editingExternalId
                          ? 'Edit External Contact'
                          : 'Add External Contact'}
                      </strong>

                      <small>
                        Save a contact that did not come from an Academy mission.
                      </small>
                    </div>
                  </div>

                  <div className="yh-dashboard-my-contacts-form-grid">
                    {[
                      ['fullName', 'Full Name', 'text'],
                      ['companyName', 'Company', 'text'],
                      ['contactRole', 'Role', 'text'],
                      ['email', 'Email', 'email'],
                      ['phone', 'Phone', 'text'],
                      ['city', 'City', 'text'],
                      ['country', 'Country', 'text'],
                    ].map(
                      ([
                        key,
                        label,
                        type,
                      ]) => (
                        <label
                          key={key}
                          className="form-group"
                        >
                          <span>
                            {label}
                          </span>

                          <input
                            className="input-field"
                            type={type}
                            value={
                              externalForm[
                                key
                              ]
                            }
                            onChange={(
                              event,
                            ) =>
                              setExternalForm(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [key]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          />
                        </label>
                      ),
                    )}

                    <label className="form-group yh-dashboard-my-contacts-form-wide">
                      <span>
                        Notes
                      </span>

                      <textarea
                        className="input-field"
                        rows="3"
                        maxLength="1200"
                        value={
                          externalForm.notes
                        }
                        onChange={(
                          event,
                        ) =>
                          setExternalForm(
                            (
                              current,
                            ) => ({
                              ...current,
                              notes:
                                event
                                  .target
                                  .value,
                            }),
                          )
                        }
                      />
                    </label>
                  </div>

                  {externalError && (
                    <div className="yh-dashboard-settings-loading is-error">
                      {
                        externalError
                      }
                    </div>
                  )}

                  <div className="yh-dashboard-my-contacts-form-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={
                        externalSaving
                      }
                      onClick={() => {
                        setExternalFormOpen(
                          false,
                        )
                        setEditingExternalId(
                          '',
                        )
                        setExternalError(
                          '',
                        )
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={
                        externalSaving
                      }
                    >
                      {externalSaving
                        ? editingExternalId
                          ? 'Saving Changes...'
                          : 'Saving Contact...'
                        : editingExternalId
                          ? 'Save Changes'
                          : 'Save Contact'}
                    </button>
                  </div>
                </form>
              )}

              <div className="yh-dashboard-my-contacts-summary">
                {loading &&
                !loaded
                  ? 'Loading your saved contacts...'
                  : `${visibleItems.length} of ${activeItems.length} ${
                      activeTab ===
                      'external'
                        ? 'external contact'
                        : 'Academy mission contact'
                    }${
                      activeItems.length ===
                      1
                        ? ''
                        : 's'
                    }`}
              </div>

              <div className="yh-dashboard-my-contacts-list">
                {loading &&
                !loaded ? (
                  <div className="yh-dashboard-settings-loading">
                    Loading contacts...
                  </div>
                ) : contactsError && !loaded ? (
                  <div
                    className="yh-dashboard-settings-loading is-error"
                    role="alert"
                  >
                    {contactsError}
                  </div>
                ) : !visibleItems.length ? (
                  <div className="yh-dashboard-my-contacts-empty">
                    <strong>
                      {activeTab ===
                      'external'
                        ? 'No external contacts saved yet'
                        : 'No Academy mission contacts yet'}
                    </strong>

                    <span>
                      {search
                        ? 'No contacts match the current search.'
                        : activeTab ===
                            'external'
                          ? 'Use Add External Contact to create your first manually saved contact.'
                          : 'Contacts will appear here automatically when you save contact details inside an Academy mission lead.'}
                    </span>
                  </div>
                ) : (
                  visibleItems.map(
                    (contact) => (
                      <ContactCard
                        key={
                          contact.id
                        }
                        contact={
                          contact
                        }
                        onEdit={
                          editContact
                        }
                        onDelete={
                          deleteContact
                        }
                      />
                    ),
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {leadEditorOpen && (
          <div
            className="academy-lead-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit Academy lead"
          >
            <div className="academy-lead-modal-card">
              <div className="academy-lead-modal-head academy-lead-modal-head-centered">
                <div className="academy-lead-modal-head-copy">
                  <div className="academy-lead-modal-kicker">
                    Academy Lead
                  </div>

                  <h3 className="academy-lead-modal-title">
                    Edit Lead
                  </h3>

                  <p className="academy-lead-modal-subtitle">
                    Update this Academy mission lead without leaving the Dashboard.
                  </p>
                </div>
              </div>

              {leadLoading ? (
                <div className="yh-dashboard-settings-loading">
                  Loading lead...
                </div>
              ) : (
                <form
                  className="academy-lead-form-grid"
                  noValidate
                  onSubmit={
                    saveInternalLead
                  }
                >
                  {LEAD_FIELDS.map(
                    ([
                      key,
                      label,
                      type,
                    ]) => (
                      <div
                        key={key}
                        className="form-group"
                      >
                        <label>
                          {label}
                        </label>

                        {type ===
                        'select' ? (
                          <select
                            className="input-field"
                            value={
                              leadDraft[
                                key
                              ] ?? ''
                            }
                            onChange={(
                              event,
                            ) =>
                              setLeadDraft(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [key]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          >
                            {(
                              LEAD_SELECT_FIELDS[
                                key
                              ] || []
                            ).map(
                              ([
                                value,
                                text,
                              ]) => (
                                <option
                                  key={`${key}-${value}`}
                                  value={
                                    value
                                  }
                                >
                                  {text}
                                </option>
                              ),
                            )}
                          </select>
                        ) : (
                          <input
                            className="input-field"
                            type={type}
                            min={
                              type ===
                              'number'
                                ? '0'
                                : undefined
                            }
                            step={
                              type ===
                              'number'
                                ? '0.01'
                                : undefined
                            }
                            value={
                              leadDraft[
                                key
                              ] ?? ''
                            }
                            onChange={(
                              event,
                            ) =>
                              setLeadDraft(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [key]:
                                    event
                                      .target
                                      .value,
                                }),
                              )
                            }
                          />
                        )}
                      </div>
                    ),
                  )}

                  <div className="form-group academy-lead-form-span-2">
                    <label>
                      Notes
                    </label>

                    <textarea
                      className="input-field"
                      rows="4"
                      value={
                        leadDraft.notes ||
                        ''
                      }
                      onChange={(
                        event,
                      ) =>
                        setLeadDraft(
                          (
                            current,
                          ) => ({
                            ...current,
                            notes:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                    />
                  </div>

                  {leadError && (
                    <div className="academy-lead-form-span-2 yh-dashboard-settings-loading is-error">
                      {
                        leadError
                      }
                    </div>
                  )}

                  <div className="academy-lead-form-actions academy-lead-form-span-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={
                        leadSaving
                      }
                      onClick={() =>
                        setLeadEditorOpen(
                          false,
                        )
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={
                        leadSaving
                      }
                    >
                      {leadSaving
                        ? 'Saving...'
                        : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
