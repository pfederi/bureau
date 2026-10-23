# Anleitung

Der Admin-Bereich verwaltet deine Kunden, Zeiten, Offerten, Rechnungen und Ausgaben. Diese Anleitung beschreibt die Funktionen in der Reihenfolge der Navigation.

## Erste Schritte

### Anmelden
- Unter `/admin` mit E-Mail und Passwort anmelden. Passwortmanager werden unterstützt.
- Danach fragt die Anmeldung nach dem **6-stelligen Code** aus deiner Authenticator-App (zum Beispiel 1Password, Google Authenticator oder Authy). Sobald sechs Ziffern im Feld stehen, wird der Code geprüft; 1Password kann ihn auch direkt einsetzen.
- Die **Navigation** steht links in der Seitenleiste, gruppiert nach Themen. Oben stehen dein Name und deine E-Mail-Adresse, unten Einstellungen, Anleitung und **Abmelden**.
- Der Knopf ganz unten schaltet die Seitenleiste **schmal** (nur Symbole) oder **breit**. Wird das Fenster knapp, wird sie automatisch schmal.
- Der Pfeil neben **Kunden** klappt die Liste aller Kunden auf. Ein Klick auf einen Namen öffnet direkt sein Kunden-Dashboard.
- Auf dem Handy öffnet der Menü-Knopf oben links dieselbe Seitenleiste.

### Automatische Abmeldung
- Nach **15 Minuten ohne Aktivität** (Klicken, Tippen, Scrollen, Maus bewegen) wirst du abgemeldet. Eine Minute vorher erscheint unten rechts ein Hinweis; ein Klick auf **Angemeldet bleiben** oder irgendeine Eingabe genügt, damit es weitergeht. Arbeitest du in einem anderen Admin-Tab, bleiben alle offenen Tabs angemeldet.
- Beendest du den **Browser**, ist die Anmeldung weg. Schliesst du nur den **Tab** (oder ist die Seite länger als 5 Minuten im Hintergrund, etwa auf dem Handy in einer anderen App), musst du dich beim nächsten Aufruf neu anmelden.
- Die Abmeldung gilt nur für diesen Browser. Auf anderen Geräten bleibst du angemeldet; **Abmelden** in der Seitenleiste meldet dagegen überall ab.
- Nach einer automatischen Abmeldung steht auf der Anmeldeseite, warum. Was du nicht gespeichert hast, ist dann verloren – längere Texte also zwischendurch speichern.

### Zwei-Faktor-Anmeldung
- Beim ersten Login richtest du die Authenticator-App ein: Gerät benennen, **QR-Code anzeigen**, QR-Code scannen (oder den Schlüssel eintippen) und den ersten Code bestätigen. Ohne diesen Schritt geht es nicht weiter.
- Unter **Einstellungen → Passwort** änderst du dein Passwort (mindestens 10 Zeichen). Dafür brauchst du das aktuelle Passwort, angemeldet bleibst du trotzdem.
- Unter **Einstellungen → Zwei-Faktor-Anmeldung** fügst du weitere Geräte hinzu oder entfernst sie. Richte am besten ein zweites ein, zum Beispiel deinen Passwortmanager, damit du auch ohne Handy hineinkommst. Das letzte Gerät lässt sich nicht entfernen.
- Statt der App geht auch ein **Passkey** (Touch ID, Face ID oder Sicherheitsschlüssel): bei der Einrichtung „Oder mit Passkey“, später unter **Einstellungen → Passkey hinzufügen**. Bei der Anmeldung gibst du wie bisher E-Mail und Passwort ein; danach fragt der Browser bzw. 1Password gleich nach dem Passkey. Falls nicht, hilft **Mit Passkey bestätigen**. Ist zusätzlich die Authenticator-App eingerichtet, erscheint ihr Code-Feld erst, wenn der Passkey nicht klappt oder du **Stattdessen Code eingeben** wählst. Passkeys gelten nur für die Domain, auf der sie eingerichtet wurden; lokal (localhost) kommt deshalb direkt das Code-Feld. Der Passkey ersetzt also den zweiten Schritt, nicht das Passwort.
- **Wochenmail:** Jeden Montag kommt eine Übersicht mit Todos, offenen Rechnungen, unverrechneten Stunden und der Rücklage an deine Absender-Adresse.
- Hast du alle Geräte verloren, lässt sich die Zwei-Faktor-Anmeldung nur über die Datenbank zurücksetzen: im SQL-Editor von Supabase `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'du@example.ch');` mit deiner Login-Adresse ausführen. Beim nächsten Login richtest du die Zwei-Faktor-Anmeldung neu ein.

