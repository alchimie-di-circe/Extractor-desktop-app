# Task ID: 17

**Title:** Alternativa Locale per Media Processing Privacy-First

**Status:** pending

**Dependencies:** 4 ✓, 5 ✓, 7

**Priority:** medium

**Description:** Implementare un sistema di elaborazione media locale come alternativa privacy-first a Cloudinary, includendo background removal con rembg, upscaling con Real-ESRGAN, e smart crop con OpenCV, con UI toggle nelle settings e fallback chain intelligente.

**Details:**

## Struttura Directory

```
python/
├── local_media/
│   ├── __init__.py
│   ├── background_remover.py      # Wrapper rembg (U2-Net)
│   ├── upscaler.py                # Wrapper Real-ESRGAN
│   ├── smart_cropper.py           # OpenCV + face detection
│   ├── model_manager.py           # Download on-demand modelli
│   └── processor.py               # Orchestrator locale
src/lib/
├── services/
│   └── local-media-processor.ts   # Client TypeScript per sidecar
├── stores/
│   └── media-processing-settings.svelte.ts  # Store Svelte 5 runes
└── components/custom/
    └── MediaProcessingToggle.svelte  # UI toggle settings
electron/
└── model-downloader.ts            # Download manager con progress
```

## 1. Background Removal (`background_remover.py`)

```python
from rembg import remove
from PIL import Image
import io
from typing import Optional

class BackgroundRemover:
    """Background removal usando rembg con U2-Net model (~90% accuratezza Cloudinary)"""
    
    def __init__(self):
        # rembg scarica automaticamente u2net.onnx (~168MB) al primo uso
        self._model_name = "u2net"
    
    async def remove_background(
        self, 
        image_bytes: bytes,
        alpha_matting: bool = False,
        alpha_matting_foreground_threshold: int = 240,
        alpha_matting_background_threshold: int = 10
    ) -> bytes:
        """
        Rimuove lo sfondo dall'immagine.
        
        Args:
            image_bytes: Bytes dell'immagine input
            alpha_matting: Abilita alpha matting per bordi più smooth
            
        Returns:
            Bytes dell'immagine PNG con sfondo trasparente
        """
        try:
            input_image = Image.open(io.BytesIO(image_bytes))
            output_image = remove(
                input_image,
                alpha_matting=alpha_matting,
                alpha_matting_foreground_threshold=alpha_matting_foreground_threshold,
                alpha_matting_background_threshold=alpha_matting_background_threshold
            )
            
            output_buffer = io.BytesIO()
            output_image.save(output_buffer, format="PNG")
            return output_buffer.getvalue()
            
        except Exception as e:
            raise LocalProcessingError(f"Background removal failed: {e}")
```

## 2. Upscaling (`upscaler.py`)

```python
from pathlib import Path
import numpy as np
from PIL import Image
import io
from typing import Literal
from .model_manager import ModelManager

class Upscaler:
    """Super-resolution con Real-ESRGAN (x2, x4 scale)"""
    
    MODELS = {
        "x2": {
            "name": "RealESRGAN_x2plus.pth",
            "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
            "size_mb": 64
        },
        "x4": {
            "name": "RealESRGAN_x4plus.pth",
            "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
            "size_mb": 64
        }
    }
    
    def __init__(self, model_manager: ModelManager):
        self._model_manager = model_manager
        self._loaded_models = {}
    
    async def ensure_model(self, scale: Literal["x2", "x4"]) -> Path:
        """Scarica modello se non presente (download on-demand)"""
        model_info = self.MODELS[scale]
        return await self._model_manager.ensure_model(
            model_info["name"],
            model_info["url"],
            model_info["size_mb"]
        )
    
    async def upscale(
        self, 
        image_bytes: bytes, 
        scale: Literal["x2", "x4"] = "x2"
    ) -> bytes:
        """
        Upscale immagine con Real-ESRGAN.
        
        Args:
            image_bytes: Bytes dell'immagine input
            scale: Fattore di upscaling ("x2" o "x4")
            
        Returns:
            Bytes dell'immagine upscalata
        """
        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer
        
        model_path = await self.ensure_model(scale)
        
        # Configurazione modello
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, 
                       num_block=23, num_grow_ch=32, scale=int(scale[1]))
        
        upsampler = RealESRGANer(
            scale=int(scale[1]),
            model_path=str(model_path),
            model=model,
            tile=0,  # 0 = no tiling, usa più memoria ma più veloce
            tile_pad=10,
            pre_pad=0,
            half=False  # True per GPU con supporto FP16
        )
        
        # Process
        img = Image.open(io.BytesIO(image_bytes))
        img_array = np.array(img)
        output, _ = upsampler.enhance(img_array, outscale=int(scale[1]))
        
        output_buffer = io.BytesIO()
        Image.fromarray(output).save(output_buffer, format="PNG", quality=95)
        return output_buffer.getvalue()
```

