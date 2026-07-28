const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const academyMemberProfileSupabaseRepo =
    require('./academyMemberProfileSupabaseRepo');

const yhuUsersSupabaseRepo =
    require('./yhuUsersSupabaseRepo');

const ACADEMY_COMMUNITY_NICHES = [
    { key: 'ecommerce', label: 'E-commerce', description: 'Stores, products, fulfillment, branding, and online selling.' },
    { key: 'digital_products', label: 'Digital Products', description: 'PDFs, templates, courses, paid resources, and productized knowledge.' },
    { key: 'sales_marketing', label: 'Sales & Marketing', description: 'Offers, funnels, persuasion, copywriting, and customer acquisition.' },
    { key: 'affiliate_marketing', label: 'Affiliate Marketing', description: 'Traffic, links, partnerships, and commission-based income.' },
    { key: 'freelancing', label: 'Freelancing', description: 'Skills, clients, outreach, delivery, pricing, and reputation.' },
    { key: 'saas', label: 'SaaS', description: 'Software ideas, validation, product building, and recurring revenue.' },
    { key: 'seo', label: 'SEO', description: 'Search traffic, content systems, keywords, ranking, and discovery.' },
    { key: 'market_investing', label: 'Market Investing', description: 'Markets, risk, research, and long-term capital growth.' },
    { key: 'fitness_health', label: 'Fitness & Health', description: 'Body, energy, training, nutrition, sleep, and discipline.' },
    { key: 'mindset_psychology', label: 'Mindset & Psychology', description: 'Self-control, identity, focus, discipline, and emotional mastery.' },
    { key: 'communication_networking', label: 'Communication & Networking', description: 'Confidence, public speaking, outreach, relationships, and influence.' },
    { key: 'ai_automation', label: 'AI & Automation', description: 'AI tools, automation systems, workflows, agents, and business leverage.' },
    { key: 'politics_2030_agenda', label: 'Politics & 2030 Agenda', description: 'Power, governance, policy, global systems, and strategic awareness.' },
    { key: 'philosophy', label: 'Philosophy', description: 'Reasoning, ethics, worldview, meaning, argument, and truth-seeking.' }
];

function sanitizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function normalizeUserId(value) {
    return sanitizeText(value);
}

function toInt(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value) {
    return value === true || String(value || '').toLowerCase() === 'true';
}

function nowIso() {
    return new Date().toISOString();
}

function buildId(prefix = 'acm') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

/* PATCH: Academy Community feed integrity helpers v2 */
function communityHttpErrorV2(
    message = 'Community request failed.',
    statusCode = 400
) {
    const error = new Error(
        sanitizeText(message) ||
        'Community request failed.'
    );

    error.statusCode =
        Number(statusCode) || 400;

    return error;
}

