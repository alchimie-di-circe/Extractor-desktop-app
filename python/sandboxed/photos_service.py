"""
Photos Service - Wraps osxphotos library for safe photo extraction.

Handles:
- Album enumeration
- Photo retrieval with metadata
- Safe photo export with path validation
- Permission error detection
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any

try:
    import osxphotos
except ImportError:
    osxphotos = None  # type: ignore

logger = logging.getLogger(__name__)


class PhotosServiceError(Exception):
    """Photos service error."""

    pass


class PhotosPermissionError(PhotosServiceError):
    """User does not have Full Disk Access permission."""

    pass


class PhotosService:
    """Service for accessing and exporting photos from macOS Photos library."""

    def __init__(self):
        """Initialize photos service."""
        self.db = None
        self._check_and_load_db()

    def _check_and_load_db(self) -> None:
        """Load osxphotos database, catching permission errors."""
        try:
            if not osxphotos:
                raise ImportError("osxphotos module not available")
            self.db = osxphotos.PhotosDB()
            logger.info("Photos database loaded successfully")
        except ImportError as e:
            raise PhotosServiceError("osxphotos not installed") from e
        except PermissionError as e:
            logger.error(f"Permission denied: {e}")
            raise PhotosPermissionError(
                "Full Disk Access not granted. "
                "Please enable in System Preferences > Security & Privacy > Full Disk Access"
            ) from e
        except Exception as e:
            logger.error(f"Failed to load photos database: {e}")
            raise PhotosServiceError(f"Failed to load photos database: {e}") from e

    async def list_albums(self) -> List[Dict[str, Any]]:
        """
        List all albums in Photos library.

        Returns:
            List of album dicts with id, name, and photo count

        Raises:
            PhotosPermissionError: If Full Disk Access not granted
            PhotosServiceError: If database access fails
        """
        # Offload blocking DB iteration to thread pool to avoid blocking the event loop
        return await asyncio.to_thread(self._list_albums_sync)
    
    def _list_albums_sync(self) -> List[Dict[str, Any]]:
        """Synchronous implementation of list_albums (runs in thread pool)."""
        try:
            if not self.db:
                raise PhotosServiceError("Database not initialized")

            albums = []

            # Get all albums
            for album in self.db.albums:
                photos_count = len(album.photos)
                albums.append({
                    "id": str(album.uuid),
                    "name": album.name,
                    "count": photos_count,
                    "type": "album",
                })

            logger.info(f"Listed {len(albums)} albums")
            return albums

        except PermissionError as e:
            raise PhotosPermissionError(str(e)) from e
        except Exception as e:
            logger.error(f"Error listing albums: {e}", exc_info=True)
            raise PhotosServiceError(f"Failed to list albums: {e}") from e

    async def get_photos(
        self, album_id: str, limit: int = 100, offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get photos from an album.

        Args:
            album_id: Album UUID
            limit: Maximum photos to return
            offset: Skip first N photos

        Returns:
            Dict with photo list and metadata

        Raises:
            PhotosServiceError: If album not found or access fails
        """
        # Offload blocking DB iteration to thread pool to avoid blocking the event loop
        return await asyncio.to_thread(self._get_photos_sync, album_id, limit, offset)
    
    def _get_photos_sync(self, album_id: str, limit: int, offset: int) -> Dict[str, Any]:
        """Synchronous implementation of get_photos (runs in thread pool)."""
        try:
            if not self.db:
                raise PhotosServiceError("Database not initialized")

            # Find album by UUID
            album = None
            for a in self.db.albums:
                if str(a.uuid) == album_id:
                    album = a
                    break

            if not album:
                raise PhotosServiceError(f"Album not found: {album_id}")

            # Get photos with pagination
            all_photos = album.photos
            paginated = all_photos[offset : offset + limit]

            photos = []
            for photo in paginated:
                photos.append({
                    "id": str(photo.uuid),
                    "filename": photo.filename,
                    "date": photo.date.isoformat() if photo.date else None,
                    "width": photo.width,
                    "height": photo.height,
                    "size_bytes": photo.size,
                })

            logger.info(f"Retrieved {len(photos)} photos from album {album_id}")

            return {
                "album_id": album_id,
                "album_name": album.name,
                "total_count": len(all_photos),
                "offset": offset,
                "limit": limit,
                "returned": len(photos),
                "photos": photos,
            }

        except PermissionError as e:
            raise PhotosPermissionError(str(e)) from e
        except Exception as e:
            logger.error(f"Error getting photos: {e}", exc_info=True)
            raise PhotosServiceError(f"Failed to get photos: {e}") from e

    async def export_photo(self, photo_id: str, export_path: str) -> Dict[str, Any]:
        """
        Export a photo to disk.

        Args:
            photo_id: Photo UUID
            export_path: Validated export path (from path_whitelist)

        Returns:
            Dict with export result

        Raises:
            PhotosServiceError: If export fails
            PhotosPermissionError: If Full Disk Access not granted
        """
        # Offload blocking export to thread pool to avoid blocking the event loop
        return await asyncio.to_thread(self._export_photo_sync, photo_id, export_path)
    
    def _export_photo_sync(self, photo_id: str, export_path: str) -> Dict[str, Any]:
        """Synchronous implementation of export_photo (runs in thread pool)."""
        try:
            if not self.db:
                raise PhotosServiceError("Database not initialized")

            # Find photo by UUID
            photo = None
            for p in self.db.photos(uuid=photo_id):
                photo = p
                break

            if not photo:
                raise PhotosServiceError(f"Photo not found: {photo_id}")

            from pathlib import Path
            export_target = Path(export_path)

            # If caller provides a directory, export using the photo's own filename
            if export_target.suffix == "":
                export_target.mkdir(parents=True, exist_ok=True)
                export_dir = str(export_target)
                export_filename = photo.filename
            else:
                export_target.parent.mkdir(parents=True, exist_ok=True)
                export_dir = str(export_target.parent)
                export_filename = export_target.name

            exported_paths = photo.export(export_dir, export_filename)
            if not exported_paths:
                raise PhotosServiceError(
                    f"Export returned no files for photo {photo_id} "
                    f"(dir={export_dir}, filename={export_filename}, target={export_file})"
                )

            logger.info(f"Exported photo {photo_id} to {export_path}")

            return {
                "photo_id": photo_id,
                "filename": photo.filename,
                "export_path": export_path,
                "success": True,
            }

        except PermissionError as e:
            raise PhotosPermissionError(str(e)) from e
        except Exception as e:
            logger.error(f"Error exporting photo: {e}", exc_info=True)
            raise PhotosServiceError(f"Failed to export photo: {e}") from e
