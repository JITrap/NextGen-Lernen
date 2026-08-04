# MotoTour – kostenlose Motorrad-Navigation für iOS

MotoTour ist eine komplett **kostenlose** Motorrad-Navigations-App (SwiftUI, iOS 17+):
keine Abos, keine Käufe, keine Konten, keine Werbung. Alle genutzten Dienste sind gratis
und benötigen **keinen API-Key**.

> Hinweis: MotoTour ist eine eigenständige App, die den Funktionsumfang bekannter
> Motorrad-Navis (z. B. kurvige Routen, Tour-Aufzeichnung, Sperrungs-News) nachbildet.
> Name, Logo und Design geschützter Apps werden bewusst nicht kopiert.

## Funktionen

- **Routenplanung** mit drei Profilen: *Schnell*, *Kurvig*, *Super-kurvig*
  (Kurven-Routing über Umweg-Kandidaten, bewertet nach Richtungsänderung pro Kilometer)
- **Live-Verkehrsmeldungen**: Sperrungen und Baustellen von der offiziellen, kostenlosen
  API der Autobahn GmbH des Bundes (verkehr.autobahn.de) – als News-Feed und auf der Karte
- **Automatische Routenanpassung**: Vollsperrungen auf der Route werden bei der Planung
  umfahren; während der Navigation werden die Meldungen alle 3 Minuten geprüft und die
  Route bei neuen Sperrungen automatisch angepasst (abschaltbar)
- **Turn-by-Turn-Navigation** mit Manöver-Ansagen (Text), Restzeit/Ankunft, Geschwindigkeit,
  automatischer Neuberechnung bei Abweichung
- **Tour-Aufzeichnung** per GPS (auch im Hintergrund) mit Live-Statistik
- **Tour-Bibliothek**: aufgezeichnete Touren und gespeicherte Routen, Umbenennen, Löschen
- **Statistik**: Gesamt-Kilometer, Fahrzeit, Höchstgeschwindigkeit, Höhenmeter, km pro Jahr
- **GPX-Export/-Import** (kompatibel mit anderen Navi-Apps)
- **POI-Suche**: Tankstellen, Restaurants, Hotels, Werkstätten
- Kartenstile Standard/Hybrid/Satellit, Autobahnen/Maut vermeiden

## Installation (kostenlos, ohne Entwickler-Abo)

Du brauchst einmalig einen Mac mit **Xcode 16** (kostenlos aus dem Mac App Store) und eine
kostenlose Apple-ID:

1. `MotoTour.xcodeproj` in Xcode öffnen.
2. In *Signing & Capabilities* dein persönliches (kostenloses) Team auswählen; Xcode
   erstellt das Provisioning automatisch. Ggf. den Bundle Identifier leicht abändern.
3. iPhone per Kabel verbinden, als Ziel auswählen, ▶︎ Run.
4. Auf dem iPhone unter *Einstellungen → Allgemein → VPN & Geräteverwaltung* dem
   Entwicklerprofil vertrauen.

Mit kostloser Apple-ID läuft die signierte App 7 Tage und kann danach einfach erneut
per Xcode installiert werden (Daten bleiben erhalten).

## Technik & Grenzen

- Karten & Routing: **Apple MapKit** (kostenlos, kein Key). Kurven-Routing ist eine
  Heuristik über Umweg-Kandidaten – Ergebnisse variieren je nach Region.
- Sperrungen/Baustellen: **Autobahn-API des Bundes** – Abdeckung sind die deutschen
  Autobahnen. Landstraßen-Sperrungen liefert die API nicht.
- **Offline-Karten** sind mit MapKit nicht möglich (dafür wäre z. B. ein Wechsel auf
  OpenStreetMap-Tiles nötig).
- Alle Daten (Touren, Routen, Einstellungen) bleiben ausschließlich auf dem Gerät.

## Projektstruktur

```
MotoTour/
├── MotoTour.xcodeproj
└── MotoTour/
    ├── App/        Einstieg & Tab-Navigation
    ├── Core/       Modelle, Geo-Mathematik, Einstellungen
    ├── Services/   Routing, Verkehrsmeldungen, GPS/Aufzeichnung,
    │               Navigations-Engine, Tour-Speicher (JSON + GPX)
    └── Views/      Karte, Navigation, News, Touren, Einstellungen
```
