// public/js/academy-thread-bottom-fix.js
// Hard-fix: force the composer to the bottom in mobile thread mode (inline styles win).

(function () {
  function shouldApply() {
    return (
      document.body?.getAttribute('data-yh-view') === 'academy' &&
      document.body?.classList.contains('academy-messages-thread-open') &&
      window.innerWidth <= 768
    );
  }

  function apply() {
    if (!shouldApply()) return;

    const academyChat = document.getElementById('academy-chat');
    const chatMessages = document.querySelector('#academy-chat > .chat-messages');
    const shell =
      document.getElementById('academy-messages-thread-shell') ||
      document.querySelector('.academy-messages-thread-shell');

    const history = document.getElementById('dynamic-chat-history');
    const composer = document.getElementById('chat-input-area');
    const wrapper = composer?.querySelector('.chat-input-wrapper');

    if (academyChat) {
      academyChat.style.display = 'flex';
      academyChat.style.flexDirection = 'column';
      academyChat.style.height = '100dvh';
      academyChat.style.overflow = 'hidden';
    }

    if (chatMessages) {
      chatMessages.style.display = 'flex';
      chatMessages.style.flexDirection = 'column';
      chatMessages.style.flex = '1 1 auto';
      chatMessages.style.minHeight = '0';
      chatMessages.style.overflow = 'hidden';
      chatMessages.style.padding = '0';
    }

    if (shell) {
      shell.style.display = 'flex';
      shell.style.flexDirection = 'column';
      shell.style.flex = '1 1 auto';
      shell.style.minHeight = '0';
      shell.style.height = '100%';
      shell.style.overflow = 'hidden';
    }

    if (history) {
      history.style.flex = '1 1 auto';
      history.style.minHeight = '0';
      history.style.overflowY = 'auto';
      history.style.overflowX = 'hidden';
    }

    if (composer) {
      composer.style.position = 'relative';
      composer.style.flex = '0 0 auto';
      composer.style.marginTop = 'auto';
      composer.style.marginBottom = '0';
      composer.style.padding = '0';
    }

    if (wrapper) {
      // keep a small bottom inset; no extra "ghost space"
      wrapper.style.margin = '8px 10px 0 10px';
    }
  }

  // Apply on load + resize
  window.addEventListener('load', apply);
  window.addEventListener('resize', () => {
    // quick re-apply
    apply();
  });

  // Watch for thread-open class toggles
  const obs = new MutationObserver(() => apply());
  obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();