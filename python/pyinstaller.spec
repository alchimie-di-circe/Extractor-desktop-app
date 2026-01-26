# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for Cagent sidecar standalone executable.

Build with:
  pyinstaller --clean --noconfirm python/pyinstaller.spec

Output: dist/cagent-sidecar (macOS) or dist/cagent-sidecar.exe (Windows)
"""

import os
from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

# Collect all submodules for hidden imports
hidden_imports = [
    'uvicorn.logging',
    'uvicorn.protocols.http',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.utils',
    'uvicorn.workers',
]

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('agents', 'agents'),
        ('tools', 'tools'),
    ],
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludedimports=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='cagent-sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    onefile=True,  # Single file executable
)
