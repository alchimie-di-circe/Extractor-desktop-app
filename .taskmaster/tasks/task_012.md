# Task ID: 12

**Title:** Brand Management UI e Asset Organization

**Status:** pending

**Dependencies:** 1 ✓, 8

**Priority:** medium

**Description:** Creare l'interfaccia per gestione brand con organizzazione assets, upload documenti brand guidelines per RAG, e configurazione profili social.

**Details:**

1. Creare `src/routes/brands/+page.svelte`:
   - Lista brand cards con logo e stats
   - Modal creazione nuovo brand
2. Creare `src/routes/brands/[brandId]/+page.svelte`:
```svelte
<script>
  import { page } from '$app/stores';
  import { Tabs, TabsContent } from '$lib/components/ui/tabs';
</script>
<Tabs>
  <TabsContent value="assets">
    <!-- Griglia assets del brand -->
  </TabsContent>
  <TabsContent value="guidelines">
    <!-- Upload PDF/docs per RAG indexing -->
  </TabsContent>
  <TabsContent value="social">
    <!-- Configurazione account social -->
  </TabsContent>
  <TabsContent value="analytics">
    <!-- Dashboard analytics aggregati -->
  </TabsContent>
</Tabs>
```
3. Implementare upload documenti con indexing automatico RAG
4. Creare store brand con SQLite backend
5. Componenti:
   - AssetGrid con filtri e ricerca
   - BrandColorPalette estratta da guidelines
   - SocialAccountConnector per OAuth

**Test Strategy:**

Test CRUD operazioni brand. Test upload e indexing documenti. Test UI per navigazione brand e assets.

## Subtasks

### 12.1. Creazione Route Brands con Lista Brand Cards e Modal Creazione

**Status:** pending  
**Dependencies:** None  

Implementare la pagina principale `src/routes/brands/+page.svelte` con griglia di BrandCard per ogni brand registrato, includendo logo, statistiche e azioni rapide. Creare il modal per l'inserimento di nuovi brand con form validation.

**Details:**

1. Creare `src/routes/brands/+page.svelte` con layout griglia responsiva CSS Grid/Flexbox
2. Implementare componente `BrandCard.svelte` che mostra: logo brand, nome, numero assets, data ultima modifica, badge stato
3. Creare `CreateBrandModal.svelte` con form shadcn (Input, Button, Dialog):
   - Campo nome brand (required, min 2 caratteri)
   - Upload logo (preview immagine, max 2MB)
   - Descrizione opzionale
   - Selezione colore primario
4. Aggiungere bottone 'Nuovo Brand' che apre il modal
5. Implementare stati empty state quando non ci sono brand
6. Collegare al brandStore per fetch lista brands all'onMount
7. Gestire loading states e error handling con toast notifications

### 12.2. Implementazione Route brands/[brandId] con Sistema Tabs

**Status:** pending  
**Dependencies:** 12.1  

Creare la pagina dettaglio brand dinamica `src/routes/brands/[brandId]/+page.svelte` con navigazione a tabs per assets, guidelines, social accounts e analytics dashboard.

**Details:**

1. Creare `src/routes/brands/[brandId]/+page.svelte` con estrazione brandId da $page.params
2. Implementare header brand con logo grande, nome, descrizione, edit button
3. Configurare shadcn Tabs con 4 TabsContent:
   - 'assets': placeholder per AssetGrid
   - 'guidelines': placeholder per upload documenti
   - 'social': placeholder per SocialAccountConnector
   - 'analytics': placeholder per dashboard metriche
4. Implementare URL persistence del tab attivo via query params (?tab=assets)
5. Aggiungere page.ts per load function che fetcha dati brand
6. Gestire 404 per brandId inesistente con redirect o error page
7. Implementare breadcrumb navigation (Home > Brands > [Brand Name])
8. Loading skeleton states per ogni tab durante fetch dati

