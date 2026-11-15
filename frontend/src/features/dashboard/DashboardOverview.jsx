import DashboardSquad from './DashboardSquad'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getCachedDivisionAccessState,
  verifyDivisionAccess,
} from './dashboardAccess'
import DashboardUniverseSearch from './DashboardUniverseSearch'
import DashboardNotifications from './DashboardNotifications'
import { createPortal } from 'react-dom'
import { apiFetch } from '../../services/api/apiClient'

// YHU_D03_LEADERBOARD_PARITY_SINGLE_OWNER
function safeLeaderboardName(entry = {}) {
  const invalid = new Set([
    '', 'academy member', 'yh member',
    'hustler', 'member', 'user'
  ])
  const displayName = String(
    entry.displayName || entry.display_name || ''
  ).trim()
  const username = String(entry.username || '')
    .trim().replace(/^@+/, '')

  if (displayName && !displayName.includes('@') &&
      !invalid.has(displayName.toLowerCase())) return displayName

  if (username && !username.includes('@') &&
      !invalid.has(username.toLowerCase())) return username

  return 'YH Member'
}

function normalizeOverviewStatus(state = {}) {
  if (state.approved) return 'Approved'
  if (state.pending) return 'Pending'
  if (state.rejected) return 'Rejected'
  return 'Not Applied'
}

function getActionLabel(state = {}) {
  if (state.approved) return 'Enter'
  if (state.pending) return 'Pending'
  if (state.rejected) return 'Contact Admin'
  return 'Apply'
}

function readJson(key, fallback = {}) {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) || 'null',
    )

    return value &&
      typeof value === 'object' &&
      !Array.isArray(value)
      ? value
      : fallback
  } catch {
    return fallback
  }
}

function decodeJwtPayload(token = '') {
  const cleanToken = String(token || '').trim()
  const parts = cleanToken.split('.')

  if (parts.length < 2) return {}

  try {
    const base64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const padded = base64.padEnd(
      base64.length +
        ((4 - (base64.length % 4)) % 4),
      '=',
    )

    return JSON.parse(
      decodeURIComponent(
        Array.from(atob(padded))
          .map(
            (char) =>
              `%${char
                .charCodeAt(0)
                .toString(16)
                .padStart(2, '0')}`,
          )
          .join(''),
      ),
    )
  } catch {
    return {}
  }
}

function readStoredObject(key) {
  for (const store of [
    sessionStorage,
    localStorage,
  ]) {
    try {
      const raw = store.getItem(key)
      if (!raw) continue

      const value = JSON.parse(raw)

      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        return value
      }
    } catch { /* Noncritical browser storage or optional operation. */ }
  }

  return null
}

function getDashboardIdentity() {
  const token =
    sessionStorage.getItem('yh_token') ||
    localStorage.getItem('yh_token') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('token') ||
    ''

  const tokenPayload =
    decodeJwtPayload(token)

  const storedProfiles = [
    readStoredObject('yh_current_user'),
    readStoredObject('yh_user'),
    readStoredObject('currentUser'),
    readStoredObject('user'),
  ].filter(Boolean)

  const nestedProfiles =
    storedProfiles
      .map((item) =>
        item?.user &&
        typeof item.user === 'object'
          ? item.user
          : null,
      )
      .filter(Boolean)

  const profileCache =
    readJson(
      'yh_academy_profile_cache_v1',
      {},
    )

  const sources = [
    profileCache,
    ...storedProfiles,
    ...nestedProfiles,
    tokenPayload,
    tokenPayload?.user,
  ].filter(Boolean)

  const pick = (...keys) => {
    for (const source of sources) {
      for (const key of keys) {
        const value = String(
          source?.[key] || '',
        ).trim()

        if (value) return value
      }
    }

    return ''
  }

  const storedName =
    localStorage.getItem(
      'yh_user_full_name',
    ) ||
    localStorage.getItem(
      'yh_user_display_name',
    ) ||
    localStorage.getItem(
      'yh_user_name',
    ) ||
    sessionStorage.getItem(
      'yh_user_name',
    ) ||
    ''

  const displayName =
    pick(
      'display_name',
      'displayName',
      'fullName',
      'full_name',
      'name',
    ) ||
    String(storedName || '').trim() ||
    'Hustler'

  const username =
    pick(
      'username',
      'userName',
      'handle',
    ) ||
    localStorage.getItem(
      'yh_user_username',
    ) ||
    sessionStorage.getItem(
      'yh_user_username',
    ) ||
    ''

  const avatar = profileCache?.profile_avatar_removed === true
    ? ''
    : pick(
        'avatar',
        'avatarUrl',
        'avatar_url',
        'photoURL',
        'profilePhoto',
        'profile_picture',
      ) ||
      localStorage.getItem('yh_user_avatar') ||
      ''

  return {
    displayName,
    username: String(username)
      .replace(/^@+/, '')
      .trim(),
    avatar,
  }
}

