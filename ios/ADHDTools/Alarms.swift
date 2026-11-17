import AVFoundation
import UserNotifications

/// Alarms that ring on time even when the screen is off or the app is closed: the web app sends
/// the times (native_schedule_alarms), and local notifications fire them. iOS keeps pending local
/// notifications across app restarts, and Alarms.restoreScheduled() re-registers them on launch.
/// While the app is on screen, the web app shows its own alarm modal and native_start_alarm
/// loops the sound here instead.
final class Alarms {
    static let storeKey = "scheduledAlarms"
    static let maxAheadSeconds: TimeInterval = 36 * 3600
    static let maxPending = 50
    static let intrusiveRepeats = 4 // extra rings 30s apart until the app is opened

    private static var loopPlayer: AVAudioPlayer?
    private static var oncePlayer: AVAudioPlayer?

    private static var center: UNUserNotificationCenter { UNUserNotificationCenter.current() }

    // MARK: Immediate notification (native_notify)

    static func notifyNow(title: String, body: String, sound: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.userInfo = ["kind": "immediate", "soundOn": sound != "none"]
        if sound == "alarm" {
            content.sound = UNNotificationSound(named: UNNotificationSoundName("alarm.aiff"))
        } else if sound == "bell" {
            content.sound = UNNotificationSound(named: UNNotificationSoundName("bell.aiff"))
        }
        center.add(UNNotificationRequest(identifier: "now-\(UUID().uuidString)", content: content, trigger: nil))
    }

    // MARK: Scheduled alarms (native_schedule_alarms): [{ id, at: ms, title, body }]

    static func schedule(alarms: Any?, style: String) {
        center.removePendingNotificationRequests(withIdentifiers: pendingIds())
        let now = Date()
        let list = (alarms as? [[String: Any]]) ?? []
        let parsed = list.compactMap { item -> (id: String, at: Date, title: String, body: String)? in
            guard let id = item["id"] as? String, let at = item["at"] as? Double else { return nil }
            return (id, Date(timeIntervalSince1970: at / 1000),
                    item["title"] as? String ?? "", item["body"] as? String ?? "")
        }
        .filter { $0.at > now && $0.at.timeIntervalSince(now) < maxAheadSeconds }
        .sorted { $0.at < $1.at }

        var ids: [String] = []
        var stored: [[String: Any]] = []
        for alarm in parsed.prefix(maxPending) {
            let content = UNMutableNotificationContent()
            content.title = alarm.title
            content.body = alarm.body
            content.userInfo = ["kind": "scheduled", "soundOn": style != "subtle"]
            if style == "subtle" {
                content.sound = nil
            } else if style == "standard" {
                content.sound = UNNotificationSound(named: UNNotificationSoundName("bell.aiff"))
            } else {
                content.sound = UNNotificationSound(named: UNNotificationSoundName("alarm.aiff"))
                content.interruptionLevel = .timeSensitive
            }
            let delay = max(1, alarm.at.timeIntervalSince(now))
            let baseId = "sched-\(alarm.id)"
            center.add(UNNotificationRequest(identifier: baseId, content: content,
                                             trigger: UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)))
            ids.append(baseId)
            let isIntrusive = style != "standard" && style != "subtle"
            if isIntrusive {
                for rep in 1...intrusiveRepeats {
                    let repeatId = "\(baseId)-r\(rep)"
                    center.add(UNNotificationRequest(identifier: repeatId, content: content,
                        trigger: UNTimeIntervalNotificationTrigger(timeInterval: delay + Double(30 * rep), repeats: false)))
                    ids.append(repeatId)
                }
            }
            stored.append(["id": alarm.id, "at": alarm.at.timeIntervalSince1970 * 1000,
                           "title": alarm.title, "body": alarm.body])
        }
        UserDefaults.standard.set(["style": style, "alarms": stored, "ids": ids], forKey: storeKey)
    }

    static func restoreScheduled() {
        guard let dict = UserDefaults.standard.dictionary(forKey: storeKey),
              let alarms = dict["alarms"], let style = dict["style"] as? String else { return }
        schedule(alarms: alarms, style: style)
    }

    private static func pendingIds() -> [String] {
        (UserDefaults.standard.dictionary(forKey: storeKey)?["ids"] as? [String]) ?? []
    }

    /// Called when the app comes to the front or a notification is tapped: the web app takes over.
    static func stopRinging() {
        center.removePendingNotificationRequests(withIdentifiers: pendingIds())
        center.removeDeliveredNotifications(withIdentifiers: pendingIds())
        stopLoop()
    }

    // MARK: In-app ringing (native_start_alarm / native_stop_alarm / native_play_sound)

    static func startRinging() {
        stopLoop()
        guard let url = Bundle.main.url(forResource: "alarm", withExtension: "aiff") else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        guard let player = try? AVAudioPlayer(contentsOf: url) else { return }
        player.numberOfLoops = -1
        player.play()
        loopPlayer = player
    }

    static func stopLoop() {
        loopPlayer?.stop()
        loopPlayer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    static func playOnce(sound: String) {
        guard sound != "none" else { return }
        let name = sound == "alarm" ? "alarm" : "bell"
        guard let url = Bundle.main.url(forResource: name, withExtension: "aiff") else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        oncePlayer = try? AVAudioPlayer(contentsOf: url)
        oncePlayer?.play()
    }
}
