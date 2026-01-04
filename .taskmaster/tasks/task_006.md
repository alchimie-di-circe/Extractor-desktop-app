# Task ID: 6

**Title:** Agente Estrazione con osxphotos Integration

**Status:** pending

**Dependencies:** 4, 5

**Priority:** high

**Description:** Implementare l'agente di estrazione foto che utilizza osxphotos per accedere alla libreria Apple Photos locale, con preservazione EXIF e suggerimenti AI per tag.

**Details:**

1. Installare osxphotos in ambiente Python: `pip install osxphotos`
2. Creare `python/agents/extraction_agent.py`:
```python
import osxphotos
from typing import List, Dict

class ExtractionAgent:
    def __init__(self, photos_db_path: str = None):
        self.photosdb = osxphotos.PhotosDB(dbfile=photos_db_path)
    
    async def list_albums(self) -> List[str]:
        return [a.title for a in self.photosdb.album_info]
    
    async def extract_photos(
        self, 
        album_name: str = None,
        date_range: tuple = None,
        dest_path: str = None
    ) -> List[Dict]:
        photos = self.photosdb.photos(albums=[album_name] if album_name else None)
        results = []
        for photo in photos:
            photo.export(dest_path, exif=True)
            results.append({
                'uuid': photo.uuid,
                'filename': photo.original_filename,
                'exif': photo.exif_info,
                'labels': photo.labels,
                'faces': [f.name for f in photo.face_info]
            })
        return results
```
3. Creare UI in `src/routes/extract/+page.svelte`:
   - Album browser con tree view
   - Filtri per data, tipo media, persone
   - Griglia preview foto con selezione multipla
   - Progress bar durante estrazione
4. Endpoint FastAPI `/agent/extract` per eseguire estrazione
5. Integrazione con RAG per suggerimenti tag automatici

**Test Strategy:**

Test con mock PhotosDB per evitare dipendenza da libreria reale. Test UI per selezione album e filtri. Test E2E per flusso estrazione completo.

## Subtasks

### 6.1. Setup osxphotos in Ambiente Python e Gestione Permessi macOS Full Disk Access

**Status:** pending  
**Dependencies:** None  

Configurare l'ambiente Python con osxphotos e implementare la gestione dei permessi Full Disk Access richiesti da macOS per accedere alla Photos Library.

**Details:**

1. Creare la struttura directory `python/agents/` se non esiste
2. Creare `python/requirements.txt` con dipendenza osxphotos: `osxphotos>=0.68.0`
3. Installare osxphotos: `pip install osxphotos`
4. Creare script di test `python/agents/test_photos_access.py` per verificare accesso alla libreria
5. Implementare detection dei permessi Full Disk Access mancanti con messaggio user-friendly
6. Creare utility `python/agents/permissions_helper.py` con funzione `check_photos_access()` che restituisce stato permessi
7. Documentare procedura per abilitare Full Disk Access in System Preferences > Privacy & Security > Full Disk Access per l'app Electron/terminale Python
8. Testare accesso a PhotosDB con path di default `~/Pictures/Photos Library.photoslibrary`
9. Gestire gracefully il caso di libreria Photos non esistente o corrotta

### 6.2. Implementazione ExtractionAgent Class con Metodi list_albums e extract_photos

**Status:** pending  
**Dependencies:** 6.1  

Sviluppare la classe ExtractionAgent in Python con i metodi core per elencare album e estrarre foto con preservazione metadata EXIF completa.

**Details:**

1. Creare `python/agents/extraction_agent.py` con classe ExtractionAgent
2. Implementare `__init__(self, photos_db_path: str = None)` che inizializza PhotosDB
3. Creare metodo async `list_albums() -> List[Dict]` che restituisce lista album con titolo, count foto, date range
4. Implementare `async extract_photos(album_name, date_range, dest_path) -> List[Dict]`:
   - Filtraggio per album_name se specificato
   - Filtraggio per date_range (start_date, end_date) opzionale
   - Export con `photo.export(dest_path, exif=True)` per preservare EXIF
   - Restituzione dict con: uuid, original_filename, exif_info, labels (ML detection), faces
5. Aggiungere metodo `get_photo_metadata(uuid: str) -> Dict` per metadata singola foto
6. Implementare gestione errori per foto corrotte o inaccessibili
7. Aggiungere typing completo con TypedDict per return types
8. Supportare filtro per media_type (photo, video, live_photo)

### 6.3. Creazione Endpoint FastAPI /agent/extract con Progress Streaming SSE

**Status:** pending  
**Dependencies:** 6.2  

