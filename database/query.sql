-- =========================================
-- RideFlow — SQL Query Demonstrations
-- Covers: Basic SQL, Aggregates + HAVING,
--         JOINs for Reports
-- =========================================

USE RideFlow;


-- =========================================
-- COMPONENT 1: BASIC SQL QUERIES
-- SELECT, WHERE, ORDER BY
-- =========================================

-- Q1: List all completed rides for a specific rider (ID=2) ordered by date
SELECT r.RideID, r.Fare, r.Distance, r.Duration, r.Status,
       r.ScheduledTime, r.EndTime,
       u.FirstName AS DriverFirstName, u.LastName AS DriverLastName,
       pl.Name AS PickupLocation, dl.Name AS DropoffLocation
FROM Rides r
JOIN Users     u  ON r.DriverID          = u.UserID
JOIN Locations pl ON r.PickupLocationID  = pl.LocationID
JOIN Locations dl ON r.DropoffLocationID = dl.LocationID
WHERE r.RiderID = 2 AND r.Status = 'Completed'
ORDER BY r.ScheduledTime DESC;


-- Q2: List all drivers in Lahore ordered by rating (descending)
SELECT d.DriverID, u.FirstName, u.LastName, u.Phone,
       d.AvgRating, d.TotalTrips, d.AvailabilityStatus,
       v.VehicleType, v.Make, v.Model, v.LicensePlate
FROM Drivers d
JOIN Users     u ON d.DriverID = u.UserID
LEFT JOIN Vehicles v ON v.DriverID = d.DriverID
LEFT JOIN Rides    r ON r.DriverID = d.DriverID
LEFT JOIN Locations l ON r.PickupLocationID = l.LocationID
WHERE l.City = 'Lahore'
  AND d.VerificationStatus = 'Verified'
  AND u.AccountStatus = 'Active'
GROUP BY d.DriverID, u.FirstName, u.LastName, u.Phone,
         d.AvgRating, d.TotalTrips, d.AvailabilityStatus,
         v.VehicleType, v.Make, v.Model, v.LicensePlate
ORDER BY d.AvgRating DESC;


-- Q3: List all active (Online) drivers with their vehicles
SELECT u.UserID, u.FirstName, u.LastName, u.Email, u.Phone,
       d.AvailabilityStatus, d.AvgRating,
       v.VehicleType, v.Make, v.Model, v.Color, v.LicensePlate
FROM Users u
JOIN Drivers  d ON d.DriverID = u.UserID
LEFT JOIN Vehicles v ON v.DriverID = d.DriverID
WHERE d.AvailabilityStatus = 'Online'
ORDER BY d.AvgRating DESC;


-- Q4: List all pending ride requests
SELECT rr.RequestID, rr.RequestDate, rr.Status,
       ur.FirstName AS RiderName, ur.LastName AS RiderLastName,
       ud.FirstName AS DriverName, ud.LastName AS DriverLastName,
       pl.Name AS PickupLocation, dl.Name AS DropoffLocation
FROM Ride_Requests rr
JOIN Users     ur ON rr.RiderID  = ur.UserID
JOIN Users     ud ON rr.DriverID = ud.UserID
JOIN Locations pl ON rr.PickupLocationID  = pl.LocationID
JOIN Locations dl ON rr.DropoffLocationID = dl.LocationID
WHERE rr.Status = 'Requested'
ORDER BY rr.RequestDate DESC;


-- Q5: List all suspended or banned users
SELECT UserID, FirstName, LastName, Email, Phone, Role, AccountStatus, RegDate
FROM Users
WHERE AccountStatus IN ('Suspended', 'Banned')
ORDER BY AccountStatus, RegDate DESC;


-- =========================================
-- COMPONENT 2: AGGREGATE FUNCTIONS & HAVING
-- SUM, AVG, COUNT, GROUP BY, HAVING
-- =========================================

-- Q6: Total revenue per city using SUM (aggregate + GROUP BY)
SELECT l.City,
       COUNT(p.PaymentID)       AS TotalRides,
       SUM(p.Amount)            AS TotalRevenue,
       AVG(p.Amount)            AS AverageFare,
       SUM(p.Amount * 0.20)     AS PlatformCommission
