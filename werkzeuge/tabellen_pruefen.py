"""Reject malformed table rows before they can disappear in the renderer."""
import re

def validate_tables(text, name='Text'):
    lines=text.splitlines()
    expected=None
    last_was_blank=False
    table_count=0
    in_code=False
    for i,line in enumerate(lines):
        value=line.strip()
        if value.startswith('```'):
            in_code=not in_code
            continue
        if in_code:continue
        if value.startswith('|'):
            separators=len(re.findall(r'(?<!\\)\|',value))
            if expected is None:
                if i+1>=len(lines) or not re.match(r'^\|[: -]+\|',lines[i+1].strip()):
                    raise ValueError(f'{name}, Zeile {i+1}: Tabellenzeile ohne gültigen Tabellenkopf oder durch Leerzeile getrennt.')
                expected=separators
                table_count+=1
            if not value.endswith('|') or separators!=expected:
                raise ValueError(f'{name}, Zeile {i+1}: {separators-1} statt {expected-1} Tabellenzellen. Aktualisierung wurde abgebrochen.')
            if last_was_blank:
                raise ValueError(f'{name}, Zeile {i+1}: Leerzeile unterbricht die Tabelle.')
            last_was_blank=False
        else:
            if not value and expected is not None:
                expected=None
            elif value:
                expected=None
            last_was_blank=False
    return table_count
