# Video production pipeline

Turns a script into a finished video file, with no paid services.

| Step | File | What it does |
|---|---|---|
| 1 | `narrate.py` | Speaks the script with the free, offline Piper voice engine and writes a timeline of when everything happens |
| 2 | `render.js` | Draws every frame of animated graphics from `stage.html`, in time with the voice |
| 3 | `mix.sh` | Polishes the voice, adds a quiet ambient bed, and joins sound to picture |

Each production has its own folder (for example `standard-oil/`) holding its script, thumbnail design and publishing pack.
Finished files go to `out/`, which is not uploaded to GitHub because video files are too large.

## Where this runs

This pipeline was built to run in the cloud workspace, not on a home computer. It needs:

- Python 3 with the `piper-tts` package, and a Piper voice model file
- Node.js with Playwright and Chromium
- ffmpeg
- The fonts Inter and Bitstream Charter (other fonts work but look different)

## Commands

```bash
python3 narrate.py standard-oil/script.json /path/to/voice.onnx out 414
node render.js out/timeline.json out
bash mix.sh out standard-oil-pilot.mp4
```

`414` is the speaker number inside the LibriTTS voice model. A nine-minute video takes about 20 minutes to render on four processor cores.

To preview single frames without rendering everything:

```bash
node render.js out/timeline.json out/stills --still 10,60,120
```

## The script format

`script.json` is a list of chapters, each a list of shots. A shot has a `type` that decides the picture, and `say` lines that are narrated and shown as captions.

- Write `{1870|eighteen seventy}` where the caption and the spoken words should differ.
- Shot types: `title`, `year`, `stat`, `words`, `duo`, `art`, `share`, `grid`, `split`, `names`. Chapter title cards are added automatically.
- `art` drawings available: `derrick`, `lamp`, `ledger`, `barrel`, `train`, `pipeline`, `pen`, `court`, `car`, `bottleneck`.

## Voice licence

The narrator is the LibriTTS voice for Piper, licensed CC BY 4.0. That licence allows commercial use as long as credit is given, so keep the credit line in the video description.
The more natural-sounding "Ryan" Piper voice was tested and rejected because its licence forbids commercial use.
