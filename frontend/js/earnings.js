const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '${API_BASE_URL}'
  : 'https://your-backend-api.onrender.com';

const API = `${API_BASE_URL}/api`;
const storage = sessionStorage;
const token = storage.getItem('token') || localStorage.getItem('token');
const user = JSON.parse(storage.getItem('user') || localStorage.getItem('user') || '{}');

if (!token || user.role !== 'Driver') {
  window.location.href = '../auth/login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const menuItems = document.querySelectorAll('.sidebar-menu-item');
  const goOfflineBtn = document.getElementById('goOfflineBtn');
  const viewAllLink = document.getElementById('viewAllLink');
  const progressFill = document.getElementById('progressFill');
  const logoutLink = document.getElementById('logoutLink');
  const mapImage = document.querySelector('.map-image');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const locationBtn = document.getElementById('locationBtn');
  let mapZoom = 1;

  setDriverChrome();
  loadEarnings();

  logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    storage.clear();
    window.location.href = '../auth/login.html';
  });

  viewAllLink?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'driver-ride-history.html';
  });

  goOfflineBtn.addEventListener('click', async () => {
    goOfflineBtn.textContent = 'Going Offline...';
    goOfflineBtn.disabled = true;
    await fetch(`${API}/driver/availability`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'Offline' }),
    }).catch(console.error);
    window.location.href = 'driver-dashboard.html';
  });

  hamburgerBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarOverlay.addEventListener('click', closeSidebar);
  menuItems.forEach((item) => item.addEventListener('click', (e) => {
    if (item.getAttribute('href') && item.getAttribute('href') !== '#') return;
    e.preventDefault();
    menuItems.forEach((i) => i.classList.remove('active'));
    item.classList.add('active');
    closeSidebar();
  }));

  zoomInBtn.addEventListener('click', () => applyMapZoom(0.15));
  zoomOutBtn.addEventListener('click', () => applyMapZoom(-0.15));
  locationBtn.addEventListener('click', () => {
    mapZoom = 1;
    mapImage.style.transform = 'scale(1)';
  });

  async function loadEarnings() {
    try {
      const listEl = document.getElementById('rideEarningsList');
      if (listEl) {
        listEl.innerHTML = '<div class="ride-earning-card"><div class="ride-earning-info"><span class="ride-earning-name">Loading completed rides...</span></div></div>';
      }
      const res = await fetch(`${API}/driver/earnings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return;

      setText('#todayEarnings', formatMoney(data.summary?.todayEarnings || 0));
      setText('#weeklyEarnings', formatMoney(data.summary?.weeklyEarnings || 0));
      setText('#totalRides', data.driver?.TotalTrips ?? data.summary?.totalTrips ?? 0);
      setText('#balanceAmount', formatMoney(data.summary?.totalEarnings || 0));
      setText('#earningsPill', formatMoney(data.summary?.todayEarnings || 0));

      // Update sidebar rating and status from live data
      if (data.driver) {
        const metaEl = document.querySelector('.sidebar-driver-meta');
        if (metaEl) {
          const rating = data.driver.AvgRating != null ? Number(data.driver.AvgRating).toFixed(2) : '-';
          const status = data.driver.AvailabilityStatus || 'Online';
          metaEl.innerHTML = `${rating} Rating <span class="meta-dot" aria-hidden="true"></span> ${status}`;
        }
      }

      if (listEl) {
        const rides = data.recentRides || [];
        listEl.innerHTML = rides.length ? rides.map((ride) => `
          <div class="ride-earning-card">
            <div class="ride-earning-info">
              <span class="ride-earning-meta">${formatDate(ride.EndTime || ride.ScheduledTime)} - Trip #${ride.RideID}</span>
              <span class="ride-earning-name">${ride.PickupLocation || '-'} to ${ride.DropoffLocation || '-'}</span>
            </div>
            <span class="ride-earning-amount">${formatMoney(ride.NetEarning || ride.Fare || 0)}</span>
          </div>
        `).join('') : '<div class="ride-earning-card"><div class="ride-earning-info"><span class="ride-earning-name">No completed rides yet</span></div></div>';
      }

      if (progressFill) {
        const weekly = Number(data.summary?.weeklyEarnings || 0);
        progressFill.style.width = `${Math.min(100, Math.round((weekly / 5000) * 100))}%`;
      }
    } catch (err) {
      console.error('Earnings load failed:', err);
    }
  }

  function setDriverChrome() {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Driver';
    const initials = `${user.firstName?.[0] || 'D'}${user.lastName?.[0] || ''}`.toUpperCase();
    document.querySelectorAll('.driver-profile-name, .sidebar-driver-name').forEach((el) => { el.textContent = fullName; });
    document.querySelectorAll('.driver-profile-avatar, .sidebar-avatar').forEach((el) => { el.textContent = initials; });
  }

  function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
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

  function formatMoney(value) {
    return `Rs. ${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleDateString() : '-';
  }
});
