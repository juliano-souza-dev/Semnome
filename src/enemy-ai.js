// Tática naval: papéis fixos, órbitas alternadas e espaçamento entre NPCs.
// Funções puras para permitir calibrar as batalhas sem alterar o renderizador.
export const TACTICS=Object.freeze({
 detect:335,disengage:410,idealRange:165,minRange:65,
 maxActiveShooters:5,shotCadence:1.8,pressureWindow:1.1
});
// Tomada de decisão baseada em utilidade contínua. Vida, velocidade relativa,
// cobertura, posição dos aliados e histórico de danos influenciam cada escolha.
// Não existe um "se chegou a 200 metros, empurre a nave para trás".
const clamp01=v=>Math.max(0,Math.min(1,v));
function selectEscapeRoute(enemy,player,all,obstacles,goalLength=135){
 const futurePlayerX=player.x+(player.vx||0)*1.1;
 const futurePlayerZ=player.z+(player.vz||0)*1.1;
 const away=Math.atan2(enemy.z-futurePlayerZ,enemy.x-futurePlayerX);
 const headings=[-.95,-.55,-.24,0,.24,.55,.95,1.35,-1.35];
 let result=null;
 for(const offset of headings){
  const dir=away+offset,px=enemy.x+Math.cos(dir)*goalLength,pz=enemy.z+Math.sin(dir)*goalLength;
  const separation=Math.hypot(px-futurePlayerX,pz-futurePlayerZ);
  const allyDistance=all.reduce((best,other)=>other!==enemy&&other.hp>0?
    Math.min(best,Math.hypot(px-other.x,pz-other.z)):best,Infinity);
  // Barcos não procuram refúgio DENTRO de uma construção.
  let obstruction=0,cover=0;
  for(const o of obstacles){
   const dist=Math.hypot(px-o.x,pz-o.z);
   obstruction+=Math.max(0,o.radius+23-dist)*3;
   // Uma ruína entre NPC e jogador pode servir de cobertura real.
   const ux=px-futurePlayerX,uz=pz-futurePlayerZ,lengthSq=ux*ux+uz*uz;
   if(lengthSq<1)continue;
   const t=clamp01(((o.x-futurePlayerX)*ux+(o.z-futurePlayerZ)*uz)/lengthSq);
   const cx=futurePlayerX+t*ux,cz=futurePlayerZ+t*uz;
   if(t>.18&&t<.84&&Math.hypot(o.x-cx,o.z-cz)<o.radius+8)cover+=.13;
  }
  const turnHeading=-Math.atan2(px-enemy.x,-(pz-enemy.z));
  const yaw=Math.abs(Math.atan2(Math.sin(turnHeading-enemy.heading),Math.cos(turnHeading-enemy.heading)));
  const coverBonus=Math.min(.34,cover);
  const support=Number.isFinite(allyDistance)?Math.max(0,1-allyDistance/175)*14:0;
  const score=separation*.52+coverBonus*75+support-obstruction-yaw*13;
  if(!result||score>result.score)result={x:px,z:pz,score};
 }
 return result||{x:enemy.x+Math.cos(away)*goalLength,z:enemy.z+Math.sin(away)*goalLength};
}
export function planEnemy(enemy,player,all,time,obstacles=[]){
 const dx=player.x-enemy.x,dz=player.z-enemy.z;
 const distance=Math.hypot(dx,dz),role=(enemy.id-1)%3;
 const active=player.alive&&(distance<TACTICS.detect||
  (enemy.state!=='patrol'&&distance<TACTICS.disengage));
 if(!active)return {active:false,
  goalX:enemy.anchorX+Math.sin(time*.19+enemy.phase)*enemy.radius,
  goalZ:enemy.anchorZ+Math.cos(time*.19+enemy.phase)*enemy.radius,
  distance,role,state:'patrol',intent:'patrol',speed:enemy.speed||8};
 const hp=clamp01(enemy.hp/(enemy.maxHp||100));
 const radial=(dx*((player.vx||0)-(enemy.vx||0))+dz*((player.vz||0)-(enemy.vz||0)))/Math.max(1,distance);
 const closing=clamp01(-radial/48);
 const nearness=1/(1+distance/105);
 const recentDamage=Math.exp(-Math.max(0,time-(enemy.lastDamageAt??-9999))/4.5);
 const nearbyAllies=all.filter(e=>e!==enemy&&e.hp>0&&Math.hypot(e.x-enemy.x,e.z-enemy.z)<190).length;
 const support=clamp01(nearbyAllies/3);
 const bestHit=enemy.ai?.choice?.probability||.3;
 // A utilidade de sobreviver cresce com vulnerabilidade e perseguição real.
 const flee=(1-hp)*(.85+nearness*1.25)+closing*.31+recentDamage*.37-support*.26;
 const regroup=(1-hp)*.56+support*.38+recentDamage*.12+(.4-nearness)*.20;
 const fight=.63+hp*.48+bestHit*.32+support*.2-nearness*(1-hp)*.35-recentDamage*.15;
 // Histerese: pilotos não trocam de plano freneticamente por pequenas flutuações.
 const previous=enemy.ai?.intent;
 const utilities={
  fight:fight+(previous==='fight'?.15:0),
  withdraw:flee+(previous==='withdraw'?.15:0),
  regroup:regroup+(previous==='regroup'?.15:0)
 };
 let intent='fight';
 if(utilities.withdraw>utilities[intent])intent='withdraw';
 if(utilities.regroup>utilities[intent])intent='regroup';
 const phase=time*(role===0?.46:role===1?-.54:.42)+enemy.phase;
 const radius=(role===0?175:role===1?215:145)+(enemy.id%3)*23;
 let goalX=player.x+Math.sin(phase)*radius;
 let goalZ=player.z+Math.cos(phase)*radius;
 if(role===2){goalX+=-Math.sin(player.heading)*Math.min(70,Math.abs(player.speed)*.9);goalZ+=-Math.cos(player.heading)*Math.min(70,Math.abs(player.speed)*.9);}
 if(role===0){const flank=(enemy.id%2===0?1:-1)*65;goalX+=Math.cos(player.heading)*flank;goalZ-=Math.sin(player.heading)*flank;}
 if(intent==='withdraw'){
  const route=selectEscapeRoute(enemy,player,all,obstacles,140);
  goalX=route.x;goalZ=route.z;
 }else if(intent==='regroup'){
  const allies=all.filter(e=>e!==enemy&&e.hp>40);
  if(allies.length){
   let best=allies[0],bestDistance=Infinity;
   for(const ally of allies){const d=Math.hypot(ally.x-enemy.x,ally.z-enemy.z);
    if(d<bestDistance){best=ally;bestDistance=d;}}
   // Apoio da frota sem se jogar em cima do colega.
   const vx=best.x-player.x,vz=best.z-player.z,len=Math.hypot(vx,vz)||1;
   goalX=best.x+vx/len*42;goalZ=best.z+vz/len*42;
  }else{
   const route=selectEscapeRoute(enemy,player,all,obstacles,105);
   goalX=route.x;goalZ=route.z;
  }
 }else{
  // O objetivo é manter distância tática enquanto ganha ângulo para atirar.
  const ideal=Math.max(70,Math.min(215,radius));
  const approach=(ideal-distance)/Math.max(1,distance);
  goalX-=dx*approach*.75;goalZ-=dz*approach*.75;
 }
 // Separação preventiva entre NPCs, aplicada no OBJETIVO, nunca nas posições.
 for(const other of all){
  if(other===enemy||other.hp<=0)continue;
  const sx=enemy.x-other.x,sz=enemy.z-other.z,sep=Math.hypot(sx,sz);
  if(sep<90&&sep>.01){const force=(90-sep)/90*48;goalX+=sx/sep*force;goalZ+=sz/sep*force;}
 }
 const state=intent==='withdraw'?'withdraw':intent==='regroup'?'regroup':
  role===0?'flank':role===1?'orbit':'intercept';
 return {active,goalX,goalZ,distance,role,state,intent,
  speed:intent==='withdraw'?38:intent==='regroup'?25:role===2?27:role===0?24:22,
  utilities,pressure:{closing,nearness,recentDamage,support}};
}
export function canEnemyFire(enemy,all,shots,now,playerHp){
 if(playerHp<=0||now<enemy.nextShot||enemy.hp<=0)return false;
 if(shots.filter(s=>s.age<s.duration).length>=TACTICS.maxActiveShooters)return false;
 const contenders=all.filter(e=>e.hp>0&&e.state!=='patrol'&&e.state!=='destroyed');
 // Alternating staggered turns avoid synchronized volleys.
 const group=Math.floor(now/TACTICS.pressureWindow)%3;
 return contenders.length<=3 || (enemy.id-1)%3===group || (enemy.id%3===group&&shots.length<2);
}


