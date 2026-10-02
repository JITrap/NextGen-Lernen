#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Versandart in der Zone Deutschland eindeutschen (LimitlessPoster).

Hintergrund
-----------
Printify legt pro Postergroesse ein Versandprofil "Standard: Print Pigeons ..." an.
In jeder Zone heissen die 12 Gewichtsstufen "Standard Delivery" mit der Beschreibung
"7-15 business days". Kunden sehen diesen englischen Namen im Checkout und in den
Shopify-Mails. Dieses Skript benennt NUR in Zonen, die Deutschland enthalten, die
Methoden "Standard Delivery" um. Preise, Gewichtsbedingungen, aktiv/inaktiv,
andere Laender und andere Profile bleiben unveraendert. Es wird nichts geloescht.

Printify kann die Profile beim erneuten Veroeffentlichen oder Synchronisieren neu
schreiben. Dann steht dort wieder "Standard Delivery". Einfach das Skript erneut
ausfuehren (es findet die Methoden ueber den Namen, nicht ueber feste IDs).

Drei Arbeitsweisen
------------------
1) Offline aus einer JSON-Datei (z. B. Backup oder Antwort der Profilabfrage):
       python3 versand_deutsch_umbenennen.py --aus-datei profile.json
   Zeigt den Plan und schreibt je Profil die Variablen fuer die Mutation in
   --ausgabe-ordner (Standard: ./versand-variablen). Diese Variablen kann man mit
   der Mutation aus versand_deutsch_umbenennen.graphql ausfuehren (z. B. im
   Shopify-GraphiQL-App-Fenster oder ueber ein Admin-API-Werkzeug).

2) Online direkt gegen die Admin-API (Token NIE in Dateien oder ins Repo schreiben):
       export SHOPIFY_SHOP=gexdm4-2q.myshopify.com
       export SHOPIFY_ADMIN_TOKEN=...            # nur in der eigenen Shell
       python3 versand_deutsch_umbenennen.py              # nur Plan (Probelauf)
       python3 versand_deutsch_umbenennen.py --anwenden   # ausfuehren + pruefen
   Benoetigte Rechte: read_shipping, write_shipping.
   Mit --nur-profil <ID> wird nur ein Profil bearbeitet (zum Testen).

3) Rueckgaengig machen aus dem Backup (setzt Name und Beschreibung der
   Deutschland-Methoden auf den gesicherten Stand zurueck):
       python3 versand_deutsch_umbenennen.py --zuruecksetzen \
           ../backup-2026-10-02/versand/deutschland-zonen-vorher.json [--anwenden]

Lieferzeit aendert sich? Erst alle Shop-Texte anpassen (FAQ, AGB § 5,
Versandrichtlinie, Produkttexte, Bestellbestaetigung), dann z. B.:
       python3 versand_deutsch_umbenennen.py --ziel-name "Standardversand (5–12 Werktage)" \
           --alter-name "Standardversand (4–10 Werktage)" [--anwenden]

Ohne --anwenden wird nie etwas im Shop geaendert.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

# --------------------------------------------------------------------------
# Einstellungen
# --------------------------------------------------------------------------
# Der Shop nennt ueberall (FAQ, AGB § 5, Versandrichtlinie, alle Produkttexte)
# "in der Regel 4–10 Werktage". Name bitte nur zusammen mit diesen Texten aendern.
ZIEL_NAME = "Standardversand (4–10 Werktage)"
# Beschreibung unter dem Namen im Checkout. Leer = Printify-Text
# "7-15 business days" entfernen (widerspraeche sonst der Angabe 4–10 Werktage).
ZIEL_BESCHREIBUNG = ""
# Diese Namen werden ersetzt (Gross-/Kleinschreibung egal).
ALTE_NAMEN = {"standard delivery"}
LAND = "DE"
# Shopify unterstuetzt jede API-Version ca. 12 Monate; bei Bedarf per Umgebung ueberschreiben.
API_VERSION = os.environ.get("SHOPIFY_API_VERSION", "2026-07")
# Shopify empfiehlt hoechstens 5 Zonen pro Aufruf; wir aendern 1 Zone je Profil.

MUTATION = """mutation VersandartUmbenennen($id: ID!, $profile: DeliveryProfileInput!) {
  deliveryProfileUpdate(id: $id, profile: $profile) {
    profile { id name version activeMethodDefinitionsCount }
    userErrors { field message }
  }
}"""

