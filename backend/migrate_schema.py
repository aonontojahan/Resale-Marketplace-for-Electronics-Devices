import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = "postgresql://aonontojahan:aonontojahan@localhost/resale_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE offers ADD COLUMN tracking_info VARCHAR NULL"))
        conn.commit()
        print('Added tracking_info column')
    except Exception as e:
        print('Err tracking_info:', e)
