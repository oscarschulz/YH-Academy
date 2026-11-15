import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function AdminActionModal({
  title, description, submitLabel, fields,
  busy, error, onCancel, onSubmit
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      fields.map(field => [
        field.name,
        String(field.value ?? '')
      ])
    )
  )

  useEffect(() => {
    const previous = document.activeElement
    document.querySelector('#yh-admin-inline-modal [name]')?.focus()
    return () => previous?.focus?.()
  }, [])

  useEffect(() => {
    const escape = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (!busy) onCancel()
    }

    document.addEventListener('keydown', escape, true)

    return () =>
      document.removeEventListener('keydown', escape, true)
  }, [busy, onCancel])

  const fieldStyle = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid rgba(255,255,255,.14)',
    background: 'rgba(255,255,255,.06)',
    color: '#f8fafc',
    borderRadius: 12,
    padding: '11px 12px'
  }

  return createPortal(
    <div
      id="yh-admin-inline-modal"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) {
          onCancel()
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30000,
        background: 'rgba(0,0,0,.68)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={event => {
          event.preventDefault()

          onSubmit(
            Object.fromEntries(
              Object.entries(values).map(([key, value]) => [
                key, value.trim()
              ])
            )
          )
        }}
        style={{
          width: 'min(94vw, 620px)',
          maxHeight: '86vh',
          overflow: 'auto',
          background: '#0b1220',
          border: '1px solid rgba(255,255,255,.14)',
          borderRadius: 18,
          boxShadow: '0 24px 80px rgba(0,0,0,.48)',
          padding: 20,
          color: '#f8fafc'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 16
        }}>
          <div>
            <div style={{
              fontSize: '.75rem',
              textTransform: 'uppercase',
              letterSpacing: '.14em',
              color: '#8bb3ff',
              fontWeight: 700
            }}>
              Admin Action
            </div>

            <h3 style={{ margin: '5px 0 4px' }}>
              {title}
            </h3>

            <p style={{ margin: 0, color: '#98a4b8' }}>
              {description}
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            aria-label="Close admin action"
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gap: 13 }}>
          {fields.map(field => (
            <label
              key={field.name}
              style={{ display: 'grid', gap: 7 }}
            >
              <span>{field.label}</span>

              {field.type === 'textarea' ? (
                <textarea
                  name={field.name}
                  rows={field.rows || 5}
                  value={values[field.name] ?? ''}
                  onChange={event => setValues(old => ({
                    ...old,
                    [field.name]: event.target.value
                  }))}
                  placeholder={field.placeholder || ''}
                  required={!!field.required}
                  disabled={busy}
                  style={fieldStyle}
                />
              ) : field.type === 'select' ? (
                <select
                  name={field.name}
                  value={values[field.name] ?? ''}
                  onChange={event => setValues(old => ({
                    ...old,
                    [field.name]: event.target.value
                  }))}
                  required={!!field.required}
                  disabled={busy}
                  style={fieldStyle}
                >
                  {(field.options || []).map(option => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type || 'text'}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={values[field.name] ?? ''}
                  onChange={event => setValues(old => ({
                    ...old,
                    [field.name]: event.target.value
                  }))}
                  placeholder={field.placeholder || ''}
                  required={!!field.required}
                  disabled={busy}
                  style={fieldStyle}
                />
              )}
            </label>
          ))}
        </div>

        {error && (
          <p role="alert" style={{ color: '#fca5a5' }}>
            {error}
          </p>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 18
        }}>
          <button type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>

          <button type="submit" disabled={busy}>
            {busy ? 'Processing...' : submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
