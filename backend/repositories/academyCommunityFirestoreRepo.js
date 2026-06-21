const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

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
    const userData = row.user_data && typeof row.user_data === 'object' ? row.user_data : {};
    const academyData = row.academy_data && typeof row.academy_data === 'object' ? row.academy_data : {};

    const fullName =
        sanitizeText(row.full_name) ||
        sanitizeText(row.display_name) ||
        sanitizeText(academyData.fullName || academyData.displayName || academyData.display_name) ||
        sanitizeText(userData.fullName || userData.displayName || userData.name) ||
        sanitizeText(fallback.name || fallback.fullName || fallback.username) ||
        'Hustler';

    const displayName =
        sanitizeText(row.display_name) ||
        sanitizeText(academyData.displayName || academyData.display_name) ||
        fullName;

    return {
        id: sanitizeText(row.user_id || fallback.id || fallback.firebaseUid),
        email: sanitizeText(row.email || userData.email || fallback.email).toLowerCase(),
        fullName,
        display_name: displayName,
        displayName,
        username: sanitizeText(row.username || academyData.username || userData.username || fallback.username).replace(/^@+/, ''),
        avatar: sanitizeText(row.avatar || academyData.avatar || userData.avatar || userData.profilePhoto || userData.photoURL),
        role_label: sanitizeText(row.role_label || academyData.role_label || academyData.roleLabel || userData.roleLabel || userData.role || 'Academy Member') || 'Academy Member',
        roleLabel: sanitizeText(row.role_label || academyData.role_label || academyData.roleLabel || userData.roleLabel || userData.role || 'Academy Member') || 'Academy Member',
        bio: sanitizeText(row.bio || academyData.bio || userData.bio || userData.profileBio || userData.about || userData.description),
        cover_photo: sanitizeText(row.cover_photo || academyData.cover_photo || academyData.coverPhoto || userData.coverPhoto),
        search_tags: mapArray(row.search_tags),
        community_niches: mapArray(row.community_niches),
        default_niche: sanitizeText(row.default_niche),
        created_at: row.created_at_source || row.created_at || '',
        updated_at: row.updated_at_source || row.updated_at || ''
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
    const viewerId = normalizeUserId(user?.id || user?.firebaseUid || user?.uid);
    if (!viewerId) throw new Error('Missing viewer id.');

    const existing = await getProfileRow(viewerId);
    if (existing) return mapProfileRow(existing, user);

    const now = nowIso();
    const snapshot = buildAuthorSnapshot({}, user);

    const row = {
        user_id: viewerId,
        email: sanitizeText(user.email).toLowerCase(),
        full_name: snapshot.fullName,
        display_name: snapshot.displayName,
        username: snapshot.username,
        avatar: snapshot.avatar,
        role_label: snapshot.roleLabel,
        bio: '',
        cover_photo: '',
        search_tags: [],
        community_niches: [],
        default_niche: '',
        user_data: {
            id: viewerId,
            email: sanitizeText(user.email).toLowerCase(),
            name: sanitizeText(user.name || snapshot.fullName),
            username: snapshot.username
        },
        academy_data: {},
        created_at_source: now,
        updated_at_source: now
    };

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_member_profiles')
        .upsert(row, { onConflict: 'user_id' })
        .select('*')
        .single();

    if (error) {
        throw new Error(`Academy member profile create failed: ${error.message}`);
    }

    return mapProfileRow(data, user);
}

async function getViewerProfile(user = {}) {
    return ensureViewerProfile(user);
}

