const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
/** Kurze, URL-sichere IDs (kein externer Nanoid-Import nötig). */
export function newId(prefix = ''): string {
  let s = prefix;
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint8Array(12);
    cryptoObj.getRandomValues(buf);
    for (const b of buf) s += ALPHABET[b % ALPHABET.length];
  } else {
    for (let i = 0; i < 12; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}
