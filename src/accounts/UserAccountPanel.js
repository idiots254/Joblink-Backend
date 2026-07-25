import './UserAccountPanel.css';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGithub, FaLinkedin, FaXTwitter, FaGlobe, FaInstagram, FaFacebook, FaTiktok, FaWhatsapp, FaImage, FaVideo, FaFilePdf } from 'react-icons/fa6';
import { API_URL } from '../config';
import { supabase } from '../supabase';
import { pushBackAction, popBackAction } from '../services/backNavigation';
import { getAccountPanelBackState } from './accountPanelBackBehavior';
import { uploadAvatarToSupabase } from '../utils/avatarStorage';
import { uploadMediaFileToSupabase } from '../utils/mediaStorage';
import { normalizeProfileMediaFiles, serializeMediaForDatabase } from '../utils/profileMedia';
import { getInitialProfileData } from './profileFormData';
import EmployerAccountPanel from './EmployerAccountPanel';
import PremiumPanel from '../Subscription/PremiumPanel';
import PremiumProPanel from '../Subscription/PremiumProPanel';
import SubscriptionModal from '../Subscription/SubscriptionModal';
import LocationSelector from '../forms/LocationSelector';
import LanguageSelector from '../forms/LanguageSelector';
import ExperienceSelector from '../forms/ExperienceSelector';
import AvailabilitySelector from '../forms/AvailabilitySelector';
import ProjectTypeSelector from '../forms/ProjectTypeSelector';
import WorkStyleSelector from '../forms/WorkStyleSelector';
import RateSelector from '../forms/RateSelector';
import { buildWhatsappUrl, getDigitsOnly, getSharedContactNumber } from './contactSyncUtils';

/**
 * Get initials from name for avatar placeholder
 */
