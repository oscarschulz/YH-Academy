import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiFetch } from '../../services/api/apiClient'

function clean(value = '') {
  return String(value ?? '').trim()
}

function safeArray(value) {
  return Array.isArray(value)
    ? value
    : []
}

function normalizeId(value) {
  return clean(value)
}

function postId(post = {}) {
  return normalizeId(
    post.id ||
      post.postId ||
      post._id,
  )
}

function memberId(member = {}) {
  return normalizeId(
    member.id ||
      member.userId ||
      member.user_id ||
      member.memberId,
  )
}

function commentId(comment = {}) {
  return normalizeId(
    comment.id ||
      comment.commentId ||
      comment._id,
  )
}

function currentUserId() {
  try {
    return clean(
      localStorage.getItem(
        'yh_user_id',
      ) ||
        sessionStorage.getItem(
          'yh_user_id',
        ) ||
        '',
    )
  } catch {
    return ''
  }
}

function getStoredToken() {
  try {
    return (
      sessionStorage.getItem(
        'yh_token',
      ) ||
      localStorage.getItem(
        'yh_token',
      ) ||
      sessionStorage.getItem(
        'token',
      ) ||
      localStorage.getItem(
        'token',
      ) ||
      ''
    )
  } catch {
    return ''
  }
}

function authorId(item = {}) {
  return normalizeId(
    item.user_id ||
      item.userId ||
      item.author_id ||
      item.authorId ||
      item.member_id ||
      item.memberId,
  )
}

function isMine(item = {}) {
  const me = currentUserId()
  const author = authorId(item)

  return Boolean(
    me &&
      author &&
      me === author,
  )
}

function getAuthorName(post = {}) {
  return clean(
    post.display_name ||
      post.displayName ||
      post.fullName ||
      post.full_name ||
      post.username ||
      post.authorName ||
      'Academy Member',
  )
}

function getRole(post = {}) {
  return clean(
    post.role_label ||
      post.roleLabel ||
      post.role ||
      'Academy Member',
  )
}

function getPostBody(post = {}) {
  return clean(
    post.body ||
      post.text ||
      post.caption ||
      '',
  )
}

function getMedia(post = {}) {
  if (post.share?.sourcePostId) {
    const share = post.share

    if (
      share.status !== 'available' ||
      share.unavailable === true
    ) {
      return null
    }

    const sharedUrl = clean(share.media?.url)

    return sharedUrl
      ? {
          url: sharedUrl,
          kind:
            clean(share.media?.kind).toLowerCase() === 'video'
              ? 'video'
              : 'image',
        }
      : null
  }

  const url =
    clean(
      post.media_url ||
        post.mediaUrl ||
        post.image_url ||
        post.imageUrl ||
        post.video_url ||
        post.videoUrl ||
        '',
    )

  if (!url) {
    return null
  }

  const explicitKind =
    clean(
      post.media_kind ||
        post.mediaKind ||
        '',
    ).toLowerCase()

  const kind =
    explicitKind === 'video' ||
    clean(post.video_url) ||
    clean(post.videoUrl)
      ? 'video'
      : 'image'

  return {
    url,
    kind,
  }
}

function getLikeCount(post = {}) {
  return Math.max(
    0,
    Number(
      post.likeCount ??
        post.like_count ??
        post.likes ??
        0,
    ) || 0,
  )
}

function isLiked(post = {}) {
  return (
    post.liked === true ||
    post.isLiked === true ||
    post.likedByMe === true ||
    post.liked_by_me === true
  )
}

function getCommentCount(post = {}) {
  return Math.max(
    0,
    Number(
      post.commentCount ??
        post.comment_count ??
        post.commentsCount ??
        post.comments_count ??
        0,
    ) || 0,
  )
}

function getDateLabel(item = {}) {
  const raw =
    item.created_at ||
    item.createdAt ||
    item.updated_at ||
    item.updatedAt ||
    ''

  if (!raw) return ''

  const date = new Date(raw)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return clean(raw)
  }

  return date.toLocaleString()
}

function normalizeNicheKey(value = '') {
  return clean(value)
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64)
}

const FEED_LAYER_STATE_KEY =
  'yh_academy_feed_layer_state_v1'

function normalizeFeedLayer(
  value = '',
) {
  const normalized =
    clean(value)
      .toLowerCase()

  if (
    normalized === 'global'
  ) {
    return 'global'
  }

  if (
    normalized === 'niches' ||
    normalized === 'niche'
  ) {
    return 'niches'
  }

  return 'circle'
}

function normalizeCircleMode(
  value = '',
) {
  const normalized =
    clean(value)
      .toLowerCase()

  if (
    normalized === 'following'
  ) {
    return 'following'
  }

  if (
    normalized === 'followers'
  ) {
    return 'followers'
  }

  return 'friends'
}

function readFeedLayerState() {
  const fallback = {
    layer: 'circle',
    circleMode: 'friends',
    activeNicheKey: '',
    defaultNicheKey: '',
    joinedNiches: [],
    niches: [],
  }

  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          FEED_LAYER_STATE_KEY,
        ) || 'null',
      )

    if (
      !parsed ||
      typeof parsed !==
        'object' ||
      Array.isArray(parsed)
    ) {
      return fallback
    }

    return {
      ...fallback,
      ...parsed,

      layer:
        normalizeFeedLayer(
          parsed.layer,
        ),

      circleMode:
        normalizeCircleMode(
          parsed.circleMode,
        ),

      activeNicheKey:
        normalizeNicheKey(
          parsed.activeNicheKey,
        ),

      defaultNicheKey:
        normalizeNicheKey(
          parsed.defaultNicheKey,
        ),

      joinedNiches:
        safeArray(
          parsed.joinedNiches,
        ),

      niches:
        safeArray(
          parsed.niches,
        ),
    }
  } catch {
    return fallback
  }
}

function writeFeedLayerState(
  state = {},
) {
  try {
    localStorage.setItem(
      FEED_LAYER_STATE_KEY,
      JSON.stringify({
        layer:
          normalizeFeedLayer(
            state.layer,
          ),

        circleMode:
          normalizeCircleMode(
            state.circleMode,
          ),

        activeNicheKey:
          normalizeNicheKey(
            state.activeNicheKey,
          ),

        defaultNicheKey:
          normalizeNicheKey(
            state.defaultNicheKey,
          ),

        joinedNiches:
          safeArray(
            state.joinedNiches,
          ),

        niches:
          safeArray(
            state.niches,
          ),
      }),
    )
  } catch {}
}

function getFeedCacheKey({
  layer = 'circle',
  circleMode = 'friends',
  activeNicheKey = '',
} = {}) {
  const normalizedLayer =
    normalizeFeedLayer(
      layer,
    )

  if (
    normalizedLayer ===
    'niches'
  ) {
    return `yh_academy_feed_cache_niche_${
      normalizeNicheKey(
        activeNicheKey,
      ) || 'none'
    }`
  }

  if (
    normalizedLayer ===
    'circle'
  ) {
    return `yh_academy_feed_cache_circle_${normalizeCircleMode(
      circleMode,
    )}`
  }

  return 'yh_academy_feed_cache_global'
}

function readFeedCache(
  context = {},
) {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          getFeedCacheKey(
            context,
          ),
        ) || 'null',
      )

    if (
      !parsed ||
      typeof parsed !==
        'object'
    ) {
      return {
        posts: [],
        nextCursor: '',
      }
    }

    return {
      posts:
        safeArray(
          parsed.posts,
        ),

      nextCursor:
        clean(
          parsed.nextCursor ||
            parsed.next_cursor,
        ),
    }
  } catch {
    return {
      posts: [],
      nextCursor: '',
    }
  }
}

function writeFeedCache(
  context = {},
  posts = [],
  nextCursor = '',
) {
  try {
    localStorage.setItem(
      getFeedCacheKey(
        context,
      ),
      JSON.stringify({
        posts:
          safeArray(posts),

        nextCursor:
          clean(nextCursor),

        updatedAt:
          new Date()
            .toISOString(),
      }),
    )

    /*
     * Preserve the original generic cache contract too.
     */
    localStorage.setItem(
      'yh_academy_feed_cache',
      JSON.stringify({
        posts:
          safeArray(posts),
      }),
    )
  } catch {}
}

