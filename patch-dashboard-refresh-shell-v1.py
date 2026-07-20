from __future__ import annotations

from datetime import datetime
from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()
TARGETS = {
    "dashboard_html": ROOT / "public" / "dashboard.html",
    "dashboard_js": ROOT / "public" / "js" / "dashboard.js",
    "style_css": ROOT / "public" / "css" / "style.css",
}


def fail(message: str) -> None:
    raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


def regex_replace_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    matches = list(re.finditer(pattern, text, flags))
    if len(matches) != 1:
        fail(f"{label}: expected exactly 1 match, found {len(matches)}")
    return re.sub(pattern, replacement, text, count=1, flags=flags)


for key, path in TARGETS.items():
    if not path.exists():
        fail(f"Missing target file: {path}")

texts = {key: path.read_text(encoding="utf-8") for key, path in TARGETS.items()}

# ------------------------------------------------------------
# 1. dashboard.html — only show the full bootstrap loader after
#    an actual login transition. Normal refresh must keep the
#    complete Dashboard shell visible from first paint.
# ------------------------------------------------------------

bootstrap_pattern = r'''<script>\s*\(function \(\) \{\s*try \{\s*document\.body\.classList\.add\('yh-dashboard-bootstrapping'\);.*?window\.setTimeout\(function \(\) \{\s*if \(document\.body\.classList\.contains\('yh-dashboard-bootstrapping'\)\) \{\s*window\.__yhDashboardReleaseBootstrapLoader\('failsafe'\);\s*\}\s*\}, 9000\);\s*\} catch \(_\) \{\}\s*\}\)\(\);\s*</script>'''

bootstrap_replacement = '''<script>
  /* PATCH: Dashboard stable first paint and conditional bootstrap v1 */
  (function () {
    try {
      var bootstrapKey = 'yh_post_login_dashboard_bootstrap_v1';
      var shouldShowBootstrap = false;

      try {
        shouldShowBootstrap =
          sessionStorage.getItem(bootstrapKey) === '1';
      } catch (_) {}

      var body = document.body;
      var loader = document.getElementById(
        'yh-dashboard-bootstrap-loader'
      );

      window.__yhDashboardBootstrapStartedAt = Date.now();

      window.__yhDashboardReleaseBootstrapLoader =
        function yhDashboardReleaseBootstrapLoader(reason) {
          try {
            body.classList.remove(
              'yh-dashboard-bootstrapping'
            );

            body.setAttribute(
              'data-yh-dashboard-bootstrap-sync',
              'ready'
            );

            body.setAttribute(
              'data-yh-dashboard-bootstrap-ready-reason',
              String(reason || 'ready')
            );

            body.setAttribute(
              'data-yh-dashboard-shell-first-paint',
              'ready'
            );

            if (loader) {
              loader.classList.add('hidden-step');
              loader.setAttribute('aria-hidden', 'true');
            }

            try {
              sessionStorage.removeItem(bootstrapKey);
            } catch (_) {}
          } catch (_) {}
        };

      if (shouldShowBootstrap) {
        body.classList.add(
          'yh-dashboard-bootstrapping'
        );

        body.setAttribute(
          'data-yh-dashboard-bootstrap-sync',
          'loading'
        );

        if (loader) {
          loader.classList.remove('hidden-step');
          loader.setAttribute('aria-hidden', 'false');
        }

        window.setTimeout(function () {
          if (
            body.classList.contains(
              'yh-dashboard-bootstrapping'
            )
          ) {
            window.__yhDashboardReleaseBootstrapLoader(
              'failsafe'
            );
          }
        }, 3500);
      } else {
        window.__yhDashboardReleaseBootstrapLoader(
          'normal-refresh'
        );
      }
    } catch (_) {}
  })();
  /* END PATCH: Dashboard stable first paint and conditional bootstrap v1 */
</script>'''

texts["dashboard_html"] = regex_replace_once(
    texts["dashboard_html"],
    bootstrap_pattern,
    bootstrap_replacement,
    "Dashboard conditional bootstrap script",
    flags=re.S,
)

