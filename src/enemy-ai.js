// Tática naval: papéis fixos, órbitas alternadas e espaçamento entre NPCs.
// Funções puras para permitir calibrar as batalhas sem alterar o renderizador.
export const TACTICS=Object.freeze({
 detect:280,disengage:330,idealRange:112,minRange:36,
 maxActiveShooters:3,shotCadence:1.9,pressureWindow:1.15
});
export function planEnemy(enemy,player,all,time){
 const dx=player.x-enemy.x,dz=player.z-enemy.z;
 const distance=Math.hypot(dx,dz),role=(enemy.id-1)%3;
 const active=player.alive&&(distance<TACTICS.detect || (enemy.state!=='patrol'&&distance<TACTICS.disengage));
 if(!active)return {active:false,goalX:enemy.anchorX+Math.sin(time*.19+enemy.phase)*enemy.radius,goalZ:enemy.anchorZ+Math.cos(time*.19+enemy.phase)*enemy.radius,distance,role,state:'patrol',speed:enemy.speed};
 const phase=time*(role===0?.25:role===1?-.29:.19)+enemy.phase;
 const radius=role===0?105:role===1?124:86;
 let goalX=player.x+Math.sin(phase)*radius;
 let goalZ=player.z+Math.cos(phase)*radius;
 // Duelistas flanqueiam, interceptadores buscam a proa, escaramuçadores alternam distância.
 if(role===2){goalX+=-Math.sin(player.heading)*Math.min(36,player.speed*.55);goalZ+=-Math.cos(player.heading)*Math.min(36,player.speed*.55);}
 if(distance<TACTICS.minRange){const len=Math.max(1,distance);goalX=enemy.x-dx/len*55;goalZ=enemy.z-dz/len*55;}
 // Separação suave: navios não se empilham durante a perseguição.
 for(const other of all){
  if(other===enemy||other.hp<=0)continue;
  const sx=enemy.x-other.x,sz=enemy.z-other.z,sep=Math.hypot(sx,sz);
  if(sep<29&&sep>.01){const force=(29-sep)/29*42;goalX+=sx/sep*force;goalZ+=sz/sep*force;}
 }
 const lowHp=enemy.hp<=35;
 if(lowHp){goalX-=dx/Math.max(1,distance)*42;goalZ-=dz/Math.max(1,distance)*42;}
 const state=lowHp?'retreat':role===0?'flank':role===1?'orbit':'intercept';
 return {active,goalX,goalZ,distance,role,state,speed:Math.max(enemy.speed*2.15,role===2?16:13)};
}
export function canEnemyFire(enemy,all,shots,now,playerHp){
 if(playerHp<=0||now<enemy.nextShot||enemy.hp<=0)return false;
 if(shots.filter(s=>s.age<s.duration).length>=TACTICS.maxActiveShooters)return false;
 const contenders=all.filter(e=>e.hp>0&&e.state!=='patrol'&&e.state!=='destroyed');
 // Alternating staggered turns avoid synchronized volleys.
 const group=Math.floor(now/TACTICS.pressureWindow)%3;
 return contenders.length<=2 || (enemy.id-1)%3===group;
}
