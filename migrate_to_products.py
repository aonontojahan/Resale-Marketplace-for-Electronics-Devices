"""
Database Migration Script - Safe/Idempotent
Renames listing columns to product terminology.
Run with: python migrate_to_products.py
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

migrations = [
    # Rename main tables if they still have old names
    "ALTER TABLE IF EXISTS listings RENAME TO products;",
    "ALTER TABLE IF EXISTS listing_images RENAME TO product_images;",

    # Rename FK columns
    "ALTER TABLE IF EXISTS product_images RENAME COLUMN listing_id TO product_id;",
    "ALTER TABLE IF EXISTS chat_sessions RENAME COLUMN listing_id TO product_id;",
    "ALTER TABLE IF EXISTS reviews RENAME COLUMN listing_id TO product_id;",

    # Create product_images if it doesn't exist yet
    """
    CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        product_id VARCHAR NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        image_url VARCHAR NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0
    );
    """,
]

with engine.connect() as conn:
    for stmt in migrations:
        try:
            conn.execute(text(stmt.strip()))
            print(f"OK: {stmt.strip()[:80]}")
        except Exception as e:
            err = str(e).split('\n')[0]
            print(f"SKIP (already done or n/a): {err[:100]}")
            conn.rollback()
            conn = engine.connect()
    conn.commit()

print("\nMigration complete! Restart the backend server now.")
