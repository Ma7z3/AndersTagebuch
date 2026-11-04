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
  for(const match of section.text.matchAll(/<a id="([a-zA-Z0-9-]+)"><\/a>/g))anchors.set(match[1],section.id);
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

function safeMarkdown(text,sectionId){
  if(sectionId)text=window.TagebuchStruktur.prepare(text,sectionId,book.erzaehlkaesten||[]);
  const parsed=new DOMParser().parseFromString(marked.parse(text,{gfm:true,breaks:false}),'text/html');
  const allowed=new Set(['A','P','H1','H2','H3','H4','H5','H6','STRONG','EM','DEL','UL','OL','LI','BLOCKQUOTE','TABLE','THEAD','TBODY','TR','TD','TH','HR','BR','IMG','PRE','CODE','SPAN','ASIDE']);
  for(const el of [...parsed.body.querySelectorAll('*')]){
    if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);continue;}
    for(const attr of [...el.attributes]){
      if(attr.name==='class'&&el.tagName==='ASIDE'&&attr.value==='narrative-box')continue;
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
  for(const img of parsed.body.querySelectorAll('img')){
    const metadata=book.bilder.find(im=>im.datei===img.getAttribute('src'));
    if(metadata?.gegenstand)img.classList.add('item-image');
  }
  if(book.kapitelauftakte?.[sectionId]){
    for(const heading of parsed.body.querySelectorAll('h1,h2,h3')){
      if(/^Kapitel\s+\d+/.test(heading.textContent)||heading.textContent===byId.get(sectionId)?.gruppe)heading.remove();
    }
  }
  let count=0;
  for(const heading of parsed.body.querySelectorAll('h1,h2,h3,h4,h5,h6')){
    if(heading.textContent.includes('Spielabend vom')){
      heading.className='session';heading.id='abend-'+sectionId+'-'+count++;
    }
  }
  return parsed.body.innerHTML;
}

