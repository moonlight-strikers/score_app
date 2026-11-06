package com.moonlightstrikers.cricket;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private WindowInsetsControllerCompat insetsController;
    private String currentThemeMode = "dark";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupEdgeToEdge();
    }

    private void setupEdgeToEdge() {
        Window window = getWindow();

        // Enable edge-to-edge layout: content draws behind status and navigation bars
        WindowCompat.setDecorFitsSystemWindows(window, false);

        // Make status and navigation bars transparent
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        View decorView = window.getDecorView();
        insetsController = WindowCompat.getInsetsController(window, decorView);

        // Set initial icon appearance (white icons for dark mode)
        applyTheme(currentThemeMode);

        // Calculate system status bar & navigation insets and pass them to Webview
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
            int statusBarHeight = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int navBarHeight = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;

            float density = getResources().getDisplayMetrics().density;
            int satDp = density > 0 ? Math.round(statusBarHeight / density) : 0;
            int sabDp = density > 0 ? Math.round(navBarHeight / density) : 0;

            postInsetsToWeb(satDp, sabDp);
            return insets;
        });

        attachThemeBridge();
    }

    @Override
    public void onStart() {
        super.onStart();
        attachThemeBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        attachThemeBridge();
    }

    private void applyTheme(String mode) {
        currentThemeMode = mode;
        if (insetsController != null) {
            boolean isLight = "light".equalsIgnoreCase(mode);
            // Light mode: dark status bar icons and dark navigation icons
            // Dark mode: light/white status bar icons and light navigation icons
            insetsController.setAppearanceLightStatusBars(isLight);
            insetsController.setAppearanceLightNavigationBars(isLight);
        }
    }

    private void attachThemeBridge() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.post(() -> {
                    try {
                        webView.addJavascriptInterface(new Object() {
                            @JavascriptInterface
                            public void setStatusBarTheme(final String mode) {
                                runOnUiThread(() -> applyTheme(mode));
                            }
                        }, "AndroidEdgeToEdge");
                    } catch (Exception ignored) {
                    }
                });
            }
        } catch (Exception ignored) {
        }
    }

    private void postInsetsToWeb(int satDp, int sabDp) {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                webView.post(() -> {
                    try {
                        String js = String.format(
                            "document.documentElement.style.setProperty('--sat', '%dpx');" +
                            "document.documentElement.style.setProperty('--sab', '%dpx');",
                            satDp, sabDp
                        );
                        webView.evaluateJavascript(js, null);
                    } catch (Exception ignored) {
                    }
                });
            }
        } catch (Exception ignored) {
        }
    }
}
