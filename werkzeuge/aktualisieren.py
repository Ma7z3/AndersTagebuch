#!/usr/bin/env python3
"""Rebuild the offline reader using only Python's standard library."""
from pathlib import Path
from datetime import datetime
import hashlib, json, re, zipfile, sys
import xml.etree.ElementTree as ET
from tabellen_pruefen import validate_tables

ROOT=Path(__file__).resolve().parents[1]
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

def docx_text(path):
    with zipfile.ZipFile(path) as archive:
        tree=ET.fromstring(archive.read('word/document.xml'))
        body=tree.find('w:body',NS)
        paragraphs=[]
        for node in body:
            if node.tag.endswith('}p'):
                paragraphs.append(''.join(t.text or '' for t in node.findall('.//w:t',NS)))
            elif node.tag.endswith('}tbl'):
                for row in node.findall('w:tr',NS):
                    paragraphs.append(' | '.join(' '.join(t.text or '' for t in cell.findall('.//w:t',NS)) for cell in row.findall('w:tc',NS)))
        return '\n\n'.join(paragraphs).strip()

def versioniere_startseite():
    page=ROOT/'START.html'
    if not page.exists():return
    text=page.read_text()
    def version(match):
        path=ROOT/match[2]
        if not path.exists():return match[0]
        return match[1]+match[2]+'?v='+hashlib.sha256(path.read_bytes()).hexdigest()[:12]+match[3]
    text=re.sub(r'((?:src|href)=")([^"?]+\.(?:js|css))(?:\?v=[^" ]+)?(")',version,text)
    page.write_text(text)

def validate_chronicle(data):
    chronicle=data.get('chronik')
    if not chronicle:return
    figures=chronicle['figuren'];items=chronicle['gegenstaende']
    sections={s['id']:s['text'] for s in data['abschnitte']}
    for entry in figures:
        for source in entry['auftritte']:
            number=source['kapitel']
            section='prolog' if number==0 else f'kapitel-{number:02}'
            anchor=source.get('anker')
            if section not in sections or (anchor and f'<a id="{anchor}"></a>' not in sections[section]):
                raise ValueError(f'Figurenfundstelle fehlt: {entry["id"]}, {section}, {anchor or "Kapitelanfang"}')
    for group in [figures,items]:
        ids=[e['id'] for e in group]
        if len(ids)!=len(set(ids)):raise ValueError('Doppelte Kennung in der Chronik')
        for entry in group:
            if not 0<=entry['ab_kapitel']<=46:raise ValueError('Ungültiger Lesestand: '+entry['id'])
            for event in entry.get('ereignisse',[])+entry.get('fakten',[])+entry.get('beziehungen',[])+entry.get('auftritte',[]):
                if not entry['ab_kapitel']<=event['kapitel']<=46:raise ValueError('Chronik-Ereignis vor Einführung: '+entry['id'])
            portrait=entry.get('portrait')
            image=portrait['bild'] if portrait else entry.get('bild')
            if image:
                path=(ROOT/image).resolve()
                if not path.is_relative_to(ROOT.resolve()) or not path.is_file():raise ValueError('Chronik-Bild fehlt: '+image)
            if portrait:
                if portrait.get('vorschau'):
                    preview=(ROOT/portrait['vorschau']).resolve()
                    if not preview.is_relative_to(ROOT.resolve()) or not preview.is_file():raise ValueError('Porträtvorschau fehlt: '+entry['id'])
                x,y,w,h=portrait['ausschnitt']
                if not (0<=x<100 and 0<=y<100 and w>0 and h>0 and x+w<=100.01 and y+h<=100.01):raise ValueError('Porträtausschnitt außerhalb des Bildes: '+entry['id'])
                if portrait['ab_kapitel']<entry['ab_kapitel']:raise ValueError('Porträt vor Figureneinführung: '+entry['id'])
    for chapter,spots in chronicle['gemalde'].items():
        if chapter not in data['kapitelauftakte']:raise ValueError('Gemälde ohne Kapitel: '+chapter)
        for spot in spots:
            group=figures if spot['art']=='figur' else items
            if not any(e['id']==spot['id'] for e in group) or not(0<=spot['x']<=100 and 0<=spot['y']<=100):raise ValueError('Ungültiger Bildpunkt: '+chapter)


