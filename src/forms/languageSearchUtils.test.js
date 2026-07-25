import { getLanguageSearchMatches } from './languageSearchUtils';

describe('getLanguageSearchMatches', () => {
  it('returns multiple matching languages for a short prefix', () => {
    const languages = ['Afar', 'Afrikaans', 'English', 'Spanish'];

    const matches = getLanguageSearchMatches(languages, 'af');

    expect(matches.map((item) => item.language)).toEqual(['Afar', 'Afrikaans']);
  });

  it('returns all languages that contain the full query in order', () => {
    const languages = ['English', 'Spanish', 'French'];

    const matches = getLanguageSearchMatches(languages, 'eng');

    expect(matches.map((item) => item.language)).toEqual(['English']);
  });
});
