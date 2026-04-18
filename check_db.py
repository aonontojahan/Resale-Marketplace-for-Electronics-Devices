import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, title, status FROM products LIMIT 5;"))
        rows = result.fetchall()
        print(f"Products count: {len(rows)}")
        for r in rows:
            print(r)
except Exception as e:
    print(f"Error querying products: {e}")

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, title, status FROM listings LIMIT 5;"))
        rows = result.fetchall()
        print(f"Listings count: {len(rows)}")
except Exception as e:
    print(f"Error querying listings: {e}")
