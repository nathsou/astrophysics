#!/usr/bin/env python3
"""Prepare the real four-lepton data of Chapter 29: CMS Open Data H -> ZZ* -> 4 lepton candidates, 2011 and 2012.

Reads six small CSV files from the CMS education materials (a mirror of files from the CERN Open Data portal):

    4mu_2011.csv 4e_2011.csv 2e2mu_2011.csv 4mu_2012.csv 4e_2012.csv 2e2mu_2012.csv

and, from the notebook Exercises-with-open-data/Advanced/Hunting-the-Higgs-4leptons.ipynb of the same repository, the four luminosity-weighted
simulated mass histograms it prints (ZZ, Drell-Yan, ttbar and a 125 GeV Higgs signal, 37 bins from 70 to 181 GeV).

Writes static/data/h4l-cms-opendata.json (the 278 events with their four lepton four-vectors, and the histograms) and
static/data/h4l-cms-opendata.manifest.json (source, licence, selection, checksums), and the same events in the pipeline widget's real-data format
(`objects-f32-v1`, see src/lib/hep/pipeline/real.ts): static/data/real/higgs-4l.f32 and static/data/real/higgs-4l.manifest.json, which is what lets
the Control Room's pipeline replace its simulated events by these. Standard library only.

Usage: python3 scripts/data/h4l.py path/to/cms-jupyter-materials-english
Source: https://github.com/cms-opendata-education/cms-jupyter-materials-english (Data/ and Exercises-with-open-data/Advanced/).
"""
import csv, datetime, hashlib, json, pathlib, re, struct, subprocess, sys

repo = pathlib.Path(sys.argv[1]).resolve()
out = pathlib.Path(__file__).resolve().parents[2] / 'static' / 'data'
out.mkdir(parents=True, exist_ok=True)

FILES = [('4mu', 2011), ('4e', 2011), ('2e2mu', 2011), ('4mu', 2012), ('4e', 2012), ('2e2mu', 2012)]
events, sources = [], {}
for ch, year in FILES:
    f = repo / 'Data' / f'{ch}_{year}.csv'
    raw = f.read_bytes()
    sources[f.name] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
    n0 = len(events)
    for r in csv.DictReader(f.open()):
        # [pdg id, E, px, py, pz, charge] for each of the four leptons, as published (GeV)
        leptons = [[int(r[f'PID{i}']), float(r[f'E{i}']), float(r[f'px{i}']), float(r[f'py{i}']), float(r[f'pz{i}']), int(float(r[f'Q{i}']))] for i in range(1, 5)]
        events.append({'year': year, 'channel': ch, 'run': int(r['Run']), 'event': int(r['Event']), 'leptons': leptons,
                       'mZ1': float(r['mZ1']), 'mZ2': float(r['mZ2']), 'M': float(r['M'])})
    sources[f.name]['events'] = len(events) - n0

nb = json.loads((repo / 'Exercises-with-open-data' / 'Advanced' / 'Hunting-the-Higgs-4leptons.ipynb').read_text())
code = '\n'.join(''.join(c['source']) for c in nb['cells'] if c['cell_type'] == 'code')
hists = {}
for name in ('dy', 'ttbar', 'zz', 'hzz'):
    m = re.search(rf'^{name}\s*=\s*np\.array\(\[([^\]]*)\]\)', code, re.M)
    hists[name] = [float(x) for x in m.group(1).split(',')]
assert all(len(v) == 37 for v in hists.values())
title = re.search(r"plt\.title\('([^']*)", code).group(1)
title = title.replace('\\n', '').replace('$', '').replace('\\sqrt{s}', '√s').replace('fb^{-1}', 'fb⁻¹').replace('  ', ' ').strip()

data = {
    'description': 'CMS Open Data education sample of H -> ZZ* -> 4 lepton candidate events (2011 at 7 TeV and 2012 at 8 TeV) with the luminosity-weighted simulated histograms of the accompanying notebook',
    'leptonFormat': '[PDG id, E, px, py, pz, charge], GeV',
    'events': events,
    'mc': {'range': [70, 181], 'bins': 37, 'note': 'Events per 3 GeV bin, weighted to the luminosities of the plot title in the notebook: ' + title, **hists},
}
blob = (json.dumps(data, separators=(',', ':')) + '\n').encode()
(out / 'h4l-cms-opendata.json').write_bytes(blob)