PROFILE_LISTE = """query ProfileListe($after: String) {
  deliveryProfiles(first: 25, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { id name default }
  }
}"""

PROFIL_DETAIL = """query ProfilDetail($id: ID!, $zAfter: String) {
  deliveryProfile(id: $id) {
    id
    name
    version
    activeMethodDefinitionsCount
    profileLocationGroups {
      locationGroup { id }
      locationGroupZones(first: 70, after: $zAfter) {
        pageInfo { hasNextPage endCursor }
        nodes {
          zone { id name countries { code { countryCode restOfWorld } } }
          methodDefinitions(first: 50) {
            pageInfo { hasNextPage }
            nodes {
              id
              name
              description
              active
              rateProvider {
                __typename
                ... on DeliveryRateDefinition { id price { amount currencyCode } }
              }
              methodConditions {
                id
                field
                operator
                conditionCriteria {
                  __typename
                  ... on Weight { unit value }
                  ... on MoneyV2 { amount currencyCode }
                }
              }
            }
          }
        }
      }
    }
  }
}"""


# --------------------------------------------------------------------------
# Admin-API (nur Online-Modus)
# --------------------------------------------------------------------------
def gql(query, variables=None):
    shop = os.environ.get("SHOPIFY_SHOP", "").strip()
    token = os.environ.get("SHOPIFY_ADMIN_TOKEN", "").strip()
    if not shop or not token:
        sys.exit("SHOPIFY_SHOP und SHOPIFY_ADMIN_TOKEN fehlen (oder --aus-datei nutzen).")
    url = f"https://{shop}/admin/api/{API_VERSION}/graphql.json"
    body = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
    for versuch in range(5):
        req = urllib.request.Request(url, data=body, method="POST", headers={
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": token,
        })
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and versuch < 4:
                time.sleep(2 ** (versuch + 1))
                continue
            raise
        errs = data.get("errors")
        if errs and any("THROTTLED" in json.dumps(x) for x in errs) and versuch < 4:
            time.sleep(2 ** (versuch + 1))
            continue
        if errs:
            sys.exit("GraphQL-Fehler: " + json.dumps(errs, ensure_ascii=False))
        return data["data"]
    sys.exit("API nach 5 Versuchen nicht erreichbar.")


def profil_laden_online(pid):
    """Ein Profil komplett laden (alle Zonen-Seiten)."""
    profil, after = None, None
    while True:
        d = gql(PROFIL_DETAIL, {"id": pid, "zAfter": after})["deliveryProfile"]
        if profil is None:
            profil = d
        else:
            for lg_alt, lg_neu in zip(profil["profileLocationGroups"], d["profileLocationGroups"]):
                lg_alt["locationGroupZones"]["nodes"] += lg_neu["locationGroupZones"]["nodes"]
                lg_alt["locationGroupZones"]["pageInfo"] = lg_neu["locationGroupZones"]["pageInfo"]
        weiter = [lg["locationGroupZones"]["pageInfo"] for lg in d["profileLocationGroups"]
                  if lg["locationGroupZones"]["pageInfo"]["hasNextPage"]]
        if not weiter:
            return profil
        after = weiter[0]["endCursor"]


def alle_profile_online():
    ids, after = [], None
    while True:
        d = gql(PROFILE_LISTE, {"after": after})["deliveryProfiles"]
        ids += [n["id"] for n in d["nodes"]]
        if not d["pageInfo"]["hasNextPage"]:
            break
        after = d["pageInfo"]["endCursor"]
    return [profil_laden_online(i) for i in ids]


# --------------------------------------------------------------------------
# Datei-Eingabe (Backup oder rohe API-Antwort)
# --------------------------------------------------------------------------
def profile_aus_datei(pfad):
    with open(pfad, encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d, dict) and "profiles" in d:
        return d["profiles"]
    if isinstance(d, dict) and "data" in d and "deliveryProfile" in d["data"]:
        return [d["data"]["deliveryProfile"]]
    if isinstance(d, dict) and "deliveryProfile" in d:
        return [d["deliveryProfile"]]
    if isinstance(d, list):
        return [x.get("data", {}).get("deliveryProfile", x) for x in d]
    sys.exit("Unbekanntes Dateiformat: " + pfad)


