export const HOUSE_COLORS = [
  'hsl(142, 71%, 35%)',
  'hsl(221, 83%, 53%)',
  'hsl(25, 95%, 53%)',
  'hsl(280, 67%, 50%)',
  'hsl(350, 89%, 50%)',
  'hsl(190, 90%, 40%)',
  'hsl(45, 93%, 47%)',
  'hsl(330, 65%, 55%)',
];

export function colorForIndex(i) {
  return HOUSE_COLORS[i % HOUSE_COLORS.length];
}
