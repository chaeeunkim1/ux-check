"""Build a self-contained presentation with an embedded Korean font subset."""
from pathlib import Path
import base64
import io
import re
import sys
from html import unescape

ROOT = Path(__file__).resolve().parents[1]
LOCAL_DEPS = ROOT / 'artifacts/private/html-presentation/deps'
if LOCAL_DEPS.is_dir():
    sys.path.insert(0, str(LOCAL_DEPS))
from fontTools import subset
from fontTools.ttLib import TTFont

source = (ROOT / 'docs/presentation-source.html').read_text(encoding='utf-8')
text = unescape(re.sub(r'<[^>]*>', ' ', source))
options = subset.Options()
options.flavor = 'woff2'
font = TTFont(ROOT / 'assets/fonts/NotoSansKR.ttf')
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
font.flavor = 'woff2'
data = io.BytesIO()
font.save(data)
license_text = (ROOT / 'assets/fonts/OFL.txt').read_text(encoding='utf-8').replace('--', '—')
output = source.replace('__FONT_DATA__', base64.b64encode(data.getvalue()).decode('ascii')).replace('__FONT_LICENSE__', license_text)
target = ROOT / 'public/ux-check-presentation.html'
target.write_text(output, encoding='utf-8')
print(f'Created {target} ({target.stat().st_size:,} bytes; embedded font {len(data.getvalue()):,} bytes)')
