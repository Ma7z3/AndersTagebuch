#!/usr/bin/env python3
"""Create the complete, local diary PDF from the same finished Markdown as the reader."""
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from io import BytesIO
import html, json, re, shutil, subprocess, sys, hashlib
from html.parser import HTMLParser
from PIL import Image as PillowImage
from reportlab import rl_config
rl_config.useA85 = False
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image, PageBreak, NextPageTemplate, FrameBreak, Flowable, LongTable, Table, TableStyle, KeepTogether, BalancedColumns, CondPageBreak
from reportlab.platypus.tableofcontents import TableOfContents

from aktualisieren import versioniere_startseite

ROOT=Path(__file__).resolve().parents[1]
W,H=612,792
MARGIN=45
GAP=20
WIDTH=W-2*MARGIN
COL=(WIDTH-GAP)/2
BURGUNDY=colors.HexColor('#651d12')
GOLD=colors.HexColor('#b39a57')
GREEN=colors.HexColor('#e3e7c4')
INK=colors.HexColor('#241d16')

def register_fonts():
    fonts=ROOT/'gestaltung/schriften'
    for name,file in [('Book','Bookinsanity.ttf'),('Book-Bold','Bookinsanity Bold.ttf'),('Book-Italic','Bookinsanity Italic.ttf'),('Book-BoldItalic','Bookinsanity Bold Italic.ttf'),('Display','Mr Eaves Small Caps.ttf'),('Scaly','Scaly Sans.ttf'),('Caps','Scaly Sans Caps.ttf'),('Artist','WalterTurncoat-Regular.ttf'),('Ornate','CinzelDecorative-Regular.ttf'),('Ornate-Bold','CinzelDecorative-Bold.ttf')]:
        pdfmetrics.registerFont(TTFont(name,str(fonts/file)))
    pdfmetrics.registerFontFamily('Ornate',normal='Ornate',bold='Ornate-Bold',italic='Ornate',boldItalic='Ornate-Bold')
    pdfmetrics.registerFontFamily('Book',normal='Book',bold='Book-Bold',italic='Book-Italic',boldItalic='Book-BoldItalic')
    for family in ['Display','Scaly','Caps','Artist']:
        pdfmetrics.registerFontFamily(family,normal=family,bold=family,italic=family,boldItalic=family)
    for idx,name in enumerate(['Fallback','Fallback-Bold','Fallback-Italic','Fallback-BoldItalic']):
        pdfmetrics.registerFont(TTFont(name,'/System/Library/Fonts/Times.ttc',subfontIndex=idx))
    pdfmetrics.registerFontFamily('Fallback',normal='Fallback',bold='Fallback-Bold',italic='Fallback-Italic',boldItalic='Fallback-BoldItalic')

# The legacy Bookinsanity font lacks umlauts. The old PDF falls back to Times
# for these characters; keep the same behavior instead of printing .notdef boxes.
RawParagraph=Paragraph
class FallbackMarkup(HTMLParser):
    def __init__(self,font):
        super().__init__(convert_charrefs=True);self.out=[];self.stack=[(font,False,False)]
    def handle_starttag(self,tag,attrs):
        current,bold,italic=self.stack[-1]
        if tag in ['b','strong']:bold=True
        if tag in ['i','em']:italic=True
        if tag=='font':current=dict(attrs).get('name',current)
        if tag not in ['br','img']:self.stack.append((current,bold,italic))
        self.out.append('<'+tag+''.join(' '+k+'="'+html.escape(v or '',quote=True)+'"' for k,v in attrs)+(' />' if tag=='br' else '>'))
    def handle_startendtag(self,tag,attrs):
        self.out.append('<'+tag+''.join(' '+k+'="'+html.escape(v or '',quote=True)+'"' for k,v in attrs)+' />')
    def handle_endtag(self,tag):
        if len(self.stack)>1:self.stack.pop()
        self.out.append('</'+tag+'>')
    def handle_data(self,text):
        family,bold,italic=self.stack[-1]
        if family.startswith('Book'):
            name='Book'+('-BoldItalic' if bold and italic else '-Bold' if bold else '-Italic' if italic else '')
        else:name=family
        glyphs=pdfmetrics.getFont(name).face.charToGlyph
        fallback='Fallback'+('-BoldItalic' if bold and italic else '-Bold' if bold else '-Italic' if italic else '')
        for chunk in re.findall(r'.',text,re.S):
            value=html.escape(chunk,quote=False)
            self.out.append(value if ord(chunk) in glyphs else '<font name="'+fallback+'">'+value+'</font>')

def Paragraph(text,style,**kwargs):
    parser=FallbackMarkup(style.fontName);parser.feed(text)
    return RawParagraph(''.join(parser.out),style,**kwargs)

