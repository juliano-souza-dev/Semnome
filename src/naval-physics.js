// Física naval simplificada em coordenadas XZ do mundo Three.js.
// Velocidade longitudinal, deriva lateral e arrasto hidrodinâmico com dt em segundos.
export function integrateHull(body,{heading,targetSpeed,boostSpeed=0,dt}){
 const fx=-Math.sin(heading),fz=-Math.cos(heading);
 const sx=Math.cos(heading),sz=-Math.sin(heading);
 const forward=body.vx*fx+body.vz*fz;
 const lateral=body.vx*sx+body.vz*sz;
 const desired=boostSpeed>0?boostSpeed:targetSpeed;
 // Motor empurra para frente; a água freia naturalmente ao soltar.
 const accel=boostSpeed>0?300:desired===0?58:desired<0?52:68;
 const forwardStep=Math.max(-accel*dt,Math.min(accel*dt,desired-forward));
 const nextForward=forward+forwardStep;
 // Deriva residual da curva, eliminada progressivamente pela resistência lateral.
 const nextLateral=lateral*Math.exp(-3.6*dt);
 body.vx=fx*nextForward+sx*nextLateral;
 body.vz=fz*nextForward+sz*nextLateral;
 body.x+=body.vx*dt;
 body.z+=body.vz*dt;
 return {x:body.x,z:body.z,speed:nextForward,vx:body.vx,vz:body.vz,drift:nextLateral};
}
// Trajetória balística com aceleração gravitacional constante.
// O arco é escolhido para alcançar o destino após a duração solicitada.
export function ballisticPoint(origin,destination,duration,elapsed,arcHeight,out){
 const u=Math.max(0,Math.min(1,elapsed/duration));
 const time=u*duration;
 const gravity=8*arcHeight/(duration*duration);
 const vy=(destination.y-origin.y)/duration+gravity*duration*.5;
 out.set(origin.x+(destination.x-origin.x)*u,
         origin.y+vy*time-.5*gravity*time*time,
         origin.z+(destination.z-origin.z)*u);
 return out;
}
