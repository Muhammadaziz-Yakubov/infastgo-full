const fs = require('fs');
const UzbekVoiceSTTService = require('../services/UzbekVoiceSTTService');
const AIParserService = require('../services/AIParserService');
const GeocodingService = require('../services/GeocodingService');

const sttService = new UzbekVoiceSTTService();
const parserService = new AIParserService();
const geocodingService = new GeocodingService();

/**
 * POST /api/voice-order/transcribe
 * Accepts audio file, transcribes via UzbekVoice STT, parses entities, geocodes locations.
 */
exports.transcribe = async (req, res) => {
  let audioPath;

  try {
    console.log('[VoiceOrderController] Received voice order transcription request');

    if (!req.file) {
      console.warn('[VoiceOrderController] No audio file uploaded');
      return res.status(400).json({ success: false, message: 'Audio fayl yuklanishi shart' });
    }

    audioPath = req.file.path;
    console.log(`[VoiceOrderController] Audio uploaded: size=${req.file.size} bytes, path=${audioPath}`);

    if (req.file.size === 0) {
      cleanupFile(audioPath);
      return res.status(400).json({ success: false, message: "Ovozli xabar bo'sh bo'lishi mumkin emas" });
    }

    // 1. STT Transcription
    let text = '';
    try {
      text = await sttService.transcribe(audioPath);
      console.log(`[VoiceOrderController] Transcription result: "${text}"`);
    } catch (sttErr) {
      console.error('[VoiceOrderController] STT transcription failed:', sttErr);
      cleanupFile(audioPath);
      return res.status(500).json({
        success: false,
        message: 'Ovozni matnga aylantirishda xatolik yuz berdi',
        error: sttErr.message,
      });
    }

    if (!text || text.trim() === '') {
      cleanupFile(audioPath);
      return res.status(422).json({ success: false, message: 'Ovozli buyurtmadan nutq aniqlanmadi' });
    }

    // 2. AI Entity Parsing
    const parsed = parserService.parse(text);
    console.log('[VoiceOrderController] Parsed entities:', JSON.stringify(parsed));

    if (!parsed.pickup && !parsed.destination) {
      cleanupFile(audioPath);
      return res.status(422).json({
        success: false,
        message: "Jo'nash va borish manzillarini aniqlab bo'lmadi. Iltimos, aniqroq ayting.",
        text,
      });
    }

    // 3. Geocode Location Coordinates
    let pickupCoords = null;
    let destCoords = null;

    try {
      if (parsed.pickup) {
        pickupCoords = await geocodingService.resolve(parsed.pickup);
      }
      if (parsed.destination) {
        destCoords = await geocodingService.resolve(parsed.destination);
      }
    } catch (geoErr) {
      console.error('[VoiceOrderController] Geocoding warning:', geoErr);
    }

    // Cleanup temp file
    cleanupFile(audioPath);

    return res.status(200).json({
      success: true,
      text,
      parsed,
      coordinates: {
        pickup: pickupCoords,
        destination: destCoords,
      },
    });
  } catch (error) {
    console.error('[VoiceOrderController] Unexpected error:', error);
    if (audioPath) cleanupFile(audioPath);
    return res.status(500).json({ success: false, message: 'Kutilmagan xatolik yuz berdi' });
  }
};

function cleanupFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`[VoiceOrderController] Failed to delete temp file: ${filePath}`, err);
    } else {
      console.log(`[VoiceOrderController] Temp file cleaned up: ${filePath}`);
    }
  });
}
