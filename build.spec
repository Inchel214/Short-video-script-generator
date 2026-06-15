# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import site

block_cipher = None

# 获取site-packages路径
user_site = site.getusersitepackages()

# 收集需要打包的数据文件（不再打包.env）
datas = []

# 添加gradio相关的数据文件
for sp in [user_site] + site.getsitepackages():
    for pkg in ['safehttpx', 'groovy', 'gradio', 'gradio_client']:
        test_path = Path(sp) / pkg
        if test_path.exists():
            datas.append((str(test_path), pkg))

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'gradio',
        'requests',
        'dotenv',
        'safehttpx',
        'groovy',
        'httpx',
        'httpcore',
        'h11',
        'anyio',
        'sniffio',
        'certifi',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='短视频剧本生成器',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip_binaries=False,
    upx=True,
    upx_exclude=[],
    name='短视频剧本生成器',
)