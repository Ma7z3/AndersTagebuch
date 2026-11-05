'use strict';
/* Shared by the browser and PDF tokenizer. Boundaries come from the old book. */
(function(root){
  const compact=s=>s.replace(/\s+/g,' ').trim();
  function prepare(text,id,boxes){
    const blocks=text.split(/\n\s*\n/);
    for(const box of boxes.filter(b=>b.kapitel===id)){
      const start=blocks.findIndex(b=>b.trim().startsWith(box.anfang));
      const end=blocks.findIndex((b,i)=>i>=start&&compact(b.replace(/^>\s?/gm,'')).includes(compact(box.ende)));
      if(start<0||end<start)throw new Error('Erzählkasten nicht eindeutig gefunden: '+id);
      const style=box.typ||'narrative';
      if(!['narrative','quotation','riddle'].includes(style))throw new Error('Unbekannter Kastentyp: '+style);
      blocks[start]='<aside class="'+style+'-box">\n\n'+blocks[start];
      blocks[end]+='\n\n</aside>';
    }
    return blocks.join('\n\n');
  }
  root.TagebuchStruktur={prepare};
})(typeof window==='undefined'?globalThis:window);