function encodeCommunityFeedCursorV2(payload = {}) {
    const json =
        JSON.stringify(
            payload &&
            typeof payload === 'object'
                ? payload
                : {}
        );

    return Buffer
        .from(json, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function decodeCommunityFeedCursorV2(value = '') {
    const clean =
        sanitizeText(value);

    if (!clean) {
        return null;
    }

    try {
        const normalized =
            clean
                .replace(/-/g, '+')
                .replace(/_/g, '/');

        const padding =
            normalized.length % 4
                ? '='.repeat(
                    4 -
                    (
                        normalized.length %
                        4
                    )
                )
                : '';

        const parsed =
            JSON.parse(
                Buffer
                    .from(
                        normalized + padding,
                        'base64'
                    )
                    .toString('utf8')
            );

        return (
            parsed &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed)
        )
            ? parsed
            : null;
    } catch (_) {
        throw communityHttpErrorV2(
            'Invalid Academy feed cursor.',
            400
        );
    }
}

async function listCommunityRowsPagedV2(
    buildQuery,
    {
        pageSize = 1000,
        maxRows = 20000,
        label = 'Community records'
    } = {}
) {
    if (typeof buildQuery !== 'function') {
        return [];
    }

    const safePageSize =
        Math.max(
            1,
            Math.min(
                1000,
                Number(pageSize) || 1000
            )
        );

    const safeMaxRows =
        Math.max(
            safePageSize,
            Math.min(
                50000,
                Number(maxRows) || 20000
            )
        );

    const rows = [];
    let offset = 0;

    while (rows.length < safeMaxRows) {
        const query =
            buildQuery();

        const {
            data,
            error
        } = await query.range(
            offset,
            offset + safePageSize - 1
        );

        if (error) {
            throw new Error(
                `${label} lookup failed: ${error.message}`
            );
        }

        const batch =
            Array.isArray(data)
                ? data
                : [];

        rows.push(...batch);

        if (
            batch.length <
            safePageSize
        ) {
            break;
        }

        offset +=
            batch.length;
    }

    return rows.slice(
        0,
        safeMaxRows
    );
}
/* END PATCH: Academy Community feed integrity helpers v2 */

function normalizeNicheKey(value = '') {
    return sanitizeText(value)
        .toLowerCase()
        .replace(/^#/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 64);
}

function getNicheMeta(nicheKey = '') {
    const cleanKey = normalizeNicheKey(nicheKey);
    return ACADEMY_COMMUNITY_NICHES.find((item) => item.key === cleanKey) || null;
}

function normalizeFeedScope(value = '') {
    const clean = sanitizeText(value).toLowerCase();
    if (clean === 'niche' || clean === 'niches') return 'niche';
    if (clean === 'circle') return 'circle';
    return 'global';
}

function normalizeCircleRelation(value = '') {
    const clean = sanitizeText(value).toLowerCase();
    if (clean === 'following') return 'following';
    if (clean === 'followers') return 'followers';
    return 'friends';
}

function normalizeFriendPair(a, b) {
    const x = normalizeUserId(a);
    const y = normalizeUserId(b);
    return x < y ? [x, y] : [y, x];
}

function friendshipKeyFor(a, b) {
    const [x, y] = normalizeFriendPair(a, b);
    return `${x}_${y}`;
}

function followKeyFor(followerId, followingId) {
    return `${normalizeUserId(followerId)}_${normalizeUserId(followingId)}`;
}

function mapArray(value = []) {
    return Array.isArray(value)
        ? value.map((item) => sanitizeText(item)).filter(Boolean)
        : [];
}

function extractHashtagsFromText(value = '') {
    const matches = String(value || '')
        .toLowerCase()
        .match(/#[a-z0-9_][a-z0-9_-]*/g) || [];

    return Array.from(new Set(
        matches
            .map((tag) => sanitizeText(tag).replace(/^#/, ''))
            .filter(Boolean)
    ));
}

function buildSearchPostPreview(value = '', maxLength = 140) {
    const clean = sanitizeText(value).replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    if (clean.length <= maxLength) return clean;
    return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

function mapProfileRow(row = {}, fallback = {}) {
    const canonicalProfile =
        row && typeof row === 'object'
            ? academyMemberProfileSupabaseRepo
                .rowToFirestoreUser(row)
            : {};

    const publicMeta =
        row.public_meta &&
        typeof row.public_meta === 'object'
            ? row.public_meta
            : {};

    const data =
        row.data &&
        typeof row.data === 'object'
            ? row.data
            : {};

    const source = {
        ...data,
        ...publicMeta,
        ...canonicalProfile
    };

    const fullName =
        sanitizeText(
            source.fullName ||
            source.name ||
            source.displayName ||
            row.full_name ||
            row.display_name
        ) ||
        sanitizeText(
            fallback.name ||
            fallback.fullName ||
            fallback.username
        ) ||
        'Hustler';

    const displayName =
        sanitizeText(
            source.displayName ||
            source.display_name ||
            row.display_name
        ) ||
        fullName;

    const communityNiches =
        mapArray(
            source.communityNiches ||
            source.community_niches ||
            []
        );

    const defaultNiche =
        sanitizeText(
            source.defaultNiche ||
            source.default_niche ||
            ''
        );

    return {
        id: sanitizeText(
            source.id ||
            source.uid ||
            source.userId ||
            source.firebaseUid ||
            row.user_id ||
            fallback.id ||
            fallback.firebaseUid
        ),

        email: sanitizeText(
            source.email ||
            row.email ||
            fallback.email
        ).toLowerCase(),

        fullName,
        display_name: displayName,
        displayName,

        username: sanitizeText(
            source.username ||
            row.username ||
            fallback.username
        ).replace(/^@+/, ''),

        avatar: sanitizeText(
            source.avatar ||
            source.profilePhoto ||
            source.photoURL ||
            row.avatar ||
            fallback.avatar ||
            fallback.profilePhoto ||
            fallback.photoURL
        ),

        role_label:
            sanitizeText(
                source.roleLabel ||
                source.role_label ||
                source.role ||
                row.role_label ||
                fallback.roleLabel ||
                fallback.role
            ) ||
            'Academy Member',

        roleLabel:
            sanitizeText(
                source.roleLabel ||
                source.role_label ||
                source.role ||
                row.role_label ||
                fallback.roleLabel ||
                fallback.role
            ) ||
            'Academy Member',

        bio: sanitizeText(
            source.bio ||
            source.profileBio ||
            source.about ||
            source.description
        ),

        cover_photo: sanitizeText(
            source.coverPhoto ||
            source.cover_photo ||
            source.coverUrl ||
            source.cover_url
        ),

        search_tags: mapArray(
            source.searchTags ||
            source.search_tags ||
            source.tags ||
            []
        ),

        community_niches:
            communityNiches,

        communityNiches:
            communityNiches,

        default_niche:
            defaultNiche,

        defaultNiche:
            defaultNiche,

        has_academy_access:
            source.hasAcademyAccess === true ||
            source.has_academy_access === true,

        academy_membership_status:
            sanitizeText(
                source.academyMembershipStatus ||
                source.academy_membership_status ||
                source.academyApplicationStatus ||
                source.academy_application_status
            ),

        created_at:
            row.created_at_source ||
            source.createdAt ||
            row.created_at ||
            '',

        updated_at:
            row.updated_at_source ||
            source.updatedAt ||
            row.updated_at ||
            ''
    };
}

function mapYhuUserRowToCommunitySeedV1(
    row = {},
    fallback = {}
) {
    const rawData =
        row.raw_data &&
        typeof row.raw_data === 'object'
            ? row.raw_data
            : {};

    const data =
        row.data &&
        typeof row.data === 'object'
            ? row.data
            : {};

    const publicMeta =
        row.public_meta &&
        typeof row.public_meta === 'object'
            ? row.public_meta
            : {};

    const source = {
        ...rawData,
        ...data,
        ...publicMeta,
        ...row,
        ...fallback
    };

    const userId = normalizeUserId(
        source.user_id ||
        source.firebase_uid ||
        source.firebaseUid ||
        source.uid ||
        source.userId ||
        source.id
    );

    if (!userId) {
        return null;
    }

    return {
        ...source,

        id: userId,
        uid: userId,
        userId,
        firebaseUid: userId,

        email: sanitizeText(
            source.email
        ).toLowerCase(),

        fullName: sanitizeText(
            source.full_name ||
            source.fullName ||
            source.name ||
            source.display_name ||
            source.displayName ||
            source.username ||
            'Hustler'
        ),

        displayName: sanitizeText(
            source.display_name ||
            source.displayName ||
            source.full_name ||
            source.fullName ||
            source.name ||
            source.username ||
            'Hustler'
        ),

        username: sanitizeText(
            source.username ||
            source.handle ||
            ''
        ).replace(/^@+/, ''),

        avatar: sanitizeText(
            source.avatar ||
            source.profile_photo ||
            source.profilePhoto ||
            source.photo_url ||
            source.photoURL ||
            ''
        ),

        profilePhoto: sanitizeText(
            source.profile_photo ||
            source.profilePhoto ||
            source.photo_url ||
            source.photoURL ||
            source.avatar ||
            ''
        ),

        photoURL: sanitizeText(
            source.photo_url ||
            source.photoURL ||
            source.avatar ||
            source.profile_photo ||
            source.profilePhoto ||
            ''
        ),

        roleLabel:
            sanitizeText(
                source.role_label ||
                source.roleLabel ||
                source.role
            ) ||
            'Academy Member'
    };
}

function buildAuthorSnapshot(profile = {}, fallback = {}) {
    const fullName =
        sanitizeText(profile.fullName || profile.full_name || profile.displayName || profile.display_name) ||
        sanitizeText(fallback.name || fallback.fullName || fallback.username) ||
        'Hustler';

    return {
        fullName,
        displayName: sanitizeText(profile.displayName || profile.display_name || fullName),
        username: sanitizeText(profile.username || fallback.username).replace(/^@+/, ''),
        avatar: sanitizeText(profile.avatar || fallback.avatar || fallback.profilePhoto || fallback.photoURL),
        roleLabel: sanitizeText(profile.roleLabel || profile.role_label || fallback.roleLabel || fallback.role || 'Academy Member') || 'Academy Member'
    };
}

async function getProfileRow(userId) {
    const cleanUserId = normalizeUserId(userId);
    if (!cleanUserId) return null;

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_member_profiles')
        .select('*')
        .eq('user_id', cleanUserId)
        .maybeSingle();

    if (error) {
        throw new Error(`Academy member profile lookup failed: ${error.message}`);
    }

    return data || null;
}

async function ensureViewerProfile(user = {}) {
    const viewerId = normalizeUserId(
        user?.id ||
        user?.firebaseUid ||
        user?.uid
    );

    if (!viewerId) {
        throw new Error(
            'Missing viewer id.'
        );
    }

    const existing =
        await getProfileRow(
            viewerId
        );

    if (existing) {
        return mapProfileRow(
            existing,
            user
        );
    }

    const yhuUserRow =
        await yhuUsersSupabaseRepo
            .getByUid(viewerId)
            .catch(() => null);

    const canonicalSeed =
        mapYhuUserRowToCommunitySeedV1(
            yhuUserRow || {},
            user
        ) || {
            ...user,
            id: viewerId,
            uid: viewerId,
            userId: viewerId,
            firebaseUid: viewerId
        };

    const saved =
        await academyMemberProfileSupabaseRepo
            .upsertProfileFromUserData(
                viewerId,
                canonicalSeed
            );

    if (!saved) {
        throw new Error(
            'Academy member profile create failed.'
        );
    }

    return mapProfileRow(
        saved,
        canonicalSeed
    );
}

async function getViewerProfile(user = {}) {
    return ensureViewerProfile(user);
}

async function getProfileOrFallback(
    userId,
    fallback = {}
) {
    const cleanUserId =
        normalizeUserId(userId);

    if (!cleanUserId) {
        return null;
    }

    const row =
        await getProfileRow(
            cleanUserId
        );

    if (row) {
        return mapProfileRow(
            row,
            fallback
        );
    }

    /*
     * Do not synthesize a fake "Hustler" profile for an
     * arbitrary id. A relationship target must exist in
     * the canonical YHU user inventory.
     */
    const yhuUserRow =
        await yhuUsersSupabaseRepo
            .getByUid(cleanUserId)
            .catch(() => null);

    if (!yhuUserRow) {
        return null;
    }

    const canonicalSeed =
        mapYhuUserRowToCommunitySeedV1(
            yhuUserRow,
            fallback
        );

    if (!canonicalSeed) {
        return null;
    }

    const saved =
        await academyMemberProfileSupabaseRepo
            .upsertProfileFromUserData(
                cleanUserId,
                canonicalSeed
            )
            .catch(() => null);

    return saved
        ? mapProfileRow(
            saved,
            canonicalSeed
        )
        : {
            ...canonicalSeed,
            id: cleanUserId,
            community_niches: mapArray(
                canonicalSeed.communityNiches ||
                canonicalSeed.community_niches
            ),
            default_niche: sanitizeText(
                canonicalSeed.defaultNiche ||
                canonicalSeed.default_niche
            )
        };
}

async function getAcademyFollowerCount(userId) {
    const { count, error } = await yhuSupabaseAdmin
        .from('yhu_academy_user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', normalizeUserId(userId));

    if (error) throw new Error(`Follower count failed: ${error.message}`);
    return count || 0;
}

async function getAcademyFollowingCount(userId) {
    const { count, error } = await yhuSupabaseAdmin
        .from('yhu_academy_user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', normalizeUserId(userId));

    if (error) throw new Error(`Following count failed: ${error.message}`);
    return count || 0;
}

async function getAcademyFriendCount(userId) {
    const normalizedUserId = normalizeUserId(userId);

    const [left, right] = await Promise.all([
        yhuSupabaseAdmin
            .from('yhu_academy_friendships')
            .select('id', { count: 'exact', head: true })
            .eq('user_one_id', normalizedUserId),
        yhuSupabaseAdmin
            .from('yhu_academy_friendships')
            .select('id', { count: 'exact', head: true })
            .eq('user_two_id', normalizedUserId)
    ]);

    if (left.error) throw new Error(`Friend count failed: ${left.error.message}`);
    if (right.error) throw new Error(`Friend count failed: ${right.error.message}`);

    return (left.count || 0) + (right.count || 0);
}

async function getFollowingIdsForUser(userId) {
    const normalizedUserId =
        normalizeUserId(userId);

    if (!normalizedUserId) {
        return [];
    }

    const rows =
        await listCommunityRowsPagedV2(
            () =>
                yhuSupabaseAdmin
                    .from(
                        'yhu_academy_user_follows'
                    )
                    .select(
                        'following_id'
                    )
                    .eq(
                        'follower_id',
                        normalizedUserId
                    ),

            {
                label:
                    'Following ids'
            }
        );

    return Array.from(
        new Set(
            rows
                .map((row) =>
                    sanitizeText(
                        row.following_id
                    )
                )
                .filter(Boolean)
        )
    );
}

async function getFollowerIdsForUser(userId) {
    const normalizedUserId =
        normalizeUserId(userId);

    if (!normalizedUserId) {
        return [];
    }

    const rows =
        await listCommunityRowsPagedV2(
            () =>
                yhuSupabaseAdmin
                    .from(
                        'yhu_academy_user_follows'
                    )
                    .select(
                        'follower_id'
                    )
                    .eq(
                        'following_id',
                        normalizedUserId
                    ),

            {
                label:
                    'Follower ids'
            }
        );

    return Array.from(
        new Set(
            rows
                .map((row) =>
                    sanitizeText(
                        row.follower_id
                    )
                )
                .filter(Boolean)
        )
    );
}

async function getFriendIdsForUser(userId) {
    const normalizedUserId =
        normalizeUserId(userId);

    if (!normalizedUserId) {
        return [];
    }

    const [
        leftRows,
        rightRows
    ] = await Promise.all([
        listCommunityRowsPagedV2(
            () =>
                yhuSupabaseAdmin
                    .from(
                        'yhu_academy_friendships'
                    )
                    .select(
                        'user_two_id'
                    )
                    .eq(
                        'user_one_id',
                        normalizedUserId
                    ),

            {
                label:
                    'Friend ids'
            }
        ),

        listCommunityRowsPagedV2(
            () =>
                yhuSupabaseAdmin
                    .from(
                        'yhu_academy_friendships'
                    )
                    .select(
                        'user_one_id'
                    )
                    .eq(
                        'user_two_id',
                        normalizedUserId
                    ),

            {
                label:
                    'Friend ids'
            }
        )
    ]);

    return Array.from(
        new Set([
            ...leftRows.map((row) =>
                sanitizeText(
                    row.user_two_id
                )
            ),

            ...rightRows.map((row) =>
                sanitizeText(
                    row.user_one_id
                )
            )
        ].filter(Boolean))
    );
}

async function getMutualFriendCount(viewerId, targetUserId) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedTargetUserId = normalizeUserId(targetUserId);

    if (!normalizedViewerId || !normalizedTargetUserId || normalizedViewerId === normalizedTargetUserId) {
        return 0;
    }

    const [viewerFriendIds, targetFriendIds] = await Promise.all([
        getFriendIdsForUser(normalizedViewerId),
        getFriendIdsForUser(normalizedTargetUserId)
    ]);

    const viewerSet = new Set(viewerFriendIds);
    return targetFriendIds.filter((id) => viewerSet.has(id)).length;
}

async function getFriendshipState(viewerId, authorId) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedAuthorId = normalizeUserId(authorId);

    if (!normalizedViewerId || !normalizedAuthorId || normalizedViewerId === normalizedAuthorId) {
        return {
            is_friend: false,
            outgoing_friend_request_pending: false,
            incoming_friend_request_pending: false,
            incoming_friend_request_id: ''
        };
    }

    const [x, y] = normalizeFriendPair(normalizedViewerId, normalizedAuthorId);

    const friendship = await yhuSupabaseAdmin
        .from('yhu_academy_friendships')
        .select('friendship_id')
        .eq('user_one_id', x)
        .eq('user_two_id', y)
        .maybeSingle();

    if (friendship.error) {
        throw new Error(`Friendship lookup failed: ${friendship.error.message}`);
    }

    if (friendship.data) {
        return {
            is_friend: true,
            outgoing_friend_request_pending: false,
            incoming_friend_request_pending: false,
            incoming_friend_request_id: ''
        };
    }

    const [outgoing, incoming] = await Promise.all([
        yhuSupabaseAdmin
            .from('yhu_academy_friend_requests')
            .select('request_id')
            .eq('sender_id', normalizedViewerId)
            .eq('receiver_id', normalizedAuthorId)
            .eq('status', 'pending')
            .limit(1),
        yhuSupabaseAdmin
            .from('yhu_academy_friend_requests')
            .select('request_id')
            .eq('sender_id', normalizedAuthorId)
            .eq('receiver_id', normalizedViewerId)
            .eq('status', 'pending')
            .limit(1)
    ]);

    if (outgoing.error) throw new Error(`Outgoing friend request lookup failed: ${outgoing.error.message}`);
    if (incoming.error) throw new Error(`Incoming friend request lookup failed: ${incoming.error.message}`);

    return {
        is_friend: false,
        outgoing_friend_request_pending: Array.isArray(outgoing.data) && outgoing.data.length > 0,
        incoming_friend_request_pending: Array.isArray(incoming.data) && incoming.data.length > 0,
        incoming_friend_request_id: sanitizeText(incoming.data?.[0]?.request_id)
    };
}

async function getLikeState(postId, viewerId) {
    const normalizedPostId = sanitizeText(postId);
    const normalizedViewerId = normalizeUserId(viewerId);

    if (!normalizedPostId || !normalizedViewerId) {
        return {
            liked_by_me: false,
            like_count: 0
        };
    }

    const [viewerLike, allLikes] = await Promise.all([
        yhuSupabaseAdmin
            .from('yhu_academy_feed_likes')
            .select('id')
            .eq('post_id', normalizedPostId)
            .eq('user_id', normalizedViewerId)
            .maybeSingle(),
        yhuSupabaseAdmin
            .from('yhu_academy_feed_likes')
            .select('id', { count: 'exact', head: true })
            .eq('post_id', normalizedPostId)
    ]);

    if (viewerLike.error) throw new Error(`Like state lookup failed: ${viewerLike.error.message}`);
    if (allLikes.error) throw new Error(`Like count lookup failed: ${allLikes.error.message}`);

    return {
        liked_by_me: Boolean(viewerLike.data),
        like_count: allLikes.count || 0
    };
}

async function getCommentCount(postId) {
    const normalizedPostId = sanitizeText(postId);
    if (!normalizedPostId) return 0;

    const { count, error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_comments')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', normalizedPostId)
        .eq('is_deleted', false);

    if (error) throw new Error(`Comment count lookup failed: ${error.message}`);
    return count || 0;
}

function mapPostRow(row = {}, extras = {}) {
    const author = row.author_snapshot && typeof row.author_snapshot === 'object' ? row.author_snapshot : {};
    const viewerId = sanitizeText(extras.viewerId);
    const authorId = sanitizeText(row.author_id);
    const hiddenForUserIds = mapArray(row.hidden_for_user_ids);

    const mediaUrl = sanitizeText(row.media_url || row.image_url || row.video_url);
    const mediaKindRaw = sanitizeText(row.media_kind).toLowerCase();
    const mediaKind =
        mediaKindRaw === 'video'
            ? 'video'
            : mediaUrl
                ? 'image'
                : '';

    const imageUrl = mediaKind === 'image'
        ? sanitizeText(row.image_url || row.media_url)
        : '';

    const videoUrl = mediaKind === 'video'
        ? sanitizeText(row.video_url || row.media_url)
        : '';

    const ownedByMe = authorId === viewerId;

    return {
        id: sanitizeText(row.post_id),
        user_id: authorId,
        body: sanitizeText(row.body),
        image_url: imageUrl,
        video_url: videoUrl,
        media_url: mediaUrl,
        media_kind: mediaKind,
        media_type: sanitizeText(row.media_type),
        media_size: toInt(row.media_size, 0),
        visibility: sanitizeText(row.visibility || 'academy'),
        feedScope: sanitizeText(row.feed_scope || 'global'),
        feed_scope: sanitizeText(row.feed_scope || 'global'),
        nicheKey: sanitizeText(row.niche_key),
        niche_key: sanitizeText(row.niche_key),
        nicheLabel: sanitizeText(row.niche_label),
        niche_label: sanitizeText(row.niche_label),
        audience: sanitizeText(row.audience || row.visibility || 'academy'),
        is_pinned: toBool(row.is_pinned),
        is_deleted: toBool(row.is_deleted),
        hidden_by_me: viewerId ? hiddenForUserIds.includes(viewerId) : false,
        created_at: row.created_at_source || '',
        updated_at: row.updated_at_source || '',
        edited_at: row.edited_at_source || '',
        fullName: sanitizeText(author.fullName || author.full_name || author.displayName || author.display_name),
        display_name: sanitizeText(author.displayName || author.display_name || author.fullName || author.full_name || 'Academy Member'),
        username: sanitizeText(author.username),
        avatar: sanitizeText(author.avatar),
        role_label: sanitizeText(author.roleLabel || author.role_label || 'Academy Member'),
        share: row.share || null,
        like_count: toInt(extras.like_count, 0),
        comment_count: toInt(extras.comment_count, 0),
        liked_by_me: toBool(extras.liked_by_me),
        owned_by_me: ownedByMe,
        can_edit: ownedByMe,
        can_delete: ownedByMe,
        can_hide: Boolean(viewerId),
        following_author: toBool(extras.following_author),
        is_friend: toBool(extras.is_friend),
        outgoing_friend_request_pending:
            toBool(
                extras.outgoing_friend_request_pending
            ),
        incoming_friend_request_pending:
            toBool(
                extras.incoming_friend_request_pending
            ),
        incoming_friend_request_id:
            sanitizeText(
                extras.incoming_friend_request_id
            )
    };
}

function mapCommentRow(row = {}, extras = {}) {
    const snapshot = row.author_snapshot && typeof row.author_snapshot === 'object' ? row.author_snapshot : {};
    const fallback = extras.authorFallback && typeof extras.authorFallback === 'object' ? extras.authorFallback : {};

    const viewerId = sanitizeText(extras.viewerId);
    const postOwnerId = sanitizeText(extras.postOwnerId);
    const authorId = sanitizeText(row.author_id);
    const hiddenForUserIds = mapArray(row.hidden_for_user_ids);

    const fullName =
        sanitizeText(snapshot.fullName || snapshot.name) ||
        sanitizeText(fallback.fullName || fallback.name);

    const displayName =
        sanitizeText(snapshot.displayName || snapshot.display_name) ||
        fullName ||
        sanitizeText(fallback.displayName || fallback.display_name || fallback.username) ||
        'Academy Member';

    const username = sanitizeText(snapshot.username || fallback.username);

    const avatar =
        sanitizeText(snapshot.avatar || snapshot.avatarUrl || snapshot.profilePhoto || snapshot.photoURL) ||
        sanitizeText(fallback.avatar || fallback.avatarUrl || fallback.profilePhoto || fallback.photoURL);

    const roleLabel =
        sanitizeText(snapshot.roleLabel || snapshot.role_label) ||
        sanitizeText(fallback.roleLabel || fallback.role_label || fallback.role) ||
        'Academy Member';

    const ownedByMe = authorId === viewerId;
    const postOwnedByMe = postOwnerId === viewerId;

    return {
        id: sanitizeText(row.comment_id),
        post_id: sanitizeText(row.post_id || extras.postId),
        user_id: authorId,
        body: sanitizeText(row.body),
        parent_comment_id: sanitizeText(row.parent_comment_id),
        root_comment_id: sanitizeText(row.root_comment_id || row.comment_id),
        depth: Math.max(0, toInt(row.depth, 0)),
        is_deleted: toBool(row.is_deleted),
        hidden_by_me: viewerId ? hiddenForUserIds.includes(viewerId) : false,
        created_at: row.created_at_source || '',
        updated_at: row.updated_at_source || '',
        edited_at: row.edited_at_source || '',
        fullName,
        display_name: displayName,
        username,
        avatar,
        avatarUrl: avatar,
        profilePhoto: avatar,
        photoURL: avatar,
        role_label: roleLabel,
        owned_by_me: ownedByMe,
        post_owned_by_me: postOwnedByMe,
        can_edit: ownedByMe,
        can_delete: ownedByMe || postOwnedByMe,
        can_hide: Boolean(viewerId)
    };
}

async function fetchPostRow(postId) {
    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_posts')
        .select('*')
        .eq('post_id', sanitizeText(postId))
        .maybeSingle();

    if (error) throw new Error(`Post lookup failed: ${error.message}`);
    return data || null;
}

async function fetchCommentRow(postId, commentId) {
    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_comments')
        .select('*')
        .eq('post_id', sanitizeText(postId))
        .eq('comment_id', sanitizeText(commentId))
        .maybeSingle();

    if (error) throw new Error(`Comment lookup failed: ${error.message}`);
    return data || null;
}

/* PATCH: Academy Community block propagation v3 */
let communityBlockedUserResolverV3 = null;

function setCommunityBlockedUserResolverV3(
    resolver = null
) {
    communityBlockedUserResolverV3 =
        typeof resolver === 'function'
            ? resolver
            : null;
}

async function getCommunityBlockedUserIdSetV3(
    viewerId = ''
) {
    const normalizedViewerId =
        normalizeUserId(viewerId);

    if (
        !normalizedViewerId ||
        typeof communityBlockedUserResolverV3 !==
            'function'
    ) {
        return new Set();
    }

    const result =
        await communityBlockedUserResolverV3(
            normalizedViewerId
        );

    const values =
        result instanceof Set
            ? [...result]
            : Array.isArray(result)
                ? result
                : [];

    return new Set(
        values
            .map(normalizeUserId)
            .filter(Boolean)
    );
}

async function assertCommunityInteractionAllowedV3(
    viewerId = '',
    targetUserId = '',
    {
        notFoundMessage =
            'Community content is not available.'
    } = {}
) {
    const normalizedViewerId =
        normalizeUserId(viewerId);

    const normalizedTargetUserId =
        normalizeUserId(targetUserId);

    if (
        !normalizedViewerId ||
        !normalizedTargetUserId ||
        normalizedViewerId ===
            normalizedTargetUserId
    ) {
        return true;
    }

    const blockedUserIds =
        await getCommunityBlockedUserIdSetV3(
            normalizedViewerId
        );

    if (
        blockedUserIds.has(
            normalizedTargetUserId
        )
    ) {
        throw communityHttpErrorV2(
            notFoundMessage,
            404
        );
    }

    return true;
}
/* END PATCH: Academy Community block propagation v3 */

/* PATCH: Academy Community verified media and share integrity v4 */
let communityMediaReceiptVerifierV4 = null;

function setCommunityMediaReceiptVerifierV4(
    resolver = null
) {
    communityMediaReceiptVerifierV4 =
        typeof resolver === 'function'
            ? resolver
            : null;
}

async function verifyCommunityMediaReceiptV4(
    receipt = '',
    viewerId = ''
) {
    const cleanReceipt =
        sanitizeText(receipt);

    const normalizedViewerId =
        normalizeUserId(viewerId);

    if (!cleanReceipt) {
        return null;
    }

    if (
        typeof communityMediaReceiptVerifierV4 !==
        'function'
    ) {
        throw communityHttpErrorV2(
            'Academy media verification is unavailable.',
            503
        );
    }

    const media =
        await communityMediaReceiptVerifierV4(
            cleanReceipt,
            normalizedViewerId
        );

    const url =
        sanitizeText(
            media?.url
        );

    const kind =
        sanitizeText(
            media?.kind
        ).toLowerCase();

    const mimeType =
        sanitizeText(
            media?.mimeType
        ).toLowerCase();

    const sizeBytes =
        Math.max(
            0,
            toInt(
                media?.sizeBytes,
                0
            )
        );

    if (
        !url.startsWith(
            '/uploads/academy-feed/'
        ) ||
        ![
            'image',
            'video'
        ].includes(kind) ||
        !mimeType.startsWith(
            `${kind}/`
        ) ||
        !sizeBytes
    ) {
        throw communityHttpErrorV2(
            'Invalid Academy media receipt.',
            400
        );
    }

    return {
        url,
        kind,
        mimeType,
        sizeBytes,

        receiptVersion:
            toInt(
                media?.receiptVersion,
                1
            )
    };
}

async function assertCommunityPostVisibleToViewerV4(
    row = null,
    viewerId = '',
    context = {}
) {
    const normalizedViewerId =
        normalizeUserId(viewerId);

    if (
        !row ||
        toBool(
            row.is_deleted
        )
    ) {
        throw communityHttpErrorV2(
            'Post not found.',
            404
        );
    }

    const authorId =
        normalizeUserId(
            row.author_id
        );

    if (
        authorId &&
        authorId ===
            normalizedViewerId
    ) {
        return true;
    }

    const hiddenForUserIds =
        mapArray(
            row.hidden_for_user_ids
        );

    if (
        normalizedViewerId &&
        hiddenForUserIds.includes(
            normalizedViewerId
        )
    ) {
        throw communityHttpErrorV2(
            'Post not found.',
            404
        );
    }

    const blockedUserIds =
        context.blockedUserIds instanceof Set
            ? context.blockedUserIds
            : await getCommunityBlockedUserIdSetV3(
                normalizedViewerId
            );

    if (
        authorId &&
        blockedUserIds.has(
            authorId
        )
    ) {
        throw communityHttpErrorV2(
            'Post not found.',
            404
        );
    }

    const feedScope =
        normalizeFeedScope(
            row.feed_scope
        );

    if (
        feedScope ===
        'global'
    ) {
        return true;
    }

    if (
        feedScope ===
        'niche'
    ) {
        const nicheKey =
            normalizeNicheKey(
                row.niche_key
            );

        const joinedNicheKeys =
            context.joinedNicheKeys instanceof Set
                ? context.joinedNicheKeys
                : await getCommunityMemberNicheKeySetV2(
                    normalizedViewerId
                );

        if (
            nicheKey &&
            joinedNicheKeys.has(
                nicheKey
            )
        ) {
            return true;
        }

        throw communityHttpErrorV2(
            'Post not found.',
            404
        );
    }

    const relationships =
        context.relationships &&
        typeof context.relationships ===
            'object'
            ? context.relationships
            : await loadViewerRelationshipSetsV2(
                normalizedViewerId
            );

    if (
        circleAudienceAllowsViewerV2(
            row,
            normalizedViewerId,
            relationships
        )
    ) {
        return true;
    }

    throw communityHttpErrorV2(
        'Post not found.',
        404
    );
}

function buildCanonicalCommunityShareSnapshotV4(
    sourceRow = {}
) {
    const author =
        sourceRow.author_snapshot &&
        typeof sourceRow.author_snapshot ===
            'object'
            ? sourceRow.author_snapshot
            : {};

    const mediaUrl =
        sanitizeText(
            sourceRow.media_url ||
            sourceRow.image_url ||
            sourceRow.video_url
        );

    const mediaKind =
        sanitizeText(
            sourceRow.media_kind
        ).toLowerCase() === 'video'
            ? 'video'
            : mediaUrl
                ? 'image'
                : '';

    return {
        version: 4,
        status: 'available',

        sourcePostId:
            sanitizeText(
                sourceRow.post_id
            ),

        sourceAuthorId:
            normalizeUserId(
                sourceRow.author_id
            ),

        author: {
            fullName:
                sanitizeText(
                    author.fullName ||
                    author.full_name ||
                    author.displayName ||
                    author.display_name
                ),

            displayName:
                sanitizeText(
                    author.displayName ||
                    author.display_name ||
                    author.fullName ||
                    author.full_name ||
                    'Academy Member'
                ),

            username:
                sanitizeText(
                    author.username
                ),

            avatar:
                sanitizeText(
                    author.avatar
                ),

            roleLabel:
                sanitizeText(
                    author.roleLabel ||
                    author.role_label ||
                    'Academy Member'
                )
        },

        body:
            sanitizeText(
                sourceRow.body
            ),

        media:
            mediaUrl
                ? {
                    url:
                        mediaUrl,

                    kind:
                        mediaKind,

                    mimeType:
                        sanitizeText(
                            sourceRow.media_type
                        ),

                    sizeBytes:
                        Math.max(
                            0,
                            toInt(
                                sourceRow.media_size,
                                0
                            )
                        )
                }
                : null,

        sourceFeedScope:
            normalizeFeedScope(
                sourceRow.feed_scope
            ),

        sourceNicheKey:
            normalizeNicheKey(
                sourceRow.niche_key
            ),

        sourceNicheLabel:
            sanitizeText(
                sourceRow.niche_label
            ),

        sourceAudience:
            sanitizeText(
                sourceRow.audience
            ).toLowerCase(),

        sourceCreatedAt:
            sourceRow.created_at_source ||
            ''
    };
}

async function resolveCanonicalCommunityShareV4({
    viewerId,
    sourcePostId,
    relationships = null,
    blockedUserIds = null,
    joinedNicheKeys = null
}) {
    const normalizedViewerId =
        normalizeUserId(viewerId);

    let normalizedSourcePostId =
        sanitizeText(sourcePostId);

    if (!normalizedSourcePostId) {
        throw communityHttpErrorV2(
            'Shared post source is required.',
            400
        );
    }

    let sourceRow =
        await fetchPostRow(
            normalizedSourcePostId
        );

    const nestedSourcePostId =
        sanitizeText(
            sourceRow?.share?.sourcePostId ||
            sourceRow?.data?.share?.sourcePostId
        );

    if (
        nestedSourcePostId &&
        nestedSourcePostId !==
            normalizedSourcePostId
    ) {
        normalizedSourcePostId =
            nestedSourcePostId;

        sourceRow =
            await fetchPostRow(
                normalizedSourcePostId
            );
    }

    await assertCommunityPostVisibleToViewerV4(
        sourceRow,
        normalizedViewerId,
        {
            relationships,
            blockedUserIds,
            joinedNicheKeys
        }
    );

    return {
        sourceRow,

        share:
            buildCanonicalCommunityShareSnapshotV4(
                sourceRow
            )
    };
}

async function hydrateCommunityShareSnapshotsV4(
    rows = [],
    viewerId = '',
    context = {}
) {
    const safeRows =
        Array.isArray(rows)
            ? rows
            : [];

    const sourcePostIds =
        Array.from(
            new Set(
                safeRows
                    .map((row) =>
                        sanitizeText(
                            row?.share?.sourcePostId ||
                            row?.data?.share?.sourcePostId
                        )
                    )
                    .filter(Boolean)
            )
        );

    const hydratedByPostId =
        new Map();

    if (!sourcePostIds.length) {
        return hydratedByPostId;
    }

    const {
        data,
        error
    } = await yhuSupabaseAdmin
        .from(
            'yhu_academy_feed_posts'
        )
        .select('*')
        .in(
            'post_id',
            sourcePostIds
        );

    if (error) {
        throw new Error(
            `Shared post lookup failed: ${error.message}`
        );
    }

    const sourceById =
        new Map(
            (
                Array.isArray(data)
                    ? data
                    : []
            ).map((row) => [
                sanitizeText(
                    row.post_id
                ),
                row
            ])
        );

    for (
        const row
        of safeRows
    ) {
        const postId =
            sanitizeText(
                row.post_id
            );

        const sourcePostId =
            sanitizeText(
                row?.share?.sourcePostId ||
                row?.data?.share?.sourcePostId
            );

        if (
            !postId ||
            !sourcePostId
        ) {
            continue;
        }

        const sourceRow =
            sourceById.get(
                sourcePostId
            );

        try {
            await assertCommunityPostVisibleToViewerV4(
                sourceRow,
                viewerId,
                context
            );

            hydratedByPostId.set(
                postId,
                buildCanonicalCommunityShareSnapshotV4(
                    sourceRow
                )
            );
        } catch (_) {
            hydratedByPostId.set(
                postId,
                {
                    version: 4,
                    status: 'unavailable',
                    unavailable: true,
                    sourcePostId
                }
            );
        }
    }

    return hydratedByPostId;
}
/* END PATCH: Academy Community verified media and share integrity v4 */

/* PATCH: Academy Community feed visibility and batching v2 */
async function getCommunityMemberNicheKeySetV2(
    userId = ''
) {
    const normalizedUserId =
        normalizeUserId(userId);

    if (!normalizedUserId) {
        return new Set();
    }

    const state =
        await getCommunityNicheState({
            viewerId:
                normalizedUserId
        });

    return new Set(
        (
            Array.isArray(
                state?.joinedNiches
            )
                ? state.joinedNiches
                : []
        )
            .map((item) =>
                normalizeNicheKey(
                    item?.key ||
                    item?.nicheKey ||
                    item
                )
            )
            .filter(Boolean)
    );
}

async function loadViewerRelationshipSetsV2(
    viewerId = ''
) {
    const normalizedViewerId =
        normalizeUserId(viewerId);

    if (!normalizedViewerId) {
        return {
            followingIds: new Set(),
            followerIds: new Set(),
            friendIds: new Set()
        };
    }

    const [
        followingIds,
        followerIds,
        friendIds
    ] = await Promise.all([
        getFollowingIdsForUser(
            normalizedViewerId
        ),
        getFollowerIdsForUser(
            normalizedViewerId
        ),
        getFriendIdsForUser(
            normalizedViewerId
        )
    ]);

    return {
        followingIds:
            new Set(followingIds),

        followerIds:
            new Set(followerIds),

        friendIds:
            new Set(friendIds)
    };
}

function circleRelationAllowsAuthorV2(
    relation = 'friends',
    authorId = '',
    viewerId = '',
    relationships = {}
) {
    const normalizedAuthorId =
        normalizeUserId(authorId);

    const normalizedViewerId =
        normalizeUserId(viewerId);

    if (
        !normalizedAuthorId ||
        !normalizedViewerId
    ) {
        return false;
    }

    if (
        normalizedAuthorId ===
        normalizedViewerId
    ) {
        return true;
    }

    const normalizedRelation =
        normalizeCircleRelation(
            relation
        );

    if (
        normalizedRelation ===
        'following'
    ) {
        return relationships
            .followingIds
            ?.has(
                normalizedAuthorId
            ) === true;
    }

    if (
        normalizedRelation ===
        'followers'
    ) {
        return relationships
            .followerIds
            ?.has(
                normalizedAuthorId
            ) === true;
    }

    return relationships
        .friendIds
        ?.has(
            normalizedAuthorId
        ) === true;
}

function circleAudienceAllowsViewerV2(
    row = {},
    viewerId = '',
    relationships = {}
) {
    const normalizedViewerId =
        normalizeUserId(viewerId);

    const authorId =
        normalizeUserId(
            row.author_id
        );

    if (
        !normalizedViewerId ||
        !authorId
    ) {
        return false;
    }

    if (
        authorId ===
        normalizedViewerId
    ) {
        return true;
    }

    const rawAudience =
        sanitizeText(
            row.audience
        ).toLowerCase();

    const audience =
        [
            'friends',
            'following',
            'followers'
        ].includes(
            rawAudience
        )
            ? rawAudience
            : 'friends';

    /*
     * Evaluated from the post author's perspective:
     * followers = viewer follows author
     * following = author follows viewer
     * friends = accepted friendship
     */
    if (
        audience ===
        'followers'
    ) {
        return relationships
            .followingIds
            ?.has(
                authorId
            ) === true;
    }

    if (
        audience ===
        'following'
    ) {
        return relationships
            .followerIds
            ?.has(
                authorId
            ) === true;
    }

    return relationships
        .friendIds
        ?.has(
            authorId
        ) === true;
}

async function loadPendingFriendRequestBatchV2(
    viewerId = '',
    authorIds = []
) {
    const normalizedViewerId =
        normalizeUserId(viewerId);

    const targets =
        Array.from(
            new Set(
                (
                    Array.isArray(authorIds)
                        ? authorIds
                        : []
                )
                    .map(normalizeUserId)
                    .filter(
                        (userId) =>
                            userId &&
                            userId !==
                            normalizedViewerId
                    )
            )
        );

    const outgoingByAuthor =
        new Set();

    const incomingByAuthor =
        new Map();

    if (
        !normalizedViewerId ||
        !targets.length
    ) {
        return {
            outgoingByAuthor,
            incomingByAuthor
        };
    }

    const [
        outgoingRows,
        incomingRows
    ] = await Promise.all([
        listCommunityRowsPagedV2(
            () =>
                yhuSupabaseAdmin
                    .from(
                        'yhu_academy_friend_requests'
                    )
                    .select(
                        'request_id,receiver_id'
                    )
                    .eq(
                        'sender_id',
                        normalizedViewerId
                    )
                    .eq(
                        'status',
                        'pending'
                    )
                    .in(
                        'receiver_id',
                        targets
                    ),
            {
                label:
                    'Outgoing friend requests',
                maxRows: 1000
            }
        ),

        listCommunityRowsPagedV2(
            () =>
                yhuSupabaseAdmin
                    .from(
                        'yhu_academy_friend_requests'
                    )
                    .select(
                        'request_id,sender_id'
                    )
                    .eq(
                        'receiver_id',
                        normalizedViewerId
                    )
                    .eq(
                        'status',
                        'pending'
                    )
                    .in(
                        'sender_id',
                        targets
                    ),
            {
                label:
                    'Incoming friend requests',
                maxRows: 1000
            }
        )
    ]);

    outgoingRows.forEach((row) => {
        const authorId =
            normalizeUserId(
                row.receiver_id
            );

        if (authorId) {
            outgoingByAuthor.add(
                authorId
            );
        }
    });

    incomingRows.forEach((row) => {
        const authorId =
            normalizeUserId(
                row.sender_id
            );

        if (authorId) {
            incomingByAuthor.set(
                authorId,
                sanitizeText(
                    row.request_id
                )
            );
        }
    });

    return {
        outgoingByAuthor,
        incomingByAuthor
    };
}

async function loadPostEngagementBatchV2(
    postIds = [],
    viewerId = '',
    blockedUserIds = new Set()
) {
    const normalizedViewerId =
        normalizeUserId(viewerId);

    const normalizedPostIds =
        Array.from(
            new Set(
                (
                    Array.isArray(postIds)
                        ? postIds
                        : []
                )
                    .map(sanitizeText)
                    .filter(Boolean)
            )
        );

    const likeCountByPost =
        new Map();

    const commentCountByPost =
        new Map();

    const likedPostIds =
        new Set();

    if (!normalizedPostIds.length) {
        return {
            likeCountByPost,
            commentCountByPost,
            likedPostIds
        };
    }

    const [
        likeRows,
        commentRows
    ] = await Promise.all([
        listCommunityRowsPagedV2(
            () =>
                yhuSupabaseAdmin
                    .from(
                        'yhu_academy_feed_likes'
                    )
                    .select(
                        'post_id,user_id'
                    )
                    .in(
                        'post_id',
                        normalizedPostIds
                    ),
            {
                label: 'Feed likes',
                maxRows: 50000
            }
        ),

        listCommunityRowsPagedV2(
            () =>
                yhuSupabaseAdmin
                    .from(
                        'yhu_academy_feed_comments'
                    )
                    .select(
                        'post_id,author_id,hidden_for_user_ids'
                    )
                    .in(
                        'post_id',
                        normalizedPostIds
                    )
                    .eq(
                        'is_deleted',
                        false
                    ),
            {
                label: 'Feed comments',
                maxRows: 50000
            }
        )
    ]);

    likeRows.forEach((row) => {
        const postId =
            sanitizeText(
                row.post_id
            );

        if (!postId) return;

        likeCountByPost.set(
            postId,
            (
                likeCountByPost.get(
                    postId
                ) || 0
            ) + 1
        );

        if (
            normalizedViewerId &&
            normalizeUserId(
                row.user_id
            ) ===
            normalizedViewerId
        ) {
            likedPostIds.add(
                postId
            );
        }
    });

    commentRows.forEach((row) => {
        const postId =
            sanitizeText(
                row.post_id
            );

        if (!postId) return;

        if (
            normalizedViewerId &&
            mapArray(
                row.hidden_for_user_ids
            ).includes(
                normalizedViewerId
            )
        ) {
            return;
        }

        const authorId =
            normalizeUserId(
                row.author_id
            );

        if (
            authorId &&
            authorId !==
                normalizedViewerId &&
            blockedUserIds instanceof Set &&
            blockedUserIds.has(
                authorId
            )
        ) {
            return;
        }

        commentCountByPost.set(
            postId,
            (
                commentCountByPost.get(
                    postId
                ) || 0
            ) + 1
        );
    });

    return {
        likeCountByPost,
        commentCountByPost,
        likedPostIds
    };
}
/* END PATCH: Academy Community feed visibility and batching v2 */

async function listFeed({
    viewerId,
    limit = 25,
    scope = 'global',
    nicheKey = '',
    relation = '',
    cursor = ''
}) {
    const normalizedViewerId =
        normalizeUserId(viewerId);

    if (!normalizedViewerId) {
        throw communityHttpErrorV2(
            'viewerId is required.',
            400
        );
    }

    const normalizedLimit =
        Math.max(
            1,
            Math.min(
                toInt(limit, 25),
                50
            )
        );

    const normalizedScope =
        normalizeFeedScope(scope);

    const normalizedNicheKey =
        normalizeNicheKey(nicheKey);

    const normalizedRelation =
        normalizeCircleRelation(relation);

    if (
        normalizedScope ===
        'niche'
    ) {
        if (
            !normalizedNicheKey ||
            !getNicheMeta(
                normalizedNicheKey
            )
        ) {
            throw communityHttpErrorV2(
                'Niche not found.',
                404
            );
        }

        const joinedNicheKeys =
            await getCommunityMemberNicheKeySetV2(
                normalizedViewerId
            );

        if (
            !joinedNicheKeys.has(
                normalizedNicheKey
            )
        ) {
            throw communityHttpErrorV2(
                'Join this niche before viewing its feed.',
                403
            );
        }
    }

    const [
        relationships,
        blockedUserIds,
        joinedNicheKeys
    ] = await Promise.all([
        loadViewerRelationshipSetsV2(
            normalizedViewerId
        ),

        getCommunityBlockedUserIdSetV3(
            normalizedViewerId
        ),

        getCommunityMemberNicheKeySetV2(
            normalizedViewerId
        )
    ]);

    const decodedCursor =
        decodeCommunityFeedCursorV2(
            cursor
        );

    if (decodedCursor) {
        const cursorScope =
            normalizeFeedScope(
                decodedCursor.scope
            );

        const cursorNicheKey =
            normalizeNicheKey(
                decodedCursor.nicheKey
            );

        const cursorRelation =
            normalizeCircleRelation(
                decodedCursor.relation
            );

        if (
            cursorScope !== normalizedScope ||
            (
                normalizedScope === 'niche' &&
                cursorNicheKey !==
                normalizedNicheKey
            ) ||
            (
                normalizedScope === 'circle' &&
                cursorRelation !==
                normalizedRelation
            )
        ) {
            throw communityHttpErrorV2(
                'Academy feed cursor does not match the active feed.',
                400
            );
        }
    }

    let scanOffset =
        Math.max(
            0,
            toInt(
                decodedCursor?.offset,
                0
            )
        );

    const pageBatchSize = 100;
    const maxScanRows = 5000;

    let scannedRows = 0;
    let nextOffset = scanOffset;
    let hasMore = false;

    const selectedRows = [];

    feedScan:
    while (
        scannedRows <
        maxScanRows
    ) {
        let query =
            yhuSupabaseAdmin
                .from(
                    'yhu_academy_feed_posts'
                )
                .select('*')
                .eq(
                    'is_deleted',
                    false
                )
                .order(
                    'created_at_source',
                    {
                        ascending: false,
                        nullsFirst: false
                    }
                )
                .order(
                    'post_id',
                    {
                        ascending: false
                    }
                );

        if (
            normalizedScope === 'niche'
        ) {
            query =
                query
                    .eq(
                        'feed_scope',
                        'niche'
                    )
                    .eq(
                        'niche_key',
                        normalizedNicheKey
                    );
        } else if (
            normalizedScope === 'circle'
        ) {
            query =
                query.eq(
                    'feed_scope',
                    'circle'
                );
        } else {
            query =
                query.eq(
                    'feed_scope',
                    'global'
                );
        }

        const {
            data,
            error
        } = await query.range(
            scanOffset,
            scanOffset +
                pageBatchSize -
                1
        );

        if (error) {
            throw new Error(
                `Academy feed lookup failed: ${error.message}`
            );
        }

        const batch =
            Array.isArray(data)
                ? data
                : [];

        if (!batch.length) {
            nextOffset =
                scanOffset;

            break;
        }

        for (
            let index = 0;
            index < batch.length;
            index += 1
        ) {
            const row =
                batch[index];

            const rawOffset =
                scanOffset +
                index;

            scannedRows += 1;

            const hidden =
                mapArray(
                    row.hidden_for_user_ids
                );

            if (
                hidden.includes(
                    normalizedViewerId
                )
            ) {
                nextOffset =
                    rawOffset + 1;

                continue;
            }

            const authorId =
                normalizeUserId(
                    row.author_id
                );

            if (
                authorId !==
                    normalizedViewerId &&
                blockedUserIds.has(
                    authorId
                )
            ) {
                nextOffset =
                    rawOffset + 1;

                continue;
            }

            if (
                normalizedScope ===
                'circle'
            ) {
                if (
                    !circleRelationAllowsAuthorV2(
                        normalizedRelation,
                        authorId,
                        normalizedViewerId,
                        relationships
                    ) ||
                    !circleAudienceAllowsViewerV2(
                        row,
                        normalizedViewerId,
                        relationships
                    )
                ) {
                    nextOffset =
                        rawOffset + 1;

                    continue;
                }
            }

            if (
                selectedRows.length >=
                normalizedLimit
            ) {
                hasMore = true;
                nextOffset = rawOffset;
                break feedScan;
            }

            selectedRows.push(row);
            nextOffset = rawOffset + 1;
        }

        if (
            batch.length <
            pageBatchSize
        ) {
            break;
        }

        scanOffset +=
            batch.length;
    }

    if (
        !hasMore &&
        scannedRows >= maxScanRows
    ) {
        hasMore = true;
    }

    const postIds =
        selectedRows
            .map((row) =>
                sanitizeText(
                    row.post_id
                )
            )
            .filter(Boolean);

    const authorIds =
        selectedRows
            .map((row) =>
                normalizeUserId(
                    row.author_id
                )
            )
            .filter(Boolean);

    const [
        engagement,
        pendingRequests,
        hydratedShares
    ] = await Promise.all([
        loadPostEngagementBatchV2(
            postIds,
            normalizedViewerId,
            blockedUserIds
        ),

        loadPendingFriendRequestBatchV2(
            normalizedViewerId,
            authorIds
        ),

        hydrateCommunityShareSnapshotsV4(
            selectedRows,
            normalizedViewerId,
            {
                relationships,
                blockedUserIds,
                joinedNicheKeys
            }
        )
    ]);

    const posts =
        selectedRows.map((row) => {
            const postId =
                sanitizeText(
                    row.post_id
                );

            const authorId =
                normalizeUserId(
                    row.author_id
                );

            const hydratedRow =
                hydratedShares.has(
                    postId
                )
                    ? {
                        ...row,

                        share:
                            hydratedShares.get(
                                postId
                            )
                    }
                    : row;

            return mapPostRow(
                hydratedRow,
                {
                    viewerId:
                        normalizedViewerId,

                    like_count:
                        engagement
                            .likeCountByPost
                            .get(postId) || 0,

                    comment_count:
                        engagement
                            .commentCountByPost
                            .get(postId) || 0,

                    liked_by_me:
                        engagement
                            .likedPostIds
                            .has(postId),

                    is_friend:
                        relationships
                            .friendIds
                            .has(authorId),

                    following_author:
                        relationships
                            .followingIds
                            .has(authorId),

                    outgoing_friend_request_pending:
                        pendingRequests
                            .outgoingByAuthor
                            .has(authorId),

                    incoming_friend_request_pending:
                        pendingRequests
                            .incomingByAuthor
                            .has(authorId),

                    incoming_friend_request_id:
                        pendingRequests
                            .incomingByAuthor
                            .get(authorId) || ''
                }
            );
        });

    return {
        posts,

        nextCursor:
            hasMore
                ? encodeCommunityFeedCursorV2({
                    version: 2,
                    offset: nextOffset,
                    scope: normalizedScope,
                    nicheKey:
                        normalizedNicheKey,
                    relation:
                        normalizedRelation
                })
                : '',

        hasMore,

        pageInfo: {
            version:
                'academy-community-feed-v4',

            limit:
                normalizedLimit,

            returned:
                posts.length,

            scanned:
                scannedRows,

            scope:
                normalizedScope,

            nicheKey:
                normalizedNicheKey,

            relation:
                normalizedRelation
        }
    };
}

async function createPost({
    viewer,
    body,
    mediaReceipt = '',
    visibility = 'academy',
    feedScope = 'global',
    nicheKey = '',
    nicheLabel = '',
    audience = '',
    share = null
}) {
    const viewerProfile =
        await getViewerProfile(
            viewer
        );

    const cleanBody =
        sanitizeText(body);

    const requestedShareSourcePostId =
        sanitizeText(
            share?.sourcePostId ||
            share?.source_post_id ||
            ''
        );

    let normalizedFeedScope =
        normalizeFeedScope(
            feedScope
        );

    let normalizedNicheKey =
        normalizedFeedScope === 'niche'
            ? normalizeNicheKey(
                nicheKey
            )
            : '';

    let normalizedNicheLabel =
        sanitizeText(
            nicheLabel
        );

    let normalizedAudience =
        normalizedFeedScope === 'circle'
            ? normalizeCircleRelation(
                audience
            )
            : normalizedFeedScope === 'niche'
                ? 'niche'
                : 'global';

    let canonicalShare =
        null;

    if (requestedShareSourcePostId) {
        const [
            relationships,
            blockedUserIds,
            joinedNicheKeys
        ] = await Promise.all([
            loadViewerRelationshipSetsV2(
                viewerProfile.id
            ),

            getCommunityBlockedUserIdSetV3(
                viewerProfile.id
            ),

            getCommunityMemberNicheKeySetV2(
                viewerProfile.id
            )
        ]);

        const resolvedShare =
            await resolveCanonicalCommunityShareV4({
                viewerId:
                    viewerProfile.id,

                sourcePostId:
                    requestedShareSourcePostId,

                relationships,
                blockedUserIds,
                joinedNicheKeys
            });

        canonicalShare =
            resolvedShare.share;

        const sourceRow =
            resolvedShare.sourceRow;

        /*
         * A share inherits the original audience.
         * The client cannot widen a Circle or Niche
         * post into the Global Community.
         */
        normalizedFeedScope =
            normalizeFeedScope(
                sourceRow.feed_scope
            );

        normalizedNicheKey =
            normalizedFeedScope === 'niche'
                ? normalizeNicheKey(
                    sourceRow.niche_key
                )
                : '';

        normalizedNicheLabel =
            normalizedFeedScope === 'niche'
                ? sanitizeText(
                    sourceRow.niche_label
                )
                : '';

        normalizedAudience =
            normalizedFeedScope === 'circle'
                ? normalizeCircleRelation(
                    sourceRow.audience
                )
                : normalizedFeedScope === 'niche'
                    ? 'niche'
                    : 'global';
    }

    const nicheMeta =
        normalizedNicheKey
            ? getNicheMeta(
                normalizedNicheKey
            )
            : null;

    if (
        normalizedFeedScope === 'niche' &&
        !nicheMeta
    ) {
        throw communityHttpErrorV2(
            'Niche not found.',
            404
        );
    }

    if (
        normalizedFeedScope === 'niche'
    ) {
        const joinedNicheKeys =
            await getCommunityMemberNicheKeySetV2(
                viewerProfile.id
            );

        if (
            !joinedNicheKeys.has(
                normalizedNicheKey
            )
        ) {
            throw communityHttpErrorV2(
                'Join this niche before posting to it.',
                403
            );
        }
    }

    const canonicalMedia =
        canonicalShare
            ? null
            : await verifyCommunityMediaReceiptV4(
                mediaReceipt,
                viewerProfile.id
            );

    if (
        !cleanBody &&
        !canonicalMedia &&
        !canonicalShare
    ) {
        throw communityHttpErrorV2(
            'Write something, attach verified media, or share a post.',
            400
        );
    }

    const postId =
        buildId('post');

    const now =
        nowIso();

    const cleanMediaUrl =
        sanitizeText(
            canonicalMedia?.url
        );

    const cleanMediaKind =
        sanitizeText(
            canonicalMedia?.kind
        ).toLowerCase();

    const cleanMediaType =
        sanitizeText(
            canonicalMedia?.mimeType
        );

    const cleanMediaSize =
        Math.max(
            0,
            toInt(
                canonicalMedia?.sizeBytes,
                0
            )
        );

    const authorSnapshot =
        buildAuthorSnapshot(
            viewerProfile,
            viewer
        );

    const cleanVisibility =
        sanitizeText(
            visibility ||
            'academy'
        ) ||
        'academy';

    const row = {
        firebase_app:
            'supabase',

        post_id:
            postId,

        source_document_path:
            `academyFeedPosts/${postId}`,

        author_id:
            viewerProfile.id,

        body:
            cleanBody,

        image_url:
            cleanMediaKind === 'image'
                ? cleanMediaUrl
                : '',

        video_url:
            cleanMediaKind === 'video'
                ? cleanMediaUrl
                : '',

        media_url:
            cleanMediaUrl,

        media_kind:
            cleanMediaKind,

        media_type:
            cleanMediaType,

        media_size:
            cleanMediaSize,

        visibility:
            cleanVisibility,

        feed_scope:
            normalizedFeedScope,

        niche_key:
            normalizedNicheKey,

        niche_label:
            normalizedNicheLabel ||
            nicheMeta?.label ||
            '',

        audience:
            normalizedAudience,

        is_pinned: false,
        is_deleted: false,
        hidden_for_user_ids: [],

        author_snapshot:
            authorSnapshot,

        share:
            canonicalShare,

        created_at_source: now,
        updated_at_source: now,
        edited_at_source: null,
        deleted_at_source: null,

        data: {
            body:
                cleanBody,

            authorId:
                viewerProfile.id,

            authorSnapshot,

            mediaUrl:
                cleanMediaUrl,

            imageUrl:
                cleanMediaKind === 'image'
                    ? cleanMediaUrl
                    : '',

            videoUrl:
                cleanMediaKind === 'video'
                    ? cleanMediaUrl
                    : '',

            mediaKind:
                cleanMediaKind,

            mediaType:
                cleanMediaType,

            mediaSize:
                cleanMediaSize,

            visibility:
                cleanVisibility,

            feedScope:
                normalizedFeedScope,

            nicheKey:
                normalizedNicheKey,

            nicheLabel:
                normalizedNicheLabel ||
                nicheMeta?.label ||
                '',

            audience:
                normalizedAudience,

            share:
                canonicalShare,

            createdAt: now,
            updatedAt: now
        }
    };

    const {
        data,
        error
    } = await yhuSupabaseAdmin
        .from(
            'yhu_academy_feed_posts'
        )
        .insert(row)
        .select('*')
        .single();

    if (error) {
        throw new Error(
            `Post create failed: ${error.message}`
        );
    }

    return mapPostRow(
        data,
        {
            viewerId:
                viewerProfile.id,
            like_count: 0,
            comment_count: 0,
            liked_by_me: false
        }
    );
}

async function updatePost({ viewerId, postId, body }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);
    const cleanBody = sanitizeText(body);

    if (!normalizedPostId) throw new Error('postId is required.');
    if (!cleanBody) throw new Error('Post body is required.');

    const row = await fetchPostRow(normalizedPostId);
    if (!row || toBool(row.is_deleted)) throw new Error('Post not found.');
    if (sanitizeText(row.author_id) !== normalizedViewerId) throw new Error('You can only edit your own post.');

    const now = nowIso();
    const nextData = {
        ...(row.data || {}),
        body: cleanBody,
        updatedAt: now,
        editedAt: now
    };

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_posts')
        .update({
            body: cleanBody,
            updated_at_source: now,
            edited_at_source: now,
            data: nextData,
            updated_at: now
        })
        .eq('post_id', normalizedPostId)
        .select('*')
        .single();

    if (error) throw new Error(`Post update failed: ${error.message}`);

    const [likeState, commentCount] = await Promise.all([
        getLikeState(normalizedPostId, normalizedViewerId),
        getCommentCount(normalizedPostId)
    ]);

    return mapPostRow(data, {
        viewerId: normalizedViewerId,
        ...likeState,
        comment_count: commentCount
    });
}

async function hidePostForViewer({ viewerId, postId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);

    if (!normalizedViewerId) throw new Error('viewerId is required.');
    if (!normalizedPostId) throw new Error('postId is required.');

    const row = await fetchPostRow(normalizedPostId);
    if (!row || toBool(row.is_deleted)) throw new Error('Post not found.');

    await assertCommunityPostVisibleToViewerV4(
        row,
        normalizedViewerId
    );

    const hidden = Array.from(new Set([...mapArray(row.hidden_for_user_ids), normalizedViewerId]));
    const now = nowIso();

    const { error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_posts')
        .update({
            hidden_for_user_ids: hidden,
            updated_at_source: now,
            updated_at: now,
            data: {
                ...(row.data || {}),
                hiddenForUserIds: hidden,
                updatedAt: now
            }
        })
        .eq('post_id', normalizedPostId);

    if (error) throw new Error(`Post hide failed: ${error.message}`);

    return {
        id: normalizedPostId,
        hidden: true
    };
}

async function deletePost({ viewerId, postId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);

    if (!normalizedPostId) throw new Error('postId is required.');

    const row = await fetchPostRow(normalizedPostId);
    if (!row || toBool(row.is_deleted)) throw new Error('Post not found.');
    if (sanitizeText(row.author_id) !== normalizedViewerId) throw new Error('You can only delete your own post.');

    const now = nowIso();

    const { error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_posts')
        .update({
            is_deleted: true,
            deleted_at_source: now,
            updated_at_source: now,
            updated_at: now,
            data: {
                ...(row.data || {}),
                isDeleted: true,
                deletedAt: now,
                updatedAt: now
            }
        })
        .eq('post_id', normalizedPostId);

    if (error) throw new Error(`Post delete failed: ${error.message}`);

    return {
        id: normalizedPostId,
        deleted: true
    };
}

async function togglePostLike({
    viewerId,
    postId,
    liked = null
}) {
    const normalizedViewerId =
        normalizeUserId(
            viewerId
        );

    const normalizedPostId =
        sanitizeText(
            postId
        );

    if (!normalizedViewerId) {
        throw communityHttpErrorV2(
            'viewerId is required.',
            400
        );
    }

    if (!normalizedPostId) {
        throw communityHttpErrorV2(
            'postId is required.',
            400
        );
    }

    const row =
        await fetchPostRow(
            normalizedPostId
        );

    if (
        !row ||
        toBool(
            row.is_deleted
        )
    ) {
        throw communityHttpErrorV2(
            'Post not found.',
            404
        );
    }

    await assertCommunityPostVisibleToViewerV4(
        row,
        normalizedViewerId
    );

    const existing =
        await yhuSupabaseAdmin
            .from(
                'yhu_academy_feed_likes'
            )
            .select('id')
            .eq(
                'post_id',
                normalizedPostId
            )
            .eq(
                'user_id',
                normalizedViewerId
            )
            .maybeSingle();

    if (existing.error) {
        throw new Error(
            `Like lookup failed: ${existing.error.message}`
        );
    }

    const wasLiked =
        Boolean(
            existing.data
        );

    const desiredLikedState =
        typeof liked === 'boolean'
            ? liked
            : !wasLiked;

    if (desiredLikedState) {
        const now =
            nowIso();

        const sourceDocumentPath =
            `academyFeedPosts/${normalizedPostId}/likes/${normalizedViewerId}`;

        const { error } =
            await yhuSupabaseAdmin
                .from(
                    'yhu_academy_feed_likes'
                )
                .upsert(
                    {
                        firebase_app:
                            'supabase',

                        post_id:
                            normalizedPostId,

                        user_id:
                            normalizedViewerId,

                        source_document_path:
                            sourceDocumentPath,

                        created_at_source:
                            now,

                        data: {
                            userId:
                                normalizedViewerId,
                            postId:
                                normalizedPostId,
                            createdAt:
                                now
                        }
                    },
                    {
                        onConflict:
                            'source_document_path'
                    }
                );

        if (error) {
            throw new Error(
                `Like failed: ${error.message}`
            );
        }
    } else {
        const { error } =
            await yhuSupabaseAdmin
                .from(
                    'yhu_academy_feed_likes'
                )
                .delete()
                .eq(
                    'post_id',
                    normalizedPostId
                )
                .eq(
                    'user_id',
                    normalizedViewerId
                );

        if (error) {
            throw new Error(
                `Unlike failed: ${error.message}`
            );
        }
    }

    const likeState =
        await getLikeState(
            normalizedPostId,
            normalizedViewerId
        );

    return {
        liked:
            likeState.liked_by_me,

        liked_by_me:
            likeState.liked_by_me,

        like_count:
            likeState.like_count,

        notificationContext: {
            postId:
                normalizedPostId,

            postOwnerId:
                normalizeUserId(
                    row.author_id
                ),

            postPreview:
                buildSearchPostPreview(
                    row.body,
                    120
                ),

            likeCreated:
                desiredLikedState &&
                !wasLiked
        }
    };
}

async function listPostComments({ viewerId, postId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);

    if (!normalizedPostId) throw new Error('postId is required.');

    const post =
        await fetchPostRow(
            normalizedPostId
        );

    if (
        !post ||
        toBool(
            post.is_deleted
        )
    ) {
        throw communityHttpErrorV2(
            'Post not found.',
            404
        );
    }

    const blockedUserIds =
        await getCommunityBlockedUserIdSetV3(
            normalizedViewerId
        );

    await assertCommunityPostVisibleToViewerV4(
        post,
        normalizedViewerId,
        {
            blockedUserIds
        }
    );

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_comments')
        .select('*')
        .eq('post_id', normalizedPostId)
        .eq('is_deleted', false)
        .order('created_at_source', { ascending: true, nullsFirst: false })
        .limit(300);

    if (error) throw new Error(`Comments lookup failed: ${error.message}`);

    const visibleRows =
        (
            Array.isArray(data)
                ? data
                : []
        ).filter((row) => {
            if (
                normalizedViewerId &&
                mapArray(
                    row.hidden_for_user_ids
                ).includes(
                    normalizedViewerId
                )
            ) {
                return false;
            }

            const authorId =
                normalizeUserId(
                    row.author_id
                );

            return (
                !authorId ||
                authorId ===
                    normalizedViewerId ||
                !blockedUserIds.has(
                    authorId
                )
            );
        });

    return visibleRows.map((row) => mapCommentRow(row, {
        viewerId: normalizedViewerId,
        postId: normalizedPostId,
        postOwnerId: post.author_id
    }));
}

async function createPostComment({ viewer, postId, body, parentCommentId = '' }) {
    const viewerProfile = await getViewerProfile(viewer);
    const normalizedPostId = sanitizeText(postId);
    const cleanBody = sanitizeText(body);
    const normalizedParentCommentId = sanitizeText(parentCommentId);

    if (!normalizedPostId) throw new Error('postId is required.');
    if (!cleanBody) throw new Error('Comment body is required.');

    const post =
        await fetchPostRow(
            normalizedPostId
        );

    if (
        !post ||
        toBool(
            post.is_deleted
        )
    ) {
        throw communityHttpErrorV2(
            'Post not found.',
            404
        );
    }

    await assertCommunityPostVisibleToViewerV4(
        post,
        viewerProfile.id
    );

    let parentData = null;
    let parentDepth = -1;
    let rootCommentId = '';

    if (normalizedParentCommentId) {
        parentData = await fetchCommentRow(normalizedPostId, normalizedParentCommentId);
        if (
            !parentData ||
            toBool(
                parentData.is_deleted
            )
        ) {
            throw communityHttpErrorV2(
                'Parent comment not found.',
                404
            );
        }

        await assertCommunityInteractionAllowedV3(
            viewerProfile.id,
            parentData.author_id,
            {
                notFoundMessage:
                    'Parent comment not found.'
            }
        );

        parentDepth = Math.max(0, toInt(parentData.depth, 0));
        rootCommentId = sanitizeText(parentData.root_comment_id || normalizedParentCommentId);
    }

    const commentId = buildId('comment');
    const depth = normalizedParentCommentId ? parentDepth + 1 : 0;
    const now = nowIso();
    const authorSnapshot = buildAuthorSnapshot(viewerProfile, viewer);

    if (!rootCommentId) rootCommentId = commentId;

    const row = {
        firebase_app: 'supabase',
        post_id: normalizedPostId,
        comment_id: commentId,
        source_document_path: `academyFeedPosts/${normalizedPostId}/comments/${commentId}`,
        author_id: viewerProfile.id,
        body: cleanBody,
        parent_comment_id: normalizedParentCommentId,
        root_comment_id: rootCommentId,
        depth,
        is_deleted: false,
        hidden_for_user_ids: [],
        author_snapshot: authorSnapshot,
        created_at_source: now,
        updated_at_source: now,
        edited_at_source: null,
        deleted_at_source: null,
        data: {
            postId: normalizedPostId,
            authorId: viewerProfile.id,
            body: cleanBody,
            parentCommentId: normalizedParentCommentId,
            rootCommentId,
            depth,
            authorSnapshot,
            createdAt: now,
            updatedAt: now
        }
    };

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_comments')
        .insert(row)
        .select('*')
        .single();

    if (error) throw new Error(`Comment create failed: ${error.message}`);

    return {
        comment:
            mapCommentRow(data, {
                viewerId:
                    viewerProfile.id,

                postId:
                    normalizedPostId,

                postOwnerId:
                    post.author_id
            }),

        notificationContext: {
            postId:
                normalizedPostId,

            postOwnerId:
                normalizeUserId(
                    post.author_id
                ),

            parentCommentId:
                normalizedParentCommentId,

            parentAuthorId:
                normalizeUserId(
                    parentData?.author_id
                ),

            postPreview:
                buildSearchPostPreview(
                    post.body,
                    120
                )
        }
    };
}

async function updatePostComment({ viewerId, postId, commentId, body }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);
    const normalizedCommentId = sanitizeText(commentId);
    const cleanBody = sanitizeText(body);

    if (!cleanBody) throw new Error('Comment body is required.');

    const [post, comment] = await Promise.all([
        fetchPostRow(normalizedPostId),
        fetchCommentRow(normalizedPostId, normalizedCommentId)
    ]);

    if (!post || toBool(post.is_deleted)) throw new Error('Post not found.');
    if (!comment || toBool(comment.is_deleted)) throw new Error('Comment not found.');
    if (sanitizeText(comment.author_id) !== normalizedViewerId) throw new Error('You can only edit your own comment.');

    await assertCommunityPostVisibleToViewerV4(
        post,
        normalizedViewerId
    );

    const now = nowIso();

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_comments')
        .update({
            body: cleanBody,
            updated_at_source: now,
            edited_at_source: now,
            updated_at: now,
            data: {
                ...(comment.data || {}),
                body: cleanBody,
                updatedAt: now,
                editedAt: now
            }
        })
        .eq('post_id', normalizedPostId)
        .eq('comment_id', normalizedCommentId)
        .select('*')
        .single();

    if (error) throw new Error(`Comment update failed: ${error.message}`);

    return mapCommentRow(data, {
        viewerId: normalizedViewerId,
        postId: normalizedPostId,
        postOwnerId: post.author_id
    });
}

async function deletePostComment({ viewerId, postId, commentId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);
    const normalizedCommentId = sanitizeText(commentId);

    const [post, comment] = await Promise.all([
        fetchPostRow(normalizedPostId),
        fetchCommentRow(normalizedPostId, normalizedCommentId)
    ]);

    if (!post || toBool(post.is_deleted)) throw new Error('Post not found.');
    if (!comment || toBool(comment.is_deleted)) throw new Error('Comment not found.');

    const commentOwner = sanitizeText(comment.author_id) === normalizedViewerId;
    const postOwner = sanitizeText(post.author_id) === normalizedViewerId;

    if (!commentOwner && !postOwner) {
        throw new Error('You can only delete your own comment.');
    }

    const now = nowIso();

    const { error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_comments')
        .update({
            is_deleted: true,
            deleted_at_source: now,
            updated_at_source: now,
            updated_at: now,
            data: {
                ...(comment.data || {}),
                isDeleted: true,
                deletedAt: now,
                updatedAt: now
            }
        })
        .eq('post_id', normalizedPostId)
        .eq('comment_id', normalizedCommentId);

    if (error) throw new Error(`Comment delete failed: ${error.message}`);

    return {
        id: normalizedCommentId,
        post_id: normalizedPostId,
        deleted: true
    };
}

async function hidePostCommentForViewer({ viewerId, postId, commentId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);
    const normalizedCommentId = sanitizeText(commentId);

    if (!normalizedViewerId) throw new Error('viewerId is required.');

    const [
        post,
        comment
    ] = await Promise.all([
        fetchPostRow(
            normalizedPostId
        ),

        fetchCommentRow(
            normalizedPostId,
            normalizedCommentId
        )
    ]);

    if (
        !post ||
        toBool(
            post.is_deleted
        )
    ) {
        throw communityHttpErrorV2(
            'Post not found.',
            404
        );
    }

    if (
        !comment ||
        toBool(
            comment.is_deleted
        )
    ) {
        throw communityHttpErrorV2(
            'Comment not found.',
            404
        );
    }

    await Promise.all([
        assertCommunityPostVisibleToViewerV4(
            post,
            normalizedViewerId
        ),

        assertCommunityInteractionAllowedV3(
            normalizedViewerId,
            comment.author_id,
            {
                notFoundMessage:
                    'Comment not found.'
            }
        )
    ]);

    const hidden = Array.from(new Set([...mapArray(comment.hidden_for_user_ids), normalizedViewerId]));
    const now = nowIso();

    const { error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_comments')
        .update({
            hidden_for_user_ids: hidden,
            updated_at_source: now,
            updated_at: now,
            data: {
                ...(comment.data || {}),
                hiddenForUserIds: hidden,
                updatedAt: now
            }
        })
        .eq('post_id', normalizedPostId)
        .eq('comment_id', normalizedCommentId);

    if (error) throw new Error(`Comment hide failed: ${error.message}`);

    return {
        id: normalizedCommentId,
        post_id: normalizedPostId,
        hidden: true
    };
}

async function listAcademyMembers({ viewerId, limit = 100, query = '' }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedLimit = Math.max(1, Math.min(toInt(limit, 100), 200));
    const normalizedQuery = sanitizeText(query).toLowerCase();
    const isHashtagQuery = normalizedQuery.startsWith('#') || normalizedQuery.startsWith('tag:');
    const hashtagNeedle = normalizedQuery.replace(/^tag:/, '').replace(/^#/, '').trim();

    const [
        followedUserIds,
        blockedUserIds
    ] = normalizedViewerId
        ? await Promise.all([
            getFollowingIdsForUser(
                normalizedViewerId
            ),

            getCommunityBlockedUserIdSetV3(
                normalizedViewerId
            )
        ])
        : [
            [],
            new Set()
        ];

    const followedIds =
        new Set(
            followedUserIds
        );

    if (isHashtagQuery && hashtagNeedle) {
        const { data, error } = await yhuSupabaseAdmin
            .from('yhu_academy_feed_posts')
            .select('*')
            .eq('is_deleted', false)
            .order('created_at_source', { ascending: false, nullsFirst: false })
            .limit(Math.max(normalizedLimit * 6, 120));

        if (error) throw new Error(`Member hashtag search failed: ${error.message}`);

        const matchedByUser = new Map();

        for (const row of Array.isArray(data) ? data : []) {
            const authorId = sanitizeText(row.author_id);
            if (
                !authorId ||
                authorId ===
                    normalizedViewerId ||
                blockedUserIds.has(
                    authorId
                )
            ) {
                continue;
            }

            const hashtags = extractHashtagsFromText(row.body);
            if (!hashtags.includes(hashtagNeedle)) continue;

            const author = row.author_snapshot && typeof row.author_snapshot === 'object'
                ? row.author_snapshot
                : {};

            const preview = buildSearchPostPreview(row.body);

            if (!matchedByUser.has(authorId)) {
                matchedByUser.set(authorId, {
                    id: authorId,
                    fullName: sanitizeText(author.fullName || author.displayName),
                    display_name: sanitizeText(author.displayName || author.fullName || author.username || 'Academy Member'),
                    username: sanitizeText(author.username),
                    avatar: sanitizeText(author.avatar),
                    role_label: sanitizeText(author.roleLabel || 'Academy Member'),
                    followers_count: 0,
                    followed_by_me: followedIds.has(authorId),
                    search_tags: hashtags.slice(0, 6),
                    matched_hashtags: hashtags.slice(0, 6),
                    matched_posts_count: 1,
                    matched_post_preview: preview,
                    matched_post_created_at: row.created_at_source || ''
                });
                continue;
            }

            const existing = matchedByUser.get(authorId);
            existing.matched_posts_count += 1;
            existing.matched_hashtags = Array.from(new Set([...(existing.matched_hashtags || []), ...hashtags])).slice(0, 6);
            if (!existing.matched_post_preview && preview) existing.matched_post_preview = preview;
            if (!existing.matched_post_created_at && row.created_at_source) existing.matched_post_created_at = row.created_at_source;
        }

        const members = await Promise.all(
            Array.from(matchedByUser.values()).map(async (member) => ({
                ...member,
                followers_count: await getAcademyFollowerCount(member.id)
            }))
        );

        return members
            .sort((a, b) => Number(b.matched_posts_count || 0) - Number(a.matched_posts_count || 0))
            .slice(0, normalizedLimit);
    }

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_member_profiles')
        .select('*')
        .limit(normalizedQuery ? 300 : normalizedLimit);

    if (error) throw new Error(`Academy members lookup failed: ${error.message}`);

    const members = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (row) => {
            const profile = mapProfileRow(row);
            const userId = sanitizeText(profile.id);

            if (
                !userId ||
                userId ===
                    normalizedViewerId ||
                blockedUserIds.has(
                    userId
                )
            ) {
                return null;
            }

            const member = {
                id: userId,
                fullName: profile.fullName,
                display_name: profile.display_name,
                username: profile.username,
                avatar: profile.avatar,
                role_label: profile.role_label || 'Academy Member',
                followers_count: await getAcademyFollowerCount(userId),
                followed_by_me: followedIds.has(userId),
                search_tags: profile.search_tags || [],
                matched_hashtags: [],
                matched_posts_count: 0,
                matched_post_preview: ''
            };

            if (!normalizedQuery) return member;

            const haystack = [
                member.display_name,
                member.fullName,
                member.username,
                member.role_label,
                member.search_tags.join(' ')
            ].map((value) => sanitizeText(value).toLowerCase()).join(' ');

            return haystack.includes(normalizedQuery) ? member : null;
        })
    );

    return members
        .filter(Boolean)
        .sort((a, b) => String(a.display_name || a.fullName || '').toLowerCase().localeCompare(String(b.display_name || b.fullName || '').toLowerCase()))
        .slice(0, normalizedLimit);
}

async function getMemberSocialCounts({ userId, viewerId = '' }) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedViewerId = normalizeUserId(viewerId);

    const [followersCount, followingCount, friendCount, mutualFriendCount, followingIds] = await Promise.all([
        getAcademyFollowerCount(normalizedUserId),
        getAcademyFollowingCount(normalizedUserId),
        getAcademyFriendCount(normalizedUserId),
        getMutualFriendCount(normalizedViewerId, normalizedUserId),
        normalizedViewerId ? getFollowingIdsForUser(normalizedViewerId) : Promise.resolve([])
    ]);

    return {
        id: normalizedUserId,
        followers_count: followersCount,
        following_count: followingCount,
        friend_count: friendCount,
        mutual_friend_count: mutualFriendCount,
        followed_by_me: followingIds.includes(normalizedUserId)
    };
}

async function getMemberProfile({ viewerId, targetUserId }) {
    const normalizedViewerId =
        normalizeUserId(
            viewerId
        );

    const normalizedTargetUserId =
        normalizeUserId(
            targetUserId
        );

    if (!normalizedTargetUserId) {
        throw communityHttpErrorV2(
            'targetUserId is required.',
            400
        );
    }

    await assertCommunityInteractionAllowedV3(
        normalizedViewerId,
        normalizedTargetUserId,
        {
            notFoundMessage:
                'Target member not found.'
        }
    );

    const profile =
        await getProfileOrFallback(
            normalizedTargetUserId
        );

    if (!profile) {
        throw communityHttpErrorV2(
            'Target member not found.',
            404
        );
    }

    const [followerCount, followingCount, friendCount, followedIds, friendshipState, mutualFriendCount, postsResult] = await Promise.all([
        getAcademyFollowerCount(normalizedTargetUserId),
        getAcademyFollowingCount(normalizedTargetUserId),
        getAcademyFriendCount(normalizedTargetUserId),
        normalizedViewerId ? getFollowingIdsForUser(normalizedViewerId) : Promise.resolve([]),
        getFriendshipState(normalizedViewerId, normalizedTargetUserId),
        getMutualFriendCount(normalizedViewerId, normalizedTargetUserId),
        yhuSupabaseAdmin
            .from('yhu_academy_feed_posts')
            .select('*')
            .eq('author_id', normalizedTargetUserId)
            .eq('is_deleted', false)
            .order('created_at_source', { ascending: false, nullsFirst: false })
            .limit(25)
    ]);

    if (postsResult.error) throw new Error(`Member recent posts lookup failed: ${postsResult.error.message}`);

    const recentPosts = (postsResult.data || []).map((row) => mapPostRow(row, {
        viewerId: normalizedViewerId
    }));

    return {
        id: normalizedTargetUserId,
        fullName: profile.fullName,
        display_name: profile.display_name,
        displayName: profile.displayName || profile.display_name,
        username: profile.username,
        avatar: profile.avatar,
        role_label: profile.role_label || 'Academy Member',
        roleLabel: profile.role_label || 'Academy Member',
        bio: profile.bio || 'Focused on execution, consistency, and long-term growth inside The Academy.',
        cover_photo: profile.cover_photo,
        search_tags: profile.search_tags || [],
        followers_count: followerCount,
        following_count: followingCount,
        friend_count: friendCount,
        followed_by_me: followedIds.includes(normalizedTargetUserId),
        mutual_friend_count: mutualFriendCount,
        recent_posts: recentPosts,
        ...friendshipState
    };
}

async function toggleMemberFollow({
    viewerId,
    targetUserId,
    following = null
}) {
    const normalizedViewerId =
        normalizeUserId(
            viewerId
        );

    const normalizedTargetUserId =
        normalizeUserId(
            targetUserId
        );

    if (!normalizedViewerId) {
        throw communityHttpErrorV2(
            'viewerId is required.',
            400
        );
    }

    if (!normalizedTargetUserId) {
        throw communityHttpErrorV2(
            'targetUserId is required.',
            400
        );
    }

    if (
        normalizedViewerId ===
        normalizedTargetUserId
    ) {
        throw communityHttpErrorV2(
            'You cannot follow yourself.',
            400
        );
    }

    await assertCommunityInteractionAllowedV3(
        normalizedViewerId,
        normalizedTargetUserId,
        {
            notFoundMessage:
                'Target member not found.'
        }
    );

    const targetProfile =
        await getProfileOrFallback(
            normalizedTargetUserId
        );

    if (!targetProfile) {
        throw communityHttpErrorV2(
            'Target member not found.',
            404
        );
    }

    const existing =
        await yhuSupabaseAdmin
            .from(
                'yhu_academy_user_follows'
            )
            .select('id')
            .eq(
                'follower_id',
                normalizedViewerId
            )
            .eq(
                'following_id',
                normalizedTargetUserId
            )
            .maybeSingle();

    if (existing.error) {
        throw new Error(
            `Follow lookup failed: ${existing.error.message}`
        );
    }

    const desiredFollowingState =
        typeof following === 'boolean'
            ? following
            : !Boolean(
                existing.data
            );

    if (desiredFollowingState) {
        const now =
            nowIso();

        const followId =
            followKeyFor(
                normalizedViewerId,
                normalizedTargetUserId
            );

        const { error } =
            await yhuSupabaseAdmin
                .from(
                    'yhu_academy_user_follows'
                )
                .upsert(
                    {
                        firebase_app:
                            'supabase',

                        source_collection_path:
                            'academyUserFollows',

                        follow_id:
                            followId,

                        source_document_path:
                            `academyUserFollows/${followId}`,

                        follower_id:
                            normalizedViewerId,

                        following_id:
                            normalizedTargetUserId,

                        created_at_source:
                            now,

                        data: {
                            followerId:
                                normalizedViewerId,
                            followingId:
                                normalizedTargetUserId,
                            createdAt:
                                now
                        }
                    },
                    {
                        onConflict:
                            'follow_id'
                    }
                );

        if (error) {
            throw new Error(
                `Follow failed: ${error.message}`
            );
        }
    } else {
        const { error } =
            await yhuSupabaseAdmin
                .from(
                    'yhu_academy_user_follows'
                )
                .delete()
                .eq(
                    'follower_id',
                    normalizedViewerId
                )
                .eq(
                    'following_id',
                    normalizedTargetUserId
                );

        if (error) {
            throw new Error(
                `Unfollow failed: ${error.message}`
            );
        }
    }

    const [
        followersCount,
        followingCount
    ] = await Promise.all([
        getAcademyFollowerCount(
            normalizedTargetUserId
        ),
        getAcademyFollowingCount(
            normalizedViewerId
        )
    ]);

    return {
        following:
            desiredFollowingState,

        followed_by_me:
            desiredFollowingState,

        targetUserId:
            normalizedTargetUserId,

        followers_count:
            followersCount,

        viewer_following_count:
            followingCount
    };
}

async function sendFriendRequest({
    senderId,
    receiverId
}) {
    const normalizedSenderId =
        normalizeUserId(
            senderId
        );

    const normalizedReceiverId =
        normalizeUserId(
            receiverId
        );

    if (!normalizedSenderId) {
        throw communityHttpErrorV2(
            'senderId is required.',
            400
        );
    }

    if (!normalizedReceiverId) {
        throw communityHttpErrorV2(
            'receiverId is required.',
            400
        );
    }

    if (
        normalizedSenderId ===
        normalizedReceiverId
    ) {
        throw communityHttpErrorV2(
            'You cannot send a friend request to yourself.',
            400
        );
    }

    await assertCommunityInteractionAllowedV3(
        normalizedSenderId,
        normalizedReceiverId,
        {
            notFoundMessage:
                'Target member not found.'
        }
    );

    const receiverProfile =
        await getProfileOrFallback(
            normalizedReceiverId
        );

    if (!receiverProfile) {
        throw communityHttpErrorV2(
            'Target member not found.',
            404
        );
    }

    const state =
        await getFriendshipState(
            normalizedSenderId,
            normalizedReceiverId
        );

    if (state.is_friend) {
        throw communityHttpErrorV2(
            'You are already friends.',
            409
        );
    }

    if (
        state
            .incoming_friend_request_pending
    ) {
        throw communityHttpErrorV2(
            'This member already sent you a friend request.',
            409
        );
    }

    if (
        state
            .outgoing_friend_request_pending
    ) {
        throw communityHttpErrorV2(
            'Friend request already sent.',
            409
        );
    }

    const pairKey =
        friendshipKeyFor(
            normalizedSenderId,
            normalizedReceiverId
        );

    const requestId =
        `friendreq_${pairKey}`;

    const sourceDocumentPath =
        `academyFriendRequests/pairs/${pairKey}`;

    const now =
        nowIso();

    const row = {
        firebase_app:
            'supabase',

        request_id:
            requestId,

        source_document_path:
            sourceDocumentPath,

        sender_id:
            normalizedSenderId,

        receiver_id:
            normalizedReceiverId,

        status:
            'pending',

        created_at_source:
            now,

        responded_at_source:
            null,

        data: {
            senderId:
                normalizedSenderId,
            receiverId:
                normalizedReceiverId,
            pairKey,
            status: 'pending',
            createdAt: now
        }
    };

    const {
        data: inserted,
        error
    } = await yhuSupabaseAdmin
        .from(
            'yhu_academy_friend_requests'
        )
        .upsert(
            row,
            {
                onConflict:
                    'source_document_path',

                ignoreDuplicates:
                    true
            }
        )
        .select('*')
        .maybeSingle();

    if (error) {
        throw new Error(
            `Friend request create failed: ${error.message}`
        );
    }

    let persisted =
        inserted ||
        null;

    if (!persisted) {
        const {
            data: existingRequest,
            error: existingRequestError
        } = await yhuSupabaseAdmin
            .from(
                'yhu_academy_friend_requests'
            )
            .select('*')
            .eq(
                'source_document_path',
                sourceDocumentPath
            )
            .maybeSingle();

        if (existingRequestError) {
            throw new Error(
                `Friend request lookup failed: ${existingRequestError.message}`
            );
        }

        persisted =
            existingRequest ||
            null;
    }

    if (!persisted) {
        throw new Error(
            'Friend request create returned no record.'
        );
    }

    const persistedSenderId =
        normalizeUserId(
            persisted.sender_id
        );

    const persistedReceiverId =
        normalizeUserId(
            persisted.receiver_id
        );

    if (
        persisted.status !==
        'pending'
    ) {
        throw communityHttpErrorV2(
            'Friend request has already been handled.',
            409
        );
    }

    if (
        persistedSenderId !==
            normalizedSenderId ||
        persistedReceiverId !==
            normalizedReceiverId
    ) {
        throw communityHttpErrorV2(
            'This member already sent you a friend request.',
            409
        );
    }

    return {
        id:
            persisted.request_id,
        senderId:
            persisted.sender_id,
        receiverId:
            persisted.receiver_id,
        status:
            persisted.status,
        createdAt:
            persisted.created_at_source,
        created:
            Boolean(inserted)
    };
}

async function ensureFriendshipForRequestV2(
    request = {},
    requestId = ''
) {
    const [
        userOneId,
        userTwoId
    ] = normalizeFriendPair(
        request.sender_id,
        request.receiver_id
    );

    const friendshipId =
        friendshipKeyFor(
            userOneId,
            userTwoId
        );

    const now =
        nowIso();

    const {
        data,
        error
    } = await yhuSupabaseAdmin
        .from(
            'yhu_academy_friendships'
        )
        .upsert(
            {
                firebase_app:
                    'supabase',

                friendship_id:
                    friendshipId,

                source_document_path:
                    `academyFriendships/${friendshipId}`,

                user_one_id:
                    userOneId,

                user_two_id:
                    userTwoId,

                created_at_source:
                    request.responded_at_source ||
                    now,

                data: {
                    userOneId,
                    userTwoId,

                    requestId:
                        sanitizeText(
                            requestId ||
                            request.request_id
                        ),

                    createdAt:
                        request.responded_at_source ||
                        now
                }
            },
            {
                onConflict:
                    'friendship_id'
            }
        )
        .select('*')
        .single();

    if (error) {
        throw new Error(
            `Friendship create failed: ${error.message}`
        );
    }

    return data;
}

async function respondToFriendRequest({
    responderId,
    requestId,
    action
}) {
    const normalizedResponderId =
        normalizeUserId(
            responderId
        );

    const normalizedRequestId =
        sanitizeText(
            requestId
        );

    const normalizedAction =
        sanitizeText(
            action
        ).toLowerCase();

    if (!normalizedResponderId) {
        throw communityHttpErrorV2(
            'responderId is required.',
            400
        );
    }

    if (!normalizedRequestId) {
        throw communityHttpErrorV2(
            'requestId is required.',
            400
        );
    }

    if (
        ![
            'accept',
            'accepted',
            'decline',
            'declined',
            'reject',
            'rejected'
        ].includes(
            normalizedAction
        )
    ) {
        throw communityHttpErrorV2(
            'Invalid friend request action.',
            400
        );
    }

    const {
        data: request,
        error: requestError
    } = await yhuSupabaseAdmin
        .from(
            'yhu_academy_friend_requests'
        )
        .select('*')
        .eq(
            'request_id',
            normalizedRequestId
        )
        .maybeSingle();

    if (requestError) {
        throw new Error(
            `Friend request lookup failed: ${requestError.message}`
        );
    }

    if (
        !request ||
        normalizeUserId(
            request.receiver_id
        ) !==
        normalizedResponderId
    ) {
        throw communityHttpErrorV2(
            'Friend request not found.',
            404
        );
    }

    const accepted =
        [
            'accept',
            'accepted'
        ].includes(
            normalizedAction
        );

    if (accepted) {
        await assertCommunityInteractionAllowedV3(
            normalizedResponderId,
            request.sender_id,
            {
                notFoundMessage:
                    'Friend request cannot be accepted.'
            }
        );
    }

    /*
     * Repeating accept repairs an accepted request
     * whose friendship write previously failed.
     */
    if (
        request.status ===
        'accepted'
    ) {
        if (!accepted) {
            throw communityHttpErrorV2(
                'Friend request has already been accepted.',
                409
            );
        }

        const friendship =
            await ensureFriendshipForRequestV2(
                request,
                normalizedRequestId
            );

        return {
            request: {
                id:
                    normalizedRequestId,
                senderId:
                    request.sender_id,
                receiverId:
                    request.receiver_id,
                status:
                    'accepted',
                respondedAt:
                    request.responded_at_source ||
                    ''
            },

            friendship: {
                id:
                    friendship.friendship_id,
                userOneId:
                    friendship.user_one_id,
                userTwoId:
                    friendship.user_two_id,
                createdAt:
                    friendship.created_at_source
            },

            alreadyHandled:
                true
        };
    }

    if (
        request.status !==
        'pending'
    ) {
        throw communityHttpErrorV2(
            'Friend request has already been handled.',
            409
        );
    }

    const now =
        nowIso();

    const {
        data: updatedRequest,
        error: updateError
    } = await yhuSupabaseAdmin
        .from(
            'yhu_academy_friend_requests'
        )
        .update({
            status:
                accepted
                    ? 'accepted'
                    : 'declined',

            responded_at_source:
                now,

            updated_at:
                now,

            data: {
                ...(request.data || {}),
                status:
                    accepted
                        ? 'accepted'
                        : 'declined',
                respondedAt:
                    now
            }
        })
        .eq(
            'request_id',
            normalizedRequestId
        )
        .eq(
            'status',
            'pending'
        )
        .select('*')
        .maybeSingle();

    if (updateError) {
        throw new Error(
            `Friend request update failed: ${updateError.message}`
        );
    }

    if (!updatedRequest) {
        throw communityHttpErrorV2(
            'Friend request has already been handled.',
            409
        );
    }

    let friendship =
        null;

    if (accepted) {
        friendship =
            await ensureFriendshipForRequestV2(
                updatedRequest,
                normalizedRequestId
            );
    }

    return {
        request: {
            id:
                normalizedRequestId,
            senderId:
                updatedRequest.sender_id,
            receiverId:
                updatedRequest.receiver_id,
            status:
                accepted
                    ? 'accepted'
                    : 'declined',
            respondedAt:
                updatedRequest.responded_at_source ||
                now
        },

        friendship:
            friendship
                ? {
                    id:
                        friendship.friendship_id,
                    userOneId:
                        friendship.user_one_id,
                    userTwoId:
                        friendship.user_two_id,
                    createdAt:
                        friendship.created_at_source
                }
                : null,

        alreadyHandled:
            false
    };
}

async function getCommunityNicheState({ viewerId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    if (!normalizedViewerId) throw new Error('viewerId is required.');

    const profile = await getProfileOrFallback(normalizedViewerId, { id: normalizedViewerId });

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_member_niches')
        .select('*')
        .eq('user_id', normalizedViewerId)
        .order('created_at_source', { ascending: true, nullsFirst: false });

    if (error) throw new Error(`Community niches lookup failed: ${error.message}`);

    const joinedKeys = new Set([
        ...mapArray(profile?.community_niches).map(normalizeNicheKey),
        ...(Array.isArray(data) ? data.map((row) => normalizeNicheKey(row.niche_key)) : [])
    ].filter(Boolean));

    const requestedDefaultNicheKey =
        normalizeNicheKey(
            profile?.default_niche
        ) ||
        normalizeNicheKey(
            (
                Array.isArray(data)
                    ? data
                    : []
            ).find(
                (row) =>
                    row.is_default
            )?.niche_key
        ) ||
        '';

    const defaultNicheKey =
        joinedKeys.has(
            requestedDefaultNicheKey
        )
            ? requestedDefaultNicheKey
            : (
                [
                    ...joinedKeys
                ][0] ||
                ''
            );

    const joinedNiches = ACADEMY_COMMUNITY_NICHES
        .filter((item) => joinedKeys.has(item.key))
        .map((item) => ({
            ...item,
            joined: true,
            isDefault: item.key === defaultNicheKey,
            is_default: item.key === defaultNicheKey
        }));

    const niches = ACADEMY_COMMUNITY_NICHES.map((item) => ({
        ...item,
        joined: joinedKeys.has(item.key),
        isDefault: item.key === defaultNicheKey,
        is_default: item.key === defaultNicheKey
    }));

    return {
        niches,
        joinedNiches,
        joined_niches: joinedNiches,
        defaultNicheKey,
        default_niche_key: defaultNicheKey
    };
}

async function persistCommunityNicheState(viewerId, joinedNiches = [], defaultNicheKey = '') {
    const normalizedViewerId =
        normalizeUserId(viewerId);

    if (!normalizedViewerId) {
        throw new Error(
            'viewerId is required.'
        );
    }

    const normalizedJoinedKeys =
        Array.from(
            new Set(
                (
                    Array.isArray(
                        joinedNiches
                    )
                        ? joinedNiches
                        : []
                )
                    .map((item) =>
                        normalizeNicheKey(
                            item?.key ||
                            item?.nicheKey ||
                            item
                        )
                    )
                    .filter((key) =>
                        Boolean(
                            getNicheMeta(
                                key
                            )
                        )
                    )
            )
        );

    const requestedDefault =
        normalizeNicheKey(
            defaultNicheKey
        );

    const cleanDefault =
        requestedDefault &&
        normalizedJoinedKeys.includes(
            requestedDefault
        )
            ? requestedDefault
            : (
                normalizedJoinedKeys[0] ||
                ''
            );

    const now =
        nowIso();

    const {
        data: currentRows,
        error: currentError
    } = await yhuSupabaseAdmin
        .from(
            'yhu_academy_member_niches'
        )
        .select('*')
        .eq(
            'user_id',
            normalizedViewerId
        );

    if (currentError) {
        throw new Error(
            `Community niches lookup failed: ${currentError.message}`
        );
    }

    const currentByKey =
        new Map(
            (
                Array.isArray(
                    currentRows
                )
                    ? currentRows
                    : []
            )
                .map((row) => [
                    normalizeNicheKey(
                        row.niche_key
                    ),
                    row
                ])
                .filter(
                    ([key]) =>
                        Boolean(key)
                )
        );

    const missingKeys =
        normalizedJoinedKeys.filter(
            (key) =>
                !currentByKey.has(
                    key
                )
        );

    /*
     * Insert new memberships before removing stale
     * memberships. A failed insert therefore cannot
     * erase the member's previous niche state.
     */
    if (missingKeys.length) {
        const rows =
            missingKeys.map((key) => ({
                user_id:
                    normalizedViewerId,

                niche_key:
                    key,

                is_default:
                    key ===
                    cleanDefault,

                created_at_source:
                    now,

                updated_at_source:
                    now,

                data: {
                    userId:
                        normalizedViewerId,

                    nicheKey:
                        key,

                    isDefault:
                        key ===
                        cleanDefault,

                    createdAt:
                        now,

                    updatedAt:
                        now
                }
            }));

        const { error } =
            await yhuSupabaseAdmin
                .from(
                    'yhu_academy_member_niches'
                )
                .insert(rows);

        if (error) {
            throw new Error(
                `Niche persist failed: ${error.message}`
            );
        }
    }

    for (const key of normalizedJoinedKeys) {
        const current =
            currentByKey.get(
                key
            );

        if (!current) {
            continue;
        }

        const isDefault =
            key ===
            cleanDefault;

        const { error } =
            await yhuSupabaseAdmin
                .from(
                    'yhu_academy_member_niches'
                )
                .update({
                    is_default:
                        isDefault,

                    updated_at_source:
                        now,

                    data: {
                        ...(current.data || {}),

                        userId:
                            normalizedViewerId,

                        nicheKey:
                            key,

                        isDefault,

                        updatedAt:
                            now
                    }
                })
                .eq(
                    'user_id',
                    normalizedViewerId
                )
                .eq(
                    'niche_key',
                    key
                );

        if (error) {
            throw new Error(
                `Niche update failed: ${error.message}`
            );
        }
    }

    const staleKeys =
        [
            ...currentByKey.keys()
        ].filter(
            (key) =>
                !normalizedJoinedKeys.includes(
                    key
                )
        );

    if (staleKeys.length) {
        const { error } =
            await yhuSupabaseAdmin
                .from(
                    'yhu_academy_member_niches'
                )
                .delete()
                .eq(
                    'user_id',
                    normalizedViewerId
                )
                .in(
                    'niche_key',
                    staleKeys
                );

        if (error) {
            throw new Error(
                `Niche cleanup failed: ${error.message}`
            );
        }
    }

    /*
     * The current Academy profile table stores
     * extended fields inside public_meta and data.
     * Do not write obsolete direct columns.
     */
    await academyMemberProfileSupabaseRepo
        .patchProfile(
            normalizedViewerId,
            {
                communityNiches:
                    normalizedJoinedKeys,

                community_niches:
                    normalizedJoinedKeys,

                defaultNiche:
                    cleanDefault,

                default_niche:
                    cleanDefault,

                updatedAt:
                    now
            }
        );

    return getCommunityNicheState({
        viewerId:
            normalizedViewerId
    });
}

async function joinCommunityNiche({ viewerId, nicheKey, makeDefault = false }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const cleanNicheKey = normalizeNicheKey(nicheKey);
    const meta = getNicheMeta(cleanNicheKey);

    if (!normalizedViewerId) throw new Error('viewerId is required.');
    if (!meta) throw new Error('Niche not found.');

    await getProfileOrFallback(normalizedViewerId, { id: normalizedViewerId });

    const current = await getCommunityNicheState({ viewerId: normalizedViewerId });
    const joinedKeys = new Set(current.joinedNiches.map((item) => item.key));
    joinedKeys.add(cleanNicheKey);

    const joinedNiches = Array.from(joinedKeys).map((key) => ({ key }));
    const nextDefault = makeDefault || !current.defaultNicheKey ? cleanNicheKey : current.defaultNicheKey;

    return persistCommunityNicheState(normalizedViewerId, joinedNiches, nextDefault);
}

async function setDefaultCommunityNiche({ viewerId, nicheKey }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const cleanNicheKey = normalizeNicheKey(nicheKey);
    const meta = getNicheMeta(cleanNicheKey);

    if (!normalizedViewerId) throw new Error('viewerId is required.');
    if (!meta) throw new Error('Niche not found.');

    return joinCommunityNiche({
        viewerId: normalizedViewerId,
        nicheKey: cleanNicheKey,
        makeDefault: true
    });
}

async function leaveCommunityNiche({ viewerId, nicheKey }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const cleanNicheKey = normalizeNicheKey(nicheKey);

    if (!normalizedViewerId) throw new Error('viewerId is required.');
    if (!cleanNicheKey) throw new Error('nicheKey is required.');

    const current = await getCommunityNicheState({ viewerId: normalizedViewerId });
    const joinedNiches = current.joinedNiches.filter((item) => item.key !== cleanNicheKey);
    const nextDefault =
        current.defaultNicheKey === cleanNicheKey
            ? joinedNiches[0]?.key || ''
            : current.defaultNicheKey;

    return persistCommunityNicheState(normalizedViewerId, joinedNiches, nextDefault);
}

module.exports = {
    setCommunityBlockedUserResolverV3,
    setCommunityMediaReceiptVerifierV4,
    getViewerProfile,
    getCommunityNicheState,
    joinCommunityNiche,
    setDefaultCommunityNiche,
    leaveCommunityNiche,
    listFeed,
    createPost,
    updatePost,
    hidePostForViewer,
    deletePost,
    togglePostLike,
    listPostComments,
    createPostComment,
    updatePostComment,
    deletePostComment,
    hidePostCommentForViewer,
    listAcademyMembers,
    getMemberSocialCounts,
    getMemberProfile,
    toggleMemberFollow,
    sendFriendRequest,
    respondToFriendRequest
};
