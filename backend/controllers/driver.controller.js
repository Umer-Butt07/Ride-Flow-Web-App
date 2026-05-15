const pool = require('../db/connection');

// ─── GET /api/driver/dashboard ────────────────────────────────────
// Driver's main dashboard: today's stats + current status
const getDashboard = async (req, res) => {
  const driverId = req.user.userId;

  // Driver profile + availability
  const [driverRows] = await pool.execute(
    `SELECT d.AvailabilityStatus, d.AvgRating, d.TotalTrips, d.VerificationStatus, d.City,
            u.FirstName, u.LastName, u.Email, u.Phone, u.WalletBalance
     FROM Drivers d JOIN Users u ON d.DriverID = u.UserID
     WHERE d.DriverID = ?`,
    [driverId]
  );
  if (!driverRows.length) return res.status(404).json({ error: 'Driver not found.' });

  // Today's earnings
  const [earningsRows] = await pool.execute(
    `SELECT
       COUNT(*)           AS tripsToday,
       COALESCE(SUM(NetEarning), 0) AS earningsToday
     FROM Driver_Earnings de
     JOIN Rides r ON de.RideID = r.RideID
     WHERE de.DriverID = ? AND DATE(r.EndTime) = CURDATE()`,
    [driverId]
  );

  // Active ride (if any)
  const [activeRide] = await pool.execute(
    `SELECT r.RideID, r.Status, r.Fare, r.Distance, r.Duration,
            u.FirstName AS RiderFirstName, u.LastName AS RiderLastName, u.Phone AS RiderPhone,
            pl.Name AS PickupLocation, dl.Name AS DropoffLocation
     FROM Rides r
     JOIN Users u    ON r.RiderID = u.UserID
     JOIN Locations pl ON r.PickupLocationID  = pl.LocationID
     JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
     WHERE r.DriverID = ? AND r.Status IN ('EnRoute', 'InProgress')
     LIMIT 1`,
    [driverId]
  );

  return res.json({
    driver:      driverRows[0],
    todayStats:  earningsRows[0],
    activeRide:  activeRide[0] || null,
  });
};

// ─── PATCH /api/driver/availability ───────────────────────────────
const setAvailability = async (req, res) => {
  const driverId = req.user.userId;
  const { status } = req.body;

  const allowed = ['Online', 'Offline'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Status must be Online or Offline.' });
  }

  if (status === 'Online') {
    const [driverCheck] = await pool.execute(
      `SELECT VerificationStatus FROM Drivers WHERE DriverID = ?`,
      [driverId]
    );
    if (!driverCheck.length || driverCheck[0].VerificationStatus !== 'Verified') {
      return res.status(403).json({ error: 'You must be verified by an admin to go online.' });
    }
  }

  // Cannot go offline while on a trip
  const [activeRide] = await pool.execute(
    `SELECT RideID FROM Rides WHERE DriverID = ? AND Status IN ('EnRoute','InProgress') LIMIT 1`,
    [driverId]
  );
  if (activeRide.length && status === 'Offline') {
    return res.status(400).json({ error: 'Cannot go offline while on an active ride.' });
  }

  await pool.execute(
    `UPDATE Drivers SET AvailabilityStatus = ? WHERE DriverID = ?`,
    [status, driverId]
  );
  return res.json({ message: `Status updated to ${status}.` });
};