function setActive(id){
  for(const link of nav.querySelectorAll('.nav-item')){
    const active=link.dataset.section===id;link.classList.toggle('active',active);
    if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
}

function chapterOpening(section){
  const opening=book.kapitelauftakte?.[section.id];
  if(!opening)return '';
  const number=Number(section.id.split('-').at(-1));
  const title=section.titel.replace(/^Kapitel \d+[: –]+/,'');
  const longWord=opening.zitat.split(/\s+/).some(word=>word.length>30);
  return `<header class="chapter-spread" aria-label="Auftakt zu Kapitel ${number}"><div class="chapter-quote ${longWord?'long-word':''}"><blockquote><p>„${escapeHtml(opening.zitat)}“</p></blockquote><span>${escapeHtml(opening.zitat_urheber)}</span></div><figure class="chapter-painting ${opening.titelposition==='unten'?'caption-bottom':''}"><img src="${escapeHtml(opening.bild)}" alt="${escapeHtml(opening.szene||title)}" decoding="async"><figcaption><small>Kapitel ${number}</small><h2>${escapeHtml(title)}</h2></figcaption></figure></header>`;
}

function showSection(section,target){
  setActive(section.id);pathLabel.textContent=section.gruppe;
  document.title=section.titel+' · Ander Holimion';
  const cover=section.art==='titel';
  const note=section.art==='entwurf'?'<div class="status-note">Rohnotizen vom Spielabend. Der Wortlaut wurde aus Word übernommen; dies ist noch kein ausgearbeiteter Tagebucheintrag.</div>':'';
  const stats=cover?`<div class="book-stats"><span>${sections.filter(s=>s.art==='kapitel'||s.art==='eintrag').length} KAPITEL</span><span>${book.bilder.length} ILLUSTRATIONEN</span><span>2022–2026</span></div><a class="read-next" href="#prolog">Die Reise beginnen →</a>`:'';
  content.innerHTML=`<article id="lesetext" tabindex="-1" class="sheet article ${cover?'cover':''} ${section.katalog==='gegenstaende'?'inventory':''} ${book.kapitelauftakte?.[section.id]?'with-opening':''}"><p class="eyebrow">${escapeHtml(cover?'Ander „Tau“ Holimion · Der Mondberührte':section.gruppe)}</p>${note}${stats}${chapterOpening(section)}${safeMarkdown(section.text,section.id)}</article>`;
  window.TagebuchChronik.enhance(content,book,section);
  enhanceIllustratedDirectory(section);
  const index=sections.indexOf(section);
  pager.innerHTML=(index>0?`<a href="#${encodeURIComponent(sections[index-1].id)}">← ${escapeHtml(sections[index-1].titel)}</a>`:'')+(index<sections.length-1?`<a href="#${encodeURIComponent(sections[index+1].id)}">${escapeHtml(sections[index+1].titel)} →</a>`:'');
  try{localStorage.setItem('ander-letztes-kapitel',section.id);}catch{}
  if(target)requestAnimationFrame(()=>document.getElementById(target)?.scrollIntoView());
  else window.scrollTo(0,0);
}

function showGallery(){
  setActive('bilder');pathLabel.textContent='Das Bildarchiv';document.title='Bildarchiv · Ander Holimion';pager.replaceChildren();
  content.innerHTML=`<section class="gallery-head"><p class="eyebrow">Karten · Wesen · Erinnerungen</p><h1>Das Bildarchiv</h1><p>${book.bilder.length} Illustrationen aus dem Tagebuch – zum Vergrößern auswählen.</p></section><div class="gallery-grid">${book.bilder.map((im,i)=>`<button class="gallery-card" data-image="${i}" type="button"><img src="${escapeHtml(im.datei)}" alt="${escapeHtml(im.titel)}" loading="lazy"><strong>${escapeHtml(im.titel)}</strong><small>${im.pdf_seiten?.length?`Aus dem Buch · Seite ${im.pdf_seiten[0]}`:im.kapitel_auftakt?'Kapitelgemälde':im.gegenstand?'Magische Gegenstände':'Kapitelillustration'}</small></button>`).join('')}</div>`;
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
  if(hash==='hilfe'){location.replace('#titel');return;}
  if(hash==='chronik'){setActive('chronik');pathLabel.textContent='Figuren und Gegenstände';pager.replaceChildren();window.TagebuchChronik.show(content,book);return;}
  if(hash==='karten'){setActive('karten');pathLabel.textContent='Die Reise durch die Welten';document.title='Reiseatlas · Ander Holimion';pager.replaceChildren();window.TagebuchAtlas.show(content,book,placeThumbnail);window.scrollTo(0,0);return;}
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
  const title=document.querySelector('#bildtitel');
  title.textContent=item.titel+(item.pdf_seiten?.length?' · Buchseite '+item.pdf_seiten[0]:'');
  let details=dialog.querySelector('.image-dialog-details');
  if(!details){
    details=document.createElement('div');
    details.className='image-dialog-details';
    title.after(details);
    dialog.setAttribute('aria-labelledby',title.id);
  }
  details.hidden=!item.details;
  details.innerHTML=item.details?safeMarkdown(item.details):'';
  dialog.classList.toggle('with-details',Boolean(item.details));
  const link=document.querySelector('#bildkapitel');link.hidden=!item.kapitel;
  link.href='#'+(item.kapitel||'titel');dialog.showModal();
}

function imageThumbnail(label,source,open){
  const button=document.createElement('button');
  button.type='button';
  button.className='illustrated-thumbnail';
  button.setAttribute('aria-label',label);
  const image=document.createElement('img');
  image.src=source;
  image.alt='';
  image.loading='lazy';
  image.decoding='async';
  button.append(image);
  button.addEventListener('click',open);
  return button;
}

function placeThumbnail(id){
  const place=book.ortsansichten?.[id];
  if(!place)return null;
  const source='bilder/ort-'+id;
  return imageThumbnail('Ortsansicht öffnen: '+place.name,source+'-vorschau.webp',()=>{
    openImage({datei:source+'.webp',titel:place.name,kapitel:place.kapitel});
  });
}

function openBestiaryCard(name,card){
  openImage({datei:card.bild,titel:card.titel||name,details:card.text,kapitel:card.kapitel});
}

function enhanceIllustratedDirectory(section){
  if(section.id==='addenda'){
    const places=new Map(Object.entries(book.ortsansichten||{})
      .filter(([,place])=>place.ortsverzeichnis)
      .map(([id,place])=>[place.name,id]));
    const heading=[...content.querySelectorAll('h3')].find(el=>el.textContent.trim()==='Wichtige Orte');
    if(!heading)return;
    heading.id='wichtige-orte';
    for(const cell of heading.nextElementSibling.querySelectorAll('tbody tr > td:first-child')){
      const thumbnail=placeThumbnail(places.get(cell.textContent.trim()));
      if(thumbnail)cell.prepend(thumbnail);
    }
    return;
  }
  const cards=Object.entries(book.bestiarium_karten||{});
  if(section.id==='bestiarium'){
    for(const cell of content.querySelectorAll('tbody tr > td:first-child')){
      const name=cell.textContent.trim();
      const card=book.bestiarium_karten?.[name];
      if(!card)continue;
      const button=imageThumbnail('Bestiarium öffnen: '+name,card.vorschau||card.bild,()=>openBestiaryCard(name,card));
      cell.prepend(button);
    }
    return;
  }
  const chapterCards=new Map(cards.filter(([,card])=>card.kapitel===section.id)
    .map(([name,card])=>[card.bild,[name,card]]));
  for(const image of content.querySelectorAll('blockquote img')){
    const entry=chapterCards.get(image.getAttribute('src'));
    if(!entry)continue;
    const button=document.createElement('button');
    button.type='button';
    button.className='chapter-bestiary-trigger';
    button.setAttribute('aria-label','Bestiarium öffnen: '+entry[0]);
    button.addEventListener('click',()=>openBestiaryCard(...entry));
    image.loading='eager';
    image.before(button);
    button.append(image);
  }
}

content.addEventListener('click',event=>{
  if(event.target.closest('.directory-portrait,.painting-hotspots,.illustrated-thumbnail,.chapter-bestiary-trigger'))return;
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
