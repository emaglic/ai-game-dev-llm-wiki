"""Dependency-free editor server. Run from any working directory."""
import argparse
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, unquote, urlsplit
import webbrowser

EDITOR = Path(__file__).resolve().parent
MAX_BODY = 8 * 1024 * 1024

def contained(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('Path escapes allowed root')
    return path

def schema_errors(value, schema, path='$'):
    """Validate the JSON Schema subset used by our checked-in v1 schemas."""
    errors = []
    if '$ref' in schema:
        filename, _, fragment = schema['$ref'].partition('#')
        target = json.loads((EDITOR / 'schemas' / filename).read_text(encoding='utf-8'))
        for key in fragment.strip('/').split('/') if fragment else []:
            target = target[key]
        return schema_errors(value, target, path)
    if 'anyOf' in schema:
        if all(schema_errors(value, s, path) for s in schema['anyOf']):
            return [f'{path}: does not match an allowed shape']
        return []
    types = {'object': lambda x: isinstance(x, dict), 'array': lambda x: isinstance(x, list),
             'string': lambda x: isinstance(x, str), 'number': lambda x: type(x) in (int, float),
             'integer': lambda x: type(x) is int, 'boolean': lambda x: type(x) is bool,
             'null': lambda x: x is None}
    if schema.get('type') and not types[schema['type']](value):
        return [f'{path}: expected {schema["type"]}']
    if 'const' in schema and (value != schema['const'] or isinstance(value, bool) != isinstance(schema['const'], bool)):
        errors.append(f'{path}: expected {schema["const"]!r}')
    if 'enum' in schema and value not in schema['enum']:
        errors.append(f'{path}: unsupported value {value!r}')
    if isinstance(value, dict):
        for key in schema.get('required', []):
            if key not in value:
                errors.append(f'{path}.{key}: required')
        for key, val in value.items():
            sub = schema.get('properties', {}).get(key, schema.get('additionalProperties', True))
            if isinstance(sub, dict):
                errors.extend(schema_errors(val, sub, f'{path}.{key}'))
    if isinstance(value, list):
        if len(value) < schema.get('minItems', 0):
            errors.append(f'{path}: too few entries')
        if schema.get('uniqueItems') and len({json.dumps(x, sort_keys=True) for x in value}) != len(value):
            errors.append(f'{path}: duplicate entries')
        for i, val in enumerate(value):
            errors.extend(schema_errors(val, schema.get('items', {}), f'{path}[{i}]'))
    if isinstance(value, str):
        import re
        if len(value) < schema.get('minLength', 0) or len(value) > schema.get('maxLength', float('inf')):
            errors.append(f'{path}: invalid string length')
        if schema.get('pattern') and not re.search(schema['pattern'], value):
            errors.append(f'{path}: invalid string format')
    if type(value) in (int, float):
        import math
        if not math.isfinite(value) or value < schema.get('minimum', -float('inf')) or value > schema.get('maximum', float('inf')):
            errors.append(f'{path}: number outside allowed bounds')
    return errors

def validate_project(project):
    if not isinstance(project, dict):
        return ['project: expected object']
    errors = []
    for kind in ('manifest', 'settings', 'catalog'):
        schema = json.loads((EDITOR / 'schemas' / f'{kind}.schema.json').read_text(encoding='utf-8'))
        errors.extend(schema_errors(project.get(kind), schema, kind))
    if errors:
        return errors
    manifest, catalog = project['manifest'], project['catalog']
    levels = project.get('levels', {})
    if not isinstance(levels, dict):
        return ['levels: expected object']
    types = {e['id']: e for e in catalog['elements']}
    if len(types) != len(catalog['elements']):
        errors.append('catalog: duplicate element ID')
    level_schema = json.loads((EDITOR / 'schemas' / 'level.schema.json').read_text(encoding='utf-8'))
    ids = [e['id'] for e in manifest['levels']]
    if set(levels) != set(ids):
        errors.append('levels must match manifest IDs; refusing to discard unlisted levels')
    if len(set(ids)) != len(ids):
        errors.append('manifest: duplicate level ID')
    for entry in manifest['levels']:
        level = levels.get(entry['id'])
        es = schema_errors(level, level_schema, entry['id'])
        errors.extend(es)
        if es:
            continue
        if level['id'] != entry['id']:
            errors.append(f'{entry["id"]}: level ID differs from manifest')
        if 'camera' in level['settings']:
            errors.extend(schema_errors(level['settings']['camera'], {'$ref': 'common.schema.json#/$defs/position'}, 'camera'))
        if 'cameraZoom' in level['settings']:
            zoom = level['settings']['cameraZoom']
            if type(zoom) not in (int, float) or zoom <= 0:
                errors.append('cameraZoom: expected positive game zoom')
        layer_ids, object_ids = set(), set()
        for layer in level['layers']:
            if layer['id'] in layer_ids:
                errors.append('duplicate layer ID')
            layer_ids.add(layer['id'])
            cells = set()
            for item in layer.get('tiles' if layer['kind'] == 'tile' else 'objects', []):
                t = types.get(item['type'])
                if not t or t['kind'] != layer['kind']:
                    errors.append(f'{entry["id"]}: unknown element {item["type"]}')
                if layer['kind'] == 'object':
                    if item['id'] in object_ids:
                        errors.append(f'duplicate object ID {item["id"]}')
                    object_ids.add(item['id'])
                else:
                    cell = (item['x'], item['y'])
                    if cell in cells:
                        errors.append('duplicate tile cell')
                    cells.add(cell)
    if errors:
        return errors
    def values(vals, definitions, path):
        for key, definition in definitions.items():
            value = vals.get(key, definition.get('default'))
            if value is None and key not in vals and 'default' not in definition:
                if definition.get('required'):
                    errors.append(f'{path}.{key}: required')
                continue
            typ = definition['type']
            s = {'type': typ} if typ in ('number', 'integer', 'boolean', 'string') else {}
            for a, b in [('min', 'minimum'), ('max', 'maximum'), ('maxLength', 'maxLength')]:
                if a in definition:
                    s[b] = definition[a]
            if typ == 'color':
                s = {'type': 'string', 'pattern': '^#[0-9a-fA-F]{6}$'}
            if typ == 'asset':
                s = {'type': 'string'}
                if value and value not in manifest.get('assetFiles', []):
                    errors.append(f'{path}.{key}: unlisted asset')
            if typ == 'enum':
                s = {'enum': definition['options']}
            if typ in ('position', 'objectRef'):
                s = {'$ref': f'common.schema.json#/$defs/{typ}'}
            errors.extend(schema_errors(value, s, f'{path}.{key}'))
            if typ == 'objectRef' and isinstance(value, dict):
                target_level = levels.get(value.get('level'), {})
                targets = [o for l in target_level.get('layers', []) if l['kind'] == 'object' for o in l['objects']]
                target = next((o for o in targets if o['id'] == value.get('object')), None)
                if not target or (definition.get('targets') and target['type'] not in definition['targets']):
                    errors.append(f'{path}.{key}: broken reference or invalid target type')
    all_definitions = [project['settings']['properties'], catalog['levelProperties']] + [e['properties'] for e in catalog['elements']]
    for definitions in all_definitions:
        for key, d in definitions.items():
            if 'min' in d and 'max' in d and d['min'] > d['max']:
                errors.append(f'{key}: min exceeds max')
            if d['type'] == 'enum' and not d.get('options'):
                errors.append(f'{key}: enum needs options')
        values({k: d['default'] for k, d in definitions.items() if 'default' in d}, {k: {**d, 'required': False} for k, d in definitions.items()}, 'defaults')
    values(project['settings']['values'], project['settings']['properties'], 'settings')
    for level in levels.values():
        values(level['settings'], catalog['levelProperties'], level['id'])
        for layer in level['layers']:
            if layer['kind'] == 'object':
                for o in layer['objects']:
                    values(o['properties'], types[o['type']]['properties'], o['id'])
    return errors

class ProjectStore:
    def __init__(self, manifest):
        self.manifest = manifest.resolve()
        self.root = self.manifest.parent
        self.lock = threading.Lock()

    def paths(self, manifest):
        entries = [('settings', manifest['settings']), ('catalog', manifest['catalog'])]
        entries += [('level:' + e['id'], e['path']) for e in manifest['levels']]
        paths = [(key, contained(self.root, path)) for key, path in entries]
        if len({p for _, p in paths}) != len(paths) or self.manifest in {p for _, p in paths}:
            raise ValueError('Project documents must use distinct paths')
        if any(p.suffix.lower() != '.json' for _, p in paths):
            raise ValueError('Project data files must be JSON')
        return paths

    def revision(self):
        data = self.manifest.read_bytes()
        manifest = json.loads(data)
        digest = hashlib.sha256(data)
        for _, p in self.paths(manifest):
            digest.update(str(p).encode())
            digest.update(p.read_bytes())
        return digest.hexdigest()

    def save(self, project, revision):
        with self.lock:
            manifest = json.loads(self.manifest.read_text(encoding='utf-8'))
            if project.get('manifest') != manifest:
                raise ValueError('Save cannot change manifest paths or contents; edit manifest on disk and reload')
            if revision != self.revision():
                raise ValueError('Project changed on disk; export your edits, then reload before saving')
            errors = validate_project(project)
            if errors:
                raise ValueError('\n'.join(errors))
            paths = self.paths(manifest)
            old = {p: p.read_bytes() for _, p in paths}
            staged = {}
            replaced = []
            try:
                for key, path in paths:
                    value = project[key] if key in ('settings', 'catalog') else project['levels'][key[len('level:'):]]
                    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False, suffix='.tmp') as f:
                        staged[path] = Path(f.name)
                        f.write((json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8'))
                for path, temp in staged.items():
                    os.replace(temp, path)
                    replaced.append(path)
            except Exception:
                for path in replaced:
                    path.write_bytes(old[path])
                raise
            finally:
                for temp in staged.values():
                    temp.unlink(missing_ok=True)
            return {'files': len(paths), 'revision': self.revision()}

def make_handler(store):
    class Handler(BaseHTTPRequestHandler):
        def reply(self, status, body, content_type='application/json'):
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(body)

        def trusted(self):
            # Local write API rejects DNS rebinding, foreign origins and cross-site requests.
            expected = f'127.0.0.1:{self.server.server_port}'
            return self.headers.get('Host') in (expected, f'localhost:{self.server.server_port}') and self.headers.get('Origin', f'http://{expected}') in (f'http://{expected}', f'http://localhost:{self.server.server_port}') and self.headers.get('Sec-Fetch-Site', 'same-origin') not in ('cross-site', 'same-site')

        def do_GET(self):
            try:
                if not self.trusted():
                    return self.reply(403, b'Untrusted host or origin', 'text/plain')
                url = urlsplit(self.path)
                path = unquote(url.path)
                if path == '/api/revision':
                    return self.reply(200, json.dumps({'revision': store.revision()}).encode())
                if path.startswith('/project/'):
                    file = contained(store.root, path[len('/project/'):])
                elif path.startswith('/editor/'):
                    file = contained(EDITOR, path[len('/editor/'):])
                elif path == '/':
                    self.send_response(302)
                    self.send_header('Location', f'/editor/index.html?project=/project/{quote(store.manifest.name)}')
                    self.end_headers()
                    return
                else:
                    return self.reply(404, b'Not found', 'text/plain')
                if not file.is_file():
                    return self.reply(404, b'File not found', 'text/plain')
                mime = 'text/javascript' if file.suffix in ('.mjs', '.js') else mimetypes.guess_type(file)[0] or 'application/octet-stream'
                self.reply(200, file.read_bytes(), mime)
            except (OSError, ValueError, KeyError) as e:
                self.reply(400, str(e).encode(), 'text/plain')

        def do_POST(self):
            if not self.trusted():
                return self.reply(403, b'Untrusted host or origin', 'text/plain')
            if self.path != '/api/save':
                return self.reply(404, b'Not found', 'text/plain')
            try:
                if self.headers.get('Content-Type') != 'application/json':
                    raise ValueError('Expected application/json')
                size = int(self.headers.get('Content-Length', 0))
                if size <= 0 or size > MAX_BODY:
                    raise ValueError('Save body must be 1 byte to 8 MiB')
                data = json.loads(self.rfile.read(size), parse_constant=lambda x: (_ for _ in ()).throw(ValueError('Nonfinite JSON number')))
                requested = urlsplit(data.get('manifestURL', '')).path
                if unquote(requested) != f'/project/{store.manifest.name}':
                    raise ValueError('Save is restricted to the manifest selected at launch')
                self.reply(200, json.dumps(store.save(data['project'], data.get('revision'))).encode())
            except (ValueError, OSError, KeyError, TypeError) as e:
                self.reply(400, str(e).encode(), 'text/plain')
    return Handler

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=EDITOR / 'fixture' / 'game.project.json')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--open', action='store_true', help='Open the editor in your default browser')
    args = parser.parse_args()
    store = ProjectStore(args.project)
    store.revision()  # Fail early on missing files or unsafe document paths.
    server = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(store))
    url = f'http://127.0.0.1:{server.server_port}/editor/index.html?project=/project/{quote(store.manifest.name)}'
    print(url, flush=True)
    if args.open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