def bestiary_cards(sections):
    """Use the image and Markdown from the illustrated chapter box."""
    aliases = {
        'Drachengeborene': 'Drachengeborener',
        'Hobgoblin': 'Hobgoblins',
        'Ifrit': 'Ifriti',
        'Landhai (Bulette)': 'Landhai',
        'Metallmeister (Schwertschnecke)': 'Metallmeister',
        'Ruinenspinnen': 'Ruinenspinne',
        'Silberdrache': 'Silberdrachen',
    }
    boxes = {}
    for section in sections:
        if section['art'] != 'kapitel':
            continue
        for quote in re.findall(r'(?m)(?:^>[^\n]*\n?)+', section['text']):
            lines = [re.sub(r'^> ?', '', line) for line in quote.splitlines()]
            heading = re.fullmatch(r'#####\s+(.+)', lines[0])
            if not heading:
                continue
            for index, line in enumerate(lines[1:], 1):
                image = re.fullmatch(r'!\[([^\]]*)\]\((bilder/[^)]+)\)', line.strip())
                if image:
                    boxes[heading[1].strip().casefold()] = {
                        'titel': heading[1].strip(),
                        'bild': image[2],
                        'text': '\n'.join(lines[1:index] + lines[index + 1:]).strip(),
                        'kapitel': section['id'],
                    }
                    break
    section = next(section for section in sections if section['id'] == 'bestiarium')
    cards = {}
    for row in section['text'].splitlines():
        if not row.startswith('|'):
            continue
        name = row.split('|', 2)[1].strip()
        name = re.sub(r'<a id="[^"]+"></a>', '', name)
        if name == 'Name' or name.startswith(':'):
            continue
        card = boxes[aliases.get(name, name).casefold()]
        preview = 'bilder/bestiarium-' + Path(card['bild']).stem + '-vorschau.webp'
        if (ROOT/preview).is_file():
            card['vorschau'] = preview
        cards[name] = card
    return cards


