<p align="center">
  <a href="README.md"><img src="docs/flags/gb.svg" height="20" alt="English"> English</a> ·
  <a href="README.de.md"><img src="docs/flags/de.svg" height="20" alt="Deutsch"> Deutsch</a> ·
  <a href="README.fr.md"><img src="docs/flags/fr.svg" height="20" alt="Français"> Français</a> ·
  <a href="README.es.md"><img src="docs/flags/es.svg" height="20" alt="Español"> Español</a>
</p>

# ADHD Tools Hub

[**▶ Ouvrir l’application**](https://jobellet.github.io/ADHDtools/)

Un planning de journée pour les personnes avec un TDAH, qui montre **une seule chose à la fois**. Il fonctionne dans le navigateur : vos données restent sur votre appareil, sauf si *vous* activez une synchronisation. Il marche sur téléphone et ordinateur, hors ligne, sans compte.

## L’idée : le moins de charge mentale possible

À chaque instant, vous faites une seule de ces trois choses :

1. **Faire** la tâche affichée. L’application s’ouvre sur la vue **Maintenant** : la tâche, l’étape de routine ou l’événement en cours, avec un grand compte à rebours et 2 ou 3 boutons (*Fait*, *Focus*, *Pas maintenant*).
2. **Faire une pause** et voir ce qui arrive ensuite. Pendant un court creux, la vue *Maintenant* affiche un compte à rebours jusqu’au prochain élément.
3. **Planifier à l’avance.** Quand rien n’est prévu, l’application ouvre le **planning de la journée**. Vous y placez les tâches et découpez les grosses tâches avec échéance en petites étapes.

Les routines (matin, soir, ou celles que vous créez) **réservent leur temps** dans la journée, avec une marge (+10 % par défaut). Rien d’autre ne peut être prévu en même temps : une tâche ajoutée sur un créneau occupé passe au prochain créneau libre, et l’application vous dit pourquoi.

➡️ **Nouveau ? Lisez le [guide d’utilisation](docs/using-the-app.md)** (en anglais).

## Exemple rapide

Ajouter une tâche marche hors ligne, sans IA :

```text
Saisie :   Call mom tomorrow at 5pm for 20 min !7
Résultat : Call mom — demain à 17:00 · 20 min · importance 7 · heure fixe
```

Si 17:00 est déjà pris (par exemple par votre routine du soir), la tâche passe au prochain créneau libre. Remarque : sans IA, l’analyse du texte ne comprend que les phrases en anglais. Avec un [fournisseur d’IA](docs/ai-providers.md), vous pouvez aussi écrire en français.

## 🧰 Fonctionnalités

**L’essentiel**

*   **Vue « Maintenant » (par défaut) :** la tâche, l’étape de routine ou l’événement en cours avec un compte à rebours, et la suite.
*   **Planning de la journée :** toute la journée sur une ligne de temps : routines, tâches à heure fixe, tâches placées par l’application, événements du calendrier. Le panneau *À planifier* liste les échéances et les grosses tâches à découper, et supprime les tâches en retard une par une ou toutes d’un coup (avec Annuler).
*   **Routines :** des étapes minutées, une à la fois. Chaque routine réserve son temps (étapes + marge) ; deux routines qui se chevauchent ne peuvent pas être enregistrées.
*   **Ajout rapide (Ajouter) :** écrivez ou dictez une tâche avec vos mots. Marche hors ligne ; mieux avec l’[IA](docs/ai-providers.md) si elle est configurée.
*   **Planificateur unique :** un seul plan pour les tâches, routines et événements, trié par importance × urgence, sans double réservation.

**Autres outils**

*   **Découpage de tâches :** couper une grosse tâche en petites étapes (à la main ou avec l’IA).
*   **Mode focus** et **minuteur Pomodoro :** minuteurs plein écran pour le travail concentré.
*   **Calendrier :** synchronisation privée avec [Google Agenda](docs/google-calendar-sync.md), ou import d’un fichier / lien `.ics`.
*   **Suivi d’habitudes** et **récompenses :** séries, points pour les tâches finies, récompenses choisies par vous.
*   **Plusieurs utilisateurs** sur un appareil et **4 langues** (English, Deutsch, Français, Español).

**S’adapte à votre configuration**

L’application ne montre que les options que vous utilisez. Par exemple, l’import `.ics` est masqué dès que Google Agenda est connecté, et les boutons IA sont masqués sans fournisseur d’IA. *Paramètres → General → Afficher toutes les options* réaffiche tout.

## 🤖 Parlez à votre planning avec votre assistant IA (MCP)

Demandez à votre assistant IA (Mistral, Claude, ou toute application compatible MCP) de *« découper ma déclaration d’impôts en petites étapes »* ou *« trouver une heure pour le sport demain »*. Les changements apparaissent dans l’application. Votre propre Google Drive sert de stockage : pas de serveur à nous, pas de ngrok, pas de Tailscale.

**Installation (environ 10 minutes) :**

1. Dans l’application, connectez Google et touchez **Plus → À propos → Sync Across Devices → Back up now**. Laissez la synchronisation automatique activée.
2. Dans [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients), dans le **même projet** que le Client ID de l’application : **+ Create client → Desktop app**. Copiez l’ID et le secret. Dans **Audience → Test users**, vérifiez que votre e-mail y est. (Publier l’application est facultatif : voir le guide.)
3. Sur votre ordinateur (Node 18+) : `git clone https://github.com/jobellet/ADHDtools.git`, puis dans ce dossier :
   `npm run mcp:auth -- --client-id "DESKTOP_CLIENT_ID" --client-secret "CLIENT_SECRET"`
4. Ajoutez le serveur dans les réglages MCP de votre application IA : commande `node`, argument `/chemin/complet/ADHDtools/mcp/server.js`.
   Pour Le Chat sur le web, lancez `node mcp/server.js http` sur un petit hébergeur (voir le guide).
   Puis lancez `git pull` et `npm run mcp:check` : il teste tout et donne la solution de chaque problème.
5. Demandez : *« Donne-moi un aperçu de ma journée. »* Laissez l’application ouverte : elle applique les changements en 2 minutes environ.

**Bloqué à une étape ?** Chaque étape du guide renvoie vers la solution du message affiché : [**Fixing problems**](docs/mcp-troubleshooting.md) (par exemple [« Publish app » est grisé](docs/mcp-troubleshooting.md#publish-greyed-out)).

Guide complet (en anglais), configuration de Mistral Vibe et de Le Chat, dépannage : [**docs/mcp.md**](docs/mcp.md).

## 📚 Guides

Les guides détaillés sont en anglais :

| Guide | Contenu |
| --- | --- |
| [**Guide d’utilisation (User guide)**](docs/using-the-app.md) | Maintenant, Planning, Ajouter, routines, paramètres. Commencez ici. |
| [**Google Agenda**](docs/google-calendar-sync.md) | Synchronisation privée OAuth (recommandée, sans lien public), import `.ics` ou lien ICS public. |
| [**Données sur plusieurs appareils**](docs/sync-across-devices.md) | Sauvegarde Google Drive, export/import de fichier, e-mail, avec fusion sans conflit. |
| [**IA (optionnelle)**](docs/ai-providers.md) | Votre propre fournisseur : OpenAI, Gemini, Claude, Mistral, Groq, OpenRouter ou un modèle local. Tout marche aussi sans IA. |
| [**Assistant IA via MCP**](docs/mcp.md) | Mistral, Claude ou une autre application MCP lit votre journée, ajoute et découpe des tâches, via votre Google Drive. |
| [**Modèle de données & planificateur**](docs/task-model.md) | L’objet Task, TaskStore, la réservation des routines, la construction de la journée. |
| [**Vision & état**](docs/vision-roadmap.md) | La direction du projet et ce qui marche déjà. |
| [**Cas de test**](docs/testing.md) | Scénarios pour vérifier l’application après des changements. |
| [**Contribuer**](docs/contributing.md) · [**AGENTS.md**](AGENTS.md) | Lancer l’application en local, lancer les tests, proposer des changements. `AGENTS.md` est le guide pour les agents IA de code (et les humains) : carte du code, vocabulaire commun, règles. |

## 🔒 Confidentialité

Toutes les données sont stockées dans votre navigateur. Rien n’est envoyé à un serveur, sauf si vous activez une intégration : la synchronisation Google va directement de votre navigateur à Google, et les requêtes d’IA vont directement au fournisseur choisi. Il n’y a pas de serveur intermédiaire.

## 💬 Retours

Suggestions et signalements de bugs bienvenus : ouvrez une issue.

## Licence

Licence MIT. Voir le fichier [LICENSE](LICENSE).