// Interceptação balística horizontal com projétil de velocidade constante.
// Resolve |posiçãoRelativa + velocidadeAlvo*t| = velocidadeProjetil*t.
// Não presume que o alvo continuará seguindo a proa; usa a velocidade observada.
// Pureza da função permite testar casos de perseguição, cruzamento e fuga.
export function predictIntercept(origin,target,velocity,projectileSpeed,maxTime=2.5){
 const rx=target.x-origin.x,rz=target.z-origin.z;
 const vx=velocity.x||0,vz=velocity.z||0,speed=Math.max(1,projectileSpeed);
 const a=vx*vx+vz*vz-speed*speed;
 const b=2*(rx*vx+rz*vz);
 const c=rx*rx+rz*rz;
 let t=Infinity;
 if(Math.abs(a)<1e-7){
  if(Math.abs(b)>1e-7){const candidate=-c/b;if(candidate>0)t=candidate;}
 }else{
  const disc=b*b-4*a*c;
  if(disc>=0){
   const root=Math.sqrt(disc);
   const t1=(-b-root)/(2*a),t2=(-b+root)/(2*a);
   if(t1>0)t=Math.min(t,t1);
   if(t2>0)t=Math.min(t,t2);
  }
 }
 const reachable=Number.isFinite(t)&&t<=maxTime;
 if(!reachable)t=Math.min(maxTime,Math.hypot(rx,rz)/speed);
 return {x:target.x+vx*t,z:target.z+vz*t,time:t,reachable};
}

