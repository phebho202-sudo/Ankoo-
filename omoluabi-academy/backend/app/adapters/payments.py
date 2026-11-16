"""Payment providers (Phase 9: readiness). Paystack is the Nigerian default.

Sample mode never creates a real checkout. Live mode needs PAYSTACK_SECRET_KEY (use a
test key, sk_test_..., until you are ready to take real payments).
"""

from __future__ import annotations

import abc
import hashlib
import hmac
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.errors import ProviderError

PAYSTACK = "https://api.paystack.co"


@dataclass(frozen=True)
class Checkout:
    reference: str
    url: str | None
    is_sample: bool


@dataclass(frozen=True)
class PaymentCheck:
    reference: str
    paid: bool
    amount_minor: int
    currency: str


class PaymentProvider(abc.ABC):
    name: str
    is_sample: bool = False

    @abc.abstractmethod
    def create_checkout(
        self,
        *,
        reference: str,
        amount_minor: int,
        currency: str,
        email: str,
        callback_url: str,
        metadata: dict[str, Any],
    ) -> Checkout: ...

    @abc.abstractmethod
    def verify_signature(self, body: bytes, signature: str | None) -> bool: ...

    @abc.abstractmethod
    def verify(self, reference: str) -> PaymentCheck: ...


class SamplePayments(PaymentProvider):
    name = "sample-payments"
    is_sample = True

    def create_checkout(self, *, reference, amount_minor, currency, email, callback_url, metadata):
        return Checkout(reference, None, True)  # no checkout page: nothing can be paid

    def verify_signature(self, body: bytes, signature: str | None) -> bool:
        return False  # sample mode never accepts a payment notification

    def verify(self, reference: str) -> PaymentCheck:
        return PaymentCheck(reference, False, 0, "NGN")


class PaystackPayments(PaymentProvider):
    name = "paystack"

    def __init__(self, secret_key: str, http: httpx.Client | None = None) -> None:
        self._key = secret_key
        self._http = http or httpx.Client(timeout=20.0)

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._key}"}

    def create_checkout(self, *, reference, amount_minor, currency, email, callback_url, metadata):
        try:
            r = self._http.post(
                f"{PAYSTACK}/transaction/initialize",
                headers=self._headers(),
                json={
                    "email": email,
                    "amount": amount_minor,  # kobo for NGN
                    "currency": currency,
                    "reference": reference,
                    "callback_url": callback_url,
                    "metadata": metadata,
                },
            )
        except httpx.HTTPError as exc:
            raise ProviderError("Could not reach Paystack") from exc
        body = r.json() if r.content else {}
        if r.status_code != 200 or not body.get("status"):
            raise ProviderError(
                f"Paystack refused the checkout: {body.get('message', r.status_code)}"
            )
        return Checkout(reference, body["data"]["authorization_url"], False)

    def verify_signature(self, body: bytes, signature: str | None) -> bool:
        if not signature:
            return False
        expected = hmac.new(self._key.encode(), body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(expected, signature)

    def verify(self, reference: str) -> PaymentCheck:
        try:
            r = self._http.get(
                f"{PAYSTACK}/transaction/verify/{reference}", headers=self._headers()
            )
        except httpx.HTTPError as exc:
            raise ProviderError("Could not reach Paystack") from exc
        if r.status_code != 200:
            raise ProviderError(f"Paystack verification failed (HTTP {r.status_code})")
        data = r.json().get("data") or {}
        return PaymentCheck(
            reference,
            data.get("status") == "success",
            int(data.get("amount") or 0),
            str(data.get("currency") or ""),
        )
