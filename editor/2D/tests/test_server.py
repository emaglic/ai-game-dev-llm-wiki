import copy
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location('editor_server', Path(__file__).resolve().parents[1] / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class SaveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'project'
        shutil.copytree(server.EDITOR / 'fixture', self.root)
        self.store = server.ProjectStore(self.root / 'game.project.json')
        m = json.loads(self.store.manifest.read_text())
        self.project = {'manifest': m, 'settings': json.loads((self.root / m['settings']).read_text()),
                        'catalog': json.loads((self.root / m['catalog']).read_text()),
                        'levels': {e['id']: json.loads((self.root / e['path']).read_text()) for e in m['levels']}}

    def tearDown(self):
        self.temp.cleanup()

    def test_save_reload_preserves_extensions(self):
        self.assertEqual(server.validate_project(self.project), [])
        revision = self.store.revision()
        self.project['levels']['atrium']['extensions']['custom'] = {'secretRoom': 42}
        self.project['levels']['atrium']['settings']['cameraZoom'] = 2
        tile = self.project['levels']['atrium']['layers'][0]['tiles'][0]
        tile.update(x=-7, y=3, width=17, height=29)
        result = self.store.save(self.project, revision)
        self.assertEqual(result['files'], 4)
        loaded = json.loads((self.root / 'data/levels/atrium.json').read_text())
        self.assertEqual(loaded, self.project['levels']['atrium'])
        self.assertNotEqual(result['revision'], revision)

    def test_tile_layer_solid_optional_boolean_and_round_trip(self):
        layer = self.project['levels']['atrium']['layers'][0]
        layer.pop('solid', None)
        self.assertEqual(server.validate_project(self.project), [])
        for value in (True, False):
            layer['solid'] = value
            self.assertEqual(server.validate_project(self.project), [])
        for value in ('false', 0, None):
            layer['solid'] = value
            self.assertTrue(server.validate_project(self.project))
        layer['solid'] = False
        self.store.save(self.project, self.store.revision())
        loaded = json.loads((self.root / 'data/levels/atrium.json').read_text())
        self.assertIs(loaded['layers'][0]['solid'], False)

    def test_background_v3_roundtrip_and_validation(self):
        level = self.project['levels']['atrium']
        bg = {'id': 'bg', 'kind': 'background', 'visible': True, 'locked': False, 'opacity': .8, 'parallax': {'x': 0, 'y': .5}, 'objects': [{'id': 'bg-image', 'type': 'background-image', 'x': -20, 'y': 5, 'width': 400, 'height': 200, 'properties': {'asset': 'crate.svg', 'scaleX': 2, 'scaleY': 1, 'repeat': True, 'flipX': True}}]}
        level['layers'].append(bg)
        self.assertTrue(server.validate_project(self.project))
        level['version'] = 3
        self.assertEqual(server.validate_project(self.project), [])
        bg['objects'][0]['properties']['scaleX'] = 0
        self.assertTrue(server.validate_project(self.project))
        bg['objects'][0]['properties']['scaleX'] = 2
        self.store.save(self.project, self.store.revision())
        self.assertEqual(json.loads((self.root / 'data/levels/atrium.json').read_text()), level)

    def test_stale_revision_blocks_overwrite(self):
        revision = self.store.revision()
        (self.root / 'data/settings.json').write_text(json.dumps({**self.project['settings'], 'external': True}))
        with self.assertRaisesRegex(ValueError, 'changed on disk'):
            self.store.save(self.project, revision)

    def test_path_traversal_and_manifest_changes_rejected(self):
        with self.assertRaisesRegex(ValueError, 'escapes'):
            server.contained(self.root, '../../outside.json')
        changed = copy.deepcopy(self.project)
        changed['manifest']['settings'] = '../outside.json'
        with self.assertRaisesRegex(ValueError, 'cannot change manifest'):
            self.store.save(changed, self.store.revision())

    def test_broken_refs_and_invalid_properties_do_not_write(self):
        revision = self.store.revision()
        self.project['levels']['atrium']['layers'][2]['objects'][0]['properties']['destination'] = {'level': 'garden', 'object': 'missing'}
        with self.assertRaisesRegex(ValueError, 'broken reference'):
            self.store.save(self.project, revision)
        self.assertEqual(self.store.revision(), revision)
        self.project['levels']['atrium']['layers'][2]['objects'][0]['properties']['destination'] = None
        self.project['levels']['atrium']['settings']['cameraZoom'] = 0
        with self.assertRaisesRegex(ValueError, 'positive game zoom'):
            self.store.save(self.project, revision)

    def test_unlisted_levels_and_malformed_bundle_are_rejected(self):
        self.assertEqual(server.validate_project(None), ['project: expected object'])
        self.project['levels']['unlisted'] = copy.deepcopy(self.project['levels']['atrium'])
        with self.assertRaisesRegex(ValueError, 'unlisted levels'):
            self.store.save(self.project, self.store.revision())

    def test_editor_grid_metadata_saves_without_changing_tile_grid(self):
        level = self.project['levels']['garden']
        level['extensions']['editor2D'] = {'grid': {'x': 16, 'y': 24, 'extra': 'keep'}, 'future': True}
        self.store.save(self.project, self.store.revision())
        loaded = json.loads((self.root / 'data/levels/garden.json').read_text())
        self.assertEqual(loaded['grid'], 32)
        self.assertEqual(loaded['extensions']['editor2D'], level['extensions']['editor2D'])
        revision = self.store.revision()
        level['extensions']['editor2D']['grid']['y'] = 0
        with self.assertRaisesRegex(ValueError, 'bounds'):
            self.store.save(self.project, revision)
        self.assertEqual(self.store.revision(), revision)

    def test_sprite_frames_and_collision_shapes_validate_on_save(self):
        element = self.project['catalog']['elements'][0]
        element['visual'] = {'asset': 'tile-sheet.svg', 'frame': {'x': -1, 'y': 0, 'width': 32, 'height': 32}}
        with self.assertRaisesRegex(ValueError, 'bounds'):
            self.store.save(self.project, self.store.revision())
        element['visual']['frame']['x'] = 0
        element['collision'] = {'shape': 'polygon', 'points': [{'x': 0, 'y': 0}]}
        self.assertTrue(server.validate_project(self.project))
        element['collision']['points'] = [{'x': 0, 'y': 0}, {'x': 1, 'y': 0}, {'x': .5, 'y': 1}]
        self.assertEqual(server.validate_project(self.project), [])

    def test_real_fixture_cannot_be_saved_even_directly(self):
        store = server.ProjectStore(server.EDITOR / 'fixture/game.project.json')
        revision = store.revision()
        with self.assertRaisesRegex(ValueError, 'read-only'):
            store.save(self.project, revision)
        self.assertEqual(store.revision(), revision)

    def test_missing_project_config_and_fixture_http_write_rejection(self):
        missing = server.ProjectStore(self.root / 'missing/game.project.json')
        http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.make_handler(missing))
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{http.server_port}'
        try:
            with urlopen(base + '/api/editor-config') as r:
                config = json.load(r)
            self.assertIsNone(config['projectURL'])
            with urlopen(base + config['exampleURL']) as r:
                self.assertEqual(json.load(r)['version'], 1)
            req = Request(base + '/api/save', data=json.dumps({'manifestURL': base + config['exampleURL'], 'project': self.project}).encode(), headers={'Content-Type': 'application/json'})
            with self.assertRaises(HTTPError) as error:
                urlopen(req)
            self.assertEqual(error.exception.code, 403)
        finally:
            http.shutdown()
            http.server_close()
            thread.join()

    def test_failed_replace_rolls_back_all_files(self):
        revision = self.store.revision()
        self.project['settings']['values']['music'] = False
        replace = server.os.replace
        calls = 0
        def fail_second(a, b):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError('injected disk failure')
            replace(a, b)
        with patch.object(server.os, 'replace', fail_second):
            with self.assertRaises(OSError):
                self.store.save(self.project, revision)
        self.assertEqual(self.store.revision(), revision)
        self.assertEqual(list(self.root.rglob('*.tmp')), [])

    def test_http_serves_modules_and_rejects_foreign_write(self):
        http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.make_handler(self.store))
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{http.server_port}'
        try:
            with urlopen(base + '/editor/src/model.mjs') as r:
                self.assertEqual(r.headers['Content-Type'], 'text/javascript')
            request = Request(base + '/api/save', data=json.dumps({'manifestURL': base + '/project/game.project.json', 'project': self.project, 'revision': self.store.revision()}).encode(), headers={'Content-Type': 'application/json', 'Origin': 'http://evil.test'})
            with self.assertRaises(HTTPError) as error:
                urlopen(request)
            self.assertEqual(error.exception.code, 403)
            request.remove_header('Origin')
            with urlopen(request) as r:
                self.assertEqual(json.load(r)['files'], 4)
            with self.assertRaises(HTTPError):
                urlopen(base + '/project/%2e%2e/server.py')
        finally:
            http.shutdown()
            http.server_close()
            thread.join()

if __name__ == '__main__':
    unittest.main()
