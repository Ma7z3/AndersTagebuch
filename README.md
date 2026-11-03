# Die Reisen des Ander Holimion

Das Tagebuch unserer Abenteuerrunde. Fertige Kapitel sind die gemeinsame Quelle für die Leseausgabe und das vollständige Buch-PDF.

## Lesen und herunterladen

Die Website wird über GitHub Pages veröffentlicht. Der Knopf **PDF herunterladen** enthält dieselben fertigen Kapitel wie die Website. Er lädt die zuletzt erfolgreich erzeugte Buchfassung mit eingebetteten Schriften und Bildern.

## Ein fertiges Kapitel ergänzen

Eine neue Markdown-Datei in **eintraege/** hinzufügen, zum Beispiel **47-fortsetzung.md**. Die erste Überschrift wird als Titel übernommen. Neue Texte werden in der alphabetischen Reihenfolge ihrer Dateinamen vor den Addenda eingeordnet. Vorhandene Kapitel können unter **inhalte/** bearbeitet werden.

Bilder nach **bilder/** legen und im Text mit `![Beschreibung](bilder/dateiname.png)` einbinden. Bild und Erklärung bleiben im Buch zusammen, wenn sie als gemeinsamer Infokasten oder Bild mit anschließender Bildlegende aufgebaut sind. Die Legenden der vorhandenen Illustrationen liegen in **gestaltung/bildlegenden.json**. Dort bestimmt `pdf_satz` das Buchformat: `spalte` für ein Bild innerhalb einer Textspalte, `breit` für die Breite beider Spalten und `seite` für eine eigene Bildseite. Das Seitenverhältnis bleibt erhalten. Die vorhandenen Formate wurden mit der ursprünglichen PDF verglichen.

Nach dem Speichern auf dem Zweig **main** erstellt GitHub Actions Website und PDF automatisch gemeinsam. Inhaltsverzeichnis, Seitenzahlen und interne Seitenverweise werden neu berechnet. Der Erzählstand richtet sich nach dem jüngsten Spielabend-Datum in den fertigen Kapiteln. Schlägt ein Aufbau fehl, wird diese Fassung nicht veröffentlicht; die vorige Ausgabe bleibt bestehen. Größere Änderungen am Satz bitte anhand der erzeugten PDF visuell prüfen.

Word-Rohnotizen müssen vorher redaktionell zu einem fertigen Eintrag werden. Sie werden nicht automatisch als Kapitel ausgearbeitet. Lokale Notizen und Sicherungen sind nicht Bestandteil dieses Repositorys.

## Einmalige Einrichtung

Unter **Settings → Pages → Build and deployment → Source** die Option **GitHub Actions** wählen. Danach den Arbeitsablauf **Tagebuch und Buch-PDF** unter **Actions** starten oder eine Änderung auf **main** speichern.

## Selbst aufbauen

Python 3.12, Node.js 24 und macOS mit der Schrift Times sind nötig. Die originale Buchschrift enthält keine vollständigen Umlaute; die Ersatzzeichen stammen wie in der ursprünglichen PDF aus Times. Deshalb wird auch auf GitHub ein macOS-Läufer verwendet.

```sh
python -m pip install -r requirements.txt
python werkzeuge/veroeffentlichen.py --ziel _site
```

Der Zielordner darf noch nicht existieren. Die öffentlich ausgelieferten Dateien liegen anschließend darin. Für das reine Lesen der fertigen Website oder PDF sind diese Programme nicht nötig.

## Gestaltung und Inhalte

Die Gestaltung enthält die rekonstruierten ursprünglichen Buchschriften und zusätzlich Cinzel Decorative von Natanael Gama für den neu gestalteten Titel. Die zugehörigen mitgelieferten Lizenztexte liegen bei den Schriftdateien. Die ursprünglichen Bildnachweise bleiben in den Credits des Tagebuchs erhalten.

Alle 46 Kapitel beginnen im Buch mit einer Doppelseite: links auf einer geraden Buchseite steht ein wörtliches Zitat aus dem Kapitel, rechts auf einer ungeraden Seite ein ganzseitiges Gemälde mit separat gesetzter Kapitelüberschrift. Der Satz fügt bei Bedarf eine Leerseite ein und berechnet Inhaltsverzeichnis und Verweise entsprechend neu. In der Leseausgabe stehen Zitat und Gemälde nebeneinander; auf schmalen Bildschirmen folgen sie aufeinander.

Die Zuordnung liegt in **gestaltung/kapitelauftakte.json**. Jeder Eintrag enthält das unveränderte Kapitelzitat, den Bildpfad und eine Szenenbeschreibung. Jedes als `kapitel` registrierte Kapitel benötigt einen solchen Eintrag; fehlende Bilder oder Zitate, die im Kapitel nicht vorkommen, stoppen den Aufbau. Bei neuen Gemälden müssen Figuren und Ausrüstung dem Stand der gewählten Szene entsprechen. Die Überschrift gehört nicht zur Bilddatei.

Die Sprachprüfung ist noch nicht abgeschlossen. Der freigegebene Spielabend vom 21.09.2026 setzt Kapitel 46 fort und ist in Website und Buch enthalten.

## Reiseatlas

Unter **Karten** lassen sich 28 Hauptstationen der Kapitel 1–46 auf Faerûn und in einer Ebenenansicht verfolgen. Die Karte ist © 2015 Wizards of the Coast; Quelle und Einordnung stehen in der Ansicht. Teilweise sind nur Reiseregionen belegt. Neue Stationen werden nach inhaltlicher Prüfung in **karten/reise.json** ergänzt; die Position eines neuen Kapitels wird nicht erfunden.

## Nachschlagen

Die Addenda sind in Persönlichkeiten und Orte, Magische Gegenstände sowie Bestiarium aufgeteilt. Alle drei Teile stehen einzeln in der Navigation und im Buch-Inhaltsverzeichnis. Gegenstandseinträge sind durch kräftige Linien getrennt. Bestehende Seiten- und Gegenstandsanker bleiben erhalten.

## Interaktive Chronik

Unter Chronik steuert ein ausdrücklich gewählter Lesestand die Figurenkarten und Gegenstandschroniken. Der Stand bleibt lokal im Browser und wird durch Kapitelwechsel nicht erhöht. `gestaltung/chronik.json` enthält Namen, belegte Textstellen, datierte Fakten, Beziehungen und Besitzwechsel. Eine Namensnennung ist keine behauptete persönliche Begegnung. Die beiden Fammek-Einträge bleiben getrennt; ihre Identität ist nicht gesichert.

Porträts können aus bestehenden Gemälden stammen. `portrait.ausschnitt` ist `[links, oben, breite, hoehe]` in Prozent der unveränderten Bilddatei. `ab_kapitel` verhindert, dass ein späteres Aussehen früher verraten wird. Für noch nicht abgestimmte Gesichter bleiben neutrale Initialen sichtbar. Die kleinen Kreise und die vergrößerten Figurenkarten verwenden dieselbe Quelle. Taus Einzelporträt zeigt seine beschriebene, gedämpft rötliche Iris.

Fünf Gemälde besitzen erste, optional einschaltbare Erkundungspunkte. Weitere Punkte werden nach Bildprüfung als Prozentkoordinaten in `gemalde` ergänzt. Ein Gegenstandskatalogeintrag ist erst mit vollem Lesestand verlinkt; die datierten Besitzwechsel werden schon vorher gefiltert angezeigt.

Die acht ergänzenden Erzählpassagen erhalten über `gestaltung/erzaehlkaesten.json` und den gemeinsamen Browser/PDF-Parser ihre cremefarbene, braun gerahmte Gestaltung. Wortlaut und alte Sprungmarken bleiben erhalten.

Die PDF verwendet verkleinerte JPEG-Kopien im Exportcache; die Quelldateien bleiben vollständig erhalten. Für größere Druckbilder können `TAGEBUCH_PDF_BILDKANTE` und `TAGEBUCH_PDF_JPEG_QUALITAET` erhöht werden. Die normale Versandfassung nutzt 900 Pixel an der langen Kante und JPEG-Qualität 58; Text bleibt scharf als Text gesetzt.