def normal(s):
    return str(s).replace('\u2011','-').replace('\u2013','-').replace('\u2014','-').replace('\u00a0',' ')

def esc(s):return html.escape(normal(s),quote=False)

ST={}
def make_styles():
    ST['body']=ParagraphStyle('body',fontName='Book',fontSize=10,leading=12.1,textColor=INK,alignment=TA_JUSTIFY,spaceAfter=4.5,allowWidows=0,allowOrphans=0)
    ST['quote']=ParagraphStyle('quote',parent=ST['body'],fontName='Scaly',fontSize=10,leading=11.5,spaceBefore=2,spaceAfter=5,alignment=TA_LEFT)
    for level,size in [(1,20),(2,16),(3,14),(4,11.8),(5,10),(6,9.5)]:
        ST['h'+str(level)]=ParagraphStyle('h'+str(level),fontName='Display' if level<=3 else 'Caps',fontSize=size,leading=size*1.2,textColor=BURGUNDY,spaceBefore=12 if level>1 else 0,spaceAfter=7,keepWithNext=True)
    ST['session']=ParagraphStyle('session',fontName='Book-Bold',fontSize=9.3,leading=11.3,spaceBefore=8,spaceAfter=6,keepWithNext=True)
    ST['cell']=ParagraphStyle('cell',fontName='Scaly',fontSize=8.1,leading=10.1,textColor=INK,spaceAfter=0,splitLongWords=True)
    ST['th']=ParagraphStyle('th',parent=ST['cell'],fontName='Caps',textColor=BURGUNDY)
    ST['toc']=ParagraphStyle('toc',fontName='Book',fontSize=8.7,leading=10.3,textColor=INK,spaceBefore=1.4,leftIndent=0,firstLineIndent=0,rightIndent=16)
    ST['index']=ParagraphStyle('index',fontName='Book',fontSize=8.8,leading=13,alignment=TA_CENTER)
    ST['indexhead']=ParagraphStyle('indexhead',parent=ST['index'],fontName='Book-Bold')
    ST['coverh1']=ParagraphStyle('coverh1',fontName='Ornate',fontSize=22,leading=28,alignment=TA_CENTER,textColor=BURGUNDY,spaceAfter=8)
    ST['covername']=ParagraphStyle('covername',parent=ST['coverh1'],fontName='Ornate-Bold',fontSize=36,leading=45,spaceAfter=18)
    ST['frontnote']=ParagraphStyle('frontnote',fontName='Book',fontSize=10,leading=15,alignment=TA_CENTER,textColor=INK,spaceAfter=14)
    ST['legal']=ParagraphStyle('legal',parent=ST['frontnote'],fontSize=7.8,leading=10.7,spaceAfter=12)
    ST['coverh2']=ParagraphStyle('coverh2',fontName='Display',fontSize=17,leading=21,alignment=TA_CENTER,textColor=BURGUNDY,spaceBefore=14,spaceAfter=14)
    ST['coverh5']=ParagraphStyle('coverh5',fontName='Caps',fontSize=9.3,leading=11.2,alignment=TA_CENTER,spaceBefore=4,spaceAfter=4)
    ST['artist']=ParagraphStyle('artist',fontName='Artist',fontSize=8.7,leading=11,alignment=TA_CENTER,textColor=colors.HexColor('#766649'),spaceBefore=3,spaceAfter=2)
    ST['credit']=ParagraphStyle('credit',parent=ST['artist'],fontSize=7.4,leading=9.5,spaceBefore=0,spaceAfter=8)
    ST['coverbody']=ParagraphStyle('coverbody',fontName='Book',fontSize=6.7,leading=8.05,alignment=TA_CENTER,spaceBefore=5,spaceAfter=3)

IMAGE_CACHE={}
FIGURE_CONFIG={}
def pdf_image(path):
    path=Path(path)
    if path in IMAGE_CACHE:return IMAGE_CACHE[path]
    with PillowImage.open(path) as im:
        opaque=im.mode!='RGBA' or im.getchannel('A').getextrema()==(255,255)
        if opaque:
            digest=hashlib.sha256(path.read_bytes()).hexdigest()[:20]
            directory=ROOT/'export/.bildcache';directory.mkdir(parents=True,exist_ok=True)
            output=directory/(digest+'-q90.jpg')
            if not output.exists():im.convert('RGB').save(output,'JPEG',quality=90,optimize=True)
        else:output=path
    IMAGE_CACHE[path]=output
    return output

def book_page(physical):
    return max(0, physical-2)

class Mark(Flowable):
    _ZEROSIZE=True
    def __init__(self,key,label=None,toc=False):
        Flowable.__init__(self);self.key=key;self.label=label;self.toc=toc;self.width=0;self.height=0;self.keepWithNext=True
    def draw(self):
        self.canv.bookmarkHorizontal(self.key,0,0)
        self.canv._doctemplate.anchor_pages[self.key]=self.canv._doctemplate.page

