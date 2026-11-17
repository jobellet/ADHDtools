import Foundation
import Security

/// Native-side storage for the web app: the exported data file in UserDefaults, and the secrets
/// (API keys, Google tokens) in the Keychain, so they never leave the device (and never reach
/// iCloud backup — the Keychain item has no kSecAttrSynchronizable).
final class Storage {
    private static let storeKey = "adhd-local-store"
    private static let service = "com.adhdtools.secrets"
    private static let account = "adhd-secrets"

    static func saveStore(_ json: String) {
        UserDefaults.standard.set(json, forKey: storeKey)
    }

    static func loadStore() -> String? {
        UserDefaults.standard.string(forKey: storeKey)
    }

    static func saveSecrets(_ json: String) {
        guard let data = json.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        SecItemAdd(add as CFDictionary, nil)
    }

    static func loadSecrets() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
