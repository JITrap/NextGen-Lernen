# Quick-Add-Fenster – Fix 02.10.2026

Betroffen: Theme **LimitlessPoster OFE v3** (194580283725), Datei `assets/limitless-rooms.css` (CSS am Dateiende angehängt).
Vorher-Stand: `shop-checkliste/backup-2026-10-02/quick-add/assets__limitless-rooms.css` (MD5 a75308e2…).
Nachher: MD5 a201d4f0482de6fbc9b84854516e6316, eingespielt 02.10.2026 13:58 UTC.

## Befund (per Playwright im Theme-Preview nachgestellt, Screenshots von Julius bestätigt)
1. Raum-Galerie (`.lp-rg`) im Fenster nur 296 × 222 px, darunter leere Fläche; Thumbnail-Spalte lief über, Labels („WOHNZIMMER“) abgeschnitten.
2. Kauf-Block (`.buy-buttons-block`) ist im Quick-Add `position: sticky; bottom: 0` mit Verlaufsmaske. Weil der Inhalt höher als das Fenster ist, lag er über der Rahmen-Auswahl (Schwarz/Weiß unsichtbar).
3. Chip „Szene · Größe“ überlappte den Hinweis „Vergrößern“.
4. Mobil: Galerie in einer 76 px breiten Zelle, Chip lag über dem Produkttitel.

## Fix
- Desktop: Galerie füllt die Bildspalte (Bühne 4:5, 352 × 440 px), Thumbnails als Reihe darunter.
- Kauf-Block im Fenster nicht mehr sticky, Verlaufsmaske aus. Rahmen-Auswahl und „In den Warenkorb“ sind ohne Scrollen sichtbar.
- „Vergrößern“-Hinweis im Fenster ausgeblendet; Chip begrenzt.
- Mobil: kompakte Vorschau ohne Thumbnails, Chip und Maßstab.
- Produktseite: Raum-Labels unter den Thumbnails in normaler Schreibweise mit Ellipse statt abgeschnitten.

## Getestet
Desktop 1280 × 800 und Mobil 390 × 844 mit eingespieltem CSS: Bühne 352 × 440, Rahmen-Feld sichtbar, Button bei y = 646 (Desktop).
Die Label-Regel für die Produktseite ist noch nicht im Browser bestätigt.

## Offen
- Gewählte Größe/Rahmen ist nur schwach markiert (heller Pill-Hintergrund auf hellem Button). Vorschlag: gewählter Button dunkel (#141215) mit heller Schrift und hellem Rand. Ein erster Versuch machte den Text unsichtbar. Der zweite Entwurf ist noch nicht eingespielt, weil die Browser-Prüfung pausiert.
- Live-Theme v2.0 hat die Fehler ebenfalls. Es wird durch OFE v3 ersetzt.
