export function normalizeProfileSocialLinks(profile = {}) {
  const socialLinks = profile.social_links || profile.socialLinks || {};

  return {
    portfolioWebsite: profile.portfolio_website || profile.portfolioWebsite || socialLinks.portfolioWebsite || socialLinks.portfolio_website || '',
    github: profile.github || socialLinks.github || '',
    linkedin: profile.linkedin || socialLinks.linkedin || '',
    twitter: profile.twitter || socialLinks.twitter || '',
    instagram: profile.instagram || socialLinks.instagram || '',
    facebook: profile.facebook || socialLinks.facebook || '',
    tiktok: profile.tiktok || socialLinks.tiktok || '',
    whatsapp: profile.whatsapp || socialLinks.whatsapp || '',
  };
}
