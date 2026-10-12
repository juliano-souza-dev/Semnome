import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import {createWastelandHorizon} from './environment.js';
import {planEnemy,canEnemyFire,TACTICS} from './enemy-ai.js';
import {integrateHull,ballisticPoint} from './naval-physics.js';
import {createWarMachine3D} from './war-machine-3d.js';
document.getElementById('landscapeFullscreen').addEventListener('click',async()=>{try{await document.documentElement.requestFullscreen?.();await screen.orientation?.lock?.('landscape')}catch(e){console.info('Rotação automática indisponível; gire o dispositivo manualmente.')}});
const scene=new THREE.Scene();scene.background=new THREE.Color('#8acdd9');scene.fog=new THREE.FogExp2('#659ead',.0011);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,1400);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xd9faff,0x0e607b,2.2));
const sun=new THREE.DirectionalLight(0xfff1cf,2.5);sun.position.set(-50,100,40);scene.add(sun);
// Mesmo campo de ondas no shader e no CPU: soma de ondas direcionais.
const waves=[
{dx:1,dz:.25,a:2.8,k:.055,s:1.1},
{dx:-.3,dz:1,a:1.7,k:.092,s:1.6},
{dx:.75,dz:-.65,a:1.15,k:.17,s:2.0},
{dx:-.65,dz:-.75,a:.65,k:.29,s:2.8}
].map(w=>({...w,len:Math.hypot(w.dx,w.dz)}));
function height(x,z,t){let y=0;for(const w of waves)y+=w.a*Math.sin((x*w.dx+z*w.dz)/w.len*w.k-t*w.s);return y}
function normal(x,z,t){const h=.8;return new THREE.Vector3(height(x-h,z,t)-height(x+h,z,t),2*h,height(x,z-h,t)-height(x,z+h,t)).normalize()}
const uniforms={uTime:{value:0},uOffset:{value:new THREE.Vector2(0,0)}};
const water=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100,240,240),new THREE.ShaderMaterial({
uniforms,side:THREE.DoubleSide,
vertexShader:`uniform float uTime;uniform vec2 uOffset;varying vec3 vPos;varying float vHeight;
float sea(vec2 p){return 2.8*sin(dot(p,normalize(vec2(1.,.25)))*.055-uTime*1.1)+1.7*sin(dot(p,normalize(vec2(-.3,1.)))*.092-uTime*1.6)+1.15*sin(dot(p,normalize(vec2(.75,-.65)))*.17-uTime*2.)+.65*sin(dot(p,normalize(vec2(-.65,-.75)))*.29-uTime*2.8);}
void main(){vec3 p=position;vec2 worldXZ=vec2(p.x,-p.y)+uOffset;p.z=sea(worldXZ);vHeight=p.z;vPos=vec3(worldXZ,p.z);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
fragmentShader:`varying vec3 vPos;varying float vHeight;
void main(){float foam=smoothstep(3.2,5.6,vHeight);float ribbons=pow(max(0.,sin(vPos.x*.29+vPos.y*.17+vHeight*1.4)),12.)*.17;
vec3 deep=vec3(.013,.22,.34),bright=vec3(.03,.54,.66);float m=clamp((vHeight+5.)/10.,0.,1.);vec3 c=mix(deep,bright,m);
c=mix(c,vec3(.63,.96,.95),foam*.82+ribbons);gl_FragColor=vec4(c,1.);}`
}));
water.rotation.x=-Math.PI/2;scene.add(water);
const horizon=createWastelandHorizon(THREE,scene);
// Máquina provisória em geometria simples; sprites 16 direções entram após validação.
const ship=createWarMachine3D(THREE);scene.add(ship);
const shadow=new THREE.Mesh(new THREE.CircleGeometry(5.8,32),new THREE.MeshBasicMaterial({color:0x062836,transparent:true,opacity:.22,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.12;scene.add(shadow);
// NPC 01: patrulheiro de teste, geometria temporária até chegada dos sprites.
const npc=new THREE.Group();scene.add(npc);npc.scale.setScalar(1.9);
const npcHull=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.8,1.05,28),new THREE.MeshStandardMaterial({color:0xb94348,metalness:.35,roughness:.48}));npcHull.position.y=.25;npc.add(npcHull);
const npcDeck=new THREE.Mesh(new THREE.CylinderGeometry(1.95,2.15,.45,28),new THREE.MeshStandardMaterial({color:0x465c67,metalness:.3,roughness:.5}));npcDeck.position.y=.92;npc.add(npcDeck);
const npcCockpit=new THREE.Mesh(new THREE.SphereGeometry(.95,16,10),new THREE.MeshStandardMaterial({color:0x162c3d,metalness:.35,roughness:.3}));npcCockpit.scale.set(1,.5,.85);npcCockpit.position.y=1.45;npc.add(npcCockpit);
const npcCannon=new THREE.Mesh(new THREE.CylinderGeometry(.43,.58,3.7,14),new THREE.MeshStandardMaterial({color:0x293942,metalness:.6,roughness:.35}));npcCannon.rotation.x=Math.PI/2;npcCannon.position.set(0,1.2,-2.25);npc.add(npcCannon);
const npcData={x:14,z:-75,y:0,heading:0,speed:6,anchorX:14,anchorZ:-75};
const npcShadow=new THREE.Mesh(new THREE.CircleGeometry(5.1,32),new THREE.MeshBasicMaterial({color:0x062836,transparent:true,opacity:.2,depthWrite:false}));npcShadow.rotation.x=-Math.PI/2;scene.add(npcShadow);
// O player agora é um modelo Three.js real, independente de atlas 2D.
const FRAME_MAP=Array.from({length:16},(_,i)=>({c:i%4,r:Math.floor(i/4)}));
const FRAME_STEP=Math.PI/8;
const playerAtlasReady=false;
const playerSprite={visible:false};
// Protótipo de combate: configurações isoladas para calibração.
const COMBAT={range:190,projectileSpeed:165,damage:25,cooldown:3,npcMaxHp:100};
npcData.hp=COMBAT.npcMaxHp;
// Frota de teste: usa exatamente a mesma sprite sheet 4x4 do jogador.
const enemies=[npcData];
npcData.id=1;npcData.name='Patrulheiro 01';npcData.phase=0;npcData.radius=15;npcData.sprite=null;npcData.nextShot=3;npcData.state='patrol';npcData.hostile=true;
for(let i=1;i<9;i++){
 const angle=i*Math.PI*2/8;
 const radius=215+(i%4)*95;
 enemies.push({id:i+1,name:'Patrulheiro '+String(i+1).padStart(2,'0'),
  x:Math.sin(angle)*radius,z:-110+Math.cos(angle)*radius,y:0,
  anchorX:Math.sin(angle)*radius,anchorZ:-110+Math.cos(angle)*radius,
  heading:angle,speed:4+(i%4)*1.4,hp:COMBAT.npcMaxHp,phase:i*.87,radius:16+i%3*6,sprite:null,nextShot:2+i*.45,state:'patrol',hostile:true});
}

// Ataque NPC: detecção, aproximação, cadência individual, projéteis e dano real.
// Cada NPC compartilha a mesma geometria base, mas é uma instância independente.
for(const enemy of enemies){
 enemy.model=createWarMachine3D(THREE,{enemy:true});
 scene.add(enemy.model);
}
npc.visible=false;
npcShadow.visible=false;
const ENEMY_AI={detect:TACTICS.detect,fireRange:215,retreatRange:31,shotSpeed:205,shotDamage:7,shotCooldown:1.65,maxHp:100};
const playerCombat={hp:ENEMY_AI.maxHp,invulnerableUntil:0,respawnAt:0};
const enemyShots=[];
// NPCs compartilham geometria, shader e rastro dos tiros do jogador.
const hpHud=document.createElement('div');
hpHud.style.cssText='position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:35;background:rgba(7,20,32,.82);border:1px solid #7fb4c3;border-radius:10px;padding:6px 14px;color:white;font:700 13px system-ui;pointer-events:none;white-space:nowrap';
document.body.appendChild(hpHud);
const fireButton=document.getElementById('fire'),lockLabel=document.getElementById('lock');
const AMMO_TYPES=[
 {id:'plasma',name:'Plasma',icon:'⚡',description:'Arco energético',color:0x25cfff},
 {id:'meteor',name:'Meteoro',icon:'☄️',description:'Subida alta e queda vertical',color:0xff8b35},
 {id:'scatter',name:'Chuva de energia',icon:'✨',description:'Três impactos em sequência',color:0xbc80ff},
 {id:'iron',name:'Teste de Ferro',icon:'🔩',description:'Projétil 3× mais rápido · dano 40',color:0xffd28b},
 {id:'siege',name:'Tempestade Orbital',icon:'🪐',description:'Mira manual · alcance 360 · explosão em área',color:0xe5a4ff}
];
let selectedAmmo=AMMO_TYPES[0];
// Apenas armas de efeito especial usam a câmera tática superior.
const TACTICAL_AMMO=new Set(['meteor','scatter','siege']);
const ammoButton=document.getElementById('ammo'),ammoMenu=document.getElementById('ammoMenu');
function renderAmmoMenu(){
 ammoMenu.replaceChildren();
 for(const ammo of AMMO_TYPES){
  const button=document.createElement('button');button.type='button';
  button.className=ammo.id===selectedAmmo.id?'chosen':'';
  button.textContent=ammo.icon+' '+ammo.name+' · '+ammo.description;
  button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();selectedAmmo=ammo;if(typeof cancelAreaAim==='function')cancelAreaAim();ammoButton.textContent=ammo.icon;ammoMenu.classList.remove('open');ammoButton.setAttribute('aria-expanded','false');renderAmmoMenu()});
  ammoMenu.append(button);
 }
}
ammoButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const isOpen=ammoMenu.classList.toggle('open');ammoButton.setAttribute('aria-expanded',String(isOpen));if(isOpen)renderAmmoMenu()});
renderAmmoMenu();
// Projétil de energia WebGL: núcleo emissivo ciano, halo aditivo e rastro azul.
const energyCoreGeometry=new THREE.SphereGeometry(.8,16,12);
const energyCoreMaterial=new THREE.MeshBasicMaterial({color:0x9efcff,toneMapped:false});
const energyGlowMaterial=new THREE.ShaderMaterial({
 uniforms:{uTime:{value:0},uOpacity:{value:1},uColor:{value:new THREE.Color(0x16a9ff)}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform float uTime;uniform float uOpacity;uniform vec3 uColor;varying vec2 vUv;
 void main(){float r=length(vUv-.5)*2.;float core=pow(max(0.,1.-r),3.);float glow=exp(-r*r*4.5);
 float pulse=.88+.12*sin(uTime*19.);
 gl_FragColor=vec4(mix(uColor,vec3(.72,1.,1.),core),glow*pulse*uOpacity*.76);}`,
 transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide
});
const energyGlowGeometry=new THREE.PlaneGeometry(5.6,5.6);
const energyTrailMaterial=new THREE.LineBasicMaterial({color:0x33cfff,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false});
const plasmaMaterial=new THREE.ShaderMaterial({
 uniforms:{uTime:{value:0}},
 vertexShader:`varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform float uTime;varying vec3 vPos;
 void main(){float veins=sin(vPos.x*15.+sin(vPos.y*12.+uTime*17.)*2.)*sin(vPos.z*13.-uTime*22.);
 float arc=smoothstep(.36,.95,veins);vec3 color=mix(vec3(.02,.33,.95),vec3(.75,1.,1.),arc);
 gl_FragColor=vec4(color,.52+arc*.36);}`,
 transparent:true,depthWrite:false,blending:THREE.AdditiveBlending
});
const shockwaveGeometry=new THREE.RingGeometry(.65,1.15,32);
const shockwaveMaterial=new THREE.MeshBasicMaterial({color:0x43e7ff,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
const sparkGeometry=new THREE.BufferGeometry();const sparkCount=36;
sparkGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(sparkCount*3),3));
const impactEffects=[];
function energyFlash(position){
 const material=energyGlowMaterial.clone();
 material.uniforms.uTime={value:0};material.uniforms.uOpacity={value:1};
 material.uniforms.uColor={value:new THREE.Color(0x7defff)};
 const flash=new THREE.Mesh(energyGlowGeometry,material);
 flash.position.copy(position);flash.scale.setScalar(2);scene.add(flash);
 const ring=new THREE.Mesh(shockwaveGeometry,shockwaveMaterial.clone());ring.position.copy(position);scene.add(ring);
 const positions=new Float32Array(sparkCount*3),velocities=[];
 for(let i=0;i<sparkCount;i++){
   const angle=Math.random()*Math.PI*2,u=Math.random()*2-1,r=Math.sqrt(1-u*u);
   velocities.push(new THREE.Vector3(Math.cos(angle)*r,u*.8,Math.sin(angle)*r).multiplyScalar(8+Math.random()*21));
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const sparks=new THREE.Points(geometry,new THREE.PointsMaterial({color:0x9efaff,size:.7,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}));
 sparks.position.copy(position);scene.add(sparks);
 impactEffects.push({flash,ring,sparks,velocities,age:0});
}
const projectiles=[];let lockedNpc=null,lastShotTime=-100;
const AREA_RANGE=360,AREA_RADIUS=22;
const aimHint=document.getElementById('aimHint'),cancelAimButton=document.getElementById('cancelAim');
const areaAim={active:false,point:new THREE.Vector3(),valid:false,pointerId:null,holdStarted:0,viewBlend:0,startX:0,startY:0,origin:new THREE.Vector3(),right:new THREE.Vector3(),forward:new THREE.Vector3()};
const aimReticle=new THREE.Group();scene.add(aimReticle);aimReticle.visible=false;
const aimDisc=new THREE.Mesh(new THREE.CircleGeometry(AREA_RADIUS,64),new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide}));
aimDisc.rotation.x=-Math.PI/2;aimReticle.add(aimDisc);
for(const rad of [AREA_RADIUS,AREA_RADIUS*.7]){
 const ring=new THREE.Mesh(new THREE.RingGeometry(rad-.8,rad+.8,64),new THREE.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:1,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.14;ring.renderOrder=20;aimReticle.add(ring);
}
// Cruz central elevada e contrastante, visível também com a câmera tática acima.
const aimCrossMaterial=new THREE.LineBasicMaterial({color:0xffff00,depthTest:false,transparent:true,opacity:1});
for(const [ax,az,bx,bz] of [[-8,0,-2,0],[2,0,8,0],[0,-8,0,-2],[0,2,0,8]]){
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax,.27,az),new THREE.Vector3(bx,.27,bz)]),aimCrossMaterial);
 line.renderOrder=22;aimReticle.add(line);
}
const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2(),seaPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function cancelAreaAim(){areaAim.active=false;areaAim.valid=false;areaAim.pointerId=null;aimReticle.visible=false;aimHint.classList.remove('active');cancelAimButton.classList.remove('active');fireButton.textContent='DISPARAR'}
function placeAim(e){
 pointerNdc.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);
 raycaster.setFromCamera(pointerNdc,camera);
 const p=new THREE.Vector3();
 if(!raycaster.ray.intersectPlane(seaPlane,p))return;
 const dx=p.x-x,dz=p.z-z,len=Math.hypot(dx,dz);
 const d=Math.min(len,AREA_RANGE);
 if(len>.001){p.x=x+dx/len*d;p.z=z+dz/len*d}
 p.y=height(p.x,p.z,clock.elapsedTime)+.35;
 areaAim.point.copy(p);areaAim.valid=true;aimReticle.position.copy(p);aimReticle.visible=true;
}
cancelAimButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();cancelAreaAim()});
renderer.domElement.addEventListener('pointerdown',e=>{if(!areaAim.active)return;e.preventDefault();e.stopImmediatePropagation();placeAim(e)},true);
renderer.domElement.addEventListener('pointermove',e=>{if(!areaAim.active || e.buttons===0 && e.pointerType==='mouse')return;e.preventDefault();e.stopImmediatePropagation();placeAim(e)},true);
const areaBursts=[];
const attackCamera={phase:'idle',shot:null,target:null,launchOrigin:null,launchYaw:0,impactAt:0,blend:0,shake:0};
const shotView=new THREE.Vector3(),shotLook=new THREE.Vector3(),normalView=new THREE.Vector3(),normalLook=new THREE.Vector3();
const smoothstep01=v=>{v=THREE.MathUtils.clamp(v,0,1);return v*v*(3-2*v)};
// O casco só gira por navegação ou arrasto; o tiro em arco mira sem girar a nave.

