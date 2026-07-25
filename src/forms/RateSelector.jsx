import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import './RateSelector.css';

function RateSelector({ value, onChange, currency = 'Ksh', isFilled = false }) {
  const [durationType, setDurationType] = useState('hourly');
  const [rateValue, setRateValue] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const isFieldFilled = Boolean(rateValue || value || isFilled);

  // Detect platform
  useEffect(() => {
    const platform = Capacitor.getPlatform();
    setIsMobile(platform === 'ios' || platform === 'android');
  }, []);

  // Parse the value when component mounts or value changes
  useEffect(() => {
    if (!value || value === undefined || value === null || value.toString().trim() === '') {
      setDurationType('hourly');
      setRateValue('');
      return;
    }

    const parsed = parseRateValue(value);
    setDurationType(parsed.type);
    setRateValue(parsed.value);
  }, [value]);

  // Parse rate value from formatted string like "Ksh 85 / hour"
  const parseRateValue = (rateString) => {
    if (rateString === undefined || rateString === null || rateString === '') {
      return { type: 'hourly', value: '' };
    }

    const normalized = String(rateString).toLowerCase();
    const match = String(rateString).match(/\d+/);
    const numValue = match ? match[0] : '';

    let type = 'hourly';
    if (normalized.includes('day')) type = 'daily';
    else if (normalized.includes('week')) type = 'weekly';
    else if (normalized.includes('month')) type = 'monthly';
    else if (normalized.includes('contract') || normalized.includes('fixed')) type = 'contract';

    return { type, value: numValue };
  };

  // Format rate value into the full format
  const formatRateValue = (type, value) => {
    if (!value) return '';
    
    const suffixes = {
      hourly: '/ hour',
      daily: '/ day',
      weekly: '/ week',
      monthly: '/ month',
      contract: '(Fixed Price)'
    };
    
    return `${currency} ${value} ${suffixes[type]}`;
  };

  const handleDurationChange = (e) => {
    const newType = e.target.value;
    setDurationType(newType);
    const formatted = formatRateValue(newType, rateValue);
    onChange(formatted);
  };

  const handleDurationSelect = (type) => {
    setDurationType(type);
    const formatted = formatRateValue(type, rateValue);
    onChange(formatted);
    setShowModal(false);
  };

  const handleRateChange = (e) => {
    const newValue = e.target.value;
    setRateValue(newValue);
    const formatted = formatRateValue(durationType, newValue);
    onChange(formatted);
  };

  return (
    <div className="rate-sel-wrapper">
      {/* Rate Label with Selected Value - Top */}
      <div className="rate-sel-label-row">
        {rateValue && (
          <span className="rate-sel-badge">
            {formatRateValue(durationType, rateValue)}
          </span>
        )}
      </div>

      {/* Input Container */}
      <div className="rate-sel-input-row">
        {/* Duration Type Selector */}
        <div className="rate-sel-select-wrapper">
          {isMobile ? (
            <>
              <button 
                className={`rate-sel-mobile-picker-btn ${isFieldFilled ? 'is-filled' : ''}`}
                onClick={() => setShowModal(true)}
              >
                {durationType.charAt(0).toUpperCase() + durationType.slice(1)}
              </button>
              {showModal && (
                <div className="rate-sel-modal-overlay" onClick={() => setShowModal(false)}>
                  <div className="rate-sel-modal-panel" onClick={(e) => e.stopPropagation()}>
                    <div className="rate-sel-modal-header">
                      <h3>Duration Type</h3>
                      <button 
                        className="rate-sel-modal-close"
                        onClick={() => setShowModal(false)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="rate-sel-modal-content">
                      {['hourly', 'daily', 'weekly', 'monthly', 'contract'].map((type) => (
                        <button 
                          key={type}
                          className="rate-sel-modal-option"
                          onClick={() => handleDurationSelect(type)}
                        >
                          {type === 'contract' ? 'Contract (Fixed)' : type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <select 
              value={durationType}
              onChange={handleDurationChange}
              className={`rate-sel-select ${isFieldFilled ? 'is-filled' : ''}`}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="contract">Contract (Fixed)</option>
            </select>
          )}
        </div>

        {/* Amount Input */}
        <div className="rate-sel-input-wrapper">
          <span className="rate-sel-currency-prefix">{currency}</span>
          <input 
            type="number"
            value={rateValue}
            onChange={handleRateChange}
            placeholder={durationType === 'contract' ? '5000' : '200'}
            min="0"
            step="1"
            className={`rate-sel-input ${isFieldFilled ? 'is-filled field-filled' : ''}`}
          />
          <span className="rate-sel-suffix">
            {durationType === 'hourly' && '/ hour'}
            {durationType === 'daily' && '/ day'}
            {durationType === 'weekly' && '/ week'}
            {durationType === 'monthly' && '/ month'}
            {durationType === 'contract' && '(Fixed)'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default RateSelector;

