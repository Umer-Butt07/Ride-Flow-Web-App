const pool = require('../db/connection');

// ─── 1. Basic SQL: Completed rides for a specific rider ordered by date
// GET /api/reports/rider-rides?riderId=2
const getRiderRides = async (req, res) => {
  const { riderId } = req.query;
  if (!riderId) return res.status(400).json({ error: 'riderId is required.' });

  const [rows] = await pool.execute(
    `SELECT r.RideID, r.Fare, r.Distance, r.Duration, r.Status,
            r.ScheduledTime, r.EndTime,
            u.FirstName AS DriverFirstName, u.LastName AS DriverLastName,
            pl.Name AS PickupLocation, dl.Name AS DropoffLocation
     FROM Rides r
     JOIN Users     u  ON r.DriverID          = u.UserID
     JOIN Locations pl ON r.PickupLocationID  = pl.LocationID
     JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
     WHERE r.RiderID = ? AND r.Status = 'Completed'
     ORDER BY r.ScheduledTime DESC`,
    [riderId]
  );
  return res.json(rows);
};

// ─── 2. Basic SQL: Drivers in a city ordered by rating
// GET /api/reports/drivers-by-city?city=Lahore
const getDriversByCity = async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'city is required.' });

  const [rows] = await pool.execute(
    `SELECT d.DriverID, u.FirstName, u.LastName, u.Phone,
            d.AvgRating, d.TotalTrips, d.AvailabilityStatus,
            v.VehicleType, v.Make, v.Model, v.LicensePlate,
            loc.City
     FROM Drivers d
     JOIN Users     u   ON d.DriverID = u.UserID
     LEFT JOIN Vehicles v   ON v.DriverID = d.DriverID AND v.VerificationStatus = 'Verified'
     LEFT JOIN Locations loc ON loc.City = ?
     WHERE d.VerificationStatus = 'Verified' AND u.AccountStatus = 'Active'
     ORDER BY d.AvgRating DESC`,
    [city]
  );
  return res.json(rows);
};

// ─── 3. Aggregate: Total revenue per city (SUM + GROUP BY)
// GET /api/reports/revenue-by-city
const getRevenueByCity = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT l.City,
            COUNT(p.PaymentID)       AS totalRides,
            SUM(p.Amount)            AS totalRevenue,
            AVG(p.Amount)            AS avgFare,
            SUM(p.Amount * 0.20)     AS platformCommission
     FROM Payments p
     JOIN Rides     r ON p.RideID = r.RideID
     JOIN Locations l ON r.PickupLocationID = l.LocationID
     WHERE p.PaymentStatus = 'Paid'
     GROUP BY l.City
     ORDER BY totalRevenue DESC`
  );
  return res.json(rows);
};

// ─── 4. Aggregate: AVG rating < 3.5 with HAVING
// GET /api/reports/low-rated-drivers
const getLowRatedDrivers = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT d.DriverID,
            u.FirstName, u.LastName, u.Email, u.Phone,
            u.AccountStatus,
            AVG(r.Score)    AS avgRating,
            COUNT(r.RatingID) AS totalRatings
     FROM Drivers d
     JOIN Users   u ON d.DriverID   = u.UserID
     JOIN Ratings r ON r.RatedUserID = d.DriverID
     GROUP BY d.DriverID, u.FirstName, u.LastName, u.Email, u.Phone, u.AccountStatus
     HAVING AVG(r.Score) < 3.5
     ORDER BY avgRating ASC`
  );
  return res.json(rows);
};

// ─── 5. Aggregate: COUNT trips completed per driver
// GET /api/reports/trips-per-driver
const getTripsPerDriver = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT d.DriverID,
            u.FirstName, u.LastName,
            COUNT(r.RideID)               AS completedTrips,
            COALESCE(SUM(de.NetEarning),0) AS totalEarned
     FROM Drivers d
     JOIN Users          u  ON d.DriverID  = u.UserID
     LEFT JOIN Rides     r  ON r.DriverID  = d.DriverID AND r.Status = 'Completed'
     LEFT JOIN Driver_Earnings de ON de.DriverID = d.DriverID
     GROUP BY d.DriverID, u.FirstName, u.LastName
     ORDER BY completedTrips DESC`
  );
  return res.json(rows);
};

// ─── 6. Joins: Full trip report (INNER JOIN - Riders, Rides, Drivers, Vehicles)
// GET /api/reports/full-trip-report
const getFullTripReport = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT
        r.RideID,
        r.Status        AS RideStatus,
        r.Fare,
        r.Distance,
        r.Duration,
        r.ScheduledTime,
        r.StartTime,
        r.EndTime,

        -- Rider
        ur.FirstName    AS RiderFirstName,
        ur.LastName     AS RiderLastName,
        ur.Email        AS RiderEmail,
        ur.Phone        AS RiderPhone,

        -- Driver
        ud.FirstName    AS DriverFirstName,
        ud.LastName     AS DriverLastName,
        ud.Email        AS DriverEmail,
        d.AvgRating     AS DriverRating,

        -- Vehicle
        v.VehicleType,
        v.Make,
        v.Model,
        v.LicensePlate,

        -- Locations
        pl.Name         AS PickupLocation,
        pl.City         AS PickupCity,
        dl.Name         AS DropoffLocation,
        dl.City         AS DropoffCity,

        -- Payment
        p.PaymentMethod,
        p.PaymentStatus,
        p.Amount        AS PaymentAmount

     FROM Rides r
     INNER JOIN Users     ur ON r.RiderID           = ur.UserID
     INNER JOIN Users     ud ON r.DriverID          = ud.UserID
     INNER JOIN Drivers    d ON r.DriverID          = d.DriverID
     INNER JOIN Vehicles   v ON r.VehicleID         = v.VehicleID
     INNER JOIN Locations pl ON r.PickupLocationID  = pl.LocationID
     INNER JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
     LEFT  JOIN Payments   p ON r.RideID            = p.RideID
     ORDER BY r.ScheduledTime DESC`
  );
  return res.json(rows);
};

