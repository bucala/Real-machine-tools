"""Contract/HTTP tests using a fake COM object, not a PowerMill installation."""
import http.client
import json
from pathlib import Path
import tempfile
from threading import Thread
from types import SimpleNamespace
import unittest
import zipfile

from bridge import BridgeError, BridgeServer, DEFAULT_ORIGIN, PowerMill, safe_name, tool_commands

TOKEN = 'test_token_only_12345678901234567890'
TOOL = {'t': 3, 'kind': 'mill', 'd': 10, 'cr': 0, 'l': 115, 'lc': 25, 's': 48, 'dh': 32, 'z': 3, 'tip': 118}


class FakeCom:
    Busy = False

    def __init__(self, units='metric'):
        self.units = units
        self.commands = []
        self.values = {'type': 'end_mill', 'number': '3', 'diameter': '10', 'length': '25', 'overhang': '48', 'flutes': '3'}
        self.Project = SimpleNamespace(Tools=[SimpleNamespace(Name='Mill10')], NCPrograms=[SimpleNamespace(Name='Program1')])

    def DoCommandEx(self, command, response):
        self.commands.append(command)
        if command == "PRINT PAR TERSE 'Units'":
            response.value = self.units
        elif command.startswith('PRINT PAR'):
            response.value = self.values[command.rsplit('.', 1)[1].rstrip('"')]
        else:
            response.value = ''


def pm(com=None):
    return PowerMill(com or FakeCom(), lambda: SimpleNamespace(value=None))


class ComMappingTests(unittest.TestCase):
    def test_snapshot_reads_supported_fields_but_does_not_invent_gauge_or_holder(self):
        data = pm().snapshot()
        self.assertEqual(data['tools'][0]['lc'], 25)
        self.assertEqual(data['tools'][0]['cr'], 0)
        self.assertNotIn('l', data['tools'][0])
        self.assertNotIn('dh', data['tools'][0])
        self.assertEqual(data['ncPrograms'], [{'name': 'Program1'}])
        data = pm(FakeCom('imperial')).snapshot()
        self.assertEqual(data['tools'][0]['d'], 254)
        self.assertEqual(data['units'], 'mm')
        self.assertEqual(data['sourceUnits'], 'inch')
        com = FakeCom(); com.values['diameter'] = 0
        self.assertEqual(pm(com).param('tool', 'Mill10', 'diameter'), '0')

    def test_busy_and_unsupported_units_do_not_mutate_project(self):
        com = FakeCom(); com.Busy = True
        with self.assertRaises(BridgeError): pm(com).snapshot()
        self.assertEqual(com.commands, [])
        com = FakeCom('imperial')
        with self.assertRaises(BridgeError): pm(com).create_tool(TOOL)
        self.assertFalse(any(c.startswith('CREATE') for c in com.commands))

    def test_tool_creation_is_new_named_and_checks_readback(self):
        com = FakeCom(); result = pm(com).create_tool(TOOL)
        self.assertTrue(result['name'].startswith('RMT_T3_'))
        self.assertTrue(any('LENGTH 25' in c for c in com.commands))
        self.assertTrue(any('HOLDER_COMPONENT LENGTH 67' in c for c in com.commands))
        self.assertFalse(any('DELETE' in c or 'UNITS MM' in c for c in com.commands))
        com = FakeCom(); com.values['diameter'] = '11'
        with self.assertRaisesRegex(BridgeError, 'Inspect the new entity'): pm(com).create_tool(TOOL)

    def test_parameter_and_command_injection_is_rejected(self):
        for name in ['bad\nDELETE ALL', 'bad\'name', 'bad"name', '../file', '\\path']:
            with self.assertRaises(BridgeError): safe_name(name)
        for value in ['10\nDELETE ALL', float('nan'), True]:
            with self.assertRaises(BridgeError): tool_commands({**TOOL, 'd': value}, 'RMT_test')
        for tool in [{**TOOL, 'z': 1000}, {**TOOL, 'lc': 100}, {**TOOL, 't': 1.5}]:
            with self.assertRaises(BridgeError): tool_commands(tool, 'RMT_test')
        self.assertIn('TIPRADIUSED', tool_commands({**TOOL, 'cr': 1}, 'RMT_test')[0])
        self.assertIn('BALLNOSED', tool_commands({**TOOL, 'cr': 5}, 'RMT_test')[0])
        self.assertIn('DRILL', tool_commands({**TOOL, 'kind': 'cone'}, 'RMT_test')[0])

    def test_nc_read_is_limited_to_existing_post_output_in_configured_root(self):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as outside:
            root = Path(folder).resolve(); path = root / 'part.nc'; path.write_text('T3 M6\nM30', encoding='utf-8')
            com = FakeCom(); com.values['FileName'] = str(path)
            self.assertEqual(pm(com).nc('Program1', root)['text'], 'T3 M6\nM30')
            with self.assertRaises(BridgeError): pm(com).nc('Program1', None)
            other = Path(outside) / 'private.nc'; other.write_text('secret')
            com.values['FileName'] = str(other)
            with self.assertRaises(BridgeError): pm(com).nc('Program1', root)
            link = root / 'link.nc'; link.symlink_to(other)
            com.values['FileName'] = str(link)
            with self.assertRaises(BridgeError): pm(com).nc('Program1', root)


