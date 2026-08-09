#!/usr/bin/env python3
import json, os, re

BASE = "/home/user/NextGen-Lernen/tools/design-recherche"

def load_ii(path):
    d = json.load(open(path))
    pages = d.get("query", {}).get("pages", {})
    for pid, p in pages.items():
        ii = p.get("imageinfo")
        if not ii:
            return None
        info = ii[0]
        meta = info.get("extmetadata", {})
        def g(k):
            v = meta.get(k, {})
            return v.get("value", "") if isinstance(v, dict) else ""
        artist_raw = g("Artist")
        # strip HTML tags roughly
        artist = re.sub(r"<[^>]+>", "", artist_raw).strip()
        return {
            "title": p.get("title"),
            "url": info.get("url").split("?")[0],
            "width": info.get("width"),
            "height": info.get("height"),
            "license": g("LicenseShortName"),
            "artist": artist,
            "credit": re.sub(r"<[^>]+>", "", g("Credit")).strip(),
        }
    return None

# map: item imageinfo file -> final nr
mapping = {
    1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9, 10:10, 11:11, 12:12,
    13:13, 14:14, 15:15, 16:16, 17:19, 18:20, 19:21, 20:22, 21:23, 22:24,
    23:25, 24:26, 25:27,
}

results = {}
for i, nr in mapping.items():
    path = f"{BASE}/imageinfo/item_{i:02d}.json"
    info = load_ii(path)
    if info is None:
        print(f"WARN: no info for item {i}")
        continue
    results[nr] = info

# whippet -> nr 28
w = load_ii(f"{BASE}/imageinfo/item_27_whippet.json")
results[28] = w

# Met items (17, 18) added manually
results[17] = {
    "title": "Still Life with Oysters, a Silver Tazza, and Glassware",
    "url": "https://images.metmuseum.org/CRDImages/ep/original/DP120415.jpg",
    "width": None, "height": None,
    "license": "Public Domain (Met Open Access)",
    "artist": "Willem Claesz Heda, 1635",
    "credit": "The Metropolitan Museum of Art",
}
results[18] = {
    "title": "The Brioche",
    "url": "https://images.metmuseum.org/CRDImages/ep/original/DP-13655-001.jpg",
    "width": None, "height": None,
    "license": "Public Domain (Met Open Access)",
    "artist": "Edouard Manet, 1870",
    "credit": "The Metropolitan Museum of Art",
}

out = json.dumps(results, indent=2, ensure_ascii=False)
open(f"{BASE}/scripts/resolved_urls.json", "w").write(out)
print(f"Resolved {len(results)} / 28 items")
for nr in sorted(results):
    r = results[nr]
    print(nr, r["width"], "x", r["height"], "-", r["url"])
