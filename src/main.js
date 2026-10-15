import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import {createWastelandHorizon} from './environment.js';
import {planEnemy,canEnemyFire,TACTICS,predictIntercept,assessProjectileThreat,evadeVector,sweptMovingContact,NPC_WEAPONS,chooseNpcWeapon,steerNpc} from './enemy-ai.js';
import {integrateHull,ballisticPoint} from './naval-physics.js';
import {createWarMachine3D} from './war-machine-3d.js';
import {createGameAudio} from './game-audio.js';
const audio=createGameAudio();
const soundButton=document.createElement('button');soundButton.id='soundToggle';soundButton.textContent='🔊';soundButton.title='Ligar ou silenciar sons';soundButton.setAttribute('aria-label','Silenciar sons');document.getElementById('ui').appendChild(soundButton);
soundButton.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();audio.setEnabled(!audio.enabled);soundButton.textContent=audio.enabled?'🔊':'🔇';soundButton.setAttribute('aria-label',audio.enabled?'Silenciar sons':'Ligar sons');});
document.addEventListener('pointerdown',()=>audio.unlock(),{capture:true,passive:true});
document.addEventListener('keydown',()=>audio.unlock());
document.getElementById('landscapeFullscreen').addEventListener('click',async()=>{try{await document.documentElement.requestFullscreen?.();await screen.orientation?.lock?.('landscape')}catch(e){console.info('Rotação automática indisponível; gire o dispositivo manualmente.')}});
const scene=new THREE.Scene();scene.background=new THREE.Color('#8db6d5');scene.fog=new THREE.FogExp2('#759ab4',.00155);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,1400);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
const QUALITY_KEY='semnome.graphicsQuality';
let graphicsQuality='standard';
try{graphicsQuality=localStorage.getItem(QUALITY_KEY)==='ultra'?'ultra':'standard';}catch(_){}
function applyGraphicsQuality(){
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 uniforms.uGraphicsQuality.value=graphicsQuality==='ultra'?1:0;
}
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xb8dfff,0x123e58,1.65));
const sun=new THREE.DirectionalLight(0xffd99b,3.3);sun.position.set(165,92,-330);scene.add(sun);
// Ciclo de mar mais suave: calmo > médio > bravinho > calmo > bravinho.
// Intensidades ficam abaixo da anterior (.55), e toda transição é contínua.
const SEA_CYCLE=200; // segundos; repete sem salto ao cruzar o limite
const SEA_STAGES=[
 {time:0,intensity:.17},{time:24,intensity:.17},
 {time:43,intensity:.30},{time:60,intensity:.30},
 {time:80,intensity:.44},{time:95,intensity:.44},
 {time:124,intensity:.17},{time:144,intensity:.17},
 {time:166,intensity:.43},{time:179,intensity:.43},
 {time:200,intensity:.17}
];
function seaIntensityAt(t){
 const phase=((t%SEA_CYCLE)+SEA_CYCLE)%SEA_CYCLE;
 for(let i=1;i<SEA_STAGES.length;i++){
  const next=SEA_STAGES[i],previous=SEA_STAGES[i-1];
  if(phase<=next.time){
   const progress=(phase-previous.time)/(next.time-previous.time);
   const easing=progress*progress*(3-2*progress);
   return previous.intensity+(next.intensity-previous.intensity)*easing;
  }
 }
 return SEA_STAGES[0].intensity;
}
let currentSeaIntensity=SEA_STAGES[0].intensity;
const waves=[
{dx:1,dz:.25,a:2.8,k:.055,s:1.1},
{dx:-.3,dz:1,a:1.7,k:.092,s:1.6},
{dx:.75,dz:-.65,a:1.15,k:.17,s:2.0},
{dx:-.65,dz:-.75,a:.65,k:.29,s:2.8}
].map(w=>({...w,len:Math.hypot(w.dx,w.dz)}));
function height(x,z,t){let y=0;for(const w of waves)y+=w.a*Math.sin((x*w.dx+z*w.dz)/w.len*w.k-t*w.s);return y*currentSeaIntensity}
function normal(x,z,t){const h=.8;return new THREE.Vector3(height(x-h,z,t)-height(x+h,z,t),2*h,height(x,z-h,t)-height(x,z+h,t)).normalize()}
const uniforms={uTime:{value:0},uOffset:{value:new THREE.Vector2(0,0)},uWaveIntensity:{value:currentSeaIntensity},uSunDirection:{value:new THREE.Vector3(165,92,-330).normalize()},uGraphicsQuality:{value:graphicsQuality==='ultra'?1:0},uNight:{value:0}};
const water=new THREE.Mesh(new THREE.PlaneGeometry(1100,1100,190,190),new THREE.ShaderMaterial({
uniforms,side:THREE.DoubleSide,
vertexShader:`uniform float uTime;uniform float uWaveIntensity;uniform vec2 uOffset;varying vec3 vPos;varying float vHeight;
float sea(vec2 p){return 2.8*sin(dot(p,normalize(vec2(1.,.25)))*.055-uTime*1.1)+1.7*sin(dot(p,normalize(vec2(-.3,1.)))*.092-uTime*1.6)+1.15*sin(dot(p,normalize(vec2(.75,-.65)))*.17-uTime*2.)+.65*sin(dot(p,normalize(vec2(-.65,-.75)))*.29-uTime*2.8);}
void main(){vec3 p=position;vec2 worldXZ=vec2(p.x,-p.y)+uOffset;p.z=sea(worldXZ)*uWaveIntensity;vHeight=p.z;vPos=vec3(worldXZ,p.z);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
fragmentShader:`uniform float uTime;uniform float uWaveIntensity;uniform float uGraphicsQuality;uniform float uNight;uniform vec2 uOffset;uniform vec3 uSunDirection;
varying vec3 vPos;varying float vHeight;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wave(vec2 p){return uWaveIntensity*(2.8*sin(dot(p,normalize(vec2(1.,.25)))*.055-uTime*1.1)+1.7*sin(dot(p,normalize(vec2(-.3,1.)))*.092-uTime*1.6)+1.15*sin(dot(p,normalize(vec2(.75,-.65)))*.17-uTime*2.)+.65*sin(dot(p,normalize(vec2(-.65,-.75)))*.29-uTime*2.8));}
void main(){
 vec2 p=vPos.xy;
 if(uGraphicsQuality<.5){
  // Menos operações no shader, mas preserva contraste e detalhes visuais.
  vec2 q=vPos.xy;
  float crest=smoothstep(-3.,4.,vHeight/max(uWaveIntensity,.08));
  vec3 sea=mix(vec3(.009,.12,.19),vec3(.035,.32,.43),crest);
  float detail=sin(q.x*.19+uTime*1.1)*sin(q.y*.22-uTime*.8);
  sea+=vec3(.025,.055,.065)*detail;
  float glimmer=pow(max(0.,sin(q.x*.11+q.y*.07-uTime*.9)),14.);
  sea+=vec3(.06,.11,.12)*glimmer;
  float moonPath=pow(max(0.,1.-abs(q.x*.009+q.y*.003+sin(q.y*.022+uTime*.25)*.13)),13.)*smoothstep(0.,170.,length(q-uOffset));
  gl_FragColor=vec4(mix(sea,sea*vec3(.30,.43,.68)+vec3(.12,.19,.31)*moonPath,uNight),1.);return;
 }
 float h=.75;
 vec2 gradient=vec2(wave(p+vec2(h,0.))-wave(p-vec2(h,0.)),wave(p+vec2(0.,h))-wave(p-vec2(0.,h)));
 vec3 n=normalize(vec3(-gradient.x,2.*h,-gradient.y));
 vec3 viewDir=normalize(cameraPosition-vec3(p.x,vHeight,p.y));
 vec3 lightDir=normalize(uSunDirection);
 float lit=.3+.7*max(dot(n,lightDir),0.);
 float fresnel=pow(1.-max(dot(n,viewDir),0.),3.);
 float spec=pow(max(dot(reflect(-lightDir,n),viewDir),0.),85.)*1.4;
 float glint=pow(max(dot(reflect(-lightDir,n),viewDir),0.),240.)*2.;
 float normalizedHeight=vHeight/max(uWaveIntensity,.08);
 float trough=smoothstep(-5.,3.5,normalizedHeight);
 vec3 deep=vec3(.006,.075,.135),shallow=vec3(.015,.36,.46);
 vec3 sea=mix(deep,shallow,trough*.7+lit*.18);
 sea=mix(sea,vec3(.13,.39,.53),fresnel*.33);
 // Espuma orgânica: filamentos deformados com a crista, sem malha hexagonal.
 vec2 warp=p*.21+gradient.yx*.17;
 float filaments=sin(warp.x+sin(warp.y*.75)*2.8)*cos(warp.y*.66+sin(warp.x*.8)*2.);
 float jitter=hash(floor(p*.48))*0.35;
 float crest=smoothstep(2.,5.,normalizedHeight+filaments*.65);
 float ribbons=smoothstep(.54,.87,filaments+jitter)*smoothstep(.2,4.5,normalizedHeight);
 float foam=clamp((crest*.30+ribbons*.57)*(.22+uWaveIntensity),0.,.48);
 sea=mix(sea,vec3(.79,.96,1.),foam);
 sea+=vec3(1.,.77,.46)*(spec*.38+glint*.22);
 float mist=smoothstep(180.,690.,length(p-uOffset));
 sea=mix(sea,vec3(.39,.55,.65),mist*.42);
 float moonPath=pow(max(0.,1.-abs(p.x*.009+p.y*.003+sin(p.y*.022+uTime*.25)*.13)),13.)*smoothstep(0.,170.,length(p-uOffset));
 gl_FragColor=vec4(mix(sea,sea*vec3(.30,.43,.68)+vec3(.12,.19,.31)*moonPath,uNight),1.);
}`
}));
water.rotation.x=-Math.PI/2;scene.add(water);
applyGraphicsQuality();
const qualityButton=document.createElement('button');qualityButton.id='graphicsQualityButton';qualityButton.type='button';
qualityButton.style.cssText='position:fixed;top:12px;right:12px;z-index:95;padding:8px 12px;border-radius:10px;border:1px solid #83d6ed;background:#112c3de8;color:white;font-weight:700;touch-action:manipulation';
qualityButton.setAttribute('aria-label','Alternar qualidade gráfica');document.body.appendChild(qualityButton);
function refreshQualityButton(){qualityButton.textContent='⚙ Gráficos: '+(graphicsQuality==='ultra'?'Ultra':'Padrão');}
qualityButton.addEventListener('click',()=>{graphicsQuality=graphicsQuality==='ultra'?'standard':'ultra';applyGraphicsQuality();try{localStorage.setItem(QUALITY_KEY,graphicsQuality);}catch(_){}refreshQualityButton();});
refreshQualityButton();
const horizon=createWastelandHorizon(THREE,scene);
const daytimeHorizon=scene.children.find(o=>o.isGroup);
// Lua física visível: disco circular com bordas suaves e halo aditivo.
const moonDirection=new THREE.Vector3(.36,.24,-.90).normalize();
const moonMaterial=new THREE.ShaderMaterial({
 transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,
 uniforms:{},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float disc=1.-smoothstep(.275,.3,r);float halo=exp(-r*r*7.)*.28+exp(-r*r*1.2)*.07;float crater=sin(vUv.x*57.)*sin(vUv.y*43.)*.035;vec3 light=vec3(.84,.91,1.)*(disc*(.9+crater)+halo);gl_FragColor=vec4(light,clamp(disc+halo,0.,1.));}`
});
const moonMesh=new THREE.Mesh(new THREE.PlaneGeometry(155,155),moonMaterial);
moonMesh.visible=false;moonMesh.renderOrder=900;scene.add(moonMesh);
const nightDome=new THREE.Mesh(new THREE.SphereGeometry(800,40,24),new THREE.ShaderMaterial({
 side:THREE.BackSide,depthWrite:false,fog:false,
 vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec3 vDir;void main(){vec3 d=normalize(vDir);float h=smoothstep(-.18,.65,d.y);vec3 sky=mix(vec3(.022,.056,.12),vec3(.002,.006,.027),h);float n=fract(sin(dot(floor(d*950.),vec3(12.9898,78.233,37.719)))*43758.5453);float stars=step(.996,n)*smoothstep(.06,.3,d.y);float moon=pow(max(dot(d,normalize(vec3(.55,.66,-.45))),0.),1200.);gl_FragColor=vec4(sky+stars*vec3(.8,.85,1.)+moon*vec3(.7,.8,1.),1.);}`
}));nightDome.visible=false;scene.add(nightDome);
function applyOceanRegion(){
 const night=mission.stage>=5;
 nightDome.visible=night;moonMesh.visible=night;uniforms.uNight.value=night?1:0;
 sun.intensity=night?.8:3.3;sun.color.setHex(night?0x85b9ff:0xffd99b);
 scene.background.setHex(night?0x030819:0x8db6d5);
 if(daytimeHorizon)daytimeHorizon.visible=!night;
 scene.fog.color.setHex(night?0x071529:0x759ab4);
}
// Máquina provisória em geometria simples; sprites 16 direções entram após validação.
const ship=createWarMachine3D(THREE);ship.scale.multiplyScalar(1.17);scene.add(ship);
// Modelo alternativo conquistável: carenagem e estabilizadores exclusivos.
const signalHull=new THREE.Group();ship.add(signalHull);
const signalMetal=new THREE.MeshStandardMaterial({color:0x203f79,metalness:.78,roughness:.22,emissive:0x11245c,emissiveIntensity:.3});
const signalGlow=new THREE.MeshBasicMaterial({color:0x69dfff});
for(const side of [-1,1]){
 const fin=new THREE.Mesh(new THREE.BoxGeometry(1.1,.45,8),signalMetal);
 fin.position.set(side*3.7,.7,1.1);fin.rotation.z=side*.19;signalHull.add(fin);
 const light=new THREE.Mesh(new THREE.BoxGeometry(.25,.15,6.5),signalGlow);
 light.position.set(side*3.8,1.05,1.1);signalHull.add(light);
}
const prow=new THREE.Mesh(new THREE.ConeGeometry(2.4,7,5),signalMetal);
prow.rotation.x=-Math.PI/2;prow.position.set(0,1,-6.3);signalHull.add(prow);
signalHull.visible=false;
// Nave original do Semnome restaurada. GLBs experimentais preservados em assets, mas não carregados.
const shadow=new THREE.Mesh(new THREE.CircleGeometry(5.8,32),new THREE.MeshBasicMaterial({color:0x062836,transparent:true,opacity:.22,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.12;scene.add(shadow);
// Esteira arcade: geometria compartilhada, instâncias recicladas, nenhuma alocação por frame.
const wakeMaterial=new THREE.MeshBasicMaterial({color:0xdafaff,transparent:true,opacity:.44,depthWrite:false,side:THREE.DoubleSide});
const wakeGeometry=new THREE.RingGeometry(.45,1.28,28);
const wakePool=Array.from({length:18},()=>{
 const mesh=new THREE.Mesh(wakeGeometry,wakeMaterial.clone());
 mesh.rotation.x=-Math.PI/2;mesh.visible=false;mesh.renderOrder=2;scene.add(mesh);
 return {mesh,life:0,duration:1.5};
});
let wakeCursor=0,wakeTimer=0;
function emitWake(px,pz,t,boost){
 const item=wakePool[wakeCursor];wakeCursor=(wakeCursor+1)%wakePool.length;
 item.life=item.duration=boost?1.0:1.5;
 item.mesh.position.set(px,height(px,pz,t)+.23,pz);
 item.mesh.scale.setScalar(boost?1.9:1.22);
 item.mesh.material.opacity=boost?.77:.54;
 item.mesh.visible=true;
}
function animateWake(dt,t,px,pz,yaw,velocity,boost){
 const rate=(boost?.08:.135)*(graphicsQuality==='ultra'?1:2.5);
 wakeTimer+=dt;
 if(Math.abs(velocity)>11){
  let count=0;
  while(wakeTimer>=rate&&count++<2){
   wakeTimer-=rate;
   const behind=5.6+Math.random()*1.1;
   const offset=(Math.random()-.5)*5.2;
   emitWake(px+Math.sin(yaw)*behind+Math.cos(yaw)*offset,pz+Math.cos(yaw)*behind-Math.sin(yaw)*offset,t,boost);
  }
 }else wakeTimer=0;
 for(const item of wakePool){
  if(item.life<=0)continue;
  item.life=Math.max(0,item.life-dt);
  const progress=1-item.life/item.duration;
  item.mesh.scale.multiplyScalar(1+dt*.32);
  item.mesh.material.opacity=(boost?.65:.42)*(1-progress)*(1-progress);
  item.mesh.position.y=height(item.mesh.position.x,item.mesh.position.z,t)+.23;
  item.mesh.visible=item.life>0;
 }
}
// Reflexos de sustentação sob os dois propulsores, leves e reutilizados.
const hoverHaloGeometry=new THREE.CircleGeometry(1.35,16);
const hoverHaloMaterial=new THREE.MeshBasicMaterial({color:0x59e7ff,transparent:true,opacity:.105,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
const hoverHalos=[-1,1].map(()=>{
 const halo=new THREE.Mesh(hoverHaloGeometry,hoverHaloMaterial.clone());
 halo.rotation.x=-Math.PI/2;halo.renderOrder=3;scene.add(halo);return halo;
});
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
// Alcance do jogador ampliado cerca de 20% para manter a perseguição aos NPCs viável.
// IA inimiga, recargas, danos e velocidades de projétil permanecem iguais.
const COMBAT={range:235,projectileSpeed:175,damage:25,cooldown:2.7,npcMaxHp:100};
const WEAPON_STATS=Object.freeze({plasma:{range:250,cooldown:2.1,damage:25,impact:8},iron:{range:285,cooldown:2.5,damage:40,impact:8},torpedo:{range:295,cooldown:7.5,damage:165,impact:63.25},scatter:{range:270,cooldown:3.5,damage:24,impact:20},energyBomb:{range:370,cooldown:300,damage:0,impact:25}});
npcData.hp=COMBAT.npcMaxHp;
// Frota ampliada: 13 naves hostis em setores de patrulha distribuídos.
// Mantém instâncias e IA existentes; evita concentrar todos os NPCs na origem.
const FLEET_SIZE=2;
const enemies=[npcData];
npcData.x=-360;npcData.z=-190;npcData.anchorX=npcData.x;npcData.anchorZ=npcData.z;
npcData.id=1;npcData.name='Patrulheiro 01';npcData.phase=0;npcData.radius=15;npcData.sprite=null;npcData.nextShot=3;npcData.state='patrol';npcData.hostile=true;
for(let i=1;i<FLEET_SIZE;i++){
 const positions=[[-360,-190],[355,-260],[-245,-525],[310,-690],[-150,-880],[420,-975]];
 const [spawnX,spawnZ]=positions[i];
 const angle=Math.atan2(-spawnX,-spawnZ);
 enemies.push({id:i+1,name:'Patrulheiro '+String(i+1).padStart(2,'0'),
  x:spawnX,z:spawnZ,y:0,
  anchorX:spawnX,anchorZ:spawnZ,
  heading:angle,speed:4+(i%4)*1.4,hp:COMBAT.npcMaxHp,phase:i*.87,radius:16+i%3*6,sprite:null,nextShot:2+i*.45,state:'patrol',hostile:true});
}

 // Reforços da etapa 2: pré-instanciados, mas inativos até a carga ser recolhida.
const reinforcementPositions=[[1020,-860],[1740,-870]];
// Reforços posteriores, distribuídos em pontos fixos do corredor da entrega.
const reinforcementWaves=[
 {at:1500,positions:[[1880,-1410],[2120,-700],[2370,-1320]]},
 {at:1000,positions:[[2490,-1550],[2740,-750],[2850,-1370]]},
 {at:500,positions:[[3070,-1460],[3300,-780]]}
];
for(let i=0;i<reinforcementPositions.length;i++){
 const [sx,sz]=reinforcementPositions[i];
 enemies.push({id:FLEET_SIZE+i+1,name:'Interceptador '+String(i+1).padStart(2,'0'),
  x:sx,z:sz,y:0,anchorX:sx,anchorZ:sz,heading:-Math.PI/2,speed:7,
  hp:0,phase:i*.65,radius:17,sprite:null,nextShot:0,state:'dormant',hostile:true,dormant:true});
}
let reinforcementId=FLEET_SIZE+reinforcementPositions.length+1;
for(const wave of reinforcementWaves){
 for(const [sx,sz] of wave.positions){
  const id=reinforcementId++;
  enemies.push({id,name:'Caçador '+String(id).padStart(2,'0'),
   x:sx,z:sz,y:0,anchorX:sx,anchorZ:sz,heading:Math.atan2(-sx,-sz),
   speed:7,hp:0,phase:id*.65,radius:17,sprite:null,nextShot:0,
   state:'dormant',hostile:true,dormant:true,waveDistance:wave.at});
 }
}
// Missão seguinte: 10 unidades em 3 ondas (3, 3 e 4 veteranos).
const clearAreaPositions=[
 [-120,-220],[240,-280],[80,-420],
 [-330,-360],[390,-500],[-170,-590],
 [-440,-650],[480,-700],[-320,-850],[370,-910]
];
for(let i=0;i<clearAreaPositions.length;i++){
 const [sx,sz]=clearAreaPositions[i],id=reinforcementId++;
 const wave=i<3?0:i<6?1:2;
 enemies.push({id,name:wave===2?'Veterano '+(i-5):'Hostil '+(i+1),
  x:sx,z:sz,y:0,anchorX:sx,anchorZ:sz,heading:0,speed:7,
  hp:0,phase:i*.8,radius:16,sprite:null,nextShot:0,
  state:'dormant',hostile:true,dormant:true,clearAreaWave:wave,veteran:wave===2});
}
// Frota da missão 03: quatro interceptadores e dois minadores.
for(let i=0;i<6;i++){
 const id=reinforcementId++;
 enemies.push({id,name:i<4?'Interceptador Sinal '+(i+1):'Minador Sinal '+(i-3),
 x:0,z:0,y:0,anchorX:0,anchorZ:0,heading:0,speed:8,hp:0,phase:i*.7,radius:16,
 sprite:null,nextShot:0,state:'dormant',hostile:true,dormant:true,signalEnemy:true,veteran:i>=4});
}
// Defesa da base da missão 04: três sentinelas e um comandante naval.
for(let i=0;i<4;i++){
 const id=reinforcementId++;
 enemies.push({id,name:i===3?'Comandante da Base':'Sentinela da Base '+(i+1),
 x:0,z:0,y:0,anchorX:0,anchorZ:0,heading:0,speed:8,hp:0,phase:i*.7,radius:16,
 sprite:null,nextShot:0,state:'dormant',hostile:true,dormant:true,baseEnemy:true,boss:i===3,veteran:true});
}
// Três emboscadas de dois NPCs na travessia de extração (750, 1500 e 2250 m).
for(let i=0;i<6;i++){
 const id=reinforcementId++;
 enemies.push({id,name:'Caçador de Extração '+(i+1),x:0,z:0,y:0,anchorX:0,anchorZ:0,
 heading:0,speed:9,hp:0,phase:i*.9,radius:17,sprite:null,nextShot:0,
 state:'dormant',hostile:true,dormant:true,extractionWave:Math.floor(i/2)});
}
// Ataque NPC: detecção, aproximação, cadência individual, projéteis e dano real.
// Cada NPC compartilha a mesma geometria base, mas é uma instância independente.
for(const enemy of enemies){
 enemy.model=createWarMachine3D(THREE,{enemy:true});enemy.model.scale.multiplyScalar(1.17);
 enemy.vx=0;enemy.vz=0;
 enemy.maxHp=COMBAT.npcMaxHp;
 enemy.lastDamageAt=-9999;
 enemy.lastCombatAt=0;enemy.nextRegenAt=75;
 // Cada NPC mantém memória curta da velocidade vista, tempo de reação e dash.
 enemy.ai={estimateVx:0,estimateVz:0,nextDash:0,dashUntil:0,dashX:0,dashZ:0,
  trackedShot:null,detectedAt:0,willEvade:false,aimX:0,aimZ:0,nextWake:0,weaponReadyAt:{},choice:null,lastChoiceAt:-100,currentWeapon:null,
 intent:'patrol',nextPlanTime:0,plan:null,body:{x:enemy.x,z:enemy.z,vx:0,vz:0}};
 scene.add(enemy.model);
}
npc.visible=false;
npcShadow.visible=false;
const ENEMY_AI={detect:TACTICS.detect,fireRange:175,retreatRange:48,shotSpeed:140,shotDamage:7,shotCooldown:1.95,maxHp:100};
const playerCombat={hp:ENEMY_AI.maxHp,invulnerableUntil:0,respawnAt:0,deathX:0,deathZ:0,deathHeading:0,lastDamageAt:-9999};
const enemyShots=[];
// MISSÃO 01: RECUPERE A CARGA. O objetivo não se move; a frota caça o jogador.
const mission={cargoX:110,cargoZ:-1050,deliveryX:3110,deliveryZ:-1050,stage:0,finished:false,failed:false,calmSea:false,shopClosed:false,shopX:null,shopZ:null,transitionAt:0,clearWave:-1,clearDestroyed:0,signalX:9400,signalZ:-1100,scan:0,defendUntil:0,allyHp:100,signalKills:0,signalNextMine:0,baseX:11200,baseZ:-2100,recon:0,defensesDown:0,baseHits:0,baseDestroyed:false,towerNextShot:0,extractionX:0,extractionZ:0,extractionStartX:0,extractionStartZ:0,extractionDistance:0,extractionNextWave:1,subX:0,subZ:0,subHp:1200,subScan:0,subPhaseAt:0,subNextAttack:0,subSurviveUntil:0};
const economyKey='semnome.economy.v1';let oldEconomy={};try{oldEconomy=JSON.parse(localStorage.getItem(economyKey)||'{}')||{}}catch{}
const economy={scrap:Math.max(0,Number(oldEconomy.scrap)||0),engine:Math.min(5,Number(oldEconomy.engine)||0),weapons:Math.min(5,Number(oldEconomy.weapons)||0),armor:Math.min(5,Number(oldEconomy.armor)||0),health:Math.min(5,Number(oldEconomy.health)||0),booster:Math.min(5,Number(oldEconomy.booster)||0)};
const playerMaxHp=()=>ENEMY_AI.maxHp+economy.health*20;
const saveEconomy=()=>{try{localStorage.setItem(economyKey,JSON.stringify(economy))}catch{}};
const merchantShip=createWarMachine3D(THREE,{enemy:false});merchantShip.scale.multiplyScalar(1.05);merchantShip.visible=false;scene.add(merchantShip);
const merchantPanel=document.createElement('div');merchantPanel.style.cssText='display:none;position:fixed;inset:0;z-index:210;background:#061b2ad9;align-items:center;justify-content:center;padding:18px;font-family:system-ui;color:white';
merchantPanel.innerHTML='<div style="width:min(420px,95vw);background:#103349;border:1px solid #57d5b4;border-radius:14px;padding:18px;max-height:80vh;overflow:auto"><h2 style="font-size:19px">⚓ Mar Calmo · Comerciante</h2><p id="merchantBalance"></p><div id="merchantItems"></div><button id="merchantClose" style="margin-top:12px;padding:10px;border:0;border-radius:8px">Voltar ao mar</button></div>';
document.body.appendChild(merchantPanel);
const upgrades=[{id:'health',label:'❤️ Vida máxima (+20 HP)',base:65},{id:'engine',label:'⚡ Velocidade da nave (+5%)',base:45},{id:'weapons',label:'🎯 Dano contra NPCs (+8%)',base:60},{id:'booster',label:'🚀 Velocidade do propulsor (+10%)',base:70},{id:'armor',label:'🛡️ Blindagem (-5% dano)',base:55}];
function shopInRange(){return mission.calmSea&&!mission.shopClosed&&Math.hypot(x-(mission.shopX??mission.deliveryX),z-(mission.shopZ??mission.deliveryZ))<=200;}
function openMerchant(){
 if(!shopInRange())return;
 merchantPanel.style.display='flex';
 const items=merchantPanel.querySelector('#merchantItems');items.replaceChildren();
 merchantPanel.querySelector('#merchantBalance').textContent='🔩 Sucata: '+economy.scrap;
 for(const item of upgrades){
  const level=economy[item.id],cost=item.base*(level+1);
  const btn=document.createElement('button');btn.style.cssText='display:block;width:100%;margin:8px 0;padding:12px;background:#226479;color:white;border:1px solid #4ca6a0;border-radius:9px;text-align:left';
  btn.textContent=item.label+' · nível '+level+'/5 · '+(level>=5?'Máximo':cost+' sucata');
  btn.disabled=level>=5||economy.scrap<cost;
  btn.onclick=()=>{if(!shopInRange()||economy.scrap<cost||economy[item.id]>=5)return;economy.scrap-=cost;economy[item.id]++;if(item.id==='health')playerCombat.hp=Math.min(playerMaxHp(),playerCombat.hp+20);if(item.id==='armor')playerCombat.hp=Math.min(playerMaxHp(),playerCombat.hp+25);saveEconomy();openMerchant()};
  items.appendChild(btn);
 }
}
merchantPanel.querySelector('#merchantClose').onclick=()=>merchantPanel.style.display='none';
const merchantAccess=document.createElement('button');merchantAccess.textContent='⚓ Loja';merchantAccess.style.cssText='display:none;position:fixed;right:12px;bottom:110px;z-index:95;padding:9px;background:#164853;color:white;border:1px solid #70ccb4;border-radius:8px';document.body.appendChild(merchantAccess);merchantAccess.onclick=openMerchant;
const submarine=new THREE.Group();scene.add(submarine);submarine.visible=false;
const subMetal=new THREE.MeshStandardMaterial({color:0x172c46,metalness:.76,roughness:.3});
const subBody=new THREE.Mesh(new THREE.CapsuleGeometry(7,30,6,10),subMetal);subBody.rotation.x=Math.PI/2;submarine.add(subBody);
const subTower=new THREE.Mesh(new THREE.BoxGeometry(6,7,12),subMetal);subTower.position.y=6;submarine.add(subTower);
for(const side of [-1,1]){const fin=new THREE.Mesh(new THREE.BoxGeometry(18,.8,6),subMetal);fin.position.set(side*6,0,11);submarine.add(fin);}
const subShots=[],subShotGeo=new THREE.SphereGeometry(1.8,8,6),subShotMat=new THREE.MeshBasicMaterial({color:0x65f2ff});
const subPrompt=document.createElement('div');subPrompt.style.cssText='display:none;position:fixed;top:17%;left:50%;transform:translateX(-50%);z-index:180;padding:19px;width:min(370px,88vw);background:#071b32f2;border:1px solid #72dafe;border-radius:14px;color:white;font:600 14px system-ui;text-align:center';
subPrompt.innerHTML='<strong>📡 CAÇADA NAS PROFUNDEZAS</strong><p>Uma embarcação aliada desapareceu. A origem do último sinal está nas profundezas.</p><button style="padding:12px 20px;background:#8deaff;border:0;border-radius:9px;font-weight:800">INVESTIGAR</button>';document.body.appendChild(subPrompt);
const sonarBtn=document.createElement('button');sonarBtn.style.cssText='display:none;position:fixed;right:12px;bottom:175px;z-index:95;background:#163d57;color:white;padding:12px;border:1px solid #91eeff;border-radius:10px;font:700 12px system-ui';sonarBtn.textContent='📡 SONAR';document.body.appendChild(sonarBtn);
const SONAR_KEY='semnome.sonar.unlocked.v1';
let sonarUnlocked=false;try{sonarUnlocked=localStorage.getItem(SONAR_KEY)==='true'}catch{}
let sonarUntil=0,sonarReady=0,subEmpUntil=0;
sonarBtn.onclick=()=>{const t=clock.elapsedTime;if(t<sonarReady||(mission.stage<16&&!sonarUnlocked))return;sonarUntil=t+7;sonarReady=t+16;notifyCombat('SONAR ATIVO · CONTATO REVELADO',3);};
function clearSubShots(){for(const p of subShots)scene.remove(p.mesh);subShots.length=0}
function startSubHunt(){
 if(mission.stage!==14)return;
 mission.stage=15;mission.finished=false;mission.subX=x-240;mission.subZ=z-170;mission.subHp=1200;mission.subScan=0;mission.subPhaseAt=clock.elapsedTime;
 subPrompt.style.display='none';saveCheckpoint();notifyCombat('INVESTIGUE O ÚLTIMO SINAL',4);
}
subPrompt.querySelector('button').onclick=startSubHunt;
function fireSubShot(t,missile){
 const origin=new THREE.Vector3(mission.subX,height(mission.subX,mission.subZ,t)+3,mission.subZ);
 const mesh=new THREE.Mesh(subShotGeo,subShotMat);mesh.position.copy(origin);scene.add(mesh);
 const aim=new THREE.Vector3(x+hullPhysics.vx*.6,bob+3,z+hullPhysics.vz*.6).sub(origin).normalize().multiplyScalar(missile?145:100);
 subShots.push({mesh,velocity:aim,life:5,turn:missile?.45:1.3,damage:missile?20:15});
}
function updateSubHunt(dt,t){
 submarine.visible=mission.stage>=15&&mission.stage<=18&&!mission.failed;
 sonarBtn.style.display=(mission.stage>=16&&mission.stage<=18)||sonarUnlocked?'block':'none';
 sonarBtn.disabled=t<sonarReady;
 if(!submarine.visible){clearSubShots();return}
 const d=Math.hypot(x-mission.subX,z-mission.subZ),low=mission.subHp<380;
 // Alternância nítida: 9s submerso, 9s acima da superfície em cada ciclo.
 const cycle=((t-mission.subPhaseAt)%18+18)%18;
 const dive=mission.stage===15?false:(cycle<9&&t>=sonarUntil);
 const surfaceY=height(mission.subX,mission.subZ,t);
 const targetY=surfaceY+(dive?-18:9);
 const flank=Math.atan2(z-mission.subZ,x-mission.subX)+Math.PI/2;
 // Intercepta, flanqueia, evita aproximação perigosa e se afasta quando avariado.
 const offset=low?270:d<105?220:140;
 const tx=x+Math.cos(flank)*100+(mission.subX-x)/(d||1)*offset;
 const tz=z+Math.sin(flank)*100+(mission.subZ-z)/(d||1)*offset;
 const dx=tx-mission.subX,dz=tz-mission.subZ,len=Math.hypot(dx,dz)||1;
 const v=low?42:dive?34:27;
 // Durante a investigação o contato fica acessível: não foge antes de o jogador encontrá-lo.
 if(mission.stage!==15){mission.subX+=dx/len*Math.min(v*dt,len);mission.subZ+=dz/len*Math.min(v*dt,len);}
 submarine.position.set(mission.subX,THREE.MathUtils.lerp(Number.isFinite(submarine.position.y)&&submarine.position.y!==0?submarine.position.y:targetY,targetY,Math.min(1,dt*2.4)),mission.subZ);
 submarine.rotation.y=Math.atan2(-dx,-dz);
 if(mission.stage>=16&&d<400&&t>=mission.subNextAttack&&playerCombat.hp>0){
  const missile=d>170&&Math.hypot(hullPhysics.vx,hullPhysics.vz)>22;
  if(!dive||!missile)fireSubShot(t,missile);
  mission.subNextAttack=t+(low?3.3:5.1);
  if(d<145&&t>subEmpUntil+22){subEmpUntil=t+4;notifyCombat('⚡ INTERFERÊNCIA NO PROPULSOR · 4s',3);}
 }
 for(let i=subShots.length-1;i>=0;i--){
  const p=subShots[i];p.life-=dt;
  const aim=new THREE.Vector3(x,bob+3,z).sub(p.mesh.position).normalize().multiplyScalar(p.velocity.length());
  p.velocity.lerp(aim,Math.min(1,p.turn*dt));p.mesh.position.addScaledVector(p.velocity,dt);
  const hit=Math.hypot(p.mesh.position.x-x,p.mesh.position.z-z)<10&&Math.abs(p.mesh.position.y-(bob+3))<12;
  if(hit&&t>=shieldUntil&&t>=playerCombat.invulnerableUntil){playerCombat.hp=Math.max(0,playerCombat.hp-p.damage*(1-economy.armor*.05));playerCombat.invulnerableUntil=t+.45;playerCombat.lastDamageAt=t;energyFlash(p.mesh.position);}
  if(hit||p.life<=0){scene.remove(p.mesh);subShots.splice(i,1);}
 }
}
const signalShip=createWarMachine3D(THREE,{enemy:false});signalShip.scale.multiplyScalar(1.17);signalShip.visible=false;scene.add(signalShip);
const signalData=new THREE.Mesh(new THREE.OctahedronGeometry(3,1),new THREE.MeshBasicMaterial({color:0x7dfaff}));
signalData.visible=false;scene.add(signalData);
const rewardKey='semnome.unlockedShips.v1';
let unlockedShips={};try{unlockedShips=JSON.parse(localStorage.getItem(rewardKey)||'{}')||{}}catch{}
const shipSelect=document.createElement('button');shipSelect.style.cssText='display:none;position:fixed;bottom:68px;left:50%;transform:translateX(-50%);z-index:95;padding:12px;background:#103c61;color:white;border:1px solid #94e8ff;border-radius:12px;font:700 12px system-ui';document.body.appendChild(shipSelect);
function refreshShipSelect(){const equipped=unlockedShips.selected==='signal';shipSelect.style.display=unlockedShips.signal&&!equipped?'block':'none';shipSelect.textContent='🚢 Equipar nave Sinal Perdido';ship.scale.setScalar(equipped?1.28:1.17);signalHull.visible=equipped;}
shipSelect.onclick=()=>{if(!unlockedShips.signal)return;unlockedShips.selected='signal';try{localStorage.setItem(rewardKey,JSON.stringify(unlockedShips))}catch{}refreshShipSelect();notifyCombat('NOVA NAVE EQUIPADA',2);};
refreshShipSelect();
const basePrompt=document.createElement('div');
basePrompt.style.cssText='display:none;position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:170;width:min(385px,88vw);padding:18px;background:#092d42ef;border:1px solid #75cdf7;border-radius:15px;color:white;text-align:center;font:600 14px system-ui';
basePrompt.innerHTML='<strong>🛰 ORIGEM DO SINAL LOCALIZADA</strong><p>Os dados revelam uma instalação inimiga. Melhore sua nave e prepare o ataque.</p><button style="padding:12px 24px;border:0;border-radius:9px;background:#92e8ff;color:#06233b;font-weight:800">INICIAR OPERAÇÃO</button>';document.body.appendChild(basePrompt);
const baseHealthHud=document.createElement('div');
baseHealthHud.style.cssText='display:none;position:fixed;top:75px;left:50%;transform:translateX(-50%);z-index:87;padding:6px 14px;border-radius:9px;border:1px solid #ffae70;background:#172130dd;color:white;font:700 13px system-ui;pointer-events:none';
document.body.appendChild(baseHealthHud);
const baseTurrets=[];
const baseShells=[];
const baseShellGeometry=new THREE.SphereGeometry(1.65,8,6);
const baseShellMaterial=new THREE.MeshBasicMaterial({color:0xff9362});
function clearBaseShells(){for(const p of baseShells)scene.remove(p.mesh);baseShells.length=0}
function updateBaseShells(dt,t){
 for(let i=baseShells.length-1;i>=0;i--){
  const p=baseShells[i];p.life-=dt;
  p.mesh.position.addScaledVector(p.velocity,dt);
  const hit=playerCombat.hp>0&&Math.hypot(p.mesh.position.x-x,p.mesh.position.z-z)<9&&Math.abs(p.mesh.position.y-(bob+2))<11;
  if(hit&&t>=shieldUntil&&t>=playerCombat.invulnerableUntil){
   playerCombat.hp=Math.max(0,playerCombat.hp-12*(1-economy.armor*.05));
   playerCombat.lastDamageAt=t;playerCombat.invulnerableUntil=t+.5;energyFlash(p.mesh.position);
  }
  if(hit||p.life<=0||mission.stage<10||mission.stage>11||mission.baseDestroyed){
   scene.remove(p.mesh);baseShells.splice(i,1);
  }
 }
}

const baseStructure=new THREE.Group();scene.add(baseStructure);baseStructure.visible=false;
const baseMetal=new THREE.MeshStandardMaterial({color:0x344b65,metalness:.7,roughness:.36});
const baseGlow=new THREE.MeshBasicMaterial({color:0x44cfff});
for(let i=0;i<5;i++){
 const angle=i*Math.PI*2/5;
 const tower=new THREE.Mesh(new THREE.CylinderGeometry(7,11,34,8),baseMetal);
 tower.position.set(Math.sin(angle)*45,17,Math.cos(angle)*45);baseStructure.add(tower);
 const turret=new THREE.Group();turret.position.set(tower.position.x,35,tower.position.z);
 const barrel=new THREE.Mesh(new THREE.BoxGeometry(3,3,13),baseMetal);barrel.position.z=-7;turret.add(barrel);baseStructure.add(turret);baseTurrets.push(turret);
 const beacon=new THREE.Mesh(new THREE.SphereGeometry(3,8,8),baseGlow);beacon.position.set(tower.position.x,36,tower.position.z);baseStructure.add(beacon);
}
const baseDeck=new THREE.Mesh(new THREE.CylinderGeometry(52,60,9,10),baseMetal);baseDeck.position.y=5;baseStructure.add(baseDeck);
function spawnBaseForce(bossOnly,t){
 const selected=enemies.filter(e=>e.baseEnemy&&Boolean(e.boss)===bossOnly);
 selected.forEach((e,i)=>{
  const a=i*Math.PI*2/3+.4,dist=bossOnly?220:125;
  e.x=mission.baseX+Math.cos(a)*dist;e.z=mission.baseZ+Math.sin(a)*dist;
  e.anchorX=e.x;e.anchorZ=e.z;e.y=height(e.x,e.z,t)+1;e.previousX=e.x;e.previousZ=e.z;
  e.maxHp=e.boss?1100:130;e.hp=e.maxHp;
  if(e.boss)e.model.scale.setScalar(1.75);e.heading=Math.atan2(x-e.x,z-e.z);
  e.dormant=false;e.state='pursuit';e.ai.intent='pursuit';e.ai.plan=null;e.ai.nextPlanTime=0;
  e.ai.body.x=e.x;e.ai.body.z=e.z;e.ai.body.vx=0;e.ai.body.vz=0;
  e.model.visible=true;e.model.position.set(e.x,e.y,e.z);
 });
}
function launchExtractionWave(wave,t){
 const target=enemies.filter(e=>e.extractionWave===wave);
 target.forEach((e,i)=>{
  const bearing=heading+(i===0?-.62:.62),distance=145+i*38;
  e.x=x-Math.sin(bearing)*distance;e.z=z-Math.cos(bearing)*distance;
  // Reposiciona se houver estruturas entre o spawn e a área de navegação.
  for(let tries=0;tries<6&&horizon.colliders.some(o=>Math.hypot(e.x-o.x,e.z-o.z)<o.radius+22);tries++){
   const a=bearing+(tries+1)*.45;
   e.x=x-Math.sin(a)*distance;e.z=z-Math.cos(a)*distance;
  }
  e.anchorX=e.x;e.anchorZ=e.z;e.y=height(e.x,e.z,t)+1;
  e.previousX=e.x;e.previousZ=e.z;e.heading=Math.atan2(x-e.x,z-e.z);
  e.maxHp=135;e.hp=e.maxHp;e.dormant=false;e.state='pursuit';
  e.ai.body.x=e.x;e.ai.body.z=e.z;e.ai.body.vx=0;e.ai.body.vz=0;
  e.ai.plan={goalX:x,goalZ:z,active:true,state:'attack',intent:'pursuit',speed:48};e.ai.nextPlanTime=0;e.ai.intent='pursuit';e.ai.lastCombatAt=t;
  e.model.position.set(e.x,e.y,e.z);e.model.visible=true;
 });
 notifyCombat('⚠ EMBOSCADA NA EXTRAÇÃO · 2 CAÇADORES',3);
}
function beginBaseMission(){
 if(mission.stage!==9)return;
 mission.stage=10;mission.finished=false;mission.calmSea=false;mission.shopClosed=true;
 merchantPanel.style.display='none';basePrompt.style.display='none';merchantShip.visible=false;
 mission.recon=0;mission.defensesDown=0;mission.baseHits=0;mission.baseDestroyed=false;mission.towerNextShot=0;saveCheckpoint();
 notifyCombat('ORIGEM DO SINAL · RECONHEÇA A INSTALAÇÃO',4);
}
basePrompt.querySelector('button').onclick=beginBaseMission;
const signalPrompt=document.createElement('div');
signalPrompt.style.cssText='display:none;position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:170;width:min(370px,88vw);padding:18px;background:#092d42ed;border:1px solid #75cdf7;border-radius:15px;color:#fff;text-align:center;font:600 14px system-ui';
signalPrompt.innerHTML='<strong>📡 SINAL DESCONHECIDO DETECTADO</strong><p>Uma transmissão de socorro foi localizada em outro setor oceânico.</p><button type="button" style="border:0;border-radius:9px;background:#92e8ff;color:#06233b;padding:12px 28px;font-weight:800">CHECAR</button>';document.body.appendChild(signalPrompt);
const oceanLoading=document.createElement('div');oceanLoading.style.cssText='display:none;position:fixed;inset:0;z-index:250;background:linear-gradient(#010411,#092142);color:white;align-items:center;justify-content:center;flex-direction:column;font:700 17px system-ui;gap:16px';
oceanLoading.innerHTML='<div style="font-size:40px">🌙</div><div>RUMO AO OCEANO NOTURNO</div><div style="font-size:12px;font-weight:400">Localizando sinal e preparando a travessia...</div>';document.body.appendChild(oceanLoading);
function activateSignalAmbush(t){
 for(let i=0;i<6;i++){
  const e=enemies.find(a=>a.signalEnemy&&a.id===signalEnemyIds[i]);if(!e)continue;
  const angle=i*Math.PI/3+.25,rad=230+(i%2)*100;
  e.x=mission.signalX+Math.cos(angle)*rad;e.z=mission.signalZ+Math.sin(angle)*rad;
  e.anchorX=e.x;e.anchorZ=e.z;e.y=height(e.x,e.z,t)+1;
  e.heading=Math.atan2(x-e.x,z-e.z);e.previousX=e.x;e.previousZ=e.z;
  e.maxHp=i>=4?150:COMBAT.npcMaxHp;e.hp=e.maxHp;e.dormant=false;e.state='pursuit';
  e.ai.body.x=e.x;e.ai.body.z=e.z;e.ai.body.vx=0;e.ai.body.vz=0;e.ai.plan=null;e.ai.nextPlanTime=0;e.ai.intent='pursuit';
  e.model.visible=true;e.model.position.set(e.x,e.y,e.z);
 }
}
const signalEnemyIds=enemies.filter(e=>e.signalEnemy).map(e=>e.id);
function beginSignal(){
 if(mission.stage!==4)return;
 signalPrompt.style.display='none';merchantPanel.style.display='none';oceanLoading.style.display='flex';
 requestAnimationFrame(()=>setTimeout(()=>{
  mission.stage=5;mission.finished=false;mission.calmSea=false;mission.shopClosed=true;signalPrompt.style.display='none';
  x=mission.signalX-1200;z=mission.signalZ;heading=-Math.PI/2;speed=0;
  hullPhysics.x=x;hullPhysics.z=z;hullPhysics.vx=0;hullPhysics.vz=0;
  for(const e of enemies){if(e.signalEnemy)continue;e.hp=0;e.model.visible=false;}
  signalShip.visible=true;signalShip.position.set(mission.signalX,1,mission.signalZ);
  mission.scan=0;mission.allyHp=100;mission.signalKills=0;
  applyOceanRegion();saveCheckpoint();oceanLoading.style.display='none';
  notifyCombat('SINAL PERDIDO · INVESTIGUE A EMBARCAÇÃO',4);
 },1100));
}
signalPrompt.querySelector('button').onclick=beginSignal;
const receiver=createWarMachine3D(THREE,{enemy:false});receiver.scale.multiplyScalar(1.05);
receiver.position.set(mission.deliveryX,0,mission.deliveryZ);
receiver.rotation.y=Math.PI/2;receiver.visible=false;
scene.add(receiver);
function activateInterceptors(){
 for(const enemy of enemies){
  if(!enemy.dormant||enemy.waveDistance||enemy.signalEnemy||enemy.baseEnemy||enemy.extractionWave!==undefined||enemy.clearAreaWave!==undefined)continue;
  enemy.dormant=false;enemy.hp=enemy.maxHp;enemy.state='pursuit';
  enemy.ai.nextPlanTime=0;enemy.ai.choice=null;enemy.ai.plan=null;
  enemy.ai.lastCombatAt=clock.elapsedTime;
 }
}
const activatedWaves=new Set();
function updateReinforcementWaves(distance){
 if(mission.stage!==1||mission.finished||mission.failed)return;
 for(const wave of reinforcementWaves){
  if(distance>wave.at||activatedWaves.has(wave.at))continue;
  activatedWaves.add(wave.at);
  for(const enemy of enemies){
   if(enemy.waveDistance!==wave.at||!enemy.dormant)continue;
   enemy.dormant=false;enemy.hp=enemy.maxHp;enemy.state='pursuit';
   enemy.ai.nextPlanTime=0;enemy.ai.choice=null;enemy.ai.plan=null;
   enemy.ai.lastCombatAt=clock.elapsedTime;
  }
  notifyCombat('⚠ REFORÇOS INIMIGOS · '+wave.positions.length+' NAVES!',4);
 }
}
const cargo=new THREE.Group();
const cargoBox=new THREE.Mesh(new THREE.BoxGeometry(14,8,11),new THREE.MeshStandardMaterial({color:0xd3a348,metalness:.5,roughness:.42}));
const cargoBands=new THREE.Mesh(new THREE.BoxGeometry(15,1.3,12),new THREE.MeshStandardMaterial({color:0x172e3a,metalness:.65,roughness:.3}));
cargo.add(cargoBox,cargoBands);scene.add(cargo);
const cargoBeacon=new THREE.PointLight(0x48f3ff,3,85);cargoBeacon.position.y=12;cargo.add(cargoBeacon);
const missionOverlay=document.createElement('div');
missionOverlay.id='missionOverlay';
missionOverlay.style.cssText='display:none;position:fixed;inset:0;z-index:220;background:#061523e8;align-items:center;justify-content:center;color:white;font-family:system-ui;text-align:center;padding:20px';
missionOverlay.innerHTML='<div style="max-width:420px;background:#102d44;border:2px solid #ff7575;border-radius:18px;padding:28px"><h2 style="margin:0 0 12px">MISSÃO FRACASSADA</h2><p>Sua nave foi destruída antes de recuperar a carga.</p><button id="retryMission" style="background:#ffd262;color:#10202c;border:0;border-radius:12px;padding:14px 24px;font-weight:800;font-size:17px;cursor:pointer">↻ Tentar novamente</button></div>';
document.body.appendChild(missionOverlay);
missionOverlay.querySelector('#retryMission').addEventListener('click',()=>restartCheckpoint());
const missionHud=document.createElement('div');missionHud.id='missionHud';
missionHud.style.cssText='position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:87;pointer-events:none;background:#0b223bdd;border:1px solid #5db8d2;border-radius:10px;padding:5px 9px;color:#fff;font:600 11px system-ui;text-align:center;max-width:58vw;text-shadow:0 1px 2px #000';
document.body.appendChild(missionHud);
const missionMarker=new THREE.Mesh(new THREE.ConeGeometry(5,13,6),new THREE.MeshBasicMaterial({color:0xffe57e,transparent:true,opacity:.9}));
missionMarker.rotation.x=Math.PI;scene.add(missionMarker);
// Checkpoints persistem na partida sem recarregar a página.
let checkpoint=null;
const CHECKPOINT_KEY='semnome.mission.checkpoint.v2';
function saveCheckpoint(){
 checkpoint={x,z,heading,mission:{...mission},waves:[...activatedWaves],
  enemies:enemies.map(e=>({x:e.x,z:e.z,heading:e.heading,hp:e.hp,maxHp:e.maxHp,dormant:e.dormant,state:e.state}))};
 try{localStorage.setItem(CHECKPOINT_KEY,JSON.stringify(checkpoint))}catch{}
}
function restartCheckpoint(){
 if(!checkpoint)return;
 const cp=checkpoint,t=clock.elapsedTime;
 Object.assign(mission,cp.mission,{failed:false,finished:false});
 missionOverlay.style.display='none';merchantPanel.style.display='none';
 energyBlackoutUntil=0;
 x=cp.x;z=cp.z;heading=cp.heading;speed=0;boostActive=false;boostUseRemaining=0;boostEnergy=1;
 hullPhysics.x=x;hullPhysics.z=z;hullPhysics.vx=0;hullPhysics.vz=0;
 playerCombat.hp=playerMaxHp();playerCombat.respawnAt=0;playerCombat.invulnerableUntil=t+2;ship.visible=true;
 lockedNpc=null;attackCamera.phase='idle';attackCamera.shot=null;attackCamera.blend=0;
 activatedWaves.clear();for(const key of cp.waves)activatedWaves.add(key);
 enemies.forEach((e,i)=>{
  Object.assign(e,cp.enemies[i]);e.previousX=e.x;e.previousZ=e.z;e.vx=0;e.vz=0;
  e.lastCombatAt=t;e.nextRegenAt=t+75;e.stunnedUntil=0;
  e.ai.body.x=e.x;e.ai.body.z=e.z;e.ai.body.vx=0;e.ai.body.vz=0;
  e.ai.plan=null;e.ai.nextPlanTime=0;e.ai.weaponReadyAt={};e.ai.choice=null;e.ai.trackedShot=null;
  e.model.visible=e.hp>0;
 });
 clearBaseShells();
 for(const shot of enemyShots)discardEnemyShot(shot);enemyShots.length=0;
 for(const p of projectiles){scene.remove(p.mesh,p.trail);p.trail?.geometry?.dispose();}
 projectiles.length=0;
 for(const mine of mines)scene.remove(mine.mesh);mines.length=0;
 for(const mine of enemyMines){scene.remove(mine.mesh);mine.mesh.material.dispose()}enemyMines.length=0;nextEnemyMine=0;
 for(const d of damageLabels)d.label.remove();damageLabels.length=0;
 merchantAccess.style.display=mission.calmSea&&!mission.shopClosed?'block':'none';
 if(mission.stage===2)mission.transitionAt=t+30;
 if(mission.stage===13){
  // Checkpoints antigos (extração de ~770 m) não têm rota nem gatilhos válidos.
  const startValid=Number.isFinite(mission.extractionStartX)&&Number.isFinite(mission.extractionStartZ);
  const routeLen=startValid?Math.hypot(mission.extractionX-mission.extractionStartX,mission.extractionZ-mission.extractionStartZ):0;
  if(routeLen<2300||routeLen>2800){
   mission.extractionStartX=x;mission.extractionStartZ=z;
   mission.extractionX=x-2450;mission.extractionZ=z+650;
   mission.extractionDistance=0;mission.extractionNextWave=1;
   saveCheckpoint();
  }
  mission.extractionLastX=x;mission.extractionLastZ=z;
  // Checkpoint de extração sempre reinicia o encontro; inimigos não são herdados de partidas anteriores.
  for(const e of enemies.filter(e=>e.extractionWave!==undefined)){e.hp=0;e.dormant=true;e.model.visible=false;}
  mission.extractionDistance=0;mission.extractionNextWave=1;
 }
 if(mission.stage===4)signalPrompt.style.display='block';
 if(mission.stage===14)subPrompt.style.display='block';
 if(mission.stage>=15&&mission.stage<=18){mission.subPhaseAt=t;mission.subNextAttack=t+5;mission.subSurviveUntil=t+120;sonarReady=0;clearSubShots();}
 if(mission.stage===9)basePrompt.style.display='block';
 if(mission.stage>=10){baseStructure.visible=true;baseStructure.position.set(mission.baseX,height(mission.baseX,mission.baseZ,t),mission.baseZ);if(mission.stage===11)spawnBaseForce(false,t);if(mission.stage===12)spawnBaseForce(true,t);}
 if(mission.stage>=5){signalShip.visible=true;signalShip.position.set(mission.signalX,height(mission.signalX,mission.signalZ,t)+1,mission.signalZ);if(mission.stage===7){mission.defendUntil=t+90;mission.allyHp=100;activateSignalAmbush(t);}}
 applyOceanRegion();
 if(mission.stage===4){merchantShip.position.set((mission.shopX??x)+55,height((mission.shopX??x)+55,(mission.shopZ??z)+35,t)+1,(mission.shopZ??z)+35);merchantShip.visible=!mission.shopClosed;}
 if(mission.stage===3){
  // Restaura o INÍCIO da missão, nunca o estado parcial incompatível da IA.
  mission.clearDestroyed=0;mission.clearWave=0;
  for(const e of enemies){if(e.clearAreaWave===undefined)continue;e.hp=0;e.dormant=true;e.model.visible=false;}
  launchClearWave(0,t);
 }
 refreshPlayerHealth();notifyCombat('CHECKPOINT RESTAURADO',2);
}
function launchClearWave(wave,t){
 mission.clearWave=wave;
 let index=0;
 for(const enemy of enemies){
  if(enemy.clearAreaWave!==wave)continue;
  // Distribuição circular em até 500m, evitando obstáculos e surgimento sobre a nave.
  const count=wave===2?4:3;
  const angle=(Math.PI*2*(index+.24*(wave%2))/count)+wave*.53;
  const radius=270+(index%3)*92;
  let sx=x+Math.cos(angle)*radius,sz=z+Math.sin(angle)*radius;
  for(let attempt=0;attempt<8;attempt++){
   const blocked=horizon.colliders.some(o=>Math.hypot(sx-o.x,sz-o.z)<o.radius+24);
   if(!blocked)break;
   const adjusted=angle+(attempt+1)*.38;
   sx=x+Math.cos(adjusted)*radius;sz=z+Math.sin(adjusted)*radius;
  }
  index++;
  enemy.x=sx;enemy.z=sz;enemy.anchorX=enemy.x;enemy.anchorZ=enemy.z;
  enemy.ai.body.x=enemy.x;enemy.ai.body.z=enemy.z;enemy.ai.body.vx=0;enemy.ai.body.vz=0;
  enemy.vx=0;enemy.vz=0;enemy.heading=Math.atan2(x-enemy.x,z-enemy.z);
  enemy.dormant=false;enemy.maxHp=enemy.veteran?150:COMBAT.npcMaxHp;enemy.hp=enemy.maxHp;
  enemy.model.visible=true;
  enemy.model.position.set(enemy.x,height(enemy.x,enemy.z,t)+1,enemy.z);
  enemy.y=enemy.model.position.y;
  enemy.state='pursuit';enemy.ai.intent='pursuit';enemy.ai.plan=null;enemy.ai.nextPlanTime=0;
  enemy.ai.weaponReadyAt={};enemy.ai.choice=null;enemy.stunnedUntil=0;
  enemy.ai.estimateVx=0;enemy.ai.estimateVz=0;
 }
 const active=enemies.filter(e=>e.clearAreaWave===wave&&e.hp>0&&!e.dormant).length;
 if(active!==(wave===2?4:3))console.error('Falha ao gerar onda',wave,active);
 notifyCombat('LIMPE A ÁREA · ONDA '+(wave+1)+'/3 · '+active+' NAVES',3);
}
function updateMission(dt,t){
 const {cargoX,cargoZ,deliveryX,deliveryZ}=mission;
 cargo.visible=mission.stage===0;
 if(mission.stage===0){
  cargo.position.set(cargoX,height(cargoX,cargoZ,t)+4,cargoZ);
  cargo.rotation.y=Math.sin(t*.6)*.04;
 }
 receiver.visible=mission.stage>=1&&mission.stage<5;
 if(receiver.visible)receiver.position.y=height(deliveryX,deliveryZ,t)+1;
 const targetX=mission.stage===0?cargoX:mission.stage>=10?mission.baseX:mission.stage>=5?mission.signalX:deliveryX,targetZ=mission.stage===0?cargoZ:mission.stage>=10?mission.baseZ:mission.stage>=5?mission.signalZ:deliveryZ;
 const distance=Math.hypot(x-targetX,z-targetZ);
 if(mission.stage===1)updateReinforcementWaves(distance);
 missionMarker.visible=(mission.stage<2||mission.stage===5||mission.stage===6||mission.stage===8||mission.stage===10)&&!mission.failed;
 missionMarker.position.set(targetX,height(targetX,targetZ,t)+24+Math.sin(t*2)*2,targetZ);
 if(!mission.failed&&playerCombat.hp<=0){
  mission.failed=true;missionOverlay.style.display='flex';
  notifyCombat('MISSÃO FRACASSADA · NAVE DESTRUÍDA',4);
 }
 if(!mission.failed){
  if(mission.stage===0&&distance<18){
   mission.stage=1;cargo.visible=false;receiver.visible=true;activateInterceptors();
   saveCheckpoint();
   notifyCombat('CARGA RECUPERADA · ENTREGUE À NAVE ALIADA',3);
  }else if(mission.stage===1&&distance<35){
   mission.stage=2;mission.finished=false;mission.calmSea=true;mission.shopClosed=false;mission.shopX=deliveryX;mission.shopZ=deliveryZ;mission.transitionAt=t+30;
   merchantShip.position.set(deliveryX+70,height(deliveryX+70,deliveryZ+60,t)+1,deliveryZ+60);
   merchantShip.visible=true;
   notifyCombat('CARGA ENTREGUE · LOJA DISPONÍVEL',2.5);
  }else if(mission.stage===2&&t>=mission.transitionAt){
   mission.stage=3;mission.clearDestroyed=0;launchClearWave(0,t);saveCheckpoint();
  }else if(mission.stage===3){
   const wave=Math.max(0,Math.min(2,mission.clearWave));
   const current=enemies.filter(e=>e.clearAreaWave===wave);
   const alive=current.filter(e=>e.hp>0&&!e.dormant).length;
   const defeated=current.filter(e=>e.hp<=0&&!e.dormant).length;
   const expected=wave===2?4:3;
   // Checkpoints legados não podem marcar uma onda vazia como concluída.
   if(alive===0&&defeated===0)launchClearWave(wave,t);
   else if(alive===0&&defeated===expected&&wave<2)launchClearWave(wave+1,t);
   else if(alive===0&&defeated===expected&&wave===2){
    mission.clearDestroyed=10;mission.stage=4;mission.finished=true;mission.calmSea=true;mission.shopClosed=false;mission.shopX=x;mission.shopZ=z;
    merchantShip.position.set(x+55,height(x+55,z+35,t)+1,z+35);merchantShip.visible=true;
    saveCheckpoint();signalPrompt.style.display='block';notifyCombat('ÁREA LIMPA · LOJA DE MELHORIAS DISPONÍVEL',4);
   }
  }else if(mission.stage===5&&distance<60){
   mission.stage=6;mission.scan=0;notifyCombat('MANTENHA A POSIÇÃO · VARREDURA 10s',3);
  }else if(mission.stage===6){
   mission.scan=distance<60?Math.min(10,mission.scan+dt):Math.max(0,mission.scan-dt*.5);
   if(mission.scan>=10){
    mission.stage=7;mission.defendUntil=t+90;mission.allyHp=100;
    activateSignalAmbush(t);saveCheckpoint();notifyCombat('EMBOSCADA! PROTEJA A EMBARCAÇÃO',5);
   }
  }else if(mission.stage===7){
   signalShip.position.y=height(mission.signalX,mission.signalZ,t)+1;
   const attackers=enemies.filter(e=>e.signalEnemy&&e.hp>0);
   for(const e of attackers)if(Math.hypot(e.x-mission.signalX,e.z-mission.signalZ)<175)mission.allyHp=Math.max(0,mission.allyHp-dt*(e.veteran?1.3:.65));
   if(mission.allyHp<=0){mission.failed=true;missionOverlay.style.display='flex';notifyCombat('EMBARCAÇÃO DESTRUÍDA · MISSÃO FRACASSADA',5);}
   else if(t>=mission.defendUntil){
    mission.stage=8;for(const e of attackers){e.hp=0;e.model.visible=false;}
    signalData.visible=true;saveCheckpoint();notifyCombat('DEFESA CONCLUÍDA · RECOLHA OS DADOS',4);
   }
  }else if(mission.stage===8&&distance<35){
   mission.stage=9;mission.finished=true;signalData.visible=false;
   mission.calmSea=true;mission.shopClosed=false;mission.shopX=x;mission.shopZ=z;
   merchantShip.position.set(x+55,height(x+55,z+35,t)+1,z+35);merchantShip.visible=true;
   basePrompt.style.display='block';
   unlockedShips.signal=true;unlockedShips.selected='signal';economy.scrap+=150;saveEconomy();
   pickupInventory.shield=Math.min(9,pickupInventory.shield+2);pickupInventory.boost=Math.min(9,pickupInventory.boost+1);updatePickupButtons();
   try{localStorage.setItem(rewardKey,JSON.stringify(unlockedShips))}catch{}
   refreshShipSelect();saveCheckpoint();notifyCombat('SINAL PERDIDO CONCLUÍDO · NAVE DESBLOQUEADA!',7);
  }else if(mission.stage===10){
   const d=Math.hypot(x-mission.baseX,z-mission.baseZ);
   mission.recon=d<260?Math.min(12,mission.recon+dt):Math.max(0,mission.recon-dt*.3);
   if(mission.recon>=12){mission.stage=11;spawnBaseForce(false,t);saveCheckpoint();notifyCombat('BASE LOCALIZADA · DESTRUA AS SENTINELAS',4);}
  }else if(mission.stage===11){
   const guards=enemies.filter(e=>e.baseEnemy&&!e.boss);
   mission.defensesDown=guards.filter(e=>e.hp<=0&&!e.dormant).length;
   if(mission.defensesDown===3&&mission.baseDestroyed){mission.stage=12;spawnBaseForce(true,t);saveCheckpoint();notifyCombat('COMANDANTE INIMIGO DETECTADO!',5);}
  }else if(mission.stage===12){
   const boss=enemies.find(e=>e.baseEnemy&&e.boss);
   if(boss&&boss.hp<=0&&!boss.dormant){
    mission.stage=13;mission.finished=false;
    // Extração longa, criando espaço para três encontros a cada 750 metros.
    mission.extractionStartX=x;mission.extractionStartZ=z;
    mission.extractionX=x-2450;mission.extractionZ=z+650;
    mission.extractionDistance=0;mission.extractionNextWave=1;mission.extractionLastX=x;mission.extractionLastZ=z;
    saveCheckpoint();
    notifyCombat('COMANDANTE DERROTADO · RETORNE AO PONTO DE EXTRAÇÃO',5);
   }
  }else if(mission.stage===15){
   if(Math.hypot(x-mission.subX,z-mission.subZ)<145){mission.stage=16;mission.subSurviveUntil=t+120;mission.subPhaseAt=t;mission.subNextAttack=t+4;saveCheckpoint();notifyCombat('SUBMARINO DETECTADO · SOBREVIVA 120s',4);}
  }else if(mission.stage===16){
   if(t>=mission.subSurviveUntil){mission.stage=17;mission.subScan=0;saveCheckpoint();notifyCombat('ATIVE O SONAR E FAÇA A VARREDURA',3);}
  }else if(mission.stage===17){
   if(t<sonarUntil){mission.subScan+=dt;if(mission.subScan>=5){mission.stage=18;mission.subPhaseAt=t;saveCheckpoint();notifyCombat('ALVO LOCALIZADO · ATIRE QUANDO EMERGIR',4);}}
  }else if(mission.stage===18){
   if(mission.subHp<=0){mission.stage=19;mission.finished=true;economy.scrap+=500;sonarUnlocked=true;try{localStorage.setItem(SONAR_KEY,'true')}catch{}saveEconomy();saveCheckpoint();notifyCombat('SUBMARINO DESTRUÍDO · SONAR DESBLOQUEADO · +500 SUCATAS',6);}
  }else if(mission.stage===13){
   // Progresso ao longo da rota, evitando gatilhos inconsistentes por curvas ou checkpoint.
   const routeX=mission.extractionX-mission.extractionStartX,routeZ=mission.extractionZ-mission.extractionStartZ;
   const routeLength=Math.hypot(routeX,routeZ)||1;
   const along=((x-mission.extractionStartX)*routeX+(z-mission.extractionStartZ)*routeZ)/routeLength;
   mission.extractionDistance=Math.max(mission.extractionDistance||0,Math.max(0,along));
   mission.extractionLastX=x;mission.extractionLastZ=z;
   while(mission.extractionNextWave<=3&&mission.extractionDistance>=mission.extractionNextWave*750){
    launchExtractionWave(mission.extractionNextWave-1,t);
    mission.extractionNextWave++;
   }
   const hunters=enemies.some(e=>e.extractionWave!==undefined&&e.hp>0);
   if(Math.hypot(x-mission.extractionX,z-mission.extractionZ)<50&&!hunters&&mission.extractionNextWave>3){
    mission.stage=14;mission.finished=true;economy.scrap+=300;saveEconomy();saveCheckpoint();
    subPrompt.style.display='block';notifyCombat('OPERAÇÃO CONCLUÍDA · +300 SUCATA · RETORNO SEGURO',6);
   }
  }
 }
 if(mission.calmSea&&!mission.shopClosed&&Math.hypot(x-(mission.shopX??deliveryX),z-(mission.shopZ??deliveryZ))>200){
  mission.shopClosed=true;merchantPanel.style.display='none';merchantShip.visible=false;
 }
 merchantAccess.style.display=mission.calmSea&&!mission.shopClosed&&!mission.failed?'block':'none';
 signalPrompt.style.display=mission.stage===4&&!mission.failed?'block':'none';
 basePrompt.style.display=mission.stage===9&&!mission.failed?'block':'none';
 baseStructure.visible=mission.stage>=10;
 if(baseStructure.visible)baseStructure.position.set(mission.baseX,height(mission.baseX,mission.baseZ,t),mission.baseZ);
 updateBaseShells(dt,t);
 baseHealthHud.style.display=mission.stage===11&&!mission.failed?'block':'none';
 if(mission.stage===11)baseHealthHud.textContent='🏰 BASE · '+mission.baseHits+'/5 ACERTOS';
 for(const turret of baseTurrets){
  turret.lookAt(x-baseStructure.position.x,3,z-baseStructure.position.z);
  turret.rotation.x=0;turret.rotation.z=0;
  turret.visible=mission.stage>=10&&!mission.baseDestroyed;
 }
 if(mission.stage>=10&&mission.stage<=11&&!mission.baseDestroyed&&!mission.failed&&playerCombat.hp>0){
  const distanceToBase=Math.hypot(x-mission.baseX,z-mission.baseZ);
  if(distanceToBase<420&&t>=mission.towerNextShot){
   mission.towerNextShot=t+1.55;
   // Projétil físico: aponta para a posição atual; pode errar se o jogador manobrar.
   const turret=baseTurrets[Math.floor(t*1.7)%baseTurrets.length];
   const origin=new THREE.Vector3(mission.baseX+turret.position.x,height(mission.baseX,mission.baseZ,t)+turret.position.y,mission.baseZ+turret.position.z);
   const destination=new THREE.Vector3(x,bob+2,z);
   const direction=destination.sub(origin).normalize();
   const mesh=new THREE.Mesh(baseShellGeometry,baseShellMaterial);mesh.position.copy(origin);scene.add(mesh);
   baseShells.push({mesh,velocity:direction.multiplyScalar(115),life:4.5});
   notifyCombat('⚠ TORRES DA BASE · DISPARO!',1);
  }
 }
 if(mission.stage>=5){signalShip.visible=true;signalShip.position.set(mission.signalX,height(mission.signalX,mission.signalZ,t)+1,mission.signalZ);signalData.visible=mission.stage===8;if(signalData.visible)signalData.position.set(mission.signalX+12,height(mission.signalX+12,mission.signalZ+10,t)+4,mission.signalZ+10);}
 if(mission.stage===2&&merchantPanel.style.display==='flex'&&t>=mission.transitionAt)merchantPanel.style.display='none';
 missionHud.textContent=mission.failed?'❌ MISSÃO FRACASSADA':
  mission.stage===0?'📦 RECUPERE A CARGA · '+Math.round(distance)+' m':
  mission.stage===1?'🚢 ENTREGUE A CARGA · '+Math.round(distance)+' m':
  mission.stage===2?'PRÓXIMA MISSÃO EM '+Math.max(0,Math.ceil(mission.transitionAt-t))+'s':
  mission.stage===3?'⚔ LIMPE A ÁREA · '+mission.clearDestroyed+'/10 · ONDA '+(mission.clearWave+1)+'/3':
  mission.stage===4?'✅ ÁREA LIMPA · LOJA DISPONÍVEL':
  mission.stage===5?'📡 SINAL PERDIDO · '+Math.round(distance)+' m':
  mission.stage===6?'📡 VARREDURA · '+Math.floor(mission.scan)+'/10s':
  mission.stage===7?'🛡 PROTEJA A NAVE · '+Math.ceil(mission.allyHp)+'% · '+Math.max(0,Math.ceil(mission.defendUntil-t))+'s':
  mission.stage===8?'📦 RECOLHA OS DADOS · '+Math.round(distance)+' m':
  mission.stage===9?'🛰 ORIGEM DO SINAL · LOJA DISPONÍVEL':
  mission.stage===10?'🛰 RECONHECIMENTO · '+Math.floor(mission.recon)+'/12s':
  mission.stage===11?'⚔ TORRES '+mission.baseHits+'/5 · SENTINELAS '+mission.defensesDown+'/3':
  mission.stage===15?'📡 ÚLTIMO SINAL · '+Math.round(Math.hypot(x-mission.subX,z-mission.subZ))+'m':
  mission.stage===16?'🌊 SOBREVIVA À CAÇADA · '+Math.max(0,Math.ceil(mission.subSurviveUntil-t))+'s':
  mission.stage===17?'📡 VARREDURA SONAR · '+Math.floor(mission.subScan)+'/5s':
  mission.stage===18?'⚔ SUBMARINO · '+Math.ceil(mission.subHp)+'/1200 HP':
  mission.stage===19?'✅ CAÇADA NAS PROFUNDEZAS CONCLUÍDA':
  mission.stage===12?'☠ DERROTE O COMANDANTE NAVAL':
  mission.stage===13?'🚢 EXTRAÇÃO · '+Math.round(Math.hypot(x-mission.extractionX,z-mission.extractionZ))+'m RESTANTES · '+Math.floor(mission.extractionDistance||0)+'m NA ROTA · ONDAS '+Math.min(3,mission.extractionNextWave-1)+'/3':'✅ OPERAÇÃO CONCLUÍDA';
}

function discardEnemyShot(shot){
 scene.remove(shot.mesh,shot.trail);
 shot.trail.geometry.dispose();
 shot.trailMat?.dispose();
 shot.coreMat?.dispose();
 shot.glowMat?.dispose();
 shot.plasma?.geometry.dispose();
 if(shot.warning){scene.remove(shot.warning);shot.warning.geometry.dispose();shot.warning.material.dispose();}
}
// Kits flutuantes disputados por todas as naves. Geometrias compartilhadas.
const REPAIR={interval:9.5,amount:25,max:10,lifetime:65,radius:11};
const repairKits=[];
const repairGeometry=new THREE.OctahedronGeometry(3.4,0);
const repairMaterial=new THREE.MeshBasicMaterial({color:0x42ff91});
const repairRingGeometry=new THREE.TorusGeometry(5.5,.55,6,16);
const repairRingMaterial=new THREE.MeshBasicMaterial({color:0xd6ffdf,transparent:true,opacity:.85});
let nextRepairSpawn=3.5;
function spawnRepairKit(now){
 if(repairKits.length>=REPAIR.max)return;
 for(let attempt=0;attempt<14;attempt++){
  const angle=Math.random()*Math.PI*2,distance=75+Math.random()*230;
  const sx=x+Math.cos(angle)*distance,sz=z+Math.sin(angle)*distance;
  if(horizon.colliders.some(o=>Math.hypot(sx-o.x,sz-o.z)<o.radius+17))continue;
  const core=new THREE.Mesh(repairGeometry,repairMaterial);
  const ring=new THREE.Mesh(repairRingGeometry,repairRingMaterial);
  ring.rotation.x=Math.PI/2;core.add(ring);scene.add(core);
  repairKits.push({x:sx,z:sz,mesh:core,expires:now+REPAIR.lifetime,phase:Math.random()*6.28});
  break;
 }
}
function updateRepairKits(now){
 if(now>=nextRepairSpawn){spawnRepairKit(now);nextRepairSpawn=now+REPAIR.interval;}
 for(let i=repairKits.length-1;i>=0;i--){
  const kit=repairKits[i];
  kit.mesh.position.set(kit.x,height(kit.x,kit.z,now)+3+Math.sin(now*2+kit.phase)*.7,kit.z);
  kit.mesh.rotation.y+=.014;
  let collector=null,bestDistance=REPAIR.radius;
  if(playerCombat.hp>0&&playerCombat.hp<playerMaxHp()){
   const distance=Math.hypot(x-kit.x,z-kit.z);
   if(distance<bestDistance){bestDistance=distance;collector=playerCombat;}
  }
  if(collector){
   collector.hp=Math.min(playerMaxHp(),collector.hp+REPAIR.amount);
   notifyCombat('KIT DE REPARO +'+REPAIR.amount+' HP',2);
  }
  if(collector||now>=kit.expires){scene.remove(kit.mesh);repairKits.splice(i,1);}
 }
}
// Zonas verdes de reparo: 1 HP por segundo, apenas enquanto o casco estiver sobre a área.
// Geometrias e materiais compartilhados para reduzir custo no celular.
const HEAL_ZONE_RADIUS=46,HEAL_ZONE_RATE=1;
const healZoneGeometry=new THREE.CircleGeometry(HEAL_ZONE_RADIUS,32);
const healZoneMaterial=new THREE.MeshBasicMaterial({color:0x28f16c,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
const healRimGeometry=new THREE.RingGeometry(HEAL_ZONE_RADIUS-2,HEAL_ZONE_RADIUS,36);
const healRimMaterial=new THREE.MeshBasicMaterial({color:0x50ff8f,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide});
const plusMaterial=new THREE.MeshBasicMaterial({color:0x8dffab,transparent:true,opacity:.84,depthWrite:false,side:THREE.DoubleSide});
const plusBarV=new THREE.PlaneGeometry(1.2,5);
const plusBarH=new THREE.PlaneGeometry(5,1.2);
const healZonePositions=[
 [95,-310],[-100,-760],[430,-1150],[950,-950],
 [1500,-1160],[2080,-890],[2710,-1210],[2950,-1010]
];
const healZones=healZonePositions.map(([zx,zz],index)=>{
 const base=new THREE.Group(),disc=new THREE.Mesh(healZoneGeometry,healZoneMaterial);
 disc.rotation.x=-Math.PI/2;base.add(disc);
 const rim=new THREE.Mesh(healRimGeometry,healRimMaterial);
 rim.rotation.x=-Math.PI/2;rim.position.y=.12;base.add(rim);
 const sparks=[];
 for(let k=0;k<4;k++){
  const spark=new THREE.Group();
  spark.add(new THREE.Mesh(plusBarV,plusMaterial),new THREE.Mesh(plusBarH,plusMaterial));
  base.add(spark);sparks.push(spark);
 }
 scene.add(base);
 return {x:zx,z:zz,base,sparks,index};
});
const healPlayerPlus=new THREE.Group();
for(let i=0;i<8;i++){const plus=new THREE.Group();plus.add(new THREE.Mesh(plusBarV,plusMaterial),new THREE.Mesh(plusBarH,plusMaterial));healPlayerPlus.add(plus)}
healPlayerPlus.visible=false;scene.add(healPlayerPlus);
let healZoneFraction=0,healZoneNoticeAt=0,healZoneUntil=0;
function updateHealZones(dt,t){
 let inside=false;
 for(const zone of healZones){
  const elevation=height(zone.x,zone.z,t);
  zone.base.position.set(zone.x,elevation+.25,zone.z);
  for(let k=0;k<zone.sparks.length;k++){
   const spark=zone.sparks[k],p=(t*.19+k*.25+zone.index*.17)%1;
   const angle=k*Math.PI*.5+zone.index*.7;
   spark.position.set(Math.cos(angle)*(14+k*5),3+p*14,Math.sin(angle)*(14+k*5));
   spark.quaternion.copy(camera.quaternion);
   spark.scale.setScalar(.7+(1-p)*.55);
  }
  if(Math.hypot(x-zone.x,z-zone.z)<=HEAL_ZONE_RADIUS)inside=true;
 }
 if(inside)healZoneUntil=t+20;
 const healingActive=t<healZoneUntil&&playerCombat.hp>0&&!mission.failed;
 if(healingActive&&playerCombat.hp<playerMaxHp()){
  healZoneFraction+=dt*HEAL_ZONE_RATE;
  const healing=Math.min(playerMaxHp()-playerCombat.hp,Math.floor(healZoneFraction));
  if(healing>0){playerCombat.hp+=healing;healZoneFraction-=healing;}
  if(t>=healZoneNoticeAt){notifyCombat(inside?'ÁREA DE REPARO · +1 HP/s':'REPARO RESIDUAL · +1 HP/s',1);healZoneNoticeAt=t+5;}
 }else if(!healingActive)healZoneFraction=0;
 healPlayerPlus.visible=healingActive;
 if(healingActive){healPlayerPlus.position.set(x,height(x,z,t)+2,z);for(let i=0;i<healPlayerPlus.children.length;i++){const p=healPlayerPlus.children[i],u=(t*.52+i/8)%1;p.position.set(Math.cos(i*2.4)*5,2+u*11,Math.sin(i*2.4)*5);p.quaternion.copy(camera.quaternion);p.scale.setScalar(.65*(1-u*.4));}}
}
// Drops especiais luminosos: coluna translúcida + item flutuante, sem luzes dinâmicas.
const specialDrops=[],DROP_INTERVAL=26,DROP_LIFE=90,DROP_MAX=4;
let nextSpecialDrop=14,shieldUntil=0,superBoostUntil=0;
const pickupInventory={boost:0,shield:0};
const pickupControls=document.createElement('div');
pickupControls.style.cssText='position:fixed;right:12px;top:44%;z-index:95;display:flex;flex-direction:column;gap:7px';
const pickupButtons={};
for(const [type,label] of [['shield','🛡️ ESCUDO'],['boost','⚡ BOOST 2×']]){
 const button=document.createElement('button');button.type='button';
 button.style.cssText='min-width:105px;padding:9px 10px;color:#fff;background:#10334de8;border:1px solid #8fdded;border-radius:11px;font:700 12px system-ui;touch-action:manipulation';
 button.textContent=label+' ×0';button.disabled=true;
 button.addEventListener('pointerdown',event=>{
  event.preventDefault();event.stopPropagation();
  if(playerCombat.hp<=0||pickupInventory[type]<=0||mission.failed)return;
  pickupInventory[type]--;
  const now=clock.elapsedTime;
  if(type==='shield'){shieldUntil=Math.max(shieldUntil,now)+7;notifyCombat('ESCUDO ATIVO · 7s',1.5);}
  else{superBoostUntil=Math.max(superBoostUntil,now)+20;notifyCombat('BOOST 2× ATIVO · 20s',1.5);}
  updatePickupButtons();
 });
 pickupButtons[type]=button;pickupControls.appendChild(button);
}
document.body.appendChild(pickupControls);
function updatePickupButtons(){
 pickupButtons.shield.textContent='🛡️ ESCUDO ×'+pickupInventory.shield;
 pickupButtons.boost.textContent='⚡ BOOST 2× ×'+pickupInventory.boost;
 for(const type of ['shield','boost']){
  pickupButtons[type].disabled=pickupInventory[type]===0||playerCombat.hp<=0;
  pickupButtons[type].style.opacity=pickupButtons[type].disabled?'.48':'1';
 }
}

const dropCoreGeometry=new THREE.OctahedronGeometry(3.6,0);
const dropBeamGeometry=new THREE.CylinderGeometry(3.5,5,34,12,1,true);
const dropRingGeometry=new THREE.RingGeometry(6,8,24);
const shieldGeometry=new THREE.SphereGeometry(10.5,32,20);
const shieldMaterial=new THREE.ShaderMaterial({
 transparent:true,depthWrite:false,side:THREE.DoubleSide,
 uniforms:{uTime:{value:0}},
 vertexShader:'varying vec3 vNormal;varying vec3 vPos;void main(){vNormal=normalize(normalMatrix*normal);vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform float uTime;varying vec3 vNormal;varying vec3 vPos;void main(){float fresnel=pow(1.-abs(dot(normalize(vNormal),vec3(0.,0.,1.))),2.);float ripple=.5+.5*sin(vPos.y*1.8+uTime*6.);float alpha=.13+.43*fresnel+.1*ripple;gl_FragColor=vec4(.17,.72,1.,alpha);}'
});
const shieldMesh=new THREE.Mesh(shieldGeometry,shieldMaterial);shieldMesh.visible=false;scene.add(shieldMesh);
function spawnSpecialDrop(now){
 if(specialDrops.length>=DROP_MAX||mission.finished||mission.failed)return;
 const type=Math.random()<.5?'boost':'shield';
 for(let tries=0;tries<12;tries++){
  const ang=Math.random()*Math.PI*2,dist=90+Math.random()*180;
  const px=x+Math.cos(ang)*dist,pz=z+Math.sin(ang)*dist;
  if(horizon.colliders.some(o=>Math.hypot(px-o.x,pz-o.z)<o.radius+22))continue;
  const tint=type==='boost'?0xffd039:0x5bd9ff;
  const item=new THREE.Group();
  const beam=new THREE.Mesh(dropBeamGeometry,new THREE.MeshBasicMaterial({color:tint,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}));
  beam.position.y=17;item.add(beam);
  const core=new THREE.Mesh(dropCoreGeometry,new THREE.MeshBasicMaterial({color:tint}));core.position.y=3;item.add(core);
  const ring=new THREE.Mesh(dropRingGeometry,new THREE.MeshBasicMaterial({color:tint,transparent:true,opacity:.78,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.35;item.add(ring);
  scene.add(item);specialDrops.push({x:px,z:pz,type,item,core,expires:now+DROP_LIFE,phase:Math.random()*6.28});break;
 }
}
function updateSpecialDrops(dt,t){
 if(t>=nextSpecialDrop){spawnSpecialDrop(t);nextSpecialDrop=t+DROP_INTERVAL;}
 for(let i=specialDrops.length-1;i>=0;i--){
  const drop=specialDrops[i];
  drop.item.position.set(drop.x,height(drop.x,drop.z,t)+.3,drop.z);
  drop.core.rotation.y+=dt*1.7;drop.core.position.y=3+Math.sin(t*2+drop.phase)*.8;
  const collected=playerCombat.hp>0&&Math.hypot(x-drop.x,z-drop.z)<11;
  if(collected){
   pickupInventory[drop.type]=Math.min(9,pickupInventory[drop.type]+1);
   updatePickupButtons();
   notifyCombat(drop.type==='boost'?'BOOST 2× COLETADO':'ESCUDO COLETADO',1.7);
  }
  if(collected||t>=drop.expires){
   scene.remove(drop.item);
   for(const child of drop.item.children)child.material.dispose();
   specialDrops.splice(i,1);
  }
 }
 updatePickupButtons();
 shieldMesh.visible=t<shieldUntil&&playerCombat.hp>0;
 if(shieldMesh.visible){shieldMesh.position.copy(ship.position);shieldMesh.position.y+=3;shieldMaterial.uniforms.uTime.value=t;}
}
let threatShotCount=0;
// NPCs compartilham geometria, shader e rastro dos tiros do jogador.
// Barra de integridade acompanha a nave no espaço da tela, sempre horizontal.
const hpHud=document.createElement('div');hpHud.id='playerHealthBar';hpHud.setAttribute('role','progressbar');hpHud.setAttribute('aria-label','Integridade da nave');hpHud.setAttribute('aria-valuemin','0');hpHud.setAttribute('aria-valuemax',String(ENEMY_AI.maxHp));
const hpFill=document.createElement('div');hpFill.id='playerHealthFill';
const hpValue=document.createElement('span');hpValue.id='playerHealthValue';
hpHud.append(hpFill,hpValue);document.body.appendChild(hpHud);
const boostMeter=document.createElement('div');
boostMeter.id='boostMeter';boostMeter.setAttribute('role','progressbar');
boostMeter.setAttribute('aria-label','Energia do propulsor');
boostMeter.setAttribute('aria-valuemin','0');boostMeter.setAttribute('aria-valuemax','100');
boostMeter.style.cssText='position:fixed;z-index:20;height:7px;overflow:hidden;border-radius:5px;border:1px solid #b58e25;background:#29251c;pointer-events:none;box-sizing:border-box';
const boostFill=document.createElement('div');
boostFill.style.cssText='height:100%;width:100%;background:linear-gradient(90deg,#ffa700,#ffe95b);box-shadow:0 0 5px #ffca40';
boostMeter.appendChild(boostFill);document.body.appendChild(boostMeter);
function refreshPlayerHealth(){
 // Garante HP finito dentro do limite real, inclusive após migração de dados.
 if(!Number.isFinite(playerCombat.hp))playerCombat.hp=ENEMY_AI.maxHp;
 playerCombat.hp=THREE.MathUtils.clamp(playerCombat.hp,0,playerMaxHp());
 const percent=THREE.MathUtils.clamp(playerCombat.hp/playerMaxHp(),0,1);
 hpFill.style.width=(percent*100).toFixed(1)+'%';
 hpFill.style.background=percent>.6?'linear-gradient(180deg,#aaff56,#52ce18)':percent>.3?'linear-gradient(180deg,#ffe76b,#e7a528)':'linear-gradient(180deg,#ff8380,#d72832)';
 hpValue.textContent=Math.ceil(playerCombat.hp)+' / '+playerMaxHp();
 hpHud.setAttribute('aria-valuemax',String(playerMaxHp()));
 hpHud.setAttribute('aria-valuenow',String(playerCombat.hp));
 // HUD em coordenadas da tela: não recebe altura das ondas, bob, roll nem projeção 3D.
 // A câmera de perseguição mantém o jogador centralizado; o indicador permanece
 // sempre horizontal e separado da simulação física.
 hpHud.style.display=playerCombat.hp>0?'flex':'none';
 hpHud.style.left='50%';
 hpHud.style.top='78%';
 const bounds=hpHud.getBoundingClientRect();
 boostMeter.style.left=bounds.left+'px';
 boostMeter.style.top=(bounds.bottom+5)+'px';
 boostMeter.style.width=bounds.width+'px';
 boostMeter.style.display=playerCombat.hp>0?'block':'none';
 const charge=THREE.MathUtils.clamp(boostEnergy,0,1);
 boostFill.style.width=(charge*100).toFixed(1)+'%';
 boostMeter.setAttribute('aria-valuenow',String(Math.round(charge*100)));
}
 // Bússola de combate: pings persistentes para toda a frota, inclusive fora do campo de visão.
 const compass=document.createElement('div');compass.id='combatCompass';
 compass.innerHTML='<div class="compassTrack"><span class="compassCenter">▼</span></div><div class="compassReadout">LOCALIZANDO HOSTIS</div>';
 document.getElementById('ui').appendChild(compass);
 const objectivePing=document.createElement('span');
 objectivePing.style.cssText='position:absolute;top:-7px;color:#ffe066;font-weight:900;font-size:20px;text-shadow:0 0 10px #ffa900';
 objectivePing.textContent='◆';objectivePing.title='Destino da missão';
 compass.querySelector('.compassTrack').appendChild(objectivePing);
 const compassTrack=compass.querySelector('.compassTrack');
 const compassReadout=compass.querySelector('.compassReadout');
 const subCompassPing=document.createElement('span');subCompassPing.className='compassPing';subCompassPing.textContent='🔻';subCompassPing.title='Submarino hostil';compassTrack.appendChild(subCompassPing);
const compassPings=enemies.map(enemy=>{
  const marker=document.createElement('span');marker.className='compassPing';marker.setAttribute('aria-hidden','true');
  marker.textContent='◆';marker.title=enemy.name;
  compassTrack.appendChild(marker);return marker;
 });
 let lastCompassUpdate=-1,compassQuiet=false;
 const threatStatus=document.createElement('div');threatStatus.id='threatStatus';threatStatus.setAttribute('aria-live','off');compass.appendChild(threatStatus);
 function refreshCompass(t){
  if(t-lastCompassUpdate<.075)return;lastCompassUpdate=t;
  const goal=mission.stage===0?{x:mission.cargoX,z:mission.cargoZ}:mission.stage===1?{x:mission.deliveryX,z:mission.deliveryZ}:mission.stage===5||mission.stage===6||mission.stage===8?{x:mission.signalX,z:mission.signalZ}:mission.stage>=10&&mission.stage<=12?{x:mission.baseX,z:mission.baseZ}:mission.stage===13?{x:mission.extractionX,z:mission.extractionZ}:mission.stage===15?{x:mission.subX,z:mission.subZ}:null;
  const trackingSub=mission.stage>=16&&mission.stage<=18&&!mission.failed;
  const subDist=Math.hypot(x-mission.subX,z-mission.subZ);
  subCompassPing.style.display=trackingSub?'block':'none';
  if(trackingSub){
   const a=Math.atan2(-(mission.subX-x),-(mission.subZ-z));
   const delta=Math.atan2(Math.sin(a-heading),Math.cos(a-heading));
   subCompassPing.style.left=THREE.MathUtils.clamp(50-delta/Math.PI*45,5,95)+'%';
   subCompassPing.title='Submarino hostil · '+Math.round(subDist)+' m';
  }
  objectivePing.style.display=goal?'block':'none';
  if(goal){const bearing=Math.atan2(-(goal.x-x),-(goal.z-z));const delta=Math.atan2(Math.sin(bearing-heading),Math.cos(bearing-heading));objectivePing.style.left=THREE.MathUtils.clamp(50-delta/Math.PI*45,5,95)+'%';objectivePing.textContent=Math.abs(delta)>Math.PI*.75?'◀':'◆';}
  let nearestEnemy=null,nearestRange=Infinity,activeThreats=0,shooters=0;
  for(let i=0;i<enemies.length;i++){
   const enemy=enemies[i],marker=compassPings[i];
   if(enemy.hp<=0){marker.style.display='none';continue;}
   const dx=enemy.x-x,dz=enemy.z-z,range=Math.hypot(dx,dz);
   if(range<nearestRange){nearestEnemy=enemy;nearestRange=range;}
   if(range<=ENEMY_AI.detect&&enemy.state!=='patrol')activeThreats++;
   if(range<=ENEMY_AI.fireRange&&enemy.state!=='patrol')shooters++;
   const bearing=Math.atan2(-dx,-dz);
   const delta=Math.atan2(Math.sin(bearing-heading),Math.cos(bearing-heading));
   const position=THREE.MathUtils.clamp(50-delta/Math.PI*45,5,95);
   marker.style.display='block';marker.style.left=position.toFixed(1)+'%';
   marker.classList.toggle('closest',enemy===nearestEnemy);
   marker.classList.toggle('behind',Math.abs(delta)>Math.PI*.75);
   marker.classList.toggle('danger',range<ENEMY_AI.fireRange&&enemy.state!=='patrol');
   marker.classList.toggle('damaged',enemy.hp<=COMBAT.npcMaxHp*.35);
   marker.textContent=Math.abs(delta)>Math.PI*.75?(delta>0?'▶':'◀'):'◆';
  }
  for(let i=0;i<enemies.length;i++)compassPings[i].classList.toggle('closest',enemies[i]===nearestEnemy);
  compassReadout.textContent=nearestEnemy?'HOSTIS '+enemies.filter(e=>e.hp>0).length+' · '+nearestEnemy.name+' · '+Math.round(nearestRange)+' m':'ÁREA SEGURA · SEM HOSTIS';
  threatStatus.textContent=shooters?'⚠ '+shooters+' INIMIGO'+(shooters>1?'S':'')+' EM ALCANCE':activeThreats?'⚔ '+activeThreats+' EM APROXIMAÇÃO':nearestEnemy?'PATRULHAS DISTANTES':'SEM AMEAÇAS';
  threatStatus.classList.toggle('hot',shooters>0);
  if(compassQuiet!==!nearestEnemy){compassQuiet=!nearestEnemy;compass.classList.toggle('clear',compassQuiet);}
 }

const fireButton=document.getElementById('fire'),lockLabel=document.getElementById('lock');
fireButton.setAttribute('aria-label','Segurar para mirar e soltar para disparar');
const AMMO_TYPES=[
 {id:'plasma',name:'Plasma',icon:'⚡',description:'Arco energético',color:0x25cfff},
 {id:'scatter',name:'Rajada de Energia',icon:'✨',description:'Três impactos rápidos em área',color:0xbc80ff},
 {id:'iron',name:'Teste de Ferro',icon:'🔩',description:'Projétil 3× mais rápido · dano 40',color:0xffd28b},
 {id:'torpedo',name:'Torpedo',icon:'🚀',description:'Explosão em área · dano 165',color:0x62f2ec},
 {id:'energyBomb',name:'Bomba de Energia',icon:'💠',description:'25% da vida máxima do alvo · recarga 5 minutos',color:0x69f9ff},
];
let selectedAmmo=AMMO_TYPES[0];
// Apenas armas de efeito especial usam a câmera tática superior.
const TACTICAL_AMMO=new Set(['scatter']);
const ammoButton=document.getElementById('ammo'),ammoMenu=document.getElementById('ammoMenu');
 // Barra lateral de armamentos visíveis, inspirada nos botões da referência.
const weaponDock=document.createElement('div');weaponDock.id='weaponDock';
document.getElementById('ui').appendChild(weaponDock);
function renderWeaponDock(){
 weaponDock.replaceChildren();
 for(const id of ['plasma','iron','torpedo','scatter','energyBomb']){
  const ammo=AMMO_TYPES.find(a=>a.id===id);
  const button=document.createElement('button');
  button.type='button';button.className='weaponSlot'+(selectedAmmo.id===id?' selected':'');
  button.textContent=ammo.icon;button.title=ammo.name+' · Alcance '+WEAPON_STATS[id].range+' · Recarga '+WEAPON_STATS[id].cooldown+'s';button.dataset.weapon=id;button.dataset.special=String(TACTICAL_AMMO.has(id));
  button.setAttribute('aria-label','Selecionar '+ammo.name);button.setAttribute('aria-pressed',String(selectedAmmo.id===id));
  button.addEventListener('pointerdown',e=>{
   e.preventDefault();e.stopPropagation();
   selectedAmmo=ammo;cancelAreaAim();ammoButton.textContent=ammo.icon;
   ammoMenu.classList.remove('open');ammoButton.setAttribute('aria-expanded','false');
   renderAmmoMenu();renderWeaponDock();
  });
  weaponDock.appendChild(button);
 }
}
function renderAmmoMenu(){
 ammoMenu.replaceChildren();
 for(const ammo of AMMO_TYPES){
  const button=document.createElement('button');button.type='button';
  button.className=ammo.id===selectedAmmo.id?'chosen':'';
  button.textContent=ammo.icon+' '+ammo.name+' · '+ammo.description+' · Alcance '+WEAPON_STATS[ammo.id].range+' · '+WEAPON_STATS[ammo.id].cooldown+'s';
  button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();selectedAmmo=ammo;if(typeof cancelAreaAim==='function')cancelAreaAim();ammoButton.textContent=ammo.icon;ammoMenu.classList.remove('open');ammoButton.setAttribute('aria-expanded','false');renderAmmoMenu();renderWeaponDock()});
  ammoMenu.append(button);
 }
}
ammoButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const isOpen=ammoMenu.classList.toggle('open');ammoButton.setAttribute('aria-expanded',String(isOpen));if(isOpen)renderAmmoMenu()});
renderAmmoMenu();renderWeaponDock();
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
 // Orçamento de efeitos: preservar FPS durante vários acertos simultâneos.
 if(impactEffects.length>=16)return;
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
const weaponReadyAt=Object.fromEntries(Object.keys(WEAPON_STATS).map(id=>[id,0]));
const currentWeapon=()=>WEAPON_STATS[selectedAmmo.id];
const ENERGY_BOMB_KEY='semnome.energyBomb.readyAt.v1';
let energyBombReadyAt=0;
try{energyBombReadyAt=Math.max(0,Number(localStorage.getItem(ENERGY_BOMB_KEY))||0)}catch{}
const weaponRemaining=()=>selectedAmmo.id==='energyBomb'?Math.max(0,(energyBombReadyAt-Date.now())/1000):Math.max(0,weaponReadyAt[selectedAmmo.id]-clock.elapsedTime);
let energyBlackoutUntil=0;
const energyBlackoutHud=document.createElement('div');
energyBlackoutHud.style.cssText='display:none;position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:98;padding:12px 20px;border:1px solid #fc8d61;border-radius:12px;background:#2d1019e8;color:#ffdac5;font:800 15px system-ui;text-align:center;pointer-events:none';
document.body.appendChild(energyBlackoutHud);
const energyDisabled=()=>clock.elapsedTime<energyBlackoutUntil;
const energyBombStatus=document.createElement('div');
energyBombStatus.style.cssText='position:fixed;right:12px;top:265px;z-index:94;color:#a9f6ff;background:#082b42db;border:1px solid #68e6ff;border-radius:9px;padding:5px 8px;font:700 12px system-ui;pointer-events:none';
document.body.appendChild(energyBombStatus);
let lastEnergyBombSecond=-1;
function updateEnergyBombStatus(){
 const secs=Math.ceil(Math.max(0,(energyBombReadyAt-Date.now())/1000));
 if(secs===lastEnergyBombSecond)return;
 lastEnergyBombSecond=secs;
 energyBombStatus.textContent=secs?'💠 Bomba de Energia · '+Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0'):'💠 Bomba de Energia · PRONTA';
 const slot=weaponDock.querySelector('[data-weapon="energyBomb"]');
 if(slot){slot.title=energyBombStatus.textContent;slot.style.opacity=secs?'.55':'1';}
}
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
const attackCamera={phase:'idle',shot:null,target:null,launchOrigin:null,launchYaw:0,impactAt:0,blend:0,shake:0,startedAt:0,shotCount:0};
const shotView=new THREE.Vector3(),shotLook=new THREE.Vector3(),normalView=new THREE.Vector3(),normalLook=new THREE.Vector3();
const smoothstep01=v=>{v=THREE.MathUtils.clamp(v,0,1);return v*v*(3-2*v)};
// O casco só gira por navegação ou arrasto; o tiro em arco mira sem girar a nave.

// Feedback de combate em DOM: leve para GPU mobile e sem geometria extra.
const hitOverlay=document.createElement('div');
hitOverlay.style.cssText='position:fixed;inset:0;z-index:31;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,transparent 48%,rgba(255,34,39,.56) 100%);transition:opacity 170ms ease-out';
document.body.appendChild(hitOverlay);
const combatNotice=document.createElement('div');
combatNotice.style.cssText='position:fixed;top:19%;left:50%;transform:translateX(-50%);z-index:37;pointer-events:none;text-align:center;color:#fff0ba;text-shadow:0 3px 6px #00121d,0 0 15px #00c8ff;font:700 clamp(11px,2vw,15px) system-ui;max-width:80vw;white-space:normal;line-height:1.3;letter-spacing:0;opacity:0;transition:opacity .2s;white-space:nowrap';
document.body.appendChild(combatNotice);
let noticeUntil=0,noticeText='',hitFeedback=0,wonBattle=false;
function notifyCombat(message,duration=2){noticeText=message;noticeUntil=clock.elapsedTime+duration;combatNotice.textContent=message;combatNotice.style.opacity='1'}
const damageLabels=[];
function showDamage(enemy,amount){
 if(damageLabels.length>=9){const old=damageLabels.shift();old.label.remove();}
 const label=document.createElement('div');
 label.textContent='-'+amount;
 label.style.cssText='position:fixed;z-index:48;color:#ff4545;font:700 13px system-ui;text-shadow:0 2px 2px #300,0 0 8px #ff0000;pointer-events:none;transform:translate(-50%,-50%)';
 document.body.appendChild(label);
 damageLabels.push({label,enemy,age:0});
 if(enemy.sprite){
  enemy.sprite.material.color.setHex(0xff3939);
  enemy.hitUntil=clock.elapsedTime+.35;
 }
}
const targetRing=new THREE.Mesh(new THREE.RingGeometry(6.4,6.9,32),new THREE.MeshBasicMaterial({color:0xff5555,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));
targetRing.rotation.x=-Math.PI/2;targetRing.visible=false;scene.add(targetRing);
function weaponRange(){return currentWeapon().range;}
function moveButtonAim(e){
 if(!areaAim.active||e.pointerId!==areaAim.pointerId)return;
 // Deslocamento relativo ao botão: o dedo nunca precisa sair para tocar o mar.
 const dx=e.clientX-areaAim.startX,dy=e.clientY-areaAim.startY;
 if(Math.hypot(dx,dy)>=12)areaAim.manualDragged=true;
 const sensitivity=.62; // Controle fino do braço de mira em combate móvel
 const px=areaAim.origin.x+areaAim.right.x*dx*sensitivity-areaAim.forward.x*dy*sensitivity;
 const pz=areaAim.origin.z+areaAim.right.z*dx*sensitivity-areaAim.forward.z*dy*sensitivity;
 const ox=px-x,oz=pz-z,dist=Math.hypot(ox,oz),max=weaponRange();
 const ratio=dist>max?max/dist:1;
 areaAim.point.set(x+ox*ratio,height(x+ox*ratio,z+oz*ratio,clock.elapsedTime)+.35,z+oz*ratio);
 areaAim.valid=true;aimReticle.position.copy(areaAim.point);aimReticle.visible=true;
 // Feedback da mira: vermelho quando o ponto cobre um inimigo.
 const hovering=enemies.some(enemy=>enemy.hp>0&&Math.hypot(enemy.x-areaAim.point.x,enemy.z-areaAim.point.z)<Math.max(10,currentWeapon().impact*.24));
 aimDisc.material.color.setHex(hovering?0xff3636:0x00f0ff);
 aimDisc.material.opacity=hovering?.34:.20;
 for(const mark of aimReticle.children){if(mark.material?.color&&mark!==aimDisc)mark.material.color.setHex(hovering?0xff3131:mark.type==='Line'?0xffff00:0x00ffff)}
}
function startAreaAim(e){
 if(playerCombat.hp<=0||energyDisabled()||areaAim.active||weaponRemaining()>0)return;
 areaAim.active=true;areaAim.pointerId=e.pointerId;areaAim.valid=true;
 areaAim.startX=e.clientX;areaAim.startY=e.clientY;areaAim.holdStarted=clock.elapsedTime;
 // Memoriza a direção atual da torreta antes de qualquer ajuste da mira.
 areaAim.startTurretYaw=heading+(ship.userData.turretPivot?.rotation.y??0);
 areaAim.manualDragged=false;
 // Especial: visão aérea desde o primeiro toque, sem temporizador.
 areaAim.viewBlend=TACTICAL_AMMO.has(selectedAmmo.id)?1:0;
 aimHint.textContent=(TACTICAL_AMMO.has(selectedAmmo.id)?'MIRA AÉREA':'MIRA DIRETA')+' · '+selectedAmmo.name.toUpperCase()+' · '+weaponRange()+' m';
 aimHint.classList.add('active');cancelAimButton.classList.add('active');
 const f=new THREE.Vector3(-Math.sin(heading),0,-Math.cos(heading));
 areaAim.forward.copy(f);areaAim.right.set(-f.z,0,f.x);
 const distance=selectedAmmo.id==='siege'?105:selectedAmmo.id==='torpedo'?100:Math.min(80,weaponRange()*.40);
 // Mira aparece imediatamente em frente à nave; o arrasto controla o ponto de impacto.
 areaAim.origin.set(x+f.x*distance,0,z+f.z*distance);
 if(lockedNpc&&lockedNpc.hp>0&&Math.hypot(x-lockedNpc.x,z-lockedNpc.z)<=weaponRange()){
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
 // Toque simples sem alvo: atira exatamente para a frente da torreta.
 // Arrastar continua utilizando a mira manual, sem assistência forçada.
 const tap=!areaAim.manualDragged&&Math.hypot(e.clientX-areaAim.startX,e.clientY-areaAim.startY)<12;
 if(destination&&tap&&(!lockedNpc||lockedNpc.hp<=0)){
  // Deriva a trajetória da boca do canhão no mundo, sem estimar pelos ângulos do casco.
  ship.updateMatrixWorld(true);
  const muzzle=ship.userData.firePoint;
  const origin=muzzle.getWorldPosition(new THREE.Vector3());
  const direction=new THREE.Vector3(0,0,-1).transformDirection(muzzle.matrixWorld);
  const horizontal=Math.hypot(direction.x,direction.z)||1;
  const range=weaponRange()*.94;
  const tx=origin.x+direction.x/horizontal*range;
  const tz=origin.z+direction.z/horizontal*range;
  destination.set(tx,origin.y+direction.y*range/horizontal,tz);
 }
 // Correção leve de mira em alvo móvel: prevê o ponto de encontro,
 // mas o projétil segue sua trajetória e pode errar se o alvo manobrar.
 if(destination){
  const direct=selectedAmmo.id==='torpedo'||selectedAmmo.id==='plasma'||selectedAmmo.id==='iron';
  let best=null,bestDist=selectedAmmo.id==='torpedo'?24:direct?20:11;
  for(const enemy of enemies){
   const dist=Math.hypot(enemy.x-destination.x,enemy.z-destination.z);
   if(enemy.hp>0&&dist<bestDist){best=enemy;bestDist=dist;}
  }
  if(best){
   if(direct){
    const projectileSpeed=selectedAmmo.id==='torpedo'?115:selectedAmmo.id==='iron'?COMBAT.projectileSpeed*2.65/1.8:COMBAT.projectileSpeed*1.6/1.8;
    const lead=predictIntercept({x,z},{x:best.x,z:best.z},{x:best.vx||0,z:best.vz||0},projectileSpeed,Math.max(1,weaponRange()/projectileSpeed*1.5));
    if(Math.hypot(lead.x-x,lead.z-z)<=weaponRange())destination.set(lead.x,best.y+2.5,lead.z);
    else destination.set(best.x,best.y+2.5,best.z);
   }else destination.set(best.x,best.y+.3,best.z);
  }
 }
 cancelAreaAim();
 if(destination){
  const range=Math.hypot(destination.x-x,destination.z-z);
  if(range<=weaponRange()+1)launchShot(destination);
 }
}
function launchShot(manualPoint=null){
 if(energyDisabled())return;
 lastShotTime=clock.elapsedTime;
 weaponReadyAt[selectedAmmo.id]=clock.elapsedTime+currentWeapon().cooldown;
 if(selectedAmmo.id==='energyBomb'){
  energyBombReadyAt=Date.now()+300000;energyBlackoutUntil=clock.elapsedTime+10;
  boostActive=false;boostUseRemaining=0;speed=0;hullPhysics.vx=0;hullPhysics.vz=0;
  cancelAreaAim();try{localStorage.setItem(ENERGY_BOMB_KEY,String(energyBombReadyAt))}catch{}updateEnergyBombStatus();
 }
 audio.play(selectedAmmo.id);
 // Disparo balístico 3D: sobe da proa e mergulha no ponto do alvo.
 const destination=manualPoint?manualPoint.clone():(lockedNpc&&lockedNpc.hp>0?new THREE.Vector3(lockedNpc.x,lockedNpc.y+2.5,lockedNpc.z):new THREE.Vector3(x-Math.sin(heading+(ship.userData.turretPivot?.rotation.y??0))*weaponRange(),0,z-Math.cos(heading+(ship.userData.turretPivot?.rotation.y??0))*weaponRange()));
 const ammo=selectedAmmo;
 // Nas armas comuns, a saída é a boca real da torre giratória.
 // Nas especiais, a trajetória aérea também nasce do canhão.
 ship.updateMatrixWorld(true);
 const origin=ship.userData.firePoint.getWorldPosition(new THREE.Vector3());
 if(ammo.id==='torpedo'){
  // Tubo lança-torpedos abaixo do casco, sem lançar o projétil pelo ar.
  origin.set(x-Math.sin(heading)*6,height(x,z,clock.elapsedTime)+.55,z-Math.cos(heading)*6);
  destination.y=height(destination.x,destination.z,clock.elapsedTime)+.65;
 }
 // Recuo e clarão visíveis no instante do disparo.
 ship.userData.recoil=.42;ship.userData.flashTime=.15;
 // Disparos comuns 60% mais rápidos; Teste de Ferro conserva o seu ajuste de 3x.
 const travel=ammo.id==='energyBomb'?Math.max(.055,origin.distanceTo(destination)/1250):ammo.id==='torpedo'?Math.max(.65,Math.hypot(origin.x-destination.x,origin.z-destination.z)/115):ammo.id==='siege'?3.0:ammo.id==='iron'?Math.max(.06,origin.distanceTo(destination)/COMBAT.projectileSpeed*1.8/2.65):Math.max(.34,origin.distanceTo(destination)/COMBAT.projectileSpeed*1.8/1.6)*(ammo.id==='meteor'?1.25:1);
 const arcHeight=(ammo.id==='plasma'||ammo.id==='iron'||ammo.id==='torpedo'||ammo.id==='energyBomb')?0:ammo.id==='siege'?THREE.MathUtils.clamp(origin.distanceTo(destination)*.85,65,145):THREE.MathUtils.clamp(origin.distanceTo(destination)*(ammo.id==='meteor'?.92:.44),ammo.id==='meteor'?26:13,ammo.id==='meteor'?70:38);
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
 const trail=new THREE.Line(trailGeometry,ammo.id==='torpedo'?new THREE.LineBasicMaterial({color:0xd6ffff,transparent:true,opacity:.7,depthWrite:false}):energyTrailMaterial);scene.add(trail);
 const shot={mesh,glow,outerGlow,plasma,trail,trailPoints,origin,destination,travel,arcHeight,age:0,distance:0,ammo:ammo.id,damage:WEAPON_STATS[ammo.id].damage*(1+economy.weapons*.08)};
 if(ammo.id==='torpedo'){
  core.visible=false;plasma.visible=false;glow.visible=false;outerGlow.visible=false;
  const shell=new THREE.MeshStandardMaterial({color:0x657c83,metalness:.65,roughness:.3});
  const finMat=new THREE.MeshStandardMaterial({color:0x1b3038,metalness:.6,roughness:.42});
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.6,1.5,10),shell);nose.rotation.x=-Math.PI/2;nose.position.z=-1.05;
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,3.25,12),shell);body.rotation.x=Math.PI/2;
  mesh.add(nose,body);
  for(const side of [-1,1]){const fin=new THREE.Mesh(new THREE.BoxGeometry(1.12,.09,.60),finMat);fin.position.set(0,side*.08,1.12);mesh.add(fin)}
  mesh.rotation.y=Math.atan2(-(destination.x-origin.x),-(destination.z-origin.z));
  shot.torpedo=true;shot.foamTimer=0;
  const finGlow=new THREE.Mesh(new THREE.SphereGeometry(.38,8,8),new THREE.MeshBasicMaterial({color:0xff6b2f}));finGlow.position.z=1.85;mesh.add(finGlow);
 }
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
   projectiles.push({mesh:small,glow:halo,outerGlow:halo,plasma:null,trail:trail2,trailPoints:points,origin:start,destination:goal,travel:travel*(.72+i*.07),arcHeight:arcHeight*(1.15+i*.12),age:-.10*(i+1),ammo:'scatter',secondary:true,damage:Math.round(WEAPON_STATS.scatter.damage*.65)});
  }
 }
 // A câmera acompanha ocasionalmente o torpedo, sem bloquear pilotagem.
 if(ammo.id==='torpedo'){
  attackCamera.shotCount++;
  if(attackCamera.shotCount%3===1&&orbitPointer===null&&clock.elapsedTime>=orbitManualUntil){
   attackCamera.phase='flight';attackCamera.shot=shot;attackCamera.target=destination.clone();
   attackCamera.launchOrigin=origin.clone();attackCamera.launchYaw=heading;
   attackCamera.startedAt=clock.elapsedTime;attackCamera.blend=0;
  }
 }
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
// Propulsor de evasão: arrancada curta, totalmente dirigível, com recarga própria.
const boostButton=document.getElementById('boost');
let boostEnergy=1,boostActive=false,boostUseRemaining=0;
const BOOST_DASH_SPEED=105;
const BOOST_RECHARGE_SECONDS=30,BOOST_BURN_SECONDS=6,BOOST_COST=.5;
boostButton.addEventListener('pointerdown',event=>{
 event.preventDefault();event.stopPropagation();
 if(playerCombat.hp<=0||energyDisabled()||boostActive||boostEnergy<BOOST_COST)return;
 boostActive=true;boostUseRemaining=BOOST_BURN_SECONDS;audio.play('boost');
 boostButton.classList.add('active');
});
// Minas aquáticas colocadas pelo jogador. NPCs não recebem percepção delas.
const MINE={cooldown:12,stun:20,radius:13,lifetime:100,max:5};
const mines=[];
const enemyMines=[];let nextEnemyMine=0;
let mineReadyAt=0;
const mineGeometry=new THREE.IcosahedronGeometry(2.7,0);
const mineMaterial=new THREE.MeshStandardMaterial({color:0x293b4c,metalness:.7,roughness:.35});
const mineButton=document.createElement('button');
mineButton.type='button';mineButton.id='mineButton';mineButton.textContent='💣 MINA';
mineButton.style.cssText='position:fixed;right:14px;bottom:125px;z-index:90;border:1px solid #8ef0ff;border-radius:12px;background:#132c3d;color:white;padding:11px;font-weight:700;touch-action:manipulation';
document.body.appendChild(mineButton);
function deployMine(){
 const now=clock.elapsedTime;
 if(playerCombat.hp<=0||now<mineReadyAt||mines.length>=MINE.max)return;
 const mx=x+Math.sin(heading)*16,mz=z+Math.cos(heading)*16;
 if(horizon.colliders.some(o=>Math.hypot(mx-o.x,mz-o.z)<o.radius+7))return;
 const mesh=new THREE.Mesh(mineGeometry,mineMaterial);
 scene.add(mesh);
 mines.push({x:mx,z:mz,mesh,armedAt:now+1.2,expires:now+MINE.lifetime});
 mineReadyAt=now+MINE.cooldown;
}
function updateEnemyMines(t){
 if(mission.stage===7&&!mission.failed&&t>=nextEnemyMine){
  nextEnemyMine=t+13;
  for(const enemy of enemies.filter(e=>e.signalEnemy&&e.veteran&&e.hp>0)){
   if(enemyMines.length>=12)break;
   const mesh=new THREE.Mesh(mineGeometry,mineMaterial.clone());mesh.material.color.setHex(0xb93351);
   const px=enemy.x-Math.sin(enemy.heading)*10,pz=enemy.z-Math.cos(enemy.heading)*10;
   scene.add(mesh);enemyMines.push({x:px,z:pz,mesh,armedAt:t+2,expires:t+65});
  }
 }
 for(let i=enemyMines.length-1;i>=0;i--){
  const m=enemyMines[i];m.mesh.position.set(m.x,height(m.x,m.z,t)+1,m.z);m.mesh.rotation.y+=.025;
  const hit=t>=m.armedAt&&Math.hypot(x-m.x,z-m.z)<13&&playerCombat.hp>0;
  if(hit&&t>=shieldUntil&&t>=playerCombat.invulnerableUntil)playerCombat.hp=Math.max(0,playerCombat.hp-18*(1-economy.armor*.05));
  if(hit||t>=m.expires||mission.stage!==7){scene.remove(m.mesh);m.mesh.material.dispose();enemyMines.splice(i,1);}
 }
}
mineButton.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();deployMine();});
function updateMines(now){
 mineButton.disabled=energyDisabled()||playerCombat.hp<=0||now<mineReadyAt||mines.length>=MINE.max;
 mineButton.textContent=now<mineReadyAt?'💣 '+Math.ceil(mineReadyAt-now)+'s':'💣 MINA';
 for(let i=mines.length-1;i>=0;i--){
  const mine=mines[i];
  mine.mesh.position.set(mine.x,height(mine.x,mine.z,now)+.9,mine.z);
  let victim=null;
  if(now>=mine.armedAt)for(const enemy of enemies){
   if(enemy.hp<=0)continue;
   const previousX=enemy.previousX??enemy.x,previousZ=enemy.previousZ??enemy.z;
   const dx=enemy.x-previousX,dz=enemy.z-previousZ;
   const f=THREE.MathUtils.clamp(((mine.x-previousX)*dx+(mine.z-previousZ)*dz)/Math.max(1e-6,dx*dx+dz*dz),0,1);
   if(Math.hypot(previousX+dx*f-mine.x,previousZ+dz*f-mine.z)<=MINE.radius){victim=enemy;break;}
  }
  if(victim){
   victim.stunnedUntil=Math.max(victim.stunnedUntil||0,now+MINE.stun);
   victim.vx=0;victim.vz=0;victim.ai.body.vx=0;victim.ai.body.vz=0;
   victim.ai.choice=null;
   energyFlash(new THREE.Vector3(mine.x,height(mine.x,mine.z,now)+3,mine.z));
   notifyCombat(victim.name+' · PARALISADO POR 20s',2);
  }
  if(victim||now>=mine.expires){scene.remove(mine.mesh);mines.splice(i,1);}
 }
}
const pad=document.getElementById('pad'),stick=document.getElementById('stick');
let padPointer=null;
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
  padPointer=e.pointerId;input.active=true;pad.setPointerCapture(e.pointerId);movePad(e);
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
// Órbita manual 360°: a câmera conserva sua inclinação e distância,
// mas pode circular livremente ao redor da nave sem alterar o casco.
let orbitYaw=0,orbitPointer=null,orbitLastX=0,orbitManualUntil=0;
renderer.domElement.style.touchAction='none';
renderer.domElement.addEventListener('pointerdown',e=>{
 if(orbitPointer!==null||areaAim.active||(e.pointerType==='mouse'&&e.button!==0))return;
 orbitPointer=e.pointerId;orbitLastX=e.clientX;
 renderer.domElement.setPointerCapture(e.pointerId);
 e.preventDefault();
});
renderer.domElement.addEventListener('pointermove',e=>{
 if(e.pointerId!==orbitPointer)return;
 const dx=e.clientX-orbitLastX;orbitLastX=e.clientX;
 orbitYaw+=dx*.0075;
 orbitManualUntil=clock.elapsedTime+3.5;
 e.preventDefault();
});
function releaseOrbit(e){if(e.pointerId===orbitPointer)orbitPointer=null}
renderer.domElement.addEventListener('pointerup',releaseOrbit);
renderer.domElement.addEventListener('pointercancel',releaseOrbit);
renderer.domElement.addEventListener('lostpointercapture',releaseOrbit);
const clock=new THREE.Clock(),camTarget=new THREE.Vector3(),wanted=new THREE.Vector3(),follow=new THREE.Vector3(),aimView=new THREE.Vector3(),aimLook=new THREE.Vector3();let cameraReady=false;
function tick(){
requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.04),t=clock.elapsedTime;
currentSeaIntensity=seaIntensityAt(t);
updateEnergyBombStatus();
updateSubHunt(dt,t);
uniforms.uTime.value=t;
uniforms.uWaveIntensity.value=currentSeaIntensity;
// Pilotagem direta e previsível: eixo Y regula motor, eixo X gira casco.
// Nenhuma referência de ângulo capturada no primeiro toque; nem a câmera altera os comandos.
const keyboardForward=keys.has('KeyW')||keys.has('ArrowUp')||keys.has('Space');
const keyboardBack=keys.has('KeyS')||keys.has('ArrowDown');
const keySteer=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
const deadZone=.12;
const padX=input.active&&Math.abs(input.x)>deadZone?Math.sign(input.x)*(Math.abs(input.x)-deadZone)/(1-deadZone):0;
const padY=input.active&&Math.abs(input.y)>deadZone?Math.sign(input.y)*(Math.abs(input.y)-deadZone)/(1-deadZone):0;
const throttle=THREE.MathUtils.clamp((keyboardForward?1:0)-(keyboardBack?1:0)-padY,-1,1);
const blackout=energyDisabled();
energyBlackoutHud.style.display=blackout?'block':'none';
if(blackout)energyBlackoutHud.textContent='⚠ SEM ENERGIA · '+Math.ceil(energyBlackoutUntil-t)+'s · MOVIMENTO E ARMAS BLOQUEADOS';
const steering=blackout?0:THREE.MathUtils.clamp(keySteer+padX,-1,1);
const target=blackout?0:t<subEmpUntil?Math.min(11,Math.max(0,throttle)*11):throttle>0?42*(1+economy.engine*.05)*(unlockedShips.selected==='signal'?1.08:1)*throttle:throttle<0?19*throttle:0;
if(blackout){boostActive=false;boostUseRemaining=0;hullPhysics.vx=0;hullPhysics.vz=0;speed=0;}
if(boostActive){
 const spent=Math.min(dt,boostUseRemaining);
 boostEnergy=Math.max(0,boostEnergy-spent*BOOST_COST/BOOST_BURN_SECONDS);
 boostUseRemaining=Math.max(0,boostUseRemaining-dt);
 if(boostUseRemaining<=0||boostEnergy<=0)boostActive=false;
}else if(boostEnergy<1){
 boostEnergy=Math.min(1,boostEnergy+dt/BOOST_RECHARGE_SECONDS);
}
const boostRemaining=boostActive?1:0;
boostButton.classList.toggle('active',boostActive);
boostButton.textContent=boostActive?'🚀 PROPULSOR ATIVO':boostEnergy<1?'🚀 '+Math.round(boostEnergy*100)+'%':'🚀 PROPULSOR';
boostButton.disabled=blackout||boostEnergy<BOOST_COST||boostActive||playerCombat.hp<=0;
// Corrige direção: arrastar o dedo para a direita gira a proa à direita.
// Giro possível parado, mais responsivo em velocidade e durante o BOOST.
if(playerCombat.hp>0){
 const rate=boostRemaining>0?3.1:THREE.MathUtils.lerp(1.65,2.35,Math.min(1,Math.abs(speed)/24));
 heading-=steering*rate*dt;
}
const collisionStartX=x,collisionStartZ=z;
hullPhysics.x=x;hullPhysics.z=z;
const movement=integrateHull(hullPhysics,{heading,targetSpeed:target,boostSpeed:boostRemaining>0?BOOST_DASH_SPEED*(1+economy.booster*.10)*(t<superBoostUntil?2:1):0,dt});
x=movement.x;z=movement.z;speed=movement.speed;
// Varredura contínua do trajeto: evita atravessar estruturas no BOOST ou FPS baixo.
// Um contato bloqueia imediatamente o avanço; a onda só afeta a representação visual.
if(playerCombat.hp>0){
 const originX=collisionStartX,originZ=collisionStartZ;
 const vx=x-originX,vz=z-originZ;
 let first=null,hitTime=Infinity,hitNX=0,hitNZ=0;
 for(const obstacle of [...horizon.colliders,...(mission.stage>=10&&!mission.baseDestroyed?[{x:mission.baseX,z:mission.baseZ,radius:65}]:[])]){
  const radius=obstacle.radius+5.8;
  const rx=originX-obstacle.x,rz=originZ-obstacle.z;
  const startDistSq=rx*rx+rz*rz;
  const a=vx*vx+vz*vz;
  let hit=null;
  if(startDistSq<radius*radius){
   // Já sobreposto: expulsar sempre, mesmo parado.
   hit=0;
  }else if(a>1e-9){
   const bb=2*(rx*vx+rz*vz),cc=startDistSq-radius*radius;
   const discriminant=bb*bb-4*a*cc;
   if(discriminant>=0){
    const entry=(-bb-Math.sqrt(discriminant))/(2*a);
    if(entry>=0&&entry<=1)hit=entry;
   }
  }
  if(hit===null||hit>=hitTime)continue;
  let impactX=originX+vx*hit,impactZ=originZ+vz*hit;
  let nx=impactX-obstacle.x,nz=impactZ-obstacle.z;
  const length=Math.hypot(nx,nz);
  if(length>1e-6){nx/=length;nz/=length}
  else {const movementLength=Math.hypot(vx,vz)||1;nx=-vx/movementLength;nz=-vz/movementLength}
  first=obstacle;hitTime=hit;hitNX=nx;hitNZ=nz;
 }
 if(first){
  const contactRadius=first.radius+5.8+.15;
  x=first.x+hitNX*contactRadius;z=first.z+hitNZ*contactRadius;
  const impactSpeed=Math.max(Math.hypot(hullPhysics.vx,hullPhysics.vz),Math.hypot(vx,vz)/Math.max(dt,.001));
  hullPhysics.x=x;hullPhysics.z=z;
  hullPhysics.vx=0;hullPhysics.vz=0;speed=0;boostActive=false;
  // Construções são obstáculos sólidos, mas não retiram vida do jogador.
  // Somente resíduos flutuantes mantêm dano de impacto.
  if(first.kind==='debris'&&t>=playerCombat.invulnerableUntil&&t>=shieldUntil&&impactSpeed>2){
   const damage=10;
   playerCombat.hp=Math.max(0,playerCombat.hp-damage);playerCombat.lastDamageAt=t;
   playerCombat.invulnerableUntil=t+1.1;hitFeedback=1;
   attackCamera.shake=Math.max(attackCamera.shake,.3);
   energyFlash(new THREE.Vector3(x,bob+1.5,z));audio.play('impact');
   notifyCombat((first.kind==='building'?'COLISÃO COM ESTRUTURA':'COLISÃO COM DESTROÇOS')+' · -'+damage,1);
   if(playerCombat.hp===0){
    playerCombat.deathX=x;playerCombat.deathZ=z;playerCombat.deathHeading=heading;
    playerCombat.respawnAt=t+3;speed=0;boostActive=false;
    hullPhysics.vx=0;hullPhysics.vz=0;ship.visible=false;cancelAreaAim();
    for(let burst=0;burst<6;burst++)energyFlash(new THREE.Vector3(x+(Math.random()-.5)*7,bob+2+Math.random()*5,z+(Math.random()-.5)*7));
    notifyCombat('NAVE DESTRUÍDA · RETORNO EM 3s',3);
   }
  }
 }
}
if(playerCombat.hp<=0){
 x=playerCombat.deathX;z=playerCombat.deathZ;heading=playerCombat.deathHeading;speed=0;
 hullPhysics.x=x;hullPhysics.z=z;hullPhysics.vx=0;hullPhysics.vz=0;
}
audio.update(speed,boostRemaining>0);
const bow=new THREE.Vector2(-Math.sin(heading),-Math.cos(heading)),side=new THREE.Vector2(Math.cos(heading),-Math.sin(heading));
const front=height(x+bow.x*1.5,z+bow.y*1.5,t),back=height(x-bow.x*1.5,z-bow.y*1.5,t);
const left=height(x-side.x*1.5,z-side.y*1.5,t),right=height(x+side.x*1.5,z+side.y*1.5,t);
const y=height(x,z,t);bob=THREE.MathUtils.damp(bob,y,5,dt);
animateWake(dt,t,x,z,heading,speed,boostRemaining>0);
for(let i=0;i<hoverHalos.length;i++){
 const side=i===0?-1:1;
 const halo=hoverHalos[i], lateral=side*2.5, rear=3.3;
 const px=x+Math.cos(heading)*lateral+Math.sin(heading)*rear;
 const pz=z-Math.sin(heading)*lateral+Math.cos(heading)*rear;
 halo.position.set(px,height(px,pz,t)+.20,pz);
 halo.material.opacity=(boostRemaining>0?.20:.085)*(.94+.06*Math.sin(t*9+i));
 halo.scale.setScalar(boostRemaining>0?1.5:1);
}

ship.position.set(x,bob+1.45,z);ship.rotation.order='YXZ';ship.rotation.y=heading;
ship.rotation.x=THREE.MathUtils.damp(ship.rotation.x,THREE.MathUtils.clamp(Math.atan2(back-front,3),-.24,.24),4,dt);
ship.rotation.z=THREE.MathUtils.damp(ship.rotation.z,THREE.MathUtils.clamp(Math.atan2(left-right,3),-.23,.23),4,dt);
// Torre livre acompanha a mira ou o alvo travado, sem mudar o rumo do casco.
// Atualiza recuo e luz reutilizada sem criar objetos a cada tiro.
function animateGun(model,delta){
 const data=model.userData,turret=data.turretPivot;
 if(!turret)return;
 data.recoil=Math.max(0,(data.recoil||0)-delta*1.55);
 turret.position.z=-1.35+data.recoil;
 data.flashTime=Math.max(0,(data.flashTime||0)-delta);
 if(data.muzzleFlash){
  data.muzzleFlash.visible=data.flashTime>0;
  data.muzzleFlash.scale.setScalar(.65+data.flashTime*8);
 }
}
animateGun(ship,dt);
const tower=ship.userData.turretPivot;
if(tower){
 const target=areaAim.active&&areaAim.manualDragged?areaAim.point:(lockedNpc&&lockedNpc.hp>0?lockedNpc:null);
 // Sem alvo selecionado, a torre observa a direção apontada pela câmera.
 let desired=orbitYaw-heading;
 if(target){
  const dx=target.x-x,dz=target.z-z;
  if(Math.hypot(dx,dz)>2)desired=Math.atan2(-dx,-dz)-heading;
 }
 const diff=Math.atan2(Math.sin(desired-tower.rotation.y),Math.cos(desired-tower.rotation.y));
 tower.rotation.y+=THREE.MathUtils.clamp(diff,-(areaAim.active?2.6:1.7)*dt,(areaAim.active?2.6:1.7)*dt);
}
shadow.position.set(x,height(x,z,t)+.14,z);
// Jatos de motor simulados por GPU, sincronizados com a propulsão.
for(const rotor of ship.userData.rotors||[])rotor.rotation.z=t*(3+Math.abs(speed)*.24);
for(const jet of ship.userData.engineFlames||[]){
 jet.material.uniforms.uTime.value=t;
 jet.material.uniforms.uPower.value=Math.max(.18,Math.min(1,Math.abs(speed)/42))*(boostRemaining>0?1.35:1);
 const length=boostRemaining>0?1.7:.65+Math.abs(speed)/100;
 jet.flame.scale.y=length;jet.flameCross.scale.y=length;
}
// Frota de NPCs: patrulha independente, bob nas ondas e separação física.
let nearest=null,nearestDistance=weaponRange();
for(const enemy of enemies){
 const distanceToPlayer=Math.hypot(x-enemy.x,z-enemy.z);
 if(enemy.hp<=0){enemy.state='destroyed';if(enemy.sprite)enemy.sprite.visible=false;if(enemy.model)enemy.model.visible=false;continue;}
 const ai=enemy.ai;
 // Percepção imperfeita: cada inimigo estima a velocidade do jogador com atraso.
 const role=(enemy.id-1)%3;
 const sense=(enemy.veteran?6.8:3.1+role*1.2);
 const blend=1-Math.exp(-sense*dt);
 ai.estimateVx+=(hullPhysics.vx-ai.estimateVx)*blend;
 ai.estimateVz+=(hullPhysics.vz-ai.estimateVz)*blend;
 if(t>=ai.nextPlanTime||!ai.plan){
  ai.plan=planEnemy(enemy,{x,z,heading,speed,vx:hullPhysics.vx,vz:hullPhysics.vz,alive:playerCombat.hp>0},enemies,t,horizon.colliders);
  // Caçada ativa durante toda a missão: usam propulsão e direção físicas,
  // sem teleporte e sem acerto automático.
  if(!mission.failed&&playerCombat.hp>0){
   const distance=Math.hypot(x-enemy.x,z-enemy.z);
   if((enemy.clearAreaWave!==undefined&&mission.stage===3)||(enemy.extractionWave!==undefined&&mission.stage===13)){
    // NPCs desta missão caçam o jogador desde o spawn; não retornam à patrulha.
    ai.plan={...ai.plan,goalX:x,goalZ:z,active:true,
     speed:enemy.extractionWave!==undefined?49:enemy.veteran?47:39,state:distance<190?'attack':'pursuit',intent:'pursuit'};
   }else if(ai.plan.intent!=='withdraw'){
    ai.plan={...ai.plan,goalX:x,goalZ:z,active:distance<325,
     speed:Math.max(ai.plan.speed,Math.min(enemy.veteran?52:43,29+distance*.016)),
     state:distance<325?'attack':'pursuit',intent:'pursuit'};
   }
  }
  ai.intent=ai.plan.intent;ai.nextPlanTime=t+(enemy.veteran?.16:.32+(enemy.id%3)*.055);
 }
 const tactic=ai.plan;
 enemy.state=tactic.state;
 // Regeneração começa após 60 segundos sem combate; +5 HP a cada 15 s depois disso.
 if(tactic.active){enemy.lastCombatAt=t;enemy.nextRegenAt=t+75;}
 else if(enemy.hp<enemy.maxHp&&t-enemy.lastCombatAt>=60&&t>=enemy.nextRegenAt){
  enemy.hp=Math.min(enemy.maxHp,enemy.hp+5);
  enemy.nextRegenAt=t+15;
 }
 // Olha a trajetória de projéteis já disparados, sem telepatia.
 const threat=tactic.active&&t>=ai.nextDash?assessProjectileThreat(enemy,projectiles,1.4):null;
 if(threat){
  if(ai.trackedShot!==threat.projectile){
   ai.trackedShot=threat.projectile;ai.detectedAt=t;
   // Alguns pilotos hesitam ou erram a leitura: nenhuma esquiva é garantida.
   const instinct=.70+role*.075;
   ai.willEvade=(Math.abs(Math.sin(t*17.3+enemy.id*4.91))<instinct);
  }
  const reaction=role===2?.20:role===1?.28:.38;
  if(ai.willEvade&&t-ai.detectedAt>=reaction&&threat.time>.13){
   let direction=evadeVector(enemy,threat,enemy.id%2?1:-1);
   if(threat.projectile.ammo==='meteor'||threat.projectile.ammo==='siege'||threat.projectile.ammo==='scatter'){
    const ax=enemy.x-threat.hitX,az=enemy.z-threat.hitZ;
    const len=Math.hypot(ax,az)||1;direction={x:ax/len,z:az/len};
   }
   // Entre duas laterais, escolhe uma que não acabe dentro de uma ruína.
   const evaluate=(dir)=>horizon.colliders.reduce((cost,obstacle)=>{
    const px=enemy.x+dir.x*31,pz=enemy.z+dir.z*31;
    const clearance=Math.hypot(px-obstacle.x,pz-obstacle.z)-obstacle.radius-7;
    return cost+Math.max(0,20-clearance);
   },0);
   const opposite={x:-direction.x,z:-direction.z};
   if(evaluate(opposite)+3<evaluate(direction))direction=opposite;
   ai.dashX=direction.x;ai.dashZ=direction.z;ai.dashUntil=t+.6;
   ai.nextDash=t+5.5+(enemy.id%3)*.8;
   ai.trackedShot=null;
   enemy.nextShot=Math.max(enemy.nextShot,t+.55);
   enemy.state='evade';
  }
 }else if(t>=ai.dashUntil){ai.trackedShot=null;}
 const dodging=t<ai.dashUntil;
 if(dodging){
  enemy.state='evade';
  // Rastro curto de água para sinalizar o impulso lateral, sem novos sistemas.
  if(t>=ai.nextWake){emitWake(enemy.x,enemy.z,t,true);ai.nextWake=t+.23;}
 }
 // O piloto aponta o leme para o objetivo escolhido pela IA.
 // Fugir não muda diretamente x/z: requer aceleração e tempo de manobra.
 const oldEnemyX=enemy.x,oldEnemyZ=enemy.z;
 enemy.previousX=oldEnemyX;enemy.previousZ=oldEnemyZ;
 // Kits são exclusivos do jogador.
 const navigation=tactic;
 const stunned=t<(enemy.stunnedUntil||0);
 const controls=stunned?{angle:0,rate:0,targetSpeed:0,boostSpeed:0}:steerNpc(enemy,navigation,horizon.colliders,dodging);
 if(stunned){ai.body.vx=0;ai.body.vz=0;enemy.vx=0;enemy.vz=0;}
 enemy.heading+=THREE.MathUtils.clamp(controls.angle,
  -controls.rate*dt,controls.rate*dt);
 const body=ai.body;
 body.x=enemy.x;body.z=enemy.z;
 const moved=integrateHull(body,{heading:enemy.heading,
  targetSpeed:controls.targetSpeed,boostSpeed:controls.boostSpeed,dt});
 // Obstáculos são sólidos: varredura contra círculos, sem teleportes de fuga.
 const mx=moved.x-oldEnemyX,mz=moved.z-oldEnemyZ,lengthSq=mx*mx+mz*mz;
 let first=1,contactX=0,contactZ=0;
 for(const obstacle of horizon.colliders){
  const radius=obstacle.radius+5.8;
  const rx=oldEnemyX-obstacle.x,rz=oldEnemyZ-obstacle.z;
  const startSq=rx*rx+rz*rz;
  if(startSq<radius*radius){
   const outward=mx*rx+mz*rz;
   if(outward<0){
    const len=Math.sqrt(startSq)||1,nx=rx/len,nz=rz/len;
    // Uma sobreposição prévia não permite avançar ainda mais para dentro.
    const inward=mx*nx+mz*nz;
    body.x-=Math.min(0,inward)*nx;
    body.z-=Math.min(0,inward)*nz;
   }
   continue;
  }
  if(lengthSq<1e-8)continue;
  const b=2*(rx*mx+rz*mz),c=startSq-radius*radius;
  const disc=b*b-4*lengthSq*c;
  if(disc<0)continue;
  const fraction=(-b-Math.sqrt(disc))/(2*lengthSq);
  if(fraction<0||fraction>=first)continue;
  first=fraction;
  const hx=oldEnemyX+mx*fraction-obstacle.x;
  const hz=oldEnemyZ+mz*fraction-obstacle.z;
  const h=Math.hypot(hx,hz)||1;
  contactX=hx/h;contactZ=hz/h;
 }
 if(first<1){
  body.x=oldEnemyX+mx*Math.max(0,first-.002);
  body.z=oldEnemyZ+mz*Math.max(0,first-.002);
  const normalSpeed=Math.min(0,body.vx*contactX+body.vz*contactZ);
  body.vx-=normalSpeed*contactX;
  body.vz-=normalSpeed*contactZ;
 }
 enemy.x=body.x;enemy.z=body.z;
 enemy.vx=body.vx;enemy.vz=body.vz;
 // Solução de interceptação por velocidade REAL observada e tempo de voo.
 // Cada piloto reavalia o arsenal em intervalos curtos. A pontuação matemática
 // escolhe a maior P(acerto) dentre as armas ALCANÇÁVEIS e disponíveis.
 // Inércia perceptiva: decisões não mudam freneticamente a cada quadro.
 const skill=role===2?.92:role===1?.84:.77;
 const estimate={x:ai.estimateVx*skill,z:ai.estimateVz*skill};
 if(t-ai.lastChoiceAt>.16||!ai.choice){
  ai.lastChoiceAt=t;
  const blocked=(origin,point,weaponId)=>{
   if(weaponId!=='torpedo'&&weaponId!=='plasma'&&weaponId!=='iron')return false;
   const ux=point.x-origin.x,uz=point.z-origin.z,lenSq=ux*ux+uz*uz;
   if(lenSq<1)return false;
   for(const obstacle of horizon.colliders){
    // Ponto mais próximo ao segmento direto; ignora estruturas atrás do tiro.
    const projection=THREE.MathUtils.clamp(((obstacle.x-origin.x)*ux+(obstacle.z-origin.z)*uz)/lenSq,0,1);
    const cx=origin.x+projection*ux,cz=origin.z+projection*uz;
    const collisionRadius=obstacle.radius+(weaponId==='torpedo'?2:0);
    if(Math.hypot(obstacle.x-cx,obstacle.z-cz)<collisionRadius)return true;
   }
   return false;
  };
  ai.choice=chooseNpcWeapon({x:enemy.x,z:enemy.z},{x,z},estimate,ai.weaponReadyAt,t,{
   skill,instability:Math.abs(steering)*40,
   blocked
  });
 }
 const choice=ai.choice;
 const aim=choice||predictIntercept({x:enemy.x,z:enemy.z},{x,z},estimate,140,2.2);
 ai.aimX=choice?.aimX??aim.x;ai.aimZ=choice?.aimZ??aim.z;
 if(choice&&tactic.active&&!dodging&&t>=(enemy.stunnedUntil||0)&&canEnemyFire(enemy,enemies,enemyShots,t,playerCombat.hp)){
  const turret=enemy.model.userData.turretPivot;
  const desiredGun=Math.atan2(-(choice.aimX-enemy.x),-(choice.aimZ-enemy.z))-enemy.heading;
  const gunError=turret?Math.abs(Math.atan2(Math.sin(desiredGun-turret.rotation.y),Math.cos(desiredGun-turret.rotation.y))):0;
  if(gunError<.32){
   const weapon=choice.weapon;
   const gunAngle=enemy.heading+(turret?.rotation.y||0);
   const origin=new THREE.Vector3(enemy.x-Math.sin(gunAngle)*5.4,
       weapon.mode==='torpedo'?height(enemy.x,enemy.z,t)+.65:enemy.y+3.3,
       enemy.z-Math.cos(gunAngle)*5.4);
   // A previsão é recalculada a partir da boca do canhão no instante real do tiro.
   const shotChoice=chooseNpcWeapon(origin,{x,z},estimate,{[choice.id]:0},t,{
     weapons:{[choice.id]:weapon},skill,instability:Math.abs(steering)*40
   });
   if(shotChoice){
    const deviation=weapon.spread*(1.15-skill*.6)+(enemy.hp<=25?3:0);
    const vx=Math.sin(t*4.3+enemy.id*13.7),vz=Math.cos(t*3.1+enemy.id*7.1);
    const predicted=new THREE.Vector3(shotChoice.aimX+vx*deviation,
     weapon.mode==='torpedo'?height(shotChoice.aimX,shotChoice.aimZ,t)+.65:bob+2.3,
     shotChoice.aimZ+vz*deviation);
    const flight=shotChoice.flight;
    const spawnShot=(destination,extraTime=0,secondary=false)=>{
     const mesh=new THREE.Group();
     const coreMat=new THREE.MeshBasicMaterial({color:weapon.color,toneMapped:false});
     const core=new THREE.Mesh(energyCoreGeometry,coreMat);
     const plasma=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05,1),plasmaMaterial);
     const glowMat=energyGlowMaterial.clone();
     glowMat.uniforms.uColor.value.setHex(weapon.color);
     const glow=new THREE.Mesh(energyGlowGeometry,glowMat);
     const outerGlow=new THREE.Mesh(energyGlowGeometry,glowMat);
     outerGlow.scale.setScalar(1.9);
     mesh.add(core,plasma,glow,outerGlow);
     mesh.position.copy(origin);scene.add(mesh);
     const trailPoints=Array.from({length:12},()=>origin.clone());
     const trailMat=new THREE.LineBasicMaterial({color:weapon.color,transparent:true,opacity:.85,
      blending:THREE.AdditiveBlending,depthWrite:false});
     const trail=new THREE.Line(new THREE.BufferGeometry().setFromPoints(trailPoints),trailMat);
     scene.add(trail);
     let warning=null;
     if(weapon.mode==='area'){
      warning=new THREE.Mesh(new THREE.RingGeometry(weapon.radius*.88,weapon.radius,40),
       new THREE.MeshBasicMaterial({color:weapon.color,transparent:true,opacity:.38,
         depthWrite:false,side:THREE.DoubleSide}));
      warning.rotation.x=-Math.PI/2;
      warning.position.set(destination.x,height(destination.x,destination.z,t)+.28,destination.z);
      scene.add(warning);
     }
     enemyShots.push({weaponId:choice.id,weapon,mesh,glow,outerGlow,plasma,core,
       trail,trailPoints,origin:origin.clone(),destination:destination.clone(),arcHeight:0,
       age:0,duration:flight+extraTime,source:enemy.id,warning,coreMat,glowMat,trailMat,
       secondary,hitDamage:(secondary?Math.max(2,Math.round(weapon.damage*.65)):weapon.damage)*(enemy.boss?2.7:1)});
    };
    spawnShot(predicted);
    if(choice.id==='scatter'){
     // Chuva: três munições em tempos/espaços próximos, nunca dano automático.
     const angle=Math.atan2(predicted.z-origin.z,predicted.x-origin.x);
     const perpendicularX=-Math.sin(angle),perpendicularZ=Math.cos(angle);
     for(const side of [-1,1]){
      const dest=predicted.clone().add(new THREE.Vector3(perpendicularX*side*8,0,perpendicularZ*side*8));
      spawnShot(dest,side<0?.16:.32,true);
     }
    }
    enemy.model.userData.recoil=.34;enemy.model.userData.flashTime=.13;
    ai.weaponReadyAt[choice.id]=t+weapon.cooldown;
    ai.currentWeapon=choice.id;
    ai.choice=null;ai.lastChoiceAt=-100;
    // Nenhum cooldown global: cada arma controla sua própria disponibilidade.
   }
  }
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
 // NPCs apontam a torre para o jogador durante o combate, independentemente do casco.
 animateGun(enemy.model,dt);
 const npcTurret=enemy.model.userData.turretPivot;
 if(npcTurret){
  const dx=ai.aimX-enemy.x,dz=ai.aimZ-enemy.z;
  const desired=tactic.active?Math.atan2(-dx,-dz)-enemy.heading:0;
  const diff=Math.atan2(Math.sin(desired-npcTurret.rotation.y),Math.cos(desired-npcTurret.rotation.y));
  npcTurret.rotation.y+=THREE.MathUtils.clamp(diff,-1.65*dt,1.65*dt);
 }
 for(const rotor of enemy.model.userData.rotors||[])rotor.rotation.z=t*(3+tactic.speed*.24)+enemy.phase;
 for(const jet of enemy.model.userData.engineFlames||[]){
  jet.material.uniforms.uTime.value=t+enemy.phase;
  jet.material.uniforms.uPower.value=dodging?1.25:Math.max(.24,Math.min(1,tactic.speed/65));
  jet.flame.scale.y=dodging?1.45:.75+tactic.speed/95;jet.flameCross.scale.y=jet.flame.scale.y;
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
refreshCompass(t);
targetRing.visible=!!lockedNpc;
if(lockedNpc)targetRing.position.set(lockedNpc.x,height(lockedNpc.x,lockedNpc.z,t)+.18,lockedNpc.z);
lockLabel.textContent=lockedNpc?'ALVO TRAVADO · '+lockedNpc.name+' · '+lockedNpc.hp+'/'+COMBAT.npcMaxHp+' HP'+(lockedNpc.state==='evade'?' · ESQUIVA 🚀':lockedNpc.state==='withdraw'?' · RECUANDO':lockedNpc.state==='regroup'?' · BUSCANDO APOIO':'')+(lockedNpc.ai.currentWeapon?' · '+NPC_WEAPONS[lockedNpc.ai.currentWeapon].name:''):'Procurando alvo...';
// Estado de recarga do botão é atualizado no fechamento do frame.
// Antigo protótipo oculto: somente a máquina 3D deve aparecer.
npc.visible=false;
npcShadow.visible=false;
ship.position.x=x;ship.position.z=z;
// NPCs atacam com seis armamentos de trajetórias e riscos diferentes.
// Nenhum projétil recalcula o alvo depois de disparado: é possível desviar.
for(let i=enemyShots.length-1;i>=0;i--){
 const shot=enemyShots[i],weapon=shot.weapon;
 const oldShot=shot.mesh.position.clone();
 shot.age+=dt;
 const progress=Math.min(1,shot.age/shot.duration);
 const previousTime=(shot.age-dt);
 const mode=weapon.mode;
 shot.mesh.position.lerpVectors(shot.origin,shot.destination,progress);
 if(mode==='torpedo'){
  shot.mesh.position.y=height(shot.mesh.position.x,shot.mesh.position.z,t)+.65;
 }else if(mode==='area'){
  const apex=shot.weaponId==='siege'?48:shot.weaponId==='meteor'?38:17;
  shot.mesh.position.y+=Math.sin(progress*Math.PI)*apex;
 }
 shot.glow.quaternion.copy(camera.quaternion);
 shot.outerGlow.quaternion.copy(camera.quaternion);
 shot.plasma.rotation.set(t*6,t*9,t*5);
 if(shot.warning){
  const remaining=1-progress;
  shot.warning.position.y=height(shot.destination.x,shot.destination.z,t)+.3;
  shot.warning.material.opacity=.18+.25*(.5+.5*Math.sin(t*9+shot.source))*Math.min(1,remaining*5);
 }
 shot.trailPoints.pop();shot.trailPoints.unshift(shot.mesh.position.clone());
 const arr=shot.trail.geometry.attributes.position.array;
 for(let j=0;j<shot.trailPoints.length;j++){const v=shot.trailPoints[j];arr[j*3]=v.x;arr[j*3+1]=v.y;arr[j*3+2]=v.z;}
 shot.trail.geometry.attributes.position.needsUpdate=true;
 const direct=mode!=='area';
 const swept=direct?sweptMovingContact(oldShot,shot.mesh.position,
  {x:collisionStartX,z:collisionStartZ},{x,z},mode==='torpedo'?6.8:5.7):null;
 const crossingY=swept?oldShot.y+(shot.mesh.position.y-oldShot.y)*swept.fraction:0;
 const playerHit=direct&&playerCombat.hp>0&&swept.hit&&
  Math.abs(crossingY-(bob+2.3))<(mode==='torpedo'?6:5.5);
 let obstacleHit=false,obstacleFraction=Infinity;
 // Um torpedo só detona contra um objeto físico (nave ou estrutura).
 if(direct){
  for(const obstacle of horizon.colliders){
   const test=sweptMovingContact(oldShot,shot.mesh.position,
    {x:obstacle.x,z:obstacle.z},{x:obstacle.x,z:obstacle.z},
    obstacle.radius+(mode==='torpedo'?1.3:.7));
   if(test.hit&&test.fraction<obstacleFraction){
    obstacleHit=true;obstacleFraction=test.fraction;
   }
  }
 }
 const playerFirst=playerHit&&(!obstacleHit||swept.fraction<=obstacleFraction);
 if(playerFirst)shot.mesh.position.lerpVectors(oldShot,shot.mesh.position,swept.fraction);
 else if(obstacleHit)shot.mesh.position.lerpVectors(oldShot,shot.mesh.position,obstacleFraction);
 const collided=playerFirst||obstacleHit;
 const areaBlast=mode==='area'&&progress>=1;
 const torpedoBlast=mode==='torpedo'&&collided;
 const blast=areaBlast||torpedoBlast;
 const blastRadius=weapon.blast||weapon.radius;
 const playerDistance=Math.hypot(x-shot.mesh.position.x,z-shot.mesh.position.z);
 const damageHit=mode==='torpedo'?torpedoBlast&&playerDistance<=blastRadius:
   mode==='area'?areaBlast&&playerDistance<=blastRadius:playerFirst;
 if(damageHit&&t>=playerCombat.invulnerableUntil&&t>=shieldUntil&&playerCombat.hp>0){
  playerCombat.hp=Math.max(0,playerCombat.hp-shot.hitDamage*(1-economy.armor*.05));
  playerCombat.lastDamageAt=t;hitFeedback=1;
  attackCamera.shake=Math.max(attackCamera.shake,.44);
  playerCombat.invulnerableUntil=t+.45;
  audio.play('impact');
  if(playerCombat.hp<=0){
   playerCombat.deathX=x;playerCombat.deathZ=z;playerCombat.deathHeading=heading;
   playerCombat.respawnAt=t+3;speed=0;boostActive=false;
   hullPhysics.vx=0;hullPhysics.vz=0;
   ship.visible=false;cancelAreaAim();
   for(let burst=0;burst<6;burst++)energyFlash(new THREE.Vector3(x+(Math.random()-.5)*7,bob+2+Math.random()*5,z+(Math.random()-.5)*7));
   notifyCombat('NAVE DESTRUÍDA · RETORNO EM 3s',3);
  }
 }
 if(blast||collided){energyFlash(shot.mesh.position);}
 if(blast||collided||progress>=1){
  discardEnemyShot(shot);enemyShots.splice(i,1);
 }
}
if(playerCombat.hp<=0){
 // Sem respawn automático: derrota exige nova tentativa.
 playerCombat.respawnAt=0;ship.visible=false;
 hullPhysics.vx=0;hullPhysics.vz=0;speed=0;boostActive=false;
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
// Dano legível na borda da tela, sem cobrir joystick, tiro ou nave.
hitFeedback=Math.max(0,hitFeedback-dt*1.9);
hitOverlay.style.opacity=String(hitFeedback*.85);
if(noticeUntil>0&&t>=noticeUntil){noticeUntil=0;combatNotice.style.opacity='0';}
const remaining=weaponRemaining();
threatShotCount=enemyShots.filter(shot=>shot.age<shot.duration).length;
threatStatus.classList.toggle('incoming',threatShotCount>0);
if(threatShotCount>0)threatStatus.textContent='⚠ '+threatShotCount+' DISPARO'+(threatShotCount>1?'S':'')+' HOSTIL'+(threatShotCount>1?'S':'')+' NO AR';
if(!areaAim.active)fireButton.textContent=playerCombat.hp<=0?'REPARANDO':remaining>0?'RECARGA '+remaining.toFixed(1)+'s':'DISPARAR';
fireButton.setAttribute('aria-label',selectedAmmo.name+' · '+(remaining>0?'recarga '+remaining.toFixed(1)+' segundos':'segure para mirar e solte para disparar'));
fireButton.style.setProperty('--ready',String(1-remaining/currentWeapon().cooldown));
fireButton.dataset.ready=remaining<=0?'true':'false';
fireButton.disabled=remaining>0||playerCombat.hp<=0;
// A recuperação depende exclusivamente de kits recolhidos no mar.
// Atualização da barra ocorre após o posicionamento final da câmera.
energyGlowMaterial.uniforms.uTime.value=t;plasmaMaterial.uniforms.uTime.value=t;
for(let i=projectiles.length-1;i>=0;i--){
  const p=projectiles[i];
  const previousPosition=p.mesh.position.clone();
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
  }else if(p.ammo==='torpedo'){
   p.mesh.position.lerpVectors(p.origin,p.destination,u);
   p.mesh.position.y=height(p.mesh.position.x,p.mesh.position.z,t)+.55;
   p.foamTimer+=dt;
   if(p.foamTimer>=.12){p.foamTimer=0;emitWake(p.mesh.position.x,p.mesh.position.z,t,false);}
  }else if(p.ammo==='plasma'||p.ammo==='iron'||p.ammo==='energyBomb'){
   p.mesh.position.lerpVectors(p.origin,p.destination,u);
  }else{
   ballisticPoint(p.origin,p.destination,p.travel,p.age,p.arcHeight,p.mesh.position);
  }
  // Tiros diretos só atingem se a bala cruzar fisicamente o casco do NPC.
  // A varredura é RELATIVA: o alvo também pode se mover ou usar dash.
  const directShot=p.ammo==='torpedo'||p.ammo==='plasma'||p.ammo==='iron'||p.ammo==='energyBomb';
  let physicalImpact=null,physicalFraction=Infinity;
  if(directShot){
   for(const enemy of enemies){
    if(enemy.hp<=0)continue;
    const contact=sweptMovingContact(previousPosition,p.mesh.position,
     {x:enemy.previousX??enemy.x,z:enemy.previousZ??enemy.z},
     {x:enemy.x,z:enemy.z},p.ammo==='torpedo'?9.2:8.5);
    if(!contact.hit||contact.fraction>=physicalFraction)continue;
    const shotY=previousPosition.y+(p.mesh.position.y-previousPosition.y)*contact.fraction;
    if(p.ammo!=='torpedo'&&Math.abs(shotY-(enemy.y+2.5))>8)continue;
    physicalImpact=enemy;physicalFraction=contact.fraction;
   }
   if(p.ammo==='torpedo'){
    for(const obstacle of horizon.colliders){
     const contact=sweptMovingContact(previousPosition,p.mesh.position,
      {x:obstacle.x,z:obstacle.z},{x:obstacle.x,z:obstacle.z},obstacle.radius+1.3);
     if(contact.hit&&contact.fraction<physicalFraction){
      physicalImpact=obstacle;physicalFraction=contact.fraction;
     }
    }
   }
   if(physicalImpact){
    p.mesh.position.lerpVectors(previousPosition,p.mesh.position,physicalFraction);
    if(p.ammo==='torpedo')p.mesh.position.y=height(p.mesh.position.x,p.mesh.position.z,t)+.65;
   }
  }
  p.glow.quaternion.copy(camera.quaternion);p.outerGlow.quaternion.copy(camera.quaternion);
  if(p.plasma){p.plasma.rotation.set(t*6,t*9,t*5);p.plasma.scale.setScalar(1+.13*Math.sin(t*25));}
  p.trailPoints.pop();p.trailPoints.unshift(p.mesh.position.clone());
  const arr=p.trail.geometry.attributes.position.array;
  for(let j=0;j<p.trailPoints.length;j++){
    const v=p.trailPoints[j];arr[j*3]=v.x;arr[j*3+1]=v.y;arr[j*3+2]=v.z;
  }
  p.trail.geometry.attributes.position.needsUpdate=true;
  // Tiro direto que erra não causa dano. Apenas munições especiais
  // de impacto em área (meteor/scatter/siege) explodem ao chegar ao destino.
  // A base recebe somente impactos reais, um por projétil. Cinco acertos para neutralizar.
  if(mission.stage===11&&!mission.baseDestroyed&&!p.baseCounted){
   const hit=sweptMovingContact(previousPosition,p.mesh.position,
    {x:mission.baseX,z:mission.baseZ},{x:mission.baseX,z:mission.baseZ},62);
   const endHit=u>=1&&Math.hypot(p.destination.x-mission.baseX,p.destination.z-mission.baseZ)<62;
   if(hit.hit||endHit){
    p.baseCounted=true;mission.baseHits=Math.min(5,mission.baseHits+1);
    mission.baseDestroyed=mission.baseHits>=5;
    notifyCombat('BASE ATINGIDA · '+mission.baseHits+'/5',1.8);
    energyFlash(new THREE.Vector3(mission.baseX,height(mission.baseX,mission.baseZ,t)+22,mission.baseZ));
    if(mission.baseDestroyed)notifyCombat('ESTRUTURA NEUTRALIZADA · DERROTE AS SENTINELAS',4);
    p.age=p.travel;
   }
  }
  if(mission.stage===18&&p.ammo!=='torpedo'&&!p.subCounted){
   const dist=Math.hypot(p.mesh.position.x-mission.subX,p.mesh.position.z-mission.subZ);
   if(submarine.position.y>=height(mission.subX,mission.subZ,t)+4&&dist<17&&Math.abs(p.mesh.position.y-submarine.position.y)<12){
    p.subCounted=true;mission.subHp=Math.max(0,mission.subHp-(p.ammo==='energyBomb'?300:Math.max(1,p.damage||25)));
    p.age=p.travel;energyFlash(p.mesh.position);notifyCombat('SUBMARINO ATINGIDO · '+Math.ceil(mission.subHp)+' HP',2);
   }
  }
  const directExpired=directShot&&u>=1&&!physicalImpact&&!p.baseCounted&&!p.subCounted;
  if(u>=1||physicalImpact){
    if(directExpired){
      scene.remove(p.mesh,p.trail);p.trail.geometry.dispose();p.trail.material.dispose();
      for(const part of p.mesh.children){
        if(part.material!==energyCoreMaterial&&part.material!==energyGlowMaterial&&part.material!==plasmaMaterial)part.material.dispose();
      }
      projectiles.splice(i,1);
      continue;
    }
    if(physicalImpact)p.destination.copy(p.mesh.position);
    energyFlash(p.mesh.position);
    if(p.ammo==='torpedo'){
     // Anel de choque mostra o alcance real do torpedo no plano do oceano.
     const ring=new THREE.Mesh(new THREE.RingGeometry(51,55,40),new THREE.MeshBasicMaterial({color:0x91eeff,transparent:true,opacity:.56,side:THREE.DoubleSide,depthWrite:false}));
     ring.rotation.x=-Math.PI/2;ring.position.copy(p.mesh.position);ring.position.y+=.15;scene.add(ring);
     areaBursts.push({ring,burst:null,age:0});
    }
    // Confirmação de acerto pelo ponto real de impacto (sem dano apenas por travar alvo).
    for(const enemy of enemies){
      const epicenter=physicalImpact?p.mesh.position:p.destination;
      const distance=Math.hypot(enemy.x-epicenter.x,enemy.z-epicenter.z);
      const radius=WEAPON_STATS[p.ammo].impact;
      // Cada NPC só recebe um impacto por torpedo; a área vale para toda a frota.
      if(enemy.hp>0&&distance<=radius&&(!directShot||p.ammo==='torpedo'||physicalImpact===enemy)){
        const damage=p.ammo==='energyBomb'?Math.min(enemy.hp,Math.max(1,Math.ceil(enemy.maxHp*.25))):Math.min(enemy.hp,(p.damage??COMBAT.damage)*(enemy.boss?.42:1));
        audio.play('impact',Math.max(-1,Math.min(1,(enemy.x-x)/140)),Math.hypot(enemy.x-x,enemy.z-z));
        enemy.hp=Math.max(0,enemy.hp-damage);
        enemy.lastDamageAt=t;
        enemy.lastCombatAt=t;enemy.nextRegenAt=t+75;
        showDamage(enemy,damage);
        energyFlash(new THREE.Vector3(enemy.x,enemy.y+2.5,enemy.z));
        if(enemy.hp===0){
          enemy.state='destroyed';
          if(enemy.clearAreaWave!==undefined&&mission.stage===3)mission.clearDestroyed++;
          if(enemy.signalEnemy&&mission.stage===7)mission.signalKills++;
          if(enemy.baseEnemy&&mission.stage===11&&!enemy.boss)mission.defensesDown++;
          economy.scrap+=20+10*(enemy.id%4);saveEconomy();
          const survivors=enemies.filter(e=>e.hp>0).length;
          notifyCombat(survivors>0?'ALVO DESTRUÍDO · '+survivors+' RESTANTES':'OCEANO LIBERADO · VITÓRIA!',survivors>0?2:6);
          if(survivors===0&&mission.stage===4)wonBattle=true;
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
    scene.remove(p.mesh,p.trail);p.trail.geometry.dispose();if(p.ammo==='torpedo')p.trail.material.dispose();
    for(const part of p.mesh.children){if(part.material!==energyCoreMaterial && part.material!==energyGlowMaterial && part.material!==plasmaMaterial)part.material.dispose()}
    projectiles.splice(i,1);
  }
}
for(let i=areaBursts.length-1;i>=0;i--){
 const e=areaBursts[i];e.age+=dt;
 const fade=Math.max(0,1-e.age/.72);
 if(e.burst){
  e.burst.quaternion.copy(camera.quaternion);e.burst.material.uniforms.uTime.value=t;
  e.burst.material.uniforms.uOpacity.value=fade;e.burst.scale.setScalar(5+e.age*15);
 }
 e.ring.scale.setScalar(e.burst ? .5+e.age*1.15 : .55+e.age*.8);
 e.ring.material.opacity=fade*.65;
 if(e.age>=.72){scene.remove(e.ring);e.ring.material.dispose();if(e.burst){scene.remove(e.burst);e.burst.material.dispose();}areaBursts.splice(i,1)}
}
if(areaAim.active&&areaAim.valid){areaAim.point.y=height(areaAim.point.x,areaAim.point.z,t)+.35;aimReticle.position.copy(areaAim.point);aimReticle.rotation.y+=dt*.35;const scale=selectedAmmo.id==='siege'?1:.35;aimReticle.scale.setScalar(scale)}
for(let i=impactEffects.length-1;i>=0;i--){
 const e=impactEffects[i];e.age+=dt;e.flash.quaternion.copy(camera.quaternion);e.ring.quaternion.copy(camera.quaternion);
 const fade=Math.max(0,1-e.age/.40);
 e.flash.material.uniforms.uTime.value=t;e.flash.material.uniforms.uOpacity.value=fade;
 e.flash.scale.setScalar(1.6+e.age*7);e.ring.scale.setScalar(1+e.age*16);e.ring.material.opacity=fade*.85;
 const pos=e.sparks.geometry.attributes.position;
 for(let j=0;j<e.velocities.length;j++){const v=e.velocities[j];pos.setXYZ(j,v.x*e.age,v.y*e.age-11*e.age*e.age,v.z*e.age)}
 pos.needsUpdate=true;e.sparks.material.opacity=fade;
 if(e.age>=.40){scene.remove(e.flash,e.ring,e.sparks);e.flash.material.dispose();e.ring.material.dispose();e.sparks.material.dispose();e.sparks.geometry.dispose();impactEffects.splice(i,1)}
}

// A malha acompanha o jogador com fases de onda em coordenadas globais. 
water.position.set(x,0,z);uniforms.uOffset.value.set(x,z);
if(moonMesh.visible){moonMesh.position.set(x+moonDirection.x*650,moonDirection.y*650,z+moonDirection.z*650);moonMesh.lookAt(camera.position);}
horizon.update(x,z,t,height);
// Câmera de ação: afastada, baixa, horizonte aparente e horizonte estável.
// Inclinação de observação menor do que a do protótipo anterior para evitar vista quase vertical.
// Não copiar bob/pitch/roll do casco para câmera (previne enjoo visual).
// Câmera de perseguição baixa: olhar quase horizontal com proa no terço inferior.
// Distância moderada mantém o jogador legível no celular; ponto focal remoto revela o céu.
// Semi top-down: inclinação ~55° abaixo do horizonte, enquadramento centrado.
// Enquadramento compacto: nave ocupa cerca de 30% da altura da tela.
// Câmera de ação baixa: preserva o horizonte sem diminuir muito a nave.
// Câmera normal: traseira fixa, horizonte visível e arrasto preservado.
// Câmera arcade: modelo maior na tela e abertura gradual conforme acelera.
// Câmera aérea de filmagem com orientação imutável no mundo.
// Translada com a posição XZ do jogador, sem copiar heading, ondas ou tiros.
// Acompanhamento inteligente da torreta: mira travada orienta lentamente
// a observação para que o alvo não desapareça atrás da nave.
// O arrasto manual sempre tem prioridade e suspende o acompanhamento por 3,5 s.
if(orbitPointer===null&&t>=orbitManualUntil&&lockedNpc&&lockedNpc.hp>0&&playerCombat.hp>0&&!areaAim.active){
 const dx=lockedNpc.x-x,dz=lockedNpc.z-z;
 const distanceToTarget=Math.hypot(dx,dz);
 if(distanceToTarget>8&&distanceToTarget<weaponRange()){
  const desiredYaw=Math.atan2(-dx,-dz);
  const delta=Math.atan2(Math.sin(desiredYaw-orbitYaw),Math.cos(desiredYaw-orbitYaw));
  orbitYaw+=delta*(1-Math.exp(-1.65*dt));
 }
}
// Enquadramento inspirado na referência: perspectiva baixa, horizonte visível
// e bastante mar à frente. A nave ocupa o terço inferior da imagem.
// Orientação permanece fixa no mundo, sem seguir a rotação do casco.
camera.position.set(x+Math.sin(orbitYaw)*25,14,z+Math.cos(orbitYaw)*25);
camTarget.set(x-Math.sin(orbitYaw)*44,4,z-Math.cos(orbitYaw)*44);
camera.lookAt(camTarget);
cameraReady=true;
if(attackCamera.phase==='flight'&&attackCamera.shot){
 const p=attackCamera.shot,elapsed=t-attackCamera.startedAt;
 if(elapsed>1.6||p.age>=p.travel||orbitPointer!==null){
  attackCamera.phase='impact';attackCamera.impactAt=t;attackCamera.shot=null;
 }else{
  const dx=p.destination.x-p.origin.x,dz=p.destination.z-p.origin.z;
  const len=Math.max(1,Math.hypot(dx,dz));
  shotView.set(p.mesh.position.x-dx/len*20,p.mesh.position.y+11,p.mesh.position.z-dz/len*20);
  shotLook.set(p.mesh.position.x+dx/len*24,p.mesh.position.y+2,p.mesh.position.z+dz/len*24);
  attackCamera.blend=Math.min(.85,attackCamera.blend+dt*3);
  camera.position.lerp(shotView,attackCamera.blend);
  camTarget.lerp(shotLook,attackCamera.blend);
  camera.lookAt(camTarget);
 }
}else if(attackCamera.phase==='impact'){
 attackCamera.blend=Math.max(0,attackCamera.blend-dt*3);
 if(attackCamera.blend===0||t-attackCamera.impactAt>.4)attackCamera.phase='idle';
}
attackCamera.shake=0;
areaAim.viewBlend=0;
updateRepairKits(t);
updateSpecialDrops(dt,t);
updateHealZones(dt,t);
updateMines(t);
updateEnemyMines(t);
updateMission(dt,t);
refreshPlayerHealth();
if(attackCamera.phase==='idle' && attackCamera.blend===0){attackCamera.target=null;attackCamera.launchOrigin=null;}
document.getElementById('status').textContent=(speed<-.5?'Ré: ':'Velocidade: ')+Math.round(Math.abs(speed))+'  |  Mar '+(currentSeaIntensity<.24?'calmo':currentSeaIntensity<.37?'médio':'bravinho');
renderer.render(scene,camera);
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);applyGraphicsQuality();});
try{
 const stored=JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||'null');
 if(stored&&Array.isArray(stored.enemies)&&stored.mission&&Number.isFinite(stored.x)){
  if(stored.enemies.length!==enemies.length){stored.enemies=enemies.map((e,i)=>stored.enemies[i]||{x:e.x,z:e.z,heading:e.heading,hp:e.hp,maxHp:e.maxHp,dormant:e.dormant,state:e.state});}
  checkpoint=stored;restartCheckpoint();
 }else saveCheckpoint();
}catch{saveCheckpoint();}
document.getElementById('loading').remove();tick();