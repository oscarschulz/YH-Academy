const cleanText = (value, fallback = '') =>
  String(value ?? '').trim() || fallback

const numberOr = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback

const list = value => Array.isArray(value) ? value : []

function InlineList({ items }) {
  const values = list(items).filter(Boolean)
  return values.length
    ? <ul className="yhae-detail-list">
        {values.map((value, i) => <li key={i}>{value}</li>)}
      </ul>
    : <p className="yhae-muted-copy">No details available yet.</p>
}

function MissionCard({ mission, allowComplete, actions }) {
  const id = cleanText(mission.id || mission.missionId)
  const sourceTitle = mission.title || mission.name || mission.category || mission.type
  const title = typeof window.getAcademyMissionDisplayName === 'function'
    ? window.getAcademyMissionDisplayName(sourceTitle, 'Academy Mission')
    : cleanText(sourceTitle, 'Academy Mission')
  const description = cleanText(
    mission.description || mission.doneLooksLike || mission.whyItMatters,
    'No mission description yet.'
  )
  const status = cleanText(mission.status, 'pending').toLowerCase()
  const typeSource = mission.category || mission.type || mission.pillar
  const typeLabel = typeof window.getAcademyMissionDisplayName === 'function'
    ? window.getAcademyMissionDisplayName(typeSource, 'Academy Mission')
    : cleanText(typeSource, 'Academy Mission')
  const estimatedMinutes = numberOr(mission.estimatedMinutes || mission.minutes)
  const dueDate = cleanText(mission.dueDate || mission.date)
  const completed = status === 'completed' || status === 'done'

  return <article className="yhae-real-card" data-mission-status={status}>
    <div className="yhae-real-card-head">
      <span>{typeLabel}</span>
      <em>{typeof window.getMissionStatusLabel === 'function'
        ? window.getMissionStatusLabel(status) : status}</em>
    </div>
    <h3>{title}</h3>
    <p>{description}</p>
    <div className="yhae-card-meta">
      {estimatedMinutes > 0 && <span>{estimatedMinutes} min</span>}
      {dueDate && <span>Due {dueDate}</span>}
    </div>
    {allowComplete && id && !completed &&
      <button type="button" className="yhae-inline-action"
        onClick={() => actions.completeMission(id)}>
        Mark Complete
      </button>}
  </article>
}