def main():
    public='--oeffentlich' in sys.argv
    config=json.loads((ROOT/'tagebuch.json').read_text())
    if public:
        config['abschnitte']=[s for s in config['abschnitte'] if s['art']!='entwurf']
        config.pop('original_pdf',None)
    config['oeffentlich']=public
    if not public:
        imports_path=ROOT/'eingang/importverzeichnis.json'
        imports=json.loads(imports_path.read_text()) if imports_path.exists() else {}
        for source in sorted((ROOT/'eingang').glob('*.docx')):
            if source.name.startswith('~$'):continue
            digest=hashlib.sha256(source.read_bytes()).hexdigest()
            if digest in imports:
                if not (ROOT/imports[digest]).exists():raise RuntimeError('Ein bereits importierter Entwurf fehlt: '+imports[digest])
                continue
            text=docx_text(source)
            date=re.search(r'(\d{2})\.(\d{2})\.(\d{4})',source.stem)
            label=f'{date[3]}-{date[2]}-{date[1]}' if date else re.sub(r'[^\w-]+','-',source.stem)
            name=label+'-rohnotizen.md';target=ROOT/'entwuerfe'/name
            if target.exists():target=target.with_name(target.stem+'-'+digest[:8]+target.suffix)
            if target.exists():raise RuntimeError('Zieldatei existiert schon: '+str(target))
            title='Spielabend vom '+date[0] if date else source.stem
            target.write_text('# '+title+'\n\n'+text+'\n')
            imports[digest]=str(target.relative_to(ROOT))
            print('Neue Rohnotizen:',target.name)
        imports_path.write_text(json.dumps(imports,ensure_ascii=False,indent=2)+'\n')

    finished_ids={s['id'] for s in config['abschnitte'] if s['art']!='entwurf'}
    for section in config['abschnitte']:
        if section.get('verarbeitet_in') and section['verarbeitet_in'] not in finished_ids:
            raise ValueError('Bearbeitete Rohnotizen verweisen auf fehlenden fertigen Abschnitt: '+section['id'])
    known={s['datei'] for s in config['abschnitte']}
    sections=[s for s in config['abschnitte'] if not s.get('verarbeitet_in')]
    for folder,kind,group in ([('eintraege','eintrag','Neue Einträge')] if public else [('eintraege','eintrag','Neue Einträge'),('entwuerfe','entwurf','Rohnotizen')]):
        for path in sorted((ROOT/folder).glob('*.md')):
            relative=str(path.relative_to(ROOT))
            if relative in known:continue
            text=path.read_text()
            heading=re.search(r'^#{1,6}\s+(.+)',text,re.M)
            title=heading[1] if heading else path.stem
            section={'id':kind+'-'+path.stem,'titel':title,'gruppe':group,'art':kind,'datei':relative,'quelle':'Lokale Textdatei'}
            if kind=='eintrag':
                position=next((i for i,s in enumerate(sections) if s['art'] in ['addenda','credits','entwurf']),len(sections))
                sections.insert(position,section)
            else:sections.append(section)
    for section in sections:
        path=ROOT/section['datei']
        if not path.exists():raise FileNotFoundError('Kapiteldatei fehlt: '+section['datei'])
        section['text']=path.read_text()
        validate_tables(section['text'], section['datei'])
        for reference in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',section['text']):
            target=ROOT/reference
            if reference.startswith(('http:','https:')):raise ValueError('Externes Bild im Kapitel: '+reference)
            if not target.exists():raise FileNotFoundError('Bild fehlt: '+reference)
    dates=[datetime.strptime(date,'%d.%m.%Y') for section in sections if section['art'] in ['kapitel','eintrag'] for date in re.findall(r'\(Spielabend vom (\d{2}\.\d{2}\.\d{4})\)',section['text'])]
    if dates:config['stand']='Erzählung bis '+max(dates).strftime('%d.%m.%Y')
    images=json.loads((ROOT/'bilder/verzeichnis.json').read_text())
    extra=ROOT/'bilder/gegenstaende.json'
    if extra.exists():images.extend(json.loads(extra.read_text()))
    data={**config,'abschnitte':sections,'bilder':[im for im in images if im['typ']=='illustration'],'bildlegenden':json.loads((ROOT/'gestaltung/bildlegenden.json').read_text())}
    for key in ['erzaehlkaesten','chronik']:
        path=ROOT/'gestaltung'/f'{key}.json'
        if path.exists():data[key]=json.loads(path.read_text())
    openings=ROOT/'gestaltung/kapitelauftakte.json'
    if openings.exists():
        data['kapitelauftakte']=json.loads(openings.read_text())
        chapter_ids={s['id'] for s in sections if s['art']=='kapitel'}
        if set(data['kapitelauftakte'])!=chapter_ids:
            raise ValueError('Für jedes Kapitel muss genau ein vollständiger Kapitelauftakt vorliegen.')
        for key,opening in data['kapitelauftakte'].items():
            if not isinstance(opening.get('zitat_urheber'),str) or not opening['zitat_urheber'].strip():raise ValueError('Zitatsprecher oder Quelle fehlt: '+key)
            if opening.get('titelposition','oben') not in ['oben','unten']:raise ValueError('Ungültige Titelposition: '+key)
            section=next(s for s in sections if s['id']==key and s['art']=='kapitel')
            compact=lambda text: re.sub(r'\s+',' ',re.sub(r'[#*_]','',text)).strip()
            if compact(opening['zitat']) not in compact(section['text']):raise ValueError('Kapitelzitat nicht im Original: '+key)
            picture=(ROOT/opening['bild']).resolve()
            if not picture.is_relative_to(ROOT) or not picture.is_file():raise FileNotFoundError(opening['bild'])
            data['bilder'].append({'datei':opening['bild'],'titel':section['titel']+' – Kapitelgemälde','typ':'illustration','kapitel_auftakt':key,'kapitel':key,'pdf_seiten':[]})
    for item in data['bilder']:
        if not (ROOT/item['datei']).exists():raise FileNotFoundError(item['datei'])
        if 'farbklecks' in item:
            wash = item['farbklecks']
            if item.get('herkunft') != 'ki-gegenstand' or not re.fullmatch(r'bilder/gegenstandsfarbe-[a-z]+\.png', wash):
                raise ValueError('Ungültiger Farbklecks: '+item['datei'])
            if not (ROOT/wash).is_file():
                raise FileNotFoundError(wash)
    validate_chronicle(data)
    data['bestiarium_karten'] = bestiary_cards(sections)
    route_path=ROOT/'karten/reise.json'
    if route_path.exists():
        route=json.loads(route_path.read_text());ids={s['id'] for s in sections}
        planes={p['id'] for p in route['ebenen']}
        for step in route['stationen']:
            if not set(step['kapitel'])<=ids:raise ValueError('Reiseatlas verweist auf fehlendes Kapitel: '+step['ort'])
            if step['ebene'] not in planes:raise ValueError('Unbekannte Ebene: '+step['ebene'])
            if step['region'] is not None and step['region'] not in route['regionen']:raise ValueError('Unbekannte Reiseregion')
        places = json.loads((ROOT/'karten/ortsansichten.json').read_text())
        station_ids = [station for place in places.values() for station in place.get('stationen', [])]
        if len(station_ids) != len(set(station_ids)) or not set(station_ids) <= {step['id'] for step in route['stationen']}:
            raise ValueError('Ortsansicht verweist auf eine doppelte oder unbekannte Reisestation')
        for key, place in places.items():
            if not re.fullmatch(r'[a-z0-9-]+', key) or place['kapitel'] not in ids:
                raise ValueError('Ungültige Ortsansicht: '+key)
            for file in (f'ort-{key}.webp', f'ort-{key}-vorschau.webp'):
                if not (ROOT/'bilder'/file).is_file():
                    raise FileNotFoundError('Ortsansicht fehlt: '+file)
        data['ortsansichten'] = places
        (ROOT/'karten/reise.js').write_text('window.REISE = '+json.dumps(route,ensure_ascii=False).replace('</','<\\/')+';\n')
    payload=json.dumps(data,ensure_ascii=False).replace('</','<\\/')
    (ROOT/'gestaltung/daten.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'gestaltung/daten.js').write_text('window.TAGEBUCH = '+payload+';\n')
    versioniere_startseite()
    print('Öffentliche Fassung ohne Rohnotizen.' if public else 'Word-Dateien werden nur als Rohnotizen übernommen. Keine automatische Umschreibung oder Kapitelzuordnung.')
    print(f'Fertig: {len(sections)} Abschnitte und {len(data["bilder"])} Illustrationen. START.html kann geöffnet werden.')

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('Abgebrochen:',exc,file=sys.stderr)
        sys.exit(1)
