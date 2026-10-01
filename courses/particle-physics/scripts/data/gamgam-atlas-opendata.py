#!/usr/bin/env python3
"""UNTESTED. A template for the real diphoton data of Chapter 29, which the course does not ship.

The course could not reach the ATLAS Open Data portal (opendata.atlas.cern, opendata.cern.ch) from the environment in which it was written, so no real diphoton
data was obtained, and this script has NOT been run. It is here so that the swap mechanism is ready: run it where you can reach the portal, and the
figure of Chapter 29 and the Control Room's pipeline widget pick up the file it writes (see scripts/data/README-higgs.md for the contract).

What it does: reads the "GamGam" skim of the ATLAS Open Data 13 TeV release with uproot (the notebook collection
https://github.com/atlas-outreach-data-tools/notebooks-collection-opendata, `13-TeV-examples/uproot_python/HyyAnalysis.ipynb`, shows how to find the file list with the
`atlasopenmagic` package), keeps events whose two leading photons pass the tight identification and the pT and isolation cuts of that notebook, and writes the two photons of
each kept event in the pipeline widget's real-data format `objects-f32-v1` (src/lib/hep/pipeline/real.ts) as static/data/real/higgs-gamgam.f32 with its manifest.

Branches used (names as in that notebook): photon_pt, photon_eta, photon_phi, photon_e, photon_isTightID, photon_ptcone20.
Requirements: pip install uproot awkward numpy atlasopenmagic. Licence: the portal states the terms of the data (CC0 at the time of writing; CHECK on the record page and put
what you find in the manifest: the course ships nothing without a licence that allows it). The size cap below keeps the file small enough for the course (about 3 MB).

Usage: python3 scripts/data/gamgam-atlas-opendata.py [max_events]
"""
import datetime, hashlib, json, pathlib, struct, sys

import awkward as ak
import numpy as np
import uproot
import atlasopenmagic as atom

MAX_EVENTS = int(sys.argv[1]) if len(sys.argv) > 1 else 30000
out = pathlib.Path(__file__).resolve().parents[2] / 'static' / 'data' / 'real'
out.mkdir(parents=True, exist_ok=True)

atom.set_release('2025e-13tev-beta')  # the release used by the notebook; check the portal for the current name
files = atom.get_urls('data', 'GamGam', protocol='https', cache=True)

rows, n_events = [], 0
for f in files:
    tree = uproot.open(f + ':analysis')
    for d in tree.iterate(['photon_pt', 'photon_eta', 'photon_phi', 'photon_e', 'photon_isTightID', 'photon_ptcone20'], library='ak'):
        d = d[ak.num(d['photon_pt']) >= 2]
        tight = (d['photon_isTightID'][:, 0] == True) & (d['photon_isTightID'][:, 1] == True)
        pt_ok = (d['photon_pt'][:, 0] > 35) & (d['photon_pt'][:, 1] > 25)  # GeV; the notebook uses 50 and 30 and then pT/m cuts
        iso_ok = (d['photon_ptcone20'][:, 0] / d['photon_pt'][:, 0] < 0.055) & (d['photon_ptcone20'][:, 1] / d['photon_pt'][:, 1] < 0.055)
        d = d[tight & pt_ok & iso_ok]
        for ev in zip(d['photon_pt'].to_list(), d['photon_eta'].to_list(), d['photon_phi'].to_list(), d['photon_e'].to_list(), d['photon_ptcone20'].to_list()):
            pt, eta, phi, e, iso = ev
            for k in range(2):  # the two leading photons only
                rows.append((float(n_events), 2.0, pt[k] , eta[k], phi[k], e[k], 0.0, iso[k] / pt[k]))
            n_events += 1
            if n_events >= MAX_EVENTS:
                break
        if n_events >= MAX_EVENTS:
            break
    if n_events >= MAX_EVENTS:
        break
# pT, E in the file are in MeV in some releases: CHECK the units of the branches and convert to GeV before running this for real.

blob = b''.join(struct.pack('<8f', *r) for r in rows)
(out / 'higgs-gamgam.f32').write_bytes(blob)
manifest = {
    'name': 'higgs-gamgam',
    'title': 'ATLAS Open Data, 13 TeV, diphoton skim (UNTESTED TEMPLATE OUTPUT: fill in the real values)',
    'file': 'higgs-gamgam.f32',
    'format': 'objects-f32-v1',
    'events': n_events,
    'rows': len(rows),
    'sha256': hashlib.sha256(blob).hexdigest(),
    'sqrtS': 13000,
    'luminosityFb': None,  # fill in from the release documentation
    'observables': ['mgg'],
    'selection': 'Two leading photons, tight identification, pT > 35 and 25 GeV, calorimeter isolation (ptcone20/pT < 0.055); at most %d events.' % MAX_EVENTS,
    'source': {'title': 'ATLAS Open Data, GamGam skim', 'record': 'https://opendata.atlas.cern', 'experiment': 'ATLAS', 'dataset': 'data15 and data16 periods listed by atlasopenmagic'},
    'licence': 'CHECK ON THE PORTAL and write it here',
    'prepared': datetime.date.today().isoformat(),
    'script': 'scripts/data/gamgam-atlas-opendata.py',
}
(out / 'higgs-gamgam.manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(n_events, 'events written')
