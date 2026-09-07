const { resolveRelative } = require('./web-preview.js');

describe('resolveRelative', () => {
  it('returns ref directly if it is falsy', () => {
    expect(resolveRelative('index.html', '')).toBe('');
    expect(resolveRelative('index.html', null)).toBe(null);
    expect(resolveRelative('index.html', undefined)).toBe(undefined);
  });

  it('returns ref directly if it is not a local ref (e.g. absolute URL, javascript:)', () => {
    expect(resolveRelative('index.html', 'https://example.com/style.css')).toBe('https://example.com/style.css');
    expect(resolveRelative('index.html', 'mailto:test@test.com')).toBe('mailto:test@test.com');
    expect(resolveRelative('index.html', 'javascript:alert(1)')).toBe('javascript:alert(1)');
    expect(resolveRelative('index.html', '#hash')).toBe('#hash');
    expect(resolveRelative('index.html', 'data:image/png;base64,')).toBe('data:image/png;base64,');
  });

  it('normalizes absolute paths (starting with /)', () => {
    expect(resolveRelative('subdir/index.html', '/style.css')).toBe('style.css');
    expect(resolveRelative('index.html', '/assets/img.png')).toBe('assets/img.png');
  });

  it('resolves simple relative paths from root level', () => {
    expect(resolveRelative('index.html', 'style.css')).toBe('style.css');
    expect(resolveRelative('index.html', './style.css')).toBe('style.css');
    expect(resolveRelative('index.html', 'assets/img.png')).toBe('assets/img.png');
    expect(resolveRelative('index.html', './assets/img.png')).toBe('assets/img.png');
  });

  it('resolves relative paths from subdirectories', () => {
    expect(resolveRelative('css/main.css', 'fonts.css')).toBe('css/fonts.css');
    expect(resolveRelative('css/main.css', './fonts.css')).toBe('css/fonts.css');
    expect(resolveRelative('a/b/c.html', 'd.html')).toBe('a/b/d.html');
  });

  it('resolves paths with parent directories (..)', () => {
    expect(resolveRelative('css/main.css', '../index.html')).toBe('index.html');
    expect(resolveRelative('a/b/c.html', '../d.html')).toBe('a/d.html');
    expect(resolveRelative('a/b/c/d.html', '../../img.png')).toBe('a/img.png');
    expect(resolveRelative('a/b/c/d.html', '../../../root.js')).toBe('root.js');
  });

  it('handles paths trying to go above root', () => {
    expect(resolveRelative('index.html', '../style.css')).toBe('style.css');
    expect(resolveRelative('a/b.html', '../../../style.css')).toBe('style.css');
  });

  it('handles path segments with current directory (.) correctly inside complex paths', () => {
    expect(resolveRelative('a/b/c.html', './.././d/./e.html')).toBe('a/d/e.html');
    expect(resolveRelative('index.html', './a/./b/./c.html')).toBe('a/b/c.html');
  });

  // verify the test fails properly when we break it (manual validation logic)
});
