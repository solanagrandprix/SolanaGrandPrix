# Adding iRacing Dropdown to Navigation

The iRacing dropdown has been added to `home.html`. To add it to other pages, insert this HTML code into the `<nav class="sgp-nav">` section, right before the closing `</nav>` tag:

```html
<div class="sgp-nav-dropdown">
  <button class="sgp-nav-dropdown-btn" aria-haspopup="true" aria-expanded="false">
    iRacing
    <span class="iracing-status-indicator" style="font-size: 10px; margin-left: 4px;" title="Connection status">○</span>
    <span style="opacity: 0.8; font-size: 10px;">▼</span>
  </button>
  <div class="sgp-nav-dropdown-menu" role="menu">
    <a href="/iracing-connect" class="sgp-nav-dropdown-item" data-action="connect" role="menuitem">
      <span class="sgp-nav-dropdown-item-icon">🔗</span>
      Connect Account
    </a>
    <a href="/iracing-connect" class="sgp-nav-dropdown-item" data-action="sync" role="menuitem">
      <span class="sgp-nav-dropdown-item-icon">🔄</span>
      Sync Sessions
    </a>
    <a href="/iracing-connect" class="sgp-nav-dropdown-item" data-action="sessions" role="menuitem">
      <span class="sgp-nav-dropdown-item-icon">📊</span>
      View Sessions
    </a>
    <div class="sgp-nav-dropdown-item separator"></div>
    <a href="/connections" class="sgp-nav-dropdown-item" role="menuitem">
      <span class="sgp-nav-dropdown-item-icon">⚙️</span>
      Connection Settings
    </a>
  </div>
</div>
```

And add this script include before `</body>` or after the `global-user.js` script:

```html
<script src="/iracing-nav.js"></script>
```

Files that need updating:
- public/index.html
- public/driver.html
- public/season.html
- public/leaderboard.html
- public/card-builder.html
- public/connections.html (if it has nav)
- public/admin.html (if it has nav)
