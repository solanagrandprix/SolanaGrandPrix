(function () {
  const USERBOX_ID = 'sgp-user';

  function $(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem('sgp_token');
  }

  function getLocalUsername() {
    return localStorage.getItem('sgp_user');
  }

  function clearAuth() {
    localStorage.removeItem('sgp_token');
    localStorage.removeItem('sgp_user');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildLoggedOutUI() {
    const el = $(USERBOX_ID);
    if (!el) return;
    el.innerHTML = `<a class="sgp-userlink" href="/auth">Log in</a>`;
  }

  function buildLoggedInUI(displayName, driverKey) {
    const el = $(USERBOX_ID);
    if (!el) return;

    const safeName = escapeHtml(displayName || 'Account');
    const safeDriverKey = driverKey ? encodeURIComponent(driverKey.toLowerCase()) : '';
    
    // Only show "My Driver Profile" link if driverKey exists
    const driverProfileLink = safeDriverKey 
      ? `<a class="sgp-usermenu-item" href="/driver/${safeDriverKey}"
            style="display:block;padding:10px 10px;border-radius:10px;color:#e5e7eb;text-decoration:none;"
            role="menuitem"
          >My Driver Profile</a>`
      : '';

    el.innerHTML = `
      <div class="sgp-userdropdown" style="position:relative;">
        <button
          type="button"
          id="sgp-userbtn"
          class="sgp-userbtn"
          style="background:transparent;border:none;color:inherit;cursor:pointer;font:inherit;display:flex;align-items:center;gap:6px;"
          aria-haspopup="true"
          aria-expanded="false"
        >
          <span id="sgp-username">${safeName}</span>
          <span aria-hidden="true" style="opacity:.8">▼</span>
        </button>

        <div
          id="sgp-usermenu"
          class="sgp-usermenu"
          style="
            display:none;
            position:absolute;
            right:0;
            top:calc(100% + 8px);
            min-width:200px;
            background:rgba(2,6,23,.98);
            border:1px solid #111827;
            border-radius:12px;
            box-shadow:0 18px 40px rgba(0,0,0,.55);
            padding:8px;
            z-index:9999;
          "
          role="menu"
        >
          ${driverProfileLink}

          <a class="sgp-usermenu-item" href="/account"
            style="display:block;padding:10px 10px;border-radius:10px;color:#e5e7eb;text-decoration:none;"
            role="menuitem"
          >Account Settings</a>

          <a class="sgp-usermenu-item" href="/connections"
            style="display:block;padding:10px 10px;border-radius:10px;color:#e5e7eb;text-decoration:none;"
            role="menuitem"
          >Connections</a>

          <button
            type="button"
            id="sgp-logout"
            style="
              width:100%;
              text-align:left;
              padding:10px 10px;
              border-radius:10px;
              border:none;
              background:transparent;
              color:#fca5a5;
              cursor:pointer;
              font:inherit;
            "
            role="menuitem"
          >Log out</button>
        </div>
      </div>
    `;

    const btn = document.getElementById('sgp-userbtn');
    const menu = document.getElementById('sgp-usermenu');
    const logoutBtn = document.getElementById('sgp-logout');

    function closeMenu() {
      if (!menu || !btn) return;
      menu.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
      if (!menu || !btn) return;
      menu.style.display = 'block';
      btn.setAttribute('aria-expanded', 'true');
    }

    function toggleMenu() {
      if (!menu || !btn) return;
      const isOpen = menu.style.display === 'block';
      if (isOpen) closeMenu();
      else openMenu();
    }

    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleMenu();
      });
    }

    // Close on outside click / escape
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        clearAuth();
        window.location.href = '/';
      });
    }
  }

  async function fetchMe(token) {
    const res = await fetch('/api/me', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function fetchStats(driverKey) {
    const res = await fetch('/api/stats?driver=' + encodeURIComponent(driverKey), {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function refreshHeaderUser() {
    const token = getToken();

    if (!token) {
      buildLoggedOutUI();
      return;
    }

    try {
      const meData = await fetchMe(token);

      // token invalid / expired
      if (!meData || !meData.user) {
        localStorage.removeItem('sgp_token');
        buildLoggedOutUI();
        return;
      }

      const me = meData.user;
      const driverKey = (me.driverKey || me.username || '').toLowerCase();

      const stats = driverKey ? await fetchStats(driverKey) : null;

      // Prefer driver profile name -> fallback account username -> fallback cached
      const displayName =
        (stats && stats.name) ||
        me.username ||
        getLocalUsername() ||
        'Account';

      localStorage.setItem('sgp_user', displayName);

      buildLoggedInUI(displayName, driverKey);
    } catch (err) {
      console.error(err);
      const fallback = getLocalUsername() || 'Account';
      buildLoggedInUI(fallback, (fallback || 'account').toLowerCase());
    }
  }

  // Initial render on every page load (only if the userbox exists)
  if ($(USERBOX_ID)) {
    refreshHeaderUser();
  }

  // Update everywhere immediately after profile save
  window.addEventListener('sgp:driver-updated', function () {
    refreshHeaderUser();
  });

  // Sync across tabs
  window.addEventListener('storage', function (e) {
    if (e.key === 'sgp_token' || e.key === 'sgp_user') {
      refreshHeaderUser();
    }
  });
})();
