const AIParserService = require('./AIParserService');

describe('AIParserService', () => {
  let parser;

  beforeEach(() => {
    parser = new AIParserService();
  });

  test('should parse standard order with standart tariff', () => {
    const result = parser.parse('Hokimiyatdan Yangi bozorga standart taksi');
    expect(result).toEqual({
      pickup: 'Hokimiyat',
      destination: 'Yangi bozor',
      tariff: 'standard',
    });
  });

  test('should parse comfort order with comfort tariff', () => {
    const result = parser.parse('Eski shahardan IT Parkga comfort taksi');
    expect(result).toEqual({
      pickup: 'Eski shahar',
      destination: 'IT Park',
      tariff: 'comfort',
    });
  });

  test('should parse order without tariff (default to standard)', () => {
    const result = parser.parse("Temir yo'l vokzalidan aeroportga");
    expect(result).toEqual({
      pickup: "Temir yo'l vokzali",
      destination: 'aeroport',
      tariff: 'standard',
    });
  });

  test('should parse business order with biznes tariff', () => {
    const result = parser.parse('Aeroportdan Toshkent City Mallga biznes taksi');
    expect(result).toEqual({
      pickup: 'Aeroport',
      destination: 'Toshkent City Mall',
      tariff: 'business',
    });
  });

  test('should parse names with Uzbek special characters', () => {
    const result = parser.parse("Chorsu bozoridan Milliy bog'ga");
    expect(result).toEqual({
      pickup: 'Chorsu bozori',
      destination: "Milliy bog'",
      tariff: 'standard',
    });
  });

  test('should handle missing pickup if "dan" suffix is missing', () => {
    const result = parser.parse('Yangi bozorga komfort taksi');
    expect(result).toEqual({
      pickup: '',
      destination: 'Yangi bozor',
      tariff: 'comfort',
    });
  });
});
