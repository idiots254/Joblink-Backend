package com.joblink.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.PorterDuff;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebResourceResponse;
import android.net.Uri;
import java.io.InputStream;
import java.net.URLConnection;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.joblink.app.ScreenshotControl;

public class MainActivity extends BridgeActivity {
    private View splashView;
    private String pendingJsInjection = null;
    private boolean themeSyncRetryScheduled = false;
    private int themeSyncRetryCount = 0;
    private boolean splashVisible = false;
    private final Handler splashHandler = new Handler(Looper.getMainLooper());
    private Runnable splashRemovalRunnable;
    private static final int MAX_THEME_SYNC_RETRIES = 15; // Limit retries to ~3 seconds (15 * 220ms)
    private static final long SPLASH_DURATION_MS = 1850;
    
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Register plugin to allow toggling FLAG_SECURE at runtime from JavaScript
        this.registerPlugin(ScreenshotControl.class);
        
        super.onCreate(savedInstanceState);
        
        // Create notification channels for Android 8+
        createNotificationChannels();
        
        // Enable edge-to-edge rendering
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        
        // Configure navigation bar after super.onCreate()
        configureNavigationBar();
        applyCurrentTheme();
        
        // Show custom splash layout with Linkwhite logo and "from Joblink" text
        showCustomSplash();
        attachWebViewReadyListener();
        handleIntent(getIntent());
        
        // Enable WebView debugging for remote DevTools
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(android.content.Intent intent) {
        try {
            if (intent == null) return;
            android.net.Uri uri = intent.getData();
            if (uri == null) return;
            String scheme = uri.getScheme();
            String host = uri.getHost();
            // If the OAuth provider redirected to http://localhost/... with fragment (access_token),
            // inject the fragment into the WebView hash and reload so JS can pick it up.
            if (("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) && ("localhost".equalsIgnoreCase(host) || "127.0.0.1".equalsIgnoreCase(host))) {
                String frag = uri.getFragment();
                if (frag != null && !frag.isEmpty()) {
                    String escaped = frag.replace("\\","\\\\").replace("'","\\'");
                    String js = "window.location.hash='" + escaped + "'; window.location.reload();";
                    // If webview available, run now; otherwise save for later.
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
                    } else {
                        pendingJsInjection = js;
                    }
                }
            }
        } catch (Exception ex) {
            android.util.Log.w("MainActivity", "handleIntent failed", ex);
        }
    }