## 3. Smart Crop (`smart_cropper.py`)

```python
import cv2
import numpy as np
from PIL import Image
import io
from typing import Tuple, Optional

class SmartCropper:
    """Smart crop con face detection (fallback: center crop)"""
    
    def __init__(self):
        # Carica Haar cascade per face detection
        self._face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
    
    def _detect_faces(self, img_array: np.ndarray) -> list:
        """Rileva volti nell'immagine"""
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        faces = self._face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )
        return faces
    
    def _calculate_focus_point(
        self, 
        img_shape: Tuple[int, int], 
        faces: list
    ) -> Tuple[int, int]:
        """Calcola punto focale basato su volti rilevati"""
        if len(faces) == 0:
            # Fallback: center
            return img_shape[1] // 2, img_shape[0] // 2
        
        # Centro pesato dei volti
        total_weight = 0
        cx, cy = 0, 0
        for (x, y, w, h) in faces:
            weight = w * h  # Peso = area del volto
            cx += (x + w/2) * weight
            cy += (y + h/2) * weight
            total_weight += weight
        
        return int(cx / total_weight), int(cy / total_weight)
    
    async def smart_crop(
        self, 
        image_bytes: bytes,
        target_width: int,
        target_height: int,
        gravity: Optional[str] = None  # "face", "center", "auto"
    ) -> bytes:
        """
        Smart crop con rilevamento automatico punto focale.
        
        Args:
            image_bytes: Bytes dell'immagine input
            target_width: Larghezza target
            target_height: Altezza target
            gravity: "face" (usa face detection), "center", "auto" (face con fallback center)
            
        Returns:
            Bytes dell'immagine croppata
        """
        img = Image.open(io.BytesIO(image_bytes))
        img_array = np.array(img)
        
        orig_h, orig_w = img_array.shape[:2]
        
        # Determina punto focale
        if gravity == "center":
            focus_x, focus_y = orig_w // 2, orig_h // 2
        else:  # "face" o "auto"
            faces = self._detect_faces(img_array)
            focus_x, focus_y = self._calculate_focus_point(img_array.shape, faces)
        
        # Calcola crop box mantenendo aspect ratio
        target_ratio = target_width / target_height
        orig_ratio = orig_w / orig_h
        
        if orig_ratio > target_ratio:
            # Immagine più larga: crop orizzontale
            new_w = int(orig_h * target_ratio)
            new_h = orig_h
        else:
            # Immagine più alta: crop verticale
            new_w = orig_w
            new_h = int(orig_w / target_ratio)
        
        # Centro crop sul punto focale
        left = max(0, min(focus_x - new_w // 2, orig_w - new_w))
        top = max(0, min(focus_y - new_h // 2, orig_h - new_h))
        
        cropped = img.crop((left, top, left + new_w, top + new_h))
        resized = cropped.resize((target_width, target_height), Image.LANCZOS)
        
        output_buffer = io.BytesIO()
        resized.save(output_buffer, format="PNG")
        return output_buffer.getvalue()
```

## 4. Model Manager (`model_manager.py`)