export function DashboardTopStrip({
  onProfileOpen,
  onNotificationTarget,
  onToast
}) {
  const [identity, setIdentity] = useState(getDashboardIdentity)

  useEffect(() => {
    const synchronize = () => setIdentity(getDashboardIdentity())

    window.addEventListener('yh:profile-updated', synchronize)
    window.addEventListener('storage', synchronize)

    return () => {
      window.removeEventListener('yh:profile-updated', synchronize)
      window.removeEventListener('storage', synchronize)
    }
  }, [])

  return (
    <div className="yhu-header-actions">
      <DashboardUniverseSearch
        onProfileOpen={onProfileOpen}
      />

      <DashboardNotifications
        onTargetOpen={onNotificationTarget}
        onToast={onToast}
      />

      <button
        type="button"
        className="yhu-header-profile"
        onClick={() => onProfileOpen?.('')}
        aria-label="Open profile"
      >
        {identity.avatar
          ? <img src={identity.avatar} alt="" />
          : identity.displayName.charAt(0).toUpperCase()}
      </button>
    </div>
  )
}

const GAME_IMAGES = ["/images/YHA/photo_2026-04-23_11-11-56.webp","/images/YHA/photo_2026-04-23_11-11-55.webp","/images/YHA/photo_2026-04-23_11-11-55%20%282%29.webp","/images/YHA/photo_2026-04-23_11-11-54.webp","/images/YHA/photo_2026-04-23_11-11-50.webp","/images/YHA/photo_2026-04-23_11-11-52%20%282%29.webp","/images/YHA/photo_2026-04-23_11-11-50%20%282%29.webp","/images/YHA/photo_2026-04-23_11-11-49.webp","/images/YHA/photo_2026-04-23_11-11-48.webp","/images/YHA/photo_2026-04-23_11-11-48%20%282%29.webp","/images/YHA/photo_2026-04-23_11-11-47.webp","/images/YHA/photo_2026-04-23_11-11-46.webp","/images/YHA/photo_2026-04-23_11-11-45.webp","/images/YHA/photo_2026-04-23_11-11-44.webp","/images/YHA/photo_2026-04-23_11-11-43.webp","/images/YHA/photo_2026-04-23_11-11-42.webp"]


const GAME_DIVISIONS = [
  { id: 'academy', access: 'academy', title: 'Academy', mode: 'Solo',
    kicker: 'Solo Progression', icon: '✦', workspace: 'academy-roadmap' },
  { id: 'plaza', access: 'plazas', title: 'Plazas', mode: 'Open World',
    kicker: 'Open World', icon: '◎', workspace: 'plazas-explorer' },
  { id: 'federation', access: 'federation', title: 'Federation', mode: 'Strategic',
    kicker: 'Strategic Endgame', icon: '⬡', workspace: 'federation-command' }
]

function clampGameScore(value) {
  return Math.max(0, Math.min(100, Number(value) || 0))
}

function gameNumber(value) {
  return Math.max(0, Number(value) || 0)
}

function gameStorage(key) {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const value = JSON.parse(store.getItem(key) || 'null')
      if (value && typeof value === 'object') return value
    } catch {
      // Browser storage is optional.
    }
  }
  return null
}