function Intake({ actions, busy }) {
  return <>
    <section className="yhae-hero yhae-roadmap-intake-hero">
      <div>
        <div className="yhae-kicker">Roadmap Creation</div>
        <h1>Create Your Roadmap</h1>
        <h2>Build a personalized 28-day execution path.</h2>
        <p>Answer these setup questions so YH Academy can shape your Roadmap around your current level, focus, time, blockers, and target outcome.</p>
      </div>
      <aside>
        <img src="/images/logo.avif" alt=""/>
        <strong>One-Time Setup</strong>
        <span>After this, your Roadmap workspace becomes personalized.</span>
      </aside>
    </section>
    <form className="yhae-roadmap-form" id="yhaeRoadmapIntakeForm"
      onSubmit={actions.submitRoadmapIntake}>
      <section className="yhae-panel">
        <div className="yhae-section-head">
          <div>
            <div className="yhae-kicker">Step 1</div>
            <h2>Focus and Target</h2>
          </div>
        </div>
        <div className="yhae-form-grid">
          <label><span>Main focus area</span>
            <select id="roadmap-focus-area" required defaultValue="">
              <option value="">Select your focus</option>
              <option value="self_mastery">Self Mastery</option>
              <option value="business">Business / Money</option>
              <option value="content">Content / Influence</option>
              <option value="skill">Skill Building</option>
              <option value="career">Career / Work</option>
              <option value="fitness">Fitness / Discipline</option>
            </select>
          </label>
          <label><span>Current level</span>
            <select id="roadmap-current-level" required defaultValue="">
              <option value="">Select your level</option>
              <option value="beginner">Beginner — I need structure</option>
              <option value="intermediate">Intermediate — I need consistency</option>
              <option value="advanced">Advanced — I need execution pressure</option>
            </select>
          </label>
          <label className="yhae-form-wide">
            <span>What do you want to achieve in 30 days?</span>
            <textarea id="roadmap-target-30" rows="3" required
              placeholder="Example: build discipline, launch an offer, finish a project, become consistent..."/>
          </label>
        </div>
      </section>
      <section className="yhae-panel">
        <div className="yhae-kicker">Step 2</div>
        <h2>Time, Energy, and Blockers</h2>
        <div className="yhae-form-grid">
          <label><span>Daily available time</span>
            <select id="roadmap-daily-hours" required defaultValue="">
              <option value="">Select time</option>
              <option value="30 minutes">30 minutes</option>
              <option value="1 hour">1 hour</option>
              <option value="2 hours">2 hours</option>
              <option value="3+ hours">3+ hours</option>
            </select>
          </label>
          <label><span>Weekly available time</span>
            <select id="roadmap-weekly-hours" defaultValue="">
              <option value="">Select weekly time</option>
              <option value="3-5 hours">3–5 hours</option>
              <option value="6-10 hours">6–10 hours</option>
              <option value="11-20 hours">11–20 hours</option>
              <option value="20+ hours">20+ hours</option>
            </select>
          </label>
          <label><span>Average sleep</span>
            <select id="roadmap-sleep-hours" defaultValue="">
              <option value="">Select sleep</option>
              <option value="less than 5 hours">Less than 5 hours</option>
              <option value="5-6 hours">5–6 hours</option>
              <option value="7-8 hours">7–8 hours</option>
              <option value="8+ hours">8+ hours</option>
            </select>
          </label>
          <label><span>Energy level</span>
            <select id="roadmap-energy-level" defaultValue="">
              <option value="">Select energy</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label><span>Stress level</span>
            <select id="roadmap-stress-level" defaultValue="">
              <option value="">Select stress</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label><span>Coach tone</span>
            <select id="roadmap-coach-tone" defaultValue="balanced">
              <option value="balanced">Balanced</option>
              <option value="strict">Strict</option>
              <option value="supportive">Supportive</option>
              <option value="direct">Direct</option>
            </select>
          </label>
          <label className="yhae-form-wide">
            <span>Biggest blocker right now</span>
            <textarea id="roadmap-blocker-text" rows="3" required
              placeholder="Example: procrastination, no direction, lack of discipline, too many ideas..."/>
          </label>
          <label><span>Bad habit to reduce</span>
            <input id="roadmap-bad-habit" type="text"
              placeholder="Example: scrolling, sleeping late..."/>
          </label>
          <label><span>First quick win</span>
            <input id="roadmap-first-win" type="text"
              placeholder="Example: finish first task today..."/>
          </label>
        </div>
      </section>
      <section className="yhae-panel yhae-roadmap-submit-panel">
        <div>
          <div className="yhae-kicker">Final Step</div>
          <h2>Generate your personalized Roadmap</h2>
          <p>This will submit your setup profile and create your Roadmap access state using the existing Academy backend flow.</p>
        </div>
        <div className="yhae-form-actions">
          <button type="button" className="yhae-small-btn"
            onClick={actions.refreshRoadmap}>Refresh Status</button>
          <button type="submit" className="yhae-primary-action"
            id="btn-submit-roadmap-intake" disabled={busy}>
            {busy ? 'Creating Roadmap...' : 'Build My Roadmap ➔'}
          </button>
        </div>
      </section>
    </form>
  </>
}

