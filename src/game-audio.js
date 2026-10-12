// Áudio procedural, desbloqueado por interação do jogador; sem arquivos externos.
export function createGameAudio(){
 let context=null,master=null,ambience=null,motor=null,osc=null,noise=null,unlocked=false;
 const settings={enabled:true,effects:.70,environment:.22};
 // Gravacoes originais CC0: Thimras / OpenGameArt, Battle at Sea.
 // Em uma próxima etapa, hospedar os OGG localmente para não depender de terceiros.
 const realSounds={
  iron:'https://opengameart.org/sites/default/files/cannon_fire_1.ogg',
  torpedo:'https://opengameart.org/sites/default/files/cannon_fire_1.ogg',
  impact:'https://opengameart.org/sites/default/files/cannon_hit_1.ogg'
 };
 const realBuffers=new Map(),realLoading=new Set();
 function loadReal(kind){
  if(!context||!realSounds[kind]||realBuffers.has(kind)||realLoading.has(kind))return;
  realLoading.add(kind);
  fetch(realSounds[kind]).then(r=>{if(!r.ok)throw Error('Audio HTTP '+r.status);return r.arrayBuffer()})
   .then(data=>context.decodeAudioData(data)).then(buffer=>realBuffers.set(kind,buffer))
   .catch(()=>{}).finally(()=>realLoading.delete(kind));
 }
 function playReal(kind,pan=0,distance=0){
  if(!context||!unlocked||!settings.enabled||!realBuffers.has(kind))return false;
  const source=context.createBufferSource(),gain=context.createGain();
  const panner=context.createStereoPanner?context.createStereoPanner():null;
  source.buffer=realBuffers.get(kind);
  gain.gain.value=settings.effects*(kind==='impact'?.26:.34)/(1+distance/140);
  source.connect(gain);
  if(panner){panner.pan.value=Math.max(-1,Math.min(1,pan));gain.connect(panner);panner.connect(master)}
  else gain.connect(master);
  source.start();
  source.onended=()=>{source.disconnect();gain.disconnect();panner?.disconnect()};
  return true;
 }
 const AudioContextClass=window.AudioContext||window.webkitAudioContext;
 function ensure(){
  if(!settings.enabled||!AudioContextClass)return false;
  if(!context){
   context=new AudioContextClass();
   master=context.createGain();master.gain.value=.65;master.connect(context.destination);
   ambience=context.createGain();ambience.gain.value=0;ambience.connect(master);
   motor=context.createGain();motor.gain.value=0;motor.connect(master);
   osc=context.createOscillator();osc.type='sawtooth';osc.frequency.value=43;
   const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=220;
   osc.connect(filter);filter.connect(motor);osc.start();
   const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),samples=buffer.getChannelData(0);
   for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
   noise=context.createBufferSource();noise.buffer=buffer;noise.loop=true;
   const seaFilter=context.createBiquadFilter();seaFilter.type='lowpass';seaFilter.frequency.value=380;
   noise.connect(seaFilter);seaFilter.connect(ambience);noise.start();
  }
  if(context.state==='suspended')context.resume().catch(()=>{});
  unlocked=true;for(const kind of Object.keys(realSounds))loadReal(kind);return true;
 }
 function play(kind,pan=0,distance=0){
  if(!unlocked||!settings.enabled||!context)return;
  if(playReal(kind,pan,distance))return;
  const now=context.currentTime;
  const tone=context.createOscillator(),gain=context.createGain();
  const panner=context.createStereoPanner?context.createStereoPanner():null;
  const options={
   plasma:[540,110,.22,'sawtooth',.095],iron:[95,45,.18,'triangle',.17],
   torpedo:[120,40,.47,'sawtooth',.23],meteor:[400,68,.53,'sine',.19],
   scatter:[760,210,.37,'square',.075],siege:[65,25,.85,'sawtooth',.27],
   impact:[180,38,.24,'triangle',.17],danger:[840,540,.13,'sine',.09],
   boost:[95,310,.38,'sawtooth',.19],victory:[420,840,.55,'sine',.15]
  };
  const [start,end,duration,type,volume]=options[kind]||options.impact;
  tone.type=type;tone.frequency.setValueAtTime(start,now);tone.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+duration);
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*settings.effects/(1+distance/140)),now+.012);
  gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  tone.connect(gain);
  if(panner){panner.pan.value=Math.max(-1,Math.min(1,pan));gain.connect(panner);panner.connect(master);}
  else gain.connect(master);
  tone.start(now);tone.stop(now+duration+.02);
  tone.onended=()=>{tone.disconnect();gain.disconnect();panner?.disconnect()};
 }
 function update(speed,boost){
  if(!unlocked||!context)return;
  const t=context.currentTime,velocity=Math.min(1,Math.abs(speed)/105);
  osc.frequency.setTargetAtTime(38+velocity*95+(boost?50:0),t,.07);
  motor.gain.setTargetAtTime(settings.enabled?(.015+velocity*.07+(boost?.07:0))*settings.effects:0,t,.10);
  ambience.gain.setTargetAtTime(settings.enabled?settings.environment*.07:0,t,.5);
 }
 function setEnabled(value){
  settings.enabled=!!value;
  if(settings.enabled)ensure();
  else if(context){motor.gain.setTargetAtTime(0,context.currentTime,.06);ambience.gain.setTargetAtTime(0,context.currentTime,.06)}
 }
 return {unlock:ensure,play,update,setEnabled,get enabled(){return settings.enabled}};
}
