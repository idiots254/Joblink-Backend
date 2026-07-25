import React, { useState, useEffect, useRef } from 'react';
import './LocationSelector.css';
import { 
  getCountries, 
  getStatesByCountry, 
  getCitiesByState,
  formatLocation,
  getTimezonByCountry
} from './locationData';
import { Capacitor } from '@capacitor/core';

// Flag emoji mapping for countries
const COUNTRY_FLAGS = {
  'United States': '🇺🇸',
  'Canada': '🇨🇦',
  'United Kingdom': '🇬🇧',
  'Australia': '🇦🇺',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Spain': '🇪🇸',
  'Italy': '🇮🇹',
  'Netherlands': '🇳🇱',
  'Belgium': '🇧🇪',
  'Switzerland': '🇨🇭',
  'Sweden': '🇸🇪',
  'Norway': '🇳🇴',
  'Denmark': '🇩🇰',
  'Finland': '🇫🇮',
  'Poland': '🇵🇱',
  'Portugal': '🇵🇹',
  'Ireland': '🇮🇪',
  'Greece': '🇬🇷',
  'Mexico': '🇲🇽',
  'Brazil': '🇧🇷',
  'Japan': '🇯🇵',
  'South Korea': '🇰🇷',
  'North Korea': '🇰🇵',
  'China': '🇨🇳',
  'India': '🇮🇳',
  'Kenya': '🇰🇪',
  'South Africa': '🇿🇦',
  'Egypt': '🇪🇬',
  'Nigeria': '🇳🇬',
  'United Arab Emirates': '🇦🇪',
  'Saudi Arabia': '🇸🇦',
  'Singapore': '🇸🇬',
  'Malaysia': '🇲🇾',
  'Thailand': '🇹🇭',
  'Philippines': '🇵🇭',
  'Indonesia': '🇮🇩',
  'Vietnam': '🇻🇳',
  'Russia': '🇷🇺',
  'Austria': '🇦🇹',
  'Czech Republic': '🇨🇿',
  'Hungary': '🇭🇺',
  'Romania': '🇷🇴',
  'Bulgaria': '🇧🇬',
  'Croatia': '🇭🇷',
  'Serbia': '🇷🇸',
  'Slovenia': '🇸🇮',
  'Slovakia': '🇸🇰',
  'Iceland': '🇮🇸',
  'New Zealand': '🇳🇿',
  'Hong Kong': '🇭🇰',
  'Taiwan': '🇹🇼',
  'Pakistan': '🇵🇰',
  'Bangladesh': '🇧🇩',
  'Sri Lanka': '🇱🇰',
  'Nepal': '🇳🇵',
  'Afghanistan': '🇦🇫',
  'Iran': '🇮🇷',
  'Iraq': '🇮🇶',
  'Israel': '🇮🇱',
  'Turkey': '🇹🇷',
  'Ethiopia': '🇪🇹',
  'Ghana': '🇬🇭',
  'Morocco': '🇲🇦',
  'Algeria': '🇩🇿',
  'Tunisia': '🇹🇳',
  'Angola': '🇦🇴',
  'Zambia': '🇿🇲',
  'Zimbabwe': '🇿🇼',
  'Botswana': '🇧🇼',
  'Namibia': '🇳🇦',
  'Mozambique': '🇲🇿',
  'Malawi': '🇲🇼',
  'Tanzania': '🇹🇿',
  'Uganda': '🇺🇬',
  'Rwanda': '🇷🇼',
  'Burundi': '🇧🇮',
  'Sudan': '🇸🇩',
  'Peru': '🇵🇪',
  'Colombia': '🇨🇴',
  'Venezuela': '🇻🇪',
  'Ecuador': '🇪🇨',
  'Bolivia': '🇧🇴',
  'Chile': '🇨🇱',
  'Argentina': '🇦🇷',
  'Uruguay': '🇺🇾',
  'Paraguay': '🇵🇾',
  'Guyana': '🇬🇾',
  'Suriname': '🇸🇷',
  'Costa Rica': '🇨🇷',
  'Panama': '🇵🇦',
  'Guatemala': '🇬🇹',
  'Honduras': '🇭🇳',
  'El Salvador': '🇸🇻',
  'Nicaragua': '🇳🇮',
  'Belize': '🇧🇿',
  'Jamaica': '🇯🇲',
  'Haiti': '🇭🇹',
  'Dominican Republic': '🇩🇴',
  'Cuba': '🇨🇺',
  'Bahamas': '🇧🇸',
  'Trinidad and Tobago': '🇹🇹',
  'Barbados': '🇧🇧',
  'Grenada': '🇬🇩',
  'Azerbaijan': '🇦🇿',
  'Georgia': '🇬🇪',
  'Armenia': '🇦🇲',
  'Kazakhstan': '🇰🇿',
  'Uzbekistan': '🇺🇿',
  'Turkmenistan': '🇹🇲',
  'Tajikistan': '🇹🇯',
  'Kyrgyzstan': '🇰🇬',
  'Libya': '🇱🇾',
  'Senegal': '🇸🇳',
  'Mali': '🇲🇱',
  'Niger': '🇳🇪',
  'South Sudan': '🇸🇸',
  'Somalia': '🇸🇴',
  'Djibouti': '🇩🇯',
  'Eritrea': '🇪🇷',
  'Mauritania': '🇲🇷',
  'Cameroon': '🇨🇲',
  'Gabon': '🇬🇦',
  'Congo': '🇨🇩',
  'Central African Republic': '🇨🇫',
  'Chad': '🇹🇩',
  'Benin': '🇧🇯',
  'Togo': '🇹🇬',
  'Ivory Coast': '🇨🇮',
  'Liberia': '🇱🇷',
  'Sierra Leone': '🇸🇱',
  'Guinea': '🇬🇳',
  'Guinea-Bissau': '🇬🇼',
  'Gambia': '🇬🇲',
  'Mauritius': '🇲🇺',
  'Seychelles': '🇸🇨',
  'Comoros': '🇰🇲',
  'Madagascar': '🇲🇬',
  'Maldives': '🇲🇻',
  'Cyprus': '🇨🇾',
  'Lebanon': '🇱🇧',
  'Syria': '🇸🇾',
  'Jordan': '🇯🇴',
  'Palestine': '🇵🇸',
  'Bahrain': '🇧🇭',
  'Qatar': '🇶🇦',
  'Kuwait': '🇰🇼',
  'Oman': '🇴🇲',
  'Yemen': '🇾🇪',
  'Malta': '🇲🇹',
  'Albania': '🇦🇱',
  'Macedonia': '🇲🇰',
  'Bosnia and Herzegovina': '🇧🇦',
  'Montenegro': '🇲🇪',
  'Belarus': '🇧🇾',
  'Ukraine': '🇺🇦',
  'Moldova': '🇲🇩',
  'Lithuania': '🇱🇹',
  'Latvia': '🇱🇻',
  'Estonia': '🇪🇪',
};

