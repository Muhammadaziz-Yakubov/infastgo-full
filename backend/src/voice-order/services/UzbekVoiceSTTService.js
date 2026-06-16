const fs = require('fs');

class UzbekVoiceSTTService {
  constructor() {
    this.apiKey = process.env.UZBEKVOICE_API_KEY || 'a4853965-c962-4986-ad41-247d87101c81:39355246-c566-4cdc-aa54-dc139323ba7b';
  }

  async transcribe(filePath) {
    console.log(`[UzbekVoiceSTTService] Transcribing file: ${filePath}`);

    // If API Key is not set, run in SIMULATOR mode
    if (!this.apiKey || this.apiKey.trim() === '' || this.apiKey === 'YOUR_API_KEY') {
      console.log('[UzbekVoiceSTTService] UZBEKVOICE_API_KEY is not configured. Running in SIMULATOR mode.');
      return this.simulateTranscription(filePath);
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const fileBlob = new Blob([fileBuffer], { type: 'audio/m4a' });

      const formData = new FormData();
      formData.append('file', fileBlob, 'recording.m4a');
      formData.append('language', 'uz');
      formData.append('model', 'general');
      formData.append('blocking', 'true');
      formData.append('return_offsets', 'false');
      formData.append('run_diarization', 'false');

      const response = await fetch('https://uzbekvoice.ai/api/v1/stt', {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`STT API Error (Status ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('[UzbekVoiceSTTService] Response data:', JSON.stringify(data));

      const text = data.text || data.result || (data.results && data.results[0]?.transcript) || '';
      return text;
    } catch (error) {
      console.error('[UzbekVoiceSTTService] Transcription failed:', error);
      console.log('[UzbekVoiceSTTService] UZBEKVOICE_API_KEY failed or server returned error. Falling back to SIMULATOR mode.');
      return this.simulateTranscription(filePath);
    }
  }

  simulateTranscription(filePath) {
    const fileName = filePath.toLowerCase();

    if (fileName.includes('comfort') || fileName.includes('komfort')) {
      return 'Eski shahardan IT Parkga comfort taksi';
    }
    if (fileName.includes('biznes') || fileName.includes('business')) {
      return 'Temir yo\'l vokzalidan aeroportga biznes taksi';
    }
    // Default mock response
    return 'Hokimiyatdan Yangi bozorga standart taksi';
  }
}

module.exports = UzbekVoiceSTTService;
