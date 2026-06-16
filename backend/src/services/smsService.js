const dotenv = require('dotenv');
dotenv.config();

const DEVSMS_API_URL = 'https://devsms.uz/api/send_sms.php';

/**
 * Send an OTP code to a phone number via DevSMS.uz API.
 * Uses the "universal_otp" message type for pre-approved OTP templates.
 *
 * @param {string} phone - Target phone number in format like +998901234567
 * @param {string} code - 6-digit confirmation code
 */
const sendOTP = async (phone, code) => {
  const mode = process.env.SMS_MODE || 'mock';
  const apiKey = process.env.DEVSMS_API_KEY;

  console.log(`[SMS Service] Sending OTP to ${phone} | Mode: ${mode}`);

  if (mode === 'production') {
    if (!apiKey) {
      throw new Error('DEVSMS_API_KEY is not set in environment variables');
    }

    // Remove the "+" prefix — DevSMS expects 998XXXXXXXXX
    const cleanPhone = phone.replace('+', '');

    // Use universal_otp type for fast OTP delivery via pre-approved templates
    const payload = {
      phone: cleanPhone,
      type: 'universal_otp',
      template_type: 4,           // 4 = Login confirmation
      service_name: 'InFast Go',
      otp_code: code,
    };

    try {
      const response = await fetch(DEVSMS_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      console.log(`[SMS Service] DevSMS Response:`, data);

      if (!response.ok) {
        throw new Error(`DevSMS API error: ${data.message || data.error || JSON.stringify(data)}`);
      }

      return { success: true, provider: 'devsms', data };
    } catch (error) {
      console.error(`[SMS Service ERROR] Failed to send SMS via DevSMS:`, error.message);

      // Fallback: log OTP to console so the system doesn't completely break
      console.log(`\n==============================================`);
      console.log(`⚠️  SMS FALLBACK (DevSMS failed): OTP for ${phone} is ${code}`);
      console.log(`==============================================\n`);

      // Don't throw — allow the user to still receive OTP from devOTP response in dev
      return { success: false, provider: 'devsms', error: error.message };
    }
  } else {
    // LOCAL DEVELOPMENT MOCK MODE
    const message = `InFast Go tasdiqlash kodi: ${code}`;
    console.log(`\n==============================================`);
    console.log(`💌 SMS MOCK: Sent to ${phone}`);
    console.log(`💬 Message: "${message}"`);
    console.log(`==============================================\n`);
    return { success: true, provider: 'mock', code };
  }
};

module.exports = {
  sendOTP,
};
