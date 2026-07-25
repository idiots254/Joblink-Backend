import { getPublicAssetUrl } from './publicAssetUrl';

describe('getPublicAssetUrl', () => {
  const originalPublicUrl = process.env.PUBLIC_URL;

  afterEach(() => {
    process.env.PUBLIC_URL = originalPublicUrl;
  });

  it('returns a relative path when PUBLIC_URL is empty', () => {
    process.env.PUBLIC_URL = '';
    expect(getPublicAssetUrl('/LinkWhite.png')).toBe('./LinkWhite.png');
  });

  it('prefixes a non-empty PUBLIC_URL', () => {
    process.env.PUBLIC_URL = '/joblink';
    expect(getPublicAssetUrl('/LinkWhite.png')).toBe('/joblink/LinkWhite.png');
  });
});
