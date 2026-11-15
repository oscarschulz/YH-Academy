import {
  WORKSPACES,
  getWorkspace,
  getWorkspaceSection,
} from '../config/workspaceRegistry'

const WORKSPACE_REACT_PATHS = {
  dashboard: '/dashboard',
  messages: '/messages',
  academy: '/academy',
  plaza: '/plaza',
  federation: '/federation',
  'business-chats': '/business-chats',
  profile: '/profile',
  wallet: '/wallet',
  settings: '/settings',
}

export function getWorkspacePath(workspaceId, sectionId = null) {
  const workspace = getWorkspace(workspaceId)

  if (!workspace) {
    return '/dashboard'
  }

  const basePath = WORKSPACE_REACT_PATHS[workspace.id]

  if (!basePath) {
    return '/dashboard'
  }

  if (!sectionId || !workspace.sections) {
    return basePath
  }

  const section = getWorkspaceSection(workspace.id, sectionId)

  if (!section) {
    return basePath
  }

  return `${basePath}/${section.id}`
}

export function getDefaultWorkspacePath(workspaceId) {
  const workspace = getWorkspace(workspaceId)

  if (!workspace) {
    return '/dashboard'
  }

  if (workspace.defaultSection) {
    return getWorkspacePath(workspace.id, workspace.defaultSection)
  }

  return getWorkspacePath(workspace.id)
}


export function isKnownWorkspace(workspaceId) {
  return Boolean(WORKSPACES[workspaceId])
}
