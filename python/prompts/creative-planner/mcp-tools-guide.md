# MCP Tools Guide: Cloudinary + Shotstack

## Cloudinary MCP Server

**Package**: `@cloudinary/asset-management-mcp`
**Type**: Local stdio MCP
**Auth**: Via `CLOUDINARY_URL` environment variable

### Available Operations

#### 1. Upload Asset
```
Operation: upload_asset
Inputs:
  - file_path: str (path to local file)
  - upload_preset: str (optional, default: "trae_extractor")
  - folder: str (optional, organize in Cloudinary folders)
  - resource_type: str (auto, image, video, raw)
  - overwrite: bool (default: false)

Outputs:
  - asset_id: str (cloudinary public_id)
  - url: str (secure HTTPS URL)
  - width: int (if image)
  - height: int (if image)
  - duration: float (if video, seconds)

Max file size: 100MB for images, 500MB for video
Supported formats: JPG, PNG, GIF, WebP, SVG (images); MP4, MOV, WebM, AVI (video)
```

#### 2. Transform Image
```
Operation: transform (cloudinary)
Inputs:
  - asset_id: str (public_id from upload)
  - transformations: array of objects

Transformation examples:
  - Remove background:
    {"effect": "remove_background"}
  
  - Resize/crop:
    {"width": 1920, "height": 1080, "crop": "fill"}
    (crop modes: fill, crop, scale, pad, lpad, rpad, mpad, minimalistic)
  
  - Filters:
    {"effect": "grayscale"}
    {"effect": "sepia"}
    {"quality": "auto"}
  
  - Angle/rotation:
    {"angle": 45}
  
  - Opacity:
    {"overlay": {"color": "red", "opacity": 0.5}}

Outputs:
  - result_url: str (transformed image URL)
  - width: int
  - height: int

Note: Transformations are non-destructive; original preserved
```

#### 3. List Assets
```
Operation: list_assets
Inputs:
  - folder: str (optional, filter by folder)
  - resource_type: str (image, video, or all)
  - limit: int (default: 100, max: 500)

Outputs:
  - assets: array of objects with {asset_id, url, created_at, size, format}
```

### Rate Limits & Quotas
- Free plan: 25 GB/month storage, 25 GB/month bandwidth
- 100 uploads/hour
- 300 API calls/minute

### Best Practices
1. **Batch uploads**: Group multiple uploads in parallel when possible
2. **Caching**: Store transformation URLs; don't re-transform same image twice
3. **Compression**: Use `quality: auto` for web delivery
4. **Responsive**: Generate multiple sizes for different devices
5. **Organization**: Use folder structure for easy management

---

## Shotstack MCP Server

