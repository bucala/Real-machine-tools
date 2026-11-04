"""Build the deterministic downloadable Windows bridge from reviewed source files."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent
output = root.parent.parent / 'static' / 'rmt-powermill-bridge.zip'
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in ('README.md', 'bridge.py', 'requirements-windows.txt', 'start.cmd'):
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        data = (root / name).read_bytes()
        if name.endswith('.cmd'): data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
        archive.writestr(info, data)
print(output)
