(function () {
    const MOBILE_BREAKPOINT = 768;

    function isMobileView() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function getAcademyElements() {
        const wrap = document.querySelector('.academy-entry-cta-wrap');
        const button = document.getElementById('btn-open-academy-apply');
        const label = button ? button.querySelector('.yh-btn-label') : null;
        const carousel = document.getElementById('yh-universe-carousel');
        return { wrap, button, label, carousel };
    }

    function hardenAcademyTapZone() {
        if (!isMobileView()) return;

        const { wrap, button, label } = getAcademyElements();
        if (!wrap || !button) return;
        if (wrap.dataset.mobileFixBound === 'true') return;

        wrap.dataset.mobileFixBound = 'true';

        wrap.style.width = '100%';
        wrap.style.pointerEvents = 'auto';
        wrap.style.position = 'relative';
        wrap.style.zIndex = '1002';
        wrap.style.touchAction = 'manipulation';

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

    function installMobileTapForwarder() {
        if (!isMobileView()) return;

        const { wrap, button, carousel } = getAcademyElements();
        if (!wrap || !button) return;
        if (wrap.dataset.mobileForwarderBound === 'true') return;

        wrap.dataset.mobileForwarderBound = 'true';

        const stopSwipeConflict = (event) => {
            event.stopPropagation?.();
        };

        const forwardWrapperTap = (event) => {
            if (!isMobileView()) return;

            const target = event.target;
            const tappedInsideWrap = target && typeof target.closest === 'function'
                ? target.closest('.academy-entry-cta-wrap')
                : null;

            if (!tappedInsideWrap) return;

            const tappedDirectButton = target && typeof target.closest === 'function'
                ? target.closest('#btn-open-academy-apply')
                : null;

            if (tappedDirectButton) return;

            if (button.dataset.loading === 'true') return;

            event.preventDefault?.();
            event.stopPropagation?.();
            event.stopImmediatePropagation?.();

            button.click();
        };

        wrap.addEventListener('touchstart', stopSwipeConflict, { passive: true });
        wrap.addEventListener('pointerdown', stopSwipeConflict, true);
        wrap.addEventListener('mousedown', stopSwipeConflict, true);

        wrap.addEventListener('touchend', forwardWrapperTap, { passive: false });
        wrap.addEventListener('pointerup', forwardWrapperTap, true);

        if (carousel && carousel.dataset.mobileAcademyShield !== 'true') {
            carousel.dataset.mobileAcademyShield = 'true';

            carousel.addEventListener('touchstart', (event) => {
                const target = event.target;
                const insideWrap = target && typeof target.closest === 'function'
                    ? target.closest('.academy-entry-cta-wrap')
                    : null;

                if (!insideWrap) return;
                event.stopPropagation?.();
            }, { passive: true, capture: true });

            carousel.addEventListener('touchend', (event) => {
                const target = event.target;
                const insideWrap = target && typeof target.closest === 'function'
                    ? target.closest('.academy-entry-cta-wrap')
                    : null;

                if (!insideWrap) return;
                event.stopPropagation?.();
            }, { passive: true, capture: true });
        }
    }

    function initDashboardMobileFix() {
        if (!isMobileView()) return;
        hardenAcademyTapZone();
        installMobileTapForwarder();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboardMobileFix);
    } else {
        initDashboardMobileFix();
    }

    window.addEventListener('resize', () => {
        initDashboardMobileFix();
    });
})();