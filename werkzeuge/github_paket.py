#!/usr/bin/env python3
"""Export only approved diary sources for the public repository."""
from pathlib import Path
import argparse,json
from veroeffentlichen import copy_sources
p=argparse.ArgumentParser();p.add_argument('--ziel',required=True,type=Path);a=p.parse_args();target=a.ziel.resolve()
if target.exists():raise FileExistsError('Zielordner muss neu sein: '+str(target))
copy_sources(target)
assert not any((target/x).exists() for x in ['entwuerfe','eingang','sicherung','pruefung','export'])
assert not (target/'gestaltung/daten.js').exists()
print(json.dumps({'quellen':str(target),'dateien':sum(x.is_file() for x in target.rglob('*')),'rohnotizen':0},ensure_ascii=False,indent=2))
