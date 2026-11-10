// Integration checks against Wrangler's disposable LOCAL D1 instance only.
// Run after a local Wrangler dry build; use --persist-to outside the asset directory.
// Local-only test PIN: local-visit-test. No production endpoint is accepted.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base = 'http://127.0.0.1:5185';
const api = base + '/panel/api/visitas';
const date = '2001-01-02';
const query = '?desde=' + date + '&hasta=' + date;
let cookie = '';
const created = [];
async function request(path = '', data, overrides = {}) {
  const headers = {Cookie: cookie, ...(data ? {'Content-Type':'application/json',Origin:base} : {}), ...overrides};
  const response = await fetch(api + path, {method:data?'POST':'GET',headers,...(data?{body:JSON.stringify(data)}:{})});
  return new Response(await response.arrayBuffer(), {status:response.status,headers:response.headers});
}
async function summary() {const r=await request(query);assert.equal(r.status,200);return r.json();}
async function add(origin) {
  const body={id:randomUUID(),fecha:date,origen:origin};
  const result=await request('',body);assert.equal(result.status,200,await result.text());created.push(body);return body;
}
const anonymous=await request();assert.equal(anonymous.status,401);
assert.equal((await request('/exportar')).status,401);
const gate=await fetch(base+'/panel/__gate',{method:'POST',body:new URLSearchParams({pin:'local-visit-test'}),redirect:'manual'});
assert.equal(gate.status,303);cookie=gate.headers.get('set-cookie').split(';')[0];
assert.match(gate.headers.get('set-cookie'),/HttpOnly/);
const before=await summary();
try {
  const google=await add('google');const unknown=await add('sin_respuesta');
  for(const r of await Promise.all([request('',google),request('',google),request('',google)]))assert.equal(r.status,200);
  let stats=await summary();assert.equal(stats.total,before.total+2);assert.equal(stats.conocidas,before.conocidas+1);assert.equal(stats.sinRespuesta,before.sinRespuesta+1);
  assert.equal(stats.cobertura,stats.conocidas/stats.total);
  assert.equal((await request('',{...google,origen:'instagram'})).status,409);
  assert.equal((await request('',{id:randomUUID(),fecha:date,origen:'inventado'})).status,400);
  assert.equal((await request('',{id:randomUUID(),fecha:'2001-02-31',origen:'google'})).status,400);
  assert.equal((await request('',{id:randomUUID(),fecha:'2999-01-01',origen:'google'})).status,400);
  assert.equal((await request('',{id:'-'.repeat(36),fecha:date,origen:'google'})).status,400);
  assert.equal((await request('',google,{Origin:'https://another-origin.example'})).status,403);
  assert.equal((await request('',google,{'Content-Type':'text/plain'})).status,403);
  assert.equal((await request('?desde=2026-02-31')).status,400);
  assert.equal((await request('?desde=2000-01-01&hasta=2002-01-01')).status,400);
  assert.equal((await request('/'+google.id+'/anular',{})).status,200);
  assert.equal((await request('',google)).status,200); // Retry must not resurrect an annulled visit.
  stats=await summary();assert.equal(stats.total,before.total+1);
  assert.equal((await request('/'+google.id+'/restaurar',{})).status,200);
  assert.equal((await request('/'+randomUUID()+'/anular',{})).status,404);
  for(let i=0;i<103;i++)await add('instagram');
  stats=await summary();assert.equal(stats.total,before.total+105);assert.equal(stats.ultimas.length,100);
  const csv=await request('/exportar'+query);assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);assert.equal(csv.headers.get('cache-control'),'no-store');
  const text=await csv.text();assert.match(text,new RegExp(date+',Instagram,'+(before.porOrigen.instagram+103)));assert.match(text,/Sin respuesta/);
  assert.equal((await request(query)).headers.get('cache-control'),'no-store');
} finally {
  for(const row of created)assert.equal((await request('/'+row.id+'/anular',{})).status,200);
  assert.equal((await summary()).total,before.total);
}
console.log('PASS: authentication, source/date validation, CSRF, concurrent idempotent retries, reversible corrections, coverage, full-range aggregation, 100-row display limit and CSV.');
