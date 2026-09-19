// Guides and opt-in snapping: coordinates use the caller's diagram space.
const EPS = 1e-7;
const valid = r => r && ['x','y','w','h'].every(k => Number.isFinite(r[k]))
  && r.w > 0 && r.h > 0 && Number.isFinite(r.x+r.w) && Number.isFinite(r.y+r.h);
const project = (r, vertical) => vertical
  ? {start:r.y,end:r.y+r.h,low:r.x,high:r.x+r.w}
  : {start:r.x,end:r.x+r.w,low:r.y,high:r.y+r.h};
const compare = (a,b) => {
  for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return a[i]-b[i];
  return 0;
};
const line = (start,end,cross,vertical,kind,label) => ({
  x1:vertical?cross:start,y1:vertical?start:cross,
  x2:vertical?cross:end,y2:vertical?end:cross,kind,
  ...(label===undefined?{}:{label}),
});

function aligned(rect,peers,tolerance,vertical) {
  const moving=project(rect,vertical),result=[];
  for(const anchor of [moving.start,(moving.start+moving.end)/2,moving.end]) {
    let best;
    for(const peer of peers) {
      const p=project(peer,vertical);
      for(const target of [p.start,(p.start+p.end)/2,p.end]) {
        const error=Math.abs(anchor-target);
        if(error>tolerance+EPS) continue;
        // Prefer the nearest resource when several share an alignment. A large
        // column of resources should not make each guide cross the whole canvas.
        const distance=Math.max(0,moving.low-p.high,p.low-moving.high);
        const start=Math.min(moving.low,p.low),end=Math.max(moving.high,p.high);
        const score=[error,distance,end-start,target,start];
        if(!best||compare(score,best.score)<0) best={score,start,end,target};
      }
    }
    if(best) result.push(line(best.start,best.end,best.target,!vertical,'align'));
  }
  return result;
}

function spacingMatch(rect,peers,tolerance,vertical,snap=false) {
  const moving=project(rect,vertical),events=[],projected=[];
  for(const peer of peers) {
    const p=project(peer,vertical);
    const low=Math.max(moving.low,p.low),high=Math.min(moving.high,p.high);
    if(high-low<=EPS) continue;
    projected.push(p);
    events.push({at:low,p,add:true},{at:high,p,add:false});
  }
  if(events.length<4) return;
  events.sort((a,b)=>a.at-b.at||Number(a.add)-Number(b.add));
  const active=[moving];
  const order=(a,b)=>a.start-b.start||a.end-b.end||a.low-b.low||a.high-b.high;
  let best;
  // Sweep the perpendicular intervals. Within each strip, consecutive resources
  // are the actual neighbours; this avoids comparing gaps across different rows
  // or skipping a resource that lies between two others. At most 2n events and
  // three candidate triples per event, with O(n) array maintenance, even at 400 nodes.
  for(let i=0;i<events.length;) {
    const at=events[i].at;
    while(i<events.length&&events[i].at===at) {
      const {p,add}=events[i++];
      if(add) {
        let lo=0,hi=active.length;
        while(lo<hi) { const mid=(lo+hi)>>>1; if(order(active[mid],p)<=0) lo=mid+1; else hi=mid; }
        active.splice(lo,0,p);
      } else active.splice(active.indexOf(p),1);
    }
    const next=events[i]?.at;
    if(next===undefined||next-at<=EPS||active.length<3) continue;
    const cross=(at+next)/2,index=active.indexOf(moving);
    const first=Math.max(0,index-2),last=Math.min(index,active.length-3);
    let priorEnd=-Infinity;
    for(let j=0;j<first;j++) priorEnd=Math.max(priorEnd,active[j].end);
    for(let j=first;j<=last;j++) {
      const a=active[j],b=active[j+1],c=active[j+2];
      const gap1=b.start-a.end,gap2=c.start-b.end;
      // Moving the middle changes both gaps; an endpoint changes only one.
      // Snap tolerance measures the actual movement, not the gap difference.
      const delta=b===moving?(gap2-gap1)/2:gap1-gap2;
      const error=snap?Math.abs(delta):Math.abs(gap1-gap2);
      // Earlier overlapping resources can extend into a gap despite their start
      // preceding this triple. Such a measurement would cross a resource.
      if(gap1>EPS&&gap2>EPS&&error<=tolerance+EPS&&priorEnd<=a.end+EPS) {
        // An endpoint can move towards a fourth neighbour. Also consider peers
        // in other strips of a tall/wide rectangle, so snapping cannot overlap
        // an obstacle merely because the reference line passes elsewhere.
        const start=moving.start+delta,end=moving.end+delta;
        const blocked=snap&&projected.some(p=>p.end>start+EPS&&p.start<end-EPS);
        if(!blocked) {
          const score=[error,c.end-a.start,Math.abs(cross-(moving.low+moving.high)/2),cross,a.start];
          if(!best||compare(score,best.score)<0) best={score,cross,a,b,c,gap1,gap2,delta};
        }
      }
      priorEnd=Math.max(priorEnd,a.end);
    }
  }
  return best;
}

