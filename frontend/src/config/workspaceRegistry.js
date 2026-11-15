export const WORKSPACES = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
  },

  academy: {
    id: 'academy',
    label: 'Academy',
    defaultSection: 'roadmap',
    sections: {
      roadmap: {
        id: 'roadmap',
        label: 'Roadmap',
      },
      missions: {
        id: 'missions',
        label: 'Missions',
      },
      community: {
        id: 'community',
        label: 'Community',
      },
      messages: {
        id: 'messages',
        label: 'Messages',
      },
      voice: {
        id: 'voice',
        label: 'Voice',
      },
      video: {
        id: 'video',
        label: 'Video',
      },
      announcements: {
        id: 'announcements',
        label: 'Announcements',
      },
      profile: {
        id: 'profile',
        label: 'Profile',
      },
    },
  },

  plaza: {
    id: 'plaza',
    label: 'Plaza',
    defaultSection: 'explorer',
    sections: {
      explorer: {
        id: 'explorer',
        label: 'Explorer',
      },
      feed: {
        id: 'feed',
        label: 'Feed',
      },
      inbox: {
        id: 'inbox',
        label: 'Inbox',
      },
      notifications: {
        id: 'notifications',
        label: 'Notifications',
      },
      conversations: {
        id: 'conversations',
        label: 'Conversations',
      },
      meetups: {
        id: 'meetups',
        label: 'Meetups',
      },
      opportunities: {
        id: 'opportunities',
        label: 'Opportunities',
      },
      directory: {
        id: 'directory',
        label: 'Directory',
      },
      regions: {
        id: 'regions',
        label: 'Regions',
      },
      atlas: {
        id: 'atlas',
        label: 'Atlas',
      },
      patron: {
        id: 'patron',
        label: 'Become Patron',
      },
      patronDesk: {
        id: 'patron-desk',
        label: 'Patron Desk',
      },
      bridge: {
        id: 'bridge',
        label: 'Bridge',
      },
      requests: {
        id: 'requests',
        label: 'Requests',
      },
    },
  },

  federation: {
    id: 'federation',
    label: 'Federation',
    defaultSection: 'command',
    sections: {
      command: {
        id: 'command',
        label: 'Command',
      },
      connect: {
        id: 'connect',
        label: 'Connect',
      },
      dealRooms: {
        id: 'deal-rooms',
        label: 'Deal Rooms',
      },
      directory: {
        id: 'directory',
        label: 'Directory',
      },
      requests: {
        id: 'requests',
        label: 'Requests',
      },
      referrals: {
        id: 'referrals',
        label: 'Referrals',
      },
      access: {
        id: 'access',
        label: 'Access',
      },
    },
  },

  'business-chats': {
    id: 'business-chats',
    label: 'Business Chats',
  },

  messages: {
    id: 'messages',
    label: 'Messages',
  },

  profile: {
    id: 'profile',
    label: 'Profile',
  },

  wallet: {
    id: 'wallet',
    label: 'Wallet',
  },

  settings: {
    id: 'settings',
    label: 'Settings',
  },
}

export function getWorkspace(workspaceId) {
  return WORKSPACES[workspaceId] ?? null
}

export function getWorkspaceSection(workspaceId, sectionId) {
  const workspace = getWorkspace(workspaceId)

  if (!workspace?.sections) {
    return null
  }

  return (
    Object.values(workspace.sections).find(
      (section) => section.id === sectionId,
    ) ?? null
  )
}
