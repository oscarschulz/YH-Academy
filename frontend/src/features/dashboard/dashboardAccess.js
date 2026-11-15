import { apiFetch } from '../../services/api/apiClient'

export const DASHBOARD_ACCESS_CACHE_KEYS = {
  academy: 'yh_academy_membership_status_v1',
  plazas: 'yh_plaza_access_status_v1',
  federation: 'yh_federation_access_status_v1',
}

const ACADEMY_PENDING_STATUSES = new Set([
  'new',
  'pending',
  'pending review',
  'under review',
  'review',
  'screening',
  'shortlisted',
  'waitlisted',
])

export function normalizeAccessStatus(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
}

function readCache(key, fallback = {}) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}')

    return parsed && typeof parsed === 'object'
      ? parsed
      : fallback
  } catch {
    return fallback
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Cache failure must never block access verification.
  }

  return value
}

export function getCachedAcademyAccess() {
  return readCache(DASHBOARD_ACCESS_CACHE_KEYS.academy, {})
}

export function getCachedPlazaAccess() {
  return readCache(DASHBOARD_ACCESS_CACHE_KEYS.plazas, {
    hasApplication: false,
    canEnterPlaza: false,
    applicationStatus: '',
    application: null,
    divisionOverride: null,
    member: null,
  })
}

export function getCachedFederationAccess() {
  return readCache(DASHBOARD_ACCESS_CACHE_KEYS.federation, {
    hasApplication: false,
    canEnterFederation: false,
    applicationStatus: '',
    application: null,
    divisionOverride: null,
    member: null,
  })
}

export function isAcademyApproved(snapshot = {}) {
  const status = normalizeAccessStatus(snapshot?.applicationStatus)

  return (
    snapshot?.canEnterAcademy === true ||
    status === 'approved'
  )
}

export function isPlazaApproved(snapshot = {}) {
  const status = normalizeAccessStatus(snapshot?.applicationStatus)

  return (
    snapshot?.canEnterPlaza === true ||
    status === 'approved'
  )
}

export function isFederationApproved(snapshot = {}) {
  const status = normalizeAccessStatus(snapshot?.applicationStatus)

  return (
    snapshot?.canEnterFederation === true ||
    status === 'approved'
  )
}

export async function fetchAcademyAccess() {
  const result = await apiFetch('/api/academy/membership-status', {
    method: 'GET',
  })

  const application =
    result?.application &&
    typeof result.application === 'object'
      ? result.application
      : null

  const hasApplication =
    result?.hasApplication === true ||
    Boolean(application)

  const reportedStatus = normalizeAccessStatus(
    result?.applicationStatus || application?.status,
  )

  // A successful backend response overrides stale local markers.
  const applicationStatus = hasApplication
    ? (reportedStatus && reportedStatus !== 'none'
        ? reportedStatus
        : 'under review')
    : ''

  const snapshot = {
    hasApplication,

    applicationStatus,

    hasRoadmapAccess:
      result?.hasRoadmapAccess === true,

    canEnterAcademy:
      result?.canEnterAcademy === true,

    application,

    roadmapApplication:
      result?.roadmapApplication &&
      typeof result.roadmapApplication === 'object'
        ? result.roadmapApplication
        : null,

    roadmapApplicationStatus:
      normalizeAccessStatus(
        result?.roadmapApplicationStatus,
      ),
  }

  return writeCache(
    DASHBOARD_ACCESS_CACHE_KEYS.academy,
    snapshot,
  )
}

export async function fetchPlazaAccess() {
  const result = await apiFetch('/api/plaza/application-status', {
    method: 'GET',
  })

  const application =
    result?.application &&
    typeof result.application === 'object'
      ? result.application
      : null

  const snapshot = {
    hasApplication:
      result?.hasApplication === true ||
      Boolean(application),

    canEnterPlaza:
      result?.canEnterPlaza === true,

    applicationStatus: normalizeAccessStatus(
      result?.applicationStatus ||
      application?.status,
    ),

    application,

    divisionOverride:
      result?.divisionOverride ||
      application?.divisionOverride ||
      null,

    member:
      result?.member || null,

    cachedAt:
      new Date().toISOString(),
  }

  return writeCache(
    DASHBOARD_ACCESS_CACHE_KEYS.plazas,
    snapshot,
  )
}