const getInitials = (name, fallbackEmail = '') => {
  if (name && name.trim()) {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  // Use email as fallback
  if (fallbackEmail && fallbackEmail.trim()) {
    return fallbackEmail.charAt(0).toUpperCase();
  }
  return '?';
};

/**
 * Generate professional solid color for avatar placeholder
 */
const getAvatarColor = (name, fallbackEmail = '') => {
  const colors = [
    '#FF5722', '#F44336', '#E91E63', '#9C27B0', '#673AB7',
    '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50',
    '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF6F00'
  ];
  
  // Determine which string to hash
  const hashSource = (name && name.trim()) ? name : (fallbackEmail && fallbackEmail.trim() ? fallbackEmail : '');
  
  let hash = 0;
  for (let i = 0; i < hashSource.length; i++) {
    hash = hashSource.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitialMediaFiles = (accountToUse) => {
  if (!accountToUse || typeof accountToUse !== 'object') return [];
  return normalizeProfileMediaFiles(accountToUse);
};

const PENDING_DRAFT_KEY = 'joblinkPendingProfileDraft';

const readPendingProfileDraft = () => {
  try {
    const raw = localStorage.getItem(PENDING_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('[UserAccountPanel] Failed to read pending draft:', error);
    return null;
  }
};

function UserAccountPanel({ onClose, selectedAccount, selectedAccountType, onProfileCreated, onBack, onDeleteMedia }) {
  const navigate = useNavigate();

  // Check if this is a new account (no profile data) - declare before state that uses it
  console.log('UserAccountPanel mounted/re-rendered with selectedAccount:', selectedAccount);
  
  const accountToUse = selectedAccount;

  const loginUser = useMemo(() => {
    try {
      const saved = localStorage.getItem('joblinkUser');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Error parsing joblinkUser from localStorage:', error);
      return null;
    }
  }, []);
  const isEditMode = !!accountToUse && (accountToUse.name || accountToUse.email || accountToUse.title || accountToUse.userType === 'employee');
  
  // For new accounts, start with null to show account type. For existing, load their account type.
  // If creating a new account and selectedAccountType is provided, use that
  const [accountType, setAccountType] = useState(() => {
    const draft = readPendingProfileDraft();
    return selectedAccount?.userType || selectedAccountType || draft?.accountType || null;
  });
  
  const [activeTab] = useState('profile');
  const [isEditingProfile, setIsEditingProfile] = useState(() => {
    // For new employee accounts, start in editing mode
    return accountType === 'employee';
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [viewMode, setViewMode] = useState('steps'); // 'steps' or 'full'
  const [showPremiumPanel, setShowPremiumPanel] = useState(false);
  const [showPremiumProPanel, setShowPremiumProPanel] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isClosingMessage] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [filledFields, setFilledFields] = useState(new Set());
  const [emailSuggestion, setEmailSuggestion] = useState(''); // Track email suggestion
  const [isEmailValid] = useState(false); // Track email validation
  const [isCheckingEmail] = useState(false); // Track email checking state
  const [emailErrorShaking, setEmailErrorShaking] = useState(false); // Trigger shake animation
  const [otpCode, setOtpCode] = useState(''); // OTP entered by user
  const [otpSent, setOtpSent] = useState(false); // Track if OTP was sent
  const [otpVerified, setOtpVerified] = useState(false); // Track if OTP was verified
  const [isCheckingOTP, setIsCheckingOTP] = useState(false); // Track OTP verification in progress
  const [otpError, setOtpError] = useState(''); // OTP error message
  const [resendCountdown, setResendCountdown] = useState(0); // Countdown timer for resend
  const [showOtpModal, setShowOtpModal] = useState(false); // Show OTP verification modal
  const [modalEmail, setModalEmail] = useState(''); // Email in OTP modal
  const [modalEmailError, setModalEmailError] = useState(''); // Email error in modal
  const [showPhoneCountryModal, setShowPhoneCountryModal] = useState(false); // Phone country dropdown modal
  const [selectedCountryCode, setSelectedCountryCode] = useState('+254'); // Selected country code
  const [selectedCountryInfo, setSelectedCountryInfo] = useState('🇰🇪 Kenya'); // Selected country with flag
  const [phoneNumberValue, setPhoneNumberValue] = useState('');
  const TOTAL_STEPS = 5;

  // Avatar file input refs
  const avatarInputRefStep1 = useRef(null);
  const avatarInputRefFullView = useRef(null);
  const otpInputRefs = useRef([]);
  const lastAutoVerifyRef = useRef(null); // track last auto-verified OTP to avoid repeated attempts
  const otpInputTouchedRef = useRef(false); // detect user-entered OTP input vs restored draft

  const handleOtpBoxChange = (index, value) => {
    const sanitizedValue = value.replace(/\D/g, '');

    if (sanitizedValue.length > 1) {
      otpInputTouchedRef.current = true;
      fillOtpDigits(sanitizedValue, index);
      return;
    }

    otpInputTouchedRef.current = true;
    setOtpCode(prevCode => {
      const nextCode = Array.from({ length: 6 }, (_, i) => prevCode[i] || '');
      nextCode[index] = sanitizedValue.slice(0, 1);
      // User edited the code - allow auto-verify again for new input
      lastAutoVerifyRef.current = null;
      return nextCode.join('');
    });
    setOtpError('');

    if (sanitizedValue && index < 5) {
      setTimeout(() => {
        otpInputRefs.current[index + 1]?.focus();
      }, 0);
    }
  };

  const fillOtpDigits = (digits, startIndex = 0) => {
    const sanitizedDigits = digits.replace(/\D/g, '').slice(0, 6);
    if (!sanitizedDigits) return;

    setOtpCode((prevCode) => {
      const nextCode = Array.from({ length: 6 }, (_, i) => prevCode[i] || '');
      for (let i = 0; i < sanitizedDigits.length && startIndex + i < 6; i += 1) {
        nextCode[startIndex + i] = sanitizedDigits[i];
      }
      // Reset last auto-verify when pasting/filling new digits
      lastAutoVerifyRef.current = null;
      return nextCode.join('');
    });

    setOtpError('');

    setTimeout(() => {
      const focusIndex = Math.min(startIndex + sanitizedDigits.length, 5);
      otpInputRefs.current[focusIndex]?.focus();
    }, 0);
  };

  const getNextOtpIndex = () => {
    const nextEmpty = otpCode.split('').findIndex((digit) => !digit);
    return nextEmpty === -1 ? 6 : nextEmpty;
  };

  const handleOtpHiddenInputInput = (event) => {
    const rawValue = event.target.value || '';
    const digits = rawValue.replace(/\D/g, '');
    if (!digits) return;

    const startIndex = getNextOtpIndex();
    if (startIndex >= 6) {
      event.target.value = '';
      return;
    }

    fillOtpDigits(digits, startIndex);
    event.target.value = '';
  };

  const handleOtpHiddenInputPaste = (event) => {
    const pastedText = event.clipboardData?.getData('text') || '';
    const digits = pastedText.replace(/\D/g, '').slice(0, 6);
    if (!digits) return;

    event.preventDefault();
    const startIndex = getNextOtpIndex();
    fillOtpDigits(digits, startIndex);
  };

  const handleOtpHiddenInputKeyDown = (event) => {
    if (event.key !== 'Backspace') return;

    const nextEmpty = otpCode.split('').findIndex((digit) => !digit);
    const removeIndex = nextEmpty === -1 ? 5 : Math.max(0, nextEmpty - 1);

    setOtpCode((prevCode) => {
      const nextCode = Array.from({ length: 6 }, (_, i) => prevCode[i] || '');
      nextCode[removeIndex] = '';
      return nextCode.join('');
    });

    setTimeout(() => {
      otpInputRefs.current[removeIndex]?.focus();
    }, 0);
  };

  const handleOtpPaste = (event) => {
    const pastedText = event.clipboardData?.getData('text') || '';
    const startIndex = Number(event.target.dataset.index || 0);
    event.preventDefault();
    fillOtpDigits(pastedText, startIndex);
  };

  const handleOtpBeforeInput = (index, event) => {
    const inputType = event.nativeEvent?.inputType || '';
    const data = event.nativeEvent?.data || '';
    const digits = data.replace(/\D/g, '');
    if (!digits) return;
    if (digits.length > 1 || inputType.includes('paste') || inputType.includes('insertFromPaste') || inputType.includes('insertReplacementText')) {
      event.preventDefault();
      fillOtpDigits(digits, index);
    }
  };

  // Load avatar from selectedAccount or auth profile
  const [, setAvatarState] = useState(() => selectedAccount?.avatar || loginUser?.avatar || null);

  // Cache the avatar color so it doesn't change as user edits the name
  const [cachedAvatarColor, setCachedAvatarColor] = useState(null);

  const getProfessionName = () => {
    try {
      const profession = JSON.parse(localStorage.getItem('selectedProfession'));
      return profession?.name || 'Professional';
    } catch {
      return 'Professional';
    }
  };
  const [professionName] = useState(getProfessionName);

  useEffect(() => {
    // Sync avatar from selectedAccount when it changes
    if (selectedAccount?.avatar) {
      setAvatarState(selectedAccount.avatar);
      setFormData(prev => ({
        ...prev,
        avatar: selectedAccount.avatar
      }));
    }
  }, [selectedAccount?.avatar]);

  // Sync accountType from selectedAccountType prop for new account creation
  useEffect(() => {
    if (selectedAccountType && !selectedAccount?.userType) {
      setAccountType(selectedAccountType);
      setIsEditingProfile(true);
    }
  }, [selectedAccountType, selectedAccount?.userType]);

  // Auto-fill email from authenticated user on component mount
  useEffect(() => {
    const autoFillEmail = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          console.log('📧 Auto-filling email from auth:', session.user.email);
          // Only set email if it's currently empty
          setFormData(prev => {
            if (!prev.email || prev.email.trim() === '') {
              return {
                ...prev,
                email: session.user.email
              };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Error fetching user email:', err);
      }
    };

    autoFillEmail();
  }, []);

  const [profileData, setProfileData] = useState(() => {
    const initialData = getInitialProfileData(accountToUse, loginUser);
    console.log('Initial profileData state:', initialData);
    return initialData;
  });

  const previousSelectedAccountIdRef = useRef();
  const previousAccountTypeRef = useRef();

  const handlePanelBack = useCallback(() => {
    const backState = getAccountPanelBackState({
      currentStep,
      isEditingProfile,
      viewMode,
      showPremiumPanel,
      showPremiumProPanel,
      showSubscriptionModal,
    });

    switch (backState.kind) {
      case 'previous-step':
        if (viewMode === 'steps' && currentStep > 1) {
          setCurrentStep((prev) => prev - 1);
          window.scrollTo(0, 0);
          return;
        }
        if (isEditingProfile) {
          setIsEditingProfile(false);
          setCurrentStep(1);
          setViewMode('full');
          return;
        }
        break;
      case 'exit-edit-mode':
        setIsEditingProfile(false);
        setCurrentStep(1);
        setViewMode('full');
        return;
      case 'close-premium-panel':
        setShowPremiumPanel(false);
        return;
      case 'close-premium-pro-panel':
        setShowPremiumProPanel(false);
        return;
      case 'close-subscription-modal':
        setShowSubscriptionModal(false);
        return;
      case 'close-panel':
      default:
        break;
    }

    if (typeof onBack === 'function') {
      onBack();
    } else if (typeof onClose === 'function') {
      onClose();
    }
  }, [currentStep, isEditingProfile, onBack, onClose, showPremiumPanel, showPremiumProPanel, showSubscriptionModal, viewMode]);

  useEffect(() => {
    pushBackAction(handlePanelBack);
    return () => popBackAction(handlePanelBack);
  }, [handlePanelBack]);
  
  const [formData, setFormData] = useState(() => {
    const initialData = getInitialProfileData(accountToUse, loginUser);
    console.log('Initial formData state:', initialData);
    return initialData;
  });
  // Derived handle inputs so users can enter only the username/number part
  const [githubHandle, setGithubHandle] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [linkedinHandle, setLinkedinHandle] = useState('');
  const [whatsappLocalNumber, setWhatsappLocalNumber] = useState('');
  const [mediaFiles, setMediaFiles] = useState(() => getInitialMediaFiles(accountToUse));
  const [mediaPreviewId, setMediaPreviewId] = useState(null);
  const touchStartRef = useRef(null);
  const previewVideoRef = useRef(null);

  const getMediaFileKey = (file) => {
    return file.id || file.publicUrl || file.url || file.path || file.name || '';
  };

  const mediaPreview = useMemo(() => {
    if (!mediaPreviewId) return null;
    return mediaFiles.find((file) => getMediaFileKey(file) === mediaPreviewId) || null;
  }, [mediaFiles, mediaPreviewId]);

  const normalizeMediaFile = (file, index) => {
    if (!file) return file;
    const baseKey = file.id || file.path || file.publicUrl || file.url || file.name || `media-${Date.now()}-${index}`;
    return {
      ...file,
      id: file.id || baseKey,
    };
  };

  const normalizeMediaFiles = (files = []) => {
    if (!Array.isArray(files)) return [];
    return files.map((file, index) => normalizeMediaFile(file, index));
  };

  // Initialize derived social handle fields from any existing full URLs
  useEffect(() => {
    const extractHandle = (v) => {
      if (!v) return '';
      let s = String(v).trim();
      try {
        if (/^https?:\/\//i.test(s)) {
          const u = new URL(s);
          const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
          if (parts.length > 0) return parts[parts.length - 1];
          return '';
        }
      } catch (e) {
        // not a full URL
      }
      if (s.startsWith('@')) return s.replace(/^@+/, '');
      return s;
    };

    setGithubHandle(extractHandle(formData.github));
    setTwitterHandle(extractHandle(formData.twitter));
    setInstagramHandle(extractHandle(formData.instagram));
    setLinkedinHandle(extractHandle(formData.linkedin));

    const initialPhone = getDigitsOnly(formData.phone);
    const initialWhatsapp = getDigitsOnly(formData.whatsapp);
    const sharedNumber = getSharedContactNumber(initialPhone, initialWhatsapp, selectedCountryCode);

    if (sharedNumber) {
      setPhoneNumberValue(sharedNumber);
      setWhatsappLocalNumber(sharedNumber);
    } else {
      setPhoneNumberValue(initialPhone);
      setWhatsappLocalNumber(initialWhatsapp);
    }
  }, [formData.github, formData.twitter, formData.instagram, formData.linkedin, formData.phone, formData.whatsapp, selectedCountryCode]);

  const ensureProtocol = (u) => {
    if (!u) return '';
    const s = String(u).trim();
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  };

  const composeSocialUrl = (platform, value) => {
    if (!value) return '';
    const v = String(value).trim();
    if (/^https?:\/\//i.test(v)) return v;
    const clean = v.replace(/^@+/, '').replace(/^\/+/, '');
    switch ((platform || '').toLowerCase()) {
      case 'github':
        return `https://github.com/${encodeURIComponent(clean)}`;
      case 'linkedin':
        return `https://www.linkedin.com/in/${encodeURIComponent(clean)}`;
      case 'twitter':
      case 'x':
        return `https://x.com/${encodeURIComponent(clean)}`;
      case 'instagram':
        return `https://www.instagram.com/${encodeURIComponent(clean)}`;
      case 'tiktok':
        return `https://www.tiktok.com/@${encodeURIComponent(clean)}`;
      case 'facebook':
        return `https://www.facebook.com/${encodeURIComponent(clean)}`;
      case 'whatsapp': {
        return buildWhatsappUrl(selectedCountryCode, value);
      }
      default:
        return ensureProtocol(clean);
    }
  };

  useEffect(() => {
    const existingMedia = getInitialMediaFiles(accountToUse);
    if (existingMedia.length > 0) {
      setMediaFiles(normalizeMediaFiles(existingMedia));
    } else if (!accountToUse) {
      setMediaFiles([]);
    }
  }, [accountToUse]);

  const previewMediaFile = useCallback((file) => {
    if (!file) return;
    setMediaPreviewId(getMediaFileKey(file));
  }, []);

  const getMediaFilesByType = useCallback((typePrefix) => {
    if (typePrefix === 'pdf') {
      return mediaFiles.filter(file => file.type === 'application/pdf');
    }
    return mediaFiles.filter(file => file.type.startsWith(typePrefix));
  }, [mediaFiles]);

  const swapPreviewMedia = useCallback((direction) => {
    setMediaPreviewId((currentId) => {
      if (!currentId) return null;

      const currentFile = mediaFiles.find(item => getMediaFileKey(item) === currentId);
      if (!currentFile) return currentId;

      const typePrefix = currentFile.type.startsWith('image/')
        ? 'image'
        : currentFile.type.startsWith('video/')
          ? 'video'
          : currentFile.type === 'application/pdf'
            ? 'pdf'
            : null;

      const previewGroup = typePrefix ? getMediaFilesByType(typePrefix) : mediaFiles;
      if (previewGroup.length <= 1) return currentId;

      const currentIndex = previewGroup.findIndex(item => getMediaFileKey(item) === currentId);
      if (currentIndex === -1) return currentId;

      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) {
        nextIndex = previewGroup.length - 1;
      } else if (nextIndex >= previewGroup.length) {
        nextIndex = 0;
      }

      return getMediaFileKey(previewGroup[nextIndex]);
    });
  }, [getMediaFilesByType, mediaFiles]);

  const handleSwipe = useCallback((e) => {
    if (!touchStartRef.current) return;
    const touchEnd = e.changedTouches[0].clientX;
    const touchStart = touchStartRef.current;
    const swipeDistance = touchStart - touchEnd;
    const minSwipeDistance = 10; // very light swipe to trigger

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      // Swipe left (touchStart > touchEnd) = next image
      // Swipe right (touchStart < touchEnd) = previous image
      if (swipeDistance > 0) {
        swapPreviewMedia(1);
      } else {
        swapPreviewMedia(-1);
      }
    }
    touchStartRef.current = null;
  }, [swapPreviewMedia]);

  const handleTouchStart = useCallback((e) => {
    touchStartRef.current = e.touches[0].clientX;
  }, []);

  const closeMediaPreview = useCallback(() => {
    // pause preview video if playing, then close
    try {
      const v = previewVideoRef.current;
      if (v && typeof v.pause === 'function') {
        v.pause();
        // rewind a bit to avoid continuing audio on some browsers
        try { v.currentTime = 0; } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
    setMediaPreviewId(null);
  }, []);

  useEffect(() => {
    if (!mediaPreview) return;
    if (!mediaPreview.type || !mediaPreview.type.startsWith('video/')) return;
    const v = previewVideoRef.current;
    if (!v) return;

    // Ensure video is unmuted for preview and attempt to play (user interaction allowed)
    try {
      v.muted = false;
      const playPromise = v.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(err => {
          console.warn('Preview video playback prevented:', err);
        });
      }
    } catch (err) {
      console.warn('Error attempting to play preview video:', err);
    }

    return () => {
      try { if (v && typeof v.pause === 'function') v.pause(); } catch (e) {}
    };
  }, [mediaPreview]);

  const renderMediaUploadSection = () => {
    const imageFiles = getMediaFilesByType('image');
    const videoFiles = getMediaFilesByType('video');
    const pdfFiles = getMediaFilesByType('pdf');

    const renderMediaItem = (file) => {
        const originalIndex = mediaFiles.findIndex(item => getMediaFileKey(item) === getMediaFileKey(file));
      const isFirst = originalIndex === 0;
      const isLast = originalIndex === mediaFiles.length - 1;
      const itemKey = getMediaFileKey(file) || `${file.name}-${originalIndex}`;
      return (
        <div key={itemKey} className="media-item">
          <div
            className="media-preview-thumb"
            role="button"
            tabIndex={0}
            onClick={() => previewMediaFile(file)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                previewMediaFile(file);
              }
            }}
            aria-label={`Preview ${file.name}`}
          >
            {file.type.startsWith('image/') ? (
              <img
                src={file.preview || file.publicUrl || file.url}
                alt={file.name}
                className="media-thumbnail"
              />
            ) : file.type.startsWith('video/') ? (
              file.uploading ? (
                <div className="media-file-placeholder video-placeholder">
                  <span className="file-name">Uploading…</span>
                </div>
              ) : file.publicUrl || file.url || file.preview ? (
                <div className="media-video-thumb-wrapper">
                  <video
                    src={file.publicUrl || file.url || file.preview || ''}
                    poster={file.preview && !file.publicUrl && !file.url ? '' : file.preview || ''}
                    className="media-thumbnail"
                    muted
                    playsInline
                    autoPlay
                    loop
                    preload="metadata"
                  />
                  <div className="media-video-play-overlay">▶</div>
                </div>
              ) : (
                <div className="media-file-placeholder video-placeholder">
                  <span className="file-name">{file.name.substring(0, 14)}...</span>
                </div>
              )
            ) : (
              <div className={`media-file-placeholder ${file.type === 'application/pdf' ? 'pdf-placeholder' : ''}`}>
                <span className="file-name">{file.name.substring(0, 14)}...</span>
              </div>
            )}
          </div>

          <div className="media-item-actions">
            <button
              className="media-remove-btn"
              onClick={() => removeMediaFile(getMediaFileKey(file))}
              type="button"
              aria-label={`Remove ${file.name}`}
            >
              ✕
            </button>
          </div>
        </div>
      );
    };

    const allMediaFiles = [...imageFiles, ...videoFiles, ...pdfFiles];

    return (
      <>
        <div className="media-section">
          {/* Image row: button left, gallery right */}
          <div className="media-row">
            <div className="media-control">
              <h4>Image</h4>
              <label className="media-upload-label" aria-label="Attach Images">
                <div className="media-upload-box" title="Attach Images">
                  <FaImage className="media-upload-icon" />
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleMediaUpload}
                  style={{ display: 'none' }}
                />
              </label>
              {imageFiles.length > 0 && (
                <div className="media-count-below">{imageFiles.length} image{imageFiles.length === 1 ? '' : 's'}</div>
              )}
            </div>

            <div className="media-gallery-row">
              {imageFiles.length > 0 ? (
                <div className="media-gallery-grid">
                  {imageFiles.map(file => renderMediaItem(file))}
                </div>
              ) : (
                <p className="media-empty-text">No images uploaded</p>
              )}
            </div>
          </div>

          {/* Video row */}
          <div className="media-row">
            <div className="media-control">
              <h4>Video</h4>
              <label className="media-upload-label" aria-label="Attach Videos">
                <div className="media-upload-box" title="Attach Videos">
                  <FaVideo className="media-upload-icon" />
                </div>
                <input
                  type="file"
                  multiple
                  accept="video/*"
                  onChange={handleMediaUpload}
                  style={{ display: 'none' }}
                />
              </label>
              {videoFiles.length > 0 && (
                <div className="media-count-below">{videoFiles.length} video{videoFiles.length === 1 ? '' : 's'}</div>
              )}
            </div>

            <div className="media-gallery-row">
              {videoFiles.length > 0 ? (
                <div className="media-gallery-grid">
                  {videoFiles.map(file => renderMediaItem(file))}
                </div>
              ) : (
                <p className="media-empty-text">No videos uploaded</p>
              )}
            </div>
          </div>

          {/* PDF row */}
          <div className="media-row">
            <div className="media-control">
              <h4>PDF</h4>
              <label className="media-upload-label" aria-label="Attach PDFs">
                <div className="media-upload-box" title="Attach PDFs">
                  <FaFilePdf className="media-upload-icon" />
                </div>
                <input
                  type="file"
                  multiple
                  accept="application/pdf"
                  onChange={handleMediaUpload}
                  style={{ display: 'none' }}
                />
              </label>
              {pdfFiles.length > 0 && (
                <div className="media-count-below">{pdfFiles.length} PDF{pdfFiles.length === 1 ? '' : 's'}</div>
              )}
            </div>

            <div className="media-gallery-row">
              {pdfFiles.length > 0 ? (
                <div className="media-gallery-grid">
                  {pdfFiles.map(file => renderMediaItem(file))}
                </div>
              ) : (
                <p className="media-empty-text">No PDFs uploaded</p>
              )}
            </div>
          </div>
        </div>

        {mediaPreview && (
          <div className="media-preview-modal" onClick={closeMediaPreview}>
            <div className="media-preview-content" onClick={(event) => event.stopPropagation()}>
              <button
                className="media-preview-close"
                type="button"
                onClick={closeMediaPreview}
                aria-label="Close preview"
              >
                ✕
              </button>
              <div 
                className="media-preview-inner"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleSwipe}
              >
                <div 
                  className="media-preview-clickzone media-preview-clickzone-left"
                  onClick={(e) => {
                    e.stopPropagation();
                    swapPreviewMedia(-1);
                  }}
                />
                <div 
                  className="media-preview-clickzone media-preview-clickzone-right"
                  onClick={(e) => {
                    e.stopPropagation();
                    swapPreviewMedia(1);
                  }}
                />
                {mediaPreview.type.startsWith('image/') ? (
                  <img
                    src={mediaPreview.preview || mediaPreview.publicUrl || mediaPreview.url}
                    alt={mediaPreview.name}
                  />
                ) : mediaPreview.type.startsWith('video/') ? (
                  <video
                    ref={previewVideoRef}
                    src={mediaPreview.publicUrl || mediaPreview.url}
                    controls
                    autoPlay
                    playsInline
                    muted={false}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : (
                  <div className="media-preview-file">
                    <span>{mediaPreview.name}</span>
                    <a
                      href={mediaPreview.publicUrl || mediaPreview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open file in new tab
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const createProfile = useCallback(async () => {
    const authUserId = loginUser?.id || selectedAccount?.id || formData?.id || null;
    const normalizedEmail = formData.email ? formData.email.trim().toLowerCase() : '';
    const otpProof = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('joblinkOtpVerificationId', otpProof);

    const newProfileData = {
      ...formData,
      email: normalizedEmail,
      mediaFiles: mediaFiles,
      userType: accountType,
      _otpVerified: otpProof,
      ...(authUserId ? { id: authUserId } : {})
    };
    console.log('Saving profile:', newProfileData);
    setProfileData(newProfileData);

    // Notify parent component only after OTP verification has completed.
    // NOTE: Do NOT clear the draft here. Let handleProfileCreated in parent clear it
    // only after the profile is fully saved to database and metadata is set.
    if (onProfileCreated) {
      await onProfileCreated(newProfileData);
    } else if (typeof onClose === 'function') {
      onClose();
    }
  }, [accountType, formData, loginUser?.id, mediaFiles, onClose, onProfileCreated, selectedAccount?.id]);

  // Verify OTP in modal
  const handleVerifyModalOTP = useCallback(async () => {
    // Prevent running verification when the modal is not visible
    if (!showOtpModal) return;
    if (!otpCode || otpCode.trim().length === 0) {
      setOtpError('Please enter the OTP code');
      return;
    }

    setIsCheckingOTP(true);
    setOtpError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: modalEmail, code: otpCode })
      });

      const data = await response.json();

      if (data.verified) {
        setOtpVerified(true);
        console.log('✅ OTP verified successfully!');

        // Close modal and create profile immediately - navigation provides the feedback
        setShowOtpModal(false);
        await createProfile();
      } else {
        setOtpVerified(false);
        setOtpError(data.message || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.log('OTP verification error:', error);
      setOtpError('Verification failed. Please try again.');
      setOtpVerified(false);
    }

    setIsCheckingOTP(false);
  }, [createProfile, modalEmail, otpCode, setIsCheckingOTP, setOtpError, setOtpVerified, setShowOtpModal, showOtpModal]);

  // CONSOLIDATED: Single effect to initialize and sync form data when selectedAccount or accountType changes
  useEffect(() => {
    const currentAccountId = selectedAccount?.id || null;
    const currentAccountType = accountType;

    const shouldReinitialize = (
      previousSelectedAccountIdRef.current === undefined ||
      previousAccountTypeRef.current === undefined ||
      currentAccountId !== previousSelectedAccountIdRef.current ||
      currentAccountType !== previousAccountTypeRef.current
    );

    if (!shouldReinitialize) {
      return;
    }

    previousSelectedAccountIdRef.current = currentAccountId;
    previousAccountTypeRef.current = currentAccountType;

    const initializeFormData = () => {
      console.log('=== EFFECT: Syncing form data with account ===');
      console.log('selectedAccount:', selectedAccount);
      console.log('accountType:', accountType);

      const pendingDraft = readPendingProfileDraft();
      console.log('[UserAccountPanel] Restored draft from localStorage:', {
        hasDraft: !!pendingDraft,
        accountType: pendingDraft?.accountType,
        draftEmail: pendingDraft?.modalEmail,
        otpVerified: pendingDraft?.otpVerified,
      });

      const draftForAccountType = pendingDraft?.accountType === accountType ? pendingDraft : null;
      const initialProfile = getInitialProfileData(accountToUse, loginUser);

      const getDraftProfileData = () => {
        if (!draftForAccountType) return {};
        if (draftForAccountType.profileData && typeof draftForAccountType.profileData === 'object') {
          return draftForAccountType.profileData;
        }
        if (draftForAccountType.formData && typeof draftForAccountType.formData === 'object') {
          return draftForAccountType.formData;
        }
        return Object.keys(initialProfile).reduce((acc, key) => {
          if (draftForAccountType[key] !== undefined) {
            acc[key] = draftForAccountType[key];
          }
          return acc;
        }, {});
      };

      const restoredProfileData = {
        ...initialProfile,
        ...getDraftProfileData(),
      };

      setProfileData(restoredProfileData);
      setFormData(restoredProfileData);
      setMediaFiles(normalizeMediaFiles(
        draftForAccountType?.profileData?.mediaFiles ||
        draftForAccountType?.formData?.mediaFiles ||
        draftForAccountType?.mediaFiles ||
        restoredProfileData.mediaFiles ||
        []
      ));
      setFilledFields(new Set());

      const initialColor = getAvatarColor(restoredProfileData.name, restoredProfileData.email);
      setCachedAvatarColor(initialColor);

      if (draftForAccountType?.currentStep) {
        setCurrentStep(draftForAccountType.currentStep);
      }
      if (draftForAccountType?.viewMode) {
        setViewMode(draftForAccountType.viewMode);
      }
      if (typeof draftForAccountType?.isEditingProfile === 'boolean') {
        setIsEditingProfile(draftForAccountType.isEditingProfile);
      }
      if (draftForAccountType?.showOtpModal || (draftForAccountType?.otpSent && !draftForAccountType?.otpVerified)) {
        console.log('[UserAccountPanel] Restoring OTP modal open state from draft');
        setShowOtpModal(true);
      }
      if (draftForAccountType?.otpVerified) {
        console.log('[UserAccountPanel] Restoring OTP verified state from draft');
        setOtpVerified(draftForAccountType.otpVerified);
      }
      if (draftForAccountType?.otpCode) {
        setOtpCode(draftForAccountType.otpCode);
      }
      if (draftForAccountType?.otpSent) {
        setOtpSent(draftForAccountType.otpSent);
      }
      if (typeof draftForAccountType?.resendCountdown === 'number') {
        setResendCountdown(draftForAccountType.resendCountdown);
      }
      if (draftForAccountType?.modalEmail) {
        setModalEmail(draftForAccountType.modalEmail);
      }
      if (draftForAccountType?.selectedCountryCode) {
        setSelectedCountryCode(draftForAccountType.selectedCountryCode);
      }
      if (draftForAccountType?.selectedCountryInfo) {
        setSelectedCountryInfo(draftForAccountType.selectedCountryInfo);
      }
      if (draftForAccountType?.phoneNumberValue) {
        setPhoneNumberValue(draftForAccountType.phoneNumberValue);
      }
      if (draftForAccountType?.whatsappLocalNumber) {
        setWhatsappLocalNumber(draftForAccountType.whatsappLocalNumber);
      }
      if (draftForAccountType?.githubHandle) {
        setGithubHandle(draftForAccountType.githubHandle);
      }
      if (draftForAccountType?.twitterHandle) {
        setTwitterHandle(draftForAccountType.twitterHandle);
      }
      if (draftForAccountType?.instagramHandle) {
        setInstagramHandle(draftForAccountType.instagramHandle);
      }
      if (draftForAccountType?.linkedinHandle) {
        setLinkedinHandle(draftForAccountType.linkedinHandle);
      }

      if (accountType === 'employee') {
        console.log('ENTERING EDIT MODE FOR EMPLOYEE');
        setIsEditingProfile(true);
        setCurrentStep((prev) => draftForAccountType?.currentStep || prev || 1);
        setViewMode(draftForAccountType?.viewMode || 'steps');
      } else {
        setIsEditingProfile(false);
      }
    };

    initializeFormData();
  }, [accountType, accountToUse, loginUser, selectedAccount]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Disable auto-verification: OTP must be explicitly verified by clicking the Verify button.
  useEffect(() => {
    if (!showOtpModal || !otpCode || otpCode.length !== 6 || isCheckingOTP || otpVerified || !modalEmail) {
      return;
    }

    otpInputTouchedRef.current = false;
  }, [showOtpModal, otpCode, isCheckingOTP, otpVerified, modalEmail]);

  useEffect(() => {
    const hasAnyFormValue = Object.values(formData || {}).some((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return value != null;
    });

    const draft = {
      accountType,
      profileData: formData,
      mediaFiles,
      currentStep,
      viewMode,
      isEditingProfile,
      showOtpModal,
      modalEmail,
      otpCode,
      otpSent,
      otpVerified,
      resendCountdown,
      selectedCountryCode,
      selectedCountryInfo,
      phoneNumberValue,
      whatsappLocalNumber,
      githubHandle,
      twitterHandle,
      instagramHandle,
      linkedinHandle,
      timestamp: Date.now(),
    };

    const shouldSaveDraft = showOtpModal || currentStep > 1 || hasAnyFormValue || mediaFiles.length > 0 || otpVerified || modalEmail;
    if (shouldSaveDraft) {
      console.log('[UserAccountPanel] Saving draft to localStorage:', {
        accountType,
        currentStep,
        hasAnyFormValue,
        modalEmail,
        otpSent,
        otpVerified,
        otpCodeLength: otpCode?.length || 0,
        resendCountdown,
        selectedCountryCode,
        selectedCountryInfo,
      });
      localStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify(draft));
    }
  }, [accountType, currentStep, formData, isEditingProfile, mediaFiles, modalEmail, showOtpModal, viewMode, otpCode, otpSent, otpVerified, resendCountdown, selectedCountryCode, selectedCountryInfo, phoneNumberValue, whatsappLocalNumber, githubHandle, twitterHandle, instagramHandle, linkedinHandle]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const digitsOnly = getDigitsOnly(value);
      setPhoneNumberValue(digitsOnly);
      setWhatsappLocalNumber(digitsOnly);
      setFormData(prev => ({
        ...prev,
        phone: digitsOnly,
        whatsapp: buildWhatsappUrl(selectedCountryCode, digitsOnly)
      }));
      return;
    }

    const sanitizedValue = value;
    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));
  };

  const getCountryDialCode = (country) => {
    if (!country) return null;
    const normalizedCountry = country.trim();
    const countryEntry = [
      { country: 'Kenya', code: '+254' },
      { country: 'Uganda', code: '+256' },
      { country: 'Tanzania', code: '+255' },
      { country: 'South Africa', code: '+27' },
      { country: 'Nigeria', code: '+234' },
      { country: 'United States', code: '+1' },
      { country: 'United Kingdom', code: '+44' },
      { country: 'India', code: '+91' },
      { country: 'Canada', code: '+1' },
      { country: 'Australia', code: '+61' },
      { country: 'Germany', code: '+49' },
      { country: 'France', code: '+33' },
      { country: 'Japan', code: '+81' },
      { country: 'Egypt', code: '+20' },
      { country: 'Ghana', code: '+233' },
      { country: 'United Arab Emirates', code: '+971' },
      { country: 'Saudi Arabia', code: '+966' },
      { country: 'Kenya', code: '+254' },
      { country: 'Ethiopia', code: '+251' },
      { country: 'Morocco', code: '+212' },
      { country: 'Uganda', code: '+256' },
      { country: 'Rwanda', code: '+250' },
      { country: 'Tanzania', code: '+255' },
      { country: 'Sudan', code: '+249' },
      { country: 'Mozambique', code: '+258' },
      { country: 'Malawi', code: '+265' }
    ].find(item => item.country === normalizedCountry);
    return countryEntry ? countryEntry.code : null;
  };

  const syncCountryCodeFromLocation = (country) => {
    const code = getCountryDialCode(country);
    if (!code) return;

    const flag = country === 'Kenya' ? '🇰🇪 Kenya'
      : country === 'Uganda' ? '🇺🇬 Uganda'
      : country === 'Tanzania' ? '🇹🇿 Tanzania'
      : country === 'South Africa' ? '🇿🇦 South Africa'
      : country === 'Nigeria' ? '🇳🇬 Nigeria'
      : country === 'United States' ? '🇺🇸 United States'
      : country === 'United Kingdom' ? '🇬🇧 United Kingdom'
      : country === 'India' ? '🇮🇳 India'
      : country === 'Canada' ? '🇨🇦 Canada'
      : country === 'Australia' ? '🇦🇺 Australia'
      : country === 'Germany' ? '🇩🇪 Germany'
      : country === 'France' ? '🇫🇷 France'
      : country === 'Japan' ? '🇯🇵 Japan'
      : country === 'Egypt' ? '🇪🇬 Egypt'
      : country === 'Ghana' ? '🇬🇭 Ghana'
      : country === 'United Arab Emirates' ? '🇦🇪 United Arab Emirates'
      : country === 'Saudi Arabia' ? '🇸🇦 Saudi Arabia'
      : country === 'Ethiopia' ? '🇪🇹 Ethiopia'
      : country === 'Morocco' ? '🇲🇦 Morocco'
      : country === 'Rwanda' ? '🇷🇼 Rwanda'
      : country === 'Sudan' ? '🇸🇩 Sudan'
      : country === 'Mozambique' ? '🇲🇿 Mozambique'
      : country === 'Malawi' ? '🇲🇼 Malawi'
      : `${selectedCountryInfo}`;

    if (code !== selectedCountryCode) {
      setSelectedCountryCode(code);
      setSelectedCountryInfo(flag);
      setFormData(prev => ({
        ...prev,
        whatsapp: buildWhatsappUrl(code, phoneNumberValue || getDigitsOnly(prev.phone || ''))
      }));
    }
  };

  const handlePhoneKeyDown = (e) => {
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowedKeys.includes(e.key) || /^\d$/.test(e.key)) {
      return;
    }
    e.preventDefault();
  };

  const handleEmailChange = (e) => {
    const value = e.target.value.trim();
    
    // Just store what user typed
    setFormData(prev => ({
      ...prev,
      email: value
    }));
    
    // Show suggestion if no @ domain is present
    if (value && !value.includes('@')) {
      setEmailSuggestion(value + '@gmail.com');
    } else {
      setEmailSuggestion('');
    }
  };

  const handleEmailKeyDown = (e) => {
    const value = e.target.value.trim();
    
    // Accept suggestion with Tab key
    if (e.key === 'Tab' && value && !value.includes('@')) {
      e.preventDefault();
      setFormData(prev => ({
        ...prev,
        email: value + '@gmail.com'
      }));
      setEmailSuggestion('');
      // Move focus to next element
      e.target.form?.elements[Array.from(e.target.form.elements).indexOf(e.target) + 1]?.focus();
      return;
    }
  };

  const handleEmailBlur = (e) => {
    let value = e.target.value.trim();
    
    // Auto-append @gmail.com if no @ domain is present when user leaves field
    if (value && !value.includes('@')) {
      value = value + '@gmail.com';
      setFormData(prev => ({
        ...prev,
        email: value
      }));
    }
    
    // Hide suggestion when leaving field
    setEmailSuggestion('');
    handleFieldBlur('email');
  };

  // Verify OTP entered by user
  const handleFieldFocus = (fieldName) => {
    setFocusedField(fieldName);
  };

  const hasFieldValue = (value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return value !== null && value !== undefined && value !== '';
  };

  useEffect(() => {
    const nextFilledFields = new Set();
    const trackedFields = [
      'name', 'title', 'email', 'phone', 'bio', 'skills', 'certifications', 'location',
      'experience', 'hourlyRate', 'availability', 'projectTypes', 'workStyle', 'timezone',
      'portfolioWebsite', 'twitter', 'github', 'linkedin', 'instagram', 'facebook', 'tiktok',
      'whatsapp', 'dateOfBirth'
    ];

    trackedFields.forEach((fieldName) => {
      if (hasFieldValue(formData[fieldName])) {
        nextFilledFields.add(fieldName);
      }
    });

    if (hasFieldValue(formData.languages)) {
      nextFilledFields.add('languages');
    }

    setFilledFields(prev => {
      const prevArray = Array.from(prev).sort();
      const nextArray = Array.from(nextFilledFields).sort();
      const isSame = prevArray.length === nextArray.length && prevArray.every((field, index) => field === nextArray[index]);
      return isSame ? prev : nextFilledFields;
    });
  }, [formData]);

  const handleFieldBlur = (fieldName) => {
    const value = formData[fieldName];
    // If field has content, mark it as filled
    if (hasFieldValue(value)) {
      setFilledFields(prev => new Set(prev).add(fieldName));
    }
    setFocusedField(null);
  };

  const getFieldInputClass = (fieldName) => {
    let classes = '';
    if (focusedField === fieldName) {
      classes += 'field-focused ';
    }
    if (filledFields.has(fieldName)) {
      classes += 'field-filled';
    }
    // Don't add field-invalid class here - we handle email validation inline now
    return classes.trim();
  };

  const handleLanguagesChange = (languages) => {
    setFormData(prev => ({
      ...prev,
      languages: languages
    }));
    if (Array.isArray(languages) && languages.length > 0) {
      setFilledFields(prev => new Set(prev).add('languages'));
    } else {
      setFilledFields(prev => {
        const next = new Set(prev);
        next.delete('languages');
        return next;
      });
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploaderId = loginUser?.id || selectedAccount?.id || formData?.id || null;
      const { publicUrl, path } = await uploadAvatarToSupabase(file, uploaderId);

      localStorage.setItem('userAvatar', publicUrl);
      setAvatarState(publicUrl);
      setFormData(prev => ({
        ...prev,
        avatar: publicUrl,
        avatarPath: path
      }));
      setProfileData(prev => ({
        ...prev,
        avatar: publicUrl,
        avatarPath: path
      }));
    } catch (error) {
      console.error('Avatar upload failed:', error);
      alert(error.message || 'Failed to upload avatar.');
    }
  };

  const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file preview.'));
    reader.readAsDataURL(file);
  });

  const revokePreviewUrl = (preview) => {
    if (typeof preview === 'string' && preview.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(preview);
      } catch (e) {}
    }
  };

  const createVideoThumbnail = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      URL.revokeObjectURL(url);
      video.src = '';
    };

    const handleError = (err) => {
      cleanup();
      reject(err || new Error('Unable to generate video thumbnail.'));
    };

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.src = url;

    const capture = () => {
      try {
        const canvas = document.createElement('canvas');
        const width = video.videoWidth || 320;
        const height = video.videoHeight || Math.round(width * 0.56);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        cleanup();
        resolve(dataUrl);
      } catch (error) {
        handleError(error);
      }
    };

    video.addEventListener('loadeddata', capture, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const uploaderId = loginUser?.id || selectedAccount?.id || formData?.id || `temp-${Date.now()}`;
    let failedUploads = 0;

    console.log('🎬 Starting media upload for', files.length, 'files, uploaderId:', uploaderId);

    const pendingUploads = files.map(async (file) => {
      const tempId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tempMediaFile = normalizeMediaFile({
        id: tempId,
        name: file.name,
        type: file.type,
        uploading: true,
        preview: null,
        url: null,
        publicUrl: null,
        path: null
      }, 0);

      setMediaFiles(prev => [...prev, tempMediaFile]);

      try {
        console.log('⏳ Processing file:', file.name);

        const previewPromise = file.type.startsWith('image/')
          ? readFileAsDataURL(file).catch(() => null)
          : file.type.startsWith('video/')
            ? Promise.resolve(URL.createObjectURL(file))
            : Promise.resolve(null);

        const uploadPromise = uploadMediaFileToSupabase(file, uploaderId);
        const [preview, uploadResult] = await Promise.all([previewPromise, uploadPromise]);
        const { publicUrl, path } = uploadResult;

        setMediaFiles(prev => prev.map((item) => {
          if (getMediaFileKey(item) !== tempId) return item;
          if (typeof item.preview === 'string' && item.preview.startsWith('blob:')) {
            revokePreviewUrl(item.preview);
          }
          return normalizeMediaFile({
            ...item,
            path,
            publicUrl,
            preview: file.type.startsWith('video/') ? null : preview,
            url: publicUrl,
            uploading: false,
            uploadError: false
          }, 0);
        }));

        console.log('✓ File uploaded:', file.name);
      } catch (uploadError) {
        failedUploads++;
        console.error('✗ Media upload failed for', file.name, ':', uploadError);
        setMediaFiles(prev => prev.map((item) => {
          if (getMediaFileKey(item) !== tempId) return item;
          return normalizeMediaFile({
            ...item,
            uploading: false,
            uploadError: true
          }, 0);
        }));
        alert(`Failed to upload ${file.name}: ${uploadError.message || 'Unknown error'}`);
      }
    });

    await Promise.allSettled(pendingUploads);

    if (failedUploads > 0) {
      console.warn(`⚠️ ${failedUploads} of ${files.length} files failed to upload`);
    }

    if (e?.target) {
      e.target.value = '';
    }
  };

  const removeMediaFile = async (id) => {
    const fileToRemove = mediaFiles.find((file) => getMediaFileKey(file) === id);

    const performLocalRemoval = () => {
      setMediaFiles((prev) => {
        const newMediaFiles = prev.filter((file) => getMediaFileKey(file) !== id);

        setMediaPreviewId((currentId) => {
          if (!currentId || currentId !== id) {
            return currentId;
          }

          if (newMediaFiles.length === 0) {
            return null;
          }

          const deletedIndex = prev.findIndex((file) => getMediaFileKey(file) === id);
          const nextIndex = Math.min(Math.max(deletedIndex, 0), newMediaFiles.length - 1);
          return getMediaFileKey(newMediaFiles[nextIndex]);
        });

        return newMediaFiles;
      });
    };

    if (fileToRemove && (fileToRemove.path || fileToRemove.id) && onDeleteMedia && typeof onDeleteMedia === 'function') {
      try {
        const success = await onDeleteMedia(fileToRemove.path || fileToRemove.id);
        if (success) {
          performLocalRemoval();
        }
      } catch (err) {
        console.warn('[removeMediaFile] Delete failed:', err);
      }
    } else {
      performLocalRemoval();
    }
  };

  const moveMediaFile = (index, direction) => {
    setMediaFiles(prev => {
      const next = [...prev];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= next.length) {
        return prev;
      }
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  const handleSaveProfile = async () => {
    // Validate required fields before asking for OTP.
    if (!formData.name || !formData.name.trim()) {
      alert('Please fill in Full Name');
      return;
    }
    if (!formData.title || !formData.title.trim()) {
      alert('Please fill in Professional Title');
      return;
    }
    if (!formData.email || !formData.email.trim()) {
      alert('Please fill in Email');
      return;
    }
    if (!formData.phone || !formData.phone.trim()) {
      alert('Please fill in Phone');
      return;
    }
    if (!Array.isArray(mediaFiles) || mediaFiles.length === 0) {
      alert('Please upload at least one media file');
      return;
    }

    // Always require the OTP verification modal to display before profile creation.
    console.log('🔍 Opening OTP verification modal');
    setOtpCode('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpError('');
    setModalEmailError('');
    setModalEmail(formData.email || '');
    setShowOtpModal(true);
  };

  // Send OTP to email in modal
  const handleSendModalOTP = async () => {
    if (!modalEmail) {
      setModalEmailError('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(modalEmail)) {
      setModalEmailError('Invalid email format');
      return;
    }

    if (!modalEmail.toLowerCase().endsWith('@gmail.com')) {
      setModalEmailError('Only Gmail addresses are allowed');
      return;
    }

    setIsCheckingOTP(true);
    setModalEmailError('');
    setOtpError('');
    setOtpCode(''); // Clear previously entered OTP
    setResendCountdown(0); // Reset countdown so button is active

    try {
      const response = await fetch(`${API_URL}/api/auth/send-verification-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: modalEmail })
      });

      const data = await response.json();

      if (data.success) {
        setOtpSent(true);
        setResendCountdown(60); // Start 60 second countdown (faster than 90)
        setModalEmailError('');
        console.log('✅ OTP sent successfully');
        if (data.code) {
          console.log(`🔐 OTP Code (dev mode): ${data.code}`);
        }
      } else {
        setModalEmailError(data.message || 'Failed to send OTP');
        setOtpSent(false);
      }
    } catch (error) {
      console.log('OTP request error:', error);
      setModalEmailError('Failed to send OTP. Check your connection.');
      setOtpSent(false);
    }

    setIsCheckingOTP(false);
  };

  const handleCancel = () => {
    localStorage.removeItem(PENDING_DRAFT_KEY);
    onClose();
  };

  // Close OTP modal WITHOUT clearing form data - user can go back and edit form
  const handleCloseOTPModal = () => {
    console.log('📋 Closing OTP modal, keeping form data');
    setShowOtpModal(false);
    setOtpCode('');
    setOtpError('');
    setModalEmailError('');
    // DO NOT reset formData or other form state - user can continue editing
  };

  const handleNextStep = () => {
    // On step 1, only check email format - don't require OTP verification to proceed
    if (currentStep === 1 && formData.email) {
      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setEmailErrorShaking(true);
        setTimeout(() => setEmailErrorShaking(false), 600);
        return;
      }

      // Check if it's a Gmail address
      if (!formData.email.toLowerCase().endsWith('@gmail.com')) {
        setEmailErrorShaking(true);
        setTimeout(() => setEmailErrorShaking(false), 600);
        return;
      }
    }
    
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const renderCountryCodeModal = () => (
    <div className="work-sel-modal-overlay" onClick={() => setShowPhoneCountryModal(false)}>
      <div className="work-sel-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="work-sel-modal-header">
          <h3>Select Country Code</h3>
          <button
            className="work-sel-modal-close"
            onClick={() => setShowPhoneCountryModal(false)}
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="work-sel-modal-content">
          {[
            { code: '+254', country: '🇰🇪 Kenya', featured: true },
            { code: '+93', country: '🇦🇫 Afghanistan' },
            { code: '+355', country: '🇦🇱 Albania' },
            { code: '+213', country: '🇩🇿 Algeria' },
            { code: '+376', country: '🇦🇩 Andorra' },
            { code: '+244', country: '🇦🇴 Angola' },
            { code: '+297', country: '🇦🇼 Aruba' },
            { code: '+43', country: '🇦🇹 Austria' },
            { code: '+994', country: '🇦🇿 Azerbaijan' },
            { code: '+973', country: '🇧🇭 Bahrain' },
            { code: '+880', country: '🇧🇩 Bangladesh' },
            { code: '+375', country: '🇧🇾 Belarus' },
            { code: '+32', country: '🇧🇪 Belgium' },
            { code: '+501', country: '🇧🇿 Belize' },
            { code: '+229', country: '🇧🇯 Benin' },
            { code: '+975', country: '🇧🇹 Bhutan' },
            { code: '+591', country: '🇧🇴 Bolivia' },
            { code: '+387', country: '🇧🇦 Bosnia and Herzegovina' },
            { code: '+267', country: '🇧🇼 Botswana' },
            { code: '+55', country: '🇧🇷 Brazil' },
            { code: '+673', country: '🇧🇳 Brunei' },
            { code: '+359', country: '🇧🇬 Bulgaria' },
            { code: '+226', country: '🇧🇫 Burkina Faso' },
            { code: '+257', country: '🇧🇮 Burundi' },
            { code: '+855', country: '🇰🇭 Cambodia' },
            { code: '+237', country: '🇨🇲 Cameroon' },
            { code: '+1', country: '🇨🇦 Canada' },
            { code: '+238', country: '🇨🇻 Cape Verde' },
            { code: '+599', country: '🇧🇶 Caribbean Netherlands' },
            { code: '+236', country: '🇨🇫 Central African Republic' },
            { code: '+235', country: '🇹🇩 Chad' },
            { code: '+56', country: '🇨🇱 Chile' },
            { code: '+86', country: '🇨🇳 China' },
            { code: '+682', country: '🇨🇰 Cook Islands' },
            { code: '+57', country: '🇨🇴 Colombia' },
            { code: '+242', country: '🇨🇬 Republic of the Congo' },
            { code: '+243', country: '🇨🇩 Democratic Republic of the Congo' },
            { code: '+506', country: '🇨🇷 Costa Rica' },
            { code: '+385', country: '🇭🇷 Croatia' },
            { code: '+53', country: '🇨🇺 Cuba' },
            { code: '+357', country: '🇨🇾 Cyprus' },
            { code: '+420', country: '🇨🇿 Czechia' },
            { code: '+45', country: '🇩🇰 Denmark' },
            { code: '+246', country: '🇩🇬 Diego Garcia' },
            { code: '+253', country: '🇩🇯 Djibouti' },
            { code: '+593', country: '🇪🇨 Ecuador' },
            { code: '+20', country: '🇪🇬 Egypt' },
            { code: '+503', country: '🇸🇻 El Salvador' },
            { code: '+372', country: '🇪🇪 Estonia' },
            { code: '+251', country: '🇪🇹 Ethiopia' },
            { code: '+291', country: '🇪🇷 Eritrea' },
            { code: '+268', country: '🇸🇿 Eswatini' },
            { code: '+500', country: '🇫🇰 Falkland Islands' },
            { code: '+298', country: '🇫🇴 Faroe Islands' },
            { code: '+679', country: '🇫🇯 Fiji' },
            { code: '+358', country: '🇫🇮 Finland' },
            { code: '+33', country: '🇫🇷 France' },
            { code: '+594', country: '🇬🇫 French Guiana' },
            { code: '+689', country: '🇵🇫 French Polynesia' },
            { code: '+241', country: '🇬🇦 Gabon' },
            { code: '+220', country: '🇬🇲 Gambia' },
            { code: '+995', country: '🇬🇪 Georgia' },
            { code: '+49', country: '🇩🇪 Germany' },
            { code: '+233', country: '🇬🇭 Ghana' },
            { code: '+350', country: '🇬🇮 Gibraltar' },
            { code: '+30', country: '🇬🇷 Greece' },
            { code: '+299', country: '🇬🇱 Greenland' },
            { code: '+590', country: '🇬🇵 Guadeloupe' },
            { code: '+502', country: '🇬🇹 Guatemala' },
            { code: '+224', country: '🇬🇳 Guinea' },
            { code: '+245', country: '🇬🇼 Guinea-Bissau' },
            { code: '+592', country: '🇬🇾 Guyana' },
            { code: '+509', country: '🇭🇹 Haiti' },
            { code: '+504', country: '🇭🇳 Honduras' },
            { code: '+852', country: '🇭🇰 Hong Kong' },
            { code: '+36', country: '🇭🇺 Hungary' },
            { code: '+354', country: '🇮🇸 Iceland' },
            { code: '+91', country: '🇮🇳 India' },
            { code: '+62', country: '🇮🇩 Indonesia' },
            { code: '+98', country: '🇮🇷 Iran' },
            { code: '+964', country: '🇮🇶 Iraq' },
            { code: '+353', country: '🇮🇪 Ireland' },
            { code: '+972', country: '🇮🇱 Israel' },
            { code: '+39', country: '🇮🇹 Italy' },
            { code: '+225', country: '🇨🇮 Ivory Coast' },
            { code: '+81', country: '🇯🇵 Japan' },
            { code: '+962', country: '🇯🇴 Jordan' },
            { code: '+7', country: '🇰🇿 Kazakhstan' },
            { code: '+686', country: '🇰🇮 Kiribati' },
            { code: '+383', country: '🇽🇰 Kosovo' },
            { code: '+965', country: '🇰🇼 Kuwait' },
            { code: '+996', country: '🇰🇬 Kyrgyzstan' },
            { code: '+856', country: '🇱🇦 Laos' },
            { code: '+371', country: '🇱🇻 Latvia' },
            { code: '+961', country: '🇱🇧 Lebanon' },
            { code: '+266', country: '🇱🇸 Lesotho' },
            { code: '+231', country: '🇱🇷 Liberia' },
            { code: '+218', country: '🇱🇾 Libya' },
            { code: '+423', country: '🇱🇮 Liechtenstein' },
            { code: '+370', country: '🇱🇹 Lithuania' },
            { code: '+352', country: '🇱🇺 Luxembourg' },
            { code: '+853', country: '🇲🇴 Macau' },
            { code: '+389', country: '🇲🇰 North Macedonia' },
            { code: '+261', country: '🇲🇬 Madagascar' },
            { code: '+265', country: '🇲🇼 Malawi' },
            { code: '+60', country: '🇲🇾 Malaysia' },
            { code: '+960', country: '🇲🇻 Maldives' },
            { code: '+223', country: '🇲🇱 Mali' },
            { code: '+356', country: '🇲🇹 Malta' },
            { code: '+692', country: '🇲🇭 Marshall Islands' },
            { code: '+596', country: '🇲🇶 Martinique' },
            { code: '+222', country: '🇲🇷 Mauritania' },
            { code: '+230', country: '🇲🇺 Mauritius' },
            { code: '+52', country: '🇲🇽 Mexico' },
            { code: '+691', country: '🇫🇲 Micronesia' },
            { code: '+373', country: '🇲🇩 Moldova' },
            { code: '+377', country: '🇲🇨 Monaco' },
            { code: '+976', country: '🇲🇳 Mongolia' },
            { code: '+382', country: '🇲🇪 Montenegro' },
            { code: '+212', country: '🇲🇦 Morocco' },
            { code: '+258', country: '🇲🇿 Mozambique' },
            { code: '+95', country: '🇲🇲 Myanmar' },
            { code: '+264', country: '🇳🇦 Namibia' },
            { code: '+674', country: '🇳🇷 Nauru' },
            { code: '+977', country: '🇳🇵 Nepal' },
            { code: '+31', country: '🇳🇱 Netherlands' },
            { code: '+687', country: '🇳🇨 New Caledonia' },
            { code: '+64', country: '🇳🇿 New Zealand' },
            { code: '+505', country: '🇳🇮 Nicaragua' },
            { code: '+227', country: '🇳🇪 Niger' },
            { code: '+234', country: '🇳🇬 Nigeria' },
            { code: '+683', country: '🇳🇺 Niue' },
            { code: '+850', country: '🇰🇵 North Korea' },
            { code: '+47', country: '🇳🇴 Norway' },
            { code: '+968', country: '🇴🇲 Oman' },
            { code: '+92', country: '🇵🇰 Pakistan' },
            { code: '+680', country: '🇵🇼 Palau' },
            { code: '+970', country: '🇵🇸 Palestine' },
            { code: '+507', country: '🇵🇦 Panama' },
            { code: '+675', country: '🇵🇬 Papua New Guinea' },
            { code: '+595', country: '🇵🇾 Paraguay' },
            { code: '+51', country: '🇵🇪 Peru' },
            { code: '+63', country: '🇵🇭 Philippines' },
            { code: '+48', country: '🇵🇱 Poland' },
            { code: '+351', country: '🇵🇹 Portugal' },
            { code: '+974', country: '🇶🇦 Qatar' },
            { code: '+262', country: '🇷🇪 Réunion' },
            { code: '+40', country: '🇷🇴 Romania' },
            { code: '+7', country: '🇷🇺 Russia' },
            { code: '+250', country: '🇷🇼 Rwanda' },
            { code: '+508', country: '🇵🇲 Saint Pierre and Miquelon' },
            { code: '+378', country: '🇸🇲 San Marino' },
            { code: '+239', country: '🇸🇹 São Tomé and Príncipe' },
            { code: '+966', country: '🇸🇦 Saudi Arabia' },
            { code: '+221', country: '🇸🇳 Senegal' },
            { code: '+381', country: '🇷🇸 Serbia' },
            { code: '+248', country: '🇸🇨 Seychelles' },
            { code: '+232', country: '🇸🇱 Sierra Leone' },
            { code: '+65', country: '🇸🇬 Singapore' },
            { code: '+421', country: '🇸🇰 Slovakia' },
            { code: '+386', country: '🇸🇮 Slovenia' },
            { code: '+677', country: '🇸🇧 Solomon Islands' },
            { code: '+252', country: '🇸🇴 Somalia' },
            { code: '+27', country: '🇿🇦 South Africa' },
            { code: '+82', country: '🇰🇷 South Korea' },
            { code: '+34', country: '🇪🇸 Spain' },
            { code: '+94', country: '🇱🇰 Sri Lanka' },
            { code: '+249', country: '🇸🇩 Sudan' },
            { code: '+597', country: '🇸🇷 Suriname' },
            { code: '+46', country: '🇸🇪 Sweden' },
            { code: '+41', country: '🇨🇭 Switzerland' },
            { code: '+963', country: '🇸🇾 Syria' },
            { code: '+886', country: '🇹🇼 Taiwan' },
            { code: '+992', country: '🇹🇯 Tajikistan' },
            { code: '+255', country: '🇹🇿 Tanzania' },
            { code: '+66', country: '🇹🇭 Thailand' },
            { code: '+670', country: '🇹🇱 Timor-Leste' },
            { code: '+228', country: '🇹🇬 Togo' },
            { code: '+690', country: '🇹🇰 Tokelau' },
            { code: '+676', country: '🇹🇴 Tonga' },
            { code: '+216', country: '🇹🇳 Tunisia' },
            { code: '+90', country: '🇹🇷 Turkey' },
            { code: '+993', country: '🇹🇲 Turkmenistan' },
            { code: '+688', country: '🇹🇻 Tuvalu' },
            { code: '+256', country: '🇺🇬 Uganda' },
            { code: '+380', country: '🇺🇦 Ukraine' },
            { code: '+971', country: '🇦🇪 United Arab Emirates' },
            { code: '+44', country: '🇬🇧 United Kingdom' },
            { code: '+1', country: '🇺🇸 United States' },
            { code: '+598', country: '🇺🇾 Uruguay' },
            { code: '+998', country: '🇺🇿 Uzbekistan' },
            { code: '+678', country: '🇻🇺 Vanuatu' },
            { code: '+379', country: '🇻🇦 Vatican City' },
            { code: '+58', country: '🇻🇪 Venezuela' },
            { code: '+84', country: '🇻🇳 Vietnam' },
            { code: '+681', country: '🇼🇫 Wallis and Futuna' },
            { code: '+967', country: '🇾🇪 Yemen' },
            { code: '+260', country: '🇿🇲 Zambia' },
            { code: '+263', country: '🇿🇼 Zimbabwe' },
          ].map(({ code, country, featured }) => (
            <button
              key={code}
              type="button"
              className={`work-sel-modal-option ${selectedCountryCode === code ? 'active' : ''} ${featured ? 'featured' : ''}`}
              onClick={() => {
                setSelectedCountryCode(code);
                setSelectedCountryInfo(country);
                setShowPhoneCountryModal(false);
                const syncedNumber = getSharedContactNumber(phoneNumberValue, formData.whatsapp, code);
                const nextNumber = syncedNumber || phoneNumberValue || getDigitsOnly(formData.phone);
                if (nextNumber) {
                  setPhoneNumberValue(nextNumber);
                  setWhatsappLocalNumber(nextNumber);
                  setFormData(prev => ({
                    ...prev,
                    phone: nextNumber,
                    whatsapp: buildWhatsappUrl(code, nextNumber)
                  }));
                }
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
  );

  return (
    <>
      {/* Success Message Toast - Outside Panel Container */}
      {showSuccessMessage && (
        <div className={`success-message-popup ${isClosingMessage ? 'closing' : ''}`}>
          <div className="success-icon">✓</div>
          <div className="success-message-text">
            <div className="success-title">{isEditMode ? 'Profile Updated' : 'Profile Created'}</div>
            <div className="success-subtitle">Successfully</div>
          </div>
        </div>
      )}
      
      <div className="account-panel-wrapper">
        <div className="account-panel">
  
        {accountType === 'employer' && <EmployerAccountPanel onClose={onClose} onBack={() => setAccountType(null)} />}
        
        {accountType === 'employee' && (
          <>
          
            {showPhoneCountryModal && renderCountryCodeModal()}

            <div className="edit-profile-header">
              <div className="edit-profile-title-section">
                <div className="edit-profile-title-wrapper">
                  <h2>{isEditMode ? 'Edit Profile' : 'Create Your Profile'}</h2>
                  <p className="profession-tag">(Skills ~ {professionName})</p>
                </div>
                <div className="view-mode-toggle">
                  <button 
                    className={`view-toggle-btn ${viewMode === 'steps' ? 'active' : ''}`}
                    onClick={() => {
                      setViewMode('steps');
                      setIsEditingProfile(true);
                    }}
                  >
                    Steps
                  </button>
                  <button 
                    className={`view-toggle-btn ${viewMode === 'full' ? 'active' : ''}`}
                    onClick={() => {
                      setViewMode('full');
                      setIsEditingProfile(false);
                    }}
                  >
                    Full View
                  </button>
                </div>
              </div>
            </div>

            {/* Progress Bar - Only for Steps View */}
            {viewMode === 'steps' && (
              <div className={`progress-bar-container ${currentStep === 1 ? 'step-one' : ''}`}>
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-fill" style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}></div>
                </div>
                <div className="progress-percentage">{Math.round((currentStep / TOTAL_STEPS) * 100)}%</div>
                <div className="step-indicators">
                  {[1, 2, 3, 4, 5].map(step => (
                    <div 
                      key={step} 
                      className={`step-indicator ${step <= currentStep ? 'completed' : ''} ${step === currentStep ? 'active' : ''}`}
                      onClick={() => setCurrentStep(step)}
                    >
                      {step < currentStep ? '✓' : step}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form Content - Steps View */}
            {viewMode === 'steps' && (
              <div className={`edit-form-content ${currentStep === 1 ? 'step-one' : ''}`}>
              
              {/* STEP 1: Basic Information */}
              {currentStep === 1 && (
                <div className="form-step" data-step="1">
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <input
                      ref={avatarInputRefStep1}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      style={{ display: 'none' }}
                    />
                    {formData.avatar ? (
                      <img 
                        src={formData.avatar} 
                        alt="Profile Avatar" 
                        onClick={() => avatarInputRefStep1.current?.click()}
                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                      />
                    ) : (
                      <div 
                        onClick={() => avatarInputRefStep1.current?.click()}
                        style={{
                          backgroundColor: cachedAvatarColor,
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '1.8rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          position: 'relative'
                        }}
                      >
                        <span style={{
                          position: 'relative',
                          zIndex: 1,
                          letterSpacing: '-1px'
                        }}>
                          {getInitials(formData.name || profileData.name, formData.email || profileData.email)}
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="form-section-title">Basic Information</h3>
                  
                  <div className="form-two-col">
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        onFocus={() => handleFieldFocus('name')}
                        onBlur={() => handleFieldBlur('name')}
                        className={getFieldInputClass('name')}
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Professional Title *</label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        onFocus={() => handleFieldFocus('title')}
                        onBlur={() => handleFieldBlur('title')}
                        className={getFieldInputClass('title')}
                        placeholder="e.g., Senior React Developer"
                      />
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <label>Email *</label>
                      <div style={{ fontSize: '10px', color: '#0a8545', marginBottom: '6px', fontWeight: '500' }}>
                        We'll send a verification code to this email
                      </div>
                      <div style={{ position: 'relative' }}>
                        {(() => {
                          // Check if email is invalid format
                          let hasError = false;
                          if (formData.email) {
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            hasError = !emailRegex.test(formData.email) || !formData.email.toLowerCase().endsWith('@gmail.com');
                          }

                          return (
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleEmailChange}
                              onKeyDown={handleEmailKeyDown}
                              onFocus={() => handleFieldFocus('email')}
                              onBlur={handleEmailBlur}
                              className={`${getFieldInputClass('email')} ${hasError ? 'field-invalid' : ''} ${emailErrorShaking ? 'field-error-shake' : ''}`}
                              placeholder="yourname@gmail.com"
                              style={{
                                borderColor: hasError ? '#ef4444' : undefined
                              }}
                            />
                          );
                        })()}
                        {emailSuggestion && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 12px',
                            pointerEvents: 'none',
                            fontFamily: 'inherit',
                            fontSize: 'inherit'
                          }}>
                            <span style={{
                              color: 'rgba(0, 0, 0, 0.3)',
                              marginLeft: '0px'
                            }}>
                              {emailSuggestion}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Location</label>
                      <LocationSelector 
                        value={formData.location}
                        onChange={(location) => setFormData(prev => ({ ...prev, location }))}
                        onTimezoneChange={(timezone) => setFormData(prev => ({ ...prev, timezone }))}
                        onCountryChange={(country) => syncCountryCodeFromLocation(country)}
                      />
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <label>Phone *</label>
                      <div className="phone-input-group">
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
                          onChange={handleInputChange}
                          onKeyDown={handlePhoneKeyDown}
                          onFocus={() => handleFieldFocus('phone')}
                          onBlur={() => handleFieldBlur('phone')}
                          className={`phone-input ${getFieldInputClass('phone')}`}
                          placeholder="712 345 678"
                        />
                      </div>
                    </div>
                    
                  </div>

                  <div className="form-group">
                    <label>Professional Bio</label>
                    <textarea 
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      onFocus={() => handleFieldFocus('bio')}
                      onBlur={() => handleFieldBlur('bio')}
                      className={getFieldInputClass('bio')}
                      placeholder="Tell us about yourself and your expertise..."
                      rows="3"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Professional Expertise */}
              {currentStep === 2 && (
                <div className="form-step" data-step="2">
                  <h3 className="form-section-title">Professional Expertise</h3>
                  
                  <div className="form-group">
                    <label>Skills (comma-separated)</label>
                    <textarea 
                      name="skills"
                      value={formData.skills}
                      onChange={handleInputChange}
                      onFocus={() => handleFieldFocus('skills')}
                      onBlur={() => handleFieldBlur('skills')}
                      className={getFieldInputClass('skills')}
                      placeholder="React, JavaScript, Node.js, TypeScript, PostgreSQL..."
                      rows="2"
                    />
                  </div>

                  <div className="form-group">
                    <label>Certifications & Credentials</label>
                    <textarea 
                      name="certifications"
                      value={formData.certifications}
                      onChange={handleInputChange}
                      onFocus={() => handleFieldFocus('certifications')}
                      onBlur={() => handleFieldBlur('certifications')}
                      className={getFieldInputClass('certifications')}
                      placeholder="AWS Certified, Google Cloud Certified, React Advanced..."
                      rows="2"
                    />
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <ExperienceSelector 
                        value={formData.experience}
                        onChange={(exp) => handleInputChange({target: {name: 'experience', value: exp}})}
                        placeholder="Select experience level"
                      />
                    </div>
                    <div className="form-group">
                      <LanguageSelector 
                        value={formData.languages}
                        onChange={handleLanguagesChange}
                        placeholder="Add Language"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Work Preferences */}
              {currentStep === 3 && (
                <div className="form-step" data-step="3">
                  <h3 className="form-section-title">Work Preferences</h3>
                  
                  <div className="form-two-col">
                    <div className="form-group">
                      <label>Rate</label>
                      <RateSelector 
                        value={formData.hourlyRate}
                        onChange={(value) => handleInputChange({target: {name: 'hourlyRate', value}})}
                        currency="Ksh"
                      />
                    </div>
                    <div className="form-group">
                      <AvailabilitySelector 
                        value={formData.availability}
                        onChange={(status) => handleInputChange({target: {name: 'availability', value: status}})}
                        placeholder="Select availability"
                      />
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <ProjectTypeSelector 
                        value={formData.projectTypes}
                        onChange={(type) => handleInputChange({target: {name: 'projectTypes', value: type}})}
                        placeholder="Select project type"
                      />
                    </div>
                    <div className="form-group">
                      <WorkStyleSelector 
                        value={formData.workStyle}
                        onChange={(style) => handleInputChange({target: {name: 'workStyle', value: style}})}
                        placeholder="Select work style"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Social Links */}
              {currentStep === 4 && (
                <div className="form-step" data-step="4">
                  <h3 className="form-section-title">Social Links</h3>
                  
                  <div className="form-two-col">
                    <div className="form-group">
                      <label><FaGlobe className="social-icon globe" /> Website</label>
                      <textarea
                        name="portfolioWebsite"
                        value={formData.portfolioWebsite}
                        onChange={handleInputChange}
                        onFocus={() => handleFieldFocus('portfolioWebsite')}
                        onBlur={() => handleFieldBlur('portfolioWebsite')}
                        className={getFieldInputClass('portfolioWebsite')}
                        placeholder="yourportfolio.com"
                        rows="1"
                      />
                    </div>
                    <div className="form-group">
                      <label><FaXTwitter className="social-icon twitter" /> Twitter</label>
                      <div className="input-with-prefix">
                        <input
                          type="text"
                          name="twitterHandle"
                          value={twitterHandle}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTwitterHandle(v);
                            setFormData(prev => ({ ...prev, twitter: composeSocialUrl('twitter', v) }));
                          }}
                          onFocus={() => handleFieldFocus('twitter')}
                          onBlur={() => handleFieldBlur('twitter')}
                          className={getFieldInputClass('twitter')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <label><FaGithub className="social-icon github" /> GitHub</label>
                      <div className="input-with-prefix">
                        <input
                          type="text"
                          name="githubHandle"
                          value={githubHandle}
                          onChange={(e) => {
                            const v = e.target.value;
                            setGithubHandle(v);
                            setFormData(prev => ({ ...prev, github: composeSocialUrl('github', v) }));
                          }}
                          onFocus={() => handleFieldFocus('github')}
                          onBlur={() => handleFieldBlur('github')}
                          className={getFieldInputClass('github')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label><FaLinkedin className="social-icon linkedin" /> LinkedIn</label>
                      <div className="input-with-prefix">
                        <input
                          type="text"
                          name="linkedinHandle"
                          value={linkedinHandle}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLinkedinHandle(v);
                            setFormData(prev => ({ ...prev, linkedin: composeSocialUrl('linkedin', v) }));
                          }}
                          onFocus={() => handleFieldFocus('linkedin')}
                          onBlur={() => handleFieldBlur('linkedin')}
                          className={getFieldInputClass('linkedin')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <label><FaInstagram className="social-icon instagram" /> Instagram</label>
                      <div className="input-with-prefix">
                        <input
                          type="text"
                          name="instagramHandle"
                          value={instagramHandle}
                          onChange={(e) => {
                            const v = e.target.value;
                            setInstagramHandle(v);
                            setFormData(prev => ({ ...prev, instagram: composeSocialUrl('instagram', v) }));
                          }}
                          onFocus={() => handleFieldFocus('instagram')}
                          onBlur={() => handleFieldBlur('instagram')}
                          className={getFieldInputClass('instagram')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label><FaFacebook className="social-icon facebook" /> Facebook</label>
                      <div className="input-with-prefix">
                        <input
                          type="text"
                          name="facebookHandle"
                          value={(formData.facebook && formData.facebook.startsWith('http')) ? formData.facebook.replace(/^https?:\/\//i, '') : (formData.facebook || '')}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFormData(prev => ({ ...prev, facebook: composeSocialUrl('facebook', v) }));
                          }}
                          onFocus={() => handleFieldFocus('facebook')}
                          onBlur={() => handleFieldBlur('facebook')}
                          className={getFieldInputClass('facebook')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <label><FaTiktok className="social-icon tiktok" /> TikTok</label>
                      <div className="input-with-prefix">
                        <input
                          type="text"
                          name="tiktokHandle"
                          value={formData.tiktok && formData.tiktok.startsWith('http') ? formData.tiktok : (formData.tiktok ? formData.tiktok.replace(/^https?:\/\//i, '') : '')}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFormData(prev => ({ ...prev, tiktok: composeSocialUrl('tiktok', v) }));
                          }}
                          className={getFieldInputClass('tiktok')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label><FaWhatsapp className="social-icon whatsapp" /> WhatsApp</label>
                      <div className="whatsapp-row">
                        <div className="input-with-country">
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
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="tel"
                            name="whatsappLocal"
                            value={whatsappLocalNumber}
                            onChange={(e) => {
                              const v = getDigitsOnly(e.target.value);
                              setPhoneNumberValue(v);
                              setWhatsappLocalNumber(v);
                              setFormData(prev => ({
                                ...prev,
                                phone: v,
                                whatsapp: composeSocialUrl('whatsapp', v)
                              }));
                            }}
                            onBeforeInput={(e) => {
                              if (e.data && !/^\d*$/.test(e.data)) {
                                e.preventDefault();
                              }
                            }}
                            onKeyDown={handlePhoneKeyDown}
                            onFocus={() => handleFieldFocus('whatsapp')}
                            onBlur={() => handleFieldBlur('whatsapp')}
                            className={getFieldInputClass('whatsapp')}
                            placeholder="712345678"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Design Portfolio */}
              {currentStep === 5 && (
                <div className="form-step" data-step="5">
                  <h3 className="form-section-title required">Design</h3>
                  {renderMediaUploadSection()}
                </div>
              )}

              </div>
            )}

            {/* Form Content - Full View */}
            {viewMode === 'full' && (
              <div className="edit-form-content-full">
                
                {/* BASIC INFORMATION SECTION */}
                <div className="edit-form-section">
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                    <input
                      ref={avatarInputRefFullView}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      style={{ display: 'none' }}
                    />
                    {formData.avatar ? (
                      <img 
                        src={formData.avatar} 
                        alt="Profile Avatar" 
                        onClick={() => avatarInputRefFullView.current?.click()}
                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                      />
                    ) : (
                      <div 
                        onClick={() => avatarInputRefFullView.current?.click()}
                        style={{
                          backgroundColor: cachedAvatarColor,
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '1.8rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          position: 'relative'
                        }}
                      >
                        <span style={{
                          position: 'relative',
                          zIndex: 1,
                          letterSpacing: '-1px'
                        }}>
                          {getInitials(formData.name || profileData.name, formData.email || profileData.email)}
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="form-section-title">Basic Information</h3>
                  
                  <div className="form-two-col">
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        onFocus={() => handleFieldFocus('name')}
                        onBlur={() => handleFieldBlur('name')}
                        className={getFieldInputClass('name')}
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Professional Title *</label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        onFocus={() => handleFieldFocus('title')}
                        onBlur={() => handleFieldBlur('title')}
                        className={getFieldInputClass('title')}
                        placeholder="e.g., Senior React Developer"
                      />
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <label>Email *</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleEmailChange}
                          onKeyDown={handleEmailKeyDown}
                          onFocus={() => handleFieldFocus('email')}
                          onBlur={handleEmailBlur}
                          className={`${getFieldInputClass('email')} ${emailErrorShaking ? 'field-error-shake' : ''}`}
                          placeholder="yourname@gmail.com"
                          style={{ paddingRight: (isEmailValid || isCheckingEmail) ? '40px' : '12px' }}
                        />
                        {emailSuggestion && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 12px',
                            pointerEvents: 'none',
                            fontFamily: 'inherit',
                            fontSize: 'inherit'
                          }}>
                            <span style={{
                              color: 'rgba(0, 0, 0, 0.3)',
                              marginLeft: '0px'
                            }}>
                              {emailSuggestion}
                            </span>
                          </div>
                        )}
                        {isCheckingEmail && (
                          <div style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: '2px solid #0a8545',
                            animation: 'spin 1s linear infinite'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#0a8545'
                            }}></div>
                          </div>
                        )}
                        {isEmailValid && !isCheckingEmail && (
                          <svg
                            style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '20px',
                              height: '20px',
                              pointerEvents: 'none'
                            }}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#0a8545"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Location</label>
                      <LocationSelector 
                        value={formData.location}
                        onChange={(location) => setFormData(prev => ({ ...prev, location }))}
                        onTimezoneChange={(timezone) => setFormData(prev => ({ ...prev, timezone }))}
                        onCountryChange={(country) => syncCountryCodeFromLocation(country)}
                      />
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <label>Phone *</label>
                      <div className="phone-input-group">
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
                          onChange={handleInputChange}
                          onKeyDown={handlePhoneKeyDown}
                          onFocus={() => handleFieldFocus('phone')}
                          onBlur={() => handleFieldBlur('phone')}
                          className={`phone-input ${getFieldInputClass('phone')}`}
                          placeholder="712 345 678"
                        />
                      </div>
                    </div>
                    
                  </div>

                  <div className="form-group">
                    <label>Professional Bio</label>
                    <textarea 
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      onFocus={() => handleFieldFocus('bio')}
                      onBlur={() => handleFieldBlur('bio')}
                      className={getFieldInputClass('bio')}
                      placeholder="Tell us about yourself and your expertise..."
                      rows="3"
                    />
                  </div>
                </div>

                {/* PROFESSIONAL EXPERTISE SECTION */}
                <div className="edit-form-section">
                  <h3 className="form-section-title">Professional Expertise</h3>
                  
                  <div className="form-group">
                    <label>Skills (comma-separated)</label>
                    <textarea 
                      name="skills"
                      value={formData.skills}
                      onChange={handleInputChange}
                      onFocus={() => handleFieldFocus('skills')}
                      onBlur={() => handleFieldBlur('skills')}
                      className={getFieldInputClass('skills')}
                      placeholder="React, JavaScript, Node.js, TypeScript, PostgreSQL..."
                      rows="2"
                    />
                  </div>

                  <div className="form-group">
                    <label>Certifications & Credentials</label>
                    <textarea 
                      name="certifications"
                      value={formData.certifications}
                      onChange={handleInputChange}
                      onFocus={() => handleFieldFocus('certifications')}
                      onBlur={() => handleFieldBlur('certifications')}
                      className={getFieldInputClass('certifications')}
                      placeholder="AWS Certified, Google Cloud Certified, React Advanced..."
                      rows="2"
                    />
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <ExperienceSelector 
                        value={formData.experience}
                        onChange={(exp) => handleInputChange({target: {name: 'experience', value: exp}})}
                        placeholder="Select experience level"
                      />
                    </div>
                    <div className="form-group">
                      <LanguageSelector 
                        value={formData.languages}
                        onChange={handleLanguagesChange}
                        placeholder="Add Language"
                      />
                    </div>
                  </div>
                </div>

                {/* WORK PREFERENCES SECTION */}
                <div className="edit-form-section">
                  <h3 className="form-section-title">Work Preferences</h3>
                  
                  <div className="form-two-col">
                    <div className="form-group">
                      <label>Rate</label>
                      <RateSelector 
                        value={formData.hourlyRate}
                        onChange={(value) => handleInputChange({target: {name: 'hourlyRate', value}})}
                        currency="Ksh"
                        isFilled={hasFieldValue(formData.hourlyRate)}
                      />
                    </div>
                    <AvailabilitySelector 
                      value={formData.availability}
                      onChange={(status) => handleInputChange({target: {name: 'availability', value: status}})}
                      placeholder="Select availability"
                    />
                  </div>

                  <div className="form-two-col">
                    <ProjectTypeSelector 
                      value={formData.projectTypes}
                      onChange={(type) => handleInputChange({target: {name: 'projectTypes', value: type}})}
                      placeholder="Select project type"
                    />
                    <WorkStyleSelector 
                      value={formData.workStyle}
                      onChange={(style) => handleInputChange({target: {name: 'workStyle', value: style}})}
                      placeholder="Select work style"
                    />
                  </div>
                </div>

                {/* PORTFOLIO & SOCIAL SECTION */}
                <div className="edit-form-section">
                  <h3 className="form-section-title">Social Links</h3>
                  
                  <div className="form-two-col">
                    <div className="form-group">
                      <label><FaGlobe className="social-icon globe" /> Website</label>
                      <textarea
                        name="portfolioWebsite"
                        value={formData.portfolioWebsite}
                        onChange={handleInputChange}
                        onFocus={() => handleFieldFocus('portfolioWebsite')}
                        onBlur={() => handleFieldBlur('portfolioWebsite')}
                        className={getFieldInputClass('portfolioWebsite')}
                        placeholder="yourportfolio.com"
                        rows="1"
                      />
                    </div>
                    <div className="form-group">
                      <label><FaXTwitter className="social-icon twitter" /> Twitter</label>
                      <div className="input-with-prefix">
                        
                        <input
                          type="text"
                          name="twitterHandleFull"
                          value={twitterHandle}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTwitterHandle(v);
                            setFormData(prev => ({ ...prev, twitter: composeSocialUrl('twitter', v) }));
                          }}
                          onFocus={() => handleFieldFocus('twitter')}
                          onBlur={() => handleFieldBlur('twitter')}
                          className={getFieldInputClass('twitter')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <label><FaGithub className="social-icon github" /> GitHub</label>
                      <div className="input-with-prefix">
                        
                        <input
                          type="text"
                          name="githubHandleFull"
                          value={githubHandle}
                          onChange={(e) => {
                            const v = e.target.value;
                            setGithubHandle(v);
                            setFormData(prev => ({ ...prev, github: composeSocialUrl('github', v) }));
                          }}
                          onFocus={() => handleFieldFocus('github')}
                          onBlur={() => handleFieldBlur('github')}
                          className={getFieldInputClass('github')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label><FaLinkedin className="social-icon linkedin" /> LinkedIn</label>
                      <div className="input-with-prefix">
                        
                        <input
                          type="text"
                          name="linkedinHandleFull"
                          value={linkedinHandle}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLinkedinHandle(v);
                            setFormData(prev => ({ ...prev, linkedin: composeSocialUrl('linkedin', v) }));
                          }}
                          onFocus={() => handleFieldFocus('linkedin')}
                          onBlur={() => handleFieldBlur('linkedin')}
                          className={getFieldInputClass('linkedin')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <label><FaInstagram className="social-icon instagram" /> Instagram</label>
                      <div className="input-with-prefix">
                        
                        <input
                          type="text"
                          name="instagramHandleFull"
                          value={instagramHandle}
                          onChange={(e) => {
                            const v = e.target.value;
                            setInstagramHandle(v);
                            setFormData(prev => ({ ...prev, instagram: composeSocialUrl('instagram', v) }));
                          }}
                          onFocus={() => handleFieldFocus('instagram')}
                          onBlur={() => handleFieldBlur('instagram')}
                          className={getFieldInputClass('instagram')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label><FaFacebook className="social-icon facebook" /> Facebook</label>
                      <div className="input-with-prefix">
                        
                        <input
                          type="text"
                          name="facebookHandleFull"
                          value={(formData.facebook && formData.facebook.startsWith('http')) ? formData.facebook.replace(/^https?:\/\//i, '') : (formData.facebook || '')}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFormData(prev => ({ ...prev, facebook: composeSocialUrl('facebook', v) }));
                          }}
                          onFocus={() => handleFieldFocus('facebook')}
                          onBlur={() => handleFieldBlur('facebook')}
                          className={getFieldInputClass('facebook')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-two-col">
                    <div className="form-group">
                      <label><FaTiktok className="social-icon tiktok" /> TikTok</label>
                      <div className="input-with-prefix">
                        <input
                          type="text"
                          name="tiktokHandleFull"
                          value={formData.tiktok && formData.tiktok.startsWith('http') ? formData.tiktok : (formData.tiktok ? formData.tiktok.replace(/^https?:\/\//i, '') : '')}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFormData(prev => ({ ...prev, tiktok: composeSocialUrl('tiktok', v) }));
                          }}
                          onFocus={() => handleFieldFocus('tiktok')}
                          onBlur={() => handleFieldBlur('tiktok')}
                          className={getFieldInputClass('tiktok')}
                          placeholder="yourprofile"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label><FaWhatsapp className="social-icon whatsapp" /> WhatsApp</label>
                      <div className="whatsapp-row">
                        <div className="input-with-country">
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
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="tel"
                            name="whatsappLocalFull"
                            value={whatsappLocalNumber}
                            onChange={(e) => {
                              const v = getDigitsOnly(e.target.value);
                              setPhoneNumberValue(v);
                              setWhatsappLocalNumber(v);
                              setFormData(prev => ({
                                ...prev,
                                phone: v,
                                whatsapp: composeSocialUrl('whatsapp', v)
                              }));
                            }}
                            onBeforeInput={(e) => {
                              if (e.data && !/^\d*$/.test(e.data)) {
                                e.preventDefault();
                              }
                            }}
                            onKeyDown={handlePhoneKeyDown}
                            onFocus={() => handleFieldFocus('whatsapp')}
                            onBlur={() => handleFieldBlur('whatsapp')}
                            className={getFieldInputClass('whatsapp')}
                            placeholder="712345678"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DESIGN SECTION */}
                <div className="edit-form-section">
                  <h3 className="form-section-title required">Design</h3>
                  {renderMediaUploadSection()}
                </div>
              </div>
            )}

            {/* Navigation Buttons - Steps View */}
            {viewMode === 'steps' && (
              <div className={`form-navigation ${currentStep === 1 ? 'step-one' : ''}`}>
                <button 
                  className="btn-nav-prev" 
                  onClick={handlePrevStep}
                  disabled={currentStep === 1}
                  title="Previous"
                >
                  <svg width="20px" height="20px" viewBox="0 0 48 48" version="1" xmlns="http://www.w3.org/2000/svg" enableBackground="new 0 0 48 48">
                    <polygon fill="currentColor" points="30.9,43 34,39.9 18.1,24 34,8.1 30.9,5 12,24"/>
                  </svg>
                </button>
                
                <button className="btn-cancel-new" onClick={handleCancel} title="Cancel">
                  <svg fill="currentColor" width="20px" height="20px" viewBox="0 0 36 36" version="1.1" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18,2A16,16,0,1,0,34,18,16,16,0,0,0,18,2ZM4,18A13.93,13.93,0,0,1,7.43,8.85L27.15,28.57A14,14,0,0,1,4,18Zm24.57,9.15L8.85,7.43A14,14,0,0,1,28.57,27.15Z"></path>
                  </svg>
                </button>

                {currentStep === TOTAL_STEPS ? (
                  <button 
                    className="btn-save-new" 
                    onClick={handleSaveProfile}
                    disabled={!formData.name?.trim() || !formData.title?.trim() || !formData.email?.trim() || !formData.phone?.trim() || !(Array.isArray(mediaFiles) && mediaFiles.length > 0)}
                    title={!formData.name?.trim() || !formData.title?.trim() || !formData.email?.trim() || !formData.phone?.trim() ? "Please fill in all required fields" : (!(Array.isArray(mediaFiles) && mediaFiles.length > 0) ? 'Please upload at least one media file' : "")}
                    style={{opacity: !formData.name?.trim() || !formData.title?.trim() || !formData.email?.trim() || !formData.phone?.trim() || !(Array.isArray(mediaFiles) && mediaFiles.length > 0) ? 0.5 : 1, cursor: !formData.name?.trim() || !formData.title?.trim() || !formData.email?.trim() || !formData.phone?.trim() || !(Array.isArray(mediaFiles) && mediaFiles.length > 0) ? 'not-allowed' : 'pointer'}}
                  >
                    {isEditMode ? 'Update Profile' : 'Create Profile'}
                  </button>
                ) : (
                  <button className="btn-nav-next" onClick={handleNextStep} title="Next">
                    <svg width="20px" height="20px" viewBox="0 0 48 48" version="1" xmlns="http://www.w3.org/2000/svg" enableBackground="new 0 0 48 48" style={{transform: 'scaleX(-1)'}}>
                      <polygon fill="currentColor" points="30.9,43 34,39.9 18.1,24 34,8.1 30.9,5 12,24"/>
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Navigation Buttons - Full View */}
            {viewMode === 'full' && (
              <div className="form-navigation form-navigation-full">
                <div className="form-actions-new">
                  <button className="btn-cancel-new" onClick={handleCancel} title="Cancel">
                    <svg fill="currentColor" width="20px" height="20px" viewBox="0 0 36 36" version="1.1" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18,2A16,16,0,1,0,34,18,16,16,0,0,0,18,2ZM4,18A13.93,13.93,0,0,1,7.43,8.85L27.15,28.57A14,14,0,0,1,4,18Zm24.57,9.15L8.85,7.43A14,14,0,0,1,28.57,27.15Z"></path>
                    </svg>
                  </button>
                  <button 
                    className="btn-save-new" 
                    onClick={handleSaveProfile}
                    disabled={!formData.name?.trim() || !formData.title?.trim() || !formData.email?.trim() || !formData.phone?.trim() || !(Array.isArray(mediaFiles) && mediaFiles.length > 0)}
                    title={!formData.name?.trim() || !formData.title?.trim() || !formData.email?.trim() || !formData.phone?.trim() ? "Please fill in all required fields" : (!(Array.isArray(mediaFiles) && mediaFiles.length > 0) ? 'Please upload at least one media file' : "")}
                    style={{opacity: !formData.name?.trim() || !formData.title?.trim() || !formData.email?.trim() || !formData.phone?.trim() || !(Array.isArray(mediaFiles) && mediaFiles.length > 0) ? 0.5 : 1, cursor: !formData.name?.trim() || !formData.title?.trim() || !formData.email?.trim() || !formData.phone?.trim() || !(Array.isArray(mediaFiles) && mediaFiles.length > 0) ? 'not-allowed' : 'pointer'}}
                  >
                    {isEditMode ? 'Update Profile' : 'Create Profile'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* OTP Verification Modal */}
        {showOtpModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            animation: 'fadeIn 100ms ease-out'
          }}>
            <div style={{
              backgroundColor: '#202c33',
              borderRadius: '12px',
              padding: '12px 24px',
              maxWidth: '400px',
              width: '90%',
              minHeight: '440px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
              animation: 'slideUp 150ms ease-out'
            }}>
              <h2 style={{ margin: '0 0 16px 0', paddingBottom: '12px', borderBottom: '1px solid #3a4a55', fontSize: '20px', fontWeight: '600', color: '#ffffff', textAlign: 'center' }}>
                Email Verification
              </h2>

              {/* Email Input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#ffffff' }}>
                  Email Address
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="email"
                    value={modalEmail}
                    disabled
                    readOnly
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: 'none',
                      color: '#b0b0b0',
                      backgroundColor: '#0b1216',
                      borderRadius: '8px',
                      fontSize: '18px',
                      boxSizing: 'border-box',
                      opacity: 0.8,
                      cursor: 'not-allowed'
                    }}
                    placeholder="your@gmail.com"
                  />
                  <button
                    onClick={() => {
                      setShowOtpModal(false);
                      setOtpSent(false);
                      setOtpCode('');
                      setOtpError('');
                      setResendCountdown(0);
                    }}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'transparent',
                      color: 'var(--accent-color)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '-24px'
                    }}
                    title="Edit email"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={{ fill: '#bbbbbb' }}>
                      <path d="M2.29171812,13.3600638 L6.81539686,18.1161843 L0.5,20 L2.29171812,13.3600638 Z M12.7049284,2.41181464 L17.2274301,7.16667706 L7.26550878,17.6404299 L2.74300706,12.8855675 L12.7049284,2.41181464 Z M16.1415118,0.347861156 C16.8783654,1.12259394 18.3106609,2.62843788 19.1175863,3.4768634 C19.9245902,4.32524768 19.2036068,5.09020427 19.2036068,5.09020427 L17.6827602,6.68916958 L13.1591207,1.93311092 L14.6798693,0.334186853 L14.6989777,0.315464422 C14.8180473,0.203171183 15.4749058,-0.352994255 16.1415118,0.347861156 Z" />
                    </svg>
                  </button>
                </div>
                <div style={{ minHeight: '18px', marginTop: '4px', fontSize: '12px' }}>
                  <div style={{ color: '#ef4444', minHeight: '18px', visibility: modalEmailError ? 'visible' : 'hidden' }}>
                    {modalEmailError || '\u00A0'}
                  </div>
                </div>
              </div>

              {/* Send OTP Button */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'stretch', flexWrap: 'nowrap' }}>
                <button
                  onClick={handleSendModalOTP}
                  disabled={isCheckingOTP || !modalEmail || resendCountdown > 0}
                  style={{
                    flex: '1 0 0',
                    width: '100%',
                    minWidth: '120px',
                    padding: '12px',
                    backgroundColor: '#0a8545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isCheckingOTP || !modalEmail || resendCountdown > 0 ? 'not-allowed' : 'pointer',
                    opacity: isCheckingOTP || !modalEmail || resendCountdown > 0 ? 0.9 : 1,
                    display: 'inline-flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isCheckingOTP ? 'Sending...' : resendCountdown > 0 ? `Resend in ${Math.floor(resendCountdown/60)}:${(resendCountdown%60).toString().padStart(2, '0')}` : otpError ? 'Resend Code' : 'Send Code'}
                </button>
                {/* Close/Cancel Button */}
                <button
                  onClick={handleCloseOTPModal}
                  style={{
                    flex: '1 0 0',
                    width: '100%',
                    minWidth: '120px',
                    padding: '12px',
                    backgroundColor: '#0b1216',
                    color: '#b0b0b0',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Cancel
                </button>
              </div>

              {/* OTP Input */}
              <div style={{ marginBottom: '16px', paddingTop: '12px', borderTop: '1px solid #3a4a55' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff' }}>
                    Verification Code
                  </label>
                  <span style={{ fontSize: '12px', color: '#0a8545', fontWeight: '600', whiteSpace: 'nowrap', width: '112px', minWidth: '112px', display: 'inline-block', textAlign: 'right' }}>
                    {resendCountdown > 0 ? `Resend in ${Math.floor(resendCountdown/60)}:${(resendCountdown%60).toString().padStart(2, '0')}` : 'Ready'}
                  </span>
                </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <input
                            key={index}
                            data-index={index}
                            ref={(el) => {
                              otpInputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength="1"
                            value={otpCode[index] || ''}
                            onChange={(e) => handleOtpBoxChange(index, e.target.value)}
                            onBeforeInput={(e) => handleOtpBeforeInput(index, e)}
                            onPaste={handleOtpPaste}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
                              setTimeout(() => {
                                otpInputRefs.current[index - 1]?.focus();
                              }, 0);
                            }
                            if (e.key === 'Enter' && otpCode.length === 6) {
                              handleVerifyModalOTP();
                            }
                          }}
                          disabled={isCheckingOTP || otpVerified}
                          id={`otp-box-${index}`}
                          style={{
                            width: '40px',
                            height: '40px',
                            padding: '8px',
                            borderStyle: 'solid',
                            borderWidth: '1px',
                            borderColor: otpError ? '#ef4444' : '#3a4a55',
                            color: '#ffffff',
                            backgroundColor: '#0b1216',
                            borderRadius: '6px',
                            fontSize: '18px',
                            fontWeight: '600',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                            opacity: otpVerified ? 0.6 : 1,
                            cursor: isCheckingOTP || otpVerified ? 'not-allowed' : 'text'
                          }}
                          />
                        ))}
                      </div>
                    </div>
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', textAlign: 'center', height: '18px', lineHeight: '18px', minHeight: '18px', visibility: otpError ? 'visible' : 'hidden', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {otpError || '\u00A0'}
                  </div>
                  </div>

                  {/* Verify Button */}
                  <button
                    onClick={handleVerifyModalOTP}
                    disabled={isCheckingOTP || otpVerified || otpCode.length !== 6}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: otpVerified ? '#4ade80' : '#0a8545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: isCheckingOTP || otpVerified || otpCode.length !== 6 ? 'not-allowed' : 'pointer',
                      opacity: isCheckingOTP || otpVerified || otpCode.length !== 6 ? 0.6 : 1,
                      marginBottom: '8px',
                      display: 'inline-flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {otpVerified ? '✓ Verified' : isCheckingOTP ? 'Verifying...' : 'Verify & Create'}
                  </button>

            </div>
          </div>
        )}

        {/* Premium Panel Modal */}
        {showPremiumPanel && (
          <PremiumPanel 
            onClose={() => setShowPremiumPanel(false)}
            onBack={() => {
              setShowPremiumPanel(false);
              onClose();
            }}
            onUpgradeToPro={() => {
              setShowPremiumPanel(false);
              setShowPremiumProPanel(true);
            }}
            onSelectPlan={(selectedPlan) => {
              setSelectedUpgradePlan(selectedPlan);
              setShowPremiumPanel(false);
              setShowSubscriptionModal(true);
            }}
          />
        )}

        {/* Premium Pro Panel Modal */}
        {showPremiumProPanel && (
          <PremiumProPanel 
            onClose={() => setShowPremiumProPanel(false)}
            onBack={() => {
              setShowPremiumProPanel(false);
              onClose();
            }}
            isPro={true}
          />
        )}

        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => {
            setShowSubscriptionModal(false);
            setSelectedUpgradePlan(null);
          }}
          onBack={() => {
            setShowSubscriptionModal(false);
            setShowPremiumPanel(true);
          }}
          user={selectedAccount}
          product="joblink"
          selectedPlan={selectedUpgradePlan}
        />


      </div>
    </div>
    </>
  );
}

export default UserAccountPanel;


