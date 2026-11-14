import json
import logging

from app.core.logging import JsonFormatter, RequestIdFilter, request_id_var


def _format(record_kwargs: dict) -> dict:
    record = logging.LogRecord("t", logging.INFO, __file__, 1, "hello %s", ("Ọlá",), None)
    for k, v in record_kwargs.items():
        setattr(record, k, v)
    RequestIdFilter().filter(record)
    return json.loads(JsonFormatter().format(record))


def test_json_log_includes_request_id_and_unicode():
    token = request_id_var.set("req-123")
    try:
        out = _format({})
    finally:
        request_id_var.reset(token)
    assert out["msg"] == "hello Ọlá"
    assert out["request_id"] == "req-123"


def test_secret_like_context_keys_are_redacted():
    out = _format({"context": {"api_key": "abc", "nested": {"refresh_token": "t"}, "ok": 1}})
    assert out["context"]["api_key"] == "[REDACTED]"
    assert out["context"]["nested"]["refresh_token"] == "[REDACTED]"
    assert out["context"]["ok"] == 1
