import test from 'node:test';
import assert from 'node:assert/strict';
import {encode} from 'uqr';
import {summarizeSessions,qrMatrix} from '../public/staging/attendance-adapter.js';
test('bounded report counts unmarked separately and uses marked denominator',()=>{
 assert.deepEqual(summarizeSessions([]),{present:0,absent:0,unmarked:0,rate:null});
 assert.deepEqual(summarizeSessions([{sessionId:'a',status:'present'},{sessionId:'b',status:'absent'},{sessionId:'c',status:'unmarked'}]),{present:1,absent:1,unmarked:1,rate:50});
 assert.equal(summarizeSessions([{sessionId:'a',status:'unmarked'}]).rate,null);
 assert.throws(()=>summarizeSessions([{sessionId:'a',status:'present'},{sessionId:'a',status:'absent'}]));
 assert.throws(()=>summarizeSessions(Array.from({length:31},(_,i)=>({sessionId:String(i),status:'present'}))));
});
test('QR renderer accepts only a bounded square binary matrix from opaque token',()=>{
 const qr=encode('a'.repeat(64),{ecc:'M',border:0});const matrix=qr.data.map(r=>Array.from(r,x=>x?'1':'0').join(''));
 assert.equal(qrMatrix(matrix).length,qr.size);
 assert.throws(()=>qrMatrix(['<svg>']));assert.throws(()=>qrMatrix(Array(21).fill('x'.repeat(21))));assert.throws(()=>qrMatrix(Array(85).fill('1'.repeat(85))));
});
