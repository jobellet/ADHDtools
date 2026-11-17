import SwiftUI
import UIKit
import UserNotifications

@main
struct ADHDToolsApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            WebView()
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        Alarms.restoreScheduled()
        return true
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Google sign-in redirect that used the custom scheme instead of the loopback listener.
        OAuth.shared.handleCallback(url)
        return true
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // The web app rings its own alarm while it is on screen; stop the native ringing.
        Alarms.stopRinging()
    }
}

final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        let userInfo = notification.request.content.userInfo
        let kind = userInfo["kind"] as? String ?? "scheduled"
        if kind == "scheduled", UIApplication.shared.applicationState == .active {
            completionHandler([]) // the web app shows its own alarm modal while it is on screen
            return
        }
        var options: UNNotificationPresentationOptions = [.badge, .banner]
        if (userInfo["soundOn"] as? Bool) ?? true {
            options.insert(.sound)
        }
        completionHandler(options)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        Alarms.stopRinging()
        completionHandler()
    }
}
