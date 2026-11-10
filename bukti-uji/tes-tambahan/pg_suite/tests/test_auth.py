def test_bootstrap_register_creates_super_admin(client):
    response = client.post("/api/v1/auth/register", json={
        "nama": "Super Admin Pertama",
        "email": "superadmin@undip.ac.id",
        "password": "password123",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "superadmin@undip.ac.id"
    assert data["role"] == "super_admin"
    assert "password_hash" not in data


def test_register_closed_after_first_user_exists(client):
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin Pertama",
        "email": "superadmin@undip.ac.id",
        "password": "password123",
    })
    # Percobaan register kedua, siapa pun itu, harus ditolak -- bukan lagi
    # soal email duplikat, tapi karena pintu registrasi publik sudah tertutup.
    response = client.post("/api/v1/auth/register", json={
        "nama": "Orang Lain",
        "email": "oranglain@undip.ac.id",
        "password": "password123",
    })
    assert response.status_code == 403


def test_login_success_returns_token(client):
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin",
        "email": "login@undip.ac.id",
        "password": "password123",
    })
    response = client.post("/api/v1/auth/login", json={
        "email": "login@undip.ac.id",
        "password": "password123",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password_rejected(client):
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin",
        "email": "wrongpass@undip.ac.id",
        "password": "password123",
    })
    response = client.post("/api/v1/auth/login", json={
        "email": "wrongpass@undip.ac.id",
        "password": "salahpassword",
    })
    assert response.status_code == 401


def test_endpoint_without_token_rejected(client):
    response = client.get("/api/v1/fakultas")
    assert response.status_code in (401, 403)


def test_me_returns_current_user_profile(client):
    client.post("/api/v1/auth/register", json={
        "nama": "Super Admin",
        "email": "me@undip.ac.id",
        "password": "password123",
    })
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "me@undip.ac.id",
        "password": "password123",
    })
    token = login_resp.json()["access_token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@undip.ac.id"
    assert data["role"] == "super_admin"
    assert data["program_studi_id"] is None
    assert data["fakultas_id"] is None