class BookDoc(BaseDocTemplate):
    def __init__(self,target):
        super().__init__(target,pagesize=(W,H),leftMargin=MARGIN,rightMargin=MARGIN,topMargin=47,bottomMargin=45,title='Das Tagebuch des Ander Holimion',author='Matthias Petersen',allowSplitting=True,pageCompression=1)
        self.anchor_pages={};self.section_pages={};self.paint_count=0
        left=Frame(MARGIN,45,COL,H-92,id='left',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
        right=Frame(MARGIN+COL+GAP,45,COL,H-92,id='right',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
        full=Frame(MARGIN,45,WIDTH,H-92,id='full',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
        cover=Frame(MARGIN,32,WIDTH,H-92,id='cover',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
        self.addPageTemplates([PageTemplate(id='Cover',frames=[cover],onPage=self.paint),PageTemplate(id='Two',frames=[left,right],onPage=self.paint),PageTemplate(id='Wide',frames=[full],onPage=self.paint)])
    def beforeDocument(self):
        self.anchor_pages={};self.section_pages={};self.illustration_blocks=[];self.footer_positions=[]
        self.canv.addPageLabel(0,prefix='Titel')
        self.canv.addPageLabel(1,prefix='Hinweise')
        self.canv.addPageLabel(2,style='D',start=1)
    def paint(self,c,doc):
        c.saveState()
        c.drawImage(str(pdf_image(ROOT/'bilder/pdf-s001-14348.png')),0,H-817.5,width=1920,height=817.5,mask='auto')
        if doc.page==1:
            c.setStrokeColor(GOLD);c.setLineWidth(.85)
            c.rect(29,29,W-58,H-58,stroke=1,fill=0)
            c.setLineWidth(.25);c.rect(35,35,W-70,H-70,stroke=1,fill=0)
        if doc.page>2:
            number=book_page(doc.page);left=number%2==0
            c.saveState()
            if left:c.translate(W,0);c.scale(-1,1)
            c.drawImage(str(pdf_image(ROOT/'bilder/pdf-s002-770.png')),0,0,width=W,height=46,mask='auto')
            c.restoreState()
            c.setFillColor(colors.HexColor('#8a7039'));c.setFont('Scaly',8)
            if left:c.drawRightString(W-61,11,'Das Tagebuch des Ander Holimion')
            else:c.drawString(61,11,'Das Tagebuch des Ander Holimion')
            c.setFont('Scaly',9)
            x=24 if left else W-24
            c.drawCentredString(x,20,str(number))
            self.footer_positions.append({'pdf_seite':doc.page,'buchseite':number,'seite':'links' if left else 'rechts','zahl_x':x,'zahl_basis_y':20,'buchtitel_basis_y':11,'verzierung_gespiegelt':left})
        c.restoreState()
    def afterFlowable(self,flow):
        if isinstance(flow,Mark):
            self.anchor_pages[flow.key]=self.page
            if flow.label:
                self.section_pages[flow.key]={'titel':flow.label,'seite':book_page(self.page),'pdf_seite':self.page}
                if flow.toc:
                    toc_label=FallbackMarkup('Book');toc_label.feed(esc(flow.label))
                    self.notify('TOCEntry',(0,''.join(toc_label.out),book_page(self.page),flow.key))
                    self.canv.addOutlineEntry(normal(flow.label),flow.key,level=0,closed=False)

def inline(tokens,refmap):
    out=[]
    for t in tokens or []:
        typ=t['type']
        if typ in ['text','escape']:out.append(inline(t['tokens'],refmap) if t.get('tokens') else esc(t.get('text','')))
        elif typ=='strong':out.append('<b>'+inline(t.get('tokens'),refmap)+'</b>')
        elif typ=='em':out.append('<i>'+inline(t.get('tokens'),refmap)+'</i>')
        elif typ=='del':out.append('<strike>'+inline(t.get('tokens'),refmap)+'</strike>')
        elif typ=='codespan':out.append(esc(t['text']))
        elif typ=='br':out.append('<br/>')
        elif typ=='link':
            href=t['href'];label=inline(t.get('tokens'),refmap)
            plain=t.get('text','')
            if href.startswith('#p') and href[1:] in refmap and re.fullmatch(r'(?:Seite\s*)?\d+',plain):
                label=('Titelseite' if refmap[href[1:]]==0 else ('Seite ' if plain.startswith('Seite') else '')+str(refmap[href[1:]]))
            if href.startswith(('#','https://','http://')):out.append('<link href="'+html.escape(href,quote=True)+'" color="#651d12">'+label+'</link>')
            else:out.append(label)
        elif typ=='html':
            raw=t.get('text',t.get('raw',''))
            if raw.strip().lower() in ['<br>','<br/>','<br />']:out.append('<br/>')
            elif re.sub('<[^>]*>','',raw).strip():out.append(esc(re.sub('<[^>]*>','',raw)))
        elif typ=='image':pass
        else:raise ValueError('Unbekanntes Textformat: '+typ)
    return ''.join(out)

def table_flow(token,refmap):
    n=len(token['header'])
    variants={7:[98,99,44,74,62,62,43],6:[87,57,58,137,66,117],5:[91,109,51,62,209],4:[104,114,260,44]}
    weights=variants.get(n,[1]*n);widths=[WIDTH*x/sum(weights) for x in weights]
    rows=[[Paragraph(inline(c['tokens'],refmap).replace('Erstes Treffen','Erstes<br/>Treffen').replace('Letzter Auftritt','Letzter<br/>Auftritt').replace('Vermuteter Aufenthaltsort','Vermuteter<br/>Aufenthaltsort').replace('Wissenschaftliche Bezeichnung','Wissenschaftliche<br/>Bezeichnung'),ST['th']) for c in token['header']]]
    for row in token['rows']:
        if len(row)!=n:raise ValueError('Abweichende Spaltenzahl')
        rows.append([Paragraph(inline(c['tokens'],refmap) or ' ',ST['cell']) for c in row])
    flow=LongTable(rows,colWidths=widths,repeatRows=1,hAlign='LEFT',splitByRow=1)
    flow.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),GREEN),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.Color(1,1,1,alpha=0),colors.HexColor('#edf0d8')]),('LINEBELOW',(0,0),(-1,0),.7,GOLD),('LINEBELOW',(0,1),(-1,-1),.25,colors.HexColor('#c8cba6')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    return flow

class BookImage(Image):
    def draw(self):
        self.canv.saveState()
        if getattr(self,'blend_white',False):self.canv.setBlendMode('Multiply')
        viewport=getattr(self,'viewport',None)
        if viewport:
            left,top,right,bottom=viewport;scale=self.drawWidth/(right-left)
            clip=self.canv.beginPath();clip.rect(0,0,self.drawWidth,self.drawHeight)
            self.canv.clipPath(clip,stroke=0,fill=0)
            self.canv.drawImage(self.filename,-left*scale,-(self.imageHeight-bottom)*scale,width=self.imageWidth*scale,height=self.imageHeight*scale,mask='auto')
        else:super().draw()
        self.canv.restoreState()

def image_flow(token,width,cover=False,blend=False,layout=None,maxheight=None,viewport=None):
    path=(ROOT/token['href']).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():raise FileNotFoundError(token['href'])
    config=FIGURE_CONFIG.get(token['href'],{})
    if config.get('gegenstand'):
        maxheight=config.get('pdf_maxhoehe',150) if maxheight is None else maxheight
        blend=True
        viewport=viewport or config.get('pdf_bildausschnitt')
    im=BookImage(str(pdf_image(path)),mask='auto',lazy=0);im.blend_white=blend;im.source_image=token['href']
    maxw=420 if cover else min(width,210)
    maxh=400 if cover else (345 if im.imageHeight>im.imageWidth else 245)
    if layout in ['breit','seite']:
        maxw=width;maxh=650 if layout=='seite' else 550
    if maxheight is not None:maxh=maxheight
    # This illustrated note fits below the bridge encounter in the left column.
    if token['href']=='bilder/pdf-s005-26.png' and not cover:maxh=min(maxh,185)
    # Ignore transparent padding in the page layout; leave source pixels intact.
    box=viewport or (0,0,im.imageWidth,im.imageHeight)
    if not (0<=box[0]<box[2]<=im.imageWidth and 0<=box[1]<box[3]<=im.imageHeight):raise ValueError('Ungültiger Bildausschnitt: '+token['href'])
    iw,ih=box[2]-box[0],box[3]-box[1]
    scale=min(maxw/iw,maxh/ih);im.viewport=viewport
    im.drawWidth=iw*scale;im.drawHeight=ih*scale;im.hAlign='CENTER'
    return im

def shade_note(flows,width):
    # One cell carries one continuous background behind heading, image and text.
    table=Table([[flows]],colWidths=[width],hAlign='LEFT',splitByRow=0,splitInRow=1,spaceBefore=8,spaceAfter=10)
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),GREEN),('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    return table

class IllustrationGroup(Flowable):
    """An image and its explanation occupy one indivisible column block."""
    def __init__(self,flows,width,kind,section):
        Flowable.__init__(self);self.flows=flows;self.width=width;self.kind=kind;self.section=section;self.hAlign='LEFT';self.spaceBefore=5;self.spaceAfter=8
    def _table(self):
        t=Table([[self.flows]],colWidths=[self.width],splitByRow=0,splitInRow=0,hAlign='LEFT')
        t.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0),('VALIGN',(0,0),(-1,-1),'TOP'),('ALIGN',(0,0),(-1,-1),'CENTER')]))
        return t
    def _images(self,flows):
        for flow in flows:
            if isinstance(flow,BookImage):yield flow
            elif isinstance(flow,IllustrationGroup):yield from self._images(flow.flows)
            elif isinstance(flow,Table):
                for row in flow._cellvalues:
                    for cell in row:
                        if isinstance(cell,(list,tuple)):yield from self._images(cell)
    def wrap(self,availWidth,availHeight):
        self.inner=self._table();w,h=self.inner.wrapOn(self.canv,self.width,10000)
        limit=H-92
        if h>limit:
            ims=list(self._images(self.flows));total=sum(im.drawHeight for im in ims)
            allowed=limit-(h-total)-3
            if not ims or allowed<50:raise ValueError('Bildgruppe passt nicht in eine Buchspalte: '+self.section+' / '+self.kind)
            factor=min(1,allowed/total)
            for im in ims:im.drawWidth*=factor;im.drawHeight*=factor
            self.inner=self._table();w,h=self.inner.wrapOn(self.canv,self.width,10000)
            if h>limit+.1:raise ValueError('Bildgruppe bleibt zu hoch: '+self.section)
        self.width=w;self.height=h;return w,h
    def split(self,availWidth,availHeight):return []
    def draw(self):
        self.inner.drawOn(self.canv,0,0)
        doc=self.canv._doctemplate
        doc.illustration_blocks.append({'abschnitt':self.section,'art':self.kind,'bilder':[im.source_image for im in self._images(self.flows)],'pdf_seite':doc.page,'buchseite':book_page(doc.page),'spalte':doc.frame.id,'hoehe':round(self.height,2),'breite':round(self.width,2),'satz':getattr(self,'pdf_layout','spalte')})

