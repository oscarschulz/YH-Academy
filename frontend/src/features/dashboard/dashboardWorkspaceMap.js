export const DASHBOARD_WORKSPACES = {
  academy: {
    division: 'academy',
  },

  'academy-roadmap': {
    division: 'academy',
  },

  'academy-missions': {
    division: 'academy',
  },

  'academy-community': {
    division: 'academy',
  },

  'academy-messages': {
    division: 'academy',
  },

  'academy-voice': {
    division: 'academy',
  },

  'academy-video': {
    division: 'academy',
  },

  'academy-announcements': {
    division: 'academy',
  },

  'academy-profile': {
    division: 'academy',
  },

  plazas: {
    division: 'plazas',
  },

  'plazas-explorer': {
    division: 'plazas',
  },

  'plazas-feed': {
    division: 'plazas',
  },

  'plazas-inbox': {
    division: 'plazas',
  },

  'plazas-notifications': {
    division: 'plazas',
  },

  'plazas-conversations': {
    division: 'plazas',
  },

  'plazas-meetups': {
    division: 'plazas',
  },

  'plazas-opportunities': {
    division: 'plazas',
  },

  'plazas-directory': {
    division: 'plazas',
  },

  'plazas-regions': {
    division: 'plazas',
  },

  'plazas-atlas': {
    division: 'plazas',
  },

  'plazas-patron': {
    division: 'plazas',
  },

  'plazas-patron-desk': {
    division: 'plazas',
  },

  'plazas-bridge': {
    division: 'plazas',
  },

  'plazas-requests': {
    division: 'plazas',
  },

  federation: {
    division: 'federation',
  },

  'federation-command': {
    division: 'federation',
  },

  'federation-connect': {
    division: 'federation',
  },

  'federation-deal-rooms': {
    division: 'federation',
  },

  'federation-directory': {
    division: 'federation',
  },

  'federation-requests': {
    division: 'federation',
  },

  'federation-referrals': {
    division: 'federation',
  },

  'federation-access': {
    division: 'federation',
  },

  'business-chats': {
    division: 'resources',
  },
}

export function getDashboardWorkspace(key) {
  return DASHBOARD_WORKSPACES[key] ?? null
}