### Einstellungen zuerst
- **Datensicherung herunterladen** (Einstellungen) erstellt eine ZIP-Datei mit allen Daten als JSON und CSV, allen Belegen und den Rechnungen als PDF. Am besten einmal im Jahr zusammen mit den Steuerunterlagen ablegen.
- Unter **Einstellungen** (unten in der Seitenleiste) Absender, Adresse, Bankverbindung, IBAN, Standard-Stundensatz und MWST-Hinweis erfassen.
- Diese Angaben erscheinen auf jeder Rechnung und Offerte. An die Absender-Adresse geht beim Versand ausserdem eine Kopie jeder E-Mail.
- Nach **Speichern** bestätigt ein Häkchen im Knopf. Ist ein Wert ungültig (z. B. Grenzsteuersatz über 60 %), nennt ein Hinweis das Feld; gespeichert wird dann nichts.

## Dashboard
- **Todos** sammelt, was liegen geblieben ist: Rechnungen, die über 30 Tage offen sind (mit **Erinnern**, das nach einer Rückfrage die Zahlungserinnerung schickt), Offerten, die bald ablaufen oder abgelaufen sind, Entwürfe, die seit über einer Woche liegen, Stunden, die seit über einem Monat nicht verrechnet sind, fehlende Belege wiederkehrender Ausgaben, Hosting, das für das laufende oder letzte Jahr noch nicht verrechnet ist (ein Klick öffnet die Hosting-Rechnungen mit dem Jahr vorgewählt), Stundenbudgets ab 80 % und überwachte Websites, die nicht erreichbar sind oder deren SSL-Zertifikat bzw. Domain bald abläuft. Dringendes steht zuoberst und ist amber markiert. An dieselbe Rechnung erinnert die App frühestens nach 14 Tagen wieder.
- **Rücklage** schätzt, wie viel du für AHV/IV/EO und Einkommenssteuer auf dem Gewinn des laufenden Jahres zur Seite legen solltest; ein Klick öffnet die Aufschlüsselung im Jahresabschluss. Den Grenzsteuersatz stellst du unter **Einstellungen** ein.
- **Jahresvergleich** zeigt Einnahmen (nach Zahlungseingang) und Ausgaben pro Jahr als Balken, darunter den Gewinn, wie im Jahresabschluss.
- **Gesamtverdienst** und **Verdienst** des laufenden Jahres zählen bezahlte Rechnungen nach Rechnungsdatum.
- **Ausgaben** zeigt die Summe der Ausgaben im laufenden Jahr und wie viele Belege erfasst sind. Ein Klick öffnet die Ausgaben des Jahres.
- **Offen** zeigt, was noch nicht bezahlt ist, und listet die ältesten offenen Rechnungen mit den Tagen seit dem Versand. Mehr als 30 Tage offene Rechnungen sind amber markiert.
- **MWST-Status** vergleicht den verrechneten Umsatz des Jahres mit der Grenze von Fr. 100 000.00. Ab 80 % erscheint ein Hinweis zur Anmeldung.
- **Zahlungsverlauf** und **Stundenverlauf** zeigen die letzten 12 Monate, aufgeteilt nach Kunde. Fährst du über einen Balken oder steuerst ihn mit der Tabulatortaste an, erscheinen die Werte pro Kunde.
- **Stunden** zeigt die gearbeiteten Stunden des Jahres, die noch nicht verrechneten Stunden pro Kunde mit ihrem Wert und die Stundenbudgets. Ein Klick auf einen Kunden öffnet seine offenen Zeiteinträge.

## Zeiterfassung

