// Translations for the AI assistant inbox (changes made through the MCP server). Keys: assistant.*
// Every key must exist in en, fr, de and es (tests/i18n.test.js).
I18n.register({
  en: {
    "assistant.applied": "Your assistant made {n} change(s).",
    "assistant.failed": "{n} change(s) from your assistant could not be applied.",
  },
  fr: {
    "assistant.applied": "Votre assistant a fait {n} modification(s).",
    "assistant.failed": "{n} modification(s) de votre assistant n’ont pas pu être appliquées.",
  },
  de: {
    "assistant.applied": "Dein Assistent hat {n} Änderung(en) vorgenommen.",
    "assistant.failed": "{n} Änderung(en) deines Assistenten konnten nicht übernommen werden.",
  },
  es: {
    "assistant.applied": "Tu asistente hizo {n} cambio(s).",
    "assistant.failed": "No se pudieron aplicar {n} cambio(s) de tu asistente.",
  },
});
