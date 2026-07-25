import './Landing.css';
import { useState, useEffect, useRef } from 'react';
import HeroPage from './components/HeroPage';
import HowPage from './components/HowPage';
import TestimonialsPage from './components/TestimonialsPage';
import CTAPage from './components/CTAPage';

function Landing({ onGetStarted }) {
  const [activeSection, setActiveSection] = useState(0);
  const [showIndicator, setShowIndicator] = useState(true);
  const inactivityTimerRef = useRef(null);
  const indicatorTimerRef = useRef(null);
  const sectionsWrapperRef = useRef(null);

  const sections = [
    { id: 'hero', name: 'Hero' },
    { id: 'how', name: 'How It Works' },
    { id: 'testimonials', name: 'Testimonials' },
    { id: 'cta', name: "Let's Go" }
  ];

  // Auto-scroll on inactivity (60 seconds)
  useEffect(() => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // Set new timer - advances to next section after 60 seconds of inactivity
    inactivityTimerRef.current = setTimeout(() => {
      setActiveSection(prev => (prev + 1) % sections.length);
    }, 60000); // 60 seconds
    
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [activeSection, sections.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        setActiveSection(prev => (prev + 1) % sections.length);
      } else if (e.key === 'ArrowLeft') {
        setActiveSection(prev => (prev - 1 + sections.length) % sections.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sections.length]);

  const startXRef = useRef(0);

  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    console.log('Touch Start:', startXRef.current);
  };

  const handleTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    const swipeThreshold = 50;
    const diff = startXRef.current - endX;

    console.log('Touch End:', endX, 'Diff:', diff);

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        console.log('Swiped Left');
        setActiveSection(prev => (prev + 1) % sections.length);
      } else {
        console.log('Swiped Right');
        setActiveSection(prev => (prev - 1 + sections.length) % sections.length);
      }
    }
  };

  const handleMouseDown = (e) => {
    startXRef.current = e.clientX;
    console.log('Mouse Down:', startXRef.current);
  };

  const handleMouseUp = (e) => {
    const endX = e.clientX;
    const swipeThreshold = 50;
    const diff = startXRef.current - endX;

    console.log('Mouse Up:', endX, 'Diff:', diff);

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        console.log('Mouse Swiped Left');
        setActiveSection(prev => (prev + 1) % sections.length);
      } else {
        console.log('Mouse Swiped Right');
        setActiveSection(prev => (prev - 1 + sections.length) % sections.length);
      }
    }
  };

  // Hide indicator after first slide
  useEffect(() => {
    if (activeSection > 0) {
      setShowIndicator(false);
    }
  }, [activeSection]);

  // Show indicator after 30 seconds of inactivity
  useEffect(() => {
    const resetIndicatorTimer = () => {
      // Clear existing timer
      if (indicatorTimerRef.current) {
        clearTimeout(indicatorTimerRef.current);
      }
      
      // Set new timer - show indicator after 30 seconds of inactivity
      indicatorTimerRef.current = setTimeout(() => {
        if (activeSection > 0) {
          setShowIndicator(true);
        }
      }, 30000); // 30 seconds
    };

    // Activity listeners
    const activities = ['mousemove', 'keydown', 'touchstart', 'click'];
    
    activities.forEach(activity => {
      window.addEventListener(activity, resetIndicatorTimer);
    });

    // Initial timer
    resetIndicatorTimer();

    return () => {
      activities.forEach(activity => {
        window.removeEventListener(activity, resetIndicatorTimer);
      });
      if (indicatorTimerRef.current) {
        clearTimeout(indicatorTimerRef.current);
      }
    };
  }, [activeSection]);

  return (
    <div key={activeSection} className="landing-page">
      {/* Sticky Header */}
      <header className="sticky-header">
        <div className="header-container">
          <div className="logo-brand">
            <span className="logo-text-simple">JobLink</span>
          </div>
          <div className="header-actions">
            <button className="btn-header skip-btn" onClick={onGetStarted}>
              Skip
            </button>
          </div>
        </div>
      </header>

      {/* Scrolling Sections Container */}
      <div 
        className="sections-wrapper" 
        ref={sectionsWrapperRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <HeroPage onGetStarted={onGetStarted} activeSection={activeSection} />
        <HowPage activeSection={activeSection} />
        <TestimonialsPage activeSection={activeSection} />
        <CTAPage onGetStarted={onGetStarted} activeSection={activeSection} />
      </div>

      {/* Swipe Indicator */}
      <div className={`swipe-indicator ${!showIndicator ? 'hidden' : ''}`}>
        <span className="swipe-text">Slide</span>
        <div className="swipe-arrow-right">→</div>
      </div>

      {/* Navigation Dots */}
      <div className="section-indicators">
        {sections.map((section, index) => (
          <button
            key={index}
            className={`indicator-dot ${activeSection === index ? 'active' : ''}`}
            onClick={() => setActiveSection(index)}
            aria-label={`Go to ${section.name}`}
          />
        ))}
      </div>

      {/* Navigation Arrows */}
      <>
        <button 
          className="nav-arrow prev"
          onClick={() => setActiveSection(prev => (prev - 1 + sections.length) % sections.length)}
          aria-label="Previous section"
        >
          &lt;
        </button>
        <button 
          className="nav-arrow next"
          onClick={() => setActiveSection(prev => (prev + 1) % sections.length)}
          aria-label="Next section"
        >
          &gt;
        </button>
      </>
    </div>
  );
}

export default Landing;
