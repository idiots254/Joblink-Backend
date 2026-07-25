import './Home.css';
import { useState, useRef, useEffect, useMemo, useCallback, useTransition } from 'react';
import JobCard from '../cards/JobCard';
import { pushBackAction, popBackAction } from '../services/backNavigation';
import DetailsPanel from './DetailsPanel';
import JobsDetailsPage from './JobsDetailsPage';
import ApplyPage from './ApplyPage';
import Search from './Search';

const homeCardOrderCache = new Map();
const homeCategoryOrderCache = new Map();

const readStoredOrder = (key, length) => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length === length) {
      return parsed;
    }
  } catch (error) {
    console.warn('Home: failed to read cached order', error);
  }
  return null;
};

const writeStoredOrder = (key, order) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(order));
  } catch (error) {
    console.warn('Home: failed to save cached order', error);
  }
};

const buildShuffledOrder = (length) => {
  const order = [...Array(length).keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
};

function Home({ tabVisible = false, profiles = [], jobPostings = [], searchTerm = '', onToggleLiked, likedItems, onToggleBookmarked, bookmarkedItems, onToggleFollowing, followingItems, userProfileId = null, currentUserProfile = null, onUpdateProfile = null, onSearchChange, cardTypeFilter = 'all', setCardTypeFilter = () => {}, selectedProfile = null, onSelectProfile = () => {} })  {
  const [, startTransition] = useTransition();
  
  const [showApplicationPage, setShowApplicationPage] = useState(false);
  const [selectedJobForApplication, setSelectedJobForApplication] = useState(null);
  const scrollRefsMap = useRef({});

  useEffect(() => {
    if (!showApplicationPage) return undefined;

    const handleBackAction = () => {
      setShowApplicationPage(false);
    };

    pushBackAction(handleBackAction);
    return () => popBackAction(handleBackAction);
  }, [showApplicationPage]);
  
  const [scrollStates, setScrollStates] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const ROWS_PER_PAGE = 6;
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const allCardsUnfiltered = useMemo(() => {
    return [
      ...profiles.map(p => ({ ...p, cardType: 'worker' })),
      ...jobPostings.map(j => ({ ...j, cardType: 'job-ad' }))
    ].filter(card => card.id !== userProfileId);
  }, [profiles, jobPostings, userProfileId]);

  const filteredCards = useMemo(() => {
    if (cardTypeFilter === 'jobs') {
      return allCardsUnfiltered.filter(card => card.cardType === 'job-ad');
    }
    if (cardTypeFilter === 'seekers') {
      return allCardsUnfiltered.filter(card => card.cardType === 'worker');
    }
    return allCardsUnfiltered;
  }, [allCardsUnfiltered, cardTypeFilter]);

  const categories = useMemo(() => {
    const grouped = Object.entries(
      filteredCards.reduce((groups, card) => {
        const category = card.title;
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(card);
        return groups;
      }, {})
    ).sort((a, b) => a[0].localeCompare(b[0]));
    return grouped;
  }, [filteredCards]);

  const cardsSignature = useMemo(() => {
    return `${userProfileId}|${allCardsUnfiltered.map(card => `${card.id}:${card.cardType}`).join(',')}`;
  }, [allCardsUnfiltered, userProfileId]);

  const categoriesSignature = useMemo(() => {
    return categories.map(([category]) => category).join('|');
  }, [categories]);

  const [cardOrder, setCardOrder] = useState([]);

  const [categoryOrder, setCategoryOrder] = useState([]);
  const wasHomeVisibleRef = useRef(false);

  useEffect(() => {
    if (!tabVisible) {
      wasHomeVisibleRef.current = true;
      return;
    }

    if (!wasHomeVisibleRef.current) {
      wasHomeVisibleRef.current = true;
      return;
    }

    if (allCardsUnfiltered.length === 0) return;

    const cacheKey = `home-card-order:${cardsSignature}`;
    const nextOrder = buildShuffledOrder(allCardsUnfiltered.length);
    homeCardOrderCache.set(cacheKey, nextOrder);
    writeStoredOrder(cacheKey, nextOrder);
    setCardOrder(nextOrder);
  }, [tabVisible, cardsSignature, allCardsUnfiltered.length]);

  const getOrCreateRef = (category) => {
    if (!scrollRefsMap.current[category]) {
      scrollRefsMap.current[category] = { current: null };
    }
    return scrollRefsMap.current[category];
  };

  const checkScroll = (category) => {
    const scrollRef = scrollRefsMap.current[category];
    if (scrollRef?.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setScrollStates(prev => ({
        ...prev,
        [category]: {
          canScrollLeft: scrollLeft > 0,
          canScrollRight: scrollLeft < scrollWidth - clientWidth - 10,
          hasOverflow: scrollWidth > clientWidth
        }
      }));
    }
  };

  const handleScroll = useCallback((direction, category) => {
    // Handle both mobile and desktop with smooth horizontal scrolling
    const scrollRef = scrollRefsMap.current[category];
    if (scrollRef?.current) {
      const scrollAmount = window.innerWidth <= 768 ? 300 : 250;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(() => checkScroll(category), 100);
    }
  }, []);

  // Touch swipe handler for mobile
  const handleTouchStart = useRef({});
  const handleTouchMove = useCallback((e, category) => {
    if (!handleTouchStart.current[category]) return;
  }, []);
  
  const handleTouchEnd = useCallback((e, category) => {
    if (!handleTouchStart.current[category]) return;
    const startX = handleTouchStart.current[category];
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    
    if (Math.abs(diff) > 50) {
      handleScroll(diff > 0 ? 'right' : 'left', category);
    }
    delete handleTouchStart.current[category];
  }, [handleScroll]);


  // PERFORMANCE OPTIMIZATION: Disabled continuous card shuffling (was every 30s)
  useEffect(() => {
    return () => {};
  }, []);

  // Check scroll state for all categories after render
  // PERFORMANCE OPTIMIZATION: Defer scroll checking so it doesn't block card rendering
  // This runs AFTER cards are visible, so scroll buttons appear correctly
  useEffect(() => {
    const timer = setTimeout(() => {
      Object.keys(scrollRefsMap.current).forEach(category => {
        checkScroll(category);
      });
    }, 50); // Small delay after cards render to check scrollability
    
    return () => clearTimeout(timer);
  }, [profiles, currentPage]);

  // Handle window resize to recheck scroll state (with debouncing)
  useEffect(() => {
    let resizeTimeout;
    
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        Object.keys(scrollRefsMap.current).forEach(category => {
          checkScroll(category);
        });
        setIsMobile(window.innerWidth <= 768);
      }, 300); // Debounce resize by 300ms
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Mobile smooth scroll snapping - uses native scrollIntoView for reliability
  useEffect(() => {
    if (!isMobile) return;
    
    const scrollTimeouts = {};
    let isScrolling = {};
    
    const setupScrollListener = (category, ref) => {
      if (!ref?.current) return;
      
      const scrollContainer = ref.current;
      
      const handleScroll = () => {
        isScrolling[category] = true;
        clearTimeout(scrollTimeouts[category]);
        
        // Wait longer for scroll to fully settle before snapping
        scrollTimeouts[category] = setTimeout(() => {
          isScrolling[category] = false;
          
          const cards = Array.from(scrollContainer.querySelectorAll('.job-card'));
          if (cards.length === 0) return;
          
          const containerRect = scrollContainer.getBoundingClientRect();
          const containerCenterX = containerRect.width / 2;
          
          // Find card closest to screen center
          let closestCard = null;
          let minDistance = Infinity;
          
          for (let card of cards) {
            const cardRect = card.getBoundingClientRect();
            const cardCenterX = cardRect.left - containerRect.left + cardRect.width / 2;
            const distance = Math.abs(cardCenterX - containerCenterX);
            
            if (distance < minDistance) {
              minDistance = distance;
              closestCard = card;
            }
          }
          
          if (closestCard) {
            // Use native scrollIntoView with center alignment - much more reliable
            closestCard.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
              inline: 'center'
            });
          }
        }, 20); // Ultra-fast smooth snap
      };
      
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
        clearTimeout(scrollTimeouts[category]);
      };
    };
    
    const cleanups = Object.entries(scrollRefsMap.current).map(([category, ref]) => 
      setupScrollListener(category, ref)
    );
    
    return () => {
      cleanups.forEach(cleanup => cleanup?.());
      Object.values(scrollTimeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [isMobile]);

  useEffect(() => {
    if (allCardsUnfiltered.length === 0) {
      setCardOrder([]);
      return;
    }

    const cacheKey = `home-card-order:${cardsSignature}`;
    const cachedOrder = homeCardOrderCache.get(cacheKey) || readStoredOrder(cacheKey, allCardsUnfiltered.length);
    const nextOrder = cachedOrder || buildShuffledOrder(allCardsUnfiltered.length);
    homeCardOrderCache.set(cacheKey, nextOrder);
    writeStoredOrder(cacheKey, nextOrder);

    setCardOrder((prevOrder) => {
      const prevValue = prevOrder.join(',');
      const nextValue = nextOrder.join(',');
      return prevValue === nextValue ? prevOrder : nextOrder;
    });
  }, [allCardsUnfiltered.length, cardsSignature]);

  // Keep mobile card order stable across filter changes.
  // Avoid reshuffling during every tab swap so the UI stays seamless.
  useEffect(() => {
    if (!isMobile || allCardsUnfiltered.length === 0) return;
    if (cardOrder.length === allCardsUnfiltered.length) return;

    const cacheKey = `home-card-order:${cardsSignature}`;
    const cachedOrder = homeCardOrderCache.get(cacheKey) || readStoredOrder(cacheKey, allCardsUnfiltered.length);
    const nextOrder = cachedOrder || buildShuffledOrder(allCardsUnfiltered.length);

    homeCardOrderCache.set(cacheKey, nextOrder);
    writeStoredOrder(cacheKey, nextOrder);

    setCardOrder(nextOrder);
  }, [isMobile, cardsSignature, allCardsUnfiltered.length, cardOrder.length]);

  useEffect(() => {
    if (categories.length === 0) {
      setCategoryOrder([]);
      return;
    }

    const cacheKey = `home-category-order:${categoriesSignature}`;
    const cachedOrder = homeCategoryOrderCache.get(cacheKey) || readStoredOrder(cacheKey, categories.length);
    const nextOrder = cachedOrder || buildShuffledOrder(categories.length);
    homeCategoryOrderCache.set(cacheKey, nextOrder);
    writeStoredOrder(cacheKey, nextOrder);

    setCategoryOrder((prevOrder) => {
      const prevValue = prevOrder.join(',');
      const nextValue = nextOrder.join(',');
      return prevValue === nextValue ? prevOrder : nextOrder;
    });
  }, [categories.length, categoriesSignature]);

  const shuffledCategories = useMemo(() => {
    if (categoryOrder.length > 0) {
      return categoryOrder.map(idx => categories[idx]).filter(Boolean);
    }
    return categories;
  }, [categories, categoryOrder]);

  const paginatedCategories = useMemo(() => {
    const startIndex = currentPage * ROWS_PER_PAGE;
    return shuffledCategories.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [shuffledCategories, currentPage]);

  // Create randomized flat list of all cards for mobile display using the cached order
  const mobileRandomizedCards = useMemo(() => {
    if (!isMobile) return [];
    if (allCardsUnfiltered.length === 0) return [];

    const shuffled = cardOrder
      .filter(idx => idx < allCardsUnfiltered.length)
      .map(idx => allCardsUnfiltered[idx])
      .filter(Boolean);

    const visible = new Set(filteredCards.map(card => card.id));
    return shuffled.filter(card => visible.has(card.id));
  }, [allCardsUnfiltered, filteredCards, cardOrder, isMobile]);

  return (
    <div className="Home-container">
      <div className="Home search-active">
        <div className="home-search-section">
            <Search profiles={profiles} onSearchChange={onSearchChange} resultCount={filteredCards.length} hasSearch={searchTerm.length > 0} />
        </div>
        
        {/* Render mobile randomized grid or desktop categorized view */}
        <>
          {filteredCards.length === 0 ? null : isMobile ? (
            // MOBILE: Randomized flat grid without categories
            <div className="jobs-scroll mobile-randomized-grid" style={{ display: selectedProfile ? 'none' : 'grid' }}>
              {mobileRandomizedCards.map((card) => (
                <JobCard 
                  key={card.id} 
                  job={card} 
                  searchTerm={searchTerm}
                  onSelect={() => {
                    console.log('🎯 Card clicked:', card.title || card.name);
                    onSelectProfile(card);
                  }}
                  onToggleLiked={onToggleLiked}
                  likedItems={likedItems}
                  onToggleBookmarked={onToggleBookmarked}
                  bookmarkedItems={bookmarkedItems}
                  onToggleFollowing={onToggleFollowing}
                  followingItems={followingItems}
                  isUserProfile={card.id === userProfileId}
                />
              ))}
            </div>
          ) : (
            // DESKTOP: Categorized view with pagination
            <>
              <div className="categories-container" style={{ display: selectedProfile ? 'none' : 'flex' }}>
                {paginatedCategories.map(([category, categoryItems], idx) => {
                      const categoryScrollRef = getOrCreateRef(category);
                      const categoryScrollState = scrollStates[category] || { canScrollLeft: false, canScrollRight: false, hasOverflow: false };
                      
                      const shouldShowLeftBtn = categoryScrollState.hasOverflow && categoryScrollState.canScrollLeft;
                      const shouldShowRightBtn = categoryScrollState.hasOverflow && categoryScrollState.canScrollRight;
                      
                      // Calculate the order for smooth CSS transition
                      const categoryIndex = shuffledCategories.findIndex(([cat]) => cat === category);
                      
                      return (
                        <div 
                          key={category} 
                          className="category-section scrollable-category"
                          style={{ order: categoryIndex }}
                        >
                          <h3 className="category-header">{category}</h3>
                          {shouldShowLeftBtn && (
                            <button 
                              className="scroll-btn scroll-btn-left"
                              onClick={() => handleScroll('left', category)}
                              aria-label="Scroll left"
                              title="Scroll left"
                            >
                              ‹
                            </button>
                          )}
                          <div 
                            className={`jobs-scroll ${isMobile ? 'mobile-carousel' : ''}`}
                            ref={categoryScrollRef}
                            onScroll={() => checkScroll(category)}
                            onTouchStart={(e) => {
                              handleTouchStart.current[category] = e.touches[0].clientX;
                            }}
                            onTouchEnd={(e) => handleTouchEnd(e, category)}
                            onTouchMove={(e) => handleTouchMove(e, category)}
                          >
                            {categoryItems.map((card, idx) => {
                              // Find the original index in the unfiltered card list and apply the stable order
                              const originalIndex = allCardsUnfiltered.findIndex(c => c.id === card.id);
                              const cardVisualOrder = cardOrder[originalIndex] !== undefined ? cardOrder[originalIndex] : originalIndex;
                              
                              return (
                                <JobCard 
                                  key={card.id} 
                                  job={card} 
                                  searchTerm={searchTerm}
                                  onSelect={() => {
                                    console.log('🎯 Card clicked:', card.title || card.name);
                                    onSelectProfile(card);
                                  }}
                                  onToggleLiked={onToggleLiked}
                                  likedItems={likedItems}
                                  onToggleBookmarked={onToggleBookmarked}
                                  bookmarkedItems={bookmarkedItems}
                                  onToggleFollowing={onToggleFollowing}
                                  followingItems={followingItems}
                                  isUserProfile={card.id === userProfileId}
                                  style={{ order: cardVisualOrder }}
                                />
                              );
                            })}
                          </div>
                          {shouldShowRightBtn && (
                            <button 
                              className="scroll-btn scroll-btn-right"
                              onClick={() => handleScroll('right', category)}
                              aria-label="Scroll right"
                              title="Scroll right"
                            >
                              ›
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Pagination Controls */}
                  {shuffledCategories.length > ROWS_PER_PAGE && (
                    <div className="pagination-container">
                      <button 
                        className="pagination-btn"
                        onClick={() => startTransition(() => setCurrentPage(Math.max(0, currentPage - 1)))}
                        disabled={currentPage === 0}
                        title="Previous page"
                      >
                        ← Prev
                      </button>
                      <span className="pagination-info">
                        Page {currentPage + 1} of {Math.ceil(shuffledCategories.length / ROWS_PER_PAGE)}
                      </span>
                      <button 
                        className="pagination-btn"
                        onClick={() => startTransition(() => setCurrentPage(Math.min(Math.ceil(shuffledCategories.length / ROWS_PER_PAGE) - 1, currentPage + 1)))}
                        disabled={currentPage === Math.ceil(shuffledCategories.length / ROWS_PER_PAGE) - 1}
                        title="Next page"
                      >
                        Next →
                      </button>
                    </div>
                  )}
            </>
          )}
        </>
        
      </div>
      {selectedProfile && (
        selectedProfile.cardType === 'job-ad' ? (
          <JobsDetailsPage
            profile={selectedProfile}
            onClose={() => onSelectProfile(null)}
            onApplyNow={(jobPosting) => {
              setSelectedJobForApplication(jobPosting);
              setShowApplicationPage(true);
            }}
            onToggleFollowing={onToggleFollowing}
            followingItems={followingItems}
            onToggleLiked={onToggleLiked}
            likedItems={likedItems}
          />
        ) : (
          <DetailsPanel 
            profile={selectedProfile}
            profileType={selectedProfile.cardType}
            onClose={() => onSelectProfile(null)}
            onToggleFollowing={onToggleFollowing}
            followingItems={followingItems}
            currentUserProfile={currentUserProfile}
            onUpdateProfile={onUpdateProfile}
            onToggleLiked={onToggleLiked}
            likedItems={likedItems}
            onApplyNow={(jobPosting) => {
              setSelectedJobForApplication(jobPosting);
              setShowApplicationPage(true);
            }}
          />
        )
      )}
      {showApplicationPage && selectedJobForApplication && (
        <ApplyPage 
          jobPosting={selectedJobForApplication}
          jobSeekerProfile={currentUserProfile || { name: '', email: '', phone: '', location: '' }}
          onBack={() => setShowApplicationPage(false)}
          onApplicationSuccess={() => {
            setShowApplicationPage(false);
            onSelectProfile(null);
          }}
        />
      )}

    </div>
  );
}

export default Home;
