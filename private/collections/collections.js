(function () {
    const state = {
        mode: 'all',
        search: '',
        division: 'all',
        status: 'all',
        view: 'grid',
        activeId: '',
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

    const viewCopy = {
        all: ['All Collections', 'Showing all visible mirrored records.'],
        resources: ['Resources', 'Scripts, tools, templates, links, documents, and reusable materials.'],
        leads: ['Lead Marketplace', 'Federation lead inventory mirrored from operator submissions.'],
        opportunities: ['Opportunities', 'Plaza and cross-division opportunity records.'],
        mine: ['My Submissions', 'Records submitted by the current logged-in user.'],
        pending: ['Pending Review', 'Records still waiting for approval or listing decision.']
    };

    const els = {
        refreshBtn: document.getElementById('collections-refresh-btn'),
        loading: document.getElementById('collections-loading'),
        error: document.getElementById('collections-error'),
        empty: document.getElementById('collections-empty'),
        grid: document.getElementById('collections-grid'),
        tableWrap: document.getElementById('collections-table-wrap'),
        tableBody: document.getElementById('collections-table-body'),
        search: document.getElementById('collections-search-input'),
        division: document.getElementById('collections-division-filter'),
        status: document.getElementById('collections-status-filter'),
        sideLinks: Array.from(document.querySelectorAll('[data-collections-mode]')),
        gridView: document.getElementById('collections-grid-view'),
        tableView: document.getElementById('collections-table-view'),
        viewTitle: document.getElementById('collections-view-title'),
        viewSubtitle: document.getElementById('collections-view-subtitle'),
        resultCount: document.getElementById('collections-result-count'),
        total: document.getElementById('collections-stat-total'),
        leads: document.getElementById('collections-stat-leads'),
        approved: document.getElementById('collections-stat-approved'),
        monetized: document.getElementById('collections-stat-monetized'),
        countAll: document.getElementById('count-all'),
        countResources: document.getElementById('count-resources'),
        countLeads: document.getElementById('count-leads'),
        countOpportunities: document.getElementById('count-opportunities'),
        countMine: document.getElementById('count-mine'),
        countPending: document.getElementById('count-pending'),
        inspector: document.getElementById('collections-inspector'),
        inspectorEmpty: document.getElementById('collections-inspector-empty'),
        inspectorBody: document.getElementById('collections-inspector-body'),
        inspectorClose: document.getElementById('inspector-close'),
        inspectorType: document.getElementById('inspector-type'),
        inspectorTitle: document.getElementById('inspector-title'),
        inspectorSummary: document.getElementById('inspector-summary'),
        inspectorMeta: document.getElementById('inspector-meta'),
        inspectorTags: document.getElementById('inspector-tags'),
        inspectorActions: document.getElementById('inspector-actions')
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
        return '';
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
        params.set('limit', '200');

        if (state.search) params.set('q', state.search);
        if (state.division && state.division !== 'all') params.set('division', state.division);
        if (state.status && state.status !== 'all') params.set('status', state.status);

        return params.toString();
    }

    async function authedFetch(url, options = {}) {
        const token = getStoredAuthToken();

        const headers = {
            'Content-Type': 'application/json',
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

    function normalizeStatusLabel(value = '') {
        const clean = String(value || '').replace(/_/g, ' ').trim();
        return clean ? clean.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Pending Review';
    }

    function getCardStatus(item = {}) {
        if (item.listingStatus === 'listed') return 'listed';
        return item.reviewStatus || 'pending_review';
    }

    function getItemValue(item = {}) {
        const meta = item.publicMeta || {};
        const amount = Number(meta.buyerPriceAmount || 0);
        const currency = String(meta.currency || 'USD').toUpperCase();

        if (amount > 0) return `${currency} ${amount.toLocaleString()}`;
        if (item.monetized) return 'Paid Access';

        return 'Free / Internal';
    }

    function getAllItems() {
        const baseItems = Array.isArray(state.items) ? state.items : [];
        const leadItems = Array.isArray(state.leads) ? state.leads : [];
        const combined = [...baseItems];
        const existingLeadIds = new Set(
            combined
                .filter((item) => item.itemType === 'lead')
                .map((item) => item.id)
        );

        leadItems.forEach((lead) => {
            if (!existingLeadIds.has(lead.id)) combined.push(lead);
        });

        return combined;
    }

    function getVisibleItems() {
        if (state.mode === 'leads') return Array.isArray(state.leads) ? state.leads : [];
        return getAllItems();
    }

    function countByMode(mode = 'all') {
        const all = getAllItems();

        if (mode === 'resources') return all.filter((item) => item.itemType !== 'lead' && item.itemType !== 'opportunity').length;
        if (mode === 'leads') return all.filter((item) => item.itemType === 'lead').length;
        if (mode === 'opportunities') return all.filter((item) => item.itemType === 'opportunity').length;
        if (mode === 'pending') return all.filter((item) => item.reviewStatus === 'pending_review').length;
        if (mode === 'mine') return all.filter((item) => item.createdByUid).length;

        return all.length;
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

    function renderStats() {
        const stats = state.stats || {};
        const allItems = getAllItems();

        if (els.total) els.total.textContent = String(stats.totalItems || allItems.length || 0);
        if (els.leads) els.leads.textContent = String(stats.totalLeads || allItems.filter((item) => item.itemType === 'lead').length || 0);
        if (els.approved) els.approved.textContent = String(stats.approvedItems || allItems.filter((item) => item.reviewStatus === 'approved' || item.listingStatus === 'listed').length || 0);
        if (els.monetized) els.monetized.textContent = String(stats.monetizedItems || allItems.filter((item) => item.monetized).length || 0);

        if (els.countAll) els.countAll.textContent = String(countByMode('all'));
        if (els.countResources) els.countResources.textContent = String(countByMode('resources'));
        if (els.countLeads) els.countLeads.textContent = String(countByMode('leads'));
        if (els.countOpportunities) els.countOpportunities.textContent = String(countByMode('opportunities'));
        if (els.countMine) els.countMine.textContent = String(countByMode('mine'));
        if (els.countPending) els.countPending.textContent = String(countByMode('pending'));
    }

    function renderViewCopy(items = []) {
        const copy = viewCopy[state.mode] || viewCopy.all;

        if (els.viewTitle) els.viewTitle.textContent = copy[0];
        if (els.viewSubtitle) els.viewSubtitle.textContent = copy[1];
        if (els.resultCount) els.resultCount.textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;
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

    function renderBadges(item = {}) {
        const status = getCardStatus(item);

        return `
            <div class="collections-card-badges">
                <span class="collections-badge">${escapeHtml(item.itemType || 'item')}</span>
                <span class="collections-badge">${escapeHtml(item.sourceDivision || 'universe')}</span>
                <span class="collections-badge status-${escapeHtml(status)}">${escapeHtml(normalizeStatusLabel(status))}</span>
            </div>
        `;
    }

    function renderOpenAction(item = {}) {
        const url = String(item.resourceUrl || item.publicMeta?.resourceUrl || '').trim();

        if (!url) return '<span></span>';

        return `
            <a class="collections-open-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
                Open ↗
            </a>
        `;
    }

    function renderCard(item = {}) {
        const summary = item.summary || item.publicMeta?.summary || 'No summary available yet.';
        const createdByName = item.createdByName || 'YH Member';
        const category = item.category || item.itemType || 'Collection Item';
        const selectedClass = state.activeId === item.id ? ' is-selected' : '';

        return `
            <article class="collections-card${selectedClass}" data-collection-id="${escapeHtml(item.id || '')}">
                <div class="collections-card-top">
                    ${renderBadges(item)}

                    <div>
                        <h3>${escapeHtml(item.title || 'Untitled item')}</h3>
                        <p>${escapeHtml(summary).slice(0, 250)}</p>
                    </div>

                    <div class="collections-card-meta">
                        <span>Category: <strong>${escapeHtml(category)}</strong></span>
                        <span>Access: <strong>${escapeHtml(item.targetDivision || item.accessLevel || 'universe')}</strong></span>
                        <span>Submitted by: <strong>${escapeHtml(createdByName)}</strong></span>
                    </div>

                    ${renderTags(item.tags)}
                </div>

                <div class="collections-card-footer">
                    <span class="collections-price">${escapeHtml(getItemValue(item))}</span>
                    ${renderOpenAction(item)}
                </div>
            </article>
        `;
    }

    function renderTableRow(item = {}) {
        const status = getCardStatus(item);
        const selectedClass = state.activeId === item.id ? ' class="is-selected"' : '';

        return `
            <tr data-collection-id="${escapeHtml(item.id || '')}"${selectedClass}>
                <td>
                    <div class="collections-table-title">
                        <strong>${escapeHtml(item.title || 'Untitled item')}</strong>
                        <span>${escapeHtml(item.summary || item.publicMeta?.summary || 'No summary available')}</span>
                    </div>
                </td>
                <td>${escapeHtml(item.itemType || 'item')}</td>
                <td>${escapeHtml(item.sourceDivision || 'universe')}</td>
                <td><span class="collections-badge status-${escapeHtml(status)}">${escapeHtml(normalizeStatusLabel(status))}</span></td>
                <td>${escapeHtml(item.createdByName || 'YH Member')}</td>
                <td><strong>${escapeHtml(getItemValue(item))}</strong></td>
            </tr>
        `;
    }

    function getItemById(id = '') {
        return getAllItems().find((item) => String(item.id) === String(id)) || null;
    }

    function renderInspector(item = null) {
        if (!item) {
            els.inspector?.classList.remove('is-open');
            els.inspectorEmpty?.classList.remove('hidden-step');
            els.inspectorBody?.classList.add('hidden-step');
            return;
        }

        const meta = item.publicMeta || {};
        const status = getCardStatus(item);
        const rows = [
            ['Type', item.itemType || 'item'],
            ['Source Division', item.sourceDivision || 'universe'],
            ['Target / Access', item.targetDivision || item.accessLevel || 'universe'],
            ['Status', normalizeStatusLabel(status)],
            ['Category', item.category || '—'],
            ['Submitted By', item.createdByName || 'YH Member'],
            ['Value', getItemValue(item)],
            ['Private Metadata', item.privateMetaAvailable ? 'Available after unlock / permission' : 'Not attached'],
            ['Source System', item.sourceSystem || '—'],
            ['Source Record', item.sourceRecordId || item.id || '—'],
            ['Updated', item.updatedAt || item.createdAt || '—']
        ];

        if (meta.city || meta.country || meta.location) {
            rows.splice(4, 0, ['Location', meta.location || [meta.city, meta.country].filter(Boolean).join(', ')]);
        }

        if (meta.tier) rows.splice(4, 0, ['Tier', meta.tier]);
        if (meta.contactRole) rows.splice(4, 0, ['Contact Role', meta.contactRole]);

        els.inspector?.classList.add('is-open');
        els.inspectorEmpty?.classList.add('hidden-step');
        els.inspectorBody?.classList.remove('hidden-step');

        if (els.inspectorType) els.inspectorType.textContent = item.itemType || 'Collection Item';
        if (els.inspectorTitle) els.inspectorTitle.textContent = item.title || 'Untitled item';
        if (els.inspectorSummary) els.inspectorSummary.textContent = item.summary || meta.summary || 'No summary available yet.';

        if (els.inspectorMeta) {
            els.inspectorMeta.innerHTML = rows.map(([label, value]) => `
                <div class="collections-inspector-meta-row">
                    <span>${escapeHtml(label)}</span>
                    <strong>${escapeHtml(value || '—')}</strong>
                </div>
            `).join('');
        }

        if (els.inspectorTags) {
            const tags = Array.isArray(item.tags) ? item.tags : [];
            els.inspectorTags.innerHTML = tags.length
                ? tags.slice(0, 10).map((tag) => `<span class="collections-tag">${escapeHtml(tag)}</span>`).join('')
                : '<span class="collections-tag">No tags</span>';
        }

        if (els.inspectorActions) {
            const resourceUrl = String(item.resourceUrl || meta.resourceUrl || '').trim();

            els.inspectorActions.innerHTML = `
                ${resourceUrl ? `<a class="collections-open-link" href="${escapeHtml(resourceUrl)}" target="_blank" rel="noopener noreferrer">Open Resource ↗</a>` : ''}
                <button type="button" class="collections-copy-btn" data-copy-id="${escapeHtml(item.id || '')}">Copy Item ID</button>
            `;
        }
    }

    function selectItem(id = '') {
        state.activeId = String(id || '');
        render();
        renderInspector(getItemById(state.activeId));
    }

    function render() {
        const items = getVisibleItems();

        renderStats();
        renderViewCopy(items);

        if (els.grid) {
            els.grid.innerHTML = items.map(renderCard).join('');
            els.grid.classList.toggle('hidden-step', state.view !== 'grid');
        }

        if (els.tableWrap) {
            els.tableWrap.classList.toggle('hidden-step', state.view !== 'table');
        }

        if (els.tableBody) {
            els.tableBody.innerHTML = items.map(renderTableRow).join('');
        }

        els.empty?.classList.toggle('hidden-step', Boolean(items.length) || state.loading);

        if (state.activeId && !getItemById(state.activeId)) {
            state.activeId = '';
            renderInspector(null);
        }
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
                showError('Collections login session is invalid or expired. Open the private Collections login URL again.');
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
        state.activeId = '';

        els.sideLinks.forEach((link) => {
            link.classList.toggle('is-active', link.dataset.collectionsMode === state.mode);
        });

        renderInspector(null);
        loadCollections();
    }

    function setView(nextView = 'grid') {
        state.view = nextView === 'table' ? 'table' : 'grid';

        els.gridView?.classList.toggle('is-active', state.view === 'grid');
        els.tableView?.classList.toggle('is-active', state.view === 'table');

        render();
    }

    function bindEvents() {
        els.refreshBtn?.addEventListener('click', loadCollections);

        els.sideLinks.forEach((link) => {
            link.addEventListener('click', () => {
                setMode(link.dataset.collectionsMode || 'all');
            });
        });

        els.gridView?.addEventListener('click', () => setView('grid'));
        els.tableView?.addEventListener('click', () => setView('table'));

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

        document.addEventListener('click', (event) => {
            const copyBtn = event.target.closest('[data-copy-id]');
            if (copyBtn) {
                const id = copyBtn.getAttribute('data-copy-id') || '';
                navigator.clipboard?.writeText(id).catch(() => {});
                copyBtn.textContent = 'Copied';
                window.setTimeout(() => {
                    copyBtn.textContent = 'Copy Item ID';
                }, 1100);
                return;
            }

            const card = event.target.closest('[data-collection-id]');
            if (card) {
                selectItem(card.getAttribute('data-collection-id'));
            }
        });

        els.inspectorClose?.addEventListener('click', () => {
            state.activeId = '';
            render();
            renderInspector(null);
        });
    }

    bindEvents();
    loadCollections();
})();