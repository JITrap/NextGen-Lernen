#!/usr/bin/env python3
"""Groessen-Umstellung erneut anwenden (LimitlessPoster).

Wozu: Printify kennt beim erneuten Veroeffentlichen nur EIN Haekchen fuer
Varianten: "Colors, sizes, prices, and SKUs". Es wird auch fuer Preis- und
Lager-Updates gebraucht. Danach heissen die Optionen in Shopify wieder
"Size" / "Color" mit Zoll-Werten ("11″ x 14″") und "Black" / "White".
Dieses Skript baut aus dem AKTUELLEN Stand die Mutationen, die wieder
"Groesse" (cm) und "Rahmen" (Schwarz/Weiss) herstellen. Es arbeitet mit den
IDs, die gerade im Shop gelten (nach einem Printify-Publish koennen sich
Options- und Wert-IDs aendern, deshalb nicht den alten Plan wiederverwenden).

Ablauf:
  1. Aktuellen Stand exportieren (Admin API, Seiten zu 50 Produkten), z. B.:
       query($after:String){products(first:50,after:$after){
         pageInfo{hasNextPage endCursor}
         nodes{id handle options{id name optionValues{id name}}}}}
     Die Antworten (eine oder mehrere Dateien, je {"data":{"products":...}}
     oder eine reine Produktliste) als JSON speichern.
  2. python3 neu-anwenden.py stand1.json [stand2.json ...] [--nur-pruefen]
     -> schreibt neu-anwenden-<n>.graphql (je 25 Produkte) und meldet,
        welche Produkte schon stimmen und welche Werte unbekannt sind.
  3. Die .graphql-Dateien nacheinander ausfuehren, dann Schritt 1 wiederholen:
     das Skript muss "0 Produkte zu aendern" melden.

Varianten-IDs, SKUs und Preise werden nicht angefasst (nur Namen).
Achtung: Wurden in Printify neue Groessen ergaenzt, danach auch die Zeile
"Groessen:" in der Produktbeschreibung pruefen.
"""
import json
import pathlib
import re
import sys
from decimal import Decimal, ROUND_HALF_UP

HIER = pathlib.Path(__file__).resolve().parent
BATCH = 25

GROESSE = "Größe"
RAHMEN = "Rahmen"
GROESSE_NAMEN = {"size", "größe", "grösse", "groesse", "format"}
RAHMEN_NAMEN = {"color", "colour", "farbe", "rahmen", "rahmenfarbe", "frame", "frame color"}
FARBEN = {"black": "Schwarz", "schwarz": "Schwarz", "white": "Weiß", "weiß": "Weiß", "weiss": "Weiß"}
# Wie im Groessen-Guide (gerundet); andere Zollmasse werden kaufmaennisch gerundet.
ZOLL_CM = {11: 28, 12: 30, 14: 36, 16: 41, 18: 46, 20: 51, 24: 61, 30: 76, 36: 91}

ZOLL_RE = re.compile(r'^\s*(\d+(?:[.,]\d+)?)\s*(?:″|"|”|in\.?|inch)?\s*[x×X]\s*(\d+(?:[.,]\d+)?)\s*(?:″|"|”|in\.?|inch)?\s*$')
CM_RE = re.compile(r'^\d+ × \d+ cm$')


def zoll_zu_cm(z):
    zahl = Decimal(z.replace(",", "."))
    if zahl == zahl.to_integral_value() and int(zahl) in ZOLL_CM:
        return ZOLL_CM[int(zahl)]
    return int((zahl * Decimal("2.54")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def groesse_neu(wert):
    if CM_RE.match(wert):
        return wert
    m = ZOLL_RE.match(wert)
    if not m:
        return None
    return "%d × %d cm" % (zoll_zu_cm(m.group(1)), zoll_zu_cm(m.group(2)))


def produkte_laden(pfade):
    produkte = []
    for pfad in pfade:
        daten = json.loads(pathlib.Path(pfad).read_text(encoding="utf-8"))
        if isinstance(daten, dict):
            daten = daten.get("data", daten).get("products", daten)
            daten = daten.get("nodes", daten) if isinstance(daten, dict) else daten
        produkte.extend(daten)
    return produkte


def plan_bauen(produkte):
    plan, unbekannt, ok = [], [], 0
    for p in produkte:
        ops = []
        for o in p["options"]:
            werte = o.get("optionValues") or o.get("values") or []
            name_low = o["name"].strip().lower()
            if name_low in GROESSE_NAMEN:
                ziel_name = GROESSE
                neu = {v["id"]: groesse_neu(v["name"]) for v in werte}
            elif name_low in RAHMEN_NAMEN:
                ziel_name = RAHMEN
                neu = {v["id"]: FARBEN.get(v["name"].strip().lower()) for v in werte}
            else:
                continue
            fehlend = [v["name"] for v in werte if neu[v["id"]] is None]
            if fehlend:
                unbekannt.append("%s: %s %s" % (p.get("handle", p["id"]), o["name"], fehlend))
                continue
            aenderung = [{"id": v["id"], "name": neu[v["id"]]} for v in werte if neu[v["id"]] != v["name"]]
            if aenderung or o["name"] != ziel_name:
                ops.append({"option": {"id": o["id"], "name": ziel_name}, "optionValuesToUpdate": aenderung})
        if ops:
            plan.append({"productId": p["id"], "handle": p.get("handle", ""), "ops": ops})
        else:
            ok += 1
    return plan, unbekannt, ok


def q(s):
    return json.dumps(s, ensure_ascii=False)


def mutationen_schreiben(plan):
    teile = []
    for eintrag in plan:
        for op in eintrag["ops"]:
            werte = ",".join("{id:%s,name:%s}" % (q(v["id"]), q(v["name"])) for v in op["optionValuesToUpdate"])
            teile.append(
                "productOptionUpdate(productId:%s,option:{id:%s,name:%s},optionValuesToUpdate:[%s],"
                "variantStrategy:LEAVE_AS_IS){userErrors{field message}}"
                % (q(eintrag["productId"]), q(op["option"]["id"]), q(op["option"]["name"]), werte)
            )
    for n, start in enumerate(range(0, len(teile), BATCH * 2)):
        block = teile[start:start + BATCH * 2]
        ziel = HIER / ("neu-anwenden-%d.graphql" % n)
        ziel.write_text("mutation{" + " ".join("m%d:%s" % (i, t) for i, t in enumerate(block)) + "}", encoding="utf-8")
        print(ziel.name, len(block), "Mutationen")


if __name__ == "__main__":
    dateien = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not dateien:
        sys.exit(__doc__)
    plan, unbekannt, ok = plan_bauen(produkte_laden(dateien))
    print("%d Produkte stimmen schon, %d Produkte zu aendern" % (ok, len(plan)))
    for zeile in unbekannt:
        print("UNBEKANNT (nicht umbenannt, bitte pruefen):", zeile)
    if "--nur-pruefen" not in sys.argv and plan:
        mutationen_schreiben(plan)
