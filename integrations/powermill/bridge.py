"""RMT PowerMill bridge: Python 3.11+, Windows + pywin32; standard-library HTTP.
COM stays on the single server thread (STA). No arbitrary command/file endpoint.
"""
import argparse
import hmac
import json
import math
from pathlib import Path
import re
import secrets
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from uuid import uuid4

API_VERSION = 1
MAX_BODY = 2 * 1024 * 1024
DEFAULT_ORIGIN = "https://real-machine-tools.marcel-bucala.workers.dev"
NC_EXTENSIONS = {".nc", ".h", ".tap", ".cnc", ".ngc", ".iso", ".gcode", ".mpf", ".txt", ".eia", ".ptp"}


class BridgeError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def safe_name(value):
    if not isinstance(value, str) or not value or len(value) > 160 or any(c in value for c in "'\"/\\\r\n\x00") or any(ord(c) < 32 for c in value):
        raise BridgeError("Unsupported PowerMill entity name; rename it without quotes, slashes or control characters.")
    return value


def number(value):
    n = float(str(value).strip())
    if not math.isfinite(n):
        raise ValueError("Non-finite PowerMill value")
    return n


def validate_tool(raw):
    if not isinstance(raw, dict):
        raise BridgeError("Invalid tool")
    result = {}
    for key in ("t", "d", "cr", "l", "lc", "s", "dh", "z", "tip"):
        try:
            if isinstance(raw.get(key), bool):
                raise ValueError()
            result[key] = number(raw[key])
        except (KeyError, TypeError, ValueError):
            raise BridgeError(f"Invalid tool field: {key}")
    ranges = {"t": (1, 9999), "d": (.5, 80), "cr": (0, result['d'] / 2), "l": (40, 300), "lc": (.5, 300), "s": (1, 275), "dh": (20, 80), "z": (1, 12), "tip": (30, 160)}
    for key, (low, high) in ranges.items():
        if not low <= result[key] <= high or (key in ("t", "z") and not result[key].is_integer()):
            raise BridgeError(f"Tool field out of range: {key}")
    kind = raw.get("kind")
    if kind not in ("mill", "cone") or (kind == "cone" and result['cr'] != 0):
        raise BridgeError("Unsupported tool kind / corner radius")
    minimum = result['d'] / 2 / math.tan(math.radians(result['tip'] / 2)) if kind == "cone" else result['cr']
    if not minimum <= result['lc'] + 1e-6 or not result['lc'] <= result['s'] <= result['l'] - 25:
        raise BridgeError("Inconsistent cutter, stick-out and gauge dimensions")
    result['kind'] = kind
    return result


def tool_commands(raw, name):
    """Create a NEW tool. Cutter length=LC; shank bridges LC..S; generic holder=L-S.
    The generic cylindrical holder is not a native, calibrated HSK assembly.
    """
    t = validate_tool(raw)
    safe_name(name)
    kind = 'DRILL' if t['kind'] == 'cone' else 'BALLNOSED' if t['cr'] == t['d'] / 2 else 'TIPRADIUSED' if t['cr'] else 'ENDMILL'
    fmt = lambda value: format(value, '.12g')
    edit = lambda field, value: f'EDIT TOOL "{name}" {field} {fmt(value)}'
    commands = [f'CREATE TOOL "{name}" {kind}', edit('DIAMETER', t['d']), edit('LENGTH', t['lc']), edit('NUMBER', t['t']), edit('NUM_FLUTES', t['z'])]
    if kind == 'DRILL':
        commands.append(edit('TAPERANGLE', t['tip']))
    if kind == 'TIPRADIUSED':
        commands.append(edit('TIPRADIUS', t['cr']))
    if t['s'] > t['lc']:
        commands += [f'EDIT TOOL "{name}" SHANK_COMPONENT ADD', edit('SHANK_COMPONENT UPPERDIA', min(t['d'], 20)), edit('SHANK_COMPONENT LOWERDIA', min(t['d'], 20)), edit('SHANK_COMPONENT LENGTH', t['s'] - t['lc'])]
    commands += [f'EDIT TOOL "{name}" HOLDER_COMPONENT ADD', edit('HOLDER_COMPONENT UPPERDIAM', t['dh']), edit('HOLDER_COMPONENT LOWERDIA', t['dh']), edit('HOLDER_COMPONENT LENGTH', t['l'] - t['s']), edit('OVERHANG', t['s']), 'TOOL ACCEPT']
    return commands


