"""Owner administration commands.

    python -m app.cli create-owner --email you@example.com --name "Your Name"

The password is read from a hidden prompt (or OWNER_PASSWORD for non-interactive setup).
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from app.core.errors import AppError
from app.db.session import get_sessionmaker
from app.services import auth


def _create_owner(args: argparse.Namespace) -> int:
    password = os.environ.get("OWNER_PASSWORD")
    if not password:
        password = getpass.getpass("Owner password (min 12 chars, mixed case, a digit): ")
        if password != getpass.getpass("Repeat password: "):
            print("Passwords do not match", file=sys.stderr)
            return 1
    with get_sessionmaker()() as db:
        try:
            user = auth.create_owner(
                db, email=args.email, password=password, display_name=args.name or ""
            )
            db.commit()
        except AppError as exc:
            print(f"Error: {exc.message}", file=sys.stderr)
            return 1
    print(f"Owner account created: {user.email}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create-owner", help="Create the owner login")
    p.add_argument("--email", required=True)
    p.add_argument("--name", default="")
    p.set_defaults(func=_create_owner)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
