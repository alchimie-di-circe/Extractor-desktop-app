"""
Test photos_service.py with mocked osxphotos database.

Tests are isolated via mock to avoid requiring Full Disk Access during CI.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from python.sandboxed.photos_service import (
    PhotosService,
    PhotosPermissionError,
    PhotosServiceError,
)


@pytest.fixture
def mock_osxphotos():
    """Mock osxphotos module and PhotosDB."""
    with patch("python.sandboxed.photos_service.osxphotos") as mock_osxphotos_module:
        mock_db = Mock()

        # Setup mock albums
        mock_album_1 = Mock()
        mock_album_1.uuid = "album-1"
        mock_album_1.name = "Vacation 2024"
        mock_album_1.photos = []

        # Add mock photos to album
        for i in range(3):
            mock_photo = Mock()
            mock_photo.uuid = f"photo-{i}"
            mock_photo.filename = f"photo_{i}.jpg"
            mock_photo.date = None
            mock_photo.width = 1920
            mock_photo.height = 1080
            mock_photo.size = 1024 * 100
            mock_album_1.photos.append(mock_photo)

        mock_db.albums = [mock_album_1]

        # Setup photos iterator for export
        def photos_by_uuid(**kwargs):
            uuid_val = kwargs.get("uuid")
            for album in mock_db.albums:
                for photo in album.photos:
                    if str(photo.uuid) == uuid_val:
                        yield photo

        mock_db.photos = photos_by_uuid

        mock_osxphotos_module.PhotosDB.return_value = mock_db

        yield mock_db


@pytest.mark.asyncio
async def test_photos_service_init_success(mock_osxphotos):
    """Test successful PhotosService initialization."""
    service = PhotosService()
    assert service.db is not None


@pytest.mark.asyncio
async def test_photos_service_init_permission_denied():
    """Test PhotosService initialization with permission error."""
    with patch("python.sandboxed.photos_service.osxphotos") as mock_osxphotos:
        mock_osxphotos.PhotosDB.side_effect = PermissionError("Full Disk Access denied")

        with pytest.raises(PhotosPermissionError, match="Full Disk Access"):
            PhotosService()


@pytest.mark.asyncio
async def test_photos_service_init_import_error():
    """Test PhotosService initialization when osxphotos not available."""
    with patch("python.sandboxed.photos_service.osxphotos", None):
        with pytest.raises(PhotosServiceError, match="osxphotos"):
            PhotosService()


@pytest.mark.asyncio
async def test_list_albums_success(mock_osxphotos):
    """Test listing albums."""
    service = PhotosService()
    albums = await service.list_albums()

    assert len(albums) == 1
    assert albums[0]["name"] == "Vacation 2024"
    assert albums[0]["count"] == 3
    assert albums[0]["type"] == "album"


@pytest.mark.asyncio
async def test_get_photos_success(mock_osxphotos):
    """Test retrieving photos from album."""
    service = PhotosService()
    result = await service.get_photos("album-1", limit=2, offset=0)

    assert result["album_id"] == "album-1"
    assert result["album_name"] == "Vacation 2024"
    assert result["total_count"] == 3
    assert result["returned"] == 2
    assert len(result["photos"]) == 2
    assert result["photos"][0]["filename"] == "photo_0.jpg"


@pytest.mark.asyncio
async def test_get_photos_album_not_found(mock_osxphotos):
    """Test get_photos with invalid album ID."""
    service = PhotosService()

    with pytest.raises(PhotosServiceError, match="Album not found"):
        await service.get_photos("invalid-album-id")


@pytest.mark.asyncio
async def test_get_photos_pagination(mock_osxphotos):
    """Test get_photos pagination."""
    service = PhotosService()

    # Get first page
    result1 = await service.get_photos("album-1", limit=1, offset=0)
    assert result1["returned"] == 1
    assert result1["photos"][0]["filename"] == "photo_0.jpg"

    # Get second page
    result2 = await service.get_photos("album-1", limit=1, offset=1)
    assert result2["returned"] == 1
    assert result2["photos"][0]["filename"] == "photo_1.jpg"


@pytest.mark.asyncio
async def test_export_photo_success(mock_osxphotos):
    """Test photo export."""
    service = PhotosService()

    # Mock the export method
    mock_photo = list(service.db.photos(uuid="photo-0"))[0]
    mock_photo.export = Mock()

    result = await service.export_photo("photo-0", "/Users/test/Exports/photo.jpg")

    assert result["success"] is True
    assert result["photo_id"] == "photo-0"
    assert result["export_path"] == "/Users/test/Exports/photo.jpg"
    mock_photo.export.assert_called_once_with("/Users/test/Exports/photo.jpg")


@pytest.mark.asyncio
async def test_export_photo_not_found(mock_osxphotos):
    """Test export of non-existent photo."""
    service = PhotosService()

    with pytest.raises(PhotosServiceError, match="Photo not found"):
        await service.export_photo("invalid-photo-id", "/Users/test/Exports/photo.jpg")
