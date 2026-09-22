from __future__ import annotations

import sys
import types
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent.parent
if str(WORKER_DIR) not in sys.path:
    sys.path.insert(0, str(WORKER_DIR))

from tests import fakes  # noqa: E402


def _install_fake_firebase_admin() -> None:
    """Stubs the firebase_admin package before any worker module imports
    it, so tests never touch real credentials or a real project — every
    Firestore interaction in these tests goes through fakes.FakeFirestoreClient.
    """
    if getattr(sys.modules.get("firebase_admin"), "_is_fake", False):
        return

    fake_firebase_admin = types.ModuleType("firebase_admin")
    fake_firebase_admin._is_fake = True
    fake_firebase_admin.initialize_app = lambda *a, **k: object()

    fake_auth = types.ModuleType("firebase_admin.auth")
    fake_auth.get_user_by_email = lambda email, app=None: types.SimpleNamespace(uid=f"uid-for-{email}")

    fake_credentials_module = types.ModuleType("firebase_admin.credentials")
    fake_credentials_module.Certificate = lambda path: path

    fake_firestore_module = types.ModuleType("firebase_admin.firestore")
    fake_firestore_module.SERVER_TIMESTAMP = fakes.SERVER_TIMESTAMP
    fake_firestore_module.Increment = fakes.Increment
    fake_firestore_module.client = lambda: fakes.FakeFirestoreClient()

    sys.modules["firebase_admin"] = fake_firebase_admin
    sys.modules["firebase_admin.auth"] = fake_auth
    sys.modules["firebase_admin.credentials"] = fake_credentials_module
    sys.modules["firebase_admin.firestore"] = fake_firestore_module


_install_fake_firebase_admin()
