import os
from sqlalchemy import create_engine, text
from backend.models import Base

DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        print("Dropping newly created empty tables so we can rename original ones...")
        conn.execute(text("DROP TABLE IF EXISTS product_images CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS products CASCADE;"))
        
        print("Renaming original tables...")
        conn.execute(text("ALTER TABLE IF EXISTS listings RENAME TO products;"))
        # listing_images never existed (we added it in the same sitting we renamed to product_images)
        conn.execute(text("ALTER TABLE IF EXISTS listing_images RENAME TO product_images;"))
        
        conn.commit()
    print("Migration complete. Now recreating any missing schemas...")
    Base.metadata.create_all(bind=engine)
    print("Database is fully repaired!")
except Exception as e:
    print(f"Error repairing db: {e}")
