// World geometry is independent of SVG zoom. Positions are local to the parent.
export const NODE_W = 148, NODE_H = 76, PAD = 16, HEADER = 48;
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const uid = () => globalThis.crypto.randomUUID();
export const copy = value => JSON.parse(JSON.stringify(value));
export class Graph {
  constructor(catalog, diagram) {
    this.catalog = new Map(catalog.map(item => [item.type, item]));
    this.load(diagram);
  }
  load(diagram) {
    const {version,name,notes='',nodes,edges}=copy(diagram);
    this.data={version,name,notes,
      nodes:nodes.map(({id,type,label,detail,parent,x,y,w,h,textAlign='left',fontSize})=>({id,type,label,detail,parent,x,y,w,h,textAlign,...(type==='text'&&Number.isFinite(fontSize)?{fontSize}:{})})),
      edges:edges.map(({id,source,target,label,style,kind='data',dash=kind==='trigger'?'dashed':'solid',sourcePort='auto',targetPort='auto',sourceArrow=false,targetArrow=true,bendX=0,bendY=0,labelPosition=null})=>({id,source,target,label,style,kind,dash,sourcePort,targetPort,sourceArrow,targetArrow,bendX,bendY,labelPosition}))};
    this.nodes = this.data.nodes;
    this.edges = this.data.edges;
    this.reindex();
  }
  reindex() { this.byId = new Map(this.nodes.map(n => [n.id, n])); }
  isGroup(node) { return !!this.catalog.get(node.type)?.group; }
  children(id) { return this.nodes.filter(n => n.parent === id); }
  descendants(id) {
    const result = [], queue = [id], seen = new Set([id]);
    while (queue.length) for (const n of this.children(queue.shift())) {
      if (seen.has(n.id)) continue;
      seen.add(n.id); result.push(n); queue.push(n.id);
    }
    return result;
  }
  depth(node) {
    let d = 0, p = node.parent;
    while (p && d < 12) { d++; p = this.byId.get(p)?.parent; }
    return d;
  }
  world(node) {
    let x = node.x, y = node.y, p = node.parent, guard = 0;
    while (p && guard++ < 12) { const parent = this.byId.get(p); if (!parent) break; x += parent.x; y += parent.y; p = parent.parent; }
    return {x,y,w:node.w,h:node.h};
  }
  center(node) { const p = this.world(node); return {x:p.x+node.w/2,y:p.y+node.h/2}; }
  confine(node) {
    const p = this.byId.get(node.parent);
    if (!p) { node.x = clamp(node.x,-95000,95000); node.y = clamp(node.y,-95000,95000); return; }
    node.x = clamp(node.x, PAD, p.w - PAD - node.w);
    node.y = clamp(node.y, HEADER, p.h - PAD - node.h);
  }
  move(node, x, y) { node.x=x; node.y=y; this.confine(node); }
  minimumSize(node) {
    if(node.type==='text')return {w:2,h:2};
    if (!this.isGroup(node)) return {w:NODE_W,h:NODE_H};
    const children = this.children(node.id);
    return {w:Math.max(210, ...children.map(n => n.x+n.w+PAD)),h:Math.max(150,...children.map(n => n.y+n.h+PAD))};
  }
  resize(node, w, h) {
    const min = this.minimumSize(node), parent = this.byId.get(node.parent);
    if(node.type==='text'&&Number.isFinite(node.fontSize)){
      const sx=w/node.w,sy=h/node.h;
      const desired=Math.abs(sx-1)>=Math.abs(sy-1)?sx:sy;
      const maxW=parent?Math.min(10000,parent.w-PAD-node.x):10000;
      const maxH=parent?Math.min(10000,parent.h-PAD-node.y):10000;
      const scale=Math.max(1/node.fontSize,Math.min(desired,2000/node.fontSize,maxW/node.w,maxH/node.h));
      node.fontSize*=scale;node.w*=scale;node.h*=scale;return;
    }
    node.w = clamp(w, min.w, parent ? Math.min(10000,parent.w-PAD-node.x) : 10000);
    node.h = clamp(h, min.h, parent ? Math.min(10000,parent.h-PAD-node.y) : 10000);
  }
  arrangeGroup(node) {
    if (!node || !this.isGroup(node)) throw new Error('Selecione um contêiner para agrupar seus elementos.');
    const children = this.children(node.id).sort((a,b)=>a.y-b.y || a.x-b.x || a.id.localeCompare(b.id));
    if (!children.length) return;
    const gap = 24, availableW = node.w-2*PAD, availableH = node.h-HEADER-PAD;
    const aspect = availableW/availableH;
    let best;
    for (let columns=1; columns<=children.length; columns++) {
      const widths=Array(columns).fill(0), heights=Array(Math.ceil(children.length/columns)).fill(0);
      children.forEach((child,i)=>{widths[i%columns]=Math.max(widths[i%columns],child.w);heights[Math.floor(i/columns)]=Math.max(heights[Math.floor(i/columns)],child.h);});
      const contentW=widths.reduce((a,b)=>a+b,0)+gap*(columns-1);
      const contentH=heights.reduce((a,b)=>a+b,0)+gap*(heights.length-1);
      if(contentW>availableW || contentH>availableH) continue;
      const distortion=Math.abs(Math.log(contentW/contentH/aspect));
      if(!best || distortion<best.distortion) best={widths,heights,columns,distortion};
    }
    if(!best) throw new Error('Não há espaço para organizar os elementos neste tamanho. Amplie o grupo ou mova alguns elementos para fora.');
    // Distribute spare space through the whole interior without resizing any node.
    // Use equal outer/inner spaces when possible, retaining the minimum inner gap.
    const distribute = (sizes, available) => {
      const free=available-sizes.reduce((a,b)=>a+b,0), count=sizes.length;
      const outer=count===1 ? free/2 : Math.max(0,Math.min(free/(count+1),(free-gap*(count-1))/2));
      const inner=count===1 ? 0 : (free-2*outer)/(count-1);
      let offset=outer;
      return sizes.map(size=>{const position=offset;offset+=size+inner;return position;});
    };
    const {widths,heights,columns}=best;
    const xs=distribute(widths,availableW), ys=distribute(heights,availableH);
    children.forEach((child,i)=>{
      const col=i%columns,row=Math.floor(i/columns);
      child.x=PAD+xs[col]+(widths[col]-child.w)/2;
      child.y=HEADER+ys[row];
    });
  }
  canParent(node, parent) {
    if (!parent) return true;
    return this.isGroup(parent) && parent.id !== node.id && !this.descendants(node.id).some(n => n.id === parent.id)
      && parent.w >= node.w+PAD*2 && parent.h >= node.h+HEADER+PAD
      && this.depth(parent)+1+Math.max(0,...this.descendants(node.id).map(n=>this.depth(n)-this.depth(node))) < 12;
  }
  reparent(node, parentId) {
    const parent = this.byId.get(parentId);
    if (parentId && !parent) throw new Error('Contêiner não encontrado.');
    if (!this.canParent(node,parent)) throw new Error('O componente não cabe neste contêiner ou criaria um ciclo.');
    const before=this.world(node), origin=parent ? this.world(parent) : {x:0,y:0};
    node.parent=parentId || null; node.x=before.x-origin.x; node.y=before.y-origin.y;
    this.confine(node);
  }
  containing(x,y,w=NODE_W,h=NODE_H,exclude=null) {
    return this.nodes.filter(n=>this.isGroup(n) && n.id!==exclude && n.w>=w+PAD*2 && n.h>=h+HEADER+PAD)
      .sort((a,b)=>this.depth(b)-this.depth(a)||a.w*a.h-b.w*b.h)
      .find(n=>{const p=this.world(n);return x>=p.x+PAD && y>=p.y+HEADER && x<=p.x+n.w-PAD && y<=p.y+n.h-PAD;});
  }
  add(type,x,y,parentId=null) {
    if(this.nodes.length>=400) throw new Error('Limite de 400 componentes atingido.');
    const item=this.catalog.get(type);
    if(!item) throw new Error('Tipo de componente desconhecido.');
    let w=item.width??(item.group?380:NODE_W),h=item.height??(item.group?290:NODE_H);
    const parent=this.byId.get(parentId);
    if(parent && item.group) {w=Math.max(210,Math.min(w,parent.w-32));h=Math.max(150,Math.min(h,parent.h-64));}
    const node={id:uid(),type,label:item.name,detail:item.subtitle,parent:null,x,y,w,h};
    if(parent && !this.canParent(node,parent)) throw new Error('O componente não cabe neste contêiner.');
    this.nodes.push(node); this.byId.set(node.id,node);
    if(parent) this.reparent(node,parentId);
    return node;
  }
  connect(source,target) {
    if(source===target) throw new Error('Escolha outro componente como destino.');
    if(!this.byId.has(source)||!this.byId.has(target)) throw new Error('Componente não encontrado.');
    if(this.edges.some(e=>e.source===source&&e.target===target)) throw new Error('Esta conexão já existe.');
    if(this.edges.length>=1200) throw new Error('Limite de conexões atingido.');
    const edge={id:uid(),source,target,label:'',style:'curve',kind:'data',dash:'solid',sourcePort:'auto',targetPort:'auto',sourceArrow:false,targetArrow:true};
    this.edges.push(edge);return edge;
  }
  placeNew(node) {
    const origin={x:node.x,y:node.y},siblings=this.children(node.parent).filter(n=>n.id!==node.id);
    const overlaps=()=>siblings.some(n=>node.x<n.x+n.w+12&&node.x+node.w+12>n.x&&node.y<n.y+n.h+12&&node.y+node.h+12>n.y);
    if(!overlaps())return;
    // Choose a free starting point for clicks; existing components never move.
    for(let radius=1;radius<=6;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
      node.x=origin.x+dx*(node.w+12);node.y=origin.y+dy*(node.h+12);this.confine(node);
      if(!overlaps())return;
    }
    node.x=origin.x;node.y=origin.y;
  }
  remove(id) {
    const removed=new Set([id,...this.descendants(id).map(n=>n.id)]);
    this.data.nodes=this.nodes=this.nodes.filter(n=>!removed.has(n.id));
    this.data.edges=this.edges=this.edges.filter(e=>e.id!==id&&!removed.has(e.source)&&!removed.has(e.target));
    this.reindex();
  }
  bounds() {
    if(!this.nodes.length) return {x:0,y:0,w:1000,h:700};
    const roots=this.nodes.filter(n=>!n.parent);
    const routePoints=this.edges.flatMap(edge=>edgeGeometry(this,edge)?.extent||[]);
    const x=Math.min(...roots.map(n=>n.x),...routePoints.map(p=>p.x)),y=Math.min(...roots.map(n=>n.y),...routePoints.map(p=>p.y));
    return {x,y,w:Math.max(...roots.map(n=>n.x+n.w),...routePoints.map(p=>p.x))-x,h:Math.max(...roots.map(n=>n.y+n.h),...routePoints.map(p=>p.y))-y};
  }
  serialize() { return copy(this.data); }
}

