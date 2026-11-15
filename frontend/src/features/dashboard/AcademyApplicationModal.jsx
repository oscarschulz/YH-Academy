import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../services/api/apiClient'
import {
  DASHBOARD_ACCESS_CACHE_KEYS,
  normalizeAccessStatus,
} from './dashboardAccess'

function getStoredValue(...keys) {
  const stores = [sessionStorage, localStorage]

  for (const key of keys) {
    for (const store of stores) {
      try {
        const value = String(store.getItem(key) || '').trim()
        if (value) return value
      } catch { /* Noncritical browser storage or optional operation. */ }
    }
  }

  return ''
}

function getApplicantIdentity() {
  const displayName =
    getStoredValue('yh_user_name') || 'Hustler'

  const nameParts = displayName
    .split(/\s+/)
    .filter(Boolean)

  const firstName =
    getStoredValue(
      'yh_user_first_name',
      'yh_user_firstname',
    ) ||
    nameParts[0] ||
    'Hustler'

  const surname =
    getStoredValue(
      'yh_user_surname',
      'yh_user_last_name',
      'yh_user_lastname',
    ) ||
    (nameParts.length > 1
      ? nameParts.slice(1).join(' ')
      : '')

  const city = getStoredValue(
    'yh_user_city',
    'yh_user_location_city',
  )

  const country = getStoredValue(
    'yh_user_country',
    'yh_user_country_of_residence',
    'yh_user_location_country',
  )

  const countryOfOrigin =
    getStoredValue('yh_user_country_of_origin')

  return {
    name: displayName,
    firstName,
    surname,
    username: getStoredValue('yh_user_username'),
    email: getStoredValue('yh_user_email').toLowerCase(),
    city,
    country,
    countryOfOrigin,
  }
}

function createInitialForm() {
  const identity = getApplicantIdentity()

  return {
    firstName: identity.firstName,
    surname: identity.surname,
    countryOfResidence: identity.country,
    cityOfResidence: identity.city,
    countryOfOrigin: identity.countryOfOrigin,
    email: identity.email,
    age: '',
    occupationAtAge: '',
    skills: '',
    referredByUsername: '',
    hearAboutUs: '',
    seriousness: '',
    nonNegotiable: '',
  }
}

