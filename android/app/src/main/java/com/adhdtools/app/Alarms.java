package com.adhdtools.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Alarms that ring on time even when the screen is off or the app is closed.
 * The web app sends the times (native_schedule_alarms, native_update_tray); Android's AlarmManager
 * wakes AlarmReceiver, which shows the notification. Alarms are kept in SharedPreferences so
 * BootReceiver can set them again after a restart.
 */
final class Alarms {
    static final String CHANNEL_ALARM = "alarms";
    static final String CHANNEL_REMINDER = "reminders";
    static final String CHANNEL_QUIET = "quiet";
    static final String CHANNEL_TIMER = "timer";

    static final String GROUP_SCHEDULE = "schedule";
    static final String GROUP_COUNTDOWN = "countdown";

    static final String ACTION_ALARM = "com.adhdtools.app.ALARM";
    static final String ACTION_STOP = "com.adhdtools.app.STOP_ALARM";
    static final String EXTRA_FROM_ALARM = "fromAlarm";

    static final String TAG_ALARM = "alarm";
    static final int ID_TIMER = 1;

    private static final String PREFS = "alarms";
    private static final long MAX_AHEAD_MS = 36L * 3600 * 1000;

    private Alarms() {}

    static void createChannels(Context context) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        AudioAttributes alarmAudio = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