function getAcademyGameSnapshot(payload, approved) {
  const source = payload?.progression || payload
  const persistent =
    source &&
    typeof source === 'object' &&
    Number.isFinite(Number(source.totalXp))

  if (persistent) {
    const total = gameNumber(source.totalXp)
    const weekly = gameNumber(source.weeklyXp)

    return {
      division: 'academy',
      approved,
      persistent: true,
      score: clampGameScore(source.rankProgress),
      rank: String(source.rank || 'Initiate'),
      level: Math.max(1, Number(source.level) || 1),
      total,
      weekly,
      label: total.toLocaleString() + ' total XP • ' +
        weekly.toLocaleString() + ' XP this week',
      next: source.nextRank && source.nextRank !== 'Max Rank'
        ? 'Reach ' + source.nextRank
        : 'Maintain Academy Elite status'
    }
  }

  const home = gameStorage('yh_academy_home') || {}
  const readiness = home.plazaReadiness || {}
  const values = [
    readiness.score,
    home.academyScore,
    readiness.scoreBreakdown?.overallScore,
    readiness.missionExecutionScore,
    readiness.scoreBreakdown?.missionExecutionScore
  ]
  const verified = values.find(
    value => value !== null && value !== undefined &&
      value !== '' && Number.isFinite(Number(value))
  )
  const score = clampGameScore(verified ?? 0)

  const rank = verified === undefined ? 'Loading Progress'
    : score >= 90 ? 'Master Builder'
    : score >= 75 ? 'Elite Builder'
    : score >= 55 ? 'Mission Operator'
    : score >= 30 ? 'Builder'
    : score >= 10 ? 'Apprentice' : 'Initiate'

  return {
    division: 'academy',
    approved,
    persistent: false,
    score,
    rank,
    label: verified !== undefined
      ? 'Loading persistent Academy XP'
      : approved ? 'Syncing Academy progression' : 'Academy access not active',
    next: approved ? 'Loading your verified progression'
      : 'Activate Academy access'
  }
}

function getPlazaGameSnapshot(payload, approved) {
  const profile = payload?.profile || payload?.reputation || {}
  const loaded = Boolean(payload && (
    payload.loaded === true ||
    payload.success === true ||
    profile.userId || profile.source || payload.fetchedAt
  ))

  const total = gameNumber(profile.totalReputation)
  const weekly = gameNumber(profile.weeklyReputation)

  return {
    division: 'plaza', approved, persistent: loaded,
    total, weekly,
    score: loaded ? clampGameScore(total) : 0,
    rank: loaded
      ? total >= 100 ? 'World Builder'
        : total >= 50 ? 'Regional Operator'
        : total >= 20 ? 'Connector'
        : total >= 5 ? 'Explorer' : 'Newcomer'
      : approved ? 'Syncing Ledger' : 'Awaiting Signal',
    label: loaded ? total.toLocaleString() + ' canonical Reputation'
      : approved ? 'Syncing canonical Plaza Reputation'
      : 'Build your opportunity signal',
    next: !approved ? 'Activate Plaza access'
      : !loaded ? 'Sync your canonical Reputation ledger'
      : total < 5 ? 'Earn your first verified Opportunity approval'
      : total < 20 ? 'Build toward Connector rank'
      : total < 50 ? 'Build toward Regional Operator rank'
      : total < 100 ? 'Build toward World Builder rank'
      : 'Expand your verified Plaza impact',
    events: gameNumber(profile.eventCount ?? payload?.eventCount)
  }
}

function getFederationGameSnapshot(payload, approved) {
  const profile = payload?.profile || payload?.influence || {}
  const loaded = Boolean(payload && (
    payload.loaded === true ||
    payload.success === true ||
    profile.userId || profile.source || payload.fetchedAt
  ))

  const total = gameNumber(profile.totalInfluence)
  const weekly = gameNumber(profile.weeklyInfluence)

  const ranks = [
    [250, 250, 'Federation Commander', 'Max Rank'],
    [100, 250, 'Regional Leader', 'Federation Commander'],
    [50, 100, 'Council Member', 'Regional Leader'],
    [20, 50, 'Strategist', 'Council Member'],
    [5, 20, 'Representative', 'Strategist'],
    [0, 5, 'Delegate', 'Representative']
  ]

  const [minimum, nextAt, rank, nextRank] =
    ranks.find(item => total >= item[0])

  return {
    division: 'federation', approved, persistent: loaded,
    total, weekly,
    score: loaded
      ? nextAt === minimum ? 100
        : clampGameScore((total - minimum) * 100 / (nextAt - minimum))
      : 0,
    rank: !approved ? 'Observer'
      : loaded ? rank : 'Syncing Ledger',
    label: loaded ? total.toLocaleString() + ' canonical Influence'
      : approved ? 'Syncing canonical Federation Influence'
      : 'Build strategic readiness',
    next: !approved ? 'Activate Federation access'
      : !loaded ? 'Sync your canonical Influence ledger'
      : nextRank === 'Max Rank'
        ? 'Expand verified Federation impact'
        : 'Reach ' + nextRank + ' at ' +
          nextAt.toLocaleString() + ' Influence',
    events: gameNumber(profile.eventCount ?? payload?.eventCount)
  }
}

