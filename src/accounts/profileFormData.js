export const getInitialProfileData = (accountToUse, loginUser) => {
  const storedProfession = (() => {
    try {
      const selected = localStorage.getItem('selectedProfession');
      return selected ? JSON.parse(selected) : null;
    } catch {
      return null;
    }
  })();
  const defaultTitle = storedProfession?.sector || storedProfession?.industry || storedProfession?.name || '';

  if (accountToUse) {
    const fallbackAvatar = localStorage.getItem('userAvatar') || loginUser?.avatar || null;
    const normalizedSkills = Array.isArray(accountToUse.skills)
      ? accountToUse.skills.join(', ')
      : (accountToUse.skills || accountToUse.skill || accountToUse.expertise || '');
    const normalizedProjectTypes = Array.isArray(accountToUse.projectTypes)
      ? accountToUse.projectTypes.join(', ')
      : (accountToUse.projectTypes || accountToUse.project_types || '');
    const normalizedLanguages = Array.isArray(accountToUse.languages)
      ? accountToUse.languages
      : (accountToUse.languages ? [accountToUse.languages] : (Array.isArray(accountToUse.language) ? accountToUse.language : []));
    const normalizedCertifications = Array.isArray(accountToUse.certifications)
      ? accountToUse.certifications.join(', ')
      : (accountToUse.certifications || accountToUse.credentials || accountToUse.certification || '');
    const socialLinks = accountToUse.social_links || accountToUse.socialLinks || {};

    return {
      name: accountToUse.name || accountToUse.full_name || accountToUse.display_name || '',
      email: accountToUse.email || '',
      phone: accountToUse.phone || accountToUse.phoneNumber || accountToUse.phone_number || '',
      title: accountToUse.title || defaultTitle || '',
      bio: accountToUse.bio || accountToUse.description || '',
      location: accountToUse.location || '',
      skills: normalizedSkills,
      languages: normalizedLanguages,
      experience: accountToUse.experience || '',
      hourlyRate: accountToUse.hourlyRate || accountToUse.hourly_rate || '',
      availability: accountToUse.availability || '',
      projectTypes: normalizedProjectTypes,
      workStyle: accountToUse.workStyle || accountToUse.work_style || '',
      timezone: accountToUse.timezone || '',
      certifications: normalizedCertifications,
      portfolioWebsite: accountToUse.portfolioWebsite || accountToUse.portfolio_website || socialLinks.portfolioWebsite || socialLinks.portfolio_website || '',
      github: accountToUse.github || socialLinks.github || '',
      linkedin: accountToUse.linkedin || socialLinks.linkedin || '',
      twitter: accountToUse.twitter || socialLinks.twitter || '',
      instagram: accountToUse.instagram || socialLinks.instagram || '',
      facebook: accountToUse.facebook || socialLinks.facebook || '',
      tiktok: accountToUse.tiktok || socialLinks.tiktok || '',
      whatsapp: accountToUse.whatsapp || socialLinks.whatsapp || '',
      avatar: accountToUse.avatar || accountToUse.avatar_url || fallbackAvatar,
      dateOfBirth: accountToUse.dateOfBirth || accountToUse.date_of_birth || accountToUse.birthDate || localStorage.getItem('dateOfBirth') || '',
      mediaFiles: Array.isArray(accountToUse.mediaFiles) ? accountToUse.mediaFiles : []
    };
  }

  const fallbackAvatar = localStorage.getItem('userAvatar') || loginUser?.avatar || null;
  return {
    name: loginUser?.displayName || '',
    email: loginUser?.email || '',
    phone: '',
    title: defaultTitle || '',
    bio: '',
    location: '',
    skills: '',
    languages: [],
    experience: '',
    hourlyRate: '',
    availability: '',
    projectTypes: '',
    workStyle: '',
    timezone: '',
    certifications: '',
    portfolioWebsite: '',
    github: '',
    linkedin: '',
    twitter: '',
    instagram: '',
    facebook: '',
    tiktok: '',
    whatsapp: '',
    avatar: fallbackAvatar,
    dateOfBirth: localStorage.getItem('dateOfBirth') || '',
    mediaFiles: []
  };
};
