const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '${API_BASE_URL}'
  : 'https://your-backend-api.onrender.com';

const API = `${API_BASE_URL}/api`;
const storage = sessionStorage;
const token = storage.getItem('token') || localStorage.getItem('token');
const user = JSON.parse(storage.getItem('user') || localStorage.getItem('user') || '{}');

if (!token || user.role !== 'Rider') {
  window.location.href = '../auth/login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const rideCards = document.getElementById('rideCards');
  const emptyState = document.getElementById('emptyState');
  const logoutLink = document.getElementById('logoutLink');
  const mapImage = document.querySelector('.map-image');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const locationBtn = document.getElementById('locationBtn');

  let allRides = [];
  let activeFilter = 'all';
  let mapZoom = 1;

  setUserChrome();
  loadHistory();

  logoutLink?.addEventListener('click', (e) => {
    e.preventDefault();
    storage.clear();
    window.location.href = '../auth/login.html';
  });

  hamburgerBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarOverlay.addEventListener('click', closeSidebar);

  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      filterTabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeFilter = tab.dataset.filter;
      renderRides();
    });
  });

  zoomInBtn.addEventListener('click', () => applyMapZoom(0.15));
  zoomOutBtn.addEventListener('click', () => applyMapZoom(-0.15));
  locationBtn.addEventListener('click', () => {
    mapZoom = 1;
    mapImage.style.transform = 'scale(1)';
  });

  async function loadHistory() {
    rideCards.innerHTML = '';
    emptyState.style.display = '';
    emptyState.querySelector('.empty-state-text').textContent = 'Loading rides...';

    try {
      const res = await fetch(`${API}/rider/rides/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load ride history.');
      allRides = Array.isArray(data) ? data : [];
      renderRides();
    } catch (err) {
      rideCards.innerHTML = '';
      emptyState.style.display = '';
      emptyState.querySelector('.empty-state-text').textContent = err.message;
    }
  }

  function renderRides() {
    const filtered = activeFilter === 'all'
      ? allRides
      : allRides.filter((ride) => ride.Status.toLowerCase() === activeFilter);

    if (!filtered.length) {
      rideCards.innerHTML = '';
      emptyState.style.display = '';
      emptyState.querySelector('.empty-state-text').textContent = 'No rides found for this filter.';
      return;
    }

    emptyState.style.display = 'none';
    rideCards.innerHTML = filtered.map((ride) => `
      <div class="ride-card" data-status="${escapeHtml(ride.Status.toLowerCase())}">
        <div class="ride-card-header">
          <div class="ride-card-date">
            <span class="ride-date-text">${formatDate(ride.ScheduledTime || ride.EndTime)}</span>
            <span class="ride-type-text">${escapeHtml(ride.VehicleType || 'Ride')}</span>
          </div>
          <span class="ride-status ${escapeHtml(ride.Status.toLowerCase())}">${escapeHtml(ride.Status)}</span>
        </div>
        <div class="ride-locations">
          <div class="ride-location-item">${escapeHtml(ride.PickupLocation || '-')}</div>
          <div class="ride-location-item dropoff">${escapeHtml(ride.DropoffLocation || '-')}</div>
        </div>
        <div class="ride-card-footer" style="display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-top:16px;">
          <div class="ride-stats-row" style="flex:1;">
            <div class="ride-stat-mini">
              <span class="ride-stat-mini-label">Fare</span>
              <span class="ride-stat-mini-value">Rs. ${Number(ride.Fare || 0).toFixed(2)}</span>
            </div>
            <div class="ride-stat-mini">
              <span class="ride-stat-mini-label">Distance</span>
              <span class="ride-stat-mini-value">${Number(ride.Distance || 0).toFixed(1)} km</span>
            </div>
          </div>
          ${(ride.Status === 'Completed' || ride.Status === 'Cancelled') ? `
            <button onclick="reportRide(${ride.RideID})" class="report-btn" style="padding: 8px 16px; background: #fee2e2; color: #ef4444; border: 1.5px solid #fca5a5; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.8rem; transition: background 0.2s;">Report Issue</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  window.reportRide = async (rideId) => {
    const description = prompt('Please describe the issue you had with this ride:');
    if (!description || !description.trim()) return;

    try {
      const res = await fetch(`${API}/rider/rides/${rideId}/complain`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description: description.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit complaint');
      alert('Your complaint has been submitted successfully.');
    } catch (err) {
      alert(err.message);
    }
  };

  function setUserChrome() {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Rider';
    const initials = `${user.firstName?.[0] || 'R'}${user.lastName?.[0] || ''}`.toUpperCase();
    document.querySelectorAll('.navbar-user-name, .sidebar-user-name').forEach((el) => { el.textContent = fullName; });
    document.querySelectorAll('.navbar-avatar').forEach((el) => { el.textContent = initials; });
  }

  function openSidebar() {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('visible');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  function applyMapZoom(delta) {
    mapZoom = Math.max(0.8, Math.min(2, mapZoom + delta));
    mapImage.style.transform = `scale(${mapZoom})`;
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleString() : '-';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));
  }
});
