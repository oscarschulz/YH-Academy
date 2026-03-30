(function () {
    const MOBILE_BREAKPOINT = 768;

    function isMobileView() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function bootMobileAcademyButtonFix() {
        if (!isMobileView()) return;

        const wrap = document.querySelector('.academy-entry-cta-wrap');
        const btn = document.getElementById('btn-open-academy-apply');
        const carousel = document.getElementById('yh-universe-carousel');

        if (!wrap || !btn) return;
        if (wrap.dataset.mobileFixBound === 'true') return;

        wrap.dataset.mobileFixBound = 'true';

        // Make sure the entire visible area is a real tap zone
        wrap.style.width = '100%';
        wrap.style.pointerEvents = 'auto';
        wrap.style.position = 'relative';
        wrap.style.zIndex = '1002';
        wrap.style.touchAction = 'manipulation';

        btn.style.width = '100%';
        btn.style.minHeight = '52px';
        btn.style.pointerEvents = 'auto';
        btn.style.position = 'relative';
        btn.style.zIndex = '1003';
        btn.style.touchAction = 'manipulation';
        btn.style.webkitTapHighlightColor = 'transparent';

        const stopSwipeConflict = (event) => {
            event.stopPropagation?.();
        };

        const forwardTapToButton = (event) => {
            if (!isMobileView()) return;

            const target = event.target;
            const insideWrap = target && typeof target.closest === 'function'
                ? target.closest('.academy-entry-cta-wrap')
                : null;

            if (!insideWrap) return;

            event.preventDefault?.();
            event.stopPropagation?.();
            event.stopImmediatePropagation?.();

            // If user tapped wrapper or button text area, always trigger the real button once
            if (btn.dataset.loading === 'true') return;

            btn.click();
        };

        // Prevent swipe/carousel from stealing the touch
        wrap.addEventListener('touchstart', stopSwipeConflict, { passive: true });
        wrap.addEventListener('pointerdown', stopSwipeConflict, true);
        wrap.addEventListener('mousedown', stopSwipeConflict, true);

        // Forward taps from the whole wrapper area to the real button
        wrap.addEventListener('touchend', forwardTapToButton, { passive: false });
        wrap.addEventListener('pointerup', forwardTapToButton, true);

        // Optional: extra safety so the carousel itself does not win the interaction
        if (carousel && carousel.dataset.mobileAcademyShield !== 'true') {
            carousel.dataset.mobileAcademyShield = 'true';

            carousel.addEventListener('touchend', (event) => {
                if (!isMobileView()) return;

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
        bootMobileAcademyButtonFix();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDashboardMobileFix);
    } else {
        initDashboardMobileFix();
    }

    window.addEventListener('resize', () => {
        bootMobileAcademyButtonFix();
    });
})();