function GameProgress({ value }) {
  return (
    <div className="yh-game-progress-track" aria-hidden="true">
      <span className="yh-game-progress-fill"
        style={{ width: clampGameScore(value) + '%' }} />
    </div>
  )
}

function GameStatPreview({ division, data, progression }) {
  if (division === 'academy') {
    const solo = progression?.soloMode
    const questState = progression?.questAchievementState ||
      (progression?.quests && progression?.achievements
        ? progression : null)

    return (
      <>
        <div className="yh-game-solo-preview-v1">
          <div className="yh-game-solo-preview-head-v1">
            <div><small>Solo Campaign</small>
              <strong>{solo?.campaign?.goal || 'Personal Roadmap'}</strong>
            </div>
            <span>{Math.round(gameNumber(solo?.campaign?.percentage))}%</span>
          </div>
          <div className="yh-game-solo-preview-track-v1">
            <span style={{
              width: clampGameScore(solo?.campaign?.percentage) + '%'
            }} />
          </div>
          <div className="yh-game-solo-preview-stats-v1">
            <span><b>{gameNumber(solo?.campaign?.completed)}/
              {gameNumber(solo?.campaign?.total)}</b>Campaign</span>
            <span><b>{gameNumber(solo?.verifiedMissionCount)}</b>Verified</span>
            <span><b>{gameNumber(solo?.totalGrowthPoints)}</b>Growth</span>
          </div>
          <div className="yh-game-solo-preview-strongest-v1">
            <small>Strongest Growth</small>
            <strong>{solo?.strongestGrowthArea?.label || 'Not established'}</strong>
          </div>
        </div>

        <div className="yh-game-solo-preview-v1">
          <div className="yh-game-solo-preview-head-v1">
            <div><small>Quest Ledger</small>
              <strong>{questState?.persistent && questState?.serverBacked
                ? 'Persistent' : 'Server state pending'}</strong>
            </div>
            <span>{gameNumber(questState?.quests?.completedUnclaimed)}</span>
          </div>
          <div className="yh-game-solo-preview-stats-v1">
            <span><b>{gameNumber(questState?.quests?.completedUnclaimed)}</b>
              Ready</span>
            <span><b>{gameNumber(questState?.quests?.claimed)}</b>
              Claimed</span>
            <span><b>{gameNumber(questState?.achievements?.unlockedCount)}/
              {gameNumber(questState?.achievements?.totalAvailable)}</b>
              Achievements</span>
          </div>
        </div>
      </>
    )
  }

  const preview = gameStorage(division === 'plaza'
    ? 'yhPlazaExplorerPreviewV2'
    : 'yhFederationStrategicPreviewV1') || {}

  const plaza = division === 'plaza'

  const fields = plaza
    ? [
        ['Home Zone', preview.homeZone || 'Not established'],
        ['Available Quests', gameNumber(preview.availableQuests)],
        ['Visible Regions', gameNumber(preview.visibleRegions)],
        ['Total Reputation', data.total.toLocaleString()]
      ]
    : [
        ['Home Region', preview.homeRegion || 'Not established'],
        ['Active Operations', gameNumber(preview.activeOperations)],
        ['Strategic Alerts', gameNumber(preview.strategicAlerts)],
        ['Total Influence', data.total.toLocaleString()]
      ]

  return (
    <div className={plaza
      ? 'yh-game-plaza-open-world-preview-v1 yh-game-plaza-explorer-preview-v2'
      : 'yh-game-federation-strategic-preview-v1'}>
      <div className={plaza
        ? 'yh-game-plaza-explorer-head-v2'
        : 'yh-game-federation-strategic-head-v1'}>
        <div><small>{plaza ? 'Explorer Profile' : 'Strategic Profile'}</small>
          <strong>{data.rank}</strong>
        </div>
        <span>{data.persistent ? 'Live Ledger' : 'Syncing Ledger'}</span>
      </div>
      <div className={plaza
        ? 'yh-game-plaza-explorer-stats-v2'
        : 'yh-game-federation-strategic-stats-v1'}>
        {fields.map(([label, value]) => (
          <span key={label}><small>{label}</small><b>{value}</b></span>
        ))}
      </div>
      <div className={plaza
        ? 'yh-game-plaza-explorer-next-v2'
        : 'yh-game-federation-strategic-next-v1'}>
        <small>Current Next Move</small>
        <strong>{(plaza ? preview.activeQuest?.title
          : preview.activeOperation?.title) || data.next}</strong>
      </div>
      <p>{data.weekly.toLocaleString()} this week across
        {' '}{data.events.toLocaleString()} verified events.</p>
    </div>
  )
}

