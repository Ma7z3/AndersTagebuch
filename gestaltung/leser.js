'use strict';
const book=window.TAGEBUCH;
const content=document.querySelector('#inhalt');
const nav=document.querySelector('#navigation');
const search=document.querySelector('#suche');
const searchStatus=document.querySelector('#suchstatus');
const pathLabel=document.querySelector('#pfad');
const pager=document.querySelector('#blaettern');
const dialog=document.querySelector('#bilddialog');
const sections=book.abschnitte;
const byId=new Map(sections.map(s=>[s.id,s]));
const anchors=new Map();
const sessions=[];
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold=s=>s.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('de');
const plain=s=>s.replace(/<[^>]*>/g,' ').replace(/!\[([^\]]*)\]\([^)]+\)/g,'$1').replace(/\[([^\]]*)\]\([^)]+\)/g,'$1').replace(/[#*_>|]/g,' ').replace(/\s+/g,' ').trim();
for(const section of sections){
  section.searchText=plain(section.text);
  section.folded=fold(section.searchText);
  for(const match of section.text.matchAll(/<a id="(p\d+)"><\/a>/g))anchors.set(match[1],section.id);
  let count=0;
  for(const match of section.text.matchAll(/Spielabend vom\s+(\d{2}\.\d{2}\.\d{4})/g)){
    const anchor='abend-'+section.id+'-'+count++;
    sessions.push({date:match[1],section:section.id,anchor});
  }
}

function drawNav(query=''){
  nav.replaceChildren();
  let groupName='';let group;
  for(const section of sections){
    if(query&&!section.folded.includes(fold(query)))continue;
    if(groupName!==section.gruppe){
      groupName=section.gruppe;
      group=document.createElement('section');group.className='nav-group';
      const label=document.createElement('h2');label.textContent=groupName;
      group.append(label);nav.append(group);
    }
    const link=document.createElement('a');link.className='nav-item';link.href='#'+section.id;
    link.textContent=section.titel.replace(/^Kapitel (\d+)[: –]+/,'$1 · ');
    link.dataset.section=section.id;
    if(section.art==='entwurf'){const note=document.createElement('small');note.textContent='Unbearbeitete Spielnotizen';link.append(note);}
    group.append(link);
  }
}

function safeMarkdown(text){
  const parsed=new DOMParser().parseFromString(marked.parse(text,{gfm:true,breaks:false}),'text/html');
  const allowed=new Set(['A','P','H1','H2','H3','H4','H5','H6','STRONG','EM','DEL','UL','OL','LI','BLOCKQUOTE','TABLE','THEAD','TBODY','TR','TD','TH','HR','BR','IMG','PRE','CODE','SPAN']);
  for(const el of [...parsed.body.querySelectorAll('*')]){
    if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);continue;}
    for(const attr of [...el.attributes]){
      if(!['href','src','alt','id','title','start'].includes(attr.name))el.removeAttribute(attr.name);
    }
    for(const attr of ['href','src']){
      if(!el.hasAttribute(attr))continue;
      const value=el.getAttribute(attr);
      if(/^(?:javascript|data|vbscript):/i.test(value)||value.startsWith('//'))el.removeAttribute(attr);
      if(attr==='src'&&!/^bilder\/[\w.-]+$/.test(value))el.removeAttribute(attr);
    }
    if(el.tagName==='A'&&/^https?:/.test(el.getAttribute('href')||'')){el.target='_blank';el.rel='noopener noreferrer';}
    if(el.tagName==='IMG'){el.loading='lazy';el.decoding='async';}
  }
  for(const caption of book.bildlegenden||[]){
    const img=[...parsed.body.querySelectorAll('img')].find(im=>im.getAttribute('src')===caption.bild);
    if(!img)continue;
    const imageBlock=img.parentElement;
    const heading=imageBlock.nextElementSibling;
    if(!heading||heading.tagName!=='H5'||heading.textContent.trim()!==caption.titel)continue;
    const credit=heading.nextElementSibling;
    const hasCredit=caption.nachweis&&credit?.textContent.replace(/\s+/g,' ').trim()===caption.nachweis;
    const figure=document.createElement('figure');figure.className='artist';
    imageBlock.before(figure);figure.append(imageBlock);
    const label=document.createElement('figcaption');figure.append(label);
    const title=document.createElement('span');title.className='caption-title';title.append(...heading.childNodes);label.append(title);heading.remove();
    if(hasCredit){const author=document.createElement('span');author.className='caption-credit';author.append(...credit.childNodes);label.append(author);credit.remove();}
  }
  for(const img of [...parsed.body.querySelectorAll('img')]){
    if(img.closest('figure,blockquote'))continue;
    const imageBlock=img.parentElement,next=imageBlock.nextElementSibling;
    if(next?.tagName==='BLOCKQUOTE'){
      const figure=document.createElement('figure');figure.className='illustration-note';
      imageBlock.before(figure);figure.append(imageBlock,next);
    }else if(next?.tagName==='P'&&next.querySelector('em')&&next.textContent.includes('Farbzeichnung von Ander Holimion')){
      const figure=document.createElement('figure');figure.className='artist';imageBlock.before(figure);figure.append(imageBlock);
      const label=document.createElement('figcaption'),title=document.createElement('span');title.className='caption-title';title.append(...next.childNodes);label.append(title);figure.append(label);next.remove();
    }
  }
  let count=0;
  for(const heading of parsed.body.querySelectorAll('h1,h2,h3,h4,h5,h6')){
    if(heading.textContent.includes('Spielabend vom')){
      heading.className='session';heading.id='abend-'+activeId+'-'+count++;
    }
  }
  return parsed.body.innerHTML;
}

