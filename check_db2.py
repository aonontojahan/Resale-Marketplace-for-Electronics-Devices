import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, title FROM listings;"))
        rows = result.fetchall()
        print(f"Listings Data: {rows}")
        
        result2 = conn.execute(text("SELECT * FROM products;"))
        rows2 = result2.fetchall()
        print(f"Products Data: {rows2}")
        
except Exception as e:
    print(f"Error querying: {e}")