        NotificationChannel alarm = new NotificationChannel(CHANNEL_ALARM,
                context.getString(R.string.channel_alarms), NotificationManager.IMPORTANCE_HIGH);
        alarm.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), alarmAudio);
        alarm.enableVibration(true);
        alarm.setVibrationPattern(new long[] {0, 600, 400, 600, 400, 600});
        alarm.setBypassDnd(true);
        alarm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        NotificationChannel reminder = new NotificationChannel(CHANNEL_REMINDER,
                context.getString(R.string.channel_reminders), NotificationManager.IMPORTANCE_HIGH);

        NotificationChannel quiet = new NotificationChannel(CHANNEL_QUIET,
                context.getString(R.string.channel_quiet), NotificationManager.IMPORTANCE_LOW);

        NotificationChannel timer = new NotificationChannel(CHANNEL_TIMER,
                context.getString(R.string.channel_timer), NotificationManager.IMPORTANCE_LOW);
        timer.setShowBadge(false);

        nm.createNotificationChannel(alarm);
        nm.createNotificationChannel(reminder);
        nm.createNotificationChannel(quiet);
        nm.createNotificationChannel(timer);
    }

    /** notificationStyle from the app settings: intrusive (alarm), standard (one sound), subtle (silent). */
    static String channelFor(String style) {
        if ("subtle".equals(style)) return CHANNEL_QUIET;
        if ("standard".equals(style)) return CHANNEL_REMINDER;
        return CHANNEL_ALARM;
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String lastStyle(Context context) {
        return prefs(context).getString("style", "intrusive");
    }

    static void setLastStyle(Context context, String style) {
        if (style != null && !style.isEmpty()) prefs(context).edit().putString("style", style).apply();
    }

    /** Replace every alarm of one group (e.g. today's schedule) with a new list of {id, at, title, body, style}. */
    static synchronized void setGroup(Context context, String group, JSONArray alarms) {
        JSONArray old = readGroup(context, group);
        for (int i = 0; i < old.length(); i++) {
            JSONObject alarm = old.optJSONObject(i);
            if (alarm != null) cancelSystemAlarm(context, group, alarm.optString("id"));
        }
        JSONArray kept = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject alarm = alarms.optJSONObject(i);
            if (alarm == null) continue;
            long at = alarm.optLong("at");
            if (at <= now || at > now + MAX_AHEAD_MS) continue;
            kept.put(alarm);
            setSystemAlarm(context, group, alarm);
        }
        prefs(context).edit().putString("group:" + group, kept.toString()).apply();
    }

    static JSONArray readGroup(Context context, String group) {
        try {
            return new JSONArray(prefs(context).getString("group:" + group, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /** After a restart or an app update: AlarmManager forgot everything, set the saved alarms again. */
    static void restoreAll(Context context) {
        setGroup(context, GROUP_SCHEDULE, readGroup(context, GROUP_SCHEDULE));
        setGroup(context, GROUP_COUNTDOWN, readGroup(context, GROUP_COUNTDOWN));
    }

    private static Intent alarmIntent(Context context, String group, String id) {
        return new Intent(context, AlarmReceiver.class)
                .setAction(ACTION_ALARM)
                .setData(Uri.parse("adhdtools://alarm/" + Uri.encode(group) + "/" + Uri.encode(id)));
    }

    private static void setSystemAlarm(Context context, String group, JSONObject alarm) {
        Intent intent = alarmIntent(context, group, alarm.optString("id"))
                .putExtra("group", group)
                .putExtra("alarm", alarm.toString());
        PendingIntent operation = PendingIntent.getBroadcast(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = context.getSystemService(AlarmManager.class);
        long at = alarm.optLong("at");
        boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
        if (exact) {
            // Alarm-clock alarms are exact and wake the phone from deep sleep (Doze).
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, openAppIntent(context, false)), operation);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, operation);
        }
    }

    private static void cancelSystemAlarm(Context context, String group, String id) {
        PendingIntent operation = PendingIntent.getBroadcast(context, 0, alarmIntent(context, group, id),
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (operation == null) return;
        context.getSystemService(AlarmManager.class).cancel(operation);
        operation.cancel();
    }

    static PendingIntent openAppIntent(Context context, boolean fromAlarm) {
        Intent open = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(EXTRA_FROM_ALARM, fromAlarm);
        return PendingIntent.getActivity(context, fromAlarm ? 1 : 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Ringing alarm: sound repeats until the user opens the app or taps Stop (5 minutes at most). */
    static void ring(Context context, int notificationId, String title, String body, String style) {
        String channel = channelFor(style);
        Notification.Builder builder = new Notification.Builder(context, channel)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle(title)
                .setContentText(body)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(openAppIntent(context, false));
        if (CHANNEL_ALARM.equals(channel)) {
            Intent stop = new Intent(context, AlarmReceiver.class).setAction(ACTION_STOP)
                    .putExtra("notificationId", notificationId);
            builder.addAction(new Notification.Action.Builder(null, context.getString(R.string.alarm_stop),
                    PendingIntent.getBroadcast(context, notificationId, stop,
                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)).build());
            builder.setFullScreenIntent(openAppIntent(context, true), true);
            builder.setTimeoutAfter(5 * 60 * 1000L);
        }
        Notification notification = builder.build();
        if (CHANNEL_ALARM.equals(channel)) notification.flags |= Notification.FLAG_INSISTENT;
        context.getSystemService(NotificationManager.class).notify(TAG_ALARM, notificationId, notification);
    }

    /** One-off notification from the web app (native_notify). Plays its sound once. */
    static void notifyOnce(Context context, String title, String body, String sound) {
        String channel = "none".equals(sound) ? CHANNEL_QUIET : CHANNEL_REMINDER;
        Notification notification = new Notification.Builder(context, channel)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(openAppIntent(context, false))
                .build();
        context.getSystemService(NotificationManager.class)
                .notify("notify", (int) (System.currentTimeMillis() & 0x7fffffff), notification);
    }

    /** Stops every ringing alarm: the user is looking at the app, the web app's own alarm takes over. */
    static void silenceAll(Context context) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        for (android.service.notification.StatusBarNotification sbn : nm.getActiveNotifications()) {
            if (TAG_ALARM.equals(sbn.getTag())) nm.cancel(sbn.getTag(), sbn.getId());
        }
    }

    /** Running countdown (routine step, focus timer) in the notification shade, with its end alarm. */
    static void showCountdown(Context context, String label, long endAt) {
        Notification notification = new Notification.Builder(context, CHANNEL_TIMER)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle(label.isEmpty() ? context.getString(R.string.app_name) : label)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setWhen(endAt)
                .setShowWhen(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_STOPWATCH)
                .setContentIntent(openAppIntent(context, false))
                .build();
        context.getSystemService(NotificationManager.class).notify(ID_TIMER, notification);
    }

    static void hideCountdown(Context context) {
        context.getSystemService(NotificationManager.class).cancel(ID_TIMER);
    }
}
