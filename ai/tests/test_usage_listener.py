"""Uji usage listener dan saklar enable_thinking pada llm_client (tanpa memanggil API asli)."""

from types import SimpleNamespace

import pytest

from sadewa_ai import llm_client
from sadewa_ai.config import settings


def _chunk(teks=None, finish=None, usage=None):
    choices = [] if teks is None and finish is None else [
        SimpleNamespace(delta=SimpleNamespace(content=teks), finish_reason=finish)
    ]
    return SimpleNamespace(choices=choices, usage=usage)


class _KlienPalsu:
    def __init__(self, chunks):
        self.argumen = {}
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))
        self._chunks = chunks

    def _create(self, **kw):
        self.argumen = kw
        return iter(self._chunks)


@pytest.fixture
def klien(monkeypatch):
    palsu = _KlienPalsu([
        _chunk('{"a": 1}'),
        _chunk(finish="stop"),
        _chunk(usage=SimpleNamespace(prompt_tokens=120, completion_tokens=30)),
    ])
    monkeypatch.setattr(llm_client, "get_client", lambda: palsu)
    yield palsu
    llm_client.set_usage_listener(None)


def test_listener_menerima_token_dan_durasi(klien):
    catatan = []
    llm_client.set_usage_listener(catatan.append)
    assert llm_client.chat([{"role": "user", "content": "x"}], max_tokens=10, temperature=0) == '{"a": 1}'
    assert len(catatan) == 1
    c = catatan[0]
    assert (c["prompt_tokens"], c["completion_tokens"], c["finish_reason"], c["berhasil"]) == (120, 30, "stop", True)
    assert c["durasi_detik"] >= 0


def test_listener_tetap_dipanggil_saat_gagal(monkeypatch):
    palsu = _KlienPalsu([_chunk("terpotong", finish="length")])
    monkeypatch.setattr(llm_client, "get_client", lambda: palsu)
    catatan = []
    llm_client.set_usage_listener(catatan.append)
    try:
        with pytest.raises(llm_client.LLMError):
            llm_client.chat([{"role": "user", "content": "x"}], max_tokens=10, temperature=0)
    finally:
        llm_client.set_usage_listener(None)
    assert catatan and catatan[0]["berhasil"] is False and catatan[0]["finish_reason"] == "length"


def test_opsi_model_reasoning_openai(klien, monkeypatch):
    llm_client.chat([{"role": "user", "content": "x"}], max_tokens=10, temperature=0.5)
    assert klien.argumen["max_tokens"] == 10
    assert "reasoning_effort" not in klien.argumen and "max_completion_tokens" not in klien.argumen

    monkeypatch.setattr(settings, "llm_reasoning_effort", "none")
    monkeypatch.setattr(settings, "llm_pakai_max_completion_tokens", True)
    llm_client.chat([{"role": "user", "content": "x"}], max_tokens=10, temperature=0.5)
    assert klien.argumen["max_completion_tokens"] == 10 and "max_tokens" not in klien.argumen
    assert klien.argumen["reasoning_effort"] == "none" and klien.argumen["temperature"] == 0.5


def test_enable_thinking_bisa_dimatikan(klien, monkeypatch):
    monkeypatch.setattr(settings, "llm_kirim_enable_thinking", True)
    llm_client.chat([{"role": "user", "content": "x"}], max_tokens=10, temperature=0)
    assert klien.argumen["extra_body"] == {"enable_thinking": False}

    monkeypatch.setattr(settings, "llm_kirim_enable_thinking", False)
    llm_client.chat([{"role": "user", "content": "x"}], max_tokens=10, temperature=0)
    assert klien.argumen["extra_body"] is None


def test_extra_body_openrouter_dan_biaya(monkeypatch):
    usage = SimpleNamespace(prompt_tokens=100, completion_tokens=20, cost=0.00042,
                            completion_tokens_details=SimpleNamespace(reasoning_tokens=0))
    akhir = _chunk(usage=usage)
    akhir.provider = "Alibaba"
    palsu = _KlienPalsu([_chunk('{"a": 1}'), _chunk(finish="stop"), akhir])
    monkeypatch.setattr(llm_client, "get_client", lambda: palsu)
    monkeypatch.setattr(settings, "llm_kirim_enable_thinking", False)
    body = {"provider": {"order": ["Alibaba"], "allow_fallbacks": False}, "reasoning": {"enabled": False}}
    monkeypatch.setattr(settings, "llm_extra_body", body)
    catatan = []
    llm_client.set_usage_listener(catatan.append)
    try:
        llm_client.chat([{"role": "user", "content": "x"}], max_tokens=10, temperature=0)
    finally:
        llm_client.set_usage_listener(None)
    assert palsu.argumen["extra_body"] == body
    c = catatan[0]
    assert (c["provider"], c["biaya_usd"], c["reasoning_tokens"]) == ("Alibaba", 0.00042, 0)
