#!/usr/bin/env bash
# Baut den Businessplan: Textbereinigung → DOCX (docx-js) → Inhaltsverzeichnis/PDF (LibreOffice UNO) → Seitenvorschau
set -euo pipefail
cd "$(dirname "$0")"
python3 cleanup.py .
node assemble.js . Businessplan_roh.docx
python3 export_pdf.py Businessplan_roh.docx Businessplan_No1.docx Businessplan_No1.pdf
rm -rf pages && mkdir -p pages
pdftoppm -jpeg -r 50 Businessplan_No1.pdf pages/s
ls pages | wc -l
