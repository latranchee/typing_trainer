import type { KeySound, SwitchId } from '../core/switches';
import { pressSample, releaseSample, samplesOf } from '../core/switches';

/**
 * Everything the trainer lets you hear.
 *
 * The keys: recordings of real switches, one set per switch, played on every key
 * going down and coming back up. Off until a switch is picked.
 *
 * Hardcore's cues, all synthesized: a heartbeat in two thumps, a knock on a wrong
 * key, a tick when the floor climbs and a low drop when the fuse burns out.
 *
 * A streak's marks, synthesized too and heard only with a switch picked: a tick
 * on a milestone, three rising notes when the best streak falls.
 *
 * Nothing plays until `wake` has run inside a keypress or a click: browsers start
 * audio only from a user gesture.
 */

interface Thump {
  /** Pitch at the start and at the end, in Hz. */
  from: number;
  to: number;
  /** Length in seconds. */
  length: number;
  gain: number;
  /** Seconds from now. */
  delay?: number;
  /** An octave above, mixed in at this share so small speakers carry the thump. */
  overtone?: number;
  wave?: OscillatorType;
}

/** One recording, ready to play. */
interface Clip {
  buffer: AudioBuffer;
  /** Seconds of silence the file opens with: playback starts past them, so a key sounds the moment it lands. */
  lead: number;
}

/** A switch's recordings and the level that brings its loudest one to the same peak as every other switch's. */
interface SwitchSet {
  clips: Map<string, Clip>;
  level: number;
}

/** Peak the loudest recording of a set is brought to, before the output's own gain. */
const KEY_PEAK = 0.7;
/** A set recorded very quietly is raised this much at most. */
const MAX_LIFT = 4;
/** A release is the softer half of a keystroke. */
const RELEASE_LEVEL = 0.6;

export class Sound {
  /** Hardcore's cues: the heartbeat, the knock, the ticks and the drop. */
  cues = false;
  private switchId: SwitchId | null = null;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  /** The keys go straight to the speakers: the limiter on the other path would hold each click back a few milliseconds. */
  private keysOut: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  /** The files of each set, fetched once. Decoding waits for the audio output. */
  private files = new Map<SwitchId, Promise<Map<string, ArrayBuffer>>>();
  private sets = new Map<SwitchId, SwitchSet>();
  private decoding = new Map<SwitchId, Promise<SwitchSet | null>>();
  private auditions = 0;

  /** True while the keys have a sound. */
  get keys(): boolean {
    return this.switchId !== null;
  }

  /** Picks the switch the keys sound like, or none. Its recordings are fetched at once, so they are there for the first key. */
  use(sound: KeySound): void {
    this.switchId = sound === 'off' ? null : sound;
    if (!this.switchId) return;
    void this.fetchSet(this.switchId).catch(() => undefined);
    if (this.ctx) void this.load(this.switchId);
  }

  /** Call from a key event. Opens the audio output the first time, and wakes it if the browser put it to sleep. */
  wake(): void {
    if (!this.cues && !this.keys) return;
    this.open();
    if (this.switchId) void this.load(this.switchId);
  }

  /** A key going down. */
  press(code: string): void {
    const id = this.switchId;
    if (id) this.strike(id, pressSample(id, code));
  }

  /** A key coming back up. */
  release(code: string): void {
    const id = this.switchId;
    if (id) this.strike(id, releaseSample(id, code), RELEASE_LEVEL);
  }

  /**
   * Lets a switch be heard before it is picked: one key down and up. Call from a
   * click or a key in the list of switches. Only the latest request plays, so
   * moving down the list fast does not leave a trail of clicks behind.
   */
  audition(sound: KeySound): void {
    const turn = ++this.auditions;
    if (sound === 'off') return;
    this.open();
    void this.load(sound).then((set) => {
      if (!set || turn !== this.auditions) return;
      this.strike(sound, 'press-r2');
      this.strike(sound, 'release', RELEASE_LEVEL, 0.11);
    });
  }

  /** First thump of a heartbeat. `strength` runs 0 to 1 with the danger. */
  lub(strength: number): void {
    if (this.cues) this.thump({ from: 78, to: 42, length: 0.17, gain: 0.5 + 0.5 * strength, overtone: 0.38 });
  }

  /** Second thump: shorter, higher and softer. */
  dub(strength: number): void {
    if (this.cues) this.thump({ from: 98, to: 56, length: 0.12, gain: 0.32 + 0.36 * strength, overtone: 0.32 });
  }

  /** A wrong key: a dull knock. */
  typo(): void {
    if (!this.cues) return;
    this.thump({ from: 190, to: 74, length: 0.085, gain: 0.5, wave: 'triangle' });
    this.hiss(0.04, 1400, 0.16);
  }

  /** The floor climbed: two short ticks, the second higher. */
  climb(): void {
    if (!this.cues) return;
    this.thump({ from: 1175, to: 1175, length: 0.05, gain: 0.1 });
    this.thump({ from: 1568, to: 1568, length: 0.07, gain: 0.1, delay: 0.075 });
  }

  /** The fuse burnt out: a long low drop. */
  fail(): void {
    if (!this.cues) return;
    this.thump({ from: 110, to: 30, length: 0.85, gain: 1, overtone: 0.4 });
    this.hiss(0.5, 320, 0.3);
  }

