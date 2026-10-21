import test from 'node:test';import assert from 'node:assert/strict';
import {canSkipBuild,decide} from '../maintenance/netlify-build-ignore.mjs';
test('prévias são dispensadas e produção com arquivos do site continua',()=>{
 assert.equal(canSkipBuild({context:'deploy-preview',files:['index.html']}),true);
 assert.equal(canSkipBuild({context:'branch-deploy',files:['index.html']}),true);
 for(const file of ['index.html','js/incidents.js','lib/notifications.mjs','refinement.css','_headers','_redirects','netlify.toml','assets/icon.svg','novo.js'])assert.equal(canSkipBuild({context:'production',files:[file]}),false,file);
 assert.equal(canSkipBuild({context:'production',files:['docs/guia.md','tests/notifications.test.mjs','.github/workflows/testar.yml','firestore.rules','firebase.json','maintenance/x.mjs','README.md']}),true);
});
test('comparação sem referência ou que falha não bloqueia publicação necessária',()=>{
 assert.equal(decide({CONTEXT:'production'}),1);
 assert.equal(decide({CONTEXT:'production',CACHED_COMMIT_REF:'1234567',COMMIT_REF:'abcdef0'},()=>{throw Error('git ausente')}),1);
 assert.equal(decide({CONTEXT:'production',CACHED_COMMIT_REF:'1234567',COMMIT_REF:'abcdef0'},()=>['docs/guia.md']),0);
 assert.equal(decide({CONTEXT:'production',CACHED_COMMIT_REF:'1234567',COMMIT_REF:'abcdef0'},()=>['docs/guia.md','dashboard.html']),1);
 assert.equal(decide({CONTEXT:'production',CACHED_COMMIT_REF:'--bad',COMMIT_REF:'abcdef0'}),1);
});
