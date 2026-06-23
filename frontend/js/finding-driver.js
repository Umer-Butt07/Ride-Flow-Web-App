const API_BASE_URL = CONFIG.API_BASE_URL;

const API = `${API_BASE_URL}/api`;
const storage = sessionStorage;
const token = storage.getItem('token') || localStorage.getItem('token');
const user = JSON.parse(storage.getItem('user') || localStorage.getItem('user') || '{}');

if (!token || user.role !== 'Rider') {
  window.location.href = '../../index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const availabilityText = document.querySelector('.availability-text');
  const mapImage = document.querySelector('.map-image');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const locationBtn = document.getElementById('locationBtn');

  let mapZoom = 1;
  let pollTimer = null;
  let messageIndex = 0;
  const messages = [
    'Waiting for your assigned driver...',
    'Checking the driver tab for acceptance...',
    'Keeping your request active...',
    'Almost there...',
  ];

  setUserChrome();
  renderRequestedSummary();
  startPolling();
  const statusTimer = setInterval(cycleStatus, 2500);

  hamburgerBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarOverlay.addEventListener('click', closeSidebar);
  cancelBtn.addEventListener('click', async () => {
    clearTimeout(pollTimer);
    clearInterval(statusTimer);
    cancelBtn.textContent = 'Cancelling...';
    cancelBtn.disabled = true;

    const requestId = storage.getItem('currentRequestId');
    if (requestId) {
      await fetch(`${API}/rider/requests/${requestId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(console.error);
      storage.removeItem('currentRequestId');
    }
    setTimeout(() => { window.location.href = 'rider-dashboard.html'; }, 500);
  });

  zoomInBtn.addEventListener('click', () => applyMapZoom(0.15));
  zoomOutBtn.addEventListener('click', () => applyMapZoom(-0.15));
  locationBtn.addEventListener('click', () => {
    mapZoom = 1;
    mapImage.style.transform = 'scale(1)';
  });

  function startPolling() {
    pollActiveRide();
  }

  async function pollActiveRide() {
    try {
      const res = await fetch(`${API}/rider/rides/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.ride) {
        storage.setItem('currentRideId', data.ride.RideID);
        storage.removeItem('currentRequestId');
        window.location.href = 'driver-assigned.html';
        return;
      }
    } catch (err) {
      console.error('Active ride poll failed:', err);
    }
    pollTimer = setTimeout(pollActiveRide, 3000);
  }

  function cycleStatus() {
    messageIndex = (messageIndex + 1) % messages.length;
    availabilityText.textContent = messages[messageIndex];
  }

  function renderRequestedSummary() {
    const summary = JSON.parse(storage.getItem('requestedRideSummary') || 'null');
    if (!summary) return;
    const locationValues = document.querySelectorAll('.summary-location-value');
    if (locationValues[0]) locationValues[0].textContent = summary.pickup || '-';
    if (locationValues[1]) locationValues[1].textContent = summary.dropoff || '-';

    const detailValues = document.querySelectorAll('.summary-detail-value');
    if (detailValues[0]) detailValues[0].textContent = summary.estimate?.vehicleType || '-';
    if (detailValues[1]) detailValues[1].textContent = summary.estimate ? `Rs. ${Number(summary.estimate.fare || 0).toFixed(2)}` : '-';
    if (detailValues[2]) detailValues[2].textContent = summary.estimate ? `${Number(summary.estimate.distance || 0).toFixed(1)} km` : '-';
    if (detailValues[3]) detailValues[3].textContent = summary.estimate ? `${Math.round(summary.estimate.duration || 0)} mins` : '-';

    const detail = summary.estimate
      ? `${summary.pickup} to ${summary.dropoff} - Rs. ${Number(summary.estimate.fare || 0).toFixed(2)}`
      : `${summary.pickup} to ${summary.dropoff}`;
    availabilityText.textContent = detail;
  }

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
});
