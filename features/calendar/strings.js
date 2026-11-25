// features/calendar/strings.js - translations for the Calendar feature (voice alerts notice)
(function () {
  const en = {
    "calendar.voiceNoticeTitle": "Voice alerts are on",
    "calendar.voiceNoticeText": "Calendar events are read aloud 5 minutes before and when they start. You can change this in Settings.",
    "calendar.voiceNoticeOff": "Turn off",
    "calendar.voiceNoticeOk": "OK"
  };
  const fr = {
    "calendar.voiceNoticeTitle": "Les alertes vocales sont activées",
    "calendar.voiceNoticeText": "Les événements du calendrier sont annoncés à voix haute 5 minutes avant et au début. Vous pouvez changer cela dans Paramètres.",
    "calendar.voiceNoticeOff": "Désactiver",
    "calendar.voiceNoticeOk": "OK"
  };
  const de = {
    "calendar.voiceNoticeTitle": "Sprachhinweise sind aktiv",
    "calendar.voiceNoticeText": "Kalendertermine werden 5 Minuten vorher und beim Start laut angesagt. Du kannst das in den Einstellungen ändern.",
    "calendar.voiceNoticeOff": "Ausschalten",
    "calendar.voiceNoticeOk": "OK"
  };
  const es = {
    "calendar.voiceNoticeTitle": "Las alertas de voz están activadas",
    "calendar.voiceNoticeText": "Los eventos del calendario se anuncian en voz alta 5 minutos antes y al empezar. Puedes cambiarlo en Ajustes.",
    "calendar.voiceNoticeOff": "Desactivar",
    "calendar.voiceNoticeOk": "OK"
  };

  if (window.I18n?.register) {
    window.I18n.register({ en, fr, de, es });
  }
})();
