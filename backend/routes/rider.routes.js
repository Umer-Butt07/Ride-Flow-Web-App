const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl      = require('../controllers/rider.controller');

router.use(auth, roleGuard('Rider'));

router.get('/dashboard',          ctrl.getDashboard);
router.get('/rides/history',      ctrl.getRideHistory);
router.get('/rides/active',       ctrl.getActiveRide);
router.post('/rides/estimate',    ctrl.estimateRide);
router.post('/rides/request',     ctrl.requestRide);
router.post('/rides/schedule',    ctrl.scheduleRide);
router.post('/rides/:id/rate',    ctrl.rateRide);
router.post('/rides/:id/complain',ctrl.complainRide);
router.post('/rides/:id/pay',     ctrl.payRide);
router.post('/rides/:id/cancel',  ctrl.cancelRide);
router.post('/requests/:id/cancel', ctrl.cancelRequest);
router.get('/locations',          ctrl.getLocations);

module.exports = router;
