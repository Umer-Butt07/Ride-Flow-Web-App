-- =========================================
-- RideFlow Database Schema
-- =========================================

DROP DATABASE IF EXISTS RideFlow;
CREATE DATABASE RideFlow;
USE RideFlow;

-- =========================================
-- 1. USERS
-- =========================================
CREATE TABLE Users (
    UserID       INT PRIMARY KEY AUTO_INCREMENT,
    FirstName    VARCHAR(50)  NOT NULL,
    LastName     VARCHAR(50)  NOT NULL,
    Email        VARCHAR(100) NOT NULL UNIQUE,
    Phone        VARCHAR(20)  NOT NULL,
    PasswordHash VARCHAR(255) NOT NULL,
    Role         ENUM('Admin', 'Rider', 'Driver') NOT NULL,
    AccountStatus ENUM('Active', 'Suspended', 'Banned') NOT NULL DEFAULT 'Active',
    WalletBalance FLOAT        NOT NULL DEFAULT 0,
    RegDate      DATE         NOT NULL DEFAULT (CURDATE())
);

-- =========================================
-- 2. DRIVERS
-- =========================================
CREATE TABLE Drivers (
    DriverID           INT PRIMARY KEY,
    LicenseNo          VARCHAR(50)  NOT NULL,
    CNIC               VARCHAR(20)  NOT NULL UNIQUE,
    VerificationStatus ENUM('Pending', 'Verified', 'Rejected') NOT NULL DEFAULT 'Pending',
    AvailabilityStatus ENUM('Online', 'Offline', 'OnTrip')     NOT NULL DEFAULT 'Offline',
    AvgRating          FLOAT        NOT NULL DEFAULT 0,
    TotalTrips         INT          NOT NULL DEFAULT 0,
    FOREIGN KEY (DriverID) REFERENCES Users(UserID) ON DELETE CASCADE
);

-- =========================================
-- 3. LOCATIONS
-- =========================================
CREATE TABLE Locations (
    LocationID INT PRIMARY KEY AUTO_INCREMENT,
    Name       VARCHAR(100) NOT NULL,
    City       VARCHAR(50)  NOT NULL,
    Latitude   FLOAT        NOT NULL,
    Longitude  FLOAT        NOT NULL
);

-- =========================================
-- 4. VEHICLES
-- =========================================
CREATE TABLE Vehicles (
    VehicleID          INT PRIMARY KEY AUTO_INCREMENT,
    DriverID           INT          NOT NULL,
    VehicleType        ENUM('Economy', 'Premium', 'Bike') NOT NULL,
    Make               VARCHAR(50)  NOT NULL,
    Model              VARCHAR(50)  NOT NULL,
    Year               INT          NOT NULL,
    Color              VARCHAR(30)  NOT NULL,
    LicensePlate       VARCHAR(20)  NOT NULL UNIQUE,
    VerificationStatus ENUM('Pending', 'Verified', 'Rejected') NOT NULL DEFAULT 'Pending',
    FOREIGN KEY (DriverID) REFERENCES Drivers(DriverID) ON DELETE CASCADE
);

-- =========================================
-- 5. PROMO_CODES
-- =========================================
CREATE TABLE Promo_Codes (
    PromoID      INT PRIMARY KEY AUTO_INCREMENT,
    Code         VARCHAR(50)  NOT NULL UNIQUE,
    DiscountValue FLOAT       NOT NULL,
    ExpiryDate   DATE         NOT NULL,
    UsageLimit   INT          NOT NULL DEFAULT 100,
    UsageCount   INT          NOT NULL DEFAULT 0,
    IsActive     TINYINT(1)   NOT NULL DEFAULT 1
);

