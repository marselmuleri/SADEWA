from tests.test_users import _auth_headers, _bootstrap_super_admin, _login, _setup_fakultas_dan_prodi


def _admin_prodi_token(client):
    sa_token = _bootstrap_super_admin(client)
    _, prodi_id = _setup_fakultas_dan_prodi(client, sa_token)
    client.post(
        "/api/v1/users",
        json={
            "nama": "Admin Prodi IF",
            "email": "adminprodi@undip.ac.id",
            "password": "password123",
            "role": "admin_prodi",
            "program_studi_id": prodi_id,
        },
        headers=_auth_headers(sa_token),
    )
    return _login(client, "adminprodi@undip.ac.id", "password123")


def _create(client, headers, nim, **extra):
    payload = {"nim": nim, "nama": f"Mhs {nim}", "semester_aktif": 3, "status_masuk": "Reguler", **extra}
    resp = client.post("/api/v1/mahasiswa", json=payload, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_status_akademik_default_aktif_dan_bisa_diubah(client):
    headers = _auth_headers(_admin_prodi_token(client))

    mhs = _create(client, headers, "24060121120001")
    assert mhs["status_akademik"] == "Aktif"

    resp = client.put(f"/api/v1/mahasiswa/{mhs['id']}", json={"status_akademik": "Cuti"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status_akademik"] == "Cuti"


def test_status_akademik_tidak_valid_ditolak(client):
    headers = _auth_headers(_admin_prodi_token(client))
    resp = client.post(
        "/api/v1/mahasiswa",
        json={"nim": "1", "nama": "X", "semester_aktif": 1, "status_masuk": "Reguler", "status_akademik": "Libur"},
        headers=headers,
    )
    assert resp.status_code == 422


def test_filter_daftar_berdasarkan_status_akademik(client):
    headers = _auth_headers(_admin_prodi_token(client))
    _create(client, headers, "24060121120001")
    _create(client, headers, "24060121120002", status_akademik="Lulus")

    resp = client.get("/api/v1/mahasiswa", params={"status_akademik": "Lulus"}, headers=headers)
    assert resp.status_code == 200
    assert [m["nim"] for m in resp.json()] == ["24060121120002"]