# Restore the last child-workspace loader before the large
# dashboard.js bundle executes. This prevents a blank content
# surface while the saved iframe workspace is being rebuilt.
first_paint_anchor = '<script src="/js/yh-shared-core.js?v=20260627-yh-live-cache-v4"></script>'

first_paint_bridge = '''<script>
  /* PATCH: Dashboard persisted child workspace first paint v1 */
  (function () {
    try {
      var raw = localStorage.getItem(
        'yh_dashboard_persistent_ui_state_v1'
      );

      var state = raw ? JSON.parse(raw) : {};
      var workspaceKey = String(
        state.workspaceKey ||
        state.workspace ||
        ''
      ).trim().toLowerCase();

      var match = workspaceKey.match(
        /^(academy|plazas|federation)-/
      );

      if (!match) return;

      var division = match[1];
      var shell = document.getElementById(
        'yh-universe-workspace-frame-shell'
      );

      var loader = document.getElementById(
        'yh-universe-child-workspace-loader'
      );

      var title = document.getElementById(
        'yh-universe-child-workspace-loader-title'
      );

      var copy = document.getElementById(
        'yh-universe-child-workspace-loader-copy'
      );

      var frame = document.getElementById(
        'yh-universe-workspace-inline-frame'
      );

      document.body.setAttribute(
        'data-yh-view',
        'hub'
      );

      document.body.setAttribute(
        'data-yh-unified-workspace',
        workspaceKey
      );

      document.body.setAttribute(
        'data-yh-unified-division',
        division
      );

      document.body.setAttribute(
        'data-yh-dashboard-restoring-workspace',
        workspaceKey
      );

      if (shell) {
        shell.classList.remove('hidden-step');
        shell.classList.add(
          'is-switching',
          'has-child-workspace-loader'
        );
        shell.setAttribute('aria-hidden', 'false');
      }

      if (loader) {
        loader.classList.remove('hidden-step');
        loader.classList.add('is-active');
        loader.setAttribute('aria-hidden', 'false');
      }

      if (title) {
        title.textContent =
          'Restoring ' +
          workspaceKey
            .replace(/^(academy|plazas|federation)-/, '')
            .replace(/-/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map(function (word) {
              return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
      }

      if (copy) {
        copy.textContent =
          'Loading your saved workspace inside the Dashboard.';
      }

      if (frame) {
        frame.style.visibility = 'hidden';
        frame.style.opacity = '0';
        frame.style.pointerEvents = 'none';
        frame.setAttribute('aria-hidden', 'true');
      }
    } catch (_) {}
  })();
  /* END PATCH: Dashboard persisted child workspace first paint v1 */
</script>

''' + first_paint_anchor

texts["dashboard_html"] = replace_once(
    texts["dashboard_html"],
    first_paint_anchor,
    first_paint_bridge,
    "Insert persisted child workspace first paint bridge",
)

# ------------------------------------------------------------
# 2. dashboard.js — keep shell chrome alive and synchronize the
#    two bootstrap implementations without clearing workspace UI.
# ------------------------------------------------------------

bootstrap_anchor = """const YH_POST_LOGIN_DASHBOARD_BOOTSTRAP_KEY = 'yh_post_login_dashboard_bootstrap_v1';\nlet yhDashboardBootstrapFailSafeTimer = null;\n"""

