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
  'use strict';

  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const menuItems = document.querySelectorAll('.sidebar-menu-item');
  const onlineToggle = document.getElementById('onlineToggle');
  const onlineHeading = document.getElementById('onlineHeading');
  const onlineSubtext = document.getElementById('onlineSubtext');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const goOfflineBtn = document.getElementById('goOfflineBtn');
  const logoDot = document.getElementById('logoDot');
  const gpsDot = document.getElementById('gpsDot');
  const gpsText = document.getElementById('gpsText');
  const waitingCard = document.getElementById('waitingCard');
  const demandBtn = document.getElementById('demandBtn');
  const logoutLink = document.getElementById('logoutLink');
  const mapImage = document.querySelector('.map-image');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const locationBtn = document.getElementById('locationBtn');
  const changeCityBtn = document.getElementById('changeCityBtn');
  const cityModalOverlay = document.getElementById('cityModalOverlay');
  const cancelCityBtn = document.getElementById('cancelCityBtn');
  const cityName = document.getElementById('cityName');
  const cityOptions = document.querySelectorAll('.city-option');

  let mapZoom = 1;

  setDriverChrome();
  loadDashboard();

  logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    storage.clear();
    window.location.href = '../auth/login.html';
  });

  hamburgerBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarOverlay.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
  });

  menuItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      if (item.getAttribute('href') && item.getAttribute('href') !== '#') return;
      e.preventDefault();
      menuItems.forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
      closeSidebar();
    });
  });

  onlineToggle.addEventListener('change', () => setOnlineState(onlineToggle.checked, true));
  goOfflineBtn.addEventListener('click', () => setOnlineState(goOfflineBtn.classList.contains('offline'), true));
  demandBtn.addEventListener('click', () => {
    demandBtn.textContent = 'Watching for requests...';
    setTimeout(() => { demandBtn.textContent = 'High Demand Area'; }, 1200);
  });

  zoomInBtn.addEventListener('click', () => applyMapZoom(0.15));
  zoomOutBtn.addEventListener('click', () => applyMapZoom(-0.15));
  locationBtn.addEventListener('click', () => {
    mapZoom = 1;
    mapImage.style.transform = 'scale(1)';
  });

  // City change modal
  changeCityBtn.addEventListener('click', openCityModal);
  cancelCityBtn.addEventListener('click', closeCityModal);
  cityModalOverlay.addEventListener('click', (e) => {
    if (e.target === cityModalOverlay) closeCityModal();
  });
  cityOptions.forEach(btn => {
    btn.addEventListener('click', () => changeCity(btn.dataset.city));
  });

  async function loadDashboard() {
    try {
      const res = await fetch(`${API}/driver/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return;

      document.getElementById('ridesCount').textContent = data.driver?.TotalTrips ?? data.todayStats?.tripsToday ?? '0';
      document.getElementById('earningsValue').textContent = formatMoney(data.todayStats?.earningsToday || 0);
      document.getElementById('earningsPill').textContent = formatMoney(data.todayStats?.earningsToday || 0);

      if (data.driver) {
        const metaEl = document.querySelector('.sidebar-driver-meta');
        if (metaEl) {
          const ratingDisplay = data.driver.AvgRating != null ? Number(data.driver.AvgRating).toFixed(2) : '--';
          metaEl.innerHTML = `${ratingDisplay} Rating <span class="meta-dot" aria-hidden="true"></span> <span id="sidebarStatus">${data.driver.AvailabilityStatus}</span>`;
        }
        setOnlineState(data.driver.AvailabilityStatus === 'Online', false);

        // Display driver's city
        if (data.driver.City) {
          cityName.textContent = data.driver.City;
          highlightActiveCity(data.driver.City);
        }
      }

      if (data.activeRide) {
        waitingCard.querySelector('h3').textContent = 'Active ride in progress';
        waitingCard.querySelector('p').textContent = `${data.activeRide.PickupLocation} to ${data.activeRide.DropoffLocation}`;
      }
    } catch (err) {
      console.error('Dashboard load failed:', err);
    }
  }

  async function setOnlineState(isOnline, syncBackend) {
    onlineToggle.checked = isOnline;

    if (isOnline) {
      onlineHeading.textContent = 'You are Online';
      onlineSubtext.textContent = 'Ready to accept new ride requests';
      statusBadge.classList.remove('offline-badge');
      statusText.textContent = 'Status: Online';
      goOfflineBtn.textContent = 'Go Offline';
      goOfflineBtn.classList.remove('offline');
      setSidebarStatus('Online');
      logoDot.style.cssText = 'background:#16a34a;box-shadow:0 0 8px rgba(22,163,74,0.4);animation:pulseDot 2s ease-in-out infinite';
      gpsDot.style.cssText = 'background:#16a34a;animation:pulseDot 2s ease-in-out infinite';
      gpsText.textContent = 'GPS Tracking Active';
      waitingCard.style.opacity = '1';
      waitingCard.style.pointerEvents = 'all';
    } else {
      onlineHeading.textContent = 'You are Offline';
      onlineSubtext.textContent = 'Go online to start receiving ride requests';
      statusBadge.classList.add('offline-badge');
      statusText.textContent = 'Status: Offline';
      goOfflineBtn.textContent = 'Go Online';
      goOfflineBtn.classList.add('offline');
      setSidebarStatus('Offline');
      logoDot.style.cssText = 'background:#d1d5db;box-shadow:none;animation:none';
      gpsDot.style.cssText = 'background:#d1d5db;animation:none';
      gpsText.textContent = 'GPS Inactive';
      waitingCard.style.opacity = '0.5';
      waitingCard.style.pointerEvents = 'none';
    }

    if (!syncBackend) return;

    try {
      const res = await fetch(`${API}/driver/availability`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: isOnline ? 'Online' : 'Offline' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Availability update failed.');
    } catch (err) {
      console.error(err);
      loadDashboard();
    }
  }

  function setDriverChrome() {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Driver';
    const initials = `${user.firstName?.[0] || 'D'}${user.lastName?.[0] || ''}`.toUpperCase();
    document.querySelectorAll('.driver-profile-name, .sidebar-driver-name, .navbar-user-name').forEach((el) => { el.textContent = fullName; });
    document.querySelectorAll('.driver-profile-avatar, .sidebar-avatar, .navbar-avatar').forEach((el) => {
      if (user.ProfilePicture) {
        const src = user.ProfilePicture.startsWith('http') ? user.ProfilePicture : `${API_BASE_URL}${user.ProfilePicture}`;
        el.innerHTML = `<img src="${src}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
      } else {
        el.textContent = initials;
      }
    });
  }

  function setSidebarStatus(status) {
    const sidebarStatus = document.getElementById('sidebarStatus');
    if (sidebarStatus) sidebarStatus.textContent = status;
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

  function openCityModal() {
    cityModalOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeCityModal() {
    cityModalOverlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  function highlightActiveCity(city) {
    cityOptions.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.city === city);
    });
  }

  async function changeCity(newCity) {
    try {
      cityOptions.forEach(b => { b.disabled = true; });
      const res = await fetch(`${API}/driver/city`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ city: newCity }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update city.');
        return;
      }
      cityName.textContent = newCity;
      highlightActiveCity(newCity);
      closeCityModal();
    } catch (err) {
      console.error('City change failed:', err);
      alert('Network error. Could not change city.');
    } finally {
      cityOptions.forEach(b => { b.disabled = false; });
    }
  }
});
