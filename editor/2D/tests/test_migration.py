import copy
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import migrate_levels
import server

class MigrationTests(unittest.TestCase):
    def test_explicit_migration_preserves_world_layout_extensions_and_backups(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'game'
            shutil.copytree(ROOT / 'fixture', root)
            expected = {}
            for path in (root / 'data/levels').glob('*.json'):
                level = json.loads(path.read_text())
                expected[level['id']] = copy.deepcopy(level)
                level['version'] = 1
                level.pop('tileSize')
                for layer in level['layers']:
                    for tile in layer.get('tiles', []):
                        tile['x'] //= level['grid']
                        tile['y'] //= level['grid']
                        tile.pop('width')
                        tile.pop('height')
                path.write_text(json.dumps(level), encoding='utf-8')
            manifest = root / 'game.project.json'
            paths = migrate_levels.migrate(manifest)
            self.assertEqual(len(paths), 2)
            self.assertEqual(json.loads(Path(paths[0]).read_text())['version'], 1)
            collision = Path(paths[0]).with_suffix('.json.v1.bak')
            collision.write_text('existing backup', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Backup already exists'):
                migrate_levels.migrate(manifest, True)
            self.assertEqual(json.loads(Path(paths[0]).read_text())['version'], 1)
            self.assertEqual(collision.read_text(), 'existing backup')
            collision.unlink()
            migrate_levels.migrate(manifest, True)
            for path in paths:
                p = Path(path)
                loaded = json.loads(p.read_text())
                self.assertEqual(loaded, expected[loaded['id']])
                self.assertEqual(json.loads(p.with_suffix('.json.v1.bak').read_text())['version'], 1)
            self.assertEqual(migrate_levels.migrate(manifest, True), [])

    def test_unknown_versions_fractional_sizes_and_reserved_conflicts_reject(self):
        with self.assertRaises(ValueError):
            migrate_levels.convert_level({'version': 99})
        level = {'version': 1, 'id': 'a', 'width': 100, 'height': 100, 'grid': 2.5, 'settings': {}, 'layers': []}
        with self.assertRaisesRegex(ValueError, 'manual migration'):
            migrate_levels.convert_level(level)
        level['grid'] = 32
        level['tileSize'] = {'width': 16, 'height': 16}
        with self.assertRaisesRegex(ValueError, 'conflicts'):
            migrate_levels.convert_level(level)

    def test_pixel_tile_validation_and_legacy_save_rejection(self):
        root = ROOT / 'fixture'
        manifest = json.loads((root / 'game.project.json').read_text())
        p = {'manifest': manifest, 'settings': json.loads((root / manifest['settings']).read_text()), 'catalog': json.loads((root / manifest['catalog']).read_text()), 'levels': {e['id']: json.loads((root / e['path']).read_text()) for e in manifest['levels']}}
        tile = p['levels']['atrium']['layers'][0]['tiles'][0]
        tile.update(x=-7, y=3, width=17, height=29)
        self.assertEqual(server.validate_project(p), [])
        tile['x'] = 3.5
        self.assertTrue(server.validate_project(p))
        tile['x'] = 0
        p['levels']['atrium']['grid'] = 2.5
        self.assertTrue(server.validate_project(p))
        p['levels']['atrium']['grid'] = 32
        p['levels']['atrium']['version'] = 1
        self.assertTrue(any('explicit migration' in e for e in server.validate_project(p)))
