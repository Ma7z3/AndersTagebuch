# Die Reisen des Ander Holimion

Das Tagebuch unserer Abenteuerrunde. Fertige Kapitel sind die gemeinsame Quelle für die Leseausgabe und das vollständige Buch-PDF.

## Lesen und herunterladen

Die Website wird über GitHub Pages veröffentlicht. Der Knopf **PDF herunterladen** enthält dieselben fertigen Kapitel wie die Website. Er lädt die zuletzt erfolgreich erzeugte Buchfassung mit eingebetteten Schriften und Bildern.

## Ein fertiges Kapitel ergänzen

Eine neue Markdown-Datei in **eintraege/** hinzufügen, zum Beispiel **47-fortsetzung.md**. Die erste Überschrift wird als Titel übernommen. Neue Texte werden in der alphabetischen Reihenfolge ihrer Dateinamen vor den Addenda eingeordnet. Vorhandene Kapitel können unter **inhalte/** bearbeitet werden.

Bilder nach **bilder/** legen und im Text mit `![Beschreibung](bilder/dateiname.png)` einbinden. Bild und Erklärung bleiben im Buch zusammen, wenn sie als gemeinsamer Infokasten oder Bild mit anschließender Bildlegende aufgebaut sind. Die Legenden der vorhandenen Illustrationen liegen in **gestaltung/bildlegenden.json**.

Nach dem Speichern auf dem Zweig **main** erstellt GitHub Actions Website und PDF automatisch gemeinsam. Inhaltsverzeichnis, Seitenzahlen und interne Seitenverweise werden neu berechnet. Schlägt ein Aufbau fehl, wird diese Fassung nicht veröffentlicht; die vorige Ausgabe bleibt bestehen. Größere Änderungen am Satz bitte anhand der erzeugten PDF visuell prüfen.

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

Die Sprachprüfung ist noch nicht abgeschlossen. Der Spielabend vom 21.09.2026 befindet sich noch in der gemeinsamen Ausarbeitung und ist nicht Teil des Buchs.

## Reiseatlas

Unter **Karten** lassen sich 28 Hauptstationen der Kapitel 1–46 auf Faerûn und in einer Ebenenansicht verfolgen. Die Karte ist © 2015 Wizards of the Coast; Quelle und Einordnung stehen in der Ansicht. Teilweise sind nur Reiseregionen belegt. Neue Stationen werden nach inhaltlicher Prüfung in **karten/reise.json** ergänzt; die Position eines neuen Kapitels wird nicht erfunden.
