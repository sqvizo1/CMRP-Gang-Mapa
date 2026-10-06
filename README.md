# CMRP Gang / MC Mapa

Táto verzia je pripravená pre GitHub Pages + Supabase.

## Súbory

- `index.html` – stránka
- `style.css` – vzhľad
- `script.js` – mapa a logika
- `config.js` – Supabase nastavenie
- `supabase.sql` – databáza a bezpečnostné pravidlá
- `gta-map-satellite.jpg` – SEM VLOŽ SVOJ PÔVODNÝ OBRÁZOK MAPY

## Dôležité

Pôvodný obrázok `gta-map-satellite.jpg` nebol medzi nahranými súbormi, preto ho treba pridať ručne do koreňa repozitára.

## Nasadenie

1. Vytvor Supabase projekt.
2. V Supabase Authentication vytvor admin účet.
3. V SQL Editor spusti `supabase.sql` a v ňom zmeň `email@example.com` na e-mail admina.
4. V Supabase zisti Project URL a Publishable key.
5. V `config.js` ich vlož namiesto placeholderov.
6. Vytvor GitHub repository.
7. Nahraj všetky súbory vrátane `gta-map-satellite.jpg`.
8. Zapni GitHub Pages cez Settings → Pages → Deploy from branch → `main` → `/ (root)`.
9. Otvor vygenerovanú GitHub Pages adresu.

## Bezpečnosť

Do `config.js` patrí iba Supabase Project URL a Publishable key.
Nedávaj tam `service_role` ani secret key.

Bežní návštevníci môžu mapu čítať, ale podľa RLS môže meniť dáta iba admin účet určený v SQL politike.