// Varredura relativa: dois corpos móveis podem colidir ENTRE quadros.
// Retorna o instante normalizado de aproximação e distância mínima.
export function sweptMovingContact(a0,a1,b0,b1,radius){
 const rx=a0.x-b0.x,rz=a0.z-b0.z;
 const vx=(a1.x-a0.x)-(b1.x-b0.x);
 const vz=(a1.z-a0.z)-(b1.z-b0.z);
 const lenSq=vx*vx+vz*vz;
 const fraction=lenSq>1e-9?Math.max(0,Math.min(1,-(rx*vx+rz*vz)/lenSq)):0;
 const distance=Math.hypot(rx+vx*fraction,rz+vz*fraction);
 return {hit:distance<=radius,fraction,distance};
}

// Detecta risco real com antecedência curta. O projétil precisa cruzar
// a rota futura do NPC; estar dentro de um "raio de detecção" não basta.
export function assessProjectileThreat(enemy,projectiles,horizon=1.45){
 let best=null;
 for(const p of projectiles){
  if(!p||p.age<0||p.travel<=0)continue;
  const remaining=p.travel-p.age;
  if(remaining<=.05)continue;
  const px=p.mesh?.position?.x??p.origin.x,pz=p.mesh?.position?.z??p.origin.z;
  const vx=(p.destination.x-p.origin.x)/p.travel;
  const vz=(p.destination.z-p.origin.z)/p.travel;
  let time=0,distance=Infinity,hitX=px,hitZ=pz;
  const prediction=Math.min(horizon,remaining);
  const activeDirect=p.ammo==='torpedo'||p.ammo==='plasma'||p.ammo==='iron';
  if(activeDirect){
   const rx=px-enemy.x,rz=pz-enemy.z;
   const rvx=vx-(enemy.vx||0),rvz=vz-(enemy.vz||0);
   const norm=rvx*rvx+rvz*rvz;
   time=norm>1e-7?Math.max(0,Math.min(prediction,-(rx*rvx+rz*rvz)/norm)):0;
   hitX=px+vx*time;hitZ=pz+vz*time;
   distance=Math.hypot(hitX-(enemy.x+(enemy.vx||0)*time),hitZ-(enemy.z+(enemy.vz||0)*time));
   // Não confundir um projétil aéreo muito acima da nave com colisão iminente.
   if(p.ammo!=='torpedo'){
    const py=(p.origin.y||0)+((p.destination.y||0)-(p.origin.y||0))*Math.min(1,(p.age+time)/p.travel);
    if(Math.abs(py-(enemy.y+2.3))>8)continue;
   }
  }else if(p.ammo==='meteor'||p.ammo==='siege'||p.ammo==='scatter'){
   // Armas de queda/área: reação ao ponto onde vão cair.
   time=remaining;
   if(time>horizon)continue;
   hitX=p.destination.x;hitZ=p.destination.z;
   distance=Math.hypot(hitX-(enemy.x+(enemy.vx||0)*time),hitZ-(enemy.z+(enemy.vz||0)*time));
  }else continue;
  const blast=p.ammo==='torpedo'?12:p.ammo==='siege'?26:p.ammo==='meteor'?14:p.ammo==='scatter'?12:10;
  const danger=blast+Math.min(8,time*4);
  if(distance>danger||time<.09)continue;
  const score=(danger-distance)/danger+(horizon-time)/horizon*.4;
  if(!best||score>best.score)best={projectile:p,time,distance,hitX,hitZ,vx,vz,score,blast};
 }
 return best;
}

