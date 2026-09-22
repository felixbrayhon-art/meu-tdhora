from __future__ import annotations

import copy
import itertools

"""A minimal in-memory stand-in for the Firestore Admin SDK client — just
enough surface (collection/document/batch/get_all/where/select) for the
worker pipeline's own code to run unmodified against it in tests. Not a
general-purpose Firestore emulator.
"""

_id_counter = itertools.count(1)


class ServerTimestampSentinel:
    def __repr__(self) -> str:
        return "<FAKE_SERVER_TIMESTAMP>"


SERVER_TIMESTAMP = ServerTimestampSentinel()


class Increment:
    def __init__(self, n: int):
        self.n = n


def _resolve_sentinels(data: dict, existing: dict | None) -> dict:
    out = {}
    for key, value in data.items():
        if isinstance(value, ServerTimestampSentinel):
            out[key] = "FAKE_SERVER_TIMESTAMP"
        elif isinstance(value, Increment):
            base = (existing or {}).get(key, 0) or 0
            out[key] = base + value.n
        else:
            out[key] = value
    return out


class FakeSnapshot:
    def __init__(self, doc_id: str, data: dict | None):
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self) -> dict | None:
        return copy.deepcopy(self._data) if self._data is not None else None


class FakeDocRef:
    def __init__(self, store: dict, collection_name: str, doc_id: str):
        self._store = store
        self.collection_name = collection_name
        self.id = doc_id

    def set(self, data: dict) -> None:
        existing = self._store.setdefault(self.collection_name, {}).get(self.id)
        self._store[self.collection_name][self.id] = _resolve_sentinels(copy.deepcopy(data), existing)

    def update(self, data: dict) -> None:
        collection = self._store.setdefault(self.collection_name, {})
        existing = collection.get(self.id, {})
        collection[self.id] = {**existing, **_resolve_sentinels(copy.deepcopy(data), existing)}

    def delete(self) -> None:
        self._store.get(self.collection_name, {}).pop(self.id, None)

    def get(self) -> FakeSnapshot:
        data = self._store.get(self.collection_name, {}).get(self.id)
        return FakeSnapshot(self.id, data)


class FakeQuery:
    def __init__(self, items: list[tuple[str, dict]], filters: list[tuple[str, object]] | None = None):
        self._items = items
        self._filters = filters or []

    def where(self, field: str, op: str, value) -> "FakeQuery":
        assert op == "==", "fake Firestore only supports equality filters"
        return FakeQuery(self._items, [*self._filters, (field, value)])

    def select(self, fields) -> "FakeQuery":
        return self

    def stream(self):
        for doc_id, data in self._items:
            if all(data.get(field) == value for field, value in self._filters):
                yield FakeSnapshot(doc_id, data)


class FakeCollectionRef:
    def __init__(self, store: dict, name: str):
        self._store = store
        self.name = name

    def document(self, doc_id: str | None = None) -> FakeDocRef:
        if doc_id is None:
            doc_id = f"auto-{next(_id_counter)}"
        return FakeDocRef(self._store, self.name, doc_id)

    def select(self, fields) -> FakeQuery:
        return FakeQuery(list(self._store.get(self.name, {}).items()))

    def where(self, field: str, op: str, value) -> FakeQuery:
        return FakeQuery(list(self._store.get(self.name, {}).items())).where(field, op, value)

    def stream(self):
        for doc_id, data in self._store.get(self.name, {}).items():
            yield FakeSnapshot(doc_id, data)


class FakeBatch:
    def __init__(self, store: dict):
        self._store = store
        self._ops: list[tuple] = []

    def set(self, ref: FakeDocRef, data: dict) -> None:
        self._ops.append(("set", ref, data))

    def delete(self, ref: FakeDocRef) -> None:
        self._ops.append(("delete", ref))

    def commit(self) -> None:
        for op in self._ops:
            if op[0] == "set":
                _, ref, data = op
                ref.set(data)
            else:
                _, ref = op
                ref.delete()
        self._ops = []


class FakeFirestoreClient:
    def __init__(self, seed: dict[str, dict[str, dict]] | None = None):
        self._store: dict[str, dict[str, dict]] = copy.deepcopy(seed) if seed else {}

    def collection(self, name: str) -> FakeCollectionRef:
        return FakeCollectionRef(self._store, name)

    def batch(self) -> FakeBatch:
        return FakeBatch(self._store)

    def get_all(self, refs: list[FakeDocRef]) -> list[FakeSnapshot]:
        return [ref.get() for ref in refs]

    def dump(self, name: str) -> dict:
        return copy.deepcopy(self._store.get(name, {}))