**Source**: Pipedream (https://mcp.pipedream.net/v2)
**Type**: Remote SSE MCP
**Auth**: Via `SHOTSTACK_API_KEY` environment variable
**Provider**: Workday (Pipedream acquisition 2025)

### Available Operations

#### 1. Upload Asset
```
Operation: upload_asset
Inputs:
  - file_path: str (path to local file)
  - asset_name: str (descriptive name)

Outputs:
  - asset_id: str (unique Shotstack asset ID)
  - url: str (HTTPS access URL)
  - created_at: timestamp

Usage: Pre-load media before timeline creation
Storage: Persisted in Shotstack project
```

#### 2. Create Timeline
```
Operation: create_timeline
Inputs:
  - timeline: object with tracks array

Structure:
{
  "timeline": {
    "background": {
      "color": "#000000"
    },
    "tracks": [
      {
        "type": "video",
        "clips": [
          {
            "asset": {
              "type": "video",
              "src": "https://shotstack-url.com/video.mp4"
            },
            "start": 0,
            "length": 10,
            "fit": "crop",  # how to fit video in frame
            "scale": 1.0
          }
        ]
      },
      {
        "type": "text",
        "clips": [
          {
            "text": "Your text here",
            "style": {
              "font_size": 48,
              "color": "#FFFFFF",
              "font_family": "Arial",
              "font_weight": "bold",
              "text_align": "center"
            },
            "position": {
              "x": 0.5,  # 0-1 normalized, 0.5 = center
              "y": 0.5
            },
            "origin": "center",
            "start": 0,
            "length": 5
          }
        ]
      },
      {
        "type": "image",
        "clips": [
          {
            "asset": {
              "type": "image",
              "src": "https://shotstack-url.com/logo.png"
            },
            "start": 0,
            "length": 10,
            "scale": 0.2,  # 20% of frame
            "opacity": 0.8,
            "position": {"x": 0.9, "y": 0.1}
          }
        ]
      }
    ],
    "output": {
      "format": "mp4",
      "resolution": "1080p",  # 720p, 1080p, 4k
      "frame_rate": 30
    }
  }
}

Outputs:
  - timeline_id: str (unique timeline identifier)
  - preview_url: str (optional, low-res preview)
```

#### 3. Start Render
```
Operation: start_render
Inputs:
  - timeline_id: str (from create_timeline)
  - format: str (mp4, webm, mov, ogg)
  - quality: str (low, medium, high, ultra)
  - size: str (preset sizes: 1080p, 720p, 4k; or custom WxH)

Outputs:
  - render_id: str (unique render job ID)
  - status: str (initial status: queued, processing, completed, failed)
  - created_at: timestamp
  - estimated_completion: timestamp

Webhook callback available for completion notification
```

#### 4. Get Render Status
```
Operation: get_render_status
Inputs:
  - render_id: str

Outputs:
  - status: str (queued, processing, completed, failed)
  - progress: int (0-100)
  - url: str (final video URL, when completed)
  - error: str (if failed)
```

### Shotstack Capabilities
- **Video formats**: MP4 (H.264), WebM (VP9), MOV (ProRes), OGG (Theora)
- **Resolutions**: 720p, 1080p, 4K (2160p), custom up to 4K
- **Frame rates**: 24, 25, 30, 60 fps
- **Max timeline length**: 3600 seconds (1 hour)
- **Max tracks**: unlimited, but performance degrades with 10+
- **Supported codecs**: H.264, VP9, ProRes (MOV), Theora
- **Audio**: AAC or Vorbis per output format

### Rate Limits & Quotas
- Standard plan: 100 renders/month
- Pro plan: unlimited renders
- Concurrent renders: 3 per account
- Processing: ~1min per minute of video (1080p, medium quality)

### Best Practices
1. **Timeline planning**: Design complete timeline before render (don't iterate)
2. **Asset URLs**: Use published URLs (not temporary presigned); Shotstack caches
3. **Concurrent renders**: Queue multiple renders; they process sequentially
4. **Quality vs speed**: Use "high" for final delivery, "low" for previews
5. **Error recovery**: Check render_id status periodically; retry on failure
6. **Asset cleanup**: Remove unused assets to stay under storage limits

### Integration with Creative Worker
Creative Worker receives plan with tool calls like:
```
Step 1: Upload video asset
  → upload_asset(file_path="content.mp4")
  → Output: asset_id

Step 2: Create timeline with branding
  → create_timeline(timeline={...branding overlay...})
  → Output: timeline_id

Step 3: Start render
  → start_render(timeline_id, format="mp4", quality="high")
  → Output: render_id

Step 4: Poll for completion
  → get_render_status(render_id)
  → Wait for status == "completed"
  → Final video available at render.url
```

---

## Error Handling & Recovery

### Cloudinary Errors
| Error | Meaning | Recovery |
|-------|---------|----------|
| 400 Bad Request | Invalid parameters | Check transformation syntax |
| 401 Unauthorized | Invalid CLOUDINARY_URL | Verify env var |
| 403 Forbidden | Quota exceeded or over-limit | Check usage dashboard |
| 404 Not Found | Asset doesn't exist | Re-upload asset |
| 429 Too Many Requests | Rate limited | Wait 1 minute, retry |

### Shotstack Errors
| Error | Meaning | Recovery |
|-------|---------|----------|
| 400 Bad Request | Invalid timeline JSON | Check track structure |
| 401 Unauthorized | Invalid API key | Verify SHOTSTACK_API_KEY |
| 404 Not Found | Timeline/render doesn't exist | Verify timeline_id from create |
| 422 Unprocessable | Render failed (codec/format) | Try different output format |
| 503 Service Unavailable | Shotstack overloaded | Retry after 60 seconds |

### Creative Worker Fallback Strategy
1. **Image transform fails**: Try with lower quality, then original image
2. **Upload fails**: Retry 3x with exponential backoff
3. **Render fails**: Fall back to lower resolution, retry
4. **Timeout**: Report progress and allow user to check status later via render_id

---

## Platform-Specific Recommendations

### Instagram Reels (1080x1920)
- **Format**: MP4, 30fps
- **Duration**: 15-90 seconds
- **Overlay**: Logo 0.1x frame, bottom right
- **Title text**: Bottom third, white, shadow for contrast

### YouTube Shorts (1080x1920)
- **Format**: MP4, 30fps or 60fps
- **Duration**: 15-60 seconds
- **Branding**: Intro 1-2 sec with logo

### TikTok Videos (1080x1920)
- **Format**: MP4, 30fps
- **Duration**: 15-180 seconds
- **Captions**: Top-aligned, high contrast
- **Music**: Support audio track

### Facebook Videos (1200x675 or 1080x1080)
- **Format**: MP4, 30fps
- **Duration**: 1-120 seconds
- **Autoplay**: Muted, then user unmutes
- **Loop**: Design for seamless loop

---

## Variable Reference in Plans

Creative Worker receives plan with variables like `${var_image_1}`, `${var_timeline}`.

Resolution:
- `${asset_id}` from upload → use in create_timeline
- `${timeline_id}` from create → use in start_render
- `${render_id}` from start → use for status polling

Keep track of all outputs and pass to subsequent steps.
