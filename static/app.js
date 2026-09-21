import {Graph, edgeGeometry, clamp} from './graph.mjs';
import {loadOfficialIcons} from './icons.mjs';
import {filterCatalog} from './catalog.mjs';
import {alignmentGuides, snapPosition, snapSize, sizeGuides} from './alignment.mjs';
import {selectionRoots, moveSelection, nodesInBox} from './selection.mjs';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  api:'<path d="m10 8-7 8 7 8m12-16 7 8-7 8M19 5l-6 22"/>',
  text:'<path d="M5 7V4h22v3M16 4v24M10 28h12"/>',
  note:'<path d="M6 3h20v26H6ZM10 10h12M10 16h12M10 22h8"/>',
  cloud:'<path d="M9 25a7 7 0 0 1-2-13 9 9 0 0 1 17-2 8 8 0 0 1 0 15Z"/>',
  source:'<path d="M5 7h16M5 12h16M5 17h11M5 22h11m6-7 7 6-7 6m-5-6h12"/>',
  events:'<path d="m10 4-6 6v12l6 6m12-24 6 6v12l-6 6M12 9h8l4 7-4 7h-8l-4-7Z"/><circle cx="16" cy="16" r="2"/>',
  transfer:'<path d="M3 10h24m-6-6 6 6-6 6M29 23H5m6-6-6 6 6 6" stroke-width="4"/>',
  airflow:'<path d="M16 16 5 5C14 2 22 3 24 8Z" fill="#e64b39" stroke="none"/><path d="m16 16 11-11c3 9 2 17-3 19Z" fill="#16bdca" stroke="none"/><path d="m16 16 11 11c-9 3-17 2-19-3Z" fill="#17ae65" stroke="none"/><path d="M16 16 5 27C2 18 3 10 8 8Z" fill="#227be0" stroke="none"/>',
  chip:'<rect x="7" y="7" width="18" height="18" rx="2"/><rect x="11" y="11" width="10" height="10" rx="1"/><path d="M11 3v4m10-4v4M11 25v4m10-4v4M3 11h4m-4 10h4m18-10h4m-4 10h4"/>',
  box:'<path d="m16 4 11 6v12l-11 6-11-6V10Zm0 12L5 10m11 6 11-6M16 16v12M10.5 7 22 13"/>',
  database:'<ellipse cx="16" cy="7" rx="10" ry="4"/><path d="M6 7v18c0 5 20 5 20 0V7M6 16c0 5 20 5 20 0M6 24c0 5 20 5 20 0"/>',
  bucket:'<ellipse cx="16" cy="7" rx="11" ry="4"/><path d="m5 7 3 19c2 4 14 4 16 0l3-19M11 16h10M12 20h8"/>',
  network:'<rect x="11" y="3" width="10" height="7" rx="1"/><rect x="3" y="22" width="9" height="7" rx="1"/><rect x="20" y="22" width="9" height="7" rx="1"/><path d="M16 10v7M7 22v-5h18v5"/>',
  globe:'<circle cx="16" cy="16" r="12"/><ellipse cx="16" cy="16" rx="5" ry="12"/><path d="M4 16h24M7 8c6 4 12 4 18 0M7 24c6-4 12-4 18 0"/>',
  zone:'<rect x="4" y="4" width="24" height="24" rx="2" stroke-dasharray="3 3"/><rect x="10" y="10" width="12" height="12" rx="1"/>',
  lambda:'<path d="M9 5h7l10 23h-6L13 11M13 13 5 28h6l5-9"/>',
  cluster:'<path d="m16 2 13 7v14l-13 7L3 23V9Z"/><circle cx="16" cy="16" r="4"/><path d="M16 6v6m0 8v6M7 11l6 3m6 4 6 3M7 21l6-3m6-4 6-3"/>',
  gateway:'<path d="M11 4H5v24h6M21 4h6v24h-6M9 16h14m-5-5 5 5-5 5"/>',
  queue:'<rect x="3" y="8" width="7" height="16" rx="1"/><rect x="13" y="8" width="7" height="16" rx="1"/><path d="M24 16h6m-3-3 3 3-3 3"/>',
  users:'<circle cx="16" cy="10" r="5"/><path d="M6 28v-4a10 10 0 0 1 20 0v4M5 5a5 5 0 0 0 0 10m22-10a5 5 0 0 1 0 10M2 25v-4a7 7 0 0 1 4-6m24 10v-4a7 7 0 0 0-4-6"/>'
};
const sketchPaths = {
  box:'<path d="M4 8Q14 6 28 8L27 27Q15 26 5 28Z" stroke-dasharray="4 3"/><path d="M10 13L22 12L23 22L10 23Z"/><path d="M7 29L19 28" opacity=".35"/>',
  users:'<path d="M12 5C21 1 23 15 16 16C9 17 8 8 12 5ZM6 28L7 23C9 16 24 17 26 24L26 28M5 7C0 8 1 16 6 16M26 7C31 8 31 15 27 16M2 26L2 23Q2 19 5 19M30 26L30 23Q30 19 27 19"/><path d="M9 29L22 28" opacity=".35"/>',
  globe:'<path d="M16 3C32 2 34 28 17 29C1 31-2 5 16 3ZM15 4C8 11 10 23 17 29M17 4C24 12 22 22 17 29M4 15Q16 17 28 15M7 8Q16 12 25 8M7 24Q16 20 25 24"/>',
  source:'<path d="M5 5L23 4L24 13M5 5L4 28L17 27M9 10L19 9M9 15L17 15M9 21L14 20M18 22Q23 21 29 22L24 17M29 22L24 27"/><path d="M7 30L15 29" opacity=".35"/>',
  api:'<path d="M10 8L3 16L10 23M22 8L29 15L22 24M19 4Q16 16 13 28"/><path d="M4 18L9 24M20 5L17 15" opacity=".35"/>',
  text:'<path d="M5 10L5 5Q15 4 27 5L27 9M16 5Q15 17 16 28M10 28L22 27"/><path d="M8 7L24 6M18 10L17 24" opacity=".35"/>',
  note:'<path d="M6 4L22 3L28 10L27 28L5 29ZM22 3L21 11L28 10M10 15L22 14M10 20L22 19M10 25L17 24"/><path d="M8 31L25 30" opacity=".35"/>'
};
const iconPaths = item => `<g stroke="#3b4048" stroke-width="1.35">${sketchPaths[item.icon] || paths[item.icon] || paths.box}</g>`;
let officialIcons=new Map();
function icon(item, extra='') {
  const asset=officialIcons.get(item.iconAsset);
  if(asset)return `<img class="service-icon ${extra}" src="${asset}" alt="" draggable="false">`;
  return `<svg class="service-icon ${extra}" viewBox="0 0 32 32" fill="none" stroke="${item.color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths(item)}</svg>`;
}
function svgEl(tag, attrs={}, text) {const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function canvasIcon(item,x,y,size){
  const asset=officialIcons.get(item.iconAsset);
  if(asset)return svgEl('image',{x,y,width:size,height:size,href:asset,preserveAspectRatio:'xMidYMid meet','aria-hidden':'true'});
  const inner=svgEl('svg',{x,y,width:size,height:size,viewBox:'0 0 32 32',fill:'none',stroke:item.color,'stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round'});
  inner.innerHTML=iconPaths(item);return inner;
}
const short=(text,length=21)=>text.length>length?text.slice(0,length-1)+'…':text;
function wrapText(value,limit,maxLines=3){let rest=String(value||'').trim();const lines=[];while(rest&&lines.length<maxLines){if(rest.length<=limit){lines.push(rest);rest='';break;}let cut=rest.lastIndexOf(' ',limit);if(cut<1)cut=limit;lines.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart();}if(rest&&lines.length)lines[lines.length-1]=short(lines[lines.length-1]+' '+rest,limit);return lines;}
function svgLines(element,lines,x,y,gap=12){element.replaceChildren(...lines.map((line,i)=>svgEl('tspan',{x,y:y+i*gap},line)));}
function documentUrl(id){const url=new URL(location.href);if(id)url.searchParams.set('diagram',id);else url.searchParams.delete('diagram');window.history.replaceState(null,'',url);}

let graph, catalog=[], provider='all', selected=null, tool='select', connectionStart=null, drag=null;
let selectedIds=new Set();
let dirty=false, revision=0, lastSaved='Diagrama de exemplo · não salvo';
let history=[], future=[], view={x:0,y:0,z:1}, spaceDown=false;
let nodeElements=new Map(),edgeElements=new Map(),toastTimer;
let documentSession=0;
const canvas=$('canvas');
const guideLayer=svgEl('g',{id:'alignment-guides','pointer-events':'none','aria-hidden':'true'});
$('viewport').append(guideLayer);
const marquee=svgEl('rect',{id:'selection-box',fill:'#16857418',stroke:'#168574','stroke-dasharray':'5 3','vector-effect':'non-scaling-stroke','pointer-events':'none',display:'none'});
$('viewport').append(marquee);
function guidePeers(node){
  const excluded=new Set();
  for(const root of selectionRoots(graph,selectedIds)){
    excluded.add(root.id);for(const descendant of graph.descendants(root.id))excluded.add(descendant.id);
  }
  excluded.add(node.id);
  return graph.children(node.parent).filter(n=>!excluded.has(n.id)).map(n=>graph.world(n));
}
function renderGuides(node,resizing=false){
  const peers=guidePeers(node),rect=graph.world(node);
  const guides=[...alignmentGuides(rect,peers,3/view.z),...(resizing?sizeGuides(rect,peers,3/view.z):[])];
  guideLayer.replaceChildren();
  for(const g of guides){
    const color=g.kind==='spacing'?'#168574':g.kind==='size'?'#7956c4':'#d9469c';
    guideLayer.append(svgEl('line',{x1:g.x1,y1:g.y1,x2:g.x2,y2:g.y2,stroke:color,'stroke-width':1,'vector-effect':'non-scaling-stroke','stroke-dasharray':g.kind==='align'?'5 4':'none','data-guide-kind':g.kind}));
    if(g.kind==='spacing'||g.kind==='size'){
      const vertical=g.x1===g.x2,tick=4/view.z;
      for(const [x,y] of [[g.x1,g.y1],[g.x2,g.y2]])guideLayer.append(svgEl('line',{x1:x-(vertical?tick:0),y1:y-(vertical?0:tick),x2:x+(vertical?tick:0),y2:y+(vertical?0:tick),stroke:color,'vector-effect':'non-scaling-stroke'}));
      if(g.label!==undefined)guideLayer.append(svgEl('text',{x:(g.x1+g.x2)/2+(vertical?8/view.z:0),y:(g.y1+g.y2)/2-(vertical?0:7/view.z),'font-size':11/view.z,fill:color,'text-anchor':vertical?'start':'middle','paint-order':'stroke',stroke:'#fff','stroke-width':3/view.z},g.label));
    }
  }
}

function syncPanelButtons(){for(const [side,id,name] of [['library','toggle-library','componentes'],['inspector','toggle-inspector','propriedades']]){const visible=getComputedStyle($(side)).display!=='none';$(id).setAttribute('aria-expanded',String(visible));$(id).title=(visible?'Ocultar ':'Mostrar ')+name;$(id).setAttribute('aria-label',$(id).title);}}
function togglePanel(side){if(drag)endDrag(true);const workspace=document.querySelector('.workspace'),visible=getComputedStyle($(side)).display!=='none';workspace.classList.toggle('hide-'+side,visible);if(side==='inspector')$('inspector').classList.toggle('mobile-open',!visible);syncPanelButtons();transform();}
function toast(message,error=false){$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});let data;try{data=await response.json();}catch{throw new Error('O servidor retornou uma resposta inválida.');}if(!response.ok)throw new Error(data.error||'Não foi possível concluir a operação.');return data;}
function markDirty(){dirty=true;revision++;$('save-state').textContent='Alterações não salvas';}
function remember(){history.push(graph.serialize());if(history.length>60)history.shift();future=[];updateHistory();}
function updateHistory(){const group=graph?.byId.get(selected);$('arrange-btn').hidden=!(selectedIds.size===1&&group&&graph.isGroup(group));$('arrange-btn').disabled=!group||!graph.children(group.id).length;if($('selection-count'))$('selection-count').textContent=selectedIds.size?`${selectedIds.size} selecionado${selectedIds.size>1?'s':''}`:'';$('undo-btn').disabled=!history.length;$('redo-btn').disabled=!future.length;$('delete-btn').disabled=!selected;}
function change(action,{rebuild=true}={}){const before=graph.serialize();try{action();history.push(before);if(history.length>60)history.shift();future=[];markDirty();if(rebuild)rebuildGraph();else{renderPositions();}updateHistory();}catch(e){graph.load(before);rebuildGraph();toast(e.message,true);}}
function undo(redo=false){const source=redo?future:history,target=redo?history:future;if(!source.length)return;target.push(graph.serialize());graph.load(source.pop());$('diagram-name').value=graph.data.name;selected=null;selectedIds.clear();connectionStart=null;markDirty();rebuildGraph();}
function loadDiagram(data,id=null){documentSession++;graph.load(data);documentUrl(id);selected=null;selectedIds.clear();connectionStart=null;history=[];future=[];dirty=false;revision++;lastSaved=id?'Diagrama antigo · salve em arquivo JSON':'Diagrama não salvo';$('diagram-name').value=data.name;$('save-state').textContent=lastSaved;setTool('select');rebuildGraph();fit();}