FROM Payments p
JOIN Rides     r ON p.RideID = r.RideID
JOIN Locations l ON r.PickupLocationID = l.LocationID
WHERE p.PaymentStatus = 'Paid'
GROUP BY l.City
ORDER BY TotalRevenue DESC;


-- Q7: Drivers with average rating below 3.5 using AVG + HAVING
SELECT d.DriverID,
       u.FirstName, u.LastName, u.Email, u.Phone,
       u.AccountStatus,
       AVG(rat.Score)       AS AvgRating,
       COUNT(rat.RatingID)  AS TotalRatings
FROM Drivers d
JOIN Users   u   ON d.DriverID   = u.UserID
JOIN Ratings rat ON rat.RatedUserID = d.DriverID
GROUP BY d.DriverID, u.FirstName, u.LastName, u.Email, u.Phone, u.AccountStatus
HAVING AVG(rat.Score) < 3.5
ORDER BY AvgRating ASC;


-- Q8: Number of trips completed per driver using COUNT
SELECT d.DriverID,
       u.FirstName, u.LastName,
       COUNT(r.RideID)                  AS CompletedTrips,
       COALESCE(SUM(de.NetEarning), 0)  AS TotalEarned
FROM Drivers d
JOIN Users          u  ON d.DriverID  = u.UserID
LEFT JOIN Rides     r  ON r.DriverID  = d.DriverID AND r.Status = 'Completed'
LEFT JOIN Driver_Earnings de ON de.DriverID = d.DriverID
GROUP BY d.DriverID, u.FirstName, u.LastName
ORDER BY CompletedTrips DESC;


-- Q9: Revenue by payment method
SELECT PaymentMethod,
       COUNT(*)      AS TransactionCount,
       SUM(Amount)   AS TotalRevenue,
       AVG(Amount)   AS AverageAmount
FROM Payments
WHERE PaymentStatus = 'Paid'
GROUP BY PaymentMethod
ORDER BY TotalRevenue DESC;


-- Q10: Cities with total revenue exceeding 100 (HAVING on aggregate)
SELECT l.City,
       SUM(p.Amount) AS TotalRevenue
FROM Payments p
JOIN Rides     r ON p.RideID = r.RideID
JOIN Locations l ON r.PickupLocationID = l.LocationID
WHERE p.PaymentStatus = 'Paid'
GROUP BY l.City
HAVING SUM(p.Amount) > 100
ORDER BY TotalRevenue DESC;


-- =========================================
-- COMPONENT 3: JOINS FOR REPORTS
-- INNER JOIN, LEFT JOIN, Multi-table JOIN
-- =========================================

-- Q11: Full trip report — INNER JOIN linking Riders, Rides, Drivers, Vehicles
SELECT
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
ORDER BY r.ScheduledTime DESC;


-- Q12: All riders including those who never completed a ride — LEFT JOIN
SELECT
    u.UserID,
    u.FirstName,
    u.LastName,
    u.Email,
    u.Phone,
    u.AccountStatus,
    u.RegDate,
    COUNT(r.RideID)              AS TotalRides,
    COALESCE(SUM(r.Fare), 0)     AS TotalSpent
FROM Users u
LEFT JOIN Rides r ON r.RiderID = u.UserID AND r.Status = 'Completed'
WHERE u.Role = 'Rider'
GROUP BY u.UserID, u.FirstName, u.LastName, u.Email, u.Phone, u.AccountStatus, u.RegDate
ORDER BY TotalRides DESC;


-- Q13: Promo code usage per ride — JOIN on Payments and PromoCodes
SELECT pc.Code,
       pc.DiscountValue,
       pc.UsageLimit,
       pc.UsageCount,
       pc.ExpiryDate,
       pc.IsActive,
       COUNT(r.RideID)        AS RidesUsed,
       SUM(pc.DiscountValue)  AS TotalDiscountGiven
FROM Promo_Codes pc
LEFT JOIN Rides    r ON r.PromoID  = pc.PromoID
LEFT JOIN Payments p ON p.RideID   = r.RideID AND p.PaymentStatus = 'Paid'
GROUP BY pc.PromoID, pc.Code, pc.DiscountValue, pc.UsageLimit,
         pc.UsageCount, pc.ExpiryDate, pc.IsActive