```python
from pathlib import Path
import aiohttp
import asyncio
from typing import Callable, Optional

class ModelManager:
    """Gestisce download on-demand dei modelli ML (~100MB per modello)"""
    
    def __init__(self, models_dir: Path):
        self.models_dir = models_dir
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self._download_callbacks: list[Callable] = []
    
    def on_download_progress(self, callback: Callable[[str, float], None]):
        """Registra callback per progress download"""
        self._download_callbacks.append(callback)
    
    async def ensure_model(
        self, 
        name: str, 
        url: str, 
        expected_size_mb: int
    ) -> Path:
        """Scarica modello se non presente, ritorna path"""
        model_path = self.models_dir / name
        
        if model_path.exists():
            return model_path
        
        # Download con progress
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                total = int(response.headers.get('content-length', 0))
                downloaded = 0
                
                with open(model_path, 'wb') as f:
                    async for chunk in response.content.iter_chunked(8192):
                        f.write(chunk)
                        downloaded += len(chunk)
                        progress = downloaded / total if total else 0
                        for cb in self._download_callbacks:
                            cb(name, progress)
        
        return model_path
```

## 5. Local Processor Orchestrator (`processor.py`)

```python
from typing import Literal, Optional
from .background_remover import BackgroundRemover
from .upscaler import Upscaler
from .smart_cropper import SmartCropper
from .model_manager import ModelManager

class LocalMediaProcessor:
    """Orchestrator per processing media locale"""
    
    def __init__(self, models_dir: Path):
        self.model_manager = ModelManager(models_dir)
        self.bg_remover = BackgroundRemover()
        self.upscaler = Upscaler(self.model_manager)
        self.cropper = SmartCropper()
    
    async def process(
        self,
        image_bytes: bytes,
        operations: list[dict]
    ) -> bytes:
        """
        Applica sequenza di operazioni.
        
        Args:
            image_bytes: Bytes immagine input
            operations: Lista di operazioni es. [
                {"type": "remove_bg"},
                {"type": "upscale", "scale": "x2"},
                {"type": "crop", "width": 1080, "height": 1080, "gravity": "face"}
            ]
            
        Returns:
            Bytes immagine processata
        """
        result = image_bytes
        
        for op in operations:
            op_type = op["type"]
            
            if op_type == "remove_bg":
                result = await self.bg_remover.remove_background(result)
            elif op_type == "upscale":
                result = await self.upscaler.upscale(result, op.get("scale", "x2"))
            elif op_type == "crop":
                result = await self.cropper.smart_crop(
                    result,
                    op["width"],
                    op["height"],
                    op.get("gravity", "auto")
                )
        
        return result
```

## 6. FastAPI Endpoints (`python/main.py` estensione)

```python
from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
from typing import List, Literal, Optional
from local_media.processor import LocalMediaProcessor

router = APIRouter(prefix="/local-media", tags=["local-media"])
processor = LocalMediaProcessor(Path("./models"))

class Operation(BaseModel):
    type: Literal["remove_bg", "upscale", "crop"]
    scale: Optional[Literal["x2", "x4"]] = None
    width: Optional[int] = None
    height: Optional[int] = None
    gravity: Optional[Literal["face", "center", "auto"]] = None

class ProcessRequest(BaseModel):
    operations: List[Operation]

@router.post("/process")
async def process_image(
    file: UploadFile = File(...),
    operations: str = None  # JSON encoded operations
):
    """Processa immagine con operazioni locali"""
    try:
        image_bytes = await file.read()
        ops = json.loads(operations) if operations else []
        result = await processor.process(image_bytes, ops)
        return Response(content=result, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/status")
async def models_status():
    """Ritorna stato download modelli"""
    return {
        "upscale_x2": processor.model_manager.is_downloaded("RealESRGAN_x2plus.pth"),
        "upscale_x4": processor.model_manager.is_downloaded("RealESRGAN_x4plus.pth"),
        "rembg": True  # Auto-downloaded by rembg
    }

@router.post("/models/download/{model_name}")
async def download_model(model_name: str):
    """Trigger download manuale modello"""
    await processor.model_manager.ensure_model(...)
    return {"status": "downloaded"}
```

## 7. TypeScript Client (`src/lib/services/local-media-processor.ts`)

