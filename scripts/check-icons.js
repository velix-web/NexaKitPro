// ponytail: one check — every tool must resolve to its OWN icon.
// Catches the exact bug reported ("logonya sama semua"): a typo'd icon name
// silently falls back and two cards look identical again.
const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','app.js'),'utf8');
global.window={};
const sandbox={window:global.window};
// evaluate only up to the end of the TOOLS array (rest touches the DOM)
const cut=src.indexOf('];',src.indexOf('const TOOLS='))+2;
const fn=new Function('window',src.slice(0,cut)+'\nreturn {I,TOOLS,svgIcon};');
const {I,TOOLS,svgIcon}=fn(global.window);
const assert=require('assert');
const seen=new Map();
for(const t of TOOLS){
  assert.ok(t.icon,`${t.slug} has no icon`);
  assert.ok(I[t.icon],`${t.slug} -> unknown icon "${t.icon}" (would fall back)`);
  assert.ok(!seen.has(t.icon),`${t.slug} reuses icon "${t.icon}" (already on ${seen.get(t.icon)})`);
  seen.set(t.icon,t.slug);
  assert.ok(svgIcon(t.icon).startsWith('<svg'),`${t.slug} icon did not render`);
}
console.log(`OK: ${TOOLS.length} tools, ${seen.size} distinct icons, no fallbacks`);
