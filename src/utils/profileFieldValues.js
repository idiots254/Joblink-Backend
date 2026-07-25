export const normalizeProfileListValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item.trim() : item))
      .filter(Boolean)
      .map(item => (typeof item === 'string' ? item : String(item)));
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
};
