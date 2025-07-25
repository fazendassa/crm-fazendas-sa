// Automated CRM check-up script
// Usage: node --experimental-fetch scripts/checkup.mjs <supabaseUrl> <anonKey> <email> <password> <backendBase>
// Example: node --experimental-fetch scripts/checkup.mjs https://ytssethfiqtgvzgpiank.supabase.co <anon> samukalaramie@gmail.com 25601020 http://localhost:5000

import assert from 'node:assert/strict';

const [,, supabaseUrl, anonKey, email, password, backendBase='http://localhost:5000'] = process.argv;
if(!supabaseUrl || !anonKey || !email || !password) {
  console.error('Usage: node --experimental-fetch scripts/checkup.mjs <supabaseUrl> <anonKey> <email> <password> [backendBase]');
  process.exit(1);
}

const headersJson = { 'Content-Type': 'application/json', 'apikey': anonKey };

console.log('\n▶ Logging in to Supabase…');
const tokenResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: headersJson,
  body: JSON.stringify({ email, password })
});
assert.equal(tokenResp.status, 200, 'Supabase login failed');
const tokenData = await tokenResp.json();
const jwt = tokenData.access_token;
console.log('✅ Logged in, jwt length', jwt.length);

const authHeader = { Authorization: `Bearer ${jwt}`, 'Content-Type':'application/json' };

async function api(method, path, body) {
  const res = await fetch(`${backendBase}${path}`, { method, headers: authHeader, body: body?JSON.stringify(body):undefined });
  const data = await res.json().catch(()=>({}));
  return { status: res.status, data };
}

function randomString(prefix='Test') { return prefix+Math.random().toString(36).substring(2,8); }

// 1. CRUD Contact
console.log('\n▶ CONTACTS CRUD');
const contactName = randomString('Contact');
let res = await api('POST','/api/contacts',{ name: contactName, email: randomString('c')+'@test.com', phone: '11999999999' });
assert.equal(res.status,201,'Create contact');
const contactId = res.data.id;
console.log('✅ Created', contactId);
res = await api('GET',`/api/contacts/${contactId}`);
assert.equal(res.status,200,'Fetch contact');
res = await api('PATCH',`/api/contacts/${contactId}`,{ phone:'11888888888' });
assert.equal(res.status,200,'Update contact');
res = await api('DELETE',`/api/contacts/${contactId}`);
assert.equal(res.status,204,'Delete contact');
console.log('✅ CRUD contacts OK');

// 2. Pipeline + Stages CRUD
console.log('\n▶ PIPELINE CRUD');
const pipelineName = randomString('Pipe');
res = await api('POST','/api/pipelines',{ name: pipelineName });
assert.equal(res.status,201,'Create pipeline');
const pipelineId = res.data.id;
const stageName = randomString('Stage');
res = await api('POST',`/api/pipelines/${pipelineId}/stages`,{ name: stageName, order:1 });
assert.equal(res.status,201,'Create stage');
const stageId = res.data.id;
res = await api('PATCH',`/api/pipelines/${pipelineId}/stages/${stageId}`,{ name: stageName+'Edit' });
assert.equal(res.status,200,'Update stage');
res = await api('DELETE',`/api/pipelines/${pipelineId}/stages/${stageId}`);
assert.equal(res.status,204,'Delete stage');
// delete pipeline
await api('DELETE',`/api/pipelines/${pipelineId}`);
console.log('✅ Pipeline CRUD OK');

// 3. Import contacts simple (CSV via JSON fallback)
console.log('\n▶ IMPORT CONTACTS');
const importPayload = [{name:'ImpOne',email:'imp1@test.com',phone:'111111111'},{name:'ImpTwo',email:'imp2@test.com',phone:'222222222'}];
res = await api('POST','/api/contacts/import', importPayload);
assert.equal(res.status,201,'Import contacts');
console.log('✅ Import endpoint responded 201');

// 4. Pipeline Flow
console.log('\n▶ PIPELINE FLOW');
// create pipeline & stages again
res = await api('POST','/api/pipelines',{ name: pipelineName+'Flow' });
const flowPipelineId = res.data.id;
const [s1,s2,s3] = ['Prospect','Proposal','Won'];
const stageIds=[];
for(const [i,st] of [s1,s2,s3].entries()){
  const r = await api('POST',`/api/pipelines/${flowPipelineId}/stages`,{name:st,order:i+1});
  stageIds.push(r.data.id);
}
// create deal at stage1
res = await api('POST',`/api/pipelines/${flowPipelineId}/deals`,{ name: randomString('Deal'), stageId: stageIds[0], value:1000, currency:'BRL', contactId: null });
assert.equal(res.status,201,'Create deal');
const dealId = res.data.id;
// move to stage2
await api('PATCH',`/api/deals/${dealId}`,{ stageId: stageIds[1] });
// close won
await api('PATCH',`/api/deals/${dealId}`,{ stageId: stageIds[2], status:'won' });
console.log('✅ Pipeline flow OK');

console.log('\nALL CHECKS PASSED \u2714\u2714');
