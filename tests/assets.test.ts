import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { samplesOf, SWITCH_IDS } from '../src/core/switches';

const ROOT = join(__dirname, '..', 'public', 'switches');

describe('switch recordings', () => {
  it('has every file the player asks for, and no folder it does not know', () => {
    for (const id of SWITCH_IDS) {
      for (const name of samplesOf(id)) expect(existsSync(join(ROOT, id, `${name}.mp3`)), `${id}/${name}.mp3`).toBe(true);
    }
    const folders = readdirSync(ROOT).filter((name) => statSync(join(ROOT, name)).isDirectory());
    expect(folders.sort()).toEqual([...SWITCH_IDS].sort());
  });

  it('ships the license of the project the recordings come from', () => {
    expect(existsSync(join(ROOT, 'LICENSE-kbsim.md'))).toBe(true);
  });
});
