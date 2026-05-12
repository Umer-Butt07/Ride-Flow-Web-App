const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const ctrl      = require('../controllers/admin.controller');

router.use(auth, roleGuard('Admin'));

router.get('/dashboard',                ctrl.getAdminDashboard);
router.get('/users',                    ctrl.getUsers);
router.patch('/users/:id/status',       ctrl.updateUserStatus);
router.get('/drivers',                  ctrl.getDrivers);
router.patch('/drivers/:id/verify',     ctrl.verifyDriver);
router.get('/vehicles',                 ctrl.getVehicles);
router.get('/complaints',               ctrl.getComplaints);
router.patch('/complaints/:id',         ctrl.updateComplaintStatus);
router.get('/promos',                   ctrl.getPromos);
router.post('/promos',                  ctrl.createPromo);
router.delete('/promos/:id',            ctrl.deletePromo);

module.exports = router;
