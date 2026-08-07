#!/usr/bin/env python3
"""Sichert alle zum Löschen markierten Rückseiten-Fotos (Originalauflösung,
inhaltsdedupliziert per SHA-256) + Manifest für vollständige Wiederherstellung."""
import concurrent.futures
import hashlib
import json
import os
import subprocess
import time

ROOT = os.path.join(os.path.dirname(__file__), "..")
MANIFEST = os.path.join(ROOT, "manifest")
OUT = os.path.join(ROOT, "backup-backs")
os.makedirs(OUT, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"


def fetch(url, tries=4):
    for attempt in range(tries):
        try:
            return subprocess.run(["curl", "-sS", "--cacert", CA, url],
                                  capture_output=True, check=True).stdout
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(2 ** attempt)


def main():
    bc = json.load(open(os.path.join(MANIFEST, "back_class.json")))
    out_path = os.path.join(MANIFEST, "backs_backup.json")
    backup = json.load(open(out_path)) if os.path.exists(out_path) else {"media": {}, "files": {}}
    jobs = []
    for pid, p in bc.items():
        for mid, m in p["media"].items():
            if m["verdict"] == "delete" and mid not in backup["media"]:
                jobs.append((pid, p["handle"], mid, m["url"]))
    print(f"{len(jobs)} Rückseiten zu sichern")

    def work(job):
        pid, handle, mid, url = job
        raw = fetch(url)
        sha = hashlib.sha256(raw).hexdigest()
        return pid, handle, mid, url, sha, raw

    n = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        for pid, handle, mid, url, sha, raw in ex.map(work, jobs):
            fname = f"{sha}.jpg"
            fpath = os.path.join(OUT, fname)
            if sha not in backup["files"]:
                with open(fpath, "wb") as f:
                    f.write(raw)
                backup["files"][sha] = {"file": fname, "bytes": len(raw)}
            backup["media"][mid] = {"product": pid, "handle": handle, "url": url, "sha": sha}
            n += 1
            if n % 150 == 0:
                print(f"{n}...", flush=True)
                json.dump(backup, open(out_path, "w"), ensure_ascii=False)
    json.dump(backup, open(out_path, "w"), ensure_ascii=False, indent=1)
    total = sum(f["bytes"] for f in backup["files"].values())
    print(f"fertig: {len(backup['media'])} Medien, {len(backup['files'])} eindeutige Dateien, {total/1e6:.1f} MB")


if __name__ == "__main__":
    main()