function mergeNiches(
  ...collections
) {
  const map = new Map()

  collections
    .flatMap((items) =>
      safeArray(items),
    )
    .forEach((item) => {
      const key =
        normalizeNicheKey(
          item?.key,
        )

      if (!key) return

      map.set(key, {
        ...map.get(key),
        ...item,
        key,
      })
    })

  return Array.from(
    map.values(),
  )
}

function isFriendValue(
  member = {},
) {
  return [
    member.is_friend,
    member.isFriend,
    member.friend,
  ].some(
    (value) =>
      value === true ||
      value === 1 ||
      clean(value)
        .toLowerCase() ===
        'true',
  )
}

function hasOutgoingFriendRequest(
  member = {},
) {
  return [
    member.outgoing_friend_request_pending,
    member.outgoingFriendRequestPending,
  ].some(
    (value) =>
      value === true ||
      value === 1 ||
      clean(value)
        .toLowerCase() ===
        'true',
  )
}

function hasIncomingFriendRequest(
  member = {},
) {
  return [
    member.incoming_friend_request_pending,
    member.incomingFriendRequestPending,
  ].some(
    (value) =>
      value === true ||
      value === 1 ||
      clean(value)
        .toLowerCase() ===
        'true',
  )
}

function incomingFriendRequestId(
  member = {},
) {
  return clean(
    member.incoming_friend_request_id ||
      member.incomingFriendRequestId ||
      member.friend_request_id ||
      member.friendRequestId,
  )
}

function isFollowingValue(
  member = {},
) {
  const values = [
    member.following,
    member.followed_by_me,
    member.followedByMe,
    member.isFollowing,
    member.is_following,
  ]

  return values.some(
    (value) =>
      value === true ||
      value === 1 ||
      clean(value)
        .toLowerCase() ===
        'true',
  )
}

function resolveFollowResult(
  result = {},
  fallback = false,
) {
  const values = [
    result.following,
    result.followed_by_me,
    result.followedByMe,
    result.isFollowing,
    result.is_following,
    result.state,
    result.status,
    result.action,
  ]

  for (const value of values) {
    if (
      value === true ||
      value === 1
    ) {
      return true
    }

    if (
      value === false ||
      value === 0
    ) {
      return false
    }

    const normalized =
      clean(value)
        .toLowerCase()

    if (
      [
        'following',
        'followed',
        'true',
      ].includes(normalized)
    ) {
      return true
    }

    if (
      [
        'unfollowed',
        'not_following',
        'false',
      ].includes(normalized)
    ) {
      return false
    }
  }

  return fallback
}

function buildCommentTree(
  comments = [],
) {
  const map = new Map()
  const roots = []

  safeArray(comments).forEach(
    (comment) => {
      const id =
        commentId(comment)

      if (!id) return

      map.set(id, {
        ...comment,
        id,
        children: [],
      })
    },
  )

  map.forEach(
    (comment) => {
      const parentId =
        normalizeId(
          comment.parent_comment_id ||
            comment.parentCommentId ||
            '',
        )

      if (
        parentId &&
        map.has(parentId)
      ) {
        map
          .get(parentId)
          .children.push(
            comment,
          )
      } else {
        roots.push(comment)
      }
    },
  )

  return roots
}

function MemberCard({
  member,
  busy,
  onFollow,
  onFriend,
  onProfile,
}) {
  const id =
    memberId(member)

  const following =
    isFollowingValue(
      member,
    )

  const friend =
    isFriendValue(
      member,
    )

  const incomingRequest =
    hasIncomingFriendRequest(
      member,
    )

  const outgoingRequest =
    hasOutgoingFriendRequest(
      member,
    )

  const requestId =
    incomingFriendRequestId(
      member,
    )

  return (
    <article className="academy-member-card">
      <div className="academy-member-card-main">
        <strong>
          {clean(
            member.display_name ||
              member.displayName ||
              member.fullName ||
              member.full_name ||
              member.username ||
              'Academy Member',
          )}
        </strong>

        <span>
          {clean(
            member.role_label ||
              member.roleLabel ||
              member.role ||
              'Academy Member',
          )}
        </span>

        {clean(
          member.bio ||
            member.headline ||
            member.description,
        ) && (
          <p>
            {clean(
              member.bio ||
                member.headline ||
                member.description,
            )}
          </p>
        )}
      </div>

      <div className="academy-member-card-actions">
        <button
          type="button"
          className="academy-ui-button academy-ui-button--secondary"
          disabled={!id}
          onClick={() =>
            onProfile(member)
          }
        >
          Visit Profile
        </button>

        <button
          type="button"
          className={`academy-ui-button academy-ui-button--secondary ${
            following
              ? 'is-following'
              : ''
          }`}
          disabled={
            !id ||
            busy ===
              `follow:${id}`
          }
          onClick={() =>
            onFollow(member)
          }
        >
          {busy ===
          `follow:${id}`
            ? 'Updating...'
            : following
              ? 'Unfollow'
              : 'Follow'}
        </button>

        <button
          type="button"
          className={`academy-ui-button academy-ui-button--secondary ${
            friend ||
            outgoingRequest
              ? 'is-following'
              : ''
          }`}
          disabled={
            !id ||
            friend ||
            outgoingRequest ||
            busy ===
              `friend:${id}`
          }
          onClick={() =>
            onFriend(
              member,
              incomingRequest
                ? {
                    action:
                      'accept',

                    requestId,
                  }
                : {},
            )
          }
        >
          {busy ===
          `friend:${id}`
            ? incomingRequest
              ? 'Accepting...'
              : 'Sending...'
            : friend
              ? 'Friends'
              : incomingRequest
                ? 'Accept Request'
                : outgoingRequest
                  ? 'Request Sent'
                  : 'Add Friend'}
        </button>
      </div>
    </article>
  )
}