function renderCatalog(){
  const items=filterCatalog(catalog,provider,$('search').value);
  $('catalog-count').textContent=`${items.length}/${catalog.length}`;
  $('catalog-count').title=`${items.length} componentes exibidos de ${catalog.length}`;
  const categories=[...new Set(items.map(c=>c.category))];
  if(provider==='shared'){
    const order=['Mensageria e streaming','Processamento de dados','Bancos de dados','Integração de dados','Orquestração','Analytics e notebooks'];
    const rank=category=>order.includes(category)?order.indexOf(category):order.length;
    categories.sort((a,b)=>rank(a)-rank(b));
  }
  $('catalog').innerHTML=categories.map(category=>`<section class="catalog-section"><h3>${esc(category)}</h3><div class="catalog-grid">${items.filter(i=>i.category===category).map(item=>`<button class="catalog-item" draggable="true" data-type="${item.type}" title="Adicionar ${esc(item.name)} (${(item.provider==='shared'?'GERAIS':item.provider.toUpperCase())})" aria-label="Adicionar ${esc(item.name)} ${(item.provider==='shared'?'GERAIS':item.provider.toUpperCase())}"><span class="provider-mini">${item.provider==='shared'?'':(item.provider==='shared'?'GERAIS':item.provider.toUpperCase())}</span>${icon(item)}<span class="service-name">${esc(item.name)}</span></button>`).join('')}</div></section>`).join('')||'<p class="no-results">Nenhum serviço encontrado.</p>';
}
function rebuildGraph(){
  guideLayer.replaceChildren();
  if(connectionStart&&!graph.byId.has(connectionStart)){connectionStart=null;$('draft-edge').setAttribute('d','');}
  selectedIds=new Set([...selectedIds].filter(id=>graph.byId.has(id)));
  if(selected&&!graph.byId.has(selected)&&!graph.edges.some(e=>e.id===selected))selected=null;
  $('groups').replaceChildren();$('nodes').replaceChildren();$('edges').replaceChildren();nodeElements.clear();edgeElements.clear();
  const sorted=[...graph.nodes].sort((a,b)=>graph.depth(a)-graph.depth(b));
  for(const node of sorted){
    const item=graph.catalog.get(node.type),isGroup=graph.isGroup(node);
    const g=svgEl('g',{'data-node':node.id,class:isGroup?'group':'node',tabindex:'0',role:'button','aria-label':`${node.label}, ${item.name}`});
    const title=svgEl('title',{},`${node.label} · ${node.detail||item.name}`);g.append(title);
    if(isGroup){
      g.append(svgEl('rect',{class:'group-outline',width:node.w,height:node.h,rx:9,stroke:item.color,fill:item.color}));
      g.append(svgEl('path',{class:'group-header-bg',fill:item.color,d:`M9 0H${node.w-9}Q${node.w} 0 ${node.w} 9V40H0V9Q0 0 9 0`}));
      g.append(canvasIcon(item,12,11,18));
      g.append(svgEl('text',{x:38,y:node.detail?17:23,class:'group-title',fill:item.color},short(node.label,Math.floor((node.w-65)/7))));
      if(node.detail)g.append(svgEl('text',{x:38,y:32,class:'group-detail'},short(node.detail,Math.floor((node.w-55)/5.3))));
      g.append(svgEl('rect',{class:'group-header-hit',width:node.w,height:40,rx:9}));
      g.append(svgEl('rect',{class:'resize-handle',x:node.w-9,y:node.h-9,width:9,height:9,rx:2,'data-resize':node.id}));
      for(const [side,cx,cy]of [['left',0,node.h/2],['right',node.w,node.h/2],['top',node.w/2,0],['bottom',node.w/2,node.h]])g.append(svgEl('circle',{class:'port',cx,cy,r:6,'data-port':node.id,'data-side':side}));
      $('groups').append(g);
    }else if(['text','note'].includes(node.type)){
      const note=node.type==='note';
      const align=node.textAlign||'left',textX=align==='center'?node.w/2:align==='right'?node.w-14:14,anchor=align==='center'?'middle':align==='right'?'end':'start';
      g.classList.add('annotation',note?'annotation-note':'annotation-text');
      g.append(svgEl('rect',{class:'node-card',width:node.w,height:node.h,rx:4}));
      if(note)g.append(svgEl('text',{x:textX,y:25,class:'annotation-title','text-anchor':anchor},short(node.label,Math.floor((node.w-28)/8))));
      const limit=Math.max(8,Math.floor((node.w-28)/8)),maxLines=Math.max(1,Math.floor((node.h-(note?48:20))/20));
      const lines=String(node.detail||'').split(/\r?\n/).flatMap(line=>line?wrapText(line,limit,200):['']);
      const visible=lines.slice(0,maxLines);
      if(lines.length>maxLines)visible[maxLines-1]=short(visible[maxLines-1],Math.max(1,limit-3))+'...';
      const body=svgEl('text',{class:'annotation-body','text-anchor':anchor});svgLines(body,visible,textX,note?50:26,20);g.append(body);
      g.append(svgEl('rect',{class:'resize-handle',x:node.w-9,y:node.h-9,width:9,height:9,rx:2,'data-resize':node.id}));
      $('nodes').append(g);
    }else{
      g.append(svgEl('rect',{class:'node-card',width:node.w,height:node.h,rx:9}));
      if(!item.iconAsset)g.append(svgEl('rect',{x:11,y:13,width:34,height:34,rx:7,fill:item.color,'fill-opacity':.09}));
      g.append(item.iconAsset?canvasIcon(item,12,14,32):canvasIcon(item,17,19,22));
      g.append(svgEl('text',{x:53,y:23,class:'node-provider'},item.provider==='shared'?'GERAL':(item.provider==='shared'?'GERAIS':item.provider.toUpperCase())));
      const titleText=svgEl('text',{class:'node-label'});svgLines(titleText,wrapText(node.label,Math.max(10,Math.floor((node.w-62)/6.5)),2),53,38);g.append(titleText);
      const detailLines=wrapText(node.detail,Math.max(20,Math.floor((node.w-24)/4.8)),Math.max(1,Math.min(4,Math.floor((node.h-58)/12))));
      const detailText=svgEl('text',{class:'node-detail'});svgLines(detailText,detailLines,12,node.h-12-(detailLines.length-1)*12);g.append(detailText);
      for(const [side,cx,cy]of [['left',0,node.h/2],['right',node.w,node.h/2],['top',node.w/2,0],['bottom',node.w/2,node.h]])g.append(svgEl('circle',{class:'port',cx,cy,r:6,'data-port':node.id,'data-side':side}));
      g.append(svgEl('rect',{class:'resize-handle',x:node.w-9,y:node.h-9,width:9,height:9,rx:2,'data-resize':node.id}));
      $('nodes').append(g);
    }
    nodeElements.set(node.id,g);
  }
  for(const edge of graph.edges){const g=svgEl('g',{'data-edge':edge.id,'data-dash':edge.dash,class:`edge ${['trigger','green','orange'].includes(edge.kind)?edge.kind:'data'}`});g.append(svgEl('path',{class:'edge-hit'}),svgEl('path',{class:'edge-path','marker-end':'url(#arrow)'}),svgEl('text',{class:'edge-label'}));$('edges').append(g);edgeElements.set(edge.id,g);}
  $('empty-state').hidden=graph.nodes.length>0;
  const groups=graph.nodes.filter(n=>graph.isGroup(n)).length;
  $('graph-stats').textContent=`${graph.nodes.length-groups} recursos · ${groups} contêineres · ${graph.edges.length} conexões`;
  renderPositions();renderSelection();renderLayers();updateHistory();
}
function renderPositions(){
  if(!graph)return;
  for(const n of graph.nodes){const g=nodeElements.get(n.id),p=graph.world(n);g?.setAttribute('transform',`translate(${p.x} ${p.y})`);}
  for(const e of graph.edges){const el=edgeElements.get(e.id),geom=edgeGeometry(graph,e);if(!el||!geom)continue;el.children[0].setAttribute('d',geom.d);el.children[1].setAttribute('d',geom.d);const lines=wrapText(e.label,Math.max(8,Math.floor(geom.labelWidth/4.8)),3);svgLines(el.children[2],lines,geom.x,geom.y-9-(lines.length-1)*11,11);el.children[2].style.textAnchor=geom.labelAnchor;}
  renderSelectionClasses();
}
function applyArrowheads(path,edge,selected=false){
  const marker='url(#'+(selected?'arrow-selected':['trigger','green','orange'].includes(edge.kind)?'arrow-'+edge.kind:'arrow')+')';
  path.setAttribute('marker-start',edge.sourceArrow?marker:'none');
  path.setAttribute('marker-end',edge.targetArrow!==false?marker:'none');
}
function renderSelectionClasses(){
  for(const[id,g]of nodeElements)g.classList.toggle('selected',selectedIds.has(id)||id===connectionStart);
  for(const[id,g]of edgeElements){g.classList.toggle('selected',id===selected);const edge=graph.edges.find(e=>e.id===id);applyArrowheads(g.children[1],edge,id===selected);}
}
function renderLayers(){
  $('layer-count').textContent=graph.nodes.length;
  const ordered=[];function visit(parent){for(const n of graph.children(parent)){ordered.push(n);visit(n.id);}}visit(null);
  $('layers').innerHTML=ordered.map(n=>`<button class="layer-item ${selectedIds.has(n.id)?'selected':''}" data-layer="${esc(n.id)}" style="padding-left:${graph.depth(n)*10+3}px" title="${esc(n.label)}">${icon(graph.catalog.get(n.type))}<span class="layer-text">${esc(n.label)}</span></button>`).join('')||'<p class="section-note">Seus componentes aparecerão aqui.</p>';
}
function select(id,showPanel=false,additive=false){if(additive&&graph.byId.has(id)){if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);selected=[...selectedIds][0]||null;}else{selected=id;selectedIds=new Set(graph.byId.has(id)?[id]:[]);}renderSelectionClasses();renderSelection();renderLayers();updateHistory();if(showPanel&&innerWidth<=940&&!document.querySelector('.workspace').classList.contains('hide-inspector')){$('inspector').classList.add('mobile-open');syncPanelButtons();}}
function field(label,id,value,type='text',extra=''){return `<label class="field-label" for="${id}">${label}</label><input class="field" id="${id}" type="${type}" value="${esc(value)}" ${extra}>`;}
function selectMany(ids){const next=new Set(ids);if(next.size===selectedIds.size&&[...next].every(id=>selectedIds.has(id))&&selected===([...next][0]||null))return;selectedIds=next;selected=[...selectedIds][0]||null;renderSelectionClasses();renderSelection();renderLayers();updateHistory();}
function selectionOrigins(){return selectionRoots(graph,selectedIds).map(n=>({id:n.id,x:n.x,y:n.y}));}
function renderSelection(){
  if(selectedIds.size>1){$('selection-panel').innerHTML=`<div class="selection-overview"><div><strong>${selectedIds.size} elementos selecionados</strong><small>Seleção múltipla</small></div></div><p>Arraste um dos elementos para mover todos juntos.</p><p>Shift + clique adiciona ou remove elementos. Delete exclui a seleção. Esc limpa a seleção.</p>`;return;}
  const node=graph.byId.get(selected),edge=graph.edges.find(e=>e.id===selected);
  if(node){
    const item=graph.catalog.get(node.type),group=graph.isGroup(node);
    const eligible=graph.nodes.filter(n=>graph.isGroup(n)&&graph.canParent(node,n));
    $('selection-panel').innerHTML=`<div class="selection-overview">${icon(item)}<div><strong>${esc(item.name)}</strong><small>${item.provider==='shared'?'Componente genérico':item.provider==='aws'?'Amazon Web Services':'Google Cloud'}</small></div></div>${field('Nome','prop-label',node.label,'text','maxlength="120"')}${['text','note'].includes(node.type)?'<label class="field-label" for="prop-detail">Texto</label><textarea class="field notes-field" id="prop-detail" maxlength="2000" rows="8">'+esc(node.detail)+'</textarea>':field('Descrição','prop-detail',node.detail,'text','maxlength="180"')}<label class="field-label" for="prop-parent">Dentro de</label><select class="field" id="prop-parent"><option value="">Canvas · sem contêiner</option>${eligible.map(n=>`<option value="${esc(n.id)}" ${node.parent===n.id?'selected':''}>${esc(n.label)}</option>`).join('')}</select><div class="field-row">${field('Largura','prop-width',Math.round(node.w),'number',`min="${group?210:148}" max="10000"`)}${field('Altura','prop-height',Math.round(node.h),'number',`min="${group?150:76}" max="10000"`)}</div><p class="section-note">${group?'Arraste o cabeçalho para mover todo o grupo.':'Alt + arraste para trocar de contêiner.'} Use o canto inferior direito para redimensionar. Segure Shift ao arrastar para encaixar em centros, bordas e espaços iguais, ou ao redimensionar para igualar medidas.</p>`;
    if(['text','note'].includes(node.type)){
      const controls=document.createElement('div');controls.innerHTML='<span class="field-label">Alinhamento</span><div class="edge-options" role="group" aria-label="Alinhamento">'+[['left','Esquerda','M4 5h24M4 12h16M4 19h24'],['center','Centralizar','M4 5h24M8 12h16M4 19h24'],['right','Direita','M4 5h24M12 12h16M4 19h24']].map(([value,name,path])=>'<button type="button" class="edge-option" data-align="'+value+'" title="'+name+'" aria-label="'+name+'" aria-pressed="'+((node.textAlign||'left')===value)+'"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="'+path+'"/></svg></button>').join('')+'</div>';
      $('prop-detail').after(controls);
      for(const button of controls.querySelectorAll('[data-align]'))button.onclick=()=>change(()=>node.textAlign=button.dataset.align);
    }
    $('prop-label').onchange=e=>change(()=>{node.label=e.target.value;});
    $('prop-detail').onchange=e=>change(()=>{node.detail=e.target.value;});
    $('prop-parent').onchange=e=>change(()=>graph.reparent(node,e.target.value||null));
    for(const id of ['prop-width','prop-height'])$(id).onchange=()=>change(()=>{const w=Number($('prop-width').value),h=Number($('prop-height').value);if(!Number.isFinite(w)||!Number.isFinite(h))throw new Error('Dimensões inválidas.');graph.resize(node,w,h);});
  }else if(edge){
    $('selection-panel').innerHTML=`<div class="selection-overview"><span class="connection-icon">⌁</span><div><strong>Conexão</strong><small>${esc(graph.byId.get(edge.source).label)} → ${esc(graph.byId.get(edge.target).label)}</small></div></div>${field('Rótulo / protocolo','prop-edge-label',edge.label,'text','maxlength="120"')}<span class="field-label">Tra&#231;ado</span><div class="edge-options" role="group" aria-label="Tra&#231;ado"><button type="button" class="edge-option" data-edge-style="curve" aria-label="Curva" title="Curva"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 20C3 3 29 21 29 4"/></svg></button><button type="button" class="edge-option" data-edge-style="straight" aria-label="Reta" title="Reta"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 19L29 5"/></svg></button><button type="button" class="edge-option" data-edge-style="orthogonal" aria-label="Ortogonal" title="Ortogonal"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 20H16V4H29"/></svg></button></div><span class="field-label">Estilo da linha</span><div class="edge-options" role="group" aria-label="Estilo da linha"><button type="button" class="edge-option" data-edge-dash="solid" aria-label="Cont&#237;nua" title="Cont&#237;nua"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 12H29" stroke-dasharray="none"/></svg></button><button type="button" class="edge-option" data-edge-dash="dashed" aria-label="Tracejada" title="Tracejada"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 12H29" stroke-dasharray="6 4"/></svg></button><button type="button" class="edge-option" data-edge-dash="dotted" aria-label="Pontilhada" title="Pontilhada"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 12H29" stroke-dasharray="1 5"/></svg></button></div><span class="field-label">Cor da linha</span><div class="edge-options edge-colors" role="group" aria-label="Cor da linha"><button type="button" class="edge-option" data-edge-kind="data" aria-label="Azul" title="Azul"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="#508be1"/></svg></button><button type="button" class="edge-option" data-edge-kind="trigger" aria-label="Roxo" title="Roxo"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="#9473aa"/></svg></button><button type="button" class="edge-option" data-edge-kind="green" aria-label="Verde" title="Verde"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="#27845b"/></svg></button><button type="button" class="edge-option" data-edge-kind="orange" aria-label="Laranja" title="Laranja"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="#d47b23"/></svg></button></div><label class="field-label" for="prop-source-port">Sa&#237;da da origem</label><select class="field" id="prop-source-port"></select><label class="field-label" for="prop-target-port">Entrada no destino</label><select class="field" id="prop-target-port"></select><p class="section-note">A conexão acompanha os componentes quando você os move.</p>`;
    for(const [attribute,key] of [['data-edge-style','style'],['data-edge-kind','kind'],['data-edge-dash','dash']]){for(const button of $('selection-panel').querySelectorAll(`[${attribute}]`)){const value=button.getAttribute(attribute);button.setAttribute('aria-pressed',String(edge[key]===value));button.onclick=()=>{if(edge[key]!==value)change(()=>edge[key]=value);};}}
    const arrowControls=document.createElement('div');
    arrowControls.innerHTML=[['sourceArrow','Ponta na origem'],['targetArrow','Ponta no destino']].map(([key,label])=>'<span class="field-label">'+label+'</span><div class="edge-options" role="group" aria-label="'+label+'">'+[[false,'Sem ponta'],[true,'Com ponta']].map(([value,name])=>'<button type="button" class="edge-option" data-arrow-key="'+key+'" data-arrow-value="'+value+'" title="'+name+'" aria-label="'+name+'" aria-pressed="'+((key==='targetArrow'?edge[key]!==false:!!edge[key])===value)+'"><svg viewBox="0 0 32 24" aria-hidden="true"><path d="M4 12H28'+(value?(key==='sourceArrow'?'M11 5 4 12 11 19':'M21 5 28 12 21 19'):'')+'"/></svg></button>').join('')+'</div>').join('');
    $('prop-source-port').previousElementSibling.before(arrowControls);
    for(const button of arrowControls.querySelectorAll('[data-arrow-key]'))button.onclick=()=>change(()=>edge[button.dataset.arrowKey]=button.dataset.arrowValue==='true');
    const portOptions='<option value="auto">Autom&#225;tico</option><option value="top">Topo</option><option value="right">Direita</option><option value="bottom">Base</option><option value="left">Esquerda</option>';
    for(const [id,key] of [['prop-source-port','sourcePort'],['prop-target-port','targetPort']]){$(id).innerHTML=portOptions;$(id).value=edge[key];$(id).onchange=e=>change(()=>edge[key]=e.target.value);}
    $('prop-edge-label').onchange=e=>change(()=>edge.label=e.target.value);
  }else{
    $('selection-panel').innerHTML=`<div class="selection-overview"><span class="selection-symbol">◇</span><div><strong>Seu workspace</strong><small>AWS + Google Cloud</small></div></div><p>Selecione um componente ou conexão para editar suas propriedades.</p><div class="selection-tips"><p><strong>1.</strong> Adicione regiões e zonas.<br><strong>2.</strong> Arraste recursos para dentro.<br><strong>3.</strong> Conecte os componentes.</p></div><label class="field-label" for="prop-notes">Notas da arquitetura</label><textarea class="field notes-field" id="prop-notes" maxlength="2000" rows="7">${esc(graph.data.notes)}</textarea>`;
    $('prop-notes').onchange=e=>change(()=>graph.data.notes=e.target.value);
  }
}
function setTool(value){if(drag)endDrag(true);tool=value;connectionStart=null;$('draft-edge').setAttribute('d','');for(const t of ['select','pan','connect']){$(`${t}-tool`).classList.toggle('active',t===value);$(`${t}-tool`).setAttribute('aria-pressed',t===value);}
  canvas.classList.toggle('panning',value==='pan');canvas.classList.toggle('connecting',value==='connect');$('mode-hint').textContent=value==='connect'?'Clique na origem e depois no destino · Esc para cancelar':value==='pan'?'Arraste o canvas para navegar':'Arraste um ponto lateral para conectar · Shift + clique para selecionar vários';renderSelectionClasses();}
