(() => {
  'use strict';

  // State
  let currentPage = 1;
  let currentLimit = 10;
  let totalUsers = 0;
  let activeRole = 'all';
  let searchQuery = '';
  let usersCache = [];

  // Color generator for avatars
  const AVATAR_COLORS = [
    'linear-gradient(135deg, #6366f1, #4338ca)',
    'linear-gradient(135deg, #0ea5e9, #0284c7)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #ec4899, #db2777)',
    'linear-gradient(135deg, #8b5cf6, #6d28d9)'
  ];

  function getAvatarColor(id) {
    return AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];
  }

  function getInitials(firstName, lastName) {
    return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || 'U';
  }

  // DOM Elements
  const tbody = document.getElementById('users-tbody');
  const loadingSpinner = document.getElementById('loading-spinner');
  const emptyState = document.getElementById('empty-state');
  const metricTotalUsers = document.getElementById('metric-total-users');
  const metricCacheStatus = document.getElementById('metric-cache-status');
  const metricLatency = document.getElementById('metric-latency');
  const metricFilteredCount = document.getElementById('metric-filtered-count');
  const metricActiveRole = document.getElementById('metric-active-role');
  const paginationInfo = document.getElementById('pagination-info');
  const pageIndicator = document.getElementById('page-indicator');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const limitSelect = document.getElementById('limit-select');
  const searchInput = document.getElementById('search-input');
  const refreshBtn = document.getElementById('refresh-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const userModal = document.getElementById('userModal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalDoneBtn = document.getElementById('modal-done-btn');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  const wsDot = document.getElementById('ws-dot');
  const wsText = document.getElementById('ws-text');
  const metricWsClients = document.getElementById('metric-ws-clients');
  const wsLastEvent = document.getElementById('ws-last-event');
  const wsTickerContent = document.getElementById('ws-ticker-content');
  const wsTickerTime = document.getElementById('ws-ticker-time');
  const wsTickerBar = document.getElementById('ws-ticker-bar');

  // Toast Helper
  function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // Fetch Users from API
  async function loadUsers() {
    tbody.innerHTML = '';
    emptyState.style.display = 'none';
    loadingSpinner.style.display = 'block';

    const startTime = performance.now();
    const skip = (currentPage - 1) * currentLimit;
    
    let url = '';
    if (activeRole !== 'all') {
      url = `/api/users/role/${encodeURIComponent(activeRole)}`;
    } else {
      url = `/api/users?limit=${currentLimit}&skip=${skip}`;
    }

    try {
      const res = await fetch(url);
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      // Check X-Cache header
      const cacheHeader = res.headers.get('X-Cache') || 'MISS';
      metricLatency.innerHTML = `<span>Response Latency: <strong>${latencyMs}ms</strong></span>`;

      if (cacheHeader === 'HIT') {
        metricCacheStatus.innerHTML = `<span class="badge badge-cache-hit">⚡ Redis HIT</span>`;
      } else {
        metricCacheStatus.innerHTML = `<span class="badge badge-cache-miss">🔍 DB Query (MISS)</span>`;
      }

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }

      const data = await res.json();
      let users = data.users || [];
      totalUsers = data.total || (activeRole !== 'all' ? data.count : users.length);

      usersCache = users;

      // Apply client-side search filtering if active
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        users = users.filter(u => 
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          (u.username && u.username.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
        );
      }

      renderUsers(users);
      updateMetricsAndPagination(users.length);

    } catch (err) {
      console.error('Error fetching users:', err);
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-rose); padding: 2rem;">Error loading users: ${err.message}</td></tr>`;
    } finally {
      loadingSpinner.style.display = 'none';
    }
  }

  // Render Users Table
  function renderUsers(users) {
    tbody.innerHTML = '';

    if (!users || users.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    users.forEach(user => {
      const tr = document.createElement('tr');
      const initials = getInitials(user.firstName, user.lastName);
      const avatarColor = getAvatarColor(user.id);
      const maidenText = user.maidenName ? ` (${user.maidenName})` : '';

      tr.innerHTML = `
        <td>
          <span style="font-family: var(--font-mono); font-weight: 600; color: var(--text-dim);">#${user.id}</span>
        </td>
        <td>
          <div class="user-cell">
            <div class="user-avatar" style="background: ${avatarColor};" aria-hidden="true">${initials}</div>
            <div>
              <div class="user-meta-name">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}${escapeHtml(maidenText)}</div>
              <div class="user-meta-username">@${escapeHtml(user.username || 'user')}</div>
            </div>
          </div>
        </td>
        <td>
          <div>${escapeHtml(user.email || '-')} 
            ${user.email ? `<button class="copy-btn" data-copy="${escapeHtml(user.email)}" title="Copy Email"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>` : ''}
          </div>
          <div style="font-size: 0.775rem; color: var(--text-dim); margin-top: 2px;">${escapeHtml(user.phone || '-')}</div>
        </td>
        <td class="hide-mobile">
          <span class="badge badge-gender">${escapeHtml(user.gender || 'unknown')}</span>
          <span style="font-size: 0.8125rem; color: var(--text-muted); margin-left: 4px;">${user.age ? `${user.age} yrs` : ''}</span>
        </td>
        <td class="hide-mobile">
          <span style="font-family: var(--font-mono); font-size: 0.8125rem; color: var(--text-muted);">${escapeHtml(user.birthDate || '-')}</span>
        </td>
        <td style="text-align: right;">
          <button class="action-btn view-user-btn" data-id="${user.id}">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  // Update Pagination and Metric Info
  function updateMetricsAndPagination(displayedCount) {
    metricTotalUsers.textContent = totalUsers || displayedCount;
    metricFilteredCount.textContent = displayedCount;
    metricActiveRole.textContent = `Filter: ${activeRole.toUpperCase()}`;

    if (activeRole !== 'all') {
      paginationInfo.textContent = `Showing all ${displayedCount} users for role: ${activeRole}`;
      prevPageBtn.disabled = true;
      nextPageBtn.disabled = true;
      pageIndicator.textContent = 'Page 1 of 1';
    } else {
      const start = totalUsers === 0 ? 0 : (currentPage - 1) * currentLimit + 1;
      const end = Math.min(currentPage * currentLimit, totalUsers);
      const maxPages = Math.ceil(totalUsers / currentLimit) || 1;

      paginationInfo.textContent = `Showing ${start} to ${end} of ${totalUsers} users`;
      pageIndicator.textContent = `Page ${currentPage} of ${maxPages}`;
      prevPageBtn.disabled = currentPage <= 1;
      nextPageBtn.disabled = currentPage >= maxPages;
    }
  }

  // View User Modal Handler
  async function openUserModal(id) {
    try {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new Error('Could not fetch user details');
      const user = await res.json();

      document.getElementById('modal-avatar').style.background = getAvatarColor(user.id);
      document.getElementById('modal-avatar').textContent = getInitials(user.firstName, user.lastName);
      document.getElementById('modal-user-name').textContent = `${user.firstName} ${user.lastName}`;
      document.getElementById('modal-username').textContent = `@${user.username || 'user'}`;
      document.getElementById('modal-id').textContent = `#${user.id}`;
      document.getElementById('modal-age-gender').textContent = `${user.gender || 'N/A'} • ${user.age || 'N/A'} years old`;
      document.getElementById('modal-email').textContent = user.email || 'N/A';
      document.getElementById('modal-phone').textContent = user.phone || 'N/A';
      document.getElementById('modal-birthdate').textContent = user.birthDate || 'N/A';
      document.getElementById('modal-maiden').textContent = user.maidenName || 'None';
      document.getElementById('modal-raw-json').textContent = JSON.stringify(user, null, 2);

      userModal.showModal();
    } catch (err) {
      showToast(err.message);
    }
  }

  // Light Dismiss for Dialog
  userModal.addEventListener('click', (e) => {
    if (e.target === userModal) userModal.close();
  });

  closeModalBtn.addEventListener('click', () => userModal.close());
  modalDoneBtn.addEventListener('click', () => userModal.close());

  // Event Delegation for Table Clicks (View & Copy)
  tbody.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.view-user-btn');
    if (viewBtn) {
      openUserModal(viewBtn.dataset.id);
      return;
    }

    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      navigator.clipboard.writeText(copyBtn.dataset.copy).then(() => {
        showToast(`Copied: ${copyBtn.dataset.copy}`);
      });
    }
  });

  // Search Filter Input Debounce
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = e.target.value;
      currentPage = 1;
      loadUsers();
    }, 250);
  });

  // Role Filter Buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeRole = btn.dataset.role;
      currentPage = 1;
      loadUsers();
    });
  });

  // Page Limit Selector
  limitSelect.addEventListener('change', (e) => {
    currentLimit = parseInt(e.target.value, 10);
    currentPage = 1;
    loadUsers();
  });

  // Pagination Controls
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadUsers();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const maxPages = Math.ceil(totalUsers / currentLimit);
    if (currentPage < maxPages) {
      currentPage++;
      loadUsers();
    }
  });

  // Refresh Button
  refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    loadUsers();
    setTimeout(() => refreshBtn.style.transform = 'none', 600);
    showToast('Refreshed user directory');
  });

  // Theme Toggle (Light / Dark)
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });

  // Restore stored theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // WebSocket Connection Handling
  let ws = null;
  let wsReconnectTimeout = null;

  function updateWsStatus(connected, clientsCount) {
    if (!wsDot || !wsText) return;
    if (connected) {
      wsDot.style.backgroundColor = 'var(--color-emerald)';
      wsDot.style.boxShadow = '0 0 8px var(--color-emerald)';
      const count = clientsCount !== undefined ? clientsCount : 1;
      wsText.textContent = `WS: ${count} Client${count === 1 ? '' : 's'}`;
      if (metricWsClients) {
        metricWsClients.textContent = `${count} Active`;
      }
    } else {
      wsDot.style.backgroundColor = 'var(--color-rose)';
      wsDot.style.boxShadow = '0 0 8px var(--color-rose)';
      wsText.textContent = 'WS: Disconnected';
      if (metricWsClients) {
        metricWsClients.textContent = 'Disconnected';
      }
      if (wsLastEvent) {
        wsLastEvent.textContent = 'Reconnecting in 3s...';
      }
    }
  }

  function formatTime(isoString) {
    const d = isoString ? new Date(isoString) : new Date();
    return d.toLocaleTimeString();
  }

  function triggerTickerFlash(text, timestamp) {
    if (wsTickerContent) {
      wsTickerContent.textContent = text;
    }
    if (wsTickerTime) {
      wsTickerTime.textContent = formatTime(timestamp);
    }
    if (wsLastEvent) {
      wsLastEvent.textContent = text;
    }
    if (wsTickerBar) {
      wsTickerBar.classList.remove('ticker-flash');
      void wsTickerBar.offsetWidth; // trigger reflow
      wsTickerBar.classList.add('ticker-flash');
    }
  }

  function setupWebSocket() {
    if (wsReconnectTimeout) {
      clearTimeout(wsReconnectTimeout);
      wsReconnectTimeout = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        updateWsStatus(true);
        triggerTickerFlash('⚡ WebSocket connection established to /ws');
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          switch (payload.type) {
            case 'INIT':
              updateWsStatus(true, payload.clientsCount);
              triggerTickerFlash(`⚡ Connected to live server (${payload.clientsCount} connected)`, payload.timestamp);
              break;

            case 'CLIENTS_COUNT':
              updateWsStatus(true, payload.count);
              triggerTickerFlash(`👥 Active connected clients updated: ${payload.count}`, payload.timestamp);
              break;

            case 'CACHE_EVENT':
              const hitOrMiss = payload.status === 'HIT' ? '⚡ Redis HIT' : '🔍 DB Query (MISS)';
              const eventDesc = `${hitOrMiss} on ${payload.endpoint} ${payload.count !== undefined ? `(${payload.count} records)` : ''}`;
              triggerTickerFlash(eventDesc, payload.timestamp);
              break;

            case 'PONG':
              console.log('WebSocket PONG received at', payload.timestamp);
              break;

            default:
              if (payload.message) {
                triggerTickerFlash(payload.message, payload.timestamp);
              }
              break;
          }
        } catch (err) {
          console.warn('WS message parse error:', err);
        }
      };

      ws.onclose = () => {
        updateWsStatus(false);
        wsReconnectTimeout = setTimeout(setupWebSocket, 3000);
      };

      ws.onerror = () => {
        updateWsStatus(false);
        ws.close();
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      wsReconnectTimeout = setTimeout(setupWebSocket, 3000);
    }
  }

  // Initial Load
  loadUsers();
  setupWebSocket();
})();