```typescript
interface ProcessingOperation {
  type: 'remove_bg' | 'upscale' | 'crop';
  scale?: 'x2' | 'x4';
  width?: number;
  height?: number;
  gravity?: 'face' | 'center' | 'auto';
}

interface ModelStatus {
  upscale_x2: boolean;
  upscale_x4: boolean;
  rembg: boolean;
}

export class LocalMediaProcessor {
  private baseUrl = 'http://localhost:8765';
  
  async process(file: File, operations: ProcessingOperation[]): Promise<Blob> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('operations', JSON.stringify(operations));
    
    const response = await fetch(`${this.baseUrl}/local-media/process`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Local processing failed: ${response.statusText}`);
    }
    
    return response.blob();
  }
  
  async getModelsStatus(): Promise<ModelStatus> {
    const response = await fetch(`${this.baseUrl}/local-media/models/status`);
    return response.json();
  }
  
  async downloadModel(modelName: string): Promise<void> {
    await fetch(`${this.baseUrl}/local-media/models/download/${modelName}`, {
      method: 'POST'
    });
  }
}
```

## 8. Svelte Store (`src/lib/stores/media-processing-settings.svelte.ts`)

```typescript
import { writable } from 'svelte/store';

interface MediaProcessingSettings {
  preferLocalProcessing: boolean;
  fallbackToCloud: boolean;
  downloadModelsAutomatically: boolean;
}

const defaultSettings: MediaProcessingSettings = {
  preferLocalProcessing: false,
  fallbackToCloud: true,
  downloadModelsAutomatically: false
};

function createMediaProcessingStore() {
  const { subscribe, set, update } = writable<MediaProcessingSettings>(defaultSettings);
  
  return {
    subscribe,
    setPreferLocal: (value: boolean) => update(s => ({ ...s, preferLocalProcessing: value })),
    setFallbackToCloud: (value: boolean) => update(s => ({ ...s, fallbackToCloud: value })),
    load: async () => {
      const saved = await window.electronAPI?.getStore('mediaProcessing');
      if (saved) set(saved);
    },
    save: async (settings: MediaProcessingSettings) => {
      await window.electronAPI?.setStore('mediaProcessing', settings);
      set(settings);
    }
  };
}

export const mediaProcessingSettings = createMediaProcessingStore();
```

## 9. UI Toggle Component (`src/lib/components/custom/MediaProcessingToggle.svelte`)

```svelte
<script lang="ts">
  import { Switch } from '$lib/components/ui/switch';
  import { Label } from '$lib/components/ui/label';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { mediaProcessingSettings } from '$lib/stores/media-processing-settings.svelte';
  import { LocalMediaProcessor } from '$lib/services/local-media-processor';
  
  let processor = new LocalMediaProcessor();
  let modelsStatus = $state({ upscale_x2: false, upscale_x4: false, rembg: false });
  
  $effect(() => {
    processor.getModelsStatus().then(status => modelsStatus = status);
  });
</script>

<Card>
  <CardHeader>
    <CardTitle>Elaborazione Media Locale</CardTitle>
    <CardDescription>
      Alternativa privacy-first a Cloudinary. Nessun upload su server esterni.
    </CardDescription>
  </CardHeader>
  <CardContent class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <Label>Preferisci elaborazione locale</Label>
        <p class="text-sm text-muted-foreground">
          Background removal, upscaling e smart crop eseguiti sul tuo Mac
        </p>
      </div>
      <Switch 
        checked={$mediaProcessingSettings.preferLocalProcessing}
        onCheckedChange={(v) => mediaProcessingSettings.setPreferLocal(v)}
      />
    </div>
    
    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <Label>Fallback a Cloudinary</Label>
        <p class="text-sm text-muted-foreground">
          Usa Cloudinary se l'elaborazione locale fallisce
        </p>
      </div>
      <Switch 
        checked={$mediaProcessingSettings.fallbackToCloud}
        onCheckedChange={(v) => mediaProcessingSettings.setFallbackToCloud(v)}
      />
    </div>
    
    <div class="pt-4 border-t">
      <h4 class="text-sm font-medium mb-2">Stato Modelli ML</h4>
      <div class="flex gap-2 flex-wrap">
        <Badge variant={modelsStatus.rembg ? 'default' : 'secondary'}>
          rembg {modelsStatus.rembg ? '✓' : '~168MB'}
        </Badge>
        <Badge variant={modelsStatus.upscale_x2 ? 'default' : 'secondary'}>
          ESRGAN x2 {modelsStatus.upscale_x2 ? '✓' : '~64MB'}
        </Badge>
        <Badge variant={modelsStatus.upscale_x4 ? 'default' : 'secondary'}>
          ESRGAN x4 {modelsStatus.upscale_x4 ? '✓' : '~64MB'}
        </Badge>
      </div>
    </div>
  </CardContent>
