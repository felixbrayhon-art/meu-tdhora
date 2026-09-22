from __future__ import annotations

from firebase_admin import auth


def resolve_uid(app, uid: str | None, email: str | None) -> str:
    if uid:
        return uid
    if email:
        return auth.get_user_by_email(email, app=app).uid
    raise SystemExit("Informe --imported-by-uid ou --imported-by-email (ou deixe o JSON trazer ownerEmail).")
