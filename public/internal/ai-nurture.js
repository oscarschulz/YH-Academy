(function bootMentorKnowledgePackManager() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const gate = pathParts[pathParts.length - 1];

    const mentorPresets = {
        alex_hormozi: {
            name: 'Alex Hormozi',
            tags: [
                'alex_hormozi',
                'alex hormozi',
                'hormozi',
                'offer',
                'lead generation',
                'value equation',
                'sales',
                'business',
                'execution'
            ]
        },
        elon_musk: {
            name: 'Elon Musk',
            tags: [
                'elon_musk',
                'elon musk',
                'musk',
                'first principles',
                'spacex',
                'tesla',
                'innovation',
                'execution',
                'product speed'
            ]
        },
        mark_zuckerberg: {
            name: 'Mark Zuckerberg',
            tags: [
                'mark_zuckerberg',
                'mark zuckerberg',
                'zuckerberg',
                'meta',
                'facebook',
                'product iteration',
                'social network',
                'community',
                'platform'
            ]
        },
        steve_jobs: {
            name: 'Steve Jobs',
            tags: [
                'steve_jobs',
                'steve jobs',
                'jobs',
                'apple',
                'simplicity',
                'design',
                'product taste',
                'storytelling',
                'brand'
            ]
        },
        naval_ravikant: {
            name: 'Naval Ravikant',
            tags: [
                'naval_ravikant',
                'naval ravikant',
                'naval',
                'specific knowledge',
                'leverage',
                'judgment',
                'wealth',
                'long term'
            ]
        },
        sam_altman: {
            name: 'Sam Altman',
            tags: [
                'sam_altman',
                'sam altman',
                'openai',
                'startup',
                'scale',
                'ai strategy',
                'ambition',
                'execution'
            ]
        },
        warren_buffett: {
            name: 'Warren Buffett',
            tags: [
                'warren_buffett',
                'warren buffett',
                'buffett',
                'investing',
                'moat',
                'capital allocation',
                'patience',
                'judgment'
            ]
        }
    };

    let mentorPackCache = [];
    const NURTURE_ACTIVE_TAB_KEY = 'yh_ai_nurture_active_tab_v1';

    const ids = {
        mentor: 'mentor-pack-mentor',
        sourceTitle: 'mentor-pack-source-title',
        sourceUrl: 'mentor-pack-source-url',
        coreIdeas: 'mentor-pack-core-ideas',
        frameworks: 'mentor-pack-frameworks',
        practicalLessons: 'mentor-pack-practical-lessons',
        academyUse: 'mentor-pack-academy-use',
        leadershipStyle: 'mentor-pack-leadership-style',
        communicationStyle: 'mentor-pack-communication-style',
        decisionStyle: 'mentor-pack-decision-style',
        doNot: 'mentor-pack-do-not',
        tags: 'mentor-pack-tags',
        approveNow: 'mentor-pack-approve-now',
        save: 'btn-save-mentor-pack',
        clear: 'btn-clear-mentor-pack',
        status: 'mentor-pack-status',
        mentorList: 'mentor-pack-list',
        refreshMentors: 'btn-refresh-mentor-packs',
        batchMentor: 'batch-feed-mentor',
        batchTitlePrefix: 'batch-feed-title-prefix',
        batchUrls: 'batch-feed-urls',
        batchTags: 'batch-feed-tags',
        batchTopicHints: 'batch-feed-topic-hints',
        batchPriority: 'batch-feed-priority',
        batchQueueJobs: 'batch-feed-queue-jobs',
        batchCreate: 'btn-create-batch-sources',
        batchClear: 'btn-clear-batch-sources',
        batchStatus: 'batch-feed-status',
        v2RunLimit: 'v2-run-job-limit',
        v2ApproveLimit: 'v2-approve-source-limit',
        v2RunJobs: 'btn-run-queued-jobs',
        v2ApproveReady: 'btn-approve-ready-sources',
        v2RefreshBoard: 'btn-refresh-nurture-board',
        v2Status: 'v2-processing-status',
        responseSummary: 'response-summary',
        responseStatusPill: 'response-status-pill',
        rawToggle: 'btn-toggle-raw-response',
        output: 'output'
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function valueOf(id) {
        return String(byId(id)?.value || '').trim();
    }

    function checked(id) {
        return byId(id)?.checked === true;
    }

    function escapeHtml(value = '') {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function splitInputList(value = '') {
        return String(value || '')
            .split(/\n|,/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function joinInputList(values = []) {
        return (Array.isArray(values) ? values : [])
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .join('\n');
    }

    function setStatus(message = '', tone = '') {
        const statusEl = byId(ids.status);
        if (!statusEl) return;

        statusEl.classList.remove('is-success', 'is-error');

        if (tone === 'success') {
            statusEl.classList.add('is-success');
        }

        if (tone === 'error') {
            statusEl.classList.add('is-error');
        }

        statusEl.textContent = message || 'No mentor pack saved yet.';
    }

    function setBatchStatus(message = '', tone = '') {
        const statusEl = byId(ids.batchStatus);
        if (!statusEl) return;

        statusEl.classList.remove('is-success', 'is-error');

        if (tone === 'success') {
            statusEl.classList.add('is-success');
        }

        if (tone === 'error') {
            statusEl.classList.add('is-error');
        }

        statusEl.textContent = message || 'No batch submitted yet.';
    }

    function setV2Status(message = '', tone = '') {
        const statusEl = byId(ids.v2Status);
        if (!statusEl) return;

        statusEl.classList.remove('is-success', 'is-error');

        if (tone === 'success') {
            statusEl.classList.add('is-success');
        }

        if (tone === 'error') {
            statusEl.classList.add('is-error');
        }

        statusEl.textContent = message || 'No batch processing action yet.';
    }

    function getResponseSummary(payload = {}, responseOk = true) {
        const success = responseOk && payload?.success !== false;
        const tone = success ? 'success' : 'error';

        let title = success ? 'Action completed' : 'Action failed';
        let message = payload?.message || (success
            ? 'The AI Nurture action completed successfully.'
            : 'The AI Nurture action could not be completed.');

        const meta = [];

        if (payload?.createdCount !== undefined) meta.push(`Sources: ${payload.createdCount}`);
        if (payload?.jobCount !== undefined) meta.push(`Jobs: ${payload.jobCount}`);
        if (payload?.failedCount !== undefined) meta.push(`Failed: ${payload.failedCount}`);
        if (payload?.requestedCount !== undefined) meta.push(`Requested: ${payload.requestedCount}`);
        if (payload?.runCount !== undefined) meta.push(`Jobs processed: ${payload.runCount}`);
        if (payload?.approvedCount !== undefined) meta.push(`Approved: ${payload.approvedCount}`);
        if (payload?.skippedCount !== undefined) meta.push(`Skipped: ${payload.skippedCount}`);

        if (payload?.source?.id) {
            title = success ? 'Source saved' : title;
            message = success ? 'The source was created or updated successfully.' : message;
            meta.push(`Source ID: ${payload.source.id}`);
        }

        if (payload?.jobId) {
            title = success ? 'Job processed' : title;
            meta.push(`Job ID: ${payload.jobId}`);
        }

        if (payload?.libraryEntry?.id) {
            title = success ? 'Knowledge saved' : title;
            meta.push(`Library ID: ${payload.libraryEntry.id}`);
        }

        if (Array.isArray(payload?.contextPacks)) {
            meta.push(`Context packs: ${payload.contextPacks.length}`);
        }

        return { success, tone, title, message, meta };
    }

    function setOutput(payload = {}, responseOk = true) {
        const output = byId(ids.output);
        const summaryEl = byId(ids.responseSummary);
        const statusPill = byId(ids.responseStatusPill);
        const rawToggle = byId(ids.rawToggle);
        const summary = getResponseSummary(payload, responseOk);

        if (output) {
            output.textContent = JSON.stringify(payload, null, 2);
            output.hidden = true;
        }

        if (summaryEl) {
            summaryEl.classList.remove('is-idle', 'is-success', 'is-error');
            summaryEl.classList.add(summary.tone === 'success' ? 'is-success' : 'is-error');

            summaryEl.innerHTML = `
                <div class="response-summary-title">${escapeHtml(summary.title)}</div>
                <div class="response-summary-message">${escapeHtml(summary.message)}</div>
                <div id="response-summary-meta" class="response-summary-meta">
                    ${summary.meta.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
                </div>
            `;
        }

        if (statusPill) {
            statusPill.className = `chip ${summary.tone === 'success' ? 'ok' : 'danger'}`;
            statusPill.textContent = summary.success ? 'Success' : 'Failed';
        }

        if (rawToggle) {
            rawToggle.textContent = 'Show full response';
        }
    }

    function toggleRawResponse() {
        const output = byId(ids.output);
        const rawToggle = byId(ids.rawToggle);

        if (!output || !rawToggle) return;

        const nextHidden = !output.hidden;
        output.hidden = nextHidden;
        rawToggle.textContent = nextHidden ? 'Show full response' : 'Hide full response';
    }

    async function request(path, options = {}) {
        const response = await fetch(`/api/internal/ai-nurture/${gate}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        const result = await response.json().catch(() => ({}));
        setOutput(result, response.ok);

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Request failed.');
        }

        return result;
    }

    function isMentorPack(item = {}) {
        return String(item.knowledgeType || '').trim().toLowerCase() === 'mentor_pack';
    }

    function renderMentorPacks(items = []) {
        const listEl = byId(ids.mentorList);
        if (!listEl) return;

        mentorPackCache = Array.isArray(items) ? items.filter(isMentorPack) : [];

        if (!mentorPackCache.length) {
            listEl.classList.add('muted');
            listEl.innerHTML = '<div class="empty-box">No mentor packs found yet.</div>';
            return;
        }

        listEl.classList.remove('muted');
        listEl.innerHTML = mentorPackCache.map((item) => {
            const tags = Array.isArray(item.retrievalTags) ? item.retrievalTags.slice(0, 8) : [];
            const rules = Array.isArray(item.usableRules) ? item.usableRules : [];
            const title = item.title || 'Untitled mentor pack';
            const summary = item.summary || rules.slice(0, 2).join(' ');

            return `
                <div class="mentor-pack-item" data-mentor-pack-id="${escapeHtml(item.id)}">
                    <div class="mentor-pack-item-head">
                        <div>
                            <div class="mentor-pack-item-title">${escapeHtml(title)}</div>
                            <div class="mentor-pack-item-meta">
                                <span class="chip info">${escapeHtml(item.category || 'mentor')}</span>
                                <span class="chip">${escapeHtml(item.subCategory || 'learn-from')}</span>
                                <span class="chip ok">${rules.length} rules</span>
                                <span class="chip">${escapeHtml(item.status || 'active')}</span>
                            </div>
                        </div>

                        <div class="mentor-pack-item-actions">
                            <button type="button" class="secondary" data-mentor-action="view" data-mentor-pack-id="${escapeHtml(item.id)}">View</button>
                            <button type="button" class="danger" data-mentor-action="delete" data-mentor-pack-id="${escapeHtml(item.id)}">Delete</button>
                        </div>
                    </div>

                    <div class="mentor-pack-item-summary">${escapeHtml(summary).slice(0, 420)}</div>

                    ${tags.length ? `
                        <div class="chip-wrap">
                            ${tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    async function loadMentorPacks() {
        const listEl = byId(ids.mentorList);

        try {
            if (listEl) {
                listEl.classList.add('muted');
                listEl.textContent = 'Loading mentor packs…';
            }

            const result = await request('/library?limit=200', {
                method: 'GET'
            });

            renderMentorPacks(result.items || []);
        } catch (error) {
            if (listEl) {
                listEl.classList.add('muted');
                listEl.innerHTML = `<div class="empty-box">Failed to load mentor packs: ${escapeHtml(error.message || 'Unknown error')}</div>`;
            }
        }
    }

    async function deleteMentorPack(libraryId = '') {
        const cleanId = String(libraryId || '').trim();
        const item = mentorPackCache.find((entry) => entry.id === cleanId);

        if (!cleanId || !item) {
            setStatus('Mentor pack not found in current list.', 'error');
            return;
        }

        const title = item.title || 'this mentor pack';
        const confirmed = window.confirm(`Delete "${title}" from AI Nurture? This removes its memory cards and rebuilds context packs.`);

        if (!confirmed) return;

        try {
            setStatus(`Deleting ${title}…`, '');

            const result = await request(`/mentor-packs/${encodeURIComponent(cleanId)}`, {
                method: 'DELETE'
            });

            setStatus(
                `Deleted ${title}. Removed ${result.deletedCardCount || 0} cards. Context packs rebuilt: ${(result.contextPacks || []).length}.`,
                'success'
            );

            await loadMentorPacks();

            try {
                if (typeof loadLibrary === 'function') await loadLibrary();
                if (typeof loadPacks === 'function') await loadPacks();
            } catch (_) {}
        } catch (error) {
            setStatus(error.message || 'Failed to delete mentor pack.', 'error');
        }
    }

    function handleMentorPackListClick(event) {
        const button = event.target?.closest?.('[data-mentor-action]');
        if (!button) return;

        const action = button.getAttribute('data-mentor-action');
        const libraryId = button.getAttribute('data-mentor-pack-id');
        const item = mentorPackCache.find((entry) => entry.id === libraryId);

        if (action === 'view') {
            setOutput({
                success: true,
                mentorPack: item || null
            });
            return;
        }

        if (action === 'delete') {
            deleteMentorPack(libraryId);
        }
    }

    function syncMentorPreset() {
        const mentorKey = valueOf(ids.mentor);
        const preset = mentorPresets[mentorKey];

        if (!preset) return;

        const tagsInput = byId(ids.tags);
        if (tagsInput && !String(tagsInput.value || '').trim()) {
            tagsInput.value = joinInputList(preset.tags);
        }

        const titleInput = byId(ids.sourceTitle);
        if (titleInput && !String(titleInput.value || '').trim()) {
            titleInput.value = `${preset.name} - NotebookLM Mentor Knowledge Pack`;
        }
    }

    function syncBatchPreset() {
        const mentorKey = valueOf(ids.batchMentor);
        const preset = mentorPresets[mentorKey];

        if (!preset) return;

        const tagsInput = byId(ids.batchTags);
        if (tagsInput && !String(tagsInput.value || '').trim()) {
            tagsInput.value = joinInputList(preset.tags);
        }

        const hintsInput = byId(ids.batchTopicHints);
        if (hintsInput && !String(hintsInput.value || '').trim()) {
            hintsInput.value = joinInputList([
                preset.name,
                mentorKey.replace(/_/g, ' '),
                'academy ai coach',
                'learn from'
            ]);
        }

        const titlePrefixInput = byId(ids.batchTitlePrefix);
        if (titlePrefixInput && !String(titlePrefixInput.value || '').trim()) {
            titlePrefixInput.value = `${preset.name} Batch`;
        }
    }

    function extractBatchUrls(value = '') {
        const raw = String(value || '').trim();

        if (!raw) return [];

        const matches = raw.match(/https?:\/\/[^\s,]+/gi) || raw.split(/\n|,/);

        const urls = [];
        for (const item of matches) {
            const clean = String(item || '')
                .trim()
                .replace(/[)\].,;]+$/g, '');

            if (!/^https?:\/\//i.test(clean)) continue;

            try {
                const parsed = new URL(clean);
                parsed.hash = '';
                const normalized = parsed.toString();

                if (!urls.includes(normalized)) {
                    urls.push(normalized);
                }
            } catch (_) {}

            if (urls.length >= 100) break;
        }

        return urls;
    }

    function buildBatchPayload() {
        const mentorKey = valueOf(ids.batchMentor);
        const preset = mentorPresets[mentorKey] || {};

        return {
            mentorKey,
            mentorName: preset.name || mentorKey,
            urls: extractBatchUrls(valueOf(ids.batchUrls)),
            titlePrefix: valueOf(ids.batchTitlePrefix),
            manualTags: splitInputList(valueOf(ids.batchTags)),
            topicHints: splitInputList(valueOf(ids.batchTopicHints)),
            queuePriority: Number.parseInt(valueOf(ids.batchPriority), 10) || 3,
            queueJobs: checked(ids.batchQueueJobs)
        };
    }

    function clearBatchForm() {
        [
            ids.batchTitlePrefix,
            ids.batchUrls,
            ids.batchTags,
            ids.batchTopicHints
        ].forEach((id) => {
            const el = byId(id);
            if (el) el.value = '';
        });

        const priorityEl = byId(ids.batchPriority);
        if (priorityEl) priorityEl.value = '3';

        const queueJobsEl = byId(ids.batchQueueJobs);
        if (queueJobsEl) queueJobsEl.checked = true;

        syncBatchPreset();
        setBatchStatus('Batch form cleared. Paste the next set of links.', '');
    }

    async function createBatchSources() {
        const button = byId(ids.batchCreate);
        const payload = buildBatchPayload();

        if (!payload.urls.length) {
            setBatchStatus('Paste at least one valid URL before creating batch sources.', 'error');
            return;
        }

        try {
            if (button) {
                button.disabled = true;
                button.textContent = 'Creating batch...';
            }

            setBatchStatus(`Creating ${payload.urls.length} source(s)...`, '');

            const result = await request('/sources/batch', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const createdCount = Array.isArray(result.sources) ? result.sources.length : 0;
            const jobCount = Array.isArray(result.jobs) ? result.jobs.length : 0;
            const failedCount = Array.isArray(result.failed) ? result.failed.length : 0;

            setBatchStatus(
                `Batch created. Sources: ${createdCount}. Jobs queued: ${jobCount}. Failed: ${failedCount}.`,
                failedCount ? 'error' : 'success'
            );

            try {
                if (typeof loadSources === 'function') await loadSources();
                if (typeof loadJobs === 'function') await loadJobs();
            } catch (_) {}
        } catch (error) {
            setBatchStatus(error.message || 'Failed to create batch sources.', 'error');
            setOutput({
                success: false,
                message: error.message || 'Failed to create batch sources.'
            });
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'Create Batch Sources';
            }
        }
    }

    async function refreshNurtureBoard() {
        try {
            setV2Status('Refreshing AI Nurture board...', '');

            await Promise.all([
                typeof loadSources === 'function' ? loadSources() : Promise.resolve(),
                typeof loadJobs === 'function' ? loadJobs() : Promise.resolve(),
                typeof loadPacks === 'function' ? loadPacks() : Promise.resolve(),
                typeof loadLibrary === 'function' ? loadLibrary() : Promise.resolve(),
                loadMentorPacks()
            ]);

            setV2Status('Board refreshed.', 'success');
        } catch (error) {
            setV2Status(error.message || 'Failed to refresh board.', 'error');
        }
    }

    async function runQueuedJobsBatch() {
        const button = byId(ids.v2RunJobs);
        const maxRuns = Number.parseInt(valueOf(ids.v2RunLimit), 10) || 10;

        try {
            if (button) {
                button.disabled = true;
                button.textContent = 'Running jobs...';
            }

            setV2Status(`Running up to ${maxRuns} queued job(s)...`, '');

            const result = await request('/jobs/run-batch', {
                method: 'POST',
                body: JSON.stringify({ maxRuns })
            });

            const runCount = Number(result.runCount || 0);
            const stoppedReason = result.stoppedReason || (runCount ? 'completed' : 'no queued jobs');

            setV2Status(
                `Batch job run complete. Jobs processed: ${runCount}. Status: ${stoppedReason}.`,
                'success'
            );

            await refreshNurtureBoard();
        } catch (error) {
            setV2Status(error.message || 'Failed to run queued jobs.', 'error');
            setOutput({
                success: false,
                message: error.message || 'Failed to run queued jobs.'
            });
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'Run Queued Jobs';
            }
        }
    }

    async function approveReadySourcesBatch() {
        const button = byId(ids.v2ApproveReady);
        const limit = Number.parseInt(valueOf(ids.v2ApproveLimit), 10) || 25;

        try {
            if (button) {
                button.disabled = true;
                button.textContent = 'Approving...';
            }

            setV2Status(`Approving up to ${limit} reviewed source(s)...`, '');

            const result = await request('/sources/approve-ready', {
                method: 'POST',
                body: JSON.stringify({ limit })
            });

            setV2Status(
                `Approve-ready complete. Approved: ${result.approvedCount || 0}. Skipped: ${result.skippedCount || 0}. Failed: ${result.failedCount || 0}.`,
                result.failedCount ? 'error' : 'success'
            );

            await refreshNurtureBoard();
        } catch (error) {
            setV2Status(error.message || 'Failed to approve ready sources.', 'error');
            setOutput({
                success: false,
                message: error.message || 'Failed to approve ready sources.'
            });
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'Approve Ready Sources';
            }
        }
    }

    function setActiveNurtureTab(tabKey = 'intake') {
        const validTabs = ['intake', 'processing', 'mentors', 'context'];
        const activeKey = validTabs.includes(tabKey) ? tabKey : 'intake';

        document.querySelectorAll('[data-nurture-tab]').forEach((button) => {
            const isActive = button.getAttribute('data-nurture-tab') === activeKey;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        document.querySelectorAll('[data-nurture-panel]').forEach((panel) => {
            panel.classList.toggle('is-active', panel.getAttribute('data-nurture-panel') === activeKey);
        });

        try {
            localStorage.setItem(NURTURE_ACTIVE_TAB_KEY, activeKey);
        } catch (_) {}

        if (activeKey === 'processing') {
            try {
                if (typeof loadSources === 'function') loadSources();
                if (typeof loadJobs === 'function') loadJobs();
                if (typeof loadPacks === 'function') loadPacks();
                if (typeof loadLibrary === 'function') loadLibrary();
            } catch (_) {}
        }

        if (activeKey === 'mentors') {
            loadMentorPacks();
        }
    }

    function bindNurtureTabs() {
        const buttons = [...document.querySelectorAll('[data-nurture-tab]')];
        if (!buttons.length) return;

        buttons.forEach((button) => {
            button.addEventListener('click', () => {
                setActiveNurtureTab(button.getAttribute('data-nurture-tab') || 'intake');
            });
        });

        let savedTab = 'intake';

        try {
            savedTab = localStorage.getItem(NURTURE_ACTIVE_TAB_KEY) || 'intake';
        } catch (_) {}

        const hashTab = String(window.location.hash || '').replace('#', '').trim();
        setActiveNurtureTab(hashTab || savedTab || 'intake');
    }

    function buildMentorPayload() {
        const mentorKey = valueOf(ids.mentor);
        const preset = mentorPresets[mentorKey] || {};

        return {
            mentorKey,
            mentorName: preset.name || mentorKey,
            sourceTitle: valueOf(ids.sourceTitle),
            sourceUrl: valueOf(ids.sourceUrl),
            coreIdeas: splitInputList(valueOf(ids.coreIdeas)),
            businessFrameworks: splitInputList(valueOf(ids.frameworks)),
            practicalLessons: splitInputList(valueOf(ids.practicalLessons)),
            academyUse: splitInputList(valueOf(ids.academyUse)),
            leadershipStyle: valueOf(ids.leadershipStyle),
            communicationStyle: valueOf(ids.communicationStyle),
            decisionMakingStyle: valueOf(ids.decisionStyle),
            doNot: splitInputList(valueOf(ids.doNot)),
            tags: splitInputList(valueOf(ids.tags)),
            approveNow: checked(ids.approveNow)
        };
    }

    function clearMentorForm() {
        [
            ids.sourceTitle,
            ids.sourceUrl,
            ids.coreIdeas,
            ids.frameworks,
            ids.practicalLessons,
            ids.academyUse,
            ids.leadershipStyle,
            ids.communicationStyle,
            ids.decisionStyle,
            ids.doNot,
            ids.tags
        ].forEach((id) => {
            const el = byId(id);
            if (el) el.value = '';
        });

        const approveEl = byId(ids.approveNow);
        if (approveEl) approveEl.checked = true;

        syncMentorPreset();
        setStatus('Form cleared. Paste the next NotebookLM mentor pack.', '');
    }

    async function saveMentorPack() {
        const saveButton = byId(ids.save);
        const payload = buildMentorPayload();

        if (!payload.mentorKey) {
            setStatus('Choose a mentor before saving.', 'error');
            return;
        }

        const hasKnowledge =
            payload.coreIdeas.length ||
            payload.businessFrameworks.length ||
            payload.practicalLessons.length ||
            payload.academyUse.length ||
            payload.leadershipStyle ||
            payload.communicationStyle ||
            payload.decisionMakingStyle;

        if (!hasKnowledge) {
            setStatus('Paste at least one useful knowledge field before saving.', 'error');
            return;
        }

        try {
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = 'Saving...';
            }

            setStatus('Saving mentor knowledge pack...', '');

            const result = await request('/mentor-packs', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const libraryId = result?.libraryEntry?.id || 'created';
            const cardCount = Array.isArray(result?.cards) ? result.cards.length : 0;
            const packCount = Array.isArray(result?.contextPacks) ? result.contextPacks.length : 0;

            setStatus(
                `Saved ${payload.mentorName} mentor pack. Library: ${libraryId}. Cards: ${cardCount}. Context packs rebuilt: ${packCount}.`,
                'success'
            );

            const categoryInput = byId('context-category-hints');
            const tagInput = byId('context-tag-hints');

            if (categoryInput) categoryInput.value = payload.mentorName.toLowerCase();
            if (tagInput) tagInput.value = joinInputList(payload.tags);

            try {
                if (typeof loadLibrary === 'function') await loadLibrary();
                if (typeof loadPacks === 'function') await loadPacks();
                await loadMentorPacks();
            } catch (_) {}
        } catch (error) {
            setStatus(error.message || 'Failed to save mentor knowledge pack.', 'error');
            setOutput({
                success: false,
                message: error.message || 'Failed to save mentor knowledge pack.'
            });
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'Save Mentor Pack';
            }
        }
    }

    function bindMentorManager() {
        const mentorSelect = byId(ids.mentor);
        const saveButton = byId(ids.save);
        const clearButton = byId(ids.clear);
        const refreshButton = byId(ids.refreshMentors);
        const mentorList = byId(ids.mentorList);
        const batchMentorSelect = byId(ids.batchMentor);
        const batchCreateButton = byId(ids.batchCreate);
        const batchClearButton = byId(ids.batchClear);
        const v2RunJobsButton = byId(ids.v2RunJobs);
        const v2ApproveReadyButton = byId(ids.v2ApproveReady);
        const v2RefreshBoardButton = byId(ids.v2RefreshBoard);
        const rawResponseToggle = byId(ids.rawToggle);

        if (!mentorSelect || !saveButton) return;

        mentorSelect.addEventListener('change', () => {
            const tagsInput = byId(ids.tags);
            const titleInput = byId(ids.sourceTitle);

            if (tagsInput) tagsInput.value = '';
            if (titleInput) titleInput.value = '';

            syncMentorPreset();
        });

        batchMentorSelect?.addEventListener('change', () => {
            const tagsInput = byId(ids.batchTags);
            const hintsInput = byId(ids.batchTopicHints);
            const titlePrefixInput = byId(ids.batchTitlePrefix);

            if (tagsInput) tagsInput.value = '';
            if (hintsInput) hintsInput.value = '';
            if (titlePrefixInput) titlePrefixInput.value = '';

            syncBatchPreset();
        });

        saveButton.addEventListener('click', saveMentorPack);
        batchCreateButton?.addEventListener('click', createBatchSources);
        v2RunJobsButton?.addEventListener('click', runQueuedJobsBatch);
        v2ApproveReadyButton?.addEventListener('click', approveReadySourcesBatch);
        v2RefreshBoardButton?.addEventListener('click', refreshNurtureBoard);
        rawResponseToggle?.addEventListener('click', toggleRawResponse);

        clearButton?.addEventListener('click', clearMentorForm);
        batchClearButton?.addEventListener('click', clearBatchForm);
        refreshButton?.addEventListener('click', loadMentorPacks);
        mentorList?.addEventListener('click', handleMentorPackListClick);

        bindNurtureTabs();
        syncMentorPreset();
        syncBatchPreset();
        loadMentorPacks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindMentorManager);
    } else {
        bindMentorManager();
    }
})();