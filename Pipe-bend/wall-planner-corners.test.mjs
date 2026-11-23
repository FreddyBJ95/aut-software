import assert from 'node:assert/strict';
import {defaultWallPlanInput,wallBendAngleHint,migrateRoomPlanner} from './room-planner.mjs';
import {generateWallRoute,validateWallRoute} from './wall-routing.mjs';

const fresh=defaultWallPlanInput();
assert.equal(fresh.maxAngle,90,'New wall plans permit an ordinary corner in one bend');
fresh.wall.lengths.push(123);
assert.deepEqual(defaultWallPlanInput().wall.lengths,[],'New drafts must not share mutable measurements');

for(const language of ['da','nb','en']) {
  const split=wallBendAngleHint(45,language),single=wallBendAngleHint(90,language);
  assert.ok(split.includes('45°')&&split.includes('2')&&split.includes('90°'));
  assert.ok(single.includes('90°'));
  assert.notEqual(split,single,'The hint must explain the selected limit');
  assert.ok(wallBendAngleHint(30,language).includes('3'));
}
assert.equal(wallBendAngleHint(NaN),'');

const corner={wall:{lengths:[1000,1200],turns:[90],heading:0,side:'left'},diameter:12,radius:38,wallGap:10,clearance:10,maxAngle:90,start:{segment:0,position:200},end:{segment:1,position:1000},clips:[],obstacles:[]};
function checked(input) {
  const route=generateWallRoute(input);
  assert.equal(route.ok,true,route.error);
  assert.equal(validateWallRoute(input,route.points).ok,true);
  return route;
}
for(const [side,turn]of [['left',90],['right',-90]]) {
  const input={...corner,wall:{...corner.wall,side,turns:[turn]}};
  assert.deepEqual(checked(input).turns,[turn],'An allowed ordinary corner needs exactly one actual bend');
  assert.deepEqual(checked({...input,maxAngle:45}).turns,[turn/2,turn/2],'An explicit 45° limit must still be respected');
}

// The screenshot route includes a wall protrusion and a separate top-wall
// obstacle. When radius and clearance permit it, the chosen 90° angle
// applies to both the ordinary corners and the obstacle detours.
const screenshot={...corner,wall:{lengths:[1000,1000,120,120,120,1200,1800],turns:[90,90,-90,-90,90,90],heading:0,side:'left'},end:{segment:6,position:1600},obstacles:[{id:'top-obstacle',segment:6,position:900,width:200,depth:200}]};
const with90=checked(screenshot),with45=checked({...screenshot,maxAngle:45});
assert.ok(with90.turns.every(n=>Math.abs(n)===90),'Both measured protrusions and inserted obstacles use the selected 90° when feasible');
assert.equal(with45.turns.filter(n=>Math.abs(n)===90).length,0);
assert.equal(with90.turns.length,10);
assert.equal(with45.turns.length,12);

const saved={version:2,input:{...corner,maxAngle:45},points:checked({...corner,maxAngle:45}).points};
const migrated=migrateRoomPlanner(saved);
assert.equal(migrated.input.maxAngle,45,'Opening an existing plan must preserve its explicit 45° choice');
assert.deepEqual(saved.input.maxAngle,45);
console.log('Wall corner choice: new 90° default, preserved 45° plans, single corners and obstacle detours PASS');
