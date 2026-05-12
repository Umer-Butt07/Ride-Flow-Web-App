/* ============================================
   RideFlow — Admin Dashboard JavaScript
   ============================================ */
const API   = 'http://localhost:5000/api';
const storage = sessionStorage;
const token = storage.getItem('token') || localStorage.getItem('token');
const user  = JSON.parse(storage.getItem('user') || localStorage.getItem('user') || '{}');

if (!token || user.role !== 'Admin') {
  window.location.href = '../auth/login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ── DOM refs ──
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const hamburgerBtn   = document.getElementById('hamburgerBtn');
  const sidebarLinks   = document.querySelectorAll('.sidebar-link');
  const logoutLink     = document.getElementById('logoutLink');
  const adminGreeting  = document.getElementById('adminGreeting');
  const adminName      = document.getElementById('adminName');
  const adminAvatar    = document.getElementById('adminAvatar');

  // Populate admin info
  if (user.firstName) {
    adminGreeting.textContent = user.firstName;
    adminName.textContent     = `${user.firstName} ${user.lastName || ''}`;
    adminAvatar.textContent   = (user.firstName[0] + (user.lastName?.[0] || '')).toUpperCase();
  }

  // ── Logout ──
  logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = '../auth/login.html';
  });

  // ── Sidebar toggle (mobile) ──
  hamburgerBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('visible');
  });
  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
  });

  // ── Section Navigation ──
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      if (!section) return;

      // Update active link
      sidebarLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Show section
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active-section'));
      const target = document.getElementById(`sec-${section}`);
      if (target) target.classList.add('active-section');

      // Load data for section
      loadSection(section);

      // Close sidebar on mobile
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('visible');
    });
  });

  // ── Helper: fetch with auth ──
  async function apiFetch(path, opts = {}) {
    opts.headers = { ...opts.headers, 'Authorization': `Bearer ${token}` };
    if (opts.body) opts.headers['Content-Type'] = 'application/json';
    const res = await fetch(`${API}${path}`, opts);
    return res;
  }

  // ── Load section data ──
  function loadSection(name) {
    switch (name) {
      case 'overview':    loadOverview(); break;
      case 'users':       loadUsers(); break;
      case 'drivers':     loadDrivers(); break;
      case 'vehicles':    loadVehicles(); break;
      case 'complaints':  loadComplaints(); break;
      case 'promos':      loadPromos(); break;
      case 'reports':     loadReports(); break;
    }
  }

  // ════════════════════════════════════════════
  // OVERVIEW
  // ════════════════════════════════════════════
  async function loadOverview() {
    try {
      const res  = await apiFetch('/admin/dashboard');
      const data = await res.json();

      document.getElementById('statTotalUsers').textContent  = data.users?.total ?? '-';
      document.getElementById('statRiders').textContent      = data.users?.riders ?? 0;
      document.getElementById('statDrivers').textContent     = data.users?.drivers ?? 0;
      document.getElementById('statTotalRides').textContent  = data.rides?.total ?? '-';
      document.getElementById('statCompleted').textContent   = data.rides?.completed ?? 0;
      document.getElementById('statCancelled').textContent   = data.rides?.cancelled ?? 0;
      document.getElementById('statRevenue').textContent     = `Rs${Number(data.revenue?.totalRevenue ?? 0).toLocaleString()}`;
      document.getElementById('statActiveRides').textContent = data.activeRides ?? '-';

      // Load recent users for overview
      const usersRes  = await apiFetch('/admin/users');
      const usersData = await usersRes.json();
      const recent = usersData.slice(0, 5);
      document.getElementById('recentUsersBadge').textContent = `${usersData.length} users`;

      const tbody = document.getElementById('recentUsersBody');
      if (!recent.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="empty-state-icon">--</div><div class="empty-state-text">No users yet</div></td></tr>';
        return;
      }
      tbody.innerHTML = recent.map(u => `
        <tr>
          <td>${u.FirstName} ${u.LastName}</td>
          <td>${u.Email}</td>
          <td><span class="role-${u.Role.toLowerCase()}">${u.Role}</span></td>
          <td><span class="badge badge-${u.AccountStatus.toLowerCase()}">${u.AccountStatus}</span></td>
          <td>${new Date(u.RegDate).toLocaleDateString()}</td>
        </tr>
      `).join('');
    } catch (err) { console.error('Overview load failed:', err); }
  }

  // ════════════════════════════════════════════
  // USERS
  // ════════════════════════════════════════════
  let allUsers = [];

  async function loadUsers() {
    try {
      const res  = await apiFetch('/admin/users');
      allUsers   = await res.json();
      document.getElementById('allUsersBadge').textContent = `${allUsers.length} users`;
      renderUsers('all');
    } catch (err) { console.error('Users load failed:', err); }
  }

  function renderUsers(roleFilter) {
    const filtered = roleFilter === 'all' ? allUsers : allUsers.filter(u => u.Role === roleFilter);
    const tbody    = document.getElementById('usersTableBody');

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-state-icon">--</div><div>No users found</div></td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(u => `
      <tr>
        <td>${u.UserID}</td>
        <td>${u.FirstName} ${u.LastName}</td>
        <td>${u.Email}</td>
        <td>${u.Phone}</td>
        <td><span class="role-${u.Role.toLowerCase()}">${u.Role}</span></td>
        <td><span class="badge badge-${u.AccountStatus.toLowerCase()}">${u.AccountStatus}</span></td>
        <td>$${Number(u.WalletBalance || 0).toFixed(2)}</td>
        <td class="actions-cell">
          ${u.AccountStatus === 'Active' ? `
            <button class="action-btn suspend" onclick="updateUserStatus(${u.UserID}, 'Suspended')">Suspend</button>
            <button class="action-btn ban" onclick="updateUserStatus(${u.UserID}, 'Banned')">Ban</button>
          ` : ''}
          ${u.AccountStatus === 'Suspended' ? `
            <button class="action-btn activate" onclick="updateUserStatus(${u.UserID}, 'Active')">Activate</button>
            <button class="action-btn ban" onclick="updateUserStatus(${u.UserID}, 'Banned')">Ban</button>
          ` : ''}
          ${u.AccountStatus === 'Banned' ? `
            <button class="action-btn activate" onclick="updateUserStatus(${u.UserID}, 'Active')">Activate</button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  }

  // User filter tabs
  document.querySelectorAll('#sec-users .panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#sec-users .panel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderUsers(tab.dataset.role);
    });
  });

  // Global: update user status
  window.updateUserStatus = async (userId, status) => {
    if (!confirm(`Set user ${userId} to ${status}?`)) return;
    try {
      await apiFetch(`/admin/users/${userId}/status`, {
        method: 'PATCH', body: JSON.stringify({ status })
      });
      loadUsers();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  // ════════════════════════════════════════════
  // DRIVERS
  // ════════════════════════════════════════════
  async function loadDrivers() {
    try {
      const res  = await apiFetch('/admin/drivers');
      const data = await res.json();
      document.getElementById('driversBadge').textContent = `${data.length} drivers`;
      const tbody = document.getElementById('driversTableBody');

      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-state-icon">--</div><div>No drivers yet</div></td></tr>';
        return;
      }

      tbody.innerHTML = data.map(d => `
        <tr>
          <td>${d.DriverID}</td>
          <td>${d.FirstName} ${d.LastName}</td>
          <td>${d.LicenseNo}</td>
          <td>${d.CNIC}</td>
          <td><span class="badge badge-${d.VerificationStatus.toLowerCase()}">${d.VerificationStatus}</span></td>
          <td>${d.AvgRating ?? '-'}</td>
          <td>${d.TotalTrips ?? 0}</td>
          <td class="actions-cell">
            ${d.VerificationStatus !== 'Verified' ? `<button class="action-btn verify" onclick="verifyDriver(${d.DriverID}, 'Verified')">Verify</button>` : ''}
            ${d.VerificationStatus !== 'Rejected' ? `<button class="action-btn reject" onclick="verifyDriver(${d.DriverID}, 'Rejected')">Reject</button>` : ''}
          </td>
        </tr>
      `).join('');
    } catch (err) { console.error('Drivers load failed:', err); }
  }

  window.verifyDriver = async (driverId, status) => {
    if (!confirm(`Set driver ${driverId} to ${status}?`)) return;
    try {
      await apiFetch(`/admin/drivers/${driverId}/verify`, {
        method: 'PATCH', body: JSON.stringify({ status })
      });
      loadDrivers();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  // ════════════════════════════════════════════
  // VEHICLES
  // ════════════════════════════════════════════
  async function loadVehicles() {
    try {
      const res  = await apiFetch('/admin/vehicles');
      const data = await res.json();
      document.getElementById('vehiclesBadge').textContent = `${data.length} vehicles`;
      const tbody = document.getElementById('vehiclesTableBody');

      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-state-icon">--</div><div>No vehicles registered</div></td></tr>';
        return;
      }

      tbody.innerHTML = data.map(v => `
        <tr>
          <td>${v.VehicleID}</td>
          <td>${v.VehicleType}</td>
          <td>${v.Make} ${v.Model}</td>
          <td>${v.Year}</td>
          <td>${v.Color}</td>
          <td>${v.LicensePlate}</td>
          <td>${v.DriverFirstName} ${v.DriverLastName}</td>
          <td><span class="badge badge-${v.VerificationStatus.toLowerCase()}">${v.VerificationStatus}</span></td>
        </tr>
      `).join('');
    } catch (err) { console.error('Vehicles load failed:', err); }
  }

  // ════════════════════════════════════════════
  // COMPLAINTS
  // ════════════════════════════════════════════
  async function loadComplaints() {
    try {
      const res  = await apiFetch('/admin/complaints');
      const data = await res.json();
      document.getElementById('complaintsBadge').textContent = `${data.length} complaints`;
      const tbody = document.getElementById('complaintsTableBody');

      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-state-icon">--</div><div>No complaints</div></td></tr>';
        return;
      }

      tbody.innerHTML = data.map(c => `
        <tr>
          <td>${c.ComplaintID}</td>
          <td>${c.FiledByFirstName} ${c.FiledByLastName}</td>
          <td>${c.AgainstFirstName} ${c.AgainstLastName}</td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.Description}</td>
          <td><span class="badge badge-${c.Status.toLowerCase()}">${c.Status}</span></td>
          <td>${new Date(c.CreatedAt).toLocaleDateString()}</td>
          <td class="actions-cell">
            ${c.Status === 'Open' ? `<button class="action-btn resolve" onclick="resolveComplaint(${c.ComplaintID})">Resolve</button>` : ''}
          </td>
        </tr>
      `).join('');
    } catch (err) { console.error('Complaints load failed:', err); }
  }

  window.resolveComplaint = async (id) => {
    if (!confirm('Mark complaint as Resolved?')) return;
    try {
      await apiFetch(`/admin/complaints/${id}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'Resolved' })
      });
      loadComplaints();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  // ════════════════════════════════════════════
  // PROMO CODES
  // ════════════════════════════════════════════
  async function loadPromos() {
    try {
      const res  = await apiFetch('/admin/promos');
      const data = await res.json();
      document.getElementById('promosBadge').textContent = `${data.length} promos`;
      const tbody = document.getElementById('promosTableBody');

      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-state-icon">--</div><div>No promo codes</div></td></tr>';
        return;
      }

      tbody.innerHTML = data.map(p => `
        <tr>
          <td>${p.PromoID}</td>
          <td><strong>${p.Code}</strong></td>
          <td>${p.DiscountValue}%</td>
          <td>${new Date(p.ExpiryDate).toLocaleDateString()}</td>
          <td>${p.UsageCount} / ${p.UsageLimit}</td>
          <td><span class="badge ${p.IsActive ? 'badge-active' : 'badge-banned'}">${p.IsActive ? 'Active' : 'Inactive'}</span></td>
          <td class="actions-cell">
            ${p.IsActive ? `<button class="action-btn ban" onclick="deactivatePromo(${p.PromoID})">Deactivate</button>` : ''}
          </td>
        </tr>
      `).join('');
    } catch (err) { console.error('Promos load failed:', err); }
  }

  // Add new promo
  document.getElementById('promoSubmitBtn').addEventListener('click', async () => {
    const code     = document.getElementById('promoCode').value.trim();
    const discount = document.getElementById('promoDiscount').value;
    const expiry   = document.getElementById('promoExpiry').value;
    const limit    = document.getElementById('promoLimit').value || 100;

    if (!code || !discount || !expiry) { alert('Fill in Code, Discount, and Expiry.'); return; }

    try {
      await apiFetch('/admin/promos', {
        method: 'POST',
        body: JSON.stringify({ code, discountValue: Number(discount), expiryDate: expiry, usageLimit: Number(limit) })
      });
      document.getElementById('promoCode').value = '';
      document.getElementById('promoDiscount').value = '';
      document.getElementById('promoExpiry').value = '';
      document.getElementById('promoLimit').value = '';
      loadPromos();
    } catch (err) { alert('Failed: ' + err.message); }
  });

  window.deactivatePromo = async (id) => {
    if (!confirm('Deactivate this promo code?')) return;
    try {
      await apiFetch(`/admin/promos/${id}`, { method: 'DELETE' });
      loadPromos();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  // ════════════════════════════════════════════
  // REPORTS (Live analytics from backend)
  // ════════════════════════════════════════════
  async function loadReports() {
    try {
      // Revenue by City
      const cityRes  = await apiFetch('/reports/revenue-by-city');
      const cityData = await cityRes.json();
      const cityTbody = document.getElementById('revenueByCityBody');
      if (!cityData.length) {
        cityTbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div>No revenue data</div></td></tr>';
      } else {
        cityTbody.innerHTML = cityData.map(r => `
          <tr>
            <td>${r.City}</td>
            <td>${r.totalRides}</td>
            <td>$${Number(r.totalRevenue || 0).toFixed(2)}</td>
            <td>$${Number(r.avgFare || 0).toFixed(2)}</td>
            <td>$${Number(r.platformCommission || 0).toFixed(2)}</td>
          </tr>
        `).join('');
      }

      // Revenue by Payment Method
      const payRes  = await apiFetch('/reports/revenue-by-payment');
      const payData = await payRes.json();
      const payTbody = document.getElementById('revenueByPaymentBody');
      if (!payData.length) {
        payTbody.innerHTML = '<tr><td colspan="4" class="empty-state"><div>No payment data</div></td></tr>';
      } else {
        payTbody.innerHTML = payData.map(r => `
          <tr>
            <td><span class="badge badge-active">${r.PaymentMethod}</span></td>
            <td>${r.transactionCount}</td>
            <td>$${Number(r.totalRevenue || 0).toFixed(2)}</td>
            <td>$${Number(r.avgAmount || 0).toFixed(2)}</td>
          </tr>
        `).join('');
      }

      // Driver Earnings
      const earnRes  = await apiFetch('/reports/driver-earnings');
      const earnData = await earnRes.json();
      const earnTbody = document.getElementById('driverEarningsBody');
      if (!earnData.length) {
        earnTbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div>No earnings data</div></td></tr>';
      } else {
        earnTbody.innerHTML = earnData.map(r => `
          <tr>
            <td>${r.FirstName} ${r.LastName}</td>
            <td>${r.Email}</td>
            <td>${r.totalRides}</td>
            <td>$${Number(r.totalFare || 0).toFixed(2)}</td>
            <td>$${Number(r.totalCommission || 0).toFixed(2)}</td>
            <td>$${Number(r.totalNetEarning || 0).toFixed(2)}</td>
            <td>$${Number(r.currentBalance || 0).toFixed(2)}</td>
          </tr>
        `).join('');
      }

      // Leaderboard (Top Drivers)
      const leadRes  = await apiFetch('/reports/top-drivers');
      const leadData = await leadRes.json();
      const leadTbody = document.getElementById('leaderboardBody');
      if (!leadData.length) {
        leadTbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div>No leaderboard data</div></td></tr>';
      } else {
        leadTbody.innerHTML = leadData.map((d, i) => `
          <tr>
            <td><strong>#${i + 1}</strong></td>
            <td>${d.FirstName} ${d.LastName}</td>
            <td>${d.AvgRating}</td>
            <td>${d.TotalTrips}</td>
            <td>${d.Make || '—'} ${d.Model || ''}</td>
            <td><span class="badge badge-${d.AvailabilityStatus === 'Online' ? 'active' : 'suspended'}">${d.AvailabilityStatus}</span></td>
          </tr>
        `).join('');
      }
    } catch (err) { console.error('Reports load failed:', err); }
  }

  // ── Initial load ──
  loadOverview();
});