const damageLabels=[];
function showDamage(enemy,amount){
 const label=document.createElement('div');
 label.textContent='-'+amount;
 label.style.cssText='position:fixed;z-index:48;color:#ff4545;font:900 25px system-ui;text-shadow:0 2px 2px #300,0 0 8px #ff0000;pointer-events:none;transform:translate(-50%,-50%)';
 document.body.appendChild(label);
 damageLabels.push({label,enemy,age:0});
 if(enemy.sprite){
  enemy.sprite.material.color.setHex(0xff3939);
  enemy.hitUntil=clock.elapsedTime+.35;
 }
}
const targetRing=new THREE.Mesh(new THREE.RingGeometry(6.4,6.9,48),new THREE.MeshBasicMaterial({color:0xff5555,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));
targetRing.rotation.x=-Math.PI/2;targetRing.visible=false;scene.add(targetRing);
function weaponRange(){return selectedAmmo.id==='siege'?AREA_RANGE:COMBAT.range;}
function moveButtonAim(e){
 if(!areaAim.active||e.pointerId!==areaAim.pointerId)return;
 // Deslocamento relativo ao botão: o dedo nunca precisa sair para tocar o mar.
 const dx=e.clientX-areaAim.startX,dy=e.clientY-areaAim.startY;
 const sensitivity=.85; // Ajuste fino mais responsivo, sem perder o alvo inicial
 const px=areaAim.origin.x+areaAim.right.x*dx*sensitivity-areaAim.forward.x*dy*sensitivity;
 const pz=areaAim.origin.z+areaAim.right.z*dx*sensitivity-areaAim.forward.z*dy*sensitivity;
 const ox=px-x,oz=pz-z,dist=Math.hypot(ox,oz),max=weaponRange();
 const ratio=dist>max?max/dist:1;
 areaAim.point.set(x+ox*ratio,height(x+ox*ratio,z+oz*ratio,clock.elapsedTime)+.35,z+oz*ratio);
 areaAim.valid=true;aimReticle.position.copy(areaAim.point);aimReticle.visible=true;
 // Feedback da mira: vermelho quando o ponto cobre um inimigo.
 const hovering=enemies.some(enemy=>enemy.hp>0&&Math.hypot(enemy.x-areaAim.point.x,enemy.z-areaAim.point.z)<12);
 aimDisc.material.color.setHex(hovering?0xff3636:0x00f0ff);
 for(const mark of aimReticle.children){if(mark.material?.color&&mark!==aimDisc)mark.material.color.setHex(hovering?0xff3131:mark.type==='Line'?0xffff00:0x00ffff)}
}
function startAreaAim(e){
 if(areaAim.active||clock.elapsedTime-lastShotTime<COMBAT.cooldown)return;
 areaAim.active=true;areaAim.pointerId=e.pointerId;areaAim.valid=true;
 areaAim.startX=e.clientX;areaAim.startY=e.clientY;areaAim.holdStarted=clock.elapsedTime;
 // Especial: visão aérea desde o primeiro toque, sem temporizador.
 areaAim.viewBlend=TACTICAL_AMMO.has(selectedAmmo.id)?1:0;
 aimHint.classList.add('active');cancelAimButton.classList.add('active');
 const f=new THREE.Vector3(-Math.sin(heading),0,-Math.cos(heading));
 areaAim.forward.copy(f);areaAim.right.set(-f.z,0,f.x);
 const distance=selectedAmmo.id==='siege'?90:Math.min(60,COMBAT.range*.65);
 // Mira aparece imediatamente em frente à nave; o arrasto controla o ponto de impacto.
 areaAim.origin.set(x+f.x*distance,0,z+f.z*distance);
 if(lockedNpc&&Math.hypot(x-lockedNpc.x,z-lockedNpc.z)<=weaponRange()){
  areaAim.origin.set(lockedNpc.x,0,lockedNpc.z);
 }
 areaAim.point.copy(areaAim.origin);areaAim.point.y=height(areaAim.point.x,areaAim.point.z,clock.elapsedTime)+.35;
 aimReticle.position.copy(areaAim.point);aimReticle.visible=true;
 fireButton.textContent='SOLTE PARA DISPARAR';
 fireButton.setPointerCapture(e.pointerId);
}
function finishAreaAim(e,cancel=false){
 if(!areaAim.active||e.pointerId!==areaAim.pointerId)return;
 let destination=!cancel&&areaAim.valid?areaAim.point.clone():null;
 // Assistência leve: aproxima o impacto do casco se a mira já estiver perto.
 // Fora dessa tolerância, respeita exatamente a escolha manual.
 if(destination){
  let best=null,bestDist=12;
  for(const enemy of enemies){
   const dist=Math.hypot(enemy.x-destination.x,enemy.z-destination.z);
   if(enemy.hp>0&&dist<bestDist){best=enemy;bestDist=dist}
  }
  if(best)destination.set(best.x,best.y+.3,best.z);
 }
 cancelAreaAim();
 if(destination)launchShot(destination);
}
function launchShot(manualPoint=null){
 lastShotTime=clock.elapsedTime;
 // Disparo balístico 3D: sobe da proa e mergulha no ponto do alvo.
 const origin=new THREE.Vector3(x-Math.sin(heading)*6,bob+3.4,z-Math.cos(heading)*6);
 const destination=manualPoint?manualPoint.clone():new THREE.Vector3(lockedNpc.x,lockedNpc.y+2.5,lockedNpc.z);
 const ammo=selectedAmmo;
 // Disparos comuns 60% mais rápidos; Teste de Ferro conserva o seu ajuste de 3x.
 const travel=ammo.id==='siege'?3.1:ammo.id==='iron'?Math.max(.045,origin.distanceTo(destination)/COMBAT.projectileSpeed*1.8/3):Math.max(.32,origin.distanceTo(destination)/COMBAT.projectileSpeed*1.8/1.6)*(ammo.id==='meteor'?1.2:1);
 const arcHeight=ammo.id==='siege'?THREE.MathUtils.clamp(origin.distanceTo(destination)*.85,65,145):THREE.MathUtils.clamp(origin.distanceTo(destination)*(ammo.id==='meteor'?.92:.44),ammo.id==='meteor'?26:13,ammo.id==='meteor'?70:38);
 const mesh=new THREE.Group();
 const core=new THREE.Mesh(energyCoreGeometry,energyCoreMaterial);
 const plasma=new THREE.Mesh(new THREE.IcosahedronGeometry(1.2,2),plasmaMaterial);
 const glow=new THREE.Mesh(energyGlowGeometry,energyGlowMaterial);
 const outerGlow=new THREE.Mesh(energyGlowGeometry,energyGlowMaterial);
 outerGlow.scale.setScalar(1.9);
 mesh.add(core,plasma,glow,outerGlow);mesh.position.copy(origin);scene.add(mesh);
 energyFlash(origin);
 const trailPoints=Array.from({length:12},()=>origin.clone());
 const trailGeometry=new THREE.BufferGeometry().setFromPoints(trailPoints);
 const trail=new THREE.Line(trailGeometry,energyTrailMaterial);scene.add(trail);
 const shot={mesh,glow,outerGlow,plasma,trail,trailPoints,origin,destination,travel,arcHeight,age:0,distance:0,ammo:ammo.id,damage:ammo.id==='iron'?40:COMBAT.damage};
 if(ammo.id==='iron'){core.material=energyCoreMaterial.clone();core.material.color.setHex(ammo.color);}
 if(ammo.id==='meteor'){core.material=energyCoreMaterial.clone();core.material.color.setHex(ammo.color);plasma.material=plasmaMaterial.clone();}
 if(ammo.id==='siege'){core.material=energyCoreMaterial.clone();core.material.color.setHex(0xeebaff);mesh.scale.setScalar(1.65);}
 if(ammo.id==='scatter'){core.material=energyCoreMaterial.clone();core.material.color.setHex(ammo.color);}
 
 projectiles.push(shot);
 if(ammo.id==='scatter'){
  // Impactos secundários independentes, descendentes, em posições próximas ao alvo.
  for(let i=0;i<2;i++){
   const offset=(i===0?-1:1)*5;
   const goal=destination.clone().add(new THREE.Vector3(offset,0,i===0?4:-4));
   const start=origin.clone().add(new THREE.Vector3(offset*.25,0,0));
   const small=new THREE.Group();
   small.add(new THREE.Mesh(energyCoreGeometry,new THREE.MeshBasicMaterial({color:0xcba1ff})));
   const halo=new THREE.Mesh(energyGlowGeometry,energyGlowMaterial);small.add(halo);
   small.position.copy(start);scene.add(small);
   const points=Array.from({length:12},()=>start.clone()),geom=new THREE.BufferGeometry().setFromPoints(points);
   const trail2=new THREE.Line(geom,energyTrailMaterial);scene.add(trail2);
   projectiles.push({mesh:small,glow:halo,outerGlow:halo,plasma:null,trail:trail2,trailPoints:points,origin:start,destination:goal,travel:travel*(1.18+i*.17),arcHeight:arcHeight*(1.15+i*.12),age:-.10*(i+1),ammo:'scatter',secondary:true,damage:Math.round(COMBAT.damage*.6)});
  }
 }
 // Cada novo tiro atualiza a cena de ataque sem interromper a navegação.
 attackCamera.phase='flight';attackCamera.shot=shot;attackCamera.target=destination.clone();
 attackCamera.launchOrigin=origin.clone();attackCamera.launchYaw=heading;
 attackCamera.impactAt=0;attackCamera.shake=0;
}
// O disparo usa um ponteiro independente; pode ocorrer enquanto os outros dedos navegam e giram a câmera.
fireButton.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;
 e.preventDefault();e.stopPropagation();
 startAreaAim(e);
});
fireButton.addEventListener('pointermove',e=>{if(areaAim.active&&e.pointerId===areaAim.pointerId){e.preventDefault();moveButtonAim(e)}});
fireButton.addEventListener('pointerup',e=>{if(e.pointerId===areaAim.pointerId){e.preventDefault();finishAreaAim(e)}});
fireButton.addEventListener('pointercancel',e=>finishAreaAim(e,true));
fireButton.addEventListener('lostpointercapture',e=>finishAreaAim(e,true));
const input={x:0,y:0,magnitude:0,active:false};
let speed=0,heading=0,x=0,z=0,bob=0;
const hullPhysics={x:0,z:0,vx:0,vz:0};
// Propulsor: força velocidade máxima por exatamente 2 segundos de simulação.
const boostButton=document.getElementById('boost');
let boostUntil=0,boostHeading=0;
const BOOST_DASH_SPEED=144; // Arrancada: 100% acima dos 72 de velocidade de cruzeiro.
boostButton.addEventListener('pointerdown',event=>{
 event.preventDefault();event.stopPropagation();
 if(playerCombat.hp<=0)return;
 boostUntil=clock.elapsedTime+2;
 boostHeading=heading; // Impulso na direção da proa, mesmo com analógico neutro.
 speed=BOOST_DASH_SPEED;
 boostButton.classList.add('active');
});
const pad=document.getElementById('pad'),stick=document.getElementById('stick');
let padPointer=null;let stickReferenceYaw=0;
function movePad(e){
  const r=pad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const dx=e.clientX-cx,dy=e.clientY-cy,radius=42;
  const d=Math.hypot(dx,dy),scale=d>0?Math.min(1,d/radius)/d:0;
  input.x=dx*scale;input.y=dy*scale;input.magnitude=Math.min(1,d/radius);
  stick.style.transform=`translate(${input.x*radius}px,${input.y*radius}px)`;
}
pad.addEventListener('pointerdown',e=>{
  if(padPointer!==null)return;
  e.preventDefault();e.stopPropagation();
  stickReferenceYaw=heading;padPointer=e.pointerId;input.active=true;pad.setPointerCapture(e.pointerId);movePad(e);
});
pad.addEventListener('pointermove',e=>{if(e.pointerId===padPointer){e.preventDefault();movePad(e)}});
function releasePad(e){
  if(e.pointerId!==padPointer)return;
  padPointer=null;input.active=false;input.x=0;input.y=0;input.magnitude=0;
  stick.style.transform='translate(0,0)';
}
pad.addEventListener('pointerup',releasePad);pad.addEventListener('pointercancel',releasePad);
pad.addEventListener('lostpointercapture',releasePad);
const keys=new Set();addEventListener('keydown',e=>{if(['ArrowUp','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code)});
addEventListener('keyup',e=>keys.delete(e.code));
// Arrasto horizontal sobre o oceano orbita a câmera; não altera o rumo da máquina.
// Teste: câmera fixa atrás da nave; nenhum arrasto altera a orientação.
// Arrastar o oceano muda o rumo do casco e da câmera juntos.
let dragId=null,lastDragX=0,dragTurn=0;
renderer.domElement.style.touchAction='none';
renderer.domElement.addEventListener('pointerdown',e=>{
 if(dragId!==null || (e.pointerType==='mouse'&&e.button!==0))return;
 e.preventDefault();dragId=e.pointerId;lastDragX=e.clientX;
 renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
 if(e.pointerId!==dragId)return;
 e.preventDefault();
 const dx=e.clientX-lastDragX;lastDragX=e.clientX;
 dragTurn+=dx*.008;
});
function releaseDrag(e){if(e.pointerId===dragId)dragId=null}
renderer.domElement.addEventListener('pointerup',releaseDrag);
renderer.domElement.addEventListener('pointercancel',releaseDrag);
renderer.domElement.addEventListener('lostpointercapture',releaseDrag);
const clock=new THREE.Clock(),camTarget=new THREE.Vector3(),wanted=new THREE.Vector3(),follow=new THREE.Vector3(),aimView=new THREE.Vector3(),aimLook=new THREE.Vector3();let cameraReady=false;
function tick(){
requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.04),t=clock.elapsedTime;uniforms.uTime.value=t;
const keyboardGo=keys.has('KeyW')||keys.has('ArrowUp')||keys.has('Space');
const keyboardReverse=keys.has('KeyS')||keys.has('ArrowDown');
const stickAmount=input.active&&input.magnitude>.13?(input.magnitude-.13)/.87:0;
// Joystick para baixo dá ré, sem girar a proa 180 graus.
const reversing=!keyboardGo&&(keyboardReverse||(stickAmount>0&&input.y>.35));
const go=keyboardGo||keyboardReverse||stickAmount>0;
const turn=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
let target=reversing?-24*(keyboardReverse?1:stickAmount):72*(keyboardGo?1:stickAmount); // ré limitada a 1/3 da velocidade à frente
const dirx=-Math.sin(heading),dirz=-Math.cos(heading);
const slope=(height(x+dirx*1.6,z+dirz*1.6,t)-height(x-dirx*1.6,z-dirz*1.6,t))/3.2;
target=go?(reversing?target:Math.max(0,target-Math.max(0,slope)*12+Math.max(0,-slope)*3)):0;
// Velocidade agora é resolvida após o giro pela integração física do casco.
const boostRemaining=Math.max(0,boostUntil-t);
if(boostRemaining>0){
 speed=BOOST_DASH_SPEED;
 heading=boostHeading;
}
boostButton.classList.toggle('active',boostRemaining>0);
boostButton.textContent=boostRemaining>0?'🚀 '+boostRemaining.toFixed(1)+'s':'🚀 PROPULSOR';
// O arrasto gira a nave, preservando a traseira voltada para a câmera.
if(dragTurn!==0){
 heading+=dragTurn;
 if(input.active)stickReferenceYaw+=dragTurn;
 dragTurn=0;
}
if(boostRemaining<=0&&Math.abs(speed)>.35){
  if(reversing){
    // Pequenas correções laterais durante a ré, mantendo a orientação.
    heading+=(-input.x*1.65+turn*1.2)*dt;
  }else if(stickAmount>0){
    // Ângulo absoluto desejado no plano: analógico pode apontar para qualquer 360°.
    // Giro pelo caminho mais curto, sem rotação contínua por manter o dedo na lateral.
    const desired=stickReferenceYaw-Math.atan2(input.x,-input.y);
    const delta=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
    const maxStep=4.2*Math.min(1,Math.abs(speed)/9)*dt;
    heading+=THREE.MathUtils.clamp(delta,-maxStep,maxStep);
  }else{
    heading+=turn*2.35*Math.min(1,Math.abs(speed)/7)*dt;
  }
}
hullPhysics.x=x;hullPhysics.z=z;
const movement=integrateHull(hullPhysics,{heading,targetSpeed:target,boostSpeed:boostRemaining>0?BOOST_DASH_SPEED:0,dt});
x=movement.x;z=movement.z;speed=movement.speed;
const bow=new THREE.Vector2(-Math.sin(heading),-Math.cos(heading)),side=new THREE.Vector2(Math.cos(heading),-Math.sin(heading));
const front=height(x+bow.x*1.5,z+bow.y*1.5,t),back=height(x-bow.x*1.5,z-bow.y*1.5,t);
const left=height(x-side.x*1.5,z-side.y*1.5,t),right=height(x+side.x*1.5,z+side.y*1.5,t);
const y=height(x,z,t);bob=THREE.MathUtils.damp(bob,y,5,dt);
ship.position.set(x,bob+1.45,z);ship.rotation.order='YXZ';ship.rotation.y=heading;
ship.rotation.x=THREE.MathUtils.damp(ship.rotation.x,THREE.MathUtils.clamp(Math.atan2(back-front,3),-.24,.24),4,dt);
ship.rotation.z=THREE.MathUtils.damp(ship.rotation.z,THREE.MathUtils.clamp(Math.atan2(left-right,3),-.23,.23),4,dt);
shadow.position.set(x,height(x,z,t)+.14,z);
// Jatos de motor simulados por GPU, sincronizados com a propulsão.
for(const rotor of ship.userData.rotors||[])rotor.rotation.z=t*(3+Math.abs(speed)*.24);
for(const jet of ship.userData.engineFlames||[]){
 jet.material.uniforms.uTime.value=t;
 jet.material.uniforms.uPower.value=Math.max(.18,Math.min(1,Math.abs(speed)/72))*(boostRemaining>0?1.35:1);
 const length=boostRemaining>0?1.7:.65+Math.abs(speed)/100;
 jet.flame.scale.y=length;jet.flameCross.scale.y=length;
}
// Frota de NPCs: patrulha independente, bob nas ondas e separação física.
let nearest=null,nearestDistance=COMBAT.range;
for(const enemy of enemies){
 const distanceToPlayer=Math.hypot(x-enemy.x,z-enemy.z);
 if(enemy.hp<=0){enemy.state='destroyed';if(enemy.sprite)enemy.sprite.visible=false;if(enemy.model)enemy.model.visible=false;continue;}
 const tactic=planEnemy(enemy,{x,z,heading,speed,alive:playerCombat.hp>0},enemies,t);
 enemy.state=tactic.state;
 const desiredYaw=-Math.atan2(tactic.goalX-enemy.x,-(tactic.goalZ-enemy.z));
 const yawDelta=Math.atan2(Math.sin(desiredYaw-enemy.heading),Math.cos(desiredYaw-enemy.heading));
 enemy.heading+=THREE.MathUtils.clamp(yawDelta,-(tactic.active?3.1:1.1)*dt,(tactic.active?3.1:1.1)*dt);
 enemy.x-=Math.sin(enemy.heading)*tactic.speed*dt;
 enemy.z-=Math.cos(enemy.heading)*tactic.speed*dt;
 if(tactic.active&&distanceToPlayer<=ENEMY_AI.fireRange&&canEnemyFire(enemy,enemies,enemyShots,t,playerCombat.hp)){
  // Mira calculada no lançamento e não vinculada à câmera nem ao movimento posterior.
  const origin=new THREE.Vector3(enemy.x,enemy.y+3.5,enemy.z);
  const flight=Math.max(.48,distanceToPlayer/ENEMY_AI.shotSpeed*1.5);
  // Antecipação moderada e dispersão por papel: pode errar navios em movimento.
  const accuracy=tactic.role===2?.79:tactic.role===1?.67:.6;
  const spread=Math.sin(t*2.7+enemy.id*3.1)*7;
  const predicted=new THREE.Vector3(x-Math.sin(heading)*speed*flight*accuracy+Math.cos(heading)*spread,bob+2.3,z-Math.cos(heading)*speed*flight*accuracy-Math.sin(heading)*spread);
  const mesh=new THREE.Group();
  const core=new THREE.Mesh(energyCoreGeometry,energyCoreMaterial);
  const plasma=new THREE.Mesh(new THREE.IcosahedronGeometry(1.2,2),plasmaMaterial);
  const glow=new THREE.Mesh(energyGlowGeometry,energyGlowMaterial);
  const outerGlow=new THREE.Mesh(energyGlowGeometry,energyGlowMaterial);
  outerGlow.scale.setScalar(1.9);
  mesh.add(core,plasma,glow,outerGlow);mesh.position.copy(origin);scene.add(mesh);
  const trailPoints=Array.from({length:12},()=>origin.clone());
  const trail=new THREE.Line(new THREE.BufferGeometry().setFromPoints(trailPoints),energyTrailMaterial);scene.add(trail);
  const arcHeight=THREE.MathUtils.clamp(origin.distanceTo(predicted)*.44,13,38);
  enemyShots.push({mesh,glow,outerGlow,plasma,trail,trailPoints,origin,destination:predicted,arcHeight,age:0,duration:flight,source:enemy.id});
  enemy.nextShot=t+ENEMY_AI.shotCooldown+(enemy.id%3)*.16+(enemy.hp<22?.5:0);
 }
 // Colisão jogador × inimigo; nenhum dano durante esta fase de testes.
 let dx=x-enemy.x,dz=z-enemy.z,dist=Math.hypot(dx,dz);
 if(dist<10.6){
  const length=Math.max(dist,.001),overlap=10.6-dist;
  x+=dx/length*overlap*.65;z+=dz/length*overlap*.65;
  enemy.x-=dx/length*overlap*.35;enemy.z-=dz/length*overlap*.35;
  speed*=.94;
 }
 if(enemy.model){
  enemy.model.visible=enemy.hp>0;
  enemy.model.position.set(enemy.x,enemy.y,enemy.z);
  enemy.model.rotation.order='YXZ';
  enemy.model.rotation.y=enemy.heading;
  enemy.model.rotation.x=THREE.MathUtils.damp(enemy.model.rotation.x,0,4,dt);
  enemy.model.rotation.z=THREE.MathUtils.damp(enemy.model.rotation.z,0,4,dt);
 }
 const waveY=height(enemy.x,enemy.z,t);
 enemy.y=THREE.MathUtils.damp(enemy.y,waveY,4,dt);
 if(enemy.model){
 enemy.model.position.y=enemy.y;
 for(const rotor of enemy.model.userData.rotors||[])rotor.rotation.z=t*(3+tactic.speed*.24)+enemy.phase;
 for(const jet of enemy.model.userData.engineFlames||[]){
  jet.material.uniforms.uTime.value=t+enemy.phase;
  jet.material.uniforms.uPower.value=Math.max(.24,Math.min(1,tactic.speed/65));
  jet.flame.scale.y=.75+tactic.speed/95;jet.flameCross.scale.y=.75+tactic.speed/95;
 }
}
 if(enemy.sprite){
  enemy.sprite.position.set(enemy.x,enemy.y+4.3,enemy.z);
  enemy.sprite.quaternion.copy(camera.quaternion);
  const viewAngle=Math.atan2(camera.position.x-enemy.x,camera.position.z-enemy.z);
  const visibleAngle=enemy.heading-viewAngle+Math.PI;
  const frame=Math.round((((visibleAngle%(Math.PI*2))+(Math.PI*2))%(Math.PI*2))/FRAME_STEP)%16;
  const {c:column,r:row}=FRAME_MAP[frame];
  enemy.sprite.material.map.offset.set(column*.25,1-(row+1)*.25);
  if(enemy.hitUntil&&t>=enemy.hitUntil){enemy.sprite.material.color.setHex(enemy.id%3===0?0xffa1a1:enemy.id%3===1?0xb1dfff:0xd5b6ff);enemy.hitUntil=0;}
 }else if(enemy===npcData){
  npc.position.set(enemy.x,enemy.y+1.35,enemy.z);npc.rotation.y=enemy.heading;
  npcShadow.position.set(enemy.x,waveY+.13,enemy.z);
 }
 const range=Math.hypot(x-enemy.x,z-enemy.z);
 if(enemy.hp>0&&range<nearestDistance){nearest=enemy;nearestDistance=range}
}
lockedNpc=nearest;
targetRing.visible=!!lockedNpc;
if(lockedNpc)targetRing.position.set(lockedNpc.x,height(lockedNpc.x,lockedNpc.z,t)+.18,lockedNpc.z);
lockLabel.textContent=lockedNpc?'ALVO TRAVADO · '+lockedNpc.name+' · '+lockedNpc.hp+'/'+COMBAT.npcMaxHp+' HP':'Procurando alvo...';
fireButton.disabled=false;
// Antigo protótipo oculto: somente a máquina 3D deve aparecer.
npc.visible=false;
npcShadow.visible=false;
ship.position.x=x;ship.position.z=z;
// Projéteis inimigos independentes da câmera. Só há dano se acertarem a nave.
for(let i=enemyShots.length-1;i>=0;i--){
 const shot=enemyShots[i];shot.age+=dt;
 const progress=Math.min(1,shot.age/shot.duration);
 ballisticPoint(shot.origin,shot.destination,shot.duration,shot.age,shot.arcHeight,shot.mesh.position);
 shot.glow.quaternion.copy(camera.quaternion);shot.outerGlow.quaternion.copy(camera.quaternion);
 shot.plasma.rotation.set(t*6,t*9,t*5);
 shot.trailPoints.pop();shot.trailPoints.unshift(shot.mesh.position.clone());
 const arr=shot.trail.geometry.attributes.position.array;
 for(let j=0;j<shot.trailPoints.length;j++){const v=shot.trailPoints[j];arr[j*3]=v.x;arr[j*3+1]=v.y;arr[j*3+2]=v.z}
 shot.trail.geometry.attributes.position.needsUpdate=true;
 const contact=Math.hypot(shot.mesh.position.x-x,shot.mesh.position.z-z);
 let remove=false;
 if(contact<5.7&&Math.abs(shot.mesh.position.y-(bob+2.3))<5.5 && t>=playerCombat.invulnerableUntil && playerCombat.hp>0){
  playerCombat.hp=Math.max(0,playerCombat.hp-ENEMY_AI.shotDamage);
  playerCombat.invulnerableUntil=t+.45;
  energyFlash(new THREE.Vector3(x,bob+2.5,z));remove=true;
 }
 if(progress>=1){energyFlash(shot.mesh.position);remove=true;}
 if(remove){scene.remove(shot.mesh,shot.trail);shot.trail.geometry.dispose();enemyShots.splice(i,1);}
}
if(playerCombat.hp<=0){
 if(playerCombat.respawnAt===0)playerCombat.respawnAt=t+4;
 if(t>=playerCombat.respawnAt){
  playerCombat.hp=ENEMY_AI.maxHp;playerCombat.respawnAt=0;
  playerCombat.invulnerableUntil=t+3;
  // Renascimento local: não teletransportar o jogador para a origem do mapa.
  // Preserva a posição e o HP de todos os NPCs, evitando o salto de câmera/frota.
  speed=0;boostUntil=0;
  hullPhysics.x=x;hullPhysics.z=z;hullPhysics.vx=0;hullPhysics.vz=0;
  cancelAreaAim();
  for(const shot of enemyShots){scene.remove(shot.mesh,shot.trail);shot.trail.geometry.dispose();}
  enemyShots.length=0;
 }
}
// Indicadores de dano seguem o inimigo na tela e desaparecem suavemente.
for(let i=damageLabels.length-1;i>=0;i--){
 const d=damageLabels[i];d.age+=dt;
 const pos=new THREE.Vector3(d.enemy.x,d.enemy.y+8+d.age*3,d.enemy.z).project(camera);
 d.label.style.left=(pos.x*.5+.5)*innerWidth+'px';
 d.label.style.top=(-pos.y*.5+.5)*innerHeight+'px';
 d.label.style.opacity=String(Math.max(0,1-d.age/.95));
 if(d.age>=.95){d.label.remove();damageLabels.splice(i,1)}
}
const remaining=Math.max(0,COMBAT.cooldown-(t-lastShotTime));
if(!areaAim.active)fireButton.textContent=remaining>0?'RECARGA '+remaining.toFixed(1)+'s':'DISPARAR';
fireButton.disabled=remaining>0;
hpHud.textContent=playerCombat.hp>0?'❤️ Integridade: '+playerCombat.hp+'/'+ENEMY_AI.maxHp+'  ·  Hostis: '+enemies.filter(e=>e.hp>0).length+'/'+enemies.length:'💥 NAVE DESTRUÍDA · Reiniciando...';
hpHud.style.borderColor=playerCombat.hp<=30?'#ff5555':'#7fb4c3';
energyGlowMaterial.uniforms.uTime.value=t;plasmaMaterial.uniforms.uTime.value=t;
for(let i=projectiles.length-1;i>=0;i--){
  const p=projectiles[i];
  p.age+=dt;
  const u=Math.min(1,p.age/p.travel);
  // Parábola suave: ponto alto no meio, queda sobre o alvo.
  if(p.age<0)continue;
  if(p.ammo==='siege'){
   // Subida lenta até o ápice e descida igualmente lenta, sem saltos na transição.
   const firstHalf=Math.min(1,u*2);
   const lastHalf=Math.max(0,(u-.5)*2);
   if(u<=.5){
     p.mesh.position.lerpVectors(p.origin,p.destination,smoothstep01(firstHalf)*.7);
     p.mesh.position.y=THREE.MathUtils.lerp(p.origin.y,p.arcHeight,smoothstep01(firstHalf));
   }else{
     p.mesh.position.lerpVectors(p.origin,p.destination,.7+.3*smoothstep01(lastHalf));
     p.mesh.position.y=THREE.MathUtils.lerp(p.arcHeight,p.destination.y,smoothstep01(lastHalf));
   }
  }else if(p.ammo==='meteor'){
   // Trajetória quase vertical na fase final: aproximação inicial curta e mergulho.
   const move=u<.38?(u/.38)*.72:.72+.28*((u-.38)/.62);
   p.mesh.position.lerpVectors(p.origin,p.destination,move);
   p.mesh.position.y+=p.arcHeight*Math.sin(Math.PI*Math.pow(u,.63));
  }else{
   ballisticPoint(p.origin,p.destination,p.travel,p.age,p.arcHeight,p.mesh.position);
  }
  p.glow.quaternion.copy(camera.quaternion);p.outerGlow.quaternion.copy(camera.quaternion);
  if(p.plasma){p.plasma.rotation.set(t*6,t*9,t*5);p.plasma.scale.setScalar(1+.13*Math.sin(t*25));}
  p.trailPoints.pop();p.trailPoints.unshift(p.mesh.position.clone());
  const arr=p.trail.geometry.attributes.position.array;
  for(let j=0;j<p.trailPoints.length;j++){
    const v=p.trailPoints[j];arr[j*3]=v.x;arr[j*3+1]=v.y;arr[j*3+2]=v.z;
  }
  p.trail.geometry.attributes.position.needsUpdate=true;
  // A explosão ocorre na chegada; não atravessa o alvo entre frames.
  if(u>=1){
    energyFlash(p.mesh.position);
    // Confirmação de acerto pelo ponto real de impacto (sem dano apenas por travar alvo).
    for(const enemy of enemies){
      const distance=Math.hypot(enemy.x-p.destination.x,enemy.z-p.destination.z);
      const radius=p.ammo==='siege'?AREA_RADIUS:8;
      if(enemy.hp>0&&distance<=radius){
        const damage=Math.min(enemy.hp,p.damage||COMBAT.damage);
        enemy.hp=Math.max(0,enemy.hp-damage);
        showDamage(enemy,damage);
        energyFlash(new THREE.Vector3(enemy.x,enemy.y+2.5,enemy.z));
        if(enemy.hp===0){
          enemy.state='destroyed';
          enemy.destroyedAt=t;
          // Explosão de destruição maior, seguida de partículas de energia.
          for(let burst=0;burst<3;burst++){
            const pos=new THREE.Vector3(enemy.x+(Math.random()-.5)*5,enemy.y+2+Math.random()*4,enemy.z+(Math.random()-.5)*5);
            energyFlash(pos);
          }
          if(enemy.sprite)enemy.sprite.visible=false;
          if(enemy===npcData){npc.visible=false;npcShadow.visible=false;}
        }
      }
    }
    if(p.ammo==='siege'){
      const bloom=energyGlowMaterial.clone();bloom.uniforms.uTime={value:t};bloom.uniforms.uOpacity={value:1};
      bloom.uniforms.uColor={value:new THREE.Color(0xc778ff)};
      const burst=new THREE.Mesh(energyGlowGeometry,bloom);burst.position.copy(p.mesh.position);burst.scale.setScalar(5);scene.add(burst);
      const ring=new THREE.Mesh(new THREE.RingGeometry(AREA_RADIUS*.8,AREA_RADIUS,72),new THREE.MeshBasicMaterial({color:0xee99ff,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
      ring.rotation.x=-Math.PI/2;ring.position.copy(p.mesh.position);ring.position.y+=.4;scene.add(ring);
      areaBursts.push({burst,ring,age:0});
      // Dano em área configurado para NPCs futuros; Patrulheiro 01 segue imortal durante testes.
      // Confirmações de acerto são processadas em um único ponto acima.
    }
    if(attackCamera.shot===p){
      attackCamera.phase='impact';attackCamera.impactAt=t;
      attackCamera.shot=null;attackCamera.shake=.42;
    }
    scene.remove(p.mesh,p.trail);p.trail.geometry.dispose();
    for(const part of p.mesh.children){if(part.material!==energyCoreMaterial && part.material!==energyGlowMaterial && part.material!==plasmaMaterial)part.material.dispose()}
    projectiles.splice(i,1);
  }
}
for(let i=areaBursts.length-1;i>=0;i--){
 const e=areaBursts[i];e.age+=dt;
 const fade=Math.max(0,1-e.age/.72);
 e.burst.quaternion.copy(camera.quaternion);e.burst.material.uniforms.uTime.value=t;
 e.burst.material.uniforms.uOpacity.value=fade;
 e.burst.scale.setScalar(5+e.age*15);e.ring.scale.setScalar(.5+e.age*1.15);e.ring.material.opacity=fade*.85;
 if(e.age>=.72){scene.remove(e.burst,e.ring);e.burst.material.dispose();e.ring.material.dispose();areaBursts.splice(i,1)}
}
if(areaAim.active&&areaAim.valid){areaAim.point.y=height(areaAim.point.x,areaAim.point.z,t)+.35;aimReticle.position.copy(areaAim.point);aimReticle.rotation.y+=dt*.35;const scale=selectedAmmo.id==='siege'?1:.35;aimReticle.scale.setScalar(scale)}
for(let i=impactEffects.length-1;i>=0;i--){
 const e=impactEffects[i];e.age+=dt;e.flash.quaternion.copy(camera.quaternion);e.ring.quaternion.copy(camera.quaternion);
 const fade=Math.max(0,1-e.age/.45);
 e.flash.material.uniforms.uTime.value=t;e.flash.material.uniforms.uOpacity.value=fade;
 e.flash.scale.setScalar(1.7+e.age*9);e.ring.scale.setScalar(1+e.age*18);e.ring.material.opacity=fade*.85;
 const pos=e.sparks.geometry.attributes.position;
 for(let j=0;j<e.velocities.length;j++){const v=e.velocities[j];pos.setXYZ(j,v.x*e.age,v.y*e.age-11*e.age*e.age,v.z*e.age)}
 pos.needsUpdate=true;e.sparks.material.opacity=fade;
 if(e.age>=.45){scene.remove(e.flash,e.ring,e.sparks);e.flash.material.dispose();e.ring.material.dispose();e.sparks.material.dispose();e.sparks.geometry.dispose();impactEffects.splice(i,1)}
}

// A malha acompanha o jogador com fases de onda em coordenadas globais. 
water.position.set(x,0,z);uniforms.uOffset.value.set(x,z);
horizon.update(x,z,t);
// Câmera de ação: afastada, baixa, horizonte aparente e horizonte estável.
// Inclinação de observação menor do que a do protótipo anterior para evitar vista quase vertical.
// Não copiar bob/pitch/roll do casco para câmera (previne enjoo visual).
// Câmera de perseguição baixa: olhar quase horizontal com proa no terço inferior.
// Distância moderada mantém o jogador legível no celular; ponto focal remoto revela o céu.
// Semi top-down: inclinação ~55° abaixo do horizonte, enquadramento centrado.
// Enquadramento compacto: nave ocupa cerca de 30% da altura da tela.
// Câmera de ação baixa: preserva o horizonte sem diminuir muito a nave.
// Câmera normal: traseira fixa, horizonte visível e arrasto preservado.
const distance=THREE.MathUtils.lerp(24,27,Math.min(1,speed/72));
const cameraHeight=THREE.MathUtils.lerp(12,14,Math.min(1,speed/72));
const cameraYaw=heading;
normalView.set(x+Math.sin(cameraYaw)*distance,cameraHeight,z+Math.cos(cameraYaw)*distance);
// Mantém o modelo 3D no enquadramento, inclusive os detalhes do canhão e das turbinas.
normalLook.set(x-Math.sin(cameraYaw)*11,bob+2.4,z-Math.cos(cameraYaw)*11);
// Modo ataque: distancia-se o suficiente para mostrar embarcação, alvo e arco 3D.
let desiredBlend=0;
if(attackCamera.phase==='flight' && attackCamera.shot)desiredBlend=1;
else if(attackCamera.phase==='impact'){
  desiredBlend=t-attackCamera.impactAt<.26?1:0;
  if(t-attackCamera.impactAt>.85)attackCamera.phase='idle';
}
const blendRate=desiredBlend>attackCamera.blend?5.5:3.8;
attackCamera.blend=THREE.MathUtils.damp(attackCamera.blend,desiredBlend,blendRate,dt);
if(attackCamera.phase==='idle' && attackCamera.blend<.005)attackCamera.blend=0;
wanted.copy(normalView);follow.copy(normalLook);
if(attackCamera.target && attackCamera.blend>.001){
  // Travado nas coordenadas do disparo, não na posição/rotação atual da nave.
  const launchPos=attackCamera.launchOrigin;
  const targetPos=attackCamera.target;
  const gap=launchPos.distanceTo(targetPos);
  const midpoint=launchPos.clone().lerp(targetPos,.55);
  const shot=attackCamera.shot;
  const focus=shot?midpoint.clone().lerp(shot.mesh.position,.24):midpoint;
  // Amplia progressivamente conforme a separação, sem afastar demais.
  const attackDistance=THREE.MathUtils.clamp(gap*.65+20,34,83);
  const attackHeight=THREE.MathUtils.clamp(gap*.26+11,17,39);
  shotView.set(focus.x+Math.sin(attackCamera.launchYaw)*attackDistance,focus.y+attackHeight,focus.z+Math.cos(attackCamera.launchYaw)*attackDistance);
  shotLook.copy(focus);
  wanted.lerp(shotView,attackCamera.blend);
  follow.lerp(shotLook,attackCamera.blend);
}
// Armas especiais recebem visão superior imediata; tiros comuns mantêm câmera normal.
const tacticalHold=areaAim.active && TACTICAL_AMMO.has(selectedAmmo.id);
areaAim.viewBlend=THREE.MathUtils.damp(areaAim.viewBlend,tacticalHold?1:0,tacticalHold?12:5.2,dt);
if(areaAim.viewBlend<.001&&!tacticalHold)areaAim.viewBlend=0;
if(areaAim.viewBlend>0){
 const p=areaAim.point;
 const dx=p.x-x,dz=p.z-z;
 const span=Math.hypot(dx,dz);
 // Eleva e afasta para que navio e alvo permaneçam legíveis na mesma tomada.
 const midX=x+dx*.51,midZ=z+dz*.51;
 const h=THREE.MathUtils.clamp(48+span*.55,65,190);
 aimView.set(midX+Math.sin(heading)*Math.min(20,span*.12),h,midZ+Math.cos(heading)*Math.min(20,span*.12));
 aimLook.set(midX,height(midX,midZ,t),midZ);
 wanted.lerp(aimView,areaAim.viewBlend);
 follow.lerp(aimLook,areaAim.viewBlend);
}
attackCamera.shake=Math.max(0,attackCamera.shake-dt*2.3);
camera.position.copy(wanted);
if(attackCamera.shake>0){
 const k=attackCamera.shake*attackCamera.blend;
 camera.position.x+=Math.sin(t*87)*k;
 camera.position.y+=Math.cos(t*119)*k*.65;
}
camTarget.copy(follow);cameraReady=true;camera.lookAt(camTarget);
if(attackCamera.phase==='idle' && attackCamera.blend===0){attackCamera.target=null;attackCamera.launchOrigin=null;}
document.getElementById('status').textContent=(speed<-.5?'Ré: ':'Velocidade: ')+Math.round(Math.abs(speed))+'  |  Ondas ativas';
renderer.render(scene,camera)
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
document.getElementById('loading').remove();tick();