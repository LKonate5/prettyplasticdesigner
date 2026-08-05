import { spawnSync } from 'node:child_process';

export function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${cmd} failed:\n${res.stderr?.slice(-1200)}`);
  return res.stdout.trim();
}

export function probeDuration(file) {
  return Number(
    run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1',
      file,
    ]),
  );
}

/**
 * Decode the whole file to /dev/null. A half-copied mp4 still looks fine to
 * `ls` but has no moov atom, which is exactly what QuickTime reports as "not
 * compatible" — catch it here rather than on the user's screen.
 */
export function verify(file) {
  run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-']);
  const d = probeDuration(file);
  if (!Number.isFinite(d) || d < 1) throw new Error(`${file} probed as ${d}s — bad encode`);
  return d;
}
