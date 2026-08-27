#!/usr/bin/env bash
# ============================================================
# Minimal-Log-Hook für Claude Code (Event: SessionEnd)
# ============================================================
# Zweck:   Hängt bei jedem Session-Ende EINE Zeile an
#          <VAULT>/Claude/_session-log.md an — als mechanisches
#          Fallback. Die eigentliche, inhaltliche Notiz schreibt
#          das Modell selbst (CLAUDE.md-Abschnitt bzw. /obsidian-log),
#          denn ein Hook sieht keine Gesprächsinhalte.
#
# Installation (macht der Setup-Prompt automatisch):
#   1. Nach  ~/.claude/hooks/obsidian-session-log.sh  kopieren
#   2. <VAULT> unten durch den absoluten Vault-Pfad ersetzen
#   3. chmod +x ~/.claude/hooks/obsidian-session-log.sh
#   4. Hook in ~/.claude/settings.json eintragen
#      (siehe settings-hooks-beispiel.json — mergen, nicht ersetzen)
#
# Hinweis: Cowork unterstützt keine Hooks — dieses Skript greift
# nur in Claude-Code-Sessions.
# ============================================================
set -eu

# ← ERSETZEN: absoluter Pfad zum Obsidian-Vault, z. B. /Users/julius/Obsidian/Main
VAULT="<VAULT>"

# Solange der Platzhalter nicht ersetzt wurde: still nichts tun.
case "$VAULT" in *"<VAULT>"*) exit 0 ;; esac

# Claude Code liefert dem Hook JSON auf stdin (session_id, cwd, reason, …).
# Best-effort und ohne jq lesen — darf scheitern, ohne den Hook zu brechen.
INPUT="$(cat 2>/dev/null || true)"
CWD="$(printf '%s' "$INPUT" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
[ -n "$CWD" ] || CWD="$(pwd)"

LOGDIR="$VAULT/Claude"
LOGFILE="$LOGDIR/_session-log.md"
mkdir -p "$LOGDIR"

# Datei mit Überschrift anlegen, falls sie noch fehlt.
if [ ! -f "$LOGFILE" ]; then
  printf '%s\n\n' '# Claude Session-Log (automatisch, SessionEnd-Hook)' > "$LOGFILE"
fi

printf -- '- %s · Claude-Code-Session beendet · Projekt: `%s`\n' \
  "$(date '+%Y-%m-%d %H:%M')" "$CWD" >> "$LOGFILE"

exit 0
