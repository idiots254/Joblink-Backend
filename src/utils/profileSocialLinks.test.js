import { normalizeProfileSocialLinks } from './profileSocialLinks';

describe('normalizeProfileSocialLinks', () => {
  it('reads social links from flat profile fields and nested social_links payloads', () => {
    const result = normalizeProfileSocialLinks({
      portfolio_website: 'https://example.com',
      github: 'https://github.com/test',
      linkedin: 'https://linkedin.com/in/test',
      social_links: {
        twitter: 'https://twitter.com/test',
        instagram: 'https://instagram.com/test',
        facebook: 'https://facebook.com/test',
        tiktok: 'https://tiktok.com/@test',
        whatsapp: 'https://wa.me/test',
      },
    });

    expect(result).toEqual({
      portfolioWebsite: 'https://example.com',
      github: 'https://github.com/test',
      linkedin: 'https://linkedin.com/in/test',
      twitter: 'https://twitter.com/test',
      instagram: 'https://instagram.com/test',
      facebook: 'https://facebook.com/test',
      tiktok: 'https://tiktok.com/@test',
      whatsapp: 'https://wa.me/test',
    });
  });
});
