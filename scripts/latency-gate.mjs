#!/usr/bin/env node
import fs from 'node:fs';

const path = process.argv[2] || 'playwright-report/results.json';
const p95Budget = Number(process.env.LATENCY_P95_MS || '1500'); // default 1.5s
const json = JSON.parse(fs.readFileSync(path, 'utf8'));

const times = [];
(function visit(n){ if(!n) return;
  const pushFrom = (anns=[]) => {
    if(!anns.length) return;
    const ms = anns.find(x=>x.type==='stream-first-token-ms')?.description;
    if(ms!=null && !Number.isNaN(Number(ms))) times.push(Number(ms));
  };

  const processTests = tests => {
    (tests||[]).forEach(t=>{
      pushFrom(t.annotations);
      (t.results||[]).forEach(r=>pushFrom(r.annotations));
    });
  };

  processTests(n.tests);
  (n.specs||[]).forEach(spec=>processTests(spec.tests));
  (n.suites||[]).forEach(visit);
})(json);

if(!times.length){ console.log('[latency-gate] no annotations found; skipping'); process.exit(0); }
times.sort((a,b)=>a-b); const idx = Math.min(times.length-1, Math.ceil(0.95*times.length)-1);
const p95 = times[idx];
console.log(`[latency-gate] p95=${p95}ms (budget=${p95Budget}ms)`);
if(p95 > p95Budget){ console.error(`[latency-gate] FAILED: p95 over budget`); process.exit(1); }
