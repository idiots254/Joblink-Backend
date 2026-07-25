export const normalizeSearchText = (value = '') => {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
};

export const getLanguageSearchMatches = (languages = [], searchText = '') => {
  const normalizedSearchText = normalizeSearchText(searchText);

  if (!normalizedSearchText) {
    return languages.map((language) => ({ language, score: 0 }));
  }

  return languages
    .map((language) => {
      const normalizedLanguage = normalizeSearchText(language);
      const words = language
        .toLowerCase()
        .split(/[\s+\-_/()]+/)
        .filter(Boolean);

      let score = 0;

      if (normalizedLanguage === normalizedSearchText) {
        score = 1000;
      } else if (normalizedLanguage.startsWith(normalizedSearchText)) {
        score = 900;
      } else if (normalizedLanguage.includes(normalizedSearchText)) {
        score = 700;
      }

      const matchedWord = words.find((word) => {
        const normalizedWord = normalizeSearchText(word);
        return normalizedWord.startsWith(normalizedSearchText) || normalizedWord.includes(normalizedSearchText);
      });

      if (matchedWord) {
        const normalizedMatchedWord = normalizeSearchText(matchedWord);
        if (normalizedMatchedWord.startsWith(normalizedSearchText)) {
          score += 100;
        } else if (normalizedMatchedWord.includes(normalizedSearchText)) {
          score += 50;
        }
      }

      return { language, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.language.localeCompare(b.language));
};