function Roadmap({ view, actions }) {
  const {home, completionRate, completed, total, todayDone, todayTotal,
    streakDays, recentCheckins, missions, roadmapTitle, roadmapOutcome} = view
  return <>
    <section className="yhae-hero yhae-real-hero">
      <div>
        <div className="yhae-kicker">Academy Roadmap</div>
        <h1>Roadmap</h1>
        <h2>{roadmapTitle}</h2>
        <p>{roadmapOutcome}</p>
      </div>
      <aside>
        <img src="/images/logo.avif" alt=""/>
        <strong>{home.emptyRoadmap ? 'Setup Pending' : 'Active Roadmap'}</strong>
        <span>{home.emptyRoadmap
          ? 'Your roadmap shell is ready.'
          : `${completionRate}% complete`}</span>
      </aside>
    </section>
    {(home.emptyRoadmap || home.roadmapPending) &&
      <section className="yhae-panel yhae-warning-panel">
        <div className="yhae-kicker">Roadmap Status</div>
        <h2>Roadmap setup is unlocked.</h2>
        <p>{home.message || 'Your first active roadmap is still being prepared.'}</p>
      </section>}
    <section className="yhae-metric-grid">
      {[
        ['Overall Progress', `${completionRate}%`, `${completed}/${total} roadmap steps completed`],
        ['Today', `${todayDone}/${todayTotal}`, 'Roadmap steps completed today'],
        ['Streak', `${streakDays}`, 'Current execution streak'],
        ['Check-ins', `${recentCheckins.length}`, 'Recent accountability logs']
      ].map(([label, value, detail]) =>
        <article key={label} className="yhae-metric-card">
          <span>{label}</span><strong>{value}</strong><p>{detail}</p>
        </article>)}
    </section>
    <section className="yhae-panel">
      <div className="yhae-section-head">
        <div>
          <div className="yhae-kicker">Today’s Execution</div>
          <h2>Roadmap Steps</h2>
        </div>
        <button type="button" className="yhae-small-btn"
          onClick={actions.refreshRoadmap}>Refresh</button>
      </div>
      {missions.length
        ? <div className="yhae-real-grid">
            {missions.map((mission, index) =>
              <MissionCard key={mission.id || mission.missionId || index}
                mission={mission} allowComplete actions={actions}/>)}
          </div>
        : <div className="yhae-empty-state">
            <strong>No Roadmap steps yet.</strong>
            <p>Your Roadmap shell exists, but no personalized steps were returned yet. Rebuild the workspace to generate the execution steps.</p>
            <div className="yhae-form-actions">
              <button type="button" className="yhae-small-btn"
                onClick={actions.rebuildRoadmapWorkspace}>
                Rebuild Roadmap
              </button>
            </div>
          </div>}
    </section>
    <section className="yhae-panel">
      <div className="yhae-kicker">Recent Check-ins</div>
      <h2>Accountability Signals</h2>
      {recentCheckins.length
        ? <div className="yhae-checkin-list">
            {recentCheckins.map((checkin, index) =>
              <article key={checkin.id || index}>
                <span>{cleanText(checkin.checkinDate || checkin.createdAt, 'Recent Check-in')}</span>
                <strong>{cleanText(checkin.completedSummary || checkin.reflectionText, 'Progress logged.')}</strong>
                <p>{cleanText(
                  checkin.tomorrowFocus || checkin.correctionForTomorrow ||
                  checkin.blockerText, 'No extra note.')}</p>
              </article>)}
          </div>
        : <div className="yhae-empty-state">
            <strong>No check-ins yet.</strong>
            <p>Once check-ins are submitted, they will show here as accountability history.</p>
          </div>}
    </section>
  </>
}

function Missions({ view, actions }) {
  return <section className="yhae-panel yhae-missions-only-panel">
    <div className="yhae-section-head yhae-missions-main-head">
      <div>
        <div className="yhae-kicker">Mission Playbooks</div>
        <h2>Core Mission Tracks</h2>
        <p>Choose one mission track to view the full guide, tools, proof requirements, tracking fields, and payout logic.</p>
      </div>
      <button type="button" className="yhae-small-btn"
        onClick={actions.refreshMissions}>Refresh</button>
    </div>
    <div className="yhae-playbook-grid yhae-core-mission-grid">
      {view.playbooks.map(playbook => {
        const selected = view.selected === playbook.key
        return <article key={playbook.key}
          className={`yhae-playbook-card yhae-mission-track-card ${selected ? 'is-selected' : ''}`}>
          <div className="yhae-real-card-head">
            <span>{playbook.typeLabel || 'Mission Playbook'}</span>
            <em>{playbook.difficulty || 'Mission'}</em>
          </div>
          <strong>{playbook.title || 'Academy Mission'}</strong>
          <p>{playbook.summary || playbook.description ||
            'Execution guide for Academy missions.'}</p>
          <div className="yhae-playbook-actions">
            <button type="button" className="yhae-inline-action"
              onClick={() => actions.openPlaybook(playbook.key)}>
              {selected ? 'Close Mission Details' : 'Open Mission Details'}
            </button>
          </div>
          {selected &&
            <div className="yhae-playbook-detail yhae-full-mission-detail">
              <section>
                <div className="yhae-kicker">Mission Objective</div>
                <p>{playbook.objective ||
                  'Complete the mission requirements and submit proof when the workspace is connected.'}</p>
              </section>
              <section>
                <div className="yhae-kicker">Full Mission Concept</div>
                <p>{playbook.description || playbook.summary || ''}</p>
              </section>
              <section><div className="yhae-kicker">Tools Needed</div>
                <InlineList items={playbook.tools}/></section>
              <section><div className="yhae-kicker">Tracking Fields</div>
                <InlineList items={playbook.trackingFields}/></section>
              <section><div className="yhae-kicker">Proof Required</div>
                <InlineList items={playbook.proofRequired}/></section>
              <section><div className="yhae-kicker">Reward / Payout Logic</div>
                <InlineList items={playbook.rewards}/></section>
            </div>}
        </article>
      })}
    </div>
  </section>
}

