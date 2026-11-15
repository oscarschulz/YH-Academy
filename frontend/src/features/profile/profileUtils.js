export function clean(value = '') {
  return String(value || '').trim()
}

export function first(...values) {
  return values
    .map(clean)
    .find(Boolean) || ''
}

export function firstArray(...values) {
  for (const value of values) {
    if (
      Array.isArray(value) &&
      value.length
    ) {
      return value
        .map(clean)
        .filter(Boolean)
    }
  }

  return []
}

export function splitList(value = '') {
  return String(value || '')
    .split(',')
    .map((item) =>
      item.trim(),
    )
    .filter(Boolean)
    .slice(0, 12)
}

export function getStoredToken() {
  const keys = [
    'yh_token',
    'token',
  ]

  for (const key of keys) {
    try {
      const value =
        sessionStorage.getItem(
          key,
        )

      if (value) return value
    } catch {}

    try {
      const value =
        localStorage.getItem(
          key,
        )

      if (value) return value
    } catch {}
  }

  return ''
}

export function normalizeProfile(
  academy = {},
  universe = {},
  mode = 'self',
) {
  const mergedSignals = {
    ...(academy?.signals ||
      {}),
    ...(universe?.signals ||
      {}),
  }

  /* YHU_ACADEMY_A01_PROFILE_POST_OBJECT_PARITY */
  const recentPosts =
    [
      universe?.recent_posts,
      universe?.recentPosts,
      academy?.recent_posts,
      academy?.recentPosts,
    ].find((items) => Array.isArray(items) && items.length) || []

  const displayName =
    first(
      academy?.display_name,
      academy?.displayName,
      academy?.fullName,
      universe?.display_name,
      universe?.displayName,
      universe?.fullName,
      universe?.name,
      academy?.username,
      universe?.username,
      'YH Member',
    )

  const username =
    first(
      academy?.username,
      universe?.username,
    ).replace(/^@+/, '')

  return {
    id: first(
      academy?.id,
      academy?.uid,
      academy?.userId,
      universe?.id,
      universe?.uid,
      universe?.userId,
    ),

    mode,

    displayName,

    username,

    bio:
      first(
        academy?.bio,
        universe?.bio,
      ) ||
      'Focused on execution, consistency, and long-term growth inside YH Universe.',

    avatar: academy?.profile_avatar_removed === true ? '' : first(
      academy?.avatar,
      academy?.avatar_url,
      academy?.avatarUrl,
      academy?.profile_photo,
      academy?.profilePhoto,
      academy?.photoURL,
      universe?.avatar,
      universe?.avatar_url,
      universe?.avatarUrl,
      universe?.profile_photo,
      universe?.profilePhoto,
      universe?.photoURL,
    ),

    coverPhoto: academy?.profile_cover_removed === true ? '' : first(
      academy?.cover_photo,
      academy?.coverPhoto,
      academy?.cover_url,
      academy?.coverUrl,
      universe?.cover_photo,
      universe?.coverPhoto,
      universe?.cover_url,
      universe?.coverUrl,
    ),

    roleLabel:
      first(
        academy?.role_label,
        academy?.roleLabel,
        universe?.role_label,
        universe?.roleLabel,
        universe?.trustTier,
      ) ||
      'YH Universe Member',

    roleTrack: first(
      academy?.role_track,
      academy?.roleTrack,
      universe?.role_track,
      universe?.roleTrack,
    ),

    followersCount:
      academy?.followers_count ??
      academy?.followersCount ??
      universe?.followers_count ??
      universe?.followersCount ??
      0,

    followingCount:
      academy?.following_count ??
      academy?.followingCount ??
      universe?.following_count ??
      universe?.followingCount ??
      0,

    friendsCount:
      academy?.friends_count ??
      academy?.friend_count ??
      academy?.friendsCount ??
      universe?.friends_count ??
      universe?.friendsCount ??
      0,

    searchTags:
      firstArray(
        academy?.search_tags,
        academy?.searchTags,
        universe?.search_tags,
        universe?.searchTags,
        mergedSignals?.tags,
      ),

    lookingFor:
      firstArray(
        academy?.looking_for,
        academy?.lookingFor,
        universe?.looking_for,
        universe?.lookingFor,
        mergedSignals?.lookingFor,
      ),

    canOffer:
      firstArray(
        academy?.can_offer,
        academy?.canOffer,
        universe?.can_offer,
        universe?.canOffer,
        mergedSignals?.canOffer,
      ),

    availability: first(
      academy?.availability,
      universe?.availability,
      mergedSignals?.availability,
    ),

    workMode: first(
      academy?.work_mode,
      academy?.workMode,
      universe?.work_mode,
      universe?.workMode,
      mergedSignals?.workMode,
    ),

    proofFocus: first(
      academy?.proof_focus,
      academy?.proofFocus,
      universe?.proof_focus,
      universe?.proofFocus,
    ),

    marketplaceReady:
      academy?.marketplace_ready ===
        true ||
      academy?.marketplaceReady ===
        true ||
      universe?.marketplace_ready ===
        true ||
      universe?.marketplaceReady ===
        true ||
      mergedSignals?.marketplaceReady ===
        true,

    recentPosts,

    followedByMe:
      academy?.followed_by_me ===
        true ||
      academy?.followedByMe ===
        true ||
      universe?.followed_by_me ===
        true ||
      universe?.followedByMe ===
        true,

    isFriend:
      academy?.is_friend === true ||
      academy?.is_friend === 1 ||
      academy?.isFriend === true,

    outgoingFriendRequestPending:
      academy?.outgoing_friend_request_pending === true ||
      academy?.outgoing_friend_request_pending === 1,

    incomingFriendRequestPending:
      academy?.incoming_friend_request_pending === true ||
      academy?.incoming_friend_request_pending === 1,

    incomingFriendRequestId: first(
      academy?.incoming_friend_request_id,
      academy?.incomingFriendRequestId,
      universe?.incoming_friend_request_id,
      universe?.incomingFriendRequestId
    ),

    rawAcademy: academy,
    rawUniverse: universe,
  }
}