  /** A streak reached a milestone: one soft, high tick over the keys. */
  tick(): void {
    if (this.keys) this.thump({ from: 1319, to: 1319, length: 0.07, gain: 0.06 });
  }

  /** The best streak fell: three quick notes going up. */
  chime(): void {
    if (!this.keys) return;
    [784, 1047, 1319].forEach((pitch, i) => this.thump({ from: pitch, to: pitch, length: 0.16, gain: 0.075, delay: i * 0.075, overtone: 0.2 }));
  }

  private get running(): boolean {
    return this.ctx !== null && this.out !== null && this.ctx.state === 'running';
  }

  /** Opens the audio output, or wakes it. Only a user gesture may call this. */
  private open(): void {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx({ latencyHint: 'interactive' });
        this.out = this.ctx.createGain();
        this.out.gain.value = 0.55;
        // A limiter: thumps that overlap never clip.
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.ratio.value = 12;
        this.out.connect(limiter).connect(this.ctx.destination);
        this.keysOut = this.ctx.createGain();
        this.keysOut.gain.value = 0.5;
        this.keysOut.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      // No audio output: the trainer stays silent.
      this.ctx = null;
    }
  }

  /** Fetches the files of a set. A set that failed to arrive is asked for again the next time. */
  private fetchSet(id: SwitchId): Promise<Map<string, ArrayBuffer>> {
    let pending = this.files.get(id);
    if (!pending) {
      pending = Promise.all(
        samplesOf(id).map(async (name): Promise<[string, ArrayBuffer]> => {
          const response = await fetch(`${import.meta.env.BASE_URL}switches/${id}/${name}.mp3`);
          if (!response.ok) throw new Error(`switch sound ${id}/${name}: ${response.status}`);
          return [name, await response.arrayBuffer()];
        }),
      ).then((entries) => new Map(entries));
      pending.catch(() => this.files.delete(id));
      this.files.set(id, pending);
    }
    return pending;
  }

  /** Decodes a set for the open audio output. Resolves to null when there is no output or the set cannot be had. */
  private load(id: SwitchId): Promise<SwitchSet | null> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    const ready = this.sets.get(id);
    if (ready) return Promise.resolve(ready);
    let pending = this.decoding.get(id);
    if (!pending) {
      pending = this.fetchSet(id)
        .then(async (files) => {
          const clips = new Map<string, Clip>();
          let peak = 0;
          for (const [name, data] of files) {
            // Decoding empties the buffer it is given, so it gets a copy and the fetched bytes stay whole.
            const buffer = await ctx.decodeAudioData(data.slice(0));
            const shape = shapeOf(buffer);
            peak = Math.max(peak, shape.peak);
            clips.set(name, { buffer, lead: shape.lead });
          }
          const set: SwitchSet = { clips, level: peak > 0 ? Math.min(MAX_LIFT, KEY_PEAK / peak) : 1 };
          this.sets.set(id, set);
          return set;
        })
        .catch(() => null)
        .finally(() => this.decoding.delete(id));
      this.decoding.set(id, pending);
    }
    return pending;
  }

  /** Plays one recording of a set. `delay` is in seconds from now. */
  private strike(id: SwitchId, name: string, level = 1, delay = 0): void {
    if (!this.running) return;
    const set = this.sets.get(id);
    const clip = set?.clips.get(name);
    if (!set || !clip) return;
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = clip.buffer;
    // No two strokes land alike: a hair of pitch and weight keeps one recording from sounding like a machine.
    source.playbackRate.value = 0.97 + Math.random() * 0.06;
    const gain = ctx.createGain();
    gain.gain.value = set.level * level * (0.86 + Math.random() * 0.14);
    source.connect(gain).connect(this.keysOut!);
    source.start(ctx.currentTime + delay, clip.lead);
  }

  private thump({ from, to, length, gain, delay = 0, overtone = 0, wave = 'sine' }: Thump): void {
    if (!this.running) return;
    const ctx = this.ctx!;
    const start = ctx.currentTime + delay;
    const end = start + length;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    envelope.connect(this.out!);
    const voices: [number, OscillatorType, number][] = [[1, wave, 1]];
    if (overtone > 0) voices.push([2, 'triangle', overtone]);
    for (const [ratio, type, level] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(from * ratio, start);
      osc.frequency.exponentialRampToValueAtTime(to * ratio, end);
      const mix = ctx.createGain();
      mix.gain.value = level;
      osc.connect(mix).connect(envelope);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }

  /** A burst of filtered noise: the grit in the knock and the tail of the drop. */
  private hiss(length: number, cutoff: number, gain: number): void {
    if (!this.running) return;
    const ctx = this.ctx!;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const start = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter).connect(envelope).connect(this.out!);
    source.start(start);
    source.stop(start + length + 0.02);
  }
}

/** How loud a recording gets, and how long it stays silent before its sound starts. */
function shapeOf(buffer: AudioBuffer): { peak: number; lead: number } {
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  // The sound starts where the wave first leaves the noise floor. Playback begins a hair earlier, so the attack is whole.
  const audible = peak * 0.05;
  let first = 0;
  while (first < data.length && Math.abs(data[first]) < audible) first++;
  return { peak, lead: Math.max(0, first / buffer.sampleRate - 0.002) };
}
