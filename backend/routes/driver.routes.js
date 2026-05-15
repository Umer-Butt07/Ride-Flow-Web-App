const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl      = require('../controllers/driver.controller');

// All driver routes require JWT + Driver role
router.use(auth, roleGuard('Driver'));

router.get('/dashboard',              ctrl.getDashboard);
router.patch('/availability',         ctrl.setAvailability);
router.get('/requests',               ctrl.getRequests);
router.patch('/requests/:id/accept',  ctrl.acceptRequest);
router.patch('/requests/:id/reject',  ctrl.rejectRequest);
router.get('/current-ride',           ctrl.getCurrentRide);
router.patch('/rides/:id/status',     ctrl.updateRideStatus);
router.get('/earnings',               ctrl.getEarnings);
router.get('/earnings/history',       ctrl.getEarningsHistory);
router.get('/rides/history',          ctrl.getRideHistory);
router.get('/profile',                ctrl.getProfile);
router.post('/payout',                ctrl.requestPayout);
router.post('/rides/:id/rate',        ctrl.rateRider);
router.post('/vehicles',              ctrl.registerVehicle);
router.get('/vehicles',               ctrl.getVehicles);
router.patch('/city',                 ctrl.updateCity);

module.exports = router;