function GameDivisionCard({ config, data, access, payload, busy, onOpen }) {
  const persistent = data.persistent

  return (
    <article className="yh-game-division-card"
      data-yh-game-division={config.id}>
      <div className="yh-game-division-top">
        <span className="yh-game-division-icon" aria-hidden="true">
          {config.icon}
        </span>
        <div className="yh-game-division-heading">
          <small>{config.kicker}</small>
          <h3>{config.title}</h3>
        </div>
        <span className={'yh-game-access-state' +
          (access?.approved ? ' is-approved' : '')}>
          {access?.approved ? 'Active' : normalizeOverviewStatus(access)}
        </span>
      </div>

      <div className="yh-game-rank-row">
        <div><small>Current Rank</small><strong>{data.rank}</strong></div>
        <div className="yh-game-score">
          <small className="yh-game-score-label">
            {persistent
              ? config.id === 'academy' ? 'Rank Progress'
                : config.id === 'plaza' ? 'Total Reputation'
                : 'Total Influence'
              : 'Readiness Signal'}
          </small>
          <div><strong>{persistent && config.id !== 'academy'
            ? data.total.toLocaleString()
            : Math.round(data.score)}</strong>
            <span>{persistent && config.id !== 'academy'
              ? 'pts' : '/100'}</span>
          </div>
        </div>
      </div>

      <GameProgress value={data.score} />

      {config.id === 'academy' && persistent && (
        <div className="yh-game-academy-xp-strip">
          <span>Level {data.level}</span>
          <strong>{data.total.toLocaleString()} XP</strong>
          <span>{data.weekly.toLocaleString()} this week</span>
        </div>
      )}

      <GameStatPreview division={config.id} data={data} progression={payload} />

      <p className="yh-game-division-status">{data.label}</p>
      <div className="yh-game-next-objective">
        <small>Next objective</small><span>{data.next}</span>
      </div>

      <button type="button" className="yh-game-division-action"
        disabled={Boolean(busy) || access?.pending || access?.rejected}
        onClick={() => onOpen(config)}>
        {busy ? 'Checking...' : access?.approved
          ? config.id === 'academy' ? 'Enter Academy'
            : config.id === 'plaza' ? 'Enter Open World'
            : 'Open Strategic Command'
          : getActionLabel(access)}
      </button>
    </article>
  )
}

