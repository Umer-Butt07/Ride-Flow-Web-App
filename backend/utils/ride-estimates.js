const VEHICLE_TYPES = ['Economy', 'Premium', 'Bike'];

const normalizeVehicleType = (value = 'Economy') => {
  const cleaned = String(value).trim().toLowerCase();
  if (cleaned === 'premium' || cleaned === 'suv') return 'Premium';
  if (cleaned === 'bike') return 'Bike';
  return 'Economy';
};

const toRadians = (degrees) => degrees * (Math.PI / 180);

const calculateDistanceKm = (pickup, dropoff) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(Number(dropoff.Latitude) - Number(pickup.Latitude));
  const dLng = toRadians(Number(dropoff.Longitude) - Number(pickup.Longitude));
  const lat1 = toRadians(Number(pickup.Latitude));
  const lat2 = toRadians(Number(dropoff.Latitude));

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0.5, Number((earthRadiusKm * c).toFixed(2)));
};

const calculateDurationMinutes = (distanceKm, vehicleType) => {
  const averageSpeed = vehicleType === 'Bike' ? 22 : 26;
  return Math.max(0, Math.ceil((distanceKm / averageSpeed) * 60));
};

const calculateFare = (distanceKm, durationMinutes, vehicleType, promoDiscount = 0) => {
  const rates = {
    Economy: { base: 50, perKm: 20, perMin: 3 },
    Premium: { base: 100, perKm: 35, perMin: 5 },
    Bike: { base: 30, perKm: 12, perMin: 2 },
  };
  const rate = rates[vehicleType] || rates.Economy;
  const hour = new Date().getHours();
  const surge = (hour >= 7 && hour < 9) || (hour >= 17 && hour < 20) ? 1.5 : 1;
  const fare = ((rate.base + rate.perKm * distanceKm + rate.perMin * durationMinutes) * surge) - promoDiscount;
  return Number(Math.max(0, fare).toFixed(2));
};

const getPromo = async (db, promoCode) => {
  if (!promoCode) return { promoId: null, discount: 0 };
  const [rows] = await db.execute(
    `SELECT PromoID, DiscountValue
     FROM Promo_Codes
     WHERE Code = ? AND IsActive = 1 AND ExpiryDate >= CURDATE() AND UsageCount < UsageLimit
     LIMIT 1`,
    [promoCode]
  );
  if (!rows.length) return null;
  return { promoId: rows[0].PromoID, discount: Number(rows[0].DiscountValue || 0) };
};

const estimateRoute = async (db, pickupLocationId, dropoffLocationId, vehicleTypeInput, promoCode) => {
  const vehicleType = normalizeVehicleType(vehicleTypeInput);
  const [locations] = await db.execute(
    `SELECT LocationID, Name, City, Latitude, Longitude
     FROM Locations
     WHERE LocationID IN (?, ?)`,
    [pickupLocationId, dropoffLocationId]
  );

  const pickup = locations.find((loc) => Number(loc.LocationID) === Number(pickupLocationId));
  const dropoff = locations.find((loc) => Number(loc.LocationID) === Number(dropoffLocationId));
  if (!pickup || !dropoff) return null;

  const promo = await getPromo(db, promoCode);
  if (promoCode && !promo) return { invalidPromo: true };

  const distance = calculateDistanceKm(pickup, dropoff);
  const duration = calculateDurationMinutes(distance, vehicleType);
  const fare = calculateFare(distance, duration, vehicleType, promo?.discount || 0);

  return {
    pickup,
    dropoff,
    vehicleType,
    promoId: promo?.promoId || null,
    distance,
    duration,
    fare,
  };
};

module.exports = {
  VEHICLE_TYPES,
  normalizeVehicleType,
  calculateDistanceKm,
  calculateDurationMinutes,
  calculateFare,
  estimateRoute,
};
