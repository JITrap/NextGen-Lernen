# NextGen Lernen

Ein Schulplaner, der alles an einem Ort bündelt: **Klassenarbeiten und Termine**,
**Noten mit eigener Gewichtung von schriftlich und mündlich**, Hausaufgaben,
Stundenplan, hochgeladene Materialien, Karteikarten, Lernzeit – und einen
**KI-Assistenten, der einen Screenshot deiner Aufgaben liest, sie löst und den Weg erklärt**.

Die App läuft komplett im Browser. Kein Build, keine Datenbank, kein Konto.

---

## Sofort starten

**Variante 1 – Doppelklick**
`index.html` im Browser öffnen. Funktioniert, hat aber eine Einschränkung: Dateiuploads
werden von den meisten Browsern unter `file://` nicht dauerhaft gespeichert.

**Variante 2 – lokaler Server (empfohlen)**

```bash
npm start              # öffnet http://localhost:4321
```

Ohne Node genügt auch:

```bash
python3 -m http.server 4321
```

**Variante 3 – im Netz**
Der Ordner ist eine rein statische Seite und lässt sich unverändert auf GitHub Pages,
Netlify, Vercel o. Ä. hochladen.

---

## Was drin ist

| Bereich | Was es kann |
|---|---|
| **Übersicht** | Gesamtschnitt, Countdown zur nächsten Arbeit, was heute ansteht, fällige Aufgaben und Karteikarten |
| **Termine** | Monatskalender und Liste, Klassenarbeiten, Tests, Referate; KI erstellt auf Wunsch einen Lernplan |
| **Aufgaben** | Hausaufgaben mit Fälligkeit, Priorität und Fach, Schnelleingabe, Fortschritt |
| **Stundenplan** | Wochenraster Mo–Fr, Uhrzeiten automatisch berechnet, „heute“ hervorgehoben |
| **Fächer** | Farbe, Lehrkraft, Raum, **Gewichtung schriftlich/mündlich**, Wertigkeit im Gesamtschnitt, Zielnote |
| **Noten** | Gewichteter Schnitt je Fach, Notenrechner „Was brauche ich noch?“, Verteilung, Gesamttabelle |
| **KI-Assistent** | Aufgaben-Screenshots lösen, Themen erklären, zusammenfassen, Karteikarten und Übungsaufgaben erzeugen, eigene Lösung prüfen |
| **Materialien** | Bilder und PDFs hochladen, nach Fach sortieren, direkt von der KI auswerten lassen |
| **Karteikarten** | Stapel je Fach, Leitner-System mit fünf Fächern, Lernmodus mit Umdrehen |
| **Lernzeit** | Pomodoro-Timer, Wochenstatistik, Minuten je Fach, Serie |
| **Einstellungen** | Notensystem 1–6 oder 0–15 Punkte, Design, KI-Zugang, Sicherung exportieren/einspielen |

### Noten richtig gewichten

Je Fach lässt sich einstellen, wie stark schriftliche und mündliche Leistungen zählen
(z. B. 60 / 40). Zusätzlich hat jede einzelne Note ein eigenes Gewicht
(halb, einfach, doppelt, dreifach) – eine Klassenarbeit zählt also mehr als ein Test.

Gerechnet wird:

```
Schnitt je Kategorie = Σ(Note × Gewicht) / Σ(Gewicht)
Fachschnitt          = (schriftlich × A% + mündlich × B%) / (A% + B%)
Gesamtschnitt        = Mittel der Fachschnitte, gewichtet mit der Wertigkeit des Fachs
```

Hat ein Fach nur Noten in einer Kategorie, zählt diese zu 100 %.

---

## KI einrichten

Es gibt zwei Wege – einer davon ganz ohne Schlüssel.

### A) Als Claude-Artifact (kein Schlüssel nötig)

Wird die Seite als veröffentlichtes Claude-Artifact geöffnet, nutzt sie die
`sample`-Fähigkeit der Artifact-Laufzeit: Die Anfragen laufen über das Claude-Konto
der Person, die die Seite ansieht. Es ist nichts einzurichten.

```bash
npm run build:artifact   # erzeugt dist/artifact.html für die Veröffentlichung
```

### B) Mit eigenem API-Schlüssel

In **Einstellungen → KI-Assistent** einen Anthropic-API-Schlüssel eintragen
(<https://console.anthropic.com>). Der Schlüssel wird nur im `localStorage` dieses
Browsers gespeichert und direkt an `api.anthropic.com` gesendet.

> **Hinweis:** Ein Schlüssel im Browser ist für jeden lesbar, der Zugriff auf das Gerät
> hat. Für den gemeinsamen Einsatz besser Variante A nutzen oder einen eigenen kleinen
> Server als Proxy eintragen (Feld „Eigener Server“), damit der Schlüssel dort bleibt.

Ein Proxy muss lediglich den JSON-Rumpf unverändert an
`https://api.anthropic.com/v1/messages` weiterreichen, den Header `x-api-key` ergänzen
und die Antwort (Server-Sent Events) durchreichen.

---

## Deine Daten

* Alles liegt in `localStorage`, hochgeladene Dateien in `IndexedDB` – **auf deinem Gerät**.
* Nichts wird an einen Server gesendet, außer du stellst eine KI-Anfrage
  (dann gehen dein Text und die ausgewählten Bilder an Anthropic).
* **Sicherung:** Einstellungen → „Sicherung erstellen“ lädt alles als JSON-Datei.
  Das Einspielen geht im selben Bereich – so wechselst du auch das Gerät.
* Läuft die Seite als Artifact, kann zusätzlich eine Cloud-Sicherung aktiviert werden.

---

## Prüfen und Testen

```bash
npm test          # startet Chromium und klickt die ganze App durch
npm test -- --headed
```

Der Lauf prüft jede Ansicht auf JavaScript-Fehler, rechnet die gewichteten
Durchschnitte gegen, legt testweise Einträge an, lädt neu (Persistenz),
und kontrolliert Desktop- und Handy-Layout auf waagerechten Überlauf.
Bildschirmfotos landen in `tests/screenshots/`.

---

## Aufbau

```
index.html              Gerüst, lädt alle Bausteine in fester Reihenfolge
css/
  tokens.css            Farben, Abstände, hell/dunkel
  base.css              Grundlayout, Navigation, Druck
  components.css        Karten, Knöpfe, Tabellen, Kalender, Karteikarte …
js/core/
  util.js               DOM-Helfer, Datum, Markdown, Icons
  store.js              Zustand, Speichern, Ereignisse
  grades.js             Notenlogik und Prognosen
  files.js              Uploads (IndexedDB bzw. Artifact-Speicher)
  ai.js                 KI-Anbindung (Artifact / API-Schlüssel / Proxy)
  ui.js                 Dialoge, Formulare, Bausteine
  sync.js               optionale Cloud-Sicherung
js/views/               je eine Datei pro Ansicht
js/app.js               Router, Navigation, Start
tools/                  Server, Tests, Artifact-Build
```

Jede Datei ist ein klassisches `<script>` und trägt sich in `window.NG` ein –
absichtlich ohne Bundler, damit die App überall ohne Vorbereitung läuft.

Eine neue Ansicht braucht nur:

```js
NG.app.register({
  id: "meins", title: "Meins", icon: "star", group: "learn", order: 12,
  render: function (root, ctx) { /* … */ }
});
```

…und einen `<script>`-Eintrag in `index.html`.

---

## Lizenz

MIT
