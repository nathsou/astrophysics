# Data for Part VII (Chapters 26–30)

What the Higgs chapters ship, where it came from, and how to add real diphoton data.

## Shipped

| File (static/data/) | What it is | Real or simulated | Made by |
|---|---|---|---|
| `dimuon.f32` | 100,000 CMS muon pairs (Chapters 2 and 27) | real | `scripts/data/dimuon.py` |
| `h4l-cms-opendata.json` | 278 four-lepton candidates (2011 and 2012) and four simulated histograms from the notebook | real (the histograms: CMS simulation) | `scripts/data/h4l.py` |
| `real/higgs-4l.f32` + manifest | the same 278 events in the pipeline widget's real-data format | real | `scripts/data/h4l.py` |
| `higgs-gamgam-sim.bin` + manifest | H → γγ and γγ-continuum events through the course's own pipeline | simulated | `scripts/data/higgs-sim.ts` |
| `higgs-4l-sim.bin` + manifest | H → ZZ* → 4ℓ events through the course's own pipeline | simulated | `scripts/data/higgs-sim.ts` |

Every file has a `*.manifest.json` with the source, the licence, the selection and the SHA-256 checksum. The four-lepton data are from the CMS education
materials mirrored on GitHub (cms-opendata-education/cms-jupyter-materials-english, CC BY 4.0 as the repository states; the CERN Open Data portal's
terms for CMS derived data are CC0). The portal itself could not be reached when the course was written, so the record numbers come from the mirror.

## There is no real diphoton file

The ATLAS Open Data diphoton samples are large (hundreds of megabytes to gigabytes) and the portal could not be reached. Chapter 29 therefore runs its diphoton
analysis on the course's own simulation and says so. To run the same analysis on real data outside the course, use ATLAS's own notebook,
`13-TeV-examples/uproot_python/HyyAnalysis.ipynb` in https://github.com/atlas-outreach-data-tools/notebooks-collection-opendata (it reads the `GamGam` skim of the
13 TeV release with `uproot`, applies the cuts and fits a polynomial plus a Gaussian).

## How a real diphoton file would be added (the swap mechanism is ready)

Two readers look for it; add either (or both):

1. **The pipeline widget and the Control Room**: `static/data/real/higgs-gamgam.manifest.json` and the file it names, in the format `objects-f32-v1` described at the top of
   `src/lib/hep/pipeline/real.ts` (little-endian Float32, eight values per object: event, kind, pt, eta, phi, E, charge, iso; kind 2 is a photon; units GeV; the manifest
   needs name, title, file, format, events, rows, sha256, sqrtS, luminosityFb, observables (`["mgg"]`), selection, source, licence and prepared). If the manifest does not exist
   the real-data option is simply not offered. `scripts/data/gamgam-atlas-opendata.py` is an UNTESTED template that writes this from the ATLAS Open Data (it has not been run).
2. **The Chapter 29 figure** (`::higgs-hunt`): `static/data/gamgam-opendata.json`, `{ "meta": { ... }, "events": [ { "pt1": …, "eta1": …, "phi1": …, "pt2": …, "eta2": …, "phi2": … }, … ] }`
   with GeV and radians, for the two hardest photons of events that already passed the experiment's own selection. When the file exists the figure offers a "real data" source.

A dataset without a licence that allows redistribution is not shipped.

## Regenerating the simulated samples

    node --experimental-strip-types scripts/data/higgs-sim.ts          # about ten minutes on an idle machine; FAST=1 for a quick check

and the real four-lepton files, with the mirror cloned somewhere:

    python3 scripts/data/h4l.py path/to/cms-jupyter-materials-english
