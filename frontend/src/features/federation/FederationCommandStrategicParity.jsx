import './FederationCommandStrategicParity.css'

function clean(value = '') { return String(value ?? '').trim() }
function formatNumber(value) { return (Number(value) || 0).toLocaleString() }

export default function FederationCommandStrategicParity({ model, onRefresh, onWorkspaceOpen }) {
  return (
    <section
      className="yh-fed-strategic-parity"
      data-yh-federation-strategic-parity="ready"
    >
      <header className="yh-fed-strategic-parity-head">
        <div>
          <span>
            Strategic Command
          </span>

          <h2>
            Influence Governance
            and Diplomacy
          </h2>

          <p>
            Read-only strategic
            signals derived from
            current Federation
            records.
          </p>
        </div>

        <button
          type="button"
          className="yh-fed-action yh-fed-action-secondary"
          onClick={() =>
            onRefresh?.()
          }
        >
          Refresh
        </button>
      </header>

      <div className="yh-fed-strategic-metrics">
        <article>
          <small>
            Total Influence
          </small>

          <strong>
            {formatNumber(
              model.totalInfluence,
            )}
          </strong>

          <span>
            {formatNumber(
              model.weeklyInfluence,
            )}{' '}
            this week
          </span>
        </article>

        <article>
          <small>
            Verified Events
          </small>

          <strong>
            {formatNumber(
              model.influenceEventCount,
            )}
          </strong>

          <span>
            Canonical influence ledger
          </span>
        </article>

        <article>
          <small>
            Council Signals
          </small>

          <strong>
            {formatNumber(
              model.activeProposals +
                model.strategicSessions,
            )}
          </strong>

          <span>
            Authority unwired
          </span>
        </article>

        <article>
          <small>
            Diplomacy Signals
          </small>

          <strong>
            {formatNumber(
              model.diplomacySignals,
            )}
          </strong>

          <span>
            {
              model.regionalRelationships
            }{' '}
            regional lanes
          </span>
        </article>
      </div>

      <div className="yh-fed-strategic-grid">
        <div className="yh-fed-strategic-column">
          <article className="yh-fed-strategic-card">
            <div className="yh-fed-strategic-card-head">
              <div>
                <span>
                  Influence Framework
                </span>

                <h3>
                  Canonical Influence Ledger
                </h3>
              </div>

              <span className="yh-fed-strategic-pill">
                Live
              </span>
            </div>

            <div className="yh-fed-strategic-stat-list">
              <div>
                <span>
                  Total influence
                </span>

                <strong>
                  {formatNumber(
                    model.totalInfluence,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Weekly influence
                </span>

                <strong>
                  {formatNumber(
                    model.weeklyInfluence,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Verified events
                </span>

                <strong>
                  {formatNumber(
                    model.influenceEventCount,
                  )}
                </strong>
              </div>
            </div>

            {model.influenceEvents
              .length > 0 && (
              <div className="yh-fed-strategic-items">
                {model.influenceEvents.map(
                  (
                    event,
                    index,
                  ) => (
                    <div
                      key={
                        clean(
                          event.id,
                        ) ||
                        'influence-' +
                          index
                      }
                    >
                      <strong>
                        {clean(
                          event.title ||
                            event.label ||
                            event.type,
                        ) ||
                          'Influence Event'}
                      </strong>

                      <span>
                        {clean(
                          event.description ||
                            event.note ||
                            event.reason,
                        ) ||
                          'Verified Federation influence signal.'}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </article>

        <article className="yh-fed-strategic-card">
          <div className="yh-fed-strategic-card-head">
            <div>
              <span>Diplomacy Board</span>
              <h3>Introductions, Relationships and Strategic Handoffs</h3>
            </div>
            <button
              type="button"
              className="yh-fed-action yh-fed-action-secondary"
              onClick={() => onWorkspaceOpen?.('federation-connect')}
            >
              Open Strategic Connect
            </button>
          </div>

          <div className="yh-fed-strategic-metrics yh-fed-strategic-metrics-compact">
            {[
              ['Active Introductions', model.diplomacy.activeIntroductions],
              ['Pending Diplomatic Requests', model.diplomacy.pendingDiplomaticRequests],
              ['Regional Relationships', model.diplomacy.regionalRelationships],
              ['Alliance Signals', model.diplomacy.allianceSignals],
              ['Strategic Handoffs', model.diplomacy.strategicHandoffs],
            ].map(([label, value]) => (
              <article key={label}>
                <small>{label}</small>
                <strong>{formatNumber(value)}</strong>
              </article>
            ))}
          </div>

          {model.diplomacy.items.length
            ? <div className="yh-fed-strategic-items">
              {model.diplomacy.items.map(item => (
                <div key={item.kind + ':' + item.id}>
                  <small>{item.kind}</small>
                  <strong>{item.title}</strong>
                  <span>{item.phase}</span>
                  <p>{item.objective}</p>
                  <span>{item.region} • {item.risk}</span>
                  <button
                    type="button"
                    className="yh-fed-action yh-fed-action-secondary"
                    onClick={() => onWorkspaceOpen?.(item.target)}
                  >
                    Open Diplomatic Route
                  </button>
                </div>
              ))}
            </div>
            : <p>No diplomacy record is visible. Existing Connect opportunities and requests will populate this board without generating a new diplomatic record.</p>}

          <p className="yh-fed-strategic-disclaimer">
            Relationship and alliance labels are source-signal summaries only. No diplomatic status, negotiation authority or protected contact access is granted here.
          </p>
        </article>
        </div>

        <article className="yh-fed-strategic-card">
          <div className="yh-fed-strategic-card-head">
            <div>
              <span>Council Governance</span>
              <h3>Planned Strategic Review Path</h3>
            </div>
            <span className="yh-fed-strategic-pill">Authority Unwired</span>
          </div>

          <div className="yh-fed-strategic-stat-list">
            {[
              ['Council Standing', model.council.councilStatus],
              ['Governance Authority', model.council.governanceAuthority],
              ['Active Proposals', model.council.activeProposals],
              ['Strategic Sessions', model.council.strategicSessions],
              ['Regional Concerns', model.council.regionalConcerns],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{typeof value === 'number' ? formatNumber(value) : value}</strong>
              </div>
            ))}
          </div>

          <div className="yh-fed-strategic-items">
            {[
              ['01', 'Proposal Intake', model.council.activeProposals, 'Open Deal Room signals enter the review path.'],
              ['02', 'Strategic Review', model.council.reviewSignals, 'Current records awaiting validation or decision context.'],
              ['03', 'Regional Coordination', model.council.regionalConcerns, 'Regional signals requiring attention or alignment.'],
              ['04', 'Trusted Referral Signal', model.council.referralSignals, 'Existing referral activity supporting future governance contribution.'],
              ['05', 'Authority Layer', 0, 'Council permissions, decisions, and authority remain unwired.'],
            ].map(([index, label, value, note]) => (
              <div key={index}>
                <strong>{index} · {label}</strong>
                <span>{note}</span>
                <span>{formatNumber(value)} signals</span>
              </div>
            ))}
          </div>

          <div className="yh-fed-strategic-items">
            {model.council.concernItems.length
              ? model.council.concernItems.map(item => (
                <div key={item.kind + ':' + item.id}>
                  <small>{item.kind}</small>
                  <strong>{item.title}</strong>
                  <span>{item.region}</span>
                  <span>{item.phase} • {item.risk}</span>
                  <button
                    type="button"
                    className="yh-fed-action yh-fed-action-secondary"
                    onClick={() => onWorkspaceOpen?.(item.target)}
                  >
                    Review Signal
                  </button>
                </div>
              ))
              : <p>No regional concern signal is visible. Current requests and operations do not expose a review or elevated-risk regional signal.</p>}
          </div>

          <p className="yh-fed-strategic-disclaimer">
            No proposal vote, council decision, governance authority or approval permission is created by this view.
          </p>
        </article>
      </div>

      <div className="yh-fed-strategic-foot-actions">
        <button
          type="button"
          className="yh-fed-action yh-fed-action-secondary"
          onClick={() =>
            onWorkspaceOpen?.(
              'federation-directory',
            )
          }
        >
          Open Directory
        </button>

        <span>
          {
            model.activeOperations
          }{' '}
          active strategic
          operations are already
          tracked by Federation
          Command.
        </span>
      </div>
    </section>
  )
}