function equallySpaced(rect,peers,tolerance,vertical) {
  const best=spacingMatch(rect,peers,tolerance,vertical);
  if(!best) return [];
  const {a,b,c,cross,gap1,gap2}=best;
  const label=gap=>String(Math.round(gap*10)/10);
  return [line(a.end,b.start,cross,vertical,'spacing',label(gap1)),
    line(b.end,c.start,cross,vertical,'spacing',label(gap2))];
}

/**
 * Edge/centre alignment and repeated edge-to-edge spacing for a dragged rect.
 * Pass only eligible peers, in the same coordinate system (normally siblings).
 * Tolerance is in diagram units; e.g. 3 / zoom keeps a three-screen-pixel range.
 * Returns at most six alignment and four spacing lines; inputs are never changed.
 * Spacing labels contain the actual distance rounded to one decimal, without units.
 */
export function alignmentGuides(rect,peers,tolerance=3) {
  if(!valid(rect)||!Array.isArray(peers)) return [];
  tolerance=Number.isFinite(tolerance)?Math.max(0,tolerance):0;
  const usable=usablePeers(rect,peers);
  const guides=[...aligned(rect,usable,tolerance,false),...aligned(rect,usable,tolerance,true),
    ...equallySpaced(rect,usable,tolerance,false),...equallySpaced(rect,usable,tolerance,true)];
  const unique=new Set();
  return guides.filter(g=>{
    const key=[g.kind,g.x1,g.y1,g.x2,g.y2].join(',');
    if(unique.has(key)) return false;
    unique.add(key);return true;
  });
}

const range = value => Number.isFinite(value)?Math.max(0,value):0;
const anchors = (start,size) => [start,start+size/2,start+size];
const distance = (a,b) => {
  const dx=Math.max(0,a.x-b.x-b.w,b.x-a.x-a.w);
  const dy=Math.max(0,a.y-b.y-b.h,b.y-a.y-a.h);
  return Math.hypot(dx,dy);
};
const centreDistance = (a,b) => Math.hypot(a.x+a.w/2-b.x-b.w/2,a.y+a.h/2-b.y-b.h/2);
const usablePeers = (rect,peers) => {
  const seen=new Set();
  return Array.isArray(peers)?peers.filter(p=>{
    if(p===rect||!valid(p)) return false;
    const key=[p.x,p.y,p.w,p.h].join(',');
    if(seen.has(key)) return false;
    seen.add(key);return true;
  }):[];
};

function positionDelta(rect,peers,tolerance,start,size) {
  let best;
  for(const peer of peers) {
    for(const anchor of anchors(rect[start],rect[size])) {
      for(const target of anchors(peer[start],peer[size])) {
        const delta=target-anchor,error=Math.abs(delta);
        if(error>tolerance+EPS) continue;
        const score=[error,distance(rect,peer),centreDistance(rect,peer),target,anchor];
        if(!best||compare(score,best.score)<0) best={score,delta};
      }
    }
  }
  return best?.delta||0;
}

