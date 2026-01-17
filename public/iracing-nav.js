/**
 * iRacing Navigation Dropdown
 * Handles the iRacing dropdown menu in the navigation bar
 */

(function() {
  'use strict';

  // Initialize iRacing dropdown when DOM is ready
  function initIracingDropdown() {
    const dropdowns = document.querySelectorAll('.sgp-nav-dropdown');
    
    dropdowns.forEach(dropdown => {
      const btn = dropdown.querySelector('.sgp-nav-dropdown-btn');
      const menu = dropdown.querySelector('.sgp-nav-dropdown-menu');
      
      if (!btn || !menu) return;

      function closeMenu() {
        menu.classList.remove('show');
        btn.setAttribute('aria-expanded', 'false');
      }

      function openMenu() {
        menu.classList.add('show');
        btn.setAttribute('aria-expanded', 'true');
      }

      function toggleMenu(e) {
        e.stopPropagation();
        const isOpen = menu.classList.contains('show');
        if (isOpen) {
          closeMenu();
        } else {
          // Close other dropdowns
          document.querySelectorAll('.sgp-nav-dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
          });
          openMenu();
        }
      }

      btn.addEventListener('click', toggleMenu);

      // Close on outside click
      document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target)) {
          closeMenu();
        }
      });

      // Close on escape key
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          closeMenu();
        }
      });

      // Update connection status indicator
      updateConnectionStatus(dropdown);
    });
  }

  // Update connection status indicator in dropdown
  async function updateConnectionStatus(dropdown) {
    const token = localStorage.getItem('sgp_token') || sessionStorage.getItem('token');
    
    if (!token) {
      // User not logged in - disable some items
      const connectItem = dropdown.querySelector('[data-action="connect"]');
      const syncItem = dropdown.querySelector('[data-action="sync"]');
      const sessionsItem = dropdown.querySelector('[data-action="sessions"]');
      
      if (connectItem) connectItem.classList.add('disabled');
      if (syncItem) syncItem.classList.add('disabled');
      if (sessionsItem) sessionsItem.classList.add('disabled');
      return;
    }

    try {
      const response = await fetch('/api/iracing/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const statusIndicator = dropdown.querySelector('.iracing-status-indicator');
        
        if (statusIndicator) {
          if (data.connected) {
            statusIndicator.textContent = '●';
            statusIndicator.style.color = data.isExpired ? '#f59e0b' : '#22c55e';
            statusIndicator.title = data.isExpired 
              ? 'Connected (Expired - Reconnect needed)'
              : 'Connected';
          } else {
            statusIndicator.textContent = '○';
            statusIndicator.style.color = '#9ca3af';
            statusIndicator.title = 'Not Connected';
          }
        }

        // Enable/disable sync button based on connection status
        const syncItem = dropdown.querySelector('[data-action="sync"]');
        if (syncItem) {
          if (data.connected && !data.isExpired) {
            syncItem.classList.remove('disabled');
          } else {
            syncItem.classList.add('disabled');
          }
        }

        // Enable/disable sessions button
        const sessionsItem = dropdown.querySelector('[data-action="sessions"]');
        if (sessionsItem) {
          if (data.connected) {
            sessionsItem.classList.remove('disabled');
          } else {
            sessionsItem.classList.add('disabled');
          }
        }
      }
    } catch (error) {
      console.error('Failed to check iRacing connection status:', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIracingDropdown);
  } else {
    initIracingDropdown();
  }

  // Re-check connection status periodically (every 5 minutes)
  setInterval(() => {
    document.querySelectorAll('.sgp-nav-dropdown').forEach(updateConnectionStatus);
  }, 5 * 60 * 1000);
})();
