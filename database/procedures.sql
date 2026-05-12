USE RideFlow;

DELIMITER $$

-- =========================================
-- STORED PROCEDURE 1: sp_calculate_fare
-- Calculates fare using base rate + per-km + per-minute
-- Applies surge multiplier during peak hours
-- =========================================
DROP PROCEDURE IF EXISTS sp_calculate_fare$$

CREATE PROCEDURE sp_calculate_fare(
    IN  p_distance    FLOAT,
    IN  p_duration    FLOAT,
    IN  p_vehicle_type ENUM('Economy', 'Premium', 'Bike'),
    IN  p_promo_code  VARCHAR(50),
    OUT p_fare        FLOAT
)
BEGIN
    DECLARE v_base_rate      FLOAT DEFAULT 50;
    DECLARE v_per_km         FLOAT DEFAULT 20;
    DECLARE v_per_min        FLOAT DEFAULT 3;
    DECLARE v_surge          FLOAT DEFAULT 1.0;
    DECLARE v_discount       FLOAT DEFAULT 0;
    DECLARE v_current_hour   INT;
    DECLARE v_promo_discount FLOAT DEFAULT 0;

    -- Adjust rates by vehicle type
    IF p_vehicle_type = 'Premium' THEN
        SET v_base_rate = 100;
        SET v_per_km    = 35;
        SET v_per_min   = 5;
    ELSEIF p_vehicle_type = 'Bike' THEN
        SET v_base_rate = 30;
        SET v_per_km    = 12;
        SET v_per_min   = 2;
    END IF;

    -- Surge pricing: peak hours 7-9 AM or 5-8 PM
    SET v_current_hour = HOUR(NOW());
    IF (v_current_hour >= 7 AND v_current_hour < 9) OR
       (v_current_hour >= 17 AND v_current_hour < 20) THEN
        SET v_surge = 1.5;
    END IF;

    -- Base fare calculation
    SET p_fare = (v_base_rate + (v_per_km * p_distance) + (v_per_min * p_duration)) * v_surge;

    -- Apply promo code discount if provided and valid
    IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
        SELECT DiscountValue INTO v_promo_discount
        FROM Promo_Codes
        WHERE Code = p_promo_code
          AND IsActive = 1
          AND ExpiryDate >= CURDATE()
          AND UsageCount < UsageLimit
        LIMIT 1;

        IF v_promo_discount > 0 THEN
            SET p_fare = p_fare - v_promo_discount;
        END IF;
    END IF;

    -- Ensure fare is never negative
    IF p_fare < 0 THEN
        SET p_fare = 0;
    END IF;

    SET p_fare = ROUND(p_fare, 2);
END$$


-- =========================================
-- STORED PROCEDURE 2: sp_complete_ride
-- Marks ride as Completed, inserts a Payment record
-- Driver earnings are handled by trigger
-- =========================================
DROP PROCEDURE IF EXISTS sp_complete_ride$$

CREATE PROCEDURE sp_complete_ride(
    IN p_ride_id       INT,
    IN p_payment_method ENUM('Cash', 'Wallet', 'Card')
)
BEGIN
    DECLARE v_fare   FLOAT;
    DECLARE v_status VARCHAR(20);

    SELECT Fare, Status INTO v_fare, v_status
    FROM Rides WHERE RideID = p_ride_id;

    IF v_status != 'InProgress' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ride must be InProgress to complete.';
    END IF;

    -- Update ride status (triggers will handle history + earnings)
    UPDATE Rides
    SET Status = 'Completed', EndTime = NOW()
    WHERE RideID = p_ride_id;

    -- Insert payment record
    INSERT INTO Payments (RideID, Amount, PaymentMethod, PaymentStatus, TxnDate)
    VALUES (p_ride_id, v_fare, p_payment_method, 'Paid', NOW());

    -- Increment driver total trips
    UPDATE Drivers d
    JOIN Rides r ON r.DriverID = d.DriverID
    SET d.TotalTrips = d.TotalTrips + 1
    WHERE r.RideID = p_ride_id;
END$$


-- =========================================
-- STORED PROCEDURE 3: sp_driver_earnings_summary
-- Returns total, commission, and net earnings for a driver
-- =========================================
DROP PROCEDURE IF EXISTS sp_driver_earnings_summary$$

CREATE PROCEDURE sp_driver_earnings_summary(
    IN  p_driver_id  INT,
    OUT p_total_fare FLOAT,
    OUT p_commission FLOAT,
    OUT p_net        FLOAT
)
BEGIN
    SELECT
        COALESCE(SUM(FareAmount), 0),
        COALESCE(SUM(Commission), 0),
        COALESCE(SUM(NetEarning), 0)
    INTO p_total_fare, p_commission, p_net
    FROM Driver_Earnings
    WHERE DriverID = p_driver_id;
END$$

DELIMITER ;