export default function AcademyEmbedStage({ view, actions, busy }) {
  if (!view || !view.type) return null

  switch (view.type) {
    case 'expired':
      return <section className="yhae-panel yhae-locked">
        <div className="yhae-kicker">Session Expired</div>
        <h1>Please sign in again.</h1>
        <p>Your current Gate Pass is expired, so the Academy cannot load or build your Roadmap yet.</p>
        <div className="yhae-form-actions">
          <button type="button" className="yhae-small-btn"
            onClick={actions.loginAgain}>Go to Login</button>
        </div>
      </section>

    case 'locked':
      return <section className="yhae-panel yhae-locked">
        <div className="yhae-kicker">Academy Access</div>
        <h1>{view.title}</h1>
        <p>{view.description}</p>
      </section>

    case 'fallback': {
      const section = view.section
      return <>
        <section className="yhae-hero">
          <div>
            <div className="yhae-kicker">{section.kicker}</div>
            <h1>{section.title}</h1>
            <h2>{section.subtitle}</h2>
            <p>{section.description}</p>
          </div>
          <aside>
            <img src="/images/logo.avif" alt=""/>
            <strong>Coming Next</strong>
            <span>This section will be connected after Roadmap and Missions.</span>
          </aside>
        </section>
        <section className="yhae-panel">
          <div className="yhae-kicker">Migration Status</div>
          <h2>{section.title} is ready for the next V3 migration pass.</h2>
          <p>Roadmap and Missions are being connected first because they carry the main execution logic. This page is already isolated from the old Academy shell.</p>
        </section>
      </>
    }

    case 'generation':
      return <>
        <section className="yhae-hero yhae-roadmap-ai-pending">
          <div>
            <div className="yhae-kicker">Roadmap Builder</div>
            <h1>Your Roadmap is being built</h1>
            <h2>Your setup has been submitted.</h2>
            <p>{view.message}</p>
          </div>
          <aside>
            <img src="/images/logo.avif" alt=""/>
            <strong>Generating</strong>
            <span>Attempt {view.attempt}</span>
          </aside>
        </section>
        <section className="yhae-panel yhae-ai-status-panel">
          <div className="yhae-kicker">Roadmap Generation Status</div>
          <h2>Personalized Roadmap in progress</h2>
          <p>The Academy planner is transforming your answers into a 28-day execution path. Keep this page open, or refresh status after a few seconds.</p>
          <div className="yhae-form-actions">
            <button type="button" className="yhae-small-btn"
              onClick={actions.refreshRoadmap}>Refresh Status</button>
            <button type="button" className="yhae-small-btn yhae-ghost-action"
              onClick={actions.resetRoadmapIntake}>Restart Form</button>
          </div>
        </section>
      </>

    case 'intake':
      return <Intake actions={actions} busy={busy}/>
    case 'roadmap':
      return <Roadmap view={view} actions={actions}/>
    case 'missions':
      return <Missions view={view} actions={actions}/>
    case 'error':
      return <section className="yhae-panel yhae-locked">
        <div className="yhae-kicker">Academy Embed Error</div>
        <h1>Unable to load section.</h1>
        <p>{view.message}</p>
      </section>
    default:
      return null
  }
}
