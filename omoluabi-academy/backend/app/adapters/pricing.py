"""Published Claude API list prices, USD per million tokens (from the Claude API docs,
cached 2026-11-03). Used to record the cost of every call and to estimate the worst case
*before* a call, so the budget guard can refuse it. These are estimates from token counts:
the Anthropic Console invoice is the authoritative bill.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class ModelPrice:
    input: Decimal
    output: Decimal
    cache_read: Decimal | None = None


PRICES: dict[str, ModelPrice] = {
    "claude-opus-5-5": ModelPrice(Decimal("4"), Decimal("20"), Decimal("0.20")),
    "claude-sonnet-5-5": ModelPrice(Decimal("2"), Decimal("10"), Decimal("0.10")),
    "claude-haiku-5-5": ModelPrice(Decimal("0.10"), Decimal("0.50")),
    "claude-opus-5": ModelPrice(Decimal("5"), Decimal("25")),
    "claude-opus-4-8": ModelPrice(Decimal("5"), Decimal("25")),
    "claude-sonnet-5": ModelPrice(Decimal("2"), Decimal("10")),
}

# Unknown model (e.g. a server-side fallback we have no price for): charge the most
# expensive known rate so recorded spend is never under-stated.
CONSERVATIVE = ModelPrice(
    max(p.input for p in PRICES.values()), max(p.output for p in PRICES.values())
)
MILLION = Decimal(1_000_000)


def price_for(model: str) -> tuple[ModelPrice, bool]:
    """Return (price, known). Unknown models get the most expensive known rate."""
    p = PRICES.get(model)
    return (p, True) if p else (CONSERVATIVE, False)


def cost(
    model: str, *, input_tokens: int, output_tokens: int, cache_read_tokens: int = 0
) -> Decimal:
    p, _ = price_for(model)
    read_rate = p.cache_read if p.cache_read is not None else p.input
    total = (
        Decimal(input_tokens) * p.input
        + Decimal(output_tokens) * p.output
        + Decimal(cache_read_tokens) * read_rate
    ) / MILLION
    return total.quantize(Decimal("0.0001"))


def estimate_tokens_from_chars(chars: int) -> int:
    # Conservative: ~3 characters per token (Yoruba diacritics tokenise less efficiently).
    return chars // 3 + 1
