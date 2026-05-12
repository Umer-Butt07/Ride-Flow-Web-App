USE RideFlow;

-- =========================================
-- MySQL Event Scheduler
-- =========================================

-- Enable the event scheduler (run once as root)
SET GLOBAL event_scheduler = ON;

-- =========================================
-- EVENT 1: Expire promo codes every midnight
-- Deactivates codes that are past their expiry date
-- =========================================
DROP EVENT IF EXISTS evt_expire_promos;

CREATE EVENT evt_expire_promos
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY)
DO
    UPDATE Promo_Codes
    SET IsActive = 0
    WHERE ExpiryDate < CURDATE()
      AND IsActive = 1;


-- =========================================
-- EVENT 2: Archive old completed/cancelled rides older than 30 days
-- into Ride_History if not already archived
-- =========================================
DROP EVENT IF EXISTS evt_archive_old_rides;

CREATE EVENT evt_archive_old_rides
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY)
DO
    INSERT IGNORE INTO Ride_History (RideID, ArchivedAt, FinalStatus)
    SELECT r.RideID, NOW(), r.Status
    FROM Rides r
    LEFT JOIN Ride_History rh ON rh.RideID = r.RideID
    WHERE r.Status IN ('Completed', 'Cancelled')
      AND r.EndTime < NOW() - INTERVAL 30 DAY
      AND rh.HistoryID IS NULL;