let activeId='titel';
function setActive(id){
  activeId=id;
  for(const link of nav.querySelectorAll('.nav-item')){
    const active=link.dataset.section===id;link.classList.toggle('active',active);
    if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
}

function showSection(section,target){
  setActive(section.id);pathLabel.textContent=section.gruppe;
  document.title=section.titel+' · Ander Holimion';
  const cover=section.art==='titel';
  const note=section.art==='entwurf'?'<div class="status-note">Rohnotizen vom Spielabend. Der Wortlaut wurde aus Word übernommen; dies ist noch kein ausgearbeiteter Tagebucheintrag.</div>':'';
  const stats=cover?`<div class="book-stats"><span>${sections.filter(s=>s.art==='kapitel'||s.art==='eintrag').length} KAPITEL</span><span>${book.bilder.length} ILLUSTRATIONEN</span><span>2022–2026</span></div><a class="read-next" href="#prolog">Die Reise beginnen →</a>`:'';
  content.innerHTML=`<article id="lesetext" tabindex="-1" class="sheet article ${cover?'cover':''}"><p class="eyebrow">${escapeHtml(cover?'Ander „Tau“ Holimion · Der Mondberührte':section.gruppe)}</p>${note}${stats}${safeMarkdown(section.text)}</article>`;
  const index=sections.indexOf(section);
  pager.innerHTML=(index>0?`<a href="#${encodeURIComponent(sections[index-1].id)}">← ${escapeHtml(sections[index-1].titel)}</a>`:'')+(index<sections.length-1?`<a href="#${encodeURIComponent(sections[index+1].id)}">${escapeHtml(sections[index+1].titel)} →</a>`:'');
  try{localStorage.setItem('ander-letztes-kapitel',section.id);}catch{}
  if(target)requestAnimationFrame(()=>document.getElementById(target)?.scrollIntoView());
  else window.scrollTo(0,0);
}

function showGallery(){
  setActive('bilder');pathLabel.textContent='Das Bildarchiv';document.title='Bildarchiv · Ander Holimion';pager.replaceChildren();
  content.innerHTML=`<section class="gallery-head"><p class="eyebrow">Karten · Wesen · Erinnerungen</p><h1>Das Bildarchiv</h1><p>${book.bilder.length} Illustrationen aus dem Tagebuch – zum Vergrößern auswählen.</p></section><div class="gallery-grid">${book.bilder.map((im,i)=>`<button class="gallery-card" data-image="${i}" type="button"><img src="${escapeHtml(im.datei)}" alt="${escapeHtml(im.titel)}" loading="lazy"><strong>${escapeHtml(im.titel)}</strong><small>Aus dem Buch · Seite ${im.pdf_seiten[0]}</small></button>`).join('')}</div>`;
  window.scrollTo(0,0);
}

function showHelp(){
  setActive('hilfe');pathLabel.textContent='Das Tagebuch weiterführen';document.title='Erweitern · Ander Holimion';pager.replaceChildren();
  if(book.oeffentlich){
    content.innerHTML=`<article class="sheet help"><p class="eyebrow">Das Tagebuch weiterführen</p><h1>Neue Abenteuer, dieselbe Reise</h1><p>Diese Leseausgabe und die Buch-PDF entstehen aus denselben fertigen Kapiteln. Nach einer Änderung im <a href="https://github.com/Ma7z3/AndersTagebuch" target="_blank" rel="noopener">Tagebuch-Repository</a> werden beide gemeinsam neu erstellt.</p><p>Mit <strong>PDF herunterladen</strong> erhältst du die Buchfassung des zuletzt erfolgreich veröffentlichten Standes. Die Datei enthält die eingebetteten Buchschriften und Bilder und lässt sich direkt verschicken.</p><h2>Gemeinsam weiterschreiben</h2><p>Neue Spielnotizen formulieren wir zuerst gemeinsam aus. Erst ein abgestimmter Tagebucheintrag wird als Markdown-Datei ergänzt und veröffentlicht. Rohnotizen und lokale Sicherungen gehören nicht zu dieser Ausgabe.</p><p>Wenn der Aufbau einer neuen Fassung scheitert, bleibt die vorherige Ausgabe erreichbar.</p></article>`;
    window.scrollTo(0,0);return;
  }
  content.innerHTML=`<article class="sheet help"><p class="eyebrow">Neue Abenteuer festhalten</p><h1>Gemeinsam weiterschreiben</h1><p>Die Word-Notizen bleiben unser Ausgangsmaterial. Wir gehen sie hier im Chat zusammen durch, klären offene Stellen und machen daraus einen Tagebucheintrag. Anschließend ordnen wir ihn dem passenden Kapitel zu.</p><p>Ich übernehme die abgestimmte Fassung in deinen Tagebuchordner und erneuere Leseausgabe und Buch-PDF. Du musst dafür keine Command-Datei selbst ausführen.</p><h2>Lesen und verschicken</h2><p><strong>PDF herunterladen</strong> oben lädt die zuletzt erzeugte vollständige Fassung zum Verschicken. Rohnotizen gehören nicht zu diesem Band. Nach einer Überarbeitung diese Browserseite einmal neu laden.</p><p><strong>Vorlage</strong> öffnet den ursprünglichen Band. <strong>Abschnitt drucken</strong> druckt nur den gerade geöffneten Lesetext.</p><details><summary>Die technischen Helfer – optional</summary><p><code>Aktualisieren.command</code> liest die lokalen Texte neu ein und übernimmt neue Word-Dateien aus <code>eingang</code> als Rohnotizen. Es formuliert nichts aus und vergibt keine Kapitelnummern.</p><p><code>Buch-PDF erstellen.command</code> setzt die fertigen Texte als vollständigen Band. Jede Fassung erhält Datum und Uhrzeit im Namen und liegt unter <code>export</code>. Ältere Exporte bleiben erhalten.</p><p>Kapitel liegen unter <code>inhalte</code>, Bilder unter <code>bilder</code>. Die <a href="README.md" target="_blank">Anleitung</a> beschreibt die Ablage. Tabellen werden vor jeder Aktualisierung geprüft.</p></details><h2>Korrekturen nachvollziehen</h2><p>Unter <code>pruefung</code> liegen die laufende Änderungsliste, der Stand der Sprachprüfung und die dokumentierten Freigaben zu neuen Spielabenden. Die ursprünglichen Quellen und die Sicherungen vor Überarbeitungen bleiben erhalten.</p></article>`;
  window.scrollTo(0,0);
}

function showSearch(query){
  const term=fold(query);const matches=sections.filter(s=>s.folded.includes(term));
  searchStatus.textContent=`${matches.length} Abschnitt${matches.length===1?'':'e'} gefunden`;
  drawNav(query);setActive('suche');pathLabel.textContent='Suche im ganzen Tagebuch';pager.replaceChildren();
  content.innerHTML=`<section class="sheet"><p class="eyebrow">Im Tagebuch suchen</p><h1>${escapeHtml(query)}</h1><p>${matches.length} passende Abschnitte</p>${matches.map(s=>{
    const pos=s.folded.indexOf(term);const snippet=s.searchText.slice(Math.max(0,pos-75),pos+Math.max(query.length,1)+150);
    return `<a class="result" href="#${encodeURIComponent(s.id)}"><strong>${escapeHtml(s.titel)}</strong><p>… ${escapeHtml(snippet)} …</p></a>`;
  }).join('')||'<p>Kein Treffer. Probiere einen anderen Namen oder eine kürzere Schreibweise.</p>'}</section>`;
  window.scrollTo(0,0);
}

function route(){
  let hash;
  try{hash=decodeURIComponent(location.hash.slice(1))||'titel';}catch{hash='titel';}
  if(search.value){search.value='';searchStatus.textContent='';drawNav();}
  document.body.classList.remove('menu-open');document.querySelector('#menue').setAttribute('aria-expanded','false');
  if(hash==='lesetext'){document.querySelector('#lesetext')?.focus();return;}
  if(hash==='bilder'){showGallery();return;}
  if(hash==='hilfe'){showHelp();return;}
  if(hash==='karten'){setActive('karten');pathLabel.textContent='Die Reise durch die Welten';document.title='Reiseatlas · Ander Holimion';pager.replaceChildren();window.TagebuchAtlas.show(content,book);window.scrollTo(0,0);return;}
  if(hash==='spielabende'){
    setActive('spielabende');pager.replaceChildren();pathLabel.textContent='Alle Spielabende';
    content.innerHTML=`<section class="sheet"><p class="eyebrow">Von Abend zu Abend</p><h1>Die Spielabende</h1><div class="session-list">${sessions.map(s=>`<a href="#${s.anchor}">${s.date}</a>`).join('')}</div></section>`;return;
  }
  const session=sessions.find(s=>s.anchor===hash);
  const id=byId.has(hash)?hash:session?session.section:anchors.get(hash);
  const section=byId.get(id)||byId.get('titel');showSection(section,id!==hash?hash:null);
}

function openImage(item){
  document.querySelector('#grossbild').src=item.datei;
  document.querySelector('#grossbild').alt=item.titel;
  document.querySelector('#bildtitel').textContent=item.titel+' · Buchseite '+item.pdf_seiten[0];
  const link=document.querySelector('#bildkapitel');link.hidden=!item.kapitel;
  link.href='#'+(item.kapitel||'titel');dialog.showModal();
}

content.addEventListener('click',event=>{
  const card=event.target.closest('[data-image]');
  if(card){openImage(book.bilder[Number(card.dataset.image)]);return;}
  if(event.target.matches('.article img')){
    const source=event.target.getAttribute('src');const item=book.bilder.find(x=>x.datei===source);
    if(item)openImage(item);
  }
});
document.querySelector('#bildschliessen').addEventListener('click',()=>dialog.close());
document.querySelector('#bildkapitel').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
search.addEventListener('input',()=>{const query=search.value.trim();if(query)showSearch(query);else{drawNav();searchStatus.textContent='';route();}});
document.querySelector('#menue').addEventListener('click',event=>{
  document.body.classList.toggle('menu-open');event.currentTarget.setAttribute('aria-expanded',String(document.body.classList.contains('menu-open')));
});
document.querySelector('#drucken').addEventListener('click',()=>window.print());
window.addEventListener('hashchange',route);
if(window.BUCH_PDF){const pdfLink=document.querySelector('#buchpdf');pdfLink.href=window.BUCH_PDF;pdfLink.download='Ander-Holimion-Tagebuch.pdf';pdfLink.hidden=false;}
drawNav();route();