### Einträge erfassen
- **Neuer Eintrag** öffnet einen Dialog mit Datum, Kunde, **Projekt** (optional, mit Vorschlägen aus den bisherigen Projekten), Beschreibung, Stunden und Stundensatz. Ist oben ein Kunde gefiltert, ist er schon ausgewählt.
- Das **Kopier-Symbol** in einer Zeile legt einen neuen Eintrag als Kopie mit heutigem Datum an, praktisch für wiederkehrende Arbeiten.
- Über das **„…“-Menü** bearbeitest oder löschst du offene Einträge. Verrechnete Einträge gehören zu einer Rechnung und bleiben unverändert.

### Filtern
- Filter nach **Kunde**, **Jahr** und **Status** (offen, verrechnet, alle). Bei „Offen“ sind alle Jahre vorgewählt.
- **Filter zurücksetzen** stellt die Standardansicht wieder her.

## Kunden

### Kunden verwalten
- **Neuer Kunde** öffnet das Formular im Dialog: Adresse, E-Mail, Ansprechperson und Grussformel für die Rechnung.
- Die **Adresse** darf mehrere Zeilen haben, zum Beispiel Abteilung, z. H. oder Kostenstelle. Die Strasse gehört in die letzte Zeile, sie steht auch im QR-Zahlteil.
- **Hosting:** Text, Preis pro Monat und aktiver Zeitraum. Daraus entsteht die Hosting-Jahresposition. Verrechnet wird Hosting ab 2026, frühere Jahre gelten als abgegolten.
- **Stundenbudget:** Stunden pro Monat oder Jahr. Das Dashboard warnt ab 80 % und bei Überschreitung.
- Bearbeiten und Löschen stecken im „…“-Menü jeder Zeile.

### Kunden-Dashboard
- Ein Klick auf eine Kundenzeile (oder auf **Konto**) öffnet das Dashboard des Kunden mit Verdienst, offenem Betrag, Stundenbudget und allen Rechnungen.
- **Projekte** zeigt pro Projekt die Stunden, den verrechneten Betrag nach Rabatt und den effektiven Ansatz pro Stunde.
- Von dort aus erstellst du direkt eine **Offerte** oder **Rechnung**, der Kunde ist schon ausgewählt. Über das **„…“-Menü** daneben bearbeitest oder löschst du den Kunden.
- Ein Klick auf eine **Rechnungsnummer** öffnet die PDF-Vorschau mit „In neuem Tab“ und „Herunterladen“.

### Stundenrapport
- **„…“-Menü → Stundenrapport…** zeigt alle Zeiteinträge eines Monats als PDF, nur mit Stunden, ohne Beträge. Vorgeschlagen ist der Vormonat.
- **Vorschau** öffnet das PDF; **An … senden** schickt es an die E-Mail-Adresse des Kunden, mit Kopie an dich. Es geht nie etwas automatisch raus.
- Hat der Kunde ein Stundenbudget, steht der Verbrauch unter dem Total. Wurde der Monat schon gesendet, zeigt der Dialog wann und an wen.

### Kundenlink
- **„…“-Menü → Kundenlink…** erstellt auf Knopfdruck einen privaten Link auf eine Seite für den Kunden: offener Betrag, alle Rechnungen als PDF, Stundenbudget und die Rechnungen wie in deinem Kunden-Dashboard – nur ohne Bearbeiten. Belege und Zeiteinträge sieht er nicht.
- Wer den Link hat, sieht die Seite; Suchmaschinen nehmen sie nicht auf. **Neuer Link** macht den alten ungültig, **Deaktivieren** schaltet die Seite ab. „aktiv“ im Menü zeigt, dass ein Link besteht.

### Websites überwachen
- Auf dem Kunden-Dashboard unter **Websites** die Adresse eintragen (z. B. `kunde.ch`) und **Hinzufügen**; die Seite wird gleich geprüft.
- Danach prüft die App die Erreichbarkeit alle 15 Minuten, SSL-Zertifikat und Domain-Ablauf einmal pro Tag. Nach zwei Fehlschlägen in Folge gilt eine Seite als nicht erreichbar: Du bekommst eine Mail, ebenso wenn sie wieder läuft, und sie steht in den Todos.
- Läuft das Zertifikat in 14 Tagen oder die Domain in 30 Tagen ab, erscheint ein Todo. Bei `.ch`- und `.li`-Domains gibt die Registry kein Ablaufdatum heraus – deren Verlängerung meldet der Hinweis auf fehlende Belege.
- **Jetzt prüfen** prüft sofort alles (ohne Mail), **✕** beendet die Überwachung.

