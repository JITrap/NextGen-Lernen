---
name: obsidian-log
description: Schreibt die aktuelle Session auf Zuruf (/obsidian-log) als strukturierte, verlinkte Notiz in den Obsidian-Vault — gleiches Template wie das globale Session-Logging. Nutzen, wenn der Nutzer die Session in Obsidian sichern, loggen oder festhalten möchte.
---

# Obsidian-Log

Schreibe die aktuelle Session als eine strukturierte Markdown-Notiz in den Obsidian-Vault des Nutzers.

## Ablauf

1. **Vault-Pfad ermitteln:** Er steht in `~/.claude/CLAUDE.md` im Abschnitt „Obsidian-Log" (Zeile „Mein Obsidian-Vault liegt unter: …"). Ist er dort nicht zu finden, frage den Nutzer nach dem absoluten Pfad.
2. **Zielpfad:** `<VAULT>/Claude/JJJJ-MM-TT <Kurzthema>.md` — Kurzthema = 2–4 Wörter zum Hauptthema der Session. Ordner `Claude/` bei Bedarf anlegen. Existiert die Datei bereits, **ergänze** sie um neue Abschnitte (nicht überschreiben).
3. **Inhalt:** Template unten exakt verwenden. Faktisch und konkret schreiben — was getan wurde, welche Entscheidungen mit welcher Begründung fielen, was offen bleibt. Auch Fehlschläge/Sackgassen notieren, wenn sie künftige Arbeit ersparen.
4. **Wikilinks:** Kurz im Vault nach thematisch passenden, existierenden Notizen suchen (Dateinamen genügen) und sie unter „Verweise" verlinken. Bei LimitlessPoster-Themen mindestens `[[00 Dashboard]]`, je nach Thema auch `[[22 Konventionen]]`, `[[30 Entscheidungslog]]`, `[[40 Offene Punkte]]`.
5. **Abschluss:** Dem Nutzer in einem Satz den vollständigen Dateipfad der geschriebenen Notiz nennen.

## Template

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

## Regeln

- Durchgehend Deutsch; Obsidian-Markdown (Frontmatter-Tags, Callouts `> [!info]`/`> [!warning]`, `[[Wikilinks]]`).
- Keine Passwörter, Tokens, API-Keys oder andere Secrets in die Notiz.
- Im Vault außer dieser Notiz (und ggf. dem Ordner `Claude/`) nichts anlegen oder ändern.
- Obsidian indexiert neue `.md`-Dateien automatisch — einfaches Schreiben genügt.
