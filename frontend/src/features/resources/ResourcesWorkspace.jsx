import { RESOURCES } from './resourcesData.js'
function ResourceCard({
  resource,
}) {
  const content = (
    <div className="yh-resource-mini-top">
      <img
        src={resource.logo}
        alt={resource.alt}
        width="28"
        height="28"
        className="yh-resource-mini-logo"
        loading="lazy"
        decoding="async"
      />

      <div className="yh-resource-mini-copy-wrap">
        <div className="yh-resource-mini-name-row">
          <div className="yh-resource-mini-name">
            {resource.name}
            {!resource.disabled && (
              <span
                aria-hidden="true"
                style={{ color: '#22d3ee', marginLeft: 8 }}
              >
                ↗
              </span>
            )}
          </div>

          {resource.status && (
            <span className="yh-resource-mini-status">
              {resource.status}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (resource.disabled) {
    return (
      <div
        className="yh-resource-mini-card yh-resource-mini-card-disabled"
        aria-disabled="true"
      >
        {content}
      </div>
    )
  }

  return (
    <a
      href={resource.href}
      target="_blank"
      rel="noopener noreferrer"
      className="yh-resource-mini-card"
    >
      {content}
    </a>
  )
}

export default function ResourcesWorkspace() {
  return (
    <section
      id="yh-resources-inline-view"
      className="yh-resources-inline-view"
      aria-label="Resources"
      data-yh-dashboard-react-surface="resources"
    >
      <div className="yh-resources-menu-panel-head">
        <div className="yh-resources-menu-kicker">
          Quick Access
        </div>

        <h4 className="yh-resources-menu-title">
          Partnerships and Resources
        </h4>
      </div>

      <div className="yh-resources-menu-list">
        {RESOURCES.map(
          (resource) => (
            <ResourceCard
              key={resource.key}
              resource={resource}
            />
          ),
        )}
      </div>
    </section>
  )
}
