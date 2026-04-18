import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

queries = [
    "ALTER TABLE IF EXISTS product_images RENAME COLUMN listing_id TO product_id;",
    "ALTER TABLE IF EXISTS chat_sessions RENAME COLUMN listing_id TO product_id;",
    "ALTER TABLE IF EXISTS reviews RENAME COLUMN listing_id TO product_id;",
]

for q in queries:
    with engine.connect() as conn:
        try:
            conn.execute(text(q))
            conn.commit()
            print(f"Executed: {q}")
        except Exception as e:
            print(f"Skipped {q}")
