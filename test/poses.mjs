// Shared synthetic skeletons (metres, hip centre origin, y down), used by the Node tests and the browser sim.
import { LM } from '../analyzer.js';

export const GUARD = {
  [LM.nose]: [0, -0.75, -0.05],
  [LM.lSh]: [0.18, -0.5, 0], [LM.rSh]: [-0.18, -0.5, 0],
  [LM.lEl]: [0.2, -0.25, -0.15], [LM.rEl]: [-0.2, -0.25, -0.15],
  [LM.lWr]: [0.12, -0.6, -0.2], [LM.rWr]: [-0.12, -0.6, -0.2],
  [LM.lHip]: [0.1, 0, 0], [LM.rHip]: [-0.1, 0, 0],
  [LM.lKn]: [0.12, 0.45, 0], [LM.rKn]: [-0.12, 0.45, 0],
  [LM.lAn]: [0.14, 0.9, 0], [LM.rAn]: [-0.14, 0.9, 0],
};

// Peak poses: only the joints that move.
export const PEAK = {
  jabL:   { [LM.lWr]: [0.15, -0.5, -0.6], [LM.lEl]: [0.165, -0.5, -0.3] },
  crossR: { [LM.rWr]: [-0.05, -0.5, -0.62], [LM.rEl]: [-0.12, -0.5, -0.31], [LM.lWr]: [0.1, -0.6, -0.12] },
  hookL:  { [LM.lEl]: [0.4, -0.48, -0.15], [LM.lWr]: [0.2, -0.5, -0.4] },
  upperR: { [LM.rEl]: [-0.15, -0.25, -0.3], [LM.rWr]: [-0.08, -0.6, -0.42] },
  midR:   { [LM.rKn]: [0, 0, -0.35], [LM.rAn]: [0.2, -0.05, -0.6], [LM.rWr]: [-0.3, -0.1, 0.1], [LM.rEl]: [-0.3, -0.3, 0] },
  lowR:   { [LM.rKn]: [-0.05, 0.25, -0.3], [LM.rAn]: [0.1, 0.45, -0.6] },
  highR:  { [LM.rKn]: [0.05, -0.25, -0.3], [LM.rAn]: [0.25, -0.45, -0.55] },
  kneeR:  { [LM.rKn]: [-0.1, -0.05, -0.4], [LM.rAn]: [-0.1, 0.3, -0.3] },
  step:   { [LM.lAn]: [0.14, 0.87, -0.25], [LM.lKn]: [0.12, 0.43, -0.12] },
  dropHandsJab: { [LM.lWr]: [0.15, -0.5, -0.6], [LM.lEl]: [0.165, -0.5, -0.3], [LM.rWr]: [-0.15, -0.1, -0.1], [LM.rEl]: [-0.2, -0.1, 0] },
};

// Same strike on the other side of the body.
export function mirror(peak) {
  const swap = { [LM.lSh]: LM.rSh, [LM.rSh]: LM.lSh, [LM.lEl]: LM.rEl, [LM.rEl]: LM.lEl, [LM.lWr]: LM.rWr, [LM.rWr]: LM.lWr,
    [LM.lHip]: LM.rHip, [LM.rHip]: LM.lHip, [LM.lKn]: LM.rKn, [LM.rKn]: LM.lKn, [LM.lAn]: LM.rAn, [LM.rAn]: LM.lAn };
  const out = {};
  for (const [i, p] of Object.entries(peak)) out[swap[i] ?? i] = [-p[0], p[1], p[2]];
  return out;
}
