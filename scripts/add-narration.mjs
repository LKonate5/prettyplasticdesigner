#!/usr/bin/env node
/**
 * Attaches an ElevenLabs voiceover + a light ambient music bed to a demo
 * walkthrough produced by record-demo.mjs.
 *
 *   npm run narrate                      # facade-designer-v2 by default
 *   npm run narrate -- --name=facade-designer-v1
 *
 * Flags: --name= --voice= --model= --bed-db=-28 --out= --keep-temp
 *
 * Reads videos/<name>.mp4 (silent) and videos/<name>.captions.json (written
 * by record-demo.mjs — the exact moment, in final-video seconds, each
 * on-screen caption appeared). The voice speaks each caption's text verbatim
 * — subtitle and narration are the same string, so what's on screen is
 * exactly what's said. (An em dash is swapped for a comma before it's sent
 * to ElevenLabs, as a backstop in case one slips into a caption later.)
 *
 * The video stream is never re-encoded (-c:v copy) — only an audio track is
 * attached, so the picture is byte-for-byte the same take record-demo.mjs
 * produced.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { probeDuration, run, verify } from './lib/ffmpeg.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

// ── options ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : true;
};

const NAME = String(flag('name', 'facade-designer-v2'));
// "Alice" — one of ElevenLabs' premade voices, usable on the free plan
// (library voices like GPTk4QbvF7snDhImF5UF need a paid plan for API access).
const VOICE_ID = String(flag('voice', 'Xb7hH8MSUJpSbSDYk0k2'));
const MODEL_ID = String(flag('model', 'eleven_multilingual_v2'));
const BED_DB = Number(flag('bed-db', -20));
const OUT_NAME = String(flag('out', `${NAME}-narrated.mp4`));
const KEEP_TEMP = Boolean(flag('keep-temp', false));

const OUT_DIR = path.join(ROOT, 'videos');
const RAW_DIR = path.join(OUT_DIR, 'raw');
const NARRATION_DIR = path.join(RAW_DIR, 'narration');

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  throw new Error(
    'ELEVENLABS_API_KEY is not set. Copy .env.example to .env and add your key ' +
      '(https://elevenlabs.io/app/settings/api-keys), or export it in your shell before running npm run narrate.',
  );
}
const elevenlabs = new ElevenLabsClient({ apiKey });

// ── inputs ───────────────────────────────────────────────────────────────────
const videoFile = path.join(OUT_DIR, `${NAME}.mp4`);
const captionsFile = path.join(OUT_DIR, `${NAME}.captions.json`);

await stat(videoFile).catch(() => {
  throw new Error(`${path.relative(ROOT, videoFile)} not found — run npm run demo first.`);
});
const captions = await readFile(captionsFile, 'utf8')
  .then(JSON.parse)
  .catch(() => {
    throw new Error(
      `${path.relative(ROOT, captionsFile)} not found — re-run npm run demo (it now writes this ` +
        'sidecar alongside the mp4; an mp4 from before that change won\'t have one).',
    );
  });

// Subtitle and narration are the same text — every caption on screen is
// spoken, and nothing is spoken that isn't shown.
const lines = captions.map(({ text, atS }) => ({
  caption: text,
  line: text.replace(/\s*—\s*/g, ', '),
  atS,
}));

const videoDuration = probeDuration(videoFile);

// ── narration clips ──────────────────────────────────────────────────────────
await rm(NARRATION_DIR, { recursive: true, force: true });
await mkdir(NARRATION_DIR, { recursive: true });

console.log(`\n  narration  ${lines.length} lines, voice ${VOICE_ID}, model ${MODEL_ID}`);
const clips = [];
for (const [i, { caption, line, atS }] of lines.entries()) {
  const file = path.join(NARRATION_DIR, `${String(i + 1).padStart(2, '0')}.mp3`);
  const audio = await elevenlabs.textToSpeech.convert(VOICE_ID, {
    text: line,
    modelId: MODEL_ID,
    outputFormat: 'mp3_44100_128',
  });
  await pipeline(Readable.fromWeb(audio), createWriteStream(file));
  const dur = probeDuration(file);
  clips.push({ file, caption, atS, dur });
}

