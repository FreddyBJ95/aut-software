import assert from 'node:assert/strict';
import {jointMarkerPresentation} from './joint-visuals.mjs';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
assert.deepEqual(jointMarkerPresentation(1),{scale:.4,compact:true});
close(jointMarkerPresentation(1.35).scale,.54);
close(jointMarkerPresentation(1.82).scale,.728);
assert.deepEqual(jointMarkerPresentation(2.5),{scale:1,compact:false});
assert.deepEqual(jointMarkerPresentation(250),{scale:1,compact:false});
assert.deepEqual(jointMarkerPresentation(undefined),{scale:.4,compact:true});
assert.deepEqual(jointMarkerPresentation(NaN),{scale:.4,compact:true});
assert.deepEqual(jointMarkerPresentation(1,{interactive:false}),{scale:1,compact:false});
assert.deepEqual(jointMarkerPresentation(undefined,{interactive:false}),{scale:1,compact:false});

console.log('Joint marker presentation: compact overview, progressive zoom and full-size work/print PASS');
