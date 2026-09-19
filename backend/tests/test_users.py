def _bootstrap_super_admin(client):
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin",
        "email": "superadmin@undip.ac.id",
        "password": "password123",
    })
    resp = client.post("/api/v1/auth/login", json={
        "email": "superadmin@undip.ac.id",
        "password": "password123",
    })
    return resp.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_fakultas_dan_prodi(client, super_admin_token):
    fakultas_resp = client.post(
        "/api/v1/fakultas",
        json={"nama": "Fakultas Teknik", "kode": "FT"},
        headers=_auth_headers(super_admin_token),
    )
    fakultas_id = fakultas_resp.json()["id"]

    prodi_resp = client.post(
        "/api/v1/prodi",
        json={"nama": "Informatika", "kode": "IF", "fakultas_id": fakultas_id},
        headers=_auth_headers(super_admin_token),
    )
    prodi_id = prodi_resp.json()["id"]
    return fakultas_id, prodi_id


def _login(client, email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def test_super_admin_can_create_fakultas_and_prodi(client):
    token = _bootstrap_super_admin(client)
    fakultas_id, prodi_id = _setup_fakultas_dan_prodi(client, token)
    assert fakultas_id is not None
    assert prodi_id is not None


def test_super_admin_can_create_admin_prodi_account(client):
    token = _bootstrap_super_admin(client)
    _, prodi_id = _setup_fakultas_dan_prodi(client, token)

    response = client.post(
        "/api/v1/users",
        json={
            "nama": "Admin Prodi IF",
            "email": "adminprodi@undip.ac.id",
            "password": "password123",
            "role": "admin_prodi",
            "program_studi_id": prodi_id,
        },
        headers=_auth_headers(token),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "admin_prodi"
    assert data["program_studi_id"] == prodi_id


def test_admin_prodi_creation_requires_program_studi_id(client):
    token = _bootstrap_super_admin(client)
    response = client.post(
        "/api/v1/users",
        json={
            "nama": "Admin Prodi Tanpa Prodi",
            "email": "adminprodi2@undip.ac.id",
            "password": "password123",
            "role": "admin_prodi",
        },
        headers=_auth_headers(token),
    )
    assert response.status_code == 400


def test_super_admin_cannot_access_academic_data(client):
    token = _bootstrap_super_admin(client)
    _, prodi_id = _setup_fakultas_dan_prodi(client, token)

    response = client.post(
        "/api/v1/cpl",
        json={
            "kurikulum_version_id": 1,
            "kode": "CPL-1",
            "deskripsi": "tes",
            "program_studi_id": prodi_id,
        },
        headers=_auth_headers(token),
    )
    assert response.status_code == 403


def test_admin_prodi_can_only_create_dosen_or_kaprodi(client):
    token = _bootstrap_super_admin(client)
    _, prodi_id = _setup_fakultas_dan_prodi(client, token)

    client.post(
        "/api/v1/users",
        json={
            "nama": "Admin Prodi IF",
            "email": "adminprodi@undip.ac.id",
            "password": "password123",
            "role": "admin_prodi",
            "program_studi_id": prodi_id,
        },
        headers=_auth_headers(token),
    )
    admin_prodi_token = _login(client, "adminprodi@undip.ac.id", "password123")

    # Boleh: buat Dosen
    resp_dosen = client.post(
        "/api/v1/users",
        json={
            "nama": "Dosen IF",
            "email": "dosen@undip.ac.id",
            "password": "password123",
            "role": "dosen",
        },
        headers=_auth_headers(admin_prodi_token),
    )
    assert resp_dosen.status_code == 200
    assert resp_dosen.json()["program_studi_id"] == prodi_id  # dikunci otomatis

    # Tidak boleh: buat Super Admin lain
    resp_super = client.post(
        "/api/v1/users",
        json={
            "nama": "Super Admin Lain",
            "email": "superadmin2@undip.ac.id",
            "password": "password123",
            "role": "super_admin",
        },
        headers=_auth_headers(admin_prodi_token),
    )
    assert resp_super.status_code == 403


def test_admin_prodi_cannot_see_users_outside_own_prodi(client):
    token = _bootstrap_super_admin(client)
    fakultas_id, prodi_a = _setup_fakultas_dan_prodi(client, token)
    prodi_b_resp = client.post(
        "/api/v1/prodi",
        json={"nama": "Sistem Informasi", "kode": "SI", "fakultas_id": fakultas_id},
        headers=_auth_headers(token),
    )
    prodi_b = prodi_b_resp.json()["id"]

    client.post(
        "/api/v1/users",
        json={
            "nama": "Admin Prodi A",
            "email": "adminprodia@undip.ac.id",
            "password": "password123",
            "role": "admin_prodi",
            "program_studi_id": prodi_a,
        },
        headers=_auth_headers(token),
    )
    client.post(
        "/api/v1/users",
        json={
            "nama": "Dosen Prodi B",
            "email": "dosenb@undip.ac.id",
            "password": "password123",
            "role": "dosen",
            "program_studi_id": prodi_b,
        },
        headers=_auth_headers(token),
    )

    admin_a_token = _login(client, "adminprodia@undip.ac.id", "password123")
    response = client.get("/api/v1/users", headers=_auth_headers(admin_a_token))
    assert response.status_code == 200
    emails = [u["email"] for u in response.json()]
    assert "dosenb@undip.ac.id" not in emails


def test_dosen_cannot_create_prodi(client):
    token = _bootstrap_super_admin(client)
    _setup_fakultas_dan_prodi(client, token)
    client.post(
        "/api/v1/users",
        json={
            "nama": "Dosen Bebas",
            "email": "dosenbebas@undip.ac.id",
            "password": "password123",
            "role": "dosen",
        },
        headers=_auth_headers(token),
    )
    dosen_token = _login(client, "dosenbebas@undip.ac.id", "password123")

    response = client.post(
        "/api/v1/prodi",
        json={"nama": "Teknik Komputer", "kode": "TK", "fakultas_id": 1},
        headers=_auth_headers(dosen_token),
    )
    assert response.status_code == 403
