(function () {
    const state = {
        mode: 'all',
        search: '',
        division: 'all',
        status: 'all',
        items: [],
        leads: [],
        stats: {
            totalItems: 0,
            totalLeads: 0,
            approvedItems: 0,
            monetizedItems: 0
        },
        loading: false
    };

    const els = {
        refreshBtn: document.getElementById('collections-refresh-btn'),
        loading: document.getElementById('collections-loading'),
        error: document.getElementById('collections-error'),
        empty: document.getElementById('collections-empty'),
        grid: document.getElementById('collections-grid'),
        search: document.getElementById('collections-search-input'),
        division: document.getElementById('collections-division-filter'),
        status: document.getElementById('collections-status-filter'),
        tabs: Array.from(document.querySelectorAll('[data-collections-mode]')),
        total: document.getElementById('collections-stat-total'),
        leads: document.getElementById('collections-stat-leads'),
        approved: document.getElementById('collections-stat-approved'),
        monetized: document.getElementById('collections-stat-monetized')
    };

    function escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getCollectionsAccessKey() {
        return String(window.__YH_COLLECTIONS_ACCESS_KEY__ || '').trim();
    }

    function getStoredAuthToken() {
        try {
            return (
                localStorage.getItem('yh_auth_token') ||
                localStorage.getItem('yh_token') ||
                localStorage.getItem('token') ||
                sessionStorage.getItem('yh_auth_token') ||
                sessionStorage.getItem('yh_token') ||
                ''
            );
        } catch (_) {
            return '';
        }
    }

    function buildQuery() {
        const params = new URLSearchParams();

        params.set('mode', state.mode);
        params.set('limit', '160');

        if (state.search) params.set('q', state.search);
        if (state.division && state.division !== 'all') params.set('division', state.division);
        if (state.status && state.status !== 'all') params.set('status', state.status);

        return params.toString();
    }

    async function authedFetch(url, options = {}) {
        const token = getStoredAuthToken();
        const accessKey = getCollectionsAccessKey();

        const headers = {
            'Content-Type': 'application/json',
            'x-yh-collections-key': accessKey,
            ...(options.headers || {})
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include'
        });

        let data = null;

        try {
            data = await response.json();
        } catch (_) {
            data = null;
        }

        if (!response.ok || data?.success === false) {
            const error = new Error(data?.message || `Request failed with ${response.status}`);
            error.status = response.status;
            throw error;
        }

        return data;
    }

    function setLoading(isLoading = false) {
        state.loading = isLoading;

        els.loading?.classList.toggle('hidden-step', !isLoading);

        if (els.refreshBtn) {
            els.refreshBtn.disabled = isLoading;
            els.refreshBtn.textContent = isLoading ? 'Loading...' : 'Refresh';
        }
    }

    function showError(message = '') {
        if (!els.error) return;

        const clean = String(message || '').trim();

        els.error.textContent = clean;
        els.error.classList.toggle('hidden-step', !clean);
    }

    function normalizeStatusLabel(value = '') {
        const clean = String(value || '').replace(/_/g, ' ').trim();
        return clean ? clean.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Pending Review';
    }

    function getCardStatus(item = {}) {
        if (item.listingStatus === 'listed') return 'listed';
        return item.reviewStatus || 'pending_review';
    }

    function getVisibleItems() {
        const baseItems = Array.isArray(state.items) ? state.items : [];
        const leadItems = Array.isArray(state.leads) ? state.leads : [];

        if (state.mode === 'leads') return leadItems;

        const combined = [...baseItems];

        if (state.mode === 'all') {
            const existingLeadIds = new Set(
                combined
                    .filter((item) => item.itemType === 'lead')
                    .map((item) => item.id)
            );

            leadItems.forEach((lead) => {
                if (!existingLeadIds.has(lead.id)) {
                    combined.push(lead);
                }
            });
        }

        return combined;
    }

    function renderStats() {
        const stats = state.stats || {};

        if (els.total) els.total.textContent = String(stats.totalItems || 0);
        if (els.leads) els.leads.textContent = String(stats.totalLeads || 0);
        if (els.approved) els.approved.textContent = String(stats.approvedItems || 0);
        if (els.monetized) els.monetized.textContent = String(stats.monetizedItems || 0);
    }

    function renderTags(tags = []) {
        const safeTags = Array.isArray(tags) ? tags : [];

        if (!safeTags.length) return '';

        return `
            <div class="collections-card-tags">
                ${safeTags.slice(0, 5).map((tag) => `<span class="collections-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        `;
    }

    function renderPrice(item = {}) {
        const meta = item.publicMeta || {};
        const amount = Number(meta.buyerPriceAmount || 0);
        const currency = String(meta.currency || 'USD').toUpperCase();

        if (!amount) {
            return item.monetized ? '<span class="collections-price">Paid Access</span>' : '<span></span>';
        }

        return `<span class="collections-price">${escapeHtml(currency)} ${amount.toLocaleString()}</span>`;
    }

    function renderOpenAction(item = {}) {
        const url = String(item.resourceUrl || item.publicMeta?.resourceUrl || '').trim();

        if (!url) return '<span></span>';

        return `
            <a class="collections-open-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
                Open ↗
            </a>
        `;
    }

    function renderCard(item = {}) {
        const status = getCardStatus(item);
        const sourceDivision = item.sourceDivision || 'universe';
        const targetDivision = item.targetDivision || item.accessLevel || sourceDivision;
        const summary = item.summary || item.publicMeta?.summary || 'No summary available yet.';
        const createdByName = item.createdByName || 'YH Member';
        const category = item.category || item.itemType || 'Collection Item';

        return `
            <article class="collections-card" data-collection-id="${escapeHtml(item.id || '')}">
                <div class="collections-card-top">
                    <div class="collections-card-badges">
                        <span class="collections-badge">${escapeHtml(item.itemType || 'item')}</span>
                        <span class="collections-badge">${escapeHtml(sourceDivision)}</span>
                        <span class="collections-badge status-${escapeHtml(status)}">${escapeHtml(normalizeStatusLabel(status))}</span>
                    </div>

                    <div>
                        <h3>${escapeHtml(item.title || 'Untitled item')}</h3>
                        <p>${escapeHtml(summary).slice(0, 260)}</p>
                    </div>

                    <div class="collections-card-meta">
                        <span>Category: <strong>${escapeHtml(category)}</strong></span>
                        <span>Access: <strong>${escapeHtml(targetDivision)}</strong></span>
                        <span>Submitted by: <strong>${escapeHtml(createdByName)}</strong></span>
                    </div>

                    ${renderTags(item.tags)}
                </div>

                <div class="collections-card-footer">
                    ${renderPrice(item)}
                    ${renderOpenAction(item)}
                </div>
            </article>
        `;
    }

    function render() {
        renderStats();

        const items = getVisibleItems();

        if (els.grid) {
            els.grid.innerHTML = items.map(renderCard).join('');
        }

        els.empty?.classList.toggle('hidden-step', Boolean(items.length) || state.loading);
    }

    async function loadCollections() {
        setLoading(true);
        showError('');

        try {
            const data = await authedFetch(`/api/universe/collections/bootstrap?${buildQuery()}`);

            state.items = Array.isArray(data.items) ? data.items : [];
            state.leads = Array.isArray(data.leads) ? data.leads : [];
            state.stats = data.stats || state.stats;

            render();
        } catch (error) {
            console.error('loadCollections error:', error);

            if (Number(error.status) === 401) {
                window.location.href = '/?redirect=collections';
                return;
            }

            if (Number(error.status) === 404) {
                showError('Collections access key is invalid or missing.');
            } else {
                showError(error.message || 'Failed to load collections.');
            }

            state.items = [];
            state.leads = [];
            render();
        } finally {
            setLoading(false);
        }
    }

    function setMode(nextMode = 'all') {
        state.mode = String(nextMode || 'all').trim().toLowerCase() || 'all';

        els.tabs.forEach((tab) => {
            tab.classList.toggle('is-active', tab.dataset.collectionsMode === state.mode);
        });

        loadCollections();
    }

    function bindEvents() {
        els.refreshBtn?.addEventListener('click', loadCollections);

        els.tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                setMode(tab.dataset.collectionsMode || 'all');
            });
        });

        let searchTimer = null;

        els.search?.addEventListener('input', () => {
            clearTimeout(searchTimer);

            searchTimer = window.setTimeout(() => {
                state.search = String(els.search.value || '').trim();
                loadCollections();
            }, 260);
        });

        els.division?.addEventListener('change', () => {
            state.division = String(els.division.value || 'all').trim().toLowerCase();
            loadCollections();
        });

        els.status?.addEventListener('change', () => {
            state.status = String(els.status.value || 'all').trim().toLowerCase();
            loadCollections();
        });
    }

    bindEvents();
    loadCollections();
})();