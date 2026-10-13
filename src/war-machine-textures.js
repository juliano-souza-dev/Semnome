// Pintura técnica e micro-relevo leves, gerados localmente para o casco 3D.
// Os mapas são neutros para preservar as cores e não exigir downloads externos.
export function createHullTextures(THREE){
 const size=512;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#e4e6e7';ctx.fillRect(0,0,size,size);
 // Painéis repetíveis e pequenas variações de tinta.
 for(let y=0;y<size;y+=64){
  ctx.fillStyle=(y/64)%2?'#d8dcde':'#e8e9e8';
  ctx.fillRect(0,y,size,64);
  ctx.strokeStyle='rgba(29,44,52,.35)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(size,y+.5);ctx.stroke();
 }
 for(let x=0;x<size;x+=128){
  ctx.strokeStyle='rgba(32,48,55,.28)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,size);ctx.stroke();
 }
 let seed=43277;
 const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<780;i++){
  const x=rand()*size,y=rand()*size,length=2+rand()*21;
  ctx.strokeStyle=rand()>.5?'rgba(255,255,255,.26)':'rgba(34,45,48,.16)';
  ctx.lineWidth=.5+rand()*.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+length,y+rand()*2);ctx.stroke();
 }
 for(let y=16;y<size;y+=64)for(let x=18;x<size;x+=128){
  ctx.fillStyle='#677780';ctx.beginPath();ctx.arc(x,y,2.7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f0f4f4';ctx.beginPath();ctx.arc(x-.6,y-.7,.9,0,Math.PI*2);ctx.fill();
 }
 // Marcas largas de desgaste e painéis grandes, legíveis em tela pequena.
 ctx.strokeStyle='rgba(18,31,39,.72)';ctx.lineWidth=9;
 for(let x=0;x<=size;x+=128){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,size);ctx.stroke();}
 ctx.strokeStyle='rgba(255,238,184,.78)';ctx.lineWidth=7;
 for(let y=64;y<size;y+=128){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y);ctx.stroke();}
 ctx.fillStyle='rgba(17,35,42,.65)';
 for(let i=0;i<4;i++){const x=20+i*128;ctx.fillRect(x,270,54,42);}
 ctx.fillStyle='rgba(255,224,118,.95)';
 for(let i=0;i<4;i++){const x=25+i*128;ctx.fillRect(x,275,44,7);}
 const paint=new THREE.CanvasTexture(canvas);paint.colorSpace=THREE.SRGBColorSpace;paint.wrapS=paint.wrapT=THREE.RepeatWrapping;
 paint.anisotropy=4;
 const bumpCanvas=document.createElement('canvas');bumpCanvas.width=bumpCanvas.height=size;
 const bumpCtx=bumpCanvas.getContext('2d');bumpCtx.fillStyle='#777';bumpCtx.fillRect(0,0,size,size);
 for(let y=0;y<size;y+=64){
  bumpCtx.fillStyle='#303030';bumpCtx.fillRect(0,y,512,2);
  bumpCtx.fillStyle='#c4c4c4';bumpCtx.fillRect(0,y+2,512,2);
 }
 for(let x=0;x<size;x+=128){
  bumpCtx.fillStyle='#454545';bumpCtx.fillRect(x,0,2,512);
  bumpCtx.fillStyle='#bbbbbb';bumpCtx.fillRect(x+2,0,2,512);
 }
 const bump=new THREE.CanvasTexture(bumpCanvas);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;
 return {paint,bump};
}
