export function safeFromPairs(pairs: [string, any][], obj: any = {}): any {
  pairs.forEach(([key, value]) => {
    if (key in obj) throw new Error(`${key} defined more than once`);
    obj[key] = value;
  });

  return obj;
}
