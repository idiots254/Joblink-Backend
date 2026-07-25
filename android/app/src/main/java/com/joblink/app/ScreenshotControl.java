package com.joblink.app;

import android.app.Activity;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenshotControl")
public class ScreenshotControl extends Plugin {

    @PluginMethod
    public void setSecure(PluginCall call) {
        boolean secure = call.getBoolean("secure", true);
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        Handler mainHandler = new Handler(Looper.getMainLooper());
        mainHandler.post(() -> {
            try {
                Window window = activity.getWindow();
                if (window == null) {
                    call.reject("Window not available");
                    return;
                }

                if (secure) {
                    window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                }

                call.resolve();
            } catch (Exception ex) {
                Log.e("ScreenshotControl", "Error setting secure flag on main thread", ex);
                call.reject("Failed to set secure flag", ex);
            }
        });
    }

    @PluginMethod
    public void setSystemBarStyle(PluginCall call) {
        boolean lightMode = call.getBoolean("lightMode", true);
        boolean persist = call.getBoolean("persist", true);
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }
        Log.d("ScreenshotControl", "setSystemBarStyle called. lightMode=" + lightMode + " persist=" + persist);

        // Save theme preference to SharedPreferences for native code to read on resume.
        // Keep a separate explicit flag so system theme changes can still re-apply.
        SharedPreferences prefs = activity.getSharedPreferences("appTheme", android.content.Context.MODE_PRIVATE);
        if (persist) {
            prefs.edit().putBoolean("lightMode", lightMode).putBoolean("explicitTheme", true).apply();
        } else {
            prefs.edit().putBoolean("explicitTheme", false).apply();
        }
        // Ensure UI changes run on the main thread
        try {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    applySystemBarStyle(activity, lightMode);
                }
            });
        } catch (Exception ex) {
            Log.w("ScreenshotControl", "Failed to run UI thread update, falling back", ex);
            applySystemBarStyle(activity, lightMode);
        }
        Log.d("ScreenshotControl", "Applied system bar style immediately");
        call.resolve();
    }

    public static void applySystemBarStyle(Activity activity, boolean lightMode) {
        if (activity == null) return;

        // Explicitly run on main thread using Handler
        Handler mainHandler = new Handler(Looper.getMainLooper());
        mainHandler.post(() -> {
            try {
                Window window = activity.getWindow();
                if (window == null) return;

                View decorView = window.getDecorView();
                if (decorView == null) return;

                window.setStatusBarColor(0x00000000);
                window.setNavigationBarColor(0x00000000);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, decorView);
                    controller.setAppearanceLightStatusBars(lightMode);
                    controller.setAppearanceLightNavigationBars(lightMode);
                    Log.d("ScreenshotControl", "applySystemBarStyle (R+): lightMode=" + lightMode);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    int flags = decorView.getSystemUiVisibility();
                    if (lightMode) {
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    } else {
                        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    }
                    decorView.setSystemUiVisibility(flags);
                    Log.d("ScreenshotControl", "applySystemBarStyle (M..R): lightMode=" + lightMode + " flags=" + flags);
                }
            } catch (Exception ex) {
                Log.e("ScreenshotControl", "Error applying system bar style on main thread", ex);
            }
        });

        // Retry after delays for reliability - also on main thread
        mainHandler.postDelayed(() -> {
            try {
                Window window = activity.getWindow();
                if (window == null) return;
                View decorView = window.getDecorView();
                if (decorView == null) return;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, decorView);
                    controller.setAppearanceLightStatusBars(lightMode);
                    controller.setAppearanceLightNavigationBars(lightMode);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    int flags = decorView.getSystemUiVisibility();
                    if (lightMode) {
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    } else {
                        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    }
                    decorView.setSystemUiVisibility(flags);
                }
            } catch (Exception ex) {
                Log.d("ScreenshotControl", "Retry 150ms failed", ex);
            }
        }, 150);

        mainHandler.postDelayed(() -> {
            try {
                Window window = activity.getWindow();
                if (window == null) return;
                View decorView = window.getDecorView();
                if (decorView == null) return;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, decorView);
                    controller.setAppearanceLightStatusBars(lightMode);
                    controller.setAppearanceLightNavigationBars(lightMode);
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    int flags = decorView.getSystemUiVisibility();
                    if (lightMode) {
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    } else {
                        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    }
                    decorView.setSystemUiVisibility(flags);
                }
            } catch (Exception ex) {
                Log.d("ScreenshotControl", "Retry 350ms failed", ex);
            }
        }, 350);
    }
}