def group_illustrations(tokens):
    """Recognize existing adjacent source blocks; do not rewrite the prose."""
    ts=[t for t in tokens if t['type']!='space'];result=[];i=0
    def solo(t):return t.get('tokens',[{}])[0] if t.get('type')=='paragraph' and len(t.get('tokens',[]))==1 and t['tokens'][0]['type']=='image' else None
    while i<len(ts):
        t=ts[i];im=solo(t);nxt=ts[i+1] if i+1<len(ts) else {}
        if im and nxt.get('type')=='blockquote':
            result.append({'type':'illustrated_note','image':im,'note':nxt});i+=2;continue
        if im and nxt.get('type')=='paragraph' and len(nxt.get('tokens',[]))==1 and nxt['tokens'][0]['type']=='em' and 'Farbzeichnung von Ander Holimion' in nxt.get('text',''):
            result.append({'type':'figure','image':im,'heading':nxt,'credit':None});i+=2;continue
        immediate=t['type']=='heading' and t.get('depth')==4 and i+1<len(ts) and solo(ts[i+1])
        after_type=t['type']=='heading' and t.get('depth')==4 and i+2<len(ts) and ts[i+1]['type']=='paragraph' and solo(ts[i+2])
        if immediate or after_type:
            j=i+(2 if immediate else 3)
            while j<len(ts) and ts[j]['type']!='html' and not (ts[j]['type']=='heading' and ts[j].get('depth',6)<=5):j+=1
            result.append({'type':'illustrated_item','tokens':ts[i:j]});i=j;continue
        result.append(t);i+=1
    return result

