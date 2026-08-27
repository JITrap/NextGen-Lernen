# Obsidian-Setup für LimitlessPoster

Dieses Paket bringt zwei Dinge auf deinen PC:

1. **Die Projekt-Notizen** (`obsidian-vault/LimitlessPoster/` + CSS-Snippet) in deinen Obsidian-Vault.
2. **Auto-Logging**: Jede Claude-Session (Claude Code *und* Cowork) schreibt am Ende wichtige Erkenntnisse als verlinkte Notiz nach `<VAULT>/Claude/…`.

Obsidian indexiert neue `.md`-Dateien automatisch — es reicht, wenn Claude sie in den Vault-Ordner schreibt.

## Was liegt hier?

| Datei | Zweck |
| --- | --- |
| `global-claude-md-abschnitt.md` | Fertiger Abschnitt für `~/.claude/CLAUDE.md` (gilt global für alle Claude-Code-Sessions) |
| `settings-hooks-beispiel.json` | SessionEnd-Hook-Beispiel für `~/.claude/settings.json` (Minimal-Logzeile als Fallback) |
| `hook-log-skript.sh` | Das kleine Skript, das der Hook aufruft (kommentiert, mit `<VAULT>`-Platzhalter) |
| `skills/obsidian-log/SKILL.md` | Globale Skill: `/obsidian-log` schreibt die aktuelle Session auf Zuruf in den Vault |
| `cowork-global-instructions.txt` | Text für Cowork → Settings → Global Instructions (Cowork unterstützt keine Hooks und liest `~/.claude/CLAUDE.md` nicht verlässlich — dort läuft alles anweisungsbasiert) |

## Einrichtung in 3 Schritten

**Schritt 1 — Lokale Claude-Session öffnen.**
Auf deinem PC (nicht in der Cloud): Cowork öffnen oder ein Terminal mit Claude Code starten — gleicher Account wie immer.

**Schritt 2 — Den Prompt unten komplett kopieren und einfügen.**
Die Session fragt dich nach deinem Vault-Pfad und erledigt den Rest (Repo ziehen, Notizen kopieren, CLAUDE.md ergänzen, Hook + Skill installieren).

**Schritt 3 — Zwei Handgriffe, die nur du machen kannst.**
Den Cowork-Text, den die Session dir am Ende anzeigt, in **Cowork → Settings → Global Instructions** einfügen — und in Obsidian unter **Einstellungen → Darstellung → CSS-Snippets** das Snippet `limitless-callouts` aktivieren.

## Der Copy-Paste-Prompt

> **Richte mein LimitlessPoster-Obsidian-Setup ein. Gehe so vor: (1) Klone das GitHub-Repo `JITrap/NextGen-Lernen` (Branch `claude/shop-design-showcase-s9imp9`) in einen Arbeitsordner — falls es lokal schon existiert, wechsle auf den Branch und zieh nur den neuesten Stand. (2) Frag mich nach dem absoluten Pfad meines Obsidian-Vaults und verwende ihn ab dann überall dort, wo `<VAULT>` steht. (3) Kopiere den Repo-Ordner `obsidian-vault/LimitlessPoster` nach `<VAULT>/LimitlessPoster` und die Datei `obsidian-vault/_assets/limitless-callouts.css` nach `<VAULT>/.obsidian/snippets/` (Ordner ggf. anlegen; vorhandene gleichnamige Dateien vorher zur Seite legen, nichts stumpf überschreiben). (4) Hänge den markierten Abschnitt aus `obsidian-setup/global-claude-md-abschnitt.md` an `~/.claude/CLAUDE.md` an (Datei ggf. anlegen; wenn der Abschnitt „Obsidian-Log" schon existiert, aktualisiere ihn statt ihn zu doppeln) und ersetze darin `<VAULT>` durch meinen echten Pfad. (5) Installiere `obsidian-setup/hook-log-skript.sh` nach `~/.claude/hooks/obsidian-session-log.sh`, ersetze darin `<VAULT>`, mach die Datei ausführbar und trage den SessionEnd-Hook aus `obsidian-setup/settings-hooks-beispiel.json` in `~/.claude/settings.json` ein — bestehende Einstellungen und Hooks dabei mergen, nichts löschen. (6) Kopiere `obsidian-setup/skills/obsidian-log` nach `~/.claude/skills/obsidian-log`. (7) Zeig mir zum Schluss den kompletten Inhalt von `obsidian-setup/cowork-global-instructions.txt` (mit eingesetztem Vault-Pfad), damit ich ihn in Cowork unter Settings → Global Instructions einfügen kann, und fasse in einer kurzen Liste zusammen, was du wo installiert hast. Ändere in meinem Vault nichts außer dem neuen Ordner `LimitlessPoster` und dem CSS-Snippet.**

## Danach: So funktioniert das Logging

- **Claude Code:** Der CLAUDE.md-Abschnitt sorgt dafür, dass am Session-Ende eine strukturierte Notiz nach `<VAULT>/Claude/JJJJ-MM-TT <Thema>.md` geschrieben wird; der SessionEnd-Hook hängt zusätzlich (rein mechanisch) eine Minimal-Logzeile an `<VAULT>/Claude/_session-log.md` an.
- **Auf Zuruf:** `/obsidian-log` schreibt die aktuelle Session sofort in den Vault — gleiches Template.
- **Cowork:** kennt keine Hooks; dort übernimmt der Text aus den Global Instructions dasselbe Verhalten rein anweisungsbasiert.
