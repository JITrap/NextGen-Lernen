#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gegenpruefung Versand (02.10.2026): Live-Stand der Versandprofile gegen die Sicherung.

Eingabe:
  --backup  shop-checkliste/backup-2026-10-02/versand/deliveryProfiles-vorher.json
  --live    Ordner mit je einer Antwort der Abfrage "ProfilVoll" (unten) pro Profil,
            Dateiname beliebig, Inhalt {"data": {"deliveryProfile": {...}}}
  --orte    (optional) Antwort der Abfrage "Standorte" (unten)

Verglichen wird alles ausser:
  - version (steigt bei jeder Aenderung),
  - Cursor (endCursor),
  - IDs der Gewichtsbedingungen (Shopify vergibt sie beim Speichern neu),
  - Name und Beschreibung der Methoden in Zonen mit DE in den Profilen aus GEAENDERT
    (dort wird stattdessen geprueft: vorher "Standard Delivery", jetzt ZIEL_NAME, Beschreibung leer).
Standorte werden getrennt verglichen, weil die Sicherung sie mit anderen Optionen abgefragt hat.

Abfrage "ProfilVoll" (Variable $id = gid://shopify/DeliveryProfile/...):
  deliveryProfile(id: $id) { id name default version activeMethodDefinitionsCount
    productVariantsCount { count } zoneCountryCount originLocationCount locationsWithoutRatesCount
    profileLocationGroups { locationGroup { id locationsCount { count } locations(first: 10) { nodes { id name isActive } } }
      locationGroupZones(first: 70) { pageInfo { hasNextPage endCursor } nodes {
        zone { id name countries { id name code { countryCode restOfWorld } provinces { id code name } } }
        methodDefinitionCounts { participantDefinitionsCount rateDefinitionsCount }
        methodDefinitions(first: 50) { pageInfo { hasNextPage } nodes { id name description active
          rateProvider { __typename ... on DeliveryRateDefinition { id price { amount currencyCode } } ... on DeliveryParticipant { id } }
          methodConditions { id field operator conditionCriteria { __typename ... on Weight { unit value } ... on MoneyV2 { amount currencyCode } } } } } } } } }
Abfrage "Standorte":
  deliveryProfiles(first: 25) { nodes { id profileLocationGroups { locationGroup { id locationsCount { count }
    locations(first: 10, includeLegacy: true, includeInactive: true) { nodes { id name isActive } } } } } }

Ausgabe: je Profil eine Zeile, am Ende "FEHLER GESAMT: 0", wenn alles passt. Exit-Code 1 bei Abweichung.
"""
import argparse
import copy
import glob
import hashlib
import json
import os
import sys

ZIEL_NAME = "Standardversand (4–10 Werktage)"
ALTER_NAME = "Standard Delivery"
GEAENDERT = {"138270966093", "138270998861", "138271031629", "138271097165", "138271129933"}


def ist_de(zone):
    return any(c["code"]["countryCode"] == "DE" for c in zone["zone"]["countries"])


def kanonisch(p, de_maskieren):
    p = copy.deepcopy(p)
    p.pop("version", None)
    if p.get("default"):  # in der Sicherung beim Allgemeinen Profil nicht abgefragt
        p.pop("originLocationCount", None)
        p.pop("locationsWithoutRatesCount", None)
    for lg in p["profileLocationGroups"]:
        lg["locationGroup"].pop("locations", None)
        lg["locationGroupZones"]["pageInfo"].pop("endCursor", None)
        for z in lg["locationGroupZones"]["nodes"]:
            z["methodDefinitions"]["pageInfo"].pop("endCursor", None)
            for m in z["methodDefinitions"]["nodes"]:
                for c in m["methodConditions"]:
                    c.pop("id", None)
                if de_maskieren and ist_de(z):
                    m["name"] = m["description"] = "<DE>"
    return p


def sha(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backup", required=True)
    ap.add_argument("--live", required=True)
    ap.add_argument("--orte")
    ap.add_argument("--json-ausgabe", help="Zusammenfassung als JSON schreiben")
    a = ap.parse_args()

    bk = {p["id"]: p for p in json.load(open(a.backup, encoding="utf-8"))["profiles"]}
    live = {}
    for f in glob.glob(os.path.join(a.live, "*.json")):
        d = json.load(open(f, encoding="utf-8"))
        if "deliveryProfile" in d.get("data", {}):
            live[d["data"]["deliveryProfile"]["id"]] = d["data"]["deliveryProfile"]

    fehler_gesamt = 0
    zusammenfassung = {"profile": [], "summen": {}}
    summen = dict(methoden=0, aktiv=0, de_umbenannt=0, bedingungen=0, bedingungs_ids_neu=0,
                  bedingungs_ids_neu_ausserhalb_de=0, zonen=0, laender=0, provinzen=0)
    if set(bk) != set(live):
        print("Profile verschieden: fehlen live", sorted(set(bk) - set(live)), "neu live", sorted(set(live) - set(bk)))
        fehler_gesamt += 1

    for pid in sorted(set(bk) & set(live)):
        a_, b_ = bk[pid], live[pid]
        kurz = pid.rsplit("/", 1)[1]
        geaendert = kurz in GEAENDERT
        fehler = []
        erwartet = a_["version"] + 1 if geaendert else a_["version"]
        if b_["version"] != erwartet:
            fehler.append(f"Version {a_['version']} -> {b_['version']} (erwartet {erwartet})")
        h_vor, h_live = sha(kanonisch(a_, geaendert)), sha(kanonisch(b_, geaendert))
        if h_vor != h_live:
            fehler.append("kanonischer Stand verschieden")

        ma, mb = {}, {}
        for prof, ziel in ((a_, ma), (b_, mb)):
            for lg in prof["profileLocationGroups"]:
                for z in lg["locationGroupZones"]["nodes"]:
                    for m in z["methodDefinitions"]["nodes"]:
                        ziel[m["id"]] = (z, m)
        if set(ma) != set(mb):
            fehler.append(f"Methoden: {len(set(ma) - set(mb))} fehlen, {len(set(mb) - set(ma))} neu")
        for lg in a_["profileLocationGroups"]:
            for z in lg["locationGroupZones"]["nodes"]:
                summen["zonen"] += 1
                summen["laender"] += len(z["zone"]["countries"])
                summen["provinzen"] += sum(len(c["provinces"]) for c in z["zone"]["countries"])
        de_umbenannt = 0
        for mid, (z, m) in ma.items():
            if mid not in mb:
                continue
            z2, m2 = mb[mid]
            summen["methoden"] += 1
            summen["aktiv"] += m2["active"]
            if m["active"] != m2["active"]:
                fehler.append("aktiv geaendert " + mid)
            if json.dumps(m["rateProvider"], sort_keys=True) != json.dumps(m2["rateProvider"], sort_keys=True):
                fehler.append("Preis geaendert " + mid)
            ca = [(c["field"], c["operator"], json.dumps(c["conditionCriteria"], sort_keys=True)) for c in m["methodConditions"]]
            cb = [(c["field"], c["operator"], json.dumps(c["conditionCriteria"], sort_keys=True)) for c in m2["methodConditions"]]
            if ca != cb:
                fehler.append("Bedingung geaendert " + mid)
            summen["bedingungen"] += len(ca)
            neu = sum(1 for x, y in zip(m["methodConditions"], m2["methodConditions"]) if x["id"] != y["id"])
            summen["bedingungs_ids_neu"] += neu
            if not ist_de(z):
                summen["bedingungs_ids_neu_ausserhalb_de"] += neu
            if ist_de(z) and geaendert:
                if m["name"] == ALTER_NAME and m2["name"] == ZIEL_NAME and (m2["description"] or "") == "":
                    de_umbenannt += 1
                else:
                    fehler.append(f"DE-Methode unerwartet: {m['name']!r} -> {m2['name']!r} / {m2['description']!r}")
            elif (m["name"], m["description"]) != (m2["name"], m2["description"]):
                fehler.append("Name geaendert " + mid)
        summen["de_umbenannt"] += de_umbenannt
        fehler_gesamt += len(fehler)
        zeile = dict(profil=pid, name=a_["name"], version_vorher=a_["version"], version_live=b_["version"],
                     methoden=len(mb), aktiv=b_["activeMethodDefinitionsCount"], de_umbenannt=de_umbenannt,
                     sha256_vorher=h_vor, sha256_live=h_live, fehler=fehler)
        zusammenfassung["profile"].append(zeile)
        print(f"{kurz} v{a_['version']}->{b_['version']} Methoden {len(ma)}/{len(mb)} DE umbenannt {de_umbenannt} "
              f"Stand gleich {h_vor == h_live} Fehler {fehler[:5]}")

    if a.orte:
        for n in json.load(open(a.orte, encoding="utf-8"))["data"]["deliveryProfiles"]["nodes"]:
            if n["id"] not in bk:
                continue
            for lg_l, lg_b in zip(n["profileLocationGroups"], bk[n["id"]]["profileLocationGroups"]):
                ids_l = {x["id"] for x in lg_l["locationGroup"]["locations"]["nodes"]}
                ids_b = {x["id"] for x in lg_b["locationGroup"]["locations"]["nodes"]}
                ok = (lg_l["locationGroup"]["id"] == lg_b["locationGroup"]["id"] and ids_b <= ids_l
                      and lg_l["locationGroup"]["locationsCount"] == lg_b["locationGroup"]["locationsCount"]
                      and all(x["isActive"] for x in lg_l["locationGroup"]["locations"]["nodes"]))
                fehler_gesamt += 0 if ok else 1
                print("Standorte", n["id"].rsplit("/", 1)[1], "gleich" if ok else "ABWEICHUNG")
        zusammenfassung["standorte_geprueft"] = True

    zusammenfassung["summen"] = summen
    zusammenfassung["fehler_gesamt"] = fehler_gesamt
    print(summen)
    print("FEHLER GESAMT:", fehler_gesamt)
    if a.json_ausgabe:
        with open(a.json_ausgabe, "w", encoding="utf-8") as f:
            json.dump(zusammenfassung, f, ensure_ascii=False, indent=1)
    sys.exit(1 if fehler_gesamt else 0)


if __name__ == "__main__":
    main()