def all_marks(flows):
    for flow in flows:
        if isinstance(flow,Mark):yield flow.key
        elif isinstance(flow,IllustrationGroup):yield from all_marks(flow.flows)
        elif isinstance(flow,(KeepTogether,BalancedColumns)):yield from all_marks(flow._content)
        elif isinstance(flow,Table):
            for row in flow._cellvalues:
                for cell in row:
                    if isinstance(cell,(list,tuple)):yield from all_marks(cell)

class CoverPainting(Flowable):
    """Draw the approved portrait cover at page height, with selectable title text."""
    def __init__(self,source,prefix,author):
        Flowable.__init__(self);self.source=source;self.prefix=prefix;self.author=author;self.width=WIDTH;self.height=1
    def draw(self):
        c=self.canv;c.saveState();c.resetTransforms()
        c.setFillColor(colors.HexColor('#142128'));c.rect(0,0,W,H,fill=1,stroke=0)
        with PillowImage.open(ROOT/self.source) as im:iw=H*im.width/im.height
        x=(W-iw)/2
        c.drawImage(str(pdf_image(ROOT/self.source)),x,0,width=iw,height=H,mask='auto')
        shade=PillowImage.new('RGBA',(4,1024))
        shade.putdata([(16,26,32,round(222*y/1023)) for y in range(1024) for _ in range(4)])
        c.drawImage(ImageReader(shade),x,0,width=iw,height=178,mask='auto')
        c.setStrokeColor(colors.HexColor('#b79a60'));c.setLineWidth(.65);c.rect(18,18,W-36,H-36,fill=0,stroke=1)
        for text,font,size,y in [(self.prefix,'Ornate',18,104),('Ander Holimion','Ornate-Bold',34,61),(self.author,'Book',10.5,30)]:
            assert pdfmetrics.stringWidth(text,font,size)<W-70
            c.setFont(font,size);c.setFillColor(colors.HexColor('#11151a'));c.drawCentredString(W/2+1,y-1,text)
            c.setFillColor(colors.HexColor('#f2d49b'));c.drawCentredString(W/2,y,text)
        c.restoreState()
        doc=c._doctemplate
        doc.illustration_blocks.append({'abschnitt':'titel','art':'Titelbild','bilder':[self.source],'pdf_seite':doc.page,'buchseite':0,'spalte':'cover','hoehe':H,'breite':W,'satz':'titelgemaelde'})

