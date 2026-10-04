import { describe, expect, it } from 'vitest';
import { ask, compare, decide, holds, parseCond, parsePolicy, universe, showIp, type Request, type Statement, type Cond } from './policy';
import { rng } from '../util/random';

const BUCKET = parsePolicy(`
# The logs bucket: the office network may read; the ingest service may write; nobody deletes.
allow read on logs/* if ip in 10.0.0.0/8
allow write on logs/* if user == ingest
allow * on public/*
deny delete on *
deny * on secrets/* if !mfa
`);

/** Every request over the universe, with IPs from the boundaries of the ranges mentioned plus random ones. */
function requests(policies: Statement[][], qs: Cond[], seed = 7): Request[] {
  const u = universe(policies, qs);
  const ips = new Set<number>([0, 0xffffffff]);
  const r = rng(seed);
  for (let i = 0; i < 12; i++) ips.add(r.nextU32());
  const walk = (c: Cond) => {
    if (c.k === 'ip') {
      const size = 2 ** (32 - c.bits);
      for (const x of [c.net - 1, c.net, c.net + size - 1, c.net + size]) ips.add(x >>> 0);
    }
    if (c.k === 'not') walk(c.a);
    if (c.k === 'and' || c.k === 'or') {
      walk(c.a);
      walk(c.b);
    }
  };
  policies.flat().forEach((s) => walk(s.cond));
  qs.forEach(walk);
  const out: Request[] = [];
  for (const user of u.users) for (const action of u.actions) for (const s0 of u.segments) for (const s1 of [undefined, ...u.segments]) for (const ip of ips) for (const mfa of [false, true]) out.push({ user, action, resource: s1 === undefined ? [s0] : [s0, s1], ip, mfa });
  return out;
}

describe('access policies', () => {
  it('parses statements and conditions', () => {
    expect(BUCKET).toHaveLength(5);
    expect(BUCKET[0]!.cond).toEqual({ k: 'ip', net: 0x0a000000, bits: 8 });
    expect(() => parsePolicy('allow read logs/*')).toThrow(/Line 1/);
    expect(() => parseCond('ip in 300.0.0.0/8')).toThrow();
    expect(showIp(0x0a000001)).toBe('10.0.0.1');
  });
  it('explicit deny wins over allow', () => {
    const r: Request = { user: 'ingest', action: 'delete', resource: ['public', 'x'], ip: 1, mfa: true };
    expect(decide(BUCKET, r).allowed).toBe(false);
    expect(decide(BUCKET, { ...r, action: 'read' }).allowed).toBe(true);
  });
  it('answers questions, with examples that replay and refutations that hold on every enumerated request', () => {
    const questions = ['action == write && !(user == ingest) && resource in logs/*', 'action == read && resource in logs/* && !(ip in 10.0.0.0/8)', 'action == delete', 'resource in secrets/* && !mfa', 'resource in secrets/*'];
    const expected = [false, false, false, false, false];
    questions.forEach((q, i) => {
      const c = parseCond(q);
      const a = ask(BUCKET, c);
      expect([q, a.found]).toEqual([q, expected[i]]);
      if (a.found) expect(a.replayed).toBe(true);
      else {
        expect([q, a.status, a.certified]).toEqual([q, 'unsat', true]);
        expect(requests([BUCKET], [c]).some((r) => decide(BUCKET, r).allowed && holds(c, r))).toBe(false);
      }
    });
    const pub = ask(BUCKET, parseCond('action == write && !(ip in 10.0.0.0/8)'));
    expect(pub.found && pub.replayed).toBe(true);
  });
  it('compares policies', () => {
    const tighter = parsePolicy(`
allow read on logs/* if ip in 10.1.0.0/16
allow write on logs/* if user == ingest && mfa
deny delete on *
`);
    // The tighter policy allows less: comparing it against the original finds nothing.
    const none = compare(tighter, BUCKET);
    expect([none.status, none.certified]).toEqual(['unsat', true]);
    expect(requests([tighter, BUCKET], []).some((r) => decide(tighter, r).allowed && !decide(BUCKET, r).allowed)).toBe(false);
    // The original allows something the tighter one does not, and the example replays.
    const some = compare(BUCKET, tighter);
    expect(some.found && some.replayed).toBe(true);
  });
});
