export const PrivacyTab = ({ settings, handleToggle, handleSelectChange, showSavedMessage }) => (
  <div className="settings-stp-page-section">
    <div className="section-header">
      <div>
        <h2 className="settings-stp-page-section-title">Privacy Settings</h2>
        <p className="settings-stp-page-section-description">Explore detailed visibility and contact controls for your profile.</p>
      </div>
    </div>

    <div className="settings-stp-options-group">
      <div className="settings-stp-page-section-heading">
        <h3>Profile visibility</h3>
        <p>Choose who can view each part of your profile, from public access down to connections only.</p>
      </div>

      <div className="settings-stp-page-grid">
        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Profile visibility</label>
            <p className="option-description">Set the default audience for your full profile.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.profileVisibility}
            onChange={(e) => handleSelectChange('privacy', 'profileVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Profile photo visibility</label>
            <p className="option-description">Control who can see your avatar.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.avatarVisibility}
            onChange={(e) => handleSelectChange('privacy', 'avatarVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Name visibility</label>
            <p className="option-description">Control who can see your display name.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.nameVisibility}
            onChange={(e) => handleSelectChange('privacy', 'nameVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>

      <div className="settings-stp-page-grid">
        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Title visibility</label>
            <p className="option-description">Choose who can see your job title or professional headline.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.titleVisibility}
            onChange={(e) => handleSelectChange('privacy', 'titleVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Location visibility</label>
            <p className="option-description">Control whether your city or region is visible.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.locationVisibility}
            onChange={(e) => handleSelectChange('privacy', 'locationVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Bio visibility</label>
            <p className="option-description">Choose who can read your profile summary.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.bioVisibility}
            onChange={(e) => handleSelectChange('privacy', 'bioVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>

      <div className="settings-stp-page-section-heading">
        <h3>Professional details</h3>
        <p>Control visibility of your career, education, skills and media.</p>
      </div>

      <div className="settings-stp-page-grid">
        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Experience visibility</label>
            <p className="option-description">Control who sees your work experience or seniority level.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.experienceVisibility}
            onChange={(e) => handleSelectChange('privacy', 'experienceVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Skills visibility</label>
            <p className="option-description">Choose whether your skill set is visible to others.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.skillsVisibility}
            onChange={(e) => handleSelectChange('privacy', 'skillsVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Education visibility</label>
            <p className="option-description">Allow others to see your education history.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.educationVisibility}
            onChange={(e) => handleSelectChange('privacy', 'educationVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>

      <div className="settings-stp-page-grid">
        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Certifications visibility</label>
            <p className="option-description">Choose who can see your certifications and credentials.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.certificationsVisibility}
            onChange={(e) => handleSelectChange('privacy', 'certificationsVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Portfolio visibility</label>
            <p className="option-description">Allow your portfolio and uploaded media to be viewable.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.portfolioVisibility}
            onChange={(e) => handleSelectChange('privacy', 'portfolioVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Industry visibility</label>
            <p className="option-description">Control whether your industry field appears.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.industryVisibility}
            onChange={(e) => handleSelectChange('privacy', 'industryVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>

      <div className="settings-stp-page-grid">
        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Company visibility</label>
            <p className="option-description">Choose who can see your employer or company name.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.companyVisibility}
            onChange={(e) => handleSelectChange('privacy', 'companyVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Website visibility</label>
            <p className="option-description">Control whether your website link is visible.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.websiteVisibility}
            onChange={(e) => handleSelectChange('privacy', 'websiteVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Social links visibility</label>
            <p className="option-description">Choose who can view your social link buttons.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.socialLinksVisibility}
            onChange={(e) => handleSelectChange('privacy', 'socialLinksVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>

      <div className="settings-stp-page-section-heading">
        <h3>Contact & discovery</h3>
        <p>Choose who can contact you and whether you can be found by email or phone.</p>
      </div>

      <div className="settings-stp-page-grid">
        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Email visibility</label>
            <p className="option-description">Control whether your email is visible and searchable.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.emailVisibility}
            onChange={(e) => handleSelectChange('privacy', 'emailVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Phone visibility</label>
            <p className="option-description">Control who can see and search for your phone number.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.phoneVisibility}
            onChange={(e) => handleSelectChange('privacy', 'phoneVisibility', e.target.value)}
          >
            <option value="public">Public</option>
            <option value="connections">Connections only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Message privacy</label>
            <p className="option-description">Restrict who can send you direct messages.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.messagePrivacy}
            onChange={(e) => handleSelectChange('privacy', 'messagePrivacy', e.target.value)}
          >
            <option value="public">Everyone</option>
            <option value="connections">Connections only</option>
            <option value="private">No one</option>
          </select>
        </div>
      </div>

      <div className="settings-stp-page-grid">
        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Contact request privacy</label>
            <p className="option-description">Choose who can send you contact or connection requests.</p>
          </div>
          <select
            className="settings-stp-page-select"
            value={settings.privacy.contactRequestPrivacy}
            onChange={(e) => handleSelectChange('privacy', 'contactRequestPrivacy', e.target.value)}
          >
            <option value="public">Everyone</option>
            <option value="connections">Connections only</option>
            <option value="private">No one</option>
          </select>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Search by email</label>
            <p className="option-description">Allow people to find you using your email address.</p>
          </div>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="searchByEmail"
              checked={settings.privacy.searchByEmail}
              onChange={() => handleToggle('privacy', 'searchByEmail')}
            />
            <label htmlFor="searchByEmail"></label>
          </div>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Search by phone</label>
            <p className="option-description">Allow people to find you using your phone number.</p>
          </div>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="searchByPhone"
              checked={settings.privacy.searchByPhone}
              onChange={() => handleToggle('privacy', 'searchByPhone')}
            />
            <label htmlFor="searchByPhone"></label>
          </div>
        </div>
      </div>

      <div className="settings-stp-page-section-heading">
        <h3>Presence & security</h3>
        <p>Adjust visibility of your status and protect profile content.</p>
      </div>

      <div className="settings-stp-page-grid">
        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Online status</label>
            <p className="option-description">Allow others to see when you are active in the app.</p>
          </div>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="showOnlineStatus"
              checked={settings.privacy.showOnlineStatus}
              onChange={() => handleToggle('privacy', 'showOnlineStatus')}
            />
            <label htmlFor="showOnlineStatus"></label>
          </div>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Last seen</label>
            <p className="option-description">Control whether others can see when you were last online.</p>
          </div>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="showLastSeen"
              checked={settings.privacy.showLastSeen}
              onChange={() => handleToggle('privacy', 'showLastSeen')}
            />
            <label htmlFor="showLastSeen"></label>
          </div>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Activity status</label>
            <p className="option-description">Show whether you are currently active or away.</p>
          </div>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="showActivityStatus"
              checked={settings.privacy.showActivityStatus}
              onChange={() => handleToggle('privacy', 'showActivityStatus')}
            />
            <label htmlFor="showActivityStatus"></label>
          </div>
        </div>
      </div>

      <div className="settings-stp-page-grid">
        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Allow profile sharing</label>
            <p className="option-description">Let others share your profile with contacts.</p>
          </div>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="allowProfileSharing"
              checked={settings.privacy.allowProfileSharing}
              onChange={() => handleToggle('privacy', 'allowProfileSharing')}
            />
            <label htmlFor="allowProfileSharing"></label>
          </div>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Allow resume download</label>
            <p className="option-description">Control if your profile can be downloaded as a resume.</p>
          </div>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="allowResumeDownload"
              checked={settings.privacy.allowResumeDownload}
              onChange={() => handleToggle('privacy', 'allowResumeDownload')}
            />
            <label htmlFor="allowResumeDownload"></label>
          </div>
        </div>

        <div className="settings-stp-page-option card-card">
          <div className="option-info">
            <label className="option-label">Allow screenshots</label>
            <p className="option-description">Disable screenshot capture for sensitive or private sections.</p>
          </div>
          <div className="toggle-switch">
            <input
              type="checkbox"
              id="allowScreenshots"
              checked={settings.privacy.allowScreenshots}
              onChange={() => handleToggle('privacy', 'allowScreenshots')}
            />
            <label htmlFor="allowScreenshots"></label>
          </div>
        </div>
      </div>
    </div>
  </div>
);
