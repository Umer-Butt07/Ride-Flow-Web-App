USE rideflow;

-- =========================================
-- VIEW 1: ActiveRidesView
-- Shows all ongoing trips with full rider and driver details
-- =========================================
CREATE OR REPLACE VIEW ActiveRidesView AS
SELECT
    r.RideID,
    r.Status,
    r.Fare,
    r.Distance,
    r.Duration,
    r.ScheduledTime,
    r.StartTime,

    -- Rider Info
    u_rider.UserID   AS RiderID,
    u_rider.FirstName AS RiderFirstName,
    u_rider.LastName  AS RiderLastName,
    u_rider.Phone     AS RiderPhone,

    -- Driver Info
    u_driver.UserID   AS DriverID,
    u_driver.FirstName AS DriverFirstName,
    u_driver.LastName  AS DriverLastName,
    u_driver.Phone     AS DriverPhone,
    d.AvgRating        AS DriverRating,

    -- Vehicle Info
    v.Make          AS VehicleMake,
    v.Model         AS VehicleModel,
    v.Color         AS VehicleColor,
    v.LicensePlate,
    v.VehicleType,

    -- Locations
    pl.Name AS PickupLocation,
    pl.City AS PickupCity,
    dl.Name AS DropoffLocation,
    dl.City AS DropoffCity

FROM Rides r
JOIN Users    u_rider  ON r.RiderID  = u_rider.UserID
JOIN Users    u_driver ON r.DriverID = u_driver.UserID
JOIN Drivers  d        ON r.DriverID = d.DriverID
JOIN Vehicles v        ON r.VehicleID = v.VehicleID
JOIN Locations pl      ON r.PickupLocationID  = pl.LocationID
JOIN Locations dl      ON r.DropoffLocationID = dl.LocationID
WHERE r.Status IN ('EnRoute', 'InProgress');

-- =========================================
-- VIEW 2: TopDriversView
-- Shows only drivers with average rating above 4.5
-- =========================================
CREATE OR REPLACE VIEW TopDriversView AS
SELECT
    d.DriverID,
    u.FirstName,
    u.LastName,
    u.Phone,
    u.Email,
    d.AvgRating,
    d.TotalTrips,
    d.AvailabilityStatus,
    d.VerificationStatus,
    v.VehicleType,
    v.Make,
    v.Model,
    v.LicensePlate
FROM Drivers d
JOIN Users    u ON d.DriverID  = u.UserID
LEFT JOIN Vehicles v ON v.DriverID = d.DriverID
WHERE d.AvgRating > 4.5
  AND d.VerificationStatus = 'Verified'
ORDER BY d.AvgRating DESC;

-- =========================================
-- VIEW 3: DriverLeaderboardView
-- Live leaderboard of top-rated drivers per city
-- =========================================
CREATE OR REPLACE VIEW DriverLeaderboardView AS
SELECT
    d.DriverID,
    u.FirstName,
    u.LastName,
    u.Phone,
    u.Email,
    d.AvgRating,
    d.TotalTrips,
    d.AvailabilityStatus,
    v.VehicleType,
    v.Make,
    v.Model,
    v.LicensePlate,
    l.City
FROM Drivers d
JOIN Users     u ON d.DriverID = u.UserID
LEFT JOIN Vehicles v ON v.DriverID = d.DriverID
LEFT JOIN Rides r ON r.DriverID = d.DriverID
LEFT JOIN Locations l ON r.PickupLocationID = l.LocationID
WHERE d.VerificationStatus = 'Verified'
  AND u.AccountStatus = 'Active'
GROUP BY d.DriverID, u.FirstName, u.LastName, u.Phone, u.Email,
         d.AvgRating, d.TotalTrips, d.AvailabilityStatus,
         v.VehicleType, v.Make, v.Model, v.LicensePlate, l.City
ORDER BY l.City, d.AvgRating DESC;
