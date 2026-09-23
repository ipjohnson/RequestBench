"""Writes Client/openapi.json with document.py, then Kiota's Python client from it to Client/Kiota.

Starlette's documentation recommends no client generator, so the client is Kiota's. No Kiota runs
from PyPI, so this downloads the pinned release for this platform from Kiota's GitHub releases and
checks it against the SHA-256 that Microsoft's @microsoft/kiota 1.35.0 package carries for it, as
that package does. The binary is kept under Client/bin/, which git ignores, and reused. Kiota's
Linux build needs libicu, and running it with invariant globalization writes Python that does not
parse (Kiota issue 4600). Only the standard library is used.
"""
import hashlib
import io
import os
import platform
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

VERSION = "1.35.0"
# From @microsoft/kiota 1.35.0's dist/runtime.json.
SHA256 = {
    "linux-arm64": "C542EF1B71C24912A002BE87EAB7CBFEFEA324B14EB353162A4B55B879E6925C",
    "linux-x64": "8CA042683665F48CC6DF1CBE6FF2C850D18F74AD0A1035A406EB486E192F50BC",
    "osx-arm64": "BD50A566DBCD2BD10F4EF4A919276DD193202DCED990FB5D16D83B68030E2063",
    "osx-x64": "67FA0DD2A2D783BA52B504E115B2AF029780AEF3894617E303C1405A819D9450",
    "win-x64": "66B5547B948F7BE724FA5E0DDDDEBDA8F7B662574AE58EB9D3B8C51C609C6271",
}

CLIENT = Path(__file__).resolve().parent


def platform_id() -> str:
    system = {"darwin": "osx", "linux": "linux", "win32": "win"}[sys.platform]
    machine = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "x64", "amd64": "x64"}[platform.machine().lower()]
    return f"{system}-{machine}"


def kiota() -> Path:
    """The pinned Kiota binary, downloaded and checked the first time."""
    rid = platform_id()
    home = CLIENT / "bin" / f"kiota-{VERSION}-{rid}"
    binary = home / ("kiota.exe" if rid.startswith("win") else "kiota")
    if binary.exists():
        return binary
    url = f"https://github.com/microsoft/kiota/releases/download/v{VERSION}/{rid}.zip"
    with urllib.request.urlopen(url) as response:
        archive = response.read()
    digest = hashlib.sha256(archive).hexdigest()
    if digest != SHA256[rid].lower():
        sys.exit(f"{url} has SHA-256 {digest}, expected {SHA256[rid].lower()}")
    shutil.rmtree(home, ignore_errors=True)
    zipfile.ZipFile(io.BytesIO(archive)).extractall(home)
    binary.chmod(0o755)
    return binary


subprocess.run([sys.executable, str(CLIENT / "document.py")], check=True)
subprocess.run(
    [str(kiota()), "generate", "--language", "python", "--openapi", "openapi.json", "--output", "Kiota",
     "--class-name", "StarletteClient", "--namespace-name", "kiota_client", "--exclude-backward-compatible",
     "--clean-output"],
    cwd=CLIENT, check=True, env={**os.environ, "KIOTA_TUTORIAL_ENABLED": "false"},
)
# Kiota writes its warnings to a log beside the client as well as to the console.
(CLIENT / "Kiota" / ".kiota.log").unlink(missing_ok=True)
