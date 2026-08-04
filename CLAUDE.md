# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NextGen Lernen is a prototype for a German-language static website offering AI-supported learning ("Modernes Lernen mit KI-Unterstützung"). It is plain HTML/CSS/JavaScript with no build system, no dependencies, no package manager, and no tests — all source files sit in the repository root.

All user-facing text is German; keep new UI copy in German.

## Critical: file names do not match their references

The files were committed under editor default names that do not line up with the paths referenced in the HTML. The site is broken as-is until files are renamed (or references updated):

| Actual file | Role | Referenced as |
|---|---|---|
| `NextGen lernen.txt` | Landing page HTML | (entry point; intended to be `index.html`) |
| `Untitled-1.html` | AI Learning Assistance page | `ai-learning.html` (linked from the landing page) |
| `Untitled-3.js` | Frontend logic for the AI page | `script.js` (loaded by `Untitled-1.html`) |
| `body {.css` | Shared stylesheet for both pages | `styles.css` (linked from both pages) |

Treat the "Referenced as" names as the intended canonical names. Mind the unusual actual filenames (space in `NextGen lernen.txt`, brace in `body {.css`) — quote them in shell commands.

## Architecture

Two-page static site:

- **Landing page** (`NextGen lernen.txt`): header plus three service cards. Only "AI Learning Assistance" links anywhere (`ai-learning.html`); "Personalized Study Planner" and "Teacher Tools" are `#` placeholders.
- **AI page** (`Untitled-1.html` + `Untitled-3.js`): a textarea and submit button. On click, the JS calls the OpenAI Chat Completions API (`gpt-3.5-turbo`) directly from the browser using the hardcoded placeholder `DEIN_OPENAI_API_KEY`, so the AI feature is non-functional as shipped. Making it work requires supplying a key at runtime or proxying through a backend; the `fetch` call in `Untitled-3.js` is the single integration point.

## Development

There are no build, lint, or test commands. To preview locally, the files must be available under their referenced names (see table above); then open the HTML in a browser or serve the directory with a static file server, e.g. `python3 -m http.server`.
