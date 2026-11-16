"""Cloudflare R2 adapter against botocore's Stubber (no network, no account needed)."""

import io

import boto3
import pytest
from botocore.response import StreamingBody
from botocore.stub import Stubber

from app.adapters import registry
from app.adapters.storage.r2 import R2Storage
from app.core.config import Settings
from app.core.errors import AppError, ProviderError, ProviderNotConfiguredError


@pytest.fixture
def r2():
    client = boto3.client(
        "s3",
        endpoint_url="https://acct.r2.cloudflarestorage.com",
        aws_access_key_id="AK",
        aws_secret_access_key="SK",
        region_name="auto",
    )
    stub = Stubber(client)
    stub.activate()
    yield (
        R2Storage(
            account_id="acct",
            access_key_id="AK",
            secret_access_key="SK",
            bucket="media",
            client=client,
        ),
        stub,
    )
    stub.deactivate()


def body(data: bytes) -> StreamingBody:
    return StreamingBody(io.BytesIO(data), len(data))


def test_put_get_and_range(r2):
    store, stub = r2
    stub.add_response(
        "put_object",
        {},
        {"Bucket": "media", "Key": "renders/1/v.mp4", "Body": b"abc", "ContentType": "video/mp4"},
    )
    stub.add_response(
        "get_object", {"Body": body(b"abcdef")}, {"Bucket": "media", "Key": "renders/1/v.mp4"}
    )
    stub.add_response(
        "get_object",
        {"Body": body(b"cd")},
        {"Bucket": "media", "Key": "renders/1/v.mp4", "Range": "bytes=2-3"},
    )
    stub.add_response(
        "head_object", {"ContentLength": 6}, {"Bucket": "media", "Key": "renders/1/v.mp4"}
    )
    assert store.put("renders/1/v.mp4", b"abc", "video/mp4") == "r2://media/renders/1/v.mp4"
    assert store.get("renders/1/v.mp4") == b"abcdef"
    assert store.get_range("renders/1/v.mp4", 2, 3) == b"cd"
    assert store.size("renders/1/v.mp4") == 6
    stub.assert_no_pending_responses()


def test_usage_follows_pagination(r2):
    store, stub = r2
    stub.add_response(
        "list_objects_v2",
        {
            "Contents": [{"Key": "a", "Size": 100}],
            "IsTruncated": True,
            "NextContinuationToken": "t1",
        },
        {"Bucket": "media"},
    )
    stub.add_response(
        "list_objects_v2",
        {"Contents": [{"Key": "b", "Size": 50}], "IsTruncated": False},
        {"Bucket": "media", "ContinuationToken": "t1"},
    )
    assert store.usage_bytes() == 150


def test_missing_object_and_errors(r2):
    store, stub = r2
    stub.add_client_error("head_object", service_error_code="404", http_status_code=404)
    assert store.exists("nope") is False
    stub.add_client_error("get_object", service_error_code="AccessDenied", http_status_code=403)
    with pytest.raises(ProviderError) as e:
        store.get("secret")
    assert "AccessDenied" in e.value.message
    with pytest.raises(AppError):
        store.get("../etc/passwd")


def test_signed_url_is_temporary(r2):
    store, _ = r2
    url = store.presigned_url("renders/1/v.mp4", 600)
    assert url.startswith("https://") and "X-Amz-Expires=600" in url and "Signature" in url


def test_registry_needs_every_r2_setting():
    s = Settings(_env_file=None, storage_backend="r2", r2_account_id="acct", r2_bucket="media")
    with pytest.raises(ProviderNotConfiguredError) as e:
        registry.get_storage(s)
    assert "R2_ACCESS_KEY_ID" in e.value.message
    full = Settings(
        _env_file=None,
        storage_backend="r2",
        r2_account_id="acct",
        r2_bucket="media",
        r2_access_key_id="AK",
        r2_secret_access_key="SK",
    )
    assert isinstance(registry.get_storage(full), R2Storage)
