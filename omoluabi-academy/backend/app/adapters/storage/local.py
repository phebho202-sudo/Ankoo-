"""Local filesystem storage. A real (non-sample) adapter, used until Cloudflare R2 is set up."""

from __future__ import annotations

import os
from pathlib import Path

from app.adapters.base import ProviderStatus, StorageProvider
from app.core.errors import AppError


class LocalStorage(StorageProvider):
    name = "local-filesystem"
    is_sample = False

    def __init__(self, root: str | os.PathLike[str]) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):  # block "../" escapes
            raise AppError(f"Invalid storage key: {key!r}")
        return path

    def status(self) -> ProviderStatus:
        writable = os.access(self.root, os.W_OK)
        return ProviderStatus(
            self.capability,
            self.name,
            is_sample=False,
            configured=writable,
            detail=f"root={self.root} writable={writable}",
        )

    def put(self, key: str, data: bytes, content_type: str) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".part")
        tmp.write_bytes(data)
        tmp.replace(path)  # atomic on the same filesystem
        return f"local://{key}"

    def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def usage_bytes(self) -> int:
        return sum(p.stat().st_size for p in self.root.rglob("*") if p.is_file())