ORDER BY RidesUsed DESC;


-- Q14: Driver earnings with commission breakdown
SELECT de.DriverID,
       u.FirstName, u.LastName, u.Email,
       COUNT(de.EarningID)              AS TotalRides,
       SUM(de.FareAmount)               AS TotalFare,
       SUM(de.Commission)               AS TotalCommission,
       SUM(de.NetEarning)               AS TotalNetEarning,
       u.WalletBalance                  AS CurrentWalletBalance
FROM Driver_Earnings de
JOIN Users u ON de.DriverID = u.UserID
GROUP BY de.DriverID, u.FirstName, u.LastName, u.Email, u.WalletBalance
ORDER BY TotalNetEarning DESC;


-- Q15: Ride history archive with final status
SELECT rh.HistoryID, rh.RideID, rh.ArchivedAt, rh.FinalStatus,
       r.Fare, r.Distance,
       ur.FirstName AS RiderName,
       ud.FirstName AS DriverName
FROM Ride_History rh
JOIN Rides r  ON rh.RideID  = r.RideID
JOIN Users ur ON r.RiderID  = ur.UserID
JOIN Users ud ON r.DriverID = ud.UserID
ORDER BY rh.ArchivedAt DESC;


-- Q16: Complaints report with user details
SELECT c.ComplaintID, c.Description, c.Status, c.CreatedAt,
       c.RideID,
       uf.FirstName AS FiledByFirstName, uf.LastName AS FiledByLastName,
       ua.FirstName AS AgainstFirstName, ua.LastName AS AgainstLastName,
       r.Fare, r.Status AS RideStatus
FROM Complaints c
JOIN Users uf ON c.FiledByUserID  = uf.UserID
JOIN Users ua ON c.AgainstUserID  = ua.UserID
JOIN Rides r  ON c.RideID         = r.RideID
ORDER BY c.CreatedAt DESC;


-- Q17: Revenue by city and date range
SELECT l.City,
       COUNT(p.PaymentID)       AS TotalRides,
       SUM(p.Amount)            AS TotalRevenue,
       AVG(p.Amount)            AS AvgFare,
       SUM(p.Amount * 0.20)     AS PlatformCommission
FROM Payments p
JOIN Rides     r ON p.RideID = r.RideID
JOIN Locations l ON r.PickupLocationID = l.LocationID
WHERE p.PaymentStatus = 'Paid'
  AND p.TxnDate BETWEEN '2026-01-01' AND '2026-12-31'
GROUP BY l.City
ORDER BY TotalRevenue DESC;


-- Q18: Refund and dispute totals
SELECT PaymentStatus,
       COUNT(*)                   AS Count,
       COALESCE(SUM(Amount), 0)   AS TotalAmount
FROM Payments
WHERE PaymentStatus IN ('Failed', 'Refunded')
GROUP BY PaymentStatus;


-- Q19: Driver leaderboard by city (uses the DriverLeaderboardView)
SELECT * FROM DriverLeaderboardView
ORDER BY City, AvgRating DESC;


-- Q20: Mutual ratings — both rider and driver ratings per ride
SELECT r.RideID, r.Fare,
       ur.FirstName AS RiderName,
       ud.FirstName AS DriverName,
       r_rider.Score AS RiderGaveScore, r_rider.Comment AS RiderComment,
       r_driver.Score AS DriverGaveScore, r_driver.Comment AS DriverComment
FROM Rides r
JOIN Users ur ON r.RiderID  = ur.UserID
JOIN Users ud ON r.DriverID = ud.UserID
LEFT JOIN Ratings r_rider  ON r_rider.RideID  = r.RideID AND r_rider.RaterID  = r.RiderID
LEFT JOIN Ratings r_driver ON r_driver.RideID = r.RideID AND r_driver.RaterID = r.DriverID
WHERE r.Status = 'Completed'
ORDER BY r.RideID DESC;


-- =========================================
-- DONE ✅
-- =========================================
