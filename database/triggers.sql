USE rideflow;

DELIMITER $$

-- TRIGGER 1: RIDE → RIDE_HISTORY (on Completed/Cancelled)
DROP TRIGGER IF EXISTS trg_ride_to_history$$

CREATE TRIGGER trg_ride_to_history
AFTER UPDATE ON Rides
FOR EACH ROW
BEGIN
    IF NEW.Status IN ('Completed', 'Cancelled') AND OLD.Status <> NEW.Status THEN
        INSERT INTO Ride_History (RideID, ArchivedAt, FinalStatus)
        VALUES (NEW.RideID, NOW(), NEW.Status);
    END IF;
END$$


-- TRIGGER 2: UPDATE DRIVER AVG RATING
DROP TRIGGER IF EXISTS trg_update_driver_rating$$

CREATE TRIGGER trg_update_driver_rating
AFTER INSERT ON Ratings
FOR EACH ROW
BEGIN
    UPDATE Drivers
    SET AvgRating = (
        SELECT AVG(Score)
        FROM Ratings
        WHERE RatedUserID = NEW.RatedUserID
    )
    WHERE DriverID = NEW.RatedUserID;
END$$


-- TRIGGER 3: DRIVER EARNINGS ON RIDE COMPLETION
DROP TRIGGER IF EXISTS trg_driver_earnings$$

CREATE TRIGGER trg_driver_earnings
AFTER UPDATE ON Rides
FOR EACH ROW
BEGIN
    IF NEW.Status = 'Completed' AND OLD.Status <> 'Completed' THEN
        INSERT INTO Driver_Earnings (DriverID, RideID, FareAmount, Commission, NetEarning)
        VALUES (
            NEW.DriverID,
            NEW.RideID,
            NEW.Fare,
            ROUND(NEW.Fare * 0.20, 2),
            ROUND(NEW.Fare * 0.80, 2)
        );

        -- Credit net earnings to driver's wallet
        UPDATE Users
        SET WalletBalance = WalletBalance + ROUND(NEW.Fare * 0.80, 2)
        WHERE UserID = NEW.DriverID;
    END IF;
END$$


-- TRIGGER 4: FLAG LOW RATING (AUTO SUSPEND / RECOVER)
DROP TRIGGER IF EXISTS trg_flag_low_rating$$

CREATE TRIGGER trg_flag_low_rating
AFTER INSERT ON Ratings
FOR EACH ROW
BEGIN
    DECLARE avg_rating FLOAT;
    DECLARE user_role VARCHAR(10);

    SELECT AVG(Score) INTO avg_rating
    FROM Ratings
    WHERE RatedUserID = NEW.RatedUserID;

    SELECT Role INTO user_role
    FROM Users
    WHERE UserID = NEW.RatedUserID;

    -- Flag drivers with avg rating below 3.5
    IF user_role = 'Driver' THEN
        IF avg_rating < 3.5 THEN
            UPDATE Users
            SET AccountStatus = 'Suspended'
            WHERE UserID = NEW.RatedUserID;
        ELSE
            UPDATE Users
            SET AccountStatus = 'Active'
            WHERE UserID = NEW.RatedUserID;
        END IF;
    END IF;

    -- Flag riders with avg rating below 3.0
    IF user_role = 'Rider' THEN
        IF avg_rating < 3.0 THEN
            UPDATE Users
            SET AccountStatus = 'Suspended'
            WHERE UserID = NEW.RatedUserID;
        ELSE
            UPDATE Users
            SET AccountStatus = 'Active'
            WHERE UserID = NEW.RatedUserID;
        END IF;
    END IF;
END$$


-- TRIGGER 5: AUTO-COMPLETE RIDE WHEN PAYMENT IS PAID
DROP TRIGGER IF EXISTS trg_payment_to_ride_completed$$

CREATE TRIGGER trg_payment_to_ride_completed
AFTER UPDATE ON Payments
FOR EACH ROW
BEGIN
    IF NEW.PaymentStatus = 'Paid' AND OLD.PaymentStatus <> 'Paid' THEN
        UPDATE Rides
        SET Status = 'Completed', EndTime = NOW()
        WHERE RideID = NEW.RideID AND Status = 'InProgress';
    END IF;
END$$


-- TRIGGER 6: INCREMENT PROMO USAGE COUNT
DROP TRIGGER IF EXISTS trg_promo_usage_count$$

CREATE TRIGGER trg_promo_usage_count
AFTER INSERT ON Rides
FOR EACH ROW
BEGIN
    IF NEW.PromoID IS NOT NULL THEN
        UPDATE Promo_Codes
        SET UsageCount = UsageCount + 1
        WHERE PromoID = NEW.PromoID;
    END IF;
END$$


-- TRIGGER 7: SET DRIVER STATUS TO OnTrip ON RIDE START
DROP TRIGGER IF EXISTS trg_driver_on_trip$$

CREATE TRIGGER trg_driver_on_trip
AFTER UPDATE ON Rides
FOR EACH ROW
BEGIN
    IF NEW.Status = 'InProgress' AND OLD.Status = 'EnRoute' THEN
        UPDATE Drivers
        SET AvailabilityStatus = 'OnTrip'
        WHERE DriverID = NEW.DriverID;
    END IF;

    IF NEW.Status IN ('Completed', 'Cancelled') AND OLD.Status <> NEW.Status THEN
        UPDATE Drivers
        SET AvailabilityStatus = 'Online'
        WHERE DriverID = NEW.DriverID;
    END IF;
END$$

DELIMITER ;
