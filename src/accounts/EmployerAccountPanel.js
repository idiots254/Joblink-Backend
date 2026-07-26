import './EmployerAccountPanel.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { FaLinkedin, FaXTwitter, FaInstagram, FaFacebook, FaImage, FaVideo, FaFilePdf } from 'react-icons/fa6';
import { API_URL } from '../config';
import { uploadAvatarToSupabase } from '../utils/avatarStorage';
import { uploadMediaFileToSupabase } from '../utils/mediaStorage';
import { normalizeProfileMediaFiles, serializeMediaForDatabase } from '../utils/profileMedia';
import LocationSelector from '../forms/LocationSelector';
import YearPicker from '../forms/YearPicker';
import { useAuth } from '../contexts/AuthContext';
import { pushBackAction, popBackAction } from '../services/backNavigation';
import { getAccountPanelBackState } from './accountPanelBackBehavior';
import { getDigitsOnly, buildWhatsappUrl } from './contactSyncUtils';
import {
  CompanyInformationSection,
  CompanyProfileSection,
  HiringInformationSection,
  AboutCompanySection,
  SocialLinksSection,
} from './employer/EmployerSectionBlocks';

/**
 * Get stored selected profession from localStorage
 */
const getStoredSelectedProfession = () => {
  try {
    const stored = localStorage.getItem('selectedProfession');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Error parsing selectedProfession from localStorage:', error);
    return null;
  }
};

/**
 * Fallback industry value
 */
const fallbackIndustry = 'Other';

const getInitialMediaFiles = (account) => {
  if (!account || typeof account !== 'object') return [];
  return normalizeProfileMediaFiles(account);
};

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


