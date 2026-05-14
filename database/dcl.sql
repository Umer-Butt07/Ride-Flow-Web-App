-- =========================================
-- RideFlow DCL — Role-Based Access Control
-- Run AFTER schema.sql as root/admin user
-- =========================================

USE rideflow;

-- =========================================
-- Create MySQL Roles
-- =========================================
DROP ROLE IF EXISTS rider_role;
DROP ROLE IF EXISTS driver_role;
DROP ROLE IF EXISTS support_role;
DROP ROLE IF EXISTS admin_role;

CREATE ROLE rider_role;
CREATE ROLE driver_role;
CREATE ROLE support_role;
CREATE ROLE admin_role;

-- =========================================
-- driver_role: can view rides and update own status
-- =========================================
GRANT SELECT ON RideFlow.Rides          TO driver_role;
GRANT SELECT ON RideFlow.Ride_Requests  TO driver_role;
GRANT SELECT ON RideFlow.Locations      TO driver_role;
GRANT SELECT ON RideFlow.Vehicles       TO driver_role;
GRANT SELECT ON RideFlow.Driver_Earnings TO driver_role;
GRANT SELECT ON RideFlow.Ratings        TO driver_role;
GRANT UPDATE ON RideFlow.Rides          TO driver_role;
GRANT UPDATE ON RideFlow.Drivers        TO driver_role;
GRANT UPDATE ON RideFlow.Ride_Requests  TO driver_role;

-- =========================================
-- rider_role: can request rides and make payments
-- =========================================
GRANT SELECT, INSERT ON RideFlow.Ride_Requests TO rider_role;
GRANT SELECT, INSERT ON RideFlow.Rides         TO rider_role;
GRANT SELECT, INSERT ON RideFlow.Payments      TO rider_role;
GRANT SELECT, INSERT ON RideFlow.Ratings       TO rider_role;
GRANT SELECT          ON RideFlow.Locations    TO rider_role;
GRANT SELECT          ON RideFlow.Promo_Codes  TO rider_role;
GRANT SELECT          ON RideFlow.Drivers      TO rider_role;
GRANT SELECT          ON RideFlow.Vehicles     TO rider_role;

-- =========================================
-- support_role: read-only + can update complaints
-- Cannot delete any data
-- =========================================
GRANT SELECT            ON RideFlow.*          TO support_role;
GRANT INSERT, UPDATE    ON RideFlow.Complaints TO support_role;
REVOKE DELETE           ON RideFlow.*          FROM support_role;

-- =========================================
-- admin_role: full privileges across all tables
-- =========================================
GRANT ALL PRIVILEGES ON RideFlow.* TO admin_role;

-- =========================================
-- Create Application DB Users and assign roles
-- =========================================

-- App service account (used by the Node.js backend)
DROP USER IF EXISTS 'rideflow_app'@'localhost';
CREATE USER 'rideflow_app'@'localhost' IDENTIFIED BY 'RideFlow@App2026!';
GRANT rider_role, driver_role, support_role TO 'rideflow_app'@'localhost';
SET DEFAULT ROLE rider_role, driver_role, support_role 
TO 'rideflow_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON RideFlow.* TO 'rideflow_app'@'localhost';

-- Admin account
DROP USER IF EXISTS 'rideflow_admin'@'localhost';
CREATE USER 'rideflow_admin'@'localhost' IDENTIFIED BY 'RideFlow@Admin2026!';
GRANT admin_role TO 'rideflow_admin'@'localhost';
SET DEFAULT ROLE admin_role TO 'rideflow_admin'@'localhost';
GRANT ALL PRIVILEGES ON RideFlow.* TO 'rideflow_admin'@'localhost';

FLUSH PRIVILEGES;
