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

    function setOutput(payload = {}) {
        const output = byId(ids.output);
        if (!output) return;
        output.textContent = JSON.stringify(payload, null, 2);
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
        setOutput(result);

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Request failed.');
        }

        return result;
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

        if (!mentorSelect || !saveButton) return;

        mentorSelect.addEventListener('change', () => {
            const tagsInput = byId(ids.tags);
            const titleInput = byId(ids.sourceTitle);

            if (tagsInput) tagsInput.value = '';
            if (titleInput) titleInput.value = '';

            syncMentorPreset();
        });

        saveButton.addEventListener('click', saveMentorPack);

        clearButton?.addEventListener('click', clearMentorForm);

        syncMentorPreset();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindMentorManager);
    } else {
        bindMentorManager();
    }
})();