// ─── GET /api/driver/requests ─────────────────────────────────────
// Pending ride requests assigned to this driver
const getRequests = async (req, res) => {
  const driverId = req.user.userId;
  const [driverRows] = await pool.execute(
    `SELECT AvailabilityStatus FROM Drivers WHERE DriverID = ?`,
    [driverId]
  );
  if (!driverRows.length) return res.status(404).json({ error: 'Driver not found.' });
  if (driverRows[0].AvailabilityStatus !== 'Online') {
    return res.json({ driverStatus: driverRows[0].AvailabilityStatus, requests: [] });
  }

  const [rows] = await pool.execute(
    `SELECT rr.RequestID, rr.RequestDate, rr.Status,
            rr.RequestedVehicleType, rr.EstimatedFare, rr.EstimatedDistance, rr.EstimatedDuration,
            u.FirstName AS RiderFirstName, u.LastName AS RiderLastName, u.Phone AS RiderPhone,
            COALESCE(riderStats.CompletedRides, 0) AS RiderCompletedRides,
            COALESCE(riderStats.AvgRating, 0) AS RiderRating,
            pl.Name AS PickupLocation, pl.City AS PickupCity,
            dl.Name AS DropoffLocation, dl.City AS DropoffCity
     FROM Ride_Requests rr
     JOIN Users     u  ON rr.RiderID           = u.UserID
     JOIN Locations pl ON rr.PickupLocationID  = pl.LocationID
     JOIN Locations dl ON rr.DropoffLocationID = dl.LocationID
     LEFT JOIN (
       SELECT r.RiderID,
              COUNT(CASE WHEN r.Status = 'Completed' THEN 1 END) AS CompletedRides,
              AVG(rt.Score) AS AvgRating
       FROM Rides r
       LEFT JOIN Ratings rt ON rt.RatedUserID = r.RiderID
       GROUP BY r.RiderID
     ) riderStats ON riderStats.RiderID = rr.RiderID
     WHERE rr.DriverID = ? AND rr.Status = 'Requested'
     ORDER BY rr.RequestDate DESC`,
    [driverId]
  );
  return res.json({ requests: rows });
};