function transform(){ $('viewport').setAttribute('transform',`translate(${view.x} ${view.y}) scale(${view.z})`);$('grid').setAttribute('patternTransform',`translate(${view.x} ${view.y}) scale(${view.z})`);$('zoom-value').textContent=`${Math.round(view.z*100)}%`; }
function point(event){const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left-view.x)/view.z,y:(event.clientY-r.top-view.y)/view.z};}
function fit(){const r=canvas.getBoundingClientRect(),b=graph.bounds();if(!r.width||!r.height)return;view.z=clamp(Math.min((r.width-100)/b.w,(r.height-170)/b.h),.15,1.35);view.x=(r.width-b.w*view.z)/2-b.x*view.z;view.y=(r.height-b.h*view.z)/2-b.y*view.z+15;transform();}
function zoom(factor,clientX,clientY){const r=canvas.getBoundingClientRect(),x=(clientX??r.left+r.width/2)-r.left,y=(clientY??r.top+r.height/2)-r.top;const z=clamp(view.z*factor,.15,2.5);view.x=x-(x-view.x)*z/view.z;view.y=y-(y-view.y)*z/view.z;view.z=z;transform();}
function addComponent(type,position=null){
  const item=graph.catalog.get(type),r=canvas.getBoundingClientRect();
  const p=position||{x:(r.width/2-view.x)/view.z,y:(r.height/2-view.y)/view.z};
  let parent=position?graph.containing(p.x,p.y,item.group?210:148,item.group?150:76):graph.byId.get(selected);
  if(parent&&!graph.isGroup(parent))parent=graph.byId.get(parent.parent);
  change(()=>{const node=graph.add(type,p.x-(item.group?190:74),p.y-(item.group?145:38),parent?.id);if(!position)graph.placeNew(node);selected=node.id;selectedIds=new Set([node.id]);});
  canvas.focus({preventScroll:true});

}
function connectTo(id){if(!connectionStart){connectionStart=id;selected=id;selectedIds=new Set([id]);renderSelectionClasses();$('mode-hint').textContent='Agora clique no destino · Esc para cancelar';return;}
  const from=connectionStart;change(()=>{selected=graph.connect(from,id).id;selectedIds.clear();});connectionStart=null;$('draft-edge').setAttribute('d','');$('mode-hint').textContent='Conexão criada. Clique na próxima origem ou pressione V.';}

