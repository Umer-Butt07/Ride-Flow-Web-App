const pool = require('../db/connection');
const { estimateRoute } = require('../utils/ride-estimates');

// ─── GET /api/rider/dashboard ─────────────────────────────────────
const getDashboard = async (req, res) => {
  const riderId = req.user.userId;

  const [userRows] = await pool.execute(
    `SELECT FirstName, LastName, Email, Phone, WalletBalance FROM Users WHERE UserID = ?`,
    [riderId]
  );

  const [recentRides] = await pool.execute(
    `SELECT r.RideID, r.Status, r.Fare, r.Distance, r.Duration,
            r.ScheduledTime, r.EndTime,
            u.FirstName AS DriverFirstName, u.LastName AS DriverLastName, u.ProfilePicture AS DriverProfilePicture,
            pl.Name AS PickupLocation, dl.Name AS DropoffLocation
     FROM Rides r
     JOIN Users     u  ON r.DriverID          = u.UserID
     JOIN Locations pl ON r.PickupLocationID  = pl.LocationID
     JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
     WHERE r.RiderID = ?
     ORDER BY r.ScheduledTime DESC
     LIMIT 5`,
    [riderId]
  );

  const [stats] = await pool.execute(
    `SELECT COUNT(*) AS totalRides,
            COALESCE(SUM(Fare), 0) AS totalSpent
     FROM Rides WHERE RiderID = ? AND Status = 'Completed'`,
    [riderId]
  );

  return res.json({
    user:       userRows[0],
    recentRides,
    stats:      stats[0],
  });
};

// ─── GET /api/rider/rides/history ─────────────────────────────────
// Basic SQL query: all completed rides ordered by date
const getRideHistory = async (req, res) => {
  const riderId = req.user.userId;
  const [rows] = await pool.execute(
    `SELECT r.RideID, r.Status, r.Fare, r.Distance, r.Duration,
            r.ScheduledTime, r.StartTime, r.EndTime,
            u.FirstName AS DriverFirstName, u.LastName AS DriverLastName, u.ProfilePicture AS DriverProfilePicture,
            pl.Name AS PickupLocation, pl.City AS PickupCity,
            dl.Name AS DropoffLocation, dl.City AS DropoffCity,
            v.VehicleType, v.Make, v.Model, v.Color, v.LicensePlate,
            rat.Score AS DriverRating,
            p.PaymentMethod, p.PaymentStatus,
            pc.Code AS PromoCode
     FROM Rides r
     JOIN Users     u  ON r.DriverID          = u.UserID
     JOIN Locations pl ON r.PickupLocationID  = pl.LocationID
     JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
     JOIN Vehicles   v  ON r.VehicleID         = v.VehicleID
     LEFT JOIN Ratings    rat ON rat.RideID = r.RideID AND rat.RaterID = r.RiderID
     LEFT JOIN Payments   p   ON p.RideID   = r.RideID
     LEFT JOIN Promo_Codes pc ON pc.PromoID  = r.PromoID
     WHERE r.RiderID = ?
     ORDER BY r.ScheduledTime DESC`,
    [riderId]
  );
  return res.json(rows);
};

