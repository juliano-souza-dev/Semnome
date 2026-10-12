// Panorama 360° de ambientação. O trecho de mar da arte permanece abaixo do oceano 3D;
// assim as ondas reais não são duplicadas e o horizonte se mistura ao cenário.
export function createSkyPanorama(THREE,scene){
 const texture=new THREE.TextureLoader().load('./assets/backgrounds/file_000000005698820ea14ea3712b8cf9bc.png');
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;
 const height=400,top=138;
 const cylinder=new THREE.Mesh(
  new THREE.CylinderGeometry(660,660,height,72,1,true),
  new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,depthWrite:false,fog:false})
 );
 cylinder.position.y=top-height/2;
 cylinder.renderOrder=-50;
 scene.add(cylinder);
 return {update(x,z){cylinder.position.x=x;cylinder.position.z=z}};
}
