#!/usr/bin/env python3
"""Subset LXGW WenKai (SIL Open Font License 1.1) to the characters the course uses.

    python3 scripts/subset-font.py path/to/LXGWWenKai-Regular.ttf

Needs fonttools and brotli (pip install fonttools brotli). The font comes from
https://github.com/lxgw/LxgwWenKai/releases. Characters are collected from the dictionary
(every word up to HSK 3), the lessons, and the app's own source, so rerun this after adding
content with new characters; `npm test` reports any character the subset lacks.
"""
import json
import pathlib
import re
import sys

from fontTools import subset

root = pathlib.Path(__file__).resolve().parent.parent
chars = set()
chars.update(''.join(json.loads((root / 'content/data/lexicon.json').read_text()).keys()))
chars.update(json.loads((root / 'content/data/chars.json').read_text()).keys())
for pattern in ['content/**/*.md', 'content/**/*.ts', 'src/**/*.svelte', 'src/**/*.ts']:
    for f in root.glob(pattern):
        chars.update(f.read_text(encoding='utf-8'))
han = {c for c in chars if re.match(r'[㐀-鿿豈-﫿]', c)}
punct = set('，。！？、：；“”‘’（）《》…—～·「」【】')
text = ''.join(sorted(han | punct))

options = subset.Options()
options.flavor = 'woff2'
options.layout_features = ['*']
options.name_IDs = ['*']
font = subset.load_font(sys.argv[1], options)
subsetter = subset.Subsetter(options)
subsetter.populate(text=text)
subsetter.subset(font)
out = root / 'src/lib/assets/fonts/wenkai-subset.woff2'
subset.save_font(font, str(out), options)
(root / 'src/lib/assets/fonts/wenkai-chars.txt').write_text(text + '\n', encoding='utf-8')
print(f'{len(han)} characters, {out.stat().st_size // 1024} KiB -> {out.relative_to(root)}')
