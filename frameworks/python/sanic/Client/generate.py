"""Writes the OpenAPI document and the Kiota client generated from it.

Sanic's documentation recommends no client generator, so the client is Kiota's, in Python. No Kiota
is published to PyPI, so this downloads the release Microsoft's own npm package pins, 1.35.0, for
this machine, checks the SHA-256 that package carries for it, and keeps it under Client/bin/, which
git ignores. Standard library only, run with `uv run` so document.py has the application's
packages.
"""
import hashlib
import platform
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

CLIENT = Path(__file__).resolve().parent
VERSION = "1.35.0"
# From dist/runtime.json in @microsoft/kiota 1.35.0 on npm.
SHA256 = {
    "osx-arm64": "BD50A566DBCD2BD10F4EF4A919276DD193202DCED990FB5D16D83B68030E2063",
    "osx-x64": "67FA0DD2A2D783BA52B504E115B2AF029780AEF3894617E303C1405A819D9450",
    "linux-x64": "8CA042683665F48CC6DF1CBE6FF2C850D18F74AD0A1035A406EB486E192F50BC",
    "linux-arm64": "C542EF1B71C24912A002BE87EAB7CBFEFEA324B14EB353162A4B55B879E6925C",
    "win-x64": "66B5547B948F7BE724FA5E0DDDDEBDA8F7B662574AE58EB9D3B8C51C609C6271",
}


def platform_id() -> str:
    system = {"Darwin": "osx", "Linux": "linux", "Windows": "win"}[platform.system()]
    machine = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "x64", "AMD64": "x64"}[platform.machine()]
    return f"{system}-{machine}"


def kiota() -> Path:
    """The Kiota binary for this machine, downloaded and checked the first time."""
    rid = platform_id()
    home = CLIENT / "bin" / f"kiota-{VERSION}-{rid}"
    binary = home / ("kiota.exe" if rid.startswith("win") else "kiota")
    if binary.exists():
        return binary
    archive = CLIENT / "bin" / f"kiota-{VERSION}-{rid}.zip"
    archive.parent.mkdir(exist_ok=True)
    url = f"https://github.com/microsoft/kiota/releases/download/v{VERSION}/{rid}.zip"
    with urllib.request.urlopen(url) as download, archive.open("wb") as out:
        shutil.copyfileobj(download, out)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest().upper()
    if digest != SHA256[rid]:
        archive.unlink()
        sys.exit(f"{url} has SHA-256 {digest}, expected {SHA256[rid]}")
    with zipfile.ZipFile(archive) as zipped:
        zipped.extractall(home)
    archive.unlink()
    binary.chmod(0o755)
    return binary


subprocess.run([sys.executable, str(CLIENT / "document.py")], check=True)
subprocess.run(
    [str(kiota()), "generate", "--language", "python", "--openapi", "openapi.json", "--output", "Kiota",
     "--class-name", "SanicClient", "--namespace-name", "Kiota", "--exclude-backward-compatible", "--clean-output"],
    cwd=CLIENT, check=True,
)
# Kiota's log of its warnings, which name the document by its full path on this machine.
(CLIENT / "Kiota" / ".kiota.log").unlink(missing_ok=True)
