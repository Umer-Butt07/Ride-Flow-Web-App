/* ============================================
   RideFlow — Rate Driver Page JavaScript
   ============================================
   Features:
   • Interactive star rating (hover + click)
   • Feedback tag selection (multi-select)
   • Submit rating with loading + success overlay
   • Skip to dashboard
   • Sidebar toggle (mobile)
   • Navbar / sidebar syncing
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
  const starBtns       = document.querySelectorAll('.star-btn');
  const starHelper     = document.getElementById('starHelper');
  const feedbackTags   = document.querySelectorAll('.feedback-tag');
  const submitBtn      = document.getElementById('submitRatingBtn');
  const successOverlay = document.getElementById('successOverlay');
  const successStars   = document.getElementById('successStars');
  const backHomeBtn    = document.getElementById('backHomeBtn');
  const zoomInBtn      = document.getElementById('zoomInBtn');
  const zoomOutBtn     = document.getElementById('zoomOutBtn');
  const locationBtn    = document.getElementById('locationBtn');
  const mapImage       = document.querySelector('.map-image');

  const skipLink       = document.getElementById('skipLink');

  let selectedRating = 0;
  let selectedTags = new Set();
  let loadedRide = null;
  let mapZoom = 1;
  const MAP_ZOOM_STEP = 0.15;
  const MAP_ZOOM_MIN  = 0.8;
  const MAP_ZOOM_MAX  = 2.0;

  const ratingLabels = [
    '',
    'Poor',
    'Fair',
    'Good',
    'Great',
    'Excellent!'
  ];

  setUserChrome();
  loadRideToRate();

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
  // INTERACTIVE STAR RATING
  // ============================================
  function updateStars(rating, isHover = false) {
    starBtns.forEach((btn) => {
      const val = parseInt(btn.dataset.value);
      if (isHover) {
        btn.classList.toggle('hover', val <= rating);
      } else {
        btn.classList.toggle('active', val <= rating);
        btn.classList.remove('hover');
      }
    });
  }

  // Hover effect
  starBtns.forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
      const val = parseInt(btn.dataset.value);
      updateStars(val, true);
      starHelper.textContent = ratingLabels[val];
    });

    btn.addEventListener('mouseleave', () => {
      updateStars(0, true); // Clear hover
      if (selectedRating > 0) {
        starHelper.textContent = ratingLabels[selectedRating];
      } else {
        starHelper.textContent = 'Tap to rate your ride';
      }
    });

    // Click to set rating
    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.dataset.value);
      updateStars(selectedRating);
      starHelper.textContent = ratingLabels[selectedRating];
    });

    // Keyboard support
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  // ============================================
  // FEEDBACK TAGS (Multi-select)
  // ============================================
  feedbackTags.forEach((tag) => {
    tag.addEventListener('click', () => {
      const tagValue = tag.dataset.tag;
      if (selectedTags.has(tagValue)) {
        selectedTags.delete(tagValue);
        tag.classList.remove('selected');
      } else {
        selectedTags.add(tagValue);
        tag.classList.add('selected');
      }
    });
  });

  // ============================================
  // SUBMIT RATING
  // ============================================
  submitBtn.addEventListener('click', async (e) => {
    // Ripple
    createRipple(submitBtn, e);

    // Loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    if (loadedRide) {
      const textVal = document.getElementById('feedbackText').value.trim();
      const tagsVal = Array.from(selectedTags).join(', ');
      const comment = textVal ? (tagsVal ? `${tagsVal} - ${textVal}` : textVal) : tagsVal;
      try {
        await fetch(`${API}/rider/rides/${loadedRide.RideID}/rate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: selectedRating || 5, comment })
        });
        storage.removeItem('ratingRideId');
      } catch (err) {
        console.error('Rating failed:', err);
      }
    }

    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;

    // Populate success stars
    renderSuccessStars();

    // Show success overlay
    successOverlay.classList.add('visible');
  });

  function renderSuccessStars() {
    successStars.innerHTML = '';
    const count = selectedRating || 5;
    for (let i = 0; i < count; i++) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.innerHTML = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
      successStars.appendChild(svg);
    }
  }

  // ============================================
  // BACK TO DASHBOARD
  // ============================================
  backHomeBtn.addEventListener('click', () => {
    storage.removeItem('ratingRideId');
    window.location.href = 'rider-dashboard.html';
  });

  if (skipLink) {
    skipLink.addEventListener('click', () => {
      storage.removeItem('ratingRideId');
    });
  }

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

  async function loadRideToRate() {
    try {
      const res = await fetch(`${API}/rider/rides/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const rides = await res.json();
      if (!res.ok || !Array.isArray(rides) || !rides.length) return;
      
      const targetId = Number(storage.getItem('ratingRideId'));
      loadedRide = rides.find(r => r.RideID === targetId) || rides[0];

      const driverName = `${loadedRide.DriverFirstName || ''} ${loadedRide.DriverLastName || ''}`.trim() || 'Driver';
      const initials = `${loadedRide.DriverFirstName?.[0] || 'D'}${loadedRide.DriverLastName?.[0] || ''}`.toUpperCase();
      
      const nameEl = document.querySelector('.driver-profile-name');
      const avatarEl = document.querySelector('.driver-avatar-rating');
      const vehicleEl = document.querySelector('.driver-profile-vehicle');
      const fareEl = document.querySelector('.trip-fare-amount');
      const locEls = document.querySelectorAll('.trip-location-address');

      if (nameEl) nameEl.textContent = driverName;
      if (avatarEl) {
        if (loadedRide.DriverProfilePicture) {
          const src = loadedRide.DriverProfilePicture.startsWith('http') ? loadedRide.DriverProfilePicture : `${API_BASE_URL}${loadedRide.DriverProfilePicture}`;
          avatarEl.innerHTML = `<img src="${src}" alt="Driver" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
          avatarEl.textContent = initials;
        }
      }
      if (vehicleEl) vehicleEl.textContent = `${loadedRide.Make || ''} ${loadedRide.Model || ''} • ${loadedRide.Color || ''} • ${loadedRide.LicensePlate || ''}`;
      if (fareEl) fareEl.textContent = `Rs. ${Number(loadedRide.Fare || 0).toFixed(2)}`;
      
      if (locEls[0]) locEls[0].textContent = loadedRide.PickupLocation || '-';
      if (locEls[1]) locEls[1].textContent = loadedRide.DropoffLocation || '-';
      
      const metaDiv = document.querySelector('.trip-meta');
      if (metaDiv) {
        metaDiv.innerHTML = `<span>${Number(loadedRide.Distance || 0).toFixed(1)} km distance</span><span class="trip-meta-dot" aria-hidden="true"></span><span>${Math.round(loadedRide.Duration || 0)} mins duration</span>`;
      }
    } catch (err) {
      console.error('Failed to load ride:', err);
    }
  }

  function setUserChrome() {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Rider';
    const initials = `${user.firstName?.[0] || 'R'}${user.lastName?.[0] || ''}`.toUpperCase();
    document.querySelectorAll('.navbar-user-name, .sidebar-user-name').forEach(el => { el.textContent = fullName; });
    document.querySelectorAll('.navbar-avatar').forEach(el => { el.textContent = initials; });
  }
});