Implementare l'endpoint FastAPI per l'estrazione foto con supporto Server-Sent Events per progress reporting real-time al frontend.

**Details:**

1. Creare o estendere `python/api/routes/extract.py` con FastAPI router
2. Implementare endpoint `GET /agent/extract/albums` per lista album
3. Creare endpoint `POST /agent/extract/photos` con body: {album_name?, date_range?, dest_path}
4. Implementare SSE streaming con `StreamingResponse` e `async def event_generator()`:
   - Emettere evento 'progress' con {current, total, current_file} durante estrazione
   - Emettere evento 'complete' con lista risultati alla fine
   - Emettere evento 'error' in caso di fallimento
5. Creare schema Pydantic per request/response: ExtractRequest, PhotoResult, ProgressEvent
6. Aggiungere endpoint `GET /agent/extract/photo/{uuid}` per metadata singola foto
7. Implementare cancellation support con abort signal
8. Rate limiting per prevenire richieste multiple simultanee

### 6.4. UI Extract Page con Album Browser Tree View

**Status:** pending  
**Dependencies:** 6.3  

Creare la pagina Svelte per l'estrazione con componente tree view navigabile per sfogliare la struttura album della Photos Library.

**Details:**

1. Creare `src/routes/extract/+page.svelte` con layout a due colonne: sidebar album + area principale
2. Implementare componente `src/lib/components/custom/AlbumTree.svelte` con tree view espandibile
3. Usare shadcn-svelte Collapsible o implementare tree custom con icone folder/chevron
4. Fetch album list da endpoint `/agent/extract/albums` on mount
5. Gestire stati: loading, error, empty con skeleton e messaggi appropriati
6. Implementare selezione album con highlight visivo dell'album corrente
7. Mostrare metadata album: numero foto, date range, icona tipo (smart album, folder, user album)
8. Aggiungere ricerca/filtro album con input search
9. Supportare selezione multipla album con checkbox
10. Persistere stato espansione tree in sessionStorage

### 6.5. Implementazione Griglia Preview con Selezione Multipla e Filtri

**Status:** pending  
**Dependencies:** 6.4  

Sviluppare la griglia di preview foto con virtual scrolling per performance, selezione multipla, e pannello filtri per data, tipo media, e persone riconosciute.

**Details:**

1. Creare componente `src/lib/components/custom/PhotoGrid.svelte` con griglia responsive
2. Implementare virtual scrolling per performance con libreria come svelte-virtual-list o custom IntersectionObserver
3. Ogni thumbnail mostra: preview image, filename, badge tipo (photo/video/live)
4. Selezione multipla con: click singolo toggle, Shift+click range, Ctrl/Cmd+click additive
5. Toolbar con: Select All, Deselect All, count selezionati
6. Creare pannello filtri `src/lib/components/custom/PhotoFilters.svelte`:
   - DateRangePicker per filtro data (usare shadcn Calendar)
   - Select per tipo media: All, Photos, Videos, Live Photos
   - Autocomplete per persone (faces riconosciuti da Photos)
7. Progress bar durante estrazione con eventi SSE
8. Implementare lazy loading thumbnails con placeholder blur
9. Drag selection con mouse per selezione area

### 6.6. Integrazione Preservazione EXIF e Metadata Faces/Labels per Suggerimenti AI

**Status:** pending  
**Dependencies:** 6.2, 6.5  

Implementare la preservazione completa dei metadata EXIF durante export e integrare i dati faces/labels di Apple Photos con il sistema RAG per suggerimenti automatici di tag.

**Details:**

1. Verificare che ExtractionAgent preservi tutti i campi EXIF durante export: GPS, DateTime, Camera, Lens, etc.
2. Creare `python/agents/metadata_extractor.py` per parsing strutturato metadata:
   - EXIF data completo con piexif o exifread
   - Labels ML Apple (scene detection, objects)
   - Face info con nomi persone riconosciute
3. Implementare `src/lib/services/tag-suggestions.ts` per suggerimenti tag:
   - Combinare labels ML + faces + EXIF location
   - Interfaccia con sistema RAG (dipendenza task 5)
4. Creare componente `src/lib/components/custom/TagSuggestions.svelte` che mostra chip suggeriti
5. Endpoint FastAPI `GET /agent/extract/suggestions/{uuid}` per suggerimenti AI per foto
6. Aggiungere modal dettaglio foto che mostra: preview full, EXIF completo, faces, labels, tag suggeriti
7. Permettere accettazione/rifiuto tag suggeriti con feedback per migliorare suggerimenti futuri
8. Batch suggestions per foto multiple selezionate
