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
  const endTripBtn = document.getElementById('endTripBtn');
  const cancelRideBtn = document.getElementById('cancelRideBtn');
  const goOfflineBtn = document.getElementById('goOfflineBtn');
  const logoutLink = document.getElementById('logoutLink');
  const mapImage = document.querySelector('.map-image');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const locationBtn = document.getElementById('locationBtn');

  let currentRide = null;
  let mapZoom = 1;

  setDriverChrome();
  loadCurrentRide();

  logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    storage.clear();
    window.location.href = '../auth/login.html';
  });

  endTripBtn.addEventListener('click', completeRide);
  cancelRideBtn.addEventListener('click', cancelRide);
  goOfflineBtn.addEventListener('click', () => {
    goOfflineBtn.textContent = 'Finish active ride first';
    setTimeout(() => { goOfflineBtn.textContent = 'Go Offline'; }, 1500);
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

  async function loadCurrentRide() {
    try {
      const res = await fetch(`${API}/driver/current-ride`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.ride) {
        storage.removeItem('currentRideId');
        renderNoRide();
        return;
      }
      currentRide = data.ride;
      storage.setItem('currentRideId', data.ride.RideID);
      renderRide(data.ride);
    } catch (err) {
      console.error('Current ride load failed:', err);
      renderNoRide();
    }
  }

  function renderRide(ride) {
    setText('.cr-passenger-name', `${ride.RiderFirstName || ''} ${ride.RiderLastName || ''}`.trim() || 'Rider');
    const addresses = document.querySelectorAll('.cr-loc-address');
    if (addresses[0]) addresses[0].textContent = ride.PickupLocation || '-';
    if (addresses[1]) addresses[1].textContent = ride.DropoffLocation || '-';
    setText('.fare-card-amount', formatMoney(ride.Fare || 0));

    const statValues = document.querySelectorAll('.cr-stat-value');
    if (statValues[0]) statValues[0].textContent = `${Number(ride.Distance || 0).toFixed(1)} km`;
    if (statValues[1]) statValues[1].textContent = `${Math.round(ride.Duration || 0)} mins`;

    setText('.status-card-title', ride.Status === 'EnRoute' ? 'Driving to pickup' : 'Passenger onboard');
    setText('#etaText', ride.Status === 'EnRoute'
      ? `Pickup route: ${Math.max(1, Math.ceil((ride.Duration || 5) / 3))} mins`
      : `Arriving in ${Math.round(ride.Duration || 0)} mins`);
    document.getElementById('earningsPill').textContent = formatMoney(ride.Fare || 0);

    const btnText = endTripBtn.querySelector('.btn-text');
    if (btnText) {
      btnText.textContent = ride.Status === 'EnRoute' ? 'Pick Up Rider' : 'End Trip';
    }
  }

  function renderNoRide() {
    setText('.ride-panel-heading', 'No active ride');
    setText('.ride-panel-sub', 'Accepted rides will appear here.');
    endTripBtn.disabled = true;
    cancelRideBtn.disabled = true;
  }

  async function completeRide() {
    if (!currentRide) return;
    const isEnRoute = currentRide.Status === 'EnRoute';
    const nextStatus = isEnRoute ? 'InProgress' : 'Completed';
    const actionText = isEnRoute ? 'Updating...' : 'Completing...';

    endTripBtn.classList.add('loading');
    endTripBtn.disabled = true;
    endTripBtn.querySelector('.btn-text').textContent = actionText;

    try {
      const res = await fetch(`${API}/driver/rides/${currentRide.RideID}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus, paymentMethod: 'Cash' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update ride status.');

      if (isEnRoute) {
        endTripBtn.disabled = false;
        endTripBtn.classList.remove('loading');
        loadCurrentRide();
      } else {
        storage.removeItem('currentRideId');
        endTripBtn.querySelector('.btn-text').textContent = 'Trip Completed';
        setTimeout(() => { window.location.href = 'driver-dashboard.html'; }, 700);
      }
    } catch (err) {
      endTripBtn.disabled = false;
      endTripBtn.classList.remove('loading');
      endTripBtn.querySelector('.btn-text').textContent = isEnRoute ? 'Pick Up Rider' : 'End Trip';
      setText('.ride-panel-sub', err.message);
    }
  }

  async function cancelRide() {
    if (!currentRide || !confirm('Cancel this ride?')) return;
    cancelRideBtn.textContent = 'Cancelling...';
    cancelRideBtn.disabled = true;
    await fetch(`${API}/driver/rides/${currentRide.RideID}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'Cancelled' }),
    }).catch(console.error);
    storage.removeItem('currentRideId');
    window.location.href = 'driver-dashboard.html';
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
