<p align="center">
  <a href="README.md"><img src="docs/flags/gb.svg" height="20" alt="English"> English</a> ·
  <a href="README.de.md"><img src="docs/flags/de.svg" height="20" alt="Deutsch"> Deutsch</a> ·
  <a href="README.fr.md"><img src="docs/flags/fr.svg" height="20" alt="Français"> Français</a> ·
  <a href="README.es.md"><img src="docs/flags/es.svg" height="20" alt="Español"> Español</a>
</p>

# ADHD Tools Hub

Ein Tagesplaner für Menschen mit ADHS, der **immer nur eine Sache** zeigt. Er läuft im Browser oder als native App: Deine Daten bleiben auf deinem Gerät, außer *du* schaltest eine Synchronisierung ein. Offline-fähig, ohne Konto.

### 🚀 Loslegen (Wähle deine Plattform)

| 🌐 Web-App (Sofort) | 🪟 Windows Desktop | 🍎 macOS Desktop | 📱 Android Handy |
| :---: | :---: | :---: | :---: |
| [**▶ App öffnen**](https://jobellet.github.io/ADHDtools/) | [**⬇ Download (.exe)**](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools-Setup.exe) | [**⬇ Download (.dmg)**](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools.dmg) | [**⬇ Download (.apk)**](https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools.apk) |
| *Keine Installation nötig* | *System-Tray & Benachrichtigungen* | *Menüleiste & Wecker* | *Klingelt auch bei gesperrtem Bildschirm* |
| Anklicken und planen | Setup ausführen | In Programme ziehen | Antippen und installieren |

> **Alle Versionen sind 100 % kostenlos und quelloffen.** Deine Daten bleiben komplett offline auf deinem Gerät, mit optionaler privater Google Drive / Kalender Synchronisierung.

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

## 🖥️ Desktop-App (optional)

Eine native App bringt Systembenachrichtigungen, wenn ein Timer endet, einen Timer in der Menüleiste, einen Bildschirm, der bei Focus/Routine wach bleibt, einen schwebenden Mini-Player und eine Kopie deiner Daten auf der Festplatte. Alles andere funktioniert wie im Browser. Sie wird auf deinem eigenen Computer gebaut (beim ersten Mal etwa 5 Minuten).

**macOS (Apple Silicon oder Intel):**

1. Werkzeuge einmal installieren: [Node.js](https://nodejs.org), dann im Terminal:
   ```bash
   xcode-select --install
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
   . "$HOME/.cargo/env"
   ```
2. App holen und bauen:
   ```bash
   git clone https://github.com/jobellet/ADHDtools.git
   cd ADHDtools
   npm ci
   npm run desktop:install
   ```
3. **ADHD Tools** liegt jetzt im Ordner *Programme* und öffnet sich von selbst. Doppelklick im Launchpad oder Finder. Im Dock behalten: Rechtsklick auf das Dock-Symbol → *Optionen* → *Im Dock behalten*. Erlaube Benachrichtigungen, wenn macOS fragt.
4. **Spracheingabe (Mikrofon) unter macOS:** Beim ersten Klick auf das Mikrofon-Symbol fragt macOS nach Zugriff auf **Mikrofon** und **Spracherkennung**. Wenn das Mikrofon nicht reagiert, öffne **Systemeinstellungen → Datenschutz & Sicherheit** und stelle sicher, dass **ADHD Tools** sowohl unter **Mikrofon** als auch unter **Spracherkennung** aktiviert ist (nach einem Update ggf. kurz aus- und wieder einschalten). Die Sprache folgt der in der App gewählten Sprache (und die KI erkennt die gesprochene Sprache automatisch).

**Aktualisieren oder neu installieren:** Kein manuelles Deinstallieren nötig (Aufgaben und Schlüssel bleiben erhalten). Führe einfach `git pull && npm ci && npm run desktop:install` aus — das Skript beendet die laufende Version, ersetzt `/Applications/ADHD Tools.app` und startet die neue Version.

**Ausprobieren ohne Installation:** `npm run desktop` öffnet die App in einem Fenster, mit deinen lokalen Quelldateien.

Unter Windows und Linux installierst du [die Tauri-Voraussetzungen](https://tauri.app/start/prerequisites/) und startest `npm ci && npm run desktop:build`; die App liegt dann unter `src-tauri/target/release/bundle/`.

## 📱 Android-App (optional, kostenlos, ohne Play Store)

Die Android-App klingelt wie ein Wecker, wenn eine Aufgabe, Routine oder ein Termin beginnt oder endet, **auch bei ausgeschaltetem Bildschirm oder geschlossener App**. Sie zeigt den laufenden Timer in den Benachrichtigungen und bleibt bei Google angemeldet. Du erstellst sie auf deinem Computer und kopierst sie aufs Handy:

```bash
npm ci
npm run android:build
```

Die App liegt dann in `dist-android/ADHD-Tools.apk`. Einrichtung, Installation auf dem Handy und Updates: [Android-Anleitung](docs/android.md) (auf Englisch).

## 🤖 Sprich mit deinem KI-Assistenten über deinen Tag (MCP)

Bitte deinen KI-Assistenten (Mistral, Claude oder jede App mit MCP): *„Teile meine Steuererklärung in kleine Schritte“* oder *„Finde morgen eine Stunde für Sport“*. Die Änderungen erscheinen in der App. Dein eigenes Google Drive ist der Speicher: kein Server von uns, kein ngrok, kein Tailscale.

**Einrichtung (etwa 10 Minuten):**

1. Verbinde in der App Google und tippe **Mehr → Über → Sync Across Devices → Back up now**. Lass die automatische Synchronisierung an.
2. In [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients), im **selben Projekt** wie die Client ID der App: **+ Create client → Desktop app**. ID und Secret kopieren. Unter **Audience → Test users** prüfen, dass deine E-Mail dort steht. (Die App zu veröffentlichen ist freiwillig: siehe Anleitung.)
3. Auf deinem Computer (Node 18+): `git clone https://github.com/jobellet/ADHDtools.git`, dann in diesem Ordner:
   `npm run mcp:auth -- --client-id "DESKTOP_CLIENT_ID" --client-secret "CLIENT_SECRET"`
4. Trage den Server in den MCP-Einstellungen deiner KI-App ein: Befehl `node`, Argument `/voller/pfad/zu/ADHDtools/mcp/server.js`.
   Für Le Chat im Web starte `node mcp/server.js http` bei einem kleinen Hoster (siehe Anleitung).
   Dann `git pull` und `npm run mcp:check` ausführen: prüft alles und nennt für jedes Problem die Lösung.
5. Frag: *„Gib mir einen Überblick über meinen Tag.“* Lass die App offen: Sie übernimmt die Änderungen in etwa 2 Minuten.

**Bei einem Schritt hängen geblieben?** Jeder Schritt der Anleitung verlinkt die Lösung für die angezeigte Meldung: [**Fixing problems**](docs/mcp-troubleshooting.md) (zum Beispiel [„Publish app“ ist ausgegraut](docs/mcp-troubleshooting.md#publish-greyed-out)).

Vollständige Anleitung (Englisch), Einrichtung von Mistral Vibe und Le Chat, Fehlerhilfe: [**docs/mcp.md**](docs/mcp.md).

## 📚 Anleitungen

Die ausführlichen Anleitungen sind auf Englisch:

| Anleitung | Inhalt |
| --- | --- |
| [**Anleitung (User guide)**](docs/using-the-app.md) | Jetzt, Plan, Neu, Routinen, Einstellungen. Hier anfangen. |
| [**Google Kalender**](docs/google-calendar-sync.md) | Private OAuth-Synchronisierung (empfohlen, kein öffentlicher Link), `.ics`-Import oder öffentlicher ICS-Link. |
| [**Daten zwischen Geräten**](docs/sync-across-devices.md) | Sicherung über Google Drive, Export/Import als Datei, E-Mail, mit sicherem Zusammenführen. |
| [**KI (optional)**](docs/ai-providers.md) | Eigener Anbieter: OpenAI, Gemini, Claude, Mistral, Groq, OpenRouter oder ein lokales Modell. Alles funktioniert auch ohne KI. |
| [**KI-Assistent über MCP**](docs/mcp.md) | Mistral, Claude oder eine andere MCP-App liest deinen Tag, fügt Aufgaben hinzu und teilt sie auf, über dein Google Drive. |
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
