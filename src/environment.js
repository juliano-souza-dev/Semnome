// Ruínas em coordenadas globais fixas: podem ser alcançadas pela nave.
// Possuem colisores fixos para ilhas, torres e estruturas, sem exploração interna.
export function createWastelandHorizon(THREE,scene){
  const group=new THREE.Group();scene.add(group);
  const stone=new THREE.MeshLambertMaterial({color:0x244656,flatShading:true});
  const rust=new THREE.MeshLambertMaterial({color:0x4d5c62,flatShading:true});
  const dark=new THREE.MeshLambertMaterial({color:0x1d3543,flatShading:true});
  const smokeMat=new THREE.MeshBasicMaterial({color:0x526777,transparent:true,opacity:.19,depthWrite:false});
  const cloudMat=new THREE.MeshBasicMaterial({color:0x536b7b,transparent:true,opacity:.23,depthWrite:false});
  let seed=18539;function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
  const smoke=[];
  const colliders=[];
  const count=24;
  for(let i=0;i<count;i++){
    const angle=i*Math.PI*2/count+(rnd()-.5)*.13;
    const radius=195+rnd()*245;
    const root=new THREE.Group();root.position.set(Math.sin(angle)*radius,0,Math.cos(angle)*radius);
    root.rotation.y=angle;group.add(root);
    // Disco sólido da ruína: impede atravessar sua fundação.
    colliders.push({x:root.position.x,z:root.position.z,radius:13,kind:'building'});
    const baseHeight=13+rnd()*20;
    const island=new THREE.Mesh(new THREE.ConeGeometry(10+rnd()*15,baseHeight,5),stone);
    island.position.y=baseHeight*.32-4;root.add(island);
    for(let j=0;j<2+Math.floor(rnd()*3);j++){
      const tall=10+rnd()*36;
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(1+rnd()*2,3+rnd()*3,tall,5),j%2?rust:dark);
      tower.position.set((rnd()-.5)*23,tall*.5-2,(rnd()-.5)*12);tower.rotation.z=(rnd()-.5)*.22;root.add(tower);
      const towerWorld=new THREE.Vector3(tower.position.x,0,tower.position.z).applyAxisAngle(new THREE.Vector3(0,1,0),angle).add(root.position);
      colliders.push({x:towerWorld.x,z:towerWorld.z,radius:5,kind:'building'});
      if(rnd()>.56){
        const cloud=new THREE.Mesh(new THREE.SphereGeometry(5+rnd()*5,7,5),smokeMat);
        cloud.position.set(tower.position.x,tall+6,tower.position.z);cloud.scale.set(1.5,.8,1);root.add(cloud);smoke.push({mesh:cloud,baseY:cloud.position.y,seed:rnd()*6});
      }
    }
    if(i%3===0){
      const bar=new THREE.Mesh(new THREE.BoxGeometry(24,2,2.2),rust);bar.position.set(0,baseHeight+5,0);bar.rotation.z=(rnd()-.5)*.4;root.add(bar);
    }
  }
  // Fragmentos metálicos e barris flutuantes. A física da água altera apenas a altura visual.
  const debris=[];
  const debrisMat=new THREE.MeshStandardMaterial({color:0x8c6251,metalness:.43,roughness:.7});
  for(let i=0;i<32;i++){
    const angle=rnd()*Math.PI*2,dist=55+rnd()*390;
    const px=Math.sin(angle)*dist,pz=Math.cos(angle)*dist;
    // Evita gerar obstáculos por cima das ilhas.
    if(colliders.some(c=>Math.hypot(c.x-px,c.z-pz)<c.radius+15))continue;
    const size=2.8+rnd()*3.6;
    const wreck=new THREE.Mesh(i%3===0?new THREE.CylinderGeometry(size*.53,size*.53,size*1.7,8):new THREE.BoxGeometry(size*2,size*.6,size),debrisMat);
    wreck.position.set(px,0,pz);wreck.rotation.y=rnd()*Math.PI*2;group.add(wreck);
    debris.push({mesh:wreck,x:px,z:pz,phase:rnd()*6});
    colliders.push({x:px,z:pz,radius:size*(i%3===0?.8:1.1),kind:'debris'});
  }
  // Nuvens em posições globais, sem perseguir a embarcação.
  const clouds=[];
  for(let i=0;i<14;i++){
    const angle=i*Math.PI*2/14;
    const cloud=new THREE.Mesh(new THREE.SphereGeometry(18+rnd()*25,9,6),cloudMat);
    cloud.position.set(Math.sin(angle)*470,70+rnd()*40,Math.cos(angle)*470);
    cloud.scale.set(2.7,.25,.8);group.add(cloud);clouds.push(cloud);
  }
  return {colliders,update(x,z,time,waterHeight){
    // Não transladar o grupo junto ao jogador: ruínas continuam no mesmo lugar.
    for(const item of debris){item.mesh.position.y=(waterHeight?waterHeight(item.x,item.z,time):0)+.6+Math.sin(time*1.1+item.phase)*.35;item.mesh.rotation.z=Math.sin(time*.7+item.phase)*.08;}
    for(const {mesh,baseY,seed} of smoke){mesh.position.y=baseY+Math.sin(time*.3+seed)*1.2}
    for(let i=0;i<clouds.length;i++)clouds[i].rotation.y=time*.009;
  }};
}
