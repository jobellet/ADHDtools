# Guide : Activer l'IA Locale (LFM3) dans ADHDtools / Local AI Setup Guide

Ce guide explique comment installer et utiliser un modèle d'IA local (**LFM3-1.7B**) avec ADHDtools.

---

## Pourquoi une IA Locale pour ADHDtools ? / Why Local AI?

* 🔒 **Confidentialité absolue** : Vos pensées, vos notes quotidiennes et votre agenda ne quittent jamais votre ordinateur (aucun appel vers les serveurs d'OpenAI, Google ou Anthropic).
* 💸 **100% gratuit et sans clé d'API** : Aucun compte ni carte bancaire requis.
* ⚡ **Ultra-léger & Rapide** : Le modèle LFM3-1.7B quantifié pèse environ **1,05 Go** et ne consomme que **~1 Go de RAM**. Il tourne rapidement sur n'importe quel processeur (CPU) moderne sans nécessiter de carte graphique dédiée.
* 📴 **100% Hors-ligne** : Fonctionne même sans connexion Internet.

---

## Option 1 : Installation automatique en 1 ligne (Recommandé) / Automated 1-liner

### Sur Windows (PowerShell) :

Ouvrez **PowerShell** et collez la commande suivante :

```powershell
irm https://raw.githubusercontent.com/jobellet/ADHDtools/main/scripts/setup-local-ai.ps1 | iex
```

*(Ou depuis la racine du dépôt local : `powershell -ExecutionPolicy Bypass -File scripts/setup-local-ai.ps1`)*

### Sur macOS ou Linux (Terminal) :

Ouvrez un **Terminal** et collez la commande suivante :

```bash
curl -fsSL https://raw.githubusercontent.com/jobellet/ADHDtools/main/scripts/setup-local-ai.sh | bash
```

*(Ou depuis la racine du dépôt local : `bash scripts/setup-local-ai.sh`)*

Le script télécharge automatiquement :
1. Le runtime léger `llama.cpp` (~20 Mo).
2. Le modèle officiel quantifié `LiquidAI/LFM3-1.7B-QAD-Q4_0.gguf` (1,05 Go).

---

## Option 2 : Via Ollama / With Ollama

Si vous préférez utiliser [Ollama](https://ollama.com) :

```bash
ollama run lfm3
```

---

## Option 3 : Installation manuelle étape par étape / Manual step-by-step

1. Téléchargez la dernière version de `llama.cpp` pour votre système depuis GitHub Releases :
   [https://github.com/ggerganov/llama.cpp/releases](https://github.com/ggerganov/llama.cpp/releases) (fichier `llama-...-bin-...-x64.zip` ou `.tar.gz`).
2. Décompressez l'archive dans :
   * **Windows** : `%LOCALAPPDATA%\llama-cpp\` (ex. `C:\Users\VotreNom\AppData\Local\llama-cpp\`)
   * **macOS / Linux** : `~/.local/share/llama-cpp/`
3. Téléchargez le fichier de modèle LFM3 GGUF officiel (1,05 Go) :
   [Télécharger LFM3-1.7B-QAD-Q4_0.gguf sur Hugging Face](https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF/resolve/main/LFM3-1.7B-QAD-Q4_0.gguf)
   et placez-le dans le même dossier.

---

## Utilisation dans l'application Bureau ADHDtools / Using in Desktop App

Dès que les fichiers sont présents sur votre machine :

1. **Bouton automatique dans l'en-tête** :
   Un bouton **"IA locale"** (`Local AI`) apparaît automatiquement en haut à droite de l'application bureau (à côté de Quick Thoughts et de l'horloge).
   * 🟢 **Point vert** : Le serveur d'IA locale est actif et prêt.
   * ⚫ **Point gris** : Le serveur est éteint.
   * **Cliquez sur le bouton** pour démarrer ou éteindre le serveur en 1 clic sans ouvrir de console.

2. **Configuration dans les Paramètres** :
   Dans ADHDtools > **Paramètres** (`Settings`) > section **Assistant IA** :
   * Une carte **IA locale** s'affiche avec le statut en temps réel et un bouton *"Utiliser comme fournisseur IA actif"*.
   * Ou configurez manuellement :
     * **Fournisseur** : `Custom / Local (OpenAI-compatible: Ollama, LM Studio…)`
     * **URL de base** : `http://localhost:11434/v1`
     * **Modèle** : `lfm3`
     * **Clé API** : *(laisser vide)*
   * Cliquez sur **Tester la connexion** : le modèle répond `OK` instantanément.

Toutes les fonctionnalités intelligentes d'ADHDtools (parsing de tâches en langage naturel, transcription et restructuration vocale de Quick Thoughts, création de routines et décomposition de tâches) fonctionnent alors en local complet.