### 12.3. Sistema Upload Documenti con RAG Indexing Automatico

**Status:** pending  
**Dependencies:** 12.2  

Implementare l'interfaccia upload documenti brand guidelines (PDF, DOCX, MD) nel tab guidelines con pipeline di indexing automatico nel sistema RAG per ricerca semantica.

**Details:**

1. Creare `GuidelinesUploader.svelte` nel tab guidelines con:
   - Drag & drop zone per file upload
   - Supporto formati: PDF, DOCX, MD, TXT
   - Preview lista documenti caricati con metadata
   - Progress bar durante upload e indexing
2. Implementare IPC handler 'documents:upload' in main process:
   - Salvataggio file in cartella brand-specific
   - Estrazione testo con librerie appropriate (pdf-parse, mammoth)
3. Creare pipeline RAG indexing:
   - Chunking documenti (500-1000 token per chunk con overlap)
   - Generazione embeddings via provider LLM configurato
   - Storage in vector database locale (sqlite-vec o chromadb)
4. UI per visualizzare stato indexing per ogni documento
5. Bottone per ri-indicizzare documento modificato
6. Delete documento con rimozione da vector store

### 12.4. Store Brand con SQLite Backend via IPC

**Status:** pending  
**Dependencies:** None  

Creare lo store Svelte reattivo per gestione stato brands con persistenza SQLite tramite comunicazione IPC con main process Electron, includendo schema database e operazioni CRUD complete.

**Details:**

1. Definire schema SQLite in `electron/database/schema.sql`:
   - Tabella `brands` (id, name, logo_path, description, primary_color, created_at, updated_at)
   - Tabella `brand_assets` (id, brand_id FK, file_path, type, metadata_json, created_at)
   - Tabella `brand_documents` (id, brand_id FK, file_path, indexed_at, chunks_count)
2. Creare `electron/ipc/brandHandlers.ts` con handlers:
   - 'brands:list' -> SELECT con paginazione
   - 'brands:get' -> SELECT by id con relazioni
   - 'brands:create' -> INSERT con validazione
   - 'brands:update' -> UPDATE con timestamp
   - 'brands:delete' -> DELETE con cascade assets/documents
3. Creare `src/lib/stores/brandStore.ts` con Svelte writable:
   - State: { brands: Brand[], loading: boolean, error: string | null, selectedBrand: Brand | null }
   - Actions: fetchBrands(), getBrand(id), createBrand(data), updateBrand(id, data), deleteBrand(id)
4. Implementare caching locale e invalidation strategy
5. Gestire optimistic updates per UX migliore

### 12.5. Componenti AssetGrid, BrandColorPalette e SocialAccountConnector

**Status:** pending  
**Dependencies:** 12.2, 12.4  

Implementare i tre componenti UI principali: griglia assets con filtri e virtual scrolling, estrattore palette colori da guidelines, e connettore OAuth per account social.

**Details:**

1. Creare `AssetGrid.svelte`:
   - Griglia responsiva con virtual scrolling (svelte-virtual-list o tanstack-virtual)
   - Filtri per tipo asset (immagine, video, documento)
   - Ricerca full-text per nome/tag
   - Selezione multipla con bulk actions (delete, export, tag)
   - Preview lightbox per immagini
   - Ordinamento per data, nome, dimensione
2. Creare `BrandColorPalette.svelte`:
   - Estrazione automatica colori dominanti da logo/guidelines (color-thief o vibrant.js)
   - Display palette con hex/rgb values
   - Copy to clipboard per ogni colore
   - Salvataggio palette custom nel brand
3. Creare `SocialAccountConnector.svelte`:
   - Card per ogni piattaforma (Instagram, TikTok, YouTube, Facebook)
   - Stato connesso/disconnesso con icone
   - Bottone Connect che avvia OAuth flow
   - Display account name e avatar quando connesso
   - Bottone Disconnect con conferma
   - Placeholder per piattaforme non ancora implementate
