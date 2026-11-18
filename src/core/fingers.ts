export const FINGERS = ['LP', 'LR', 'LM', 'LI', 'LT', 'RT', 'RI', 'RM', 'RR', 'RP'] as const;
export type Finger = (typeof FINGERS)[number];
export type FingerKind = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';
export type Hand = 'left' | 'right';

const KIND: Record<Finger, FingerKind> = {
  LP: 'pinky', LR: 'ring', LM: 'middle', LI: 'index', LT: 'thumb',
  RT: 'thumb', RI: 'index', RM: 'middle', RR: 'ring', RP: 'pinky',
};

/** Highway lane per finger: four left lanes, one shared thumb lane, four right lanes. */
const LANE: Record<Finger, number> = {
  LP: 0, LR: 1, LM: 2, LI: 3, LT: 4, RT: 4, RI: 5, RM: 6, RR: 7, RP: 8,
};

export const LANE_COUNT = 9;
export const FINGER_KINDS: FingerKind[] = ['pinky', 'ring', 'middle', 'index'];

export const fingerKind = (finger: Finger): FingerKind => KIND[finger];
export const fingerHand = (finger: Finger): Hand => (finger[0] === 'L' ? 'left' : 'right');
export const fingerLane = (finger: Finger): number => LANE[finger];
export const fingerName = (finger: Finger): string => `${fingerHand(finger)} ${KIND[finger]}`;

/** The fingers this trainer exists for. */
export const isWeakFinger = (finger: Finger): boolean => KIND[finger] === 'pinky' || KIND[finger] === 'ring';
