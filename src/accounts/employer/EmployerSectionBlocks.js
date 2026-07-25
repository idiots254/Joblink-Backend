import React from 'react';
import { FaLinkedin, FaXTwitter, FaInstagram, FaFacebook } from 'react-icons/fa6';
import './EmployerSectionBlocks.css';

export function EmployerPhoneInput({
  selectedCountryInfo,
  selectedCountryCode,
  phoneNumberValue,
  setShowPhoneCountryModal,
  handleInputChange,
  handlePhoneKeyDown,
  handleFieldFocus,
  handleFieldBlur,
  showPhoneCountryModal,
  setSelectedCountryCode,
  setSelectedCountryInfo,
  setFormData,
  setPhoneNumberValue,
  getDigitsOnly,
  getFieldInputClass,
  formData,
  buildWhatsappUrl,
}) {
  return (
    <div className="phone-input-group employer-phone-group">
      <button
        type="button"
        className="phone-country-btn work-sel-mobile-picker-btn country-code-inline"
        onClick={() => setShowPhoneCountryModal(true)}
        aria-label="Select country code"
      >
        <span className="country-flag">{selectedCountryInfo.split(' ')[0]}</span>
        <span className="code">{selectedCountryCode.replace(/\D/g, '')}</span>
        <span className="country-code-chevron" aria-hidden="true">
          <svg fill="#000000" width="800px" height="800px" viewBox="-6.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <title>dropdown</title>
            <path d="M18.813 11.406l-7.906 9.906c-0.75 0.906-1.906 0.906-2.625 0l-7.906-9.906c-0.75-0.938-0.375-1.656 0.781-1.656h16.875c1.188 0 1.531 0.719 0.781 1.656z"></path>
          </svg>
        </span>
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="tel"
        name="phone"
        value={phoneNumberValue}
        onChange={(e) => {
          const digitsOnly = getDigitsOnly(e.target.value);
          setPhoneNumberValue(digitsOnly);
          setFormData(prev => ({
            ...prev,
            phone: digitsOnly,
            whatsapp: buildWhatsappUrl ? buildWhatsappUrl(selectedCountryCode, digitsOnly) : prev.whatsapp,
          }));
        }}
        onKeyDown={handlePhoneKeyDown}
        onFocus={() => handleFieldFocus('phone')}
        onBlur={() => handleFieldBlur('phone')}
        className={`phone-input ${getFieldInputClass ? getFieldInputClass('phone') : ''} employer-phone-input`}
        style={{ fontSize: '14px', letterSpacing: 'normal', paddingLeft: '12px' }}
        placeholder="712 345 678"
      />

      {showPhoneCountryModal && (
        <div className="phone-modal-overlay" onClick={() => setShowPhoneCountryModal(false)}>
          <div className="phone-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="phone-modal-header">
              <h3 className="phone-modal-title">Select Country Code</h3>
              <button className="phone-modal-close" onClick={() => setShowPhoneCountryModal(false)} type="button">✕</button>
            </div>
            <div className="phone-modal-content">
              {[
                { code: '+254', country: '🇰🇪 Kenya' },
                { code: '+91', country: '🇮🇳 India' },
                { code: '+234', country: '🇳🇬 Nigeria' },
                { code: '+27', country: '🇿🇦 South Africa' },
                { code: '+255', country: '🇹🇿 Tanzania' },
                { code: '+256', country: '🇺🇬 Uganda' },
                { code: '+44', country: '🇬🇧 United Kingdom' },
                { code: '+1', country: '🇺🇸 United States' },
              ].map(({ code, country }) => (
                <button
                  key={code}
                  type="button"
                  className={`phone-modal-option ${selectedCountryCode === code ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCountryCode(code);
                    setSelectedCountryInfo(country);
                    setShowPhoneCountryModal(false);
                  }}
                >
                  <span className="phone-modal-flag">{country.split(' ')[0]}</span>
                  <span className="phone-modal-country">{country.split(' ').slice(1).join(' ')}</span>
                  <span className="phone-modal-code">{code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CompanyInformationSection(props) {
  const {
    formData,
    handleInputChange,
    handleFieldFocus,
    handleFieldBlur,
    handleEmailKeyDown,
    handleEmailBlur,
    getFieldInputClass,
    emailSuggestion,
    emailErrorShaking,
    selectedCountryInfo,
    selectedCountryCode,
    phoneNumberValue,
    setShowPhoneCountryModal,
    showPhoneCountryModal,
    setSelectedCountryCode,
    setSelectedCountryInfo,
    setFormData,
    setPhoneNumberValue,
    getDigitsOnly,
    buildWhatsappUrl,
    renderAvatarPreview,
    avatarInputRefStep1,
    avatarInputRefFullView,
  } = props;

  return (
    <div className="employer-section-card">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
        <input
          ref={avatarInputRefStep1 || avatarInputRefFullView}
          type="file"
          accept="image/*"
          onChange={props.handleAvatarChange}
          style={{ display: 'none' }}
        />
        {renderAvatarPreview(avatarInputRefStep1 || avatarInputRefFullView)}
      </div>
      <h3 className="form-section-title">Company Information</h3>

      <div className="form-group">
        <label>Company Name</label>
        <textarea
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          onFocus={() => handleFieldFocus('name')}
          onBlur={() => handleFieldBlur('name')}
          className={getFieldInputClass('name')}
          placeholder="e.g., TechCorp Solutions"
          rows="1"
        />
      </div>

      <div className="form-two-col">
        <div className="form-group">
          <label>Email</label>
          <div style={{ fontSize: '10px', color: '#0a8545', marginBottom: '6px', fontWeight: '500' }}>
            We'll send a verification code to this email
          </div>
          <div style={{ position: 'relative' }}>
            <textarea
              name="email"
              value={formData.email}
              readOnly
              onKeyDown={handleEmailKeyDown}
              onFocus={() => handleFieldFocus('email')}
              onBlur={handleEmailBlur}
              className={`${getFieldInputClass('email')} ${emailErrorShaking ? 'field-error-shake' : ''}`}
              placeholder="company@gmail.com"
              style={{
                borderColor: emailErrorShaking ? '#ef4444' : undefined,
                backgroundColor: 'rgba(255,255,255,0.92)'
              }}
              rows="1"
            />
            {emailSuggestion && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', padding: '8px 12px', pointerEvents: 'none' }}>
                <span style={{ color: 'rgba(0, 0, 0, 0.3)', marginLeft: '0px' }}>{emailSuggestion}</span>
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Phone *</label>
          <EmployerPhoneInput
            selectedCountryInfo={selectedCountryInfo}
            selectedCountryCode={selectedCountryCode}
            phoneNumberValue={phoneNumberValue}
            setShowPhoneCountryModal={setShowPhoneCountryModal}
            handleInputChange={handleInputChange}
            handlePhoneKeyDown={props.handlePhoneKeyDown}
            handleFieldFocus={handleFieldFocus}
            handleFieldBlur={handleFieldBlur}
            showPhoneCountryModal={showPhoneCountryModal}
            setSelectedCountryCode={setSelectedCountryCode}
            setSelectedCountryInfo={setSelectedCountryInfo}
            setFormData={setFormData}
            setPhoneNumberValue={setPhoneNumberValue}
            getDigitsOnly={getDigitsOnly}
            getFieldInputClass={getFieldInputClass}
            formData={formData}
            buildWhatsappUrl={buildWhatsappUrl}
          />
        </div>
      </div>

      <div className="form-two-col">
        <div className="form-group">
          <label>Location</label>
          {props.locationSelector}
        </div>
        <div className="form-group">
          <label>Website</label>
          <textarea
            name="website"
            value={formData.website}
            onChange={handleInputChange}
            onFocus={() => handleFieldFocus('website')}
            onBlur={() => handleFieldBlur('website')}
            className={getFieldInputClass('website')}
            placeholder="https://company.com"
            rows="1"
          />
        </div>
      </div>
    </div>
  );
}

export function CompanyProfileSection({
  formData,
  handleInputChange,
  setFormData,
  showCompanySizeModal,
  setShowCompanySizeModal,
  companySizeOptions,
  showYearFoundedPicker,
  setShowYearFoundedPicker,
  formatFoundedValue,
  yearPicker,
}) {
  return (
    <div className="employer-section-card">
      <h3 className="form-section-title">Company Profile</h3>
      <div className="form-two-col">
        <div className="form-group">
          <label>Industry</label>
          <textarea
            name="industry"
            value={formData.industry}
            onChange={handleInputChange}
            placeholder="e.g., Software Development"
            rows="1"
          />
        </div>
        <div className="form-group">
          <label>Company Size</label>
          <button type="button" className={`company-size-picker-btn ${formData.companySize ? 'is-filled' : ''}`} onClick={() => setShowCompanySizeModal(true)}>
            <span>{formData.companySize || 'Select company size'}</span>
          </button>

          {showCompanySizeModal && (
            <div className="company-size-modal-overlay" onClick={() => setShowCompanySizeModal(false)}>
              <div className="company-size-modal-panel" onClick={(e) => e.stopPropagation()}>
                <div className="company-size-modal-header">
                  <h3 className="company-size-modal-title">Select Company Size</h3>
                  <button type="button" className="company-size-modal-close" onClick={() => setShowCompanySizeModal(false)}>✕</button>
                </div>
                <div className="company-size-modal-content">
                  {companySizeOptions.map(option => (
                    <button
                      key={option}
                      type="button"
                      className={`company-size-modal-option ${formData.companySize === option ? 'active' : ''}`}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, companySize: option }));
                        setShowCompanySizeModal(false);
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="form-two-col">
        <div className="form-group">
          <label>Year Founded</label>
          <button type="button" className={`year-founded-picker-btn ${formData.founded ? 'is-filled' : ''}`} onClick={() => setShowYearFoundedPicker(true)}>
            <span>{formatFoundedValue(formData.founded) || 'Select year'}</span>
          </button>

          {showYearFoundedPicker && (
            <div className="year-founded-picker-wrapper">{yearPicker}</div>
          )}
        </div>
        <div className="form-group">
          <label>Company Title/Role</label>
          <textarea name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g., Hiring for Multiple Positions" rows="1" />
        </div>
      </div>
    </div>
  );
}

export function HiringInformationSection({ formData, handleInputChange }) {
  return (
    <div className="employer-section-card">
      <h3 className="form-section-title">Hiring Information</h3>
      <div className="form-two-col">
        <div className="form-group">
          <label>Active Job Postings</label>
          <textarea name="activeJobs" value={formData.activeJobs} onChange={handleInputChange} placeholder="12" rows="1" />
        </div>
        <div className="form-group">
          <label>Total Employees Hired</label>
          <textarea name="totalHired" value={formData.totalHired} onChange={handleInputChange} placeholder="145" rows="1" />
        </div>
      </div>

      <div className="form-group">
        <label>Hiring Manager Name</label>
        <textarea name="hiringManager" value={formData.hiringManager} onChange={handleInputChange} placeholder="e.g., Sarah Johnson" rows="1" />
      </div>
    </div>
  );
}

export function AboutCompanySection({ formData, handleInputChange }) {
  return (
    <div className="employer-section-card">
      <h3 className="form-section-title">About Company</h3>
      <div className="form-group">
        <label>Company Description</label>
        <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Tell potential employees about your company..." rows="3" />
      </div>
      <div className="form-group">
        <label>Company Bio/Mission</label>
        <textarea name="bio" value={formData.bio} onChange={handleInputChange} placeholder="Describe your company mission and vision..." rows="4" />
      </div>
      <div className="form-group">
        <label>Company Culture (comma-separated)</label>
        <textarea name="culture" value={formData.culture} onChange={handleInputChange} placeholder="Innovation, Collaboration, Excellence, Growth" rows="1" />
      </div>
      <div className="form-group">
        <label>Benefits & Perks (comma-separated)</label>
        <textarea name="benefits" value={formData.benefits} onChange={handleInputChange} placeholder="Health Insurance, Remote Work, Stock Options, Professional Development" rows="2" />
      </div>
    </div>
  );
}

export function SocialLinksSection({ formData, handleInputChange }) {
  return (
    <div className="employer-section-card">
      <h3 className="form-section-title">Social Media</h3>
      <div className="form-two-col">
        <div className="form-group">
          <label><FaLinkedin className="social-icon linkedin" /> LinkedIn Company</label>
          <textarea name="linkedin" value={formData.linkedin} onChange={handleInputChange} placeholder="https://linkedin.com/company/yourcompany" rows="1" />
        </div>
        <div className="form-group">
          <label><FaXTwitter className="social-icon twitter" /> Twitter/X</label>
          <textarea name="twitter" value={formData.twitter} onChange={handleInputChange} placeholder="https://twitter.com/yourcompany" rows="1" />
        </div>
      </div>
      <div className="form-two-col">
        <div className="form-group">
          <label><FaFacebook className="social-icon facebook" /> Facebook</label>
          <textarea name="facebook" value={formData.facebook} onChange={handleInputChange} placeholder="https://facebook.com/yourcompany" rows="1" />
        </div>
        <div className="form-group">
          <label><FaInstagram className="social-icon instagram" /> Instagram</label>
          <textarea name="instagram" value={formData.instagram} onChange={handleInputChange} placeholder="https://instagram.com/yourcompany" rows="1" />
        </div>
      </div>
    </div>
  );
}
