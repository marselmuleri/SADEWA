from app.core.database import SessionLocal
from app.services.ml_service import train_model


def main():
    db = SessionLocal()
    try:
        result = train_model(db)
        print(result)
    finally:
        db.close()


if __name__ == "__main__":
    main()