/* YHU_DASHBOARD_4B_DIRECT_CARD_ROUTING */
export default function DashboardOverview({
  onDivisionOpen,
  onToast
}) {
  const navigate = useNavigate()
  const [access, setAccess] = useState(() => ({
    academy: getCachedDivisionAccessState('academy'),
    plazas: getCachedDivisionAccessState('plazas'),
    federation: getCachedDivisionAccessState('federation')
  }))

  const [responses, setResponses] = useState(null)
  const [overviewLoaded, setOverviewLoaded] = useState(false)
  const [busy, setBusy] = useState('')
  const [carouselIndex, setCarouselIndex] = useState(0)
  const carouselRef = useRef(null)
  const [lightboxImage, setLightboxImage] = useState(null)

  // YHU_D02_IMAGE_LIGHTBOX_SINGLE_OWNER
  useEffect(() => {
    if (!lightboxImage) return undefined

    const onEscape = (event) => {
      if (event.key === 'Escape') setLightboxImage(null)
    }

    document.body.classList.add('yh-universe-image-lightbox-open')
    document.addEventListener('keydown', onEscape)

    return () => {
      document.body.classList.remove('yh-universe-image-lightbox-open')
      document.removeEventListener('keydown', onEscape)
    }
  }, [lightboxImage])

  const openImage = (src, alt) => {
    setLightboxImage({ src, alt })
  }

  const identity = getDashboardIdentity()

  useEffect(() => {
    let cancelled = false
    let requestSequence = 0

    async function load() {
      const requestId = ++requestSequence
      const divisions = ['academy', 'plazas', 'federation']
      const accessResults = await Promise.allSettled(
        divisions.map(division => verifyDivisionAccess(division))
      )

      if (cancelled || requestId !== requestSequence) return

      const nextAccess = Object.fromEntries(
        divisions.map((division, index) => [
          division,
          accessResults[index].status === 'fulfilled'
            ? accessResults[index].value
            : getCachedDivisionAccessState(division)
        ])
      )

      setAccess(nextAccess)

      const requests = [
        ['academy', 'academy', '/api/academy/progression'],
        ['plaza', 'plazas', '/api/plaza/reputation?limit=50'],
        ['federation', 'federation', '/api/federation/influence?limit=50'],
        ['leaderboard', 'academy',
          '/api/academy/leaderboard?period=weekly&limit=5'],
        ['squad', 'academy', '/api/academy/squad']
      ]

      const results = await Promise.allSettled(
        requests.map(([, division, url]) =>
          nextAccess[division]?.approved
            ? apiFetch(url, { method: 'GET', cache: 'no-store' })
            : Promise.resolve(null)
        )
      )

      if (cancelled || requestId !== requestSequence) return

      setResponses(Object.fromEntries(
        requests.map(([key], index) => [
          key,
          results[index].status === 'fulfilled'
            ? results[index].value
            : null
        ])
      ))
      setOverviewLoaded(true)
    }

    void load()

    window.addEventListener(
      'yh:dashboard-access-refreshed',
      load
    )

    return () => {
      cancelled = true
      window.removeEventListener(
        'yh:dashboard-access-refreshed',
        load
      )
    }
  }, [])

  const data = {
    academy: getAcademyGameSnapshot(
      responses?.academy,
      access.academy?.approved
    ),
    plaza: getPlazaGameSnapshot(
      responses?.plaza,
      access.plazas?.approved
    ),
    federation: getFederationGameSnapshot(
      responses?.federation,
      access.federation?.approved
    )
  }

  const average = Math.round((
    data.academy.score + data.plaza.score +
    data.federation.score
  ) / 3)

  const rank = average >= 90 ? 'Architect'
    : average >= 75 ? 'Strategist'
    : average >= 55 ? 'Connector'
    : average >= 35 ? 'Operator'
    : average >= 15 ? 'Builder' : 'Initiate'

  const level = Math.max(
    1, Math.min(50, Math.floor(average / 2) + 1)
  )

  const leaderboard = Array.isArray(responses?.leaderboard)
    ? responses.leaderboard
    : Array.isArray(responses?.leaderboard?.leaderboard)
      ? responses.leaderboard.leaderboard : []

  const leaderboardPayload = responses?.leaderboard || {}
  const freshness = String(
    leaderboardPayload?.freshness?.status || ''
  ).trim().toLowerCase()

  const freshnessLabel = freshness === 'fresh' ? 'Fresh'
    : freshness === 'mixed_aging' ? 'Some aging'
    : freshness === 'mixed_stale' ? 'Some stale'
    : 'Server ranked'

  const playerPosition =
    Number(leaderboardPayload.playerPosition) || 0

  async function openDivision(config) {
    if (busy) return
    setBusy(config.access)

    try {
      const state = await verifyDivisionAccess(config.access)
      setAccess(current => ({ ...current, [config.access]: state }))

      if (state?.approved) {
        const destination = {
          academy: '/academy',
          plazas: '/plaza',
          federation: '/federation'
        }[config.access]

        if (destination) {
          navigate(destination)
        }
      } else {
        onDivisionOpen?.(config.access, state)
      }
    } catch {
      onToast?.(
        'Unable to verify division access. Please try again.',
        'error'
      )
    } finally {
      setBusy('')
    }
  }

  function showCard(index) {
    const track = carouselRef.current
    const card = track?.children?.[index]
    if (!track || !card) return

    track.scrollTo({
      left: card.offsetLeft - track.offsetLeft,
      behavior: 'smooth'
    })
    setCarouselIndex(index)
  }

  return (
    <section className="yh-dashboard-react-overview"
      data-yh-dashboard-react-surface="overview">

      <section id="yh-game-foundation-v1" className="yh-game-foundation">
        <header className="yh-game-operator-panel">
          <div className="yh-game-operator-copy">
            <small className="yh-game-system-kicker">
              YHU Operator Progression
            </small>
            <h2>{identity.displayName}</h2>
            <p>Three separate progression paths. Build yourself in
              Academy, expand through the Plazas, and earn strategic
              influence inside the Federation.</p>
          </div>

          <div className="yh-game-operator-rank">
            <small>Global Operator Rank</small>
            <strong>{rank}</strong>
            <span>Level {level}</span>
          </div>

          <div className="yh-game-operator-progress">
            <div>
              <span>Current Readiness</span>
              <strong>{average}%</strong>
            </div>
            <GameProgress value={average} />
          </div>
        </header>

        <div className="yh-game-division-carousel"
          data-yh-game-division-carousel=""
          aria-label="Division progression carousel">
          <div className="yh-game-division-grid"
            data-yh-game-division-track=""
            ref={carouselRef}
            onScroll={event => {
              const track = event.currentTarget
              const cards = [...track.children]
              const index = cards.reduce((best, card, i) =>
                Math.abs(card.offsetLeft - track.offsetLeft -
                  track.scrollLeft) <
                Math.abs(cards[best].offsetLeft - track.offsetLeft -
                  track.scrollLeft) ? i : best, 0)
              setCarouselIndex(index)
            }}>
            {GAME_DIVISIONS.map(config => (
              <GameDivisionCard key={config.id}
                config={config}
                data={data[config.id]}
                access={access[config.access]}
                payload={responses?.[config.id]?.progression ||
                  responses?.[config.id]}
                busy={busy === config.access}
                onOpen={openDivision} />
            ))}
          </div>

          <div className="yh-game-division-indicators"
            role="group" aria-label="Division carousel position">
            {GAME_DIVISIONS.map((config, index) => (
              <button key={config.id} type="button"
                className={carouselIndex === index ? 'is-active' : ''}
                aria-label={'Show ' + config.title + ' card'}
                aria-current={carouselIndex === index ? 'true' : undefined}
                onClick={() => showCard(index)} />
            ))}
            <span className="yh-game-division-position"
              aria-live="polite">
              {GAME_DIVISIONS[carouselIndex].title} •
              {' '}{carouselIndex + 1} / 3
            </span>
          </div>
        </div>

        <div className="yh-game-meta-grid">
          <article className="yh-game-side-card yh-game-leaderboard-card">
            <div className="yh-game-side-card-head">
              <div>
                <small>{leaderboard.length
                  ? 'Academy Leaderboard' : 'Division Progress'}</small>
                <h3>{leaderboard.length
                  ? 'Weekly Top Members' : 'Your Current Readiness'}</h3>
              </div>
              <span className="yh-game-preview-badge">
                {leaderboard.length
                  ? (playerPosition
                      ? 'You: #' + playerPosition
                      : 'Weekly') + ' · ' + freshnessLabel
                  : 'Live Summary'}
              </span>
            </div>

            <div className="yh-game-leaderboard-list">
              {leaderboard.length
                ? leaderboard.slice(0, 5).map((entry, index) => (
                    <div className="yh-game-leaderboard-row"
                      key={entry.userId || entry.id || index}>
                      <span className="yh-game-leaderboard-position">
                        {Number(entry.position || 0)}
                      </span>
                      <div>
                        <strong>{safeLeaderboardName(entry)}</strong>
                        <small>{entry.rank || 'Initiate'}
                          {' • Level '}{entry.level || 1}
                          {entry.stale ? ' • Stale' : ''}</small>
                      </div>
                      <b>{gameNumber(entry.xp).toLocaleString()}
                        <small>XP</small></b>
                    </div>
                  ))
                : GAME_DIVISIONS.map(config => (
                    <div className="yh-game-leaderboard-row"
                      key={config.id}>
                      <span className="yh-game-division-summary-mark"
                        data-yh-summary-division={config.id}
                        aria-hidden="true" />
                      <div>
                        <strong>{config.title}</strong>
                        <small>{data[config.id].rank} • {config.mode}</small>
                      </div>
                      <b>{Math.round(data[config.id].score)}
                        <small>signal</small></b>
                    </div>
                  ))}
            </div>
            <p className="yh-game-preview-note">
              {leaderboard.length
                ? 'Weekly ranking is based on verified Academy mission, check-in, streak, and completion events.'
                : overviewLoaded
                  ? 'No weekly Academy rankings are currently available.'
                  : 'Loading verified Academy progression and rankings.'}
            </p>
          </article>

          <DashboardSquad
            access={access.academy}
            squadPayload={responses?.squad}
            onSquadChange={payload =>
              setResponses(current => ({
                ...(current || {}),
                squad: payload
              }))
            }
          />
        </div>
      </section>

      <section id="yh-universe-academy-strip"
        className="yh-universe-academy-strip is-active"
        aria-label="Live Universe Activity">
        <div className="yh-lower-premium-decor" aria-hidden="true">
          <span className="yh-lower-premium-orbit" />
          <span className="yh-lower-premium-meteor" />
          <span className="yh-lower-premium-depth yh-lower-premium-depth-a" />
          <span className="yh-lower-premium-depth yh-lower-premium-depth-b" />
        </div>
        <div className="yh-universe-academy-strip-head">
          <div className="yh-universe-academy-strip-kicker">
            Live Universe Activity
          </div>
        </div>
        <div className="yh-universe-academy-marquee">
          <div className="yh-universe-academy-marquee-track">
            {[0, 1].map(group => (
              <div key={group}
                className="yh-universe-academy-marquee-group"
                aria-hidden={group === 1}>
                {GAME_IMAGES.map((src, index) => (
                  <article key={src}
                    className="yh-universe-academy-marquee-card"
                    role="button"
                    tabIndex={group === 0 ? 0 : -1}
                    aria-label={'Open image: Academy visual ' + (index + 1)}
                    onClick={() => openImage(
                      src, group ? '' : 'Academy visual ' + (index + 1)
                    )}
                    onKeyDown={event => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      openImage(
                        src, group ? '' : 'Academy visual ' + (index + 1)
                      )
                    }}>
                    <img src={src}
                      alt={group ? '' : 'Academy visual ' + (index + 1)}
                      loading="lazy" decoding="async" />
                  </article>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
      {lightboxImage && createPortal(
        <div
          id="yh-universe-image-lightbox"
          className="modal-overlay yh-universe-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yh-universe-image-lightbox-title"
          onClick={event => {
            if (event.target === event.currentTarget) {
              setLightboxImage(null)
            }
          }}
        >
          <div className="modal-content yh-universe-image-lightbox-dialog">
            <button
              type="button"
              id="yh-universe-image-lightbox-close"
              className="yh-universe-image-lightbox-close"
              aria-label="Close full image"
              onClick={() => setLightboxImage(null)}
            >
              ✕
            </button>
            <div className="yh-universe-image-lightbox-media-wrap">
              <img
                id="yh-universe-image-lightbox-img"
                className="yh-universe-image-lightbox-img"
                src={lightboxImage.src}
                alt={lightboxImage.alt || 'Full image preview'}
                loading="eager"
                decoding="async"
              />
            </div>
            <div
              id="yh-universe-image-lightbox-title"
              className="yh-universe-image-lightbox-caption"
            >
              {lightboxImage.alt}
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  )
}
