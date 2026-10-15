"""Explicit, lossless v1-to-v2 pixel conversion or optional v3 Background upgrade. Dry-run by default."""
import argparse
import copy
import json
import os
from pathlib import Path
import tempfile
from server import EDITOR, ProjectStore, schema_errors, validate_project

def convert_level(level, target_version=2):
    if not isinstance(level, dict):
        raise ValueError('Level must be a JSON object')
    if level.get('version') in (2,3):
        result = copy.deepcopy(level)
        if target_version == 3:
            result['version'] = 3
        return result
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
    result['version'] = target_version
    return result

def migrate(manifest_path, apply=False, target_version=2):
    if target_version not in (2,3):
        raise ValueError("Target version must be 2 or 3")
    store = ProjectStore(manifest_path)
    manifest = json.loads(store.manifest.read_text(encoding='utf-8'))
    manifest_schema = json.loads((EDITOR / 'schemas/manifest.schema.json').read_text(encoding='utf-8'))
    manifest_errors = schema_errors(manifest, manifest_schema)
    if manifest_errors:
        raise ValueError('\n'.join(manifest_errors))
    paths = store.paths(manifest)
    docs = {key: json.loads(path.read_text(encoding='utf-8')) for key, path in paths}
    levels = {e['id']: convert_level(docs['level:' + e['id']], target_version) for e in manifest['levels']}
    errors = validate_project({'manifest': manifest, 'settings': docs['settings'], 'catalog': docs['catalog'], 'levels': levels})
    if errors:
        raise ValueError('\n'.join(errors))
    pending = [(path, levels[key[6:]]) for key, path in paths if key.startswith('level:') and docs[key]['version'] != levels[key[6:]]['version']]
    if not apply:
        return [str(path) for path, _ in pending]
    if pending and store.manifest.is_relative_to((EDITOR / 'fixture').resolve()):
        raise ValueError('Bundled fixture is read-only')
    backup_paths = {path: path.with_suffix(path.suffix + f'.v{docs[key]["version"]}.bak') for key, path in paths if key.startswith('level:')}
    for path, _ in pending:
        if backup_paths[path].exists():
            raise ValueError(f'Backup already exists: {backup_paths[path]}; it will not be overwritten')
    originals = {path: path.read_bytes() for path, _ in pending}
    staged = {}
    try:
        for path, level in pending:
            with backup_paths[path].open('xb') as backup:
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
    parser.add_argument('--apply', action='store_true', help='Write converted levels and preserve version-specific .bak originals')
    parser.add_argument('--target-version', type=int, choices=(2,3), default=2, help='Use 3 to explicitly enable Background layers; default converts only legacy v1 to v2')
    args = parser.parse_args()
    try:
        paths = migrate(args.project, args.apply, args.target_version)
        for path in paths:
            print(('Converted: ' if args.apply else 'Would convert: ') + path)
        print(f'{len(paths)} level(s). Manifest/settings/catalog stay v1. Target level version: {args.target_version}. Update runtime pixel/Background support before playing converted levels.')
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, str(error) + '\n')
