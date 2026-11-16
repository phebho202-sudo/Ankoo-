"""Encryption of stored platform tokens (Fernet: AES-128-CBC + HMAC-SHA256).

The key comes only from TOKEN_ENCRYPTION_KEY. Without it, accounts cannot be connected:
tokens are never stored in plain text. Generate a key with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.core.errors import AppError, ProviderNotConfiguredError


def _fernet() -> Fernet:
    key = get_settings().token_encryption_key
    if key is None:
        raise ProviderNotConfiguredError(
            "TOKEN_ENCRYPTION_KEY is not set, so platform tokens cannot be stored safely"
        )
    try:
        return Fernet(key.get_secret_value().encode())
    except ValueError as exc:
        raise ProviderNotConfiguredError("TOKEN_ENCRYPTION_KEY is not a valid Fernet key") from exc


def encrypt(value: str | None) -> str | None:
    return None if value is None else _fernet().encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise AppError("A stored token could not be decrypted (was the key changed?)") from exc
