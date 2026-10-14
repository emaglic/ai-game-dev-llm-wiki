"""Explicit, lossless v1 cell -> v2 pixel level migration. Dry-run by default."""
import argparse
import copy
import json
import os
from pathlib import Path
import tempfile
from server import EDITOR, ProjectStore, schema_errors, validate_project

def convert_level(level):
    if not isinstance(level, dict):
        raise ValueError('Level must be a JSON object')
    if level.get('version') == 2:
        return copy.deepcopy(level)
    schema = json.loads((EDITOR / 'schemas/level-v1.schema.json').read_text(encoding='utf-8'))
    errors = schema_errors(level, schema)
    if errors:
        raise ValueError('\n'.join(errors))
    result = copy.deepcopy(level)
    grid = level['grid']
    if not float(grid).is_integer():
        raise ValueError('Fractional legacy tile sizes need a manual migration; conversion will not round data')
    size = {'width': int(grid), 'height': int(grid)}
    if 'tileSize' in result and result['tileSize'] != size:
        raise ValueError('Legacy tileSize extension conflicts with the v2 field; migrate it manually')
    result['tileSize'] = size
    for layer in result['layers']:
        for tile in layer.get('tiles', []):
            for key in ('width', 'height'):
                if key in tile and tile[key] != size[key]:
                    raise ValueError(f'Legacy tile {key} extension conflicts with v2; migrate it manually')
                tile[key] = size[key]
            tile['x'] *= int(grid)
            tile['y'] *= int(grid)
    result['version'] = 2
    return result

def migrate(manifest_path, apply=False):
    store = ProjectStore(manifest_path)
    manifest = json.loads(store.manifest.read_text(encoding='utf-8'))
    manifest_schema = json.loads((EDITOR / 'schemas/manifest.schema.json').read_text(encoding='utf-8'))
    manifest_errors = schema_errors(manifest, manifest_schema)
    if manifest_errors:
        raise ValueError('\n'.join(manifest_errors))
    paths = store.paths(manifest)
    docs = {key: json.loads(path.read_text(encoding='utf-8')) for key, path in paths}
    levels = {e['id']: convert_level(docs['level:' + e['id']]) for e in manifest['levels']}
    errors = validate_project({'manifest': manifest, 'settings': docs['settings'], 'catalog': docs['catalog'], 'levels': levels})
    if errors:
        raise ValueError('\n'.join(errors))
    pending = [(path, levels[key[6:]]) for key, path in paths if key.startswith('level:') and docs[key]['version'] == 1]
    if not apply:
        return [str(path) for path, _ in pending]
    if pending and store.manifest.is_relative_to((EDITOR / 'fixture').resolve()):
        raise ValueError('Bundled fixture is read-only')
    for path, _ in pending:
        if path.with_suffix(path.suffix + '.v1.bak').exists():
            raise ValueError(f'Backup already exists: {path}.v1.bak; it will not be overwritten')
    originals = {path: path.read_bytes() for path, _ in pending}
    staged = {}
    try:
        for path, level in pending:
            with path.with_suffix(path.suffix + '.v1.bak').open('xb') as backup:
                backup.write(originals[path])
            with tempfile.NamedTemporaryFile(dir=path.parent, delete=False, suffix='.tmp') as f:
                staged[path] = Path(f.name)
                f.write((json.dumps(level, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8'))
        for path, staged_path in staged.items():
            os.replace(staged_path, path)
    except Exception:
        for path, original in originals.items():
            path.write_bytes(original)
        raise
    finally:
        for staged_path in staged.values():
            staged_path.unlink(missing_ok=True)
    return [str(path) for path, _ in pending]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--apply', action='store_true', help='Write converted levels and preserve .json.v1.bak originals')
    args = parser.parse_args()
    try:
        paths = migrate(args.project, args.apply)
        for path in paths:
            print(('Converted: ' if args.apply else 'Would convert: ') + path)
        print(f'{len(paths)} level(s). Manifest/settings/catalog stay v1. Update the runtime to read pixel tiles before playing converted levels.')
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, str(error) + '\n')