try:
    commit = subprocess.run(['git', '-C', str(repo), 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
except Exception:
    commit = 'unknown'
manifest = {
    'file': 'h4l-cms-opendata.json',
    'events': len(events),
    'sha256': hashlib.sha256(blob).hexdigest(),
    'source': {
        'title': 'CMS Open Data education sample: four-lepton candidates (H -> ZZ* -> 4l), 2011 and 2012',
        'mirror': 'https://github.com/cms-opendata-education/cms-jupyter-materials-english',
        'mirrorCommit': commit,
        'files': sources,
        'notebook': 'Exercises-with-open-data/Advanced/Hunting-the-Higgs-4leptons.ipynb (the simulated histograms come from it)',
        'portal': 'The mirror says its data files are copies of files on the CERN Open Data portal (record 545, the CMS education derived datasets); the notebook cites the Higgs-to-four-lepton analysis example, record 5500, DOI 10.7483/OPENDATA.CMS.JKB8.RR42. The portal was not reachable when this file was made, so the record numbers were taken from the mirror and not checked on the portal.',
    },
    'licence': 'The mirror repository states: "This material is made available under a CC-BY licence" (https://creativecommons.org/licenses/by/4.0/). CERN Open Data releases CMS derived datasets under CC0; that was not confirmed on the portal. Both allow redistribution; attribution is given here and in the chapter.',
    'selection': 'As published: the candidate events in the six CSV files, which CMS selected for the four-lepton analysis. No selection is applied here. The files already contain the events of all masses between about 80 and 740 GeV, not only the 125 GeV region. The invariant masses in the files (M, mZ1, mZ2) are kept and checked against the four-vectors by the chapter.',
    'luminosity': title,
    'prepared': datetime.date.today().isoformat(),
    'script': 'scripts/data/h4l.py',
}
(out / 'h4l-cms-opendata.manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(len(events), 'events,', len(blob), 'bytes;', title)

# ── the same events in the pipeline widget's real-data format ────────────────────────────────────────
real = out / 'real'
real.mkdir(exist_ok=True)
import math
rows = []
for i, e in enumerate(events):
    for pid, E, px, py, pz, q in e['leptons']:
        pt = math.hypot(px, py)
        eta = math.asinh(pz / pt)
        phi = math.atan2(py, px)
        kind = 0 if abs(pid) == 13 else 1  # 0 muon, 1 electron
        rows.append((float(i), float(kind), pt, eta, phi, E, float(q), -1.0))  # isolation: not in the source files
rblob = b''.join(struct.pack('<8f', *r) for r in rows)
(real / 'higgs-4l.f32').write_bytes(rblob)
rman = {
    'name': 'higgs-4l',
    'title': 'CMS Open Data education sample: 278 four-lepton candidates, 2011 (7 TeV) and 2012 (8 TeV)',
    'file': 'higgs-4l.f32',
    'format': 'objects-f32-v1',
    'events': len(events),
    'rows': len(rows),
    'sha256': hashlib.sha256(rblob).hexdigest(),
    'sqrtS': 8000,
    'luminosityFb': 13.9,
    'observables': ['m4l'],
    'selection': 'As published: the four-lepton candidates that CMS selected, 2011 and 2012 files together (the 2011 events were recorded at 7 TeV, the 2012 ones at 8 TeV; sqrtS here is the 2012 value). No selection applied here. Only the four leptons are stored (no isolation: the source files have none, iso = -1). The luminosity is the sum of the two values (2.3 and 11.6 fb^-1) given in the title of the plot in the notebook that accompanies the files; it was not checked against the portal.',
    'source': {
        'title': 'CMS Open Data education sample (four-lepton candidates), mirrored in cms-opendata-education/cms-jupyter-materials-english',
        'record': 'https://github.com/cms-opendata-education/cms-jupyter-materials-english (commit ' + commit + ')',
        'experiment': 'CMS',
        'dataset': '4mu, 4e and 2e2mu CSV files, 2011 and 2012',
    },
    'licence': 'CC BY 4.0 as stated by the mirror repository (CERN Open Data: CC0; not confirmed on the portal). Attribution: CMS Collaboration, CERN Open Data portal; education materials by the CMS open data education team.',
    'prepared': datetime.date.today().isoformat(),
    'script': 'scripts/data/h4l.py',
}
(real / 'higgs-4l.manifest.json').write_text(json.dumps(rman, indent=2) + '\n')
print(len(rows), 'rows written to static/data/real/')

