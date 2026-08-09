#!/usr/bin/env python3
"""Fetch Wikimedia Commons file info (direct URL, dimensions, license) for given File: titles."""
import sys, json, urllib.request, urllib.parse

def fetch(titles):
    base = "https://commons.wikimedia.org/w/api.php"
    params = {
        "action": "query",
        "titles": "|".join(titles),
        "prop": "imageinfo",
        "iiprop": "url|size|extmetadata|mime",
        "iiurlwidth": "2000",
        "format": "json",
    }
    url = base + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "design-research-bot/1.0 (contact: research@example.com)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    pages = data.get("query", {}).get("pages", {})
    out = []
    for pid, page in pages.items():
        title = page.get("title")
        ii = page.get("imageinfo")
        if not ii:
            out.append({"title": title, "error": "no imageinfo"})
            continue
        info = ii[0]
        meta = info.get("extmetadata", {})
        def g(k):
            v = meta.get(k, {})
            return v.get("value", "") if isinstance(v, dict) else ""
        out.append({
            "title": title,
            "url": info.get("url"),
            "width": info.get("width"),
            "height": info.get("height"),
            "mime": info.get("mime"),
            "artist": g("Artist"),
            "license_short": g("LicenseShortName"),
            "credit": g("Credit"),
            "restrictions": g("Restrictions"),
            "description": g("ImageDescription")[:150],
        })
    return out

if __name__ == "__main__":
    titles = sys.argv[1:]
    result = fetch(titles)
    print(json.dumps(result, indent=2, ensure_ascii=False))