function previewConnection(event){
  const d=drag,p=point(event);
  for(const el of nodeElements.values()){el.classList.remove('connection-target');for(const port of el.querySelectorAll('.port'))port.classList.remove('port-target');}
  const hit=document.elementFromPoint(event.clientX,event.clientY);
  const target=graph.byId.get(hit?.closest('[data-node]')?.dataset.node);
  d.target=null;
  if(target&&target.id!==d.id){
    const box=graph.world(target);
    const sides=[['left',box.x,box.y+target.h/2],['right',box.x+target.w,box.y+target.h/2],['top',box.x+target.w/2,box.y],['bottom',box.x+target.w/2,box.y+target.h]];
    d.target=target.id;
    d.targetPort=hit.dataset.side||sides.sort((a,b)=>Math.hypot(p.x-a[1],p.y-a[2])-Math.hypot(p.x-b[1],p.y-b[2]))[0][0];
    const el=nodeElements.get(target.id);el.classList.add('connection-target');el.querySelector(`[data-side="${d.targetPort}"]`)?.classList.add('port-target');
  }
  const floating={id:'__draft_target',x:p.x,y:p.y,w:0,h:0};
  const previewGraph=d.target?graph:{byId:new Map([...graph.byId,[floating.id,floating]]),center:n=>n===floating?p:graph.center(n)};
  const geometry=edgeGeometry(previewGraph,{source:d.id,target:d.target||floating.id,sourcePort:d.sourcePort,targetPort:d.target?d.targetPort:'auto',style:'curve'});
  $('draft-edge').setAttribute('d',geometry.d);
}
function clearConnectionPreview(){
  $('draft-edge').setAttribute('d','');canvas.classList.remove('connection-dragging');
  for(const el of nodeElements.values()){el.classList.remove('connection-target');for(const port of el.querySelectorAll('.port'))port.classList.remove('port-target');}
}

