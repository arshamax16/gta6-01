// Solmar Bay — a tiny seeded random generator (mulberry32) so the city,
// traffic and screenshot staging are reproducible from a seed.

export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one element of an array using the seeded generator.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Integer in [min, max] inclusive.
export function intBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Float in [min, max).
export function floatBetween(rng, min, max) {
  return min + rng() * (max - min);
}
