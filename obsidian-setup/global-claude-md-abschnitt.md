# Abschnitt für die globale `~/.claude/CLAUDE.md`

Alles zwischen den beiden Markern ans Ende von `~/.claude/CLAUDE.md` anhängen
(Datei anlegen, falls sie fehlt) und **`<VAULT>` durch den absoluten Pfad des
Obsidian-Vaults ersetzen** — z. B. `C:\Users\Julius\Obsidian\Main` oder
`/Users/julius/Obsidian/Main`. `~/.claude/CLAUDE.md` gilt global für alle
Claude-Code-Sessions auf diesem Rechner; Cowork liest sie nicht verlässlich und
bekommt denselben Text über seine eigenen Global Instructions
(`cowork-global-instructions.txt`).

<!-- ▼▼▼ AB HIER KOPIEREN ▼▼▼ -->

## Obsidian-Log (gilt für jede Session)

Mein Obsidian-Vault liegt unter: `<VAULT>`

Am Ende jeder Session — wenn die Arbeit erkennbar abgeschlossen ist oder ich mich verabschiede:

1. Prüfe: Gab es Erkenntnisse, Entscheidungen oder Ergebnisse, die später noch wichtig sind? Wenn **nein**, schreibe nichts (kein Log-Spam).
2. Wenn ja, schreibe **eine** Notiz nach `<VAULT>/Claude/JJJJ-MM-TT <Kurzthema>.md` (Ordner `Claude/` bei Bedarf anlegen; Kurzthema = 2–4 Wörter). Existiert die Datei schon, ergänze sie um neue Abschnitte statt sie zu überschreiben.
3. Nutze exakt das Template unten: Frontmatter mit `created` und `tags`, Callouts, Wikilinks.
4. Setze `[[Wikilinks]]` auf thematisch passende, bereits existierende Notizen — suche dafür kurz nach Dateinamen im Vault. Bei LimitlessPoster-Themen mindestens `[[00 Dashboard]]`, je nach Thema auch `[[22 Konventionen]]`, `[[30 Entscheidungslog]]` oder `[[40 Offene Punkte]]`.
5. Schreibe faktisch und konkret (was getan, was entschieden und warum, was offen). Keine Passwörter, Tokens oder Secrets in die Notiz.
6. Frage nicht um Erlaubnis; erwähne am Ende nur in einem Satz, dass und wohin die Notiz geschrieben wurde.

Template für die Notiz:

```markdown
---
created: JJJJ-MM-TT
tags: [claude-log, <projekt-tag>]
---

# <Thema der Session>

> [!info] Session
> JJJJ-MM-TT · Projekt/Ordner: <Pfad oder Repo> · <Kontext in einem Satz>

## Was passiert ist
- …

## Entscheidungen & Begründung
- …

## Offene Punkte
- [ ] …

## Verweise
- [[…]]
```

<!-- ▲▲▲ BIS HIER KOPIEREN ▲▲▲ -->
