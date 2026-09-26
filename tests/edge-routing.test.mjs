import assert from 'node:assert/strict';
import {Graph,edgeGeometry} from '../static/graph.mjs';

const graph=new Graph([{type:'resource',group:false}],{version:1,name:'Routing',nodes:[
  {id:'a',type:'resource',x:0,y:0,w:148,h:76,parent:null},
  {id:'b',type:'resource',x:400,y:180,w:148,h:76,parent:null},
],edges:[{id:'e',source:'a',target:'b',style:'curve',label:'API'}]});
const edge=graph.edges[0],nodes=JSON.stringify(graph.nodes);
const before=edgeGeometry(graph,edge);
edge.bendX=80;edge.bendY=-140;edge.labelPosition=.8;
const after=edgeGeometry(graph,edge);
assert.notEqual(before.d,after.d);
assert.deepEqual(before.start,after.start);assert.deepEqual(before.end,after.end);
assert.equal(after.handle.x-before.handle.x,60);
assert.equal(after.handle.y-before.handle.y,-105);
for(const sourcePort of ['top','right','bottom','left'])for(const targetPort of ['top','right','bottom','left']){
  Object.assign(edge,{style:'orthogonal',sourcePort,targetPort});
  const geometry=edgeGeometry(graph,edge),points=geometry.extent;
  for(let i=0;i<points.length;i+=2)assert.ok(points[i].x===points[i+1].x||points[i].y===points[i+1].y);
}
assert.equal(JSON.stringify(graph.nodes),nodes,'Editing routes must not move resources');
graph.load(graph.serialize());
assert.equal(graph.edges[0].labelPosition,.8);assert.equal(graph.edges[0].bendY,-140);
const bounds=graph.bounds();
for(const p of edgeGeometry(graph,graph.edges[0]).extent){assert.ok(p.x>=bounds.x&&p.x<=bounds.x+bounds.w);assert.ok(p.y>=bounds.y&&p.y<=bounds.y+bounds.h);}
console.log('Routing: curve, 16 orthogonal port combinations, persistence and bounds passed.');
