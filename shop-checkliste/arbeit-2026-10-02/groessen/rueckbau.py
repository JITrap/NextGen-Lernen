#!/usr/bin/env python3
"""Rueckbau der Groessen-Umstellung vom 02.10.2026 (LimitlessPoster).

Erzeugt GraphQL-Mutationen (Shopify Admin API), die den Vorher-Stand
wiederherstellen. Es wird nichts direkt ausgefuehrt: Die Dateien werden
nacheinander im Admin-API-Werkzeug (z. B. GraphiQL-App oder per Agent)
ausgefuehrt.

  python3 rueckbau.py optionen        -> rueckbau-optionen-<n>.graphql
  python3 rueckbau.py beschreibungen  -> rueckbau-beschreibungen-<n>.graphql

Optionen: Name "Groesse" -> "Size", "Rahmen" -> "Color", Werte zurueck auf
die Printify-Zollwerte bzw. Black/White. Varianten-IDs, SKUs und Preise
waren nie betroffen und bleiben unveraendert.

Theme-Dateien: Vorher-Stand liegt unter
shop-checkliste/backup-2026-10-02/groessen/ofe-v3/ und kann per
themeFilesUpsert ins Theme "LimitlessPoster OFE v3" zurueckgespielt werden.
Seiten: siehe backup-2026-10-02/groessen/seiten/LIESMICH.txt.
"""
import json
import pathlib
import sys

HIER = pathlib.Path(__file__).resolve().parent
BACKUP = HIER.parent.parent / "backup-2026-10-02" / "groessen"
BATCH = 25


def q(s):
    return json.dumps(s, ensure_ascii=False)


def optionen():
    produkte = json.loads((BACKUP / "optionen-vorher.json").read_text())
    teile = []
    for p in produkte:
        for o in p["options"]:
            werte = ",".join(
                "{id:%s,name:%s}" % (q(v["id"]), q(v["name"])) for v in o["values"]
            )
            teile.append(
                "productOptionUpdate(productId:%s,option:{id:%s,name:%s},"
                "optionValuesToUpdate:[%s],variantStrategy:LEAVE_AS_IS)"
                "{userErrors{field message}}" % (q(p["id"]), q(o["id"]), q(o["name"]), werte)
            )
    schreibe("rueckbau-optionen", teile)


def beschreibungen():
    produkte = json.loads((BACKUP / "beschreibungen-vorher.json").read_text())
    teile = [
        "productUpdate(product:{id:%s,descriptionHtml:%s}){userErrors{message}}"
        % (q(p["id"]), q(p["descriptionHtml"]))
        for p in produkte
    ]
    schreibe("rueckbau-beschreibungen", teile, batch=12)


def schreibe(praefix, teile, batch=BATCH):
    for n, start in enumerate(range(0, len(teile), batch)):
        block = teile[start:start + batch]
        text = "mutation{" + " ".join("m%d:%s" % (i, t) for i, t in enumerate(block)) + "}"
        ziel = HIER / ("%s-%d.graphql" % (praefix, n))
        ziel.write_text(text)
        print(ziel.name, len(block))


if __name__ == "__main__":
    {"optionen": optionen, "beschreibungen": beschreibungen}[sys.argv[1]]()
