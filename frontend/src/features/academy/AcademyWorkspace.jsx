import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AcademyRoadmapWorkspace from './AcademyRoadmapWorkspace'
import AcademyMissionsWorkspace from './AcademyMissionsWorkspace'
import AcademyCommunityWorkspace from './AcademyCommunityWorkspace'
import AcademyMessagesWorkspace from './AcademyMessagesWorkspace'
import AcademyVoiceWorkspace from './AcademyVoiceWorkspace'
import AcademyVideoWorkspace from './AcademyVideoWorkspace'
import AcademyAnnouncementsWorkspace from './AcademyAnnouncementsWorkspace'
import ProfileWorkspace from '../profile/ProfileWorkspace'
export default function AcademyWorkspace({
  workspaceKey = 'academy',
  profileMemberId = '',
  onToast,
  onProfileOpen,
  onWorkspaceOpen,
}) {
  const location = useLocation()

  useEffect(() => {
    if (workspaceKey !== 'academy-community') {
      return undefined
    }

    const postId = new URLSearchParams(
      location.search,
    ).get('postId')?.trim()

    if (!postId) return undefined

    let completed = false

    const findAndFocus = () => {
      if (completed) return

      const cards = document.querySelectorAll(
        '.academy-feed-card[data-post-id], article[data-post-id], [data-yhu-feed-post-id]',
      )

      const target = Array.from(cards).find(node =>
        String(
          node.getAttribute('data-post-id') ||
          node.getAttribute('data-yhu-feed-post-id') ||
          '',
        ).trim() === postId,
      )

      if (!target) return

      completed = true

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }

    findAndFocus()

    if (completed) return undefined

    const observer = new MutationObserver(findAndFocus)

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    const timeout = window.setTimeout(
      () => observer.disconnect(),
      12000,
    )

    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
    }
  }, [workspaceKey, location.search])

if (
    workspaceKey === 'academy' ||
    workspaceKey === 'academy-roadmap'
  ) {
    return (
      <AcademyRoadmapWorkspace
        onToast={onToast}
        onWorkspaceOpen={onWorkspaceOpen}
      />
    )
  }

  if (
    workspaceKey === 'academy-missions'
  ) {
    return (
      <AcademyMissionsWorkspace
        onToast={onToast}
      />
    )
  }

  if (
    workspaceKey === 'academy-community'
  ) {
    return (
      <AcademyCommunityWorkspace
        onToast={onToast}

        onProfileOpen={onProfileOpen}
      />
    )
  }

  if (
    workspaceKey === 'academy-messages'
  ) {
    return (
      <AcademyMessagesWorkspace
        onToast={onToast}
      />
    )
  }

  if (
    workspaceKey === 'academy-voice'
  ) {
    return (
      <AcademyVoiceWorkspace
        onToast={onToast}
      />
    )
  }

  if (
    workspaceKey === 'academy-video'
  ) {
    return (
      <AcademyVideoWorkspace
        onToast={onToast}
      />
    )
  }

  if (
    workspaceKey ===
    'academy-announcements'
  ) {
    return (
      <AcademyAnnouncementsWorkspace />
    )
  }

  if (
    workspaceKey ===
    'academy-profile'
  ) {
    return (
      <ProfileWorkspace
        memberId={profileMemberId}
        onToast={onToast}
        /* YHU_ACADEMY_PROFILE_FULL_RETURN_PARITY */
        onBack={() => {
          let destination = 'academy-community'

          try {
            const stored = sessionStorage.getItem(
              'yh_react_academy_profile_return_v1'
            )

            const routes = [
              'academy-roadmap',
              'academy-missions',
              'academy-community',
              'academy-messages',
              'academy-voice',
              'academy-video',
              'academy-announcements',
            ]

            if (routes.includes(stored)) destination = stored

            sessionStorage.removeItem(
              'yh_react_academy_profile_return_v1'
            )

            if (destination === 'academy-messages') {
              const last = JSON.parse(
                sessionStorage.getItem(
                  'yh_academy_last_non_profile_view_v2'
                ) || '{}'
              ) || {}

              if (last.sourceView === 'messages' && last.activeRoomId) {
                sessionStorage.setItem(
                  'yh_academy_open_message_room_id',
                  String(last.activeRoomId),
                )
              }
            }
          } catch {}

          onWorkspaceOpen?.(destination)
        }}
        onOpenMessages={(
          roomId,
        ) => {
          try {
            if (roomId) {
              sessionStorage.setItem(
                'yh_academy_open_message_room_id',
                String(
                  roomId,
                ),
              )
            }
          } catch { /* Session storage may be unavailable; continue navigation. */ }

          onWorkspaceOpen?.(
            'academy-messages',
          )
        }}
      />
    )
  }

  return <AcademyRoadmapWorkspace onToast={onToast} onWorkspaceOpen={onWorkspaceOpen} />
}
