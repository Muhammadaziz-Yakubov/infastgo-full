const express = require('express');
const multer = require('multer');
const voiceOrderController = require('../controllers/voiceOrderController');
const { authMiddleware } = require('../../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// POST /api/voice-order/transcribe
router.post('/transcribe', authMiddleware, upload.single('file'), voiceOrderController.transcribe);

module.exports = router;