def cover_flows(title,refmap):
    tokens=[t for t in title['tokens'] if t['type'] not in ['space','html']]
    hero=next(t for t in tokens if t['type']=='figure')
    h1=next(t for t in tokens if t['type']=='heading' and t['depth']==1)
    author=next(t for t in tokens if t['type']=='heading' and t['depth']==2)
    titletext=h1['text'];prefix,name=titletext.rsplit('Ander Holimion',1)
    if name or not prefix:raise ValueError('Unerwarteter Buchtitel')
    picture=IllustrationGroup([image_flow(hero['image'],WIDTH,True),Paragraph(inline(hero['heading']['tokens'],refmap),ST['artist'])],WIDTH,'Titelbild',title['id'])
    cover=[Spacer(1,24),Paragraph(esc(prefix.strip()),ST['coverh1']),Paragraph('Ander Holimion',ST['covername']),Spacer(1,8),picture,Spacer(1,18),Paragraph(inline(author['tokens'],refmap),ST['coverh2'])]
    if FIGURE_CONFIG.get(hero['image']['href'],{}).get('pdf_satz')=='titelgemaelde':
        cover=[CoverPainting(hero['image']['href'],prefix.strip(),author['text'].removeprefix('Autor: ').strip())]
    reverse=[Spacer(1,91)]
    for t in tokens:
        if t['type']=='heading' and t['depth']==5:reverse.append(Paragraph(inline(t['tokens'],refmap),ST['frontnote']))
    reverse.append(Spacer(1,75))
    for t in tokens:
        if t['type']=='paragraph':reverse.append(Paragraph(inline(t['tokens'],refmap),ST['legal']))
    return cover,reverse

