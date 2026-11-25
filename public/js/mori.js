// 1.7.0: executions ("moris") for the six killers, each a short film: where the victim is held, the victim's body pose,
// what the killer's model does, the gore and sounds on each beat, and the camera: a list of shots with cuts between them,
// like Dead by Daylight's moris. Everything is a function of f (0..1 through the execution, RULES.execTime long) so every
// player in the match sees the same film from the host's timing.
//
// Frames: positions are given in the KILLER's frame [r, u, f]: r to the killer's right, u up from the floor, f toward the victim.
const cl = x => Math.max(0, Math.min(1, x));
export const ramp = (f, a, b) => cl((f - a) / (b - a));
export const sm = (f, a, b) => { const x = ramp(f, a, b); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;

// the victim lying face down and crawling, as they are when the execution starts
export const downPose = P => { P.tiltX = 1.45; P.hipsY = -0.75; P.shL = -2.5; P.shR = -2.4; P.elL = -0.3; P.elR = -0.3; P.lgL = 0.1; P.lgR = -0.1; P.knL = 0.3; P.knR = 0.3; P.headX = -0.5; P.spineX = 0; };
const backPose = P => { P.tiltX = -1.42; P.hipsY = -0.75; P.shL = -0.2; P.shR = -0.25; P.elL = -0.4; P.elR = -0.3; P.lgL = -0.05; P.lgR = 0.1; P.knL = 0.25; P.knR = 0.5; P.headX = 0.25; P.spineX = 0; };
const standPose = P => { P.tiltX = 0; P.hipsY = 0; P.spineX = 0; P.lgL = 0; P.lgR = 0; P.knL = 0.08; P.knR = 0.08; };
const kneelPose = P => { P.tiltX = 0; P.hipsY = -0.48; P.lgL = P.lgR = 0.05; P.knL = P.knR = 1.55; P.spineX = 0.15; };
const blend = (P, Q, k) => { for (const key in Q) P[key] = lerp(P[key] ?? 0, Q[key], k); };
const poseOf = fn => { const Q = {}; fn(Q); return Q; };
const DOWN = poseOf(downPose), BACK = poseOf(backPose), KNEEL = poseOf(kneelPose);

// a shot: from f0 to the next shot's f0; the camera moves from c0 to c1 looking from l0 to l1, lens fov
const shot = (f0, c0, c1, l0, l1, fov = 45, roll = 0) => ({ f0, c0, c1, l0, l1, fov, roll });

export const MORI = {
  // ---------------------------------------------------------------- Granny: Bedtime Trap
  granny: {
    title: 'Bedtime Trap',
    // kneeling with their back to her, the trap set in front of their face
    place: f => ({ d: 0.95, side: 0, y: 0, yaw: 0 }),
    victim(P, f, t) {
      if (f < 0.1) { downPose(P); return; }
      const push = ramp(f, 0.36, 0.55), alive = 1 - ramp(f, 0.6, 0.85);
      kneelPose(P); P.tiltX = push * 0.35; P.spineX = 0.15 + push * 1.05; P.headX = -0.35 + push * 0.6;
      if (f < 0.36) { P.shL = -0.9 + Math.sin(t * 10) * 0.25; P.shR = -0.8 - Math.sin(t * 9) * 0.25; P.elL = P.elR = -1.2; P.headY = Math.sin(t * 7) * 0.35; }
      else { P.shL = -1.6 * alive - 0.2 + Math.sin(t * 17) * 0.4 * alive; P.shR = -1.5 * alive - 0.2 - Math.sin(t * 15) * 0.4 * alive; P.elL = P.elR = -0.3; }
    },
    shots: [
      shot(0, [2.6, 0.55, 1.1], [2.25, 0.62, 1.35], [0, 0.75, 1.0], [0, 0.8, 1.0], 50),
      shot(0.3, [0.5, 0.32, 3.0], [0.36, 0.3, 2.6], [0, 0.75, 0.9], [0, 0.6, 1.1], 42),
      shot(0.53, [0.95, 0.18, 1.78], [0.82, 0.22, 1.72], [0, 0.2, 1.62], [0, 0.22, 1.66], 38, 0.14),
      shot(0.74, [-0.6, 1.9, -1.3], [-0.5, 3.0, -0.6], [0, 0.3, 1.3], [0, 0.2, 1.4], 50),
    ],
  },
  // ---------------------------------------------------------------- Grandpa: Last Round
  grandpa: {
    title: 'Last Round',
    // rolled onto their back at his feet, head toward him; he stands over them with the shotgun
    place: f => ({ d: lerp(1.05, 1.3, sm(f, 0.05, 0.14)), side: 0, y: 0, yaw: 0 }),
    victim(P, f, t) {
      const roll = sm(f, 0.04, 0.16);
      if (roll < 1) { blend(P, DOWN, 1); blend(P, BACK, roll); }
      else backPose(P);
      if (f >= 0.14 && f < 0.48) { // begging, hands up in front of the barrel
        const sh = Math.sin(t * 14) * 0.12;
        P.shL = -1.55 + sh; P.shR = -1.45 - sh; P.elL = -1.25; P.elR = -1.35; P.headX = 0.45 + Math.sin(t * 9) * 0.08; P.headY = Math.sin(t * 6) * 0.4;
        P.knL = 0.9 + Math.sin(t * 5) * 0.2; P.lgL = -0.5; P.knR = 0.6;
      } else if (f >= 0.48 && f < 0.74) { // hit: arms flung out, twitching
        const tw = Math.max(0, 1 - (f - 0.48) / 0.12);
        P.shL = 0.25 + tw * 0.6; P.shR = 0.3; P.shLz = 1.3; P.shRz = -1.2; P.elL = -0.2; P.elR = -0.4; P.headX = -0.2 + Math.sin(t * 30) * 0.08 * tw; P.headZ = 0.4;
        P.knL = 0.4 + Math.sin(t * 21) * 0.25 * tw; P.knR = 0.3;
      } else if (f >= 0.74) { P.shL = 0.3; P.shR = 0.35; P.shLz = 1.4; P.shRz = -1.35; P.elL = -0.1; P.elR = -0.15; P.headX = -0.3; P.headZ = 0.9; P.knL = 0.15; P.knR = 0.35; }
    },
    // what Grandpa's model does: raise the gun and point it down; two shots, each followed by the pump
    killer(f) {
      const o = { aim: f > 0.12 && f < 0.88, bend: sm(f, 0.12, 0.26) * (1 - sm(f, 0.86, 0.96)) * 0.62 };
      if (f >= 0.3 && f < 0.42) o.pump = (f - 0.3) / 0.12;
      if (f >= 0.48 && f < 0.56) o.shot = (f - 0.48) / 0.08;
      if (f >= 0.6 && f < 0.7) o.pump = (f - 0.6) / 0.1;
      if (f >= 0.74 && f < 0.82) o.shot = (f - 0.74) / 0.08;
      return o;
    },
    shots: [
      shot(0, [0.55, 0.22, 2.75], [0.42, 0.28, 2.4], [0, 1.25, 0.15], [0, 1.3, 0.2], 46),
      shot(0.28, [1.45, 1.3, 0.55], [1.28, 1.3, 0.7], [0, 1.1, 0.55], [0, 1.05, 0.6], 40),
      shot(0.45, [-0.85, 1.9, -0.95], [-0.75, 1.82, -0.8], [0, 0.3, 1.0], [0, 0.25, 1.05], 46),
      shot(0.62, [-2.6, 0.45, 1.3], [-2.4, 0.5, 1.1], [0, 0.65, 0.9], [0, 0.7, 0.85], 48),
      shot(0.8, [-1.3, 0.22, 2.7], [-1.05, 0.26, 2.45], [0, 0.75, 0.35], [0, 0.85, 0.3], 44),
    ],
  },
  // ---------------------------------------------------------------- Slendrina: Look at Me
  slendrina: {
    title: 'Look at Me',
    // lifted by the throat to her face, held there; the neck goes; dropped
    place: f => ({ d: lerp(0.95, 0.6, sm(f, 0.05, 0.2)), side: 0, y: sm(f, 0.08, 0.24) * 0.32 * (1 - sm(f, 0.86, 0.9)), yaw: Math.PI }),
    victim(P, f, t) {
      if (f < 0.08) { downPose(P); return; }
      if (f >= 0.88) { backPose(P); P.headZ = 1.1; P.shLz = 0.8; P.shRz = -0.6; P.headX = 0.1; return; }
      standPose(P);
      const life = 1 - sm(f, 0.7, 0.74);
      P.shL = lerp(0.1, -1.35, life) + Math.sin(t * 13) * 0.15 * life; P.shR = lerp(0.1, -1.4, life) - Math.sin(t * 11) * 0.15 * life;
      P.elL = lerp(-0.1, -1.95, life); P.elR = lerp(-0.1, -1.9, life); P.shLz = 0.35 * life; P.shRz = -0.35 * life;
      P.lgL = (Math.sin(t * 12) * 0.45 - 0.2) * life; P.lgR = (-Math.sin(t * 12) * 0.45 - 0.1) * life; P.knL = 0.4 + Math.sin(t * 9) * 0.3 * life; P.knR = 0.35;
      P.headX = lerp(0.5, -0.3, life) ; P.headZ = (1 - life) * 1.15; P.spineX = -0.1 * life;
    },
    shots: [
      shot(0, [2.4, 0.5, 0.35], [2.15, 0.72, 0.5], [0, 1.35, 0.4], [0, 1.5, 0.45], 48),
      shot(0.25, [1.12, 1.78, 0.34], [0.95, 1.76, 0.33], [0, 1.82, 0.34], [0, 1.82, 0.34], 40),
      shot(0.5, [-0.5, 2.0, -0.2], [-0.42, 1.96, -0.08], [0, 1.82, 0.62], [0, 1.8, 0.62], 38),
      shot(0.7, [0.5, 0.85, 1.95], [0.45, 0.92, 1.82], [0, 1.85, 0.2], [0, 1.8, 0.25], 42),
      shot(0.86, [-2.3, 2.4, 2.0], [-2.5, 2.8, 2.25], [0, 0.35, 0.65], [0, 0.25, 0.7], 48),
    ],
  },
  // ---------------------------------------------------------------- Angeline: Hush Now
  angeline: {
    title: 'Hush Now',
    // held close and rocked, then her claws go in through the back; she lets them slide down her
    place: f => ({ d: lerp(1.0, 0.5, sm(f, 0.04, 0.18)) + sm(f, 0.82, 0.92) * 0.45, side: 0, y: sm(f, 0.2, 0.32) * 0.12 * (1 - sm(f, 0.8, 0.88)), yaw: Math.PI }),
    victim(P, f, t) {
      if (f < 0.06) { downPose(P); return; }
      if (f >= 0.92) { backPose(P); P.shLz = 0.9; P.shRz = -0.4; P.headX = 0.1; P.headZ = 0.6; P.knL = 0.8; P.lgL = -0.5; return; }
      standPose(P);
      if (f < 0.54) {
        const sleepy = sm(f, 0.2, 0.5);
        P.shL = lerp(-1.3, -0.15, sleepy) + Math.sin(t * 8) * 0.12 * (1 - sleepy); P.shR = lerp(-1.25, -0.1, sleepy);
        P.elL = lerp(-1.1, -0.2, sleepy); P.elR = lerp(-1.0, -0.25, sleepy);
        P.headX = 0.2 + sleepy * 0.2; P.headZ = 0.25 + sleepy * 0.25; P.spineX = 0.1; P.knL = 0.15 + sleepy * 0.2; P.knR = 0.2 + sleepy * 0.2;
      } else if (f < 0.82) {
        const jolt = Math.max(0, 1 - (f - 0.54) / 0.1), tw = Math.sin(t * 26) * 0.12 * (1 - ramp(f, 0.6, 0.8));
        P.spineX = -0.45 * (0.4 + jolt * 0.6); P.headX = -0.75 * (0.5 + jolt * 0.5); P.shL = -0.55 + tw; P.shR = -0.6 - tw; P.shLz = 1.0 * jolt + 0.3; P.shRz = -1.0 * jolt - 0.3; P.elL = P.elR = -0.3;
        P.knL = 0.3 + tw; P.knR = 0.35;
      } else { blend(P, KNEEL, 1); P.spineX = 0.5; P.headX = 0.6; P.shL = 0.15; P.shR = 0.1; P.elL = P.elR = -0.1; }
    },
    killer(f) { return { atk: -1, hug: sm(f, 0.06, 0.18) * (1 - sm(f, 0.8, 0.88)), pin: sm(f, 0.52, 0.56) }; },
    shots: [
      shot(0, [2.2, 1.3, 1.55], [1.4, 1.25, 2.2], [0, 1.3, 0.45], [0, 1.35, 0.45], 45),
      shot(0.3, [-0.62, 1.72, 1.2], [-0.52, 1.7, 1.05], [0, 1.68, 0.12], [0, 1.68, 0.12], 38),
      shot(0.52, [0.62, 0.9, 1.85], [0.5, 1.0, 1.65], [0, 1.25, 0.5], [0, 1.2, 0.5], 44),
      shot(0.76, [2.4, 2.6, -0.8], [2.6, 3.0, -1.0], [0, 0.6, 0.6], [0, 0.4, 0.6], 48),
    ],
  },
  // ---------------------------------------------------------------- Nosferatu: The Last Feed
  nosferatu: {
    title: 'The Last Feed',
    // hauled up by the collar, head pushed aside, bitten; drained; torn loose and dropped
    place: f => ({ d: lerp(1.0, 0.55, sm(f, 0.04, 0.18)) + sm(f, 0.8, 0.86) * 0.35, side: sm(f, 0.8, 0.88) * 0.25, y: sm(f, 0.1, 0.2) * 0.14 * (1 - sm(f, 0.8, 0.84)), yaw: Math.PI }),
    victim(P, f, t) {
      if (f < 0.07) { downPose(P); return; }
      if (f >= 0.86) { blend(P, BACK, 1); P.headZ = -0.9; P.shLz = 1.1; P.shRz = -0.5; P.knL = 0.6; return; }
      standPose(P);
      const drain = sm(f, 0.34, 0.8), jolt = f > 0.32 ? Math.max(0, 1 - (f - 0.32) / 0.08) : 0;
      P.headZ = -0.85 * sm(f, 0.15, 0.3); P.headX = -0.2 + drain * 0.35;
      P.shL = lerp(-0.75, 0.12, drain) + jolt * 0.5 + Math.sin(t * 12) * 0.12 * (1 - drain); P.shR = lerp(-0.7, 0.15, drain) - jolt * 0.4;
      P.elL = lerp(-1.55, -0.1, drain); P.elR = lerp(-1.6, -0.15, drain); P.shLz = jolt * 0.8; P.shRz = -jolt * 0.7;
      P.knL = 0.1 + drain * 0.45; P.knR = 0.12 + drain * 0.4; P.spineX = -0.15 * jolt + drain * 0.15;
      if (f > 0.8) { P.tiltX = -sm(f, 0.8, 0.86) * 1.2; }
    },
    killer(f) { return { scrub: f < 0.3 ? 0.25 + f * 0.3 : f < 0.8 ? 0.36 : 0.36 + ramp(f, 0.8, 0.9) * 0.3, lean: f > 0.25 && f < 0.82 ? 0.42 : 0.2 }; },
    shots: [
      shot(0, [1.9, 0.6, 1.8], [1.6, 0.75, 1.6], [0, 1.35, 0.45], [0, 1.4, 0.45], 46),
      shot(0.3, [0.36, 1.66, 0.98], [0.3, 1.63, 0.9], [0.05, 1.55, 0.35], [0.05, 1.55, 0.35], 36),
      shot(0.5, [-1.4, 1.5, 0.4], [-1.0, 1.5, 0.4], [0, 1.45, 0.35], [0, 1.45, 0.35], 42),
      shot(0.78, [2.6, 0.7, 0.95], [2.5, 0.75, 1.0], [0, 1.0, 0.7], [0, 0.8, 0.8], 50),
      shot(0.9, [-0.45, 0.2, 2.2], [-0.4, 0.22, 2.1], [0, 1.4, 0], [0, 1.45, 0], 46),
    ],
  },
  // ---------------------------------------------------------------- Slendrina's Father: Into the Trees
  father: {
    title: 'Into the Trees',
    // his tendrils lift them up to his blank face, then go through them; dropped
    place: f => ({ d: lerp(1.0, 0.8, sm(f, 0.05, 0.2)), side: 0, y: sm(f, 0.1, 0.38) * 0.9 * (1 - sm(f, 0.86, 0.9)), yaw: Math.PI }),
    victim(P, f, t) {
      if (f < 0.08) { downPose(P); return; }
      if (f >= 0.9) { backPose(P); P.shLz = 1.3; P.shRz = -1.4; P.headZ = 0.7; P.knL = 0.7; P.lgL = -0.4; return; }
      standPose(P);
      const life = 1 - sm(f, 0.66, 0.8), jolt = f > 0.62 ? Math.max(0, 1 - (f - 0.62) / 0.07) : 0;
      P.shLz = 1.25 + Math.sin(t * 7) * 0.15 * life; P.shRz = -1.25 - Math.sin(t * 8) * 0.15 * life; P.shL = -0.3 - jolt * 0.4; P.shR = -0.35 - jolt * 0.4; P.elL = P.elR = -0.2 - life * 0.3;
      P.lgL = (Math.sin(t * 11) * 0.5 - 0.15) * life - jolt * 0.5; P.lgR = (-Math.sin(t * 11) * 0.5 - 0.1) * life - jolt * 0.4; P.knL = 0.5 * life + 0.2; P.knR = 0.4 * life + 0.25;
      P.spineX = -0.45 * jolt + (1 - life) * 0.35; P.headX = -0.55 * life + (1 - life) * 0.7 - jolt * 0.3;
    },
    shots: [
      shot(0, [1.25, 0.22, 2.05], [1.0, 0.3, 1.75], [0, 1.9, 0.6], [0, 2.1, 0.6], 50),
      shot(0.36, [1.15, 2.15, 2.5], [0.95, 2.3, 2.0], [0, 2.3, 0.3], [0, 2.4, 0.2], 40),
      shot(0.6, [-2.8, 1.9, 1.0], [-2.6, 2.0, 0.9], [0, 1.9, 0.75], [0, 1.8, 0.75], 46),
      shot(0.86, [0.8, 3.5, 0.2], [0.9, 3.9, 0.1], [0, 0, 0.9], [0, 0, 0.9], 45),
    ],
  },
};

// the shot at f: camera position, the point looked at, fov, roll, and the shot's index (a new index = a cut)
export function moriShot(ch, f) {
  const M = MORI[ch]; if (!M) return null;
  let i = 0; while (i + 1 < M.shots.length && f >= M.shots[i + 1].f0) i++;
  const S = M.shots[i], f1 = i + 1 < M.shots.length ? M.shots[i + 1].f0 : 1;
  const k = sm(f, S.f0, f1) * 0.85 + ramp(f, S.f0, f1) * 0.15; // eased push, never fully stopped
  const v = (a, b) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  return { i, cam: v(S.c0, S.c1), look: v(S.l0, S.l1), fov: S.fov, roll: S.roll };
}