stable_shell_helper = """const YH_POST_LOGIN_DASHBOARD_BOOTSTRAP_KEY = 'yh_post_login_dashboard_bootstrap_v1';
let yhDashboardBootstrapFailSafeTimer = null;

/* PATCH: Dashboard stable shell first paint v1 */
function ensureDashboardStableShellFirstPaintV1(
    reason = 'sync'
) {
    const body = document.body;

    if (
        !body ||
        body.getAttribute('data-yh-page') !==
            'dashboard'
    ) {
        return false;
    }

    /*
     * /dashboard is always the Hub shell. Child Academy,
     * Plazas, and Federation pages render inside the frame.
     */
    body.setAttribute(
        'data-yh-view',
        'hub'
    );

    body.setAttribute(
        'data-yh-dashboard-shell-first-paint',
        'ready'
    );

    body.setAttribute(
        'data-yh-dashboard-shell-first-paint-reason',
        String(reason || 'sync')
    );

    const layout =
        document.querySelector(
            '.dashboard-layout'
        );

    if (layout instanceof HTMLElement) {
        layout.style.removeProperty(
            'opacity'
        );

        layout.style.removeProperty(
            'visibility'
        );

        layout.style.removeProperty(
            'pointer-events'
        );
    }

    const topStrip =
        document.querySelector(
            '.desktop-user-strip'
        );

    if (
        topStrip instanceof HTMLElement &&
        window.matchMedia(
            '(min-width: 769px)'
        ).matches
    ) {
        topStrip.classList.remove(
            'hidden-step'
        );

        topStrip.setAttribute(
            'aria-hidden',
            'false'
        );

        topStrip.style.removeProperty(
            'display'
        );

        topStrip.style.removeProperty(
            'visibility'
        );

        topStrip.style.removeProperty(
            'opacity'
        );

        topStrip.style.removeProperty(
            'pointer-events'
        );
    }

    return true;
}

window.YHEnsureDashboardStableShellFirstPaintV1 =
    ensureDashboardStableShellFirstPaintV1;

ensureDashboardStableShellFirstPaintV1(
    'dashboard-script-eval'
);
/* END PATCH: Dashboard stable shell first paint v1 */
"""

texts["dashboard_js"] = replace_once(
    texts["dashboard_js"],
    bootstrap_anchor,
    stable_shell_helper,
    "Insert Dashboard stable shell helper",
)

old_show = """function showDashboardBootstrapLoader(label = 'Checking your access...') {
    const loader = document.getElementById('yh-dashboard-bootstrap-loader');
    const text = document.getElementById('yh-dashboard-bootstrap-loader-text');

    if (text) {
        text.textContent = String(label || 'Checking your access...');
    }

    document.body?.classList.add('yh-dashboard-bootstrapping');

    if (!loader) return;

    loader.classList.remove('hidden-step');
    loader.setAttribute('aria-hidden', 'false');
}
"""

new_show = """function showDashboardBootstrapLoader(label = 'Checking your access...') {
    const loader = document.getElementById('yh-dashboard-bootstrap-loader');
    const text = document.getElementById('yh-dashboard-bootstrap-loader-text');

    ensureDashboardStableShellFirstPaintV1(
        'bootstrap-show'
    );

    if (text) {
        text.textContent = String(label || 'Checking your access...');
    }

    document.body?.classList.add('yh-dashboard-bootstrapping');
    document.body?.setAttribute(
        'data-yh-dashboard-bootstrap-sync',
        'loading'
    );

    if (!loader) return;

    loader.classList.remove('hidden-step');
    loader.setAttribute('aria-hidden', 'false');
}
"""

texts["dashboard_js"] = replace_once(
    texts["dashboard_js"],
    old_show,
    new_show,
    "Patch Dashboard bootstrap show",
)

old_hide = """function hideDashboardBootstrapLoader() {
    const loader = document.getElementById('yh-dashboard-bootstrap-loader');

    if (yhDashboardBootstrapFailSafeTimer) {
        clearTimeout(yhDashboardBootstrapFailSafeTimer);
        yhDashboardBootstrapFailSafeTimer = null;
    }

    try {
        sessionStorage.removeItem(YH_POST_LOGIN_DASHBOARD_BOOTSTRAP_KEY);
    } catch (_) {}

    document.body?.classList.remove('yh-dashboard-bootstrapping');

    if (!loader) return;

    loader.classList.add('hidden-step');
    loader.setAttribute('aria-hidden', 'true');
}
"""