// ─── 7. Joins: All riders (LEFT JOIN - including those with no rides)
// GET /api/reports/all-riders
const getAllRiders = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT
        u.UserID,
        u.FirstName,
        u.LastName,
        u.Email,
        u.Phone,
        u.AccountStatus,
        u.RegDate,
        COUNT(r.RideID)              AS totalRides,
        COALESCE(SUM(r.Fare), 0)     AS totalSpent
     FROM Users u
     LEFT JOIN Rides r ON r.RiderID = u.UserID AND r.Status = 'Completed'
     WHERE u.Role = 'Rider'
     GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, u.Phone, u.AccountStatus, u.RegDate
     ORDER BY totalRides DESC`
  );
  return res.json(rows);
};

// ─── 8. Joins: Promo code usage per ride (JOIN Payments + PromoCodes)
// GET /api/reports/promo-usage
const getPromoUsage = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT pc.Code,
            pc.DiscountValue,
            pc.UsageLimit,
            pc.UsageCount,
            pc.ExpiryDate,
            pc.IsActive,
            COUNT(r.RideID)      AS ridesUsed,
            SUM(pc.DiscountValue) AS totalDiscount
     FROM Promo_Codes pc
     LEFT JOIN Rides    r ON r.PromoID  = pc.PromoID
     LEFT JOIN Payments p ON p.RideID   = r.RideID AND p.PaymentStatus = 'Paid'
     GROUP BY pc.PromoID, pc.Code, pc.DiscountValue, pc.UsageLimit,
              pc.UsageCount, pc.ExpiryDate, pc.IsActive
     ORDER BY ridesUsed DESC`
  );
  return res.json(rows);
};

// ─── 9. View: Active Rides
// GET /api/reports/active-rides
const getActiveRides = async (req, res) => {
  const [rows] = await pool.execute(`SELECT * FROM ActiveRidesView`);
  return res.json(rows);
};

// ─── 10. View: Top Drivers
// GET /api/reports/top-drivers
const getTopDrivers = async (req, res) => {
  const [rows] = await pool.execute(`SELECT * FROM TopDriversView`);
  return res.json(rows);
};

// ─── 11. Revenue breakdown by payment method
// GET /api/reports/revenue-by-payment
const getRevenueByPayment = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT PaymentMethod,
            COUNT(*)      AS transactionCount,
            SUM(Amount)   AS totalRevenue,
            AVG(Amount)   AS avgAmount
     FROM Payments
     WHERE PaymentStatus = 'Paid'
     GROUP BY PaymentMethod
     ORDER BY totalRevenue DESC`
  );
  return res.json(rows);
};

// ─── 12. Refund and dispute totals
// GET /api/reports/refunds
const getRefunds = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT PaymentStatus,
            COUNT(*)    AS count,
            COALESCE(SUM(Amount), 0) AS totalAmount
     FROM Payments
     WHERE PaymentStatus IN ('Failed','Refunded')
     GROUP BY PaymentStatus`
  );
  return res.json(rows);
};

// ─── 13. Revenue by city and date range
// GET /api/reports/revenue-by-city-date?startDate=2026-01-01&endDate=2026-12-31
const getRevenueByCityDate = async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD).' });
  }

  const [rows] = await pool.execute(
    `SELECT l.City,
            COUNT(p.PaymentID)       AS totalRides,
            SUM(p.Amount)            AS totalRevenue,
            AVG(p.Amount)            AS avgFare,
            SUM(p.Amount * 0.20)     AS platformCommission
     FROM Payments p
     JOIN Rides     r ON p.RideID = r.RideID
     JOIN Locations l ON r.PickupLocationID = l.LocationID
     WHERE p.PaymentStatus = 'Paid'
       AND p.TxnDate BETWEEN ? AND ?
     GROUP BY l.City
     ORDER BY totalRevenue DESC`,
    [startDate, endDate]
  );
  return res.json(rows);
};

// ─── 14. Total driver earnings and commissions
// GET /api/reports/driver-earnings
const getDriverEarningsReport = async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT de.DriverID,
            u.FirstName, u.LastName, u.Email,
            COUNT(de.EarningID)             AS totalRides,
            SUM(de.FareAmount)              AS totalFare,
            SUM(de.Commission)              AS totalCommission,
            SUM(de.NetEarning)              AS totalNetEarning,
            u.WalletBalance                 AS currentBalance
     FROM Driver_Earnings de
     JOIN Users u ON de.DriverID = u.UserID
     GROUP BY de.DriverID, u.FirstName, u.LastName, u.Email, u.WalletBalance
     ORDER BY totalNetEarning DESC`
  );
  return res.json(rows);
};

// ─── 15. Driver Leaderboard by City
// GET /api/reports/leaderboard?city=Lahore
const getLeaderboard = async (req, res) => {
  const { city } = req.query;
  let query = `SELECT * FROM DriverLeaderboardView`;
  const params = [];
  if (city) {
    query += ` WHERE City = ?`;
    params.push(city);
  }
  const [rows] = await pool.execute(query, params);
  return res.json(rows);
};

module.exports = {
  getRiderRides, getDriversByCity, getRevenueByCity, getLowRatedDrivers,
  getTripsPerDriver, getFullTripReport, getAllRiders, getPromoUsage,
  getActiveRides, getTopDrivers, getRevenueByPayment, getRefunds,
  getRevenueByCityDate, getDriverEarningsReport, getLeaderboard,
};
