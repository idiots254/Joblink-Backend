export const getDigitsOnly = (value = '') => String(value ?? '').replace(/\D/g, '');

export const buildWhatsappUrl = (countryCode = '', localNumber = '') => {
  const cc = getDigitsOnly(countryCode);
  const digits = getDigitsOnly(localNumber);
  if (!digits) return '';
  return `https://wa.me/${cc}${digits}`;
};

export const getSharedContactNumber = (phoneValue = '', whatsappValue = '', countryCode = '') => {
  const explicitPhone = getDigitsOnly(phoneValue);
  const explicitWhatsapp = getDigitsOnly(whatsappValue);
  const countryDigits = getDigitsOnly(countryCode);

  if (explicitPhone) {
    const digits = explicitPhone.replace(new RegExp(`^${countryDigits}`), '');
    return digits || explicitPhone;
  }

  if (explicitWhatsapp) {
    const digits = explicitWhatsapp.replace(new RegExp(`^${countryDigits}`), '');
    return digits || explicitWhatsapp;
  }

  return '';
};
