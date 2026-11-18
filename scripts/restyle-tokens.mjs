import fs from 'fs';
import path from 'path';

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const pairs = [
  [/bg-surface-50/g, 'bg-app'],
  [/bg-surface-100/g, 'bg-elev'],
  [/bg-white\/95/g, 'bg-card/95'],
  [/bg-white\/90/g, 'bg-card/90'],
  [/bg-white(?![\w/-])/g, 'bg-card'],
  [/border-surface-100/g, 'border-line'],
  [/border-surface-200/g, 'border-line'],
  [/border-surface-300/g, 'border-line'],
  [/text-brand-ink/g, 'text-ink'],
  [/text-surface-700/g, 'text-muted'],
  [/text-surface-600/g, 'text-muted'],
  [/text-surface-500/g, 'text-subtle'],
  [/text-surface-400/g, 'text-subtle'],
  [/text-surface-300/g, 'text-line'],
  [/placeholder-surface-500/g, 'placeholder-subtle'],
  [/placeholder-surface-400/g, 'placeholder-subtle'],
  [/hover:bg-surface-100/g, 'hover:bg-elev'],
  [/hover:bg-brand-50/g, 'hover:bg-elev'],
  [/bg-brand-50/g, 'bg-elev'],
  [/bg-brand-100/g, 'bg-elev'],
  [/text-brand-700/g, 'text-primary'],
  [/text-brand-600/g, 'text-primary'],
  [/hover:text-brand-700/g, 'hover:text-primary'],
  [/hover:text-brand-600/g, 'hover:text-primary'],
  [/border-brand-600/g, 'border-primary'],
  [/border-brand-300/g, 'border-line'],
  [/bg-brand-600/g, 'bg-primary'],
  [/bg-brand-ink/g, 'bg-ink'],
  [/ring-brand-400/g, 'ring-primary'],
  [/ring-brand-500/g, 'ring-primary'],
  [/from-brand-50/g, 'from-elev'],
  [/via-surface-50/g, 'via-app'],
  [/to-brand-100/g, 'to-accent-soft'],
  [/text-brand-300/g, 'text-accent'],
  [/fill-brand-400/g, 'fill-accent'],
  [/text-brand-400/g, 'text-accent'],
  [/bg-amber-50/g, 'bg-accent-soft'],
  [/border-amber-200/g, 'border-line'],
  [/text-amber-900/g, 'text-accent-text'],
  [/text-amber-800/g, 'text-accent-text'],
  [/bg-brand-ink\/85/g, 'bg-ink/85'],
];

let changed = 0;
for (const f of walk('src')) {
  let s = fs.readFileSync(f, 'utf8');
  const orig = s;
  for (const [re, rep] of pairs) s = s.replace(re, rep);
  // accent buttons that still say text-white → on-accent when with bg-accent
  s = s.replace(/bg-accent text-white/g, 'bg-accent text-on-accent');
  s = s.replace(/bg-primary text-white/g, 'bg-primary text-on-primary');
  s = s.replace(/bg-ink text-white/g, 'bg-ink text-on-primary');
  if (s !== orig) {
    fs.writeFileSync(f, s);
    changed++;
    console.log('updated', f);
  }
}
console.log('files', changed);
