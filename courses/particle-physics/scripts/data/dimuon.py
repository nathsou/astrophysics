#!/usr/bin/env python3
"""Prepare the dimuon dataset (Chapter 2 onwards).

Reads the CMS Open Data education CSV (`Dimuon_DoubleMu.csv`: 100,000 opposite-sign muon pairs from the 2011
DoubleMu stream) and writes static/data/dimuon.f32, a flat Float32 array with 10 values per event:

    E1 px1 py1 pz1 Q1  E2 px2 py2 pz2 Q2

The invariant mass column of the source file is deliberately left out: the reader computes it (Chapter 2).
Also writes static/data/dimuon.manifest.json (source, licence, selection, checksum).

Usage: python3 scripts/data/dimuon.py path/to/Dimuon_DoubleMu.csv
Source: https://opendata.cern.ch/record/5201 (mirror: github.com/cms-opendata-education/cms-jupyter-materials-english, Data/)
"""
import csv, hashlib, json, struct, sys, datetime, pathlib

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parents[2] / 'static' / 'data'
out.mkdir(parents=True, exist_ok=True)

rows = []
with src.open() as f:
    for r in csv.DictReader(f):
        rows.append([float(r[k]) for k in ('E1', 'px1', 'py1', 'pz1', 'Q1', 'E2', 'px2', 'py2', 'pz2', 'Q2')])
blob = b''.join(struct.pack('<10f', *r) for r in rows)
(out / 'dimuon.f32').write_bytes(blob)
manifest = {
    'file': 'dimuon.f32',
    'format': 'little-endian Float32, 10 values per event: E1 px1 py1 pz1 Q1 E2 px2 py2 pz2 Q2 (GeV, charges in e)',
    'events': len(rows),
    'sha256': hashlib.sha256(blob).hexdigest(),
    'source': {
        'title': 'Dimuon events from the 2011 DoubleMu stream (CMS Open Data education sample)',
        'record': 'https://opendata.cern.ch/record/5201',
        'mirror': 'https://github.com/cms-opendata-education/cms-jupyter-materials-english/tree/master/Data',
        'file': src.name,
        'sourceSha256': hashlib.sha256(src.read_bytes()).hexdigest(),
    },
    'licence': 'CC0 (CERN Open Data terms of use); confirm on the record page before redistribution changes',
    'selection': 'As published: two muons, opposite charge. No selection applied here; the invariant-mass column is dropped.',
    'prepared': datetime.date.today().isoformat(),
    'script': 'scripts/data/dimuon.py',
}
(out / 'dimuon.manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(len(rows), 'events,', len(blob), 'bytes')
