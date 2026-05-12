const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl      = require('../controllers/reports.controller');

// All report endpoints require Admin role
router.use(auth, roleGuard('Admin'));

// Basic SQL queries
router.get('/rider-rides',         ctrl.getRiderRides);
router.get('/drivers-by-city',     ctrl.getDriversByCity);

// Aggregate functions + HAVING
router.get('/revenue-by-city',     ctrl.getRevenueByCity);
router.get('/low-rated-drivers',   ctrl.getLowRatedDrivers);
router.get('/trips-per-driver',    ctrl.getTripsPerDriver);

// JOINs
router.get('/full-trip-report',    ctrl.getFullTripReport);
router.get('/all-riders',          ctrl.getAllRiders);
router.get('/promo-usage',         ctrl.getPromoUsage);

// Views
router.get('/active-rides',        ctrl.getActiveRides);
router.get('/top-drivers',         ctrl.getTopDrivers);

// Financial
router.get('/revenue-by-payment',  ctrl.getRevenueByPayment);
router.get('/refunds',             ctrl.getRefunds);
router.get('/revenue-by-city-date', ctrl.getRevenueByCityDate);
router.get('/driver-earnings',     ctrl.getDriverEarningsReport);
router.get('/leaderboard',         ctrl.getLeaderboard);

module.exports = router;
