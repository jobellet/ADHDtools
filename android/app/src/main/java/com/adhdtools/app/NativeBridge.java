package com.adhdtools.app;

import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.FutureTask;

/**
 * The Android side of window.__TAURI__.core.invoke (see res/raw/android_bridge.js).
 * Every "native_…" command the web app calls must have a case here AND in src-tauri
 * (tests/native-alignment.test.js checks this), so the phone and desktop apps stay in step.
 */
final class NativeBridge implements WebViewCompat.WebMessageListener {
    private static final String STORE_FILE = "adhd-local-store.json";
    private static final String SECRETS_FILE = "adhd-secrets.json";

    private final MainActivity activity;
    private final SpeechSession speech;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Handler main = new Handler(Looper.getMainLooper());
    private ServerSocket oauthSocket;
    private String countdownLabel = "";
    private long countdownEnd = 0;

    NativeBridge(MainActivity activity) {
        this.activity = activity;
        this.speech = new SpeechSession(activity);
    }

    SpeechSession speech() {
        return speech;
    }

    @Override
    public void onPostMessage(@NonNull WebView view, @NonNull WebMessageCompat message, @NonNull Uri sourceOrigin,
                              boolean isMainFrame, @NonNull JavaScriptReplyProxy reply) {
        if (!isMainFrame || message.getData() == null) return;
        executor.execute(() -> {
            int id = 0;
            JSONObject answer = new JSONObject();
            try {
                JSONObject request = new JSONObject(message.getData());
                id = request.getInt("id");
                Object value = handle(request.getString("cmd"), request.optJSONObject("args"));
                answer.put("id", id).put("ok", true).put("value", value == null ? JSONObject.NULL : value);
            } catch (Exception e) {
                try {
                    answer.put("id", id).put("ok", false).put("error", String.valueOf(e.getMessage()));
                } catch (Exception ignored) {
                    return;
                }
            }
            String json = answer.toString();
            main.post(() -> reply.postMessage(json));
        });
    }

    private Object handle(String cmd, JSONObject args) throws Exception {
        if (args == null) args = new JSONObject();
        switch (cmd) {
            case "native_notify":
                Alarms.notifyOnce(activity, args.optString("title"), args.optString("body"), args.optString("sound"));
                return null;
            case "native_bring_to_front":
                return null; // Android does not let an app jump in front of another one.
            case "native_set_keep_awake":
                boolean awake = args.optBoolean("active");
                onUi(() -> activity.setKeepScreenOn(awake));
                return null;
            case "native_start_alarm":
                vibrate(true);
                return null;
            case "native_stop_alarm":
                vibrate(false);
                Alarms.silenceAll(activity); // the user dismissed the web app's alarm
                return null;
            case "native_play_sound":
                if (!"none".equals(args.optString("sound"))) playNotificationSound();
                return null;
            case "native_update_tray":
                updateCountdown(args.optString("label"), args.optLong("remainingSeconds", -1),
                        args.optBoolean("isRunning"));
                return null;
            case "native_schedule_alarms":
                Alarms.setLastStyle(activity, args.optString("style"));
                JSONArray alarms = args.optJSONArray("alarms");
                Alarms.setGroup(activity, Alarms.GROUP_SCHEDULE, alarms == null ? new JSONArray() : alarms);
                return null;
            case "native_toggle_mini_player":
                onUi(activity::enterMiniPlayer);
                return null;
            case "native_save_storage":
                writeFile(STORE_FILE, args.optString("data"));
                return null;
            case "native_load_storage":
                return readFile(STORE_FILE);
            case "native_save_secrets":
                writeFile(SECRETS_FILE, args.optString("data"));
                return null;
            case "native_load_secrets":
                return readFile(SECRETS_FILE);
            case "native_open_url":
                String url = args.optString("url");
                if (!url.startsWith("https://")) throw new IllegalArgumentException("Only https URLs can be opened");
                activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                return null;
            case "native_oauth_listen":
                return oauthListen();
            case "native_oauth_wait":
                return oauthWait(args.optLong("timeoutSecs", 300));
            case "native_read_mcp_client":
                return null; // The AI assistant's Google client lives on the computer, not on the phone.
            case "native_start_speech":
                String lang = args.optString("lang");
                onUi(() -> speech.start(lang));
                return null;
            case "native_poll_speech":
                return speech.snapshot();
            case "native_stop_speech":
                return onUiAndWait(speech::stop);
            case "android_save_file":
                activity.saveFile(args.optString("name"), args.optString("mime"),
                        android.util.Base64.decode(args.optString("base64"), android.util.Base64.DEFAULT));
                return null;
            default:
                throw new IllegalArgumentException("Unknown command " + cmd);
        }
    }

    private void onUi(Runnable task) {
        main.post(task);
    }

    private <T> T onUiAndWait(java.util.concurrent.Callable<T> task) throws Exception {
        FutureTask<T> future = new FutureTask<>(task);
        main.post(future);
        return future.get();
    }