canvas.addEventListener('pointerdown',event=>{
  if(!graph||event.button>1)return;
  canvas.focus({preventScroll:true});

  const nodeId=event.target.closest('[data-node]')?.dataset.node,edgeId=event.target.closest('[data-edge]')?.dataset.edge;
  const hitNode=graph.byId.get(nodeId),node=event.target.classList.contains('group-outline')?null:hitNode,p=point(event);
  if(tool==='pan'||spaceDown||event.button===1){event.preventDefault();drag={kind:'pan',startX:event.clientX,startY:event.clientY,x:view.x,y:view.y};canvas.setPointerCapture(event.pointerId);return;}
  if(node&&event.target.hasAttribute('data-port')){
    event.preventDefault();connectionStart=null;
    drag={kind:'connection',id:node.id,sourcePort:event.target.dataset.side};
    canvas.classList.add('connection-dragging');canvas.setPointerCapture(event.pointerId);
    $('mode-hint').textContent='Arraste até o destino · Esc para cancelar';previewConnection(event);return;
  }
  if(node&&tool==='connect'){connectTo(node.id);event.preventDefault();return;}
  if(tool==='connect'){connectionStart=null;$('draft-edge').setAttribute('d','');renderSelectionClasses();return;}
  if(node){
    event.preventDefault();
    const kind=event.target.hasAttribute('data-resize')?'resize':'node';
    const selectionBefore=[...selectedIds],selectedBefore=selected;
    // Shift+click toggles on release; Shift+drag can use the prior selection as a reference.
    const shiftSelect=event.shiftKey&&kind==='node';
    if(kind==='resize')select(node.id);
    else if(!selectedIds.has(node.id))select(node.id);
    const snapshot=graph.serialize();
    if(event.altKey&&kind==='node'&&selectedIds.size===1)graph.reparent(node,null);
    const origin=graph.world(node);
    drag={kind,id:node.id,start:p,offset:{x:p.x-origin.x,y:p.y-origin.y},x:node.x,y:node.y,w:node.w,h:node.h,snapshot,moved:false,origins:selectionOrigins(),reparent:event.altKey&&kind==='node'&&selectedIds.size===1,shiftSelect,selectionBefore,selectedBefore};
    canvas.setPointerCapture(event.pointerId);
  }else if(edgeId){select(edgeId,true);}else{event.preventDefault();drag={kind:'marquee',start:p,before:[...selectedIds],base:event.shiftKey?[...selectedIds]:[]};if(!event.shiftKey)select(null);canvas.setPointerCapture(event.pointerId);}
});
canvas.addEventListener('pointermove',event=>{
  if(!graph)return;const p=point(event);
  if(drag?.kind==='connection'){previewConnection(event);return;}
  if(tool==='connect'&&connectionStart&&graph.byId.has(connectionStart)){const a=graph.center(graph.byId.get(connectionStart));$('draft-edge').setAttribute('d',`M${a.x} ${a.y} L${p.x} ${p.y}`);}
  if(!drag)return;
  if(drag.kind==='marquee'){const box={x:Math.min(p.x,drag.start.x),y:Math.min(p.y,drag.start.y),w:Math.abs(p.x-drag.start.x),h:Math.abs(p.y-drag.start.y)};for(const[k,v]of Object.entries({x:box.x,y:box.y,width:box.w,height:box.h,display:'block'}))marquee.setAttribute(k,v);selectMany([...drag.base,...nodesInBox(graph,box)]);return;}
  if(drag.kind==='pan'){view.x=drag.x+event.clientX-drag.startX;view.y=drag.y+event.clientY-drag.startY;transform();return;}
  const n=graph.byId.get(drag.id);if(!n)return;
  if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)*view.z>2)drag.moved=true;
  if(!drag.moved)return;
  if(drag.kind==='resize'){
    graph.resize(n,drag.w+p.x-drag.start.x,drag.h+p.y-drag.start.y);
    if(event.shiftKey){
      const min=graph.minimumSize(n),parent=graph.byId.get(n.parent);
      const size=snapSize(graph.world(n),guidePeers(n),8/view.z,{minW:min.w,minH:min.h,maxW:parent?parent.w-16-n.x:10000,maxH:parent?parent.h-16-n.y:10000});
      graph.resize(n,size.w,size.h);
    }
    rebuildGraph();renderGuides(n,true);
  }else{
    const applied=moveSelection(graph,drag.origins,p.x-drag.start.x,p.y-drag.start.y);
    if(event.shiftKey){
      const snap=snapPosition(graph.world(n),guidePeers(n),8/view.z);
      moveSelection(graph,drag.origins,applied.dx+snap.dx,applied.dy+snap.dy);
    }
    renderPositions();renderGuides(n);
  }
});
let lastNodeClick=null;
function endDrag(cancel=false){
  guideLayer.replaceChildren();
  if(!drag)return;const d=drag;drag=null;

  if(d.kind==='connection'){
    clearConnectionPreview();
    if(!cancel&&d.target)change(()=>{const edge=graph.connect(d.id,d.target);edge.sourcePort=d.sourcePort;edge.targetPort=d.targetPort;selected=edge.id;selectedIds.clear();});
    setTool('select');return;
  }
  if(d.kind==='marquee'){marquee.setAttribute('display','none');if(cancel)selectMany(d.before);return;}
  if(d.kind==='pan')return;
  if(cancel){graph.load(d.snapshot);selectedIds=new Set(d.selectionBefore);selected=d.selectedBefore;rebuildGraph();return;}
  if(d.shiftSelect&&!d.moved){selectedIds=new Set(d.selectionBefore);selected=d.selectedBefore;select(d.id,false,true);}
  if(!d.moved&&!d.reparent){if(d.kind==='node'&&!d.shiftSelect){const now=performance.now();if(lastNodeClick?.id===d.id&&now-lastNodeClick.time<450){lastNodeClick=null;editNodeText(d.id);}else lastNodeClick={id:d.id,time:now};}return;}
  lastNodeClick=null;
  const node=graph.byId.get(d.id);
  if(d.reparent&&node){const p=graph.center(node);const excluded=new Set([node.id,...graph.descendants(node.id).map(n=>n.id)]);const target=graph.nodes.filter(n=>!excluded.has(n.id)&&graph.isGroup(n)&&graph.canParent(node,n)).sort((a,b)=>graph.depth(b)-graph.depth(a)).find(n=>{const b=graph.world(n);return p.x>b.x&&p.x<b.x+n.w&&p.y>b.y+40&&p.y<b.y+n.h;});graph.reparent(node,target?.id||null);}
  if(d.moved||d.reparent){history.push(d.snapshot);if(history.length>60)history.shift();future=[];markDirty();}
  rebuildGraph();
}
canvas.addEventListener('pointerup',event=>{if(drag?.kind==='connection')previewConnection(event);endDrag();});canvas.addEventListener('pointercancel',()=>endDrag(true));canvas.addEventListener('lostpointercapture',()=>{if(drag)endDrag(true);});
canvas.addEventListener('dblclick',event=>{
  const id=event.target.closest('[data-node]')?.dataset.node;
  if(id&&!$('dialog').open)editNodeText(id);
});
let inlineEdit=null;
function finishInlineEdit(commit=true){
  if(!inlineEdit)return;
  const {id,host,title,body,originalLabel,originalDetail}=inlineEdit;
  inlineEdit=null;
  const label=title?title.value:originalLabel,detail=body.value;
  host.remove();
  const node=graph.byId.get(id);
  if(commit&&node&&(label!==originalLabel||detail!==originalDetail)){
    change(()=>{node.label=label;node.detail=detail;});
  }else rebuildGraph();
}
document.addEventListener('pointerdown',event=>{
  if(inlineEdit&&!inlineEdit.host.contains(event.target))finishInlineEdit();
},true);
function editNodeText(id){
  if(inlineEdit?.id===id){inlineEdit.body.focus();return;}
  finishInlineEdit();
  const node=graph.byId.get(id);
  if(!node)return;
  select(id,true);
  if(!['text','note'].includes(node.type)){$('prop-label')?.focus();$('prop-label')?.select();return;}
  const note=node.type==='note',g=nodeElements.get(id);
  const host=svgEl('foreignObject',{x:0,y:0,width:node.w,height:node.h,class:'inline-annotation-editor'});
  const box=document.createElementNS('http://www.w3.org/1999/xhtml','div');
  box.className='inline-annotation-fields'+(note?' is-note':'');
  box.style.textAlign=node.textAlign||'left';
  let title=null;
  if(note){
    title=document.createElement('input');title.value=node.label;title.maxLength=120;
    title.setAttribute('aria-label','Titulo da nota');box.append(title);
  }
  const body=document.createElement('textarea');body.value=node.detail;body.maxLength=2000;
  body.setAttribute('aria-label',note?'Texto da nota':'Editar texto');
  body.setAttribute('placeholder','Digite seu texto');
  box.append(body);host.append(box);g.append(host);
  inlineEdit={id,host,title,body,originalLabel:node.label,originalDetail:node.detail};
  for(const type of ['pointerdown','pointerup','click','dblclick','wheel'])host.addEventListener(type,event=>event.stopPropagation());
  box.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();finishInlineEdit(false);canvas.focus();}
    else if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();finishInlineEdit();canvas.focus();}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();finishInlineEdit();save();}
  });
  box.addEventListener('focusout',event=>{
    if(!box.contains(event.relatedTarget))finishInlineEdit();
  });
  body.focus();
}
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(-event.deltaY*.0015),event.clientX,event.clientY);},{passive:false});
canvas.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('application/cloud-component')){event.preventDefault();event.dataTransfer.dropEffect='copy';}});
canvas.addEventListener('drop',event=>{event.preventDefault();const type=event.dataTransfer.getData('application/cloud-component');if(graph.catalog.has(type))addComponent(type,point(event));});