// ─── POST /api/rider/rides/request ────────────────────────────────
const requestRide = async (req, res) => {
  const riderId = req.user.userId;
  const { pickupLocationId, dropoffLocationId, vehicleType = 'Economy', promoCode } = req.body;

  if (!pickupLocationId || !dropoffLocationId) {
    return res.status(400).json({ error: 'Pickup and dropoff locations are required.' });
  }
  if (pickupLocationId === dropoffLocationId) {
    return res.status(400).json({ error: 'Pickup and dropoff must be different locations.' });
  }

  const estimate = await estimateRoute(pool, pickupLocationId, dropoffLocationId, vehicleType, promoCode);
  if (!estimate) {
    return res.status(404).json({ error: 'Pickup or dropoff location was not found.' });
  }
  if (estimate.invalidPromo) {
    return res.status(400).json({ error: 'Invalid or expired promo code.' });
  }

  // Find an available online verified driver with a matching verified vehicle.
  // Filter by city: driver's city must match the pickup location's city.
  const [driverRows] = await pool.execute(
    `SELECT d.DriverID, v.VehicleID
     FROM Drivers d
     JOIN Users u ON d.DriverID = u.UserID
     JOIN Vehicles v ON v.DriverID = d.DriverID AND v.VerificationStatus = 'Verified'
     JOIN Locations pl ON pl.LocationID = ?
     WHERE d.AvailabilityStatus = 'Online'
       AND d.VerificationStatus = 'Verified'
       AND u.AccountStatus = 'Active'
       AND v.VehicleType = ?
       AND d.City = pl.City
       AND NOT EXISTS (
         SELECT 1 FROM Rides r
         WHERE r.DriverID = d.DriverID AND r.Status IN ('EnRoute', 'InProgress')
       )
     ORDER BY d.AvgRating DESC, d.TotalTrips ASC
     LIMIT 1`
    ,
    [pickupLocationId, estimate.vehicleType]
  );

  if (!driverRows.length) {
    return res.status(503).json({ error: 'No drivers available right now. Please try again shortly.' });
  }
  const assignedDriverId = driverRows[0].DriverID;

  const [result] = await pool.execute(
    `INSERT INTO Ride_Requests
       (RiderID, DriverID, RequestDate, Status, PickupLocationID, DropoffLocationID,
        RequestedVehicleType, PromoID, EstimatedFare, EstimatedDistance, EstimatedDuration)
     VALUES (?, ?, NOW(), 'Requested', ?, ?, ?, ?, ?, ?, ?)`,
    [
      riderId,
      assignedDriverId,
      pickupLocationId,
      dropoffLocationId,
      estimate.vehicleType,
      estimate.promoId,
      estimate.fare,
      estimate.distance,
      estimate.duration,
    ]
  );

  return res.status(201).json({
    message: 'Ride requested successfully. Waiting for driver to accept.',
    requestId:       result.insertId,
    assignedDriverId,
    estimate,
  });
};

// POST /api/rider/rides/estimate
const estimateRide = async (req, res) => {
  const { pickupLocationId, dropoffLocationId, vehicleType = 'Economy', promoCode } = req.body;
  if (!pickupLocationId || !dropoffLocationId) {
    return res.status(400).json({ error: 'Pickup and dropoff locations are required.' });
  }
  if (pickupLocationId === dropoffLocationId) {
    return res.status(400).json({ error: 'Pickup and dropoff must be different locations.' });
  }

  const estimate = await estimateRoute(pool, pickupLocationId, dropoffLocationId, vehicleType, promoCode);
  if (!estimate) return res.status(404).json({ error: 'Pickup or dropoff location was not found.' });
  if (estimate.invalidPromo) return res.status(400).json({ error: 'Invalid or expired promo code.' });

  return res.json({ estimate });
};