new_hide = """function hideDashboardBootstrapLoader(
    reason = 'dashboard-ready'
) {
    const loader = document.getElementById('yh-dashboard-bootstrap-loader');

    if (yhDashboardBootstrapFailSafeTimer) {
        clearTimeout(yhDashboardBootstrapFailSafeTimer);
        yhDashboardBootstrapFailSafeTimer = null;
    }

    try {
        sessionStorage.removeItem(YH_POST_LOGIN_DASHBOARD_BOOTSTRAP_KEY);
    } catch (_) {}

    try {
        if (
            typeof window.__yhDashboardReleaseBootstrapLoader ===
                'function'
        ) {
            window.__yhDashboardReleaseBootstrapLoader(
                reason
            );
        }
    } catch (_) {}

    document.body?.classList.remove('yh-dashboard-bootstrapping');
    document.body?.setAttribute(
        'data-yh-dashboard-bootstrap-sync',
        'ready'
    );

    ensureDashboardStableShellFirstPaintV1(
        reason
    );

    if (!loader) return;

    loader.classList.add('hidden-step');
    loader.setAttribute('aria-hidden', 'true');
}
"""

texts["dashboard_js"] = replace_once(
    texts["dashboard_js"],
    old_hide,
    new_hide,
    "Patch Dashboard bootstrap hide",
)

texts["dashboard_js"] = replace_once(
    texts["dashboard_js"],
    "function scheduleDashboardBootstrapFailSafe(delayMs = 6500) {",
    "function scheduleDashboardBootstrapFailSafe(delayMs = 3500) {",
    "Shorten Dashboard bootstrap failsafe",
)

# Keep top chrome stable when the persisted child workspace is restored.
activation_anchor = """function activateDashboardUnifiedWorkspace(key = 'overview', options = {}) {
    const effectiveKey = getDashboardEffectiveUnifiedWorkspaceKey(key);
"""
activation_replacement = """function activateDashboardUnifiedWorkspace(key = 'overview', options = {}) {
    ensureDashboardStableShellFirstPaintV1(
        options?.restore === true
            ? 'workspace-restore'
            : 'workspace-activate'
    );

    const effectiveKey = getDashboardEffectiveUnifiedWorkspaceKey(key);
"""
texts["dashboard_js"] = replace_once(
    texts["dashboard_js"],
    activation_anchor,
    activation_replacement,
    "Keep Dashboard top chrome during workspace activation",
)

loader_cleanup_anchor = """    if (frameShell) {
        frameShell.classList.remove('is-switching', 'has-child-workspace-loader');
        frameShell.dataset.childLoaderReleased = reason;
    }

    scheduleDashboardMobileWorkspaceStableBootReleaseV1(reason, reason === 'hard-timeout' ? 0 : 90);
}"""

loader_cleanup_replacement = """    if (frameShell) {
        frameShell.classList.remove('is-switching', 'has-child-workspace-loader');
        frameShell.dataset.childLoaderReleased = reason;
    }

    document.body?.removeAttribute(
        'data-yh-dashboard-restoring-workspace'
    );

    scheduleDashboardMobileWorkspaceStableBootReleaseV1(reason, reason === 'hard-timeout' ? 0 : 90);
}"""

texts["dashboard_js"] = replace_once(
    texts["dashboard_js"],
    loader_cleanup_anchor,
    loader_cleanup_replacement,
    "Clear Dashboard restoring-workspace marker",
)

# Reassert shell visibility on bfcache restore or normal refresh.
listener_anchor = """function scheduleDashboardBootstrapFailSafe(delayMs = 3500) {
    if (yhDashboardBootstrapFailSafeTimer) {
        clearTimeout(yhDashboardBootstrapFailSafeTimer);
    }

    yhDashboardBootstrapFailSafeTimer = setTimeout(() => {
        hideDashboardBootstrapLoader();
    }, delayMs);
}

async function hydrateDashboardTopProfile(forceFresh = false) {
"""
listener_replacement = """function scheduleDashboardBootstrapFailSafe(delayMs = 3500) {
    if (yhDashboardBootstrapFailSafeTimer) {
        clearTimeout(yhDashboardBootstrapFailSafeTimer);
    }

    yhDashboardBootstrapFailSafeTimer = setTimeout(() => {
        hideDashboardBootstrapLoader(
            'dashboard-failsafe'
        );
    }, delayMs);
}

window.addEventListener(
    'pageshow',
    () => {
        ensureDashboardStableShellFirstPaintV1(
            'pageshow'
        );
    }
);

window.addEventListener(
    'resize',
    () => {
        ensureDashboardStableShellFirstPaintV1(
            'resize'
        );
    }
);

async function hydrateDashboardTopProfile(forceFresh = false) {
"""
texts["dashboard_js"] = replace_once(
    texts["dashboard_js"],
    listener_anchor,
    listener_replacement,
    "Add Dashboard stable shell listeners",
)

