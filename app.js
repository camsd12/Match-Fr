let filter='all', matches=[];
const fmtD=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',weekday:'long',day:'numeric',month:'long'});
const fmtT=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function badge(x,fallback){return x&&/^https?:/.test(x)?`<span class="badge"><img class="crest" src="${esc(x)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span style="display:none">${esc(fallback||'🏀')}</span></span>`:`<span class="badge">${esc(x||fallback||'🏀')}</span>`}
function render(){
 const root=document.querySelector('#matches'); root.innerHTML=''; const groups={};
matches.filter(x => x.sport !== 'NBA' && (filter === 'all' || x.sport === filter)).forEach(x => {
 if(!Object.keys(groups).length){root.innerHTML='<div class="empty">Aucun match trouvé pour ce filtre dans les 14 prochains jours.</div>';return}
 for(const [day,items] of Object.entries(groups)){
  root.insertAdjacentHTML('beforeend',`<h3 class="day">${esc(day)}</h3>`);
  items.forEach(x=>root.insertAdjacentHTML('beforeend',`<article class="card"><div class="meta"><span>${x.sport==='NBA'?'🏀':'⚽'} ${esc(x.comp)}</span><span>🇫🇷 heure France</span></div><div class="teams"><div class="team">${badge(x.homeIcon,'●')}<span>${esc(x.home)}</span></div><div class="time"><strong>${fmtT.format(new Date(x.utc))}</strong><small>Paris</small></div><div class="team">${badge(x.awayIcon,'●')}<span>${esc(x.away)}</span></div></div><div class="tv">📺 ${esc(x.tv||'Diffuseur FR à confirmer')}</div></article>`));
 }
}
async function load(){
 document.querySelector('#updated').textContent='Mise à jour…';
 try{
  const r=await fetch('./matches.json?'+Date.now(),{cache:'no-store'}); if(!r.ok)throw Error(r.status); matches=await r.json();
  const u=await fetch('./last-update.json?'+Date.now(),{cache:'no-store'}); const info=u.ok?await u.json():null;
  document.querySelector('#updated').textContent=info?.updatedAt?'Données mises à jour '+new Date(info.updatedAt).toLocaleString('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Données chargées';
 }catch(e){matches=[];document.querySelector('#updated').textContent='Mise à jour indisponible';}
 render();
}
document.querySelector('#date').textContent=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelector('.tabs .active').classList.remove('active');b.classList.add('active');filter=b.dataset.filter;render()});
document.querySelector('#refresh').onclick=load;
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');
load(); setInterval(load,300000);
