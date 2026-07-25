// API Configuration
let API_URL;

const configuredApiUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_BACKEND_URL;

if (configuredApiUrl) {
  // Environment variable takes priority (for release builds)
  API_URL = configuredApiUrl;
} else {
  // Default: use Render for production, localhost for development
  API_URL = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8080'
    : 'https://joblink-backend-a4bv.onrender.com';
}

// For native apps, differentiate between debug and release
if (typeof window !== 'undefined' && window.Capacitor) {
  if (process.env.NODE_ENV === 'production') {
    // Release APK: use production Render backend
    API_URL = 'https://joblink-backend-a4bv.onrender.com';
  } else {
    // Debug APK: use local backend (physical device)
    API_URL = 'http://192.168.100.5:8080';
  }
}

console.log('🔗 API URL:', API_URL);

export { API_URL };