function EmployerAccountPanel({ onClose, onProfileCreated, selectedAccount, selectedAccountType, onBack, onDeleteMedia, onDeleteMultipleMedia }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [currentStep, setCurrentStep] = useState(1);
  const [viewMode, setViewMode] = useState(selectedAccount ? 'full' : 'steps');
  const [isEditingProfile, setIsEditingProfile] = useState(!selectedAccount); // Track if actively editing forms
  const latestProfileDataRef = useRef(null);
  const [focusedField, setFocusedField] = useState(null);
  const panelRef = useRef(null);
  const formContentRef = useRef(null);
  const [filledFields, setFilledFields] = useState(new Set());
  const [emailSuggestion, setEmailSuggestion] = useState(''); // Track email suggestion
  const [isEmailValid] = useState(false); // Track email validation
  const [isCheckingEmail] = useState(false); // Track email checking state
  const [emailErrorShaking, setEmailErrorShaking] = useState(false); // Trigger shake animation
  const [otpCode, setOtpCode] = useState(''); // OTP entered by user
  const [, setOtpSent] = useState(false); // Track if OTP was sent
  const [otpVerified, setOtpVerified] = useState(false); // Track if OTP was verified
  const [isCheckingOTP, setIsCheckingOTP] = useState(false); // Track OTP verification in progress
  const [otpError, setOtpError] = useState(''); // OTP error message
  const [resendCountdown, setResendCountdown] = useState(0); // Countdown timer for resend
  const [showOtpModal, setShowOtpModal] = useState(false); // Show OTP verification modal
  const [modalEmail, setModalEmail] = useState(''); // Email in OTP modal
  const [modalEmailError, setModalEmailError] = useState(''); // Email error in modal
  const [showPhoneCountryModal, setShowPhoneCountryModal] = useState(false); // Phone country dropdown modal
  const [showCompanySizeModal, setShowCompanySizeModal] = useState(false); // Company size selection modal
  const [showYearFoundedPicker, setShowYearFoundedPicker] = useState(false); // Year founded picker modal
  const [selectedCountryCode, setSelectedCountryCode] = useState('+254'); // Selected country code
  const [selectedCountryInfo, setSelectedCountryInfo] = useState('🇰🇪 Kenya'); // Selected country with flag
  const [phoneNumberValue, setPhoneNumberValue] = useState('');
  const TOTAL_STEPS = 6;
  const companySizeOptions = ['1-10 employees', '10-50 employees', '50-100 employees', '100-500 employees', '500+ employees'];

  // Avatar file input refs
  const avatarInputRefStep1 = useRef(null);
  const avatarInputRefFullView = useRef(null);
  const otpInputRefs = useRef([]);
  const lastAutoVerifyRef = useRef(null); // track last auto-verified OTP to avoid repeated attempts

  const handleOtpBoxChange = (index, value) => {
    const sanitizedValue = value.replace(/\D/g, '');

    if (sanitizedValue.length > 1) {
      fillOtpDigits(sanitizedValue, index);
      return;
    }

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

  const { user } = useAuth();

  const getStoredLoginData = () => {
    try {
      const saved = localStorage.getItem('joblinkUser');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Error parsing joblinkUser from localStorage:', error);
      return null;
    }
  };

  const loginUser = getStoredLoginData();
  const authEmail = user?.email || null;

  // Load avatar from localStorage on component mount and sync across instances
  const [, setAvatarState] = useState(() => {
    return localStorage.getItem('employerAvatar') || loginUser?.avatar || null;
  });

  // Cache the avatar color so it doesn't change as user edits the name
  const [cachedAvatarColor, setCachedAvatarColor] = useState(null);

  useEffect(() => {
    // Listen for storage changes (when avatar updated in other component/tab)
    const handleStorageChange = (e) => {
      if (e.key === 'employerAvatar' && e.newValue) {
        setAvatarState(e.newValue);
        // Update form data avatar as well
        setFormData(prev => ({
          ...prev,
          avatar: e.newValue
        }));
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const resetFormForSelectedAccount = useCallback((nextProfileData = latestProfileDataRef.current) => {
    setFormData(nextProfileData || getInitialProfileData());
    setCurrentStep(1);
    const newViewMode = selectedAccount ? 'full' : 'steps';
    setViewMode(newViewMode);
    setIsEditingProfile(newViewMode === 'steps');
    setActiveTab('profile');
  }, [selectedAccount]);
  
  // Get the profession name from localStorage
  const getProfessionName = () => {
    const profession = getStoredSelectedProfession();
    return profession?.sector || profession?.industry || profession?.name || 'Employer';
  };
  const [professionName] = useState(getProfessionName);
  
  // Check if this is a new employer account or editing an existing one
  // selectedAccount with data = editing mode; no data or undefined = creation mode
  const isEditMode = !!selectedAccount && (selectedAccount.name || selectedAccount.email || selectedAccount.industry || selectedAccount.userType === 'employer');
  
  const getInitialProfileData = () => {
    const storedAvatar = localStorage.getItem('employerAvatar') || loginUser?.avatar || selectedAccount?.avatar || null;

    if (selectedAccount) {
      return {
        // Company Basic Info
        name: selectedAccount.name || '',
        email: selectedAccount.email || authEmail || loginUser?.email || '',
        phone: selectedAccount.phone || '',
        avatar: storedAvatar,
        title: selectedAccount.title || '',
        dateOfBirth: selectedAccount.dateOfBirth || localStorage.getItem('dateOfBirth') || '',
        
        // Company Details
        industry: selectedAccount.industry || fallbackIndustry,
        companySize: selectedAccount.companySize || '',
        founded: selectedAccount.founded || '',
        website: selectedAccount.website || '',
        location: selectedAccount.location || '',
        
        // About
        bio: selectedAccount.bio || '',
        description: selectedAccount.description || '',
        
        // HR & Hiring
        rating: selectedAccount.rating || 0,
        activeJobs: selectedAccount.activeJobs || 0,
        totalHired: selectedAccount.totalHired || 0,
        hiringManager: selectedAccount.hiringManager || '',
        
        // Culture
        culture: selectedAccount.culture || '',
        benefits: selectedAccount.benefits || '',
        
        // Social Links
        linkedin: selectedAccount.linkedin || '',
        twitter: selectedAccount.twitter || '',
        facebook: selectedAccount.facebook || '',
        instagram: selectedAccount.instagram || '',
        mediaFiles: getInitialMediaFiles(selectedAccount),
      };
    }

    return {
      // Company Basic Info
      name: '',
      email: authEmail || loginUser?.email || '',
      phone: '',
      avatar: localStorage.getItem('employerAvatar') || loginUser?.avatar || null,
      title: '',
      dateOfBirth: localStorage.getItem('dateOfBirth') || '',
      
      // Company Details
      industry: fallbackIndustry,
      companySize: '',
      founded: '',
      website: '',
      location: '',
      
      // About
      bio: '',
      description: '',
      
      // HR & Hiring
      rating: 0,
      activeJobs: 0,
      totalHired: 0,
      hiringManager: '',
      
      // Culture
      culture: '',
      benefits: '',
      
      // Social Links
      linkedin: '',
      twitter: '',
      facebook: '',
      instagram: '',
      mediaFiles: [],
    };
  };
  
  const [profileData, setProfileData] = useState(getInitialProfileData());
  const [formData, setFormData] = useState(profileData);

  useEffect(() => {
    setPhoneNumberValue(String(formData.phone || '').replace(/\D/g, ''));
  }, [formData.phone]);

  useEffect(() => {
    latestProfileDataRef.current = profileData;
  }, [profileData]);
  const [mediaFiles, setMediaFiles] = useState(() => getInitialMediaFiles(selectedAccount));
  const [mediaPreviewId, setMediaPreviewId] = useState(null);
  const [showSuccessMessage] = useState(false);
  const previewVideoRef = useRef(null);
  const preloadVideoRef = useRef(null);
  const mediaPreviewTouchStartRef = useRef(null);

  const getMediaFileKey = (file) => {
    return file?.id || file?.publicUrl || file?.url || file?.path || file?.name || '';
  };

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

  const formatFoundedValue = (value) => {
    if (!value) return '';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthLabel = monthNames[parsed.getMonth()] || 'Jan';
    const dayLabel = String(parsed.getDate()).padStart(2, '0');
    return `${monthLabel} ${dayLabel}, ${parsed.getFullYear()}`;
  };

  useEffect(() => {
    // Update profile data when selectedAccount changes
    const newProfileData = getInitialProfileData();
    latestProfileDataRef.current = newProfileData;
    setProfileData(newProfileData);
    setFormData(newProfileData);
    setMediaFiles(normalizeMediaFiles(getInitialMediaFiles(selectedAccount)));
    setMediaPreviewId(null);
    
    // Cache the avatar color based on initial profile data so it doesn't change as user edits
    const initialColor = getAvatarColor(newProfileData.name, newProfileData.email);
    setCachedAvatarColor(initialColor);
    
    resetFormForSelectedAccount(newProfileData);
  }, [selectedAccount, resetFormForSelectedAccount]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Preload previous media when preview is opened
  useEffect(() => {
    if (!mediaPreviewId) {
      if (preloadVideoRef.current) {
        preloadVideoRef.current.src = '';
      }
      return;
    }

    const currentFile = mediaFiles.find((file) => getMediaFileKey(file) === mediaPreviewId);
    if (!currentFile) return;

    // Determine preview group based on file type
    let previewGroup = mediaFiles;
    if (currentFile.type?.startsWith('image/')) {
      previewGroup = mediaFiles.filter((item) => item?.type?.startsWith('image/'));
    } else if (currentFile.type?.startsWith('video/')) {
      previewGroup = mediaFiles.filter((item) => item?.type?.startsWith('video/'));
    } else if (currentFile.type === 'application/pdf') {
      previewGroup = mediaFiles.filter((item) => item?.type === 'application/pdf');
    }

    const currentIndex = previewGroup.findIndex((file) => getMediaFileKey(file) === mediaPreviewId);
    if (currentIndex === -1) return;

    // Get previous media
    const prevIndex = currentIndex === 0 ? previewGroup.length - 1 : currentIndex - 1;
    const previousFile = previewGroup[prevIndex];

    if (!previousFile) return;

    // Preload if it's a video
    if (previousFile.type?.startsWith('video/') && preloadVideoRef.current) {
      preloadVideoRef.current.src = previousFile.publicUrl || previousFile.url || '';
    }
  }, [mediaPreviewId, mediaFiles]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const sanitizedValue = name === 'phone' ? value.replace(/\D/g, '') : value;
    if (name === 'phone') {
      setPhoneNumberValue(sanitizedValue);
    }
    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));
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

  const handleFieldFocus = (fieldName) => {
    setFocusedField(fieldName);
  };

  const handleFieldBlur = (fieldName) => {
    const value = formData[fieldName];
    // If field has content, mark it as filled
    if (value && value.toString().trim()) {
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

  const renderAvatarPreview = (inputRef, size = 80) => {
    const avatarSource = formData.avatar || profileData.avatar || localStorage.getItem('employerAvatar') || loginUser?.avatar || null;

    if (avatarSource) {
      return (
        <img
          src={avatarSource}
          alt="Company Avatar"
          onClick={() => inputRef?.current?.click()}
          style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
        />
      );
    }

    return (
      <div
        onClick={() => inputRef?.current?.click()}
        style={{
          backgroundColor: cachedAvatarColor,
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: size > 70 ? '1.8rem' : '1.2rem',
          fontWeight: '700',
          cursor: 'pointer',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <span style={{ position: 'relative', zIndex: 1, letterSpacing: '-1px' }}>
          {getInitials(formData.name || profileData.name, formData.email || profileData.email)}
        </span>
      </div>
    );
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploaderId = loginUser?.id || selectedAccount?.id || formData?.id || null;
      const { publicUrl, path } = await uploadAvatarToSupabase(file, uploaderId);

      localStorage.setItem('employerAvatar', publicUrl);
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
      console.error('Employer avatar upload failed:', error);
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
      try { URL.revokeObjectURL(preview); } catch (e) {}
    }
  };

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const uploaderId = loginUser?.id || selectedAccount?.id || formData?.id || `temp-${Date.now()}`;

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
        const previewPromise = file.type.startsWith('image/')
          ? readFileAsDataURL(file).catch(() => null)
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
            preview: preview || null,
            url: publicUrl,
            uploading: false,
            uploadError: false
          }, 0);
        }));

        return { success: true, isVideo: file.type.startsWith('video/'), tempId };
      } catch (uploadError) {
        console.error('Media upload failed for', file.name, ':', uploadError);
        setMediaFiles(prev => prev.map((item) => {
          if (getMediaFileKey(item) !== tempId) return item;
          return normalizeMediaFile({
            ...item,
            uploading: false,
            uploadError: true
          }, 0);
        }));
        alert(`Failed to upload ${file.name}: ${uploadError.message || 'Unknown error'}`);
        return { success: false };
      }
    });

    await Promise.allSettled(pendingUploads);

    if (e?.target) {
      e.target.value = '';
    }
  };

  const removeMediaFile = (id) => {
    // Find the file being removed
    const fileToRemove = mediaFiles.find(file => getMediaFileKey(file) === id);
    
    // If file has a path/id from storage, delete from database too
    if (fileToRemove && (fileToRemove.path || fileToRemove.id)) {
      if (onDeleteMedia && typeof onDeleteMedia === 'function') {
        // Call the parent's delete handler
        onDeleteMedia(fileToRemove.path || fileToRemove.id)
          .then(success => {
            if (success) {
              // Only remove locally if server-side delete succeeded
              setMediaFiles(prev => prev.filter((file) => getMediaFileKey(file) !== id));
              setMediaPreviewId((currentId) => currentId === id ? null : currentId);
            }
          })
          .catch(err => console.warn('[removeMediaFile] Delete failed:', err));
      } else {
        // No handler provided, just remove locally (for new files not yet saved)
        setMediaFiles(prev => prev.filter((file) => getMediaFileKey(file) !== id));
        setMediaPreviewId((currentId) => currentId === id ? null : currentId);
      }
    } else {
      // No path/id = newly uploaded file, safe to remove locally only
      setMediaFiles(prev => prev.filter((file) => getMediaFileKey(file) !== id));
      setMediaPreviewId((currentId) => currentId === id ? null : currentId);
    }
  };

  const previewMediaFile = (file) => {
    if (!file) return;
    setMediaPreviewId(getMediaFileKey(file));
  };

  const closeMediaPreview = () => {
    setMediaPreviewId(null);
  };

  const getMediaPreviewGroup = useCallback((file) => {
    if (!file) return mediaFiles;

    if (file.type?.startsWith('image/')) {
      return mediaFiles.filter((item) => item?.type?.startsWith('image/'));
    }

    if (file.type?.startsWith('video/')) {
      return mediaFiles.filter((item) => item?.type?.startsWith('video/'));
    }

    if (file.type === 'application/pdf') {
      return mediaFiles.filter((item) => item?.type === 'application/pdf');
    }

    return mediaFiles;
  }, [mediaFiles]);

  const swapPreviewMedia = useCallback((direction) => {
    setMediaPreviewId((currentId) => {
      if (!currentId) return null;

      const currentFile = mediaFiles.find((file) => getMediaFileKey(file) === currentId);
      if (!currentFile) return currentId;

      // Determine preview group based on file type
      let previewGroup = mediaFiles;
      if (currentFile.type?.startsWith('image/')) {
        previewGroup = mediaFiles.filter((item) => item?.type?.startsWith('image/'));
      } else if (currentFile.type?.startsWith('video/')) {
        previewGroup = mediaFiles.filter((item) => item?.type?.startsWith('video/'));
      } else if (currentFile.type === 'application/pdf') {
        previewGroup = mediaFiles.filter((item) => item?.type === 'application/pdf');
      }

      if (previewGroup.length <= 1) return currentId;

      const currentIndex = previewGroup.findIndex((file) => getMediaFileKey(file) === currentId);
      if (currentIndex === -1) return currentId;

      const nextIndex = currentIndex + direction;
      const normalizedIndex = nextIndex < 0
        ? previewGroup.length - 1
        : nextIndex >= previewGroup.length
          ? 0
          : nextIndex;

      return getMediaFileKey(previewGroup[normalizedIndex]);
    });
  }, [mediaFiles]);

  const handleMediaPreviewTouchStart = useCallback((event) => {
    mediaPreviewTouchStartRef.current = event.touches[0].clientX;
  }, []);

  const handleMediaPreviewTouchEnd = useCallback((event) => {
    if (mediaPreviewTouchStartRef.current === null) return;

    const touchEndX = event.changedTouches[0].clientX;
    const swipeDistance = mediaPreviewTouchStartRef.current - touchEndX;
    const minSwipeDistance = 40;

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        swapPreviewMedia(1);
      } else {
        swapPreviewMedia(-1);
      }
    }

    mediaPreviewTouchStartRef.current = null;
  }, [swapPreviewMedia]);

  const renderMediaUploadSection = () => {
    const imageFiles = mediaFiles.filter((file) => file?.type?.startsWith('image/'));
    const videoFiles = mediaFiles.filter((file) => file?.type?.startsWith('video/'));
    const pdfFiles = mediaFiles.filter((file) => file?.type === 'application/pdf');
    const selectedMediaPreview = mediaFiles.find((file) => getMediaFileKey(file) === mediaPreviewId) || null;

    const renderMediaItem = (file) => {
      const itemKey = getMediaFileKey(file) || `${file.name}-${Math.random()}`;
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
            {file.type?.startsWith('image/') ? (
              <img src={file.preview || file.publicUrl || file.url} alt={file.name} className="media-thumbnail" />
            ) : file.type?.startsWith('video/') ? (
              <video
                key={`${itemKey}-${file.publicUrl || file.url}`}
                src={file.publicUrl || file.url}
                className="media-thumbnail"
                autoPlay={true}
                muted={true}
                loop={true}
                playsInline={true}
                preload="auto"
                controls={false}
                onLoadedData={(event) => {
                  event.currentTarget?.play?.().catch(() => {});
                }}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
            ) : (
              <div className="media-file-placeholder pdf-placeholder">
                <FaFilePdf className="media-upload-icon" />
                <span className="file-name">{file.name}</span>
              </div>
            )}
          </div>
          <div className="media-item-actions">
            <button className="media-remove-btn" onClick={() => removeMediaFile(getMediaFileKey(file))} type="button" aria-label={`Remove ${file.name}`}>
              ✕
            </button>
          </div>
        </div>
      );
    };

    return (
      <>
        <div className="media-section media-section-fullwidth">
          <div className="media-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
            <div className="media-control" style={{ flex: '0 0 72px', minWidth: '72px' }}>
              <h4>Image</h4>
              <label className="media-upload-label" aria-label="Attach Images">
                <div className="media-upload-box" title="Attach Images">
                  <FaImage className="media-upload-icon" />
                </div>
                <input type="file" multiple accept="image/*" onChange={handleMediaUpload} style={{ display: 'none' }} />
              </label>
              {imageFiles.length > 0 && <div className="media-count-below">{imageFiles.length} image{imageFiles.length === 1 ? '' : 's'}</div>}
            </div>
            <div className="media-gallery-row" style={{ flex: '1 1 auto', marginLeft: '12px' }}>
              {imageFiles.length > 0 ? (
                <div className="media-gallery-grid">{imageFiles.map((file) => renderMediaItem(file))}</div>
              ) : (
                <p className="media-empty-text">No images uploaded</p>
              )}
            </div>
          </div>

          <div className="media-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
            <div className="media-control" style={{ flex: '0 0 72px', minWidth: '72px' }}>
              <h4>Video</h4>
              <label className="media-upload-label" aria-label="Attach Videos">
                <div className="media-upload-box" title="Attach Videos">
                  <FaVideo className="media-upload-icon" />
                </div>
                <input type="file" multiple accept="video/*" onChange={handleMediaUpload} style={{ display: 'none' }} />
              </label>
              {videoFiles.length > 0 && <div className="media-count-below">{videoFiles.length} video{videoFiles.length === 1 ? '' : 's'}</div>}
            </div>
            <div className="media-gallery-row" style={{ flex: '1 1 auto', marginLeft: '12px' }}>
              {videoFiles.length > 0 ? (
                <div className="media-gallery-grid">{videoFiles.map((file) => renderMediaItem(file))}</div>
              ) : (
                <p className="media-empty-text">No videos uploaded</p>
              )}
            </div>
          </div>

          <div className="media-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
            <div className="media-control" style={{ flex: '0 0 72px', minWidth: '72px' }}>
              <h4>PDF</h4>
              <label className="media-upload-label" aria-label="Attach PDFs">
                <div className="media-upload-box" title="Attach PDFs">
                  <FaFilePdf className="media-upload-icon" />
                </div>
                <input type="file" multiple accept="application/pdf" onChange={handleMediaUpload} style={{ display: 'none' }} />
              </label>
              {pdfFiles.length > 0 && <div className="media-count-below">{pdfFiles.length} PDF{pdfFiles.length === 1 ? '' : 's'}</div>}
            </div>
            <div className="media-gallery-row" style={{ flex: '1 1 auto', marginLeft: '12px' }}>
              {pdfFiles.length > 0 ? (
                <div className="media-gallery-grid">{pdfFiles.map((file) => renderMediaItem(file))}</div>
              ) : (
                <p className="media-empty-text">No PDFs uploaded</p>
              )}
            </div>
          </div>
        </div>

        {selectedMediaPreview && (
          <div className="media-preview-modal" onClick={closeMediaPreview}>
            <div
              className="media-preview-content"
              onClick={(event) => event.stopPropagation()}
              onTouchStart={handleMediaPreviewTouchStart}
              onTouchEnd={handleMediaPreviewTouchEnd}
            >
              <button className="media-preview-close" type="button" onClick={closeMediaPreview} aria-label="Close preview">✕</button>
              <div className="media-preview-inner">
                {selectedMediaPreview.type?.startsWith('image/') ? (
                  <img src={selectedMediaPreview.preview || selectedMediaPreview.publicUrl || selectedMediaPreview.url} alt={selectedMediaPreview.name} />
                ) : selectedMediaPreview.type?.startsWith('video/') ? (
                  <video
                    key={getMediaFileKey(selectedMediaPreview)}
                    ref={previewVideoRef}
                    src={selectedMediaPreview.publicUrl || selectedMediaPreview.url}
                    controls={true}
                    autoPlay={false}
                    playsInline={true}
                    muted={false}
                    preload="metadata"
                    style={{ maxWidth: '100%', maxHeight: '70vh' }}
                  />
                ) : (
                  <div className="media-preview-file">
                    <span>{selectedMediaPreview.name}</span>
                    <a href={selectedMediaPreview.publicUrl || selectedMediaPreview.url} target="_blank" rel="noopener noreferrer">Open file in new tab</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hidden preload element for smooth video transitions */}
        <video ref={preloadVideoRef} style={{ display: 'none' }} preload="metadata" muted={true} />
      </>
    );
  };

  const handleSaveProfile = () => {
    // Validate required fields
    if (!formData.name || !formData.name.trim()) {
      alert('Please fill in Company Name');
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

    console.log('🔍 Opening OTP verification modal');
    // Reset OTP modal states
    setOtpCode('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtpError('');
    setModalEmailError('');
    setModalEmail(formData.email || ''); // Pre-fill with form email if exists
    setShowOtpModal(true);
  };

  const handleCancel = () => {
    setShowOtpModal(false);
    setOtpCode('');
    setOtpSent(false);
    setOtpVerified(false);
    setIsCheckingOTP(false);
    setOtpError('');
    setModalEmail('');
    setModalEmailError('');
    setShowPhoneCountryModal(false);
    setShowCompanySizeModal(false);
    setShowYearFoundedPicker(false);
    setEmailSuggestion('');
    setEmailErrorShaking(false);
    resetFormForSelectedAccount();
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
        setResendCountdown(90); // Start 90 second countdown
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

  // Actually create the profile
  const createProfile = useCallback(async () => {
    const authUserId = loginUser?.id || selectedAccount?.id || formData?.id || null;
    const hasUploading = Array.isArray(mediaFiles) && mediaFiles.some(f => f && f.uploading === true);
    if (hasUploading) {
      alert('Please wait for media uploads to finish before creating your profile.');
      return;
    }
    const normalizedEmail = formData.email ? formData.email.trim().toLowerCase() : '';
    const selectedProfession = getStoredSelectedProfession();
    const selectedIndustry = selectedProfession?.sector || selectedProfession?.industry || selectedProfession?.name || '';
    const otpProof = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('joblinkOtpVerificationId', otpProof);
    const newProfileData = {
      ...formData,
      email: normalizedEmail,
      userType: 'employer',
      industry: formData.industry || selectedIndustry,
      mediaFiles: Array.isArray(mediaFiles) ? mediaFiles : [],
      media_files: Array.isArray(mediaFiles) ? mediaFiles : [],
      _otpVerified: otpProof,
      ...(authUserId ? { id: authUserId } : {})
    };
    console.log('📤 [EmployerAccountPanel] Saving employer profile with media:', { mediaCount: mediaFiles?.length || 0, sample: mediaFiles?.slice(0, 1) });
    setProfileData(newProfileData);
    
    // Notify parent component only after OTP verification has completed
    if (onProfileCreated) {
      await onProfileCreated(newProfileData);
    } else if (typeof onClose === 'function') {
      onClose();
    }
  }, [formData, loginUser?.id, mediaFiles, onClose, onProfileCreated, selectedAccount?.id]);

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
        
        // Close modal and create profile immediately
        setShowOtpModal(false);
        createProfile();
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
  }, [createProfile, modalEmail, otpCode, showOtpModal]);

  useEffect(() => {
    // Only auto-trigger verification when the OTP modal is open and avoid repeating same code
    if (
      showOtpModal &&
      otpCode.length === 6 &&
      !isCheckingOTP &&
      !otpVerified &&
      modalEmail &&
      lastAutoVerifyRef.current !== otpCode
    ) {
      lastAutoVerifyRef.current = otpCode;
      handleVerifyModalOTP();
    }
  }, [showOtpModal, handleVerifyModalOTP, isCheckingOTP, modalEmail, otpCode, otpVerified]);

  const scrollFormToTop = useCallback(() => {
    if (formContentRef.current) {
      formContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (panelRef.current) {
      panelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

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
      scrollFormToTop();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      scrollFormToTop();
    }
  };

  const handlePanelBack = useCallback(() => {
    const backState = getAccountPanelBackState({
      currentStep,
      isEditingProfile,
      viewMode,
      showPremiumPanel: false,
      showPremiumProPanel: false,
      showSubscriptionModal: false,
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
      case 'close-panel':
      default:
        break;
    }

    if (typeof onBack === 'function') {
      onBack();
    } else if (typeof onClose === 'function') {
      onClose();
    }
  }, [currentStep, isEditingProfile, onBack, onClose, viewMode]);

  useEffect(() => {
    pushBackAction(handlePanelBack);
    return () => popBackAction(handlePanelBack);
  }, [handlePanelBack]);

  useEffect(() => {
    // Ensure the active form view resets to top when switching between tabs, steps, and views
    scrollFormToTop();
  }, [activeTab, viewMode, currentStep, scrollFormToTop]);

  return (
    <div className="account-panel-wrapper" onClick={onClose}>
      <div className="account-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        
        {/* Success Message Popup */}
        {showSuccessMessage && (
          <div className="success-message-overlay">
            <div className="success-message-popup">
              <div className="success-icon">✓</div>
              <span>{isEditMode ? 'Profile Updated Successfully!' : 'Profile Created Successfully!'}</span>
            </div>
          </div>
        )}
        
        {/* Edit Company Profile Form */}
        <div className="edit-profile-view">
          <div className="edit-profile-header">
            <div className="edit-profile-title-section">
              <div className="edit-profile-title-wrapper">
                <h2>{isEditMode ? 'Edit Company Profile' : 'Create Company Profile'}</h2>
                <p className="profession-tag">(Employer ~ {professionName})</p>
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
            <div className="progress-bar-container">
              <div className="progress-bar-wrapper">
                <div className="progress-bar-fill" style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}></div>
              </div>
              <div className="progress-percentage">{Math.round((currentStep / TOTAL_STEPS) * 100)}%</div>
              <div className="step-indicators">
                {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map(step => (
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

          {/* Form Content */}
          <div className="edit-form-container">
            {viewMode === 'steps' ? (
              <div className="edit-form-content" ref={formContentRef}>
                {/* STEP 1: Company Basic Information */}
                {currentStep === 1 && (
                  <div className="form-step" data-step="1">
                    <CompanyInformationSection
                      formData={formData}
                      handleInputChange={handleInputChange}
                      handleFieldFocus={handleFieldFocus}
                      handleFieldBlur={handleFieldBlur}
                      handleEmailKeyDown={handleEmailKeyDown}
                      handleEmailBlur={handleEmailBlur}
                      getFieldInputClass={getFieldInputClass}
                      emailSuggestion={emailSuggestion}
                      emailErrorShaking={emailErrorShaking}
                      selectedCountryInfo={selectedCountryInfo}
                      selectedCountryCode={selectedCountryCode}
                      phoneNumberValue={phoneNumberValue}
                      setShowPhoneCountryModal={setShowPhoneCountryModal}
                      showPhoneCountryModal={showPhoneCountryModal}
                      setSelectedCountryCode={setSelectedCountryCode}
                      setSelectedCountryInfo={setSelectedCountryInfo}
                      setFormData={setFormData}
                      setPhoneNumberValue={setPhoneNumberValue}
                      getDigitsOnly={getDigitsOnly}
                      buildWhatsappUrl={buildWhatsappUrl}
                      renderAvatarPreview={renderAvatarPreview}
                      avatarInputRefStep1={avatarInputRefStep1}
                      handleAvatarChange={handleAvatarChange}
                      handlePhoneKeyDown={handlePhoneKeyDown}
                      locationSelector={(
                        <LocationSelector
                          value={formData.location}
                          onChange={(location) => setFormData(prev => ({ ...prev, location }))}
                        />
                      )}
                    />
                  </div>
                )}

                {/* STEP 2: Company Profile */}
                {currentStep === 2 && (
                  <div className="form-step" data-step="2">
                    <CompanyProfileSection
                      formData={formData}
                      handleInputChange={handleInputChange}
                      setFormData={setFormData}
                      showCompanySizeModal={showCompanySizeModal}
                      setShowCompanySizeModal={setShowCompanySizeModal}
                      companySizeOptions={companySizeOptions}
                      showYearFoundedPicker={showYearFoundedPicker}
                      setShowYearFoundedPicker={setShowYearFoundedPicker}
                      formatFoundedValue={formatFoundedValue}
                      yearPicker={(
                        <YearPicker
                          value={formData.founded}
                          onChange={(year) => setFormData(prev => ({ ...prev, founded: year }))}
                          onClose={() => setShowYearFoundedPicker(false)}
                        />
                      )}
                    />
                  </div>
                )}

                {/* STEP 3: Hiring Information */}
                {currentStep === 3 && (
                  <div className="form-step" data-step="3">
                    <HiringInformationSection
                      formData={formData}
                      handleInputChange={handleInputChange}
                    />
                  </div>
                )}

                {/* STEP 4: About Company */}
                {currentStep === 4 && (
                  <div className="form-step" data-step="4">
                    <AboutCompanySection
                      formData={formData}
                      handleInputChange={handleInputChange}
                    />
                  </div>
                )}

                {/* STEP 5: Social Links */}
                {currentStep === 5 && (
                  <div className="form-step" data-step="5">
                    <SocialLinksSection
                      formData={formData}
                      handleInputChange={handleInputChange}
                    />
                  </div>
                )}

                {/* STEP 6: Media */}
                {currentStep === 6 && (
                  <div className="form-step" data-step="6">
                    <div className="edit-form-section">
                      <h3 className="form-section-title">Media</h3>
                      {renderMediaUploadSection()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Full View Form */
              <div className="edit-form-content-full" ref={formContentRef}>
                <CompanyInformationSection
                  formData={formData}
                  handleInputChange={handleInputChange}
                  handleFieldFocus={handleFieldFocus}
                  handleFieldBlur={handleFieldBlur}
                  handleEmailKeyDown={handleEmailKeyDown}
                  handleEmailBlur={handleEmailBlur}
                  getFieldInputClass={getFieldInputClass}
                  emailSuggestion={emailSuggestion}
                  emailErrorShaking={emailErrorShaking}
                  selectedCountryInfo={selectedCountryInfo}
                  selectedCountryCode={selectedCountryCode}
                  phoneNumberValue={phoneNumberValue}
                  setShowPhoneCountryModal={setShowPhoneCountryModal}
                  showPhoneCountryModal={showPhoneCountryModal}
                  setSelectedCountryCode={setSelectedCountryCode}
                  setSelectedCountryInfo={setSelectedCountryInfo}
                  setFormData={setFormData}
                  setPhoneNumberValue={setPhoneNumberValue}
                  getDigitsOnly={getDigitsOnly}
                  buildWhatsappUrl={buildWhatsappUrl}
                  renderAvatarPreview={renderAvatarPreview}
                  avatarInputRefFullView={avatarInputRefFullView}
                  handleAvatarChange={handleAvatarChange}
                  handlePhoneKeyDown={handlePhoneKeyDown}
                  locationSelector={(
                    <LocationSelector
                      value={formData.location}
                      onChange={(location) => setFormData(prev => ({ ...prev, location }))}
                    />
                  )}
                />

                <CompanyProfileSection
                  formData={formData}
                  handleInputChange={handleInputChange}
                  setFormData={setFormData}
                  showCompanySizeModal={showCompanySizeModal}
                  setShowCompanySizeModal={setShowCompanySizeModal}
                  companySizeOptions={companySizeOptions}
                  showYearFoundedPicker={showYearFoundedPicker}
                  setShowYearFoundedPicker={setShowYearFoundedPicker}
                  formatFoundedValue={formatFoundedValue}
                  yearPicker={(
                    <YearPicker
                      value={formData.founded}
                      onChange={(year) => setFormData(prev => ({ ...prev, founded: year }))}
                      onClose={() => setShowYearFoundedPicker(false)}
                    />
                  )}
                />

                <HiringInformationSection
                  formData={formData}
                  handleInputChange={handleInputChange}
                />

                <AboutCompanySection
                  formData={formData}
                  handleInputChange={handleInputChange}
                />

                <SocialLinksSection
                  formData={formData}
                  handleInputChange={handleInputChange}
                />

                <div className="edit-form-section">
                  <h3 className="form-section-title">Media</h3>
                  {renderMediaUploadSection()}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons - Outside the scrollable content */}
          {viewMode === 'steps' && (
            <div className="form-navigation" style={{ marginTop: '0px' }}>
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
                  disabled={(!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) || (Array.isArray(mediaFiles) && mediaFiles.some(f => f && f.uploading === true))}
                  title={(!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) ? "Please fill in all required fields" : (Array.isArray(mediaFiles) && mediaFiles.some(f => f && f.uploading === true) ? 'Waiting for media uploads to complete' : "")}
                  style={{opacity: (!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) ? 0.5 : 1, cursor: (!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) ? 'not-allowed' : 'pointer'}}
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
            <div className="form-navigation form-navigation-full" style={{ marginTop: '0px' }}>
              <div className="form-actions-new">
                <button className="btn-cancel-new" onClick={handleCancel} title="Cancel">
                  <svg fill="currentColor" width="20px" height="20px" viewBox="0 0 36 36" version="1.1" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18,2A16,16,0,1,0,34,18,16,16,0,0,0,18,2ZM4,18A13.93,13.93,0,0,1,7.43,8.85L27.15,28.57A14,14,0,0,1,4,18Zm24.57,9.15L8.85,7.43A14,14,0,0,1,28.57,27.15Z"></path>
                  </svg>
                </button>
                <button 
                  className="btn-save-new" 
                  onClick={handleSaveProfile}
                  disabled={(!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) || (Array.isArray(mediaFiles) && mediaFiles.some(f => f && f.uploading === true))}
                  title={(!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) ? "Please fill in all required fields" : (Array.isArray(mediaFiles) && mediaFiles.some(f => f && f.uploading === true) ? 'Waiting for media uploads to complete' : "")}
                  style={{opacity: (!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) ? 0.5 : 1, cursor: (!formData.name?.trim() || !formData.email?.trim() || !formData.phone?.trim()) ? 'not-allowed' : 'pointer'}}
                >
                  {isEditMode ? 'Update Profile' : 'Create Profile'}
                </button>
              </div>
            </div>
          )}
        </div>

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
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#202c33',
            borderRadius: '12px',
            padding: '12px 24px',
            maxWidth: '400px',
            width: '90%',
            minHeight: '440px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
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
                  {otpVerified ? '✓ Verified' : isCheckingOTP ? 'Verifying...' : 'Verify Code'}
                </button>

          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default EmployerAccountPanel;

