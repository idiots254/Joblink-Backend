import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppWrapper from './pages/AppWrapper';
import { setSystemBarLightMode } from './services/screenshotControl';

// Initialize theme defensively so startup doesn't blank the shell if storage or media APIs are unavailable.
let savedTheme = null;
try {
  savedTheme = localStorage.getItem('appTheme');
} catch (e) {
  console.warn('Failed to read appTheme from localStorage during startup:', e);
}

const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

try {
  document.documentElement.setAttribute('data-theme', initialTheme);
} catch (e) {
  console.warn('Failed to set data-theme on startup:', e);
}

async function applyInitialTheme(nativePersist) {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    await setSystemBarLightMode(initialTheme === 'light', nativePersist);
  } catch (e) {
    console.warn('Failed to apply native system bar theme:', e);
  }
}

// Apply system or saved theme as soon as the web app is ready and native plugin can settle.
window.requestAnimationFrame(() => {
  setTimeout(() => applyInitialTheme(!!savedTheme), 300);
});

// Signal that React has not yet mounted; the bundle will flip this to true when it runs.
try { window.__REACT_MOUNTED__ = false; } catch (e) {}

if (!savedTheme && window.matchMedia) {
  const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = (event) => {
    const nextTheme = event.matches ? 'dark' : 'light';
    try {
      document.documentElement.setAttribute('data-theme', nextTheme);
      setSystemBarLightMode(nextTheme === 'light', /*persist=*/ false);
    } catch (e) {
      console.warn('Failed to react to system theme change:', e);
    }
  };

  if (typeof colorSchemeQuery.addEventListener === 'function') {
    colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
  } else if (typeof colorSchemeQuery.addListener === 'function') {
    colorSchemeQuery.addListener(handleSystemThemeChange);
  }
}

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🔥 RootErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0b1216',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>App failed to load</h1>
          <p style={{ maxWidth: 600, marginTop: 12, textAlign: 'center' }}>{this.state.error?.message || 'Unknown error'}</p>
          <pre style={{
            marginTop: 20,
            width: '100%',
            maxWidth: 700,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#111',
            color: '#f8f8f8',
            padding: 16,
            borderRadius: 12,
            overflowX: 'auto'
          }}>{this.state.errorInfo?.componentStack || ''}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <AppWrapper />
      </BrowserRouter>
    </RootErrorBoundary>
  </React.StrictMode>
);

// After scheduling the render, mark React as mounted shortly after — bundle-level runtime
setTimeout(() => {
  try {
    window.__REACT_MOUNTED__ = true;
    const fallback = document.getElementById('static-fallback');
    if (fallback) fallback.style.display = 'none';
    console.log('✅ React mount probe set to true');
  } catch (e) {
    console.warn('Could not set React mount probe:', e);
  }
}, 1000);

const origin = window.location?.origin || 'unknown';
const isNativePlatform = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
const isNativeWebView = isNativePlatform || origin.includes('localhost') || origin.startsWith('capacitor://') || origin.startsWith('ionic://');

console.log('🔧 index.js startup', {
  env: process.env.NODE_ENV,
  origin,
  isNativePlatform,
  isNativeWebView,
  serviceWorkerSupported: 'serviceWorker' in navigator,
});

window.addEventListener('error', (event) => {
  console.error('🧨 Global error captured:', event.error || event.message, event.filename, event.lineno, event.colno);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🧨 Unhandled promise rejection:', event.reason);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        console.log('🧹 Existing service worker registrations found:', registrations.length);
      }
      for (const registration of registrations) {
        console.log('🧹 Unregistering service worker:', registration);
        await registration.unregister();
      }
    } catch (error) {
      console.warn('⚠️ Failed to check/unregister service workers:', error);
    }

    if (process.env.NODE_ENV === 'production' && !isNativeWebView) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('✓ Service Worker registered:', registration);
      } catch (error) {
        console.log('✗ Service Worker registration failed:', error);
      }
    } else if (process.env.NODE_ENV === 'production' && isNativeWebView) {
      console.log('ℹ️ Running in native/webview production; service workers are disabled.');
    }
  });
}
