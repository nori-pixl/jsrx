class State {
  constructor(isEnd = false) {
    this.isEnd = isEnd;
    this.matchFn = null;
    this.out1 = null;
    this.out2 = null;
    this.tag = null;
  }
}
class Frag {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}
function compileExtendedPattern(p) {
  const stack = [];
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '|') {
      if (stack.length < 2) continue;
      const r = stack.pop(), l = stack.pop();
      const s = new State(), e = new State();
      s.out1 = l.start; s.out2 = r.start;
      l.end.out1 = e; r.end.out1 = e;
      stack.push(new Frag(s, e));
    } else if (c === '*' || c === '+') {
      if (stack.length === 0) continue;
      const old = stack.pop();
      const s = c === '*' ? new State() : old.start;
      const e = new State();
      if (c === '*') { s.out1 = old.start; s.out2 = e; }
      old.end.out1 = old.start; old.end.out2 = e;
      stack.push(new Frag(s, e));
    } else if (c === '\\' && p[i + 1] === 'd') {
      i++;
      const s = new State(), e = new State();
      s.matchFn = (ch) => ch >= '0' && ch <= '9';
      s.out1 = e;
      connectOrPush(stack, s, e);
    } else if (c === '.') {
      const s = new State(), e = new State();
      s.matchFn = (ch) => ch !== '\n';
      s.out1 = e;
      connectOrPush(stack, s, e);
    } else if (c === '(' || c === ')') {
      const s = new State(), e = new State();
      s.tag = c === '(' ? 'START' : 'END';
      s.out1 = e;
      connectOrPush(stack, s, e);
    } else {
      const s = new State(), e = new State();
      s.matchFn = (ch) => ch === c;
      s.out1 = e;
      connectOrPush(stack, s, e);
    }
  }
  if (stack.length === 0) return null;
  const res = stack.pop();
  res.end.isEnd = true;
  return res.start;
}
function connectOrPush(stack, s, e) {
  if (stack.length > 0) {
    const prev = stack.pop();
    prev.end.out1 = s;
    stack.push(new Frag(prev.start, e));
  } else {
    stack.push(new Frag(s, e));
  }
}
function addExtendedState(s, set, idx, h) {
  if (!s || set.has(s)) return;
  set.add(s);
  if (s.tag) h.set(s.tag, idx);
  if (s.matchFn === null) {
    addExtendedState(s.out1, set, idx, h);
    addExtendedState(s.out2, set, idx, h);
  }
}
function matchExtendedNfa(start, text) {
  if (!start) return null;
  let current = new Set();
  const h = new Map();
  addExtendedState(start, current, 0, h);
  for (let i = 0; i < text.length; i++) {
    const next = new Set();
    for (const s of current) {
      if (s.matchFn && s.matchFn(text[i])) {
        addExtendedState(s.out1, next, i + 1, h);
      }
    }
    current = next;
    if (current.size === 0) break;
  }
  if (Array.from(current).some(s => s.isEnd)) {
    const startIdx = h.get('START'), endIdx = h.get('END');
    const cap = (startIdx !== undefined && endIdx !== undefined) ? text.slice(startIdx, endIdx) : text;
    return { success: true, captured: cap };
  }
  return null;
}
const cache = new Map();
const presets = {
  num: '\\d+',
  sqlUrl: '.*://.*/.*\\?exec=(.*)'
};
function run(text, pattern) {
  let nfa = cache.get(pattern);
  if (!nfa) {
    nfa = compileExtendedPattern(pattern);
    cache.set(pattern, nfa);
  }
  return matchExtendedNfa(nfa, text);
}
export function rx(text, pattern) {
  const r = run(text, pattern);
  return r ? r.captured : null;
}
rx.num = (text) => {
  const r = run(text, presets.num);
  return r ? r.captured : null;
};
rx.sql = (text) => {
  const r = run(text, presets.sqlUrl);
  return r ? r.captured : null;
};
