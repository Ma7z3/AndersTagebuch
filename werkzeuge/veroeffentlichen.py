#!/usr/bin/env python3
"""Build HTML and book PDF together in an isolated staging tree."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import argparse, hashlib, json, re, shutil, subprocess, sys, tempfile
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
TOOLS=['aktualisieren.py','buch_pdf.py','markdown_tokens.cjs','tabellen_pruefen.py','veroeffentlichen.py','github_paket.py']

def copy_file(source,target):
    target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)

def copy_sources(target):
    """Positive allow-list: neither private drafts nor generated local data."""
    config=json.loads((ROOT/'tagebuch.json').read_text())
    config['abschnitte']=[s for s in config['abschnitte'] if s['art']!='entwurf']
    config.pop('original_pdf',None)
    target.mkdir(parents=True,exist_ok=True)
    (target/'tagebuch.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')
    for s in config['abschnitte']:
        source=(ROOT/s['datei']).resolve()
        if not source.is_relative_to(ROOT.resolve()):raise ValueError('Quelle außerhalb des Tagebuchs')
        copy_file(source,target/s['datei'])
    for source in sorted((ROOT/'eintraege').glob('*.md')):copy_file(source,target/'eintraege'/source.name)
    for rel in ['START.html','gestaltung/leser.js','gestaltung/leser.css','gestaltung/marked.umd.js','gestaltung/bildlegenden.json','bilder/verzeichnis.json']:
        copy_file(ROOT/rel,target/rel)
    for source in sorted((ROOT/'bilder').glob('*')):
        if source.suffix.lower() in ['.png','.jpg','.jpeg','.webp','.svg']:copy_file(source,target/'bilder'/source.name)
    for source in sorted((ROOT/'gestaltung/schriften').glob('*')):
        if source.suffix.lower() in ['.ttf','.woff2','.txt']:copy_file(source,target/'gestaltung/schriften'/source.name)
    for source in sorted((ROOT/'karten').glob('*')):
        if source.is_file() and source.suffix.lower() in ['.json','.js','.css','.svg','.png','.jpg','.md']:copy_file(source,target/'karten'/source.name)
    for name in TOOLS:copy_file(ROOT/'werkzeuge'/name,target/'werkzeuge'/name)
    for rel in ['requirements.txt','.github/workflows/tagebuch.yml','.gitignore']:
        copy_file(ROOT/rel,target/rel)
    copy_file(ROOT/'README-GitHub.md',target/'README.md')
    copy_file(ROOT/'README-GitHub.md',target/'README-GitHub.md')
    (target/'eintraege').mkdir(exist_ok=True)

def validate_pdf(path,data):
    reader=PdfReader(path);meta=json.loads(path.with_suffix('.json').read_text())
    assert reader.page_labels==['Titel','Hinweise']+[str(n) for n in range(1,len(reader.pages)-1)],'Seitennummerierung ungültig'
    texts='\n'.join(p.extract_text() for p in reader.pages)
    for s in data['abschnitte'][1:]:assert s['id'] in meta['kapitel_seiten'],'Abschnitt fehlt im PDF: '+s['id']
    expected=set(re.findall(r'!\[[^\]]*\]\((bilder/[^)]+)\)', '\n'.join(s['text'] for s in data['abschnitte'])))
    actual=[im for g in meta['bildgruppen'] for im in g['bilder']]
    assert expected==set(actual),'Bildgruppe fehlt im Buch'
    assert all(g['hoehe']<=700.1 for g in meta['bildgruppen']),'Bildgruppe überschreitet Spaltenhöhe'
    for im in re.findall(r'(?:file:|/Users/|entwuerfe/|sicherung/)',texts):raise ValueError('Lokaler Verweis im veröffentlichten Buch: '+im)
    return {'pdf_seiten':len(reader.pages),'buchseiten':len(reader.pages)-2,'bildgruppen':len(actual),'alte_anker':len(meta['alte_anker_auf_neue_seiten'])}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--ziel',required=True,type=Path);args=parser.parse_args();dest=args.ziel.resolve()
    if dest.exists():raise FileExistsError('Der Ausgabeordner muss neu sein: '+str(dest))
    if not Path('/System/Library/Fonts/Times.ttc').is_file():raise RuntimeError('Für die originalgetreuen Ersatzzeichen wird macOS mit Times.ttc benötigt.')
    with tempfile.TemporaryDirectory(prefix='ander-buch-') as tmp:
        stage=Path(tmp)/'quelle';copy_sources(stage)
        subprocess.run([sys.executable,str(stage/'werkzeuge/aktualisieren.py'),'--oeffentlich'],check=True)
        data=json.loads((stage/'gestaltung/daten.json').read_text())
        assert all(s['art']!='entwurf' for s in data['abschnitte'])
        subprocess.run([sys.executable,str(stage/'werkzeuge/buch_pdf.py')],check=True)
        pdf=next((stage/'export').glob('*.pdf'));report=validate_pdf(pdf,data)
        site=Path(tmp)/'website';site.mkdir()
        for name in ['gestaltung','bilder','karten']:
            if (stage/name).exists():shutil.copytree(stage/name,site/name)
        # The download and HTML data are deployed as one artifact and one version.
        (site/'export').mkdir();copy_file(pdf,site/'export/Ander-Holimion-Tagebuch.pdf')
        pdf_hash=hashlib.sha256(pdf.read_bytes()).hexdigest()
        (site/'export/aktuell.js').write_text('window.BUCH_PDF = '+json.dumps('export/Ander-Holimion-Tagebuch.pdf?v='+pdf_hash[:16])+';\n')
        page=(stage/'START.html').read_text().replace('DAS TAGEBUCH · LOKALE AUSGABE','DAS TAGEBUCH · GEMEINSAME AUSGABE').replace('Nur auf deinem Rechner.<br>Text und Bilder sind lokal gespeichert.','Die Reisen des Ander Holimion.<br>Für unsere Abenteuerrunde.')
        page=re.sub(r'<a id="original".*?</a>','',page)
        page=page.replace('Zum Lesen dieser lokalen Ausgabe bitte JavaScript im Browser aktivieren. Der ursprüngliche PDF-Band liegt im Unterordner sicherung/originale.','Zum Lesen bitte JavaScript aktivieren. Die Buchfassung gibt es als PDF im Download.')
        def cache_asset(match):
            relative=match[2];asset=site/relative
            return match[1]+relative+'?v='+hashlib.sha256(asset.read_bytes()).hexdigest()[:12]+match[3]
        page=re.sub(r'((?:src|href)=")([^"?]+\.(?:js|css))(?:\?v=[^" ]+)?(")',cache_asset,page)
        (site/'index.html').write_text(page);(site/'START.html').write_text(page);(site/'.nojekyll').touch()
        manifest={'erstellt':datetime.now(ZoneInfo('Europe/Berlin')).isoformat(),'abschnitte':len(data['abschnitte']),'kapitel':sum(s['art'] in ['kapitel','eintrag'] for s in data['abschnitte']),'rohnotizen':0,'erzaehlstand':data['stand'],'pdf_sha256':pdf_hash,**report}
        (site/'stand.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
        assert not any((site/x).exists() for x in ['entwuerfe','eingang','sicherung','pruefung'])
        dest.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(site,dest)
        print(json.dumps({'website':str(dest),**manifest},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
