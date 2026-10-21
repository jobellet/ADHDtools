package com.adhdtools.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import org.json.JSONObject;

import java.util.ArrayList;

/**
 * Voice input for native_start_speech / native_poll_speech / native_stop_speech, with the same
 * answers as the desktop app ({status: listening|done|error, transcript, error}).
 * Android WebView has no Web Speech API, so the Android recognizer is used instead.
 */
final class SpeechSession implements RecognitionListener {
    static final int REQUEST_MIC = 41;

    private final MainActivity activity;
    private SpeechRecognizer recognizer;
    private String pendingLang = "en-US";
    private String status = "done";
    private String transcript = "";
    private String error = "";

    SpeechSession(MainActivity activity) {
        this.activity = activity;
    }

    /** Called on the UI thread. */
    void start(String lang) {
        destroy();
        set("listening", "", "");
        pendingLang = lang == null || lang.isEmpty() ? "en-US" : lang;
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(new String[] {Manifest.permission.RECORD_AUDIO}, REQUEST_MIC);
            return;
        }
        begin();
    }

    /** Called on the UI thread with the answer to the microphone permission request. */
    void onPermissionResult(boolean granted) {
        if (granted) begin();
        else set("error", "", "mic-denied");
    }

    private void begin() {
        if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
            set("error", "", "unsupported");
            return;
        }
        recognizer = SpeechRecognizer.createSpeechRecognizer(activity);
        recognizer.setRecognitionListener(this);
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, pendingLang)
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        recognizer.startListening(intent);
    }

    synchronized JSONObject snapshot() {
        JSONObject out = new JSONObject();
        try {
            out.put("status", status).put("transcript", transcript).put("error", error);
        } catch (Exception ignored) {
            // JSONObject.put only throws for NaN numbers.
        }
        return out;
    }

    /** Called on the UI thread: keep what was heard so far and stop listening. */
    JSONObject stop() {
        synchronized (this) {
            if ("listening".equals(status)) status = "done";
        }
        destroy();
        return snapshot();
    }

    void destroy() {
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
    }

    private synchronized void set(String status, String transcript, String error) {
        this.status = status;
        this.transcript = transcript;
        this.error = error;
    }

    private synchronized void setTranscript(Bundle results) {
        ArrayList<String> heard = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (heard != null && !heard.isEmpty() && heard.get(0) != null && !heard.get(0).isEmpty()) {
            transcript = heard.get(0);
        }
    }

    @Override public void onPartialResults(Bundle partialResults) { setTranscript(partialResults); }

    @Override
    public void onResults(Bundle results) {
        setTranscript(results);
        synchronized (this) {
            status = "done";
        }
        destroy();
    }

    @Override
    public void onError(int code) {
        if (code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
            synchronized (this) {
                status = "done";
            }
        } else if (code == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
            set("error", "", "mic-denied");
        } else {
            set("error", "", "speech-" + code);
        }
        destroy();
    }

    @Override public void onReadyForSpeech(Bundle params) {}
    @Override public void onBeginningOfSpeech() {}
    @Override public void onRmsChanged(float rmsdB) {}
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() {}
    @Override public void onEvent(int eventType, Bundle params) {}
}
