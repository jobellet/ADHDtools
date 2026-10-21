package com.adhdtools.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** Woken by AlarmManager at an alarm's time (see Alarms), or by the Stop button of a ringing alarm. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Alarms.ACTION_STOP.equals(intent.getAction())) {
            context.getSystemService(NotificationManager.class)
                    .cancel(Alarms.TAG_ALARM, intent.getIntExtra("notificationId", 0));
            return;
        }
        if (!Alarms.ACTION_ALARM.equals(intent.getAction())) return;
        String group = intent.getStringExtra("group");
        if (Alarms.GROUP_COUNTDOWN.equals(group)) Alarms.hideCountdown(context);
        // App on screen: the web app rings itself (with Done / Snooze buttons), do not ring twice.
        if (MainActivity.isOnScreen()) return;
        // A task ending and the timer ending at the same moment ring once.
        long now = System.currentTimeMillis();
        if (now - Alarms.prefs(context).getLong("lastRing", 0) < 30_000) return;
        Alarms.prefs(context).edit().putLong("lastRing", now).apply();
        try {
            JSONObject alarm = new JSONObject(intent.getStringExtra("alarm"));
            String style = alarm.optString("style", Alarms.lastStyle(context));
            int id = (group + "/" + alarm.optString("id")).hashCode();
            Alarms.ring(context, id, alarm.optString("title"), alarm.optString("body"), style);
        } catch (Exception ignored) {
            // A broken alarm entry must not crash the app.
        }
    }
}