## Rechnungen

### Rechnung erstellen
- **Neue Rechnung:** Typ (pauschal oder nach Stundenaufwand), Kunde, Rechnungs- und Leistungsdatum, Positionen.
- Bei Stunden-Rechnungen übernimmt **Aus Zeiterfassung** offene Einträge des Kunden. Der Stundensatz lässt sich pro Eintrag anpassen.
- **Hosting übernehmen** fügt das Hosting eines Jahres als Position hinzu, anteilig nach aktiven Monaten. Wurde es für das Jahr schon verrechnet, erscheint eine Warnung.
- **Rabatt** in Prozent wirkt auf das Total.
- Gespeichert wird zuerst ein **Entwurf**. Entwürfe lassen sich bearbeiten und löschen.

### Hosting für alle Kunden
- **Hosting-Rechnungen** auf der Rechnungsseite erstellt für ein gewähltes Jahr die Entwürfe aller Kunden mit Hosting auf einmal.
- Bereits verrechnete Kunden sind markiert und nicht vorgewählt.

### Versenden und Zahlung
- Im Dialog **Aktionen** einer Rechnung: PDF-Vorschau, Herunterladen und **Senden** per E-Mail. Das PDF enthält den Schweizer QR-Zahlteil.
- Ist die Zahlung eingegangen, setzt du den Status auf **Bezahlt**.
- **Erinnerung senden** schickt bei offenen Rechnungen eine freundliche Zahlungserinnerung mit dem PDF. Das Datum der letzten Erinnerung steht in der Liste.

### Stornieren
- **Stornieren** gibt es bei versendeten oder bezahlten Rechnungen. Die Rechnung zählt danach nicht mehr zu Umsatz und MWST, und ihre Zeiteinträge werden wieder offen.
- Mit **Korrigierte Kopie als Entwurf erstellen** entsteht gleich eine neue Rechnung mit denselben Positionen, die Zeiteinträge wandern dorthin.

## Offerten
- **Neue Offerte:** Kunde, Offertdatum, Gültigkeit (standardmässig 30 Tage), Positionen, Rabatt und ein freier Text, zum Beispiel für Leistungsbeschrieb oder Termine.
- Das PDF hat keinen Einzahlungsschein. **Senden** verschickt es per E-Mail.
- Markiere Offerten als **angenommen** oder **abgelehnt**. Abgelaufene, noch offene Offerten sind in der Liste markiert.
- **In Rechnung umwandeln** erstellt einen Rechnungsentwurf mit denselben Positionen und öffnet ihn.


## Ausgaben und Jahresabschluss

### Ausgaben erfassen
- Unter **Ausgaben** öffnet **Neue Ausgabe** einen Dialog: Datum, Betrag, Beschreibung, Lieferant, Kategorie und Beleg.
- Lade zuerst den **Beleg** hoch (PDF oder Foto, bis 10 MB): Datum, Betrag, Währung, Lieferant, Beschreibung und Kategorie werden daraus vorgeschlagen. Prüfe die Felder vor dem Speichern. Gescannte PDFs ohne Text und HEIC-Fotos lassen sich nicht auslesen.
- **Duplikat-Prüfung:** Gibt es schon eine Ausgabe mit derselben Belegnummer, derselben Beleg-Datei oder demselben Datum und Betrag, erscheint ein Hinweis mit den Treffern. Ist es keine doppelte Ausgabe, speicherst du mit **Trotzdem speichern**.
- **Euro und Dollar:** Wähle die Währung und gib den Originalbetrag ein. Der Betrag in Franken wird zum Tageskurs der Europäischen Zentralbank vorgeschlagen (am Wochenende der Kurs des letzten Werktags). Weicht deine Abrechnung ab, überschreibst du ihn; **Kurs übernehmen** stellt den Vorschlag wieder her. Im Jahresabschluss zählt der Betrag in Franken.
- Der Beleg wird privat gespeichert und öffnet sich über **Öffnen** in der Liste. Belege müssen 10 Jahre aufbewahrt werden.
- **Fehlende Belege?** Kommt eine Ausgabe regelmässig (monatlich oder jährlich, mit gleichem Lieferanten und gleicher Beschreibung), meldet die Seite, wenn der nächste Beleg fehlt. **Erfassen** öffnet den Dialog mit Datum, Lieferant, Beschreibung, Kategorie und letztem Betrag; **✕** blendet einen Hinweis aus, etwa wenn etwas gekündigt ist – auch in den Todos auf dem Dashboard und in der Wochenmail, auf allen Geräten. Erfasst du später wieder einen Beleg dieser Ausgabe, meldet sich der Hinweis beim nächsten Ausbleiben erneut.
- Erfasse nur geschäftlich begründete Kosten.
- Filter nach Jahr und Kategorie; bearbeiten und löschen über das „…“-Menü.

