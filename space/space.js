import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
const scene=new THREE.Scene();scene.background=new THREE.Color(0x020712);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,3000);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x96baff,0x101020,2));
const sun=new THREE.DirectionalLight(0xb5c9ff,2.4);sun.position.set(-90,130,-100);scene.add(sun);
const starGeo=new THREE.BufferGeometry(),starArray=[];
for(let i=0;i<1900;i++){const a=Math.random()*Math.PI*2,b=(Math.random()-.5)*Math.PI,r=250+Math.random()*1300;starArray.push(Math.sin(a)*Math.cos(b)*r,Math.sin(b)*r,Math.cos(a)*Math.cos(b)*r)}
starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starArray,3));
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xeaf7ff,size:2.4,sizeAttenuation:false,transparent:true,opacity:.85,depthWrite:false}));scene.add(stars);
const planet=new THREE.Mesh(new THREE.SphereGeometry(120,48,32),new THREE.MeshStandardMaterial({color:0x27599e,emissive:0x081d47,metalness:.15,roughness:.8}));
planet.position.set(-430,-195,-850);scene.add(planet);
const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(129,48,32),new THREE.MeshBasicMaterial({color:0x2855bb,transparent:true,opacity:.11,side:THREE.BackSide,depthWrite:false}));
atmosphere.position.copy(planet.position);scene.add(atmosphere);
const astMat=new THREE.MeshStandardMaterial({color:0x667283,roughness:.94,flatShading:true});
const asteroids=[];for(let i=0;i<60;i++){const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(4+Math.random()*12,1),astMat);let angle=Math.random()*Math.PI*2,dist=140+Math.random()*680;mesh.position.set(Math.sin(angle)*dist,(Math.random()-.5)*130,Math.cos(angle)*dist);mesh.rotation.set(Math.random()*5,Math.random()*5,Math.random()*5);scene.add(mesh);asteroids.push(mesh)}
const hullMat=new THREE.MeshStandardMaterial({color:0xabc9e0,metalness:.72,roughness:.26});
const darkMat=new THREE.MeshStandardMaterial({color:0x203b59,metalness:.75,roughness:.4});
const glassMat=new THREE.MeshStandardMaterial({color:0x14cffa,emissive:0x0799d8,emissiveIntensity:.8,metalness:.15});
const enemyHull=new THREE.MeshStandardMaterial({color:0xe47177,metalness:.7,roughness:.34});
const enemyGlow=new THREE.MeshStandardMaterial({color:0xff6b36,emissive:0xff3915,emissiveIntensity:1.7});
function shipModel(enemy=false){const group=new THREE.Group();
 const body=new THREE.Mesh(new THREE.ConeGeometry(4.3,15,5),enemy?enemyHull:hullMat);body.rotation.x=-Math.PI/2;body.position.z=-1.7;group.add(body);
 const spine=new THREE.Mesh(new THREE.BoxGeometry(5,2.3,13),darkMat);spine.position.z=2;group.add(spine);
 const cockpit=new THREE.Mesh(new THREE.SphereGeometry(2.6,12,8),enemy?enemyGlow:glassMat);cockpit.scale.set(.9,.47,1.5);cockpit.position.set(0,2,-.7);group.add(cockpit);
 for(const side of [-1,1]){const wing=new THREE.Mesh(new THREE.BoxGeometry(8,.7,7),enemy?enemyHull:hullMat);wing.position.set(side*7.2,0,3);wing.rotation.y=side*.19;group.add(wing);
 const engine=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.8,4.5,10),darkMat);engine.rotation.x=Math.PI/2;engine.position.set(side*4.4,-.4,8);group.add(engine);
 const flare=new THREE.Mesh(new THREE.SphereGeometry(1.2,10,8),enemy?enemyGlow:glassMat);flare.position.set(side*4.4,-.4,10.4);flare.userData.flare=true;group.add(flare);}
 const turret=new THREE.Group();turret.position.set(0,2,-2);const gun=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.6,7),darkMat);gun.position.z=-3;turret.add(gun);group.add(turret);group.userData.turret=turret;return group;}
