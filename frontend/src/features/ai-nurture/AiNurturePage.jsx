import React, { useMemo, useLayoutEffect } from 'react'
import './AiNurturePage.css'
const markup = "<div class=\"shell nurture-shell\">\r\n        <div class=\"card nurture-hero\">\r\n            <div>\r\n                <span class=\"nurture-eyebrow\">Internal AI Knowledge Engine</span>\r\n                <h1>AI Nurture Console</h1>\r\n                <div class=\"muted\">Curate source data, batch-feed mentor knowledge, process jobs, approve learning packs, and monitor Academy AI context.</div>\r\n            </div>\r\n\r\n            <div class=\"nurture-hero-meta\">\r\n                <span class=\"chip info\">Hidden console</span>\r\n                <span class=\"chip ok\">Academy AI</span>\r\n            </div>\r\n        </div>\r\n\r\n        <div class=\"nurture-tabs\" role=\"tablist\" aria-label=\"AI Nurture sections\">\r\n            <button type=\"button\" class=\"nurture-tab is-active\" data-nurture-tab=\"intake\" aria-selected=\"true\">Intake</button>\r\n            <button type=\"button\" class=\"nurture-tab\" data-nurture-tab=\"processing\" aria-selected=\"false\">Processing</button>\r\n            <button type=\"button\" class=\"nurture-tab\" data-nurture-tab=\"mentors\" aria-selected=\"false\">Mentor Packs</button>\r\n            <button type=\"button\" class=\"nurture-tab\" data-nurture-tab=\"context\" aria-selected=\"false\">Context & Users</button>\r\n        </div>\r\n\r\n        <div class=\"row nurture-tab-panel is-active\" data-nurture-panel=\"intake\">\r\n            <div class=\"card\">\r\n                <h2>Create Source</h2>\r\n                <input id=\"source-url\" type=\"url\" placeholder=\"https://example.com/article\">\r\n                <div class=\"actions\">\r\n                    <button id=\"btn-create-source\" type=\"button\">Create Source</button>\r\n                    <button id=\"btn-run-next-job\" type=\"button\" class=\"secondary\">Run Next Job</button>\r\n                    <button id=\"btn-rebuild-packs\" type=\"button\" class=\"secondary\">Rebuild Packs</button>\r\n                </div>\r\n            </div>\r\n\r\n            <div class=\"card system-response-card\">\r\n                <div class=\"system-response-head\">\r\n                    <div>\r\n                        <h2>Activity Status</h2>\r\n                        <div class=\"muted\">Clean action feedback. Open the full response only when you need technical details.</div>\r\n                    </div>\r\n                    <span id=\"response-status-pill\" class=\"chip info\">Idle</span>\r\n                </div>\r\n\r\n                <div id=\"response-summary\" class=\"response-summary is-idle\">\r\n                    <div class=\"response-summary-title\">No action yet</div>\r\n                    <div class=\"response-summary-message\">Run an AI Nurture action to see the latest result here.</div>\r\n                    <div id=\"response-summary-meta\" class=\"response-summary-meta\"></div>\r\n                </div>\r\n\r\n                <div class=\"actions\">\r\n                    <button id=\"btn-toggle-raw-response\" type=\"button\" class=\"secondary\">Show full response</button>\r\n                </div>\r\n\r\n                <pre id=\"output\" class=\"raw-response-panel\" hidden>{}</pre>\r\n            </div>\r\n        </div>\r\n\r\n        <div class=\"card source-discovery-card nurture-tab-panel is-active\" data-nurture-panel=\"intake\">\r\n            <div class=\"source-discovery-head\">\r\n                <div>\r\n                    <h2>Source Discovery</h2>\r\n                    <div class=\"muted\">Paste a YouTube playlist, channel page, article page, or raw text. The system will extract links and let you import selected URLs into Batch Link Feeder.</div>\r\n                </div>\r\n                <span class=\"chip info\">V3 discovery</span>\r\n            </div>\r\n\r\n            <div class=\"split-2\">\r\n                <select id=\"discovery-mentor\">\r\n                    <option value=\"alex_hormozi\">Alex Hormozi</option>\r\n                    <option value=\"elon_musk\">Elon Musk</option>\r\n                    <option value=\"mark_zuckerberg\">Mark Zuckerberg</option>\r\n                    <option value=\"steve_jobs\">Steve Jobs</option>\r\n                    <option value=\"naval_ravikant\">Naval Ravikant</option>\r\n                    <option value=\"sam_altman\">Sam Altman</option>\r\n                    <option value=\"warren_buffett\">Warren Buffett</option>\r\n                    <option value=\"jeff_bezos\">Jeff Bezos</option>\r\n                    <option value=\"julius_caesar\">Julius Caesar</option>\r\n                    <option value=\"alexander_the_great\">Alexander The Great</option>\r\n                    <option value=\"marcus_aurelius\">Marcus Aurelius</option>\r\n                    <option value=\"seneca\">Seneca</option>\r\n                    <option value=\"epictetus\">Epictetus</option>\r\n                    <option value=\"socrates\">Socrates</option>\r\n                    <option value=\"plato\">Plato</option>\r\n                    <option value=\"aristotle\">Aristotle</option>\r\n                    <option value=\"confucius\">Confucius</option>\r\n                    <option value=\"sun_tzu\">Sun Tzu</option>\r\n                    <option value=\"niccolo_machiavelli\">Niccolò Machiavelli</option>\r\n                </select>\r\n\r\n                <select id=\"discovery-limit\">\r\n                    <option value=\"25\">Find up to 25 links</option>\r\n                    <option value=\"50\" selected>Find up to 50 links</option>\r\n                    <option value=\"100\">Find up to 100 links</option>\r\n                </select>\r\n            </div>\r\n\r\n            <input id=\"discovery-target-url\" type=\"url\" placeholder=\"Paste YouTube playlist/channel/page URL or article page\">\r\n\r\n            <textarea id=\"discovery-raw-text\" rows=\"5\" placeholder=\"Optional: paste raw copied page text, YouTube links, notes, or HTML here. The extractor will scan it for URLs.\"></textarea>\r\n\r\n            <div class=\"actions\">\r\n                <button id=\"btn-discover-source-links\" type=\"button\">Discover Links</button>\r\n                <button id=\"btn-import-discovered-links\" type=\"button\" class=\"secondary\">Import Selected to Batch Feed</button>\r\n                <button id=\"btn-clear-discovery\" type=\"button\" class=\"secondary\">Clear Discovery</button>\r\n            </div>\r\n\r\n            <div id=\"discovery-status\" class=\"muted\">No discovery scan yet.</div>\r\n            <div id=\"discovery-results\" class=\"discovery-results muted\">Discovered links will appear here.</div>\r\n        </div>\r\n\r\n        <div class=\"card batch-feed-card nurture-tab-panel is-active\" data-nurture-panel=\"intake\">\r\n            <div class=\"batch-feed-head\">\r\n                <div>\r\n                    <h2>Batch Link Feeder</h2>\r\n                    <div class=\"muted\">Paste many YouTube/article links at once. The system will create AI Nurture sources and queue processing jobs with the selected mentor tags.</div>\r\n                </div>\r\n                <span class=\"chip info\">Bulk source intake</span>\r\n            </div>\r\n\r\n            <div class=\"split-2\">\r\n                <select id=\"batch-feed-mentor\">\r\n                    <option value=\"alex_hormozi\">Alex Hormozi</option>\r\n                    <option value=\"elon_musk\">Elon Musk</option>\r\n                    <option value=\"mark_zuckerberg\">Mark Zuckerberg</option>\r\n                    <option value=\"steve_jobs\">Steve Jobs</option>\r\n                    <option value=\"naval_ravikant\">Naval Ravikant</option>\r\n                    <option value=\"sam_altman\">Sam Altman</option>\r\n                    <option value=\"warren_buffett\">Warren Buffett</option>\r\n                </select>\r\n\r\n                <input id=\"batch-feed-title-prefix\" type=\"text\" placeholder=\"Optional title prefix, e.g. Elon Musk Batch\">\r\n            </div>\r\n\r\n            <textarea id=\"batch-feed-urls\" rows=\"8\" placeholder=\"Paste links here, one per line. Supports YouTube videos, articles, public pages, and other source URLs.\"></textarea>\r\n\r\n            <div class=\"split-2\">\r\n                <textarea id=\"batch-feed-tags\" rows=\"4\" placeholder=\"Manual tags, comma or line separated\"></textarea>\r\n                <textarea id=\"batch-feed-topic-hints\" rows=\"4\" placeholder=\"Topic hints, comma or line separated\"></textarea>\r\n            </div>\r\n\r\n            <div class=\"split-2\">\r\n                <select id=\"batch-feed-priority\">\r\n                    <option value=\"5\">Priority 5 · Highest</option>\r\n                    <option value=\"4\">Priority 4 · High</option>\r\n                    <option value=\"3\" selected>Priority 3 · Normal</option>\r\n                    <option value=\"2\">Priority 2 · Low</option>\r\n                    <option value=\"1\">Priority 1 · Lowest</option>\r\n                </select>\r\n\r\n                <label class=\"toggle-row batch-feed-toggle\">\r\n                    <input id=\"batch-feed-queue-jobs\" type=\"checkbox\" checked>\r\n                    <span>Queue processing jobs after creating sources</span>\r\n                </label>\r\n            </div>\r\n\r\n            <div class=\"actions\">\r\n                <button id=\"btn-create-batch-sources\" type=\"button\">Create Batch Sources</button>\r\n                <button id=\"btn-clear-batch-sources\" type=\"button\" class=\"secondary\">Clear Batch</button>\r\n            </div>\r\n\r\n            <div id=\"batch-feed-status\" class=\"muted\">No batch submitted yet.</div>\r\n        </div>\r\n\r\n        <div class=\"card ai-nurture-v2-card nurture-tab-panel\" data-nurture-panel=\"processing\">\r\n            <div class=\"ai-nurture-v2-head\">\r\n                <div>\r\n                    <h2>Batch Processing Control Panel</h2>\r\n                    <div class=\"muted\">Run queued source jobs, approve reviewed sources, and refresh the AI Nurture board without clicking each source one by one.</div>\r\n                </div>\r\n                <span class=\"chip info\">V2 controls</span>\r\n            </div>\r\n\r\n            <div class=\"split-2\">\r\n                <select id=\"v2-run-job-limit\">\r\n                    <option value=\"5\">Run next 5 jobs</option>\r\n                    <option value=\"10\" selected>Run next 10 jobs</option>\r\n                    <option value=\"15\">Run next 15 jobs</option>\r\n                    <option value=\"25\">Run next 25 jobs</option>\r\n                </select>\r\n\r\n                <select id=\"v2-approve-source-limit\">\r\n                    <option value=\"10\">Approve up to 10 ready sources</option>\r\n                    <option value=\"25\" selected>Approve up to 25 ready sources</option>\r\n                    <option value=\"50\">Approve up to 50 ready sources</option>\r\n                </select>\r\n            </div>\r\n\r\n            <div class=\"actions\">\r\n                <button id=\"btn-run-queued-jobs\" type=\"button\">Run Queued Jobs</button>\r\n                <button id=\"btn-approve-ready-sources\" type=\"button\" class=\"secondary\">Approve Ready Sources</button>\r\n                <button id=\"btn-refresh-nurture-board\" type=\"button\" class=\"secondary\">Refresh Board</button>\r\n            </div>\r\n\r\n            <div id=\"v2-processing-status\" class=\"muted\">No batch processing action yet.</div>\r\n        </div>\r\n\r\n        <div class=\"card batch-history-card nurture-tab-panel\" data-nurture-panel=\"processing\">\r\n            <div class=\"batch-history-head\">\r\n                <div>\r\n                    <h2>Batch History</h2>\r\n                    <div class=\"muted\">Track imported source batches, queued jobs, processing progress, approvals, and failures.</div>\r\n                </div>\r\n                <button id=\"btn-refresh-batch-history\" type=\"button\" class=\"secondary\">Refresh History</button>\r\n            </div>\r\n\r\n            <div class=\"batch-history-toolbar\">\r\n                <input id=\"batch-history-search\" type=\"search\" placeholder=\"Search batch title, mentor, URL, status, or error\">\r\n                <select id=\"batch-history-filter\">\r\n                    <option value=\"all\">All statuses</option>\r\n                    <option value=\"queued\">Queued</option>\r\n                    <option value=\"processing\">Processing</option>\r\n                    <option value=\"partial\">Partial</option>\r\n                    <option value=\"failed\">Failed</option>\r\n                    <option value=\"completed\">Completed</option>\r\n                    <option value=\"approved\">Approved</option>\r\n                </select>\r\n                <button id=\"btn-clear-batch-history-filters\" type=\"button\" class=\"secondary\">Clear Filters</button>\r\n            </div>\r\n            <div class=\"batch-history-live-row\">\r\n                <label class=\"batch-history-live-toggle\">\r\n                    <input id=\"batch-history-auto-refresh\" type=\"checkbox\">\r\n                    <span>Auto-refresh live progress every 15 seconds</span>\r\n                </label>\r\n                <div id=\"batch-history-live-status\" class=\"batch-history-live-status muted\">Auto-refresh is off.</div>\r\n            </div>\r\n            <div id=\"batch-history-result-count\" class=\"batch-history-result-count muted\">Showing latest batches.</div>\r\n\r\n            <div id=\"batch-history-list\" class=\"batch-history-list muted\">Loading batch history…</div>\r\n        </div>\r\n\r\n        <div id=\"batch-details-backdrop\" class=\"batch-details-backdrop\" hidden></div>\r\n        <aside id=\"batch-details-drawer\" class=\"batch-details-drawer\" aria-label=\"Batch details\" hidden>\r\n            <div class=\"batch-details-head\">\r\n                <div>\r\n                    <span class=\"section-label\">Batch detail</span>\r\n                    <h2 id=\"batch-details-title\">Batch Details</h2>\r\n                    <div id=\"batch-details-meta\" class=\"chip-wrap\"></div>\r\n                </div>\r\n                <button id=\"btn-close-batch-details\" type=\"button\" class=\"secondary\">Close</button>\r\n            </div>\r\n\r\n            <div id=\"batch-details-stats\" class=\"batch-details-stats\"></div>\r\n\r\n            <div class=\"batch-details-actions\">\r\n                <button type=\"button\" data-batch-details-action=\"run\">Run Remaining Jobs</button>\r\n                <button type=\"button\" class=\"secondary\" data-batch-details-action=\"retry\">Retry Failed Sources</button>\r\n                <button type=\"button\" class=\"secondary\" data-batch-details-action=\"approve\">Approve Ready Sources</button>\r\n            </div>\r\n            <div id=\"batch-details-action-status\" class=\"batch-details-action-status muted\">Choose a batch action to continue processing this batch.</div>\r\n\r\n            <div class=\"batch-details-section\">\r\n                <h3>Source-Level Progress</h3>\r\n                <div id=\"batch-details-sources\" class=\"batch-source-list muted\">Select a batch to view source progress.</div>\r\n            </div>\r\n\r\n            <div class=\"batch-details-section\">\r\n                <h3>Import Failures</h3>\r\n                <div id=\"batch-details-failures\" class=\"batch-failure-list muted\">No batch selected.</div>\r\n            </div>\r\n        </aside>\r\n\r\n        <div id=\"source-detail-backdrop\" class=\"source-detail-backdrop\" hidden></div>\r\n        <aside id=\"source-detail-drawer\" class=\"source-detail-drawer\" aria-label=\"Source review preview\" hidden>\r\n            <div class=\"source-detail-head\">\r\n                <div>\r\n                    <span class=\"section-label\">Source review preview</span>\r\n                    <h2 id=\"source-detail-title\">Source Detail</h2>\r\n                    <div id=\"source-detail-meta\" class=\"chip-wrap\"></div>\r\n                </div>\r\n                <button id=\"btn-close-source-detail\" type=\"button\" class=\"secondary\">Close</button>\r\n            </div>\r\n\r\n            <div id=\"source-detail-status\" class=\"source-detail-status muted\">Select a source from Batch Details to preview its review.</div>\r\n            <div id=\"source-detail-body\" class=\"source-detail-body muted\">No source selected yet.</div>\r\n        </aside>\r\n\r\n\r\n        <div class=\"card mentor-pack-card nurture-tab-panel\" data-nurture-panel=\"mentors\">\r\n            <div class=\"mentor-pack-head\">\r\n                <div>\r\n                    <h2>Mentor Knowledge Pack Manager</h2>\r\n                    <div class=\"muted\">Paste structured NotebookLM output here and save it as approved Learn-from knowledge for the Academy AI Coach.</div>\r\n                </div>\r\n                <span class=\"chip info\">Learn-from source</span>\r\n            </div>\r\n\r\n            <div class=\"split-2\">\r\n                <select id=\"mentor-pack-mentor\">\r\n                    <option value=\"alex_hormozi\">Alex Hormozi</option>\r\n                    <option value=\"elon_musk\">Elon Musk</option>\r\n                    <option value=\"mark_zuckerberg\">Mark Zuckerberg</option>\r\n                    <option value=\"steve_jobs\">Steve Jobs</option>\r\n                    <option value=\"naval_ravikant\">Naval Ravikant</option>\r\n                    <option value=\"sam_altman\">Sam Altman</option>\r\n                    <option value=\"warren_buffett\">Warren Buffett</option>\r\n                </select>\r\n\r\n                <input id=\"mentor-pack-source-title\" type=\"text\" placeholder=\"Source title / NotebookLM pack title\">\r\n            </div>\r\n\r\n            <input id=\"mentor-pack-source-url\" type=\"url\" placeholder=\"Source URL, YouTube playlist, article, or NotebookLM reference\">\r\n\r\n            <div class=\"mentor-pack-grid\">\r\n                <textarea id=\"mentor-pack-core-ideas\" rows=\"5\" placeholder=\"Core Ideas, one per line\"></textarea>\r\n                <textarea id=\"mentor-pack-frameworks\" rows=\"5\" placeholder=\"Business Frameworks, one per line\"></textarea>\r\n                <textarea id=\"mentor-pack-practical-lessons\" rows=\"5\" placeholder=\"Practical Lessons, one per line\"></textarea>\r\n                <textarea id=\"mentor-pack-academy-use\" rows=\"5\" placeholder=\"How Academy AI Coach Should Use This, one per line\"></textarea>\r\n            </div>\r\n\r\n            <div class=\"mentor-pack-grid\">\r\n                <textarea id=\"mentor-pack-leadership-style\" rows=\"4\" placeholder=\"Leadership Style\"></textarea>\r\n                <textarea id=\"mentor-pack-communication-style\" rows=\"4\" placeholder=\"Communication Style\"></textarea>\r\n                <textarea id=\"mentor-pack-decision-style\" rows=\"4\" placeholder=\"Decision-Making Style\"></textarea>\r\n                <textarea id=\"mentor-pack-do-not\" rows=\"4\" placeholder=\"Do Not, one per line\"></textarea>\r\n            </div>\r\n\r\n            <textarea id=\"mentor-pack-tags\" rows=\"3\" placeholder=\"Tags, comma or line separated\"></textarea>\r\n\r\n            <label class=\"toggle-row\">\r\n                <input id=\"mentor-pack-approve-now\" type=\"checkbox\" checked>\r\n                <span>Approve immediately and rebuild context packs</span>\r\n            </label>\r\n\r\n            <div class=\"actions\">\r\n                <button id=\"btn-save-mentor-pack\" type=\"button\">Save Mentor Pack</button>\r\n                <button id=\"btn-clear-mentor-pack\" type=\"button\" class=\"secondary\">Clear Form</button>\r\n            </div>\r\n\r\n            <div id=\"mentor-pack-status\" class=\"muted\">No mentor pack saved yet.</div>\r\n\r\n            <div class=\"mentor-pack-library-panel\">\r\n                <div class=\"mentor-pack-library-head\">\r\n                    <div>\r\n                        <h3>Saved Mentor Packs</h3>\r\n                        <div class=\"muted tiny\">View or delete Learn-from knowledge packs already stored in AI Nurture.</div>\r\n                    </div>\r\n                    <button id=\"btn-refresh-mentor-packs\" type=\"button\" class=\"secondary\">Refresh Packs</button>\r\n                </div>\r\n\r\n                <div id=\"mentor-pack-list\" class=\"mentor-pack-list muted\">Loading mentor packs…</div>\r\n            </div>\r\n        </div>\r\n\r\n        <div class=\"triple nurture-tab-panel\" data-nurture-panel=\"processing\">\r\n            <div class=\"card\">\r\n                <h2>Sources</h2>\r\n                <div id=\"sources-list\" class=\"muted\">Loading…</div>\r\n            </div>\r\n\r\n            <div class=\"card\">\r\n                <h2>Jobs</h2>\r\n                <div id=\"jobs-list\" class=\"muted\">Loading…</div>\r\n            </div>\r\n\r\n            <div class=\"card\">\r\n                <h2>Context Packs</h2>\r\n                <div id=\"packs-list\" class=\"muted\">Loading…</div>\r\n            </div>\r\n        </div>\r\n\r\n        <div class=\"row nurture-tab-panel\" data-nurture-panel=\"processing\">\r\n            <div class=\"card\">\r\n                <h2>Source Detail</h2>\r\n                <div class=\"muted\">Open a source to inspect its snapshot, review, chunks, duplicate matches, and manual notes.</div>\r\n                <div id=\"detail-panel\" class=\"muted mt-12\">No source selected yet.</div>\r\n            </div>\r\n\r\n            <div class=\"card\">\r\n                <h2>Approved Knowledge Library</h2>\r\n                <div class=\"muted\">Approved knowledge entries that can be used when rebuilding context packs.</div>\r\n                <div id=\"library-list\" class=\"muted mt-12\">Loading…</div>\r\n            </div>\r\n        </div>\r\n\r\n        <div class=\"row nurture-tab-panel\" data-nurture-panel=\"context\">\r\n            <div class=\"card\">\r\n                <h2>Context Preview</h2>\r\n                <div class=\"muted\">Preview selected pack keys, injected rules, red flags, and telemetry before roadmap generation.</div>\r\n\r\n                <input id=\"context-user-id\" type=\"text\" placeholder=\"User ID for planner preview\">\r\n                <input id=\"context-category-hints\" type=\"text\" placeholder=\"Category hints, comma or line separated\">\r\n                <input id=\"context-tag-hints\" type=\"text\" placeholder=\"Tag hints, comma or line separated\">\r\n\r\n                <div class=\"actions\">\r\n                    <button id=\"btn-preview-context\" type=\"button\" class=\"secondary\">Preview Context</button>\r\n                </div>\r\n\r\n                <div id=\"context-panel\" class=\"muted\">No preview yet.</div>\r\n            </div>\r\n\r\n            <div class=\"card\">\r\n                <h2>User Overlay</h2>\r\n                <div class=\"muted\">Manual operator override that can inject rules, themes, and guardrails for a specific user.</div>\r\n\r\n                <input id=\"overlay-user-id\" type=\"text\" placeholder=\"User ID for overlay\">\r\n\r\n                <label class=\"toggle-row\">\r\n                    <input id=\"overlay-active\" type=\"checkbox\">\r\n                    <span>Overlay Active</span>\r\n                </label>\r\n\r\n                <textarea id=\"overlay-note\" rows=\"3\" placeholder=\"Short operator brief or instruction\"></textarea>\r\n                <textarea id=\"overlay-rules\" rows=\"4\" placeholder=\"Rules, one per line\"></textarea>\r\n                <textarea id=\"overlay-redflags\" rows=\"4\" placeholder=\"Red flags, one per line\"></textarea>\r\n                <textarea id=\"overlay-focus-themes\" rows=\"3\" placeholder=\"Focus themes, one per line\"></textarea>\r\n                <textarea id=\"overlay-tags\" rows=\"3\" placeholder=\"Tags, one per line\"></textarea>\r\n\r\n                <div class=\"actions\">\r\n                    <button id=\"btn-load-overlay\" type=\"button\" class=\"secondary\">Load Overlay</button>\r\n                    <button id=\"btn-save-overlay\" type=\"button\">Save Overlay</button>\r\n                </div>\r\n\r\n                <div id=\"overlay-status\" class=\"muted\">No overlay loaded.</div>\r\n            </div>\r\n        </div>\r\n\r\n        <div class=\"row nurture-tab-panel\" data-nurture-panel=\"context\">\r\n            <div class=\"card\">\r\n                <h2>Roadmap Telemetry</h2>\r\n                <div class=\"muted\">Inspect a user’s real active roadmap telemetry, planner run decision trace, output summary, and mission stats.</div>\r\n\r\n                <input id=\"telemetry-user-id\" type=\"text\" placeholder=\"User ID for roadmap telemetry lookup\">\r\n\r\n                <div class=\"actions\">\r\n                    <button id=\"btn-load-telemetry\" type=\"button\" class=\"secondary\">Load Roadmap Telemetry</button>\r\n                </div>\r\n\r\n                <div id=\"telemetry-panel\" class=\"muted\">No roadmap telemetry loaded yet.</div>\r\n            </div>\r\n\r\n            <div class=\"card\">\r\n                <h2>Telemetry Raw Output</h2>\r\n                <pre id=\"telemetry-raw-output\" class=\"subtle-pre\">{}</pre>\r\n            </div>\r\n        </div>\r\n    </div>"