-- =========================================
-- 6. RIDE_REQUESTS
-- =========================================
CREATE TABLE Ride_Requests (
    RequestID         INT PRIMARY KEY AUTO_INCREMENT,
    RiderID           INT      NOT NULL,
    DriverID          INT      NULL,
    RequestDate       DATETIME NOT NULL DEFAULT NOW(),
    Status            ENUM('Requested', 'Accepted', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Requested',
    PickupLocationID  INT      NOT NULL,
    DropoffLocationID INT      NOT NULL,
    RequestedVehicleType ENUM('Economy', 'Premium', 'Bike') NOT NULL DEFAULT 'Economy',
    PromoID           INT      NULL,
    EstimatedFare     FLOAT    NOT NULL DEFAULT 0,
    EstimatedDistance FLOAT    NOT NULL DEFAULT 0,
    EstimatedDuration FLOAT    NOT NULL DEFAULT 0,

    FOREIGN KEY (RiderID)           REFERENCES Users(UserID),
    FOREIGN KEY (DriverID)          REFERENCES Drivers(DriverID),
    FOREIGN KEY (PickupLocationID)  REFERENCES Locations(LocationID),
    FOREIGN KEY (DropoffLocationID) REFERENCES Locations(LocationID),
    FOREIGN KEY (PromoID)           REFERENCES Promo_Codes(PromoID)
);

-- =========================================
-- 7. RIDES (CORE TABLE)
-- =========================================
CREATE TABLE Rides (
    RideID            INT PRIMARY KEY AUTO_INCREMENT,
    RequestID         INT      NOT NULL,
    RiderID           INT      NOT NULL,
    DriverID          INT      NOT NULL,
    VehicleID         INT      NOT NULL,
    PickupLocationID  INT      NOT NULL,
    DropoffLocationID INT      NOT NULL,
    PromoID           INT      NULL,
    Fare              FLOAT    NOT NULL DEFAULT 0,
    Distance          FLOAT    NOT NULL DEFAULT 0,
    Duration          FLOAT    NOT NULL DEFAULT 0,
    ScheduledTime     DATETIME NOT NULL DEFAULT NOW(),
    StartTime         DATETIME NULL,
    EndTime           DATETIME NULL,
    Status            ENUM('EnRoute', 'InProgress', 'Completed', 'Cancelled') NOT NULL DEFAULT 'EnRoute',

    FOREIGN KEY (RequestID)         REFERENCES Ride_Requests(RequestID),
    FOREIGN KEY (RiderID)           REFERENCES Users(UserID),
    FOREIGN KEY (DriverID)          REFERENCES Drivers(DriverID),
    FOREIGN KEY (VehicleID)         REFERENCES Vehicles(VehicleID),
    FOREIGN KEY (PickupLocationID)  REFERENCES Locations(LocationID),
    FOREIGN KEY (DropoffLocationID) REFERENCES Locations(LocationID),
    FOREIGN KEY (PromoID)           REFERENCES Promo_Codes(PromoID)
);

-- =========================================
-- 8. PAYMENTS
-- =========================================
CREATE TABLE Payments (
    PaymentID     INT PRIMARY KEY AUTO_INCREMENT,
    RideID        INT  NOT NULL UNIQUE,
    Amount        FLOAT NOT NULL,
    PaymentMethod ENUM('Cash', 'Wallet', 'Card') NOT NULL,
    PaymentStatus ENUM('Pending', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Pending',
    TxnDate       DATETIME NOT NULL DEFAULT NOW(),

    FOREIGN KEY (RideID) REFERENCES Rides(RideID) ON DELETE CASCADE
);

-- =========================================
-- 9. RATINGS
-- =========================================
CREATE TABLE Ratings (
    RatingID    INT PRIMARY KEY AUTO_INCREMENT,
    RideID      INT      NOT NULL,
    RaterID     INT      NOT NULL,
    RatedUserID INT      NOT NULL,
    Score       INT      NOT NULL CHECK (Score BETWEEN 1 AND 5),
    Comment     TEXT,
    Timestamp   DATETIME NOT NULL DEFAULT NOW(),

    FOREIGN KEY (RideID)      REFERENCES Rides(RideID),
    FOREIGN KEY (RaterID)     REFERENCES Users(UserID),
    FOREIGN KEY (RatedUserID) REFERENCES Users(UserID)
);

-- =========================================
-- 10. DRIVER_EARNINGS
-- =========================================
CREATE TABLE Driver_Earnings (
    EarningID  INT PRIMARY KEY AUTO_INCREMENT,
    DriverID   INT   NOT NULL,
    RideID     INT   NOT NULL,
    FareAmount FLOAT NOT NULL,
    Commission FLOAT NOT NULL,
    NetEarning FLOAT NOT NULL,

    FOREIGN KEY (DriverID) REFERENCES Drivers(DriverID),
    FOREIGN KEY (RideID)   REFERENCES Rides(RideID)
);

-- =========================================
-- 11. COMPLAINTS
-- =========================================
CREATE TABLE Complaints (
    ComplaintID    INT PRIMARY KEY AUTO_INCREMENT,
    RideID         INT         NOT NULL,
    FiledByUserID  INT         NOT NULL,
    AgainstUserID  INT         NOT NULL,
    Description    TEXT        NOT NULL,
    Status         VARCHAR(50) NOT NULL DEFAULT 'Open',
    CreatedAt      DATETIME    NOT NULL DEFAULT NOW(),

    FOREIGN KEY (RideID)        REFERENCES Rides(RideID),
    FOREIGN KEY (FiledByUserID) REFERENCES Users(UserID),
    FOREIGN KEY (AgainstUserID) REFERENCES Users(UserID)
);

-- =========================================
-- 12. RIDE_HISTORY
-- =========================================
CREATE TABLE Ride_History (
    HistoryID   INT PRIMARY KEY AUTO_INCREMENT,
    RideID      INT         NOT NULL,
    ArchivedAt  DATETIME    NOT NULL DEFAULT NOW(),
    FinalStatus VARCHAR(50) NOT NULL,

    FOREIGN KEY (RideID) REFERENCES Rides(RideID)
);

-- =========================================
-- INDEXES (Performance)
-- =========================================
CREATE INDEX idx_rides_rider_id    ON Rides(RiderID);
CREATE INDEX idx_rides_driver_id   ON Rides(DriverID);
CREATE INDEX idx_rides_status      ON Rides(Status);
CREATE INDEX idx_locations_city    ON Locations(City);
CREATE INDEX idx_requests_status   ON Ride_Requests(Status);
CREATE INDEX idx_payments_status   ON Payments(PaymentStatus);

-- =========================================
-- DONE ✅
-- =========================================