const ship=shipModel(false);scene.add(ship);
const enemies=[];for(let i=0;i<9;i++){const angle=2*Math.PI*i/9,dist=110+(i%3)*80;const model=shipModel(true);model.position.set(Math.sin(angle)*dist,(i%3-1)*14,-110+Math.cos(angle)*dist);scene.add(model);enemies.push({model,x:model.position.x,z:model.position.z,y:model.position.y,hp:100,angle:angle,state:'patrol',cooldown:i*.34,seed:i+1})}
let x=0,z=0,heading=0,speed=0,hp=100,boost=0,boostReady=0,last=performance.now(),noticeTimeout=0,sound=true;
const input={x:0,y:0,pointer:null},pad=document.getElementById('pad'),stick=document.getElementById('stick');
function updatePad(e){const box=pad.getBoundingClientRect(),dx=e.clientX-(box.left+box.width/2),dy=e.clientY-(box.top+box.height/2),radius=box.width*.34,len=Math.hypot(dx,dy)||1;input.x=THREE.MathUtils.clamp(dx/radius,-1,1);input.y=THREE.MathUtils.clamp(-dy/radius,-1,1);if(len>radius){input.x=dx/len;input.y=-dy/len;}stick.style.transform='translate('+Math.round(input.x*radius)+'px,'+Math.round(-input.y*radius)+'px)'}
pad.addEventListener('pointerdown',e=>{e.preventDefault();input.pointer=e.pointerId;pad.setPointerCapture(e.pointerId);updatePad(e)});
pad.addEventListener('pointermove',e=>{if(e.pointerId===input.pointer)updatePad(e)});
function clearPad(e){if(e.pointerId!==input.pointer)return;input.pointer=null;input.x=0;input.y=0;stick.style.transform='translate(0,0)'}
pad.addEventListener('pointerup',clearPad);pad.addEventListener('pointercancel',clearPad);
const keys=new Set();document.addEventListener('keydown',e=>{keys.add(e.code);audioUnlock();if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault()});document.addEventListener('keyup',e=>keys.delete(e.code));
const boostButton=document.getElementById('boost');function activateBoost(){let now=performance.now()/1000;if(now<boostReady||hp<=0)return;boost=now+.8;boostReady=now+4;playSound('boost')}
boostButton.addEventListener('pointerdown',e=>{e.preventDefault();activateBoost()});
const weapons=[{id:'plasma',icon:'⚡',speed:265,damage:25,cooldown:.8,color:0x42eaff,size:1},{id:'iron',icon:'🔩',speed:385,damage:40,cooldown:1.2,color:0xffcb78,size:.85},{id:'missile',icon:'🚀',speed:65,damage:55,cooldown:3.5,color:0xff7d4e,size:2},{id:'meteor',icon:'☄️',speed:170,damage:35,cooldown:2.2,color:0xff9950,size:2.4},{id:'scatter',icon:'✨',speed:250,damage:17,cooldown:1.9,color:0xd39cff,size:.85},{id:'siege',icon:'🪐',speed:115,damage:55,cooldown:4.5,color:0xeeb8ff,size:3}];
let selected=weapons[0],ready=Object.fromEntries(weapons.map(w=>[w.id,0]));
const dock=document.getElementById('weaponBar');function updateDock(){dock.replaceChildren();for(const w of weapons){const b=document.createElement('button');b.textContent=w.icon;b.title=w.id;b.className=w.id===selected.id?'selected':'';b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();selected=w;updateDock()});dock.appendChild(b)}}updateDock();
const aim={active:false,pointer:null,startX:0,startY:0,angle:0,dist:125};
const fire=document.getElementById('fire'),aimLabel=document.getElementById('aim');let hudAim=null;
fire.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;audioUnlock();e.preventDefault();if(performance.now()/1000<ready[selected.id]||hp<=0)return;aim.active=true;aim.pointer=e.pointerId;aim.startX=e.clientX;aim.startY=e.clientY;aim.angle=heading;aim.dist=125;fire.setPointerCapture(e.pointerId);aimLabel.classList.add('visible')});
fire.addEventListener('pointermove',e=>{if(!aim.active||e.pointerId!==aim.pointer)return;const dx=e.clientX-aim.startX,dy=e.clientY-aim.startY;aim.angle=heading+THREE.MathUtils.clamp(dx/92,-1.65,1.65);aim.dist=THREE.MathUtils.clamp(125-dy*.9,35,310)});
function endAim(e){if(!aim.active||e.pointerId!==aim.pointer)return;aim.active=false;aimLabel.classList.remove('visible');if(e.type!=='pointercancel')fireWeapon()}
fire.addEventListener('pointerup',endAim);fire.addEventListener('pointercancel',endAim);
const bullets=[],flashes=[];const sphere=new THREE.SphereGeometry(1,10,8);
function nearest(angle,max=310){let best=null,bd=max;for(const e of enemies){if(e.hp<=0)continue;let d=Math.hypot(e.x-x,e.z-z),bearing=Math.atan2(-(e.x-x),-(e.z-z));let delta=Math.abs(Math.atan2(Math.sin(bearing-angle),Math.cos(bearing-angle)));if(d<bd&&delta<.32){best=e;bd=d}}return best}
function fireWeapon(){const now=performance.now()/1000;const w=selected;if(now<ready[w.id])return;ready[w.id]=now+w.cooldown;playSound(w.id);const count=w.id==='scatter'?3:1;
 for(let i=0;i<count;i++){const angle=aim.angle+(i-(count-1)/2)*.095,target=nearest(angle,w.id==='missile'?270:310);
 const dir=new THREE.Vector3(-Math.sin(angle),0,-Math.cos(angle));
 const start=new THREE.Vector3(x+dir.x*12,ship.position.y+1,z+dir.z*12);
 const geometry=w.id==='missile'?new THREE.CylinderGeometry(.8,.8,5,8):sphere;
 const mat=new THREE.MeshBasicMaterial({color:w.color});const mesh=new THREE.Mesh(geometry,mat);mesh.position.copy(start);
 if(w.id==='missile')mesh.rotation.x=Math.PI/2;else mesh.scale.setScalar(w.size);
 scene.add(mesh);
 const trail=new THREE.Mesh(new THREE.SphereGeometry(w.id==='missile'?1.15:.65,8,6),new THREE.MeshBasicMaterial({color:w.color,transparent:true,opacity:.5}));scene.add(trail);
 bullets.push({mesh,trail,dir,target,weapon:w,dist:0,age:0,range:w.id==='missile'?330:340,velocity:w.id==='missile'?25:w.speed});
 }}
