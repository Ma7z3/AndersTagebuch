'use strict';
window.TagebuchChronik=(()=>{
  let book,host,mode='figuren',query='',limit=0;
  let figureOrder='story';
  try{const v=Number(localStorage.getItem('ander-lesestand-v1'));if(Number.isInteger(v)&&v>=0&&v<=46)limit=v;}catch{}
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s).normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const data=()=>book.chronik||{figuren:[],gegenstaende:[],gemalde:{}};
  const ch=n=>'kapitel-'+String(n).padStart(2,'0');
  const name=e=>(e.namen||[]).filter(n=>n.kapitel<=limit).at(-1)?.name||e.name;
  const known=e=>e.ab_kapitel<=limit;
  const itemSource=({kapitel,anker})=>`<a href="#${esc(anker||ch(kapitel))}">${chapterLabel(kapitel)}</a>`;
  const firstChapter=e=>e.ab_kapitel===0||!e.auftritte.length?e.ab_kapitel:Math.min(...e.auftritte.map(a=>a.kapitel));
  const chapterLabel=n=>n===0?'Prolog':'Kapitel '+n;
  function figureSources(e){
    const sources=new Map(e.auftritte.filter(a=>a.kapitel<=limit).map(a=>[a.kapitel,a.anker]));
    if(e.ab_kapitel===0&&!sources.has(0))sources.set(0,'prolog');
    if(!sources.size)return '';
    return `<h3>Fundstellen im Tagebuch</h3><ul class="chronik-sources">${[...sources].sort(([a],[b])=>a-b).map(([n,anchor])=>{
      const id=n===0?'prolog':ch(n);
      const title=book.abschnitte.find(s=>s.id===id)?.titel.replace(/^Kapitel \d+[: –]+/,'');
      return `<li><a href="#${esc(anchor||id)}"><span>${chapterLabel(n)}</span>${n&&title?`<strong>${esc(title)}</strong>`:''}<span class="chronik-source-arrow" aria-hidden="true">→</span></a></li>`;
    }).join('')}</ul>`;
  }
  function portrait(e,large=false){
    const p=e.portrait&&e.portrait.ab_kapitel<=limit?e.portrait:null;
    if(large&&p?.ganzkoerper)return `<figure class="chronik-ganzkoerper"><a href="${esc(p.bild)}" target="_blank" rel="noopener" aria-label="Ganzkörperporträt von ${esc(name(e))} in voller Größe öffnen"><img src="${esc(p.bild)}" alt="Ganzkörperporträt von ${esc(name(e))}"></a></figure>`;
    return `<span class="chronik-portrait ${large?'large':''}" ${p?`data-portrait="${esc(e.id)}"`:''}>${p?`<img src="${esc(p.vorschau||p.bild)}" alt="" loading="lazy" decoding="async">`:`<span aria-hidden="true">${esc(e.name.slice(0,1))}</span>`}</span>`;
  }
  function applyPortraits(root){
    root.querySelectorAll('[data-portrait]').forEach(el=>{
      const e=data().figuren.find(e=>e.id===el.dataset.portrait),p=e?.portrait,img=el.querySelector('img');if(!p||!img)return;
      if(p.vorschau){Object.assign(img.style,{width:'100%',height:'100%',left:'0',top:'0'});return;}
      const [x,y,w,h]=p.ausschnitt||[0,0,100,100];
      img.style.width=(10000/w)+'%';img.style.height=(10000/h)+'%';img.style.left=(-100*x/w)+'%';img.style.top=(-100*y/h)+'%';
    });
  }
  function picker(){return `<label class="chronik-limit">Gelesen bis <select data-lesestand aria-label="Gelesen bis Kapitel">${Array.from({length:47},(_,n)=>`<option value="${n}" ${n===limit?'selected':''}>${n?'Kapitel '+n:'Prolog'}</option>`).join('')}</select></label>`;}
  function bindPicker(root,onchange){root.querySelectorAll('[data-lesestand]').forEach(el=>el.addEventListener('change',()=>{limit=Number(el.value);try{localStorage.setItem('ander-lesestand-v1',String(limit));}catch{}onchange();}));}
  function modal(){
    let d=document.querySelector('#chronik-dialog');if(d)return d;
    d=document.createElement('dialog');d.id='chronik-dialog';d.innerHTML='<button type="button" class="chronik-close" aria-label="Karte schließen">×</button><div class="chronik-dialog-body"></div>';
    d.querySelector('button').addEventListener('click',()=>d.close());d.addEventListener('click',ev=>{if(ev.target===d||ev.target.closest('a'))d.close();});document.body.append(d);return d;
  }
  function openFigure(id){
    const e=data().figuren.find(e=>e.id===id);if(!e)return;
    const d=modal(),body=d.querySelector('.chronik-dialog-body');
    if(!known(e)){body.innerHTML=`<h2>Noch nicht freigegeben</h2><p>Wähle deinen Lesestand, um die bis dahin bekannten Figuren anzusehen.</p>${picker()}`;bindPicker(body,()=>openFigure(id));if(!d.open)d.showModal();return;}
    const facts=e.fakten.filter(f=>f.kapitel<=limit),relationships=e.beziehungen.filter(r=>r.kapitel<=limit);
    const description=[...new Set(facts.map(f=>f.text).filter(t=>t!=='?'))];
    body.innerHTML=`${portrait(e,true)}<p class="eyebrow">${e.art==='abenteurer'?'Abenteuerrunde':e.art==='gegenstand'?'Bewusster Gegenstand':'Personen und Geschöpfe'}</p><h2>${esc(name(e))}</h2>${e.rasse&&e.rasse!=='?'?`<p>${esc(e.rasse)}</p>`:''}${description.map(t=>`<p>${esc(t)}</p>`).join('')}${relationships.length?'<h3>Beziehungen</h3>'+relationships.map(r=>`<p>${esc(r.text)}</p>`).join(''):''}${figureSources(e)}`;
    applyPortraits(body);if(!d.open)d.showModal();
  }
  function openItem(id){
    const e=data().gegenstaende.find(e=>e.id===id);if(!e||!known(e))return;
    const d=modal(),body=d.querySelector('.chronik-dialog-body'),events=e.ereignisse.filter(a=>a.kapitel<=limit),owner=events.filter(e=>e.besitzer).at(-1)?.besitzer;
    const label=esc(name(e)),mentions=e.auftritte.filter(a=>a.kapitel<=limit);
    body.innerHTML=`
      <p class="eyebrow">Gegenstandschronik · bis Kapitel ${limit}</p>
      <h2>${label}</h2>
      ${e.bild?`<img class="chronik-item-art" src="${esc(e.bild)}" alt="${label}">`:''}
      ${owner?`<p>Zuletzt belegt bei <strong>${esc(owner)}</strong></p>`:''}
      <ol class="chronik-timeline">${events.map(ev=>`<li>${itemSource(ev)}<p>${esc(ev.text)}</p></li>`).join('')}</ol>
      ${mentions.length?`<h3>Weitere Erwähnungen</h3><p class="chronik-links">${mentions.map(itemSource).join(' ')}</p>`:''}
      ${limit===46&&e.anker?`<a href="#${esc(e.anker)}">Vollständigen Gegenstandseintrag öffnen →</a>`:''}
    `;
    if(!d.open)d.showModal();
  }
  function show(container,diary){host=container;book=diary;render();window.scrollTo(0,0);}
  function render(){
    const order=mode==='figuren'?'<label>Sortieren <select id="chronik-sort"><option value="story">Erste Fundstelle</option><option value="name">Name (A–Z)</option></select></label>':'';
    host.innerHTML=`<section class="sheet chronik" id="lesetext" tabindex="-1"><p class="eyebrow">Gesichter · Beziehungen · Spuren</p><h1>Die Chronik der Gefährten</h1><p>Wer ist uns begegnet? Wem gehört ein besonderer Gegenstand? Wähle deinen Lesestand; spätere Ereignisse bleiben verborgen.</p><div class="chronik-controls">${picker()}<div class="chronik-tabs"><button data-tab="figuren" aria-pressed="${mode==='figuren'}">Figuren</button><button data-tab="gegenstaende" aria-pressed="${mode==='gegenstaende'}">Gegenstände</button></div>${order}<label>Suchen <input id="chronik-suche" type="search" value="${esc(query)}" placeholder="Name …"></label></div><div id="chronik-cards" aria-live="polite"></div><p class="chronik-note">Der Lesestand ändert sich nur durch deine Auswahl. Namensnennungen im Text sind keine gesicherten persönlichen Begegnungen.</p></section>`;
    bindPicker(host,render);host.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.tab;render();}));host.querySelector('#chronik-suche').addEventListener('input',ev=>{query=ev.target.value;cards();});
    const select=host.querySelector('#chronik-sort');
    if(select){select.value=figureOrder;select.addEventListener('change',()=>{figureOrder=select.value;cards();});}
    cards();
  }
  function cards(){
    const root=host.querySelector('#chronik-cards'),all=mode==='figuren'?data().figuren:data().gegenstaende,visible=all.filter(e=>known(e)&&norm(name(e)).includes(norm(query)));
    if(mode==='figuren')visible.sort((a,b)=>{
      const byChapter=figureOrder==='story'?firstChapter(a)-firstChapter(b):0;
      return byChapter||name(a).localeCompare(name(b),'de');
    });
    root.innerHTML=`<p class="chronik-note">${visible.length} ${mode==='figuren'?'bekannte Figuren':'bekannte Gegenstände'}</p><div class="chronik-grid">${visible.map(e=>mode==='figuren'?`<button type="button" class="chronik-card" data-figur="${esc(e.id)}">${portrait(e)}<strong>${esc(name(e))}</strong><small>${esc(e.rasse||'Im Tagebuch')}</small></button>`:`<button type="button" class="chronik-card" data-gegenstand="${esc(e.id)}">${e.bild?`<img class="chronik-item-thumb" src="${esc(e.bild)}" alt="" loading="lazy" decoding="async">`:''}<strong>${esc(name(e))}</strong><small>Die Geschichte des Gegenstands →</small></button>`).join('')}</div>`;
    applyPortraits(root);bindCards(root);
  }
  function bindCards(root){root.querySelectorAll('[data-figur]').forEach(b=>b.addEventListener('click',()=>openFigure(b.dataset.figur)));root.querySelectorAll('[data-gegenstand]').forEach(b=>b.addEventListener('click',()=>openItem(b.dataset.gegenstand)));}
  function enhance(root,diary,section){
    book=diary;
    // The printed directory is one table too; portrait circles are web-only.
    if(section.id==='addendum-01'||section.datei==='inhalte/80-addenda.md'){
      root.querySelectorAll('tbody tr').forEach(row=>{
        const cell=row.cells[0];if(!cell)return;const label=cell.textContent.trim();let matches=data().figuren.filter(e=>e.name===label||e.aliases.includes(label));
        if(label.startsWith('Schmetterschrei'))matches=data().figuren.filter(e=>e.id==='schmetterschrei');
        if(label==='Mab und Simon'){for(const id of ['mab','simon']){const person=data().figuren.find(e=>e.id===id);const b=document.createElement('button');b.type='button';b.className='directory-portrait';b.dataset.figur=id;b.setAttribute('aria-label','Figurenkarte: '+person.name);b.innerHTML=portrait(person);cell.prepend(b);}return;}
        const e=matches.length>1?matches.find(e=>e.id.endsWith(row.textContent.includes('Harmonium')?'-sigil':'-dolchfall')):matches[0];if(!e)return;
        const b=document.createElement('button');b.type='button';b.className='directory-portrait';b.dataset.figur=e.id;b.setAttribute('aria-label','Figurenkarte: '+label);b.innerHTML=portrait(e);cell.prepend(b);
      });applyPortraits(root);bindCards(root);
    }
    const painting=root.querySelector('.chapter-painting'),spots=data().gemalde[section.id];
    if(painting&&spots?.length){
      const number=Number(section.id.slice(-2)),tools=document.createElement('div');tools.className='painting-tools';const toggle=document.createElement('button');toggle.type='button';toggle.textContent='Gemälde erkunden';toggle.setAttribute('aria-pressed','false');tools.append(toggle);painting.parentElement.after(tools);
      toggle.addEventListener('click',()=>{
        const on=toggle.getAttribute('aria-pressed')!=='true';toggle.setAttribute('aria-pressed',String(on));painting.querySelector('.painting-hotspots')?.remove();tools.querySelector('.painting-gate')?.remove();
        if(!on)return;
        if(limit<number){const gate=document.createElement('button');gate.className='painting-gate';gate.type='button';gate.textContent='Lesestand bis Kapitel '+number+' freigeben';gate.addEventListener('click',()=>{limit=number;try{localStorage.setItem('ander-lesestand-v1',String(limit));}catch{}toggle.setAttribute('aria-pressed','false');toggle.click();});tools.append(gate);return;}
        const layer=document.createElement('div');layer.className='painting-hotspots';
        spots.forEach((s,i)=>{const e=(s.art==='figur'?data().figuren:data().gegenstaende).find(e=>e.id===s.id);if(!e||e.ab_kapitel>Math.min(limit,number))return;const b=document.createElement('button');b.type='button';b.textContent=String(i+1);b.title=name(e);b.setAttribute('aria-label',name(e)+' erkunden');b.style.left=s.x+'%';b.style.top=s.y+'%';b.addEventListener('click',ev=>{ev.stopPropagation();s.art==='figur'?openFigure(s.id):openItem(s.id);});layer.append(b);});painting.append(layer);
      });
    }
    root.querySelectorAll('.item-image').forEach(img=>{const item=data().gegenstaende.find(e=>e.bild===img.getAttribute('src'));if(!item||!known(item))return;const b=document.createElement('button');b.type='button';b.className='item-history-link';b.textContent='Gegenstandschronik öffnen';b.addEventListener('click',()=>openItem(item.id));img.after(b);});
  }
  return{show,enhance,openFigure,openItem};
})();
