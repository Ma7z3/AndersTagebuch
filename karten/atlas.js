'use strict';
window.TagebuchAtlas=(function(){
  const data=window.REISE,ns='http://www.w3.org/2000/svg';
  let host,book,steps,index=0,mode='faerun',box=[1740,250,1570,1100],drag=null;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const travel={land:'Landreise',flug:'Flug',portal:'Portal',sonderuebergang:'Magischer Übergang',teleportation:'Teleportation',aetherschritt:'Ätherschritt'};
  function svgNode(tag,attrs,text){const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs||{}))n.setAttribute(k,String(v));if(text)n.textContent=text;return n;}
  function point(s){const r=data.regionen[s.region];return r?[r.x,r.y]:null;}
  function show(container,diary){
    host=container;book=diary;steps=data.stationen;index=Math.min(index,steps.length-1);
    host.innerHTML=`<section class="atlas" id="lesetext" tabindex="-1"><header class="atlas-heading"><p class="eyebrow">Ein Tagebuch · viele Welten</p><h1>${esc(data.titel)}</h1><p>Folge Ander und seinen Gefährten durch Faerûn, Sigil und die Ebenen. Jede Station führt zurück zum passenden Kapitel.</p></header><div class="atlas-tabs" role="group" aria-label="Kartenansicht"><button data-mode="faerun" type="button">Faerûn</button><button data-mode="ebenen" type="button">Die Ebenen</button><button data-mode="sigil" type="button">Sigil</button><button data-mode="feuer" type="button">Feuerebene</button><button data-mode="ortskarten" type="button">Ortskarten</button><button data-mode="kosmos" type="button">Multiversum</button></div><div class="atlas-layout"><div><div class="atlas-viewport" id="atlas-canvas"></div><div class="atlas-map-tools" role="group" aria-label="Karte bedienen"><button data-map="in" type="button" aria-label="Karte vergrößern">+</button><button data-map="out" type="button" aria-label="Karte verkleinern">−</button><button data-map="route" type="button">Reisegebiet</button><button data-map="all" type="button">Ganze Karte</button><button data-map="focus" type="button">Zur Station</button></div><p class="atlas-map-note" id="atlas-map-note"></p></div><aside class="atlas-detail" id="atlas-detail" aria-live="polite"></aside></div><section class="atlas-journey"><div class="atlas-playback"><button data-step="prev" type="button">← Zurück</button><label for="atlas-progress">Station <span id="atlas-position"></span></label><button data-step="next" type="button">Weiter →</button></div><input id="atlas-progress" type="range" min="0" max="${steps.length-1}" value="${index}" aria-label="Station der Reise"><ol class="atlas-stops">${steps.map((s,i)=>`<li><button data-station="${i}" type="button"><span>${i+1}</span><strong>${esc(s.ort)}</strong><small>${esc(data.ebenen.find(p=>p.id===s.ebene).name)}</small></button></li>`).join('')}</ol></section><details class="atlas-sources"><summary>Wie diese Reise rekonstruiert wurde</summary><p>${esc(data.hinweis)}</p><p>Die erste Fassung zeigt ${steps.length} Hauptstationen der Kapitel 1–46. Einzelne Häuser und Räume sind noch nicht als eigene Kartenpunkte erfasst. Tethyamar folgt der Darstellung eurer Kampagne.</p>${data.quellen.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.titel)}</a> · ${esc(s.hinweis)}</p>`).join('')}</details></section>`;
    host.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{setMode(b.dataset.mode);}));
    host.querySelectorAll('[data-station]').forEach(b=>b.addEventListener('click',()=>select(Number(b.dataset.station))));
    host.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>select(index+(b.dataset.step==='next'?1:-1))));
    host.querySelector('#atlas-progress').addEventListener('input',e=>select(Number(e.target.value)));
    host.querySelectorAll('[data-map]').forEach(b=>b.addEventListener('click',()=>mapAction(b.dataset.map)));
    paint();
  }
  function setMode(value){mode=value;if(['sigil','feuer'].includes(mode)&&steps[index].ebene!==mode){select(steps.findIndex(s=>s.ebene===mode));}else paint();}
  function select(i){
    index=Math.max(0,Math.min(steps.length-1,i));
    if(mode==='faerun'&&steps[index].ebene!=='toril')mode='ebenen';
    if(['sigil','feuer'].includes(mode)&&steps[index].ebene!==mode)mode=steps[index].ebene==='toril'?'faerun':['sigil','feuer'].includes(steps[index].ebene)?steps[index].ebene:'ebenen';
    paint();
  }
  function paint(){
    const s=steps[index],plane=data.ebenen.find(p=>p.id===s.ebene),region=data.regionen[s.region];
    host.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    host.querySelectorAll('[data-station]').forEach(b=>{const active=Number(b.dataset.station)===index;b.classList.toggle('current',active);if(active)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    host.querySelector('#atlas-position').textContent=(index+1)+' von '+steps.length;
    const slider=host.querySelector('#atlas-progress');slider.value=index;slider.setAttribute('aria-valuetext',s.ort);
    host.querySelector('[data-step="prev"]').disabled=index===0;host.querySelector('[data-step="next"]').disabled=index===steps.length-1;
    host.querySelector('#atlas-detail').innerHTML=`<p class="eyebrow">Station ${index+1} · ${esc(plane.name)}</p><h2>${esc(s.ort.replace(/ · /g,': '))}</h2><p>${esc(s.beschreibung)}</p><p class="atlas-arrival"><strong>${esc(travel[s.ankunft])}</strong>${s.schluessel?'<br>'+esc(s.schluessel):''}</p>${region?`<p class="atlas-confidence">${esc(region.lage)}</p>`:''}<div class="atlas-chapters">${s.kapitel.map(id=>{const c=book.abschnitte.find(s=>s.id===id);return c?`<a href="#${id}">${esc(c.titel)}</a>`:'';}).join('')}</div>${s.ebene==='toril'&&mode!=='faerun'?'<button type="button" id="atlas-go-faerun">Auf Faerûn ansehen →</button>':''}`;
    host.querySelector('#atlas-go-faerun')?.addEventListener('click',()=>{mode='faerun';paint();mapAction('focus');});
    host.querySelector('.atlas-map-tools').hidden=mode!=='faerun';
    if(mode==='faerun')paintFaerun();else if(mode==='ebenen')paintPlanes();else if(mode==='sigil')paintSigil();else if(mode==='feuer')paintFire();else if(mode==='kosmos')paintCosmos();else paintLocalMaps();
  }
  function mapAction(action){
    if(mode!=='faerun')return;
    if(action==='in'||action==='out'){
      const f=action==='in'?.7:1.4,cx=box[0]+box[2]/2,cy=box[1]+box[3]/2,w=Math.max(250,Math.min(3600,box[2]*f));box=[cx-w/2,cy-w*.7/2,w,w*.7];
    }else if(action==='all')box=[0,0,3600,2329];
    else if(action==='route')box=[1740,250,1570,1100];
    else if(action==='focus'){
      const p=point(steps[index]);if(p)box=[p[0]-270,p[1]-190,540,380];
    }
    host.querySelector('#atlas-map')?.setAttribute('viewBox',box.join(' '));
  }
  function paintFaerun(){
    const canvas=host.querySelector('#atlas-canvas');canvas.replaceChildren();
    const svg=svgNode('svg',{id:'atlas-map',viewBox:box.join(' '),role:'img','aria-label':'Interaktive Faerûn-Karte mit den Reiseregionen. Plus und Minus zoomen; Ziehen verschiebt die Karte.',tabindex:0});
    svg.append(svgNode('image',{href:'karten/faerun.jpg',x:0,y:0,width:3600,height:2329}));
    const defs=svgNode('defs'),marker=svgNode('marker',{id:'route-arrow',viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});marker.append(svgNode('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#7b3028'}));defs.append(marker);svg.append(defs);
    for(let i=1;i<=index;i++){
      const a=steps[i-1],b=steps[i],pa=point(a),pb=point(b);if(a.ebene!=='toril'||b.ebene!=='toril'||!pa||!pb||a.region===b.region)continue;
      svg.append(svgNode('path',{d:`M${pa[0]},${pa[1]} L${pb[0]},${pb[1]}`,class:'atlas-route '+(b.ankunft==='teleportation'?'teleport':'land'),'marker-end':'url(#route-arrow)'}));
    }
    for(const[id,r]of Object.entries(data.regionen)){
      const matches=steps.map((s,i)=>({...s,number:i})).filter(s=>s.region===id),visited=matches.some(s=>s.number<=index),active=steps[index].region===id;
      const g=svgNode('g',{class:'atlas-pin'+(active?' selected':'')+(visited?' visited':''),role:'button',tabindex:0,'aria-label':r.name+' · '+r.lage});
      g.append(svgNode('title',{},r.name+' · '+r.lage),svgNode('circle',{cx:r.x,cy:r.y,r:active?19:13}),svgNode('text',{x:r.x+23,y:r.y-19},r.name));
      const choose=()=>{const next=matches.find(s=>s.number>=index)||matches[0];select(next.number);};g.addEventListener('click',choose);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});svg.append(g);
    }
    let origin=null;
    svg.addEventListener('pointerdown',e=>{if(e.target.closest('.atlas-pin'))return;origin=[e.clientX,e.clientY,...box];svg.setPointerCapture(e.pointerId);});
    svg.addEventListener('pointermove',e=>{if(!origin)return;const rect=svg.getBoundingClientRect();box=[origin[2]-(e.clientX-origin[0])*origin[4]/rect.width,origin[3]-(e.clientY-origin[1])*origin[5]/rect.height,origin[4],origin[5]];svg.setAttribute('viewBox',box.join(' '));});
    svg.addEventListener('pointerup',()=>{origin=null;});svg.addEventListener('pointercancel',()=>{origin=null;});
    svg.addEventListener('keydown',e=>{if(e.target!==svg)return;if(['+','=','-'].includes(e.key)){e.preventDefault();mapAction(e.key==='-'?'out':'in');}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();box[0]+=(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)*box[2]*.1;box[1]+=(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)*box[3]*.1;svg.setAttribute('viewBox',box.join(' '));}});
    canvas.append(svg);host.querySelector('#atlas-map-note').textContent='Karte © 2015 Wizards of the Coast · Markierungen teilweise nur regional. Weinrot: Reiseverbindung · Gold gestrichelt: Teleportation. Ziehen verschiebt die Karte.';
  }
  function paintPlanes(){
    const canvas=host.querySelector('#atlas-canvas');canvas.replaceChildren();
    const svg=svgNode('svg',{viewBox:'0 0 1250 700',role:'img','aria-label':'Benutzte Verbindungen zwischen Toril, Sigil, Feuerebene und Ätherebene',class:'planes-map'});
    const paths=[['toril','sigil','Flasche / Kylies Portal'],['sigil','feuer','Ohrclip · Roststaub · Spiegel'],['toril','aether','Essenz des Zwielichts']];
    for(const[from,to,label]of paths){const a=data.ebenen.find(p=>p.id===from),b=data.ebenen.find(p=>p.id===to);const used=steps.slice(1,index+1).some((s,i)=>[steps[i].ebene,s.ebene].sort().join()===[from,to].sort().join());svg.append(svgNode('path',{d:`M${a.x},${a.y} Q${(a.x+b.x)/2},${Math.min(a.y,b.y)-80} ${b.x},${b.y}`,class:'plane-path'+(used?' travelled':'')}));svg.append(svgNode('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-63,'text-anchor':'middle',class:'plane-path-label'},label));}
    for(const p of data.ebenen){const active=p.id===steps[index].ebene,g=svgNode('g',{class:'plane-node '+p.color+(active?' selected':''),role:'button',tabindex:0,'aria-label':p.name+' auswählen'});g.append(svgNode('circle',{cx:p.x,cy:p.y,r:95}),svgNode('text',{x:p.x,y:p.y-4,'text-anchor':'middle',class:'plane-title'},p.name.replace(/ · /g,': ')),svgNode('text',{x:p.x,y:p.y+28,'text-anchor':'middle',class:'plane-subtitle'},p.short));const choose=()=>{if(p.id==='sigil'||p.id==='feuer')mode=p.id;const i=steps.findIndex((s,i)=>s.ebene===p.id&&i>=index);select(i<0?steps.findIndex(s=>s.ebene===p.id):i);};g.addEventListener('click',choose);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});svg.append(g);}
    canvas.append(svg);
    const choices=document.createElement('div');choices.className='atlas-plane-choices';
    for(const p of data.ebenen){const button=document.createElement('button');button.type='button';button.textContent=p.name;button.setAttribute('aria-pressed',String(p.id===steps[index].ebene));button.addEventListener('click',()=>{if(p.id==='sigil'||p.id==='feuer')mode=p.id;const i=steps.findIndex((s,i)=>s.ebene===p.id&&i>=index);select(i<0?steps.findIndex(s=>s.ebene===p.id):i);});choices.append(button);}
    canvas.append(choices);host.querySelector('#atlas-map-note').textContent='Schematischer Ebenenplan der tatsächlich besuchten Schauplätze. Die Linien zeigen Übergänge der Gruppe, keine allgemeine Verbindung aller Ebenen und keine Entfernungen.';
  }
  function mapViewer(src,title,credit,original){
    const canvas=host.querySelector('#atlas-canvas');canvas.innerHTML=`<div class="atlas-map-panel"><div class="local-map-tools"><strong>${esc(title)}</strong><button type="button" data-zoom="in" aria-label="Karte vergrößern">+</button><button type="button" data-zoom="out" aria-label="Karte verkleinern">−</button><button type="button" data-zoom="reset">Zurücksetzen</button><a href="${esc(original||src)}" target="_blank" rel="noopener">Groß öffnen ↗</a></div><div class="local-map-scroll" tabindex="0" aria-label="${esc(title)} – vergrößerte Karte verschieben"><img src="${esc(src)}" alt="${esc(title)}"></div><p class="local-map-credit">${esc(credit)}</p><div class="local-map-links"></div></div>`;
    let zoom=100;const img=canvas.querySelector('img');canvas.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>{zoom=b.dataset.zoom==='reset'?100:Math.max(100,Math.min(600,zoom*(b.dataset.zoom==='in'?1.5:1/1.5)));img.style.width=zoom+'%';}));
    return canvas.querySelector('.local-map-links');
  }
  function placeLinks(root,places){root.innerHTML=places.map(p=>`<a href="#kapitel-${String(p[1]).padStart(2,'0')}"><strong>${esc(p[0])}</strong><small>Kapitel ${p[1]}</small></a>`).join('');}
  function paintSigil(){
    const links=mapViewer('karten/sigil-stadtplan.jpg','Sigil · Stadtplan','Vom Autor bereitgestellter Stadtplan. Englische Viertelnamen; „The Hive“ entspricht dem Stock. Urheber in der bereitgestellten Datei nicht eindeutig ausgewiesen.','karten/sigil-stadtplan.pdf');
    placeLinks(links,[['Der Stock · Gasthaus zur schwelenden Leiche',21],['Halle der Sprecher · Zeichnaten',22],['Zum freundlichen Scheusal',22],['Leichenhalle · Staubmenschen',23],['Schrottplatz · Oma Feen-Bann',26],['Große Gießerei · Sams Werkstatt',29]]);
    host.querySelector('#atlas-map-note').textContent='Orte aus der Erzählung sind unten einzeln verlinkt. Nicht belegte Hauspositionen werden nicht als exakte Punkte auf dem Stadtplan eingezeichnet.';
  }
  function paintFire(){
    const city=steps[index].ortskarte==='messingstadt';
    const links=mapViewer(city?'bilder/pdf-s075-331.png':'karten/feuerzitadelle-pollack.jpg',city?'Messingstadt':'Die Feuerzitadelle',city?'Karte aus dem Tagebuch, erhalten von Kemp „Sam“.':'Alan Pollack · Citadel on the Fire Plane · TSR, 1994. Illustration des Schauplatzes, kein vermessener Grundriss.');
    const choices=document.createElement('div');choices.className='atlas-fire-choices';
    for(const [label,key] of [['Feuerzitadelle','feuerzitadelle'],['Messingstadt','messingstadt']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String((city?'messingstadt':'feuerzitadelle')===key));b.addEventListener('click',()=>{const i=steps.findIndex(s=>s.ortskarte===key);select(i);});choices.append(b);}
    links.before(choices);
    placeLinks(links,city?[['Aschenpalast · Großsultan',30],['Lava-Kanäle · Überfahrt mit Almaraki',30],['Handwerker · magisches Diebeswerkzeug',30]]:[['Erster Versuch',24],['Zweiter Zugang · Gefangene und Befreiung',27]]);
    host.querySelector('#atlas-map-note').textContent='Die Feuerebene ist eine Innere Ebene. Messingstadt und Feuerzitadelle sind getrennte Schauplätze auf derselben Ebene; ihre Entfernung ist im Tagebuch nicht vermessen.';
  }
  function paintCosmos(){
    const links=mapViewer('karten/multiversum.jpg','Das Multiversum · Innere und Äußere Ebenen','Planescape-Übersicht · © 1994 TSR, Inc. · vom Autor bereitgestellt. Die Feuerebene ist links bei den Inneren Ebenen eingezeichnet.');
    const button=document.createElement('button');button.type='button';button.textContent='Außenlande und Sigil ansehen';button.addEventListener('click',()=>{mapViewer('karten/aussenlande.jpg','Die Außenlande · Sigil über der Säule','Planescape · © 1994 TSR, Inc. · vom Autor bereitgestellt.');});links.append(button);
    host.querySelector('#atlas-map-note').textContent='Die Übersichtskarten erklären die Kosmologie. Sie zeigen keine maßstäbliche Reiseroute eurer Gruppe. Sigil ist der eigene Stadtschauplatz über der Säule der Außenlande.';
  }
  function paintLocalMaps(){
    const root=host.querySelector('#atlas-canvas');root.innerHTML=`<div class="atlas-local-maps"><figure><a href="bilder/pdf-s007-32.png" target="_blank" rel="noopener"><img src="bilder/pdf-s007-32.png" alt="Karte von Dolchfall"></a><figcaption>Dolchfall · <a href="#kapitel-04">Im Tagebuch lesen</a></figcaption></figure><figure><a href="bilder/pdf-s075-331.png" target="_blank" rel="noopener"><img src="bilder/pdf-s075-331.png" alt="Karte von Messingstadt"></a><figcaption>Messingstadt · <a href="#kapitel-30">Im Tagebuch lesen</a></figcaption></figure><figure><button type="button" id="atlas-open-sigil"><img src="karten/sigil-stadtplan.jpg" alt="Sigil-Stadtplan">Sigil erkunden →</button></figure><figure><button type="button" id="atlas-open-fire"><img src="karten/feuerzitadelle-pollack.jpg" alt="Illustration der Feuerzitadelle">Feuerzitadelle ansehen →</button></figure></div>`;
    root.querySelector('#atlas-open-sigil').addEventListener('click',()=>{setMode('sigil');});root.querySelector('#atlas-open-fire').addEventListener('click',()=>{mode='feuer';select(15);});
    host.querySelector('#atlas-map-note').textContent='Ortskarten und Schauplatzillustrationen aus dem Tagebuch und den ergänzten Referenzen.';
  }
  return{show};
})();
