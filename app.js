/* ========================================
   App Logic — Filtering, Search, Rendering
   ======================================== */

(function() {
  'use strict';

  // State
  let currentCategory = 'all';
  let currentLocation = 'all';
  let currentAction = 'all';
  let searchQuery = '';

  // DOM Elements
  const cardsGrid = document.getElementById('cards-grid');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const resultCount = document.getElementById('result-count');
  const statsBar = document.getElementById('stats-bar');
  const lastUpdated = document.getElementById('last-updated');

  // Initialize
  function init() {
    renderStats();
    renderCards();
    setupEventListeners();
    if (lastUpdated && META) {
      lastUpdated.textContent = META.last_updated;
    }
  }

  // Render Stats
  function renderStats() {
    if (!META || !SPANISH_JOBS_DATA) return;

    const data = SPANISH_JOBS_DATA;
    const agencies = data.filter(d => d.category === 'recruitment_agency').length;
    const boards = data.filter(d => d.category === 'job_board').length;
    const companies = data.filter(d => d.category === 'company').length;
    const vaPlatforms = data.filter(d => d.category === 'va_platform').length;
    const withRoles = data.filter(d => d.specific_role).length;

    statsBar.innerHTML = `
      <div class="stat-item">
        <span class="stat-number">${data.length}</span>
        <span class="stat-label">Organisations</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${withRoles}</span>
        <span class="stat-label">With Active Roles</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${agencies}</span>
        <span class="stat-label">Agencies</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${boards}</span>
        <span class="stat-label">Job Boards</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${companies}</span>
        <span class="stat-label">Companies</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">${vaPlatforms}</span>
        <span class="stat-label">VA Platforms</span>
      </div>
    `;
  }

  // Filter Data
  function getFilteredData() {
    if (!SPANISH_JOBS_DATA) return [];

    return SPANISH_JOBS_DATA.filter(item => {
      // Category filter
      if (currentCategory !== 'all' && item.category !== currentCategory) return false;

      // Location filter
      if (currentLocation !== 'all') {
        if (currentLocation === 'remote' && item.location_type !== 'remote') return false;
        if (currentLocation === 'hybrid' && item.location_type !== 'hybrid') return false;
        if (currentLocation === 'office' && item.location_type !== 'office') return false;
      }

      // Action filter
      if (currentAction !== 'all' && item.recommended_action !== currentAction) return false;

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [
          item.organisation,
          item.specific_role,
          item.evidence,
          item.location,
          ...(item.industries || [])
        ].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      return true;
    });
  }

  // Render Cards
  function renderCards() {
    const filtered = getFilteredData();

    if (filtered.length === 0) {
      cardsGrid.innerHTML = '';
      emptyState.style.display = 'block';
      resultCount.textContent = '0 results';
      return;
    }

    emptyState.style.display = 'none';
    resultCount.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;

    // Unverified listings (couldn't be checked - bot-blocked/JS-rendered) sink to the bottom.
    // Within each group, sort by opportunity_score descending, then by whether they have a specific role.
    filtered.sort((a, b) => {
      const aUnverified = a.verification_status === 'unverified' ? 1 : 0;
      const bUnverified = b.verification_status === 'unverified' ? 1 : 0;
      if (aUnverified !== bUnverified) return aUnverified - bUnverified;
      if (b.opportunity_score !== a.opportunity_score) {
        return b.opportunity_score - a.opportunity_score;
      }
      return (b.specific_role ? 1 : 0) - (a.specific_role ? 1 : 0);
    });

    cardsGrid.innerHTML = filtered.map(item => renderCard(item)).join('');
  }

  // Render Single Card
  function renderCard(item) {
    const badgeClass = getBadgeClass(item.category);
    const badgeLabel = getBadgeLabel(item.category);
    const scoreDots = renderScoreDots(item.opportunity_score);
    const actionBtn = getActionButton(item);
    const locationIcon = getLocationIcon(item.location_type);

    return `
      <article class="card" data-id="${item.id}">
        <div class="card-header">
          <span class="card-badge ${badgeClass}">${badgeLabel}</span>
          <div class="card-score" title="Opportunity Score: ${item.opportunity_score}/10">
            ${scoreDots}
          </div>
        </div>
        <h3 class="card-title">${escapeHtml(item.organisation)}</h3>
        <div class="card-org">${escapeHtml(item.location)}</div>
        ${item.specific_role ? `
          <div class="card-role">
            <div class="card-role-title">${escapeHtml(item.specific_role)}</div>
            ${item.salary ? `<div class="card-role-salary">${escapeHtml(item.salary)}</div>` : ''}
          </div>
        ` : ''}
        <div class="card-meta">
          <span class="meta-tag">
            ${locationIcon}
            ${getLocationLabel(item.location_type)}
          </span>
          ${item.entry_level_friendly ? `
            <span class="meta-tag">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Entry-Level
            </span>
          ` : ''}
          ${item.verification_status === 'unverified' ? `
            <span class="meta-tag meta-tag-unverified" title="We could not confirm this listing is still live (site blocked automated checks) — check manually before applying">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Unverified
            </span>
          ` : ''}
        </div>
        <p class="card-evidence">${escapeHtml(item.evidence)}</p>
        <div class="card-industries">
          ${(item.industries || []).slice(0, 4).map(i => `<span class="industry-tag">${escapeHtml(i)}</span>`).join('')}
        </div>
        <div class="card-footer">
          ${actionBtn}
          ${item.website ? `<a href="${escapeHtml(item.website)}" target="_blank" rel="noopener" class="btn-ghost">Website</a>` : ''}
        </div>
      </article>
    `;
  }

  // Helpers
  function getBadgeClass(category) {
    const map = {
      recruitment_agency: 'badge-agency',
      job_board: 'badge-board',
      company: 'badge-company',
      va_platform: 'badge-va'
    };
    return map[category] || 'badge-company';
  }

  function getBadgeLabel(category) {
    const map = {
      recruitment_agency: 'Agency',
      job_board: 'Job Board',
      company: 'Company',
      va_platform: 'VA Platform'
    };
    return map[category] || category;
  }

  function renderScoreDots(score) {
    const maxDots = 5;
    const filledCount = Math.round(score / 2);
    let html = '';
    for (let i = 0; i < maxDots; i++) {
      html += `<span class="score-dot${i < filledCount ? ' filled' : ''}"></span>`;
    }
    return html;
  }

  function getActionButton(item) {
    const url = item.role_url || item.website;
    if (!url) return '';

    const labels = {
      apply_now: 'Apply Now',
      register_cv: 'Register CV',
      monitor: 'Monitor',
      check_board: 'Check Board'
    };

    const label = labels[item.recommended_action] || 'View';
    const isPrimary = item.recommended_action === 'apply_now' || item.recommended_action === 'check_board';

    if (isPrimary) {
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn-primary">${label}</a>`;
    }
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="btn-secondary">${label}</a>`;
  }

  function getLocationIcon(type) {
    if (type === 'remote') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4"/></svg>';
    }
    if (type === 'hybrid') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  }

  function getLocationLabel(type) {
    const map = {
      remote: 'Remote',
      hybrid: 'Hybrid',
      office: 'Office'
    };
    return map[type] || type;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Event Listeners
  function setupEventListeners() {
    // Category filters
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.filter;
        renderCards();
      });
    });

    // Location filters
    document.querySelectorAll('[data-location]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-location]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLocation = btn.dataset.location;
        renderCards();
      });
    });

    // Action filters
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const wasActive = btn.classList.contains('active');
        document.querySelectorAll('[data-action]').forEach(b => b.classList.remove('active'));
        if (!wasActive) {
          btn.classList.add('active');
          currentAction = btn.dataset.action;
        } else {
          currentAction = 'all';
        }
        renderCards();
      });
    });

    // Search
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = e.target.value.trim();
        renderCards();
      }, 200);
    });
  }

  // Reset filters (called from empty state button)
  window.resetFilters = function() {
    currentCategory = 'all';
    currentLocation = 'all';
    currentAction = 'all';
    searchQuery = '';
    searchInput.value = '';

    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-filter="all"]').classList.add('active');
    document.querySelectorAll('[data-location]').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-location="all"]').classList.add('active');
    document.querySelectorAll('[data-action]').forEach(b => b.classList.remove('active'));

    renderCards();
  };

  // Run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
