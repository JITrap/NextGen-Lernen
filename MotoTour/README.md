# MotoTour – kostenlose Motorrad-Navigation für iOS

MotoTour ist eine komplett **kostenlose** Motorrad-Navigations-App (SwiftUI, iOS 17+):
keine Abos, keine Käufe, keine Konten, keine Werbung. Alle genutzten Dienste sind gratis
und benötigen **keinen API-Key**.

> Hinweis: MotoTour ist eine eigenständige App, die den Funktionsumfang bekannter
> Motorrad-Navis (kurvige Routen, Tour-Aufzeichnung, Sperrungs-News) nachbildet.
> Name, Logo und Design geschützter Apps werden bewusst nicht kopiert.

## Funktionen

- **Routenplanung** mit drei Profilen: *Schnell*, *Kurvig*, *Super-kurvig*
  (Kurven-Routing über Umweg-Kandidaten, bewertet nach Richtungsänderung pro Kilometer)
- **Sperrungen & Baustellen aus drei Quellen** – alle kostenlos, kein API-Key:
  1. **Landstraßen (B-, L-, K-Straßen)**: OpenStreetMap Overpass-API – Baustellen und
     gesperrte Abschnitte im 60-km-Umkreis bzw. entlang der geplanten Route
  2. **Autobahnen**: offizielle API der Autobahn GmbH des Bundes
  3. **Eigene Meldungen**: Stelle auf der Karte antippen („Sperrung melden“) – wird
     gespeichert und bei jeder Planung automatisch umfahren. Perfekt, wenn ihr in der
     Gruppe wisst, dass eine Lieblingsstrecke gerade dicht ist.
  Zusätzlich kennt Apples Routing selbst viele offizielle Sperrungen und meidet sie
  von Haus aus – die drei Quellen ergänzen Warnungen und Umfahrung für den Rest.
- **Automatische Routenanpassung**: Vollsperrungen werden bei der Planung umfahren;
  während der Navigation werden alle Quellen alle 3 Minuten neu geprüft und die Route
  bei neuen Sperrungen automatisch angepasst (abschaltbar)
- **Turn-by-Turn-Navigation** mit Manöveranweisungen, Restzeit/Ankunft, Tempo,
  Neuberechnung bei Abweichung
- **Tour-Aufzeichnung** per GPS (auch im Hintergrund) mit Live-Statistik
- **Tour-Bibliothek + Statistik**: Touren/Routen speichern, umbenennen, Gesamt-km,
  Höchstgeschwindigkeit, Höhenmeter, km pro Jahr
- **GPX-Export/-Import**, POI-Suche (Tankstelle, Restaurant, Hotel, Werkstatt),
  Kartenstile, Autobahnen/Maut vermeiden

## Installation – Schritt für Schritt (ca. 30 Minuten, 0 €)

Du brauchst: einen **Mac**, dein **iPhone**, ein **Ladekabel** und deine normale
**Apple-ID** (die du eh schon hast – kostet nichts extra).

**Schritt 1 – Xcode laden:** Auf dem Mac den *App Store* öffnen, „Xcode“ suchen,
laden (gratis, aber groß – Kaffee holen).

**Schritt 2 – Projekt öffnen:** Diesen Ordner auf den Mac kopieren (z. B. als
ZIP von GitHub herunterladen) und die Datei `MotoTour.xcodeproj` doppelklicken.

**Schritt 3 – Deine Apple-ID eintragen (einmalig):**
Xcode-Menü → *Settings* → *Accounts* → unten links „+“ → Apple-ID anmelden.

**Schritt 4 – Signieren:** Links im Projekt-Navigator ganz oben „MotoTour“ anklicken →
Reiter *Signing & Capabilities* → bei *Team* dein „(Personal Team)“ auswählen.
Meckert Xcode über den Bundle Identifier, einfach hinten deinen Namen anhängen
(z. B. `de.nextgen.mototour.julius`).

**Schritt 5 – iPhone verbinden:** iPhone per Kabel anschließen, auf dem iPhone
„Diesem Computer vertrauen“ bestätigen. Oben in der Mitte von Xcode dein iPhone
als Ziel auswählen (statt „iPhone Simulator“).

**Schritt 6 – Installieren:** Auf den ▶︎-Knopf oben links drücken. Beim ersten Mal
sagt das iPhone „Nicht vertrauenswürdiger Entwickler“: Dann auf dem iPhone
*Einstellungen → Allgemein → VPN & Geräteverwaltung* → deine Apple-ID → *Vertrauen*.
Noch einmal ▶︎ drücken – fertig, die App ist drauf.

**Wichtig zu wissen:** Mit kostenloser Apple-ID läuft die App **7 Tage**, danach
startet sie nicht mehr – einfach iPhone wieder anstecken und ▶︎ drücken, dann läuft
sie wieder 7 Tage (alle Touren und Einstellungen bleiben erhalten). Das ist eine
Beschränkung von Apple, keine der App.

**Dein Kollege will sie auch?** Gleiche Schritte an seinem iPhone – einfach mit
**seiner** Apple-ID in Xcode anmelden (oder kurz sein iPhone an deinen Mac hängen).

## App Store, 3,99 € und Gratis-Version für Kollegen

- Für den **App Store** brauchst du das kostenpflichtige *Apple Developer Program*
  (99 €/Jahr – Apples Bedingung, dafür entfällt die 7-Tage-Grenze). Den Preis
  (z. B. 3,99 €) stellst du dann einfach in App Store Connect ein – am Code muss
  dafür **nichts** geändert werden, die App enthält keinerlei Bezahl- oder Lizenzlogik.
- Kollegen bekommen sie trotzdem **gratis**:
  - **Vor** dem App Store: per Xcode installieren (wie oben) – 0 €.
  - **Mit** Developer-Account: per **TestFlight** einladen (gratis für bis zu
    10 000 Tester, ohne 7-Tage-Grenze).
  - **Nach** App-Store-Start: Apple gibt dir pro App-Version **Promo-Codes**,
    mit denen dein Kollege die 3,99-€-App kostenlos lädt.

## Technik & Grenzen

- Karten & Routing: **Apple MapKit** (kostenlos, kein Key). Kurven-Routing ist eine
  Heuristik über Umweg-Kandidaten – Ergebnisse variieren je nach Region.
- Landstraßen-Meldungen kommen aus **OpenStreetMap** (© OpenStreetMap-Mitwirkende):
  sehr gut bei längeren Baustellen/Sperrungen, aber Community-Daten – ganz frische
  oder kurzfristige Sperrungen fehlen manchmal. Genau dafür gibt es die eigene
  „Sperrung melden“-Funktion auf der Karte.
- Autobahn-Meldungen: **Autobahn GmbH des Bundes** (nur Autobahnen).
- **Offline-Karten** sind mit MapKit nicht möglich (dafür wäre ein Wechsel auf
  OpenStreetMap-Tiles nötig).
- Alle Daten (Touren, Routen, eigene Meldungen, Einstellungen) bleiben nur auf dem Gerät.

## Projektstruktur

```
MotoTour/
├── MotoTour.xcodeproj
└── MotoTour/
    ├── App/        Einstieg & Tab-Navigation
    ├── Core/       Modelle, Geo-Mathematik, Einstellungen
    ├── Services/   Routing, Verkehrsmeldungen (Autobahn + OSM + eigene),
    │               GPS/Aufzeichnung, Navigations-Engine, Tour-Speicher (JSON + GPX)
    └── Views/      Karte, Navigation, News, Touren, Einstellungen
```
