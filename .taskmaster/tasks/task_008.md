# Task ID: 8

**Title:** Native RAG con SQLite e Captioning Agent

**Status:** pending

**Dependencies:** 5

**Priority:** medium

**Description:** Implementare il sistema RAG nativo di Cagent con storage SQLite locale per knowledge base del brand, e l'agente di captioning che genera descrizioni contestuali.

**Details:**

1. Creare struttura `resources/brand-assets/` per documenti brand
2. Creare `resources/vector-store/` per SQLite embeddings
3. Implementare `python/rag/indexer.py`:
```python
import sqlite3
from sentence_transformers import SentenceTransformer

class BrandKnowledgeBase:
    def __init__(self, db_path: str):
        self.db = sqlite3.connect(db_path)
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self._init_schema()
    
    def index_document(self, doc_path: str, doc_type: str):
        # Estrai testo, genera embeddings, salva in SQLite
        pass
    
    def search(self, query: str, top_k: int = 5) -> List[Dict]:
        query_embedding = self.model.encode(query)
        # Ricerca similarità coseno
        pass
```
4. Creare `python/agents/captioning_agent.py`:
   - Integrazione con RAG per contesto brand
   - Generazione caption per piattaforma (IG, LinkedIn, Twitter)
   - Tone of voice personalizzabile
   - Hashtag suggestions
5. UI in `src/routes/edit/+page.svelte` sezione captions:
   - Editor caption con preview per piattaforma
   - Suggerimenti AI in tempo reale
   - Storico captions generate

**Test Strategy:**

Test unitari per indexing e search RAG. Test qualità caption generate con metriche. Test integrazione con brand guidelines.

## Subtasks

### 8.1. Setup SQLite Vector Store e Schema per Embeddings

**Status:** pending  
**Dependencies:** None  

Creare la struttura delle directory e lo schema del database SQLite per memorizzare gli embeddings vettoriali della knowledge base del brand.

**Details:**

1. Creare directory `resources/brand-assets/` per documenti brand (PDF, TXT, MD)
2. Creare directory `resources/vector-store/` per database SQLite
3. Implementare schema SQLite in `python/rag/schema.py`:
   - Tabella `documents`: id, path, doc_type, content, created_at, updated_at
   - Tabella `embeddings`: id, document_id, chunk_text, embedding (BLOB), chunk_index
   - Tabella `metadata`: key, value per configurazione
4. Creare script di inizializzazione database con indici per ricerca efficiente
5. Implementare migration system per futuri aggiornamenti schema

### 8.2. Implementazione BrandKnowledgeBase con Sentence-Transformers

**Status:** pending  
**Dependencies:** 8.1  

Sviluppare la classe BrandKnowledgeBase per l'indicizzazione dei documenti brand utilizzando sentence-transformers per la generazione degli embeddings.

**Details:**

1. Creare `python/rag/indexer.py` con classe BrandKnowledgeBase
2. Inizializzare SentenceTransformer con modello 'all-MiniLM-L6-v2'
3. Implementare `index_document()` per:
   - Leggere documento da path (supporto PDF, TXT, MD)
   - Chunking intelligente del testo (overlap windows)
   - Generazione embeddings per ogni chunk
   - Salvataggio in SQLite con serializzazione numpy
4. Implementare `index_directory()` per batch indexing
5. Gestire aggiornamento incrementale documenti esistenti
6. Logging progressi indicizzazione

### 8.3. Creazione Funzione Search con Cosine Similarity

**Status:** pending  
**Dependencies:** 8.2  

Implementare la funzionalità di ricerca semantica con calcolo della similarità coseno per recuperare i documenti più rilevanti dalla knowledge base.

**Details:**

1. Implementare metodo `search()` in BrandKnowledgeBase:
   - Generare embedding della query
   - Caricare embeddings da SQLite
   - Calcolare cosine similarity vettoriale
   - Ordinare risultati per score decrescente
2. Ottimizzare con numpy vectorization per performance
3. Implementare caching query frequenti
4. Aggiungere filtri per doc_type e date range
5. Restituire top_k risultati con metadata (path, chunk, score)
6. Implementare threshold minimo di similarità configurabile

### 8.4. Implementazione CaptioningAgent con Integrazione RAG

**Status:** pending  
**Dependencies:** 8.3  

Sviluppare l'agente di captioning che utilizza il sistema RAG per generare descrizioni contestuali basate sulla knowledge base del brand.

**Details:**

1. Creare `python/agents/captioning_agent.py` con classe CaptioningAgent
2. Integrare BrandKnowledgeBase per recupero contesto brand
3. Implementare `generate_caption()` con parametri:
   - media_description: descrizione immagine/video
   - platform: target social platform
   - tone_of_voice: stile comunicazione
   - context_query: query per RAG
4. Costruire prompt dinamico con:
   - Contesto brand da RAG (top 3 chunks)
   - Guidelines piattaforma specifica
   - Tone of voice richiesto
5. Supportare streaming output per UI realtime
6. Generare suggerimenti hashtag pertinenti

### 8.5. UI Caption Editor con Preview e Suggestions AI

**Status:** pending  
**Dependencies:** 8.4  

Creare l'interfaccia utente per l'editing delle caption con preview per piattaforma, suggerimenti AI in tempo reale e storico delle caption generate.

**Details:**

1. Estendere `src/routes/edit/+page.svelte` con sezione captions
2. Creare componenti:
   - CaptionEditor: textarea con character counter per piattaforma
   - PlatformPreview: mockup visivo post per IG/LinkedIn/Twitter
   - HashtagSuggestions: chip selezionabili con hashtag suggeriti
   - CaptionHistory: lista caption precedenti con riutilizzo
3. Implementare debounced AI suggestions durante typing
4. Aggiungere indicatori limiti caratteri per piattaforma
5. Preview responsive che simula aspetto reale del post
6. Salvataggio bozze automatico in localStorage

### 8.6. Supporto Multi-Piattaforma con Tone of Voice Configurabile

**Status:** pending  
**Dependencies:** 8.5  

Implementare il supporto completo per Instagram, LinkedIn e Twitter con profili tone of voice personalizzabili e ottimizzazioni specifiche per ogni piattaforma.

**Details:**

1. Creare `src/lib/config/platforms.ts` con configurazioni:
   - Instagram: 2200 char limit, 30 hashtags, emoji-friendly
   - LinkedIn: 3000 char limit, professionale, hashtag moderati
   - Twitter/X: 280 char limit, conciso, 2-3 hashtag
2. Implementare `src/lib/config/tone-profiles.ts`:
   - Profili predefiniti: professionale, casual, engaging, informativo
   - Editor profili custom con sliders (formalità, emoji usage, etc.)
3. Creare store Svelte per preferenze utente
4. Adattare CaptioningAgent per rispettare constraints piattaforma
5. UI selector piattaforma con icone e switch rapido
6. Salvataggio preferenze tone of voice per brand
