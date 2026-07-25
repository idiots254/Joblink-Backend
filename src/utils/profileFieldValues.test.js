import { normalizeProfileListValue } from './profileFieldValues';

describe('normalizeProfileListValue', () => {
  it('splits comma-separated strings into trimmed values', () => {
    expect(normalizeProfileListValue('AWS, Google Cloud, React')).toEqual(['AWS', 'Google Cloud', 'React']);
  });

  it('keeps array values trimmed and filtered', () => {
    expect(normalizeProfileListValue([' AWS ', ' Google Cloud ', ''])).toEqual(['AWS', 'Google Cloud']);
  });

  it('returns an empty array for empty values', () => {
    expect(normalizeProfileListValue('')).toEqual([]);
    expect(normalizeProfileListValue(null)).toEqual([]);
  });
});