function dialog(title,html){$('dialog-title').textContent=title;$('dialog-body').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();}
function confirmAction(title,message,action,label='Continuar'){dialog(title,`<p class="dialog-copy">${esc(message)}</p><div class="dialog-actions"><button class="outlined" id="cancel-action">Cancelar</button><button class="primary" id="confirm-action">${esc(label)}</button></div>`);$('cancel-action').onclick=()=>$('dialog').close();$('confirm-action').onclick=()=>{$('dialog').close();action();};}
function guarded(action){if(dirty)confirmAction('Descartar alterações?','Existem alterações não salvas neste diagrama. Salve ou exporte antes de continuar se quiser mantê-las.',action,'Descartar e continuar');else action();}
function deleteSelection(){if(selectedIds.size>1){if(drag)endDrag(true);const roots=selectionRoots(graph,selectedIds),extra=new Set(roots.flatMap(n=>graph.descendants(n.id)).filter(n=>!selectedIds.has(n.id)).map(n=>n.id));const action=()=>change(()=>{for(const n of roots)graph.remove(n.id);selectedIds.clear();selected=null;});if(extra.size)confirmAction('Excluir seleção?',`Os contêineres selecionados incluem mais ${extra.size} elemento(s). Eles e suas conexões também serão excluídos. Você pode desfazer depois.`,action,'Excluir seleção');else action();return;}if(drag)endDrag(true);if(!selected)return;const node=graph.byId.get(selected),count=node?graph.descendants(node.id).length:0;const id=selected;const action=()=>change(()=>{graph.remove(id);selected=null;selectedIds.clear();});if(count)confirmAction('Excluir contêiner?',`“${node.label}” contém ${count} componente(s). Eles e suas conexões também serão excluídos. Você pode desfazer depois.`,action,'Excluir grupo');else action();}
function save(){
  try{
    finishInlineEdit();
    download(JSON.stringify(graph.serialize(),null,2),'application/json','.json');
    documentUrl(null);dirty=false;
    lastSaved='Download do JSON iniciado';$('save-state').textContent=lastSaved;
    toast('Download iniciado. Guarde o arquivo JSON para abrir depois.');
  }catch(error){toast(`Não foi possível salvar: ${error.message}`,true);}
}
function download(content,type,extension){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=(graph.data.name.replace(/[^\p{L}\p{N}_-]+/gu,'-')||'arquitetura')+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function buildExportSvg(){
  const b=graph.bounds(),clone=canvas.cloneNode(true);clone.removeAttribute('id');clone.removeAttribute('tabindex');clone.removeAttribute('class');clone.setAttribute('xmlns',NS);clone.setAttribute('viewBox',`${b.x-40} ${b.y-40} ${b.w+80} ${b.h+80}`);clone.setAttribute('width',b.w+80);clone.setAttribute('height',b.h+80);
  clone.querySelector('#grid-bg')?.remove();clone.querySelector('#draft-edge')?.remove();clone.querySelector('#alignment-guides')?.remove();clone.querySelector('#selection-box')?.remove();clone.querySelector('#viewport').removeAttribute('transform');
  for(const el of clone.querySelectorAll('.port,.resize-handle,.edge-hit,.group-header-hit'))el.remove();
  for(const el of clone.querySelectorAll('.selected'))el.classList.remove('selected');
  for(const el of clone.querySelectorAll('[tabindex]'))el.removeAttribute('tabindex');
  for(const el of clone.querySelectorAll('.edge-path')){const edge=graph.edges.find(e=>e.id===el.parentElement.dataset.edge);applyArrowheads(el,edge);}
  const bg=svgEl('rect',{x:b.x-40,y:b.y-40,width:b.w+80,height:b.h+80,fill:getComputedStyle($('canvas-wrap')).backgroundColor});clone.insertBefore(bg,clone.querySelector('#viewport'));
  // Resolve the actual theme on an unselected copy, then embed its styles.
  // This keeps SVG and PNG in sync with the editor without a second theme.
  const host=document.createElement('div');
  host.style.cssText='position:fixed;left:-100000px;top:0;pointer-events:none';
  host.setAttribute('aria-hidden','true');document.body.append(host);host.append(clone);
  const properties=['fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','filter','font-family','font-size','font-weight','font-style','letter-spacing','text-anchor','dominant-baseline','paint-order','rx','ry','color','visibility'];
  try{
    const resolved=[clone,...clone.querySelectorAll('*')].map(element=>{
      const computed=getComputedStyle(element);
      return [element,properties.map(property=>[property,computed.getPropertyValue(property)])];
    });
    for(const [element,styles] of resolved)for(const [property,value] of styles)if(value)element.style.setProperty(property,value);
  }finally{clone.remove();host.remove();}

  return clone;
}
function exportSvg(){
  download(new XMLSerializer().serializeToString(buildExportSvg()),'image/svg+xml;charset=utf-8','.svg');
}
async function exportPng(){
  const button=$('export-png');button.disabled=true;
  try{
    await document.fonts.ready;
    const svg=buildExportSvg(),width=Number(svg.getAttribute('width')),height=Number(svg.getAttribute('height'));
    const scale=Math.min(2,8192/width,8192/height,Math.sqrt(16777216/(width*height)));
    const raster=document.createElement('canvas');
    raster.width=Math.max(1,Math.round(width*scale));raster.height=Math.max(1,Math.round(height*scale));
    const ctx=raster.getContext('2d');if(!ctx)throw new Error('Nao foi possivel criar a imagem.');
    const svgUrl=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}));
    try{
      const img=new Image();img.src=svgUrl;await img.decode();
      ctx.fillStyle='#fff';ctx.fillRect(0,0,raster.width,raster.height);
      ctx.drawImage(img,0,0,raster.width,raster.height);
      const blob=await new Promise(resolve=>raster.toBlob(resolve,'image/png'));
      if(!blob)throw new Error('Nao foi possivel gerar o PNG.');
      download(blob,'image/png','.png');$('dialog').close();toast('PNG exportado.');
    }finally{URL.revokeObjectURL(svgUrl);}
  }catch(error){toast('Erro ao exportar PNG: '+error.message,true);}
  finally{button.disabled=false;}
}
function exportDialog(){dialog('Exportar arquitetura',`<button class="dialog-option" id="export-json"><strong>Diagrama editável · JSON</strong><small>Preserva componentes, contêineres e conexões.</small></button><button class="dialog-option" id="export-png"><strong>Imagem &#183; PNG</strong><small>Imagem em alta resolu&#231;&#227;o para compartilhar.</small></button><button class="dialog-option" id="export-svg"><strong>Imagem vetorial · SVG</strong><small>Para documentação, apresentações e visualização em qualquer escala.</small></button>`);$('export-png').onclick=exportPng;$('export-json').onclick=()=>{download(JSON.stringify(graph.serialize(),null,2),'application/json','.json');$('dialog').close();};$('export-svg').onclick=()=>{exportSvg();$('dialog').close();};}
function help(){dialog('Atalhos e navegação',`<div class="shortcut"><span>Selecionar uma área</span><kbd>Clique + arraste no vazio</kbd></div><div class="shortcut"><span>Adicionar / remover da seleção</span><kbd>Shift + clique</kbd></div><div class="shortcut"><span>Encaixar nas guias</span><kbd>Shift + arraste</kbd></div><div class="shortcut"><span>Selecionar todos</span><kbd>Ctrl + A</kbd></div><div class="shortcut"><span>Selecionar / mover / conectar</span><kbd>V / H / C</kbd></div><div class="shortcut"><span>Salvar</span><kbd>Ctrl + S</kbd></div><div class="shortcut"><span>Desfazer / refazer</span><kbd>Ctrl + Z / Ctrl + Shift + Z</kbd></div><div class="shortcut"><span>Enquadrar diagrama</span><kbd>F</kbd></div><div class="shortcut"><span>Excluir seleção</span><kbd>Delete</kbd></div><div class="shortcut"><span>Cancelar conexão ou arraste</span><kbd>Esc</kbd></div><div class="shortcut"><span>Mover canvas</span><kbd>Espaço + arraste</kbd></div><div class="shortcut"><span>Trocar contêiner</span><kbd>Alt + arraste</kbd></div><div class="shortcut"><span>Mover seleção</span><kbd>Setas / Shift + setas</kbd></div><p class="dialog-copy">Use a lista de camadas para selecionar pelo teclado. Clique em “Dentro de” para alterar o contêiner. Arraste os componentes para posicioná-los; as conexões acompanham o movimento.</p>`);}

