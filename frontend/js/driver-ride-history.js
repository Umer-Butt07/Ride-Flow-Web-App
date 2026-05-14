/* RideFlow — Driver Ride History JavaScript */
const API   = 'http://localhost:5000/api';
const storage = sessionStorage;
const token = storage.getItem('token') || localStorage.getItem('token');
const user  = JSON.parse(storage.getItem('user') || localStorage.getItem('user') || '{}');

if (!token || user.role !== 'Driver') window.location.href = '../auth/login.html';

document.addEventListener('DOMContentLoaded', () => {
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn   = document.getElementById('hamburgerBtn');
  const menuItems      = document.querySelectorAll('.sidebar-menu-item');
  const goOfflineBtn   = document.getElementById('goOfflineBtn');
  const logoutLink     = document.getElementById('logoutLink');
  const drhCards       = document.getElementById('drhCards');
  const drhEmpty       = document.getElementById('drhEmpty');
  const filterBtns     = document.querySelectorAll('.drh-filter');
  let allRides = [];

  function setDriverChrome() {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Driver';
    const initials = `${user.firstName?.[0] || 'D'}${user.lastName?.[0] || ''}`.toUpperCase();
    document.querySelectorAll('.driver-profile-name, .sidebar-driver-name').forEach(el => el.textContent = fullName);
    document.querySelectorAll('.driver-profile-avatar, .sidebar-avatar').forEach(el => {
      if (user.ProfilePicture) {
        const src = user.ProfilePicture.startsWith('http') ? user.ProfilePicture : `http://localhost:5000${user.ProfilePicture}`;
        el.innerHTML = `<img src="${src}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
      } else {
        el.textContent = initials;
      }
    });
  }

  setDriverChrome();

  logoutLink.addEventListener('click', (e) => { e.preventDefault(); storage.clear(); window.location.href = '../auth/login.html'; });

  // ── Load ride history from backend ──
  async function loadHistory() {
    try {
      drhCards.innerHTML = '';
      drhEmpty.style.display = '';
      const res  = await fetch(`${API}/driver/rides/history`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) return;
      allRides = data.rides || [];
      renderRides('all');
    } catch (err) { console.error('Ride history load failed:', err); }
  }

  function renderRides(filter) {
    const filtered = filter === 'all' ? allRides : allRides.filter(r => r.Status.toLowerCase() === filter);
    if (!filtered.length) { drhCards.innerHTML = ''; drhEmpty.style.display = ''; return; }
    drhEmpty.style.display = 'none';
    drhCards.innerHTML = filtered.map((r, i) => `
      <div class="drh-card${i===0?' featured':''}" data-status="${r.Status.toLowerCase()}">
        <div class="drh-card-header">
          <div>
            <div class="drh-card-date">${new Date(r.ScheduledTime||r.EndTime).toLocaleString()}</div>
            <div class="drh-status ${r.Status.toLowerCase()}">
              <span class="drh-status-dot"></span> ${r.Status}
            </div>
          </div>
          <span class="drh-card-amount">Rs. ${Number(r.Fare||0).toFixed(2)}</span>
        </div>
        <div class="drh-locations">
          <div class="drh-loc">
            <span class="drh-loc-dot"></span>
            <span class="drh-loc-label">Pickup</span>
            <span class="drh-loc-address">${r.PickupLocation||'—'}</span>
          </div>
          <div class="drh-loc dropoff">
            <span class="drh-loc-dot"></span>
            <span class="drh-loc-label">Drop-off</span>
            <span class="drh-loc-address">${r.DropoffLocation||'—'}</span>
          </div>
        </div>
        <div class="drh-stats-row">
          <div class="drh-stat"><span class="drh-stat-label">Distance</span><span class="drh-stat-value">${r.Distance||'—'} km</span></div>
          <div class="drh-stat"><span class="drh-stat-label">Duration</span><span class="drh-stat-value">${r.Duration||'—'} min</span></div>
          <div class="drh-stat"><span class="drh-stat-label">Type</span><span class="drh-stat-value">${r.RideType||'Economy'}</span></div>
        </div>
      </div>
    `).join('');
  }

  loadHistory();
  loadDriverProfile();

  // ── Load driver profile data for sidebar ──
  async function loadDriverProfile() {
    try {
      const res = await fetch(`${API}/driver/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok || !data.driver) return;
      const metaEl = document.querySelector('.sidebar-driver-meta');
      if (metaEl) {
        const ratingDisplay = data.driver.AvgRating != null ? Number(data.driver.AvgRating).toFixed(2) : '--';
        metaEl.innerHTML = `${ratingDisplay} Rating <span class="meta-dot" aria-hidden="true"></span> ${data.driver.AvailabilityStatus || 'Online'}`;
      }
      const pill = document.getElementById('earningsPill');
      if (pill) pill.textContent = `Rs. ${Number(data.todayStats?.earningsToday || 0).toFixed(2)}`;
    } catch (err) { console.error('Profile load failed:', err); }
  }

  // ── Filter Tabs ──
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
      btn.classList.add('active'); btn.setAttribute('aria-selected','true');
      renderRides(btn.dataset.filter);
    });
  });

  // ── Sidebar ──
  hamburgerBtn.addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  sidebarOverlay.addEventListener('click', closeSidebar);
  function openSidebar()  { sidebar.classList.add('open'); sidebarOverlay.classList.add('visible'); hamburgerBtn.setAttribute('aria-expanded','true'); document.body.style.overflow='hidden'; }
  function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); hamburgerBtn.setAttribute('aria-expanded','false'); document.body.style.overflow=''; }
  menuItems.forEach(item => item.addEventListener('click', (e) => { if (item.getAttribute('href') && item.getAttribute('href') !== '#') return; e.preventDefault(); menuItems.forEach(i=>i.classList.remove('active')); item.classList.add('active'); closeSidebar(); }));

  goOfflineBtn.addEventListener('click', () => {
    goOfflineBtn.textContent = 'Going Offline...'; goOfflineBtn.disabled = true;
    fetch(`${API}/driver/availability`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Offline' })
    }).catch(console.error);
    setTimeout(() => { window.location.href = 'driver-dashboard.html'; }, 800);
  });
});
