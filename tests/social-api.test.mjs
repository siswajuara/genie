import test from 'node:test';
import assert from 'node:assert/strict';
import {validateApiUrl,requestSocialApi} from '../sidecar/social-api.mjs';
test('desktop forwards actions only to the configured website with bearer auth',async()=>{
 const calls=[];
 const result=await requestSocialApi({url:'https://studio.example.org/api/genie-social/',token:'desktop-token'},'posts',{zernioPage:2},async(url,options)=>{calls.push({url,options});return Response.json({data:{posts:[]}});});
 assert.deepEqual(result,{posts:[]});assert.equal(calls.length,1);assert.equal(calls[0].url,'https://studio.example.org/api/genie-social/request');assert.equal(calls[0].options.headers.Authorization,'Bearer desktop-token');assert.equal(calls[0].options.redirect,'error');assert.deepEqual(JSON.parse(calls[0].options.body),{action:'posts',payload:{zernioPage:2}});
});
test('settings go to website settings and token echoes are redacted',async()=>{
 await assert.rejects(requestSocialApi({url:'https://studio.example.org/api/genie-social',token:'secret'},'settings',{},async url=>{assert.ok(url.endsWith('/settings'));return Response.json({error:'bad secret'},{status:401});}),/bad \[redacted\]/);
});
test('production URLs require HTTPS and credentials stay out of URLs',()=>{
 assert.throws(()=>validateApiUrl('http://studio.example.org/api'));
 assert.throws(()=>validateApiUrl('https://user:secret@studio.example.org/api'));
 assert.equal(validateApiUrl('http://localhost:3000/api/genie-social/'),'http://localhost:3000/api/genie-social');
});
