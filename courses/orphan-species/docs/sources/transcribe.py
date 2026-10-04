import subprocess, json, os, glob, time, sys
from concurrent.futures import ThreadPoolExecutor
D = os.path.dirname(os.path.abspath(__file__))
B = "https://www.college-de-france.fr/audio/"
ITEMS = [(f"L{i+1}", f"jean-jacques-hublin/2016/hublin-{d}.mp3", "fr") for i, d in enumerate(
    "20161004 20161011 20161018 20161025 20161108 20161115 20161122 20161206 20161213".split())]
ITEMS += [
 ("S1-murci", "jean-jacques-hublin/2016/sem-hublin-murci-20161004.mp3", "fr"),
 ("S2-gunz", "en-jean-jacques-hublin/2016/sem-hublin-gunz-20161011.mp3", "en"),
 ("S3-parkington", "en-jean-jacques-hublin/2016/sem-hublin-parkington-20161018.mp3", "en"),
 ("S4-marks", "en-jean-jacques-hublin/2016/sem-hublin-marks-20161025.mp3", "en"),
 ("S5-meyer", "en-jean-jacques-hublin/2016/sem-hublin-meyer-20161108.mp3", "en"),
 ("S6-svoboda", "en-jean-jacques-hublin/2016/sem-hublin-svoboda-20161115.mp3", "en"),
 ("S7-fitzsimmons", "en-jean-jacques-hublin/2016/sem-hublin-fitzsimmons-20161122.mp3", "en"),
 ("S8-zwyns", "jean-jacques-hublin/2016/sem-hublin-zwyns-20161206.mp3", "fr"),
 ("S9-geneste", "jean-jacques-hublin/2016/sem-hublin-geneste-20161213.mp3", "fr"),
]
VOCAB = ("Paléoanthropologie, Jean-Jacques Hublin, Collège de France. Homo sapiens, Néandertal, Néandertaliens, Dénisoviens, "
 "Homo erectus, Homo heidelbergensis, Homo naledi, Homo floresiensis, Jebel Irhoud, Omo Kibish, Herto, Florisbad, Ngaloba, Laetoli, "
 "Kabwe, Bodo, Elandsfontein, Saldanha, Eliye Springs, Guomde, Ileret, Skhul, Qafzeh, Misliya, Tabun, Kebara, Manot, Ust'-Ishim, "
 "Oase, Bacho Kiro, Kostenki, Sungir, Mungo, Madjedbebe, Liang Bua, Callao, Tianyuan, Daoxian, Zhiren, Lida Ajer, Monte Verde, Clovis, "
 "Béringie, Sahul, Sunda, Wallacea, Levallois, Moustérien, Aurignacien, Châtelperronien, Gravettien, Magdalénien, Middle Stone Age, "
 "Later Stone Age, Still Bay, Howiesons Poort, Blombos, Pinnacle Point, Sibudu, Diepkloof, Klasies River, Toba, MIS 5, OIS, "
 "ADN mitochondrial, chromosome Y, coalescence, Svante Pääbo, Chris Stringer, Günter Bräuer, Milford Wolpoff, multirégional, "
 "endocrâne, globularisation, torus sus-orbitaire, chignon occipital, menton, symphyse, haplogroupe, introgression, Leipzig, Max Planck.")
def run(cmd, **kw): return subprocess.run(cmd, check=True, capture_output=True, **kw)
def prepare(item):
    id_, path, lang = item
    if glob.glob(f"{D}/chunks/{id_}_*.mp3"): return
    src = f"{D}/audio/{id_}.mp3"
    for i in range(6):
        try: run(["curl", "-sSL", "-m", "1200", "-C", "-", "--retry", "5", "-o", src, B + path]); break
        except subprocess.CalledProcessError: time.sleep(2 ** i)
    run(["ffmpeg", "-y", "-i", src, "-ac", "1", "-ar", "16000", "-b:a", "32k", "-f", "segment",
         "-segment_time", "600", f"{D}/chunks/{id_}_%03d.mp3"])
    os.remove(src); print("prepared", id_, flush=True)
def transcribe(args):
    chunk, lang = args
    out = chunk.replace("/chunks/", "/transcripts/parts/").replace(".mp3", ".json")
    if os.path.exists(out): return
    prompt = VOCAB if lang == "fr" else ("Paleoanthropology seminar at the Collège de France, hosted by Jean-Jacques Hublin. " + VOCAB)
    for i in range(6):
        r = subprocess.run(["curl", "-sS", "-m", "600", "https://api.openai.com/v1/audio/transcriptions",
            "-F", f"file=@{chunk}", "-F", "model=gpt-4o-transcribe", "-F", f"language={lang}",
            "-F", f"prompt={prompt}", "-F", "response_format=json"], capture_output=True, text=True)
        try:
            j = json.loads(r.stdout)
            if "text" in j:
                open(out, "w").write(json.dumps(j, ensure_ascii=False)); print("ok", os.path.basename(chunk), flush=True); return
            print("err", chunk, r.stdout[:300], flush=True)
        except Exception as e: print("exc", chunk, e, r.stdout[:200], r.stderr[:200], flush=True)
        time.sleep(2 ** i * 3)
os.makedirs(f"{D}/transcripts/parts", exist_ok=True)
with ThreadPoolExecutor(3) as ex: list(ex.map(prepare, ITEMS))
jobs = [(c, lang) for id_, _, lang in ITEMS for c in sorted(glob.glob(f"{D}/chunks/{id_}_*.mp3"))]
with ThreadPoolExecutor(8) as ex: list(ex.map(transcribe, jobs))
for id_, _, _ in ITEMS:
    with open(f"{D}/transcripts/{id_}.txt", "w") as f:
        for p in sorted(glob.glob(f"{D}/transcripts/parts/{id_}_*.json")):
            n = int(p[-8:-5]); f.write(f"\n\n[{n*10//60:d}:{n*10%60:02d}:00]\n" + json.load(open(p))["text"])
print("DONE", flush=True)
