class AIParserService {
  /**
   * Parses Uzbek voice order text to extract pickup, destination, and tariff.
   * @param {string} text - Transcribed text from STT
   * @returns {{ pickup: string, destination: string, tariff: string }}
   */
  parse(text) {
    const normalized = text.replace(/\s+/g, ' ').trim();

    // Find where "dan" suffix is (pickup location marker in Uzbek)
    const danRegex = /\b([\wʻʼ'`'а-яёўқғҳ-]+?)dan\b/i;
    const danMatch = normalized.match(danRegex);

    if (!danMatch) {
      // If no "dan" suffix found, try to find destination with "ga/ka/qa"
      const gaRegex = /\b([\wʻʼ'`'а-яёўқғҳ\s#-]+?)(?:ga|ka|qa)\b/i;
      const gaMatch = normalized.match(gaRegex);
      const destination = gaMatch ? gaMatch[1].trim() : '';

      return {
        pickup: '',
        destination,
        tariff: this._extractTariff(normalized),
      };
    }

    const danWord = danMatch[0];
    const danWordBase = danMatch[1];
    const danWordIndex = normalized.indexOf(danWord);

    // Everything before the "dan" word + the base of the "dan" word
    const precedingText = normalized.substring(0, danWordIndex).trim();
    const pickup = precedingText ? `${precedingText} ${danWordBase}` : danWordBase;

    // Everything after the "dan" word
    const rightPart = normalized.substring(danWordIndex + danWord.length).trim();

    // Find destination in the right part (suffix "ga", "ka", "qa")
    const gaRegex = /\b([\wʻʼ'`'а-яёўқғҳ\s#-]+?)(?:ga|ka|qa)\b/i;
    const gaMatch = rightPart.match(gaRegex);
    const destination = gaMatch ? gaMatch[1].trim() : '';

    return {
      pickup,
      destination,
      tariff: this._extractTariff(normalized),
    };
  }

  /**
   * Extracts tariff type from text
   * @param {string} text
   * @returns {string}
   */
  _extractTariff(text) {
    if (/komfort|comfort/i.test(text)) return 'comfort';
    if (/biznes|business/i.test(text)) return 'business';
    return 'standard';
  }
}

module.exports = AIParserService;
