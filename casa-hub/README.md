# Casa — Hub Digitale (MVP)

L'hub digitale della casa che il proprietario apre dopo il **tap su un totem NFC**.
Dopo una password vede: documenti dell'immobile, valore stimato, assistente, e può
**caricare file propri** (garanzie, fatture lavori, foto, note, letture contatori)
che restano salvati nel **cloud (Supabase)** e sono visibili da qualsiasi dispositivo
con accesso a quella casa.

Sito **statico** (HTML/CSS/JS, nessun build) + **Supabase** (storage + database).
Pensato per girare su **GitHub Pages**.

---

## Cosa è collegato a Supabase

Tutte le feature passano dal database (tabelle in `supabase/schema.sql`):

| Feature nell'app            | Tabella / Storage         |
|-----------------------------|---------------------------|
| Dati casa + valore stimato  | `properties`              |
| Documenti (agenzia)         | `documents` (+ storage)   |
| Aggiunti da te (upload)     | `items` (+ storage privato) |
| Foto caricate → galleria    | `items` + `casa-files`    |
| Pulsanti "Contattaci"       | `leads`                   |
| Sblocco con password        | `access_log`              |

> Le foto dell'immobile nella galleria sono asset locali in `assets/home/` (contenuto
> "listing" dell'agenzia). Si possono spostare in una tabella `property_photos` in seguito.
> L'assistente è un bot esterno (sviluppato a parte): qui è una demo offline.

## Dati della casa di esempio

Foto reali + dati ricavati dall'APE (documento nello zip). Si modificano in
`supabase/schema.sql` (seed) e in `supabase.js` (fallback):

- Indirizzo (reale, da APE): *Viale Marco Fulvio Nobiliore 50, 00178 Roma — zona Tuscolano*
- Tipologia: *Monolocale, 32 m²* (piano 4, int. 15; anno 1965)
- APE (reale): *Classe D, valido fino al 17/06/2035*
- Valore stimato: *€ 110.000* (range € 98.000 – € 122.000) — **stima da confermare**

**Accesso demo:** password `XY*362941` · PIN documenti protetti `2580`.

## Funziona così

- **Lock con password** all'apertura (MVP: lato client).
- **Documenti dell'agenzia** (demo) con apertura tramite PIN.
- **Valore stimato** (dati della casa, modificabili nel DB).
- **Aggiungi**: carica un file → va su Supabase Storage (bucket privato) e compare nella lista. Le foto finiscono anche nella galleria. I file si aprono con **link firmati temporanei**.
- **Elimina**: solo su conferma esplicita dell'utente.
- **Assistente**: demo offline con risposte sui dati della casa.
- **PWA**: installabile, shell in cache per apertura rapida.

---

## Setup (5 minuti)

### 1. Database Supabase
1. Crea un progetto su [supabase.com](https://supabase.com).
2. Apri **SQL Editor → New query**, incolla il contenuto di [`supabase/schema.sql`](supabase/schema.sql) e premi **Run**.
   Crea le tabelle `properties` e `items`, la casa di esempio, il bucket privato `casa-files` e le policy.

### 2. Chiavi nel client
In **Project Settings → API** copia:
- **Project URL** → `SUPABASE_URL`
- **anon / publishable key** → `SUPABASE_ANON_KEY`

Incollale in [`config.js`](config.js).

> ⚠️ Usa **solo** la chiave *anon / publishable*. **Mai** la `service_role` o la `secret`
> (`sb_secret_…`): danno accesso completo bypassando le regole di sicurezza e non vanno
> mai messe in codice che gira nel browser.

### 3. Avvio locale
Serve un server HTTP (il service worker non parte da `file://`):
```bash
npx serve .
# oppure
python3 -m http.server 8080
```
Apri `http://localhost:8080` e sblocca con la password (`XY*362941`).

### 4. Deploy su GitHub Pages
1. Crea il repo e fai push di questa cartella.
2. **Settings → Pages → Source: deploy from branch** → `main` / root.
3. Apri l'URL `https://<utente>.github.io/<repo>/`.

I percorsi sono relativi (`./`), quindi funziona anche sotto sottocartella.

---

## Struttura

```
casa-hub/
├─ index.html        # struttura della pagina
├─ styles.css        # design (mobile-first, stile iOS, isola liquid glass)
├─ config.js         # URL + anon key + password (da compilare)
├─ config.example.js # template
├─ supabase.js       # data layer: upload, lista, link firmati, elimina
├─ app.js            # logica UI: lock, galleria, upload, chat, nav
├─ manifest.webmanifest, sw.js, assets/  # PWA + icone
└─ supabase/schema.sql  # tabelle, bucket e policy
```

Per cambiare backend in futuro basta riscrivere `supabase.js` (l'app usa solo `window.Data`).

---

## Sicurezza — stato attuale e prossimi passi

Questo è un **MVP**. Limiti noti, da chiudere prima della produzione:

- **Password lato client**: chi guarda il codice la vede. In produzione va verificata
  lato server insieme alla firma del tag NFC (CMAC dell'NTAG424, vedi documento di progetto).
- **RLS permissiva**: con la anon key chiunque può leggere/scrivere gli `items`.
  Hardening: legare l'accesso a un token per-casa o all'autenticazione, e restringere
  le policy per `property_id`.
- **Bucket privato + link firmati**: già attivo (i file non sono pubblici).
- Aggiungere validazione di tipo/dimensione dei file e rate limiting.

---

## Roadmap

1. Verifica del tag NTAG424 (SUN/SDM) lato server prima di mostrare l'hub.
2. Autenticazione/permessi per proprietario e agenzia.
3. Pannello agenzia per registrare immobili e caricare i documenti.
4. Modulo Forniture (POD/PDR) e Manutenzioni.
5. Valutazione collegata ai dati OMI / AVM.
