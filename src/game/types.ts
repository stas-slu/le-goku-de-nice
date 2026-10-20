import type { EnemyKind, MoveDef } from './defs';

export type Team = 'hero' | 'enemy';

export type FState =
  | 'idle' | 'walk' | 'run' | 'attack' | 'jump' | 'hurt' | 'fall' | 'down' | 'getup'
  | 'grab' | 'grabbed' | 'thrown' | 'dead' | 'super' | 'steal' | 'carry' | 'ride'
  | 'taunt' | 'pickup' | 'cross' | 'respawn' | 'land';

export interface AiState {
  mode: string;
  t: number;
  cd: number;
  offY: number;
  side: 1 | -1;
  passes: number;
  rideY: number;
  summoned: boolean;
  stealT: number;
  holdId: string | null;
}

export interface Fighter {
  id: number;
  team: Team;
  kind: 'hero' | EnemyKind;
  variant: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  recover: number;
  state: FState;
  t: number;
  stun: number;
  move: MoveDef | null;
  moveId: string;
  moveT: number;
  hitIds: Set<number>;
  queued: string | null;
  anim: string;
  frame: number;
  freeze: number;
  flash: number;
  invuln: number;
  juggle: number;
  grabT: number;
  grabOther: number;
  grabHits: number;
  body: { w: number; h: number };
  armor: boolean;
  ai: AiState | null;
  loot: number;
  boss: boolean;
  entered: boolean;
  remove: boolean;
  scooter: 'small' | 'big' | null;
  rideHits: Set<number>;
  idleT: number;
  /** Jitter amplitude while frozen in hitstop (impact feel). */
  shake: number;
}

export interface Hold {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface Projectile {
  id: number;
  kind: 'bottle';
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  owner: number;
  remove: boolean;
}

export type PickupKind = 'glasses' | 'socca' | 'panbagnat' | 'scooter';

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  t: number;
  remove: boolean;
}

export interface Standee {
  phase: 'wake' | 'leap' | 'charge' | 'fire' | 'back';
  t: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  facing: 1 | -1;
  fromProp: boolean;
}

export type GameEvent =
  | { type: 'hit'; x: number; y: number; z: number; heavy: boolean; toHero: boolean; dmg: number }
  | { type: 'whoosh'; heavy: boolean }
  | { type: 'land'; x: number; y: number; big: boolean }
  | { type: 'ko'; x: number; y: number; kind: string; boss: boolean }
  | { type: 'glassesOff'; x: number; y: number }
  | { type: 'glassesOn' }
  | { type: 'glass'; x: number; y: number; z: number }
  | { type: 'loot'; x: number; y: number; amount: number }
  | { type: 'stolen'; amount: number }
  | { type: 'stealing'; x: number; y: number }
  | { type: 'text'; key: string; x: number; y: number }
  | { type: 'cheer' }
  | { type: 'warn'; x: number; y: number; side: number }
  | { type: 'super' }
  | { type: 'beam' }
  | { type: 'scooter'; x: number; y: number; big: boolean }
  | { type: 'pickup'; kind: PickupKind }
  | { type: 'heroDown' }
  | { type: 'respawn' }
  | { type: 'go' }
  | { type: 'boss'; key: string }
  | { type: 'stageClear' }
  | { type: 'gameOver' }
  | { type: 'throw' }
  | { type: 'impact'; x: number; y: number; z: number; dir: number }
  | { type: 'wall'; x: number; y: number; z: number }
  | { type: 'combo'; n: number }
  | { type: 'jump' };

export interface Intent {
  mx: number;
  my: number;
  run: boolean;
  attack: boolean;
  jump: boolean;
  special: boolean;
}

export const NO_INTENT: Intent = { mx: 0, my: 0, run: false, attack: false, jump: false, special: false };
