import { writeFileSync, mkdirSync } from 'node:fs';
import { computeLayout } from '../src/core/layout/index.ts';
import { generatePattern } from '../src/core/pattern/generators.ts';
import { defaultPattern } from '../src/core/state/reducer.ts';
import { PRODUCTS } from '../src/data/products.ts';
import { buildWallMesh } from '../src/export/mesh.ts';

mkdirSync(new URL('../samples/', import.meta.url), { recursive: true });

const yaw = 28 * Math.PI/180, pitch = 22 * Math.PI/180;
const cY=Math.cos(yaw), sY=Math.sin(yaw), cX=Math.cos(pitch), sX=Math.sin(pitch);
function project(x,y,z){
  const x1=x*cY+z*sY, z1=-x*sY+z*cY, y1=y;
  const y2=y1*cX - z1*sX, z2=y1*sX + z1*cX;
  return [x1, -y2, z2];
}
const L=(()=>{const v=[-0.35,0.75,0.55];const n=Math.hypot(...v);return v.map(x=>x/n);})();

function renderProduct(id){
  const product = PRODUCTS[id];
  const grid = id==='basic-third'?[6,7]:id==='first-one'?[12,7]:[8,8];
  const layout = computeLayout(product, grid[0], grid[1], {exposure:450, bond:'staggered'});
  const cells = generatePattern(defaultPattern(7), layout);
  const mesh = buildWallMesh(product, layout, cells);
  const tris=[];
  for(const g of mesh.groups){
    const [r,gr,b]=[0,2,4].map(()=>0); // placeholder
    const hex=g.material.hex; const rr=parseInt(hex.slice(1,3),16),gg=parseInt(hex.slice(3,5),16),bb=parseInt(hex.slice(5,7),16);
    for(let i=0;i<g.positions.length;i+=9){
      const P=[0,3,6].map(o=>[g.positions[i+o],g.positions[i+o+1],g.positions[i+o+2]]);
      const nz=[g.normals[i],g.normals[i+1],g.normals[i+2]];
      const proj=P.map(p=>project(...p));
      const depth=(proj[0][2]+proj[1][2]+proj[2][2])/3;
      const sh=Math.max(0, nz[0]*L[0]+nz[1]*L[1]+nz[2]*L[2]);
      const k=0.4+0.6*sh;
      tris.push({proj,depth,col:`rgb(${Math.round(rr*k)},${Math.round(gg*k)},${Math.round(bb*k)})`});
    }
  }
  tris.sort((a,b)=>a.depth-b.depth);
  // bounds
  let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;
  for(const t of tris) for(const p of t.proj){minx=Math.min(minx,p[0]);miny=Math.min(miny,p[1]);maxx=Math.max(maxx,p[0]);maxy=Math.max(maxy,p[1]);}
  const pad=40, W=Math.round(maxx-minx)+pad*2, H=Math.round(maxy-miny)+pad*2;
  const poly=t=>`<polygon points="${t.proj.map(p=>`${(p[0]-minx+pad).toFixed(1)},${(p[1]-miny+pad).toFixed(1)}`).join(' ')}" fill="${t.col}"/>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#eeece8"/>${tris.map(poly).join('')}</svg>`;
  writeFileSync(new URL(`../samples/3d-${id}.svg`, import.meta.url), svg);
  console.log(`3d-${id}: ${mesh.triangleCount} tris, ${mesh.groups.length} colours, bbox depth ${mesh.bbox.max[2]}mm`);
}
for(const id of ['first-one','second-high','basic-third']) renderProduct(id);
