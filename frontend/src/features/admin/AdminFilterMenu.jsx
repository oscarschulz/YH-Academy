import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useRef
} from 'react'

function filterElements(children) {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return []

    return child.type === Fragment
      ? filterElements(child.props.children)
      : [child]
  })
}

const fieldNames = {
  status: 'Status',
  division: 'Division',
  gate: 'Gate status',
  focus: 'Focus area',
  review: 'Review status',
  stage: 'Lead stage',
  scope: 'Network scope',
  value: 'Strategic value',
  country: 'Country',
  type: 'Listing type',
  lane: 'Routing lane',
  provider: 'Provider',
  method: 'Method'
}

function fieldName(id) {
  const key = String(id || '')
    .replace(/-filter$/, '')
    .split('-')
    .pop()

  return fieldNames[key] || 'Filter'
}

export default function AdminFilterMenu({ children }) {
  const detailsRef = useRef(null)
  const fields = filterElements(children)

  const activeCount = fields.filter(field => {
    const value = field.props.value

    return (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      value !== 'all'
    )
  }).length

  useEffect(() => {
    const onOutsidePointer = event => {
      const details = detailsRef.current

      if (details?.open && !details.contains(event.target)) {
        details.open = false
      }
    }

    const onEscape = event => {
      const details = detailsRef.current

      if (event.key !== 'Escape' || !details?.open) return

      details.open = false
      details.querySelector('summary')?.focus()
      event.stopPropagation()
    }

    document.addEventListener('pointerdown', onOutsidePointer)
    document.addEventListener('keydown', onEscape)

    return () => {
      document.removeEventListener('pointerdown', onOutsidePointer)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  return (
    <details className="admin-filter-menu" ref={detailsRef}>
      <summary>
        <span
          className="admin-filter-menu-icon"
          aria-hidden="true"
        >
          ☷
        </span>

        <span>Filters</span>

        {activeCount > 0 && (
          <span
            className="admin-filter-menu-count"
            aria-label={activeCount + ' active filters'}
          >
            {activeCount}
          </span>
        )}

        <span
          className="admin-filter-menu-chevron"
          aria-hidden="true"
        />
      </summary>

      <div className="admin-filter-menu-popup">
        <div className="admin-filter-menu-title">
          Filter by
        </div>

        <div className="admin-filter-menu-fields">
          {fields.map((field, index) => (
            <div
              className="admin-filter-menu-field"
              key={field.props.id || index}
            >
              <label htmlFor={field.props.id}>
                {fieldName(field.props.id)}
              </label>

              {field}
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}