### Jahresabschluss
- **Jahresabschluss** auf der Ausgaben-Seite zeigt Einnahmen, Ausgaben und Gewinn eines Jahres mit Vergleich zum Vorjahr.
- **Einnahmen** zählen nach Zahlungseingang: Rechnungen, die im Jahr bezahlt wurden. Stornierte Rechnungen zählen nie. Am 31.12. noch offene Rechnungen stehen separat und zählen im Jahr der Zahlung.
- Ein Hinweis zeigt, ob der Gewinn über der AHV-Grenze für den Nebenerwerb liegt.
- **Rücklage für AHV und Steuern** schlüsselt auf: AHV/IV/EO nach den Ansätzen 2026 (sinkende Skala, bei angestelltem Hauptberuf ab 5.371 %), Verwaltungskosten der Ausgleichskasse und Einkommenssteuer zum Grenzsteuersatz aus den Einstellungen. Eine Schätzung, keine Veranlagung.
- **PDF** legst du der Steuererklärung bei (Hilfsblatt A), die **CSV** öffnet sich direkt in Excel, zum Beispiel für die Treuhänderin.
- **Steuerpaket** lädt alles zum Jahr als ZIP: Jahresabschluss als PDF und CSV, die Belege der Ausgaben (benannt nach Datum, Lieferant und Betrag), die im Jahr bezahlten Rechnungen. Die Datei LIESMICH.txt fasst zusammen und listet Ausgaben ohne Beleg.

## Suche und Tastatur
- Die **Suche** oben in der Seitenleiste (auf dem Handy oben rechts) findet Kunden, Rechnungen, Offerten und Zeiteinträge. Öffnen mit ⌘K bzw. Ctrl+K oder mit `/`.
- In den Treffern wählst du mit den Pfeiltasten und öffnest mit Enter.
- Mit der Tabulatortaste erreichst du alle Bedienelemente. Ganz oben führt **Zum Inhalt springen** an der Navigation vorbei.


## Darstellung
- Beträge stehen in der Schreibweise des Bundes mit zwei Nachkommastellen, zum Beispiel `Fr. 12 500.00`. Datum als `07.10.2026`.
- Auf dem Computer bleiben beim Scrollen der **Seitenkopf** (Titel, Knöpfe, Filter) und der **Tabellenkopf** oben stehen; der Seitenkopf wird dabei kompakter. Auf dem Handy scrollt alles normal mit; dort stecken die Filter hinter dem Knopf **Filter**, der die aktuelle Auswahl kurz anzeigt.
- Kleine **Animationen** zeigen Änderungen: Balken wachsen beim Laden, Bereiche klappen weich auf, ein Häkchen bestätigt Kopieren und Speichern, erledigte Todos gleiten weg, eine dünne Linie oben zeigt, dass eine Seite lädt, und ein roter Punkt pulsiert kurz bei einer ausgefallenen Website. Ist auf dem Gerät «Bewegung reduzieren» eingeschaltet (Bedienungshilfen), bleibt alles ruhig.
- In Zahlenfeldern gilt der Punkt als Dezimalzeichen. Tippst du ein Komma, wird es automatisch zum Punkt.
