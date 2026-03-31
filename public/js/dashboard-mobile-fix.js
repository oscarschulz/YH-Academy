(function () {
    const MOBILE_BREAKPOINT = 768;

    function isMobileView() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function getAcademyElements() {
        const wrap = document.querySelector('.academy-entry-cta-wrap');
        const button = document.getElementById('btn-open-academy-apply');
        const label = button ? button.querySelector('.yh-btn-label') : null;
        return { wrap, button, label };
    }

    function hardenAcademyTapZone() {
        if (!isMobileView()) return;

        const { wrap, button, label } = getAcademyElements();
        if (!wrap || !button) return;

        wrap.style.width = '100%';
        wrap.style.pointerEvents = 'auto';
        wrap.style.position = 'relative';
        wrap.style.zIndex = '1002';

        button.style.width = '100%';
        button.style.minHeight = '56px';
        button.style.pointerEvents = 'auto';
        button.style.position = 'relative';
        button.style.zIndex = '1003';
        button.style.touchAction = 'manipulation';
        button.style.webkitTapHighlightColor = 'transparent';

        if (label) {
            label.style.display = 'block';
            label.style.width = '100%';
            label.style.textAlign = 'center';
            label.style.pointerEvents = 'none';
        }
    }

    function initDashboardMobileFix() {
        hardenAcademyTapZone();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboardMobileFix);
    } else {
        initDashboardMobileFix();
    }

    window.addEventListener('resize', initDashboardMobileFix);
})();