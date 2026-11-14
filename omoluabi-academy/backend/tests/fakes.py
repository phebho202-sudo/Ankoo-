"""Test doubles that behave like *live* (non-sample) providers without any network."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.adapters.base import LLMMessage, LLMProvider, LLMResponse, ProviderStatus
from app.core.errors import ProviderError


class FakeLiveLLM(LLMProvider):
    name = "fake-live-llm"
    model = "claude-opus-5-5"
    is_sample = False

    def __init__(
        self,
        parsed: dict[str, Any] | None = None,
        *,
        refused: bool = False,
        error: str | None = None,
        cost: str = "0.0420",
        estimate: str = "0.50",
    ) -> None:
        self.parsed, self.refused, self.error = parsed, refused, error
        self.cost, self.estimate = Decimal(cost), Decimal(estimate)
        self.calls: list[dict[str, Any]] = []

    def status(self) -> ProviderStatus:
        return ProviderStatus(self.capability, self.name, False, True, "fake")

    def estimate_max_cost(self, *, input_chars: int, max_tokens: int) -> Decimal:
        return self.estimate

    def complete(
        self,
        *,
        system: str,
        messages: list[LLMMessage],
        max_tokens: int = 2048,
        json_schema: dict[str, Any] | None = None,
    ) -> LLMResponse:
        self.calls.append({"system": system, "messages": messages, "schema": json_schema})
        if self.error:
            raise ProviderError(self.error)
        return LLMResponse(
            text="",
            provider=self.name,
            model=self.model,
            is_sample=False,
            input_tokens=1200,
            output_tokens=900,
            cost_usd=self.cost,
            parsed=None if self.refused else self.parsed,
            refused=self.refused,
            stop_reason="refusal" if self.refused else "end_turn",
        )


def good_report(**overrides: Any) -> dict[str, Any]:
    r = {
        "summary": "Pricing should follow the value a customer receives, not only cost.",
        "key_concepts": [
            {
                "name": "Value-based pricing",
                "explanation": "Charge relative to the outcome delivered.",
            }
        ],
        "nigerian_context": "Market traders in Lagos often price by habit; naira inflation "
        "makes regular price reviews essential.",
        "topics": [
            {
                "title": "Pricing for profit in an inflationary economy",
                "description": "How to review prices monthly without losing loyal customers.",
                "audience_fit": "Shop owners and traders",
                "lesson_angle": "A Balogun trader case",
            },
            {
                "title": "Bundling products to raise basket size",
                "description": "Combine items customers already buy together.",
                "audience_fit": "Provision stores",
                "lesson_angle": "₦5,000 family bundle example",
            },
        ],
        "cautions": ["Check current inflation figures before recording."],
    }
    r.update(overrides)
    return r
