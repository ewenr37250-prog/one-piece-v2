let _ac = null;
function getAC() { if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)(); return _ac; }

function playTone(freq, dur, type='sine', vol=.08) {
  try {
    const ac = getAC(); const osc = ac.createOscillator(); const gain= ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.start(); osc.stop(ac.currentTime + dur);
  } catch {}
}

const SFX = {
  success: () => { playTone(440,.1); setTimeout(()=>playTone(660,.15),100); },
  fail: () => { playTone(220,.2,'sawtooth',.06); },
  combat: () => { [200,300,250].forEach((f,i)=>setTimeout(()=>playTone(f,.1,'square',.05),i*80)); },
  join: () => { playTone(330,.1); setTimeout(()=>playTone(550,.2),120); },
  jailed: () => { [400,300,200].forEach((f,i)=>setTimeout(()=>playTone(f,.12,'sawtooth',.07),i*90)); },
};

let socket = null;
let me = {};
let authTab = 'login';
let chatCh = 'global';
let combatOpen = false;
let jailInterval = null;
let cdUntil = 0;
let onlineCount = 0, onlineSet = new Set();

const GRADES = {
  pirate: [{l:'Mousse',t:0},{l:'Pirate',t:5000},{l:'Pirate Notoire',t:50000},{l:'Supernova',t:300000},{l:'Capitaine',t:1000000},{l:'Shichibukai',t:10000000},{l:'Yonko',t:100000000}],
  marine: [{l:'Matelot',t:0},{l:'Enseigne',t:10000},{l:'Lieutenant',t:50000},{l:'Capitaine',t:200000},{l:'Commodore',t:500000},{l:'Vice-Amiral',t:2000000},{l:'Amiral',t:10000000}]
};

const fmt = n => { n=Math.max(0,Math.floor(n||0)); if(n>=1e9) return (n/1e9).toFixed(2)+'Md'; if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=1e3) return (n/1e3).toFixed(0)+'k'; return String(n); };
const fmtFull = n => Math.max(0,Math.floor(n||0)).toLocaleString('fr-FR');
function toast(msg,type='i'){ const el=document.createElement('div'); el.className=`toast t-${type}`; el.textContent=msg; document.getElementById('toasts').appendChild(el); setTimeout(()=>el.remove(),3000); }
function md(t){return String(t).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}

function switchTab(t){
  authTab=t; document.getElementById('tab-login').style.display = t==='login'?'':'none';
  document.getElementById('tab-register').style.display = t==='register'?'':'none';
  document.getElementById('tab-login-btn').classList.toggle('active',t==='login');
  document.getElementById('tab-register-btn').classList.toggle('active',t==='register');
  document.getElementById('auth-err').textContent='';
}
function setAuthErr(msg){ document.getElementById('auth-err').textContent=msg; }

function tryLogin(){ const name=document.getElementById('l-name').value.trim(); const pass=document.getElementById('l-pass').value; if(!name||!pass){setAuthErr('Remplissez tous les champs');return;} initSocket(); socket.emit('auth:login',{name,password:pass}); }
function tryRegister(){
  const name=document.getElementById('r-name').value.trim(); const pass=document.getElementById('r-pass').value;
  const fact=document.getElementById('r-faction').value; const code=document.getElementById('r-admin').value;
  if(!name||!pass){setAuthErr('Remplissez tous les champs');return;} if(pass.length<4){setAuthErr('Mot de passe trop court (min. 4)');return;}
  initSocket(); socket.emit('auth:register',{name,password:pass,faction:fact,adminCode:code});
}
function tryToken(){ const token=localStorage.getItem('op_token'); const name=localStorage.getItem('op_name'); if(!token||!name) return false; initSocket(); socket.emit('auth:token',{name,token}); return true; }
function initSocket(){
  if(socket) return;
  socket=io({transports:['websocket','polling']});
  socket.on('connect', ()=>{ if(!me.name) tryToken(); });
  socket.on('disconnect', ()=>toast('Connexion perdue','e'));
  socket.on('auth:error', msg=>{ setAuthErr(msg); toast(msg,'e'); SFX.fail(); });
  socket.on('auth:success',({token,player})=>{
    localStorage.setItem('op_token', token); localStorage.setItem('op_name', player.name);
    me = player; document.getElementById('overlay').style.display='none'; document.getElementById('app').classList.add('on');
    renderPlayer(player); SFX.join(); loadCombatHistory();
  });
  socket.on('player:update', p=>{ me=p; renderPlayer(p); });
  socket.on('log:add', ({type,msg})=>{
    addLog(type,msg);
    if(type==='success') SFX.success(); if(type==='danger') SFX.fail(); if(type==='combat') SFX.combat();
    if(msg.includes('prison')||msg.includes('ARRÊTÉ')) SFX.jailed();
  });
  socket.on('chat:history', msgs=>{ document.getElementById('chat-pane').innerHTML=''; msgs.forEach(renderChatMsg); });
  socket.on('chat:message', msg=>{
    renderChatMsg(msg);
    if(!document.getElementById('pane-chat').classList.contains('active')){
      const btn=document.querySelector('[onclick="showTab(\'chat\')"]'); if(btn&&!msg.isSystem) btn.style.color='var(--gold)';
    }
  });
  socket.on('leaderboard:update', list=>{ renderLeaderboard(list); document.getElementById('tb-online').textContent=`${onlineCount} en ligne`; });
  socket.on('online:update', users=>{ onlineCount=users.length; document.getElementById('tb-online').textContent=`${onlineCount} en ligne`; });
  socket.on('action:cooldown', ms=>{ toast('⏳ Action en cours...','w'); cdUntil=Date.now()+ms; setActionBtns(true); setTimeout(()=>setActionBtns(me.isJailed||false),ms); });
}

