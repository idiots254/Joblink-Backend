import React, { useMemo } from 'react';
import { normalizeSearchText } from './languageSearchUtils';

function LanguageResultsList({
  languages = [],
  selectedLanguages = [],
  searchText = '',
  onSelect,
  emptyMessage = 'No matching languages found',
  renderLabel,
  optionClassName = 'lang-sel-option',
  modalOptionClassName = 'lang-sel-modal-option',
  isModal = false,
}) {
  const filteredLanguages = useMemo(() => {
    const normalizedSearchText = normalizeSearchText(searchText);

    if (!normalizedSearchText) {
      return languages;
    }

    return languages.filter((language) => {
      const words = language
        .toLowerCase()
        .split(/[\s+\-_/()]+/)
        .filter(Boolean);

      return words.some((word) => normalizeSearchText(word).startsWith(normalizedSearchText));
    });
  }, [languages, searchText]);

  if (filteredLanguages.length === 0) {
    return <div className="lang-sel-empty-state">{emptyMessage}</div>;
  }

  return (
    <>
      {filteredLanguages.map((language) => {
        const isSelected = selectedLanguages.includes(language);

        return (
          <button
            key={language}
            className={`${isModal ? modalOptionClassName : optionClassName} ${isSelected ? 'is-selected' : ''}`}
            onClick={() => {
              if (!isSelected) {
                onSelect(language);
              }
            }}
            disabled={isSelected}
            type="button"
          >
            {renderLabel ? renderLabel(language, searchText) : language}
            {isSelected ? ' • Selected' : ''}
          </button>
        );
      })}
    </>
  );
}

export default LanguageResultsList;
