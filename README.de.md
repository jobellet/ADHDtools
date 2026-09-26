<p align="center">
  <a href="README.md"><img src="docs/flags/gb.svg" height="20" alt="English"> English</a> ·
  <a href="README.de.md"><img src="docs/flags/de.svg" height="20" alt="Deutsch"> Deutsch</a> ·
  <a href="README.fr.md"><img src="docs/flags/fr.svg" height="20" alt="Français"> Français</a> ·
  <a href="README.es.md"><img src="docs/flags/es.svg" height="20" alt="Español"> Español</a>
</p>

# ADHD Tools Hub

[**▶ App öffnen**](https://jobellet.github.io/ADHDtools/)

Ein Tagesplaner für Menschen mit ADHS, der **immer nur eine Sache** zeigt. Er läuft im Browser: Deine Daten bleiben auf deinem Gerät, außer *du* schaltest eine Synchronisierung ein. Er funktioniert auf Handy und Computer, offline und ohne Konto.

## Die Idee: so wenig wie möglich nachdenken müssen

Zu jedem Zeitpunkt machst du nur eines von drei Dingen:

1. **Tun**, was auf dem Bildschirm steht. Die App öffnet sich in der Ansicht **Jetzt**: die aktuelle Aufgabe, der aktuelle Routine-Schritt oder Termin, mit einem großen Countdown und 2–3 Knöpfen (*Erledigt*, *Fokus*, *Nicht jetzt*).
2. **Pause machen** und sehen, was als Nächstes kommt. In einer kurzen Lücke zeigt die Ansicht *Jetzt* einen Countdown bis zum nächsten Punkt.
3. **Vorausplanen.** Wenn gerade nichts geplant ist, öffnet die App den **Tagesplaner**. Dort verteilst du Aufgaben und teilst große Aufgaben mit Frist in kleine Schritte.

Routinen (morgens, abends oder eigene) **reservieren ihre Zeit** im Tag, mit einem Puffer (standardmäßig +10 %). Zur selben Zeit kann nichts anderes geplant werden: Eine Aufgabe, die du zu einer belegten Zeit hinzufügst, rutscht in die nächste freie Lücke, und die App sagt dir, warum.

➡️ **Neu hier? Lies die [Anleitung](docs/using-the-app.md)** (auf Englisch).

## Kurzes Beispiel

Eine Aufgabe hinzufügen funktioniert offline, ohne KI:

```text
Eingabe:  Call mom tomorrow at 5pm for 20 min !7
Ergebnis: Call mom — morgen um 17:00 · 20 Min · Wichtigkeit 7 · feste Uhrzeit
```

Ist 17:00 schon belegt (zum Beispiel durch deine Abendroutine), rutscht die Aufgabe in die nächste freie Lücke. Hinweis: Ohne KI versteht die Texterkennung nur englische Sätze. Mit einem [KI-Anbieter](docs/ai-providers.md) kannst du auch auf Deutsch schreiben.

## 🧰 Funktionen

**Kern**

*   **Ansicht „Jetzt“ (Standard):** die aktuelle Aufgabe, der Routine-Schritt oder Termin mit Countdown, und was danach kommt.
*   **Tagesplaner:** der ganze Tag auf einer Zeitleiste: Routinen, feste Aufgaben, von der App platzierte Aufgaben, Kalendertermine. Der Bereich *Vorausplanen* listet Fristen und große Aufgaben zum Aufteilen und löscht überfällige Aufgaben einzeln oder alle auf einmal (mit Rückgängig).
*   **Routinen:** Schritte mit Zeit, einer nach dem anderen. Jede Routine reserviert ihre Zeit (Schritte + Puffer); überlappende Routinen lassen sich nicht speichern.
*   **Schnell erfassen (Neu):** eine Aufgabe in normalen Worten tippen oder sprechen. Funktioniert offline; besser mit [KI](docs/ai-providers.md), wenn eingerichtet.
*   **Gemeinsamer Planer:** ein Plan für Aufgaben, Routinen und Kalendertermine, sortiert nach Wichtigkeit × Dringlichkeit, ohne Doppelbuchung.

**Weitere Werkzeuge**

*   **Aufgaben aufteilen:** eine große Aufgabe in kleine Schritte zerlegen (von Hand oder mit KI).
*   **Fokus-Modus** und **Pomodoro-Timer:** Vollbild-Timer für konzentriertes Arbeiten.
*   **Kalender:** private Synchronisierung mit [Google Kalender](docs/google-calendar-sync.md) oder Import einer `.ics`-Datei / eines Links.
*   **Gewohnheiten** und **Belohnungen:** Serien, Punkte für erledigte Aufgaben, selbst gewählte Belohnungen.
*   **Mehrere Nutzer** auf einem Gerät und **4 Sprachen** (English, Deutsch, Français, Español).

**Passt sich deiner Einrichtung an**

Die App zeigt nur die Optionen, die du nutzt. Zum Beispiel wird der `.ics`-Import ausgeblendet, sobald Google Kalender verbunden ist, und KI-Knöpfe sind ohne KI-Anbieter ausgeblendet. *Einstellungen → General → Alle Optionen zeigen* zeigt wieder alles.

## 📚 Anleitungen

Die ausführlichen Anleitungen sind auf Englisch:

| Anleitung | Inhalt |
| --- | --- |
| [**Anleitung (User guide)**](docs/using-the-app.md) | Jetzt, Plan, Neu, Routinen, Einstellungen. Hier anfangen. |
| [**Google Kalender**](docs/google-calendar-sync.md) | Private OAuth-Synchronisierung (empfohlen, kein öffentlicher Link), `.ics`-Import oder öffentlicher ICS-Link. |
| [**Daten zwischen Geräten**](docs/sync-across-devices.md) | Sicherung über Google Drive, Export/Import als Datei, E-Mail, mit sicherem Zusammenführen. |
| [**KI (optional)**](docs/ai-providers.md) | Eigener Anbieter: OpenAI, Gemini, Claude, Mistral, Groq, OpenRouter oder ein lokales Modell. Alles funktioniert auch ohne KI. |
| [**Datenmodell & Planer**](docs/task-model.md) | Das Task-Objekt, TaskStore, Routine-Reservierung, wie der Planer den Tag baut. |
| [**Vision & Stand**](docs/vision-roadmap.md) | Wohin das Projekt geht und was schon funktioniert. |
| [**Testfälle**](docs/testing.md) | Szenarien, um die App nach Änderungen zu prüfen. |
| [**Mitmachen**](docs/contributing.md) · [**AGENTS.md**](AGENTS.md) | App lokal starten, Tests ausführen, Änderungen einreichen. `AGENTS.md` ist die Anleitung für KI-Coding-Agenten (und Menschen): Code-Karte, gemeinsame Begriffe, Regeln. |

## 🔒 Datenschutz

Alle Daten werden in deinem Browser gespeichert. Nichts wird an einen Server gesendet, außer du schaltest eine Integration ein: Die Google-Synchronisierung geht direkt von deinem Browser zu Google, KI-Anfragen gehen direkt an den gewählten Anbieter. Es gibt keinen Zwischenserver.

## 💬 Feedback

Vorschläge und Fehlermeldungen sind willkommen: Bitte eröffne ein Issue.

## Lizenz

MIT-Lizenz. Siehe die Datei [LICENSE](LICENSE).