</Card>
```

## 10. Editing Agent Integrazione (`python/agents/editing_agent.py` update)

```python
class EditingAgent(Agent):
    """Editing agent con supporto locale e cloud"""
    
    async def process_media(self, request: EditRequest) -> EditResult:
        settings = await self.get_user_settings()
        
        if settings.prefer_local_processing:
            try:
                return await self._process_local(request)
            except LocalProcessingError as e:
                if settings.fallback_to_cloud:
                    logger.warning(f"Local processing failed, fallback to Cloudinary: {e}")
                    return await self._process_cloudinary(request)
                raise
        else:
            return await self._process_cloudinary(request)
    
    async def _process_local(self, request: EditRequest) -> EditResult:
        """Processing locale con rembg, Real-ESRGAN, OpenCV"""
        from local_media.processor import LocalMediaProcessor
        processor = LocalMediaProcessor(self.models_dir)
        
        operations = self._map_request_to_operations(request)
        result_bytes = await processor.process(request.image_bytes, operations)
        
        return EditResult(
            success=True,
            output_bytes=result_bytes,
            processing_mode="local"
        )
    
    async def _process_cloudinary(self, request: EditRequest) -> EditResult:
        """Processing via Cloudinary MCP"""
        # Existing Cloudinary implementation
        ...
