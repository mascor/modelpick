import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUsage } from '../src/sources/opencodedata.js';

test('OpenCode usage figures are read from the tables embedded in the page', () => {
  const html = `x sessionCost:$R[1]=[$R[2]={model:"deepseek-v4.1-flash",cost:0.094,tokens:7474467},$R[3]={model:"glm-5.3-flash",cost:0.1115,tokens:2610042}],retention:$R[4]=[$R[5]={model:"deepseek-v4.1-flash",provider:"deepseek",eligibleUserWeeks:22629,retainedUserWeeks:19239,author:"DeepSeek",rate:85,rank:1},$R[6]={model:"longcat-2.0",provider:"unknown",eligibleUserWeeks:359,retainedUserWeeks:279,author:"Unknown",rate:77.7,rank:2}],geo:[]`;
  assert.deepEqual(parseUsage(html), [
    { name: 'deepseek-v4.1-flash', eligibleUserWeeks: 22629, retentionRate: 85, sessionCostUsd: 0.094 },
    { name: 'longcat-2.0', eligibleUserWeeks: 359, retentionRate: 77.7, sessionCostUsd: null },
  ]);
  assert.throws(() => parseUsage('<html>no data</html>'));
});
