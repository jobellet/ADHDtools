// Strings for the static page (data-i18n keys in index.html). Feature strings
// live next to each feature in features/<name>/strings.js.
const translations = {
  en: {
    'routine-player-tab': 'Play',
    'routine-manage-tab': 'Routines',
    'routine-manage-heading-2': 'Your Routines',
    'routine-new-btn': 'New',
    'routine-auto-run-setting': 'Enable auto-run by default',
    'routine-run-other': 'Run another routine',
    'routine-sheet-hint': 'Move the current task anywhere in the queue. Drag, or use the arrows.',
    'routine-sheet-cancel': 'Cancel',
    'routine-sheet-save': 'Save Order',
    'routine-edit-sheet-title': 'Edit Routine',
    'routine-name-label-2': 'Routine Name',
    'routine-start-time-label-2': 'Start Time',
    'routine-weekdays-label': 'Days',
    'routine-tasks-label': 'Tasks',
    'routine-delete-btn': 'Delete',
    'routine-save-btn': 'Save',
    'routine-picker-title': 'Run Routine',
    'nav-home': 'Home',
    'tab-now': 'Now', 'tab-plan': 'Plan', 'tab-add': 'Add', 'tab-routines': 'Routines', 'tab-more': 'More', 'more-heading': 'More tools', 'capture-heading': 'Add a task', 'add-btn-label': 'Add', 'see-full-day': 'See the full day', 'lock-plan-btn': 'Lock plan',
    'nav-pomodoro': 'Pomodoro Timer',
    'nav-planner': 'Day Planner',
    'nav-calendar': 'Calendar',
    'nav-tasks': 'Task Manager',
    'nav-breakdown': 'Task Breakdown',
    'nav-habits': 'Habit Tracker',
    'nav-routine': 'Routine Tool',
    'nav-family': 'Family Routine',
    'nav-focus': 'Focus Mode',
    'nav-rewards': 'Rewards',
    'nav-settings': 'Settings',
    'nav-about': 'About',
        'user-label': 'User:',
    'add-event-btn': 'Add Event',
    'clear-all-btn': 'Clear All',
    'generate-schedule-btn': 'Generate schedule for today',
    'ai-plan-btn': 'AI Plan',
    'record-btn': 'Record',
    'next-up-heading': 'NEXT UP',
    'start-btn': 'Start',
    'reset-btn': 'Reset',
    'settings-heading': 'Settings',
    'pause-btn': 'Pause',
    'event-duration-label': 'Duration (minutes):',
    'pomodoro-heading': 'Pomodoro Timer',
    'pomodoro-text': 'The Pomodoro Technique helps you work with time, instead of against it. Break your workday into 25-minute chunks separated by five-minute breaks.',
    'calendar-heading': 'Calendar',
    'calendar-voice-label': 'Voice alerts',
    'calendar-voice-early-label': 'Minutes early:',
    'calendar-announcement-now': 'Event "{title}" is starting now.',
    'calendar-announcement-soon': 'Event "{title}" starts in {minutes} minutes.',
    'breakdown-heading': 'Task Breakdown',
    'breakdown-text': 'Break complex tasks into smaller, manageable steps. This helps reduce overwhelm and makes progress more visible.',
    'habits-heading': 'Habit Tracker',
    'habits-text': 'Build consistency with daily habit tracking and streaks. Visualize your progress and stay motivated.',
    'focus-heading': 'Focus Mode',
    'focus-text': 'Minimize distractions with a clean, focused interface. Create a distraction-free environment for deep work.',
    'rewards-heading': 'Rewards',
    'rewards-text': 'Celebrate your accomplishments with visual rewards. Positive reinforcement helps build motivation and consistency.',
    'settings-heading': 'Settings',
    'settings-text': 'Centralize key parameters for calendars, tasks, and future experiments.',
    'about-heading': 'About ADHD Tools Hub',
    'about-text': 'ADHD Tools Hub is a collection of interactive tools designed to help individuals with ADHD manage their symptoms, improve productivity, and enhance focus.',
    'about-privacy-heading': 'Privacy',
    'about-privacy-text': 'All data is stored locally in your browser. Nothing is sent to any server, ensuring your information remains private.',
    'about-feedback-heading': 'Feedback',
    'about-feedback-text': "We're constantly working to improve these tools. If you have suggestions or feedback, please let us know!",
    'routine-heading': 'Routine Tool',
    'routine-text': 'Create, manage, and run daily routines with timed tasks.',
    'routine-active-heading': 'Active Routine',
    'routine-instruction': 'Tap the screen or press SPACEBAR to mark the current task as done.',
    'footer-text': '&copy; 2025 ADHD Tools Hub. All tools are free to use and data is stored locally in your browser.'
  },
  fr: {
    'routine-player-tab': 'Lecture',
    'routine-manage-tab': 'Routines',
    'routine-manage-heading-2': 'Vos routines',
    'routine-new-btn': 'Nouvelle',
    'routine-auto-run-setting': 'Activer le mode automatique par défaut',
    'routine-run-other': 'Lancer une autre routine',
    'routine-sheet-hint': 'Déplacez la tâche en cours où vous voulez dans la file. Glissez ou utilisez les flèches.',
    'routine-sheet-cancel': 'Annuler',
    'routine-sheet-save': 'Enregistrer l’ordre',
    'routine-edit-sheet-title': 'Modifier la routine',
    'routine-name-label-2': 'Nom de la routine',
    'routine-start-time-label-2': 'Heure de début',
    'routine-weekdays-label': 'Jours',
    'routine-tasks-label': 'Tâches',
    'routine-delete-btn': 'Supprimer',
    'routine-save-btn': 'Enregistrer',
    'routine-picker-title': 'Lancer une routine',
    'nav-home': 'Accueil',
    'tab-now': 'Maintenant', 'tab-plan': 'Planning', 'tab-add': 'Ajouter', 'tab-routines': 'Routines', 'tab-more': 'Plus', 'more-heading': 'Autres outils', 'capture-heading': 'Ajouter une tâche', 'add-btn-label': 'Ajouter', 'see-full-day': 'Voir toute la journée', 'lock-plan-btn': 'Figer le planning',
    'nav-pomodoro': 'Minuteur Pomodoro',
    'nav-planner': 'Planificateur',
    'nav-calendar': 'Calendrier',
    'nav-tasks': 'Gestionnaire de tâches',
    'nav-breakdown': 'Décomposition des tâches',
    'nav-habits': 'Suivi des habitudes',
    'nav-routine': 'Routine',
    'nav-family': 'Routine familiale',
    'nav-focus': 'Mode Focus',
    'nav-rewards': 'Récompenses',
    'nav-settings': 'Paramètres',
    'nav-about': 'À propos',
        'user-label': 'Utilisateur :',
    'add-event-btn': 'Ajouter événement',
    'clear-all-btn': 'Tout effacer',
    'generate-schedule-btn': 'Générer le programme du jour',
    'ai-plan-btn': 'Plan IA',
    'record-btn': 'Enregistrer',
    'next-up-heading': 'À SUIVRE',
    'start-btn': 'Démarrer',
    'reset-btn': 'Réinitialiser',
    'settings-heading': 'Paramètres',
    'pause-btn': 'Pause',
    'event-duration-label': 'Durée (minutes) :',
    'pomodoro-heading': 'Minuteur Pomodoro',
    'pomodoro-text': "La technique Pomodoro vous aide à travailler avec le temps plutôt que contre lui. Divisez votre journée de travail en sessions de 25 minutes séparées par des pauses de cinq minutes.",
    'calendar-heading': 'Calendrier',
    'calendar-voice-label': 'Alertes vocales',
    'calendar-voice-early-label': 'Minutes avant :',
    'calendar-announcement-now': "L'événement \"{title}\" commence maintenant.",
    'calendar-announcement-soon': "L'événement \"{title}\" commence dans {minutes} minutes.",
    'breakdown-heading': 'Décomposition des tâches',
    'breakdown-text': 'Découpez les tâches complexes en étapes plus petites pour réduire la surcharge et voir les progrès.',
    'habits-heading': 'Suivi des habitudes',
    'habits-text': 'Développez votre constance grâce au suivi quotidien et visualisez vos progrès.',
    'focus-heading': 'Mode Focus',
    'focus-text': 'Minimisez les distractions grâce à une interface épurée propice au travail concentré.',
    'rewards-heading': 'Récompenses',
    'rewards-text': 'Célébrez vos réussites avec des récompenses visuelles pour renforcer la motivation.',
    'settings-heading': 'Paramètres',
    'settings-text': 'Centralisez les principaux paramètres pour les calendriers, les tâches et les futures expériences.',
    'about-heading': "À propos du Centre d'outils TDAH",
    'about-text': "Le Centre d'outils TDAH est une collection d'outils interactifs pour aider à gérer les symptômes du TDAH, améliorer la productivité et renforcer la concentration.",
    'about-privacy-heading': 'Confidentialité',
    'about-privacy-text': 'Toutes les données sont stockées localement dans votre navigateur. Rien n\'est envoyé à un serveur.',
    'about-feedback-heading': 'Retour',
    'about-feedback-text': "Nous travaillons constamment à l'amélioration de ces outils. Si vous avez des suggestions, faites-le nous savoir !",
    'routine-heading': 'Routine',
    'routine-text': 'Créez, gérez et exécutez des routines quotidiennes avec des tâches minutées.',
    'routine-active-heading': 'Routine active',
    'routine-instruction': 'Touchez l\'écran ou appuyez sur ESPACE pour marquer la tâche comme terminée.',
    'footer-text': '&copy; 2025 Centre d\'outils TDAH. Tous les outils sont gratuits et les données sont stockées localement dans votre navigateur.'
  },
  de: {
    'routine-player-tab': 'Abspielen',
    'routine-manage-tab': 'Routinen',
    'routine-manage-heading-2': 'Ihre Routinen',
    'routine-new-btn': 'Neu',
    'routine-auto-run-setting': 'Auto-Ausführen standardmäßig aktivieren',
    'routine-run-other': 'Andere Routine starten',
    'routine-sheet-hint': 'Verschieben Sie die aktuelle Aufgabe in der Warteschlange. Ziehen oder die Pfeile verwenden.',
    'routine-sheet-cancel': 'Abbrechen',
    'routine-sheet-save': 'Reihenfolge speichern',
    'routine-edit-sheet-title': 'Routine bearbeiten',
    'routine-name-label-2': 'Routinenname',
    'routine-start-time-label-2': 'Startzeit',
    'routine-weekdays-label': 'Tage',
    'routine-tasks-label': 'Aufgaben',
    'routine-delete-btn': 'Löschen',
    'routine-save-btn': 'Speichern',
    'routine-picker-title': 'Routine starten',
    'nav-home': 'Startseite',
    'tab-now': 'Jetzt', 'tab-plan': 'Plan', 'tab-add': 'Neu', 'tab-routines': 'Routinen', 'tab-more': 'Mehr', 'more-heading': 'Weitere Tools', 'capture-heading': 'Aufgabe hinzufügen', 'add-btn-label': 'Hinzufügen', 'see-full-day': 'Ganzen Tag ansehen', 'lock-plan-btn': 'Plan festlegen',
    'nav-pomodoro': 'Pomodoro-Timer',
    'nav-planner': 'Tagesplaner',
    'nav-calendar': 'Kalender',
    'nav-tasks': 'Aufgabenmanager',
    'nav-breakdown': 'Aufgaben zerlegen',
    'nav-habits': 'Gewohnheiten',
    'nav-routine': 'Routine',
    'nav-family': 'Familienroutine',
    'nav-focus': 'Fokusmodus',
    'nav-rewards': 'Belohnungen',
    'nav-settings': 'Einstellungen',
    'nav-about': 'Über',
        'user-label': 'Benutzer:',
    'add-event-btn': 'Ereignis hinzufügen',
    'clear-all-btn': 'Alles löschen',
    'generate-schedule-btn': 'Zeitplan für heute generieren',
    'ai-plan-btn': 'KI-Plan',
    'record-btn': 'Aufnehmen',
    'next-up-heading': 'ALS NÄCHSTES',
    'start-btn': 'Start',
    'reset-btn': 'Zurücksetzen',
    'settings-heading': 'Einstellungen',
    'pause-btn': 'Pause',
    'event-duration-label': 'Dauer (Minuten):',
    'pomodoro-heading': 'Pomodoro-Timer',
    'pomodoro-text': 'Die Pomodoro-Technik hilft dir, mit der Zeit zu arbeiten. Teile den Arbeitstag in 25-Minuten-Abschnitte mit fünfminütigen Pausen.',
    'calendar-heading': 'Kalender',
    'calendar-voice-label': 'Sprachbenachrichtigungen',
    'calendar-voice-early-label': 'Minuten vorher:',
    'calendar-announcement-now': 'Termin "{title}" beginnt jetzt.',
    'calendar-announcement-soon': 'Termin "{title}" beginnt in {minutes} Minuten.',
    'breakdown-heading': 'Aufgaben zerlegen',
    'breakdown-text': 'Zerlege komplexe Aufgaben in kleinere Schritte, um Überforderung zu vermeiden und Fortschritte sichtbar zu machen.',
    'habits-heading': 'Gewohnheiten',
    'habits-text': 'Baue Regelmäßigkeit mit täglichem Tracking auf und behalte deinen Fortschritt im Blick.',
    'focus-heading': 'Fokusmodus',
    'focus-text': 'Minimiere Ablenkungen mit einer schlanken Oberfläche für konzentriertes Arbeiten.',
    'rewards-heading': 'Belohnungen',
    'rewards-text': 'Feiere deine Erfolge mit visuellen Belohnungen und erhöhe deine Motivation.',
    'settings-heading': 'Einstellungen',
    'settings-text': 'Zentrale Stelle für wichtige Parameter für Kalender, Aufgaben und zukünftige Experimente.',
    'about-heading': 'Über den ADHS Werkzeugkasten',
    'about-text': 'Der ADHS Werkzeugkasten ist eine Sammlung interaktiver Tools, die Menschen mit ADHS bei Produktivität und Fokus unterstützen.',
    'about-privacy-heading': 'Datenschutz',
    'about-privacy-text': 'Alle Daten werden lokal im Browser gespeichert und nicht an einen Server gesendet.',
    'about-feedback-heading': 'Feedback',
    'about-feedback-text': 'Wir arbeiten ständig an Verbesserungen. Wenn du Vorschläge hast, lass es uns wissen!',
    'routine-heading': 'Routine',
    'routine-text': 'Erstelle und verwalte tägliche Routinen mit zeitgesteuerten Aufgaben.',
    'routine-active-heading': 'Aktive Routine',
    'routine-instruction': 'Tippe oder drücke die Leertaste, um die Aufgabe zu beenden.',
    'footer-text': '&copy; 2025 ADHS Werkzeugkasten. Alle Daten werden lokal gespeichert.'
  },
  es: {
    'routine-player-tab': 'Reproducir',
    'routine-manage-tab': 'Rutinas',
    'routine-manage-heading-2': 'Tus rutinas',
    'routine-new-btn': 'Nueva',
    'routine-auto-run-setting': 'Activar la ejecución automática por defecto',
    'routine-run-other': 'Ejecutar otra rutina',
    'routine-sheet-hint': 'Mueve la tarea actual a cualquier posición de la cola. Arrastra o usa las flechas.',
    'routine-sheet-cancel': 'Cancelar',
    'routine-sheet-save': 'Guardar orden',
    'routine-edit-sheet-title': 'Editar rutina',
    'routine-name-label-2': 'Nombre de la rutina',
    'routine-start-time-label-2': 'Hora de inicio',
    'routine-weekdays-label': 'Días',
    'routine-tasks-label': 'Tareas',
    'routine-delete-btn': 'Eliminar',
    'routine-save-btn': 'Guardar',
    'routine-picker-title': 'Ejecutar rutina',
    'nav-home': 'Inicio',
    'tab-now': 'Ahora', 'tab-plan': 'Plan', 'tab-add': 'Añadir', 'tab-routines': 'Rutinas', 'tab-more': 'Más', 'more-heading': 'Más herramientas', 'capture-heading': 'Añadir una tarea', 'add-btn-label': 'Añadir', 'see-full-day': 'Ver todo el día', 'lock-plan-btn': 'Fijar el plan',
    'nav-pomodoro': 'Temporizador Pomodoro',
    'nav-planner': 'Planificador',
    'nav-calendar': 'Calendario',
    'nav-tasks': 'Gestor de tareas',
    'nav-breakdown': 'Desglose de tareas',
    'nav-habits': 'Seguimiento de hábitos',
    'nav-routine': 'Rutinas',
    'nav-family': 'Rutina familiar',
    'nav-focus': 'Modo Focus',
    'nav-rewards': 'Recompensas',
    'nav-settings': 'Ajustes',
    'nav-about': 'Acerca de',
        'user-label': 'Usuario:',
    'add-event-btn': 'Añadir evento',
    'clear-all-btn': 'Borrar todo',
    'generate-schedule-btn': 'Generar horario de hoy',
    'ai-plan-btn': 'Plan IA',
    'record-btn': 'Grabar',
    'next-up-heading': 'SIGUIENTE',
    'start-btn': 'Iniciar',
    'reset-btn': 'Reiniciar',
    'settings-heading': 'Ajustes',
    'pause-btn': 'Pausa',
    'event-duration-label': 'Duración (minutos):',
    'pomodoro-heading': 'Temporizador Pomodoro',
    'pomodoro-text': 'La técnica Pomodoro te ayuda a trabajar con el tiempo. Divide tu jornada en bloques de 25 minutos con descansos de cinco minutos.',
    'calendar-heading': 'Calendario',
    'calendar-voice-label': 'Alertas de voz',
    'calendar-voice-early-label': 'Minutos antes:',
    'calendar-announcement-now': 'El evento "{title}" comienza ahora.',
    'calendar-announcement-soon': 'El evento "{title}" comienza en {minutes} minutos.',
    'breakdown-heading': 'Desglose de tareas',
    'breakdown-text': 'Divide tareas complejas en pasos pequeños para reducir la sobrecarga y ver el progreso.',
    'habits-heading': 'Seguimiento de hábitos',
    'habits-text': 'Construye constancia con un seguimiento diario y visualiza tu progreso.',
    'focus-heading': 'Modo Focus',
    'focus-text': 'Minimiza las distracciones con una interfaz limpia para un trabajo profundo.',
    'rewards-heading': 'Recompensas',
    'rewards-text': 'Celebra tus logros con recompensas visuales para motivarte.',
    'settings-heading': 'Ajustes',
    'settings-text': 'Centraliza parámetros clave para calendarios, tareas y futuros experimentos.',
    'about-heading': 'Acerca de Herramientas TDAH',
    'about-text': 'Herramientas TDAH es una colección de recursos interactivos que ayudan a gestionar síntomas y mejorar la productividad.',
    'about-privacy-heading': 'Privacidad',
    'about-privacy-text': 'Todos los datos se almacenan localmente en tu navegador. Nada se envía a ningún servidor.',
    'about-feedback-heading': 'Comentarios',
    'about-feedback-text': 'Trabajamos continuamente para mejorar estas herramientas. ¡Envíanos tus sugerencias!',
    'routine-heading': 'Rutinas',
    'routine-text': 'Crea y ejecuta rutinas diarias con tareas cronometradas.',
    'routine-active-heading': 'Rutina activa',
    'routine-instruction': 'Toca la pantalla o presiona ESPACIO para marcar la tarea como completada.',
    'footer-text': '&copy; 2025 Herramientas TDAH. Todas las herramientas son gratuitas y los datos se almacenan en tu navegador.'
  }
};



