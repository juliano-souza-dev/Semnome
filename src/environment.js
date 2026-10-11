// Cenário procedural leve: silhuetas marítimas, ruínas e fumaça no horizonte.
// Decorativo: não gera colisões nem altera as mecânicas.
export function createWastelandHorizon(THREE,scene){
  const group=new THREE.Group();scene.add(group);
  const stone=new THREE.MeshLambertMaterial({color:0x244656,flatShading:true});
  const rust=new THREE.MeshLambertMaterial({color:0x4d5c62,flatShading:true});
  const dark=new THREE.MeshLambertMaterial({color:0x1d3543,flatShading:true});
  const smokeMat=new THREE.MeshBasicMaterial({color:0x526777,transparent:true,opacity:.19,depthWrite:false});
  const cloudMat=new THREE.MeshBasicMaterial({color:0x536b7b,transparent:true,opacity:.23,depthWrite:false});
  let seed=18539;function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
  const smoke=[];
  const count=24;
  for(let i=0;i<count;i++){
    const angle=i*Math.PI*2/count+(rnd()-.5)*.13;
    const radius=300+rnd()*125;
    const root=new THREE.Group();root.position.set(Math.sin(angle)*radius,0,Math.cos(angle)*radius);
    root.rotation.y=angle;group.add(root);
    const baseHeight=13+rnd()*20;
    const island=new THREE.Mesh(new THREE.ConeGeometry(10+rnd()*15,baseHeight,5),stone);
    island.position.y=baseHeight*.32-4;root.add(island);
    for(let j=0;j<2+Math.floor(rnd()*3);j++){
      const tall=10+rnd()*36;
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(1+rnd()*2,3+rnd()*3,tall,5),j%2?rust:dark);
      tower.position.set((rnd()-.5)*23,tall*.5-2,(rnd()-.5)*12);tower.rotation.z=(rnd()-.5)*.22;root.add(tower);
      if(rnd()>.56){
        const cloud=new THREE.Mesh(new THREE.SphereGeometry(5+rnd()*5,7,5),smokeMat);
        cloud.position.set(tower.position.x,tall+6,tower.position.z);cloud.scale.set(1.5,.8,1);root.add(cloud);smoke.push({mesh:cloud,seed:rnd()*6});
      }
    }
    if(i%3===0){
      const bar=new THREE.Mesh(new THREE.BoxGeometry(24,2,2.2),rust);bar.position.set(0,baseHeight+5,0);bar.rotation.z=(rnd()-.5)*.4;root.add(bar);
    }
  }
  // Nuvens distantes com movimento lento, sempre além da área jogável.
  const clouds=[];
  for(let i=0;i<14;i++){
    const angle=i*Math.PI*2/14;
    const cloud=new THREE.Mesh(new THREE.SphereGeometry(18+rnd()*25,9,6),cloudMat);
    cloud.position.set(Math.sin(angle)*470,70+rnd()*40,Math.cos(angle)*470);
    cloud.scale.set(2.7,.25,.8);group.add(cloud);clouds.push(cloud);
  }
  return {update(x,z,time){
    group.position.set(x,0,z);
    for(const {mesh,seed} of smoke){mesh.position.y+=Math.sin(time*.3+seed)*.002}
    for(let i=0;i<clouds.length;i++)clouds[i].rotation.y=time*.009;
  }};
}
