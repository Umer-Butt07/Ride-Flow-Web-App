USE RideFlow;

-- =========================================
-- SAMPLE DATA SEED
-- =========================================

-- Locations
INSERT INTO Locations (Name, City, Latitude, Longitude) VALUES
('DHA Phase 1 Gate', 'Lahore', 31.4697, 74.4012),
('Gulberg III', 'Lahore', 31.5102, 74.3436),
('Model Town', 'Lahore', 31.4850, 74.3340),
('Johar Town', 'Lahore', 31.4688, 74.2817),
('Liberty Market', 'Lahore', 31.5204, 74.3587),
('Karachi Airport', 'Karachi', 24.9008, 67.1681),
('Clifton', 'Karachi', 24.8116, 67.0317);

-- Users (passwords are bcrypt hash of 'password123')
INSERT INTO Users (FirstName, LastName, Email, Phone, PasswordHash, Role, AccountStatus, WalletBalance, RegDate) VALUES
('Super', 'Admin', 'admin@rideflow.com', '03001111111', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'Admin', 'Active', 0, '2026-01-01'),
('Ali', 'Raza', 'ali.rider@gmail.com', '03002222222', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'Rider', 'Active', 500, '2026-01-10'),
('Sara', 'Khan', 'sara.rider@gmail.com', '03003333333', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'Rider', 'Active', 200, '2026-01-15'),
('Usman', 'Ahmed', 'usman.driver@gmail.com', '03004444444', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'Driver', 'Active', 0, '2026-01-05'),
('Bilal', 'Sheikh', 'bilal.driver@gmail.com', '03005555555', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'Driver', 'Active', 0, '2026-01-08');

-- Drivers
INSERT INTO Drivers (DriverID, LicenseNo, CNIC, VerificationStatus, AvailabilityStatus, AvgRating, TotalTrips) VALUES
(4, 'LHR-2021-001', '35202-1234567-1', 'Verified', 'Online', 4.7, 120),
(5, 'LHR-2022-002', '35202-7654321-2', 'Verified', 'Online', 4.2, 85);

-- Vehicles
INSERT INTO Vehicles (DriverID, VehicleType, Make, Model, Year, Color, LicensePlate, VerificationStatus) VALUES
(4, 'Economy', 'Toyota', 'Corolla', 2019, 'White', 'LEA-1234', 'Verified'),
(5, 'Bike', 'Honda', 'CD-70', 2021, 'Red', 'LEB-5678', 'Verified');

-- Promo Codes
INSERT INTO Promo_Codes (Code, DiscountValue, ExpiryDate, UsageLimit, UsageCount, IsActive) VALUES
('WELCOME50', 50, '2026-12-31', 500, 12, 1),
('RIDE20', 20, '2026-06-30', 200, 45, 1),
('EXPIRED10', 10, '2025-01-01', 100, 100, 0);

-- Ride Requests
INSERT INTO Ride_Requests (RiderID, DriverID, RequestDate, Status, PickupLocationID, DropoffLocationID) VALUES
(2, 4, '2026-04-10 09:00:00', 'Accepted', 1, 2),
(3, 5, '2026-04-11 14:00:00', 'Accepted', 3, 4),
(2, 4, '2026-04-12 18:30:00', 'Accepted', 5, 1);

-- Rides
INSERT INTO Rides (RequestID, RiderID, DriverID, VehicleID, PickupLocationID, DropoffLocationID, PromoID, Fare, Distance, Duration, ScheduledTime, StartTime, EndTime, Status) VALUES
(1, 2, 4, 1, 1, 2, 1, 180.00, 7.5, 20, '2026-04-10 09:00:00', '2026-04-10 09:10:00', '2026-04-10 09:30:00', 'Completed'),
(2, 3, 5, 2, 3, 4, NULL, 120.00, 5.0, 18, '2026-04-11 14:00:00', '2026-04-11 14:05:00', '2026-04-11 14:23:00', 'Completed'),
(3, 2, 4, 1, 5, 1, NULL, 210.00, 9.0, 25, '2026-04-12 18:30:00', '2026-04-12 18:35:00', NULL, 'InProgress');

-- Payments
INSERT INTO Payments (RideID, Amount, PaymentMethod, PaymentStatus, TxnDate) VALUES
(1, 180.00, 'Wallet', 'Paid', '2026-04-10 09:31:00'),
(2, 120.00, 'Cash', 'Paid', '2026-04-11 14:24:00');

-- Ratings
INSERT INTO Ratings (RideID, RaterID, RatedUserID, Score, Comment, Timestamp) VALUES
(1, 2, 4, 5, 'Excellent driver, very punctual!', '2026-04-10 09:45:00'),
(1, 4, 2, 4, 'Good rider, no issues.', '2026-04-10 10:00:00'),
(2, 3, 5, 4, 'Smooth ride.', '2026-04-11 14:30:00'),
(2, 5, 3, 5, 'Great passenger!', '2026-04-11 14:35:00');

-- Driver Earnings
INSERT INTO Driver_Earnings (DriverID, RideID, FareAmount, Commission, NetEarning) VALUES
(4, 1, 180.00, 36.00, 144.00),
(5, 2, 120.00, 24.00, 96.00);

-- Ride History
INSERT INTO Ride_History (RideID, ArchivedAt, FinalStatus) VALUES
(1, '2026-04-10 09:31:00', 'Completed'),
(2, '2026-04-11 14:24:00', 'Completed');

-- Complaints
INSERT INTO Complaints (RideID, FiledByUserID, AgainstUserID, Description, Status, CreatedAt) VALUES
(1, 2, 4, 'Driver took a longer route than necessary.', 'Open', '2026-04-10 10:30:00');