const animVals={};
function animNum(id,target){
  const el=document.getElementById(id); if(!el) return;
  const from=animVals[id]||0; animVals[id]=target;
  const start=performance.now(), dur=600, startV=from;
  const step=now=>{
    const t=Math.min(1,(now-start)/dur); const e=t<.5?2*t*t:-1+(4-2*t)*t;
    el.textContent=fmt(Math.floor(startV+(target-startV)*e));
    if(t<1) requestAnimationFrame(step); else el.textContent=fmt(target);
  };
  requestAnimationFrame(step);
}

function renderPlayer(p){
  document.getElementById('tb-name').textContent=p.name||'—'; document.getElementById('tb-grade').textContent=p.grade||'—';
  const badge=document.getElementById('tb-badge'); badge.textContent=(p.faction||'').toUpperCase(); badge.className=`faction-badge fb-${p.faction||'pirate'}`;
  animNum('s-bounty', p.bounty||0); animNum('s-berries', p.berries||0); document.getElementById('s-xp').textContent=fmtFull(p.xp||0);
  const wl=p.wantedLevel||0; document.querySelectorAll('.wd').forEach((d,i)=>d.classList.toggle('on',i<wl));
  
  const grades=GRADES[p.faction]||GRADES.pirate; const idx=p.gradeIndex||0;
  const cur=grades[idx], next=grades[idx+1]; const stat=p.faction==='marine'?p.berries:p.bounty;
  let pct=100; if(next){ const range=next.t-cur.t, prog=stat-cur.t; pct=Math.min(100,Math.max(0,Math.round((prog/range)*100))); }
  document.getElementById('g-cur').textContent=cur?.l||p.grade||'—'; document.getElementById('g-next').textContent=next?`→ ${next.l}`:'★ MAX'; document.getElementById('g-fill').style.width=pct+'%';
  
  const st=p.stats||{};
  document.getElementById('sd-train').textContent=st.trainCount||0; document.getElementById('sd-pillage').textContent=st.pillageCount||0;
  document.getElementById('sd-nav').textContent=st.navCount||0; document.getElementById('sd-wins').textContent=st.combatWins||0;
  document.getElementById('sd-losses').textContent=st.combatLosses||0; document.getElementById('sd-arrested').textContent=st.arrested||0;

  const jail=document.getElementById('jail-banner');
  if(p.isJailed&&p.jailUntil){ jail.style.display=''; setActionBtns(true); startJailTimer(new Date(p.jailUntil)); } 
  else { jail.style.display='none'; clearJailTimer(); setActionBtns(false); }
  if(p.adminLevel>=2) document.getElementById('admin-wrap').style.display='';
}

function setActionBtns(disabled){ ['btn-train','btn-pillage','btn-navigate','btn-combat'].forEach(id=>{ const b=document.getElementById(id); if(b) b.disabled=disabled; }); }
function startJailTimer(until){ clearJailTimer(); const tick=()=>{ const s=Math.max(0,Math.ceil((until-Date.now())/1000)); document.getElementById('jail-timer').textContent=s+'s'; if(s<=0){ clearJailTimer(); socket.emit('action:release'); } }; tick(); jailInterval=setInterval(tick,1000); }
function clearJailTimer(){ if(jailInterval){clearInterval(jailInterval);jailInterval=null;} }
function act(type){
  if(Date.now()<cdUntil){toast('⏳ Cooldown...','w');return;}
  socket.emit(`action:${type}`);
}

function toggleCombat(){
  combatOpen=!combatOpen; const w=document.getElementById('combat-wrap'); w.classList.toggle('open',combatOpen);
  if(combatOpen) document.getElementById('combat-target').focus();
}

function startCombat(){
  const t=document.getElementById('combat-target').value.trim();
  if(!t){toast('Entrez un nom','e');return;} if(Date.now()<cdUntil){toast('⏳ Cooldown...','w');return;}
  socket.emit('action:combat',{target:t});
  document.getElementById('combat-target').value=''; document.getElementById('combat-wrap').classList.remove('open'); combatOpen=false;
}

function tryRelease(){ socket.emit('action:release'); }

