const express = require('express');
const router = express.Router();
const placesController = require('../controllers/placesController');

// Public endpoints — no auth required
router.get('/', placesController.searchPlaces);
router.get('/reverse', placesController.reverseGeocode);
router.get('/count', placesController.getCount);

module.exports = router;
