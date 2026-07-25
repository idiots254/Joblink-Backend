import './SettingsPage.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { App } from '@capacitor/app';
import { setSecure, setSystemBarLightMode } from '../services/screenshotControl';
import { pushBackAction, popBackAction, runBackAction } from '../services/backNavigation';
import { FiChevronLeft, FiBell, FiSliders, FiUser, FiHelpCircle, FiChevronRight, FiMessageSquare, FiFileText, FiPackage } from 'react-icons/fi';
import { PadlockIcon } from './PadlockIcon';
import { useNotifications } from '../contexts/NotificationContext';
import { API_URL } from '../config';
import { supabase } from '../supabase';

// Import tab components
import { NotificationsTab } from './tabs/NotificationsTab';
import { PrivacyTab } from './tabs/PrivacyTab';
import { PreferencesTab } from './tabs/PreferencesTab';
import { AccountTab } from './tabs/AccountTab';
import { HelpTab } from './tabs/HelpTab';
import { FaqTab } from './tabs/FaqTab';
import { FeedbackTab } from './tabs/FeedbackTab';
import { AgreementTab } from './tabs/UserAgreement';
import { UsagePolicy } from './tabs/UsagePolicy';
import { AppsTab } from './tabs/AppsTab';
import { AboutUsTab } from './tabs/AboutUsTab';

// Import custom icon
import { UsageRulesIcon } from './icons/UsageRulesIcon';