// Play each clip no earlier than its caption's atS, but never before the
// previous clip finishes plus a fixed breathing gap — a clip that ran long
// pushes back everything after it rather than overlapping it. Small drift
// from the caption's own timing is the trade-off, and it stays small because
// these lines are short relative to their beats.
const GAP_S = 0.45;
let cursor = 0;
for (const c of clips) {
  c.playAt = Math.max(c.atS, cursor);
  cursor = c.playAt + c.dur + GAP_S;
}
console.log(`  ${GAP_S}s minimum gap enforced between lines`);
for (const [i, c] of clips.entries()) {
  const drift = c.playAt - c.atS;
  const note = drift > 0.05 ? `  (delayed ${drift.toFixed(1)}s for spacing)` : '';
  console.log(`    ${String(i + 1).padStart(2, '0')} ${c.playAt.toFixed(1)}s  ${c.dur.toFixed(1)}s  "${c.caption}"${note}`);
}

// ── narration track: each clip delayed to its beat, mixed together ─────────────
const narrationWav = path.join(RAW_DIR, 'narration.wav');
{
  const inputs = clips.flatMap((c) => ['-i', c.file]);
  const chains = clips.map((c, i) => `[${i}]adelay=${Math.round(c.playAt * 1000)}:all=1[a${i}]`);
  const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:duration=longest:normalize=0[out]`;
  run('ffmpeg', ['-y', ...inputs, '-filter_complex', [...chains, mix].join(';'), '-map', '[out]', narrationWav]);
}

// ── ambient bed: a soft, constant piano chord, synthesized locally (no
// licensing) — a held C6/9 voicing (C E G A C), harmonic-rich for a piano-ish
// timbre. Every voice sustains at a fixed level for the whole clip (only the
// overall fade in/out below moves) — no retriggering, no rhythm. Calm and
// soft by design (see BED_DB below), but still audible — a held chord reads
// as more present than a pluck at the same level, since there's no silence
// between notes for it to recede into, so it still sits well under the
// narration even at this level.
const bedWav = path.join(RAW_DIR, 'bed.wav');
{
  const d = Math.max(videoDuration, 3);
  const fadeStart = (d - 2).toFixed(2);
  const NOTES = [261.63, 329.63, 392.0, 440.0, 523.25]; // C4 E4 G4 A4 C5
  const AMP = 0.07; // per voice; all 5 sustain together, so this stays low
  const harmonics = (f) =>
    `(sin(2*PI*${f}*t)+0.4*sin(2*PI*${2 * f}*t)+0.15*sin(2*PI*${3 * f}*t))`;
  const expr = NOTES.map((f) => `${AMP}*${harmonics(f)}`).join('+');
  run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `aevalsrc=exprs='${expr}':s=44100:d=${d}`,
    '-af',
    `lowpass=f=4000,afade=t=in:d=2,afade=t=out:st=${fadeStart}:d=2,volume=${BED_DB}dB`,
    bedWav,
  ]);
}

// ── final mix, then mux onto the untouched video stream ────────────────────────
const mixWav = path.join(RAW_DIR, 'mix.wav');
run('ffmpeg', [
  '-y', '-i', narrationWav, '-i', bedWav,
  '-filter_complex', '[0][1]amix=inputs=2:duration=longest:normalize=0[out]',
  '-map', '[out]', mixWav,
]);

const outFile = path.join(OUT_DIR, OUT_NAME);
run('ffmpeg', [
  '-y', '-i', videoFile, '-i', mixWav,
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
  '-shortest',
  outFile,
]);
const dur = verify(outFile);

if (!KEEP_TEMP) await rm(NARRATION_DIR, { recursive: true, force: true });

const mb = async (f) => ((await stat(f)).size / 1e6).toFixed(1);
const narrationSeconds = clips.reduce((s, c) => s + c.dur, 0);
console.log(
  `\n  narration total  ${narrationSeconds.toFixed(1)}s of speech across ${clips.length} clips`,
);
console.log(`  bed              ${BED_DB}dB, ${videoDuration.toFixed(1)}s`);
console.log(`  ${path.relative(ROOT, outFile)}  ${dur.toFixed(1)}s  ${await mb(outFile)} MB`);