```

## Dipendenze Python (`python/requirements.txt` aggiunte)

```txt
# Local Media Processing
rembg>=2.0.50
realesrgan>=0.3.0
basicsr>=1.4.2
opencv-python-headless>=4.8.0
pillow>=10.0.0
aiohttp>=3.9.0
numpy>=1.24.0
```

## Trade-offs Documentati

| Aspetto | Locale | Cloudinary |
|---------|--------|------------|
| Privacy | ✅ 100% locale | ⚠️ Upload su server |
| Costo | ✅ Zero API costs | ⚠️ Pay-per-transform |
| Velocità | ⚠️ Dipende da hardware | ✅ Server ottimizzati |
| Qualità BG Removal | ~90% | 100% (baseline) |
| Modelli | ~300MB download | Zero download |
| Edge cases | ⚠️ Può fallire | ✅ Più robusto |

**Test Strategy:**

## Test Unitari Python

### 1. `tests/unit/test_background_remover.py`
- Test che immagine con sfondo semplice venga processata correttamente
- Test che immagine con sfondo complesso ritorni PNG con alpha channel
- Test che alpha_matting migliori bordi per immagini specifiche
- Test gestione errori per immagini corrotte

### 2. `tests/unit/test_upscaler.py`
- Test che upscale x2 raddoppi effettivamente le dimensioni
- Test che upscale x4 quadruplichi le dimensioni
- Test che modello venga scaricato on-demand se mancante
- Test progress callback durante download modello
- Test gestione memoria per immagini molto grandi (>4K)

### 3. `tests/unit/test_smart_cropper.py`
- Test face detection con immagine contenente 1 volto
- Test face detection con immagine contenente 3+ volti (centro pesato)
- Test fallback a center crop quando nessun volto rilevato
- Test crop mantenga aspect ratio target correttamente
- Test gravity="center" ignori face detection

### 4. `tests/unit/test_model_manager.py`
- Test download modello da URL valido
- Test skip download se modello già presente
- Test progress callback riceva valori 0.0 → 1.0
- Test gestione errori per URL non raggiungibile
- Test cleanup file parziali su download fallito

## Test Integrazione Python

### 5. `tests/integration/test_local_processor.py`
- Test pipeline completa: remove_bg → upscale → crop
- Test ordine operazioni rispettato
- Test ogni operazione possa funzionare singolarmente
- Test che risultato sia sempre PNG valido
- Test performance: pipeline completa < 30s per immagine 1080p su M1

### 6. `tests/integration/test_fastapi_endpoints.py`
- Test POST `/local-media/process` con file valido
- Test GET `/local-media/models/status` ritorna stato corretto
- Test POST `/local-media/models/download/{name}` trigger download
- Test error handling per file non-immagine
- Test concurrent requests (max 3 simultanee)

## Test TypeScript

### 7. `tests/unit/local-media-processor.test.ts`
- Test `process()` invia FormData corretta al sidecar
- Test `getModelsStatus()` parsa risposta JSON
- Test `downloadModel()` chiama endpoint corretto
- Test error handling per network failures

### 8. `tests/unit/media-processing-settings.test.ts`
- Test store inizializza con valori default
- Test `setPreferLocal()` aggiorna stato
- Test `load()` recupera settings salvati
- Test `save()` persiste via electronAPI

## Test UI (Playwright)

### 9. `e2e/media-processing-toggle.spec.ts`
- Test toggle "Preferisci elaborazione locale" si attiva/disattiva
- Test toggle "Fallback a Cloudinary" disabilitato quando local=false
- Test badge modelli mostrano stato corretto (✓ vs dimensione)
- Test settings persistono dopo refresh pagina

## Test Fallback Chain

### 10. `tests/integration/test_editing_agent_fallback.py`
- Test con `prefer_local=true, fallback=true`: local fail → cloudinary success
- Test con `prefer_local=true, fallback=false`: local fail → raise error
- Test con `prefer_local=false`: skip locale, usa sempre cloudinary
- Test log warning quando fallback attivato
- Test `processing_mode` nel risultato indica quale metodo usato

## Test Performance e Limiti

### 11. `tests/performance/test_local_processing_limits.py`
- Benchmark background removal: < 5s per 1080p
- Benchmark upscale x2: < 10s per 1080p  
- Benchmark upscale x4: < 30s per 1080p
- Benchmark smart crop: < 1s per qualsiasi dimensione
- Test memory usage non superi 4GB durante processing

## Validazione Qualità

### 12. Confronto manuale Cloudinary vs Local
- Preparare 10 immagini test (volti, prodotti, landscape)
- Confronto visivo background removal: acceptable se < 10% differenza percepita
- Confronto upscaling: SSIM > 0.9 rispetto originale scalato
- Confronto smart crop: volti sempre nel frame finale

## Subtasks

### 17.1. Setup Background Remover con rembg e U2-Net

**Status:** pending  
**Dependencies:** None  

Implementare il modulo background_remover.py con wrapper rembg che utilizza il modello U2-Net per la rimozione automatica dello sfondo dalle immagini.

**Details:**

Creare la classe BackgroundRemover in python/local_media/background_remover.py. Implementare il metodo remove_background() che accetta bytes immagine e parametri opzionali per alpha_matting. Il modello U2-Net (~168MB) viene scaricato automaticamente da rembg al primo utilizzo. Gestire la conversione PIL Image <-> bytes, output in formato PNG con canale alpha trasparente. Includere gestione errori con LocalProcessingError custom. Aggiungere dipendenze rembg>=2.0.50 e pillow>=10.0.0 a requirements.txt.

### 17.2. Implementazione Upscaler con Real-ESRGAN

**Status:** pending  
**Dependencies:** 17.4  

Creare il modulo upscaler.py che implementa super-resolution usando Real-ESRGAN con supporto per scale x2 e x4.

**Details:**

Implementare la classe Upscaler in python/local_media/upscaler.py. Definire dizionario MODELS con URL download per RealESRGAN_x2plus.pth e RealESRGAN_x4plus.pth (~64MB ciascuno). Metodo ensure_model() per download on-demand via ModelManager. Metodo upscale() che configura RRDBNet e RealESRGANer, processa l'immagine e ritorna bytes PNG. Aggiungere dipendenze realesrgan>=0.3.0, basicsr>=1.4.2, numpy>=1.24.0 a requirements.txt. Gestire conversione PIL <-> numpy array.

### 17.3. Smart Cropper con OpenCV e Face Detection

**Status:** pending  
**Dependencies:** None  

Implementare il modulo smart_cropper.py con rilevamento volti tramite Haar Cascade e crop intelligente basato su punto focale.

**Details:**

Creare la classe SmartCropper in python/local_media/smart_cropper.py. Caricare haarcascade_frontalface_default.xml da cv2.data.haarcascades. Implementare _detect_faces() con detectMultiScale. Implementare _calculate_focus_point() che calcola centro pesato dei volti rilevati o fallback al centro immagine. Metodo smart_crop() che: rileva volti, calcola punto focale, calcola crop box mantenendo aspect ratio target, centra sul punto focale, esegue resize con LANCZOS. Supportare gravity: 'face', 'center', 'auto'. Aggiungere opencv-python-headless>=4.8.0.

### 17.4. Model Manager per Download On-Demand Modelli ML

**Status:** pending  
**Dependencies:** None  

Creare il sistema di gestione modelli che scarica i modelli ML (~300MB totali) on-demand con progress tracking e caching locale.

**Details:**

Implementare ModelManager in python/local_media/model_manager.py. Costruttore accetta models_dir (Path) e crea directory se non esiste. Metodo on_download_progress() per registrare callback progress. Metodo ensure_model(name, url, expected_size_mb) che: verifica se modello già presente in models_dir, altrimenti scarica con aiohttp in chunks da 8KB, notifica progress via callbacks registrati. Metodo is_downloaded(name) per verificare presenza. Aggiungere aiohttp>=3.9.0 a requirements.txt. Creare endpoint FastAPI GET /local-media/models/status e POST /local-media/models/download/{model_name}.

### 17.5. UI Toggle Settings e Svelte Store per Preferenze Processing

**Status:** pending  
**Dependencies:** 17.1, 17.2, 17.3, 17.4  

Creare componente MediaProcessingToggle.svelte e store Svelte 5 runes per gestire preferenze utente su elaborazione locale vs cloud.

**Details:**

Creare store in src/lib/stores/media-processing-settings.svelte.ts con stato: preferLocalProcessing (boolean), fallbackToCloud (boolean), downloadModelsAutomatically (boolean). Metodi setPreferLocal(), setFallbackToCloud(), load() da electron store, save() verso electron store. Creare componente MediaProcessingToggle.svelte in src/lib/components/custom/ con Card shadcn contenente: Switch per preferire elaborazione locale, Switch per fallback Cloudinary, sezione stato modelli ML con Badge per rembg/ESRGAN x2/x4 che mostra checkmark se scaricato o dimensione se mancante. Usare $effect per caricare stato modelli da LocalMediaProcessor.getModelsStatus().

### 17.6. Fallback Chain Local-Cloudinary e Integrazione Editing Agent

**Status:** pending  
**Dependencies:** 17.1, 17.2, 17.3, 17.4, 17.5  

Implementare orchestrator LocalMediaProcessor, client TypeScript, endpoint FastAPI e logica fallback intelligente nell'editing agent.

**Details:**

Creare processor.py in python/local_media/ con classe LocalMediaProcessor che orchestra bg_remover, upscaler, cropper. Metodo process(image_bytes, operations) che applica sequenza operazioni. Creare endpoint FastAPI POST /local-media/process in python/main.py. Creare client TypeScript LocalMediaProcessor in src/lib/services/local-media-processor.ts con metodi process(), getModelsStatus(), downloadModel(). Modificare EditingAgent in python/agents/editing_agent.py: leggere settings utente, se prefer_local_processing provare _process_local(), su LocalProcessingError e fallback_to_cloud abilitato chiamare _process_cloudinary(), altrimenti rilanciare errore. Loggare mode usato in EditResult.