def section_flow(section,refmap,session_names):
    cover=section['art']=='titel';wide=section['art']=='addenda';result=[];pending=[];session_no=0
    def flush():
        result.extend(pending);pending.clear()
    def convert(tokens,quote=False,prefix=None,regroup=True):
        nonlocal wide,session_no
        for t in (group_illustrations(tokens) if regroup else tokens):
            typ=t['type']
            if typ in ['space','def']:continue
            if typ=='html':
                ids=re.findall(r'<a\s+id=["\']([^"\']+)["\']\s*></a>',t.get('raw',''))
                pending.extend(Mark(key) for key in ids)
                leftover=re.sub(r'<[^>]*>','',t.get('raw','')).strip()
                if leftover:flush();result.append(Paragraph(esc(leftover),ST['body']))
                continue
            if typ in ['illustrated_note','illustrated_item']:
                flush();start=len(result)
                if typ=='illustrated_note':
                    result.extend([Spacer(1,7),image_flow(t['image'],WIDTH if wide else COL,cover),Spacer(1,8)])
                    convert([t['note']],regroup=False)
                else:convert(t['tokens'],regroup=False)
                flush();items=result[start:];del result[start:]
                result.append(IllustrationGroup(items,WIDTH if wide else COL,'Bild mit Beschreibung' if typ=='illustrated_note' else 'Gegenstandsbild',section['id']));continue
            if typ=='figure':
                flush();config=FIGURE_CONFIG.get(t['image']['href'],{});layout=config.get('pdf_satz','spalte')
                width=WIDTH if wide or layout in ['breit','seite'] else COL
                caption=[image_flow(t['image'],width,cover,layout=layout,maxheight=config.get('pdf_maxhoehe'),viewport=config.get('pdf_bildausschnitt')),Paragraph(inline(t['heading']['tokens'],refmap),ST['artist'])]
                if t.get('credit'):caption.append(Paragraph(inline(t['credit']['tokens'],refmap),ST['credit']))
                figure=IllustrationGroup(caption,width,'Bildlegende',section['id']);figure.pdf_layout=layout
                result.append(figure);continue
            if typ=='heading':
                plain=t['text']
                if section['art']=='addenda' and plain.startswith('Addendum 2:'):
                    result.extend([NextPageTemplate('Two'),PageBreak()]);wide=False
                elif section['art']=='addenda' and plain.startswith('Addendum 3:'):
                    result.extend([NextPageTemplate('Wide'),PageBreak()]);wide=True
                flush()
                session=re.search(r'Spielabend vom\s+(\d{2}\.\d{2}\.\d{4})',plain)
                if session:
                    if session[1] in section.get('pdf_seitenbeginn_spielabende',[]):result.append(PageBreak())
                    key='abend-'+section['id']+'-'+str(session_no);session_no+=1
                    result.append(Mark(key));session_names[session[1]]=key
                style=ST.get('coverh'+str(t['depth']),ST['coverbody']) if cover else (ST['session'] if session else ST['h'+str(t['depth'])])
                result.append(Paragraph(inline(t.get('tokens'),refmap),style));continue
            if typ in ['paragraph','text']:
                its=t.get('tokens') or [{'type':'text','text':t.get('text','')}]
                pending.extend(Mark(key) for key in re.findall(r'<a\s+id=["\']([^"\']+)["\']\s*></a>',t.get('raw','')))
                flush()
                images=[x for x in its if x['type']=='image']
                text=[x for x in its if x['type']!='image']
                rendered=inline(text,refmap)
                if rendered.strip():
                    style=ST['coverbody'] if cover else ST['quote'] if quote else ST['body']
                    result.append(Paragraph((esc(prefix)+' ' if prefix else '')+rendered,style))
                for im in images:
                    result.extend([Spacer(1,7),image_flow(im,(WIDTH if wide else COL)-(18 if quote else 0),cover,blend=quote),Spacer(1,8)])
            elif typ=='blockquote':
                flush();start=len(result);convert(t['tokens'],True);flush()
                items=result[start:];del result[start:]
                result.append(IllustrationGroup([shade_note(items,WIDTH if wide else COL)],WIDTH if wide else COL,'Infokasten',section['id']))
            elif typ=='list':
                for idx,item in enumerate(t['items']):
                    marker=str(t.get('start',1)+idx)+'.' if t['ordered'] else '•'
                    convert(item['tokens'],quote,marker)
            elif typ=='table':
                if not wide:raise ValueError('Breite Tabelle außerhalb der Anhangvorlage')
                result.extend([Spacer(1,4),table_flow(t,refmap),Spacer(1,10)])
            elif typ=='hr':result.append(Spacer(1,5))
            elif typ=='code':result.append(Paragraph(esc(t['text']).replace('\n','<br/>'),ST['body']))
            else:raise ValueError('Unbekannter Absatztyp: '+typ)
    convert(section['tokens']);flush()
    return result

def span_illustrations(flows):
    """Keep ordinary prose in two columns around full-width artwork."""
    result=[];columns=[]
    def flush_columns():
        if columns:
            result.append(BalancedColumns(columns[:],nCols=2,needed=72,leftPadding=0,rightPadding=0,innerPadding=GAP,topPadding=0,bottomPadding=0,endSlack=0))
            columns.clear()
    for i,flow in enumerate(flows):
        if isinstance(flow,PageBreak):
            flush_columns();result.append(flow);continue
        layout=getattr(flow,'pdf_layout','spalte')
        if layout not in ['breit','seite']:columns.append(flow);continue
        flush_columns()
        if layout=='seite':result.append(CondPageBreak(H-92))
        result.append(flow)
        if layout=='seite' and i<len(flows)-1:result.append(PageBreak())
    flush_columns()
    return result

