import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN address_region VARCHAR"))
        conn.commit()
    except Exception as e:
        print("address_region error:", e)
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN address_city VARCHAR"))
        conn.commit()
    except Exception as e:
        print("address_city error:", e)
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN address_area VARCHAR"))
        conn.commit()
    except Exception as e:
        print("address_area error:", e)
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN address_full VARCHAR"))
        conn.commit()
    except Exception as e:
        print("address_full error:", e)
        
    try:
        conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS address_building"))
        conn.commit()
    except Exception as e:
        print("drop address_building error:", e)
    try:
        conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS address_colony"))
        conn.commit()
    except Exception as e:
        print("drop address_colony error:", e)

print("Migration complete")