function CommentNode({
  postIdValue,
  comment,
  depth = 0,
  busy,
  onReply,
  onEdit,
  onDelete,
  onHide,
}) {
  const [
    replyOpen,
    setReplyOpen,
  ] = useState(false)

  const [
    replyText,
    setReplyText,
  ] = useState('')

  const [
    editOpen,
    setEditOpen,
  ] = useState(false)

  const [
    editText,
    setEditText,
  ] = useState(
    clean(
      comment.body ||
        comment.text,
    ),
  )

  const id =
    commentId(comment)

  return (
    <div
      className="academy-feed-comment"
      style={{
        marginLeft:
          depth > 0
            ? Math.min(
                depth * 18,
                54,
              )
            : 0,
      }}
    >
      <div className="academy-feed-comment-head">
        <strong>
          {getAuthorName(
            comment,
          )}
        </strong>

        <small>
          {getDateLabel(
            comment,
          )}
        </small>
      </div>

      {!editOpen ? (
        <p>
          {clean(
            comment.body ||
              comment.text,
          )}
        </p>
      ) : (
        <div className="academy-feed-comment-form">
          <textarea
            className="input-field"
            value={editText}
            onChange={(
              event,
            ) =>
              setEditText(
                event.target
                  .value,
              )
            }
          />

          <div className="roadmap-mission-actions">
            <button
              type="button"
              className="academy-ui-button academy-ui-button--secondary"
              onClick={() =>
                setEditOpen(
                  false,
                )
              }
            >
              Cancel
            </button>

            <button
              type="button"
              className="academy-ui-button academy-ui-button--primary"
              disabled={
                busy ===
                `comment-edit:${id}`
              }
              onClick={async () => {
                const saved =
                  await onEdit(
                    postIdValue,
                    id,
                    editText,
                  )

                if (saved) {
                  setEditOpen(
                    false,
                  )
                }
              }}
            >
              {busy ===
              `comment-edit:${id}`
                ? 'Saving...'
                : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="roadmap-mission-actions">
        <button
          type="button"
          className="academy-ui-button academy-ui-button--secondary"
          onClick={() =>
            setReplyOpen(
              (current) =>
                !current,
            )
          }
        >
          Reply
        </button>

        {isMine(comment) && (
          <>
            <button
              type="button"
              className="academy-ui-button academy-ui-button--secondary"
              onClick={() =>
                setEditOpen(
                  true,
                )
              }
            >
              Edit
            </button>

            <button
              type="button"
              className="academy-ui-button academy-ui-button--secondary"
              disabled={
                busy ===
                `comment-delete:${id}`
              }
              onClick={() =>
                onDelete(
                  postIdValue,
                  id,
                )
              }
            >
              {busy ===
              `comment-delete:${id}`
                ? 'Deleting...'
                : 'Delete'}
            </button>
          </>
        )}

        {!isMine(comment) && (
          <button
            type="button"
            className="academy-ui-button academy-ui-button--secondary"
            disabled={
              busy ===
              `comment-hide:${id}`
            }
            onClick={() =>
              onHide(
                postIdValue,
                id,
              )
            }
          >
            {busy ===
            `comment-hide:${id}`
              ? 'Hiding...'
              : 'Hide'}
          </button>
        )}
      </div>

      {replyOpen && (
        <div className="academy-feed-comment-form">
          <textarea
            className="input-field"
            placeholder="Write a reply..."
            value={replyText}
            onChange={(
              event,
            ) =>
              setReplyText(
                event.target
                  .value,
              )
            }
          />

          <button
            type="button"
            className="academy-ui-button academy-ui-button--primary"
            disabled={
              busy ===
              `comment:${id}`
            }
            onClick={async () => {
              const posted =
                await onReply(
                  postIdValue,
                  id,
                  replyText,
                )

              if (posted) {
                setReplyText('')
                setReplyOpen(
                  false,
                )
              }
            }}
          >
            {busy ===
            `comment:${id}`
              ? 'Replying...'
              : 'Reply'}
          </button>
        </div>
      )}

      {safeArray(
        comment.children,
      ).map((child) => (
        <CommentNode
          key={
            commentId(child)
          }
          postIdValue={
            postIdValue
          }
          comment={child}
          depth={depth + 1}
          busy={busy}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={
            onDelete
          }
          onHide={onHide}
        />
      ))}
    </div>
  )
}

export default function AcademyCommunityWorkspace({
  onToast,
  onProfileOpen,
}) {
  const [
    layer,
    setLayer,
  ] = useState(
    () =>
      readFeedLayerState()
        .layer,
  )

  const [
    circleMode,
    setCircleMode,
  ] = useState(
    () =>
      readFeedLayerState()
        .circleMode,
  )

  const [
    niches,
    setNiches,
  ] = useState(() => readFeedLayerState().niches)

  const [
    joinedNiches,
    setJoinedNiches,
  ] = useState(() => readFeedLayerState().joinedNiches)

  const [
    defaultNicheKey,
    setDefaultNicheKey,
  ] = useState(() => readFeedLayerState().defaultNicheKey)

  const [
    activeNicheKey,
    setActiveNicheKey,
  ] = useState(
    () =>
      readFeedLayerState()
        .activeNicheKey,
  )

  const [
    posts,
    setPosts,
  ] = useState(
    () => {
      const state =
        readFeedLayerState()

      return readFeedCache(
        state,
      ).posts
    },
  )

  const [
    nextCursor,
    setNextCursor,
  ] = useState(
    () => {
      const state =
        readFeedLayerState()

      return readFeedCache(
        state,
      ).nextCursor
    },
  )

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    body,
    setBody,
  ] = useState('')

  const [
    media,
    setMedia,
  ] = useState(null)

  const [
    uploadBusy,
    setUploadBusy,
  ] = useState(false)

  const [
    postBusy,
    setPostBusy,
  ] = useState(false)

  const [
    actionBusy,
    setActionBusy,
  ] = useState('')

  const [
    query,
    setQuery,
  ] = useState('')

  const [
    memberResults,
    setMemberResults,
  ] = useState([])

  const [
    searchBusy,
    setSearchBusy,
  ] = useState(false)

  const [
    commentsByPost,
    setCommentsByPost,
  ] = useState({})

  const [
    commentsOpen,
    setCommentsOpen,
  ] = useState({})

  const [
    commentInputs,
    setCommentInputs,
  ] = useState({})

  const [
    editPostId,
    setEditPostId,
  ] = useState('')

  const [
    editPostBody,
    setEditPostBody,
  ] = useState('')

  const nicheMap =
    useMemo(() => {
      const map = new Map()

      niches.forEach(
        (niche) => {
          map.set(
            normalizeNicheKey(
              niche.key,
            ),
            niche,
          )
        },
      )

      return map
    }, [niches])

  const joinedKeys =
    useMemo(
      () =>
        new Set(
          joinedNiches
            .map((item) =>
              normalizeNicheKey(
                item?.key,
              ),
            )
            .filter(Boolean),
        ),
      [joinedNiches],
    )

  const feedContext =
    useMemo(() => {
      if (
        layer ===
        'niches'
      ) {
        const niche =
          nicheMap.get(
            normalizeNicheKey(
              activeNicheKey,
            ),
          )

        return {
          scope: 'niche',
          feedScope:
            'niche',
          nicheKey:
            niche?.key ||
            activeNicheKey ||
            '',
          nicheLabel:
            niche?.label ||
            '',
          audience:
            'niche',
          label:
            niche?.label
              ? `Niche: ${niche.label}`
              : 'Niche',
        }
      }

      if (
        layer ===
        'circle'
      ) {
        return {
          scope: 'circle',
          feedScope:
            'circle',
          relation:
            circleMode,
          audience:
            circleMode,
          label:
            `Circle: ${circleMode}`,
        }
      }

      return {
        scope: 'global',
        feedScope:
          'global',
        audience:
          'global',
        label:
          'Global Community',
      }
    }, [
      layer,
      circleMode,
      activeNicheKey,
      nicheMap,
    ])

  const buildFeedUrl =
    useCallback(
      (cursor = '') => {
        const params =
          new URLSearchParams({
            limit: '20',
          })

        if (
          feedContext.scope ===
          'niche'
        ) {
          params.set(
            'scope',
            'niche',
          )

          params.set(
            'niche',
            feedContext.nicheKey ||
              '',
          )
        } else if (
          feedContext.scope ===
          'circle'
        ) {
          params.set(
            'scope',
            'circle',
          )

          params.set(
            'relation',
            feedContext.relation ||
              'friends',
          )
        } else {
          params.set(
            'scope',
            'global',
          )
        }

        if (clean(cursor)) {
          params.set(
            'cursor',
            clean(cursor),
          )
        }

        return `/api/academy/feed?${params.toString()}`
      },
      [feedContext],
    )

  const loadNiches =
    useCallback(async () => {
      try {
        const result =
          await apiFetch(
            '/api/academy/community/niches',
            {
              method: 'GET',
            },
          )

        const apiNiches =
          safeArray(
            result?.niches,
          )

        const joined =
          safeArray(
            result?.joinedNiches,
          )

        const merged =
          mergeNiches(
            apiNiches,
            joined,
            readFeedLayerState().niches,
          )

        const defaultKey =
          normalizeNicheKey(
            result?.defaultNicheKey,
          )

        setNiches(merged)
        setJoinedNiches(
          joined,
        )
        setDefaultNicheKey(
          defaultKey,
        )

        setActiveNicheKey(
          (current) =>
            current ||
            defaultKey ||
            normalizeNicheKey(
              joined?.[0]?.key,
            ),
        )
      } catch {
        // Feed can still run without niche state.
      }
    }, [])

  const feedRequestRef = useRef(null)

  const loadFeed =
    useCallback(
      async ({
        append = false,
        cursor = '',
      } = {}) => {
        /* YHU_ACADEMY_A08_FEED_REQUEST_GUARD */
        feedRequestRef.current?.abort()
        const controller = new AbortController()
        feedRequestRef.current = controller

        if (
          layer ===
            'niches' &&
          !activeNicheKey
        ) {
          setPosts([])
          setNextCursor('')
          setLoading(false)
          setLoadingMore(false)
          setError('')
          feedRequestRef.current = null
          return
        }

        setLoading(!append)
        setLoadingMore(append)
        if (!append) setError('')

        try {
          const result =
            await apiFetch(
              buildFeedUrl(
                cursor,
              ),
              {
                method:
                  'GET',
                signal: controller.signal,
              },
            )

          if (controller.signal.aborted) return

          const incoming =
            safeArray(
              result?.posts,
            )

          const resolvedNextCursor =
            clean(
              result?.nextCursor ||
                result?.next_cursor ||
                result
                  ?.pagination
                  ?.nextCursor ||
                '',
            )

          setPosts(
            (current) => {
              if (controller.signal.aborted) return current
              const nextPosts =
                append
                  ? [
                      ...current,
                      ...incoming.filter(
                        (post) => {
                          const id =
                            postId(
                              post,
                            )

                          return !current.some(
                            (
                              existing,
                            ) =>
                              postId(
                                existing,
                              ) ===
                              id,
                          )
                        },
                      ),
                    ]
                  : incoming

              writeFeedCache(
                {
                  layer,
                  circleMode,
                  activeNicheKey,
                },
                nextPosts,
                resolvedNextCursor,
              )

              return nextPosts
            },
          )

          setNextCursor(
            resolvedNextCursor,
          )
        } catch (
          feedError
        ) {
          if (controller.signal.aborted) return

          const message =
            feedError?.message ||
            'Failed to load YHA feed.'

          setError(message)

          onToast?.(
            message,
            'error',
          )
        } finally {
          if (feedRequestRef.current === controller) {
            setLoading(false)
            setLoadingMore(false)
          }
        }
      },
      [
        activeNicheKey,
        buildFeedUrl,
        layer,
        onToast,
      ],
    )

  useEffect(() => {
    void loadNiches()
  }, [loadNiches])

  useEffect(() => {
    writeFeedLayerState({
      layer,
      circleMode,
      activeNicheKey,
      defaultNicheKey,
      joinedNiches,
      niches,
    })
  }, [
    layer,
    circleMode,
    activeNicheKey,
    defaultNicheKey,
    joinedNiches,
    niches,
  ])

  useEffect(() => {
    const cached =
      readFeedCache({
        layer,
        circleMode,
        activeNicheKey,
      })

    setPosts(
      cached.posts,
    )

    setNextCursor(
      cached.nextCursor,
    )
  }, [
    layer,
    circleMode,
    activeNicheKey,
  ])

  useEffect(() => {
    void loadFeed()

    return () => {
      feedRequestRef.current?.abort()
      feedRequestRef.current = null
    }
  }, [loadFeed])

  useEffect(() => {
    const normalized =
      clean(query)

    if (
      normalized.length <
        2 ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalized,
      )
    ) {
      setMemberResults([])
      setSearchBusy(false)
      return undefined
    }

    /* YHU_ACADEMY_A07_MEMBER_SEARCH_ABORT_GUARD */
    const controller = new AbortController()

    const timer =
      window.setTimeout(
        async () => {
          if (controller.signal.aborted) return

          setSearchBusy(
            true,
          )

          try {
            const result =
              await apiFetch(
                `/api/academy/community/members?limit=24&query=${encodeURIComponent(
                  normalized,
                )}`,
                {
                  method:
                    'GET',
                  signal: controller.signal,
                },
              )

            if (controller.signal.aborted) return

            setMemberResults(
              safeArray(
                result?.members,
              ),
            )
          } catch {
            if (controller.signal.aborted) return

            setMemberResults(
              [],
            )
          } finally {
            if (!controller.signal.aborted) {
              setSearchBusy(false)
            }
          }
        },
        250,
      )

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const uploadMedia =
    async (file) => {
      if (!file) return

      setUploadBusy(true)

      try {
        const token =
          getStoredToken()

        const mimeType =
          clean(file.type)

        const mediaKind =
          mimeType
            .toLowerCase()
            .startsWith(
              'video/',
            )
            ? 'video'
            : 'image'

        const response =
          await fetch(
            '/api/academy/feed/uploads',
            {
              method:
                'POST',
              credentials:
                'include',
              headers: {
                ...(token
                  ? {
                      Authorization:
                        `Bearer ${token}`,
                    }
                  : {}),
                'Content-Type':
                  mimeType ||
                  'application/octet-stream',
                'X-File-Name':
                  encodeURIComponent(
                    file.name ||
                      'upload',
                  ),
                'X-File-Size':
                  String(
                    Number(
                      file.size ||
                        0,
                    ),
                  ),
                'X-Media-Kind':
                  mediaKind,
                'X-File-Mime':
                  mimeType ||
                  '',
              },
              body: file,
            },
          )

        const result =
          await response
            .json()
            .catch(
              () => ({}),
            )

        if (
          !response.ok ||
          result?.success ===
            false ||
          !result?.media
            ?.url
        ) {
          throw new Error(
            result?.message ||
              'Failed to upload media.',
          )
        }

        setMedia(
          result.media,
        )
      } catch (
        uploadError
      ) {
        onToast?.(
          uploadError?.message ||
            'Failed to upload media.',
          'error',
        )
      } finally {
        setUploadBusy(false)
      }
    }

  const submitPost =
    async (event) => {
      event.preventDefault()

      if (
        postBusy ||
        uploadBusy
      ) {
        return
      }

      const cleanBody =
        clean(body)

      if (
        !cleanBody &&
        !media?.url
      ) {
        onToast?.(
          'Write something or attach a photo/video before posting.',
          'error',
        )
        return
      }

      setPostBusy(true)

      try {
        await apiFetch(
          '/api/academy/feed/posts',
          {
            method: 'POST',
            body:
              JSON.stringify({
                body: cleanBody,
                mediaReceipt:
                  media?.receipt ||
                  '',
                feedScope:
                  feedContext.feedScope,
                nicheKey:
                  feedContext.nicheKey ||
                  '',
                nicheLabel:
                  feedContext.nicheLabel ||
                  '',
                audience:
                  feedContext.audience ||
                  'global',
              }),
          },
        )

        setBody('')
        setMedia(null)

        onToast?.(
          `Posted to ${feedContext.label}.`,
          'success',
        )

        await loadFeed()
      } catch (
        createError
      ) {
        onToast?.(
          createError?.message ||
            'Failed to create post.',
          'error',
        )
      } finally {
        setPostBusy(false)
      }
    }

  const toggleLike =
    async (post) => {
      const id =
        postId(post)

      if (!id) return

      const previousLiked =
        isLiked(post)

      const previousCount =
        getLikeCount(post)

      const nextLiked =
        !previousLiked

      const nextCount =
        Math.max(
          0,
          previousCount +
            (previousLiked
              ? -1
              : 1),
        )

      setActionBusy(
        `like:${id}`,
      )

      setPosts(
        (current) =>
          current.map(
            (item) =>
              postId(item) ===
              id
                ? {
                    ...item,
                    liked:
                      nextLiked,
                    isLiked:
                      nextLiked,
                    likeCount:
                      nextCount,
                    like_count:
                      nextCount,
                  }
                : item,
          ),
      )

      try {
        const result =
          await apiFetch(
            `/api/academy/feed/posts/${encodeURIComponent(
              id,
            )}/like`,
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  liked:
                    nextLiked,
                }),
            },
          )

        const finalLiked =
          typeof result?.liked ===
          'boolean'
            ? result.liked
            : typeof result?.isLiked ===
                'boolean'
              ? result.isLiked
              : nextLiked

        const rawCount =
          result?.likeCount ??
          result?.like_count ??
          result?.likes ??
          result?.count

        const finalCount =
          Number.isFinite(
            Number(
              rawCount,
            ),
          )
            ? Number(
                rawCount,
              )
            : nextCount

        setPosts(
          (current) =>
            current.map(
              (item) =>
                postId(item) ===
                id
                  ? {
                      ...item,
                      liked:
                        finalLiked,
                      isLiked:
                        finalLiked,
                      likeCount:
                        finalCount,
                      like_count:
                        finalCount,
                    }
                  : item,
            ),
        )
      } catch (likeError) {
        setPosts(
          (current) =>
            current.map(
              (item) =>
                postId(item) ===
                id
                  ? {
                      ...item,
                      liked:
                        previousLiked,
                      isLiked:
                        previousLiked,
                      likeCount:
                        previousCount,
                      like_count:
                        previousCount,
                    }
                  : item,
            ),
        )

        onToast?.(
          likeError?.message ||
            'Failed to toggle like.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const loadComments =
    async (id) => {
      if (!id) return

      setCommentsOpen(
        (current) => ({
          ...current,
          [id]:
            !current[id],
        }),
      )

      if (
        commentsOpen[id] &&
        commentsByPost[id]
      ) {
        return
      }

      setActionBusy(
        `comments:${id}`,
      )

      try {
        const result =
          await apiFetch(
            `/api/academy/feed/posts/${encodeURIComponent(
              id,
            )}/comments`,
            {
              method: 'GET',
            },
          )

        setCommentsByPost(
          (current) => ({
            ...current,
            [id]:
              safeArray(
                result?.comments,
              ),
          }),
        )
      } catch (
        commentError
      ) {
        onToast?.(
          commentError?.message ||
            'Failed to load comments.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const refreshComments =
    async (id) => {
      const result =
        await apiFetch(
          `/api/academy/feed/posts/${encodeURIComponent(
            id,
          )}/comments`,
          {
            method: 'GET',
          },
        )

      setCommentsByPost(
        (current) => ({
          ...current,
          [id]:
            safeArray(
              result?.comments,
            ),
        }),
      )
    }

  const submitComment =
    async (
      id,
      parentCommentId = '',
      text = '',
    ) => {
      const commentBody =
        clean(text)

      if (!commentBody) {
        onToast?.(
          parentCommentId
            ? 'Reply cannot be empty.'
            : 'Comment cannot be empty.',
          'error',
        )
        return false
      }

      const busyKey =
        parentCommentId
          ? `comment:${parentCommentId}`
          : `comment:${id}`

      setActionBusy(
        busyKey,
      )

      try {
        await apiFetch(
          `/api/academy/feed/posts/${encodeURIComponent(
            id,
          )}/comments`,
          {
            method: 'POST',
            body:
              JSON.stringify({
                body:
                  commentBody,
                parentCommentId:
                  normalizeId(
                    parentCommentId,
                  ),
              }),
          },
        )

        await refreshComments(
          id,
        )

        setPosts(
          (current) =>
            current.map(
              (post) =>
                postId(post) ===
                id
                  ? {
                      ...post,
                      commentCount:
                        getCommentCount(
                          post,
                        ) + 1,
                    }
                  : post,
            ),
        )

        onToast?.(
          parentCommentId
            ? 'Reply posted.'
            : 'Comment posted.',
          'success',
        )

        return true
      } catch (
        commentError
      ) {
        onToast?.(
          commentError?.message ||
            'Failed to post comment.',
          'error',
        )
        return false
      } finally {
        setActionBusy('')
      }
    }

  const editComment =
    async (
      id,
      commentIdValue,
      text,
    ) => {
      const nextBody =
        clean(text)

      if (!nextBody) {
        onToast?.(
          'Comment cannot be empty.',
          'error',
        )
        return false
      }

      setActionBusy(
        `comment-edit:${commentIdValue}`,
      )

      try {
        await apiFetch(
          `/api/academy/feed/posts/${encodeURIComponent(
            id,
          )}/comments/${encodeURIComponent(
            commentIdValue,
          )}`,
          {
            method:
              'PATCH',
            body:
              JSON.stringify({
                body:
                  nextBody,
              }),
          },
        )

        await refreshComments(
          id,
        )

        onToast?.(
          'Comment updated.',
          'success',
        )

        return true
      } catch (
        commentError
      ) {
        onToast?.(
          commentError?.message ||
            'Failed to update comment.',
          'error',
        )

        return false
      } finally {
        setActionBusy('')
      }
    }

  const deleteComment =
    async (
      id,
      commentIdValue,
    ) => {
      if (
        !window.confirm(
          'Delete this comment?',
        )
      ) {
        return
      }

      setActionBusy(
        `comment-delete:${commentIdValue}`,
      )

      try {
        await apiFetch(
          `/api/academy/feed/posts/${encodeURIComponent(
            id,
          )}/comments/${encodeURIComponent(
            commentIdValue,
          )}`,
          {
            method:
              'DELETE',
          },
        )

        setPosts(
          (current) =>
            current.map(
              (post) =>
                postId(post) === id
                  ? {
                      ...post,
                      commentCount: Math.max(
                        0,
                        getCommentCount(post) - 1,
                      ),
                    }
                  : post,
            ),
        )

        await refreshComments(
          id,
        )

        onToast?.(
          'Comment deleted.',
          'success',
        )
      } catch (
        commentError
      ) {
        onToast?.(
          commentError?.message ||
            'Failed to delete comment.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const hideComment =
    async (
      id,
      commentIdValue,
    ) => {
      setActionBusy(
        `comment-hide:${commentIdValue}`,
      )

      try {
        await apiFetch(
          `/api/academy/feed/posts/${encodeURIComponent(
            id,
          )}/comments/${encodeURIComponent(
            commentIdValue,
          )}/hide`,
          {
            method:
              'POST',
          },
        )

        await refreshComments(
          id,
        )

        onToast?.(
          'Comment hidden only for your account.',
          'success',
        )
      } catch (
        commentError
      ) {
        onToast?.(
          commentError?.message ||
            'Failed to hide comment.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const savePostEdit =
    async (id) => {
      const nextBody =
        clean(
          editPostBody,
        )

      if (!nextBody) {
        onToast?.(
          'Post cannot be empty.',
          'error',
        )
        return
      }

      setActionBusy(
        `edit:${id}`,
      )

      try {
        const result =
          await apiFetch(
            `/api/academy/feed/posts/${encodeURIComponent(
              id,
            )}`,
            {
              method:
                'PATCH',
              body:
                JSON.stringify({
                  body:
                    nextBody,
                }),
            },
          )

        const editedAt =
          result?.post
            ?.edited_at ||
          result?.edited_at ||
          new Date().toISOString()

        setPosts(
          (current) =>
            current.map(
              (post) =>
                postId(post) ===
                id
                  ? {
                      ...post,
                      body:
                        nextBody,
                      edited_at:
                        editedAt,
                    }
                  : post,
            ),
        )

        setEditPostId('')
        setEditPostBody('')

        onToast?.(
          'Post updated.',
          'success',
        )
      } catch (
        editError
      ) {
        onToast?.(
          editError?.message ||
            'Failed to update post.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const deletePost =
    async (id) => {
      if (
        !window.confirm(
          'Delete this post?',
        )
      ) {
        return
      }

      setActionBusy(
        `delete:${id}`,
      )

      try {
        await apiFetch(
          `/api/academy/feed/posts/${encodeURIComponent(
            id,
          )}`,
          {
            method:
              'DELETE',
          },
        )

        setPosts(
          (current) =>
            current.filter(
              (post) =>
                postId(post) !==
                id,
            ),
        )

        onToast?.(
          'Post deleted.',
          'success',
        )
      } catch (
        deleteError
      ) {
        onToast?.(
          deleteError?.message ||
            'Failed to delete post.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const hidePost =
    async (id) => {
      setActionBusy(
        `hide:${id}`,
      )

      try {
        await apiFetch(
          `/api/academy/feed/posts/${encodeURIComponent(
            id,
          )}/hide`,
          {
            method:
              'POST',
          },
        )

        setPosts(
          (current) =>
            current.filter(
              (post) =>
                postId(post) !==
                id,
            ),
        )

        onToast?.(
          'Post hidden only for your account.',
          'success',
        )
      } catch (
        hideError
      ) {
        onToast?.(
          hideError?.message ||
            'Failed to hide post.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const sharePost =
    async (post) => {
      const caption =
        window.prompt(
          'Add a caption before sharing. Leave blank to share without one.',
          '',
        )

      if (
        caption === null
      ) {
        return
      }

      const id =
        postId(post)

      setActionBusy(
        `share:${id}`,
      )

      try {
        const originalBody =
          getPostBody(post)

        const name =
          getAuthorName(
            post,
          )

        const role =
          getRole(post)

        const bodyParts = []

        if (clean(caption)) {
          bodyParts.push(
            clean(caption),
          )
        }

        bodyParts.push(
          `Shared from ${name} (${role})`,
        )

        if (originalBody) {
          bodyParts.push(
            `“${originalBody}”`,
          )
        }

        await apiFetch(
          '/api/academy/feed/posts',
          {
            method:
              'POST',
            body:
              JSON.stringify({
                body:
                  bodyParts.join(
                    '\n\n',
                  ),
                share: {
                  sourcePostId: id,
                },
              }),
          },
        )

        onToast?.(
          'Post shared to the Academy.',
          'success',
        )

        await loadFeed()
      } catch (
        shareError
      ) {
        onToast?.(
          shareError?.message ||
            'Failed to share post.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const joinNiche =
    async (
      niche,
      makeDefault = false,
    ) => {
      const key =
        normalizeNicheKey(
          niche?.key,
        )

      if (!key) return

      setActionBusy(
        `niche:${key}`,
      )

      try {
        const result =
          await apiFetch(
            `/api/academy/community/niches/${encodeURIComponent(
              key,
            )}/join`,
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  makeDefault,
                }),
            },
          )

        const joined =
          safeArray(
            result?.joinedNiches,
          ).length
            ? result.joinedNiches
            : mergeNiches(
                joinedNiches,
                [
                  niche,
                ],
              )

        const defaultKey =
          normalizeNicheKey(
            result?.defaultNicheKey ||
              (makeDefault
                ? key
                : defaultNicheKey ||
                  key),
          )

        setJoinedNiches(
          joined,
        )

        setNiches(
          (current) =>
            mergeNiches(
              current,
              joined,
              [
                niche,
              ],
            ),
        )

        setDefaultNicheKey(
          defaultKey,
        )

        setActiveNicheKey(
          key,
        )

        setLayer(
          'niches',
        )

        onToast?.(
          'Niche joined.',
          'success',
        )
      } catch (
        nicheError
      ) {
        onToast?.(
          nicheError?.message ||
            'Failed to join niche.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const setDefaultNiche =
    async (niche) => {
      const key =
        normalizeNicheKey(
          niche?.key,
        )

      if (!key) return

      if (
        key ===
        defaultNicheKey
      ) {
        setActiveNicheKey(
          key,
        )
        setLayer('niches')
        return
      }

      setActionBusy(
        `niche-default:${key}`,
      )

      try {
        const result =
          await apiFetch(
            `/api/academy/community/niches/${encodeURIComponent(
              key,
            )}/default`,
            {
              method:
                'POST',
              body:
                JSON.stringify(
                  {},
                ),
            },
          )

        setJoinedNiches(
          safeArray(
            result?.joinedNiches,
          ).length
            ? result.joinedNiches
            : joinedNiches,
        )

        setDefaultNicheKey(
          normalizeNicheKey(
            result?.defaultNicheKey ||
              key,
          ),
        )

        setActiveNicheKey(
          key,
        )

        setLayer(
          'niches',
        )

        onToast?.(
          'Default niche updated.',
          'success',
        )
      } catch (
        nicheError
      ) {
        onToast?.(
          nicheError?.message ||
            'Failed to update the default niche.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const leaveNiche =
    async (niche) => {
      const key =
        normalizeNicheKey(
          niche?.key,
        )

      if (!key) return

      setActionBusy(
        `niche-leave:${key}`,
      )

      try {
        const result =
          await apiFetch(
            `/api/academy/community/niches/${encodeURIComponent(
              key,
            )}`,
            {
              method:
                'DELETE',
            },
          )

        const nextJoined =
          safeArray(
            result?.joinedNiches,
          ).length
            ? result.joinedNiches
            : joinedNiches.filter(
                (item) =>
                  normalizeNicheKey(
                    item?.key,
                  ) !== key,
              )

        setJoinedNiches(
          nextJoined,
        )

        setDefaultNicheKey(
          normalizeNicheKey(
            result?.defaultNicheKey ||
              nextJoined?.[0]
                ?.key ||
              '',
          ),
        )

        setActiveNicheKey(
          '',
        )

        setPosts([])

        onToast?.(
          'Niche removed from your joined list.',
          'success',
        )
      } catch (
        nicheError
      ) {
        onToast?.(
          nicheError?.message ||
            'Failed to leave niche.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const toggleFollow =
    async (member) => {
      const id =
        memberId(member)

      if (!id) return

      const previous =
        isFollowingValue(
          member,
        )

      const desiredFollowingState =
        !previous

      setActionBusy(
        `follow:${id}`,
      )

      try {
        const result =
          await apiFetch(
            `/api/academy/community/members/${encodeURIComponent(
              id,
            )}/follow`,
            {
              method:
                'POST',
              body:
                JSON.stringify({
                  following:
                    desiredFollowingState,
                }),
            },
          )

        const following =
          resolveFollowResult(
            result,
            !previous,
          )

        setMemberResults(
          (current) =>
            current.map(
              (item) =>
                memberId(
                  item,
                ) === id
                  ? {
                      ...item,
                      following,
                      isFollowing:
                        following,
                      followedByMe:
                        following,
                      followed_by_me:
                        following,
                    }
                  : item,
            ),
        )


        onToast?.(
          following
            ? 'User followed.'
            : 'User unfollowed.',
          'success',
        )
      } catch (
        followError
      ) {
        onToast?.(
          followError?.message ||
            'Failed to update follow status.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const sendFriendRequest =
    async (
      member,
      options = {},
    ) => {
      const id =
        memberId(member)

      if (!id) return

      setActionBusy(
        `friend:${id}`,
      )

      try {
        const action =
          clean(
            options.action,
          ).toLowerCase()

        const requestId =
          clean(
            options.requestId ||
              incomingFriendRequestId(
                member,
              ),
          )

        if (
          action === 'accept'
        ) {
          if (!requestId) {
            throw new Error(
              'Friend request id is unavailable.',
            )
          }

          await apiFetch(
            `/api/academy/feed/friend-requests/${encodeURIComponent(
              requestId,
            )}/respond`,
            {
              method:
                'POST',

              body:
                JSON.stringify({
                  action:
                    'accept',
                }),
            },
          )

          const patch = {
            isFriend: true,
            is_friend: true,

            incomingFriendRequestPending:
              false,

            incoming_friend_request_pending:
              false,

            incomingFriendRequestId:
              '',

            incoming_friend_request_id:
              '',
          }

          setMemberResults(
            (current) =>
              current.map(
                (item) =>
                  memberId(
                    item,
                  ) === id
                    ? {
                        ...item,
                        ...patch,
                      }
                    : item,
              ),
          )


          onToast?.(
            'Friend request accepted.',
            'success',
          )

          return
        }

        await apiFetch(
          '/api/academy/feed/friend-requests',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                targetUserId:
                  id,

                receiverId:
                  id,
              }),
          },
        )

        const patch = {
          outgoingFriendRequestPending:
            true,

          outgoing_friend_request_pending:
            true,
        }

        setMemberResults(
          (current) =>
            current.map(
              (item) =>
                memberId(
                  item,
                ) === id
                  ? {
                      ...item,
                      ...patch,
                    }
                  : item,
            ),
        )


        onToast?.(
          'Friend request sent.',
          'success',
        )
      } catch (
        friendError
      ) {
        onToast?.(
          friendError?.message ||
            'Failed to update friend request.',
          'error',
        )
      } finally {
        setActionBusy('')
      }
    }

  const openMemberProfile =
    (member) => {
      const id =
        memberId(member)

      if (!id) {
        return
      }

      onProfileOpen?.(
        id,
      )
    }

  const localPostResults =
    useMemo(() => {
      const normalized =
        clean(query)
          .toLowerCase()

      if (
        normalized.length <
        2
      ) {
        return []
      }

      return posts.filter(
        (post) =>
          [
            getPostBody(
              post,
            ),
            getAuthorName(
              post,
            ),
            clean(
              post.hashtags,
            ),
          ]
            .join(' ')
            .toLowerCase()
            .includes(
              normalized,
            ),
      )
    }, [posts, query])

  const showSearchResults =
    clean(query).length >=
      2 &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      clean(query),
    )

  return (
    <section
      className="yh-dashboard-react-workspace yh-dashboard-react-academy-workspace"
      data-yh-dashboard-react-surface="academy-community"
    >
      <div className="academy-community-scroll">
        <div className="academy-feed-shell">
          <section className="academy-lead-missions-hero academy-community-hero">
            <div>
              <div className="academy-profile-card-kicker">
                The Academy
              </div>

              <h2 className="academy-lead-missions-title">
                Community
              </h2>

              <p className="academy-lead-missions-copy">
                Connect with
                Academy members,
                share progress,
                learn inside your
                niches, and build
                your circle.
              </p>
            </div>

            <div className="academy-community-tabs">
              <button
                type="button"
                className={`academy-ui-button academy-ui-button--secondary ${
                  layer ===
                  'circle'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setLayer(
                    'circle',
                  )
                }
              >
                Circle
              </button>

              <button
                type="button"
                className={`academy-ui-button academy-ui-button--secondary ${
                  layer ===
                  'global'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setLayer(
                    'global',
                  )
                }
              >
                Global
              </button>

              <button
                type="button"
                className={`academy-ui-button academy-ui-button--secondary ${
                  layer ===
                  'niches'
                    ? 'active'
                    : ''
                }`}
                onClick={() => {
                  setLayer(
                    'niches',
                  )
                  setActiveNicheKey(
                    '',
                  )
                }}
              >
                Niches
              </button>
            </div>
          </section>

          <div className="academy-community-search">
            <input
              className="input-field"
              value={query}
              onChange={(
                event,
              ) =>
                setQuery(
                  event.target
                    .value,
                )
              }
              placeholder="Search Academy members and posts..."
            />
          </div>

          {showSearchResults && (
            <section className="academy-search-results-panel">
              <div className="academy-profile-card-kicker">
                Community
                Search
              </div>

              <h3>
                Results for “
                {clean(query)}”
              </h3>

              {searchBusy && (
                <div className="academy-profile-empty-state">
                  Searching
                  members...
                </div>
              )}

              {!searchBusy &&
                memberResults.map(
                  (member) => (
                    <MemberCard
                      key={
                        memberId(
                          member,
                        )
                      }
                      member={
                        member
                      }
                      busy={
                        actionBusy
                      }
                      onFollow={
                        toggleFollow
                      }
                      onFriend={
                        sendFriendRequest
                      }
                      onProfile={
                        openMemberProfile
                      }
                    />
                  ),
                )}

              {localPostResults.length >
                0 && (
                <>
                  <h4>
                    Posts
                  </h4>

                  {localPostResults.map(
                    (post) => (
                      <div
                        key={
                          postId(
                            post,
                          )
                        }
                        className="academy-feed-comments-empty"
                      >
                        <strong>
                          {getAuthorName(
                            post,
                          )}
                        </strong>

                        <p>
                          {getPostBody(
                            post,
                          )}
                        </p>
                      </div>
                    ),
                  )}
                </>
              )}

              {!searchBusy &&
                !memberResults.length &&
                !localPostResults.length && (
                  <div className="academy-profile-empty-state">
                    No community
                    results found.
                  </div>
                )}
            </section>
          )}

          {layer ===
            'circle' && (
            <div className="academy-lead-subtabs">
              {[
                [
                  'friends',
                  'Friends',
                ],
                [
                  'following',
                  'Following',
                ],
                [
                  'followers',
                  'Followers',
                ],
              ].map(
                ([
                  key,
                  label,
                ]) => (
                  <button
                    type="button"
                    key={key}
                    className={`academy-lead-subtab ${
                      circleMode ===
                      key
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      setCircleMode(
                        key,
                      )
                    }
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          )}

          {layer ===
            'niches' &&
            !activeNicheKey && (
              <section className="academy-niche-dashboard">
                <div>
                  <div className="academy-profile-card-kicker">
                    Academy
                    Niches
                  </div>

                  <h3>
                    Choose a
                    Niche
                  </h3>

                  <p>
                    Pick a niche
                    to load its
                    feed.
                  </p>
                </div>

                <div className="academy-niche-grid">
                  {niches.map(
                    (niche) => {
                      const key =
                        normalizeNicheKey(
                          niche.key,
                        )

                      const joined =
                        joinedKeys.has(
                          key,
                        )

                      const isDefault =
                        defaultNicheKey ===
                        key

                      return (
                        <article
                          className={`academy-niche-card ${
                            joined
                              ? 'is-joined'
                              : 'is-available'
                          } ${
                            isDefault
                              ? 'is-default'
                              : ''
                          }`}
                          key={key}
                        >
                          <div className="academy-niche-card-main">
                            <strong>
                              {clean(
                                niche.label,
                              ) ||
                                key}
                            </strong>

                            <p>
                              {clean(
                                niche.description,
                              ) ||
                                'Join this niche to personalize your Academy feed.'}
                            </p>

                            <span className="academy-niche-card-status">
                              {isDefault
                                ? 'Default track'
                                : joined
                                  ? 'Joined'
                                  : 'Available'}
                            </span>
                          </div>

                          <div className="academy-niche-card-actions">
                            {joined ? (
                              <>
                                <button
                                  type="button"
                                  className="academy-ui-button academy-ui-button--primary"
                                  onClick={() => {
                                    setActiveNicheKey(
                                      key,
                                    )
                                  }}
                                >
                                  Open
                                </button>

                                <button
                                  type="button"
                                  className="academy-ui-button academy-ui-button--secondary"
                                  disabled={
                                    actionBusy ===
                                    `niche-default:${key}`
                                  }
                                  onClick={() =>
                                    void setDefaultNiche(
                                      niche,
                                    )
                                  }
                                >
                                  {isDefault
                                    ? 'Default'
                                    : 'Set Default'}
                                </button>

                                <button
                                  type="button"
                                  className="academy-ui-button academy-ui-button--secondary"
                                  disabled={
                                    actionBusy ===
                                    `niche-leave:${key}`
                                  }
                                  onClick={() =>
                                    void leaveNiche(
                                      niche,
                                    )
                                  }
                                >
                                  {actionBusy ===
                                  `niche-leave:${key}`
                                    ? 'Leaving...'
                                    : 'Leave'}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="academy-ui-button academy-ui-button--primary"
                                disabled={
                                  actionBusy ===
                                  `niche:${key}`
                                }
                                onClick={() =>
                                  void joinNiche(
                                    niche,
                                  )
                                }
                              >
                                {actionBusy ===
                                `niche:${key}`
                                  ? 'Joining...'
                                  : 'Join Niche'}
                              </button>
                            )}
                          </div>
                        </article>
                      )
                    },
                  )}
                </div>
              </section>
            )}

          {!(
            layer ===
              'niches' &&
            !activeNicheKey
          ) && (
            <>
              <section className="academy-feed-composer-card">
                <div className="academy-profile-card-kicker">
                  Posting to{' '}
                  {
                    feedContext.label
                  }
                </div>

                <form
                  onSubmit={
                    submitPost
                  }
                >
                  <textarea
                    className="input-field"
                    value={body}
                    onChange={(
                      event,
                    ) =>
                      setBody(
                        event
                          .target
                          .value,
                      )
                    }
                    placeholder={
                      feedContext.scope ===
                      'niche'
                        ? `Share something inside ${
                            feedContext.nicheLabel ||
                            'this niche'
                          }...`
                        : feedContext.scope ===
                            'circle'
                          ? `Share something with your ${
                              feedContext.relation ||
                              'circle'
                            }...`
                          : 'What are you working on today inside The Academy?'
                    }
                    rows="4"
                  />

                  {media?.url && (
                    <div className="academy-feed-image-preview-wrap">
                      {clean(
                        media.kind,
                      ).toLowerCase() ===
                      'video' ? (
                        <video
                          src={
                            media.url
                          }
                          controls
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={
                            media.url
                          }
                          alt="Selected upload preview"
                        />
                      )}

                      <button
                        type="button"
                        className="academy-ui-button academy-ui-button--secondary"
                        onClick={() =>
                          setMedia(
                            null,
                          )
                        }
                      >
                        Remove
                        Media
                      </button>
                    </div>
                  )}

                  <div className="academy-lead-header-actions">
                    <label className="academy-ui-button academy-ui-button--secondary">
                      {uploadBusy
                        ? 'Uploading...'
                        : 'Photo / Video'}

                      <input
                        type="file"
                        accept="image/*,video/*"
                        hidden
                        disabled={
                          uploadBusy
                        }
                        onChange={(
                          event,
                        ) => {
                          const file =
                            event
                              .target
                              .files?.[0]

                          if (
                            file
                          ) {
                            void uploadMedia(
                              file,
                            )
                          }

                          event.target.value =
                            ''
                        }}
                      />
                    </label>

                    <button
                      type="submit"
                      className="academy-ui-button academy-ui-button--primary"
                      disabled={
                        postBusy ||
                        uploadBusy
                      }
                    >
                      {postBusy
                        ? 'Posting...'
                        : 'Post'}
                    </button>
                  </div>
                </form>
              </section>

              {layer ===
                'niches' &&
                activeNicheKey && (
                  <div className="academy-community-back">
                    <button
                      type="button"
                      className="academy-ui-button academy-ui-button--secondary"
                      onClick={() =>
                        setActiveNicheKey(
                          '',
                        )
                      }
                    >
                      ← Choose
                      Another
                      Niche
                    </button>
                  </div>
                )}

              {loading && (
                <div className="academy-profile-empty-state">
                  Loading
                  community...
                </div>
              )}

              {error &&
                !loading && (
                  <div className="yh-dashboard-settings-loading is-error">
                    {error}
                  </div>
                )}

              {!loading &&
                !error &&
                !posts.length && (
                  <div className="academy-profile-empty-state">
                    No posts yet.
                    Be the first
                    to post in
                    YHA.
                  </div>
                )}

              <div className="academy-feed-list">
                {posts.map(
                  (post) => {
                    const id =
                      postId(
                        post,
                      )

                    const mediaItem =
                      getMedia(
                        post,
                      )

                    const comments =
                      buildCommentTree(
                        commentsByPost[
                          id
                        ] || [],
                      )

                    const liked =
                      isLiked(
                        post,
                      )

                    return (
                      <article
                        className="academy-feed-card"
                        key={
                          id
                        }
                      >
                        <div className="academy-feed-card-head">
                          <div className="academy-feed-card-author">
                            <strong>
                              {getAuthorName(
                                post,
                              )}
                            </strong>

                            <span>
                              {getRole(
                                post,
                              )}
                            </span>
                          </div>

                          <small>
                            {getDateLabel(
                              post,
                            )}
                          </small>
                        </div>

                        {editPostId ===
                        id ? (
                          <div className="academy-feed-comment-form">
                            <textarea
                              className="input-field"
                              value={
                                editPostBody
                              }
                              onChange={(
                                event,
                              ) =>
                                setEditPostBody(
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />

                            <div className="roadmap-mission-actions">
                              <button
                                type="button"
                                className="academy-ui-button academy-ui-button--secondary"
                                onClick={() => {
                                  setEditPostId(
                                    '',
                                  )
                                  setEditPostBody(
                                    '',
                                  )
                                }}
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                className="academy-ui-button academy-ui-button--primary"
                                disabled={
                                  actionBusy ===
                                  `edit:${id}`
                                }
                                onClick={() =>
                                  void savePostEdit(
                                    id,
                                  )
                                }
                              >
                                {actionBusy ===
                                `edit:${id}`
                                  ? 'Saving...'
                                  : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          getPostBody(
                            post,
                          ) && (
                            <p className="academy-feed-card-body">
                              {getPostBody(
                                post,
                              )}
                            </p>
                          )
                        )}

                        {mediaItem && (
                          <div className="academy-feed-card-media">
                            {mediaItem.kind ===
                            'video' ? (
                              <video
                                src={
                                  mediaItem.url
                                }
                                controls
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={
                                  mediaItem.url
                                }
                                alt=""
                              />
                            )}
                          </div>
                        )}

                        <div className="academy-feed-card-actions">
                          <button
                            type="button"
                            className={`academy-ui-button academy-ui-button--secondary ${
                              liked
                                ? 'is-liked'
                                : ''
                            }`}
                            disabled={
                              actionBusy ===
                              `like:${id}`
                            }
                            onClick={() =>
                              void toggleLike(
                                post,
                              )
                            }
                          >
                            {liked
                              ? '❤️'
                              : '🤍'}{' '}
                            Like (
                            {getLikeCount(
                              post,
                            )}
                            )
                          </button>

                          <button
                            type="button"
                            className="academy-ui-button academy-ui-button--secondary"
                            disabled={
                              actionBusy ===
                              `comments:${id}`
                            }
                            onClick={() =>
                              void loadComments(
                                id,
                              )
                            }
                          >
                            💬 Comment (
                            {getCommentCount(
                              post,
                            )}
                            )
                          </button>

                          <button
                            type="button"
                            className="academy-ui-button academy-ui-button--secondary"
                            disabled={
                              actionBusy ===
                              `share:${id}`
                            }
                            onClick={() =>
                              void sharePost(
                                post,
                              )
                            }
                          >
                            {actionBusy ===
                            `share:${id}`
                              ? 'Sharing...'
                              : 'Share'}
                          </button>

                          {isMine(
                            post,
                          ) && (
                            <>
                              <button
                                type="button"
                                className="academy-ui-button academy-ui-button--secondary"
                                onClick={() => {
                                  setEditPostId(
                                    id,
                                  )
                                  setEditPostBody(
                                    getPostBody(
                                      post,
                                    ),
                                  )
                                }}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="academy-ui-button academy-ui-button--secondary"
                                disabled={
                                  actionBusy ===
                                  `delete:${id}`
                                }
                                onClick={() =>
                                  void deletePost(
                                    id,
                                  )
                                }
                              >
                                {actionBusy ===
                                `delete:${id}`
                                  ? 'Deleting...'
                                  : 'Delete'}
                              </button>
                            </>
                          )}

                          {!isMine(
                            post,
                          ) && (
                            <button
                              type="button"
                              className="academy-ui-button academy-ui-button--secondary"
                              disabled={
                                actionBusy ===
                                `hide:${id}`
                              }
                              onClick={() =>
                                void hidePost(
                                  id,
                                )
                              }
                            >
                              {actionBusy ===
                              `hide:${id}`
                                ? 'Hiding...'
                                : 'Hide'}
                            </button>
                          )}
                        </div>

                        {commentsOpen[
                          id
                        ] && (
                          <section className="academy-feed-comments-wrap">
                            {actionBusy ===
                            `comments:${id}` ? (
                              <div className="academy-feed-comments-loading">
                                Loading
                                comments...
                              </div>
                            ) : (
                              <>
                                {!comments.length && (
                                  <div className="academy-feed-comments-empty">
                                    No
                                    comments
                                    yet.
                                  </div>
                                )}

                                {comments.map(
                                  (
                                    comment,
                                  ) => (
                                    <CommentNode
                                      key={
                                        comment.id
                                      }
                                      postIdValue={
                                        id
                                      }
                                      comment={
                                        comment
                                      }
                                      busy={
                                        actionBusy
                                      }
                                      onReply={
                                        submitComment
                                      }
                                      onEdit={
                                        editComment
                                      }
                                      onDelete={
                                        deleteComment
                                      }
                                      onHide={
                                        hideComment
                                      }
                                    />
                                  ),
                                )}

                                <div className="academy-feed-comment-form">
                                  <textarea
                                    className="input-field"
                                    value={
                                      commentInputs[
                                        id
                                      ] ||
                                      ''
                                    }
                                    placeholder="Write a comment..."
                                    onChange={(
                                      event,
                                    ) =>
                                      setCommentInputs(
                                        (
                                          current,
                                        ) => ({
                                          ...current,
                                          [id]:
                                            event
                                              .target
                                              .value,
                                        }),
                                      )
                                    }
                                  />

                                  <button
                                    type="button"
                                    className="academy-ui-button academy-ui-button--primary"
                                    disabled={
                                      actionBusy ===
                                      `comment:${id}`
                                    }
                                    onClick={async () => {
                                      const posted =
                                        await submitComment(
                                          id,
                                          '',
                                          commentInputs[
                                            id
                                          ] ||
                                            '',
                                        )

                                      if (
                                        posted
                                      ) {
                                        setCommentInputs(
                                          (
                                            current,
                                          ) => ({
                                            ...current,
                                            [id]:
                                              '',
                                          }),
                                        )
                                      }
                                    }}
                                  >
                                    {actionBusy ===
                                    `comment:${id}`
                                      ? 'Commenting...'
                                      : 'Comment'}
                                  </button>
                                </div>
                              </>
                            )}
                          </section>
                        )}
                      </article>
                    )
                  },
                )}
              </div>

              {nextCursor && (
                <div className="academy-lead-header-actions">
                  <button
                    type="button"
                    className="academy-ui-button academy-ui-button--secondary"
                    disabled={
                      loadingMore
                    }
                    onClick={() =>
                      void loadFeed({
                        append:
                          true,
                        cursor:
                          nextCursor,
                      })
                    }
                  >
                    {loadingMore
                      ? 'Loading...'
                      : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </section>
  )
}
