"""Claude adapter tests with a fake SDK client: no network, no credits spent."""

import inspect
import json
from decimal import Decimal
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from app.adapters import pricing
from app.adapters.anthropic_llm import FALLBACK_BETA, ClaudeLLM
from app.adapters.base import LLMMessage
from app.core.errors import ProviderError


class FakeMessages:
    def __init__(self, response=None, exc=None):
        self.response, self.exc, self.kwargs = response, exc, None

    def create(self, **kwargs):
        self.kwargs = kwargs
        if self.exc:
            raise self.exc
        return self.response


def _client(messages):
    return SimpleNamespace(beta=SimpleNamespace(messages=messages))


def _resp(text="", stop="end_turn", model="claude-opus-5-5", inp=1000, out=500, cache=0):
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        stop_reason=stop,
        model=model,
        usage=SimpleNamespace(input_tokens=inp, output_tokens=out, cache_read_input_tokens=cache),
    )


SCHEMA = {
    "type": "object",
    "properties": {"a": {"type": "string"}},
    "required": ["a"],
    "additionalProperties": False,
}


def test_request_shape_uses_structured_output_and_fallbacks():
    msgs = FakeMessages(_resp(json.dumps({"a": "ẹ̀kọ́"})))
    llm = ClaudeLLM(api_key="k", client=_client(msgs))
    r = llm.complete(
        system="sys", messages=[LLMMessage("user", "hi")], max_tokens=800, json_schema=SCHEMA
    )
    kw = msgs.kwargs
    assert kw["model"] == "claude-opus-5-5" and kw["max_tokens"] == 800
    assert kw["output_config"] == {
        "effort": "medium",
        "format": {"type": "json_schema", "schema": SCHEMA},
    }
    assert kw["betas"] == [FALLBACK_BETA] and kw["fallbacks"] == "default"
    assert "thinking" not in kw and "temperature" not in kw
    assert r.parsed == {"a": "ẹ̀kọ́"} and r.is_sample is False


def test_installed_sdk_accepts_our_parameters():
    params = inspect.signature(anthropic.Anthropic(api_key="x").beta.messages.create).parameters
    for p in ("betas", "fallbacks", "output_config", "system", "max_tokens"):
        assert p in params, p


def test_cost_from_usage_at_published_rates():
    msgs = FakeMessages(_resp(json.dumps({"a": "x"}), inp=10_000, out=2_000))
    r = ClaudeLLM(api_key="k", client=_client(msgs)).complete(
        system="s", messages=[LLMMessage("user", "u")], json_schema=SCHEMA
    )
    # 10k * $4/M + 2k * $20/M = 0.04 + 0.04
    assert r.cost_usd == Decimal("0.0800")


def test_unknown_fallback_model_is_costed_conservatively():
    msgs = FakeMessages(
        _resp(json.dumps({"a": "x"}), model="claude-future-9", inp=1_000_000, out=0)
    )
    r = ClaudeLLM(api_key="k", client=_client(msgs)).complete(
        system="s", messages=[LLMMessage("user", "u")], json_schema=SCHEMA
    )
    assert r.cost_usd == pricing.CONSERVATIVE.input  # never under-stated
    assert r.model == "claude-future-9"


def test_refusal_is_reported_not_parsed():
    msgs = FakeMessages(_resp("", stop="refusal"))
    r = ClaudeLLM(api_key="k", client=_client(msgs)).complete(
        system="s", messages=[LLMMessage("user", "u")], json_schema=SCHEMA
    )
    assert r.refused is True and r.parsed is None and r.cost_usd > 0


def test_truncated_answer_raises():
    msgs = FakeMessages(_resp('{"a": "unfinish', stop="max_tokens"))
    with pytest.raises(ProviderError, match="cut off"):
        ClaudeLLM(api_key="k", client=_client(msgs)).complete(
            system="s", messages=[LLMMessage("user", "u")], json_schema=SCHEMA
        )


def _status_error(cls, code):
    req = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    return cls("err", response=httpx2.Response(code, request=req), body=None)


@pytest.mark.parametrize(
    "exc,msg",
    [
        (lambda: _status_error(anthropic.AuthenticationError, 401), "rejected the API key"),
        (lambda: _status_error(anthropic.RateLimitError, 429), "rate limit"),
        (lambda: _status_error(anthropic.InternalServerError, 500), "API error 500"),
        (
            lambda: anthropic.APIConnectionError(
                request=httpx2.Request("POST", "https://api.anthropic.com")
            ),
            "Could not reach",
        ),
    ],
)
def test_sdk_errors_become_provider_errors(exc, msg):
    llm = ClaudeLLM(api_key="k", client=_client(FakeMessages(exc=exc())))
    with pytest.raises(ProviderError, match=msg):
        llm.complete(system="s", messages=[LLMMessage("user", "u")])


def test_status_check_makes_no_call():
    msgs = FakeMessages()
    st = ClaudeLLM(api_key="k", client=_client(msgs)).status()
    assert st.configured and msgs.kwargs is None


def test_max_cost_estimate_is_an_upper_bound():
    llm = ClaudeLLM(api_key="k", client=_client(FakeMessages()))
    est = llm.estimate_max_cost(input_chars=30_000, max_tokens=8000)
    actual_worst = pricing.cost("claude-opus-5-5", input_tokens=10_000, output_tokens=8000)
    assert est >= actual_worst
