import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './DashboardSettingsHub.css'

/* YHU_SETTINGS_UNIFIED_20261028 */

const GROUPS = [
  {
    title: 'Account',
    items: [
      ['settings', 'Account Settings', '⚙']
    ]
  },
  {
    title: 'Money & Activity',
    items: [
      ['wallet', 'Wallet', '◇'],
      ['referral', 'Referrals', '↗']
    ]
  },
  {
    title: 'Your Network',
    items: [
      ['my-contacts', 'My Contacts', '◉'],
      ['resources', 'Resources', '▤']
    ]
  }
]

export default function DashboardSettingsHub({
  activeKey = 'settings',
  onNavigate,
  onLogout,
  children
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  const open = key => {
    if (key === 'settings') {
      navigate('/settings')
    } else {
      onNavigate?.(key)
    }
  }

  return (
    <section
      className={
        'yhu-settings-unified' +
        (expanded ? ' is-expanded' : '')
      }
      aria-label="Settings and tools"
    >
      <aside
        className="yhu-settings-rail"
        aria-label="Settings sidebar"
        onMouseEnter={() => {
          if (window.matchMedia('(hover: hover)').matches) {
            setExpanded(true)
          }
        }}
        onMouseLeave={() => setExpanded(false)}
        onFocusCapture={() => setExpanded(true)}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setExpanded(false)
          }
        }}
      >
        <button
          type="button"
          className="yhu-settings-toggle"
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
        >
          <span aria-hidden="true">☰</span>
          <span className="yhu-settings-name">
            Settings &amp; Tools
          </span>
        </button>

        <div className="yhu-settings-nav-groups">
          {GROUPS.map(group => (
            <div className="yhu-settings-group" key={group.title}>
              <div className="yhu-settings-section-name">
                {group.title}
              </div>

              {group.items.map(([key, label, glyph]) => (
                <button
                  type="button"
                  key={key}
                  title={label}
                  aria-label={label}
                  aria-current={activeKey === key ? 'page' : undefined}
                  className={
                    'yhu-settings-nav-item' +
                    (activeKey === key ? ' is-selected' : '')
                  }
                  onClick={() => open(key)}
                >
                  <span
                    className="yhu-settings-glyph"
                    aria-hidden="true"
                  >
                    {glyph}
                  </span>
                  <span className="yhu-settings-name">{label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <button
          type="button"
          className="yhu-settings-nav-item yhu-settings-logout"
          title="Log out"
          aria-label="Log out"
          onClick={() => onLogout?.()}
        >
          <span className="yhu-settings-glyph" aria-hidden="true">
            ↪
          </span>
          <span className="yhu-settings-name">Log out</span>
        </button>
      </aside>

      <div
        className="yhu-settings-detail"
        role="region"
        aria-label="Settings content"
      >
        {children}
      </div>
    </section>
  )
}
