import {createHullTextures} from './war-machine-textures.js';
// Máquina marinha de guerra original do Semnome, toda em geometrias Three.js.
// Frente em -Z, origem na linha de flutuação; sem sprites e sem modelos externos.
export function createWarMachine3D(THREE,{enemy=false}={}){
 const root=new THREE.Group();root.name=enemy?'Máquina inimiga 3D':'Máquina de guerra 3D';
 const textures=createHullTextures(THREE);
 const mat=(color,metalness=.2,roughness=.55,extra={})=>new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});
 const painted=(color)=>new THREE.MeshStandardMaterial({
  color,metalness:.38,roughness:.62,map:textures.paint,bumpMap:textures.bump,bumpScale:.055
 });
 const orange=painted(enemy?0xa83d41:0xef842d),cream=painted(enemy?0x697781:0xf1e5c5);
 const dark=mat(0x203640,.65,.36),rim=mat(0x112a32,.45,.46);
 const steel=mat(0x637986,.8,.26),recess=mat(0x0d222e,.5,.48),trim=mat(enemy?0xe2ac94:0xffd28a,.6,.32);
 const glass=mat(0x155267,.5,.18,{emissive:0x092d41,emissiveIntensity:.4});
 const glow=mat(enemy?0xff514f:0x23deff,.15,.28,{emissive:enemy?0xff2828:0x00bce9,emissiveIntensity:2});
 const add=(geo,material,x=0,y=0,z=0,parent=root)=>{const obj=new THREE.Mesh(geo,material);obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj};
 // Casco blindado achatado, com saia estanque acima da superfície.
 add(new THREE.CylinderGeometry(3.05,3.25,1.25,40),rim,0,.15,0);
 add(new THREE.CylinderGeometry(2.95,3.08,.9,40),orange,0,.85,0);
 add(new THREE.CylinderGeometry(2.45,2.65,.28,40),cream,0,1.44,0);
 // Faixa da blindagem e junta estanque, alinhadas à silhueta original circular.
 add(new THREE.TorusGeometry(3.11,.13,8,48),steel,0,.57,0).rotation.x=Math.PI/2;
 add(new THREE.TorusGeometry(2.65,.10,8,48),trim,0,1.53,0).rotation.x=Math.PI/2;
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  const block=add(new THREE.BoxGeometry(.72,.48,.32),i%3===0?steel:orange,Math.sin(a)*3.02,.73,Math.cos(a)*3.02);
  block.rotation.y=a;
  const vent=add(new THREE.BoxGeometry(.35,.13,.04),recess,Math.sin(a)*3.2,.86,Math.cos(a)*3.2);vent.rotation.y=a;
 }
 const upper=add(new THREE.SphereGeometry(1.55,28,12,0,Math.PI*2,0,Math.PI/2),orange,0,1.58,.32);
 upper.scale.set(1,.52,1.12);
 const visor=add(new THREE.SphereGeometry(1.06,24,12),glass,0,1.82,-.68);
 visor.scale.set(1,.32,.52);
 // Viseira protegida por aro e reforços acima da cabine.
 const visorShield=add(new THREE.TorusGeometry(1.12,.12,8,24),steel,0,1.88,-.72);
 visorShield.scale.set(1,.45,1);visorShield.rotation.x=Math.PI/2;
 for(const side of [-1,1]){
  const brace=add(new THREE.BoxGeometry(.18,.38,1.9),steel,side*1.38,1.94,-.48);
  brace.rotation.y=side*.20;
 }
 // Para-lamas blindados em oito segmentos e placas radiais.
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;
  const plate=add(new THREE.BoxGeometry(1.45,.40,.58),cream,Math.sin(a)*2.55,1.1,Math.cos(a)*2.55);
  plate.rotation.y=a;
  const bolt=add(new THREE.SphereGeometry(.105,8,6),dark,Math.sin(a)*2.63,1.38,Math.cos(a)*2.63);
 }
 // Canhão apontado para -Z, alinhado ao eixo de tiro do jogo.
 const turret=add(new THREE.CylinderGeometry(.93,1.2,.7,18),dark,0,1.93,-1.35);
 add(new THREE.TorusGeometry(1.01,.13,8,24),trim,0,2.31,-1.35).rotation.x=Math.PI/2;
 const barrel=add(new THREE.CylinderGeometry(.34,.52,3.75,16),dark,0,1.95,-3.42);
 barrel.rotation.x=Math.PI/2;
 // Bainha telescópica, trilhos laterais e dissipadores térmicos.
 const jacket=add(new THREE.CylinderGeometry(.53,.57,1.15,16),steel,0,1.95,-2.62);jacket.rotation.x=Math.PI/2;
 for(const zz of [-3.05,-3.42,-3.78,-4.15]){
  const collar=add(new THREE.CylinderGeometry(.46,.46,.12,16),trim,0,1.95,zz);collar.rotation.x=Math.PI/2;
 }
 for(const side of [-1,1])add(new THREE.BoxGeometry(.12,.18,2.4),steel,side*.53,1.95,-3.68);
 const muzzle=add(new THREE.TorusGeometry(.4,.12,10,20),cream,0,1.95,-5.32);
 const aperture=add(new THREE.CircleGeometry(.29,20),rim,0,1.95,-5.34);aperture.rotation.y=Math.PI;
 const firePoint=new THREE.Object3D();firePoint.name='cannonMuzzle';firePoint.position.set(0,1.95,-5.42);root.add(firePoint);
 // Dois motores externos + anéis luminosos que podem ser animados.
 const thrusters=[];
 for(const side of [-1,1]){
  const pod=add(new THREE.CylinderGeometry(.72,.88,1.55,16),dark,side*2.5,.58,2.2);pod.rotation.x=Math.PI/2;
  const nozzle=add(new THREE.TorusGeometry(.62,.16,10,20),cream,side*2.5,.58,3.08);
  const core=add(new THREE.CircleGeometry(.54,20),glow,side*2.5,.58,3.12);core.rotation.y=Math.PI;
  thrusters.push(core);
  // Turbina real em profundidade, bocal blindado e pás internas.
  const sleeve=add(new THREE.CylinderGeometry(.87,.87,1.05,20),steel,side*2.5,.58,2.72);sleeve.rotation.x=Math.PI/2;
  const cavity=add(new THREE.CircleGeometry(.52,24),recess,side*2.5,.58,3.16);cavity.rotation.y=Math.PI;
  const rotor=new THREE.Group();rotor.position.set(side*2.5,.58,3.18);root.add(rotor);
  add(new THREE.SphereGeometry(.16,10,8),trim,0,0,0,rotor);
  for(let blade=0;blade<6;blade++){
   const a=blade*Math.PI/3;
   const fin=add(new THREE.BoxGeometry(.14,.45,.065),steel,Math.sin(a)*.3,Math.cos(a)*.3,0,rotor);
   fin.rotation.z=-a+.4;
  }
  if(!root.userData.rotors)root.userData.rotors=[];
  root.userData.rotors.push(rotor);
  // Jato de plasma animado na GPU, saindo do bocal em direção à popa (+Z).
  const flameMaterial=new THREE.ShaderMaterial({
   uniforms:{uTime:{value:0},uPower:{value:.22},uColor:{value:new THREE.Color(enemy?0xff5639:0x29caff)}},
   transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
   vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`uniform float uTime;uniform float uPower;uniform vec3 uColor;varying vec2 vUv;
    void main(){
     vec2 p=vUv*2.-1.;float along=vUv.y;
     float ripple=sin(along*19.-uTime*21.+p.x*6.)*.12+sin(along*37.+uTime*14.)*.06;
     float width=mix(.68,.02,along)*(1.+ripple);
     float core=1.-smoothstep(0.,width,abs(p.x));
     float tip=smoothstep(1.,.76,along);
     float alpha=core*tip*(.3+.7*uPower);
     vec3 col=mix(uColor,vec3(1.,.94,.63),core*core*(1.-along));
     gl_FragColor=vec4(col,alpha);
    }`
  });
  const flame=new THREE.Mesh(new THREE.PlaneGeometry(1.4,3.4),flameMaterial);
  flame.position.set(side*2.5,.58,4.75);flame.rotation.x=Math.PI/2;flame.renderOrder=8;root.add(flame);
  const flameCross=flame.clone();flameCross.material=flameMaterial;flameCross.rotation.set(0,0,0);flameCross.position.copy(flame.position);root.add(flameCross);
  if(!root.userData.engineFlames)root.userData.engineFlames=[];
  root.userData.engineFlames.push({material:flameMaterial,flame,flameCross});

  const wing=add(new THREE.BoxGeometry(1.15,.22,1.8),orange,side*2.25,1.12,1.45);wing.rotation.y=side*.18;
 }
 // Luzes direcionais de navegação.
 add(new THREE.SphereGeometry(.19,10,8),mat(0xff3c39,.1,.2,{emissive:0xff2222,emissiveIntensity:1.2}),-2.95,1.18,0);
 add(new THREE.SphereGeometry(.19,10,8),mat(0x48ff9d,.1,.2,{emissive:0x10bb55,emissiveIntensity:1.2}),2.95,1.18,0);
 root.userData={...root.userData,firePoint,thrusters,kind:'war-machine-3d'};
 return root;
}
