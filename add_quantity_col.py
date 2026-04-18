import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        print("Adding inventory_quantity to products...")
        # Add column with default 2 as requested for previous products
        conn.execute(text("ALTER TABLE products ADD COLUMN inventory_quantity INTEGER DEFAULT 2 NOT NULL;"))
        conn.commit()
    print("Column added successfully. All previous products now have 2 quantity.")
except Exception as e:
    print(f"Error (maybe column already exists): {e}")
