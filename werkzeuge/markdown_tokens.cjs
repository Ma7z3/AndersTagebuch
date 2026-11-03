const fs = require('node:fs');
const { marked } = require('../gestaltung/marked.umd.js');
require('../gestaltung/struktur.js');
const data = JSON.parse(fs.readFileSync(0, 'utf8'));
for (const section of data.abschnitte) {
  const original=marked.lexer(TagebuchStruktur.prepare(section.text,section.id,data.erzaehlkaesten||[]),{gfm:true}),tokens=[];
  let narrative=null;
  for(let i=0;i<original.length;i++){
    const t=original[i],im=t.type==='paragraph'&&t.tokens?.length===1&&t.tokens[0].type==='image'?t.tokens[0]:null;
    if(t.type==='html'&&t.raw.trim()==='<aside class="narrative-box">'){narrative=[];continue;}
    if(t.type==='html'&&t.raw.trim()==='</aside>'){tokens.push({type:'narrative',tokens:narrative});narrative=null;continue;}
    if(narrative){narrative.push(t);continue;}
    const cap=im&&(data.bildlegenden||[]).find(c=>c.bild===im.href);
    let next=i+1;while(original[next]?.type==='space')next++;
    const heading=original[next];
    if(cap&&heading?.type==='heading'&&heading.text===cap.titel){
      let last=next,credit=null,j=next+1;while(original[j]?.type==='space')j++;
      if(cap.nachweis&&original[j]?.type==='paragraph'&&original[j].text.replace(/\s+/g,' ').trim()===cap.nachweis){credit=original[j];last=j;}
      tokens.push({type:'figure',image:im,heading,credit});i=last;
    }else tokens.push(t);
  }
  section.tokens=tokens;
}
process.stdout.write(JSON.stringify(data));
