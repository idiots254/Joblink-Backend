import './DetailsPanel.css';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { supabase } from '../supabase';
import { pushBackAction, popBackAction } from '../services/backNavigation';
import { useAuth } from '../contexts/AuthContext';
import { setSecure } from '../services/screenshotControl';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaGlobe, FaUser, FaEnvelope, FaPhone, FaLocationDot, FaDollarSign, FaBriefcase, FaCalendar, FaAward, FaStar, FaArrowLeft, FaXmark, FaHeart, FaXTwitter, FaGithub, FaLinkedin, FaInstagram, FaFacebook, FaTiktok, FaWhatsapp } from 'react-icons/fa6';
import HiringPage from './HiringPage';
import { CalendarIcon } from '../Icons/CalendarIcon';
import { FollowingIcon } from '../Icons/FollowingIcon';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { normalizeProfileMediaFiles } from '../utils/profileMedia';

function DetailsPanel({ profile, profileType, onClose, onToggleFollowing, followingItems, isFromFollowing = false, currentUserProfile = null, onApplyNow = null, onUpdateProfile = null, onToggleLiked = null, likedItems = {} }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [userRating, setUserRating] = useState(0);
  const isCurrentUserProfile = currentUserProfile?.id === profile?.id;
  const [hoverRating, setHoverRating] = useState(0);
  const [submittedRatings, setSubmittedRatings] = useState(profile.userRatings || []);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [floatingHearts, setFloatingHearts] = useState([]);

  const openFollowLikePage = (type) => {
    if (!profile?.id) return;

    try {
      sessionStorage.setItem('joblinkPendingProfileRestore', JSON.stringify({
        profileId: profile.id,
        profile,
      }));
    } catch (error) {
      console.warn('DetailsPanel: failed to persist profile restore state', error);
    }

    navigate(`/profile/${profile.id}/${type}`, {
      state: {
        returnPath: location.pathname || '/home',
        sourceProfile: profile,
      },
    });
  };
  const [showMediaLightbox, setShowMediaLightbox] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const mediaSliderRef = useRef(null);
  const mediaTouchStartXRef = useRef(0);
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const [showHiringPage, setShowHiringPage] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [followingCount, setFollowingCount] = useState(profile?.following_count || 0);
  const [phoneCopyFeedback, setPhoneCopyFeedback] = useState('');
  const [phoneMenuOpen, setPhoneMenuOpen] = useState(false);
  const [phoneMenuPosition, setPhoneMenuPosition] = useState({ top: 0, left: 0 });
  const phoneMenuRef = useRef(null);
  const phoneCopyLockRef = useRef(false);
  const avatarUrl = profile?.avatar_url || profile?.avatar;
  const isLiked = !!likedItems?.[profile?.id];
  const profilePhone = useMemo(() => {
    return profile?.phone
      || profile?.phoneNumber
      || profile?.phone_number
      || profile?.contactPhone
      || profile?.contact_phone
      || profile?.mobile
      || profile?.mobileNumber
      || profile?.mobile_number
      || '';
  }, [profile?.phone, profile?.phoneNumber, profile?.phone_number, profile?.contactPhone, profile?.contact_phone, profile?.mobile, profile?.mobileNumber, profile?.mobile_number]);

  useEffect(() => {
    let mounted = true;

    const loadFollowingCount = async () => {
      if (!profile?.id) {
        if (mounted) setFollowingCount(0);
        return;
      }

      const { count, error } = await supabase
        .from('follows')
        .select('followed_id', { count: 'exact', head: true })
        .eq('follower_id', profile.id);

      if (mounted) {
        setFollowingCount(error ? 0 : count || 0);
      }
    };

    loadFollowingCount();
    return () => { mounted = false; };
  }, [profile?.id]);



  const handleLikeInteraction = useCallback((event) => {
    // Prevent double-clicks from being processed
    if (event?.detail > 1) {
      console.log('[DetailsPanel] Double-click detected, ignoring');
      return;
    }

    console.log('[DetailsPanel] ❤️ Like button clicked');
    
    const currentlyLiked = !!likedItems?.[profile?.id];
    const nextState = !currentlyLiked;
    
    console.log('[DetailsPanel] Current like state:', currentlyLiked, '-> Next state:', nextState, 'profileId:', profile?.id);

    // Create floating heart animation
    const heartId = Date.now() + Math.random();
    const rect = event.currentTarget?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    
    console.log('[DetailsPanel] Creating floating heart at:', x, y);
    setFloatingHearts(prev => [...prev, { id: heartId, x, y }]);
    
    // Remove heart animation after it completes
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== heartId));
    }, 1000);

    if (onToggleLiked && profile?.id) {
      console.log('[DetailsPanel] 📤 Calling onToggleLiked for profile:', profile.id);
      onToggleLiked(profile.id);
    } else {
      console.log('[DetailsPanel] ❌ onToggleLiked not available or profile.id missing');
    }
  }, [likedItems, onToggleLiked, profile?.id]);

  const handleProfileDoubleClick = useCallback((event) => {
    console.log('[DetailsPanel] 🎯 Profile double-clicked');
    
    const currentlyLiked = !!likedItems?.[profile?.id];
    const nextState = !currentlyLiked;
    
    console.log('[DetailsPanel] Double-click like toggle:', currentlyLiked, '→', nextState);

    // Create floating heart animation at click point
    const heartId = Date.now() + Math.random();
    const x = event.clientX;
    const y = event.clientY;
    
    console.log('[DetailsPanel] Creating floating heart at:', x, y);
    setFloatingHearts(prev => [...prev, { id: heartId, x, y }]);
    
    // Remove heart animation after it completes
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== heartId));
    }, 1000);

    if (onToggleLiked && profile?.id) {
      console.log('[DetailsPanel] 📤 Calling onToggleLiked for profile:', profile.id);
      onToggleLiked(profile.id);
    }
  }, [likedItems, onToggleLiked, profile?.id]);

  const lastTapTimeRef = useRef(0);
  const tapCountRef = useRef(0);

  const handleTouchStart = useCallback((event) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    
    console.log('[DetailsPanel] Touch detected - timeSinceLastTap:', timeSinceLastTap);

    // Reset tap count if more than 300ms since last tap
    if (timeSinceLastTap > 300) {
      tapCountRef.current = 0;
    }

    tapCountRef.current += 1;
    lastTapTimeRef.current = now;

    console.log('[DetailsPanel] Tap count:', tapCountRef.current);

    // Trigger like on second tap
    if (tapCountRef.current === 2) {
      console.log('[DetailsPanel] Double-tap detected!');
      tapCountRef.current = 0;
      
      const currentlyLiked = !!likedItems?.[profile?.id];
      const nextState = !currentlyLiked;
      
      console.log('[DetailsPanel] Double-tap like toggle:', currentlyLiked, '→', nextState);

      // Create floating heart animation at touch point
      const heartId = Date.now() + Math.random();
      const touch = event.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;
      
      console.log('[DetailsPanel] Creating floating heart at:', x, y);
      setFloatingHearts(prev => [...prev, { id: heartId, x, y }]);
      
      // Remove heart animation after it completes
      setTimeout(() => {
        setFloatingHearts(prev => prev.filter(h => h.id !== heartId));
      }, 1000);

      if (onToggleLiked && profile?.id) {
        console.log('[DetailsPanel] 📤 Calling onToggleLiked for profile:', profile.id);
        onToggleLiked(profile.id);
      }
    }
  }, [likedItems, onToggleLiked, profile?.id]);

  useEffect(() => {
    const handleBackAction = () => {
      if (showMediaLightbox) {
        setShowMediaLightbox(false);
        return;
      }

      if (showAvatarLightbox) {
        setShowAvatarLightbox(false);
        return;
      }

      if (showRatingModal) {
        setShowRatingModal(false);
        return;
      }

      if (showHiringPage) {
        setShowHiringPage(false);
        return;
      }

      onClose();
    };

    pushBackAction(handleBackAction);
    return () => popBackAction(handleBackAction);
  }, [showMediaLightbox, showAvatarLightbox, showRatingModal, showHiringPage, onClose]);
  const viewedProfilesRef = useRef(new Set());

  // Apply screenshot protection based on viewed profile's setting
  useEffect(() => {
    let mounted = true;
    const applyScreenshotProtection = async () => {
      if (!profile?.id) return;

      try {
        console.log('🔍 DetailsPanel: Checking screenshot protection for profile:', profile.id);
        
        // Fetch the viewed profile's allow_screenshots setting from Supabase
        const { data, error } = await supabase
          .from('profiles')
          .select('allow_screenshots')
          .eq('id', profile.id)
          .single();

        console.log('📊 DetailsPanel: Supabase response:', { data, error });

        if (error || !data) {
          console.warn('❌ DetailsPanel: Failed to fetch profile screenshot setting:', error);
          // Default to allowing screenshots if we can't get the setting
          if (mounted) {
            console.log('🟢 DetailsPanel: Defaulting to allow (setSecure=false)');
            await setSecure(false);
          }
          return;
        }

        console.log('✅ DetailsPanel: Retrieved allow_screenshots =', data.allow_screenshots);

        // allow_screenshots = true means user wants to allow screenshots (don't block)
        // allow_screenshots = false means user wants to protect their profile (block)
        const shouldBlockScreenshots = !data.allow_screenshots;
        console.log('🚫 DetailsPanel: shouldBlockScreenshots =', shouldBlockScreenshots, '(setSecure will be called with:', shouldBlockScreenshots, ')');
        
        if (mounted) {
          await setSecure(shouldBlockScreenshots);
          console.log('✅ DetailsPanel: Screenshot protection applied. Blocking:', shouldBlockScreenshots);
        }
      } catch (e) {
        console.warn('❌ DetailsPanel: Failed to apply screenshot protection:', e);
        // Default to allowing screenshots for safety
        if (mounted) {
          console.log('🟢 DetailsPanel: Error occurred, defaulting to allow (setSecure=false)');
          await setSecure(false);
        }
      }
    };

    applyScreenshotProtection();

    return () => { mounted = false; };
  }, [profile?.id]);

  // Revert screenshot setting when closing DetailsPanel
  const handleClosePanel = useCallback(async () => {
    try {
      // Restore user's own preference
      if (window.getCurrentUserProfile) {
        const userProfile = await window.getCurrentUserProfile();
        const userAllowsScreenshots = userProfile?.allow_screenshots === true;
        await setSecure(!userAllowsScreenshots);
      } else {
        // Default to blocking if we can't fetch user profile
        await setSecure(true);
      }
    } catch (e) {
      console.warn('Failed to restore screenshot setting on panel close:', e);
    }
    onClose();
  }, [onClose]);

  // Detect profile type from data if not explicitly provided
  const detectedType = profileType || profile.cardType || (profile.employmentType ? 'job-ad' : (profile.title && profile.skills ? 'worker' : 'employer'));
  
  // Debug: log profile prop changes to verify follower counts
  useEffect(() => {
    try {
      console.log('[DetailsPanel] profile prop changed:', { id: profile?.id, followers: profile?.followers, like_count: profile?.like_count });
    } catch (e) {
      // ignore
    }
  }, [profile?.id, profile?.followers, profile?.like_count]);
  
  // Check if this profile is already being followed
  const isFollowing = followingItems?.[profile.id] || false;

  // Helper function to convert to proper case
  const toProperCase = (str) => {
    if (!str) return 'N/A';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get initials from name for avatar placeholder
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

  // Generate professional solid color for avatar placeholder
  const getAvatarColor = (name) => {
    const colors = [
      '#FF5722', '#F44336', '#E91E63', '#9C27B0', '#673AB7',
      '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50',
      '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF6F00'
    ];
    let hash = 0;
    if (!name) return colors[0];
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Get a consistent bio string to show in detail panels
  const profileBio = profile.bio || profile.description || 'Bio not available yet.';

  const copyPhoneNumber = useCallback(async (phoneNumber) => {
    if (!phoneNumber) return;

    const cleanedPhoneNumber = String(phoneNumber).trim();
    if (!cleanedPhoneNumber) return;

    const fallbackCopy = () => {
      return new Promise((resolve) => {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = cleanedPhoneNumber;
        tempTextArea.setAttribute('readonly', '');
        tempTextArea.style.position = 'fixed';
        tempTextArea.style.top = '-9999px';
        tempTextArea.style.left = '-9999px';
        tempTextArea.style.opacity = '0';
        document.body.appendChild(tempTextArea);

        window.setTimeout(() => {
          tempTextArea.focus();
          tempTextArea.select();
          tempTextArea.setSelectionRange(0, cleanedPhoneNumber.length);
          const didCopy = document.execCommand('copy');
          document.body.removeChild(tempTextArea);
          resolve(Boolean(didCopy));
        }, 0);
      });
    };

    try {
      let copied = false;

      if (Capacitor.isNativePlatform() && typeof Clipboard?.write === 'function') {
        try {
          await Clipboard.write({ string: cleanedPhoneNumber });
          copied = true;
        } catch (nativeError) {
          console.warn('[DetailsPanel] Capacitor clipboard write failed, trying browser fallback:', nativeError);
        }
      }

      if (!copied && typeof navigator?.clipboard?.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(cleanedPhoneNumber);
          copied = true;
        } catch (browserError) {
          console.warn('[DetailsPanel] Browser clipboard write failed, trying fallback:', browserError);
        }
      }

      if (!copied) {
        copied = await fallbackCopy();
      }

      if (!copied) {
        throw new Error('Clipboard write did not complete');
      }

      setPhoneCopyFeedback('Copied to Clipboard');
      window.setTimeout(() => setPhoneCopyFeedback(''), 1600);
    } catch (error) {
      console.warn('[DetailsPanel] Failed to copy phone number:', error);
      setPhoneCopyFeedback('Copy failed');
      window.setTimeout(() => setPhoneCopyFeedback(''), 1600);
    }
  }, []);

  const handlePhoneCopyInteraction = useCallback((event, phoneNumber) => {
    if (!phoneNumber) return;

    if (event?.type === 'touchstart' || event?.type === 'touchend' || event?.type === 'pointerdown' || event?.type === 'pointerup' || event?.type === 'mousedown') {
      event.preventDefault();
      event.stopPropagation();
    }

    if (phoneCopyLockRef.current) return;

    phoneCopyLockRef.current = true;
    window.setTimeout(() => {
      phoneCopyLockRef.current = false;
    }, 700);

    copyPhoneNumber(phoneNumber);
  }, [copyPhoneNumber]);

  const openPhoneActionMenu = useCallback((event, phoneNumber) => {
    if (!phoneNumber) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget?.getBoundingClientRect();
    setPhoneMenuPosition({
      top: (rect?.top ?? 0) - 24,
      left: rect?.right + 4 || 0,
    });
    setPhoneMenuOpen(true);
  }, []);

  const closePhoneMenu = useCallback(() => {
    setPhoneMenuOpen(false);
  }, []);

  const handlePhoneCall = useCallback(() => {
    if (!profilePhone) return;
    const callPhone = String(profilePhone).trim().replace(/[^\d+]/g, '');
    closePhoneMenu();
    const callUrl = `tel:${callPhone}`;
    try {
      window.open(callUrl, '_system');
    } catch (error) {
      window.location.href = callUrl;
    }
  }, [profilePhone, closePhoneMenu]);

  const handlePhoneCopy = useCallback(() => {
    if (!profilePhone) return;
    copyPhoneNumber(profilePhone);
    closePhoneMenu();
  }, [profilePhone, copyPhoneNumber]);

  const handlePhoneMessage = useCallback(() => {
    if (!profilePhone) return;
    window.location.href = `sms:${profilePhone}`;
    closePhoneMenu();
  }, [profilePhone]);

  const handlePhoneWhatsApp = useCallback(() => {
    if (!profilePhone) return;
    const cleanedPhone = String(profilePhone).replace(/\D/g, '');
    closePhoneMenu();
    const whatsappUrl = `https://wa.me/${cleanedPhone}`;
    try {
      window.open(whatsappUrl, '_system');
    } catch (error) {
      window.location.href = whatsappUrl;
    }
  }, [profilePhone, closePhoneMenu]);

  const handlePhoneShare = useCallback(() => {
    if (!profilePhone) return;
    if (typeof navigator?.share === 'function') {
      navigator.share({
        title: 'Phone Number',
        text: profilePhone,
      }).catch(() => {});
    }
    closePhoneMenu();
  }, [profilePhone]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (phoneMenuRef.current && !phoneMenuRef.current.contains(e.target)) {
        closePhoneMenu();
      }
    };

    if (phoneMenuOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
      return () => document.removeEventListener('pointerdown', handleClickOutside);
    }
  }, [phoneMenuOpen, closePhoneMenu]);

  useEffect(() => {
    if (!phoneMenuOpen || !phoneMenuRef.current) return;

    const menuRect = phoneMenuRef.current.getBoundingClientRect();
    const viewportPadding = 8;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - menuRect.width - viewportPadding);
    const maxTop = Math.max(viewportPadding, window.innerHeight - menuRect.height - viewportPadding);
    const nextLeft = Math.min(Math.max(phoneMenuPosition.left, viewportPadding), maxLeft);
    const nextTop = Math.min(Math.max(phoneMenuPosition.top, viewportPadding), maxTop);

    if (nextLeft !== phoneMenuPosition.left || nextTop !== phoneMenuPosition.top) {
      setPhoneMenuPosition({ top: nextTop, left: nextLeft });
    }
  }, [phoneMenuOpen, phoneMenuPosition]);

  const profileMedia = useMemo(() => normalizeProfileMediaFiles(profile), [profile]);

  const getMediaUrl = (item) => {
    return resolveMediaUrl(item);
  };

  const getMediaTitle = (item) => {
    return item.name || item.title || item.caption || 'Media';
  };

  const getMediaCaption = (item) => {
    return item.caption || item.title || '';
  };

  const getMediaThumbnailUrl = (item) => {
    if (!item) return '';
    const candidate = item.preview || item.thumbnail || item.poster || item.videoThumbnailUrl || item.previewUrl;
    if (candidate) return candidate;
    const url = getMediaUrl(item);
    if (isVideoFile(url, item)) return '';
    return url;
  };

  // Normalize social/profile URLs so they open the real platforms
  const ensureProtocol = (url) => {
    if (!url) return null;
    const trimmed = String(url).trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const getSocialUrl = (platform, value) => {
    if (!value) return null;
    let v = String(value).trim();

    // If the value already looks like a full URL, ensure it has a protocol and return
    if (/^https?:\/\//i.test(v) || /^mailto:/i.test(v) || /^tel:/i.test(v)) {
      return v;
    }

    // Remove leading @ or slashes
    v = v.replace(/^@+/, '').replace(/^\/+/, '');

    switch ((platform || '').toLowerCase()) {
      case 'github':
        if (v.toLowerCase().includes('github.com')) return ensureProtocol(v);
        return `https://github.com/${encodeURIComponent(v)}`;
      case 'linkedin':
        if (v.toLowerCase().includes('linkedin.com')) return ensureProtocol(v);
        // common LinkedIn username form
        return `https://www.linkedin.com/in/${encodeURIComponent(v)}`;
      case 'twitter':
      case 'x':
        if (v.toLowerCase().includes('twitter.com') || v.toLowerCase().includes('x.com')) return ensureProtocol(v);
        return `https://x.com/${encodeURIComponent(v)}`;
      case 'instagram':
        if (v.toLowerCase().includes('instagram.com')) return ensureProtocol(v);
        return `https://www.instagram.com/${encodeURIComponent(v)}`;
      case 'facebook':
        if (v.toLowerCase().includes('facebook.com')) return ensureProtocol(v);
        return `https://www.facebook.com/${encodeURIComponent(v)}`;
      case 'tiktok':
        if (v.toLowerCase().includes('tiktok.com')) return ensureProtocol(v);
        // TikTok profiles often use @username
        return `https://www.tiktok.com/@${encodeURIComponent(v)}`;
      case 'whatsapp':
        // If it's a phone number, create a wa.me link
        if (/^\+?\d[\d\s()-]{3,}$/.test(v)) {
          const digits = v.replace(/[^\d]/g, '');
          return `https://wa.me/${digits}`;
        }
        if (v.toLowerCase().includes('wa.me') || v.toLowerCase().includes('whatsapp.com')) return ensureProtocol(v);
        return `https://wa.me/${encodeURIComponent(v)}`;
      case 'website':
      case 'portfolio':
      default:
        return ensureProtocol(v);
    }
  };

  // Open external URLs using Capacitor Browser when available, otherwise fallback to window.open
  const openExternal = async (url) => {
    if (!url) return;
    const safeUrl = String(url).trim();
    try {
      const mod = await import('@capacitor/browser');
      if (mod && mod.Browser && typeof mod.Browser.open === 'function') {
        await mod.Browser.open({ url: safeUrl });
        return;
      }
    } catch (e) {
      // ignore and fallback
    }

    try {
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      // last resort
      window.location.href = safeUrl;
    }
  };

  const isPdfFile = (filepath, item) => {
    if (item?.type === 'application/pdf') return true;
    if (!filepath) return false;
    return filepath.toLowerCase().endsWith('.pdf');
  };

  const isVideoFile = (filepath, item) => {
    if (item?.type?.startsWith('video')) return true;
    if (!filepath) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    return videoExtensions.some(ext => filepath.toLowerCase().endsWith(ext));
  };

  // Handle rating submission
  const handleSubmitRating = () => {
    if (userRating === 0) {
      alert('Please select a rating');
      return;
    }
    
    const newRating = {
      rating: userRating,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setSubmittedRatings([...submittedRatings, newRating]);
    setUserRating(0);
    setShowRatingModal(false);
    alert('Rating submitted successfully!');
  };

  // Handle media lightbox
  const handleMediaClick = (index) => {
    setSelectedMediaIndex(index);
    setShowMediaLightbox(true);
  };

  const pauseAllLightboxVideos = useCallback(() => {
    if (!mediaSliderRef.current) return;
    const videos = mediaSliderRef.current.querySelectorAll('video');
    videos.forEach((video) => {
      video.pause();
    });
  }, []);

  useEffect(() => {
    if (activeTab !== 'media') {
      setSelectedMediaIndex(0);
      setShowMediaLightbox(false);
    }
  }, [activeTab]);

  

  // Handle keyboard navigation for lightbox
  const handlePreviousMediaCb = useCallback(() => {
    if (!profileMedia || profileMedia.length === 0) return;
    setSelectedMediaIndex((prev) => prev === 0 ? profileMedia.length - 1 : prev - 1);
  }, [profileMedia]);

  const handleNextMediaCb = useCallback(() => {
    if (!profileMedia || profileMedia.length === 0) return;
    setSelectedMediaIndex((prev) => prev === profileMedia.length - 1 ? 0 : prev + 1);
  }, [profileMedia]);

  const handleMediaTouchStart = useCallback((event) => {
    if (event.touches?.length > 0) {
      mediaTouchStartXRef.current = event.touches[0].clientX;
    }
  }, []);

  const handleMediaTouchEnd = useCallback((event) => {
    if (!event.changedTouches?.length) return;
    const touchEndX = event.changedTouches[0].clientX;
    const diff = touchEndX - mediaTouchStartXRef.current;
    const swipeThreshold = 50;

    if (Math.abs(diff) < swipeThreshold) return;
    if (diff < 0) {
      handleNextMediaCb();
    } else {
      handlePreviousMediaCb();
    }
  }, [handleNextMediaCb, handlePreviousMediaCb]);

  useEffect(() => {
    if (!showMediaLightbox) return;

    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousMediaCb();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextMediaCb();
      } else if (e.key === 'Escape') {
        setShowMediaLightbox(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showMediaLightbox, handlePreviousMediaCb, handleNextMediaCb]);

  useEffect(() => {
    if (!showMediaLightbox || !mediaSliderRef.current) return;
    const el = mediaSliderRef.current;
    const width = el.clientWidth || window.innerWidth;
    el.scrollTo({ left: selectedMediaIndex * width, behavior: 'smooth' });
  }, [showMediaLightbox, selectedMediaIndex]);

  useEffect(() => {
    if (!showMediaLightbox) {
      pauseAllLightboxVideos();
      return;
    }

    const slider = mediaSliderRef.current;
    if (!slider) return;

    const activeVideo = slider.querySelector('.media-slide-dt.active video');
    const otherVideos = slider.querySelectorAll('.media-slide-dt:not(.active) video');

    otherVideos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });

    if (activeVideo) {
      activeVideo.currentTime = 0;
      activeVideo.play().catch(() => {});
    }
  }, [showMediaLightbox, selectedMediaIndex, pauseAllLightboxVideos, profileMedia]);

  useEffect(() => {
    if (!showAvatarLightbox) return;

    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        setShowAvatarLightbox(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showAvatarLightbox]);

  const handleAvatarClick = () => {
    setShowAvatarLightbox(true);
  };

  // Handle Escape key for rating modal
  useEffect(() => {
    if (!showRatingModal) return;

    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        setShowRatingModal(false);
        setUserRating(0);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showRatingModal]);

  // Handle Apply Now button click - wrapped in useCallback
  const handleApplyNow = useCallback(() => {
    console.log('Apply Now clicked for:', profile.title);
    if (onApplyNow) {
      onApplyNow(profile);
    }
  }, [profile, onApplyNow]);

  const { user } = useAuth();

  // Record a profile view when the details panel is opened for a profile
  useEffect(() => {
    if (!profile || !profile.id) return;

    // Prevent duplicate recording in the same open session
    if (viewedProfilesRef.current.has(profile.id)) {
      return;
    }
    viewedProfilesRef.current.add(profile.id);

    const recordView = async () => {
      try {
        if (user && String(user.id) === String(profile.id)) return;

        if (user) {
          const payload = {
            viewer_id: user.id,
            viewed_profile_id: profile.id,
          };

          const { error } = await supabase
            .from('profile_views')
            .upsert([payload], {
              onConflict: 'viewer_id,viewed_profile_id',
              ignoreDuplicates: true,
              returning: 'minimal',
            });

          if (error && error.code !== '23505') {
            const message = String(error.message || '').toLowerCase();
            if (!message.includes('duplicate') && !message.includes('already exists')) {
              console.warn('Failed to record profile view', error);
            }
          }
        } else {
          const { error } = await supabase.from('profile_views').insert({
            viewed_profile_id: profile.id,
          });

          if (error && error.code !== '23505') {
            const message = String(error.message || '').toLowerCase();
            if (!message.includes('duplicate') && !message.includes('already exists')) {
              console.warn('Failed to record anonymous profile view', error);
            }
          }
        }
      } catch (e) {
        console.warn('Error recording profile view', e);
      }
    };

    recordView();
  }, [profile, user]);

  // Handle swipe gestures for tab navigation
  useEffect(() => {
    if (showMediaLightbox) return undefined;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let swipeValid = true;

    const handleTouchStart = (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
      swipeValid = true;
    };

    const handleTouchMove = (e) => {
      const moveX = e.changedTouches[0].screenX - touchStartX;
      const moveY = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(moveY) > 75 || Math.abs(moveY) > Math.abs(moveX)) {
        swipeValid = false;
      }
    };

    const handleTouchEnd = (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      if (swipeValid) handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 100;
      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;
      if (Math.abs(diffX) < swipeThreshold) return;
      if (Math.abs(diffY) > Math.abs(diffX) * 0.5) return;

      const workerTabs = ['basic', 'professional', 'work', 'portfolio', 'media'];
      const jobTabs = ['basic', 'professional', 'work', 'portfolio'];
      const tabs = detectedType === 'job-ad' ? jobTabs : workerTabs;
      const currentIndex = tabs.indexOf(activeTab);

      if (diffX > swipeThreshold && currentIndex < tabs.length - 1) {
        // Swipe left - next tab
        setActiveTab(tabs[currentIndex + 1]);
      } else if (diffX < -swipeThreshold && currentIndex > 0) {
        // Swipe right - previous tab
        setActiveTab(tabs[currentIndex - 1]);
      }
    };

    const panelElement = document.querySelector('.details-panel-dt');
    if (panelElement) {
      panelElement.addEventListener('touchstart', handleTouchStart, false);
      panelElement.addEventListener('touchmove', handleTouchMove, false);
      panelElement.addEventListener('touchend', handleTouchEnd, false);

      return () => {
        panelElement.removeEventListener('touchstart', handleTouchStart, false);
        panelElement.removeEventListener('touchmove', handleTouchMove, false);
        panelElement.removeEventListener('touchend', handleTouchEnd, false);
      };
    }
  }, [activeTab, detectedType, showMediaLightbox]);

  const handleBackdropClick = useCallback((event) => {
    if (event.target === event.currentTarget) {
      handleClosePanel();
    }
  }, [handleClosePanel]);

  return (
    <div className="details-panel-wrapper-dt" onClick={handleBackdropClick}>
      <div
        className={`details-panel-dt ${detectedType === 'job-ad' ? 'job-ad-dt' : 'worker-dt'}${showAvatarLightbox ? ' avatar-lightbox-active' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={handleProfileDoubleClick}
        onTouchStart={handleTouchStart}
      >
        {/* Floating Hearts Container */}
        <div className="floating-hearts-container-dt">
          {floatingHearts.map(heart => (
            <div
              key={heart.id}
              className="floating-heart-dt"
              style={{
                left: `${heart.x}px`,
                top: `${heart.y}px`,
              }}
            >
              ❤️
            </div>
          ))}
        </div>

        {/* Display job posting or worker profile */}
        {detectedType === 'job-ad' ? (
          <>
            {/* Back Button */}
            <button className="back-arrow-btn-dt" onClick={handleClosePanel} aria-label="Go back">
              <FaArrowLeft />
            </button>
            
            {/* Close Button */}
            <button className="close-panel-btn-dt" onClick={handleClosePanel} aria-label="Close panel">
              <FaXmark />
            </button>
            
            {/* Job Posting Header */}
            <div className="details-header-premium-dt">
              <div className="header-inner-dt">
                <div className="avatar-section-dt">
                  <div className="avatar-wrapper-dt" onClick={handleAvatarClick} role="button" tabIndex={0} onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAvatarClick(); }}>
                    {avatarUrl && !avatarError ? (
                      <img 
                        src={avatarUrl} 
                        alt={profile.name} 
                        className="panel-avatar-dt"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <div 
                        className="avatar-placeholder-dt"
                        style={{ backgroundColor: getAvatarColor(profile.name) }}
                      >
                        <span className="avatar-initials-dt">{getInitials(profile.name)}</span>
                      </div>
                    )}
                    <div className="status-indicator-dt"></div>
                  </div>
                </div>
                <div className="profile-section-dt">
                  <h2 className="profile-name-dt">{profile.title}</h2>
                  <p className="profile-email-dt">{profile.name}</p>
                  <p className="profile-title-dt">{profile.employmentType || 'Full-time'}</p>
                </div>
              </div>
            </div>

            {/* Stats Section - Separate Full Width */}
            <div className="header-stats-dt">
              <span className="header-stat-label-dt">Salary</span>
              <span className="header-stat-value-dt">{profile.salary || 'Negotiable'}</span>
              <span className="header-divider-dt">|</span>
              <span className="header-stat-label-dt">Level</span>
              <span className="header-stat-value-dt">{profile.experienceLevel || 'N/A'}</span>
              <span className="header-divider-dt">|</span>
              <span className="header-stat-label-dt">Location</span>
              <span className="header-stat-value-dt">{profile.location}</span>
              <span className="header-divider-dt">|</span>
              <span className="header-stat-label-dt">Likes</span>
              <button
                type="button"
                className="header-stat-value-dt header-stat-button-dt"
                onClick={() => openFollowLikePage('likes')}
              >
                {Number(profile?.like_count || 0)}
              </button>
            </div>

            {/* Bio Section - Separate Full Width */}
            <div className="profile-bio-section-dt">{profileBio}</div>

            {/* Tab Navigation for Job Posting */}
            <div className="tab-navigation-dt">
              <button 
                className={`tab-btn-dt ${activeTab === 'basic' ? 'active' : ''}`}
                onClick={() => setActiveTab('basic')}
              >
                Position
              </button>
              <button 
                className={`tab-btn-dt ${activeTab === 'professional' ? 'active' : ''}`}
                onClick={() => setActiveTab('professional')}
              >
                Skills
              </button>
              <button 
                className={`tab-btn-dt ${activeTab === 'work' ? 'active' : ''}`}
                onClick={() => setActiveTab('work')}
              >
                Company
              </button>
              <button 
                className={`tab-btn-dt ${activeTab === 'portfolio' ? 'active' : ''}`}
                onClick={() => setActiveTab('portfolio')}
              >
                Details
              </button>
            </div>

            {/* Tab Content for Job Posting */}
            <div className="details-content-dt">
              {/* POSITION DETAILS TAB */}
              {activeTab === 'basic' && (
                <div className="tab-content-grid-dt">
                  <div className="info-section-dt">
                    <div className="info-item-dt">
                      <FaBriefcase className="item-icon-dt" />
                      <div className="info-label-dt">
                        <span>Position Title</span>
                        <span>{profile.title}</span>
                      </div>
                    </div>
                    <div className="info-item-dt">
                      <FaDollarSign className="item-icon-dt" />
                      <div className="info-label-dt">
                        <span>Salary</span>
                        <span>{profile.salary || 'Negotiable'}</span>
                      </div>
                    </div>
                    <div className="info-item-dt">
                      <FaAward className="item-icon-dt" />
                      <div className="info-label-dt">
                        <span>Experience Level</span>
                        <span>{profile.experienceLevel || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="info-item-dt">
                      <FaLocationDot className="item-icon-dt" />
                      <div className="info-label-dt">
                        <span>Location</span>
                        <span>{profile.jobLocation || profile.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="info-section-dt">
                    <div className="info-item-dt">
                      <FaBriefcase className="item-icon-dt" />
                      <div className="info-label-dt">
                        <span>Employment Type</span>
                        <span>{profile.employmentType || 'Full-time'}</span>
                      </div>
                    </div>
                    <div className="info-item-dt">
                      <FaCalendar className="item-icon-dt" />
                      <div className="info-label-dt">
                        <span>Posted Date</span>
                        <span>{profile.postedDate ? new Date(profile.postedDate).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                    <div className="info-item-dt">
                      <FaCalendar className="item-icon-dt" />
                      <div className="info-label-dt">
                        <span>Deadline</span>
                        <span>{profile.applicationDeadline ? new Date(profile.applicationDeadline).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* About the Role Section */}
              {activeTab === 'basic' && (
                <div className="tab-content-grid-dt" style={{ marginTop: '16px' }}>
                  <div className="info-section-dt full-width-section-dt">
                    <div className="about-section-dt">
                      <h3>About This Role</h3>
                      <p className="about-text-dt">{profile.description || profile.bio}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Responsibilities Section */}
              {activeTab === 'basic' && profile.responsibilities && (
                <div className="tab-content-grid-dt" style={{ marginTop: '16px' }}>
                  <div className="info-section-dt full-width-section-dt">
                    <div className="about-section-dt">
                      <h3>Key Responsibilities</h3>
                      <ul className="job-list-dt">
                        {profile.responsibilities.split(',').map((resp, idx) => (
                          <li key={idx}>{resp.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* SKILLS TAB */}
              {activeTab === 'professional' && (
                <div className="tab-content-grid-dt">
                  <div className="info-section-dt">
                    <h3 style={{ margin: '0 0 12px 0' }}>Required Technical Skills</h3>
                    {profile.skills && profile.skills.length > 0 ? (
                      <div className="skills-grid-dt">
                        {profile.skills.map((skill, idx) => (
                          <div key={idx} className="skill-tag-dt">✓ {skill}</div>
                        ))}
                      </div>
                    ) : (
                      <p className="info-label-dt" style={{ margin: 0, paddingLeft: 0, color: 'var(--text-secondary)' }}>No skills listed yet.</p>
                    )}
                  </div>

                  <div className="info-section-dt">
                    <h3 style={{ margin: '0 0 12px 0' }}>Certifications</h3>
                    <div className="certifications-value-dt">
                      {((profile.certifications || profile.credentials) && (Array.isArray(profile.certifications || profile.credentials)
                        ? (profile.certifications || profile.credentials).length > 0
                        : String(profile.certifications || profile.credentials).trim().length > 0)) ? (
                          Array.isArray(profile.certifications || profile.credentials)
                            ? (profile.certifications || profile.credentials).map((cert, idx) => (
                                <span key={idx}>
                                  {idx > 0 && <span className="certification-separator-dt">|</span>}
                                  <span className="certification-item-dt">{cert}</span>
                                </span>
                              ))
                            : String(profile.certifications || profile.credentials)
                        ) : (
                          <p className="info-label-dt" style={{ margin: 0, paddingLeft: 0, color: 'var(--text-secondary)' }}>No certifications listed yet.</p>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* Requirements Section */}
              {activeTab === 'professional' && profile.requirements && (
                <div className="tab-content-grid-dt" style={{ marginTop: '16px' }}>
                  <div className="info-section-dt full-width-section-dt">
                    <div className="about-section-dt">
                      <h3>Core Requirements</h3>
                      <ul className="job-list-dt">
                        {profile.requirements.split(',').map((req, idx) => (
                          <li key={idx}>{req.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Desired Qualifications Section */}
              {activeTab === 'professional' && profile.desiredQualifications && (
                <div className="tab-content-grid-dt" style={{ marginTop: '16px' }}>
                  <div className="info-section-dt full-width-section-dt">
                    <div className="about-section-dt">
                      <h3>Desired Qualifications</h3>
                      <ul className="job-list-dt">
                        {profile.desiredQualifications.split(',').map((qual, idx) => (
                          <li key={idx}>{qual.trim()}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* COMPANY TAB */}
              {activeTab === 'work' && (
                <div className="tab-content-grid-dt">
                  <div className="info-section-dt">
                    <div className="info-item-dt">
                      <FaBriefcase className="item-icon-dt" />
                      <div className="info-label-dt">
                        <span>Company Name</span>
                        <span>{profile.name}</span>
                      </div>
                    </div>
                    {profile.industry && (
                      <div className="info-item-dt">
                        <FaAward className="item-icon-dt" />
                        <div className="info-label-dt">
                          <span>Industry</span>
                          <span>{profile.industry}</span>
                        </div>
                      </div>
                    )}
                    {profile.companySize && (
                      <div className="info-item-dt">
                        <FaUser className="item-icon-dt" />
                        <div className="info-label-dt">
                          <span>Company Size</span>
                          <span>{profile.companySize}</span>
                        </div>
                      </div>
                    )}
                    {profile.hiringManager && (
                      <div className="info-item-dt">
                        <FaUser className="item-icon-dt" />
                        <div className="info-label-dt">
                          <span>Hiring Manager</span>
                          <span>{profile.hiringManager}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="info-section-dt">
                    {profile.website && (
                      <div className="info-item-dt">
                        <FaGlobe className="item-icon-dt" />
                        <div className="info-label-dt">
                          <span>Website</span>
                          <a href={getSocialUrl('website', profile.website)} onClick={(e) => { e.preventDefault(); openExternal(getSocialUrl('website', profile.website)); }} target="_blank" rel="noopener noreferrer" className="info-link-dt">{profile.website}</a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Company Culture Section */}
              {activeTab === 'work' && profile.culture && (
                <div className="tab-content-grid-dt" style={{ marginTop: '16px' }}>
                  <div className="info-section-dt full-width-section-dt">
                    <div className="about-section-dt">
                      <h3>Company Culture</h3>
                      <p className="about-text-dt">{profile.culture}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Benefits Section */}
              {activeTab === 'work' && profile.benefits && (
                <div className="tab-content-grid-dt" style={{ marginTop: '16px' }}>
                  <div className="info-section-dt full-width-section-dt">
                    <div className="about-section-dt">
                      <h3>Benefits & Perks</h3>
                      <p className="about-text-dt">{profile.benefits}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* DETAILS TAB */}
              {activeTab === 'portfolio' && (
                <div className="tab-content-grid-dt">
                  <div className="info-section-dt">
                    <div className="info-item-dt">
                      <FaEnvelope className="item-icon-dt" />
                      <div className="info-label-dt">
                        <span>Email</span>
                        <a href={`mailto:${profile.email}`} className="info-link-dt">{profile.email}</a>
                      </div>
                    </div>
                    {profilePhone && (
                      <div className="info-item-dt">
                        <FaPhone className="item-icon-dt" />
                        <div className="info-label-dt">
                          <span>Phone</span>
                          <button
                            type="button"
                            className="info-phone-copy-dt"
                            onClick={(event) => openPhoneActionMenu(event, profilePhone)}
                            onPointerDown={(event) => openPhoneActionMenu(event, profilePhone)}
                            onTouchStart={(event) => openPhoneActionMenu(event, profilePhone)}
                            onContextMenu={(event) => openPhoneActionMenu(event, profilePhone)}
                            title="Tap for phone actions"
                            aria-label={`Phone actions for ${profilePhone}`}
                          >
                            <span>{profilePhone}</span>
                            {phoneCopyFeedback && (
                              <span className="phone-copy-feedback-dt">
                                <svg
                                  className="phone-copy-feedback-icon-dt"
                                  fill="currentColor"
                                  viewBox="-3.5 0 19 19"
                                  xmlns="http://www.w3.org/2000/svg"
                                  aria-hidden="true"
                                >
                                  <path d="M4.63 15.638a1.028 1.028 0 0 1-.79-.37L.36 11.09a1.03 1.03 0 1 1 1.58-1.316l2.535 3.043L9.958 3.32a1.029 1.029 0 0 1 1.783 1.03L5.52 15.122a1.03 1.03 0 0 1-.803.511.89.89 0 0 1-.088.004z" />
                                </svg>
                                <span>{phoneCopyFeedback}</span>
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="info-section-dt">
                    {profile.website && (
                      <div className="info-item-dt">
                        <FaGlobe className="item-icon-dt" />
                        <div className="info-label-dt">
                          <span>Website</span>
                          <a href={getSocialUrl('website', profile.website)} onClick={(e) => { e.preventDefault(); openExternal(getSocialUrl('website', profile.website)); }} target="_blank" rel="noopener noreferrer" className="info-link-dt">{profile.website}</a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Apply Button */}
            <div className="cta-footer-dt">
              {!isCurrentUserProfile && (
                <button
                  type="button"
                  className={`btn-like-dt ${isLiked ? 'liked-dt' : ''}`}
                  onClick={handleLikeInteraction}
                  onPointerDown={() => console.log('[DetailsPanel JOB] PointerDown on like button')}
                  onTouchStart={() => console.log('[DetailsPanel JOB] TouchStart on like button')}
                  onMouseDown={() => console.log('[DetailsPanel JOB] MouseDown on like button')}
                  aria-pressed={isLiked}
                  title={isLiked ? 'Unlike this profile' : 'Like this profile'}
                >
                  <FaHeart /> {isLiked ? 'Liked' : 'Like'}
                </button>
              )}
              {!isCurrentUserProfile && <button type="button" className="btn-secondary-dt"><FaEnvelope /> Message</button>}
              <button 
                type="button"
                className="btn-primary-dt"
                onClick={() => isCurrentUserProfile ? onUpdateProfile?.(profile) : handleApplyNow()}
                title={isCurrentUserProfile ? 'Update your profile' : 'Apply now for this job'}
              >
                {isCurrentUserProfile ? 'Update' : <><FaBriefcase /> Apply Now</>}
              </button>
              {!isCurrentUserProfile && (
                <button 
                  type="button"
                  className={`btn-follow-dt ${isFollowing ? 'following-dt' : ''}`}
                  onClick={() => {
                    if (onToggleFollowing) {
                      onToggleFollowing(profile.id);
                    }
                  }}
                  title={isFollowing ? (isFromFollowing ? "Unfollow company" : "Following") : "Follow company"}
                >
                  <FollowingIcon size={16} /> {isFollowing ? (isFromFollowing ? 'Unfollow' : 'Following') : 'Follow'}
                </button>
              )}
              {!isCurrentUserProfile && (
                <button 
                  type="button"
                  className="btn-rate-dt"
                  onClick={() => setShowRatingModal(true)}
                  title="Rate this job posting"
                >
                  <FaStar /> Rate
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Back Button */}
            <button className="back-arrow-btn-dt" onClick={handleClosePanel} aria-label="Go back">
              <FaArrowLeft />
            </button>
            
            {/* Original worker profile code */}
            <button className="close-panel-btn-dt" onClick={handleClosePanel} aria-label="Close panel">
              <FaXmark />
            </button>
            <div className="details-header-premium-dt">
              <div className="header-inner-dt">
                <div className="avatar-section-dt">
                  <div className="avatar-wrapper-dt" onClick={handleAvatarClick} role="button" tabIndex={0} onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAvatarClick(); }}>
                    {avatarUrl && !avatarError ? (
                      <img 
                        src={avatarUrl} 
                        alt={profile.name} 
                        className="panel-avatar-dt"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <div 
                        className="avatar-placeholder-dt"
                        style={{ backgroundColor: getAvatarColor(profile.name) }}
                      >
                        <span className="avatar-initials-dt">{getInitials(profile.name, profile.email)}</span>
                      </div>
                    )}
                    <div className="status-indicator-dt"></div>
                  </div>
                </div>
                <div className="profile-section-dt">
                  <h2 className="profile-name-dt">{toProperCase(profile.name)}</h2>
                  <p className="profile-email-dt">{profile.email?.toLowerCase()}</p>
                  <p className="profile-title-dt">{toProperCase(profile.title)}</p>
                  <div className="header-stats-dt">
                    <span className="header-stat-label-dt">Rating</span>
                    <span className="header-stat-value-dt">{profile.rating}</span>
                    <span className="header-divider-dt">|</span>
                    <button
                      type="button"
                      className="header-stat-button-dt header-stat-button-group-dt"
                      onClick={() => openFollowLikePage('followers')}
                    >
                      <span className="header-stat-label-dt">Followers</span>
                      <span className="header-stat-value-dt">{profile.followers || 0}</span>
                    </button>
                    <span className="header-divider-dt">|</span>
                    <span className="header-stat-label-dt">Likes</span>
                    <button
                      type="button"
                      className="header-stat-value-dt header-stat-button-dt"
                      onClick={() => openFollowLikePage('likes')}
                    >
                      {profile.like_count != null ? profile.like_count : 0}
                    </button>
                    <span className="header-divider-dt">|</span>
                    <button
                      type="button"
                      className="header-stat-button-dt header-stat-button-group-dt"
                      onClick={() => openFollowLikePage('following')}
                    >
                      <span className="header-stat-label-dt">Following</span>
                      <span className="header-stat-value-dt">{followingCount}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Bio Section - Separate Full Width */}
        <div className="profile-bio-section-dt">{profileBio}</div>

        {/* Tab Navigation - shown for worker profiles only */}
        {detectedType !== 'job-ad' && (
          <>
            <div className="tab-navigation-dt">
              <button 
                className={`tab-btn-dt ${activeTab === 'basic' ? 'active' : ''}`}
                onClick={() => setActiveTab('basic')}
              >
            Basic
          </button>
          <button 
            className={`tab-btn-dt ${activeTab === 'professional' ? 'active' : ''}`}
            onClick={() => setActiveTab('professional')}
          >
            Skills
          </button>
          <button 
            className={`tab-btn-dt ${activeTab === 'work' ? 'active' : ''}`}
            onClick={() => setActiveTab('work')}
          >
            Work
          </button>
          <button 
            className={`tab-btn-dt ${activeTab === 'portfolio' ? 'active' : ''}`}
            onClick={() => setActiveTab('portfolio')}
          >
            Social Media
          </button>
          <button 
            className={`tab-btn-dt ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            Media <span className="tab-badge-dt">{profileMedia.length}</span>
          </button>
        </div>

        <div className="details-content-dt">
          {/* BASIC INFORMATION TAB */}
          {activeTab === 'basic' && (
            <div className="tab-content-grid-dt one-column-grid-dt">
              <div className="info-section-dt">
                <div className="info-item-dt">
                  <FaUser className="item-icon-dt" />
                  <div className="info-label-dt">
                    <span>Full Name</span>
                    <span>{toProperCase(profile.name)}</span>
                  </div>
                </div>
                <div className="info-item-dt">
                  <FaBriefcase className="item-icon-dt" />
                  <div className="info-label-dt">
                    <span>Title</span>
                    <span>{toProperCase(profile.title)}</span>
                  </div>
                </div>
                <div className="info-item-dt">
                  <FaEnvelope className="item-icon-dt" />
                  <div className="info-label-dt">
                    <span>Email</span>
                    <a href={`mailto:${profile.email}`} className="info-link-dt">{profile.email?.toLowerCase()}</a>
                  </div>
                </div>
                {profilePhone && (
                  <div className="info-item-dt">
                    <FaPhone className="item-icon-dt" />
                    <div className="info-label-dt">
                      <span>Phone</span>
                      <button
                        type="button"
                        className="info-phone-copy-dt"
                        onClick={(event) => openPhoneActionMenu(event, profilePhone)}
                        onPointerDown={(event) => openPhoneActionMenu(event, profilePhone)}
                        onTouchStart={(event) => openPhoneActionMenu(event, profilePhone)}
                        onContextMenu={(event) => openPhoneActionMenu(event, profilePhone)}
                        title="Tap for phone actions"
                        aria-label={`Phone actions for ${profilePhone}`}
                      >
                        <span>{profilePhone || 'N/A'}</span>
                        {phoneCopyFeedback && (
                          <span className="phone-copy-feedback-dt">
                            <svg
                              className="phone-copy-feedback-icon-dt"
                              fill="currentColor"
                              viewBox="-3.5 0 19 19"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden="true"
                            >
                              <path d="M4.63 15.638a1.028 1.028 0 0 1-.79-.37L.36 11.09a1.03 1.03 0 1 1 1.58-1.316l2.535 3.043L9.958 3.32a1.029 1.029 0 0 1 1.783 1.03L5.52 15.122a1.03 1.03 0 0 1-.803.511.89.89 0 0 1-.088.004z" />
                            </svg>
                            <span>{phoneCopyFeedback}</span>
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                <div className="info-item-dt">
                  <FaLocationDot className="item-icon-dt" />
                  <div className="info-label-dt">
                    <span>Location</span>
                    <span>{toProperCase(profile.location || 'N/A')}</span>
                  </div>
                </div>
                <div className="info-item-dt">
                  <FaCalendar className="item-icon-dt" />
                  <div className="info-label-dt">
                    <span>Experience</span>
                    <span>{toProperCase(profile.experience)}</span>
                  </div>
                </div>
                {profile.languages && profile.languages.length > 0 && (
                  <div className="info-item-dt">
                    <FaGlobe className="item-icon-dt" />
                    <div className="info-label-dt">
                      <span>Languages</span>
                      <span className="languages-value-dt">{Array.isArray(profile.languages) && profile.languages.map((lang, idx) => (
                        <span key={idx}>
                          {idx > 0 && <span className="language-separator-dt">|</span>}
                          <span className="language-item-dt">{lang}</span>
                        </span>
                      ))}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PROFESSIONAL EXPERTISE TAB */}
          {activeTab === 'professional' && (
            <div className="tab-content-grid-dt">
              {profile.skills && profile.skills.length > 0 && (
                <div className="info-section-dt">
                  <div className="info-item-dt">
                    <FaBriefcase className="item-icon-dt" />
                    <div className="info-label-dt">
                      <span>Skills</span>
                      <span className="skills-value-dt">{Array.isArray(profile.skills) && profile.skills.map((skill, idx) => (
                        <span key={idx}>
                          {idx > 0 && <span className="skill-separator-dt">|</span>}
                          <span className="skill-item-dt">{skill}</span>
                        </span>
                      ))}</span>
                    </div>
                  </div>
                  {((profile.certifications || profile.credentials) && (Array.isArray(profile.certifications || profile.credentials) ? (profile.certifications || profile.credentials).length > 0 : String(profile.certifications || profile.credentials).trim().length > 0)) && (
                    <div className="info-item-dt certifications-row-dt">
                      <FaAward className="item-icon-dt" />
                      <div className="info-label-dt">
                        <span>Certifications</span>
                        <span className="certifications-value-dt">
                          {Array.isArray(profile.certifications || profile.credentials)
                            ? (profile.certifications || profile.credentials).map((cert, idx) => (
                                <span key={idx}>
                                  {idx > 0 && <span className="certification-separator-dt">|</span>}
                                  <span className="certification-item-dt">{cert}</span>
                                </span>
                              ))
                            : String(profile.certifications || profile.credentials)
                          }
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {profile.reviews && profile.reviews.length > 0 && (
                <div className="info-section-dt">
                  <div className="info-item-dt">
                    <FaStar className="item-icon-dt" />
                    <div className="info-label-dt">
                      <span>Client Reviews</span>
                      <span className="reviews-value-dt">{Array.isArray(profile.reviews) && profile.reviews.map((r, idx) => (
                        <span key={idx}>
                          {idx > 0 && <span className="review-separator-dt">|</span>}
                          <span className="review-item-dt">{r.client} - {Math.floor(r.rating)}★</span>
                        </span>
                      ))}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* WORK PREFERENCES TAB */}
          {activeTab === 'work' && (
            <div className="tab-content-grid-dt">
              <div className="info-section-dt">
                <div className="info-item-dt">
                  <CalendarIcon className="item-icon-dt" />
                  <div className="info-label-dt">
                    <span>Availability</span>
                    <span className="availability-badge-dt">{profile.availability || 'Available'}</span>
                  </div>
                </div>
                <div className="info-item-dt">
                  <FaGlobe className="item-icon-dt" />
                  <div className="info-label-dt">
                    <span>Work Style</span>
                    <span>{profile.workStyle || 'Remote'}</span>
                  </div>
                </div>
                <div className="info-item-dt">
                  <FaDollarSign className="item-icon-dt" />
                  <div className="info-label-dt">
                    <span>Rate</span>
                    <span className="info-value-highlight-dt">{toProperCase(profile.hourlyRate)}</span>
                  </div>
                </div>
                {profile.projectTypes && profile.projectTypes.length > 0 && (
                  <div className="info-item-dt">
                    <FaBriefcase className="item-icon-dt" />
                    <div className="info-label-dt">
                      <span>Project Types</span>
                      <span className="project-types-value-dt">{Array.isArray(profile.projectTypes) && profile.projectTypes.map((type, idx) => (
                        <span key={idx}>
                          {idx > 0 && <span className="project-type-separator-dt">|</span>}
                          <span className="project-type-item-dt">{type}</span>
                        </span>
                      ))}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PORTFOLIO & SOCIAL LINKS TAB */}
          {activeTab === 'portfolio' && (
            <div className="tab-content-grid-dt">
              <div className="full-width-section-dt">
                <div className="social-icons-grid-dt">
                  {profile.github && (
                    <a
                      href={getSocialUrl('github', profile.github)}
                      onClick={(e) => { e.preventDefault(); openExternal(getSocialUrl('github', profile.github)); }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-btn-dt social-icon-github-dt"
                      title="GitHub"
                    >
                      <FaGithub />
                    </a>
                  )}
                  {profile.linkedin && (
                    <a
                      href={getSocialUrl('linkedin', profile.linkedin)}
                      onClick={(e) => { e.preventDefault(); openExternal(getSocialUrl('linkedin', profile.linkedin)); }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-btn-dt social-icon-linkedin-dt"
                      title="LinkedIn"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
                        <path fillRule="evenodd" clipRule="evenodd" d="M5.37214 24H0.396429V7.97674H5.37214V24ZM2.88161 5.79102C1.29054 5.79102 0 4.47317 0 2.8821C2.37147e-08 1.29063 1.29014 0.000488281 2.88161 0.000488281C4.47307 0.000488281 5.76321 1.29063 5.76321 2.8821C5.76321 4.47317 4.47214 5.79102 2.88161 5.79102ZM23.9946 24H19.0296V16.2C19.0296 14.341 18.9921 11.9571 16.4427 11.9571C13.8557 11.9571 13.4593 13.9767 13.4593 16.066V24H8.48893V7.97674H13.2611V10.1625H13.3307C13.995 8.90352 15.6177 7.57495 18.0386 7.57495C23.0743 7.57495 24 10.891 24 15.1982V24H23.9946Z" fill="#ffffff"/>
                      </svg>
                    </a>
                  )}
                  {profile.twitter && (
                    <a
                      href={getSocialUrl('twitter', profile.twitter)}
                      onClick={(e) => { e.preventDefault(); openExternal(getSocialUrl('twitter', profile.twitter)); }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-btn-dt social-icon-twitter-dt"
                      title="Twitter"
                    >
                      <FaXTwitter />
                    </a>
                  )}
                  {profile.instagram && (
                    <a
                      href={getSocialUrl('instagram', profile.instagram)}
                      onClick={(e) => { e.preventDefault(); openExternal(getSocialUrl('instagram', profile.instagram)); }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-btn-dt social-icon-instagram-dt"
                      title="Instagram"
                    >
                      <FaInstagram />
                    </a>
                  )}
                  {profile.facebook && (
                    <a
                      href={getSocialUrl('facebook', profile.facebook)}
                      onClick={(e) => { e.preventDefault(); openExternal(getSocialUrl('facebook', profile.facebook)); }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-btn-dt social-icon-facebook-dt"
                      title="Facebook"
                    >
                      <svg fill="#ffffff" width="24" height="24" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1168.737 487.897c44.672-41.401 113.824-36.889 118.9-36.663l289.354-.113 6.317-417.504L1539.65 22.9C1511.675 16.02 1426.053 0 1237.324 0 901.268 0 675.425 235.206 675.425 585.137v93.97H337v451.234h338.425V1920h451.234v-789.66h356.7l62.045-451.233H1126.66v-69.152c0-54.937 14.214-96.112 42.078-122.058" fillRule="evenodd"/>
                      </svg>
                    </a>
                  )}
                  {profile.tiktok && (
                    <a
                      href={getSocialUrl('tiktok', profile.tiktok)}
                      onClick={(e) => { e.preventDefault(); openExternal(getSocialUrl('tiktok', profile.tiktok)); }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-btn-dt social-icon-tiktok-dt"
                      title="TikTok"
                    >
                      <FaTiktok />
                    </a>
                  )}
                  {profile.whatsapp && (
                    <a
                      href={getSocialUrl('whatsapp', profile.whatsapp)}
                      onClick={(e) => { e.preventDefault(); openExternal(getSocialUrl('whatsapp', profile.whatsapp)); }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-icon-btn-dt social-icon-whatsapp-dt"
                      title="WhatsApp"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="none">
                        <path d="M16.6,14c-0.2-0.1-1.5-0.7-1.7-0.8c-0.2-0.1-0.4-0.1-0.6,0.1c-0.2,0.2-0.6,0.8-0.8,1c-0.1,0.2-0.3,0.2-0.5,0.1 c-0.7-0.3-1.4-0.7-2-1.2c-0.5-0.5-1-1.1-1.4-1.7c-0.1-0.2,0-0.4,0.1-0.5c0.1-0.1,0.2-0.3,0.4-0.4c0.1-0.1,0.2-0.3,0.2-0.4 c0.1-0.1,0.1-0.3,0-0.4c-0.1-0.1-0.6-1.3-0.8-1.8C9.4,7.3,9.2,7.3,9,7.3c-0.1,0-0.3,0-0.5,0C8.3,7.3,8,7.5,7.9,7.6 C7.3,8.2,7,8.9,7,9.7c0.1,0.9,0.4,1.8,1,2.6c1.1,1.6,2.5,2.9,4.2,3.7c0.5,0.2,0.9,0.4,1.4,0.5c0.5,0.2,1,0.2,1.6,0.1 c0.7-0.1,1.3-0.6,1.7-1.2c0.2-0.4,0.2-0.8,0.1-1.2C17,14.2,16.8,14.1,16.6,14 M19.1,4.9C15.2,1,8.9,1,5,4.9c-3.2,3.2-3.8,8.1-1.6,12L2,22l5.3-1.4 c1.5,0.8,3.1,1.2,4.7,1.2h0c5.5,0,9.9-4.4,9.9-9.9C22,9.3,20.9,6.8,19.1,4.9 M16.4,18.9c-1.3,0.8-2.8,1.3-4.4,1.3h0 c-1.5,0-2.9-0.4-4.2-1.1l-0.3-0.2l-3.1,0.8l0.8-3l-0.2-0.3C2.6,12.4,3.8,7.4,7.7,4.9S16.6,3.7,19,7.5 C21.4,11.4,20.3,16.5,16.4,18.9" fill="#ffffff"/>
                      </svg>
                    </a>
                  )}
                </div>
                {profile.portfolioWebsite && (
                  <div className="social-link-row-dt">
                    <a
                      href={getSocialUrl('website', profile.portfolioWebsite)}
                      onClick={(e) => { e.preventDefault(); openExternal(getSocialUrl('website', profile.portfolioWebsite)); }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-link-modern-dt website-link-dt"
                      title="Website"
                    >
                      <span className="link-icon-dt">🌐</span>
                      <span>{profile.portfolioWebsite}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MEDIA PORTFOLIO TAB */}
          {activeTab === 'media' && (
            <div className="tab-content-grid-dt">
              {profileMedia.length > 0 ? (
                <div className="full-width-section-dt">
                  <div className="portfolio-grid-modern-dt">
                    {profileMedia.map((item, idx) => {
                      const url = getMediaUrl(item);
                      const thumbnailUrl = getMediaThumbnailUrl(item);
                      return (
                        <div 
                          key={idx} 
                          className="portfolio-item-modern-dt"
                          onClick={() => handleMediaClick(idx)}
                          role="button"
                          tabIndex={0}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              handleMediaClick(idx);
                            }
                          }}
                        >
                          {isVideoFile(url, item) ? (
                            thumbnailUrl ? (
                              <img src={thumbnailUrl} alt={getMediaTitle(item)} className="portfolio-media-preview-dt" />
                            ) : (
                              <video
                                src={url}
                                muted
                                playsInline
                                autoPlay
                                loop
                                preload="metadata"
                                className="portfolio-media-preview-dt"
                              />
                            )
                          ) : isPdfFile(url, item) ? (
                            <div className="portfolio-item-placeholder pdf-placeholder">
                              <span>PDF</span>
                            </div>
                          ) : (
                            <img src={url} alt={getMediaTitle(item)} loading="lazy" />
                          )}
                          {isVideoFile(url, item) && thumbnailUrl && (
                            <div className="portfolio-item-play-icon-dt">▶</div>
                          )}
                          {getMediaCaption(item) ? (
                            <p>{getMediaCaption(item)}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="full-width-section-dt">
                  <p className="no-media-text-dt">No media uploaded yet.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Premium Footer */}
        <div className="cta-footer-dt">
          {!isCurrentUserProfile && (
            <button
              type="button"
              className={`btn-like-dt ${isLiked ? 'liked-dt' : ''}`}
              onClick={handleLikeInteraction}
              onPointerDown={() => console.log('[DetailsPanel] PointerDown on like button')}
              onTouchStart={() => console.log('[DetailsPanel] TouchStart on like button')}
              onMouseDown={() => console.log('[DetailsPanel] MouseDown on like button')}
              aria-pressed={isLiked}
              title={isLiked ? 'Unlike this profile' : 'Like this profile'}
            >
              <FaHeart /> {isLiked ? 'Liked' : 'Like'}
            </button>
          )}
          {!isCurrentUserProfile && <button className="btn-secondary-dt"><FaEnvelope /> Message</button>}
          <button 
            className="btn-primary-dt"
            onClick={() => isCurrentUserProfile ? onUpdateProfile?.(profile) : setShowHiringPage(true)}
            title={isCurrentUserProfile ? 'Update your profile' : 'Send a hire request to this professional'}
          >
            {isCurrentUserProfile ? 'Update' : <><FaBriefcase /> Hire Now</>}
          </button>
          {!isCurrentUserProfile && (
            <button 
              className={`btn-follow-dt ${isFollowing ? 'following-dt' : ''}`}
              onClick={() => {
                if (onToggleFollowing) {
                  onToggleFollowing(profile.id);
                }
              }}
              title={isFollowing ? (isFromFollowing ? "Unfollow" : "Following") : "Follow"}
            >
              <FollowingIcon size={16} /> {isFollowing ? (isFromFollowing ? 'Unfollow' : 'Following') : 'Follow'}
            </button>
          )}
          {!isCurrentUserProfile && (
            <button 
              type="button"
              className="btn-rate-dt"
              onClick={() => setShowRatingModal(true)}
              title="Rate this professional"
            >
              <FaStar /> Rate
            </button>
          )}
        </div>

        {/* Rating Modal Overlay */}
        {showRatingModal && (
          <div className="rating-modal-overlay-dt" onClick={() => {
            setShowRatingModal(false);
            setUserRating(0);
          }}>
            <div className="rating-modal-dt" onClick={(e) => e.stopPropagation()}>
              <div className="rating-header-compact-dt">
                <h3 className="rating-modal-title-dt">Rate {toProperCase(profile.name)}</h3>
                <button 
                  className="close-rating-modal-dt"
                  onClick={() => {
                    setShowRatingModal(false);
                    setUserRating(0);
                  }}
                >
                  <FaXmark />
                </button>
              </div>
              
              <div className="rating-form-compact-dt">
                <div className="stars-wrapper-compact-dt">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className={`star-btn-compact-dt ${star <= (hoverRating || userRating) ? 'active' : ''}`}
                      onClick={() => setUserRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      title={`Rate ${star} stars`}
                    >
                      <FaStar className="star-icon-compact-dt" />
                    </button>
                  ))}
                </div>

                <div className="rating-actions-compact-dt">
                  <button 
                    className="btn-submit-rating-compact-dt"
                    onClick={handleSubmitRating}
                  >
                    Submit
                  </button>
                  <button 
                    className="btn-cancel-rating-compact-dt"
                    onClick={() => {
                      setShowRatingModal(false);
                      setUserRating(0);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {submittedRatings && submittedRatings.length > 0 && (
                <div className="previous-ratings-compact-dt">
                  <div className="ratings-list-compact-dt">
                    {submittedRatings.map((rating, idx) => (
                      <div key={idx} className="rating-item-compact-dt">
                        <div className="rating-stars-display-compact-dt">
                          {[...Array(5)].map((_, i) => (
                            <FaStar 
                              key={i} 
                              className={`star-display-compact-dt ${i < rating.rating ? 'filled' : 'empty'}`}
                            />
                          ))}
                        </div>
                        <span className="rating-date-compact-dt">{rating.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Media Lightbox Modal */}
        {showAvatarLightbox && (
          <div className="avatar-lightbox-overlay-dt" onClick={() => setShowAvatarLightbox(false)}>
            <div className="avatar-lightbox-content-dt" onClick={(e) => e.stopPropagation()}>

              <div className="avatar-lightbox-media-dt">
                {avatarUrl && !avatarError ? (
                  <img
                    src={avatarUrl}
                    alt={profile.name}
                    className="avatar-lightbox-image-dt"
                  />
                ) : (
                  <div className="avatar-lightbox-placeholder-dt" style={{ backgroundColor: getAvatarColor(profile.name) }}>
                    <span>{getInitials(profile.name)}</span>
                  </div>
                )}

                <button
                  className="avatar-lightbox-close-dt"
                  onClick={() => setShowAvatarLightbox(false)}
                  aria-label="Close avatar preview"
                >
                  <FaXmark />
                </button>
              </div>

              <div className="avatar-lightbox-caption-dt">{profile.name}</div>
            </div>
          </div>
        )}

        {showMediaLightbox && profileMedia.length > 0 && (
          <div className="media-lightbox-overlay-dt" onClick={() => setShowMediaLightbox(false)}>
            <div className="media-lightbox-dt" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Media preview">
              <div className="media-lightbox-header-dt">
                <div className="media-lightbox-controls-dt">
                  <span className="media-lightbox-counter-dt">
                    {selectedMediaIndex + 1} / {profileMedia.length}
                  </span>
                  <button
                    className="media-lightbox-close-dt"
                    onClick={() => setShowMediaLightbox(false)}
                    aria-label="Close media preview"
                  >
                    <FaXmark />
                  </button>
                </div>
                <div className="media-lightbox-caption-dt">
                  {getMediaCaption(profileMedia[selectedMediaIndex]) ? (
                    <p>{getMediaCaption(profileMedia[selectedMediaIndex])}</p>
                  ) : null}
                </div>
              </div>

              <div className="media-lightbox-container-dt">
                <div
                  className="media-lightbox-content-dt"
                  onTouchStart={handleMediaTouchStart}
                  onTouchEnd={handleMediaTouchEnd}
                >
                  <div className="media-slider-dt" ref={mediaSliderRef}>
                    {profileMedia.map((item, idx) => {
                      const url = getMediaUrl(item);
                      const thumbnailUrl = getMediaThumbnailUrl(item);
                      return (
                        <div key={idx} className={`media-slide-dt ${idx === selectedMediaIndex ? 'active' : ''}`}>
                          {isVideoFile(url, item) ? (
                            <video
                              key={url}
                              src={url}
                              controls
                              autoPlay
                              playsInline
                              loop
                              preload="auto"
                              poster={thumbnailUrl || undefined}
                              crossOrigin="anonymous"
                              className="media-lightbox-video-dt"
                            />
                          ) : isPdfFile(url, item) ? (
                            <iframe
                              src={url}
                              title={getMediaTitle(item)}
                              className="media-lightbox-iframe-dt"
                            />
                          ) : (
                            <img
                              src={url}
                              alt={getMediaTitle(item)}
                              className="media-lightbox-image-dt"
                            />
                          )}

                          {getMediaCaption(item) ? (
                            <div className="media-slide-caption-dt">{getMediaCaption(item)}</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {profileMedia.length > 1 && (
                <div className="media-lightbox-footer-dt">
                  <div className="media-lightbox-thumbnails-dt">
                    {profileMedia.map((item, idx) => {
                      const thumbUrl = getMediaThumbnailUrl(item);
                      const mediaUrl = getMediaUrl(item);
                      return (
                        <div
                          key={idx}
                          className={`media-lightbox-thumbnail-dt ${idx === selectedMediaIndex ? 'active' : ''}`}
                          onClick={() => setSelectedMediaIndex(idx)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedMediaIndex(idx);
                            }
                          }}
                        >
                          {isVideoFile(mediaUrl, item) ? (
                            thumbUrl ? (
                              <img src={thumbUrl} alt={getMediaTitle(item)} />
                            ) : (
                              <video
                                src={mediaUrl}
                                muted
                                playsInline
                                preload="metadata"
                                className="media-lightbox-thumbnail-video-dt"
                              />
                            )
                          ) : (
                            <img src={mediaUrl} alt={getMediaTitle(item)} />
                          )}
                          {isVideoFile(mediaUrl, item) && thumbUrl && (
                            <div className="thumbnail-play-icon-dt">▶</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hiring Modal Overlay */}
        {showHiringPage && (
          <HiringPage 
            profile={profile} 
            onBack={() => setShowHiringPage(false)}
          />
        )}

        {/* Phone Action Menu */}
        {phoneMenuOpen && profilePhone && (
          <div 
            ref={phoneMenuRef}
            className="phone-action-menu-dt"
            style={{
              position: 'fixed',
              top: `${phoneMenuPosition.top}px`,
              left: `${phoneMenuPosition.left}px`,
              zIndex: 10000,
            }}
          >
            <button
              type="button"
              className="phone-action-item-dt"
              onClick={handlePhoneCall}
              title="Call"
            >
              <svg
                className="phone-action-icon-dt"
                fill="none"
                viewBox="0 0 512 512"
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: '16px', height: '16px' }}
              >
                <path fill="currentColor" d="M403.854,409.684c-17.68-14.106-72.76-41.247-86.349-44.375c-13.562-3.154-29.98,9.962-34.501,26.248c-4.547,16.295-13.027,14.753-13.027,14.753s-32.67-12.003-92.429-71.534c-59.769-59.549-71.85-92.175-71.85-92.175s-1.595-8.48,14.692-13.089c16.252-4.564,29.314-21.035,26.125-34.598c-3.171-13.562-30.532-68.563-44.69-86.165c-14.192-17.601-41.606-8.524-47.633-4.135C48.13,108.987-15.581,149.49,3.58,224.072c19.186,74.592,60.346,134.264,105.579,179.348c45.242,45.066,105.062,85.998,179.715,104.904c74.644,18.915,114.919-44.944,119.274-51.006C412.51,451.273,421.481,423.816,403.854,409.684z" />
                <path fill="currentColor" d="M247.023,189.177c9.9,4.854,25.644,13.86,43.893,32.1c18.25,18.25,27.247,33.993,32.1,43.884c5.099,10.4,8.866,12.494,11.915,11.784c5.029-1.166,6.702-2.515,7.167-13.001c0.385-8.936-3.89-35.588-31.076-62.773c-27.186-27.186-53.846-31.452-62.764-31.067c-10.496,0.447-11.828,2.129-12.992,7.175C234.555,180.311,236.623,184.087,247.023,189.177z" />
                <path fill="currentColor" d="M262.95,84.247c-12.808-0.009-16.042,7.92-16.428,10.995c-0.788,6.212,3.794,11.249,13.308,13.974c10.881,3.11,53.986,16.935,90.099,53.048c36.122,36.113,49.956,79.226,53.057,90.107c2.716,9.506,7.744,14.08,13.964,13.3c3.092-0.369,11.012-3.61,10.995-16.418c0.009-10.137-6.186-63.22-53.986-111.038C326.17,90.423,273.06,84.237,262.95,84.247z" />
                <path fill="currentColor" d="M437.304,74.889C368.836,6.422,296.602,0.526,284.187,0.201c-15.157-0.385-21.167,6.414-21.158,13.387c-0.009,5.94,6.08,12.046,15.139,14.377c13.597,3.486,67.495,11.976,130.784,75.266c63.307,63.29,71.78,117.197,75.284,130.803c2.322,9.041,8.437,15.139,14.368,15.139c6.982,0,13.781-6.002,13.378-21.149C511.667,215.601,505.771,143.366,437.304,74.889z" />
              </svg>
              <span>Call</span>
            </button>
            <button
              type="button"
              className="phone-action-item-dt"
              onClick={handlePhoneCopy}
              title="Copy"
            >
              <svg
                className="phone-action-icon-dt"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: '16px', height: '16px' }}
              >
                <path fillRule="evenodd" d="M16,16 L16,20 C16,21.1522847 15.1522847,22 14,22 L4,22 C2.84771525,22 2,21.1522847 2,20 L2,10 C2,8.84771525 2.84771525,8 4,8 L8,8 L8,4 C8,2.84771525 8.84771525,2 10,2 L20,2 C21.1522847,2 22,2.84771525 22,4 L22,14 C22,15.1522847 21.1522847,16 20,16 L16,16 Z M14,16 L10,16 C8.84771525,16 8,15.1522847 8,14 L8,10 L4,10 L4,20 L14,20 L14,16 Z M10,4 L10,14 L20,14 L20,4 L10,4 Z"/>
              </svg>
              <span>Copy</span>
            </button>
            <button
              type="button"
              className="phone-action-item-dt"
              onClick={handlePhoneMessage}
              title="Message"
            >
              <svg
                className="phone-action-icon-dt"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: '16px', height: '16px' }}
              >
                <path d="M7 7H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 11H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 5V20.7929C3 21.2383 3.53857 21.4614 3.85355 21.1464L7.70711 17.2929C7.89464 17.1054 8.149 17 8.41421 17H19C20.1046 17 21 16.1046 21 15V5C21 3.89543 20.1046 3 19 3H5C3.89543 3 3 3.89543 3 5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Message</span>
            </button>
            <button
              type="button"
              className="phone-action-item-dt"
              onClick={handlePhoneWhatsApp}
              title="WhatsApp"
            >
              <FaWhatsapp className="phone-action-icon-dt" style={{ fontSize: '0.8rem' }} />
              <span>WhatsApp</span>
            </button>
            {typeof navigator?.share === 'function' && (
              <button
                type="button"
                className="phone-action-item-dt"
                onClick={handlePhoneShare}
                title="Share"
              >
                <span className="phone-action-icon-dt">📤</span>
                <span>Share</span>
              </button>
            )}
          </div>
        )}

          </>
        )}
    </div>
      </div>
  );
}

export default DetailsPanel;
