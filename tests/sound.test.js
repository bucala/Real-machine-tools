import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('starts muted even when sound was enabled in a previous session', async () => {
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ sound: true, lang: 'en' }) });
  const { PREFS } = await import('../src/core/i18n');
  expect(PREFS.sound).toBe(false);
  expect(PREFS.lang).toBe('en');
});

it('mutes the shared output immediately even when a machine still has active sound nodes', async () => {
  const gains = [],
    param = () => ({ value: 0, setTargetAtTime: vi.fn() });
  const node = () => ({
    gain: param(),
    frequency: param(),
    Q: param(),
    connect() {},
    start() {},
    stop() {},
    disconnect() {},
  });
  class AudioContext {
    currentTime = 1;
    sampleRate = 100;
    state = 'running';
    destination = {};
    createGain() {
      const n = node();
      gains.push(n);
      return n;
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(200) };
    }
    createBufferSource() {
      return node();
    }
    createOscillator() {
      return node();
    }
    createBiquadFilter() {
      return node();
    }
    resume() {
      return Promise.resolve();
    }
  }
  vi.stubGlobal('window', { AudioContext, addEventListener() {} });
  const { PREFS } = await import('../src/core/i18n');
  const { createSound, setSoundOn } = await import('../src/core/sound');
  PREFS.sound = false;
  const machine = createSound('mill');
  machine.update({ motor: 1 });
  expect(gains).toHaveLength(0);
  PREFS.sound = true;
  setSoundOn(true);
  machine.update({ motor: 1 });
  const master = gains[0];
  expect(gains.length).toBeGreaterThan(1);
  expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.7, 1, 0.05);
  PREFS.sound = false;
  setSoundOn(false);
  expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1, 0.05);
  machine.dispose();
});