class PowerMill:
    def __init__(self, app, variant_factory):
        self.app = app
        self.variant_factory = variant_factory

    def query(self, command):
        response = self.variant_factory()
        try:
            self.app.DoCommandEx(command, response)
        except Exception:
            raise BridgeError('PowerMill rejected the COM request. Close modal dialogs and check parameter support in this version.', 409)
        value = str('' if response.value is None else response.value).strip().strip('"')
        if '#ERROR' in value.upper():
            raise BridgeError("PowerMill rejected a parameter query: " + command, 409)
        return value

    def param(self, entity, name, key):
        safe_name(name)
        return self.query(f'PRINT PAR TERSE "entity(\'{entity}\', \'{name}\').{key}"')

    def ready(self):
        if self.app.Busy:
            raise BridgeError("PowerMill is busy. Finish the current calculation or dialog and retry.", 409)

    def units(self):
        value = self.query("PRINT PAR TERSE 'Units'").lower()
        if value == 'imperial':
            return 'inch'
        if value in ('metric', 'mm'):
            return 'mm'
        raise BridgeError("Unrecognised PowerMill project units: " + value, 409)

    def snapshot(self):
        self.ready()
        units = self.units()
        scale = 25.4 if units == 'inch' else 1
        tools, warnings = [], []
        for index, entity in enumerate(self.app.Project.Tools):
            if index >= 500:
                warnings.append('Only the first 500 tools are listed.')
                break
            name = str(entity.Name)
            try:
                safe_name(name)
                kind = self.param('tool', name, 'type')
                supported = {'end_mill': ('mill', 'flat'), 'ball_nosed': ('mill', 'ball'), 'tip_radiused': ('mill', 'bull'), 'drill': ('cone', 'drill')}
                if kind not in supported:
                    warnings.append(f'{name}: unsupported PowerMill type {kind}; import manually.')
                    continue
                data = {'name': name, 'kind': supported[kind][0], 'shape': supported[kind][1]}
                for field, key in {'t': 'number', 'd': 'diameter', 'lc': 'length', 's': 'overhang', 'z': 'flutes'}.items():
                    try:
                        value = number(self.param('tool', name, key))
                        data[field] = round(value * (1 if field in ('t', 'z') else scale), 6)
                    except (ValueError, BridgeError):
                        warnings.append(f'{name}: {key} unavailable; verify in editor.')
                data['cr'] = data.get('d', 0) / 2 if kind == 'ball_nosed' else 0
                if kind == 'tip_radiused':
                    data['cr'] = number(self.param('tool', name, 'tipradius')) * scale
                if kind == 'drill':
                    data['tip'] = number(self.param('tool', name, 'drillangle'))
                if not isinstance(data.get('t'), (int, float)) or not 1 <= data['t'] <= 9999 or not data['t'].is_integer():
                    warnings.append(f'{name}: assign an integer tool number 1–9999 in PowerMill before importing.')
                    continue
                # Gauge L and HSK holder geometry cannot be inferred from cutter Length.
                tools.append(data)
            except (BridgeError, ValueError) as error:
                warnings.append(f'{name}: {error}')
        nc = [{'name': str(e.Name)} for index, e in enumerate(self.app.Project.NCPrograms) if index < 500]
        return {'tools': tools, 'ncPrograms': nc, 'sourceUnits': units, 'units': 'mm', 'warnings': warnings}

    def create_tool(self, raw):
        self.ready()
        if self.units() != 'mm':
            raise BridgeError('Tool creation requires a millimetre PowerMill project. Project units were not changed.', 409)
        tool = validate_tool(raw)
        name = f"RMT_T{int(tool['t'])}_{uuid4().hex[:12]}"
        commands = tool_commands(tool, name)
        try:
            for command in commands:
                # Use DoCommandEx so parameter/macro errors are returned, not hidden.
                self.query(command)
            # Do not claim success when the intended values were rejected silently.
            expected_type = 'drill' if tool['kind'] == 'cone' else 'ball_nosed' if tool['cr'] == tool['d'] / 2 else 'tip_radiused' if tool['cr'] else 'end_mill'
            if self.param('tool', name, 'type') != expected_type:
                raise BridgeError('PowerMill read-back differs: type', 409)
            checks = [('diameter', 'd'), ('length', 'lc'), ('overhang', 's'), ('number', 't'), ('flutes', 'z')]
            if expected_type == 'drill': checks.append(('drillangle', 'tip'))
            if expected_type == 'tip_radiused': checks.append(('tipradius', 'cr'))
            for key, field in checks:
                if abs(number(self.param('tool', name, key)) - tool[field]) > 1e-4:
                    raise BridgeError('PowerMill read-back differs: ' + key, 409)
        except Exception as error:
            raise BridgeError(f'Creation did not finish. Inspect the new entity {name} in PowerMill before retrying. {error}', 409)
        return {'name': name, 'warning': 'New tool created; generic cylindrical holder only. Verify gauge length, HSK assembly and tool geometry in PowerMill. Existing tools and toolpaths were not replaced.'}

    def nc(self, name, root):
        self.ready()
        if root is None:
            raise BridgeError('Start the bridge with --nc-root pointing to your NC output folder.', 409)
        safe_name(name)
        # The browser supplies an entity name, never a local file path or command.
        filename = self.param('ncprogram', name, 'FileName')
        path = Path(filename)
        if not path.is_absolute():
            path = root / path
        path = path.resolve()
        if not path.is_relative_to(root) or path.suffix.lower() not in NC_EXTENSIONS or not path.is_file():
            raise BridgeError('Post-process the selected NC program into the configured --nc-root folder first.', 409)
        if path.stat().st_size > MAX_BODY:
            raise BridgeError('NC output exceeds 2 MB.', 413)
        data = path.read_bytes()
        try:
            text = data.decode('utf-8-sig')
        except UnicodeDecodeError:
            text = data.decode('cp1252')
        return {'name': path.name, 'text': text}