def build_story(book,refmap):
    global FIGURE_CONFIG
    FIGURE_CONFIG={c['bild']:c for c in book.get('bildlegenden',[])}
    FIGURE_CONFIG.update({im['datei']:im for im in book.get('bilder',[]) if im.get('gegenstand')})
    finished=[s for s in book['abschnitte'] if s['art']!='entwurf']
    story=[];sessions={}
    title=finished[0]
    story.append(Mark('titel'))
    story.extend(Mark(key) for key in re.findall(r'<a\s+id=[\"\']([^\"\']+)[\"\']\s*></a>',title['text']))
    cover,reverse=cover_flows(title,refmap)
    story.extend(cover)
    story.extend([NextPageTemplate('Wide'),PageBreak()]);story.extend(reverse)
    story.extend([NextPageTemplate('Two'),PageBreak(),Paragraph('Inhaltsverzeichnis',ST['h2'])])
    toc=TableOfContents();toc.levelStyles=[ST['toc']];toc.dotsMinLevel=0
    toc.tableStyle=TableStyle([('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)])
    story.append(toc);story.append(FrameBreak())
    story.append(Paragraph('Sortierung nach Spielabenden',ST['h3']))
    dates=defaultdict(list)
    for section in finished[1:]:
        for idx,m in enumerate(re.finditer(r'Spielabend vom\s+(\d{2})\.(\d{2})\.(\d{4})',section['text'])):
            dates[m[3]].append((m[1]+'.'+m[2]+'.','abend-'+section['id']+'-'+str(idx)))
    years=sorted(dates);rows=[[Paragraph(y,ST['indexhead']) for y in years]]
    for idx in range(max(map(len,dates.values()),default=0)):
        rows.append([Paragraph('<link href="#'+dates[y][idx][1]+'" color="#651d12">'+dates[y][idx][0]+'</link>' if idx<len(dates[y]) else '',ST['index']) for y in years])
    tab=Table(rows,colWidths=[COL/len(years)]*len(years))
    tab.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),GREEN),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.Color(1,1,1,alpha=0),GREEN]),('LINEBELOW',(0,0),(-1,0),.5,GOLD),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2)]));story.append(tab)
    for section in finished[1:]:
        flows=section_flow(section,refmap,sessions)
        has_spans=any(getattr(f,'pdf_layout','spalte') in ['breit','seite'] for f in flows)
        template='Wide' if section['art']=='addenda' or has_spans else 'Two'
        story.extend([NextPageTemplate(template),PageBreak(),Mark(section['id'],section['titel'],toc=True)])
        story.extend(span_illustrations(flows) if has_spans else flows)
    return story

def main():
    register_fonts();make_styles()
    source=ROOT/'gestaltung/daten.json'
    if not source.exists():raise FileNotFoundError('Bitte zuerst Aktualisieren.command ausführen.')
    book=json.loads(source.read_text())
    node=Path('/Users/ma7z3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
    if not node.exists():node=Path(shutil.which('node') or '')
    tokenized=subprocess.run([str(node),str(ROOT/'werkzeuge/markdown_tokens.cjs')],input=json.dumps(book,ensure_ascii=False),capture_output=True,text=True,check=True)
    book=json.loads(tokenized.stdout)
    refmap={};pdf_bytes=None;final_doc=None
    for attempt in range(4):
        stream=BytesIO();doc=BookDoc(stream)
        story=build_story(book,refmap)
        required=set(re.findall(r'\]\((#p\d+)\)', '\n'.join(s['text'] for s in book['abschnitte'] if s['art']!='entwurf')))
        available=set(all_marks(story))
        missing={key[1:] for key in required}-available
        if missing:raise ValueError('Unvollständige PDF-Sprungmarken: '+str(sorted(missing)))
        doc.multiBuild(story,maxPasses=6)
        updated={k:book_page(v) for k,v in doc.anchor_pages.items() if re.fullmatch(r'p\d+',k)}
        print('Satzdurchgang',attempt+1,':',doc.page,'Seiten',flush=True)
        pdf_bytes=stream.getvalue();final_doc=doc
        if updated==refmap:break
        refmap=updated
    else:raise RuntimeError('Seitenverweise haben sich nicht stabilisiert. Keine PDF gespeichert.')
    export=ROOT/'export';export.mkdir(exist_ok=True)
    filename='Das Tagebuch des Ander Holimion - '+datetime.now().strftime('%Y-%m-%d_%H-%M-%S')+'.pdf'
    target=export/filename
    with target.open('xb') as f:f.write(pdf_bytes)
    (export/'aktuell.js').write_text('window.BUCH_PDF = '+json.dumps('export/'+filename,ensure_ascii=False)+';\n')
    versioniere_startseite()
    report={'datei':str(target.relative_to(ROOT)),'seiten':final_doc.page,'abschnitte':len([s for s in book['abschnitte'] if s['art']!='entwurf']),'rohnotizen_ausgeschlossen':[s['datei'] for s in book['abschnitte'] if s['art']=='entwurf'],'kapitel_seiten':final_doc.section_pages,'alte_anker_auf_neue_seiten':refmap,'alte_anker_auf_pdf_seiten':{k:v for k,v in final_doc.anchor_pages.items() if re.fullmatch(r'p\d+',k)},'bildgruppen':final_doc.illustration_blocks,'fusszeilen':final_doc.footer_positions,'nummerierung':{'titelblatt_pdf_seite':1,'hinweise_pdf_seite':2,'erste_buchseite_pdf_seite':3,'ungerade':'rechts','gerade':'links'},'hinweis':'Titelblatt und Rückseite unnummeriert; Buchzählung ab Inhaltsverzeichnis. Verweise zeigen Buchseiten.'}
    (export/(target.stem+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('Buch-PDF gespeichert:',target,flush=True)
    if '--open' in sys.argv:subprocess.run(['open',str(target)],check=False)

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('PDF-Export abgebrochen:',exc,file=sys.stderr)
        raise
