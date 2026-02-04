# Task ID: 1

**Title:** Configurazione shadcn-svelte e Sistema UI Base

**Status:** done

**Dependencies:** None

**Priority:** high

**Description:** Installare e configurare shadcn-svelte come libreria UI principale, insieme ai componenti fondamentali per l'interfaccia dell'applicazione.

**Details:**

1. Eseguire `npx shadcn-svelte@latest init` per inizializzare shadcn-svelte
2. Configurare il file `components.json` con le preferenze di stile (default, new-york)
3. Installare i componenti base: button, card, dialog, input, form, toast, dropdown-menu, tabs
4. Creare la struttura delle cartelle: `src/lib/components/ui/` per componenti shadcn
5. Configurare il tema dark/light mode con CSS variables
6. Creare un layout base con sidebar navigation in `src/routes/+layout.svelte`
7. Implementare le route base: dashboard (#/), brands (#/brands), extract (#/extract), edit (#/edit), publish (#/publish), settings (#/settings)

Pseudo-codice per layout:
```svelte
<script>
  import { page } from '$app/stores';
  const routes = [
    { path: '#/', label: 'Dashboard', icon: 'home' },
    { path: '#/extract', label: 'Estrai', icon: 'image' },
    // ...
  ];
</script>
<div class="flex h-screen">
  <aside class="w-64 border-r">
    {#each routes as route}
      <a href={route.path} class:active={$page.url.hash === route.path}>{route.label}</a>
    {/each}
  </aside>
  <main class="flex-1"><slot /></main>
</div>
```

**Test Strategy:**

Test unitari per verificare il rendering dei componenti shadcn. Test di navigazione per assicurarsi che tutte le route funzionino correttamente con hash routing. Verificare che il tema dark/light switch funzioni.

## Subtasks

### 1.1. Inizializzazione shadcn-svelte con Risoluzione Conflitti TailwindCSS v4

**Status:** done  
**Dependencies:** None  

Inizializzare shadcn-svelte nel progetto gestendo la compatibilità con TailwindCSS v4 e Svelte 5 runes. Configurare components.json con le preferenze di stile e risolvere eventuali conflitti di configurazione.

**Details:**

1. Verificare la compatibilità di shadcn-svelte con TailwindCSS v4 (attualmente usa la sintassi @import 'tailwindcss' e @plugin)
2. Eseguire `npx shadcn-svelte@latest init` e selezionare le opzioni appropriate
3. Configurare components.json scegliendo lo stile (default/new-york), colori, e percorso componenti ($lib/components/ui)
4. Se shadcn-svelte richiede TailwindCSS v3, valutare: a) downgrade a v3, b) configurazione manuale delle CSS variables
5. Aggiornare app.css per includere le variabili CSS di shadcn mantenendo la sintassi v4
6. Creare la struttura cartelle: src/lib/components/ui/ e src/lib/components/custom/
7. Verificare che vite.config.ts e svelte.config.js siano configurati correttamente
8. Testare che il build funzioni senza errori con `npm run check`

### 1.2. Installazione Componenti Base shadcn-svelte

**Status:** done  
**Dependencies:** 1.1  

Installare tutti i componenti UI fondamentali richiesti: button, card, dialog, input, form, toast, dropdown-menu, tabs usando il CLI di shadcn-svelte.

**Details:**

1. Installare i componenti uno alla volta per gestire eventuali errori:
   - `npx shadcn-svelte@latest add button`
   - `npx shadcn-svelte@latest add card`
   - `npx shadcn-svelte@latest add dialog`
   - `npx shadcn-svelte@latest add input`
   - `npx shadcn-svelte@latest add form`
   - `npx shadcn-svelte@latest add toast` (include sonner o toaster)
   - `npx shadcn-svelte@latest add dropdown-menu`
   - `npx shadcn-svelte@latest add tabs`
2. Installare dipendenze aggiuntive se richieste (bits-ui, formsnap, sveltekit-superforms per form)
3. Verificare che tutti i componenti siano stati creati in src/lib/components/ui/
4. Creare un file index.ts in src/lib/components/ui/ per re-export centralizzato
5. Installare lucide-svelte per le icone: `npm install lucide-svelte`
6. Testare l'import di ogni componente in +page.svelte temporaneamente

