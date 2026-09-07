const { formatNumber, formatBytes } = require('./analyzer-legacy.js');

describe('analyzer-legacy.js numerical formatting', () => {
  describe('formatNumber', () => {
    it('should format numbers according to compact notation', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(100)).toBe('100');
      expect(formatNumber(1000)).toBe('1K');
      expect(formatNumber(1500)).toBe('1.5K');
      expect(formatNumber(1000000)).toBe('1M');
      expect(formatNumber(2500000)).toBe('2.5M');
    });

    it('should handle falsy or undefined values as 0', () => {
      expect(formatNumber(undefined)).toBe('0');
      expect(formatNumber(null)).toBe('0');
      expect(formatNumber('')).toBe('0');
      expect(formatNumber(NaN)).toBe('0');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly in different units', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1023)).toBe('1023 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1048576)).toBe('1.0 MB'); // 1024 * 1024
      expect(formatBytes(1048576 * 1.5)).toBe('1.5 MB');
      expect(formatBytes(1073741824)).toBe('1.0 GB'); // 1024^3
    });

    it('should truncate fraction digits for values >= 10 in units', () => {
      expect(formatBytes(1024 * 10)).toBe('10 KB'); // instead of 10.0 KB
      expect(formatBytes(1024 * 1024 * 25)).toBe('25 MB');
    });

    it('should handle non-finite numbers and edge cases', () => {
      expect(formatBytes(undefined)).toBe('0 B');
      expect(formatBytes(null)).toBe('0 B');
      expect(formatBytes(NaN)).toBe('0 B');

      expect(formatBytes(Infinity)).toBe('Infinity B');
      expect(formatBytes(-Infinity)).toBe('0 B');
    });

    it('should handle negative numbers by treating them as 0 for formatting', () => {
      expect(formatBytes(-100)).toBe('0 B');
    });
  });
});