// Define o impulso transversal que mais afasta a nave do corredor da bala.
// A segunda opção pode ser utilizada para contornar objetos no mapa.
export function evadeVector(enemy,threat,side=1){
 const norm=Math.hypot(threat.vx,threat.vz)||1;
 const lateralX=-threat.vz/norm,lateralZ=threat.vx/norm;
 const futureX=enemy.x+(enemy.vx||0)*threat.time;
 const futureZ=enemy.z+(enemy.vz||0)*threat.time;
 const sideDot=(futureX-threat.hitX)*lateralX+(futureZ-threat.hitZ)*lateralZ;
 const sign=Math.abs(sideDot)<.5?(side>=0?1:-1):Math.sign(sideDot);
 return {x:lateralX*sign,z:lateralZ*sign};
}


// Arsenal completo dos patrulheiros. A chance de ACERTO é sempre o critério
// de escolha; dano, aparência e cadência são consequências, não pesos ocultos.
// Perfis próprios dos NPCs para equilibrar o combate sem alterar o jogador.
export const NPC_WEAPONS=Object.freeze({
 plasma: Object.freeze({name:'Plasma',range:112,speed:330,mode:'direct',radius:5.7,spread:2.2,damage:6,cooldown:1.55,color:0x25cfff}),
 iron: Object.freeze({name:'Teste de Ferro',range:190,speed:265,mode:'direct',radius:5.7,spread:4.3,damage:9,cooldown:2.55,color:0xffd28b}),
 torpedo: Object.freeze({name:'Torpedo',range:245,speed:83,mode:'torpedo',radius:6.8,spread:2.7,damage:15,cooldown:4.5,blast:35,color:0x62f2ec}),
 scatter: Object.freeze({name:'Chuva de Energia',range:214,speed:170,delay:.55,mode:'area',radius:13,spread:10,damage:4,cooldown:3.25,blast:13,color:0xbc80ff}),
 meteor: Object.freeze({name:'Meteoro',range:285,speed:195,delay:1.75,mode:'area',radius:16,spread:10.5,damage:9,cooldown:3.6,blast:16,color:0xff8b35}),
 siege: Object.freeze({name:'Tempestade Orbital',range:360,speed:230,delay:2.35,mode:'area',radius:25,spread:14,damage:13,cooldown:5.4,blast:25,color:0xe5a4ff})
});

// A incerteza cresce com o TEMPO DE VOO e as manobras do alvo.
// Aproximação Gaussiana 2D: P(dentro do raio)=1-exp(-r²/(2*sigma²)).
// A área da explosão entra no raio só nas armas que realmente explodem ao
// chegar. Torpedo exige contato: seu raio de explosão NÃO garante detoná-lo.
export function chooseNpcWeapon(origin,target,estimatedVelocity,readyAt,now,{
 weapons=NPC_WEAPONS,skill=.8,instability=0,blocked=()=>false
}={}){
 const dx=target.x-origin.x,dz=target.z-origin.z;
 const distance=Math.hypot(dx,dz);
 const targetSpeed=Math.hypot(estimatedVelocity.x||0,estimatedVelocity.z||0);
 const candidates=[];
 for(const [id,weapon] of Object.entries(weapons)){
  if(distance>weapon.range||now<(readyAt?.[id]??0))continue;
  const direct=weapon.mode!=='area';
  let lead,flight;
  if(direct){
   lead=predictIntercept(origin,target,estimatedVelocity,weapon.speed,Math.max(2.5,weapon.range/weapon.speed*1.6));
   if(!lead.reachable)continue;
   flight=Math.max(.12,lead.time);
   if(blocked(origin,lead,id))continue;
  }else{
   flight=(weapon.delay||0)+distance/weapon.speed;
   lead={x:target.x+(estimatedVelocity.x||0)*flight,z:target.z+(estimatedVelocity.z||0)*flight};
  }
  // Tiros de queda são mais visíveis/evitáveis; o alvo tem tempo para reagir.
  const uncertaintyFactor=direct?.18:.34;
  const motionError=(targetSpeed*uncertaintyFactor+4.5)*flight + Math.max(0,instability)*flight*flight*.07;
  const aimError=weapon.spread*(1.55-.65*skill);
  const sigma=Math.hypot(aimError,motionError,1.5);
  const probability=Math.min(.995,1-Math.exp(-(weapon.radius*weapon.radius)/(2*sigma*sigma)));
  candidates.push({id,weapon,aimX:lead.x,aimZ:lead.z,flight,probability,
   distance,sigma});
 }
 // Critério matemático único: maior chance estimada de contato/dano no alvo.
 // Empate numérico: tiro de menor duração para evitar escolhas instáveis.
 candidates.sort((a,b)=>b.probability-a.probability||a.flight-b.flight);
 return candidates[0]??null;
}
