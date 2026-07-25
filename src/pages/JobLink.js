import './Joblink.css';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { pushBackAction, popBackAction, runBackAction, clearBackActionStack } from '../services/backNavigation';
import Home from './Home';
import Trending from './Trending';
import Following from './Following';
import Liked from './Liked';
import Search from './Search';
import Landing from '../Landing/Landing';
import UserAccountPanel from '../accounts/UserAccountPanel';
import EmployerAccountPanel from '../accounts/EmployerAccountPanel';
import AccountTypeSelector from '../forms/AccountSelector';
import UserP from '../UserProfile/UserP';
import SubscriptionModal from '../Subscription/SubscriptionModal';
import PremiumPanel from '../Subscription/PremiumPanel';
import { Admin } from '../Admin/Admin';
import { buildSearchIndex, filterProfilesWithIndex, filterJobPostings } from '../searchUtils';
import { FollowingIcon } from '../Icons/FollowingIcon';
import { LikedIcon } from '../Icons/LikedIcon';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import NotificationBell from '../components/Notifications/NotificationBell';
import { supabase } from '../supabase';
import { API_URL } from '../config';
import { applyProfileCountUpdates } from '../utils/profileCountState';
import { normalizeJobPostingMedia } from '../utils/jobPostingMedia';
import { normalizeMediaItem, resolveMediaUrl } from '../utils/mediaUrl';
import { normalizeHomeProfilesCache, persistHomeProfilesCache } from '../utils/homeProfilesCache';
import { getLandingEntryRoute } from '../utils/authRouting';
import { normalizeProfileMediaFiles, serializeMediaForDatabase } from '../utils/profileMedia';
import { normalizeProfileListValue } from '../utils/profileFieldValues';
import { syncMediaFilesWithStorage, deleteMediaFile, deleteMultipleMediaFiles } from '../utils/mediaRecovery';
import { normalizeProfileSocialLinks } from '../utils/profileSocialLinks';

const TAB_SEQUENCE = [
  { name: 'Home', filter: 'all', route: '/home' },
  { name: 'Home', filter: 'seekers', route: '/home?filter=seekers' },
  { name: 'Home', filter: 'jobs', route: '/home?filter=jobs' },
  { name: 'Trending', filter: 'all', route: '/trending' },
  { name: 'Following', filter: 'all', route: '/following' },
  { name: 'Liked', filter: 'all', route: '/liked' }
];

// Custom SVG Home Icon
function HomeIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 15 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <path d="M7.5 0.5L7.8254 0.120372C7.63815 -0.0401239 7.36185 -0.0401239 7.1746 0.120372L7.5 0.5ZM0.5 6.5L0.174604 6.12037L0 6.27003V6.5H0.5ZM5.5 14.5V15C5.77614 15 6 14.7761 6 14.5H5.5ZM9.5 14.5H9C9 14.7761 9.22386 15 9.5 15V14.5ZM14.5 6.5H15V6.27003L14.8254 6.12037L14.5 6.5ZM1.5 15H5.5V14H1.5V15ZM14.8254 6.12037L7.8254 0.120372L7.1746 0.879628L14.1746 6.87963L14.8254 6.12037ZM7.1746 0.120372L0.174604 6.12037L0.825396 6.87963L7.8254 0.879628L7.1746 0.120372ZM6 14.5V11.5H5V14.5H6ZM9 11.5V14.5H10V11.5H9ZM9.5 15H13.5V14H9.5V15ZM15 13.5V6.5H14V13.5H15ZM0 6.5V13.5H1V6.5H0ZM7.5 10C8.32843 10 9 10.6716 9 11.5H10C10 10.1193 8.88071 9 7.5 9V10ZM7.5 9C6.11929 9 5 10.1193 5 11.5H6C6 10.6716 6.67157 10 7.5 10V9ZM13.5 15C14.3284 15 15 14.3284 15 13.5H14C14 13.7761 13.7761 14 13.5 14V15ZM1.5 14C1.22386 14 1 13.7761 1 13.5H0C0 14.3284 0.671573 15 1.5 15V14Z" fill="currentColor"/>
    </svg>
  );
}

// Custom SVG Trending Icon
function TrendingIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <path d="M50.1,30.56a1.16,1.16,0,0,1-2,.82L42.73,26,30.32,36.65a3.39,3.39,0,0,1-4.92,0l-7.49-8.54L4.57,39.81a1.13,1.13,0,0,1-1.64,0l-.59-.59a1.13,1.13,0,0,1,0-1.64L15.46,19.68a3.39,3.39,0,0,1,4.92,0l7.49,7.49,7.61-8.78-4.92-4.45a1.26,1.26,0,0,1,.82-2.11H47.76A2.35,2.35,0,0,1,50,14.3Z" fill="currentColor"/>
    </svg>
  );
}

// Custom SVG Jobs Icon
function JobsIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <path d="M28,8H21V6a2,2,0,0,0-2-2H13a2,2,0,0,0-2,2V8H4a2,2,0,0,0-2,2V26a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V10A2,2,0,0,0,28,8ZM13,6h6V8H13Zm15,4v9H4V10ZM4,26V21H28v5Z" fill="currentColor"/>
      <path d="M15,18h2a1,1,0,0,0,0-2H15a1,1,0,0,0,0,2Z" fill="currentColor"/>
    </svg>
  );
}