export function edgeGeometry(graph,edge){
  const a=graph.byId.get(edge.source),b=graph.byId.get(edge.target);if(!a||!b)return null;
  const p=graph.center(a),q=graph.center(b),dx=q.x-p.x,dy=q.y-p.y;
  const horizontal=Math.abs(dx)>=Math.abs(dy);
  const from=edge.sourcePort&&edge.sourcePort!=='auto'?edge.sourcePort:horizontal?(dx>=0?'right':'left'):(dy>=0?'bottom':'top');
  const to=edge.targetPort&&edge.targetPort!=='auto'?edge.targetPort:horizontal?(dx>=0?'left':'right'):(dy>=0?'top':'bottom');
  const directions={left:{x:-1,y:0},right:{x:1,y:0},top:{x:0,y:-1},bottom:{x:0,y:1}};
  const u=directions[from],v=directions[to],start={x:p.x+u.x*a.w/2,y:p.y+u.y*a.h/2},end={x:q.x+v.x*b.w/2,y:q.y+v.y*b.h/2};
  const bendX=edge.bendX||0,bendY=edge.bendY||0;
  let d,segments=[],handle=null;
  if(edge.style==='straight'){
    d='M '+start.x+' '+start.y+' L '+end.x+' '+end.y;segments=[[start,end]];
  }else if(edge.style==='orthogonal'){
    let points;
    if(u.x&&v.x){
      let mx=(start.x+end.x)/2;
      const incoming=graph.edges.filter(e=>e.target===edge.target&&e.targetPort===edge.targetPort);
      if(incoming.length>1&&Math.abs(end.x-start.x)>32)mx=clamp(mx+(incoming.findIndex(e=>e.id===edge.id)-(incoming.length-1)/2)*14,Math.min(start.x,end.x)+8,Math.max(start.x,end.x)-8);
      mx+=bendX;handle={x:mx,y:(start.y+end.y)/2+bendY,axis:'both',factor:1};
      points=[start,{x:mx,y:start.y},{x:mx,y:end.y},end];
      if(bendY)points=[start,{x:mx,y:start.y},{x:mx,y:handle.y},{x:end.x+v.x*30,y:handle.y},{x:end.x+v.x*30,y:end.y},end];
    }else if(u.y&&v.y){const my=(start.y+end.y)/2+bendY;handle={x:(start.x+end.x)/2+bendX,y:my,axis:'both',factor:1};points=[start,{x:start.x,y:my},{x:end.x,y:my},end];
      if(bendX)points=[start,{x:start.x,y:my},{x:handle.x,y:my},{x:handle.x,y:end.y+v.y*30},{x:end.x,y:end.y+v.y*30},end];
    }
    else if(u.x){const mx=end.x+bendX,my=start.y+bendY;handle={x:mx,y:my,axis:'both',factor:1};points=[start,{x:mx,y:start.y},{x:mx,y:my},{x:end.x,y:my},end];}
    else{const mx=start.x+bendX,my=end.y+bendY;handle={x:mx,y:my,axis:'both',factor:1};points=[start,{x:start.x,y:my},{x:mx,y:my},{x:mx,y:end.y},end];}
    d=points.map((point,i)=>(i?'L ':'M ')+point.x+' '+point.y).join(' ');
    segments=points.slice(1).map((point,i)=>[points[i],point]);
  }else{
    const distance=clamp(Math.hypot(end.x-start.x,end.y-start.y)*.45,30,240);
    const c1={x:start.x+u.x*distance+bendX,y:start.y+u.y*distance+bendY},c2={x:end.x+v.x*distance+bendX,y:end.y+v.y*distance+bendY};
    d='M '+start.x+' '+start.y+' C '+c1.x+' '+c1.y+' '+c2.x+' '+c2.y+' '+end.x+' '+end.y;
    const x=(start.x+3*c1.x+3*c2.x+end.x)/8,y=(start.y+3*c1.y+3*c2.y+end.y)/8;
    return {d,start,end,x,y,extent:[start,c1,c2,end],handle:{x,y,axis:'both',factor:.75},labelAnchor:'middle',labelWidth:160};
  }
  // Measure uninterrupted lines for labels without changing the rendered path.
  const labelSegments=[];
  for(const [from,to] of segments){
    if(from.x===to.x&&from.y===to.y)continue;
    const previous=labelSegments[labelSegments.length-1];
    if(previous){
      const ax=previous[1].x-previous[0].x,ay=previous[1].y-previous[0].y,bx=to.x-from.x,by=to.y-from.y;
      if(previous[1].x===from.x&&previous[1].y===from.y&&ax*by===ay*bx&&ax*bx+ay*by>0){previous[1]=to;continue;}
    }
    labelSegments.push([from,to]);
  }
  const segment=labelSegments.sort((x,y)=>Math.hypot(y[1].x-y[0].x,y[1].y-y[0].y)-Math.hypot(x[1].x-x[0].x,x[1].y-x[0].y))[0]||[start,end];
  const vertical=Math.abs(segment[1].y-segment[0].y)>Math.abs(segment[1].x-segment[0].x);
  return {d,start,end,handle,extent:segments.flat(),x:(segment[0].x+segment[1].x)/2+(vertical?12:0),y:(segment[0].y+segment[1].y)/2,labelAnchor:vertical?'start':'middle',labelWidth:vertical?125:clamp(Math.abs(segment[1].x-segment[0].x)-8,46,210)};
}