    // Live countdown in the notification shade, plus an alarm when it ends (rings with the screen off).
    private synchronized void updateCountdown(String label, long remainingSeconds, boolean running) {
        if (!running || remainingSeconds < 0) {
            if (countdownEnd != 0) {
                countdownEnd = 0;
                Alarms.hideCountdown(activity);
                Alarms.setGroup(activity, Alarms.GROUP_COUNTDOWN, new JSONArray());
            }
            return;
        }
        long end = System.currentTimeMillis() + remainingSeconds * 1000L;
        if (label.equals(countdownLabel) && Math.abs(end - countdownEnd) < 2500) return;
        countdownLabel = label;
        countdownEnd = end;
        Alarms.showCountdown(activity, label, end);
        try {
            JSONObject alarm = new JSONObject()
                    .put("id", "end").put("at", end)
                    .put("title", activity.getString(R.string.timer_done))
                    .put("body", label);
            Alarms.setGroup(activity, Alarms.GROUP_COUNTDOWN, new JSONArray().put(alarm));
        } catch (Exception ignored) {
            // JSONObject.put only throws for NaN numbers.
        }
    }

    private void vibrate(boolean on) {
        Vibrator vibrator = activity.getSystemService(Vibrator.class);
        if (vibrator == null) return;
        vibrator.cancel();
        if (on) vibrator.vibrate(VibrationEffect.createWaveform(new long[] {0, 500, 600}, 0));
        // The web app stops the alarm; never vibrate for more than a minute if it does not.
        if (on) main.postDelayed(vibrator::cancel, 60_000);
    }

    private void playNotificationSound() {
        Ringtone tone = RingtoneManager.getRingtone(activity, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
        if (tone != null) tone.play();
    }

    // Data and keys live in the app's private folder, like the desktop app's data folder.
    private synchronized void writeFile(String name, String data) throws Exception {
        File dir = activity.getFilesDir();
        File tmp = new File(dir, name + ".tmp");
        try (OutputStream out = new FileOutputStream(tmp)) {
            out.write(data.getBytes(StandardCharsets.UTF_8));
        }
        if (!tmp.renameTo(new File(dir, name))) throw new IllegalStateException("Could not save " + name);
    }

    private String readFile(String name) throws Exception {
        File file = new File(activity.getFilesDir(), name);
        if (!file.exists()) return null;
        return new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
    }

    // Google sign-in (same flow as src-tauri/src/oauth.rs): Chrome opens Google's page and is sent back
    // to http://127.0.0.1:<port> on the phone, where this listener reads the answer.
    private synchronized int oauthListen() throws Exception {
        if (oauthSocket != null) oauthSocket.close();
        oauthSocket = new ServerSocket(0, 4, InetAddress.getByName("127.0.0.1"));
        return oauthSocket.getLocalPort();
    }

    private String oauthWait(long timeoutSecs) throws Exception {
        ServerSocket socket;
        synchronized (this) {
            socket = oauthSocket;
            oauthSocket = null;
        }
        if (socket == null) throw new IllegalStateException("Sign-in was not started");
        long deadline = System.currentTimeMillis() + Math.max(10, Math.min(600, timeoutSecs)) * 1000L;
        try {
            socket.setSoTimeout(1000);
            while (System.currentTimeMillis() < deadline) {
                try (Socket client = socket.accept()) {
                    String query = readQuery(client);
                    if (query != null) return query; // ignore stray requests (e.g. favicon)
                } catch (SocketTimeoutException ignored) {
                    // keep waiting
                }
            }
        } finally {
            socket.close();
        }
        throw new IllegalStateException("Timed out waiting for Google sign-in");
    }

    private String readQuery(Socket client) throws Exception {
        client.setSoTimeout(5000);
        InputStream in = client.getInputStream();
        byte[] buf = new byte[8192];
        int n = in.read(buf);
        if (n <= 0) return null;
        String firstLine = new String(buf, 0, n, StandardCharsets.UTF_8).split("\r?\n", 2)[0];
        String[] parts = firstLine.split(" ");
        if (parts.length < 2 || !parts[1].contains("?")) return null;
        String page = "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
                + "<title>ADHD Tools</title><body style=\"font-family:sans-serif;text-align:center;margin-top:20vh\">"
                + "<h2>" + escape(activity.getString(R.string.signin_done_title)) + "</h2>"
                + "<p><a href=\"intent://open#Intent;scheme=adhdtools;package=com.adhdtools.app;end\" "
                + "style=\"display:inline-block;padding:12px 20px;background:#6200ee;color:#fff;border-radius:8px;text-decoration:none\">"
                + escape(activity.getString(R.string.signin_back)) + "</a></p></body>";
        byte[] body = page.getBytes(StandardCharsets.UTF_8);
        OutputStream out = client.getOutputStream();
        out.write(("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + body.length
                + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(body);
        out.flush();
        return parts[1].substring(parts[1].indexOf('?') + 1);
    }

    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    void shutdown() {
        speech.destroy();
        executor.shutdownNow();
    }
}