function SettingsPage({ onBack, onLogout }) {
  const [currentPage, setCurrentPage] = useState('main');
  const [headerOverride, setHeaderOverride] = useState(null);
  const [settings, setSettings] = useState({
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      jobAlerts: true,
      messageNotifications: true
    },
    privacy: {
      profileVisibility: 'public',
      avatarVisibility: 'public',
      nameVisibility: 'connections',
      titleVisibility: 'connections',
      emailVisibility: 'connections',
      phoneVisibility: 'connections',
      locationVisibility: 'public',
      bioVisibility: 'public',
      experienceVisibility: 'connections',
      skillsVisibility: 'public',
      educationVisibility: 'connections',
      certificationsVisibility: 'connections',
      portfolioVisibility: 'public',
      industryVisibility: 'public',
      companyVisibility: 'public',
      websiteVisibility: 'public',
      socialLinksVisibility: 'connections',
      messagePrivacy: 'connections',
      contactRequestPrivacy: 'connections',
      searchByEmail: false,
      searchByPhone: false,
      allowProfileSharing: false,
      allowResumeDownload: false,
      showOnlineStatus: true,
      showLastSeen: false,
      showActivityStatus: true,
      allowScreenshots: true,
      allowMessages: true
    },
    preferences: {
      theme: 'dark',
      language: 'English',
      allowLocation: false
    }
  });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDisableLocationConfirm, setShowDisableLocationConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [, setSavedMessage] = useState(false); // eslint-disable-next-line no-unused-vars
  const { showToast } = useNotifications();

  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const handleSettingsBack = useCallback(async () => {
    if (currentPageRef.current !== 'main') {
      setCurrentPage('main');
      return;
    }

    if (typeof onBack === 'function') {
      onBack();
    }
  }, [onBack]);

  useEffect(() => {
    if (typeof onBack !== 'function') return undefined;

    pushBackAction(handleSettingsBack);
    return () => popBackAction(handleSettingsBack);
  }, [handleSettingsBack, onBack]);

  useEffect(() => {
    if (!window.Capacitor) return undefined;

    const handleNativeBack = async () => {
      const handled = await runBackAction();
      if (!handled) {
        await handleSettingsBack();
      }
    };

    let listener = null;
    const setupListener = async () => {
      try {
        listener = await App.addListener('backButton', handleNativeBack);
      } catch (e) {
        console.warn('SettingsPage: native back listener not available:', e?.message || e);
      }
    };

    setupListener();

    return () => {
      try {
        if (listener?.remove) {
          listener.remove();
        } else if (typeof listener === 'function') {
          listener();
        }
      } catch (err) {
        console.warn('SettingsPage: failed to remove native back listener:', err);
      }
    };
  }, [handleSettingsBack]);

  const handleHeaderBack = async () => {
    try {
      const handled = await runBackAction();
      if (!handled) {
        await handleSettingsBack();
      }
    } catch (e) {
      await handleSettingsBack();
    }
  };

  const handleIndividualHeaderBack = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      const handled = await runBackAction();
      if (!handled) {
        if (currentPage === 'faq') {
          setCurrentPage('help');
        } else {
          setCurrentPage('main');
        }
      }
    } catch (err) {
      if (currentPage === 'faq') {
        setCurrentPage('help');
      } else {
        setCurrentPage('main');
      }
    }
  };

  const handleConfirmDisableLocation = async () => {
    setShowDisableLocationConfirm(false);
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        allowLocation: false
      }
    }));

    try {
      const { disableLocationTracking } = await import('../notifications/registerLocation');
      await disableLocationTracking();
    } catch (e) {
      console.warn('Failed to call disableLocationTracking:', e);
    }

    try {
      if (typeof window.updateUserProfile === 'function') {
        await window.updateUserProfile({ allow_location: false });
        // Ensure localStorage is synced
        localStorage.setItem('allow_location', 'false');
      } else {
        localStorage.setItem('allow_location', 'false');
      }
    } catch (e) {
      console.warn('Failed to persist allow_location to profile', e);
      localStorage.setItem('allow_location', 'false');
    }

    showToast({ type: 'warning', title: 'Location disabled' });
    showSavedMessage();
  };

  const handleToggle = (category, key) => {
    // Calculate the new value BEFORE state update (since state updates are async)
    const currentValue = settings[category]?.[key];
    const toggledValue = !currentValue;

    console.log(`Toggle ${key} from ${currentValue} to ${toggledValue}`);
    console.log(`Check: category=${category}, key=${key}, !toggledValue=${!toggledValue}`);

    // Confirm before disabling location
    if (category === 'preferences' && key === 'allowLocation' && !toggledValue) {
      console.log('SHOWING DISABLE LOCATION CONFIRMATION');
      setShowDisableLocationConfirm(true);
      return;
    }

    setSettings(prev => {
      const newState = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: toggledValue
        }
      };
      console.log('New settings state:', newState.privacy);
      return newState;
    });

    // Persist allow_screenshots preference when toggled
    if (category === 'privacy' && key === 'allowScreenshots') {
      console.log('Updating profile with allow_screenshots:', toggledValue);
      // Update backend profile and native secure flag
      try {
        if (typeof window.updateUserProfile === 'function') {
          window.updateUserProfile({ allow_screenshots: toggledValue }).then(() => {
            console.log('Profile updated successfully');
          }).catch(err => console.warn('Profile update failed', err));
        }
      } catch (e) {
        console.warn('Failed to update profile', e);
      }

      // Plugin: secure = true means block screenshots
      // allow_screenshots = true means DON'T block
      // So: secure = !allow_screenshots
      console.log('Setting secure flag to:', !toggledValue);
      setSecure(!toggledValue);
    }

    // Persist location preference without forcing a blocking native prompt here
    if (category === 'preferences' && key === 'allowLocation') {
      if (toggledValue) {
        if (typeof window.updateUserProfile === 'function') {
          window.updateUserProfile({ allow_location: true })
            .then(() => {
              localStorage.setItem('allow_location', 'true');
            })
            .catch((updateErr) => {
              console.warn('Profile update failed, using localStorage:', updateErr);
              localStorage.setItem('allow_location', 'true');
            });
        } else {
          localStorage.setItem('allow_location', 'true');
        }
        showToast({ type: 'success', title: 'Location enabled' });
      } else {
        if (typeof window.updateUserProfile === 'function') {
          window.updateUserProfile({ allow_location: false })
            .then(() => {
              localStorage.setItem('allow_location', 'false');
            })
            .catch((updateErr) => {
              console.warn('Profile update failed, using localStorage:', updateErr);
              localStorage.setItem('allow_location', 'false');
            });
        } else {
          localStorage.setItem('allow_location', 'false');
        }
        showToast({ type: 'warning', title: 'Location disabled' });
      }
    }

    showSavedMessage();
  };

  // Load current profile values (including allow_screenshots)
  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      try {
        if (window.getCurrentUserProfile) {
          const profile = await window.getCurrentUserProfile();
          if (!mounted || !profile) return;
          setSettings(prev => ({
            ...prev,
            privacy: {
              ...prev.privacy,
              allowScreenshots: !!profile.allow_screenshots
            },
            preferences: {
              ...prev.preferences,
              allowLocation: !!profile.allow_location
            }
          }));
          // Mark that we've loaded the profile so localStorage doesn't override
          window.profileLoaded = true;
        }
      } catch (e) {
        console.warn('Failed to load profile for settings', e);
      }
    };
    loadProfile();
    return () => { mounted = false; };
  }, []);

  // If no server-side profile value exists, fall back to localStorage
  useEffect(() => {
    try {
      // Only use localStorage if profile hasn't been loaded yet
      if (!window.profileLoaded) {
        const stored = localStorage.getItem('allow_location');
        if (stored !== null) {
          setSettings(prev => ({
            ...prev,
            preferences: {
              ...prev.preferences,
              allowLocation: stored === 'true'
            }
          }));
        }
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (currentPage !== 'feedback') setHeaderOverride(null);
  }, [currentPage]);

  const handleSelectChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    
    // Save theme to localStorage, update web theme, and update native system bar icons
    if (category === 'preferences' && key === 'theme') {
      localStorage.setItem('appTheme', value);
      document.documentElement.setAttribute('data-theme', value);
      setSystemBarLightMode(value === 'light');
    }
    
    showSavedMessage();
  };

  const showSavedMessage = () => {
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;

    try {
      setDeletingAccount(true);
      setShowConfirmDelete(false);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('You must be signed in to delete your account.');
      }

      const response = await fetch(`${API_URL}/api/account/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        }
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch (e) {
        // Ignore JSON parse failures and rely on status check below.
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || payload?.message || 'Failed to delete account.');
      }

      showToast({
        type: 'success',
        title: 'Profile removed',
        message: 'Your profile and related data were removed. Your Google account remains intact.'
      });

      if (typeof onLogout === 'function') {
        await onLogout();
      } else if (typeof onBack === 'function') {
        onBack();
      }
    } catch (error) {
      console.error('Account deletion failed:', error);
      showToast({
        type: 'error',
        title: 'Deletion failed',
        message: error?.message || 'Unable to delete account right now.'
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const tabConfig = [
    { id: 'notifications', label: 'Notifications', icon: FiBell, description: 'Manage alerts' },
    { id: 'privacy', label: 'Privacy', icon: PadlockIcon, description: 'Control visibility' },
    { id: 'preferences', label: 'Preferences', icon: FiSliders, description: 'Customize experience' },
    { id: 'account', label: 'Account', icon: FiUser, description: 'Manage account' },
    { id: 'help', label: 'Help & Support', icon: FiHelpCircle, description: 'Get assistance' },
    { id: 'feedback', label: 'Feedback', icon: FiMessageSquare, description: 'Share your feedback' },
    { id: 'agreement', label: 'User Agreement', icon: FiFileText, description: 'Terms & conditions' },
    { id: 'usage', label: 'Usage Policy', icon: UsageRulesIcon, description: 'Platform guidelines' },
    { id: 'about', label: 'About Us', icon: FiFileText, description: 'Learn about Joblink' },
    { id: 'apps', label: 'Apps', icon: FiPackage, description: 'Manage applications' }
  ];

  const renderHeaderTitle = () => {
    if (headerOverride) {
      if (typeof headerOverride === 'string') {
        const m = headerOverride.match(/^(.+?)\s*\((.+)\)$/);
        if (m) {
          return (
            <>
              <span className="header-main">{m[1]}</span>
              <span className="header-bracket">({m[2]})</span>
            </>
          );
        }
      }
      return headerOverride;
    }
    if (currentPage === 'faq') return 'Frequently Asked Questions';
    return tabConfig.find(t => t.id === currentPage)?.label;
  };

  // Main Settings Page View
  if (currentPage === 'main') {
    return (
      <div className="settings-stp-page-container">
        {/* Header */}
        <div className="settings-stp-page-header">
          <button className="settings-stp-back-btn" onClick={handleHeaderBack}>
            <FiChevronLeft />
            <span>Back</span>
          </button>
          <h1 className="settings-stp-page-title">Settings</h1>
          <div className="settings-stp-header-spacer"></div>
        </div>

        <div className="settings-stp-page-content">
          {/* Large Tab Cards */}
          <div className="settings-stp-tabs-cards-grid">
            {tabConfig.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className="settings-stp-tab-card"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentPage(tab.id);
                  }}
                >
                  <div className="tab-card-left">
                    <div className="tab-card-icon">
                      <Icon />
                    </div>
                    <div className="tab-card-content">
                      <h3 className="tab-card-label">{tab.label}</h3>
                      <p className="tab-card-description">{tab.description}</p>
                    </div>
                  </div>
                  <div className="tab-card-arrow">
                    <FiChevronRight />
                  </div>
                </button>
              );
            })}
            {onLogout && (
              <button
                className="settings-stp-tabs-signout-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowLogoutConfirm(true);
                }}
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-stp-page-footer">
          <div className="footer-content">
          </div>
          <button className="settings-stp-page-close-btn" onClick={handleHeaderBack}>
            Close Settings
          </button>
        </div>

        {/* Disable Location Confirmation Modal */}
        {showDisableLocationConfirm && (
          <div className="settings-stp-modal-overlay" onClick={() => setShowDisableLocationConfirm(false)}>
            <div className="settings-stp-modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">Disable Location</h2>
              <p className="modal-message">Are you sure you want to disable location? This will stop nearby job suggestions and location-based features.</p>
              <div className="modal-buttons">
                <button
                  className="modal-btn modal-cancel-btn"
                  onClick={() => setShowDisableLocationConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn modal-confirm-btn"
                  onClick={handleConfirmDisableLocation}
                >
                  Disable
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="settings-stp-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
            <div className="settings-stp-modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">Confirm Logout</h2>
              <p className="modal-message">Are you sure you want to log out?</p>
              <div className="modal-buttons">
                <button
                  className="modal-btn modal-cancel-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn modal-confirm-btn"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Individual Settings Page Views
  return (
    <div className="settings-stp-page-container">
      {/* Header */}
      <div className="settings-stp-page-header">
        <button className="settings-stp-back-btn" onClick={handleIndividualHeaderBack}>
          <FiChevronLeft />
          <span>Back</span>
        </button>
        <h1 className="settings-stp-page-title">{renderHeaderTitle()}</h1>
        <div className="settings-stp-header-spacer"></div>
      </div>

      <div className={`settings-stp-page-content ${currentPage === 'about' ? 'about-page-content' : ''}`}>
        <div className={`settings-stp-page-body ${currentPage === 'about' ? 'about-page-body' : ''}`}>
          
          {currentPage === 'notifications' && <NotificationsTab settings={settings} handleToggle={handleToggle} showSavedMessage={showSavedMessage} />}
          {currentPage === 'privacy' && <PrivacyTab settings={settings} handleToggle={handleToggle} handleSelectChange={handleSelectChange} showSavedMessage={showSavedMessage} />}
          {currentPage === 'preferences' && <PreferencesTab settings={settings} handleSelectChange={handleSelectChange} handleToggle={handleToggle} showSavedMessage={showSavedMessage} />}
          {currentPage === 'account' && (
            <AccountTab
              showConfirmDelete={showConfirmDelete}
              setShowConfirmDelete={setShowConfirmDelete}
              handleDeleteAccount={handleDeleteAccount}
              deletingAccount={deletingAccount}
            />
          )}
          {currentPage === 'help' && <HelpTab onViewFaq={() => setCurrentPage('faq')} />}
          {currentPage === 'faq' && <FaqTab onBack={() => setCurrentPage('help')} />}
          {currentPage === 'feedback' && <FeedbackTab setHeaderTitle={setHeaderOverride} />}
          {currentPage === 'about' && <AboutUsTab onOpenAgreement={() => setCurrentPage('agreement')} onOpenPrivacy={() => setCurrentPage('privacy')} />}
          {currentPage === 'agreement' && <AgreementTab onBack={() => setCurrentPage('main')} />}
          {currentPage === 'usage' && <UsagePolicy onBack={() => setCurrentPage('main')} />}
          {currentPage === 'apps' && <AppsTab />}

        </div>
      </div>

      {/* Footer */}
      <div className="settings-stp-page-footer">
        <div className="footer-content">
        </div>
        <button className="settings-stp-page-close-btn" onClick={handleHeaderBack}>
          Close Settings
        </button>
      </div>

      {/* Disable Location Confirmation Modal */}
      {showDisableLocationConfirm && (
        <div className="settings-stp-modal-overlay" onClick={() => setShowDisableLocationConfirm(false)}>
          <div className="settings-stp-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Disable Location</h2>
            <p className="modal-message">Are you sure you want to disable location? This will stop nearby job suggestions and location-based features.</p>
            <div className="modal-buttons">
              <button
                className="modal-btn modal-cancel-btn"
                onClick={() => setShowDisableLocationConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-confirm-btn"
                onClick={handleConfirmDisableLocation}
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="settings-stp-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="settings-stp-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Confirm Logout</h2>
            <p className="modal-message">Are you sure you want to log out?</p>
            <div className="modal-buttons">
              <button
                className="modal-btn modal-cancel-btn"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn modal-confirm-btn"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
