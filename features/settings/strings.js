// Translations for Settings added by the new UI (General / Calendar sections).
// Keys: settings.*. Every key must exist in en, fr, de and es (tests/i18n.test.js).
// Use in JS: I18n.t('key', { name: value }); in HTML: data-i18n="key".
I18n.register({
  en: {
    "settings.routineBuffer": "Routine buffer (% added to booked time)",
    "settings.taskBuffer": "Pause between tasks (minutes)",
    "settings.breakWindow": "Show the “next task” countdown when it starts within (minutes)",
    "settings.autoStart": "Start the routine player by itself when a routine’s time begins",
    "settings.showAll": "Show all options (also the ones your setup does not need)",
    "settings.calBlock": "Calendar events block time in the plan",
    "settings.icsImport": "Calendar file / link import (.ics)",
  },
  fr: {
    "settings.routineBuffer": "Marge des routines (% ajouté au temps réservé)",
    "settings.taskBuffer": "Pause entre deux tâches (minutes)",
    "settings.breakWindow": "Afficher le compte à rebours de la tâche suivante quand elle commence dans (minutes)",
    "settings.autoStart": "Démarrer la routine toute seule quand son heure arrive",
    "settings.showAll": "Afficher toutes les options (même celles dont votre configuration n’a pas besoin)",
    "settings.calBlock": "Les événements de l’agenda bloquent du temps dans le planning",
    "settings.icsImport": "Import de fichier / lien d’agenda (.ics)",
  },
  de: {
    "settings.routineBuffer": "Routine-Puffer (% zur reservierten Zeit)",
    "settings.taskBuffer": "Pause zwischen Aufgaben (Minuten)",
    "settings.breakWindow": "Countdown zur nächsten Aufgabe zeigen, wenn sie beginnt in (Minuten)",
    "settings.autoStart": "Routine automatisch starten, wenn ihre Zeit beginnt",
    "settings.showAll": "Alle Optionen zeigen (auch die, die deine Einrichtung nicht braucht)",
    "settings.calBlock": "Kalendertermine blockieren Zeit im Plan",
    "settings.icsImport": "Kalender-Datei / Link importieren (.ics)",
  },
  es: {
    "settings.routineBuffer": "Margen de las rutinas (% añadido al tiempo reservado)",
    "settings.taskBuffer": "Pausa entre tareas (minutos)",
    "settings.breakWindow": "Mostrar la cuenta atrás de la siguiente tarea cuando empieza en (minutos)",
    "settings.autoStart": "Empezar la rutina sola cuando llega su hora",
    "settings.showAll": "Mostrar todas las opciones (también las que tu configuración no necesita)",
    "settings.calBlock": "Los eventos del calendario bloquean tiempo en el plan",
    "settings.icsImport": "Importar archivo / enlace de calendario (.ics)",
  },
});
