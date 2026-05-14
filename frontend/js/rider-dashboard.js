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
  const bookingForm = document.getElementById('bookingForm');
  const pickupInput = document.getElementById('pickupLocation');
  const dropoffInput = document.getElementById('dropoffLocation');
  const vehicleSelect = document.getElementById('vehicleType');
  const promoInput = document.getElementById('promoCode');
  const requestBtn = document.getElementById('requestBtn');
  const pickupError = document.getElementById('pickupError');
  const dropoffError = document.getElementById('dropoffError');
  const fareAmount = document.getElementById('fareAmount');
  const fareDistance = document.getElementById('fareDistance');
  const fareDuration = document.getElementById('fareDuration');
  const logoutLink = document.getElementById('logoutLink');
  const mapImage = document.querySelector('.map-image');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const locationBtn = document.getElementById('locationBtn');

  let locations = [];
  let estimateTimer = null;
  let currentEstimate = null;
  let mapZoom = 1;

  setUserChrome();
  resetEstimate();
  loadLocations();
  loadWalletBalance();

  logoutLink?.addEventListener('click', (e) => {
    e.preventDefault();
    storage.clear();
    window.location.href = '../auth/login.html';
  });

  hamburgerBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarOverlay.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
    if (e.key === 'Escape' && topupOverlay.classList.contains('visible')) closeTopupModal();
  });

  pickupInput.addEventListener('input', () => {
    clearError(pickupInput, pickupError);
    scheduleEstimate();
  });
  dropoffInput.addEventListener('input', () => {
    clearError(dropoffInput, dropoffError);
    scheduleEstimate();
  });
  vehicleSelect.addEventListener('change', scheduleEstimate);
  promoInput?.addEventListener('input', scheduleEstimate);

  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const pickup = findLocation(pickupInput.value);
    const dropoff = findLocation(dropoffInput.value);
    let valid = true;

    if (!pickup) {
      showError(pickupInput, pickupError, 'Choose a pickup from the saved locations');
      valid = false;
    }
    if (!dropoff) {
      showError(dropoffInput, dropoffError, 'Choose a destination from the saved locations');
      valid = false;
    }
    if (pickup && dropoff && pickup.LocationID === dropoff.LocationID) {
      showError(dropoffInput, dropoffError, 'Pickup and destination must be different');
      valid = false;
    }
    if (!valid) return;

    setButtonLoading(true, 'Requesting...');
    try {
      const res = await fetch(`${API}/rider/rides/request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupLocationId: pickup.LocationID,
          dropoffLocationId: dropoff.LocationID,
          vehicleType: selectedVehicleType(),
          promoCode: promoInput?.value.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ride request failed.');

      storage.setItem('currentRequestId', data.requestId);
      storage.setItem('requestedRideSummary', JSON.stringify({
        pickup: pickup.Name,
        dropoff: dropoff.Name,
        estimate: data.estimate || currentEstimate,
      }));
      setButtonLoading(false, 'Ride Requested');
      requestBtn.style.background = '#16a34a';
      setTimeout(() => { window.location.href = 'finding-driver.html'; }, 600);
    } catch (err) {
      setButtonLoading(false, 'Request Ride');
      requestBtn.style.background = '';
      showError(dropoffInput, dropoffError, err.message);
    }
  });

  zoomInBtn.addEventListener('click', () => applyMapZoom(0.15));
  zoomOutBtn.addEventListener('click', () => applyMapZoom(-0.15));
  locationBtn.addEventListener('click', () => {
    mapZoom = 1;
    mapImage.style.transform = 'scale(1)';
  });

  // ── Wallet Top-Up Modal ──
  const topupOverlay   = document.getElementById('topupOverlay');
  const topupCloseBtn  = document.getElementById('topupCloseBtn');
  const openTopupBtn   = document.getElementById('openTopupBtn');
  const topupAmountInput = document.getElementById('topupAmount');
  const topupSubmitBtn = document.getElementById('topupSubmitBtn');
  const topupError     = document.getElementById('topupError');
  const topupSuccess   = document.getElementById('topupSuccess');
  const topupSuccessMsg = document.getElementById('topupSuccessMsg');
  const topupPresets   = document.querySelectorAll('.topup-preset');
  const walletBalanceEl = document.getElementById('walletBalance');
  const topupCurrentBalance = document.getElementById('topupCurrentBalance');

  let currentWalletBalance = 0;

  openTopupBtn?.addEventListener('click', () => openTopupModal());
  topupCloseBtn?.addEventListener('click', () => closeTopupModal());
  topupOverlay?.addEventListener('click', (e) => {
    if (e.target === topupOverlay) closeTopupModal();
  });

  topupPresets.forEach((btn) => {
    btn.addEventListener('click', () => {
      topupPresets.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      topupAmountInput.value = btn.dataset.amount;
      topupError.textContent = '';
    });
  });

  topupAmountInput?.addEventListener('input', () => {
    topupPresets.forEach((b) => b.classList.remove('selected'));
    topupError.textContent = '';
  });

  topupSubmitBtn?.addEventListener('click', async () => {
    const amount = Number(topupAmountInput.value);
    if (!amount || amount <= 0) {
      topupError.textContent = 'Please enter a valid amount.';
      return;
    }
    if (amount > 50000) {
      topupError.textContent = 'Maximum top-up amount is Rs. 50,000.';
      return;
    }

    topupError.textContent = '';
    topupSubmitBtn.classList.add('loading');
    topupSubmitBtn.disabled = true;

    try {
      const res = await fetch(`${API}/rider/wallet/topup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Top-up failed.');

      currentWalletBalance = data.walletBalance;
      updateWalletDisplay(currentWalletBalance);

      topupSubmitBtn.classList.remove('loading');
      topupSubmitBtn.disabled = false;
      topupSubmitBtn.style.display = 'none';
      topupSuccessMsg.textContent = `Rs. ${amount.toFixed(2)} added successfully!`;
      topupSuccess.classList.add('visible');

      setTimeout(() => closeTopupModal(), 2000);
    } catch (err) {
      topupSubmitBtn.classList.remove('loading');
      topupSubmitBtn.disabled = false;
      topupError.textContent = err.message;
    }
  });

  function openTopupModal() {
    topupAmountInput.value = '';
    topupError.textContent = '';
    topupPresets.forEach((b) => b.classList.remove('selected'));
    topupSubmitBtn.style.display = '';
    topupSubmitBtn.classList.remove('loading');
    topupSubmitBtn.disabled = false;
    topupSuccess.classList.remove('visible');
    topupCurrentBalance.textContent = formatMoney(currentWalletBalance);
    topupOverlay.classList.add('visible');
  }

  function closeTopupModal() {
    topupOverlay.classList.remove('visible');
  }

  async function loadWalletBalance() {
    try {
      const res = await fetch(`${API}/rider/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        currentWalletBalance = data.walletBalance || 0;
        updateWalletDisplay(currentWalletBalance);
      }
    } catch (err) {
      console.error('Wallet balance load failed:', err);
    }
  }

  function updateWalletDisplay(balance) {
    if (walletBalanceEl) walletBalanceEl.textContent = formatMoney(balance);
    if (topupCurrentBalance) topupCurrentBalance.textContent = formatMoney(balance);
  }

  async function loadLocations() {
    try {
      const res = await fetch(`${API}/rider/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      locations = await res.json();
      attachDatalist(pickupInput, 'pickupLocations');
      attachDatalist(dropoffInput, 'dropoffLocations');
    } catch (err) {
      console.error('Location load failed:', err);
    }
  }

  function attachDatalist(input, id) {
    const datalist = document.createElement('datalist');
    datalist.id = id;
    datalist.innerHTML = locations.map((loc) => (
      `<option value="${escapeHtml(loc.Name)}">${escapeHtml(loc.City)}</option>`
    )).join('');
    document.body.appendChild(datalist);
    input.setAttribute('list', id);
  }

  function scheduleEstimate() {
    clearTimeout(estimateTimer);
    estimateTimer = setTimeout(loadEstimate, 250);
  }

  async function loadEstimate() {
    const pickup = findLocation(pickupInput.value);
    const dropoff = findLocation(dropoffInput.value);
    if (!pickup || !dropoff || pickup.LocationID === dropoff.LocationID) {
      resetEstimate();
      return;
    }

    fareAmount.textContent = '...';
    fareDistance.textContent = '...';
    fareDuration.textContent = '...';

    try {
      const res = await fetch(`${API}/rider/rides/estimate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupLocationId: pickup.LocationID,
          dropoffLocationId: dropoff.LocationID,
          vehicleType: selectedVehicleType(),
          promoCode: promoInput?.value.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Estimate failed.');
      currentEstimate = data.estimate;
      fareAmount.textContent = formatMoney(data.estimate.fare);
      fareDistance.textContent = `${Number(data.estimate.distance).toFixed(1)} km`;
      fareDuration.textContent = `${Math.round(data.estimate.duration)} mins`;
    } catch (err) {
      currentEstimate = null;
      fareAmount.textContent = 'Unavailable';
      fareDistance.textContent = '-';
      fareDuration.textContent = '-';
    }
  }

  function selectedVehicleType() {
    const value = vehicleSelect.value.toLowerCase();
    if (value === 'premium' || value === 'suv') return 'Premium';
    if (value === 'bike') return 'Bike';
    return 'Economy';
  }

  function findLocation(value) {
    const text = value.trim().toLowerCase();
    return locations.find((loc) => loc.Name.toLowerCase() === text);
  }

  function resetEstimate() {
    currentEstimate = null;
    fareAmount.textContent = '--';
    fareDistance.textContent = 'Select route';
    fareDuration.textContent = 'Select route';
  }

  function setButtonLoading(isLoading, text) {
    requestBtn.disabled = isLoading;
    requestBtn.classList.toggle('loading', isLoading);
    requestBtn.querySelector('.btn-text').textContent = text;
  }

  function setUserChrome() {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Rider';
    const initials = `${user.firstName?.[0] || 'R'}${user.lastName?.[0] || ''}`.toUpperCase();
    document.querySelectorAll('.navbar-user-name, .sidebar-user-name').forEach((el) => { el.textContent = fullName; });
    document.querySelectorAll('.navbar-avatar').forEach((el) => {
      if (user.ProfilePicture) {
        const src = user.ProfilePicture.startsWith('http') ? user.ProfilePicture : `http://localhost:5000${user.ProfilePicture}`;
        el.innerHTML = `<img src="${src}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
      } else {
        el.textContent = initials;
      }
    });
  }

  function showError(input, errorEl, msg) {
    input.classList.add('input-error');
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
  }

  function clearError(input, errorEl) {
    input.classList.remove('input-error');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
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
    mapImage.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    mapImage.style.transform = `scale(${mapZoom})`;
  }

  function formatMoney(value) {
    return `Rs. ${Number(value || 0).toFixed(2)}`;
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
