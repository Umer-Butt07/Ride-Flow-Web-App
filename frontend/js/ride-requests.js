const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '${API_BASE_URL}'
  : 'https://your-backend-api.onrender.com';

const API = `${API_BASE_URL}/api`;
const storage = sessionStorage;
const token = storage.getItem('token') || localStorage.getItem('token');
const user = JSON.parse(storage.getItem('user') || localStorage.getItem('user') || '{}');

if (!token || user.role !== 'Driver') {
  window.location.href = '../../index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const menuItems = document.querySelectorAll('.sidebar-menu-item');
  const acceptBtn = document.getElementById('acceptBtn');
  const declineBtn = document.getElementById('declineBtn');
  const countdownBadge = document.getElementById('countdownBadge');
  const goOfflineBtn = document.getElementById('goOfflineBtn');
  const logoutLink = document.getElementById('logoutLink');
  const mapImage = document.querySelector('.map-image');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const locationBtn = document.getElementById('locationBtn');
  const layersBtn = document.getElementById('layersBtn');
  const passengerCard = document.getElementById('passengerCard');
  const requestActions = document.querySelector('.request-actions');
  const requestHeading = document.querySelector('.request-heading');
  const requestSubheading = document.querySelector('.request-subheading');

  let mapZoom = 1;
  let countdownSeconds = 15;
  let countdownInterval = null;
  let currentRequestId = null;
  let emptyPollTimer = null;

  setDriverChrome();
  loadRequests();

  logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    storage.clear();
    window.location.href = '../../index.html';
  });

  hamburgerBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarOverlay.addEventListener('click', closeSidebar);

  menuItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      if (item.getAttribute('href') && item.getAttribute('href') !== '#') return;
      e.preventDefault();
      menuItems.forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
      closeSidebar();
    });
  });

  acceptBtn.addEventListener('click', acceptRide);
  declineBtn.addEventListener('click', declineRide);
  goOfflineBtn.addEventListener('click', goOffline);
  zoomInBtn.addEventListener('click', () => applyMapZoom(0.15));
  zoomOutBtn.addEventListener('click', () => applyMapZoom(-0.15));
  locationBtn.addEventListener('click', () => {
    mapZoom = 1;
    mapImage.style.transform = 'scale(1)';
  });
  layersBtn.addEventListener('click', () => {
    layersBtn.style.background = '#e5e7eb';
    setTimeout(() => { layersBtn.style.background = ''; }, 300);
  });

  async function loadRequests() {
    stopCountdown();
    if (emptyPollTimer) clearTimeout(emptyPollTimer);
    renderEmpty('Loading ride requests', 'Checking the database for requests assigned to you.');
    try {
      const res = await fetch(`${API}/driver/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load ride requests.');
      if (!data.requests?.length) {
        renderEmpty(data.driverStatus === 'Offline'
          ? 'You are offline'
          : 'No pending ride requests',
          data.driverStatus === 'Offline'
            ? 'Go online from the dashboard to receive requests.'
            : 'New rider requests will appear here when assigned to you.');
        if (data.driverStatus !== 'Offline') {
          emptyPollTimer = setTimeout(loadRequests, 3000);
        }
        return;
      }

      renderRequest(data.requests[0]);
      startCountdown();
    } catch (err) {
      renderEmpty('Request load failed', err.message);
      emptyPollTimer = setTimeout(loadRequests, 5000);
    }
  }

  function renderRequest(ride) {
    currentRequestId = ride.RequestID;
    passengerCard.style.display = '';
    requestActions.style.display = '';
    requestHeading.textContent = 'New Ride Request';
    requestSubheading.textContent = 'Incoming request assigned to you';

    setText('.passenger-name', `${ride.RiderFirstName || ''} ${ride.RiderLastName || ''}`.trim() || 'Rider');
    setText('.passenger-meta', `${Number(ride.RiderRating || 0).toFixed(1)} rating - ${ride.RiderCompletedRides || 0} rides`);
    setText('.ride-type-badge', ride.RequestedVehicleType || 'Economy');

    const addresses = document.querySelectorAll('.location-address');
    if (addresses[0]) addresses[0].textContent = `${ride.PickupLocation || '-'}, ${ride.PickupCity || ''}`;
    if (addresses[1]) addresses[1].textContent = `${ride.DropoffLocation || '-'}, ${ride.DropoffCity || ''}`;

    const statValues = document.querySelectorAll('.request-stat-value');
    if (statValues[0]) statValues[0].textContent = `${Number(ride.EstimatedDistance || 0).toFixed(1)} km trip`;
    if (statValues[1]) statValues[1].textContent = `${Math.round(ride.EstimatedDuration || 0)} mins`;
    setText('.est-fare-value', formatMoney(ride.EstimatedFare || 0));
    setActionsEnabled(true);
  }

  function renderEmpty(title, message) {
    currentRequestId = null;
    passengerCard.style.display = 'none';
    requestActions.style.display = 'none';
    requestHeading.textContent = title;
    requestSubheading.textContent = message;
  }

  async function acceptRide() {
    if (!currentRequestId) return;
    stopCountdown();
    setActionsEnabled(false);
    acceptBtn.querySelector('.btn-text').textContent = 'Accepting...';

    try {
      const res = await fetch(`${API}/driver/requests/${currentRequestId}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not accept request.');
      storage.setItem('currentRideId', data.rideId);
      acceptBtn.querySelector('.btn-text').textContent = 'Ride Accepted';
      setTimeout(() => { window.location.href = 'current-ride.html'; }, 500);
    } catch (err) {
      requestSubheading.textContent = err.message;
      acceptBtn.querySelector('.btn-text').textContent = 'Accept Ride';
      setActionsEnabled(true);
      loadRequests();
    }
  }

  async function declineRide() {
    if (!currentRequestId) return;
    stopCountdown();
    setActionsEnabled(false);
    declineBtn.querySelector('.btn-text').textContent = 'Declining...';
    await fetch(`${API}/driver/requests/${currentRequestId}/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(console.error);
    loadRequests();
  }

  async function goOffline() {
    stopCountdown();
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
  }

  function startCountdown() {
    countdownSeconds = 15;
    countdownBadge.textContent = `${countdownSeconds}s`;
    countdownInterval = setInterval(() => {
      countdownSeconds -= 1;
      countdownBadge.textContent = `${countdownSeconds}s`;
      if (countdownSeconds <= 0) declineRide();
    }, 1000);
  }

  function stopCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = null;
  }

  function setActionsEnabled(enabled) {
    acceptBtn.disabled = !enabled;
    declineBtn.disabled = !enabled;
    acceptBtn.style.opacity = enabled ? '' : '0.6';
    declineBtn.style.opacity = enabled ? '' : '0.6';
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
});
