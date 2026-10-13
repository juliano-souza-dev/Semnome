// Ruínas em coordenadas globais fixas: podem ser alcançadas pela nave.
// Possuem colisores fixos para ilhas, torres e estruturas, sem exploração interna.
export function createWastelandHorizon(THREE,scene){
  const group=new THREE.Group();scene.add(group);
  const stone=new THREE.MeshLambertMaterial({color:0x394b55,flatShading:true});
  const rust=new THREE.MeshLambertMaterial({color:0x806451,flatShading:true});
  const dark=new THREE.MeshLambertMaterial({color:0x28353f,flatShading:true});
  const smokeMat=new THREE.MeshBasicMaterial({color:0x5d636b,transparent:true,opacity:.26,depthWrite:false});
  const cloudMat=new THREE.MeshBasicMaterial({color:0x778295,transparent:true,opacity:.23,depthWrite:false});
  let seed=18539;function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
  const smoke=[];
  const colliders=[];
  const count=24;
  for(let i=0;i<count;i++){
    const angle=i*Math.PI*2/count+(rnd()-.5)*.13;
    const radius=195+rnd()*245;
    const root=new THREE.Group();root.position.set(Math.sin(angle)*radius,0,Math.cos(angle)*radius);
    root.rotation.y=angle;group.add(root);
    const baseHeight=13+rnd()*20;
    const islandRadius=10+rnd()*15;
    // Collider com o raio real da fundação, incluindo o corpo inteiro da ilha.
    colliders.push({x:root.position.x,z:root.position.z,radius:islandRadius,kind:'building'});
    const island=new THREE.Mesh(new THREE.ConeGeometry(islandRadius,baseHeight,5),stone);
    island.position.y=baseHeight*.32-4;root.add(island);
    for(let j=0;j<2+Math.floor(rnd()*3);j++){
      const tall=10+rnd()*36;
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(1+rnd()*2,3+rnd()*3,tall,5),j%2?rust:dark);
      tower.position.set((rnd()-.5)*23,tall*.5-2,(rnd()-.5)*12);tower.rotation.z=(rnd()-.5)*.22;root.add(tower);
      const towerWorld=new THREE.Vector3(tower.position.x,0,tower.position.z).applyAxisAngle(new THREE.Vector3(0,1,0),angle).add(root.position);
      colliders.push({x:towerWorld.x,z:towerWorld.z,radius:6,kind:'building'});
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
  // Skyline industrial persistente, ancorado no mundo, com alturas variadas.
  // Modelos simples e materiais compartilhados preservam o desempenho mobile.
  const distantRuins=new THREE.Group();group.add(distantRuins);
  const skylineRadius=535;
  for(let i=0;i<90;i++){
    const angle=2*Math.PI*i/90+(rnd()-.5)*.045;
    const radial=skylineRadius+(rnd()-.5)*65;
    const px=Math.sin(angle)*radial,pz=Math.cos(angle)*radial;
    const height=20+rnd()*95,side=4+rnd()*11;
    const building=new THREE.Mesh(new THREE.BoxGeometry(side,height,side),i%5===0?rust:i%3===0?stone:dark);
    building.position.set(px,height*.46-7,pz);building.rotation.y=rnd()*Math.PI;
    distantRuins.add(building);
    if(i%4===0){
      const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.32,.6,10+rnd()*15,5),rust);
      antenna.position.set(px,height+4,pz);distantRuins.add(antenna);
    }
    if(i%8===0){
      const smokeStack=new THREE.Mesh(new THREE.CylinderGeometry(2,2.4,28,7),dark);
      smokeStack.position.set(px+side,height+7,pz);
      distantRuins.add(smokeStack);
      const plume=new THREE.Mesh(new THREE.SphereGeometry(8,7,5),smokeMat);
      plume.position.set(px+side,height+30,pz);plume.scale.set(1.5,2.3,1.1);
      distantRuins.add(plume);smoke.push({mesh:plume,baseY:plume.position.y,seed:rnd()*6});
    }
  }
  // Tonalidade quente do horizonte ao longo de toda a volta da cena.
  const horizonMat=new THREE.ShaderMaterial({
   side:THREE.BackSide,depthWrite:false,fog:false,
   uniforms:{uSun:{value:new THREE.Vector3(165,92,-330).normalize()}},
   vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`uniform vec3 uSun;varying vec3 vDir;void main(){vec3 d=normalize(vDir);float t=clamp(d.y*.5+.48,0.,1.);vec3 horizon=vec3(.74,.64,.56);vec3 upper=vec3(.28,.52,.75);vec3 lower=vec3(.39,.56,.66);vec3 col=mix(lower,mix(horizon,upper,smoothstep(.05,.67,t)),smoothstep(-.15,.22,d.y));float sun=pow(max(dot(d,normalize(uSun)),0.),450.);float bloom=pow(max(dot(d,normalize(uSun)),0.),13.);col+=vec3(1.,.6,.23)*(sun*.8+bloom*.19);gl_FragColor=vec4(col,1.);}`
  });
  const skyDome=new THREE.Mesh(new THREE.SphereGeometry(1050,48,24),horizonMat);
  skyDome.renderOrder=-1000;group.add(skyDome);
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
    skyDome.position.set(x,0,z);
    for(const item of debris){item.mesh.position.y=(waterHeight?waterHeight(item.x,item.z,time):0)+.6+Math.sin(time*1.1+item.phase)*.35;item.mesh.rotation.z=Math.sin(time*.7+item.phase)*.08;}
    for(const {mesh,baseY,seed} of smoke){mesh.position.y=baseY+Math.sin(time*.3+seed)*1.2}
    for(let i=0;i<clouds.length;i++)clouds[i].rotation.y=time*.009;
  }};
}
