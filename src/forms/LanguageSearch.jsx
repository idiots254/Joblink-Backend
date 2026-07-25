import React, { useCallback, useEffect, useRef, useState } from 'react';
import './LanguageSelector.css';

function LanguageSearch({
  searchTerm,
  onSearchChange,
  onClearSearch,
  showSearchInput,
  inputRef,
  placeholder = 'Search languages',
  isMobile = false,
  className = ''
}) {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleInputChange = useCallback((event) => {
    const value = event.target.value;
    setLocalSearchTerm(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      onSearchChange(value);
    }, 150);
  }, [onSearchChange]);

  const handleClear = useCallback(() => {
    setLocalSearchTerm('');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onClearSearch();
  }, [onClearSearch]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (onSearchChange) {
        onSearchChange(localSearchTerm);
      }
    }
  }, [localSearchTerm, onSearchChange]);

  if (isMobile && !showSearchInput) {
    return null;
  }

  return (
    <div className={`lang-sel-search-wrapper ${className}`.trim()}>
      <input
        ref={inputRef}
        className="lang-sel-search-input"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={localSearchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
}

export default LanguageSearch;
