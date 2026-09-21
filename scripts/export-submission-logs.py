"""Create redacted submission copies; never modify Codex originals."""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = '[REDACTED_SECRET]'
PATTERNS = [
    re.compile(r'\bsk-(?:ant-|proj-|svcacct-)?[A-Za-z0-9_-]{20,}'),
    re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})'),
    re.compile(r'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'),
    re.compile(r'(?i)\bBearer\s+[A-Za-z0-9_.-]{20,}'),
]
SECRET_FIELD = re.compile(r'^(?:api[_-]?key|x-api-key|authorization|access_token|refresh_token|client_secret|password)$', re.I)


def local_secrets(env_path):
    values = set()
    if env_path.exists():
        for line in env_path.read_text(encoding='utf-8-sig').splitlines():
            name, sep, value = line.partition('=')
            if sep and re.search(r'KEY|TOKEN|SECRET|PASSWORD', name, re.I):
                value = value.strip().strip('\"\'')
                if len(value) >= 12:
                    values.add(value)
    return sorted(values, key=len, reverse=True)


def sanitize(value, secrets, counts):
    if isinstance(value, str):
        for secret in secrets:
            counts[0] += value.count(secret)
            value = value.replace(secret, MARKER)
        for pattern in PATTERNS:
            value, count = pattern.subn(MARKER, value)
            counts[0] += count
        return value
    if isinstance(value, list):
        return [sanitize(item, secrets, counts) for item in value]
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if SECRET_FIELD.fullmatch(key) and isinstance(item, str) and item:
                counts[0] += 1
                result[key] = MARKER
            else:
                result[key] = sanitize(item, secrets, counts)
        return result
    return value


def assert_clean(text, secrets):
    if any(secret in text for secret in secrets) or any(p.search(text) for p in PATTERNS):
        raise ValueError('Secret scan failed; export refused (values are not printed).')


def prepare(source, secrets):
    raw = source.read_bytes()
    rows, counts = [], [0]
    for index, line in enumerate(raw.decode('utf-8-sig').splitlines(), 1):
        if not line.strip():
            raise ValueError(f'Blank JSONL record at line {index}; export refused.')
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            raise ValueError(f'Invalid JSONL record at line {index}; retry after the session has flushed.') from None
        rows.append(json.dumps(sanitize(row, secrets, counts), ensure_ascii=False, separators=(',', ':')))
    if not rows:
        raise ValueError('Empty session; export refused.')
    text = '\n'.join(rows) + '\n'
    assert_clean(text, secrets)
    metadata = {
        'source_name': source.name,
        'source_sha256': hashlib.sha256(raw).hexdigest(),
        'export_sha256': hashlib.sha256(text.encode()).hexdigest(),
        'records': len(rows),
        'redactions': counts[0],
    }
    return text, metadata


def export_logs(main, extra, output, env_path):
    main, extra, output = main.resolve(), [p.resolve() for p in extra], output.resolve()
    sources = [main, *extra]
    if len(set(sources)) != len(sources):
        raise ValueError('Do not include the main session twice.')
    allowed = (ROOT / 'artifacts' / 'submission').resolve()
    if not output.is_relative_to(allowed) or output == allowed:
        raise ValueError('Output must be a new subfolder of artifacts/submission/.')
    if any(output == p or output in p.parents for p in sources):
        raise ValueError('Source files must stay outside the export folder.')
    secrets = local_secrets(env_path)
    prepared = [prepare(p, secrets) for p in sources]
    output.mkdir(parents=True, exist_ok=False)
    (output / 'main.jsonl').write_text(prepared[0][0], encoding='utf-8', newline='\n')
    if extra:
        with zipfile.ZipFile(output / 'additional-sessions.zip', 'x', compression=zipfile.ZIP_DEFLATED) as archive:
            for i, (text, meta) in enumerate(prepared[1:], 1):
                archive.writestr(f'{i:02d}-{meta["source_name"]}', text)
        with zipfile.ZipFile(output / 'additional-sessions.zip') as archive:
            for entry in archive.infolist():
                text = archive.read(entry).decode('utf-8')
                assert_clean(text, secrets)
                for line in text.splitlines():
                    json.loads(line)
    assert_clean((output / 'main.jsonl').read_text(encoding='utf-8'), secrets)
    manifest = {
        'created_at': datetime.now(timezone.utc).isoformat(),
        'purpose': 'Submission copy; original files remain unchanged.',
        'changes': 'Credential values only. Event order, timestamps, token counts and non-secret goal text preserved. No events removed; images retained.',
        'files': [meta for _, meta in prepared],
        'secret_scan': 'passed (local env secrets and known token patterns; inspect for any additional sensitive data before submission)',
    }
    (output / 'redaction-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--main', required=True, type=Path)
    parser.add_argument('--extra', action='append', default=[], type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        result = export_logs(args.main, args.extra, args.output, ROOT / '.env.local')
        print(json.dumps({'output': str(args.output), 'files': len(result['files']), 'records': sum(m['records'] for m in result['files']), 'redactions': sum(m['redactions'] for m in result['files']), 'secret_scan': 'passed', 'originals_modified': False}))
    except (ValueError, OSError, UnicodeError) as error:
        print('Log export failed: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