# ------------------------------------------------------------
# 3. style.css — stop hiding the complete Dashboard layout.
#    The login loader may cover it, but the shell remains intact.
# ------------------------------------------------------------

old_boot_css = '''body.yh-dashboard-bootstrapping .dashboard-layout {
  background-color: #020617;
  background: radial-gradient(circle at 14% 8%, rgba(103, 232, 249, 0.18), transparent 31%),
    radial-gradient(circle at 84% 0%, rgba(37, 99, 235, 0.20), transparent 34%),
    linear-gradient(180deg, rgba(2, 8, 23, 0.34), rgba(2, 6, 23, 0.74)),
    url("/images/yhu-premium-bg.png?v=20260531-bg-09") center top / cover no-repeat,
    linear-gradient(180deg, #020817 0%, #020617 56%, #030a18 100%);
    opacity: 0;
    pointer-events: none;
}
'''

new_boot_css = '''/* PATCH: Dashboard non-destructive bootstrap shell v1 */
body.yh-dashboard-bootstrapping .dashboard-layout {
  background-color: #020617;
  background: radial-gradient(circle at 14% 8%, rgba(103, 232, 249, 0.18), transparent 31%),
    radial-gradient(circle at 84% 0%, rgba(37, 99, 235, 0.20), transparent 34%),
    linear-gradient(180deg, rgba(2, 8, 23, 0.34), rgba(2, 6, 23, 0.74)),
    url("/images/yhu-premium-bg.png?v=20260531-bg-09") center top / cover no-repeat,
    linear-gradient(180deg, #020817 0%, #020617 56%, #030a18 100%);
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

@media (min-width: 769px) {
  body[data-yh-view="hub"][data-yh-page="dashboard"]
  .desktop-user-strip,
  body[data-yh-view="hub"][data-yh-page="dashboard"]
  .desktop-user-strip-inner,
  body[data-yh-view="hub"][data-yh-page="dashboard"]
  .desktop-user-strip-left,
  body[data-yh-view="hub"][data-yh-page="dashboard"]
  .desktop-user-strip-right {
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  body[data-yh-view="hub"][data-yh-page="dashboard"]
  .desktop-user-strip {
    display: flex !important;
  }
}
/* END PATCH: Dashboard non-destructive bootstrap shell v1 */
'''

texts["style_css"] = replace_once(
    texts["style_css"],
    old_boot_css,
    new_boot_css,
    "Patch non-destructive Dashboard bootstrap CSS",
)

# ------------------------------------------------------------
# 4. Cache bust modified assets.
# ------------------------------------------------------------

texts["dashboard_html"] = regex_replace_once(
    texts["dashboard_html"],
    r'(<link\s+rel="stylesheet"\s+href="/css/style\.css)\?v=[^"]+("\s*>)',
    r'\1?v=20260720-dashboard-stable-refresh-shell-v1\2',
    "Update style.css cache version",
)

texts["dashboard_html"] = regex_replace_once(
    texts["dashboard_html"],
    r'(<script\s+src="/js/dashboard\.js)\?v=[^"]+("\s*></script>)',
    r'\1?v=20260720-dashboard-stable-refresh-shell-v1\2',
    "Update dashboard.js cache version",
)

# ------------------------------------------------------------
# 5. Write timestamped backups and patched files.
# ------------------------------------------------------------

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backups: list[Path] = []

for key, path in TARGETS.items():
    backup = path.with_name(
        f"{path.name}.backup-dashboard-stable-refresh-shell-v1-{stamp}"
    )
    shutil.copy2(path, backup)
    backups.append(backup)
    path.write_text(texts[key], encoding="utf-8", newline="\n")

print("Dashboard stable refresh shell patched successfully.")
for path in TARGETS.values():
    print(f"Updated: {path.relative_to(ROOT)}")
for backup in backups:
    print(f"Backup: {backup.relative_to(ROOT)}")