def connect_powermill():
    # Deliberately attach to an existing desktop instance; never start/close/reset it.
    import pythoncom
    import win32com.client
    app = win32com.client.GetActiveObject('PowerMILL.Application')
    return PowerMill(app, lambda: win32com.client.VARIANT(pythoncom.VT_BYREF | pythoncom.VT_VARIANT, None))


class BridgeServer(HTTPServer):
    def __init__(self, address, token, origins, adapter=connect_powermill, nc_root=None):
        super().__init__(address, Handler)
        self.token, self.origins, self.adapter = token, set(origins), adapter
        self.nc_root = Path(nc_root).resolve() if nc_root else None


class Handler(BaseHTTPRequestHandler):
    server_version = 'RMT-PowerMill/1'

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *args):
        pass  # Never log pairing tokens, query strings or local project names.

    def allowed(self, auth=True):
        port = self.server.server_port
        if self.headers.get('Host') not in (f'127.0.0.1:{port}', f'localhost:{port}'):
            raise BridgeError('Invalid Host', 403)
        if self.headers.get('Origin') not in self.server.origins:
            raise BridgeError('Origin not allowed', 403)
        if auth and not hmac.compare_digest(self.headers.get('Authorization', '').encode('utf-8'), ('Bearer ' + self.server.token).encode('ascii')):
            raise BridgeError('Invalid pairing token', 401)

    def reply(self, status, payload):
        data = json.dumps(payload, allow_nan=False).encode('utf-8')
        self.send_response(status)
        if self.headers.get('Origin') in self.server.origins:
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Vary', 'Origin')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        try:
            self.allowed(auth=False)
            if self.headers.get('Access-Control-Request-Method') not in ('GET', 'POST'):
                raise BridgeError('Method not allowed', 405)
            requested = {x.strip().lower() for x in self.headers.get('Access-Control-Request-Headers', '').split(',') if x.strip()}
            if not requested.issubset({'authorization', 'content-type'}):
                raise BridgeError('Headers not allowed', 403)
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.send_header('Content-Length', '0')
            self.end_headers()
        except BridgeError as error:
            self.reply(error.status, {'error': str(error)})

    def body(self):
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json' or self.headers.get('Transfer-Encoding'):
            raise BridgeError('Expected application/json', 415)
        try:
            length = int(self.headers.get('Content-Length', '-1'))
        except ValueError:
            raise BridgeError('Invalid content length')
        if not 0 <= length <= MAX_BODY:
            raise BridgeError('Request exceeds 2 MB', 413)
        try:
            body = json.loads(self.rfile.read(length), parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        except (ValueError, UnicodeDecodeError):
            raise BridgeError('Invalid JSON')
        if not isinstance(body, dict):
            raise BridgeError('Expected a JSON object')
        return body

    def dispatch(self, method):
        try:
            self.allowed()
            body = self.body() if method == 'POST' else {}
            if (method, self.path) not in {('GET', '/v1/status'), ('GET', '/v1/snapshot'), ('POST', '/v1/nc'), ('POST', '/v1/tools')}:
                raise BridgeError('Unknown endpoint', 404)
            try:
                pm = self.server.adapter()
                if self.path == '/v1/status':
                    result = {'connected': True, 'busy': bool(pm.app.Busy)}
                elif self.path == '/v1/snapshot':
                    result = pm.snapshot()
                elif self.path == '/v1/nc':
                    result = pm.nc(body.get('name'), self.server.nc_root)
                else:
                    result = pm.create_tool(body.get('tool'))
            except BridgeError:
                raise
            except Exception:
                raise BridgeError('Cannot access PowerMill COM. Open PowerMill under the same Windows user and privilege level, close modal dialogs, then retry.', 503)
            self.reply(200, {'bridge': 'rmt-powermill', 'version': API_VERSION, **result})
        except BridgeError as error:
            self.reply(error.status, {'error': str(error)})
        except Exception:
            self.reply(500, {'error': 'Bridge request failed. Check the local Windows bridge.'})

    def do_GET(self):
        self.dispatch('GET')

    def do_POST(self):
        self.dispatch('POST')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--nc-root', help='Only read existing NC outputs from this folder (including subfolders).')
    parser.add_argument('--origin', action='append', default=[DEFAULT_ORIGIN], help='Additional exact web origin, e.g. http://127.0.0.1:5173')
    args = parser.parse_args()
    if sys.platform != 'win32':
        parser.error('Run this bridge on the Windows computer with PowerMill installed.')
    import pythoncom
    pythoncom.CoInitialize()
    token = secrets.token_urlsafe(32)
    try:
        with BridgeServer(('127.0.0.1', 8766), token, args.origin, nc_root=args.nc_root) as server:
            print('RMT PowerMill bridge: http://127.0.0.1:8766', flush=True)
            print('Pairing token (paste into the application): ' + token, flush=True)
            print('Keep this window open. Ctrl+C disconnects the bridge.', flush=True)
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        pythoncom.CoUninitialize()


if __name__ == '__main__':
    main()