// ─── PATCH /api/driver/requests/:id/accept ────────────────────────
const acceptRequest = async (req, res) => {
  const driverId  = req.user.userId;
  const requestId = req.params.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Validate request belongs to this driver and is still pending
    const [reqRows] = await conn.execute(
      `SELECT rr.*, d.AvailabilityStatus
       FROM Ride_Requests rr
       JOIN Drivers d ON d.DriverID = rr.DriverID
       WHERE rr.RequestID = ? AND rr.DriverID = ? AND rr.Status = 'Requested'
       FOR UPDATE`,
      [requestId, driverId]
    );
    if (!reqRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ride request not found or already handled.' });
    }
    const rideReq = reqRows[0];
    if (rideReq.AvailabilityStatus !== 'Online') {
      await conn.rollback();
      return res.status(409).json({ error: 'You must be online to accept ride requests.' });
    }

    // Get driver's verified vehicle
    const [vehicleRows] = await conn.execute(
      `SELECT VehicleID, VehicleType
       FROM Vehicles
       WHERE DriverID = ?
         AND VerificationStatus = 'Verified'
         AND VehicleType = ?
       LIMIT 1`,
      [driverId, rideReq.RequestedVehicleType || 'Economy']
    );
    if (!vehicleRows.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'No verified vehicle found.' });
    }
    const vehicleId = vehicleRows[0].VehicleID;

    const fare = Number(rideReq.EstimatedFare || 0);
    const distance = Number(rideReq.EstimatedDistance || 0);
    const duration = Number(rideReq.EstimatedDuration || 0);

    // Accept the request
    await conn.execute(
      `UPDATE Ride_Requests SET Status = 'Accepted' WHERE RequestID = ?`,
      [requestId]
    );

    // Create Ride
    const [rideResult] = await conn.execute(
      `INSERT INTO Rides (RequestID, RiderID, DriverID, VehicleID,
         PickupLocationID, DropoffLocationID, PromoID, Fare, Distance, Duration, ScheduledTime, Status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'EnRoute')`,
      [requestId, rideReq.RiderID, driverId, vehicleId,
       rideReq.PickupLocationID, rideReq.DropoffLocationID, rideReq.PromoID,
       fare, distance, duration]
    );

    // Set driver to OnTrip
    await conn.execute(
      `UPDATE Drivers SET AvailabilityStatus = 'OnTrip' WHERE DriverID = ?`,
      [driverId]
    );

    await conn.commit();
    return res.json({
      message: 'Ride request accepted.',
      rideId: rideResult.insertId,
      fare,
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ─── PATCH /api/driver/requests/:id/reject ────────────────────────
// If rejected, auto-reassign to next available driver
const rejectRequest = async (req, res) => {
  const driverId  = req.user.userId;
  const requestId = req.params.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get the request details before rejecting
    const [reqRows] = await conn.execute(
      `SELECT * FROM Ride_Requests WHERE RequestID = ? AND DriverID = ? AND Status = 'Requested'`,
      [requestId, driverId]
    );
    if (!reqRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ride request not found or already handled.' });
    }
    const rideReq = reqRows[0];

    // Reject current request
    await conn.execute(
      `UPDATE Ride_Requests SET Status = 'Rejected' WHERE RequestID = ?`,
      [requestId]
    );

    // Find next available driver (excluding the one who just rejected)
    // Filter by city: next driver must be in the same city as the pickup location
    const [nextDriver] = await conn.execute(
      `SELECT d.DriverID FROM Drivers d
       JOIN Users u ON d.DriverID = u.UserID
       JOIN Locations pl ON pl.LocationID = ?
       WHERE d.AvailabilityStatus = 'Online'
         AND d.VerificationStatus = 'Verified'
         AND u.AccountStatus = 'Active'
         AND d.DriverID != ?
         AND d.City = pl.City
       ORDER BY d.AvgRating DESC
       LIMIT 1`,
      [rideReq.PickupLocationID, driverId]
    );

    let reassigned = false;
    let newRequestId = null;

    if (nextDriver.length) {
      // Create a new request for the next driver
      const [newReq] = await conn.execute(
        `INSERT INTO Ride_Requests (RiderID, DriverID, RequestDate, Status, PickupLocationID, DropoffLocationID)
         VALUES (?, ?, NOW(), 'Requested', ?, ?)`,
        [rideReq.RiderID, nextDriver[0].DriverID, rideReq.PickupLocationID, rideReq.DropoffLocationID]
      );
      reassigned = true;
      newRequestId = newReq.insertId;
    }

    await conn.commit();
    return res.json({
      message: reassigned
        ? 'Ride request rejected. Reassigned to another driver.'
        : 'Ride request rejected. No other drivers available.',
      reassigned,
      newRequestId,
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// ─── GET /api/driver/current-ride ─────────────────────────────────
const getCurrentRide = async (req, res) => {
  const driverId = req.user.userId;
  const [rows] = await pool.execute(
    `SELECT r.RideID, r.Status, r.Fare, r.Distance, r.Duration,
            r.ScheduledTime, r.StartTime,
            u.FirstName AS RiderFirstName, u.LastName AS RiderLastName,
            u.Phone     AS RiderPhone,
            pl.Name AS PickupLocation,  pl.City AS PickupCity,
            pl.Latitude AS PickupLat,  pl.Longitude AS PickupLng,
            dl.Name AS DropoffLocation, dl.City AS DropoffCity,
            dl.Latitude AS DropoffLat, dl.Longitude AS DropoffLng,
            v.Make, v.Model, v.Color, v.LicensePlate, v.VehicleType
     FROM Rides r
     JOIN Users     u  ON r.RiderID           = u.UserID
     JOIN Locations pl ON r.PickupLocationID  = pl.LocationID
     JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
     JOIN Vehicles  v  ON r.VehicleID         = v.VehicleID
     WHERE r.DriverID = ? AND r.Status IN ('EnRoute','InProgress')
     LIMIT 1`,
    [driverId]
  );
  if (!rows.length) return res.status(404).json({ error: 'No active ride found.' });
  return res.json({ ride: rows[0] });
};

// ─── PATCH /api/driver/rides/:id/status ───────────────────────────
// Update ride status: EnRoute → InProgress → Completed / Cancelled
const updateRideStatus = async (req, res) => {
  const driverId = req.user.userId;
  const rideId   = req.params.id;
  const { status, paymentMethod } = req.body;

  const allowed = ['InProgress', 'Completed', 'Cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
  }

  // Verify ride belongs to this driver
  const [rideRows] = await pool.execute(
    `SELECT * FROM Rides WHERE RideID = ? AND DriverID = ?`,
    [rideId, driverId]
  );
  if (!rideRows.length) return res.status(404).json({ error: 'Ride not found.' });

  const ride = rideRows[0];

  if (status === 'Completed') {
    if (!['EnRoute', 'InProgress'].includes(ride.Status)) {
      return res.status(400).json({ error: 'Ride must be active to complete.' });
    }
    if (ride.Status === 'EnRoute') {
      await pool.execute(
        `UPDATE Rides SET Status = 'InProgress', StartTime = COALESCE(StartTime, NOW()) WHERE RideID = ?`,
        [rideId]
      );
    }
    const method = paymentMethod || 'Cash';
    await pool.execute('CALL sp_complete_ride(?, ?)', [rideId, method]);
  } else if (status === 'Cancelled') {
    await pool.execute(
      `UPDATE Rides SET Status = 'Cancelled', EndTime = NOW() WHERE RideID = ?`,
      [rideId]
    );
    await pool.execute(
      `UPDATE Drivers SET AvailabilityStatus = 'Online' WHERE DriverID = ?`,
      [driverId]
    );
  } else {
    // InProgress
    await pool.execute(
      `UPDATE Rides SET Status = 'InProgress', StartTime = NOW() WHERE RideID = ?`,
      [rideId]
    );
  }

  return res.json({ message: `Ride status updated to ${status}.` });
};

// ─── GET /api/driver/earnings ─────────────────────────────────────
const getEarnings = async (req, res) => {
  const driverId = req.user.userId;

  // Fetch driver profile for rating + total trips
  const [driverRows] = await pool.execute(
    `SELECT d.AvgRating, d.TotalTrips, d.AvailabilityStatus
     FROM Drivers d WHERE d.DriverID = ?`,
    [driverId]
  );

  const [summary] = await pool.execute(
    `SELECT
       COALESCE(SUM(FareAmount), 0) AS totalFare,
       COALESCE(SUM(Commission), 0) AS totalCommission,
       COALESCE(SUM(NetEarning), 0) AS totalNet,
       COUNT(*)                     AS totalRides
     FROM Driver_Earnings WHERE DriverID = ?`,
    [driverId]
  );

  const [weekly] = await pool.execute(
    `SELECT
       COALESCE(SUM(de.NetEarning), 0) AS weeklyNet,
       COUNT(*)                         AS weeklyRides
     FROM Driver_Earnings de
     JOIN Rides r ON de.RideID = r.RideID
     WHERE de.DriverID = ?
       AND r.EndTime >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [driverId]
  );
  const [today] = await pool.execute(
    `SELECT COALESCE(SUM(de.NetEarning), 0) AS todayNet,
            COUNT(*) AS todayRides
     FROM Driver_Earnings de
     JOIN Rides r ON de.RideID = r.RideID
     WHERE de.DriverID = ? AND DATE(r.EndTime) = CURDATE()`,
    [driverId]
  );

  const [recentRides] = await pool.execute(
    `SELECT de.NetEarning, de.FareAmount, r.RideID, r.Fare, r.Distance, r.Duration,
            r.ScheduledTime, r.EndTime,
            pl.Name AS PickupLocation, dl.Name AS DropoffLocation
     FROM Driver_Earnings de
     JOIN Rides r ON de.RideID = r.RideID
     JOIN Locations pl ON r.PickupLocationID = pl.LocationID
     JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
     WHERE de.DriverID = ?
     ORDER BY r.EndTime DESC
     LIMIT 5`,
    [driverId]
  );

  return res.json({
    driver: driverRows[0] || null,
    summary: {
      totalEarnings:  summary[0].totalNet,
      todayEarnings:  today[0].todayNet,
      weeklyEarnings: weekly[0].weeklyNet,
      totalTrips:     summary[0].totalRides,
      todayTrips:     today[0].todayRides,
    },
    recentRides
  });
};

// ─── GET /api/driver/earnings/history ─────────────────────────────
const getEarningsHistory = async (req, res) => {
  const driverId = req.user.userId;
  const [rows] = await pool.execute(
    `SELECT de.EarningID, de.FareAmount, de.Commission, de.NetEarning,
            r.RideID, r.Distance, r.Duration, r.EndTime,
            u.FirstName AS RiderFirstName, u.LastName AS RiderLastName,
            pl.Name AS PickupLocation, dl.Name AS DropoffLocation,
            p.PaymentMethod
     FROM Driver_Earnings de
     JOIN Rides     r  ON de.RideID        = r.RideID
     JOIN Users     u  ON r.RiderID        = u.UserID
     JOIN Locations pl ON r.PickupLocationID  = pl.LocationID
     JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
     LEFT JOIN Payments p ON p.RideID = r.RideID
     WHERE de.DriverID = ?
     ORDER BY r.EndTime DESC`,
    [driverId]
  );
  return res.json(rows);
};

// ─── GET /api/driver/rides/history ────────────────────────────────
const getRideHistory = async (req, res) => {
  const driverId = req.user.userId;
  const [rows] = await pool.execute(
    `SELECT r.RideID, r.Status, r.Fare, r.Distance, r.Duration,
            r.ScheduledTime, r.StartTime, r.EndTime,
            u.FirstName AS RiderFirstName, u.LastName AS RiderLastName,
            pl.Name AS PickupLocation, pl.City AS PickupCity,
            dl.Name AS DropoffLocation, dl.City AS DropoffCity,
            rat.Score AS RiderRating, rat.Comment AS RiderComment
     FROM Rides r
     JOIN Users     u  ON r.RiderID           = u.UserID
     JOIN Locations pl ON r.PickupLocationID  = pl.LocationID
     JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
     LEFT JOIN Ratings rat ON rat.RideID = r.RideID AND rat.RaterID = r.RiderID
     WHERE r.DriverID = ? AND r.Status IN ('Completed','Cancelled')
     ORDER BY r.EndTime DESC`,
    [driverId]
  );
  return res.json({ rides: rows });
};

// ─── GET /api/driver/profile ──────────────────────────────────────
const getProfile = async (req, res) => {
  const driverId = req.user.userId;
  const [rows] = await pool.execute(
    `SELECT u.UserID, u.FirstName, u.LastName, u.Email, u.Phone,
            u.AccountStatus, u.WalletBalance, u.RegDate,
            d.LicenseNo, d.CNIC, d.VerificationStatus, d.AvailabilityStatus,
            d.AvgRating, d.TotalTrips, d.City,
            v.VehicleID, v.VehicleType, v.Make, v.Model, v.Year,
            v.Color, v.LicensePlate, v.VerificationStatus AS VehicleStatus
     FROM Users u
     JOIN Drivers  d ON d.DriverID = u.UserID
     LEFT JOIN Vehicles v ON v.DriverID = d.DriverID AND v.VerificationStatus = 'Verified'
     WHERE u.UserID = ?
     LIMIT 1`,
    [driverId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Driver not found.' });
  return res.json(rows[0]);
};

// ─── POST /api/driver/vehicles ────────────────────────────────────
// Driver registers a new vehicle
const registerVehicle = async (req, res) => {
  const driverId = req.user.userId;
  const { vehicleType, make, model, year, color, licensePlate } = req.body;

  if (!vehicleType || !make || !model || !year || !color || !licensePlate) {
    return res.status(400).json({ error: 'All vehicle fields are required.' });
  }

  const allowedTypes = ['Economy', 'Premium', 'Bike'];
  if (!allowedTypes.includes(vehicleType)) {
    return res.status(400).json({ error: `Vehicle type must be one of: ${allowedTypes.join(', ')}` });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO Vehicles (DriverID, VehicleType, Make, Model, Year, Color, LicensePlate, VerificationStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [driverId, vehicleType, make, model, year, color, licensePlate]
    );
    return res.status(201).json({
      message: 'Vehicle registered. Pending admin verification.',
      vehicleId: result.insertId,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A vehicle with this license plate already exists.' });
    }
    throw err;
  }
};

// ─── GET /api/driver/vehicles ─────────────────────────────────────
// List all vehicles registered by this driver
const getVehicles = async (req, res) => {
  const driverId = req.user.userId;
  const [rows] = await pool.execute(
    `SELECT VehicleID, VehicleType, Make, Model, Year, Color, LicensePlate, VerificationStatus
     FROM Vehicles WHERE DriverID = ?
     ORDER BY VehicleID DESC`,
    [driverId]
  );
  return res.json({ vehicles: rows });
};

// ─── POST /api/driver/payout ──────────────────────────────────────
// Drivers can request weekly payouts (withdraw wallet balance)
const requestPayout = async (req, res) => {
  const driverId = req.user.userId;

  const [userRows] = await pool.execute(
    `SELECT WalletBalance FROM Users WHERE UserID = ?`,
    [driverId]
  );
  if (!userRows.length) return res.status(404).json({ error: 'Driver not found.' });

  const balance = userRows[0].WalletBalance;
  if (balance <= 0) {
    return res.status(400).json({ error: 'No balance available for payout.' });
  }

  // Zero out the wallet (payout processed)
  await pool.execute(
    `UPDATE Users SET WalletBalance = 0 WHERE UserID = ?`,
    [driverId]
  );

  return res.json({
    message: `Payout of $${Number(balance).toFixed(2)} processed successfully.`,
    amount: balance,
  });
};

// ─── POST /api/driver/rides/:id/rate ──────────────────────────────
// Driver rates a rider after a completed ride
const rateRider = async (req, res) => {
  const driverId = req.user.userId;
  const rideId   = req.params.id;
  const { score, comment } = req.body;

  if (!score || score < 1 || score > 5) {
    return res.status(400).json({ error: 'Score must be between 1 and 5.' });
  }

  // Verify ride belongs to this driver and is completed
  const [rideRows] = await pool.execute(
    `SELECT RiderID FROM Rides WHERE RideID = ? AND DriverID = ? AND Status = 'Completed'`,
    [rideId, driverId]
  );
  if (!rideRows.length) {
    return res.status(404).json({ error: 'Completed ride not found.' });
  }

  // Check not already rated
  const [existing] = await pool.execute(
    `SELECT RatingID FROM Ratings WHERE RideID = ? AND RaterID = ?`,
    [rideId, driverId]
  );
  if (existing.length) {
    return res.status(409).json({ error: 'You have already rated this rider.' });
  }

  await pool.execute(
    `INSERT INTO Ratings (RideID, RaterID, RatedUserID, Score, Comment, Timestamp)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [rideId, driverId, rideRows[0].RiderID, score, comment || null]
  );

  return res.status(201).json({ message: 'Rider rating submitted successfully.' });
};

// ─── PATCH /api/driver/city ───────────────────────────────────────
// Driver can change their operating city
const updateCity = async (req, res) => {
  const driverId = req.user.userId;
  const { city } = req.body;

  const allowedCities = ['Lahore', 'Karachi'];
  if (!city || !allowedCities.includes(city)) {
    return res.status(400).json({ error: 'City must be Lahore or Karachi.' });
  }

  // Cannot change city while on an active ride
  const [activeRide] = await pool.execute(
    `SELECT RideID FROM Rides WHERE DriverID = ? AND Status IN ('EnRoute','InProgress') LIMIT 1`,
    [driverId]
  );
  if (activeRide.length) {
    return res.status(400).json({ error: 'Cannot change city while on an active ride.' });
  }

  await pool.execute(
    `UPDATE Drivers SET City = ? WHERE DriverID = ?`,
    [city, driverId]
  );
  return res.json({ message: `City updated to ${city}.`, city });
};

module.exports = {
  getDashboard, setAvailability, getRequests,
  acceptRequest, rejectRequest, getCurrentRide,
  updateRideStatus, getEarnings, getEarningsHistory,
  getRideHistory, getProfile, registerVehicle, getVehicles,
  requestPayout, rateRider, updateCity,
};
