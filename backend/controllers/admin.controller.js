const pool = require('../db/connection');

// ─── GET /api/admin/users ─────────────────────────────────────────
const getUsers = async (req, res) => {
  const { role, status } = req.query;
  let query = `SELECT UserID, FirstName, LastName, Email, Phone, Role, AccountStatus, WalletBalance, RegDate FROM Users WHERE 1=1`;
  const params = [];
  if (role)   { query += ` AND Role = ?`;          params.push(role); }
  if (status) { query += ` AND AccountStatus = ?`; params.push(status); }
  query += ` ORDER BY RegDate DESC`;
  const [rows] = await pool.execute(query, params);
  return res.json(rows);
};

// ─── PATCH /api/admin/users/:id/status ───────────────────────────
const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['Active', 'Suspended', 'Banned'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
  }
  const [result] = await pool.execute(
    `UPDATE Users SET AccountStatus = ? WHERE UserID = ?`,
    [status, id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'User not found.' });
  return res.json({ message: `User status updated to ${status}.` });
};

// ─── GET /api/admin/drivers ───────────────────────────────────────
const getDrivers = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT d.DriverID, u.FirstName, u.LastName, u.Email, u.Phone,
            u.AccountStatus, d.LicenseNo, d.CNIC,
            d.VerificationStatus, d.AvailabilityStatus, d.AvgRating, d.TotalTrips,
            v.VehicleType, v.Make, v.Model, v.LicensePlate
     FROM Drivers d
     JOIN Users u ON d.DriverID = u.UserID
     LEFT JOIN Vehicles v ON v.DriverID = d.DriverID
     ORDER BY d.AvgRating DESC`
  );
  return res.json(rows);
};

// ─── PATCH /api/admin/drivers/:id/verify ─────────────────────────
const verifyDriver = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['Verified', 'Rejected', 'Pending'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
  }
  await pool.execute(
    `UPDATE Drivers SET VerificationStatus = ? WHERE DriverID = ?`,
    [status, id]
  );
  // Also verify their vehicle
  if (status === 'Verified') {
    await pool.execute(
      `UPDATE Vehicles SET VerificationStatus = 'Verified' WHERE DriverID = ?`,
      [id]
    );
  }
  return res.json({ message: `Driver verification status set to ${status}.` });
};

// ─── GET /api/admin/vehicles ──────────────────────────────────────
const getVehicles = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT v.VehicleID, v.VehicleType, v.Make, v.Model, v.Year,
            v.Color, v.LicensePlate, v.VerificationStatus,
            u.FirstName AS DriverFirstName, u.LastName AS DriverLastName,
            u.Email AS DriverEmail
     FROM Vehicles v
     JOIN Drivers d ON v.DriverID = d.DriverID
     JOIN Users   u ON d.DriverID = u.UserID
     ORDER BY v.VerificationStatus`
  );
  return res.json(rows);
};

// ─── GET /api/admin/complaints ────────────────────────────────────
const getComplaints = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT c.ComplaintID, c.Description, c.Status, c.CreatedAt,
            c.RideID,
            uf.FirstName AS FiledByFirstName, uf.LastName AS FiledByLastName, uf.Email AS FiledByEmail,
            ua.FirstName AS AgainstFirstName, ua.LastName AS AgainstLastName, ua.Email AS AgainstEmail
     FROM Complaints c
     JOIN Users uf ON c.FiledByUserID  = uf.UserID
     JOIN Users ua ON c.AgainstUserID  = ua.UserID
     ORDER BY c.CreatedAt DESC`
  );
  return res.json(rows);
};

// ─── PATCH /api/admin/complaints/:id ─────────────────────────────
const updateComplaintStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  await pool.execute(`UPDATE Complaints SET Status = ? WHERE ComplaintID = ?`, [status, id]);
  return res.json({ message: 'Complaint updated.' });
};

// ─── GET /api/admin/promos ────────────────────────────────────────
const getPromos = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT PromoID, Code, DiscountValue, ExpiryDate, UsageLimit, UsageCount, IsActive
     FROM Promo_Codes ORDER BY ExpiryDate DESC`
  );
  return res.json(rows);
};

// ─── POST /api/admin/promos ───────────────────────────────────────
const createPromo = async (req, res) => {
  const { code, discountValue, expiryDate, usageLimit } = req.body;
  if (!code || !discountValue || !expiryDate) {
    return res.status(400).json({ error: 'Code, discountValue, and expiryDate are required.' });
  }
  const [result] = await pool.execute(
    `INSERT INTO Promo_Codes (Code, DiscountValue, ExpiryDate, UsageLimit, UsageCount, IsActive)
     VALUES (?, ?, ?, ?, 0, 1)`,
    [code, discountValue, expiryDate, usageLimit || 100]
  );
  return res.status(201).json({ message: 'Promo code created.', promoId: result.insertId });
};

// ─── DELETE /api/admin/promos/:id ─────────────────────────────────
const deletePromo = async (req, res) => {
  await pool.execute(`UPDATE Promo_Codes SET IsActive = 0 WHERE PromoID = ?`, [req.params.id]);
  return res.json({ message: 'Promo code deactivated.' });
};

// ─── GET /api/admin/dashboard ─────────────────────────────────────
const getAdminDashboard = async (req, res) => {
  const [[userStats]]   = await pool.execute(`SELECT COUNT(*) AS total, SUM(Role='Rider') AS riders, SUM(Role='Driver') AS drivers FROM Users`);
  const [[rideStats]]   = await pool.execute(`SELECT COUNT(*) AS total, SUM(Status='Completed') AS completed, SUM(Status='Cancelled') AS cancelled FROM Rides`);
  const [[revenueStats]] = await pool.execute(`SELECT COALESCE(SUM(Amount),0) AS totalRevenue FROM Payments WHERE PaymentStatus='Paid'`);
  const [activeRides]   = await pool.execute(`SELECT COUNT(*) AS count FROM Rides WHERE Status IN ('EnRoute','InProgress')`);

  return res.json({
    users:       userStats,
    rides:       rideStats,
    revenue:     revenueStats,
    activeRides: activeRides[0].count,
  });
};

module.exports = {
  getUsers, updateUserStatus, getDrivers, verifyDriver,
  getVehicles, getComplaints, updateComplaintStatus,
  getPromos, createPromo, deletePromo, getAdminDashboard,
};
