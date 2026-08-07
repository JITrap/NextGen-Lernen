"""Upload a file to a Shopify staged-upload target via curl through the proxy."""
import json, subprocess, sys

def upload(target: dict, filepath: str) -> str:
    cmd = ["curl", "-sS", "--cacert", "/root/.ccr/ca-bundle.crt", "-o", "/dev/null",
           "-w", "%{http_code}", "-X", "POST", target["url"]]
    for p in target["parameters"]:
        cmd += ["-F", f"{p['name']}={p['value']}"]
    cmd += ["-F", f"file=@{filepath}"]
    code = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip()
    if code not in ("200", "201", "204"):
        raise RuntimeError(f"upload failed with HTTP {code}")
    return target["resourceUrl"]

if __name__ == "__main__":
    target = json.load(open(sys.argv[1]))
    print(upload(target, sys.argv[2]))
