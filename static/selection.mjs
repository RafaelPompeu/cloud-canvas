import {PAD,HEADER,clamp} from './graph.mjs';

/** Existing nodes whose ancestor is not also selected, preserving ID input order. */
export function selectionRoots(graph,ids) {
  if(!ids||typeof ids[Symbol.iterator]!=='function') return [];
  const selected=new Set([...ids].filter(id=>graph.byId.has(id)));
  return [...selected].filter(id=>{
    const seen=new Set([id]);
    let parent=graph.byId.get(id).parent;
    while(parent) {
      if(selected.has(parent)) return false;
      if(seen.has(parent)) break;
      seen.add(parent);parent=graph.byId.get(parent)?.parent;
    }
    return true;
  }).map(id=>graph.byId.get(id));
}

/**
 * Move selected roots from a drag-start snapshot of LOCAL {id,x,y} coordinates.
 * Every root receives the same constrained delta, preserving relative positions.
 * Descendants travel with their ancestor and retain their own local coordinates.
 * Returns the applied delta so the caller can display the actual drag distance.
 */
export function moveSelection(graph,origins,dx,dy) {
  if(!Array.isArray(origins)||!Number.isFinite(dx)||!Number.isFinite(dy)) return {dx:0,dy:0};
  const snapshots=new Map();
  for(const origin of origins) {
    if(origin&&graph.byId.has(origin.id)&&Number.isFinite(origin.x)&&Number.isFinite(origin.y)&&!snapshots.has(origin.id)) {
      snapshots.set(origin.id,origin);
    }
  }
  const roots=selectionRoots(graph,snapshots.keys());
  if(!roots.length) return {dx:0,dy:0};
  let minX=-Infinity,maxX=Infinity,minY=-Infinity,maxY=Infinity;
  for(const node of roots) {
    const origin=snapshots.get(node.id),parent=graph.byId.get(node.parent);
    minX=Math.max(minX,(parent?PAD:-95000)-origin.x);
    maxX=Math.min(maxX,(parent?parent.w-PAD-node.w:95000)-origin.x);
    minY=Math.max(minY,(parent?HEADER:-95000)-origin.y);
    maxY=Math.min(maxY,(parent?parent.h-PAD-node.h:95000)-origin.y);
  }
  // A parent resized during the gesture can leave no common valid translation.
  // Keep the selection intact instead of independently clamping its members.
  if(minX>maxX||minY>maxY) return {dx:0,dy:0};
  const applied={dx:clamp(dx,minX,maxX),dy:clamp(dy,minY,maxY)};
  for(const node of roots) {
    const origin=snapshots.get(node.id);
    graph.move(node,origin.x+applied.dx,origin.y+applied.dy);
  }
  return applied;
}

/** Fully contained nodes, including groups only when the whole group fits. */
export function nodesInBox(graph,box) {
  if(!box||!['x','y','w','h'].every(key=>Number.isFinite(box[key]))) return [];
  const endX=box.x+box.w,endY=box.y+box.h;
  if(!Number.isFinite(endX)||!Number.isFinite(endY)) return [];
  const left=Math.min(box.x,endX),right=Math.max(box.x,endX);
  const top=Math.min(box.y,endY),bottom=Math.max(box.y,endY);
  return graph.nodes.filter(node=>{
    const r=graph.world(node);
    return r.x>=left&&r.y>=top&&r.x+r.w<=right&&r.y+r.h<=bottom;
  }).map(node=>node.id);
}
