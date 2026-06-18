USE rideflow;

ALTER TABLE Ride_Requests
  MODIFY Status ENUM('Requested', 'Accepted', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Requested',
  ADD COLUMN RequestedVehicleType ENUM('Economy', 'Premium', 'Bike') NOT NULL DEFAULT 'Economy' AFTER DropoffLocationID,
  ADD COLUMN PromoID INT NULL AFTER RequestedVehicleType,
  ADD COLUMN EstimatedFare FLOAT NOT NULL DEFAULT 0 AFTER PromoID,
  ADD COLUMN EstimatedDistance FLOAT NOT NULL DEFAULT 0 AFTER EstimatedFare,
  ADD COLUMN EstimatedDuration FLOAT NOT NULL DEFAULT 0 AFTER EstimatedDistance,
  ADD CONSTRAINT fk_ride_requests_promo
    FOREIGN KEY (PromoID) REFERENCES Promo_Codes(PromoID);