// ─── POST /api/rider/rides/:id/rate ──────────────────────────────
const rateRide = async (req, res) => {
  const riderId = req.user.userId;
  const rideId  = req.params.id;
  const { score, comment } = req.body;

  if (!score || score < 1 || score > 5) {
    return res.status(400).json({ error: 'Score must be between 1 and 5.' });
  }

  // Verify ride belongs to this rider and is completed
  const [rideRows] = await pool.execute(
    `SELECT DriverID FROM Rides WHERE RideID = ? AND RiderID = ? AND Status = 'Completed'`,
    [rideId, riderId]
  );
  if (!rideRows.length) {
    return res.status(404).json({ error: 'Completed ride not found.' });
  }

  // Check not already rated
  const [existing] = await pool.execute(
    `SELECT RatingID FROM Ratings WHERE RideID = ? AND RaterID = ?`,
    [rideId, riderId]
  );
  if (existing.length) {
    return res.status(409).json({ error: 'You have already rated this ride.' });
  }

  await pool.execute(
    `INSERT INTO Ratings (RideID, RaterID, RatedUserID, Score, Comment, Timestamp)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [rideId, riderId, rideRows[0].DriverID, score, comment || null]
  );

  return res.status(201).json({ message: 'Rating submitted successfully.' });
};

// ─── POST /api/rider/rides/:id/pay ────────────────────────────────
const payRide = async (req, res) => {
  const riderId = req.user.userId;
  const rideId  = req.params.id;
  const { paymentMethod } = req.body;

  const allowed = ['Cash', 'Wallet', 'Card'];
  if (!allowed.includes(paymentMethod)) {
    return res.status(400).json({ error: `Payment method must be one of: ${allowed.join(', ')}` });
  }

  const [rideRows] = await pool.execute(
    `SELECT Fare, Status FROM Rides WHERE RideID = ? AND RiderID = ?`,
    [rideId, riderId]
  );
  if (!rideRows.length) return res.status(404).json({ error: 'Ride not found.' });

  const ride = rideRows[0];

  // Check if payment already exists and is paid
  const [existingPayment] = await pool.execute(
    `SELECT PaymentID, PaymentStatus, PaymentMethod FROM Payments WHERE RideID = ?`,
    [rideId]
  );

  if (existingPayment.length && existingPayment[0].PaymentStatus === 'Paid') {
    // Payment already recorded (by sp_complete_ride). Just handle wallet deduction if needed.
    if (paymentMethod === 'Wallet' && existingPayment[0].PaymentMethod !== 'Wallet') {
      const [balanceRows] = await pool.execute(
        `SELECT WalletBalance FROM Users WHERE UserID = ?`,
        [riderId]
      );
      if (balanceRows[0].WalletBalance < ride.Fare) {
        return res.status(400).json({ error: 'Insufficient wallet balance.' });
      }
      await pool.execute(
        `UPDATE Users SET WalletBalance = WalletBalance - ? WHERE UserID = ?`,
        [ride.Fare, riderId]
      );
      await pool.execute(
        `UPDATE Payments SET PaymentMethod = ? WHERE RideID = ?`,
        [paymentMethod, rideId]
      );
    }
    return res.json({ message: 'Payment successful. Ride completed.' });
  }

  // Ride must be InProgress or Completed (driver may have just completed it)
  if (!['InProgress', 'Completed'].includes(ride.Status)) {
    return res.status(400).json({ error: 'Ride must be InProgress or Completed to make payment.' });
  }

  // For Wallet payment, check balance and deduct
  if (paymentMethod === 'Wallet') {
    const [balanceRows] = await pool.execute(
      `SELECT WalletBalance FROM Users WHERE UserID = ?`,
      [riderId]
    );
    if (balanceRows[0].WalletBalance < ride.Fare) {
      return res.status(400).json({ error: 'Insufficient wallet balance.' });
    }
    await pool.execute(
      `UPDATE Users SET WalletBalance = WalletBalance - ? WHERE UserID = ?`,
      [ride.Fare, riderId]
    );
  }

  // Insert payment (trigger will auto-complete the ride if still InProgress)
  await pool.execute(
    `INSERT INTO Payments (RideID, Amount, PaymentMethod, PaymentStatus, TxnDate)
     VALUES (?, ?, ?, 'Paid', NOW())
     ON DUPLICATE KEY UPDATE PaymentStatus = 'Paid', PaymentMethod = ?, TxnDate = NOW()`,
    [rideId, ride.Fare, paymentMethod, paymentMethod]
  );

  return res.json({ message: 'Payment successful. Ride completed.' });
};

// ─── POST /api/rider/rides/schedule ──────────────────────────────
// Riders can schedule rides in advance
const scheduleRide = async (req, res) => {
  const riderId = req.user.userId;
  const { pickupLocationId, dropoffLocationId, scheduledTime, promoCode } = req.body;

  if (!pickupLocationId || !dropoffLocationId || !scheduledTime) {
    return res.status(400).json({ error: 'Pickup, dropoff, and scheduledTime are required.' });
  }
  if (pickupLocationId === dropoffLocationId) {
    return res.status(400).json({ error: 'Pickup and dropoff must be different locations.' });
  }

  const scheduled = new Date(scheduledTime);
  if (scheduled <= new Date()) {
    return res.status(400).json({ error: 'Scheduled time must be in the future.' });
  }

  // Validate promo code if provided
  let promoId = null;
  if (promoCode) {
    const [promoRows] = await pool.execute(
      `SELECT PromoID FROM Promo_Codes
       WHERE Code = ? AND IsActive = 1 AND ExpiryDate >= CURDATE() AND UsageCount < UsageLimit`,
      [promoCode]
    );
    if (!promoRows.length) {
      return res.status(400).json({ error: 'Invalid or expired promo code.' });
    }
    promoId = promoRows[0].PromoID;
  }

  // Find best available driver filtered by pickup city
  const [driverRows] = await pool.execute(
    `SELECT d.DriverID FROM Drivers d
     JOIN Users u ON d.DriverID = u.UserID
     JOIN Locations pl ON pl.LocationID = ?
     WHERE d.AvailabilityStatus = 'Online'
       AND d.VerificationStatus = 'Verified'
       AND u.AccountStatus = 'Active'
       AND d.City = pl.City
     ORDER BY d.AvgRating DESC
     LIMIT 1`,
    [pickupLocationId]
  );

  if (!driverRows.length) {
    return res.status(503).json({ error: 'No drivers available right now. Please try again shortly.' });
  }
  const assignedDriverId = driverRows[0].DriverID;

  const [result] = await pool.execute(
    `INSERT INTO Ride_Requests (RiderID, DriverID, RequestDate, Status, PickupLocationID, DropoffLocationID)
     VALUES (?, ?, ?, 'Requested', ?, ?)`,
    [riderId, assignedDriverId, scheduledTime, pickupLocationId, dropoffLocationId]
  );

  return res.status(201).json({
    message: `Ride scheduled for ${scheduled.toLocaleString()}. Waiting for driver to accept.`,
    requestId:       result.insertId,
    assignedDriverId,
    scheduledTime,
  });
};

// ─── GET /api/rider/rides/active ─────────────────────────────────
// Get rider's currently active ride
const getActiveRide = async (req, res) => {
  const riderId = req.user.userId;
  const [rows] = await pool.execute(
    `SELECT r.RideID, r.Status, r.Fare, r.Distance, r.Duration,
            r.ScheduledTime, r.StartTime,
            u.FirstName AS DriverFirstName, u.LastName AS DriverLastName, u.ProfilePicture AS DriverProfilePicture,
            u.Phone AS DriverPhone,
            d.AvgRating AS DriverRating,
            pl.Name AS PickupLocation, dl.Name AS DropoffLocation,
            v.Make, v.Model, v.Color, v.LicensePlate, v.VehicleType
     FROM Rides r
     JOIN Users     u  ON r.DriverID          = u.UserID
     JOIN Drivers   d  ON r.DriverID          = d.DriverID
     JOIN Locations pl ON r.PickupLocationID  = pl.LocationID
     JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
     JOIN Vehicles  v  ON r.VehicleID         = v.VehicleID
     WHERE r.RiderID = ? AND r.Status IN ('EnRoute','InProgress')
     LIMIT 1`,
    [riderId]
  );
  if (!rows.length) return res.status(404).json({ error: 'No active ride found.' });
  return res.json({ ride: rows[0] });
};

// ─── POST /api/rider/rides/:id/cancel ────────────────────────────
const cancelRide = async (req, res) => {
  const riderId = req.user.userId;
  const rideId  = req.params.id;

  const [rideRows] = await pool.execute(
    `SELECT Status FROM Rides WHERE RideID = ? AND RiderID = ?`,
    [rideId, riderId]
  );
  if (!rideRows.length) return res.status(404).json({ error: 'Ride not found.' });
  if (rideRows[0].Status === 'Completed') {
    return res.status(400).json({ error: 'Cannot cancel a completed ride.' });
  }

  await pool.execute(
    `UPDATE Rides SET Status = 'Cancelled', EndTime = NOW() WHERE RideID = ?`,
    [rideId]
  );

  return res.json({ message: 'Ride cancelled successfully.' });
};

// POST /api/rider/requests/:id/cancel
const cancelRequest = async (req, res) => {
  const riderId = req.user.userId;
  const requestId = req.params.id;

  const [result] = await pool.execute(
    `UPDATE Ride_Requests
     SET Status = 'Cancelled'
     WHERE RequestID = ? AND RiderID = ? AND Status = 'Requested'`,
    [requestId, riderId]
  );

  if (!result.affectedRows) {
    return res.status(404).json({ error: 'Pending ride request not found.' });
  }

  return res.json({ message: 'Ride request cancelled.' });
};

// ─── POST /api/rider/rides/:id/complain ──────────────────────────
const complainRide = async (req, res) => {
  const riderId = req.user.userId;
  const rideId  = req.params.id;
  const { description } = req.body;

  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'Description is required.' });
  }

  // Verify ride belongs to this rider
  const [rideRows] = await pool.execute(
    `SELECT DriverID FROM Rides WHERE RideID = ? AND RiderID = ?`,
    [rideId, riderId]
  );
  if (!rideRows.length) {
    return res.status(404).json({ error: 'Ride not found.' });
  }

  await pool.execute(
    `INSERT INTO Complaints (FiledByUserID, AgainstUserID, RideID, Description, Status, CreatedAt)
     VALUES (?, ?, ?, ?, 'Open', NOW())`,
    [riderId, rideRows[0].DriverID, rideId, description.trim()]
  );

  return res.status(201).json({ message: 'Complaint submitted successfully.' });
};

// ─── GET /api/rider/locations ─────────────────────────────────────
const getLocations = async (req, res) => {
  const { city } = req.query;
  let query = `SELECT LocationID, Name, City, Latitude, Longitude FROM Locations`;
  const params = [];
  if (city) {
    query += ` WHERE City = ?`;
    params.push(city);
  }
  query += ` ORDER BY City, Name`;
  const [rows] = await pool.execute(query, params);
  return res.json(rows);
};

// ─── POST /api/rider/wallet/topup ────────────────────────────────
const topUpWallet = async (req, res) => {
  const riderId = req.user.userId;
  const { amount } = req.body;

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }
  if (numAmount > 50000) {
    return res.status(400).json({ error: 'Maximum top-up amount is Rs. 50,000.' });
  }

  await pool.execute(
    `UPDATE Users SET WalletBalance = WalletBalance + ? WHERE UserID = ?`,
    [numAmount, riderId]
  );

  const [rows] = await pool.execute(
    `SELECT WalletBalance FROM Users WHERE UserID = ?`,
    [riderId]
  );

  return res.json({
    message: `Rs. ${numAmount.toFixed(2)} added to wallet successfully.`,
    walletBalance: rows[0].WalletBalance,
  });
};

// ─── GET /api/rider/wallet/balance ───────────────────────────────
const getWalletBalance = async (req, res) => {
  const riderId = req.user.userId;
  const [rows] = await pool.execute(
    `SELECT WalletBalance FROM Users WHERE UserID = ?`,
    [riderId]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found.' });
  return res.json({ walletBalance: rows[0].WalletBalance });
};

module.exports = {
  getDashboard, getRideHistory, requestRide, scheduleRide,
  estimateRide, rateRide, payRide, getLocations, getActiveRide, cancelRide,
  cancelRequest, complainRide, topUpWallet, getWalletBalance,
};