function Joblink({ initialView = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, isLoading, isSigningOut } = useAuth();
  const [activeTab, setActiveTab] = useState('Home');
  const [showAccountPanel, setShowAccountPanel] = useState(initialView === 'edit-profile-employee' || initialView === 'edit-profile-employer');
  const [showAccountTypeSelector, setShowAccountTypeSelector] = useState(initialView === 'account-selector');
  const [showSearchPage, setShowSearchPage] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedAccountType, setSelectedAccountType] = useState(initialView === 'edit-profile-employee' ? 'employee' : (initialView === 'edit-profile-employer' ? 'employer' : null));
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [cardTypeFilter, setCardTypeFilter] = useState('all');
  const [likedItems, setLikedItems] = useState({});
  const [bookmarkedItems, setBookmarkedItems] = useState({});
  const [followingItems, setFollowingItems] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showUpgradePanel, setShowUpgradePanel] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [userCreatedJobPostings, setUserCreatedJobPostings] = useState([]);
  const [showLanding, setShowLanding] = useState(() => {
    // Don't show landing if we're on account-type-selector route or edit-profile routes (coming from login)
    if (initialView === 'account-selector' || initialView === 'edit-profile-employee' || initialView === 'edit-profile-employer') {
      return false;
    }
    // Start hidden; landing visibility will be resolved after auth/load state.
    return false;
  });
  const previousRoute = useRef('/home'); // Track previous route for profile form closes
  const followersUpdateTimestamps = useRef({}); // Track when followers were last updated for each profile
  const profileJustCreatedRef = useRef(false); // Track if profile was just created to prevent back button issues
  const isInitialMountRef = useRef(true); // Track if this is the first mount to optimize startup
  const currentHashRef = useRef(null);
  const showAccountPanelRef = useRef(false); // Ref to track current showAccountPanel state in back handler
  const showAccountTypeSelectorRef = useRef(false); // Ref to track current showAccountTypeSelector state
  const selectedProfileRef = useRef(null); // Ref to track current selectedProfile state
  const selectedAccountRef = useRef(null); // Ref to track current selectedAccount state (for new profile vs edit)
  const isNewProfileCreationRef = useRef(false); // Ref to distinguish new profile creation from existing profile edit
  const showAdminPanelRef = useRef(false); // Ref to track admin panel state
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const parseHashRef = useRef(null);
  
  // Utility function to navigate using hash-based routing
  const LAST_ROUTE_KEY = 'joblinkLastRoute';
  const HOME_PROFILES_CACHE_KEY = 'joblinkHomeProfiles';

  const navigateTo = useCallback((route, options = {}) => {
    // Convert to hash-style routes since the app uses hash-based routing
    const hashRoute = route.startsWith('#') ? route : '#' + (route.startsWith('/') ? route : '/' + route);
    const newHash = hashRoute.slice(1);
    const currentHash = window.location.hash.slice(1);
    if (options.replace) {
      const baseUrl = window.location.href.split('#')[0];
      if (currentHash !== newHash) {
        window.location.replace(baseUrl + hashRoute);
      }
    } else {
      if (currentHash !== newHash) {
        window.location.hash = newHash;
      }
    }
  }, []);

  // Swipe detection for mobile tab navigation
  const tabsContainerRef = useRef(null);
  const MIN_SWIPE_DISTANCE = 50;
  const MAX_VERTICAL_DELTA = 80;
  
  const handleTouchStart = useCallback((e) => {
    if (selectedProfile || showAccountTypeSelector || showAccountPanel || showSearchPage || showUpgradePanel || showSubscriptionModal || showAdminPanel) return;
    if (!e.touches?.length) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, [selectedProfile, showAccountTypeSelector, showAccountPanel, showSearchPage, showUpgradePanel, showSubscriptionModal, showAdminPanel]);
  
  const handleTouchEnd = useCallback((e) => {
    if (selectedProfile || showAccountTypeSelector || showAccountPanel || showSearchPage || showUpgradePanel || showSubscriptionModal || showAdminPanel) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = Math.abs(touchStartY.current - touchEndY);

    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE || deltaY > MAX_VERTICAL_DELTA) {
      return;
    }

    const currentIndex = TAB_SEQUENCE.findIndex(
      (tab) => tab.name === activeTab && tab.filter === cardTypeFilter
    );

    if (currentIndex === -1) return;

    const targetIndex = deltaX > 0 ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex < 0 || targetIndex >= TAB_SEQUENCE.length) return;

    const nextTab = TAB_SEQUENCE[targetIndex];
    setTimeout(() => {
      try {
        console.log('[handleTouchEnd] Navigating to:', nextTab.route);
        setActiveTab(nextTab.name);
        setCardTypeFilter(nextTab.filter);
        navigateTo(nextTab.route);
      } catch (e) {
        console.error('[handleTouchEnd] Error during navigation:', e);
      }
    }, 150);
  }, [activeTab, cardTypeFilter, navigateTo, selectedProfile, showAccountTypeSelector, showAccountPanel, showSearchPage, showUpgradePanel, showSubscriptionModal, showAdminPanel]);

  const handleTouchCancel = useCallback(() => {
    touchStartX.current = null;
    touchStartY.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart, { passive: true });
      window.removeEventListener('touchend', handleTouchEnd, { passive: true });
      window.removeEventListener('touchcancel', handleTouchCancel, { passive: true });
    };
  }, [handleTouchStart, handleTouchEnd, handleTouchCancel]);

  // Clear pending profile restore on first mount to prevent showing profiles from previous sessions
  useEffect(() => {
    try {
      sessionStorage.removeItem('joblinkPendingProfileRestore');
    } catch (e) {
      console.warn('Failed to clear pending profile restore on mount:', e);
    }
  }, []); // Run only on component mount

  useEffect(() => {
    const highlightProfile = location.state?.highlightProfile;
    const highlightProfileId = location.state?.highlightProfileId;

    if (highlightProfile) {
      setSelectedProfile(highlightProfile);
      return;
    }

    if (highlightProfileId) {
      setSelectedProfile((prev) => (prev?.id === highlightProfileId ? prev : { id: highlightProfileId }));
      return;
    }

    try {
      const pendingRestore = sessionStorage.getItem('joblinkPendingProfileRestore');
      if (!pendingRestore) return;

      const parsed = JSON.parse(pendingRestore);
      if (parsed?.profile?.id) {
        setSelectedProfile(parsed.profile);
        sessionStorage.removeItem('joblinkPendingProfileRestore');
      }
    } catch (error) {
      console.warn('JobLink: failed to restore pending profile state', error);
    }
  }, [location.state, location.pathname, location.key]);

  // Debug logging for selectedProfile changes
  useEffect(() => {
    console.log('📱 selectedProfile changed:', selectedProfile ? `${selectedProfile.title || selectedProfile.name}` : 'null');
  }, [selectedProfile]);

  // Utility function to get current hash or route path
  const getCurrentHash = useCallback(() => {
    const hash = window.location.hash.slice(1) || '';
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';

    if (hash) {
      return hash;
    }

    if (pathname === '/' || pathname === '') {
      const lastRoute = localStorage.getItem('joblinkLastRoute');
      if (lastRoute && lastRoute !== '/landing' && lastRoute !== '/login' && lastRoute !== '/auth/callback') {
        return lastRoute;
      }
      if (isLoading && !isSigningOut) {
        return null;
      }
      if (user?.id && !profileLoaded) {
        // Wait until the current user's profile state is confirmed before deciding the default route.
        return null;
      }
      if (user?.id && profileLoaded && !selectedAccount?.id) {
        return '/account-type-selector';
      }
      return user ? '/home' : '/landing';
    }

    // Support browser route paths for routes like /account-type-selector
    return pathname;
  }, [isLoading, isSigningOut, user, profileLoaded, selectedAccount]);

  // Parse hash and update state accordingly
  const parseHashAndUpdateState = useCallback(() => {
    try {
      const hash = getCurrentHash();

      if (!hash) {
        return;
      }

      if (currentHashRef.current === hash) {
        return;
      }

      currentHashRef.current = hash;

      // Reset all states initially (but only if not using initialView, which already set them)
      if (!initialView || (initialView && !hash.includes(initialView))) {
        setShowAccountPanel(false);
        setShowAccountTypeSelector(false);
        setShowSearchPage(false);
        setShowSubscriptionModal(false);
        setShowUpgradePanel(false);
        setShowAdminPanel(false);
      }

    if (hash === '/landing') {
      setShowLanding(true);
      setActiveTab('Home');
    } else if (hash.startsWith('/admin')) {
      setShowAdminPanel(true);
      setShowLanding(false);
    } else if (hash === '/account-type-selector' || hash === '/account-type-selector/step-1') {
      setShowLanding(false);
      setShowAccountTypeSelector(true);
      previousRoute.current = hash;
      localStorage.setItem('joblinkLastRoute', hash);
    } else if (hash === '/account-type-selector/step-2') {
      setShowLanding(false);
      setShowAccountTypeSelector(true);
      previousRoute.current = hash;
      localStorage.setItem('joblinkLastRoute', hash);
    } else if (hash === '/edit-profile-employee') {
      setShowLanding(false);
      setShowAccountTypeSelector(false);
      setShowAccountPanel(true);
      setSelectedAccountType('employee');
      setActiveTab('Profile');
      previousRoute.current = '/edit-profile-employee';
      localStorage.setItem('joblinkLastRoute', '/edit-profile-employee');
    } else if (hash === '/edit-profile-employer') {
      setShowLanding(false);
      setShowAccountTypeSelector(false);
      setShowAccountPanel(true);
      setSelectedAccountType('employer');
      setActiveTab('Profile');
      previousRoute.current = '/edit-profile-employer';
      localStorage.setItem('joblinkLastRoute', '/edit-profile-employer');
    } else if (hash === '/account-type-selector') {
      setShowLanding(false);
      setShowAccountTypeSelector(true);
      previousRoute.current = '/account-type-selector';
      localStorage.setItem('joblinkLastRoute', '/account-type-selector');
    } else if (hash === '/upgrade-panel') {
      setShowUpgradePanel(true);
    } else if (hash === '/subscription-modal') {
      setShowSubscriptionModal(true);
    } else if (hash === '/search') {
      setShowSearchPage(true);
      setShowLanding(false);
      setShowAccountTypeSelector(false);
      setShowAccountPanel(false);
      setShowAdminPanel(false);
      setActiveTab('Home');
      setCardTypeFilter('all');
    } else if (hash === '/profile') {
      setShowLanding(false);
      setShowAccountTypeSelector(false);
      setShowAccountPanel(false);
      setShowAdminPanel(false);
      setShowSearchPage(false);
      setActiveTab('Profile');
      setSelectedProfile(selectedAccount);
    } else if (hash.startsWith('/')) {
      // App tabs: /home, /home?filter=seekers, /home?filter=jobs, /trending, /following, /liked
      const [path, queryString] = hash.split('?');
      const routeName = path.slice(1); // Remove the leading slash
      const params = new URLSearchParams(queryString || '');
      const requestedFilter = params.get('filter') || 'all';
      const tab = routeName.charAt(0).toUpperCase() + routeName.slice(1); // Capitalize first letter
      const tabMap = {
        'Home': 'Home',
        'Trending': 'Trending',
        'Following': 'Following',
        'Liked': 'Liked',
        'Profile': 'Profile'
      };
      
      if (tabMap[tab]) {
        // Save route persistence for app reopen
        if (!hash.includes('edit-profile')) {
          previousRoute.current = hash;
          localStorage.setItem('joblinkLastRoute', hash);
          console.log('Updated previous route to:', previousRoute.current);
        }
        setShowLanding(false);
        setShowAccountTypeSelector(false);
        setShowAccountPanel(false);
        setActiveTab(tab);
        setCardTypeFilter(tab === 'Home' ? requestedFilter : 'all');
      } else {
        // Default based on user status: show landing for new users, home for returning users
        if (selectedAccount) {
          navigateTo('/home');
        } else {
          navigateTo('/landing');
        }
      }
    }
    } catch (error) {
      console.error('[parseHashAndUpdateState] Error updating state:', error);
    }
  }, [getCurrentHash, navigateTo, selectedAccount]);

  useEffect(() => {
    if (!isLoading && !isSigningOut && isInitialMountRef.current) {
      isInitialMountRef.current = false;
      try {
        // Suppress initial logs for faster startup
        parseHashAndUpdateState();
      } catch (e) {
        console.error('[Initial mount] Error in parseHashAndUpdateState:', e);
      }
    }
  }, [isLoading, isSigningOut, parseHashAndUpdateState]);

  // Keep ref updated with latest parseHashAndUpdateState function
  useEffect(() => {
    parseHashRef.current = parseHashAndUpdateState;
  }, [parseHashAndUpdateState]);

  // Single consolidated hash listener for both persistence and state updates
  useEffect(() => {
    const handleHashChange = () => {
      try {
        // Persist route to localStorage
        const hash = window.location.hash.slice(1) || '';
        if (hash && hash !== '/landing' && hash !== '/login' && hash !== '/auth/callback') {
          localStorage.setItem(LAST_ROUTE_KEY, hash);
        }
        
        // Update state based on hash - use ref to avoid dependency loop
        if (parseHashRef.current) {
          parseHashRef.current();
        }
      } catch (error) {
        console.error('[hashchange] Error handling hash change:', error);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Scroll active tab into view when tab changes
  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeButton = tabsContainerRef.current.querySelector('.tab-button.active');
      if (activeButton) {
        activeButton.scrollIntoView({
          behavior: isInitialMountRef.current ? 'auto' : 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTab, cardTypeFilter]);

  // Handle Android back button centrally using shared back action stack
  useEffect(() => {
    let backButtonListener;

    const setupBackButton = async () => {
      try {
        backButtonListener = await App.addListener('backButton', async () => {
          // Close admin panel immediately without extra navigation
          if (showAdminPanelRef.current) {
            setShowAdminPanel(false);
            setActiveTab('Home');
            setCardTypeFilter('all');
            return;
          }

          // Handle active profile edit panel explicitly so Android back does not minimize the app.
          // If editing existing profile, close the panel and go to home.
          // If creating new profile, go back to account type selector (don't go to home).
          if (showAccountPanelRef.current && !profileJustCreatedRef.current) {
            setShowAccountPanel(false);
            setCardTypeFilter('all');
            
            if (isNewProfileCreationRef.current) {
              // New profile creation flow: return to account type selector
              setShowAccountTypeSelector(true);
              setSelectedAccountType(null);
              setSelectedAccount(null);
            } else {
              // Editing an existing profile: close the panel and go to home
              setActiveTab('Home');
              navigateTo('/home');
            }
            return;
          }

          if (window.__joblinkSettingsPanelOpen) {
            const handled = await runBackAction();
            if (!handled) {
              window.dispatchEvent(new Event('joblinkCloseSettingsPanel'));
            }
            return;
          }

          const handled = await runBackAction();
          if (!handled) {
            if (selectedProfileRef.current) {
              closeSelectedProfile();
              return;
            }
            await App.minimizeApp();
          }
        });
      } catch (error) {
        console.log('Capacitor App API not available');
      }
    };

    setupBackButton();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove().catch(() => {});
      }
    };
  }, [navigateTo]);

  useEffect(() => {
    const activeActions = [];
    const registerAction = (action) => {
      pushBackAction(action);
      activeActions.push(action);
    };

    if (showUpgradePanel) {
      registerAction(() => {
        setShowUpgradePanel(false);
        navigateTo('/home');
      });
    }

    if (showAccountPanel) {
      // Only register back action if editing an existing profile
      // If selectedAccount is null, it's a new profile creation - let back button go to account selector
      if (selectedAccount) {
        // Editing existing profile - back should just close the panel and go to home
        registerAction(() => {
          setShowAccountPanel(false);
          setActiveTab('Home');
          setCardTypeFilter('all');
          navigateTo('/home');
        });
      }
      // If selectedAccount is null (creating new profile), no back action registered
      // Back button will be handled by the native handler which goes to account type selector
    }

    if (showAccountTypeSelector) {
      registerAction(async () => {
        if (Capacitor.isNativePlatform()) {
          try {
            await App.minimizeApp();
          } catch (error) {
            console.warn('[JobLink] Failed to minimize app on back action:', error);
          }
          return;
        }

        // Keep the user on the account selector flow on web as well.
        return;
      });
    }

    return () => {
      activeActions.forEach((action) => popBackAction(action));
    };
  }, [showSubscriptionModal, showUpgradePanel, showAccountPanel, showAccountTypeSelector, navigate, navigateTo]);

  // Keep refs in sync with state for use in back button handler (prevents stale state closures)
  useEffect(() => {
    showAccountPanelRef.current = showAccountPanel;
    showAccountTypeSelectorRef.current = showAccountTypeSelector;
    selectedProfileRef.current = selectedProfile;
    selectedAccountRef.current = selectedAccount;
    showAdminPanelRef.current = showAdminPanel;
  }, [showAccountPanel, showAccountTypeSelector, selectedProfile, selectedAccount, showAdminPanel]);

  useEffect(() => {
    isNewProfileCreationRef.current = showAccountPanel && !selectedAccount;
  }, [showAccountPanel, selectedAccount]);

  // Clear the "profile just created" flag once we're safely on home page
  useEffect(() => {
    if (profileJustCreatedRef.current && activeTab === 'Home' && !showAccountPanel && !showAccountTypeSelector) {
      profileJustCreatedRef.current = false;
    }
  }, [activeTab, showAccountPanel, showAccountTypeSelector]);

  // Save selected account to localStorage whenever it changes
  const [realProfiles, setRealProfiles] = useState(() => {
    try {
      const cached = window.localStorage.getItem(HOME_PROFILES_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : [];
      return normalizeHomeProfilesCache(parsed);
    } catch (e) {
      return [];
    }
  });

  const mapProfileRowToUI = (p) => {
    const accountType = p.user_type || p.userType || 'employee';
    const avatarUrl = p.avatar_url || null;
    const avatar = avatarUrl || p.avatar || null;
    const isEmployer = accountType.toLowerCase() === 'employer' || accountType.toLowerCase() === 'company';
    const socialLinks = normalizeProfileSocialLinks(p);
    
    let normalizedMediaFiles = [];
    try {
      normalizedMediaFiles = normalizeProfileMediaFiles(p)
        .map(item => {
          try {
            return normalizeMediaItem(item);
          } catch (itemErr) {
            console.warn('[mapProfileRowToUI] Failed to normalize media item:', item, itemErr);
            return item; // Return item as-is if normalization fails
          }
        });
      try {
        const resolved = normalizedMediaFiles.map(m => resolveMediaUrl(m));
        console.log('[JobLink] ???? Resolved media URLs:', resolved);
      } catch (resErr) {
        console.warn('[JobLink] Failed to resolve media URLs for debug:', resErr);
      }
    } catch (normErr) {
      console.warn('[mapProfileRowToUI] Failed to normalize media for profile', p.id, normErr);
      normalizedMediaFiles = [];
    }

    return {
      id: p.id,
      userType: accountType,
      accountType,
      name: p.full_name || p.display_name || p.name || p.email || 'Unknown',
      email: p.email,
      phone: p.phone || p.phoneNumber || p.phone_number || p.contactPhone || p.contact_phone || p.mobile || p.mobileNumber || p.mobile_number || '',
      avatar_url: avatarUrl,
      avatar,
      title: p.title || 'Professional',
      bio: p.bio || '',
      location: p.location || '',
      rating: p.rating ?? 4.5,
      skills: p.skills || [],
      experience: p.experience || '',
      hourlyRate: p.hourly_rate || p.hourlyRate || '',
      availability: p.availability || 'Available',
      languages: p.languages || [],
      timezone: p.timezone || 'UTC',
      certifications: normalizeProfileListValue(p.certifications || p.credentials),
      projectTypes: p.project_types || p.projectTypes || [],
      workStyle: p.work_style || p.workStyle || '',
      portfolioWebsite: socialLinks.portfolioWebsite,
      github: socialLinks.github,
      linkedin: socialLinks.linkedin,
      twitter: socialLinks.twitter,
      instagram: socialLinks.instagram,
      facebook: socialLinks.facebook,
      tiktok: socialLinks.tiktok,
      whatsapp: socialLinks.whatsapp,
      followers: p.followers || 0,
      completedProjects: p.completed_projects || p.completedProjects || 0,
      responseTime: p.response_time || p.responseTime || '< 1 hour',
      reviews: p.reviews || [],
      like_count: p.like_count || 0,
      mediaFiles: normalizedMediaFiles,
      media_files: normalizedMediaFiles,
      portfolio: Array.isArray(p.portfolio) ? p.portfolio : [],
      media: Array.isArray(p.media) ? p.media : [],
      cardType: isEmployer ? 'employer' : 'worker'
    };
  };

  const hydrateProfileMediaForDisplay = useCallback(async (profile) => {
    if (!profile?.id) {
      return mapProfileRowToUI(profile);
    }

    try {
      const existingMedia = normalizeProfileMediaFiles(profile);
      const syncedMedia = await syncMediaFilesWithStorage(profile.id, existingMedia);
      const normalizedSyncedMedia = (Array.isArray(syncedMedia) ? syncedMedia : []).map(item => {
        try {
          return normalizeMediaItem(item);
        } catch (itemErr) {
          console.warn('[JobLink] Failed to normalize hydrated media item:', item, itemErr);
          return item;
        }
      });

      return {
        ...mapProfileRowToUI({ ...profile, mediaFiles: normalizedSyncedMedia, media_files: normalizedSyncedMedia }),
        mediaFiles: normalizedSyncedMedia,
        media_files: normalizedSyncedMedia,
      };
    } catch (err) {
      console.warn('[JobLink] Failed to hydrate profile media from database:', err);
      return mapProfileRowToUI(profile);
    }
  }, []);

  // Fetch like and view counts for profiles directly from the profiles table
  const fetchLikeViewCounts = useCallback(async (profileIds) => {
    const ids = (profileIds || []).filter(Boolean);
    if (ids.length === 0) {
      return { likeCount: {}, viewCount: {}, followersCount: {} };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, like_count, view_count, followers')
        .in('id', ids);

      if (error) {
        console.warn('[JobLink] Failed to fetch profile counts:', error);
        return { likeCount: {}, viewCount: {}, followersCount: {} };
      }

      const likeCount = {};
      const viewCount = {};
      const followersCount = {};

      (data || []).forEach(row => {
        likeCount[row.id] = Number(row.like_count) || 0;
        viewCount[row.id] = Number(row.view_count) || 0;
        followersCount[row.id] = Number(row.followers) || 0;
      });

      return { likeCount, viewCount, followersCount };
    } catch (err) {
      console.warn('[JobLink] Failed to fetch like/view counts:', err);
      return { likeCount: {}, viewCount: {}, followersCount: {} };
    }
  }, []);

  const fetchProfileCountsFromDB = useCallback(async (profileId) => {
    if (!profileId) return { like_count: 0, followers: null };

    try {
      const counts = await fetchLikeViewCounts([profileId]);
      const like_count = counts.likeCount?.[profileId] ?? 0;
      const followers = (counts.followersCount && counts.followersCount[profileId] !== undefined)
        ? counts.followersCount[profileId]
        : null;
      return { like_count, followers };
    } catch (err) {
      console.warn('[JobLink] Failed to fetch profile counts from DB:', err);
      return { like_count: 0, followers: null };
    }
  }, [fetchLikeViewCounts]);

  const fetchProfileFollowerCountFromDB = useCallback(async (profileId) => {
    if (!profileId) return null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('followers')
        .eq('id', profileId)
        .single();

      if (!profileError && profileData && typeof profileData.followers === 'number') {
        return Number(profileData.followers);
      }

      const { data: followRows, error: followError } = await supabase
        .from('follows')
        .select('id')
        .eq('followed_id', profileId);

      if (!followError) {
        return Array.isArray(followRows) ? followRows.length : null;
      }

      return null;
    } catch (err) {
      console.warn('[JobLink] Failed to fetch follower count from DB:', err);
      return null;
    }
  }, []);

  const refreshProfileFollowersFromDB = useCallback(async (profileId) => {
    if (!profileId) return;
    try {
      const followers = await fetchProfileFollowerCountFromDB(profileId);
      if (typeof followers !== 'number') {
        console.warn('[JobLink] refreshProfileFollowersFromDB did not receive numeric followers:', followers);
        return;
      }

      followersUpdateTimestamps.current[profileId] = Date.now();
      console.log(`[JobLink] 👥 refreshProfileFollowersFromDB for ${profileId}:`, followers);

      setRealProfiles(prev => prev.map(p => {
        if (String(p.id) !== String(profileId)) return p;
        return { ...p, followers };
      }));

      setSelectedProfile(prev => {
        if (!prev || String(prev.id) !== String(profileId)) return prev;
        return { ...prev, followers };
      });

      setSelectedAccount(prev => {
        if (!prev || String(prev.id) !== String(profileId)) return prev;
        return { ...prev, followers };
      });
    } catch (err) {
      console.warn('[JobLink] Failed to refresh profile followers from DB:', err);
    }   
  }, [fetchProfileFollowerCountFromDB]);

  // If we loaded cached `realProfiles` from localStorage, refresh their like/view counts
  // once after load so the grid doesn't show stale cached counts.
  useEffect(() => {
    if (!realProfiles || realProfiles.length === 0) return;

    let canceled = false;
    let didRun = false;

    const refreshCachedCounts = async () => {
      if (didRun) return;
      didRun = true;

      try {
        const profileIds = realProfiles.map(p => p.id).filter(Boolean);
        if (profileIds.length === 0) return;
        const counts = await fetchLikeViewCounts(profileIds);
        if (canceled) return;

        setRealProfiles(prev => {
          const updated = applyProfileCountUpdates(prev, counts);
          return updated;
        });
      } catch (err) {
        console.warn('[JobLink] Failed to refresh cached profile counts:', err);
      }
    };

    refreshCachedCounts();

    return () => { canceled = true; };
  }, [fetchLikeViewCounts, realProfiles]);

  useEffect(() => {
    if (!selectedAccount?.id) {
      return;
    }

    let canceled = false;

    const refreshSelectedAccountCounts = async () => {
      const { like_count, followers } = await fetchProfileCountsFromDB(selectedAccount.id);
      if (canceled) return;

      setSelectedAccount(prev => {
        if (!prev || prev.id !== selectedAccount.id) return prev;
        return {
          ...prev,
          like_count: typeof like_count === 'number' ? like_count : prev.like_count || 0,
          followers: typeof followers === 'number' ? followers : prev.followers || 0,
        };
      });

      if (selectedProfile?.id === selectedAccount.id) {
        setSelectedProfile(prev => {
          if (!prev || prev.id !== selectedAccount.id) return prev;
          return {
            ...prev,
            like_count: typeof like_count === 'number' ? like_count : prev.like_count || 0,
            followers: typeof followers === 'number' ? followers : prev.followers || 0,
          };
        });
      }
    };

    refreshSelectedAccountCounts();
    return () => { canceled = true; };
  }, [fetchProfileCountsFromDB, selectedAccount?.id, selectedProfile?.id, showAccountTypeSelector]);

  useEffect(() => {
    if (!selectedProfile?.id) {
      return;
    }

    let canceled = false;

    const refreshSelectedProfileCounts = async () => {
      const { like_count, followers } = await fetchProfileCountsFromDB(selectedProfile.id);
      if (canceled) return;

      setSelectedProfile(prev => {
        if (!prev || prev.id !== selectedProfile.id) return prev;
        
        // Check if followers were recently updated (within last 5 seconds)
        const lastUpdate = followersUpdateTimestamps.current[prev.id] || 0;
        const timeSinceUpdate = Date.now() - lastUpdate;
        const RECENT_UPDATE_THRESHOLD = 5000; // 5 seconds
        
        if (timeSinceUpdate < RECENT_UPDATE_THRESHOLD) {
          console.log(`[JobLink] 👥 Followers recently updated (${timeSinceUpdate}ms ago), keeping optimistic value`);
          return prev;
        }

        const dbFollowers = typeof followers === 'number' ? followers : prev.followers || 0;
        const dbLikeCount = typeof like_count === 'number' ? like_count : prev.like_count || 0;

        if (dbFollowers === prev.followers && dbLikeCount === prev.like_count) {
          return prev;
        }

        console.log('[JobLink] 👥 Profile counts refresh - applying DB counts:', { current: prev.followers, dbFollowers, currentLike: prev.like_count, dbLikeCount });
        return {
          ...prev,
          like_count: dbLikeCount,
          followers: dbFollowers,
        };
      });
    };

    refreshSelectedProfileCounts();
    return () => { canceled = true; };
  }, [fetchProfileCountsFromDB, hydrateProfileMediaForDisplay, hydrateProfileMediaForDisplay, selectedProfile?.id]);

  // Periodic refresh of follower counts - only run when the app is active and infrequently.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let canceled = false;
    let refreshInterval = null;
    let lastRefreshAt = 0;
    const REFRESH_COOLDOWN_MS = 120000;

    const refreshFollowerCounts = async () => {
      if (canceled || document.visibilityState !== 'visible') return;

      const now = Date.now();
      if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
        return;
      }
      lastRefreshAt = now;

      const profilesToRefresh = [];
      if (selectedAccount?.id) profilesToRefresh.push(selectedAccount.id);
      if (selectedProfile?.id && selectedProfile.id !== selectedAccount?.id) {
        profilesToRefresh.push(selectedProfile.id);
      }

      if (profilesToRefresh.length === 0) return;

      for (const profileId of profilesToRefresh) {
        try {
          const lastUpdate = followersUpdateTimestamps.current[profileId] || 0;
          const timeSinceUpdate = Date.now() - lastUpdate;
          const RECENT_UPDATE_THRESHOLD = 10000;

          if (timeSinceUpdate < RECENT_UPDATE_THRESHOLD) {
            continue;
          }

          const { followers } = await fetchProfileCountsFromDB(profileId);

          if (canceled) return;

          setRealProfiles(prev =>
            prev.map(p => {
              if (p.id !== profileId) return p;
              const newFollowers = typeof followers === 'number' ? followers : p.followers || 0;
              if ((p.followers || 0) === newFollowers) {
                return p;
              }
              return {
                ...p,
                followers: newFollowers,
              };
            })
          );

          if (profileId === selectedAccount?.id) {
            setSelectedAccount(prev => {
              if (!prev || prev.id !== profileId) return prev;
              const newFollowers = typeof followers === 'number' ? followers : prev.followers || 0;
              if ((prev.followers || 0) === newFollowers) return prev;
              return {
                ...prev,
                followers: newFollowers,
              };
            });
          }

          if (profileId === selectedProfile?.id) {
            setSelectedProfile(prev => {
              if (!prev || prev.id !== profileId) return prev;
              const newFollowers = typeof followers === 'number' ? followers : prev.followers || 0;
              if ((prev.followers || 0) === newFollowers) return prev;
              return {
                ...prev,
                followers: newFollowers,
              };
            });
          }
        } catch (err) {
          console.warn('[JobLink] Error refreshing follower count for profile:', profileId, err);
        }
      }
    };

    refreshInterval = setInterval(() => {
      refreshFollowerCounts();
    }, 300000);

    return () => {
      canceled = true;
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [fetchProfileCountsFromDB, selectedAccount?.id, selectedProfile?.id]);

  // Listen for follow updates from RealtimeListener component
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleFollowerUpdate = (event) => {
      const { userId, followers } = event.detail;
      console.log('[JobLink] � Received follow update event:', { userId, followers, currentUserId: user?.id });

      // Update selectedAccount if it's the current user
      if (user?.id === userId) {
        console.log('[JobLink] 👥 Updating selectedAccount followers:', followers);
        setSelectedAccount(prev => {
          if (!prev || prev.id !== userId) {
            console.log('[JobLink] ⚠️ selectedAccount mismatch or missing');
            return prev;
          }
          // record timestamp to avoid immediate overwrite by background refresh
          followersUpdateTimestamps.current[userId] = Date.now();
          return {
            ...prev,
            followers: typeof followers === 'number' ? followers : Number(followers) || prev.followers || 0,
          };
        });
      }

      // Update the home grid (realProfiles) so counts stay uniform across UI
      setRealProfiles(prev => prev.map(p => {
        if (p.id !== userId) return p;
        // record timestamp to avoid immediate overwrite by background refresh
        followersUpdateTimestamps.current[userId] = Date.now();
        return {
          ...p,
          followers: typeof followers === 'number' ? followers : Number(followers) || p.followers || 0,
        };
      }));

      // Update selectedProfile if it matches
      setSelectedProfile(prev => {
        if (!prev || prev.id !== userId) return prev;
        console.log('[JobLink] 👥 Updating selectedProfile followers:', followers);
        followersUpdateTimestamps.current[userId] = Date.now();
        return {
          ...prev,
          followers: typeof followers === 'number' ? followers : Number(followers) || prev.followers || 0,
        };
      });
    };

    window.addEventListener('joblink-follower-update', handleFollowerUpdate);
    console.log('[JobLink] ✅ Registered joblink-follower-update event listener');
    
    return () => {
      window.removeEventListener('joblink-follower-update', handleFollowerUpdate);
      console.log('[JobLink] ❌ Removed joblink-follower-update event listener');
    };
  }, [user?.id]);

  useEffect(() => {
    let canceled = false;
    const PAGE_SIZE = 6;
    let idleCallbackId = null;

    const fetchProfilePage = async (pageIndex) => {
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('[JobLink] profiles page fetch error:', error);
        throw error;
      }

      return data || [];
    };

    const appendProfiles = async (newProfiles) => {
      if (canceled || !newProfiles || newProfiles.length === 0) return;

      const profileIds = newProfiles.map(p => p.id).filter(Boolean);
      let likeCount = {}, followersCount = {};

      if (profileIds.length > 0) {
        const counts = await fetchLikeViewCounts(profileIds);
        likeCount = counts.likeCount;
        followersCount = counts.followersCount || {};
      }

      setRealProfiles(prev => {
        const existingIds = new Set(prev.map(profile => profile.id));
        const toAdd = newProfiles
          .filter(profile => !existingIds.has(profile.id))
          .map(p => {
              const followers = (followersCount && followersCount[p.id] !== undefined) ? followersCount[p.id] : (p.followers || 0);
              const mappedProfile = p.userType ? p : mapProfileRowToUI(p);
              return {
                ...mappedProfile,
                like_count: likeCount[p.id] || 0,
                followers,
              };
            });
        const nextValue = normalizeHomeProfilesCache([...prev, ...toAdd]);
        persistHomeProfilesCache(window.localStorage, HOME_PROFILES_CACHE_KEY, nextValue);
        return nextValue;
      });
    };

    const loadRemainingPages = async (startPage) => {
      let pageIndex = startPage;
      while (!canceled) {
        const nextProfiles = await fetchProfilePage(pageIndex);
        if (!nextProfiles || nextProfiles.length === 0) break;

        const nextMapped = await Promise.all(nextProfiles.map(hydrateProfileMediaForDisplay));
        appendProfiles(nextMapped);

        if (nextProfiles.length < PAGE_SIZE) break;
        pageIndex += 1;
      }
    };

    const loadInitialHomeProfiles = async () => {
      try {
        const initialProfiles = await fetchProfilePage(0);
        console.log('[JobLink] fetched initial profile page:', initialProfiles?.length);
        
        // Fetch like and view counts
        const profileIds = (initialProfiles || []).map(p => p.id);
        const { likeCount, followersCount } = await fetchLikeViewCounts(profileIds);

        const freshProfiles = (initialProfiles || []).map(p => {
          const profile = p.userType ? p : mapProfileRowToUI(p);
          return {
            ...profile,
            like_count: likeCount[p.id] || 0,
            followers: followersCount[p.id] ?? p.followers ?? 0,
          };
        });

        if (!canceled && freshProfiles.length > 0) {
          setRealProfiles(prev => {
            const next = Array.isArray(prev) ? [...prev] : [];
            for (const profile of freshProfiles) {
              const existingIndex = next.findIndex(p => String(p.id) === String(profile.id));
              if (existingIndex >= 0) {
                next[existingIndex] = { ...next[existingIndex], ...profile };
              } else {
                next.push(profile);
              }
            }
            const normalizedNext = normalizeHomeProfilesCache(next);
            persistHomeProfilesCache(window.localStorage, HOME_PROFILES_CACHE_KEY, normalizedNext);
            return normalizedNext;
          });
        }

        const scheduleBackgroundLoad = () => {
          if (canceled) return;

          if (window.requestIdleCallback) {
            idleCallbackId = window.requestIdleCallback(() => {
              loadRemainingPages(1).catch(error => {
                console.warn('[JobLink] failed to background-load remaining profile pages:', error);
              });
            });
          } else {
            setTimeout(() => {
              loadRemainingPages(1).catch(error => {
                console.warn('[JobLink] failed to background-load remaining profile pages:', error);
              });
            }, 100);
          }
        };

        // Hydrate profile media in the background after initial render
        const hydrateProfilesInBackground = async () => {
          if (canceled || !initialProfiles || initialProfiles.length === 0) return;
          try {
            const hydrated = await Promise.all(initialProfiles.map(hydrateProfileMediaForDisplay));
            if (canceled) return;
            setRealProfiles(prev => {
              const updated = prev.map(profile => {
                const hydratedProfile = hydrated.find(h => String(h.id) === String(profile.id));
                return hydratedProfile || profile;
              });
              const normalizedUpdated = normalizeHomeProfilesCache(updated);
              persistHomeProfilesCache(window.localStorage, HOME_PROFILES_CACHE_KEY, normalizedUpdated);
              return normalizedUpdated;
            });
          } catch (err) {
            console.warn('[JobLink] failed to hydrate initial profiles in background:', err);
          }
        };

        hydrateProfilesInBackground();

        scheduleBackgroundLoad();

        scheduleBackgroundLoad();
      } catch (error) {
        console.warn('[JobLink] failed to fetch profiles:', error);
      }
    };

    loadInitialHomeProfiles();
    return () => {
      canceled = true;
      if (idleCallbackId && window.cancelIdleCallback) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [fetchLikeViewCounts]);

  useEffect(() => {
    if (!user?.id) {
      setSelectedAccount(null);
      setSelectedAccountType(null);
      return;
    }

    let canceled = false;
    const loadCurrentProfile = async () => {
      try {
        console.log('[JobLink] 🔵 loadCurrentProfile START - user.id:', user.id);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        console.log('[JobLink] 🔵 Query result - data:', data, 'error:', error);
        if (data) {
          console.log('[JobLink] 📸 Media files from DB:', { media_files: data?.media_files, count: Array.isArray(data?.media_files) ? data.media_files.length : 0 });
          if (Array.isArray(data?.media_files) && data.media_files.length === 0) {
            console.log('[JobLink] 🔎 Raw DB row with empty media_files:', data);
          }
        }

        if (error && error.code !== 'PGRST116') {
          console.error('[JobLink] ❌ Query error (not PGRST116):', error.code, error.message);
          throw error;
        }

        if (error && error.code === 'PGRST116') {
          console.warn('[JobLink] ⚠️ Profile not found (PGRST116) for user:', user.id);
        }

        if (canceled) return;

        if (data) {
          console.log('[JobLink] ✅ Profile found, mapping:', { id: data.id, email: data.email, user_type: data.user_type });
          const mappedProfile = await hydrateProfileMediaForDisplay(data);
          console.log('[JobLink] 📸 Mapped profile media:', { mediaFiles: mappedProfile.mediaFiles?.length || 0, media_files: mappedProfile.media_files?.length || 0 });

          try {
            const { followers } = await fetchProfileCountsFromDB(data.id);
            mappedProfile.followers = typeof followers === 'number' ? followers : (data.followers ?? 0);
          } catch (countErr) {
            console.warn('[JobLink] Failed to fetch authoritative follower count:', countErr);
            mappedProfile.followers = data.followers ?? 0;
          }

          console.log('[JobLink] ✅ Setting selectedAccount with mapped profile:', { id: mappedProfile.id, name: mappedProfile.name, email: mappedProfile.email, userType: mappedProfile.userType });
          setSelectedAccount(mappedProfile);
          setSelectedAccountType(mappedProfile.userType);
          setShowLanding(false);
        } else {
          console.log('[JobLink] ❌ No profile data returned - setting selectedAccount to null');
          setSelectedAccount(null);
          setSelectedAccountType(null);
        }
      } catch (error) {
        console.error('[JobLink] ❌ Exception in loadCurrentProfile:', error.message || error);
      } finally {
        if (!canceled) {
          setProfileLoaded(true);
        }
      }
    };
    loadCurrentProfile();
    return () => { canceled = true; };
  }, [fetchProfileCountsFromDB, user?.id]);

  useEffect(() => {
    if (selectedAccount || !user?.id) {
      setProfileLoaded(true);
    }
  }, [selectedAccount, user?.id]);


  useEffect(() => {
    const currentHash = window.location.hash.slice(1) || '';
    const isAccountSelectorRoute = location.pathname === '/account-type-selector' || currentHash === '/account-type-selector';
    const isProtectedAppRoute = currentHash.startsWith('/home') || currentHash.startsWith('/trending') || currentHash.startsWith('/following') || currentHash.startsWith('/liked') || currentHash.startsWith('/search') || currentHash.startsWith('/profile');

    if (
      user?.id &&
      !selectedAccount?.id &&
      !showAccountTypeSelector &&
      !showAccountPanel &&
      !isAccountSelectorRoute &&
      isProtectedAppRoute &&
      profileLoaded
    ) {
      console.warn('[JobLink] user is authenticated without profile after load; redirecting to account selector');
      navigate('/account-type-selector', { replace: true });
    }
  }, [user?.id, selectedAccount?.id, showAccountTypeSelector, showAccountPanel, location.pathname, location.hash, navigate, profileLoaded]);

  // Load job postings from database
  useEffect(() => {
    let canceled = false;

    const loadJobPostings = async () => {
      try {
        console.log('[JobLink] 📋 Fetching job postings...');
        const { data, error } = await supabase
          .from('job_postings')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[JobLink] ❌ Failed to fetch job postings:', error);
          setUserCreatedJobPostings([]);
          return;
        }

        if (canceled) return;

        console.log('[JobLink] 📋 Fetched job postings data:', data);

        if (data && data.length > 0) {
          const mappedJobs = await Promise.all(data.map(async (job) => {
            let employerProfile = null;

            if (job.posted_by) {
              try {
                const { data: profileData, error: profileError } = await supabase
                  .from('profiles')
                  .select('id, media_files, mediaFiles, portfolio')
                  .eq('id', job.posted_by)
                  .maybeSingle();

                if (!profileError && profileData) {
                  employerProfile = profileData;
                }
              } catch (profileErr) {
                console.warn('[JobLink] Failed to fetch employer profile media:', profileErr);
              }
            }

            const mediaFiles = normalizeJobPostingMedia(job, employerProfile || {});
            const mapped = {
              id: job.id,
              cardType: 'job-ad',
              name: job.title || 'Job Opportunity', // JobCard uses 'name' for display
              title: job.title || 'Job Opportunity',
              bio: job.description || '', // JobCard uses 'bio' for the description
              description: job.description || '',
              company: job.company_name || '',
              location: job.location || '',
              salary: job.salary_range || '',
              jobType: job.job_type || 'Full-time',
              skills: job.required_skills ? (Array.isArray(job.required_skills) ? job.required_skills : (typeof job.required_skills === 'string' ? job.required_skills.split(',').map(s => s.trim()) : [])) : [],
              postedBy: job.posted_by || '',
              postedByName: job.employer_name || 'Employer',
              avatar: job.employer_avatar || null,
              like_count: job.like_count || 0,
              followers: 0,
              rating: 4.5,
              mediaFiles,
              media_files: mediaFiles
            };
            return mapped;
          }));

          setUserCreatedJobPostings(mappedJobs);
          console.log('[JobLink] ✅ Loaded', mappedJobs.length, 'job postings:', mappedJobs);
        } else {
          console.log('[JobLink] ⚠️ No job postings found in database');
          setUserCreatedJobPostings([]);
        }
      } catch (error) {
        console.error('[JobLink] 🔴 Exception loading job postings:', error);
        setUserCreatedJobPostings([]);
      }
    };

    loadJobPostings();
    return () => { canceled = true; };
  }, []);

  // Real-time listener for followers count updates on the current user profile
  useEffect(() => {
    if (!user?.id) return;

    let subscription;
    const setupFollowersListener = async () => {
      try {
        subscription = supabase
          .channel(`profiles:${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
            async (payload) => {
              // Update selected account directly from realtime payload when current user profile changes.
              try {
                const updatedProfile = payload?.new || payload?.record;
                if (!updatedProfile) return;

                // Ensure media are hydrated for display
                const mappedProfile = await hydrateProfileMediaForDisplay(updatedProfile);
                mappedProfile.followers = updatedProfile.followers ?? (mappedProfile.followers || 0);
                setSelectedAccount(mappedProfile);
              } catch (err) {
                console.warn('[JobLink] Failed to update selected account from realtime payload:', err);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('[JobLink] Failed to setup followers listener:', err);
      }
    };

    setupFollowersListener();
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [user?.id]);

  // Real-time listener for any profile updates so follower counts refresh across devices
  useEffect(() => {
    let subscription;

    const handleProfileUpdate = async (payload) => {
      const updatedProfile = payload?.new || payload?.record || payload?.new_record;
      if (!updatedProfile?.id) return;

      try {
        // Try to hydrate the incoming profile so media are normalized for display
        const mapped = await hydrateProfileMediaForDisplay(updatedProfile);

        setRealProfiles(prev => prev.map(p => (String(p.id) === String(mapped.id) ? mapped : p)));

        setSelectedProfile(prev => (prev && String(prev.id) === String(mapped.id) ? { ...prev, ...mapped, cardType: prev.cardType || mapped.cardType } : prev));

        setSelectedAccount(prev => (prev && String(prev.id) === String(mapped.id) ? { ...prev, ...mapped, cardType: prev.cardType || mapped.cardType } : prev));

        return;
      } catch (err) {
        console.warn('[JobLink] Failed to hydrate profile update payload, falling back to count-only update:', err);
      }

      // Fallback: update only counts if hydration fails
      setRealProfiles((prev) => prev.map((profile) => {
        if (profile.id !== updatedProfile.id) return profile;
        return {
          ...profile,
          followers: typeof updatedProfile.followers === 'number'
            ? updatedProfile.followers
            : profile.followers || 0,
          like_count: typeof updatedProfile.like_count === 'number'
            ? updatedProfile.like_count
            : profile.like_count || 0,
        };
      }));

      setSelectedProfile((prev) => {
        if (!prev || prev.id !== updatedProfile.id) return prev;
        return {
          ...prev,
          followers: typeof updatedProfile.followers === 'number'
            ? updatedProfile.followers
            : prev.followers || 0,
          like_count: typeof updatedProfile.like_count === 'number'
            ? updatedProfile.like_count
            : prev.like_count || 0,
        };
      });

      setSelectedAccount((prev) => {
        if (!prev || prev.id !== updatedProfile.id) return prev;
        return {
          ...prev,
          followers: typeof updatedProfile.followers === 'number'
            ? updatedProfile.followers
            : prev.followers || 0,
          like_count: typeof updatedProfile.like_count === 'number'
            ? updatedProfile.like_count
            : prev.like_count || 0,
        };
      });
    };

    const setupProfileListener = async () => {
      try {
        subscription = supabase
          .channel('profiles:updates')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            handleProfileUpdate
          )
          .subscribe((status) => {
            console.log('[JobLink] Profiles subscription status:', status);
          });
      } catch (err) {
        console.warn('[JobLink] Failed to setup profile updates listener:', err);
      }
    };

    setupProfileListener();
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    let subscription;

    const handleFollowRealtimeEvent = async (payload) => {
      try {
        const rec = payload?.new || payload?.record || payload?.new_record;
        const oldRec = payload?.old || payload?.old_record;
        const followedId = (rec && (rec.followed_id || rec.followed || rec.target || rec.target_user_id))
          || (oldRec && (oldRec.followed_id || oldRec.followed || oldRec.target || oldRec.target_user_id));
        if (!followedId) return;

        console.log('[JobLink] Realtime follow event received for:', followedId, payload.eventType || payload.type);
        await refreshProfileFollowersFromDB(followedId);
      } catch (err) {
        console.warn('[JobLink] Failed to process follow realtime event:', err);
      }
    };

    const setupFollowListener = async () => {
      try {
        subscription = supabase
          .channel('follows:updates')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, handleFollowRealtimeEvent)
          .subscribe((status) => {
            console.log('[JobLink] Follows subscription status:', status);
          });
      } catch (err) {
        console.warn('[JobLink] Failed to setup follow updates listener:', err);
      }
    };

    setupFollowListener();
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [refreshProfileFollowersFromDB, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLikedItems({});
      return;
    }

    let canceled = false;
    let pollInterval = null;

    const loadLikedItems = async () => {
      try {
        const { data, error } = await supabase
          .from('likes')
          .select('liked_profile_id')
          .eq('liker_id', user.id);

        if (error) throw error;

        if (!canceled) {
          const likedMap = {};
          (data || []).forEach(like => {
            likedMap[like.liked_profile_id] = true;
          });
          console.log(`[JobLink] Loaded ${Object.keys(likedMap).length} liked items`);
          setLikedItems(likedMap);
        }
      } catch (e) {
        console.warn('[JobLink] failed to load liked items:', e);
      }
    };

    loadLikedItems();

    // Real-time subscription is sufficient; avoid polling loops that hammer the DB.
    const likesSubscription = supabase
      .channel(`likes:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `liker_id=eq.${user.id}`
        },
        (payload) => {
          console.log(`[JobLink] Real-time: Likes changed (${payload.eventType})`);
          const newRec = payload?.new || payload?.record || payload?.new_record;
          const oldRec = payload?.old || payload?.old_record;
          const profileId = newRec?.liked_profile_id || oldRec?.liked_profile_id;
          if (!profileId) return;

          setLikedItems((prev) => {
            const next = { ...prev };
            const eventType = payload?.eventType || payload?.type;
            if (eventType === 'DELETE') {
              delete next[profileId];
            } else if (newRec) {
              next[profileId] = true;
            }
            return next;
          });
        }
      )
      .subscribe((status) => {
        console.log(`[JobLink] Likes subscription status:`, status);
      });

    return () => {
      canceled = true;
      if (pollInterval) clearInterval(pollInterval);
      likesSubscription?.unsubscribe?.();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setBookmarkedItems({});
      return;
    }

    let canceled = false;

    const loadBookmarkedItems = async () => {
      try {
        const { data, error } = await supabase
          .from('bookmarks')
          .select('bookmarked_profile_id')
          .eq('user_id', user.id);

        if (error) throw error;

        if (!canceled) {
          const bookmarkedMap = {};
          (data || []).forEach((bookmark) => {
            if (bookmark?.bookmarked_profile_id) {
              bookmarkedMap[bookmark.bookmarked_profile_id] = true;
            }
          });
          console.log(`[JobLink] Loaded ${Object.keys(bookmarkedMap).length} bookmarked items`);
          setBookmarkedItems(bookmarkedMap);
        }
      } catch (e) {
        console.warn('[JobLink] failed to load bookmarked items:', e);
      }
    };

    loadBookmarkedItems();

    const bookmarksSubscription = supabase
      .channel(`bookmarks:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookmarks',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log(`[JobLink] Real-time: Bookmarks changed (${payload.eventType})`);
          const newRec = payload?.new || payload?.record || payload?.new_record;
          const oldRec = payload?.old || payload?.old_record;
          const profileId = newRec?.bookmarked_profile_id || oldRec?.bookmarked_profile_id;
          if (!profileId) return;

          setBookmarkedItems((prev) => {
            const next = { ...prev };
            const eventType = payload?.eventType || payload?.type;
            if (eventType === 'DELETE') {
              delete next[profileId];
            } else if (newRec) {
              next[profileId] = true;
            }
            return next;
          });
        }
      )
      .subscribe((status) => {
        console.log(`[JobLink] Bookmarks subscription status:`, status);
      });

    return () => {
      canceled = true;
      bookmarksSubscription?.unsubscribe?.();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setFollowingItems({});
      return;
    }

    let canceled = false;

    const loadFollowingItems = async () => {
      try {
        const { data, error } = await supabase
          .from('follows')
          .select('followed_id')
          .eq('follower_id', user.id);

        if (error) throw error;

        if (!canceled) {
          const followingMap = {};
          (data || []).forEach((row) => {
            if (row?.followed_id) {
              followingMap[row.followed_id] = true;
            }
          });
          setFollowingItems(followingMap);
        }
      } catch (err) {
        console.warn('[JobLink] failed to load following items:', err);
      }
    };

    loadFollowingItems();

    const subscription = supabase
      .channel(`following:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${user.id}` },
        (payload) => {
          console.log('[JobLink] following list changed:', payload.eventType);
          const newRec = payload?.new || payload?.record || payload?.new_record;
          const oldRec = payload?.old || payload?.old_record;
          const addedId = newRec?.followed_id || newRec?.followed;
          const removedId = oldRec?.followed_id || oldRec?.followed;

          setFollowingItems((prev) => {
            const next = { ...prev };
            const eventType = payload?.eventType || payload?.type;
            if (eventType === 'DELETE' || removedId) {
              delete next[removedId];
            }
            if (newRec && addedId) {
              next[addedId] = true;
            }
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      canceled = true;
      if (subscription) subscription.unsubscribe();
    };
  }, [user?.id]);

  const employerProfiles = useMemo(
    () => realProfiles.filter(profile => String(profile.userType).toLowerCase() === 'employer'),
    [realProfiles]
  );

  const allProfiles = useMemo(
    () => realProfiles.filter(profile => String(profile.userType).toLowerCase() !== 'employer'),
    [realProfiles]
  );

  // Only build the search index when the user has entered a search term.
  const searchIndex = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) return null;
    return buildSearchIndex(allProfiles);
  }, [allProfiles, searchTerm]);

  const filteredProfiles = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) {
      return allProfiles;
    }
    return filterProfilesWithIndex(allProfiles, searchTerm, searchIndex);
  }, [allProfiles, searchTerm, searchIndex]);

  const employerJobPostings = useMemo(
    () => employerProfiles.map(profile => ({
      id: profile.id,
      cardType: 'job-ad',
      name: profile.name || profile.title || 'Employer',
      title: profile.title || 'Job Opportunity',
      bio: profile.bio || '',
      description: profile.bio || '',
      company: profile.name || '',
      location: profile.location || '',
      salary: profile.hourlyRate || profile.salary || '',
      jobType: profile.availability || 'Full-time',
      skills: Array.isArray(profile.skills) ? profile.skills : (profile.skills ? String(profile.skills).split(',').map(s => s.trim()) : []),
      postedBy: profile.id,
      postedByName: profile.name || 'Employer',
      avatar: profile.avatar || null,
      like_count: profile.like_count || 0,
      followers: profile.followers || 0,
      rating: profile.rating || 4.5,
      mediaFiles: Array.isArray(profile.mediaFiles) ? profile.mediaFiles : (Array.isArray(profile.media_files) ? profile.media_files : []),
      media_files: Array.isArray(profile.mediaFiles) ? profile.mediaFiles : (Array.isArray(profile.media_files) ? profile.media_files : []),
      portfolio: Array.isArray(profile.portfolio) ? profile.portfolio : [],
      media: Array.isArray(profile.media) ? profile.media : []
    })),
    [employerProfiles]
  );

  const allJobPostings = useMemo(
    () => [...employerJobPostings, ...userCreatedJobPostings],
    [employerJobPostings, userCreatedJobPostings]
  );

  const filteredJobPostings = useMemo(
    () => filterJobPostings(allJobPostings, searchTerm),
    [allJobPostings, searchTerm]
  );

  useEffect(() => {
    if (!selectedProfile?.id) return;

    const sourceProfiles = selectedProfile.cardType === 'job-ad' ? allJobPostings : realProfiles;
    const matchingProfile = sourceProfiles.find((profile) => String(profile.id) === String(selectedProfile.id));

    if (!matchingProfile) return;

    const likeCountChanged = matchingProfile.like_count !== selectedProfile.like_count;
    const followersChanged = matchingProfile.followers !== selectedProfile.followers;

    if (likeCountChanged || followersChanged) {
      setSelectedProfile((prev) => {
        if (!prev || String(prev.id) !== String(matchingProfile.id)) return prev;
        return {
          ...prev,
          ...matchingProfile,
        };
      });
    }
  }, [allJobPostings, realProfiles, selectedProfile]);

  const { showToast } = useNotifications();

  const updateProfileFollowers = useCallback((profileId, delta) => {
    console.log(`[JobLink] 👥 updateProfileFollowers called: profileId=${profileId}, delta=${delta}`);
    
    // Record when we updated followers for this profile (prevents refresh from overwriting)
    followersUpdateTimestamps.current[profileId] = Date.now();
    
    setRealProfiles(prev => {
      const updated = prev.map(profile => {
        if (String(profile.id) === String(profileId)) {
          const currentFollowers = Number(profile.followers || 0);
          const newCount = Math.max(0, currentFollowers + delta);
          console.log(`[JobLink] 👥 Updated realProfiles for ${profileId}: ${currentFollowers} → ${newCount}`);
          return {
            ...profile,
            followers: newCount
          };
        }
        return profile;
      });
      return updated;
    });

    setSelectedProfile(prev => {
      if (prev && String(prev.id) === String(profileId)) {
        const currentFollowers = Number(prev.followers || 0);
        const newCount = Math.max(0, currentFollowers + delta);
        console.log(`[JobLink] 👥 Updated selectedProfile: ${currentFollowers} → ${newCount}`);
        return {
          ...prev,
          followers: newCount
        };
      }
      return prev;
    });

    setSelectedAccount(prev => {
      if (prev && String(prev.id) === String(profileId)) {
        const currentFollowers = Number(prev.followers || 0);
        const newCount = Math.max(0, currentFollowers + delta);
        console.log(`[JobLink] 👥 Updated selectedAccount: ${currentFollowers} → ${newCount}`);
        return {
          ...prev,
          followers: newCount
        };
      }
      return prev;
    });
  }, []);

  // Note: Real-time like count updates now flow through profile update listener (via DB trigger)
  // The database trigger automatically updates profiles.like_count when likes are inserted/deleted

  // Note: Real-time view count updates now flow through profile update listener (via DB trigger)
  // The database trigger automatically updates profiles.view_count when profile_views are inserted

  const syncProfileCountsFromDB = useCallback(async (profileId) => {
    if (!profileId) return;

    try {
      const { like_count, followers } = await fetchProfileCountsFromDB(profileId);
      const nextLikeCount = typeof like_count === 'number' ? like_count : 0;
      const nextFollowerCount = typeof followers === 'number' ? followers : null;

      setRealProfiles(prev => prev.map(profile => {
        if (String(profile.id) !== String(profileId)) return profile;
        return {
          ...profile,
          like_count: nextLikeCount,
          followers: nextFollowerCount ?? profile.followers ?? 0,
        };
      }));

      setSelectedProfile(prev => {
        if (!prev || String(prev.id) !== String(profileId)) return prev;
        return {
          ...prev,
          like_count: nextLikeCount,
          followers: nextFollowerCount ?? prev.followers ?? 0,
        };
      });

      setSelectedAccount(prev => {
        if (!prev || String(prev.id) !== String(profileId)) return prev;
        return {
          ...prev,
          like_count: nextLikeCount,
          followers: nextFollowerCount ?? prev.followers ?? 0,
        };
      });
    } catch (err) {
      console.warn('[JobLink] Failed to sync profile counts from DB:', err);
    }
  }, [fetchProfileCountsFromDB]);

  const toggleLiked = async (jobId) => {
    console.log('[JobLink.toggleLiked] 🎯 Called for jobId:', jobId);
    const likerId = user?.id;
    if (!likerId) {
      console.log('[JobLink.toggleLiked] ❌ No user ID found');
      showToast({ type: 'info', title: 'Sign in', message: 'Please sign in to like profiles' });
      return;
    }

    const currentlyLiked = !!likedItems[jobId];
    console.log('[JobLink.toggleLiked] Current state - liked:', currentlyLiked, 'likedItems:', likedItems);

    try {
      if (!currentlyLiked) {
        console.log(`[JobLink.toggleLiked] 📤 Inserting like: liker=${likerId}, target=${jobId}`);
        const { error } = await supabase.from('likes').insert({ liker_id: likerId, liked_profile_id: jobId });
        if (error) {
          console.error('[JobLink.toggleLiked] ❌ Like insert error:', error);
          if (error.code !== '23505') {
            showToast({ type: 'error', title: 'Error', message: 'Failed to like profile' });
            return;
          }
          setLikedItems(prev => ({ ...prev, [jobId]: true }));
          await syncProfileCountsFromDB(jobId);
          return;
        }

        console.log(`[JobLink.toggleLiked] ✅ Like inserted successfully`);
        setLikedItems(prev => {
          const next = { ...prev, [jobId]: true };
          console.log('[JobLink.toggleLiked] 💾 Updated likedItems:', next);
          return next;
        });
        await syncProfileCountsFromDB(jobId);
      } else {
        console.log(`[JobLink.toggleLiked] 📥 Deleting like: liker=${likerId}, target=${jobId}`);
        const { error } = await supabase.from('likes').delete().eq('liker_id', likerId).eq('liked_profile_id', jobId);
        if (error) {
          console.error('[JobLink.toggleLiked] ❌ Like delete error:', error);
          return;
        }

        console.log(`[JobLink.toggleLiked] ✅ Like deleted successfully`);
        setLikedItems(prev => {
          const next = { ...prev, [jobId]: false };
          console.log('[JobLink.toggleLiked] 💾 Updated likedItems:', next);
          return next;
        });
        await syncProfileCountsFromDB(jobId);
      }
    } catch (e) {
      console.error('[JobLink.toggleLiked] ❌ Exception:', e);
    }
  };

  const toggleBookmarked = async (jobId) => {
    const userId = user?.id;
    if (!userId) {
      showToast({ type: 'info', title: 'Sign in', message: 'Please sign in to bookmark profiles' });
      return;
    }

    const currentlyBookmarked = !!bookmarkedItems[jobId];

    try {
      if (!currentlyBookmarked) {
        console.log(`[toggleBookmarked] Inserting bookmark: user=${userId}, target=${jobId}`);
        const { data, error } = await supabase.from('bookmarks').insert({ user_id: userId, bookmarked_profile_id: jobId });
        if (error) {
          const isDuplicate = error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate');
          if (isDuplicate) {
            console.warn('[toggleBookmarked] Duplicate bookmark detected, treating as bookmarked');
            setBookmarkedItems(prev => ({ ...prev, [jobId]: true }));
            return;
          }
          console.error('[toggleBookmarked] ❌ Bookmark insert error:', error);
          showToast({ type: 'error', title: 'Error', message: 'Failed to bookmark profile' });
          return;
        }
        console.log(`[toggleBookmarked] ✅ Bookmark inserted successfully:`, data);
        setBookmarkedItems(prev => ({ ...prev, [jobId]: true }));
      } else {
        console.log(`[toggleBookmarked] Deleting bookmark: user=${userId}, target=${jobId}`);
        const { error } = await supabase.from('bookmarks').delete().eq('user_id', userId).eq('bookmarked_profile_id', jobId);
        if (error) {
          console.error('[toggleBookmarked] ❌ Bookmark delete error:', error);
          showToast({ type: 'error', title: 'Error', message: 'Failed to remove bookmark' });
          return;
        }
        console.log(`[toggleBookmarked] ✅ Bookmark deleted successfully`);
        setBookmarkedItems(prev => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      }
    } catch (e) {
      console.error('[toggleBookmarked] ❌ Exception:', e);
      showToast({ type: 'error', title: 'Error', message: 'Unable to update bookmark. Try again.' });
    }
  };

  const toggleFollowing = async (jobId) => {
    const userId = user?.id;
    if (!userId) {
      showToast({ type: 'error', title: 'Error', message: 'Not authenticated' });
      return;
    }

    // Prevent following yourself
    if (userId === jobId) {
      showToast({ type: 'error', title: 'Error', message: 'You cannot follow yourself' });
      return;
    }

    const currentlyFollowing = !!followingItems[jobId];
    console.log(`[toggleFollowing] 👥 Toggle follow for ${jobId}, currently following: ${currentlyFollowing}`);

    try {
      if (!currentlyFollowing) {
        // Insert follow
        console.log(`[toggleFollowing] 👥 Inserting follow: follower=${userId}, followed=${jobId}`);
        const { data, error } = await supabase.from('follows').insert({ follower_id: userId, followed_id: jobId });
        if (error) {
          console.error('[toggleFollowing] ❌ Follow insert error:', error);
          const isDuplicate = error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate');
          if (isDuplicate) {
            console.warn('[toggleFollowing] Duplicate follow detected, treating as followed');
            setFollowingItems(prev => ({
              ...prev,
              [jobId]: true
            }));
            return;
          }
          showToast({ type: 'error', title: 'Error', message: 'Failed to follow profile' });
          return;
        }
        console.log(`[toggleFollowing] ✅ Follow inserted successfully:`, data);
        
        // Update UI optimistically
        setFollowingItems(prev => ({
          ...prev,
          [jobId]: true
        }));
        
        // Update follower count in realProfiles
        console.log(`[toggleFollowing] 👥 Incrementing follower count for ${jobId}`);
        updateProfileFollowers(jobId, 1);
        refreshProfileFollowersFromDB(jobId);
        
        // Removed success toast for follow to reduce UI noise
      } else {
        // Remove follow
        console.log(`[toggleFollowing] 👥 Deleting follow: follower=${userId}, followed=${jobId}`);
        const { error } = await supabase.from('follows').delete().eq('follower_id', userId).eq('followed_id', jobId);
        if (error) {
          console.error('[toggleFollowing] ❌ Follow delete error:', error);
          showToast({ type: 'error', title: 'Error', message: 'Failed to unfollow profile' });
          return;
        }
        console.log(`[toggleFollowing] ✅ Follow deleted successfully`);
        
        // Update UI
        setFollowingItems(prev => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
        
        // Update follower count in realProfiles
        console.log(`[toggleFollowing] 👥 Decrementing follower count for ${jobId}`);
        updateProfileFollowers(jobId, -1);
        refreshProfileFollowersFromDB(jobId);
        
        // Removed info toast for unfollow to reduce UI noise
      }
    } catch (e) {
      console.error('[toggleFollowing] 🔴 Error:', e);
      showToast({ type: 'error', title: 'Error', message: 'Unable to update follow. Try again.' });
    }
  };

  const handleSearchChange = (term) => {
    setSearchTerm(term);
  };

  const handleOpenProfile = (profileToEdit) => {
    // If a profile is passed (from Update button), open edit form
    if (profileToEdit) {
      console.log('Loading profile for editing:', profileToEdit);
      // Clear the "just created" flag since we're editing an existing profile, not in fresh onboarding
      profileJustCreatedRef.current = false;
      const targetRoute = profileToEdit.userType === 'employee' ? '/edit-profile-employee' : '/edit-profile-employer';
      setSelectedAccount(profileToEdit);
      setSelectedAccountType(profileToEdit.userType);
      setShowAccountTypeSelector(false);
      setActiveTab('Profile');
      setShowAccountPanel(true);

      const currentHash = window.location.hash.slice(1);
      if (currentHash !== targetRoute) {
        navigateTo(targetRoute);
      } else {
        currentHashRef.current = null;
        parseHashAndUpdateState();
      }
    } else {
      // Navigate to the "You" Profile view and display the user's own profile card
      setActiveTab('Profile');
      setSelectedProfile(selectedAccount);
    }
  };

  const closeSelectedProfile = useCallback(() => {
    setSelectedProfile(null);
    setActiveTab('Home');
    setCardTypeFilter('all');
    try {
      sessionStorage.removeItem('joblinkPendingProfileRestore');
    } catch (e) {
      console.warn('Failed to clear profile restore:', e);
    }
    navigateTo('/home');
  }, [navigateTo]);

  const handleSelectProfile = useCallback((profile) => {
    if (!profile) {
      closeSelectedProfile();
      return;
    }

    setSelectedProfile(profile);
  }, [closeSelectedProfile]);

  const handleUpdateAvatar = async (avatarImage, avatarPath) => {
    if (!selectedAccount) return;

    const profileId = selectedAccount.id;
    const updatedAccount = {
      ...selectedAccount,
      avatar: avatarImage,
      avatar_url: avatarImage,
      avatarPath: avatarPath || selectedAccount.avatarPath || null,
    };

    setSelectedAccount(updatedAccount);
    setSelectedProfile((prev) => (prev && prev.id === profileId ? { ...prev, avatar: avatarImage, avatar_url: avatarImage } : prev));
    setRealProfiles((prev) => prev.map((profile) =>
      profile.id === profileId ? { ...profile, avatar: avatarImage, avatar_url: avatarImage } : profile
    ));
    console.log('Avatar updated locally for profile:', updatedAccount);

    try {
      if (!profileId) {
        console.warn('[handleUpdateAvatar] Missing profile id, cannot persist avatar_url');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarImage, updated_at: new Date().toISOString() })
        .eq('id', profileId);

      if (error) {
        console.error('[handleUpdateAvatar] Failed to persist avatar_url to profile:', error);

        // If update was blocked by row-level security, fall back to a server-side admin endpoint
        const message = (error && (error.message || '')) || '';
        if (/row-level security|row level security|violates row-level security/i.test(message)) {
          try {
            // Try to send the current session token so server can verify the user
            let headers = { 'Content-Type': 'application/json' };
            try {
              const { data: { session } = {} } = await supabase.auth.getSession();
              const token = session?.access_token;
              if (token) headers['Authorization'] = `Bearer ${token}`;
            } catch (e) {
              // ignore session retrieval errors
            }

            const resp = await fetch(`${API_URL}/api/account/avatar`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ avatar_url: avatarImage, avatar_path: avatarPath }),
            });

            if (!resp.ok) {
              const payload = await resp.json().catch(() => null);
              console.error('[handleUpdateAvatar] Admin fallback failed:', payload || resp.statusText);
            }
          } catch (fallbackErr) {
            console.error('[handleUpdateAvatar] Admin fallback error:', fallbackErr);
          }
        }
      }
    } catch (err) {
      console.error('[handleUpdateAvatar] Unexpected error persisting avatar_url:', err);
    }
  };

  const handleSwitchAccount = () => {
    navigateTo('/account-type-selector');
  };

  const handleSelectAccountType = (accountType, profession, birthDate) => {
    // Start fresh creation flow by clearing any previous selectedAccount
    selectedAccountRef.current = null;
    isNewProfileCreationRef.current = true;
    profileJustCreatedRef.current = false;

    setSelectedAccount(null);
    setSelectedAccountType(accountType);
    localStorage.setItem('accountType', accountType);
    if (profession) {
      localStorage.setItem('selectedProfession', JSON.stringify(profession));
    }
    if (birthDate) {
      localStorage.setItem('dateOfBirth', birthDate);
    }
    
    // Hide account type selector and show account panel
    setShowAccountTypeSelector(false);
    setShowAccountPanel(true);
    
    // Finally navigate - order matters for state updates
    setTimeout(() => {
      if (accountType === 'employee') {
        navigateTo('/edit-profile-employee');
      } else if (accountType === 'employer') {
        navigateTo('/edit-profile-employer');
      }
    }, 0);
  };

  const closeAccountPanel = useCallback((shouldReturnToAccountSelector = false) => {
    setShowAccountPanel(false);
    setSelectedAccountType(null);

    if (shouldReturnToAccountSelector) {
      setShowAccountTypeSelector(true);
      navigateTo('/account-type-selector');
      return;
    }

    setShowAccountTypeSelector(false);
    setActiveTab('Home');
    setCardTypeFilter('all');
    navigateTo('/home');
  }, [navigateTo]);

  const shouldReturnToAccountSelector = useCallback(() => {
    const draftExists = Boolean(localStorage.getItem('joblinkPendingProfileDraft'));
    return !selectedAccount && !draftExists;
  }, [selectedAccount]);

  const selectedProfileMediaFetchAttempted = useRef(null);

  // Ensure selectedProfile has up-to-date media files — fetch fresh if missing
  useEffect(() => {
    if (!selectedProfile || !selectedProfile.id) return;
    if (selectedProfileMediaFetchAttempted.current === selectedProfile.id) return;

    const hasMedia = (
      (Array.isArray(selectedProfile.mediaFiles) && selectedProfile.mediaFiles.length > 0) ||
      (Array.isArray(selectedProfile.media_files) && selectedProfile.media_files.length > 0) ||
      (Array.isArray(selectedProfile.portfolio) && selectedProfile.portfolio.length > 0) ||
      (Array.isArray(selectedProfile.media) && selectedProfile.media.length > 0)
    );

    if (hasMedia) {
      selectedProfileMediaFetchAttempted.current = selectedProfile.id;
      return;
    }

    selectedProfileMediaFetchAttempted.current = selectedProfile.id;
    let mounted = true;
    (async () => {
      try {
        console.log('[JobLink] Selected profile missing media, fetching fresh profile:', selectedProfile.id);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', selectedProfile.id)
          .single();

        if (error) {
          console.warn('[JobLink] Failed to fetch profile from DB:', error);
          return;
        }

        const mapped = await hydrateProfileMediaForDisplay(data);
        if (!mounted) return;

        console.log('[JobLink] Fetched profile media count:', mapped.mediaFiles?.length || 0);

        // Update selectedProfile and realProfiles with authoritative DB media
        setSelectedProfile(prev => (prev && String(prev.id) === String(mapped.id)) ? { ...prev, ...mapped, cardType: prev.cardType || mapped.cardType } : prev);
        setRealProfiles(prev => prev.map(p => (String(p.id) === String(mapped.id) ? mapped : p)));
      } catch (e) {
        console.error('[JobLink] Error fetching fresh profile:', e);
      }
    })();

    return () => { mounted = false; };
  }, [selectedProfile?.id]);

  const handleProfileCreated = async (profileData) => {
    const otpProof = profileData?._otpVerified || sessionStorage.getItem('joblinkOtpVerificationId');
    if (!otpProof) {
      console.warn('[handleProfileCreated] Blocked profile save without verified OTP proof');
      showToast({ type: 'error', title: 'Error', message: 'Profile save is still pending verification.' });
      return;
    }

    sessionStorage.removeItem('joblinkOtpVerificationId');

    const userId = (user && user.id) ? user.id : profileData.id;
    if (!userId) {
      console.error('[handleProfileCreated] No authenticated user ID available to create profile');
      showToast({ type: 'error', title: 'Error', message: 'Unable to identify current user. Please sign in again.' });
      return;
    }

    const normalizedEmail = profileData.email ? profileData.email.trim().toLowerCase() : null;
    const normalizedBirthDate = profileData.dateOfBirth || profileData.birthDate || localStorage.getItem('dateOfBirth') || null;
    const normalizedIncomingMediaFiles = normalizeProfileMediaFiles(profileData);
    const simplifiedIncomingMedia = serializeMediaForDatabase(normalizedIncomingMediaFiles);
    console.log('[handleProfileCreated] 📸 Incoming media from form:', { count: simplifiedIncomingMedia.length, sample: simplifiedIncomingMedia.slice(0, 2) });
    const newProfile = {
      userType: profileData.userType || 'employee',
      
      // Basic Info
      name: profileData.name || '',
      email: normalizedEmail,
      phone: profileData.phone || '',
      dateOfBirth: normalizedBirthDate,
      avatar: profileData.avatar || null,
    avatarPath: profileData.avatarPath || null,
      title: profileData.title || 'Professional',
      bio: profileData.bio || '',
      location: profileData.location || '',
      
      // Professional Info
      skills: Array.isArray(profileData.skills) ? profileData.skills : (profileData.skills ? profileData.skills.split(',').map(s => s.trim()) : []),
      certifications: normalizeProfileListValue(profileData.certifications),
      experience: profileData.experience || '',
      hourlyRate: profileData.hourlyRate || '',
      availability: profileData.availability || 'Available',
      languages: Array.isArray(profileData.languages) ? profileData.languages : (profileData.languages ? [profileData.languages] : []),
      timezone: profileData.timezone || '',
      
      // Work Preferences
      projectTypes: Array.isArray(profileData.projectTypes) ? profileData.projectTypes : (profileData.projectTypes ? profileData.projectTypes.split(',').map(p => p.trim()) : []),
      workStyle: profileData.workStyle || 'Remote',
      
      // Portfolio & Social Links
      portfolioWebsite: profileData.portfolioWebsite || '',
      github: profileData.github || '',
      linkedin: profileData.linkedin || '',
      twitter: profileData.twitter || '',
      instagram: profileData.instagram || '',
      facebook: profileData.facebook || '',
      tiktok: profileData.tiktok || '',
      whatsapp: profileData.whatsapp || '',
      
      // Grid Display Fields
      rating: 5,
      followers: 0,
      completedProjects: 0,
      responseTime: '< 1 hour',
      reviews: [],
      mediaFiles: normalizedIncomingMediaFiles
    };
    
    console.log('Profile data received:', profileData);
    console.log('Creating/updating profile for auth user ID:', userId);

    try {
      const upsertPayload = {
        id: userId,
        email: normalizedEmail,
        phone: newProfile.phone || '',
        user_type: newProfile.userType || 'employee',
        full_name: newProfile.name,
        display_name: newProfile.name,
        avatar_url: newProfile.avatar || null,
        bio: newProfile.bio || '',
        title: newProfile.title,
        location: newProfile.location,
        rating: newProfile.rating,
        skills: newProfile.skills,
        experience: newProfile.experience,
        hourly_rate: newProfile.hourlyRate,
        availability: newProfile.availability,
        languages: newProfile.languages,
        timezone: newProfile.timezone,
        certifications: newProfile.certifications,
        project_types: newProfile.projectTypes,
        work_style: newProfile.workStyle,
        portfolio_website: newProfile.portfolioWebsite,
        github: newProfile.github,
        linkedin: newProfile.linkedin,
        twitter: newProfile.twitter,
        instagram: newProfile.instagram,
        facebook: newProfile.facebook,
        tiktok: newProfile.tiktok,
        whatsapp: newProfile.whatsapp,
        followers: newProfile.followers,
        completed_projects: newProfile.completedProjects,
        response_time: newProfile.responseTime,
        reviews: newProfile.reviews,
        media_files: simplifiedIncomingMedia,
        updated_at: new Date().toISOString()
      };

      let savedProfile = null;
      let saveError = null;
      ({ data: savedProfile, error: saveError } = await supabase
        .from('profiles')
        .upsert(upsertPayload)
        .select()
        .single());

      console.log('[handleProfileCreated] 🔁 Supabase upsert returned raw row:', savedProfile);

      if (saveError) {
        const missingSchemaMatch = /Could not find the '(.+)' column of 'profiles' in the schema cache/i;
        const missingSchemaField = missingSchemaMatch.test(saveError.message) ? saveError.message.match(saveError.message)[1] : null;
        if (saveError.code === 'PGRST204' && missingSchemaField) {
          const altPayload = { ...upsertPayload };
          if (missingSchemaField === 'certifications' && altPayload.certifications !== undefined) {
            altPayload.credentials = altPayload.certifications;
            delete altPayload.certifications;
          } else if (missingSchemaField === 'credentials' && altPayload.credentials !== undefined) {
            altPayload.certifications = altPayload.credentials;
            delete altPayload.credentials;
          }
          if (Object.keys(altPayload).length !== Object.keys(upsertPayload).length ||
              Object.keys(altPayload).some(key => altPayload[key] !== upsertPayload[key])) {
            const { data: retrySavedProfile, error: retryError } = await supabase
              .from('profiles')
              .upsert(altPayload)
              .select()
              .single();
            console.log('[handleProfileCreated] 🔁 Supabase retry upsert returned raw row:', retrySavedProfile);
            if (!retryError) {
              savedProfile = retrySavedProfile;
              saveError = null;
              showToast({ type: 'success', title: 'Profile saved', message: 'Your profile was saved successfully.' });
            } else {
              console.error('[handleProfileCreated] Supabase retry upsert failed:', retryError.message || retryError);
            }
          }
        }
      }

      if (saveError) {
        console.error('[handleProfileCreated] Supabase upsert failed:', saveError.message || saveError);
        showToast({ type: 'error', title: 'Error', message: 'Unable to save profile to Supabase.' });
        return;
      }

      const { error: mediaUpdateError } = await supabase
        .from('profiles')
        .update({
          media_files: simplifiedIncomingMedia,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (mediaUpdateError) {
        console.error('[handleProfileCreated] Failed to persist media_files after upsert:', mediaUpdateError);
      } else {
        console.log('[handleProfileCreated] ✅ media_files persisted explicitly:', simplifiedIncomingMedia.length);
      }

      const mappedSavedProfile = await hydrateProfileMediaForDisplay(savedProfile);
      // Trust DB as source-of-truth for media_files — do not merge/retain client-only media
      console.log('[handleProfileCreated] 📸 Saved profile media to DB:', { id: mappedSavedProfile.id, mediaCount: mappedSavedProfile.mediaFiles?.length || 0, media_files: savedProfile.media_files });
      setSelectedAccount(mappedSavedProfile);
      setSelectedAccountType(mappedSavedProfile.userType);
      setRealProfiles(prev => {
        const exists = prev.some(profile => profile.id === mappedSavedProfile.id);
        const updated = prev.map(profile => profile.id === mappedSavedProfile.id ? mappedSavedProfile : profile);
        return exists ? updated : [...updated, mappedSavedProfile];
      });
      setShowAccountPanel(false);
      setShowAccountTypeSelector(false);
      console.log('[handleProfileCreated] Profile saved to Supabase:', mappedSavedProfile.id);

      try {
        const profileMetadata = {
          hasProfile: true,
          user_type: mappedSavedProfile.userType || null,
          profileId: mappedSavedProfile.id,
          userId: mappedSavedProfile.id,
        };
        localStorage.setItem('_profileMetadata', JSON.stringify(profileMetadata));
        localStorage.setItem('hasCompletedOnboarding', 'true');
        localStorage.setItem('joblinkLastRoute', '/home');
        localStorage.removeItem('joblinkPendingProfileDraft');
      } catch (e) {
        console.warn('[handleProfileCreated] Could not cache profile metadata:', e);
      }
    } catch (e) {
      console.error('[handleProfileCreated] Error saving profile:', e?.message || e);
      showToast({ type: 'error', title: 'Error', message: 'Unable to save profile to Supabase.' });
      return;
    }

    // Clear back action stack after successful profile creation to prevent back button from going to account selector
    clearBackActionStack();
    profileJustCreatedRef.current = true;

    // Immediately update state and navigate for seamless experience
    setShowLanding(false);
    setActiveTab('Home');
    setShowAccountPanel(false);
    setShowAccountTypeSelector(false);
    // Use hash-based navigation to ensure the app shell responds correctly
    navigateTo('/home');
    
    // Show brief success feedback via toast
    showToast({ type: 'success', title: '', message: '✓ Welcome! Your profile is ready.' });

  };

  const handleLogout = async () => {
    try {
      // Sign out using Supabase auth
      await signOut();
      
      // Clear user data from localStorage
      localStorage.removeItem('accountType');
      localStorage.removeItem('userAvatar');
      localStorage.removeItem('selectedProfession');
      localStorage.removeItem('dateOfBirth');
      localStorage.removeItem('hasCompletedOnboarding');
      localStorage.removeItem('selectedAccount');
      localStorage.removeItem('joblinkUser');
      localStorage.removeItem('joblinkPendingProfileDraft');
      
      setSelectedAccount(null);
      setSelectedAccountType(null);
      setShowAccountPanel(false);
      
      // Navigate to login page
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still navigate to login even if logout fails
      navigate('/login');
    }
  };

  /**
   * Delete a media file from storage and profile
   * Called when user removes media during editing
   */
  const handleDeleteMedia = async (mediaPath) => {
    const userId = selectedAccount?.id || user?.id;
    if (!userId || !mediaPath) {
      console.warn('[handleDeleteMedia] Missing userId or mediaPath');
      return false;
    }

    try {
      console.log(`[handleDeleteMedia] 🗑️  Deleting media: ${mediaPath}`);
      
      const currentMedia = selectedAccount?.mediaFiles || selectedAccount?.media_files || [];
      const result = await deleteMediaFile(userId, mediaPath, currentMedia);

      if (result.success) {
        console.log(`[handleDeleteMedia] ✅ Media deleted successfully`);
        
        // Update local state
        const updatedMedia = currentMedia.filter(m => m?.path !== mediaPath && m?.id !== mediaPath);
        setSelectedAccount(prev => ({
          ...prev,
          mediaFiles: updatedMedia,
          media_files: updatedMedia
        }));

        showToast({ type: 'success', title: 'Deleted', message: 'Media file removed' });
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('[handleDeleteMedia] Error:', err);
      showToast({ type: 'error', title: 'Error', message: 'Failed to delete media file' });
      return false;
    }
  };

  /**
   * Delete multiple media files at once
   */
  const handleDeleteMultipleMedia = async (mediaPaths = []) => {
    const userId = selectedAccount?.id || user?.id;
    if (!userId || !Array.isArray(mediaPaths) || mediaPaths.length === 0) {
      return false;
    }

    try {
      console.log(`[handleDeleteMultipleMedia] 🗑️  Deleting ${mediaPaths.length} media files`);
      
      const currentMedia = selectedAccount?.mediaFiles || selectedAccount?.media_files || [];
      const result = await deleteMultipleMediaFiles(userId, mediaPaths, currentMedia);

      if (result.success) {
        console.log(`[handleDeleteMultipleMedia] ✅ ${mediaPaths.length} files deleted`);
        
        // Update local state
        const updatedMedia = currentMedia.filter(
          m => !mediaPaths.includes(m?.path) && !mediaPaths.includes(m?.id)
        );
        setSelectedAccount(prev => ({
          ...prev,
          mediaFiles: updatedMedia,
          media_files: updatedMedia
        }));

        showToast({ type: 'success', title: 'Deleted', message: `${mediaPaths.length} media files removed` });
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('[handleDeleteMultipleMedia] Error:', err);
      showToast({ type: 'error', title: 'Error', message: 'Failed to delete media files' });
      return false;
    }
  };

  const renderComponent = () => {
    const userProfileId = selectedAccount?.id || null;
    const currentUserProfile = selectedAccount || null;
    
    switch (activeTab) {
      case 'Home':
        return <Home tabVisible={activeTab === 'Home'} profiles={filteredProfiles} jobPostings={filteredJobPostings} searchTerm={searchTerm} onToggleLiked={toggleLiked} likedItems={likedItems} onToggleBookmarked={toggleBookmarked} bookmarkedItems={bookmarkedItems} onToggleFollowing={toggleFollowing} followingItems={followingItems} userProfileId={userProfileId} currentUserProfile={currentUserProfile} onUpdateProfile={handleOpenProfile} onSearchChange={handleSearchChange} cardTypeFilter={cardTypeFilter} setCardTypeFilter={setCardTypeFilter} selectedProfile={selectedProfile} onSelectProfile={handleSelectProfile} />;
      case 'Trending':
        return <Trending profiles={filteredProfiles} searchTerm={searchTerm} onToggleLiked={toggleLiked} likedItems={likedItems} onToggleBookmarked={toggleBookmarked} bookmarkedItems={bookmarkedItems} onToggleFollowing={toggleFollowing} followingItems={followingItems} userProfileId={userProfileId} currentUserProfile={currentUserProfile} onUpdateProfile={handleOpenProfile} onSearchChange={handleSearchChange} cardTypeFilter={cardTypeFilter} setCardTypeFilter={setCardTypeFilter} selectedProfile={selectedProfile} onSelectProfile={handleSelectProfile} />;
      case 'Following':
        return <Following profiles={filteredProfiles} jobPostings={filteredJobPostings} searchTerm={searchTerm} onToggleLiked={toggleLiked} likedItems={likedItems} onToggleBookmarked={toggleBookmarked} bookmarkedItems={bookmarkedItems} onToggleFollowing={toggleFollowing} followingItems={followingItems} userProfileId={userProfileId} currentUserProfile={currentUserProfile} onUpdateProfile={handleOpenProfile} onSearchChange={handleSearchChange} cardTypeFilter={cardTypeFilter} setCardTypeFilter={setCardTypeFilter} selectedProfile={selectedProfile} onSelectProfile={handleSelectProfile} />;
      case 'Liked':
        return <Liked profiles={filteredProfiles} jobPostings={filteredJobPostings} searchTerm={searchTerm} likedItems={likedItems} bookmarkedItems={bookmarkedItems} onToggleLiked={toggleLiked} onToggleBookmarked={toggleBookmarked} onToggleFollowing={toggleFollowing} followingItems={followingItems} currentUserProfile={currentUserProfile} onUpdateProfile={handleOpenProfile} onSearchChange={handleSearchChange} selectedProfile={selectedProfile} onSelectProfile={handleSelectProfile} />;
      default:
        return <Home tabVisible={activeTab === 'Home'} profiles={filteredProfiles} jobPostings={filteredJobPostings} searchTerm={searchTerm} onToggleLiked={toggleLiked} likedItems={likedItems} onToggleBookmarked={toggleBookmarked} bookmarkedItems={bookmarkedItems} onToggleFollowing={toggleFollowing} followingItems={followingItems} userProfileId={userProfileId} currentUserProfile={currentUserProfile} onUpdateProfile={handleOpenProfile} onSearchChange={handleSearchChange} cardTypeFilter={cardTypeFilter} setCardTypeFilter={setCardTypeFilter} selectedProfile={selectedProfile} onSelectProfile={handleSelectProfile} />;
    }
  };

  if (showLanding) {
    return <Landing onGetStarted={() => {
      navigateTo(getLandingEntryRoute());
    }} />;
  }

  // Show admin panel without HashRouter (already provided by AppWrapper)
  const closeAdminPanel = () => {
    setShowAdminPanel(false);
    setShowLanding(false);
    setShowAccountTypeSelector(false);
    setShowAccountPanel(false);
    setShowSearchPage(false);
    setShowSubscriptionModal(false);
    setShowUpgradePanel(false);

    const restoreRoute = previousRoute.current || '/home';
    navigateTo(restoreRoute);
  };

  if (showAdminPanel) {
    return <Admin onClose={closeAdminPanel} />;
  }

  if (showSearchPage) {
    return (
      <div className="Joblink">
        <header className="Joblink-header-title">
          <div className="Joblink-header-top">
            <h1>Search</h1>
          </div>
        </header>
        <div className="Joblink-content">
          <Search
            profiles={allProfiles}
            onSearchChange={handleSearchChange}
            isFullPage
            resultCount={filteredProfiles.length}
            hasSearch
          />
        </div>
      </div>
    );
  }

  // Show account type selector (which now includes welcome)
  if (showAccountTypeSelector && !showAccountPanel) {
    return (
      <AccountTypeSelector 
        onSelectAccountType={handleSelectAccountType}
        onClose={() => {
          // Do not navigate away from account selector while onboarding is required.
        }}
      />
    );
  }

  // Show account form as full page
  if (showAccountPanel && selectedAccountType === 'employee') {
    return (
      <div className="Joblink">
        <header className="Joblink-header-title">
          <div className="Joblink-header-top">
            <button 
              className="back-button"
              onClick={() => {
                setShowAccountPanel(false);
                setShowAccountTypeSelector(true);
                setSelectedAccountType(null);
                setActiveTab('Home');
                setCardTypeFilter('all');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#00d4ff',
                fontSize: '20px',
                cursor: 'pointer',
                marginRight: '20px'
              }}
            >
              ← Back
            </button>
            <h1>JobLink</h1>
            <Search profiles={allProfiles} onSearchChange={handleSearchChange} />
          </div>
        </header>
        <div className="Joblink-content">
          <UserAccountPanel 
            selectedAccount={selectedAccount} 
            selectedAccountType={selectedAccountType}
            onClose={() => closeAccountPanel(shouldReturnToAccountSelector())} 
            onProfileCreated={handleProfileCreated} 
            onDeleteMedia={handleDeleteMedia}
            onBack={() => closeAccountPanel(shouldReturnToAccountSelector())} 
          />
        </div>
      </div>
    );
  }

  if (showAccountPanel && selectedAccountType === 'employer') {
    return (
      <div className="Joblink">
        <header className="Joblink-header-title">
          <div className="Joblink-header-top">
            <button 
              className="back-button"
              onClick={() => {
                setShowAccountPanel(false);
                setShowAccountTypeSelector(true);
                setSelectedAccountType(null);
                setActiveTab('Home');
                setCardTypeFilter('all');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#00d4ff',
                fontSize: '20px',
                cursor: 'pointer',
                marginRight: '20px'
              }}
            >
              ← Back
            </button>
            <h1>JobLink</h1>
            <Search profiles={allProfiles} onSearchChange={handleSearchChange} />
          </div>
        </header>
        <div className="Joblink-content">
          <EmployerAccountPanel 
            selectedAccount={selectedAccount} 
            selectedAccountType={selectedAccountType}
            onClose={() => closeAccountPanel(shouldReturnToAccountSelector())} 
            onProfileCreated={handleProfileCreated}
            onDeleteMedia={handleDeleteMedia}
            onDeleteMultipleMedia={handleDeleteMultipleMedia}
            onBack={() => closeAccountPanel(shouldReturnToAccountSelector())} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="Joblink Joblink-fadeIn">
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => {
          setShowSubscriptionModal(false);
          setSelectedUpgradePlan(null);
        }}
        onBack={() => {
          setShowSubscriptionModal(false);
          setShowUpgradePanel(true);
        }}
        user={selectedAccount}
        product="joblink"
        selectedPlan={selectedUpgradePlan}
      />
      
      {/* Premium Upgrade Panels */}
      {showUpgradePanel && (
        <PremiumPanel 
          onClose={() => setShowUpgradePanel(false)}
          onSelectPlan={(selectedPlan) => {
            setSelectedUpgradePlan(selectedPlan);
            setShowUpgradePanel(false);
            setShowSubscriptionModal(true);
          }}
        />
      )}

      <header className="Joblink-header-title">
        <div className="Joblink-header-top">
          <h1>JobLink</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <NotificationBell />
            <div className="bottom-profile-wrapper">
              <UserP 
              selectedAccount={selectedAccount}
              onOpenProfile={handleOpenProfile}
              onSwitchAccount={handleSwitchAccount}
              onLogout={handleLogout}
              onUpgrade={() => {
                setShowUpgradePanel(true);
              }}
              isModalOpen={showAccountPanel || showUpgradePanel || showSubscriptionModal}
              onOpenAdmin={() => {
                try {
                  if (!window.__adminPrefetched) {
                    window.__adminPrefetched = true;
                    // Prefetch admin bundle and key data in background
                    import('../Admin/Admin').catch(() => {});
                    import('../Admin/components/Users').catch(() => {});
                    import('../Admin/components/Dashboard').catch(() => {});
                    import('../Admin/api').then((m) => {
                      try {
                        // Fire-and-forget key data fetches to warm cache
                        m.fetchProfiles().catch(() => {});
                        m.fetchUploadCountsByUser().catch(() => {});
                        m.fetchAuthenticatedUsers().catch(() => {});
                      } catch (e) {
                        // ignore
                      }
                    }).catch(() => {});
                  }
                } catch (e) {
                  // ignore
                }
                navigate('/admin');
              }}
              onUpdateAvatar={handleUpdateAvatar}
            />
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Content Area */}
      <div 
        className="Joblink-content"
        style={{
          opacity: 1,
          transition: 'opacity 50ms ease'
        }}
      >
        {renderComponent()}
      </div>

      <div className="tabs-container" ref={tabsContainerRef}>
        <button
          className={`tab-button ${activeTab === 'Home' && cardTypeFilter === 'all' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('Home');
            navigateTo('/home');
            setCardTypeFilter('all');
          }}
        >
          <HomeIcon size={16} />
          <span className="tab-label">Home</span>
        </button>
        <button
          className={`tab-button ${cardTypeFilter === 'seekers' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('Home');
            setCardTypeFilter('seekers');
          }}
        >
          <svg width={16} height={16} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}><path d="M336,256c-20.56,0-40.44-9.18-56-25.84-15.13-16.25-24.37-37.92-26-61-1.74-24.62,5.77-47.26,21.14-63.76S312,80,336,80c23.83,0,45.38,9.06,60.7,25.52,15.47,16.62,23,39.22,21.26,63.63h0c-1.67,23.11-10.9,44.77-26,61C376.44,246.82,356.57,256,336,256Zm66-88h0Z" fill="currentColor"/><path d="M467.83,432H204.18a27.71,27.71,0,0,1-22-10.67,30.22,30.22,0,0,1-5.26-25.79c8.42-33.81,29.28-61.85,60.32-81.08C264.79,297.4,299.86,288,336,288c36.85,0,71,9,98.71,26.05,31.11,19.13,52,47.33,60.38,81.55a30.27,30.27,0,0,1-5.32,25.78A27.68,27.68,0,0,1,467.83,432Z" fill="currentColor"/><path d="M147,260c-35.19,0-66.13-32.72-69-72.93C76.58,166.47,83,147.42,96,133.45,108.86,119.62,127,112,147,112s38,7.66,50.93,21.57c13.1,14.08,19.5,33.09,18,53.52C213.06,227.29,182.13,260,147,260Z" fill="currentColor"/><path d="M212.66,291.45c-17.59-8.6-40.42-12.9-65.65-12.9-29.46,0-58.07,7.68-80.57,21.62C40.93,316,23.77,339.05,16.84,366.88a27.39,27.39,0,0,0,4.79,23.36A25.32,25.32,0,0,0,41.72,400h111a8,8,0,0,0,7.87-6.57c.11-.63.25-1.26.41-1.88,8.48-34.06,28.35-62.84,57.71-83.82a8,8,0,0,0-.63-13.39C216.51,293.42,214.71,292.45,212.66,291.45Z" fill="currentColor"/></svg>
          <span className="tab-label">Personnel</span>
        </button>
        <button
          className={`tab-button ${cardTypeFilter === 'jobs' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('Home');
            setCardTypeFilter('jobs');
          }}
        >
          <JobsIcon size={16} />
          <span className="tab-label">Jobs</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'Trending' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('Trending');
            navigateTo('/trending');
            setCardTypeFilter('all');
          }}
        >
          <TrendingIcon size={16} />
          <span className="tab-label">Trending</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'Following' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('Following');
            navigateTo('/following');
            setCardTypeFilter('all');
          }}
        >
          <FollowingIcon size={16} />
          <span className="tab-label">Following</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'Liked' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('Liked');
            navigateTo('/liked');
            setCardTypeFilter('all');
          }}
        >
          <LikedIcon size={16} />
          <span className="tab-label">Liked</span>
        </button>
      </div>
    </div>
  );
}

export default Joblink;
