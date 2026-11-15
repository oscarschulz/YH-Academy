import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { apiFetch } from '../../services/api/apiClient'

function clean(value = '') {
  return String(value ?? '').trim()
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function leadId(item = {}) {
  return clean(
    item.id ||
      item.leadId ||
      item._id ||
      item?.data?.id,
  )
}

function value(item = {}, key = '') {
  return (
    item?.[key] ??
    item?.data?.[key] ??
    ''
  )
}

function updatedAt(item = {}) {
  return clean(
    item.updatedAt ||
      item.updated_at ||
      item?.data?.updatedAt,
  )
}

function assignedMissionStatus(item = {}) {
  return clean(
    value(item, 'assignmentStatus') ||
    value(item, 'taskStatus') ||
    value(item, 'pipelineStage'),
  )
}

function canSubmitAssignedMission(item = {}) {
  const blockedStatuses = new Set([
    'submitted',
    'pending_review',
    'approved',
    'completed',
    'rejected',
  ])

  const statuses = [
    assignedMissionStatus(item),
    value(item, 'reviewStatus'),
    value(item, 'missionStatus'),
  ]

  return !statuses.some(status =>
    blockedStatuses.has(clean(status).toLowerCase())
  )
}

function assignedMissionLabel(value = '') {
  return clean(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function createRequestId() {
  return `academy_lead_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`
}

const LEAD_FIELDS = [
  {
    name: 'tier',
    label: 'Tier',
    type: 'select',
    required: true,
    options: [
      ['', 'Select tier'],
      ['T1', 'T1 - High Value'],
      ['T2', 'T2 - Mid Value'],
      ['T3', 'T3 - Low Value'],
    ],
  },
  {
    name: 'companyName',
    label: 'Company Name',
    required: true,
  },
  {
    name: 'companyWebsite',
    label: 'Company Website',
  },
  {
    name: 'contactName',
    label: 'Contact Name',
  },
  {
    name: 'contactRole',
    label: 'Contact Role',
  },
  {
    name: 'contactType',
    label: 'Contact Type',
    type: 'select',
    options: [
      ['', 'Select type'],
      ['employee', 'Employee'],
      ['manager', 'Manager'],
      ['founder', 'Founder'],
      ['owner', 'Owner'],
      ['unknown', 'Unknown'],
    ],
  },
  {
    name: 'email',
    label: 'Email',
    inputType: 'email',
  },
  {
    name: 'phone',
    label: 'Phone',
  },
  {
    name: 'city',
    label: 'City',
  },
  {
    name: 'country',
    label: 'Country',
  },
  {
    name: 'sourceMethod',
    label: 'Source Method',
    type: 'select',
    options: [
      ['', 'Select source'],
      ['Google Maps', 'Google Maps'],
      ['Search Engine', 'Search Engine'],
      ['AI Research', 'AI Research'],
      ['Referral', 'Referral'],
      ['Website Form', 'Website Form'],
      ['Social Media', 'Social Media'],
      ['Other', 'Other'],
    ],
  },
  {
    name: 'callOutcome',
    label: 'Call Outcome',
    type: 'select',
    options: [
      ['', 'Select outcome'],
      ['No answer', 'No answer'],
      ['Gatekeeper only', 'Gatekeeper only'],
      ['Useful conversation', 'Useful conversation'],
      ['Direct contact obtained', 'Direct contact obtained'],
      ['Follow-up opened', 'Follow-up opened'],
      ['Dead lead', 'Dead lead'],
      ['Warm lead', 'Warm lead'],
    ],
  },
  {
    name: 'interestLevel',
    label: 'Interest Level',
    type: 'select',
    options: [
      ['', 'Select level'],
      ['Cold', 'Cold'],
      ['Warm', 'Warm'],
      ['Hot', 'Hot'],
    ],
  },
  {
    name: 'rapportLevel',
    label: 'Rapport Level',
    type: 'select',
    options: [
      ['', 'Select level'],
      ['1', '1'],
      ['2', '2'],
      ['3', '3'],
      ['4', '4'],
      ['5', '5'],
    ],
  },
  {
    name: 'pipelineStage',
    label: 'Pipeline Stage',
    type: 'select',
    options: [
      ['', 'Select stage'],
      ['Prospected', 'Prospected'],
      ['Called', 'Called'],
      ['Contact Identified', 'Contact Identified'],
      ['Direct Channel Opened', 'Direct Channel Opened'],
      ['Rapport Building', 'Rapport Building'],
      ['Applied', 'Applied'],
      ['Accepted', 'Accepted'],
      ['Archived', 'Archived'],
    ],
  },
  {
    name: 'priority',
    label: 'Priority',
    type: 'select',
    options: [
      ['', 'Select priority'],
      ['High', 'High'],
      ['Medium', 'Medium'],
      ['Low', 'Low'],
    ],
  },
  {
    name: 'nextAction',
    label: 'Next Action',
    type: 'select',
    options: [
      ['', 'Select next action'],
      ['Call', 'Call'],
      ['Text', 'Text'],
      ['Email', 'Email'],
      ['Voice Note', 'Voice Note'],
      ['Send Form', 'Send Form'],
      ['Archive', 'Archive'],
      ['Nurture', 'Nurture'],
    ],
  },
  {
    name: 'channel',
    label: 'Channel',
    type: 'select',
    options: [
      ['', 'Select channel'],
      ['WhatsApp', 'WhatsApp'],
      ['Email', 'Email'],
      ['Phone', 'Phone'],
      ['Telegram', 'Telegram'],
      ['Other', 'Other'],
    ],
  },
  {
    name: 'taskStatus',
    label: 'Task Status',
    type: 'select',
    options: [
      ['', 'Select status'],
      ['Due', 'Due'],
      ['Waiting', 'Waiting'],
      ['Done', 'Done'],
      ['Stalled', 'Stalled'],
      ['Archived', 'Archived'],
    ],
  },
  {
    name: 'callType',
    label: 'Call Type',
    type: 'select',
    options: [
      ['', 'Select call type'],
      ['Initial Call', 'Initial Call'],
      ['Follow-Up Call', 'Follow-Up Call'],
      ['Gatekeeper Call', 'Gatekeeper Call'],
      ['Owner Call', 'Owner Call'],
    ],
  },
  {
    name: 'objection',
    label: 'Objection',
    type: 'select',
    options: [
      ['', 'Select objection'],
      ['No objection', 'No objection'],
      ['Busy', 'Busy'],
      ['Email me', 'Email me'],
      ['Not interested', 'Not interested'],
      ['Gatekeeper block', 'Gatekeeper block'],
      ['Price objection', 'Price objection'],
      ['Timing objection', 'Timing objection'],
      ['Other', 'Other'],
    ],
  },
  {
    name: 'followUpDueDate',
    label: 'Follow-up Due Date',
    inputType: 'date',
  },
  {
    name: 'sellerPriceAmount',
    label: 'Operator Selling Price',
    inputType: 'number',
    placeholder: 'Example: 100',
  },
  {
    name: 'currency',
    label: 'Currency',
    type: 'select',
    options: [
      ['USD', 'USD'],
      ['EUR', 'EUR'],
      ['GBP', 'GBP'],
      ['NGN', 'NGN'],
      ['PHP', 'PHP'],
      ['INR', 'INR'],
    ],
  },
  {
    name: 'saleEnabled',
    label: 'Marketplace Listing',
    type: 'select',
    options: [
      [
        'true',
        'Submit for Federation marketplace review',
      ],
      [
        'false',
        'Private lead only',
      ],
    ],
  },
]

function LeadField({
  field,
  lead,
}) {
  const current = String(
    value(lead, field.name) ?? '',
  )

  if (
    field.type ===
    'select'
  ) {
    return (
      <label className="form-group">
        <span>
          {field.label}
        </span>

        <select
          name={field.name}
          className="input-field"
          defaultValue={
            current ||
            field.options?.[0]?.[0] ||
            ''
          }
          required={
            field.required === true
          }
        >
          {current && !field.options.some(
            ([option]) => String(option) === String(current)
          ) && (
            <option value={String(current)}>{String(current)}</option>
          )}
          {field.options.map(
            ([option, label]) => (
              <option
                key={`${field.name}-${option}`}
                value={option}
              >
                {label}
              </option>
            ),
          )}
        </select>
      </label>
    )
  }

  return (
    <label className="form-group">
      <span>
        {field.label}
      </span>

      <input
        name={field.name}
        className="input-field"
        type={
          field.inputType ||
          'text'
        }
        min={
          field.inputType ===
          'number'
            ? '0'
            : undefined
        }
        step={
          field.inputType ===
          'number'
            ? '0.01'
            : undefined
        }
        defaultValue={current}
        placeholder={field.placeholder || undefined}
        required={
          field.required === true
        }
      />
    </label>
  )
}

export function LeadDatabasePanel({
  items = [],
  playbook = null,
  loadWorkspace,
  onToast,
}) {
  const leads = list(items)

  const [
    editor,
    setEditor,
  ] = useState(null)

  const [
    busy,
    setBusy,
  ] = useState('')

  const openAdd = () => {
    setEditor({
      mode: 'create',
      lead: {},
      clientRequestId:
        createRequestId(),
      key: Date.now(),
    })
  }

  const openEdit =
    async (lead) => {
      const id =
        leadId(lead)

      if (!id) {
        onToast?.(
          'Lead data is unavailable.',
          'error',
        )
        return
      }

      setBusy(
        `edit:${id}`,
      )

      let freshLead = lead

      try {
        const result =
          await apiFetch(
            `/api/academy/lead-missions/leads/${encodeURIComponent(
              id,
            )}`,
            {
              method: 'GET',
            },
          )

        if (
          !result?.lead &&
          !leads.some(item => leadId(item) === id)
        ) {
          throw new Error('Lead not found.')
        }

        freshLead =
          result?.lead ||
          lead
      } catch (error) {
        if (!leads.some(item => leadId(item) === id)) {
          onToast?.(
            error?.message || 'Failed to open lead.',
            'error',
          )
          return
        }
        freshLead = lead
      } finally {
        setBusy('')
      }

      setEditor({
        mode: 'edit',
        id,
        lead: freshLead,
        expectedUpdatedAt:
          updatedAt(
            freshLead,
          ),
        key: Date.now(),
      })
    }

  const leadEditIntentConsumed = useRef(false)

  useEffect(() => {
    if (leadEditIntentConsumed.current) return

    let targetId = ''
    try {
      targetId = String(
        sessionStorage.getItem('yh_academy_edit_lead_id_v1') || '',
      ).trim()
    } catch {}

    if (!targetId) return

    leadEditIntentConsumed.current = true

    try {
      sessionStorage.removeItem('yh_academy_edit_lead_id_v1')
    } catch {}

    const matchingLead =
      leads.find(item => leadId(item) === targetId)

    void openEdit(matchingLead || { id: targetId })
  }, [items])

  const deleteLead =
    async (lead) => {
      const id =
        leadId(lead)

      if (!id) return

      const company =
        clean(
          value(
            lead,
            'companyName',
          ),
        ) ||
        'this lead'

      const confirmed =
        window.confirm(
          `Delete ${company}? This removes the lead from your Lead Database and My Contacts.`,
        )

      if (!confirmed) {
        return
      }

      setBusy(
        `delete:${id}`,
      )

      try {
        await apiFetch(
          `/api/academy/lead-missions/leads/${encodeURIComponent(
            id,
          )}`,
          {
            method:
              'DELETE',
          },
        )

        onToast?.(
          'Lead deleted.',
          'success',
        )

        await loadWorkspace(
          'database',
        )
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to delete lead.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  const submitLead =
    async (event) => {
      event.preventDefault()

      if (busy) return

      const form =
        event.currentTarget

      const payload =
        Object.fromEntries(
          new FormData(
            form,
          ).entries(),
        )

      const tier =
        clean(
          payload.tier ||
            payload.leadTier,
        )

      const companyName =
        clean(
          payload.companyName ||
            payload.company,
        )

      if (
        !tier ||
        !companyName
      ) {
        onToast?.(
          'Tier and company name are required.',
          'error',
        )
        return
      }

      payload.tier = tier
      payload.companyName =
        companyName

      if (
        playbook?.key
      ) {
        payload.missionPlaybookKey =
          playbook.key

        payload.sourceMissionTitle =
          playbook.title || ''

        payload.sourceMissionType =
          'academy_mission_playbook'
      }

      delete payload.universeCommissionRate
      delete payload.universeCommissionAmount
      delete payload.platformCommissionRate
      delete payload.platformCommissionAmount
      delete payload.operatorPayoutAmount
      delete payload.buyerPriceAmount

      const editing =
        editor?.mode ===
        'edit'

      if (editing) {
        payload.expectedUpdatedAt =
          editor
            .expectedUpdatedAt ||
          ''
      } else {
        payload.clientRequestId =
          editor
            ?.clientRequestId ||
          createRequestId()
      }

      setBusy(
        editing
          ? 'saving'
          : 'adding',
      )

      try {
        const endpoint =
          editing
            ? `/api/academy/lead-missions/leads/${encodeURIComponent(
                editor.id,
              )}`
            : '/api/academy/lead-missions/leads'

        const result =
          await apiFetch(
            endpoint,
            {
              method:
                editing
                  ? 'PATCH'
                  : 'POST',
              body:
                JSON.stringify(
                  payload,
                ),
            },
          )

        if (
          result?.success !==
          true
        ) {
          throw new Error(
            result?.message ||
              'Unable to save lead.',
          )
        }

        if (editing) {
          onToast?.(
            'Lead updated successfully.',
            'success',
          )
        } else {
          const completed =
            result
              ?.missionCompletion
              ?.completed ===
            true

          const xp =
            Math.max(
              0,
              Number(
                result?.xp
                  ?.awarded,
              ) || 0,
            )

          if (
            completed &&
            xp > 0
          ) {
            onToast?.(
              `Lead saved • Mission completed • +${xp} XP`,
              'success',
            )
          } else if (
            completed &&
            result?.xp
              ?.eventCreated ===
              false
          ) {
            onToast?.(
              'Lead saved • Mission already completed',
              'success',
            )
          } else {
            onToast?.(
              'Lead saved successfully.',
              'success',
            )
          }
        }

        setEditor(null)

        await loadWorkspace(
          'database',
        )
      } catch (error) {
        onToast?.(
          error?.message ||
            'Unable to save lead.',
          'error',
        )
      } finally {
        setBusy('')
      }
    }

  return (
    <>
      <div className="academy-lead-header-actions">
        <button
          type="button"
          className="academy-ui-button academy-ui-button--primary"
          onClick={openAdd}
        >
          + Add Lead
        </button>
      </div>

      {!leads.length ? (
        <div className="academy-profile-empty-state">
          No leads in your
          database yet.
        </div>
      ) : (
        <div className="academy-lead-list">
          {leads.map(
            (lead, index) => {
              const id =
                leadId(lead)

              return (
                <article
                  className="academy-lead-list-card"
                  key={
                    id ||
                    index
                  }
                >
                  <div className="academy-lead-list-main">
                    <strong>
                      {clean(
                        value(
                          lead,
                          'companyName',
                        ),
                      ) ||
                        'Lead'}
                    </strong>

                    <span>
                      {[
                        value(
                          lead,
                          'tier',
                        ),
                        value(
                          lead,
                          'contactName',
                        ),
                        value(
                          lead,
                          'country',
                        ),
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(
                          ' • ',
                        )}
                    </span>

                    {value(
                      lead,
                      'notes',
                    ) && (
                      <p>
                        {value(
                          lead,
                          'notes',
                        )}
                      </p>
                    )}
                  </div>

                  <div className="academy-lead-list-meta">
                    <span>
                      {value(
                        lead,
                        'taskStatus',
                      ) ||
                        value(
                          lead,
                          'status',
                        ) ||
                        'Active'}
                    </span>

                    <div className="roadmap-mission-actions">
                      <button
                        type="button"
                        className="academy-ui-button academy-ui-button--secondary"
                        disabled={
                          busy ===
                          `edit:${id}`
                        }
                        onClick={() =>
                          void openEdit(
                            lead,
                          )
                        }
                      >
                        {busy ===
                        `edit:${id}`
                          ? 'Opening...'
                          : 'Edit'}
                      </button>

                      <button
                        type="button"
                        className="academy-ui-button academy-ui-button--secondary"
                        disabled={
                          busy ===
                          `delete:${id}`
                        }
                        onClick={() =>
                          void deleteLead(
                            lead,
                          )
                        }
                      >
                        {busy ===
                        `delete:${id}`
                          ? 'Deleting...'
                          : 'Delete'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            },
          )}
        </div>
      )}

      {editor && createPortal(
        <div
          className="academy-lead-modal yhu-academy-p1"
          role="dialog"
          aria-modal="true"
          aria-label={
            editor.mode ===
            'edit'
              ? 'Edit Lead'
              : 'Add Lead'
          }
        >
          <form
            key={editor.key}
            className="academy-lead-modal-card academy-lead-form-grid"
            onSubmit={
              submitLead
            }
          >
            <div className="academy-lead-form-span-2">
              <div className="academy-profile-card-kicker">
                Academy Lead
              </div>

              <h2>
                {editor.mode ===
                'edit'
                  ? 'Edit Lead'
                  : 'Add Lead'}
              </h2>
            </div>

            {LEAD_FIELDS.map(
              (field) => (
                <LeadField
                  key={
                    field.name
                  }
                  field={
                    field
                  }
                  lead={
                    editor.lead
                  }
                />
              ),
            )}

            <label className="form-group academy-lead-form-span-2">
              <span>
                Notes
              </span>

              <textarea
                name="notes"
                className="input-field"
                rows="4"
                defaultValue={
                  value(
                    editor.lead,
                    'notes',
                  ) || ''
                }
              />
            </label>

            <div className="academy-lead-form-actions academy-lead-form-span-2">
              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={
                  Boolean(busy)
                }
                onClick={() =>
                  setEditor(
                    null,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="academy-ui-button academy-ui-button--primary"
                disabled={
                  Boolean(busy)
                }
              >
                {busy ===
                'saving'
                  ? 'Saving...'
                  : busy ===
                      'adding'
                    ? 'Adding...'
                    : editor.mode ===
                        'edit'
                      ? 'Save Lead'
                      : 'Add Lead'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </>
  )
}

export function AssignedMissionsPanel({
  items = [],
  loadWorkspace,
  onToast,
}) {
  const missions =
    list(items)

  const [
    proofMission,
    setProofMission,
  ] = useState(null)

  const [
    busy,
    setBusy,
  ] = useState(false)

  const submitProof =
    async (event) => {
      event.preventDefault()

      if (
        busy ||
        !proofMission
      ) {
        return
      }

      const id =
        leadId(
          proofMission,
        )

      const formData =
        new FormData(
          event.currentTarget,
        )

      const completionProof =
        clean(
          formData.get(
            'completionProof',
          ),
        )

      if (
        !id ||
        !completionProof
      ) {
        onToast?.(
          'Completion proof is required.',
          'error',
        )
        return
      }

      setBusy(true)

      try {
        const result =
          await apiFetch(
            `/api/academy/lead-missions/${encodeURIComponent(
              id,
            )}/submit`,
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  completionProof,
                  expectedUpdatedAt:
                    updatedAt(
                      proofMission,
                    ),
                }),
            },
          )

        if (
          result?.success !==
          true
        ) {
          throw new Error(
            result?.message ||
              'Failed to submit mission.',
          )
        }

        setProofMission(
          null,
        )

        await loadWorkspace(
          'assigned',
        )

        onToast?.(
          'Mission submitted for admin review.',
          'success',
        )
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to submit mission.',
          'error',
        )
      } finally {
        setBusy(false)
      }
    }

  if (!missions.length) {
    return (
      <div className="academy-profile-empty-state">
        No assigned missions
        right now.
      </div>
    )
  }

  return (
    <>
      <div className="academy-lead-list">
        {missions.map(
          (mission, index) => {
            const id =
              leadId(
                mission,
              )

            return (
              <article
                className="academy-lead-list-card"
                key={
                  id ||
                  index
                }
              >
                <div className="academy-lead-list-main">
                  <strong>
                    {value(
                      mission,
                      'missionTitle',
                    ) ||
                      value(
                        mission,
                        'companyName',
                      ) ||
                      'Assigned Mission'}
                  </strong>

                  <p>
                    {value(
                      mission,
                      'missionBrief',
                    ) ||
                      value(
                        mission,
                        'academyMissionNeed',
                      ) ||
                      value(
                        mission,
                        'nextAction',
                      ) ||
                      'Complete the assigned work and submit proof for review.'}
                  </p>
                </div>

                <div className="academy-lead-list-meta">
                  <span>
                    {assignedMissionLabel(
                      assignedMissionStatus(mission) || 'assigned'
                    )}
                  </span>

                  {id && canSubmitAssignedMission(mission) ? (
                    <button
                      type="button"
                      className="academy-ui-button academy-ui-button--primary"
                      onClick={() =>
                        setProofMission(
                          mission,
                        )
                      }
                    >
                      Submit Proof
                    </button>
                  ) : (
                    <span className="academy-lead-badge">
                      {assignedMissionLabel(
                        value(mission, 'reviewStatus') ||
                        value(mission, 'assignmentStatus') ||
                        'waiting'
                      )}
                    </span>
                  )}
                </div>
              </article>
            )
          },
        )}
      </div>

      {proofMission && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Submit Mission Proof"
        >
          <form
            className="modal-content academy-lead-form-grid"
            onSubmit={
              submitProof
            }
          >
            <div className="academy-lead-form-span-2">
              <div className="academy-profile-card-kicker">
                Assigned Mission
              </div>

              <h2>
                Submit
                Completion Proof
              </h2>

              <p>
                {value(
                  proofMission,
                  'missionBrief',
                ) ||
                  value(
                    proofMission,
                    'academyMissionNeed',
                  ) ||
                  value(
                    proofMission,
                    'nextAction',
                  ) ||
                  'Paste the completion proof, result, link, summary, or delivery note for admin review.'}
              </p>
            </div>

            <label className="form-group academy-lead-form-span-2">
              <span>
                Completion Proof
              </span>

              <textarea
                name="completionProof"
                className="input-field"
                rows="6"
                required
              />
            </label>

            <div className="academy-lead-form-actions academy-lead-form-span-2">
              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={busy}
                onClick={() =>
                  setProofMission(
                    null,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="academy-ui-button academy-ui-button--primary"
                disabled={busy}
              >
                {busy
                  ? 'Submitting...'
                  : 'Submit for Review'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

/* YHU_ACADEMY_PAYOUT_STATUS_PRESENTATION_ASIS */
function academyPayoutMoneyTotals(items = [], field = 'amount') {
  const totals = {}
  list(items).forEach(item => {
    const currency = clean(item?.currency || 'USD').toUpperCase() || 'USD'
    const amount = Number(item?.[field] || 0)
    if (!Number.isFinite(amount) || amount <= 0) return
    totals[currency] = (totals[currency] || 0) + amount
  })
  return totals
}

function academyPayoutMoneySummary(totals = {}) {
  const entries = Object.entries(totals).filter(([, amount]) => amount > 0)
  return entries.length
    ? entries.map(([currency, amount]) =>
        academyFormatAvailable(amount, currency)).join(' + ')
    : academyFormatAvailable(0, 'USD')
}

function academyPayoutLabel(value = '') {
  return (clean(value) || 'pending_review')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function academyPayoutDestination(item = {}) {
  const method = clean(item?.method || 'local_bank').toLowerCase()

  if (method === 'crypto') {
    return [
      item?.cryptoCurrency || 'Crypto',
      item?.cryptoNetwork,
      item?.walletAddressMasked
    ].filter(Boolean).join(' • ') || 'Crypto wallet'
  }

  if (method === 'card') {
    return item?.cardLast4
      ? 'Card •••• ' + item.cardLast4
      : 'Card payout'
  }

  return [
    item?.bankName || 'Local bank',
    item?.accountNumberMasked
  ].filter(Boolean).join(' • ')
}

function PayoutRows({ items = [], emptyText }) {
  const rows = list(items)

  if (!rows.length) {
    return <div className="academy-member-browser-empty">{emptyText}</div>
  }

  return (
    <div className="academy-lead-table-wrap">
      <table className="academy-lead-table">
        <thead>
          <tr>
            <th>Source</th><th>Basis</th><th>Payout</th>
            <th>Deal Value</th><th>Status</th>
            <th>Payment</th><th>Approved / Paid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={clean(item?.id || item?._id) || index}>
              <td>
                {academyPayoutLabel(item?.sourceDivision || 'academy')}
                {item?.sourceRecordId && (
                  <div className="academy-lead-list-meta">
                    Source Record: {item.sourceRecordId}
                  </div>
                )}
                {item?.federationRequestId && (
                  <div className="academy-lead-list-meta">
                    Federation Request: {item.federationRequestId}
                  </div>
                )}
              </td>
              <td>
                <strong>{clean(item?.title) || 'Academy mission earning'}</strong>
                <div className="academy-lead-list-meta">
                  {academyPayoutLabel(
                    item?.basisType || item?.sourceFeature || 'routed_mission'
                  )}
                </div>
              </td>
              <td>{academyFormatAvailable(item?.amount || 0, item?.currency || 'USD')}</td>
              <td>{academyFormatAvailable(item?.dealGrossValue || 0, item?.currency || 'USD')}</td>
              <td>
                {academyPayoutLabel(item?.status)}
                <div className="academy-lead-list-meta">
                  Payout: {academyPayoutLabel(item?.payoutStatus || 'not_requested')}
                </div>
              </td>
              <td>{academyPayoutLabel(item?.paymentStatus || 'not_started')}</td>
              <td>
                {clean(item?.approvedAt) || '—'}
                <div className="academy-lead-list-meta">
                  Paid: {clean(item?.paidAt) || '—'}
                </div>
                {item?.approvedBy && (
                  <div className="academy-lead-list-meta">
                    By: {item.approvedBy}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* YHU_ACADEMY_PAYOUT_AVAILABLE_PARITY */
function academyAvailableEarnings(payouts = [], ledger = []) {
  const sumByCurrency = (items) => {
    const totals = {}

    list(items).forEach((item) => {
      const currency =
        clean(item?.currency || 'USD').toUpperCase() || 'USD'
      const amount = Number(item?.amount || 0)

      if (!Number.isFinite(amount) || !amount) return

      totals[currency] = (totals[currency] || 0) + amount
    })

    return totals
  }

  const earned = list(payouts).filter((item) => {
    const status = clean(item?.status).toLowerCase()
    const payoutStatus = clean(item?.payoutStatus).toLowerCase()
    const paymentStatus = clean(item?.paymentStatus).toLowerCase()

    return (
      ['approved', 'ready_for_payment', 'available'].includes(status) &&
      (!paymentStatus || ['paid', 'earned'].includes(paymentStatus)) &&
      status !== 'paid' &&
      payoutStatus !== 'paid'
    )
  })

  const reserved = list(ledger).filter((item) =>
    ['pending_review', 'approved', 'processing', 'paid'].includes(
      clean(item?.status).toLowerCase()
    )
  )

  const approvedTotals = sumByCurrency(earned)
  const reservedTotals = sumByCurrency(reserved)
  const availableTotals = { ...approvedTotals }

  Object.entries(reservedTotals).forEach(
    ([currency, amount]) => {
      availableTotals[currency] = Math.max(
        0,
        (availableTotals[currency] || 0) - amount
      )
    }
  )

  const primaryCurrency =
    Object.entries(availableTotals)
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD'

  return { approvedTotals, reservedTotals, availableTotals, primaryCurrency }
}

function academyFormatAvailable(amount = 0, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(amount)
  } catch {
    return currency + ' ' + Number(amount).toFixed(2)
  }
}

export function PayoutsPanel({
  payouts = [],
  ledger = [],
  deals = [],
  loadWorkspace,
  onToast,
}) {
  const [
    withdrawalOpen,
    setWithdrawalOpen,
  ] = useState(false)

  const [withdrawalCurrency, setWithdrawalCurrency] =
    useState('USD')

  const withdrawable = academyAvailableEarnings(payouts, ledger)

  const primaryAvailable =
    Number(withdrawable.availableTotals[withdrawable.primaryCurrency] || 0)

  const currencyAvailable =
    Number(withdrawable.availableTotals[withdrawalCurrency] || 0)

  const [
    method,
    setMethod,
  ] = useState(
    'local_bank',
  )

  const [
    busy,
    setBusy,
  ] = useState(false)

  const withdrawals = list(ledger)
  const statusOf = item => clean(item?.status).toLowerCase()

  const pending = withdrawals.filter(item => statusOf(item) === 'pending_review')
  const processing = withdrawals.filter(item =>
    ['approved', 'processing'].includes(statusOf(item)))
  const paidWithdrawals = withdrawals.filter(item => statusOf(item) === 'paid')
  const rejectedWithdrawals = withdrawals.filter(item =>
    ['rejected', 'failed'].includes(statusOf(item)))

  const approvedPayouts = list(payouts).filter(item =>
    ['approved', 'paid'].includes(statusOf(item)))
  const paidPayouts = list(payouts).filter(item => statusOf(item) === 'paid')

  const activeDeals = list(deals).filter(item => {
    const status = clean(item?.dealStatus).toLowerCase()
    return status && !['rejected', 'cancelled'].includes(status)
  })

  const federationDeals = list(deals).filter(item =>
    clean(item?.sourceDivision).toLowerCase() === 'federation' ||
    clean(item?.dealType).toLowerCase().includes('federation'))

  const submitWithdrawal =
    async (event) => {
      event.preventDefault()

      if (busy) return

      const formData =
        new FormData(
          event.currentTarget,
        )

      const amount =
        Number(
          formData.get(
            'amount',
          ),
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

      const selectedCurrency =
        clean(formData.get('currency')).toUpperCase() || 'USD'

      const available =
        Number(withdrawable.availableTotals[selectedCurrency] || 0)

      if (amount > available) {
        onToast?.(
          'You can only withdraw up to ' +
            academyFormatAvailable(available, selectedCurrency) + '.',
          'error'
        )
        return
      }

      const payload = {
        sourceDivision:
          'academy',
        sourceFeature:
          'operator_withdrawal',
        sourceRecordId:
          `academy_withdrawal_${Date.now()}`,
        amount,
        currency:
          clean(
            formData.get(
              'currency',
            ),
          ).toUpperCase() ||
          'USD',
        method:
          clean(
            formData.get(
              'method',
            ),
          ) ||
          'local_bank',
        bankCountry:
          clean(
            formData.get(
              'bankCountry',
            ),
          ),
        bankName:
          clean(
            formData.get(
              'bankName',
            ),
          ),
        accountName:
          clean(
            formData.get(
              'accountName',
            ),
          ),
        accountNumber:
          clean(
            formData.get(
              'accountNumber',
            ),
          ),
        cardLast4:
          clean(
            formData.get(
              'cardLast4',
            ),
          ),
        cryptoCurrency:
          clean(
            formData.get(
              'cryptoCurrency',
            ),
          ).toUpperCase(),
        cryptoNetwork:
          clean(
            formData.get(
              'cryptoNetwork',
            ),
          ),
        walletAddress:
          clean(
            formData.get(
              'walletAddress',
            ),
          ),
        note:
          clean(
            formData.get(
              'note',
            ),
          ),
      }

      setBusy(true)

      try {
        const result =
          await apiFetch(
            '/api/payouts/withdrawal-requests',
            {
              method:
                'POST',
              body:
                JSON.stringify(
                  payload,
                ),
            },
          )

        if (
          result?.success !==
          true
        ) {
          throw new Error(
            result?.message ||
              'Failed to submit withdrawal request.',
          )
        }

        onToast?.(
          'Withdrawal request submitted for admin review.',
          'success',
        )

        setWithdrawalOpen(
          false,
        )

        await loadWorkspace(
          'payouts',
        )
      } catch (error) {
        onToast?.(
          error?.message ||
            'Failed to submit withdrawal request.',
          'error',
        )
      } finally {
        setBusy(false)
      }
    }

  return (
    <>
      <div className="academy-lead-readme-grid">
        {[
          ['Pending / Total Payouts',
            academyPayoutMoneySummary(academyPayoutMoneyTotals(payouts)),
            list(payouts).length + ' payout records tracked from lead missions and Federation introductions.'],
          ['Approved Payouts',
            academyPayoutMoneySummary(academyPayoutMoneyTotals(approvedPayouts)),
            approvedPayouts.length + ' approved or ready-for-payment payouts.'],
          ['Paid Out',
            academyPayoutMoneySummary(academyPayoutMoneyTotals(paidPayouts)),
            paidPayouts.length + ' payouts marked paid.'],
          ['Deal Value',
            academyPayoutMoneySummary(academyPayoutMoneyTotals(activeDeals, 'grossValue')),
            federationDeals.length + ' Federation paid introduction deals mirrored into Academy.']
        ].map(([title, amount, description]) => (
          <article className="academy-lead-info-card" key={title}>
            <div className="academy-profile-card-kicker">{title}</div>
            <h4 className="academy-lead-card-title">{amount}</h4>
            <p className="academy-lead-card-copy">{description}</p>
          </article>
        ))}
      </div>

      <article className="academy-lead-withdrawal-card">
        <div>
          <div className="academy-profile-card-kicker">Withdrawable Earnings</div>
          <h4 className="academy-lead-card-title">
            {academyPayoutMoneySummary(withdrawable.availableTotals)}
          </h4>
          <p className="academy-lead-card-copy">
            Approved earnings minus pending, processing, approved, or paid withdrawal requests.
            {' '}Reserved: {academyPayoutMoneySummary(withdrawable.reservedTotals)}.
          </p>
        </div>

        <button
          type="button"
          className="academy-ui-button academy-ui-button--primary"
          disabled={primaryAvailable <= 0}
          aria-disabled={primaryAvailable <= 0}
          onClick={() => {
            setWithdrawalCurrency(withdrawable.primaryCurrency)
            setWithdrawalOpen(true)
          }}
        >
          Request Withdrawal
        </button>
      </article>

      <section className="academy-lead-withdrawal-status-panel">
        <div className="academy-lead-withdrawal-status-head">
          <div>
            <div className="academy-profile-card-kicker">Withdrawal Status</div>
            <h4 className="academy-lead-card-title">
              {withdrawals.length
                ? 'Admin payout decisions'
                : 'No withdrawal requests yet'}
            </h4>
            <p className="academy-lead-card-copy">
              {withdrawals.length
                ? 'This table updates from the payout ledger after admin decisions.'
                : 'When you request a withdrawal, admin decisions will appear here.'}
            </p>
          </div>

          <button
            type="button"
            className="academy-ui-button academy-ui-button--secondary"
            disabled={busy}
            onClick={async () => {
              try {
                setBusy(true)
                await loadWorkspace('payouts')
                onToast?.('Withdrawal status refreshed.', 'success')
              } catch (error) {
                onToast?.(
                  error?.message || 'Failed to refresh withdrawal status.',
                  'error'
                )
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>

        <div className="academy-lead-withdrawal-status-grid">
          {[
            ['Withdrawal Requests', String(withdrawals.length),
              'All withdrawal requests submitted from your Academy earnings.'],
            ['Pending Review',
              academyPayoutMoneySummary(academyPayoutMoneyTotals(pending)),
              pending.length + ' requests waiting for admin review.'],
            ['Approved / Processing',
              academyPayoutMoneySummary(academyPayoutMoneyTotals(processing)),
              processing.length + ' requests being prepared for release.'],
            ['Paid Out',
              academyPayoutMoneySummary(academyPayoutMoneyTotals(paidWithdrawals)),
              paidWithdrawals.length + ' completed payouts.']
          ].map(([title, amount, description]) => (
            <article className="academy-lead-info-card" key={title}>
              <div className="academy-profile-card-kicker">{title}</div>
              <h4 className="academy-lead-card-title">{amount}</h4>
              <p className="academy-lead-card-copy">{description}</p>
            </article>
          ))}
        </div>

        {withdrawals.length > 0 && (
          <div className="academy-lead-table-wrap academy-lead-withdrawal-table-wrap">
            <table className="academy-lead-table">
              <thead>
                <tr>
                  <th>Method</th><th>Amount</th><th>Destination</th>
                  <th>Status</th><th>Admin Note</th><th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((item, index) => {
                  const status = statusOf(item) || 'pending_review'
                  const slug = status.replace(/[^a-z0-9_-]/g, '')

                  return (
                    <tr key={clean(item?.id || item?._id) || index}>
                      <td>
                        {clean(item?.method) || 'local_bank'}
                        <div className="academy-lead-list-meta">
                          {clean(item?.provider) || 'manual'}
                        </div>
                      </td>
                      <td>
                        {academyFormatAvailable(item?.amount || 0, item?.currency || 'USD')}
                      </td>
                      <td>{academyPayoutDestination(item)}</td>
                      <td>
                        <span className={
                          'academy-lead-withdrawal-status-badge academy-withdrawal-status-' + slug
                        }>
                          {academyPayoutLabel(status)}
                        </span>
                      </td>
                      <td>{clean(item?.adminNote) || '—'}</td>
                      <td>
                        {clean(
                          item?.updatedAt ||
                          item?.paidAt ||
                          item?.approvedAt ||
                          item?.createdAt
                        ) || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {rejectedWithdrawals.length > 0 && (
          <p className="academy-lead-card-copy academy-lead-withdrawal-warning">
            {rejectedWithdrawals.length} withdrawal requests need attention.
            Check the admin note or submit a corrected request.
          </p>
        )}
      </section>

      <PayoutRows
        items={payouts}
        emptyText="No mission payouts yet."
      />

      {withdrawalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Request Withdrawal"
        >
          <form
            className="modal-content academy-lead-form-grid"
            onSubmit={
              submitWithdrawal
            }
          >
            <div className="academy-lead-form-span-2">
              <div className="academy-profile-card-kicker">
                Academy Earnings
              </div>

              <h2>
                Request Withdrawal
              </h2>

              <p>
                Admin will review
                the request before
                release.
              </p>
            </div>

            <label className="form-group">
              <span>
                Amount
              </span>

              <input
                key={withdrawalCurrency}
                name="amount"
                className="input-field"
                type="number"
                min="0.01"
                max={Math.max(0, currencyAvailable).toFixed(2)}
                step="0.01"
                defaultValue={
                  currencyAvailable > 0
                    ? currencyAvailable.toFixed(2)
                    : ''
                }
                required
              />
              <small className="academy-lead-list-meta">
                Available: {academyFormatAvailable(
                  currencyAvailable,
                  withdrawalCurrency
                )}. Admin will review before release.
              </small>
            </label>

            <label className="form-group">
              <span>
                Currency
              </span>

              <select
                name="currency"
                className="input-field"
                value={withdrawalCurrency}
                onChange={(event) =>
                  setWithdrawalCurrency(event.target.value)
                }
              >
                {[
                  'USD',
                  'EUR',
                  'GBP',
                  'NGN',
                  'PHP',
                  'INR',
                ].map(
                  (currency) => (
                    <option
                      key={
                        currency
                      }
                      value={
                        currency
                      }
                    >
                      {currency}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="form-group">
              <span>
                Payout Method
              </span>

              <select
                name="method"
                className="input-field"
                value={method}
                onChange={(
                  event,
                ) =>
                  setMethod(
                    event.target
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

            {method ===
              'local_bank' && (
              <>
                <input
                  name="bankCountry"
                  className="input-field"
                  placeholder="Bank country"
                />

                <input
                  name="bankName"
                  className="input-field"
                  placeholder="Bank name"
                />

                <input
                  name="accountName"
                  className="input-field"
                  placeholder="Account name"
                />

                <input
                  name="accountNumber"
                  className="input-field"
                  placeholder="Account number"
                />
              </>
            )}

            {method ===
              'card' && (
              <input
                name="cardLast4"
                className="input-field"
                maxLength="4"
                placeholder="Card last 4 digits"
              />
            )}

            {method ===
              'crypto' && (
              <>
                <input
                  name="cryptoCurrency"
                  className="input-field"
                  placeholder="Crypto currency"
                />

                <input
                  name="cryptoNetwork"
                  className="input-field"
                  placeholder="Network"
                />

                <input
                  name="walletAddress"
                  className="input-field"
                  placeholder="Wallet address"
                />
              </>
            )}

            <textarea
              name="note"
              className="input-field academy-lead-form-span-2"
              rows="3"
              placeholder="Optional payout note"
            />

            <div className="academy-lead-form-actions academy-lead-form-span-2">
              <button
                type="button"
                className="academy-ui-button academy-ui-button--secondary"
                disabled={busy}
                onClick={() =>
                  setWithdrawalOpen(
                    false,
                  )
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="academy-ui-button academy-ui-button--primary"
                disabled={busy}
              >
                {busy
                  ? 'Submitting...'
                  : 'Submit Withdrawal Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
