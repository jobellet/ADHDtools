// Translations for the sync button (Google Calendar + Drive). Keys: sync.*
// Every key must exist in en, fr, de and es (tests/i18n.test.js).
I18n.register({
  en: {
    "sync.off": "Not synced — tap to connect Google and sync",
    "sync.on": "Synced {time} — tap to sync now",
    "sync.onNoTime": "Google connected — tap to sync now",
    "sync.busy": "Syncing…",
    "sync.failed": "Sync failed: {error} — tap to try again",
  },
  fr: {
    "sync.off": "Non synchronisé — touchez pour connecter Google et synchroniser",
    "sync.on": "Synchronisé à {time} — touchez pour synchroniser",
    "sync.onNoTime": "Google connecté — touchez pour synchroniser",
    "sync.busy": "Synchronisation…",
    "sync.failed": "Échec de la synchronisation : {error} — touchez pour réessayer",
  },
  de: {
    "sync.off": "Nicht synchronisiert — tippen, um Google zu verbinden und zu synchronisieren",
    "sync.on": "Synchronisiert um {time} — tippen, um jetzt zu synchronisieren",
    "sync.onNoTime": "Google verbunden — tippen, um jetzt zu synchronisieren",
    "sync.busy": "Synchronisiere…",
    "sync.failed": "Synchronisierung fehlgeschlagen: {error} — tippen, um es erneut zu versuchen",
  },
  es: {
    "sync.off": "Sin sincronizar — toca para conectar Google y sincronizar",
    "sync.on": "Sincronizado a las {time} — toca para sincronizar ahora",
    "sync.onNoTime": "Google conectado — toca para sincronizar ahora",
    "sync.busy": "Sincronizando…",
    "sync.failed": "Error al sincronizar: {error} — toca para reintentar",
  },
});