export async function fetchFederationAccess() {
  const result = await apiFetch('/api/federation/application-status', {
    method: 'GET',
  })

  const application =
    result?.application &&
    typeof result.application === 'object'
      ? result.application
      : null

  const snapshot = {
    hasApplication:
      result?.hasApplication === true ||
      Boolean(application),

    canEnterFederation:
      result?.canEnterFederation === true,

    applicationStatus: normalizeAccessStatus(
      result?.applicationStatus ||
      application?.status,
    ),

    application,

    divisionOverride:
      result?.divisionOverride ||
      application?.divisionOverride ||
      null,

    member:
      result?.member || null,
  }

  return writeCache(
    DASHBOARD_ACCESS_CACHE_KEYS.federation,
    snapshot,
  )
}

function buildAcademyState(snapshot = {}) {
  const status =
    normalizeAccessStatus(
      snapshot?.applicationStatus,
    )

  const approved =
    isAcademyApproved(
      snapshot,
    )

  const rejected =
    status === 'rejected'

  const hasApplication =
    snapshot?.hasApplication === true ||
    Boolean(snapshot?.application)

  const pending =
    hasApplication &&
    !approved &&
    ACADEMY_PENDING_STATUSES.has(status)

  return {
    division: 'academy',
    snapshot,
    status:
      status ||
      (
        pending
          ? 'under review'
          : ''
      ),
    approved,
    pending,
    rejected,
    hasApplication,
  }
}

function buildPlazaState(snapshot = {}) {
  const status = normalizeAccessStatus(
    snapshot?.applicationStatus,
  )

  const approved = isPlazaApproved(snapshot)

  return {
    division: 'plazas',
    snapshot,
    status,
    approved,
    pending:
      snapshot?.hasApplication === true &&
      !approved &&
      ACADEMY_PENDING_STATUSES.has(status),
    rejected: status === 'rejected',
    hasApplication:
      snapshot?.hasApplication === true,
  }
}

function buildFederationState(snapshot = {}) {
  const status = normalizeAccessStatus(
    snapshot?.applicationStatus,
  )

  const approved = isFederationApproved(snapshot)

  return {
    division: 'federation',
    snapshot,
    status,
    approved,
    pending:
      snapshot?.hasApplication === true &&
      !approved &&
      ACADEMY_PENDING_STATUSES.has(status),
    rejected: status === 'rejected',
    hasApplication:
      snapshot?.hasApplication === true,
  }
}

export function getCachedDivisionAccessState(division) {
  if (division === 'academy') {
    return buildAcademyState(
      getCachedAcademyAccess(),
    )
  }

  if (division === 'plazas') {
    return buildPlazaState(
      getCachedPlazaAccess(),
    )
  }

  if (division === 'federation') {
    return buildFederationState(
      getCachedFederationAccess(),
    )
  }

  return {
    division,
    snapshot: {},
    status: '',
    approved: false,
    pending: false,
    rejected: false,
    hasApplication: false,
  }
}

export async function verifyDivisionAccess(division) {
  let fetchTask

  if (division === 'academy') {
    fetchTask = fetchAcademyAccess
  } else if (division === 'plazas') {
    fetchTask = fetchPlazaAccess
  } else if (division === 'federation') {
    fetchTask = fetchFederationAccess
  } else {
    return getCachedDivisionAccessState(division)
  }

  const snapshot = await fetchTask()

  if (division === 'academy') {
    return buildAcademyState(snapshot)
  }

  if (division === 'plazas') {
    return buildPlazaState(snapshot)
  }

  return buildFederationState(snapshot)
}
