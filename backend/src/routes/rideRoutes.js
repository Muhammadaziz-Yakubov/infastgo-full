const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/estimate', rideController.estimateFare);
router.post('/request', authMiddleware, rideController.requestRide);
router.post('/:rideId/accept', authMiddleware, rideController.acceptRide);
router.post('/:rideId/reject', authMiddleware, rideController.rejectRide);
router.post('/:rideId/status', authMiddleware, rideController.updateRideStatus);
router.post('/:rideId/rate', authMiddleware, rideController.rateDriver);
router.post('/:rideId/cancel', authMiddleware, rideController.cancelRide);
router.get('/history', authMiddleware, rideController.getRideHistory);
router.get('/active', authMiddleware, rideController.getActiveRide);

module.exports = router;