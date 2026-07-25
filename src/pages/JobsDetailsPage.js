import './JobsDetailsPage.css';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { pushBackAction, popBackAction } from '../services/backNavigation';
import { FaArrowLeft, FaAward, FaBriefcase, FaCalendar, FaDollarSign, FaLocationDot, FaEnvelope, FaStar, FaXmark } from 'react-icons/fa6';
import { FollowingIcon } from '../Icons/FollowingIcon';
import { useNavigate } from 'react-router-dom';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { normalizeProfileMediaFiles } from '../utils/profileMedia';

function JobsDetailsPage({ profile, onClose, onApplyNow = null, onToggleFollowing = null, followingItems = {}, onToggleLiked = null, likedItems = {} }) {
  const [avatarError, setAvatarError] = useState(false);
  const [activeTab, setActiveTab] = useState('position');
  const [floatingHearts, setFloatingHearts] = useState([]);
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const [showMediaLightbox, setShowMediaLightbox] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const backActionLockRef = useRef(false);
  const mediaSliderRef = useRef(null);
  const mediaTouchStartXRef = useRef(0);
  const navigate = useNavigate();

  const openFollowLikePage = (type) => {
    if (!profile?.id) return;
    navigate(`/profile/${profile.id}/${type}`);
  };

  useEffect(() => {
    const handleBackAction = () => {
      if (showAvatarLightbox) {
        setShowAvatarLightbox(false);
        return;
      }

      if (showMediaLightbox) {
        setShowMediaLightbox(false);
        return;
      }

      onClose();
    };

    pushBackAction(handleBackAction);
    return () => popBackAction(handleBackAction);
  }, [onClose, showAvatarLightbox, showMediaLightbox]);

  const getInitials = (name, fallbackEmail = '') => {
    if (name && name.trim()) {
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }

    if (fallbackEmail && fallbackEmail.trim()) {
      return fallbackEmail.charAt(0).toUpperCase();
    }

    return '?';
  };

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

  const skills = useMemo(() => {
    if (Array.isArray(profile?.skills)) {
      return profile.skills.filter(Boolean);
    }

    if (typeof profile?.skills === 'string') {
      return profile.skills
        .split(',')
        .map(skill => skill.trim())
        .filter(Boolean);
    }

    return [];
  }, [profile?.skills]);

  const profileMedia = useMemo(() => normalizeProfileMediaFiles(profile), [profile]);

  const getMediaUrl = (item) => {
    if (!item) return '';
    return resolveMediaUrl(item);
  };
  const getMediaTitle = (item) => item?.name || item?.title || item?.caption || 'Media';
  const getMediaCaption = (item) => item?.caption || item?.title || '';
  const getMediaThumbnailUrl = (item) => {
    if (!item) return '';
    const candidate = item?.preview || item?.thumbnail || item?.poster || item?.videoThumbnailUrl || item?.previewUrl;
    if (candidate) return candidate;
    const url = getMediaUrl(item);
    if (isVideoFile(url, item)) return '';
    return url;
  };
  const isPdfFile = (filepath, item) => item?.type === 'application/pdf' || (filepath && filepath.toLowerCase().endsWith('.pdf'));
  const isVideoFile = (filepath, item) => (item?.type || '').startsWith('video') || (filepath && ['.mp4', '.webm', '.ogg', '.mov'].some(ext => filepath.toLowerCase().endsWith(ext)));

  const companyName = profile?.companyName || profile?.company || profile?.name || 'Employer';
  const summary = profile?.bio || profile?.description || profile?.summary || 'This opportunity is ready for a strong candidate to explore.';
  const avatarUrl = profile?.avatar_url || profile?.avatar || profile?.avatarUrl || null;
  const isFollowing = Boolean(profile?.id && followingItems?.[profile.id]);

  const handleFollowToggle = () => {
    if (onToggleFollowing && profile?.id) {
      onToggleFollowing(profile.id);
    }
  };

  const handlePreviousMediaCb = useCallback(() => {
    if (!profileMedia || profileMedia.length === 0) return;
    setSelectedMediaIndex((prev) => (prev === 0 ? profileMedia.length - 1 : prev - 1));
  }, [profileMedia]);

  const handleNextMediaCb = useCallback(() => {
    if (!profileMedia || profileMedia.length === 0) return;
    setSelectedMediaIndex((prev) => (prev === profileMedia.length - 1 ? 0 : prev + 1));
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

  const openMediaLightbox = (index) => {
    setSelectedMediaIndex(index);
    setShowMediaLightbox(true);
  };

  const handleGridVideoPreview = useCallback((event) => {
    const video = event.currentTarget;
    if (!video) return;

    video.play().catch(() => {});
    window.clearTimeout(video.__previewTimeout);
    video.__previewTimeout = window.setTimeout(() => {
      video.pause();
      video.currentTime = 0;
    }, 2000);
  }, []);

  const pauseAllLightboxVideos = useCallback(() => {
    if (!mediaSliderRef.current) return;
    const videos = mediaSliderRef.current.querySelectorAll('video');
    videos.forEach((video) => {
      video.pause();
    });
  }, []);

  const lastTapTimeRef = useRef(0);
  const tapCountRef = useRef(0);

  const handleProfileDoubleClick = useCallback((event) => {
    console.log('[JobsDetailsPage] 🎯 Profile double-clicked');
    
    const currentlyLiked = !!likedItems?.[profile?.id];
    const nextState = !currentlyLiked;
    
    console.log('[JobsDetailsPage] Double-click like toggle:', currentlyLiked, '→', nextState);

    // Create floating heart animation at click point
    const heartId = Date.now() + Math.random();
    const x = event.clientX;
    const y = event.clientY;
    
    console.log('[JobsDetailsPage] Creating floating heart at:', x, y);
    setFloatingHearts(prev => [...prev, { id: heartId, x, y }]);
    
    // Remove heart animation after it completes
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== heartId));
    }, 1000);

    if (onToggleLiked && profile?.id) {
      console.log('[JobsDetailsPage] 📤 Calling onToggleLiked for profile:', profile.id);
      onToggleLiked(profile.id);
    }
  }, [likedItems, onToggleLiked, profile?.id]);

  const handleTouchStart = useCallback((event) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    
    console.log('[JobsDetailsPage] Touch detected - timeSinceLastTap:', timeSinceLastTap);

    // Reset tap count if more than 300ms since last tap
    if (timeSinceLastTap > 300) {
      tapCountRef.current = 0;
    }

    tapCountRef.current += 1;
    lastTapTimeRef.current = now;

    console.log('[JobsDetailsPage] Tap count:', tapCountRef.current);

    // Trigger like on second tap
    if (tapCountRef.current === 2) {
      console.log('[JobsDetailsPage] Double-tap detected!');
      tapCountRef.current = 0;
      
      const currentlyLiked = !!likedItems?.[profile?.id];
      const nextState = !currentlyLiked;
      
      console.log('[JobsDetailsPage] Double-tap like toggle:', currentlyLiked, '→', nextState);

      // Create floating heart animation at touch point
      const heartId = Date.now() + Math.random();
      const touch = event.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;
      
      console.log('[JobsDetailsPage] Creating floating heart at:', x, y);
      setFloatingHearts(prev => [...prev, { id: heartId, x, y }]);
      
      // Remove heart animation after it completes
      setTimeout(() => {
        setFloatingHearts(prev => prev.filter(h => h.id !== heartId));
      }, 1000);

      if (onToggleLiked && profile?.id) {
        console.log('[JobsDetailsPage] 📤 Calling onToggleLiked for profile:', profile.id);
        onToggleLiked(profile.id);
      }
    }
  }, [likedItems, onToggleLiked, profile?.id]);

  const handleAvatarClick = () => {
    setShowAvatarLightbox(true);
  };

  const handleBackButton = (event) => {
    if (event?.type === 'mousedown' || event?.type === 'touchstart' || event?.type === 'pointerdown') {
      event.stopPropagation();
    }

    if (backActionLockRef.current) {
      return;
    }

    backActionLockRef.current = true;
    window.setTimeout(() => {
      backActionLockRef.current = false;
    }, 350);

    if (showAvatarLightbox) {
      setShowAvatarLightbox(false);
      return;
    }

    if (showMediaLightbox) {
      setShowMediaLightbox(false);
      return;
    }

    onClose?.();
  };

  useEffect(() => {
    if (!showAvatarLightbox && !showMediaLightbox) return;

    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        setShowAvatarLightbox(false);
        setShowMediaLightbox(false);
      }

      if (showMediaLightbox) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePreviousMediaCb();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextMediaCb();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showAvatarLightbox, showMediaLightbox, handlePreviousMediaCb, handleNextMediaCb]);

  useEffect(() => {
    if (!showMediaLightbox) return;
    const el = mediaSliderRef.current;
    if (!el) return;

    const scrollToIndex = () => {
      const width = el.clientWidth || window.innerWidth;
      el.scrollTo({ left: selectedMediaIndex * width, behavior: 'smooth' });
    };

    const id = requestAnimationFrame(scrollToIndex);
    return () => cancelAnimationFrame(id);
  }, [showMediaLightbox, selectedMediaIndex]);

  useEffect(() => {
    if (!showMediaLightbox) {
      pauseAllLightboxVideos();
      return;
    }

    const slider = mediaSliderRef.current;
    if (!slider) return;

    const activeVideo = slider.querySelector('.media-slide-dt-JOBS.active video');
    const otherVideos = slider.querySelectorAll('.media-slide-dt-JOBS:not(.active) video');

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
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    const handleTouchStart = (e) => {
      const touch = e.changedTouches?.[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    };

    const handleTouchEnd = (e) => {
      const touch = e.changedTouches?.[0];
      if (!touch) return;
      touchEndX = touch.clientX;
      touchEndY = touch.clientY;

      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const swipeThreshold = 70;
      const verticalTolerance = 24;

      if (Math.abs(deltaX) < swipeThreshold) return;
      if (Math.abs(deltaY) > Math.abs(deltaX) - verticalTolerance) return;

      const tabs = ['position', 'skills', 'company', 'details', 'media'];
      const currentIndex = tabs.indexOf(activeTab);

      if (deltaX < -swipeThreshold && currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
      } else if (deltaX > swipeThreshold && currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
      }
    };

    const panelElement = document.querySelector('.details-panel-dt-JOBS');
    if (panelElement) {
      panelElement.addEventListener('touchstart', handleTouchStart, false);
      panelElement.addEventListener('touchend', handleTouchEnd, false);

      return () => {
        panelElement.removeEventListener('touchstart', handleTouchStart, false);
        panelElement.removeEventListener('touchend', handleTouchEnd, false);
      };
    }
  }, [activeTab]);

  const handleTabChange = useCallback((tab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [activeTab]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'skills':
        return (
          <div className="info-section-dt-JOBS">
            <h3 className="section-title-dt-JOBS">Required skills</h3>
            <div className="skill-list-dt-JOBS">
              {skills.length > 0 ? skills.map(skill => (
                <span key={skill} className="skill-badge-dt-JOBS">{skill}</span>
              )) : (
                <span className="skill-badge-dt-JOBS">Experience matters</span>
              )}
            </div>
          </div>
        );
      case 'media':
        return (
          <div className="info-section-dt-JOBS">
            {profileMedia.length > 0 ? (
              <div className="portfolio-grid-modern-dt">
                {profileMedia.map((item, idx) => {
                  const url = getMediaUrl(item);
                  return (
                    <div
                      key={idx}
                      className="portfolio-item-modern-dt"
                      onClick={() => openMediaLightbox(idx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openMediaLightbox(idx);
                        }
                      }}
                    >
                      {isPdfFile(url, item) ? (
                        <div className="portfolio-item-video-placeholder-dt pdf-placeholder">PDF</div>
                      ) : isVideoFile(url, item) ? (
                        <video
                          src={url}
                          muted
                          playsInline
                          loop
                          preload="metadata"
                          className="portfolio-media-preview-dt"
                          onLoadedData={handleGridVideoPreview}
                        />
                      ) : (
                        <img src={url} alt={item?.title || 'Media'} className="portfolio-media-preview-dt" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="no-media-text-dt-JOBS">No media uploaded yet.</p>
            )}
          </div>
        );
      case 'company':
        return (
          <div className="info-section-dt-JOBS">
            <div className="info-item-dt-JOBS">
              <FaBriefcase className="item-icon-dt-JOBS" />
              <div className="info-label-dt-JOBS">
                <span>Company</span>
                <span>{companyName}</span>
              </div>
            </div>
            <div className="info-item-dt-JOBS">
              <FaLocationDot className="item-icon-dt-JOBS" />
              <div className="info-label-dt-JOBS">
                <span>Location</span>
                <span>{profile?.location || 'Remote'}</span>
              </div>
            </div>
            <div className="info-item-dt-JOBS">
              <FaCalendar className="item-icon-dt-JOBS" />
              <div className="info-label-dt-JOBS">
                <span>Employment Type</span>
                <span>{profile?.employmentType || 'Full-time'}</span>
              </div>
            </div>
          </div>
        );
      case 'details':
        return (
          <div className="info-section-dt-JOBS">
            <h3 className="section-title-dt-JOBS">Overview</h3>
            <p className="profile-bio-section-dt-JOBS">{summary}</p>
            <div className="info-item-dt-JOBS">
              <FaDollarSign className="item-icon-dt-JOBS" />
              <div className="info-label-dt-JOBS">
                <span>Salary</span>
                <span>{profile?.salary || 'Negotiable'}</span>
              </div>
            </div>
            <div className="info-item-dt-JOBS">
              <FaAward className="item-icon-dt-JOBS" />
              <div className="info-label-dt-JOBS">
                <span>Experience Level</span>
                <span>{profile?.experienceLevel || 'Flexible'}</span>
              </div>
            </div>
          </div>
        );
      case 'position':
      default:
        return (
          <div className="info-section-dt-JOBS">
            <div className="info-item-dt-JOBS">
              <FaBriefcase className="item-icon-dt-JOBS" />
              <div className="info-label-dt-JOBS">
                <span>Position Title</span>
                <span>{profile?.title || 'Open position'}</span>
              </div>
            </div>
            <div className="info-item-dt-JOBS">
              <FaDollarSign className="item-icon-dt-JOBS" />
              <div className="info-label-dt-JOBS">
                <span>Salary</span>
                <span>{profile?.salary || 'Negotiable'}</span>
              </div>
            </div>
            <div className="info-item-dt-JOBS">
              <FaAward className="item-icon-dt-JOBS" />
              <div className="info-label-dt-JOBS">
                <span>Experience Level</span>
                <span>{profile?.experienceLevel || 'Flexible'}</span>
              </div>
            </div>
            <div className="info-item-dt-JOBS">
              <FaLocationDot className="item-icon-dt-JOBS" />
              <div className="info-label-dt-JOBS">
                <span>Location</span>
                <span>{profile?.location || 'Remote'}</span>
              </div>
            </div>
            <div className="info-item-dt-JOBS">
              <FaCalendar className="item-icon-dt-JOBS" />
              <div className="info-label-dt-JOBS">
                <span>Posted</span>
                <span>Recently</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="details-panel-wrapper-dt-JOBS">
      <div className="details-panel-dt-JOBS" onClick={(e) => e.stopPropagation()} onDoubleClick={handleProfileDoubleClick} onTouchStart={handleTouchStart}>
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

        {!showMediaLightbox && !showAvatarLightbox && (
          <div className="back-button-shell-dt-JOBS" onClick={(e) => e.stopPropagation()}>
            <button
              className="back-arrow-btn-dt-JOBS"
              type="button"
              onTouchStart={handleBackButton}
              onPointerDown={handleBackButton}
              onClick={handleBackButton}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleBackButton(event);
                }
              }}
              aria-label="Go back"
            >
              <FaArrowLeft />
            </button>
          </div>
        )}

        <div className="details-header-premium-dt-JOBS">
          <div className="header-inner-dt-JOBS">
            <div className="avatar-section-dt-JOBS">
              <div
                className="avatar-wrapper-dt-JOBS"
                onClick={handleAvatarClick}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAvatarClick(); }}
              >
                {avatarUrl && !avatarError ? (
                  <img
                    src={avatarUrl}
                    alt={profile.name}
                    className="panel-avatar-dt-JOBS"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div
                    className="avatar-placeholder-dt-JOBS"
                    style={{ backgroundColor: getAvatarColor(profile?.name || companyName) }}
                  >
                    <span className="avatar-initials-dt-JOBS">{getInitials(profile?.name || companyName)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="profile-section-dt-JOBS">
              <h2 className="profile-name-dt-JOBS">{profile?.title || 'Open position'}</h2>
              <p className="profile-email-dt-JOBS">{companyName}</p>
              <p className="profile-title-dt-JOBS">{profile?.employmentType || 'Full-time'}</p>
            </div>
          </div>
        </div>

        <div className="header-stats-dt-JOBS">
          <span className="header-stat-label-dt-JOBS">Position</span>
          <span className="header-stat-value-dt-JOBS">{profile?.title || 'Open position'}</span>
          <span className="header-divider-dt-JOBS">|</span>
          <span className="header-stat-label-dt-JOBS">Rate</span>
          <span className="header-stat-value-dt-JOBS">{profile?.rating || profile?.rate || '4.8'}</span>
          <span className="header-divider-dt-JOBS">|</span>
          <span className="header-stat-label-dt-JOBS">Followers</span>
          <button
            type="button"
            className="header-stat-value-dt-JOBS header-stat-button-dt-JOBS"
            onClick={() => openFollowLikePage('followers')}
          >
            {profile?.followers || profile?.followerCount || 0}
          </button>
          <span className="header-divider-dt-JOBS">|</span>
          <span className="header-stat-label-dt-JOBS">Likes</span>
          <button
            type="button"
            className="header-stat-value-dt-JOBS header-stat-button-dt-JOBS"
            onClick={() => openFollowLikePage('likes')}
          >
            {profile?.like_count ?? profile?.likes ?? profile?.likeCount ?? 0}
          </button>
        </div>

        <div className="profile-bio-section-dt-JOBS">{summary}</div>
        <div className="profile-bio-divider-dt-JOBS" />

        <div className="tab-navigation-dt-JOBS">
          <button className={`tab-btn-dt-JOBS ${activeTab === 'position' ? 'active' : ''}`} onClick={() => handleTabChange('position')}>Position</button>
          <button className={`tab-btn-dt-JOBS ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => handleTabChange('skills')}>Skills</button>
          <button className={`tab-btn-dt-JOBS ${activeTab === 'company' ? 'active' : ''}`} onClick={() => handleTabChange('company')}>Company</button>
          <button className={`tab-btn-dt-JOBS ${activeTab === 'details' ? 'active' : ''}`} onClick={() => handleTabChange('details')}>Details</button>
          <button className={`tab-btn-dt-JOBS ${activeTab === 'media' ? 'active' : ''}`} onClick={() => handleTabChange('media')}>
            Media {profileMedia.length > 0 ? <span className="tab-count-dt-JOBS">({profileMedia.length})</span> : null}
          </button>
        </div>

        <div className="details-content-dt-JOBS">
          <div className="details-content-inner-dt-JOBS">
            {renderTabContent()}
          </div>
        </div>

        <div className="cta-footer-dt-JOBS">
          <button className="btn-secondary-dt-JOBS" onClick={onClose} title="Message">
            <FaEnvelope /> Message
          </button>
          <button className="apply-btn-dt-JOBS" onClick={() => (onApplyNow ? onApplyNow(profile) : onClose())}>
            <FaBriefcase /> Apply
          </button>
          <button
            className={`btn-follow-dt-JOBS ${isFollowing ? 'following-dt-JOBS' : ''}`}
            onClick={handleFollowToggle}
            title={isFollowing ? 'Following' : 'Follow'}
          >
            <FollowingIcon size={16} /> {isFollowing ? 'Following' : 'Follow'}
          </button>
          <button className="btn-rate-dt-JOBS" onClick={() => {}} title="Rate">
            <FaStar /> Rate
          </button>
        </div>
      </div>

      {showAvatarLightbox && (
        <div className="avatar-lightbox-overlay-dt-JOBS" onClick={() => setShowAvatarLightbox(false)}>
          <div className="avatar-lightbox-content-dt-JOBS" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Profile avatar preview">
            <div className="avatar-lightbox-media-dt-JOBS">
              {avatarUrl && !avatarError ? (
                <img src={avatarUrl} alt={profile?.name || companyName} className="avatar-lightbox-image-dt-JOBS" onError={() => setAvatarError(true)} />
              ) : (
                <div className="avatar-lightbox-placeholder-dt-JOBS" style={{ backgroundColor: getAvatarColor(profile?.name || companyName) }}>
                  <span className="avatar-lightbox-initials-dt-JOBS">{getInitials(profile?.name || companyName)}</span>
                </div>
              )}

              <button
                className="avatar-lightbox-close-dt-JOBS"
                onClick={() => setShowAvatarLightbox(false)}
                aria-label="Close avatar preview"
              >
                <FaXmark />
              </button>
            </div>

            <div className="avatar-lightbox-caption-dt-JOBS">{profile?.name || companyName}</div>
          </div>
        </div>
      )}

      {showMediaLightbox && profileMedia.length > 0 && (
        <div className="media-lightbox-overlay-dt-JOBS" onClick={() => setShowMediaLightbox(false)}>
          <div className="media-lightbox-dt-JOBS" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Media preview">
            <div className="media-lightbox-header-dt-JOBS">
              <span className="media-lightbox-counter-dt-JOBS">
                {selectedMediaIndex + 1} / {profileMedia.length}
              </span>
              <div className="media-lightbox-caption-dt-JOBS">
                {getMediaCaption(profileMedia[selectedMediaIndex]) ? (
                  <p>{getMediaCaption(profileMedia[selectedMediaIndex])}</p>
                ) : null}
              </div>
              <button
                className="media-lightbox-close-dt-JOBS"
                onClick={() => setShowMediaLightbox(false)}
                aria-label="Close media preview"
              >
                <FaXmark />
              </button>
            </div>

            <div className="media-lightbox-container-dt-JOBS">
              <div className="media-lightbox-content-dt-JOBS" onTouchStart={handleMediaTouchStart} onTouchEnd={handleMediaTouchEnd}>
                <div className="media-slider-dt-JOBS" ref={mediaSliderRef}>
                  {profileMedia.map((item, idx) => {
                    const url = getMediaUrl(item);
                    return (
                      <div key={idx} className={`media-slide-dt-JOBS ${idx === selectedMediaIndex ? 'active' : ''}`}>
                        {isVideoFile(url, item) ? (
                          <video
                            key={url}
                            src={url}
                            controls
                            autoPlay
                            playsInline
                            loop
                            preload="auto"
                            crossOrigin="anonymous"
                            className="media-lightbox-video-dt-JOBS"
                          />
                        ) : isPdfFile(url, item) ? (
                          <iframe
                            src={url}
                            title={getMediaTitle(item)}
                            className="media-lightbox-iframe-dt-JOBS"
                          />
                        ) : (
                          <img
                            src={url}
                            alt={getMediaTitle(item)}
                            className="media-lightbox-image-dt-JOBS"
                          />
                        )}

                        {getMediaCaption(item) ? (
                          <div className="media-slide-caption-dt-JOBS">{getMediaCaption(item)}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {profileMedia.length > 1 && (
              <div className="media-lightbox-footer-dt-JOBS">
                <div className="media-lightbox-thumbnails-dt-JOBS">
                  {profileMedia.map((item, idx) => {
                    const thumbUrl = getMediaThumbnailUrl(item);
                    const mediaUrl = getMediaUrl(item);
                    return (
                      <div
                        key={idx}
                        className={`media-lightbox-thumbnail-dt-JOBS ${idx === selectedMediaIndex ? 'active' : ''}`}
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
                              autoPlay
                              loop
                              preload="metadata"
                              className="media-lightbox-thumbnail-video-dt-JOBS"
                            />
                          )
                        ) : (
                          <img src={mediaUrl} alt={getMediaTitle(item)} />
                        )}
                        {isVideoFile(mediaUrl, item) && thumbUrl && (
                          <div className="thumbnail-play-icon-dt-JOBS">▶</div>
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
    </div>
  );
}

export default JobsDetailsPage;