function addLog(type,msg){
  const pane=document.getElementById('log-pane'); const div=document.createElement('div');
  div.className=`log-entry le-${type}`; div.innerHTML=md(msg);
  pane.appendChild(div); pane.scrollTop=pane.scrollHeight;
  while(pane.children.length>200) pane.removeChild(pane.firstChild);
}
function clearLog(){ document.getElementById('log-pane').innerHTML=''; }

const FC_COLOR={pirate:'var(--fc-pirate)',marine:'var(--fc-marine)',secret:'var(--fc-secret)',system:'var(--fc-system)'};
function renderChatMsg(msg){
  const pane=document.getElementById('chat-pane'); const div=document.createElement('div'); div.className='chat-msg';
  const time=new Date(msg.createdAt||Date.now()).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  if(msg.isSystem){ div.className+=' cm-sys'; div.innerHTML=`<span class="cm-author" style="color:var(--fc-system)">SYSTÈME</span><span class="cm-text">${md(msg.text)}</span>`; } 
  else { const c=FC_COLOR[msg.faction]||'var(--text)'; div.innerHTML=`<span class="cm-author" style="color:${c}">${msg.author}</span><span class="cm-text">${md(msg.text)}</span><span class="cm-time">${time}</span>`; }
  pane.appendChild(div); pane.scrollTop=pane.scrollHeight; while(pane.children.length>300) pane.removeChild(pane.firstChild);
}

function setCh(ch,btn){ chatCh=ch; document.querySelectorAll('.chat-ch').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); }
function sendChat(){ const inp=document.getElementById('chat-input'); const text=inp.value.trim(); if(!text||!socket||!me.name) return; const channel=chatCh==='faction'?me.faction:'global'; socket.emit('chat:send',{text,channel}); inp.value=''; }

function renderLeaderboard(list){
  const medals=[{cl:'g',t:'🥇'},{cl:'s',t:'🥈'},{cl:'b',t:'🥉'}]; const fc={pirate:'var(--fc-pirate)',marine:'var(--fc-marine)',secret:'var(--fc-secret)'};
  document.getElementById('lb-list').innerHTML=list.map((p,i)=>`
    <div class="lb-row" onclick="fillCombatTarget('${p.name}')">
      <span class="lb-rank ${medals[i]?.cl||''}">${i<3?medals[i].t:'#'+(i+1)}</span>
      <div class="lb-info"><div class="lb-name" style="color:${fc[p.faction]||'var(--text)'}">${p.name}</div><div class="lb-grade">${p.grade||'—'}</div></div>
      <span class="lb-bounty">${fmt(p.bounty)} ฿</span>
    </div>`).join('');
}
function fillCombatTarget(name){ document.getElementById('combat-target').value=name; if(!combatOpen) toggleCombat(); document.getElementById('combat-target').focus(); }

async function loadCombatHistory(){
  try{
    const r=await fetch('/api/combats'); const list=await r.json(); const pane=document.getElementById('hist-pane');
    if(!list.length){pane.innerHTML='<div style="color:var(--muted);padding:20px;font-style:italic;font-size:.85em">Aucun combat enregistré.</div>';return;}
    pane.innerHTML=list.map(c=>{
      const date=new Date(c.createdAt).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      return `<div class="ch-card"><div class="ch-header"><span>⚔️ ${c.attacker} vs ${c.defender}</span><span>${date}</span></div>
        <div class="ch-line">🏆 Vainqueur : <strong>${c.winner}</strong> (+${(c.bountyGained||0).toLocaleString()} ฿)</div>
        ${(c.narrative||[]).slice(-2).map(l=>`<div class="ch-line" style="opacity:.65;font-size:.85em">${md(l)}</div>`).join('')}</div>`;
    }).join('');
  } catch { document.getElementById('hist-pane').innerHTML='<div style="color:var(--muted);padding:20px">Impossible de charger.</div>'; }
}

function showTab(id){ document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active')); document.querySelectorAll('.tab-btn').forEach(b=>{b.classList.remove('active');b.style.color='';}); document.getElementById('pane-'+id).classList.add('active'); event.currentTarget?.classList.add('active'); if(id==='hist') loadCombatHistory(); }
function toggleLeft(){ document.getElementById('left').classList.toggle('open'); }
function admDo(action){ const target=document.getElementById('a-target').value.trim(); const value=document.getElementById('a-value').value.trim(); const code=document.getElementById('a-code').value.trim(); socket.emit('admin:action',{action,target,value,code}); }
function admBroadcast(){ const msg=document.getElementById('a-broadcast').value.trim(); const code=document.getElementById('a-code').value.trim(); if(!msg) return; socket.emit('admin:action',{action:'broadcast',value:msg,code}); document.getElementById('a-broadcast').value=''; }

window.addEventListener('load',()=>{ const token=localStorage.getItem('op_token'); const name=localStorage.getItem('op_name'); if(token&&name){ initSocket(); } });