class HttpContractTests(unittest.TestCase):
    def setUp(self):
        self.server = BridgeServer(('127.0.0.1', 0), TOKEN, [DEFAULT_ORIGIN], adapter=pm)
        self.thread = Thread(target=self.server.serve_forever, daemon=True); self.thread.start()

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()

    def request(self, method, path, body=None, **headers):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        options = {'Origin': DEFAULT_ORIGIN, 'Authorization': 'Bearer ' + TOKEN, **headers}
        if body is not None: options['Content-Type'] = 'application/json'
        conn.request(method, path, json.dumps(body) if body is not None else None, options)
        response = conn.getresponse(); data = response.read()
        result = (response.status, dict(response.getheaders()), json.loads(data) if data else None)
        conn.close(); return result

    def test_authenticated_read_and_explicit_tool_creation(self):
        status, headers, data = self.request('GET', '/v1/status')
        self.assertEqual(status, 200); self.assertTrue(data['connected']); self.assertEqual(data['version'], 1)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertEqual(self.request('GET', '/v1/snapshot')[2]['tools'][0]['d'], 10)
        self.assertEqual(self.request('POST', '/v1/tools', {'tool': TOOL})[0], 200)

    def test_token_origin_host_and_endpoint_guards(self):
        self.assertEqual(self.request('GET', '/v1/status', Authorization='wrong')[0], 401)
        status, headers, _ = self.request('GET', '/v1/status', Origin='https://evil.example')
        self.assertEqual(status, 403); self.assertNotIn('Access-Control-Allow-Origin', headers)
        self.assertEqual(self.request('GET', '/v1/status', Host='evil.example')[0], 403)
        self.assertEqual(self.request('POST', '/execute', {'command': 'DELETE ALL'})[0], 404)
        self.assertEqual(self.request('POST', '/v1/tools', {'tool': {'d': 'DELETE ALL'}})[0], 400)

    def test_browser_private_network_preflight(self):
        status, headers, _ = self.request('OPTIONS', '/v1/status', **{'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization'})
        self.assertEqual(status, 204); self.assertEqual(headers['Access-Control-Allow-Private-Network'], 'true')
        self.assertEqual(self.request('OPTIONS', '/v1/status', **{'Access-Control-Request-Method': 'DELETE'})[0], 405)


class DownloadArtifactTests(unittest.TestCase):
    def test_downloaded_bridge_matches_reviewed_sources(self):
        source = Path(__file__).resolve().parent
        with zipfile.ZipFile(source.parent.parent / 'static' / 'rmt-powermill-bridge.zip') as archive:
            for name in ('README.md', 'bridge.py', 'requirements-windows.txt', 'start.cmd'):
                expected = (source / name).read_bytes()
                if name.endswith('.cmd'): expected = expected.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
                self.assertEqual(archive.read(name), expected)


if __name__ == '__main__':
    unittest.main()