const blastGeom=new THREE.SphereGeometry(1,12,8);
function explosion(pos,color=0xffa35c,size=8){const mesh=new THREE.Mesh(blastGeom,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8,depthWrite:false}));mesh.position.copy(pos);scene.add(mesh);flashes.push({mesh,age:0,size})}
function showNotice(t){const el=document.getElementById('status');el.textContent=t;el.style.opacity='1';clearTimeout(noticeTimeout);noticeTimeout=setTimeout(()=>el.style.opacity='0',1450)}
function audioUnlock(){if(audioCtx)return;try{audioCtx=new (window.AudioContext||window.webkitAudioContext)()}catch{}}
let audioCtx=null;function playSound(kind){if(!sound||!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain(),now=audioCtx.currentTime;o.type=kind==='boost'?'sawtooth':'triangle';o.frequency.setValueAtTime(kind==='missile'?170:kind==='boost'?88:kind==='plasma'?600:220,now);o.frequency.exponentialRampToValueAtTime(kind==='boost'?370:kind==='missile'?54:85,now+.22);g.gain.setValueAtTime(.035,now);g.gain.exponentialRampToValueAtTime(.0001,now+.23);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(now+.24)}
document.getElementById('sound').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();sound=!sound;document.getElementById('sound').textContent=sound?'🔊':'🔇';audioUnlock()});
document.getElementById('menu').addEventListener('pointerdown',e=>{e.preventDefault();showNotice('PROTÓTIPO · FASE 1')});
const tmp=new THREE.Vector3(),targetCam=new THREE.Vector3(),worldUp=new THREE.Vector3(0,1,0);
function tick(){requestAnimationFrame(tick);const now=performance.now(),dt=Math.min(.045,(now-last)/1000);last=now;const t=now/1000;
 const steer=THREE.MathUtils.clamp(input.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),-1,1);
 const throttle=THREE.MathUtils.clamp(input.y+(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),-1,1);
 if(keys.has('ShiftLeft')||keys.has('ShiftRight')){activateBoost();keys.delete('ShiftLeft');keys.delete('ShiftRight')}
 heading+=steer*dt*1.65;const desired=t<boost?102:throttle>0?throttle*48:throttle<0?throttle*18:0;
 speed=THREE.MathUtils.damp(speed,desired,t<boost?5:1.8,dt);
 x-=Math.sin(heading)*speed*dt;z-=Math.cos(heading)*speed*dt;
 ship.position.set(x,Math.sin(t*1.6)*.35,z);ship.rotation.y=heading;ship.rotation.z=THREE.MathUtils.damp(ship.rotation.z,-steer*.18,5,dt);
 ship.userData.turret.rotation.y=THREE.MathUtils.damp(ship.userData.turret.rotation.y,aim.active?aim.angle-heading:0,7,dt);
 for(const flare of ship.children.filter(c=>c.userData.flare))flare.scale.z=1+Math.min(2,Math.abs(speed)/48)*.6;
 for(const e of enemies){if(e.hp<=0){e.model.visible=false;continue}const dx=x-e.x,dz=z-e.z,dist=Math.hypot(dx,dz);let vx=dx,vz=dz;
 if(dist>75&&dist<310){const step=(dist>135?13:-9)*dt;vx=dx/Math.max(dist,1)*step;vz=dz/Math.max(dist,1)*step;e.x+=vx;e.z+=vz}
 else if(dist>=310){e.x+=Math.sin(t*.31+e.seed)*dt*4;e.z+=Math.cos(t*.31+e.seed)*dt*4}
 e.model.position.set(e.x,e.y+Math.sin(t*1.3+e.seed)*1.6,e.z);e.model.rotation.y=Math.atan2(-(x-e.x),-(z-e.z));e.cooldown-=dt;
 if(dist<165&&e.cooldown<=0){e.cooldown=2.3+e.seed*.12;const firePos=e.model.position.clone();const dir=new THREE.Vector3(x-e.x,0,z-e.z).normalize();
 const w={id:'enemy',damage:7,speed:115,color:0xff5c54};const mesh=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color:w.color}));mesh.scale.setScalar(1.6);mesh.position.copy(firePos);scene.add(mesh);const trail=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color:w.color,transparent:true,opacity:.5}));scene.add(trail);bullets.push({mesh,trail,dir,weapon:w,dist:0,age:0,range:185,velocity:115})}
 }
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.age+=dt;b.dist+=b.velocity*dt;
 if(b.weapon.id==='missile'){b.velocity=Math.min(93,b.velocity+dt*29);if(b.target&&b.target.hp>0){const desired=new THREE.Vector3(b.target.x-b.mesh.position.x,0,b.target.z-b.mesh.position.z).normalize();b.dir.lerp(desired,Math.min(1,dt*1.3)).normalize()}}
 b.mesh.position.addScaledVector(b.dir,b.velocity*dt);b.trail.position.copy(b.mesh.position).addScaledVector(b.dir,-3);b.trail.scale.setScalar(b.weapon.id==='missile'?1.3:1);b.trail.material.opacity=.35+.2*Math.sin(t*22);if(b.weapon.id==='missile')b.mesh.rotation.y=Math.atan2(-b.dir.x,-b.dir.z);
 let hit=false;if(b.weapon.id==='enemy'){if(hp>0&&Math.hypot(b.mesh.position.x-x,b.mesh.position.z-z)<7){hp=Math.max(0,hp-b.weapon.damage);hit=true;explosion(b.mesh.position,0xff5d5d,5);if(hp<=0){showNotice('NAVE DESTRUÍDA · REINICIANDO');setTimeout(()=>{hp=100;x=0;z=0;speed=0},1500)}}}
 else for(const e of enemies){if(e.hp>0&&Math.hypot(b.mesh.position.x-e.x,b.mesh.position.z-e.z)<(b.weapon.id==='missile'?9:6)){e.hp=Math.max(0,e.hp-b.weapon.damage);hit=true;explosion(b.mesh.position,b.weapon.color,b.weapon.id==='missile'?13:7);if(e.hp===0)showNotice('INIMIGO ELIMINADO');break}}
 if(hit||b.dist>b.range){scene.remove(b.mesh,b.trail);b.mesh.geometry.dispose();b.mesh.material.dispose();b.trail.material.dispose();bullets.splice(i,1)}
 }
 for(let i=flashes.length-1;i>=0;i--){const f=flashes[i];f.age+=dt;f.mesh.scale.setScalar(1+f.age*f.size*3);f.mesh.material.opacity=Math.max(0,.7-f.age*2);if(f.age>.36){scene.remove(f.mesh);f.mesh.material.dispose();flashes.splice(i,1)}}
 // A camera permanece na nave enquanto os projeteis viajam.
 targetCam.set(x+Math.sin(heading)*40,23,z+Math.cos(heading)*40);camera.position.lerp(targetCam,1-Math.exp(-dt*3));tmp.set(x-Math.sin(heading)*55,0,z-Math.cos(heading)*55);camera.lookAt(tmp);
 stars.position.set(x,0,z);
 const alive=enemies.filter(e=>e.hp>0),nearest=alive.reduce((best,e)=>{const d=Math.hypot(e.x-x,e.z-z);return !best||d<best.d?{e,d}:best},null);
 document.getElementById('radar').textContent=alive.length?'HOSTIS '+alive.length+' · PRÓXIMO '+Math.round(nearest.d)+' m':'🚀 SETOR LIBERADO';
 document.getElementById('hpBar').style.width=hp+'%';document.getElementById('hpBar').style.background=hp<30?'#ee4646':hp<60?'#ffd650':'linear-gradient(90deg,#44b953,#baff6a)';document.getElementById('hpText').textContent=hp+' / 100';document.getElementById('speed').textContent='VELOCIDADE '+Math.round(Math.abs(speed));
 const remaining=Math.max(0,ready[selected.id]-t);fire.textContent=aim.active?'MIRANDO':remaining?'RECARGA '+remaining.toFixed(1):'DISPARAR';fire.disabled=remaining>0||hp<=0;boostButton.textContent=t<boost?'IMPULSO!':t<boostReady?'ESPERA '+Math.ceil(boostReady-t):'IMPULSO';renderer.render(scene,camera)}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))});
tick();