export default function AcademyApplicationModal({
  open,
  onClose,
  onSubmitted,
  onToast,
}) {
  const [form, setForm] = useState(createInitialForm)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const identity = useMemo(
    () => getApplicantIdentity(),
    [open],
  )

  const steps = [
    {
      key: 'firstName',
      label: 'First Name',
      type: 'text',
      required: true,
      readOnly: Boolean(identity.firstName),
      placeholder:
        'Pulled from your registration details when available.',
    },
    {
      key: 'surname',
      label: 'Surname',
      type: 'text',
      required: true,
      readOnly: Boolean(identity.surname),
      placeholder:
        'Pulled from your registration details when available.',
    },
    {
      key: 'countryOfResidence',
      label: 'Country of residence',
      type: 'text',
      required: true,
      readOnly: Boolean(identity.country),
      placeholder:
        'Pulled from your registration details when available.',
    },
    {
      key: 'cityOfResidence',
      label: 'City of residence',
      type: 'text',
      required: true,
      readOnly: Boolean(identity.city),
      placeholder:
        'Pulled from your registration details when available.',
    },
    {
      key: 'countryOfOrigin',
      label: 'Country of origin',
      type: 'text',
      required: true,
      readOnly: Boolean(identity.countryOfOrigin),
      placeholder: 'Enter your country of origin.',
    },
    {
      key: 'email',
      label: 'Drop your best e-mail address',
      type: 'email',
      required: true,
      readOnly: Boolean(identity.email),
      placeholder: 'you@example.com',
    },
    {
      key: 'age',
      label: 'Age',
      type: 'number',
      required: true,
      min: 13,
      max: 120,
      placeholder: 'e.g. 22',
    },
    {
      key: 'occupationAtAge',
      label: form.age
        ? `What do you do for a living at the age of ${form.age}?`
        : 'What do you do for a living at the age of your answer above?',
      textarea: true,
      required: true,
      placeholder: form.age
        ? `Tell us what you do for a living at age ${form.age}.`
        : 'What do you currently do for a living at your age right now?',
    },
    {
      key: 'skills',
      label: 'What are you good at? What are your skills?',
      textarea: true,
      required: true,
      placeholder:
        'List your strongest skills, abilities, experience, and things you naturally do well.',
    },
    {
      key: 'referredByUsername',
      label: 'Who referred you? (username from the database)',
      type: 'text',
      placeholder: '@username',
    },
    {
      key: 'hearAboutUs',
      label: form.referredByUsername.trim()
        ? 'In case the referrer username is incorrect, how did you hear from us?'
        : 'In case no one referred you, how did you hear from us?',
      textarea: true,
      required: !form.referredByUsername.trim(),
      placeholder:
        'Tell us where you found The Academy if no one referred you.',
    },
    {
      key: 'seriousness',
      label: 'How serious are you about being accepted?',
      select: true,
      required: true,
      options: [
        'Very Serious',
        'Serious but need structure',
        'Looking to learn',
        'Just Curious',
      ],
    },
    {
      key: 'nonNegotiable',
      label:
        'What is the one trait or standard that makes you a good fit for The Academy?',
      textarea: true,
      required: true,
      placeholder:
        'Discipline, hunger, consistency, obedience, resilience, execution, etc.',
    },
  ]

  const current = steps[step]
  const isFinal = step === steps.length - 1

  useEffect(() => {
    if (!open) return undefined

    let active = true
    queueMicrotask(() => {
      if (!active) return
      setForm(createInitialForm())
      setStep(0)
      setSubmitting(false)
      setSubmitted(false)
    })

    return () => { active = false }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const handleKey = (event) => {
      if (event.key === 'Escape' && !submitting) {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKey)

    document.body.classList.add('academy-launcher-open')

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.classList.remove('academy-launcher-open')
    }
  }, [open, submitting, onClose])

  if (!open) return null

  const update = (key, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }))
  }

  const validateCurrent = () => {
    const value = String(form[current.key] || '').trim()

    if (current.required && !value) {
      onToast?.('Please answer this question first.', 'error')
      return false
    }

    if (
      current.key === 'email' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      onToast?.('Please enter a valid email address.', 'error')
      return false
    }

    if (current.key === 'age') {
      const age = Number.parseInt(value, 10)

      if (
        !Number.isFinite(age) ||
        age < 13 ||
        age > 120
      ) {
        onToast?.('Please enter a valid age.', 'error')
        return false
      }
    }

    return true
  }

  const next = () => {
    if (!validateCurrent()) return
    if (!isFinal) setStep((value) => value + 1)
  }

  const back = () => {
    setStep((value) => Math.max(0, value - 1))
  }

  const submit = async (event) => {
    event.preventDefault()

    if (!validateCurrent()) return

    const referrerUsername = String(
      form.referredByUsername || '',
    )
      .trim()
      .replace(/^@+/, '')

    const hearAboutUs = String(
      form.hearAboutUs || '',
    ).trim()

    if (!referrerUsername && !hearAboutUs) {
      onToast?.(
        'Please enter a referrer username or tell us how you heard about The Academy.',
        'error',
      )
      return
    }

    const firstName = form.firstName.trim()
    const surname = form.surname.trim()

    const fullName = [firstName, surname]
      .filter(Boolean)
      .join(' ')
      .trim()

    const locationCountry =
      [
        form.cityOfResidence.trim(),
        form.countryOfResidence.trim(),
      ]
        .filter(Boolean)
        .join(', ') ||
      form.countryOfResidence.trim()

    const payload = {
      applicationType: 'academy-membership',

      name:
        fullName ||
        identity.name ||
        'Hustler',

      firstName,
      surname,

      fullName:
        fullName ||
        identity.name ||
        '',

      username: identity.username || '',

      email:
        form.email
          .trim()
          .toLowerCase(),

      age: form.age.trim(),

      occupationAtAge:
        form.occupationAtAge.trim(),

      skills:
        form.skills.trim(),

      referredByUsername:
        referrerUsername,

      hearAboutUs,

      cityOfResidence:
        form.cityOfResidence.trim(),

      countryOfResidence:
        form.countryOfResidence.trim(),

      countryOfOrigin:
        form.countryOfOrigin.trim(),

      locationCountry,

      seriousness:
        form.seriousness.trim(),

      nonNegotiable:
        form.nonNegotiable.trim(),

      whyNow:
        hearAboutUs ||
        `Referred by @${referrerUsername}`,

      mainGoal:
        form.occupationAtAge.trim(),

      proofWork:
        form.skills.trim(),

      sacrifice: '',
      weeklyHours: '',
      adminNote: '',
    }

    setSubmitting(true)

    try {
      const result = await apiFetch(
        '/api/academy/membership-apply',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      )

      const savedApplication =
        result?.application &&
        typeof result.application === 'object'
          ? result.application
          : null

      const snapshot = {
        hasApplication: true,

        applicationStatus:
          normalizeAccessStatus(
            savedApplication?.status ||
            'Under Review',
          ),

        hasRoadmapAccess: false,
        canEnterAcademy: false,
        application: savedApplication,
      }

      try {
        localStorage.setItem(
          DASHBOARD_ACCESS_CACHE_KEYS.academy,
          JSON.stringify(snapshot),
        )

        localStorage.setItem(
          'yh_academy_application_profile',
          JSON.stringify(
            savedApplication?.academyProfile ||
              payload,
          ),
        )
      } catch { /* Noncritical browser storage or optional operation. */ }

      setSubmitted(true)
      onSubmitted?.(snapshot)
    } catch (error) {
      onToast?.(
        error?.message ||
          'Failed to submit Academy application.',
        'error',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      id="academy-apply-modal"
      className="modal-overlay yh-dashboard-division-apply-modal yh-dashboard-academy-apply-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yh-dashboard-academy-apply-title"
      aria-hidden="false"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return

        onToast?.(
          'Use the close button if you want to exit the application form.',
          'info',
        )
      }}
    >
      <div className="modal-content hide-scrollbar yh-dashboard-division-apply-card yh-dashboard-academy-apply-card">
        <button
          id="close-academy-apply"
          type="button"
          className="yh-dashboard-division-apply-close"
          aria-label="Close Academy application"
          disabled={submitting}
          onClick={onClose}
        >
          ✖
        </button>

        {submitting ? (
          <div
            className="yh-division-application-submit-state"
            role="status"
            aria-live="polite"
          >
            <div
              className="yh-division-application-submit-spinner"
              aria-hidden="true"
            />

            <strong className="yh-division-application-submit-title">
              Submitting your application for review.
            </strong>

            <p className="yh-division-application-submit-copy">
              Please wait while your application is securely
              sent for admin review.
            </p>
          </div>
        ) : submitted ? (
          <div
            id="ai-verdict-phase"
            className="text-center py-large"
          >
            <div
              id="ai-verdict-icon"
              style={{ lineHeight: 1 }}
            >
              <img
                src="/images/yhlobby.png"
                alt="YH Lobby"
                style={{
                  width: 80,
                  height: 80,
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto',
                }}
              />
            </div>

            <h2
              id="ai-verdict-title"
              style={{
                color: 'var(--neon-blue)',
                marginTop: '1rem',
              }}
            >
              Application Submitted for Review
            </h2>

            <p
              id="ai-verdict-desc"
              className="subtitle mb-large"
            >
              Your Academy membership application is now
              pending manual admin review.
              <br />
              <br />
              You will get an answer within the next 24
              hours, check your email for updates.
              <br />
              <br />
              Once approved, you will be able to enter the
              Academy community.
              <br />
              <br />
              Roadmap access will remain separate.
            </p>

            <button
              type="button"
              className="btn-primary w-full"
              style={{
                padding: 12,
                fontSize: '1.1rem',
              }}
              onClick={onClose}
            >
              Close ➔
            </button>
          </div>
        ) : (
          <div id="ai-form-phase">
            <div className="text-center mb-1-25">
              <h2
                id="yh-dashboard-academy-apply-title"
                className="yh-title-small yh-dashboard-academy-apply-title-clean"
                aria-label="Academy Application"
              />

              <p className="yh-subtitle-small">
                Complete the Academy application below.
                Core identity details are pulled from the
                registration flow when available, and
                submission will send your application for
                manual admin review.
              </p>
            </div>

            <form
              id="form-academy-apply"
              className={`yh-one-question-form ${
                isFinal
                  ? 'is-yh-one-question-final'
                  : ''
              }`}
              onSubmit={submit}
              onKeyDown={(event) => {
                if (
                  event.key !== 'Enter' ||
                  event.target instanceof HTMLTextAreaElement ||
                  isFinal
                ) {
                  return
                }

                event.preventDefault()
                next()
              }}
            >
              <div className="yh-one-question-head">
                <div className="yh-one-question-meta">
                  <span>
                    Question {step + 1}
                  </span>

                  <span>
                    {step + 1} of {steps.length}
                  </span>
                </div>

                <div className="yh-one-question-title">
                  {current.label}
                </div>

                <div
                  className="yh-one-question-progress-track"
                  aria-hidden="true"
                >
                  <span
                    className="yh-one-question-progress-bar"
                    style={{
                      width: `${
                        ((step + 1) /
                          steps.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="form-group w-full mb-small is-yh-one-question-active">
                <label>{current.label}</label>

                {current.select ? (
                  <select
                    className="input-field styled-select"
                    required={current.required}
                    value={form[current.key]}
                    onChange={(event) =>
                      update(
                        current.key,
                        event.target.value,
                      )
                    }
                  >
                    <option value="" disabled>
                      Select status.
                    </option>

                    {current.options.map((option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    ))}
                  </select>
                ) : current.textarea ? (
                  <textarea
                    className="input-field"
                    rows="2"
                    required={current.required}
                    placeholder={current.placeholder}
                    value={form[current.key]}
                    onChange={(event) =>
                      update(
                        current.key,
                        event.target.value,
                      )
                    }
                  />
                ) : (
                  <input
                    className="input-field"
                    type={current.type || 'text'}
                    required={current.required}
                    readOnly={current.readOnly}
                    min={current.min}
                    max={current.max}
                    placeholder={current.placeholder}
                    value={form[current.key]}
                    onChange={(event) =>
                      update(
                        current.key,
                        event.target.value,
                      )
                    }
                  />
                )}
              </div>

              <div className="yh-one-question-controls">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={step === 0}
                  aria-disabled={
                    step === 0
                      ? 'true'
                      : 'false'
                  }
                  onClick={back}
                >
                  ← Back
                </button>

                {!isFinal && (
                  <button
                    type="button"
                    className="btn-primary yh-one-question-next"
                    onClick={next}
                  >
                    Continue ➔
                  </button>
                )}
              </div>

              {isFinal && (
                <button
                  type="submit"
                  id="btn-submit-ai"
                  className="btn-primary w-full mt-small"
                  style={{
                    padding: 12,
                    fontSize: '1.1rem',
                  }}
                >
                  Submit Academy Application ➔
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
