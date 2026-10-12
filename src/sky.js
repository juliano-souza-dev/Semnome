// Skybox de horizonte: imagem repetida no eixo horizontal e oceano 3D independente.
// Cilindro aberto muito alto impede bordas/teto no campo visual.
// A camada inferior dissolve na neblina para não sobrepor o mar renderizado.
export function createSkyPanorama(THREE,scene){
 const texture=new THREE.TextureLoader().load('./assets/backgrounds/file_0000000078ac820e8d436f3076b8ef09.png');
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 const material=new THREE.ShaderMaterial({
  uniforms:{uMap:{value:texture}},
  side:THREE.BackSide,transparent:true,depthWrite:false,fog:false,
  vertexShader:`
   varying vec2 vUvSky;
   varying float vSkyHeight;
   void main(){
     vUvSky=uv;
     vSkyHeight=position.y;
     gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
   }`,
  fragmentShader:`
   uniform sampler2D uMap;
   varying vec2 vUvSky;
   varying float vSkyHeight;
   void main(){
     // Mapeamento vertical controlado: topo nunca corta, imagem não é esticada.
     float v=clamp((vSkyHeight+30.)/275.,0.,1.);
     vec3 color=texture2D(uMap,vec2(vUvSky.x,v)).rgb;
     // Mescla névoa baixa ao fundo do oceano WebGL.
     float visibility=smoothstep(-8.,22.,vSkyHeight);
     gl_FragColor=vec4(color,visibility);
   }`
 });
 const dome=new THREE.Mesh(new THREE.CylinderGeometry(680,680,2200,96,1,true),material);
 dome.renderOrder=-100;
 scene.add(dome);
 return {update(x,z){dome.position.set(x,0,z)}};
}