function bind(){
  $('catalog').addEventListener('click',e=>{const btn=e.target.closest('[data-type]');if(btn)addComponent(btn.dataset.type);});
  $('catalog').addEventListener('dragstart',e=>{const btn=e.target.closest('[data-type]');if(btn){e.dataTransfer.setData('application/cloud-component',btn.dataset.type);e.dataTransfer.effectAllowed='copy';}});
  $('search').oninput=renderCatalog;document.querySelectorAll('[data-provider]').forEach(btn=>btn.onclick=()=>{provider=btn.dataset.provider;document.querySelectorAll('[data-provider]').forEach(b=>b.classList.toggle('active',b===btn));renderCatalog();});
  $('layers').onclick=e=>{const btn=e.target.closest('[data-layer]');if(btn)select(btn.dataset.layer,true,e.shiftKey);};
  for(const t of ['select','pan','connect'])$(`${t}-tool`).onclick=()=>setTool(t);
  $('arrange-btn').onclick=()=>{if(drag)endDrag(true);const node=graph.byId.get(selected);if(selectedIds.size===1&&node&&graph.isGroup(node))change(()=>graph.arrangeGroup(node));};
  $('undo-btn').onclick=()=>undo();$('redo-btn').onclick=()=>undo(true);$('delete-btn').onclick=deleteSelection;
  $('fit-btn').onclick=fit;$('zoom-in').onclick=()=>zoom(1.2);$('zoom-out').onclick=()=>zoom(1/1.2);
  $('save-btn').onclick=save;$('open-btn').onclick=()=>guarded(()=>$('file-input').click());$('export-btn').onclick=exportDialog;$('help-btn').onclick=help;
  $('new-btn').onclick=()=>guarded(()=>{dialog('Novo diagrama',`<button class="dialog-option" id="new-empty"><strong>Canvas em branco</strong><small>Comece com seus próprios recursos e contêineres.</small></button><button class="dialog-option" id="new-example"><strong>Exemplo multicloud</strong><small>AWS com duas zonas e integração com Google Cloud.</small></button>`);$('new-empty').onclick=()=>{loadDiagram({version:1,name:'Arquitetura sem título',nodes:[],edges:[]});$('dialog').close();};$('new-example').onclick=async()=>{try{loadDiagram(await api('/static/example.json'));$('dialog').close();}catch(e){toast(e.message,true);}};});
  $('diagram-name').onchange=e=>change(()=>{graph.data.name=e.target.value.trim()||'Arquitetura sem título';e.target.value=graph.data.name;},{rebuild:false});
  $('dialog-close').onclick=()=>$('dialog').close();$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const b=$('dialog').getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)$('dialog').close();}});
  $('import-btn').onclick=()=>guarded(()=>$('file-input').click());
  if($('select-all-btn'))$('select-all-btn').onclick=()=>{endDrag(true);selectMany(graph.nodes.map(n=>n.id));canvas.focus();};
  $('file-input').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>2*1024*1024)throw new Error('O arquivo deve ter até 2 MB.');const input=JSON.parse(await file.text());const clean=await api('/api/validate',{method:'POST',body:JSON.stringify(input)});loadDiagram(clean);lastSaved='Arquivo JSON aberto';$('save-state').textContent=lastSaved;toast('Diagrama aberto. Salvar baixa uma nova cópia em JSON.');}catch(error){toast(`Não foi possível importar: ${error.message}`,true);}};
  $('toggle-library').onclick=()=>togglePanel('library');$('toggle-inspector').onclick=()=>togglePanel('inspector');syncPanelButtons();
  document.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
    if(mod&&key==='s'&&!$('dialog').open){e.preventDefault();if(e.target.matches('input,select,textarea'))e.target.blur();save();return;}
    if(e.target.closest('input,select,textarea,[contenteditable]'))return;
    if($('dialog').open)return;
    if(mod&&key==='a'){e.preventDefault();endDrag(true);selectMany(graph.nodes.map(n=>n.id));return;}
    if(mod&&key==='z'){e.preventDefault();endDrag(true);undo(e.shiftKey);return;}if(mod&&key==='y'){e.preventDefault();endDrag(true);undo(true);return;}
    if(e.key===' '&&(e.target===canvas||canvas.contains(e.target)||e.target===document.body)){e.preventDefault();spaceDown=true;canvas.classList.add('panning');}
    if(e.key==='Escape'){endDrag(true);select(null);setTool('select');$('inspector').classList.remove('mobile-open');syncPanelButtons();}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelection();}
    if(key==='v')setTool('select');if(key==='h')setTool('pan');if(key==='c')setTool('connect');if(key==='f')fit();if(e.key==='?')help();
    if(e.key==='Enter'){const id=e.target.closest('[data-node]')?.dataset.node;if(id){if(tool==='connect')connectTo(id);else select(id,true,e.shiftKey);}}
    if(e.key.startsWith('Arrow')&&graph.byId.has(selected)){e.preventDefault();const origins=selectionOrigins(),step=e.shiftKey?20:5;change(()=>{moveSelection(graph,origins,e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0,e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0);},{rebuild:false});}
  });
  document.addEventListener('keyup',e=>{if(e.key===' '){spaceDown=false;canvas.classList.toggle('panning',tool==='pan');}});
  window.addEventListener('blur',()=>{spaceDown=false;canvas.classList.toggle('panning',tool==='pan');endDrag(true);});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  window.addEventListener('resize',()=>{transform();syncPanelButtons();});
}
async function start(){try{
  catalog=await api('/static/catalog.json');
  officialIcons=await loadOfficialIcons(catalog);
  const requestedId=new URLSearchParams(location.search).get('diagram');
  const result=requestedId?await api('/api/diagrams/'+encodeURIComponent(requestedId)):null;
  const sample=result?result.diagram:{version:1,name:'Arquitetura sem título',notes:'',nodes:[],edges:[]};
  graph=new Graph(catalog,sample);bind();renderCatalog();loadDiagram(sample,result?.id);
}catch(error){$('catalog').innerHTML=`<p class="error-panel">Não foi possível iniciar o editor. ${esc(error.message)}</p>`;$('graph-stats').textContent='Falha ao carregar';toast(error.message,true);}}
start();