function getLang() {
  try {
    const saved = localStorage.getItem('adhd-lang');
    return translations[saved] ? saved : 'en';
  } catch {
    return 'en';
  }
}

// t('plan.deleted', { n: 3 }) -> text in the current language, English as fallback.
function t(key, vars = {}, fallback = key) {
  const text = translations[getLang()]?.[key] ?? translations.en[key] ?? fallback;
  return String(text).replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
}

// Set the page language early, so dates rendered before DOMContentLoaded
// handlers finish already use it.
if (typeof document !== 'undefined') document.documentElement.lang = getLang();
// Features add their own strings (features/<name>/strings.js) with
// I18n.register({ en: {...}, fr: {...}, de: {...}, es: {...} }).
function register(dict) {
  Object.entries(dict || {}).forEach(([lang, strings]) => {
    translations[lang] = Object.assign(translations[lang] || {}, strings);
  });
}

if (typeof window !== 'undefined') window.I18n = { t, getLang, register };

// expose translations for other modules
if (typeof window !== 'undefined') {
  window.translations = translations;
}

function applyTranslations(lang) {
  const dict = translations[lang] || translations.en;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const txt = dict[key];
    if (txt) {
      el.innerHTML = txt;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'), {}, el.placeholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'), {}, el.title);
  });
  // Text built by JavaScript (Now view, planner…) re-renders on this event.
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

document.addEventListener('DOMContentLoaded', () => {
  const flagsContainer = document.getElementById('language-flags');
  if (!flagsContainer) return;
  const saved = localStorage.getItem('adhd-lang') || 'en';

  const updateActiveFlag = (lang) => {
    document.querySelectorAll('.lang-flag').forEach(btn => {
      if (btn.dataset.lang === lang) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  };

  updateActiveFlag(saved);
  applyTranslations(saved);

  document.querySelectorAll('.lang-flag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const lang = e.currentTarget.dataset.lang;
      localStorage.setItem('adhd-lang', lang);
      applyTranslations(lang);
      updateActiveFlag(lang);
    });
  });
});
