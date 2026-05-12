const API = 'http://localhost:5000/api';
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
  const cancelBtn = document.getElementById('cancelRideBtn');
  const contactBtn = document.getElementById('contactDriverBtn');
  const messageBtn = document.getElementById('messageBtn');
  const etaEl = document.getElementById('etaMinutes');
  const mapImage = document.querySelector('.map-image');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const locationBtn = document.getElementById('locationBtn');

  let currentRide = null;
  let pollTimer = null;
  let mapZoom = 1;

  setUserChrome();
  loadActiveRide();

  hamburgerBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarOverlay.addEventListener('click', closeSidebar);

  cancelBtn.addEventListener('click', async () => {
    if (!currentRide) return;
    cancelBtn.textContent = 'Cancelling...';
    cancelBtn.disabled = true;
    await fetch(`${API}/rider/rides/${currentRide.RideID}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(console.error);
    storage.removeItem('currentRideId');
    window.location.href = 'rider-dashboard.html';
  });

  contactBtn.addEventListener('click', () => {
    if (currentRide?.DriverPhone) {
      contactBtn.textContent = currentRide.DriverPhone;
      return;
    }
    contactBtn.textContent = 'Phone unavailable';
  });

  messageBtn.addEventListener('click', () => {
    messageBtn.textContent = 'Message queued';
    setTimeout(() => { messageBtn.textContent = 'Message'; }, 1500);
  });

  zoomInBtn.addEventListener('click', () => applyMapZoom(0.15));
  zoomOutBtn.addEventListener('click', () => applyMapZoom(-0.15));
  locationBtn.addEventListener('click', () => {
    mapZoom = 1;
    mapImage.style.transform = 'scale(1)';
  });

  async function loadActiveRide() {
    try {
      const res = await fetch(`${API}/rider/rides/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.ride) {
        currentRide = data.ride;
        storage.setItem('currentRideId', data.ride.RideID);
        renderRide(data.ride);
        pollTimer = setTimeout(loadActiveRide, 4000);
        return;
      }

      const rideId = storage.getItem('currentRideId');
      if (rideId) {
        window.location.href = 'payment-summary.html';
        return;
      }
      window.location.href = 'rider-dashboard.html';
    } catch (err) {
      console.error('Active ride load failed:', err);
      pollTimer = setTimeout(loadActiveRide, 4000);
    }
  }

  function renderRide(ride) {
    const driverName = `${ride.DriverFirstName || ''} ${ride.DriverLastName || ''}`.trim() || 'Assigned Driver';
    setText('.driver-name', driverName);
    setText('.vehicle-name', `${ride.Make || ''} ${ride.Model || ''}`.trim() || ride.VehicleType || 'Vehicle');
    setText('.vehicle-color', ride.Color || '-');
    setText('.vehicle-plate', ride.LicensePlate || '-');

    const locationEls = document.querySelectorAll('.arrival-location-item');
    if (locationEls[0]) locationEls[0].lastChild.textContent = ` ${ride.PickupLocation || '-'}`;
    if (locationEls[1]) locationEls[1].lastChild.textContent = ` ${ride.DropoffLocation || '-'}`;

    const statValues = document.querySelectorAll('.ride-stat-value');
    if (statValues[0]) statValues[0].textContent = `Rs. ${Number(ride.Fare || 0).toFixed(2)}`;
    if (statValues[1]) statValues[1].textContent = `${Number(ride.Distance || 0).toFixed(1)} km`;
    if (statValues[2]) statValues[2].textContent = `${Math.round(ride.Duration || 0)} mins`;

    etaEl.textContent = Math.max(1, Math.ceil(Number(ride.Duration || 5) / 3));
    const heading = document.querySelector('.ride-status-heading');
    if (heading) heading.textContent = ride.Status === 'InProgress' ? 'Your Ride is in Progress' : 'Your Driver is On the Way';
  }

  function setUserChrome() {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Rider';
    const initials = `${user.firstName?.[0] || 'R'}${user.lastName?.[0] || ''}`.toUpperCase();
    document.querySelectorAll('.navbar-user-name, .sidebar-user-name').forEach((el) => { el.textContent = fullName; });
    document.querySelectorAll('.navbar-avatar').forEach((el) => { el.textContent = initials; });
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

  window.addEventListener('beforeunload', () => clearTimeout(pollTimer));
});