# --------------------------------------------------------------------------
# Plan
# --------------------------------------------------------------------------
def laender(zone):
    return [c["code"]["countryCode"] for c in zone["countries"] if c["code"].get("countryCode")]


def plan_erstellen(profile, nur_profil=None):
    """Liefert je Profil die Variablen fuer deliveryProfileUpdate (oder nichts)."""
    plaene = []
    for p in profile:
        if nur_profil and p["id"] != nur_profil:
            continue
        lg_updates = []
        for lg in p["profileLocationGroups"]:
            if lg["locationGroupZones"]["pageInfo"].get("hasNextPage"):
                sys.exit(f"Profil {p['id']}: Zonen unvollstaendig geladen, Abbruch.")
            zonen = []
            for z in lg["locationGroupZones"]["nodes"]:
                if LAND not in laender(z["zone"]):
                    continue  # andere Laender nie anfassen
                if z["methodDefinitions"]["pageInfo"].get("hasNextPage"):
                    sys.exit(f"Zone {z['zone']['id']}: Methoden unvollstaendig geladen, Abbruch.")
                methoden = []
                for m in z["methodDefinitions"]["nodes"]:
                    if m["name"].strip().lower() not in ALTE_NAMEN:
                        continue
                    if m["name"] == ZIEL_NAME and (m["description"] or "") == ZIEL_BESCHREIBUNG:
                        continue  # schon richtig
                    methoden.append({"id": m["id"], "name": ZIEL_NAME,
                                     "description": ZIEL_BESCHREIBUNG})
                if methoden:
                    zonen.append({"id": z["zone"]["id"], "methodDefinitionsToUpdate": methoden,
                                  "_info": {"zone": z["zone"]["name"], "laender": laender(z["zone"])}})
            if zonen:
                lg_updates.append({"id": lg["locationGroup"]["id"], "zonesToUpdate": zonen})
        if lg_updates:
            plaene.append({"profil": p, "variables": {
                "id": p["id"], "profile": {"locationGroupsToUpdate": lg_updates}}})
    return plaene


def plan_zuruecksetzen(backup_pfad, nur_profil=None):
    """Variablen, die Name/Beschreibung aus deutschland-zonen-vorher.json zuruecksetzen."""
    with open(backup_pfad, encoding="utf-8") as f:
        d = json.load(f)
    plaene = []
    for z in d["zonen_mit_deutschland"]:
        if nur_profil and z["profileId"] != nur_profil:
            continue
        methoden = [{"id": m["id"], "name": m["name"], "description": m["description"] or ""}
                    for m in z["methods"] if m["name"].strip().lower() in ALTE_NAMEN]
        if not methoden:
            continue  # Zone wurde nicht umbenannt (z. B. "Standardversand (kostenlos)")
        plaene.append({"profil": {"id": z["profileId"], "name": z["profileName"]}, "variables": {
            "id": z["profileId"], "profile": {"locationGroupsToUpdate": [{
                "id": z["locationGroupId"], "zonesToUpdate": [{
                    "id": z["zoneId"], "methodDefinitionsToUpdate": methoden}]}]}}})
    return plaene


def ohne_info(obj):
    """Interne _info-Felder vor dem Senden entfernen."""
    if isinstance(obj, dict):
        return {k: ohne_info(v) for k, v in obj.items() if not k.startswith("_")}
    if isinstance(obj, list):
        return [ohne_info(x) for x in obj]
    return obj


# --------------------------------------------------------------------------
# Pruefung nach dem Anwenden
# --------------------------------------------------------------------------
def fingerprint(profil):
    """Alles ausser Name/Beschreibung der DE-Methoden: Preise, Bedingungen, aktiv, IDs."""
    out = {}
    for lg in profil["profileLocationGroups"]:
        for z in lg["locationGroupZones"]["nodes"]:
            for m in z["methodDefinitions"]["nodes"]:
                rp = m["rateProvider"]
                out[m["id"]] = (
                    z["zone"]["id"], m["active"],
                    json.dumps(rp.get("price"), sort_keys=True),
                    json.dumps(sorted((c["field"], c["operator"],
                                       json.dumps(c["conditionCriteria"], sort_keys=True))
                                      for c in m["methodConditions"])),
                    None if LAND in laender(z["zone"]) else (m["name"], m["description"]),
                )
    return out


