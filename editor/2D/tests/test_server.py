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
        result = self.store.save(self.project, revision)
        self.assertEqual(result['files'], 4)
        loaded = json.loads((self.root / 'data/levels/atrium.json').read_text())
        self.assertEqual(loaded, self.project['levels']['atrium'])
        self.assertNotEqual(result['revision'], revision)

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
