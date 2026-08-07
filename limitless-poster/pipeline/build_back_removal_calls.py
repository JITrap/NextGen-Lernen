#!/usr/bin/env python3
"""Erzeugt die GraphQL-Aufrufe für das Entfernen der Rückseiten-Fotos
(vom User beauftragt; vollständiges Backup liegt unter backup-backs/
und auf dem Branch limitless-poster-assets-v2)."""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest")


def main():
    bc = json.load(open(os.path.join(MANIFEST, "back_class.json")))
    prods = []
    for pid, p in bc.items():
        ids = [mid for mid, m in p["media"].items() if m["verdict"] == "delete"]
        if ids:
            prods.append((pid, ids))
    total = sum(len(i) for _, i in prods)
    print(f"Produkte: {len(prods)}, Medien: {total}")
    calls = []
    for i in range(0, len(prods), 20):
        chunk = prods[i:i + 20]
        parts = []
        for j, (pid, ids) in enumerate(chunk):
            idl = ", ".join(f'"{m}"' for m in ids)
            parts.append(
                f'd{j}: productDeleteMedia(productId: "{pid}", mediaIds: [{idl}]) '
                "{ deletedMediaIds mediaUserErrors { field message } }"
            )
        calls.append("mutation {\n" + "\n".join(parts) + "\n}")
    for k, c in enumerate(calls, 1):
        with open(os.path.join(MANIFEST, f"del_call_{k:02d}.graphql"), "w") as f:
            f.write(c)
    print(f"{len(calls)} Aufrufe geschrieben, Längen: {[len(c) for c in calls]}")


if __name__ == "__main__":
    main()
