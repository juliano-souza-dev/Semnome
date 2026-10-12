// Tática naval: papéis fixos, órbitas alternadas e espaçamento entre NPCs.
// Funções puras para permitir calibrar as batalhas sem alterar o renderizador.
export const TACTICS=Object.freeze({
 detect:210,disengage:285,idealRange:155,minRange:58,
 maxActiveShooters:3,shotCadence:1.8,pressureWindow:.85
});
export function planEnemy(enemy,player,all,time){
 const dx=player.x-enemy.x,dz=player.z-enemy.z;
 const distance=Math.hypot(dx,dz),role=(enemy.id-1)%3;
 const active=player.alive&&(distance<TACTICS.detect || (enemy.state!=='patrol'&&distance<TACTICS.disengage));
 if(!active)return {active:false,goalX:enemy.anchorX+Math.sin(time*.19+enemy.phase)*enemy.radius,goalZ:enemy.anchorZ+Math.cos(time*.19+enemy.phase)*enemy.radius,distance,role,state:'patrol',speed:enemy.speed};
 const phase=time*(role===0?.46:role===1?-.54:.42)+enemy.phase;
 const radius=(role===0?165:role===1?205:135)+(enemy.id%3)*22;
 let goalX=player.x+Math.sin(phase)*radius;
 let goalZ=player.z+Math.cos(phase)*radius;
 // Duelistas flanqueiam, interceptadores buscam a proa, escaramuçadores alternam distância.
 if(role===2){goalX+=-Math.sin(player.heading)*Math.min(70,player.speed*.9);goalZ+=-Math.cos(player.heading)*Math.min(70,player.speed*.9);}
 // Ataques de pinça: pares assumem lados contrários do rumo da proa.
 if(role===0){const flank=(enemy.id%2===0?1:-1)*55;goalX+=Math.cos(player.heading)*flank;goalZ-=Math.sin(player.heading)*flank;}
 if(distance<TACTICS.minRange){const len=Math.max(1,distance);goalX=enemy.x-dx/len*70;goalZ=enemy.z-dz/len*70;}
 // Separação suave: navios não se empilham durante a perseguição.
 for(const other of all){
  if(other===enemy||other.hp<=0)continue;
  const sx=enemy.x-other.x,sz=enemy.z-other.z,sep=Math.hypot(sx,sz);
  if(sep<95&&sep>.01){const force=(95-sep)/95*140;goalX+=sx/sep*force;goalZ+=sz/sep*force;}
 }
 const lowHp=enemy.hp<=22;
 if(lowHp){goalX-=dx/Math.max(1,distance)*58;goalZ-=dz/Math.max(1,distance)*58;}
 const state=lowHp?'retreat':role===0?'flank':role===1?'orbit':'intercept';
 const chase=distance>285?1.08:1;
 return {active,goalX,goalZ,distance,role,state,speed:(lowHp?17:role===2?26:role===0?23:21)*chase};
}
export function canEnemyFire(enemy,all,shots,now,playerHp){
 if(playerHp<=0||now<enemy.nextShot||enemy.hp<=0)return false;
 if(shots.filter(s=>s.age<s.duration).length>=TACTICS.maxActiveShooters)return false;
 const contenders=all.filter(e=>e.hp>0&&e.state!=='patrol'&&e.state!=='destroyed');
 // Alternating staggered turns avoid synchronized volleys.
 const group=Math.floor(now/TACTICS.pressureWindow)%3;
 return contenders.length<=3 || (enemy.id-1)%3===group || (enemy.id%3===group&&shots.length<2);
}
