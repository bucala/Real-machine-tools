import { afterEach, describe, expect, it } from 'vitest';
import { PREFS } from '../src/core/i18n';
import { brakeSetup } from '../src/machines/precision/pressBrakeProcess';
import { compileEdmGcode } from '../src/machines/precision/edmGcode';
import { interpret } from '../src/machines/cnc/gcode';
import { defaultTools } from '../src/machines/cnc/tooling';

// hlášky musia byť v jednom jazyku podľa predvoľby, nie „slovensky / English“ naraz
const cfg = { material: 'steel', thickness: 4, length: 2400, depth: 600, flange: 150, v: 16, angle: 90 };
const message = (fn) => { try { fn(); } catch (e) { return e.message; } return ''; };

describe('lokalizácia hlášok procesov', () => {
  afterEach(() => { PREFS.lang = 'sk'; });
  it('ohraňovací lis hlási chybu len v zvolenom jazyku', () => {
    expect(message(() => brakeSetup(cfg))).toBe('V-matrica je príliš úzka pre hrúbku plechu.');
    PREFS.lang = 'en';
    expect(message(() => brakeSetup(cfg))).toBe('V-die is too narrow.');
  });
  it('NC elektroerózie a interpreter CNC prekladajú hlásky', () => {
    PREFS.lang = 'en';
    expect(message(() => compileEdmGcode('G21\nG2 X1'))).not.toMatch(/[áäčďéíľňóôšťúýž]/i);
    const pr = interpret('T3 M6\nG1 X10', { o54: [0, 0, 90], tools: defaultTools() });
    expect(pr.errors[0].text).toBe('feed F is not programmed');
  });
});