/**
 * Match repeated edge-to-edge gaps, then align edges/centres on each axis.
 * A valid spacing match takes precedence over incidental nearby alignment;
 * among spacing matches the smallest correction wins. A middle rectangle is
 * centred between its neighbours; an endpoint repeats their existing gap.
 * Apply only while the user requests snapping. Tolerance is in diagram units,
 * so 8 / zoom maintains an eight-screen-pixel attraction range.
 */
export function snapPosition(rect,peers,tolerance=8) {
  if(!valid(rect)) return {dx:0,dy:0};
  const usable=usablePeers(rect,peers),limit=range(tolerance);
  return {
    dx:spacingMatch(rect,usable,limit,false,true)?.delta??positionDelta(rect,usable,limit,'x','w'),
    dy:spacingMatch(rect,usable,limit,true,true)?.delta??positionDelta(rect,usable,limit,'y','h'),
  };
}

function snappedDimension(rect,peers,tolerance,start,size,min,max) {
  let best;
  for(const peer of peers) {
    const candidates=[{value:peer[size],kind:0},
      ...anchors(peer[start],peer[size]).map(target=>({value:target-rect[start],kind:1}))];
    for(const {value,kind} of candidates) {
      const error=Math.abs(value-rect[size]);
      if(!Number.isFinite(value)||value<=0||value<min||value>max||error>tolerance+EPS) continue;
      const score=[error,distance(rect,peer),kind,centreDistance(rect,peer),value];
      if(!best||compare(score,best.score)<0) best={score,value};
    }
  }
  return best?.value??rect[size];
}

/**
 * Resize from the bottom-right, leaving the top-left anchor fixed. Match a
 * peer's dimensions or its edge/centre coordinates. Impossible candidates are
 * ignored; the caller retains responsibility for constraining the initial rect.
 */
export function snapSize(rect,peers,tolerance=8,limits={}) {
  if(!valid(rect)) return {
    w:Number.isFinite(rect?.w)&&rect.w>0?rect.w:0,
    h:Number.isFinite(rect?.h)&&rect.h>0?rect.h:0,
  };
  const usable=usablePeers(rect,peers),limit=range(tolerance);
  const bound=(key,fallback)=>Number.isFinite(limits?.[key])?limits[key]:fallback;
  return {
    w:snappedDimension(rect,usable,limit,'x','w',bound('minW',0),bound('maxW',Infinity)),
    h:snappedDimension(rect,usable,limit,'y','h',bound('minH',0),bound('maxH',Infinity)),
  };
}

function dimensionGuides(rect,peers,tolerance,vertical) {
  const size=vertical?'h':'w';
  let best;
  for(const peer of peers) {
    const error=Math.abs(rect[size]-peer[size]);
    if(error>tolerance+EPS) continue;
    const score=[distance(rect,peer),centreDistance(rect,peer),error,peer.x,peer.y,peer.w,peer.h];
    if(!best||compare(score,best.score)<0) best={score,peer};
  }
  if(!best) return [];
  return [rect,best.peer].map(r=>{
    const p=project(r,vertical),label=`${vertical?'A':'L'} ${Math.round(r[size]*10)/10}`;
    return line(p.start,p.end,p.low-12,vertical,'size',label);
  });
}

/**
 * Paired width/height measurements for the closest similarly sized peer.
 * At most four lines, with real dimensions rounded to one decimal in PT-BR
 * labels (L = largura, A = altura). Does not modify rectangles or peer arrays.
 */
export function sizeGuides(rect,peers,tolerance=3) {
  if(!valid(rect)) return [];
  const usable=usablePeers(rect,peers),limit=range(tolerance);
  return [...dimensionGuides(rect,usable,limit,false),...dimensionGuides(rect,usable,limit,true)];
}
