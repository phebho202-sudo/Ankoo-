"""Claude (Anthropic API) adapter, using the official ``anthropic`` Python SDK.

* Model: ``ANTHROPIC_MODEL`` (default ``claude-opus-5-5``).
* Structured output via ``output_config.format`` (JSON schema): the reply is valid JSON.
* Server-side refusal fallback (``fallbacks="default"``, beta header): if the model declines
  for a safety reason, the API retries on a fallback model in the same call. If the whole
  chain declines, ``refused=True`` is returned and nothing is parsed.
* Cost is computed from the response's token usage at published list prices.
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

import anthropic

from app.adapters import pricing
from app.adapters.base import LLMMessage, LLMProvider, LLMResponse, ProviderStatus
from app.core.errors import ProviderError

FALLBACK_BETA = "server-side-fallback-2026-07-01"


class ClaudeLLM(LLMProvider):
    name = "anthropic-claude"
    is_sample = False

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "claude-opus-5-5",
        effort: str = "medium",
        client: Any | None = None,
    ) -> None:
        self.model = model
        self.effort = effort
        # max_retries: the SDK retries 408/409/429/5xx itself; keep it small so a failing
        # provider cannot run up many attempts (each attempt can be billed).
        self._client = client or anthropic.Anthropic(api_key=api_key, max_retries=2, timeout=300.0)

    def status(self) -> ProviderStatus:
        # Never calls the API (a status check must not spend money).
        known = self.model in pricing.PRICES
        return ProviderStatus(
            self.capability,
            self.name,
            is_sample=False,
            configured=True,
            detail=f"model={self.model}"
            + ("" if known else " (no price on file: costed conservatively)"),
        )

    def estimate_max_cost(self, *, input_chars: int, max_tokens: int) -> Decimal:
        # Worst case: priced at the conservative rate in case a fallback model serves it.
        return pricing.cost(
            "__conservative__",
            input_tokens=pricing.estimate_tokens_from_chars(input_chars),
            output_tokens=max_tokens,
        )

    def complete(
        self,
        *,
        system: str,
        messages: list[LLMMessage],
        max_tokens: int = 2048,
        json_schema: dict[str, Any] | None = None,
    ) -> LLMResponse:
        output_config: dict[str, Any] = {"effort": self.effort}
        if json_schema is not None:
            output_config["format"] = {"type": "json_schema", "schema": json_schema}
        try:
            response = self._client.beta.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": m.role, "content": m.content} for m in messages],
                output_config=output_config,
                betas=[FALLBACK_BETA],
                fallbacks="default",
            )
        except anthropic.AuthenticationError as exc:
            raise ProviderError("Anthropic rejected the API key") from exc
        except anthropic.PermissionDeniedError as exc:
            raise ProviderError("The Anthropic API key lacks permission for this model") from exc
        except anthropic.RateLimitError as exc:
            raise ProviderError("Anthropic rate limit reached; try again later") from exc
        except anthropic.BadRequestError as exc:
            raise ProviderError(f"Anthropic rejected the request: {exc.message}") from exc
        except anthropic.APIStatusError as exc:
            raise ProviderError(f"Anthropic API error {exc.status_code}") from exc
        except anthropic.APIConnectionError as exc:
            raise ProviderError("Could not reach the Anthropic API") from exc

        usage = response.usage
        served_by = getattr(response, "model", None) or self.model
        in_tok = int(getattr(usage, "input_tokens", 0) or 0)
        out_tok = int(getattr(usage, "output_tokens", 0) or 0)
        cache_read = int(getattr(usage, "cache_read_input_tokens", 0) or 0)
        cost = pricing.cost(
            served_by, input_tokens=in_tok, output_tokens=out_tok, cache_read_tokens=cache_read
        )
        common = dict(
            provider=self.name,
            model=served_by,
            is_sample=False,
            input_tokens=in_tok + cache_read,
            output_tokens=out_tok,
            cost_usd=cost,
            stop_reason=response.stop_reason,
        )
        if response.stop_reason == "refusal":
            return LLMResponse(text="", refused=True, **common)
        if response.stop_reason == "max_tokens":
            raise ProviderError("The model's answer was cut off (max_tokens reached)")

        text = "".join(b.text for b in response.content if getattr(b, "type", None) == "text")
        parsed = None
        if json_schema is not None:
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError as exc:
                raise ProviderError("The model returned invalid JSON") from exc
        return LLMResponse(text=text, parsed=parsed, **common)
