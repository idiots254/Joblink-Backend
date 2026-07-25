import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaMagnifyingGlass, FaXmark } from 'react-icons/fa6';
import './LanguageSelector.css';
import { getLanguages } from './languageData';
import { Capacitor } from '@capacitor/core';
import LanguageSearch from './LanguageSearch';
import LanguageResultsList from './LanguageResultsList';
import { normalizeSearchText } from './languageSearchUtils';

const getLanguageSearchWords = (language) => {
  return language
    .toLowerCase()
    .split(/[\s+\-_/()]+/)
    .filter(Boolean);
};

const renderHighlightedLanguage = (language, searchText) => {
  if (!searchText) {
    return language;
  }

  const normalizedSearchText = normalizeSearchText(searchText);
  if (!normalizedSearchText) {
    return language;
  }

  const words = getLanguageSearchWords(language);
  const matchWord = words.find((word) => {
    const normalizedWord = normalizeSearchText(word);
    return normalizedWord.startsWith(normalizedSearchText) || normalizedWord.includes(normalizedSearchText);
  });

  if (!matchWord) {
    return language;
  }

  const matchIndex = matchWord.toLowerCase().indexOf(normalizedSearchText);
  const matchEnd = matchIndex + normalizedSearchText.length;

  return (
    <>
      {language.slice(0, matchIndex)}
      <span className="lang-sel-match-highlight">{language.slice(matchIndex, matchEnd)}</span>
      {language.slice(matchEnd)}
    </>
  );
};

function LanguageSelector({ value = [], onChange, placeholder = "Add Language" }) {
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);

  const languages = getLanguages();
  const selectedLanguages = Array.isArray(value) ? value : [];
  const searchText = searchTerm.trim();

  // Detect if running on mobile
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    setIsMobile(platform === 'ios' || platform === 'android');
  }, []);

  useEffect(() => {
    if (!showModal) {
      setSearchTerm('');
      setShowSearchInput(false);
    }
  }, [showModal]);

  useEffect(() => {
    if (showSearchInput) {
      const focusTimer = window.setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.setSelectionRange?.(
          searchInputRef.current.value.length,
          searchInputRef.current.value.length
        );
      }, 120);

      return () => window.clearTimeout(focusTimer);
    }
  }, [showSearchInput]);

  const handleSearchInputChange = useCallback((value) => {
    setSearchTerm(value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    searchInputRef.current?.focus();
  }, []);

  const toggleSearchInput = useCallback(() => {
    setShowSearchInput((prev) => !prev);
    window.setTimeout(() => {
      if (!showSearchInput) {
        searchInputRef.current?.focus();
      }
    }, 0);
  }, [showSearchInput]);

  const handleLanguageSelect = (language) => {
    if (!selectedLanguages.includes(language)) {
      onChange([...selectedLanguages, language]);
      setSearchTerm('');
      setShowSearchInput(false);
    }
  };

  const clearAllLanguages = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div 
      className="lang-sel-wrapper"
      ref={containerRef}
    >
      {/* Languages Label with Selected Items - Top */}
      <div className="lang-sel-label-row">
        <span className="lang-sel-label-text">Language(s)</span>
        {selectedLanguages.length > 0 && (
          <>
            <span className="lang-sel-badge">
              : {selectedLanguages.join(', ')}
            </span>
            <button 
              className="lang-sel-clear-btn"
              onClick={clearAllLanguages}
              type="button"
              title="Clear all languages"
            >
              <FaXmark />
            </button>
          </>
        )}
      </div>

      {isMobile ? (
        <>
          {/* Mobile: Picker Button */}
          <button
            className={`lang-sel-mobile-picker-btn ${selectedLanguages.length > 0 ? 'is-filled' : ''}`}
            onClick={() => setShowModal(true)}
            type="button"
          >
            {selectedLanguages.length > 0 ? selectedLanguages.join(', ') : placeholder}
          </button>

          {/* Mobile: Modal Picker */}
          {showModal && (
            <div className="lang-sel-modal-overlay" onClick={() => setShowModal(false)}>
              <div className="lang-sel-modal-panel" onClick={(e) => e.stopPropagation()}>
                <div className="lang-sel-modal-header">
                  <div className="lang-sel-modal-title-wrap">
                    <h3>Languages</h3>
                    {showSearchInput ? (
                      <LanguageSearch
                        searchTerm={searchTerm}
                        onSearchChange={handleSearchInputChange}
                        onClearSearch={handleClearSearch}
                        onToggleSearchInput={toggleSearchInput}
                        showSearchInput={showSearchInput}
                        inputRef={searchInputRef}
                        placeholder="Search languages"
                        isMobile={isMobile}
                        className="lang-sel-search-input--header"
                      />
                    ) : null}
                  </div>
                  <div className="lang-sel-modal-actions">
                    <button
                      className="lang-sel-search-toggle"
                      onClick={toggleSearchInput}
                      type="button"
                      title="Search languages"
                    >
                      <FaMagnifyingGlass />
                    </button>
                  </div>
                  <button
                    className="lang-sel-modal-close"
                    onClick={() => setShowModal(false)}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
                <div className="lang-sel-modal-content">
                  <LanguageResultsList
                    languages={languages}
                    selectedLanguages={selectedLanguages}
                    searchText={searchText}
                    onSelect={(language) => {
                      handleLanguageSelect(language);
                      setShowModal(false);
                    }}
                    renderLabel={(language, currentSearchText) => renderHighlightedLanguage(language, currentSearchText)}
                    optionClassName="lang-sel-option"
                    modalOptionClassName="lang-sel-modal-option"
                    isModal={true}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Desktop: Standard Dropdown */
        <div className="lang-sel-input-row">
          <div className="lang-sel-search-panel">
            <LanguageSearch
              searchTerm={searchTerm}
              onSearchChange={handleSearchInputChange}
              onClearSearch={handleClearSearch}
              onToggleSearchInput={toggleSearchInput}
              showSearchInput={true}
              inputRef={searchInputRef}
              placeholder="Search languages"
              isMobile={false}
            />
            <div className="lang-sel-options-list">
              <LanguageResultsList
                languages={languages}
                selectedLanguages={selectedLanguages}
                searchText={searchText}
                onSelect={(language) => handleLanguageSelect(language)}
                renderLabel={(language, currentSearchText) => renderHighlightedLanguage(language, currentSearchText)}
                optionClassName="lang-sel-option"
                modalOptionClassName="lang-sel-modal-option"
                isModal={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;