function bootControllers() {

        const output = document.getElementById('output');
        const responseSummary = document.getElementById('response-summary');
        const responseStatusPill = document.getElementById('response-status-pill');
        const responseSummaryMeta = document.getElementById('response-summary-meta');
        const sourcesList = document.getElementById('sources-list');
        const jobsList = document.getElementById('jobs-list');
        const packsList = document.getElementById('packs-list');
        const libraryList = document.getElementById('library-list');
        const detailPanel = document.getElementById('detail-panel');
        const contextPanel = document.getElementById('context-panel');
        const telemetryPanel = document.getElementById('telemetry-panel');
        const telemetryRawOutput = document.getElementById('telemetry-raw-output');
        const telemetryUserIdInput = document.getElementById('telemetry-user-id');
        const contextUserIdInput = document.getElementById('context-user-id');
        const contextCategoryHintsInput = document.getElementById('context-category-hints');
        const contextTagHintsInput = document.getElementById('context-tag-hints');
        const overlayUserIdInput = document.getElementById('overlay-user-id');
        const overlayActiveInput = document.getElementById('overlay-active');
        const overlayNoteInput = document.getElementById('overlay-note');
        const overlayRulesInput = document.getElementById('overlay-rules');
        const overlayRedflagsInput = document.getElementById('overlay-redflags');
        const overlayFocusThemesInput = document.getElementById('overlay-focus-themes');
        const overlayTagsInput = document.getElementById('overlay-tags');
        const overlayStatus = document.getElementById('overlay-status');

        let activeDetailSourceId = '';

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

        function renderSystemResponse(payload = {}, responseOk = true) {
            const summary = getResponseSummary(payload, responseOk);

            if (output) {
                output.textContent = JSON.stringify(payload, null, 2);
                output.hidden = true;
            }

            if (responseSummary) {
                responseSummary.classList.remove('is-idle', 'is-success', 'is-error');
                responseSummary.classList.add(summary.tone === 'success' ? 'is-success' : 'is-error');

                responseSummary.innerHTML = `
                    <div class="response-summary-title">${escapeHtml(summary.title)}</div>
                    <div class="response-summary-message">${escapeHtml(summary.message)}</div>
                    <div id="response-summary-meta" class="response-summary-meta">
                        ${summary.meta.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
                    </div>
                `;
            }

            if (responseStatusPill) {
                responseStatusPill.className = `chip ${summary.tone === 'success' ? 'ok' : 'danger'}`;
                responseStatusPill.textContent = summary.success ? 'Success' : 'Failed';
            }

            const toggleButton = document.getElementById('btn-toggle-raw-response');
            if (toggleButton) {
                toggleButton.textContent = 'Show full response';
            }
        }

        async function request(path, options = {}) {
            const response = await fetch(`/api/internal/ai-nurture${path}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                }
            });

            const result = await response.json().catch(() => ({}));
            renderSystemResponse(result, response.ok);

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Request failed.');
            }

            return result;
        }

        function badgeClass(value) {
            const v = String(value || '').toLowerCase();
            if (['approve', 'approved', 'fresh', 'trusted', 'completed', 'reviewed'].includes(v)) return 'ok';
            if (['reference_only', 'aging', 'queued', 'running', 'processing'].includes(v)) return 'warn';
            if (['reject', 'rejected', 'failed', 'blocked', 'stale', 'expired'].includes(v)) return 'danger';
            return 'warn';
        }

        function badge(label) {
            return `<span class="badge ${badgeClass(label)}">${label || 'n/a'}</span>`;
        }

        function escapeHtml(value = '') {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function splitInputList(value = '') {
            return String(value || '')
                .split(/\n|,/)
                .map(item => item.trim())
                .filter(Boolean);
        }

        function joinInputList(values = []) {
            return (Array.isArray(values) ? values : [])
                .map(item => String(item || '').trim())
                .filter(Boolean)
                .join('\n');
        }

        function formatMetric(value, digits = 2) {
            if (value === null || value === undefined || value === '') return 'n/a';
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return escapeHtml(String(value));
            return parsed.toFixed(digits).replace(/\.00$/, '');
        }

        function renderChips(values = [], tone = 'info') {
            const clean = (Array.isArray(values) ? values : []).map(item => String(item || '').trim()).filter(Boolean);
            if (!clean.length) {
                return '<div class="empty-box">None</div>';
            }

            return `
                <div class="chip-wrap">
                    ${clean.map(item => `<span class="chip ${tone}">${escapeHtml(item)}</span>`).join('')}
                </div>
            `;
        }

        function renderDuplicateMatches(matches = []) {
            const clean = (Array.isArray(matches) ? matches : []).filter(Boolean);
            if (!clean.length) {
                return '<div class="empty-box">No duplicate matches stored yet.</div>';
            }

            return clean.map(match => {
                const title = escapeHtml(match.title || match.id || 'Duplicate Match');
                const url = String(match.sourceUrl || '').trim();
                const category = escapeHtml(match.category || 'general');
                const score = formatMetric(match.score ?? match.duplicateScore ?? match.similarityScore);
                const semanticScore = match.semanticScore === null || match.semanticScore === undefined
                    ? null
                    : formatMetric(match.semanticScore);
                const heuristicScore = match.heuristicScore === null || match.heuristicScore === undefined
                    ? null
                    : formatMetric(match.heuristicScore);

                return `
                    <div class="item">
                        <strong>${title}</strong>
                        <div class="muted">${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>` : 'No source URL'}</div>
                        <div class="chip-wrap">
                            <span class="chip ok">Score: ${score}</span>
                            ${semanticScore !== null ? `<span class="chip info">Semantic: ${semanticScore}</span>` : ''}
                            ${heuristicScore !== null ? `<span class="chip warn">Heuristic: ${heuristicScore}</span>` : ''}
                            <span class="chip warn">${category}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderManualNotes(notes = []) {
            const clean = (Array.isArray(notes) ? notes : []).filter(Boolean);
            if (!clean.length) {
                return '<div class="empty-box">No manual reviewer notes yet.</div>';
            }

            return clean.map(note => `
                <div class="note-card">
                    <div>${escapeHtml(note.note || '')}</div>
                    <div class="note-meta">
                        <span>Author: ${escapeHtml(note.author || 'internal-operator')}</span>
                        <span>Type: ${escapeHtml(note.noteType || 'review')}</span>
                        <span>${escapeHtml(note.createdAt || '')}</span>
                    </div>
                    ${(Array.isArray(note.labels) && note.labels.length)
                        ? `<div class="chip-wrap">${note.labels.map(label => `<span class="chip info">${escapeHtml(label)}</span>`).join('')}</div>`
                        : ''
                    }
                </div>
            `).join('');
        }

        function renderContextPreview(context = {}) {
            const telemetry = context && typeof context.telemetry === 'object' ? context.telemetry : {};
            const selectedPackKeys = Array.isArray(telemetry.selectedPackKeys) && telemetry.selectedPackKeys.length
                ? telemetry.selectedPackKeys
                : (Array.isArray(context.selectedPackKeys) ? context.selectedPackKeys : []);
            const priorityThemes = Array.isArray(context.priorityThemes) ? context.priorityThemes : [];
            const rules = Array.isArray(telemetry.injectedRules) && telemetry.injectedRules.length
                ? telemetry.injectedRules
                : (Array.isArray(context.rules) ? context.rules : []);
            const examples = Array.isArray(telemetry.injectedExamples) && telemetry.injectedExamples.length
                ? telemetry.injectedExamples
                : (Array.isArray(context.examples) ? context.examples : []);
            const redFlags = Array.isArray(telemetry.injectedRedFlags) && telemetry.injectedRedFlags.length
                ? telemetry.injectedRedFlags
                : (Array.isArray(context.redFlags) ? context.redFlags : []);
            const overlayThemes = Array.isArray(telemetry.overlayThemes) ? telemetry.overlayThemes : [];
            const overlayBrief = String(context.overlayBrief || '').trim();

            contextPanel.innerHTML = `
                <div class="item">
                    <strong>Selected Pack Keys</strong>
                    ${renderChips(selectedPackKeys, 'ok')}
                </div>

                <div class="item">
                    <strong>Priority Themes</strong>
                    ${renderChips(priorityThemes, 'warn')}
                </div>

                <div class="score-grid">
                    ${scoreBox('Rules', telemetry.injectedRuleCount ?? rules.length)}
                    ${scoreBox('Examples', telemetry.injectedExampleCount ?? examples.length)}
                    ${scoreBox('Red Flags', telemetry.injectedRedFlagCount ?? redFlags.length)}
                    ${scoreBox('Overlay Applied', telemetry.overlayApplied ? 'yes' : 'no')}
                    ${scoreBox('Overlay Rules', telemetry.overlayRuleCount ?? 0)}
                    ${scoreBox('Overlay Flags', telemetry.overlayRedFlagCount ?? 0)}
                </div>

                ${overlayBrief ? `
                    <div class="item">
                        <strong>Overlay Brief</strong>
                        <div class="muted">${escapeHtml(overlayBrief)}</div>
                    </div>
                ` : ''}

                <div class="item">
                    <strong>Overlay Themes</strong>
                    ${renderChips(overlayThemes, 'info')}
                </div>

                <h3>Injected Rules</h3>
                <ul class="list-plain">
                    ${rules.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None</li>'}
                </ul>

                <h3>Injected Examples</h3>
                <ul class="list-plain">
                    ${examples.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None</li>'}
                </ul>

                <h3>Injected Red Flags</h3>
                <ul class="list-plain">
                    ${redFlags.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None</li>'}
                </ul>
            `;
        }

        function fillOverlayForm(overlay = {}) {
            const safe = overlay && typeof overlay === 'object' ? overlay : {};

            overlayUserIdInput.value = String(safe.userId || overlayUserIdInput.value || '').trim();
            overlayActiveInput.checked = safe.isActive === true;
            overlayNoteInput.value = safe.note || '';
            overlayRulesInput.value = joinInputList(safe.rules);
            overlayRedflagsInput.value = joinInputList(safe.redFlags);
            overlayFocusThemesInput.value = joinInputList(safe.focusThemes);
            overlayTagsInput.value = joinInputList(safe.tags);
            if (!contextUserIdInput.value.trim() && overlayUserIdInput.value.trim()) {
                contextUserIdInput.value = overlayUserIdInput.value.trim();
            }

            if (!telemetryUserIdInput.value.trim() && overlayUserIdInput.value.trim()) {
                telemetryUserIdInput.value = overlayUserIdInput.value.trim();
            }
            const rulesCount = Array.isArray(safe.rules) ? safe.rules.length : 0;
            const flagsCount = Array.isArray(safe.redFlags) ? safe.redFlags.length : 0;
            const themesCount = Array.isArray(safe.focusThemes) ? safe.focusThemes.length : 0;
            const tagsCount = Array.isArray(safe.tags) ? safe.tags.length : 0;

            overlayStatus.innerHTML = safe.userId
                ? `
                    <div class="item">
                        <strong>${escapeHtml(safe.userId)}</strong>
                        <div class="chip-wrap">
                            <span class="chip ${safe.isActive ? 'ok' : 'warn'}">${safe.isActive ? 'Active' : 'Inactive'}</span>
                            <span class="chip info">Rules: ${rulesCount}</span>
                            <span class="chip info">Flags: ${flagsCount}</span>
                            <span class="chip info">Themes: ${themesCount}</span>
                            <span class="chip info">Tags: ${tagsCount}</span>
                        </div>
                        ${safe.note ? `<div class="muted mt-8">${escapeHtml(safe.note)}</div>` : ''}
                    </div>
                `
                : '<div class="muted">No overlay loaded.</div>';
        }

        function renderKeyValueItems(obj = {}) {
            const entries = Object.entries(obj && typeof obj === 'object' ? obj : {})
                .filter(([, value]) => value !== undefined && value !== null && value !== '');

            if (!entries.length) {
                return '<div class="empty-box">None</div>';
            }

            return entries.map(([key, value]) => {
                const isObject = value && typeof value === 'object';
                return `
                    <div class="item">
                        <strong>${escapeHtml(key)}</strong>
                        <div class="muted">${isObject ? escapeHtml(JSON.stringify(value)) : escapeHtml(String(value))}</div>
                    </div>
                `;
            }).join('');
        }

        function renderTelemetry(payload = {}) {
            const roadmap = payload?.roadmap && typeof payload.roadmap === 'object' ? payload.roadmap : {};
            const plannerRun = payload?.plannerRun && typeof payload.plannerRun === 'object' ? payload.plannerRun : {};
            const decisionTrace = plannerRun?.decisionTrace && typeof plannerRun.decisionTrace === 'object'
                ? plannerRun.decisionTrace
                : {};
            const outputSummary = plannerRun?.outputSummary && typeof plannerRun.outputSummary === 'object'
                ? plannerRun.outputSummary
                : {};
            const missionStats = payload?.missionStats && typeof payload.missionStats === 'object'
                ? payload.missionStats
                : {};
            const nurtureTelemetry = plannerRun?.nurtureTelemetry && typeof plannerRun.nurtureTelemetry === 'object'
                ? plannerRun.nurtureTelemetry
                : (roadmap?.nurtureTelemetry && typeof roadmap.nurtureTelemetry === 'object'
                    ? roadmap.nurtureTelemetry
                    : {});

            const selectedPackKeys = Array.isArray(nurtureTelemetry.selectedPackKeys)
                ? nurtureTelemetry.selectedPackKeys
                : [];
            const injectedRules = Array.isArray(nurtureTelemetry.injectedRules)
                ? nurtureTelemetry.injectedRules
                : [];
            const injectedExamples = Array.isArray(nurtureTelemetry.injectedExamples)
                ? nurtureTelemetry.injectedExamples
                : [];
            const injectedRedFlags = Array.isArray(nurtureTelemetry.injectedRedFlags)
                ? nurtureTelemetry.injectedRedFlags
                : [];

            telemetryPanel.innerHTML = `
                <div class="item">
                    <strong>User</strong>
                    <div class="muted">${escapeHtml(payload.uid || 'n/a')}</div>
                    <div class="chip-wrap">
                        ${roadmap?.status ? `<span class="chip ok">${escapeHtml(roadmap.status)}</span>` : ''}
                        ${roadmap?.plannerRunId ? `<span class="chip info">Planner Run: ${escapeHtml(roadmap.plannerRunId)}</span>` : ''}
                        ${plannerRun?.mode ? `<span class="chip warn">Mode: ${escapeHtml(plannerRun.mode)}</span>` : ''}
                    </div>
                </div>

                <div class="score-grid">
                    ${scoreBox('Readiness', roadmap?.readinessScore ?? 'n/a')}
                    ${scoreBox('Mission Total', missionStats?.total ?? 0)}
                    ${scoreBox('Completed', missionStats?.completed ?? 0)}
                    ${scoreBox('Skipped', missionStats?.skipped ?? 0)}
                    ${scoreBox('Stuck', missionStats?.stuck ?? 0)}
                    ${scoreBox('Pack Keys', selectedPackKeys.length)}
                </div>

                <div class="item">
                    <strong>Focus Areas</strong>
                    ${renderChips(Array.isArray(roadmap.focusAreas) ? roadmap.focusAreas : [], 'warn')}
                </div>

                <div class="item">
                    <strong>Selected Pack Keys</strong>
                    ${renderChips(selectedPackKeys, 'ok')}
                </div>

                <div class="item">
                    <strong>Roadmap Summary</strong>
                    ${renderKeyValueItems(roadmap.summary || {})}
                </div>

                <div class="item">
                    <strong>Adaptive Planning</strong>
                    ${renderKeyValueItems(roadmap.adaptivePlanning || {})}
                </div>

                <div class="item">
                    <strong>Planner Decision Trace</strong>
                    ${renderKeyValueItems(decisionTrace)}
                </div>

                <div class="item">
                    <strong>Output Summary</strong>
                    ${renderKeyValueItems(outputSummary)}
                </div>

                <div class="item">
                    <strong>Injected Rules</strong>
                    <ul class="list-plain">
                        ${injectedRules.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None</li>'}
                    </ul>
                </div>

                <div class="item">
                    <strong>Injected Examples</strong>
                    <ul class="list-plain">
                        ${injectedExamples.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None</li>'}
                    </ul>
                </div>

                <div class="item">
                    <strong>Injected Red Flags</strong>
                    <ul class="list-plain">
                        ${injectedRedFlags.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None</li>'}
                    </ul>
                </div>
            `;

            telemetryRawOutput.textContent = JSON.stringify(payload, null, 2);
        }

        async function loadRoadmapTelemetry(uid) {
            const normalizedUid = String(uid || '').trim();
            if (!normalizedUid) {
                throw new Error('User ID is required.');
            }

            const result = await request(`/academy/telemetry/${encodeURIComponent(normalizedUid)}`);
            renderTelemetry(result);

            telemetryUserIdInput.value = normalizedUid;

            if (!contextUserIdInput.value.trim()) {
                contextUserIdInput.value = normalizedUid;
            }

            if (!overlayUserIdInput.value.trim()) {
                overlayUserIdInput.value = normalizedUid;
            }

            return result;
        }
        function sourceCard(source = {}) {
            return `
                <div class="item">
                    <strong>${escapeHtml(source.title || source.canonicalUrl || source.id)}</strong>
                    <div class="muted">${escapeHtml(source.hostname || '')}</div>
                    <div>
                        ${badge(source.status)}
                        ${source.domainVerdict ? badge(source.domainVerdict) : ''}
                        ${source.staleVerdict ? badge(source.staleVerdict) : ''}
                    </div>
                    <div class="actions">
                        <button type="button" data-action="open" data-id="${escapeHtml(source.id)}">Open</button>
                        <button type="button" data-action="process" data-id="${escapeHtml(source.id)}" class="secondary">Process Now</button>
                        <button type="button" data-action="queue" data-id="${escapeHtml(source.id)}" class="secondary">Queue</button>
                        <button type="button" data-action="approve" data-id="${escapeHtml(source.id)}">Approve</button>
                        <button type="button" data-action="reject" data-id="${escapeHtml(source.id)}" class="secondary">Reject</button>
                    </div>
                </div>
            `;
        }

        function jobCard(job = {}) {
            return `
                <div class="item">
                    <strong>${escapeHtml(job.type || 'job')}</strong>
                    <div class="muted">Source: ${escapeHtml(job.sourceId || 'n/a')}</div>
                    <div>
                        ${badge(job.status)}
                    </div>
                </div>
            `;
        }

        function packCard(pack = {}) {
            return `
                <div class="item">
                    <strong>${escapeHtml(pack.title || pack.key || 'pack')}</strong>
                    <div class="muted">Category: ${escapeHtml(pack.category || 'general')}</div>
                    <div class="muted">Rules: ${(pack.rules || []).length} · Examples: ${(pack.examples || []).length}</div>
                </div>
            `;
        }

        function libraryCard(item = {}) {
            return `
                <div class="item">
                    <strong>${escapeHtml(item.title || item.id)}</strong>
                    <div class="muted">Category: ${escapeHtml(item.category || 'general')}</div>
                    <div>
                        ${item.staleVerdict ? badge(item.staleVerdict) : ''}
                        ${item.excludedFromPlanner ? badge('excluded') : ''}
                    </div>
                    <div class="muted">${escapeHtml(item.summary || '')}</div>
                </div>
            `;
        }

        function scoreBox(label, value) {
            return `
                <div class="score-box">
                    <div class="muted">${label}</div>
                    <strong>${value ?? '0'}</strong>
                </div>
            `;
        }

        function renderDetail(detail = {}) {
            const source = detail.source || {};
            const review = detail.review || {};
            const snapshot = detail.snapshot || {};
            const chunks = Array.isArray(detail.chunks) ? detail.chunks : [];
            const duplicateMatches = Array.isArray(review.duplicateMatches) && review.duplicateMatches.length
                ? review.duplicateMatches
                : (review.duplicateTopMatch ? [{
                    ...review.duplicateTopMatch,
                    score: review.duplicateScore ?? review.duplicateTopMatch.score
                }] : []);
            const manualNotes = Array.isArray(review.manualNotes)
                ? [...review.manualNotes].reverse()
                : [];

            activeDetailSourceId = String(source.id || '').trim();

            detailPanel.innerHTML = `
                <div class="item">
                    <strong>${escapeHtml(source.title || source.canonicalUrl || source.id || 'Source')}</strong>
                    <div class="muted">${escapeHtml(source.canonicalUrl || source.originalUrl || '')}</div>
                    <div>
                        ${source.status ? badge(source.status) : ''}
                        ${review.overallDecision ? badge(review.overallDecision) : ''}
                        ${review.domainVerdict ? badge(review.domainVerdict) : ''}
                        ${review.staleVerdict ? badge(review.staleVerdict) : ''}
                    </div>

                    <div class="meta-grid">
                        <div class="item"><strong>Hostname</strong><div class="muted">${escapeHtml(source.hostname || 'n/a')}</div></div>
                        <div class="item"><strong>Age Days</strong><div class="muted">${escapeHtml(review.ageDays ?? 'n/a')}</div></div>
                        <div class="item"><strong>Published</strong><div class="muted">${escapeHtml(snapshot.publishedAt || 'n/a')}</div></div>
                        <div class="item"><strong>Modified</strong><div class="muted">${escapeHtml(snapshot.modifiedAt || 'n/a')}</div></div>
                        <div class="item"><strong>Category</strong><div class="muted">${escapeHtml(review.recommendedCategory || 'general')}</div></div>
                        <div class="item"><strong>Duplicate Method</strong><div class="muted">${escapeHtml(review.duplicateMethod || 'heuristic')}</div></div>
                    </div>

                    <div class="score-grid">
                        ${scoreBox('Relevance', formatMetric(review?.scores?.relevance))}
                        ${scoreBox('Trust', formatMetric(review?.scores?.trust))}
                        ${scoreBox('Duplication', formatMetric(review?.scores?.duplication ?? review?.duplicateScore))}
                        ${scoreBox('Actionability', formatMetric(review?.scores?.actionability))}
                        ${scoreBox('Freshness', formatMetric(review?.freshnessScore))}
                        ${scoreBox('Chars', snapshot?.cleanTextChars || 0)}
                    </div>

                    <h3>Summary</h3>
                    <div class="muted">${escapeHtml(review.summaryLong || review.summaryShort || 'No review yet.')}</div>

                    <h3>Absorb</h3>
                    <ul class="list-plain">
                        ${(review.absorbWhat || []).map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None</li>'}
                    </ul>

                    <h3>Do Not Absorb</h3>
                    <ul class="list-plain">
                        ${(review.doNotAbsorbWhat || []).map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None</li>'}
                    </ul>

                    <h3>Risk Notes</h3>
                    <ul class="list-plain">
                        ${(review.riskNotes || []).map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None</li>'}
                    </ul>

                    <h3>Duplicate Matches</h3>
                    ${renderDuplicateMatches(duplicateMatches)}

                    <h3>Manual Reviewer Notes</h3>
                    ${renderManualNotes(manualNotes)}

                    <div class="item">
                        <strong>Add Manual Note</strong>
                        <textarea id="detail-note-input" rows="4" placeholder="Add reviewer note for this source"></textarea>
                        <input id="detail-note-labels" type="text" placeholder="Labels, comma or line separated">
                        <input id="detail-note-author" type="text" placeholder="Author" value="internal-operator">
                        <div class="actions">
                            <button data-action="save-review-note" data-source-id="${escapeHtml(source.id || '')}" type="button">Save Note</button>
                        </div>
                    </div>

                    <h3>Chunks</h3>
                    ${chunks.slice(0, 8).map(chunk => `
                        <div class="item">
                            <div><strong>Chunk ${escapeHtml(chunk.index)}</strong> ${badge(chunk.decision || 'reference_only')}</div>
                            <div class="muted">${escapeHtml(chunk.reason || '')}</div>
                            <div class="muted">${escapeHtml((chunk.text || '').slice(0, 280))}${(chunk.text || '').length > 280 ? '…' : ''}</div>
                        </div>
                    `).join('') || '<div class="muted">No chunks yet.</div>'}
                </div>
            `;
        }

        async function loadSources() {
            const result = await request('/sources');
            sourcesList.innerHTML = (result.sources || []).length
                ? result.sources.map(sourceCard).join('')
                : '<div class="muted">No sources yet.</div>';
        }

        async function loadJobs() {
            const result = await request('/jobs');
            jobsList.innerHTML = (result.jobs || []).length
                ? result.jobs.map(jobCard).join('')
                : '<div class="muted">No jobs yet.</div>';
        }

        async function loadPacks() {
            const result = await request('/context-packs');
            packsList.innerHTML = (result.packs || []).length
                ? result.packs.map(packCard).join('')
                : '<div class="muted">No context packs yet.</div>';
        }

        async function loadLibrary() {
            const result = await request('/library');
            libraryList.innerHTML = (result.items || []).length
                ? result.items.map(libraryCard).join('')
                : '<div class="muted">No approved knowledge yet.</div>';
        }

        async function openSource(id) {
            const result = await request(`/sources/${id}`);
            renderDetail(result);
        }

        async function loadUserOverlay(uid) {
            const normalizedUid = String(uid || '').trim();
            if (!normalizedUid) {
                throw new Error('User ID is required.');
            }

            const result = await request(`/user-overlays/${encodeURIComponent(normalizedUid)}`);
            fillOverlayForm(result.overlay || { userId: normalizedUid, isActive: false });
            return result;
        }

        async function saveUserOverlay() {
            const normalizedUid = String(overlayUserIdInput.value || '').trim();
            if (!normalizedUid) {
                throw new Error('User ID is required.');
            }

            const result = await request(`/user-overlays/${encodeURIComponent(normalizedUid)}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    ...readOverlayPayload(),
                    updatedBy: 'internal-operator'
                })
            });

            fillOverlayForm(result.overlay || { userId: normalizedUid });
            return result;
        }

        document.getElementById('btn-create-source').addEventListener('click', async () => {
            const url = document.getElementById('source-url').value.trim();
            if (!url) return;

            try {
                await request('/sources', {
                    method: 'POST',
                    body: JSON.stringify({ url })
                });
                await Promise.all([loadSources(), loadJobs()]);
            } catch (error) {
                output.textContent = JSON.stringify({ success: false, message: error.message }, null, 2);
            }
        });

        document.getElementById('btn-run-next-job').addEventListener('click', async () => {
            try {
                await request('/jobs/run-next', {
                    method: 'POST',
                    body: JSON.stringify({})
                });
                await Promise.all([loadSources(), loadJobs(), loadLibrary(), loadPacks()]);
            } catch (error) {
                output.textContent = JSON.stringify({ success: false, message: error.message }, null, 2);
            }
        });

        document.getElementById('btn-rebuild-packs').addEventListener('click', async () => {
            try {
                await request('/context-packs/rebuild', {
                    method: 'POST',
                    body: JSON.stringify({})
                });
                await loadPacks();
            } catch (error) {
                output.textContent = JSON.stringify({ success: false, message: error.message }, null, 2);
            }
        });

        document.getElementById('btn-preview-context').addEventListener('click', async () => {
            const userId = contextUserIdInput.value.trim() || overlayUserIdInput.value.trim();
            const categoryHints = splitInputList(contextCategoryHintsInput.value);
            const tagHints = splitInputList(contextTagHintsInput.value);

            try {
                const result = await request('/context-preview', {
                    method: 'POST',
                    body: JSON.stringify({
                        userId,
                        categoryHints,
                        tagHints
                    })
                });

                renderContextPreview(result.context || {});

                if (userId && !overlayUserIdInput.value.trim()) {
                    overlayUserIdInput.value = userId;
                }

                if (userId && !telemetryUserIdInput.value.trim()) {
                    telemetryUserIdInput.value = userId;
                }
            } catch (error) {
                output.textContent = JSON.stringify({ success: false, message: error.message }, null, 2);
            }
        });

        document.getElementById('btn-load-overlay').addEventListener('click', async () => {
            try {
                const uid = overlayUserIdInput.value.trim() || contextUserIdInput.value.trim();
                await loadUserOverlay(uid);
            } catch (error) {
                output.textContent = JSON.stringify({ success: false, message: error.message }, null, 2);
            }
        });

        document.getElementById('btn-save-overlay').addEventListener('click', async () => {
            try {
                await saveUserOverlay();
            } catch (error) {
                output.textContent = JSON.stringify({ success: false, message: error.message }, null, 2);
            }
        });
        document.getElementById('btn-load-telemetry').addEventListener('click', async () => {
            try {
                const uid =
                    telemetryUserIdInput.value.trim() ||
                    overlayUserIdInput.value.trim() ||
                    contextUserIdInput.value.trim();

                await loadRoadmapTelemetry(uid);
            } catch (error) {
                output.textContent = JSON.stringify({ success: false, message: error.message }, null, 2);
            }
        });
        if (detailPanel) {
            detailPanel.addEventListener('click', async (event) => {
                const button = event.target.closest('button[data-action="save-review-note"]');
                if (!button) return;

                const sourceId = button.getAttribute('data-source-id') || activeDetailSourceId;
                const note = document.getElementById('detail-note-input')?.value.trim() || '';
                const labels = splitInputList(document.getElementById('detail-note-labels')?.value || '');
                const author = document.getElementById('detail-note-author')?.value.trim() || 'internal-operator';

                if (!sourceId || !note) {
                    output.textContent = JSON.stringify({
                        success: false,
                        message: 'Source ID and note are required.'
                    }, null, 2);
                    return;
                }

                try {
                    await request(`/sources/${encodeURIComponent(sourceId)}/notes`, {
                        method: 'POST',
                        body: JSON.stringify({
                            note,
                            labels,
                            author,
                            noteType: 'review'
                        })
                    });

                    await openSource(sourceId);
                } catch (error) {
                    output.textContent = JSON.stringify({ success: false, message: error.message }, null, 2);
                }
            });
        }

        sourcesList.addEventListener('click', async (event) => {
            const button = event.target.closest('button[data-id]');
            if (!button) return;

            const id = button.getAttribute('data-id');
            const action = button.getAttribute('data-action');

            try {
                if (action === 'open') {
                    await openSource(id);
                    return;
                }

                if (action === 'process') {
                    await request(`/sources/${id}/process`, { method: 'POST', body: JSON.stringify({}) });
                } else if (action === 'queue') {
                    await request(`/sources/${id}/reprocess`, { method: 'POST', body: JSON.stringify({}) });
                } else if (action === 'approve') {
                    await request(`/sources/${id}/approve`, { method: 'POST', body: JSON.stringify({}) });
                } else if (action === 'reject') {
                    await request(`/sources/${id}/reject`, {
                        method: 'POST',
                        body: JSON.stringify({ reason: 'Rejected from internal console.' })
                    });
                }

                await Promise.all([loadSources(), loadJobs(), loadLibrary(), loadPacks()]);
                await openSource(id);
            } catch (error) {
                output.textContent = JSON.stringify({ success: false, message: error.message }, null, 2);
            }
        });

        Promise.allSettled([
            request('/bootstrap'),
            loadSources(),
            loadJobs(),
            loadPacks(),
            loadLibrary()
        ]);


const disposeMentorManager = (function bootMentorKnowledgePackManager() {
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
        },
        jeff_bezos: {
            name: 'Jeff Bezos',
            tags: [
                'jeff_bezos',
                'jeff bezos',
                'bezos',
                'amazon',
                'customer obsession',
                'long term thinking',
                'operational excellence',
                'flywheel',
                'day one'
            ]
        },
        julius_caesar: {
            name: 'Julius Caesar',
            tags: [
                'julius_caesar',
                'julius caesar',
                'caesar',
                'rome',
                'strategy',
                'leadership',
                'political power',
                'military command',
                'empire building'
            ]
        },
        alexander_the_great: {
            name: 'Alexander The Great',
            tags: [
                'alexander_the_great',
                'alexander the great',
                'alexander',
                'macedon',
                'conquest',
                'vision',
                'military strategy',
                'empire building',
                'ambition'
            ]
        },
        marcus_aurelius: {
            name: 'Marcus Aurelius',
            tags: [
                'marcus_aurelius',
                'marcus aurelius',
                'stoicism',
                'stoic philosophy',
                'discipline',
                'self mastery',
                'duty',
                'emotional control',
                'leadership'
            ]
        },
        seneca: {
            name: 'Seneca',
            tags: [
                'seneca',
                'stoicism',
                'stoic philosophy',
                'wealth',
                'self control',
                'time management',
                'wisdom',
                'virtue',
                'resilience'
            ]
        },
        epictetus: {
            name: 'Epictetus',
            tags: [
                'epictetus',
                'stoicism',
                'stoic philosophy',
                'control what you can control',
                'discipline',
                'inner freedom',
                'resilience',
                'virtue',
                'mindset'
            ]
        },
        socrates: {
            name: 'Socrates',
            tags: [
                'socrates',
                'socratic method',
                'critical thinking',
                'wisdom',
                'questions',
                'ethics',
                'self knowledge',
                'truth seeking',
                'philosophy'
            ]
        },
        plato: {
            name: 'Plato',
            tags: [
                'plato',
                'platonic philosophy',
                'forms',
                'justice',
                'ideal state',
                'education',
                'wisdom',
                'leadership',
                'philosophy'
            ]
        },
        aristotle: {
            name: 'Aristotle',
            tags: [
                'aristotle',
                'aristotelian philosophy',
                'logic',
                'virtue ethics',
                'practical wisdom',
                'rhetoric',
                'politics',
                'habits',
                'excellence'
            ]
        },
        confucius: {
            name: 'Confucius',
            tags: [
                'confucius',
                'confucianism',
                'discipline',
                'ethics',
                'social order',
                'respect',
                'character',
                'ritual',
                'leadership'
            ]
        },
        sun_tzu: {
            name: 'Sun Tzu',
            tags: [
                'sun_tzu',
                'sun tzu',
                'art of war',
                'strategy',
                'competition',
                'positioning',
                'warfare',
                'patience',
                'tactics'
            ]
        },
        niccolo_machiavelli: {
            name: 'Niccolò Machiavelli',
            tags: [
                'niccolo_machiavelli',
                'niccolo machiavelli',
                'machiavelli',
                'the prince',
                'power',
                'political strategy',
                'statecraft',
                'realpolitik',
                'leadership'
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
        discoveryMentor: 'discovery-mentor',
        discoveryLimit: 'discovery-limit',
        discoveryTargetUrl: 'discovery-target-url',
        discoveryRawText: 'discovery-raw-text',
        discoveryRun: 'btn-discover-source-links',
        discoveryImport: 'btn-import-discovered-links',
        discoveryClear: 'btn-clear-discovery',
        discoveryStatus: 'discovery-status',
        discoveryResults: 'discovery-results',
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
        batchHistoryList: 'batch-history-list',
        batchHistoryRefresh: 'btn-refresh-batch-history',
        batchHistorySearch: 'batch-history-search',
        batchHistoryFilter: 'batch-history-filter',
        batchHistoryClear: 'btn-clear-batch-history-filters',
        batchHistoryAutoRefresh: 'batch-history-auto-refresh',
        batchHistoryLiveStatus: 'batch-history-live-status',
        batchHistoryResultCount: 'batch-history-result-count',
        batchDetailsBackdrop: 'batch-details-backdrop',
        batchDetailsDrawer: 'batch-details-drawer',
        batchDetailsTitle: 'batch-details-title',
        batchDetailsMeta: 'batch-details-meta',
        batchDetailsStats: 'batch-details-stats',
        batchDetailsSources: 'batch-details-sources',
        batchDetailsFailures: 'batch-details-failures',
        batchDetailsStatus: 'batch-details-action-status',
        batchDetailsClose: 'btn-close-batch-details',
        sourceDetailBackdrop: 'source-detail-backdrop',
        sourceDetailDrawer: 'source-detail-drawer',
        sourceDetailTitle: 'source-detail-title',
        sourceDetailMeta: 'source-detail-meta',
        sourceDetailBody: 'source-detail-body',
        sourceDetailStatus: 'source-detail-status',
        sourceDetailClose: 'btn-close-source-detail',
        responseSummary: 'response-summary',
        responseStatusPill: 'response-status-pill',
        rawToggle: 'btn-toggle-raw-response',
        output: 'output'
    };

    let discoveredSourceLinks = [];
    let batchHistoryCache = [];
    let activeBatchDetailsId = '';
    let activeSourceDetailId = '';
    let batchHistorySearchTerm = '';
    let batchHistoryFilterValue = 'all';
    let batchHistoryAutoRefreshEnabled = false;
    let batchHistoryRefreshTimer = null;
    let batchHistoryIsLoading = false;
    let batchHistoryLastRefreshAt = '';

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

    function setDiscoveryStatus(message = '', tone = '') {
        const statusEl = byId(ids.discoveryStatus);
        if (!statusEl) return;

        statusEl.classList.remove('is-success', 'is-error');

        if (tone === 'success') {
            statusEl.classList.add('is-success');
        }

        if (tone === 'error') {
            statusEl.classList.add('is-error');
        }

        statusEl.textContent = message || 'No discovery scan yet.';
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

        if (payload?.batch?.id) {
            title = success ? 'Batch created' : title;
            meta.push(`Batch ID: ${payload.batch.id}`);
        }

        if (payload?.batchCount !== undefined) {
            meta.push(`Batches: ${payload.batchCount}`);
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
        const response = await fetch(
            `/api/internal/ai-nurture${path}`,
            {
                ...options,

                credentials:
                    'same-origin',

                headers: {
                    'Content-Type':
                        'application/json',

                    ...(options.headers || {})
                }
            }
        );

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

    function syncDiscoveryPresetToBatch() {
        const discoveryMentor = valueOf(ids.discoveryMentor);
        const batchMentor = byId(ids.batchMentor);

        if (batchMentor && discoveryMentor) {
            batchMentor.value = discoveryMentor;
        }

        const tagsInput = byId(ids.batchTags);
        const hintsInput = byId(ids.batchTopicHints);
        const titlePrefixInput = byId(ids.batchTitlePrefix);
        const preset = mentorPresets[discoveryMentor];

        if (tagsInput) tagsInput.value = '';
        if (hintsInput) hintsInput.value = '';
        if (titlePrefixInput) titlePrefixInput.value = '';

        if (preset) {
            syncBatchPreset();
        }
    }

    function renderDiscoveryResults(links = []) {
        const listEl = byId(ids.discoveryResults);
        if (!listEl) return;

        discoveredSourceLinks = Array.isArray(links) ? links : [];

        if (!discoveredSourceLinks.length) {
            listEl.classList.add('muted');
            listEl.innerHTML = '<div class="empty-box">No links discovered yet.</div>';
            return;
        }

        listEl.classList.remove('muted');
        listEl.innerHTML = discoveredSourceLinks.map((item, index) => {
            const url = item.url || '';
            const hostname = item.hostname || '';
            const sourceKind = item.sourceKind || 'url';

            return `
                <label class="discovery-link-item">
                    <input type="checkbox" data-discovery-index="${index}" checked>
                    <div>
                        <div class="discovery-link-title">${escapeHtml(item.title || hostname || `Discovered Link ${index + 1}`)}</div>
                        <div class="discovery-link-url">${escapeHtml(url)}</div>
                        <div class="discovery-link-meta">
                            <span class="chip info">${escapeHtml(sourceKind)}</span>
                            ${hostname ? `<span class="chip">${escapeHtml(hostname)}</span>` : ''}
                        </div>
                    </div>
                </label>
            `;
        }).join('');
    }

    async function discoverSourceLinks() {
        const button = byId(ids.discoveryRun);
        const targetUrl = valueOf(ids.discoveryTargetUrl);
        const rawText = valueOf(ids.discoveryRawText);
        const maxLinks = Number.parseInt(valueOf(ids.discoveryLimit), 10) || 50;

        if (!targetUrl && !rawText) {
            setDiscoveryStatus('Paste a page URL or raw text before running discovery.', 'error');
            return;
        }

        try {
            if (button) {
                button.disabled = true;
                button.textContent = 'Discovering...';
            }

            setDiscoveryStatus('Scanning source for links...', '');

            const result = await request('/sources/discover', {
                method: 'POST',
                body: JSON.stringify({
                    targetUrl,
                    rawText,
                    maxLinks
                })
            });

            renderDiscoveryResults(result.links || []);

            setDiscoveryStatus(
                `Discovery complete. Found ${result.discoveredCount || 0} link(s). Select the useful ones and import them into Batch Feed.`,
                result.discoveredCount ? 'success' : 'error'
            );
        } catch (error) {
            renderDiscoveryResults([]);
            setDiscoveryStatus(error.message || 'Failed to discover links.', 'error');
            setOutput({
                success: false,
                message: error.message || 'Failed to discover links.'
            });
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = 'Discover Links';
            }
        }
    }

    function importDiscoveredLinksToBatch() {
        const resultEl = byId(ids.discoveryResults);
        const batchUrlsEl = byId(ids.batchUrls);

        if (!resultEl || !batchUrlsEl) {
            setDiscoveryStatus('Batch Feed form is not available.', 'error');
            return;
        }

        const selectedUrls = [...resultEl.querySelectorAll('input[data-discovery-index]:checked')]
            .map((input) => discoveredSourceLinks[Number.parseInt(input.getAttribute('data-discovery-index'), 10)]?.url)
            .filter(Boolean);

        if (!selectedUrls.length) {
            setDiscoveryStatus('Select at least one discovered link before importing.', 'error');
            return;
        }

        syncDiscoveryPresetToBatch();

        const existingUrls = extractBatchUrls(batchUrlsEl.value);
        const mergedUrls = [...existingUrls];

        selectedUrls.forEach((url) => {
            if (!mergedUrls.includes(url)) mergedUrls.push(url);
        });

        batchUrlsEl.value = mergedUrls.join('\n');

        setDiscoveryStatus(`Imported ${selectedUrls.length} selected link(s) into Batch Feed. Review them, then click Create Batch Sources.`, 'success');
        setBatchStatus(`Ready to create batch sources from ${mergedUrls.length} URL(s).`, 'success');
    }

    function clearDiscovery() {
        const targetUrlEl = byId(ids.discoveryTargetUrl);
        const rawTextEl = byId(ids.discoveryRawText);
        const resultsEl = byId(ids.discoveryResults);

        if (targetUrlEl) targetUrlEl.value = '';
        if (rawTextEl) rawTextEl.value = '';

        discoveredSourceLinks = [];

        if (resultsEl) {
            resultsEl.classList.add('muted');
            resultsEl.textContent = 'Discovered links will appear here.';
        }

        setDiscoveryStatus('Discovery form cleared.', '');
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
                await loadBatchHistory();
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

    function buildBatchHistorySearchText(batch = {}) {
        const progress = batch.progress || {};
        const sourceDetails = Array.isArray(batch.sourceDetails) ? batch.sourceDetails : [];
        const failedDetails = Array.isArray(batch.failedDetails) ? batch.failedDetails : [];

        return [
            batch.id,
            batch.title,
            batch.titlePrefix,
            batch.mentorName,
            batch.mentorKey,
            batch.status,
            batch.createdAt,
            batch.updatedAt,
            progress.requestedCount,
            progress.createdSourceCount,
            progress.jobCount,
            progress.processedCount,
            progress.approvedCount,
            progress.failedCount,
            ...sourceDetails.flatMap((source) => [
                source.title,
                source.originalUrl,
                source.canonicalUrl,
                source.hostname,
                source.status,
                source.jobStatus,
                source.lastError,
                source.rejectionReason
            ]),
            ...failedDetails.flatMap((failure) => [
                failure.url,
                failure.message
            ])
        ]
            .filter((item) => item !== null && item !== undefined)
            .join(' ')
            .toLowerCase();
    }

    function batchMatchesHistoryFilter(batch = {}) {
        const progress = batch.progress || {};
        const status = String(batch.status || '').trim().toLowerCase();
        const filter = batchHistoryFilterValue || 'all';
        const requestedCount = Number(progress.requestedCount ?? batch.requestedCount ?? 0);
        const createdSourceCount = Number(progress.createdSourceCount ?? progress.sourceCount ?? batch.createdCount ?? 0);
        const processedCount = Number(progress.processedCount || 0);
        const approvedCount = Number(progress.approvedCount || 0);
        const failedCount = Number(progress.failedCount || 0);
        const queuedJobCount = Number(progress.queuedJobCount || 0);
        const queuedSourceCount = Number(progress.queuedSourceCount || 0);
        const completionPercent = Number(progress.completionPercent || 0);

        if (filter === 'all') return true;

        if (filter === 'queued') {
            return status === 'queued' || queuedJobCount > 0 || queuedSourceCount > 0;
        }

        if (filter === 'processing') {
            return ['processing', 'running'].includes(status)
                || (processedCount > 0 && completionPercent > 0 && completionPercent < 100);
        }

        if (filter === 'partial') {
            return status === 'partial' || (failedCount > 0 && (processedCount > 0 || approvedCount > 0));
        }

        if (filter === 'failed') {
            return status === 'failed' || failedCount > 0;
        }

        if (filter === 'completed') {
            const completionBase = requestedCount || createdSourceCount || 0;
            return completionPercent >= 100 || (completionBase > 0 && processedCount >= completionBase);
        }

        if (filter === 'approved') {
            const approvalBase = createdSourceCount || requestedCount || 0;
            return status === 'approved' || (approvalBase > 0 && approvedCount >= approvalBase);
        }

        return true;
    }

    function getFilteredBatchHistory() {
        const searchTerm = String(batchHistorySearchTerm || '').trim().toLowerCase();

        return batchHistoryCache.filter((batch) => {
            if (!batchMatchesHistoryFilter(batch)) return false;
            if (!searchTerm) return true;

            return buildBatchHistorySearchText(batch).includes(searchTerm);
        });
    }

    function updateBatchHistoryResultCount(visibleCount = 0, totalCount = 0) {
        const countEl = byId(ids.batchHistoryResultCount);
        if (!countEl) return;

        const filterLabel = batchHistoryFilterValue === 'all'
            ? 'all statuses'
            : batchHistoryFilterValue;

        countEl.textContent = totalCount
            ? `Showing ${visibleCount} of ${totalCount} batch(es) · Filter: ${filterLabel}${batchHistorySearchTerm ? ` · Search: "${batchHistorySearchTerm}"` : ''}`
            : 'No batches loaded yet.';
    }

    function formatBatchRefreshTime(value = new Date()) {
        try {
            return value.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (_) {
            return new Date().toISOString();
        }
    }

    function isProcessingTabActive() {
        const processingTab = document.querySelector('[data-nurture-tab="processing"]');
        const processingPanel = document.querySelector('[data-nurture-panel="processing"]');

        return processingTab?.classList.contains('is-active') === true
            || processingPanel?.classList.contains('is-active') === true;
    }

    function hasLiveBatchActivity(batches = batchHistoryCache) {
        return (Array.isArray(batches) ? batches : []).some((batch) => {
            const progress = batch.progress || {};
            const status = String(batch.status || '').trim().toLowerCase();
            const completionPercent = Number(progress.completionPercent || 0);
            const queuedJobs = Number(progress.queuedJobCount || 0);
            const queuedSources = Number(progress.queuedSourceCount || 0);

            return ['queued', 'processing', 'partial', 'running'].includes(status)
                || queuedJobs > 0
                || queuedSources > 0
                || (completionPercent > 0 && completionPercent < 100);
        });
    }

    function updateBatchHistoryLiveStatus(message = '', tone = '') {
        const statusEl = byId(ids.batchHistoryLiveStatus);
        if (!statusEl) return;

        statusEl.classList.remove('is-success', 'is-error', 'is-live');

        if (tone === 'success') statusEl.classList.add('is-success');
        if (tone === 'error') statusEl.classList.add('is-error');
        if (tone === 'live') statusEl.classList.add('is-live');

        statusEl.textContent = message || 'Auto-refresh is off.';
    }

    function refreshBatchHistoryLiveStatus() {
        const suffix = batchHistoryLastRefreshAt
            ? ` Last refresh: ${batchHistoryLastRefreshAt}.`
            : '';

        if (!batchHistoryAutoRefreshEnabled) {
            updateBatchHistoryLiveStatus(`Auto-refresh is off.${suffix}`);
            return;
        }

        if (!isProcessingTabActive()) {
            updateBatchHistoryLiveStatus(`Auto-refresh is paused outside the Processing tab.${suffix}`);
            return;
        }

        const hasActivity = hasLiveBatchActivity();

        updateBatchHistoryLiveStatus(
            hasActivity
                ? `Live refresh is on. Checking active batches every 15 seconds.${suffix}`
                : `Live refresh is on. No active queued or processing batches right now.${suffix}`,
            hasActivity ? 'live' : 'success'
        );
    }

    function stopBatchHistoryAutoRefresh(message = '') {
        if (batchHistoryRefreshTimer) {
            clearInterval(batchHistoryRefreshTimer);
            batchHistoryRefreshTimer = null;
        }

        if (message) {
            updateBatchHistoryLiveStatus(message);
        } else {
            refreshBatchHistoryLiveStatus();
        }
    }

    function startBatchHistoryAutoRefresh() {
        if (batchHistoryRefreshTimer) return;

        batchHistoryRefreshTimer = window.setInterval(async () => {
            if (!batchHistoryAutoRefreshEnabled || !isProcessingTabActive()) {
                stopBatchHistoryAutoRefresh();
                return;
            }

            await loadBatchHistory({ silent: true, source: 'auto-refresh' });
        }, 15000);

        refreshBatchHistoryLiveStatus();
    }

    function syncBatchHistoryAutoRefresh() {
        const toggleEl = byId(ids.batchHistoryAutoRefresh);
        batchHistoryAutoRefreshEnabled = toggleEl?.checked === true;

        if (batchHistoryAutoRefreshEnabled && isProcessingTabActive()) {
            startBatchHistoryAutoRefresh();
            return;
        }

        stopBatchHistoryAutoRefresh();
    }

    function clearBatchHistoryFilters() {
        const searchInput = byId(ids.batchHistorySearch);
        const filterSelect = byId(ids.batchHistoryFilter);

        batchHistorySearchTerm = '';
        batchHistoryFilterValue = 'all';

        if (searchInput) searchInput.value = '';
        if (filterSelect) filterSelect.value = 'all';

        renderBatchHistory(batchHistoryCache);
    }

    function renderBatchHistory(batches = []) {
        const listEl = byId(ids.batchHistoryList);
        if (!listEl) return;

        batchHistoryCache = Array.isArray(batches) ? batches : [];

        if (!batchHistoryCache.length) {
            updateBatchHistoryResultCount(0, 0);
            listEl.classList.add('muted');
            listEl.innerHTML = '<div class="empty-box">No source batches found yet. Create a batch from the Intake tab first.</div>';
            return;
        }

        const visibleBatches = getFilteredBatchHistory();
        updateBatchHistoryResultCount(visibleBatches.length, batchHistoryCache.length);

        if (!visibleBatches.length) {
            listEl.classList.add('muted');
            listEl.innerHTML = '<div class="empty-box">No batches match the current search or filter.</div>';
            return;
        }

        listEl.classList.remove('muted');
        listEl.innerHTML = visibleBatches.map((batch) => {
            const progress = batch.progress || {};
            const title = batch.title || batch.titlePrefix || 'AI Nurture Batch';
            const mentorName = batch.mentorName || batch.mentorKey || 'General';
            const percent = Math.max(0, Math.min(100, Number(progress.completionPercent || 0)));
            const sourceStatuses = progress.sourceStatusCounts || {};
            const jobStatuses = progress.jobStatusCounts || {};
            const requestedCount = progress.requestedCount ?? batch.requestedCount ?? 0;
            const createdSourceCount = progress.createdSourceCount ?? progress.sourceCount ?? batch.createdCount ?? 0;
            const queuedJobCount = progress.queuedJobCount ?? jobStatuses.queued ?? 0;
            const processedCount = progress.processedCount ?? 0;
            const approvedCount = progress.approvedCount ?? sourceStatuses.approved ?? 0;
            const failedCount = progress.failedCount ?? 0;
            const createdAt = batch.createdAt || '';
            const updatedAt = batch.updatedAt || '';

            return `
                <div class="batch-history-item" data-batch-id="${escapeHtml(batch.id)}">
                    <div class="batch-history-item-head">
                        <div>
                            <div class="batch-history-title">${escapeHtml(title)}</div>
                            <div class="batch-history-subtitle">
                                ${escapeHtml(mentorName)} · Status: ${escapeHtml(batch.status || 'created')} · Updated: ${escapeHtml(updatedAt || createdAt || 'n/a')}
                            </div>
                            <div class="chip-wrap">
                                <span class="chip info">${escapeHtml(batch.mentorKey || 'general')}</span>
                                <span class="chip ${percent >= 80 ? 'ok' : percent >= 30 ? 'warn' : 'info'}">${percent}% processed</span>
                                <span class="chip">Priority ${escapeHtml(batch.queuePriority || 3)}</span>
                            </div>
                        </div>

                        <div class="batch-history-actions">
                            <button type="button" class="secondary" data-batch-history-action="view" data-batch-id="${escapeHtml(batch.id)}">View Details</button>
                        </div>
                    </div>

                    <div class="batch-history-progress" aria-label="Batch progress">
                        <div class="batch-history-progress-bar" style="width: ${percent}%"></div>
                    </div>

                    <div class="batch-history-stats">
                        <div class="batch-history-stat"><span>Requested</span><strong>${escapeHtml(requestedCount)}</strong></div>
                        <div class="batch-history-stat"><span>Created Sources</span><strong>${escapeHtml(createdSourceCount)}</strong></div>
                        <div class="batch-history-stat"><span>Queued Jobs</span><strong>${escapeHtml(queuedJobCount)}</strong></div>
                        <div class="batch-history-stat"><span>Processed</span><strong>${escapeHtml(processedCount)}</strong></div>
                        <div class="batch-history-stat"><span>Approved</span><strong>${escapeHtml(approvedCount)}</strong></div>
                        <div class="batch-history-stat"><span>Failed</span><strong>${escapeHtml(failedCount)}</strong></div>
                    </div>

                    <div class="chip-wrap">
                        <span class="chip info">Total jobs: ${escapeHtml(progress.jobCount ?? batch.jobCount ?? 0)}</span>
                        <span class="chip ok">Completed jobs: ${escapeHtml(progress.completedJobCount ?? jobStatuses.completed ?? 0)}</span>
                        <span class="chip warn">Queued sources: ${escapeHtml(progress.queuedSourceCount ?? sourceStatuses.queued ?? 0)}</span>
                        <span class="chip danger">Rejected: ${escapeHtml(progress.rejectedCount ?? sourceStatuses.rejected ?? 0)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function loadBatchHistory(options = {}) {
        const listEl = byId(ids.batchHistoryList);
        const silent = options?.silent === true;

        if (batchHistoryIsLoading && silent) {
            return batchHistoryCache;
        }

        batchHistoryIsLoading = true;

        try {
            if (listEl && !silent) {
                listEl.classList.add('muted');
                listEl.textContent = 'Loading batch history…';
            }

            const response = await fetch(
                '/api/internal/ai-nurture/batches?limit=20',
                {
                    credentials:
                        'same-origin',

                    headers: {
                        'Content-Type':
                            'application/json'
                    }
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to load batch history.');
            }

            const batches = result.batches || [];
            batchHistoryLastRefreshAt = formatBatchRefreshTime();
            renderBatchHistory(batches);
            refreshBatchHistoryLiveStatus();

            if (activeBatchDetailsId) {
                const drawer = byId(ids.batchDetailsDrawer);
                const refreshedBatch = batches.find((item) => item.id === activeBatchDetailsId);

                if (drawer && !drawer.hidden && refreshedBatch) {
                    renderBatchDetailsDrawer(refreshedBatch);
                }
            }

            return batches;
        } catch (error) {
            if (listEl && !silent) {
                listEl.classList.add('muted');
                listEl.innerHTML = `<div class="empty-box">Failed to load batch history: ${escapeHtml(error.message || 'Unknown error')}</div>`;
            }

            updateBatchHistoryLiveStatus(`Auto-refresh could not update batch history: ${error.message || 'Unknown error'}`, 'error');
            return batchHistoryCache;
        } finally {
            batchHistoryIsLoading = false;
        }
    }

    function batchToneClass(status = '') {
        const cleanStatus = String(status || '').trim().toLowerCase();

        if (['approved', 'completed', 'fetched', 'reviewed', 'created'].includes(cleanStatus)) {
            return 'ok';
        }

        if (['queued', 'running', 'processing', 'partial'].includes(cleanStatus)) {
            return 'warn';
        }

        if (['failed', 'rejected', 'blocked'].includes(cleanStatus)) {
            return 'danger';
        }

        return 'info';
    }

    function closeBatchDetailsDrawer() {
        const drawer = byId(ids.batchDetailsDrawer);
        const backdrop = byId(ids.batchDetailsBackdrop);

        if (drawer) drawer.hidden = true;
        if (backdrop) backdrop.hidden = true;

        activeBatchDetailsId = '';
        document.body.classList.remove('batch-details-open');
    }

    function renderBatchDetailsDrawer(batch = {}) {
        const drawer = byId(ids.batchDetailsDrawer);
        const backdrop = byId(ids.batchDetailsBackdrop);
        const titleEl = byId(ids.batchDetailsTitle);
        const metaEl = byId(ids.batchDetailsMeta);
        const statsEl = byId(ids.batchDetailsStats);
        const sourcesEl = byId(ids.batchDetailsSources);
        const failuresEl = byId(ids.batchDetailsFailures);
        const statusEl = byId(ids.batchDetailsStatus);

        if (!drawer || !backdrop || !batch?.id) return;

        const progress = batch.progress || {};
        const title = batch.title || batch.titlePrefix || 'AI Nurture Batch';
        const mentorName = batch.mentorName || batch.mentorKey || 'General';
        const sourceDetails = Array.isArray(batch.sourceDetails) ? batch.sourceDetails : [];
        const failedDetails = Array.isArray(batch.failedDetails)
            ? batch.failedDetails
            : Array.isArray(batch.failed)
                ? batch.failed
                : [];
        const percent = Math.max(0, Math.min(100, Number(progress.completionPercent || 0)));

        activeBatchDetailsId = batch.id;

        if (statusEl) {
            statusEl.classList.remove('is-success', 'is-error');
            statusEl.textContent = 'Choose a batch action to continue processing this batch.';
        }

        if (titleEl) {
            titleEl.textContent = title;
        }

        if (metaEl) {
            metaEl.innerHTML = `
                <span class="chip info">${escapeHtml(mentorName)}</span>
                <span class="chip ${batchToneClass(batch.status)}">${escapeHtml(batch.status || 'created')}</span>
                <span class="chip">${percent}% processed</span>
                <span class="chip">Updated: ${escapeHtml(batch.updatedAt || batch.createdAt || 'n/a')}</span>
            `;
        }

        if (statsEl) {
            statsEl.innerHTML = `
                <div class="batch-details-stat"><span>Requested</span><strong>${escapeHtml(progress.requestedCount ?? batch.requestedCount ?? 0)}</strong></div>
                <div class="batch-details-stat"><span>Created Sources</span><strong>${escapeHtml(progress.createdSourceCount ?? progress.sourceCount ?? batch.createdCount ?? 0)}</strong></div>
                <div class="batch-details-stat"><span>Total Jobs</span><strong>${escapeHtml(progress.jobCount ?? batch.jobCount ?? 0)}</strong></div>
                <div class="batch-details-stat"><span>Queued Jobs</span><strong>${escapeHtml(progress.queuedJobCount ?? 0)}</strong></div>
                <div class="batch-details-stat"><span>Processed</span><strong>${escapeHtml(progress.processedCount ?? 0)}</strong></div>
                <div class="batch-details-stat"><span>Approved</span><strong>${escapeHtml(progress.approvedCount ?? 0)}</strong></div>
                <div class="batch-details-stat"><span>Failed</span><strong>${escapeHtml(progress.failedCount ?? 0)}</strong></div>
                <div class="batch-details-stat"><span>Rejected</span><strong>${escapeHtml(progress.rejectedCount ?? 0)}</strong></div>
            `;
        }

        if (sourcesEl) {
            sourcesEl.innerHTML = sourceDetails.length
                ? sourceDetails.map((source, index) => {
                    const sourceTitle = source.title || source.hostname || source.canonicalUrl || source.originalUrl || `Source ${index + 1}`;
                    const sourceUrl = source.canonicalUrl || source.originalUrl || '';
                    const sourceStatus = source.status || 'unknown';
                    const jobStatus = source.jobStatus || 'no job';
                    const issue = source.lastError || source.rejectionReason || source.jobLastError || '';

                    return `
                        <div class="batch-source-row">
                            <div class="batch-source-row-main">
                                <div class="batch-source-index">#${index + 1}</div>
                                <div class="batch-source-copy">
                                    <div class="batch-source-title">${escapeHtml(sourceTitle)}</div>
                                    <div class="batch-source-url">${escapeHtml(sourceUrl || source.id || 'No source URL')}</div>
                                    ${issue ? `<div class="batch-source-error">${escapeHtml(issue)}</div>` : ''}
                                    <div class="batch-source-meta">
                                        <span>Updated: ${escapeHtml(source.updatedAt || 'n/a')}</span>
                                        <span>Analyzed: ${escapeHtml(source.analyzedAt || 'n/a')}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="batch-source-badges">
                                <span class="chip ${batchToneClass(sourceStatus)}">${escapeHtml(sourceStatus)}</span>
                                <span class="chip ${batchToneClass(jobStatus)}">Job: ${escapeHtml(jobStatus)}</span>
                                ${source.approved ? '<span class="chip ok">In library</span>' : ''}
                                ${source.id ? `<button type="button" class="secondary" data-batch-source-action="preview" data-source-id="${escapeHtml(source.id)}">Review Preview</button>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')
                : '<div class="empty-box">No source-level records are available for this batch yet.</div>';
        }

        if (failuresEl) {
            failuresEl.innerHTML = failedDetails.length
                ? failedDetails.map((failure, index) => `
                    <div class="batch-failure-row">
                        <strong>#${index + 1} ${escapeHtml(failure.url || 'Import failure')}</strong>
                        <span>${escapeHtml(failure.message || failure.lastError || 'No error message saved.')}</span>
                    </div>
                `).join('')
                : '<div class="empty-box">No import failures recorded for this batch.</div>';
        }

        drawer.hidden = false;
        backdrop.hidden = false;
        document.body.classList.add('batch-details-open');
    }

    function closeSourceDetailDrawer() {
        const drawer = byId(ids.sourceDetailDrawer);
        const backdrop = byId(ids.sourceDetailBackdrop);

        if (drawer) drawer.hidden = true;
        if (backdrop) backdrop.hidden = true;

        activeSourceDetailId = '';
        document.body.classList.remove('source-details-open');
    }

    function renderSourceListItems(items = []) {
        const cleanItems = Array.isArray(items)
            ? items.map((item) => String(item || '').trim()).filter(Boolean)
            : [];

        if (!cleanItems.length) return '<li>None</li>';

        return cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    }

    function renderSourceScore(label = '', value = '') {
        const cleanValue = value === null || value === undefined || value === ''
            ? 'n/a'
            : value;

        return `
            <div class="source-detail-score">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(cleanValue)}</strong>
            </div>
        `;
    }

    function renderSourcePreviewChunks(chunks = []) {
        const rows = Array.isArray(chunks) ? chunks.slice(0, 10) : [];

        if (!rows.length) {
            return '<div class="empty-box">No chunks are available for this source yet.</div>';
        }

        return rows.map((chunk) => `
            <div class="source-detail-chunk">
                <div class="source-detail-chunk-head">
                    <strong>Chunk ${escapeHtml(chunk.index || 'n/a')}</strong>
                    <span class="chip ${batchToneClass(chunk.decision || 'reference_only')}">${escapeHtml(chunk.decision || 'reference_only')}</span>
                </div>
                <div class="muted">${escapeHtml(chunk.reason || 'No decision reason saved.')}</div>
                <div class="source-detail-chunk-text">${escapeHtml((chunk.text || '').slice(0, 520))}${(chunk.text || '').length > 520 ? '…' : ''}</div>
            </div>
        `).join('');
    }

    function renderDuplicatePreviewMatches(review = {}) {
        const matches = Array.isArray(review.duplicateMatches)
            ? review.duplicateMatches
            : review.duplicateTopMatch
                ? [review.duplicateTopMatch]
                : [];

        if (!matches.length) {
            return '<div class="empty-box">No duplicate matches saved.</div>';
        }

        return matches.slice(0, 5).map((match) => `
            <div class="source-detail-mini-row">
                <strong>${escapeHtml(match.title || match.sourceTitle || match.id || 'Duplicate candidate')}</strong>
                <span>${escapeHtml(match.summary || match.reason || match.url || 'No duplicate note saved.')}</span>
            </div>
        `).join('');
    }

    function renderSourceEvidenceItems(review = {}, chunks = []) {
        const reviewEvidence = Array.isArray(review.evidenceItems) ? review.evidenceItems : [];
        const chunkEvidence = (Array.isArray(chunks) ? chunks : [])
            .flatMap((chunk) => Array.isArray(chunk.evidenceItems) ? chunk.evidenceItems : []);

        const rows = [...reviewEvidence, ...chunkEvidence]
            .filter((item, index, source) => {
                const key = [
                    item.sourceUrl || item.canonicalUrl || item.timestampUrl || '',
                    item.timestampLabel || '',
                    item.chunkIndex || '',
                    item.claim || item.evidenceExcerpt || ''
                ].join('|');

                return key.trim() && source.findIndex((candidate) => [
                    candidate.sourceUrl || candidate.canonicalUrl || candidate.timestampUrl || '',
                    candidate.timestampLabel || '',
                    candidate.chunkIndex || '',
                    candidate.claim || candidate.evidenceExcerpt || ''
                ].join('|') === key) === index;
            })
            .slice(0, 8);

        if (!rows.length) {
            return '<div class="empty-box">No evidence items captured yet. New processed sources will store source proof when usable chunks exist.</div>';
        }

        return rows.map((item) => {
            const sourceUrl = item.timestampUrl || item.sourceUrl || item.canonicalUrl || '';
            const sourceTitle = item.sourceTitle || item.knowledgeTitle || 'Source evidence';
            const timestamp = item.timestampLabel ? ` · ${item.timestampLabel}` : '';
            const speaker = item.speakerName ? `${item.speakerName} · ` : '';

            return `
                <div class="source-detail-evidence-card">
                    <div class="source-detail-evidence-head">
                        <strong>${escapeHtml(speaker + sourceTitle)}${escapeHtml(timestamp)}</strong>
                        ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source</a>` : ''}
                    </div>
                    <div class="source-detail-evidence-claim">${escapeHtml(item.claim || item.evidenceNote || 'Source proof saved for this knowledge item.')}</div>
                    <div class="source-detail-evidence-excerpt">${escapeHtml(item.evidenceExcerpt || 'No excerpt saved.')}</div>
                    <div class="source-detail-evidence-meta">
                        <span>Chunk ${escapeHtml(item.chunkIndex || 'n/a')}</span>
                        <span>${escapeHtml(item.evidenceNote || 'Evidence captured from source.')}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderSourceReviewPreview(detail = {}) {
        const drawer = byId(ids.sourceDetailDrawer);
        const backdrop = byId(ids.sourceDetailBackdrop);
        const titleEl = byId(ids.sourceDetailTitle);
        const metaEl = byId(ids.sourceDetailMeta);
        const bodyEl = byId(ids.sourceDetailBody);
        const statusEl = byId(ids.sourceDetailStatus);

        if (!drawer || !backdrop || !bodyEl) return;

        const source = detail.source || {};
        const review = detail.review || {};
        const snapshot = detail.snapshot || {};
        const chunks = Array.isArray(detail.chunks) ? detail.chunks : [];
        const sourceTitle = source.title || snapshot.title || source.hostname || source.canonicalUrl || source.originalUrl || 'Untitled source';
        const sourceUrl = source.canonicalUrl || source.originalUrl || snapshot.finalUrl || '';
        const decision = review.overallDecision || 'not reviewed';
        const sourceStatus = source.status || 'unknown';
        const issue = source.lastError || source.rejectionReason || '';

        activeSourceDetailId = source.id || '';

        if (titleEl) titleEl.textContent = sourceTitle;

        if (metaEl) {
            metaEl.innerHTML = `
                <span class="chip ${batchToneClass(sourceStatus)}">${escapeHtml(sourceStatus)}</span>
                <span class="chip ${batchToneClass(decision)}">Decision: ${escapeHtml(decision)}</span>
                <span class="chip info">${escapeHtml(source.hostname || snapshot.siteName || 'source')}</span>
                <span class="chip">Updated: ${escapeHtml(source.updatedAt || 'n/a')}</span>
            `;
        }

        if (statusEl) {
            statusEl.classList.remove('is-success', 'is-error');
            statusEl.textContent = issue
                ? `Issue: ${issue}`
                : 'Review preview loaded from the source detail endpoint.';
            if (issue) statusEl.classList.add('is-error');
        }

        bodyEl.innerHTML = `
            <div class="source-detail-section">
                <h3>Source</h3>
                <div class="source-detail-link">${escapeHtml(sourceUrl || source.id || 'No URL saved.')}</div>
                <div class="source-detail-grid">
                    <div class="source-detail-card"><span>Status</span><strong>${escapeHtml(sourceStatus)}</strong></div>
                    <div class="source-detail-card"><span>Queue Priority</span><strong>${escapeHtml(source.queuePriority || 3)}</strong></div>
                    <div class="source-detail-card"><span>Fetched</span><strong>${escapeHtml(source.fetchedAt || 'n/a')}</strong></div>
                    <div class="source-detail-card"><span>Analyzed</span><strong>${escapeHtml(source.analyzedAt || 'n/a')}</strong></div>
                </div>
                ${issue ? `<div class="source-detail-error">${escapeHtml(issue)}</div>` : ''}
            </div>

            <div class="source-detail-section">
                <h3>Review Summary</h3>
                <div class="source-detail-summary">${escapeHtml(review.summaryLong || review.summaryShort || 'No review summary is available yet.')}</div>
                <div class="source-detail-score-grid">
                    ${renderSourceScore('Relevance', review?.scores?.relevance)}
                    ${renderSourceScore('Trust', review?.scores?.trust ?? review.domainTrustScore)}
                    ${renderSourceScore('Duplication', review?.scores?.duplication ?? review.duplicateScore)}
                    ${renderSourceScore('Actionability', review?.scores?.actionability)}
                    ${renderSourceScore('Freshness', review.freshnessScore)}
                    ${renderSourceScore('Clean chars', snapshot.cleanTextChars || 0)}
                </div>
            </div>

            <div class="source-detail-section">
                <h3>Evidence / Source Proof</h3>
                ${renderSourceEvidenceItems(review, chunks)}
            </div>

            <div class="source-detail-section">
                <h3>Absorb</h3>
                <ul class="source-detail-list">${renderSourceListItems(review.absorbWhat)}</ul>

                <h3>Do Not Absorb</h3>
                <ul class="source-detail-list">${renderSourceListItems(review.doNotAbsorbWhat)}</ul>

                <h3>Risk Notes</h3>
                <ul class="source-detail-list">${renderSourceListItems(review.riskNotes)}</ul>
            </div>

            <div class="source-detail-section">
                <h3>Duplicate Matches</h3>
                ${renderDuplicatePreviewMatches(review)}
            </div>

            <div class="source-detail-section">
                <h3>Chunks</h3>
                ${renderSourcePreviewChunks(chunks)}
            </div>
        `;

        drawer.hidden = false;
        backdrop.hidden = false;
        document.body.classList.add('source-details-open');
    }

    async function openSourceReviewPreview(sourceId = '') {
        const cleanSourceId = String(sourceId || '').trim();
        const statusEl = byId(ids.sourceDetailStatus);

        if (!cleanSourceId) {
            if (statusEl) {
                statusEl.classList.add('is-error');
                statusEl.textContent = 'Source ID is missing.';
            }
            return;
        }

        try {
            if (statusEl) {
                statusEl.classList.remove('is-success', 'is-error');
                statusEl.textContent = 'Loading source review preview...';
            }

            const result = await request(`/sources/${encodeURIComponent(cleanSourceId)}`, {
                method: 'GET'
            });

            renderSourceReviewPreview(result);
        } catch (error) {
            if (statusEl) {
                statusEl.classList.remove('is-success');
                statusEl.classList.add('is-error');
                statusEl.textContent = error.message || 'Failed to load source review preview.';
            }

            setOutput({
                success: false,
                message: error.message || 'Failed to load source review preview.'
            });
        }
    }

    async function handleBatchSourcePreviewClick(event) {
        const button = event.target?.closest?.('[data-batch-source-action="preview"]');
        if (!button) return;

        const sourceId = button.getAttribute('data-source-id');
        await openSourceReviewPreview(sourceId);
    }

    async function runBatchDetailsAction(event) {
        const button = event.target?.closest?.('[data-batch-details-action]');
        if (!button) return;

        const action = button.getAttribute('data-batch-details-action');
        const batchId = activeBatchDetailsId;
        const statusEl = byId(ids.batchDetailsStatus);

        if (!batchId) {
            if (statusEl) {
                statusEl.classList.add('is-error');
                statusEl.textContent = 'Open a batch first before running an action.';
            }
            return;
        }

        const labels = {
            run: 'Run Remaining Jobs',
            retry: 'Retry Failed Sources',
            approve: 'Approve Ready Sources'
        };

        const paths = {
            run: `/batches/${encodeURIComponent(batchId)}/run-remaining`,
            retry: `/batches/${encodeURIComponent(batchId)}/retry-failed`,
            approve: `/batches/${encodeURIComponent(batchId)}/approve-ready`
        };

        const bodies = {
            run: { maxRuns: 10 },
            retry: {},
            approve: { limit: 25 }
        };

        if (!paths[action]) return;

        try {
            button.disabled = true;
            button.textContent = 'Working...';

            if (statusEl) {
                statusEl.classList.remove('is-success', 'is-error');
                statusEl.textContent = `${labels[action]} is running...`;
            }

            const result = await request(paths[action], {
                method: 'POST',
                body: JSON.stringify(bodies[action] || {})
            });

            const batches = await loadBatchHistory();
            const refreshedBatch = batches.find((item) => item.id === batchId);

            if (refreshedBatch) {
                renderBatchDetailsDrawer(refreshedBatch);
            }

            if (statusEl) {
                statusEl.classList.toggle('is-error', Number(result.failedCount || 0) > 0);
                statusEl.classList.toggle('is-success', Number(result.failedCount || 0) === 0);
                statusEl.textContent = result.message || `${labels[action]} completed.`;
            }

            setV2Status(result.message || `${labels[action]} completed.`, Number(result.failedCount || 0) > 0 ? 'error' : 'success');
        } catch (error) {
            if (statusEl) {
                statusEl.classList.remove('is-success');
                statusEl.classList.add('is-error');
                statusEl.textContent = error.message || 'Batch action failed.';
            }

            setV2Status(error.message || 'Batch action failed.', 'error');
            setOutput({
                success: false,
                message: error.message || 'Batch action failed.'
            });
        } finally {
            button.disabled = false;
            button.textContent = labels[action] || 'Run Action';
        }
    }

    function handleBatchHistoryClick(event) {
        const button = event.target?.closest?.('[data-batch-history-action]');
        if (!button) return;

        const action = button.getAttribute('data-batch-history-action');
        const batchId = button.getAttribute('data-batch-id');
        const batch = batchHistoryCache.find((item) => item.id === batchId);

        if (action === 'view') {
            const progress = batch?.progress || {};
            renderBatchDetailsDrawer(batch);

            setOutput({
                success: true,
                message: 'Batch details loaded.',
                batch,
                requestedCount: progress.requestedCount ?? batch?.requestedCount ?? 0,
                createdCount: progress.createdSourceCount ?? progress.sourceCount ?? batch?.createdCount ?? 0,
                jobCount: progress.jobCount ?? batch?.jobCount ?? 0,
                queuedJobCount: progress.queuedJobCount ?? 0,
                runCount: progress.processedCount ?? 0,
                approvedCount: progress.approvedCount ?? 0,
                failedCount: progress.failedCount ?? 0
            });
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
                loadMentorPacks(),
                loadBatchHistory()
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
                loadBatchHistory();
            } catch (_) {}
        }

        syncBatchHistoryAutoRefresh();

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
        const discoveryRunButton = byId(ids.discoveryRun);
        const discoveryImportButton = byId(ids.discoveryImport);
        const discoveryClearButton = byId(ids.discoveryClear);
        const v2RunJobsButton = byId(ids.v2RunJobs);
        const v2ApproveReadyButton = byId(ids.v2ApproveReady);
        const v2RefreshBoardButton = byId(ids.v2RefreshBoard);
        const batchHistoryRefreshButton = byId(ids.batchHistoryRefresh);
        const batchHistorySearchInput = byId(ids.batchHistorySearch);
        const batchHistoryFilterSelect = byId(ids.batchHistoryFilter);
        const batchHistoryClearButton = byId(ids.batchHistoryClear);
        const batchHistoryAutoRefreshToggle = byId(ids.batchHistoryAutoRefresh);
        const batchHistoryList = byId(ids.batchHistoryList);
        const batchDetailsCloseButton = byId(ids.batchDetailsClose);
        const batchDetailsBackdrop = byId(ids.batchDetailsBackdrop);
        const batchDetailsDrawer = byId(ids.batchDetailsDrawer);
        const sourceDetailCloseButton = byId(ids.sourceDetailClose);
        const sourceDetailBackdrop = byId(ids.sourceDetailBackdrop);
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
        discoveryRunButton?.addEventListener('click', discoverSourceLinks);
        discoveryImportButton?.addEventListener('click', importDiscoveredLinksToBatch);
        discoveryClearButton?.addEventListener('click', clearDiscovery);
        v2RunJobsButton?.addEventListener('click', runQueuedJobsBatch);
        v2ApproveReadyButton?.addEventListener('click', approveReadySourcesBatch);
        v2RefreshBoardButton?.addEventListener('click', refreshNurtureBoard);
        batchHistoryRefreshButton?.addEventListener('click', loadBatchHistory);
        batchHistorySearchInput?.addEventListener('input', () => {
            batchHistorySearchTerm = valueOf(ids.batchHistorySearch).toLowerCase();
            renderBatchHistory(batchHistoryCache);
        });
        batchHistoryFilterSelect?.addEventListener('change', () => {
            batchHistoryFilterValue = valueOf(ids.batchHistoryFilter) || 'all';
            renderBatchHistory(batchHistoryCache);
        });
        batchHistoryClearButton?.addEventListener('click', clearBatchHistoryFilters);
        batchHistoryAutoRefreshToggle?.addEventListener('change', syncBatchHistoryAutoRefresh);
        batchHistoryList?.addEventListener('click', handleBatchHistoryClick);
        batchDetailsCloseButton?.addEventListener('click', closeBatchDetailsDrawer);
        batchDetailsBackdrop?.addEventListener('click', closeBatchDetailsDrawer);
        batchDetailsDrawer?.addEventListener('click', runBatchDetailsAction);
        batchDetailsDrawer?.addEventListener('click', handleBatchSourcePreviewClick);
        sourceDetailCloseButton?.addEventListener('click', closeSourceDetailDrawer);
        sourceDetailBackdrop?.addEventListener('click', closeSourceDetailDrawer);
        rawResponseToggle?.addEventListener('click', toggleRawResponse);

        document.addEventListener('visibilitychange', syncBatchHistoryAutoRefresh);
        window.addEventListener('beforeunload', () => stopBatchHistoryAutoRefresh());

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const sourceDrawer = byId(ids.sourceDetailDrawer);

                if (sourceDrawer && !sourceDrawer.hidden) {
                    closeSourceDetailDrawer();
                    return;
                }

                closeBatchDetailsDrawer();
            }
        });

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
    return () => {
        stopBatchHistoryAutoRefresh();
        document.body.classList.remove(
          'batch-details-open',
          'source-details-open'
        );
      };
})();

return disposeMentorManager;
}

function renderNode(node, key) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return null;

  const tag = node.tagName.toLowerCase();
  const props = { key };

  for (const attr of node.attributes) {
    const name = attr.name;

    if (name === 'selected') continue;

    if (name === 'style') {
      const styles = {};

      for (const part of attr.value.split(';')) {
        const cut = part.indexOf(':');
        if (cut < 0) continue;

        const property = part.slice(0, cut).trim()
          .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

        if (property) styles[property] = part.slice(cut + 1).trim();
      }

      props.style = styles;
    } else if (
      ['checked', 'disabled', 'hidden', 'multiple', 'required', 'readonly']
        .includes(name)
    ) {
      props[name === 'checked' ? 'defaultChecked' :
        name === 'readonly' ? 'readOnly' : name] = true;
    } else {
      props[
        name === 'class' ? 'className' :
        name === 'for' ? 'htmlFor' :
        name === 'tabindex' ? 'tabIndex' : name
      ] = attr.value;
    }
  }

  if (tag === 'select') {
    const selected = node.querySelector('option[selected]');
    if (selected) props.defaultValue = selected.getAttribute('value');
  }

  if (tag === 'input' && props.value !== undefined) {
    props.defaultValue = props.value;
    delete props.value;
  }

  if (tag === 'textarea') {
    props.defaultValue = node.textContent || '';
  }

  const children = tag === 'textarea'
    ? []
    : Array.from(node.childNodes, (child, index) =>
        renderNode(child, index)
      );

  return React.createElement(tag, props, ...children);
}

export default function AiNurturePage() {
  const content = useMemo(() => {
    const document = new DOMParser().parseFromString(
      markup,
      'text/html'
    );

    return Array.from(document.body.childNodes, (node, index) =>
      renderNode(node, index)
    );
  }, []);


  useLayoutEffect(() => {
    const listeners = [];
    let disposed = false;
    let cleanup = null;

    // Delay initial boot to avoid React StrictMode
    // development setup/cleanup duplication.
    const yhAiNurtureStartupTimer = window.setTimeout(() => {
      if (disposed) return;

      const originalAdd =
        EventTarget.prototype.addEventListener;

      EventTarget.prototype.addEventListener =
        function(type, handler, options) {

          // React has already mounted this page.
          // Initialize legacy DOM-ready handlers now.
          if (type === 'DOMContentLoaded') {
            const event = new Event('DOMContentLoaded');

            if (typeof handler === 'function') {
              handler.call(this, event);
            } else {
              handler?.handleEvent?.(event);
            }

            return;
          }

          originalAdd.call(this, type, handler, options);

          listeners.push([
            this,
            type,
            handler,
            options
          ]);
        };

      try {
        cleanup = bootControllers();
      } catch (error) {
        console.error(
          '[YHU AI Nurture] Initialization failed:',
          error
        );

        const summary =
          document.getElementById('response-summary');

        if (summary) {
          summary.textContent =
            'Unable to initialize AI Nurture. Please reload.';
        }
      } finally {
        EventTarget.prototype.addEventListener =
          originalAdd;
      }
    }, 0);

    return () => {
      disposed = true;

      window.clearTimeout(
        yhAiNurtureStartupTimer
      );

      try {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      } finally {
        for (const [
          target,
          type,
          handler,
          options
        ] of listeners) {
          target.removeEventListener(
            type,
            handler,
            options
          );
        }

        document.body.classList.remove(
          'batch-details-open',
          'source-details-open'
        );
      }
    };
  }, []);

  return React.createElement(
    'div',
    { className: 'nurture-page' },
    ...content
  );
}