import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('exporter', Path(__file__).with_name('export-submission-logs.py'))
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)

class ExportTests(unittest.TestCase):
    def test_secrets_removed_from_main_and_zip_without_changing_evidence(self):
        with tempfile.TemporaryDirectory(dir=exporter.ROOT / 'artifacts' / 'submission') as temp:
            root = Path(temp)
            secret = 'sk-ant-api03-' + 'X' * 70
            env_secret = 'private-local-value-' + 'Y' * 40
            env = root / '.env.local'
            env.write_text('ANTHROPIC_API_KEY=' + secret + '\nSETUP_CHECK_TOKEN=' + env_secret)
            row = {'type': 'event_msg', 'timestamp': '2026-09-21T08:00:00Z', 'payload': {'goal': '/goal 검수 앱을 완성하고 실행하여 확인한다.', 'total_tokens': 12345, 'text': 'curl header ' + secret, 'nested': json.dumps({'command': env_secret}), 'authorization': 'short-secret'}}
            source = root / 'original.jsonl'
            source.write_text(json.dumps(row, ensure_ascii=False) + '\n', encoding='utf-8')
            extra = root / 'extra.jsonl'
            extra.write_bytes(source.read_bytes())
            original = source.read_bytes()
            output = root / 'clean'
            manifest = exporter.export_logs(source, [extra], output, env)
            self.assertEqual(source.read_bytes(), original)
            clean = json.loads((output / 'main.jsonl').read_text(encoding='utf-8'))
            self.assertEqual(clean['timestamp'], row['timestamp'])
            self.assertEqual(clean['payload']['goal'], row['payload']['goal'])
            self.assertEqual(clean['payload']['total_tokens'], 12345)
            self.assertEqual(clean['payload']['authorization'], exporter.MARKER)
            with zipfile.ZipFile(output / 'additional-sessions.zip') as archive:
                for entry in archive.infolist():
                    self.assertNotIn(secret.encode(), archive.read(entry))
                    self.assertNotIn(env_secret.encode(), archive.read(entry))
            self.assertEqual(manifest['files'][0]['records'], 1)

    def test_invalid_input_does_not_create_export(self):
        with tempfile.TemporaryDirectory(dir=exporter.ROOT / 'artifacts' / 'submission') as temp:
            root = Path(temp)
            source = root / 'broken.jsonl'
            source.write_text('{"incomplete":')
            with self.assertRaises(ValueError):
                exporter.export_logs(source, [], root / 'clean', root / 'absent-env')
            self.assertFalse((root / 'clean').exists())

if __name__ == '__main__':
    (exporter.ROOT / 'artifacts' / 'submission').mkdir(parents=True, exist_ok=True)
    unittest.main()
