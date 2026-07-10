


/* PATCH: Admin backend-only review hard stop v1 */
(function installAdminBackendOnlyReviewHardStopV1() {
  if (window.__yhAdminBackendOnlyReviewHardStopV1Installed) return;
  window.__yhAdminBackendOnlyReviewHardStopV1Installed = true;

  try {
    [
      'yh_academy_membership_status_v1',
      'yh_plaza_access_status_v1',
      'yh_federation_access_status_v1',
      'yh_dashboard_division_application_pending_locks_v1',
      'yh_dashboard_division_application_pending_locks_v2'
    ].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  } catch (_) {}

  try {
    if (typeof applyLocalApplicationReview === 'function') {
      applyLocalApplicationReview = function disabledLocalApplicationReviewV1() {
        throw new Error('Backend review did not complete. Local-only application decisions are disabled.');
      };
      window.applyLocalApplicationReview = applyLocalApplicationReview;
    }
  } catch (_) {}

  window.__yhAdminReviewBackendOnlyV1 = true;
})();
/* END PATCH: Admin backend-only review hard stop v1 */

