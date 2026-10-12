// Máquina marinha de guerra original do Semnome, toda em geometrias Three.js.
// Frente em -Z, origem na linha de flutuação; sem sprites e sem modelos externos.
export function createWarMachine3D(THREE,{enemy=false}={}){
 const root=new THREE.Group();root.name=enemy?'Máquina inimiga 3D':'Máquina de guerra 3D';
 const mat=(color,metalness=.2,roughness=.55,extra={})=>new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});
 const orange=mat(enemy?0xa83d41:0xef842d,.45,.4),cream=mat(enemy?0x697781:0xf1e5c5,.25,.58);
 const dark=mat(0x203640,.65,.36),rim=mat(0x112a32,.45,.46);
 const glass=mat(0x155267,.5,.18,{emissive:0x092d41,emissiveIntensity:.4});
 const glow=mat(enemy?0xff514f:0x23deff,.15,.28,{emissive:enemy?0xff2828:0x00bce9,emissiveIntensity:2});
 const add=(geo,material,x=0,y=0,z=0,parent=root)=>{const obj=new THREE.Mesh(geo,material);obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj};
 // Casco blindado achatado, com saia estanque acima da superfície.
 add(new THREE.CylinderGeometry(3.05,3.25,1.25,40),rim,0,.15,0);
 add(new THREE.CylinderGeometry(2.95,3.08,.9,40),orange,0,.85,0);
 add(new THREE.CylinderGeometry(2.45,2.65,.28,40),cream,0,1.44,0);
 const upper=add(new THREE.SphereGeometry(1.55,28,12,0,Math.PI*2,0,Math.PI/2),orange,0,1.58,.32);
 upper.scale.set(1,.52,1.12);
 const visor=add(new THREE.SphereGeometry(1.06,24,12),glass,0,1.82,-.68);
 visor.scale.set(1,.32,.52);
 // Para-lamas blindados em oito segmentos e placas radiais.
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4;
  const plate=add(new THREE.BoxGeometry(1.45,.40,.58),cream,Math.sin(a)*2.55,1.1,Math.cos(a)*2.55);
  plate.rotation.y=a;
  const bolt=add(new THREE.SphereGeometry(.105,8,6),dark,Math.sin(a)*2.63,1.38,Math.cos(a)*2.63);
 }
 // Canhão apontado para -Z, alinhado ao eixo de tiro do jogo.
 const turret=add(new THREE.CylinderGeometry(.93,1.2,.7,18),dark,0,1.93,-1.35);
 const barrel=add(new THREE.CylinderGeometry(.34,.52,3.75,16),dark,0,1.95,-3.42);
 barrel.rotation.x=Math.PI/2;
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
  const wing=add(new THREE.BoxGeometry(1.15,.22,1.8),orange,side*2.25,1.12,1.45);wing.rotation.y=side*.18;
 }
 // Luzes direcionais de navegação.
 add(new THREE.SphereGeometry(.19,10,8),mat(0xff3c39,.1,.2,{emissive:0xff2222,emissiveIntensity:1.2}),-2.95,1.18,0);
 add(new THREE.SphereGeometry(.19,10,8),mat(0x48ff9d,.1,.2,{emissive:0x10bb55,emissiveIntensity:1.2}),2.95,1.18,0);
 root.userData={firePoint,thrusters,kind:'war-machine-3d'};
 return root;
}
