"""Cloudflare R2 storage (S3-compatible API).

The bucket stays private. Media is served to the dashboard through the API (with HTTP Range
support), and a platform that must fetch a video itself (Instagram) gets a short-lived signed
URL. R2 has no egress fees; storage is billed per GB-month (see docs/COSTS.md).
"""

from __future__ import annotations

from typing import Any

from app.adapters.base import ProviderStatus, StorageProvider
from app.core.errors import AppError, ProviderError


class R2Storage(StorageProvider):
    name = "cloudflare-r2"
    is_sample = False

    def __init__(
        self,
        *,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket: str,
        client: Any | None = None,
    ) -> None:
        self.bucket = bucket
        if client is None:
            import boto3
            from botocore.config import Config

            client = boto3.client(
                "s3",
                endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
                aws_access_key_id=access_key_id,
                aws_secret_access_key=secret_access_key,
                region_name="auto",
                config=Config(
                    retries={"max_attempts": 3, "mode": "standard"}, signature_version="s3v4"
                ),
            )
        self._s3 = client

    @staticmethod
    def _key(key: str) -> str:
        if not key or key.startswith("/") or ".." in key.split("/"):
            raise AppError(f"Invalid storage key: {key!r}")
        return key

    def _call(self, what: str, fn, **kw):
        from botocore.exceptions import BotoCoreError, ClientError

        try:
            return fn(Bucket=self.bucket, **kw)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            raise ProviderError(f"R2 {what} failed: {code or exc}", details={"code": code}) from exc
        except BotoCoreError as exc:
            raise ProviderError(f"R2 {what} failed: could not reach R2") from exc

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            self.capability, self.name, False, True, f"bucket={self.bucket} (verified on first use)"
        )

    def put(self, key: str, data: bytes, content_type: str) -> str:
        self._call(
            "upload", self._s3.put_object, Key=self._key(key), Body=data, ContentType=content_type
        )
        return f"r2://{self.bucket}/{key}"

    def get(self, key: str) -> bytes:
        return self._call("download", self._s3.get_object, Key=self._key(key))["Body"].read()

    def get_range(self, key: str, start: int, end: int) -> bytes:
        resp = self._call(
            "download", self._s3.get_object, Key=self._key(key), Range=f"bytes={start}-{end}"
        )
        return resp["Body"].read()

    def size(self, key: str) -> int:
        return int(self._call("lookup", self._s3.head_object, Key=self._key(key))["ContentLength"])

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self._s3.head_object(Bucket=self.bucket, Key=self._key(key))
            return True
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return False
            raise ProviderError("R2 lookup failed") from exc

    def delete(self, key: str) -> None:
        self._call("delete", self._s3.delete_object, Key=self._key(key))

    def usage_bytes(self) -> int:
        total, token = 0, None
        while True:
            kw = {"ContinuationToken": token} if token else {}
            page = self._call("listing", self._s3.list_objects_v2, **kw)
            total += sum(int(o["Size"]) for o in page.get("Contents", []))
            if not page.get("IsTruncated"):
                return total
            token = page["NextContinuationToken"]

    def presigned_url(self, key: str, seconds: int = 3600) -> str | None:
        return self._s3.generate_presigned_url(
            "get_object", Params={"Bucket": self.bucket, "Key": self._key(key)}, ExpiresIn=seconds
        )
