const fs = require('fs');
const path = require('path');
const rootActive = 'C:/Joblink';
const rootPublic = 'C:/Joblink/public/Joblink';
function walk(base) {
  const out = {};
  function rec(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) rec(p);
      else {
        const rel = path.relative(base, p).replace(/\\/g, '/');
        out[rel] = fs.readFileSync(p, 'utf8');
      }
    }
  }
  rec(base);
  return out;
}
const activeSrc = walk(path.join(rootActive, 'src'));
const publicSrc = walk(path.join(rootPublic, 'src'));
const activeKeys = Object.keys(activeSrc).sort();
const publicKeys = Object.keys(publicSrc).sort();
console.log('ACTIVE_SRC_COUNT', activeKeys.length);
console.log('PUBLIC_SRC_COUNT', publicKeys.length);
const missingInActive = publicKeys.filter(x => !activeKeys.includes(x));
const missingInPublic = activeKeys.filter(x => !publicKeys.includes(x));
console.log('MISSING_IN_ACTIVE', missingInActive.length);
missingInActive.slice(0,50).forEach(x => console.log(' A<-P', x));
console.log('MISSING_IN_PUBLIC', missingInPublic.length);
missingInPublic.slice(0,50).forEach(x => console.log(' A->P', x));
const diffs = [];
for (const key of activeKeys) {
  if (publicKeys.includes(key) && activeSrc[key] !== publicSrc[key]) {
    diffs.push(key);
  }
}
console.log('DIFFS', diffs.length);
diffs.slice(0,100).forEach(x => console.log(' DIFF', x));
const activeAssets = walk(path.join(rootActive,'android','app','src','main','assets','public'));
const publicAssets = walk(path.join(rootPublic,'android','app','src','main','assets','public'));
const activeAssetKeys = Object.keys(activeAssets).sort();
const publicAssetKeys = Object.keys(publicAssets).sort();
console.log('ACTIVE_ASSET_COUNT', activeAssetKeys.length);
console.log('PUBLIC_ASSET_COUNT', publicAssetKeys.length);
const missingAssetInActive = publicAssetKeys.filter(x => !activeAssetKeys.includes(x));
const missingAssetInPublic = activeAssetKeys.filter(x => !publicAssetKeys.includes(x));
console.log('MISSING_ASSET_IN_ACTIVE', missingAssetInActive.length);
missingAssetInActive.slice(0,100).forEach(x => console.log(' A<-P asset', x));
console.log('MISSING_ASSET_IN_PUBLIC', missingAssetInPublic.length);
missingAssetInPublic.slice(0,100).forEach(x => console.log(' A->P asset', x));
const assetDiffs = [];
for (const key of activeAssetKeys) {
  if (publicAssetKeys.includes(key) && activeAssets[key] !== publicAssets[key]) {
    assetDiffs.push(key);
  }
}
console.log('ASSET_DIFFS', assetDiffs.length);
assetDiffs.slice(0,100).forEach(x => console.log(' ASSET_DIFF', x));
