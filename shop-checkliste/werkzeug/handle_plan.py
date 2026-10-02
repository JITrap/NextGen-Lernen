"""Plant kurze deutsche Produkt-Handles (Stand 02.10.2026) und prueft die Regeln.
Aufruf: python3 shop-checkliste/werkzeug/handle_plan.py
Liest  shop-checkliste/daten/produkte-2026-10-02.json
Schreibt shop-checkliste/arbeit-2026-10-02/urls/handle-plan.json
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "daten/produkte-2026-10-02.json"
OUT = ROOT / "arbeit-2026-10-02/urls/handle-plan.json"

# Produkt-ID -> neuer Handle. Grundsatz: Motivname + Art aus dem deutschen Titel,
# 3-6 Woerter, keine Fuellwoerter (framed, wall-art, vertical ...).
# Bereits kurze, saubere Handles bleiben unveraendert (KEEP).
NEU = {
 "10753336901965": "vintage-formel-1-racing-poster",
 "10754859041101": "yacht-auf-offener-see-poster",
 "10754905014605": "the-world-rewards-action-space-poster",
 "10755130753357": "make-them-wonder-messi-poster",
 "10755131310413": "become-unstoppable-motivationsposter",
 "10755131834701": "stay-focused-stay-dangerous-fitness-poster",
 "10755132391757": "start-unknown-finish-unforgettable-poster",
 "10755132883277": "set-your-own-standard-motivationsposter",
 "10755133407565": "sacrifice-today-own-tomorrow-boxing-poster",
 "10755133997389": "no-excuses-just-results-motivationsposter",
 "10755134456141": "money-follows-value-office-poster",
 "10755135242573": "stay-hungry-gym-poster",
 "10755470229837": "prove-yourself-right-motivationsposter",
 "10755472097613": "hard-way-builds-the-strongest-poster",
 "10755473211725": "the-goal-never-moves-fussball-poster",
 "10755474063693": "your-dreams-need-you-fussball-poster",
 "10761700245837": "dont-quit-motivationsposter",
 "10761701163341": "a-lot-can-happen-poster",
 "10761777480013": "pressure-makes-diamonds-motivationsposter",
 "10761809199437": "dont-wait-to-be-happy-poster",
 "10761842360653": "la-dolce-vita-italien-poster",
 "10761878536525": "just-do-it-aviation-poster",
 "10761912746317": "you-were-born-an-original-poster",
 "10761913172301": "you-vs-you-berg-poster",
 "10761946267981": "whatever-it-takes-portrait-poster",
 "10762022322509": "work-so-hard-motivationsposter",
 "10762023567693": "i-always-win-motivationsposter",
 "10762093166925": "believe-in-yourself-pokal-poster",
 "10762095624525": "i-win-motivationsposter",
 "10762128752973": "i-dont-know-how-gym-poster",
 "10762173546829": "just-do-some-creative-shits-poster",
 "10762173645133": "only-limit-is-your-mind-poster",
 "10762173677901": "no-risk-no-story-foto-poster",
 "10762173743437": "never-too-late-lock-in-poster",
 "10762174300493": "jaguar-in-blueten-wildlife-poster",
 "10762174660941": "schwanensee-aquarell-poster",
 "10762174923085": "haie-vor-der-kueste-poster",
 "10762175447373": "dobermann-unter-schafen-poster",
 "10762176790861": "vintage-sportwagen-pferd-retro-poster",
 "10762178003277": "pferd-oldtimer-surreal-poster",
 "10762179182925": "vintage-porsche-karussellpferd-poster",
 "10762180460877": "dressurpferd-equestrian-poster",
 "10762181378381": "leopard-auf-ast-schwarz-weiss-poster",
 "10762186391885": "leopard-auf-ast-minimal-poster",
 "10762187505997": "KEEP",  # go-get-that-dream-leopard-poster
 "10762192781645": "ferrari-weisser-hengst-poster",
 "10762193961293": "watching-eyes-money-poster",
 "10762195927373": "marlboro-f1-racing-poster",
 "10762196123981": "the-world-is-yours-poster",
 "10787875193165": "wimbledon-von-oben-tennis-poster",
 "10787875389773": "class-intensity-grit-tennis-poster",
 "10787875520845": "tennis-court-aerial-poster",
 "10787875553613": "green-court-von-oben-tennis-poster",
 "10787889545549": "always-be-better-golf-poster",
 "10787889611085": "risk-better-than-regret-tennis-poster",
 "10787889643853": "discipline-gym-poster",
 "10787889742157": "be-different-jordan-basketball-poster",
 "10787889938765": "luke-1-37-faith-poster",
 "10787889971533": "if-you-quit-fussball-poster",
 "10787890233677": "all-or-nothing-fussball-poster",
 "10787890299213": "no-risk-no-story-basketball-poster",
 "10787890331981": "KEEP",  # in-god-we-trust-basketball-poster
 "10787890397517": "no-risk-no-porsche-retro-poster",
 "10787890430285": "self-respect-vintage-poster",
 "10787890463053": "fuck-them-all-street-art-poster",
 "10787890495821": "perfect-time-never-comes-world-poster",
 "10787890528589": "money-talks-franklin-poster",
 "10787890626893": "monochrome-player-fussball-poster",
 "10787890659661": "tutto-passa-vintage-poster",
 "10787890692429": "pressure-is-a-privilege-poster",
 "10787970908493": "discipline-fussball-poster",
 "10787973923149": "signed-icon-portrait-poster",
 "10787975987533": "its-more-than-football-poster",
 "10787976347981": "where-we-came-from-space-poster",
 "10787976675661": "race-track-loop-poster",
 "10787977298253": "scuderia-ferrari-f1-poster",
 "10787978117453": "neymar-cristiano-messi-legenden-poster",
 "10787980312909": "jesus-headband-portrait-poster",
 "10787980640589": "world-cup-moment-fussball-poster",
 "10787981263181": "messi-portrait-schwarz-weiss-poster",
 "10787981754701": "goat-vintage-portrait-poster",
 "10787984113997": "focus-on-you-panther-poster",
 "10787984539981": "your-only-limit-floral-poster",
 "10787986669901": "whats-behind-you-racing-poster",
 "10787988308301": "god-is-with-me-faith-poster",
 "10787990929741": "they-overlooked-me-racing-poster",
 "10787992240461": "KEEP",  # trust-god-poster
 "10787993846093": "KEEP",  # red-icon-music-poster
 "10787994992973": "not-over-until-i-win-poster",
 "10787996598605": "whatever-it-takes-typo-poster",
 "10787998400845": "crystal-ok-art-poster",
 "10788000563533": "focus-gym-poster",
 "10788002595149": "red-graffiti-portrait-poster",
 "10788002824525": "do-it-alone-fussball-poster",
 "10788004168013": "signature-minimal-portrait-poster",
 "10788005445965": "its-you-vs-you-ronaldo-poster",
 "10788006920525": "no-risk-no-story-racing-poster",
 "10788044996941": "we-aint-rich-yet-poster",
 "10788045390157": "perfect-time-never-comes-trader-poster",
 "10895204450637": "red-retro-musik-poster",
 "10895207989581": "life-is-tough-motivationsposter",
 "10895277588813": "nobody-is-coming-racing-poster",
 "10895312552269": "what-a-privilege-tennis-poster",
 "10895346762061": "born-to-win-panther-poster",
 "10895383134541": "leopard-mit-perlenkette-poster",
 "10895417704781": "matchday-von-oben-tennis-poster",
 "10895454175565": "winning-isnt-for-everyone-medaillen-poster",
 "10895456305485": "tiger-im-pool-vintage-poster",
 "10895490449741": "focus-skulptur-poster",
 "10895531114829": "queens-dont-compete-leoparden-poster",
 "10908050293069": "designer-heels-fashion-poster",
 "10908064874829": "noir-pistole-perlen-poster",
 "10908072968525": "batman-silhouette-red-noir-poster",
}
VERBOTEN = {"framed", "wall", "art-print", "vertical", "horizontal", "print", "decor", "motivational", "inspirational"}

def main():
    prods = json.load(open(SRC))
    alt = {p["id"].split("/")[-1]: p for p in prods}
    fehler = []
    if set(alt) != set(NEU):
        fehler.append(f"ID-Abweichung: fehlt {set(alt)-set(NEU)}, zuviel {set(NEU)-set(alt)}")
    plan = []
    for pid, p in alt.items():
        neu = NEU.get(pid, "KEEP")
        if neu == "KEEP":
            neu = p["handle"]
        w = neu.split("-")
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", neu): fehler.append(f"Zeichen: {neu}")
        if len(neu) > 50: fehler.append(f"zu lang ({len(neu)}): {neu}")
        if not 3 <= len(w) <= 6: fehler.append(f"Wortzahl {len(w)}: {neu}")
        if VERBOTEN & set(w): fehler.append(f"Fuellwort: {neu}")
        plan.append({"id": p["id"], "titel": p["title"], "alt": p["handle"], "neu": neu,
                     "aendern": neu != p["handle"]})
    neue = [x["neu"] for x in plan]
    dup = {h for h in neue if neue.count(h) > 1}
    if dup: fehler.append(f"Dubletten: {dup}")
    # Kollision: neuer Handle == alter Handle eines ANDEREN Produkts
    alte = {x["alt"]: x["id"] for x in plan}
    for x in plan:
        if x["neu"] in alte and alte[x["neu"]] != x["id"]:
            fehler.append(f"Kollision mit bestehendem Handle: {x['neu']}")
    if fehler:
        print("\n".join(fehler)); sys.exit(1)
    OUT.write_text(json.dumps(plan, ensure_ascii=False, indent=1))
    n = sum(x["aendern"] for x in plan)
    print(f"OK: {len(plan)} Produkte, {n} neue Handles, {len(plan)-n} unveraendert, "
          f"max Laenge {max(map(len, neue))}")

if __name__ == "__main__":
    main()