    /**
     * Create notification channels for Android 8+ (required for notifications)
     * Channels must be created before posting notifications
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Main notifications channel (HIGH importance for head-up notifications)
            NotificationChannel notificationsChannel = new NotificationChannel(
                "notifications",
                getString(R.string.app_name),
                NotificationManager.IMPORTANCE_HIGH
            );
            notificationsChannel.setDescription(getString(R.string.app_name) + " notifications including likes, follows, and messages");
            notificationsChannel.enableVibration(true);
            notificationsChannel.enableLights(true);
            notificationsChannel.setLightColor(0xFF00A884);
            notificationsChannel.setShowBadge(true);
            
            // Get NotificationManager and create the channels
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(notificationsChannel);
            }
        }
    }
    
    private void configureNavigationBar() {
        View decorView = getWindow().getDecorView();
        int systemUiVisibility = decorView.getSystemUiVisibility();

        getWindow().setNavigationBarColor(0x00000000);
        getWindow().setStatusBarColor(0x00000000);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        systemUiVisibility |= View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
        systemUiVisibility |= View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
        systemUiVisibility |= View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        systemUiVisibility &= ~View.SYSTEM_UI_FLAG_HIDE_NAVIGATION;
        systemUiVisibility &= ~View.SYSTEM_UI_FLAG_FULLSCREEN;
        systemUiVisibility &= ~View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;

        decorView.setSystemUiVisibility(systemUiVisibility);
        // Preserve icon appearance flags and let the current theme application handle them.
    }

    private void syncThemeFromWebView() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        themeSyncRetryScheduled = false;
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(
            "localStorage.getItem('appTheme')",
            value -> {
                if (value == null || value.isEmpty()) {
                    SharedPreferences prefs = getSharedPreferences("appTheme", android.content.Context.MODE_PRIVATE);
                    boolean lightMode = prefs.getBoolean("lightMode", false);
                    boolean explicitTheme = prefs.getBoolean("explicitTheme", false);
                    if (explicitTheme) {
                        ScreenshotControl.applySystemBarStyle(MainActivity.this, lightMode);
                    }
                    Log.d("MainActivity", "syncThemeFromWebView: no value returned from webview; using cached theme");
                    if (!explicitTheme && !themeSyncRetryScheduled) {
                        themeSyncRetryScheduled = true;
                        new Handler(Looper.getMainLooper()).postDelayed(() -> syncThemeFromWebView(), 220);
                    }
                    return;
                }

                String theme = value.replace("\"", "").trim();
                if (theme.isEmpty() || "null".equalsIgnoreCase(theme) || "undefined".equalsIgnoreCase(theme)) {
                    SharedPreferences prefs = getSharedPreferences("appTheme", android.content.Context.MODE_PRIVATE);
                    boolean lightMode = prefs.getBoolean("lightMode", false);
                    boolean explicitTheme = prefs.getBoolean("explicitTheme", false);
                    if (explicitTheme) {
                        ScreenshotControl.applySystemBarStyle(MainActivity.this, lightMode);
                    }
                    Log.d("MainActivity", "syncThemeFromWebView: no explicit appTheme found in webview; using cached theme");
                    if (!explicitTheme && !themeSyncRetryScheduled) {
                        themeSyncRetryScheduled = true;
                        new Handler(Looper.getMainLooper()).postDelayed(() -> syncThemeFromWebView(), 220);
                    }
                    return;
                }

                Log.d("MainActivity", "syncThemeFromWebView: raw value=" + value + " parsed theme=" + theme);
                boolean lightMode = "light".equalsIgnoreCase(theme);
                SharedPreferences prefs = getSharedPreferences("appTheme", android.content.Context.MODE_PRIVATE);
                prefs.edit().putBoolean("lightMode", lightMode).putBoolean("explicitTheme", true).apply();
                Log.d("MainActivity", "syncThemeFromWebView: applying lightMode=" + lightMode);
                ScreenshotControl.applySystemBarStyle(MainActivity.this, lightMode);
                new Handler(Looper.getMainLooper()).postDelayed(() -> ScreenshotControl.applySystemBarStyle(MainActivity.this, lightMode), 180);
            }
        ));
    }

    private void showCustomSplash() {
        // Inflate and show the custom splash layout
        LayoutInflater inflater = LayoutInflater.from(this);
        splashView = inflater.inflate(R.layout.splash_screen, null);

        if (splashView != null) {
            SharedPreferences prefs = getSharedPreferences("appTheme", android.content.Context.MODE_PRIVATE);
            boolean explicitTheme = prefs.getBoolean("explicitTheme", false);
            boolean lightMode = prefs.getBoolean("lightMode", false);
            boolean isDarkMode = !lightMode;

            if (!explicitTheme) {
                isDarkMode = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
            }

            int backgroundColor = isDarkMode ? 0xFF0B1216 : Color.WHITE;
            int logoTintColor = isDarkMode ? Color.WHITE : Color.BLACK;
            int textColor = isDarkMode ? 0xFFF5F5F5 : 0xFF111111;

            splashView.setBackgroundColor(backgroundColor);

            View logoView = splashView.findViewById(R.id.splash_logo);
            if (logoView instanceof ImageView) {
                ImageView imageView = (ImageView) logoView;
                imageView.setColorFilter(logoTintColor, PorterDuff.Mode.SRC_IN);
                imageView.setImageAlpha(255);
            }

            View textView = splashView.findViewWithTag("splashText");
            if (textView instanceof TextView) {
                ((TextView) textView).setTextColor(textColor);
            }

            View rootView = getWindow().getDecorView().findViewById(android.R.id.content);
            if (rootView instanceof FrameLayout) {
                ((FrameLayout) rootView).addView(splashView);
                splashVisible = true;
            }
        }

        splashHandler.removeCallbacks(splashRemovalRunnable);
        splashRemovalRunnable = () -> hideSplash();
        splashHandler.postDelayed(splashRemovalRunnable, SPLASH_DURATION_MS);
    }

    private void attachWebViewReadyListener() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();
        if (webView.getProgress() >= 100) {
            return;
        }

        webView.setWebViewClient(new android.webkit.WebViewClient() {
            private boolean openPhoneUrl(Uri url) {
                if (url == null || url.getScheme() == null) {
                    return false;
                }

                String scheme = url.getScheme().toLowerCase(java.util.Locale.ROOT);
                boolean isWhatsAppWebUrl = "https".equals(scheme)
                    && "wa.me".equalsIgnoreCase(url.getHost());
                if (!"tel".equals(scheme) && !"sms".equals(scheme) && !"mailto".equals(scheme)
                    && !"whatsapp".equals(scheme) && !isWhatsAppWebUrl) {
                    return false;
                }

                try {
                    android.content.Intent intent;
                    if ("tel".equals(scheme)) {
                        intent = new android.content.Intent(android.content.Intent.ACTION_DIAL, url);
                    } else if ("sms".equals(scheme) || "mailto".equals(scheme)) {
                        intent = new android.content.Intent(android.content.Intent.ACTION_SENDTO, url);
                    } else {
                        intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, url);
                    }
                    startActivity(intent);
                } catch (android.content.ActivityNotFoundException ex) {
                    Log.w("MainActivity", "No app can handle URL: " + url, ex);
                }
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                return openPhoneUrl(request.getUrl())
                    || super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openPhoneUrl(Uri.parse(url))
                    || super.shouldOverrideUrlLoading(view, url);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, android.webkit.WebResourceRequest request) {
                try {
                    Uri url = request.getUrl();
                    String host = url.getHost();
                    String path = url.getPath();
                    if (host != null && ("localhost".equals(host) || "127.0.0.1".equals(host)) && path != null) {
                        // Serve packaged assets for requests to localhost (static files)
                        if (path.startsWith("/static/") || path.equals("/favicon.ico") || path.startsWith("/LinkWhite")) {
                            String assetPath = "public" + path; // assets/public/...
                            if (assetPath.startsWith("/")) assetPath = assetPath.substring(1);
                            InputStream is = null;
                            try {
                                is = getAssets().open(assetPath);
                            } catch (Exception ex) {
                                android.util.Log.w("MainActivity", "asset not found: " + assetPath + "", ex);
                                return super.shouldInterceptRequest(view, request);
                            }
                            String mime = URLConnection.guessContentTypeFromName(path);
                            if (mime == null) {
                                if (path.endsWith(".js")) mime = "application/javascript";
                                else if (path.endsWith(".css")) mime = "text/css";
                                else if (path.endsWith(".png")) mime = "image/png";
                                else if (path.endsWith(".ico")) mime = "image/x-icon";
                                else mime = "application/octet-stream";
                            }
                            return new WebResourceResponse(mime, "UTF-8", is);
                        }
                    }
                } catch (Exception e) {
                    android.util.Log.w("MainActivity", "shouldInterceptRequest failed", e);
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                try {
                    // Fallback for older API levels - convert to Uri and reuse logic
                    Uri u = Uri.parse(url);
                    String host = u.getHost();
                    String path = u.getPath();
                    if (host != null && ("localhost".equals(host) || "127.0.0.1".equals(host)) && path != null) {
                        if (path.startsWith("/static/") || path.equals("/favicon.ico") || path.startsWith("/LinkWhite")) {
                            String assetPath = "public" + path;
                            if (assetPath.startsWith("/")) assetPath = assetPath.substring(1);
                            InputStream is = null;
                            try {
                                is = getAssets().open(assetPath);
                            } catch (Exception ex) {
                                android.util.Log.w("MainActivity", "asset not found: " + assetPath + "", ex);
                                return super.shouldInterceptRequest(view, url);
                            }
                            String mime = URLConnection.guessContentTypeFromName(path);
                            if (mime == null) {
                                if (path.endsWith(".js")) mime = "application/javascript";
                                else if (path.endsWith(".css")) mime = "text/css";
                                else if (path.endsWith(".png")) mime = "image/png";
                                else if (path.endsWith(".ico")) mime = "image/x-icon";
                                else mime = "application/octet-stream";
                            }
                            return new WebResourceResponse(mime, "UTF-8", is);
                        }
                    }
                } catch (Exception e) {
                    android.util.Log.w("MainActivity", "shouldInterceptRequest(fallback) failed", e);
                }
                return super.shouldInterceptRequest(view, url);
            }
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                try {
                    if (pendingJsInjection != null) {
                        final String jsToRun = pendingJsInjection;
                        pendingJsInjection = null;
                        view.post(() -> view.evaluateJavascript(jsToRun, null));
                    }
                } catch (Exception ex) {
                    android.util.Log.w("MainActivity", "inject pending js failed", ex);
                }
            }
        });
    }

    private void hideSplash() {
        if (splashRemovalRunnable != null) {
            splashHandler.removeCallbacks(splashRemovalRunnable);
        }

        if (!splashVisible || splashView == null || splashView.getParent() == null) {
            return;
        }

        splashVisible = false;
        if (splashView.getParent() instanceof FrameLayout) {
            ((FrameLayout) splashView.getParent()).removeView(splashView);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        
        // Enable edge-to-edge content
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        
        configureNavigationBar();
        applyCurrentTheme();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        configureNavigationBar();
        // Update using current app or system theme and let webview sync afterwards
        applyCurrentTheme();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            configureNavigationBar();
            applyCurrentTheme();
        }
    }

    private void applySystemThemeFromSystem() {
        try {
            int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            boolean systemLight = (nightModeFlags != Configuration.UI_MODE_NIGHT_YES);
            android.util.Log.d("MainActivity", "applySystemThemeFromSystem: systemLight=" + systemLight);
            // Only apply system theme if there is no explicit user-picked app theme.
            SharedPreferences prefs = getSharedPreferences("appTheme", android.content.Context.MODE_PRIVATE);
            boolean hasExplicit = prefs.getBoolean("explicitTheme", false);
            if (!hasExplicit) {
                ScreenshotControl.applySystemBarStyle(this, systemLight);
            } else {
                android.util.Log.d("MainActivity", "applySystemThemeFromSystem: explicit app theme present, skipping system apply");
            }
        } catch (Exception ex) {
            android.util.Log.w("MainActivity", "applySystemThemeFromSystem failed", ex);
        }
    }

    private void applyCurrentTheme() {
        SharedPreferences prefs = getSharedPreferences("appTheme", android.content.Context.MODE_PRIVATE);
        boolean explicitTheme = prefs.getBoolean("explicitTheme", false);
        boolean lightMode = prefs.getBoolean("lightMode", false);

        if (explicitTheme) {
            ScreenshotControl.applySystemBarStyle(this, lightMode);
            android.util.Log.d("MainActivity", "applyCurrentTheme: explicit theme applied lightMode=" + lightMode);
            return;
        }

        applySystemThemeFromSystem();
    }
}
