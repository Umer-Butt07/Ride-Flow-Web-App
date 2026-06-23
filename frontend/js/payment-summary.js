/* ============================================
   RideFlow — Payment Summary Page JavaScript
   ============================================
   Features:
   • Payment method selection (radio behavior)
   • Confirm payment with loading + success overlay
   • Download receipt simulation
   • Sidebar toggle (mobile)
   • Navbar / sidebar tab syncing
   • Map zoom controls
   • Button ripple effects
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

    ? '${API_BASE_URL}'

    : 'https://your-backend-api.onrender.com';


  const API = `${API_BASE_URL}/api`;
  const storage = sessionStorage;
  const token = storage.getItem('token') || localStorage.getItem('token');
  const user = JSON.parse(storage.getItem('user') || localStorage.getItem('user') || '{}');

  if (!token || user.role !== 'Rider') {
    window.location.href = '../auth/login.html';
    return;
  }

  // ── DOM References ──
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn   = document.getElementById('hamburgerBtn');
  const navbarTabs     = document.querySelectorAll('.navbar-tab');
  const sidebarItems   = document.querySelectorAll('.sidebar-nav-item');
  const confirmBtn     = document.getElementById('confirmBtn');
  const successOverlay = document.getElementById('successOverlay');
  const backBtn        = document.getElementById('backDashboardBtn');
  const statusBadge    = document.getElementById('statusBadge');
  const receiptLink    = document.getElementById('receiptLink');
  const paymentOptions = document.querySelectorAll('.payment-option');
  const paymentAlts    = document.querySelectorAll('.payment-alt');
  const zoomInBtn      = document.getElementById('zoomInBtn');
  const zoomOutBtn     = document.getElementById('zoomOutBtn');
  const locationBtn    = document.getElementById('locationBtn');
  const mapImage       = document.querySelector('.map-image');

  let mapZoom = 1;
  const MAP_ZOOM_STEP = 0.15;
  const MAP_ZOOM_MIN  = 0.8;
  const MAP_ZOOM_MAX  = 2.0;

  let selectedMethod = 'card';
  let loadedRide = null;

  setUserChrome();
  loadRideSummary();

  // ============================================
  // SIDEBAR TOGGLE (Mobile)
  // ============================================
  hamburgerBtn.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  sidebarOverlay.addEventListener('click', closeSidebar);

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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });

  // ============================================
  // NAVBAR TAB SWITCHING
  // ============================================
  navbarTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      if (tab.getAttribute('href') && tab.getAttribute('href') !== '#') return;
      e.preventDefault();
      navbarTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
    });
  });

  // ============================================
  // SIDEBAR NAVIGATION
  // ============================================
  sidebarItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      if (item.getAttribute('href') && item.getAttribute('href') !== '#') return;
      e.preventDefault();
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      closeSidebar();
    });
  });

  // ============================================
  // PAYMENT METHOD SELECTION
  // ============================================
  function clearAllPaymentSelections() {
    paymentOptions.forEach(opt => {
      opt.classList.remove('selected');
      opt.setAttribute('aria-checked', 'false');
    });
    paymentAlts.forEach(alt => {
      alt.classList.remove('selected');
      alt.setAttribute('aria-checked', 'false');
    });
  }

  // Primary option (Card)
  paymentOptions.forEach((opt) => {
    opt.addEventListener('click', () => {
      clearAllPaymentSelections();
      opt.classList.add('selected');
      opt.setAttribute('aria-checked', 'true');
      selectedMethod = opt.dataset.method;
    });

    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        opt.click();
      }
    });
  });

  // Alt options (Cash, Wallet)
  paymentAlts.forEach((alt) => {
    alt.addEventListener('click', () => {
      clearAllPaymentSelections();
      alt.classList.add('selected');
      alt.setAttribute('aria-checked', 'true');
      selectedMethod = alt.dataset.method;
    });
  });

  // ============================================
  // ============================================
  // CONFIRM PAYMENT
  // ============================================
  confirmBtn.addEventListener('click', async (e) => {
    // Ripple effect
    createRipple(confirmBtn, e);

    confirmBtn.classList.add('loading');
    confirmBtn.disabled = true;

    try {
      if (loadedRide) {
        const method = selectedMethod === 'wallet' ? 'Wallet' : selectedMethod === 'cash' ? 'Cash' : 'Card';
        const payRes = await fetch(`${API}/rider/rides/${loadedRide.RideID}/pay`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethod: method })
        });
        const payData = await payRes.json();
        if (!payRes.ok) throw new Error(payData.error || 'Payment failed.');
      }
      confirmBtn.classList.remove('loading');
      confirmBtn.disabled = false;
      statusBadge.textContent = 'Paid';
      statusBadge.classList.remove('pending');
      statusBadge.classList.add('paid');
      successOverlay.classList.add('visible');

      // Prevent payment loop: clear currentRideId, pass to ratingRideId
      const currentId = storage.getItem('currentRideId') || (loadedRide ? loadedRide.RideID : null);
      if (currentId) {
        storage.setItem('ratingRideId', currentId);
        storage.removeItem('currentRideId');
      }
    } catch (err) {
      console.error('Payment failed:', err);
      confirmBtn.classList.remove('loading');
      confirmBtn.disabled = false;
      // Show error to user
      const errEl = document.querySelector('.payment-heading');
      if (errEl) errEl.textContent = err.message;
      setTimeout(() => { if (errEl) errEl.textContent = 'Payment Summary'; }, 3000);
    }
  });

  // ============================================
  // BACK TO DASHBOARD
  // ============================================
  backBtn.addEventListener('click', () => {
    window.location.href = 'rate-driver.html';
  });

  // ============================================
  // DOWNLOAD RECEIPT
  // ============================================
  receiptLink.addEventListener('click', (e) => {
    e.preventDefault();

    const originalText = receiptLink.innerHTML;
    receiptLink.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Downloaded!
    `;
    receiptLink.style.color = '#16a34a';

    setTimeout(() => {
      receiptLink.innerHTML = originalText;
      receiptLink.style.color = '';
    }, 2500);
  });

  // ============================================
  // MAP CONTROLS
  // ============================================
  zoomInBtn.addEventListener('click', () => {
    if (mapZoom < MAP_ZOOM_MAX) {
      mapZoom += MAP_ZOOM_STEP;
      applyMapZoom();
      pulseButton(zoomInBtn);
    }
  });

  zoomOutBtn.addEventListener('click', () => {
    if (mapZoom > MAP_ZOOM_MIN) {
      mapZoom -= MAP_ZOOM_STEP;
      applyMapZoom();
      pulseButton(zoomOutBtn);
    }
  });

  locationBtn.addEventListener('click', () => {
    mapZoom = 1;
    applyMapZoom();
    pulseButton(locationBtn);
  });

  function applyMapZoom() {
    mapImage.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    mapImage.style.transform = `scale(${mapZoom})`;
  }

  function pulseButton(btn) {
    btn.style.transform = 'scale(0.9)';
    setTimeout(() => { btn.style.transform = ''; }, 150);
  }

  async function loadRideSummary() {
    try {
      const rideId = Number(storage.getItem('currentRideId') || 0);
      const res = await fetch(`${API}/rider/rides/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const rides = await res.json();
      if (!res.ok || !Array.isArray(rides) || !rides.length) return;
      loadedRide = rides.find((ride) => Number(ride.RideID) === rideId) || rides[0];

      const detailValues = document.querySelectorAll('.detail-value');
      if (detailValues[0]) detailValues[0].textContent = loadedRide.PickupLocation || '-';
      if (detailValues[1]) detailValues[1].textContent = loadedRide.DropoffLocation || '-';

      const metaItems = document.querySelectorAll('.meta-item');
      const rideDate = loadedRide.EndTime || loadedRide.ScheduledTime;
      if (metaItems[0]) metaItems[0].lastChild.textContent = ` ${new Date(rideDate).toLocaleDateString()}`;
      if (metaItems[1]) metaItems[1].lastChild.textContent = ` ${new Date(rideDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      if (metaItems[2]) metaItems[2].lastChild.textContent = ` ${Number(loadedRide.Distance || 0).toFixed(1)} km`;
      if (metaItems[3]) metaItems[3].lastChild.textContent = ` ${Math.round(loadedRide.Duration || 0)} mins`;

      const driverName = `${loadedRide.DriverFirstName || ''} ${loadedRide.DriverLastName || ''}`.trim() || 'Driver';
      const driverNameEl = document.querySelector('.driver-name-text');
      if (driverNameEl) driverNameEl.textContent = driverName;

      // Show driver profile picture
      const driverAvatarEl = document.querySelector('.driver-avatar-sm');
      if (driverAvatarEl && loadedRide.DriverProfilePicture) {
        const src = loadedRide.DriverProfilePicture.startsWith('http') ? loadedRide.DriverProfilePicture : `${API_BASE_URL}${loadedRide.DriverProfilePicture}`;
        driverAvatarEl.innerHTML = `<img src="${src}" alt="Driver" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      }

      const driverVehicleEl = document.querySelector('.driver-vehicle-text');
      if (driverVehicleEl) driverVehicleEl.innerHTML = `${loadedRide.Make || ''} ${loadedRide.Model || loadedRide.VehicleType || ''} (${loadedRide.Color || '-'}) <span class="plate-badge">${loadedRide.LicensePlate || '-'}</span>`;

      const fareRows = document.querySelectorAll('.fare-row-value');
      if (fareRows[0]) fareRows[0].textContent = 'Included';
      if (fareRows[1]) fareRows[1].textContent = `${Number(loadedRide.Distance || 0).toFixed(1)} km`;
      if (fareRows[2]) fareRows[2].textContent = `${Math.round(loadedRide.Duration || 0)} mins`;
      if (fareRows[3]) fareRows[3].textContent = loadedRide.PromoCode || '-';

      document.querySelectorAll('.fare-total-value, .success-amount').forEach((el) => {
        el.textContent = `Rs. ${Number(loadedRide.Fare || 0).toFixed(2)}`;
      });

      // Don't auto-show "Paid" — rider still needs to confirm payment method
      // The sp_complete_ride may have inserted a payment, but rider should still choose method
      statusBadge.textContent = 'Pending';
      statusBadge.classList.add('pending');
      statusBadge.classList.remove('paid');
    } catch (err) {
      console.error('Payment summary load failed:', err);
    }
  }

  function setUserChrome() {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Rider';
    const initials = `${user.firstName?.[0] || 'R'}${user.lastName?.[0] || ''}`.toUpperCase();
    document.querySelectorAll('.navbar-user-name, .sidebar-user-name').forEach(el => { el.textContent = fullName; });
    document.querySelectorAll('.navbar-avatar').forEach(el => { el.textContent = initials; });
  }

  // ============================================
  // RIPPLE EFFECT HELPER
  // ============================================
  function createRipple(button, e) {
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'btn-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }
});