const getCountryFlag = (country) => COUNTRY_FLAGS[country] || '🌍';

function LocationSelector({ value, onChange, onTimezoneChange, onCountryChange, placeholder = "Select Location" }) {
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [stage, setStage] = useState('country'); // 'country' | 'state' | 'city'
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const selectRef = useRef(null);

  // Initialize from value prop
  useEffect(() => {
    const availableCountries = getCountries();
    
    if (value && typeof value === 'string') {
      const parts = value.split(', ').filter(p => p.trim());
      
      let parsedCountry = '';
      let parsedState = '';
      let parsedCity = '';

      for (let i = parts.length - 1; i >= 0; i--) {
        if (availableCountries.includes(parts[i])) {
          parsedCountry = parts[i];
          parts.splice(i, 1);
          break;
        }
      }

      if (parts.length === 2) {
        parsedState = parts[0];
        parsedCity = parts[1];
      } else if (parts.length === 1) {
        parsedCity = parts[0];
      }

      if (parsedCountry) {
        setCountry(parsedCountry);
        const stateList = getStatesByCountry(parsedCountry);
        setStates(stateList);
        if (onCountryChange) {
          onCountryChange(parsedCountry);
        }
        
        if (parsedState && stateList.includes(parsedState)) {
          setState(parsedState);
          const cityList = getCitiesByState(parsedCountry, parsedState);
          setCities(cityList);
          
          if (parsedCity) {
            setCity(parsedCity);
            setStage('complete');
          } else {
            setStage('city');
          }
        } else {
          setStage('state');
        }
      }
    } else {
      // Kenya will appear at the top of the list
      setCountry('');
      setStage('country');
    }

    setCountries(availableCountries);
  }, [value]);

  // Detect if running on mobile
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    setIsMobile(platform === 'ios' || platform === 'android');
  }, []);

  const handleDropdownChange = (e) => {
    const selectedValue = e.target.value;
    handleSelection(selectedValue);
  };

  const handleSelection = (selectedValue) => {
    if (stage === 'country') {
      setCountry(selectedValue);
      setState('');
      setCity('');
      
      if (selectedValue) {
        const stateList = getStatesByCountry(selectedValue);
        setStates(stateList);
        setCities([]);
        setStage('state');
        
        // Auto-fill timezone when country is selected
        if (onTimezoneChange) {
          const timezone = getTimezonByCountry(selectedValue);
          onTimezoneChange(timezone);
        }
        if (onCountryChange) {
          onCountryChange(selectedValue);
        }
      }
    } else if (stage === 'state') {
      setState(selectedValue);
      setCity('');
      
      if (selectedValue && country) {
        const cityList = getCitiesByState(country, selectedValue);
        setCities(cityList);
        setStage('city');
      }
    } else if (stage === 'city') {
      setCity(selectedValue);
      updateValue(country, state, selectedValue);
      setStage('complete');
      setShowModal(false);
    }
  };

  const updateValue = (selectedCountry, selectedState, selectedCity) => {
    const formattedLocation = formatLocation(selectedCountry, selectedState, selectedCity);
    onChange(formattedLocation);
  };

  const resetSelection = () => {
    setCountry('');
    setState('');
    setCity('');
    setStage('country');
    setStates([]);
    setCities([]);
    onChange('');
  };

  const getOptions = () => {
    if (stage === 'country') {
      return countries;
    } else if (stage === 'state') {
      return states;
    } else if (stage === 'city') {
      return cities;
    }
    return [];
  };

  const getLabel = () => {
    if (stage === 'country') return 'Select Country';
    if (stage === 'state') return 'Select State/Province';
    if (stage === 'city') return 'Select City';
    return 'Location Selected';
  };

  const getModalHeaderDisplay = () => {
    const parts = [];
    if (country) parts.push(`${getCountryFlag(country)} ${country}`);
    if (state) parts.push(state);
    if (city) parts.push(city);
    return parts.length > 0 ? parts.join(', ') : getLabel();
  };

  return (
    <div className="loc-sel-wrapper">
      {/* Selected Location Display - Top */}
      {(country || state || city) && (
        <div className="loc-sel-selected">
          <span className="loc-sel-badge">
            {(() => {
              const parts = [];
              if (country) parts.push(`${getCountryFlag(country)} ${country}`);
              if (state) parts.push(state);
              if (city) parts.push(city);
              return ': ' + parts.join(', ');
            })()}
          </span>
          {stage !== 'complete' && (
            <span className="loc-sel-punctuation">,</span>
          )}
          <button 
            className="loc-sel-reset-btn"
            onClick={resetSelection}
            type="button"
            title="Reset selection"
          >
            ✕
          </button>
        </div>
      )}

      {isMobile ? (
        <>
          {/* Mobile: Native Picker Button - styled like form input */}
          <button
            className={`loc-sel-mobile-picker-btn ${stage === 'complete' || city || state || country ? 'is-filled' : ''}`}
            onClick={() => setShowModal(true)}
            disabled={stage === 'complete'}
            type="button"
          >
            {stage === 'complete' || city || state || country ? getModalHeaderDisplay() : getLabel()}
          </button>

          {/* Mobile: Modal Picker */}
          {showModal && (
            <div className="loc-sel-modal-overlay" onClick={() => setShowModal(false)}>
              <div className="loc-sel-modal-panel" onClick={(e) => e.stopPropagation()}>
                <div className="loc-sel-modal-header">
                  <div className="loc-sel-modal-header-content">
                    <h3 className="loc-sel-modal-header-label">{getLabel()}</h3>
                    {(country || state || city) && (
                      <p className="loc-sel-modal-header-selection">{getModalHeaderDisplay()}</p>
                    )}
                  </div>
                  <button
                    className="loc-sel-modal-close"
                    onClick={() => setShowModal(false)}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
                <div className="loc-sel-modal-content">
                  {getOptions().map((option) => (
                    <button
                      key={option}
                      className="loc-sel-modal-option"
                      onClick={() => handleSelection(option)}
                      type="button"
                    >
                      {stage === 'country' && (
                        <span className="loc-sel-option-flag">{getCountryFlag(option)}</span>
                      )}
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Desktop: Standard Dropdown */
        <div className="loc-sel-single-dropdown">
          <select 
            ref={selectRef}
            className={`loc-sel-dropdown ${stage === 'complete' || city || state || country ? 'is-filled' : ''}`}
            value={stage === 'country' ? country : stage === 'state' ? state : city}
            onChange={handleDropdownChange}
            aria-label={getLabel()}
            disabled={stage === 'complete'}
          >
            <option value="">{getLabel()}</option>
            {getOptions().map((option) => (
              <option 
                key={option} 
                value={option}
                data-is-kenya={option === 'Kenya' ? 'true' : 'false'}
              >
                {stage === 'country' ? `${getCountryFlag(option)} ${option}` : option}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export default LocationSelector;

