# BBFRAXY

Osobní web FraXyho — jedno místo pro hry, nástroje, projekty, experimenty a další věci.

🌐 **Web:** https://bbfraxy.com/

## Co BBFRAXY aktuálně obsahuje

### 🎮 Games
Sekce Games obsahuje vlastní hry a interaktivní experimenty převedené přímo na BBFRAXY:

- **FraXy´s Trivia** — deskový vědomostní kvíz s kategoriemi, náhodnými otázkami, časovým limitem a výsledkem.
- **FraXyho soutěž** — tipovací soutěž po mapě Evropy. Uživatel vybírá státy, zadává číselné odhady a získává body podle přesnosti.
- **Riskuj** — společenská vědomostní hra pro více hráčů/týmů. Obsahuje klasický režim i rozšířenou variantu s vlastním kvízem, kvíz builderem, více hráči, časovačem, pokročilým nastavením, kolem rozhodnutí při remíze a přehledem výsledků.
- **FraXy´s Wild West Quiz** — externě hostovaný kvíz vytvořený v Combos. Do budoucna může být přesunut přímo na BBFRAXY po dostupnosti exportu.

Herní stránky používají společný BBFRAXY vizuální systém a podporují přepínání dark/light režimu.

### 🛠 Tools

- **GitHub Simplifier** — připravovaný nástroj pro analýzu GitHub repozitářů. Cílem je převést strukturu repozitáře do srozumitelného přehledu, vysvětlit důležité soubory a zjednodušit orientaci v projektu.

### 📦 Downloads
Sekce Downloads slouží pro připravované i dostupné projekty ke stažení. Aktuálně je zde uveden:

- **Valheim Session Chronicle** — client-side mod pro Valheim, který zaznamenává herní session a vytváří textové reporty v češtině s možností JSON exportu. Aktuálně je veden jako development a ke stažení bude později.

### 🧩 Projects
Samostatná sekce pro projekty a větší experimenty, které nejsou pouze samostatným nástrojem nebo hrou.

### 🔐 Privacy
BBFRAXY obsahuje stránku `/privacy/` s informacemi o lokálním úložišti, cookies a externích službách.

## Technický základ

BBFRAXY je statický web postavený především na HTML, CSS a JavaScriptu. Jednotlivé hry a nástroje mají vlastní soubory a u větších projektů je kód rozdělený do více modulů, aby zůstal přehledný a snadno udržovatelný.

Společný vizuální základ poskytuje hlavní BBFRAXY CSS/JS systém, včetně:

- dark/light režimu,
- společné navigace,
- responzivního layoutu,
- sdílených UI prvků,
- GitHub odkazu,
- nenápadného odkazu na Privacy v patičce.

### Použité technologie a knihovny

Podle konkrétní stránky se používají například:

- HTML / CSS / JavaScript
- Leaflet + OpenStreetMap pro mapovou soutěž
- html2canvas pro export výsledků do PNG
- externí knihovny načítané přes CDN tam, kde je to potřeba

## Struktura

```text
/
├── games/
│   ├── trivia/
│   ├── fraxy-soutez/
│   ├── riskuj/
│   └── ...
├── tools/
├── downloads/
├── privacy/
├── assets/
└── index.html
```

Větší hry jsou rozdělené na samostatné HTML, CSS a JavaScript části. Herní data jsou podle potřeby oddělená od herní logiky.

## Stav projektu

BBFRAXY je průběžně vyvíjený osobní projekt. Některé části jsou hotové a použitelné, jiné jsou stále ve vývoji nebo slouží jako experimentální základ pro další funkce.

## Licence

Licence projektu není v současné době v tomto repozitáři specifikována.
