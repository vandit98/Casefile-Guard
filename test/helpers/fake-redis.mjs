export class FakeRedis {
  constructor() {
    this.hashes = new Map();
    this.strings = new Map();
    this.sortedSets = new Map();
    this.expirations = new Map();
  }

  async hSet(key, values) {
    const hash = this.hashes.get(key) || {};
    Object.assign(hash, values);
    this.hashes.set(key, hash);
  }

  async hGetAll(key) {
    return { ...(this.hashes.get(key) || {}) };
  }

  async incrBy(key, amount) {
    const next = Number(this.strings.get(key) || 0) + amount;
    this.strings.set(key, next);
    return next;
  }

  async zAdd(key, ...items) {
    const set = this.sortedSets.get(key) || new Map();
    for (const item of items) set.set(item.member, item.score);
    this.sortedSets.set(key, set);
  }

  async zRange(key, start, stop, options = {}) {
    const set = this.sortedSets.get(key) || new Map();
    const sorted = [...set.entries()]
      .sort(([, left], [, right]) => left - right)
      .map(([member]) => member);
    if (options.reverse) sorted.reverse();

    const length = sorted.length;
    const from = start < 0 ? Math.max(0, length + start) : start;
    const to = stop < 0 ? length + stop : stop;
    return sorted.slice(from, Math.min(length, to + 1)).map((member) => ({
      member,
      score: set.get(member),
    }));
  }

  async zRem(key, members) {
    const set = this.sortedSets.get(key);
    for (const member of members) set?.delete(member);
  }

  async expire(key, seconds) {
    this.expirations.set(key, seconds);
  }
}
