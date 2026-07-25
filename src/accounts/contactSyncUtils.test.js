import { buildWhatsappUrl, getSharedContactNumber, getDigitsOnly } from './contactSyncUtils';

describe('contactSyncUtils', () => {
  it('builds a WhatsApp URL using the selected country code and shared number', () => {
    expect(buildWhatsappUrl('+254', '712345678')).toBe('https://wa.me/254712345678');
  });

  it('extracts the shared local number from the phone field or WhatsApp URL', () => {
    expect(getSharedContactNumber('712345678', '', '+254')).toBe('712345678');
    expect(getSharedContactNumber('', 'https://wa.me/254712345678', '+254')).toBe('712345678');
  });

  it('keeps only digits from mixed phone values', () => {
    expect(getDigitsOnly('+254 712 345 678')).toBe('254712345678');
  });
});