async function getProfileOrFallback(userId, fallback = {}) {
    const row = await getProfileRow(userId);
    if (row) return mapProfileRow(row, fallback);

    const cleanUserId = normalizeUserId(userId);
    if (!cleanUserId) return null;

    return {
        id: cleanUserId,
        email: sanitizeText(fallback.email).toLowerCase(),
        fullName: sanitizeText(fallback.fullName || fallback.name || fallback.username || 'Hustler'),
        display_name: sanitizeText(fallback.display_name || fallback.displayName || fallback.fullName || fallback.name || fallback.username || 'Hustler'),
        displayName: sanitizeText(fallback.displayName || fallback.display_name || fallback.fullName || fallback.name || fallback.username || 'Hustler'),
        username: sanitizeText(fallback.username).replace(/^@+/, ''),
        avatar: sanitizeText(fallback.avatar || fallback.profilePhoto || fallback.photoURL),
        role_label: sanitizeText(fallback.role_label || fallback.roleLabel || 'Academy Member'),
        roleLabel: sanitizeText(fallback.roleLabel || fallback.role_label || 'Academy Member'),
        bio: sanitizeText(fallback.bio),
        cover_photo: sanitizeText(fallback.cover_photo || fallback.coverPhoto),
        search_tags: mapArray(fallback.search_tags || fallback.searchTags),
        community_niches: mapArray(fallback.community_niches || fallback.communityNiches),
        default_niche: sanitizeText(fallback.default_niche || fallback.defaultNiche)
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
    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_user_follows')
        .select('following_id')
        .eq('follower_id', normalizeUserId(userId))
        .limit(500);

    if (error) throw new Error(`Following ids lookup failed: ${error.message}`);

    return (Array.isArray(data) ? data : [])
        .map((row) => sanitizeText(row.following_id))
        .filter(Boolean);
}

async function getFollowerIdsForUser(userId) {
    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_user_follows')
        .select('follower_id')
        .eq('following_id', normalizeUserId(userId))
        .limit(500);

    if (error) throw new Error(`Follower ids lookup failed: ${error.message}`);

    return (Array.isArray(data) ? data : [])
        .map((row) => sanitizeText(row.follower_id))
        .filter(Boolean);
}

async function getFriendIdsForUser(userId) {
    const normalizedUserId = normalizeUserId(userId);

    const [left, right] = await Promise.all([
        yhuSupabaseAdmin
            .from('yhu_academy_friendships')
            .select('user_two_id')
            .eq('user_one_id', normalizedUserId)
            .limit(500),
        yhuSupabaseAdmin
            .from('yhu_academy_friendships')
            .select('user_one_id')
            .eq('user_two_id', normalizedUserId)
            .limit(500)
    ]);

    if (left.error) throw new Error(`Friend ids lookup failed: ${left.error.message}`);
    if (right.error) throw new Error(`Friend ids lookup failed: ${right.error.message}`);

    return [
        ...(left.data || []).map((row) => sanitizeText(row.user_two_id)),
        ...(right.data || []).map((row) => sanitizeText(row.user_one_id))
    ].filter(Boolean);
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
        outgoing_friend_request_pending: toBool(extras.outgoing_friend_request_pending)
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

async function listFeed({ viewerId, limit = 25, scope = 'global', nicheKey = '', relation = '' }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedLimit = Math.max(1, Math.min(toInt(limit, 25), 50));
    const normalizedScope = normalizeFeedScope(scope);
    const normalizedNicheKey = normalizeNicheKey(nicheKey);
    const normalizedRelation = normalizeCircleRelation(relation);

    let allowedAuthorIds = null;

    if (normalizedScope === 'circle') {
        if (normalizedRelation === 'following') {
            allowedAuthorIds = new Set(await getFollowingIdsForUser(normalizedViewerId));
        } else if (normalizedRelation === 'followers') {
            allowedAuthorIds = new Set(await getFollowerIdsForUser(normalizedViewerId));
        } else {
            allowedAuthorIds = new Set(await getFriendIdsForUser(normalizedViewerId));
        }

        if (!allowedAuthorIds.size) return [];
    }

    let query = yhuSupabaseAdmin
        .from('yhu_academy_feed_posts')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at_source', { ascending: false, nullsFirst: false })
        .limit(Math.min(normalizedLimit * 8, 200));

    if (normalizedScope === 'niche') {
        query = query.eq('feed_scope', 'niche');
        if (normalizedNicheKey) query = query.eq('niche_key', normalizedNicheKey);
    } else if (normalizedScope === 'global') {
        query = query.eq('feed_scope', 'global');
    }

    const { data, error } = await query;
    if (error) throw new Error(`Academy feed lookup failed: ${error.message}`);

    const rows = (Array.isArray(data) ? data : [])
        .filter((row) => {
            const hidden = mapArray(row.hidden_for_user_ids);
            if (normalizedViewerId && hidden.includes(normalizedViewerId)) return false;
            if (allowedAuthorIds && !allowedAuthorIds.has(sanitizeText(row.author_id))) return false;
            return true;
        })
        .slice(0, normalizedLimit);

    const posts = [];

    for (const row of rows) {
        const [likeState, commentCount, friendshipState, followingIds] = await Promise.all([
            getLikeState(row.post_id, normalizedViewerId),
            getCommentCount(row.post_id),
            getFriendshipState(normalizedViewerId, row.author_id),
            normalizedViewerId ? getFollowingIdsForUser(normalizedViewerId) : Promise.resolve([])
        ]);

        posts.push(mapPostRow(row, {
            viewerId: normalizedViewerId,
            ...likeState,
            comment_count: commentCount,
            ...friendshipState,
            following_author: followingIds.includes(sanitizeText(row.author_id))
        }));
    }

    return posts;
}

async function createPost({
    viewer,
    body,
    imageUrl = '',
    mediaUrl = '',
    mediaKind = '',
    mediaType = '',
    mediaSize = 0,
    visibility = 'academy',
    feedScope = 'global',
    nicheKey = '',
    nicheLabel = '',
    audience = '',
    share = null
}) {
    const viewerProfile = await getViewerProfile(viewer);
    const cleanBody = sanitizeText(body);

    if (!cleanBody) throw new Error('Post body is required.');

    const normalizedFeedScope = normalizeFeedScope(feedScope);
    const normalizedNicheKey = normalizedFeedScope === 'niche' ? normalizeNicheKey(nicheKey) : '';
    const nicheMeta = normalizedNicheKey ? getNicheMeta(normalizedNicheKey) : null;

    if (normalizedFeedScope === 'niche' && !nicheMeta) {
        throw new Error('Niche not found.');
    }

    const postId = buildId('post');
    const now = nowIso();
    const cleanMediaUrl = sanitizeText(mediaUrl || imageUrl);
    const cleanMediaKind = sanitizeText(mediaKind).toLowerCase() === 'video'
        ? 'video'
        : cleanMediaUrl
            ? 'image'
            : '';

    const authorSnapshot = buildAuthorSnapshot(viewerProfile, viewer);

    const row = {
        firebase_app: 'supabase',
        post_id: postId,
        source_document_path: `academyFeedPosts/${postId}`,
        author_id: viewerProfile.id,
        body: cleanBody,
        image_url: cleanMediaKind === 'video' ? '' : sanitizeText(imageUrl || cleanMediaUrl),
        video_url: cleanMediaKind === 'video' ? cleanMediaUrl : '',
        media_url: cleanMediaUrl,
        media_kind: cleanMediaKind,
        media_type: sanitizeText(mediaType),
        media_size: toInt(mediaSize, 0),
        visibility: sanitizeText(visibility || 'academy'),
        feed_scope: normalizedFeedScope,
        niche_key: normalizedNicheKey,
        niche_label: sanitizeText(nicheLabel || nicheMeta?.label || ''),
        audience: sanitizeText(audience || visibility || 'academy').toLowerCase(),
        is_pinned: false,
        is_deleted: false,
        hidden_for_user_ids: [],
        author_snapshot: authorSnapshot,
        share: share && typeof share === 'object' ? share : null,
        created_at_source: now,
        updated_at_source: now,
        edited_at_source: null,
        deleted_at_source: null,
        data: {
            body: cleanBody,
            authorId: viewerProfile.id,
            authorSnapshot,
            mediaUrl: cleanMediaUrl,
            imageUrl: cleanMediaKind === 'video' ? '' : sanitizeText(imageUrl || cleanMediaUrl),
            videoUrl: cleanMediaKind === 'video' ? cleanMediaUrl : '',
            mediaKind: cleanMediaKind,
            mediaType: sanitizeText(mediaType),
            mediaSize: toInt(mediaSize, 0),
            visibility: sanitizeText(visibility || 'academy'),
            feedScope: normalizedFeedScope,
            nicheKey: normalizedNicheKey,
            nicheLabel: sanitizeText(nicheLabel || nicheMeta?.label || ''),
            audience: sanitizeText(audience || visibility || 'academy').toLowerCase(),
            share: share && typeof share === 'object' ? share : null,
            createdAt: now,
            updatedAt: now
        }
    };

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_posts')
        .insert(row)
        .select('*')
        .single();

    if (error) throw new Error(`Post create failed: ${error.message}`);

    return mapPostRow(data, {
        viewerId: viewerProfile.id,
        like_count: 0,
        comment_count: 0,
        liked_by_me: false
    });
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

async function togglePostLike({ viewerId, postId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);

    if (!normalizedViewerId) throw new Error('viewerId is required.');
    if (!normalizedPostId) throw new Error('postId is required.');

    const row = await fetchPostRow(normalizedPostId);
    if (!row || toBool(row.is_deleted)) throw new Error('Post not found.');

    const existing = await yhuSupabaseAdmin
        .from('yhu_academy_feed_likes')
        .select('id')
        .eq('post_id', normalizedPostId)
        .eq('user_id', normalizedViewerId)
        .maybeSingle();

    if (existing.error) throw new Error(`Like lookup failed: ${existing.error.message}`);

    let liked;

    if (existing.data) {
        const { error } = await yhuSupabaseAdmin
            .from('yhu_academy_feed_likes')
            .delete()
            .eq('post_id', normalizedPostId)
            .eq('user_id', normalizedViewerId);

        if (error) throw new Error(`Unlike failed: ${error.message}`);
        liked = false;
    } else {
        const now = nowIso();
        const { error } = await yhuSupabaseAdmin
            .from('yhu_academy_feed_likes')
            .insert({
                firebase_app: 'supabase',
                post_id: normalizedPostId,
                user_id: normalizedViewerId,
                source_document_path: `academyFeedPosts/${normalizedPostId}/likes/${normalizedViewerId}`,
                created_at_source: now,
                data: {
                    userId: normalizedViewerId,
                    postId: normalizedPostId,
                    createdAt: now
                }
            });

        if (error) throw new Error(`Like failed: ${error.message}`);
        liked = true;
    }

    const likeState = await getLikeState(normalizedPostId, normalizedViewerId);

    return {
        liked,
        liked_by_me: liked,
        like_count: likeState.like_count
    };
}

async function listPostComments({ viewerId, postId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedPostId = sanitizeText(postId);

    if (!normalizedPostId) throw new Error('postId is required.');

    const post = await fetchPostRow(normalizedPostId);
    if (!post || toBool(post.is_deleted)) throw new Error('Post not found.');

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_feed_comments')
        .select('*')
        .eq('post_id', normalizedPostId)
        .eq('is_deleted', false)
        .order('created_at_source', { ascending: true, nullsFirst: false })
        .limit(300);

    if (error) throw new Error(`Comments lookup failed: ${error.message}`);

    const visibleRows = (Array.isArray(data) ? data : [])
        .filter((row) => !normalizedViewerId || !mapArray(row.hidden_for_user_ids).includes(normalizedViewerId));

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

    const post = await fetchPostRow(normalizedPostId);
    if (!post || toBool(post.is_deleted)) throw new Error('Post not found.');

    let parentData = null;
    let parentDepth = -1;
    let rootCommentId = '';

    if (normalizedParentCommentId) {
        parentData = await fetchCommentRow(normalizedPostId, normalizedParentCommentId);
        if (!parentData || toBool(parentData.is_deleted)) throw new Error('Parent comment not found.');

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

    return mapCommentRow(data, {
        viewerId: viewerProfile.id,
        postId: normalizedPostId,
        postOwnerId: post.author_id
    });
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

    const comment = await fetchCommentRow(normalizedPostId, normalizedCommentId);
    if (!comment || toBool(comment.is_deleted)) throw new Error('Comment not found.');

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

    const followedIds = new Set(normalizedViewerId ? await getFollowingIdsForUser(normalizedViewerId) : []);

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
            if (!authorId || authorId === normalizedViewerId) continue;

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

            if (!userId || userId === normalizedViewerId) return null;

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
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedTargetUserId = normalizeUserId(targetUserId);

    if (!normalizedTargetUserId) throw new Error('targetUserId is required.');

    const profile = await getProfileOrFallback(normalizedTargetUserId);
    if (!profile) throw new Error('Target member not found.');

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

async function toggleMemberFollow({ viewerId, targetUserId }) {
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedTargetUserId = normalizeUserId(targetUserId);

    if (!normalizedViewerId) throw new Error('viewerId is required.');
    if (!normalizedTargetUserId) throw new Error('targetUserId is required.');
    if (normalizedViewerId === normalizedTargetUserId) throw new Error('You cannot follow yourself.');

    const targetProfile = await getProfileOrFallback(normalizedTargetUserId);
    if (!targetProfile) throw new Error('Target member not found.');

    const existing = await yhuSupabaseAdmin
        .from('yhu_academy_user_follows')
        .select('id')
        .eq('follower_id', normalizedViewerId)
        .eq('following_id', normalizedTargetUserId)
        .maybeSingle();

    if (existing.error) throw new Error(`Follow lookup failed: ${existing.error.message}`);

    let following;

    if (existing.data) {
        const { error } = await yhuSupabaseAdmin
            .from('yhu_academy_user_follows')
            .delete()
            .eq('follower_id', normalizedViewerId)
            .eq('following_id', normalizedTargetUserId);

        if (error) throw new Error(`Unfollow failed: ${error.message}`);
        following = false;
    } else {
        const now = nowIso();
        const followId = followKeyFor(normalizedViewerId, normalizedTargetUserId);

        const { error } = await yhuSupabaseAdmin
            .from('yhu_academy_user_follows')
            .insert({
                firebase_app: 'supabase',
                source_collection_path: 'academyUserFollows',
                follow_id: followId,
                source_document_path: `academyUserFollows/${followId}`,
                follower_id: normalizedViewerId,
                following_id: normalizedTargetUserId,
                created_at_source: now,
                data: {
                    followerId: normalizedViewerId,
                    followingId: normalizedTargetUserId,
                    createdAt: now
                }
            });

        if (error) throw new Error(`Follow failed: ${error.message}`);
        following = true;
    }

    const [followersCount, followingCount] = await Promise.all([
        getAcademyFollowerCount(normalizedTargetUserId),
        getAcademyFollowingCount(normalizedViewerId)
    ]);

    return {
        following,
        followed_by_me: following,
        targetUserId: normalizedTargetUserId,
        followers_count: followersCount,
        viewer_following_count: followingCount
    };
}

async function sendFriendRequest({ senderId, receiverId }) {
    const normalizedSenderId = normalizeUserId(senderId);
    const normalizedReceiverId = normalizeUserId(receiverId);

    if (!normalizedSenderId) throw new Error('senderId is required.');
    if (!normalizedReceiverId) throw new Error('receiverId is required.');
    if (normalizedSenderId === normalizedReceiverId) throw new Error('You cannot send a friend request to yourself.');

    const receiverProfile = await getProfileOrFallback(normalizedReceiverId);
    if (!receiverProfile) throw new Error('Target member not found.');

    const state = await getFriendshipState(normalizedSenderId, normalizedReceiverId);
    if (state.is_friend) throw new Error('You are already friends.');
    if (state.outgoing_friend_request_pending) throw new Error('Friend request already sent.');
    if (state.incoming_friend_request_pending) throw new Error('This member already sent you a friend request.');

    const requestId = buildId('friendreq');
    const now = nowIso();

    const row = {
        firebase_app: 'supabase',
        request_id: requestId,
        source_document_path: `academyFriendRequests/${requestId}`,
        sender_id: normalizedSenderId,
        receiver_id: normalizedReceiverId,
        status: 'pending',
        created_at_source: now,
        responded_at_source: null,
        data: {
            senderId: normalizedSenderId,
            receiverId: normalizedReceiverId,
            status: 'pending',
            createdAt: now
        }
    };

    const { data, error } = await yhuSupabaseAdmin
        .from('yhu_academy_friend_requests')
        .insert(row)
        .select('*')
        .single();

    if (error) throw new Error(`Friend request create failed: ${error.message}`);

    return {
        id: data.request_id,
        senderId: data.sender_id,
        receiverId: data.receiver_id,
        status: data.status,
        createdAt: data.created_at_source
    };
}

async function respondToFriendRequest({ responderId, requestId, action }) {
    const normalizedResponderId = normalizeUserId(responderId);
    const normalizedRequestId = sanitizeText(requestId);
    const normalizedAction = sanitizeText(action).toLowerCase();

    if (!normalizedResponderId) throw new Error('responderId is required.');
    if (!normalizedRequestId) throw new Error('requestId is required.');
    if (!['accept', 'accepted', 'decline', 'declined', 'reject', 'rejected'].includes(normalizedAction)) {
        throw new Error('Invalid friend request action.');
    }

    const { data: request, error: requestError } = await yhuSupabaseAdmin
        .from('yhu_academy_friend_requests')
        .select('*')
        .eq('request_id', normalizedRequestId)
        .maybeSingle();

    if (requestError) throw new Error(`Friend request lookup failed: ${requestError.message}`);
    if (!request || request.status !== 'pending') throw new Error('Friend request not found.');
    if (sanitizeText(request.receiver_id) !== normalizedResponderId) throw new Error('Friend request not found.');

    const accepted = ['accept', 'accepted'].includes(normalizedAction);
    const now = nowIso();

    const { error: updateError } = await yhuSupabaseAdmin
        .from('yhu_academy_friend_requests')
        .update({
            status: accepted ? 'accepted' : 'declined',
            responded_at_source: now,
            updated_at: now,
            data: {
                ...(request.data || {}),
                status: accepted ? 'accepted' : 'declined',
                respondedAt: now
            }
        })
        .eq('request_id', normalizedRequestId);

    if (updateError) throw new Error(`Friend request update failed: ${updateError.message}`);

    let friendship = null;

    if (accepted) {
        const [x, y] = normalizeFriendPair(request.sender_id, request.receiver_id);
        const friendshipId = friendshipKeyFor(x, y);

        const { data, error } = await yhuSupabaseAdmin
            .from('yhu_academy_friendships')
            .upsert({
                firebase_app: 'supabase',
                friendship_id: friendshipId,
                source_document_path: `academyFriendships/${friendshipId}`,
                user_one_id: x,
                user_two_id: y,
                created_at_source: now,
                data: {
                    userOneId: x,
                    userTwoId: y,
                    requestId: normalizedRequestId,
                    createdAt: now
                }
            }, { onConflict: 'friendship_id' })
            .select('*')
            .single();

        if (error) throw new Error(`Friendship create failed: ${error.message}`);
        friendship = data;
    }

    return {
        request: {
            id: normalizedRequestId,
            senderId: request.sender_id,
            receiverId: request.receiver_id,
            status: accepted ? 'accepted' : 'declined',
            respondedAt: now
        },
        friendship: friendship
            ? {
                id: friendship.friendship_id,
                userOneId: friendship.user_one_id,
                userTwoId: friendship.user_two_id,
                createdAt: friendship.created_at_source
            }
            : null
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

    const defaultNicheKey =
        normalizeNicheKey(profile?.default_niche) ||
        normalizeNicheKey((Array.isArray(data) ? data : []).find((row) => row.is_default)?.niche_key) ||
        '';

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
    const normalizedViewerId = normalizeUserId(viewerId);
    const normalizedJoinedKeys = Array.from(new Set(
        (Array.isArray(joinedNiches) ? joinedNiches : [])
            .map((item) => normalizeNicheKey(item.key || item.nicheKey || item))
            .filter((key) => getNicheMeta(key))
    ));

    const cleanDefault =
        normalizeNicheKey(defaultNicheKey) && normalizedJoinedKeys.includes(normalizeNicheKey(defaultNicheKey))
            ? normalizeNicheKey(defaultNicheKey)
            : normalizedJoinedKeys[0] || '';

    const now = nowIso();

    const { error: deleteError } = await yhuSupabaseAdmin
        .from('yhu_academy_member_niches')
        .delete()
        .eq('user_id', normalizedViewerId);

    if (deleteError) throw new Error(`Niche cleanup failed: ${deleteError.message}`);

    if (normalizedJoinedKeys.length) {
        const rows = normalizedJoinedKeys.map((key) => ({
            user_id: normalizedViewerId,
            niche_key: key,
            is_default: key === cleanDefault,
            created_at_source: now,
            updated_at_source: now,
            data: {
                userId: normalizedViewerId,
                nicheKey: key,
                isDefault: key === cleanDefault,
                createdAt: now,
                updatedAt: now
            }
        }));

        const { error } = await yhuSupabaseAdmin
            .from('yhu_academy_member_niches')
            .insert(rows);

        if (error) throw new Error(`Niche persist failed: ${error.message}`);
    }

    const { error: profileError } = await yhuSupabaseAdmin
        .from('yhu_academy_member_profiles')
        .update({
            community_niches: normalizedJoinedKeys,
            default_niche: cleanDefault,
            updated_at_source: now,
            updated_at: now
        })
        .eq('user_id', normalizedViewerId);

    if (profileError) throw new Error(`Niche profile update failed: ${profileError.message}`);

    return getCommunityNicheState({ viewerId: normalizedViewerId });
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
