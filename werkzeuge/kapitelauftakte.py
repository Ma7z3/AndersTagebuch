"""Facing chapter openings: an even quote page followed by an odd art page."""
import html
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import ActionFlowable, Flowable

W, H = 612, 792
GOLD = colors.HexColor('#c6ab70')
INK = colors.HexColor('#263c35')

class AlignQuotePage(ActionFlowable):
    def __init__(self):
        ActionFlowable.__init__(self, ())

    def apply(self, doc):
        if (doc.page - 2) % 2:
            doc.opening_blank_pages.append(doc.page)
            doc.handle_pageBreak()

class ChapterQuote(Flowable):
    def __init__(self, section, opening, paragraph):
        Flowable.__init__(self)
        self.section, self.opening, self.paragraph = section, opening, paragraph
        self.width, self.height = 522, 1

    def draw(self):
        c = self.canv
        doc = c._doctemplate
        assert (doc.page - 2) % 2 == 0, 'Zitatseite muss links liegen'
        c.saveState()
        c.resetTransforms()
        style = ParagraphStyle('chapter-quote', fontName='Book-Italic', fontSize=24,
                               leading=34, alignment=1, textColor=INK)
        quote = self.paragraph(html.escape('„' + self.opening['zitat'] + '“'), style)
        if quote.minWidth() > 420:
            size = 24 * 416 / quote.minWidth()
            style = ParagraphStyle('chapter-quote-fit', parent=style, fontSize=size,
                                   leading=size * 34 / 24, splitLongWords=False)
            quote = self.paragraph(html.escape('„' + self.opening['zitat'] + '“'), style)
        assert quote.minWidth() <= 420, 'Ein Wort im Kapitelzitat ist zu breit'
        width, height = quote.wrap(420, 600)
        assert height < 380, 'Kapitelzitat ist zu lang'
        baseline = H * .53 - height / 2
        quote.drawOn(c, (W - width) / 2, baseline)
        c.setStrokeColor(GOLD)
        c.setLineWidth(.8)
        c.line(W / 2 - 36, baseline - 28, W / 2 + 36, baseline - 28)
        c.setFillColor(INK)
        c.setFont('Caps', 11)
        c.drawCentredString(W / 2, baseline - 54, 'Aus dem Tagebuch des Ander Holimion')
        c.setFont('Scaly', 9)
        c.setFillColor(colors.HexColor('#8a7039'))
        c.drawCentredString(W / 2, baseline - 73, 'Kapitel ' + self.section['id'].split('-')[-1].lstrip('0'))
        c.restoreState()
        doc.pending_opening = {'kapitel': self.section['id'], 'zitat': self.opening['zitat'],
                               'zitat_pdf_seite': doc.page, 'zitat_buchseite': doc.page - 2}

class ChapterPainting(Flowable):
    def __init__(self, section, opening, image_path, paragraph):
        Flowable.__init__(self)
        self.section, self.opening, self.image_path = section, opening, image_path
        self.paragraph = paragraph
        self.width, self.height = 522, 1

    def draw(self):
        c = self.canv
        doc = c._doctemplate
        pair = doc.pending_opening
        assert doc.page == pair['zitat_pdf_seite'] + 1 and (doc.page - 2) % 2 == 1
        assert pair['kapitel'] == self.section['id']
        c.saveState()
        c.resetTransforms()
        with Image.open(self.image_path) as im:
            iw, ih = im.size
        scale = max(W / iw, H / ih)
        c.drawImage(str(self.image_path), (W - iw * scale) / 2, (H - ih * scale) / 2,
                    width=iw * scale, height=ih * scale, mask='auto')
        # A print overlay keeps all title text editable and leaves the source painting intact.
        shade = Image.new('RGBA', (4, 1024))
        shade.putdata([(6, 11, 16, round(194 * (1 - y / 1023)))
                       for y in range(1024) for _ in range(4)])
        bottom = self.opening.get('titelposition') == 'unten'
        if bottom:
            shade = shade.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        c.drawImage(ImageReader(shade), 0, 0 if bottom else H - 280, width=W, height=280, mask='auto')
        top = 208 if bottom else H
        group_style = ParagraphStyle('chapter-scenario', fontName='Caps', fontSize=8.5,
                                     leading=11, alignment=1, textColor=GOLD)
        group = self.paragraph(html.escape(self.section['gruppe']), group_style)
        gw, gh = group.wrap(W - 90, 36)
        group.drawOn(c, (W - gw) / 2, top - 24 - gh)
        number = self.section['id'].split('-')[-1].lstrip('0')
        title = self.section['titel'].split(': ', 1)[-1].split(' – ', 1)[-1]
        c.setFillColor(GOLD)
        c.setFont('Caps', 13)
        c.drawCentredString(W / 2, top - 58, 'Kapitel ' + number)
        size = 29 if len(title) < 36 else 24
        style = ParagraphStyle('chapter-title', fontName='Ornate-Bold', fontSize=size,
                               leading=size * 1.32, alignment=1, textColor=colors.HexColor('#f7e6c1'))
        text = self.paragraph(html.escape(title), style)
        width, height = text.wrap(W - 100, 190)
        text.drawOn(c, (W - width) / 2, top - 81 - height)
        c.setStrokeColor(GOLD)
        c.setLineWidth(.65)
        c.line(W / 2 - 48, top - 102 - height, W / 2 + 48, top - 102 - height)
        c.setFillColor(colors.Color(.025, .045, .065, alpha=.65))
        c.rect(0, 0, W, 29, fill=1, stroke=0)
        c.setFillColor(colors.HexColor('#eddbb6'))
        c.setFont('Scaly', 8)
        c.drawString(61, 11, 'Das Tagebuch des Ander Holimion')
        c.setFont('Scaly', 9)
        c.drawCentredString(W - 24, 20, str(doc.page - 2))
        c.restoreState()
        doc.footer_positions.append({'pdf_seite': doc.page, 'buchseite': doc.page - 2,
            'seite': 'rechts', 'zahl_x': W - 24, 'zahl_basis_y': 20,
            'buchtitel_basis_y': 11, 'verzierung_gespiegelt': False})
        doc.opening_spreads.append({**pair, 'bild': self.opening['bild'],
                                    'bild_pdf_seite': doc.page, 'bild_buchseite': doc.page - 2})
        doc.illustration_blocks.append({'abschnitt': self.section['id'], 'art': 'Kapitelgemälde',
            'bilder': [self.opening['bild']], 'pdf_seite': doc.page, 'buchseite': doc.page - 2,
            'spalte': 'ganzseitig', 'hoehe': H, 'breite': W, 'satz': 'kapitelgemaelde'})