def de_namen(profil):
    namen = set()
    for lg in profil["profileLocationGroups"]:
        for z in lg["locationGroupZones"]["nodes"]:
            if LAND in laender(z["zone"]):
                for m in z["methodDefinitions"]["nodes"]:
                    namen.add((m["name"], m["description"]))
    return namen


# --------------------------------------------------------------------------
def main():
    global ZIEL_NAME, ZIEL_BESCHREIBUNG
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--aus-datei", help="Profile aus JSON-Datei lesen statt aus der API")
    ap.add_argument("--zuruecksetzen", metavar="BACKUP",
                    help="deutschland-zonen-vorher.json: Namen auf den alten Stand setzen")
    ap.add_argument("--nur-profil", help="nur dieses Profil (gid://shopify/DeliveryProfile/...)")
    ap.add_argument("--anwenden", action="store_true", help="Mutation wirklich ausfuehren")
    ap.add_argument("--ausgabe-ordner", default="versand-variablen",
                    help="hier landen die Variablen je Profil (JSON)")
    ap.add_argument("--ziel-name", help=f"anderer Zielname (Standard: {ZIEL_NAME})")
    ap.add_argument("--ziel-beschreibung", help="andere Beschreibung (Standard: leer)")
    ap.add_argument("--alter-name", action="append", default=[],
                    help="zusaetzlich zu ersetzender Name, z. B. der bisherige deutsche Name "
                         "(mehrfach moeglich)")
    a = ap.parse_args()
    if a.ziel_name:
        ZIEL_NAME = a.ziel_name
    if a.ziel_beschreibung is not None:
        ZIEL_BESCHREIBUNG = a.ziel_beschreibung
    ALTE_NAMEN.update(n.strip().lower() for n in a.alter_name)

    if a.zuruecksetzen:
        plaene = plan_zuruecksetzen(a.zuruecksetzen, a.nur_profil)
        vorher = {}
    else:
        profile = profile_aus_datei(a.aus_datei) if a.aus_datei else alle_profile_online()
        vorher = {p["id"]: p for p in profile}
        plaene = plan_erstellen(profile, a.nur_profil)

    if not plaene:
        print(f"Nichts zu tun: keine Methode {sorted(ALTE_NAMEN)} in einer Zone mit {LAND}.")
        return

    os.makedirs(a.ausgabe_ordner, exist_ok=True)
    gesamt = 0
    for pl in plaene:
        v = ohne_info(pl["variables"])
        n = sum(len(z["methodDefinitionsToUpdate"])
                for lg in v["profile"]["locationGroupsToUpdate"] for z in lg["zonesToUpdate"])
        gesamt += n
        pid = v["id"].rsplit("/", 1)[-1]
        datei = os.path.join(a.ausgabe_ordner, f"variablen-{pid}.json")
        with open(datei, "w", encoding="utf-8") as f:
            json.dump(v, f, ensure_ascii=False, indent=2)
        print(f"- {pl['profil']['name'][:70]}: {n} Methoden -> {datei}")
    ziel = "alter Stand aus Backup" if a.zuruecksetzen else f"„{ZIEL_NAME}“"
    print(f"Plan: {gesamt} Methoden in {len(plaene)} Profilen -> {ziel}")

    if not a.anwenden:
        print("Probelauf: nichts geaendert. Mit --anwenden ausfuehren (Online-Modus).")
        return
    if a.aus_datei:
        sys.exit("--anwenden geht nur online (ohne --aus-datei).")

    fehler = 0
    for pl in plaene:
        v = ohne_info(pl["variables"])
        r = gql(MUTATION, v)["deliveryProfileUpdate"]
        if r["userErrors"]:
            fehler += 1
            print("FEHLER", v["id"], json.dumps(r["userErrors"], ensure_ascii=False))
            continue
        nachher = profil_laden_online(v["id"])
        ok_rest = (v["id"] not in vorher) or fingerprint(vorher[v["id"]]) == fingerprint(nachher)
        print(f"OK {v['id']} Version {r['profile']['version']}, DE-Namen jetzt "
              f"{sorted(de_namen(nachher))}, Preise/Bedingungen/andere Laender unveraendert: {ok_rest}")
        if not ok_rest:
            fehler += 1
        if a.nur_profil is None and len(plaene) > 1:
            time.sleep(1)
    sys.exit(1 if fehler else 0)


if __name__ == "__main__":
    main()
