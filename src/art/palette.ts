// Master palette. Every sprite and background pulls from these ramps so the
// whole game reads as one coherent piece of pixel art.
// Ramps go light -> dark: [highlight, light, mid, shadow].

export type Ramp = readonly [number, number, number, number];

const hex = (s: string): number => parseInt(s.replace('#', ''), 16);
const ramp = (a: string, b: string, c: string, d: string): Ramp => [hex(a), hex(b), hex(c), hex(d)];

export const OUTLINE = hex('#140c1c');
export const OUTLINE_SOFT = hex('#2a1a33');

export const SKIN: Ramp[] = [
  ramp('#ffe0c4', '#f2bf98', '#d99572', '#a8664f'),
  ramp('#fbd2a8', '#e5ab7e', '#c4845c', '#8f5a3e'),
  ramp('#efc08e', '#d39a68', '#b0774b', '#7c5034'),
  ramp('#d9a273', '#bc8155', '#96603c', '#694028'),
  ramp('#bf865a', '#9e6a43', '#7c4f2e', '#56331d'),
  ramp('#a06b47', '#835434', '#643e24', '#452816'),
  ramp('#875a3c', '#6c442b', '#52321e', '#382013'),
  ramp('#6b4630', '#553522', '#3f2618', '#2a180e'),
];

export const P = {
  // cloth
  black: ramp('#4a4458', '#33303f', '#24212e', '#16141d'),
  charcoal: ramp('#6e6a7c', '#525061', '#3b3a49', '#272633'),
  grey: ramp('#b4b2bd', '#8e8c99', '#6b6977', '#4a4855'),
  navy: ramp('#5a6a9a', '#3f4c78', '#2d3759', '#1d233d'),
  khaki: ramp('#a8a070', '#857e53', '#635e3c', '#433f28'),
  olive: ramp('#7c8a52', '#5e6b3c', '#454f2c', '#2e351d'),
  burgundy: ramp('#a8475a', '#843246', '#612336', '#411626'),
  red: ramp('#ff6b5a', '#e0443c', '#b02a32', '#7a1a2a'),
  orange: ramp('#ffc15e', '#ff9a3c', '#e06a24', '#a8441c'),
  yellow: ramp('#fff3a0', '#ffd84a', '#e0a828', '#a8721c'),
  blue: ramp('#8fd3ff', '#4ca3f0', '#2f6fc4', '#22468a'),
  cyan: ramp('#c8fff8', '#6ef0f0', '#2fb8d0', '#1f7899'),
  green: ramp('#b8f07a', '#6ccc4a', '#3c9a3c', '#26663a'),
  white: ramp('#ffffff', '#e8e6f0', '#c4c2d0', '#9896a8'),
  denim: ramp('#7d9ad0', '#5a76ad', '#41598a', '#2c3d63'),
  denimDark: ramp('#5b6788', '#434d6b', '#30384f', '#202536'),
  // hair
  hairBlack: ramp('#4a3f52', '#2e2633', '#1f1a24', '#120e16'),
  hairBrown: ramp('#8a5a3a', '#6a4028', '#4c2c1c', '#301a10'),
  hairDark: ramp('#5a4030', '#3e2a1e', '#2a1c14', '#180f0a'),
  hairSalt: ramp('#b4a898', '#877a6c', '#5e5246', '#3c332b'),
  beard: ramp('#f0ece6', '#c8c2ba', '#9a938a', '#6a645c'),
  // materials
  steel: ramp('#e8eef8', '#b0bccc', '#7c889c', '#4f5869'),
  gold: ramp('#fff6b0', '#ffd24a', '#d89a28', '#9a5e1c'),
  glass: ramp('#e8fbff', '#a8e4f4', '#6cb4d4', '#3f7ea8'),
  cardboard: ramp('#f0d8a8', '#d4b480', '#b08e5c', '#7c6040'),
  // Niçois stone + façades
  ochre: ramp('#f6c88a', '#e8a868', '#c88448', '#9a6034'),
  rouge: ramp('#f0927a', '#d8705c', '#b05244', '#7e3834'),
  jaune: ramp('#fbe0a0', '#f0c478', '#d4a058', '#a87840'),
  rose: ramp('#f8c4b4', '#e8a094', '#c87c74', '#9a5858'),
  stone: ramp('#efe6d8', '#d4c8b4', '#ada08c', '#7c7264'),
  cream: ramp('#f4ecdc', '#e2d6c0', '#c4b69c', '#948870'),
  shutterWood: ramp('#ecd09a', '#cfa870', '#a8804c', '#735634'),
  shutterGreen: ramp('#8cc4a0', '#5e9c7c', '#3e7660', '#285446'),
  shutterGrey: ramp('#c4ccd4', '#9aa4b0', '#727c8c', '#4e5664'),
  asphalt: ramp('#5a5468', '#45405a', '#332f45', '#221f30'),
  pave: ramp('#c8bca8', '#a89c8a', '#857a6c', '#5e564c'),
  palm: ramp('#9ad468', '#5ea848', '#3c7a3c', '#24522e'),
  trunk: ramp('#c4a070', '#9a7a50', '#725838', '#4c3a26'),
  sea: ramp('#8ce0f0', '#4cb4dc', '#2c80b8', '#1c4e84'),
} as const;

// Dusk sky bands, top -> bottom.
export const SKY_DUSK = [
  '#1a0f2e', '#2a1640', '#3e1d52', '#5a2560', '#7c3066', '#a13e66', '#c85462', '#e8735a', '#f89a5a', '#ffc070',
].map(hex);

export const SKY_NIGHT = [
  '#0a0716', '#100b22', '#170f2e', '#1f143a', '#2a1946', '#371f50', '#45265a', '#552d62',
].map(hex);

export function rgb(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

export function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function toCss(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}