### 1.3. Configurazione Sistema Tema Dark/Light con CSS Variables e Toggle

**Status:** done  
**Dependencies:** 1.1  

Implementare un sistema completo di theming dark/light mode usando CSS variables, persistenza locale, e un componente toggle accessibile.

**Details:**

1. Estendere app.css con le CSS variables per entrambi i temi:
   ```css
   :root {
     --background: 0 0% 100%;
     --foreground: 222.2 84% 4.9%;
     /* ... altre variabili shadcn */
   }
   .dark {
     --background: 222.2 84% 4.9%;
     --foreground: 210 40% 98%;
   }
   ```
2. Creare src/lib/stores/theme.svelte.ts con Svelte 5 runes:
   ```typescript
   let theme = $state<'light' | 'dark'>('light');
   export function toggleTheme() { ... }
   export function getTheme() { return theme; }
   ```
3. Implementare persistenza in localStorage e rispetto di prefers-color-scheme
4. Creare src/lib/components/custom/ThemeToggle.svelte con icone sun/moon
5. Aggiungere script in app.html per prevenire flash of unstyled content (FOUC)
6. Applicare classe 'dark' al tag html in base alla preferenza

### 1.4. Creazione Layout Sidebar con Navigazione Responsive

**Status:** done  
**Dependencies:** 1.2, 1.3  

Implementare il layout principale dell'applicazione con sidebar navigation responsive, supporto mobile con hamburger menu, e indicatore di route attiva.

**Details:**

1. Creare src/routes/+layout.svelte con struttura flex:
   ```svelte
   <script>
     import { page } from '$app/stores';
     import ThemeToggle from '$lib/components/custom/ThemeToggle.svelte';
     import { Home, Image, Edit, Send, Settings, Menu } from 'lucide-svelte';
     
     const routes = [
       { path: '/', label: 'Dashboard', icon: Home },
       { path: '/brands', label: 'Brand', icon: Folder },
       { path: '/extract', label: 'Estrai', icon: Image },
       { path: '/edit', label: 'Modifica', icon: Edit },
       { path: '/publish', label: 'Pubblica', icon: Send },
       { path: '/settings', label: 'Impostazioni', icon: Settings },
     ];
     let sidebarOpen = $state(true);
   </script>
   ```
2. Implementare sidebar collapsible con transizioni smooth
3. Aggiungere responsive breakpoint: sidebar nascosta sotto 768px, visibile hamburger
4. Creare header con logo app, breadcrumb, e ThemeToggle
5. Stilare active state per link corrente usando $page.url.pathname
6. Aggiungere hover e focus states accessibili
7. Implementare Sheet/Drawer da shadcn per mobile sidebar

### 1.5. Implementazione Sistema Hash Routing per Tutte le Route

**Status:** done  
**Dependencies:** 1.4  

Creare le pagine per tutte le route dell'applicazione (dashboard, brands, extract, edit, publish, settings) sfruttando l'hash router già configurato in svelte.config.js.

**Details:**

1. Il progetto ha già hash routing configurato in svelte.config.js (router: { type: 'hash' })
2. Creare le cartelle route in src/routes/:
   - src/routes/+page.svelte (Dashboard - già esistente, da aggiornare)
   - src/routes/brands/+page.svelte
   - src/routes/extract/+page.svelte
   - src/routes/edit/+page.svelte
   - src/routes/publish/+page.svelte
   - src/routes/settings/+page.svelte
3. Ogni pagina deve avere:
   - Titolo h1 con nome sezione
   - Placeholder Card shadcn con descrizione funzionalità futura
   - Layout consistente con padding appropriato
4. Aggiornare Dashboard (+page.svelte) con cards di overview
5. Settings deve includere placeholder per sottosezioni (LLM Providers, API Keys, Preferences)
6. Verificare che la navigazione hash funzioni: /#/, /#/brands, /#/extract, ecc.
7. Aggiungere meta title dinamico per ogni pagina
