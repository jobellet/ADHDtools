package com.adhdtools.app;

import android.Manifest;
import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Set;

/**
 * One screen: a WebView running the web app from the APK's assets (works offline).
 * Pages are served from https://appassets.androidplatform.net so ES modules and localStorage
 * behave as on GitHub Pages. Native features go through NativeBridge.
 */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String START_URL = ORIGIN + "/app/index.html";
    private static final int REQUEST_FILE = 1;
    private static final int REQUEST_SAVE = 2;
    private static final int REQUEST_NOTIFICATIONS = 3;

    private static volatile boolean onScreen = false;

    private WebView webView;
    private NativeBridge bridge;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingSave;
    private boolean openedByAlarm;

    /** True while the app is in front: the web app then rings its own alarms. */
    static boolean isOnScreen() {
        return onScreen;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Alarms.createChannels(this);
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true); // chrome://inspect for debug builds
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.app_background));
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        keepClearOfSystemBars(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false); // alarm tones start without a tap
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/app/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (ORIGIN.equals(url.getScheme() + "://" + url.getHost())) return false;
                openOutside(url); // links, mailto:, Google pages: the browser or the right app
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try {
                    startActivityForResult(pick, REQUEST_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        bridge = new NativeBridge(this);
        Set<String> origins = Collections.singleton(ORIGIN);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "AdhdAndroid", origins, bridge);
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, readBridgeScript(), origins);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
        }

        handleAlarmIntent(getIntent());
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(START_URL);
        }
    }

    private String readBridgeScript() {
        try (InputStream in = getResources().openRawResource(R.raw.android_bridge)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // Android 15 draws apps under the status and navigation bars: keep the page (and the keyboard) clear of them.
    // The web app has a light theme only, so the bar icons are always dark.
    @SuppressWarnings("deprecation")
    private void keepClearOfSystemBars(View root) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            getWindow().setStatusBarColor(getColor(R.color.app_background));
            getWindow().setNavigationBarColor(getColor(R.color.app_background));
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        } else {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(light, light);
            }
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
    }

    private void openOutside(Uri url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (ActivityNotFoundException ignored) {
            // No app for this link: nothing to do.
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAlarmIntent(intent);
    }

    // Opened by a ringing alarm: show over the lock screen, turn the screen on, and keep ringing
    // until the user touches the screen (the web app's alarm then has Done / Snooze).
    private void handleAlarmIntent(Intent intent) {
        boolean fromAlarm = intent != null && intent.getBooleanExtra(Alarms.EXTRA_FROM_ALARM, false);
        if (fromAlarm) intent.removeExtra(Alarms.EXTRA_FROM_ALARM); // a later resume is not an alarm
        openedByAlarm = fromAlarm;
        setShowWhenLocked(fromAlarm);
        setTurnScreenOn(fromAlarm);
    }

    @Override
    protected void onResume() {
        super.onResume();
        onScreen = true;
        if (!openedByAlarm) Alarms.silenceAll(this); // opened by the user: the web app shows the alarm
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (openedByAlarm && event.getActionMasked() == MotionEvent.ACTION_DOWN) {
            openedByAlarm = false;
            Alarms.silenceAll(this);
        }
        return super.dispatchTouchEvent(event);
    }

    @Override
    protected void onPause() {
        onScreen = false;
        super.onPause();
    }

    @Override
    protected void onStop() {
        super.onStop();
        // Only an alarm may show the app over the lock screen.
        setShowWhenLocked(false);
        setTurnScreenOn(false);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        bridge.shutdown();
        webView.destroy();
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else moveTaskToBack(true); // keep timers and data loaded; Back never closes the app
    }

    void setKeepScreenOn(boolean on) {
        if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    /** native_toggle_mini_player: Android's picture-in-picture window. */
    void enterMiniPlayer() {
        if (isInPictureInPictureMode()) return;
        enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9)).build());
    }

    /** Export buttons: let the user choose where to save the file. */
    void saveFile(String name, String mime, byte[] data) {
        runOnUiThread(() -> {
            pendingSave = data;
            Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime)
                    .putExtra(Intent.EXTRA_TITLE, name == null || name.isEmpty() ? "download" : name);
            try {
                startActivityForResult(save, REQUEST_SAVE);
            } catch (ActivityNotFoundException e) {
                pendingSave = null;
                Toast.makeText(this, R.string.save_failed, Toast.LENGTH_LONG).show();
            }
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_FILE && fileCallback != null) {
            Uri picked = resultCode == RESULT_OK && data != null ? data.getData() : null;
            fileCallback.onReceiveValue(picked == null ? null : new Uri[] {picked});
            fileCallback = null;
        } else if (requestCode == REQUEST_SAVE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                out.write(bytes);
                Toast.makeText(this, R.string.saved_file, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, R.string.save_failed, Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == SpeechSession.REQUEST_MIC) {
            bridge.speech().onPermissionResult(grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED);
        }
    }
}
